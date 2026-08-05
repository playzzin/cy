import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Building2,
    CalendarDays,
    ChevronDown,
    ChevronRight,
    Download,
    Edit3,
    ExternalLink,
    FileText,
    Loader2,
    MapPin,
    Printer,
    RefreshCw,
    Save,
    Search,
    Trash2,
    UsersRound,
    WalletCards,
    X,
} from 'lucide-react';
import { dailyReportService, type DailyReportWorkerRow } from '../../services/dailyReportService';
import { manpowerService, type Worker } from '../../services/manpowerService';
import { supportRateService, type SupportRate } from '../../services/supportRateService';
import { useCompanyDataScope } from '../../hooks/useCompanyDataScope';
import { companyDataScopeMatchesLaborRow } from '../../utils/companyDataScope';
import { estimateService, type Estimate } from '../../services/estimateService';
import { progressClaimService } from '../../services/progressClaimService';
import {
    buildClientSiteLaborAdjustmentId,
    clientSiteLaborAdjustmentService,
    type ClientSiteLaborAdjustment,
    type ClientSiteLaborProcessStatus,
} from '../../services/clientSiteLaborAdjustmentService';
import { payrollConfigService, type PayrollConfig } from '../../services/payrollConfigService';
import type {
    ProgressAllocationCalculatedRow,
    ProgressClaim,
    ProgressClaimStatus,
    ProgressClaimSummary,
    ProgressContract,
    ProgressDailyManDaySummary,
    ProgressItemCalculatedRow,
} from '../../types/progressClaim';
import {
    AmountBarComponent,
    InfoTableComponent,
    TitleComponent,
} from '../../components/estimate/EstimateSharedComponents';
import { TransactionTable } from '../../components/estimate/TransactionTable';
import { RentalTransactionTable } from '../../components/estimate/RentalTransactionTable';
import {
    DAY_LABELS_FIRST,
    DAY_LABELS_SECOND,
    MAX_DAY_COLUMNS,
} from '../../utils/excel/SupportPaymentExcelGenerator';
import {
    getLaborStatementWorkerPayType,
    loadLaborStatementDefaults,
} from '../../utils/payrollLaborStatementDefaults';
import {
    getEmptyDraft,
    LOGO_FALLBACK,
    type EstimateDraft,
} from '../../utils/estimateUtils';
import { calculateRentalLineAmount } from '../../utils/rentalTransactionGenerator';
import {
    calculateProgressClaimSummary,
    formatProgressMoney,
    formatProgressQuantity,
} from '../../utils/progressClaimCalculations';
import {
    calculateClientSiteLaborRow,
    calculateClientSiteLaborTotals,
    DEFAULT_CLIENT_SITE_LABOR_TAX_CONFIG,
    type ClientSiteLaborCalculationResult,
    type ClientSiteLaborTaxConfig,
} from '../../utils/clientSiteLaborCalculator';

interface EnrichedWorkerRow extends DailyReportWorkerRow {
    constructionCompanyKey: string;
    clientCompanyKey: string;
    siteKey: string;
    constructionCompanyName: string;
    clientCompanyName: string;
    siteName: string;
    workerName: string;
    idNumber: string;
    address: string;
    contact: string;
    bankName: string;
    accountNumber: string;
    accountHolder: string;
    fileNameSaved: string;
    masterTeamName: string;
    billingUnitPrice: number;
    billingAmount: number;
}

interface WorkerSummary {
    key: string;
    workerId: string;
    workerName: string;
    role: string;
    idNumber: string;
    address: string;
    contact: string;
    bankName: string;
    accountNumber: string;
    accountHolder: string;
    fileNameSaved: string;
    teamNames: string[];
    totalManDay: number;
    totalAmount: number;
    averageUnitPrice: number;
    billingAmount: number;
    averageBillingUnitPrice: number;
    entries: EnrichedWorkerRow[];
}

interface SiteSummary {
    key: string;
    constructionCompanyKey: string;
    constructionCompanyName: string;
    clientCompanyKey: string;
    clientCompanyId: string;
    clientCompanyName: string;
    siteId: string;
    siteName: string;
    responsibleTeamName: string;
    siteManagerName: string;
    activeDates: string[];
    workerCount: number;
    totalManDay: number;
    totalAmount: number;
    billingAmount: number;
    workers: WorkerSummary[];
}

interface ClientCompanySummary {
    key: string;
    constructionCompanyKey: string;
    constructionCompanyName: string;
    clientCompanyName: string;
    siteCount: number;
    workerCount: number;
    totalManDay: number;
    totalAmount: number;
    billingAmount: number;
    sites: SiteSummary[];
}

interface ConstructionCompanySummary {
    key: string;
    constructionCompanyName: string;
    clientCount: number;
    siteCount: number;
    workerCount: number;
    totalManDay: number;
    totalAmount: number;
    billingAmount: number;
    clients: ClientCompanySummary[];
}

type StatementPayType = 'direct' | 'delegate';
type ClientSiteDocumentView = 'labor' | 'progress' | 'transaction';
type WorkStatusFilter = 'all' | DailyReportWorkerRow['status'];
type ProcessStatusFilter = 'all' | ClientSiteLaborProcessStatus;

interface ClientSiteLaborEditDraft {
    manDay: string;
    unitPrice: string;
    workStatus: DailyReportWorkerRow['status'];
    allowance: string;
    deduction: string;
    processStatus: ClientSiteLaborProcessStatus;
    memo: string;
}

interface ClientSiteLaborManagementRow {
    key: string;
    worker: WorkerSummary;
    entry: EnrichedWorkerRow;
    adjustment?: ClientSiteLaborAdjustment;
    calculation: ClientSiteLaborCalculationResult;
}

interface SiteLaborStatementRow {
    key: string;
    workerId: string;
    workerName: string;
    idNumber: string;
    address: string;
    contact: string;
    teamNames: string[];
    payType: StatementPayType;
    bankName: string;
    accountNumber: string;
    accountHolder: string;
    days: number[];
    totalManDay: number;
    unitPrice: number;
    totalAmount: number;
}

interface SiteLaborStatementOptions {
    unitPriceOverride: number;
    defaultPayType: StatementPayType;
    workerPayTypes: Record<string, StatementPayType>;
    delegateBankName: string;
    delegateAccountHolder: string;
    delegateAccountNumber: string;
}

interface SiteLaborStatementViewOptions {
    showBankColumn: boolean;
    isSplitView: boolean;
    showBankUnderAddress: boolean;
    showTeamUnderName: boolean;
}

interface SiteLaborStatementPreviewData {
    siteName: string;
    constructionCompanyName: string;
    clientCompanyName: string;
    sourceTeamNames: string;
    responsibleTeamNames: string;
    rows: SiteLaborStatementRow[];
    totalManDay: number;
    totalAmount: number;
}

interface ProgressClaimPreviewData {
    claim: ProgressClaim;
    contract?: ProgressContract;
    itemRows: ProgressItemCalculatedRow[];
    allocationRows: ProgressAllocationCalculatedRow[];
    summary: ProgressClaimSummary;
}

const numberFormatter = new Intl.NumberFormat('ko-KR');
const DEFAULT_STATEMENT_LOGO_URL = '/icons/icon-192.png';

const toISODate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getDefaultYearMonth = (): string => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const getMonthRange = (yearMonth: string): { startDate: string; endDate: string } => {
    const [yearText, monthText] = yearMonth.split('-');
    const year = Number(yearText);
    const month = Number(monthText);

    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
        const now = new Date();
        return {
            startDate: toISODate(new Date(now.getFullYear(), now.getMonth(), 1)),
            endDate: toISODate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
        };
    }

    return {
        startDate: toISODate(new Date(year, month - 1, 1)),
        endDate: toISODate(new Date(year, month, 0)),
    };
};

const formatYearMonthLabel = (yearMonth: string): string => {
    const [yearText, monthText] = yearMonth.split('-');
    const year = Number(yearText);
    const month = Number(monthText);
    if (!Number.isInteger(year) || !Number.isInteger(month)) return yearMonth;
    return `${year}년 ${month}월`;
};

const formatYearMonthValue = (year: number, month: number): string =>
    `${year}-${String(month).padStart(2, '0')}`;

const getYearMonthParts = (yearMonth: string): { year: number; month: number } => {
    const [yearText, monthText] = yearMonth.split('-');
    const year = Number(yearText);
    const month = Number(monthText);

    if (Number.isInteger(year) && Number.isInteger(month) && month >= 1 && month <= 12) {
        return { year, month };
    }

    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
};

const getYearOptions = (): number[] => {
    const currentYear = new Date().getFullYear();
    const startYear = Math.min(2020, currentYear - 5);
    const endYear = currentYear + 2;
    return Array.from({ length: endYear - startYear + 1 }, (_, index) => startYear + index);
};

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => index + 1);

const text = (value: unknown, fallback = ''): string => {
    const next = String(value ?? '').trim();
    return next || fallback;
};

const normalizeKey = (value: unknown): string =>
    text(value).replace(/\s+/g, '').toLowerCase();

const buildIdentityKey = (prefix: string, id: unknown, name: unknown, fallback: string): string => {
    const idText = text(id);
    if (idText) return `${prefix}:id:${idText}`;
    const nameText = normalizeKey(name);
    if (nameText) return `${prefix}:name:${nameText}`;
    return `${prefix}:unknown:${fallback}`;
};

const safeNumber = (value: unknown): number => {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
};

const safePositiveMoney = (value: unknown): number => {
    const parsed = typeof value === 'number'
        ? value
        : Number(String(value ?? '').replace(/,/g, '').trim());
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
};

const calculateBillingAmount = (manDay: unknown, billingUnitPrice: unknown): number =>
    Math.round(Math.max(0, safeNumber(manDay)) * Math.max(0, safePositiveMoney(billingUnitPrice)));

const SUPPORT_CLIENT_SITE_BILLING_RATE_STORAGE_PREFIX = 'support-client-site-billing-rates';
const SUPPORT_TRANSACTION_STATEMENT_SOURCE = 'support-client-site' as const;
const PROGRESS_TRANSACTION_STATEMENT_SOURCE = 'progress-claims' as const;

const PROGRESS_STATUS_BADGE_CLASS: Record<ProgressClaimStatus, string> = {
    draft: 'border-slate-200 bg-slate-100 text-slate-700',
    review: 'border-amber-200 bg-amber-50 text-amber-700',
    confirmed: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    billed: 'border-blue-200 bg-blue-50 text-blue-700',
    paid: 'border-emerald-200 bg-emerald-50 text-emerald-700',
};

const PROGRESS_STATUS_LABELS: Record<ProgressClaimStatus, string> = {
    draft: '작성중',
    review: '검토중',
    confirmed: '확정',
    billed: '청구완료',
    paid: '입금완료',
};

const WORK_STATUS_OPTIONS: Array<{ value: WorkStatusFilter; label: string }> = [
    { value: 'all', label: '전체 근태' },
    { value: 'attendance', label: '출근' },
    { value: 'half', label: '반일' },
    { value: 'absent', label: '결근' },
];

const PROCESS_STATUS_OPTIONS: Array<{ value: ProcessStatusFilter; label: string }> = [
    { value: 'all', label: '전체 처리' },
    { value: 'draft', label: '미확정' },
    { value: 'review', label: '검토' },
    { value: 'confirmed', label: '확정' },
    { value: 'paid', label: '지급완료' },
];

const PROCESS_STATUS_LABELS: Record<ClientSiteLaborProcessStatus, string> = {
    draft: '미확정',
    review: '검토',
    confirmed: '확정',
    paid: '지급완료',
};

const PROCESS_STATUS_BADGE_CLASS: Record<ClientSiteLaborProcessStatus, string> = {
    draft: 'border-slate-200 bg-slate-100 text-slate-600',
    review: 'border-amber-200 bg-amber-50 text-amber-700',
    confirmed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    paid: 'border-blue-200 bg-blue-50 text-blue-700',
};

const createDefaultEditDraft = (): ClientSiteLaborEditDraft => ({
    manDay: '0',
    unitPrice: '0',
    workStatus: 'attendance',
    allowance: '0',
    deduction: '0',
    processStatus: 'draft',
    memo: '',
});

const getBillingRateStorageKey = (yearMonth: string): string =>
    `${SUPPORT_CLIENT_SITE_BILLING_RATE_STORAGE_PREFIX}:${yearMonth || 'unknown-month'}`;

const normalizeSupportKey = (value: unknown): string =>
    String(value ?? '').replace(/\s+/g, '').trim();

const normalizeSupportNameKey = (value: unknown): string =>
    String(value ?? '').replace(/\(.*?\)/g, '').replace(/\s+/g, '').trim();

const getSupportIdentityKey = (id: unknown, name: unknown, fallback: string): string =>
    normalizeSupportKey(id) || normalizeSupportNameKey(name) || fallback;

const getSupportClientSiteStatementKey = (site: SiteSummary): string => {
    const clientKey = getSupportIdentityKey(site.clientCompanyId, site.clientCompanyName, 'client:unknown');
    const siteKey = getSupportIdentityKey(site.siteId, site.siteName, 'site:unknown');
    return `site:${clientKey}::${siteKey}`;
};

const getProgressClaimSiteKey = (site: SiteSummary): string =>
    text(site.siteId) || normalizeKey(site.siteName) || normalizeKey(site.key) || 'unknown-site';

const getProgressClaimStatementKey = (site: SiteSummary, yearMonth: string): string =>
    `progress-claims::${yearMonth || 'unknown-month'}::site::${getProgressClaimSiteKey(site)}`;

const progressClaimMatchesSite = (claim: ProgressClaim, site: SiteSummary): boolean => {
    const siteId = text(site.siteId);
    const claimSiteIds = uniqueAccessTexts([claim.siteId, claim.siteSnapshot?.siteId]);
    if (siteId && claimSiteIds.includes(siteId)) return true;

    const siteNameKey = normalizeKey(site.siteName);
    const claimNameKeys = uniqueAccessTexts([claim.siteName, claim.siteSnapshot?.siteName]).map(normalizeKey);
    return Boolean(siteNameKey && claimNameKeys.includes(siteNameKey));
};

const progressContractMatchesSite = (contract: ProgressContract, site: SiteSummary): boolean => {
    const siteId = text(site.siteId);
    if (siteId && text(contract.siteId) === siteId) return true;
    return Boolean(normalizeKey(site.siteName) && normalizeKey(contract.siteName) === normalizeKey(site.siteName));
};

const buildProgressDailySummary = (
    site: SiteSummary,
    claim: ProgressClaim
): ProgressDailyManDaySummary => ({
    siteId: text(claim.siteId) || text(site.siteId),
    siteName: text(claim.siteName) || site.siteName,
    siteType: text(claim.siteSnapshot?.siteType),
    manDay: claim.confirmedSnapshot?.totalManDay ?? site.totalManDay,
    amount: claim.confirmedSnapshot?.currentAmount ?? site.billingAmount,
    rowCount: site.workers.reduce((sum, worker) => sum + worker.entries.length, 0),
});

const loadSupportClientBillingRates = (yearMonth: string): Record<string, string> => {
    if (typeof window === 'undefined') return {};
    try {
        const raw = window.localStorage.getItem(getBillingRateStorageKey(yearMonth));
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed as Record<string, string> : {};
    } catch (error) {
        console.warn('[ClientSiteLaborPage] billing rate load failed:', error);
        return {};
    }
};

const createSupportRateResolver = (supportRates: SupportRate[]) => {
    const bySiteId = new Map<string, number>();
    const bySiteName = new Map<string, number>();

    supportRates.forEach((rate) => {
        const defaultRate = safePositiveMoney(rate.defaultRate);
        if (!defaultRate) return;

        const siteId = normalizeKey(rate.siteId || rate.id);
        const siteName = normalizeKey(rate.siteName);
        if (siteId) bySiteId.set(siteId, defaultRate);
        if (siteName) bySiteName.set(siteName, defaultRate);
    });

    return (siteId?: unknown, siteName?: unknown): number => {
        const idKey = normalizeKey(siteId);
        if (idKey) {
            const rateById = bySiteId.get(idKey);
            if (rateById) return rateById;
        }

        const nameKey = normalizeKey(siteName);
        return nameKey ? bySiteName.get(nameKey) ?? 0 : 0;
    };
};

