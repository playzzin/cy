// Synthetic data only. The browser harness blocks every nonlocal request.
import { buildTeamSettlementRecruiterFeeDeductions } from '../../src/utils/teamSettlementRecruiterFees';
const teams = [
  { id: 'team-a', name: '검증팀 A', companyId: 'company', companyName: '검증회사', type: '시공팀', color: '#2563eb' },
  { id: 'team-b', name: '검증팀 B', companyId: 'company', companyName: '검증회사', type: '시공팀', color: '#16a34a' },
];
const workers = teams.map((team, index) => ({ id: `worker-${index}`, name: `가상작업자 ${index + 1}`, teamId: team.id, teamName: team.name, salaryModel: '일급제', unitPrice: 100000 }));
const empty = async () => [];
const fees = (month: string) => workers.map((worker, index) => ({ month, teamKey: worker.teamId, workerId: worker.id, amount: index === 0 ? 120000 : 30000 }));
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
    const feeDeductions = buildTeamSettlementRecruiterFeeDeductions({ yearMonth, teamId, teamIdVariants: new Set([teamId]), fees: fees(yearMonth), workerNames: new Map(workers.map(worker => [worker.id, worker.name])) });
    const additions = [{ id: 'custom-claim', source: 'auto', origin: 'team_expense_claim', category: '경비 환급(custom_1700000000000_a1b2c3 - 장비 2대)', amount: first ? 50000 : 5000 }];
    const amount = additions.reduce((sum, row) => sum + row.amount, 0);
    const sales = [{ id: 'sale', source: 'manual', origin: 'manual', kind: '직영', siteName: first ? '가상 현장 A' : '가상 현장 B', manDay: first ? 5 : 2, amount: first ? 1000000 : 400000, memo: '당월 작업 청구' }];
    const purchases = [{ id: 'purchase', source: 'manual', origin: 'manual', kind: '지원', siteName: '가상 지원 현장', counterTeamName: '가상 지원팀', manDay: 1, amount: first ? 200000 : 100000 }];
    const deductions = [
      { id: 'payroll', source: 'auto', origin: 'daily_wage_payroll', category: '일급제 급여', amount: first ? 300000 : 150000 },
      { id: 'expense', source: 'manual', origin: 'manual', category: '공제 경비', amount: first ? 50000 : 10000, memo: '당월 경비 정산' },
      ...feeDeductions,
    ];
    const deductionAmount = deductions.reduce((sum, row) => sum + row.amount, 0);
    return {
      yearMonth, teamId, teamName: teams.find(team => team.id === teamId)?.name,
      sales, purchases, deductions, additions, summary: { prevCarryover: first ? 20000 : 0, deposit: first ? 10000 : 0 },
      transactionMemo: '선택한 팀의 정산 내역을 확인해 주세요.\n소개비는 급여에 합산해 차감합니다.',
      updatedAt: new Date().toISOString(), confirmedAt: null,
      sourceSnapshot: { version: 2, capturedAt: new Date().toISOString(), dailyReports: [], supportDetails: [],
        totals: { sales: sales[0].amount, purchases: purchases[0].amount, deductions: deductionAmount, additions: amount, net: sales[0].amount - purchases[0].amount - deductionAmount + amount } },
    };
  },
};
export const laborExchangeService = { getMonthSnapshotInfo: async () => null, getExchangeReport: empty };
export const supportRateService = { getAllSiteRates: empty };
export const accommodationBillingService = { getBillingDocuments: empty };
export const cardBillingService = { getBillingsByMonth: empty };
export const vehicleBillingService = { getBillingsByMonth: empty };
export const teamExpenseLedgerService = { getClaimsByMonth: empty };
export const teamExpenseCategoryService = { getCategories: async () => [{ id: 'custom_1700000000000_a1b2c3', label: '장비 대여' }] };
export const officeService = {};
export const storageService = {};
export const toast = { error: console.error, success: () => {}, warning: () => {} };
