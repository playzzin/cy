import type { PayrollConfig } from '../../../services/payrollConfigService';
import type { MonthlyAdvanceLedgerRow, WorkerWorkEntry, DeductionLine, TaxRateSnapshot, InsuranceAppliedSummary, InsuranceAppliedSiteSummary, InsuranceAppliedReason, WithholdingAppliedSummary, WithholdingAppliedSiteSummary, BusinessIncomeAppliedSummary, BusinessIncomeAppliedSiteSummary } from '../types/payroll';

export const BUSINESS_INCOME_TAX_RATE = 0.03;
export const BUSINESS_RESIDENT_TAX_RATE = 0.003;
const TEMP_INSURANCE_PREFIX = '[4대보험]';
const TEMP_TAX_PREFIX = '[원천세]';
const floorWon = (value: number): number => Math.floor(toNumber(value));
const toNumber = (value: unknown): number => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const normalized = value.replace(/,/g, '').trim();
        if (!normalized) return 0;
        const parsed = Number(normalized);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
};

interface WorkEntryTaxCalculationResult {
    statementTaxAmounts: NonNullable<MonthlyAdvanceLedgerRow['statementTaxAmounts']>;
    taxAdditionalLines: DeductionLine[];
    taxRateSnapshot: TaxRateSnapshot;
    insuranceAppliedSummary?: InsuranceAppliedSummary;
    withholdingAppliedSummary?: WithholdingAppliedSummary;
    businessIncomeAppliedSummary?: BusinessIncomeAppliedSummary;
}

