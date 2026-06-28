import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Building2,
    CalendarDays,
    ChevronDown,
    ChevronRight,
    ExternalLink,
    FileText,
    Loader2,
    MapPin,
    Printer,
    RefreshCw,
    Search,
    UsersRound,
    WalletCards,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { companyService, type Company } from '../../services/companyService';
import { dailyReportService, type DailyReportWorkerRow } from '../../services/dailyReportService';
import { manpowerService, type Worker } from '../../services/manpowerService';
import { supportRateService, type SupportRate } from '../../services/supportRateService';
import { userService, type UserData } from '../../services/userService';
import { estimateService, type Estimate } from '../../services/estimateService';
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

type CompanyAccessMode = 'all' | 'construction-company';
type StatementPayType = 'direct' | 'delegate';

interface ConstructionCompanyAccessScope {
    loading: boolean;
    mode: CompanyAccessMode;
    label: string;
    companyIds: string[];
    companyNameKeys: string[];
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

const normalizeAccountType = (value: unknown): string =>
    normalizeKey(value).replace(/[-_]/g, '');

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

const parseLinkedIds = (raw?: unknown): string[] => {
    if (Array.isArray(raw)) return uniqueAccessTexts(raw);

    const rawText = text(raw);
    if (!rawText) return [];

    try {
        const parsed = JSON.parse(rawText);
        return Array.isArray(parsed) ? uniqueAccessTexts(parsed) : [rawText];
    } catch {
        return [rawText];
    }
};

const buildAllCompanyAccessScope = (loading = false): ConstructionCompanyAccessScope => ({
    loading,
    mode: 'all',
    label: '\uC804\uCCB4',
    companyIds: [],
    companyNameKeys: [],
});

const isConstructionCompanyProfile = (profile: UserData | null): boolean =>
    normalizeAccountType(profile?.accountType) === 'constructioncompany';

const profileBypassesCompanyScope = (profile: UserData | null): boolean => {
    const accountType = normalizeAccountType(profile?.accountType);
    if (accountType === 'constructioncompany') return false;
    if (accountType === 'office') return true;
    if (parseLinkedIds(profile?.linkedOfficeStaffIds).length > 0) return true;

    const role = normalizeKey(profile?.role);
    if (!role) return false;

    return [
        'admin',
        'administrator',
        'manager',
        'office',
        '\uAD00\uB9AC\uC790',
        '\uC0AC\uC7A5',
        '\uC2E4\uC7A5',
        '\uB9E4\uB2C8\uC800',
        '\uBCF8\uC0AC',
        '\uC0AC\uBB34',
    ].some((keyword) => role.includes(normalizeKey(keyword)));
};

const resolveConstructionCompanyAccessScope = async (
    profile: UserData | null
): Promise<ConstructionCompanyAccessScope> => {
    if (!profile || profileBypassesCompanyScope(profile) || !isConstructionCompanyProfile(profile)) {
        return buildAllCompanyAccessScope();
    }

    const linkedCompanyIds = parseLinkedIds(profile.linkedCompanyIds);
    const linkedCompanies = await Promise.all(
        linkedCompanyIds.map(async (companyId) => {
            try {
                return await companyService.getCompanyById(companyId);
            } catch (error) {
                console.warn('[ClientSiteLaborPage] linked company load failed:', companyId, error);
                return null;
            }
        })
    );
    const companyIds = uniqueAccessTexts([
        ...linkedCompanyIds,
        ...linkedCompanies.flatMap((company: Company | null) =>
            company ? [company.id, company.legacyId] : []
        ),
    ]);
    const companyNames = uniqueAccessTexts(
        linkedCompanies.flatMap((company: Company | null) => company ? [company.name] : [])
    );

    return {
        loading: false,
        mode: 'construction-company',
        label: companyNames.join(', ') || companyIds.join(', ') || '\uC5F0\uACB0 \uAC74\uC124\uC0AC \uC5C6\uC74C',
        companyIds,
        companyNameKeys: companyNames.map(normalizeKey).filter(Boolean),
    };
};

const matchesCompanyAccessScope = (
    row: EnrichedWorkerRow,
    scope: ConstructionCompanyAccessScope
): boolean => {
    if (scope.loading) return false;
    if (scope.mode === 'all') return true;

    const allowedCompanyIds = new Set(scope.companyIds);
    const rowCompanyIds = uniqueAccessTexts([row.constructorCompanyId]);
    if (rowCompanyIds.some((companyId) => allowedCompanyIds.has(companyId))) return true;

    const rowCompanyNameKey = normalizeKey(row.constructorCompanyName || row.constructionCompanyName);
    return Boolean(rowCompanyNameKey && scope.companyNameKeys.includes(rowCompanyNameKey));
};

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

const WorkerStatement: React.FC<{
    site: SiteSummary;
    worker: WorkerSummary;
    startDate: string;
    endDate: string;
}> = ({ site, worker, startDate, endDate }) => {
    const tax = getTaxSummary(worker.totalAmount);

    return (
        <div className="border border-slate-300 bg-white p-4 text-slate-900">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-300 pb-3">
                <div>
                    <h2 className="text-xl font-black tracking-normal">노임명세서</h2>
                    <p className="mt-1 text-xs font-medium text-slate-500">{startDate} ~ {endDate}</p>
                </div>
                <div className="text-right text-xs text-slate-500">
                    <p>{site.constructionCompanyName}</p>
                    <p>{site.clientCompanyName}</p>
                    <p>{site.siteName}</p>
                </div>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm md:grid-cols-4">
                <div>
                    <dt className="text-xs font-semibold text-slate-500">성명</dt>
                    <dd className="font-bold text-slate-900">{worker.workerName}</dd>
                </div>
                <div>
                    <dt className="text-xs font-semibold text-slate-500">직종</dt>
                    <dd className="font-medium">{worker.role || '-'}</dd>
                </div>
                <div>
                    <dt className="text-xs font-semibold text-slate-500">주민번호</dt>
                    <dd className="font-mono text-xs">{maskIdNumber(worker.idNumber)}</dd>
                </div>
                <div>
                    <dt className="text-xs font-semibold text-slate-500">연락처</dt>
                    <dd className="font-mono text-xs">{worker.contact || '-'}</dd>
                </div>
                <div className="col-span-2">
                    <dt className="text-xs font-semibold text-slate-500">주소</dt>
                    <dd className="truncate font-medium">{worker.address || '-'}</dd>
                </div>
                <div>
                    <dt className="text-xs font-semibold text-slate-500">은행</dt>
                    <dd className="font-medium">{worker.bankName || '-'}</dd>
                </div>
                <div>
                    <dt className="text-xs font-semibold text-slate-500">계좌</dt>
                    <dd className="truncate font-mono text-xs">{worker.accountNumber || '-'}</dd>
                </div>
            </dl>

            <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-sm">
                    <thead>
                        <tr className="bg-slate-100 text-xs text-slate-600">
                            <th className="border border-slate-300 px-2 py-2 text-left">일자</th>
                            <th className="border border-slate-300 px-2 py-2 text-left">출력팀</th>
                            <th className="border border-slate-300 px-2 py-2 text-center">상태</th>
                            <th className="border border-slate-300 px-2 py-2 text-right">공수</th>
                            <th className="border border-slate-300 px-2 py-2 text-right">단가</th>
                            <th className="border border-slate-300 px-2 py-2 text-right">금액</th>
                        </tr>
                    </thead>
                    <tbody>
                        {worker.entries.map((entry) => (
                            <tr key={`${entry.reportId}-${entry.workerIndex ?? entry.date}`}>
                                <td className="border border-slate-300 px-2 py-2 font-mono text-xs">{entry.date}</td>
                                <td className="border border-slate-300 px-2 py-2">{entry.teamName || entry.workerTeamName || '-'}</td>
                                <td className="border border-slate-300 px-2 py-2 text-center">{getStatusLabel(entry.status)}</td>
                                <td className="border border-slate-300 px-2 py-2 text-right font-mono">{formatManDay(entry.manDay)}</td>
                                <td className="border border-slate-300 px-2 py-2 text-right font-mono">{formatNumber(entry.unitPrice)}</td>
                                <td className="border border-slate-300 px-2 py-2 text-right font-mono font-bold">{formatNumber(entry.amount)}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="bg-slate-50 font-black">
                            <td className="border border-slate-300 px-2 py-2" colSpan={3}>합계</td>
                            <td className="border border-slate-300 px-2 py-2 text-right font-mono">{formatManDay(worker.totalManDay)}</td>
                            <td className="border border-slate-300 px-2 py-2 text-right font-mono">{formatNumber(worker.averageUnitPrice)}</td>
                            <td className="border border-slate-300 px-2 py-2 text-right font-mono">{formatNumber(worker.totalAmount)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
                <div className="border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-xs font-semibold text-slate-500">총 노임</p>
                    <p className="mt-1 font-black">{formatWon(worker.totalAmount)}</p>
                </div>
                <div className="border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-xs font-semibold text-slate-500">소득세</p>
                    <p className="mt-1 font-bold">{formatWon(tax.incomeTax)}</p>
                </div>
                <div className="border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-xs font-semibold text-slate-500">지방소득세</p>
                    <p className="mt-1 font-bold">{formatWon(tax.residentTax)}</p>
                </div>
                <div className="border border-slate-200 bg-emerald-50 px-3 py-2">
                    <p className="text-xs font-semibold text-emerald-700">실지급액</p>
                    <p className="mt-1 font-black text-emerald-900">{formatWon(tax.netAmount)}</p>
                </div>
            </div>
        </div>
    );
};

const ClientSiteLaborPage: React.FC = () => {
    const { currentUser, loading: authLoading } = useAuth();
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
    const [selectedConstructionCompanyKey, setSelectedConstructionCompanyKey] = useState('');
    const [selectedClientCompanyKey, setSelectedClientCompanyKey] = useState('');
    const [selectedSiteFilterKey, setSelectedSiteFilterKey] = useState('');
    const [activeSiteKey, setActiveSiteKey] = useState('');
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
    const [companyAccessScope, setCompanyAccessScope] = useState<ConstructionCompanyAccessScope>(() =>
        buildAllCompanyAccessScope(true)
    );
    const [transactionStatements, setTransactionStatements] = useState<Estimate[]>([]);
    const [transactionStatementsLoading, setTransactionStatementsLoading] = useState(false);
    const [transactionStatementError, setTransactionStatementError] = useState('');
    const [selectedTransactionStatementId, setSelectedTransactionStatementId] = useState('');

    useEffect(() => {
        let mounted = true;

        const loadCompanyAccessScope = async () => {
            if (authLoading) {
                if (mounted) {
                    setRows([]);
                    setCompanyAccessScope(buildAllCompanyAccessScope(true));
                }
                return;
            }

            if (!currentUser?.uid) {
                if (mounted) setCompanyAccessScope(buildAllCompanyAccessScope());
                return;
            }

            setRows([]);
            setCompanyAccessScope(buildAllCompanyAccessScope(true));

            try {
                const profile = await userService.getUser(currentUser.uid);
                const nextScope = await resolveConstructionCompanyAccessScope(profile);
                if (mounted) setCompanyAccessScope(nextScope);
            } catch (accessError) {
                console.error('[ClientSiteLaborPage] failed to resolve company access scope:', accessError);
                if (mounted) setCompanyAccessScope(buildAllCompanyAccessScope());
            }
        };

        void loadCompanyAccessScope();

        return () => {
            mounted = false;
        };
    }, [authLoading, currentUser?.uid]);

    const loadData = useCallback(async () => {
        if (!startDate || !endDate || companyAccessScope.loading) return;
        setLoading(true);
        setError('');
        try {
            const [workerRows, workers, supportRates] = await Promise.all([
                dailyReportService.getWorkerRows({ startDate, endDate }),
                manpowerService.getWorkers(),
                supportRateService.getAllSiteRates().catch((supportRateError) => {
                    console.error('[ClientSiteLaborPage] support rate load failed:', supportRateError);
                    return [] as SupportRate[];
                }),
            ]);
            const enrichedRows = enrichRows(
                workerRows,
                workers,
                supportRates,
                loadSupportClientBillingRates(selectedYearMonth)
            );
            setRows(enrichedRows.filter((row) => matchesCompanyAccessScope(row, companyAccessScope)));
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
        setTransactionStatementsLoading(true);
        setTransactionStatementError('');
        try {
            const statements = await estimateService.getEstimates();
            setTransactionStatements(statements.filter((statement) =>
                statement.documentType === 'transaction' &&
                statement.supportStatementSource === SUPPORT_TRANSACTION_STATEMENT_SOURCE
            ));
        } catch (statementLoadError) {
            console.error('[ClientSiteLaborPage] transaction statement load failed:', statementLoadError);
            setTransactionStatements([]);
            setTransactionStatementError('연동된 거래명세서를 불러오지 못했습니다.');
        } finally {
            setTransactionStatementsLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchTransactionStatements();
    }, [fetchTransactionStatements]);

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
    }, [rows, searchTerm, selectedConstructionCompanyKey, selectedClientCompanyKey, selectedSiteFilterKey]);

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
    const linkedTransactionStatements = useMemo(
        () => transactionStatements
            .filter((statement) =>
                statement.supportStatementKey === selectedSiteSupportStatementKey &&
                statement.supportStatementYearMonth === selectedYearMonth
            )
            .sort((a, b) => {
                const modeOrder = (a.estimateMode === 'rental' ? 1 : 0) - (b.estimateMode === 'rental' ? 1 : 0);
                if (modeOrder !== 0) return modeOrder;
                return String(b.issueDate || '').localeCompare(String(a.issueDate || '')) ||
                    String(a.projectName || a.title || '').localeCompare(String(b.projectName || b.title || ''), 'ko');
            }),
        [selectedSiteSupportStatementKey, selectedYearMonth, transactionStatements]
    );
    const selectedTransactionStatement = useMemo(
        () => linkedTransactionStatements.find((statement) => statement.id === selectedTransactionStatementId) ??
            linkedTransactionStatements[0],
        [linkedTransactionStatements, selectedTransactionStatementId]
    );
    const standardTransactionCount = linkedTransactionStatements.filter((statement) => statement.estimateMode !== 'rental').length;
    const rentalTransactionCount = linkedTransactionStatements.filter((statement) => statement.estimateMode === 'rental').length;
    const selectedSiteDateRange = useMemo(() => {
        if (!selectedSite || selectedSite.activeDates.length === 0) return '-';
        return `${selectedSite.activeDates[0]}${selectedSite.activeDates.length > 1 ? ` ~ ${selectedSite.activeDates[selectedSite.activeDates.length - 1]}` : ''}`;
    }, [selectedSite]);
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

    const totalSiteCount = visibleSites.length;
    const totalClientCount = constructionCompanySummaries.reduce((sum, constructionCompany) => sum + constructionCompany.clientCount, 0);
    const totalWorkerCount = useMemo(() => {
        const workers = new Set<string>();
        filteredRows.forEach((row) => workers.add(buildIdentityKey('worker', row.workerId, row.workerName, 'worker')));
        return workers.size;
    }, [filteredRows]);
    const totalManDay = filteredRows.reduce((sum, row) => sum + safeNumber(row.manDay), 0);
    const totalAmount = filteredRows.reduce((sum, row) => sum + safeNumber(row.amount), 0);

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
    }, [selectedSiteSupportStatementKey, selectedYearMonth]);

    const expandClient = useCallback((clientKey: string) => {
        setExpandedClientKeys((prev) => prev[0] === clientKey ? prev : [clientKey]);
    }, []);

    const toggleClient = useCallback((clientKey: string) => {
        setExpandedClientKeys((prev) => prev[0] === clientKey ? [] : [clientKey]);
    }, []);

    const selectSite = (site: SiteSummary) => {
        expandClient(site.clientCompanyKey);
        setActiveSiteKey(site.key);
    };

    const pageLoading = loading || companyAccessScope.loading;

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
                    <button
                        type="button"
                        onClick={() => {
                            void loadData();
                            void fetchTransactionStatements();
                        }}
                        disabled={pageLoading}
                        className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {pageLoading ? <Loader2 size={17} className="animate-spin" /> : <RefreshCw size={17} />}
                        새로고침
                    </button>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[220px_minmax(130px,1fr)_minmax(130px,1fr)_minmax(130px,1fr)_minmax(210px,1.1fr)]">
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
                <section className="grid grid-cols-2 gap-3 lg:grid-cols-6">
                    <StatCard icon={<Building2 size={20} />} label="건설사" value={`${constructionCompanySummaries.length}`} tone="bg-emerald-100 text-emerald-700" />
                    <StatCard icon={<Building2 size={20} />} label="발주사" value={`${totalClientCount}`} tone="bg-teal-100 text-teal-700" />
                    <StatCard icon={<MapPin size={20} />} label="현장" value={`${totalSiteCount}`} tone="bg-sky-100 text-sky-700" />
                    <StatCard icon={<UsersRound size={20} />} label="출력 인원" value={`${totalWorkerCount}`} tone="bg-indigo-100 text-indigo-700" />
                    <StatCard icon={<CalendarDays size={20} />} label="총 공수" value={formatManDay(totalManDay)} tone="bg-amber-100 text-amber-700" />
                    <StatCard icon={<WalletCards size={20} />} label="총 노임" value={formatWon(totalAmount)} tone="bg-rose-100 text-rose-700" />
                </section>

                {error && (
                    <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                        {error}
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
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={(event) => {
                                                                                        event.stopPropagation();
                                                                                        selectSite(site);
                                                                                    }}
                                                                                    className="mt-2 ml-8 inline-flex h-8 w-fit items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-600 px-2.5 text-xs font-black text-white transition hover:bg-emerald-700"
                                                                                >
                                                                                    <FileText size={14} />
                                                                                    명세서
                                                                                </button>
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
                                <p className="text-xs font-black uppercase tracking-wide text-emerald-600">노임명세서 보기</p>
                                <h2 className="mt-0.5 truncate text-lg font-black text-slate-900">{selectedSite?.siteName || '현장을 선택하세요'}</h2>
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
                                <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-3">
                                    <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                                        <div>
                                            <p className="text-xs font-black uppercase tracking-wide text-emerald-600">노임명세부분</p>
                                            <h3 className="mt-0.5 text-base font-black text-slate-900">노임명세서</h3>
                                        </div>
                                        <span className="text-[11px] font-bold text-slate-400">{isSplitView ? '2줄 보기' : '1줄 보기'} · {showBankColumn ? '계좌 표시' : '계좌 숨김'}</span>
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

                                <section className="mt-4 min-w-0 rounded-lg border border-teal-200 bg-white p-3">
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
                            </div>
                        ) : (
                            <div className="flex min-h-[420px] items-center justify-center px-6 text-center">
                                <div className="max-w-sm">
                                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                                        <FileText size={24} />
                                    </div>
                                    <p className="mt-3 text-base font-black text-slate-800">현장을 선택하세요</p>
                                    <p className="mt-1 text-sm font-semibold text-slate-500">선택한 현장의 작업자와 노임명세서가 표시됩니다.</p>
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
