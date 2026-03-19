import { 
    PaymentData, 
    DeductionBreakdown, 
    MonthlyAdvanceLedgerRow, 
    PayrollConfig, 
    WorkerWorkEntry,
    DeductionLine,
    InsuranceAppliedSummary,
    WithholdingAppliedSummary,
    BusinessIncomeAppliedSummary,
    InsuranceAppliedSiteSummary,
    InsuranceAppliedReason,
    WithholdingAppliedSiteSummary,
    BusinessIncomeAppliedSiteSummary,
    LedgerUtilityInputLike,
    LedgerUtilitySideInputLike,
    TaxRateSnapshot as GlobalTaxRateSnapshot
} from '../types/payroll';
import { 
    TEMP_INSURANCE_PREFIX, 
    TEMP_BUSINESS_PREFIX, 
    TEMP_TAX_PREFIX, 
    LEGACY_TAX_PREFIX,
    WITHHOLDING_MAX_MAN_DAY,
    APPLIED_UTILITY_FIELDS
} from '../constants/payroll.constants';

/**
 * 기초적인 숫자 변환 및 반올림 유틸리티
 */
export const toNumber = (value: unknown): number => 
    (typeof value === 'number' && Number.isFinite(value) ? value : 0);

export const floorWon = (value: number): number => 
    Math.floor(toNumber(value));

/**
 * 세금 및 보험료 계산 스냅샷 타입
 */
/**
 * 세금 및 보험료 계산 스냅샷 타입 (GlobalTaxRateSnapshot과 호환되도록 수정)
 */
export interface TaxRateSnapshot extends GlobalTaxRateSnapshot {
    pensionRate: number;
    healthRate: number;
    longtermRate: number;
    employmentRate: number;
    incomeTaxRate: number;
    residentTaxRate: number;
}

/**
 * 개별 작업 항목에 대한 세금 계산 결과 인터페이스
 */
export interface WorkEntryTaxCalculationResult {
    statementTaxAmounts: NonNullable<MonthlyAdvanceLedgerRow['statementTaxAmounts']>;
    taxAdditionalLines: DeductionLine[];
    taxRateSnapshot: TaxRateSnapshot;
    insuranceAppliedSummary?: InsuranceAppliedSummary;
    withholdingAppliedSummary?: WithholdingAppliedSummary;
    businessIncomeAppliedSummary?: BusinessIncomeAppliedSummary;
}

/**
 * 급여 관련 계산 기능을 모아둔 유틸리티
 */
