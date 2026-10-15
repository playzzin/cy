import { BUSINESS_INCOME_TAX_RATE, BUSINESS_RESIDENT_TAX_RATE } from './utils/workEntryTax';
import { type PrimaryAccountSetting } from '../../services/primaryAccountService';
import { AdvancePayment } from '../../services/advancePaymentService';
import { PayrollConfig, PayrollDeductionItem, DEFAULT_ADVANCE_ITEM_LABELS } from '../../services/payrollConfigService';
import { type KBTransferValidationError } from './utils/kbTransferExport';
import { PaymentData, MonthlyAdvanceLedgerRow, MonthlyAdvanceLedgerWorkEntry, DeductionBreakdown, WorkerWorkEntry, DeductionLine, TaxRateSnapshot, LedgerUtilityInputLike } from './types/payroll';
import { STANDARD_DEDUCTION_FIELDS } from './constants/payroll.constants';
import type { PayrollTransferDetail } from './types/payroll';


export const buildStandardDeductionLabelMap = (): Record<string, string> =>
    STANDARD_DEDUCTION_FIELDS.reduce<Record<string, string>>((acc, { key, label }) => {
        acc[key] = label;
        return acc;
    }, {});

export const buildDeductionLabelMapFromConfig = (items?: PayrollDeductionItem[]): Record<string, string> => {
    const base = buildStandardDeductionLabelMap();
    (items ?? []).forEach((item) => {
        const safeId = item.id?.trim();
        if (!safeId) return;
        const safeLabel = item.label?.trim();
        base[safeId] = safeLabel && safeLabel.length > 0 ? safeLabel : safeId;
    });
    return base;
};

export const normalizeLineLabel = (value: string): string => String(value ?? '').replace(/\s+/g, '').trim();

export const buildAdvanceLabelSet = (config?: PayrollConfig | null): Set<string> => {
    const labels = {
        ...DEFAULT_ADVANCE_ITEM_LABELS,
        ...(config?.advanceItemLabels ?? {}),
    };

    const set = new Set<string>([
        normalizeLineLabel(labels.corporateAdvance1),
        normalizeLineLabel(labels.corporateAdvance2),
        normalizeLineLabel(labels.corporateAdvance3),
        normalizeLineLabel(labels.corporateAdvance4),
        normalizeLineLabel(labels.laborAdvance1),
        normalizeLineLabel(labels.laborAdvance2),
        normalizeLineLabel(labels.laborAdvance3),
        normalizeLineLabel(labels.laborAdvance4),
        'corporateAdvance1',
        'corporateAdvance2',
        'corporateAdvance3',
        'corporateAdvance4',
        'laborAdvance1',
        'laborAdvance2',
        'laborAdvance3',
        'laborAdvance4',
        'carrySecond',
        'currentAdvance',
        'currentAdvanceSecond',
    ]);

    set.delete('');
    return set;
};

export const createEmptyDeductionBreakdown = (): DeductionBreakdown => ({
    standardLines: [],
    additionalLines: [],
    totalStandard: 0,
    totalAdditional: 0,
    total: 0,
    hasData: false,
});

export const rebuildDeductionBreakdown = (params: { standardLines: DeductionLine[]; additionalLines: DeductionLine[] }): DeductionBreakdown => {
    const totalStandard = (params.standardLines ?? []).reduce((sum, line) => sum + toNumber(line?.amount), 0);
    const totalAdditional = (params.additionalLines ?? []).reduce((sum, line) => sum + toNumber(line?.amount), 0);
    const total = totalStandard + totalAdditional;
    return {
        standardLines: params.standardLines ?? [],
        additionalLines: params.additionalLines ?? [],
        totalStandard,
        totalAdditional,
        total,
        hasData: (params.standardLines ?? []).length > 0 || (params.additionalLines ?? []).length > 0,
    };
};

export const TEMP_INSURANCE_PREFIX = '[4대보험]';

export const TEMP_BUSINESS_PREFIX = '[3.3%]';

