// Run only with a demo project and both Firebase emulators.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { initializeApp, deleteApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, doc, getDocFromServer, collection, query, where, getDocsFromServer, setDoc, updateDoc, serverTimestamp, arrayUnion, setLogLevel } from 'firebase/firestore';
const projectId = process.env.GCLOUD_PROJECT || '';
assert.ok(projectId.startsWith('demo-') && process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST, 'Emulator-only test');
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const admin = require('firebase-admin');
admin.initializeApp({ projectId });
const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });
const api = require('../functions/lib/notificationCenter.js');
const board = require('../functions/lib/noticeBoard.js');
const apps = [];
setLogLevel('silent');
const client = async (name, role = 'user') => {
    const app = initializeApp({ apiKey: 'demo-key', projectId }, name); apps.push(app);
    const auth = getAuth(app); connectAuthEmulator(auth, 'http://' + process.env.FIREBASE_AUTH_EMULATOR_HOST, { disableWarnings: true });
    const { user } = await createUserWithEmailAndPassword(auth, name + '@example.test', 'test-only-password');
    await db.doc('users/' + user.uid).set({ role, status: 'active', displayName: name, position: '팀장' });
    const firestore = getFirestore(app), [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
    connectFirestoreEmulator(firestore, host, Number(port));
    return { uid: user.uid, db: firestore };
};
const denied = promise => assert.rejects(promise, e => e.code === 'permission-denied');
let count = 0;
const check = async (label, fn) => { await fn(); count++; console.log('PASS ' + label); };
const receipt = uid => ({ readBy: arrayUnion(uid), ['readAtBy.' + uid]: serverTimestamp(), updatedAt: serverTimestamp() });
const now = Date.now();
const payload = (requestId, extra = {}) => ({ requestId, notify: true, notice: { title: '안전 확인', body: '안전 교육 내용', category: '안전', priority: 'urgent', targetPositions: ['팀장'], requiresConfirmation: true, confirmationDueAt: now + 86400000 }, ...extra });
let sequence = 0;
try {
    const manager = await client('nc-manager', 'admin'), viewer = await client('nc-viewer'), other = await client('nc-other'), excluded = await client('nc-excluded');
    await db.doc('users/' + excluded.uid).update({ position: '작업자' });
    await db.doc('erp_message_settings/daily_report').set({ enabled: true, events: { 'notice.created': { enabled: true, recipientRule: { mode: 'users', recipientIds: [viewer.uid, other.uid, excluded.uid] } } } });
    let saved;
    await check('save and outbox are atomic, concurrent identical saves return one notice and job', async () => {
        const results = await Promise.all([api.saveNoticeAndQueue(db, manager.uid, payload('atomic'), now), api.saveNoticeAndQueue(db, manager.uid, payload('atomic'), now)]);
        assert.equal(results[0].jobId, results[1].jobId); saved = results[0];
        assert.ok((await db.doc('notices/' + saved.noticeId).get()).exists);
        const job = (await db.doc('notice_notification_outbox/' + saved.jobId).get()).data();
        assert.equal(job.status, 'pending'); assert.deepEqual(new Set(job.recipientIds), new Set([viewer.uid, other.uid]));
        await assert.rejects(api.saveNoticeAndQueue(db, manager.uid, payload('atomic', { notice: { ...payload('x').notice, title: 'changed' } }), now), e => e.code === 'already-exists');
    });
    await check('ordinary and suspended accounts cannot save or inspect admin status', async () => {
        await denied(api.saveNoticeAndQueue(db, viewer.uid, payload('forbidden'), now));
        await denied(api.noticeDeliveryReport(db, viewer.uid, {}));
        await db.doc('users/' + excluded.uid).update({ role: 'admin', status: 'suspended' });
        await denied(api.saveNoticeAndQueue(db, excluded.uid, payload('suspended'), now));
    });
    await check('delivery concurrency and retries create exactly one system message without resetting receipts', async () => {
        await Promise.all([api.deliverNoticeJob(db, saved.jobId, now), api.deliverNoticeJob(db, saved.jobId, now)]);
        const job = (await db.doc('notice_notification_outbox/' + saved.jobId).get()).data();
        assert.equal(job.status, 'sent'); assert.equal(job.attempts, 1);
        await updateDoc(doc(viewer.db, 'erp_messages/' + job.messageId), receipt(viewer.uid));
        await api.deliverNoticeJob(db, saved.jobId, now);
        assert.ok((await db.doc('erp_messages/' + job.messageId).get()).get('readBy').includes(viewer.uid));
        saved.messageId = job.messageId;
    });
    await check('system notice content and delivery queue cannot be forged even by clients with admin roles', async () => {
        const data = (await getDocFromServer(doc(viewer.db, 'erp_messages/' + saved.messageId))).data();
        await denied(setDoc(doc(viewer.db, 'erp_messages/forged-notice'), data));
        await denied(updateDoc(doc(manager.db, 'erp_messages/' + saved.messageId), { body: 'forged' }));
        await denied(getDocFromServer(doc(viewer.db, 'notice_notification_outbox/' + saved.jobId)));
        await denied(setDoc(doc(manager.db, 'notice_notification_outbox/forged'), { status: 'sent' }));
        await denied(setDoc(doc(viewer.db, 'notification_preferences/' + viewer.uid), { sound: false }));
        await denied(setDoc(doc(viewer.db, 'notices/forged'), { title: 'forged' }));
        await denied(setDoc(doc(viewer.db, 'notice_categories/forged'), { name: 'forged' }));
        await setDoc(doc(manager.db, 'notice_categories/allowed'), { name: '안전', color: '#0f766e' });
    });
    await check('read state and explicit confirmation remain distinct and confirmation is idempotent', async () => {
        const stateId = api.notificationStateId(viewer.uid, saved.messageId);
        assert.equal((await db.doc('notification_user_states/' + stateId).get()).exists, false);
        await api.updatePersonalNotification(db, viewer.uid, { messageId: saved.messageId, action: 'confirm' }, now);
        await api.updatePersonalNotification(db, viewer.uid, { messageId: saved.messageId, action: 'confirm' }, now + 1000);
        assert.equal((await db.doc('notification_user_states/' + stateId).get()).get('confirmedAt').toMillis(), now);
        await assert.rejects(api.updatePersonalNotification(db, viewer.uid, { messageId: saved.messageId, action: 'snooze', until: now + 60000 }, now), e => e.code === 'failed-precondition');
        assert.equal((await getDocsFromServer(query(collection(viewer.db, 'notification_user_states'), where('userId', '==', viewer.uid)))).size, 1);
        await denied(getDocFromServer(doc(other.db, 'notification_user_states/' + stateId)));
        await denied(updateDoc(doc(viewer.db, 'notification_user_states/' + stateId), { confirmedAt: null }));
    });
    await check('scheduled reminders return only the owner to unread and deliver only once', async () => {
        await updateDoc(doc(other.db, 'erp_messages/' + saved.messageId), receipt(other.uid));
        await api.updatePersonalNotification(db, other.uid, { messageId: saved.messageId, action: 'snooze', until: now + 60000 }, now);
        const stateId = api.notificationStateId(other.uid, saved.messageId);
        assert.equal(await api.deliverPersonalReminder(db, stateId, now), 'skipped');
        assert.equal(await api.deliverPersonalReminder(db, stateId, now + 60001), 'sent');
        assert.equal(await api.deliverPersonalReminder(db, stateId, now + 60002), 'skipped');
        const message = (await db.doc('erp_messages/' + saved.messageId).get()).data();
        assert.ok(message.readBy.includes(viewer.uid)); assert.ok(!message.readBy.includes(other.uid));
        await denied(api.updatePersonalNotification(db, excluded.uid, { messageId: saved.messageId, action: 'confirm' }, now));
    });
    await check('cancelled reminders stay cancelled; invalid times are rejected', async () => {
        await assert.rejects(api.updatePersonalNotification(db, other.uid, { messageId: saved.messageId, action: 'snooze', until: now - 1 }, now), e => e.code === 'invalid-argument');
        await api.updatePersonalNotification(db, other.uid, { messageId: saved.messageId, action: 'snooze', until: now + 60000 }, now);
        await api.updatePersonalNotification(db, other.uid, { messageId: saved.messageId, action: 'resume' }, now);
        assert.equal(await api.deliverPersonalReminder(db, api.notificationStateId(other.uid, saved.messageId), now + 60001), 'skipped');
    });
    await check('preferences validate input and are readable only by their owner', async () => {
        const prefs = { sound: false, sources: { notice: true, memo: false, task: true, message: false }, quietEnabled: true, quietStart: '22:00', quietEnd: '08:00', digestMinutes: 15 };
        await api.savePersonalPreferences(db, viewer.uid, prefs);
        assert.equal((await getDocFromServer(doc(viewer.db, 'notification_preferences/' + viewer.uid))).get('digestMinutes'), 15);
        await denied(getDocFromServer(doc(other.db, 'notification_preferences/' + viewer.uid)));
        await assert.rejects(api.savePersonalPreferences(db, viewer.uid, { ...prefs, quietStart: '99:00' }), e => e.code === 'invalid-argument');
    });
    await check('administrator report includes delivered, read and confirmation states', async () => {
        const report = await api.noticeDeliveryReport(db, manager.uid, { jobId: saved.jobId });
        assert.equal(report.recipients.find(r => r.uid === viewer.uid).confirmedAt, now);
        assert.equal(report.recipients.find(r => r.uid === other.uid).read, false);
        assert.ok((await api.noticeDeliveryReport(db, manager.uid, {})).jobs.some(j => j.id === saved.jobId && j.status === 'sent'));
    });
    await check('superseded notice jobs cannot deliver stale content', async () => {
        const first = await api.saveNoticeAndQueue(db, manager.uid, payload('old'), now);
        await api.saveNoticeAndQueue(db, manager.uid, payload('new', { noticeId: first.noticeId }), now + 1);
        assert.equal(await api.deliverNoticeJob(db, first.jobId, now + 2), 'cancelled');
    });
    await check('sent notifications are archived on editing and deletion while audit receipts survive', async () => {
        const first = await api.saveNoticeAndQueue(db, manager.uid, payload('edit-sent'), now);
        await api.deliverNoticeJob(db, first.jobId, now);
        const updated = await api.saveNoticeAndQueue(db, manager.uid, payload('edit-sent-next', { noticeId: first.noticeId }), now + 1);
        assert.equal((await db.doc('erp_messages/notice-' + first.jobId).get()).get('status'), 'archived');
        await api.deliverNoticeJob(db, updated.jobId, now + 2);
        await api.archiveDeletedNotice(db, first.noticeId);
        assert.equal((await db.doc('erp_messages/notice-' + updated.jobId).get()).get('status'), 'archived');
    });
    await check('failed delivery backs off, stops at 8 and allows a controlled admin retry', async () => {
        const job = await api.saveNoticeAndQueue(db, manager.uid, payload('failure'), now);
        for (let attempt = 0; attempt < 8; attempt++) {
            let first = true;
            const flaky = { doc: path => db.doc(path), runTransaction: fn => { if (first) { first = false; return Promise.reject(new Error('simulated transport failure')); } return db.runTransaction(fn); } };
            assert.equal(await api.deliverNoticeJob(flaky, job.jobId, now + attempt * 3600000), 'retry');
        }
        assert.equal((await db.doc('notice_notification_outbox/' + job.jobId).get()).get('status'), 'failed');
        await denied(api.retryNoticeJob(db, viewer.uid, job.jobId, now));
        assert.equal((await api.retryNoticeJob(db, manager.uid, job.jobId, now)).status, 'sent');
    });
    await check('disabled notifications and empty audience are explicit; required confirmation cannot be silently skipped', async () => {
        await db.doc('erp_message_settings/daily_report').update({ enabled: false });
        await assert.rejects(api.saveNoticeAndQueue(db, manager.uid, payload('required-disabled'), now), e => e.code === 'failed-precondition');
        const input = payload('optional-disabled'); input.notice.requiresConfirmation = false;
        assert.equal((await api.saveNoticeAndQueue(db, manager.uid, input, now)).status, 'disabled');
        await db.doc('erp_message_settings/daily_report').update({ enabled: true, 'events.notice.created.recipientRule': { mode: 'users', recipientIds: [] } });
        // Set the literal event key rather than a dotted field path.
        await db.doc('erp_message_settings/daily_report').set({ enabled: true, events: { 'notice.created': { enabled: true, recipientRule: { mode: 'users', recipientIds: [] } } } });
        input.requestId = 'empty';
        assert.equal((await api.saveNoticeAndQueue(db, manager.uid, input, now)).status, 'no_recipients');
    });
    await check('report pagination does not skip jobs saved at the same timestamp', async () => {
        for (let i = 0; i < 32; i++) {
            const input = payload('page-' + sequence++); input.notify = false; input.notice.requiresConfirmation = false;
            await api.saveNoticeAndQueue(db, manager.uid, input, now);
        }
        const first = await api.noticeDeliveryReport(db, manager.uid, {}), last = first.jobs.at(-1);
        const second = await api.noticeDeliveryReport(db, manager.uid, { before: last.createdAt, beforeId: last.id });
        assert.equal(first.jobs.length, 30); assert.ok(second.jobs.length > 0);
        assert.equal(new Set([...first.jobs, ...second.jobs].map(j => j.id)).size, first.jobs.length + second.jobs.length);
    });
    const leaderA = await client('audience-leader-a'), memberA = await client('audience-member-a');
    const leaderB = await client('audience-leader-b'), memberB = await client('audience-member-b');
    for (const [person, workerId, teamId, role] of [
        [leaderA, 'aud-wa', 'aud-a', '팀장'], [memberA, 'aud-ma', 'aud-a', '작업자'],
        [leaderB, 'aud-wb', 'aud-b', '팀장'], [memberB, 'aud-mb', 'aud-b', '작업자'],
    ]) {
        await db.doc('users/' + person.uid).update({ position: role, linkedWorkerIds: [workerId] });
        await db.doc('workers/' + workerId).set({ teamId, role, isActive: true });
    }
    await db.doc('teams/aud-a').set({ name: '테스트 A팀', leaderId: 'aud-wa' });
    await db.doc('teams/aud-b').set({ name: '테스트 B팀', leaderId: 'aud-wb' });
    await db.doc('erp_message_settings/daily_report').set({ enabled: true, events: { 'notice.created': { enabled: true, recipientRule: { mode: 'allUsers' } } } });
    const scopeInput = (requestId, audience, teamId = null, noticeId = null) => ({ requestId, noticeId, notify: true,
        notice: { title: '공개 범위 테스트', body: '테스트 전용 본문', audience, teamId, targetPositions: [], category: '일반' } });
    let teamNotice, leadersNotice, publicNotice;
    await check('team leader authoring and notification recipients are restricted to their own team', async () => {
        teamNotice = await api.saveNoticeAndQueue(db, leaderA.uid, scopeInput('aud-team', 'team', 'aud-a'));
        const job = (await db.doc('notice_notification_outbox/' + teamNotice.jobId).get()).data();
        assert.deepEqual(new Set(job.recipientIds), new Set([leaderA.uid, memberA.uid]));
        for (const input of [scopeInput('aud-forge-team', 'team', 'aud-b'), scopeInput('aud-forge-all', 'all'), scopeInput('aud-forge-leaders', 'teamLeaders')]) {
            await denied(api.saveNoticeAndQueue(db, leaderA.uid, input));
        }
        await denied(api.saveNoticeAndQueue(db, memberA.uid, scopeInput('aud-member-write', 'team', 'aud-a')));
        await denied(api.saveNoticeAndQueue(db, leaderB.uid, scopeInput('aud-other-edit', 'team', 'aud-b', teamNotice.noticeId)));
        await denied(board.deleteManagedNotice(db, leaderB.uid, teamNotice.noticeId));
        await denied(board.deleteManagedNotice(db, memberA.uid, teamNotice.noticeId));
    });
    await check('server reads separate team-only, leader-only and public notices; direct reads cannot bypass', async () => {
        leadersNotice = await api.saveNoticeAndQueue(db, manager.uid, scopeInput('aud-leaders', 'teamLeaders'));
        publicNotice = await api.saveNoticeAndQueue(db, manager.uid, scopeInput('aud-public', 'all'));
        for (const [person, expectTeam, expectLeaders] of [[leaderA, true, true], [memberA, true, false], [leaderB, false, true], [memberB, false, false]]) {
            const result = await board.readNoticeBoard(db, person.uid);
            const ids = result.notices.map(n => n.id);
            assert.equal(ids.includes(teamNotice.noticeId), expectTeam);
            assert.equal(ids.includes(leadersNotice.noticeId), expectLeaders);
            assert.equal(ids.includes(publicNotice.noticeId), true);
            await denied(getDocFromServer(doc(person.db, 'notices/' + teamNotice.noticeId)));
            await denied(getDocsFromServer(collection(person.db, 'notices')));
        }
        const result = await board.readNoticeBoard(db, leaderA.uid);
        assert.deepEqual(result.access.teams, [{ id: 'aud-a', name: '테스트 A팀' }]);
        assert.equal(result.notices.find(n => n.id === teamNotice.noticeId).canManage, true);
        assert.equal((await board.readNoticeBoard(db, memberA.uid)).notices.find(n => n.id === teamNotice.noticeId).canManage, false);
        const recipients = (await db.doc('notice_notification_outbox/' + leadersNotice.jobId).get()).get('recipientIds');
        assert.ok(recipients.includes(leaderA.uid) && recipients.includes(leaderB.uid));
        assert.ok(!recipients.includes(memberA.uid) && !recipients.includes(memberB.uid));
    });
    await check('team changes revoke notice access and queued delivery rechecks membership', async () => {
        await db.doc('workers/aud-ma').update({ teamId: 'aud-b' });
        assert.ok(!(await board.readNoticeBoard(db, memberA.uid)).notices.some(n => n.id === teamNotice.noticeId));
        await api.deliverNoticeJob(db, teamNotice.jobId);
        assert.deepEqual((await db.doc('erp_messages/notice-' + teamNotice.jobId).get()).get('recipientIds'), [leaderA.uid]);
        await denied(getDocFromServer(doc(memberA.db, 'erp_messages/notice-' + teamNotice.jobId)));
        const edited = await api.saveNoticeAndQueue(db, leaderA.uid, scopeInput('aud-own-edit', 'team', 'aud-a', teamNotice.noticeId));
        assert.equal(edited.noticeId, teamNotice.noticeId);
        await board.deleteManagedNotice(db, leaderA.uid, teamNotice.noticeId);
        assert.equal((await db.doc('notices/' + teamNotice.noticeId).get()).exists, false);
        await db.doc('users/' + leaderA.uid).update({ status: 'suspended' });
        await denied(board.readNoticeBoard(db, leaderA.uid));
    });
    console.log('Notification center: ' + count + ' scenarios passed.');
} finally { await Promise.all(apps.map(deleteApp)); await db.terminate(); }
