import { buildWorkedTeamIds } from './personnelHistoryWorkedTeams';

describe('buildWorkedTeamIds', () => {
    const teams = [
        { id: 'team-current', legacyId: 'team-legacy', name: '현재 팀' },
        { id: 'team-by-name', name: '이름 팀' },
        { id: 'team-worker-fallback', name: '작업자 현재 팀' },
        { id: 'team-zero', name: '공수 없는 팀' },
    ];

    const workers = [
        { id: 'worker-snapshot', teamId: 'team-worker-fallback', teamName: '작업자 현재 팀' },
        { id: 'worker-current', legacyId: 'worker-legacy', teamId: 'team-worker-fallback' },
        { id: 'worker-zero', teamId: 'team-zero' },
    ];

    it('양수 공수가 있는 팀만 현재 팀 ID로 정규화한다', () => {
        const result = buildWorkedTeamIds([
            { workerId: 'worker-snapshot', workerTeamId: 'team-legacy', manDay: 1 },
            { workerId: 'unknown-worker', workerTeamName: '이름  팀', manDay: 0.5 },
            { workerId: 'worker-legacy', manDay: 2 },
            { workerId: 'worker-zero', workerTeamId: 'team-zero', manDay: 0 },
        ], teams, workers);

        expect([...result].sort()).toEqual([
            'team-by-name',
            'team-current',
            'team-worker-fallback',
        ]);
    });

    it('과거 일보의 팀 스냅샷을 현재 작업자 소속보다 우선한다', () => {
        const result = buildWorkedTeamIds([
            {
                workerId: 'worker-snapshot',
                workerTeamId: 'team-legacy',
                workerTeamName: '현재 팀',
                manDay: 1,
            },
        ], teams, workers);

        expect([...result]).toEqual(['team-current']);
        expect(result.has('team-worker-fallback')).toBe(false);
    });
});