export const calculateWorkEntryTaxBreakdown = (params: {
    workEntries?: WorkerWorkEntry[];
    payrollConfig: Pick<PayrollConfig, 'insuranceConfig' | 'incomeTaxRate' | 'residentTaxRate'>;
    applyInsurance: boolean;
    applyBusinessIncome: boolean;
    normalizeSiteName: (value: string | undefined) => string;
    withholdingThreshold: number;
    isInsuranceEligibleEntry?: (entry: WorkerWorkEntry) => boolean;
}): WorkEntryTaxCalculationResult => {
    const insuranceConfig = params.payrollConfig.insuranceConfig;
    const threshold = Math.max(0, Math.floor(toNumber(insuranceConfig?.thresholdDays)));
    const withholdingBaseDeduction = Math.max(0, Math.floor(toNumber(insuranceConfig?.withholdingBaseDeduction ?? 150000)));
    const withholdingTaxCreditRate = Math.min(1, Math.max(0, toNumber(insuranceConfig?.withholdingIncomeBaseMultiplier ?? 0.55)));
    const withholdingIncomeTaxRate = Math.max(
        0,
        toNumber(insuranceConfig?.withholdingIncomeTaxRate ?? params.payrollConfig.incomeTaxRate ?? 0.06)
    );
    const withholdingResidentTaxRate = Math.max(
        0,
        toNumber(insuranceConfig?.withholdingResidentTaxRate ?? params.payrollConfig.residentTaxRate ?? 0.1)
    );
    const withholdingApplyAllLabor =
        typeof insuranceConfig?.withholdingApplyAllLabor === 'boolean' ? insuranceConfig.withholdingApplyAllLabor : true;
    const employmentApplyBelowThreshold =
        typeof insuranceConfig?.employmentApplyBelowThreshold === 'boolean' ? insuranceConfig.employmentApplyBelowThreshold : true;

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

    const isInsuranceEligibleEntry = params.isInsuranceEligibleEntry ?? (() => true);

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
    const insuranceEligibleGroupAgg = new Map<
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

        if (!isInsuranceEligibleEntry(entry)) return;

        const prevInsuranceGroup =
            insuranceEligibleGroupAgg.get(groupKey) ??
            {
                siteId: siteKey,
                siteName: siteNameById.get(siteKey) ?? '-',
                clientCompanyId,
                manDay: 0,
                amount: 0,
            };

        insuranceEligibleGroupAgg.set(groupKey, {
            siteId: prevInsuranceGroup.siteId || siteKey,
            siteName: prevInsuranceGroup.siteName || siteNameById.get(siteKey) || '-',
            clientCompanyId: clientCompanyId || prevInsuranceGroup.clientCompanyId,
            manDay: prevInsuranceGroup.manDay + manDay,
            amount: prevInsuranceGroup.amount + amount,
        });
    });

    const insuranceGroupKeys = new Set<string>();

    if (params.applyInsurance && threshold > 0) {
        insuranceEligibleGroupAgg.forEach((agg, groupKey) => {
            if (agg.manDay >= threshold) insuranceGroupKeys.add(groupKey);
        });
    }

    const insuranceBaseAmount = params.applyInsurance
        ? Array.from(insuranceEligibleGroupAgg.entries()).reduce((sum, [groupKey, agg]) => sum + (insuranceGroupKeys.has(groupKey) ? agg.amount : 0), 0)
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

    const pension = params.applyInsurance ? floorWon(insuranceBaseAmount * toNumber(insuranceConfig?.pensionRate)) : 0;
    const health = params.applyInsurance ? floorWon(insuranceBaseAmount * toNumber(insuranceConfig?.healthRate)) : 0;
    const care = params.applyInsurance ? floorWon(health * toNumber(insuranceConfig?.careRateOfHealth)) : 0;
    const employment = params.applyInsurance ? floorWon(employmentBaseAmount * toNumber(insuranceConfig?.employmentRate)) : 0;

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

    const businessIncomeTax = params.applyBusinessIncome ? floorWon(businessBaseAmount * BUSINESS_INCOME_TAX_RATE) : 0;
    const businessResidentTax = params.applyBusinessIncome ? floorWon(businessBaseAmount * BUSINESS_RESIDENT_TAX_RATE) : 0;
    if (businessIncomeTax > 0) taxAdditionalLines.push({ label: '[3.0%] 사업소득세', amount: businessIncomeTax });
    if (businessResidentTax > 0) taxAdditionalLines.push({ label: '[0.3%] 소득세', amount: businessResidentTax });

    let insuranceAppliedSummary: InsuranceAppliedSummary | undefined;
    let withholdingAppliedSummary: WithholdingAppliedSummary | undefined;
    let businessIncomeAppliedSummary: BusinessIncomeAppliedSummary | undefined;

    if (params.applyInsurance && insuranceBaseAmount > 0) {
        const appliedSites: InsuranceAppliedSiteSummary[] = Array.from(insuranceGroupKeys)
            .map((groupKey) => {
                const agg = insuranceEligibleGroupAgg.get(groupKey);
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

        const appliedManDay = appliedSites.reduce((sum, s) => sum + toNumber(s.manDay), 0);

        insuranceAppliedSummary = {
            thresholdManDay: threshold,
            appliedManDay,
            appliedAmount: insuranceBaseAmount,
            appliedSites,
        };
    }

    if (params.applyInsurance && withholdingBaseAmount > 0) {
        const appliedSites: WithholdingAppliedSiteSummary[] = Array.from(withholdingGroupKeys)
            .map((groupKey) => {
                const agg = laborGroupAgg.get(groupKey);
                const siteId = agg?.siteId ?? groupKey.split('::')[0];
                const reason: WithholdingAppliedSiteSummary['reason'] = withholdingApplyAllLabor ? '노무전체' : '노무7이하';
                return {
                    siteId: siteId || 'no-site',
                    siteName: agg?.siteName ?? siteNameById.get(siteId) ?? '-',
                    manDay: toNumber(agg?.manDay),
                    amount: toNumber(agg?.amount),
                    reason,
                };
            })
            .sort((a, b) => b.manDay - a.manDay);

        const appliedManDay = appliedSites.reduce((sum, s) => sum + toNumber(s.manDay), 0);
        const grossAmount = appliedSites.reduce((sum, s) => sum + toNumber(s.amount), 0);

        withholdingAppliedSummary = {
            thresholdDays: withholdingApplyAllLabor ? 0 : params.withholdingThreshold,
            thresholdManDay: withholdingApplyAllLabor ? 0 : params.withholdingThreshold,
            appliedManDay,
            appliedAmount: withholdingBaseAmount,
            grossAmount,
            appliedSites,
        };
    }

    if (params.applyBusinessIncome && businessBaseAmount > 0) {
        const appliedSites: BusinessIncomeAppliedSiteSummary[] = Array.from(businessSiteAgg.entries())
            .map((siteId) => {
                const [safeSiteId, agg] = siteId;
                return {
                    siteId: safeSiteId,
                    siteName: siteNameById.get(safeSiteId) ?? '-',
                    manDay: toNumber(agg?.manDay),
                    amount: toNumber(agg?.amount),
                    reason: '4대보험_제외' as const,
                };
            })
            .sort((a, b) => b.manDay - a.manDay);

        const appliedManDay = appliedSites.reduce((sum, s) => sum + toNumber(s.manDay), 0);

        businessIncomeAppliedSummary = {
            appliedManDay,
            appliedAmount: businessBaseAmount,
            rate: BUSINESS_INCOME_TAX_RATE + BUSINESS_RESIDENT_TAX_RATE,
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
            pensionRate: toNumber(insuranceConfig?.pensionRate),
            healthRate: toNumber(insuranceConfig?.healthRate),
            longtermRate: toNumber(insuranceConfig?.careRateOfHealth),
            careRateOfHealth: toNumber(insuranceConfig?.careRateOfHealth),
            employmentRate: toNumber(insuranceConfig?.employmentRate),
            incomeTaxRate: withholdingIncomeTaxRate,
            residentTaxRate: withholdingResidentTaxRate,
            withholdingBaseDeduction,
            withholdingIncomeBaseMultiplier: withholdingTaxCreditRate,
            businessIncomeTaxRate: BUSINESS_INCOME_TAX_RATE,
            businessResidentTaxRate: BUSINESS_RESIDENT_TAX_RATE,
        },
        insuranceAppliedSummary,
        withholdingAppliedSummary,
        businessIncomeAppliedSummary,
    };
};

