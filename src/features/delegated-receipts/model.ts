export type PaymentMethod = 'transfer' | 'cash' | 'other' | 'unknown';
export type DelegationType = 'delegate' | 'direct' | 'unknown';
export type ReceiptStatus = 'unconfirmed' | 'unpaid' | 'partial' | 'paid' | 'overpaid';
export type DepositStatus = 'unknown' | 'pending' | 'partial' | 'complete';
export type RecipientKind = 'unknown' | 'personal' | 'site_leader' | 'jaewook_leader';
export type ClaimListChange =
    | { field: 'delegation'; value: DelegationType }
    | { field: 'recipient'; value: RecipientKind }
    | { field: 'status'; value: DepositStatus };
export interface ClaimListEdit { id: string; recordedAt: string; change: ClaimListChange; }
export interface DepositConfirmation {
    id: string;
    status: DepositStatus;
    recipient: RecipientKind;
    note: string;
    recordedAt: string;
    actorId?: string;
    listChange?: ClaimListChange;
}

export interface Receipt {
    id: string;
    amount: number;
    date: string;
    method: PaymentMethod;
    memo: string;
    createdAt: string;
}

export interface DelegatedClaim {
    id: string;
    month: string;
    siteName: string;
    workerName: string;
    delegationType: DelegationType;
    delegationOverride?: DelegationType;
    paymentMethod: PaymentMethod;
    grossAmount: number | null;
    expectedAmount: number | null;
    taxRate?: number | null;
    taxAmount?: number | null;
    receipts: Receipt[];
    sourceStatus: string;
    sourceLabel: string;
    sourceWorkbookId?: string;
    confirmation?: DepositConfirmation;
    confirmationHistory?: DepositConfirmation[];
    assignedTeamId?: string;
    memo: string;
    updatedAt: string;
}

export interface ClaimFilters {
    month?: string;
    siteName?: string;
    worker?: string;
    paymentMethod?: string;
    delegationType?: string;
    status?: string;
}

const isMoney = (value: unknown): value is number =>
    typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

/** 세율은 사용자가 지정한다. 계산한 세금은 가장 가까운 원으로 반올림한다. */
export function calculateExpectedAmount(gross: number, taxRate: number): { taxAmount: number; expectedAmount: number } {
    if (!isMoney(gross)) throw new Error('세전 금액은 0 이상의 원 단위 정수로 입력해 주세요.');
    if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
        throw new Error('세율은 0부터 100 사이의 숫자로 입력해 주세요.');
    }
    const taxAmount = Math.round(gross * (taxRate / 100));
    return { taxAmount, expectedAmount: gross - taxAmount };
}

export function getClaimTotals(claim: DelegatedClaim): {
    received: number;
    remaining: number | null;
    overpaid: number;
    status: ReceiptStatus;
} {
    const received = claim.receipts.reduce((sum, receipt) => sum + (isMoney(receipt.amount) ? receipt.amount : 0), 0);
    if (!isMoney(claim.expectedAmount)) return { received, remaining: null, overpaid: 0, status: 'unconfirmed' };
    const remaining = Math.max(0, claim.expectedAmount - received);
    const overpaid = Math.max(0, received - claim.expectedAmount);
    const status: ReceiptStatus = overpaid > 0 ? 'overpaid'
        : remaining === 0 ? 'paid'
            : received > 0 ? 'partial' : 'unpaid';
    return { received, remaining, overpaid, status };
}

export function summarizeClaims(claims: DelegatedClaim[]): {
    expected: number;
    received: number;
    remaining: number;
    overpaid: number;
    unconfirmed: number;
    count: number;
} {
    return claims.reduce((summary, claim) => {
        const totals = getClaimTotals(claim);
        return {
            expected: summary.expected + (isMoney(claim.expectedAmount) ? claim.expectedAmount : 0),
            received: summary.received + totals.received,
            remaining: summary.remaining + (totals.remaining ?? 0),
            overpaid: summary.overpaid + totals.overpaid,
            unconfirmed: summary.unconfirmed + (totals.status === 'unconfirmed' ? 1 : 0),
            count: summary.count + 1,
        };
    }, { expected: 0, received: 0, remaining: 0, overpaid: 0, unconfirmed: 0, count: 0 });
}

function normalizeSearch(value: string): string {
    return value.normalize('NFKC').replace(/\s+/g, '').toLocaleLowerCase();
}

const isActiveFilter = (value: string | undefined) => Boolean(value && value !== 'all');

export function filterClaims(claims: DelegatedClaim[], filters: ClaimFilters): DelegatedClaim[] {
    return claims.filter(claim => {
        if (isActiveFilter(filters.month) && claim.month !== filters.month) return false;
        if (isActiveFilter(filters.siteName) && claim.siteName !== filters.siteName) return false;
        if (filters.worker?.trim() && !normalizeSearch(claim.workerName).includes(normalizeSearch(filters.worker))) return false;
        if (isActiveFilter(filters.paymentMethod) && claim.paymentMethod !== filters.paymentMethod) return false;
        if (isActiveFilter(filters.delegationType) && claim.delegationType !== filters.delegationType) return false;
        if (isActiveFilter(filters.status) && getClaimTotals(claim).status !== filters.status) return false;
        return true;
    });
}

/** 반복 가져오기는 기존의 사용자 확정액과 입금내역을 덮어쓰지 않는다. */
export function mergeImportedClaims(existing: DelegatedClaim[], incoming: DelegatedClaim[]): {
    claims: DelegatedClaim[];
    added: number;
    skipped: number;
} {
    const claims = [...existing];
    const ids = new Set(existing.map(claim => claim.id));
    let added = 0;
    let skipped = 0;
    for (const claim of incoming) {
        if (ids.has(claim.id)) {
            skipped += 1;
        } else {
            claims.push(claim);
            ids.add(claim.id);
            added += 1;
        }
    }
    return { claims, added, skipped };
}
