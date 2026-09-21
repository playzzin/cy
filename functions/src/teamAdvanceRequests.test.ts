import { strict as assert } from 'assert';
import { test } from 'node:test';
import * as admin from 'firebase-admin';
import { handleTeamAdvanceRequest } from './teamAdvanceRequests';

test('동시 가불 신청, 응답 유실 재시도, 본인 연결과 취소 상태를 검증한다', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async () => {
    assert.equal(process.env.GCLOUD_PROJECT, 'demo-team-worker-request');
    const app = admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
    const db = app.firestore();
    const call = (input: any, uid = 'advance-leader') => handleTeamAdvanceRequest(input, { auth: { uid, token: {} } } as any);
    const input = { action: 'create', workerId: 'advance-worker', yearMonth: '2026-09', requestedAmount: 80000, memo: 'fixture' };
    try {
        await db.doc('users/advance-leader').set({ status: 'active', role: 'user', linkedWorkerIds: ['advance-worker'] });
        await db.doc('users/advance-other').set({ status: 'active', role: 'user', linkedWorkerIds: [] });
        await db.doc('workers/advance-worker').set({ status: '재직', isActive: true, name: 'fixture', teamId: 'fixture' });
        await db.doc('daily_reports/advance-fixture').set({ date: '2026-09-01', workers: [{ workerId: 'advance-worker', manDay: 1, unitPrice: 100000 }] });
        await assert.rejects(call({ ...input, requestId: 'outsider' }, 'advance-other'), (e: any) => e.code === 'permission-denied');
        const results = await Promise.allSettled([call({ ...input, requestId: 'one' }), call({ ...input, requestId: 'two' })]);
        assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
        const rows = await db.collection('advance_requests').where('workerId', '==', 'advance-worker').get();
        assert.equal(rows.size, 1);
        assert.equal(rows.docs[0].data().requestedAmount, 80000);
        const accepted = results[0].status === 'fulfilled' ? 'one' : 'two';
        const replay = await call({ ...input, requestId: accepted });
        assert.equal(replay.id, rows.docs[0].id);
        await assert.rejects(call({ ...input, requestId: accepted, requestedAmount: 1000 }), (e: any) => e.code === 'already-exists');
        await assert.rejects(call({ action: 'cancel', id: replay.id }, 'advance-other'), (e: any) => e.code === 'permission-denied');
        await call({ action: 'cancel', id: replay.id });
        await call({ action: 'cancel', id: replay.id });
        assert.equal((await db.doc(`advance_requests/${replay.id}`).get()).data()?.status, 'cancelled');
        await db.doc('workers/advance-worker').update({ isActive: false });
        await assert.rejects(call({ ...input, requestId: 'inactive' }), (e: any) => e.code === 'permission-denied');
    } finally {
        const requests = await db.collection('advance_requests').where('workerId', '==', 'advance-worker').get();
        await Promise.all(requests.docs.map(doc => doc.ref.delete()));
        await Promise.all(['users/advance-leader', 'users/advance-other', 'workers/advance-worker', 'daily_reports/advance-fixture', 'server_settings/advance-request-advance-worker'].map(path => db.doc(path).delete()));
        await app.delete();
    }
});
