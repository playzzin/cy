import { strict as assert } from 'assert';
import { test } from 'node:test';
import * as admin from 'firebase-admin';
import { buildWhiteboardParticipation } from './whiteboardParticipation';
import { getTeamScopedData } from './teamScopedRead';

const own = { id: 'wb-own', legacyId: 'old-own', name: '담당팀', companyId: 'company-a' };
const support = { id: 'wb-support', legacyId: 'old-support', name: '지원팀', companyId: 'company-b', secret: 'hidden' };
const sites = [
    { id: 'wb-site', legacyId: 'old-site', name: '담당 현장', responsibleTeamId: 'old-own', companyId: 'company-a' },
    { id: 'wb-support-only', name: '지원팀만 투입한 담당 현장', responsibleTeam: { id: 'wb-own' } },
    { id: 'wb-other-site', name: '타 팀 담당 현장', assignedTeamId: 'wb-own', responsibleTeamId: 'wb-support' },
];
const reports = [
    { id: 'wb-mixed', date: '2026-10-01', siteId: 'old-site', teamId: 'wb-own', totalManDay: 99, workers: [
        { workerId: 'own-worker', name: '개인 이름', teamId: 'old-own', manDay: 2, unitPrice: 123456 },
        { workerId: 'other-worker', name: '외부 개인 이름', teamId: 'old-support', manDay: 3, unitPrice: 987654 },
    ] },
    { id: 'wb-support-report', date: '2026-10-02', siteId: 'wb-site', teamId: 'old-support', teamName: '지원팀', workers: [{ workerId: 's', manDay: 0.5 }] },
    { id: 'wb-legacy', date: '2026-10-02', siteId: 'wb-support-only', teamId: 'wb-support', totalManDay: 4, workers: [] },
    { id: 'wb-unrelated', date: '2026-10-01', siteId: 'wb-other-site', teamId: 'wb-own', responsibleTeamId: 'wb-own', totalManDay: 99, workers: [{ teamId: 'wb-own', manDay: 99 }] },
];

test('담당 현장에 참여한 타 팀 공수와 타 팀 작성 일보를 포함하고 다른 담당 현장은 제외한다', () => {
    const rows = buildWhiteboardParticipation([own], sites, [own, support], reports);
    assert.deepEqual(rows.map(row => [row.siteId, row.teamId, row.totalManDay]), [
        ['wb-site', 'wb-own', 2], ['wb-site', 'wb-support', 3.5], ['wb-support-only', 'wb-support', 4],
    ]);
    assert.equal(rows.reduce((sum, row) => sum + row.totalManDay, 0), 9.5);
    assert.equal(rows[1].teamCompanyId, 'company-b');
    assert.ok(rows.every(row => !('workers' in row) && !('totalAmount' in row) && !('unitPrice' in row)));
    assert.ok(!JSON.stringify(rows).includes('개인 이름'));
    assert.ok(!JSON.stringify(rows).includes('987654'));
});

test('현장 소유권을 잃으면 과거 일보의 담당팀 라벨로 조회 범위를 되살릴 수 없다', () => {
    assert.deepEqual(buildWhiteboardParticipation([own], sites.map(site => ({ ...site, responsibleTeamId: 'wb-support' })), [own, support], reports), []);
});

test('공수가 없는 작업자 배열에서는 저장된 전체 합계를 중복 합산하지 않는다', () => {
    assert.deepEqual(buildWhiteboardParticipation([own], sites, [own, support], [{
        ...reports[0], workers: [{ teamId: 'wb-support', manDay: 'invalid' }, { teamId: 'wb-own', manDay: -1 }],
    }]), []);
});

test('실제 팀장 callable은 담당 현장 전체 팀 공수만 반환하고 작업자는 기존 개인 조회를 유지한다', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async () => {
    const app = admin.initializeApp({ projectId: 'demo-team-scoped-read' });
    const db = app.firestore();
    const fixture: Record<string, unknown> = {
        'users/wb-leader': { status: 'active', position: '팀장', linkedWorkerIds: ['wb-anchor'] },
        'workers/wb-anchor': { teamId: 'old-own', role: '팀장' },
        'users/wb-worker': { status: 'active', accountType: 'worker', position: '작업자', linkedWorkerIds: ['wb-self'] },
        'workers/wb-self': { teamId: 'wb-own', role: '작업자' },
        ...Object.fromEntries([own, support].map(row => [`teams/${row.id}`, row])),
        ...Object.fromEntries(sites.map(row => [`sites/${row.id}`, row])),
        ...Object.fromEntries(reports.map(row => [`daily_reports/${row.id}`, row])),
    };
    try {
        const batch = db.batch();
        Object.entries(fixture).forEach(([path, value]) => batch.set(db.doc(path), value as any));
        await batch.commit();
        const call = (uid: string, filters: any) => getTeamScopedData.run({ collection: 'whiteboard_participation', filters }, { auth: { uid, token: {} } } as any);
        const result = (await call('wb-leader', { yearMonth: '2026-10', teamId: 'wb-support', siteId: 'wb-other-site' })).rows[0];
        assert.equal(result.mode, 'responsible-sites');
        assert.equal(result.reports.reduce((sum: number, row: any) => sum + row.totalManDay, 0), 9.5);
        assert.ok(result.reports.every((row: any) => !('workers' in row) && row.siteId !== 'wb-other-site'));
        assert.deepEqual((await call('wb-leader', { yearMonth: '2026-11' })).rows[0].reports, []);
        await assert.rejects(call('wb-leader', {}), (error: any) => error.code === 'invalid-argument');
        assert.deepEqual((await call('wb-worker', { yearMonth: '2026-10' })).rows, [{ mode: 'own-workers' }]);
        await db.doc('users/wb-leader').update({ status: 'suspended' });
        await assert.rejects(call('wb-leader', { yearMonth: '2026-10' }), (error: any) => error.code === 'permission-denied');
    } finally {
        await Promise.all(Object.keys(fixture).map(path => db.doc(path).delete()));
        await app.delete();
    }
});
