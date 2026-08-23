jest.mock('./firestoreCrudCompat', () => ({
  listSystemConfigs: jest.fn()
}));

import {
  extractConfirmedTeamSettlementKeys,
  isConfirmedTeamSettlementTarget,
  teamSettlementProtectionService
} from './teamSettlementProtectionService';
import { listSystemConfigs } from './firestoreCrudCompat';

const mockedListSystemConfigs = listSystemConfigs as jest.MockedFunction<typeof listSystemConfigs>;

const response = (rows: Array<{ id: string; data: unknown }>) => ({
  data: { systemConfigs: rows }
});

describe('teamSettlementProtectionService', () => {
  it('collects only confirmed settlements from the requested month', () => {
    const keys = extractConfirmedTeamSettlementKeys(response([
      {
        id: 'team_settlement_2026-07_team-a',
        data: JSON.stringify({ yearMonth: '2026-07', teamId: 'TEAM-A', teamName: ' A 팀 ', confirmedAt: '2026-08-01' })
      },
      {
        id: 'team_settlement_2026-07_team-b',
        data: JSON.stringify({ yearMonth: '2026-07', teamId: 'team-b', teamName: 'B팀', confirmedAt: null })
      },
      {
        id: 'team_settlement_2026-06_team-c',
        data: JSON.stringify({ yearMonth: '2026-06', teamId: 'team-c', teamName: 'C팀', confirmedAt: '2026-07-01' })
      }
    ]), '2026-07');

    expect(Array.from(keys.teamIds)).toEqual(['team-a']);
    expect(Array.from(keys.teamNames)).toEqual(['a팀']);
  });

  it('matches a confirmed target by canonical id or normalized team name', () => {
    const keys = {
      teamIds: new Set(['uuid-team-a']),
      teamNames: new Set(['청연a팀'])
    };

    expect(isConfirmedTeamSettlementTarget(keys, { teamId: 'UUID-TEAM-A' })).toBe(true);
    expect(isConfirmedTeamSettlementTarget(keys, { teamName: '청연 A팀 (본사)' })).toBe(true);
    expect(isConfirmedTeamSettlementTarget(keys, { teamId: 'team-b', teamName: 'B팀' })).toBe(false);
  });

  it('ignores malformed and unrelated system config rows', () => {
    const keys = extractConfirmedTeamSettlementKeys(response([
      { id: 'team_settlement_bad', data: '{bad json' },
      { id: 'other_config', data: { yearMonth: '2026-07', teamId: 'team-x', confirmedAt: 'yes' } }
    ]), '2026-07');

    expect(keys.teamIds.size).toBe(0);
    expect(keys.teamNames.size).toBe(0);
  });

  it('requests beyond the compatibility API default page when checking protection', async () => {
    mockedListSystemConfigs.mockResolvedValueOnce(response([]) as never);

    await teamSettlementProtectionService.getConfirmedTeamSettlementKeys('2026-07');

    expect(mockedListSystemConfigs).toHaveBeenCalledWith({ limit: 100_000, offset: 0 });
  });
});
