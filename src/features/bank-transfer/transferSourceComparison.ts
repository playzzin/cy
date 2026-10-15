import { loadAccountTransferCandidates, loadRentTransferCandidates, loadSupportTransferCandidates } from './transferSources';
import { loadPayrollDetailSettlements, recoverSavedPayrollDetail } from './payrollDetailRecovery';
import { resolvePayrollBankCode } from '../../pages/payroll/utils/payrollBankCode';
import { isPayrollTransferDetail } from './payrollTransferDetail';
import { isSupportTransferDetail } from './supportTransferDetail';
import type { MonthlyPayrollSettlement } from '../../services/monthlyPayrollSettlementService';
import type { TransferCandidate, TransferRow } from './types';

export interface TransferSourceComparison {
    rowId: string;
    status: 'same' | 'different' | 'unavailable';
    notes: string[];
    currentAmount?: number;
    currentAccount?: string;
}
export interface TransferSourceReport { checkedAt: string; items: TransferSourceComparison[] }
const validPeriod = (period: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(period);
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const accountKey = (row: Pick<TransferCandidate, 'bankCode' | 'accountNumber' | 'accountHolder'>) => JSON.stringify([row.bankCode.trim(), row.accountNumber.replace(/[\s-]/g, ''), row.accountHolder.trim()]);
const detailSignature = (value: TransferCandidate['payrollDetail'] | TransferCandidate['supportDetail']) => {
    if (!value) return '';
    const { capturedAt, restoredFromSource, ...rest } = value;
    const fields = rest as unknown as Record<string, unknown>;
    return JSON.stringify(Object.keys(fields).filter(key => key !== 'amountBasis').sort().map(key => [key, fields[key]]));
};

function compare(row: TransferRow, current: TransferCandidate, notes: string[] = [], amountUnavailable = false): TransferSourceComparison {
    if (row.source !== 'account' && !amountUnavailable && row.amount !== current.amount) notes.push(`송금금액 ${row.amount.toLocaleString('ko-KR')}원 · 현재 원본 ${current.amount.toLocaleString('ko-KR')}원`);
    if (accountKey(row) !== accountKey(current)) notes.push('현재 원본의 은행·계좌·예금주와 다릅니다. 대표계좌나 직접 변경한 계좌인지 확인하세요.');
    const previousDetail = row.source === 'payroll' && isPayrollTransferDetail(row.payrollDetail) ? row.payrollDetail : row.source === 'support' && isSupportTransferDetail(row.supportDetail) ? row.supportDetail : undefined;
    const currentDetail = current.source === 'payroll' ? current.payrollDetail : current.supportDetail;
    if (previousDetail && currentDetail && detailSignature(previousDetail) !== detailSignature(currentDetail)) notes.push('현재 원본의 상세 산출 내역이 보관된 내역과 다릅니다.');
    if (current.warning) notes.push(`현재 원본 안내: ${current.warning}`);
    else if (row.warning && row.source !== 'payroll') notes.push('저장 당시 안내가 현재 원본에는 없습니다. 원본 화면에서 상태를 확인하세요.');
    return { rowId: row.rowId, status: amountUnavailable ? 'unavailable' : notes.length ? 'different' : 'same', notes,
        ...(row.source !== 'account' && !amountUnavailable ? { currentAmount: current.amount } : {}),
        currentAccount: `${current.bankName || current.bankCode} ${current.accountNumber || '계좌 미등록'} · 예금주 ${current.accountHolder || '미등록'}` };
}

function comparePayroll(row: TransferRow, settlements: MonthlyPayrollSettlement[]): TransferSourceComparison {
    const matches = settlements.filter(item => item.yearMonth === row.period).flatMap(settlement => settlement.rows
        .filter(saved => text(saved.paymentSnapshot?.id || saved.rowKey) === row.sourceId).map(saved => ({ saved, settlement })));
    if (matches.length !== 1) return { rowId: row.rowId, status: 'unavailable', notes: ['저장된 급여 원본을 정확히 찾지 못했습니다. 급여 탭에서 같은 월·금액 기준으로 다시 조회하세요.'] };
    const { saved, settlement } = matches[0];
    const snapshot = saved.paymentSnapshot;
    const notes: string[] = [];
    if (settlement.runStatus === 'paid') notes.push('현재 급여 원본은 지급완료 상태입니다. 중복 지급 여부를 확인하세요.');
    else if (settlement.runStatus !== 'confirmed') notes.push('현재 급여 원본은 확정 전 저장본입니다.');
    if (!snapshot) return { rowId: row.rowId, status: 'unavailable', notes: [...notes, '계산 스냅샷이 없어 금액·계좌를 비교할 수 없습니다. 급여에서 다시 조회하세요.'] };
    if (snapshot.month && snapshot.month !== row.period) return { rowId: row.rowId, status: 'unavailable', notes: [...notes, '급여 원본의 대상 월이 일치하지 않아 비교할 수 없습니다.'] };
    const current: TransferCandidate = { ...row, bankName: text(snapshot.bankName), bankCode: resolvePayrollBankCode(text(snapshot.bankName), text(snapshot.bankCode)),
        accountNumber: text(snapshot.accountNumber), accountHolder: text(snapshot.accountHolder), warning: undefined, payrollDetail: undefined };
    try {
        const result = recoverSavedPayrollDetail(row, settlements);
        current.amount = result.detail.originalAmount; current.payrollDetail = result.detail;
    } catch (error) {
        notes.push(error instanceof Error ? error.message : '이 금액 기준은 급여에서 다시 조회해 주세요.');
        return compare(row, current, notes, true);
    }
    if (saved.isValid === false || snapshot.isValid === false) notes.push('급여 원본에 확인이 필요한 항목이 있습니다.');
    return compare(row, current, notes);
}

/** Read-only comparison: no draft, payroll or payment state is updated. */
export async function compareTransferSources(rows: TransferRow[]): Promise<TransferSourceReport> {
    const groups = new Map<string, TransferRow[]>();
    const result = new Map<string, TransferSourceComparison>();
    rows.forEach(row => {
        if (row.source !== 'account' && !validPeriod(row.period)) { result.set(row.rowId, { rowId: row.rowId, status: 'unavailable', notes: ['대상 월이 없어 원본을 확인할 수 없습니다.'] }); return; }
        const key = `${row.source}:${row.source === 'account' ? '' : row.source === 'payroll' ? row.period.slice(0, 4) : row.period}`;
        const group = groups.get(key); if (group) group.push(row); else groups.set(key, [row]);
    });
    const tasks = [...groups.values()];
    let nextIndex = 0;
    await Promise.all(Array.from({ length: Math.min(4, tasks.length) }, async () => {
        while (nextIndex < tasks.length) {
            const group = tasks[nextIndex++], first = group[0];
            try {
                if (first.source === 'payroll') {
                    const settlements = await loadPayrollDetailSettlements(first.period);
                    group.forEach(row => result.set(row.rowId, comparePayroll(row, settlements)));
                } else {
                    const loaded = await (first.source === 'account' ? loadAccountTransferCandidates() : first.source === 'rent' ? loadRentTransferCandidates(first.period) : loadSupportTransferCandidates(first.period));
                    const index = new Map<string, TransferCandidate[]>();
                    loaded.candidates.forEach(candidate => { const key = JSON.stringify([candidate.source, candidate.sourceId, candidate.category, candidate.source === 'account' ? '' : candidate.period]); const list = index.get(key); if (list) list.push(candidate); else index.set(key, [candidate]); });
                    group.forEach(row => {
                        const matches = index.get(JSON.stringify([row.source, row.sourceId, row.category, row.source === 'account' ? '' : row.period])) ?? [];
                        result.set(row.rowId, matches.length === 1 ? compare(row, matches[0]) : { rowId: row.rowId, status: 'unavailable', notes: [loaded.warnings.join(' · ') || '원본을 정확히 찾지 못했습니다. 삭제·조회 조건·연결 정보를 원본 화면에서 확인하세요.'] });
                    });
                }
            } catch {
                group.forEach(row => result.set(row.rowId, { rowId: row.rowId, status: 'unavailable', notes: ['원본 조회에 실패했습니다. 연결 상태를 확인한 뒤 다시 비교하세요.'] }));
            }
        }
    }));
    return { checkedAt: new Date().toISOString(), items: rows.map(row => result.get(row.rowId)!) };
}
