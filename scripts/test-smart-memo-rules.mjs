import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { initializeApp, deleteApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, doc, getDocFromServer, getDocsFromServer, collection, query, where, setDoc, updateDoc, deleteDoc, serverTimestamp, arrayUnion, setLogLevel } from 'firebase/firestore';

const projectId = process.env.GCLOUD_PROJECT || '';
assert.ok(projectId.startsWith('demo-'), 'Only a demo project is allowed');
assert.ok(process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST, 'Both emulators are required');
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const admin = require('firebase-admin');
const { saveMemoReminder, deliverMemoReminder, memoReminderId } = require('./lib/smartMemoReminders');
admin.initializeApp({ projectId });
const db = admin.firestore();
const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
const apps = [];
setLogLevel('silent');
const client = async (name, profile = { role: 'user', status: 'active' }) => {
    const app = initializeApp({ apiKey: 'demo-key', projectId }, name);
    apps.push(app);
    const auth = getAuth(app);
    connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
    const { user } = await createUserWithEmailAndPassword(auth, `${name}@example.test`, 'test-only-password');
    await db.doc(`users/${user.uid}`).set(profile);
    const firestore = getFirestore(app);
    connectFirestoreEmulator(firestore, host, Number(port));
    return { uid: user.uid, db: firestore };
};
let passed = 0;
const check = async (name, run) => { await run(); passed++; console.log(`PASS ${name}`); };
const denied = operation => assert.rejects(operation, error => error.code === 'permission-denied');
const now = Date.parse('2026-09-14T00:00:00Z');
const due = now + 60000;

