import type { CardBillingCostItem, CardBillingDocument } from '../types/cardBilling';
import { cardBillingService, isPostedCardBillingStatus } from './cardBillingService';
import { isLegacyCardStatementImportBillingDocument } from '../utils/cardStatementDeduplication';

export interface CardMonthlyLedgerAutoBillingRow {
  id: string;
  total: number;
}

export interface CardMonthlyLedgerAutoBillingDependencies<TRow extends CardMonthlyLedgerAutoBillingRow> {
  getBillingDocumentsForRow: (row: TRow) => CardBillingDocument[];
  getAtomicScopeKey?: (row: TRow) => string;
  buildBillingDocumentForRow: (
    row: TRow,
    existingDraft?: CardBillingDocument
  ) => CardBillingDocument | null;
  replaceDraftBilling: (billing: CardBillingDocument, staleBillingIds: string[]) => Promise<void>;
  deleteDraftBillings: (billingIds: string[]) => Promise<void>;
}

export interface CardMonthlyLedgerAutoBillingFailure {
  rowId: string;
  operation: 'upsert' | 'delete';
  message: string;
}

export interface CardMonthlyLedgerAutoBillingResult {
  upsertedCount: number;
  deletedCount: number;
  protectedCount: number;
  missingTargetCount: number;
  unchangedCount: number;
  failures: CardMonthlyLedgerAutoBillingFailure[];
}

const normalizeStatus = (value: unknown): string => String(value ?? '').trim().toUpperCase();
const normalizeKey = (value: unknown): string => String(value ?? '').trim();
const isPosted = (document: CardBillingDocument): boolean => (
  isPostedCardBillingStatus(document.status) ||
  ['CONFIRMED', 'PAID', 'OVERDUE'].includes(normalizeStatus(document.status))
);

const uniqueDocuments = (documents: CardBillingDocument[]): CardBillingDocument[] => (
  documents.filter((document, index, list) => (
    Boolean(document.id) && list.findIndex((item) => item.id === document.id) === index
  ))
);

const errorMessage = (error: unknown): string => (
  error instanceof Error ? error.message : String(error)
);

const isCardLedgerOwnedLineItem = (item: CardBillingCostItem): boolean => (
  item.sourceType === 'card_ledger' ||
  Boolean(normalizeKey(item.sourceLedgerRowId)) ||
  Boolean(normalizeKey(item.sourceSegmentId)) ||
  normalizeKey(item.id).startsWith('card-statement__')
);

export const mergeCardLedgerWithPreservedManualLineItems = (
  ledgerLineItems: CardBillingCostItem[],
  existingLineItems: CardBillingCostItem[]
): CardBillingCostItem[] => {
  const merged = new Map<string, CardBillingCostItem>();
  existingLineItems
    .filter((item) => !isCardLedgerOwnedLineItem(item))
    .forEach((item, index) => {
      const id = normalizeKey(item.id);
      merged.set(id || `__manual__:${index}:${normalizeKey(item.label)}`, item);
    });
  ledgerLineItems.forEach((item, index) => {
    const id = normalizeKey(item.id);
    merged.set(id || `__ledger__:${index}:${normalizeKey(item.label)}`, item);
  });
  return Array.from(merged.values());
};

const mergeDraftContextForBuilder = (
  documents: CardBillingDocument[]
): CardBillingDocument | undefined => {
  const first = documents[0];
  if (!first) return undefined;
  return {
    ...first,
    lineItems: documents.flatMap((document) => document.lineItems ?? []),
    statementAttachmentPaths: Array.from(new Set(
      documents.flatMap((document) => document.statementAttachmentPaths ?? []).filter(Boolean)
    )),
    memo: documents.map((document) => normalizeKey(document.memo)).find(Boolean) || first.memo
  };
};

export const isAutoManagedCardLedgerDocument = (document: CardBillingDocument): boolean => {
  const documentId = normalizeKey(document.id);
  if (documentId.includes('__row_')) return true;
  if (isLegacyCardStatementImportBillingDocument(document)) return true;
  return (document.lineItems ?? []).some((item) => (
    item.sourceType === 'card_ledger' ||
    Boolean(normalizeKey(item.sourceLedgerRowId)) ||
    Boolean(normalizeKey(item.sourceSegmentId))
  ));
};

export const isAutoManagedCardLedgerDraft = (document: CardBillingDocument): boolean => (
  normalizeStatus(document.status) === 'DRAFT' && isAutoManagedCardLedgerDocument(document)
);

