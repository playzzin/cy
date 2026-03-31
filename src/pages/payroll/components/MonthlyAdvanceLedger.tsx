import React, { useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import * as XLSX from 'xlsx-js-style';
import {
    AdvanceItemLabelsConfig,
    DEFAULT_ADVANCE_ITEM_LABELS
} from '../../../services/payrollConfigService';

export interface MonthlyAdvanceLedgerHandle {
    downloadExcel: (label?: string) => void;
}

type LedgerSide = 'invoice' | 'labor';
type LedgerSideNumberField =
    | 'carry'
    | 'carrySecond'
    | 'currentAdvance'
    | 'currentAdvanceSecond'
    | 'lodging'
    | 'electricity'
    | 'gas'
    | 'water'
    | 'internet'
    | 'management'
    | 'fine'
    | 'other';

interface LedgerSideInput {
    carry: number;
    carrySecond: number;
    currentAdvance: number;
    currentAdvanceSecond: number;
    lodging: number;
    electricity: number;
    gas: number;
    water: number;
    internet: number;
    management: number;
    fine: number;
    other: number;
}

interface LedgerManualInput {
    invoice: LedgerSideInput;
    labor: LedgerSideInput;
    personalMemo: string;
    assignmentType?: 'corporate' | 'labor'; // Legacy row-level field
    itemAssignments?: Record<string, 'corporate' | 'labor'>; // 추가: 개별 항목 분류
}

interface PayrollConfigLike {
    insuranceConfig?: {
        thresholdDays?: number;
        pensionRate?: number;
        healthRate?: number;
        careRateOfHealth?: number;
        employmentRate?: number;
        dailyWorkerFeePerManDay?: number;
        withholdingBaseDeduction?: number;
        withholdingIncomeBaseMultiplier?: number;
        withholdingIncomeTaxRate?: number;
        withholdingResidentTaxRate?: number;
        withholdingApplyAllLabor?: boolean;
        employmentApplyBelowThreshold?: boolean;
    };
    incomeTaxRate?: number;
    residentTaxRate?: number;
}

interface MonthlyAdvanceLedgerWorkEntry {
    date?: string;
    siteId?: string;
    siteName?: string;
    clientCompanyId?: string;
    isLaborSite?: boolean;
    paymentMethod?: string;
    manDay: number;
    unitPrice: number;
    amount?: number;
}

interface MonthlyAdvanceLedgerTaxAmounts {
    pension: number;
    health: number;
    care: number;
    employment: number;
    incomeTax: number;
    residentTax: number;
    businessIncomeTax: number;
    businessResidentTax: number;
    dailyFee?: number;
    isWithholdingTarget: boolean;
}

export interface MonthlyAdvanceLedgerRow {
    rowKey: string;
    month: string;
    teamId: string;
    teamName: string;
    workerId: string;
    workerName: string;
    salaryModel?: string;
    invoiceManDay: number;
    laborManDay: number;
    unitPrice: number;
    invoiceGrossAmount: number;
    laborGrossAmount: number;
    workEntries?: MonthlyAdvanceLedgerWorkEntry[];
    statementTaxAmounts?: MonthlyAdvanceLedgerTaxAmounts;
    assignmentType?: 'corporate' | 'labor'; // 추가
}

interface ComputedLedgerRow extends MonthlyAdvanceLedgerRow {
    manual: LedgerManualInput;
    invoiceDeductionTotal: number;
    laborDeductionTotal: number;
    utilityTotal: number;
    utilityAppliedToCorporate: number;
    utilityShiftedToPersonal: number;
    invoiceAdvanceTotal: number;
    laborAdvanceTotal: number;
    pension: number;
    health: number;
    care: number;
    employment: number;
    incomeTax: number;
    residentTax: number;
    businessIncomeTax: number;
    businessResidentTax: number;
    dailyFee: number;
    insuranceTotal: number;
    businessTotal: number;
    corporateNet: number;
    personalNet: number;
    isWithholdingTarget: boolean;
}

interface Props {
    rows: MonthlyAdvanceLedgerRow[];
    payrollConfig: any | null;
    advanceItemLabels?: Partial<AdvanceItemLabelsConfig>;
    withholdingThreshold: number;
    applyInsurance?: boolean;
    applyBusinessIncome?: boolean;
    applyDailyFee?: boolean;
    insuranceTeamSiteOnly?: boolean;
    isInsuranceEligibleEntry?: (entry: MonthlyAdvanceLedgerWorkEntry, row: MonthlyAdvanceLedgerRow) => boolean;
    clientCompanyNameById?: Record<string, string>;
    onInputsChange?: (inputs: Record<string, LedgerManualInput>) => void;
    initialInputs?: Record<string, LedgerManualInput>;
    visibleSections?: {
        utilities?: boolean;
        advances?: boolean;
        taxes?: boolean;
    };
}

interface LaborGroupSummary {
    key: string;
    siteName: string;
    clientCompanyId: string;
    clientLabel: string;
    manDay: number;
    amount: number;
    category: 'insurance' | 'withholding' | 'business' | 'none';
    hasUnknownClient: boolean;
}

const createEmptySideInput = (): LedgerSideInput => ({
    carry: 0,
    carrySecond: 0,
    currentAdvance: 0,
    currentAdvanceSecond: 0,
    lodging: 0,
    electricity: 0,
    gas: 0,
    water: 0,
    internet: 0,
    management: 0,
    fine: 0,
    other: 0,
});

const createEmptyManualInput = (defaultAssignment?: 'corporate' | 'labor'): LedgerManualInput => ({
    invoice: createEmptySideInput(),
    labor: createEmptySideInput(),
    personalMemo: '',
    assignmentType: defaultAssignment ?? 'corporate',
    itemAssignments: {},
});

const resolveAssignmentType = (
    assignmentType: LedgerManualInput['assignmentType'] | undefined,
    fallback: 'corporate' | 'labor' = 'corporate'
): 'corporate' | 'labor' => {
    if (assignmentType === 'labor') return 'labor';
    if (assignmentType === 'corporate') return 'corporate';
    return fallback;
};

const SIDE_NUMBER_FIELDS: LedgerSideNumberField[] = [
    'carry',
    'carrySecond',
    'currentAdvance',
    'currentAdvanceSecond',
    'lodging',
    'electricity',
    'gas',
    'water',
    'internet',
    'management',
    'fine',
    'other',
];

const normalizeManualInput = (
    input: LedgerManualInput | undefined,
    defaultAssignment?: 'corporate' | 'labor'
): LedgerManualInput => ({
    invoice: { ...createEmptySideInput(), ...(input?.invoice ?? {}) },
    labor: { ...createEmptySideInput(), ...(input?.labor ?? {}) },
    personalMemo: input?.personalMemo ?? '',
    assignmentType: input?.assignmentType ?? defaultAssignment ?? 'corporate',
    itemAssignments: input?.itemAssignments ?? {},
});

const isSideInputEmpty = (side: LedgerSideInput | undefined): boolean => {
    const safeSide = { ...createEmptySideInput(), ...(side ?? {}) };
    return SIDE_NUMBER_FIELDS.every((field) => Number(safeSide[field] ?? 0) === 0);
};

const isManualInputEffectivelyEmpty = (
    input: LedgerManualInput | undefined,
    defaultAssignment?: 'corporate' | 'labor'
): boolean => {
    if (!input) return true;
    const memo = String(input.personalMemo ?? '').trim();
    const assignments = input.itemAssignments ?? {};
    const hasAssignment = Object.keys(assignments).some((key) => {
        const value = assignments[key];
        return (value === 'corporate' || value === 'labor') && String(key).trim().length > 0;
    });

    const baselineAssignment = resolveAssignmentType(defaultAssignment, 'corporate');
    const currentAssignment = resolveAssignmentType(input.assignmentType, baselineAssignment);
    const hasCustomAssignment = currentAssignment !== baselineAssignment;

    return (
        isSideInputEmpty(input.invoice)
        && isSideInputEmpty(input.labor)
        && memo.length === 0
        && !hasAssignment
        && !hasCustomAssignment
    );
};

const toSafeAmount = (value: string): number => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return 0;
    return Math.floor(parsed);
};

const floorWon = (value: number): number => Math.floor(Number.isFinite(value) ? value : 0);
const formatAmount = (value: number): string => (value > 0 ? value.toLocaleString('ko-KR') : '-');
const formatManDay = (value: number): string => (value > 0 ? value.toFixed(1) : '-');
const getSalaryModelOrder = (salaryModel?: string): number => {
    const normalized = (salaryModel ?? '').trim();
    if (normalized === '월급제') return 0;
    if (normalized === '일급제') return 1;
    return 2;
};

const getSalaryModelLabelClassName = (salaryModel?: string): string => {
    const normalized = (salaryModel ?? '').trim();
    if (normalized === '일급제') return 'bg-sky-100 text-sky-900';
    return 'bg-amber-100 text-amber-900';
};

const LedgerInputCell: React.FC<{
    value: number;
    onChange: (next: number) => void;
    assignment?: 'corporate' | 'labor';
    onAssignmentChange?: (next: 'corporate' | 'labor') => void;
    className?: string;
    placeholder?: string;
}> = ({ value, onChange, assignment, onAssignmentChange, className = '', placeholder = '-' }) => {
    // 부모 td의 색상에 맞춰 input 배경색을 동적으로 지정
    let inputBg = '';
    if (className.includes('bg-blue-100')) inputBg = 'bg-blue-100';
    else if (className.includes('bg-emerald-100')) inputBg = 'bg-emerald-100';
    else inputBg = '';

    return (
        <div className="flex flex-col gap-0.5 group">
            <div className="flex items-center gap-1">
                <input
                    type="number"
                    min={0}
                    step={1000}
                    value={value === 0 ? '' : String(value)}
                    onChange={(e) => onChange(toSafeAmount(e.target.value))}
                    className={`w-full ${inputBg} border border-transparent hover:border-slate-300 focus:border-blue-400 focus:bg-white rounded px-1.5 text-right text-[12px] font-mono outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-all ${className}`}
                    placeholder={placeholder}
                />
                {onAssignmentChange && (
                    <button
                        type="button"
                        onClick={() => onAssignmentChange(assignment === 'corporate' ? 'labor' : 'corporate')}
                        className={`shrink-0 w-4 h-4 flex items-center justify-center rounded-[2px] text-[9px] font-bold transition-colors ${
                            assignment === 'corporate'
                                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                : 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                        }`}
                        title={assignment === 'corporate' ? '법인 분류 (클릭 시 노무로 변경)' : '노무 분류 (클릭 시 법인으로 변경)'}
                    >
                        {assignment === 'corporate' ? '법' : '노'}
                    </button>
                )}
            </div>
        </div>
    );
};

const sumSideDeductions = (side: LedgerSideInput): number =>
    side.lodging + side.electricity + side.gas + side.water + side.internet + side.management + side.fine + side.other;

const sumSideAdvances = (side: LedgerSideInput): number =>
    side.carry + side.carrySecond + side.currentAdvance + side.currentAdvanceSecond;

