import assert from 'node:assert/strict';
import { initializeApp as initializeAdminApp } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  signOut,
} from 'firebase/auth';
import {
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

const projectId = process.env.GCLOUD_PROJECT || 'demo-cy-vehicle-import';
process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';

initializeAdminApp({ projectId });
const adminDb = getAdminFirestore();

const app = initializeApp({ apiKey: 'demo-api-key', projectId }, 'vehicle-import-rules-client');
const auth = getAuth(app);
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
const credential = await createUserWithEmailAndPassword(
  auth,
  `vehicle-support-${Date.now()}@example.test`,
  'rules-test-password',
);
await adminDb.collection('users').doc(credential.user.uid).set({
  uid: credential.user.uid,
  role: 'support',
  status: 'active',
});
const db = getFirestore(app);
connectFirestoreEmulator(db, '127.0.0.1', 8080);

const identityId = 'vehicle_import_rules_test';
const identityPath = `vehicleExpenseImportIdentities/${identityId}`;
await adminDb.doc(identityPath).set({
  id: identityId,
  kind: 'fine',
  sourceSha256: 'a'.repeat(64),
  entryIndex: 0,
  expenseId: 'vehicle_fine_rules_test',
});
assert.equal((await adminDb.doc(identityPath).get()).exists, true, 'Admin SDK must retain server access');

const expectDenied = async (label, operation) => {
  let denied = false;
  try {
    await operation();
  } catch (error) {
    denied = String(error?.code || '').includes('permission-denied');
  }
  assert.equal(denied, true, `${label} should be denied`);
};

const identityRef = doc(db, 'vehicleExpenseImportIdentities', identityId);
await expectDenied('signed-in claim read', () => getDoc(identityRef));
await expectDenied('signed-in claim list', () => getDocs(query(
  collection(db, 'vehicleExpenseImportIdentities'),
  limit(1),
)));
await expectDenied('signed-in claim create', () => setDoc(
  doc(db, 'vehicleExpenseImportIdentities', 'client-created'),
  { expenseId: 'attacker-controlled' },
));
await expectDenied('signed-in claim update', () => updateDoc(identityRef, { expenseId: 'redirected' }));
await expectDenied('signed-in claim delete', () => deleteDoc(identityRef));

await signOut(auth);
console.log('Vehicle import identity Firestore rule integration checks passed.');