const buildClientWorkerPayTypesFromDefaults = (
    site?: SiteSummary,
    workerPayTypeDefaults: Record<string, StatementPayType> = loadLaborStatementDefaults().workerPayTypes
): Record<string, StatementPayType> => {
    if (!site) return {};

    return site.workers.reduce<Record<string, StatementPayType>>((acc, worker) => {
        const payType = getLaborStatementWorkerPayType(workerPayTypeDefaults, worker);
        if (payType) acc[worker.key] = payType;
        return acc;
    }, {});
};

const getDirectBillingUnitPrice = (row: DailyReportWorkerRow): number =>
    safePositiveMoney((row as any).billingUnitPrice) ||
    safePositiveMoney((row as any).claimUnitPrice) ||
    safePositiveMoney((row as any).clientUnitPrice) ||
    safePositiveMoney((row as any).invoiceUnitPrice);

const getDirectBillingAmount = (row: DailyReportWorkerRow): number =>
    safePositiveMoney((row as any).billingAmount) ||
    safePositiveMoney((row as any).claimAmount) ||
    safePositiveMoney((row as any).clientAmount) ||
    safePositiveMoney((row as any).invoiceAmount);

const getStoredRowBillingRate = (
    row: DailyReportWorkerRow,
    billingRates: Record<string, string>
): number => {
    const reportId = text(row.reportId);
    const workerIndex = row.workerIndex ?? '';
    const workerId = text(row.workerId);
    const siteId = text(row.siteId);

    if (!reportId || workerIndex === '' || !workerId || !siteId) return 0;

    const keyPrefix = `row:${reportId}::${workerIndex}::`;
    const keySuffix = `::${workerId}::${siteId}`;
    const matchedRates = Object.entries(billingRates)
        .filter(([key]) => key.startsWith(keyPrefix) && key.endsWith(keySuffix))
        .map(([, value]) => safePositiveMoney(value))
        .filter((value) => value > 0);

    return matchedRates[0] ?? 0;
};

const resolveBillingValues = (
    row: DailyReportWorkerRow,
    master: Worker | undefined,
    supportRateResolver: (siteId?: unknown, siteName?: unknown) => number,
    billingRates: Record<string, string>
): { billingUnitPrice: number; billingAmount: number } => {
    const storedRowRate = getStoredRowBillingRate(row, billingRates);
    const bulkRate = safePositiveMoney(billingRates.bulkRate);
    const directBillingUnitPrice = getDirectBillingUnitPrice(row);
    const configuredSiteRate = supportRateResolver(row.siteId, row.siteName);
    const fallbackUnitPrice = safePositiveMoney(row.unitPrice) || safePositiveMoney(master?.unitPrice);
    const billingUnitPrice = storedRowRate || bulkRate || directBillingUnitPrice || configuredSiteRate || fallbackUnitPrice;
    const directBillingAmount = getDirectBillingAmount(row);
    const shouldUseDirectAmount = directBillingAmount > 0 && !storedRowRate && !bulkRate;

    return {
        billingUnitPrice,
        billingAmount: shouldUseDirectAmount ? directBillingAmount : calculateBillingAmount(row.manDay, billingUnitPrice),
    };
};

const formatNumber = (value: number): string => numberFormatter.format(Math.round(value || 0));

const formatWon = (value: number): string => `${formatNumber(value)}원`;

const formatManDay = (value: number): string => {
    const rounded = Number((value || 0).toFixed(1));
    return rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1);
};

const formatStatementDayManDay = (value: number): string => {
    const rounded = Number((value || 0).toFixed(1));
    return rounded === 0 ? '' : formatManDay(value);
};

const formatFullIdNumber = (value?: string | null): string => {
    const raw = text(value);
    if (!raw) return '';
    const digits = raw.replace(/[^0-9]/g, '');
    if (digits.length === 13) return `${digits.slice(0, 6)}-${digits.slice(6)}`;
    return raw;
};

const getDayOfMonth = (dateText: string): number => {
    const match = text(dateText).match(/^\d{4}-\d{2}-(\d{2})/);
    if (match) return Number(match[1]);

    const parsed = new Date(dateText).getDate();
    return Number.isFinite(parsed) ? parsed : 0;
};

const maskIdNumber = (value: string): string => {
    const raw = text(value);
    const digits = raw.replace(/[^0-9]/g, '');
    if (digits.length >= 13) return `${digits.slice(0, 6)}-${digits.slice(6, 7)}******`;
    return raw || '-';
};

const uniqueTexts = (values: Array<string | undefined | null>): string[] => {
    const result: string[] = [];
    const seen = new Set<string>();
    values.forEach((value) => {
        const next = text(value);
        if (!next || seen.has(next)) return;
        seen.add(next);
        result.push(next);
    });
    return result;
};

const uniqueAccessTexts = (values: unknown[]): string[] =>
    Array.from(new Set(values.map((value) => text(value)).filter(Boolean)));

const getWorkerMap = (workers: Worker[]): Map<string, Worker> => {
    const map = new Map<string, Worker>();
    workers.forEach((worker) => {
        const keys = [
            text(worker.id),
            text(worker.legacyId),
            normalizeKey(worker.name),
        ].filter(Boolean);

        keys.forEach((key) => {
            if (!map.has(key)) map.set(key, worker);
        });
    });
    return map;
};

const enrichRows = (
    rows: DailyReportWorkerRow[],
    workers: Worker[],
    supportRates: SupportRate[],
    billingRates: Record<string, string>
): EnrichedWorkerRow[] => {
    const workerMap = getWorkerMap(workers);
    const supportRateResolver = createSupportRateResolver(supportRates);

    return rows
        .filter((row) => !row.isEmptyReport && safeNumber(row.manDay) > 0)
        .map((row, index) => {
            const master = workerMap.get(text(row.workerId)) || workerMap.get(normalizeKey(row.workerName));
            const constructionCompanyName = text(row.constructorCompanyName, '건설사 미지정');
            const constructionCompanyKey = buildIdentityKey(
                'construction-company',
                row.constructorCompanyId,
                constructionCompanyName,
                `construction-company-${index}`
            );
            const clientCompanyName = text(row.companyName, '발주사 미지정');
            const clientCompanyKey = buildIdentityKey(
                'client-company',
                row.companyId,
                clientCompanyName,
                `client-company-${index}`
            );
            const siteName = text(row.siteName, '현장 미지정');
            const siteIdentity = buildIdentityKey('site', row.siteId, siteName, `site-${index}`);
            const amount = safeNumber(row.amount) || safeNumber(row.manDay) * safeNumber(row.unitPrice);
            const { billingUnitPrice, billingAmount } = resolveBillingValues(row, master, supportRateResolver, billingRates);

            return {
                ...row,
                constructionCompanyKey,
                clientCompanyKey,
                siteKey: `${constructionCompanyKey}::${clientCompanyKey}::${siteIdentity}`,
                constructionCompanyName,
                clientCompanyName,
                siteName,
                workerName: text(row.workerName || row.name || master?.name, '이름 미지정'),
                role: text(row.role || master?.role),
                unitPrice: safeNumber(row.unitPrice || master?.unitPrice),
                manDay: safeNumber(row.manDay),
                amount,
                idNumber: text(master?.idNumber),
                address: text(master?.address),
                contact: text(master?.contact),
                bankName: text(master?.bankName),
                accountNumber: text(master?.accountNumber),
                accountHolder: text(master?.accountHolder || master?.name),
                fileNameSaved: text(master?.fileNameSaved),
                masterTeamName: text(master?.teamName),
                billingUnitPrice,
                billingAmount,
            };
        });
};

const buildSummaries = (rows: EnrichedWorkerRow[]): ConstructionCompanySummary[] => {
    const constructionCompanies = new Map<string, {
        key: string;
        constructionCompanyName: string;
        sites: Map<string, {
            key: string;
            constructionCompanyKey: string;
            constructionCompanyName: string;
            clientCompanyKey: string;
            clientCompanyId: string;
            clientCompanyName: string;
            siteId: string;
            siteName: string;
            responsibleTeamName: string;
            siteManagerName: string;
            workers: Map<string, WorkerSummary>;
            dates: Set<string>;
            totalManDay: number;
            totalAmount: number;
            billingAmount: number;
        }>;
    }>();

    rows.forEach((row) => {
        if (!constructionCompanies.has(row.constructionCompanyKey)) {
            constructionCompanies.set(row.constructionCompanyKey, {
                key: row.constructionCompanyKey,
                constructionCompanyName: row.constructionCompanyName,
                sites: new Map(),
            });
        }

        const constructionCompany = constructionCompanies.get(row.constructionCompanyKey);
        if (!constructionCompany) return;

        if (!constructionCompany.sites.has(row.siteKey)) {
            constructionCompany.sites.set(row.siteKey, {
                key: row.siteKey,
                constructionCompanyKey: row.constructionCompanyKey,
                constructionCompanyName: row.constructionCompanyName,
                clientCompanyKey: row.clientCompanyKey,
                clientCompanyId: text(row.companyId),
                clientCompanyName: row.clientCompanyName,
                siteId: text(row.siteId),
                siteName: row.siteName,
                responsibleTeamName: text(row.responsibleTeamName),
                siteManagerName: text(row.siteManagerName),
                workers: new Map(),
                dates: new Set(),
                totalManDay: 0,
                totalAmount: 0,
                billingAmount: 0,
            });
        }

        const site = constructionCompany.sites.get(row.siteKey);
        if (!site) return;

        const workerKey = buildIdentityKey('worker', row.workerId, row.workerName, row.siteKey);
        if (!site.workers.has(workerKey)) {
            site.workers.set(workerKey, {
                key: workerKey,
                workerId: text(row.workerId),
                workerName: row.workerName,
                role: text(row.role),
                idNumber: row.idNumber,
                address: row.address,
                contact: row.contact,
                bankName: row.bankName,
                accountNumber: row.accountNumber,
                accountHolder: row.accountHolder,
                fileNameSaved: row.fileNameSaved,
                teamNames: [],
                totalManDay: 0,
                totalAmount: 0,
                averageUnitPrice: 0,
                billingAmount: 0,
                averageBillingUnitPrice: 0,
                entries: [],
            });
        }

        const worker = site.workers.get(workerKey);
        if (!worker) return;

        worker.entries.push(row);
        worker.totalManDay += safeNumber(row.manDay);
        worker.totalAmount += safeNumber(row.amount);
        worker.billingAmount += safeNumber(row.billingAmount);
        worker.teamNames = uniqueTexts([
            ...worker.teamNames,
            row.workerTeamName,
            row.masterTeamName,
            row.teamName,
        ]);
        worker.averageUnitPrice = worker.totalManDay > 0
            ? Math.round(worker.totalAmount / worker.totalManDay)
            : safeNumber(row.unitPrice);
        worker.averageBillingUnitPrice = worker.totalManDay > 0
            ? Math.round(worker.billingAmount / worker.totalManDay)
            : safeNumber(row.billingUnitPrice);

        site.dates.add(text(row.date));
        site.totalManDay += safeNumber(row.manDay);
        site.totalAmount += safeNumber(row.amount);
        site.billingAmount += safeNumber(row.billingAmount);
    });

    return Array.from(constructionCompanies.values())
        .map((constructionCompany) => {
            const sites = Array.from(constructionCompany.sites.values())
                .map((site) => {
                    const workers = Array.from(site.workers.values())
                        .map((worker) => ({
                            ...worker,
                            entries: [...worker.entries].sort((a, b) => text(a.date).localeCompare(text(b.date))),
                        }))
                        .sort((a, b) => b.totalAmount - a.totalAmount || a.workerName.localeCompare(b.workerName, 'ko'));

                    return {
                        key: site.key,
                        constructionCompanyKey: site.constructionCompanyKey,
                        constructionCompanyName: site.constructionCompanyName,
                        clientCompanyKey: site.clientCompanyKey,
                        clientCompanyId: site.clientCompanyId,
                        clientCompanyName: site.clientCompanyName,
                        siteId: site.siteId,
                        siteName: site.siteName,
                        responsibleTeamName: site.responsibleTeamName,
                        siteManagerName: site.siteManagerName,
                        activeDates: Array.from(site.dates).filter(Boolean).sort(),
                        workerCount: workers.length,
                        totalManDay: site.totalManDay,
                        totalAmount: site.totalAmount,
                        billingAmount: site.billingAmount,
                        workers,
                    };
                })
                .sort((a, b) => b.totalAmount - a.totalAmount || a.siteName.localeCompare(b.siteName, 'ko'));

            const clientSiteGroups = new Map<string, SiteSummary[]>();
            sites.forEach((site) => {
                const groupedSites = clientSiteGroups.get(site.clientCompanyKey) ?? [];
                groupedSites.push(site);
                clientSiteGroups.set(site.clientCompanyKey, groupedSites);
            });
            const clients = Array.from(clientSiteGroups.entries())
                .map(([clientKey, clientSites]) => {
                    const clientWorkerKeys = new Set<string>();
                    clientSites.forEach((site) => site.workers.forEach((worker) => clientWorkerKeys.add(worker.key)));

                    return {
                        key: clientKey,
                        constructionCompanyKey: constructionCompany.key,
                        constructionCompanyName: constructionCompany.constructionCompanyName,
                        clientCompanyName: clientSites[0]?.clientCompanyName || '발주사 미지정',
                        siteCount: clientSites.length,
                        workerCount: clientWorkerKeys.size,
                        totalManDay: clientSites.reduce((sum, site) => sum + site.totalManDay, 0),
                        totalAmount: clientSites.reduce((sum, site) => sum + site.totalAmount, 0),
                        billingAmount: clientSites.reduce((sum, site) => sum + site.billingAmount, 0),
                        sites: clientSites,
                    };
                })
                .sort((a, b) => b.totalAmount - a.totalAmount || a.clientCompanyName.localeCompare(b.clientCompanyName, 'ko'));

            const workerKeys = new Set<string>();
            sites.forEach((site) => site.workers.forEach((worker) => workerKeys.add(worker.key)));

            return {
                key: constructionCompany.key,
                constructionCompanyName: constructionCompany.constructionCompanyName,
                clientCount: clients.length,
                siteCount: sites.length,
                workerCount: workerKeys.size,
                totalManDay: sites.reduce((sum, site) => sum + site.totalManDay, 0),
                totalAmount: sites.reduce((sum, site) => sum + site.totalAmount, 0),
                billingAmount: sites.reduce((sum, site) => sum + site.billingAmount, 0),
                clients,
            };
        })
        .sort((a, b) => b.totalAmount - a.totalAmount || a.constructionCompanyName.localeCompare(b.constructionCompanyName, 'ko'));
};

const getStatusLabel = (status: DailyReportWorkerRow['status']): string => {
    if (status === 'half') return '반일';
    if (status === 'absent') return '결근';
    return '출근';
};

const getTaxSummary = (grossAmount: number) => {
    const incomeTax = Math.floor(grossAmount * 0.03);
    const residentTax = Math.floor(incomeTax * 0.1);
    const deductionTotal = incomeTax + residentTax;
    return {
        incomeTax,
        residentTax,
        deductionTotal,
        netAmount: grossAmount - deductionTotal,
    };
};

