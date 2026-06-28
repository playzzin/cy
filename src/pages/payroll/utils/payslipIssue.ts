export const PAYSLIP_ISSUE_RULE_VERSION = 'monthly-wage-payslip-v1';

export type PayslipIssueSeverity = 'error' | 'warning';

export interface MonthlyPayslipRowLike {
    id?: string;
    workerId?: string;
    workerName?: string;
    idNumber?: string;
    teamId?: string;
    teamName?: string;
    companyName?: string;
    month?: string;
    totalManDay?: number;
    unitPrice?: number;
    grossAmount?: number;
    totalDeduction?: number;
    totalAmount?: number;
    invoiceManDay?: number;
    invoiceGrossAmount?: number;
    laborManDay?: number;
    laborGrossAmount?: number;
    bankCode?: string;
    bankName?: string;
    accountNumber?: string;
    accountHolder?: string;
    workEntries?: Array<{
        date?: string;
        siteName?: string;
        paymentMethod?: string;
        manDay?: number;
        unitPrice?: number;
        amount?: number;
    }>;
    deductionBreakdown?: {
        standardLines?: Array<{ label?: string; amount?: number }>;
        additionalLines?: Array<{ label?: string; amount?: number }>;
        total?: number;
    };
    taxBreakdown?: {
        standardLines?: Array<{ label?: string; amount?: number }>;
        additionalLines?: Array<{ label?: string; amount?: number }>;
        total?: number;
    };
    taxRateSnapshot?: object | null;
}

export interface PayslipIssue {
    rowId: string;
    workerName: string;
    severity: PayslipIssueSeverity;
    code:
        | 'missingWorkerName'
        | 'missingWorkerIdentifier'
        | 'missingMonth'
        | 'missingWorkEntries'
        | 'invalidGrossAmount'
        | 'invalidNetAmount'
        | 'deductionExceedsGross'
        | 'netMismatch'
        | 'missingBankName'
        | 'missingBankCode'
        | 'missingAccountNumber'
        | 'missingAccountHolder'
        | 'duplicateWorkerMonth'
        | 'missingTaxSnapshot';
    message: string;
}

export interface PayslipIssueSummary {
    totalRows: number;
    readyRows: number;
    errorCount: number;
    warningCount: number;
    issues: PayslipIssue[];
}

export interface PayslipPayComponent {
    label: string;
    manDay: number;
    unitPrice: number;
    amount: number;
    formula: string;
}

const toText = (value: unknown): string => String(value ?? '').trim();

export const toFiniteNumber = (value: unknown, fallback = 0): number => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const parsed = Number(value.replace(/,/g, '').trim());
        return Number.isFinite(parsed) ? parsed : fallback;
    }
    return fallback;
};

const hasText = (value: unknown): boolean => toText(value).length > 0;

const getRowId = (row: MonthlyPayslipRowLike): string =>
    toText(row.id) || `${toText(row.month) || 'unknown-month'}__${toText(row.workerId) || toText(row.workerName) || 'unknown-worker'}`;

export const maskResidentId = (value: unknown): string => {
    const raw = toText(value);
    if (!raw) return '-';
    const digits = raw.replace(/\D/g, '');
    if (digits.length >= 13) return `${digits.slice(0, 6)}-${digits.slice(6, 7)}******`;
    if (digits.length >= 7) return `${digits.slice(0, 6)}-${digits.slice(6, 7)}******`;
    if (digits.length >= 6) return `${digits.slice(0, 6)}-*******`;
    return raw.length <= 2 ? '*'.repeat(raw.length) : `${raw.slice(0, 2)}${'*'.repeat(Math.max(0, raw.length - 2))}`;
};

export const maskAccountNumber = (value: unknown): string => {
    const raw = toText(value);
    if (!raw) return '-';
    const visible = raw.replace(/\s+/g, '');
    if (visible.length <= 4) return '*'.repeat(visible.length);
    if (visible.length <= 8) return `${visible.slice(0, 2)}****${visible.slice(-2)}`;
    return `${visible.slice(0, 3)}-${'*'.repeat(Math.max(4, visible.length - 7))}-${visible.slice(-4)}`;
};

export const buildPayslipPayComponents = (row: MonthlyPayslipRowLike): PayslipPayComponent[] => {
    const invoiceAmount = toFiniteNumber(row.invoiceGrossAmount);
    const laborAmount = toFiniteNumber(row.laborGrossAmount);
    const invoiceManDay = toFiniteNumber(row.invoiceManDay);
    const laborManDay = toFiniteNumber(row.laborManDay);
    const grossAmount = toFiniteNumber(row.grossAmount);
    const unitPrice = toFiniteNumber(row.unitPrice);
    const components: PayslipPayComponent[] = [];

    if (invoiceAmount > 0 || invoiceManDay > 0) {
        components.push({
            label: '계산서 지급분',
            manDay: invoiceManDay,
            unitPrice,
            amount: invoiceAmount,
            formula: `${invoiceManDay.toFixed(1)}공수 × ${unitPrice.toLocaleString('ko-KR')}원`,
        });
    }

    if (laborAmount > 0 || laborManDay > 0) {
        components.push({
            label: '노무 지급분',
            manDay: laborManDay,
            unitPrice,
            amount: laborAmount,
            formula: `${laborManDay.toFixed(1)}공수 × ${unitPrice.toLocaleString('ko-KR')}원`,
        });
    }

    if (components.length === 0) {
        const totalManDay = toFiniteNumber(row.totalManDay);
        components.push({
            label: '기본 지급분',
            manDay: totalManDay,
            unitPrice,
            amount: grossAmount,
            formula: totalManDay > 0 && unitPrice > 0
                ? `${totalManDay.toFixed(1)}공수 × ${unitPrice.toLocaleString('ko-KR')}원`
                : '근무내역 합산',
        });
    }

    return components;
};

