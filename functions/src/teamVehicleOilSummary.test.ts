import { strict as assert } from 'assert';
import { test } from 'node:test';
import { projectTeamVehicleOil } from './teamVehicleOilSummary';

test('현재 팀·팀원 배정과 legacy ID만 허용하고 타 팀 이동·미배정·폐기 차량은 제외한다', () => {
    const rows = projectTeamVehicleOil([
        { id: 'team', currentAssigneeType: 'TEAM', currentAssigneeId: 'legacy-a', licensePlate: '가상1', secret: 'private' },
        { id: 'worker', currentAssigneeType: 'WORKER', currentAssigneeId: 'legacy-worker' },
        { id: 'billing', billingTargetType: 'TEAM', billingTargetId: 'a' },
        { id: 'moved', currentAssigneeType: 'TEAM', currentAssigneeId: 'b', billingTargetType: 'TEAM', billingTargetId: 'a' },
        { id: 'office', currentAssigneeType: 'OFFICE', currentAssigneeId: 'a' },
        { id: 'unassigned', currentAssigneeName: '가상 A팀' },
        { id: 'disposed', currentAssigneeType: 'TEAM', currentAssigneeId: 'a', status: 'DISPOSED' },
    ], [{ id: 'worker-a', legacyId: 'legacy-worker', teamId: 'a' }], [{ id: 'a', legacyId: 'legacy-a', name: '가상 A팀' }], {
        team: { id: 'forged', currentKm: 100, lastOilKm: 10, cycleKm: 5000, secret: 'private' },
        worker: { currentKm: -2, lastOilKm: 'bad', cycleKm: 0 },
        other: { currentKm: 999 },
    });
    assert.deepEqual(rows.map(row => row.id), ['team', 'worker', 'billing']);
    assert.deepEqual(rows[0], { id: 'team', plate: '가상1', team: '가상 A팀', teamColor: '#94a3b8', currentKm: 100, lastOilKm: 10, cycleKm: 5000 });
    assert.equal(rows[1].currentKm, 0);
    assert.equal(rows[1].cycleKm, 10000);
    assert.deepEqual(projectTeamVehicleOil([{ id: 'none' }], [], [], {}), []);
});
