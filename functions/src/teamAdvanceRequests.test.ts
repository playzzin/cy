import { strict as assert } from 'assert';
import { test } from 'node:test';
import * as admin from 'firebase-admin';
import { advanceRequestFingerprint, handleTeamAdvanceRequest, parseAdvanceRequestCategory } from './teamAdvanceRequests';
import { createHash } from 'crypto';

test('분류를 검증하고 기존 클라이언트의 재시도 지문을 유지한다', () => {
    for (const category of ['first', 'second', 'other']) assert.equal(parseAdvanceRequestCategory(category), category);
    assert.equal(parseAdvanceRequestCategory(undefined), 'other');
    for (const value of ['third', '', null, 1]) assert.throws(() => parseAdvanceRequestCategory(value), (error: any) => error.code === 'invalid-argument');
    const values = ['worker-a', '2026-10', 10000, 'memo'] as const;
    assert.equal(advanceRequestFingerprint(...values, undefined), createHash('sha256').update(JSON.stringify(values)).digest('hex'));
    assert.notEqual(advanceRequestFingerprint(...values, 'first'), advanceRequestFingerprint(...values, 'second'));
});

test('동시 가불 신청, 응답 유실 재시도, 본인 연결과 취소 상태를 검증한다', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async () => {
    assert.equal(process.env.GCLOUD_PROJECT, 'demo-team-worker-request');
    const app = admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
    const db = app.firestore();
    const call = (input: any, uid = 'advance-leader') => handleTeamAdvanceRequest(input, { auth: { uid, token: {} } } as any);
    const input = { action: 'create', workerId: 'advance-worker', yearMonth: '2026-09', requestedAmount: 80000, memo: 'fixture', category: 'second' };
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
        assert.equal(rows.docs[0].data().category, 'second');
        const accepted = results[0].status === 'fulfilled' ? 'one' : 'two';
        const replay = await call({ ...input, requestId: accepted });
        assert.equal(replay.id, rows.docs[0].id);
        assert.equal(replay.category, 'second');
        await assert.rejects(call({ ...input, requestId: accepted, category: 'first' }), (e: any) => e.code === 'already-exists');
        await assert.rejects(call({ ...input, requestId: 'invalid-category', category: 'third' }), (e: any) => e.code === 'invalid-argument');
        await assert.rejects(call({ ...input, requestId: accepted, requestedAmount: 1000 }), (e: any) => e.code === 'already-exists');
        const edit = { action: 'setCategory', id: replay.id, category: 'first', expectedCategory: 'second' };
        await assert.rejects(call(edit, 'advance-other'), (e: any) => e.code === 'permission-denied');
        await assert.rejects(call({ ...edit, category: 'third' }), (e: any) => e.code === 'invalid-argument');
        assert.equal((await call(edit)).category, 'first');
        await assert.rejects(call({ ...edit, category: 'other' }), (e: any) => e.code === 'aborted');
        const edited = (await rows.docs[0].ref.get()).data()!;
        assert.equal(edited.category, 'first');
        assert.equal(edited.requestedAmount, 80000);
        await rows.docs[0].ref.update({ status: 'approved' });
        await assert.rejects(call({ ...edit, expectedCategory: 'first' }), (e: any) => e.code === 'permission-denied');
        await rows.docs[0].ref.update({ status: 'requested' });
        await assert.rejects(call({ action: 'cancel', id: replay.id }, 'advance-other'), (e: any) => e.code === 'permission-denied');
        await call({ action: 'cancel', id: replay.id });
        await call({ action: 'cancel', id: replay.id });
        assert.equal((await db.doc(`advance_requests/${replay.id}`).get()).data()?.status, 'cancelled');
        await assert.rejects(call({ ...edit, expectedCategory: 'first' }), (e: any) => e.code === 'permission-denied');
        const legacyInput = { ...input, requestId: 'legacy', category: undefined };
        const legacy = await call(legacyInput);
        await db.doc(`advance_requests/${legacy.id}`).update({ category: admin.firestore.FieldValue.delete() });
        const repaired = await call({ ...legacyInput, category: 'first' });
        assert.equal(repaired.id, legacy.id);
        assert.equal(repaired.category, 'first');
        assert.equal((await db.doc(`advance_requests/${legacy.id}`).get()).data()?.category, 'first');
        assert.equal((await db.collection('advance_requests').where('workerId', '==', 'advance-worker').get()).size, 2);
        await db.doc(`advance_requests/${legacy.id}`).update({ category: admin.firestore.FieldValue.delete() });
        await call({ action: 'setCategory', id: legacy.id, category: 'second', expectedCategory: 'other' });
        assert.equal((await db.doc(`advance_requests/${legacy.id}`).get()).data()?.category, 'second');
        await db.doc('workers/advance-worker').update({ isActive: false });
        await assert.rejects(call({ ...input, requestId: 'inactive' }), (e: any) => e.code === 'permission-denied');
    } finally {
        const requests = await db.collection('advance_requests').where('workerId', '==', 'advance-worker').get();
        await Promise.all(requests.docs.map(doc => doc.ref.delete()));
        await Promise.all(['users/advance-leader', 'users/advance-other', 'workers/advance-worker', 'daily_reports/advance-fixture', 'server_settings/advance-request-advance-worker'].map(path => db.doc(path).delete()));
        await app.delete();
    }
});
