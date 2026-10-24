import { buildQuarterVatBalances, buildQuarterVatPaymentHistory, sumQuarterVatBalances } from './quarterVatSettlement';
import type { QuarterVatPaymentRecord } from '../services/quarterVatPaymentService';

const payment = (overrides: Partial<QuarterVatPaymentRecord> = {}): QuarterVatPaymentRecord => ({
    id: 'payment-1', year: 2026, quarter: 'Q1', date: '2026-08-15', amount: 40,
    note: '', createdAt: '', createdBy: '', ...overrides,
});

it('attributes installments to their original quarter even when paid in another quarter or year', () => {
    const rows = buildQuarterVatBalances(2026, [
        { quarter: 'Q1', payableVat: 100 }, { quarter: 'Q3', payableVat: 200 },
    ], [payment(), payment({ id: 'payment-2', date: '2027-01-05', amount: 30 }), payment({ year: 2025, amount: 900 })]);
    expect(rows[0]).toMatchObject({ paidAmount: 70, remainingAmount: 30, status: '일부 납부', lastPaymentDate: '2027-01-05' });
    expect(rows[1]).toMatchObject({ paidAmount: 0, remainingAmount: 200, status: '미납' });
    expect(sumQuarterVatBalances(rows, 'Q3').paidAmount).toBe(0);
});

it('does not cancel another quarter’s outstanding balance with refunds or overpayments', () => {
    const rows = buildQuarterVatBalances(2026, [
        { quarter: 'Q1', payableVat: 100 }, { quarter: 'Q2', payableVat: -50 },
        { quarter: 'Q3', payableVat: 200 }, { quarter: 'Q4', payableVat: 0 },
    ], [payment({ amount: 120 })]);
    expect(sumQuarterVatBalances(rows, 'all')).toEqual({
        expectedAmount: 300, paidAmount: 120, remainingAmount: 200, overpaidAmount: 20, refundAmount: 50,
    });
    expect(rows.map((row) => row.status)).toEqual(['초과 납부', '환급 예상', '미납', '납부 없음']);
    expect(buildQuarterVatBalances(2026, [{ quarter: 'Q1', payableVat: 100 }], [payment({ amount: 100 })])[0].status).toBe('납부 완료');
});

it('starts each quarter once and reduces its balance in payment order without mutating the source', () => {
    const payments = [
        payment({ id: 'last', date: '2027-01-05', amount: 20 }),
        payment({ id: 'second', date: '2026-08-15', amount: 30, createdAt: '2026-08-15T10:00:00Z' }),
        payment({ id: 'first', amount: 40, createdAt: '2026-08-15T09:00:00Z' }),
        payment({ year: 2025, amount: 900 }),
    ];
    const balances = buildQuarterVatBalances(2026, [
        { quarter: 'Q3', payableVat: 200 }, { quarter: 'Q1', payableVat: 100 },
    ], payments);
    const rows = buildQuarterVatPaymentHistory(2026, balances, payments);
    expect(rows.map((row) => [row.quarter, row.expectedAmount, row.paymentAmount, row.remainingAmount])).toEqual([
        ['Q1', 100, null, 100], ['Q1', null, 40, 60], ['Q1', null, 30, 30], ['Q1', null, 20, 10],
        ['Q3', 200, null, 200],
    ]);
    expect(rows[0]).toMatchObject({ date: '', payment: null });
    expect(rows[1].payment?.id).toBe('first');
    expect(rows[3].date).toBe('2027-01-05');
    expect(payments.map((row) => row.id)).toEqual(['last', 'second', 'first', 'payment-1']);
    expect(balances.map((row) => row.quarter)).toEqual(['Q3', 'Q1']);
});

it('keeps unpaid quarters and zero balances after overpayment consistent with the annual summary', () => {
    const payments = [payment({ amount: 120 }), payment({ id: 'extra', date: '2026-09-01', amount: 10 })];
    const balances = buildQuarterVatBalances(2026, [
        { quarter: 'Q1', payableVat: 100 }, { quarter: 'Q2', payableVat: -50 },
        { quarter: 'Q3', payableVat: 200 }, { quarter: 'Q4', payableVat: 0 },
    ], payments);
    const rows = buildQuarterVatPaymentHistory(2026, balances, payments);
    expect(rows.map((row) => row.remainingAmount)).toEqual([100, 0, 0, 200]);
    expect(rows.reduce((total, row) => total + (row.expectedAmount ?? 0), 0)).toBe(300);
    expect(rows.reduce((total, row) => total + (row.paymentAmount ?? 0), 0)).toBe(130);
    expect(rows.filter((row) => row.quarter === 'Q2' || row.quarter === 'Q4')).toEqual([]);
    expect(rows[2].remainingAmount + rows[3].remainingAmount).toBe(sumQuarterVatBalances(balances, 'all').remainingAmount);
});

it('retains payments without assessed tax and resolves identical date/time ties deterministically', () => {
    const payments = [payment({ id: 'b', amount: 20 }), payment({ id: 'a', amount: 10 })];
    const balances = buildQuarterVatBalances(2026, [{ quarter: 'Q1', payableVat: 0 }], payments);
    const rows = buildQuarterVatPaymentHistory(2026, balances, payments);
    expect(rows.map((row) => row.payment?.id ?? 'opening')).toEqual(['opening', 'a', 'b']);
    expect(rows.map((row) => row.remainingAmount)).toEqual([0, 0, 0]);
    expect(buildQuarterVatPaymentHistory(2026, buildQuarterVatBalances(2026, [{ quarter: 'Q1', payableVat: 0 }], []), [])).toEqual([]);
});
