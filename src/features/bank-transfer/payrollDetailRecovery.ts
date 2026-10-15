import { monthlyPayrollSettlementService } from '../../services/monthlyPayrollSettlementService';
import type { MonthlyPayrollSettlement } from '../../services/monthlyPayrollSettlementService';
import type { PayrollTransferDetail } from '../../pages/payroll/types/payroll';
import { buildPayrollTransferDetail } from './payrollTransferDetail';
import type { TransferCandidate } from './types';

export interface PayrollDetailRecoveryResult { detail: PayrollTransferDetail; warning?: string }
export const loadPayrollDetailSettlements = (period: string) => monthlyPayrollSettlementService.getSettlementsByYear(Number(period.slice(0, 4)));

export function recoverSavedPayrollDetail(target: TransferCandidate, settlements: MonthlyPayrollSettlement[]): PayrollDetailRecoveryResult {
    const matches = settlements.filter(item => item.yearMonth === target.period).flatMap(settlement => settlement.rows
        .filter(row => String(row.paymentSnapshot?.id || row.rowKey).trim() === target.sourceId)
        .map(row => ({ row, settlement })));
    if (matches.length !== 1) throw new Error('해당 월의 급여 원본을 정확히 연결할 수 없습니다. 급여에서 같은 월·금액 기준으로 다시 조회해 주세요.');
    const { row, settlement } = matches[0];
    const snapshot = row.paymentSnapshot;
    if (!snapshot || (snapshot.month && snapshot.month !== target.period)
        || typeof snapshot.totalAmount !== 'number' || !Number.isFinite(snapshot.totalAmount)
        || row.netAmount !== snapshot.totalAmount) throw new Error('저장된 급여 계산 내역이 불완전하거나 금액이 일치하지 않습니다. 급여에서 다시 조회해 주세요.');
    const basis = target.id === `payroll:${target.sourceId}:totalAmount` ? { label: '저장 원본 실지급액', amount: snapshot.totalAmount }
        : target.id === `payroll:${target.sourceId}:invoiceNet` ? { label: '저장 원본 공제후 법인총액', amount: row.invoiceNetAmount }
            : target.id === `payroll:${target.sourceId}:laborNet` ? { label: '저장 원본 공제후 노무총액', amount: row.laborNetAmount } : undefined;
    if (!basis || typeof basis.amount !== 'number' || !Number.isFinite(basis.amount)) throw new Error('이 금액 기준의 과거 산출 내역이 없습니다. 급여에서 같은 월·금액 기준으로 다시 조회하면 상세가 연결됩니다.');
    return {
        detail: { ...buildPayrollTransferDetail(snapshot, { salaryLabel: row.salaryModel || '급여', amountBasis: basis.label,
            originalAmount: basis.amount, isFinalized: settlement.runStatus === 'confirmed' || settlement.runStatus === 'paid' }), restoredFromSource: true },
        warning: settlement.runStatus === 'paid' ? '급여 원본은 지급완료 상태입니다. 중복 지급 여부를 확인하세요.'
            : settlement.runStatus !== 'confirmed' ? '확정 전 저장본에서 상세를 복원했습니다.' : undefined,
    };
}
