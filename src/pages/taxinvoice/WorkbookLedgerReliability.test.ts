import type { WorkbookLedgerEntry } from '../../services/workbookLedgerService';
import { buildWorkbookReceivableRows } from '../../utils/workbookLedgerReceivables';
import { buildLedgerRows, buildQuarterVatReport, buildSummaryBaseRowsForTransaction, DB_HEADERS, getWorkbookInputRowIssues, parseImportedDbEntries, partitionWorkbookImportDuplicates, toDbRow } from './WorkbookLedgerModel';
import { prepareWorkbookImportEntries } from './utils/workbookLedgerImport';

const invoice = (overrides: Partial<WorkbookLedgerEntry> = {}): WorkbookLedgerEntry => ({
    id: 'invoice-a', transactionType: '매출', date: '2026-09-01', partnerName: '검증 거래처', siteName: '검증 현장',
    description: '테스트', supplyAmount: 100000, taxAmount: 10000, totalAmount: 110000, paymentAmount: 0,
    appliedYear: 2026, appliedMonth: 9, note: '', teamName: '', ...overrides,
});
const payment = (overrides: Partial<WorkbookLedgerEntry> = {}) => invoice({
    id: 'payment-a', date: '2026-09-02', supplyAmount: 0, taxAmount: 0, totalAmount: 0,
    paymentAmount: 110000, matchedEntryId: 'invoice-a', ...overrides,
});
const filter = { startDate: '2026-09-01', endDate: '2026-09-30', transactionType: '매출' as const, partnerName: '', siteName: '', teamName: '' };

describe('workbook settlement regressions', () => {
    it('does not count an advance allocation as another cash receipt in the ledger', () => {
        const entries = [invoice(), payment({ paymentAmount: 160000 }),
            invoice({ id: 'invoice-b', date: '2026-09-03', supplyAmount: 50000, taxAmount: 5000, totalAmount: 55000 }),
            payment({ id: 'usage', date: '2026-09-04', sourceType: 'advanceUsage', sourceId: 'invoice-a', matchedEntryId: 'invoice-b', paymentAmount: 50000 }),
        ];
        const ledger = buildLedgerRows(entries, filter);
        expect(ledger).toHaveLength(3);
        expect(ledger[2].balance).toBe(5000);
        expect(ledger.reduce((sum, row) => sum + row.paymentAmount, 0)).toBe(160000);
        expect(buildSummaryBaseRowsForTransaction(entries, '매출', '2026-09-29').reduce((sum, row) => sum + row.outstandingAmount, 0)).toBe(5000);
    });

    it('applies linked negative adjustments only on or after their date in both summary implementations', () => {
        const entries = [invoice(), invoice({ id: 'cancel', date: '2026-10-01', supplyAmount: -100000, taxAmount: -10000, totalAmount: -110000, matchedEntryId: 'invoice-a' })];
        expect(buildSummaryBaseRowsForTransaction(entries, '매출', '2026-09-29')[0].outstandingAmount).toBe(110000);
        expect(buildSummaryBaseRowsForTransaction(entries, '매출', '2026-10-01')[0].outstandingAmount).toBe(0);
        expect(buildWorkbookReceivableRows(entries, filter)[0].outstandingAmount).toBe(110000);
    });

    it('preserves the sign when identifying duplicate imports', () => {
        const reversal = invoice({ id: undefined, supplyAmount: -100000, taxAmount: -10000, totalAmount: -110000 });
        const result = partitionWorkbookImportDuplicates([reversal, reversal], [invoice()]);
        expect(result.newEntries).toHaveLength(1);
        expect(result.duplicateEntries).toHaveLength(1);
    });
});

