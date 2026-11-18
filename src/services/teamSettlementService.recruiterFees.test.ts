import { teamSettlementService } from './teamSettlementService';
import { dailyAdvanceStatementRecruiterFeeService } from './dailyAdvanceStatementRecruiterFeeService';
import { listSystemConfigs } from './firestoreCrudCompat';
import { TeamSettlementDocumentSchema } from '../types/teamSettlement';

jest.mock('../config/firebase', () => ({ db: {}, auth: {}, functions: {}, storage: {} }));
jest.mock('../utils/swal', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock('./firestoreCrudCompat', () => ({ listSystemConfigs: jest.fn(), createSystemConfig: jest.fn(), updateSystemConfig: jest.fn() }));
jest.mock('./siteService', () => ({ siteService: { getSites: async () => [] } }));
jest.mock('./teamService', () => ({ teamService: { getTeams: async () => [{ id: 'team-a', legacyId: 'legacy-a', name: '검증팀' }] } }));
jest.mock('./companyService', () => ({ companyService: { getCompanies: async () => [] } }));
jest.mock('./dailyReportService', () => ({ dailyReportService: { getReportWorkerRowsByRange: async () => [{ workerId: 'worker-a', workerName: '가상인력', teamId: 'team-a', manDay: 0, amount: 0 }], getReportsByRange: async () => [] } }));
jest.mock('./supportRateService', () => ({ supportRateService: { getAllSiteRates: async () => [] } }));
jest.mock('./accommodationBillingService', () => ({ accommodationBillingService: { getBillingDocuments: async () => [] } }));
jest.mock('./vehicleBillingService', () => ({ vehicleBillingService: { getBillingsByMonth: async () => [] } }));
jest.mock('./cardBillingService', () => ({ cardBillingService: { getBillingsByMonth: async () => [] } }));
jest.mock('./teamExpenseLedgerService', () => ({ teamExpenseLedgerService: { getClaimsByMonth: async () => [] } }));
jest.mock('./dailyAdvanceStatementRecruiterFeeService', () => ({ dailyAdvanceStatementRecruiterFeeService: { getFeesByMonth: jest.fn() } }));
jest.mock('./systemMessageService', () => ({ systemMessageService: { notifyTeamSettlementEvent: async () => undefined } }));

const scope = { yearMonth: '2026-08', teamId: 'team-a' };
const fee = { month: scope.yearMonth, teamKey: scope.teamId, workerId: 'worker-a', amount: 120000 };
const calculate = () => teamSettlementService.calculateAutoSettlement({ ...scope, teamName: '검증팀', teamIdVariants: new Set(['team-a', 'legacy-a']) });

beforeEach(() => {
  jest.mocked(listSystemConfigs).mockResolvedValue({ data: { systemConfigs: [] } } as any);
  jest.mocked(dailyAdvanceStatementRecruiterFeeService.getFeesByMonth).mockReset().mockResolvedValue([fee]);
});
afterEach(() => jest.restoreAllMocks());

test('소개비를 급여 공제로 차감하고 작업자별 상세를 원본에 저장한다', async () => {
  const result = await calculate();
  expect(dailyAdvanceStatementRecruiterFeeService.getFeesByMonth).toHaveBeenCalledWith(scope.yearMonth);
  expect(result.additions).toEqual([]);
  expect(result.deductions).toContainEqual(expect.objectContaining({ category: '인력소개비', amount: 120000,
    recruiterFeeDetails: [{ workerId: 'worker-a', workerName: '가상인력', amount: 120000 }] }));
  expect(result.sourceSnapshot?.totals).toMatchObject({ deductions: 120000, additions: 0, net: -120000 });
  expect(TeamSettlementDocumentSchema.safeParse(result).success).toBe(true);
});

test('반복 재집계는 소개비를 교체하고 수기 추가를 보존하며 0원 변경도 반영한다', async () => {
  let saved = await calculate();
  saved.additions.push({ id: 'manual', source: 'manual', origin: 'manual', category: '수기 지급', amount: 7000 });
  saved.additions.push({ id: 'legacy-fee', source: 'auto', origin: 'daily_advance_recruiter_fee', category: '인력소개비', amount: 120000 });
  jest.mocked(listSystemConfigs).mockImplementation(async ({ configId }) => ({ data: { systemConfigs: configId === 'team_settlement_2026-08__team-a'
    ? [{ id: configId, data: JSON.stringify(saved) }] : [] } }) as any);
  jest.spyOn(teamSettlementService, 'saveTeamSettlement').mockImplementation(async next => { saved = next; });
  for (const amount of [50000, 50000, 0]) {
    jest.mocked(dailyAdvanceStatementRecruiterFeeService.getFeesByMonth).mockResolvedValue([{ ...fee, amount }]);
    await teamSettlementService.recalculateAndSaveTeamSettlement(scope);
    expect(saved.deductions.filter(row => row.origin === 'daily_advance_recruiter_fee')).toHaveLength(amount ? 1 : 0);
    expect(saved.additions.reduce((sum, row) => sum + row.amount, 0)).toBe(7000);
    expect(saved.additions.some(row => row.origin === 'daily_advance_recruiter_fee')).toBe(false);
    expect(saved.sourceSnapshot?.totals).toMatchObject({ deductions: amount, additions: 0, net: 0 - amount });
  }
});

test('확정 시 최신 소개비를 가져오고 이후 조회는 확정된 원본을 유지한다', async () => {
  const draft = await calculate();
  jest.mocked(dailyAdvanceStatementRecruiterFeeService.getFeesByMonth).mockResolvedValue([{ ...fee, amount: 80000 }]);
  const save = jest.spyOn(teamSettlementService, 'saveTeamSettlement').mockResolvedValue(undefined);
  const confirmed = await teamSettlementService.saveAndConfirmTeamSettlement(draft);
  expect(confirmed.deductions.find(row => row.origin === 'daily_advance_recruiter_fee')?.amount).toBe(80000);
  expect(confirmed.confirmedAt).not.toBeNull();
  expect(save).toHaveBeenCalledWith(confirmed);
  jest.mocked(listSystemConfigs).mockResolvedValue({ data: { systemConfigs: [{ id: 'team_settlement_2026-08__team-a', data: JSON.stringify(confirmed) }] } } as any);
  jest.mocked(dailyAdvanceStatementRecruiterFeeService.getFeesByMonth).mockClear();
  expect((await teamSettlementService.getTeamSettlement(scope)).deductions).toEqual(confirmed.deductions);
  expect(dailyAdvanceStatementRecruiterFeeService.getFeesByMonth).not.toHaveBeenCalled();
});

test('소개비 조회 실패를 0원으로 저장하거나 확정하지 않는다', async () => {
  const draft = await calculate();
  jest.mocked(dailyAdvanceStatementRecruiterFeeService.getFeesByMonth).mockRejectedValue(new Error('fee-unavailable'));
  const save = jest.spyOn(teamSettlementService, 'saveTeamSettlement').mockResolvedValue(undefined);
  await expect(teamSettlementService.recalculateAndSaveTeamSettlement(scope)).rejects.toThrow('fee-unavailable');
  await expect(teamSettlementService.saveAndConfirmTeamSettlement(draft)).rejects.toThrow('fee-unavailable');
  expect(save).not.toHaveBeenCalled();
});
