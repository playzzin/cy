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
const { deliverTaskNotification, taskNotificationId } = require('./lib/taskNotifications');
admin.initializeApp({ projectId });
const db = admin.firestore();
const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
const apps = [];
setLogLevel('silent');
const client = async (name, profile = {}) => {
    const app = initializeApp({ apiKey: 'demo-key', projectId }, name);
    apps.push(app);
    const auth = getAuth(app);
    connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
    const { user } = await createUserWithEmailAndPassword(auth, `${name}@example.test`, 'test-only-password');
    await db.doc(`users/${user.uid}`).set({ role: 'user', status: 'active', displayName: name, ...profile });
    const firestore = getFirestore(app);
    connectFirestoreEmulator(firestore, host, Number(port));
    return { uid: user.uid, db: firestore };
};
let passed = 0;
const check = async (name, run) => { await run(); passed++; console.log(`PASS ${name}`); };
const denied = operation => assert.rejects(operation, error => error.code === 'permission-denied');

try {
    const owner = await client('task-owner');
    const other = await client('task-other');
    const dev = await client('task-dev', { position: 'DEV' });
    const extraDev = await client('task-extra-dev', { additionalPositions: ['개발자'] });
    const suspended = await client('task-suspended', { role: 'dev', status: 'suspended' });
    const task = { title: '다운로드 요청 테스트', status: '요청', createdById: owner.uid, createdBy: 'task-owner', assignee: '개발팀', priority: '보통' };
    const taskRef = db.doc('tasks/notification-test');
    const input = { taskId: taskRef.id, eventId: 'create', after: task };
    const requestRef = db.doc(`erp_messages/${taskNotificationId(taskRef.id, 'create')}`);
    await taskRef.set(task);
    await check('concurrent retries create one unread DEV message, excluding suspended accounts', async () => {
        const results = await Promise.all([deliverTaskNotification(db, input), deliverTaskNotification(db, input)]);
        assert.deepEqual(results.sort(), ['duplicate', 'sent']);
        assert.equal((await db.collection('erp_messages').get()).size, 1);
        const message = (await requestRef.get()).data();
        assert.deepEqual(message.recipientIds.sort(), [dev.uid, extraDev.uid].sort());
        assert.ok(!message.recipientIds.includes(suspended.uid));
        assert.deepEqual(message.readBy, []);
        assert.equal(message.actionUrl, '/todo?taskId=notification-test');
    });
    await check('only recipients appear in inbox queries; read receipts are individual', async () => {
        const inbox = user => getDocsFromServer(query(collection(user.db, 'erp_messages'), where('recipientIds', 'array-contains', user.uid)));
        assert.equal((await getDocFromServer(doc(dev.db, requestRef.path))).exists(), true);
        assert.equal((await inbox(dev)).size, 1);
        assert.equal((await inbox(owner)).size, 0);
        await denied(getDocFromServer(doc(other.db, requestRef.path)));
        await updateDoc(doc(dev.db, requestRef.path), { readBy: arrayUnion(dev.uid), [`readAtBy.${dev.uid}`]: serverTimestamp(), updatedAt: serverTimestamp() });
        assert.deepEqual((await requestRef.get()).data().readBy, [dev.uid]);
        assert.equal((await deliverTaskNotification(db, input)), 'duplicate');
        assert.deepEqual((await requestRef.get()).data().readBy, [dev.uid]);
    });
    const review = { ...task, status: '완료', review: { changes: '다운로드 수정', location: '내보내기', steps: '다운로드 선택', expected: '파일 저장' } };
    const reviewInput = { taskId: taskRef.id, eventId: 'review', before: { ...task, status: '진행' }, after: review };
    const reviewRef = db.doc(`erp_messages/${taskNotificationId(taskRef.id, 'review')}`);
    await check('completion through the same server delivery path targets the requester with review guidance', async () => {
        await taskRef.set(review);
        assert.equal(await deliverTaskNotification(db, reviewInput), 'sent');
        const message = (await reviewRef.get()).data();
        assert.deepEqual(message.recipientIds, [owner.uid]);
        assert.match(message.body, /다운로드 수정/);
        assert.match(message.body, /다운로드 선택/);
        assert.equal((await getDocFromServer(doc(owner.db, reviewRef.path))).exists(), true);
        assert.equal((await getDocsFromServer(query(collection(owner.db, 'erp_messages'), where('recipientIds', 'array-contains', owner.uid)))).size, 1);
        await denied(getDocFromServer(doc(other.db, reviewRef.path)));
        await updateDoc(doc(owner.db, reviewRef.path), { readBy: arrayUnion(owner.uid), [`readAtBy.${owner.uid}`]: serverTimestamp(), updatedAt: serverTimestamp() });
        assert.deepEqual((await reviewRef.get()).data().readBy, [owner.uid]);
    });
    await check('content changes, spoofed system messages and deletion are denied even for DEV', async () => {
        await denied(updateDoc(doc(owner.db, reviewRef.path), { title: 'forged' }));
        await denied(updateDoc(doc(dev.db, reviewRef.path), { type: 'direct', recipientIds: [other.uid] }));
        await denied(deleteDoc(doc(dev.db, reviewRef.path)));
        await denied(setDoc(doc(dev.db, 'erp_messages/forged-task'), { senderId: 'system:task-notification', type: 'system', recipientIds: [dev.uid] }));
        await denied(setDoc(doc(dev.db, 'erp_messages/forged-task-direct'), { senderId: 'system:task-notification', type: 'direct', recipientIds: [dev.uid] }));
    });
    await check('comments and final approval do not create duplicate review alerts', async () => {
        const count = (await db.collection('erp_messages').get()).size;
        assert.equal(await deliverTaskNotification(db, { ...reviewInput, eventId: 'comment', before: review, after: { ...review, description: '추가 내용' } }), 'skipped');
        assert.equal(await deliverTaskNotification(db, { ...reviewInput, eventId: 'approved', before: review, after: { ...review, status: '검토' } }), 'skipped');
        assert.equal((await db.collection('erp_messages').get()).size, count);
    });
    await check('revision notifies DEV and a second completion creates a fresh unread requester notification', async () => {
        assert.equal(await deliverTaskNotification(db, { ...reviewInput, eventId: 'revision', before: review, after: { ...task, status: '재요청' } }), 'sent');
        assert.equal(await deliverTaskNotification(db, { ...reviewInput, eventId: 'review-again' }), 'sent');
        const again = (await db.doc(`erp_messages/${taskNotificationId(taskRef.id, 'review-again')}`).get()).data();
        assert.deepEqual(again.readBy, []);
        assert.deepEqual(again.recipientIds, [owner.uid]);
    });
    await check('ambiguous legacy names and disabled requester accounts suppress delivery', async () => {
        await db.doc(`users/${other.uid}`).update({ displayName: 'task-owner' });
        const legacy = { ...review };
        delete legacy.createdById;
        assert.equal(await deliverTaskNotification(db, { ...reviewInput, eventId: 'ambiguous', after: legacy }), 'no_recipients');
        await db.doc(`users/${owner.uid}`).update({ status: 'suspended' });
        assert.equal(await deliverTaskNotification(db, { ...reviewInput, eventId: 'suspended' }), 'no_recipients');
    });
    console.log(`Task notification integration: ${passed} scenarios passed.`);
} finally {
    await Promise.all(apps.map(app => deleteApp(app)));
    await db.terminate();
}
