import ExcelJS from 'exceljs';
import { buildIssuesWorkbook } from './taxInvoiceExcelUtils';
import type { TaxInvoiceIssue } from '../types/taxInvoiceList';

test('노임서류 완료/미완료와 기존 금액·상태·특이사항을 실제 xlsx에 보존한다', async () => {
    const issue: TaxInvoiceIssue = { yearMonth: '2026-09', no: 1, isNew: '입력', issueDate: '2026-09-30',
        recipient: '합성 발주사', item: '합성 품목', supplyAmount: -1234, note: '합성 현장', manDays: 1.5,
        issueStatus: 'issued', scanCompleted: true, remark: '합성 특이사항' };
    const book = buildIssuesWorkbook([issue, { ...issue, no: 2, scanCompleted: false }]);
    const reread = new ExcelJS.Workbook();
    await reread.xlsx.load(await book.xlsx.writeBuffer());
    const sheet = reread.worksheets[0];
    expect(sheet.getRow(1).values).toContain('노임서류');
    expect(sheet.getCell('M2').value).toBe('완료');
    expect(sheet.getCell('M3').value).toBe('미완료');
    expect(sheet.getCell('F2').value).toBe(-1234);
    expect(sheet.getCell('H2').value).toBe(1.5);
    expect(sheet.getCell('L2').value).toBe('완료');
    expect(sheet.getCell('N2').value).toBe('합성 특이사항');
});