const MonthlyAdvanceLedger = React.forwardRef(function MonthlyAdvanceLedger({
    rows,
    payrollConfig,
    advanceItemLabels,
    withholdingThreshold = 7,
    applyInsurance = false,
    applyBusinessIncome = false,
    applyDailyFee = false,
    insuranceTeamSiteOnly = false,
    isInsuranceEligibleEntry,
    clientCompanyNameById = {},
    onInputsChange,
    initialInputs,
    visibleSections,
}: Props, ref: React.ForwardedRef<MonthlyAdvanceLedgerHandle>) {
    const showUtilities = visibleSections?.utilities ?? true;
    const showAdvances = visibleSections?.advances ?? true;
    const showTaxes = visibleSections?.taxes ?? true;
    const [inputsByRowKey, setInputsByRowKey] = useState<Record<string, LedgerManualInput>>({});
    const [showLaborGroupBasis, setShowLaborGroupBasis] = useState<boolean>(false);
    const touchedRowKeysRef = React.useRef<Set<string>>(new Set());
    const resolvedAdvanceItemLabels = useMemo<AdvanceItemLabelsConfig>(() => {
        const next: AdvanceItemLabelsConfig = { ...DEFAULT_ADVANCE_ITEM_LABELS };
        Object.entries(advanceItemLabels || {}).forEach(([key, val]) => {
            const trimmed = String(val ?? '').trim();
            if (trimmed) {
                next[key as keyof AdvanceItemLabelsConfig] = trimmed;
            }
        });
        return next;
    }, [advanceItemLabels]);
    const totalColumnCount = 10 + (showUtilities ? 5 : 0) + (showAdvances ? 5 : 0) + (showTaxes ? 7 : 0);
    const tableMinWidth = Math.floor((708 + (showUtilities ? 392 : 0) + (showAdvances ? 432 : 0) + (showTaxes ? 590 : 0)) * 1.38);

    useEffect(() => {
        setInputsByRowKey((prev) => {
            const next: Record<string, LedgerManualInput> = {};
            let changed = false;

            rows.forEach((row) => {
                const prevInput = prev[row.rowKey];
                const initialInput = initialInputs?.[row.rowKey];
                const isTouchedRow = touchedRowKeysRef.current.has(row.rowKey);
                const shouldAdoptInitial = Boolean(initialInput) && !isTouchedRow && isManualInputEffectivelyEmpty(prevInput, row.assignmentType);
                const existing = shouldAdoptInitial ? initialInput : (prevInput ?? initialInput);
                if (!existing) {
                    changed = true;
                    next[row.rowKey] = createEmptyManualInput(row.assignmentType);
                    return;
                }

                const normalized = normalizeManualInput(existing, row.assignmentType);

                const isSameInvoice =
                    existing.invoice?.carry === normalized.invoice.carry
                    && existing.invoice?.carrySecond === normalized.invoice.carrySecond
                    && existing.invoice?.currentAdvance === normalized.invoice.currentAdvance
                    && existing.invoice?.currentAdvanceSecond === normalized.invoice.currentAdvanceSecond
                    && existing.invoice?.lodging === normalized.invoice.lodging
                    && existing.invoice?.electricity === normalized.invoice.electricity
                    && existing.invoice?.gas === normalized.invoice.gas
                    && existing.invoice?.water === normalized.invoice.water
                    && existing.invoice?.internet === normalized.invoice.internet
                    && existing.invoice?.management === normalized.invoice.management
                    && existing.invoice?.fine === normalized.invoice.fine
                    && existing.invoice?.other === normalized.invoice.other;

                const isSameLabor =
                    existing.labor?.carry === normalized.labor.carry
                    && existing.labor?.carrySecond === normalized.labor.carrySecond
                    && existing.labor?.currentAdvance === normalized.labor.currentAdvance
                    && existing.labor?.currentAdvanceSecond === normalized.labor.currentAdvanceSecond
                    && existing.labor?.lodging === normalized.labor.lodging
                    && existing.labor?.electricity === normalized.labor.electricity
                    && existing.labor?.gas === normalized.labor.gas
                    && existing.labor?.water === normalized.labor.water
                    && existing.labor?.internet === normalized.labor.internet
                    && existing.labor?.management === normalized.labor.management
                    && existing.labor?.fine === normalized.labor.fine
                    && existing.labor?.other === normalized.labor.other;

                const existingAssignments = existing.itemAssignments ?? {};
                const normalizedAssignments = normalized.itemAssignments ?? {};
                const assignmentKeys = Array.from(
                    new Set([...Object.keys(existingAssignments), ...Object.keys(normalizedAssignments)])
                );
                const isSameAssignments = assignmentKeys.every((assignmentKey) => (
                    (existingAssignments[assignmentKey] ?? 'corporate') === (normalizedAssignments[assignmentKey] ?? 'corporate')
                ));

                const isSame =
                    isSameInvoice
                    && isSameLabor
                    && (existing.personalMemo ?? '') === normalized.personalMemo
                    && (existing.assignmentType ?? row.assignmentType ?? 'corporate') === normalized.assignmentType
                    && isSameAssignments;

                if (!isSame) {
                    changed = true;
                    next[row.rowKey] = normalized;
                    return;
                }

                next[row.rowKey] = existing;
            });

            if (Object.keys(prev).length !== rows.length) {
                changed = true;
            }

            return changed ? next : prev;
        });
    }, [initialInputs, rows]);

    // useRef를 사용해 이전 inputsByRowKey를 추적하여 실제 변경 시에만 콜백 호출
    const prevInputsByRowKeyRef = React.useRef<Record<string, LedgerManualInput>>(inputsByRowKey);
    
    useEffect(() => {
        const prev = prevInputsByRowKeyRef.current;
        const curr = inputsByRowKey;
        
        // 객체 참조가 같으면 콜백 호출 안 함
        if (prev === curr) {
            return;
        }
        
        // 키 개수가 다르면 변경됨
        const prevKeys = Object.keys(prev);
        const currKeys = Object.keys(curr);
        if (prevKeys.length !== currKeys.length) {
            prevInputsByRowKeyRef.current = curr;
            onInputsChange?.(curr);
            return;
        }
        
        // 각 키의 값 비교
        let hasActualChange = false;
        for (const key of currKeys) {
            const prevValue = prev[key];
            const currValue = curr[key];
            if (prevValue !== currValue) {
                hasActualChange = true;
                break;
            }
        }
        
        if (hasActualChange) {
            prevInputsByRowKeyRef.current = curr;
            onInputsChange?.(curr);
        }
    }, [inputsByRowKey, onInputsChange]);

    const updateSideField = useCallback(
        (rowKey: string, side: LedgerSide, field: LedgerSideNumberField, value: number) => {
            touchedRowKeysRef.current.add(rowKey);
            setInputsByRowKey((prev) => {
                const base = prev[rowKey] ?? createEmptyManualInput();
                return {
                    ...prev,
                    [rowKey]: {
                        ...base,
                        [side]: {
                            ...base[side],
                            [field]: value,
                        },
                    },
                };
            });
        },
        []
    );

    const updatePersonalMemo = useCallback((rowKey: string, value: string) => {
        touchedRowKeysRef.current.add(rowKey);
        setInputsByRowKey((prev) => {
            const base = prev[rowKey] ?? createEmptyManualInput();
            return {
                ...prev,
                [rowKey]: {
                    ...base,
                    personalMemo: value,
                },
            };
        });
    }, []);

    const updateAssignmentType = useCallback((rowKey: string, value: 'corporate' | 'labor') => {
        touchedRowKeysRef.current.add(rowKey);
        setInputsByRowKey((prev) => {
            const base = prev[rowKey] ?? createEmptyManualInput();
            return {
                ...prev,
                [rowKey]: {
                    ...base,
                    assignmentType: value,
                },
            };
        });
    }, []);

    const updateItemAssignment = useCallback((rowKey: string, itemKey: string, value: 'corporate' | 'labor') => {
        touchedRowKeysRef.current.add(rowKey);
        setInputsByRowKey((prev) => {
            const base = prev[rowKey] ?? createEmptyManualInput();
            return {
                ...prev,
                [rowKey]: {
                    ...base,
                    itemAssignments: {
                        ...(base.itemAssignments ?? {}),
                        [itemKey]: value,
                    },
                },
            };
        });
    }, []);

    const isInsuranceEligibleForRowEntry = useCallback(
        (entry: MonthlyAdvanceLedgerWorkEntry, row: MonthlyAdvanceLedgerRow): boolean => {
            if (!insuranceTeamSiteOnly) return true;
            if (!isInsuranceEligibleEntry) return true;

            const rawAmount = Number(entry.amount ?? 0);
            const amount = Number.isFinite(rawAmount) && rawAmount > 0
                ? rawAmount
                : floorWon(Number(entry.manDay ?? 0) * Number(entry.unitPrice ?? 0));

            return isInsuranceEligibleEntry({ ...entry, amount }, row);
        },
        [insuranceTeamSiteOnly, isInsuranceEligibleEntry]
    );

    const getLaborGroupSummaries = useCallback(
        (row: MonthlyAdvanceLedgerRow): LaborGroupSummary[] => {
            const toNumber = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);
            const normalizeText = (value: unknown): string => String(value ?? '').trim().toLowerCase();
            const insuranceThreshold = Math.max(0, Math.floor(toNumber((payrollConfig as any)?.insuranceConfig?.thresholdDays)));
            const withholdingApplyAllLabor =
                typeof (payrollConfig as any)?.insuranceConfig?.withholdingApplyAllLabor === 'boolean'
                    ? (payrollConfig as any).insuranceConfig.withholdingApplyAllLabor
                    : true;

            const getSiteKey = (entry: MonthlyAdvanceLedgerWorkEntry): string => {
                const siteId = (entry.siteId ?? '').trim();
                if (siteId) return siteId;
                const normalizedSiteName = normalizeText(entry.siteName);
                if (normalizedSiteName) return `unresolved-site:${normalizedSiteName}`;
                return 'no-site';
            };

            const isLaborEntry = (entry: MonthlyAdvanceLedgerWorkEntry): boolean =>
                Boolean(entry.isLaborSite) || (entry.paymentMethod ?? '').trim() === '노무';

            const getLaborGroupKey = (entry: MonthlyAdvanceLedgerWorkEntry): string => {
                const siteKey = getSiteKey(entry);
                const clientCompanyId = (entry.clientCompanyId ?? '').trim();
                const clientKey = clientCompanyId || '__no_client__';
                return `${siteKey}::${clientKey}`;
            };

            const defaultEntries: MonthlyAdvanceLedgerWorkEntry[] = [];
            if (row.invoiceGrossAmount > 0 || row.invoiceManDay > 0) {
                defaultEntries.push({
                    date: row.month,
                    siteId: '__invoice',
                    siteName: '계산서',
                    manDay: row.invoiceManDay,
                    unitPrice: row.unitPrice,
                    amount: row.invoiceGrossAmount,
                    paymentMethod: '계산서',
                    isLaborSite: false,
                });
            }
            if (row.laborGrossAmount > 0 || row.laborManDay > 0) {
                defaultEntries.push({
                    date: row.month,
                    siteId: '__labor',
                    siteName: '노무',
                    manDay: row.laborManDay,
                    unitPrice: row.unitPrice,
                    amount: row.laborGrossAmount,
                    paymentMethod: '노무',
                    isLaborSite: true,
                });
            }

            const sourceEntries = (row.workEntries ?? []).length > 0 ? row.workEntries ?? [] : defaultEntries;
            const laborGroupAgg = new Map<
                string,
                {
                    siteName: string;
                    clientCompanyId: string;
                    manDay: number;
                    amount: number;
                    hasUnknownClient: boolean;
                }
            >();
            const insuranceEligibleGroupAgg = new Map<string, { manDay: number; amount: number }>();

            sourceEntries.forEach((entry) => {
                if (!isLaborEntry(entry)) return;
                const amount = toNumber(entry.amount) > 0 ? toNumber(entry.amount) : toNumber(entry.manDay) * toNumber(entry.unitPrice);
                const manDay = toNumber(entry.manDay);
                if (amount <= 0 && manDay <= 0) return;

                const groupKey = getLaborGroupKey(entry);
                const clientCompanyId = (entry.clientCompanyId ?? '').trim();
                const prev = laborGroupAgg.get(groupKey) ?? {
                    siteName: (entry.siteName ?? '').trim() || '-',
                    clientCompanyId,
                    manDay: 0,
                    amount: 0,
                    hasUnknownClient: !clientCompanyId,
                };
                laborGroupAgg.set(groupKey, {
                    siteName: prev.siteName || (entry.siteName ?? '').trim() || '-',
                    clientCompanyId: clientCompanyId || prev.clientCompanyId,
                    manDay: prev.manDay + manDay,
                    amount: prev.amount + amount,
                    hasUnknownClient: prev.hasUnknownClient || !clientCompanyId,
                });

                if (!isInsuranceEligibleForRowEntry(entry, row)) return;

                const insurancePrev = insuranceEligibleGroupAgg.get(groupKey) ?? { manDay: 0, amount: 0 };
                insuranceEligibleGroupAgg.set(groupKey, {
                    manDay: insurancePrev.manDay + manDay,
                    amount: insurancePrev.amount + amount,
                });
            });

            const insuranceGroupKeys = new Set<string>();
            if (applyInsurance && insuranceThreshold > 0) {
                insuranceEligibleGroupAgg.forEach((agg, groupKey) => {
                    if (agg.manDay >= insuranceThreshold) {
                        insuranceGroupKeys.add(groupKey);
                    }
                });
            }

            const withholdingGroupKeys = new Set<string>();
            if (applyInsurance) {
                laborGroupAgg.forEach((agg, groupKey) => {
                    if (agg.manDay <= 0) return;
                    if (withholdingApplyAllLabor) {
                        withholdingGroupKeys.add(groupKey);
                        return;
                    }
                    if (insuranceGroupKeys.has(groupKey)) return;
                    if (agg.manDay > 0 && agg.manDay <= withholdingThreshold) {
                        withholdingGroupKeys.add(groupKey);
                    }
                });
            }

            return Array.from(laborGroupAgg.entries())
                .map(([key, agg]) => {
                    const category: LaborGroupSummary['category'] = insuranceGroupKeys.has(key)
                        ? 'insurance'
                        : withholdingGroupKeys.has(key)
                            ? 'withholding'
                            : applyBusinessIncome
                                ? 'business'
                                : 'none';
                    const clientCompanyId = agg.clientCompanyId.trim();
                    const clientLabel = clientCompanyId
                        ? (clientCompanyNameById[clientCompanyId] ?? clientCompanyId)
                        : '미지정';
                    return {
                        key,
                        siteName: agg.siteName,
                        clientCompanyId,
                        clientLabel,
                        manDay: agg.manDay,
                        amount: agg.amount,
                        category,
                        hasUnknownClient: agg.hasUnknownClient,
                    };
                })
                .sort((a, b) => b.manDay - a.manDay);
        },
        [
            applyBusinessIncome,
            applyInsurance,
            clientCompanyNameById,
            isInsuranceEligibleForRowEntry,
            payrollConfig?.insuranceConfig?.thresholdDays,
            payrollConfig?.insuranceConfig?.withholdingApplyAllLabor,
            withholdingThreshold,
        ]
    );



    const computedRows = useMemo<ComputedLedgerRow[]>(() => {
        const toNumber = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);
        const normalizeText = (value: unknown): string => String(value ?? '').trim().toLowerCase();

        const pensionRate = payrollConfig?.insuranceConfig?.pensionRate ?? 0.045;
        const healthRate = payrollConfig?.insuranceConfig?.healthRate ?? 0.03545;
        const careRateOfHealth = payrollConfig?.insuranceConfig?.careRateOfHealth ?? 0.1295;
        const employmentRate = payrollConfig?.insuranceConfig?.employmentRate ?? 0.009;
        const insuranceThreshold = Math.max(0, Math.floor(toNumber(payrollConfig?.insuranceConfig?.thresholdDays)));
        const withholdingBaseDeduction = Math.max(0, Math.floor(toNumber(payrollConfig?.insuranceConfig?.withholdingBaseDeduction ?? 150000)));
        const withholdingTaxCreditRate = Math.min(1, Math.max(0, toNumber(payrollConfig?.insuranceConfig?.withholdingIncomeBaseMultiplier ?? 0.55)));
        const withholdingIncomeTaxRate = Math.max(
            0,
            toNumber(payrollConfig?.insuranceConfig?.withholdingIncomeTaxRate ?? payrollConfig?.incomeTaxRate ?? 0.06)
        );
        const withholdingResidentTaxRate = Math.max(
            0,
            toNumber(payrollConfig?.insuranceConfig?.withholdingResidentTaxRate ?? payrollConfig?.residentTaxRate ?? 0.1)
        );
        const withholdingApplyAllLabor =
            typeof (payrollConfig as any)?.insuranceConfig?.withholdingApplyAllLabor === 'boolean'
                ? (payrollConfig as any).insuranceConfig.withholdingApplyAllLabor
                : true;
        const employmentApplyBelowThreshold =
            typeof (payrollConfig as any)?.insuranceConfig?.employmentApplyBelowThreshold === 'boolean'
                ? (payrollConfig as any).insuranceConfig.employmentApplyBelowThreshold
                : true;
        const dailyWorkerFeePerManDay = Math.max(0, Math.floor(toNumber((payrollConfig as any)?.insuranceConfig?.dailyWorkerFeePerManDay ?? 0)));
        const businessIncomeRate = 0.03;
        const businessResidentRate = 0.003;

        return rows
            .map((row) => {
                const manual = inputsByRowKey[row.rowKey] ?? createEmptyManualInput();
                const invoiceDeductionTotal = sumSideDeductions(manual.invoice);
                const laborDeductionTotal = sumSideDeductions(manual.labor);
                const utilityTotal = invoiceDeductionTotal + laborDeductionTotal;
                const invoiceAdvanceTotal = sumSideAdvances(manual.invoice);
                const laborAdvanceTotal = sumSideAdvances(manual.labor);

                const laborGrossAmount = Math.max(0, row.laborGrossAmount);
                const invoiceGrossAmount = Math.max(0, row.invoiceGrossAmount);

                let pension = 0;
                let health = 0;
                let care = 0;
                let employment = 0;
                let incomeTax = 0;
                let residentTax = 0;
                let businessIncomeTax = 0;
                let businessResidentTax = 0;
                let dailyFee = 0;
                let isWithholdingTarget = false;
                const isDailyWageWorker = (row.salaryModel ?? '').trim() === '일급제';

                if (row.statementTaxAmounts) {
                    pension = floorWon(row.statementTaxAmounts.pension);
                    health = floorWon(row.statementTaxAmounts.health);
                    care = floorWon(row.statementTaxAmounts.care);
                    employment = floorWon(row.statementTaxAmounts.employment);
                    incomeTax = floorWon(row.statementTaxAmounts.incomeTax);
                    residentTax = floorWon(row.statementTaxAmounts.residentTax);
                    businessIncomeTax = floorWon(row.statementTaxAmounts.businessIncomeTax);
                    businessResidentTax = floorWon(row.statementTaxAmounts.businessResidentTax);
                    isWithholdingTarget = Boolean(row.statementTaxAmounts.isWithholdingTarget);
                    const stmtDailyFee = applyDailyFee ? floorWon(row.statementTaxAmounts.dailyFee ?? 0) : 0;
                    if (stmtDailyFee > 0) {
                        dailyFee = stmtDailyFee;
                    } else if (applyDailyFee && isDailyWageWorker && dailyWorkerFeePerManDay > 0) {
                        const totalManDay = toNumber(row.invoiceManDay) + toNumber(row.laborManDay);
                        dailyFee = floorWon(totalManDay * dailyWorkerFeePerManDay);
                    }
                } else {
                    const getSiteKey = (entry: MonthlyAdvanceLedgerWorkEntry): string => {
                        const siteId = (entry.siteId ?? '').trim();
                        if (siteId) return siteId;
                        const normalizedSiteName = normalizeText(entry.siteName);
                        if (normalizedSiteName) return `unresolved-site:${normalizedSiteName}`;
                        return 'no-site';
                    };

                    const defaultEntries: MonthlyAdvanceLedgerWorkEntry[] = [];
                    if (invoiceGrossAmount > 0 || row.invoiceManDay > 0) {
                        defaultEntries.push({
                            date: row.month,
                            siteId: '__invoice',
                            siteName: '계산서',
                            manDay: row.invoiceManDay,
                            unitPrice: row.unitPrice,
                            amount: invoiceGrossAmount,
                            paymentMethod: '계산서',
                            isLaborSite: false,
                        });
                    }
                    if (laborGrossAmount > 0 || row.laborManDay > 0) {
                        defaultEntries.push({
                            date: row.month,
                            siteId: '__labor',
                            siteName: '노무',
                            manDay: row.laborManDay,
                            unitPrice: row.unitPrice,
                            amount: laborGrossAmount,
                            paymentMethod: '노무',
                            isLaborSite: true,
                        });
                    }

                    const sourceEntries = (row.workEntries ?? []).length > 0 ? row.workEntries ?? [] : defaultEntries;
                    const allEntries = sourceEntries.filter((entry) => toNumber(entry.manDay) > 0 || toNumber(entry.amount) > 0);

                    const isLaborEntry = (entry: MonthlyAdvanceLedgerWorkEntry): boolean =>
                        Boolean(entry.isLaborSite) || (entry.paymentMethod ?? '').trim() === '노무';

                    const getLaborGroupKey = (entry: MonthlyAdvanceLedgerWorkEntry): string => {
                        const siteKey = getSiteKey(entry);
                        const clientCompanyId = (entry.clientCompanyId ?? '').trim();
                        const clientKey = clientCompanyId || '__no_client__';
                        return `${siteKey}::${clientKey}`;
                    };

                    const laborGroupAgg = new Map<string, { manDay: number; amount: number }>();
                    const insuranceEligibleGroupAgg = new Map<string, { manDay: number; amount: number }>();

                    allEntries.forEach((entry) => {
                        const amount = toNumber(entry.amount) > 0 ? toNumber(entry.amount) : toNumber(entry.manDay) * toNumber(entry.unitPrice);
                        const manDay = toNumber(entry.manDay);

                        if (!isLaborEntry(entry)) return;
                        const groupKey = getLaborGroupKey(entry);
                        const prevLaborGroup = laborGroupAgg.get(groupKey) ?? { manDay: 0, amount: 0 };
                        laborGroupAgg.set(groupKey, {
                            manDay: prevLaborGroup.manDay + manDay,
                            amount: prevLaborGroup.amount + amount,
                        });

                        if (!isInsuranceEligibleForRowEntry(entry, row)) return;

                        const prevInsuranceGroup = insuranceEligibleGroupAgg.get(groupKey) ?? { manDay: 0, amount: 0 };
                        insuranceEligibleGroupAgg.set(groupKey, {
                            manDay: prevInsuranceGroup.manDay + manDay,
                            amount: prevInsuranceGroup.amount + amount,
                        });
                    });

                    const insuranceGroupKeys = new Set<string>();
                    if (applyInsurance && insuranceThreshold > 0) {
                        insuranceEligibleGroupAgg.forEach((agg, groupKey) => {
                            if (agg.manDay >= insuranceThreshold) {
                                insuranceGroupKeys.add(groupKey);
                            }
                        });
                    }

                    const insuranceBaseAmount = applyInsurance
                        ? Array.from(insuranceEligibleGroupAgg.entries()).reduce(
                            (sum, [groupKey, agg]) => sum + (insuranceGroupKeys.has(groupKey) ? toNumber(agg.amount) : 0),
                            0
                        )
                        : 0;

                    const withholdingGroupKeys = new Set<string>();
                    if (applyInsurance) {
                        laborGroupAgg.forEach((agg, groupKey) => {
                            if (agg.manDay <= 0) return;
                            if (withholdingApplyAllLabor) {
                                withholdingGroupKeys.add(groupKey);
                                return;
                            }
                            if (insuranceGroupKeys.has(groupKey)) return;
                            if (agg.manDay > 0 && agg.manDay <= withholdingThreshold) {
                                withholdingGroupKeys.add(groupKey);
                            }
                        });
                    }

                    const withholdingBaseAmount = applyInsurance
                        ? allEntries.reduce((sum, entry) => {
                            if (!isLaborEntry(entry)) return sum;
                            const groupKey = getLaborGroupKey(entry);
                            if (!withholdingGroupKeys.has(groupKey)) return sum;

                            const manDay = toNumber(entry.manDay);
                            if (manDay <= 0) return sum;

                            let unitPrice = toNumber(entry.unitPrice);
                            if (unitPrice <= 0) {
                                const amount = toNumber(entry.amount);
                                if (amount > 0) unitPrice = amount / manDay;
                            }
                            const taxableUnitPrice = Math.max(0, unitPrice - withholdingBaseDeduction);
                            if (taxableUnitPrice <= 0) return sum;

                            return sum + taxableUnitPrice * manDay;
                        }, 0)
                        : 0;

                    const employmentBaseAmount = applyInsurance
                        ? Array.from(laborGroupAgg.entries()).reduce((sum, [groupKey, agg]) => {
                            if (insuranceGroupKeys.has(groupKey)) return sum + toNumber(agg.amount);
                            if (withholdingGroupKeys.has(groupKey)) return sum + toNumber(agg.amount);
                            if (employmentApplyBelowThreshold) return sum + toNumber(agg.amount);
                            return sum;
                        }, 0)
                        : 0;

                    const businessBaseAmount = applyBusinessIncome
                        ? allEntries.reduce((sum, entry) => {
                            const amount = toNumber(entry.amount) > 0 ? toNumber(entry.amount) : toNumber(entry.manDay) * toNumber(entry.unitPrice);
                            if (amount <= 0) return sum;
                            if (isLaborEntry(entry)) {
                                const groupKey = getLaborGroupKey(entry);
                                if (insuranceGroupKeys.has(groupKey)) return sum;
                                if (withholdingGroupKeys.has(groupKey)) return sum;
                            }
                            return sum + amount;
                        }, 0)
                        : 0;

                    pension = applyInsurance ? floorWon(insuranceBaseAmount * pensionRate) : 0;
                    health = applyInsurance ? floorWon(insuranceBaseAmount * healthRate) : 0;
                    care = applyInsurance ? floorWon(health * careRateOfHealth) : 0;
                    employment = applyInsurance ? floorWon(employmentBaseAmount * employmentRate) : 0;

                    isWithholdingTarget = applyInsurance && withholdingBaseAmount > 0;
                    const withholdingTaxBeforeCredit = isWithholdingTarget ? floorWon(withholdingBaseAmount * withholdingIncomeTaxRate) : 0;
                    incomeTax = isWithholdingTarget ? floorWon(withholdingTaxBeforeCredit * (1 - withholdingTaxCreditRate)) : 0;
                    residentTax = isWithholdingTarget ? floorWon(incomeTax * withholdingResidentTaxRate) : 0;

                    businessIncomeTax = applyBusinessIncome ? floorWon(businessBaseAmount * businessIncomeRate) : 0;
                    businessResidentTax = applyBusinessIncome ? floorWon(businessBaseAmount * businessResidentRate) : 0;

                    const totalManDayForDailyFee = allEntries.reduce((sum, entry) => sum + toNumber(entry.manDay), 0);
                    dailyFee = applyDailyFee && isDailyWageWorker && dailyWorkerFeePerManDay > 0
                        ? floorWon(totalManDayForDailyFee * dailyWorkerFeePerManDay)
                        : 0;
                }
                const insuranceTotal = pension + health + care + employment;
                const businessTotal = businessIncomeTax + businessResidentTax;
                const dailyFeeAssignment: 'corporate' | 'labor' = (manual.itemAssignments?.['dailyFee'] ?? 'labor') as 'corporate' | 'labor';
                const dailyFeeForCorporate = dailyFeeAssignment === 'corporate' ? dailyFee : 0;
                const dailyFeeForPersonal = dailyFeeAssignment === 'labor' ? dailyFee : 0;
                const corporateBaseBeforeUtility = floorWon(invoiceGrossAmount - invoiceAdvanceTotal - businessTotal - dailyFeeForCorporate);
                const personalBaseBeforeUtility = floorWon(laborGrossAmount - laborAdvanceTotal - insuranceTotal - incomeTax - residentTax - dailyFeeForPersonal);

                const assignmentType = manual.assignmentType ?? row.assignmentType ?? 'corporate';
                
                const utilityFields: Array<{ key: LedgerSideNumberField }> = [
                    { key: 'lodging' },
                    { key: 'electricity' },
                    { key: 'gas' },
                    { key: 'water' },
                    { key: 'internet' },
                    { key: 'management' },
                    { key: 'fine' },
                    { key: 'other' },
                ];

                let utilityAppliedToCorporate = 0;
                let utilityShiftedToPersonal = 0;

                utilityFields.forEach((field) => {
                    const invoiceVal = toNumber(manual.invoice[field.key as keyof LedgerSideInput]);
                    const laborVal = toNumber(manual.labor[field.key as keyof LedgerSideInput]);
                    const itemTotal = invoiceVal + laborVal;
                    if (itemTotal <= 0) return;

                    const itemAssignment = manual.itemAssignments?.[field.key] ?? assignmentType;
                    if (itemAssignment === 'corporate') {
                        utilityAppliedToCorporate += itemTotal;
                    } else {
                        utilityShiftedToPersonal += itemTotal;
                    }
                });

                const corporateNet = Math.max(0, floorWon(corporateBaseBeforeUtility - utilityAppliedToCorporate));
                const personalNet = Math.max(0, floorWon(personalBaseBeforeUtility - utilityShiftedToPersonal));

                return {
                    ...row,
                    manual,
                    invoiceDeductionTotal,
                    laborDeductionTotal,
                    utilityTotal,
                    utilityAppliedToCorporate,
                    utilityShiftedToPersonal,
                    invoiceAdvanceTotal,
                    laborAdvanceTotal,
                    pension,
                    health,
                    care,
                    employment,
                    incomeTax,
                    residentTax,
                    businessIncomeTax,
                    businessResidentTax,
                    dailyFee,
                    insuranceTotal,
                    businessTotal,
                    corporateNet,
                    personalNet,
                    isWithholdingTarget,
                };
            })
            .sort((a, b) => {
                const teamCompare = (a.teamName || '').localeCompare(b.teamName || '', 'ko');
                if (teamCompare !== 0) return teamCompare;
                const salaryModelCompare = getSalaryModelOrder(a.salaryModel) - getSalaryModelOrder(b.salaryModel);
                if (salaryModelCompare !== 0) return salaryModelCompare;
                return (a.workerName || '').localeCompare(b.workerName || '', 'ko');
            });
    }, [
        applyBusinessIncome,
        applyDailyFee,
        applyInsurance,
        inputsByRowKey,
        isInsuranceEligibleForRowEntry,
        payrollConfig,
        rows,
        withholdingThreshold,
    ]);

    const groupedRows = useMemo(() => {
        const map = new Map<string, ComputedLedgerRow[]>();
        computedRows.forEach((row) => {
            const key = row.teamName || '미지정 팀';
            const list = map.get(key) ?? [];
            list.push(row);
            map.set(key, list);
        });
        return Array.from(map.entries())
            .map(([teamName, list]) => ({ teamName, rows: list }))
            .sort((a, b) => a.teamName.localeCompare(b.teamName, 'ko'));
    }, [computedRows]);

    const totals = useMemo(() => {
        return computedRows.reduce(
            (acc, row) => {
                acc.workerCount += 1;
                acc.invoiceManDay += row.invoiceManDay;
                acc.laborManDay += row.laborManDay;
                acc.invoiceGrossAmount += row.invoiceGrossAmount;
                acc.laborGrossAmount += row.laborGrossAmount;
                acc.invoiceDeductionTotal += row.invoiceDeductionTotal;
                acc.laborDeductionTotal += row.laborDeductionTotal;
                acc.invoiceAdvanceCarry += row.manual.invoice.carry;
                acc.laborAdvanceCarry += row.manual.labor.carry;
                acc.invoiceAdvanceCarrySecond += row.manual.invoice.carrySecond;
                acc.laborAdvanceCarrySecond += row.manual.labor.carrySecond;
                acc.invoiceAdvanceCurrent += row.manual.invoice.currentAdvance;
                acc.laborAdvanceCurrent += row.manual.labor.currentAdvance;
                acc.invoiceAdvanceCurrentSecond += row.manual.invoice.currentAdvanceSecond;
                acc.laborAdvanceCurrentSecond += row.manual.labor.currentAdvanceSecond;
                acc.invoiceAdvanceTotal += row.invoiceAdvanceTotal;
                acc.laborAdvanceTotal += row.laborAdvanceTotal;
                acc.pension += row.pension;
                acc.health += row.health;
                acc.care += row.care;
                acc.employment += row.employment;
                acc.incomeTax += row.incomeTax;
                acc.residentTax += row.residentTax;
                acc.businessIncomeTax += row.businessIncomeTax;
                acc.businessResidentTax += row.businessResidentTax;
                acc.dailyFee += row.dailyFee;
                acc.insuranceTotal += row.insuranceTotal;
                acc.businessTotal += row.businessTotal;
                acc.corporateNet += row.corporateNet;
                acc.personalNet += row.personalNet;
                return acc;
            },
            {
                workerCount: 0,
                invoiceManDay: 0,
                laborManDay: 0,
                invoiceGrossAmount: 0,
                laborGrossAmount: 0,
                invoiceDeductionTotal: 0,
                laborDeductionTotal: 0,
                invoiceAdvanceCarry: 0,
                laborAdvanceCarry: 0,
                invoiceAdvanceCarrySecond: 0,
                laborAdvanceCarrySecond: 0,
                invoiceAdvanceCurrent: 0,
                laborAdvanceCurrent: 0,
                invoiceAdvanceCurrentSecond: 0,
                laborAdvanceCurrentSecond: 0,
                invoiceAdvanceTotal: 0,
                laborAdvanceTotal: 0,
                pension: 0,
                health: 0,
                care: 0,
                employment: 0,
                incomeTax: 0,
                residentTax: 0,
                businessIncomeTax: 0,
                businessResidentTax: 0,
                dailyFee: 0,
                insuranceTotal: 0,
                businessTotal: 0,
                corporateNet: 0,
                personalNet: 0,
            }
        );
    }, [computedRows]);

    useImperativeHandle(ref, () => ({
        downloadExcel(label?: string) {
            if (computedRows.length === 0) {
                alert('다운로드할 데이터가 없습니다.');
                return;
            }
            const al = resolvedAdvanceItemLabels;

            type ColKind = 'text-left' | 'text-center' | 'amount' | 'manDay';
            type ColSection = 'base' | 'utilities' | 'advances' | 'taxes' | 'final';
            type RowKind = 'header' | 'team' | 'data' | 'teamSubtotal' | 'grandTotal';

            const headers: string[] = [];
            const colKinds: ColKind[] = [];
            const colSections: ColSection[] = [];
            const colWidths: Array<{ wch: number }> = [];
            const addColumn = (labelText: string, kind: ColKind, width: number, section: ColSection) => {
                headers.push(labelText);
                colKinds.push(kind);
                colSections.push(section);
                colWidths.push({ wch: width });
            };

            addColumn('No', 'text-center', 6, 'base');
            addColumn('팀', 'text-left', 14, 'base');
            addColumn('이름', 'text-left', 10, 'base');
            addColumn('구분', 'text-center', 9, 'base');
            addColumn('법인공수', 'manDay', 10, 'base');
            addColumn('노무공수', 'manDay', 10, 'base');
            addColumn('단가', 'amount', 12, 'base');
            addColumn('법인총액', 'amount', 12, 'base');
            addColumn('노무총액', 'amount', 12, 'base');

            if (showUtilities) {
                addColumn('숙소비(법인)', 'amount', 12, 'utilities');
                addColumn('전기(법인)', 'amount', 12, 'utilities');
                addColumn('가스(법인)', 'amount', 12, 'utilities');
                addColumn('수도(법인)', 'amount', 12, 'utilities');
                addColumn('인터넷(노무)', 'amount', 12, 'utilities');
                addColumn('관리비(노무)', 'amount', 12, 'utilities');
                addColumn('과태료(노무)', 'amount', 12, 'utilities');
                addColumn('기타(노무)', 'amount', 12, 'utilities');
                addColumn('법인공제합계', 'amount', 13, 'utilities');
                addColumn('노무공제합계', 'amount', 13, 'utilities');
            }

            if (showAdvances) {
                addColumn(`${al.corporateAdvance1}(법인)`, 'amount', 12, 'advances');
                addColumn(`${al.corporateAdvance2}(법인)`, 'amount', 12, 'advances');
                addColumn(`${al.corporateAdvance3}(법인)`, 'amount', 12, 'advances');
                addColumn(`${al.corporateAdvance4}(법인)`, 'amount', 12, 'advances');
                addColumn('법인가불합계', 'amount', 13, 'advances');
                addColumn(`${al.laborAdvance1}(노무)`, 'amount', 12, 'advances');
                addColumn(`${al.laborAdvance2}(노무)`, 'amount', 12, 'advances');
                addColumn(`${al.laborAdvance3}(노무)`, 'amount', 12, 'advances');
                addColumn(`${al.laborAdvance4}(노무)`, 'amount', 12, 'advances');
                addColumn('노무가불합계', 'amount', 13, 'advances');
            }

            if (showTaxes) {
                addColumn('국민연금', 'amount', 11, 'taxes');
                addColumn('건강보험', 'amount', 11, 'taxes');
                addColumn('장기요양', 'amount', 11, 'taxes');
                addColumn('고용보험', 'amount', 11, 'taxes');
                addColumn('갑근세', 'amount', 11, 'taxes');
                addColumn('지방세', 'amount', 11, 'taxes');
                addColumn('사업소득세', 'amount', 11, 'taxes');
                addColumn('지방소득세', 'amount', 11, 'taxes');
                addColumn('일급제수수료', 'amount', 12, 'taxes');
                addColumn('4대보험합계', 'amount', 12, 'taxes');
                addColumn('3.3%합계', 'amount', 11, 'taxes');
            }

            addColumn('법인실수령', 'amount', 13, 'final');
            addColumn('개인실수령', 'amount', 13, 'final');
            addColumn('순지급합계', 'amount', 13, 'final');
            addColumn('메모', 'text-left', 24, 'final');

            type Aggregate = {
                invoiceManDay: number;
                laborManDay: number;
                invoiceGrossAmount: number;
                laborGrossAmount: number;
                invoiceLodging: number;
                invoiceElectricity: number;
                invoiceGas: number;
                invoiceWater: number;
                laborInternet: number;
                laborManagement: number;
                laborFine: number;
                laborOther: number;
                invoiceDeductionTotal: number;
                laborDeductionTotal: number;
                invoiceAdvanceCarry: number;
                invoiceAdvanceCarrySecond: number;
                invoiceAdvanceCurrent: number;
                invoiceAdvanceCurrentSecond: number;
                invoiceAdvanceTotal: number;
                laborAdvanceCarry: number;
                laborAdvanceCarrySecond: number;
                laborAdvanceCurrent: number;
                laborAdvanceCurrentSecond: number;
                laborAdvanceTotal: number;
                pension: number;
                health: number;
                care: number;
                employment: number;
                incomeTax: number;
                residentTax: number;
                businessIncomeTax: number;
                businessResidentTax: number;
                dailyFee: number;
                insuranceTotal: number;
                businessTotal: number;
                corporateNet: number;
                personalNet: number;
                netTotal: number;
            };

            const aggregateRows = (targetRows: ComputedLedgerRow[]): Aggregate => targetRows.reduce(
                (acc, row) => {
                    acc.invoiceManDay += row.invoiceManDay;
                    acc.laborManDay += row.laborManDay;
                    acc.invoiceGrossAmount += row.invoiceGrossAmount;
                    acc.laborGrossAmount += row.laborGrossAmount;
                    acc.invoiceLodging += row.manual.invoice.lodging;
                    acc.invoiceElectricity += row.manual.invoice.electricity;
                    acc.invoiceGas += row.manual.invoice.gas;
                    acc.invoiceWater += row.manual.invoice.water;
                    acc.laborInternet += row.manual.labor.internet;
                    acc.laborManagement += row.manual.labor.management;
                    acc.laborFine += row.manual.labor.fine;
                    acc.laborOther += row.manual.labor.other;
                    acc.invoiceDeductionTotal += row.invoiceDeductionTotal;
                    acc.laborDeductionTotal += row.laborDeductionTotal;
                    acc.invoiceAdvanceCarry += row.manual.invoice.carry;
                    acc.invoiceAdvanceCarrySecond += row.manual.invoice.carrySecond;
                    acc.invoiceAdvanceCurrent += row.manual.invoice.currentAdvance;
                    acc.invoiceAdvanceCurrentSecond += row.manual.invoice.currentAdvanceSecond;
                    acc.invoiceAdvanceTotal += row.invoiceAdvanceTotal;
                    acc.laborAdvanceCarry += row.manual.labor.carry;
                    acc.laborAdvanceCarrySecond += row.manual.labor.carrySecond;
                    acc.laborAdvanceCurrent += row.manual.labor.currentAdvance;
                    acc.laborAdvanceCurrentSecond += row.manual.labor.currentAdvanceSecond;
                    acc.laborAdvanceTotal += row.laborAdvanceTotal;
                    acc.pension += row.pension;
                    acc.health += row.health;
                    acc.care += row.care;
                    acc.employment += row.employment;
                    acc.incomeTax += row.incomeTax;
                    acc.residentTax += row.residentTax;
                    acc.businessIncomeTax += row.businessIncomeTax;
                    acc.businessResidentTax += row.businessResidentTax;
                    acc.dailyFee += row.dailyFee;
                    acc.insuranceTotal += row.insuranceTotal;
                    acc.businessTotal += row.businessTotal;
                    acc.corporateNet += row.corporateNet;
                    acc.personalNet += row.personalNet;
                    acc.netTotal += (row.corporateNet + row.personalNet);
                    return acc;
                },
                {
                    invoiceManDay: 0,
                    laborManDay: 0,
                    invoiceGrossAmount: 0,
                    laborGrossAmount: 0,
                    invoiceLodging: 0,
                    invoiceElectricity: 0,
                    invoiceGas: 0,
                    invoiceWater: 0,
                    laborInternet: 0,
                    laborManagement: 0,
                    laborFine: 0,
                    laborOther: 0,
                    invoiceDeductionTotal: 0,
                    laborDeductionTotal: 0,
                    invoiceAdvanceCarry: 0,
                    invoiceAdvanceCarrySecond: 0,
                    invoiceAdvanceCurrent: 0,
                    invoiceAdvanceCurrentSecond: 0,
                    invoiceAdvanceTotal: 0,
                    laborAdvanceCarry: 0,
                    laborAdvanceCarrySecond: 0,
                    laborAdvanceCurrent: 0,
                    laborAdvanceCurrentSecond: 0,
                    laborAdvanceTotal: 0,
                    pension: 0,
                    health: 0,
                    care: 0,
                    employment: 0,
                    incomeTax: 0,
                    residentTax: 0,
                    businessIncomeTax: 0,
                    businessResidentTax: 0,
                    dailyFee: 0,
                    insuranceTotal: 0,
                    businessTotal: 0,
                    corporateNet: 0,
                    personalNet: 0,
                    netTotal: 0,
                }
            );

            const buildDataRow = (row: ComputedLedgerRow, no: number): Array<string | number | null> => {
                const out: Array<string | number | null> = [
                    no,
                    row.teamName || '',
                    row.workerName || '',
                    row.salaryModel || '월급제',
                    row.invoiceManDay,
                    row.laborManDay,
                    row.unitPrice,
                    row.invoiceGrossAmount,
                    row.laborGrossAmount,
                ];

                if (showUtilities) {
                    out.push(
                        row.manual.invoice.lodging,
                        row.manual.invoice.electricity,
                        row.manual.invoice.gas,
                        row.manual.invoice.water,
                        row.manual.labor.internet,
                        row.manual.labor.management,
                        row.manual.labor.fine,
                        row.manual.labor.other,
                        row.invoiceDeductionTotal,
                        row.laborDeductionTotal,
                    );
                }

                if (showAdvances) {
                    out.push(
                        row.manual.invoice.carry,
                        row.manual.invoice.carrySecond,
                        row.manual.invoice.currentAdvance,
                        row.manual.invoice.currentAdvanceSecond,
                        row.invoiceAdvanceTotal,
                        row.manual.labor.carry,
                        row.manual.labor.carrySecond,
                        row.manual.labor.currentAdvance,
                        row.manual.labor.currentAdvanceSecond,
                        row.laborAdvanceTotal,
                    );
                }

                if (showTaxes) {
                    out.push(
                        row.pension,
                        row.health,
                        row.care,
                        row.employment,
                        row.incomeTax,
                        row.residentTax,
                        row.businessIncomeTax,
                        row.businessResidentTax,
                        row.dailyFee,
                        row.insuranceTotal,
                        row.businessTotal,
                    );
                }

                out.push(row.corporateNet, row.personalNet, row.corporateNet + row.personalNet, row.manual.personalMemo ?? '');
                return out;
            };

            const buildSummaryRow = (
                title: string,
                teamName: string,
                workerCount: number,
                agg: Aggregate
            ): Array<string | number | null> => {
                const out: Array<string | number | null> = [
                    title,
                    teamName,
                    `${workerCount}명`,
                    '',
                    agg.invoiceManDay,
                    agg.laborManDay,
                    '',
                    agg.invoiceGrossAmount,
                    agg.laborGrossAmount,
                ];

                if (showUtilities) {
                    out.push(
                        agg.invoiceLodging,
                        agg.invoiceElectricity,
                        agg.invoiceGas,
                        agg.invoiceWater,
                        agg.laborInternet,
                        agg.laborManagement,
                        agg.laborFine,
                        agg.laborOther,
                        agg.invoiceDeductionTotal,
                        agg.laborDeductionTotal,
                    );
                }

                if (showAdvances) {
                    out.push(
                        agg.invoiceAdvanceCarry,
                        agg.invoiceAdvanceCarrySecond,
                        agg.invoiceAdvanceCurrent,
                        agg.invoiceAdvanceCurrentSecond,
                        agg.invoiceAdvanceTotal,
                        agg.laborAdvanceCarry,
                        agg.laborAdvanceCarrySecond,
                        agg.laborAdvanceCurrent,
                        agg.laborAdvanceCurrentSecond,
                        agg.laborAdvanceTotal,
                    );
                }

                if (showTaxes) {
                    out.push(
                        agg.pension,
                        agg.health,
                        agg.care,
                        agg.employment,
                        agg.incomeTax,
                        agg.residentTax,
                        agg.businessIncomeTax,
                        agg.businessResidentTax,
                        agg.dailyFee,
                        agg.insuranceTotal,
                        agg.businessTotal,
                    );
                }

                out.push(agg.corporateNet, agg.personalNet, agg.netTotal, '');
                return out;
            };

            const aoa: Array<Array<string | number | null>> = [];
            const rowKinds: RowKind[] = [];
            const merges: XLSX.Range[] = [];
            const pushRow = (row: Array<string | number | null>, kind: RowKind) => {
                aoa.push(row);
                rowKinds.push(kind);
            };

            pushRow(headers, 'header');

            let no = 1;
            groupedRows.forEach((group) => {
                const teamRowIdx = aoa.length;
                pushRow([
                    `${group.teamName} (${group.rows.length}명)`,
                    ...Array(headers.length - 1).fill(null),
                ], 'team');
                merges.push({ s: { r: teamRowIdx, c: 0 }, e: { r: teamRowIdx, c: headers.length - 1 } });

                group.rows.forEach((row) => {
                    pushRow(buildDataRow(row, no), 'data');
                    no += 1;
                });

                pushRow(
                    buildSummaryRow('소계', group.teamName, group.rows.length, aggregateRows(group.rows)),
                    'teamSubtotal'
                );
            });

            pushRow(
                buildSummaryRow('합계', '전체', computedRows.length, aggregateRows(computedRows)),
                'grandTotal'
            );

            const ws = XLSX.utils.aoa_to_sheet(aoa);
            ws['!merges'] = merges;
            ws['!cols'] = colWidths;
            ws['!autofilter'] = {
                ref: `A1:${XLSX.utils.encode_col(headers.length - 1)}1`
            };

            const border = {
                top: { style: 'thin' as const, color: { rgb: 'CBD5E1' } },
                bottom: { style: 'thin' as const, color: { rgb: 'CBD5E1' } },
                left: { style: 'thin' as const, color: { rgb: 'CBD5E1' } },
                right: { style: 'thin' as const, color: { rgb: 'CBD5E1' } },
            };
            const headerStyleBase = {
                font: { name: '맑은 고딕', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
                alignment: { horizontal: 'center' as const, vertical: 'center' as const },
                border,
            };
            const teamStyle = {
                fill: { fgColor: { rgb: '334155' }, patternType: 'solid' as const },
                font: { name: '맑은 고딕', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
                alignment: { horizontal: 'left' as const, vertical: 'center' as const },
                border,
            };
            const dataLeftStyle = {
                font: { name: '맑은 고딕', sz: 9 },
                alignment: { horizontal: 'left' as const, vertical: 'center' as const },
                border,
            };
            const dataCenterStyle = {
                font: { name: '맑은 고딕', sz: 9 },
                alignment: { horizontal: 'center' as const, vertical: 'center' as const },
                border,
            };
            const dataAmountStyle = {
                font: { name: '맑은 고딕', sz: 9 },
                alignment: { horizontal: 'right' as const, vertical: 'center' as const },
                numFmt: '#,##0',
                border,
            };
            const dataManDayStyle = {
                font: { name: '맑은 고딕', sz: 9 },
                alignment: { horizontal: 'right' as const, vertical: 'center' as const },
                numFmt: '#,##0.0#',
                border,
            };
            const headerFillBySection = (section: ColSection) => {
                if (section === 'utilities') return { fgColor: { rgb: '475569' }, patternType: 'solid' as const };
                if (section === 'advances') return { fgColor: { rgb: 'A16207' }, patternType: 'solid' as const };
                if (section === 'taxes') return { fgColor: { rgb: '92400E' }, patternType: 'solid' as const };
                if (section === 'final') return { fgColor: { rgb: '166534' }, patternType: 'solid' as const };
                return { fgColor: { rgb: '1E3A5F' }, patternType: 'solid' as const };
            };
            const dataFillBySection = (section: ColSection) => {
                if (section === 'utilities') return { fgColor: { rgb: 'F1F5F9' }, patternType: 'solid' as const };
                if (section === 'advances') return { fgColor: { rgb: 'FEF3C7' }, patternType: 'solid' as const };
                if (section === 'taxes') return { fgColor: { rgb: 'FEF9C3' }, patternType: 'solid' as const };
                if (section === 'final') return { fgColor: { rgb: 'ECFDF5' }, patternType: 'solid' as const };
                return undefined;
            };
            const subtotalFill = { fgColor: { rgb: 'FEF3C7' }, patternType: 'solid' as const };
            const grandFill = { fgColor: { rgb: 'DBEAFE' }, patternType: 'solid' as const };
            const makeSummaryStyle = (colKind: ColKind, fill: { fgColor: { rgb: string }; patternType: 'solid' }) => {
                if (colKind === 'text-left') {
                    return {
                        ...dataLeftStyle,
                        fill,
                        font: { name: '맑은 고딕', sz: 10, bold: true },
                    };
                }
                if (colKind === 'text-center') {
                    return {
                        ...dataCenterStyle,
                        fill,
                        font: { name: '맑은 고딕', sz: 10, bold: true },
                    };
                }
                if (colKind === 'manDay') {
                    return {
                        ...dataManDayStyle,
                        fill,
                        font: { name: '맑은 고딕', sz: 10, bold: true },
                    };
                }
                return {
                    ...dataAmountStyle,
                    fill,
                    font: { name: '맑은 고딕', sz: 10, bold: true },
                };
            };

            const pickDataStyle = (colKind: ColKind, section: ColSection) => {
                const fill = dataFillBySection(section);
                if (colKind === 'text-left') return fill ? { ...dataLeftStyle, fill } : dataLeftStyle;
                if (colKind === 'text-center') return fill ? { ...dataCenterStyle, fill } : dataCenterStyle;
                if (colKind === 'manDay') return fill ? { ...dataManDayStyle, fill } : dataManDayStyle;
                return fill ? { ...dataAmountStyle, fill } : dataAmountStyle;
            };

            const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
            for (let r = range.s.r; r <= range.e.r; r += 1) {
                for (let c = range.s.c; c <= range.e.c; c += 1) {
                    const addr = XLSX.utils.encode_cell({ r, c });
                    if (!ws[addr]) ws[addr] = { t: 'z', v: null };
                    const cell = ws[addr] as XLSX.CellObject & { s?: unknown };
                    const rowKind = rowKinds[r];
                    const colKind = colKinds[c] ?? 'text-left';
                    const colSection = colSections[c] ?? 'base';

                    if (rowKind === 'header') {
                        cell.s = {
                            ...headerStyleBase,
                            fill: headerFillBySection(colSection),
                        };
                    } else if (rowKind === 'team') {
                        cell.s = teamStyle;
                    } else if (rowKind === 'teamSubtotal') {
                        cell.s = makeSummaryStyle(colKind, subtotalFill);
                    } else if (rowKind === 'grandTotal') {
                        cell.s = makeSummaryStyle(colKind, grandFill);
                    } else {
                        cell.s = pickDataStyle(colKind, colSection);
                    }

                    if (typeof cell.v === 'number') {
                        cell.t = 'n';
                    }
                }
            }

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, '팀별가불대장');

            const safeLabel = String(label ?? '')
                .trim()
                .replace(/[\\/:*?"<>|]/g, '-')
                .replace(/\s+/g, '_');
            const fileName = safeLabel
                ? `팀별가불대장_${safeLabel}.xlsx`
                : '팀별가불대장.xlsx';
            XLSX.writeFile(wb, fileName);
        },
    }), [computedRows, groupedRows, totals, resolvedAdvanceItemLabels, showUtilities, showAdvances, showTaxes]);

    const rateText = useMemo(() => {
        const pensionRate = ((payrollConfig?.insuranceConfig?.pensionRate ?? 0.045) * 100).toFixed(2);
        const healthRate = ((payrollConfig?.insuranceConfig?.healthRate ?? 0.03545) * 100).toFixed(3);
        const careRate = ((payrollConfig?.insuranceConfig?.careRateOfHealth ?? 0.1295) * 100).toFixed(2);
        const employmentRate = ((payrollConfig?.insuranceConfig?.employmentRate ?? 0.009) * 100).toFixed(3);
        const incomeRate = ((
            payrollConfig?.insuranceConfig?.withholdingIncomeTaxRate ?? payrollConfig?.incomeTaxRate ?? 0.06
        ) * 100).toFixed(2);
        const residentRate = ((
            payrollConfig?.insuranceConfig?.withholdingResidentTaxRate ?? payrollConfig?.residentTaxRate ?? 0.1
        ) * 100).toFixed(2);
        const withholdingBaseDeduction = Math.floor(
            Number(payrollConfig?.insuranceConfig?.withholdingBaseDeduction ?? 150000)
        ).toLocaleString('ko-KR');
        const withholdingTaxCreditRate = (
            Number(payrollConfig?.insuranceConfig?.withholdingIncomeBaseMultiplier ?? 0.55) * 100
        ).toFixed(2);
        const dailyWorkerFeePerManDay = Math.max(0, Math.floor(Number(payrollConfig?.insuranceConfig?.dailyWorkerFeePerManDay ?? 0))).toLocaleString('ko-KR');
        return {
            pensionRate,
            healthRate,
            careRate,
            employmentRate,
            incomeRate,
            residentRate,
            withholdingBaseDeduction,
            withholdingTaxCreditRate,
            dailyWorkerFeePerManDay,
        };
    }, [payrollConfig]);

    return (
        <div className="flex-1 min-h-0 bg-white rounded-2xl border border-slate-300 shadow-sm flex flex-col overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-200 bg-gradient-to-r from-slate-100 to-blue-50">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">팀별 가불대장</h3>
                        <p className="text-[14px] text-slate-600 mt-0.5">
                            팀 소속 작업자의 계산서/노무 공수 분리, 공제 직접 입력, 법인/개인 가불 공제, 세금 계산을 한 화면에서 처리합니다.
                        </p>
                        <p className="text-[14px] text-slate-500 mt-1">
                            적용 상태: 4대보험 {applyInsurance ? '적용' : '미적용'} / 사업소득 {applyBusinessIncome ? '적용' : '미적용'} / 일급제 수수료 {applyDailyFee ? '적용' : '미적용'}
                        </p>
                    </div>
                    <div className="flex flex-col items-start lg:items-end gap-2">
                        <div className="text-[13px] text-slate-600 bg-white border border-slate-200 rounded-lg px-3 py-2 font-medium">
                            4대보험: 국민연금 {rateText.pensionRate}% / 건강보험 {rateText.healthRate}% / 장기요양(건강보험) {rateText.careRate}% / 고용보험 {rateText.employmentRate}%<br />
                            원천세: ((단가 - {rateText.withholdingBaseDeduction}원) × 노무공수 × 갑근세 {rateText.incomeRate}%) × (1 - 세액공제율 {rateText.withholdingTaxCreditRate}%) / 지방세(소득세의 {rateText.residentRate}%) | 사업소득: 3.0% + 0.3% | 일급제 수수료: 공수 × {rateText.dailyWorkerFeePerManDay}원
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowLaborGroupBasis((prev) => !prev)}
                            className={`text-[13px] px-3 py-1.5 rounded-md border font-semibold transition-colors ${
                                showLaborGroupBasis
                                    ? 'bg-slate-700 text-white border-slate-700'
                                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                            }`}
                        >
                            {showLaborGroupBasis ? '기준그룹 숨기기' : '기준그룹 보기'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 min-h-0 overflow-auto bg-white">
                <table className="w-full border-collapse text-[13px] leading-tight" style={{ minWidth: `${tableMinWidth}px` }}>
                    <thead className="sticky top-0 z-20">
                        <tr className="bg-slate-200 text-slate-800">
                            <th className="border border-slate-400 px-1.5 py-1 whitespace-nowrap w-10">No</th>
                            <th className="border border-slate-400 px-1.5 py-1 whitespace-nowrap w-20">이름</th>
                            <th className="border border-slate-400 px-1.5 py-1 whitespace-nowrap w-14">구분</th>
                            <th className="border border-slate-400 px-1.5 py-1.5 whitespace-nowrap w-[88px]">공제 분류</th>
                            <th className="border border-slate-400 px-1.5 py-1 whitespace-nowrap w-16 bg-sky-100">공수</th>
                            <th className="border border-slate-400 px-1.5 py-1 whitespace-nowrap w-[80px]">단가</th>
                            <th className="border border-slate-400 px-1.5 py-1 whitespace-nowrap w-[92px] bg-yellow-100">세전 금액</th>
                            {showUtilities && (
                                <>
                                        <th className="border border-slate-400 px-1 py-1.5 w-[98px]">
                                        <span className="block text-[13px]">숙소비</span>
                                            <span className="block text-[13px]">인터넷</span>
                                        </th>
                                        <th className="border border-slate-400 px-1 py-1.5 w-[98px]">
                                        <span className="block text-[13px]">전기료</span>
                                            <span className="block text-[13px]">관리비</span>
                                        </th>
                                        <th className="border border-slate-400 px-1 py-1.5 w-[98px]">
                                        <span className="block text-[13px]">가스비</span>
                                            <span className="block text-[13px]">과태료</span>
                                        </th>
                                        <th className="border border-slate-400 px-1 py-1.5 w-[98px]">
                                            <span className="block text-[13px]">수도세</span>
                                            <span className="block text-[13px]">기타</span>
                                        </th>
                                    <th className="border border-slate-400 px-2 py-1.5 whitespace-nowrap w-[92px] bg-slate-300">합계</th>
                                </>
                            )}
                            {showAdvances && (
                                <>
                                    <th className="border border-slate-400 px-1 py-1.5 w-[112px] bg-yellow-200">
                                        <span className="block text-[13px]">{resolvedAdvanceItemLabels.corporateAdvance1}</span>
                                        <span className="block text-[13px]">{resolvedAdvanceItemLabels.laborAdvance1}</span>
                                    </th>
                                    <th className="border border-slate-400 px-1 py-1.5 w-[112px] bg-yellow-200">
                                        <span className="block text-[13px]">{resolvedAdvanceItemLabels.corporateAdvance2}</span>
                                        <span className="block text-[13px]">{resolvedAdvanceItemLabels.laborAdvance2}</span>
                                    </th>
                                    <th className="border border-slate-400 px-1 py-1.5 w-[112px] bg-yellow-200">
                                        <span className="block text-[13px]">{resolvedAdvanceItemLabels.corporateAdvance3}</span>
                                        <span className="block text-[13px]">{resolvedAdvanceItemLabels.laborAdvance3}</span>
                                    </th>
                                    <th className="border border-slate-400 px-1 py-1.5 w-[112px] bg-yellow-200">
                                        <span className="block text-[13px]">{resolvedAdvanceItemLabels.corporateAdvance4}</span>
                                        <span className="block text-[13px]">{resolvedAdvanceItemLabels.laborAdvance4}</span>
                                    </th>
                                    <th className="border border-slate-400 px-2 py-1.5 whitespace-nowrap w-[98px] bg-emerald-200">가불 합계</th>
                                </>
                            )}
                            {showTaxes && (
                                <>
                                    <th className="border border-slate-400 px-2 py-1.5 whitespace-nowrap w-[104px] bg-yellow-100">국민연금/장기요양</th>
                                    <th className="border border-slate-400 px-2 py-1.5 whitespace-nowrap w-[104px] bg-yellow-100">건강보험/+고용보험</th>
                                    <th className="border border-slate-400 px-2 py-1.5 whitespace-nowrap w-[96px] bg-amber-100">갑근세/지방세</th>
                                    <th className="border border-slate-400 px-2 py-1.5 whitespace-nowrap w-[116px] bg-green-100">사업소득세/지방소득세</th>
                                    <th className="border border-slate-400 px-2 py-1.5 whitespace-nowrap w-[94px] bg-fuchsia-100">일급제 수수료</th>
                                    <th className="border border-slate-400 px-2 py-1.5 whitespace-nowrap w-[106px] bg-yellow-200">4대 보험 합계</th>
                                    <th className="border border-slate-400 px-2 py-1.5 whitespace-nowrap w-[92px] bg-green-200">3.3% 합계</th>
                                </>
                            )}
                            <th className="border border-slate-400 px-2 py-1.5 whitespace-nowrap w-[92px] bg-emerald-200">법 인</th>
                            <th className="border border-slate-400 px-2 py-1.5 whitespace-nowrap w-[92px] bg-lime-200">개 인</th>
                            <th className="border border-slate-400 px-2 py-1.5 whitespace-nowrap w-[140px] bg-lime-100">메모</th>
                        </tr>
                    </thead>
                    <tbody>
                        {groupedRows.length === 0 && (
                            <tr>
                                <td colSpan={totalColumnCount} className="border border-slate-300 px-3 py-8 text-center text-slate-500">
                                    조회된 월급제/일급제 데이터가 없습니다.
                                </td>
                            </tr>
                        )}
                        {groupedRows.map((group) => (
                            <React.Fragment key={group.teamName}>
                                <tr className="bg-slate-700 text-white">
                                    <td colSpan={totalColumnCount} className="border border-slate-600 px-3 py-1.5 text-xs font-bold">
                                        {group.teamName} · {group.rows.length}명
                                    </td>
                                </tr>
                                {group.rows.map((row, idx) => {
                                    const runningNo = computedRows.findIndex((r) => r.rowKey === row.rowKey) + 1;
                                    const laborGroupSummaries = getLaborGroupSummaries(row);
                                    const hasUnknownClient = laborGroupSummaries.some((summary) => summary.hasUnknownClient);
                                    const resolveCategoryLabel = (category: LaborGroupSummary['category']): string => {
                                        if (category === 'insurance') return '4대보험';
                                        if (category === 'withholding') return '갑근세/지방세';
                                        if (category === 'business') return '사업소득';
                                        return '세금 미적용';
                                    };
                                    return (
                                        <React.Fragment key={row.rowKey}>
                                            {/* 윗칸(법인) 행: 파란색 계열 배경 + 상단/좌/우 굵은 검정 테두리 */}
                                            <tr className="bg-blue-50/40 border-t-2 border-l-2 border-r-2 border-black">
                                                <td rowSpan={2} className="border border-slate-300 px-1 text-center font-semibold">{runningNo}</td>
                                                <td rowSpan={2} className="border border-slate-300 px-2 text-center font-semibold">{row.workerName}</td>
                                                <td rowSpan={2} className={`border border-slate-300 px-1 text-center font-semibold ${getSalaryModelLabelClassName(row.salaryModel)}`}>{row.salaryModel || '월급제'}</td>
                                                <td className="border border-slate-300 px-1.5 py-1 text-center bg-blue-50/20">
                                                    <label className="flex items-center justify-center gap-1.5 cursor-pointer h-full">
                                                        <input 
                                                            type="radio" 
                                                            name={`assign-${row.rowKey}`}
                                                            checked={(row.manual.assignmentType ?? row.assignmentType ?? 'corporate') === 'corporate'}
                                                            onChange={() => updateAssignmentType(row.rowKey, 'corporate')}
                                                            className="w-4 h-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                        />
                                                        <span className="text-[14px] font-bold text-blue-800 tracking-wide">법인</span>
                                                    </label>
                                                </td>
                                                <td className="border border-slate-300 px-2 text-right bg-lime-300 font-bold">{formatManDay(row.invoiceManDay)}</td>
                                                <td rowSpan={2} className="border border-slate-300 px-2 text-right font-mono">{formatAmount(row.unitPrice)}</td>
                                                <td className="border border-slate-300 px-2 text-right bg-yellow-200 font-bold">{formatAmount(row.invoiceGrossAmount)}</td>
                                                {showUtilities && (
                                                    <>
                                                        <td className="border border-slate-300 px-1 bg-blue-100">
                                                            <LedgerInputCell
                                                                value={row.manual.invoice.lodging}
                                                                onChange={(v) => updateSideField(row.rowKey, 'invoice', 'lodging', v)}
                                                                assignment={row.manual.itemAssignments?.lodging ?? row.manual.assignmentType ?? row.assignmentType ?? 'corporate'}
                                                                onAssignmentChange={(v) => updateItemAssignment(row.rowKey, 'lodging', v)}
                                                                placeholder="숙소"
                                                            />
                                                        </td>
                                                        <td className="border border-slate-300 px-1 bg-blue-100">
                                                            <LedgerInputCell
                                                                value={row.manual.invoice.electricity}
                                                                onChange={(v) => updateSideField(row.rowKey, 'invoice', 'electricity', v)}
                                                                assignment={row.manual.itemAssignments?.electricity ?? row.manual.assignmentType ?? row.assignmentType ?? 'corporate'}
                                                                onAssignmentChange={(v) => updateItemAssignment(row.rowKey, 'electricity', v)}
                                                                placeholder="전기"
                                                            />
                                                        </td>
                                                        <td className="border border-slate-300 px-1 bg-blue-100">
                                                            <LedgerInputCell
                                                                value={row.manual.invoice.gas}
                                                                onChange={(v) => updateSideField(row.rowKey, 'invoice', 'gas', v)}
                                                                assignment={row.manual.itemAssignments?.gas ?? row.manual.assignmentType ?? row.assignmentType ?? 'corporate'}
                                                                onAssignmentChange={(v) => updateItemAssignment(row.rowKey, 'gas', v)}
                                                                placeholder="가스"
                                                            />
                                                        </td>
                                                        <td className="border border-slate-300 px-1 bg-blue-100">
                                                            <LedgerInputCell
                                                                value={row.manual.invoice.water}
                                                                onChange={(v) => updateSideField(row.rowKey, 'invoice', 'water', v)}
                                                                assignment={row.manual.itemAssignments?.water ?? row.manual.assignmentType ?? row.assignmentType ?? 'corporate'}
                                                                onAssignmentChange={(v) => updateItemAssignment(row.rowKey, 'water', v)}
                                                                placeholder="수도"
                                                            />
                                                        </td>
                                                        <td className="border border-slate-300 px-2 text-right bg-slate-200 font-semibold">{formatAmount(row.invoiceDeductionTotal)}</td>
                                                    </>
                                                )}
                                                {showAdvances && (
                                                    <>
                                                        <td className="border border-slate-300 px-1 bg-blue-100">
                                                            <LedgerInputCell value={row.manual.invoice.carry} onChange={(v) => updateSideField(row.rowKey, 'invoice', 'carry', v)} />
                                                        </td>
                                                        <td className="border border-slate-300 px-1 bg-blue-100">
                                                            <LedgerInputCell value={row.manual.invoice.carrySecond} onChange={(v) => updateSideField(row.rowKey, 'invoice', 'carrySecond', v)} />
                                                        </td>
                                                        <td className="border border-slate-300 px-1 bg-blue-100">
                                                            <LedgerInputCell value={row.manual.invoice.currentAdvance} onChange={(v) => updateSideField(row.rowKey, 'invoice', 'currentAdvance', v)} />
                                                        </td>
                                                        <td className="border border-slate-300 px-1 bg-blue-100">
                                                            <LedgerInputCell value={row.manual.invoice.currentAdvanceSecond} onChange={(v) => updateSideField(row.rowKey, 'invoice', 'currentAdvanceSecond', v)} />
                                                        </td>
                                                        <td className="border border-slate-300 px-2 text-right bg-yellow-200 text-yellow-900 font-semibold">{formatAmount(row.invoiceAdvanceTotal)}</td>
                                                    </>
                                                )}
                                                {showTaxes && (
                                                    <>
                                                        <td className="border border-slate-300 px-2 text-right bg-yellow-100">{formatAmount(row.pension)}</td>
                                                        <td className="border border-slate-300 px-2 text-right bg-yellow-100">{formatAmount(row.health)}</td>
                                                        <td className="border border-slate-300 px-2 text-right bg-amber-100">{formatAmount(row.incomeTax)}</td>
                                                        <td className="border border-slate-300 px-2 text-right bg-green-100">{formatAmount(row.businessIncomeTax)}</td>
                                                        <td rowSpan={2} className="border border-slate-300 px-1 text-right bg-fuchsia-100 font-bold">
                                                            <div className="flex flex-col items-end gap-0.5">
                                                                <span>{formatAmount(row.dailyFee)}</span>
                                                                {row.dailyFee > 0 && (
                                                                    <button
                                                                        onClick={() => updateItemAssignment(row.rowKey, 'dailyFee',
                                                                            (row.manual.itemAssignments?.['dailyFee'] ?? 'labor') === 'corporate' ? 'labor' : 'corporate'
                                                                        )}
                                                                        className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                                                                            (row.manual.itemAssignments?.['dailyFee'] ?? 'labor') === 'corporate'
                                                                                ? 'bg-blue-200 text-blue-800'
                                                                                : 'bg-emerald-200 text-emerald-800'
                                                                        }`}
                                                                    >
                                                                        {(row.manual.itemAssignments?.['dailyFee'] ?? 'labor') === 'corporate' ? '법인' : '노무'}
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td rowSpan={2} className="border border-slate-300 px-2 text-right bg-yellow-200 font-bold">{formatAmount(row.insuranceTotal)}</td>
                                                        <td rowSpan={2} className="border border-slate-300 px-2 text-right bg-green-200 font-bold">{formatAmount(row.businessTotal)}</td>
                                                    </>
                                                )}
                                                <td rowSpan={2} className="border border-slate-300 px-2 text-right bg-emerald-200 font-bold align-top">{formatAmount(row.corporateNet)}</td>
                                                <td rowSpan={2} className="border border-slate-300 px-2 text-right bg-lime-200 font-bold align-top">{formatAmount(row.personalNet)}</td>
                                                <td rowSpan={2} className="border border-slate-300 px-2 bg-lime-100 align-top">
                                                    <input
                                                        type="text"
                                                        value={row.manual.personalMemo}
                                                        onChange={(e) => updatePersonalMemo(row.rowKey, e.target.value)}
                                                        placeholder="메모"
                                                        className="w-full border border-lime-300 rounded px-2 py-1.5 text-[13px] bg-white/90 text-slate-700 outline-none focus:border-lime-500"
                                                        maxLength={120}
                                                    />
                                                </td>
                                            </tr>
                                            {/* 아랫칸(노무) 행: 초록색 계열 배경 + 하단/좌/우 굵은 검정 테두리 */}
                                            <tr className="odd:bg-white even:bg-slate-50/60 border-b-2 border-l-2 border-r-2 border-black">
                                                <td className="border border-slate-300 px-1.5 py-1 text-center bg-emerald-50/20">
                                                    <label className="flex items-center justify-center gap-1.5 cursor-pointer h-full">
                                                        <input 
                                                            type="radio" 
                                                            name={`assign-${row.rowKey}`}
                                                            checked={(row.manual.assignmentType ?? row.assignmentType ?? 'corporate') === 'labor'}
                                                            onChange={() => updateAssignmentType(row.rowKey, 'labor')}
                                                            className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                                        />
                                                        <span className="text-[14px] font-bold text-emerald-800 tracking-wide">노무</span>
                                                    </label>
                                                </td>
                                                <td className="border border-slate-300 px-2 text-right bg-yellow-300 font-bold">{formatManDay(row.laborManDay)}</td>
                                                <td className="border border-slate-300 px-2 text-right bg-yellow-100 font-bold">{formatAmount(row.laborGrossAmount)}</td>
                                                {showUtilities && (
                                                    <>
                                                        <td className="border border-slate-300 px-1 bg-emerald-100">
                                                            <LedgerInputCell
                                                                value={row.manual.labor.internet}
                                                                onChange={(v) => updateSideField(row.rowKey, 'labor', 'internet', v)}
                                                                assignment={row.manual.itemAssignments?.internet ?? row.manual.assignmentType ?? row.assignmentType ?? 'corporate'}
                                                                onAssignmentChange={(v) => updateItemAssignment(row.rowKey, 'internet', v)}
                                                                placeholder="인터넷"
                                                            />
                                                        </td>
                                                        <td className="border border-slate-300 px-1 bg-emerald-100">
                                                            <LedgerInputCell
                                                                value={row.manual.labor.management}
                                                                onChange={(v) => updateSideField(row.rowKey, 'labor', 'management', v)}
                                                                assignment={row.manual.itemAssignments?.management ?? row.manual.assignmentType ?? row.assignmentType ?? 'corporate'}
                                                                onAssignmentChange={(v) => updateItemAssignment(row.rowKey, 'management', v)}
                                                                placeholder="관리비"
                                                            />
                                                        </td>
                                                        <td className="border border-slate-300 px-1 bg-emerald-100">
                                                            <LedgerInputCell
                                                                value={row.manual.labor.fine}
                                                                onChange={(v) => updateSideField(row.rowKey, 'labor', 'fine', v)}
                                                                assignment={row.manual.itemAssignments?.fine ?? row.manual.assignmentType ?? row.assignmentType ?? 'corporate'}
                                                                onAssignmentChange={(v) => updateItemAssignment(row.rowKey, 'fine', v)}
                                                                placeholder="과태료"
                                                            />
                                                        </td>
                                                        <td className="border border-slate-300 px-1 bg-emerald-100">
                                                            <LedgerInputCell
                                                                value={row.manual.labor.other}
                                                                onChange={(v) => updateSideField(row.rowKey, 'labor', 'other', v)}
                                                                assignment={row.manual.itemAssignments?.other ?? row.manual.assignmentType ?? row.assignmentType ?? 'corporate'}
                                                                onAssignmentChange={(v) => updateItemAssignment(row.rowKey, 'other', v)}
                                                                placeholder="기타"
                                                            />
                                                        </td>
                                                        <td className="border border-slate-300 px-2 text-right bg-slate-200 font-semibold">{formatAmount(row.laborDeductionTotal)}</td>
                                                    </>
                                                )}
                                                {showAdvances && (
                                                    <>
                                                        <td className="border border-slate-300 px-1 bg-emerald-100">
                                                            <LedgerInputCell value={row.manual.labor.carry} onChange={(v) => updateSideField(row.rowKey, 'labor', 'carry', v)} />
                                                        </td>
                                                        <td className="border border-slate-300 px-1 bg-emerald-100">
                                                            <LedgerInputCell value={row.manual.labor.carrySecond} onChange={(v) => updateSideField(row.rowKey, 'labor', 'carrySecond', v)} />
                                                        </td>
                                                        <td className="border border-slate-300 px-1 bg-emerald-100">
                                                            <LedgerInputCell value={row.manual.labor.currentAdvance} onChange={(v) => updateSideField(row.rowKey, 'labor', 'currentAdvance', v)} />
                                                        </td>
                                                        <td className="border border-slate-300 px-1 bg-emerald-100">
                                                            <LedgerInputCell value={row.manual.labor.currentAdvanceSecond} onChange={(v) => updateSideField(row.rowKey, 'labor', 'currentAdvanceSecond', v)} />
                                                        </td>
                                                        <td className="border border-slate-300 px-2 text-right bg-yellow-200 font-semibold">{formatAmount(row.laborAdvanceTotal)}</td>
                                                    </>
                                                )}
                                                {showTaxes && (
                                                    <>
                                                        <td className="border border-slate-300 px-2 text-right bg-yellow-100">{formatAmount(row.care)}</td>
                                                        <td className="border border-slate-300 px-2 text-right bg-yellow-100">{formatAmount(row.employment)}</td>
                                                        <td className="border border-slate-300 px-2 text-right bg-amber-100">{formatAmount(row.residentTax)}</td>
                                                        <td className="border border-slate-300 px-2 text-right bg-green-100">{formatAmount(row.businessResidentTax)}</td>
                                                    </>
                                                )}
                                            </tr>
                                            {showLaborGroupBasis && (
                                                <tr className="bg-slate-50">
                                                    <td colSpan={totalColumnCount} className="border border-slate-300 px-2 py-1.5 text-[13px] text-slate-700">
                                                        {laborGroupSummaries.length > 0
                                                            ? `기준그룹(노무현장+발주사): ${laborGroupSummaries
                                                                .map((summary) => `${summary.siteName}/${summary.clientLabel} · ${formatManDay(summary.manDay)}공수 · ${resolveCategoryLabel(summary.category)}`)
                                                                .join(' | ')}`
                                                            : '기준그룹(노무현장+발주사) 정보가 없습니다.'}
                                                        {hasUnknownClient ? ' [발주사 미지정 데이터 포함: 그룹 기준 확인 필요]' : ''}
                                                    </td>
                                                </tr>
                                            )}
                                            {idx === group.rows.length - 1 && (
                                                <tr className="bg-slate-100">
                                                    <td colSpan={totalColumnCount} className="border border-slate-300 px-2 py-0.5 text-[10px] text-slate-600">
                                                        {row.isWithholdingTarget
                                                            ? '노무 공수(7공수 미만/8공수 이상 포함) 기준으로 갑근세/지방세가 적용되었습니다.'
                                                            : '노무 공수 또는 단가 기준 미충족으로 갑근세/지방세가 미적용입니다.'}
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </React.Fragment>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="bg-blue-100 font-bold text-slate-900">
                            <td colSpan={4} className="border border-slate-400 px-2 py-2 text-center text-base">합 계</td>
                            <td className="border border-slate-400 px-2 py-2 text-right">
                                <div className="text-sky-700">{totals.invoiceManDay.toFixed(1)}</div>
                                <div className="text-amber-700">{totals.laborManDay.toFixed(1)}</div>
                            </td>
                            <td className="border border-slate-400 px-2 py-2 text-right font-mono">
                                {totals.workerCount > 0
                                    ? formatAmount(Math.round((totals.invoiceGrossAmount + totals.laborGrossAmount) / Math.max(1, totals.invoiceManDay + totals.laborManDay)))
                                    : '-'}
                            </td>
                            <td className="border border-slate-400 px-2 py-2 text-right text-red-600">{formatAmount(totals.invoiceGrossAmount + totals.laborGrossAmount)}</td>
                            {showUtilities && (
                                <>
                                    <td className="border border-slate-400 px-2 py-2 text-right">
                                        <div>{formatAmount(totals.invoiceDeductionTotal)}</div>
                                        <div className="text-slate-500">{formatAmount(totals.laborDeductionTotal)}</div>
                                    </td>
                                    <td className="border border-slate-400 px-2 py-2 text-right">-</td>
                                    <td className="border border-slate-400 px-2 py-2 text-right">-</td>
                                    <td className="border border-slate-400 px-2 py-2 text-right">-</td>
                                    <td className="border border-slate-400 px-2 py-2 text-right">
                                        <div>{formatAmount(totals.invoiceDeductionTotal + totals.laborDeductionTotal)}</div>
                                    </td>
                                </>
                            )}
                            {showAdvances && (
                                <>
                                    <td className="border border-slate-400 px-2 py-2 text-right bg-yellow-50">
                                        <div className="text-cyan-700">{formatAmount(totals.invoiceAdvanceCarry)}</div>
                                        <div className="text-lime-700">{formatAmount(totals.laborAdvanceCarry)}</div>
                                    </td>
                                    <td className="border border-slate-400 px-2 py-2 text-right bg-yellow-50">
                                        <div className="text-cyan-700">{formatAmount(totals.invoiceAdvanceCarrySecond)}</div>
                                        <div className="text-lime-700">{formatAmount(totals.laborAdvanceCarrySecond)}</div>
                                    </td>
                                    <td className="border border-slate-400 px-2 py-2 text-right bg-yellow-50">
                                        <div className="text-cyan-700">{formatAmount(totals.invoiceAdvanceCurrent)}</div>
                                        <div className="text-lime-700">{formatAmount(totals.laborAdvanceCurrent)}</div>
                                    </td>
                                    <td className="border border-slate-400 px-2 py-2 text-right bg-yellow-50">
                                        <div className="text-cyan-700">{formatAmount(totals.invoiceAdvanceCurrentSecond)}</div>
                                        <div className="text-lime-700">{formatAmount(totals.laborAdvanceCurrentSecond)}</div>
                                    </td>
                                    <td className="border border-slate-400 px-2 py-2 text-right bg-yellow-100 font-semibold">
                                        <div className="text-cyan-800">{formatAmount(totals.invoiceAdvanceTotal)}</div>
                                        <div className="text-lime-800">{formatAmount(totals.laborAdvanceTotal)}</div>
                                    </td>
                                </>
                            )}
                            {showTaxes && (
                                <>
                                    <td className="border border-slate-400 px-2 py-2 text-right">
                                        <div>{formatAmount(totals.pension)}</div>
                                        <div className="text-slate-500">{formatAmount(totals.care)}</div>
                                    </td>
                                    <td className="border border-slate-400 px-2 py-2 text-right">
                                        <div>{formatAmount(totals.health)}</div>
                                        <div className="text-slate-500">{formatAmount(totals.employment)}</div>
                                    </td>
                                    <td className="border border-slate-400 px-2 py-2 text-right">
                                        <div>{formatAmount(totals.incomeTax)}</div>
                                        <div className="text-slate-500">{formatAmount(totals.residentTax)}</div>
                                    </td>
                                    <td className="border border-slate-400 px-2 py-2 text-right">
                                        <div>{formatAmount(totals.businessIncomeTax)}</div>
                                        <div className="text-slate-500">{formatAmount(totals.businessResidentTax)}</div>
                                    </td>
                                    <td className="border border-slate-400 px-2 py-2 text-right bg-fuchsia-50">{formatAmount(totals.dailyFee)}</td>
                                    <td className="border border-slate-400 px-2 py-2 text-right">{formatAmount(totals.insuranceTotal)}</td>
                                    <td className="border border-slate-400 px-2 py-2 text-right text-red-600">{formatAmount(totals.businessTotal)}</td>
                                </>
                            )}
                            <td className="border border-slate-400 px-2 py-2 text-right text-emerald-700">{formatAmount(totals.corporateNet)}</td>
                            <td className="border border-slate-400 px-2 py-2 text-right text-lime-700">{formatAmount(totals.personalNet)}</td>
                            <td className="border border-slate-400 px-2 py-2 text-center text-slate-500">-</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
});

export default React.memo(MonthlyAdvanceLedger, (prevProps: Props, nextProps: Props) => {
    if (prevProps.rows.length !== nextProps.rows.length) return false;
    for (let i = 0; i < prevProps.rows.length; i++) {
        const prevRow = prevProps.rows[i];
        const nextRow = nextProps.rows[i];
        if (prevRow.rowKey !== nextRow.rowKey) return false;
        if ((prevRow.statementTaxAmounts?.dailyFee ?? 0) !== (nextRow.statementTaxAmounts?.dailyFee ?? 0)) return false;
    }
    for (const key in prevProps) {
        if (key === 'rows') continue;
        if (prevProps[key as keyof Props] !== nextProps[key as keyof Props]) return false;
    }
    return true;
});
