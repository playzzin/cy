import { strict as assert } from 'assert';
import { test } from 'node:test';
import * as admin from 'firebase-admin';
import { readTeamScopedData } from './teamScopedRead';
import { saveTeamResourceStatus } from './teamResourceStatus';

const context = (uid = 'status-leader') => ({ auth: { uid, token: { role: 'admin' } } } as any);
const denied = (reason: any) => reason.code === 'permission-denied';
const request = (changes: any = {}) => ({ kind: 'site', id: 'status-site', status: 'completed', expectedStatus: 'active', expectedIsActive: null, ...changes });

test('비로그인·미리보기·잘못된 대상과 상태 요청을 쓰기 전에 차단한다', async () => {
    await assert.rejects(saveTeamResourceStatus(request(), {} as any), (reason: any) => reason.code === 'unauthenticated');
    await assert.rejects(saveTeamResourceStatus(request(), context('cy-preview-test')), denied);
    for (const changes of [{ kind: 'users' }, { id: '../other' }, { id: '' }, { status: 'deleted' }, { kind: 'worker', status: 'completed' }, { expectedStatus: undefined }, { expectedIsActive: 'false' }]) {
        await assert.rejects(saveTeamResourceStatus(request(changes), context()), (reason: any) => reason.code === 'invalid-argument');
    }
});

