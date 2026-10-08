export type CardStatementReconciliationStatus = 'matched' | 'mismatch' | 'missing_total' | 'no_transactions';

/** A missing or unreadable statement total must never become a fabricated zero or row sum. */
export const readCardStatementAmount = (value: unknown): number | null => {
    if (typeof value !== 'number' && typeof value !== 'string') return null;
    const text = typeof value === 'string' ? value.replace(/,/g, '').trim() : value;
    if (text === '') return null;
    const amount = Number(text);
    return Number.isSafeInteger(amount) ? amount : null;
};

export const reconcileCardStatementAmounts = (card: {
    subtotalAmount: unknown;
    statementTotalAvailable?: boolean;
    transactions: ReadonlyArray<{ amount: number }>;
}): {
    statementTotalAvailable: boolean;
    transactionTotalAmount: number;
    reconciliationDifference: number | null;
    reconciliationStatus: CardStatementReconciliationStatus;
} => {
    const statementAmount = readCardStatementAmount(card.subtotalAmount);
    const statementTotalAvailable = card.statementTotalAvailable !== false && statementAmount !== null;
    const transactionTotalAmount = card.transactions.reduce((sum, row) => sum + row.amount, 0);
    const reconciliationDifference = statementTotalAvailable && card.transactions.length > 0
        ? transactionTotalAmount - statementAmount! : null;
    const reconciliationStatus: CardStatementReconciliationStatus = card.transactions.length === 0
        ? 'no_transactions'
        : !statementTotalAvailable ? 'missing_total'
            : reconciliationDifference === 0 ? 'matched' : 'mismatch';
    return { statementTotalAvailable, transactionTotalAmount, reconciliationDifference, reconciliationStatus };
};

export const assertCardStatementHasTransactions = (
    cards: ReadonlyArray<{ transactions: readonly unknown[] }>,
): void => {
    if (!cards.some((card) => card.transactions.length > 0)) {
        throw new Error('PDF에서 카드 사용 상세내역을 읽지 못했습니다. 거래내역이 포함된 모든 페이지와 PDF 암호·화질을 확인해 주세요.');
    }
};
