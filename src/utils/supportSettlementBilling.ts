export type SettlementBillingLike = {
    status?: unknown;
};

export const normalizeSettlementBillingStatus = (value: unknown): string => {
    const raw = String(value ?? '').trim().toLowerCase();
    if (!raw) return '';
    if (raw === '\ud655\uc815') return 'confirmed';
    return raw;
};

export const isPostedSettlementBillingStatus = (status: unknown): boolean => (
    ['confirmed', 'paid', 'overdue'].includes(normalizeSettlementBillingStatus(status))
);

export const selectPreferredSettlementBillings = <T extends SettlementBillingLike>(
    docs: T[],
    additionalPosted?: (doc: T) => boolean
): T[] => {
    if (!Array.isArray(docs) || docs.length === 0) return [];

    const posted = docs.filter((doc) => isPostedSettlementBillingStatus(doc.status));
    if (posted.length > 0) return posted;

    return additionalPosted
        ? docs.filter((doc) => Boolean(additionalPosted(doc)))
        : docs;
};
