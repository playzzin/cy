import * as XLSX from 'xlsx-js-style';
import JSZip from 'jszip';
import type { PaymentData } from '../types/payroll';
import { formatPayrollPaymentDate } from './paymentDate';
import { maskAccountNumber, maskResidentId } from './payslipIssue';

type PayslipSheet = XLSX.WorkSheet & {
    '!pageSetup'?: Record<string, unknown>;
    '!printArea'?: string;
    '!margins'?: Record<string, number>;
    '!sheetViews'?: Array<Record<string, unknown>>;
};

type RightPanelRow = {
    kind: 'deduction' | 'deduction-empty' | 'deduction-total' | 'tax-section' | 'tax' | 'tax-empty' | 'tax-summary';
    label: string;
    amount?: number;
};

const COLORS = {
    purple: '6D28D9',
    purpleDark: '5B21B6',
    purpleSoft: 'F5F3FF',
    indigoText: '4338CA',
    slate900: '0F172A',
    slate700: '334155',
    slate600: '475569',
    slate500: '64748B',
    slate300: 'CBD5E1',
    slate200: 'E2E8F0',
    slate100: 'F1F5F9',
    slate50: 'F8FAFC',
    white: 'FFFFFF',
    rose: 'E11D48',
    roseSoft: 'FFF1F2',
    amber: '92400E',
    amberSoft: 'FEF3C7',
    emerald: '047857',
    emeraldDark: '065F46',
    emeraldSoft: 'D1FAE5',
    emeraldPale: 'ECFDF5',
} as const;

const solidFill = (rgb: string) => ({ patternType: 'solid', fgColor: { rgb } });
const thinBorder = {
    top: { style: 'thin', color: { rgb: COLORS.slate200 } },
    bottom: { style: 'thin', color: { rgb: COLORS.slate200 } },
    left: { style: 'thin', color: { rgb: COLORS.slate200 } },
    right: { style: 'thin', color: { rgb: COLORS.slate200 } },
};

const BASE_FONT = { name: '맑은 고딕', sz: 9, color: { rgb: COLORS.slate900 } };
const WON_FORMAT = '#,##0"원";[Red]-#,##0"원"';

const normalizeRow = (row: Array<string | number>): Array<string | number> => (
    Array.from({ length: 8 }, (_, index) => row[index] ?? '')
);

const makeRightPanelRows = (data: PaymentData): RightPanelRow[] => {
    const deductionLines = [
        ...(data.deductionBreakdown?.standardLines ?? []),
        ...(data.deductionBreakdown?.additionalLines ?? []),
    ];
    const taxLines = [
        ...(data.taxBreakdown?.standardLines ?? []),
        ...(data.taxBreakdown?.additionalLines ?? []),
    ];
    const deductionTotal = deductionLines.reduce((sum, line) => sum + Number(line.amount || 0), 0);

    return [
        ...(deductionLines.length > 0
            ? deductionLines.map<RightPanelRow>((line) => ({
                kind: 'deduction',
                label: line.label,
                amount: -Math.abs(Number(line.amount || 0)),
            }))
            : [{ kind: 'deduction-empty' as const, label: '공제 내역이 없습니다.' }]),
        {
            kind: 'deduction-total',
            label: '공제 합계',
            amount: -Math.abs(deductionTotal),
        },
        {
            kind: 'tax-section',
            label: `세금내역 · 총 ${taxLines.length}건`,
        },
        ...(taxLines.length > 0
            ? taxLines.map<RightPanelRow>((line) => ({
                kind: 'tax',
                label: line.label,
                amount: -Math.abs(Number(line.amount || 0)),
            }))
            : [{ kind: 'tax-empty' as const, label: '세금 내역이 없습니다.' }]),
        { kind: 'tax-summary', label: '세전 금액', amount: Number(data.grossAmount || 0) },
        { kind: 'tax-summary', label: '세후 금액', amount: Number(data.totalAmount || 0) },
    ];
};

