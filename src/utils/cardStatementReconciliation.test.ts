import type { CardStatementImportResult } from '../types/cardStatementImport';
import { getCardStatementResults, reconcileCardStatement } from './cardStatementReconciliation';

const result = (overrides: Partial<CardStatementImportResult> = {}): CardStatementImportResult => ({
  id: 'result', jobId: 'job', fileId: 'file', fileIndex: 0, resultIndex: 0, yearMonth: '2026-09',
  matchedCardId: 'card-1', cardLast4: '1234', matchConfidence: 1, matchCandidates: [], status: 'matched',
  subtotalAmount: 15000, statementTotalAvailable: true, transactionCount: 2, warnings: [],
  transactions: [
    { id: '1', date: '2026-09-01', merchant: '식당', amount: 20000, category: 'MEAL', confidence: 1 },
    { id: '2', date: '2026-09-02', merchant: '식당 취소', amount: -5000, category: 'MEAL', confidence: 1 },
  ], ...overrides,
});

test('matches signed transaction amounts to the independently extracted statement total', () => {
  expect(reconcileCardStatement([result({ transactionTotalAmount: 99999 })], 'completed')).toEqual({
    status: 'matched', statementTotal: 15000, transactionTotal: 15000, difference: 0, transactionCount: 2, transactionsAvailable: true,
  });
});

test('shows a signed difference when rows are missing', () => {
  expect(reconcileCardStatement([result({ subtotalAmount: 18000 })], 'completed')).toMatchObject({ status: 'mismatch', difference: 3000 });
});

test('does not hide mismatches that cancel across independent result blocks', () => {
  expect(reconcileCardStatement([result({ subtotalAmount: 18000 }), result({ subtotalAmount: 12000 })], 'completed')).toMatchObject({ status: 'mismatch', difference: 0 });
});

test.each([undefined, false])('does not trust a legacy or explicitly missing statement total (%s)', statementTotalAvailable => {
  expect(reconcileCardStatement([result({ statementTotalAvailable })], 'completed')).toMatchObject({ status: 'missing_total', statementTotal: null, difference: null });
});

test('does not report an empty, partially populated or unfinished analysis as a match', () => {
  const empty = result({ subtotalAmount: 0, transactions: [], transactionCount: 0 });
  expect(reconcileCardStatement([empty], 'completed').status).toBe('no_transactions');
  expect(reconcileCardStatement([result(), empty], 'completed').status).toBe('no_transactions');
  expect(reconcileCardStatement([result()], 'not_analyzed').status).toBe('not_analyzed');
  expect(reconcileCardStatement([], 'completed').status).toBe('no_transactions');
});

test('accepts a real zero net balance with purchases and cancellations', () => {
  const entry = result();
  entry.subtotalAmount = 0;
  entry.transactions[1].amount = -20000;
  expect(reconcileCardStatement([entry], 'completed').status).toBe('matched');
});

test('filters by card ID first and only uses exact last-four fallback for unmatched results', () => {
  const entries = [
    result(),
    result({ id: 'other-id', matchedCardId: 'card-2' }),
    result({ id: 'fallback', matchedCardId: null }),
    result({ id: 'other-last4', matchedCardId: null, cardLast4: '9999' }),
    result({ id: 'excluded', status: 'excluded' }),
  ];
  expect(getCardStatementResults(entries, 'card-1', '1234').map(item => item.id)).toEqual(['result', 'fallback']);
  expect(getCardStatementResults([result({ matchedCardId: null, cardLast4: '' })], 'card-1', '')).toEqual([]);
});

test('does not use ambiguous same-last-four candidates as a verified card match', () => {
  const ambiguous = result({ matchedCardId: null, matchCandidates: [
    { cardId: 'card-1', cardLast4: '1234', cardLabel: '첫 카드', score: 80, reasons: [] },
    { cardId: 'card-2', cardLast4: '1234', cardLabel: '다른 카드', score: 80, reasons: [] },
  ] });
  expect(getCardStatementResults([ambiguous], 'card-1', '1234')).toEqual([]);
});

test('treats a failed result block as unconfirmed even inside a completed file payload', () => {
  expect(reconcileCardStatement([result({ status: 'failed' })], 'completed')).toMatchObject({ status: 'not_analyzed', transactionsAvailable: false });
});
