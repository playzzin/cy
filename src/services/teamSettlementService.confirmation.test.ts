import type { TeamSettlementDocument } from '../types/teamSettlement';
import { accommodationBillingService } from './accommodationBillingService';
import { cardBillingService } from './cardBillingService';
import { companyService } from './companyService';
import { dailyReportService } from './dailyReportService';
import { siteService } from './siteService';
import { supportClientSiteAllocationService } from './supportClientSiteAllocationService';
import { supportRateService } from './supportRateService';
import { teamExpenseLedgerService } from './teamExpenseLedgerService';
import { teamService } from './teamService';
import { teamSettlementService } from './teamSettlementService';
import { vehicleBillingService } from './vehicleBillingService';
import { accommodationAssignmentService } from './accommodationAssignmentService';
import { accommodationService } from './accommodationService';
import { manpowerService } from './manpowerService';

jest.mock('../config/firebase', () => ({
  db: {},
  auth: {},
  functions: {},
  storage: {}
}));

jest.mock('../utils/swal', () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
    warning: jest.fn()
  }
}));

jest.mock('./systemMessageService', () => ({
  systemMessageService: {
    notifyTeamSettlementEvent: jest.fn().mockResolvedValue(undefined)
  }
}));

const buildDocument = (autoDeductionAmount: number): TeamSettlementDocument => ({
  yearMonth: '2026-08',
  teamId: 'team-1',
  teamName: '테스트팀',
  sales: [],
  purchases: [],
  deductions: autoDeductionAmount > 0
    ? [{
      id: 'vehicle_billing:2026-08:vehicle-1',
      source: 'auto',
      origin: 'vehicle_billing',
      category: '차량비',
      amount: autoDeductionAmount
    }]
    : [],
  additions: [],
  summary: { prevCarryover: 0, deposit: 0 },
  sourceSnapshot: {
    version: 1,
    capturedAt: '2026-08-19T00:00:00.000Z',
    dailyReports: [],
    totals: {
      sales: 0,
      purchases: 0,
      deductions: autoDeductionAmount,
      additions: 0,
      net: -autoDeductionAmount
    }
  },
  confirmedAt: null,
  updatedAt: '2026-08-19T00:00:00.000Z'
});

