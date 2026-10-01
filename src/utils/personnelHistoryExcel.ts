import * as XLSX from 'xlsx-js-style';
import { formatNumberForDisplay } from './zeroDisplay';

export type SalaryModelFilter = '전체' | '일급제' | '월급제' | '지원팀' | '용역팀';

export interface PersonnelHistoryRow {
    workerId: string;
    name: string;
    idNumber: string;
    salaryModel: SalaryModelFilter;
    teamId: string;
    teamName: string;
    totalManDay: number;
    laborManDay: number;
    invoiceManDay: number;
    unitPrice: number;
    unitPriceBreakdown: Array<{ unitPrice: number; manDay: number; amount: number }>;
    laborAmount: number;
    invoiceAmount: number;
    totalAmount: number;
}

export const formatResidentNumberForDisplay = (rawValue: string): string => {
    const raw = String(rawValue ?? '').trim();
    if (!raw) return '';
    const digits = raw.replace(/[^0-9]/g, '');
    return digits.length === 13 ? `${digits.slice(0, 6)}-${digits.slice(6)}` : raw;
};

export const formatManDay = (value: number): string => (
    formatNumberForDisplay(value, (amount) => amount.toFixed(2))
);

export const formatPersonnelHistoryPriceDetail = (
    price: PersonnelHistoryRow['unitPriceBreakdown'][number]
): string => `${price.unitPrice.toLocaleString()}원 × ${formatManDay(price.manDay)}일 = ${price.amount.toLocaleString()}원`;

const finiteNumber = (value: number): number | string => Number.isFinite(value) ? value : '-';
const positiveNumber = (value: number): number | string => value > 0 ? finiteNumber(value) : '-';
const numberFormat = (value: number): string => {
    const decimals = value.toLocaleString('ko-KR').split('.')[1]?.length ?? 0;
    return `#,##0${decimals ? `.${'0'.repeat(decimals)}` : ''}`;
};

/** Receives the already filtered and sorted rows used by the screen. Never queries again. */
export const buildPersonnelHistoryWorkbook = (rows: readonly PersonnelHistoryRow[]): XLSX.WorkBook => {
    const values: Array<Array<string | number>> = [
        ['No', '이름', '팀명', '주민번호', '급여방식', '공수 (Man-Days)', '', '', '적용 단가', '본봉 (Total Amount)', '', ''],
        ['', '', '', '', '', '노무', '계산서', '합계', '', '노무', '계산서', '합계'],
        ...rows.map((row, index) => [
            index + 1,
            row.name,
            row.teamName || '-',
            formatResidentNumberForDisplay(row.idNumber) || '-',
            row.salaryModel,
            positiveNumber(row.laborManDay),
            positiveNumber(row.invoiceManDay),
            finiteNumber(row.totalManDay),
            row.unitPriceBreakdown.length > 1
                ? ['단가 변동', ...row.unitPriceBreakdown.map(formatPersonnelHistoryPriceDetail)].join('\n')
                : row.unitPrice === 0 ? '-' : finiteNumber(row.unitPrice),
            positiveNumber(row.laborAmount),
            positiveNumber(row.invoiceAmount),
            finiteNumber(row.totalAmount),
        ]),
    ];
    const sum = (key: 'laborManDay' | 'invoiceManDay' | 'totalManDay' | 'laborAmount' | 'invoiceAmount' | 'totalAmount') => (
        finiteNumber(rows.reduce((total, row) => total + row[key], 0))
    );
    const totalRow = values.length;
    values.push(['전체 합계', '', '', '', '', sum('laborManDay'), sum('invoiceManDay'), sum('totalManDay'), '', sum('laborAmount'), sum('invoiceAmount'), sum('totalAmount')]);

    const sheet = XLSX.utils.aoa_to_sheet(values);
    sheet['!merges'] = [
        ...[0, 1, 2, 3, 4, 8].map(c => ({ s: { r: 0, c }, e: { r: 1, c } })),
        { s: { r: 0, c: 5 }, e: { r: 0, c: 7 } },
        { s: { r: 0, c: 9 }, e: { r: 0, c: 11 } },
        { s: { r: totalRow, c: 0 }, e: { r: totalRow, c: 4 } },
    ];
    sheet['!cols'] = [6, 14, 20, 22, 12, 12, 12, 12, 48, 18, 18, 20].map(wch => ({ wch }));
    sheet['!rows'] = values.map((_, r) => ({
        hpt: r < 2 ? 24 : r === totalRow ? 28 : Math.max(28, (rows[r - 2].unitPriceBreakdown.length > 1 ? rows[r - 2].unitPriceBreakdown.length + 1 : 1) * 16 + 8),
    }));

    values.forEach((row, r) => row.forEach((_, c) => {
        const cell = sheet[XLSX.utils.encode_cell({ r, c })];
        const isHeader = r < 2;
        const isTotal = r === totalRow;
        cell.s = {
            font: { name: '맑은 고딕', sz: 10, bold: isHeader || isTotal || c === 7 || c === 11, color: { rgb: c === 11 && r === 1 ? 'FFFFFF' : c >= 9 ? '1D4ED8' : '334155' } },
            fill: { fgColor: { rgb: c === 11 && r === 1 ? '2563EB' : isHeader || isTotal ? 'F1F5F9' : c === 7 ? 'F1F5F9' : c >= 9 ? 'EFF6FF' : 'FFFFFF' } },
            alignment: { horizontal: isHeader || (isTotal && c === 0) || c === 0 ? 'center' : c >= 5 ? 'right' : 'left', vertical: 'center', wrapText: true },
            border: { bottom: { style: 'thin', color: { rgb: 'E2E8F0' } }, right: { style: 'thin', color: { rgb: 'E2E8F0' } } },
        };
        if (r >= 2 && cell.t === 'n') {
            cell.z = c >= 5 && c <= 7 ? '0.00' : numberFormat(cell.v as number);
            if ((c === 8 || c === 11) && cell.v !== 0) cell.z += '"원"';
            if (isTotal && c === 11 && rows.some(item => item.totalAmount !== 0)) {
                cell.z = `${numberFormat(cell.v as number)}" 원"`;
            }
            cell.s.numFmt = cell.z;
        }
    }));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, '인원전체내역');
    return workbook;
};
