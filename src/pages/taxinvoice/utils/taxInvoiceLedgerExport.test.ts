import { buildTaxInvoiceLedgerWorkbook } from './taxInvoiceLedgerExport';
test('exports the supplied rows, signed numeric amounts and literal invoice identifiers', async () => {
    const book = buildTaxInvoiceLedgerWorkbook([{ id: 'synthetic', date: '2026-09-01', type: '매입', partnerName: '=SUM(A1)', description: '합성 거래',
        supplyAmount: -100, taxAmount: -10, totalAmount: -110, invoiceNum: '00123' }]);
    const sheet = book.worksheets[0];
    expect(sheet.rowCount).toBe(3);
    expect(sheet.getCell('C2').value).toBe('=SUM(A1)');
    expect(sheet.getCell('J2').value).toBe('00123');
    expect(sheet.getCell('I2').value).toBe(-110);
    expect(sheet.getCell('I3').value).toBe(-110);
    const bytes = await book.xlsx.writeBuffer();
    expect(bytes.byteLength).toBeGreaterThan(1000);
});
