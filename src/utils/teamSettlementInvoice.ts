import type { DailyAdvanceServiceRow } from './dailyAdvanceServiceStatement';
import type { DailyAdvanceStatementRow } from './dailyAdvanceStatement';
import type { TeamSettlementDeductionItem } from '../types/teamSettlement';

/** Invoice totals already include recruiter fees. Store one deduction, with per-worker detail. */
export function buildTeamSettlementInvoiceDeduction(yearMonth: string, teamId: string, rows: DailyAdvanceStatementRow[], serviceRows: DailyAdvanceServiceRow[] = []): TeamSettlementDeductionItem {
  const invoiceDetails: NonNullable<TeamSettlementDeductionItem['invoiceDetails']> = rows.map(row => ({
    workerId: row.workerId || row.workerName || 'unknown', workerName: row.workerName || '작업자명 미확인',
    recruiterFeeDates: row.recruiterFeeDates || [],
    manDay: row.totalManDay, claimAmount: row.selectedAmount, recruiterFee: row.recruiterFee,
    invoiceAmount: row.selectedAmount + row.recruiterFee
  }));
  invoiceDetails.push(...serviceRows.map(row => ({
    invoiceType: 'service' as const, workerId: row.workerId || row.workerName || 'unknown', workerName: row.workerName || '작업자명 미확인',
    recruiterFeeDates: Object.values(row.entriesByDay).filter(entry => entry.recruiterFee > 0).map(entry => entry.date).sort(),
    manDay: row.totalManDay, claimAmount: row.totalClaimAmount, recruiterFee: row.totalRecruiterFee,
    invoiceAmount: row.totalClaimAmount + row.totalRecruiterFee
  })));
  return {
    id: `daily_advance_invoice:${yearMonth}:${teamId}`, source: 'auto', origin: 'daily_advance_invoice', category: '대납청구비',
    amount: Math.round(invoiceDetails.reduce((sum, row) => sum + row.invoiceAmount, 0)), invoiceDetails,
    memo: `대납청구서 ${rows.length}명 · 용역 ${serviceRows.length}명 · 인력소개비 포함`
  };
}