const ensureCell = (sheet: XLSX.WorkSheet, row: number, col: number): XLSX.CellObject => {
    const address = XLSX.utils.encode_cell({ r: row, c: col });
    if (!sheet[address]) {
        sheet[address] = { t: 's', v: '' };
    }
    return sheet[address] as XLSX.CellObject;
};

const applyStyle = (
    sheet: XLSX.WorkSheet,
    row: number,
    col: number,
    style: XLSX.CellObject['s']
) => {
    ensureCell(sheet, row, col).s = style;
};

const applyRangeStyle = (
    sheet: XLSX.WorkSheet,
    startRow: number,
    endRow: number,
    startCol: number,
    endCol: number,
    style: XLSX.CellObject['s']
) => {
    for (let row = startRow; row <= endRow; row += 1) {
        for (let col = startCol; col <= endCol; col += 1) {
            applyStyle(sheet, row, col, style);
        }
    }
};

const setFormulaCell = (
    sheet: XLSX.WorkSheet,
    row: number,
    col: number,
    formula: string,
    value: number
) => {
    const cell = ensureCell(sheet, row, col);
    cell.t = 'n';
    cell.f = formula;
    cell.v = value;
};

export interface PayslipWorkbookBuildResult {
    workbook: XLSX.WorkBook;
    sheetName: string;
    printArea: string;
    layout: {
        titleRow: number;
        detailStartRow: number;
        workSummaryRow: number;
        footerValueRow: number;
        lastRow: number;
    };
}

export interface PayslipWorkbookArchiveResult {
    fileNames: string[];
}

/**
 * 미리보기의 카드형 노임명세서를 Excel A:H 인쇄영역으로 재현한다.
 * 행 번호는 내부적으로 0부터 시작하며, 반환되는 printArea는 Excel 주소 형식이다.
 */
