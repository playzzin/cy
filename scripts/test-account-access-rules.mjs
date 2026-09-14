import assert from 'node:assert/strict';
import { initializeApp as initializeAdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, doc, getDocFromServer, getFirestore, setLogLevel, updateDoc } from 'firebase/firestore';

const projectId = process.env.GCLOUD_PROJECT || '';
assert.ok(projectId.startsWith('demo-'), 'Only a demo project is allowed');
assert.ok(process.env.FIRESTORE_EMULATOR_HOST, 'Firestore emulator is required');
assert.ok(process.env.FIREBASE_AUTH_EMULATOR_HOST, 'Auth emulator is required');
const [firestoreHost, firestorePort] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
const adminApp = initializeAdminApp({ projectId });
const adminDb = getAdminFirestore(adminApp);
setLogLevel('silent');
const apps = [];
let assertions = 0;
const client = async (name, profile, claims) => {
  const app = initializeApp({ apiKey: 'demo-api-key', projectId }, name);
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
  const { user } = await createUserWithEmailAndPassword(auth, `${name}@example.test`, 'emulator-only-password');
  if (profile) await adminDb.doc(`users/${user.uid}`).set({ uid: user.uid, ...profile });
  if (claims) {
    await getAdminAuth(adminApp).setCustomUserClaims(user.uid, claims);
    await user.getIdToken(true);
  }
  const db = getFirestore(app);
  connectFirestoreEmulator(db, firestoreHost, Number(firestorePort));
  return { db, uid: user.uid };
};
const allow = async (db, path) => {
  console.log('Checking allowed read: ' + path);
  assert.equal((await getDocFromServer(doc(db, path))).exists(), true, `Expected access: ${path}`);
  assertions++;
};
const deny = async (db, path) => {
  await assert.rejects(getDocFromServer(doc(db, path)), error => error.code === 'permission-denied', `Expected denial: ${path}`);
  assertions++;
};

try {
  for (const [path, data] of Object.entries({
    'settings/account-rule-test': { value: 'fixture' },
    'account_rule_fixture/record': { value: 'fixture' },
    'sites/site-a': { clientCompanyId: 'company-a' },
    'sites/site-b': { clientCompanyId: 'company-a' },
    'sites/site-c': { clientCompanyId: 'company-b' },
    'daily_reports/report-a': { siteId: 'site-a', companyId: 'company-a' },
    'daily_reports/report-b': { siteId: 'site-b', companyId: 'company-a' },
  })) await adminDb.doc(path).set(data);

  for (const status of ['pending', 'rejected', 'suspended']) {
    const { db, uid } = await client(status, { role: 'admin', status }, { role: 'admin' });
    await allow(db, `users/${uid}`);
    await deny(db, 'settings/account-rule-test');
    await deny(db, 'account_rule_fixture/record');
    await deny(db, 'sites/site-a');
    await assert.rejects(updateDoc(doc(db, `users/${uid}`), { status: 'active' }), error => error.code === 'permission-denied');
    assertions++;
  }
  const active = await client('active-admin', { role: 'admin', status: 'active' });
  await allow(active.db, 'settings/account-rule-test');
  await allow(active.db, 'sites/site-c');
  const legacy = await client('legacy-admin', { role: 'admin' });
  await allow(legacy.db, 'settings/account-rule-test');
  const missing = await client('missing-profile', null, { role: 'admin' });
  await deny(missing.db, 'settings/account-rule-test');

  const portal = await client('client-portal', {
    role: 'construction_company', accountType: 'construction_company', status: 'active',
    linkedCompanyIds: ['company-a'], linkedSiteIds: ['site-a'],
  });
  await allow(portal.db, 'sites/site-a');
  await allow(portal.db, 'daily_reports/report-a');
  await deny(portal.db, 'sites/site-b');
  await deny(portal.db, 'sites/site-c');
  await deny(portal.db, 'daily_reports/report-b');
  await assert.rejects(updateDoc(doc(portal.db, `users/${portal.uid}`), { linkedSiteIds: ['site-a', 'site-b'] }), error => error.code === 'permission-denied');
  assertions++;
  const rental = await client('rental-portal', {
    role: 'rental_company', accountType: 'rental_company', status: 'active',
    linkedCompanyIds: ['rental-company'], linkedSiteIds: ['site-a'],
  });
  await allow(rental.db, 'sites/site-a');
  await deny(rental.db, 'sites/site-b');
  const unlinkedRental = await client('unlinked-rental', {
    role: 'rental_company', accountType: 'rental_company', status: 'active',
    linkedCompanyIds: ['rental-company'],
  });
  await deny(unlinkedRental.db, 'sites/site-c');
  console.log(`Account access Firestore rules: ${assertions} checks passed.`);
} finally {
  await Promise.all(apps.map(app => deleteApp(app)));
  await adminDb.terminate();
}