import { renderHook, waitFor } from '@testing-library/react';
import { useExpenseLedgerData } from './useExpenseLedgerData';
import { accommodationBillingService } from '../../../services/accommodationBillingService';
import { cardBillingService } from '../../../services/cardBillingService';

jest.mock('../../../services/teamService', () => ({ teamService: { getTeams: async () => [
  { id: 'team-a', name: '가상A팀', companyName: '청연이엔지' },
  { id: 'team-b', name: '가상B팀', companyName: '청연이엔지' }
] } }));
jest.mock('../../../services/siteService', () => ({ siteService: { getSites: async () => [] } }));
jest.mock('../../../services/companyService', () => ({ companyService: { getCompanies: async () => [] } }));
jest.mock('../../../services/accommodationBillingService', () => ({ accommodationBillingService: { getBillingDocuments: jest.fn() } }));
jest.mock('../../../services/accommodationBillingTargetService', () => ({ accommodationBillingTargetService: { listTargets: async () => [
  { id: 'personal-target', accommodationId: 'personal-room', targetType: 'worker', workerId: 'worker-a', workerName: '가상개인', startDate: '2026-01-01' }
] } }));
jest.mock('../../../services/vehicleBillingService', () => ({ vehicleBillingService: { getBillingsByMonth: async () => [] } }));
jest.mock('../../../services/cardBillingService', () => ({ cardBillingService: { getBillingsByMonth: jest.fn() } }));
jest.mock('../../../services/cardService', () => ({ cardService: { getCards: async () => [], listAllCardBillingTargets: async () => [
  { id: 'card-target', cardId: 'card-a', targetType: 'TEAM', targetId: 'team-b', targetName: '가상B팀', startDate: '2026-01-01' }
] } }));
jest.mock('../../../services/teamExpenseLedgerService', () => ({ teamExpenseLedgerService: { getClaimsByMonth: async () => [] } }));
jest.mock('../../../services/teamExpenseCategoryService', () => ({ DEFAULT_TEAM_EXPENSE_CATEGORIES: [], teamExpenseCategoryService: { getCategories: async () => [] } }));
jest.mock('../../../utils/swal', () => ({ toast: { error: jest.fn() } }));

beforeEach(() => {
  (accommodationBillingService.getBillingDocuments as jest.Mock).mockResolvedValue([{
    id: 'accommodation-draft', yearMonth: '2026-09', teamId: 'team-a', teamName: '가상A팀', issuedToType: 'team', status: 'draft',
    lineItems: [
      { id: 'shared-rent', label: '공용숙소 월세', amount: 1000000, targetField: 'accommodation', sourceType: 'utility_ledger', sourceAccommodationId: 'shared-room' },
      { id: 'personal-rent', label: '개인숙소 월세', amount: 400000, targetField: 'accommodation', sourceType: 'utility_ledger', sourceAccommodationId: 'personal-room' }
    ]
  }]);
  (cardBillingService.getBillingsByMonth as jest.Mock).mockResolvedValue([{
    id: 'card-draft__row_source', yearMonth: '2026-09', cardId: 'card-a', cardLabel: '가상카드 (1234)',
    teamId: 'team-a', teamName: '가상A팀', assignedTeamId: 'team-a', assignedTeamName: '가상A팀', issuedToType: 'team',
    status: 'DRAFT', totalAmount: 500000, variableCost: 500000, statementAttachmentPaths: [],
    lineItems: [{ id: 'card-cost', label: '식대', amount: 500000, sourceType: 'card_ledger', sourceStartDate: '2026-09-01', sourceEndDate: '2026-09-30' }]
  }]);
});

it('개인으로 변경한 숙소는 상세 금액을 유지하며 팀 합계에서 제외한다', async () => {
  const { result } = renderHook(() => useExpenseLedgerData('2026-09', 'team-a', 'posted'));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.summaries[0].accommodation).toBe(1000000);
  expect(result.current.selectedRawDocs.accommodationDocs.find(doc => doc.issuedToType === 'worker')).toMatchObject({
    issuedToWorkerId: 'worker-a', lineItems: [expect.objectContaining({ amount: 400000 })]
  });
});

it('월별 원장을 다시 저장하지 않아도 변경한 카드 청구 팀에 경비를 집계한다', async () => {
  const { result } = renderHook(() => useExpenseLedgerData('2026-09', 'all', 'posted'));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.summaries.find(row => row.teamId === 'team-a')?.card).toBe(0);
  expect(result.current.summaries.find(row => row.teamId === 'team-b')?.card).toBe(500000);
  expect(result.current.rawDocs.cardDocs[0]).toMatchObject({ teamId: 'team-b', assignedTeamId: 'team-a' });
  expect(result.current.totals.total).toBe(1500000);
});
