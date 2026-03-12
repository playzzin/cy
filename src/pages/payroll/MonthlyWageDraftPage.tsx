import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { dailyReportService } from '../../services/dailyReportService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { teamService, Team } from '../../services/teamService';
import { companyService, Company } from '../../services/companyService';
import { siteService, Site } from '../../services/siteService';
import { advancePaymentService, AdvancePayment } from '../../services/advancePaymentService';
import { payrollConfigService, PayrollConfig, PayrollDeductionItem, PayrollInsuranceConfig } from '../../services/payrollConfigService';
import * as XLSX from 'xlsx-js-style';
import html2canvas from 'html2canvas';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight, faEye, faEyeSlash, faFileExcel, faSearch, faSpinner, faExclamationTriangle, faCalendarDays, faCopy, faChevronUp, faChevronDown, faDownload, faFileZipper, faThumbtack, faTableColumns } from '@fortawesome/free-solid-svg-icons';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { PayslipTemplate } from './components/PayslipTemplate';
import MonthlyAdvanceLedger, { MonthlyAdvanceLedgerRow } from './components/MonthlyAdvanceLedger';

interface WorkerWorkEntry {
    date: string;
    siteName: string;
    siteId?: string;
    clientCompanyId?: string;
    isLaborSite?: boolean;
    manDay: number;
    unitPrice: number;
    description?: string;
    paymentMethod?: string;
    amount?: number;
}

interface DeductionLine {
    label: string;
    amount: number;
}

interface DeductionBreakdown {
    standardLines: DeductionLine[];
    additionalLines: DeductionLine[];
    totalStandard: number;
    totalAdditional: number;
    total: number;
    hasData: boolean;
}

type InsuranceAppliedReason = 'site' | 'client';

interface InsuranceAppliedSiteSummary {
    siteId: string;
    siteName: string;
    clientCompanyId: string;
    manDay: number;
    amount: number;
    reason: InsuranceAppliedReason;
}

interface InsuranceAppliedSummary {
    thresholdManDay: number;
    appliedManDay: number;
    appliedAmount: number;
    appliedSites: InsuranceAppliedSiteSummary[];
}

interface BusinessIncomeAppliedSiteSummary {
    siteId: string;
    siteName: string;
    manDay: number;
    amount: number;
    reason: '4대보험_제외';
}

interface BusinessIncomeAppliedSummary {
    appliedManDay: number;
    appliedAmount: number;
    appliedSites: BusinessIncomeAppliedSiteSummary[];
}

interface WithholdingAppliedSiteSummary {
    siteId: string;
    siteName: string;
    manDay: number;
    amount: number;
    reason: '노무7이하' | '노무전체';
}

interface WithholdingAppliedSummary {
    thresholdManDay: number;
    appliedManDay: number;
    appliedAmount: number;
    grossAmount?: number;
    appliedSites: WithholdingAppliedSiteSummary[];
}

interface TaxRateSnapshot {
    pensionRate: number;
    healthRate: number;
    careRateOfHealth: number;
    employmentRate: number;
    incomeTaxRate: number;
    residentTaxRate: number;
    withholdingBaseDeduction?: number;
    withholdingIncomeBaseMultiplier?: number;
    businessIncomeTaxRate: number;
    businessResidentTaxRate: number;
}

interface PaymentData {
    workerId: string;
    workerName: string;
    idNumber: string;
    companyId: string;
    companyName: string;
    teamId: string;
    teamName: string;
    month: string;
    totalManDay: number;
    unitPrice: number;
    grossAmount: number;
    totalDeduction: number;
    totalAmount: number;
    laborGrossAmount: number;
    invoiceGrossAmount: number;
    laborManDay: number;
    invoiceManDay: number;
    laborNetAmount: number;
    invoiceNetAmount: number;
    bankName: string;
    bankCode: string;
    accountNumber: string;
    accountHolder: string;
    displayContent: string;
    workEntries: WorkerWorkEntry[];
    deductionBreakdown: DeductionBreakdown;
    taxBreakdown: DeductionBreakdown;
    taxRateSnapshot?: TaxRateSnapshot;
    insuranceAppliedSummary?: InsuranceAppliedSummary;
    withholdingAppliedSummary?: WithholdingAppliedSummary;
    businessIncomeAppliedSummary?: BusinessIncomeAppliedSummary;
    isValid: boolean;
    errors: {
        bankName?: boolean;
        bankCode?: boolean;
        accountNumber?: boolean;
        accountHolder?: boolean;
    };
}

const BANK_CODES: { [key: string]: string } = {
    // 은행
    '한국은행': '001',
    '산업은행': '002', '산업': '002', 'KDB': '002',
    '기업은행': '003', '기업': '003', 'IBK': '003',
    'KB국민은행': '004', '국민은행': '004', '국민': '004', 'KB': '004',
    '수협은행': '007', '수협': '007', 'Sh수협': '007',
    '수출입은행': '008',
    '농협은행': '011', '농협': '011', 'NH': '011', 'NH농협': '011',
    '농축협': '012', '지역농협': '012',
    '우리은행': '020', '우리': '020',
    'SC제일은행': '023', '제일은행': '023', 'SC': '023',
    '한국씨티은행': '027', '씨티': '027', '씨티은행': '027',
    '대구은행': '031', '대구': '031', 'iM뱅크': '031', 'DGB': '031',
    '부산은행': '032', '부산': '032', 'BNK부산': '032',
    '광주은행': '034', '광주': '034',
    '제주은행': '035', '제주': '035',
    '전북은행': '037', '전북': '037',
    '경남은행': '039', '경남': '039', 'BNK경남': '039',
    '새마을금고': '045', '새마을': '045', 'MG새마을': '045', 'MG': '045',
    '신협': '048', '신협중앙회': '048', '신용협동조합': '048',
    '상호저축은행': '050', '저축은행': '050',
    '우체국': '071', '우체국예금': '071',
    '하나은행': '081', '하나': '081', 'KEB하나': '081',
    '신한은행': '088', '신한': '088',
    '케이뱅크': '089', 'K뱅크': '089', '케이': '089',
    '카카오뱅크': '090', '카카오': '090', '카뱅': '090',
    '토스뱅크': '092', '토스': '092',

    // 저축은행 (개별)
    '대신저축은행': '102',
    'SBI저축은행': '103', 'SBI': '103',
    'HK저축은행': '104',
    '웰컴저축은행': '105', '웰컴': '105',
    '신한저축은행': '106',

    // 증권사
    '유안타증권': '209', '유안타': '209',
    'KB증권': '218',
    '상상인증권': '221',
    '한양증권': '222',
    '리딩투자증권': '223', '리딩': '223',
    'BNK투자증권': '224',
    'IBK투자증권': '225',
    '다올투자증권': '227', '다올증권': '227',
    '미래에셋증권': '238', '미래에셋': '238',
    '삼성증권': '240', '삼성': '240',
    '한국투자증권': '243', '한투': '243',
    'NH투자증권': '247', 'NH증권': '247',
    '교보증권': '261', '교보': '261',
    '하이투자증권': '262', '아이엠증권': '262', '하이증권': '262',
    '현대차증권': '263', '현대증권': '263',
    '키움증권': '264', '키움': '264',
    '이베스트투자증권': '265', 'LS증권': '265', '이베스트': '265',
    'SK증권': '266',
    '대신증권': '267', '대신': '267',
    '한화투자증권': '269', '한화증권': '269',
    '하나증권': '270',
    '토스증권': '271',
    'NH선물': '272',
    '코리아에셋투자증권': '273',
    'DS투자증권': '274',
    '흥국증권': '275',
    '유화증권': '276',
    '에스아이증권': '277',
    '신한투자증권': '278', '신한증권': '278',
    'DB금융투자': '279', 'DB증권': '279',
    '유진투자증권': '280', '유진증권': '280',
    '메리츠증권': '287', '메리츠': '287',
    '카카오페이증권': '288',
    '부국증권': '290',
    '신영증권': '291',
};

type AdvancePaymentStandardField =
    | 'prevMonthCarryover'
    | 'accommodation'
    | 'privateRoom'
    | 'gloves'
    | 'deposit'
    | 'fines'
    | 'electricity'
    | 'gas'
    | 'internet'
    | 'water';

const STANDARD_DEDUCTION_FIELDS: Array<{ key: AdvancePaymentStandardField; label: string }> = [
    { key: 'prevMonthCarryover', label: '전월 이월' },
    { key: 'accommodation', label: '숙소비' },
    { key: 'privateRoom', label: '개인방' },
    { key: 'gloves', label: '장갑' },
    { key: 'deposit', label: '보증금' },
    { key: 'fines', label: '과태료' },
    { key: 'electricity', label: '전기료' },
    { key: 'gas', label: '도시가스' },
    { key: 'internet', label: '인터넷' },
    { key: 'water', label: '수도세' },
];

const buildStandardDeductionLabelMap = (): Record<string, string> =>
    STANDARD_DEDUCTION_FIELDS.reduce<Record<string, string>>((acc, { key, label }) => {
        acc[key] = label;
        return acc;
    }, {});

const buildDeductionLabelMapFromConfig = (items?: PayrollDeductionItem[]): Record<string, string> => {
    const base = buildStandardDeductionLabelMap();
    (items ?? []).forEach((item) => {
        const safeId = item.id?.trim();
        if (!safeId) return;
        const safeLabel = item.label?.trim();
        base[safeId] = safeLabel && safeLabel.length > 0 ? safeLabel : safeId;
    });
    return base;
};

const createEmptyDeductionBreakdown = (): DeductionBreakdown => ({
    standardLines: [],
    additionalLines: [],
    totalStandard: 0,
    totalAdditional: 0,
    total: 0,
    hasData: false,
});

const rebuildDeductionBreakdown = (params: { standardLines: DeductionLine[]; additionalLines: DeductionLine[] }): DeductionBreakdown => {
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
};

const TEMP_INSURANCE_PREFIX = '[4대보험]';
const TEMP_BUSINESS_PREFIX = '[3.3%]';
const TEMP_TAX_PREFIX = '[원천세]';
const LEGACY_TAX_PREFIX = '[세금]';
const WITHHOLDING_MAX_MAN_DAY = 7;

const stripTemporaryDeductionLines = (breakdown: DeductionBreakdown): DeductionBreakdown => {
    const safe = breakdown ?? createEmptyDeductionBreakdown();
    const standardLines = safe.standardLines ?? [];
    const additionalLines = (safe.additionalLines ?? []).filter((line) => {
        const label = (line?.label ?? '').trim();
        if (!label) return false;
        return !(label.startsWith(TEMP_INSURANCE_PREFIX) || label.startsWith(TEMP_BUSINESS_PREFIX) || label.startsWith(TEMP_TAX_PREFIX) || label.startsWith(LEGACY_TAX_PREFIX) || label.startsWith('[3.0%]') || label.startsWith('[0.3%]'));
    });
    return rebuildDeductionBreakdown({ standardLines, additionalLines });
};

const stripTemporaryTaxLines = (breakdown: DeductionBreakdown | undefined): DeductionBreakdown => {
    const safe = breakdown ?? createEmptyDeductionBreakdown();
    const additionalLines = (safe.additionalLines ?? []).filter((line) => {
        const label = (line?.label ?? '').trim();
        if (!label) return false;
        return !(label.startsWith(TEMP_TAX_PREFIX) || label.startsWith(LEGACY_TAX_PREFIX) || label.startsWith(TEMP_BUSINESS_PREFIX) || label.startsWith(TEMP_INSURANCE_PREFIX) || label.startsWith('[3.0%]') || label.startsWith('[0.3%]'));
    });
    return rebuildDeductionBreakdown({ standardLines: [], additionalLines });
};

const floorWon = (value: number): number => Math.floor(toNumber(value));

const toNumber = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

const TAX_LINE_BUSINESS_INCOME_PREFIX = '[3.0%]';
const TAX_LINE_BUSINESS_RESIDENT_PREFIX = '[0.3%]';
const BUSINESS_INCOME_TAX_RATE = 0.03;
const BUSINESS_RESIDENT_TAX_RATE = 0.003;

const formatRatePercent = (rate: number, maxFractionDigits: number = 3): string => {
    if (!Number.isFinite(rate)) return '-';
    const percent = rate * 100;
    const text = percent.toLocaleString('ko-KR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: maxFractionDigits,
    });
    return `${text}%`;
};