describe('workbook shared input validation', () => {
    it.each([-1, 0, 13, 1.5])('rejects invalid applied month %s', (appliedMonth) => {
        expect(getWorkbookInputRowIssues([invoice({ appliedMonth })], 2026, '')[0].fields).toContain('appliedMonth');
    });
    it('rejects a negative payment even when the invoice amount is positive', () => {
        expect(getWorkbookInputRowIssues([invoice({ paymentAmount: -50000 })], 2026, '')[0].fields).toContain('paymentAmount');
    });
    it('rejects invalid numeric values in uploads before returning any rows', () => {
        expect(() => parseImportedDbEntries([[...DB_HEADERS], toDbRow(invoice()), toDbRow(invoice({ appliedMonth: 13 }))], '', 2026)).toThrow('3행');
    });
    it('keeps legacy invalid-month entries visible as warnings without adding them to VAT totals', () => {
        const report = buildQuarterVatReport([invoice({ appliedMonth: 13 })], { year: 2026, quarter: 'Q3', basis: 'applied', detailTransactionType: 'all', partnerName: '', siteName: '' });
        expect(report.detailRows).toHaveLength(0);
        expect(report.warningRows).toHaveLength(1);
        expect(report.warningRows[0].issues.join(' ')).toContain('집계 제외');
        expect(report.totals.salesTotal).toBe(0);
        expect(report.totals.warningCount).toBe(1);
    });
});

describe('DB backup round trip', () => {
    let id = 0;
    const createId = () => `new-${++id}`;
    beforeEach(() => { id = 0; });
    const parse = (entries: WorkbookLedgerEntry[]) => parseImportedDbEntries([[...DB_HEADERS], ...entries.map(toDbRow)], '', 2026).entries;

    it('preserves payments and advance relationships while allocating new record IDs', () => {
        const entries = [invoice({ manDays: 3.5 }), payment({ paymentAmount: 160000 }),
            invoice({ id: 'invoice-b', date: '2026-09-03', totalAmount: 55000, supplyAmount: 50000, taxAmount: 5000 }),
            payment({ id: 'usage', date: '2026-09-04', sourceType: 'advanceUsage', sourceId: 'invoice-a', matchedEntryId: 'invoice-b', paymentAmount: 50000, sourceMonth: '2026-09' }),
        ];
        const restored = prepareWorkbookImportEntries(parse(entries), [], createId).newEntries;
        expect(restored[0]).toMatchObject({ id: 'new-1', manDays: 3.5, importedFromId: 'invoice-a' });
        expect(restored[1].matchedEntryId).toBe('new-1');
        expect(restored[3]).toMatchObject({ sourceId: 'new-1', matchedEntryId: 'new-3', sourceType: 'advanceUsage', sourceMonth: '2026-09' });
        expect(buildSummaryBaseRowsForTransaction(restored, '매출', '2026-09-29').map((row) => row.outstandingAmount)).toEqual([0, 5000]);
    });

    it('does not merge different backup IDs just because their date and amount match', () => {
        const restored = prepareWorkbookImportEntries(parse([invoice(), invoice({ id: 'invoice-b' })]), [], createId);
        expect(restored.newEntries).toHaveLength(2);
    });

    it('reuses the imported original when only the invoice was saved before a failure', () => {
        const imported = parse([invoice(), payment()]);
        const first = prepareWorkbookImportEntries(imported, [], createId);
        const retry = prepareWorkbookImportEntries(imported, [first.newEntries[0]], createId);
        expect(retry.duplicateEntries).toHaveLength(1);
        expect(retry.newEntries).toHaveLength(1);
        expect(retry.newEntries[0].matchedEntryId).toBe(first.newEntries[0].id);
        const completeRetry = prepareWorkbookImportEntries(imported, first.newEntries, createId);
        expect(completeRetry.newEntries).toHaveLength(0);
    });

    it('refuses orphaned references from old backups rather than silently restoring an incorrect balance', () => {
        const orphan = parse([payment()]);
        expect(() => prepareWorkbookImportEntries(orphan, [], createId)).toThrow('연결 원본');
    });

    it('refuses an existing ID with changed content instead of overwriting it', () => {
        expect(() => prepareWorkbookImportEntries(parse([invoice({ totalAmount: 220000 })]), [invoice()], createId)).toThrow('같은 거래ID');
    });

    it('preserves nullable applied period values in ID-bearing backups', () => {
        expect(parse([invoice({ appliedYear: null, appliedMonth: null })])[0]).toMatchObject({ appliedYear: null, appliedMonth: null });
    });
});
