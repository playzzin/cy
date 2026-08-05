import { cardService } from './cardService';
import { cardBillingService, isPostedCardBillingStatus } from './cardBillingService';
import { supportWriteOperationLogService } from './supportWriteOperationLogService';
import { getErrorMessage, reportSupportWriteError, SUPPORT_WRITE_RETRY_USER_MESSAGE } from '../utils/supportWriteErrorReporting';
import type { Card, CardTransaction, CardTransactionCategory } from '../types/card';
import type { CardBillingDocument } from '../types/cardBilling';
import type { CreateSupportWriteOperationLogInput } from '../types/supportWriteOperation';

const normalizeKey = (value: unknown): string => String(value ?? '').trim();
const POSTED_BILLING_STATUSES = new Set(['CONFIRMED', 'PAID', 'OVERDUE']);

const isPostedBillingDocument = (billing: CardBillingDocument): boolean => (
  isPostedCardBillingStatus(billing.status) ||
  POSTED_BILLING_STATUSES.has(String(billing.status ?? '').trim().toUpperCase())
);

const parseYmdDate = (value?: string | null): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? '').trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
};

export interface CardMonthlyLedgerMutationSegment {
  startDate: string;
  endDate: string;
}

export interface CardMonthlyLedgerMutationRow {
  id: string;
  card: Pick<Card, 'id' | 'name' | 'last4'>;
  segment: CardMonthlyLedgerMutationSegment;
  amounts: Partial<Record<CardTransactionCategory, number>>;
  memo?: string;
}

export interface CardMonthlyLedgerVisibleRow<TRow extends CardMonthlyLedgerMutationRow> {
  row: TRow;
}

export interface CardMonthlyLedgerMutationDependencies {
  applyTransactionChanges: (params: {
    upserts: Array<Partial<CardTransaction> & { id: string }>;
    cancelIds: string[];
    operationId?: string;
  }) => Promise<void>;
  saveBilling: (billing: CardBillingDocument) => Promise<void>;
  recordOperation: (input: CreateSupportWriteOperationLogInput) => Promise<unknown>;
}

export interface CardMonthlyLedgerSaveInput<TRow extends CardMonthlyLedgerMutationRow> {
  yearMonth: string;
  visibleRows: Array<CardMonthlyLedgerVisibleRow<TRow>>;
  originalTransactions: CardTransaction[];
  categories: CardTransactionCategory[];
  getBillingDocumentsForRow: (row: TRow) => CardBillingDocument[];
  buildBillingDocumentForRow: (
    row: TRow,
    existing?: CardBillingDocument
  ) => CardBillingDocument | null;
  operationId?: string;
  dependencies?: Partial<CardMonthlyLedgerMutationDependencies>;
}

export interface CardMonthlyLedgerSkippedBillingRow {
  rowId: string;
  cardId: string;
  cardLabel: string;
  reason: 'posted-billing-protected';
  billingIds: string[];
  statuses: string[];
}

export interface CardMonthlyLedgerSaveResult {
  operationId: string;
  upsertedTransactionCount: number;
  cancelledTransactionCount: number;
  savedBillingCount: number;
  cancelledBillingCount: number;
  skippedBillingCount: number;
  transactionUpsertIds: string[];
  transactionCancelIds: string[];
  billingSaveIds: string[];
  billingCancelIds: string[];
  skippedBillingRows: CardMonthlyLedgerSkippedBillingRow[];
}

const defaultDependencies: CardMonthlyLedgerMutationDependencies = {
  applyTransactionChanges: (params) => cardService.applyCardTransactionChanges(params),
  saveBilling: (billing) => cardBillingService.saveBilling(billing),
  recordOperation: (input) => supportWriteOperationLogService.recordOperation(input)
};

const buildDependencies = (
  dependencies: Partial<CardMonthlyLedgerMutationDependencies> | undefined
): CardMonthlyLedgerMutationDependencies => ({
  ...defaultDependencies,
  ...(dependencies ?? {})
});