const resolveTaxLineRateText = (lineLabel: string, snapshot?: TaxRateSnapshot): string => {
    const label = String(lineLabel ?? '').trim();
    if (!label) return '-';

    const prefixed = label.match(/^\[(\d+(?:\.\d+)?)%\]/);
    if (prefixed) return `${prefixed[1]}%`;

    if (!snapshot) return '-';

    if (label.startsWith(TEMP_INSURANCE_PREFIX)) {
        if (label.includes('국민연금')) return formatRatePercent(snapshot.pensionRate, 2);
        if (label.includes('건강보험')) return formatRatePercent(snapshot.healthRate, 3);
        if (label.includes('장기요양')) return formatRatePercent(snapshot.careRateOfHealth, 2);
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

    if (label.includes('사업소득세')) return formatRatePercent(snapshot.businessIncomeTaxRate, 1);
    if (label.includes('소득세')) return formatRatePercent(snapshot.businessResidentTaxRate, 1);

    return '-';
};

const resolveWithholdingDetailText = (snapshot?: TaxRateSnapshot): string => {
    const deduction = Math.max(0, Math.floor(toNumber(snapshot?.withholdingBaseDeduction ?? 150000))).toLocaleString('ko-KR');
    const incomeRate = formatRatePercent(toNumber(snapshot?.incomeTaxRate ?? 0.06), 2);
    const taxCredit = formatRatePercent(toNumber(snapshot?.withholdingIncomeBaseMultiplier ?? 0.55), 2);
    const residentRate = formatRatePercent(toNumber(snapshot?.residentTaxRate ?? 0.1), 2);
    return `상세: (단가-${deduction})×${incomeRate}×(1-${taxCredit}), 지방세=갑근세×${residentRate}`;
};

const getTaxLinesForItem = (item: PaymentData): DeductionLine[] => [
    ...(item.taxBreakdown?.standardLines ?? []),
    ...(item.taxBreakdown?.additionalLines ?? []),
];

const isInsuranceSectionTaxLabel = (labelRaw: string): boolean => {
    const label = String(labelRaw ?? '').trim();
    if (!label) return false;
    return label.startsWith(TEMP_INSURANCE_PREFIX);
};

const isWithholdingSectionTaxLabel = (labelRaw: string): boolean => {
    const label = String(labelRaw ?? '').trim();
    if (!label) return false;
    return label.startsWith(TEMP_TAX_PREFIX) || label.startsWith(LEGACY_TAX_PREFIX);
};

const isBusinessSectionTaxLabel = (labelRaw: string): boolean => {
    const label = String(labelRaw ?? '').trim();
    if (!label) return false;
    return label.startsWith(TAX_LINE_BUSINESS_INCOME_PREFIX) || label.startsWith(TAX_LINE_BUSINESS_RESIDENT_PREFIX);
};

const sumInsuranceSectionTax = (item: PaymentData): number => {
    const lines = getTaxLinesForItem(item);
    return lines.reduce((sum, line) => {
        return sum + (isInsuranceSectionTaxLabel(line.label) ? toNumber(line.amount) : 0);
    }, 0);
};

const sumWithholdingSectionTax = (item: PaymentData): number => {
    const lines = getTaxLinesForItem(item);
    return lines.reduce((sum, line) => {
        return sum + (isWithholdingSectionTaxLabel(line.label) ? toNumber(line.amount) : 0);
    }, 0);
};

const sumBusinessSectionTax = (item: PaymentData): number => {
    const lines = getTaxLinesForItem(item);
    return lines.reduce((sum, line) => {
        return sum + (isBusinessSectionTaxLabel(line.label) ? toNumber(line.amount) : 0);
    }, 0);
};

const extractLedgerTaxAmountsFromItem = (
    item: PaymentData
): NonNullable<MonthlyAdvanceLedgerRow['statementTaxAmounts']> => {
    const lines = getTaxLinesForItem(item);

    let pension = 0;
    let health = 0;
    let care = 0;
    let employment = 0;
    let incomeTax = 0;
    let residentTax = 0;
    let businessIncomeTax = 0;
    let businessResidentTax = 0;

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

    return {
        pension,
        health,
        care,
        employment,
        incomeTax,
        residentTax,
        businessIncomeTax,
        businessResidentTax,
        isWithholdingTarget:
            (item.withholdingAppliedSummary?.appliedAmount ?? 0) > 0 || incomeTax + residentTax > 0,
    };
};

interface WorkEntryTaxCalculationResult {
    statementTaxAmounts: NonNullable<MonthlyAdvanceLedgerRow['statementTaxAmounts']>;
    taxAdditionalLines: DeductionLine[];
    taxRateSnapshot: TaxRateSnapshot;
    insuranceAppliedSummary?: InsuranceAppliedSummary;
    withholdingAppliedSummary?: WithholdingAppliedSummary;
    businessIncomeAppliedSummary?: BusinessIncomeAppliedSummary;
}

const buildWorkEntriesForLedgerRow = (row: MonthlyAdvanceLedgerRow): WorkerWorkEntry[] => {
    const normalizedEntries = (row.workEntries ?? [])
        .map((entry) => ({
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
        .filter((entry) => toNumber(entry.manDay) > 0 || toNumber(entry.amount) > 0);

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

const calculateWorkEntryTaxBreakdown = (params: {
    workEntries?: WorkerWorkEntry[];
    payrollConfig: Pick<PayrollConfig, 'insuranceConfig' | 'incomeTaxRate' | 'residentTaxRate'>;
    applyInsurance: boolean;
    applyBusinessIncome: boolean;
    normalizeSiteName: (value: string | undefined) => string;
    withholdingThreshold: number;
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

const deduplicateAdvanceRecords = (records: AdvancePayment[]): AdvancePayment[] => {
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

const buildDeductionBreakdownFromRecords = (
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
        if (sum > 0) {
            standardLines.push({ label, amount: sum });
        }
    });

    const additionalTotals = new Map<string, number>();
    deduped.forEach((record) => {
        Object.entries(record.items ?? {}).forEach(([itemLabel, rawAmount]) => {
            const amount = toNumber(rawAmount);
            if (amount <= 0) return;
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
        hasData: total > 0,
    };
};

interface Props {
    hideHeader?: boolean;
}

const MonthlyWagePaymentPage: React.FC<Props> = ({ hideHeader }) => {
    const [startMonth, setStartMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [endMonth, setEndMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [yearCursor, setYearCursor] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [paymentData, setPaymentData] = useState<PaymentData[]>([]);
    const [ledgerRowsData, setLedgerRowsData] = useState<MonthlyAdvanceLedgerRow[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [bulkDisplayContent, setBulkDisplayContent] = useState<string>('월급');
    const [bulkSender, setBulkSender] = useState<string>('㈜다원'); // 보내는사람
    const [errorCount, setErrorCount] = useState<number>(0);
    const [showKBPreview, setShowKBPreview] = useState<boolean>(false); // 국민은행용 미리보기
    const [showPayslipModal, setShowPayslipModal] = useState<boolean>(false);
    const [selectedPayslipRowKey, setSelectedPayslipRowKey] = useState<string>(''); // 
    const [showBankCodes, setShowBankCodes] = useState<boolean>(false); // 은행코드표
    const [showAccountColumns, setShowAccountColumns] = useState<boolean>(false);
    const [teams, setTeams] = useState<Team[]>([]);
    const [allTeams, setAllTeams] = useState<Team[]>([]);
    const [allWorkers, setAllWorkers] = useState<Worker[]>([]);
    const [allSites, setAllSites] = useState<Site[]>([]);
    const [showCalculationLabor, setShowCalculationLabor] = useState<boolean>(false);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [selectedTeamId, setSelectedTeamId] = useState<string>('');
    const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');
    const [workerSearchText, setWorkerSearchText] = useState<string>('');
    const [filterMode, setFilterMode] = useState<'team' | 'worker'>('team');
    const [pageViewMode, setPageViewMode] = useState<'standard' | 'ledger'>('ledger');

    const [filtersReady, setFiltersReady] = useState<boolean>(false);
    const [deductionLabelMap, setDeductionLabelMap] = useState<Record<string, string>>(buildStandardDeductionLabelMap());
    const [payrollConfig, setPayrollConfig] = useState<PayrollConfig | null>(null);
    const [showInsuranceSettings, setShowInsuranceSettings] = useState<boolean>(false);
    const [insuranceConfigSaving, setInsuranceConfigSaving] = useState<boolean>(false);

    const [insuranceThresholdManDayInput, setInsuranceThresholdManDayInput] = useState<string>('');
    const [pensionRatePercentInput, setPensionRatePercentInput] = useState<string>('');
    const [healthRatePercentInput, setHealthRatePercentInput] = useState<string>('');
    const [careRateOfHealthPercentInput, setCareRateOfHealthPercentInput] = useState<string>('');
    const [employmentRatePercentInput, setEmploymentRatePercentInput] = useState<string>('');
    const [incomeTaxRatePercentInput, setIncomeTaxRatePercentInput] = useState<string>('');
    const [residentTaxRatePercentInput, setResidentTaxRatePercentInput] = useState<string>('');
    const [withholdingBaseDeductionInput, setWithholdingBaseDeductionInput] = useState<string>('');
    const [withholdingIncomeBaseMultiplierPercentInput, setWithholdingIncomeBaseMultiplierPercentInput] = useState<string>('');
    const [withholdingApplyAllLaborInput, setWithholdingApplyAllLaborInput] = useState<boolean>(true);
    const [employmentApplyBelowThresholdInput, setEmploymentApplyBelowThresholdInput] = useState<boolean>(true);

    const [insuranceApplied, setInsuranceApplied] = useState<boolean>(false);
    const [businessIncomeApplied, setBusinessIncomeApplied] = useState<boolean>(false);
    const [copying, setCopying] = useState(false);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [isFixed, setIsFixed] = useState<boolean>(true);

    const companyNameById = useMemo<Record<string, string>>(() => {
        const map: Record<string, string> = {};
        companies.forEach((company) => {
            const id = String(company.id ?? '').trim();
            if (!id) return;
            map[id] = String(company.name ?? '').trim() || id;
        });
        return map;
    }, [companies]);

    // Lock parent scroll for internal scrolling
    useEffect(() => {
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            const originalOverflow = mainContent.style.overflow;
            mainContent.style.overflow = 'hidden';
            return () => {
                mainContent.style.overflow = originalOverflow;
            };
        }
    }, []);
    const printRef = useRef<HTMLDivElement>(null);

    // --- Copy Logic ---
    const handleCopyToClipboard = async () => {
        if (!printRef.current) return;
        setCopying(true);

        try {
            // Force white background for the capture
            // Cast html2canvas to any because of version mismatch with @types/html2canvas (0.5.x vs 1.4.x)
            const canvas = await (html2canvas as any)(printRef.current, {
                scale: 1.5, // Reasonable scale for clipboard
                backgroundColor: '#ffffff',
                logging: false,
                useCORS: true
            });

            canvas.toBlob(async (blob: Blob | null) => {
                if (!blob) {
                    alert('이미지 생성에 실패했습니다.');
                    setCopying(false);
                    return;
                }

                try {
                    // Safe ClipboardItem usage
                    const ClipboardItem = (window as any).ClipboardItem;
                    if (!ClipboardItem) {
                        alert('이 브라우저는 이미지 복사를 지원하지 않습니다.');
                        setCopying(false);
                        return;
                    }

                    await navigator.clipboard.write([
                        new ClipboardItem({
                            'image/png': blob
                        })
                    ]);
                    alert('명세서가 이미지로 복사되었습니다.\nCtrl+V로 붙여넣으세요.');
                } catch (err) {
                    console.error('Clipboard write failed:', err);
                    alert('클립보드 복사에 실패했습니다. 권한을 확인해주세요.');
                }
                setCopying(false);
            }, 'image/png');

        } catch (error) {
            console.error('Capture failed:', error);
            alert('이미지 생성 중 오류가 발생했습니다.');
            setCopying(false);
        }
    };

    const normalizeValue = useCallback((value: string | undefined): string => {
        return (value ?? '').replace(/\s+/g, '').trim();
    }, []);

    const normalizeTeamName = useCallback((value: string | undefined): string => {
        return (value ?? '')
            .replace(/\(.*?\)/g, '')
            .replace(/\s+/g, '')
            .trim();
    }, []);

    const getYearMonthFromDate = useCallback((date: Date): string => {
        const yyyy = String(date.getFullYear());
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        return `${yyyy}-${mm}`;
    }, []);

    const compareYearMonth = useCallback((a: string, b: string): number => {
        const left = (a ?? '').trim();
        const right = (b ?? '').trim();
        if (left === right) return 0;
        return left < right ? -1 : 1;
    }, []);

    const shiftYearMonth = useCallback(
        (yearMonth: string, diffMonths: number): string => {
            const [yStr, mStr] = yearMonth.split('-');
            const y = Number(yStr);
            const m = Number(mStr);
            const safe = new Date(Number.isFinite(y) ? y : new Date().getFullYear(), (Number.isFinite(m) ? m : 1) - 1, 1);
            safe.setMonth(safe.getMonth() + diffMonths);
            return getYearMonthFromDate(safe);
        },
        [getYearMonthFromDate]
    );

    const buildMonthRange = useCallback(
        (rangeStart: string, rangeEnd: string): string[] => {
            const safeStart = (rangeStart ?? '').trim();
            const safeEnd = (rangeEnd ?? '').trim();
            if (!safeStart || !safeEnd) return [];

            const from = compareYearMonth(safeStart, safeEnd) <= 0 ? safeStart : safeEnd;
            const to = compareYearMonth(safeStart, safeEnd) <= 0 ? safeEnd : safeStart;

            const result: string[] = [];
            let cursor = from;
            for (let i = 0; i < 240; i += 1) {
                result.push(cursor);
                if (cursor === to) break;
                cursor = shiftYearMonth(cursor, 1);
            }
            return result;
        },
        [compareYearMonth, shiftYearMonth]
    );

    const currentYearMonth = useMemo(() => getYearMonthFromDate(new Date()), [getYearMonthFromDate]);
    const prevYearMonth = useMemo(() => shiftYearMonth(currentYearMonth, -1), [currentYearMonth, shiftYearMonth]);

    const monthRange = useMemo(() => buildMonthRange(startMonth, endMonth), [buildMonthRange, endMonth, startMonth]);
    const monthRangeSet = useMemo(() => new Set(monthRange), [monthRange]);
    const rangeLabel = useMemo(() => {
        if (!startMonth || !endMonth) return '';
        const from = compareYearMonth(startMonth, endMonth) <= 0 ? startMonth : endMonth;
        const to = compareYearMonth(startMonth, endMonth) <= 0 ? endMonth : startMonth;
        return from === to ? from : `${from}~${to}`;
    }, [compareYearMonth, endMonth, startMonth]);

    const tableColSpan = showAccountColumns ? 15 : 11;
    const filteredPaymentData = useMemo(() => {
        const rows = paymentData;

        if (filterMode === 'team') {
            return rows;
        }

        if (!selectedWorkerId) return rows;
        return rows.filter((item) => item.workerId === selectedWorkerId);
    }, [filterMode, paymentData, selectedWorkerId]);

    const filteredLedgerRows = useMemo<MonthlyAdvanceLedgerRow[]>(() => {
        const rows = ledgerRowsData;
        if (filterMode === 'team') return rows;
        if (!selectedWorkerId) return rows;
        return rows.filter((item) => item.workerId === selectedWorkerId);
    }, [filterMode, ledgerRowsData, selectedWorkerId]);

    const paymentDataByLedgerKey = useMemo(() => {
        const map = new Map<string, PaymentData>();
        paymentData.forEach((item) => {
            map.set(`${item.month}__${item.workerId}__${item.teamId}`, item);
        });
        return map;
    }, [paymentData]);

    const paymentDataByWorkerMonthKey = useMemo(() => {
        const map = new Map<string, PaymentData[]>();
        paymentData.forEach((item) => {
            const key = `${item.month}__${item.workerId}`;
            const prev = map.get(key) ?? [];
            prev.push(item);
            map.set(key, prev);
        });
        return map;
    }, [paymentData]);

    const ledgerRows = useMemo<MonthlyAdvanceLedgerRow[]>(
        () =>
            filteredLedgerRows.map((row) => {
                const key = `${row.month}__${row.workerId}__${row.teamId}`;
                const isMonthlyRow = (row.salaryModel ?? '').trim() === '월급제';
                let statementItem = paymentDataByLedgerKey.get(key);

                if (!statementItem && isMonthlyRow) {
                    const looseKey = `${row.month}__${row.workerId}`;
                    const candidates = paymentDataByWorkerMonthKey.get(looseKey) ?? [];
                    const normalizedRowTeam = normalizeTeamName(row.teamName);
                    statementItem =
                        candidates.find((candidate) => normalizeTeamName(candidate.teamName) === normalizedRowTeam) ??
                        (candidates.length === 1 ? candidates[0] : undefined);
                }

                if (isMonthlyRow && statementItem) {
                    return {
                        ...row,
                        teamId: statementItem.teamId,
                        teamName: statementItem.teamName,
                        invoiceManDay: statementItem.invoiceManDay,
                        laborManDay: statementItem.laborManDay,
                        unitPrice: statementItem.unitPrice,
                        invoiceGrossAmount: statementItem.invoiceGrossAmount,
                        laborGrossAmount: statementItem.laborGrossAmount,
                        workEntries: [...(statementItem.workEntries ?? [])],
                        statementTaxAmounts: extractLedgerTaxAmountsFromItem(statementItem),
                    };
                }

                if (!payrollConfig) return row;

                const calculatedTax = calculateWorkEntryTaxBreakdown({
                    workEntries: buildWorkEntriesForLedgerRow(row),
                    payrollConfig,
                    applyInsurance: insuranceApplied,
                    applyBusinessIncome: businessIncomeApplied,
                    normalizeSiteName: normalizeTeamName,
                    withholdingThreshold: WITHHOLDING_MAX_MAN_DAY,
                });

                return {
                    ...row,
                    statementTaxAmounts: calculatedTax.statementTaxAmounts,
                };
            }),
        [
            businessIncomeApplied,
            filteredLedgerRows,
            insuranceApplied,
            normalizeTeamName,
            paymentDataByLedgerKey,
            paymentDataByWorkerMonthKey,
            payrollConfig,
        ]
    );

    const payslipTarget = useMemo(() => {
        if (filteredPaymentData.length === 0) return null;
        const targetKey = selectedPayslipRowKey || `${filteredPaymentData[0].month}__${filteredPaymentData[0].workerId}__${filteredPaymentData[0].teamId}`;
        const target = filteredPaymentData.find((item) => `${item.month}__${item.workerId}__${item.teamId}` === targetKey) ?? filteredPaymentData[0];
        return target;
    }, [filteredPaymentData, selectedPayslipRowKey]);

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const [fetchedTeams, fetchedWorkers, fetchedCompanies] = await Promise.all([
                    teamService.getTeams(),
                    manpowerService.getWorkers(),
                    companyService.getCompanies(),
                ]);

                setAllTeams(fetchedTeams);
                setAllWorkers(fetchedWorkers);
                setCompanies(fetchedCompanies);
            } catch (error) {
                console.error('Failed to load initial data:', error);
                alert('초기 데이터를 불러오는 중 오류가 발생했습니다.');
            } finally {
                setFiltersReady(true);
            }
        };

        void fetchInitialData();
    }, []);

    useEffect(() => {
        let mounted = true;
        const loadPayrollConfig = async () => {
            try {
                const config = await payrollConfigService.getConfig();
                if (!mounted) return;
                setDeductionLabelMap(buildDeductionLabelMapFromConfig(config?.deductionItems));
                setPayrollConfig(config);
            } catch (error) {
                console.error('Failed to load payroll deduction config:', error);
            }
        };

        void loadPayrollConfig();
        return () => {
            mounted = false;
        };
    }, []);

    const openInsuranceSettings = useCallback(() => {
        const config = payrollConfig;
        const insurance = config?.insuranceConfig;

        setInsuranceThresholdManDayInput(String(insurance?.thresholdDays ?? 8));
        setPensionRatePercentInput(String(Math.round(((insurance?.pensionRate ?? 0.045) * 10000)) / 100));
        setHealthRatePercentInput(String(Math.round(((insurance?.healthRate ?? 0.03545) * 100000)) / 1000));
        setCareRateOfHealthPercentInput(String(Math.round(((insurance?.careRateOfHealth ?? 0.1295) * 100000)) / 1000));
        setEmploymentRatePercentInput(String(Math.round(((insurance?.employmentRate ?? 0.009) * 100000)) / 1000));
        setWithholdingBaseDeductionInput(String(Math.floor(toNumber(insurance?.withholdingBaseDeduction ?? 150000))));
        setWithholdingIncomeBaseMultiplierPercentInput(
            String(Math.round((toNumber(insurance?.withholdingIncomeBaseMultiplier ?? 0.55) * 10000)) / 100)
        );
        setIncomeTaxRatePercentInput(
            String(Math.round((toNumber(insurance?.withholdingIncomeTaxRate ?? config?.incomeTaxRate ?? 0.06) * 10000)) / 100)
        );
        setResidentTaxRatePercentInput(
            String(Math.round((toNumber(insurance?.withholdingResidentTaxRate ?? config?.residentTaxRate ?? 0.1) * 10000)) / 100)
        );
        setWithholdingApplyAllLaborInput(
            typeof insurance?.withholdingApplyAllLabor === 'boolean' ? insurance.withholdingApplyAllLabor : true
        );
        setEmploymentApplyBelowThresholdInput(
            typeof insurance?.employmentApplyBelowThreshold === 'boolean' ? insurance.employmentApplyBelowThreshold : true
        );

        setShowInsuranceSettings(true);
    }, [payrollConfig]);

    const applyCalculatedDeductions = useCallback((params: { applyInsurance: boolean; applyBusinessIncome: boolean }) => {
        const config = payrollConfig;
        if (!config) {
            alert('설정(4대보험/세율)을 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
            return;
        }

        setPaymentData((prev) =>
            prev.map((item) => {
                const baseDeductionBreakdown = stripTemporaryDeductionLines(item.deductionBreakdown);
                const baseTaxBreakdown = stripTemporaryTaxLines(item.taxBreakdown);

                const calculatedTax = calculateWorkEntryTaxBreakdown({
                    workEntries: item.workEntries ?? [],
                    payrollConfig: config,
                    applyInsurance: params.applyInsurance,
                    applyBusinessIncome: params.applyBusinessIncome,
                    normalizeSiteName: normalizeTeamName,
                    withholdingThreshold: WITHHOLDING_MAX_MAN_DAY,
                });

                const nextDeductionBreakdown = rebuildDeductionBreakdown({
                    standardLines: baseDeductionBreakdown.standardLines,
                    additionalLines: [...(baseDeductionBreakdown.additionalLines ?? [])],
                });

                const nextTaxBreakdown = rebuildDeductionBreakdown({
                    standardLines: [],
                    additionalLines: [...(baseTaxBreakdown.additionalLines ?? []), ...calculatedTax.taxAdditionalLines],
                });

                const nextTotalDeduction = nextDeductionBreakdown.total + nextTaxBreakdown.total;
                const nextTotalAmount = item.grossAmount - nextTotalDeduction;

                return {
                    ...item,
                    deductionBreakdown: nextDeductionBreakdown,
                    taxBreakdown: nextTaxBreakdown,
                    taxRateSnapshot: calculatedTax.taxRateSnapshot,
                    insuranceAppliedSummary: calculatedTax.insuranceAppliedSummary,
                    withholdingAppliedSummary: calculatedTax.withholdingAppliedSummary,
                    businessIncomeAppliedSummary: calculatedTax.businessIncomeAppliedSummary,
                    totalDeduction: nextTotalDeduction,
                    totalAmount: nextTotalAmount,
                };
            })
        );

        setInsuranceApplied(params.applyInsurance);
        setBusinessIncomeApplied(params.applyBusinessIncome);
    }, [normalizeTeamName, payrollConfig]);

    const handleSaveInsuranceSettings = useCallback(async () => {
        const config = payrollConfig;
        if (!config) return;

        const thresholdDays = Math.floor(Number(insuranceThresholdManDayInput));
        if (!Number.isFinite(thresholdDays) || thresholdDays <= 0) {
            alert('보험 적용 기준 공수는 1 이상의 숫자여야 합니다.');
            return;
        }

        const pensionPercent = Number(pensionRatePercentInput);
        const healthPercent = Number(healthRatePercentInput);
        const carePercent = Number(careRateOfHealthPercentInput);
        const employmentPercent = Number(employmentRatePercentInput);
        const incomeTaxPercent = Number(incomeTaxRatePercentInput);
        const residentTaxPercent = Number(residentTaxRatePercentInput);
        const withholdingBaseDeductionWon = Math.floor(Number(withholdingBaseDeductionInput));
        const withholdingIncomeBaseMultiplierPercent = Number(withholdingIncomeBaseMultiplierPercentInput);

        const percentValues = [
            pensionPercent,
            healthPercent,
            carePercent,
            employmentPercent,
            incomeTaxPercent,
            residentTaxPercent,
            withholdingIncomeBaseMultiplierPercent,
        ];
        if (percentValues.some((v) => !Number.isFinite(v) || v < 0)) {
            alert('요율은 0 이상의 숫자여야 합니다.');
            return;
        }
        if (!Number.isFinite(withholdingBaseDeductionWon) || withholdingBaseDeductionWon < 0) {
            alert('갑근세 단가 공제기준은 0 이상의 숫자여야 합니다.');
            return;
        }

        const nextInsurance: PayrollInsuranceConfig = {
            thresholdDays,
            pensionRate: pensionPercent / 100,
            healthRate: healthPercent / 100,
            careRateOfHealth: carePercent / 100,
            employmentRate: employmentPercent / 100,
            withholdingBaseDeduction: withholdingBaseDeductionWon,
            withholdingIncomeBaseMultiplier: withholdingIncomeBaseMultiplierPercent / 100,
            withholdingIncomeTaxRate: incomeTaxPercent / 100,
            withholdingResidentTaxRate: residentTaxPercent / 100,
            withholdingApplyAllLabor: withholdingApplyAllLaborInput,
            employmentApplyBelowThreshold: employmentApplyBelowThresholdInput,
        };

        setInsuranceConfigSaving(true);
        try {
            await payrollConfigService.saveConfig({
                ...config,
                insuranceConfig: nextInsurance,
            });
            const latest = await payrollConfigService.getConfigFromServer();
            setPayrollConfig(latest);
            setDeductionLabelMap(buildDeductionLabelMapFromConfig(latest?.deductionItems));
            setShowInsuranceSettings(false);

            if (insuranceApplied || businessIncomeApplied) {
                applyCalculatedDeductions({ applyInsurance: insuranceApplied, applyBusinessIncome: businessIncomeApplied });
            }
        } catch (error) {
            console.error('Failed to save insurance settings:', error);
            alert('설정 저장 중 오류가 발생했습니다.');
        } finally {
            setInsuranceConfigSaving(false);
        }
    }, [
        applyCalculatedDeductions,
        businessIncomeApplied,
        careRateOfHealthPercentInput,
        employmentApplyBelowThresholdInput,
        employmentRatePercentInput,
        healthRatePercentInput,
        incomeTaxRatePercentInput,
        insuranceApplied,
        insuranceThresholdManDayInput,
        payrollConfig,
        pensionRatePercentInput,
        residentTaxRatePercentInput,
        withholdingApplyAllLaborInput,
        withholdingBaseDeductionInput,
        withholdingIncomeBaseMultiplierPercentInput,
    ]);

    const constructionCompanyIds = useMemo(() => {
        const ids = new Set<string>();
        companies.forEach((company) => {
            const id = (company.id ?? '').trim();
            if (!id) return;
            if (normalizeValue(company.type) !== '시공사') return;
            ids.add(id);
        });
        return ids;
    }, [companies, normalizeValue]);

    useEffect(() => {
        const companyIdByNameNormalized = new Map<string, string>();
        companies.forEach((company) => {
            const id = (company.id ?? '').trim();
            if (!id) return;
            const key = normalizeTeamName(company.name);
            if (!key) return;
            if (!companyIdByNameNormalized.has(key)) {
                companyIdByNameNormalized.set(key, id);
            }
        });

        const filtered = allTeams
            .filter((t): t is Team & { id: string } => typeof t.id === 'string' && t.id.trim().length > 0)
            .filter((team) => {
                const companyIdRaw = (team.companyId ?? '').trim();
                const companyNameKey = normalizeTeamName(team.companyName);
                const companyId = companyIdRaw || (companyNameKey ? (companyIdByNameNormalized.get(companyNameKey) ?? '') : '');
                if (!companyId) return false;
                return constructionCompanyIds.has(companyId);
            })
            .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'ko'));

        setTeams(filtered);

        if (selectedTeamId && !filtered.some((t) => t.id === selectedTeamId)) {
            setSelectedTeamId('');
        }
    }, [allTeams, companies, constructionCompanyIds, normalizeTeamName, selectedTeamId]);

    useEffect(() => {
        if (filterMode !== 'team') return;
        if (!selectedTeamId) {
            setSelectedWorkerId('');
            return;
        }

        const belongsToSelected = allWorkers.some((w) => (w.id ?? '').trim() === selectedWorkerId);
        if (!belongsToSelected) {
            setSelectedWorkerId('');
        }
    }, [allWorkers, filterMode, selectedTeamId, selectedWorkerId]);

    useEffect(() => {
        if (filterMode === 'team') {
            setSelectedWorkerId('');
            setWorkerSearchText('');
            return;
        }

        setSelectedTeamId('');
    }, [filterMode]);

    const handleResetFilters = useCallback(() => {
        if (filterMode === 'team') {
            setSelectedTeamId('');
        } else {
            setSelectedWorkerId('');
            setWorkerSearchText('');
        }
        setExpandedRows(new Set());
    }, [filterMode]);

    const allowedTeamIdsForWorkerFilter = useMemo(() => {
        if (!selectedTeamId) return null;

        const selectedTeamName = allTeams.find(t => t.id === selectedTeamId)?.name ?? '';
        const selectedTeamNameNormalized = normalizeTeamName(selectedTeamName);

        const ids = new Set<string>();
        ids.add(selectedTeamId);

        allTeams.forEach(team => {
            if (!team.id) return;
            if (team.parentTeamId === selectedTeamId) {
                ids.add(team.id);
                return;
            }
            if (selectedTeamNameNormalized) {
                const parentNameNormalized = normalizeTeamName(team.parentTeamName ?? '');
                if (parentNameNormalized && parentNameNormalized === selectedTeamNameNormalized) {
                    ids.add(team.id);
                }
            }
        });

        return ids;
    }, [allTeams, normalizeTeamName, selectedTeamId]);

    const workerOptions = useMemo(() => {
        const text = workerSearchText.trim().toLowerCase();
        const shouldIncludeDailyWage = pageViewMode === 'ledger';
        const rows = allWorkers
            .filter((w): w is Worker & { id: string } => typeof w.id === 'string' && w.id.trim().length > 0)
            .filter((w) => {
                const model = (w.salaryModel ?? w.payType ?? '').trim();
                if (model === '월급제') return true;
                if (shouldIncludeDailyWage && model === '일급제') return true;
                return false;
            })
            .filter((w) => {
                if (!allowedTeamIdsForWorkerFilter) return true;
                const workerTeamId = (w.teamId ?? '').trim();
                if (!workerTeamId) return false;
                return allowedTeamIdsForWorkerFilter.has(workerTeamId);
            })
            .filter((w) => {
                if (!text) return true;
                const name = (w.name ?? '').toLowerCase();
                return name.includes(text);
            })
            .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'ko'));

        return rows;
    }, [allWorkers, allowedTeamIdsForWorkerFilter, pageViewMode, workerSearchText]);





    const validateItem = useCallback((item: Partial<PaymentData>): { isValid: boolean, errors: PaymentData['errors'] } => {
        const errors: PaymentData['errors'] = {};
        let isValid = true;

        if (!item.bankName) {
            errors.bankName = true;
            isValid = false;
        }
        if (!item.bankCode && item.bankName) {
            if (!BANK_CODES[item.bankName]) {
                errors.bankCode = true;
                isValid = false;
            }
        }
        if (!item.accountNumber) {
            errors.accountNumber = true;
            isValid = false;
        }
        if (!item.accountHolder) {
            errors.accountHolder = true;
            isValid = false;
        }

        return { isValid, errors };
    }, []);

    const fetchData = useCallback(async () => {
        if (!startMonth || !endMonth) return;
        const months = buildMonthRange(startMonth, endMonth);
        if (months.length === 0) return;

        setLoading(true);
        try {
            const safeStart = compareYearMonth(startMonth, endMonth) <= 0 ? startMonth : endMonth;
            const safeEnd = compareYearMonth(startMonth, endMonth) <= 0 ? endMonth : startMonth;

            const [endYearStr, endMonthStr] = safeEnd.split('-');
            const endYear = Number(endYearStr);
            const endMonthNum = Number(endMonthStr);

            const startDate = `${safeStart}-01`;
            const lastDay = new Date(endYear, endMonthNum, 0).getDate();
            const endDate = `${safeEnd}-${String(lastDay).padStart(2, '0')}`;

            const monthlyReports = await dailyReportService.getReportsByRange(startDate, endDate);

            const advancesByMonth = new Map<string, AdvancePayment[]>();
            await Promise.all(
                months.map(async (monthKey) => {
                    const [yStr, mStr] = monthKey.split('-');
                    const y = Number(yStr);
                    const m = Number(mStr);
                    if (!Number.isFinite(y) || !Number.isFinite(m)) {
                        advancesByMonth.set(monthKey, []);
                        return;
                    }
                    const rows = await advancePaymentService.getAdvancePaymentsByYearMonth(y, m);
                    advancesByMonth.set(monthKey, rows);
                })
            );

            const advances = Array.from(advancesByMonth.values()).flat();
            const advanceByWorkerTeamKey = new Map<string, AdvancePayment[]>();
            const advanceListByWorkerId = new Map<string, AdvancePayment[]>();
            advances.forEach((item) => {
                const workerId = (item.workerId ?? '').trim();
                const teamId = (item.teamId ?? '').trim();
                if (!workerId) return;
                if (teamId) {
                    const listByTeam = advanceByWorkerTeamKey.get(`${workerId}__${teamId}`) ?? [];
                    listByTeam.push(item);
                    advanceByWorkerTeamKey.set(`${workerId}__${teamId}`, listByTeam);
                }
                const list = advanceListByWorkerId.get(workerId) ?? [];
                list.push(item);
                advanceListByWorkerId.set(workerId, list);
            });

            const workers = allWorkers.length > 0 ? allWorkers : await manpowerService.getWorkers();
            if (allWorkers.length === 0) {
                setAllWorkers(workers);
            }
            const workerMap = new Map<string, Worker>();
            workers.forEach(w => {
                if (w.id) workerMap.set(w.id, w);
            });

            const sites = allSites.length > 0 ? allSites : await siteService.getSites();
            if (allSites.length === 0) {
                setAllSites(sites);
            }
            const siteMap = new Map<string, Site>();
            sites.forEach(s => {
                const id = (s.id ?? '').trim();
                if (id) siteMap.set(id, s);
                const legacyId = (s.legacyId ?? '').trim();
                if (legacyId && !siteMap.has(legacyId)) siteMap.set(legacyId, s);
            });

            const teamMap = new Map<string, Team>();
            allTeams.forEach(t => {
                if (t.id) teamMap.set(t.id, t);
            });

            const allowedTeamIds = (() => {
                if (!selectedTeamId) return null;

                const selectedTeamName = allTeams.find(t => t.id === selectedTeamId)?.name ?? '';
                const selectedTeamNameNormalized = normalizeTeamName(selectedTeamName);

                const ids = new Set<string>();
                ids.add(selectedTeamId);

                allTeams.forEach(team => {
                    if (!team.id) return;
                    if (team.parentTeamId === selectedTeamId) {
                        ids.add(team.id);
                        return;
                    }
                    if (selectedTeamNameNormalized) {
                        const parentNameNormalized = normalizeTeamName(team.parentTeamName ?? '');
                        if (parentNameNormalized && parentNameNormalized === selectedTeamNameNormalized) {
                            ids.add(team.id);
                        }
                    }
                });

                return ids;
            })();

            type WorkerAggregate = {
                workerId: string;
                companyId: string;
                companyName: string;
                salaryModel: '월급제' | '일급제';
                manDay: number;
                teamId: string;
                teamName: string;
                totalAmount: number;
                laborGrossAmount: number;
                invoiceGrossAmount: number;
                laborManDay: number;
                invoiceManDay: number;
                unitPrices: number[];
                workEntries: WorkerWorkEntry[];
                month: string;
            };
            const workerAggregates: Record<string, WorkerAggregate> = {};
            const ledgerWorkerAggregates: Record<string, WorkerAggregate> = {};

            const mergeWorkerAggregate = (
                bucket: Record<string, WorkerAggregate>,
                aggregateKey: string,
                params: {
                    salaryModel: '월급제' | '일급제';
                    workerId: string;
                    companyId: string;
                    companyName: string;
                    teamId: string;
                    teamName: string;
                    month: string;
                    manDay: number;
                    unitPrice: number;
                    isLabor: boolean;
                    reportDate: string;
                    siteName: string;
                    siteId?: string;
                    clientCompanyId?: string;
                    description?: string;
                    paymentMethod?: string;
                }
            ) => {
                if (!bucket[aggregateKey]) {
                    bucket[aggregateKey] = {
                        workerId: params.workerId,
                        companyId: params.companyId,
                        companyName: params.companyName,
                        salaryModel: params.salaryModel,
                        manDay: 0,
                        teamId: params.teamId,
                        teamName: params.teamName,
                        totalAmount: 0,
                        laborGrossAmount: 0,
                        invoiceGrossAmount: 0,
                        laborManDay: 0,
                        invoiceManDay: 0,
                        unitPrices: [],
                        workEntries: [],
                        month: params.month,
                    };
                }

                const target = bucket[aggregateKey];
                const entryAmount = params.manDay * params.unitPrice;
                target.manDay += params.manDay;
                target.totalAmount += entryAmount;
                if (params.isLabor) {
                    target.laborGrossAmount += entryAmount;
                    target.laborManDay += params.manDay;
                } else {
                    target.invoiceGrossAmount += entryAmount;
                    target.invoiceManDay += params.manDay;
                }

                if (!target.unitPrices.includes(params.unitPrice)) {
                    target.unitPrices.push(params.unitPrice);
                }

                target.workEntries.push({
                    date: params.reportDate,
                    siteName: params.siteName,
                    siteId: params.siteId,
                    clientCompanyId: params.clientCompanyId,
                    isLaborSite: params.isLabor,
                    manDay: params.manDay,
                    unitPrice: params.unitPrice,
                    description: params.description,
                    paymentMethod: params.paymentMethod || '-',
                    amount: entryAmount
                });
            };

            monthlyReports.forEach(report => {
                const reportYearMonth = (report.date ?? '').slice(0, 7);
                if (!reportYearMonth) return;
                if (!months.includes(reportYearMonth)) return;

                const reportSite = siteMap.get(report.siteId);

                const resolvedReportTeamIdFromName = (() => {
                    const normalized = normalizeTeamName(report.teamName ?? '');
                    if (!normalized) return '';
                    const matched = allTeams.find(t => normalizeTeamName(t.name ?? '') === normalized);
                    return matched?.id ?? '';
                })();

                const reportTeamId = report.teamId || resolvedReportTeamIdFromName;
                const reportTeamName = report.teamName || teamMap.get(reportTeamId)?.name || '';

                report.workers.forEach(reportWorker => {
                    const workerDetails = workerMap.get(reportWorker.workerId);
                    if (!workerDetails) return;

                    if (selectedWorkerId && reportWorker.workerId !== selectedWorkerId) return;

                    const snapshotSalaryModel =
                        typeof reportWorker.salaryModel === 'string' && reportWorker.salaryModel.trim().length > 0
                            ? reportWorker.salaryModel
                            : typeof reportWorker.payType === 'string' && reportWorker.payType.trim().length > 0
                                ? reportWorker.payType
                                : workerDetails.salaryModel;

                    const normalizedSalaryModel = (snapshotSalaryModel ?? '').trim();
                    const isMonthlyWage = normalizedSalaryModel === '월급제';
                    const isDailyWage = normalizedSalaryModel === '일급제';
                    if (!isMonthlyWage && !isDailyWage) return;

                    if (selectedTeamId && allowedTeamIds) {
                        const workerTeamId = (workerDetails.teamId ?? '').trim();
                        if (!workerTeamId || !allowedTeamIds.has(workerTeamId)) {
                            return;
                        }
                    }

                    const resolvedTeamIdFromName = (() => {
                        const normalized = normalizeTeamName(reportTeamName);
                        if (!normalized) return '';
                        const matched = allTeams.find(t => normalizeTeamName(t.name ?? '') === normalized);
                        return matched?.id ?? '';
                    })();

                    const resolvedTeamId = (workerDetails.teamId ?? '').trim() || reportTeamId || resolvedTeamIdFromName || reportWorker.teamId || '';
                    const resolvedTeamName = (workerDetails.teamName ?? '').trim() || reportTeamName || teamMap.get(resolvedTeamId)?.name || '';

                    const safeTeamKey = resolvedTeamId || (normalizeTeamName(resolvedTeamName) ? `unresolved:${normalizeTeamName(resolvedTeamName)}` : 'no-team');
                    const snapshotUnitPrice = reportWorker.unitPrice ?? workerDetails.unitPrice ?? 0;
                    const isLabor = reportSite?.paymentMethod === '노무';

                    const aggregateParams = {
                        workerId: reportWorker.workerId,
                        companyId: workerDetails.companyId || teamMap.get(resolvedTeamId)?.companyId || report.companyId || reportSite?.constructorCompanyId || '',
                        companyName: workerDetails.companyName || teamMap.get(resolvedTeamId)?.companyName || report.companyName || '',
                        teamId: safeTeamKey,
                        teamName: resolvedTeamName,
                        month: reportYearMonth,
                        manDay: reportWorker.manDay,
                        unitPrice: snapshotUnitPrice,
                        isLabor,
                        reportDate: report.date,
                        siteName: report.siteName || reportSite?.name || '-',
                        siteId: report.siteId,
                        clientCompanyId: reportSite?.clientCompanyId || '',
                        description: reportWorker.workContent || report.workContent || '',
                        paymentMethod: reportSite?.paymentMethod || '-'
                    };

                    if (isMonthlyWage) {
                        const monthlyAggregateKey = `${reportYearMonth}__${reportWorker.workerId}__${safeTeamKey}__월급제`;
                        mergeWorkerAggregate(workerAggregates, monthlyAggregateKey, {
                            ...aggregateParams,
                            salaryModel: '월급제'
                        });
                    }

                    const ledgerSalaryModel: '월급제' | '일급제' = isDailyWage ? '일급제' : '월급제';
                    const ledgerAggregateKey = `${reportYearMonth}__${reportWorker.workerId}__${safeTeamKey}__${ledgerSalaryModel}`;
                    mergeWorkerAggregate(ledgerWorkerAggregates, ledgerAggregateKey, {
                        ...aggregateParams,
                        salaryModel: ledgerSalaryModel
                    });
                });
            });

            const processedData: PaymentData[] = [];
            let errCount = 0;

            Object.keys(workerAggregates).forEach(key => {
                const agg = workerAggregates[key];
                const workerDetails = workerMap.get(agg.workerId);

                if (workerDetails) {
                    const grossAmount = agg.totalAmount;
                    const unitPrice = agg.unitPrices.length === 1
                        ? agg.unitPrices[0]
                        : (agg.manDay > 0 ? Math.round(grossAmount / agg.manDay) : (workerDetails.unitPrice || 0));
                    const bankName = workerDetails.bankName || '';
                    const bankCode = BANK_CODES[bankName] || '';
                    const accountNumber = workerDetails.accountNumber || '';
                    const accountHolder = workerDetails.accountHolder || '';

                    const canonicalTeamId = (() => {
                        const raw = (agg.teamId ?? '').trim();
                        if (!raw) return (workerDetails.teamId ?? '').trim();
                        if (raw.startsWith('unresolved:') || raw === 'no-team') {
                            return (workerDetails.teamId ?? '').trim();
                        }
                        return raw;
                    })();

                    const advanceRecords = (() => {
                        if (canonicalTeamId) {
                            const primaryList = advanceByWorkerTeamKey.get(`${agg.workerId}__${canonicalTeamId}`) ?? [];
                            if (primaryList.length > 0) return primaryList;
                        }
                        return advanceListByWorkerId.get(agg.workerId) ?? [];
                    })();

                    const deductionBreakdown = buildDeductionBreakdownFromRecords(advanceRecords, deductionLabelMap);
                    const totalDeduction = deductionBreakdown.total;
                    const netAmount = grossAmount - totalDeduction;

                    // 계산서/노무용 실지급액 비례 배분
                    const laborProp = grossAmount > 0 ? agg.laborGrossAmount / grossAmount : 0;
                    const laborNetAmount = Math.round(netAmount * laborProp);
                    const invoiceNetAmount = netAmount - laborNetAmount; // 끝전 처리 방지 위해 차감 방식으로 계산

                    const validation = validateItem({ bankName, bankCode, accountNumber, accountHolder });
                    if (!validation.isValid) errCount++;

                    processedData.push({
                        workerId: agg.workerId,
                        workerName: workerDetails.name,
                        idNumber: workerDetails.idNumber || '',
                        companyId: agg.companyId,
                        companyName: agg.companyName,
                        teamId: agg.teamId,
                        teamName: agg.teamName,
                        month: agg.month,
                        totalManDay: agg.manDay,
                        unitPrice: unitPrice,
                        grossAmount,
                        laborGrossAmount: agg.laborGrossAmount,
                        invoiceGrossAmount: agg.invoiceGrossAmount,
                        laborManDay: agg.laborManDay,
                        invoiceManDay: agg.invoiceManDay,
                        totalDeduction,
                        totalAmount: netAmount,
                        laborNetAmount,
                        invoiceNetAmount,
                        bankName: bankName,
                        bankCode: bankCode,
                        accountNumber: accountNumber,
                        accountHolder: accountHolder,
                        displayContent: '월급',
                        workEntries: agg.workEntries.sort((a, b) => a.date.localeCompare(b.date)),
                        deductionBreakdown,
                        taxBreakdown: createEmptyDeductionBreakdown(),
                        taxRateSnapshot: undefined,
                        insuranceAppliedSummary: undefined,
                        withholdingAppliedSummary: undefined,
                        businessIncomeAppliedSummary: undefined,
                        isValid: validation.isValid,
                        errors: validation.errors
                    });
                }
            });

            const processedLedgerRows: MonthlyAdvanceLedgerRow[] = Object.keys(ledgerWorkerAggregates).reduce<MonthlyAdvanceLedgerRow[]>(
                (acc, key) => {
                    const agg = ledgerWorkerAggregates[key];
                    const workerDetails = workerMap.get(agg.workerId);
                    if (!workerDetails) return acc;

                    const grossAmount = agg.totalAmount;
                    const unitPrice = agg.unitPrices.length === 1
                        ? agg.unitPrices[0]
                        : (agg.manDay > 0 ? Math.round(grossAmount / agg.manDay) : (workerDetails.unitPrice || 0));

                    acc.push({
                        rowKey: `${agg.month}__${agg.workerId}__${agg.teamId}__${agg.salaryModel}`,
                        month: agg.month,
                        teamId: agg.teamId,
                        teamName: agg.teamName,
                        workerId: agg.workerId,
                        workerName: workerDetails.name,
                        salaryModel: agg.salaryModel,
                        invoiceManDay: agg.invoiceManDay,
                        laborManDay: agg.laborManDay,
                        unitPrice,
                        invoiceGrossAmount: agg.invoiceGrossAmount,
                        laborGrossAmount: agg.laborGrossAmount,
                        workEntries: agg.workEntries.sort((a, b) => a.date.localeCompare(b.date)),
                    });

                    return acc;
                },
                []
            );

            setPaymentData(processedData);
            setLedgerRowsData(processedLedgerRows);
            setErrorCount(errCount);
            setInsuranceApplied(false);
            setBusinessIncomeApplied(false);

        } catch (error) {
            console.error("Error fetching payment data:", error);
            setLedgerRowsData([]);
            alert("데이터를 불러오는 중 오류가 발생했습니다.");
        } finally {
            setLoading(false);
        }
    }, [allSites, allTeams, allWorkers, buildMonthRange, compareYearMonth, deductionLabelMap, endMonth, normalizeTeamName, selectedTeamId, selectedWorkerId, startMonth, validateItem]);

    useEffect(() => {
        if (!filtersReady) return;
        void fetchData();
    }, [fetchData, filtersReady]);

    const toggleRow = (month: string, workerId: string, teamId: string) => {
        const key = `${month}__${workerId}__${teamId}`;
        setExpandedRows(prev => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    };

    const handleDisplayContentChange = (month: string, workerId: string, teamId: string, value: string) => {
        setPaymentData(prev => prev.map(item => {
            if (item.month !== month) return item;
            if (item.workerId !== workerId) return item;
            if (item.teamId !== teamId) return item;
            return { ...item, displayContent: value };
        }));
    };

    const handleBulkDisplayContentApply = () => {
        const visibleKeys = new Set(filteredPaymentData.map(item => `${item.month}__${item.workerId}__${item.teamId}`));
        setPaymentData(prev => prev.map(item => {
            const key = `${item.month}__${item.workerId}__${item.teamId}`;
            if (!visibleKeys.has(key)) return item;
            return { ...item, displayContent: bulkDisplayContent };
        }));
    };

    // 국민은행용 엑셀 다운로드 (연두색 스타일 적용)
    const handleDownloadKBExcel = () => {
        if (filteredPaymentData.length === 0) {
            alert("출력할 데이터가 없습니다.");
            return;
        }

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

        const rowData: (string | number)[][] = filteredPaymentData.map(item => [
            item.bankCode,
            item.accountNumber,
            item.totalAmount,
            '㈜다원',
            `${item.workerName} 가불`
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
                if (C === 2) {
                    cell.s = greenNumberStyle;
                    cell.t = 'n';
                } else {
                    cell.s = greenStyle;
                }
            }
        }

        // 열 너비 설정
        ws['!cols'] = [
            { wch: 8 },  // A: 은행코드
            { wch: 20 }, // B: 계좌번호
            { wch: 15 }, // C: 이체금액
            { wch: 12 }, // D: 받는분 통장 표시
            { wch: 18 }, // E: 내 통장 메모
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "국민은행용");

        const fileName = `월급제_국민은행용_${rangeLabel || currentYearMonth}.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

    const getKBPreviewData = () => {
        return filteredPaymentData.map(item => ({
            은행코드: item.bankCode,
            계좌번호: item.accountNumber,
            이체금액: item.totalAmount,
            받는분통장표시: '㈜다원',
            내통장메모: `${item.workerName} 가불`
        }));
    };


    const handleDownloadIndividualPayslip = useCallback(() => {
        if (!payslipTarget) return;

        const workEntries = payslipTarget.workEntries ?? [];
        const deductionBreakdown = payslipTarget.deductionBreakdown ?? createEmptyDeductionBreakdown();
        const taxBreakdown = payslipTarget.taxBreakdown ?? createEmptyDeductionBreakdown();
        const combinedDeductions = [
            ...deductionBreakdown.standardLines,
            ...deductionBreakdown.additionalLines,
            ...taxBreakdown.standardLines,
            ...taxBreakdown.additionalLines,
        ];

        const rows: (string | number)[][] = [];
        const merges: XLSX.Range[] = [];
        const pushRow = (row: (string | number)[]) => {
            rows.push(row);
            return rows.length - 1;
        };

        const titleRow = pushRow(['월급제 노임명세서', '', '', '', '', '', '', '']);
        merges.push({ s: { r: titleRow, c: 0 }, e: { r: titleRow, c: 7 } });
        pushRow([]);
        pushRow(['성명', payslipTarget.workerName, '팀', payslipTarget.teamName, '지급월', payslipTarget.month]);
        pushRow([
            '주민등록번호',
            payslipTarget.idNumber || '-',
            '시공사',
            payslipTarget.companyName || '-',
            '은행',
            payslipTarget.bankName || '-',
        ]);
        pushRow([
            '총 공수',
            Number(payslipTarget.totalManDay.toFixed(1)),
            '지급전',
            payslipTarget.grossAmount,
            '실지급',
            payslipTarget.totalAmount,
        ]);
        pushRow([]);

        const dualSectionRow = pushRow(['근무내역', '', '', '', '', '차감내역', '']);
        merges.push({ s: { r: dualSectionRow, c: 0 }, e: { r: dualSectionRow, c: 5 } });
        merges.push({ s: { r: dualSectionRow, c: 6 }, e: { r: dualSectionRow, c: 7 } });

        const tableHeaderRow = pushRow(['일자', '현장', '구분', '공수', '단가', '금액', '항목', '금액']);
        const maxRows = Math.max(workEntries.length, combinedDeductions.length, 1);
        for (let i = 0; i < maxRows; i += 1) {
            const workEntry = workEntries[i];
            const deductionEntry = combinedDeductions[i];
            rows.push([
                workEntry ? workEntry.date : '',
                workEntry ? workEntry.siteName : '',
                workEntry ? (workEntry.paymentMethod || '-') : '',
                workEntry ? Number(workEntry.manDay.toFixed(1)) : '',
                workEntry ? workEntry.unitPrice : '',
                workEntry ? (workEntry.amount || 0) : '',
                deductionEntry ? deductionEntry.label : i === 0 && combinedDeductions.length === 0 ? '등록된 공제 항목이 없습니다.' : '',
                deductionEntry ? deductionEntry.amount : '',
            ]);
        }

        const workSummaryRow = pushRow([
            '근무 합계',
            '',
            '',
            '',
            Number(workEntries.reduce((sum, entry) => sum + entry.manDay, 0).toFixed(1)),
            '',
            payslipTarget.grossAmount,
            '총 차감액',
            payslipTarget.totalDeduction,
        ]);
        pushRow([]);
        const netRow = pushRow(['실 지급액', payslipTarget.totalAmount, '', '', '', '', '', '']);

        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!merges'] = merges;
        ws['!cols'] = [
            { wch: 16 },
            { wch: 22 },
            { wch: 10 },
            { wch: 14 },
            { wch: 18 },
            { wch: 18 },
            { wch: 14 },
            { wch: 18 },
        ];

        const applyStyle = (rowIndex: number, colIndex: number, style: XLSX.CellObject['s']) => {
            const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
            if (!ws[cellAddress]) return;
            ws[cellAddress].s = style;
        };

        const titleStyle: XLSX.CellObject['s'] = {
            font: { bold: true, sz: 16, color: { rgb: 'FFFFFF' } },
            alignment: { horizontal: 'center', vertical: 'center' },
            fill: { fgColor: { rgb: '6B21A8' } },
        };
        applyStyle(titleRow, 0, titleStyle);

        const infoKeyStyle: XLSX.CellObject['s'] = {
            font: { bold: true, color: { rgb: '475569' } },
            alignment: { horizontal: 'left', vertical: 'center' },
            fill: { fgColor: { rgb: 'F8FAFC' } },
        };
        const infoValueStyle: XLSX.CellObject['s'] = {
            alignment: { horizontal: 'left', vertical: 'center' },
        };
        const infoRows = [2, 3, 4];
        infoRows.forEach((rowIdx) => {
            [0, 2, 4].forEach((colIdx) => applyStyle(rowIdx, colIdx, infoKeyStyle));
            [1, 3, 5].forEach((colIdx) => applyStyle(rowIdx, colIdx, infoValueStyle));
        });

        const sectionHeaderStyle: XLSX.CellObject['s'] = {
            font: { bold: true, color: { rgb: '4338CA' } },
            alignment: { horizontal: 'left', vertical: 'center' },
            fill: { fgColor: { rgb: 'EEF2FF' } },
        };
        [0, 6].forEach((colIdx) => applyStyle(dualSectionRow, colIdx, sectionHeaderStyle));

        const tableHeaderStyle: XLSX.CellObject['s'] = {
            font: { bold: true, color: { rgb: '475569' } },
            alignment: { horizontal: 'center', vertical: 'center' },
            fill: { fgColor: { rgb: 'E2E8F0' } },
            border: {
                top: { style: 'thin', color: { rgb: 'CBD5F5' } },
                bottom: { style: 'thin', color: { rgb: 'CBD5F5' } },
                left: { style: 'thin', color: { rgb: 'CBD5F5' } },
                right: { style: 'thin', color: { rgb: 'CBD5F5' } },
            },
        };
        [0, 1, 2, 3, 4, 5, 6, 7].forEach((colIdx) => applyStyle(tableHeaderRow, colIdx, tableHeaderStyle));

        const numberStyle: XLSX.CellObject['s'] = {
            alignment: { horizontal: 'right', vertical: 'center' },
            numFmt: '#,##0.0',
        };
        const currencyStyle: XLSX.CellObject['s'] = {
            alignment: { horizontal: 'right', vertical: 'center' },
            numFmt: '#,##0',
        };

        for (let i = 0; i < maxRows; i += 1) {
            const rowIdx = tableHeaderRow + 1 + i;
            applyStyle(rowIdx, 3, numberStyle);
            applyStyle(rowIdx, 4, currencyStyle);
            applyStyle(rowIdx, 5, currencyStyle);
            applyStyle(rowIdx, 7, currencyStyle);
        }
        applyStyle(workSummaryRow, 3, numberStyle);
        applyStyle(workSummaryRow, 4, currencyStyle);
        applyStyle(workSummaryRow, 5, currencyStyle);
        applyStyle(workSummaryRow, 7, currencyStyle);

        const summaryStyle: XLSX.CellObject['s'] = {
            font: { bold: true },
            alignment: { horizontal: 'left', vertical: 'center' },
        };
        applyStyle(workSummaryRow, 0, summaryStyle);
        applyStyle(workSummaryRow, 6, summaryStyle);
        applyStyle(netRow, 0, summaryStyle);
        applyStyle(netRow, 1, currencyStyle);

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '노임명세서');
        const safeName = (payslipTarget.workerName || 'worker').replace(/[\\/:*?"<>|]/g, '_');
        XLSX.writeFile(wb, `노임명세서_${safeName}_${payslipTarget.month}.xlsx`);
    }, [payslipTarget]);

    const [batchDownloading, setBatchDownloading] = useState(false);
    const batchRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

    const handleDownloadImage = async () => {
        if (!printRef.current || !payslipTarget) return;

        try {
            const canvas = await (html2canvas as any)(printRef.current, {
                scale: 2, // Higher quality for file download
                backgroundColor: '#ffffff',
                logging: false,
                useCORS: true
            });

            canvas.toBlob((blob: Blob | null) => {
                if (!blob) {
                    alert('이미지 생성에 실패했습니다.');
                    return;
                }
                saveAs(blob, `노임명세서_${payslipTarget.workerName}_${payslipTarget.month}.png`);
            }, 'image/png');
        } catch (error) {
            console.error('Download failed:', error);
            alert('다운로드 중 오류가 발생했습니다.');
        }
    };

    const handleBatchDownload = async () => {
        if (filteredPaymentData.length === 0) {
            alert('다운로드할 데이터가 없습니다.');
            return;
        }

        if (filteredPaymentData.length > 50 && !window.confirm(`총 ${filteredPaymentData.length}명의 명세서를 생성합니다. 시간이 다소 소요될 수 있습니다. 진행하시겠습니까?`)) {
            return;
        }

        setBatchDownloading(true);
        const zip = new JSZip();
        const folder = zip.folder(`노임명세서_${rangeLabel || currentYearMonth}_${selectedTeamId ? teams.find(t => t.id === selectedTeamId)?.name : '전체'}`);

        try {
            let processedCount = 0;

            // Process sequentially to avoid browser freeze
            for (const item of filteredPaymentData) {
                const elementKey = `${item.month}__${item.workerId}__${item.teamId}`;
                const element = batchRefs.current[elementKey];
                if (!element) continue;

                const canvas = await (html2canvas as any)(element, {
                    scale: 1.5,
                    backgroundColor: '#ffffff',
                    logging: false,
                    useCORS: true
                });

                const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
                if (blob) {
                    folder?.file(`${item.workerName}_${item.month}.png`, blob);
                    processedCount++;
                }
            }

            if (processedCount === 0) {
                alert('이미지 생성에 실패했습니다.');
                setBatchDownloading(false);
                return;
            }

            const content = await zip.generateAsync({ type: 'blob' });
            saveAs(content, `노임명세서_${rangeLabel || currentYearMonth}_${selectedTeamId ? teams.find(t => t.id === selectedTeamId)?.name : '전체'}.zip`);

        } catch (error) {
            console.error('Batch download failed:', error);
            alert('일괄 다운로드 중 오류가 발생했습니다.');
        } finally {
            setBatchDownloading(false);
        }
    };

    return (
        <div className="flex-1 min-h-0 flex flex-col p-4 md:p-6 max-w-[1700px] w-full mx-auto overflow-hidden">
            {!hideHeader && (
                <div className="flex-shrink-0 bg-white border border-slate-200 rounded-2xl shadow-sm px-6 py-4 mb-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-rose-100 text-rose-600 p-2 rounded-xl">
                            <FontAwesomeIcon icon={faCalendarDays} className="text-xl" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800">월급제</h1>
                            <p className="text-sm text-slate-500 mt-1">월별 공수·단가·공제를 한 화면에서 검토하고 엑셀 출력까지 진행합니다.</p>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex-shrink-0 bg-white border border-slate-200 rounded-2xl shadow-sm p-4 mb-6">
                <div className="flex flex-wrap gap-3 items-center justify-between">
                    <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4 w-full xl:w-auto">
                        <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1 border border-slate-200">
                            <button
                                type="button"
                                onClick={() => setYearCursor(shiftYearMonth(yearCursor, -12))}
                                className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-white rounded-md transition shadow-sm"
                                title="이전 연도"
                            >
                                <FontAwesomeIcon icon={faChevronLeft} />
                            </button>
                            <span className="font-bold text-slate-700 px-2 min-w-[80px] text-center">
                                {parseInt(yearCursor.split('-')[0])}년
                            </span>
                            <button
                                type="button"
                                onClick={() => setYearCursor(shiftYearMonth(yearCursor, 12))}
                                className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-white rounded-md transition shadow-sm"
                                title="다음 연도"
                            >
                                <FontAwesomeIcon icon={faChevronRight} />
                            </button>
                        </div>

                        <div className="flex flex-wrap items-center gap-1">
                            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                                const year = yearCursor.split('-')[0];
                                const ym = `${year}-${String(m).padStart(2, '0')}`;
                                const isInRange = monthRangeSet.has(ym);
                                const isStart = startMonth === ym;
                                const isEnd = endMonth === ym;
                                return (
                                    <button
                                        key={m}
                                        type="button"
                                        onClick={() => {
                                            if (!startMonth || (startMonth && endMonth && compareYearMonth(startMonth, endMonth) !== 0 && monthRange.length > 1 && (ym === startMonth || ym === endMonth))) {
                                                setStartMonth(ym);
                                                setEndMonth(ym);
                                                return;
                                            }
                                            if (!startMonth) {
                                                setStartMonth(ym);
                                                setEndMonth(ym);
                                                return;
                                            }
                                            if (compareYearMonth(ym, startMonth) < 0) {
                                                setStartMonth(ym);
                                                return;
                                            }
                                            setEndMonth(ym);
                                        }}
                                        className={`w-9 h-8 text-sm font-medium rounded-md transition ${isStart || isEnd
                                            ? 'bg-slate-800 text-white shadow-md transform scale-105'
                                            : isInRange
                                                ? 'bg-slate-200 text-slate-800'
                                                : 'text-slate-600 hover:bg-slate-100'
                                            }`}
                                    >
                                        {m}월
                                    </button>
                                );
                            })}
                        </div>

                        <div className="h-6 w-px bg-slate-300 mx-1 hidden lg:block"></div>

                        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                            <button
                                type="button"
                                onClick={() => {
                                    setStartMonth(prevYearMonth);
                                    setEndMonth(prevYearMonth);
                                    setYearCursor(prevYearMonth);
                                }}
                                className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-white hover:text-slate-900 rounded-md transition hover:shadow-sm"
                            >
                                전달
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setStartMonth(currentYearMonth);
                                    setEndMonth(currentYearMonth);
                                    setYearCursor(currentYearMonth);
                                }}
                                className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-white hover:text-slate-900 rounded-md transition hover:shadow-sm"
                            >
                                이달
                            </button>
                        </div>

                        <div className="text-xs text-slate-500">
                            선택기간: <span className="font-semibold text-slate-700">{rangeLabel || '-'}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-lg px-2 py-1.5 shadow-sm">
                        <span className="text-xs text-slate-500 px-1">검색</span>
                        <div className="flex bg-slate-100 rounded-md p-1">
                            <button
                                type="button"
                                onClick={() => setFilterMode('team')}
                                className={`px-3 py-1 text-sm font-semibold rounded-md transition ${filterMode === 'team'
                                    ? 'bg-white shadow text-slate-900'
                                    : 'text-slate-600 hover:text-slate-900'
                                    }`}
                            >
                                팀
                            </button>
                            <button
                                type="button"
                                onClick={() => setFilterMode('worker')}
                                className={`px-3 py-1 text-sm font-semibold rounded-md transition ${filterMode === 'worker'
                                    ? 'bg-white shadow text-slate-900'
                                    : 'text-slate-600 hover:text-slate-900'
                                    }`}
                            >
                                개인
                            </button>
                        </div>
                    </div>

                    {filterMode === 'team' ? (
                        <select
                            value={selectedTeamId}
                            onChange={(e) => setSelectedTeamId(e.target.value)}
                            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                        >
                            <option value="">팀전체</option>
                            {teams
                                .filter((team): team is Team & { id: string } => typeof team.id === 'string' && team.id.trim().length > 0)
                                .map(team => (
                                    <option key={team.id} value={team.id}>{team.name}</option>
                                ))}
                        </select>
                    ) : (
                        <>
                            <select
                                value={selectedWorkerId}
                                onChange={(e) => setSelectedWorkerId(e.target.value)}
                                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                            >
                                <option value="">개인전체</option>
                                {workerOptions.map((w) => (
                                    <option key={w.id} value={w.id}>{w.name}</option>
                                ))}
                            </select>

                            <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-lg px-3 py-2 shadow-sm">
                                <span className="text-xs text-slate-500">작업자</span>
                                <input
                                    type="text"
                                    value={workerSearchText}
                                    onChange={(e) => setWorkerSearchText(e.target.value)}
                                    className="text-sm outline-none w-28"
                                    placeholder="작업자검색"
                                />
                            </div>
                        </>
                    )}

                    <button
                        type="button"
                        onClick={handleResetFilters}
                        className="px-3 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-semibold transition"
                    >
                        필터 초기화
                    </button>



                    <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-lg px-3 py-2 shadow-sm">
                        <span className="text-xs text-slate-500">보내는사람</span>
                        <input
                            type="text"
                            value={bulkSender}
                            onChange={(e) => setBulkSender(e.target.value)}
                            className="text-sm outline-none w-24"
                            placeholder="㈜다원"
                        />
                    </div>

                    <button
                        type="button"
                        onClick={() => setShowAccountColumns(prev => !prev)}
                        className="px-3 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-semibold transition flex items-center gap-2"
                    >
                        <FontAwesomeIcon icon={showAccountColumns ? faEyeSlash : faEye} />
                        {showAccountColumns ? '계좌 숨기기' : '계좌 보기'}
                    </button>

                    <button
                        type="button"
                        onClick={() => setShowCalculationLabor((prev) => !prev)}
                        className={`px-3 py-2 border rounded-lg text-sm font-semibold transition flex items-center gap-2 ${showCalculationLabor
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
                            : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                            }`}
                    >
                        <FontAwesomeIcon icon={faTableColumns} />
                        {showCalculationLabor ? '계산노무 숨기기' : '계산노무 보기'}
                    </button>

                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                        <button
                            type="button"
                            onClick={() => setPageViewMode('standard')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${pageViewMode === 'standard'
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                                }`}
                        >
                            기본목록
                        </button>
                        <button
                            type="button"
                            onClick={() => setPageViewMode('ledger')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${pageViewMode === 'ledger'
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                                }`}
                        >
                            가불대장
                        </button>
                    </div>

                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={openInsuranceSettings}
                            className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-lg text-sm font-bold transition"
                        >
                            4대보험 설정
                        </button>
                        <button
                            type="button"
                            onClick={() => applyCalculatedDeductions({ applyInsurance: !insuranceApplied, applyBusinessIncome: businessIncomeApplied })}
                            disabled={paymentData.length === 0}
                            className={`${insuranceApplied ? 'bg-indigo-200 text-indigo-900 hover:bg-indigo-300' : 'bg-indigo-600 text-white hover:bg-indigo-700'} px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 disabled:opacity-50`}
                        >
                            {insuranceApplied ? '4대보험 해제' : '4대보험 적용'}
                        </button>
                        <button
                            type="button"
                            onClick={() => applyCalculatedDeductions({ applyInsurance: insuranceApplied, applyBusinessIncome: !businessIncomeApplied })}
                            disabled={paymentData.length === 0}
                            className={`${businessIncomeApplied ? 'bg-emerald-200 text-emerald-900 hover:bg-emerald-300' : 'bg-emerald-600 text-white hover:bg-emerald-700'} px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 disabled:opacity-50`}
                        >
                            {businessIncomeApplied ? '사업소득 해제' : '사업소득 적용'}
                        </button>
                        <button
                            onClick={fetchData}
                            className="bg-slate-100 text-slate-600 hover:bg-slate-200 px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2"
                        >
                            <FontAwesomeIcon icon={faSearch} />
                            <span>조회</span>
                        </button>
                        <button
                            onClick={() => setShowKBPreview(true)}
                            disabled={paymentData.length === 0}
                            className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 disabled:opacity-50"
                        >
                            🏦 국민은행용
                        </button>
                        <button
                            onClick={() => {
                                if (filteredPaymentData.length === 0) return;
                                setSelectedPayslipRowKey(`${filteredPaymentData[0].month}__${filteredPaymentData[0].workerId}__${filteredPaymentData[0].teamId}`);
                                setShowPayslipModal(true);
                            }}
                            disabled={paymentData.length === 0}
                            className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 disabled:opacity-50"
                        >
                            📄 명세서
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsFixed((prev) => !prev)}
                            className={`px-4 py-2 border rounded-lg text-sm font-bold transition flex items-center gap-2 ${isFixed
                                ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                                }`}
                        >
                            <FontAwesomeIcon icon={faThumbtack} className={isFixed ? 'rotate-45' : ''} />
                            {isFixed ? '틀고정 해제' : '틀고정'}
                        </button>
                        <button
                            onClick={handleBatchDownload}
                            disabled={paymentData.length === 0 || batchDownloading}
                            className="bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 disabled:opacity-50"
                        >
                            {batchDownloading ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faFileZipper} />}
                            전체 다운로드
                        </button>
                    </div>
                </div>
            </div>

            {/* Hidden Batch Rendering Container */}
            <div className="absolute left-[-9999px] top-0 pointer-events-none opacity-0 w-[1120px]">
                {filteredPaymentData.map(item => (
                    <PayslipTemplate
                        key={`batch-${item.month}__${item.workerId}__${item.teamId}`}
                        ref={el => {
                            const elementKey = `${item.month}__${item.workerId}__${item.teamId}`;
                            batchRefs.current[elementKey] = el;
                        }}
                        data={item}
                        month={item.month}
                    />
                ))}
            </div>

            {errorCount > 0 && (
                <div className="flex-shrink-0 mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2 text-sm">
                    <FontAwesomeIcon icon={faExclamationTriangle} className="text-red-500" />
                    <span><strong>{errorCount}건</strong>의 계좌 정보가 누락되었습니다. 작업자 DB를 점검해주세요.</span>
                </div>
            )}

            <div className={`${pageViewMode === 'ledger' ? 'hidden ' : ''}flex-1 min-h-0 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col`}>
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <h2 className="font-semibold text-slate-700">지급 대상자 목록 (월급제)</h2>
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={bulkDisplayContent}
                                onChange={(e) => setBulkDisplayContent(e.target.value)}
                                placeholder="표시내용 일괄입력"
                                className="border border-slate-300 rounded px-2 py-1 text-xs w-32"
                            />
                            <button
                                onClick={handleBulkDisplayContentApply}
                                className="bg-slate-600 text-white px-3 py-1 rounded text-xs hover:bg-slate-700"
                            >
                                일괄적용
                            </button>
                        </div>
                    </div>
                    <div className="text-sm flex items-center gap-4">
                        <div>
                            <span className="text-slate-500 mr-2">총공수</span>
                            <span className="font-bold text-slate-800">{filteredPaymentData.reduce((sum, item) => sum + item.totalManDay, 0).toFixed(1)}</span>
                        </div>
                        <div>
                            <span className="text-slate-500 mr-2">지급전</span>
                            <span className="font-bold text-slate-800">{filteredPaymentData.reduce((sum, item) => sum + item.grossAmount, 0).toLocaleString()}원</span>
                        </div>
                        <div>
                            <span className="text-slate-500 mr-2">공제</span>
                            <span className="font-bold text-amber-700">{filteredPaymentData.reduce((sum, item) => sum + item.totalDeduction, 0).toLocaleString()}원</span>
                        </div>
                        <div>
                            <span className="text-slate-500 mr-2">실지급</span>
                            <span className="font-bold text-brand-600 text-lg">{filteredPaymentData.reduce((sum, item) => sum + item.totalAmount, 0).toLocaleString()}원</span>
                        </div>
                        <div className="mx-2 w-px h-8 bg-slate-200 hidden xl:block" />
                        <div className="bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
                            <span className="text-blue-600 text-xs font-semibold mr-2">계산서용 입금</span>
                            <span className="font-bold text-blue-800">{filteredPaymentData.reduce((sum, item) => sum + item.invoiceNetAmount, 0).toLocaleString()}원</span>
                        </div>
                        <div className="bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">
                            <span className="text-indigo-600 text-xs font-semibold mr-2">노무용 금액</span>
                            <span className="font-bold text-indigo-800">{filteredPaymentData.reduce((sum, item) => sum + item.laborNetAmount, 0).toLocaleString()}원</span>
                        </div>
                    </div>
                </div>

                <div className="flex-1 min-h-0 overflow-auto">
                    <table className="w-full text-sm text-left border-separate border-spacing-0">
                        <thead className="bg-slate-50 text-slate-500 font-medium sticky top-0 z-40">
                            <tr className="border-b border-slate-200">
                                <th className={`px-4 py-3 text-center w-12 border-b border-slate-200 ${isFixed ? 'sticky left-0 z-50 bg-slate-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]' : ''}`}></th>
                                <th className={`px-4 py-3 border-b border-slate-200 ${isFixed ? 'sticky left-[48px] z-50 bg-slate-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]' : ''}`} style={{ width: isFixed ? '70px' : 'auto', minWidth: isFixed ? '70px' : 'auto' }}>월</th>
                                <th className={`px-4 py-3 border-b border-slate-200 ${isFixed ? 'sticky left-[118px] z-50 bg-slate-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]' : ''}`} style={{ width: isFixed ? '100px' : 'auto', minWidth: isFixed ? '100px' : 'auto' }}>이름</th>
                                <th className={`px-4 py-3 border-b border-slate-200 ${isFixed ? 'sticky left-[218px] z-50 bg-slate-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]' : ''}`} style={{ width: isFixed ? '140px' : 'auto', minWidth: isFixed ? '140px' : 'auto' }}>팀명</th>
                                <th className="px-4 py-3 border-b border-slate-200">주민번호</th>
                                <th className="px-4 py-3 border-b border-slate-200">시공사</th>
                                <th className="px-4 py-3">총 공수</th>
                                <th className="px-4 py-3 text-right">단가</th>
                                <th className="px-4 py-3 text-right">지급전</th>
                                {showCalculationLabor && (
                                    <>
                                        <th className="px-4 py-3 text-center bg-blue-50/50 text-blue-700">계산서 공수</th>
                                        <th className="px-4 py-3 text-right bg-blue-50/50 text-blue-700">계산서 금액</th>
                                        <th className="px-4 py-3 text-center bg-indigo-50/50 text-indigo-700">노무 공수</th>
                                        <th className="px-4 py-3 text-right bg-indigo-50/50 text-indigo-700">노무 금액</th>
                                    </>
                                )}
                                <th className="px-4 py-3 text-right">공제</th>
                                <th className="px-4 py-3 text-right">실지급</th>
                                {showAccountColumns && (
                                    <>
                                        <th className="px-4 py-3">
                                            코드
                                            <button
                                                type="button"
                                                onClick={() => setShowBankCodes(true)}
                                                className="ml-1 text-xs text-blue-600 hover:text-blue-800"
                                            >
                                                📋
                                            </button>
                                        </th>
                                        <th className="px-4 py-3">은행명</th>
                                        <th className="px-4 py-3">계좌번호</th>
                                        <th className="px-4 py-3">예금주</th>
                                    </>
                                )}
                                <th className="px-4 py-3 border-b border-slate-200">표시내용</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={tableColSpan} className="px-4 py-12 text-center text-slate-500">
                                        <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
                                        데이터를 불러오는 중입니다...
                                    </td>
                                </tr>
                            ) : filteredPaymentData.length === 0 ? (
                                <tr>
                                    <td colSpan={tableColSpan} className="px-4 py-12 text-center text-slate-500">
                                        해당 기간에 지급 대상자가 없습니다.
                                    </td>
                                </tr>
                            ) : (
                                filteredPaymentData.map(item => {
                                    const rowKey = `${item.month}__${item.workerId}__${item.teamId}`;
                                    const isExpanded = expandedRows.has(rowKey);
                                    const taxLinesForItem = getTaxLinesForItem(item);
                                    const insuranceTaxLines = taxLinesForItem.filter((line) => isInsuranceSectionTaxLabel(line.label));
                                    const withholdingTaxLines = taxLinesForItem.filter((line) => isWithholdingSectionTaxLabel(line.label));
                                    const businessTaxLines = taxLinesForItem.filter((line) => isBusinessSectionTaxLabel(line.label));
                                    const otherTaxLines = taxLinesForItem.filter((line) => (
                                        !isInsuranceSectionTaxLabel(line.label)
                                        && !isWithholdingSectionTaxLabel(line.label)
                                        && !isBusinessSectionTaxLabel(line.label)
                                    ));
                                    const insuranceSectionTaxTotal = sumInsuranceSectionTax(item);
                                    const withholdingSectionTaxTotal = sumWithholdingSectionTax(item);
                                    const businessSectionTaxTotal = sumBusinessSectionTax(item);
                                    const otherTaxTotal = otherTaxLines.reduce((sum, line) => sum + toNumber(line.amount), 0);
                                    const insuranceAfterTaxAmount = Math.max(0, Math.floor((item.insuranceAppliedSummary?.appliedAmount ?? 0) - insuranceSectionTaxTotal));
                                    const withholdingGrossAmount = item.withholdingAppliedSummary
                                        ? toNumber(item.withholdingAppliedSummary.grossAmount ?? item.withholdingAppliedSummary.appliedAmount)
                                        : 0;
                                    const withholdingAfterTaxAmount = Math.max(0, Math.floor(withholdingGrossAmount - withholdingSectionTaxTotal));
                                    const businessAfterTaxAmount = Math.max(0, Math.floor((item.businessIncomeAppliedSummary?.appliedAmount ?? 0) - businessSectionTaxTotal));
                                    const showInsuranceSection = insuranceTaxLines.length > 0;
                                    const hasInsuranceTargetSummary = Boolean(item.insuranceAppliedSummary && item.insuranceAppliedSummary.appliedManDay > 0);
                                    const withholdingDetailText = resolveWithholdingDetailText(item.taxRateSnapshot);

                                    return (
                                        <React.Fragment key={rowKey}>
                                            <tr className={`hover:bg-slate-50 transition ${!item.isValid ? 'bg-red-50' : ''} ${isExpanded ? 'bg-indigo-50/30' : ''}`}>
                                                <td className={`px-4 py-3 text-center border-b border-slate-100 ${isFixed ? 'sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]' : ''} ${isFixed ? (!item.isValid ? 'bg-red-50' : isExpanded ? 'bg-indigo-50' : 'bg-white') : ''}`}>
                                                    <button
                                                        onClick={() => toggleRow(item.month, item.workerId, item.teamId ?? '')}
                                                        className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${isExpanded ? 'bg-brand-100 text-brand-600' : 'text-slate-400 hover:bg-slate-100'}`}
                                                    >
                                                        <FontAwesomeIcon icon={isExpanded ? faChevronUp : faChevronDown} className="text-xs" />
                                                    </button>
                                                </td>
                                                <td className={`px-4 py-3 font-mono text-slate-600 text-xs border-b border-slate-100 ${isFixed ? 'sticky left-[48px] z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]' : ''} ${isFixed ? (!item.isValid ? 'bg-red-50' : isExpanded ? 'bg-indigo-50' : 'bg-white') : ''}`}>{item.month}</td>
                                                <td className={`px-4 py-3 font-medium text-slate-800 border-b border-slate-100 ${isFixed ? 'sticky left-[118px] z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]' : ''} ${isFixed ? (!item.isValid ? 'bg-red-50' : isExpanded ? 'bg-indigo-50' : 'bg-white') : ''}`}>{item.workerName}</td>
                                                <td className={`px-4 py-3 text-slate-600 border-b border-slate-100 ${isFixed ? 'sticky left-[218px] z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]' : ''} ${isFixed ? (!item.isValid ? 'bg-red-50' : isExpanded ? 'bg-indigo-50' : 'bg-white') : ''}`}>{item.teamName}</td>
                                                <td className="px-4 py-3 text-slate-600 font-mono text-xs border-b border-slate-100">{item.idNumber || '-'}</td>
                                                <td className="px-4 py-3 text-slate-600 border-b border-slate-100">{item.companyName || '-'}</td>
                                                <td className="px-4 py-3 text-slate-600 border-b border-slate-100">{Number(item.totalManDay).toFixed(1)}</td>
                                                <td className="px-4 py-3 text-right text-slate-600 border-b border-slate-100">{item.unitPrice.toLocaleString()}</td>
                                                <td className="px-4 py-3 text-right text-slate-600 border-b border-slate-100">{item.grossAmount.toLocaleString()}</td>
                                                {showCalculationLabor && (
                                                    <>
                                                        <td className="px-4 py-3 text-center text-blue-600 border-b border-slate-100 bg-blue-50/20">{item.invoiceManDay.toFixed(1)}</td>
                                                        <td className="px-4 py-3 text-right text-blue-600 border-b border-slate-100 bg-blue-50/20">{item.invoiceNetAmount.toLocaleString()}</td>
                                                        <td className="px-4 py-3 text-center text-indigo-600 border-b border-slate-100 bg-indigo-50/20">{item.laborManDay.toFixed(1)}</td>
                                                        <td className="px-4 py-3 text-right text-indigo-600 border-b border-slate-100 bg-indigo-50/20">{item.laborNetAmount.toLocaleString()}</td>
                                                    </>
                                                )}
                                                <td className="px-4 py-3 text-right text-amber-700 font-semibold border-b border-slate-100">{item.totalDeduction.toLocaleString()}</td>
                                                <td className="px-4 py-3 text-right font-bold text-brand-600 border-b border-slate-100">{item.totalAmount.toLocaleString()}</td>
                                                {showAccountColumns && (
                                                    <>
                                                        <td className={`px-4 py-3 border-b border-slate-100 ${item.errors.bankCode ? 'text-red-600 font-bold' : 'text-slate-600'}`}>{item.bankCode || '-'}</td>
                                                        <td className={`px-4 py-3 border-b border-slate-100 ${item.errors.bankName ? 'text-red-600 font-bold' : 'text-slate-600'}`}>{item.bankName || '(미입력)'}</td>
                                                        <td className={`px-4 py-3 border-b border-slate-100 ${item.errors.accountNumber ? 'text-red-600 font-bold' : 'text-slate-600'}`}>{item.accountNumber || '(미입력)'}</td>
                                                        <td className={`px-4 py-3 border-b border-slate-100 ${item.errors.accountHolder ? 'text-red-600 font-bold' : 'text-slate-600'}`}>{item.accountHolder || '(미입력)'}</td>
                                                    </>
                                                )}
                                                <td className="px-4 py-3 border-b border-slate-100">
                                                    <input
                                                        type="text"
                                                        value={item.displayContent}
                                                        onChange={(e) => handleDisplayContentChange(item.month, item.workerId, item.teamId, e.target.value)}
                                                        className="border border-slate-300 rounded px-2 py-1 text-xs w-full focus:border-brand-500 outline-none"
                                                    />
                                                </td>
                                            </tr>
                                            {isExpanded && (
                                                <tr>
                                                    <td colSpan={tableColSpan + 1} className="p-0 border-b border-slate-200 bg-slate-50/50">
                                                        <div className="p-4 pl-12">
                                                            <div className="flex flex-col xl:flex-row gap-6">
                                                                {/* 근무 내역 */}
                                                                <div className="flex-1 space-y-2">
                                                                    <div className="flex items-center justify-between">
                                                                        <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                                                            <span className="w-1 h-4 bg-brand-500 rounded-full"></span>
                                                                            근무내역
                                                                        </h4>
                                                                        <span className="text-xs text-slate-500 font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
                                                                            총 {item.workEntries.length}건
                                                                        </span>
                                                                    </div>
                                                                    {item.workEntries.length > 0 ? (
                                                                        <div className="border border-slate-200 rounded-lg bg-white shadow-sm overflow-hidden">
                                                                            <table className="w-full text-xs">
                                                                                <thead className="bg-slate-50 text-slate-500">
                                                                                    <tr>
                                                                                        <th className="px-3 py-2 text-left font-medium border-b border-slate-100 w-24">일자</th>
                                                                                        <th className="px-3 py-2 text-left font-medium border-b border-slate-100">현장</th>
                                                                                        <th className="px-3 py-2 text-center font-medium border-b border-slate-100 w-16">구분</th>
                                                                                        <th className="px-3 py-2 text-right font-medium border-b border-slate-100 w-16">공수</th>
                                                                                        <th className="px-3 py-2 text-right font-medium border-b border-slate-100 w-24">단가</th>
                                                                                        <th className="px-3 py-2 text-right font-medium border-b border-slate-100 w-24">금액</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody className="divide-y divide-slate-100">
                                                                                    {item.workEntries.map((entry, idx) => (
                                                                                        <tr key={`${entry.date}-${idx}`} className="hover:bg-indigo-50/30">
                                                                                            <td className="px-3 py-2 font-mono text-slate-600">{entry.date}</td>
                                                                                            <td className="px-3 py-2 text-slate-700">{entry.siteName}</td>
                                                                                            <td className="px-3 py-2 text-center text-slate-500">{entry.paymentMethod || '-'}</td>
                                                                                            <td className="px-3 py-2 text-right font-medium text-slate-700">{entry.manDay.toFixed(1)}</td>
                                                                                            <td className="px-3 py-2 text-right text-slate-600">{entry.unitPrice.toLocaleString()}</td>
                                                                                            <td className="px-3 py-2 text-right font-medium text-slate-800">{(entry.amount || 0).toLocaleString()}</td>
                                                                                        </tr>
                                                                                    ))}
                                                                                </tbody>
                                                                                <tfoot className="bg-slate-50 font-semibold text-slate-700">
                                                                                    <tr>
                                                                                        <td colSpan={3} className="px-3 py-2 text-right">합계</td>
                                                                                        <td className="px-3 py-2 text-right text-indigo-600">{item.totalManDay.toFixed(1)}</td>
                                                                                        <td className="px-3 py-2"></td>
                                                                                        <td className="px-3 py-2 text-right text-indigo-600">{item.grossAmount.toLocaleString()}</td>
                                                                                    </tr>
                                                                                    {(item.laborGrossAmount > 0 && item.invoiceGrossAmount > 0) && (
                                                                                        <tr className="text-[10px] font-normal text-slate-500 bg-white border-t border-slate-100">
                                                                                            <td colSpan={5} className="px-3 py-1 text-right">
                                                                                                (노무용: {item.laborGrossAmount.toLocaleString()} / 계산서용: {item.invoiceGrossAmount.toLocaleString()})
                                                                                            </td>
                                                                                            <td></td>
                                                                                        </tr>
                                                                                    )}
                                                                                </tfoot>
                                                                            </table>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="p-4 border border-dashed border-slate-300 rounded-lg text-center text-xs text-slate-500 bg-white">
                                                                            근무내역이 없습니다.
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* 공제 내역 */}
                                                                <div className="flex-1 space-y-2">
                                                                    <div className="flex items-center justify-between">
                                                                        <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                                                            <span className="w-1 h-4 bg-amber-500 rounded-full"></span>
                                                                            공제내역
                                                                        </h4>
                                                                        <span className="text-xs text-slate-500 font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
                                                                            총 {(item.deductionBreakdown.standardLines.length + item.deductionBreakdown.additionalLines.length)}건
                                                                        </span>
                                                                    </div>
                                                                    {item.deductionBreakdown.hasData ? (
                                                                        <div className="border border-slate-200 rounded-lg bg-white shadow-sm overflow-hidden">
                                                                            <table className="w-full text-xs">
                                                                                <thead className="bg-slate-50 text-slate-500">
                                                                                    <tr>
                                                                                        <th className="px-3 py-2 text-left font-medium border-b border-slate-100">항목</th>
                                                                                        <th className="px-3 py-2 text-right font-medium border-b border-slate-100 w-32">금액</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody className="divide-y divide-slate-100">
                                                                                    {[...item.deductionBreakdown.standardLines, ...item.deductionBreakdown.additionalLines].map((line, idx) => (
                                                                                        <tr key={`deduction-${line.label}-${idx}`} className="hover:bg-amber-50/30">
                                                                                            <td className="px-3 py-2 text-slate-700">{line.label}</td>
                                                                                            <td className="px-3 py-2 text-right text-red-600 font-medium">-{line.amount.toLocaleString()}</td>
                                                                                        </tr>
                                                                                    ))}
                                                                                </tbody>
                                                                                <tfoot className="bg-amber-50 font-bold text-amber-800">
                                                                                    <tr>
                                                                                        <td className="px-3 py-2 text-right">공제 합계</td>
                                                                                        <td className="px-3 py-2 text-right">-{item.deductionBreakdown.total.toLocaleString()}</td>
                                                                                    </tr>
                                                                                </tfoot>
                                                                            </table>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="p-4 border border-dashed border-slate-300 rounded-lg text-center text-xs text-slate-500 bg-white">
                                                                            공제 내역이 없습니다.
                                                                        </div>
                                                                    )}

                                                                    <div className="mt-4" />

                                                                    <div className="flex items-center justify-between">
                                                                        <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                                                            <span className="w-1 h-4 bg-rose-500 rounded-full"></span>
                                                                            세금내역
                                                                        </h4>
                                                                        <span className="text-xs text-slate-500 font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
                                                                            총 {(item.taxBreakdown.standardLines.length + item.taxBreakdown.additionalLines.length)}건
                                                                        </span>
                                                                    </div>
                                                                    {showInsuranceSection && (
                                                                        <div className="border border-emerald-200 bg-emerald-50 rounded-lg p-3 text-xs">
                                                                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                                                                                <div className="text-emerald-800 font-bold">
                                                                                    {hasInsuranceTargetSummary
                                                                                        ? `4대보험 적용 공수 ${item.insuranceAppliedSummary!.appliedManDay.toFixed(1)} (기준 ${item.insuranceAppliedSummary!.thresholdManDay})`
                                                                                        : '4대보험 공제내역'}
                                                                                </div>
                                                                                <div className="text-emerald-700 font-mono">
                                                                                    {hasInsuranceTargetSummary
                                                                                        ? `대상금액 ${item.insuranceAppliedSummary!.appliedAmount.toLocaleString()}원`
                                                                                        : `공제금액 ${insuranceSectionTaxTotal.toLocaleString()}원`}
                                                                                </div>
                                                                            </div>
                                                                            {hasInsuranceTargetSummary && (
                                                                                <div className="mt-2 border border-emerald-200 rounded bg-white overflow-hidden">
                                                                                    <table className="w-full text-xs">
                                                                                        <thead className="bg-emerald-100 text-emerald-800">
                                                                                            <tr>
                                                                                                <th className="px-2 py-1 text-left font-bold">대상 현장</th>
                                                                                                <th className="px-2 py-1 text-center font-bold w-20">사유</th>
                                                                                                <th className="px-2 py-1 text-right font-bold w-16">공수</th>
                                                                                                <th className="px-2 py-1 text-right font-bold w-24">금액</th>
                                                                                            </tr>
                                                                                        </thead>
                                                                                        <tbody className="divide-y divide-emerald-100">
                                                                                            {item.insuranceAppliedSummary!.appliedSites.map((s) => (
                                                                                                <tr key={`ins-site-${s.siteId}`}>
                                                                                                    <td className="px-2 py-1 text-slate-700">{s.siteName}</td>
                                                                                                    <td className="px-2 py-1 text-center text-emerald-700 font-semibold">
                                                                                                        {s.reason === 'site' ? '노무현장8+' : '발주8+'}
                                                                                                    </td>
                                                                                                    <td className="px-2 py-1 text-right font-mono text-slate-700">{s.manDay.toFixed(1)}</td>
                                                                                                    <td className="px-2 py-1 text-right font-mono text-slate-700">{s.amount.toLocaleString()}</td>
                                                                                                </tr>
                                                                                            ))}
                                                                                        </tbody>
                                                                                    </table>
                                                                                </div>
                                                                            )}
                                                                            <div className="mt-2 border border-emerald-200 rounded bg-white overflow-hidden">
                                                                                <table className="w-full text-xs">
                                                                                    <thead className="bg-emerald-100 text-emerald-800">
                                                                                        <tr>
                                                                                            <th className="px-2 py-1 text-left font-bold">공제내역</th>
                                                                                            <th className="px-2 py-1 text-center font-bold w-20">세액요율</th>
                                                                                            <th className="px-2 py-1 text-right font-bold w-24">금액</th>
                                                                                        </tr>
                                                                                    </thead>
                                                                                    <tbody className="divide-y divide-emerald-100">
                                                                                        {insuranceTaxLines.map((line, idx) => (
                                                                                            <tr key={`ins-tax-${idx}`}>
                                                                                                <td className="px-2 py-1 text-slate-700">{line.label}</td>
                                                                                                <td className="px-2 py-1 text-center font-mono text-slate-600">{resolveTaxLineRateText(line.label, item.taxRateSnapshot)}</td>
                                                                                                <td className="px-2 py-1 text-right font-mono text-slate-700">-{line.amount.toLocaleString()}</td>
                                                                                            </tr>
                                                                                        ))}
                                                                                    </tbody>
                                                                                    <tfoot className="bg-emerald-50 font-bold text-emerald-900">
                                                                                        <tr>
                                                                                            <td className="px-2 py-1 text-right" colSpan={2}>합계</td>
                                                                                            <td className="px-2 py-1 text-right">-{insuranceSectionTaxTotal.toLocaleString()}</td>
                                                                                        </tr>
                                                                                    </tfoot>
                                                                                </table>
                                                                            </div>
                                                                            {hasInsuranceTargetSummary && (
                                                                                <div className="mt-2 border border-emerald-200 rounded bg-white overflow-hidden">
                                                                                    <table className="w-full text-xs">
                                                                                        <tbody>
                                                                                            <tr className="bg-emerald-50">
                                                                                                <td className="px-2 py-1.5 text-center text-emerald-900 font-bold w-1/4">세전 금액</td>
                                                                                                <td className="px-2 py-1.5 text-right font-mono text-slate-800 w-1/4">{item.insuranceAppliedSummary!.appliedAmount.toLocaleString()}</td>
                                                                                                <td className="px-2 py-1.5 text-center text-emerald-900 font-bold w-1/4">세후 금액</td>
                                                                                                <td className="px-2 py-1.5 text-right font-mono text-emerald-700 font-bold w-1/4">{insuranceAfterTaxAmount.toLocaleString()}</td>
                                                                                            </tr>
                                                                                        </tbody>
                                                                                    </table>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                    {item.withholdingAppliedSummary && item.withholdingAppliedSummary.appliedManDay > 0 && (
                                                                        <div className="border border-amber-200 bg-amber-50 rounded-lg p-3 text-xs mt-2">
                                                                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                                                                                <div className="text-amber-900 font-bold">
                                                                                    갑근세·지방세 적용공수 {item.withholdingAppliedSummary.appliedManDay.toFixed(1)}공수
                                                                                    {item.withholdingAppliedSummary.thresholdManDay > 0
                                                                                        ? ` (기준 ${item.withholdingAppliedSummary.thresholdManDay}공수 이하)`
                                                                                        : ' (노무 전체 공수 적용)'}
                                                                                </div>
                                                                                <div className="text-amber-800 font-mono">
                                                                                    과세대상금액 {item.withholdingAppliedSummary.appliedAmount.toLocaleString()}원
                                                                                </div>
                                                                            </div>
                                                                            <div className="mt-2 border border-amber-200 rounded bg-white overflow-hidden">
                                                                                <table className="w-full text-xs">
                                                                                    <thead className="bg-amber-100 text-amber-900">
                                                                                        <tr>
                                                                                            <th className="px-2 py-1 text-left font-bold">대상 현장</th>
                                                                                            <th className="px-2 py-1 text-center font-bold w-24">사유</th>
                                                                                            <th className="px-2 py-1 text-right font-bold w-16">공수</th>
                                                                                            <th className="px-2 py-1 text-right font-bold w-24">금액</th>
                                                                                        </tr>
                                                                                    </thead>
                                                                                    <tbody className="divide-y divide-amber-100">
                                                                                        {item.withholdingAppliedSummary.appliedSites.map((s) => (
                                                                                            <tr key={`withholding-site-${s.siteId}`}>
                                                                                                <td className="px-2 py-1 text-slate-700">{s.siteName}</td>
                                                                                                <td className="px-2 py-1 text-center text-amber-700 font-semibold">
                                                                                                    {s.reason === '노무전체' ? '노무전체' : '노무-7'}
                                                                                                </td>
                                                                                                <td className="px-2 py-1 text-right font-mono text-slate-700">{s.manDay.toFixed(1)}</td>
                                                                                                <td className="px-2 py-1 text-right font-mono text-slate-700">{s.amount.toLocaleString()}</td>
                                                                                            </tr>
                                                                                        ))}
                                                                                    </tbody>
                                                                                </table>
                                                                            </div>
                                                                            <div className="mt-2 border border-amber-200 rounded bg-white overflow-hidden">
                                                                                <table className="w-full text-xs">
                                                                                    <thead className="bg-amber-100 text-amber-900">
                                                                                        <tr>
                                                                                            <th className="px-2 py-1 text-left font-bold">공제내역</th>
                                                                                            <th className="px-2 py-1 text-center font-bold w-20">세액요율</th>
                                                                                            <th className="px-2 py-1 text-right font-bold w-24">금액</th>
                                                                                        </tr>
                                                                                    </thead>
                                                                                    <tbody className="divide-y divide-amber-100">
                                                                                        {withholdingTaxLines.map((line, idx) => (
                                                                                            <tr key={`withholding-tax-${idx}`}>
                                                                                                <td className="px-2 py-1 text-slate-700">{line.label}</td>
                                                                                                <td className="px-2 py-1 text-center font-mono text-slate-600">{resolveTaxLineRateText(line.label, item.taxRateSnapshot)}</td>
                                                                                                <td className="px-2 py-1 text-right font-mono text-slate-700">-{line.amount.toLocaleString()}</td>
                                                                                            </tr>
                                                                                        ))}
                                                                                    </tbody>
                                                                                    <tfoot className="bg-amber-50 font-bold text-amber-900">
                                                                                        <tr>
                                                                                            <td className="px-2 py-1 text-right" colSpan={2}>합계</td>
                                                                                            <td className="px-2 py-1 text-right">-{withholdingSectionTaxTotal.toLocaleString()}</td>
                                                                                        </tr>
                                                                                        <tr className="font-normal text-[10px] text-amber-900/90">
                                                                                            <td className="px-2 py-1 text-left" colSpan={3}>{withholdingDetailText}</td>
                                                                                        </tr>
                                                                                    </tfoot>
                                                                                </table>
                                                                            </div>
                                                                            <div className="mt-2 border border-amber-200 rounded bg-white overflow-hidden">
                                                                                <table className="w-full text-xs">
                                                                                    <tbody>
                                                                                        <tr className="bg-amber-50">
                                                                                            <td className="px-2 py-1.5 text-center text-amber-900 font-bold w-1/4">세전 금액</td>
                                                                                            <td className="px-2 py-1.5 text-right font-mono text-slate-800 w-1/4">{toNumber(item.withholdingAppliedSummary.grossAmount ?? item.withholdingAppliedSummary.appliedAmount).toLocaleString()}</td>
                                                                                            <td className="px-2 py-1.5 text-center text-amber-900 font-bold w-1/4">세후 금액</td>
                                                                                            <td className="px-2 py-1.5 text-right font-mono text-amber-700 font-bold w-1/4">{withholdingAfterTaxAmount.toLocaleString()}</td>
                                                                                        </tr>
                                                                                    </tbody>
                                                                                </table>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                    {item.businessIncomeAppliedSummary && item.businessIncomeAppliedSummary.appliedManDay > 0 && (
                                                                        <div className="border border-sky-200 bg-sky-50 rounded-lg p-3 text-xs mt-2">
                                                                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                                                                                <div className="text-sky-900 font-bold">
                                                                                    사업소득 3.3% 적용 공수 {item.businessIncomeAppliedSummary.appliedManDay.toFixed(1)}
                                                                                </div>
                                                                                <div className="text-sky-800 font-mono">
                                                                                    대상금액 {item.businessIncomeAppliedSummary.appliedAmount.toLocaleString()}원
                                                                                </div>
                                                                            </div>
                                                                            <div className="mt-2 border border-sky-200 rounded bg-white overflow-hidden">
                                                                                <table className="w-full text-xs">
                                                                                    <thead className="bg-sky-100 text-sky-900">
                                                                                        <tr>
                                                                                            <th className="px-2 py-1 text-left font-bold">대상 현장</th>
                                                                                            <th className="px-2 py-1 text-center font-bold w-24">사유</th>
                                                                                            <th className="px-2 py-1 text-right font-bold w-16">공수</th>
                                                                                            <th className="px-2 py-1 text-right font-bold w-24">금액</th>
                                                                                        </tr>
                                                                                    </thead>
                                                                                    <tbody className="divide-y divide-sky-100">
                                                                                        {item.businessIncomeAppliedSummary.appliedSites.map((s) => (
                                                                                            <tr key={`biz-site-${s.siteId}`}>
                                                                                                <td className="px-2 py-1 text-slate-700">{s.siteName}</td>
                                                                                                <td className="px-2 py-1 text-center text-sky-700 font-semibold">4대보험·갑근세 제외</td>
                                                                                                <td className="px-2 py-1 text-right font-mono text-slate-700">{s.manDay.toFixed(1)}</td>
                                                                                                <td className="px-2 py-1 text-right font-mono text-slate-700">{s.amount.toLocaleString()}</td>
                                                                                            </tr>
                                                                                        ))}
                                                                                    </tbody>
                                                                                </table>
                                                                            </div>
                                                                            <div className="mt-2 border border-sky-200 rounded bg-white overflow-hidden">
                                                                                <table className="w-full text-xs">
                                                                                    <thead className="bg-sky-100 text-sky-900">
                                                                                        <tr>
                                                                                            <th className="px-2 py-1 text-left font-bold">공제내역</th>
                                                                                            <th className="px-2 py-1 text-center font-bold w-20">세액요율</th>
                                                                                            <th className="px-2 py-1 text-right font-bold w-24">금액</th>
                                                                                        </tr>
                                                                                    </thead>
                                                                                    <tbody className="divide-y divide-sky-100">
                                                                                        {businessTaxLines.map((line, idx) => (
                                                                                            <tr key={`biz-tax-${idx}`}>
                                                                                                <td className="px-2 py-1 text-slate-700">{line.label}</td>
                                                                                                <td className="px-2 py-1 text-center font-mono text-slate-600">{resolveTaxLineRateText(line.label, item.taxRateSnapshot)}</td>
                                                                                                <td className="px-2 py-1 text-right font-mono text-slate-700">-{line.amount.toLocaleString()}</td>
                                                                                            </tr>
                                                                                        ))}
                                                                                    </tbody>
                                                                                    <tfoot className="bg-sky-50 font-bold text-sky-900">
                                                                                        <tr>
                                                                                            <td className="px-2 py-1 text-right" colSpan={2}>합계</td>
                                                                                            <td className="px-2 py-1 text-right">-{businessSectionTaxTotal.toLocaleString()}</td>
                                                                                        </tr>
                                                                                    </tfoot>
                                                                                </table>
                                                                            </div>
                                                                            <div className="mt-2 border border-sky-200 rounded bg-white overflow-hidden">
                                                                                <table className="w-full text-xs">
                                                                                    <tbody>
                                                                                        <tr className="bg-sky-50">
                                                                                            <td className="px-2 py-1.5 text-center text-sky-900 font-bold w-1/4">세전 금액</td>
                                                                                            <td className="px-2 py-1.5 text-right font-mono text-slate-800 w-1/4">{item.businessIncomeAppliedSummary.appliedAmount.toLocaleString()}</td>
                                                                                            <td className="px-2 py-1.5 text-center text-sky-900 font-bold w-1/4">세후 금액</td>
                                                                                            <td className="px-2 py-1.5 text-right font-mono text-sky-700 font-bold w-1/4">{businessAfterTaxAmount.toLocaleString()}</td>
                                                                                        </tr>
                                                                                    </tbody>
                                                                                </table>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                    {otherTaxLines.length > 0 ? (
                                                                        <div className="border border-slate-200 rounded-lg bg-white shadow-sm overflow-hidden">
                                                                            <table className="w-full text-xs">
                                                                                <thead className="bg-slate-50 text-slate-500">
                                                                                    <tr>
                                                                                        <th className="px-3 py-2 text-left font-medium border-b border-slate-100">항목</th>
                                                                                        <th className="px-3 py-2 text-center font-medium border-b border-slate-100 w-24">세액요율</th>
                                                                                        <th className="px-3 py-2 text-right font-medium border-b border-slate-100 w-32">금액</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody className="divide-y divide-slate-100">
                                                                                    {otherTaxLines.map((line, idx) => (
                                                                                        <tr key={`tax-${line.label}-${idx}`} className="hover:bg-rose-50/30">
                                                                                            <td className="px-3 py-2 text-slate-700">{line.label}</td>
                                                                                            <td className="px-3 py-2 text-center font-mono text-slate-600">{resolveTaxLineRateText(line.label, item.taxRateSnapshot)}</td>
                                                                                            <td className="px-3 py-2 text-right text-red-600 font-medium">-{line.amount.toLocaleString()}</td>
                                                                                        </tr>
                                                                                    ))}
                                                                                </tbody>
                                                                                <tfoot className="bg-rose-50 font-bold text-rose-800">
                                                                                    <tr>
                                                                                        <td className="px-3 py-2 text-right" colSpan={2}>세금 합계</td>
                                                                                        <td className="px-3 py-2 text-right">-{otherTaxTotal.toLocaleString()}</td>
                                                                                    </tr>
                                                                                </tfoot>
                                                                            </table>
                                                                        </div>
                                                                    ) : null}

                                                                    <div className="mt-2 border-t border-slate-200 pt-2 text-xs text-slate-600 space-y-1">
                                                                        <div className="flex items-center justify-between">
                                                                            <span className="font-bold text-slate-700">세전 금액</span>
                                                                            <span className="font-mono text-slate-800 font-bold">{item.grossAmount.toLocaleString()}</span>
                                                                        </div>
                                                                        <div className="flex items-center justify-between">
                                                                            <span className="font-bold text-slate-700">세후 금액</span>
                                                                            <span className="font-mono text-emerald-700 font-bold">{item.totalAmount.toLocaleString()}</span>
                                                                        </div>
                                                                        <div className="flex items-center justify-between">
                                                                            <span className="font-bold text-slate-700">총 차감액(공제+세금)</span>
                                                                            <span className="font-mono text-red-700 font-bold">-{item.totalDeduction.toLocaleString()}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {pageViewMode === 'ledger' && (
                <MonthlyAdvanceLedger
                    rows={ledgerRows}
                    payrollConfig={payrollConfig}
                    withholdingThreshold={WITHHOLDING_MAX_MAN_DAY}
                    applyInsurance={insuranceApplied}
                    applyBusinessIncome={businessIncomeApplied}
                    clientCompanyNameById={companyNameById}
                />
            )}

            {showKBPreview && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full mx-4 max-h-[80vh] flex flex-col">
                        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-amber-50">
                            <h3 className="text-lg font-bold text-slate-800">🏦 국민은행용 엑셀 미리보기</h3>
                            <button
                                onClick={() => setShowKBPreview(false)}
                                className="text-slate-400 hover:text-slate-600 text-2xl"
                            >
                                ×
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto p-4">
                            <table className="w-full text-sm border-collapse">
                                <thead className="bg-amber-100 sticky top-0">
                                    <tr>
                                        <th className="border border-slate-300 px-3 py-2 text-left font-bold">A. 은행코드</th>
                                        <th className="border border-slate-300 px-3 py-2 text-left font-bold">B. 계좌번호</th>
                                        <th className="border border-slate-300 px-3 py-2 text-right font-bold">C. 이체금액</th>
                                        <th className="border border-slate-300 px-3 py-2 text-left font-bold">D. 받는분통장표시</th>
                                        <th className="border border-slate-300 px-3 py-2 text-left font-bold">E. 내통장메모</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {getKBPreviewData().map((row, idx) => (
                                        <tr key={idx} className="hover:bg-amber-50">
                                            <td className="border border-slate-300 px-3 py-2">{row.은행코드}</td>
                                            <td className="border border-slate-300 px-3 py-2">{row.계좌번호}</td>
                                            <td className="border border-slate-300 px-3 py-2 text-right font-medium">{row.이체금액.toLocaleString()}</td>
                                            <td className="border border-slate-300 px-3 py-2">{row.받는분통장표시}</td>
                                            <td className="border border-slate-300 px-3 py-2">{row.내통장메모}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-4 border-t border-slate-200 flex justify-between items-center bg-amber-50">
                            <span className="text-sm text-slate-600">
                                총 {getKBPreviewData().length}명 · 총 이체금액 {getKBPreviewData().reduce((sum, row) => sum + row.이체금액, 0).toLocaleString()}원
                            </span>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowKBPreview(false)}
                                    className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                                >
                                    닫기
                                </button>
                                <button
                                    onClick={() => { handleDownloadKBExcel(); setShowKBPreview(false); }}
                                    className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-bold flex items-center gap-2"
                                >
                                    <FontAwesomeIcon icon={faFileExcel} />
                                    국민은행용 다운로드
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showBankCodes && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 max-h-[85vh] flex flex-col">
                        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-blue-50">
                            <h3 className="text-lg font-bold text-slate-800">📊 은행코드표</h3>
                            <button
                                onClick={() => setShowBankCodes(false)}
                                className="text-slate-400 hover:text-slate-600 text-2xl"
                            >
                                ×
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto p-4 space-y-4 text-xs">
                            <div>
                                <h4 className="text-sm font-bold text-slate-700 mb-2 bg-blue-100 px-2 py-1 rounded">🏦 은행</h4>
                                <p className="text-slate-500 text-xs mb-2">대표 은행명 또는 별칭을 입력하면 코드가 자동 매핑됩니다.</p>
                            </div>
                            <table className="w-full text-xs border-collapse">
                                <thead className="bg-slate-100 sticky top-0">
                                    <tr>
                                        <th className="border border-slate-300 px-2 py-1 text-left font-bold">코드</th>
                                        <th className="border border-slate-300 px-2 py-1 text-left font-bold">은행명</th>
                                        <th className="border border-slate-300 px-2 py-1 text-left font-bold">별칭</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.entries(BANK_CODES)
                                        .filter(([name]) => name.length <= 6) // 대표명만 대략 노출
                                        .slice(0, 30)
                                        .map(([name, code]) => (
                                            <tr key={`${code}-${name}`}>
                                                <td className="border px-2 py-1 font-mono">{code}</td>
                                                <td className="border px-2 py-1">{name}</td>
                                                <td className="border px-2 py-1 text-slate-500">자동인식</td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-4 border-t border-slate-200 bg-blue-50">
                            <button
                                onClick={() => setShowBankCodes(false)}
                                className="w-full px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold"
                            >
                                닫기
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showPayslipModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[1400px] max-h-[92vh] flex flex-col">
                        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-2xl">📄</span>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800">월급제 노임명세서 미리보기</h3>
                                    <p className="text-xs text-slate-500">{rangeLabel || '-'} · 총 {filteredPaymentData.length}명</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowPayslipModal(false)}
                                className="text-slate-400 hover:text-slate-600 text-2xl"
                            >
                                ×
                            </button>
                        </div>
                        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                            <aside className="md:w-[170px] lg:w-[190px] xl:w-[210px] border-b md:border-b-0 md:border-r border-slate-200 flex-shrink-0 flex flex-col">
                                <div className="p-3 border-b border-slate-100 text-xs font-semibold text-slate-500">지급 대상자</div>
                                <div className="flex-1 overflow-y-auto">
                                    {filteredPaymentData.map(worker => (
                                        <button
                                            key={`${worker.month}__${worker.workerId}__${worker.teamId}`}
                                            onClick={() => setSelectedPayslipRowKey(`${worker.month}__${worker.workerId}__${worker.teamId}`)}
                                            className={`w-full text-left px-4 py-3 border-b border-slate-100 text-sm transition flex flex-col ${payslipTarget?.workerId === worker.workerId ? 'bg-purple-50 text-purple-700 font-semibold' : 'hover:bg-slate-50'}`}
                                        >
                                            <span>{worker.workerName}</span>
                                            <span className="text-xs text-slate-500">{worker.month} · {worker.teamName}</span>
                                        </button>
                                    ))}
                                    {filteredPaymentData.length === 0 && (
                                        <div className="px-4 py-6 text-sm text-slate-500 text-center">표시할 작업자가 없습니다.</div>
                                    )}
                                </div>
                            </aside>
                            <div className="flex-1 overflow-auto p-6 bg-slate-50">
                                {payslipTarget ? (
                                    <PayslipTemplate
                                        ref={printRef}
                                        data={payslipTarget}
                                        month={payslipTarget.month}
                                    />
                                ) : (
                                    <div className="text-center py-12 text-slate-500">
                                        표시할 명세서가 없습니다.
                                    </div>
                                )}

                                <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                    <p className="text-sm text-slate-600">
                                        <span className="font-semibold text-slate-800">{payslipTarget?.workerName ?? '-'}</span>
                                        {' · 실지급 '}
                                        <span className="text-brand-600 font-bold">{payslipTarget ? payslipTarget.totalAmount.toLocaleString() : 0}원</span>
                                    </p>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleCopyToClipboard}
                                            disabled={!payslipTarget || copying}
                                            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold flex items-center gap-2 disabled:opacity-50"
                                        >
                                            {copying ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faCopy} />}
                                            이미지 복사
                                        </button>
                                        <button
                                            onClick={handleDownloadIndividualPayslip}
                                            disabled={!payslipTarget}
                                            className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-bold flex items-center gap-2 disabled:opacity-50"
                                        >
                                            <FontAwesomeIcon icon={faFileExcel} />
                                            개별 명세서 다운로드
                                        </button>
                                        <button
                                            onClick={handleDownloadImage}
                                            disabled={!payslipTarget}
                                            className="px-4 py-2 text-sm bg-slate-700 text-white rounded-lg hover:bg-slate-800 font-bold flex items-center gap-2 disabled:opacity-50"
                                        >
                                            <FontAwesomeIcon icon={faDownload} />
                                            파일 저장
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showInsuranceSettings && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">4대보험/세율 설정</h3>
                                <p className="text-xs text-slate-500 mt-1">적용 기준(공수) 및 요율(%)을 저장합니다.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowInsuranceSettings(false)}
                                className="text-slate-400 hover:text-slate-600 text-2xl"
                            >
                                ×
                            </button>
                        </div>

                        <div className="flex-1 overflow-auto p-4 space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <label className="text-sm">
                                    <div className="text-xs font-bold text-slate-600 mb-1">적용 기준 공수</div>
                                    <input
                                        type="number"
                                        value={insuranceThresholdManDayInput}
                                        onChange={(e) => setInsuranceThresholdManDayInput(e.target.value)}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                        min={1}
                                        step={1}
                                    />
                                </label>
                                <div className="text-xs text-slate-500 flex items-end">
                                    노무현장 공수 합이 기준 이상이면 4대보험 대상으로 판단합니다.
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <label className="text-sm">
                                    <div className="text-xs font-bold text-slate-600 mb-1">국민연금 (%)</div>
                                    <input
                                        type="number"
                                        value={pensionRatePercentInput}
                                        onChange={(e) => setPensionRatePercentInput(e.target.value)}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                        min={0}
                                        step={0.01}
                                    />
                                </label>
                                <label className="text-sm">
                                    <div className="text-xs font-bold text-slate-600 mb-1">건강보험 (%)</div>
                                    <input
                                        type="number"
                                        value={healthRatePercentInput}
                                        onChange={(e) => setHealthRatePercentInput(e.target.value)}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                        min={0}
                                        step={0.001}
                                    />
                                </label>
                                <label className="text-sm">
                                    <div className="text-xs font-bold text-slate-600 mb-1">장기요양(건강보험 대비 %) </div>
                                    <input
                                        type="number"
                                        value={careRateOfHealthPercentInput}
                                        onChange={(e) => setCareRateOfHealthPercentInput(e.target.value)}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                        min={0}
                                        step={0.001}
                                    />
                                </label>
                                <label className="text-sm">
                                    <div className="text-xs font-bold text-slate-600 mb-1">고용보험 (%)</div>
                                    <input
                                        type="number"
                                        value={employmentRatePercentInput}
                                        onChange={(e) => setEmploymentRatePercentInput(e.target.value)}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                        min={0}
                                        step={0.001}
                                    />
                                </label>
                                <label className="text-sm">
                                    <div className="text-xs font-bold text-slate-600 mb-1">갑근세 단가 공제기준 (원)</div>
                                    <input
                                        type="number"
                                        value={withholdingBaseDeductionInput}
                                        onChange={(e) => setWithholdingBaseDeductionInput(e.target.value)}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                        min={0}
                                        step={1000}
                                    />
                                </label>
                                <label className="text-sm">
                                    <div className="text-xs font-bold text-slate-600 mb-1">갑근세 세액공제율 (%)</div>
                                    <input
                                        type="number"
                                        value={withholdingIncomeBaseMultiplierPercentInput}
                                        onChange={(e) => setWithholdingIncomeBaseMultiplierPercentInput(e.target.value)}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                        min={0}
                                        step={0.01}
                                    />
                                </label>
                                <label className="text-sm">
                                    <div className="text-xs font-bold text-slate-600 mb-1">갑근세 세율 (%)</div>
                                    <input
                                        type="number"
                                        value={incomeTaxRatePercentInput}
                                        onChange={(e) => setIncomeTaxRatePercentInput(e.target.value)}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                        min={0}
                                        step={0.01}
                                    />
                                </label>
                                <label className="text-sm">
                                    <div className="text-xs font-bold text-slate-600 mb-1">지방세 (갑근세 대비 %)</div>
                                    <input
                                        type="number"
                                        value={residentTaxRatePercentInput}
                                        onChange={(e) => setResidentTaxRatePercentInput(e.target.value)}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                        min={0}
                                        step={0.01}
                                    />
                                </label>
                            </div>

                            <div className="space-y-2 border-t border-slate-200 pt-3">
                                <label className="flex items-center gap-2 text-xs text-slate-700">
                                    <input
                                        type="checkbox"
                                        checked={withholdingApplyAllLaborInput}
                                        onChange={(e) => setWithholdingApplyAllLaborInput(e.target.checked)}
                                    />
                                    갑근세/지방세를 노무 전체 공수(7공수 미만, 8공수 이상 포함)에 적용
                                </label>
                                <label className="flex items-center gap-2 text-xs text-slate-700">
                                    <input
                                        type="checkbox"
                                        checked={employmentApplyBelowThresholdInput}
                                        onChange={(e) => setEmploymentApplyBelowThresholdInput(e.target.checked)}
                                    />
                                    7공수 미만 노무현장에도 고용보험 공제 적용
                                </label>
                            </div>

                            <div className="text-xs text-slate-500 border-t border-slate-200 pt-3">
                                갑근세 계산식: <span className="font-semibold text-slate-700">(단가 - 공제기준) × 노무공수 × 갑근세율 × (1 - 세액공제율)</span><br />
                                지방세 계산식: <span className="font-semibold text-slate-700">갑근세 × 지방세율</span>
                            </div>
                        </div>

                        <div className="p-4 border-t border-slate-200 flex items-center justify-end gap-2 bg-slate-50">
                            <button
                                type="button"
                                onClick={() => setShowInsuranceSettings(false)}
                                className="px-4 py-2 text-sm text-slate-600 hover:bg-white rounded-lg"
                            >
                                닫기
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveInsuranceSettings}
                                disabled={insuranceConfigSaving}
                                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold disabled:opacity-50 flex items-center gap-2"
                            >
                                {insuranceConfigSaving ? <FontAwesomeIcon icon={faSpinner} spin /> : null}
                                저장
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MonthlyWagePaymentPage;