export const buildPayslipWorkbook = (
    data: PaymentData,
    contractorName: string
): PayslipWorkbookBuildResult => {
    const workEntries = data.workEntries ?? [];
    const deductionCount = (
        (data.deductionBreakdown?.standardLines.length ?? 0)
        + (data.deductionBreakdown?.additionalLines.length ?? 0)
    );
    const rightRows = makeRightPanelRows(data);
    const detailRowCount = Math.max(workEntries.length, rightRows.length, 1);
    const totalWorkManDay = workEntries.reduce((sum, entry) => sum + Number(entry.manDay || 0), 0);
    const paymentDateText = formatPayrollPaymentDate(data.month);

    const rows: Array<Array<string | number>> = [];
    const merges: XLSX.Range[] = [];
    const pushRow = (row: Array<string | number>) => {
        rows.push(normalizeRow(row));
        return rows.length - 1;
    };
    const merge = (rowStart: number, colStart: number, rowEnd: number, colEnd: number) => {
        merges.push({ s: { r: rowStart, c: colStart }, e: { r: rowEnd, c: colEnd } });
    };

    const titleRow = pushRow([`${data.month} 노임명세서`]);
    merge(titleRow, 0, titleRow, 7);
    const subtitleRow = pushRow(['근무내역 · 공제내역 · 실지급액을 한눈에 확인']);
    merge(subtitleRow, 0, subtitleRow, 7);
    const topSpacerRow = pushRow([]);
    const infoHeaderRow = pushRow(['사원 정보']);
    merge(infoHeaderRow, 0, infoHeaderRow, 7);
    const infoRow1 = pushRow([
        '성명', data.workerName,
        '팀', data.teamName,
        '지급월', data.month,
        '지급일', paymentDateText,
    ]);
    const infoRow2 = pushRow([
        '근로자 식별', maskResidentId(data.idNumber || data.workerId), '',
        '시공사', contractorName || data.companyName || '-', '',
        '은행 · 계좌', `${data.bankName || '-'} · ${maskAccountNumber(data.accountNumber)}`,
    ]);
    merge(infoRow2, 1, infoRow2, 2);
    merge(infoRow2, 4, infoRow2, 5);

    const summaryLabelRow = pushRow(['총 공수', '', '지급전 금액', '', '', '실 지급액']);
    merge(summaryLabelRow, 0, summaryLabelRow, 1);
    merge(summaryLabelRow, 2, summaryLabelRow, 4);
    merge(summaryLabelRow, 5, summaryLabelRow, 7);
    const displayedManDay = workEntries.length > 0 ? totalWorkManDay : Number(data.totalManDay || 0);
    const summaryValueRow = pushRow([Number(displayedManDay.toFixed(1)), '', data.grossAmount, '', '', data.totalAmount]);
    merge(summaryValueRow, 0, summaryValueRow, 1);
    merge(summaryValueRow, 2, summaryValueRow, 4);
    merge(summaryValueRow, 5, summaryValueRow, 7);

    const sectionSpacerRow = pushRow([]);
    const sectionHeaderRow = pushRow([
        `근무내역 · 총 ${workEntries.length}건`, '', '', '', '', '',
        `공제내역 · 총 ${deductionCount}건`, '',
    ]);
    merge(sectionHeaderRow, 0, sectionHeaderRow, 5);
    merge(sectionHeaderRow, 6, sectionHeaderRow, 7);
    const tableHeaderRow = pushRow(['일자', '현장', '구분', '공수', '단가', '금액', '항목', '금액']);
    const detailStartRow = rows.length;

    for (let index = 0; index < detailRowCount; index += 1) {
        const work = workEntries[index];
        const right = rightRows[index];
        const detailRow = pushRow([
            work?.date ?? '',
            work?.siteName ?? '',
            work ? (work.paymentMethod || '-') : '',
            work ? Number(work.manDay.toFixed(1)) : '',
            work ? Number(work.unitPrice || 0) : '',
            work ? Number(work.amount || 0) : '',
            right?.label ?? '',
            right?.amount ?? '',
        ]);

        if (right?.kind === 'tax-section' || right?.kind === 'deduction-empty' || right?.kind === 'tax-empty') {
            merge(detailRow, 6, detailRow, 7);
        }
    }

    const workSummaryRow = pushRow([
        '근무 합계', '', '', Number(totalWorkManDay.toFixed(1)), '', data.grossAmount,
        '총 차감액', -Math.abs(Number(data.totalDeduction || 0)),
    ]);
    merge(workSummaryRow, 0, workSummaryRow, 2);
    const footerSpacerRow = pushRow([]);
    const footerLabelRow = pushRow(['총 공제금', '', '', '', '실 지급액']);
    merge(footerLabelRow, 0, footerLabelRow, 3);
    merge(footerLabelRow, 4, footerLabelRow, 7);
    const footerValueRow = pushRow([Math.abs(Number(data.totalDeduction || 0)), '', '', '', data.totalAmount]);
    merge(footerValueRow, 0, footerValueRow, 3);
    merge(footerValueRow, 4, footerValueRow, 7);
    const footerNoteRow = pushRow(['공제 및 세금 합계', '', '', '', `지급전 ${Number(data.grossAmount || 0).toLocaleString('ko-KR')}원 - 차감 ${Number(data.totalDeduction || 0).toLocaleString('ko-KR')}원`]);
    merge(footerNoteRow, 0, footerNoteRow, 3);
    merge(footerNoteRow, 4, footerNoteRow, 7);

    const sheet = XLSX.utils.aoa_to_sheet(rows) as PayslipSheet;
    sheet['!merges'] = merges;
    sheet['!cols'] = [
        { wch: 14 },
        { wch: 22 },
        { wch: 10 },
        { wch: 9 },
        { wch: 14 },
        { wch: 16 },
        { wch: 22 },
        { wch: 17 },
    ];
    sheet['!rows'] = rows.map((_, rowIndex) => {
        if (rowIndex === titleRow) return { hpx: 36 };
        if (rowIndex === subtitleRow) return { hpx: 24 };
        if (rowIndex === topSpacerRow || rowIndex === sectionSpacerRow || rowIndex === footerSpacerRow) return { hpx: 8 };
        if (rowIndex === summaryValueRow || rowIndex === footerValueRow) return { hpx: 32 };
        if (rowIndex === infoHeaderRow || rowIndex === sectionHeaderRow || rowIndex === tableHeaderRow) return { hpx: 25 };
        return { hpx: 23 };
    });

    const baseStyle: XLSX.CellObject['s'] = {
        font: BASE_FONT,
        alignment: { vertical: 'center' },
        fill: solidFill(COLORS.white),
    };
    applyRangeStyle(sheet, 0, rows.length - 1, 0, 7, baseStyle);

    const titleStyle: XLSX.CellObject['s'] = {
        font: { ...BASE_FONT, bold: true, sz: 20, color: { rgb: COLORS.white } },
        alignment: { horizontal: 'center', vertical: 'center' },
        fill: solidFill(COLORS.purple),
    };
    const subtitleStyle: XLSX.CellObject['s'] = {
        font: { ...BASE_FONT, sz: 9, color: { rgb: 'EDE9FE' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        fill: solidFill(COLORS.purpleDark),
    };
    applyRangeStyle(sheet, titleRow, titleRow, 0, 7, titleStyle);
    applyRangeStyle(sheet, subtitleRow, subtitleRow, 0, 7, subtitleStyle);

    const sectionTitleStyle: XLSX.CellObject['s'] = {
        font: { ...BASE_FONT, bold: true, sz: 10, color: { rgb: COLORS.slate700 } },
        alignment: { horizontal: 'left', vertical: 'center' },
        fill: solidFill(COLORS.slate50),
        border: thinBorder,
    };
    applyRangeStyle(sheet, infoHeaderRow, infoHeaderRow, 0, 7, sectionTitleStyle);

    const infoKeyStyle: XLSX.CellObject['s'] = {
        font: { ...BASE_FONT, bold: true, color: { rgb: COLORS.slate600 } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        fill: solidFill(COLORS.slate100),
        border: thinBorder,
    };
    const infoValueStyle: XLSX.CellObject['s'] = {
        font: BASE_FONT,
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        fill: solidFill(COLORS.white),
        border: thinBorder,
    };
    [0, 2, 4, 6].forEach((col) => applyStyle(sheet, infoRow1, col, infoKeyStyle));
    [1, 3, 5, 7].forEach((col) => applyStyle(sheet, infoRow1, col, infoValueStyle));
    [0, 3, 6].forEach((col) => applyStyle(sheet, infoRow2, col, infoKeyStyle));
    [[1, 2], [4, 5], [7, 7]].forEach(([start, end]) => applyRangeStyle(sheet, infoRow2, infoRow2, start, end, infoValueStyle));

    const summaryLabelStyle: XLSX.CellObject['s'] = {
        font: { ...BASE_FONT, bold: true, color: { rgb: COLORS.slate500 } },
        alignment: { horizontal: 'center', vertical: 'center' },
        fill: solidFill(COLORS.slate50),
        border: thinBorder,
    };
    const summaryValueStyle: XLSX.CellObject['s'] = {
        font: { ...BASE_FONT, bold: true, sz: 14, color: { rgb: COLORS.slate900 } },
        alignment: { horizontal: 'center', vertical: 'center' },
        fill: solidFill(COLORS.white),
        border: thinBorder,
    };
    applyRangeStyle(sheet, summaryLabelRow, summaryLabelRow, 0, 7, summaryLabelStyle);
    applyRangeStyle(sheet, summaryValueRow, summaryValueRow, 0, 7, summaryValueStyle);
    applyRangeStyle(sheet, summaryValueRow, summaryValueRow, 5, 7, {
        ...summaryValueStyle,
        font: { ...BASE_FONT, bold: true, sz: 14, color: { rgb: COLORS.emerald } },
        fill: solidFill(COLORS.emeraldPale),
    });

    const panelHeaderStyle: XLSX.CellObject['s'] = {
        font: { ...BASE_FONT, bold: true, sz: 10, color: { rgb: COLORS.slate700 } },
        alignment: { horizontal: 'left', vertical: 'center' },
        fill: solidFill(COLORS.slate50),
        border: thinBorder,
    };
    applyRangeStyle(sheet, sectionHeaderRow, sectionHeaderRow, 0, 7, panelHeaderStyle);

    const tableHeaderStyle: XLSX.CellObject['s'] = {
        font: { ...BASE_FONT, bold: true, color: { rgb: COLORS.slate600 } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        fill: solidFill(COLORS.slate100),
        border: thinBorder,
    };
    applyRangeStyle(sheet, tableHeaderRow, tableHeaderRow, 0, 7, tableHeaderStyle);

    for (let index = 0; index < detailRowCount; index += 1) {
        const rowIndex = detailStartRow + index;
        const work = workEntries[index];
        const right = rightRows[index];
        const workStyle: XLSX.CellObject['s'] = {
            font: BASE_FONT,
            alignment: { vertical: 'center', wrapText: true },
            fill: solidFill(index % 2 === 0 ? COLORS.white : COLORS.slate50),
            border: thinBorder,
        };
        applyRangeStyle(sheet, rowIndex, rowIndex, 0, 5, workStyle);
        [0, 2].forEach((col) => {
            ensureCell(sheet, rowIndex, col).s = { ...workStyle, alignment: { horizontal: 'center', vertical: 'center' } };
        });
        [3, 4, 5].forEach((col) => {
            ensureCell(sheet, rowIndex, col).s = { ...workStyle, alignment: { horizontal: 'right', vertical: 'center' } };
        });
        if (work) {
            ensureCell(sheet, rowIndex, 3).z = '0.0';
            ensureCell(sheet, rowIndex, 4).z = WON_FORMAT;
            ensureCell(sheet, rowIndex, 5).z = WON_FORMAT;
        }

        const rightBase: XLSX.CellObject['s'] = {
            font: BASE_FONT,
            alignment: { vertical: 'center', wrapText: true },
            fill: solidFill(COLORS.white),
            border: thinBorder,
        };
        let rightStyle = rightBase;
        if (right?.kind === 'deduction') {
            rightStyle = { ...rightBase, fill: solidFill(COLORS.roseSoft) };
        } else if (right?.kind === 'deduction-total') {
            rightStyle = {
                ...rightBase,
                font: { ...BASE_FONT, bold: true, color: { rgb: COLORS.amber } },
                fill: solidFill(COLORS.amberSoft),
            };
        } else if (right?.kind === 'tax-section') {
            rightStyle = {
                ...rightBase,
                font: { ...BASE_FONT, bold: true, color: { rgb: COLORS.slate700 } },
                fill: solidFill(COLORS.slate50),
            };
        } else if (right?.kind === 'tax') {
            rightStyle = { ...rightBase, fill: solidFill(COLORS.slate50) };
        } else if (right?.kind === 'tax-summary') {
            rightStyle = {
                ...rightBase,
                font: { ...BASE_FONT, bold: true, color: { rgb: right.label === '세후 금액' ? COLORS.emerald : COLORS.slate700 } },
                fill: solidFill(right.label === '세후 금액' ? COLORS.emeraldPale : COLORS.white),
            };
        } else if (right?.kind === 'deduction-empty' || right?.kind === 'tax-empty') {
            rightStyle = {
                ...rightBase,
                font: { ...BASE_FONT, italic: true, color: { rgb: COLORS.slate500 } },
                alignment: { horizontal: 'center', vertical: 'center' },
            };
        }
        applyRangeStyle(sheet, rowIndex, rowIndex, 6, 7, rightStyle);
        if (right?.amount !== undefined) {
            const amountCell = ensureCell(sheet, rowIndex, 7);
            amountCell.s = {
                ...rightStyle,
                font: {
                    ...((rightStyle as any)?.font ?? BASE_FONT),
                    bold: right?.kind === 'deduction-total' || right?.kind === 'tax-summary',
                    color: {
                        rgb: right.amount < 0
                            ? COLORS.rose
                            : right.label === '세후 금액'
                                ? COLORS.emerald
                                : COLORS.slate700,
                    },
                },
                alignment: { horizontal: 'right', vertical: 'center' },
            };
            amountCell.z = WON_FORMAT;
        }
    }

    const workSummaryStyle: XLSX.CellObject['s'] = {
        font: { ...BASE_FONT, bold: true, color: { rgb: COLORS.indigoText } },
        alignment: { vertical: 'center' },
        fill: solidFill(COLORS.purpleSoft),
        border: thinBorder,
    };
    applyRangeStyle(sheet, workSummaryRow, workSummaryRow, 0, 5, workSummaryStyle);
    applyRangeStyle(sheet, workSummaryRow, workSummaryRow, 6, 7, {
        font: { ...BASE_FONT, bold: true, color: { rgb: COLORS.rose } },
        alignment: { vertical: 'center' },
        fill: solidFill(COLORS.roseSoft),
        border: thinBorder,
    });
    [3, 5, 7].forEach((col) => {
        ensureCell(sheet, workSummaryRow, col).s = {
            ...(ensureCell(sheet, workSummaryRow, col).s as XLSX.CellObject['s']),
            alignment: { horizontal: 'right', vertical: 'center' },
        };
    });
    ensureCell(sheet, workSummaryRow, 3).z = '0.0';
    ensureCell(sheet, workSummaryRow, 5).z = WON_FORMAT;
    ensureCell(sheet, workSummaryRow, 7).z = WON_FORMAT;

    const footerLabelStyle: XLSX.CellObject['s'] = {
        font: { ...BASE_FONT, bold: true, color: { rgb: COLORS.emerald } },
        alignment: { horizontal: 'left', vertical: 'center' },
        fill: solidFill(COLORS.emeraldSoft),
        border: thinBorder,
    };
    const footerValueStyle: XLSX.CellObject['s'] = {
        font: { ...BASE_FONT, bold: true, sz: 18, color: { rgb: COLORS.emeraldDark } },
        alignment: { horizontal: 'left', vertical: 'center' },
        fill: solidFill(COLORS.emeraldSoft),
        border: thinBorder,
    };
    const footerNoteStyle: XLSX.CellObject['s'] = {
        font: { ...BASE_FONT, sz: 8, color: { rgb: COLORS.emerald } },
        alignment: { horizontal: 'left', vertical: 'center' },
        fill: solidFill(COLORS.emeraldSoft),
        border: thinBorder,
    };
    applyRangeStyle(sheet, footerLabelRow, footerLabelRow, 0, 7, footerLabelStyle);
    applyRangeStyle(sheet, footerValueRow, footerValueRow, 0, 7, footerValueStyle);
    applyRangeStyle(sheet, footerNoteRow, footerNoteRow, 0, 7, footerNoteStyle);
    applyRangeStyle(sheet, footerLabelRow, footerNoteRow, 4, 7, {
        ...footerLabelStyle,
        alignment: { horizontal: 'right', vertical: 'center' },
    });
    applyRangeStyle(sheet, footerValueRow, footerValueRow, 4, 7, {
        ...footerValueStyle,
        font: { ...BASE_FONT, bold: true, sz: 20, color: { rgb: COLORS.emeraldDark } },
        alignment: { horizontal: 'right', vertical: 'center' },
    });
    applyRangeStyle(sheet, footerNoteRow, footerNoteRow, 4, 7, {
        ...footerNoteStyle,
        alignment: { horizontal: 'right', vertical: 'center' },
    });
    ensureCell(sheet, footerValueRow, 0).z = WON_FORMAT;
    ensureCell(sheet, footerValueRow, 4).z = WON_FORMAT;

    // 결과값은 즉시 보이고, 사용자가 세부 금액을 수정하면 Excel에서 다시 계산된다.
    const excelDetailStart = detailStartRow + 1;
    const excelDetailEnd = detailStartRow + detailRowCount;
    setFormulaCell(sheet, workSummaryRow, 3, `SUM(D${excelDetailStart}:D${excelDetailEnd})`, Number(totalWorkManDay.toFixed(1)));
    setFormulaCell(sheet, workSummaryRow, 5, `SUM(F${excelDetailStart}:F${excelDetailEnd})`, Number(data.grossAmount || 0));
    setFormulaCell(sheet, summaryValueRow, 0, `D${workSummaryRow + 1}`, Number(displayedManDay.toFixed(1)));
    setFormulaCell(sheet, summaryValueRow, 2, `F${workSummaryRow + 1}`, Number(data.grossAmount || 0));
    setFormulaCell(sheet, summaryValueRow, 5, `F${workSummaryRow + 1}+H${workSummaryRow + 1}`, Number(data.totalAmount || 0));
    setFormulaCell(sheet, footerValueRow, 0, `-H${workSummaryRow + 1}`, Math.abs(Number(data.totalDeduction || 0)));
    setFormulaCell(sheet, footerValueRow, 4, `F${workSummaryRow + 1}+H${workSummaryRow + 1}`, Number(data.totalAmount || 0));
    ensureCell(sheet, summaryValueRow, 0).z = '0.0';
    ensureCell(sheet, summaryValueRow, 2).z = WON_FORMAT;
    ensureCell(sheet, summaryValueRow, 5).z = WON_FORMAT;

    const lastRow = rows.length - 1;
    const printArea = `A1:H${lastRow + 1}`;
    sheet['!pageSetup'] = {
        orientation: 'landscape',
        paperSize: 9,
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 1,
        horizontalCentered: true,
    };
    sheet['!printArea'] = printArea;
    sheet['!margins'] = { left: 0.25, right: 0.25, top: 0.3, bottom: 0.3, header: 0, footer: 0 };
    sheet['!sheetViews'] = [{ showGridLines: false }];

    const workbook = XLSX.utils.book_new();
    const sheetName = '노임명세서';
    XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
    (workbook as any).Workbook = (workbook as any).Workbook ?? {};
    (workbook as any).Workbook.CalcPr = { calcMode: 'auto', fullCalcOnLoad: true };
    (workbook as any).Workbook.Names = [
        { Name: '_xlnm.Print_Area', Sheet: 0, Ref: `'${sheetName}'!$A$1:$H$${lastRow + 1}` },
    ];
    (workbook as any).Props = {
        ...(workbook as any).Props,
        Title: `${data.month} ${data.workerName} 노임명세서`,
        Subject: '월급제 노임명세서',
        Author: contractorName || data.companyName || '',
    };

    return {
        workbook,
        sheetName,
        printArea,
        layout: {
            titleRow,
            detailStartRow,
            workSummaryRow,
            footerValueRow,
            lastRow,
        },
    };
};

const sanitizeFilePart = (value: string, fallback: string): string => {
    const safe = String(value ?? '')
        .trim()
        .replace(/[\\/:*?"<>|]/g, '_')
        .replace(/\s+/g, ' ');
    return safe || fallback;
};

export const getPayslipWorkbookFileName = (data: PaymentData): string => {
    const workerName = sanitizeFilePart(data.workerName, '작업자');
    const month = sanitizeFilePart(data.month, '지급월');
    return `노임명세서_${workerName}_${month}.xlsx`;
};

/** ZIP 안에 작업자별 개별 Excel 명세서를 추가하고 실제 파일명 목록을 반환한다. */
export const appendPayslipWorkbooksToZip = (
    zip: JSZip,
    rows: PaymentData[],
    contractorName: string
): PayslipWorkbookArchiveResult => {
    const usedNames = new Map<string, number>();
    const fileNames: string[] = [];

    rows.forEach((data) => {
        const baseName = getPayslipWorkbookFileName(data);
        const duplicateCount = usedNames.get(baseName) ?? 0;
        usedNames.set(baseName, duplicateCount + 1);
        const fileName = duplicateCount === 0
            ? baseName
            : baseName.replace(/\.xlsx$/i, `_${duplicateCount + 1}.xlsx`);
        const { workbook } = buildPayslipWorkbook(data, contractorName);
        const bytes = XLSX.write(workbook, {
            type: 'array',
            bookType: 'xlsx',
            cellStyles: true,
        });
        zip.file(fileName, bytes);
        fileNames.push(fileName);
    });

    return { fileNames };
};
