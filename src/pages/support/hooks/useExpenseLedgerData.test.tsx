import { act, renderHook, waitFor } from '@testing-library/react';
import { useExpenseLedgerData } from './useExpenseLedgerData';
import { teamExpenseLedgerService } from '../../../services/teamExpenseLedgerService';

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
