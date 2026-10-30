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

test('선입금은 권한 있는 수기 입력만 허용하고 충돌과 회차 누락을 보호한다', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async () => {
    assert.equal(process.env.GCLOUD_PROJECT, 'demo-team-worker-request');
    const app = admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
    const db = app.firestore();
    const call = (input: any, uid = 'manual-admin') => handleTeamAdvanceRequest(input, { auth: { uid, token: {} } } as any);
    const manual = { action: 'setPrepayment', workerId: 'manual-worker', yearMonth: '2026-10', amount: 10000, expectedAmount: 0 };
    try {
        await db.doc('users/manual-admin').set({ status: 'active', role: 'admin' });
        await db.doc('users/manual-owner').set({ status: 'active', role: 'user', linkedWorkerIds: ['manual-worker'] });
        await db.doc('users/manual-staff').set({ status: 'active', role: 'user' });
        await db.doc('workers/manual-worker').set({ status: '재직', name: 'fixture', teamId: 'manual-team' });
        await db.doc('workers/manual-staff-worker').set({ uid: 'manual-staff', companyId: 'manual-company' });
        await db.doc('teams/manual-team').set({ companyId: 'manual-company' });
        await db.doc('companies/manual-company').set({ type: '시공사' });
        await db.doc('daily_reports/manual-report').set({ date: '2026-10-01', workers: [{ workerId: 'manual-worker', manDay: 1, unitPrice: 100000 }] });
        await assert.rejects(call(manual, 'manual-owner'), (e: any) => e.code === 'permission-denied');
        for (const amount of [-1, 1.5, '10', Number.MAX_SAFE_INTEGER + 1]) await assert.rejects(call({ ...manual, amount }), (e: any) => e.code === 'invalid-argument');
        const saved = await call(manual, 'manual-staff');
        assert.equal(saved.category, 'other');
        const ref = db.doc(`advance_requests/${saved.id}`);
        assert.equal((await ref.get()).data()?.source, 'manual-prepayment');
        await ref.update({ memo: 'keep', depositAccount: 'corporate' });
        const edits = await Promise.allSettled([20000, 30000].map(amount => call({ ...manual, amount, expectedAmount: 10000 })));
        assert.equal(edits.filter(result => result.status === 'fulfilled').length, 1);
        assert.equal((edits.find(result => result.status === 'rejected') as PromiseRejectedResult).reason.code, 'aborted');
        const current = (await ref.get()).data()!;
        assert.equal(current.memo, 'keep'); assert.equal(current.depositAccount, 'corporate');
        await assert.rejects(call({ action: 'setCategory', id: saved.id, category: 'first', expectedCategory: 'other' }), (e: any) => e.code === 'permission-denied');
        await call({ ...manual, amount: 80000, expectedAmount: current.requestedAmount });
        const request = { action: 'create', requestId: 'invalid', workerId: 'manual-worker', yearMonth: '2026-10', requestedAmount: 30000, category: 'first' };
        await assert.rejects(call(request, 'manual-owner'), (e: any) => e.code === 'failed-precondition');
        await assert.rejects(call({ ...request, category: 'other' }, 'manual-owner'), (e: any) => e.code === 'invalid-argument');
        await db.doc('advance_requests/manual-legacy').set({ workerId: 'manual-worker', requesterUid: 'manual-owner', status: 'approved', requestedAmount: 10000 });
        await call({ action: 'setCategory', id: 'manual-legacy', category: 'second', expectedCategory: 'unclassified' });
        assert.equal((await db.doc('advance_requests/manual-legacy').get()).data()?.category, 'second');
        await call({ ...manual, amount: 0, expectedAmount: 80000 });
        assert.equal((await ref.get()).data()?.requestedAmount, 0);
        await db.doc('workers/manual-staff-worker').update({ companyId: 'other-company' });
        await assert.rejects(call(manual, 'manual-staff'), (e: any) => e.code === 'permission-denied');
    } finally {
        const requests = await db.collection('advance_requests').where('workerId', '==', 'manual-worker').get();
        await Promise.all(requests.docs.map(doc => doc.ref.delete()));
        await Promise.all(['users/manual-admin', 'users/manual-owner', 'users/manual-staff', 'workers/manual-worker', 'workers/manual-staff-worker', 'teams/manual-team', 'companies/manual-company', 'daily_reports/manual-report', 'server_settings/advance-request-manual-worker'].map(path => db.doc(path).delete()));
        await app.delete();
    }
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
        await assert.rejects(call({ ...edit, category: 'second' }), (e: any) => e.code === 'aborted');
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
        await assert.rejects(call(legacyInput), (e: any) => e.code === 'invalid-argument');
        const legacy = { id: createHash('sha256').update('advance-leader:legacy').digest('hex') };
        await db.doc(`advance_requests/${legacy.id}`).set({ ...rows.docs[0].data(), category: admin.firestore.FieldValue.delete(),
            requestFingerprint: advanceRequestFingerprint(input.workerId, input.yearMonth, input.requestedAmount, input.memo, undefined) }, { merge: true });
        const repaired = await call({ ...legacyInput, category: 'first' });
        assert.equal(repaired.id, legacy.id);
        assert.equal(repaired.category, 'first');
        assert.equal((await db.doc(`advance_requests/${legacy.id}`).get()).data()?.category, 'first');
        assert.equal((await db.collection('advance_requests').where('workerId', '==', 'advance-worker').get()).size, 2);
        await db.doc(`advance_requests/${legacy.id}`).update({ category: admin.firestore.FieldValue.delete() });
        await call({ action: 'setCategory', id: legacy.id, category: 'second', expectedCategory: 'unclassified' });
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