const sanitizeIdPart = (value: unknown): string => {
  const text = normalizeKey(value);
  const safe = text
    .replace(/[/#[\]?]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/[^0-9A-Za-z_.:-]/g, '_');
  return safe || 'blank';
};

const buildTransactionId = (
  yearMonth: string,
  row: CardMonthlyLedgerMutationRow,
  category: CardTransactionCategory | 'MEMO'
): string => [
  'card-ledger',
  yearMonth,
  row.card.id,
  row.segment.startDate || `${yearMonth}-01`,
  row.segment.endDate || row.segment.startDate || `${yearMonth}-01`,
  category
].map(sanitizeIdPart).join('__');

const buildDefaultOperationId = (yearMonth: string): string => `card-monthly-ledger:${yearMonth}`;

const uniqueIds = (ids: unknown[]): string[] => Array.from(new Set(
  ids.map((id) => String(id ?? '').trim()).filter(Boolean)
));

const recordOperationSafely = async (
  recordOperation: CardMonthlyLedgerMutationDependencies['recordOperation'],
  input: CreateSupportWriteOperationLogInput
): Promise<void> => {
  try {
    await recordOperation(input);
  } catch (error) {
    console.error('[cardMonthlyLedgerMutationService] operation log failed', {
      operationId: input.operationId,
      status: input.status
    }, error);
  }
};

const validateSaveInput = <TRow extends CardMonthlyLedgerMutationRow>(
  input: Pick<CardMonthlyLedgerSaveInput<TRow>, 'yearMonth' | 'visibleRows' | 'categories'>
): void => {
  if (!/^\d{4}-\d{2}$/.test(String(input.yearMonth ?? '').trim())) {
    throw new Error('invalid-year-month');
  }

  if (input.categories.length === 0) {
    throw new Error('transaction-categories-required');
  }

  input.visibleRows.forEach(({ row }) => {
    if (!normalizeKey(row.card.id)) throw new Error('card-id-required');
    if (!normalizeKey(row.card.name) && !normalizeKey(row.card.last4)) throw new Error('card-label-required');

    const start = parseYmdDate(row.segment.startDate);
    const end = parseYmdDate(row.segment.endDate);
    if (!start || !end || end.getTime() < start.getTime()) {
      throw new Error(`invalid-ledger-period:${row.id}`);
    }

    input.categories.forEach((category) => {
      const amount = row.amounts[category] ?? 0;
      if (!Number.isFinite(amount) || amount < 0) {
        throw new Error(`invalid-transaction-amount:${row.id}:${category}`);
      }
    });
  });
};

const getCardLabel = (row: CardMonthlyLedgerMutationRow): string => (
  `${row.card.name}${row.card.last4 ? `(${row.card.last4})` : ''}`
);

const buildCancelledBillingDocument = (billing: CardBillingDocument): CardBillingDocument => ({
  ...billing,
  status: 'CANCELLED',
  variableCost: 0,
  totalAmount: 0,
  lineItems: [],
  memo: billing.memo
    ? `${billing.memo}\nCancelled by monthly ledger save`
    : 'Cancelled by monthly ledger save'
});

export const saveCardMonthlyLedgerMutation = async <TRow extends CardMonthlyLedgerMutationRow>({
  yearMonth,
  visibleRows,
  originalTransactions,
  categories,
  getBillingDocumentsForRow,
  buildBillingDocumentForRow,
  operationId,
  dependencies
}: CardMonthlyLedgerSaveInput<TRow>): Promise<CardMonthlyLedgerSaveResult> => {
  const deps = buildDependencies(dependencies);
  const resolvedOperationId = operationId || buildDefaultOperationId(yearMonth);
  let attemptedAffectedDocumentIds: string[] = [];

  try {
  validateSaveInput({ yearMonth, visibleRows, categories });

  const preparedRows = visibleRows.map(({ row }) => {
    const documents = getBillingDocumentsForRow(row);
    const postedDocuments = documents.filter(isPostedBillingDocument);
    return { row, documents, postedDocuments };
  });

  const skippedBillingRows = preparedRows
    .filter((item) => item.postedDocuments.length > 0)
    .map((item): CardMonthlyLedgerSkippedBillingRow => ({
      rowId: item.row.id,
      cardId: item.row.card.id,
      cardLabel: getCardLabel(item.row),
      reason: 'posted-billing-protected',
      billingIds: item.postedDocuments.map((doc) => doc.id).filter(Boolean),
      statuses: Array.from(new Set(item.postedDocuments.map((doc) => String(doc.status ?? '')).filter(Boolean)))
    }));

  const rowsToProcess = preparedRows.filter((item) => item.postedDocuments.length === 0);

  const visibleScopes = rowsToProcess.map(({ row }) => ({
    cardId: normalizeKey(row.card.id),
    start: parseYmdDate(row.segment.startDate),
    end: parseYmdDate(row.segment.endDate)
  }));

  const isVisibleTransaction = (transaction: CardTransaction) => {
    const transactionCardId = normalizeKey(transaction.cardId);
    const transactionDate = parseYmdDate(transaction.date);
    return visibleScopes.some((scope) => {
      if (!scope.cardId || scope.cardId !== transactionCardId) return false;
      if (!transactionDate || !scope.start || !scope.end) return true;
      return transactionDate.getTime() >= scope.start.getTime() && transactionDate.getTime() <= scope.end.getTime();
    });
  };

  const transactionUpserts: Array<Partial<CardTransaction> & { id: string }> = [];
  const transactionUpsertIds = new Set<string>();

  rowsToProcess.forEach(({ row }) => {
    const memoText = normalizeKey(row.memo);
    let hasAmount = false;

    categories.forEach((category) => {
      const amount = row.amounts[category] ?? 0;
      if (amount <= 0) return;
      hasAmount = true;
      const id = buildTransactionId(yearMonth, row, category);
      transactionUpsertIds.add(id);
      transactionUpserts.push({
        id,
        cardId: row.card.id,
        cardLabel: getCardLabel(row),
        date: row.segment.startDate || `${yearMonth}-01`,
        yearMonth,
        merchant: 'Monthly ledger',
        category,
        amount,
        memo: memoText || undefined,
        status: 'ACTIVE',
        operationId: resolvedOperationId,
        lastOperationId: resolvedOperationId
      });
    });

    if (!hasAmount && memoText) {
      const id = buildTransactionId(yearMonth, row, 'MEMO');
      transactionUpsertIds.add(id);
      transactionUpserts.push({
        id,
        cardId: row.card.id,
        cardLabel: getCardLabel(row),
        date: row.segment.startDate || `${yearMonth}-01`,
        yearMonth,
        merchant: 'Monthly ledger',
        category: 'OTHER',
        amount: 0,
        memo: memoText,
        status: 'ACTIVE',
        operationId: resolvedOperationId,
        lastOperationId: resolvedOperationId
      });
    }
  });

  const transactionCancelIds = Array.from(new Set(
    originalTransactions
      .filter((transaction) => transaction.status !== 'CANCELLED')
      .filter(isVisibleTransaction)
      .map((transaction) => transaction.id)
      .filter((id) => id && !transactionUpsertIds.has(id))
  ));
  attemptedAffectedDocumentIds = uniqueIds([
    ...transactionUpsertIds,
    ...transactionCancelIds
  ]);

  await deps.applyTransactionChanges({
    upserts: transactionUpserts,
    cancelIds: transactionCancelIds,
    operationId: resolvedOperationId
  });

  const billingSaveTasks: Array<Promise<void>> = [];
  const billingCancelDocuments = new Map<string, CardBillingDocument>();
  const billingSaveIds = new Set<string>();

  rowsToProcess.forEach(({ row, documents }) => {
    if (documents.length === 0) return;

    const nextDocument = buildBillingDocumentForRow(row, documents[0]);
    if (!nextDocument) {
      documents.forEach((doc) => {
        if (doc.id) billingCancelDocuments.set(doc.id, buildCancelledBillingDocument(doc));
      });
      return;
    }

    billingSaveIds.add(nextDocument.id);
    billingSaveTasks.push(deps.saveBilling(nextDocument));
    documents.forEach((doc) => {
      if (doc.id && doc.id !== nextDocument.id) {
        billingCancelDocuments.set(doc.id, buildCancelledBillingDocument(doc));
      }
    });
  });

  billingSaveIds.forEach((id) => billingCancelDocuments.delete(id));
  const billingCancelDocs = Array.from(billingCancelDocuments.values());
  attemptedAffectedDocumentIds = uniqueIds([
    ...attemptedAffectedDocumentIds,
    ...billingSaveIds,
    ...billingCancelDocs.map((doc) => doc.id)
  ]);

  await Promise.all(billingSaveTasks);
  await Promise.all(billingCancelDocs.map((doc) => deps.saveBilling(doc)));

  const result = {
    operationId: resolvedOperationId,
    upsertedTransactionCount: transactionUpserts.length,
    cancelledTransactionCount: transactionCancelIds.length,
    savedBillingCount: billingSaveIds.size,
    cancelledBillingCount: billingCancelDocs.length,
    skippedBillingCount: skippedBillingRows.length,
    transactionUpsertIds: Array.from(transactionUpsertIds),
    transactionCancelIds,
    billingSaveIds: Array.from(billingSaveIds),
    billingCancelIds: billingCancelDocs.map((doc) => doc.id),
    skippedBillingRows
  };

  await recordOperationSafely(deps.recordOperation, {
    domain: 'card',
    yearMonth,
    operationId: resolvedOperationId,
    status: 'success',
    affectedDocumentIds: uniqueIds([
      ...result.transactionUpsertIds,
      ...result.transactionCancelIds,
      ...result.billingSaveIds,
      ...result.billingCancelIds
    ]),
    metadata: {
      upsertedTransactionCount: result.upsertedTransactionCount,
      cancelledTransactionCount: result.cancelledTransactionCount,
      savedBillingCount: result.savedBillingCount,
      cancelledBillingCount: result.cancelledBillingCount,
      skippedBillingCount: result.skippedBillingCount,
      skippedBillingRows: result.skippedBillingRows
    }
  });

  return result;
  } catch (error) {
    const failedContext = {
      domain: 'card' as const,
      yearMonth,
      operationId: resolvedOperationId,
      affectedDocumentIds: attemptedAffectedDocumentIds,
      errorMessage: getErrorMessage(error),
      userMessage: SUPPORT_WRITE_RETRY_USER_MESSAGE
    };
    await recordOperationSafely(deps.recordOperation, {
      ...failedContext,
      status: 'failed'
    });
    reportSupportWriteError(error, {
      ...failedContext,
      status: 'failed'
    });
    throw error;
  }
};

export const cardMonthlyLedgerMutationService = {
  saveMonthlyLedger: saveCardMonthlyLedgerMutation
};
