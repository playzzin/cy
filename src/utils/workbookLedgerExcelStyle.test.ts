import * as XLSX from 'xlsx-js-style';
import ExcelJS from 'exceljs';
import { applyWorkbookLedgerExcelStyle } from './workbookLedgerExcelStyle';

const data = [
    ['No', '거래처명', '현장명', '발행일', '공급가액', '세액', '합계', '지급일', '지급금액', '미지급금', '선급금', '비고', '팀명'],
    [1, '=문자 거래처', '검증 현장', '2026-08-01', 10000, 1000, 11000, '2026-08-02', 5000, 6000, 0, '', '검증팀'],
    [2, '두 번째', '현장', '2026-08-03', -1000, -100, -1100, '2026-08-04\n2026-08-05', 0, -1100, 0, '', '검증팀'],
    ['', '합계', '', '', 9000, 900, 9900, '', 5000, 4900, 0, '', '']
];

it('preserves the reference formatting and numeric data through an actual XLSX round trip', async () => {
    const sheet = XLSX.utils.aoa_to_sheet(data);
    applyWorkbookLedgerExcelStyle(sheet, data, 'summary', XLSX.utils);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, '전체 조회 (매입)');
    const restored = new ExcelJS.Workbook();
    await restored.xlsx.load(XLSX.write(book, { bookType: 'xlsx', type: 'buffer' }));
    const result = restored.worksheets[0];
    expect(result.getColumn(2).width).toBeCloseTo(30.7109375);
    expect(result.getColumn(3).width).toBeCloseTo(35.7109375);
    expect(result.getRow(1).height).toBeCloseTo(35.1);
    expect(result.getRow(2).height).toBeCloseTo(20.1);
    expect(result.getRow(3).height).toBeGreaterThan(30);
    expect(result.getRow(4).height).toBeCloseTo(35.1);
    for (const address of ['A1', 'M1', 'A4', 'M4']) {
        expect(result.getCell(address).fill).toMatchObject({ type: 'pattern', fgColor: { argb: 'FF666699' } });
        expect(result.getCell(address).font).toMatchObject({ name: '맑은 고딕', bold: true, color: { argb: 'FFFFFFFF' } });
    }
    expect(result.getCell('A2').fill).toMatchObject({ fgColor: { argb: 'FFF0F3F7' } });
    expect(result.getCell('A3').fill).toMatchObject({ fgColor: { argb: 'FFFFFFFF' } });
    expect(result.getCell('L2').border.bottom).toMatchObject({ style: 'thin', color: { argb: 'FFC0C0C0' } });
    expect(result.getCell('D2').alignment.horizontal).toBe('center');
    expect(result.getCell('E2').alignment.horizontal).toBe('right');
    expect(result.getCell('E2').value).toBe(10000);
    expect(result.getCell('E3').value).toBe(-1000);
    expect(result.getCell('E2').numFmt).toBe('#,##0');
    expect(result.getCell('B2').value).toBe('=문자 거래처');
    expect(result.autoFilter).toBe('A1:M3');
});

it('adapts the same reference style to the nine-column ledger without truncating decimals', () => {
    const rows = [['날짜', '거래처명', '내용', '매출금액', '입금금액', '잔액', '현장명', '비고', '팀명'], ['2026-08-01', '거래처', '내용', 123.45, 0, 123.45, '', '', ''], ['', '', '합계', 123.45, 0, 123.45, '', '', '']];
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    applyWorkbookLedgerExcelStyle(sheet, rows, 'ledger', XLSX.utils);
    expect(sheet['!cols']).toHaveLength(9);
    expect(sheet['!autofilter']?.ref).toBe('A1:I2');
    expect(sheet.D2.v).toBe(123.45);
    expect(sheet.D2.z).toBe('#,##0.##########');
    expect(sheet.I3.s.border.left.style).toBe('thin');
});
