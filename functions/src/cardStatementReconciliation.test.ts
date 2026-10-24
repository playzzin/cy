import { strict as assert } from 'assert';
import { test } from 'node:test';
import { assertCardStatementHasTransactions, readCardStatementAmount, reconcileCardStatementAmounts } from './cardStatementReconciliation';

test('unreadable totals remain unavailable while explicit zero and negative totals are valid', () => {
    for (const value of [undefined, null, '', ' ', '미확인', {}, true, Infinity, NaN]) {
        assert.equal(readCardStatementAmount(value), null);
    }
    assert.equal(readCardStatementAmount(0), 0);
    assert.equal(readCardStatementAmount('0'), 0);
    assert.equal(readCardStatementAmount('-12,000'), -12000);
});

test('multiple card differences cannot cancel out into a false per-card match', () => {
    const cards = [
        { subtotalAmount: 12000, transactions: [{ amount: 15000 }] },
        { subtotalAmount: 8000, transactions: [{ amount: 5000 }] },
    ];
    assert.deepEqual(cards.map((card) => reconcileCardStatementAmounts(card).reconciliationDifference), [3000, -3000]);
    assert.ok(cards.every((card) => reconcileCardStatementAmounts(card).reconciliationStatus === 'mismatch'));
    assert.deepEqual(cards.map((card) => card.subtotalAmount), [12000, 8000]);
});

test('negative cancellation rows reconcile a genuine zero without losing signs or replacing the source total', () => {
    const result = reconcileCardStatementAmounts({ subtotalAmount: 0, transactions: [{ amount: 12000 }, { amount: -12000 }] });
    assert.equal(result.transactionTotalAmount, 0);
    assert.equal(result.reconciliationStatus, 'matched');
    assert.equal(result.reconciliationDifference, 0);
    assert.equal(reconcileCardStatementAmounts({ subtotalAmount: 0, transactions: [{ amount: 1 }] }).reconciliationStatus, 'mismatch');
});

test('a missing source total and summary-only output cannot produce a successful reconciliation', () => {
    const missing = reconcileCardStatementAmounts({ subtotalAmount: 12000, statementTotalAvailable: false, transactions: [{ amount: 12000 }] });
    assert.equal(missing.reconciliationStatus, 'missing_total');
    assert.equal(missing.reconciliationDifference, null);
    assert.equal(reconcileCardStatementAmounts({ subtotalAmount: 0, transactions: [] }).reconciliationStatus, 'no_transactions');
    assert.throws(() => assertCardStatementHasTransactions([]), /상세내역/);
    assert.throws(() => assertCardStatementHasTransactions([{ transactions: [] }]), /상세내역/);
    assert.doesNotThrow(() => assertCardStatementHasTransactions([{ transactions: [{ amount: -3000 }] }]));
});
