import type ExcelJS from 'exceljs';

export const LABOR_STATEMENT_FIRST_PERIOD_END_DAY = 16;

export const LABOR_STATEMENT_FIRST_PERIOD_FILL_ARGB = 'FFFCE4D6';
export const LABOR_STATEMENT_SECOND_PERIOD_FILL_ARGB = 'FFE2F0D9';
export const LABOR_STATEMENT_DELEGATE_FILL_ARGB = 'FFFFF5A6';

export const getLaborStatementSplitPoint = (lastDay: number): number => {
  return Math.min(Math.max(Math.trunc(lastDay), 0), LABOR_STATEMENT_FIRST_PERIOD_END_DAY);
};

export const getLaborStatementDayFillArgb = (day: number): string => {
  return day <= LABOR_STATEMENT_FIRST_PERIOD_END_DAY
    ? LABOR_STATEMENT_FIRST_PERIOD_FILL_ARGB
    : LABOR_STATEMENT_SECOND_PERIOD_FILL_ARGB;
};

export const getLaborStatementDelegateHighlightRange = (
  summaryStartColumn: number,
  showBankDetailsColumn: boolean
): { startColumn: number; endColumn: number } => {
  const bankOrPaymentTypeStartColumn = summaryStartColumn + 3;
  return {
    startColumn: bankOrPaymentTypeStartColumn,
    endColumn: summaryStartColumn + (showBankDetailsColumn ? 6 : 3),
  };
};

export const applyLaborStatementDayPeriodFills = (
  row: ExcelJS.Row,
  dayStartColumn: number,
  firstDay: number,
  dayCellCount: number,
  lastDay: number
): void => {
  for (let dayOffset = 0; dayOffset < dayCellCount; dayOffset++) {
    const day = firstDay + dayOffset;
    if (day > lastDay) break;
    row.getCell(dayStartColumn + dayOffset).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: getLaborStatementDayFillArgb(day) },
    };
  }
};

export const applyLaborStatementDelegateHighlight = (
  row: ExcelJS.Row,
  summaryStartColumn: number,
  showBankDetailsColumn: boolean
): void => {
  const range = getLaborStatementDelegateHighlightRange(
    summaryStartColumn,
    showBankDetailsColumn
  );
  for (let col = range.startColumn; col <= range.endColumn; col++) {
    row.getCell(col).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: LABOR_STATEMENT_DELEGATE_FILL_ARGB },
    };
  }
};
