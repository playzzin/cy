// Synthetic data only. The browser harness blocks every nonlocal request.
import { buildTeamSettlementExpenseEntries } from '../../src/utils/teamSettlementExpenses';
import { createDailyAdvanceRowResolver, buildDailyAdvanceStatementRows, buildStatementRecruiterFeeValueMap } from '../../src/utils/dailyAdvanceStatement';
import { buildTeamSettlementInvoiceDeduction } from '../../src/utils/teamSettlementInvoice';
const teams = [
  { id: 'team-a', name: '검증팀 A', companyId: 'company', companyName: '검증회사', type: '시공팀', color: '#2563eb' },
  { id: 'team-b', name: '검증팀 B', companyId: 'company', companyName: '검증회사', type: '시공팀', color: '#16a34a' },
];
const workers = teams.map((team, index) => ({ id: `worker-${index}`, name: `가상작업자 ${index + 1}`, teamId: team.id, teamName: team.name, salaryModel: '일급제', unitPrice: 100000 }));
const empty = async () => [];
const fees = (month: string) => workers.map((worker, index) => ({ month, teamKey: worker.teamId, workerId: worker.id, amount: index === 0 ? 120000 : 30000 }));
const accommodationDocs = (yearMonth: string) => new URLSearchParams(window.location.search).has('accommodation') ? [{
  id: 'room-bill', yearMonth, teamId: 'team-a', teamName: '검증팀 A', issuedToType: 'team' as const,
  issuedToWorkerId: '', issuedToWorkerName: '', status: 'confirmed' as const,
  lineItems: [
    { id: 'utility-a-rent', label: '검증 101호 월세', amount: 500000, targetField: 'accommodation' as const, sourceType: 'utility_ledger' as const, sourceAccommodationId: 'room-a' },
    { id: 'utility-a-electricity', label: '검증 101호 전기세', amount: 30000, targetField: 'electricity' as const, sourceType: 'utility_ledger' as const, sourceAccommodationId: 'room-a' },
    { id: 'utility-a-gas', label: '검증 101호 가스비', amount: 20000, targetField: 'gas' as const, sourceType: 'utility_ledger' as const, sourceAccommodationId: 'room-a' },
    { id: 'utility-a-maintenance', label: '검증 101호 관리비', amount: 100000, targetField: 'accommodation' as const, sourceType: 'utility_ledger' as const, sourceAccommodationId: 'room-a' },
    { id: 'utility-b-rent', label: '검증 201호 월세', amount: 300000, targetField: 'accommodation' as const, sourceType: 'utility_ledger' as const, sourceAccommodationId: 'room-b' }
  ]
}] : [];
export const accommodationService = { getAccommodations: async () => [
  { id: 'room-a', name: '검증 101호', address: '검증시 첫길 1 101호' },
  { id: 'room-b', name: '검증 201호', address: '검증시 둘길 2 201호' }
] };
export const useTeamSettlementAccess = () => ({ loading: false, canWrite: new URLSearchParams(window.location.search).has('edit') });
export const teamService = { getTeams: async () => teams };
export const companyService = { getCompaniesByType: async () => [{ id: 'company', name: '검증회사' }] };
export const manpowerService = { getWorkers: async () => workers };
export const dailyReportService = {
  getReportWorkerRowsByRange: empty,
  getWorkerRows: async ({ startDate }: { startDate: string }) => workers.map(worker => ({
    ...worker, workerId: worker.id, workerName: worker.name, reportId: `report-${worker.id}`,
    date: `${startDate.slice(0, 7)}-01`, manDay: 1, amount: 100000,
  })),
};
export const dailyAdvanceWorkbookProfileService = { getProfiles: empty };
export const dailyAdvanceStatementRecruiterFeeService = {
  getFeesByMonth: async (month: string) => fees(month),
  subscribeFeesByMonth: (month: string, onRows: (rows: ReturnType<typeof fees>) => void) => { onRows(fees(month)); return () => {}; },
};
export const teamSettlementService = {
  getTeamDisplayOrder: async () => teams.map(team => team.id),
  getSupportRateOverrides: async () => ({}),
  getSupportSettlementDetailRows: empty,
  getTeamSettlement: async ({ yearMonth, teamId }: { yearMonth: string; teamId: string }) => {
    const first = teamId === 'team-a';
    const validation = new URLSearchParams(window.location.search).has('validation');
    const grouped = new URLSearchParams(window.location.search).has('grouped');
    const resolver = createDailyAdvanceRowResolver(workers, teams);
    const invoiceRows = buildDailyAdvanceStatementRows({
      entries: (await dailyReportService.getWorkerRows({ startDate: `${yearMonth}-01` })).map(row => resolver.resolveEntry(row).entry),
      month: yearMonth, teamKey: teamId, lastDay: new Date(Number(yearMonth.slice(0, 4)), Number(yearMonth.slice(-2)), 0).getDate(),
      recruiterFeeValues: buildStatementRecruiterFeeValueMap(fees(yearMonth))
    });
    const additions = [{ id: 'custom-claim', source: 'auto', origin: 'team_expense_claim', category: '경비 환급(custom_1700000000000_a1b2c3 - 장비 2대)', amount: first ? 50000 : 5000 }];
    if (grouped) {
      additions[0] = { ...additions[0], category: '경비 환급(식대 - 점심)', amount: 20000 };
      additions.push({ ...additions[0], id: 'meal-evening', category: '경비 환급(식대 - 저녁)', amount: 30000 },
        { ...additions[0], id: 'fuel', category: '경비 환급(유류 - 주유)', amount: 40000 });
    }
    const amount = additions.reduce((sum, row) => sum + row.amount, 0);
    const sales = [{ id: 'sale', source: 'manual', origin: 'manual', kind: '직영', siteName: first ? '가상 현장 A' : '가상 현장 B', manDay: first ? 5 : 2, amount: first ? 1000000 : 400000, memo: '당월 작업 청구' }];
    if (validation) sales.push({ ...sales[0], id: 'missing-sale', source: 'auto', origin: 'daily_report', siteName: '누락 확인 현장', amount: 0 });
    const purchases = [{ id: 'purchase', source: 'manual', origin: 'manual', kind: '지원', siteName: '가상 지원 현장', counterTeamName: '가상 지원팀', manDay: 1, amount: first ? 200000 : 100000 }];
    const deductions = [
      buildTeamSettlementInvoiceDeduction(yearMonth, teamId, invoiceRows),
      { id: 'expense', source: 'manual', origin: 'manual', category: '공제 경비', amount: first ? 50000 : 10000, memo: '당월 경비 정산' },
      ...buildTeamSettlementExpenseEntries({ yearMonth, matchesTeam: id => id === teamId,
        accommodationDocs: accommodationDocs(yearMonth), vehicleDocs: [], cardDocs: [], teamExpenseClaims: []
      }).map(entry => entry.item),
    ];
    const deductionAmount = deductions.reduce((sum, row) => sum + row.amount, 0);
    return {
      yearMonth, teamId, teamName: teams.find(team => team.id === teamId)?.name,
      sales, purchases, deductions, additions, summary: { prevCarryover: first ? 20000 : 0, deposit: first ? 10000 : 0 },
      transactionMemo: '선택한 팀의 정산 내역을 확인해 주세요.\n대납청구서 금액을 공제합니다.',
      updatedAt: new Date().toISOString(), confirmedAt: null,
      sourceSnapshot: { version: 2, capturedAt: new Date().toISOString(), dailyReports: validation ? [{ reportId: 'report-a', date: `${yearMonth}-01`, reportTeamId: teamId, reportTeamName: '검증팀 A', siteId: 'site-a', siteName: '검증 현장', responsibleTeamId: teamId, responsibleTeamName: '검증팀 A', teamAssignmentMissing: false, workerTeamIds: [teamId], workerTeamNames: ['검증팀 A'] }] : [], supportDetails: [],
        totals: { sales: sales[0].amount, purchases: purchases[0].amount, deductions: deductionAmount, additions: amount, net: sales[0].amount - purchases[0].amount - deductionAmount + amount } },
    };
  },
};
export const laborExchangeService = { getMonthSnapshotInfo: async () => null, getExchangeReport: empty };
export const supportRateService = { getAllSiteRates: empty };
export const accommodationBillingService = { getBillingDocuments: async ({ yearMonth }: { yearMonth: string }) => accommodationDocs(yearMonth) };
export const cardBillingService = { getBillingsByMonth: empty };
export const vehicleBillingService = { getBillingsByMonth: empty };
export const teamExpenseLedgerService = { getClaimsByMonth: empty };
export const teamExpenseCategoryService = { getCategories: async () => [{ id: 'custom_1700000000000_a1b2c3', label: '장비 대여' }] };
export const officeService = {};
export const storageService = {};
export const toast = { error: console.error, success: () => {}, warning: () => {} };