export const getPayslipIssueLabel = (issue: PayslipIssue): string =>
    `${issue.workerName || '작업자'}: ${issue.message}`;

const addIssue = (
    issues: PayslipIssue[],
    row: MonthlyPayslipRowLike,
    severity: PayslipIssueSeverity,
    code: PayslipIssue['code'],
    message: string
) => {
    issues.push({
        rowId: getRowId(row),
        workerName: toText(row.workerName) || '-',
        severity,
        code,
        message,
    });
};

export const validateMonthlyPayslipRows = (rows: MonthlyPayslipRowLike[]): PayslipIssueSummary => {
    const issues: PayslipIssue[] = [];
    const duplicateMap = new Map<string, MonthlyPayslipRowLike[]>();

    rows.forEach((row) => {
        const key = `${toText(row.month)}__${toText(row.workerId) || toText(row.workerName)}`;
        const list = duplicateMap.get(key) ?? [];
        list.push(row);
        duplicateMap.set(key, list);

        if (!hasText(row.workerName)) addIssue(issues, row, 'error', 'missingWorkerName', '성명이 없습니다.');
        if (!hasText(row.idNumber) && !hasText(row.workerId)) addIssue(issues, row, 'warning', 'missingWorkerIdentifier', '근로자 식별정보가 없습니다.');
        if (!hasText(row.month)) addIssue(issues, row, 'error', 'missingMonth', '지급월이 없습니다.');
        if (!Array.isArray(row.workEntries) || row.workEntries.length === 0) addIssue(issues, row, 'warning', 'missingWorkEntries', '근무내역이 없습니다.');

        const grossAmount = toFiniteNumber(row.grossAmount);
        const totalDeduction = toFiniteNumber(row.totalDeduction);
        const totalAmount = toFiniteNumber(row.totalAmount);

        if (grossAmount <= 0) addIssue(issues, row, 'error', 'invalidGrossAmount', '세전 금액이 0원 이하입니다.');
        if (totalAmount < 0) addIssue(issues, row, 'error', 'invalidNetAmount', '실지급액이 음수입니다.');
        if (totalDeduction > grossAmount) addIssue(issues, row, 'error', 'deductionExceedsGross', '공제액이 세전 금액을 초과합니다.');
        if (Math.abs(grossAmount - totalDeduction - totalAmount) > 1) addIssue(issues, row, 'error', 'netMismatch', '세전-공제-실지급 계산이 맞지 않습니다.');

        if (!hasText(row.bankName)) addIssue(issues, row, 'warning', 'missingBankName', '은행명이 없습니다.');
        if (!hasText(row.bankCode)) addIssue(issues, row, 'warning', 'missingBankCode', '은행코드가 없습니다.');
        if (!hasText(row.accountNumber)) addIssue(issues, row, 'warning', 'missingAccountNumber', '계좌번호가 없습니다.');
        if (!hasText(row.accountHolder)) addIssue(issues, row, 'warning', 'missingAccountHolder', '예금주가 없습니다.');
        if (!row.taxRateSnapshot || Object.keys(row.taxRateSnapshot).length === 0) addIssue(issues, row, 'warning', 'missingTaxSnapshot', '세율 스냅샷이 없습니다.');
    });

    duplicateMap.forEach((group) => {
        if (group.length <= 1) return;
        group.forEach((row) => addIssue(issues, row, 'warning', 'duplicateWorkerMonth', '같은 지급월에 동일 근로자 명세서가 여러 건입니다.'));
    });

    const errorRowIds = new Set(issues.filter((issue) => issue.severity === 'error').map((issue) => issue.rowId));

    return {
        totalRows: rows.length,
        readyRows: rows.filter((row) => !errorRowIds.has(getRowId(row))).length,
        errorCount: issues.filter((issue) => issue.severity === 'error').length,
        warningCount: issues.filter((issue) => issue.severity === 'warning').length,
        issues,
    };
};

export const createPayslipChecksum = (value: unknown): string => {
    const text = JSON.stringify(value);
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
};

export const buildMonthlyPayslipSnapshot = (row: MonthlyPayslipRowLike, extra: Record<string, unknown> = {}) => {
    const snapshot = {
        ruleVersion: PAYSLIP_ISSUE_RULE_VERSION,
        generatedAt: new Date().toISOString(),
        row: {
            id: row.id,
            workerId: row.workerId,
            workerName: row.workerName,
            workerIdentifierMasked: maskResidentId(row.idNumber || row.workerId),
            teamId: row.teamId,
            teamName: row.teamName,
            companyName: row.companyName,
            month: row.month,
            totalManDay: row.totalManDay,
            unitPrice: row.unitPrice,
            grossAmount: row.grossAmount,
            totalDeduction: row.totalDeduction,
            totalAmount: row.totalAmount,
            payComponents: buildPayslipPayComponents(row),
            deductionBreakdown: row.deductionBreakdown,
            taxBreakdown: row.taxBreakdown,
            taxRateSnapshot: row.taxRateSnapshot,
            workEntries: row.workEntries,
        },
        ...extra,
    };

    return {
        ...snapshot,
        checksum: createPayslipChecksum(snapshot),
    };
};
