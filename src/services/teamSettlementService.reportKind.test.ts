import { teamSettlementService } from './teamSettlementService';
import { listSystemConfigs } from './firestoreCrudCompat';
import type { TeamSettlementDocument, TeamSettlementSalesItem } from '../types/teamSettlement';
import { getTeamSettlementConfirmationIssues } from '../utils/teamSettlementDraft';

jest.mock('../config/firebase', () => ({ db: {}, auth: {}, functions: {}, storage: {} }));
jest.mock('../utils/swal', () => ({ toast: { error: jest.fn(), success: jest.fn(), warning: jest.fn() } }));
jest.mock('./firestoreCrudCompat', () => ({ listSystemConfigs: jest.fn(), createSystemConfig: jest.fn(), updateSystemConfig: jest.fn() }));
jest.mock('./teamService', () => ({ teamService: { getTeams: jest.fn().mockResolvedValue([{ id: 'team', name: '검증팀' }]) } }));
jest.mock('./systemMessageService', () => ({ systemMessageService: { notifyTeamSettlementEvent: jest.fn() } }));

const sale = (kind: '직영' | '도급'): TeamSettlementSalesItem => ({
  id: `daily_report_sales:2026-11:${kind}__site__`, source: 'auto', origin: 'daily_report',
  siteId: 'site', siteName: '검증 현장', kind, manDay: 2, amount: 0
});
const document = (kind: '직영' | '도급'): TeamSettlementDocument => {
  const office = kind === '도급' ? 20000 : 10000;
  return {
    teamId: 'team', teamName: '검증팀', yearMonth: '2026-11', sales: [sale(kind)], purchases: [], additions: [],
    deductions: [{ id: 'office', source: 'auto', origin: 'office_expense', category: '사무실비', amount: office }],
    summary: { prevCarryover: 0, deposit: 0 }, updatedAt: '2026-11-01T00:00:00.000Z', confirmedAt: null,
    sourceSnapshot: { version: 2, manualContractDirectAmounts: true, capturedAt: '2026-11-01T00:00:00.000Z', dailyReports: [],
      totals: { sales: 0, purchases: 0, deductions: office, additions: 0, net: -office } }
  };
};
const store = (saved: TeamSettlementDocument) => jest.mocked(listSystemConfigs).mockResolvedValue({ data: { systemConfigs: [{
  id: 'team_settlement_2026-11__team', data: JSON.stringify(saved)
}] } } as any);
afterEach(() => jest.restoreAllMocks());

test('CEO 미확정 조회·새로고침은 저장된 도급 스냅샷 대신 최신 직영 일보를 반영하고 읽기 중 저장하지 않는다', async () => {
  const saved = document('도급');
  saved.sales[0] = { ...saved.sales[0], amount: 900000, amountOverridden: true, quantity: 12, memo: '입력 메모' };
  saved.summary = { prevCarryover: 1000, deposit: 2000 };
  saved.transactionMemo = '전달사항';
  saved.deductions.push({ id: 'manual', source: 'manual', origin: 'manual', category: '수기 공제', amount: 3000 });
  store(saved);
  const calculate = jest.spyOn(teamSettlementService, 'calculateAutoSettlement').mockResolvedValue(document('직영'));
  const save = jest.spyOn(teamSettlementService, 'saveTeamSettlement').mockResolvedValue(undefined);
  const result = await teamSettlementService.getTeamSettlement({ yearMonth: '2026-11', teamId: 'team', refreshDraft: true, persistSnapshot: true });
  expect(calculate).toHaveBeenCalledTimes(1);
  expect(result.sales).toEqual([expect.objectContaining({ kind: '직영', amount: 900000, quantity: 12, memo: '입력 메모', amountOverridden: true })]);
  expect(result.deductions).toEqual([expect.objectContaining({ amount: 10000 }), saved.deductions[1]]);
  expect(result.summary).toEqual(saved.summary);
  expect(result.transactionMemo).toBe(saved.transactionMemo);
  expect(getTeamSettlementConfirmationIssues(result)).toEqual([]);
  expect(save).not.toHaveBeenCalled();
  expect(saved.sales[0].kind).toBe('도급');
});

test.each([false, true])('조회 전용 또는 확정 정산은 저장된 원천을 유지한다 (확정=%s)', async confirmed => {
  const saved = document('도급');
  if (confirmed) saved.confirmedAt = '2026-11-02T00:00:00.000Z';
  store(saved);
  const calculate = jest.spyOn(teamSettlementService, 'calculateAutoSettlement');
  const save = jest.spyOn(teamSettlementService, 'saveTeamSettlement').mockResolvedValue(undefined);
  const result = await teamSettlementService.getTeamSettlement({ yearMonth: '2026-11', teamId: 'team', refreshDraft: confirmed });
  expect(result.sales[0].kind).toBe('도급');
  expect(calculate).not.toHaveBeenCalled();
  expect(save).not.toHaveBeenCalled();
});

test('최신 일보 조회가 실패하면 예전 도급 스냅샷을 정상 결과로 반환하지 않는다', async () => {
  store(document('도급'));
  jest.spyOn(teamSettlementService, 'calculateAutoSettlement').mockRejectedValue(new Error('source-unavailable'));
  const save = jest.spyOn(teamSettlementService, 'saveTeamSettlement').mockResolvedValue(undefined);
  await expect(teamSettlementService.getTeamSettlement({ yearMonth: '2026-11', teamId: 'team', refreshDraft: true })).rejects.toThrow('source-unavailable');
  expect(save).not.toHaveBeenCalled();
});

test.each([false, true])('명시적 재집계는 도급→직영 변경과 기존 입력 금액을 함께 저장한다 (확정=%s)', async confirmed => {
  const saved = document('도급');
  saved.sales[0] = { ...saved.sales[0], amount: 900000, amountOverridden: confirmed ? undefined : true };
  if (confirmed) saved.confirmedAt = '2026-11-02T00:00:00.000Z';
  store(saved);
  jest.spyOn(teamSettlementService, 'calculateAutoSettlement').mockResolvedValue(document('직영'));
  const save = jest.spyOn(teamSettlementService, 'saveTeamSettlement').mockResolvedValue(undefined);
  await teamSettlementService.recalculateAndSaveTeamSettlement({ yearMonth: '2026-11', teamId: 'team', keepConfirmed: confirmed });
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ confirmedAt: saved.confirmedAt,
    sales: [expect.objectContaining({ kind: '직영', amount: 900000, amountOverridden: true })]
  }));
});

test('확정 직전 일보 구분 변경도 입력 금액을 유지하며 최신 구분으로 확정한다', async () => {
  const saved = document('도급');
  saved.sales[0] = { ...saved.sales[0], amount: 900000, amountOverridden: true };
  jest.spyOn(teamSettlementService, 'calculateAutoSettlement').mockResolvedValue(document('직영'));
  const save = jest.spyOn(teamSettlementService, 'saveTeamSettlement').mockResolvedValue(undefined);
  const result = await teamSettlementService.saveAndConfirmTeamSettlement(saved);
  expect(result.sales[0]).toMatchObject({ kind: '직영', amount: 900000, amountOverridden: true });
  expect(result.confirmedAt).toBeTruthy();
  expect(save).toHaveBeenCalledWith(result);
});