export const TEMP_TAX_PREFIX = '[원천세]';

export const LEGACY_TAX_PREFIX = '[세금]';

export const TEMP_DAILY_FEE_PREFIX = '[수수료]';

export const DAILY_FEE_LABEL = `${TEMP_DAILY_FEE_PREFIX} 일급제 공수당`;

export const stripTemporaryDeductionLines = (breakdown: DeductionBreakdown): DeductionBreakdown => {
    const safe = breakdown ?? createEmptyDeductionBreakdown();
    const shouldKeepLine = (line: DeductionLine): boolean => {
        const label = (line?.label ?? '').trim();
        if (!label) return false;
        return !(
            label.startsWith(TEMP_INSURANCE_PREFIX)
            || label.startsWith(TEMP_BUSINESS_PREFIX)
            || label.startsWith(TEMP_TAX_PREFIX)
            || label.startsWith(LEGACY_TAX_PREFIX)
            || label.startsWith(TEMP_DAILY_FEE_PREFIX)
            || label.startsWith('[3.0%]')
            || label.startsWith('[0.3%]')
        );
    };
    const standardLines = (safe.standardLines ?? []).filter(shouldKeepLine);
    const additionalLines = (safe.additionalLines ?? []).filter(shouldKeepLine);
    return rebuildDeductionBreakdown({ standardLines, additionalLines });
};

export const stripTemporaryTaxLines = (breakdown: DeductionBreakdown | undefined): DeductionBreakdown => {
    const safe = breakdown ?? createEmptyDeductionBreakdown();
    const additionalLines = (safe.additionalLines ?? []).filter((line: DeductionLine) => {
        const label = (line?.label ?? '').trim();
        if (!label) return false;
        return !(label.startsWith(TEMP_TAX_PREFIX) || label.startsWith(LEGACY_TAX_PREFIX) || label.startsWith(TEMP_BUSINESS_PREFIX) || label.startsWith(TEMP_INSURANCE_PREFIX) || label.startsWith('[3.0%]') || label.startsWith('[0.3%]'));
    });
    return rebuildDeductionBreakdown({ standardLines: [], additionalLines });
};

export const floorWon = (value: number): number => Math.floor(toNumber(value));

export const toNumber = (value: unknown): number => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const normalized = value.replace(/,/g, '').trim();
        if (!normalized) return 0;
        const parsed = Number(normalized);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
};

export const APPLIED_UTILITY_FIELDS: Array<{ key: keyof LedgerUtilityInputLike['invoice']; label: string }> = [
    { key: 'lodging', label: '숙소비' },
    { key: 'electricity', label: '전기세' },
    { key: 'gas', label: '도시가스' },
    { key: 'water', label: '수도세' },
    { key: 'internet', label: '인터넷' },
    { key: 'management', label: '관리비' },
    { key: 'fine', label: '과태료' },
    { key: 'other', label: '기타' },
];

export const LEDGER_OTHER_SOURCE_LABELS = new Set(['개인방', '장갑', '보증금']);

export const LEDGER_DEFAULT_ASSIGNMENT: 'corporate' | 'labor' = 'corporate';

export const APPLIED_UTILITY_LABEL_SET = new Set(APPLIED_UTILITY_FIELDS.map((field) => field.label));

export const isAppliedUtilityOrFeeLabel = (labelRaw: string): boolean => {
    const label = String(labelRaw ?? '').trim();
    if (!label) return false;
    return APPLIED_UTILITY_LABEL_SET.has(label)
        || LEDGER_OTHER_SOURCE_LABELS.has(label)
        || label.startsWith(TEMP_DAILY_FEE_PREFIX);
};

export const isDailyWagePaymentItem = (item: Pick<PaymentData, 'id'>): boolean => String(item.id ?? '').endsWith('__일급제');

