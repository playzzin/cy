import { act, renderHook, waitFor } from '@testing-library/react';
import { useExpenseLedgerData } from './useExpenseLedgerData';
import { teamExpenseLedgerService } from '../../../services/teamExpenseLedgerService';
import { dailyReportService } from '../../../services/dailyReportService';

jest.mock('../../../services/dailyReportService', () => ({ dailyReportService: { getReports: jest.fn() } }));

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
jest.mock('../../../services/accommodationBillingService', () => ({ accommodationBillingService: { getBillingDocuments: async () => [] } }));
jest.mock('../../../services/vehicleBillingService', () => ({ vehicleBillingService: { getBillingsByMonth: async () => [] } }));
jest.mock('../../../services/cardBillingService', () => ({ cardBillingService: { getBillingsByMonth: async () => [] } }));
jest.mock('../../../services/cardService', () => ({ cardService: { getCards: async () => [], listAllCardBillingTargets: async () => [] } }));
jest.mock('../../../services/teamExpenseLedgerService', () => ({ teamExpenseLedgerService: { getClaimsByMonth: jest.fn() } }));
jest.mock('../../../services/teamExpenseCategoryService', () => ({ DEFAULT_TEAM_EXPENSE_CATEGORIES: [], teamExpenseCategoryService: { getCategories: async () => [] } }));
jest.mock('../../../utils/swal', () => ({ toast: { error: jest.fn() } }));

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
