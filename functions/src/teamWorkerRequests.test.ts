import { strict as assert } from 'assert';
import { test } from 'node:test';
import * as admin from 'firebase-admin';
import { handleTeamWorkerRequest, workerFields, workerPayroll } from './teamWorkerRequests';
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=';
const rejected = (code: string) => (error: any) => error.code === code;
test('인증과 필수 입력을 검증한다', async () => {
    await assert.rejects(handleTeamWorkerRequest({ action: 'list' }, {} as any), rejected('unauthenticated'));
    assert.throws(() => workerFields({ name: '테스트', address: '테스트' }), rejected('invalid-argument'));
    assert.throws(() => workerFields({ name: '테스트', address: '테스트', contact: '01000000000', accountNumber: '00123456' }), rejected('invalid-argument'));
    for (const contact of ['01000000000abc', '010***00000000', ['01000000000'], 1000000000]) assert.throws(() => workerFields({ name: '테스트', address: '테스트', contact }), rejected('invalid-argument'));
    assert.equal(workerFields({ name: '테스트', address: '테스트', contact: '010-0000-0000' }).contact, '01000000000');
});
test('소속팀·서류 접근 제한, 승인 전 미등록, 승인 원자성·중복·반려를 검증한다', { skip: !process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_STORAGE_EMULATOR_HOST }, async () => {
    assert.equal(process.env.GCLOUD_PROJECT, 'demo-team-worker-request');
    const projectId = 'demo-team-worker-request', app = admin.initializeApp({ projectId, storageBucket: `${projectId}.appspot.com` });
    const db = app.firestore();
    const call = (uid: string, input: any): Promise<any> => handleTeamWorkerRequest(input, { auth: { uid, token: { role: 'admin' } } } as any);
    const fixtures = {
        'users/worker-leader-a': { status: 'active', position: 'team-position', linkedWorkerIds: ['leader-worker-a'], name: '테스트 팀장 A' },
        'users/worker-leader-b': { status: 'active', position: '팀장', linkedWorkerIds: ['leader-worker-b'] },
        'users/worker-office': { status: 'active', position: 'office-position', name: '테스트 사무실' },
        'users/worker-stranger': { status: 'active', role: 'user' },
        'users/worker-inactive': { status: 'suspended', role: 'admin' },
        'settings/menus_v12': { admin: { positionConfig: [{ id: 'team-position', name: '팀장' }, { id: 'office-position', name: '사무실' }] } },
        'workers/leader-worker-a': { teamId: 'team-a', role: '팀장' }, 'workers/leader-worker-b': { teamId: 'team-b', role: '팀장' },
        'teams/team-a': { name: '테스트 A팀', color: '#ef4444', iconKey: 'fa-helmet-safety' }, 'teams/team-b': { name: '테스트 B팀' },
        'companies/dynamic-company': { name: '㈜청연이엔지' }, 'companies/other-company': { name: '다른 회사' },
    };
    const fields = { name: '가상 작업자', address: '테스트시 테스트로 1', contact: '01000000000', bankName: '테스트은행', accountNumber: '001234567890', accountHolder: '가상 작업자' };
    const upload = { action: 'upload', requestId: 'first-request', teamId: 'team-a', fileId: 'identity-one', kind: 'identity', contentType: 'image/png', base64: png, name: 'sample.png' };
    const submit = { action: 'submit', requestId: 'first-request', teamId: 'team-a', fields, identityId: 'identity-one', bankId: 'bank-one', companyId: 'other-company', status: 'approved' };
    try {
        const batch = db.batch(); Object.entries(fixtures).forEach(([path, value]) => batch.set(db.doc(path), value)); await batch.commit();
        const list = await call('worker-leader-a', { action: 'list', yearMonth: '2026-09' });
        assert.equal(list.company.id, 'dynamic-company'); assert.equal(list.teams.length, 1); assert.equal(list.canReview, false);
        for (const uid of ['worker-stranger', 'worker-inactive']) await assert.rejects(call(uid, { action: 'list', yearMonth: '2026-09' }), rejected('permission-denied'));
        await assert.rejects(call('worker-leader-a', { ...upload, teamId: 'team-b' }), rejected('permission-denied'));
        await assert.rejects(call('worker-leader-a', submit), rejected('failed-precondition'));
        await call('worker-leader-a', upload); await call('worker-leader-a', upload);
        await assert.rejects(call('worker-leader-a', { ...upload, kind: 'bank' }), rejected('already-exists'));
        await assert.rejects(call('worker-leader-a', { ...upload, base64: Buffer.concat([Buffer.from(png, 'base64'), Buffer.from('change')]).toString('base64') }), rejected('already-exists'));
        await call('worker-leader-a', { ...upload, fileId: 'bank-one', kind: 'bank' });
        await assert.rejects(call('worker-leader-a', { ...upload, fileId: 'third-document' }), rejected('resource-exhausted'));
        const result = await call('worker-leader-a', submit);
        assert.equal(result.status, 'pending'); assert.equal((await db.collection('workers').get()).size, 2);
        const stored = (await db.doc(`team_worker_requests/${result.id}`).get()).data()!;
        assert.equal(stored.companyId, 'dynamic-company'); assert.equal(stored.teamId, 'team-a'); assert.equal(stored.teamIcon, 'fa-helmet-safety');
        assert.ok(stored.attachments.every((doc: any) => !doc.url && !doc.fullPath));
        await assert.rejects(call('worker-leader-b', { action: 'document', id: result.id, fileId: 'identity-one' }), rejected('permission-denied'));
        assert.equal((await call('worker-office', { action: 'document', id: result.id, fileId: 'identity-one' })).base64, png);
        assert.equal((await call('worker-leader-a', { action: 'document', id: result.id, fileId: 'identity-one' })).base64, png);
        assert.equal((await call('worker-leader-b', { action: 'list', yearMonth: stored.yearMonth })).requests.length, 0);
        await call('worker-leader-a', upload); assert.equal((await call('worker-leader-a', submit)).id, result.id);
        await assert.rejects(call('worker-leader-a', { ...upload, fileId: 'late-document' }), rejected('failed-precondition'));
        await assert.rejects(call('worker-leader-a', { action: 'review', id: result.id, decision: 'approved', payroll: { payType: '일급제', unitPrice: 150000 } }), rejected('permission-denied'));
        await assert.rejects(call('worker-office', { action: 'review', id: result.id, decision: 'approved' }), rejected('invalid-argument'));
        const reviewed = await Promise.all([1, 2].map(() => call('worker-office', { action: 'review', id: result.id, decision: 'approved', payroll: { payType: '일급제', unitPrice: 150000 } })));
        assert.equal(reviewed[0].workerId, reviewed[1].workerId); assert.equal((await db.collection('workers').get()).size, 3);
        const worker = (await db.collection('workers').doc(reviewed[0].workerId).get()).data()!;
        assert.equal(worker.payType, '일급제'); assert.equal(worker.salaryModel, '일급제'); assert.equal(worker.unitPrice, 150000);
        assert.equal(worker.companyId, 'dynamic-company'); assert.equal(worker.teamId, 'team-a'); assert.equal(worker.accountNumber, '001234567890'); assert.equal(worker.status, '재직'); assert.equal(worker.needsApproval, false);
        await assert.rejects(call('worker-office', { action: 'review', id: result.id, decision: 'rejected', reason: '늦은 반려' }), rejected('failed-precondition'));
        for (const kind of ['identity', 'bank']) await call('worker-leader-a', { ...upload, requestId: 'duplicate-request', kind, fileId: `${kind}-one` });
        const duplicate = await call('worker-leader-a', { ...submit, requestId: 'duplicate-request' });
        await assert.rejects(call('worker-office', { action: 'review', id: duplicate.id, decision: 'approved', payroll: { payType: '일급제', unitPrice: 150000 } }), rejected('already-exists'));
        assert.equal((await db.doc(`team_worker_requests/${duplicate.id}`).get()).data()!.status, 'pending');
        await assert.rejects(call('worker-office', { action: 'review', id: duplicate.id, decision: 'rejected' }), rejected('invalid-argument'));
        await call('worker-office', { action: 'review', id: duplicate.id, decision: 'rejected', reason: '기존 작업자 확인' });
        assert.equal((await db.collection('workers').get()).size, 3);
        // Different contacts must not bypass the same name/account lock.
        const concurrentRequests = [];
        for (let index = 1; index <= 2; index++) {
            const requestId = `concurrent-${index}`;
            for (const kind of ['identity', 'bank']) await call('worker-leader-a', { ...upload, requestId, kind, fileId: `${kind}-one` });
            concurrentRequests.push(await call('worker-leader-a', { ...submit, requestId, fields: { ...fields, name: '동시 등록 테스트', contact: `0100000000${index}`, accountNumber: '009999999999' } }));
        }
        const concurrent = await Promise.allSettled(concurrentRequests.map(row => call('worker-office', { action: 'review', id: row.id, decision: 'approved', payroll: { payType: '일급제', unitPrice: 150000 } })));
        assert.equal(concurrent.filter(row => row.status === 'fulfilled').length, 1);
        assert.equal(concurrent.filter(row => row.status === 'rejected' && row.reason.code === 'already-exists').length, 1);
        // Deleted downstream data must not be reported as successfully registered.
        await db.collection('workers').doc(reviewed[0].workerId).delete();
        await assert.rejects(call('worker-office', { action: 'review', id: result.id, decision: 'approved', payroll: { payType: '일급제', unitPrice: 150000 } }), rejected('failed-precondition'));
        // History and temporary uploads do not exhaust another month's limit.
        for (let offset = 0; offset < 2001; offset += 450) {
            const history = db.batch();
            for (let index = offset; index < Math.min(offset + 450, 2001); index++) history.set(db.doc(`team_worker_requests/history-${index}`), { ownerUid: 'worker-leader-a', yearMonth: '2000-01', status: 'rejected' });
            await history.commit();
        }
        const monthly = await call('worker-leader-a', { action: 'list', yearMonth: stored.yearMonth });
        assert.equal(monthly.requests.length, 4);
        const ids = new Set<string>(); let cursor: string | undefined;
        do {
            const page = await call('worker-leader-a', { action: 'list', yearMonth: '2000-01', cursor });
            for (const row of page.requests) { assert.ok(!ids.has(row.id)); ids.add(row.id); }
            cursor = page.nextCursor || undefined;
        } while (cursor);
        assert.equal(ids.size, 2001);
        await assert.rejects(call('worker-office', { action: 'list', yearMonth: '2000-01', pageSize: 101 }), rejected('invalid-argument'));
        await assert.rejects(call('worker-office', { action: 'list', yearMonth: '2000-01', cursor: '../x' }), rejected('invalid-argument'));

        await db.doc('workers/leader-worker-a').update({ status: '퇴사' });
        await assert.rejects(call('worker-leader-a', { ...upload, requestId: 'retired' }), rejected('permission-denied'));
        await db.doc('workers/leader-worker-a').update({ status: '재직' });
        await db.doc('companies/dynamic-company').update({ isActive: false });
        await assert.rejects(call('worker-leader-a', { action: 'list', yearMonth: stored.yearMonth }), rejected('failed-precondition'));
        await db.doc('companies/dynamic-company').update({ isActive: true });
        await db.doc('users/worker-leader-a').update({ position: '사무실' });
        await assert.rejects(call('worker-leader-a', { action: 'review', id: result.id, decision: 'approved', payroll: { payType: '일급제', unitPrice: 150000 } }), rejected('permission-denied'));
    } finally {
        await db.recursiveDelete(db.collection('team_worker_requests'));
        await app.storage().bucket().deleteFiles({ prefix: 'team-worker-documents/' });
        for (const collection of ['users', 'workers', 'teams', 'companies', 'settings', 'server_settings', 'database_logs']) await db.recursiveDelete(db.collection(collection));
        await app.delete();
    }
});

test('급여 설정은 지원되는 구분과 양의 정수 단가만 허용한다', () => {
 for (const payroll of [undefined, {}, {payType:'일급제',unitPrice:0}, {payType:'일급제',unitPrice:'150000'}, {payType:'일급제',unitPrice:1.2}, {payType:'일급제',unitPrice:1000000001}, {payType:'unknown',unitPrice:1}]) assert.throws(() => workerPayroll(payroll), rejected('invalid-argument'));
});
