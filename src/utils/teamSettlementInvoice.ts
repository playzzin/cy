import type { DailyAdvanceStatementRow } from './dailyAdvanceStatement';
import type { TeamSettlementDeductionItem } from '../types/teamSettlement';

/** Invoice totals already include recruiter fees. Store one deduction, with per-worker detail. */
export function buildTeamSettlementInvoiceDeduction(yearMonth: string, teamId: string, rows: DailyAdvanceStatementRow[]): TeamSettlementDeductionItem {
  const invoiceDetails = rows.map(row => ({
    workerId: row.workerId || row.workerName || 'unknown', workerName: row.workerName || '작업자명 미확인',
    manDay: row.totalManDay, claimAmount: row.selectedAmount, recruiterFee: row.recruiterFee,
    invoiceAmount: row.selectedAmount + row.recruiterFee
  }));
  return {
    id: `daily_advance_invoice:${yearMonth}:${teamId}`, source: 'auto', origin: 'daily_advance_invoice', category: '대납청구금액',
    amount: Math.round(invoiceDetails.reduce((sum, row) => sum + row.invoiceAmount, 0)), invoiceDetails,
    memo: `대납청구서 ${rows.length}명 · 인력소개비 포함`
  };
}
