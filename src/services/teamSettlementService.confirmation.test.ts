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

  it('recalculates automatic expenses immediately before confirmation while preserving manual items', async () => {
    const staleDraft = buildDocument(100_000);
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