describe('teamSettlementService confirmation freshness', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('확정 취소 시 저장된 금액·수기 내역·원천을 유지하고 수정 가능한 문서를 반환한다', async () => {
    const confirmed = { ...buildDocument(100000), confirmedAt: '2026-09-30T00:00:00.000Z', transactionMemo: '유지할 메모' };
    jest.spyOn(teamSettlementService, 'getTeamSettlement').mockResolvedValue(confirmed);
    const calculate = jest.spyOn(teamSettlementService, 'calculateAutoSettlement');
    const save = jest.spyOn(teamSettlementService, 'saveTeamSettlement').mockResolvedValue(undefined);
    const result = await teamSettlementService.unconfirmTeamSettlement({ yearMonth: confirmed.yearMonth, teamId: confirmed.teamId });
    expect(result).toEqual({ ...confirmed, confirmedAt: null, updatedAt: expect.any(String) });
    expect(save).toHaveBeenCalledWith(result);
    expect(calculate).not.toHaveBeenCalled();
    expect(confirmed.confirmedAt).not.toBeNull();
  });

  it('취소 저장 실패를 성공으로 반환하지 않는다', async () => {
    jest.spyOn(teamSettlementService, 'getTeamSettlement').mockResolvedValue({ ...buildDocument(100000), confirmedAt: '2026-09-30T00:00:00.000Z' });
    jest.spyOn(teamSettlementService, 'saveTeamSettlement').mockRejectedValue(new Error('save-failed'));
    await expect(teamSettlementService.unconfirmTeamSettlement({ yearMonth: '2026-08', teamId: 'team-1' })).rejects.toThrow('save-failed');
  });

  it('자동집계에서 도급·직영 단가를 분리하고 저장 합계에도 반영한다', async () => {
    jest.spyOn(manpowerService, 'getWorkers').mockResolvedValue([]);
    jest.spyOn(siteService, 'getSites').mockResolvedValue([]);
    jest.spyOn(teamService, 'getTeams').mockResolvedValue([]);
    jest.spyOn(companyService, 'getCompanies').mockResolvedValue([]);
    jest.spyOn(dailyReportService, 'getReportWorkerRowsByRange').mockResolvedValue([
      { siteId: 'contract', siteName: '도급 현장', siteType: '도급', responsibleTeamId: 'team-1', manDay: 10, amount: 0 },
      { siteId: 'direct', siteName: '직영 현장', siteType: '직영', responsibleTeamId: 'team-1', manDay: 8, amount: 0 },
      { siteId: 'support', siteName: '지원 현장', siteType: '지원', responsibleTeamId: 'team-1', manDay: 20, amount: 0 },
      { siteId: 'other', siteName: '다른 팀 현장', siteType: '도급', responsibleTeamId: 'team-2', manDay: 50, amount: 0 }
    ] as never);
    jest.spyOn(dailyReportService, 'getReportsByRange').mockResolvedValue([]);
    jest.spyOn(supportRateService, 'getAllSiteRates').mockResolvedValue([]);
    jest.spyOn(teamSettlementService, 'getSupportRateOverrides').mockResolvedValue({ supportTeamRates: {}, supportAggregateRates: {}, supportSiteRates: {}, teamRates: {}, aggregateRates: {}, siteRates: {} });
    jest.spyOn(supportClientSiteAllocationService, 'getAllocationsByMonth').mockResolvedValue([]);
    jest.spyOn(accommodationBillingService, 'getBillingDocuments').mockResolvedValue([]);
    jest.spyOn(accommodationAssignmentService, 'getAllAssignments').mockResolvedValue([]);
    jest.spyOn(accommodationService, 'getMonthlyLedger').mockResolvedValue([]);
    jest.spyOn(vehicleBillingService, 'getBillingsByMonth').mockResolvedValue([]);
    jest.spyOn(cardBillingService, 'getBillingsByMonth').mockResolvedValue([]);
    jest.spyOn(teamExpenseLedgerService, 'getClaimsByMonth').mockResolvedValue([]);
    const result = await teamSettlementService.calculateAutoSettlement({ yearMonth: '2026-09', teamId: 'team-1', teamName: '테스트팀', teamIdVariants: new Set(['team-1']) });
    expect(result.deductions).toEqual([expect.objectContaining({ origin: 'office_expense', amount: 140000, officeExpenseRates: { contract: 10000, direct: 5000 } })]);
    expect(result.sourceSnapshot?.totals).toEqual({ sales: 0, purchases: 0, deductions: 140000, additions: 0, net: -140000 });
  });

  it('recalculates automatic expenses immediately before confirmation while preserving manual items', async () => {
    const staleDraft = buildDocument(100_000);
    staleDraft.transactionMemo = '다음 정산 때 확인\n전달사항 유지';
    staleDraft.deductions.push({
      id: 'manual-adjustment',
      source: 'manual',
      origin: 'manual',
      category: '수기 조정',
      amount: 7_000
    });
    const freshAuto = buildDocument(50_000);

    jest.spyOn(teamService, 'getTeams').mockResolvedValue([
      { id: 'team-1', name: '테스트팀' } as never
    ]);
    jest.spyOn(teamSettlementService, 'calculateAutoSettlement').mockResolvedValue(freshAuto);
    const saveSpy = jest.spyOn(teamSettlementService, 'saveTeamSettlement').mockResolvedValue(undefined);

    const confirmed = await teamSettlementService.saveAndConfirmTeamSettlement(staleDraft);

    expect(teamSettlementService.calculateAutoSettlement).toHaveBeenCalledWith(expect.objectContaining({
      yearMonth: '2026-08',
      teamId: 'team-1'
    }));
    expect(confirmed.deductions).toEqual([
      expect.objectContaining({ id: 'vehicle_billing:2026-08:vehicle-1', amount: 50_000 }),
      expect.objectContaining({ id: 'manual-adjustment', amount: 7_000 })
    ]);
    expect(confirmed.confirmedAt).toEqual(expect.any(String));
    expect(confirmed.transactionMemo).toBe(staleDraft.transactionMemo);
    expect(saveSpy).toHaveBeenCalledWith(confirmed);
  });

  it('fails closed when the vehicle billing source cannot be read', async () => {
    jest.spyOn(siteService, 'getSites').mockResolvedValue([]);
    jest.spyOn(teamService, 'getTeams').mockResolvedValue([]);
    jest.spyOn(companyService, 'getCompanies').mockResolvedValue([]);
    jest.spyOn(dailyReportService, 'getReportWorkerRowsByRange').mockResolvedValue([]);
    jest.spyOn(dailyReportService, 'getReportsByRange').mockResolvedValue([]);
    jest.spyOn(supportRateService, 'getAllSiteRates').mockResolvedValue([]);
    jest.spyOn(teamSettlementService, 'getSupportRateOverrides').mockResolvedValue({
      supportTeamRates: {},
      supportAggregateRates: {},
      supportSiteRates: {},
      teamRates: {},
      aggregateRates: {},
      siteRates: {}
    });
    jest.spyOn(supportClientSiteAllocationService, 'getAllocationsByMonth').mockResolvedValue([]);
    jest.spyOn(accommodationBillingService, 'getBillingDocuments').mockResolvedValue([]);
    const sourceError = new Error('vehicle-source-unavailable');
    const vehicleReadSpy = jest.spyOn(vehicleBillingService, 'getBillingsByMonth').mockRejectedValue(sourceError);
    jest.spyOn(cardBillingService, 'getBillingsByMonth').mockResolvedValue([]);
    jest.spyOn(teamExpenseLedgerService, 'getClaimsByMonth').mockResolvedValue([]);

    await expect(teamSettlementService.calculateAutoSettlement({
      yearMonth: '2026-08',
      teamId: 'team-1',
      teamName: '테스트팀',
      teamIdVariants: new Set(['team-1'])
    })).rejects.toBe(sourceError);
    expect(vehicleReadSpy).toHaveBeenCalledWith('2026-08', { throwOnError: true });
  });
});
