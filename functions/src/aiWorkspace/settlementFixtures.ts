import { fixtureCatalog, fixturePlan } from './fixtures';
import { SourceRow } from './domain';
export const settlementPlan = () => ({ ...fixturePlan(), dataset: 'teamSettlements' as const, entity: 'team' as const, groupBy: 'settlementTeam' as const, sortBy: 'amount' as const,
  report: { ...fixturePlan().report, title: '확정 정산 검증 보고서' } });
export const settlementCatalog = fixtureCatalog;
export const settlementDocument = (teamId = 't1', yearMonth = '2026-08', confirmed = true): SourceRow => ({
  id: `team_settlement_${yearMonth}__${teamId}`, data: {
    teamId, teamName: teamId === 't1' ? '검증 1팀' : '검증 2팀', yearMonth, confirmedAt: confirmed ? '2026-09-01T00:00:00.000Z' : null,
    sales: [{ id: 'sales-1', amount: 1000000, siteName: '검증 현장', origin: 'daily_report' }, { id: 'legacy-sales', amount: 99999, origin: 'support_outgoing' }],
    purchases: [{ id: 'purchase-1', amount: 200000, siteName: '검증 현장', origin: 'support_fee_incoming' }, { id: 'legacy-purchase', amount: 88888, origin: 'support_incoming' }],
    deductions: [{ id: 'card', amount: 50000, origin: 'card_billing' }, { id: 'room', amount: 100000, origin: 'accommodation_billing' }, { id: 'car', amount: 30000, origin: 'vehicle_billing' }, { id: 'wage', amount: 120000, origin: 'daily_wage_payroll' }, { id: 'etc', amount: 10000, origin: 'manual' }],
    additions: [{ id: 'refund', amount: 20000, category: '경비 환급' }], summary: { prevCarryover: 40000, deposit: 60000 },
    transactionMemo: '반환 금지 메모', sourceSnapshot: { totals: { net: 9999999 } },
  },
});
