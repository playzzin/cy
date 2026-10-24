import type { CardStatementFileAnalysisStatus, CardStatementImportResult } from '../types/cardStatementImport';

export type StatementReconciliationStatus = 'matched' | 'mismatch' | 'missing_total' | 'no_transactions' | 'not_analyzed';

export const getCardStatementResults = (
  results: CardStatementImportResult[], cardId: string, cardLast4: string,
): CardStatementImportResult[] => results.filter(result => {
  if (result.status === 'excluded') return false;
  if (result.matchedCardId) return result.matchedCardId === cardId;
  const candidateIds = Array.from(new Set((result.matchCandidates || []).map(candidate => candidate.cardId).filter(Boolean)));
  if (candidateIds.length > 0 && (candidateIds.length !== 1 || candidateIds[0] !== cardId)) return false;
  return /^\d{4}$/.test(cardLast4) && result.cardLast4 === cardLast4;
});

export const reconcileCardStatement = (
  results: CardStatementImportResult[], analysisStatus: CardStatementFileAnalysisStatus,
) => {
  const rows = results.flatMap(result => result.transactions || []);
  const transactionTotal = rows.reduce((sum, row) => sum + (Number.isFinite(row.amount) ? row.amount : 0), 0);
  const totalAvailable = results.length > 0 && results.every(result => result.statementTotalAvailable === true && Number.isFinite(result.subtotalAmount));
  const statementTotal = totalAvailable ? results.reduce((sum, result) => sum + result.subtotalAmount, 0) : null;
  const difference = statementTotal === null ? null : Math.round((statementTotal - transactionTotal) * 100) / 100;
  let status: StatementReconciliationStatus;
  const transactionsAvailable = analysisStatus === 'completed' && results.length > 0
    && results.every(result => result.status !== 'failed' && result.transactions?.length > 0)
    && rows.every(row => Number.isFinite(row.amount));
  if (analysisStatus !== 'completed' || results.some(result => result.status === 'failed')) status = 'not_analyzed';
  else if (!rows.length || results.some(result => !result.transactions?.length)) status = 'no_transactions';
  else if (!totalAvailable || rows.some(row => !Number.isFinite(row.amount))) status = 'missing_total';
  else if (difference !== 0 || results.some(result => Math.round((result.subtotalAmount - result.transactions.reduce((sum, row) => sum + row.amount, 0)) * 100) !== 0)) status = 'mismatch';
  else status = 'matched';
  return { status, statementTotal, transactionTotal, difference, transactionCount: rows.length, transactionsAvailable };
};
