import { DelegatedClaim, DelegationType, DepositStatus, RecipientKind, getClaimTotals } from './model';

export const depositLabels: Record<DepositStatus, string> = {
    unknown: '확인 필요', pending: '입금 전', partial: '일부 입금', complete: '입금완료',
};
export const recipientLabels: Record<RecipientKind, string> = {
    unknown: '받는 계좌 확인 필요', personal: '작업자 개인통장',
    site_leader: '현장 팀장계좌', jaewook_leader: '이재욱팀 팀장계좌',
};

/** 이전 가져오기의 안내 접미사는 원본 문구가 아니다. 원본은 그대로 보존한다. */
export function sourceText(value: string): string {
    return value.replace(/^그룹 표시 [A-Z]+\d+(?::[A-Z]+\d+)?:?\s*/, '')
        .replace(/\s*\(개별 확인 필요\)$/, '').trim();
}

export function interpretSource(value: string): { status: DepositStatus; recipient: RecipientKind; delegation: DelegationType; grouped: boolean } {
    const raw = sourceText(value);
    const compact = raw.replace(/\s+/g, '');
    const ambiguous = /[?？]|확인필요|미확인|여부|취소|아님|안함|입금완료전|미완료|입금완료예정/.test(compact);
    const pending = /입금전|미입금|입금안됨|입금예정|입금대기/.test(compact);
    const status: DepositStatus = ambiguous ? 'unknown' : pending ? 'pending'
        : /일부입금|부분입금|분할입금/.test(compact) ? 'partial'
            : /입금완료/.test(compact) ? 'complete' : 'unknown';
    const delegate = /위임/.test(compact) && !/미위임|비위임|위임안|위임X|위임여부/.test(compact);
    const direct = /직불|직접입금/.test(compact) && !/미직불|직불아님|직불여부/.test(compact);
    const recipient: RecipientKind = /개인통장|개인계좌/.test(compact) ? 'personal'
        : /이재욱/.test(compact) && (delegate || /팀장|계좌|통장/.test(compact)) ? 'jaewook_leader'
            : /팀장/.test(compact) || (delegate && /^[가-힣]{2,5}\s+위임/.test(raw) && !/^위임\s/.test(raw)) ? 'site_leader' : 'unknown';
    return { status, recipient, delegation: ambiguous || delegate === direct ? 'unknown' : delegate ? 'delegate' : 'direct', grouped: value.startsWith('그룹 표시 ') };
}

export function getDepositState(claim: DelegatedClaim): { status: DepositStatus; recipient: RecipientKind; basis: string } {
    if (claim.confirmation) return { ...claim.confirmation, basis: '직접 확인' };
    const source = interpretSource(claim.sourceStatus);
    if (source.status !== 'unknown') return { ...source, basis: source.grouped ? '엑셀 공동 표시' : '엑셀 표시' };
    const totals = getClaimTotals(claim);
    const status = totals.received > 0 ? (totals.status === 'paid' || totals.status === 'overpaid' ? 'complete' : 'partial') : 'unknown';
    return { status, recipient: source.recipient, basis: status === 'unknown' ? '확인 필요' : '입금 기록 기준' };
}

export function getDelegation(claim: DelegatedClaim): DelegationType {
    return claim.delegationOverride ?? (claim.delegationType === 'unknown' ? interpretSource(claim.sourceStatus).delegation : claim.delegationType);
}

/** 완료 표시는 은행 거래액을 만들지 않는다. 미기록된 완료 건의 잔액은 추정하지 않는다. */
export function getDisplayRemaining(claim: DelegatedClaim): number | null {
    const total = getClaimTotals(claim);
    return getDepositState(claim).status === 'complete' && total.remaining !== 0 ? null : total.remaining;
}
