import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export const MAX_DAY_COLUMNS = 31;
export const DAY_LABELS_FIRST = Array.from({ length: 15 }, (_, i) => i + 1);
export const DAY_LABELS_SECOND = Array.from({ length: 16 }, (_, i) => i + 16);

export interface SupportLaborStatementExcelRow {
    workerId?: string;
    workerName: string;
    idNumber?: string;
    contact?: string;
    address?: string;
    days: number[];
    totalManDay: number;
    unitPrice: number;
    totalAmount: number;
}

export interface SupportLaborStatementExcelBlock {
    sheetName?: string;
    siteName: string;
    settlementName: string;
    direction: string;
    rows: SupportLaborStatementExcelRow[];
}

interface GenerateLaborStatementExcelOptions {
    fileName?: string;
}

const COLUMN = {
    no: 1,
    name: 2,
    identity: 3,
    address: 4,
    dayStart: 5,
    attendance: 21,
    amount: 22
};

export const generateLaborStatementExcel = async (
    statements: SupportLaborStatementExcelBlock[],
    yearMonth: string,
    options: GenerateLaborStatementExcelOptions = {}
) => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Smart Construction';
    workbook.created = new Date();

    statements.forEach((statement, statementIndex) => {
        const worksheet = workbook.addWorksheet(resolveUniqueSheetName(workbook, statement, statementIndex));
        buildStatementWorksheet(worksheet, statement, yearMonth);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), options.fileName ?? `노무내역서_${yearMonth}.xlsx`);
};

