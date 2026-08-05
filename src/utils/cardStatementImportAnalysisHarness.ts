export type CardStatementHarnessCategory = 'FUEL' | 'TOLL' | 'MEAL' | 'MATERIAL' | 'OTHER';

export interface CardStatementHarnessTransaction {
  id?: string;
  date: string;
  merchant: string;
  amount: number;
  category: CardStatementHarnessCategory;
  memo?: string;
  confidence?: number;
}

export interface CardStatementHarnessCard {
  cardLast4: string;
  cardName?: string;
  holderName?: string;
  subtotalAmount: number;
  transactions: CardStatementHarnessTransaction[];
  warnings?: string[];
  confidence?: number;
}

export interface CardStatementHarnessGeminiResponse {
  bankName: string;
  statementMonth: string;
  grandTotalAmount: number;
  cards: CardStatementHarnessCard[];
  warnings?: string[];
}

export interface CardStatementHarnessCardMaster {
  id: string;
  name: string;
  last4?: string;
  maskedNumber?: string;
}

export type CardStatementHarnessResultStatus =
  | 'matched'
  | 'needs_review'
  | 'excluded'
  | 'committed'
  | 'failed';

export interface CardStatementHarnessResult {
  id: string;
  jobId: string;
  fileId: string;
  fileIndex: number;
  resultIndex: number;
  yearMonth: string;
  statementMonth: string;
  cardLast4: string;
  cardName: string;
  holderName: string;
  matchedCardId: string | null;
  matchedCardLabel: string | null;
  matchConfidence: number;
  status: CardStatementHarnessResultStatus;
  subtotalAmount: number;
  transactionCount: number;
  transactions: Required<Pick<CardStatementHarnessTransaction, 'id' | 'date' | 'merchant' | 'amount' | 'category'>>[];
  warnings: string[];
  exclusionReason?: string;
  committedBillingId?: string;
  committedBillingLogId?: string;
  committedTransactionIds?: string[];
  committedLineItemIds?: string[];
}

export interface BuildHarnessResultsInput {
  jobId: string;
  fileId: string;
  fileIndex?: number;
  yearMonth: string;
  gemini: CardStatementHarnessGeminiResponse;
  cards: CardStatementHarnessCardMaster[];
}

export interface CommitHarnessState {
  transactionIds: string[];
  billingLineItemIds: Record<string, string[]>;
  billingLogIds: string[];
  results: CardStatementHarnessResult[];
}

const normalizeLast4 = (value: unknown): string =>
  String(value ?? '').replace(/\D/g, '').slice(-4);

const sanitizeIdPart = (value: unknown): string => {
  const normalized = String(value ?? '')
    .trim()
    .replace(/[^0-9A-Za-z가-힣_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || 'unknown';
};

const getCardLabel = (card: CardStatementHarnessCardMaster): string => {
  const last4 = normalizeLast4(card.last4 || card.maskedNumber);
  return last4 ? `${card.name} (${last4})` : card.name;
};

const uniqueStrings = (values: unknown[]): string[] =>
  Array.from(new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean)));

const buildTransactionId = (
  yearMonth: string,
  cardId: string,
  result: CardStatementHarnessResult,
  transaction: Pick<CardStatementHarnessTransaction, 'id'>,
  transactionIndex: number,
): string => [
  'card-statement',
  yearMonth,
  cardId,
  result.fileId,
  result.resultIndex,
  transaction.id || transactionIndex,
].map(sanitizeIdPart).join('__');