export const buildDailyFeeDeductionLines = (params: {
    item: Pick<PaymentData, 'id' | 'totalManDay'>;
    applyDailyFee: boolean;
    dailyFeePerManDay: number;
}): DeductionLine[] => {
    if (!params.applyDailyFee) return [];
    if (!isDailyWagePaymentItem(params.item)) return [];

    const feePerManDay = Math.max(0, Math.floor(toNumber(params.dailyFeePerManDay)));
    if (feePerManDay <= 0) return [];

    const totalManDay = Math.max(0, toNumber(params.item.totalManDay));
    if (totalManDay <= 0) return [];

    return [{
        label: DAILY_FEE_LABEL,
        amount: floorWon(totalManDay * feePerManDay),
    }];
};

export const buildUtilityDeductionLines = (manual?: LedgerUtilityInputLike): DeductionLine[] => {
    if (!manual) return [];

    return APPLIED_UTILITY_FIELDS.reduce<DeductionLine[]>((acc, field) => {
        const assignmentType = manual.assignmentType || LEDGER_DEFAULT_ASSIGNMENT;
        const itemAssignments = manual.itemAssignments || {};

        // 개별 항목 분류가 있으면 우선 적용하고, 없으면 행 기본 분류를 따른다.
        const resolvedAssignment = itemAssignments[field.key] ?? assignmentType;
        const shouldInclude = resolvedAssignment === 'labor';

        if (!shouldInclude) return acc;

        const amount = toNumber(manual?.invoice?.[field.key]) + toNumber(manual?.labor?.[field.key]);
        if (amount === 0) return acc;
        
        acc.push({ label: field.label, amount });
        return acc;
    }, []);
};

export const buildVisibleUtilityDeductionLines = (manual?: LedgerUtilityInputLike): DeductionLine[] => {
    if (!manual) return [];

    return APPLIED_UTILITY_FIELDS.reduce<DeductionLine[]>((acc, field) => {
        const amount = toNumber(manual?.invoice?.[field.key]) + toNumber(manual?.labor?.[field.key]);
        if (amount === 0) return acc;

        acc.push({ label: field.label, amount });
        return acc;
    }, []);
};

export const mergeDeductionBreakdownWithLines = (
    breakdown: DeductionBreakdown | undefined,
    lines: DeductionLine[]
): DeductionBreakdown => {
    const safe = breakdown ?? createEmptyDeductionBreakdown();
    const standardLines = [...(safe.standardLines ?? [])].map((line) => ({
        label: String(line.label ?? '').trim(),
        amount: toNumber(line.amount),
    }));
    const additionalLines = [...(safe.additionalLines ?? [])].map((line) => ({
        label: String(line.label ?? '').trim(),
        amount: toNumber(line.amount),
    }));

    lines.forEach((line) => {
        const label = String(line.label ?? '').trim();
        const amount = toNumber(line.amount);
        if (!label || amount === 0) return;

        const standardIndex = standardLines.findIndex((existing) => existing.label === label);
        if (standardIndex >= 0) {
            standardLines[standardIndex] = {
                ...standardLines[standardIndex],
                amount: standardLines[standardIndex].amount + amount,
            };
            return;
        }

        const additionalIndex = additionalLines.findIndex((existing) => existing.label === label);
        if (additionalIndex >= 0) {
            additionalLines[additionalIndex] = {
                ...additionalLines[additionalIndex],
                amount: additionalLines[additionalIndex].amount + amount,
            };
            return;
        }

        standardLines.push({ label, amount });
    });

    return rebuildDeductionBreakdown({ standardLines, additionalLines });
};

