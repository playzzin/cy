import { getTransferExportCells, validateTransferRow } from './transferModel';
import type { TransferCandidate, TransferDraft, TransferExportRecord, TransferRow } from './types';

// @guide-sync 03·06: 검토 해제/파일 생성 이력/변경 비교 기준은 transferGuideContent.ts 안내와
// transferGuideSimulation.ts의 updateRows·review·export 장면을 함께 갱신한다.
export const originalTransferAmount = (row: TransferCandidate) => row.payrollDetail?.originalAmount
    ?? row.supportDetail?.originalAmount ?? row.rentDetail?.originalAmount ?? row.originalAmount;

/** Exact comparison, not a lossy hash. A restored detail alone does not change the bank instruction. */
export const transferSignature = (rows: TransferRow[]) => JSON.stringify(rows.map(row => [
    row.rowId, row.id, row.source, row.sourceId, row.period, row.name, row.groupName, row.accountHolder,
    ...getTransferExportCells(row), row.adjustmentReason ?? '',
]));

export function workflowState(draft: TransferDraft) {
    const signature = transferSignature(draft.rows);
    const reviewed = !!draft.rows.length && draft.review?.signature === signature;
    // Only the newest file can represent the current working list.
    const latest = draft.exportHistory?.[0];
    const matching = latest?.rows && transferSignature(latest.rows) === signature ? latest : undefined;
    const resultCount = matching?.results?.length ?? 0;
    const label = matching ? resultCount === matching.rows!.length ? '결과 확인' : '파일 생성'
        : reviewed ? '검토 완료' : '작성 중';
    return { label, reviewed, matching, needsReview: !!draft.review && !reviewed,
        changedSinceExport: !!latest?.rows && !matching };
}

export function createExportRecord(rows: TransferRow[], fileName: string, createdAt: string): TransferExportRecord {
    const totalAmount = rows.reduce((sum, row) => sum + row.amount, 0);
    if (!rows.length || rows.some(row => validateTransferRow(row).length) || !Number.isSafeInteger(totalAmount)) throw new Error('파일을 만들기 전에 계좌와 금액을 확인해 주세요.');
    return { id: crypto.randomUUID(), createdAt, fileName, rowCount: rows.length, totalAmount,
        rows: JSON.parse(JSON.stringify(rows)) as TransferRow[] };
}

export function compareExportRows(before: TransferRow[], after: TransferRow[]) {
    const old = new Map(before.map(row => [row.rowId, row]));
    const current = new Map(after.map(row => [row.rowId, row]));
    const added = after.filter(row => !old.has(row.rowId));
    const removed = before.filter(row => !current.has(row.rowId));
    const changed = after.flatMap(row => {
        const previous = old.get(row.rowId);
        if (!previous) return [];
        const fields: string[] = [];
        if (previous.amount !== row.amount) fields.push(`금액 ${previous.amount.toLocaleString('ko-KR')} → ${row.amount.toLocaleString('ko-KR')}원`);
        if (previous.bankCode !== row.bankCode || previous.accountNumber !== row.accountNumber || previous.accountHolder !== row.accountHolder) fields.push('입금계좌·예금주');
        if (previous.receiverDisplay !== row.receiverDisplay || previous.senderMemo !== row.senderMemo) fields.push('통장 표시·메모');
        if (previous.adjustmentReason !== row.adjustmentReason) fields.push('변경 사유');
        if (previous.name !== row.name || previous.period !== row.period || previous.groupName !== row.groupName) fields.push('대상 정보');
        return fields.length ? [{ row, fields }] : [];
    });
    const reordered = before.filter(row => current.has(row.rowId)).map(row => row.rowId).join('|') !== after.filter(row => old.has(row.rowId)).map(row => row.rowId).join('|');
    return { added, removed, changed, reordered };
}

export type TransferIssueFilter = 'all' | 'error' | 'account' | 'amount' | 'warning' | 'difference';
export const ISSUE_LABELS: Record<TransferIssueFilter, string> = {
    all: '전체', error: '파일 생성 불가', account: '계좌 확인', amount: '금액 확인', warning: '주의사항', difference: '원본 금액 차이',
};
export function matchesTransferIssue(row: TransferRow, filter: TransferIssueFilter, notes: string[]) {
    const errors = validateTransferRow(row);
    if (filter === 'error') return errors.length > 0;
    if (filter === 'account') return errors.some(error => !error.startsWith('이체금액'));
    if (filter === 'amount') return !Number.isSafeInteger(row.amount) || row.amount <= 0;
    if (filter === 'warning') return notes.length > 0;
    if (filter === 'difference') return originalTransferAmount(row) !== undefined && originalTransferAmount(row) !== row.amount;
    return true;
}

export function transferTotals(rows: TransferRow[]) {
    return rows.reduce((sum, row) => sum + (Number.isFinite(row.amount) ? row.amount : 0), 0);
}
