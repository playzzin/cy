import { act, renderHook, waitFor } from '@testing-library/react';
import { useExpenseLedgerData } from './useExpenseLedgerData';
import { teamExpenseLedgerService } from '../../../services/teamExpenseLedgerService';
import { dailyReportService } from '../../../services/dailyReportService';
import { accommodationBillingService } from '../../../services/accommodationBillingService';
import { applyAccommodationRentPeriod } from '../../../utils/accommodationRentPeriod';
import type { Accommodation } from '../../../types/accommodation';
import type { AccommodationBillingDocument } from '../../../types/accommodationBilling';

jest.mock('../../../services/dailyReportService', () => ({ dailyReportService: { getReports: jest.fn() } }));

beforeEach(() => {
  (accommodationBillingService.getBillingDocuments as jest.Mock).mockResolvedValue([]);
});

it('팀 경비를 해당팀 담당현장 공수와 다른현장 지원 공수의 합으로 나눈다', async () => {
  (teamExpenseLedgerService.getClaimsByMonth as jest.Mock).mockResolvedValueOnce([
    { id: 'cost', yearMonth: '2026-09', payerTeamId: 'fixture-team', amount: 90000, status: 'charged' }
  ]);
  (dailyReportService.getReports as jest.Mock).mockResolvedValueOnce([
    { id: 'own', date: '2026-09-01', teamId: 'fixture-team', responsibleTeamId: 'fixture-team', totalManDay: 100,
      workers: [{ workerId: 'own-worker', teamId: 'fixture-team', manDay: 2 }, { workerId: 'incoming', teamId: 'other-team', manDay: 98 }] },
    { id: 'out', date: '2026-09-02', teamId: 'other-team', responsibleTeamId: 'other-team', totalManDay: 101,
      workers: [{ workerId: 'own-worker', teamId: 'fixture-team', manDay: 1 }, { workerId: 'other', teamId: 'other-team', manDay: 100 }] }
  ]);
  const { result } = renderHook(() => useExpenseLedgerData('2026-09', 'fixture-team', 'posted', true));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current).toHaveProperty('teamAverageExpenses.fixture-team', {
    responsibleSiteManDay: 2, supportManDay: 1, totalManDay: 3, averageExpense: 30000
  });
  expect(dailyReportService.getReports).toHaveBeenCalledWith({ startDate: '2026-09-01', endDate: '2026-09-31' });
});

jest.mock('../../../services/teamService', () => ({ teamService: { getTeams: async () => [{ id: 'fixture-team', name: 'fixture', companyName: '청연이엔지' }] } }));
jest.mock('../../../services/siteService', () => ({ siteService: { getSites: async () => [] } }));
jest.mock('../../../services/companyService', () => ({ companyService: { getCompanies: async () => [] } }));
jest.mock('../../../services/accommodationBillingService', () => ({ accommodationBillingService: { getBillingDocuments: jest.fn(async () => []) } }));
jest.mock('../../../services/vehicleBillingService', () => ({ vehicleBillingService: { getBillingsByMonth: async () => [] } }));
jest.mock('../../../services/cardBillingService', () => ({ cardBillingService: { getBillingsByMonth: async () => [] } }));
jest.mock('../../../services/cardService', () => ({ cardService: { getCards: async () => [], listAllCardBillingTargets: async () => [] } }));
jest.mock('../../../services/teamExpenseLedgerService', () => ({ teamExpenseLedgerService: { getClaimsByMonth: jest.fn() } }));
jest.mock('../../../services/teamExpenseCategoryService', () => ({ DEFAULT_TEAM_EXPENSE_CATEGORIES: [], teamExpenseCategoryService: { getCategories: async () => [] } }));
jest.mock('../../../utils/swal', () => ({ toast: { error: jest.fn() } }));

it.each([
  ['2026-10', false, 950000, 450000],
  ['2026-11', true, 1000000, 500000],
])('%s 경비내역은 개인숙소와 조정을 포함하고 정산의 개인청구 제외는 유지한다', async (month, adjusted, displayed, settlement) => {
  const billing = (type: 'team' | 'worker', amounts: number[]) => ({
    id: type, yearMonth: month, teamId: 'fixture-team', issuedToType: type, status: 'draft',
    lineItems: amounts.map((amount, i) => ({ id: `${type}-${i}`, amount, targetField: 'accommodation', sourceType: 'utility_ledger' })),
  });
  const docs = [billing('team', adjusted ? [450000, 500000] : [450000]), billing('worker', [500000])];
  (accommodationBillingService.getBillingDocuments as jest.Mock).mockResolvedValueOnce(docs).mockResolvedValueOnce(docs);
  const claims = adjusted ? [{ id: 'adjustment', yearMonth: month, payerTeamId: 'fixture-team',
    claimType: 'otherExpense', category: 'accommodationAdjustment', amount: -450000, status: 'charged' }] : [];
  (teamExpenseLedgerService.getClaimsByMonth as jest.Mock).mockResolvedValueOnce(claims).mockResolvedValueOnce(claims);
  const { result: overview } = renderHook(() => useExpenseLedgerData(month, 'fixture-team', 'posted', false, true));
  await waitFor(() => expect(overview.current.loading).toBe(false));
  expect(overview.current.summaries[0]).toMatchObject({ accommodation: displayed, otherClaim: 0 });
  expect(overview.current.totals).toMatchObject({ accommodation: displayed, total: displayed });
  expect(overview.current.selectedRawDocs.accommodationDocs).toHaveLength(2);
  const { result: accounting } = renderHook(() => useExpenseLedgerData(month, 'fixture-team', 'posted'));
  await waitFor(() => expect(accounting.current.loading).toBe(false));
  expect(accounting.current.totals).toMatchObject({ accommodation: settlement, otherClaim: 0, total: settlement });
});