export interface CardLedgerOrphanAssignmentRow {
  id: string;
  cardId: string;
  total: number;
}

export interface CardLedgerOrphanAssignmentInput {
  yearMonth: string;
  rows: CardLedgerOrphanAssignmentRow[];
  billings: CardBillingDocument[];
  claimedBillingIds: Set<string>;
  fullyEligibleCardIds: Set<string>;
  isProtectedTarget: (document: CardBillingDocument) => boolean;
}

export interface CardLedgerProtectedOrphanInput {
  yearMonth: string;
  billings: CardBillingDocument[];
  claimedBillingIds: Set<string>;
  currentCardIds: Set<string>;
  isProtectedTarget: (document: CardBillingDocument) => boolean;
}

export const getCardIdsWithProtectedOrphanBillings = ({
  yearMonth,
  billings,
  claimedBillingIds,
  currentCardIds,
  isProtectedTarget
}: CardLedgerProtectedOrphanInput): Set<string> => {
  const blockedCardIds = new Set<string>();
  billings.forEach((document) => {
    const cardId = normalizeKey(document.cardId);
    if (!cardId || !currentCardIds.has(cardId)) return;
    if (normalizeKey(document.yearMonth) !== normalizeKey(yearMonth)) return;
    if (claimedBillingIds.has(document.id)) return;
    if (!isAutoManagedCardLedgerDocument(document)) return;
    if (
      isPosted(document) ||
      (normalizeStatus(document.status) === 'DRAFT' && isProtectedTarget(document))
    ) blockedCardIds.add(cardId);
  });
  return blockedCardIds;
};

export const excludeProtectedOrphanCardRows = <TRow>(
  rows: TRow[],
  blockedCardIds: Set<string>,
  getCardId: (row: TRow) => unknown
): TRow[] => rows.filter((row) => !blockedCardIds.has(normalizeKey(getCardId(row))));

/**
 * Finds DRAFTs left behind when a billing target or split period changed.
 * An orphan is assigned to one deterministic owner row for that card so the
 * normal replacement transaction can delete the stale draft atomically while
 * writing the new row document. Cards with any blocked row are excluded by the
 * caller through fullyEligibleCardIds.
 */
export const assignCardLedgerOrphanDrafts = ({
  yearMonth,
  rows,
  billings,
  claimedBillingIds,
  fullyEligibleCardIds,
  isProtectedTarget
}: CardLedgerOrphanAssignmentInput): Map<string, CardBillingDocument[]> => {
  const rowsByCardId = new Map<string, CardLedgerOrphanAssignmentRow[]>();
  rows.forEach((row) => {
    const cardId = normalizeKey(row.cardId);
    if (!cardId || !fullyEligibleCardIds.has(cardId)) return;
    const cardRows = rowsByCardId.get(cardId) ?? [];
    cardRows.push(row);
    rowsByCardId.set(cardId, cardRows);
  });

  const ownerByCardId = new Map<string, CardLedgerOrphanAssignmentRow>();
  rowsByCardId.forEach((cardRows, cardId) => {
    ownerByCardId.set(cardId, cardRows.find((row) => Number(row.total ?? 0) > 0) ?? cardRows[0]);
  });

  const assignments = new Map<string, CardBillingDocument[]>();
  billings.forEach((document) => {
    const cardId = normalizeKey(document.cardId);
    const owner = ownerByCardId.get(cardId);
    if (!owner) return;
    if (normalizeKey(document.yearMonth) !== normalizeKey(yearMonth)) return;
    if (claimedBillingIds.has(document.id)) return;
    if (!isAutoManagedCardLedgerDraft(document)) return;
    if (isProtectedTarget(document)) return;

    const ownerDrafts = assignments.get(owner.id) ?? [];
    ownerDrafts.push(document);
    assignments.set(owner.id, ownerDrafts);
  });
  return assignments;
};

const defaultWriteDependencies = {
  replaceDraftBilling: (billing: CardBillingDocument, staleBillingIds: string[]) => (
    cardBillingService.replaceDraftBilling(billing, staleBillingIds)
  ),
  deleteDraftBillings: (billingIds: string[]) => cardBillingService.deleteDraftBillings(billingIds)
};

