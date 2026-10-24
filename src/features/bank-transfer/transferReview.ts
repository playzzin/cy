import { isPayrollTransferDetail } from './payrollTransferDetail';
import { isSupportTransferDetail } from './supportTransferDetail';
import type { TransferDraft, TransferRow } from './types';
import { reviewCurrentOrigins, reviewOtherDrafts } from './transferDuplicateReview';
import { originalTransferAmount } from './transferWorkflow';

/** Review hints do not claim bank-side account verification. */
export function buildTransferReview(rows: TransferRow[], context?: { draftId: string; savedDrafts: TransferDraft[]; sourceNotes?: Map<string, string[]> }) {
    const accountKey = (row: TransferRow) => `${row.bankCode.trim()}:${row.accountNumber.replace(/[\s-]/g, '')}`;
    const counts = new Map<string, number>();
    rows.filter(row => row.accountNumber.trim()).forEach(row => counts.set(accountKey(row), (counts.get(accountKey(row)) ?? 0) + 1));
    const notes = new Map<string, string[]>();
    const crossDraftNotes = context ? reviewOtherDrafts(rows, context.draftId, context.savedDrafts) : new Map<string, string[]>();
    const overlapping = reviewCurrentOrigins(rows);
    rows.forEach(row => {
        const items: string[] = [];
        if (row.warning) items.push(row.warning);
        if (row.retryContext) items.push(`이전 이체 실패: ${row.retryContext.failureReason || '은행 실패 사유 확인 필요'} · ${row.retryContext.exportFileName}`);
        if (overlapping.has(row.rowId)) items.push('같은 지급 원본이 여러 금액 기준으로 담겼습니다. 합산·분할 지급 여부를 확인하세요.');
        items.push(...(crossDraftNotes.get(row.rowId) ?? []), ...(context?.sourceNotes?.get(row.rowId) ?? []));
        if ((counts.get(accountKey(row)) ?? 0) > 1) items.push(`동일 계좌 ${counts.get(accountKey(row))}건 · 중복 지급 여부 확인`);
        const original = originalTransferAmount(row);
        if (original !== undefined && original !== row.amount) {
            items.push(`원본 금액 ${original.toLocaleString('ko-KR')}원과 다름`);
            if (!row.adjustmentReason?.trim()) items.push('금액 변경 사유 미입력');
        }
        if (row.source === 'payroll' && !isPayrollTransferDetail(row.payrollDetail)) items.push('급여 상세내역 미연결');
        if (row.source === 'support' && !isSupportTransferDetail(row.supportDetail)) items.push('지원비 상세내역 미연결');
        notes.set(row.rowId, items);
    });
    const periods = [...new Set(rows.map(row => row.period).filter(Boolean))].sort();
    return { notes, periods, crossDraftCount: rows.filter(row => crossDraftNotes.get(row.rowId)?.length).length, warningCount: rows.filter(row => notes.get(row.rowId)?.length).length,
        duplicateAccounts: [...counts.values()].filter(count => count > 1).length };
}
