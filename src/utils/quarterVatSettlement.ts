import type { QuarterVatPaymentRecord } from '../services/quarterVatPaymentService';

export type VatQuarter = 'Q1' | 'Q2' | 'Q3' | 'Q4';

export interface VatQuarterBalance {
    quarter: VatQuarter;
    payableVat: number;
    expectedAmount: number;
    paidAmount: number;
    remainingAmount: number;
    overpaidAmount: number;
    refundAmount: number;
    lastPaymentDate: string;
    status: string;
}

/** Payment dates never determine attribution: the saved year/quarter does. */
export const buildQuarterVatBalances = (
    year: number,
    quarters: ReadonlyArray<{ quarter: string; payableVat: number }>,
    payments: ReadonlyArray<QuarterVatPaymentRecord>,
): VatQuarterBalance[] => quarters
    .filter((row) => ['Q1', 'Q2', 'Q3', 'Q4'].includes(row.quarter))
    .map((row) => {
        const matching = payments.filter((payment) => payment.year === year && payment.quarter === row.quarter);
        const paidAmount = matching.reduce((sum, payment) => sum + payment.amount, 0);
        const expectedAmount = Math.max(row.payableVat, 0);
        const remainingAmount = Math.max(expectedAmount - paidAmount, 0);
        const overpaidAmount = Math.max(paidAmount - expectedAmount, 0);
        return {
            quarter: row.quarter as VatQuarter,
            payableVat: row.payableVat,
            expectedAmount,
            paidAmount,
            remainingAmount,
            overpaidAmount,
            refundAmount: Math.max(-row.payableVat, 0),
            lastPaymentDate: matching.reduce((latest, payment) => payment.date > latest ? payment.date : latest, ''),
            status: overpaidAmount > 0 ? '초과 납부' : remainingAmount > 0
                ? (paidAmount > 0 ? '일부 납부' : '미납')
                : row.payableVat < 0 ? '환급 예상' : paidAmount > 0 ? '납부 완료' : '납부 없음',
        };
    });

/** Outstanding amounts stay in their own quarters, including in the annual view. */
export const sumQuarterVatBalances = (rows: ReadonlyArray<VatQuarterBalance>, quarter: string) =>
    rows.filter((row) => quarter === 'all' || row.quarter === quarter).reduce((total, row) => ({
        expectedAmount: total.expectedAmount + row.expectedAmount,
        paidAmount: total.paidAmount + row.paidAmount,
        remainingAmount: total.remainingAmount + row.remainingAmount,
        overpaidAmount: total.overpaidAmount + row.overpaidAmount,
        refundAmount: total.refundAmount + row.refundAmount,
    }), { expectedAmount: 0, paidAmount: 0, remainingAmount: 0, overpaidAmount: 0, refundAmount: 0 });

export interface VatPaymentHistoryRow {
    year: number;
    quarter: VatQuarter;
    date: string;
    expectedAmount: number | null;
    paymentAmount: number | null;
    remainingAmount: number;
    note: string;
    payment: QuarterVatPaymentRecord | null;
}

/** Each quarter starts with its assessed amount, followed by its dated installments. */
export const buildQuarterVatPaymentHistory = (
    year: number,
    balances: ReadonlyArray<VatQuarterBalance>,
    payments: ReadonlyArray<QuarterVatPaymentRecord>,
): VatPaymentHistoryRow[] => [...balances]
    .sort((left, right) => left.quarter.localeCompare(right.quarter, 'en'))
    .flatMap((balance) => {
        const matching = payments
            .filter((payment) => payment.year === year && payment.quarter === balance.quarter)
            .sort((left, right) => left.date.localeCompare(right.date, 'en')
                || left.createdAt.localeCompare(right.createdAt, 'en')
                || left.id.localeCompare(right.id, 'en'));
        if (balance.expectedAmount === 0 && matching.length === 0) return [];

        let paidAmount = 0;
        return [{
            year, quarter: balance.quarter, date: '',
            expectedAmount: balance.expectedAmount, paymentAmount: null,
            remainingAmount: balance.expectedAmount, note: '납부 전 잔액', payment: null,
        }, ...matching.map((payment) => {
            paidAmount += payment.amount;
            return {
                year, quarter: balance.quarter, date: payment.date,
                expectedAmount: null, paymentAmount: payment.amount,
                remainingAmount: Math.max(balance.expectedAmount - paidAmount, 0),
                note: payment.note, payment,
            };
        })];
    });
