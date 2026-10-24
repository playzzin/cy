import * as XLSX from 'xlsx-js-style';
import type { KBPreviewSnapshot } from '../MonthlyWageModel';
import { formatKBPrimaryAccountLabel, getKBValidationMessages } from './kbTransferExport';

const sanitizeKBExcelText = (value: unknown): string => String(value ?? '').replace(/\r?\n/g, ' ').trim();

/** Builds the reviewed snapshot without saving files or changing payroll data. */
export function buildKBTransferWorkbook(snapshot: KBPreviewSnapshot): XLSX.WorkBook {
    const invalidRows = snapshot.rows.filter(row => row.validationErrors.length > 0);
    const validRows = snapshot.rows.filter(row => row.validationErrors.length === 0);

    // 셀 스타일 정의 (연두색 배경 - KB은행 양식)
    const greenStyle = {
        fill: { fgColor: { rgb: 'C6EFCE' }, patternType: 'solid' },
        font: { name: '맑은 고딕', sz: 10 },
        alignment: { horizontal: 'left' as const, vertical: 'center' as const },
        border: {
            top: { style: 'thin' as const, color: { rgb: '000000' } },
            bottom: { style: 'thin' as const, color: { rgb: '000000' } },
            left: { style: 'thin' as const, color: { rgb: '000000' } },
            right: { style: 'thin' as const, color: { rgb: '000000' } }
        }
    };

    const greenNumberStyle = {
        fill: { fgColor: { rgb: 'C6EFCE' }, patternType: 'solid' },
        font: { name: '맑은 고딕', sz: 10 },
        alignment: { horizontal: 'right' as const, vertical: 'center' as const },
        border: {
            top: { style: 'thin' as const, color: { rgb: '000000' } },
            bottom: { style: 'thin' as const, color: { rgb: '000000' } },
            left: { style: 'thin' as const, color: { rgb: '000000' } },
            right: { style: 'thin' as const, color: { rgb: '000000' } }
        },
        numFmt: '#,##0'
    };

    const headerRow: (string | number)[] = [
        'A. 은행코드',
        'B. 계좌번호',
        'C. 이체금액',
        'D. 받는분통장표시',
        'E. 내통장메모',
    ];

    const rowData: (string | number)[][] = validRows.map(row => [
        sanitizeKBExcelText(row.bankCode),
        sanitizeKBExcelText(row.accountNumber),
        row.amount,
        sanitizeKBExcelText(row.receiverDisplay),
        sanitizeKBExcelText(row.senderMemo)
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headerRow, ...rowData]);

    const headerStyle = {
        fill: { fgColor: { rgb: 'FDE68A' }, patternType: 'solid' },
        font: { name: '맑은 고딕', sz: 10, bold: true, color: { rgb: '7C2D12' } },
        alignment: { horizontal: 'center' as const, vertical: 'center' as const },
        border: {
            top: { style: 'thin' as const, color: { rgb: 'B45309' } },
            bottom: { style: 'thin' as const, color: { rgb: 'B45309' } },
            left: { style: 'thin' as const, color: { rgb: 'B45309' } },
            right: { style: 'thin' as const, color: { rgb: 'B45309' } }
        }
    };

    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let R = range.s.r; R <= range.e.r; R++) {
        for (let C = range.s.c; C <= range.e.c; C++) {
            const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
            const cell = ws[cellAddress];
            if (!cell) continue;
            if (R === range.s.r) {
                cell.s = headerStyle;
                continue;
            }
            if (R > range.s.r && (C === 0 || C === 1 || C === 3 || C === 4)) {
                cell.v = sanitizeKBExcelText(cell.v);
                cell.t = 's';
                cell.z = '@';
            }
            if (C === 2) {
                cell.s = greenNumberStyle;
                cell.t = 'n';
            } else {
                cell.s = greenStyle;
            }
        }
    }

    ws['!cols'] = [
        { wch: 8 },
        { wch: 20 },
        { wch: 15 },
        { wch: 12 },
        { wch: 18 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '국민은행용');

    const verificationRows: (string | number)[][] = [
        ['항목', '값'],
        ['생성일시', snapshot.criteria.generatedAt],
        ['적용 대표계좌', snapshot.primaryAccount ? formatKBPrimaryAccountLabel(snapshot.primaryAccount) : '미설정'],
        ['대표계좌 적용 인원', snapshot.rows.filter((row) => row.usesPrimaryAccount).length],
        ['기간', snapshot.criteria.rangeLabel],
        ['팀/대상', snapshot.criteria.targetLabel],
        ['구분 필터', snapshot.criteria.salaryFilterLabel],
        ['금액 기준', snapshot.criteria.amountTypeLabel],
        ['공제 적용 상태', snapshot.criteria.deductionStatusLabel],
        ['원본 대상', snapshot.criteria.sourceCount],
        ['다운로드 행', validRows.length],
        ['검증 오류 제외', invalidRows.length],
        ['기타 제외 행', snapshot.criteria.excludedCount],
        ['총 이체금액', validRows.reduce((sum, row) => sum + row.amount, 0)],
        [],
        ['다운로드 행 검증', '상태', '계좌 적용', '은행명', '은행코드', '계좌번호', '예금주', '이체금액'],
        ...snapshot.rows.map((row) => [
            `${row.month} ${row.teamName} ${row.workerName}`,
            row.validationErrors.length > 0 ? `다운로드 제외: ${getKBValidationMessages(row)}` : '정상',
            row.usesPrimaryAccount ? '대표계좌' : '작업자 원계좌',
            row.bankName || '-',
            row.bankCode || '-',
            row.accountNumber || '-',
            row.accountHolder || '-',
            row.amount,
        ]),
        [],
        ['다운로드 제외', '사유', '금액'],
        ...invalidRows.map((row) => [
            `${row.month} ${row.teamName} ${row.workerName}`,
            `검증 오류: ${getKBValidationMessages(row)}`,
            row.amount,
        ]),
        ...snapshot.excludedRows.map((row) => [
            `${row.month} ${row.teamName} ${row.workerName}`,
            row.reason,
            row.amount,
        ]),
    ];
    const verificationSheet = XLSX.utils.aoa_to_sheet(verificationRows);
    verificationSheet['!cols'] = [
        { wch: 28 },
        { wch: 42 },
        { wch: 16 },
        { wch: 18 },
        { wch: 12 },
        { wch: 24 },
        { wch: 16 },
        { wch: 14 },
    ];
    XLSX.utils.book_append_sheet(wb, verificationSheet, '검증');

    return wb;
}