export const buildAdvanceDeductionLines = (
    manual: LedgerUtilityInputLike | undefined,
    config?: PayrollConfig | null
): DeductionLine[] => {
    if (!manual) return [];

    const labels = {
        ...DEFAULT_ADVANCE_ITEM_LABELS,
        ...(config?.advanceItemLabels ?? {}),
    };

    const mapped: Array<{ label: string; amount: number }> = [
        { label: labels.corporateAdvance1, amount: toNumber(manual.invoice?.carry) },
        { label: labels.corporateAdvance2, amount: toNumber(manual.invoice?.carrySecond) },
        { label: labels.corporateAdvance3, amount: toNumber(manual.invoice?.currentAdvance) },
        { label: labels.corporateAdvance4, amount: toNumber(manual.invoice?.currentAdvanceSecond) },
        { label: labels.laborAdvance1, amount: toNumber(manual.labor?.carry) },
        { label: labels.laborAdvance2, amount: toNumber(manual.labor?.carrySecond) },
        { label: labels.laborAdvance3, amount: toNumber(manual.labor?.currentAdvance) },
        { label: labels.laborAdvance4, amount: toNumber(manual.labor?.currentAdvanceSecond) },
    ];

    return mapped
        .filter((item) => String(item.label ?? '').trim().length > 0 && item.amount > 0)
        .map((item) => ({ label: String(item.label).trim(), amount: item.amount }));
};

export const ensureAdvanceLinesInBreakdown = (
    breakdown: DeductionBreakdown,
    manual: LedgerUtilityInputLike | undefined,
    config?: PayrollConfig | null
): DeductionBreakdown => {
    const source = breakdown ?? createEmptyDeductionBreakdown();
    const sourceLines = [
        ...(source.standardLines ?? []),
        ...(source.additionalLines ?? []),
    ];
    const advanceLabelSet = buildAdvanceLabelSet(config);
    const hasAdvanceLines = sourceLines.some((line) => advanceLabelSet.has(normalizeLineLabel(String(line?.label ?? ''))));
    if (hasAdvanceLines) return source;

    const manualAdvanceLines = buildAdvanceDeductionLines(manual, config);
    if (manualAdvanceLines.length === 0) return source;

    return mergeDeductionBreakdownWithLines(source, manualAdvanceLines);
};

export const TAX_LINE_BUSINESS_INCOME_PREFIX = '[3.0%]';

export const TAX_LINE_BUSINESS_RESIDENT_PREFIX = '[0.3%]';

export const formatRatePercent = (rate: number, maxFractionDigits: number = 3): string => {
    if (!Number.isFinite(rate)) return '-';
    const percent = rate * 100;
    const text = percent.toLocaleString('ko-KR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: maxFractionDigits,
    });
    return `${text}%`;
};

export const resolveTaxLineRateText = (lineLabel: string, snapshot?: TaxRateSnapshot): string => {
    const label = String(lineLabel ?? '').trim();
    if (!label) return '-';

    const prefixed = label.match(/^\[(\d+(?:\.\d+)?)%\]/);
    if (prefixed) return `${prefixed[1]}%`;

    if (!snapshot) return '-';

    if (label.startsWith(TEMP_INSURANCE_PREFIX)) {
        if (label.includes('국민연금')) return formatRatePercent(snapshot.pensionRate, 2);
        if (label.includes('건강보험')) return formatRatePercent(snapshot.healthRate, 3);
        if (label.includes('장기요양')) return formatRatePercent(snapshot.careRateOfHealth ?? 0, 2);
        if (label.includes('고용보험')) return formatRatePercent(snapshot.employmentRate, 3);
    }

    if (label.startsWith(TEMP_TAX_PREFIX) || label.startsWith(LEGACY_TAX_PREFIX)) {
        const incomeRate = formatRatePercent(snapshot.incomeTaxRate, 2);
        const residentRate = formatRatePercent(snapshot.residentTaxRate, 2);
        if (label.includes('근로소득세') || label.includes('갑근세')) {
            return incomeRate;
        }
        if (label.includes('지방소득세') || label.includes('지방세')) {
            return residentRate;
        }
    }

    if (label.includes('사업소득세')) return formatRatePercent(snapshot.businessIncomeTaxRate ?? BUSINESS_INCOME_TAX_RATE, 1);
    if (label.includes('소득세')) return formatRatePercent(snapshot.businessResidentTaxRate ?? BUSINESS_RESIDENT_TAX_RATE, 1);

    return '-';
};

