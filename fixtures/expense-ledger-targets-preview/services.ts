// Synthetic data only. The real expense page, hook, projection and detail table run unchanged.
const targetsEnabled = () => new URLSearchParams(window.location.search).get('targets') !== 'old';
export const teamService = { getTeams: async () => [
  { id: 'team-a', name: '가상A팀', companyName: '청연이엔지', color: '#2563eb' },
  { id: 'team-b', name: '가상B팀', companyName: '청연이엔지', color: '#059669' }
] };
export const siteService = { getSites: async () => [] };
export const companyService = { getCompanies: async () => [] };
export const accommodationBillingService = { getBillingDocuments: async () => [{
  id: 'room-bill', yearMonth: '2026-09', teamId: 'team-a', teamName: '가상A팀', issuedToType: 'team', status: 'draft',
  lineItems: [
    { id: 'shared-rent', label: '가상공용숙소 월세', amount: 1000000, targetField: 'accommodation', sourceType: 'utility_ledger', sourceAccommodationId: 'shared-room' },
    { id: 'personal-rent', label: '가상개인숙소 월세', amount: 400000, targetField: 'accommodation', sourceType: 'utility_ledger', sourceAccommodationId: 'personal-room' }
  ]
}] };
export const accommodationBillingTargetService = { listTargets: async () => targetsEnabled() ? [
  { id: 'room-target', accommodationId: 'personal-room', targetType: 'worker', workerId: 'worker-a', workerName: '가상개인', startDate: '2026-01-01' }
] : [] };
export const cardBillingService = { getBillingsByMonth: async () => [{
  id: 'card-bill__row_source', yearMonth: '2026-09', cardId: 'card-a', cardLabel: '가상카드 (1234)',
  teamId: 'team-a', teamName: '가상A팀', assignedTeamId: 'team-a', assignedTeamName: '가상A팀', issuedToType: 'team', status: 'DRAFT',
  totalAmount: 500000, variableCost: 500000, statementAttachmentPaths: [],
  lineItems: [{ id: 'meal', label: '식대', amount: 500000, sourceType: 'card_ledger', sourceStartDate: '2026-09-01', sourceEndDate: '2026-09-30' }]
}] };
export const manpowerService = { getWorkers: async () => [] };
export const officeStaffService = { getOfficeStaff: async () => [] };
const datesMode = () => new URLSearchParams(window.location.search).get('mode') === 'dates';
export const cardService = {
  applyCardBillingTargetChanges: async (changes: { billingStartDate?: string }) => {
    if (!datesMode()) throw new Error('Only synthetic date fixture can save');
    sessionStorage.setItem('fixture.billingStartDate', changes.billingStartDate || '');
  },
  getCards: async () => [], listAllCardBillingTargets: async () => !datesMode() && targetsEnabled() ? [
  { id: 'card-target', cardId: 'card-a', targetType: 'TEAM', targetId: 'team-b', targetName: '가상B팀', startDate: '2026-01-01' }
] : [] };
export const vehicleBillingService = { getBillingsByMonth: async () => [] };
export const teamExpenseLedgerService = { getClaimsByMonth: async () => [] };
export const dailyReportService = { getReports: async () => [] };
export const DEFAULT_TEAM_EXPENSE_CATEGORIES = [];
export const teamExpenseCategoryService = { getCategories: async () => [] };