try {
    const owner = await client('memo-owner');
    const other = await client('memo-other');
    const dev = await client('memo-dev', { role: 'user', position: 'DEV', status: 'active' });
    const inactive = await client('memo-inactive', { role: 'user', status: 'suspended' });
    await db.doc('smart_memos/private').set({ userId: owner.uid, title: '테스트 메모', scope: 'private' });
    await db.doc('smart_memos/public').set({ userId: owner.uid, title: '공통 테스트', scope: 'public' });
    const schedule = (uid, memoId = 'private', repeat = 'none') => saveMemoReminder(db, uid, { memoId, remindAt: due, repeat }, now);
    const ref = db.doc(`smart_memo_reminders/${memoReminderId(owner.uid, 'private')}`);
    await check('owner can save; ordinary foreign viewer and inactive user cannot', async () => {
        await schedule(owner.uid);
        await denied(schedule(other.uid));
        await denied(schedule(inactive.uid, 'public'));
    });
    await check('DEV can schedule foreign memo; public memo allows ordinary viewer', async () => {
        await schedule(dev.uid);
        await schedule(other.uid, 'public');
    });
    await check('editable profile email cannot impersonate a legacy memo owner', async () => {
        await db.doc('smart_memos/legacy').set({ userId: 'legacy@example.test', scope: 'private' });
        await db.doc(`users/${other.uid}`).update({ email: 'legacy@example.test' });
        await denied(schedule(other.uid, 'legacy'));
    });
    await check('time and repeat validation', async () => {
        for (const input of [{ memoId: 'private', remindAt: now }, { memoId: 'private', remindAt: due, repeat: 'bad' }, { memoId: '../bad', remindAt: due }]) {
            await assert.rejects(saveMemoReminder(db, owner.uid, input, now), error => error.code === 'invalid-argument');
        }
    });
    await check('weekday schedule starting on Saturday moves to Monday', async () => {
        const saturday = Date.parse('2026-09-19T09:30:00+09:00');
        await saveMemoReminder(db, other.uid, { memoId: 'public', remindAt: saturday, repeat: 'weekdays' }, now);
        const saved = await db.doc(`smart_memo_reminders/${memoReminderId(other.uid, 'public')}`).get();
        assert.equal(saved.data().remindAt.toMillis(), Date.parse('2026-09-21T09:30:00+09:00'));
        await schedule(other.uid, 'public');
    });
    await check('reminders are self-readable and all direct writes are denied', async () => {
        assert.equal((await getDocFromServer(doc(owner.db, ref.path))).exists(), true);
        assert.equal((await getDocsFromServer(query(collection(owner.db, 'smart_memo_reminders'), where('userId', '==', owner.uid)))).size, 1);
        await denied(getDocFromServer(doc(other.db, ref.path)));
        await denied(getDocFromServer(doc(dev.db, ref.path)));
        await denied(updateDoc(doc(owner.db, ref.path), { status: 'cancelled' }));
        await denied(setDoc(doc(dev.db, 'smart_memo_reminders/forged'), { userId: dev.uid, memoId: 'private' }));
        await denied(deleteDoc(doc(owner.db, ref.path)));
    });
    await check('no early send; concurrent delivery creates one personal message with current title', async () => {
        assert.equal(await deliverMemoReminder(db, ref.id, now), false);
        await db.doc('smart_memos/private').update({ title: '변경된 테스트 제목' });
        const sent = await Promise.all([deliverMemoReminder(db, ref.id, due), deliverMemoReminder(db, ref.id, due)]);
        assert.equal(sent.filter(Boolean).length, 1);
        const messages = await db.collection('erp_messages').get();
        assert.equal(messages.size, 1);
        const message = messages.docs[0].data();
        assert.equal(message.title, '메모 알림: 변경된 테스트 제목');
        assert.deepEqual(message.recipientIds, [owner.uid]);
        assert.deepEqual(message.readBy, []);
        assert.equal(message.actionUrl, '/memos?memoId=private');
        assert.equal((await ref.get()).data().status, 'sent');
    });
    const messageRef = db.doc(`erp_messages/${(await ref.get()).data().lastMessageId}`);
    await check('recipient can read and acknowledge; other ordinary user and content tampering denied', async () => {
        assert.equal((await getDocFromServer(doc(owner.db, messageRef.path))).exists(), true);
        await denied(getDocFromServer(doc(other.db, messageRef.path)));
        await updateDoc(doc(owner.db, messageRef.path), { readBy: arrayUnion(owner.uid), [`readAtBy.${owner.uid}`]: serverTimestamp(), updatedAt: serverTimestamp() });
        await denied(updateDoc(doc(owner.db, messageRef.path), { title: 'forged' }));
        await denied(updateDoc(doc(dev.db, messageRef.path), { recipientIds: [other.uid] }));
        await denied(deleteDoc(doc(dev.db, messageRef.path)));
        await denied(setDoc(doc(dev.db, 'erp_messages/forged-memo-message'), { senderId: 'system:smart-memo-reminder', type: 'system', recipientIds: [dev.uid] }));
    });
    await check('reschedule archives old message, repeats automatically and cancellation prevents future delivery', async () => {
        await schedule(owner.uid, 'private', 'daily');
        assert.equal((await messageRef.get()).data().status, 'archived');
        assert.equal(await deliverMemoReminder(db, ref.id, due), true);
        assert.equal((await ref.get()).data().remindAt.toMillis(), due + 86400000);
        assert.equal(await deliverMemoReminder(db, ref.id, due), false);
        assert.equal(await deliverMemoReminder(db, ref.id, due + 86400000), true);
        await saveMemoReminder(db, owner.uid, { memoId: 'private', remindAt: null }, due + 86400000);
        assert.equal((await ref.get()).data().status, 'cancelled');
        assert.equal(await deliverMemoReminder(db, ref.id, due + 2 * 86400000), false);
    });
    await check('revoked DEV or deleted memo suppresses delivery', async () => {
        await db.doc(`users/${dev.uid}`).update({ position: '일반' });
        assert.equal(await deliverMemoReminder(db, memoReminderId(dev.uid, 'private'), due), false);
        await db.doc('smart_memos/public').delete();
        assert.equal(await deliverMemoReminder(db, memoReminderId(other.uid, 'public'), due), false);
    });
    console.log(`Smart memo integration: ${passed} scenarios passed.`);
} finally {
    await Promise.all(apps.map(app => deleteApp(app)));
    await db.terminate();
}