export const resolveWithholdingDetailText = (snapshot?: TaxRateSnapshot): string => {
    const deduction = Math.max(0, Math.floor(toNumber(snapshot?.withholdingBaseDeduction ?? 150000))).toLocaleString('ko-KR');
    const incomeRate = formatRatePercent(toNumber(snapshot?.incomeTaxRate ?? 0.06), 2);
    const taxCredit = formatRatePercent(toNumber(snapshot?.withholdingIncomeBaseMultiplier ?? 0.55), 2);
    const residentRate = formatRatePercent(toNumber(snapshot?.residentTaxRate ?? 0.1), 2);
    return `상세: (단가-${deduction})×${incomeRate}×(1-${taxCredit}), 지방세=갑근세×${residentRate}`;
};

export const getTaxLinesForItem = (item: PaymentData): DeductionLine[] => [
    ...(item.taxBreakdown?.standardLines ?? []),
    ...(item.taxBreakdown?.additionalLines ?? []),
];

export const isInsuranceSectionTaxLabel = (labelRaw: string): boolean => {
    const label = String(labelRaw ?? '').trim();
    if (!label) return false;
    return label.startsWith(TEMP_INSURANCE_PREFIX);
};

export const isWithholdingSectionTaxLabel = (labelRaw: string): boolean => {
    const label = String(labelRaw ?? '').trim();
    if (!label) return false;
    return label.startsWith(TEMP_TAX_PREFIX) || label.startsWith(LEGACY_TAX_PREFIX);
};

export const isBusinessSectionTaxLabel = (labelRaw: string): boolean => {
    const label = String(labelRaw ?? '').trim();
    if (!label) return false;
    return label.startsWith(TAX_LINE_BUSINESS_INCOME_PREFIX) || label.startsWith(TAX_LINE_BUSINESS_RESIDENT_PREFIX);
};

export const sumInsuranceSectionTax = (item: PaymentData): number => {
    const lines = getTaxLinesForItem(item);
    return lines.reduce((sum, line) => {
        return sum + (isInsuranceSectionTaxLabel(line.label) ? toNumber(line.amount) : 0);
    }, 0);
};

export const sumWithholdingSectionTax = (item: PaymentData): number => {
    const lines = getTaxLinesForItem(item);
    return lines.reduce((sum, line) => {
        return sum + (isWithholdingSectionTaxLabel(line.label) ? toNumber(line.amount) : 0);
    }, 0);
};

export const sumBusinessSectionTax = (item: PaymentData): number => {
    const lines = getTaxLinesForItem(item);
    return lines.reduce((sum, line) => {
        return sum + (isBusinessSectionTaxLabel(line.label) ? toNumber(line.amount) : 0);
    }, 0);
};

export const extractLedgerTaxAmountsFromItem = (
    item: PaymentData
): NonNullable<MonthlyAdvanceLedgerRow['statementTaxAmounts']> => {
    const lines = getTaxLinesForItem(item);
    const deductionLines: DeductionLine[] = [
        ...(item.deductionBreakdown?.standardLines ?? []),
        ...(item.deductionBreakdown?.additionalLines ?? []),
    ];

    let pension = 0;
    let health = 0;
    let care = 0;
    let employment = 0;
    let incomeTax = 0;
    let residentTax = 0;
    let businessIncomeTax = 0;
    let businessResidentTax = 0;
    let dailyFee = 0;

    lines.forEach((line) => {
        const label = String(line.label ?? '').trim();
        const amount = toNumber(line.amount);
        if (amount <= 0) return;

        if (isInsuranceSectionTaxLabel(label)) {
            if (label.includes('국민연금')) pension += amount;
            else if (label.includes('건강보험')) health += amount;
            else if (label.includes('장기요양')) care += amount;
            else if (label.includes('고용보험')) employment += amount;
            return;
        }

        if (isWithholdingSectionTaxLabel(label)) {
            if (label.includes('지방세') || label.includes('지방소득세')) residentTax += amount;
            else incomeTax += amount;
            return;
        }

        if (isBusinessSectionTaxLabel(label)) {
            if (label.includes('사업소득세')) businessIncomeTax += amount;
            else businessResidentTax += amount;
        }
    });

    deductionLines.forEach((line) => {
        const label = String(line.label ?? '').trim();
        if (!label.startsWith(TEMP_DAILY_FEE_PREFIX)) return;
        dailyFee += toNumber(line.amount);
    });

    return {
        pension,
        health,
        care,
        employment,
        incomeTax,
        residentTax,
        businessIncomeTax,
        businessResidentTax,
        dailyFee,
        isWithholdingTarget:
            (item.withholdingAppliedSummary?.appliedAmount ?? 0) > 0 || incomeTax + residentTax > 0,
    };
};

