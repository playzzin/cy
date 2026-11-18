import type { DailyAdvanceStatementRecruiterFee } from '../services/dailyAdvanceStatementRecruiterFeeService';
import type { TeamSettlementDeductionItem } from '../types/teamSettlement';

/** Saved statement fees are monthly amounts per worker, not amounts per work day. */
export function buildTeamSettlementRecruiterFeeDeductions(params: {
  yearMonth: string;
  teamId: string;
  teamIdVariants: Set<string>;
  fees: DailyAdvanceStatementRecruiterFee[];
  workerNames?: Map<string, string>;
}): TeamSettlementDeductionItem[] {
  const teamKeys = new Set([params.teamId, ...Array.from(params.teamIdVariants)].map(key => key.trim()));
  const byWorker = new Map<string, DailyAdvanceStatementRecruiterFee>();
  params.fees.forEach(fee => {
    if (fee.month !== params.yearMonth || !teamKeys.has(fee.teamKey.trim()) || !fee.workerId.trim()) return;
    const previous = byWorker.get(fee.workerId.trim());
    // A canonical team's saved value (including zero) takes precedence over a legacy alias.
    if (!previous || fee.teamKey.trim() === params.teamId) byWorker.set(fee.workerId.trim(), fee);
  });
  const fees = Array.from(byWorker.values()).filter(fee => Number.isFinite(fee.amount) && fee.amount > 0);
  const amount = fees.reduce((total, fee) => total + fee.amount, 0);
  if (amount <= 0) return [];
  const recruiterFeeDetails = fees.map(fee => ({
    workerId: fee.workerId.trim(),
    workerName: params.workerNames?.get(fee.workerId.trim())?.trim() || '작업자명 미확인',
    amount: fee.amount
  })).sort((left, right) => left.workerName.localeCompare(right.workerName, 'ko'));
  return [{
    id: `daily_advance_recruiter_fee:${params.yearMonth}:${params.teamId}`,
    source: 'auto',
    origin: 'daily_advance_recruiter_fee',
    category: '인력소개비',
    amount,
    recruiterFeeDetails,
    memo: `청구서 소개비 ${new Set(fees.map(fee => fee.workerId)).size}명`
  }];
}
