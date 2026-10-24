import assert from 'node:assert/strict';
import { initializeApp as initializeAdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getStorage as getAdminStorage } from 'firebase-admin/storage';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signOut } from 'firebase/auth';
import { connectStorageEmulator, deleteObject, getBytes, getStorage, listAll, ref, uploadBytes } from 'firebase/storage';
import { connectFirestoreEmulator, doc, getDoc, getFirestore, setDoc } from 'firebase/firestore';

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
const clientDb = getFirestore(app);
const [firestoreHost, firestorePort] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
connectFirestoreEmulator(clientDb, firestoreHost, Number(firestorePort));
const ledgerPath = 'card-ledger-statements/2026-08/card/row/statement.pdf';
const malformedLedgerPaths = [
  'card-ledger-statements/2026-08/card/statement.pdf',
  'card-ledger-statements/2026-08/card/row/extra/statement.pdf',
];
const analysisResultRef = doc(clientDb, 'cardStatementFileAnalyses', 'fixture', 'results', 'fixture');

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
  bucket.file('card-billing-statements/2026-08/imports/fixture/statement.pdf').save('%PDF-card', { metadata: { contentType: 'application/pdf' } }),
  bucket.file('card-billing-statements/2026-08/fixture/statement.pdf').save('%PDF-card', { metadata: { contentType: 'application/pdf' } }),
  bucket.file(ledgerPath).save('%PDF-card', { metadata: { contentType: 'application/pdf' } }),
  ...malformedLedgerPaths.map(path => bucket.file(path).save('%PDF-card', { metadata: { contentType: 'application/pdf' } })),
  db.doc('cardStatementFileAnalyses/fixture').set({ yearMonth: '2026-08', status: 'completed' }),
  db.doc('cardStatementFileAnalyses/fixture/results/fixture').set({ transactions: [] }),
  bucket.file('construction-plan-staging/owner/session/source').save('private'),
  bucket.file('construction-plan-records/site/plan/record/private.png').save('private'),
  bucket.file('construction-plans/site/plan/snapshots/private.json').save('{}'),
]);

await denied('Unauthenticated root listing', () => listAll(ref(storage)));
await signIn('worker');
await denied('Non-admin root listing', () => listAll(ref(storage)));
for (const path of ['users', 'profiles', 'card-billing-statements', 'card-ledger-statements']) {
  await denied(`Non-admin protected listing ${path}`, () => listAll(ref(storage, path)));
}
assert.equal((await listAll(ref(storage, 'documents'))).items.length, 1);
assertions += 1;

// The generic business-file fallback must not permit malformed card paths or
// Excel files, while normal active accounts can upload supported attachments.
const uploadedLedgerPath = 'card-ledger-statements/2026-08/card/row/uploaded.png';
await uploadBytes(ref(storage, uploadedLedgerPath), new Uint8Array([1, 2, 3]), { contentType: 'image/png' });
assert.equal((await getBytes(ref(storage, uploadedLedgerPath))).byteLength, 3);
assertions += 1;
for (const path of malformedLedgerPaths) {
  await denied('Malformed ledger paths cannot inherit fallback reads', () => getBytes(ref(storage, path)));
  await denied('Malformed ledger paths cannot inherit fallback writes', () => uploadBytes(ref(storage, path), new Uint8Array([1]), { contentType: 'application/pdf' }));
}
await denied('Ledger attachments reject otherwise-valid business spreadsheet MIME types', () => uploadBytes(
  ref(storage, 'card-ledger-statements/2026-08/card/row/invalid.xlsx'),
  new Uint8Array([1]),
  { contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
));
assert.deepEqual((await getDoc(analysisResultRef)).data(), { transactions: [] }, 'An active account can read stored analysis details');
assertions += 1;
await assert.rejects(() => setDoc(doc(clientDb, 'cardStatementFileAnalyses', 'fixture', 'results', 'forged'), { transactions: [] }), { code: 'permission-denied' });
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
// The header and Firestore accept both the DEV name and its persisted position
// identifiers. Storage must recognize the same identities, without trusting
// stale token claims. Active accounts no longer need a special card role.
const devPositions = ['DEV', 'jhl2VTnk9V3C4EiZ4QQI', 'jhl2vtnk9v3c4eiz4qqi', 'pos_jhl2VTnk9V3C4EiZ4QQI', 'pos_jhl2vtnk9v3c4eiz4qqi'];
const cardPaths = ['card-billing-statements/2026-08/imports/fixture/statement.pdf', 'card-billing-statements/2026-08/fixture/statement.pdf'];
cardPaths.push(ledgerPath);
for (const [index, position] of devPositions.entries()) {
  const user = await signIn(`dev-position-${index}`);
  await db.doc(`users/${user.uid}`).set({ role: 'user', position, status: 'active' });
  for (const cardPath of cardPaths) {
    assert.equal((await getBytes(ref(storage, cardPath))).byteLength, 9, `DEV position variant ${index} can read card original`);
    assertions += 1;
  }
  await denied('DEV identifier does not bypass protected staging reads', () => getBytes(ref(storage, 'construction-plan-staging/owner/session/source')));
  await db.doc(`users/${user.uid}`).update({ status: 'suspended' });
  for (const cardPath of cardPaths) {
    await denied('Suspended DEV cannot read card originals', () => getBytes(ref(storage, cardPath)));
  }
  await assert.rejects(() => getDoc(analysisResultRef), { code: 'permission-denied' });
  assertions += 1;
  await db.doc(`users/${user.uid}`).set({ role: 'user', position: 'unrelated-custom-position', status: 'active' });
  for (const cardPath of cardPaths) {
    assert.equal((await getBytes(ref(storage, cardPath))).byteLength, 9, 'Active accounts can read card originals without a special role');
    assertions += 1;
  }
  assert.equal((await getDoc(doc(clientDb, 'cardStatementFileAnalyses', 'fixture'))).exists(), true);
  assertions += 1;
  await assert.rejects(() => setDoc(doc(clientDb, 'cardStatementFileAnalyses', 'fixture'), { forged: true }), { code: 'permission-denied' });
  await assert.rejects(() => setDoc(doc(clientDb, 'cardStatementFileAnalyses', 'fixture', 'results', 'fixture'), { forged: true }), { code: 'permission-denied' });
  assertions += 2;
  await db.doc(`users/${user.uid}`).delete();
  for (const cardPath of cardPaths) {
    await denied('Missing DEV profile cannot read card originals', () => getBytes(ref(storage, cardPath)));
  }
  await assert.rejects(() => getDoc(analysisResultRef), { code: 'permission-denied' });
  assertions += 1;
}
await signOut(auth);
for (const cardPath of cardPaths) {
  await denied('Unauthenticated card original access', () => getBytes(ref(storage, cardPath)));
}
await assert.rejects(() => getDoc(doc(clientDb, 'cardStatementFileAnalyses', 'fixture')), { code: 'permission-denied' });
await assert.rejects(() => getDoc(analysisResultRef), { code: 'permission-denied' });
assertions += 2;
console.log(`Storage manager security checks passed: ${assertions}`);
await signOut(auth);
process.exit(0);
