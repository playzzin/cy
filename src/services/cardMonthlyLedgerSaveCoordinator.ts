import type { CardBillingDocument } from '../types/cardBilling';
import type { CardMonthlyLedgerMutationRow, CardMonthlyLedgerSaveInput, CardMonthlyLedgerSaveResult } from './cardMonthlyLedgerMutationService';
import type { CardMonthlyLedgerAutoBillingDependencies, CardMonthlyLedgerAutoBillingResult, CardLedgerOrphanAssignmentInput, CardLedgerProtectedOrphanInput } from './cardMonthlyLedgerAutoBillingService';
import type { ConfirmedTeamSettlementKeys, TeamSettlementTargetIdentity } from './teamSettlementProtectionService';

export interface CardSaveRow extends CardMonthlyLedgerMutationRow { total: number; }
export interface CardSaveSnapshot<TRow extends CardSaveRow> { rows: TRow[]; billings: CardBillingDocument[]; }
export interface CardSaveDependencies<TRow extends CardSaveRow> {
    saveMonthlyLedger: (input: CardMonthlyLedgerSaveInput<TRow>) => Promise<CardMonthlyLedgerSaveResult>;
    loadPersistedSnapshot: (options: { strictBillingRead: true }) => Promise<CardSaveSnapshot<TRow> | null>;
    onLedgerSaved: () => void;
    getConfirmedTeamSettlementKeys: (yearMonth: string) => Promise<ConfirmedTeamSettlementKeys>;
    isConfirmedTarget: (keys: ConfirmedTeamSettlementKeys, target: TeamSettlementTargetIdentity) => boolean;
    resolveCardBillingTarget: (row: TRow) => { teamId: string; teamName: string } | null;
    getAllBillingDocumentsForRow: (row: TRow, documents: CardBillingDocument[]) => CardBillingDocument[];
    buildBillingDocumentForRow: CardMonthlyLedgerAutoBillingDependencies<TRow>['buildBillingDocumentForRow'];
    getCardLedgerStructureFingerprint: (row: TRow) => string;
    normalizeKey: (value: unknown) => string;
    getCardIdsWithProtectedOrphanBillings: (input: CardLedgerProtectedOrphanInput) => Set<string>;
    assignCardLedgerOrphanDrafts: (input: CardLedgerOrphanAssignmentInput) => Map<string, CardBillingDocument[]>;
    reconcileSavedBillings: (rows: TRow[], dependencies: CardMonthlyLedgerAutoBillingDependencies<TRow>) => Promise<CardMonthlyLedgerAutoBillingResult>;
    replaceDraftBilling: CardMonthlyLedgerAutoBillingDependencies<TRow>['replaceDraftBilling'];
    deleteDraftBillings: CardMonthlyLedgerAutoBillingDependencies<TRow>['deleteDraftBillings'];
    reportDiagnostic: (error: unknown) => void;
}
export interface CardSaveInput<TRow extends CardSaveRow> {
    ledgerInput: CardMonthlyLedgerSaveInput<TRow>;
    eligibleRowIds: Set<string>;
    allRowsByCardId: Map<string, TRow[]>;
    sourceFullyEligibleCardIds: Set<string>;
}
export type CardSaveOutcome<TRow extends CardSaveRow> = {
    status: 'partial';
    stage: 'stored-read' | 'billing' | 'final-read';
    result: CardMonthlyLedgerSaveResult;
    error: unknown;
    autoBillingResult?: CardMonthlyLedgerAutoBillingResult;
} | {
    status: 'snapshot-unavailable';
    result: CardMonthlyLedgerSaveResult;
} | {
    status: 'settlement-unavailable';
    result: CardMonthlyLedgerSaveResult;
} | {
    status: 'completed';
    result: CardMonthlyLedgerSaveResult;
    autoBillingResult: CardMonthlyLedgerAutoBillingResult;
    finalSnapshot: CardSaveSnapshot<TRow> | null;
    postSaveSettlementProtectedRowIds: Set<string>;
    postSaveProtectedOrphanCardIds: Set<string>;
    postSaveStructureChangedCardIds: Set<string>;
};

