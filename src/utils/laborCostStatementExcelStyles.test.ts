import ExcelJS from 'exceljs';
import {
  LABOR_STATEMENT_DELEGATE_FILL_ARGB,
  LABOR_STATEMENT_FIRST_PERIOD_FILL_ARGB,
  LABOR_STATEMENT_SECOND_PERIOD_FILL_ARGB,
  applyLaborStatementDayPeriodFills,
  applyLaborStatementDelegateHighlight,
  getLaborStatementDayFillArgb,
  getLaborStatementDelegateHighlightRange,
  getLaborStatementSplitPoint,
} from './laborCostStatementExcelStyles';

const getFillArgb = (cell: ExcelJS.Cell): string | undefined => {
  const fill = cell.fill as ExcelJS.FillPattern | undefined;
  return fill?.fgColor?.argb;
};

describe('labor cost statement Excel styles', () => {
  it('splits every month after day 16', () => {
    expect(getLaborStatementSplitPoint(31)).toBe(16);
    expect(getLaborStatementSplitPoint(30)).toBe(16);
    expect(getLaborStatementSplitPoint(28)).toBe(16);
  });

  it('uses separate fills for days 1-16 and days 17-31', () => {
    expect(getLaborStatementDayFillArgb(1)).toBe(LABOR_STATEMENT_FIRST_PERIOD_FILL_ARGB);
    expect(getLaborStatementDayFillArgb(16)).toBe(LABOR_STATEMENT_FIRST_PERIOD_FILL_ARGB);
    expect(getLaborStatementDayFillArgb(17)).toBe(LABOR_STATEMENT_SECOND_PERIOD_FILL_ARGB);
    expect(getLaborStatementDayFillArgb(31)).toBe(LABOR_STATEMENT_SECOND_PERIOD_FILL_ARGB);
  });

  it('highlights every delegate column from bank through payment type', () => {
    expect(getLaborStatementDelegateHighlightRange(21, true)).toEqual({
      startColumn: 24,
      endColumn: 27,
    });
    expect(getLaborStatementDelegateHighlightRange(21, false)).toEqual({
      startColumn: 24,
      endColumn: 24,
    });
    expect(LABOR_STATEMENT_DELEGATE_FILL_ARGB).toBe('FFFFF5A6');
  });

  it('keeps all requested fills after the workbook is serialized', async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('노무내역서');
    const primaryRow = worksheet.addRow(Array.from({ length: 27 }, () => ''));
    const secondaryRow = worksheet.addRow(Array.from({ length: 27 }, () => ''));

    for (let col = 24; col <= 27; col++) {
      worksheet.mergeCells(primaryRow.number, col, secondaryRow.number, col);
    }

    applyLaborStatementDayPeriodFills(primaryRow, 5, 1, 16, 31);
    applyLaborStatementDayPeriodFills(secondaryRow, 5, 17, 16, 31);
    applyLaborStatementDelegateHighlight(primaryRow, 21, true);

    const buffer = await workbook.xlsx.writeBuffer();
    const reloadedWorkbook = new ExcelJS.Workbook();
    await reloadedWorkbook.xlsx.load(buffer);
    const reloadedWorksheet = reloadedWorkbook.getWorksheet('노무내역서');

    expect(reloadedWorksheet).toBeDefined();
    const loadedPrimaryRow = reloadedWorksheet!.getRow(1);
    const loadedSecondaryRow = reloadedWorksheet!.getRow(2);
    expect(getFillArgb(loadedPrimaryRow.getCell(5))).toBe(LABOR_STATEMENT_FIRST_PERIOD_FILL_ARGB);
    expect(getFillArgb(loadedPrimaryRow.getCell(20))).toBe(LABOR_STATEMENT_FIRST_PERIOD_FILL_ARGB);
    expect(getFillArgb(loadedSecondaryRow.getCell(5))).toBe(LABOR_STATEMENT_SECOND_PERIOD_FILL_ARGB);
    expect(getFillArgb(loadedSecondaryRow.getCell(19))).toBe(LABOR_STATEMENT_SECOND_PERIOD_FILL_ARGB);
    expect(getFillArgb(loadedSecondaryRow.getCell(20))).toBeUndefined();
    for (let col = 24; col <= 27; col++) {
      expect(getFillArgb(loadedPrimaryRow.getCell(col))).toBe(LABOR_STATEMENT_DELEGATE_FILL_ARGB);
    }
  });
});
