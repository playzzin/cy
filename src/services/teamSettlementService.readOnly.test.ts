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

test.each([false, true])('기존 정산을 읽을 때 미확정 자동금액만 비우고 저장 요청을 보내지 않는다 (확정=%s)', async confirmed => {
  const saved: TeamSettlementDocument = {
    ...autoDocument, confirmedAt: confirmed ? '2026-10-02T00:00:00.000Z' : null,
    sales: [
      { id: 'auto', source: 'auto', origin: 'daily_report', kind: '직영', siteName: '자동 현장', manDay: 2, amount: 400000 },
      { id: 'entered', source: 'auto', origin: 'support_client_site', kind: '직영', siteName: '입력 현장', manDay: 3, amount: 900000, amountOverridden: true }
    ],
    sourceSnapshot: { version: 2, capturedAt: '2026-10-01T00:00:00.000Z', dailyReports: [],
      totals: { sales: 1300000, purchases: 0, deductions: 0, additions: 0, net: 1300000 } }
  };
  jest.mocked(listSystemConfigs).mockResolvedValue({ data: { systemConfigs: [{
    id: 'team_settlement_2026-10__team', data: JSON.stringify(saved)
  }] } } as any);
  const calculate = jest.spyOn(teamSettlementService, 'calculateAutoSettlement');
  const save = jest.spyOn(teamSettlementService, 'saveTeamSettlement').mockResolvedValue(undefined);
  const result = await teamSettlementService.getTeamSettlement({ yearMonth: '2026-10', teamId: 'team', persistSnapshot: true });
  expect(result.sales.map(row => row.amount)).toEqual([confirmed ? 400000 : 0, 900000]);
  expect(saved.sales[0].amount).toBe(400000);
  expect(calculate).not.toHaveBeenCalled();
  expect(save).not.toHaveBeenCalled();
});

test.each([false, true])('재집계는 직접 입력한 금액과 확정했던 금액을 보존한다 (확정=%s)', async confirmed => {
  const generated: TeamSettlementDocument = { ...autoDocument,
    sales: [{ id: 'direct', source: 'auto', origin: 'daily_report', kind: '직영', siteName: '검증 현장', manDay: 5, amount: 0 }],
    sourceSnapshot: { version: 2, manualContractDirectAmounts: true, capturedAt: '2026-10-01T00:00:00.000Z', dailyReports: [],
      totals: { sales: 0, purchases: 0, deductions: 0, additions: 0, net: 0 } }
  };
  const saved: TeamSettlementDocument = { ...generated,
    confirmedAt: confirmed ? '2026-10-02T00:00:00.000Z' : null,
    sales: [{ ...generated.sales[0], manDay: 3, amount: 900000, amountOverridden: confirmed ? undefined : true }]
  };
  jest.mocked(listSystemConfigs).mockResolvedValue({ data: { systemConfigs: [{
    id: 'team_settlement_2026-10__team', data: JSON.stringify(saved)
  }] } } as any);
  jest.spyOn(teamSettlementService, 'calculateAutoSettlement').mockResolvedValue(generated);
  const save = jest.spyOn(teamSettlementService, 'saveTeamSettlement').mockResolvedValue(undefined);
  await teamSettlementService.recalculateAndSaveTeamSettlement({ yearMonth: '2026-10', teamId: 'team', keepConfirmed: confirmed });
  expect(save).toHaveBeenCalledWith(expect.objectContaining({
    sales: [expect.objectContaining({ manDay: 5, amount: 900000, amountOverridden: true })],
    confirmedAt: saved.confirmedAt
  }));
});
