// Emulator-only: validates notification receipts without touching live data.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { initializeApp, deleteApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, doc, getDocFromServer, collection, query, where, getDocsFromServer, setDoc, updateDoc, deleteDoc, serverTimestamp, arrayUnion, setLogLevel } from 'firebase/firestore';

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
const client = async name => {
    const app = initializeApp({ apiKey: 'demo-key', projectId }, name);
    apps.push(app);
    const auth = getAuth(app);
    connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
    const { user } = await createUserWithEmailAndPassword(auth, `${name}@example.test`, 'test-only-password');
    await db.doc(`users/${user.uid}`).set({ role: 'user', status: 'active' });
    const firestore = getFirestore(app);
    connectFirestoreEmulator(firestore, host, Number(port));
    return { uid: user.uid, db: firestore };
};
const denied = operation => assert.rejects(operation, error => error.code === 'permission-denied');
let passed = 0;
const check = async (label, test) => { await test(); console.log(`PASS ${label}`); passed++; };
const receipt = uid => ({ readBy: arrayUnion(uid), [`readAtBy.${uid}`]: serverTimestamp(), updatedAt: serverTimestamp() });

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
        await updateDoc(doc(viewer.db, 'erp_messages/notice'), receipt(viewer.uid));
        await updateDoc(doc(viewer.db, 'erp_messages/notice'), receipt(viewer.uid));
        assert.deepEqual((await db.doc('erp_messages/notice').get()).data().readBy, [viewer.uid]);
    });
    await check('recipients cannot alter content, recipients, or another user receipt', async () => {
        await denied(updateDoc(doc(viewer.db, 'erp_messages/notice'), { title: 'tampered' }));
        await denied(updateDoc(doc(viewer.db, 'erp_messages/notice'), { recipientIds: [other.uid] }));
        await denied(updateDoc(doc(viewer.db, 'erp_messages/notice'), receipt(other.uid)));
        await denied(updateDoc(doc(other.db, 'erp_messages/notice'), receipt(other.uid)));
    });
    await check('active users can read and acknowledge ordinary broadcasts', async () => {
        await db.doc('erp_messages/broadcast').set({ ...base, type: 'broadcast', recipientScope: 'all', recipientIds: [] });
        assert.equal((await getDocsFromServer(query(collection(viewer.db, 'erp_messages'), where('recipientScope', '==', 'all')))).size, 1);
        await updateDoc(doc(viewer.db, 'erp_messages/broadcast'), receipt(viewer.uid));
        await updateDoc(doc(other.db, 'erp_messages/broadcast'), receipt(other.uid));
        assert.equal((await db.doc('erp_messages/broadcast').get()).data().readBy.length, 2);
    });
    await check('legacy system notifications allow only recipient read receipts', async () => {
        await db.doc('erp_messages/legacy').set({ ...base, type: 'system', senderId: 'system' });
        await updateDoc(doc(viewer.db, 'erp_messages/legacy'), receipt(viewer.uid));
        await denied(updateDoc(doc(viewer.db, 'erp_messages/legacy'), { body: 'tampered' }));
        await denied(updateDoc(doc(other.db, 'erp_messages/legacy'), receipt(other.uid)));
    });
    await check('protected task, memo and bank notifications never inherit broadcast receipt access', async () => {
        for (const senderId of ['system:task-notification', 'system:smart-memo-reminder', 'system:bank-notification']) {
            const path = `erp_messages/${senderId}`;
            await db.doc(path).set({ ...base, type: 'system', senderId, recipientScope: 'all' });
            await denied(updateDoc(doc(other.db, path), receipt(other.uid)));
            await updateDoc(doc(viewer.db, path), receipt(viewer.uid));
        }
    });
    await check('suspended accounts cannot acknowledge broadcasts', async () => {
        await db.doc(`users/${other.uid}`).update({ status: 'suspended' });
        await denied(updateDoc(doc(other.db, 'erp_messages/broadcast'), receipt(other.uid)));
    });
    const leader = await client('notice-team-leader');
    await db.doc(`users/${leader.uid}`).update({ position: '팀장' });
    const legacy = { ...base, senderId: leader.uid, recipientIds: [leader.uid], body: 'Legacy message' };
    await db.doc('erp_messages/team-inbox').set({ ...base, recipientIds: [leader.uid] });
    await db.doc('erp_messages/team-old-sent').set(legacy);
    await check('team leaders can read received messages and acknowledge only themselves', async () => {
        assert.equal((await getDocFromServer(doc(leader.db, 'erp_messages/team-inbox'))).exists(), true);
        await updateDoc(doc(leader.db, 'erp_messages/team-inbox'), receipt(leader.uid));
        await updateDoc(doc(leader.db, 'erp_messages/broadcast'), receipt(leader.uid));
        await denied(updateDoc(doc(leader.db, 'erp_messages/team-inbox'), receipt(author.uid)));
        await denied(getDocFromServer(doc(leader.db, 'erp_messages/notice')));
    });
    await check('team leaders cannot send, alter, archive, or delete even their own old messages', async () => {
        await denied(setDoc(doc(leader.db, 'erp_messages/team-new'), legacy));
        await denied(setDoc(doc(leader.db, 'erp_messages/team-broadcast'), { ...legacy, type: 'broadcast', recipientScope: 'all' }));
        for (const patch of [{ body: 'changed' }, { status: 'archived' }, { recipientIds: [author.uid] }]) await denied(updateDoc(doc(leader.db, 'erp_messages/team-old-sent'), patch));
        await denied(deleteDoc(doc(leader.db, 'erp_messages/team-old-sent')));
    });
    await check('all supported team role fields and position aliases enforce the same write restriction', async () => {
        for (const alias of ['팀장', '반장', 'team_leader', 'TEAM_LEAD', 'foreman', 'MhoUDnsuTNUnOpeNvfoL', 'pos_MhoUDnsuTNUnOpeNvfoL']) {
            for (const field of ['role', 'position', 'systemRole', 'accountType', 'roles', 'additionalPositions']) {
                await db.doc(`users/${leader.uid}`).set({ role: 'user', status: 'active', [field]: ['roles', 'additionalPositions'].includes(field) ? [alias] : alias });
                await denied(setDoc(doc(leader.db, 'erp_messages/team-new'), legacy));
            }
        }
    });
    await check('explicit administrator access remains available and removing it immediately restores read only', async () => {
        await db.doc(`users/${leader.uid}`).set({ role: 'admin', position: '팀장', status: 'active' });
        await setDoc(doc(leader.db, 'erp_messages/team-admin-check'), legacy);
        await updateDoc(doc(leader.db, 'erp_messages/team-admin-check'), { body: 'Administrator edit' });
        await deleteDoc(doc(leader.db, 'erp_messages/team-admin-check'));
        await db.doc(`users/${leader.uid}`).update({ role: 'user' });
        await denied(setDoc(doc(leader.db, 'erp_messages/team-new'), legacy));
    });
    console.log(`Notice notification rules: ${passed} scenarios passed.`);
} finally {
    await Promise.all(apps.map(deleteApp));
    await db.terminate();
}