/** Ledger response is not a durable receipt or financial confirmation. No SDK defaults. */
export const saveCardMonthlyLedger = async <TRow extends CardSaveRow>(
    input: CardSaveInput<TRow>, dependencies: CardSaveDependencies<TRow>
): Promise<CardSaveOutcome<TRow>> => {
    const { ledgerInput, eligibleRowIds, allRowsByCardId, sourceFullyEligibleCardIds } = input;
    const { yearMonth } = ledgerInput;
    const { saveMonthlyLedger, loadPersistedSnapshot, onLedgerSaved, getConfirmedTeamSettlementKeys,
        isConfirmedTarget, resolveCardBillingTarget, getAllBillingDocumentsForRow, buildBillingDocumentForRow,
        getCardLedgerStructureFingerprint, normalizeKey, getCardIdsWithProtectedOrphanBillings,
        assignCardLedgerOrphanDrafts, reconcileSavedBillings, replaceDraftBilling, deleteDraftBillings,
        reportDiagnostic } = dependencies;
    // Preserve the original rejection object; do not read or bill after ledger rejection.
    const result = await saveMonthlyLedger(ledgerInput);
    let stage: 'stored-read' | 'billing' | 'final-read' = 'stored-read';
    let completedAutoBillingResult: CardMonthlyLedgerAutoBillingResult | undefined;
    try {
    onLedgerSaved();
    const persistedSnapshot = await loadPersistedSnapshot({ strictBillingRead: true });
    if (!persistedSnapshot) return { status: 'snapshot-unavailable', result };
    stage = 'billing';
            const postSaveRowsByCardId = new Map<string, TRow[]>();
            persistedSnapshot.rows.forEach((row) => {
                const cardId = normalizeKey(row.card.id);
                const cardRows = postSaveRowsByCardId.get(cardId) ?? [];
                cardRows.push(row);
                postSaveRowsByCardId.set(cardId, cardRows);
            });
            const postSaveStructureChangedCardIds = new Set<string>();
            sourceFullyEligibleCardIds.forEach((cardId) => {
                const beforeFingerprints = (allRowsByCardId.get(cardId) ?? [])
                    .map(getCardLedgerStructureFingerprint)
                    .sort();
                const afterFingerprints = (postSaveRowsByCardId.get(cardId) ?? [])
                    .map(getCardLedgerStructureFingerprint)
                    .sort();
                if (JSON.stringify(beforeFingerprints) !== JSON.stringify(afterFingerprints)) {
                    postSaveStructureChangedCardIds.add(cardId);
                }
            });
            const persistedEligibleRows = persistedSnapshot.rows.filter((row) => (
                eligibleRowIds.has(row.id) &&
                !postSaveStructureChangedCardIds.has(normalizeKey(row.card.id))
            ));
    let postSaveConfirmedSettlementKeys: ConfirmedTeamSettlementKeys;
    try {
        postSaveConfirmedSettlementKeys = await getConfirmedTeamSettlementKeys(yearMonth);
    } catch (error) {
        try { reportDiagnostic(error); } catch { /* Diagnostics cannot replace the ledger outcome. */ }
        return { status: 'settlement-unavailable', result };
    }
            const postSaveSettlementProtectedRowIds = new Set(
                persistedEligibleRows
                    .filter((row) => {
                        const target = resolveCardBillingTarget(row);
                        return Boolean(target && isConfirmedTarget(
                            postSaveConfirmedSettlementKeys,
                            { teamId: target.teamId, teamName: target.teamName }
                        ));
                    })
                    .map((row) => row.id)
            );
            const candidateAutoBillingRows = persistedEligibleRows.filter((row) => (
                !postSaveSettlementProtectedRowIds.has(row.id)
            ));
            const claimedBillingIds = new Set(
                persistedSnapshot.rows.flatMap((row) => (
                    getAllBillingDocumentsForRow(row, persistedSnapshot.billings)
                        .map((document) => document.id)
                        .filter(Boolean)
                ))
            );
            const postSaveProtectedOrphanCardIds = getCardIdsWithProtectedOrphanBillings({
                yearMonth,
                billings: persistedSnapshot.billings,
                claimedBillingIds,
                currentCardIds: new Set(
                    candidateAutoBillingRows.map((row) => normalizeKey(row.card.id)).filter(Boolean)
                ),
                isProtectedTarget: (document) => isConfirmedTarget(
                    postSaveConfirmedSettlementKeys,
                    { teamId: document.teamId, teamName: document.teamName }
                )
            });
            const autoBillingRows = candidateAutoBillingRows.filter((row) => (
                !postSaveProtectedOrphanCardIds.has(normalizeKey(row.card.id))
            ));
            const autoBillingRowIds = new Set(autoBillingRows.map((row) => row.id));
            const persistedRowsByCardId = new Map<string, TRow[]>();
            persistedSnapshot.rows.forEach((row) => {
                const cardId = normalizeKey(row.card.id);
                const cardRows = persistedRowsByCardId.get(cardId) ?? [];
                cardRows.push(row);
                persistedRowsByCardId.set(cardId, cardRows);
            });
            const fullyEligibleCardIds = new Set<string>();
            persistedRowsByCardId.forEach((cardRows, cardId) => {
                if (cardRows.length > 0 && cardRows.every((row) => autoBillingRowIds.has(row.id))) {
                    fullyEligibleCardIds.add(cardId);
                }
            });
            const orphanDraftsByOwnerRowId = assignCardLedgerOrphanDrafts({
                yearMonth,
                rows: autoBillingRows.map((row) => ({
                    id: row.id,
                    cardId: row.card.id,
                    total: row.total
                })),
                billings: persistedSnapshot.billings,
                claimedBillingIds,
                fullyEligibleCardIds,
                isProtectedTarget: (document) => isConfirmedTarget(
                    postSaveConfirmedSettlementKeys,
                    { teamId: document.teamId, teamName: document.teamName }
                )
            });
            stage = 'billing';
            const autoBillingResult = await reconcileSavedBillings(
                autoBillingRows,
                {
                    getAtomicScopeKey: (row) => normalizeKey(row.card.id),
                    getBillingDocumentsForRow: (row) => {
                        const documents = [
                            ...getAllBillingDocumentsForRow(row, persistedSnapshot.billings),
                            ...(orphanDraftsByOwnerRowId.get(row.id) ?? [])
                        ];
                        return documents.filter((document, index, list) => (
                            Boolean(document.id) && list.findIndex((item) => item.id === document.id) === index
                        ));
                    },
                    buildBillingDocumentForRow,
                    replaceDraftBilling,
                    deleteDraftBillings
                }
            );
    completedAutoBillingResult = autoBillingResult;
    stage = 'final-read';
    const finalSnapshot = await loadPersistedSnapshot({ strictBillingRead: true });
    return { status: 'completed', result, autoBillingResult, finalSnapshot,
        postSaveSettlementProtectedRowIds, postSaveProtectedOrphanCardIds, postSaveStructureChangedCardIds };
    } catch (error) {
        try { reportDiagnostic(error); } catch { /* Keep the original business outcome. */ }
        return { status: 'partial', stage, result, error, autoBillingResult: completedAutoBillingResult };
    }
};
