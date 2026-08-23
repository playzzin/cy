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
    additionalPosted?: (doc: T) => boolean,
    getGroupKey?: (doc: T) => unknown,
    getScopeKey?: (doc: T) => unknown
): T[] => {
    if (!Array.isArray(docs) || docs.length === 0) return [];

    // Posted documents supersede an automatic ledger draft only for the same
    // billing source. Applying that preference to an entire team/month would
    // make an unrelated posted vehicle/card/accommodation hide every other
    // asset's newly saved draft from settlement.
    if (getGroupKey) {
        const groups = new Map<string, T[]>();
        docs.forEach((doc, index) => {
            const rawKey = String(getGroupKey(doc) ?? '').trim();
            // An unknown identity must never be grouped with another unknown
            // document: that could silently drop a legitimate expense.
            const key = rawKey || `__ungrouped__:${index}`;
            const group = groups.get(key) ?? [];
            group.push(doc);
            groups.set(key, group);
        });
        return Array.from(groups.values()).flatMap((group) => {
            if (!getScopeKey) return selectPreferredSettlementBillings(group, additionalPosted);

            // A posted legacy document without a row marker represents the
            // whole asset/recipient envelope and supersedes its scoped drafts.
            const unscopedPosted = group.filter((doc) => (
                isPostedSettlementBillingStatus(doc.status) &&
                !String(getScopeKey(doc) ?? '').trim()
            ));
            if (unscopedPosted.length > 0) return unscopedPosted;

            // Once a modern row-scoped ledger document exists, an unscoped
            // automatic DRAFT is the legacy envelope it replaced. Keeping
            // both would double the same expense until the physical cleanup
            // migration runs. Manual drafts are already excluded by the
            // additionalPosted predicate in the recursive selection below.
            const hasScopedDocument = group.some((doc) => (
                Boolean(String(getScopeKey(doc) ?? '').trim())
            ));
            const candidates = hasScopedDocument
                ? group.filter((doc) => Boolean(String(getScopeKey(doc) ?? '').trim()))
                : group;

            const scopeGroups = new Map<string, T[]>();
            candidates.forEach((doc) => {
                const scope = String(getScopeKey(doc) ?? '').trim() || '__unscoped__';
                const scoped = scopeGroups.get(scope) ?? [];
                scoped.push(doc);
                scopeGroups.set(scope, scoped);
            });
            return Array.from(scopeGroups.values()).flatMap((scoped) => (
                selectPreferredSettlementBillings(scoped, additionalPosted)
            ));
        });
    }

    const posted = docs.filter((doc) => isPostedSettlementBillingStatus(doc.status));
    if (posted.length > 0) return posted;

    return additionalPosted
        ? docs.filter((doc) => Boolean(additionalPosted(doc)))
        : docs;
};

export const getSettlementBillingRowScopeKey = (doc: { id?: unknown }): string => {
    const match = /__row_(.+)$/i.exec(String(doc.id ?? '').trim());
    return match?.[1]?.trim() ?? '';
};