/**
 * Reconciles only rows that have already been read back from Firestore after a
 * ledger save. Each positive row deterministically replaces its DRAFT billing;
 * a zero row removes only associated DRAFT documents. Posted documents are
 * never mutated. Every write is retry-safe, so a partially failed save can be
 * retried by pressing Save again without adding the amount twice.
 */
export const reconcileSavedCardLedgerBillings = async <TRow extends CardMonthlyLedgerAutoBillingRow>(
  rows: TRow[],
  dependencies: Pick<
    CardMonthlyLedgerAutoBillingDependencies<TRow>,
    'getBillingDocumentsForRow' | 'buildBillingDocumentForRow' | 'getAtomicScopeKey'
  > & Partial<Pick<
    CardMonthlyLedgerAutoBillingDependencies<TRow>,
    'replaceDraftBilling' | 'deleteDraftBillings'
  >>
): Promise<CardMonthlyLedgerAutoBillingResult> => {
  const replaceDraftBilling = dependencies.replaceDraftBilling ?? defaultWriteDependencies.replaceDraftBilling;
  const deleteDraftBillings = dependencies.deleteDraftBillings ?? defaultWriteDependencies.deleteDraftBillings;
  const result: CardMonthlyLedgerAutoBillingResult = {
    upsertedCount: 0,
    deletedCount: 0,
    protectedCount: 0,
    missingTargetCount: 0,
    unchangedCount: 0,
    failures: []
  };
  const failedScopeKeys = new Set<string>();

  for (const row of rows) {
    const scopeKey = normalizeKey(dependencies.getAtomicScopeKey?.(row)) || row.id;
    if (failedScopeKeys.has(scopeKey)) {
      result.failures.push({
        rowId: row.id,
        operation: Number(row.total ?? 0) <= 0 ? 'delete' : 'upsert',
        message: 'card-billing-scope-prerequisite-failed'
      });
      continue;
    }
    const documents = uniqueDocuments(dependencies.getBillingDocumentsForRow(row));
    if (documents.some(isPosted)) {
      result.protectedCount += 1;
      continue;
    }

    const draftDocuments = documents.filter((document) => normalizeStatus(document.status) === 'DRAFT');
    const draftIds = draftDocuments.map((document) => document.id);

    if (Number(row.total ?? 0) <= 0) {
      if (draftIds.length === 0) {
        result.unchangedCount += 1;
        continue;
      }

      const draftContext = mergeDraftContextForBuilder(draftDocuments);
      const preservedManualLineItems = mergeCardLedgerWithPreservedManualLineItems(
        [],
        draftContext?.lineItems ?? []
      );
      if (draftContext && preservedManualLineItems.length > 0) {
        const next = dependencies.buildBillingDocumentForRow(row, {
          ...draftContext,
          lineItems: preservedManualLineItems
        });
        if (!next) {
          // A target that can no longer be resolved is not permission to
          // delete a user's manual adjustment. Leave the existing drafts in
          // place and require target repair before retrying Save.
          result.missingTargetCount += 1;
          continue;
        }
        const staleDraftIds = draftIds.filter((id) => id !== next.id);
        try {
          await replaceDraftBilling({ ...next, status: 'DRAFT' }, staleDraftIds);
          result.upsertedCount += 1;
        } catch (error) {
          result.failures.push({ rowId: row.id, operation: 'upsert', message: errorMessage(error) });
          failedScopeKeys.add(scopeKey);
        }
        continue;
      }

      try {
        await deleteDraftBillings(draftIds);
        result.deletedCount += draftIds.length;
      } catch (error) {
        result.failures.push({ rowId: row.id, operation: 'delete', message: errorMessage(error) });
        failedScopeKeys.add(scopeKey);
      }
      continue;
    }

    const next = dependencies.buildBillingDocumentForRow(row, mergeDraftContextForBuilder(draftDocuments));
    if (!next) {
      result.missingTargetCount += 1;
      continue;
    }

    const staleDraftIds = draftIds.filter((id) => id !== next.id);
    try {
      await replaceDraftBilling({ ...next, status: 'DRAFT' }, staleDraftIds);
      result.upsertedCount += 1;
    } catch (error) {
      result.failures.push({ rowId: row.id, operation: 'upsert', message: errorMessage(error) });
      failedScopeKeys.add(scopeKey);
    }
  }

  return result;
};

export const cardMonthlyLedgerAutoBillingService = {
  reconcileSavedBillings: reconcileSavedCardLedgerBillings
};
