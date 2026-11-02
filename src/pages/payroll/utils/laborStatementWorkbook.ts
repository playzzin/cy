import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { roundManDay, sumManDays } from '../../../utils/manDayMath';
import { getLaborStatementAccountLabel, formatLaborStatementPaymentAccountLabel } from '../../../utils/payrollLaborStatementDefaults';
import { applyLaborStatementDayPeriodFills, applyLaborStatementDelegateHighlight, getLaborStatementSplitPoint } from '../../../utils/laborCostStatementExcelStyles';

export type PayType = 'direct' | 'delegate';

export type LaborStatementRow = {
  id: number;
  workerId: string | null;
  workerName: string;
  isRetired: boolean;
  workerSsn: string;
  workerPhone: string;
  workerAddress: string;
  unitPrice: string;
  days: string[]; // 1..31
  payType: PayType;
  accountPurpose: 'default' | 'directPay';
  bankName: string;
  bankOwner: string;
  bankAccount: string;
  directBankName: string;
  directBankOwner: string;
  directBankAccount: string;
  teamName: string;
};


export const getMonthLastDay = (month: string): number => {
  const [yearText, monthText] = String(month || '').split('-');
  const year = Number(yearText);
  const monthNumber = Number(monthText);
  if (!year || !monthNumber) {
    return 31;
  }
  return new Date(year, monthNumber, 0).getDate();
};

export const createEmptyRow = (id: number): LaborStatementRow => ({
  id,
  workerId: null,
  workerName: '',
  isRetired: false,
  workerSsn: '',
  workerPhone: '',
  workerAddress: '',
  unitPrice: '',
  days: Array.from({ length: 31 }, () => ''),
  payType: 'direct',
  accountPurpose: 'default',
  bankName: '',
  bankOwner: '',
  bankAccount: '',
  directBankName: '',
  directBankOwner: '',
  directBankAccount: '',
  teamName: ''
});


export const sumDaysForMonth = (days: string[], lastDay: number): number => {
  return sumManDays(days.slice(0, Math.max(lastDay, 0)));
};


export const formatRetiredWorkerName = (name: string, isRetired: boolean): string => {
  const trimmed = name.trim();
  if (!trimmed) return '';
  return isRetired ? `${trimmed} (퇴사)` : trimmed;
};

const formatWorkerNameCell = (row: LaborStatementRow, includeTeam: boolean, includeRetired = true): string => {
  const parts = [includeRetired ? formatRetiredWorkerName(row.workerName, row.isRetired) : row.workerName.trim()];
  if (includeTeam && row.teamName.trim()) {
    parts.push(row.teamName.trim());
  }
  return parts.filter(Boolean).join('\n');
};

const formatWorkerIdentityCell = (row: LaborStatementRow): string => {
  return [row.workerSsn.trim(), row.workerPhone.trim()].filter(Boolean).join('\n');
};

const formatInlineBankInfo = (row: LaborStatementRow): string => {
  const bankParts = [row.bankName.trim(), row.bankOwner.trim(), row.bankAccount.trim()].filter(Boolean);
  const payTypeLabel = formatLaborStatementPaymentAccountLabel(row.payType, row.accountPurpose);
  if (bankParts.length === 0) return payTypeLabel;
  return `${bankParts.join(' / ')} (${payTypeLabel})`;
};

const formatAddressCell = (row: LaborStatementRow, includeBankUnderAddress: boolean): string => {
  const parts = [row.workerAddress.trim()];
  if (includeBankUnderAddress) {
    const bankLine = formatInlineBankInfo(row);
    if (bankLine) parts.push(bankLine);
  }
  return parts.filter(Boolean).join('\n');
};


const getDayOfWeek = (month: string, day: number): string => {
  const [y, m] = month.split('-').map(Number);
  if (!y || !m) return '';
  const date = new Date(y, m - 1, day);
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return days[date.getDay()];
};



export interface LaborStatementDocument {
  rows: LaborStatementRow[];
  month: string;
  siteNameInput: string;
  statementTitle: string;
  showBankColumn: boolean;
  showBillingColumns: boolean;
  showBankUnderAddress: boolean;
  showTeamUnderName: boolean;
  isSplitView: boolean;
  masterBank: string;
  masterOwner: string;
  masterAccount: string;
}

