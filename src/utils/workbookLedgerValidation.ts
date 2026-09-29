import { parseWorkbookNumber } from './workbookLedgerParsing';

export type WorkbookNumericField = 'supplyAmount' | 'taxAmount' | 'totalAmount' | 'paymentAmount' | 'manDays' | 'appliedYear' | 'appliedMonth';
export interface WorkbookNumericIssue { field: WorkbookNumericField; message: string }

// Validate before normalization so an invalid value cannot silently become zero.
export const getWorkbookNumericIssues = (values: Partial<Record<WorkbookNumericField, unknown>>): WorkbookNumericIssue[] => {
    const issues: WorkbookNumericIssue[] = [];
    const labels: Record<WorkbookNumericField, string> = {
        supplyAmount: '공급가액', taxAmount: '부가세', totalAmount: '합계', paymentAmount: '입금·지급금액',
        manDays: '공수', appliedYear: '적용연도', appliedMonth: '적용월',
    };
    (Object.keys(labels) as WorkbookNumericField[]).forEach((field) => {
        const raw = values[field];
        if (raw === undefined || raw === null || raw === '') return;
        const value = parseWorkbookNumber(raw);
        let message = '';
        if (value === null) message = `${labels[field]}에 유효한 숫자를 입력하세요.`;
        else if (field === 'paymentAmount' && value < 0) message = '입금·지급금액은 0 이상이어야 합니다.';
        else if (field === 'appliedMonth' && (!Number.isInteger(value) || value < 1 || value > 12)) message = '적용월은 1~12 사이의 정수여야 합니다.';
        else if (field === 'appliedYear' && (!Number.isInteger(value) || value < 2000 || value > 2100)) message = '적용연도는 2000~2100 사이의 정수여야 합니다.';
        if (message) issues.push({ field, message });
    });
    return issues;
};
