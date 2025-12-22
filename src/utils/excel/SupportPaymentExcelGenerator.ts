import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// --- Interfaces (Mirrored from Page, or imported if shared) ---
// Ideally these should be in a shared types file, but for now defining here to be safe and independent.
interface Worker {
    workerId: string;
    workerName: string;
    role?: string;
    manDay: number;
    unitPrice: number;
    amount: number;
    date: string;
    idNumber?: string;
    contact?: string;
    address?: string;
    siteAddress?: string;
    days?: number[];
    totalManDay?: number;
    totalAmount?: number;
    displayContent?: string;
    siteName?: string;
}

interface Site {
    siteId: string;
    siteName: string;
    totalManDay: number;
    totalAmount: number;
    displayContent: string;
    workers: Worker[];
}

interface CompanyAggregate {
    companyId: string;
    companyName: string;
    bankName: string;
    accountNumber: string;
    accountHolder: string;
    totalAmount: number;
    errors: Record<string, boolean>;
    sites: Site[];
}

export const MAX_DAY_COLUMNS = 31;
export const DAY_LABELS_FIRST = Array.from({ length: 15 }, (_, i) => i + 1);
export const DAY_LABELS_SECOND = Array.from({ length: 16 }, (_, i) => i + 16);

export const generateLaborStatementExcel = async (
    data: CompanyAggregate[],
    month: string
) => {
    const workbook = new ExcelJS.Workbook();

    // Loop through each Company Aggregate and create a sheet
    for (const company of data) {
        // Sanitize sheet name (Excel limits: 31 chars, no special chars)
        const safeSheetName = (company.companyName || 'Unknown')
            .replace(/[\\/?*[\]]/g, '_')
            .substring(0, 30);

        // Handle duplicate sheet names if any (simple append)
        let sheetName = safeSheetName;
        let counter = 1;
        while (workbook.getWorksheet(sheetName)) {
            sheetName = `${safeSheetName.substring(0, 28)}(${counter})`;
            counter++;
        }

        const worksheet = workbook.addWorksheet(sheetName);

        // --- Column Setup ---
        const dayStartColumn = 4;
        const firstHalfColumns = DAY_LABELS_FIRST.length;
        const secondHalfColumns = DAY_LABELS_SECOND.length;
        const secondHalfStartColumn = dayStartColumn + firstHalfColumns;
        const grossColumn = secondHalfStartColumn + secondHalfColumns;
        const manDayColumn = grossColumn + 1;
        const unitPriceColumn = manDayColumn + 1;
        const displayColumn = unitPriceColumn + 1;
        const grossColumnLetter = getExcelColumnLetter(grossColumn);
        const manDayColumnLetter = getExcelColumnLetter(manDayColumn);
        const unitPriceColumnLetter = getExcelColumnLetter(unitPriceColumn);
        const displayColumnLetter = getExcelColumnLetter(displayColumn);

        worksheet.columns = [
            { width: 16 }, // 성명
            { width: 20 }, // 주민/전화
            { width: 30 }, // 주소
            ...Array.from({ length: MAX_DAY_COLUMNS }, () => ({ width: 4.2 })), // 1~31일
            { width: 12 }, // 노무비총
            { width: 9 }, // 출역일수
            { width: 12 }, // 노무단가
            { width: 18 } // 표시내용
        ];

        // Calculate last column letter (e.g., AL)
        // 1(A)+1(B)+1(C) + 31(Days) = 34 columns. 
        // 34 + 4 (Summary) = 38 columns?
        // Let's re-verify the indices from the original code.
        // Original: spacerIndex = 4 + 15 = 19 (T?) ... this logic was a bit complex.
        // Let's stick to the visual layout: 3 Fixed + 15 Days + 1 Spacer + 16 Days + 4 Summary

        // Let's count strictly:
        // Col 1: A (Name)
        // Col 2: B (ID/Phone)
        // Col 3: C (Address)
        // Col 4-18: Days 1-15 (15 cols)
        // Col 19: Spacer (Empty)
        // Col 20-35: Days 16-31 (16 cols)
        // Col 36: Total ManDay
        // Col 37: Unit Price
        // Col 38: Total Amount
        // Col 39: Note

        // Total cols = 3 + 15 + 1 + 16 + 4 = 39.
        // ExcelJS uses 1-based indexing.

        // Freeze panes
        worksheet.views = [{ state: 'frozen', ySplit: 4 }];

        // --- Header Rows ---
        const lastColumnLetter = getExcelColumnLetter(displayColumn);

        // Row 1: Title
        worksheet.mergeCells(`A1:${lastColumnLetter}1`);
        worksheet.getCell('A1').value = `노무내역서 (${company.companyName} / ${month})`;
        worksheet.getCell('A1').font = { size: 18, bold: true };
        worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
        worksheet.getRow(1).height = 32;

        // Row 2: Metadata
        worksheet.mergeCells(`A2:C2`);
        worksheet.getCell('A2').value = `지급월: ${month}`;
        worksheet.mergeCells(`D2:${lastColumnLetter}2`);
        worksheet.getCell('D2').value = `생성일: ${new Date().toISOString().slice(0, 10)}`;
        worksheet.getRow(2).font = { bold: true };

        // Row 3, 4: Headers
        const headerRow1 = worksheet.getRow(3);
        const headerRow2 = worksheet.getRow(4);
        headerRow1.height = 18;
        headerRow2.height = 18;

        // A: Name
        headerRow1.getCell(1).value = '성명';
        headerRow1.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        worksheet.mergeCells('A3:A4');

        // B: ID / Contact
        headerRow1.getCell(2).value = '주민등록번호';
        worksheet.mergeCells('B3:B3');
        headerRow2.getCell(2).value = '전화번호';

        // C: Address
        headerRow1.getCell(3).value = '주소';
        worksheet.mergeCells('C3:C4');

        // Days 1-15
        DAY_LABELS_FIRST.forEach((day, idx) => {
            const cellIndex = dayStartColumn + idx;
            headerRow1.getCell(cellIndex).value = day;
            headerRow1.getCell(cellIndex).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0070C0' } }; // Blue
            headerRow1.getCell(cellIndex).font = { color: { argb: 'FFFFFFFF' }, bold: true };
            headerRow1.getCell(cellIndex).alignment = { horizontal: 'center', vertical: 'middle' };
            headerRow1.getCell(cellIndex).border = { top: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' }, bottom: { style: 'thin' } };
        });

        // Days 16-31
        DAY_LABELS_SECOND.forEach((day, idx) => {
            const cellIndex = secondHalfStartColumn + idx;
            headerRow2.getCell(cellIndex).value = day <= MAX_DAY_COLUMNS ? day : '';
            headerRow2.getCell(cellIndex).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC00000' } }; // Red
            headerRow2.getCell(cellIndex).font = { color: { argb: 'FFFFFFFF' }, bold: true };
            headerRow2.getCell(cellIndex).alignment = { horizontal: 'center', vertical: 'middle' };
            headerRow2.getCell(cellIndex).border = { top: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' }, bottom: { style: 'thin' } };
        });

        // Summary Headers
        headerRow1.getCell(grossColumn).value = '노무비총';
        headerRow1.getCell(grossColumn).alignment = { horizontal: 'center', vertical: 'middle' };
        headerRow1.getCell(grossColumn).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
        headerRow1.getCell(grossColumn).font = { bold: true };
        headerRow1.getCell(grossColumn).border = { top: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' }, bottom: { style: 'thin' } };
        worksheet.mergeCells(`${getExcelColumnLetter(grossColumn)}3:${getExcelColumnLetter(grossColumn)}4`);

        const summaryLabels = ['출역일수', '노무단가', '표시내용'];
        summaryLabels.forEach((label, idx) => {
            const col = manDayColumn + idx;
            worksheet.mergeCells(`${getExcelColumnLetter(col)}3:${getExcelColumnLetter(col)}4`);
            const cell = worksheet.getCell(3, col);
            cell.value = label;
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } }; // Light Yellow
            cell.font = { bold: true };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' }, bottom: { style: 'thin' } };
        });

        // --- Data Rows ---
        const workers = company.sites.flatMap((s: Site) => s.workers);

        let currentExcelRow = 5;
        let companyTotalManDay = 0;
        let companyTotalAmount = 0;
        const companyDayTotals = new Array(32).fill(0); // Index 0 unused

        workers.forEach((row) => {
            const workerDayTotals = row.days?.reduce((acc, value) => acc + (value || 0), 0) ?? 0;
            const workerTotalManDay = typeof row.totalManDay === 'number' ? row.totalManDay : workerDayTotals;
            const workerTotalAmount =
                typeof row.totalAmount === 'number'
                    ? row.totalAmount
                    : Math.round(workerTotalManDay * (row.unitPrice || 0));

            companyTotalManDay += workerTotalManDay;
            companyTotalAmount += workerTotalAmount;

            if (row.days) {
                row.days.forEach((val, dIdx) => {
                    companyDayTotals[dIdx + 1] += val || 0;
                });
            }

            const firstRow = worksheet.getRow(currentExcelRow);
            const secondRow = worksheet.getRow(currentExcelRow + 1);
            firstRow.height = 18;
            secondRow.height = 18;

            // Name
            worksheet.mergeCells(`A${currentExcelRow}:A${currentExcelRow + 1}`);
            const nameCell = firstRow.getCell(1);
            nameCell.value = row.siteName ? `${row.workerName}\n(${row.siteName})` : row.workerName;
            nameCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            applyThinBorder(nameCell);

            // ID & Contact
            const idCell = firstRow.getCell(2);
            idCell.value = maskIdNumber(row.idNumber) || '-';
            idCell.alignment = { horizontal: 'center', vertical: 'middle' };
            applyThinBorder(idCell);

            const contactCell = secondRow.getCell(2);
            contactCell.value = row.contact?.trim() || '-';
            contactCell.alignment = { horizontal: 'center', vertical: 'middle' };
            applyThinBorder(contactCell);

            // Address
            worksheet.mergeCells(`C${currentExcelRow}:C${currentExcelRow + 1}`);
            const addressCell = firstRow.getCell(3);
            const addressLines = [row.address, row.siteAddress].filter(Boolean);
            addressCell.value = addressLines.length > 0 ? addressLines.join('\n') : '-';
            addressCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
            applyThinBorder(addressCell);

            // Day values 1~15
            DAY_LABELS_FIRST.forEach((day, idx) => {
                const colIndex = dayStartColumn + idx;
                const cell = firstRow.getCell(colIndex);
                const dayValue = row.days?.[day - 1];
                cell.value = dayValue ? formatDayValue(dayValue) : '';
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5F1FF' } };
                applyThinBorder(cell);
            });

            // Day values 16~31
            DAY_LABELS_SECOND.forEach((day, idx) => {
                if (day > MAX_DAY_COLUMNS) return;
                const colIndex = secondHalfStartColumn + idx;
                const cell = secondRow.getCell(colIndex);
                const dayValue = row.days?.[day - 1];
                cell.value = dayValue ? formatDayValue(dayValue) : '';
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDECEC' } };
                applyThinBorder(cell);
            });

            // 노무비총
            worksheet.mergeCells(`${grossColumnLetter}${currentExcelRow}:${grossColumnLetter}${currentExcelRow + 1}`);
            const grossCell = firstRow.getCell(grossColumn);
            grossCell.value = workerTotalAmount;
            grossCell.numFmt = '#,##0';
            grossCell.alignment = { horizontal: 'right', vertical: 'middle' };
            grossCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
            applyThinBorder(grossCell);

            // 출역일수
            worksheet.mergeCells(`${manDayColumnLetter}${currentExcelRow}:${manDayColumnLetter}${currentExcelRow + 1}`);
            const manDayCell = firstRow.getCell(manDayColumn);
            manDayCell.value = workerTotalManDay;
            manDayCell.numFmt = '0.0';
            manDayCell.alignment = { horizontal: 'center', vertical: 'middle' };
            applyThinBorder(manDayCell);

            // 노무단가
            worksheet.mergeCells(`${unitPriceColumnLetter}${currentExcelRow}:${unitPriceColumnLetter}${currentExcelRow + 1}`);
            const unitPriceCell = firstRow.getCell(unitPriceColumn);
            unitPriceCell.value = row.unitPrice || 0;
            unitPriceCell.numFmt = '#,##0';
            unitPriceCell.alignment = { horizontal: 'right', vertical: 'middle' };
            applyThinBorder(unitPriceCell);

            // 표시내용
            worksheet.mergeCells(`${displayColumnLetter}${currentExcelRow}:${displayColumnLetter}${currentExcelRow + 1}`);
            const displayCell = firstRow.getCell(displayColumn);
            displayCell.value = row.displayContent || '';
            displayCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
            applyThinBorder(displayCell);

            currentExcelRow += 2;
        });

        // --- Company Total Row ---
        const summaryRow = worksheet.getRow(currentExcelRow);
        worksheet.mergeCells(`A${currentExcelRow}:C${currentExcelRow}`);
        summaryRow.getCell(1).value = `[${company.companyName}] 합계`;
        summaryRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        summaryRow.getCell(1).font = { bold: true };

        // Day Totals (1-15)
        DAY_LABELS_FIRST.forEach((day, idx) => {
            const colIndex = dayStartColumn + idx;
            const val = companyDayTotals[day];
            summaryRow.getCell(colIndex).value = val > 0 ? formatDayValue(val) : '';
            summaryRow.getCell(colIndex).alignment = { horizontal: 'center', vertical: 'middle' };
        });

        // Day Totals (16-31)
        DAY_LABELS_SECOND.forEach((day, idx) => {
            const colIndex = secondHalfStartColumn + idx;
            const val = companyDayTotals[day];
            if (day <= MAX_DAY_COLUMNS) {
                summaryRow.getCell(colIndex).value = val > 0 ? formatDayValue(val) : '';
            }
            summaryRow.getCell(colIndex).alignment = { horizontal: 'center', vertical: 'middle' };
        });

        summaryRow.getCell(grossColumn).value = companyTotalAmount;
        summaryRow.getCell(grossColumn).numFmt = '#,##0';
        summaryRow.getCell(grossColumn).alignment = { horizontal: 'right', vertical: 'middle' };

        summaryRow.getCell(manDayColumn).value = companyTotalManDay;
        summaryRow.getCell(manDayColumn).alignment = { horizontal: 'center', vertical: 'middle' };

        // Styling
        summaryRow.eachCell((cell) => {
            cell.font = { bold: true };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' }, bottom: { style: 'thin' } };
        });
    }

    // Write and Save
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `노무내역서_${month}_(협력사별).xlsx`);
};

// --- Helpers ---
const formatDayValue = (val: number) => {
    if (val === 1) return '1.0';
    if (val === 0.5) return '0.5';
    return val.toString();
};

const maskIdNumber = (id: string | undefined) => {
    if (!id) return '';
    return id.substring(0, 8) + '******';
};

const applyThinBorder = (cell: ExcelJS.Cell) => {
    cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' },
        bottom: { style: 'thin' }
    };
};

const getExcelColumnLetter = (colIndex: number) => {
    let temp, letter = '';
    while (colIndex > 0) {
        temp = (colIndex - 1) % 26;
        letter = String.fromCharCode(temp + 65) + letter;
        colIndex = (colIndex - temp - 1) / 26;
    }
    return letter;
};
