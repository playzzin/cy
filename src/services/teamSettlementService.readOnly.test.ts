import { teamSettlementService } from './teamSettlementService';
import { listSystemConfigs } from './firestoreCrudCompat';
import type { TeamSettlementDocument } from '../types/teamSettlement';

jest.mock('../config/firebase', () => ({ db: {}, auth: {}, functions: {}, storage: {} }));
jest.mock('../utils/swal', () => ({ toast: { error: jest.fn(), success: jest.fn(), warning: jest.fn() } }));
jest.mock('./firestoreCrudCompat', () => ({ listSystemConfigs: jest.fn(), createSystemConfig: jest.fn(), updateSystemConfig: jest.fn() }));
jest.mock('./teamService', () => ({ teamService: { getTeams: jest.fn().mockResolvedValue([{ id: 'team', name: '검증팀' }]) } }));

const autoDocument: TeamSettlementDocument = { teamId: 'team', teamName: '검증팀', yearMonth: '2026-10',
  sales: [], purchases: [], deductions: [], additions: [], summary: { prevCarryover: 0, deposit: 0 },
  updatedAt: '2026-10-01T00:00:00.000Z', confirmedAt: null };

beforeEach(() => {
  jest.mocked(listSystemConfigs).mockResolvedValue({ data: { systemConfigs: [] } } as any);
  localStorage.clear();
});
afterEach(() => jest.restoreAllMocks());

test.each([false, true])('신규·구형 정산 조회는 기본적으로 저장하지 않는다 (구형=%s)', async legacy => {
    if (legacy) jest.mocked(listSystemConfigs).mockResolvedValue({ data: { systemConfigs: [{
      id: 'team_settlement_2026-10__team', data: JSON.stringify(autoDocument)
    }] } } as any);
    jest.spyOn(teamSettlementService, 'calculateAutoSettlement').mockResolvedValue(autoDocument);
    const save = jest.spyOn(teamSettlementService, 'saveTeamSettlement').mockResolvedValue(undefined);
    const result = await teamSettlementService.getTeamSettlement({ yearMonth: '2026-10', teamId: 'team' });
    expect(result.teamId).toBe('team');
    expect(save).not.toHaveBeenCalled();
    await teamSettlementService.getTeamSettlement({ yearMonth: '2026-10', teamId: 'team', persistSnapshot: true });
    expect(save).toHaveBeenCalledTimes(1);
});

test('브라우저의 구 지원단가를 조회해도 서버로 자동 이관하지 않는다', async () => {
  localStorage.setItem('support-team-payment-rate-overrides-v1:2026-10', JSON.stringify({ bulkSupportRate: 270000 }));
  const save = jest.spyOn(teamSettlementService, 'saveSupportRateOverrides');
  const result = await teamSettlementService.getSupportRateOverrides('2026-10');
  expect(result.bulkSupportRate).toBe(270000);
  expect(save).not.toHaveBeenCalled();
});
