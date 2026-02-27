import React, { useCallback, useEffect, useMemo, useState } from 'react';

type LedgerSide = 'invoice' | 'labor';
type LedgerSideNumberField =
    | 'carry'
    | 'carrySecond'
    | 'currentAdvance'
    | 'currentAdvanceSecond'
    | 'lodging'
    | 'electricity'
    | 'gas'
    | 'water';

interface LedgerSideInput {
    carry: number;
    carrySecond: number;
    currentAdvance: number;
    currentAdvanceSecond: number;
    lodging: number;
    electricity: number;
    gas: number;
    water: number;
}

interface LedgerManualInput {
    invoice: LedgerSideInput;
    labor: LedgerSideInput;
    personalMemo: string;
}

interface PayrollConfigLike {
    insuranceConfig?: {
        thresholdDays?: number;
        pensionRate?: number;
        healthRate?: number;
        careRateOfHealth?: number;
        employmentRate?: number;
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
    insuranceTotal: number;
    businessTotal: number;
    corporateNet: number;
    personalNet: number;
    isWithholdingTarget: boolean;
}

interface Props {
    rows: MonthlyAdvanceLedgerRow[];
    payrollConfig?: PayrollConfigLike | null;
    withholdingThreshold?: number;
    applyInsurance?: boolean;
    applyBusinessIncome?: boolean;
    clientCompanyNameById?: Record<string, string>;
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
});

const createEmptyManualInput = (): LedgerManualInput => ({
    invoice: createEmptySideInput(),
    labor: createEmptySideInput(),
    personalMemo: '',
});

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
    className?: string;
}> = ({ value, onChange, className = '' }) => (
    <input
        type="number"
        min={0}
        step={1000}
        value={value === 0 ? '' : String(value)}
        onChange={(e) => onChange(toSafeAmount(e.target.value))}
        className={`w-full bg-transparent text-right text-[11px] font-mono outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${className}`}
        placeholder="-"
    />
);

const sumSideDeductions = (side: LedgerSideInput): number =>
    side.lodging + side.electricity + side.gas + side.water;

const sumSideAdvances = (side: LedgerSideInput): number =>
    side.carry + side.carrySecond + side.currentAdvance + side.currentAdvanceSecond;

