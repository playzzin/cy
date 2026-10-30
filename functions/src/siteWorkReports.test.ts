import { strict as assert } from 'assert';
import { test } from 'node:test';
import * as admin from 'firebase-admin';
import { projectSiteWorkReports, responsibleSites, validateSiteWorkRange } from './siteWorkReports';
import { filterTeamRows } from './teamReadPolicy';
import { getTeamScopedData } from './teamScopedRead';

const scope = { teamIds: ['a', 'legacy-a'], workerIds: ['own'], siteIds: ['site', 'assignment'] };
const sites = [{ id: 'site', legacyId: 'legacy-site', name: '담당 현장', responsibleTeamId: 'legacy-a', responsibleTeamName: '담당팀' },
    { id: 'assignment', assignedTeamId: 'a', responsibleTeamId: 'b' }];
const reports = [{ id: 'r', date: '2026-10-17', siteId: 'legacy-site', teamId: 'b', secret: 'private', workers: [
    { workerId: 'own', name: '동명', manDay: 1, unitPrice: 100, teamId: 'a' },
    { workerId: 'guest', name: '동명', manDay: 0.5, unitPrice: 900, teamId: 'legacy-b', workContent: 'private', bankAccount: 'private' },
] }];

test('담당 현장의 지원 공수만 확장하고 이름이 같은 작업자를 분리하며 개인정보·급여는 제거한다', () => {
    const result = projectSiteWorkReports(reports, sites, scope, [], [{ id: 'b', legacyId: 'legacy-b', name: '지원팀' }]);
    assert.equal(result[0].siteId, 'site');
    assert.equal(result[0].teamId, 'legacy-a');
    assert.equal(result[0].totalManDay, 1.5);
    assert.equal(result[0].totalAmount, 100);
    assert.equal(result[0].secret, undefined);
    assert.deepEqual(result[0].workers[1], { workerId: 'guest', name: '동명', teamId: 'b', workerTeamName: '지원팀',
        manDay: 0.5, status: 'attendance', isSiteSupport: true });
    // A site view must never change own-team personnel/payroll authorization.
    assert.equal(filterTeamRows('daily_reports', reports, scope)[0].workers.length, 1);
});

test('담당 아닌 현장·동일 이름·보고서의 담당 표기·배정 관계로 타 팀을 조회할 수 없다', () => {
    assert.deepEqual(responsibleSites(sites, scope).map(row => row.id), ['site']);
    for (const siteId of ['other', 'assignment', '']) {
        const result = projectSiteWorkReports([{ ...reports[0], siteId, siteName: '담당 현장', responsibleTeamId: 'a' }], sites, scope);
        assert.deepEqual(result[0].workers.map((row: any) => row.workerId), ['own']);
    }
    assert.deepEqual(projectSiteWorkReports([{ ...reports[0], siteId: 'other', workers: [reports[0].workers[1]] }], sites, scope), []);
    assert.equal(projectSiteWorkReports(reports, [{ ...sites[0], responsibleTeamId: 'b' }], scope)[0].workers.length, 1);
});

test('지원 작업자의 소속 누락은 서버 조회 정보로 보완하고 0·분수 공수를 유지한다', () => {
    const result = projectSiteWorkReports([{ ...reports[0], workers: [{ workerId: 'guest', name: '지원인원', manDay: 0.25 }] }], sites, scope,
        [{ id: 'guest', teamId: 'b', contact: 'private' }], [{ id: 'b', name: '지원팀' }]);
    assert.equal(result[0].workers[0].workerTeamName, '지원팀');
    assert.equal(result[0].totalManDay, 0.25);
    assert.equal(result[0].workers[0].contact, undefined);
    assert.equal(projectSiteWorkReports([{ ...reports[0], workers: [] }], sites, scope)[0].totalManDay, 0);
});

test('월 범위 밖의 무제한·잘못된 현장 공수 조회를 거절한다', () => {
    validateSiteWorkRange({ startDate: '2026-10-01', endDate: '2026-10-31' });
    for (const range of [{}, { startDate: '2026-02-30', endDate: '2026-03-01' },
        { startDate: '2026-10-31', endDate: '2026-10-01' }, { startDate: '2026-01-01', endDate: '2026-10-31' }]) {
        assert.throws(() => validateSiteWorkRange(range), (error: any) => error.code === 'invalid-argument');
    }
});

