import type { WorkSheet } from 'xlsx';

type ExcelData = (string | number)[][];
type XlsxUtils = Pick<typeof import('xlsx').utils, 'encode_cell' | 'encode_range'>;

// Measured from the supplied 전체 조회 (매입) reference workbook.
const SUMMARY_WIDTHS = [9.7109375, 30.7109375, 35.7109375, 17.7109375, 17.7109375, 17.7109375, 17.7109375, 17.7109375, 17.7109375, 17.7109375, 17.7109375, 30.7109375, 17.7109375];
const LEDGER_WIDTHS = [17.7109375, 30.7109375, 35.7109375, 17.7109375, 17.7109375, 17.7109375, 35.7109375, 30.7109375, 17.7109375];
const BORDER = Object.fromEntries(['top', 'bottom', 'left', 'right'].map((edge) => [edge, {
    style: 'thin', color: { rgb: 'FFC0C0C0' }
}]));

const wrappedLineCount = (value: string | number, width: number) => String(value).split('\n').reduce((total, line) => {
    const length = Array.from(line).reduce((count, char) => count + (char.charCodeAt(0) > 255 ? 2 : 1), 0);
    return total + Math.max(1, Math.ceil(length / Math.max(1, width - 2)));
}, 0);

export const applyWorkbookLedgerExcelStyle = (
    worksheet: WorkSheet,
    data: ExcelData,
    view: 'ledger' | 'summary',
    utils: XlsxUtils
) => {
    if (data.length < 2 || data[0].length === 0) return;
    const widths = view === 'summary' ? SUMMARY_WIDTHS : LEDGER_WIDTHS;
    const centeredColumns = new Set(view === 'summary' ? [0, 3, 7, 11, 12] : [0, 7, 8]);
    worksheet['!cols'] = widths.map((width) => ({ width }));
    worksheet['!rows'] = data.map((row, index) => ({
        hpt: index === 0 || index === data.length - 1
            ? 35.1
            : Math.max(20.1, ...row.map((value, column) => wrappedLineCount(value, widths[column]) * 15 + 5.1))
    }));
    worksheet['!margins'] = { left: 0.7, right: 0.7, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 };
    worksheet['!autofilter'] = { ref: utils.encode_range({ r: 0, c: 0 }, { r: data.length - 2, c: data[0].length - 1 }) };

    data.forEach((row, rowIndex) => row.forEach((value, columnIndex) => {
        const address = utils.encode_cell({ r: rowIndex, c: columnIndex });
        const cell = worksheet[address] ?? (worksheet[address] = { t: 's', v: '' });
        const header = rowIndex === 0;
        const total = rowIndex === data.length - 1;
        const fill = header || total ? '666699' : rowIndex % 2 === 1 ? 'F0F3F7' : 'FFFFFF';
        cell.s = {
            font: { name: '맑은 고딕', sz: header ? 11 : 10, bold: header || total, color: { rgb: header || total ? 'FFFFFFFF' : 'FF000000' } },
            fill: { patternType: 'solid', fgColor: { rgb: fill } },
            border: BORDER,
            alignment: {
                horizontal: header || centeredColumns.has(columnIndex) || (total && value === '합계') ? 'center' : typeof value === 'number' ? 'right' : 'left',
                vertical: 'center',
                wrapText: true
            }
        };
        if (typeof value === 'number') cell.z = Number.isInteger(value) ? '#,##0' : '#,##0.##########';
    }));
};
