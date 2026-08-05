import type { WorkbookLedgerEntry } from '../services/workbookLedgerService';
import { buildWorkbookReceivableRows } from './workbookLedgerReceivables';

const baseEntry = (overrides: Partial<WorkbookLedgerEntry>): WorkbookLedgerEntry => ({
    id: 'entry',
    transactionType: '매출',
    date: '2026-07-02',
    partnerName: '디딤시스템',
    siteName: '',
    description: '테스트',
    manDays: null,
    supplyAmount: 0,
    taxAmount: 0,
    totalAmount: 0,
    paymentAmount: 0,
    note: '',
    teamName: '',
    ...overrides,
});

describe('workbookLedgerReceivables', () => {
    it('separates overpaid sales receipts into advance received', () => {
        const rows = buildWorkbookReceivableRows([
            baseEntry({
                id: 'invoice-1',
                totalAmount: 3_383_919,
            }),
            baseEntry({
                id: 'payment-1',
                description: '입금',
                totalAmount: 0,
                paymentAmount: 4_000_000,
                matchedEntryId: 'invoice-1',
            }),
        ], {
            startDate: '2026-07-01',
            endDate: '2026-07-31',
            transactionType: '매출',
        });

        expect(rows).toHaveLength(1);
        expect(rows[0].settledAmount).toBe(4_000_000);
        expect(rows[0].advanceUsedAmount).toBe(0);
        expect(rows[0].outstandingAmount).toBe(0);
        expect(rows[0].advanceAmount).toBe(616_081);
    });

    it('keeps overpaid rows visible in settlement-only views', () => {
        const rows = buildWorkbookReceivableRows([
            baseEntry({
                id: 'invoice-1',
                totalAmount: 1_000,
            }),
            baseEntry({
                id: 'payment-1',
                description: '입금',
                totalAmount: 0,
                paymentAmount: 1_200,
                matchedEntryId: 'invoice-1',
            }),
        ], {
            startDate: '2026-07-01',
            endDate: '2026-07-31',
            transactionType: '매출',
            settlementOnly: true,
        });

        expect(rows).toHaveLength(1);
        expect(rows[0].outstandingAmount).toBe(0);
        expect(rows[0].advanceAmount).toBe(200);
    });

    it('uses advance received against a later sales invoice without double-counting receipts', () => {
        const rows = buildWorkbookReceivableRows([
            baseEntry({
                id: 'invoice-1',
                date: '2026-07-01',
                totalAmount: 1_000,
            }),
            baseEntry({
                id: 'payment-1',
                date: '2026-07-01',
                description: '입금',
                totalAmount: 0,
                paymentAmount: 1_600,
                matchedEntryId: 'invoice-1',
            }),
            baseEntry({
                id: 'invoice-2',
                date: '2026-07-02',
                totalAmount: 500,
            }),
            baseEntry({
                id: 'advance-use-1',
                date: '2026-07-02',
                description: '선수금 사용',
                totalAmount: 0,
                paymentAmount: 500,
                matchedEntryId: 'invoice-2',
                sourceType: 'advanceUsage',
                sourceId: 'invoice-1',
            }),
        ], {
            startDate: '2026-07-01',
            endDate: '2026-07-31',
            transactionType: '매출',
        });

        const sourceRow = rows.find((row) => row.id === 'invoice-1');
        const targetRow = rows.find((row) => row.id === 'invoice-2');

        expect(sourceRow?.settledAmount).toBe(1_600);
        expect(sourceRow?.advanceAmount).toBe(100);
        expect(targetRow?.settledAmount).toBe(0);
        expect(targetRow?.advanceUsedAmount).toBe(500);
        expect(targetRow?.outstandingAmount).toBe(0);
    });

    it('does not convert excess negative adjustments into advance received', () => {
        const rows = buildWorkbookReceivableRows([
            baseEntry({
                id: 'invoice-1',
                totalAmount: 1_000,
            }),
            baseEntry({
                id: 'adjustment-1',
                description: '차감',
                totalAmount: -1_200,
                matchedEntryId: 'invoice-1',
            }),
        ], {
            startDate: '2026-07-01',
            endDate: '2026-07-31',
            transactionType: '매출',
        });

        const invoiceRow = rows.find((row) => row.id === 'invoice-1');

        expect(invoiceRow).toBeDefined();
        expect(invoiceRow?.settledAmount).toBe(1_000);
        expect(invoiceRow?.outstandingAmount).toBe(0);
        expect(invoiceRow?.advanceAmount).toBe(0);
    });
});