it('숙소 청구서 자체의 음수 조정도 합계에서 차감한다', async () => {
  (accommodationBillingService.getBillingDocuments as jest.Mock).mockResolvedValueOnce([{
    id: 'team-credit', yearMonth: '2026-11', teamId: 'fixture-team', issuedToType: 'team', status: 'confirmed',
    lineItems: [1000000, -450000].map((amount, i) => ({ id: `${i}`, amount, targetField: 'accommodation' })),
  }]);
  (teamExpenseLedgerService.getClaimsByMonth as jest.Mock).mockResolvedValueOnce([]);
  const { result } = renderHook(() => useExpenseLedgerData('2026-11', 'fixture-team', 'posted'));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.totals.accommodation).toBe(550000);
});

it('월 이동 시 10월 월세 95만원을 유지하고 11월은 종료 월세만 제외해 100만원을 표시한다', async () => {
  const room = { id: 'ended', status: 'active', contract: { endDate: '2026-10-31' } } as Accommodation;
  (accommodationBillingService.getBillingDocuments as jest.Mock).mockImplementation(async ({ yearMonth, forExpenseLedger }) => {
    expect(forExpenseLedger).toBe(true);
    const docs = [
      { id: 'team', yearMonth, teamId: 'fixture-team', issuedToType: 'team', status: 'draft', lineItems: [
        { id: 'rent-ended', amount: 450000, targetField: 'accommodation', sourceType: 'utility_ledger', sourceAccommodationId: 'ended' },
        ...(yearMonth === '2026-11' ? [
          { id: 'new-room', amount: 500000, targetField: 'accommodation', sourceType: 'utility_ledger', sourceAccommodationId: 'new' },
          { id: 'electricity', amount: 30100, targetField: 'electricity', sourceType: 'utility_ledger', sourceAccommodationId: 'ended' },
        ] : []),
      ] },
      { id: 'worker', yearMonth, teamId: 'fixture-team', issuedToType: 'worker', status: 'draft', lineItems: [
        { id: 'worker-rent', amount: 500000, targetField: 'accommodation', sourceType: 'utility_ledger', sourceAccommodationId: 'worker-room' },
      ] },
    ] as AccommodationBillingDocument[];
    return applyAccommodationRentPeriod(docs, [room]);
  });
  (teamExpenseLedgerService.getClaimsByMonth as jest.Mock).mockResolvedValue([]);
  const { result, rerender } = renderHook(({ month }) => useExpenseLedgerData(month, 'fixture-team', 'all', false, true), {
    initialProps: { month: '2026-10' },
  });
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.totals.accommodation).toBe(950000);
  rerender({ month: '2026-11' });
  await waitFor(() => expect(result.current.totals.accommodation).toBe(1000000));
  expect(result.current.totals.utility).toBe(30100);
  expect(result.current.selectedRawDocs.accommodationDocs[0].lineItems[0].excludedContractRent?.amount).toBe(450000);
});

it('음수 기타청구를 상세에 유지하고 팀별 금액과 전체 합계에서 차감한다', async () => {
  (teamExpenseLedgerService.getClaimsByMonth as jest.Mock).mockResolvedValueOnce([
    { id: 'cost', yearMonth: '2026-09', payerTeamId: 'fixture-team', claimType: 'otherExpense', amount: 90000, status: 'charged' },
    { id: 'credit', yearMonth: '2026-09', payerTeamId: 'fixture-team', claimType: 'otherExpense', amount: -30000, status: 'charged' },
    { id: 'draft', yearMonth: '2026-09', payerTeamId: 'fixture-team', claimType: 'otherExpense', amount: -50000, status: 'draft' }
  ]);
  (dailyReportService.getReports as jest.Mock).mockResolvedValueOnce([]);
  const { result } = renderHook(() => useExpenseLedgerData('2026-09', 'fixture-team', 'posted', true));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.summaries[0]).toMatchObject({ otherClaim: 60000 });
  expect(result.current.totals).toMatchObject({ otherClaim: 60000, total: 60000 });
  expect(result.current.selectedClaims.other.map(row => row.amount)).toEqual(expect.arrayContaining([90000, -30000]));
  expect(result.current.selectedClaims.other).toHaveLength(2);
});

it('공수 조회 실패를 0공수로 오인하지 않도록 평균 집계를 보류한다', async () => {
  const warning = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  (teamExpenseLedgerService.getClaimsByMonth as jest.Mock).mockResolvedValueOnce([
    { id: 'cost', yearMonth: '2026-09', payerTeamId: 'fixture-team', amount: 90000, status: 'charged' }
  ]);
  (dailyReportService.getReports as jest.Mock).mockRejectedValueOnce(new Error('unavailable'));
  try {
    const { result } = renderHook(() => useExpenseLedgerData('2026-09', 'fixture-team', 'posted', true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current).toHaveProperty('dailyReportsError', true);
    expect(result.current.teamAverageExpenses).toEqual({});
  } finally {
    warning.mockRestore();
  }
});

it('이전 월 응답이 늦게 도착해도 현재 월 내역을 유지한다', async () => {
  let resolveOld!: (rows: any[]) => void;
  (teamExpenseLedgerService.getClaimsByMonth as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }))
    .mockResolvedValueOnce([{ id: 'current', yearMonth: '2026-09', payerTeamId: 'fixture-team', amount: 900 }]);
  const { result, rerender } = renderHook(({ month }) => useExpenseLedgerData(month, 'all'), { initialProps: { month: '2026-08' } });
  rerender({ month: '2026-09' });
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => resolveOld([{ id: 'old', yearMonth: '2026-08', payerTeamId: 'fixture-team', amount: 800 }]));
  expect(result.current.rawDocs.claims.map(row => row.id)).toEqual(['current']);
});