test('지원팀 색상은 일보의 임의 값이 아니라 현재 팀 DB에서 가져오며 비공개 정보는 제외한다', () => {
    const source = [{ ...reports[0], workers: [{ ...reports[0].workers[1], workerTeamColorHex: '#111111' }] }];
    const team = { id: 'b', legacyId: 'legacy-b', name: '지원팀', color: '#d96cbd', bankAccount: 'private' };
    const projected = projectSiteWorkReports(source, sites, scope, [], [team])[0].workers[0];
    assert.equal(projected.workerTeamColorHex, '#d96cbd');
    assert.equal(projected.teamId, 'b');
    assert.equal(projected.isSiteSupport, true);
    assert.equal(projected.unitPrice, undefined);
    assert.equal(projected.bankAccount, undefined);
    assert.equal(projectSiteWorkReports(source, sites, scope, [], [{ ...team, color: '#3a729f' }])[0].workers[0].workerTeamColorHex, '#3a729f');
    assert.equal(projectSiteWorkReports(source, sites, scope, [], [{ ...team, color: 'invalid' }])[0].workers[0].workerTeamColorHex, undefined);
});

test('실제 callable은 담당 현장 지원 공수를 반환하고 일반 작업자와 담당 해제를 차단한다',
    { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async () => {
    const app = admin.initializeApp({ projectId: 'demo-site-support-tests' });
    const db = app.firestore();
    const fixtures: Record<string, unknown> = {
        'users/leader': { status: 'active', position: '팀장', linkedWorkerIds: ['own'] },
        'users/member': { status: 'active', accountType: 'worker', linkedWorkerIds: ['own'] },
        'teams/a': { name: '담당팀', legacyId: 'legacy-a' }, 'teams/b': { name: '지원팀', legacyId: 'legacy-b', color: '#d96cbd' },
        'workers/own': { teamId: 'a', name: '소속인원' }, 'workers/guest': { teamId: 'b', name: '지원인원', contact: 'private' },
        'sites/site': sites[0], 'sites/assignment': sites[1],
        'daily_reports/r': reports[0],
        'daily_reports/missing-team': { ...reports[0], workers: [{ workerId: 'guest', name: '지원인원', manDay: 0.25, unitPrice: 999 }] },
        'daily_reports/unrelated': { ...reports[0], siteId: 'other', workers: [reports[0].workers[1]] },
        'daily_reports/outside': { ...reports[0], date: '2026-09-17' },
    };
    const filters = { startDate: '2026-10-01', endDate: '2026-10-31' };
    const call = (collection = 'site_work_reports', uid = 'leader') => getTeamScopedData.run({ collection, filters }, { auth: { uid } } as any) as Promise<any>;
    try {
        await Promise.all(Object.entries(fixtures).map(([path, value]) => db.doc(path).set(value as any)));
        const result = await call();
        assert.equal(result.rows.reduce((sum: number, row: any) => sum + row.totalManDay, 0), 1.75);
        assert.equal(result.rows.length, 2);
        const support = result.rows.flatMap((row: any) => row.workers).filter((row: any) => row.isSiteSupport);
        assert.equal(support.length, 2);
        assert.ok(support.every((row: any) => row.workerTeamName === '지원팀' && !('unitPrice' in row) && !('contact' in row)));
        assert.ok(support.every((row: any) => row.workerTeamColorHex === '#d96cbd'));
        assert.ok((await call('daily_reports')).rows.every((row: any) => row.workers.every((worker: any) => worker.workerId === 'own')));
        await assert.rejects(call('site_work_reports', 'member'), (error: any) => error.code === 'permission-denied');
        await db.doc('sites/site').update({ responsibleTeamId: 'b' });
        assert.ok((await call()).rows.every((row: any) => row.workers.every((worker: any) => worker.workerId === 'own')));
        await db.doc('users/leader').update({ status: 'suspended' });
        await assert.rejects(call(), (error: any) => error.code === 'permission-denied');
    } finally {
        await Promise.all(Object.keys(fixtures).map(path => db.doc(path).delete()));
        await app.delete();
    }
});