const MonthlyAdvanceLedger: React.FC<Props> = ({
    rows,
    payrollConfig,
    withholdingThreshold = 7,
    applyInsurance = false,
    applyBusinessIncome = false,
    clientCompanyNameById = {},
}) => {
    const [inputsByRowKey, setInputsByRowKey] = useState<Record<string, LedgerManualInput>>({});
    const [showLaborGroupBasis, setShowLaborGroupBasis] = useState<boolean>(false);

    useEffect(() => {
        setInputsByRowKey((prev) => {
            const next: Record<string, LedgerManualInput> = {};
            rows.forEach((row) => {
                const existing = prev[row.rowKey];
                if (!existing) {
                    next[row.rowKey] = createEmptyManualInput();
                    return;
                }
                next[row.rowKey] = {
                    invoice: { ...createEmptySideInput(), ...existing.invoice },
                    labor: { ...createEmptySideInput(), ...existing.labor },
                    personalMemo: existing.personalMemo ?? '',
                };
            });
            return next;
        });
    }, [rows]);

    const updateSideField = useCallback(
        (rowKey: string, side: LedgerSide, field: LedgerSideNumberField, value: number) => {
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

    const getLaborGroupSummaries = useCallback(
        (row: MonthlyAdvanceLedgerRow): LaborGroupSummary[] => {
            const toNumber = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);
            const normalizeText = (value: unknown): string => String(value ?? '').trim().toLowerCase();
            const insuranceThreshold = Math.max(0, Math.floor(toNumber(payrollConfig?.insuranceConfig?.thresholdDays)));
            const withholdingApplyAllLabor =
                typeof payrollConfig?.insuranceConfig?.withholdingApplyAllLabor === 'boolean'
                    ? payrollConfig.insuranceConfig.withholdingApplyAllLabor
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
            });

            const insuranceGroupKeys = new Set<string>();
            if (applyInsurance && insuranceThreshold > 0) {
                laborGroupAgg.forEach((agg, groupKey) => {
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
            typeof payrollConfig?.insuranceConfig?.withholdingApplyAllLabor === 'boolean'
                ? payrollConfig.insuranceConfig.withholdingApplyAllLabor
                : true;
        const employmentApplyBelowThreshold =
            typeof payrollConfig?.insuranceConfig?.employmentApplyBelowThreshold === 'boolean'
                ? payrollConfig.insuranceConfig.employmentApplyBelowThreshold
                : true;
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
                let isWithholdingTarget = false;

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
                    });

                    const insuranceGroupKeys = new Set<string>();
                    if (applyInsurance && insuranceThreshold > 0) {
                        laborGroupAgg.forEach((agg, groupKey) => {
                            if (agg.manDay >= insuranceThreshold) {
                                insuranceGroupKeys.add(groupKey);
                            }
                        });
                    }

                    const insuranceBaseAmount = applyInsurance
                        ? Array.from(laborGroupAgg.entries()).reduce(
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
                }
                const insuranceTotal = pension + health + care + employment;
                const businessTotal = businessIncomeTax + businessResidentTax;
                const corporateBaseBeforeUtility = floorWon(invoiceGrossAmount - invoiceAdvanceTotal - businessTotal);
                const utilityAppliedToCorporate = Math.min(Math.max(0, corporateBaseBeforeUtility), utilityTotal);
                const utilityShiftedToPersonal = Math.max(0, utilityTotal - utilityAppliedToCorporate);
                const personalBaseBeforeUtility = floorWon(laborGrossAmount - laborAdvanceTotal - insuranceTotal - incomeTax - residentTax);

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
    }, [applyBusinessIncome, applyInsurance, inputsByRowKey, payrollConfig, rows, withholdingThreshold]);

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
                insuranceTotal: 0,
                businessTotal: 0,
                corporateNet: 0,
                personalNet: 0,
            }
        );
    }, [computedRows]);

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
        return { pensionRate, healthRate, careRate, employmentRate, incomeRate, residentRate, withholdingBaseDeduction, withholdingTaxCreditRate };
    }, [payrollConfig]);

    return (
        <div className="flex-1 min-h-0 bg-white rounded-2xl border border-slate-300 shadow-sm flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-gradient-to-r from-slate-100 to-blue-50">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                    <div>
                        <h3 className="text-base font-bold text-slate-800">팀별 가불대장</h3>
                        <p className="text-xs text-slate-600 mt-0.5">
                            팀 소속 작업자의 계산서/노무 공수 분리, 공제 직접 입력, 법인/개인 가불 공제, 세금 계산을 한 화면에서 처리합니다.
                        </p>
                        <p className="text-[11px] text-slate-500 mt-1">
                            적용 상태: 4대보험 {applyInsurance ? '적용' : '미적용'} / 사업소득 {applyBusinessIncome ? '적용' : '미적용'}
                        </p>
                    </div>
                    <div className="flex flex-col items-start lg:items-end gap-2">
                        <div className="text-[11px] text-slate-600 bg-white border border-slate-200 rounded-lg px-3 py-2 font-medium">
                            4대보험: 국민연금 {rateText.pensionRate}% / 건강보험 {rateText.healthRate}% / 장기요양(건강보험) {rateText.careRate}% / 고용보험 {rateText.employmentRate}%<br />
                            원천세: ((단가 - {rateText.withholdingBaseDeduction}원) × 노무공수 × 갑근세 {rateText.incomeRate}%) × (1 - 세액공제율 {rateText.withholdingTaxCreditRate}%) / 지방세(소득세의 {rateText.residentRate}%) | 사업소득: 3.0% + 0.3%
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowLaborGroupBasis((prev) => !prev)}
                            className={`text-[11px] px-3 py-1.5 rounded-md border font-semibold transition-colors ${
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
                <table className="w-full min-w-[2400px] border-collapse text-[11px] leading-tight">
                    <thead className="sticky top-0 z-20">
                        <tr className="bg-slate-200 text-slate-800">
                            <th className="border border-slate-400 px-2 py-1.5 w-10">No</th>
                            <th className="border border-slate-400 px-2 py-1.5 w-20">이름</th>
                            <th className="border border-slate-400 px-2 py-1.5 w-14">구분</th>
                            <th className="border border-slate-400 px-2 py-1.5 w-14">분류</th>
                            <th className="border border-slate-400 px-2 py-1.5 w-16 bg-sky-100">공수</th>
                            <th className="border border-slate-400 px-2 py-1.5 w-[72px]">단가</th>
                            <th className="border border-slate-400 px-2 py-1.5 w-[84px] bg-yellow-100">세전 금액</th>
                            <th className="border border-slate-400 px-2 py-1.5 w-[68px]">숙소비<br />인터넷</th>
                            <th className="border border-slate-400 px-2 py-1.5 w-[68px]">전기세<br />관리비</th>
                            <th className="border border-slate-400 px-2 py-1.5 w-[68px]">도시가스<br />과태료</th>
                            <th className="border border-slate-400 px-2 py-1.5 w-[68px]">수도세<br />기타</th>
                            <th className="border border-slate-400 px-2 py-1.5 w-[72px] bg-slate-300">합계</th>
                            <th className="border border-slate-400 px-2 py-1.5 w-[74px] bg-yellow-200">
                                <span className="block">전달 법인가불</span>
                                <span className="block text-[10px] text-slate-700">전달 노무가불</span>
                            </th>
                            <th className="border border-slate-400 px-2 py-1.5 w-[74px] bg-yellow-200">
                                <span className="block">전달 법인가불</span>
                                <span className="block text-[10px] text-slate-700">전달 노무가불</span>
                            </th>
                            <th className="border border-slate-400 px-2 py-1.5 w-[74px] bg-yellow-200">
                                <span className="block">당월 법인가불</span>
                                <span className="block text-[10px] text-slate-700">당월 노무가불</span>
                            </th>
                            <th className="border border-slate-400 px-2 py-1.5 w-[74px] bg-yellow-200">
                                <span className="block">당월 법인가불</span>
                                <span className="block text-[10px] text-slate-700">당월 노무가불</span>
                            </th>
                            <th className="border border-slate-400 px-2 py-1.5 w-[76px] bg-emerald-200">가불 합계</th>
                            <th className="border border-slate-400 px-2 py-1.5 w-[72px] bg-yellow-100">국민연금<br />장기요양</th>
                            <th className="border border-slate-400 px-2 py-1.5 w-[72px] bg-yellow-100">건강보험<br />+고용보험</th>
                            <th className="border border-slate-400 px-2 py-1.5 w-[72px] bg-amber-100">갑근세<br />지방세</th>
                            <th className="border border-slate-400 px-2 py-1.5 w-[72px] bg-green-100">사업소득세<br />지방소득세</th>
                            <th className="border border-slate-400 px-2 py-1.5 w-[74px] bg-yellow-200">4대 보험 합계</th>
                            <th className="border border-slate-400 px-2 py-1.5 w-[72px] bg-green-200">3.3% 합계</th>
                            <th className="border border-slate-400 px-2 py-1.5 w-[86px] bg-emerald-200">법 인</th>
                            <th className="border border-slate-400 px-2 py-1.5 w-[86px] bg-lime-200">개 인</th>
                            <th className="border border-slate-400 px-2 py-1.5 w-[120px] bg-lime-100">메모</th>
                        </tr>
                    </thead>
                    <tbody>
                        {groupedRows.length === 0 && (
                            <tr>
                                <td colSpan={26} className="border border-slate-300 px-3 py-8 text-center text-slate-500">
                                    조회된 월급제/일급제 데이터가 없습니다.
                                </td>
                            </tr>
                        )}
                        {groupedRows.map((group) => (
                            <React.Fragment key={group.teamName}>
                                <tr className="bg-slate-700 text-white">
                                    <td colSpan={26} className="border border-slate-600 px-3 py-1.5 text-xs font-bold">
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
                                            <tr className="odd:bg-white even:bg-slate-50/60">
                                                <td rowSpan={2} className="border border-slate-300 px-1 text-center font-semibold">{runningNo}</td>
                                                <td rowSpan={2} className="border border-slate-300 px-2 text-center font-semibold">{row.workerName}</td>
                                                <td rowSpan={2} className={`border border-slate-300 px-1 text-center font-semibold ${getSalaryModelLabelClassName(row.salaryModel)}`}>{row.salaryModel || '월급제'}</td>
                                                <td className="border border-slate-300 px-1 text-center bg-orange-100 font-semibold">법인</td>
                                                <td className="border border-slate-300 px-2 text-right bg-lime-300 font-bold">{formatManDay(row.invoiceManDay)}</td>
                                                <td rowSpan={2} className="border border-slate-300 px-2 text-right font-mono">{formatAmount(row.unitPrice)}</td>
                                                <td className="border border-slate-300 px-2 text-right bg-yellow-200 font-bold">{formatAmount(row.invoiceGrossAmount)}</td>
                                                <td className="border border-slate-300 px-1 bg-slate-100">
                                                    <LedgerInputCell value={row.manual.invoice.lodging} onChange={(v) => updateSideField(row.rowKey, 'invoice', 'lodging', v)} />
                                                </td>
                                                <td className="border border-slate-300 px-1 bg-slate-100">
                                                    <LedgerInputCell value={row.manual.invoice.electricity} onChange={(v) => updateSideField(row.rowKey, 'invoice', 'electricity', v)} />
                                                </td>
                                                <td className="border border-slate-300 px-1 bg-slate-100">
                                                    <LedgerInputCell value={row.manual.invoice.gas} onChange={(v) => updateSideField(row.rowKey, 'invoice', 'gas', v)} />
                                                </td>
                                                <td className="border border-slate-300 px-1 bg-slate-100">
                                                    <LedgerInputCell value={row.manual.invoice.water} onChange={(v) => updateSideField(row.rowKey, 'invoice', 'water', v)} />
                                                </td>
                                                <td className="border border-slate-300 px-2 text-right bg-slate-200 font-semibold">{formatAmount(row.invoiceDeductionTotal)}</td>
                                                <td className="border border-slate-300 px-1 bg-yellow-50">
                                                    <LedgerInputCell value={row.manual.invoice.carry} onChange={(v) => updateSideField(row.rowKey, 'invoice', 'carry', v)} />
                                                </td>
                                                <td className="border border-slate-300 px-1 bg-yellow-50">
                                                    <LedgerInputCell value={row.manual.invoice.carrySecond} onChange={(v) => updateSideField(row.rowKey, 'invoice', 'carrySecond', v)} />
                                                </td>
                                                <td className="border border-slate-300 px-1 bg-yellow-50">
                                                    <LedgerInputCell value={row.manual.invoice.currentAdvance} onChange={(v) => updateSideField(row.rowKey, 'invoice', 'currentAdvance', v)} />
                                                </td>
                                                <td className="border border-slate-300 px-1 bg-yellow-50">
                                                    <LedgerInputCell value={row.manual.invoice.currentAdvanceSecond} onChange={(v) => updateSideField(row.rowKey, 'invoice', 'currentAdvanceSecond', v)} />
                                                </td>
                                                <td className="border border-slate-300 px-2 text-right bg-yellow-200 text-yellow-900 font-semibold">{formatAmount(row.invoiceAdvanceTotal)}</td>
                                                <td className="border border-slate-300 px-2 text-right bg-yellow-100">{formatAmount(row.pension)}</td>
                                                <td className="border border-slate-300 px-2 text-right bg-yellow-100">{formatAmount(row.health)}</td>
                                                <td className="border border-slate-300 px-2 text-right bg-amber-100">{formatAmount(row.incomeTax)}</td>
                                                <td className="border border-slate-300 px-2 text-right bg-green-100">{formatAmount(row.businessIncomeTax)}</td>
                                                <td rowSpan={2} className="border border-slate-300 px-2 text-right bg-yellow-200 font-bold">{formatAmount(row.insuranceTotal)}</td>
                                                <td rowSpan={2} className="border border-slate-300 px-2 text-right bg-green-200 font-bold">{formatAmount(row.businessTotal)}</td>
                                                <td rowSpan={2} className="border border-slate-300 px-2 text-right bg-emerald-200 font-bold align-top">{formatAmount(row.corporateNet)}</td>
                                                <td rowSpan={2} className="border border-slate-300 px-2 text-right bg-lime-200 font-bold align-top">{formatAmount(row.personalNet)}</td>
                                                <td rowSpan={2} className="border border-slate-300 px-2 bg-lime-100 align-top">
                                                    <input
                                                        type="text"
                                                        value={row.manual.personalMemo}
                                                        onChange={(e) => updatePersonalMemo(row.rowKey, e.target.value)}
                                                        placeholder="메모"
                                                        className="w-full border border-lime-300 rounded px-1.5 py-1 text-[10px] bg-white/90 text-slate-700 outline-none focus:border-lime-500"
                                                        maxLength={120}
                                                    />
                                                </td>
                                            </tr>
                                            <tr className="odd:bg-white even:bg-slate-50/60">
                                                <td className="border border-slate-300 px-1 text-center bg-orange-50 font-semibold">노무</td>
                                                <td className="border border-slate-300 px-2 text-right bg-yellow-300 font-bold">{formatManDay(row.laborManDay)}</td>
                                                <td className="border border-slate-300 px-2 text-right bg-yellow-100 font-bold">{formatAmount(row.laborGrossAmount)}</td>
                                                <td className="border border-slate-300 px-1 bg-slate-100">
                                                    <LedgerInputCell value={row.manual.labor.lodging} onChange={(v) => updateSideField(row.rowKey, 'labor', 'lodging', v)} />
                                                </td>
                                                <td className="border border-slate-300 px-1 bg-slate-100">
                                                    <LedgerInputCell value={row.manual.labor.electricity} onChange={(v) => updateSideField(row.rowKey, 'labor', 'electricity', v)} />
                                                </td>
                                                <td className="border border-slate-300 px-1 bg-slate-100">
                                                    <LedgerInputCell value={row.manual.labor.gas} onChange={(v) => updateSideField(row.rowKey, 'labor', 'gas', v)} />
                                                </td>
                                                <td className="border border-slate-300 px-1 bg-slate-100">
                                                    <LedgerInputCell value={row.manual.labor.water} onChange={(v) => updateSideField(row.rowKey, 'labor', 'water', v)} />
                                                </td>
                                                <td className="border border-slate-300 px-2 text-right bg-slate-200 font-semibold">{formatAmount(row.laborDeductionTotal)}</td>
                                                <td className="border border-slate-300 px-1 bg-yellow-50">
                                                    <LedgerInputCell value={row.manual.labor.carry} onChange={(v) => updateSideField(row.rowKey, 'labor', 'carry', v)} />
                                                </td>
                                                <td className="border border-slate-300 px-1 bg-yellow-50">
                                                    <LedgerInputCell value={row.manual.labor.carrySecond} onChange={(v) => updateSideField(row.rowKey, 'labor', 'carrySecond', v)} />
                                                </td>
                                                <td className="border border-slate-300 px-1 bg-yellow-50">
                                                    <LedgerInputCell value={row.manual.labor.currentAdvance} onChange={(v) => updateSideField(row.rowKey, 'labor', 'currentAdvance', v)} />
                                                </td>
                                                <td className="border border-slate-300 px-1 bg-yellow-50">
                                                    <LedgerInputCell value={row.manual.labor.currentAdvanceSecond} onChange={(v) => updateSideField(row.rowKey, 'labor', 'currentAdvanceSecond', v)} />
                                                </td>
                                                <td className="border border-slate-300 px-2 text-right bg-yellow-200 font-semibold">{formatAmount(row.laborAdvanceTotal)}</td>
                                                <td className="border border-slate-300 px-2 text-right bg-yellow-100">{formatAmount(row.care)}</td>
                                                <td className="border border-slate-300 px-2 text-right bg-yellow-100">{formatAmount(row.employment)}</td>
                                                <td className="border border-slate-300 px-2 text-right bg-amber-100">{formatAmount(row.residentTax)}</td>
                                                <td className="border border-slate-300 px-2 text-right bg-green-100">{formatAmount(row.businessResidentTax)}</td>
                                            </tr>
                                            {row.utilityShiftedToPersonal > 0 && (
                                                <tr className="bg-rose-50">
                                                    <td colSpan={26} className="border border-slate-300 px-2 py-0.5 text-[10px] text-rose-700">
                                                        공과금 {formatAmount(row.utilityTotal)}원 중 {formatAmount(row.utilityShiftedToPersonal)}원은 법인 잔액 부족으로 개인에서 차감되었습니다.
                                                    </td>
                                                </tr>
                                            )}
                                            {showLaborGroupBasis && (
                                                <tr className="bg-slate-50">
                                                    <td colSpan={26} className="border border-slate-300 px-2 py-1 text-[10px] text-slate-700">
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
                                                    <td colSpan={26} className="border border-slate-300 px-2 py-0.5 text-[10px] text-slate-600">
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
                            <td className="border border-slate-400 px-2 py-2 text-right">{formatAmount(totals.insuranceTotal)}</td>
                            <td className="border border-slate-400 px-2 py-2 text-right text-red-600">{formatAmount(totals.businessTotal)}</td>
                            <td className="border border-slate-400 px-2 py-2 text-right text-emerald-700">{formatAmount(totals.corporateNet)}</td>
                            <td className="border border-slate-400 px-2 py-2 text-right text-lime-700">{formatAmount(totals.personalNet)}</td>
                            <td className="border border-slate-400 px-2 py-2 text-center text-slate-500">-</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
};

export default MonthlyAdvanceLedger;
