// Synthetic emulator data only; never connects to production.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { initializeApp, deleteApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, doc, getDocFromServer, setDoc, terminate, setLogLevel } from 'firebase/firestore';
const projectId = process.env.GCLOUD_PROJECT || '';
assert.ok(projectId.startsWith('demo-'));
assert.ok(process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST);
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const admin = require('firebase-admin');
const server = admin.initializeApp({ projectId });
const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
setLogLevel('silent');
try {
    await server.firestore().doc('support_shared_data/engine_oil_cycle').set({ data: { otherTeam: { currentKm: 999 } } });
    for (const role of ['leader', 'worker', 'admin']) {
        const app = initializeApp({ apiKey: 'demo-key', projectId }, `oil-${role}`);
        const auth = getAuth(app);
        connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
        const { user } = await createUserWithEmailAndPassword(auth, `oil-${role}@example.test`, 'test-only-password');
        await server.firestore().doc(`users/${user.uid}`).set({ status: 'active', role: role === 'admin' ? 'admin' : 'user', position: role === 'leader' ? '팀장' : '작업자' });
        const db = getFirestore(app);
        connectFirestoreEmulator(db, host, Number(port));
        const target = doc(db, 'support_shared_data/engine_oil_cycle');
        try {
            if (role === 'admin') {
                assert.equal((await getDocFromServer(target)).exists(), true);
                await setDoc(target, { data: { own: { currentKm: 100 } } }, { merge: true });
            } else {
                await assert.rejects(getDocFromServer(target), error => error.code === 'permission-denied');
                await assert.rejects(setDoc(target, { data: {} }), error => error.code === 'permission-denied');
            }
            console.log(`PASS ${role}: shared oil read/write boundary`);
        } finally { await terminate(db); await deleteApp(app); }
    }
} finally { await server.delete(); }