const parseEditableNumber = (value: string): number => {
    const parsed = Number(String(value ?? '').replace(/,/g, '').trim());
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const getLaborAdjustmentIdForEntry = (yearMonth: string, entry: EnrichedWorkerRow): string =>
    buildClientSiteLaborAdjustmentId({
        yearMonth,
        reportId: text(entry.reportId),
        workerIndex: entry.workerIndex,
        workerId: text(entry.workerId),
    });

const buildEditDraftFromRow = (row: ClientSiteLaborManagementRow): ClientSiteLaborEditDraft => ({
    manDay: String(row.entry.manDay || 0),
    unitPrice: String(row.entry.unitPrice || 0),
    workStatus: row.entry.status || 'attendance',
    allowance: String(row.adjustment?.allowance ?? 0),
    deduction: String(row.adjustment?.deduction ?? 0),
    processStatus: row.adjustment?.status ?? 'draft',
    memo: row.adjustment?.memo ?? '',
});

const buildManagementRows = (
    site: SiteSummary | undefined,
    yearMonth: string,
    adjustments: Record<string, ClientSiteLaborAdjustment>,
    taxConfig: ClientSiteLaborTaxConfig,
    processStatusFilter: ProcessStatusFilter
): ClientSiteLaborManagementRow[] => {
    if (!site) return [];

    return site.workers
        .flatMap((worker) => worker.entries.map((entry) => {
            const key = getLaborAdjustmentIdForEntry(yearMonth, entry);
            const adjustment = adjustments[key];
            const calculation = calculateClientSiteLaborRow({
                manDay: entry.manDay,
                unitPrice: entry.unitPrice,
                allowance: adjustment?.allowance ?? 0,
                deduction: adjustment?.deduction ?? 0,
            }, taxConfig);

            return {
                key,
                worker,
                entry,
                adjustment,
                calculation,
            };
        }))
        .filter((row) => processStatusFilter === 'all' || (row.adjustment?.status ?? 'draft') === processStatusFilter)
        .sort((a, b) =>
            text(a.entry.date).localeCompare(text(b.entry.date)) ||
            a.entry.workerName.localeCompare(b.entry.workerName, 'ko') ||
            text(a.entry.teamName).localeCompare(text(b.entry.teamName), 'ko')
        );
};

const csvCell = (value: unknown): string => {
    const raw = String(value ?? '');
    return /[",\n\r]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
};

const downloadCsv = (filename: string, headers: string[], rows: unknown[][]): void => {
    const csv = [
        headers.map(csvCell).join(','),
        ...rows.map((row) => row.map(csvCell).join(',')),
    ].join('\r\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
};

const StatCard: React.FC<{
    icon: React.ReactNode;
    label: string;
    value: string;
    tone: string;
}> = ({ icon, label, value, tone }) => (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between gap-3">
            <div>
                <p className="text-xs font-semibold text-slate-500">{label}</p>
                <p className="mt-1 text-xl font-black text-slate-900">{value}</p>
            </div>
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tone}`}>
                {icon}
            </div>
        </div>
    </div>
);

const StatementBrand: React.FC = () => {
    const [imageSrc, setImageSrc] = useState(DEFAULT_STATEMENT_LOGO_URL);

    return (
        <div className="flex items-center gap-2 text-slate-900">
            <img
                src={imageSrc}
                alt="ERP logo"
                className="h-9 w-9 rounded-md object-contain"
                onError={() => setImageSrc(DEFAULT_STATEMENT_LOGO_URL)}
            />
            <span className="text-sm font-black">(주) 청연이엔지</span>
        </div>
    );
};

const buildSiteLaborStatementPreview = (
    site: SiteSummary,
    options: SiteLaborStatementOptions
): SiteLaborStatementPreviewData => {
    const rows = site.workers.map((worker) => {
        const days = Array.from({ length: MAX_DAY_COLUMNS }, () => 0);
        worker.entries.forEach((entry) => {
            const day = getDayOfMonth(entry.date);
            if (day >= 1 && day <= MAX_DAY_COLUMNS) {
                days[day - 1] += safeNumber(entry.manDay);
            }
        });
        const payType = options.workerPayTypes[worker.key] ?? options.defaultPayType;
        const unitPrice = options.unitPriceOverride > 0
            ? options.unitPriceOverride
            : worker.averageBillingUnitPrice;
        const totalAmount = Math.round(worker.totalManDay * unitPrice);
        const useDelegateAccount = payType === 'delegate';

        return {
            key: worker.key,
            workerId: worker.workerId || worker.key,
            workerName: worker.workerName || '이름 미상',
            idNumber: worker.idNumber,
            address: worker.address,
            contact: worker.contact,
            teamNames: worker.teamNames,
            payType,
            bankName: useDelegateAccount ? options.delegateBankName : worker.bankName,
            accountNumber: useDelegateAccount ? options.delegateAccountNumber : worker.accountNumber,
            accountHolder: useDelegateAccount ? options.delegateAccountHolder : worker.accountHolder,
            days,
            totalManDay: worker.totalManDay,
            unitPrice,
            totalAmount,
        };
    }).sort((a, b) => a.workerName.localeCompare(b.workerName, 'ko-KR'));

    return {
        siteName: site.siteName,
        constructionCompanyName: site.constructionCompanyName,
        clientCompanyName: site.clientCompanyName,
        sourceTeamNames: uniqueTexts(site.workers.flatMap((worker) => worker.teamNames)).join(', ') || '-',
        responsibleTeamNames: site.responsibleTeamName || '-',
        rows,
        totalManDay: rows.reduce((sum, row) => sum + row.totalManDay, 0),
        totalAmount: rows.reduce((sum, row) => sum + row.totalAmount, 0),
    };
};

const SiteLaborStatementPreview: React.FC<{
    targetTitle: string;
    preview: SiteLaborStatementPreviewData;
    yearMonth: string;
    viewOptions: SiteLaborStatementViewOptions;
}> = ({ targetTitle, preview, yearMonth, viewOptions }) => {
    const [yearString, monthString] = yearMonth.split('-');
    const year = Number(yearString);
    const month = Number(monthString);
    const statementPeriod = Number.isFinite(year)
        ? `${String(year % 100).padStart(2, '0')}년 ${month || ''}월분`
        : `${month || ''}월분`;
    const dayTotals = Array.from({ length: MAX_DAY_COLUMNS }, () => 0);
    preview.rows.forEach((row) => {
        row.days.forEach((value, index) => {
            dayTotals[index] += value;
        });
    });
    const averageUnitPrice = preview.totalManDay > 0 ? Math.round(preview.totalAmount / preview.totalManDay) : 0;
    const allDayLabels = Array.from({ length: MAX_DAY_COLUMNS }, (_, index) => index + 1);
    const primaryDayLabels = viewOptions.isSplitView ? DAY_LABELS_FIRST : allDayLabels;
    const getPaymentLabel = (payType: StatementPayType) => payType === 'delegate' ? '위임' : '직불';
    const formatBankInfo = (row: SiteLaborStatementRow) =>
        [row.bankName, row.accountHolder, row.accountNumber].filter(Boolean).join(' / ');
    const getAddressContent = (row: SiteLaborStatementRow) => {
        const parts = [row.address || '-'];
        if (viewOptions.showBankUnderAddress) {
            const bankInfo = formatBankInfo(row);
            parts.push(bankInfo ? `${bankInfo} (${getPaymentLabel(row.payType)})` : getPaymentLabel(row.payType));
        }
        return parts;
    };

    return (
        <div className="inline-block min-w-full border border-slate-200 bg-white p-10 shadow-2xl">
            <h2 className="mb-8 text-center text-3xl font-black tracking-widest text-slate-800 underline decoration-4 underline-offset-8 decoration-amber-500">
                노 무 비 지 급 명 세 서 ({statementPeriod})
            </h2>
            <div className="mb-4 flex items-end justify-between gap-4 px-2">
                <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-600">
                        현장명: <span className="border-b-2 border-slate-300 px-2 text-slate-900">{preview.siteName}</span>
                    </p>
                    <p className="text-sm font-bold text-slate-600">
                        정산 주체: <span className="border-b-2 border-slate-300 px-2 text-slate-900">{targetTitle}</span>
                    </p>
                    <p className="text-sm font-bold text-slate-600">
                        발주사: <span className="border-b-2 border-slate-300 px-2 text-slate-900">{preview.clientCompanyName}</span>
                    </p>
                    <p className="text-sm font-bold text-slate-600">
                        담당/작업팀: <span className="border-b-2 border-slate-300 px-2 text-slate-900">{preview.responsibleTeamNames} / {preview.sourceTeamNames}</span>
                    </p>
                </div>
                <StatementBrand />
            </div>
            <table className="w-full border-collapse border-2 border-slate-800 text-[10px]">
                <thead>
                <tr className="bg-slate-100 font-black text-slate-800">
                    <th className="w-10 border-2 border-slate-800 p-1.5" rowSpan={viewOptions.isSplitView ? 2 : 1}>NO</th>
                    <th className="min-w-[80px] border-2 border-slate-800 p-1.5" rowSpan={viewOptions.isSplitView ? 2 : 1}>성명</th>
                    <th className="min-w-[110px] border-2 border-slate-800 p-1.5">주민번호</th>
                    <th className="min-w-[150px] border-2 border-slate-800 p-1.5" rowSpan={viewOptions.isSplitView ? 2 : 1}>주 소</th>
                    {primaryDayLabels.map((day) => (
                        <th key={day} className="w-6 border-2 border-slate-800 bg-sky-50 text-sky-700">{String(day).padStart(2, '0')}</th>
                    ))}
                    {viewOptions.isSplitView && <th className="w-6 border-2 border-slate-800 bg-slate-50">X</th>}
                    <th className="w-16 border-2 border-slate-800 p-1.5" rowSpan={viewOptions.isSplitView ? 2 : 1}>출역</th>
                    <th className="w-24 border-2 border-slate-800 bg-emerald-100 p-1.5 text-emerald-950">청구단가</th>
                    {!viewOptions.isSplitView && (
                        <th className="w-28 border-2 border-slate-800 bg-emerald-100 p-1.5 text-emerald-950">청구금액</th>
                    )}
                    {viewOptions.showBankColumn && (
                        <th className="min-w-[170px] border-2 border-slate-800 bg-yellow-100 p-1.5 text-yellow-950" rowSpan={viewOptions.isSplitView ? 2 : 1}>계좌번호 / 지급구분</th>
                    )}
                </tr>
                {viewOptions.isSplitView && (
                    <tr className="bg-slate-100 font-black text-slate-800">
                        <th className="border-2 border-slate-800 p-1.5">전화번호</th>
                        {DAY_LABELS_SECOND.map((day) => (
                            <th key={day} className="w-6 border-2 border-slate-800 bg-rose-50 text-rose-700">{day}</th>
                        ))}
                        <th className="border-2 border-slate-800 bg-emerald-100 p-1.5 text-emerald-950">청구금액</th>
                    </tr>
                )}
                </thead>
                <tbody>
                {preview.rows.map((row, index) => (
                    <React.Fragment key={row.workerId || `${row.workerName}:${index}`}>
                        <tr className="font-bold">
                            <td rowSpan={viewOptions.isSplitView ? 2 : 1} className="border-2 border-slate-800 bg-slate-50 text-center">{index + 1}</td>
                            <td rowSpan={viewOptions.isSplitView ? 2 : 1} className="border-2 border-slate-800 text-center text-xs">
                                <div>{row.workerName}</div>
                                {viewOptions.showTeamUnderName && row.teamNames.length > 0 && (
                                    <div className="mt-1 text-[9px] font-semibold text-slate-500">{row.teamNames.join(', ')}</div>
                                )}
                            </td>
                            <td className="border-2 border-slate-800 text-center font-mono">{formatFullIdNumber(row.idNumber)}</td>
                            <td rowSpan={viewOptions.isSplitView ? 2 : 1} className={`border-2 border-slate-800 px-2 text-[9px] leading-tight ${row.payType === 'delegate' && viewOptions.showBankUnderAddress ? 'bg-yellow-100' : ''}`}>
                                {getAddressContent(row).map((line, lineIndex) => (
                                    <div key={`${row.key}:address:${lineIndex}`} className={lineIndex > 0 ? 'mt-1 border-t border-slate-300 pt-1 font-semibold text-yellow-800' : ''}>{line}</div>
                                ))}
                            </td>
                            {primaryDayLabels.map((day) => (
                                <td key={day} className="border-2 border-slate-800 bg-sky-50/30 text-center">{formatStatementDayManDay(row.days[day - 1])}</td>
                            ))}
                            {viewOptions.isSplitView && <td className="border-2 border-slate-800 bg-slate-50"></td>}
                            <td rowSpan={viewOptions.isSplitView ? 2 : 1} className="border-2 border-slate-800 bg-slate-50 text-center font-mono text-xs">{formatManDay(row.totalManDay)}</td>
                            <td className="border-2 border-slate-800 bg-emerald-50 px-2 text-right font-mono text-emerald-700">{formatNumber(row.unitPrice)}</td>
                            {!viewOptions.isSplitView && (
                                <td className="border-2 border-slate-800 bg-emerald-50 px-2 text-right font-mono text-emerald-800">{formatNumber(row.totalAmount)}</td>
                            )}
                            {viewOptions.showBankColumn && (
                                <td rowSpan={viewOptions.isSplitView ? 2 : 1} className={`border-2 border-slate-800 px-2 text-[9px] leading-tight ${row.payType === 'delegate' ? 'bg-yellow-100 text-yellow-900' : 'bg-white text-slate-700'}`}>
                                    <div className="font-black">{getPaymentLabel(row.payType)}</div>
                                    <div className="mt-1 font-semibold">{formatBankInfo(row) || '-'}</div>
                                </td>
                            )}
                        </tr>
                        {viewOptions.isSplitView && (
                            <tr className="font-bold">
                                <td className="border-2 border-slate-800 text-center font-mono text-slate-500">{row.contact || '-'}</td>
                                {DAY_LABELS_SECOND.map((day) => (
                                    <td key={day} className="border-2 border-slate-800 bg-rose-50/30 text-center">{formatStatementDayManDay(row.days[day - 1])}</td>
                                ))}
                                <td className="border-2 border-slate-800 bg-emerald-50 px-2 text-right font-mono text-emerald-800">{formatNumber(row.totalAmount)}</td>
                            </tr>
                        )}
                    </React.Fragment>
                ))}
                <tr className="bg-slate-200 text-xs font-black">
                    <td colSpan={4} className="border-2 border-slate-800 py-2 text-center">합 계</td>
                    {primaryDayLabels.map((day) => (
                        <td key={day} className="border-2 border-slate-800 text-center">{formatStatementDayManDay(dayTotals[day - 1])}</td>
                    ))}
                    {viewOptions.isSplitView && <td className="border-2 border-slate-800"></td>}
                    <td rowSpan={viewOptions.isSplitView ? 2 : 1} className="border-2 border-slate-800 text-center font-mono">{formatManDay(preview.totalManDay)}</td>
                    <td className="border-2 border-slate-800 bg-emerald-100 px-2 text-right font-mono text-emerald-800">{formatNumber(averageUnitPrice)}</td>
                    {!viewOptions.isSplitView && (
                        <td className="border-2 border-slate-800 bg-emerald-100 px-2 text-right font-mono text-emerald-900">{formatNumber(preview.totalAmount)}</td>
                    )}
                    {viewOptions.showBankColumn && <td rowSpan={viewOptions.isSplitView ? 2 : 1} className="border-2 border-slate-800 bg-yellow-100"></td>}
                </tr>
                {viewOptions.isSplitView && (
                    <tr className="bg-slate-200 text-xs font-black">
                        <td colSpan={4} className="border-2 border-slate-800 py-2 text-center">청구금액</td>
                        {DAY_LABELS_SECOND.map((day) => (
                            <td key={day} className="border-2 border-slate-800 text-center">{formatStatementDayManDay(dayTotals[day - 1])}</td>
                        ))}
                        <td className="border-2 border-slate-800 bg-emerald-100 px-2 text-right font-mono text-emerald-900">{formatNumber(preview.totalAmount)}</td>
                    </tr>
                )}
                </tbody>
            </table>
        </div>
    );
};

const LinkedTransactionStatementPreview: React.FC<{
    statement: Estimate;
}> = ({ statement }) => {
    const isRentalTransaction = statement.estimateMode === 'rental';
    const draft = useMemo<EstimateDraft & Partial<Estimate>>(() => ({
        ...getEmptyDraft('transaction'),
        ...statement,
        documentType: 'transaction',
        estimateMode: isRentalTransaction ? 'rental' : 'standard',
        title: statement.title || (isRentalTransaction ? '임대 거래명세서' : '거래명세서'),
        clientName: statement.clientName || '',
        clientCompany: statement.clientCompany || '',
        projectName: statement.projectName || '',
        issueDate: statement.issueDate || '',
        items: statement.items || [],
        discount: safeNumber(statement.discount),
        vatRate: safeNumber(statement.vatRate) || 10,
        includeVat: statement.includeVat !== false,
    }), [isRentalTransaction, statement]);

    const itemsWithCalc = useMemo(() => draft.items.map((item) => {
        if (isRentalTransaction) {
            const rentalAmount = calculateRentalLineAmount(item);
            const amount = rentalAmount || safeNumber(item.amount);
            return {
                ...item,
                amount,
                rentalAmount: amount,
                unitPrice: safeNumber(item.finalUnitPrice),
            };
        }

        const amount = safeNumber(item.amount) ||
            Math.round(safeNumber(item.finalUnitPrice) * safeNumber(item.quantity));
        return { ...item, amount };
    }), [draft.items, isRentalTransaction]);

    const { subtotal, tax, total } = useMemo(() => {
        const baseSubtotal = itemsWithCalc.reduce((sum, item) => sum + safeNumber(item.amount), 0);
        const taxableSubtotal = Math.max(0, baseSubtotal - safeNumber(draft.discount));
        const taxAmount = draft.includeVat
            ? Math.round(taxableSubtotal * ((safeNumber(draft.vatRate) || 10) / 100))
            : 0;
        return {
            subtotal: baseSubtotal,
            tax: taxAmount,
            total: taxableSubtotal + taxAmount,
        };
    }, [draft.discount, draft.includeVat, draft.vatRate, itemsWithCalc]);

    return (
        <div className={`inline-block ${isRentalTransaction ? 'min-w-[1240px]' : 'min-w-[1120px]'} bg-white p-8 shadow-sm`}>
            <TitleComponent text={isRentalTransaction ? '임 대 거 래 명 세 표' : '거 래 명 세 표'} logoUrl={LOGO_FALLBACK} />
            <InfoTableComponent draft={draft} isEdit={false} />
            <AmountBarComponent subtotal={subtotal} totalAmt={total} taxAmt={tax} isTransaction={true} draft={draft} />
            {isRentalTransaction ? (
                <RentalTransactionTable draft={draft} itemsWithCalc={itemsWithCalc} isEdit={false} />
            ) : (
                <TransactionTable draft={draft} itemsWithCalc={itemsWithCalc} isEdit={false} />
            )}
            <div className="mt-4 rounded-xl border-2 border-dashed border-slate-200 p-4 text-center text-sm font-black tracking-widest text-slate-400">
                위 금액을 정히 영수(청구)함
            </div>
        </div>
    );
};

const ProgressClaimInvoicePreview: React.FC<{
    data: ProgressClaimPreviewData;
    site: SiteSummary;
    yearMonth: string;
}> = ({ data, site, yearMonth }) => {
    const { claim, contract, itemRows, allocationRows, summary } = data;
    const statusClass = PROGRESS_STATUS_BADGE_CLASS[claim.status || 'draft'];

    return (
        <div className="inline-block min-w-[1180px] bg-white p-6 shadow-sm">
            <div className="grid gap-4 border-b border-slate-200 pb-4 md:grid-cols-[1fr_320px]">
                <div>
                    <div className="inline-flex rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-indigo-700">
                        Progress Claim Invoice
                    </div>
                    <h3 className="mt-3 text-2xl font-black text-slate-950">{yearMonth} 기성청구서</h3>
                    <div className="mt-3 grid gap-2 text-xs font-bold text-slate-600 sm:grid-cols-2">
                        <div><span className="text-slate-400">현장</span><div className="mt-1 text-slate-900">{site.siteName}</div></div>
                        <div><span className="text-slate-400">발주처</span><div className="mt-1 text-slate-900">{site.clientCompanyName || '-'}</div></div>
                        <div><span className="text-slate-400">건설사</span><div className="mt-1 text-slate-900">{site.constructionCompanyName || '-'}</div></div>
                        <div><span className="text-slate-400">계약</span><div className="mt-1 text-slate-900">{contract?.siteName || claim.siteName || '-'}</div></div>
                    </div>
                </div>
                <div className="rounded-lg border border-slate-900 bg-slate-950 p-4 text-white">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-black text-slate-300">청구금액</span>
                        <span className={`rounded-full border px-2 py-1 text-[11px] font-black ${statusClass}`}>
                            {PROGRESS_STATUS_LABELS[claim.status || 'draft']}
                        </span>
                    </div>
                    <div className="mt-3 text-right text-[26px] font-black leading-none">{formatProgressMoney(summary.billingAmount)}</div>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded border border-white/10 bg-white/5 px-3 py-2">
                            <span className="text-slate-300">금회기성</span>
                            <div className="mt-1 text-right font-black">{formatProgressMoney(summary.currentAmount)}</div>
                        </div>
                        <div className="rounded border border-white/10 bg-white/5 px-3 py-2">
                            <span className="text-slate-300">잔여기성</span>
                            <div className="mt-1 text-right font-black">{formatProgressMoney(summary.remainingAmount)}</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-5">
                {[
                    ['계약금액', summary.contractAmount],
                    ['전회기성', summary.previousAmount],
                    ['누계기성', summary.cumulativeAmount],
                    ['출력공수', `${formatProgressQuantity(summary.totalManDay)} 공수`],
                    ['스꾸미 단가', summary.sukumiUnitPrice],
                ].map(([label, value]) => (
                    <div key={String(label)} className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="text-[11px] font-black text-slate-500">{label}</div>
                        <div className="mt-1 text-right text-sm font-black text-slate-900">
                            {typeof value === 'number' ? formatProgressMoney(value) : value}
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[1080px] border-collapse text-xs">
                    <thead>
                        <tr className="bg-slate-900 text-white">
                            <th className="border border-slate-700 px-2 py-2" rowSpan={2}>분류</th>
                            <th className="border border-slate-700 px-2 py-2" rowSpan={2}>공종명</th>
                            <th className="border border-slate-700 px-2 py-2" rowSpan={2}>구분</th>
                            <th className="border border-slate-700 px-2 py-2" colSpan={3}>계약</th>
                            <th className="border border-slate-700 px-2 py-2" colSpan={2}>전회</th>
                            <th className="border border-slate-700 px-2 py-2" colSpan={2}>금회</th>
                            <th className="border border-slate-700 px-2 py-2" colSpan={2}>누계</th>
                            <th className="border border-slate-700 px-2 py-2" colSpan={2}>잔여</th>
                        </tr>
                        <tr className="bg-slate-100 text-slate-700">
                            <th className="border px-2 py-2">수량</th>
                            <th className="border px-2 py-2">단위</th>
                            <th className="border px-2 py-2">금액</th>
                            <th className="border px-2 py-2">수량</th>
                            <th className="border px-2 py-2">금액</th>
                            <th className="border px-2 py-2">수량</th>
                            <th className="border px-2 py-2">금액</th>
                            <th className="border px-2 py-2">수량</th>
                            <th className="border px-2 py-2">금액</th>
                            <th className="border px-2 py-2">수량</th>
                            <th className="border px-2 py-2">금액</th>
                        </tr>
                    </thead>
                    <tbody>
                        {itemRows.map((row) => (
                            <tr key={row.item.id}>
                                <td className="border bg-slate-50 px-2 py-1 text-center">{row.item.category || '-'}</td>
                                <td className="border bg-slate-50 px-2 py-1 font-bold">{row.item.workName || '-'}</td>
                                <td className="border bg-slate-50 px-2 py-1 text-center">{row.item.workType || '-'}</td>
                                <td className="border bg-blue-50 px-2 py-1 text-right">{formatProgressQuantity(row.item.contractQuantity)}</td>
                                <td className="border bg-blue-50 px-2 py-1 text-center">{row.item.unit || '-'}</td>
                                <td className="border bg-blue-50 px-2 py-1 text-right">{formatProgressMoney(row.contractAmount)}</td>
                                <td className="border bg-amber-50 px-2 py-1 text-right">{formatProgressQuantity(row.previousQuantity)}</td>
                                <td className="border bg-amber-50 px-2 py-1 text-right">{formatProgressMoney(row.previousAmount)}</td>
                                <td className="border bg-indigo-50 px-2 py-1 text-right">{formatProgressQuantity(row.currentQuantity)}</td>
                                <td className="border bg-indigo-50 px-2 py-1 text-right font-black text-indigo-700">{formatProgressMoney(row.currentAmount)}</td>
                                <td className="border bg-emerald-50 px-2 py-1 text-right">{formatProgressQuantity(row.cumulativeQuantity)}</td>
                                <td className="border bg-emerald-50 px-2 py-1 text-right">{formatProgressMoney(row.cumulativeAmount)}</td>
                                <td className="border bg-rose-50 px-2 py-1 text-right">{formatProgressQuantity(row.remainingQuantity)}</td>
                                <td className={`border bg-rose-50 px-2 py-1 text-right ${row.remainingAmount < 0 ? 'font-black text-rose-700' : 'text-rose-600'}`}>{formatProgressMoney(row.remainingAmount)}</td>
                            </tr>
                        ))}
                        {itemRows.length === 0 && (
                            <tr>
                                <td colSpan={14} className="border px-4 py-8 text-center font-bold text-slate-400">청구 항목이 없습니다.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1.2fr]">
                <table className="w-full border-collapse text-sm">
                    <tbody>
                        <tr><th className="border bg-slate-50 px-3 py-2 text-left">공급가액</th><td className="border px-3 py-2 text-right font-bold">{formatProgressMoney(summary.supplyAmount)}</td></tr>
                        <tr><th className="border bg-slate-50 px-3 py-2 text-left">부가세</th><td className="border px-3 py-2 text-right font-bold">{formatProgressMoney(summary.vatAmount)}</td></tr>
                        <tr><th className="border bg-slate-900 px-3 py-2 text-left text-white">청구금액</th><td className="border bg-slate-900 px-3 py-2 text-right text-lg font-black text-white">{formatProgressMoney(summary.billingAmount)}</td></tr>
                    </tbody>
                </table>
                <table className="w-full border-collapse text-sm">
                    <tbody>
                        <tr><th className="border bg-slate-50 px-3 py-2 text-left">팀포지션 금액</th><td className="border px-3 py-2 text-right font-bold">{formatProgressMoney(summary.teamPositionAmount)}</td></tr>
                        <tr><th className="border bg-slate-50 px-3 py-2 text-left">바이백 가능금액</th><td className="border px-3 py-2 text-right font-bold">{formatProgressMoney(summary.buybackPoolAmount)}</td></tr>
                        <tr><th className="border bg-slate-50 px-3 py-2 text-left">배분잔액</th><td className={`border px-3 py-2 text-right font-bold ${summary.allocationRemainAmount < 0 ? 'text-rose-700' : 'text-slate-900'}`}>{formatProgressMoney(summary.allocationRemainAmount)}</td></tr>
                    </tbody>
                </table>
            </div>

            {claim.showAllocationsOnInvoice && (
                <div className="mt-4">
                    <h4 className="mb-2 text-sm font-black text-slate-900">관계자 배분</h4>
                    <table className="w-full border-collapse text-xs">
                        <thead className="bg-slate-100">
                            <tr><th className="border px-2 py-2">관계자</th><th className="border px-2 py-2">방식</th><th className="border px-2 py-2">금액</th><th className="border px-2 py-2">메모</th></tr>
                        </thead>
                        <tbody>
                            {allocationRows.map((row) => (
                                <tr key={row.allocation.id}>
                                    <td className="border px-2 py-1">{row.allocation.targetName || '-'}</td>
                                    <td className="border px-2 py-1 text-center">{row.allocation.method}</td>
                                    <td className="border px-2 py-1 text-right font-bold">{formatProgressMoney(row.amount)}</td>
                                    <td className="border px-2 py-1">{row.allocation.memo || ''}</td>
                                </tr>
                            ))}
                            {allocationRows.length === 0 && (
                                <tr><td colSpan={4} className="border px-3 py-4 text-center font-bold text-slate-400">배분 내역이 없습니다.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};


const ClientSiteLaborPage: React.FC = () => {
    const companyAccessScope = useCompanyDataScope();
    const defaultYearMonth = useMemo(() => getDefaultYearMonth(), []);
    const [selectedYearMonth, setSelectedYearMonth] = useState(defaultYearMonth);
    const { startDate, endDate } = useMemo(
        () => getMonthRange(selectedYearMonth),
        [selectedYearMonth]
    );
    const selectedMonthLabel = useMemo(
        () => formatYearMonthLabel(selectedYearMonth),
        [selectedYearMonth]
    );
    const selectedYearMonthParts = useMemo(
        () => getYearMonthParts(selectedYearMonth),
        [selectedYearMonth]
    );
    const yearOptions = useMemo(() => getYearOptions(), []);
    const [rows, setRows] = useState<EnrichedWorkerRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedWorkStatus, setSelectedWorkStatus] = useState<WorkStatusFilter>('all');
    const [selectedProcessStatus, setSelectedProcessStatus] = useState<ProcessStatusFilter>('all');
    const [selectedConstructionCompanyKey, setSelectedConstructionCompanyKey] = useState('');
    const [selectedClientCompanyKey, setSelectedClientCompanyKey] = useState('');
    const [selectedSiteFilterKey, setSelectedSiteFilterKey] = useState('');
    const [activeSiteKey, setActiveSiteKey] = useState('');
    const [activeDocumentView, setActiveDocumentView] = useState<ClientSiteDocumentView>('labor');
    const [expandedClientKeys, setExpandedClientKeys] = useState<string[]>([]);
    const laborStatementDefaults = useMemo(() => loadLaborStatementDefaults(), [selectedYearMonth, activeSiteKey]);
    const showBankColumn = laborStatementDefaults.showBankColumn;
    const isSplitView = laborStatementDefaults.isSplitView;
    const showBankUnderAddress = laborStatementDefaults.showBankUnderAddress;
    const showTeamUnderName = laborStatementDefaults.showTeamUnderName;
    const appliedBulkUnitPrice = laborStatementDefaults.unitPriceOverride;
    const defaultPayType = laborStatementDefaults.defaultPayType;
    const delegateBankName = laborStatementDefaults.delegateBankName;
    const delegateAccountHolder = laborStatementDefaults.delegateAccountHolder;
    const delegateAccountNumber = laborStatementDefaults.delegateAccountNumber;
    const [transactionStatements, setTransactionStatements] = useState<Estimate[]>([]);
    const [transactionStatementsLoading, setTransactionStatementsLoading] = useState(false);
    const [transactionStatementError, setTransactionStatementError] = useState('');
    const [selectedTransactionStatementId, setSelectedTransactionStatementId] = useState('');
    const [progressContracts, setProgressContracts] = useState<ProgressContract[]>([]);
    const [progressClaims, setProgressClaims] = useState<ProgressClaim[]>([]);
    const [progressDocumentsLoading, setProgressDocumentsLoading] = useState(false);
    const [progressDocumentsError, setProgressDocumentsError] = useState('');
    const [payrollConfig, setPayrollConfig] = useState<PayrollConfig | null>(null);
    const [adjustments, setAdjustments] = useState<Record<string, ClientSiteLaborAdjustment>>({});
    const [adjustmentsLoading, setAdjustmentsLoading] = useState(false);
    const [adjustmentError, setAdjustmentError] = useState('');
    const [editingRowKey, setEditingRowKey] = useState('');
    const [editDraft, setEditDraft] = useState<ClientSiteLaborEditDraft>(() => createDefaultEditDraft());
    const [savingRowKey, setSavingRowKey] = useState('');
    const [deletingRowKey, setDeletingRowKey] = useState('');

    const loadData = useCallback(async () => {
        if (!startDate || !endDate || companyAccessScope.loading) return;
        if (companyAccessScope.mode !== 'all' && companyAccessScope.mode !== 'construction-company') {
            setRows([]);
            return;
        }
        setLoading(true);
        setError('');
        try {
            const canLoadInternalMasters = companyAccessScope.mode === 'all';
            const [workerRows, workers, supportRates] = await Promise.all([
                dailyReportService.getWorkerRows({
                    startDate,
                    endDate,
                    companyIds: companyAccessScope.mode === 'construction-company'
                        ? companyAccessScope.companyIds
                        : undefined,
                }),
                canLoadInternalMasters ? manpowerService.getWorkers() : Promise.resolve([] as Worker[]),
                canLoadInternalMasters ? supportRateService.getAllSiteRates().catch((supportRateError) => {
                    console.error('[ClientSiteLaborPage] support rate load failed:', supportRateError);
                    return [] as SupportRate[];
                }) : Promise.resolve([] as SupportRate[]),
            ]);
            const enrichedRows = enrichRows(
                workerRows,
                workers,
                supportRates,
                loadSupportClientBillingRates(selectedYearMonth)
            );
            setRows(enrichedRows.filter((row) => companyDataScopeMatchesLaborRow(companyAccessScope, row)));
        } catch (loadError) {
            console.error('[ClientSiteLaborPage] failed to load labor rows:', loadError);
            setError('출력 인원 정보를 불러오지 못했습니다.');
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate, selectedYearMonth, companyAccessScope]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const fetchTransactionStatements = useCallback(async () => {
        if (companyAccessScope.mode !== 'all') {
            setTransactionStatements([]);
            setTransactionStatementError('');
            return;
        }
        setTransactionStatementsLoading(true);
        setTransactionStatementError('');
        try {
            const statements = await estimateService.getEstimates();
            setTransactionStatements(statements.filter((statement) =>
                statement.documentType === 'transaction' &&
                (
                    statement.supportStatementSource === SUPPORT_TRANSACTION_STATEMENT_SOURCE ||
                    statement.supportStatementSource === PROGRESS_TRANSACTION_STATEMENT_SOURCE
                )
            ));
        } catch (statementLoadError) {
            console.error('[ClientSiteLaborPage] transaction statement load failed:', statementLoadError);
            setTransactionStatements([]);
            setTransactionStatementError('연동된 거래명세서를 불러오지 못했습니다.');
        } finally {
            setTransactionStatementsLoading(false);
        }
    }, [companyAccessScope.mode]);

    useEffect(() => {
        void fetchTransactionStatements();
    }, [fetchTransactionStatements]);

    const fetchProgressDocuments = useCallback(async () => {
        if (companyAccessScope.mode !== 'all') {
            setProgressContracts([]);
            setProgressClaims([]);
            setProgressDocumentsError('');
            return;
        }
        setProgressDocumentsLoading(true);
        setProgressDocumentsError('');
        try {
            const [contracts, claims] = await Promise.all([
                progressClaimService.getContracts(),
                progressClaimService.getClaims(),
            ]);
            setProgressContracts(contracts);
            setProgressClaims(claims);
        } catch (progressLoadError) {
            console.error('[ClientSiteLaborPage] progress claim documents load failed:', progressLoadError);
            setProgressContracts([]);
            setProgressClaims([]);
            setProgressDocumentsError('기성청구서 정보를 불러오지 못했습니다.');
        } finally {
            setProgressDocumentsLoading(false);
        }
    }, [companyAccessScope.mode]);

    useEffect(() => {
        void fetchProgressDocuments();
    }, [fetchProgressDocuments]);

    useEffect(() => {
        if (companyAccessScope.mode !== 'all') {
            setPayrollConfig(null);
            return undefined;
        }
        let mounted = true;
        payrollConfigService.getConfig()
            .then((config) => {
                if (mounted) setPayrollConfig(config);
            })
            .catch((configError) => {
                console.error('[ClientSiteLaborPage] payroll config load failed:', configError);
                if (mounted) setPayrollConfig(null);
            });

        return () => {
            mounted = false;
        };
    }, [companyAccessScope.mode]);

    const fetchAdjustments = useCallback(async () => {
        if (companyAccessScope.mode !== 'all') {
            setAdjustments({});
            setAdjustmentError('');
            return;
        }
        setAdjustmentsLoading(true);
        setAdjustmentError('');
        try {
            const rows = await clientSiteLaborAdjustmentService.getAdjustmentsByYearMonth(selectedYearMonth);
            setAdjustments(Object.fromEntries(rows.map((row) => [row.id, row])));
        } catch (adjustmentLoadError) {
            console.error('[ClientSiteLaborPage] adjustment load failed:', adjustmentLoadError);
            setAdjustments({});
            setAdjustmentError('수당/공제 조정값을 불러오지 못했습니다.');
        } finally {
            setAdjustmentsLoading(false);
        }
    }, [companyAccessScope.mode, selectedYearMonth]);

    useEffect(() => {
        void fetchAdjustments();
    }, [fetchAdjustments]);

    const constructionCompanyOptions = useMemo(() => {
        const map = new Map<string, string>();
        rows.forEach((row) => {
            if (!map.has(row.constructionCompanyKey)) {
                map.set(row.constructionCompanyKey, row.constructionCompanyName);
            }
        });
        return Array.from(map.entries())
            .map(([key, label]) => ({ key, label }))
            .sort((a, b) => a.label.localeCompare(b.label, 'ko'));
    }, [rows]);

    useEffect(() => {
        if (
            selectedConstructionCompanyKey &&
            !constructionCompanyOptions.some((option) => option.key === selectedConstructionCompanyKey)
        ) {
            setSelectedConstructionCompanyKey('');
            setSelectedClientCompanyKey('');
            setSelectedSiteFilterKey('');
            setActiveSiteKey('');
        }
    }, [selectedConstructionCompanyKey, constructionCompanyOptions]);

    const siteOptions = useMemo(() => {
        const map = new Map<string, { label: string; constructionCompanyKey: string; clientCompanyKey: string }>();
        rows.forEach((row) => {
            if (selectedConstructionCompanyKey && row.constructionCompanyKey !== selectedConstructionCompanyKey) return;
            if (selectedClientCompanyKey && row.clientCompanyKey !== selectedClientCompanyKey) return;
            if (!map.has(row.siteKey)) {
                map.set(row.siteKey, {
                    label: row.siteName,
                    constructionCompanyKey: row.constructionCompanyKey,
                    clientCompanyKey: row.clientCompanyKey,
                });
            }
        });
        return Array.from(map.entries())
            .map(([key, value]) => ({ key, ...value }))
            .sort((a, b) => a.label.localeCompare(b.label, 'ko'));
    }, [rows, selectedConstructionCompanyKey, selectedClientCompanyKey]);

    const clientCompanyOptions = useMemo(() => {
        const map = new Map<string, string>();
        rows.forEach((row) => {
            if (selectedConstructionCompanyKey && row.constructionCompanyKey !== selectedConstructionCompanyKey) return;
            if (!map.has(row.clientCompanyKey)) {
                map.set(row.clientCompanyKey, row.clientCompanyName);
            }
        });
        return Array.from(map.entries())
            .map(([key, label]) => ({ key, label }))
            .sort((a, b) => a.label.localeCompare(b.label, 'ko'));
    }, [rows, selectedConstructionCompanyKey]);

    useEffect(() => {
        if (selectedClientCompanyKey && !clientCompanyOptions.some((option) => option.key === selectedClientCompanyKey)) {
            setSelectedClientCompanyKey('');
        }
    }, [selectedClientCompanyKey, clientCompanyOptions]);

    useEffect(() => {
        if (selectedSiteFilterKey && !siteOptions.some((option) => option.key === selectedSiteFilterKey)) {
            setSelectedSiteFilterKey('');
        }
    }, [selectedSiteFilterKey, siteOptions]);

    const filteredRows = useMemo(() => {
        const normalizedTerm = normalizeKey(searchTerm);
        return rows.filter((row) => {
            if (selectedConstructionCompanyKey && row.constructionCompanyKey !== selectedConstructionCompanyKey) return false;
            if (selectedClientCompanyKey && row.clientCompanyKey !== selectedClientCompanyKey) return false;
            if (selectedSiteFilterKey && row.siteKey !== selectedSiteFilterKey) return false;
            if (selectedWorkStatus !== 'all' && row.status !== selectedWorkStatus) return false;
            if (selectedProcessStatus !== 'all') {
                const adjustment = adjustments[getLaborAdjustmentIdForEntry(selectedYearMonth, row)];
                if ((adjustment?.status ?? 'draft') !== selectedProcessStatus) return false;
            }
            if (!normalizedTerm) return true;

            const haystack = normalizeKey([
                row.constructionCompanyName,
                row.clientCompanyName,
                row.siteName,
                row.workerName,
                row.role,
                row.teamName,
                row.workerTeamName,
                row.responsibleTeamName,
                row.contact,
            ].join(' '));
            return haystack.includes(normalizedTerm);
        });
    }, [adjustments, rows, searchTerm, selectedConstructionCompanyKey, selectedClientCompanyKey, selectedProcessStatus, selectedSiteFilterKey, selectedWorkStatus, selectedYearMonth]);

    const constructionCompanySummaries = useMemo(() => buildSummaries(filteredRows), [filteredRows]);
    const expandedClientKeySet = useMemo(() => new Set(expandedClientKeys), [expandedClientKeys]);
    const visibleSites = useMemo(
        () => constructionCompanySummaries.flatMap((constructionCompany) =>
            constructionCompany.clients.flatMap((client) => client.sites)
        ),
        [constructionCompanySummaries]
    );
    const selectedSite = useMemo(
        () => activeSiteKey ? visibleSites.find((site) => site.key === activeSiteKey) : undefined,
        [activeSiteKey, visibleSites]
    );
    const selectedSiteSupportStatementKey = useMemo(
        () => selectedSite ? getSupportClientSiteStatementKey(selectedSite) : '',
        [selectedSite]
    );
    const selectedSiteProgressStatementKey = useMemo(
        () => selectedSite ? getProgressClaimStatementKey(selectedSite, selectedYearMonth) : '',
        [selectedSite, selectedYearMonth]
    );
    const linkedTransactionStatements = useMemo(
        () => {
            const selectedSiteNameKey = normalizeKey(selectedSite?.siteName);
            return transactionStatements
                .filter((statement) => {
                    if (statement.supportStatementYearMonth !== selectedYearMonth) return false;
                    if (
                        statement.supportStatementSource === SUPPORT_TRANSACTION_STATEMENT_SOURCE &&
                        statement.supportStatementKey === selectedSiteSupportStatementKey
                    ) return true;
                    const progressKeyMatches = statement.supportStatementKey === selectedSiteProgressStatementKey;
                    const progressTargetMatches = Boolean(
                        selectedSiteNameKey &&
                        [
                            statement.supportStatementTargetTitle,
                            statement.projectName,
                            statement.title,
                        ].some((value) => normalizeKey(value) === selectedSiteNameKey)
                    );
                    return (
                        statement.supportStatementSource === PROGRESS_TRANSACTION_STATEMENT_SOURCE &&
                        (progressKeyMatches || progressTargetMatches)
                    );
                })
                .sort((a, b) => {
                    const sourceOrder = (a.supportStatementSource === PROGRESS_TRANSACTION_STATEMENT_SOURCE ? 0 : 1) -
                        (b.supportStatementSource === PROGRESS_TRANSACTION_STATEMENT_SOURCE ? 0 : 1);
                    if (sourceOrder !== 0) return sourceOrder;
                    const modeOrder = (a.estimateMode === 'rental' ? 1 : 0) - (b.estimateMode === 'rental' ? 1 : 0);
                    if (modeOrder !== 0) return modeOrder;
                    return String(b.issueDate || '').localeCompare(String(a.issueDate || '')) ||
                        String(a.projectName || a.title || '').localeCompare(String(b.projectName || b.title || ''), 'ko');
                });
        },
        [selectedSite?.siteName, selectedSiteProgressStatementKey, selectedSiteSupportStatementKey, selectedYearMonth, transactionStatements]
    );
    const selectedTransactionStatement = useMemo(
        () => linkedTransactionStatements.find((statement) => statement.id === selectedTransactionStatementId) ??
            linkedTransactionStatements[0],
        [linkedTransactionStatements, selectedTransactionStatementId]
    );
    const standardTransactionCount = linkedTransactionStatements.filter((statement) => statement.estimateMode !== 'rental').length;
    const rentalTransactionCount = linkedTransactionStatements.filter((statement) => statement.estimateMode === 'rental').length;
    const progressTransactionCount = linkedTransactionStatements.filter((statement) =>
        statement.supportStatementSource === PROGRESS_TRANSACTION_STATEMENT_SOURCE
    ).length;
    const selectedSiteProgressClaim = useMemo(
        () => selectedSite
            ? progressClaims.find((claim) =>
                claim.yearMonth === selectedYearMonth &&
                progressClaimMatchesSite(claim, selectedSite)
            )
            : undefined,
        [progressClaims, selectedSite, selectedYearMonth]
    );
    const selectedSiteProgressContract = useMemo(
        () => selectedSite ? progressContracts.find((contract) => progressContractMatchesSite(contract, selectedSite)) : undefined,
        [progressContracts, selectedSite]
    );
    const selectedSiteProgressPreview = useMemo<ProgressClaimPreviewData | null>(() => {
        if (!selectedSite || !selectedSiteProgressClaim) return null;
        const computed = calculateProgressClaimSummary(
            selectedSiteProgressContract,
            progressClaims,
            selectedSiteProgressClaim,
            buildProgressDailySummary(selectedSite, selectedSiteProgressClaim),
            selectedYearMonth
        );
        return {
            claim: selectedSiteProgressClaim,
            contract: selectedSiteProgressContract,
            ...computed,
        };
    }, [progressClaims, selectedSite, selectedSiteProgressClaim, selectedSiteProgressContract, selectedYearMonth]);
    const selectedSiteProgressInvoiceLink = useMemo(() => {
        if (!selectedSite) return '/payroll/progress-claims?tab=invoice';
        const params = new URLSearchParams({
            tab: 'invoice',
            month: selectedYearMonth,
        });
        if (selectedSite.siteId) params.set('siteId', selectedSite.siteId);
        return `/payroll/progress-claims?${params.toString()}`;
    }, [selectedSite, selectedYearMonth]);
    const selectedSiteDateRange = useMemo(() => {
        if (!selectedSite || selectedSite.activeDates.length === 0) return '-';
        return `${selectedSite.activeDates[0]}${selectedSite.activeDates.length > 1 ? ` ~ ${selectedSite.activeDates[selectedSite.activeDates.length - 1]}` : ''}`;
    }, [selectedSite]);
    const activeDocumentMeta = useMemo(() => {
        if (activeDocumentView === 'progress') {
            return {
                eyebrow: '기성청구 보기',
                title: '기성청구서',
                emptyTitle: '기성청구를 볼 현장을 선택하세요',
                emptyDescription: '좌측 현장의 기성청구 버튼을 누르면 해당 월 기성청구서가 표시됩니다.',
            };
        }
        if (activeDocumentView === 'transaction') {
            return {
                eyebrow: '거래명세서 보기',
                title: '거래명세서',
                emptyTitle: '거래명세서를 볼 현장을 선택하세요',
                emptyDescription: '좌측 현장의 거래명세 버튼을 누르면 연결된 거래명세서가 표시됩니다.',
            };
        }
        return {
            eyebrow: '노임명세서 보기',
            title: '노임명세서',
            emptyTitle: '노임명세를 볼 현장을 선택하세요',
            emptyDescription: '좌측 현장의 노임명세 버튼을 누르면 작업자 노임명세서가 표시됩니다.',
        };
    }, [activeDocumentView]);
    const workerPayTypes = useMemo(
        () => buildClientWorkerPayTypesFromDefaults(selectedSite, laborStatementDefaults.workerPayTypes),
        [selectedSite, laborStatementDefaults.workerPayTypes]
    );
    const statementYearMonth = selectedYearMonth;
    const statementOptions = useMemo<SiteLaborStatementOptions>(() => ({
        unitPriceOverride: appliedBulkUnitPrice,
        defaultPayType,
        workerPayTypes,
        delegateBankName,
        delegateAccountHolder,
        delegateAccountNumber,
    }), [appliedBulkUnitPrice, defaultPayType, workerPayTypes, delegateBankName, delegateAccountHolder, delegateAccountNumber]);
    const statementViewOptions = useMemo<SiteLaborStatementViewOptions>(() => ({
        showBankColumn,
        isSplitView,
        showBankUnderAddress,
        showTeamUnderName,
    }), [showBankColumn, isSplitView, showBankUnderAddress, showTeamUnderName]);
    const selectedSiteLaborPreview = useMemo(
        () => selectedSite ? buildSiteLaborStatementPreview(selectedSite, statementOptions) : null,
        [selectedSite, statementOptions]
    );
    const laborTaxConfig = useMemo<ClientSiteLaborTaxConfig>(() => ({
        incomeTaxRate: payrollConfig?.incomeTaxRate ?? DEFAULT_CLIENT_SITE_LABOR_TAX_CONFIG.incomeTaxRate,
        residentTaxRate: payrollConfig?.residentTaxRate ?? DEFAULT_CLIENT_SITE_LABOR_TAX_CONFIG.residentTaxRate,
    }), [payrollConfig]);
    const filteredLaborTotals = useMemo(() => calculateClientSiteLaborTotals(
        filteredRows.map((row) => {
            const adjustment = adjustments[getLaborAdjustmentIdForEntry(selectedYearMonth, row)];
            return {
                workerKey: buildIdentityKey('worker', row.workerId, row.workerName, 'worker'),
                manDay: row.manDay,
                unitPrice: row.unitPrice,
                allowance: adjustment?.allowance ?? 0,
                deduction: adjustment?.deduction ?? 0,
            };
        }),
        laborTaxConfig
    ), [adjustments, filteredRows, laborTaxConfig, selectedYearMonth]);
    const selectedSiteManagementRows = useMemo(
        () => buildManagementRows(selectedSite, selectedYearMonth, adjustments, laborTaxConfig, selectedProcessStatus),
        [adjustments, laborTaxConfig, selectedProcessStatus, selectedSite, selectedYearMonth]
    );
    const selectedSiteLaborTotals = useMemo(() => calculateClientSiteLaborTotals(
        selectedSiteManagementRows.map((row) => ({
            workerKey: row.worker.key,
            manDay: row.calculation.manDay,
            unitPrice: row.calculation.unitPrice,
            allowance: row.calculation.allowance,
            deduction: row.calculation.manualDeduction,
        })),
        laborTaxConfig
    ), [laborTaxConfig, selectedSiteManagementRows]);

    const totalSiteCount = visibleSites.length;
    const totalClientCount = constructionCompanySummaries.reduce((sum, constructionCompany) => sum + constructionCompany.clientCount, 0);
    const totalWorkerCount = useMemo(() => {
        const workers = new Set<string>();
        filteredRows.forEach((row) => workers.add(buildIdentityKey('worker', row.workerId, row.workerName, 'worker')));
        return workers.size;
    }, [filteredRows]);
    const totalManDay = filteredRows.reduce((sum, row) => sum + safeNumber(row.manDay), 0);
    useEffect(() => {
        const visibleClientKeys = new Set(
            constructionCompanySummaries.flatMap((constructionCompany) =>
                constructionCompany.clients.map((client) => client.key)
            )
        );
        setExpandedClientKeys((prev) => {
            const next = prev.filter((key) => visibleClientKeys.has(key)).slice(0, 1);
            return next.length === prev.length ? prev : next;
        });
    }, [constructionCompanySummaries]);

    useEffect(() => {
        if (activeSiteKey && !visibleSites.some((site) => site.key === activeSiteKey)) {
            setActiveSiteKey('');
        }
    }, [activeSiteKey, visibleSites]);

    useEffect(() => {
        setSelectedTransactionStatementId('');
    }, [selectedSiteProgressStatementKey, selectedSiteSupportStatementKey, selectedYearMonth]);

    const expandClient = useCallback((clientKey: string) => {
        setExpandedClientKeys((prev) => prev[0] === clientKey ? prev : [clientKey]);
    }, []);

    const toggleClient = useCallback((clientKey: string) => {
        setExpandedClientKeys((prev) => prev[0] === clientKey ? [] : [clientKey]);
    }, []);

    const selectSite = (site: SiteSummary, documentView: ClientSiteDocumentView = 'labor') => {
        expandClient(site.clientCompanyKey);
        setActiveSiteKey(site.key);
        setActiveDocumentView(documentView);
    };

    useEffect(() => {
        setEditingRowKey('');
        setEditDraft(createDefaultEditDraft());
    }, [activeSiteKey, selectedYearMonth]);

    const startEditRow = (row: ClientSiteLaborManagementRow) => {
        setAdjustmentError('');
        setEditingRowKey(row.key);
        setEditDraft(buildEditDraftFromRow(row));
    };

    const cancelEditRow = () => {
        setEditingRowKey('');
        setEditDraft(createDefaultEditDraft());
    };

    const saveManagementRow = async (row: ClientSiteLaborManagementRow) => {
        const manDay = parseEditableNumber(editDraft.manDay);
        const unitPrice = parseEditableNumber(editDraft.unitPrice);
        const allowance = parseEditableNumber(editDraft.allowance);
        const deduction = parseEditableNumber(editDraft.deduction);
        const memo = editDraft.memo.trim();

        if (!row.entry.reportId || typeof row.entry.workerIndex !== 'number') {
            setAdjustmentError('원본 출력일보 행을 식별할 수 없어 저장할 수 없습니다.');
            return;
        }
        if (manDay > 31) {
            setAdjustmentError('공수는 한 달 기준 31을 초과할 수 없습니다.');
            return;
        }
        if (unitPrice <= 0 && manDay > 0) {
            setAdjustmentError('공수가 있으면 단가는 0보다 커야 합니다.');
            return;
        }

        setSavingRowKey(row.key);
        setAdjustmentError('');
        try {
            await dailyReportService.updateWorkerInReport(
                row.entry.reportId,
                row.entry.workerId,
                {
                    manDay,
                    unitPrice,
                    status: editDraft.workStatus,
                },
                row.entry.workerIndex
            );

            const hasAdjustment = allowance > 0 || deduction > 0 || editDraft.processStatus !== 'draft' || Boolean(memo);
            if (hasAdjustment) {
                const saved = await clientSiteLaborAdjustmentService.saveAdjustment({
                    id: row.key,
                    yearMonth: selectedYearMonth,
                    reportId: row.entry.reportId,
                    workerIndex: row.entry.workerIndex,
                    workerId: row.entry.workerId,
                    workerName: row.entry.workerName,
                    siteId: row.entry.siteId,
                    siteName: row.entry.siteName,
                    constructionCompanyName: row.entry.constructionCompanyName,
                    clientCompanyName: row.entry.clientCompanyName,
                    allowance,
                    deduction,
                    status: editDraft.processStatus,
                    memo,
                });
                setAdjustments((prev) => ({ ...prev, [saved.id]: saved }));
            } else if (row.adjustment) {
                await clientSiteLaborAdjustmentService.deleteAdjustment(row.key);
                setAdjustments((prev) => {
                    const next = { ...prev };
                    delete next[row.key];
                    return next;
                });
            }

            setEditingRowKey('');
            setEditDraft(createDefaultEditDraft());
            await loadData();
        } catch (saveError) {
            console.error('[ClientSiteLaborPage] row save failed:', saveError);
            setAdjustmentError('행 저장에 실패했습니다. 권한 또는 원본 일보 상태를 확인하세요.');
        } finally {
            setSavingRowKey('');
        }
    };

    const deleteManagementRow = async (row: ClientSiteLaborManagementRow) => {
        if (!row.entry.reportId || typeof row.entry.workerIndex !== 'number') {
            setAdjustmentError('원본 출력일보 행을 식별할 수 없어 삭제할 수 없습니다.');
            return;
        }
        const confirmed = window.confirm(`${row.entry.date} ${row.entry.workerName} 행을 원본 출력일보에서 삭제할까요?`);
        if (!confirmed) return;

        setDeletingRowKey(row.key);
        setAdjustmentError('');
        try {
            await dailyReportService.removeWorkerFromReport(row.entry.reportId, row.entry.workerId, row.entry.workerIndex);
            if (row.adjustment) {
                await clientSiteLaborAdjustmentService.deleteAdjustment(row.key);
                setAdjustments((prev) => {
                    const next = { ...prev };
                    delete next[row.key];
                    return next;
                });
            }
            if (editingRowKey === row.key) cancelEditRow();
            await loadData();
        } catch (deleteError) {
            console.error('[ClientSiteLaborPage] row delete failed:', deleteError);
            setAdjustmentError('행 삭제에 실패했습니다. 권한 또는 원본 일보 상태를 확인하세요.');
        } finally {
            setDeletingRowKey('');
        }
    };

    const exportCsv = () => {
        const exportRows = selectedSiteManagementRows.length > 0
            ? selectedSiteManagementRows.map((row) => ({
                entry: row.entry,
                adjustment: row.adjustment,
                calculation: row.calculation,
            }))
            : filteredRows.map((entry) => {
                const adjustment = adjustments[getLaborAdjustmentIdForEntry(selectedYearMonth, entry)];
                return {
                    entry,
                    adjustment,
                    calculation: calculateClientSiteLaborRow({
                        manDay: entry.manDay,
                        unitPrice: entry.unitPrice,
                        allowance: adjustment?.allowance ?? 0,
                        deduction: adjustment?.deduction ?? 0,
                    }, laborTaxConfig),
                };
            });

        if (exportRows.length === 0) return;

        downloadCsv(
            `client-site-labor-${selectedYearMonth}${selectedSite ? `-${selectedSite.siteName}` : ''}.csv`,
            ['월', '일자', '건설사', '발주사', '현장', '팀', '작업자', '직책', '근태', '공수', '단가', '기본급', '수당', '세전총액', '소득세', '지방소득세', '기타공제', '총공제', '실지급', '처리상태', '비고'],
            exportRows.map(({ entry, adjustment, calculation }) => [
                selectedYearMonth,
                entry.date,
                entry.constructionCompanyName,
                entry.clientCompanyName,
                entry.siteName,
                entry.teamName || entry.workerTeamName || '',
                entry.workerName,
                entry.role || '',
                getStatusLabel(entry.status),
                formatManDay(calculation.manDay),
                calculation.unitPrice,
                calculation.baseAmount,
                calculation.allowance,
                calculation.grossAmount,
                calculation.incomeTax,
                calculation.residentTax,
                calculation.manualDeduction,
                calculation.totalDeduction,
                calculation.netAmount,
                PROCESS_STATUS_LABELS[adjustment?.status ?? 'draft'],
                adjustment?.memo ?? '',
            ])
        );
    };

    const pageLoading = loading || companyAccessScope.loading;
    const refreshLoading = pageLoading || transactionStatementsLoading || progressDocumentsLoading || adjustmentsLoading;

    return (
        <div className="flex h-full flex-col bg-slate-100 text-slate-900">
            <header className="border-b border-slate-200 bg-white px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                            <FileText size={23} strokeWidth={2.4} />
                        </div>
                        <div className="min-w-0">
                            <h1 className="truncate text-2xl font-black tracking-normal text-slate-900">건설사별 발주사/현장 출력/노임명세서</h1>
                            <p className="mt-1 text-sm font-medium text-slate-500">일보 기준 출력 인원과 노임 합계</p>
                        </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                void loadData();
                                void fetchAdjustments();
                                void fetchTransactionStatements();
                                void fetchProgressDocuments();
                            }}
                            disabled={refreshLoading}
                            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {refreshLoading ? <Loader2 size={17} className="animate-spin" /> : <RefreshCw size={17} />}
                            새로고침
                        </button>
                        <button
                            type="button"
                            onClick={exportCsv}
                            disabled={filteredRows.length === 0}
                            className="inline-flex h-10 items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-600 px-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <Download size={17} />
                            CSV
                        </button>
                    </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[220px_minmax(130px,1fr)_minmax(130px,1fr)_minmax(130px,1fr)_120px_120px_minmax(210px,1.1fr)]">
                    <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
                        년/월
                        <span className="grid grid-cols-[1fr_88px] gap-2">
                            <select
                                aria-label="년도"
                                value={selectedYearMonthParts.year}
                                onChange={(event) => {
                                    const nextYear = Number(event.target.value);
                                    setSelectedYearMonth(formatYearMonthValue(nextYear, selectedYearMonthParts.month));
                                }}
                                className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                            >
                                {yearOptions.map((year) => (
                                    <option key={year} value={year}>{year}년</option>
                                ))}
                            </select>
                            <select
                                aria-label="월"
                                value={selectedYearMonthParts.month}
                                onChange={(event) => {
                                    const nextMonth = Number(event.target.value);
                                    setSelectedYearMonth(formatYearMonthValue(selectedYearMonthParts.year, nextMonth));
                                }}
                                className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                            >
                                {MONTH_OPTIONS.map((month) => (
                                    <option key={month} value={month}>{month}월</option>
                                ))}
                            </select>
                        </span>
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
                        건설사
                        <select
                            value={selectedConstructionCompanyKey}
                            onChange={(event) => {
                                setSelectedConstructionCompanyKey(event.target.value);
                                setSelectedClientCompanyKey('');
                                setSelectedSiteFilterKey('');
                                setActiveSiteKey('');
                            }}
                            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                        >
                            <option value="">전체 건설사</option>
                            {constructionCompanyOptions.map((option) => (
                                <option key={option.key} value={option.key}>{option.label}</option>
                            ))}
                        </select>
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
                        발주사
                        <select
                            value={selectedClientCompanyKey}
                            onChange={(event) => {
                                setSelectedClientCompanyKey(event.target.value);
                                setSelectedSiteFilterKey('');
                                setActiveSiteKey('');
                            }}
                            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                        >
                            <option value="">전체 발주사</option>
                            {clientCompanyOptions.map((option) => (
                                <option key={option.key} value={option.key}>{option.label}</option>
                            ))}
                        </select>
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
                        현장
                        <select
                            value={selectedSiteFilterKey}
                            onChange={(event) => {
                                const nextSiteKey = event.target.value;
                                setSelectedSiteFilterKey(nextSiteKey);
                                setActiveSiteKey(nextSiteKey);
                                const nextSite = siteOptions.find((option) => option.key === nextSiteKey);
                                if (nextSite) expandClient(nextSite.clientCompanyKey);
                            }}
                            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                        >
                            <option value="">전체 현장</option>
                            {siteOptions.map((option) => (
                                <option key={option.key} value={option.key}>{option.label}</option>
                            ))}
                        </select>
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
                        근태
                        <select
                            value={selectedWorkStatus}
                            onChange={(event) => setSelectedWorkStatus(event.target.value as WorkStatusFilter)}
                            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                        >
                            {WORK_STATUS_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
                        처리
                        <select
                            value={selectedProcessStatus}
                            onChange={(event) => setSelectedProcessStatus(event.target.value as ProcessStatusFilter)}
                            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                        >
                            {PROCESS_STATUS_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
                        검색
                        <span className="relative">
                            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="search"
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                                placeholder="건설사, 발주사, 현장, 작업자, 팀"
                                className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                            />
                        </span>
                    </label>
                </div>
            </header>

            <main className="flex-1 overflow-auto p-4">
                <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 2xl:grid-cols-8">
                    <StatCard icon={<Building2 size={20} />} label="건설사" value={`${constructionCompanySummaries.length}`} tone="bg-emerald-100 text-emerald-700" />
                    <StatCard icon={<Building2 size={20} />} label="발주사" value={`${totalClientCount}`} tone="bg-teal-100 text-teal-700" />
                    <StatCard icon={<MapPin size={20} />} label="현장" value={`${totalSiteCount}`} tone="bg-sky-100 text-sky-700" />
                    <StatCard icon={<UsersRound size={20} />} label="출력 인원" value={`${totalWorkerCount}`} tone="bg-indigo-100 text-indigo-700" />
                    <StatCard icon={<CalendarDays size={20} />} label="총 공수" value={formatManDay(totalManDay)} tone="bg-amber-100 text-amber-700" />
                    <StatCard icon={<WalletCards size={20} />} label="세전 노임" value={formatWon(filteredLaborTotals.grossAmount)} tone="bg-rose-100 text-rose-700" />
                    <StatCard icon={<WalletCards size={20} />} label="수당/공제" value={`${formatWon(filteredLaborTotals.allowance)} / ${formatWon(filteredLaborTotals.totalDeduction)}`} tone="bg-violet-100 text-violet-700" />
                    <StatCard icon={<WalletCards size={20} />} label="실지급" value={formatWon(filteredLaborTotals.netAmount)} tone="bg-blue-100 text-blue-700" />
                </section>

                {error && (
                    <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                        {error}
                    </div>
                )}
                {adjustmentError && (
                    <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
                        {adjustmentError}
                    </div>
                )}

                <section className="mt-4 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                            <p className="text-xs font-black uppercase tracking-wide text-slate-400">현재 작업</p>
                            <p className="mt-1 truncate text-base font-black text-slate-900">
                                {selectedSite ? selectedSite.siteName : '현장을 선택하세요'}
                            </p>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[560px]">
                            <div className="min-w-0 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                                <p className="text-[11px] font-black text-slate-400">건설사</p>
                                <p className="mt-0.5 truncate text-sm font-bold text-slate-800">{selectedSite?.constructionCompanyName || '전체'}</p>
                            </div>
                            <div className="min-w-0 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                                <p className="text-[11px] font-black text-slate-400">발주사</p>
                                <p className="mt-0.5 truncate text-sm font-bold text-slate-800">{selectedSite?.clientCompanyName || '전체'}</p>
                            </div>
                            <div className="min-w-0 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
                                <p className="text-[11px] font-black text-emerald-500">기간</p>
                                <p className="mt-0.5 truncate text-sm font-bold text-emerald-900">{selectedSite ? selectedSiteDateRange : selectedMonthLabel}</p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(300px,320px)_minmax(0,1fr)]">
                    <div className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
                            <div>
                                <h2 className="text-base font-black text-slate-900">현장 선택</h2>
                                <p className="mt-0.5 text-xs font-medium text-slate-500">건설사 · 발주사 · 현장 순서</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="rounded-md bg-white px-2 py-1 text-xs font-black text-slate-500 ring-1 ring-slate-200">{selectedMonthLabel}</span>
                                {pageLoading && (
                                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-700">
                                    <Loader2 size={15} className="animate-spin" />
                                    조회 중
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="max-h-[calc(100vh-320px)] min-h-[420px] overflow-auto bg-slate-50/60">
                            {constructionCompanySummaries.length === 0 && !pageLoading ? (
                                <div className="flex min-h-[420px] items-center justify-center px-6 text-center text-sm font-semibold text-slate-500">
                                    표시할 출력 데이터가 없습니다.
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-200">
                                    {constructionCompanySummaries.map((constructionCompany) => (
                                        <section key={constructionCompany.key} className="bg-white">
                                            <div className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100/95 px-4 py-3 backdrop-blur">
                                                <div className="flex flex-wrap items-center justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <div className="mb-1 inline-flex rounded bg-slate-700 px-1.5 py-0.5 text-[10px] font-black text-white">건설사</div>
                                                        <h3 className="truncate text-sm font-black text-slate-950">{constructionCompany.constructionCompanyName}</h3>
                                                        <p className="mt-0.5 text-xs font-semibold text-slate-500">
                                                            {constructionCompany.clientCount}개 발주사 · {constructionCompany.siteCount}개 현장
                                                        </p>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-3 text-right text-xs">
                                                        <div className="min-w-14">
                                                            <p className="font-semibold text-slate-500">공수</p>
                                                            <p className="mt-0.5 font-mono font-black text-slate-900">{formatManDay(constructionCompany.totalManDay)}</p>
                                                        </div>
                                                        <div className="min-w-24">
                                                            <p className="font-semibold text-slate-500">노임</p>
                                                            <p className="mt-0.5 font-mono font-black text-slate-900">{formatWon(constructionCompany.totalAmount)}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="divide-y divide-slate-100">
                                                {constructionCompany.clients.map((client) => {
                                                    const isClientExpanded = expandedClientKeySet.has(client.key);

                                                    return (
                                                        <div key={client.key} className="bg-white">
                                                            <button
                                                                type="button"
                                                                aria-expanded={isClientExpanded}
                                                                title={isClientExpanded ? '현장 접기' : '현장 펼치기'}
                                                                onClick={() => toggleClient(client.key)}
                                                                className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition ${isClientExpanded ? 'bg-emerald-50/60' : 'hover:bg-slate-50'}`}
                                                            >
                                                                <span className="flex min-w-0 items-center gap-2">
                                                                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${isClientExpanded ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                                                                        {isClientExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                                    </span>
                                                                    <span className="min-w-0">
                                                                        <span className="mb-0.5 inline-flex rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-black text-emerald-700">발주사</span>
                                                                        <span className="block truncate text-sm font-black text-slate-900">{client.clientCompanyName}</span>
                                                                        <span className="mt-0.5 block truncate text-xs font-semibold text-slate-500">
                                                                            {client.siteCount}개 현장 · {formatManDay(client.totalManDay)}공수
                                                                        </span>
                                                                    </span>
                                                                </span>
                                                                <span className="font-mono text-sm font-black text-slate-900">{formatWon(client.totalAmount)}</span>
                                                            </button>

                                                            {isClientExpanded && (
                                                                <div className="divide-y divide-slate-100 bg-white">
                                                                    {client.sites.map((site) => {
                                                                        const isSelected = selectedSite?.key === site.key;
                                                                        const dateRange = site.activeDates.length > 0
                                                                            ? `${site.activeDates[0]}${site.activeDates.length > 1 ? ` ~ ${site.activeDates[site.activeDates.length - 1]}` : ''}`
                                                                            : '-';
                                                                        const isLaborViewSelected = isSelected && activeDocumentView === 'labor';
                                                                        const isProgressViewSelected = isSelected && activeDocumentView === 'progress';
                                                                        const isTransactionViewSelected = isSelected && activeDocumentView === 'transaction';

                                                                        return (
                                                                            <div
                                                                                key={site.key}
                                                                                role="button"
                                                                                tabIndex={0}
                                                                                onClick={() => selectSite(site)}
                                                                                onKeyDown={(event) => {
                                                                                    if (event.key === 'Enter' || event.key === ' ') {
                                                                                        event.preventDefault();
                                                                                        selectSite(site);
                                                                                    }
                                                                                }}
                                                                                className={`cursor-pointer border-l-4 px-4 py-3 transition ${isSelected ? 'border-emerald-500 bg-emerald-50 ring-1 ring-inset ring-emerald-200' : 'border-transparent bg-white hover:border-slate-300 hover:bg-slate-50'}`}
                                                                            >
                                                                                <div className="min-w-0 pl-8">
                                                                                    <div className="flex min-w-0 items-center gap-2">
                                                                                        <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-black text-sky-700">현장</span>
                                                                                        {isSelected && <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-black text-white">선택됨</span>}
                                                                                    </div>
                                                                                    <div className="mt-1 truncate text-sm font-black text-slate-900">{site.siteName}</div>
                                                                                    <div className="mt-1 grid gap-1 text-xs text-slate-500">
                                                                                        <div className="truncate"><span className="font-black text-slate-400">기간</span> {dateRange}</div>
                                                                                        <div className="truncate"><span className="font-black text-slate-400">담당</span> {site.responsibleTeamName || '-'} · {site.siteManagerName || '-'}</div>
                                                                                    </div>
                                                                                </div>
                                                                                <div className="sr-only">{dateRange}</div>
                                                                                <div className="mt-3 grid grid-cols-2 gap-2 pl-8 text-xs">
                                                                                    <span className="rounded bg-white px-2 py-1 ring-1 ring-slate-200"><b className="font-mono">{formatManDay(site.totalManDay)}</b>공수</span>
                                                                                    <span className="rounded bg-white px-2 py-1 text-right font-mono font-black text-slate-900 ring-1 ring-slate-200">{formatWon(site.totalAmount)}</span>
                                                                                </div>
                                                                                <div className="mt-2 ml-8 flex flex-wrap gap-1.5">
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={(event) => {
                                                                                            event.stopPropagation();
                                                                                            selectSite(site, 'labor');
                                                                                        }}
                                                                                        className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-black transition ${
                                                                                            isLaborViewSelected
                                                                                                ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                                                                                                : 'border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50'
                                                                                        }`}
                                                                                    >
                                                                                        <FileText size={14} />
                                                                                        노임명세
                                                                                    </button>
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={(event) => {
                                                                                            event.stopPropagation();
                                                                                            selectSite(site, 'progress');
                                                                                        }}
                                                                                        className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-black transition ${
                                                                                            isProgressViewSelected
                                                                                                ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                                                                                                : 'border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50'
                                                                                        }`}
                                                                                    >
                                                                                        <FileText size={14} />
                                                                                        기성청구
                                                                                    </button>
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={(event) => {
                                                                                            event.stopPropagation();
                                                                                            selectSite(site, 'transaction');
                                                                                        }}
                                                                                        className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-black transition ${
                                                                                            isTransactionViewSelected
                                                                                                ? 'border-teal-600 bg-teal-600 text-white shadow-sm'
                                                                                                : 'border-teal-200 bg-white text-teal-700 hover:bg-teal-50'
                                                                                        }`}
                                                                                    >
                                                                                        <FileText size={14} />
                                                                                        거래명세
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </section>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <aside className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
                            <div className="min-w-0">
                                <p className="text-xs font-black uppercase tracking-wide text-emerald-600">{activeDocumentMeta.eyebrow}</p>
                                <h2 className="mt-0.5 truncate text-lg font-black text-slate-900">{selectedSite ? `${selectedSite.siteName} · ${activeDocumentMeta.title}` : '현장을 선택하세요'}</h2>
                                {selectedSite && (
                                    <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-black">
                                        <span className="rounded bg-slate-200 px-2 py-1 text-slate-700">{selectedSite.constructionCompanyName}</span>
                                        <span className="rounded bg-teal-100 px-2 py-1 text-teal-700">{selectedSite.clientCompanyName}</span>
                                        <span className="rounded bg-emerald-100 px-2 py-1 text-emerald-700">{selectedSiteDateRange}</span>
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <Link
                                    to="/payroll/support-client-site"
                                    className="inline-flex h-9 items-center rounded-lg border border-emerald-200 bg-white px-3 text-xs font-black text-emerald-700 transition hover:bg-emerald-50"
                                >
                                    설정 화면
                                </Link>
                                <button
                                    type="button"
                                    onClick={() => window.print()}
                                    disabled={!selectedSite}
                                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <Printer size={15} />
                                    인쇄
                                </button>
                            </div>
                        </div>

                        {selectedSite && selectedSiteLaborPreview ? (
                            <div className="max-h-[calc(100vh-260px)] overflow-auto bg-slate-50/50 p-4">
                                {activeDocumentView === 'labor' && (
                                <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-3">
                                    <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                                        <div>
                                            <p className="text-xs font-black uppercase tracking-wide text-emerald-600">노임명세부분</p>
                                            <h3 className="mt-0.5 text-base font-black text-slate-900">노임명세서</h3>
                                        </div>
                                        <span className="text-[11px] font-bold text-slate-400">{isSplitView ? '2줄 보기' : '1줄 보기'} · {showBankColumn ? '계좌 표시' : '계좌 숨김'}</span>
                                    </div>
                                    <div className="mb-4 rounded-lg border border-emerald-100 bg-emerald-50/50 p-3">
                                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                            <div>
                                                <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Labor Control</p>
                                                <h4 className="mt-0.5 text-sm font-black text-slate-900">현장별 근무/급여 입력</h4>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-slate-500">
                                                {adjustmentsLoading && (
                                                    <span className="inline-flex items-center gap-1 rounded bg-white px-2 py-1 text-emerald-700 ring-1 ring-emerald-100">
                                                        <Loader2 size={13} className="animate-spin" />
                                                        조정값 조회
                                                    </span>
                                                )}
                                                <span className="rounded bg-white px-2 py-1 ring-1 ring-emerald-100">세율 {((laborTaxConfig.incomeTaxRate + laborTaxConfig.residentTaxRate) * 100).toFixed(1)}%</span>
                                                <span className="rounded bg-white px-2 py-1 ring-1 ring-emerald-100">{PROCESS_STATUS_OPTIONS.find((option) => option.value === selectedProcessStatus)?.label ?? '전체 처리'}</span>
                                            </div>
                                        </div>

                                        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
                                            <div className="rounded-md border border-white bg-white px-3 py-2 shadow-sm">
                                                <p className="text-[11px] font-black text-slate-400">근무자</p>
                                                <p className="mt-1 font-mono text-base font-black text-slate-900">{selectedSiteLaborTotals.workerCount}</p>
                                            </div>
                                            <div className="rounded-md border border-white bg-white px-3 py-2 shadow-sm">
                                                <p className="text-[11px] font-black text-slate-400">공수</p>
                                                <p className="mt-1 font-mono text-base font-black text-slate-900">{formatManDay(selectedSiteLaborTotals.manDay)}</p>
                                            </div>
                                            <div className="rounded-md border border-white bg-white px-3 py-2 shadow-sm">
                                                <p className="text-[11px] font-black text-slate-400">세전총액</p>
                                                <p className="mt-1 font-mono text-base font-black text-slate-900">{formatWon(selectedSiteLaborTotals.grossAmount)}</p>
                                            </div>
                                            <div className="rounded-md border border-white bg-white px-3 py-2 shadow-sm">
                                                <p className="text-[11px] font-black text-slate-400">수당</p>
                                                <p className="mt-1 font-mono text-base font-black text-emerald-700">{formatWon(selectedSiteLaborTotals.allowance)}</p>
                                            </div>
                                            <div className="rounded-md border border-white bg-white px-3 py-2 shadow-sm">
                                                <p className="text-[11px] font-black text-slate-400">공제</p>
                                                <p className="mt-1 font-mono text-base font-black text-rose-700">{formatWon(selectedSiteLaborTotals.totalDeduction)}</p>
                                            </div>
                                            <div className="rounded-md border border-emerald-200 bg-white px-3 py-2 shadow-sm">
                                                <p className="text-[11px] font-black text-emerald-500">실지급</p>
                                                <p className="mt-1 font-mono text-base font-black text-emerald-900">{formatWon(selectedSiteLaborTotals.netAmount)}</p>
                                            </div>
                                        </div>

                                        <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white">
                                            <table className="w-full min-w-[1280px] border-collapse text-xs">
                                                <thead className="bg-slate-100 text-slate-600">
                                                    <tr>
                                                        <th className="border-b border-slate-200 px-2 py-2 text-left">일자</th>
                                                        <th className="border-b border-slate-200 px-2 py-2 text-left">작업자</th>
                                                        <th className="border-b border-slate-200 px-2 py-2 text-left">팀</th>
                                                        <th className="border-b border-slate-200 px-2 py-2 text-center">근태</th>
                                                        <th className="border-b border-slate-200 px-2 py-2 text-right">공수</th>
                                                        <th className="border-b border-slate-200 px-2 py-2 text-right">단가</th>
                                                        <th className="border-b border-slate-200 px-2 py-2 text-right">기본급</th>
                                                        <th className="border-b border-slate-200 px-2 py-2 text-right">수당</th>
                                                        <th className="border-b border-slate-200 px-2 py-2 text-right">세금</th>
                                                        <th className="border-b border-slate-200 px-2 py-2 text-right">기타공제</th>
                                                        <th className="border-b border-slate-200 px-2 py-2 text-right">실지급</th>
                                                        <th className="border-b border-slate-200 px-2 py-2 text-center">처리</th>
                                                        <th className="border-b border-slate-200 px-2 py-2 text-left">비고</th>
                                                        <th className="border-b border-slate-200 px-2 py-2 text-center">작업</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {selectedSiteManagementRows.map((row) => {
                                                        const isEditing = editingRowKey === row.key;
                                                        const isSaving = savingRowKey === row.key;
                                                        const isDeleting = deletingRowKey === row.key;
                                                        const processStatus = row.adjustment?.status ?? 'draft';

                                                        return (
                                                            <tr key={row.key} className={isEditing ? 'bg-emerald-50/70' : 'odd:bg-white even:bg-slate-50/70'}>
                                                                <td className="border-b border-slate-100 px-2 py-2 font-mono text-slate-600">{row.entry.date}</td>
                                                                <td className="border-b border-slate-100 px-2 py-2">
                                                                    <div className="font-black text-slate-900">{row.entry.workerName}</div>
                                                                    <div className="mt-0.5 text-[11px] font-semibold text-slate-400">{row.entry.role || '-'}</div>
                                                                </td>
                                                                <td className="border-b border-slate-100 px-2 py-2 text-slate-600">{row.entry.teamName || row.entry.workerTeamName || '-'}</td>
                                                                <td className="border-b border-slate-100 px-2 py-2 text-center">
                                                                    {isEditing ? (
                                                                        <select
                                                                            value={editDraft.workStatus}
                                                                            onChange={(event) => setEditDraft((prev) => ({ ...prev, workStatus: event.target.value as DailyReportWorkerRow['status'] }))}
                                                                            className="h-8 rounded border border-slate-300 bg-white px-2 text-xs font-bold outline-none focus:border-emerald-500"
                                                                        >
                                                                            {WORK_STATUS_OPTIONS.filter((option) => option.value !== 'all').map((option) => (
                                                                                <option key={option.value} value={option.value}>{option.label}</option>
                                                                            ))}
                                                                        </select>
                                                                    ) : (
                                                                        <span className="rounded bg-slate-100 px-2 py-1 font-bold text-slate-600">{getStatusLabel(row.entry.status)}</span>
                                                                    )}
                                                                </td>
                                                                <td className="border-b border-slate-100 px-2 py-2 text-right">
                                                                    {isEditing ? (
                                                                        <input
                                                                            type="number"
                                                                            min="0"
                                                                            step="0.1"
                                                                            value={editDraft.manDay}
                                                                            onChange={(event) => setEditDraft((prev) => ({ ...prev, manDay: event.target.value }))}
                                                                            className="h-8 w-20 rounded border border-slate-300 px-2 text-right font-mono text-xs outline-none focus:border-emerald-500"
                                                                        />
                                                                    ) : (
                                                                        <span className="font-mono font-black">{formatManDay(row.calculation.manDay)}</span>
                                                                    )}
                                                                </td>
                                                                <td className="border-b border-slate-100 px-2 py-2 text-right">
                                                                    {isEditing ? (
                                                                        <input
                                                                            type="number"
                                                                            min="0"
                                                                            step="1000"
                                                                            value={editDraft.unitPrice}
                                                                            onChange={(event) => setEditDraft((prev) => ({ ...prev, unitPrice: event.target.value }))}
                                                                            className="h-8 w-24 rounded border border-slate-300 px-2 text-right font-mono text-xs outline-none focus:border-emerald-500"
                                                                        />
                                                                    ) : (
                                                                        <span className="font-mono">{formatNumber(row.calculation.unitPrice)}</span>
                                                                    )}
                                                                </td>
                                                                <td className="border-b border-slate-100 px-2 py-2 text-right font-mono font-bold">{formatNumber(row.calculation.baseAmount)}</td>
                                                                <td className="border-b border-slate-100 px-2 py-2 text-right">
                                                                    {isEditing ? (
                                                                        <input
                                                                            type="number"
                                                                            min="0"
                                                                            step="1000"
                                                                            value={editDraft.allowance}
                                                                            onChange={(event) => setEditDraft((prev) => ({ ...prev, allowance: event.target.value }))}
                                                                            className="h-8 w-24 rounded border border-slate-300 px-2 text-right font-mono text-xs outline-none focus:border-emerald-500"
                                                                        />
                                                                    ) : (
                                                                        <span className="font-mono text-emerald-700">{formatNumber(row.calculation.allowance)}</span>
                                                                    )}
                                                                </td>
                                                                <td className="border-b border-slate-100 px-2 py-2 text-right font-mono text-slate-600">{formatNumber(row.calculation.taxTotal)}</td>
                                                                <td className="border-b border-slate-100 px-2 py-2 text-right">
                                                                    {isEditing ? (
                                                                        <input
                                                                            type="number"
                                                                            min="0"
                                                                            step="1000"
                                                                            value={editDraft.deduction}
                                                                            onChange={(event) => setEditDraft((prev) => ({ ...prev, deduction: event.target.value }))}
                                                                            className="h-8 w-24 rounded border border-slate-300 px-2 text-right font-mono text-xs outline-none focus:border-emerald-500"
                                                                        />
                                                                    ) : (
                                                                        <span className="font-mono text-rose-700">{formatNumber(row.calculation.manualDeduction)}</span>
                                                                    )}
                                                                </td>
                                                                <td className="border-b border-slate-100 px-2 py-2 text-right font-mono font-black text-slate-900">{formatNumber(row.calculation.netAmount)}</td>
                                                                <td className="border-b border-slate-100 px-2 py-2 text-center">
                                                                    {isEditing ? (
                                                                        <select
                                                                            value={editDraft.processStatus}
                                                                            onChange={(event) => setEditDraft((prev) => ({ ...prev, processStatus: event.target.value as ClientSiteLaborProcessStatus }))}
                                                                            className="h-8 rounded border border-slate-300 bg-white px-2 text-xs font-bold outline-none focus:border-emerald-500"
                                                                        >
                                                                            {PROCESS_STATUS_OPTIONS.filter((option) => option.value !== 'all').map((option) => (
                                                                                <option key={option.value} value={option.value}>{option.label}</option>
                                                                            ))}
                                                                        </select>
                                                                    ) : (
                                                                        <span className={`rounded border px-2 py-1 font-black ${PROCESS_STATUS_BADGE_CLASS[processStatus]}`}>
                                                                            {PROCESS_STATUS_LABELS[processStatus]}
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                <td className="border-b border-slate-100 px-2 py-2">
                                                                    {isEditing ? (
                                                                        <input
                                                                            type="text"
                                                                            value={editDraft.memo}
                                                                            onChange={(event) => setEditDraft((prev) => ({ ...prev, memo: event.target.value }))}
                                                                            className="h-8 w-44 rounded border border-slate-300 px-2 text-xs outline-none focus:border-emerald-500"
                                                                            placeholder="수당/공제 사유"
                                                                        />
                                                                    ) : (
                                                                        <span className="block max-w-[220px] truncate text-slate-500">{row.adjustment?.memo || row.entry.workContent || '-'}</span>
                                                                    )}
                                                                </td>
                                                                <td className="border-b border-slate-100 px-2 py-2">
                                                                    <div className="flex justify-center gap-1.5">
                                                                        {isEditing ? (
                                                                            <>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => void saveManagementRow(row)}
                                                                                    disabled={isSaving}
                                                                                    title="저장"
                                                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-emerald-600 text-white transition hover:bg-emerald-700 disabled:opacity-50"
                                                                                >
                                                                                    {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                                                                                </button>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={cancelEditRow}
                                                                                    title="취소"
                                                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-50"
                                                                                >
                                                                                    <X size={15} />
                                                                                </button>
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => startEditRow(row)}
                                                                                    title="수정"
                                                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-50"
                                                                                >
                                                                                    <Edit3 size={15} />
                                                                                </button>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => void deleteManagementRow(row)}
                                                                                    disabled={isDeleting}
                                                                                    title="삭제"
                                                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-rose-200 bg-white text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                                                                                >
                                                                                    {isDeleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                                                                                </button>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                    {selectedSiteManagementRows.length === 0 && (
                                                        <tr>
                                                            <td colSpan={14} className="px-4 py-8 text-center font-bold text-slate-400">
                                                                선택한 처리상태에 해당하는 근무 행이 없습니다.
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-100 p-4">
                                        <div className={`inline-block ${isSplitView ? 'min-w-[1180px]' : 'min-w-[1680px]'} bg-white`}>
                                            <SiteLaborStatementPreview
                                                targetTitle={selectedSite.constructionCompanyName}
                                                preview={selectedSiteLaborPreview}
                                                yearMonth={statementYearMonth}
                                                viewOptions={statementViewOptions}
                                            />
                                        </div>
                                    </div>
                                </section>
                                )}

                                {activeDocumentView === 'progress' && (
                                <section className="min-w-0 rounded-lg border border-indigo-200 bg-white p-3">
                                    <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                                        <div>
                                            <p className="text-xs font-black uppercase tracking-wide text-indigo-600">기성청구서</p>
                                            <h3 className="mt-0.5 text-base font-black text-slate-900">현장별 기성청구서</h3>
                                            <p className="mt-1 text-xs font-bold text-slate-500">
                                                기성관리에서 저장한 해당 월 청구서를 선택 현장 기준으로 표시합니다.
                                            </p>
                                        </div>
                                        <Link
                                            to={selectedSiteProgressInvoiceLink}
                                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-2.5 text-xs font-black text-indigo-700 transition hover:bg-indigo-50"
                                        >
                                            <ExternalLink size={14} />
                                            기성관리
                                        </Link>
                                    </div>

                                    {progressDocumentsError && (
                                        <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
                                            {progressDocumentsError}
                                        </div>
                                    )}

                                    {progressDocumentsLoading ? (
                                        <div className="flex min-h-32 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 text-sm font-bold text-slate-500">
                                            <Loader2 size={18} className="animate-spin" />
                                            기성청구서를 불러오는 중
                                        </div>
                                    ) : selectedSiteProgressPreview ? (
                                        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-100 p-4">
                                            <ProgressClaimInvoicePreview
                                                data={selectedSiteProgressPreview}
                                                site={selectedSite}
                                                yearMonth={selectedYearMonth}
                                            />
                                        </div>
                                    ) : (
                                        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
                                            <p className="text-sm font-black text-slate-700">해당 현장의 기성청구서가 없습니다.</p>
                                            <p className="mt-1 text-xs font-semibold text-slate-500">
                                                기성관리에서 이 현장과 {selectedYearMonth} 월 청구서를 저장하면 여기에 표시됩니다.
                                            </p>
                                        </div>
                                    )}
                                </section>
                                )}

                                {activeDocumentView === 'transaction' && (
                                <section className="min-w-0 rounded-lg border border-teal-200 bg-white p-3">
                                    <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                                        <div>
                                            <p className="text-xs font-black uppercase tracking-wide text-teal-600">거래명세서</p>
                                            <h3 className="mt-0.5 text-base font-black text-slate-900">연동 거래명세서</h3>
                                            <p className="mt-1 text-xs font-bold text-slate-500">
                                                지원 발주팀별 현장별 화면에서 이 현장에 연결한 거래명세서입니다.
                                            </p>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="rounded bg-teal-50 px-2 py-1 text-[11px] font-black text-teal-700">
                                                일반 {standardTransactionCount}건
                                            </span>
                                            <span className="rounded bg-amber-50 px-2 py-1 text-[11px] font-black text-amber-700">
                                                임대 {rentalTransactionCount}건
                                            </span>
                                            <span className="rounded bg-indigo-50 px-2 py-1 text-[11px] font-black text-indigo-700">
                                                기성 {progressTransactionCount}건
                                            </span>
                                            <Link
                                                to="/payroll/support-client-site"
                                                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-teal-200 bg-white px-2.5 text-xs font-black text-teal-700 transition hover:bg-teal-50"
                                            >
                                                <ExternalLink size={14} />
                                                연결 관리
                                            </Link>
                                        </div>
                                    </div>

                                    {transactionStatementError && (
                                        <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
                                            {transactionStatementError}
                                        </div>
                                    )}

                                    {transactionStatementsLoading ? (
                                        <div className="flex min-h-40 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 text-sm font-bold text-slate-500">
                                            <Loader2 size={18} className="animate-spin" />
                                            거래명세서 불러오는 중
                                        </div>
                                    ) : linkedTransactionStatements.length > 0 && selectedTransactionStatement ? (
                                        <>
                                            <div className="mb-3 flex flex-wrap gap-2">
                                                {linkedTransactionStatements.map((statement, index) => {
                                                    const statementId = statement.id || `${statement.supportStatementKey}:${index}`;
                                                    const isSelectedStatement = selectedTransactionStatement.id === statement.id || (!selectedTransactionStatement.id && index === 0);
                                                    const isRentalStatement = statement.estimateMode === 'rental';
                                                    const isProgressStatement = statement.supportStatementSource === PROGRESS_TRANSACTION_STATEMENT_SOURCE;

                                                    return (
                                                        <button
                                                            key={statementId}
                                                            type="button"
                                                            onClick={() => setSelectedTransactionStatementId(statement.id || '')}
                                                            className={`max-w-full rounded-lg border px-3 py-2 text-left text-xs transition ${
                                                                isSelectedStatement
                                                                    ? 'border-teal-500 bg-teal-50 text-teal-900 shadow-sm'
                                                                    : 'border-slate-200 bg-white text-slate-600 hover:border-teal-200 hover:bg-teal-50/60'
                                                            }`}
                                                        >
                                                            <span className={`mb-1 inline-flex rounded px-1.5 py-0.5 text-[10px] font-black ${
                                                                isRentalStatement
                                                                    ? 'bg-amber-100 text-amber-700'
                                                                    : 'bg-teal-100 text-teal-700'
                                                            }`}>
                                                                {isRentalStatement ? '임대거래' : '거래명세'}
                                                            </span>
                                                            <span className={`mb-1 ml-1 inline-flex rounded px-1.5 py-0.5 text-[10px] font-black ${
                                                                isProgressStatement
                                                                    ? 'bg-indigo-100 text-indigo-700'
                                                                    : 'bg-slate-100 text-slate-600'
                                                            }`}>
                                                                {isProgressStatement ? '기성관리' : '발주처/현장'}
                                                            </span>
                                                            <span className="block max-w-[240px] truncate font-black">
                                                                {statement.projectName || statement.title || '거래명세표'}
                                                            </span>
                                                            <span className="mt-0.5 block font-mono text-[11px] font-bold text-slate-500">
                                                                {statement.issueDate || '-'} · {formatWon(statement.total || 0)}
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-100 p-4">
                                                <LinkedTransactionStatementPreview statement={selectedTransactionStatement} />
                                            </div>
                                        </>
                                    ) : (
                                        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
                                            <p className="text-sm font-black text-slate-700">연동된 거래명세서가 없습니다.</p>
                                            <p className="mt-1 text-xs font-semibold text-slate-500">
                                                지원 발주팀별 현장별 화면에서 이 현장의 거래명세서를 저장하거나 기존 거래명세서를 연결하면 여기에 표시됩니다.
                                            </p>
                                        </div>
                                    )}
                                </section>
                                )}
                            </div>
                        ) : (
                            <div className="flex min-h-[420px] items-center justify-center px-6 text-center">
                                <div className="max-w-sm">
                                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                                        <FileText size={24} />
                                    </div>
                                    <p className="mt-3 text-base font-black text-slate-800">{activeDocumentMeta.emptyTitle}</p>
                                    <p className="mt-1 text-sm font-semibold text-slate-500">{activeDocumentMeta.emptyDescription}</p>
                                </div>
                            </div>
                        )}
                    </aside>
                </section>
            </main>
        </div>
    );
};

export default ClientSiteLaborPage;
