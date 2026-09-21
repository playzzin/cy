import { strict as assert } from 'assert';
import { test } from 'node:test';
import { belongsToTeam, filterTeamRows, isTeamLeader, TeamReadScope } from './teamReadPolicy';

const scope: TeamReadScope = { teamIds: ['team-a'], workerIds: ['worker-a'], siteIds: ['site-a'] };
test('팀장 별칭을 인식하되 일반 사용자와 관리자 역할로 확대하지 않는다', () => {
    for (const role of ['팀장', '반장', 'teamLead', 'TEAM_LEADER', 'foreman']) assert.ok(isTeamLeader(role));
    for (const role of ['user', 'admin', '일반', '팀장후보']) assert.equal(isTeamLeader(role), false);
});
test('다른 팀과 이름이 같아도 ID가 다르면 읽지 않는다', () => {
    assert.equal(belongsToTeam({ id: 'x', teamId: 'team-b', teamName: 'team-a' }, scope), false);
    assert.equal(belongsToTeam({ id: 'x', team: { id: 'team-a' } }, scope), true);
    assert.equal(belongsToTeam({ id: 'x', assigneeType: 'TEAM', assigneeId: 'team-a' }, scope), true);
    assert.equal(belongsToTeam({ id: 'x', assigneeType: 'OFFICE', assigneeId: 'team-a' }, scope), false);
});
test('혼합 일보의 다른 팀 작업자와 금액을 제거한다', () => {
    const rows = filterTeamRows('daily_reports', [{ id: 'report', workers: [
        { workerId: 'worker-a', manDay: 1, unitPrice: 100 },
        { workerId: 'worker-b', manDay: 2, unitPrice: 999 },
    ], totalManDay: 3, totalAmount: 2098 }], scope);
    assert.equal(rows[0].workers.length, 1);
    assert.equal(rows[0].totalManDay, 1);
    assert.equal(rows[0].totalAmount, 100);
    assert.deepEqual(filterTeamRows('daily_reports', [{ id: 'other', workers: [{ workerId: 'worker-b' }] }], scope), []);
});
test('공용 일정 보드도 본인 팀 작업자만 반환한다', () => {
    const rows = filterTeamRows('schedule_confirmation_boards', [{ id: 'board', assignments: JSON.stringify([
        { siteId: 'site-a', teamId: 'team-a', workerIds: ['worker-a', 'worker-b'], vehicleIds: ['other-vehicle'] },
        { siteId: 'site-b', teamId: 'team-b', workerIds: ['worker-b'] },
    ]) }], scope);
    assert.equal(rows[0].assignments.length, 1);
    assert.deepEqual(rows[0].assignments[0].workerIds, ['worker-a']);
    assert.deepEqual(rows[0].assignments[0].vehicleIds, []);
});
test('경비 및 현장별 자재는 본인 팀 또는 담당 현장만 조회한다', () => {
    const records = [{ id: 'a', teamId: 'team-a' }, { id: 'b', teamId: 'team-b' }];
    for (const name of ['team_expense_claims', 'vehicle_billing_documents', 'cardBillings']) {
        assert.deepEqual(filterTeamRows(name, records, scope).map(row => row.id), ['a']);
    }
    assert.deepEqual(filterTeamRows('materialInbounds', [{ id: 'a', siteId: 'site-a' }, { id: 'b', siteId: 'site-b' }], scope).map(row => row.id), ['a']);
    assert.deepEqual(filterTeamRows('workers', [{ id: 'worker-a' }], { ...scope, teamIds: [] }), []);
});
