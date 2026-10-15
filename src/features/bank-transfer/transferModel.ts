import * as XLSX from 'xlsx-js-style';
import { BANK_CODES } from '../../pages/payroll/constants/payroll.constants';
import { formatKBTransferMemo } from '../../pages/payroll/utils/kbTransferExport';
import type { AccountCategory, TransferCandidate, TransferRow, TransferSource } from './types';
import { MAX_TRANSFER_ROWS } from './transferLimits';

export const SOURCE_LABELS: Record<TransferSource, string> = {
    account: '등록 계좌', payroll: '급여', rent: '월세', support: '외부지원비',
};

export const CATEGORY_LABELS: Record<AccountCategory, string> = {
    worker: '작업자', team: '팀', company: '회사', purchase: '매입', other: '기타',
};

export const applyMemoRule = (rule: string, name: string): string => formatKBTransferMemo(rule, name);

export const createTransferRow = (
    candidate: TransferCandidate,
    receiverDisplay: string,
    memoRule: string,
): TransferRow => ({
    ...candidate,
    ...(candidate.source !== 'account' ? { originalAmount: candidate.originalAmount ?? candidate.payrollDetail?.originalAmount ?? candidate.supportDetail?.originalAmount ?? candidate.amount } : {}),
    rowId: `transfer:${candidate.id}`,
    receiverDisplay: candidate.receiverDisplay ?? receiverDisplay,
    senderMemo: candidate.senderMemo ?? applyMemoRule(memoRule, candidate.name),
});

export const addTransferCandidates = (
    rows: TransferRow[],
    candidates: TransferCandidate[],
    receiverDisplay: string,
    memoRule: string,
): { rows: TransferRow[]; duplicateCount: number } => {
    const ids = new Set(rows.map((row) => row.id));
    const nextRows = [...rows];
    let duplicateCount = 0;
    candidates.forEach((candidate) => {
        if (ids.has(candidate.id)) {
            duplicateCount += 1;
            return;
        }
        ids.add(candidate.id);
        nextRows.push(createTransferRow(candidate, receiverDisplay, memoRule));
    });
    if (nextRows.length > MAX_TRANSFER_ROWS) throw new Error(`송금 목록에는 최대 ${MAX_TRANSFER_ROWS.toLocaleString('ko-KR')}건까지 담을 수 있습니다. 목록을 나누어 주세요.`);
    return { rows: nextRows, duplicateCount };
};

export const validateTransferRow = (row: TransferRow): string[] => {
    const errors: string[] = [];
    const bankCode = String(row.bankCode ?? '').trim();
    const accountNumber = String(row.accountNumber ?? '').trim();
    if (!/^\d{3}$/.test(bankCode) || !Object.prototype.hasOwnProperty.call(BANK_CODES, bankCode)) {
        errors.push('은행코드를 확인해 주세요.');
    }
    // 구분용 공백과 하이픈만 허용하며 번호를 숫자로 바꾸지 않아 앞자리 0을 보존한다.
    if (!/^[\d -]+$/.test(accountNumber) || !/^\d{6,20}$/.test(accountNumber.replace(/[ -]/g, ''))) {
        errors.push('계좌번호를 확인해 주세요.');
    }
    if (!String(row.accountHolder ?? '').trim()) errors.push('예금주를 입력해 주세요.');
    if (!Number.isSafeInteger(row.amount) || row.amount <= 0) {
        errors.push('이체금액은 1원 이상의 정수로 입력해 주세요.');
    }
    return errors;
};

const excelText = (value: string): string => String(value ?? '').replace(/[\r\n\t]/g, ' ').trim();

/** The preview and downloaded cells must show the same normalized values. */
export const getTransferExportCells = (row: TransferRow): [string, string, number, string, string] => [
    excelText(row.bankCode), excelText(row.accountNumber), row.amount,
    excelText(row.receiverDisplay), excelText(row.senderMemo),
];

export const buildTransferWorkbook = (rows: TransferRow[]): XLSX.WorkBook => {
    if (rows.length === 0) throw new Error('송금할 계좌를 먼저 추가해 주세요.');
    if (rows.length > MAX_TRANSFER_ROWS) throw new Error(`송금 목록에는 최대 ${MAX_TRANSFER_ROWS.toLocaleString('ko-KR')}건까지 담을 수 있습니다. 목록을 나누어 주세요.`);
    const invalidRows = rows.flatMap((row, index) => {
        const errors = validateTransferRow(row);
        return errors.length ? [`${index + 1}행: ${errors.join(' ')}`] : [];
    });
    if (invalidRows.length) throw new Error(`송금 정보를 수정한 뒤 다운로드해 주세요.\n${invalidRows.slice(0, 5).join('\n')}`);
    if (new Set(rows.map((row) => row.id)).size !== rows.length) {
        throw new Error('같은 항목이 중복되어 있습니다. 중복 항목을 제거해 주세요.');
    }
    const total = rows.reduce((sum, row) => sum + row.amount, 0);
    if (!Number.isSafeInteger(total)) throw new Error('총 이체금액이 안전하게 계산할 수 있는 범위를 초과했습니다.');

    const sheet = XLSX.utils.aoa_to_sheet([
        ['A. 은행코드', 'B. 계좌번호', 'C. 이체금액', 'D. 받는분통장표시', 'E. 내통장메모'],
        ...rows.map(getTransferExportCells),
    ]);
    const border = {
        top: { style: 'thin', color: { rgb: 'A3A3A3' } },
        bottom: { style: 'thin', color: { rgb: 'A3A3A3' } },
        left: { style: 'thin', color: { rgb: 'A3A3A3' } },
        right: { style: 'thin', color: { rgb: 'A3A3A3' } },
    };
    for (let rowIndex = 0; rowIndex <= rows.length; rowIndex += 1) {
        for (let columnIndex = 0; columnIndex < 5; columnIndex += 1) {
            const cell = sheet[XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })];
            const numeric = rowIndex > 0 && columnIndex === 2;
            // 문자열을 명시적으로 기록한다. =, +, -, @로 시작하는 메모도 수식이 되지 않는다.
            cell.t = numeric ? 'n' : 's';
            cell.z = numeric ? '#,##0' : '@';
            delete cell.f;
            cell.s = {
                font: { name: '맑은 고딕', sz: 10, bold: rowIndex === 0 },
                fill: { patternType: 'solid', fgColor: { rgb: rowIndex === 0 ? 'FDE68A' : 'C6EFCE' } },
                alignment: { vertical: 'center', horizontal: numeric ? 'right' : 'left' },
                border,
            };
        }
    }
    sheet['!cols'] = [{ wch: 12 }, { wch: 22 }, { wch: 17 }, { wch: 22 }, { wch: 24 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, '국민은행용');
    return workbook;
};
