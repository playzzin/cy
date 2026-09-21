import assert from 'node:assert/strict';
import { initializeApp as initializeAdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getStorage as getAdminStorage } from 'firebase-admin/storage';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signOut } from 'firebase/auth';
import { connectStorageEmulator, deleteObject, getBytes, getStorage, listAll, ref, uploadBytes } from 'firebase/storage';

const projectId = process.env.GCLOUD_PROJECT;
assert.ok(projectId?.startsWith('demo-'), 'This test only runs against a demo emulator project.');
assert.ok(process.env.FIREBASE_AUTH_EMULATOR_HOST && process.env.FIREBASE_STORAGE_EMULATOR_HOST && process.env.FIRESTORE_EMULATOR_HOST);
const storageBucket = `${projectId}.appspot.com`;
const adminApp = initializeAdminApp({ projectId, storageBucket });
const bucket = getAdminStorage(adminApp).bucket();
const db = getAdminFirestore(adminApp);
const app = initializeApp({ projectId, storageBucket, apiKey: 'demo-api-key' });
const auth = getAuth(app);
connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
const storage = getStorage(app);
const [host, port] = process.env.FIREBASE_STORAGE_EMULATOR_HOST.split(':');
connectStorageEmulator(storage, host, Number(port));

let assertions = 0;
const denied = async (label, operation) => {
  await assert.rejects(operation, { code: 'storage/unauthorized' }, label);
  assertions += 1;
};
const signIn = async (role) => {
  await signOut(auth);
  const { user } = await createUserWithEmailAndPassword(auth, `${role}@example.test`, 'emulator-password');
  await getAdminAuth(adminApp).setCustomUserClaims(user.uid, { role });
  await db.doc(`users/${user.uid}`).set({ role, status: 'active' });
  await user.getIdToken(true);
  assert.equal((await user.getIdTokenResult()).claims.role, role);
  return user;
};

await Promise.all([
  bucket.file('documents/example.pdf').save('%PDF-example', { metadata: { contentType: 'application/pdf' } }),
  bucket.file('construction-plan-staging/owner/session/source').save('private'),
  bucket.file('construction-plan-records/site/plan/record/private.png').save('private'),
  bucket.file('construction-plans/site/plan/snapshots/private.json').save('{}'),
]);

await denied('Unauthenticated root listing', () => listAll(ref(storage)));
await signIn('worker');
await denied('Non-admin root listing', () => listAll(ref(storage)));
for (const path of ['users', 'profiles', 'card-billing-statements']) {
  await denied(`Non-admin protected listing ${path}`, () => listAll(ref(storage, path)));
}
assert.equal((await listAll(ref(storage, 'documents'))).items.length, 1);
assertions += 1;

for (const role of ['admin', 'DEV']) {
  const user = await signIn(role);
  const root = await listAll(ref(storage));
  assert.ok(root.prefixes.some(folder => folder.name === 'documents'), `${role} can browse root folders`);
  assertions += 1;
  for (const path of ['construction-plans', 'construction-plan-staging', 'construction-plan-record-staging', 'construction-plan-records']) {
    await denied(`${role} cannot list protected namespace ${path}`, () => listAll(ref(storage, path)));
  }
  await denied(`${role} cannot read a staged source`, () => getBytes(ref(storage, 'construction-plan-staging/owner/session/source')));
  await denied(`${role} cannot overwrite a protected source`, () => uploadBytes(ref(storage, 'construction-plan-staging/owner/session/source'), new Uint8Array([1]), { contentType: 'image/png' }));
  await denied(`${role} cannot delete a protected source`, () => deleteObject(ref(storage, 'construction-plan-staging/owner/session/source')));
  await denied(`${role} still cannot upload invalid business files`, () => uploadBytes(ref(storage, 'documents/script.js'), new Uint8Array([1]), { contentType: 'text/javascript' }));

  // The persisted profile must override stale administrator token claims.
  await db.doc(`users/${user.uid}`).update({ role: 'worker' });
  await denied(`${role} loses root listing after profile demotion`, () => listAll(ref(storage)));
  await db.doc(`users/${user.uid}`).update({ role, status: 'suspended' });
  await denied(`${role} cannot read business files after suspension`, () => getBytes(ref(storage, 'documents/example.pdf')));
  await db.doc(`users/${user.uid}`).delete();
  await denied(`${role} cannot list with only a stale token`, () => listAll(ref(storage)));
}
console.log(`Storage manager security checks passed: ${assertions}`);
await signOut(auth);
process.exit(0);