export async function downloadLaborStatementWorkbook(documents: LaborStatementDocument[], filename: string) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Codex';
  workbook.lastModifiedBy = 'Codex';
  workbook.created = new Date();
  workbook.modified = new Date();
  documents.forEach((document, index) => {
    // The numeric prefix stays unique even for identical or truncated site names.
    const sheetName = documents.length === 1 ? '노무내역서' :
      `${index + 1} ${document.siteNameInput}`.replace(/[\\/:*?[\]']/g, ' ').trim().slice(0, 31);
    const { month, statementTitle, siteNameInput, showBankColumn, showBankUnderAddress, showTeamUnderName,
      isSplitView, masterBank, masterOwner, masterAccount } = document;
    const rows = document.showBillingColumns ? document.rows : document.rows.map(row => ({ ...row, unitPrice: '' }));
    const fixedInfoColumnCount = 4;

    const ws = workbook.addWorksheet(sheetName, {
      views: [{
        state: 'frozen',
        ySplit: isSplitView ? 5 : 4,
        xSplit: fixedInfoColumnCount,
        showGridLines: false
      }]
    });
    ws.properties.defaultRowHeight = 24;

    const [y, m] = (month || '').split('-');
    const lastDay = getMonthLastDay(month);
    const showBankDetailsColumn = showBankColumn;
    const dayStartColumn = fixedInfoColumnCount + 1;
    // 공수는 반드시 숫자로 내보내야 엑셀에서 드래그 합계가 셀 개수로
    // 표시되지 않고 실제 공수 합계로 계산된다.
    const manDayCellFormat = '#,##0.0##';
    const dailyTotalCellFormat = '#,##0.0##;-#,##0.0##;';
    const moneyNumberFormat = '#,##0';
    const blackArgb = 'FF000000';
    const sundayArgb = 'FFE60012';
    const headerFillArgb = 'FFE8E6F0';
    const totalFillArgb = 'FFDCEFF4';
    const trailingHeaders = showBankDetailsColumn
      ? ['은행', '예금주', '계좌번호', '지급구분']
      : ['지급구분'];

    const daySplitPoint = isSplitView ? getLaborStatementSplitPoint(lastDay) : lastDay;
    const dayColCount = isSplitView ? Math.max(daySplitPoint, lastDay - daySplitPoint) : lastDay;
    const totalColumns = fixedInfoColumnCount + dayColCount + 3 + trailingHeaders.length;
    const summaryStartCol = fixedInfoColumnCount + dayColCount + 1;
    const toExcelColumnName = (columnNumber: number) => {
      let current = columnNumber;
      let name = '';
      while (current > 0) {
        const remainder = (current - 1) % 26;
        name = String.fromCharCode(65 + remainder) + name;
        current = Math.floor((current - 1) / 26);
      }
      return name;
    };
    const makeSumFormula = (references: string[]) => (
      references.length > 0 ? `SUM(${references.join(',')})` : '0'
    );

    // 엑셀을 열거나 공수/단가를 수정했을 때 모든 수식이 다시 계산되도록 한다.
    workbook.calcProperties.fullCalcOnLoad = true;

    ws.pageSetup = {
      orientation: 'landscape',
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      margins: {
        left: 0.25, right: 0.25, top: 0.35, bottom: 0.35, header: 0.2, footer: 0.2
      }
    };
    ws.headerFooter.oddHeader = `&C&"Malgun Gothic,Bold"${statementTitle || '노무내역서'}`;
    ws.headerFooter.oddFooter = `&L출력일 ${new Date().toLocaleDateString('ko-KR')}&R&P / &N`;

    // --- Title Row (Row 1) ---
    const titleRow = ws.addRow([statementTitle || '노무내역서']);
    ws.mergeCells(titleRow.number, 1, titleRow.number, totalColumns);
    titleRow.getCell(1).font = { bold: true, size: 18, color: { argb: blackArgb } };
    titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    titleRow.height = 40;

    // --- Info Row (Row 2) ---
    const periodStr = y && m ? `${y}-${m}-01 ~ ${y}-${m}-${String(lastDay).padStart(2, '0')}` : '-';
    ws.mergeCells(2, 1, 2, 4);
    ws.mergeCells(2, 5, 2, Math.min(12, totalColumns));
    ws.mergeCells(2, Math.min(13, totalColumns), 2, totalColumns);

    ws.getCell(2, 1).value = `기간: ${periodStr}`;
    ws.getCell(2, 5).value = `현장명: ${siteNameInput || '전체 통합'}`;
    const delegationAccount = [masterBank.trim(), masterAccount.trim()].filter(Boolean).join(' ');
    ws.getCell(2, Math.min(13, totalColumns)).value = `위임계좌번호: ${delegationAccount} / 예금주: ${masterOwner.trim()}`;

    for (let col = 1; col <= totalColumns; col++) {
      const cell = ws.getCell(2, col);
      cell.font = { bold: true, size: 10, color: { argb: blackArgb } };
      cell.alignment = { vertical: 'middle', horizontal: col === 1 ? 'left' : 'center' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    }
    ws.getRow(2).height = 25;

    // Empty row for spacing (Row 3)
    ws.addRow([]);
    ws.getRow(3).height = 10;

    // --- Header Style Helper ---
    const applyHeaderStyle = (cell: ExcelJS.Cell, isSunday = false) => {
      cell.font = { bold: true, size: 9, color: { argb: isSunday ? sundayArgb : blackArgb } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerFillArgb } };
      cell.border = {
        top: { style: 'thin', color: { argb: blackArgb } },
        bottom: { style: 'thin', color: { argb: blackArgb } },
        left: { style: 'thin', color: { argb: blackArgb } },
        right: { style: 'thin', color: { argb: blackArgb } }
      };
    };

    const isWeekend = (day: number): 'sat' | 'sun' | null => {
      const date = new Date(Number(y), Number(m) - 1, day);
      const dayOfWeek = date.getDay();
      if (dayOfWeek === 6) return 'sat';
      if (dayOfWeek === 0) return 'sun';
      return null;
    };

    // --- Header Rows (Row 4 & 5) ---
    if (isSplitView) {
      const h1: any[] = ['No', '성명', '주민등록번호', '주소'];
      for (let d = 1; d <= daySplitPoint; d++) {
        const dow = getDayOfWeek(month, d);
        h1.push(`${String(d).padStart(2, '0')}\n(${dow})`);
      }
      while (h1.length < fixedInfoColumnCount + dayColCount) h1.push('');
      h1.push('공수', '단가', '총액', ...trailingHeaders);

      const h2: any[] = ['', '', '전화번호', ''];
      for (let d = daySplitPoint + 1; d <= lastDay; d++) {
        const dow = getDayOfWeek(month, d);
        h2.push(`${String(d).padStart(2, '0')}\n(${dow})`);
      }
      while (h2.length < fixedInfoColumnCount + dayColCount) h2.push('');
      h2.push('', '', '', ...trailingHeaders.map(() => ''));

      const hr1 = ws.addRow(h1);
      const hr2 = ws.addRow(h2);

      for (let col = 1; col <= fixedInfoColumnCount; col++) {
        if (col === 3) continue;
        ws.mergeCells(hr1.number, col, hr2.number, col);
      }
      for (let col = summaryStartCol; col <= totalColumns; col++) {
        ws.mergeCells(hr1.number, col, hr2.number, col);
      }

      hr1.eachCell((cell, colNum) => {
        let isSundayCell = false;
        if (colNum >= dayStartColumn && colNum < dayStartColumn + daySplitPoint) {
          const day = colNum - fixedInfoColumnCount;
          const weekend = isWeekend(day);
          isSundayCell = weekend === 'sun';
        }
        applyHeaderStyle(cell, isSundayCell);
      });
      hr2.eachCell((cell, colNum) => {
        let isSundayCell = false;
        if (colNum >= dayStartColumn && colNum < dayStartColumn + dayColCount) {
          const day = daySplitPoint + (colNum - fixedInfoColumnCount);
          if (day <= lastDay) {
            const weekend = isWeekend(day);
            isSundayCell = weekend === 'sun';
          }
        }
        applyHeaderStyle(cell, isSundayCell);
      });
      hr1.height = 32;
      hr2.height = 32;
      ws.pageSetup.printTitlesRow = `1:${hr2.number}`;
    } else {
      const h: any[] = ['No', '성명', '주민등록번호\n전화번호', '주소'];
      for (let d = 1; d <= lastDay; d++) {
        const dow = getDayOfWeek(month, d);
        h.push(`${String(d).padStart(2, '0')}\n(${dow})`);
      }
      h.push('공수', '단가', '총액', ...trailingHeaders);
      const hr = ws.addRow(h);
      hr.eachCell((cell, colNum) => {
        let isSundayCell = false;
        if (colNum >= dayStartColumn && colNum < dayStartColumn + lastDay) {
          const day = colNum - fixedInfoColumnCount;
          const weekend = isWeekend(day);
          isSundayCell = weekend === 'sun';
        }
        applyHeaderStyle(cell, isSundayCell);
      });
      hr.height = 40;
      ws.pageSetup.printTitlesRow = `1:${hr.number}`;
    }

    // Column widths
    ws.getColumn(1).width = 4.5;
    ws.getColumn(2).width = 10;
    ws.getColumn(3).width = 15;
    ws.getColumn(4).width = 40;
    for (let i = 0; i < dayColCount; i++) ws.getColumn(dayStartColumn + i).width = 4.5;
    ws.getColumn(summaryStartCol).width = 10;
    ws.getColumn(summaryStartCol + 1).width = 10;
    ws.getColumn(summaryStartCol + 2).width = 12;
    ws.getColumn(summaryStartCol + 1).hidden = !document.showBillingColumns;
    ws.getColumn(summaryStartCol + 2).hidden = !document.showBillingColumns;
    if (showBankDetailsColumn) {
      ws.getColumn(summaryStartCol + 3).width = 12;
      ws.getColumn(summaryStartCol + 4).width = 10;
      ws.getColumn(summaryStartCol + 5).width = 22;
      ws.getColumn(summaryStartCol + 6).width = 10;
    } else {
      ws.getColumn(summaryStartCol + 3).width = 10;
    }

    const filledRows = rows.filter(r => r.workerName.trim().length > 0);
    let grandTotalDays = 0;
    let grandTotalAmount = 0;
    const dailyTotals = Array.from({ length: lastDay }, () => 0);
    const primaryDataRows: number[] = [];
    const secondaryDataRows: number[] = [];

    filledRows.forEach((r, idx) => {
      const totalDaysVal = sumDaysForMonth(r.days, lastDay);
      const unitPriceVal = parseFloat(String(r.unitPrice).replace(/,/g, '').trim()) || 0;
      const totalAmountVal = Math.round(totalDaysVal * unitPriceVal);
      grandTotalDays = roundManDay(grandTotalDays + totalDaysVal);
      grandTotalAmount += totalAmountVal;

      const bankCells = showBankDetailsColumn
        ? [r.bankName, r.bankOwner, r.bankAccount, `${r.payType === 'delegate' ? '위임' : '직불'}\n${getLaborStatementAccountLabel(r.payType, r.accountPurpose)}`]
        : [r.payType === 'delegate' ? '위임' : '직불'];
      if (isSplitView) {
        const d1: any[] = [idx + 1, formatWorkerNameCell(r, showTeamUnderName, false), r.workerSsn, formatAddressCell(r, showBankUnderAddress)];
        for (let d = 0; d < daySplitPoint; d++) {
          const val = parseFloat(r.days[d] || '');
          if (Number.isFinite(val)) dailyTotals[d] = roundManDay(dailyTotals[d] + val);
          d1.push(Number.isFinite(val) ? val : '');
        }
        while (d1.length < fixedInfoColumnCount + dayColCount) d1.push('');
        d1.push(totalDaysVal, unitPriceVal, totalAmountVal, ...bankCells);

        const d2: any[] = ['', '', r.workerPhone, ''];
        for (let d = daySplitPoint; d < lastDay; d++) {
          const val = parseFloat(r.days[d] || '');
          if (Number.isFinite(val)) dailyTotals[d] = roundManDay(dailyTotals[d] + val);
          d2.push(Number.isFinite(val) ? val : '');
        }
        while (d2.length < fixedInfoColumnCount + dayColCount) d2.push('');
        d2.push('', '', '', ...bankCells.map(() => ''));

        const row1 = ws.addRow(d1);
        const row2 = ws.addRow(d2);
        primaryDataRows.push(row1.number);
        secondaryDataRows.push(row2.number);

        for (let col = 1; col <= fixedInfoColumnCount; col++) {
          if (col === 3) continue;
          ws.mergeCells(row1.number, col, row2.number, col);
        }
        for (let col = summaryStartCol; col <= totalColumns; col++) {
          ws.mergeCells(row1.number, col, row2.number, col);
        }

        const dayStartColumnName = toExcelColumnName(dayStartColumn);
        const dayEndColumnName = toExcelColumnName(dayStartColumn + dayColCount - 1);
        const totalManDayColumnName = toExcelColumnName(summaryStartCol);
        const unitPriceColumnName = toExcelColumnName(summaryStartCol + 1);
        row1.getCell(summaryStartCol).value = {
          formula: `SUM(${dayStartColumnName}${row1.number}:${dayEndColumnName}${row1.number},${dayStartColumnName}${row2.number}:${dayEndColumnName}${row2.number})`,
          result: totalDaysVal,
        };
        row1.getCell(summaryStartCol + 2).value = {
          formula: `ROUND(${totalManDayColumnName}${row1.number}*${unitPriceColumnName}${row1.number},0)`,
          result: totalAmountVal,
        };

        [row1, row2].forEach(row => {
          row.eachCell((cell, colNum) => {
            cell.border = {
              top: { style: 'thin', color: { argb: blackArgb } },
              bottom: { style: 'thin', color: { argb: blackArgb } },
              left: { style: 'thin', color: { argb: blackArgb } },
              right: { style: 'thin', color: { argb: blackArgb } }
            };
            cell.font = { size: 9, color: { argb: blackArgb } };
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

            if (colNum >= dayStartColumn && colNum < dayStartColumn + dayColCount) {
              cell.numFmt = manDayCellFormat;
            }

            if (colNum >= summaryStartCol && colNum <= summaryStartCol + 2) {
              cell.numFmt = colNum === summaryStartCol ? manDayCellFormat : moneyNumberFormat;
              cell.alignment = { horizontal: 'right', vertical: 'middle' };
              cell.font = { size: 9, bold: colNum === summaryStartCol + 2, color: { argb: blackArgb } };
            }
          });
        });

        applyLaborStatementDayPeriodFills(row1, dayStartColumn, 1, daySplitPoint, lastDay);
        applyLaborStatementDayPeriodFills(
          row2,
          dayStartColumn,
          daySplitPoint + 1,
          dayColCount,
          lastDay
        );

        if (r.payType === 'delegate') {
          applyLaborStatementDelegateHighlight(row1, summaryStartCol, showBankDetailsColumn);
        }
      } else {
        const d: any[] = [idx + 1, formatWorkerNameCell(r, showTeamUnderName, false), formatWorkerIdentityCell(r), formatAddressCell(r, showBankUnderAddress)];
        for (let i = 0; i < lastDay; i++) {
          const val = parseFloat(r.days[i] || '');
          if (Number.isFinite(val)) dailyTotals[i] = roundManDay(dailyTotals[i] + val);
          d.push(Number.isFinite(val) ? val : '');
        }
        d.push(totalDaysVal, unitPriceVal, totalAmountVal, ...bankCells);
        const dr = ws.addRow(d);
        primaryDataRows.push(dr.number);
        const dayStartColumnName = toExcelColumnName(dayStartColumn);
        const dayEndColumnName = toExcelColumnName(dayStartColumn + lastDay - 1);
        const totalManDayColumnName = toExcelColumnName(summaryStartCol);
        const unitPriceColumnName = toExcelColumnName(summaryStartCol + 1);
        dr.getCell(summaryStartCol).value = {
          formula: `SUM(${dayStartColumnName}${dr.number}:${dayEndColumnName}${dr.number})`,
          result: totalDaysVal,
        };
        dr.getCell(summaryStartCol + 2).value = {
          formula: `ROUND(${totalManDayColumnName}${dr.number}*${unitPriceColumnName}${dr.number},0)`,
          result: totalAmountVal,
        };
        dr.eachCell((cell, colNum) => {
          cell.border = {
            top: { style: 'thin', color: { argb: blackArgb } },
            bottom: { style: 'thin', color: { argb: blackArgb } },
            left: { style: 'thin', color: { argb: blackArgb } },
            right: { style: 'thin', color: { argb: blackArgb } }
          };
          cell.font = { size: 9, color: { argb: blackArgb } };
          cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

          if (colNum >= dayStartColumn && colNum < dayStartColumn + lastDay) {
            cell.numFmt = manDayCellFormat;
          }

          if (colNum >= fixedInfoColumnCount + lastDay + 1 && colNum <= fixedInfoColumnCount + lastDay + 3) {
            cell.numFmt = colNum === fixedInfoColumnCount + lastDay + 1 ? manDayCellFormat : moneyNumberFormat;
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
            cell.font = { size: 9, bold: colNum === fixedInfoColumnCount + lastDay + 3, color: { argb: blackArgb } };
          }
        });

        applyLaborStatementDayPeriodFills(dr, dayStartColumn, 1, lastDay, lastDay);

        if (r.payType === 'delegate') {
          applyLaborStatementDelegateHighlight(dr, summaryStartCol, showBankDetailsColumn);
        }
      }
    });

    // --- Footer Row ---
    const f1: any[] = ['날짜별 공수합계', ...Array.from({ length: fixedInfoColumnCount - 1 }, () => '')];
    for (let d = 0; d < daySplitPoint; d++) f1.push(dailyTotals[d]);
    while (f1.length < fixedInfoColumnCount + dayColCount) f1.push('');
    f1.push(grandTotalDays, '', grandTotalAmount, ...trailingHeaders.map(() => ''));

    if (isSplitView) {
      const f2: any[] = Array.from({ length: fixedInfoColumnCount }, () => '');
      for (let d = daySplitPoint; d < lastDay; d++) f2.push(dailyTotals[d]);
      while (f2.length < fixedInfoColumnCount + dayColCount) f2.push('');
      f2.push('', '', '', ...trailingHeaders.map(() => ''));

      const fr1 = ws.addRow(f1);
      const fr2 = ws.addRow(f2);
      ws.mergeCells(fr1.number, 1, fr2.number, fixedInfoColumnCount);
      for (let col = summaryStartCol; col <= totalColumns; col++) {
        ws.mergeCells(fr1.number, col, fr2.number, col);
      }
      for (let dayOffset = 0; dayOffset < daySplitPoint; dayOffset++) {
        const columnName = toExcelColumnName(dayStartColumn + dayOffset);
        fr1.getCell(dayStartColumn + dayOffset).value = {
          formula: makeSumFormula(primaryDataRows.map(rowNumber => `${columnName}${rowNumber}`)),
          result: dailyTotals[dayOffset],
        };
      }
      for (let dayOffset = daySplitPoint; dayOffset < lastDay; dayOffset++) {
        const columnIndex = dayStartColumn + dayOffset - daySplitPoint;
        const columnName = toExcelColumnName(columnIndex);
        fr2.getCell(columnIndex).value = {
          formula: makeSumFormula(secondaryDataRows.map(rowNumber => `${columnName}${rowNumber}`)),
          result: dailyTotals[dayOffset],
        };
      }
      const dayStartColumnName = toExcelColumnName(dayStartColumn);
      const dayEndColumnName = toExcelColumnName(dayStartColumn + dayColCount - 1);
      const totalManDayColumnName = toExcelColumnName(summaryStartCol);
      const amountColumnName = toExcelColumnName(summaryStartCol + 2);
      fr1.getCell(summaryStartCol).value = {
        formula: `SUM(${dayStartColumnName}${fr1.number}:${dayEndColumnName}${fr1.number},${dayStartColumnName}${fr2.number}:${dayEndColumnName}${fr2.number})`,
        result: grandTotalDays,
      };
      fr1.getCell(summaryStartCol + 2).value = {
        formula: makeSumFormula(primaryDataRows.map(rowNumber => `${amountColumnName}${rowNumber}`)),
        result: grandTotalAmount,
      };
      [fr1, fr2].forEach(row => {
        row.eachCell((cell, colNum) => {
          cell.font = { bold: true, size: 10, color: { argb: blackArgb } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: totalFillArgb } };
          cell.border = {
            top: { style: 'thin', color: { argb: blackArgb } },
            bottom: { style: 'thin', color: { argb: blackArgb } },
            left: { style: 'thin', color: { argb: blackArgb } },
            right: { style: 'thin', color: { argb: blackArgb } }
          };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          if (colNum >= dayStartColumn && colNum < dayStartColumn + dayColCount) {
            cell.numFmt = dailyTotalCellFormat;
          }
          if (colNum >= summaryStartCol && colNum <= summaryStartCol + 2) {
            cell.numFmt = colNum === summaryStartCol ? manDayCellFormat : moneyNumberFormat;
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
          }
        });
      });
      fr1.height = 28;
      fr2.height = 28;
    } else {
      const fr = ws.addRow(f1);
      ws.mergeCells(fr.number, 1, fr.number, fixedInfoColumnCount);
      for (let dayOffset = 0; dayOffset < lastDay; dayOffset++) {
        const columnIndex = dayStartColumn + dayOffset;
        const columnName = toExcelColumnName(columnIndex);
        fr.getCell(columnIndex).value = {
          formula: makeSumFormula(primaryDataRows.map(rowNumber => `${columnName}${rowNumber}`)),
          result: dailyTotals[dayOffset],
        };
      }
      const dayStartColumnName = toExcelColumnName(dayStartColumn);
      const dayEndColumnName = toExcelColumnName(dayStartColumn + lastDay - 1);
      const amountColumnName = toExcelColumnName(summaryStartCol + 2);
      fr.getCell(summaryStartCol).value = {
        formula: `SUM(${dayStartColumnName}${fr.number}:${dayEndColumnName}${fr.number})`,
        result: grandTotalDays,
      };
      fr.getCell(summaryStartCol + 2).value = {
        formula: makeSumFormula(primaryDataRows.map(rowNumber => `${amountColumnName}${rowNumber}`)),
        result: grandTotalAmount,
      };
      fr.eachCell((cell, colNum) => {
        cell.font = { bold: true, size: 10, color: { argb: blackArgb } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: totalFillArgb } };
        cell.border = {
          top: { style: 'thin', color: { argb: blackArgb } },
          bottom: { style: 'thin', color: { argb: blackArgb } },
          left: { style: 'thin', color: { argb: blackArgb } },
          right: { style: 'thin', color: { argb: blackArgb } }
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        if (colNum >= dayStartColumn && colNum < dayStartColumn + lastDay) {
          cell.numFmt = dailyTotalCellFormat;
        }
        if (colNum >= fixedInfoColumnCount + lastDay + 1 && colNum <= fixedInfoColumnCount + lastDay + 3) {
          cell.numFmt = colNum === fixedInfoColumnCount + lastDay + 1 ? manDayCellFormat : moneyNumberFormat;
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        }
      });
      fr.height = 32;
    }

    for (let rowNum = 6; rowNum <= ws.rowCount; rowNum++) {
      ws.getRow(rowNum).height = 18;
    }

    const tableStartRow = 4;
    const headerEndRow = isSplitView ? 5 : 4;
    const tableEndRow = ws.rowCount;
    const footerStartRow = isSplitView ? tableEndRow - 1 : tableEndRow;
    const blackBorder = (style: ExcelJS.BorderStyle): Partial<ExcelJS.Border> => ({
      style,
      color: { argb: blackArgb }
    });
    const setBorderEdge = (
      cell: ExcelJS.Cell,
      edge: 'top' | 'bottom' | 'left' | 'right',
      style: ExcelJS.BorderStyle
    ) => {
      cell.border = {
        ...cell.border,
        [edge]: blackBorder(style)
      };
    };

    // 머리글 아래와 날짜별 공수합계 위는 이중선
    for (let col = 1; col <= totalColumns; col++) {
      setBorderEdge(ws.getCell(headerEndRow, col), 'bottom', 'double');
      setBorderEdge(ws.getCell(footerStartRow, col), 'top', 'double');
    }
    if (isSplitView) {
      // 세로 병합된 머리글/합계 셀은 좌상단 셀에도 경계를 지정해야 Excel에서 안정적으로 표시된다.
      for (let col = 1; col <= fixedInfoColumnCount; col++) {
        if (col !== 3) setBorderEdge(ws.getCell(tableStartRow, col), 'bottom', 'double');
      }
      for (let col = summaryStartCol; col <= totalColumns; col++) {
        setBorderEdge(ws.getCell(tableStartRow, col), 'bottom', 'double');
      }
      setBorderEdge(ws.getCell(footerStartRow, 1), 'top', 'double');
    }

    // 표 전체 외곽 테두리를 굵게 표시
    for (let col = 1; col <= totalColumns; col++) {
      setBorderEdge(ws.getCell(tableStartRow, col), 'top', 'thick');
      setBorderEdge(ws.getCell(tableEndRow, col), 'bottom', 'thick');
    }
    for (let row = tableStartRow; row <= tableEndRow; row++) {
      setBorderEdge(ws.getCell(row, 1), 'left', 'thick');
      setBorderEdge(ws.getCell(row, totalColumns), 'right', 'thick');
    }
  });
  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), filename);
}