test('팀장 종료·퇴사·복귀, 범위 제한, 동시 수정 충돌과 감사 이력을 검증한다', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async () => {
    const projectId = process.env.TEAM_READ_TEST_PROJECT_ID || 'demo-team-resource-status';
    assert.match(projectId, /^demo-/);
    const app = admin.initializeApp({ projectId });
    const db = app.firestore();
    const fixtures: Record<string, any> = {
        'users/status-leader': { status: 'active', position: '팀장', linkedWorkerIds: ['status-anchor'] },
        'users/status-worker-user': { status: 'active', position: '작업자', linkedWorkerIds: ['status-anchor'] },
        'users/status-unlinked': { status: 'active', position: '팀장', linkedWorkerIds: [] },
        'workers/status-anchor': { teamId: 'status-team', status: '재직', isActive: true },
        'teams/status-team': { name: '가상팀', legacyId: 'status-legacy', isActive: true },
        'workers/status-member': { name: '가상팀원', teamId: 'status-team', status: '재직', isActive: true, unitPrice: 123, siteId: 'status-site' },
        'workers/status-legacy-member': { name: '가상기존팀원', teamId: 'status-legacy', status: 'retired', isActive: false },
        'workers/status-foreign': { teamId: 'foreign', teamName: '가상팀', status: '재직', isActive: true },
        'workers/status-blocked': { teamId: 'status-team', status: '출입금지', isActive: false },
        'sites/status-site': { name: '가상현장', responsibleTeamId: 'status-team', status: 'active', endDate: '2026-10-10' },
        'sites/status-foreign': { responsibleTeamId: 'foreign', responsibleTeamName: '가상팀', teamId: 'status-team', status: 'active' },
        'sites/status-legacy': { responsibleTeamId: 'status-legacy', status: '종료' },
        'daily_reports/status-report': { date: '2026-10-01', teamId: 'status-team', siteId: 'status-site', workers: [{ workerId: 'status-member', manDay: 1, unitPrice: 123 }] },
    };
    const call = (input: any, uid?: string) => saveTeamResourceStatus(input, context(uid));
    const stale = (reason: any) => reason.code === 'failed-precondition';
    try {
        const batch = db.batch(); Object.entries(fixtures).forEach(([path, data]) => batch.set(db.doc(path), data)); await batch.commit();
        await call(request({ teamId: 'forged', unitPrice: 999, updatedBy: 'forged' }));
        let site = (await db.doc('sites/status-site').get()).data()!;
        assert.equal(site.status, 'completed'); assert.equal(site.endDate, '2026-10-10'); assert.equal(site.unitPrice, undefined); assert.equal(site.responsibleTeamId, 'status-team');
        const sites = await readTeamScopedData({ collection: 'sites' }, context());
        assert.equal(sites.rows.find((row: any) => row.id === 'status-site')?.status, 'completed');
        await assert.rejects(call(request()), stale);
        await call(request({ status: 'active', expectedStatus: 'completed' }));
        assert.equal((await db.doc('sites/status-site').get()).data()?.status, 'active');
        const workerRequest = request({ kind: 'worker', id: 'status-member', status: '퇴사', expectedStatus: '재직', expectedIsActive: true });
        await call(workerRequest);
        let member = (await db.doc('workers/status-member').get()).data()!;
        assert.equal(member.status, '퇴사'); assert.equal(member.isActive, false); assert.equal(member.teamId, 'status-team'); assert.equal(member.unitPrice, 123); assert.equal(member.siteId, 'status-site');
        const workers = await readTeamScopedData({ collection: 'workers' }, context());
        assert.equal(workers.rows.find((row: any) => row.id === 'status-member')?.status, '퇴사');
        await call({ ...workerRequest, status: '재직', expectedStatus: '퇴사', expectedIsActive: false });
        member = (await db.doc('workers/status-member').get()).data()!;
        assert.equal(member.status, '재직'); assert.equal(member.isActive, true);
        assert.deepEqual((await db.doc('daily_reports/status-report').get()).data(), fixtures['daily_reports/status-report']);
        const logs = await db.collection('database_logs').where('source', '==', 'teamResourceStatus').get();
        assert.equal(logs.size, 4);
        for (const log of logs.docs) {
            assert.equal(log.data().actor.uid, 'status-leader');
            assert.equal(log.data().before.unitPrice, undefined); assert.equal(log.data().after.unitPrice, undefined);
        }
        // No-op requests do not add duplicate history.
        await call(request({ status: 'active' }));
        assert.equal((await db.collection('database_logs').where('source', '==', 'teamResourceStatus').get()).size, 4);
        await call(request({ id: 'status-legacy', status: 'active', expectedStatus: '종료' }));
        await call({ ...workerRequest, id: 'status-legacy-member', status: '재직', expectedStatus: 'retired', expectedIsActive: false });
        for (const uid of ['status-worker-user', 'status-unlinked', 'missing']) await assert.rejects(call(request(), uid), denied);
        await assert.rejects(call(request({ id: 'status-foreign' })), denied);
        await assert.rejects(call({ ...workerRequest, id: 'status-foreign' }), denied);
        await assert.rejects(call({ ...workerRequest, id: 'status-blocked', status: '재직', expectedStatus: '출입금지', expectedIsActive: false }), denied);
        await assert.rejects(call({ ...workerRequest, id: 'status-anchor' }), stale);
        await db.doc('workers/status-member').update({ teamId: 'foreign' });
        await assert.rejects(call(workerRequest), denied);
        await db.doc('sites/status-site').update({ responsibleTeamId: 'foreign' });
        await assert.rejects(call(request()), denied);
        await db.doc('sites/status-site').update({ responsibleTeamId: 'status-team' });
        await db.doc('teams/status-team').update({ isActive: false });
        await assert.rejects(call(request()), denied);
        await db.doc('teams/status-team').update({ isActive: true });
        // An anchor linked through its legacy team ID is resolved on every write.
        await db.doc('workers/status-anchor').update({ teamId: 'status-legacy' });
        await call(request());
        await db.doc('workers/status-anchor').update({ status: 'resigned' });
        await assert.rejects(call(request({ status: 'active', expectedStatus: 'completed' })), denied);
        await db.doc('workers/status-anchor').update({ status: '재직' });
        await db.doc('users/status-leader').update({ status: 'suspended' });
        await assert.rejects(call(request({ status: 'active', expectedStatus: 'completed' })), denied);
    } finally {
        const logs = await db.collection('database_logs').where('source', '==', 'teamResourceStatus').get();
        await Promise.all([...Object.keys(fixtures), ...logs.docs.map(doc => doc.ref.path)].map(path => db.doc(path).delete()));
        await app.delete();
    }
});
