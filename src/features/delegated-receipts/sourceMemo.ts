import type { DelegatedClaim } from './model';
import { depositLabels, getDelegation, getDepositState, interpretSource, recipientLabel, sourceText } from './depositState';

/** Keep free text intact when the account/status controls cannot express it. */
export function sourceImportMemo(status: string): string {
    const raw = sourceText(status);
    if (!raw) return '';
    const compact = raw.replace(/\s+/g, '');
    const standard = /^(?:(?:개인(?:통장|계좌)|(?:현장(?:담당)?)?팀장(?:계좌|통장)?|이재욱(?:팀장|팀)?(?:위임|계좌|통장)?|위임|직불|직접입금))?(?:입금완료|입금전|미입금|입금안됨|입금예정|입금대기|일부입금|부분입금|분할입금)?$/;
    return standard.test(compact) ? '' : `엑셀 원문 메모: ${raw}`;
}

/** Compare only facts present in the source; blank fields are not inferred. */
export function reconcileWorkbookMemo(current: DelegatedClaim, source: DelegatedClaim): string {
    const notes = [sourceImportMemo(source.sourceStatus)];
    const original = interpretSource(source.sourceStatus);
    const state = getDepositState(current);
    if (original.recipient !== 'unknown' && state.recipient !== original.recipient) {
        notes.push(`엑셀 대조 · 받는 계좌: 원본 ${recipientLabel(original.recipient)} / 현재 ${recipientLabel(state.recipient)}`);
    }
    if (original.status !== 'unknown' && state.status !== original.status) {
        notes.push(`엑셀 대조 · 입금여부: 원본 ${depositLabels[original.status]} / 현재 ${depositLabels[state.status]}`);
    }
    const labels = { delegate: '위임', direct: '직불', unknown: '미확인' };
    const delegation = getDelegation(current);
    if (original.delegation !== 'unknown' && delegation !== original.delegation) {
        notes.push(`엑셀 대조 · 입금방법: 원본 ${labels[original.delegation]} / 현재 ${labels[delegation]}`);
    }
    const won = (value: number | null) => value === null ? '미확정' : `${value.toLocaleString('ko-KR')}원`;
    if (source.grossAmount !== null && current.grossAmount !== source.grossAmount) {
        notes.push(`엑셀 대조 · 세전 금액: 원본 ${won(source.grossAmount)} / 현재 ${won(current.grossAmount)}`);
    }
    if (source.expectedAmount !== null && current.expectedAmount !== source.expectedAmount) {
        notes.push(`엑셀 대조 · 세후 금액: 원본 ${won(source.expectedAmount)} / 현재 ${won(current.expectedAmount)}`);
    }
    if (sourceText(current.sourceStatus) !== sourceText(source.sourceStatus)) {
        notes.push(`엑셀 대조 · 입금표시 원문: ${sourceText(source.sourceStatus) || '(빈칸)'}`);
    }
    return [current.memo, ...notes.filter(note => note && !current.memo.includes(note))].filter(Boolean).join('\n');
}
