const assert = require('node:assert/strict');
const { test } = require('node:test');
const admin = require('../functions/node_modules/firebase-admin');
const { initializeApp, deleteApp } = require('firebase/app');
const { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, connectFirestoreEmulator, getDoc, setDoc, doc, terminate } = require('firebase/firestore');
const { getStorage, connectStorageEmulator, uploadBytes, ref } = require('firebase/storage');

test('일반 사용자와 관리자 모두 신청·원본 직접 접근 및 위조가 차단된다', async () => {
  const projectId = process.env.GCLOUD_PROJECT;
  assert.ok(projectId?.startsWith('demo-team-'));
  for (const key of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST', 'FIREBASE_STORAGE_EMULATOR_HOST']) assert.ok(process.env[key]);
  const server = admin.initializeApp({ projectId });
  try {
    for (const role of ['user', 'admin']) {
      const app = initializeApp({ apiKey: 'demo-key', projectId, storageBucket: `${projectId}.appspot.com` }, `rules-${role}`);
      const auth = getAuth(app);
      connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
      const { user } = await createUserWithEmailAndPassword(auth, `${role}-${Date.now()}@example.test`, 'Synthetic-Test-Only-2026!');
      await server.firestore().doc(`users/${user.uid}`).set({ status: 'active', role, position: '팀장' });
      const db = getFirestore(app), storage = getStorage(app);
      const [dbHost, dbPort] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
      const [storageHost, storagePort] = process.env.FIREBASE_STORAGE_EMULATOR_HOST.split(':');
      connectFirestoreEmulator(db, dbHost, Number(dbPort)); connectStorageEmulator(storage, storageHost, Number(storagePort));
      try {
        for (const [collection, nested, folder] of [['team_worker_requests', 'documents', 'team-worker-documents'], ['team_expense_requests', 'receipts', 'team-expense-receipts']]) {
          await assert.rejects(setDoc(doc(db, collection, 'forged'), { ownerUid: user.uid, status: 'approved' }), error => error.code === 'permission-denied');
          await assert.rejects(setDoc(doc(db, collection, 'forged', nested, 'file'), { forged: true }), error => error.code === 'permission-denied');
          await assert.rejects(getDoc(doc(db, collection, 'forged')), error => error.code === 'permission-denied');
          await assert.rejects(uploadBytes(ref(storage, `${folder}/${user.uid}/forged/file`), new Uint8Array([1, 2, 3]), { contentType: 'image/png' }), error => error.code === 'storage/unauthorized');
        }
        if (role === 'admin') {
          await server.auth().setCustomUserClaims(user.uid, { role: 'admin' });
          await user.getIdToken(true);
          await server.firestore().doc('teams/revocation-fixture').set({ name: 'fixture' });
          await getDoc(doc(db, 'teams', 'revocation-fixture'));
          await server.firestore().doc(`users/${user.uid}`).set({ status: 'active', role: 'user', position: '팀장', linkedWorkerIds: ['own-worker'] });
          await assert.rejects(getDoc(doc(db, 'teams', 'revocation-fixture')), error => error.code === 'permission-denied');
          await assert.rejects(uploadBytes(ref(storage, 'signatures/other-worker/file.png'), new Uint8Array([1, 2, 3]), { contentType: 'image/png' }), error => error.code === 'storage/unauthorized');
          await assert.rejects(uploadBytes(ref(storage, 'signatures/own-worker/file.png'), new Uint8Array([1, 2, 3]), { contentType: 'image/png' }), error => error.code === 'storage/unauthorized');
          await server.firestore().doc(`users/${user.uid}`).update({ status: 'suspended' });
          await assert.rejects(uploadBytes(ref(storage, 'signatures/own-worker/disabled.png'), new Uint8Array([1, 2, 3]), { contentType: 'image/png' }), error => error.code === 'storage/unauthorized');
        }
      } finally { await terminate(db); await deleteApp(app); }
    }
  } finally { await server.delete(); }
});