export const PayrollUtils = {
    createEmptyDeductionBreakdown: (): DeductionBreakdown => ({
        standardLines: [],
        additionalLines: [],
        totalStandard: 0,
        totalAdditional: 0,
        total: 0,
        hasData: false,
    }),

    rebuildDeductionBreakdown: (params: { standardLines: DeductionLine[]; additionalLines: DeductionLine[] }): DeductionBreakdown => {
        const totalStandard = (params.standardLines ?? []).reduce((sum, line) => sum + toNumber(line?.amount), 0);
        const totalAdditional = (params.additionalLines ?? []).reduce((sum, line) => sum + toNumber(line?.amount), 0);
        const total = totalStandard + totalAdditional;
        return {
            standardLines: params.standardLines ?? [],
            additionalLines: params.additionalLines ?? [],
            totalStandard,
            totalAdditional,
            total,
            hasData: total > 0,
        };
    },

    stripTemporaryDeductionLines: (breakdown: DeductionBreakdown): DeductionBreakdown => {
        const safe = breakdown ?? PayrollUtils.createEmptyDeductionBreakdown();
        const standardLines = safe.standardLines ?? [];
        const additionalLines = (safe.additionalLines ?? []).filter((line) => {
            const label = (line?.label ?? '').trim();
            if (!label) return false;
            return !(label.startsWith(TEMP_INSURANCE_PREFIX) || label.startsWith(TEMP_BUSINESS_PREFIX) || label.startsWith(TEMP_TAX_PREFIX) || label.startsWith(LEGACY_TAX_PREFIX) || label.startsWith('[3.0%]') || label.startsWith('[0.3%]'));
        });
        return PayrollUtils.rebuildDeductionBreakdown({ standardLines, additionalLines });
    },

    formatRatePercent: (rate: number, maxFractionDigits: number = 3): string => {
        if (!Number.isFinite(rate)) return '-';
        const percent = rate * 100;
        const text = percent.toLocaleString('ko-KR', {
            minimumFractionDigits: 0,
            maximumFractionDigits: maxFractionDigits,
        });
        return `${text}%`;
    },

    /**
     * 작업 내역을 기반으로 보험 및 세금 계산 수행 (최종 로직 이식)
     */
    calculateWorkEntryTaxBreakdown: (params: {
        workEntries?: WorkerWorkEntry[];
        payrollConfig: PayrollConfig;
        applyInsurance: boolean;
        applyBusinessIncome: boolean;
        normalizeSiteName: (value: string | undefined) => string;
        withholdingThreshold: number;
    }): WorkEntryTaxCalculationResult => {
        const config = params.payrollConfig;
        const threshold = Math.max(0, Math.floor(toNumber(config?.thresholdDays)));
        const withholdingBaseDeduction = Math.max(0, Math.floor(toNumber(config?.withholdingBaseDeduction ?? 150000)));
        const withholdingTaxCreditRate = Math.min(1, Math.max(0, toNumber(config?.withholdingIncomeBaseMultiplier ?? 0.55)));
        const withholdingIncomeTaxRate = Math.max(
            0,
            toNumber(config?.withholdingIncomeTaxRate ?? config.incomeTaxRate ?? 0.06)
        );
        const withholdingResidentTaxRate = Math.max(
            0,
            toNumber(config?.withholdingResidentTaxRate ?? config.residentTaxRate ?? 0.1)
        );
        const withholdingApplyAllLabor =
            typeof config?.withholdingApplyAllLabor === 'boolean' ? config.withholdingApplyAllLabor : true;
        const employmentApplyBelowThreshold =
            typeof config?.employmentApplyBelowThreshold === 'boolean' ? config.employmentApplyBelowThreshold : true;

        const allEntries = (params.workEntries ?? []).filter((entry) => {
            if (!entry) return false;
            const hasManDay = toNumber(entry.manDay) > 0;
            const hasAmount = toNumber(entry.amount) > 0;
            return hasManDay || hasAmount;
        });

        const getSiteKey = (entry: WorkerWorkEntry): string => {
            const siteId = (entry.siteId ?? '').trim();
            if (siteId) return siteId;
            const normalized = params.normalizeSiteName(entry.siteName ?? '');
            if (normalized) return `unresolved-site:${normalized}`;
            return 'no-site';
        };

        const isLaborEntry = (entry: WorkerWorkEntry): boolean => {
            if (entry.isLaborSite) return true;
            return (entry.paymentMethod ?? '').trim() === '노무';
        };

        const getLaborGroupKey = (entry: WorkerWorkEntry): string => {
            const siteKey = getSiteKey(entry);
            const clientCompanyId = (entry.clientCompanyId ?? '').trim();
            const clientKey = clientCompanyId || '__no_client__';
            return `${siteKey}::${clientKey}`;
        };

        const laborGroupAgg = new Map<
            string,
            {
                siteId: string;
                siteName: string;
                clientCompanyId: string;
                manDay: number;
                amount: number;
            }
        >();
        const businessSiteAgg = new Map<string, { manDay: number; amount: number }>();
        const siteNameById = new Map<string, string>();

        allEntries.forEach((entry) => {
            const siteKey = getSiteKey(entry);
            if (!siteNameById.has(siteKey)) {
                siteNameById.set(siteKey, (entry.siteName ?? '').trim() || '-');
            }

            const amount = toNumber(entry.amount);
            const manDay = toNumber(entry.manDay);

            if (!isLaborEntry(entry)) return;
            const groupKey = getLaborGroupKey(entry);
            const clientCompanyId = (entry.clientCompanyId ?? '').trim();
            const prevGroup =
                laborGroupAgg.get(groupKey) ??
                {
                    siteId: siteKey,
                    siteName: siteNameById.get(siteKey) ?? '-',
                    clientCompanyId,
                    manDay: 0,
                    amount: 0,
                };
            laborGroupAgg.set(groupKey, {
                siteId: prevGroup.siteId || siteKey,
                siteName: prevGroup.siteName || siteNameById.get(siteKey) || '-',
                clientCompanyId: clientCompanyId || prevGroup.clientCompanyId,
                manDay: prevGroup.manDay + manDay,
                amount: prevGroup.amount + amount,
            });
        });

        const insuranceGroupKeys = new Set<string>();
        if (params.applyInsurance && threshold > 0) {
            laborGroupAgg.forEach((agg, groupKey) => {
                if (agg.manDay >= threshold) insuranceGroupKeys.add(groupKey);
            });
        }

        const insuranceBaseAmount = params.applyInsurance
            ? Array.from(laborGroupAgg.entries()).reduce((sum, [groupKey, agg]) => sum + (insuranceGroupKeys.has(groupKey) ? agg.amount : 0), 0)
            : 0;

        const withholdingGroupKeys = new Set<string>();
        if (params.applyInsurance) {
            laborGroupAgg.forEach((agg, groupKey) => {
                if (agg.manDay <= 0) return;
                if (withholdingApplyAllLabor) {
                    withholdingGroupKeys.add(groupKey);
                    return;
                }
                if (insuranceGroupKeys.has(groupKey)) return;
                if (agg.manDay > 0 && agg.manDay <= params.withholdingThreshold) {
                    withholdingGroupKeys.add(groupKey);
                }
            });
        }

        const withholdingBaseAmount = params.applyInsurance
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

        const employmentBaseAmount = params.applyInsurance
            ? Array.from(laborGroupAgg.entries()).reduce((sum, [groupKey, agg]) => {
                if (insuranceGroupKeys.has(groupKey)) return sum + agg.amount;
                if (withholdingGroupKeys.has(groupKey)) return sum + agg.amount;
                if (employmentApplyBelowThreshold) return sum + agg.amount;
                return sum;
            }, 0)
            : 0;

        const businessBaseAmount = params.applyBusinessIncome
            ? allEntries.reduce((sum, entry) => {
                const amount = toNumber(entry.amount);
                if (amount <= 0) return sum;
                if (isLaborEntry(entry)) {
                    const groupKey = getLaborGroupKey(entry);
                    if (insuranceGroupKeys.has(groupKey)) return sum;
                    if (withholdingGroupKeys.has(groupKey)) return sum;
                }
                const siteKey = getSiteKey(entry);
                const prev = businessSiteAgg.get(siteKey) ?? { manDay: 0, amount: 0 };
                businessSiteAgg.set(siteKey, {
                    manDay: prev.manDay + toNumber(entry.manDay),
                    amount: prev.amount + amount,
                });
                return sum + amount;
            }, 0)
            : 0;

        const taxAdditionalLines: DeductionLine[] = [];

        const pension = params.applyInsurance ? floorWon(insuranceBaseAmount * toNumber(config?.pensionRate)) : 0;
        const health = params.applyInsurance ? floorWon(insuranceBaseAmount * toNumber(config?.healthRate)) : 0;
        const care = params.applyInsurance ? floorWon(health * toNumber(config?.longtermRate)) : 0;
        const employment = params.applyInsurance ? floorWon(employmentBaseAmount * toNumber(config?.employmentRate)) : 0;

        if (pension > 0) taxAdditionalLines.push({ label: `${TEMP_INSURANCE_PREFIX} 국민연금`, amount: pension });
        if (health > 0) taxAdditionalLines.push({ label: `${TEMP_INSURANCE_PREFIX} 건강보험`, amount: health });
        if (care > 0) taxAdditionalLines.push({ label: `${TEMP_INSURANCE_PREFIX} 장기요양`, amount: care });
        if (employment > 0) taxAdditionalLines.push({ label: `${TEMP_INSURANCE_PREFIX} 고용보험`, amount: employment });

        const isWithholdingTarget = params.applyInsurance && withholdingBaseAmount > 0;
        const withholdingTaxBeforeCredit = isWithholdingTarget ? floorWon(withholdingBaseAmount * withholdingIncomeTaxRate) : 0;
        const incomeTax = isWithholdingTarget ? floorWon(withholdingTaxBeforeCredit * (1 - withholdingTaxCreditRate)) : 0;
        const residentTax = isWithholdingTarget ? floorWon(incomeTax * withholdingResidentTaxRate) : 0;
        if (incomeTax > 0) taxAdditionalLines.push({ label: `${TEMP_TAX_PREFIX} 갑근세`, amount: incomeTax });
        if (residentTax > 0) taxAdditionalLines.push({ label: `${TEMP_TAX_PREFIX} 지방세`, amount: residentTax });

        const businessIncomeTax = params.applyBusinessIncome ? floorWon(businessBaseAmount * 0.03) : 0;
        const businessResidentTax = params.applyBusinessIncome ? floorWon(businessIncomeTax * 0.1) : 0;
        if (businessIncomeTax > 0) taxAdditionalLines.push({ label: '[3.0%] 사업소득세', amount: businessIncomeTax });
        if (businessResidentTax > 0) taxAdditionalLines.push({ label: '[0.3%] 소득세', amount: businessResidentTax });

        let insuranceAppliedSummary: InsuranceAppliedSummary | undefined;
        let withholdingAppliedSummary: WithholdingAppliedSummary | undefined;
        let businessIncomeAppliedSummary: BusinessIncomeAppliedSummary | undefined;

        if (params.applyInsurance && insuranceBaseAmount > 0) {
            const appliedSites: InsuranceAppliedSiteSummary[] = Array.from(insuranceGroupKeys)
                .map((groupKey) => {
                    const agg = laborGroupAgg.get(groupKey);
                    const siteId = agg?.siteId ?? groupKey.split('::')[0];
                    const reason: InsuranceAppliedReason = (agg?.clientCompanyId ?? '').trim() ? 'client' : 'site';
                    return {
                        siteId: siteId || 'no-site',
                        siteName: agg?.siteName ?? siteNameById.get(siteId) ?? '-',
                        clientCompanyId: (agg?.clientCompanyId ?? '').trim(),
                        manDay: toNumber(agg?.manDay),
                        amount: toNumber(agg?.amount),
                        reason,
                    };
                })
                .sort((a, b) => b.manDay - a.manDay);

            insuranceAppliedSummary = {
                thresholdManDay: threshold,
                appliedManDay: appliedSites.reduce((sum, s) => sum + toNumber(s.manDay), 0),
                appliedAmount: insuranceBaseAmount,
                appliedSites,
            };
        }

        if (params.applyInsurance && withholdingBaseAmount > 0) {
            const appliedSites: WithholdingAppliedSiteSummary[] = Array.from(withholdingGroupKeys)
                .map((groupKey): WithholdingAppliedSiteSummary => {
                    const agg = laborGroupAgg.get(groupKey);
                    const siteId = agg?.siteId ?? groupKey.split('::')[0];
                    return {
                        siteId: siteId || 'no-site',
                        siteName: agg?.siteName ?? siteNameById.get(siteId) ?? '-',
                        manDay: toNumber(agg?.manDay),
                        amount: toNumber(agg?.amount),
                        reason: withholdingApplyAllLabor ? '노무전체' : '노무7이하',
                    };
                })
                .sort((a, b) => b.manDay - a.manDay);

            withholdingAppliedSummary = {
                thresholdDays: config.thresholdDays,
                thresholdManDay: withholdingApplyAllLabor ? 0 : params.withholdingThreshold,
                appliedManDay: appliedSites.reduce((sum, s) => sum + toNumber(s.manDay), 0),
                appliedAmount: withholdingBaseAmount,
                grossAmount: appliedSites.reduce((sum, s) => sum + toNumber(s.amount), 0),
                appliedSites,
            };
        }

        if (params.applyBusinessIncome && businessBaseAmount > 0) {
            const appliedSites: BusinessIncomeAppliedSiteSummary[] = Array.from(businessSiteAgg.entries())
                .map(([siteId, agg]): BusinessIncomeAppliedSiteSummary => ({
                    siteId,
                    siteName: siteNameById.get(siteId) ?? '-',
                    manDay: toNumber(agg?.manDay),
                    amount: toNumber(agg?.amount),
                    reason: '4대보험_제외',
                }))
                .sort((a, b) => b.manDay - a.manDay);

            businessIncomeAppliedSummary = {
                appliedManDay: appliedSites.reduce((sum, s) => sum + toNumber(s.manDay), 0),
                appliedAmount: businessBaseAmount,
                rate: 0.03,
                appliedSites,
            };
        }

        return {
            statementTaxAmounts: {
                pension,
                health,
                care,
                employment,
                incomeTax,
                residentTax,
                businessIncomeTax,
                businessResidentTax,
                isWithholdingTarget,
            },
            taxAdditionalLines,
            taxRateSnapshot: {
                pensionRate: toNumber(config?.pensionRate),
                healthRate: toNumber(config?.healthRate),
                longtermRate: toNumber(config?.longtermRate),
                careRateOfHealth: toNumber(config?.longtermRate), // 하위 호환성 유지
                employmentRate: toNumber(config?.employmentRate),
                incomeTaxRate: withholdingIncomeTaxRate,
                residentTaxRate: withholdingResidentTaxRate,
                withholdingBaseDeduction,
                withholdingIncomeBaseMultiplier: withholdingTaxCreditRate,
                businessIncomeTaxRate: 0.03,
                businessResidentTaxRate: 0.003,
            },
            insuranceAppliedSummary,
            withholdingAppliedSummary,
            businessIncomeAppliedSummary,
        };
    }
};
