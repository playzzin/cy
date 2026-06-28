export type KBAmountType =
    | 'totalAmount'
    | 'invoiceNet'
    | 'laborNet'
    | 'invoiceAdvance'
    | 'laborAdvance'
    | 'corporateAdvance1'
    | 'corporateAdvance2'
    | 'corporateAdvance3'
    | 'corporateAdvance4'
    | 'laborAdvance1'
    | 'laborAdvance2'
    | 'laborAdvance3'
    | 'laborAdvance4';

export type KBSalaryModelFilter = 'all' | 'monthly' | 'daily' | 'service';

export type KBTransferValidationError =
    | 'bankCode'
    | 'accountNumber'
    | 'accountHolder'
    | 'amount';

const KB_AMOUNT_TYPE_LABELS: Record<KBAmountType, string> = {
    totalAmount: '현재 화면 실지급액',
    invoiceNet: '공제후 법인총액',
    laborNet: '공제후 노무총액',
    invoiceAdvance: '법인가불 총액',
    laborAdvance: '노무가불 총액',
    corporateAdvance1: '법인가불 1',
    corporateAdvance2: '법인가불 2',
    corporateAdvance3: '법인가불 3',
    corporateAdvance4: '법인가불 4',
    laborAdvance1: '노무가불 1',
    laborAdvance2: '노무가불 2',
    laborAdvance3: '노무가불 3',
    laborAdvance4: '노무가불 4',
};

const KB_SALARY_FILTER_LABELS: Record<KBSalaryModelFilter, string> = {
    all: '전체',
    monthly: '월급제',
    daily: '일급제',
    service: '용역팀',
};

export const getKBAmountTypeLabel = (value: KBAmountType): string => KB_AMOUNT_TYPE_LABELS[value] ?? value;

export const getKBSalaryModelFilterLabel = (value: KBSalaryModelFilter): string =>
    KB_SALARY_FILTER_LABELS[value] ?? value;

export const resolveKBSalaryFilterFromPaymentId = (id: unknown): Exclude<KBSalaryModelFilter, 'all'> => {
    const safeId = String(id ?? '');
    if (safeId.endsWith('__일급제')) return 'daily';
    if (safeId.endsWith('__용역팀')) return 'service';
    return 'monthly';
};

export const filterKBPaymentRows = <T extends { id?: string }>(
    rows: T[],
    options: {
        pageViewMode: 'standard' | 'ledger';
        ledgerSalaryModelFilter: KBSalaryModelFilter;
    }
): T[] => {
    if (options.pageViewMode !== 'ledger' || options.ledgerSalaryModelFilter === 'all') {
        return rows;
    }

    return rows.filter((row) => resolveKBSalaryFilterFromPaymentId(row.id) === options.ledgerSalaryModelFilter);
};

export const formatKBTransferMemo = (template: string, workerName: string): string => {
    const safeTemplate = String(template ?? '');
    const safeWorkerName = String(workerName ?? '').trim();

    if (safeTemplate.includes('{이름}')) {
        return safeTemplate.split('{이름}').join(safeWorkerName);
    }

    if (safeTemplate.startsWith(' ')) {
        return safeWorkerName + safeTemplate;
    }

    if (!safeTemplate) {
        return safeWorkerName;
    }

    return safeTemplate;
};

export const validateKBTransferRow = (row: {
    bankCode?: string;
    accountNumber?: string;
    accountHolder?: string;
    amount?: number;
}): KBTransferValidationError[] => {
    const errors: KBTransferValidationError[] = [];

    if (!String(row.bankCode ?? '').trim()) errors.push('bankCode');
    if (!String(row.accountNumber ?? '').trim()) errors.push('accountNumber');
    if (!String(row.accountHolder ?? '').trim()) errors.push('accountHolder');
    if (!Number.isFinite(row.amount) || Number(row.amount) <= 0) errors.push('amount');

    return errors;
};

export const getKBValidationErrorLabel = (error: KBTransferValidationError): string => {
    if (error === 'bankCode') return '은행코드';
    if (error === 'accountNumber') return '계좌번호';
    if (error === 'accountHolder') return '예금주';
    return '이체금액';
};

export const summarizeKBTransferRows = (
    rows: Array<{ amount: number; validationErrors?: KBTransferValidationError[] }>,
    excludedCount = 0
) => {
    const totalAmount = rows.reduce((sum, row) => sum + (Number.isFinite(row.amount) ? row.amount : 0), 0);
    const errorCount = rows.reduce((sum, row) => sum + ((row.validationErrors?.length ?? 0) > 0 ? 1 : 0), 0);

    return {
        rowCount: rows.length,
        totalAmount,
        errorCount,
        excludedCount,
    };
};
