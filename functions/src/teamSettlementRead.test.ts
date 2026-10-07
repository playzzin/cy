import { strict as assert } from 'assert';
import { test } from 'node:test';
import { filterTeamRows, TeamReadScope } from './teamReadPolicy';
import { summarizeIncomingTeams, withIncomingSupportRates } from './teamSettlementRead';
import * as admin from 'firebase-admin';
import { getTeamScopedData } from './teamScopedRead';

const scope: TeamReadScope = { teamIds: ['a', 'old-a'], workerIds: ['own'], siteIds: ['site-a'] };
const report = { id: 'r', date: '2026-09-01', siteId: 'site-a', siteName: '담당 현장', responsibleTeamId: 'a' };
const incoming = { workerId: 'b-worker', name: '개인 이름', teamId: 'b', workerTeamName: '지원 B팀', manDay: 1, unitPrice: 999999, accountNumber: 'private' };

test('담당 현장에 다른 팀만 온 일보도 팀 공수로 반환하고 개인 급여/신원은 반환하지 않는다', () => {
    const rows = summarizeIncomingTeams([{ ...report, workers: [incoming, { ...incoming, workerId: 'c-worker', manDay: 0.5 }] }], scope);
    assert.deepEqual(rows, [{ id: JSON.stringify(['2026-09-01', 'site-a', 'b']), date: '2026-09-01', siteId: 'site-a', siteName: '담당 현장', teamId: 'b', teamName: '지원 B팀', manDay: 1.5 }]);
    for (const secret of ['b-worker', '개인 이름', '999999', 'private']) assert.equal(JSON.stringify(rows).includes(secret), false);
});
test('본인 팀은 중복하지 않고 다른 현장이나 현재 담당팀이 바뀐 과거 일보는 포함하지 않는다', () => {
    const rows = summarizeIncomingTeams([
        { ...report, workers: [incoming, { ...incoming, workerId: 'own' }, { ...incoming, teamId: 'old-a' }] },
        { ...report, id: 'other', responsibleTeamId: 'b', teamId: 'a', workers: [incoming] },
        { ...report, id: 'other-site', responsibleTeamId: '', teamId: '', siteId: 'site-b', workers: [incoming] },
    ], scope);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].manDay, 1);
    assert.deepEqual(summarizeIncomingTeams([{ ...report, workers: [incoming] }], { ...scope, teamIds: [] }), []);
});
test('구 일보의 담당팀/현장 대체값과 JSON 작업자 목록을 지원한다', () => {
    assert.equal(summarizeIncomingTeams([{ ...report, responsibleTeamId: '', teamId: 'old-a', workers: JSON.stringify([incoming]) }], scope)[0].manDay, 1);
    assert.equal(summarizeIncomingTeams([{ ...report, responsibleTeamId: '', teamId: '', workers: [incoming] }], scope)[0].manDay, 1);
    assert.deepEqual(summarizeIncomingTeams([{ ...report, workers: [{ ...incoming, manDay: 0 }, { ...incoming, manDay: -1 }, { ...incoming, manDay: 'bad' }] }], scope), []);
});
test('날짜·현장·지원팀별로 합산하고 변경된 ID와 표시명을 연결한다', () => {
    const rows = summarizeIncomingTeams([
        { ...report, workers: [{ ...incoming, teamId: 'old-b', workerTeamName: '' }] },
        { ...report, id: 'r2', workers: [incoming] },
        { ...report, id: 'r3', date: '2026-09-02', workers: [incoming] },
    ], scope, [{ id: 'b', legacyId: 'old-b', name: '지원 B팀', accountNumber: 'private' }], [{ id: 'site-new', legacyId: 'site-a' }]);
    assert.deepEqual(rows.map(row => [row.date, row.siteId, row.teamId, row.manDay]), [
        ['2026-09-01', 'site-new', 'b', 2], ['2026-09-02', 'site-new', 'b', 1],
    ]);
    assert.equal(rows[0].teamLegacyId, 'old-b');
    assert.equal(rows[0].siteLegacyId, 'site-a');
});
test('일반 일보 조회의 본인 작업자 제한은 유지된다', () => {
    assert.deepEqual(filterTeamRows('daily_reports', [{ ...report, workers: [incoming] }], scope), []);
});