const buildStatementWorksheet = (
    worksheet: ExcelJS.Worksheet,
    statement: SupportLaborStatementExcelBlock,
    yearMonth: string
) => {
    worksheet.columns = [
        { width: 6 },
        { width: 14 },
        { width: 16 },
        { width: 28 },
        ...Array.from({ length: DAY_LABELS_SECOND.length }, () => ({ width: 4.5 })),
        { width: 9 },
        { width: 13 }
    ];
    worksheet.views = [{ state: 'frozen', ySplit: 4 }];
    worksheet.pageSetup = {
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        paperSize: 9,
        horizontalCentered: true,
        margins: {
            left: 0.25,
            right: 0.25,
            top: 0.35,
            bottom: 0.35,
            header: 0.15,
            footer: 0.15
        }
    };

    const lastColumnLetter = getExcelColumnLetter(COLUMN.amount);
    const monthNumber = parseInt(yearMonth.split('-')[1] ?? '0', 10);

    worksheet.mergeCells(`A1:${lastColumnLetter}1`);
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `노 무 비 지 급 명 세 서 (${monthNumber}월분)`;
    titleCell.font = { size: 18, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.border = { bottom: { style: 'medium', color: { argb: 'FFF59E0B' } } };
    worksheet.getRow(1).height = 34;

    worksheet.mergeCells('A2:D2');
    worksheet.getCell('A2').value = `현장명: ${statement.siteName || '-'}`;
    worksheet.mergeCells('E2:Q2');
    worksheet.getCell('E2').value = `정산 주체: ${statement.settlementName || '-'}`;
    worksheet.mergeCells('R2:V2');
    worksheet.getCell('R2').value = `※ ${statement.direction} 기준 집계`;
    ['A2', 'E2', 'R2'].forEach((address) => {
        const cell = worksheet.getCell(address);
        cell.font = { bold: true, color: address === 'R2' ? { argb: 'FFD97706' } : { argb: 'FF334155' } };
        cell.alignment = { horizontal: address === 'R2' ? 'right' : 'left', vertical: 'middle' };
    });
    worksheet.getRow(2).height = 22;

    writeHeader(worksheet);

    let currentRow = 5;
    statement.rows.forEach((row, index) => {
        writeWorkerRows(worksheet, currentRow, row, index + 1);
        currentRow += 2;
    });

    writeTotalRows(worksheet, currentRow, statement.rows, statement.settlementName);
};

const writeHeader = (worksheet: ExcelJS.Worksheet) => {
    const top = worksheet.getRow(3);
    const bottom = worksheet.getRow(4);
    top.height = 20;
    bottom.height = 20;

    worksheet.mergeCells('A3:A4');
    worksheet.mergeCells('B3:B4');
    worksheet.mergeCells('D3:D4');
    worksheet.mergeCells('U3:U4');

    top.getCell(COLUMN.no).value = 'NO';
    top.getCell(COLUMN.name).value = '성명';
    top.getCell(COLUMN.identity).value = '주민번호';
    bottom.getCell(COLUMN.identity).value = '전화번호';
    top.getCell(COLUMN.address).value = '주 소';

    DAY_LABELS_FIRST.forEach((day, idx) => {
        const cell = top.getCell(COLUMN.dayStart + idx);
        cell.value = String(day).padStart(2, '0');
        cell.fill = solidFill('FFE0F2FE');
        cell.font = { bold: true, color: { argb: 'FF0369A1' } };
    });

    const spacerCell = top.getCell(COLUMN.dayStart + DAY_LABELS_FIRST.length);
    spacerCell.value = 'X';
    spacerCell.fill = solidFill('FFF8FAFC');
    spacerCell.font = { bold: true, color: { argb: 'FF64748B' } };

    DAY_LABELS_SECOND.forEach((day, idx) => {
        const cell = bottom.getCell(COLUMN.dayStart + idx);
        cell.value = day;
        cell.fill = solidFill('FFFFF1F2');
        cell.font = { bold: true, color: { argb: 'FFBE123C' } };
    });

    top.getCell(COLUMN.attendance).value = '출역';
    top.getCell(COLUMN.amount).value = '단가';
    bottom.getCell(COLUMN.amount).value = '총액';

    for (let row = 3; row <= 4; row++) {
        for (let col = 1; col <= COLUMN.amount; col++) {
            const cell = worksheet.getCell(row, col);
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.font = { ...cell.font, bold: true };
            cell.border = mediumBorder();
        }
    }
};

const writeWorkerRows = (
    worksheet: ExcelJS.Worksheet,
    rowNumber: number,
    row: SupportLaborStatementExcelRow,
    sequence: number
) => {
    worksheet.getRow(rowNumber).height = 19;
    worksheet.getRow(rowNumber + 1).height = 19;

    worksheet.mergeCells(`A${rowNumber}:A${rowNumber + 1}`);
    worksheet.mergeCells(`B${rowNumber}:B${rowNumber + 1}`);
    worksheet.mergeCells(`D${rowNumber}:D${rowNumber + 1}`);
    worksheet.mergeCells(`U${rowNumber}:U${rowNumber + 1}`);

    worksheet.getCell(rowNumber, COLUMN.no).value = sequence;
    worksheet.getCell(rowNumber, COLUMN.name).value = row.workerName || '-';
    worksheet.getCell(rowNumber, COLUMN.identity).value = formatFullIdNumber(row.idNumber) || '-';
    worksheet.getCell(rowNumber + 1, COLUMN.identity).value = row.contact || '-';
    worksheet.getCell(rowNumber, COLUMN.address).value = row.address || '-';

    DAY_LABELS_FIRST.forEach((day, idx) => {
        const cell = worksheet.getCell(rowNumber, COLUMN.dayStart + idx);
        cell.value = formatDayValue(row.days[day - 1] ?? 0);
        cell.fill = solidFill('FFF0F9FF');
    });
    worksheet.getCell(rowNumber, COLUMN.dayStart + DAY_LABELS_FIRST.length).fill = solidFill('FFF8FAFC');

    DAY_LABELS_SECOND.forEach((day, idx) => {
        const cell = worksheet.getCell(rowNumber + 1, COLUMN.dayStart + idx);
        cell.value = formatDayValue(row.days[day - 1] ?? 0);
        cell.fill = solidFill('FFFFF7F7');
    });

    const attendanceCell = worksheet.getCell(rowNumber, COLUMN.attendance);
    attendanceCell.value = roundOneDecimal(row.totalManDay);
    attendanceCell.numFmt = '0.0';
    attendanceCell.fill = solidFill('FFF8FAFC');

    const unitPriceCell = worksheet.getCell(rowNumber, COLUMN.amount);
    unitPriceCell.value = row.unitPrice || 0;
    unitPriceCell.numFmt = '#,##0';

    const amountCell = worksheet.getCell(rowNumber + 1, COLUMN.amount);
    amountCell.value = row.totalAmount || 0;
    amountCell.numFmt = '#,##0';
    amountCell.font = { bold: true, color: { argb: 'FF4338CA' } };
    amountCell.fill = solidFill('FFECFDF5');

    for (let rowIdx = rowNumber; rowIdx <= rowNumber + 1; rowIdx++) {
        for (let col = 1; col <= COLUMN.amount; col++) {
            const cell = worksheet.getCell(rowIdx, col);
            cell.border = mediumBorder();
            cell.alignment = getBodyAlignment(col);
        }
    }
};

const writeTotalRows = (
    worksheet: ExcelJS.Worksheet,
    rowNumber: number,
    rows: SupportLaborStatementExcelRow[],
    settlementName: string
) => {
    const dayTotals = Array.from({ length: MAX_DAY_COLUMNS }, () => 0);
    rows.forEach((row) => {
        row.days.forEach((value, index) => {
            dayTotals[index] += value || 0;
        });
    });

    const totalManDay = rows.reduce((acc, row) => acc + row.totalManDay, 0);
    const totalAmount = rows.reduce((acc, row) => acc + row.totalAmount, 0);
    const avgPrice = totalManDay > 0 ? Math.round(totalAmount / totalManDay) : 0;

    worksheet.getRow(rowNumber).height = 20;
    worksheet.getRow(rowNumber + 1).height = 20;
    worksheet.mergeCells(`A${rowNumber}:D${rowNumber}`);
    worksheet.mergeCells(`A${rowNumber + 1}:D${rowNumber + 1}`);
    worksheet.mergeCells(`U${rowNumber}:U${rowNumber + 1}`);

    worksheet.getCell(rowNumber, 1).value = '합 계';
    worksheet.getCell(rowNumber + 1, 1).value = '총 액';
    if (!rows.length) worksheet.getCell(rowNumber + 1, 1).value = `${settlementName || '정산 주체'} 데이터 없음`;

    DAY_LABELS_FIRST.forEach((day, idx) => {
        const cell = worksheet.getCell(rowNumber, COLUMN.dayStart + idx);
        cell.value = formatDayValue(dayTotals[day - 1]);
    });

    DAY_LABELS_SECOND.forEach((day, idx) => {
        const cell = worksheet.getCell(rowNumber + 1, COLUMN.dayStart + idx);
        cell.value = formatDayValue(dayTotals[day - 1]);
    });

    const totalManDayCell = worksheet.getCell(rowNumber, COLUMN.attendance);
    totalManDayCell.value = roundOneDecimal(totalManDay);
    totalManDayCell.numFmt = '0.0';

    const avgPriceCell = worksheet.getCell(rowNumber, COLUMN.amount);
    avgPriceCell.value = avgPrice;
    avgPriceCell.numFmt = '#,##0';

    const totalAmountCell = worksheet.getCell(rowNumber + 1, COLUMN.amount);
    totalAmountCell.value = totalAmount;
    totalAmountCell.numFmt = '#,##0';
    totalAmountCell.font = { bold: true, color: { argb: 'FF3730A3' } };
    totalAmountCell.fill = solidFill('FFD1FAE5');

    for (let rowIdx = rowNumber; rowIdx <= rowNumber + 1; rowIdx++) {
        for (let col = 1; col <= COLUMN.amount; col++) {
            const cell = worksheet.getCell(rowIdx, col);
            cell.font = { ...cell.font, bold: true };
            cell.fill = cell.fill || solidFill('FFE2E8F0');
            cell.border = mediumBorder();
            cell.alignment = getBodyAlignment(col);
        }
    }
};

const resolveUniqueSheetName = (
    workbook: ExcelJS.Workbook,
    statement: SupportLaborStatementExcelBlock,
    index: number
): string => {
    const baseName = sanitizeSheetName(
        statement.sheetName || `${statement.siteName}_${statement.settlementName}` || `노무내역서_${index + 1}`
    );
    let sheetName = baseName;
    let counter = 1;
    while (workbook.getWorksheet(sheetName)) {
        const suffix = `(${counter})`;
        sheetName = `${baseName.slice(0, 31 - suffix.length)}${suffix}`;
        counter++;
    }
    return sheetName;
};

const sanitizeSheetName = (value: string): string => {
    const sanitized = value.replace(/[\\/?*[\]:]/g, '_').trim();
    return (sanitized || '노무내역서').slice(0, 31);
};

const formatDayValue = (value: number): string => {
    if (!value) return '';
    const rounded = roundOneDecimal(value);
    return rounded % 1 === 0 ? rounded.toFixed(1) : String(rounded);
};

const roundOneDecimal = (value: number): number => Math.round((value || 0) * 10) / 10;

const formatFullIdNumber = (value?: string): string => {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    const digits = raw.replace(/[^0-9]/g, '');
    if (digits.length === 13) return `${digits.slice(0, 6)}-${digits.slice(6)}`;
    return raw;
};

const solidFill = (argb: string): ExcelJS.Fill => ({
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb }
});

const mediumBorder = (): Partial<ExcelJS.Borders> => ({
    top: { style: 'medium' },
    left: { style: 'medium' },
    right: { style: 'medium' },
    bottom: { style: 'medium' }
});

const getBodyAlignment = (column: number): Partial<ExcelJS.Alignment> => {
    if (column === COLUMN.address) return { horizontal: 'left', vertical: 'middle', wrapText: true };
    if (column === COLUMN.amount) return { horizontal: 'right', vertical: 'middle' };
    return { horizontal: 'center', vertical: 'middle', wrapText: true };
};

const getExcelColumnLetter = (colIndex: number) => {
    let temp;
    let letter = '';
    while (colIndex > 0) {
        temp = (colIndex - 1) % 26;
        letter = String.fromCharCode(temp + 65) + letter;
        colIndex = (colIndex - temp - 1) / 26;
    }
    return letter;
};