export const buildCardStatementHarnessResults = ({
  jobId,
  fileId,
  fileIndex = 0,
  yearMonth,
  gemini,
  cards,
}: BuildHarnessResultsInput): CardStatementHarnessResult[] => {
  const cardSubtotalSum = gemini.cards.reduce((sum, card) => sum + Math.round(card.subtotalAmount || 0), 0);
  const grandTotalMismatch = Math.abs(cardSubtotalSum - Math.round(gemini.grandTotalAmount || 0)) > 1;

  return gemini.cards.map((statementCard, resultIndex) => {
    const last4 = normalizeLast4(statementCard.cardLast4);
    const exactMatches = cards.filter((card) => normalizeLast4(card.last4 || card.maskedNumber) === last4);
    const matchedCard = exactMatches.length === 1 ? exactMatches[0] : null;
    const transactionTotal = statementCard.transactions.reduce((sum, transaction) => (
      sum + Math.round(transaction.amount || 0)
    ), 0);
    const warnings = uniqueStrings([
      ...(gemini.warnings || []),
      ...(statementCard.warnings || []),
      gemini.statementMonth && gemini.statementMonth !== yearMonth
        ? `statement month mismatch: selected ${yearMonth}, pdf ${gemini.statementMonth}`
        : '',
      exactMatches.length > 1
        ? `duplicate card last4 ${last4}: ${exactMatches.map((card) => card.id).join(', ')}`
        : '',
      statementCard.transactions.length > 0 && Math.abs(transactionTotal - Math.round(statementCard.subtotalAmount || 0)) > 1
        ? `transaction subtotal mismatch: transactions ${transactionTotal}, card subtotal ${statementCard.subtotalAmount}`
        : '',
      grandTotalMismatch
        ? `grand total mismatch: card subtotals ${cardSubtotalSum}, statement total ${gemini.grandTotalAmount}`
        : '',
    ]);

    return {
      id: `${sanitizeIdPart(fileId)}_${String(resultIndex).padStart(3, '0')}`,
      jobId,
      fileId,
      fileIndex,
      resultIndex,
      yearMonth,
      statementMonth: gemini.statementMonth,
      cardLast4: last4,
      cardName: statementCard.cardName || '',
      holderName: statementCard.holderName || '',
      matchedCardId: matchedCard?.id || null,
      matchedCardLabel: matchedCard ? getCardLabel(matchedCard) : null,
      matchConfidence: matchedCard ? 1 : 0,
      status: matchedCard ? 'matched' : 'needs_review',
      subtotalAmount: Math.round(statementCard.subtotalAmount || 0),
      transactionCount: statementCard.transactions.length,
      transactions: statementCard.transactions.map((transaction, index) => ({
        id: transaction.id || `tx_${String(index).padStart(4, '0')}`,
        date: transaction.date,
        merchant: transaction.merchant,
        amount: Math.round(transaction.amount || 0),
        category: transaction.category,
      })),
      warnings,
    };
  });
};

export const applyCardStatementHarnessReview = (
  result: CardStatementHarnessResult,
  review: {
    matchedCardId?: string | null;
    exclude?: boolean;
    exclusionReason?: string;
  },
  cards: CardStatementHarnessCardMaster[],
): CardStatementHarnessResult => {
  if (review.exclude) {
    return {
      ...result,
      status: 'excluded',
      matchedCardId: null,
      matchedCardLabel: null,
      matchConfidence: 0,
      exclusionReason: review.exclusionReason || 'excluded in review',
    };
  }

  const card = cards.find((candidate) => candidate.id === review.matchedCardId);
  return {
    ...result,
    matchedCardId: card?.id || null,
    matchedCardLabel: card ? getCardLabel(card) : null,
    matchConfidence: card ? 1 : 0,
    status: card ? 'matched' : 'needs_review',
  };
};

export const commitCardStatementHarnessResults = (
  input: {
    operationId: string;
    yearMonth: string;
    results: CardStatementHarnessResult[];
  },
  previousState?: CommitHarnessState,
): CommitHarnessState => {
  const transactionIds = new Set(previousState?.transactionIds || []);
  const billingLogIds = new Set(previousState?.billingLogIds || []);
  const billingLineItemIds = new Map<string, Set<string>>(
    Object.entries(previousState?.billingLineItemIds || {}).map(([billingId, ids]) => [billingId, new Set(ids)]),
  );

  const nextResults = input.results.map((result) => {
    if (result.status === 'excluded' || result.status === 'failed' || !result.matchedCardId) return result;

    const billingId = ['card-billing', input.yearMonth, result.matchedCardId].map(sanitizeIdPart).join('__');
    const billingLogId = ['card-statement-import-billing-log', input.operationId, billingId].map(sanitizeIdPart).join('__');
    const committedTransactionIds = result.transactions.map((transaction, index) => (
      buildTransactionId(input.yearMonth, result.matchedCardId || 'unmatched', result, transaction, index)
    ));
    const committedLineItemIds = [...committedTransactionIds];

    committedTransactionIds.forEach((id) => transactionIds.add(id));
    billingLogIds.add(billingLogId);
    const existingLineItems = billingLineItemIds.get(billingId) || new Set<string>();
    committedLineItemIds.forEach((id) => existingLineItems.add(id));
    billingLineItemIds.set(billingId, existingLineItems);

    return {
      ...result,
      status: 'committed' as const,
      committedBillingId: billingId,
      committedBillingLogId: billingLogId,
      committedTransactionIds,
      committedLineItemIds,
    };
  });

  const sortedBillingLineItems: Array<[string, string[]]> = Array.from(billingLineItemIds.entries())
    .map(([billingId, ids]): [string, string[]] => [billingId, Array.from(ids).sort()])
    .sort(([left], [right]) => left.localeCompare(right));

  return {
    transactionIds: Array.from(transactionIds).sort(),
    billingLogIds: Array.from(billingLogIds).sort(),
    billingLineItemIds: Object.fromEntries(sortedBillingLineItems),
    results: nextResults,
  };
};
