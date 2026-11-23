import { strict as assert } from 'assert';
import { test } from 'node:test';
import * as admin from 'firebase-admin';

test('기존 대상 매칭 승인: 원자적 연결, 재시도, 중복 소유, 유형·권한 검사', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async () => {
    assert.equal(process.env.GCLOUD_PROJECT, 'demo-account-matching');
    assert.match(process.env.FIRESTORE_EMULATOR_HOST || '', /^(127\.0\.0\.1|localhost):/);
    const app = admin.initializeApp({ projectId: 'demo-account-matching' });
    const db = app.firestore();
    const { approveMatchedAccountLinkRequest: endpoint } = await import('./accountAccess');
    const actor = { auth: { uid: 'admin-test', token: { role: 'admin' } } } as any;
    const call = (linkId: string, targetEntityId: string, context = actor) => endpoint.run({ linkId, targetEntityId }, context);
    const put = (path: string, data: any) => db.doc(path).set(data);
    const request = (uid: string, entityType = 'worker', accountType = 'worker') => ({ uid, entityType, accountType, entityId: `new_${uid}`, entityName: '가상 요청', entitySubType: entityType === 'company' ? '협력사' : '작업자', relationRole: 'staff', status: 'pending', requestedEntity: { name: '가상 요청', role: '관리자' } });
    try {
        await put('users/admin-test', { status: 'active', role: 'admin' });
        for (const uid of ['member', 'other', 'office-user']) await app.auth().createUser({ uid });
        await put('users/member', { status: 'pending', role: 'user' });
        await put('workers/existing', { name: '가상 기존 인원', role: '일반', teamName: '검증 팀' });
        await put('account_links/request', request('member'));
        const beforeCount = (await db.collection('workers').get()).size;
        const result = await call('request', 'existing');
        assert.equal(result.entityId, 'existing');
        assert.equal((await db.doc('users/member').get()).data()?.position, '일반');
        assert.deepEqual((await db.doc('users/member').get()).data()?.linkedWorkerIds, ['existing']);
        assert.equal((await db.doc('workers/existing').get()).data()?.uid, 'member');
        assert.equal((await app.auth().getUser('member')).customClaims?.accountType, 'worker');
        assert.equal((await db.doc('account_links/request').get()).data()?.matchedFromEntityId, 'new_member');
        assert.equal((await db.collection('workers').get()).size, beforeCount);
        assert.equal((await call('request', 'existing')).reused, true);
        await assert.rejects(call('request', 'different'), (error: any) => error.code === 'failed-precondition');
        assert.equal((await db.collection('audit_logs').where('linkId', '==', 'request').get()).size, 1);

        await put('users/other', { status: 'pending', role: 'user' });
        await put('account_links/other-request', request('other'));
        await assert.rejects(call('other-request', 'existing'), (error: any) => error.code === 'already-exists');
        await assert.rejects(call('other-request', 'missing'), (error: any) => error.code === 'not-found');
        await assert.rejects(call('other-request', 'new_fake'), (error: any) => error.code === 'invalid-argument');
        await assert.rejects(call('other-request', 'existing', { auth: { uid: 'other', token: {} } } as any), (error: any) => error.code === 'permission-denied');
        assert.equal((await db.doc('account_links/other-request').get()).data()?.status, 'pending');
        assert.equal((await db.doc('users/other').get()).data()?.status, 'pending');

        await put('workers/legacy', { name: '가상 레거시 인원', role: '일반', legacyId: 'old-key' });
        await put('users/owner', { status: 'active', linkedWorkerIds: ['old-key'] });
        await assert.rejects(call('other-request', 'legacy'), (error: any) => error.code === 'already-exists');

        await put('companies/rental', { name: '가상 임대사', type: '임대사' });
        await put('account_links/company-request', request('other', 'company', 'partner_company'));
        await assert.rejects(call('company-request', 'rental'), (error: any) => error.code === 'failed-precondition');
        await put('companies/partner', { name: '가상 협력사', type: '협력사' });
        await call('company-request', 'partner');
        assert.equal((await db.doc('users/other').get()).data()?.position, '협력사');

        await put('users/office-user', { status: 'pending', role: 'user' });
        await put('office_staff/staff', { name: '가상 직원', role: '사무실직원' });
        await put('account_links/office-request', request('office-user', 'office', 'office'));
        await call('office-request', 'staff');
        assert.equal((await db.doc('office_staff/staff').get()).data()?.uid, 'office-user');
        assert.equal((await app.auth().getUser('office-user')).customClaims?.accountType, 'office');

        await put('users/suspended', { status: 'suspended', role: 'user' });
        await put('account_links/suspended-request', request('suspended'));
        await assert.rejects(call('suspended-request', 'existing'), (error: any) => error.code === 'failed-precondition');
    } finally { await app.delete(); }
});