export const buildWorkEntriesForLedgerRow = (row: MonthlyAdvanceLedgerRow): WorkerWorkEntry[] => {
    const normalizedEntries = (row.workEntries ?? [])
        .map((entry: MonthlyAdvanceLedgerWorkEntry) => ({
            date: (entry.date ?? row.month).trim() || row.month,
            siteName: (entry.siteName ?? '').trim() || '-',
            siteId: entry.siteId,
            clientCompanyId: entry.clientCompanyId,
            isLaborSite: Boolean(entry.isLaborSite),
            manDay: toNumber(entry.manDay),
            unitPrice: toNumber(entry.unitPrice),
            paymentMethod: entry.paymentMethod,
            amount:
                toNumber(entry.amount) > 0
                    ? toNumber(entry.amount)
                    : floorWon(toNumber(entry.manDay) * toNumber(entry.unitPrice)),
        }))
        .filter((entry: WorkerWorkEntry) => toNumber(entry.manDay) > 0 || toNumber(entry.amount) > 0);

    if (normalizedEntries.length > 0) return normalizedEntries;

    const fallbackEntries: WorkerWorkEntry[] = [];
    if (toNumber(row.invoiceManDay) > 0 || toNumber(row.invoiceGrossAmount) > 0) {
        fallbackEntries.push({
            date: row.month,
            siteName: '계산서',
            siteId: '__invoice',
            clientCompanyId: '',
            isLaborSite: false,
            manDay: toNumber(row.invoiceManDay),
            unitPrice: toNumber(row.unitPrice),
            paymentMethod: '계산서',
            amount: floorWon(toNumber(row.invoiceGrossAmount)),
        });
    }
    if (toNumber(row.laborManDay) > 0 || toNumber(row.laborGrossAmount) > 0) {
        fallbackEntries.push({
            date: row.month,
            siteName: '노무',
            siteId: '__labor',
            clientCompanyId: '',
            isLaborSite: true,
            manDay: toNumber(row.laborManDay),
            unitPrice: toNumber(row.unitPrice),
            paymentMethod: '노무',
            amount: floorWon(toNumber(row.laborGrossAmount)),
        });
    }

    return fallbackEntries;
};

export const deduplicateAdvanceRecords = (records: AdvancePayment[]): AdvancePayment[] => {
    const map = new Map<string, AdvancePayment>();
    records.forEach((record) => {
        const teamKey = (record.teamId ?? '').trim() || '__no_team__';
        const currentScore = toNumber(record.totalDeduction);
        const prev = map.get(teamKey);
        const prevScore = toNumber(prev?.totalDeduction);
        if (!prev || currentScore >= prevScore) {
            map.set(teamKey, record);
        }
    });
    return Array.from(map.values());
};

