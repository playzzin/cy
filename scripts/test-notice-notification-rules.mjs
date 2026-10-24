// Emulator-only: validates notification receipts without touching live data.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { initializeApp, deleteApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, doc, getDocFromServer, collection, query, where, getDocsFromServer, setDoc, updateDoc, serverTimestamp, arrayUnion, setLogLevel, FieldPath, writeBatch } from 'firebase/firestore';

const projectId = process.env.GCLOUD_PROJECT || '';
assert.ok(projectId.startsWith('demo-'), 'A demo project is required');
assert.ok(process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST, 'Both emulators are required');
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const admin = require('firebase-admin');
admin.initializeApp({ projectId });
const db = admin.firestore();
const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
const apps = [];
setLogLevel('silent');
const client = async (name, uid) => {
    const app = initializeApp({ apiKey: 'demo-key', projectId }, name);
    apps.push(app);
    const auth = getAuth(app);
    connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
    if (uid) await admin.auth().createUser({ uid, email: `${name}@example.test`, password: 'test-only-password' });
    const { user } = await (uid ? signInWithEmailAndPassword : createUserWithEmailAndPassword)(auth, `${name}@example.test`, 'test-only-password');
    await db.doc(`users/${user.uid}`).set({ role: 'user', status: 'active' });
    const firestore = getFirestore(app);
    connectFirestoreEmulator(firestore, host, Number(port));
    return { uid: user.uid, db: firestore };
};
const denied = operation => assert.rejects(operation, error => error.code === 'permission-denied');
let passed = 0;
const check = async (label, test) => { await test(); console.log(`PASS ${label}`); passed++; };
const receipt = uid => ['readBy', arrayUnion(uid), new FieldPath('readAtBy', uid), serverTimestamp(), 'updatedAt', serverTimestamp()];

try {
    const author = await client('notice-author');
    const viewer = await client('notice-viewer');
    const other = await client('notice-other');
    const base = { type: 'direct', senderId: author.uid, senderName: 'Author', recipientScope: 'users', recipientIds: [viewer.uid], readBy: [], readAtBy: {}, title: 'Notice', status: 'active' };
    await check('the notice author can send an in-app notice notification', async () => {
        await setDoc(doc(author.db, 'erp_messages/notice'), { ...base, actionUrl: '/notices?noticeId=safety' });
        assert.equal((await getDocFromServer(doc(viewer.db, 'erp_messages/notice'))).exists(), true);
        assert.equal((await getDocsFromServer(query(collection(viewer.db, 'erp_messages'), where('recipientIds', 'array-contains', viewer.uid)))).size, 1);
        await denied(getDocFromServer(doc(other.db, 'erp_messages/notice')));
    });
    await check('recipients can acknowledge and safely repeat their own receipt', async () => {
        await updateDoc(doc(viewer.db, 'erp_messages/notice'), ...receipt(viewer.uid));
        await updateDoc(doc(viewer.db, 'erp_messages/notice'), ...receipt(viewer.uid));
        assert.deepEqual((await db.doc('erp_messages/notice').get()).data().readBy, [viewer.uid]);
    });
    await check('recipients cannot alter content, recipients, or another user receipt', async () => {
        await denied(updateDoc(doc(viewer.db, 'erp_messages/notice'), { title: 'tampered' }));
        await denied(updateDoc(doc(viewer.db, 'erp_messages/notice'), { recipientIds: [other.uid] }));
        await denied(updateDoc(doc(viewer.db, 'erp_messages/notice'), ...receipt(other.uid)));
        await denied(updateDoc(doc(other.db, 'erp_messages/notice'), ...receipt(other.uid)));
    });
    await check('active users can read and acknowledge ordinary broadcasts', async () => {
        await db.doc('erp_messages/broadcast').set({ ...base, type: 'broadcast', recipientScope: 'all', recipientIds: [] });
        assert.equal((await getDocsFromServer(query(collection(viewer.db, 'erp_messages'), where('recipientScope', '==', 'all')))).size, 1);
        await updateDoc(doc(viewer.db, 'erp_messages/broadcast'), ...receipt(viewer.uid));
        await updateDoc(doc(other.db, 'erp_messages/broadcast'), ...receipt(other.uid));
        assert.equal((await db.doc('erp_messages/broadcast').get()).data().readBy.length, 2);
    });
    await check('legacy system notifications allow only recipient read receipts', async () => {
        await db.doc('erp_messages/legacy').set({ ...base, type: 'system', senderId: 'system' });
        await updateDoc(doc(viewer.db, 'erp_messages/legacy'), ...receipt(viewer.uid));
        await denied(updateDoc(doc(viewer.db, 'erp_messages/legacy'), { body: 'tampered' }));
        await denied(updateDoc(doc(other.db, 'erp_messages/legacy'), ...receipt(other.uid)));
    });
    await check('protected task, memo and bank notifications never inherit broadcast receipt access', async () => {
        for (const senderId of ['system:task-notification', 'system:smart-memo-reminder', 'system:bank-notification']) {
            const path = `erp_messages/${senderId}`;
            await db.doc(path).set({ ...base, type: 'system', senderId, recipientScope: 'all' });
            await denied(updateDoc(doc(other.db, path), ...receipt(other.uid)));
            await updateDoc(doc(viewer.db, path), ...receipt(viewer.uid));
        }
    });
    await check('suspended accounts cannot acknowledge broadcasts', async () => {
        await db.doc(`users/${other.uid}`).update({ status: 'suspended' });
        await denied(updateDoc(doc(other.db, 'erp_messages/broadcast'), ...receipt(other.uid)));
    });
    await check('custom UID receipts preserve exact map keys without colliding with another user', async () => {
        const dotted = await client('custom-dotted', 'viewer.name:team');
        const underscored = await client('custom-underscored', 'viewer_name_team');
        const path = 'erp_messages/custom-uid';
        await db.doc(path).set({ ...base, recipientIds: [dotted.uid, underscored.uid] });
        // Reproduce the former sanitized-key write: rules correctly reject it.
        await denied(updateDoc(doc(dotted.db, path), {
            readBy: arrayUnion(dotted.uid), [`readAtBy.${underscored.uid}`]: serverTimestamp(), updatedAt: serverTimestamp()
        }));
        await updateDoc(doc(underscored.db, path), ...receipt(underscored.uid));
        const previous = (await db.doc(path).get()).data().readAtBy[underscored.uid];
        await updateDoc(doc(dotted.db, path), ...receipt(dotted.uid));
        const batch = writeBatch(dotted.db);
        batch.update(doc(dotted.db, path), ...receipt(dotted.uid));
        await batch.commit();
        const saved = (await db.doc(path).get()).data();
        assert.deepEqual(new Set(saved.readBy), new Set([dotted.uid, underscored.uid]));
        assert.equal(saved.readAtBy[underscored.uid].isEqual(previous), true);
        assert.ok(saved.readAtBy[dotted.uid]);
        await denied(updateDoc(doc(dotted.db, path), ...receipt(underscored.uid)));
    });
    console.log(`Notice notification rules: ${passed} scenarios passed.`);
} finally {
    await Promise.all(apps.map(deleteApp));
    await db.terminate();
}