test('개인 급여가 아닌 현장 지원단가, 팀 지원단가, 기본 지원단가 순서로 계산한다', () => {
    const rows = summarizeIncomingTeams([{ ...report, workers: [{ ...incoming, manDay: 2, unitPrice: 999999 }] }], scope);
    const teams = [{ id: 'b', supportRate: 250000, unitPrice: 888888 }];
    assert.equal(withIncomingSupportRates(rows, teams, [])[0].supportRate, 250000);
    assert.equal(withIncomingSupportRates(rows, teams, [{ siteId: 'site-a', defaultRate: 270000 }])[0].supportAmount, 540000);
    assert.equal(withIncomingSupportRates(rows, [], [])[0].supportRate, 230000);
});

test('팀장 callable은 담당 현장의 선택 월 지원 공수만 반환하고 다른 팀 지정은 거부한다', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async () => {
    const app = admin.initializeApp({ projectId: 'demo-team-settlement-incoming' });
    const db = app.firestore();
    const fixtures: Record<string, unknown> = {
        'users/leader': { status: 'active', position: '팀장', linkedWorkerIds: ['own'] },
        'teams/a': { legacyId: 'old-a', name: 'A팀' },
        'teams/b': { legacyId: 'old-b', name: 'B지원팀', supportRate: 250000, bankAccount: 'never-return' },
        'workers/own': { teamId: 'a', role: '팀장' },
        'workers/other': { teamId: 'b', name: 'private-worker', unitPrice: 999999 },
        'sites/site-a': { responsibleTeamId: 'a', name: 'A현장' },
        'sites/site-b': { responsibleTeamId: 'b', name: 'B현장' },
        'daily_reports/incoming-only': { ...report, workers: [{ ...incoming, teamId: 'old-b', workerTeamName: '' }] },
        'daily_reports/mixed': { ...report, date: '2026-09-02', workers: [incoming, { ...incoming, workerId: 'own', teamId: 'a' }] },
        'daily_reports/other-site': { ...report, siteId: 'site-b', responsibleTeamId: 'b', workers: [incoming] },
        'daily_reports/other-month': { ...report, date: '2026-10-01', workers: [incoming] },
    };
    try {
        const batch = db.batch();
        Object.entries(fixtures).forEach(([path, data]) => batch.set(db.doc(path), data as any));
        await batch.commit();
        const context = { auth: { uid: 'leader', token: {} } } as any;
        const request = { collection: 'team_settlement_incoming', filters: { yearMonth: '2026-09', teamId: 'old-a' } };
        const result = await getTeamScopedData.run(request, context);
        assert.equal(result.rows.length, 2);
        assert.deepEqual(result.rows.map((row: any) => [row.date, row.teamId, row.manDay]), [['2026-09-01', 'b', 1], ['2026-09-02', 'b', 1]]);
        assert.equal(result.rows[0].teamName, 'B지원팀');
        assert.deepEqual(Object.keys(result.rows[0]).sort(), ['date', 'id', 'manDay', 'rateSource', 'siteId', 'siteName', 'supportAmount', 'supportRate', 'teamId', 'teamLegacyId', 'teamName']);
        assert.equal(result.rows[0].supportRate, 250000);
        for (const secret of ['never-return', 'private-worker', '999999']) assert.equal(JSON.stringify(result).includes(secret), false);
        const batched = await getTeamScopedData.run({ requests: [request, { collection: 'daily_reports', filters: { startDate: '2026-09-01', endDate: '2026-09-30' } }] }, context);
        assert.deepEqual(batched.results[0].rows, result.rows);
        assert.equal(batched.results[1].rows.length, 1);
        assert.deepEqual(batched.results[1].rows[0].workers.map((row: any) => row.workerId), ['own']);
        await assert.rejects(getTeamScopedData.run({ ...request, filters: { ...request.filters, teamId: 'b' } }, context), (error: any) => error.code === 'permission-denied');
        for (const month of ['', '2026-13', '2026-09-01']) {
            await assert.rejects(getTeamScopedData.run({ ...request, filters: { ...request.filters, yearMonth: month } }, context), (error: any) => error.code === 'invalid-argument');
        }
        await db.doc('users/leader').update({ status: 'suspended' });
        await assert.rejects(getTeamScopedData.run(request, context), (error: any) => error.code === 'permission-denied');
    } finally {
        await Promise.all(Object.keys(fixtures).map(path => db.doc(path).delete()));
        await app.delete();
    }
});