export const buildDeductionBreakdownFromRecords = (
    records: AdvancePayment[],
    deductionLabelMap: Record<string, string> = {}
): DeductionBreakdown => {
    if (!records || records.length === 0) {
        return createEmptyDeductionBreakdown();
    }

    const deduped = deduplicateAdvanceRecords(records);

    const standardLines: DeductionLine[] = [];
    STANDARD_DEDUCTION_FIELDS.forEach(({ key, label }) => {
        const sum = deduped.reduce((acc, record) => acc + toNumber(record[key]), 0);
        if (sum !== 0) {
            standardLines.push({ label, amount: sum });
        }
    });

    const additionalTotals = new Map<string, number>();
    deduped.forEach((record) => {
        Object.entries(record.items ?? {}).forEach(([itemLabel, rawAmount]) => {
            const amount = toNumber(rawAmount);
            if (amount === 0) return;
            additionalTotals.set(itemLabel, (additionalTotals.get(itemLabel) ?? 0) + amount);
        });
    });

    const additionalLines: DeductionLine[] = Array.from(additionalTotals.entries())
        .map(([labelKey, amount]) => {
            const friendlyLabel = deductionLabelMap[labelKey] ?? labelKey;
            return { label: friendlyLabel, amount };
        })
        .sort((a, b) => b.amount - a.amount);

    const totalStandard = standardLines.reduce((sum, line) => sum + line.amount, 0);
    const totalAdditional = additionalLines.reduce((sum, line) => sum + line.amount, 0);
    const total = totalStandard + totalAdditional;

    return {
        standardLines,
        additionalLines,
        totalStandard,
        totalAdditional,
        total,
        hasData: standardLines.length > 0 || additionalLines.length > 0,
    };
};

export type KBPreviewSourceRow = {
    payrollDetail?: PayrollTransferDetail;
    sourceRowId: string;
    month: string;
    teamName: string;
    workerName: string;
    salaryLabel: string;
    bankCode: string;
    bankName: string;
    accountNumber: string;
    accountHolder: string;
    totalAmount: number;
    invoiceNetAmount: number;
    laborNetAmount: number;
    invoiceAdvance: number;
    laborAdvance: number;
    corporateAdvance1: number;
    corporateAdvance2: number;
    corporateAdvance3: number;
    corporateAdvance4: number;
    laborAdvance1: number;
    laborAdvance2: number;
    laborAdvance3: number;
    laborAdvance4: number;
};

export type KBTransferRow = {
    payrollDetail?: PayrollTransferDetail;
    sourceRowId: string;
    month: string;
    teamName: string;
    workerName: string;
    salaryLabel: string;
    bankCode: string;
    bankCodeDisplay: string;
    bankCodeUnmapped: boolean;
    bankCodeNeedsFix: boolean;
    bankCodeReason: string;
    bankCodeCandidates: string;
    bankName: string;
    accountNumber: string;
    accountHolder: string;
    amount: number;
    receiverDisplay: string;
    senderMemo: string;
    usesPrimaryAccount: boolean;
    validationErrors: KBTransferValidationError[];
};

export type KBExcludedTransferRow = {
    sourceRowId: string;
    month: string;
    teamName: string;
    workerName: string;
    salaryLabel: string;
    amount: number;
    reason: string;
};

export type KBPreviewCriteria = {
    generatedAt: string;
    rangeLabel: string;
    teamLabel: string;
    targetLabel: string;
    salaryFilterLabel: string;
    deductionStatusLabel: string;
    amountTypeLabel: string;
    sourceCount: number;
    exportCount: number;
    excludedCount: number;
    totalAmount: number;
};

export type KBPreviewSnapshot = {
    createdAtIso: string;
    primaryAccount: PrimaryAccountSetting | null;
    sourceRows: KBPreviewSourceRow[];
    rows: KBTransferRow[];
    excludedRows: KBExcludedTransferRow[];
    criteria: KBPreviewCriteria;
};

export const formatKBPrimaryAccountLabel = (account: PrimaryAccountSetting): string => (
    [
        account.sourceName,
        account.bankName,
        account.accountNumber,
        account.accountHolder ? `(${account.accountHolder})` : '',
    ].filter(Boolean).join(' · ')
);

export const DEFAULT_PAYSLIP_CONTRACTOR_NAME = '(주)청연이엔지';

export const DEFAULT_PAYSLIP_CONTRACTOR_OPTIONS = [
    DEFAULT_PAYSLIP_CONTRACTOR_NAME,
    '(주)다원',
] as const;

export const CUSTOM_PAYSLIP_CONTRACTOR_VALUE = '__custom_contractor__';
