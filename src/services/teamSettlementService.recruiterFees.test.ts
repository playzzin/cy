import { teamSettlementService } from './teamSettlementService';
import { dailyAdvanceStatementRecruiterFeeService } from './dailyAdvanceStatementRecruiterFeeService';
import { dailyReportService } from './dailyReportService';
import { listSystemConfigs } from './firestoreCrudCompat';
import { TeamSettlementDocumentSchema } from '../types/teamSettlement';

jest.mock('../config/firebase', () => ({ db: {}, auth: {}, functions: {}, storage: {} }));
jest.mock('../utils/swal', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock('./firestoreCrudCompat', () => ({ listSystemConfigs: jest.fn(), createSystemConfig: jest.fn(), updateSystemConfig: jest.fn() }));
jest.mock('./siteService', () => ({ siteService: { getSites: async () => [] } }));
jest.mock('./teamService', () => ({ teamService: { getTeams: async () => [{ id: 'team-a', legacyId: 'legacy-a', name: '검증팀' }] } }));
jest.mock('./companyService', () => ({ companyService: { getCompanies: async () => [] } }));
jest.mock('./manpowerService', () => ({ manpowerService: { getWorkers: async () => [] } }));
jest.mock('./dailyReportService', () => ({ dailyReportService: { getWorkerRows: jest.fn(), getReportWorkerRowsByRange: async () => [{ workerId: 'worker-a', workerName: '가상인력', teamId: 'team-a', manDay: 0, amount: 0 }], getReportsByRange: async () => [] } }));
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
  jest.mocked(dailyReportService.getWorkerRows).mockResolvedValue([{ reportId: 'report', workerId: 'worker-a', workerName: '가상인력', teamId: 'team-a', date: '2026-08-01', manDay: 1, unitPrice: 100000, amount: 90000, salaryModel: '일급제' } as any]);
  jest.mocked(listSystemConfigs).mockResolvedValue({ data: { systemConfigs: [] } } as any);
  jest.mocked(dailyAdvanceStatementRecruiterFeeService.getFeesByMonth).mockReset().mockResolvedValue([fee]);
});
afterEach(() => jest.restoreAllMocks());

test('청구서 금액만 공제하고 인원별 청구액·소개비를 원본에 저장한다', async () => {
  const result = await calculate();
  expect(dailyAdvanceStatementRecruiterFeeService.getFeesByMonth).toHaveBeenCalledWith(scope.yearMonth);
  expect(result.additions).toEqual([]);
  expect(result.deductions).toContainEqual(expect.objectContaining({ category: '대납청구비', amount: 220000,
    invoiceDetails: [{ workerId: 'worker-a', workerName: '가상인력', recruiterFeeDates: [], manDay: 1, claimAmount: 100000, recruiterFee: 120000, invoiceAmount: 220000 }] }));
  expect(result.sourceSnapshot?.totals).toMatchObject({ deductions: 220000, additions: 0, net: -220000 });
  expect(TeamSettlementDocumentSchema.safeParse(result).success).toBe(true);
});

test('반복 재집계는 소개비를 교체하고 수기 추가를 보존하며 0원 변경도 반영한다', async () => {
  let saved = await calculate();
  saved.deductions.push(...(['daily_wage_payroll', 'monthly_wage_payroll', 'service_team_payroll', 'daily_advance_recruiter_fee'] as const).map(origin => ({ id: origin, source: 'auto' as const, origin, category: '구 급여', amount: 900000 })));
  saved.additions.push({ id: 'manual', source: 'manual', origin: 'manual', category: '수기 지급', amount: 7000 });
  saved.additions.push({ id: 'legacy-fee', source: 'auto', origin: 'daily_advance_recruiter_fee', category: '인력소개비', amount: 120000 });
  jest.mocked(listSystemConfigs).mockImplementation(async ({ configId }) => ({ data: { systemConfigs: configId === 'team_settlement_2026-08__team-a'
    ? [{ id: configId, data: JSON.stringify(saved) }] : [] } }) as any);
  jest.spyOn(teamSettlementService, 'saveTeamSettlement').mockImplementation(async next => { saved = next; });
  for (const amount of [50000, 50000, 0]) {
    jest.mocked(dailyAdvanceStatementRecruiterFeeService.getFeesByMonth).mockResolvedValue([{ ...fee, amount }]);
    await teamSettlementService.recalculateAndSaveTeamSettlement(scope);
    expect(saved.deductions.filter(row => ['daily_wage_payroll', 'monthly_wage_payroll', 'service_team_payroll', 'daily_advance_recruiter_fee'].includes(row.origin))).toHaveLength(0);
    expect(saved.deductions.find(row => row.origin === 'daily_advance_invoice')).toMatchObject({ amount: 100000 + amount, invoiceDetails: [expect.objectContaining({ recruiterFee: amount })] });
    expect(saved.additions.reduce((sum, row) => sum + row.amount, 0)).toBe(7000);
    expect(saved.additions.some(row => row.origin === 'daily_advance_recruiter_fee')).toBe(false);
    expect(saved.sourceSnapshot?.totals).toMatchObject({ deductions: 100000 + amount, additions: 0, net: -100000 - amount });
  }
});

test('확정 시 최신 소개비를 가져오고 이후 조회는 확정된 원본을 유지한다', async () => {
  const draft = await calculate();
  jest.mocked(dailyAdvanceStatementRecruiterFeeService.getFeesByMonth).mockResolvedValue([{ ...fee, amount: 80000 }]);
  const save = jest.spyOn(teamSettlementService, 'saveTeamSettlement').mockResolvedValue(undefined);
  const confirmed = await teamSettlementService.saveAndConfirmTeamSettlement(draft);
  expect(confirmed.deductions.find(row => row.origin === 'daily_advance_invoice')).toMatchObject({ amount: 180000, invoiceDetails: [expect.objectContaining({ recruiterFee: 80000 })] });
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


test('월급제·용역팀·다른 팀의 인원과 청구서에 없는 소개비는 공제에서 제외한다', async () => {
  const daily = (await dailyReportService.getWorkerRows())[0];
  jest.mocked(dailyReportService.getWorkerRows).mockResolvedValue([
    daily, { ...daily, workerId: 'monthly', salaryModel: '월급제', unitPrice: 3000000 },
    { ...daily, workerId: 'service', salaryModel: '용역팀', unitPrice: 500000 },
    { ...daily, workerId: 'other', teamId: 'another', unitPrice: 400000 }
  ]);
  jest.mocked(dailyAdvanceStatementRecruiterFeeService.getFeesByMonth).mockResolvedValue([
    fee, { ...fee, workerId: 'monthly', amount: 999000 }, { ...fee, workerId: 'absent', amount: 999000 }
  ]);
  const result = await calculate();
  expect(result.deductions.find(row => row.origin === 'daily_advance_invoice')?.amount).toBe(220000);
  expect(result.deductions.some(row => ['daily_wage_payroll', 'monthly_wage_payroll', 'service_team_payroll', 'daily_advance_recruiter_fee'].includes(row.origin))).toBe(false);
});
