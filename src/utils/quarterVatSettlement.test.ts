import { buildQuarterVatBalances, sumQuarterVatBalances } from './quarterVatSettlement';
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
