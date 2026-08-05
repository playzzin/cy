import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCalendarAlt,
    faCircleCheck,
    faCircleExclamation,
    faExclamationTriangle,
    faFileExcel,
    faFileInvoiceDollar,
    faCopy,
    faShareNodes,
    faReceipt,
    faSave,
    faSearch,
    faSpinner,
    faTriangleExclamation,
    faUsers,
    faXmark,
    faCamera,
    faChevronLeft,
    faChevronRight
} from '@fortawesome/free-solid-svg-icons';
import * as XLSX from 'xlsx-js-style';
import { saveAs } from 'file-saver';
import {
    generateLaborStatementExcel,
    MAX_DAY_COLUMNS,
    DAY_LABELS_FIRST,
    DAY_LABELS_SECOND,
    SupportLaborStatementExcelBlock
} from '../../utils/excel/SupportPaymentExcelGenerator';
import { Team, teamService } from '../../services/teamService';
import { Company, companyService } from '../../services/companyService';
import { Site, siteService } from '../../services/siteService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { dailyReportService, DailyReport, DailyReportWorker } from '../../services/dailyReportService';
import { SupportRate, supportRateService } from '../../services/supportRateService';
import { teamExpenseLedgerService } from '../../services/teamExpenseLedgerService';
import { statementOutputService } from '../../services/statementOutputService';
import type { TeamExpenseClaim } from '../../types/teamExpenseLedger';
import type { StatementOutputRecord } from '../../types/statementOutput';
import {
    getLaborStatementWorkerPayType,
    getWorkerMasterLaborStatementPayType,
    loadLaborStatementPresetDefaults,
    loadStatementIssueOptionPreset,
    saveLaborStatementPresetDefaults,
    saveStatementIssueOptionPreset,
    STATEMENT_ISSUE_OPTION_PRESETS,
    type StatementIssueOptionPreset,
    type SharedLaborStatementPayType
} from '../../utils/payrollLaborStatementDefaults';
import { BANK_CODES } from './team-payment/types';
import html2canvas from 'html2canvas';
import { db, storage } from '../../config/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { getDownloadURL, ref } from 'firebase/storage';
import PayrollIssueTopTabs from '../../components/payroll/PayrollIssueTopTabs';

type SupportStatementPayType = SharedLaborStatementPayType;

interface SupportLaborExcelRow {
    aggregateId: string;
    workerId: string;
    workerName: string;
    idNumber: string;
    address: string;
    siteAddress?: string;
    days: number[];
    totalManDay: number;
    unitPrice: number;
    totalAmount: number;
    billingUnitPrice: number;
    billingAmount: number;
    vatAmount: number;
    issuedAmount: number;
    paymentMethod?: string;
    displayContent: string;
    contact?: string;
    bankCode?: string;
    accountNumber?: string;
    accountHolder?: string;
    description?: string;
    teamId?: string;
    teamNames?: string[];
    bankName?: string;
    siteName?: string;
    siteId?: string;
    payType?: SupportStatementPayType;
    workerLaborStatementPayType?: SupportStatementPayType;
}


interface SupportWorkerBreakdown {
    date: string;
    reportId?: string;
    direction: SupportDirection;
    workerId: string;
    workerName: string;
    role?: string;
    manDay: number;
    unitPrice: number;
    amount: number;
    billingUnitPrice: number;
    billingAmount: number;
    vatAmount: number;
    issuedAmount: number;
    paymentMethod?: string;
    siteId?: string;
    siteName?: string;
    teamId?: string;
    teamName?: string;
    workerTeamId?: string;
    workerTeamName?: string;
    viewTeamId?: string;
    viewTeamName?: string;
    sourceTeamName?: string;
    targetTeamName?: string;
    siteResponsibleTeamId?: string;
    siteResponsibleTeamName?: string;
    settlementTeamId?: string;
    settlementTeamName?: string;
    sourceCompanyName?: string;
    targetCompanyName?: string;
    counterpartyName?: string;
    evidenceNote?: string;
}

type SupportDirection = '내부지원간곳' | '내부지원온곳' | '외부지원간곳' | '외부지원온곳';
type SupportTeamPaymentScope = 'external' | 'incoming' | 'internalOut' | 'internalIn';

interface SupportSiteRow {
    siteId: string;
    siteName: string;
    direction: SupportDirection;
    viewTeamId: string;
    viewTeamName: string;
    sourceTeamIds: string[];
    sourceTeamNames: string[];
    sourceTeamName: string;
    counterpartyName: string;
    evidenceNote: string;
    settlementRule: string;
    totalManDay: number;
    totalAmount: number;
    billingAmount: number;
    vatAmount: number;
    issuedAmount: number;
    paymentMethod: string;
    expenseClaimAmount: number;
    expenseClaimCount: number;
    expenseClaims: TeamExpenseClaim[];
    unitPriceSamples: number[];
    billingUnitPriceSamples: number[];
    displayContent: string;
    workers: SupportWorkerBreakdown[];
}

interface SupportCompanyAggregate {
    aggregateId: string;
    direction: SupportDirection;
    settlementTeamId: string;
    settlementTeamName: string;
    settlementRole: 'charge' | 'pay';
    settlementRule: string;
    viewTeamId: string;
    viewTeamName: string;
    companyId: string;
    companyName: string;
    sourceTeamIds: string[];
    sourceTeamNames: string[];
    sourceTeamId: string;
    sourceTeamName: string;
    counterpartyName: string;
    evidenceNote: string;
    bankName: string;
    bankCode: string;
    accountNumber: string;
    accountHolder: string;
    totalManDay: number;
    totalAmount: number;
    billingAmount: number;
    vatAmount: number;
    issuedAmount: number;
    targetTeamName?: string; // 지원을 받는 팀 (현장 담당팀)
    sites: SupportSiteRow[];
    errors: {
        bankName?: boolean;
        bankCode?: boolean;
        accountNumber?: boolean;
        accountHolder?: boolean;
    };
}


type StatementTargetSelection = {
    aggregateId: string;
    siteKey?: string;
} | null;

interface SitePreviewBlock {
    aggregate: SupportCompanyAggregate;
    site: SupportSiteRow;
    rows: SupportLaborExcelRow[];
}

interface SupportLaborStatementViewOptions {
    showBankColumn: boolean;
    showBillingColumns: boolean;
    isSplitView: boolean;
    showBankUnderAddress: boolean;
    showTeamUnderName: boolean;
}

interface SupportLaborStatementOptions {
    unitPriceOverride: number;
    defaultPayType: SupportStatementPayType;
    workerPayTypes: Record<string, SupportStatementPayType>;
    delegateBankName: string;
    delegateAccountHolder: string;
    delegateAccountNumber: string;
}

interface SupportExchangeSummaryRow {
    aggregateId: string;
    direction: SupportDirection;
    sourceTeamName: string;
    counterpartyName: string;
    supportOutTeamName: string;
    supportInTeamName: string;
    siteResponsibleTeamName: string;
    companyName: string;
    bankName: string;
    accountNumber: string;
    accountHolder: string;
    siteId: string;
    siteName: string;
    workerCount: number;
    totalManDay: number;
    totalAmount: number;
    issuedAmount: number;
    evidenceNote: string;
}

interface SupportManualAdjustment {
    additionalAmount: number;
    progressStatus: SupportProgressStatus;
    remark: string;
    etc: string;
}

type SupportManualAdjustments = Record<string, SupportManualAdjustment>;

type SupportProgressStatus =
    | ''
    | 'depositComplete'
    | 'dawinIssued'
    | 'cheongyeonIssued'
    | 'laborProcessed'
    | 'issueRequested';

interface SupportProgressOption {
    value: Exclude<SupportProgressStatus, ''>;
    label: string;
    color: string;
    rowColor: string;
}

interface SupportMonthlyRateOverrides {
    bulkSupportRate?: number;
    bulkRate?: number;
    supportTeamRates: Record<string, number>;
    supportAggregateRates: Record<string, number>;
    supportSiteRates: Record<string, number>;
    teamRates: Record<string, number>;
    aggregateRates: Record<string, number>;
    siteRates: Record<string, number>;
}

const normalize = (value: string | undefined | null): string => (value ?? '').replace(/\s+/g, '').trim();
const normalizeName = (value: string | undefined | null): string =>
    (value ?? '').replace(/\(.*?\)/g, '').replace(/\s+/g, '').trim();
const normalizePaymentMethod = (value?: string | null): string => {
    const raw = String(value ?? '').trim();
    if (!raw) return '미지정';
    if (raw.includes('계산서')) return '계산서';
    if (raw.includes('노무')) return '노무';
    return raw;
};
const isTaxInvoicePaymentMethod = (value?: string | null): boolean =>
    normalizePaymentMethod(value) === '계산서';
const summarizePaymentMethods = (values: Array<string | undefined | null>, fallback = '미지정'): string => {
    const unique = Array.from(new Set(values.map(normalizePaymentMethod).filter((value) => value && value !== '미지정')));
    if (unique.length === 0) return fallback;
    return unique.length === 1 ? unique[0] : '혼합';
};
const getPaymentMethodBadgeClassName = (paymentMethod?: string | null): string => {
    if (isTaxInvoicePaymentMethod(paymentMethod)) return 'border-amber-300 bg-amber-100 text-amber-800';
    if (normalizePaymentMethod(paymentMethod) === '노무') return 'border-sky-200 bg-sky-50 text-sky-700';
    return 'border-slate-200 bg-slate-50 text-slate-500';
};
const calculateBillingAmounts = (
    manDay: number,
    billingUnitPrice: number
): { billingAmount: number; vatAmount: number; issuedAmount: number } => {
    const billingAmount = Math.round(Math.max(0, manDay) * Math.max(0, Math.round(billingUnitPrice)));
    return {
        billingAmount,
        // 지원팀 정산은 현장의 계산서 여부와 무관하므로 세금을 자동 반영하지 않는다.
        vatAmount: 0,
        issuedAmount: billingAmount
    };
};
const buildTeamIdentityKeys = (teamId?: string | null, teamName?: string | null): string[] =>
    Array.from(new Set([normalize(teamId), normalizeName(teamName)].filter(Boolean)));
const isSameTeamIdentity = (
    leftTeamId?: string | null,
    leftTeamName?: string | null,
    rightTeamId?: string | null,
    rightTeamName?: string | null
): boolean => {
    const leftKeys = buildTeamIdentityKeys(leftTeamId, leftTeamName);
    const rightKeys = buildTeamIdentityKeys(rightTeamId, rightTeamName);
    return leftKeys.length > 0 && rightKeys.length > 0 && leftKeys.some((key) => rightKeys.includes(key));
};
const CHEONGYEON_COMPANY_NAME_KEYS = [normalizeName('청연이엔지'), normalizeName('청연')].filter(Boolean);
const isCheongyeonCompanyName = (name?: string | null): boolean => {
    const normalized = normalizeName(name);
    if (!normalized) return false;
    return CHEONGYEON_COMPANY_NAME_KEYS.some((key) =>
        normalized.includes(key) || (normalized.length >= 2 && key.includes(normalized))
    );
};
const normalizeSalaryModel = (value: unknown): string => {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    if (raw.includes('지원')) return '지원팀';
    if (raw.includes('월급')) return '월급제';
    if (raw.includes('일급')) return '일급제';
    if (raw.includes('용역')) return '용역팀';
    return raw;
};

const formatNumber = (value: number) => new Intl.NumberFormat('ko-KR').format(value);
const formatDayValue = (value: number): string => {
    if (!value) return '';
    const fixed = Number(value.toFixed(1));
    return fixed % 1 === 0 ? fixed.toFixed(0) : fixed.toFixed(1);
};

const DEFAULT_SUPPORT_UNIT_PRICE = 230000;
const SUPPORT_MANUAL_STORAGE_PREFIX = 'support-team-payment-manual-v1';
const SUPPORT_RATE_OVERRIDE_STORAGE_PREFIX = 'support-team-payment-rate-overrides-v1';
const SUPPORT_LABOR_STATEMENT_SPLIT_WIDTHS = {
    no: 42,
    name: 100,
    identity: 132,
    address: 250,
    day: 30,
    total: 70,
    amount: 157,
    bank: 120,
};
const SUPPORT_LABOR_STATEMENT_FULL_WIDTHS = {
    no: 44,
    name: 102,
    identity: 128,
    address: 250,
    day: 26,
    total: 68,
    unitAmount: 110,
    totalAmount: 132,
    bank: 120,
};
const DEFAULT_SUPPORT_LABOR_STATEMENT_VIEW_OPTIONS: SupportLaborStatementViewOptions = {
    showBankColumn: false,
    showBillingColumns: false,
    isSplitView: true,
    showBankUnderAddress: false,
    showTeamUnderName: false,
};
const loadSupportLaborStatementDefaults = (
    preset: StatementIssueOptionPreset = loadStatementIssueOptionPreset()
) => loadLaborStatementPresetDefaults(preset);
const SUPPORT_PROGRESS_OPTIONS: SupportProgressOption[] = [
    { value: 'depositComplete', label: '입금완료', color: '#ffe6a0', rowColor: '#fff4cf' },
    { value: 'dawinIssued', label: '계산서(다윈)', color: '#b8e6ff', rowColor: '#dff4ff' },
    { value: 'cheongyeonIssued', label: '계산서(청연)', color: '#fff38f', rowColor: '#fff9d0' },
    { value: 'laborProcessed', label: '노무', color: '#b6ebcd', rowColor: '#ddf6e7' },
    { value: 'issueRequested', label: '발행요청', color: '#ffc4ea', rowColor: '#ffe2f4' }
];

const getManualStorageKey = (yearMonth: string): string => `${SUPPORT_MANUAL_STORAGE_PREFIX}:${yearMonth}`;
const getRateOverrideStorageKey = (yearMonth: string): string => `${SUPPORT_RATE_OVERRIDE_STORAGE_PREFIX}:${yearMonth}`;

const isSupportProgressStatus = (value: unknown): value is SupportProgressStatus =>
    value === '' || SUPPORT_PROGRESS_OPTIONS.some(option => option.value === value);

const getSupportProgressOption = (value: SupportProgressStatus | undefined): SupportProgressOption | undefined =>
    SUPPORT_PROGRESS_OPTIONS.find(option => option.value === value);

const normalizeManualAdjustment = (value: Partial<SupportManualAdjustment> | undefined): SupportManualAdjustment => ({
    additionalAmount: typeof value?.additionalAmount === 'number' && Number.isFinite(value.additionalAmount)
        ? Math.max(0, Math.round(value.additionalAmount))
        : 0,
    progressStatus: isSupportProgressStatus(value?.progressStatus) ? value.progressStatus : '',
    remark: String(value?.remark ?? ''),
    etc: String(value?.etc ?? '')
});

const loadManualAdjustments = (yearMonth: string): SupportManualAdjustments => {
    if (typeof window === 'undefined' || !yearMonth) return {};
    try {
        const raw = window.localStorage.getItem(getManualStorageKey(yearMonth));
        if (!raw) return {};
        const parsed = JSON.parse(raw) as Record<string, Partial<SupportManualAdjustment>>;
        return Object.entries(parsed).reduce<SupportManualAdjustments>((acc, [key, value]) => {
            acc[key] = normalizeManualAdjustment(value);
            return acc;
        }, {});
    } catch (error) {
        console.warn('[SupportTeamPaymentPage] manual adjustment load failed:', error);
        return {};
    }
};

const saveManualAdjustments = (yearMonth: string, adjustments: SupportManualAdjustments): void => {
    if (typeof window === 'undefined' || !yearMonth) return;
    try {
        window.localStorage.setItem(getManualStorageKey(yearMonth), JSON.stringify(adjustments));
    } catch (error) {
        console.warn('[SupportTeamPaymentPage] manual adjustment save failed:', error);
    }
};

const normalizeRateOverrides = (value: Partial<SupportMonthlyRateOverrides> | undefined): SupportMonthlyRateOverrides => {
    const normalizeRateMap = (raw: unknown): Record<string, number> => {
        if (!raw || typeof raw !== 'object') return {};
        return Object.entries(raw as Record<string, unknown>).reduce<Record<string, number>>((acc, [key, rate]) => {
            const parsed = toPositiveRate(rate);
            if (parsed) acc[key] = parsed;
            return acc;
        }, {});
    };

    return {
        bulkSupportRate: toPositiveRate(value?.bulkSupportRate) ?? undefined,
        bulkRate: toPositiveRate(value?.bulkRate) ?? undefined,
        supportTeamRates: normalizeRateMap(value?.supportTeamRates),
        supportAggregateRates: normalizeRateMap(value?.supportAggregateRates),
        supportSiteRates: normalizeRateMap(value?.supportSiteRates),
        teamRates: normalizeRateMap(value?.teamRates),
        aggregateRates: normalizeRateMap(value?.aggregateRates),
        siteRates: normalizeRateMap(value?.siteRates)
    };
};

const loadRateOverrides = (yearMonth: string): SupportMonthlyRateOverrides => {
    if (typeof window === 'undefined' || !yearMonth) return normalizeRateOverrides(undefined);
    try {
        const raw = window.localStorage.getItem(getRateOverrideStorageKey(yearMonth));
        if (!raw) return normalizeRateOverrides(undefined);
        return normalizeRateOverrides(JSON.parse(raw) as Partial<SupportMonthlyRateOverrides>);
    } catch (error) {
        console.warn('[SupportTeamPaymentPage] rate override load failed:', error);
        return normalizeRateOverrides(undefined);
    }
};

const saveRateOverrides = (yearMonth: string, overrides: SupportMonthlyRateOverrides): void => {
    if (typeof window === 'undefined' || !yearMonth) return;
    try {
        window.localStorage.setItem(getRateOverrideStorageKey(yearMonth), JSON.stringify(normalizeRateOverrides(overrides)));
    } catch (error) {
        console.warn('[SupportTeamPaymentPage] rate override save failed:', error);
    }
};

const parseMoneyInput = (value: string): number => {
    const normalized = value.replace(/[^0-9.-]/g, '');
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.round(parsed));
};

const parseCurrencyAmount = (value?: string): number => parseMoneyInput(String(value ?? ''));
const normalizeCurrencyAmountInput = (value: string): string =>
    value.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');

const formatStatementDayManDay = (value: number): string => formatDayValue(value);

const toPositiveRate = (value: unknown): number | null => {
    const parsed = typeof value === 'number'
        ? value
        : typeof value === 'string'
            ? Number(value.replace(/,/g, ''))
            : NaN;
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return Math.round(parsed);
};

const getMonthRange = (yearMonth: string): { start: string; end: string } => {
    const [yearStr, monthStr] = yearMonth.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    const safeYear = Number.isFinite(year) ? year : new Date().getFullYear();
    const safeMonth = Number.isFinite(month) ? month : new Date().getMonth() + 1;
    const startDate = new Date(safeYear, safeMonth - 1, 1);
    const endDate = new Date(safeYear, safeMonth, 0);

    const toISO = (date: Date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    return { start: toISO(startDate), end: toISO(endDate) };
};

const formatFullIdNumber = (value?: string | null): string => {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    const digits = raw.replace(/[^0-9]/g, '');
    if (digits.length === 13) return `${digits.slice(0, 6)}-${digits.slice(6)}`;
    return raw;
};

const EXTERNAL_SUPPORT_OUT_DIRECTION: SupportDirection = '외부지원간곳';
const EXTERNAL_SUPPORT_SITE_DISPLAY_NAME = '외부지원간곳';
const EXTERNAL_SUPPORT_SITE_TOTAL_LABEL = '외부지원간곳 전체';
const SUPPORT_DIRECTION_ORDER: SupportDirection[] = [EXTERNAL_SUPPORT_OUT_DIRECTION, '외부지원온곳', '내부지원간곳', '내부지원온곳'];
const EXTERNAL_SUPPORT_DIRECTIONS: SupportDirection[] = [EXTERNAL_SUPPORT_OUT_DIRECTION];
const INCOMING_SUPPORT_DIRECTIONS: SupportDirection[] = ['외부지원온곳'];
const INTERNAL_SUPPORT_OUT_DIRECTIONS: SupportDirection[] = ['내부지원간곳'];
const INTERNAL_SUPPORT_IN_DIRECTIONS: SupportDirection[] = ['내부지원온곳'];

const SUPPORT_SCOPE_CONFIG: Record<SupportTeamPaymentScope, {
    title: string;
    description: string;
    directions: SupportDirection[];
}> = {
    external: {
        title: '외부지원간곳',
        description: '외부지원간곳을 현장담당팀 기준으로 자동 정산합니다.',
        directions: EXTERNAL_SUPPORT_DIRECTIONS
    },
    incoming: {
        title: '외부지원온곳',
        description: '외부지원온곳만 분리해 작업팀 기준으로 지급 정산합니다.',
        directions: INCOMING_SUPPORT_DIRECTIONS
    },
    internalOut: {
        title: '내부지원간곳',
        description: '내부지원간곳을 작업팀 기준으로 묶고, 같은 팀 현장 투입은 제외합니다.',
        directions: INTERNAL_SUPPORT_OUT_DIRECTIONS
    },
    internalIn: {
        title: '내부지원온곳',
        description: '내부지원온곳을 현장담당팀 기준으로 묶고, 같은 팀 현장 투입은 제외합니다.',
        directions: INTERNAL_SUPPORT_IN_DIRECTIONS
    }
};

const getDefaultSelectedDirection = (scope: SupportTeamPaymentScope): 'all' | SupportDirection => {
    const directions = SUPPORT_SCOPE_CONFIG[scope].directions;
    return directions.length === 1 ? directions[0] : 'all';
};

const getDefaultExpandedDirectionGroups = (directions: SupportDirection[]): Set<SupportDirection> =>
    directions.includes(EXTERNAL_SUPPORT_OUT_DIRECTION)
        ? new Set<SupportDirection>([EXTERNAL_SUPPORT_OUT_DIRECTION])
        : new Set<SupportDirection>();

const SUPPORT_DIRECTION_META: Record<SupportDirection, { label: string; cellClass: string; badgeClass: string; rule: string }> = {
    외부지원간곳: {
        label: EXTERNAL_SUPPORT_SITE_DISPLAY_NAME,
        cellClass: 'bg-yellow-100 text-yellow-900',
        badgeClass: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        rule: '지원간곳은 현장담당팀(현장을 맡은 팀)을 정산 주체로 묶어 청구합니다.'
    },
    외부지원온곳: {
        label: '외부지원온곳',
        cellClass: 'bg-orange-100 text-orange-900',
        badgeClass: 'bg-orange-100 text-orange-800 border-orange-200',
        rule: '지원온곳은 작업팀(현장에서 일한 작업자의 소속팀)을 정산 주체로 묶어 지급합니다.'
    },
    내부지원간곳: {
        label: '내부지원간곳',
        cellClass: 'bg-sky-100 text-sky-900',
        badgeClass: 'bg-sky-100 text-sky-800 border-sky-200',
        rule: '지원간곳은 작업팀 기준으로 청연 소속 다른 팀 현장 투입을 묶습니다.'
    },
    내부지원온곳: {
        label: '내부지원온곳',
        cellClass: 'bg-indigo-100 text-indigo-900',
        badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-200',
        rule: '지원온곳은 현장담당팀 기준으로 청연 소속 다른 작업팀 투입을 묶습니다.'
    }
};

const getSettlementRole = (direction: SupportDirection): 'charge' | 'pay' =>
    direction.endsWith('간곳') ? 'charge' : 'pay';

const getSettlementBasisLabel = (direction: SupportDirection): '현장담당팀' | '작업팀' =>
    direction === '내부지원간곳' || direction === '외부지원온곳' ? '작업팀' : '현장담당팀';

const uniqueValues = (values: Array<string | undefined | null>): string[] => {
    const seen = new Set<string>();
    values.forEach((value) => {
        const trimmed = String(value ?? '').trim();
        if (trimmed) seen.add(trimmed);
    });
    return Array.from(seen);
};

const summarizeNames = (names: Array<string | undefined | null>, fallback = '팀 미지정'): string => {
    const unique = uniqueValues(names);
    return unique.length > 0 ? unique.join(', ') : fallback;
};

const isSameIdentity = (a?: string | null, b?: string | null): boolean =>
    !!normalize(a) && normalize(a) === normalize(b);

const matchesTeamReference = (
    leftId?: string | null,
    leftName?: string | null,
    rightId?: string | null,
    rightName?: string | null
): boolean => (
    isSameIdentity(leftId, rightId) ||
    (!!normalizeName(leftName) && normalizeName(leftName) === normalizeName(rightName))
);

const matchesSiteReference = (
    claim: Pick<TeamExpenseClaim, 'siteId' | 'siteName'>,
    site: Pick<SupportSiteRow, 'siteId' | 'siteName'>
): boolean => (
    isSameIdentity(claim.siteId, site.siteId) ||
    (!!normalizeName(claim.siteName) && normalizeName(claim.siteName) === normalizeName(site.siteName))
);

const matchesViewTeamIdentity = (aggregate: SupportCompanyAggregate, teamIdOrName: string): boolean =>
    isSameIdentity(aggregate.viewTeamId, teamIdOrName) ||
    (!!normalizeName(teamIdOrName) && normalizeName(aggregate.viewTeamName) === normalizeName(teamIdOrName));

const recalcSiteFromWorkers = (site: SupportSiteRow, workers: SupportWorkerBreakdown[]): SupportSiteRow => {
    const sourceTeamIds = uniqueValues(workers.map((worker) => worker.workerTeamId ?? worker.teamId));
    const sourceTeamNames = uniqueValues(workers.map((worker) => worker.workerTeamName ?? worker.teamName));
    const paymentMethod = normalizePaymentMethod(site.paymentMethod || summarizePaymentMethods(workers.map((worker) => worker.paymentMethod)));
    return {
        ...site,
        paymentMethod,
        sourceTeamIds,
        sourceTeamNames,
        sourceTeamName: summarizeNames(sourceTeamNames),
        totalManDay: workers.reduce((sum, worker) => sum + worker.manDay, 0),
        totalAmount: workers.reduce((sum, worker) => sum + worker.amount, 0),
        billingAmount: workers.reduce((sum, worker) => sum + (worker.billingAmount ?? Math.round(worker.manDay * worker.billingUnitPrice)), 0),
        vatAmount: workers.reduce((sum, worker) => sum + (worker.vatAmount ?? 0), 0),
        issuedAmount: workers.reduce((sum, worker) => sum + worker.issuedAmount, 0),
        unitPriceSamples: workers.map((worker) => worker.unitPrice).filter((unitPrice) => unitPrice > 0),
        billingUnitPriceSamples: workers.map((worker) => worker.billingUnitPrice).filter((unitPrice) => unitPrice > 0),
        workers
    };
};

const recalcAggregateFromSites = (aggregate: SupportCompanyAggregate, sites: SupportSiteRow[]): SupportCompanyAggregate => {
    const allWorkers = sites.flatMap((site) => site.workers);
    const sourceTeamIds = uniqueValues(allWorkers.map((worker) => worker.workerTeamId ?? worker.teamId));
    const sourceTeamNames = uniqueValues(allWorkers.map((worker) => worker.workerTeamName ?? worker.teamName));
    return {
        ...aggregate,
        sourceTeamIds,
        sourceTeamNames,
        sourceTeamId: sourceTeamIds[0] ?? '',
        sourceTeamName: summarizeNames(sourceTeamNames),
        totalManDay: sites.reduce((sum, site) => sum + site.totalManDay, 0),
        totalAmount: sites.reduce((sum, site) => sum + site.totalAmount, 0),
        billingAmount: sites.reduce((sum, site) => sum + site.billingAmount, 0),
        vatAmount: sites.reduce((sum, site) => sum + site.vatAmount, 0),
        issuedAmount: sites.reduce((sum, site) => sum + site.issuedAmount, 0),
        sites
    };
};

const getSettlementMergeKey = (aggregate: SupportCompanyAggregate): string => [
    aggregate.direction,
    normalize(aggregate.settlementTeamId) ||
        normalize(aggregate.companyId) ||
        normalizeName(aggregate.settlementTeamName) ||
        normalizeName(aggregate.companyName) ||
        'unknown-settlement'
].join('::');

const MERGED_AGGREGATE_PREFIX = 'merged::';

const getMergedAggregateId = (mergeKey: string): string => `${MERGED_AGGREGATE_PREFIX}${mergeKey}`;

const isMergedAggregateId = (aggregateId: string): boolean => aggregateId.startsWith(MERGED_AGGREGATE_PREFIX);

const getAggregateEditMatchKey = (aggregate: SupportCompanyAggregate): string =>
    isMergedAggregateId(aggregate.aggregateId)
        ? aggregate.aggregateId.slice(MERGED_AGGREGATE_PREFIX.length)
        : getSettlementMergeKey(aggregate);

const matchesAggregateEditTarget = (
    candidate: SupportCompanyAggregate,
    target: SupportCompanyAggregate
): boolean => (
    candidate.aggregateId === target.aggregateId ||
    (isMergedAggregateId(target.aggregateId) && getSettlementMergeKey(candidate) === getAggregateEditMatchKey(target))
);

const getAggregateEditTargetIds = (
    rows: SupportCompanyAggregate[],
    target: SupportCompanyAggregate
): string[] => {
    const ids = rows
        .filter((aggregate) => matchesAggregateEditTarget(aggregate, target))
        .map((aggregate) => aggregate.aggregateId);
    return ids.length > 0 ? ids : [target.aggregateId];
};

const mergeSitesByIdentity = (sites: SupportSiteRow[]): SupportSiteRow[] => {
    const siteMap = new Map<string, SupportSiteRow>();

    sites.forEach((site) => {
        const key = normalize(site.siteId) || normalizeName(site.siteName) || `unknown-site-${siteMap.size}`;
        const existing = siteMap.get(key);
        if (!existing) {
            siteMap.set(key, {
                ...site,
                sourceTeamIds: [...site.sourceTeamIds],
                sourceTeamNames: [...site.sourceTeamNames],
                expenseClaimAmount: site.expenseClaimAmount ?? 0,
                expenseClaimCount: site.expenseClaimCount ?? 0,
                expenseClaims: dedupeExpenseClaims(site.expenseClaims ?? []),
                billingAmount: site.billingAmount ?? 0,
                vatAmount: site.vatAmount ?? 0,
                paymentMethod: normalizePaymentMethod(site.paymentMethod),
                unitPriceSamples: [...site.unitPriceSamples],
                billingUnitPriceSamples: [...site.billingUnitPriceSamples],
                workers: [...site.workers]
            });
            return;
        }

        existing.workers = [...existing.workers, ...site.workers];
        existing.expenseClaims = dedupeExpenseClaims([...(existing.expenseClaims ?? []), ...(site.expenseClaims ?? [])]);
        existing.expenseClaimAmount = getExpenseClaimsTotal(existing.expenseClaims);
        existing.expenseClaimCount = existing.expenseClaims.length;
        existing.billingAmount += site.billingAmount ?? 0;
        existing.vatAmount += site.vatAmount ?? 0;
        existing.paymentMethod = summarizePaymentMethods([existing.paymentMethod, site.paymentMethod]);
        existing.unitPriceSamples = [...existing.unitPriceSamples, ...site.unitPriceSamples];
        existing.billingUnitPriceSamples = [...existing.billingUnitPriceSamples, ...site.billingUnitPriceSamples];
        existing.sourceTeamIds = uniqueValues([...existing.sourceTeamIds, ...site.sourceTeamIds]);
        existing.sourceTeamNames = uniqueValues([...existing.sourceTeamNames, ...site.sourceTeamNames]);
        existing.viewTeamName = summarizeNames([existing.viewTeamName, site.viewTeamName]);
        existing.sourceTeamName = summarizeNames([...existing.sourceTeamNames]);
    });

    return Array.from(siteMap.values())
        .map((site) => {
            const workers = [...site.workers].sort((a, b) => a.workerName.localeCompare(b.workerName, 'ko-KR'));
            const recalculated = recalcSiteFromWorkers(site, workers);
            return {
                ...recalculated,
                viewTeamName: summarizeNames(workers.map((worker) => worker.viewTeamName), site.viewTeamName),
                viewTeamId: uniqueValues(workers.map((worker) => worker.viewTeamId))[0] ?? site.viewTeamId
            };
        })
        .sort((a, b) => a.siteName.localeCompare(b.siteName, 'ko-KR'));
};

const mergeAggregatesBySettlementTeam = (rows: SupportCompanyAggregate[]): SupportCompanyAggregate[] => {
    const grouped = new Map<string, SupportCompanyAggregate[]>();
    rows.forEach((aggregate) => {
        const key = getSettlementMergeKey(aggregate);
        grouped.set(key, [...(grouped.get(key) ?? []), aggregate]);
    });

    return Array.from(grouped.entries())
        .map(([key, group]) => {
            if (group.length === 1) return group[0];

            const base = group[0];
            const viewTeamIds = uniqueValues(group.map((aggregate) => aggregate.viewTeamId));
            const viewTeamNames = uniqueValues(group.map((aggregate) => aggregate.viewTeamName));
            const sourceTeamIds = uniqueValues(group.flatMap((aggregate) => aggregate.sourceTeamIds));
            const sourceTeamNames = uniqueValues(group.flatMap((aggregate) => aggregate.sourceTeamNames));
            const sites = mergeSitesByIdentity(group.flatMap((aggregate) => aggregate.sites));
            const mergedErrors = group.reduce<SupportCompanyAggregate['errors']>((acc, aggregate) => ({
                bankName: acc.bankName || aggregate.errors.bankName,
                bankCode: acc.bankCode || aggregate.errors.bankCode,
                accountNumber: acc.accountNumber || aggregate.errors.accountNumber,
                accountHolder: acc.accountHolder || aggregate.errors.accountHolder
            }), {});

            const merged = recalcAggregateFromSites({
                ...base,
                aggregateId: getMergedAggregateId(key),
                viewTeamId: viewTeamIds[0] ?? '',
                viewTeamName: summarizeNames(viewTeamNames, '기준팀 복수'),
                sourceTeamIds,
                sourceTeamNames,
                sourceTeamId: sourceTeamIds[0] ?? '',
                sourceTeamName: summarizeNames(sourceTeamNames),
                errors: mergedErrors
            }, sites);

            return {
                ...merged,
                viewTeamId: viewTeamIds[0] ?? '',
                viewTeamName: summarizeNames(viewTeamNames, '기준팀 복수'),
                sourceTeamIds,
                sourceTeamNames,
                sourceTeamId: sourceTeamIds[0] ?? '',
                sourceTeamName: summarizeNames(sourceTeamNames)
            };
        })
        .sort((a, b) =>
            SUPPORT_DIRECTION_ORDER.indexOf(a.direction) - SUPPORT_DIRECTION_ORDER.indexOf(b.direction) ||
            a.companyName.localeCompare(b.companyName, 'ko-KR')
        );
};

const getWorkerFlowLabel = (worker: SupportWorkerBreakdown, _site: SupportSiteRow): string => {
    const from = worker.workerTeamName || worker.teamName || '작업팀 미지정';
    const to = worker.siteResponsibleTeamName || worker.targetTeamName || '현장담당팀 미지정';
    return `작업팀 ${from} → 현장담당팀 ${to}`;
};

const getAggregateUnitPrice = (aggregate: SupportCompanyAggregate): number => {
    if (aggregate.totalManDay > 0) return Math.round(aggregate.totalAmount / aggregate.totalManDay);
    const sample = aggregate.sites.flatMap((site) => site.unitPriceSamples)[0];
    return Math.round(sample ?? 0);
};

const getSiteUnitPrice = (site: SupportSiteRow): number => {
    if (site.totalManDay > 0) return Math.round(site.totalAmount / site.totalManDay);
    return Math.round(site.unitPriceSamples[0] ?? 0);
};

const getAggregateBillingUnitPrice = (aggregate: SupportCompanyAggregate): number => {
    if (aggregate.totalManDay > 0) return Math.round((aggregate.billingAmount || aggregate.totalAmount) / aggregate.totalManDay);
    const sample = aggregate.sites.flatMap((site) => site.billingUnitPriceSamples)[0];
    return Math.round(sample ?? getAggregateUnitPrice(aggregate));
};

const getSiteBillingUnitPrice = (site: SupportSiteRow): number => {
    if (site.totalManDay > 0) return Math.round((site.billingAmount || site.totalAmount) / site.totalManDay);
    return Math.round(site.billingUnitPriceSamples[0] ?? getSiteUnitPrice(site));
};

const applyBillingUnitPriceToSite = (site: SupportSiteRow, billingUnitPrice: number): SupportSiteRow => {
    const normalizedRate = Math.max(0, Math.round(billingUnitPrice));
    const workers = site.workers.map((worker) => ({
        ...worker,
        billingUnitPrice: normalizedRate,
        ...calculateBillingAmounts(worker.manDay, normalizedRate)
    }));
    return recalcSiteFromWorkers(site, workers);
};

const applyBillingUnitPriceToAggregate = (aggregate: SupportCompanyAggregate, billingUnitPrice: number): SupportCompanyAggregate =>
    recalcAggregateFromSites(
        aggregate,
        aggregate.sites.map((site) => applyBillingUnitPriceToSite(site, billingUnitPrice))
    );

const applyUnitPriceToSite = (site: SupportSiteRow, unitPrice: number): SupportSiteRow => {
    const normalizedRate = Math.max(0, Math.round(unitPrice));
    const workers = site.workers.map((worker) => {
        const amount = Math.round(worker.manDay * normalizedRate);
        const { vatAmount, issuedAmount } = calculateBillingAmounts(worker.manDay, worker.billingUnitPrice);
        return {
            ...worker,
            unitPrice: normalizedRate,
            amount,
            vatAmount,
            issuedAmount
        };
    });
    return recalcSiteFromWorkers(site, workers);
};

const applyUnitPriceToAggregate = (aggregate: SupportCompanyAggregate, unitPrice: number): SupportCompanyAggregate =>
    recalcAggregateFromSites(
        aggregate,
        aggregate.sites.map((site) => applyUnitPriceToSite(site, unitPrice))
    );

const getMonthlySiteRateKey = (aggregateId: string, siteId: string): string => `${aggregateId}::${siteId}`;

const getAggregateSiteRowKey = (aggregate: SupportCompanyAggregate, site: SupportSiteRow): string =>
    `${aggregate.aggregateId}::${normalize(site.siteId) || normalizeName(site.siteName) || 'unknown-site'}`;

const getSupportLaborStatementWorkerKey = (
    row: Pick<SupportLaborExcelRow, 'workerId' | 'workerName'>
): string => row.workerId || row.workerName || 'unknown-worker';

const buildSupportLaborWorkerPayTypesFromDefaults = (
    rows: SupportLaborExcelRow[],
    useWorkerMasterPayType?: boolean,
    defaults = loadLaborStatementPresetDefaults(loadStatementIssueOptionPreset())
): Record<string, SupportStatementPayType> => {
    const shouldUseWorkerMasterPayType = typeof useWorkerMasterPayType === 'boolean'
        ? useWorkerMasterPayType
        : defaults.useWorkerMasterPayType;

    return rows.reduce<Record<string, SupportStatementPayType>>((acc, row) => {
        const payType = (shouldUseWorkerMasterPayType ? row.workerLaborStatementPayType : undefined) ||
            getLaborStatementWorkerPayType(defaults.workerPayTypes, row);
        if (payType) acc[getSupportLaborStatementWorkerKey(row)] = payType;
        return acc;
    }, {});
};

const applySupportLaborStatementOptions = (
    previews: SitePreviewBlock[],
    options: SupportLaborStatementOptions
): SitePreviewBlock[] => previews.map((preview) => ({
    ...preview,
    rows: preview.rows.map((row) => {
        const workerKey = getSupportLaborStatementWorkerKey(row);
        const payType = options.workerPayTypes[workerKey] ?? options.defaultPayType;
        const useDelegateAccount = payType === 'delegate';
        const billingUnitPrice = options.unitPriceOverride > 0
            ? options.unitPriceOverride
            : row.billingUnitPrice;
        const billingAmount = Math.round(Math.max(0, row.totalManDay || 0) * Math.max(0, billingUnitPrice || 0));

        return {
            ...row,
            payType,
            bankName: useDelegateAccount ? options.delegateBankName : row.bankName,
            accountHolder: useDelegateAccount ? options.delegateAccountHolder : row.accountHolder,
            accountNumber: useDelegateAccount ? options.delegateAccountNumber : row.accountNumber,
            billingUnitPrice,
            billingAmount,
            issuedAmount: billingAmount
        };
    })
}));

const buildSupportLaborStatementColumns = (
    viewOptions: SupportLaborStatementViewOptions
): Array<{ key: string; width: number }> => {
    if (viewOptions.isSplitView) {
        const widths = SUPPORT_LABOR_STATEMENT_SPLIT_WIDTHS;
        const columns = [
            { key: 'no', width: widths.no },
            { key: 'name', width: widths.name },
            { key: 'identity', width: widths.identity },
            { key: 'address', width: widths.address },
            ...Array.from({ length: DAY_LABELS_FIRST.length + 1 }, (_, index) => ({
                key: `day-${index}`,
                width: widths.day,
            })),
            { key: 'total', width: widths.total },
        ];
        if (viewOptions.showBillingColumns) columns.push({ key: 'amount', width: widths.amount });
        if (viewOptions.showBankColumn) columns.push({ key: 'bank', width: widths.bank });
        return columns;
    }

    const widths = SUPPORT_LABOR_STATEMENT_FULL_WIDTHS;
    const columns = [
        { key: 'no', width: widths.no },
        { key: 'name', width: widths.name },
        { key: 'identity', width: widths.identity },
        { key: 'address', width: widths.address },
        ...Array.from({ length: MAX_DAY_COLUMNS }, (_, index) => ({
            key: `day-${index}`,
            width: widths.day,
        })),
        { key: 'total', width: widths.total },
    ];
    if (viewOptions.showBillingColumns) {
        columns.push(
            { key: 'unit-amount', width: widths.unitAmount },
            { key: 'total-amount', width: widths.totalAmount },
        );
    }
    if (viewOptions.showBankColumn) columns.push({ key: 'bank', width: widths.bank });
    return columns;
};

interface StatementTargetContext {
    aggregate: SupportCompanyAggregate;
    sourceAggregate: SupportCompanyAggregate;
    site?: SupportSiteRow;
    siteKey?: string;
}

const buildSiteStatementAggregate = (
    aggregate: SupportCompanyAggregate,
    site: SupportSiteRow
): SupportCompanyAggregate => ({
    ...aggregate,
    viewTeamId: site.viewTeamId || aggregate.viewTeamId,
    viewTeamName: site.viewTeamName || aggregate.viewTeamName,
    sourceTeamIds: site.sourceTeamIds,
    sourceTeamNames: site.sourceTeamNames,
    sourceTeamId: site.sourceTeamIds[0] ?? aggregate.sourceTeamId,
    sourceTeamName: site.sourceTeamName || summarizeNames(site.sourceTeamNames, aggregate.sourceTeamName),
    counterpartyName: site.counterpartyName || aggregate.counterpartyName,
    evidenceNote: site.evidenceNote || aggregate.evidenceNote,
    settlementRule: site.settlementRule || aggregate.settlementRule,
    totalManDay: site.totalManDay,
    totalAmount: site.totalAmount,
    billingAmount: site.billingAmount,
    vatAmount: site.vatAmount,
    issuedAmount: site.issuedAmount,
    sites: [site]
});

const resolveStatementTargetContext = (
    selection: StatementTargetSelection,
    rows: SupportCompanyAggregate[]
): StatementTargetContext | null => {
    if (!selection) return null;

    const sourceAggregate = rows.find(aggregate => aggregate.aggregateId === selection.aggregateId);
    if (!sourceAggregate) return null;

    if (!selection.siteKey) {
        return {
            aggregate: sourceAggregate,
            sourceAggregate
        };
    }

    const site = sourceAggregate.sites.find(candidate => getAggregateSiteRowKey(sourceAggregate, candidate) === selection.siteKey);
    if (!site) return null;

    return {
        aggregate: buildSiteStatementAggregate(sourceAggregate, site),
        sourceAggregate,
        site,
        siteKey: selection.siteKey
    };
};

const isSameStatementSelection = (
    selection: StatementTargetSelection,
    aggregateId: string,
    siteKey?: string
): boolean =>
    Boolean(selection) &&
    selection?.aggregateId === aggregateId &&
    (selection?.siteKey ?? '') === (siteKey ?? '');

const getAggregateOverrideRate = (
    aggregate: SupportCompanyAggregate,
    overrides: SupportMonthlyRateOverrides
): number | undefined => {
    const mergedAggregateId = getMergedAggregateId(getSettlementMergeKey(aggregate));
    const teamRateKey = getAggregateEditMatchKey(aggregate);
    return overrides.aggregateRates[aggregate.aggregateId] ??
        overrides.aggregateRates[mergedAggregateId] ??
        overrides.teamRates[teamRateKey];
};

const getSiteOverrideRate = (
    aggregate: SupportCompanyAggregate,
    site: SupportSiteRow,
    overrides: SupportMonthlyRateOverrides
): number | undefined => {
    const mergedAggregateId = getMergedAggregateId(getSettlementMergeKey(aggregate));
    const teamRateKey = getAggregateEditMatchKey(aggregate);
    return overrides.siteRates[getMonthlySiteRateKey(aggregate.aggregateId, site.siteId)] ??
        overrides.siteRates[getMonthlySiteRateKey(mergedAggregateId, site.siteId)] ??
        overrides.siteRates[getMonthlySiteRateKey(teamRateKey, site.siteId)];
};

const getAggregateSupportOverrideRate = (
    aggregate: SupportCompanyAggregate,
    overrides: SupportMonthlyRateOverrides
): number | undefined => {
    const mergedAggregateId = getMergedAggregateId(getSettlementMergeKey(aggregate));
    const teamRateKey = getAggregateEditMatchKey(aggregate);
    return overrides.supportAggregateRates[aggregate.aggregateId] ??
        overrides.supportAggregateRates[mergedAggregateId] ??
        overrides.supportTeamRates[teamRateKey];
};

const getSiteSupportOverrideRate = (
    aggregate: SupportCompanyAggregate,
    site: SupportSiteRow,
    overrides: SupportMonthlyRateOverrides
): number | undefined => {
    const mergedAggregateId = getMergedAggregateId(getSettlementMergeKey(aggregate));
    const teamRateKey = getAggregateEditMatchKey(aggregate);
    return overrides.supportSiteRates[getMonthlySiteRateKey(aggregate.aggregateId, site.siteId)] ??
        overrides.supportSiteRates[getMonthlySiteRateKey(mergedAggregateId, site.siteId)] ??
        overrides.supportSiteRates[getMonthlySiteRateKey(teamRateKey, site.siteId)];
};

const applyMonthlyRateOverrides = (
    rows: SupportCompanyAggregate[],
    overrides: SupportMonthlyRateOverrides
): SupportCompanyAggregate[] => rows.map((aggregate) => {
    let nextAggregate = overrides.bulkSupportRate
        ? applyUnitPriceToAggregate(aggregate, overrides.bulkSupportRate)
        : aggregate;

    const supportAggregateRate = getAggregateSupportOverrideRate(nextAggregate, overrides);
    if (supportAggregateRate) {
        nextAggregate = applyUnitPriceToAggregate(nextAggregate, supportAggregateRate);
    }

    const nextSupportSites = nextAggregate.sites.map((site) => {
        const siteRate = getSiteSupportOverrideRate(nextAggregate, site, overrides);
        return siteRate ? applyUnitPriceToSite(site, siteRate) : site;
    });
    nextAggregate = recalcAggregateFromSites(nextAggregate, nextSupportSites);

    nextAggregate = overrides.bulkRate
        ? applyBillingUnitPriceToAggregate(nextAggregate, overrides.bulkRate)
        : nextAggregate;

    const aggregateRate = getAggregateOverrideRate(nextAggregate, overrides);
    if (aggregateRate) {
        nextAggregate = applyBillingUnitPriceToAggregate(nextAggregate, aggregateRate);
    }

    const nextSites = nextAggregate.sites.map((site) => {
        const siteRate = getSiteOverrideRate(nextAggregate, site, overrides);
        return siteRate ? applyBillingUnitPriceToSite(site, siteRate) : site;
    });

    return recalcAggregateFromSites(nextAggregate, nextSites);
});

const isPostedTeamChargeClaim = (claim: TeamExpenseClaim): boolean =>
    claim.claimType === 'teamCharge' &&
    (claim.status === 'charged' || claim.status === 'settled') &&
    Number(claim.amount || 0) > 0;

const getExpenseClaimAmount = (claim: TeamExpenseClaim): number =>
    Math.max(0, Math.round(Number(claim.amount || 0)));

const getExpenseClaimStatusLabel = (status: TeamExpenseClaim['status']): string => {
    if (status === 'charged') return '청구완료';
    if (status === 'settled') return '정산완료';
    return '작성중';
};

const getExpenseClaimKey = (claim: TeamExpenseClaim): string =>
    claim.id || [
        claim.yearMonth,
        claim.date,
        claim.payerTeamId,
        claim.payerTeamName,
        claim.chargeToTeamId,
        claim.chargeToTeamName,
        claim.siteId,
        claim.siteName,
        claim.category,
        claim.description,
        claim.amount
    ].map(value => String(value ?? '').trim()).join('::');

const sortExpenseClaims = (claims: TeamExpenseClaim[]): TeamExpenseClaim[] =>
    [...claims].sort((a, b) =>
        (a.date || '').localeCompare(b.date || '') ||
        (a.siteName || '').localeCompare(b.siteName || '', 'ko-KR') ||
        (a.description || '').localeCompare(b.description || '', 'ko-KR')
    );

const dedupeExpenseClaims = (claims: TeamExpenseClaim[]): TeamExpenseClaim[] => {
    const claimMap = new Map<string, TeamExpenseClaim>();
    claims.forEach((claim) => {
        claimMap.set(getExpenseClaimKey(claim), claim);
    });
    return sortExpenseClaims(Array.from(claimMap.values()));
};

const getExpenseClaimsTotal = (claims: TeamExpenseClaim[]): number =>
    claims.reduce((sum, claim) => sum + getExpenseClaimAmount(claim), 0);

const claimMatchesAggregateSettlement = (claim: TeamExpenseClaim, aggregate: SupportCompanyAggregate): boolean => {
    const aggregateTeamId = aggregate.settlementTeamId || aggregate.companyId;
    const aggregateTeamName = aggregate.settlementTeamName || aggregate.companyName;
    if (aggregate.settlementRole === 'charge') {
        return matchesTeamReference(claim.chargeToTeamId, claim.chargeToTeamName, aggregateTeamId, aggregateTeamName);
    }
    return matchesTeamReference(claim.payerTeamId, claim.payerTeamName, aggregateTeamId, aggregateTeamName);
};

const applyExpenseClaimsToAggregates = (
    rows: SupportCompanyAggregate[],
    claims: TeamExpenseClaim[]
): SupportCompanyAggregate[] => {
    const postedClaims = claims.filter(isPostedTeamChargeClaim);

    return rows.map((aggregate) => {
        const nextSites = aggregate.sites.map((site) => {
            const matchedClaims = postedClaims.filter((claim) =>
                matchesSiteReference(claim, site) &&
                claimMatchesAggregateSettlement(claim, aggregate)
            );
            const expenseClaims = dedupeExpenseClaims(matchedClaims);
            const expenseClaimAmount = getExpenseClaimsTotal(expenseClaims);

            return {
                ...site,
                expenseClaimAmount,
                expenseClaimCount: expenseClaims.length,
                expenseClaims
            };
        });

        return recalcAggregateFromSites(aggregate, nextSites);
    });
};

const getAdjustment = (adjustments: SupportManualAdjustments, aggregateId: string): SupportManualAdjustment =>
    normalizeManualAdjustment(adjustments[aggregateId]);

const getSiteExpenseClaimAmount = (site: SupportSiteRow): number =>
    Math.max(0, Math.round(site.expenseClaimAmount ?? 0));

const getSiteExpenseClaims = (site: SupportSiteRow): TeamExpenseClaim[] =>
    dedupeExpenseClaims(site.expenseClaims ?? []);

const getAggregateExpenseClaimAmount = (aggregate: SupportCompanyAggregate): number =>
    aggregate.sites.reduce((sum, site) => sum + getSiteExpenseClaimAmount(site), 0);

const getAggregateExpenseClaims = (aggregate: SupportCompanyAggregate): TeamExpenseClaim[] =>
    dedupeExpenseClaims(aggregate.sites.flatMap(site => getSiteExpenseClaims(site)));

// 지원팀 정산의 추가 금액은 현장 계산서나 세금과 연결하지 않는다.
// 경비 청구분만 별도 내역으로 합산하고, 추가 금액은 사용자가 직접 입력한다.
const getSiteExpenseStatementAmount = (site: SupportSiteRow, _adjustment?: SupportManualAdjustment): number =>
    getSiteExpenseClaimAmount(site);

const getAggregateExpenseStatementAmount = (aggregate: SupportCompanyAggregate, _adjustment?: SupportManualAdjustment): number =>
    getAggregateExpenseClaimAmount(aggregate);

const getExpenseStatementClaims = (
    aggregate: SupportCompanyAggregate,
    _yearMonth: string,
    site?: SupportSiteRow,
    _adjustment?: SupportManualAdjustment
): TeamExpenseClaim[] => site ? getSiteExpenseClaims(site) : getAggregateExpenseClaims(aggregate);

const getAggregateAdditionalAmount = (aggregate: SupportCompanyAggregate, adjustments: SupportManualAdjustments): number =>
    getAdjustment(adjustments, aggregate.aggregateId).additionalAmount + getAggregateExpenseStatementAmount(aggregate, getAdjustment(adjustments, aggregate.aggregateId));

const getAggregateTotalWithAdditional = (aggregate: SupportCompanyAggregate, adjustments: SupportManualAdjustments): number =>
    aggregate.issuedAmount + getAggregateAdditionalAmount(aggregate, adjustments);

const SUPPORT_REMARK_COMPANY_FALLBACKS = [
    { teamKey: normalizeName('김명식팀'), companyName: '(주)건승이엔씨' }
];

const getSupportRemarkCompanyName = (aggregate: SupportCompanyAggregate, site?: SupportSiteRow): string => {
    const candidates = [
        aggregate.companyName,
        aggregate.settlementTeamName,
        aggregate.sourceTeamName,
        aggregate.viewTeamName,
        site?.sourceTeamName,
        site?.viewTeamName,
        site?.counterpartyName
    ].filter(Boolean);
    const matchedFallback = SUPPORT_REMARK_COMPANY_FALLBACKS.find((fallback) =>
        candidates.some((candidate) => normalizeName(candidate).includes(fallback.teamKey))
    );
    return matchedFallback?.companyName || aggregate.companyName || site?.counterpartyName || '';
};

const getAggregateRemarkFallback = (aggregate: SupportCompanyAggregate): string =>
    getSupportRemarkCompanyName(aggregate) || aggregate.accountHolder || aggregate.bankName || '';

const getSettlementAccountLabel = (aggregate: SupportCompanyAggregate): string =>
    [aggregate.bankName, aggregate.accountNumber, aggregate.accountHolder].filter(Boolean).join(' · ');

const getAggregateEtcFallback = (aggregate: SupportCompanyAggregate): string => {
    if (Object.values(aggregate.errors).some(Boolean)) return '계좌 확인 필요';
    if (aggregate.sites.length > 1) return `${aggregate.sites.length}개 현장`;
    return '';
};

const formatOptionalMoney = (value: number): string => (value > 0 ? formatNumber(value) : '');

const getTeamCellClass = (direction: SupportDirection): string => {
    if (direction === '외부지원간곳') return 'bg-yellow-300 text-slate-950';
    if (direction === '외부지원온곳') return 'bg-orange-300 text-slate-950';
    if (direction === '내부지원간곳') return 'bg-sky-200 text-slate-950';
    return 'bg-lime-300 text-slate-950';
};

const sanitizeFileNamePart = (value: string): string =>
    (value || '미지정').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim();

const buildLaborStatementExcelBlock = (preview: SitePreviewBlock): SupportLaborStatementExcelBlock => ({
    sheetName: `${preview.site.siteName}_${preview.aggregate.companyName}`,
    siteName: preview.site.siteName,
    settlementName: preview.aggregate.companyName,
    direction: preview.aggregate.direction,
    delegateBankName: preview.aggregate.bankName,
    delegateAccountNumber: preview.aggregate.accountNumber,
    delegateAccountHolder: preview.aggregate.accountHolder,
    rows: preview.rows.map(row => ({
        workerId: row.workerId,
        workerName: row.workerName,
        idNumber: row.idNumber,
        contact: row.contact,
        address: row.address,
        bankName: row.bankName,
        accountNumber: row.accountNumber,
        accountHolder: row.accountHolder,
        payType: row.payType,
        days: row.days,
        totalManDay: row.totalManDay,
        unitPrice: row.unitPrice,
        totalAmount: row.totalAmount,
        billingUnitPrice: row.billingUnitPrice,
        billingAmount: row.billingAmount,
        vatAmount: row.vatAmount,
        issuedAmount: row.issuedAmount
    }))
});

const getLaborStatementFileName = (preview: SitePreviewBlock, yearMonth: string): string => [
    '노무내역서',
    yearMonth,
    preview.aggregate.direction,
    preview.site.siteName,
    preview.aggregate.companyName
].map(sanitizeFileNamePart).join('_') + '.xlsx';

const getLaborStatementImageFileName = (preview: SitePreviewBlock, yearMonth: string): string => [
    '노무내역서',
    yearMonth,
    preview.aggregate.direction,
    preview.site.siteName,
    preview.aggregate.companyName
].map(sanitizeFileNamePart).join('_') + '.png';

const getSupportDetailImageFileName = (
    aggregate: SupportCompanyAggregate,
    site: SupportSiteRow,
    yearMonth: string
): string => [
    '지원팀상세',
    yearMonth,
    aggregate.direction,
    site.siteName,
    aggregate.companyName
].map(sanitizeFileNamePart).join('_') + '.png';

const formatCurrencyText = (value: number): string => `${formatNumber(Math.round(value || 0))}원`;

const formatManDayText = (value: number): string => `${formatDayValue(value) || '0'}공수`;

const formatYearMonthLabel = (yearMonth: string): string => {
    const [year, month] = yearMonth.split('-');
    const monthNumber = parseInt(month ?? '', 10);
    return `${year || ''}년 ${Number.isFinite(monthNumber) && monthNumber > 0 ? monthNumber : ''}월`.trim();
};

const shiftYearMonth = (yearMonth: string, monthOffset: number): string => {
    const [rawYear, rawMonth] = yearMonth.split('-').map(Number);
    const fallback = new Date();
    const year = Number.isFinite(rawYear) ? rawYear : fallback.getFullYear();
    const month = Number.isFinite(rawMonth) ? rawMonth : fallback.getMonth() + 1;
    const target = new Date(year, month - 1 + monthOffset, 1);
    return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}`;
};

const buildWorkerStatementLine = (row: SupportLaborExcelRow): string => {
    const workedDays = row.days
        .map((value, index) => value > 0 ? `${index + 1}일 ${formatDayValue(value)}` : '')
        .filter(Boolean)
        .join(', ');
    const dayPart = workedDays ? ` (${workedDays})` : '';
    return `  - ${row.workerName}: 청구 ${formatManDayText(row.totalManDay)} x ${formatCurrencyText(row.billingUnitPrice)} = ${formatCurrencyText(row.billingAmount)}${dayPart}`;
};

const buildSupportLaborStatementText = (
    aggregate: SupportCompanyAggregate,
    previews: SitePreviewBlock[],
    yearMonth: string,
    adjustment: SupportManualAdjustment
): string => {
    const expenseClaimAmount = getAggregateExpenseClaimAmount(aggregate);
    const totalAmount = aggregate.issuedAmount + adjustment.additionalAmount + expenseClaimAmount;
    const remark = adjustment.remark || getAggregateRemarkFallback(aggregate);
    const etc = adjustment.etc || getAggregateEtcFallback(aggregate);
    const siteBlocks = previews.length > 0
        ? previews
        : aggregate.sites.map(site => ({ aggregate, site, rows: [] as SupportLaborExcelRow[] }));

    const lines = [
        `[노임명세서] ${formatYearMonthLabel(yearMonth)}`,
        `구분: ${aggregate.direction}`,
        `기준팀: ${aggregate.viewTeamName || '-'}`,
        `작업팀: ${aggregate.sourceTeamName || '-'}`,
        `현장수: ${aggregate.sites.length}개`,
        `총공수: ${formatManDayText(aggregate.totalManDay)}`,
        `공급가액: ${formatCurrencyText(aggregate.billingAmount)}`
    ];

    if (adjustment.additionalAmount > 0) lines.push(`추가금액: ${formatCurrencyText(adjustment.additionalAmount)}`);
    if (expenseClaimAmount > 0) lines.push(`청구추가: ${formatCurrencyText(expenseClaimAmount)}`);
    lines.push(`지급합계: ${formatCurrencyText(totalAmount)}`);

    if (aggregate.bankName || aggregate.accountNumber || aggregate.accountHolder) {
        lines.push(`계좌: ${[aggregate.bankName, aggregate.accountNumber, aggregate.accountHolder].filter(Boolean).join(' ')}`);
    }
    if (remark) lines.push(`비고: ${remark}`);
    if (etc) lines.push(`기타: ${etc}`);

    const siteLines = siteBlocks.map((preview, index) => {
        const rows = preview.rows;
        const siteManDay = rows.reduce((sum, row) => sum + row.totalManDay, 0) || preview.site.totalManDay;
        const siteBillingAmount = rows.reduce((sum, row) => sum + row.billingAmount, 0) || preview.site.billingAmount;
        const workerLines = rows.map(buildWorkerStatementLine);

        return [
            `${index + 1}. ${preview.site.siteName}`,
            `   공수 ${formatManDayText(siteManDay)} / 공급가액 ${formatCurrencyText(siteBillingAmount)}`,
            ...workerLines
        ].join('\n');
    });

    return [...lines, '', '[현장별 내역]', ...siteLines].join('\n');
};

const wrapCanvasText = (
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
    maxLines = 2
): string[] => {
    const source = String(text || '-');
    const chars = Array.from(source);
    const lines: string[] = [];
    let current = '';

    chars.forEach((char) => {
        const next = current + char;
        if (ctx.measureText(next).width <= maxWidth || !current) {
            current = next;
            return;
        }
        lines.push(current);
        current = char;
    });

    if (current) lines.push(current);
    if (lines.length > maxLines) {
        const kept = lines.slice(0, maxLines);
        let last = kept[kept.length - 1] || '';
        while (last.length > 0 && ctx.measureText(`${last}...`).width > maxWidth) {
            last = last.slice(0, -1);
        }
        kept[kept.length - 1] = `${last}...`;
        return kept;
    }
    return lines;
};

const drawCanvasCell = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    text: React.ReactNode,
    options: {
        fill?: string;
        stroke?: string;
        color?: string;
        font?: string;
        align?: CanvasTextAlign;
        baseline?: CanvasTextBaseline;
        padding?: number;
        wrap?: boolean;
        maxLines?: number;
    } = {}
) => {
    const {
        fill = '#ffffff',
        stroke = '#111827',
        color = '#111827',
        font = '22px "Malgun Gothic", "Pretendard", sans-serif',
        align = 'center',
        baseline = 'middle',
        padding = 8,
        wrap = false,
        maxLines = 2
    } = options;

    ctx.fillStyle = fill;
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);

    const value = String(text ?? '');
    if (!value) return;

    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 1, y + 1, Math.max(width - 2, 0), Math.max(height - 2, 0));
    ctx.clip();
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;

    const textX = align === 'left' ? x + padding : align === 'right' ? x + width - padding : x + width / 2;
    if (wrap) {
        const lines = wrapCanvasText(ctx, value, Math.max(width - padding * 2, 10), maxLines);
        const lineHeight = 19;
        const startY = y + height / 2 - ((lines.length - 1) * lineHeight) / 2;
        lines.forEach((line, index) => {
            ctx.fillText(line, textX, startY + index * lineHeight);
        });
    } else {
        ctx.fillText(value, textX, y + height / 2);
    }
    ctx.restore();
};

const loadCanvasImage = (src: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
        const image = new Image();
        if (/^https?:\/\//i.test(src) && !src.startsWith(window.location.origin)) {
            image.crossOrigin = 'anonymous';
        }
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(`Image load failed: ${src}`));
        image.src = src;
    });

const DEFAULT_STATEMENT_LOGO_URL = '/icons/icon-192.png';
const ERP_LOGO_STORAGE_PATH = 'settings/erp_logo';

const resolveStatementLogoUrl = (logoUrl?: string | null): string => {
    const trimmed = typeof logoUrl === 'string' ? logoUrl.trim() : '';
    return trimmed || DEFAULT_STATEMENT_LOGO_URL;
};


const buildExpenseClaimStatementText = (
    aggregate: SupportCompanyAggregate,
    claims: TeamExpenseClaim[],
    yearMonth: string
): string => {
    const rows = sortExpenseClaims(claims);
    const totalAmount = getExpenseClaimsTotal(rows);
    const lines = [
        `[후청구 경비내역] ${formatYearMonthLabel(yearMonth)}`,
        `정산주체: ${aggregate.companyName}`,
        `구분: ${aggregate.direction}`,
        `총건수: ${rows.length}건`,
        `후청구 합계: ${formatCurrencyText(totalAmount)}`,
        '',
        '[상세내역]'
    ];

    if (rows.length === 0) {
        lines.push('등록된 후청구 경비내역이 없습니다.');
        return lines.join('\n');
    }

    rows.forEach((claim, index) => {
        lines.push(
            `${index + 1}. ${claim.date || '-'} / ${claim.siteName || '-'} / ${claim.category || '기타'} / ${formatCurrencyText(getExpenseClaimAmount(claim))}`,
            `   사용팀: ${claim.payerTeamName || '-'} / 청구대상: ${claim.chargeToTeamName || '-'}`,
            `   내용: ${claim.description || '-'}`,
            `   상태: ${getExpenseClaimStatusLabel(claim.status)}${claim.memo ? ` / 메모: ${claim.memo}` : ''}`
        );
    });

    return lines.join('\n');
};

const createExpenseClaimStatementImageBlob = async (
    aggregate: SupportCompanyAggregate,
    claims: TeamExpenseClaim[],
    yearMonth: string,
    logoUrl?: string | null
): Promise<Blob> => {
    await waitForDocumentFonts();

    const rows = sortExpenseClaims(claims);
    const month = parseInt(yearMonth.split('-')[1] ?? '0', 10);
    const totalAmount = getExpenseClaimsTotal(rows);
    const margin = 48;
    const tableTop = 250;
    const headerRowHeight = 42;
    const bodyRowHeight = 54;
    const footerRowHeight = 44;
    const columns = {
        no: 54,
        date: 104,
        site: 220,
        payer: 150,
        chargeTo: 150,
        category: 122,
        description: 300,
        status: 94,
        amount: 136,
        memo: 210
    };
    const tableWidth = Object.values(columns).reduce((sum, width) => sum + width, 0);
    const width = tableWidth + margin * 2;
    const tableHeight = headerRowHeight + Math.max(rows.length, 1) * bodyRowHeight + footerRowHeight;
    const height = tableTop + tableHeight + 54;
    const outputScale = Math.max(2, Math.min(window.devicePixelRatio || 1, 2));

    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(width * outputScale);
    canvas.height = Math.ceil(height * outputScale);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context unavailable');
    ctx.scale(outputScale, outputScale);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#111827';
    ctx.font = '900 40px "Malgun Gothic", "Pretendard", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`후 청 구 경 비 내 역 서 (${month}월분)`, width / 2, 92);
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(width / 2 - 285, 122);
    ctx.lineTo(width / 2 + 285, 122);
    ctx.stroke();

    ctx.font = '700 22px "Malgun Gothic", "Pretendard", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#111827';
    ctx.fillText(`정산 주체: ${aggregate.companyName}`, margin, 166);
    ctx.fillText(`후청구 합계: ${formatCurrencyText(totalAmount)} / ${rows.length}건`, margin, 202);
    const logoSize = 46;
    const logoX = width - margin - 248;
    const logoY = 154;
    try {
        const logoImage = await loadCanvasImage(resolveStatementLogoUrl(logoUrl));
        ctx.drawImage(logoImage, logoX, logoY, logoSize, logoSize);
    } catch (error) {
        console.warn('[SupportTeamPaymentPage] expense statement logo image failed:', error);
        ctx.fillStyle = '#0f766e';
        ctx.fillRect(logoX, logoY, logoSize, logoSize);
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 18px "Malgun Gothic", "Pretendard", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('CY', logoX + logoSize / 2, logoY + logoSize / 2);
    }
    ctx.fillStyle = '#111827';
    ctx.font = '900 24px "Malgun Gothic", "Pretendard", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('(주) 청연이엔지', logoX + logoSize + 12, logoY + logoSize / 2);

    let x = margin;
    let y = tableTop;
    const headerFill = '#ecfdf5';
    const totalFill = '#d1fae5';
    const bodyFill = '#ffffff';
    const mutedFill = '#f8fafc';
    const headerFont = '700 18px "Malgun Gothic", "Pretendard", sans-serif';
    const bodyFont = '17px "Malgun Gothic", "Pretendard", sans-serif';
    const boldFont = '700 18px "Malgun Gothic", "Pretendard", sans-serif';

    [
        ['NO', columns.no],
        ['일자', columns.date],
        ['현장명', columns.site],
        ['사용팀', columns.payer],
        ['청구대상', columns.chargeTo],
        ['구분', columns.category],
        ['상세내용', columns.description],
        ['상태', columns.status],
        ['금액', columns.amount],
        ['메모', columns.memo]
    ].forEach(([label, columnWidth]) => {
        drawCanvasCell(ctx, x, y, Number(columnWidth), headerRowHeight, label, { fill: headerFill, font: headerFont });
        x += Number(columnWidth);
    });

    y += headerRowHeight;
    if (rows.length === 0) {
        drawCanvasCell(ctx, margin, y, tableWidth, bodyRowHeight, '등록된 후청구 경비내역이 없습니다.', { fill: bodyFill, font: bodyFont });
        y += bodyRowHeight;
    } else {
        rows.forEach((claim, index) => {
            x = margin;
            drawCanvasCell(ctx, x, y, columns.no, bodyRowHeight, String(index + 1), { fill: mutedFill, font: bodyFont });
            x += columns.no;
            drawCanvasCell(ctx, x, y, columns.date, bodyRowHeight, claim.date || '-', { fill: bodyFill, font: bodyFont });
            x += columns.date;
            drawCanvasCell(ctx, x, y, columns.site, bodyRowHeight, claim.siteName || '-', { fill: bodyFill, font: bodyFont, align: 'left', wrap: true, maxLines: 2 });
            x += columns.site;
            drawCanvasCell(ctx, x, y, columns.payer, bodyRowHeight, claim.payerTeamName || '-', { fill: bodyFill, font: bodyFont, wrap: true, maxLines: 2 });
            x += columns.payer;
            drawCanvasCell(ctx, x, y, columns.chargeTo, bodyRowHeight, claim.chargeToTeamName || '-', { fill: bodyFill, font: bodyFont, wrap: true, maxLines: 2 });
            x += columns.chargeTo;
            drawCanvasCell(ctx, x, y, columns.category, bodyRowHeight, claim.category || '기타', { fill: bodyFill, font: bodyFont, wrap: true, maxLines: 2 });
            x += columns.category;
            drawCanvasCell(ctx, x, y, columns.description, bodyRowHeight, claim.description || '-', { fill: bodyFill, font: bodyFont, align: 'left', wrap: true, maxLines: 2 });
            x += columns.description;
            drawCanvasCell(ctx, x, y, columns.status, bodyRowHeight, getExpenseClaimStatusLabel(claim.status), { fill: mutedFill, font: bodyFont });
            x += columns.status;
            drawCanvasCell(ctx, x, y, columns.amount, bodyRowHeight, formatNumber(getExpenseClaimAmount(claim)), { fill: '#ecfdf5', color: '#047857', font: boldFont, align: 'right' });
            x += columns.amount;
            drawCanvasCell(ctx, x, y, columns.memo, bodyRowHeight, claim.memo || '-', { fill: bodyFill, font: bodyFont, align: 'left', wrap: true, maxLines: 2 });
            y += bodyRowHeight;
        });
    }

    x = margin;
    drawCanvasCell(ctx, x, y, tableWidth - columns.amount - columns.memo, footerRowHeight, '합 계', { fill: totalFill, font: boldFont });
    x += tableWidth - columns.amount - columns.memo;
    drawCanvasCell(ctx, x, y, columns.amount, footerRowHeight, formatNumber(totalAmount), { fill: '#dcfce7', color: '#047857', font: '900 19px "Malgun Gothic", "Pretendard", sans-serif', align: 'right' });
    x += columns.amount;
    drawCanvasCell(ctx, x, y, columns.memo, footerRowHeight, `${rows.length}건`, { fill: totalFill, font: boldFont });

    const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('PNG blob generation failed');
    return blob;
};


const captureElementToPngBlob = async (node: HTMLElement): Promise<Blob> => {
    await waitForDocumentFonts();
    const rect = node.getBoundingClientRect();
    const width = Math.ceil(node.scrollWidth || rect.width);
    const height = Math.ceil(node.scrollHeight || rect.height);

    if (width <= 0 || height <= 0) {
        throw new Error('Capture target has no size');
    }

    const canvas = await html2canvas(node, {
        backgroundColor: '#ffffff',
        scale: getCaptureScale(width, height),
        useCORS: true,
        allowTaint: false,
        logging: false,
        width,
        height,
        windowWidth: Math.max(document.documentElement.clientWidth, width),
        windowHeight: Math.max(document.documentElement.clientHeight, height),
        scrollX: 0,
        scrollY: -window.scrollY,
        onclone: (clonedDocument: Document) => {
            const target = clonedDocument.querySelector('[data-statement-capture="true"]') as HTMLElement | null;
            if (!target) return;

            target.style.width = `${width}px`;
            target.style.height = `${height}px`;
            target.style.overflow = 'visible';
            target.style.maxHeight = 'none';

            let parent = target.parentElement;
            while (parent) {
                parent.style.overflow = 'visible';
                parent.style.maxHeight = 'none';
                parent = parent.parentElement;
            }
        }
    } as any);

    const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('PNG blob generation failed');
    return blob;
};

const blobToDataUrl = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error ?? new Error('Blob read failed'));
        reader.readAsDataURL(blob);
    });

const copyPngBlobToClipboard = async (blob: Blob): Promise<void> => {
    const ClipboardItemCtor = (window as unknown as {
        ClipboardItem?: new (items: Record<string, Blob>) => ClipboardItem;
    }).ClipboardItem;
    const clipboard = navigator.clipboard as Clipboard & {
        write?: (data: ClipboardItem[]) => Promise<void>;
    };

    let clipboardError: unknown = null;
    if (ClipboardItemCtor && clipboard?.write) {
        try {
            await clipboard.write([
                new ClipboardItemCtor({
                    'image/png': blob
                })
            ]);
            return;
        } catch (error) {
            clipboardError = error;
            console.warn('Image clipboard write failed, trying selection copy:', error);
        }
    }

    const dataUrl = await blobToDataUrl(blob);
    const fallbackFile = new File([blob], 'statement.png', { type: 'image/png' });
    const wrapper = document.createElement('div');
    wrapper.contentEditable = 'true';
    wrapper.style.position = 'fixed';
    wrapper.style.left = '0';
    wrapper.style.top = '0';
    wrapper.style.zIndex = '-1';
    wrapper.style.opacity = '0';
    wrapper.style.pointerEvents = 'none';
    wrapper.style.overflow = 'visible';
    wrapper.innerHTML = `<img src="${dataUrl}" alt="노무비 지급 명세서" />`;
    document.body.appendChild(wrapper);

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(wrapper);
    selection?.removeAllRanges();
    selection?.addRange(range);
    wrapper.focus();

    const handleFallbackCopy = (event: ClipboardEvent) => {
        event.preventDefault();
        try {
            event.clipboardData?.items.add(fallbackFile);
        } catch (error) {
            console.warn('Clipboard file fallback failed:', error);
        }
        event.clipboardData?.setData('text/html', `<img src="${dataUrl}" alt="노무비 지급 명세서" />`);
        event.clipboardData?.setData('text/plain', dataUrl);
    };

    document.addEventListener('copy', handleFallbackCopy);
    const copied = document.execCommand('copy');
    document.removeEventListener('copy', handleFallbackCopy);
    selection?.removeAllRanges();
    wrapper.remove();

    if (!copied) {
        throw (clipboardError instanceof Error ? clipboardError : new Error('Image clipboard is not supported'));
    }
};

const waitForDocumentFonts = async (): Promise<void> => {
    try {
        const fontSet = (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts;
        if (fontSet?.ready) await fontSet.ready;
    } catch (error) {
        console.warn('[SupportTeamPaymentPage] font readiness check failed:', error);
    }
};

const getCaptureScale = (width: number, height: number): number => {
    const baseScale = Math.max(2, window.devicePixelRatio || 1);
    const maxCanvasArea = 18000000;
    const area = Math.max(1, width * height);
    if (area * baseScale * baseScale <= maxCanvasArea) return baseScale;
    return Math.max(1, Math.sqrt(maxCanvasArea / area));
};

const useErpStatementLogoUrl = (): string => {
    const [logoUrl, setLogoUrl] = useState<string>(DEFAULT_STATEMENT_LOGO_URL);

    useEffect(() => {
        let active = true;

        const loadStorageFallback = async () => {
            try {
                const storageLogoUrl = await getDownloadURL(ref(storage, ERP_LOGO_STORAGE_PATH));
                if (active) setLogoUrl(resolveStatementLogoUrl(storageLogoUrl));
            } catch {
                if (active) setLogoUrl(DEFAULT_STATEMENT_LOGO_URL);
            }
        };

        const unsubscribe = onSnapshot(
            doc(db, 'settings', 'system_config'),
            (snapshot) => {
                const data = snapshot.exists() ? snapshot.data() : null;
                const configuredLogoUrl = resolveStatementLogoUrl(
                    (data?.erpLogoUrl as string | undefined) || (data?.logoUrl as string | undefined)
                );

                if (configuredLogoUrl !== DEFAULT_STATEMENT_LOGO_URL) {
                    if (active) setLogoUrl(configuredLogoUrl);
                    return;
                }

                void loadStorageFallback();
            },
            (error) => {
                console.warn('[SupportTeamPaymentPage] ERP logo listener failed:', error);
                void loadStorageFallback();
            }
        );

        return () => {
            active = false;
            unsubscribe();
        };
    }, []);

    return logoUrl;
};

const StatementBrand: React.FC<{ logoUrl?: string | null }> = ({ logoUrl }) => {
    const resolvedLogoUrl = resolveStatementLogoUrl(logoUrl);
    const [imageSrc, setImageSrc] = useState(resolvedLogoUrl);

    useEffect(() => {
        setImageSrc(resolvedLogoUrl);
    }, [resolvedLogoUrl]);

    return (
        <div className="flex items-center gap-2 text-slate-900">
            <img
                src={imageSrc}
                alt="ERP logo"
                className="h-9 w-9 rounded-md object-contain"
                onError={() => {
                    if (imageSrc !== DEFAULT_STATEMENT_LOGO_URL) {
                        setImageSrc(DEFAULT_STATEMENT_LOGO_URL);
                    }
                }}
            />
            <span className="text-sm font-black">(주) 청연이엔지</span>
        </div>
    );
};

interface SupportTeamPaymentPageProps {
    scope?: SupportTeamPaymentScope;
}

const SupportTeamPaymentPage: React.FC<SupportTeamPaymentPageProps> = ({ scope = 'external' }) => {
    const today = new Date();
    const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const statementLogoUrl = useErpStatementLogoUrl();
    const scopeConfig = SUPPORT_SCOPE_CONFIG[scope];
    const scopedDirections = scopeConfig.directions;
    const scopedDirectionSet = useMemo(() => new Set<SupportDirection>(scopedDirections), [scopedDirections]);
    const pageTitle = scopeConfig.title;
    const pageDescription = scopeConfig.description;
    const defaultSelectedDirection = getDefaultSelectedDirection(scope);

    const [selectedMonth, setSelectedMonth] = useState<string>(defaultMonth);
    const [selectedDirection, setSelectedDirection] = useState<'all' | SupportDirection>(defaultSelectedDirection);
    const [selectedSourceTeamId, setSelectedSourceTeamId] = useState<string>('');
    const [selectedSiteId, setSelectedSiteId] = useState<string>('');
    const hideSidebarFilter = true;
    const activeSourceTeamId = hideSidebarFilter ? '' : selectedSourceTeamId;
    const [aggregates, setAggregates] = useState<SupportCompanyAggregate[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [sites, setSites] = useState<Site[]>([]);
    const [supportRates, setSupportRates] = useState<SupportRate[]>([]);
    const [bulkSupportRateInput, setBulkSupportRateInput] = useState<string>(formatNumber(DEFAULT_SUPPORT_UNIT_PRICE));
    const [bulkRateInput, setBulkRateInput] = useState<string>(formatNumber(DEFAULT_SUPPORT_UNIT_PRICE));
    const [loading, setLoading] = useState<boolean>(false);
    const [errors, setErrors] = useState<string[]>([]);
    const [showLaborPreview, setShowLaborPreview] = useState<boolean>(false);
    const [showKBPreview, setShowKBPreview] = useState<boolean>(false);
    const [laborStatementSelection, setLaborStatementSelection] = useState<StatementTargetSelection>(null);
    const [expenseStatementSelection, setExpenseStatementSelection] = useState<StatementTargetSelection>(null);
    const [capturingKey, setCapturingKey] = useState<string | null>(null);
    const [manualAdjustmentState, setManualAdjustmentState] = useState<{ month: string; data: SupportManualAdjustments }>(() => ({
        month: defaultMonth,
        data: loadManualAdjustments(defaultMonth)
    }));
    const [monthlyRateOverrideState, setMonthlyRateOverrideState] = useState<{ month: string; data: SupportMonthlyRateOverrides }>(() => ({
        month: defaultMonth,
        data: loadRateOverrides(defaultMonth)
    }));
    
    // 계층형 펼침 상태 관리
    const [expandedDirectionGroups, setExpandedDirectionGroups] = useState<Set<SupportDirection>>(
        () => getDefaultExpandedDirectionGroups(scopedDirections)
    );
    const [expandedAggregates, setExpandedAggregates] = useState<Set<string>>(new Set());
    const [expandedSiteRows, setExpandedSiteRows] = useState<Set<string>>(new Set());

    const manualAdjustments = manualAdjustmentState.month === selectedMonth ? manualAdjustmentState.data : {};
    const monthlyRateOverrides = monthlyRateOverrideState.month === selectedMonth
        ? monthlyRateOverrideState.data
        : normalizeRateOverrides(undefined);

    useEffect(() => {
        const rateOverrides = loadRateOverrides(selectedMonth);
        setManualAdjustmentState({
            month: selectedMonth,
            data: loadManualAdjustments(selectedMonth)
        });
        setMonthlyRateOverrideState({
            month: selectedMonth,
            data: rateOverrides
        });
        setBulkSupportRateInput(formatNumber(rateOverrides.bulkSupportRate ?? DEFAULT_SUPPORT_UNIT_PRICE));
        setBulkRateInput(formatNumber(rateOverrides.bulkRate ?? DEFAULT_SUPPORT_UNIT_PRICE));
    }, [selectedMonth]);

    useEffect(() => {
        saveManualAdjustments(manualAdjustmentState.month, manualAdjustmentState.data);
    }, [manualAdjustmentState]);

    useEffect(() => {
        saveRateOverrides(monthlyRateOverrideState.month, monthlyRateOverrideState.data);
    }, [monthlyRateOverrideState]);

    useEffect(() => {
        if (selectedDirection !== 'all' && !scopedDirectionSet.has(selectedDirection)) {
            setSelectedDirection(defaultSelectedDirection);
        }
    }, [defaultSelectedDirection, scopedDirectionSet, selectedDirection]);

    useEffect(() => {
        setSelectedDirection(defaultSelectedDirection);
        setSelectedSourceTeamId('');
        setSelectedSiteId('');
        setExpandedDirectionGroups(getDefaultExpandedDirectionGroups(scopedDirections));
        setExpandedAggregates(new Set());
        setExpandedSiteRows(new Set());
    }, [defaultSelectedDirection, scope, scopedDirections]);

    const updateManualAdjustment = useCallback((
        aggregateId: string,
        patch: Partial<SupportManualAdjustment>
    ) => {
        setManualAdjustmentState((prev) => {
            const month = prev.month === selectedMonth ? prev.month : selectedMonth;
            const baseData = prev.month === selectedMonth ? prev.data : loadManualAdjustments(selectedMonth);
            const current = normalizeManualAdjustment(baseData[aggregateId]);
            return {
                month,
                data: {
                    ...baseData,
                    [aggregateId]: normalizeManualAdjustment({ ...current, ...patch })
                }
            };
        });
    }, [selectedMonth]);

    const toggleAggregateExpand = (aggKey: string) => {
        const isCollapsing = expandedAggregates.has(aggKey);
        setExpandedAggregates(isCollapsing ? new Set() : new Set([aggKey]));
        setExpandedSiteRows(new Set());
    };

    const toggleSiteRowExpand = (siteKey: string) => {
        const isCollapsing = expandedSiteRows.has(siteKey);
        setExpandedSiteRows(isCollapsing ? new Set() : new Set([siteKey]));
    };

    const toggleDirectionGroup = (direction: SupportDirection) => {
        const isCollapsing = expandedDirectionGroups.has(direction);
        setExpandedDirectionGroups(isCollapsing ? new Set() : new Set([direction]));
        setExpandedAggregates(new Set());
        setExpandedSiteRows(new Set());
    };

    const fetchInitialData = useCallback(async () => {
        try {
            const [fetchedTeams, fetchedCompanies, fetchedWorkers, fetchedSites, fetchedSupportRates] = await Promise.all([
                teamService.getTeams(),
                companyService.getCompanies(),
                manpowerService.getWorkers(),
                siteService.getSites(),
                supportRateService.getAllSiteRates().catch((error) => {
                    console.error('지원팀 현장 단가를 불러오지 못했습니다.', error);
                    return [] as SupportRate[];
                })
            ]);
            setTeams(fetchedTeams);
            setCompanies(fetchedCompanies);
            setWorkers(fetchedWorkers);
            setSites(fetchedSites);
            setSupportRates(fetchedSupportRates);
        } catch (error) {
            console.error('지원팀 기준 데이터를 불러오지 못했습니다.', error);
            setErrors((prev) => [...prev, '기준 데이터를 불러오지 못했습니다. 관리자에게 문의해주세요.']);
        }
    }, []);

    useEffect(() => {
        void fetchInitialData();
    }, [fetchInitialData]);

    const aggregateReports = useCallback(
        (reports: DailyReport[]): { aggregates: SupportCompanyAggregate[]; errorMessages: string[] } => {
            const teamById = new Map<string, Team>();
            teams.forEach((team) => {
                if (team.id) teamById.set(team.id, team);
            });
            const teamByName = new Map<string, Team>();
            teams.forEach((team) => {
                const key = normalizeName(team.name);
                if (key && !teamByName.has(key)) teamByName.set(key, team);
            });

            const companyById = new Map<string, Company>();
            companies.forEach((company) => {
                if (company.id) companyById.set(company.id, company);
            });

            const siteById = new Map<string, Site>();
            sites.forEach((site) => {
                if (site.id) siteById.set(site.id, site);
            });

            const supportRateBySiteId = new Map<string, number>();
            const supportRateBySiteName = new Map<string, number>();
            supportRates.forEach((rate) => {
                const configuredRate = toPositiveRate(rate.defaultRate);
                if (!configuredRate) return;
                const siteId = normalize(rate.siteId || rate.id);
                const siteName = normalizeName(rate.siteName);
                if (siteId) supportRateBySiteId.set(siteId, configuredRate);
                if (siteName) supportRateBySiteName.set(siteName, configuredRate);
            });

            const resolveConfiguredSiteRate = (siteId?: string | null, siteName?: string | null): number | null => {
                const normalizedSiteId = normalize(siteId);
                if (normalizedSiteId) {
                    const direct = supportRateBySiteId.get(normalizedSiteId);
                    if (direct) return direct;
                    const site = siteById.get(normalizedSiteId);
                    const byResolvedName = site ? supportRateBySiteName.get(normalizeName(site.name)) : undefined;
                    if (byResolvedName) return byResolvedName;
                }
                const normalizedSiteName = normalizeName(siteName);
                return normalizedSiteName ? (supportRateBySiteName.get(normalizedSiteName) ?? null) : null;
            };

            const isCheongyeonCompany = (companyId?: string, companyName?: string): boolean => {
                const normalizedCompanyId = normalize(companyId);
                if (normalizedCompanyId) {
                    const company = companyById.get(normalizedCompanyId);
                    if (company) {
                        if (company.isMyCompany) return true;
                        if (isCheongyeonCompanyName(company.name)) return true;
                    }
                }
                return isCheongyeonCompanyName(companyName);
            };

            const aggregateMap = new Map<string, SupportCompanyAggregate>();
            const errorMessages: string[] = [];
            const errorMessageSet = new Set<string>();

            const findCompanyByIdentity = (companyId?: string, companyName?: string): Company | undefined => {
                const normalizedId = normalize(companyId);
                if (normalizedId) {
                    const byId = companyById.get(normalizedId);
                    if (byId) return byId;
                }

                const normalizedName = normalizeName(companyName);
                if (!normalizedName) return undefined;
                return companies.find((company) => normalizeName(company.name) === normalizedName);
            };

            const findTeamByIdentity = (teamId?: string, teamName?: string): Team | undefined => {
                const normalizedId = normalize(teamId);
                if (normalizedId) {
                    const byId = teamById.get(normalizedId);
                    if (byId) return byId;
                }

                const normalizedName = normalizeName(teamName);
                return normalizedName ? teamByName.get(normalizedName) : undefined;
            };

            const isCheongyeonTeamIdentity = (team?: Team, teamId?: string, teamName?: string): boolean => {
                const resolved = team ?? findTeamByIdentity(teamId, teamName);
                if (!resolved) return false;
                const companyId = (resolved.companyId ?? '').trim();
                const companyName = (resolved.companyName ?? (companyId ? companyById.get(companyId)?.name : '') ?? '').trim();
                return isCheongyeonCompany(companyId, companyName);
            };

            const getSettlementBankInfo = (params: {
                settlementTeamId: string;
                settlementTeamName: string;
                settlementCompanyId: string;
                settlementCompanyName: string;
            }): { bankName: string; accountNumber: string; accountHolder: string } => {
                const team = findTeamByIdentity(params.settlementTeamId, params.settlementTeamName);
                const company = findCompanyByIdentity(
                    team?.companyId ?? params.settlementCompanyId,
                    team?.companyName ?? params.settlementCompanyName
                );

                return {
                    bankName: (team?.bankName || company?.bankName || '').trim(),
                    accountNumber: (team?.accountNumber || company?.accountNumber || '').trim(),
                    accountHolder: (
                        team?.accountHolder ||
                        team?.leaderName ||
                        company?.accountHolder ||
                        company?.ceoName ||
                        params.settlementTeamName ||
                        company?.name ||
                        ''
                    ).trim()
                };
            };

            const ensureAggregate = (params: {
                aggregateId: string;
                direction: SupportDirection;
                viewTeamId: string;
                viewTeamName: string;
                companyId: string;
                companyName: string;
                settlementTeamId: string;
                settlementTeamName: string;
                settlementCompanyId: string;
                settlementCompanyName: string;
                sourceTeamId: string;
                sourceTeamName: string;
                counterpartyName: string;
                evidenceNote: string;
                settlementRule: string;
                targetTeamName?: string;
            }) => {
                const key = params.aggregateId;
                if (!aggregateMap.has(key)) {
                    const bankInfo = getSettlementBankInfo(params);
                    const trimmedBankName = bankInfo.bankName.trim();
                    const bankCode = trimmedBankName ? BANK_CODES[trimmedBankName] ?? '' : '';
                    const fieldErrors: SupportCompanyAggregate['errors'] = {};
                    if (!trimmedBankName) fieldErrors.bankName = true;
                    if (trimmedBankName && !bankCode) fieldErrors.bankCode = true;
                    if (!bankInfo.accountNumber) fieldErrors.accountNumber = true;
                    if (!bankInfo.accountHolder) fieldErrors.accountHolder = true;

                    if (Object.values(fieldErrors).some(Boolean)) {
                        const message = `${params.companyName || '정산 주체 미지정'}의 계좌 정보를 확인해주세요.`;
                        if (!errorMessageSet.has(message)) {
                            errorMessageSet.add(message);
                            errorMessages.push(message);
                        }
                    }

                    const initialSourceTeamIds = uniqueValues([params.sourceTeamId]);
                    const initialSourceTeamNames = uniqueValues([params.sourceTeamName]);
                    aggregateMap.set(key, {
                        aggregateId: params.aggregateId,
                        direction: params.direction,
                        settlementTeamId: params.settlementTeamId,
                        settlementTeamName: params.settlementTeamName || params.companyName || '정산 주체 미지정',
                        settlementRole: getSettlementRole(params.direction),
                        settlementRule: params.settlementRule,
                        viewTeamId: params.viewTeamId,
                        viewTeamName: params.viewTeamName || '기준팀 미지정',
                        companyId: params.companyId,
                        companyName: params.companyName || '정산 주체 미지정',
                        sourceTeamIds: initialSourceTeamIds,
                        sourceTeamNames: initialSourceTeamNames,
                        sourceTeamId: params.sourceTeamId,
                        sourceTeamName: params.sourceTeamName || '팀 미지정',
                        targetTeamName: params.targetTeamName,
                        counterpartyName: params.counterpartyName || '상대 미지정',
                        evidenceNote: params.evidenceNote,
                        bankName: trimmedBankName,
                        bankCode,
                        accountNumber: bankInfo.accountNumber,
                        accountHolder: bankInfo.accountHolder,
                        totalManDay: 0,
                        totalAmount: 0,
                        billingAmount: 0,
                        vatAmount: 0,
                        issuedAmount: 0,
                        sites: [],
                        errors: fieldErrors
                    });
                }
                return aggregateMap.get(key)!;
            };

            reports.forEach((report) => {
                const reportId = report.id ?? '';
                const reportDate = report.date ?? '';
                const reportSite = report.siteId ? siteById.get(report.siteId) : undefined;

                const siteConstructorCompanyId = reportSite?.constructorCompanyId ?? reportSite?.companyId ?? report.companyId ?? '';
                const siteConstructorCompanyName = reportSite?.constructorCompanyName ?? reportSite?.companyName ?? report.companyName ?? '';
                const siteClassification: '청연' | '외부' = isCheongyeonCompany(siteConstructorCompanyId, siteConstructorCompanyName) ? '청연' : '외부';

                report.workers.forEach((reportWorker: DailyReportWorker) => {
                    const normalizedSalary = normalizeSalaryModel(reportWorker.salaryModel ?? reportWorker.payType);
                    const isSupportModel = normalizedSalary === '지원팀';
                    const reportWorkerTeamId = (reportWorker.teamId ?? '').trim();
                    const reportWorkerTeamName = (reportWorker.workerTeamName ?? '').trim();
                    const fallbackSourceTeam = teamByName.get(normalizeName(reportWorkerTeamName));
                    const fallbackReportTeamId = reportWorkerTeamName ? '' : (report.teamId ?? '').trim();
                    const workerTeamId = reportWorkerTeamId || fallbackSourceTeam?.id || fallbackReportTeamId;
                    const resolvedTeam = (workerTeamId ? teamById.get(workerTeamId) : undefined) ?? fallbackSourceTeam;
                    const isSupportTeam = normalize(resolvedTeam?.type) === '지원팀';

                    const sourceTeamName = resolvedTeam?.name ?? reportWorkerTeamName ?? report.teamName ?? '팀 미지정';
                    const sourceTeamId = (resolvedTeam?.id || reportWorkerTeamId || normalizeName(reportWorkerTeamName) || fallbackReportTeamId || '').trim();
                    const workerCompanyId = (resolvedTeam?.companyId ?? '').trim();
                    const fallbackCompanyName = (resolvedTeam?.companyName ?? (workerCompanyId ? companyById.get(workerCompanyId)?.name : '') ?? '').trim();
                    const workerIsCheongyeon = isCheongyeonTeamIdentity(resolvedTeam, sourceTeamId, sourceTeamName);

                    const targetTeamNameRaw = report.responsibleTeamName ?? reportSite?.responsibleTeamName ?? report.teamName ?? '';
                    const targetTeamIdRaw = (report.responsibleTeamId ?? reportSite?.responsibleTeamId ?? report.teamId ?? '').trim();
                    const fallbackTargetTeamByName = teamByName.get(normalizeName(targetTeamNameRaw));
                    const resolvedTargetTeam = (targetTeamIdRaw ? teamById.get(targetTeamIdRaw) : undefined) ?? fallbackTargetTeamByName;
                    const targetTeamId = (resolvedTargetTeam?.id ?? targetTeamIdRaw).trim();
                    const targetTeamName = resolvedTargetTeam?.name ?? report.responsibleTeamName ?? reportSite?.responsibleTeamName ?? report.teamName ?? '팀 미지정';
                    const targetCompanyId = (resolvedTargetTeam?.companyId ?? siteConstructorCompanyId ?? report.companyId ?? '').trim();
                    const targetCompanyName = resolvedTargetTeam?.companyName ?? siteConstructorCompanyName ?? report.companyName ?? '';
                    const targetIsCheongyeon = isCheongyeonTeamIdentity(resolvedTargetTeam, targetTeamId, targetTeamName);
                    const isSameFieldAndWorkerTeam = isSameTeamIdentity(
                        sourceTeamId,
                        sourceTeamName,
                        targetTeamId,
                        targetTeamName
                    );

                    type ClassifiedEntry = {
                        direction: SupportDirection;
                        viewTeamId: string;
                        viewTeamName: string;
                        settlementTeamId: string;
                        settlementTeamName: string;
                        settlementCompanyId: string;
                        settlementCompanyName: string;
                        sourceTeamId: string;
                        sourceTeamName: string;
                        counterpartyName: string;
                        evidenceNote: string;
                        settlementRule: string;
                    };
                    const classifiedEntries: ClassifiedEntry[] = [];

                    if (workerIsCheongyeon && targetIsCheongyeon && isSameFieldAndWorkerTeam) {
                        return;
                    }

                    if (workerIsCheongyeon && targetIsCheongyeon && sourceTeamId && targetTeamId) {
                        // 내부지원간곳: 우리(청연) 팀이 다른 청연 팀 현장으로 지원
                        // 정산 대상 = 작업자 소속 "팀" 기준
                        classifiedEntries.push({
                            direction: '내부지원간곳',
                            viewTeamId: sourceTeamId,
                            viewTeamName: sourceTeamName,
                            settlementTeamId: sourceTeamId,
                            settlementTeamName: sourceTeamName,
                            settlementCompanyId: workerCompanyId,
                            settlementCompanyName: fallbackCompanyName,
                            sourceTeamId,
                            sourceTeamName,
                            counterpartyName: targetTeamName || '청연 수신팀 미지정',
                            evidenceNote: '청연이엔지 소속 팀이 다른 청연이엔지 현장/팀으로 지원 나간 건',
                            settlementRule: SUPPORT_DIRECTION_META.내부지원간곳.rule
                        });
                        // 내부지원온곳: 다른 청연 팀이 우리 청연 현장/팀으로 지원
                        // 정산 대상 = 현장을 담당하는 "팀" 기준
                        classifiedEntries.push({
                            direction: '내부지원온곳',
                            viewTeamId: targetTeamId,
                            viewTeamName: targetTeamName,
                            settlementTeamId: targetTeamId,
                            settlementTeamName: targetTeamName,
                            settlementCompanyId: targetCompanyId,
                            settlementCompanyName: targetCompanyName,
                            sourceTeamId,
                            sourceTeamName,
                            counterpartyName: sourceTeamName || '청연 지원팀 미지정',
                            evidenceNote: '다른 청연이엔지 팀이 우리 청연이엔지 현장/팀으로 지원 온 건',
                            settlementRule: SUPPORT_DIRECTION_META.내부지원온곳.rule
                        });
                    } else if (siteClassification === '외부' && workerIsCheongyeon) {
                        // 외부지원간곳: 우리 팀이 외부 시공사 현장으로 지원
                        // 정산 대상 = 외부 현장담당팀 (팀이 없으면 현장/업체명 보조)
                        classifiedEntries.push({
                            direction: '외부지원간곳',
                            viewTeamId: sourceTeamId,
                            viewTeamName: sourceTeamName,
                            settlementTeamId: targetTeamId || targetCompanyId,
                            settlementTeamName: targetTeamName || targetCompanyName || siteConstructorCompanyName || '외부 시공사',
                            settlementCompanyId: targetCompanyId,
                            settlementCompanyName: targetCompanyName || siteConstructorCompanyName,
                            sourceTeamId,
                            sourceTeamName,
                            counterpartyName: siteConstructorCompanyName || report.siteName || '외부 현장',
                            evidenceNote: '청연이엔지 소속 팀이 외부 시공사 현장으로 지원 나간 건',
                            settlementRule: SUPPORT_DIRECTION_META.외부지원간곳.rule
                        });
                    } else if (siteClassification === '청연' && targetIsCheongyeon && !workerIsCheongyeon) {
                        // 외부지원온곳: 외부 팀(용역 등)이 우리 청연 현장으로 지원
                        // 정산 대상 = 외부 "팀" (돈을 정산해줘야 함)
                        classifiedEntries.push({
                            direction: '외부지원온곳',
                            viewTeamId: targetTeamId,
                            viewTeamName: targetTeamName,
                            settlementTeamId: sourceTeamId || workerCompanyId,
                            settlementTeamName: sourceTeamName || fallbackCompanyName || '외부 지원팀',
                            settlementCompanyId: workerCompanyId,
                            settlementCompanyName: fallbackCompanyName,
                            sourceTeamId,
                            sourceTeamName,
                            counterpartyName: sourceTeamName || fallbackCompanyName || '외부 지원팀',
                            evidenceNote: '외부팀이 청연이엔지 현장/팀으로 지원 온 건',
                            settlementRule: SUPPORT_DIRECTION_META.외부지원온곳.rule
                        });
                    } else if (siteClassification === '청연' && targetIsCheongyeon && (isSupportModel || isSupportTeam)) {
                        // 외부지원온곳 (지원팀 모델): 지원팀 소속 인원이 우리 청연 현장으로 지원
                        // 정산 대상 = 해당 "지원팀" (돈을 정산해줘야 함)
                        classifiedEntries.push({
                            direction: '외부지원온곳',
                            viewTeamId: targetTeamId,
                            viewTeamName: targetTeamName,
                            settlementTeamId: sourceTeamId || workerCompanyId,
                            settlementTeamName: sourceTeamName || fallbackCompanyName || '지원팀',
                            settlementCompanyId: workerCompanyId,
                            settlementCompanyName: fallbackCompanyName,
                            sourceTeamId,
                            sourceTeamName,
                            counterpartyName: sourceTeamName || fallbackCompanyName || '외부 지원팀',
                            evidenceNote: '지원팀 소속 또는 외부팀이 청연이엔지 현장/팀으로 지원 온 건',
                            settlementRule: SUPPORT_DIRECTION_META.외부지원온곳.rule
                        });
                    }
                    if (classifiedEntries.length === 0) return;

                    const siteId = report.siteId ?? 'unknown-site';
                    const siteName = report.siteName ?? '현장 미지정';
                    const paymentMethod = normalizePaymentMethod(reportSite?.paymentMethod ?? report.paymentType ?? reportWorker.paymentType);
                    const unitPrice = resolveConfiguredSiteRate(report.siteId, report.siteName) ??
                        toPositiveRate(resolvedTeam?.supportRate) ??
                        toPositiveRate(reportWorker.unitPrice) ??
                        DEFAULT_SUPPORT_UNIT_PRICE;
                    const manDay = typeof reportWorker.manDay === 'number' && Number.isFinite(reportWorker.manDay)
                        ? reportWorker.manDay
                        : 0;
                    const amount = Math.round(manDay * unitPrice);
                    const billingUnitPrice = unitPrice;
                    const { billingAmount, vatAmount, issuedAmount } = calculateBillingAmounts(manDay, billingUnitPrice);

                    classifiedEntries.forEach((entry) => {
                        const workerRecord: SupportWorkerBreakdown = {
                            date: reportDate,
                            reportId,
                            direction: entry.direction,
                            workerId: reportWorker.workerId ?? `${reportId}-${siteId}-${reportWorker.name ?? 'worker'}`,
                            workerName: reportWorker.name ?? '이름 미상',
                            role: reportWorker.role,
                            manDay,
                            unitPrice,
                            amount,
                            billingUnitPrice,
                            billingAmount,
                            vatAmount,
                            issuedAmount,
                            paymentMethod,
                            siteId: report.siteId,
                            siteName: report.siteName,
                            teamId: sourceTeamId,
                            teamName: sourceTeamName,
                            workerTeamId: sourceTeamId,
                            workerTeamName: sourceTeamName,
                            viewTeamId: entry.viewTeamId,
                            viewTeamName: entry.viewTeamName,
                            sourceTeamName: entry.sourceTeamName,
                            targetTeamName,
                            siteResponsibleTeamId: targetTeamId,
                            siteResponsibleTeamName: targetTeamName,
                            settlementTeamId: entry.settlementTeamId,
                            settlementTeamName: entry.settlementTeamName,
                            sourceCompanyName: fallbackCompanyName,
                            targetCompanyName,
                            counterpartyName: entry.counterpartyName,
                            evidenceNote: entry.evidenceNote
                        };

                        const companyDisplayName = entry.settlementTeamName || entry.sourceTeamName || '정산 주체';
                        const aggregateId = [
                            entry.direction,
                            normalize(entry.viewTeamId) || normalizeName(entry.viewTeamName) || 'unknown-view',
                            normalize(entry.settlementTeamId) || normalizeName(companyDisplayName) || 'unknown'
                        ].join('::');

                        const aggregate = ensureAggregate({
                            aggregateId,
                            direction: entry.direction,
                            viewTeamId: entry.viewTeamId,
                            viewTeamName: entry.viewTeamName,
                            companyId: entry.settlementTeamId,
                            companyName: companyDisplayName,
                            settlementTeamId: entry.settlementTeamId,
                            settlementTeamName: companyDisplayName,
                            settlementCompanyId: entry.settlementCompanyId,
                            settlementCompanyName: entry.settlementCompanyName,
                            sourceTeamId: entry.sourceTeamId,
                            sourceTeamName: entry.sourceTeamName,
                            counterpartyName: entry.counterpartyName,
                            evidenceNote: entry.evidenceNote,
                            settlementRule: entry.settlementRule,
                            targetTeamName: targetTeamName
                        });

                        aggregate.totalManDay += manDay;
                        aggregate.totalAmount += amount;
                        aggregate.billingAmount += billingAmount;
                        aggregate.vatAmount += vatAmount;
                        aggregate.issuedAmount += issuedAmount;
                        if (entry.sourceTeamId && !aggregate.sourceTeamIds.includes(entry.sourceTeamId)) {
                            aggregate.sourceTeamIds.push(entry.sourceTeamId);
                        }
                        if (entry.sourceTeamName && !aggregate.sourceTeamNames.includes(entry.sourceTeamName)) {
                            aggregate.sourceTeamNames.push(entry.sourceTeamName);
                        }
                        aggregate.sourceTeamName = summarizeNames(aggregate.sourceTeamNames);

                        const existingSite = aggregate.sites.find((s) => s.siteId === siteId);
                        if (existingSite) {
                            existingSite.totalManDay += manDay;
                            existingSite.totalAmount += amount;
                            existingSite.billingAmount += billingAmount;
                            existingSite.vatAmount += vatAmount;
                            existingSite.issuedAmount += issuedAmount;
                            existingSite.paymentMethod = summarizePaymentMethods([existingSite.paymentMethod, paymentMethod]);
                            if (unitPrice > 0) existingSite.unitPriceSamples.push(unitPrice);
                            if (billingUnitPrice > 0) existingSite.billingUnitPriceSamples.push(billingUnitPrice);
                            existingSite.workers.push(workerRecord);
                            if (entry.sourceTeamId && !existingSite.sourceTeamIds.includes(entry.sourceTeamId)) {
                                existingSite.sourceTeamIds.push(entry.sourceTeamId);
                            }
                            if (entry.sourceTeamName && !existingSite.sourceTeamNames.includes(entry.sourceTeamName)) {
                                existingSite.sourceTeamNames.push(entry.sourceTeamName);
                            }
                            existingSite.sourceTeamName = summarizeNames(existingSite.sourceTeamNames);
                        } else {
                            aggregate.sites.push({
                                siteId,
                                siteName,
                                direction: entry.direction,
                                viewTeamId: entry.viewTeamId,
                                viewTeamName: entry.viewTeamName,
                                sourceTeamIds: uniqueValues([entry.sourceTeamId]),
                                sourceTeamNames: uniqueValues([entry.sourceTeamName]),
                                sourceTeamName: entry.sourceTeamName,
                                counterpartyName: entry.counterpartyName,
                                evidenceNote: entry.evidenceNote,
                                settlementRule: entry.settlementRule,
                                totalManDay: manDay,
                                totalAmount: amount,
                                billingAmount,
                                vatAmount,
                                issuedAmount,
                                paymentMethod,
                                expenseClaimAmount: 0,
                                expenseClaimCount: 0,
                                expenseClaims: [],
                                unitPriceSamples: unitPrice > 0 ? [unitPrice] : [],
                                billingUnitPriceSamples: billingUnitPrice > 0 ? [billingUnitPrice] : [],
                                displayContent: `${siteName} ${entry.direction}`,
                                workers: [workerRecord]
                            });
                        }
                    });
                });
            });

            const aggregatesList = Array.from(aggregateMap.values()).map((aggregate) => {
                const sites = aggregate.sites
                    .map((site: SupportSiteRow) =>
                        recalcSiteFromWorkers(
                            site,
                            [...site.workers].sort((a, b) => a.workerName.localeCompare(b.workerName, 'ko-KR'))
                        )
                    )
                    .sort((a, b) => a.siteName.localeCompare(b.siteName, 'ko-KR'));
                return recalcAggregateFromSites(aggregate, sites);
            });

            return { aggregates: aggregatesList, errorMessages };
        },
        [companies, sites, supportRates, teams]
    );

    const fetchSupportData = useCallback(async () => {
        if (!selectedMonth) return;
        setLoading(true);
        try {
            const { start, end } = getMonthRange(selectedMonth);
            const [reports, teamExpenseClaims] = await Promise.all([
                dailyReportService.getReportsByRange(start, end),
                teamExpenseLedgerService.getClaimsByMonth(selectedMonth).catch((error) => {
                    console.error('후청구 데이터를 불러오지 못했습니다.', error);
                    return [] as TeamExpenseClaim[];
                })
            ]);
            const { aggregates: nextAggregates, errorMessages } = aggregateReports(reports);
            const withRateOverrides = applyMonthlyRateOverrides(nextAggregates, loadRateOverrides(selectedMonth));
            setAggregates(applyExpenseClaimsToAggregates(withRateOverrides, teamExpenseClaims));
            setErrors(errorMessages);
        } catch (error) {
            console.error('지원팀 데이터를 불러오는 중 오류가 발생했습니다.', error);
            setAggregates([]);
            setErrors(['지원팀 데이터를 불러오는 중 문제가 발생했습니다. 다시 시도해주세요.']);
        } finally {
            setLoading(false);
        }
    }, [aggregateReports, selectedMonth]);

    useEffect(() => {
        if (teams.length === 0 || companies.length === 0) return;
        void fetchSupportData();
    }, [fetchSupportData, teams.length, companies.length]);

    const filteredAggregates = useMemo(() => {
        let rows = aggregates.filter((aggregate) => scopedDirectionSet.has(aggregate.direction));
        if (selectedDirection !== 'all') {
            rows = rows.filter((aggregate) => aggregate.direction === selectedDirection);
        }
        if (activeSourceTeamId) {
            rows = rows.filter((aggregate) => matchesViewTeamIdentity(aggregate, activeSourceTeamId));
        }
        if (selectedSiteId) {
            rows = rows
                .map((aggregate) =>
                    recalcAggregateFromSites(
                        aggregate,
                        aggregate.sites.filter((site) => normalize(site.siteId) === normalize(selectedSiteId))
                    )
                )
                .filter((aggregate) => aggregate.sites.length > 0);
        }
        return rows;
    }, [activeSourceTeamId, aggregates, scopedDirectionSet, selectedDirection, selectedSiteId]);

    const displayAggregates = useMemo(
        () => activeSourceTeamId ? filteredAggregates : mergeAggregatesBySettlementTeam(filteredAggregates),
        [activeSourceTeamId, filteredAggregates]
    );

    const directionOptions = useMemo(() => [
        { id: 'all', name: '전체' },
        ...scopedDirections.map((direction) => ({ id: direction, name: SUPPORT_DIRECTION_META[direction].label }))
    ], [scopedDirections]);

    const siteOptions = useMemo(() => {
        const map = new Map<string, string>();
        aggregates
            .filter((aggregate) => scopedDirectionSet.has(aggregate.direction))
            .forEach((aggregate) => {
            aggregate.sites.forEach((site) => {
                const id = normalize(site.siteId);
                if (id && !map.has(id)) map.set(id, site.siteName || '현장 미지정');
            });
        });
        return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'ko-KR'));
    }, [aggregates, scopedDirectionSet]);

    const workerById = useMemo(() => {
        const map = new Map<string, Worker>();
        workers.forEach((worker) => { if (worker.id) map.set(worker.id, worker); });
        return map;
    }, [workers]);

    const siteById = useMemo(() => {
        const map = new Map<string, Site>();
        sites.forEach((site) => { if (site.id) map.set(site.id, site); });
        return map;
    }, [sites]);

    const supportExcelRows = useMemo<SupportLaborExcelRow[]>(() => {
        return displayAggregates.flatMap(aggregate => 
            aggregate.sites.flatMap(site => {
                const workerMap = new Map<string, SupportLaborExcelRow>();
                site.workers.forEach(entry => {
                    const key = entry.workerId ?? `${aggregate.companyId || 'unknown'}-${site.siteId}-${entry.workerName}`;
                    if (!workerMap.has(key)) {
                        const workerInfo = entry.workerId ? workerById.get(entry.workerId) : undefined;
                        const siteInfo = entry.siteId ? siteById.get(entry.siteId) : undefined;
                        const teamNames = uniqueValues([entry.workerTeamName, entry.teamName]);
                        workerMap.set(key, {
                            aggregateId: aggregate.aggregateId,
                            workerId: entry.workerId ?? key,
                            workerName: entry.workerName ?? '이름 미상',
                            idNumber: workerInfo?.idNumber ?? '',
                            contact: workerInfo?.contact ?? '',
                            address: workerInfo?.address ?? siteInfo?.address ?? '',
                            siteAddress: siteInfo?.address ?? '',
                            siteId: entry.siteId,
                            siteName: entry.siteName ?? siteInfo?.name ?? '',
                            teamId: entry.workerTeamId ?? entry.teamId,
                            teamNames,
                            bankName: workerInfo?.bankName ?? '',
                            accountNumber: workerInfo?.accountNumber ?? '',
                            accountHolder: workerInfo?.accountHolder ?? workerInfo?.name ?? entry.workerName ?? '',
                            workerLaborStatementPayType: getWorkerMasterLaborStatementPayType(workerInfo),
                            days: Array.from({ length: MAX_DAY_COLUMNS }, () => 0),
                            totalManDay: 0,
                            unitPrice: entry.unitPrice,
                            totalAmount: 0,
                            billingUnitPrice: entry.billingUnitPrice,
                            billingAmount: 0,
                            vatAmount: 0,
                            issuedAmount: 0,
                            paymentMethod: site.paymentMethod,
                            displayContent: site.displayContent
                        });
                    }
                    const target = workerMap.get(key)!;
                    const day = new Date(entry.date).getDate();
                    if (day >= 1 && day <= MAX_DAY_COLUMNS) target.days[day - 1] += entry.manDay;
                    target.totalManDay += entry.manDay;
                    target.totalAmount += entry.amount;
                    target.billingAmount += entry.billingAmount;
                    target.vatAmount += entry.vatAmount;
                    target.issuedAmount += entry.issuedAmount;
                    target.paymentMethod = summarizePaymentMethods([target.paymentMethod, entry.paymentMethod || site.paymentMethod]);
                    target.teamNames = uniqueValues([...(target.teamNames ?? []), entry.workerTeamName, entry.teamName]);
                });
                return Array.from(workerMap.values());
            })
        );
    }, [displayAggregates, workerById, siteById]);

    const exchangeSummaryRows = useMemo<SupportExchangeSummaryRow[]>(() => {
        return displayAggregates.flatMap(aggregate =>
            aggregate.sites.map(site => {
                const siteInfo = siteById.get(site.siteId);
                const supportOutTeamName = summarizeNames(site.workers.map(w => w.workerTeamName ?? w.teamName));
                const supportInTeamName = summarizeNames(
                    site.workers.map(w => w.siteResponsibleTeamName ?? w.targetTeamName),
                    siteInfo?.responsibleTeamName ?? '-'
                );
                return {
                    aggregateId: aggregate.aggregateId,
                    direction: aggregate.direction,
                    sourceTeamName: aggregate.sourceTeamName,
                    counterpartyName: aggregate.companyName,
                    supportOutTeamName,
                    supportInTeamName,
                    siteResponsibleTeamName: supportInTeamName || siteInfo?.responsibleTeamName || '-',
                    companyName: aggregate.companyName,
                    bankName: aggregate.bankName,
                    accountNumber: aggregate.accountNumber,
                    accountHolder: aggregate.accountHolder,
                    siteId: site.siteId,
                    siteName: site.siteName,
                    workerCount: new Set(site.workers.map(w => w.workerId)).size,
                    totalManDay: site.totalManDay,
                    totalAmount: site.totalAmount,
                    issuedAmount: site.issuedAmount,
                    evidenceNote: aggregate.evidenceNote
                };
            })
        ).sort((a, b) => a.direction.localeCompare(b.direction) || a.sourceTeamName.localeCompare(b.sourceTeamName));
    }, [displayAggregates, siteById]);

    const photoStyleSummaryGroups = useMemo(() => {
        return scopedDirections.map(dir => ({
            direction: dir,
            label: SUPPORT_DIRECTION_META[dir].label,
            cellClass: SUPPORT_DIRECTION_META[dir].cellClass,
            aggregates: displayAggregates.filter(a => a.direction === dir)
        }));
    }, [displayAggregates, scopedDirections]);

    const totalSummary = useMemo(() => displayAggregates.reduce((acc, agg) => {
        const additionalAmount = getAggregateAdditionalAmount(agg, manualAdjustments);
        return {
            totalManDay: acc.totalManDay + agg.totalManDay,
            issuedAmount: acc.issuedAmount + agg.issuedAmount,
            totalAmount: acc.totalAmount + agg.totalAmount,
            additionalAmount: acc.additionalAmount + additionalAmount,
            partnerCount: acc.partnerCount + 1,
            siteCount: acc.siteCount + agg.sites.length
        };
    }, { totalManDay: 0, issuedAmount: 0, totalAmount: 0, additionalAmount: 0, partnerCount: 0, siteCount: 0 }), [displayAggregates, manualAdjustments]);


    const handleApplyBulkSupportRate = () => {
        const unitPrice = parseMoneyInput(bulkSupportRateInput);
        if (unitPrice <= 0) {
            window.alert('적용할 지원단가를 입력해주세요.');
            return;
        }
        setBulkSupportRateInput(formatNumber(unitPrice));
        setMonthlyRateOverrideState(prev => {
            const baseData = prev.month === selectedMonth ? prev.data : loadRateOverrides(selectedMonth);
            return {
                month: selectedMonth,
                data: normalizeRateOverrides({
                    ...baseData,
                    bulkSupportRate: unitPrice
                })
            };
        });
        setAggregates(prev => prev.map(aggregate => applyUnitPriceToAggregate(aggregate, unitPrice)));
    };

    const handleApplyBulkRate = () => {
        const unitPrice = parseMoneyInput(bulkRateInput);
        if (unitPrice <= 0) {
            window.alert('적용할 청구단가를 입력해주세요.');
            return;
        }
        setBulkRateInput(formatNumber(unitPrice));
        setMonthlyRateOverrideState(prev => {
            const baseData = prev.month === selectedMonth ? prev.data : loadRateOverrides(selectedMonth);
            return {
                month: selectedMonth,
                data: normalizeRateOverrides({
                    ...baseData,
                    bulkRate: unitPrice
                })
            };
        });
        setAggregates(prev => prev.map(aggregate => applyBillingUnitPriceToAggregate(aggregate, unitPrice)));
    };

    const handleApplyAggregateSupportRate = (targetAggregate: SupportCompanyAggregate, rawValue: string) => {
        const unitPrice = parseMoneyInput(rawValue);
        const teamRateKey = getAggregateEditMatchKey(targetAggregate);
        const targetAggregateIds = getAggregateEditTargetIds(aggregates, targetAggregate);
        setMonthlyRateOverrideState(prev => {
            const baseData = prev.month === selectedMonth ? prev.data : loadRateOverrides(selectedMonth);
            const nextTeamRates = {
                ...baseData.supportTeamRates,
                [teamRateKey]: unitPrice
            };
            const nextAggregateRates = { ...baseData.supportAggregateRates };
            targetAggregateIds.forEach((aggregateId) => {
                nextAggregateRates[aggregateId] = unitPrice;
            });
            return {
                month: selectedMonth,
                data: normalizeRateOverrides({
                    ...baseData,
                    supportTeamRates: nextTeamRates,
                    supportAggregateRates: nextAggregateRates
                })
            };
        });
        setAggregates(prev => prev.map(aggregate =>
            matchesAggregateEditTarget(aggregate, targetAggregate)
                ? applyUnitPriceToAggregate(aggregate, unitPrice)
                : aggregate
        ));
    };

    const handleApplyAggregateRate = (targetAggregate: SupportCompanyAggregate, rawValue: string) => {
        const unitPrice = parseMoneyInput(rawValue);
        const teamRateKey = getAggregateEditMatchKey(targetAggregate);
        const targetAggregateIds = getAggregateEditTargetIds(aggregates, targetAggregate);
        setMonthlyRateOverrideState(prev => {
            const baseData = prev.month === selectedMonth ? prev.data : loadRateOverrides(selectedMonth);
            const nextTeamRates = {
                ...baseData.teamRates,
                [teamRateKey]: unitPrice
            };
            const nextAggregateRates = { ...baseData.aggregateRates };
            targetAggregateIds.forEach((aggregateId) => {
                nextAggregateRates[aggregateId] = unitPrice;
            });
            return {
                month: selectedMonth,
                data: normalizeRateOverrides({
                    ...baseData,
                    teamRates: nextTeamRates,
                    aggregateRates: nextAggregateRates
                })
            };
        });
        setAggregates(prev => prev.map(aggregate =>
            matchesAggregateEditTarget(aggregate, targetAggregate)
                ? applyBillingUnitPriceToAggregate(aggregate, unitPrice)
                : aggregate
        ));
    };

    const handleApplySiteSupportRate = (targetAggregate: SupportCompanyAggregate, siteId: string, rawValue: string) => {
        const unitPrice = parseMoneyInput(rawValue);
        const teamRateKey = getAggregateEditMatchKey(targetAggregate);
        const targetAggregateIds = getAggregateEditTargetIds(aggregates, targetAggregate);
        setMonthlyRateOverrideState(prev => {
            const baseData = prev.month === selectedMonth ? prev.data : loadRateOverrides(selectedMonth);
            const nextSiteRates = { ...baseData.supportSiteRates };
            nextSiteRates[getMonthlySiteRateKey(teamRateKey, siteId)] = unitPrice;
            targetAggregateIds.forEach((aggregateId) => {
                nextSiteRates[getMonthlySiteRateKey(aggregateId, siteId)] = unitPrice;
            });
            return {
                month: selectedMonth,
                data: normalizeRateOverrides({
                    ...baseData,
                    supportSiteRates: nextSiteRates
                })
            };
        });
        setAggregates(prev => prev.map(aggregate => {
            if (!matchesAggregateEditTarget(aggregate, targetAggregate)) return aggregate;
            const nextSites = aggregate.sites.map(site =>
                site.siteId === siteId ? applyUnitPriceToSite(site, unitPrice) : site
            );
            return recalcAggregateFromSites(aggregate, nextSites);
        }));
    };

    const handleApplySiteRate = (targetAggregate: SupportCompanyAggregate, siteId: string, rawValue: string) => {
        const unitPrice = parseMoneyInput(rawValue);
        const teamRateKey = getAggregateEditMatchKey(targetAggregate);
        const targetAggregateIds = getAggregateEditTargetIds(aggregates, targetAggregate);
        setMonthlyRateOverrideState(prev => {
            const baseData = prev.month === selectedMonth ? prev.data : loadRateOverrides(selectedMonth);
            const nextSiteRates = { ...baseData.siteRates };
            nextSiteRates[getMonthlySiteRateKey(teamRateKey, siteId)] = unitPrice;
            targetAggregateIds.forEach((aggregateId) => {
                nextSiteRates[getMonthlySiteRateKey(aggregateId, siteId)] = unitPrice;
            });
            return {
                month: selectedMonth,
                data: normalizeRateOverrides({
                    ...baseData,
                    siteRates: nextSiteRates
                })
            };
        });
        setAggregates(prev => prev.map(aggregate => {
            if (!matchesAggregateEditTarget(aggregate, targetAggregate)) return aggregate;
            const nextSites = aggregate.sites.map(site =>
                site.siteId === siteId ? applyBillingUnitPriceToSite(site, unitPrice) : site
            );
            return recalcAggregateFromSites(aggregate, nextSites);
        }));
    };

    const kbRows = useMemo(() => {
        const label = `${parseInt(selectedMonth.split('-')[1] ?? '0', 10)}월`;
        return displayAggregates.map(agg => ({
            bankCode: agg.bankCode,
            accountNumber: agg.accountNumber,
            accountHolder: agg.accountHolder,
            amount: getAggregateTotalWithAdditional(agg, manualAdjustments),
            description: `${agg.direction} ${agg.viewTeamName} ${agg.companyName} ${label} ${agg.sites.length}개 현장`
        }));
    }, [displayAggregates, manualAdjustments, selectedMonth]);

    const previewRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const capturePreview = useCallback(async (key: string, fileName: string) => {
        const node = previewRefs.current[key];
        if (!node) {
            window.alert('이미지로 저장할 미리보기 영역을 찾지 못했습니다.');
            return;
        }

        try {
            setCapturingKey(key);
            await waitForDocumentFonts();
            const rect = node.getBoundingClientRect();
            const width = Math.ceil(node.scrollWidth || rect.width);
            const height = Math.ceil(node.scrollHeight || rect.height);
            if (width <= 0 || height <= 0) {
                window.alert('이미지로 저장할 영역의 크기를 확인하지 못했습니다.');
                return;
            }

            const canvas = await html2canvas(node, {
                backgroundColor: '#ffffff',
                scale: getCaptureScale(width, height),
                useCORS: true,
                allowTaint: false,
                logging: false,
                width,
                height,
                windowWidth: Math.max(document.documentElement.clientWidth, width),
                windowHeight: Math.max(document.documentElement.clientHeight, height),
                scrollX: 0,
                scrollY: -window.scrollY,
                onclone: (clonedDocument: Document) => {
                    clonedDocument.querySelectorAll('[data-capture-ignore="true"]').forEach((element) => {
                        (element as HTMLElement).style.display = 'none';
                    });
                }
            } as any);

            const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            if (!blob) {
                window.alert('이미지 파일 생성에 실패했습니다.');
                return;
            }
            saveAs(blob, fileName);
        } catch (error) {
            console.error('이미지 저장 실패:', error);
            window.alert('이미지 저장 중 문제가 발생했습니다. 다시 시도해주세요.');
        } finally {
            setCapturingKey(null);
        }
    }, []);

    const handleDownloadLabor = async () => {
        if (sitePreviews.length === 0) return window.alert('데이터 없음');
        await generateLaborStatementExcel(
            sitePreviews.map(buildLaborStatementExcelBlock),
            selectedMonth,
            { fileName: `노무내역서_${selectedMonth}_전체.xlsx` }
        );
    };

    const handleDownloadSingleLabor = async (preview: SitePreviewBlock) => {
        if (preview.rows.length === 0) return window.alert('데이터 없음');
        await generateLaborStatementExcel(
            [buildLaborStatementExcelBlock(preview)],
            selectedMonth,
            { fileName: getLaborStatementFileName(preview, selectedMonth) }
        );
    };

    const handleDownloadKB = () => {
        if (kbRows.length === 0) return window.alert('데이터 없음');
        const header = ['A. 은행코드', 'B. 계좌번호', 'C. 이체금액', 'D. 받는분통장표시', 'E. 내통장메모'];
        const rows = kbRows.map(r => [r.bankCode, r.accountNumber, r.amount, r.accountHolder, r.description]);
        const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
        ws['!cols'] = [{ wch: 8 }, { wch: 20 }, { wch: 14 }, { wch: 16 }, { wch: 20 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '국민은행용');
        XLSX.writeFile(wb, `support-team-kb-${selectedMonth}.xlsx`);
    };

    const sidebarTeams = useMemo(() => {
        const map = new Map<string, { id: string; name: string; error: boolean; count: number }>();
        const companyById = new Map<string, Company>();
        companies.forEach(company => {
            if (company.id) companyById.set(normalize(company.id), company);
        });
        const teamById = new Map<string, Team>();
        const teamByName = new Map<string, Team>();
        teams.forEach(team => {
            if (team.id) teamById.set(normalize(team.id), team);
            const nameKey = normalizeName(team.name);
            if (nameKey && !teamByName.has(nameKey)) teamByName.set(nameKey, team);
        });
        const isCheongyeonViewTeam = (teamId?: string, teamName?: string): boolean => {
            const team =
                teamById.get(normalize(teamId)) ??
                teamByName.get(normalizeName(teamName));
            if (!team) return false;
            const companyId = normalize(team.companyId);
            const company = companyId ? companyById.get(companyId) : undefined;
            return Boolean(company?.isMyCompany) ||
                isCheongyeonCompanyName(team.companyName) ||
                isCheongyeonCompanyName(company?.name);
        };

        aggregates.filter((agg) => scopedDirectionSet.has(agg.direction)).forEach(agg => {
            if (!isCheongyeonViewTeam(agg.viewTeamId, agg.viewTeamName)) return;
            const err = Object.values(agg.errors).some(Boolean);
            const id = agg.viewTeamId || normalizeName(agg.viewTeamName) || 'unknown-view-team';
            const name = agg.viewTeamName || '기준팀 미지정';
            const ex = map.get(id);
            if (!ex) map.set(id, { id, name, error: err, count: 1 });
            else { ex.count++; if (err) ex.error = true; }
        });
        return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'ko-KR'));
    }, [aggregates, companies, scopedDirectionSet, teams]);

    useEffect(() => {
        if (selectedSourceTeamId && !sidebarTeams.some(team => team.id === selectedSourceTeamId)) {
            setSelectedSourceTeamId('');
        }
    }, [selectedSourceTeamId, sidebarTeams]);

    const sitePreviews: SitePreviewBlock[] = useMemo(() => 
        displayAggregates.flatMap(agg => agg.sites.map(s => ({
            aggregate: agg,
            site: s,
            rows: supportExcelRows.filter(r => r.aggregateId === agg.aggregateId && (r.siteId === s.siteId || r.siteName === s.siteName))
        }))), [displayAggregates, supportExcelRows]);

    const laborStatementContext = useMemo(
        () => resolveStatementTargetContext(laborStatementSelection, displayAggregates),
        [displayAggregates, laborStatementSelection]
    );

    const laborStatementTarget = laborStatementContext?.aggregate ?? null;

    const laborStatementAdjustment = useMemo(
        () => laborStatementContext?.site
            ? normalizeManualAdjustment(undefined)
            : laborStatementTarget
                ? getAdjustment(manualAdjustments, laborStatementTarget.aggregateId)
                : normalizeManualAdjustment(undefined),
        [laborStatementContext, laborStatementTarget, manualAdjustments]
    );

    const laborStatementTargetPreviews = useMemo(
        () => {
            if (!laborStatementContext) return [];

            const previews = sitePreviews.filter(preview => {
                if (preview.aggregate.aggregateId !== laborStatementContext.sourceAggregate.aggregateId) return false;
                if (!laborStatementContext.siteKey) return true;
                return getAggregateSiteRowKey(preview.aggregate, preview.site) === laborStatementContext.siteKey;
            });

            return previews.map(preview => ({
                ...preview,
                aggregate: laborStatementContext.aggregate
            }));
        },
        [laborStatementContext, sitePreviews]
    );

    const closeLaborStatementPanel = useCallback(() => {
        setLaborStatementSelection(null);
    }, []);

    const toggleLaborStatementPanel = useCallback((selection: Exclude<StatementTargetSelection, null>) => {
        setLaborStatementSelection((prev) =>
            isSameStatementSelection(prev, selection.aggregateId, selection.siteKey)
                ? null
                : selection
        );
    }, []);

    const isLaborStatementPanelOpen = useCallback(
        (aggregateId: string, siteKey?: string): boolean =>
            isSameStatementSelection(laborStatementSelection, aggregateId, siteKey),
        [laborStatementSelection]
    );

    const renderLaborStatementPanelRow = useCallback((aggregateId: string, siteKey?: string) => {
        if (!isLaborStatementPanelOpen(aggregateId, siteKey) || !laborStatementTarget) return null;

        return (
            <tr>
                <td colSpan={12} className="border border-slate-900 bg-emerald-50 p-4">
                    <SupportLaborStatementPanel
                        aggregate={laborStatementTarget}
                        previews={laborStatementTargetPreviews}
                        yearMonth={selectedMonth}
                        adjustment={laborStatementAdjustment}
                        logoUrl={statementLogoUrl}
                        onClose={closeLaborStatementPanel}
                    />
                </td>
            </tr>
        );
    }, [
        closeLaborStatementPanel,
        isLaborStatementPanelOpen,
        laborStatementAdjustment,
        laborStatementTarget,
        laborStatementTargetPreviews,
        selectedMonth,
        statementLogoUrl
    ]);

    const expenseStatementContext = useMemo(
        () => resolveStatementTargetContext(expenseStatementSelection, displayAggregates),
        [displayAggregates, expenseStatementSelection]
    );

    const expenseStatementTarget = expenseStatementContext?.aggregate ?? null;

    const expenseStatementClaims = useMemo(
        () => {
            if (!expenseStatementContext) return [];
            const adjustmentKey = expenseStatementContext.siteKey ?? expenseStatementContext.aggregate.aggregateId;
            return getExpenseStatementClaims(
                expenseStatementContext.aggregate,
                selectedMonth,
                expenseStatementContext.site ?? undefined,
                getAdjustment(manualAdjustments, adjustmentKey)
            );
        },
        [expenseStatementContext, manualAdjustments, selectedMonth]
    );
    const scopedTeamBasisLabel = scope === 'internalOut' ? '작업팀' : scope === 'internalIn' ? '현장담당팀' : '정산 주체';
    const scopedAllTeamLabel = scope === 'internalOut' ? '전체 작업팀' : scope === 'internalIn' ? '전체 현장담당팀' : '전체 기준팀';
    const scopedTeamColumnLabel = scope === 'external' ? '담당팀 / 현장' : scope === 'internalOut' ? '작업팀' : scope === 'internalIn' ? '현장담당팀' : '팀 명';
    const scopedSidebarFilterLabel = scope === 'internalOut' ? '작업팀 필터' : scope === 'internalIn' ? '현장담당팀 필터' : '기준팀 필터';

    if (loading && aggregates.length === 0) {
        return (
            <div className="support-team-font flex flex-col items-center justify-center min-h-[400px] gap-4 font-['Pretendard']">
                <FontAwesomeIcon icon={faSpinner} spin className="text-4xl text-amber-500" />
                <p className="text-slate-500 font-bold">정산 데이터를 집계하고 있습니다...</p>
            </div>
        );
    }

    return (
        <div className="support-team-font p-6 w-full max-w-none space-y-6 font-['Pretendard']">
            <PayrollIssueTopTabs />

            {/* 상단 헤더 영역 */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="bg-amber-100 text-amber-600 rounded-xl p-3 shadow-inner">
                        <FontAwesomeIcon icon={faUsers} size="lg" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 tracking-tight">{pageTitle}</h1>
                        <p className="text-[13px] text-slate-500 font-bold mt-0.5 flex items-center gap-2">
                            <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">BETA</span>
                            {pageDescription}
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2.5">
                    <ActionButton variant="solid-green" disabled={supportExcelRows.length === 0} onClick={() => setShowLaborPreview(true)}>
                        <FontAwesomeIcon icon={faFileExcel} /> 노무내역서 미리보기
                    </ActionButton>
                    <ActionButton variant="outline-green" disabled={supportExcelRows.length === 0} onClick={handleDownloadLabor}>
                        <FontAwesomeIcon icon={faFileExcel} /> 엑셀 다운로드
                    </ActionButton>
                    <ActionButton variant="outline-amber" disabled={kbRows.length === 0} onClick={() => setShowKBPreview(true)}>
                        <FontAwesomeIcon icon={faSearch} /> 국민은행 미리보기
                    </ActionButton>
                    <ActionButton variant="solid-amber" disabled={kbRows.length === 0} onClick={handleDownloadKB}>
                        <FontAwesomeIcon icon={faFileExcel} /> 국민은행용 다운로드
                    </ActionButton>
                </div>
            </div>

            <div className="flex w-full flex-col gap-6 lg:flex-row">
                {/* 좌측 사이드바 */}
                {!hideSidebarFilter && (
                    <aside className="w-full lg:w-72 flex-none space-y-4">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden sticky top-6">
                        <div className="px-4 py-3.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                            <span className="text-sm font-black text-slate-700">{scopedSidebarFilterLabel}</span>
                            <span className="bg-slate-200 text-slate-600 text-[10px] px-2 py-0.5 rounded-full font-black">{sidebarTeams.length}</span>
                        </div>
                        <div className="max-h-[calc(100vh-300px)] overflow-y-auto p-2 space-y-1.5">
                            <button
                                onClick={() => setSelectedSourceTeamId('')}
                                className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-3 ${
                                    selectedSourceTeamId === '' ? 'bg-amber-500 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                <FontAwesomeIcon icon={faUsers} className={selectedSourceTeamId === '' ? 'opacity-100' : 'opacity-40'} />
                                전체 현황판
                            </button>
                            <div className="h-px bg-slate-100 my-2 mx-2"></div>
                            {sidebarTeams.map(team => (
                                <button
                                    key={team.id}
                                    onClick={() => setSelectedSourceTeamId(team.id)}
                                    className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-between group ${
                                        selectedSourceTeamId === team.id ? 'bg-amber-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'
                                    }`}
                                >
                                    <span className="truncate">{team.name}</span>
                                    <div className="flex items-center gap-2">
                                        {team.error && <FontAwesomeIcon icon={faExclamationTriangle} className={selectedSourceTeamId === team.id ? 'text-white' : 'text-rose-500 animate-pulse'} />}
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                                            selectedSourceTeamId === team.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                                        }`}>
                                            {team.count}
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                    </aside>
                )}

                {/* 우측 메인 */}
                <div className="min-w-0 flex-1 space-y-6">
                    {/* 상단 요약 카드 및 필터 */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-3">
                                <FontAwesomeIcon icon={faCalendarAlt} className="text-amber-500" />
                                <span className="text-sm font-bold text-slate-500">집계 기준월</span>
                                <div className="flex min-h-10 items-center gap-1 rounded-xl border border-slate-200 bg-white px-2 shadow-sm" aria-label="집계 기준월 선택">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedMonth((current) => shiftYearMonth(current, -1))}
                                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-50 hover:text-amber-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                                        aria-label="이전 달 보기"
                                        title="이전 달"
                                    >
                                        <FontAwesomeIcon icon={faChevronLeft} className="text-xs" />
                                    </button>
                                    <span className="min-w-[92px] px-2 text-center text-sm font-black text-slate-800" aria-live="polite">
                                        {formatYearMonthLabel(selectedMonth)}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedMonth((current) => shiftYearMonth(current, 1))}
                                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-50 hover:text-amber-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                                        aria-label="다음 달 보기"
                                        title="다음 달"
                                    >
                                        <FontAwesomeIcon icon={faChevronRight} className="text-xs" />
                                    </button>
                                </div>
                            </div>
                            <div className="h-6 w-px bg-slate-200 hidden sm:block" />
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-bold text-slate-500">지원단가</span>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={bulkSupportRateInput}
                                    onChange={(event) => setBulkSupportRateInput(event.target.value)}
                                    onFocus={(event) => event.currentTarget.select()}
                                    className="h-9 w-32 rounded-lg border border-slate-200 bg-slate-50 px-3 text-right text-sm font-black text-slate-900 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100"
                                    aria-label="일괄 적용 지원단가"
                                />
                                <span className="text-sm font-bold text-slate-500">원</span>
                                <button
                                    type="button"
                                    onClick={handleApplyBulkSupportRate}
                                    disabled={loading || aggregates.length === 0}
                                    className="inline-flex h-9 items-center gap-2 rounded-lg bg-sky-700 px-3 text-sm font-black text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                                >
                                    <FontAwesomeIcon icon={faCircleCheck} />
                                    일괄적용
                                </button>
                                <span className="text-[11px] font-bold text-slate-400">
                                    기본 지원단가 {formatNumber(DEFAULT_SUPPORT_UNIT_PRICE)}원
                                    {monthlyRateOverrides.bulkSupportRate ? ` · ${selectedMonth} 적용됨` : ''}
                                </span>
                            </div>
                            <div className="h-6 w-px bg-slate-200 hidden sm:block" />
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-bold text-slate-500">청구단가</span>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={bulkRateInput}
                                    onChange={(event) => setBulkRateInput(event.target.value)}
                                    onFocus={(event) => event.currentTarget.select()}
                                    className="h-9 w-32 rounded-lg border border-slate-200 bg-slate-50 px-3 text-right text-sm font-black text-slate-900 outline-none transition focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100"
                                    aria-label="일괄 적용 청구단가"
                                />
                                <span className="text-sm font-bold text-slate-500">원</span>
                                <button
                                    type="button"
                                    onClick={handleApplyBulkRate}
                                    disabled={loading || aggregates.length === 0}
                                    className="inline-flex h-9 items-center gap-2 rounded-lg bg-slate-900 px-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                                >
                                    <FontAwesomeIcon icon={faCircleCheck} />
                                    월 적용
                                </button>
                                <span className="text-[11px] font-bold text-slate-400">
                                    기본 청구단가 {formatNumber(DEFAULT_SUPPORT_UNIT_PRICE)}원
                                    {monthlyRateOverrides.bulkRate ? ` · ${selectedMonth} 적용됨` : ''}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <select
                                value={selectedDirection}
                                onChange={(e) => setSelectedDirection(e.target.value as any)}
                                className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-black focus:ring-2 focus:ring-amber-500 outline-none"
                            >
                                {directionOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                            </select>
                            <select
                                value={selectedSiteId}
                                onChange={(e) => setSelectedSiteId(e.target.value)}
                                className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-black focus:ring-2 focus:ring-amber-500 outline-none"
                            >
                                <option value="">모든 현장</option>
                                {siteOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
                        <SummaryCard label="총 투입 공수" value={`${formatNumber(totalSummary.totalManDay)} 공`} icon={faCalendarAlt} tone="violet" />
                        <SummaryCard label="총 노임총액" value={`${formatNumber(totalSummary.totalAmount)} 원`} icon={faCircleCheck} tone="sky" />
                        <SummaryCard label="총 추가금액" value={`${formatNumber(totalSummary.additionalAmount)} 원`} icon={faFileInvoiceDollar} tone="orange" />
                        <SummaryCard label="총 발행금액" value={`${formatNumber(totalSummary.issuedAmount)} 원`} icon={faCircleCheck} tone="emerald" />
                        <SummaryCard label={scopedTeamBasisLabel} value={`${formatNumber(totalSummary.partnerCount)} 팀`} icon={faUsers} tone="sky" />
                        <SummaryCard label={`관련 ${pageTitle}`} value={`${formatNumber(totalSummary.siteCount)} 개`} icon={faCircleExclamation} tone="orange" />
                    </div>

                    <div className="bg-white border border-slate-900 shadow-sm overflow-hidden">
                        <div className="px-5 py-3 border-b border-slate-900 bg-white flex items-center justify-between">
                            <h2 className="text-base font-black text-slate-900">
                                {activeSourceTeamId ? sidebarTeams.find(t => t.id === activeSourceTeamId)?.name : scopedAllTeamLabel} {pageTitle} 정산 요약
                            </h2>
                            <span className="text-[11px] font-bold text-slate-500">
                                {scope === 'external'
                                    ? '외부지원간곳은 1단 외부지원간곳 · 2단 현장담당팀 · 3단 현장 · 4단 작업자 상세로 표시합니다.'
                                    : '팀 행을 클릭하면 현장 상세가 열립니다.'}
                            </span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[1700px] border-collapse text-[13px]">
                                <thead>
                                    <tr className="text-center font-black text-slate-950">
                                        <th className="w-14 border border-slate-900 bg-gradient-to-br from-yellow-100 via-yellow-400 to-white p-2"></th>
                                        <th className={`border border-slate-900 bg-gradient-to-br from-white via-slate-200 to-slate-500 py-2 ${scope === 'external' ? 'w-36 px-1 text-left tracking-[0.05em]' : 'w-36 px-2 tracking-[0.35em]'}`}>
                                            {scopedTeamColumnLabel}
                                        </th>
                                        <th className="w-24 border border-slate-900 bg-gradient-to-br from-white via-amber-50 to-amber-200 p-2 tracking-[0.15em]">결제구분</th>
                                        <th className="w-20 border border-slate-900 bg-gradient-to-br from-white via-slate-200 to-slate-500 p-2 tracking-[0.35em]">공 수</th>
                                        <th className="w-28 border border-slate-900 bg-gradient-to-br from-white via-slate-200 to-slate-500 p-2 tracking-[0.05em] text-slate-950">지원단가</th>
                                        <th className="w-32 border border-slate-900 bg-gradient-to-br from-white via-slate-200 to-slate-500 p-2 tracking-[0.05em] text-slate-950">노임 총액</th>
                                        <th className="w-28 border border-slate-900 bg-gradient-to-br from-white via-slate-200 to-slate-500 p-2 tracking-[0.05em] text-slate-950">청구단가</th>
                                        <th className="w-32 border border-slate-900 bg-gradient-to-br from-white via-slate-200 to-slate-500 p-2 tracking-[0.05em] text-slate-950">발행금액</th>
                                        <th className="w-24 border border-slate-900 bg-gradient-to-br from-white via-slate-200 to-slate-500 p-2">
                                            <div>추가 금액</div>
                                            <div className="mt-0.5 text-[9px] tracking-normal text-slate-600">직접입력 · 자동저장</div>
                                        </th>
                                        <th className="w-32 border border-slate-900 bg-gradient-to-br from-white via-slate-200 to-slate-500 p-2 tracking-[0.35em]">합 계</th>
                                        <th className="w-36 border border-slate-900 bg-gradient-to-br from-white via-slate-200 to-slate-500 p-2 tracking-[0.2em]">진행구분</th>
                                        <th className="w-44 border border-slate-900 bg-gradient-to-br from-white via-slate-200 to-slate-500 p-2 tracking-[0.35em]">비 고</th>
                                        <th className="w-44 border border-slate-900 bg-gradient-to-br from-white via-slate-200 to-slate-500 p-2 tracking-[0.35em]">기 타</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {photoStyleSummaryGroups.every(group => group.aggregates.length === 0) ? (
                                        <tr>
                                            <td colSpan={13} className="border border-slate-900 px-4 py-16 text-center font-bold text-slate-400">
                                                해당 조건의 정산 내역이 없습니다.
                                            </td>
                                        </tr>
                                    ) : (
                                        photoStyleSummaryGroups.map(group => {
                                            if (group.aggregates.length === 0) return null;
                                            const groupManDay = group.aggregates.reduce((sum, agg) => sum + agg.totalManDay, 0);
                                            const groupAmount = group.aggregates.reduce((sum, agg) => sum + agg.totalAmount, 0);
                                            const groupBillingAmount = group.aggregates.reduce((sum, agg) => sum + agg.billingAmount, 0);
                                            const groupIssuedAmount = group.aggregates.reduce((sum, agg) => sum + agg.issuedAmount, 0);
                                            const groupExpenseClaimAmount = group.aggregates.reduce((sum, agg) => sum + getAggregateExpenseClaimAmount(agg), 0);
                                            const groupAdditional = group.aggregates.reduce((sum, agg) => sum + getAggregateAdditionalAmount(agg, manualAdjustments), 0);
                                            const groupTotal = group.aggregates.reduce((sum, agg) => sum + getAggregateTotalWithAdditional(agg, manualAdjustments), 0);
                                            const groupPaymentMethod = summarizePaymentMethods(group.aggregates.flatMap(agg => agg.sites.map(site => site.paymentMethod)));
                                            const isExternalSupportGroup = group.direction === EXTERNAL_SUPPORT_OUT_DIRECTION;
                                            const isDirectionExpanded = !isExternalSupportGroup || expandedDirectionGroups.has(group.direction);
                                            const visibleAggregates = isDirectionExpanded ? group.aggregates : [];
                                            const groupExpandedSiteCount = visibleAggregates.reduce((sum, agg) => {
                                                if (!expandedAggregates.has(agg.aggregateId)) return sum;
                                                const expandedWorkerDetailCount = agg.sites.filter(site =>
                                                    expandedSiteRows.has(getAggregateSiteRowKey(agg, site))
                                                ).length;
                                                return sum + agg.sites.length + expandedWorkerDetailCount;
                                            }, 0);
                                            const groupLaborPanelRowCount = visibleAggregates.reduce((sum, agg) => {
                                                const aggregatePanelCount = isLaborStatementPanelOpen(agg.aggregateId) ? 1 : 0;
                                                const sitePanelCount = expandedAggregates.has(agg.aggregateId)
                                                    ? agg.sites.filter(site =>
                                                        isLaborStatementPanelOpen(agg.aggregateId, getAggregateSiteRowKey(agg, site))
                                                    ).length
                                                    : 0;
                                                return sum + aggregatePanelCount + sitePanelCount;
                                            }, 0);
                                            const groupRowSpan = isExternalSupportGroup
                                                ? 1 + (isDirectionExpanded ? group.aggregates.length + groupExpandedSiteCount + groupLaborPanelRowCount : 0)
                                                : group.aggregates.length + groupExpandedSiteCount + groupLaborPanelRowCount + 1;
                                            const groupAverageUnitPrice = groupManDay > 0 ? Math.round(groupAmount / groupManDay) : 0;
                                            const groupAverageBillingUnitPrice = groupManDay > 0 ? Math.round(groupBillingAmount / groupManDay) : 0;

                                            return (
                                                <React.Fragment key={group.label}>
                                                    {isExternalSupportGroup && (
                                                        <tr
                                                            onClick={() => toggleDirectionGroup(group.direction)}
                                                            className="cursor-pointer bg-white transition-colors hover:bg-emerald-50"
                                                        >
                                                            <td
                                                                rowSpan={groupRowSpan}
                                                                className="border border-slate-900 bg-gradient-to-br from-yellow-100 via-yellow-400 to-white text-center align-middle text-lg font-black text-slate-950"
                                                            >
                                                                <div className="mx-auto leading-8" style={{ writingMode: 'vertical-rl', textOrientation: 'upright' }}>
                                                                    {group.label}
                                                                </div>
                                                            </td>
                                                            <td className="border border-slate-900 py-2 pl-1 pr-1 font-black text-slate-950">
                                                                <span className="inline-flex min-w-0 items-center gap-1">
                                                                    <FontAwesomeIcon icon={faChevronRight} className={`text-[11px] text-emerald-700 transition-transform ${isDirectionExpanded ? 'rotate-90' : ''}`} />
                                                                    <span className="truncate">{EXTERNAL_SUPPORT_SITE_TOTAL_LABEL}</span>
                                                                </span>
                                                            </td>
                                                            <td className="border border-slate-900 px-2 py-2 text-center">
                                                                <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-black ${getPaymentMethodBadgeClassName(groupPaymentMethod)}`}>
                                                                    {groupPaymentMethod}
                                                                </span>
                                                            </td>
                                                            <td className="border border-slate-900 px-2 py-2 text-center font-mono text-[16px] font-black">{formatDayValue(groupManDay)}</td>
                                                            <td className="border border-slate-900 px-2 py-2 text-right font-mono">{groupAverageUnitPrice > 0 ? formatNumber(groupAverageUnitPrice) : '-'}</td>
                                                            <td className="border border-slate-900 px-2 py-2 text-right font-mono text-[16px] font-black text-slate-950">{formatNumber(groupAmount)}</td>
                                                            <td className="border border-slate-900 px-2 py-2 text-right font-mono text-slate-950">{groupAverageBillingUnitPrice > 0 ? formatNumber(groupAverageBillingUnitPrice) : '-'}</td>
                                                            <td className="border border-slate-900 px-2 py-2 text-right font-mono text-[16px] font-black text-slate-950">
                                                                {formatNumber(groupIssuedAmount)}
                                                            </td>
                                                            <td className="border border-slate-900 px-2 py-2 text-right font-mono text-blue-700">
                                                                <div>{formatOptionalMoney(groupAdditional)}</div>
                                                                {groupExpenseClaimAmount > 0 && (
                                                                    <div className="text-[10px] font-black leading-none text-emerald-700">경비 +{formatNumber(groupExpenseClaimAmount)}</div>
                                                                )}
                                                            </td>
                                                            <td className="border border-slate-900 px-2 py-2 text-right font-mono text-[16px] font-black text-slate-950">{formatNumber(groupTotal)}</td>
                                                            <td className="border border-slate-900 px-2 py-2 text-center text-[12px] font-black text-slate-500">-</td>
                                                            <td className="border border-slate-900 px-2 py-2 text-center text-[12px] font-bold text-slate-500">
                                                                2단 현장담당팀 · 3단 현장 · 4단 작업자
                                                            </td>
                                                            <td className="border border-slate-900 px-2 py-2 text-center text-[12px] font-bold text-slate-500">
                                                                {formatNumber(group.aggregates.length)}개 담당팀
                                                            </td>
                                                        </tr>
                                                    )}
                                                    {visibleAggregates.map((agg, index) => {
                                                        const aggKey = agg.aggregateId;
                                                        const isExpanded = expandedAggregates.has(aggKey);
                                                        const manualAdjustment = getAdjustment(manualAdjustments, aggKey);
                                                        const manualAdditionalAmount = manualAdjustment.additionalAmount;
                                                        const expenseClaimAmount = getAggregateExpenseClaimAmount(agg);
                                                        const expenseStatementAmount = getAggregateExpenseStatementAmount(agg, manualAdjustment);
                                                        const aggregateTotal = getAggregateTotalWithAdditional(agg, manualAdjustments);
                                                        const progressOption = getSupportProgressOption(manualAdjustment.progressStatus);
                                                        const remarkPlaceholder = getAggregateRemarkFallback(agg) || '비고 입력';
                                                        const etcPlaceholder = getAggregateEtcFallback(agg) || '기타 입력';
                                                        const aggregatePaymentMethod = summarizePaymentMethods(agg.sites.map(site => site.paymentMethod));
                                                        const isAggregateLaborPanelOpen = isLaborStatementPanelOpen(agg.aggregateId);

                                                        return (
                                                            <React.Fragment key={aggKey}>
                                                                <tr
                                                                    onClick={() => toggleAggregateExpand(aggKey)}
                                                                    className={`cursor-pointer transition-colors ${progressOption ? '' : isExternalSupportGroup ? 'bg-white hover:bg-slate-50' : `${isExpanded ? 'bg-slate-50' : 'bg-white'} hover:bg-slate-50`}`}
                                                                    style={progressOption ? { backgroundColor: progressOption.rowColor } : undefined}
                                                                >
                                                                    {!isExternalSupportGroup && index === 0 && (
                                                                        <td
                                                                            rowSpan={groupRowSpan}
                                                                            className={`border border-slate-900 text-center align-middle text-lg font-black ${getTeamCellClass(group.direction)}`}
                                                                        >
                                                                            <div className="mx-auto leading-8" style={{ writingMode: 'vertical-rl', textOrientation: 'upright' }}>
                                                                                {group.label}
                                                                            </div>
                                                                        </td>
                                                                    )}
                                                                    <td
                                                                        className={`border border-slate-900 py-1.5 font-black text-slate-950 ${isExternalSupportGroup ? 'bg-white px-1 text-left' : 'px-2 text-center'} ${progressOption ? '' : isExternalSupportGroup ? '' : getTeamCellClass(agg.direction)}`}
                                                                        style={progressOption ? { backgroundColor: progressOption.rowColor } : undefined}
                                                                    >
                                                                        <div className="min-w-0">
                                                                            <span className="inline-flex min-w-0 items-center gap-1">
                                                                                <FontAwesomeIcon icon={faChevronRight} className={`shrink-0 text-[10px] ${isExpanded ? 'rotate-90' : ''}`} />
                                                                                {isExternalSupportGroup && (
                                                                                    <span className="shrink-0 rounded bg-emerald-700 px-1.5 py-0.5 text-[10px] font-black text-white">2단</span>
                                                                                )}
                                                                                {agg.companyName}
                                                                            </span>
                                                                            <div className={`mt-1 truncate text-[10px] font-semibold ${agg.accountNumber ? 'text-slate-600' : 'text-rose-600'}`}>
                                                                                {getSettlementAccountLabel(agg) || '계좌 정보 없음'}
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                    <td className="border border-slate-900 px-2 py-1.5 text-center">
                                                                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-black ${getPaymentMethodBadgeClassName(aggregatePaymentMethod)}`}>
                                                                            {aggregatePaymentMethod}
                                                                        </span>
                                                                    </td>
                                                                    <td className="border border-slate-900 px-2 py-1.5 text-center font-mono text-[16px] font-black">{formatDayValue(agg.totalManDay)}</td>
                                                                    <td className="border border-slate-900 px-1 py-1 text-right font-mono" onClick={(event) => event.stopPropagation()}>
                                                                        <input
                                                                            type="text"
                                                                            inputMode="numeric"
                                                                            aria-label={`${agg.companyName} 지원단가`}
                                                                            value={formatOptionalMoney(getAggregateUnitPrice(agg))}
                                                                            onChange={(event) => handleApplyAggregateSupportRate(agg, event.target.value)}
                                                                            onFocus={(event) => event.currentTarget.select()}
                                                                            className="h-7 w-full bg-transparent px-1 text-right font-mono text-slate-950 outline-none transition focus:bg-slate-50 focus:ring-1 focus:ring-slate-300"
                                                                            placeholder="0"
                                                                        />
                                                                    </td>
                                                                    <td className="border border-slate-900 px-2 py-1.5 text-right font-mono text-[16px] font-black text-slate-950">{formatNumber(agg.totalAmount)}</td>
                                                                    <td className="border border-slate-900 px-1 py-1 text-right font-mono" onClick={(event) => event.stopPropagation()}>
                                                                        <input
                                                                            type="text"
                                                                            inputMode="numeric"
                                                                            aria-label={`${agg.companyName} 청구단가`}
                                                                            value={formatOptionalMoney(getAggregateBillingUnitPrice(agg))}
                                                                            onChange={(event) => handleApplyAggregateRate(agg, event.target.value)}
                                                                            onFocus={(event) => event.currentTarget.select()}
                                                                            className="h-7 w-full bg-transparent px-1 text-right font-mono text-slate-950 outline-none transition focus:bg-slate-50 focus:ring-1 focus:ring-slate-300"
                                                                            placeholder="0"
                                                                        />
                                                                    </td>
                                                                    <td className="border border-slate-900 px-2 py-1.5 text-right font-mono text-[16px] font-black text-slate-950">
                                                                        {formatNumber(agg.issuedAmount)}
                                                                    </td>
                                                                    <td className="border border-slate-900 px-1 py-1 text-right font-mono" onClick={(event) => event.stopPropagation()}>
                                                                        <div className="space-y-0.5">
                                                                            <input
                                                                                type="text"
                                                                                inputMode="numeric"
                                                                                aria-label={`${agg.companyName} 추가 금액`}
                                                                                value={formatOptionalMoney(manualAdditionalAmount)}
                                                                                onChange={(event) => updateManualAdjustment(aggKey, { additionalAmount: parseMoneyInput(event.target.value) })}
                                                                                onFocus={(event) => event.currentTarget.select()}
                                                                                className="h-7 w-full bg-transparent px-1 text-right font-mono text-blue-700 outline-none transition focus:bg-amber-50 focus:ring-1 focus:ring-amber-400"
                                                                                placeholder="0"
                                                                            />
                                                                            {expenseClaimAmount > 0 && (
                                                                                <div className="text-right text-[10px] font-black leading-none text-emerald-700">
                                                                                    경비 +{formatNumber(expenseClaimAmount)}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                    <td className="border border-slate-900 px-2 py-1.5 text-right font-mono text-[16px] font-black text-slate-950">{formatNumber(aggregateTotal)}</td>
                                                                    <td className="border border-slate-900 px-1 py-1 text-center font-medium text-slate-900" onClick={(event) => event.stopPropagation()}>
                                                                        <select
                                                                            aria-label={`${agg.companyName} 진행구분`}
                                                                            value={manualAdjustment.progressStatus}
                                                                            onChange={(event) => updateManualAdjustment(aggKey, { progressStatus: event.target.value as SupportProgressStatus })}
                                                                            className="h-7 w-full border border-slate-900/20 px-1 text-center text-[12px] font-black text-slate-950 outline-none transition focus:bg-white focus:ring-1 focus:ring-amber-400"
                                                                            style={{ backgroundColor: progressOption?.color ?? '#ffffff' }}
                                                                        >
                                                                            <option value="">선택</option>
                                                                            {SUPPORT_PROGRESS_OPTIONS.map(option => (
                                                                                <option
                                                                                    key={option.value}
                                                                                    value={option.value}
                                                                                    style={{ backgroundColor: option.color, color: '#111827' }}
                                                                                >
                                                                                    {option.label}
                                                                                </option>
                                                                            ))}
                                                                        </select>
                                                                    </td>
                                                                    <td className="border border-slate-900 px-1 py-1 text-center font-medium text-slate-900" onClick={(event) => event.stopPropagation()}>
                                                                        <input
                                                                            type="text"
                                                                            aria-label={`${agg.companyName} 비고`}
                                                                            value={manualAdjustment.remark || remarkPlaceholder}
                                                                            onChange={(event) => updateManualAdjustment(aggKey, { remark: event.target.value })}
                                                                            onFocus={(event) => event.currentTarget.select()}
                                                                            className="h-7 w-full bg-transparent px-1 text-center text-[12px] font-bold text-slate-900 outline-none transition placeholder:text-slate-400 focus:bg-amber-50 focus:ring-1 focus:ring-amber-400"
                                                                            placeholder={remarkPlaceholder}
                                                                        />
                                                                        <div className={`mt-1 truncate px-1 text-[10px] font-semibold ${agg.accountNumber ? 'text-slate-600' : 'text-rose-600'}`}>
                                                                            {getSettlementAccountLabel(agg) || '계좌 정보 없음'}
                                                                        </div>
                                                                    </td>
                                                                    <td className="border border-slate-900 px-1 py-1 text-center font-medium text-slate-900" onClick={(event) => event.stopPropagation()}>
                                                                        <div className="flex flex-col gap-1">
                                                                            <input
                                                                                type="text"
                                                                                aria-label={`${agg.companyName} 기타`}
                                                                                value={manualAdjustment.etc}
                                                                                onChange={(event) => updateManualAdjustment(aggKey, { etc: event.target.value })}
                                                                                className="h-7 w-full bg-transparent px-1 text-center text-[12px] font-bold text-slate-900 outline-none transition placeholder:text-slate-400 focus:bg-amber-50 focus:ring-1 focus:ring-amber-400"
                                                                                placeholder={etcPlaceholder}
                                                                            />
                                                                            <div className={`grid gap-1 ${expenseStatementAmount > 0 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                                                                <button
                                                                                    type="button"
                                                                                    aria-label={`${agg.companyName} 노임명세서`}
                                                                                    title="노임명세서"
                                                                                    aria-expanded={isAggregateLaborPanelOpen}
                                                                                    onClick={(event) => {
                                                                                        event.stopPropagation();
                                                                                        toggleLaborStatementPanel({ aggregateId: agg.aggregateId });
                                                                                    }}
                                                                                    className={`inline-flex h-7 items-center justify-center gap-1 rounded px-2 text-[10px] font-black text-white shadow-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
                                                                                        isAggregateLaborPanelOpen ? 'bg-emerald-800 ring-2 ring-emerald-300' : 'bg-emerald-600 hover:bg-emerald-700'
                                                                                    }`}
                                                                                >
                                                                                    <FontAwesomeIcon icon={faFileInvoiceDollar} />
                                                                                    <span>노임명세</span>
                                                                                </button>
                                                                                {expenseStatementAmount > 0 && (
                                                                                    <button
                                                                                        type="button"
                                                                                        aria-label={`${agg.companyName} 경비내역서`}
                                                                                        title="경비내역서"
                                                                                        onClick={() => setExpenseStatementSelection({ aggregateId: agg.aggregateId })}
                                                                                        className="inline-flex h-7 items-center justify-center gap-1 rounded bg-teal-600 px-2 text-[10px] font-black text-white shadow-sm transition hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-400"
                                                                                    >
                                                                                        <FontAwesomeIcon icon={faReceipt} />
                                                                                        <span>경비내역</span>
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                                {renderLaborStatementPanelRow(agg.aggregateId)}
                                                                {isExpanded && agg.sites.map(site => {
                                                                    const siteExpenseClaimAmount = getSiteExpenseClaimAmount(site);
                                                                    const siteKey = getAggregateSiteRowKey(agg, site);
                                                                    const isSiteExpanded = expandedSiteRows.has(siteKey);
                                                                    const isSiteLaborPanelOpen = isLaborStatementPanelOpen(agg.aggregateId, siteKey);
                                                                    const siteManualAdjustment = getAdjustment(manualAdjustments, siteKey);
                                                                    const siteExpenseStatementAmount = getSiteExpenseStatementAmount(site, siteManualAdjustment);
                                                                    const siteTotalAmount = site.issuedAmount + siteExpenseStatementAmount;
                                                                    const siteProgressOption = getSupportProgressOption(siteManualAdjustment.progressStatus);
                                                                    const siteRemarkFallback = getSupportRemarkCompanyName(agg, site) || '비고 입력';
                                                                    return (
                                                                        <React.Fragment key={siteKey}>
                                                                            <tr
                                                                                onClick={() => toggleSiteRowExpand(siteKey)}
                                                                                className={`cursor-pointer transition-colors ${siteProgressOption ? '' : 'bg-slate-50 hover:bg-slate-100'}`}
                                                                                style={siteProgressOption ? { backgroundColor: siteProgressOption.rowColor } : undefined}
                                                                            >
                                                                                <td className="border border-slate-900 py-1 pl-1 pr-1 text-left text-[12px] font-bold text-slate-600">
                                                                                    <span className="inline-flex min-w-0 items-center gap-1">
                                                                                        <FontAwesomeIcon icon={faChevronRight} className={`shrink-0 text-[10px] text-slate-500 ${isSiteExpanded ? 'rotate-90' : ''}`} />
                                                                                        {isExternalSupportGroup && (
                                                                                            <span className="shrink-0 rounded bg-slate-700 px-1.5 py-0.5 text-[10px] font-black text-white">3단</span>
                                                                                        )}
                                                                                        <span className="truncate">{site.siteName}</span>
                                                                                    </span>
                                                                                </td>
                                                                                <td className="border border-slate-900 px-2 py-1 text-center">
                                                                                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-black ${getPaymentMethodBadgeClassName(site.paymentMethod)}`}>
                                                                                        {normalizePaymentMethod(site.paymentMethod)}
                                                                                    </span>
                                                                                </td>
                                                                                <td className="border border-slate-900 px-2 py-1 text-center font-mono text-[16px] font-black text-slate-900">{formatDayValue(site.totalManDay)}</td>
                                                                                <td className="border border-slate-900 px-1 py-1 text-right font-mono text-slate-600" onClick={(event) => event.stopPropagation()}>
                                                                                    <input
                                                                                        type="text"
                                                                                        inputMode="numeric"
                                                                                        aria-label={`${site.siteName} 지원단가`}
                                                                                        value={formatOptionalMoney(getSiteUnitPrice(site))}
                                                                                        onChange={(event) => handleApplySiteSupportRate(agg, site.siteId, event.target.value)}
                                                                                        onFocus={(event) => event.currentTarget.select()}
                                                                                        className="h-7 w-full bg-transparent px-1 text-right font-mono text-slate-950 outline-none transition focus:bg-slate-50 focus:ring-1 focus:ring-slate-300"
                                                                                        placeholder="0"
                                                                                    />
                                                                                </td>
                                                                                <td className="border border-slate-900 px-2 py-1 text-right font-mono text-[16px] font-black text-slate-950">{formatNumber(site.totalAmount)}</td>
                                                                                <td className="border border-slate-900 px-1 py-1 text-right font-mono text-slate-500" onClick={(event) => event.stopPropagation()}>
                                                                                    <input
                                                                                        type="text"
                                                                                        inputMode="numeric"
                                                                                        aria-label={`${site.siteName} 청구단가`}
                                                                                        value={formatOptionalMoney(getSiteBillingUnitPrice(site))}
                                                                                        onChange={(event) => handleApplySiteRate(agg, site.siteId, event.target.value)}
                                                                                        onFocus={(event) => event.currentTarget.select()}
                                                                                        className="h-7 w-full bg-transparent px-1 text-right font-mono text-slate-950 outline-none transition focus:bg-slate-50 focus:ring-1 focus:ring-slate-300"
                                                                                        placeholder="0"
                                                                                    />
                                                                                </td>
                                                                                <td className="border border-slate-900 px-2 py-1 text-right font-mono text-[16px] font-black text-slate-950">
                                                                                    {formatNumber(site.issuedAmount)}
                                                                                </td>
                                                                                <td className="border border-slate-900 px-2 py-1 text-right font-mono font-black text-emerald-700">
                                                                                    {siteExpenseClaimAmount > 0 && (
                                                                                        <div className="text-[10px] leading-none">경비 +{formatNumber(siteExpenseClaimAmount)}</div>
                                                                                    )}
                                                                                </td>
                                                                                <td className="border border-slate-900 px-2 py-1 text-right font-mono text-[16px] font-black text-slate-950">{formatNumber(siteTotalAmount)}</td>
                                                                                <td className="border border-slate-900 px-1 py-1 text-center font-medium text-slate-900" onClick={(event) => event.stopPropagation()}>
                                                                                    <select
                                                                                        aria-label={`${site.siteName} 진행구분`}
                                                                                        value={siteManualAdjustment.progressStatus}
                                                                                        onChange={(event) => updateManualAdjustment(siteKey, { progressStatus: event.target.value as SupportProgressStatus })}
                                                                                        className="h-7 w-full border border-slate-900/20 px-1 text-center text-[12px] font-black text-slate-950 outline-none transition focus:bg-white focus:ring-1 focus:ring-amber-400"
                                                                                        style={{ backgroundColor: siteProgressOption?.color ?? '#ffffff' }}
                                                                                    >
                                                                                        <option value="">선택</option>
                                                                                        {SUPPORT_PROGRESS_OPTIONS.map(option => (
                                                                                            <option
                                                                                                key={option.value}
                                                                                                value={option.value}
                                                                                                style={{ backgroundColor: option.color, color: '#111827' }}
                                                                                            >
                                                                                                {option.label}
                                                                                            </option>
                                                                                        ))}
                                                                                    </select>
                                                                                </td>
                                                                                <td className="border border-slate-900 px-1 py-1 text-center font-medium text-slate-900" onClick={(event) => event.stopPropagation()}>
                                                                                    <input
                                                                                        type="text"
                                                                                        aria-label={`${site.siteName} 비고`}
                                                                                        value={siteManualAdjustment.remark || siteRemarkFallback}
                                                                                        onChange={(event) => updateManualAdjustment(siteKey, { remark: event.target.value })}
                                                                                        onFocus={(event) => event.currentTarget.select()}
                                                                                        className="h-7 w-full bg-transparent px-1 text-center text-[12px] font-bold text-slate-900 outline-none transition placeholder:text-slate-400 focus:bg-amber-50 focus:ring-1 focus:ring-amber-400"
                                                                                        placeholder={siteRemarkFallback}
                                                                                    />
                                                                                </td>
                                                                                <td className="border border-slate-900 px-1 py-1 text-center" onClick={(event) => event.stopPropagation()}>
                                                                                    <div className="grid grid-cols-2 gap-1">
                                                                                        <button
                                                                                            type="button"
                                                                                            aria-label={`${site.siteName} 노임명세서`}
                                                                                            title="노임명세서"
                                                                                            aria-expanded={isSiteLaborPanelOpen}
                                                                                            onClick={(event) => {
                                                                                                event.stopPropagation();
                                                                                                toggleLaborStatementPanel({ aggregateId: agg.aggregateId, siteKey });
                                                                                            }}
                                                                                            className={`inline-flex h-7 items-center justify-center gap-1 rounded px-2 text-[10px] font-black text-white shadow-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
                                                                                                isSiteLaborPanelOpen ? 'bg-emerald-800 ring-2 ring-emerald-300' : 'bg-emerald-600 hover:bg-emerald-700'
                                                                                            }`}
                                                                                        >
                                                                                            <FontAwesomeIcon icon={faFileInvoiceDollar} />
                                                                                            <span>노임명세</span>
                                                                                        </button>
                                                                                        <button
                                                                                            type="button"
                                                                                            aria-label={`${site.siteName} 경비내역서`}
                                                                                            title="경비내역서"
                                                                                            onClick={() => setExpenseStatementSelection({ aggregateId: agg.aggregateId, siteKey })}
                                                                                            className="inline-flex h-7 items-center justify-center gap-1 rounded bg-teal-600 px-2 text-[10px] font-black text-white shadow-sm transition hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-400"
                                                                                        >
                                                                                            <FontAwesomeIcon icon={faReceipt} />
                                                                                            <span>경비내역</span>
                                                                                        </button>
                                                                                    </div>
                                                                                </td>
                                                                            </tr>
                                                                            {renderLaborStatementPanelRow(agg.aggregateId, siteKey)}
                                                                            {isSiteExpanded && (
                                                                                <tr>
                                                                                    <td colSpan={12} className="border border-slate-900 bg-slate-50 p-4">
                                                                                        <div className="mb-3">
                                                                                            <h3 className="flex flex-wrap items-center gap-2 text-sm font-black text-slate-800">
                                                                                                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-black text-white">4단</span>
                                                                                                <span>{site.siteName} 작업자 상세</span>
                                                                                            </h3>
                                                                                            <p className="mt-1 text-[11px] font-semibold text-slate-500">
                                                                                                {formatNumber(site.workers.length)}개 투입 행 · {formatDayValue(site.totalManDay)}공수 · 노임 {formatNumber(site.totalAmount)}원 · 발행 {formatNumber(site.issuedAmount)}원
                                                                                            </p>
                                                                                        </div>
                                                                                        <div className="overflow-x-auto border border-slate-900 bg-white">
                                                                                            <table className="w-full min-w-[1180px] border-collapse text-xs">
                                                                                                <thead className="bg-slate-100 text-slate-700">
                                                                                                    <tr>
                                                                                                        <th className="border border-slate-900 px-4 py-2.5 text-left">일자</th>
                                                                                                        <th className="border border-slate-900 px-4 py-2.5 text-left">구분</th>
                                                                                                        <th className="border border-slate-900 px-4 py-2.5 text-left">작업자</th>
                                                                                                        <th className="border border-slate-900 px-4 py-2.5 text-left">작업팀</th>
                                                                                                        <th className="border border-slate-900 px-4 py-2.5 text-left">현장담당팀</th>
                                                                                                        <th className="border border-slate-900 px-4 py-2.5 text-left">정산주체</th>
                                                                                                        <th className="border border-slate-900 px-4 py-2.5 text-right">공수</th>
                                                                                                        <th className="border border-slate-900 px-4 py-2.5 text-right">지원단가</th>
                                                                                                        <th className="border border-slate-900 px-4 py-2.5 text-right">노임총액</th>
                                                                                                        <th className="border border-slate-900 px-4 py-2.5 text-right">청구단가</th>
                                                                                                        <th className="border border-slate-900 px-4 py-2.5 text-right">발행금액</th>
                                                                                                        <th className="border border-slate-900 px-4 py-2.5 text-left">근거</th>
                                                                                                    </tr>
                                                                                                </thead>
                                                                                                <tbody>
                                                                                                    {site.workers.map((worker, workerIndex) => (
                                                                                                        <tr key={`${siteKey}-${worker.reportId ?? 'report'}-${worker.workerId || worker.workerName}-${worker.date}-${workerIndex}`}>
                                                                                                            <td className="border border-slate-900 px-4 py-2.5 font-mono text-slate-500">{worker.date}</td>
                                                                                                            <td className="border border-slate-900 px-4 py-2.5">
                                                                                                                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-black ${SUPPORT_DIRECTION_META[worker.direction]?.badgeClass ?? 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                                                                                                                    {SUPPORT_DIRECTION_META[worker.direction]?.label ?? worker.direction}
                                                                                                                </span>
                                                                                                            </td>
                                                                                                            <td className="border border-slate-900 px-4 py-2.5 font-black text-slate-800">{worker.workerName}</td>
                                                                                                            <td className="border border-slate-900 px-4 py-2.5 font-bold text-slate-600">{worker.workerTeamName || worker.teamName || '-'}</td>
                                                                                                            <td className="border border-slate-900 px-4 py-2.5 font-bold text-slate-600">{worker.siteResponsibleTeamName || worker.targetTeamName || '-'}</td>
                                                                                                            <td className="border border-slate-900 px-4 py-2.5 font-bold text-slate-600">{worker.settlementTeamName || agg.companyName || '-'}</td>
                                                                                                            <td className="border border-slate-900 px-4 py-2.5 text-right font-mono text-[15px] font-black">{formatDayValue(worker.manDay)}</td>
                                                                                                            <td className="border border-slate-900 px-4 py-2.5 text-right font-mono text-slate-950">{formatNumber(worker.unitPrice)}</td>
                                                                                                            <td className="border border-slate-900 px-4 py-2.5 text-right font-mono text-[15px] font-black text-slate-800">{formatNumber(worker.amount)}</td>
                                                                                                            <td className="border border-slate-900 px-4 py-2.5 text-right font-mono text-slate-950">{formatNumber(worker.billingUnitPrice)}</td>
                                                                                                            <td className="border border-slate-900 px-4 py-2.5 text-right font-mono text-[15px] font-black text-slate-950">{formatNumber(worker.issuedAmount)}</td>
                                                                                                            <td className="border border-slate-900 px-4 py-2.5 text-slate-500">{worker.evidenceNote || site.evidenceNote || agg.evidenceNote || '-'}</td>
                                                                                                        </tr>
                                                                                                    ))}
                                                                                                </tbody>
                                                                                            </table>
                                                                                        </div>
                                                                                    </td>
                                                                                </tr>
                                                                            )}
                                                                        </React.Fragment>
                                                                    );
                                                                })}
                                                            </React.Fragment>
                                                        );
                                                    })}
                                                    {!isExternalSupportGroup && (
                                                        <tr className="bg-white font-black">
                                                            <td className="border border-slate-900 px-2 py-1.5 text-center tracking-[0.35em]">합 계</td>
                                                            <td className="border border-slate-900 px-2 py-1.5 text-center font-mono text-[16px]">{formatDayValue(groupManDay)}</td>
                                                            <td className="border border-slate-900 px-2 py-1.5"></td>
                                                            <td className="border border-slate-900 px-2 py-1.5 text-right font-mono text-[16px]">{formatNumber(groupAmount)}</td>
                                                            <td className="border border-slate-900 px-2 py-1.5"></td>
                                                            <td className="border border-slate-900 px-2 py-1.5 text-right font-mono text-[16px] text-slate-950">{formatNumber(groupIssuedAmount)}</td>
                                                            <td className="border border-slate-900 px-2 py-1.5 text-right font-mono">{formatOptionalMoney(groupAdditional)}</td>
                                                            <td className="border border-slate-900 px-2 py-1.5 text-right font-mono text-[16px]">{formatNumber(groupTotal)}</td>
                                                            <td className="border border-slate-900 px-2 py-1.5"></td>
                                                            <td className="border border-slate-900 px-2 py-1.5"></td>
                                                            <td className="border border-slate-900 px-2 py-1.5"></td>
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

                    {errors.length > 0 && (
                        <div className="bg-rose-50 border border-rose-100 p-6 rounded-3xl flex items-start gap-4 shadow-sm">
                            <div className="bg-rose-100 text-rose-600 p-3 rounded-2xl shadow-inner">
                                <FontAwesomeIcon icon={faExclamationTriangle} />
                            </div>
                            <div className="flex-1">
                                <h4 className="text-base font-black text-rose-800">정산 계좌 정보 누락 확인 필요</h4>
                                <p className="text-sm text-rose-600 font-bold opacity-70 mt-0.5">아래 팀들의 계좌 정보가 마스터 데이터에 등록되어 있지 않습니다.</p>
                                <ul className="mt-3 grid grid-cols-2 gap-x-8 gap-y-1">
                                    {errors.slice(0, 10).map((e, i) => (
                                        <li key={i} className="text-[12px] text-rose-600 font-bold flex items-center gap-2">
                                            <div className="w-1 h-1 bg-rose-300 rounded-full"></div>
                                            {e}
                                        </li>
                                    ))}
                                    {errors.length > 10 && <li className="text-[11px] text-rose-400 mt-2 font-black italic">외 {errors.length - 10}개 팀 추가 누락...</li>}
                                </ul>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {expenseStatementTarget && (
                <ExpenseClaimShareModal
                    aggregate={expenseStatementTarget}
                    claims={expenseStatementClaims}
                    yearMonth={selectedMonth}
                    logoUrl={statementLogoUrl}
                    onClose={() => setExpenseStatementSelection(null)}
                />
            )}

            {showLaborPreview && (
                <Modal title="노무내역서 미리보기" onClose={() => setShowLaborPreview(false)} widthClass="max-w-7xl">
                    <div className="sticky top-0 bg-white z-10 px-6 py-4 border-b flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                            <p className="text-sm text-slate-700 font-black">총 {sitePreviews.length}건의 내역서가 집계되었습니다.</p>
                            <p className="mt-0.5 text-xs font-semibold text-slate-500">엑셀 저장은 아래 미리보기와 같은 표 구조로 생성됩니다.</p>
                        </div>
                        <ActionButton variant="solid-green" onClick={handleDownloadLabor}>
                            <FontAwesomeIcon icon={faFileExcel} /> 전체 엑셀 저장
                        </ActionButton>
                    </div>
                    <div className="p-6 space-y-16">
                        {sitePreviews.map(p => {
                            const key = `${p.aggregate.aggregateId}-${p.site.siteId}`;
                            return (
                                <div key={key} className="space-y-3">
                                    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm md:flex-row md:items-center md:justify-between">
                                        <div>
                                            <div className="text-sm font-black text-slate-800">{p.site.siteName}</div>
                                            <div className="mt-0.5 text-xs font-bold text-slate-500">{p.aggregate.direction} · {p.aggregate.companyName}</div>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                type="button"
                                                disabled={capturingKey === key}
                                                onClick={() => capturePreview(key, getLaborStatementImageFileName(p, selectedMonth))}
                                                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-black text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                                <FontAwesomeIcon icon={capturingKey === key ? faSpinner : faCamera} spin={capturingKey === key} />
                                                {capturingKey === key ? '저장 중' : '이미지 저장'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDownloadSingleLabor(p)}
                                                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-black text-white shadow-sm hover:bg-emerald-700"
                                            >
                                                <FontAwesomeIcon icon={faFileExcel} /> 엑셀 저장
                                            </button>
                                        </div>
                                    </div>
                                    <div ref={el => { if (el) previewRefs.current[key] = el; else delete previewRefs.current[key]; }}>
                                        <LaborStatementPreview aggregate={p.aggregate} site={p.site} rows={p.rows} yearMonth={selectedMonth} logoUrl={statementLogoUrl} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Modal>
            )}

            {showKBPreview && (
                <Modal title="국민은행 이체 정보 미리보기" onClose={() => setShowKBPreview(false)} widthClass="max-w-4xl">
                    <div className="p-6">
                        <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl mb-6 flex items-center gap-3">
                            <FontAwesomeIcon icon={faCircleExclamation} className="text-amber-500" />
                            <span className="text-sm font-bold text-amber-800">이 내역은 국민은행 기업뱅킹의 '대량이체' 양식에 최적화되어 있습니다.</span>
                        </div>
                        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                                    <tr>
                                        <th className="px-4 py-2.5 text-left">A. 은행</th>
                                        <th className="px-4 py-2.5 text-left">B. 계좌번호</th>
                                        <th className="px-4 py-2.5 text-right">C. 이체금액</th>
                                        <th className="px-4 py-2.5 text-left">D. 받는분</th>
                                        <th className="px-4 py-2.5 text-left">E. 메모</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {kbRows.map((r, i) => (
                                        <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                                            <td className="px-4 py-3 font-mono text-slate-500">{r.bankCode}</td>
                                            <td className="px-4 py-3 font-black text-slate-700 font-mono">{r.accountNumber}</td>
                                            <td className="px-4 py-3 text-right font-black text-amber-600 font-mono">{formatNumber(r.amount)}</td>
                                            <td className="px-4 py-3 font-bold text-slate-800">{r.accountHolder}</td>
                                            <td className="px-4 py-3 text-slate-400 text-[11px] truncate max-w-[150px]">{r.description}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="mt-6 flex justify-end">
                            <ActionButton variant="solid-amber" onClick={handleDownloadKB}>
                                <FontAwesomeIcon icon={faFileExcel} /> 엑셀 파일 다운로드
                            </ActionButton>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

// --- Sub Components ---

const SupportLaborStatementPanel: React.FC<{
    aggregate: SupportCompanyAggregate;
    previews: SitePreviewBlock[];
    yearMonth: string;
    adjustment: SupportManualAdjustment;
    logoUrl?: string | null;
    onClose: () => void;
}> = ({ aggregate, previews, yearMonth, adjustment, onClose }) => {
    const [statementOptionPreset, setStatementOptionPreset] = useState<StatementIssueOptionPreset>(() => loadStatementIssueOptionPreset());
    const [showBankColumn, setShowBankColumn] = useState(() => loadSupportLaborStatementDefaults(statementOptionPreset).showBankColumn);
    const [showBillingColumns, setShowBillingColumns] = useState(() => loadSupportLaborStatementDefaults(statementOptionPreset).showBillingColumns);
    const [isSplitView, setIsSplitView] = useState(() => loadSupportLaborStatementDefaults(statementOptionPreset).isSplitView);
    const [showBankUnderAddress, setShowBankUnderAddress] = useState(() => loadSupportLaborStatementDefaults(statementOptionPreset).showBankUnderAddress);
    const [showTeamUnderName, setShowTeamUnderName] = useState(() => loadSupportLaborStatementDefaults(statementOptionPreset).showTeamUnderName);
    const flatPreviewRows = useMemo(() => previews.flatMap((preview) => preview.rows), [previews]);
    const [bulkUnitPriceInput, setBulkUnitPriceInput] = useState(() => {
        const unitPrice = loadSupportLaborStatementDefaults(statementOptionPreset).unitPriceOverride;
        return unitPrice > 0 ? String(unitPrice) : '';
    });
    const [appliedBulkUnitPrice, setAppliedBulkUnitPrice] = useState(() => loadSupportLaborStatementDefaults(statementOptionPreset).unitPriceOverride);
    const [useWorkerMasterPayType, setUseWorkerMasterPayType] = useState(() => loadSupportLaborStatementDefaults(statementOptionPreset).useWorkerMasterPayType);
    const [workerPayTypes, setWorkerPayTypes] = useState<Record<string, SupportStatementPayType>>(() =>
        buildSupportLaborWorkerPayTypesFromDefaults(
            flatPreviewRows,
            loadSupportLaborStatementDefaults(statementOptionPreset).useWorkerMasterPayType,
            loadSupportLaborStatementDefaults(statementOptionPreset)
        )
    );
    const [delegateBankName, setDelegateBankName] = useState(() => loadSupportLaborStatementDefaults(statementOptionPreset).delegateBankName);
    const [delegateAccountHolder, setDelegateAccountHolder] = useState(() => loadSupportLaborStatementDefaults(statementOptionPreset).delegateAccountHolder);
    const [delegateAccountNumber, setDelegateAccountNumber] = useState(() => loadSupportLaborStatementDefaults(statementOptionPreset).delegateAccountNumber);
    const statementOptions = useMemo<SupportLaborStatementOptions>(() => ({
        unitPriceOverride: appliedBulkUnitPrice,
        defaultPayType: 'direct',
        workerPayTypes,
        delegateBankName,
        delegateAccountHolder,
        delegateAccountNumber
    }), [appliedBulkUnitPrice, workerPayTypes, delegateBankName, delegateAccountHolder, delegateAccountNumber]);
    const statementViewOptions = useMemo<SupportLaborStatementViewOptions>(() => ({
        showBankColumn,
        showBillingColumns,
        isSplitView,
        showBankUnderAddress,
        showTeamUnderName
    }), [showBankColumn, showBillingColumns, isSplitView, showBankUnderAddress, showTeamUnderName]);
    const statementPreviews = useMemo(
        () => applySupportLaborStatementOptions(previews, statementOptions),
        [previews, statementOptions]
    );
    const statementTotalManDay = statementPreviews.reduce((sum, preview) => sum + preview.rows.reduce((rowSum, row) => rowSum + row.totalManDay, 0), 0);
    const statementTotalAmount = statementPreviews.reduce((sum, preview) => sum + preview.rows.reduce((rowSum, row) => rowSum + row.billingAmount, 0), 0);
    const displayAggregate = useMemo<SupportCompanyAggregate>(() => ({
        ...aggregate,
        totalManDay: statementTotalManDay,
        billingAmount: statementTotalAmount,
        issuedAmount: statementTotalAmount,
        sites: statementPreviews.map((preview) => ({
            ...preview.site,
            totalManDay: preview.rows.reduce((sum, row) => sum + row.totalManDay, 0),
            billingAmount: preview.rows.reduce((sum, row) => sum + row.billingAmount, 0),
            issuedAmount: preview.rows.reduce((sum, row) => sum + row.billingAmount, 0)
        }))
    }), [aggregate, statementPreviews, statementTotalAmount, statementTotalManDay]);
    const [statusMessage, setStatusMessage] = useState('');
    const [busyAction, setBusyAction] = useState<'copy' | 'send' | null>(null);
    const [activePreviewIndex, setActivePreviewIndex] = useState(0);
    const statementSheetRef = useRef<HTMLDivElement | null>(null);
    const statementText = useMemo(
        () => buildSupportLaborStatementText(displayAggregate, statementPreviews, yearMonth, adjustment),
        [displayAggregate, statementPreviews, yearMonth, adjustment]
    );
    const shareTitle = `노무비 지급 명세서_${yearMonth}_${aggregate.companyName}`;
    const imageFileName = `${sanitizeFileNamePart(shareTitle)}.png`;
    const activePreview = statementPreviews[activePreviewIndex] ?? statementPreviews[0] ?? null;
    const outputStatementKey = `support-team-payment::${yearMonth}::${aggregate.aggregateId}`;
    const buildLaborStatementOutput = useCallback((): StatementOutputRecord => {
        const previewSites = statementPreviews.map((preview) => preview.site);
        const firstSite = previewSites[0];
        const siteNames = summarizeNames(previewSites.map((site) => site.siteName));

        return {
            source: 'support-team-payment',
            statementKey: outputStatementKey,
            kind: 'labor',
            status: statementOptionPreset,
            yearMonth,
            targetTitle: aggregate.companyName,
            targetSubtitle: `${aggregate.direction} · ${siteNames || aggregate.viewTeamName || ''}`,
            siteId: previewSites.length === 1 ? firstSite?.siteId : undefined,
            siteName: siteNames,
            clientCompanyName: aggregate.counterpartyName,
            teamName: aggregate.viewTeamName || aggregate.sourceTeamName || aggregate.settlementTeamName,
            documentTitle: shareTitle,
            amountSummary: {
                manDay: statementTotalManDay,
                supplyAmount: statementTotalAmount,
                totalAmount: statementTotalAmount,
            },
            optionPreset: statementOptionPreset,
            optionSnapshot: {
                ...statementViewOptions,
                unitPriceOverride: statementOptions.unitPriceOverride,
                useWorkerMasterPayType,
                delegateBankName,
                delegateAccountHolder,
                delegateAccountNumber,
                workerPayTypes,
            },
            snapshot: {
                previewCount: statementPreviews.length,
                workerCount: statementPreviews.reduce((sum, preview) => sum + preview.rows.length, 0),
                previews: statementPreviews.map((preview) => ({
                    aggregateId: preview.aggregate.aggregateId,
                    siteId: preview.site.siteId,
                    siteName: preview.site.siteName,
                    totalManDay: preview.rows.reduce((sum, row) => sum + row.totalManDay, 0),
                    totalAmount: preview.rows.reduce((sum, row) => sum + row.billingAmount, 0),
                    workerCount: preview.rows.length,
                })),
            },
        };
    }, [
        aggregate.aggregateId,
        aggregate.companyName,
        aggregate.counterpartyName,
        aggregate.direction,
        aggregate.settlementTeamName,
        aggregate.sourceTeamName,
        aggregate.viewTeamName,
        delegateAccountHolder,
        delegateAccountNumber,
        delegateBankName,
        outputStatementKey,
        shareTitle,
        statementOptionPreset,
        statementOptions.unitPriceOverride,
        statementPreviews,
        statementTotalAmount,
        statementTotalManDay,
        statementViewOptions,
        useWorkerMasterPayType,
        workerPayTypes,
        yearMonth,
    ]);
    const payTypeAutoWarningNames = useMemo(() => {
        if (!useWorkerMasterPayType) return [];
        const missingByKey = new Map<string, string>();
        flatPreviewRows.forEach((row) => {
            if (row.workerLaborStatementPayType) return;
            const key = getSupportLaborStatementWorkerKey(row);
            if (!key || missingByKey.has(key)) return;
            missingByKey.set(key, row.workerName || row.workerId || '이름 없음');
        });
        return Array.from(missingByKey.values());
    }, [flatPreviewRows, useWorkerMasterPayType]);

    useEffect(() => {
        setActivePreviewIndex(0);
    }, [aggregate.aggregateId, statementPreviews.length]);

    const applyLaborStatementDefaults = useCallback((preset: StatementIssueOptionPreset) => {
        const defaults = loadSupportLaborStatementDefaults(preset);
        setShowBankColumn(defaults.showBankColumn);
        setShowBillingColumns(defaults.showBillingColumns);
        setIsSplitView(defaults.isSplitView);
        setShowBankUnderAddress(defaults.showBankUnderAddress);
        setShowTeamUnderName(defaults.showTeamUnderName);
        setUseWorkerMasterPayType(defaults.useWorkerMasterPayType);
        setWorkerPayTypes(buildSupportLaborWorkerPayTypesFromDefaults(flatPreviewRows, defaults.useWorkerMasterPayType, defaults));
        setBulkUnitPriceInput(defaults.unitPriceOverride > 0 ? String(defaults.unitPriceOverride) : '');
        setAppliedBulkUnitPrice(defaults.unitPriceOverride);
        setDelegateBankName(defaults.delegateBankName);
        setDelegateAccountHolder(defaults.delegateAccountHolder);
        setDelegateAccountNumber(defaults.delegateAccountNumber);
    }, [flatPreviewRows]);

    useEffect(() => {
        applyLaborStatementDefaults(statementOptionPreset);
    }, [applyLaborStatementDefaults, statementOptionPreset]);

    useEffect(() => {
        let mounted = true;
        const companyName = String(aggregate.companyName || '').trim();

        const loadDelegateAccount = async () => {
            if (!companyName) return;
            const defaults = loadSupportLaborStatementDefaults(statementOptionPreset);
            const hasStoredDelegateAccount = Boolean(
                defaults.delegateBankName ||
                defaults.delegateAccountHolder ||
                defaults.delegateAccountNumber
            );
            if (hasStoredDelegateAccount) return;

            try {
                const company = await companyService.getCompanyByName(companyName);
                if (!mounted || !company) return;
                setDelegateBankName(company.bankName || '');
                setDelegateAccountHolder(company.accountHolder || '');
                setDelegateAccountNumber(company.accountNumber || '');
            } catch (delegateAccountError) {
                console.warn('[SupportTeamPaymentPage] delegate account load failed:', delegateAccountError);
            }
        };

        void loadDelegateAccount();

        return () => {
            mounted = false;
        };
    }, [aggregate.companyName, statementOptionPreset]);

    const handleApplyBulkUnitPrice = useCallback(() => {
        const nextUnitPrice = parseCurrencyAmount(bulkUnitPriceInput);
        if (!nextUnitPrice) {
            window.alert('적용할 단가를 입력하세요.');
            return;
        }
        setAppliedBulkUnitPrice(nextUnitPrice);
    }, [bulkUnitPriceInput]);

    const handleClearBulkUnitPrice = useCallback(() => {
        setAppliedBulkUnitPrice(0);
        setBulkUnitPriceInput('');
    }, []);

    const handleUseWorkerMasterPayTypeChange = useCallback((checked: boolean) => {
        setUseWorkerMasterPayType(checked);
        setWorkerPayTypes(buildSupportLaborWorkerPayTypesFromDefaults(
            flatPreviewRows,
            checked,
            loadSupportLaborStatementDefaults(statementOptionPreset)
        ));
    }, [flatPreviewRows, statementOptionPreset]);

    const handleStatementOptionPresetChange = useCallback((value: StatementIssueOptionPreset) => {
        setStatementOptionPreset(value);
        saveStatementIssueOptionPreset(value);
        setStatusMessage(`${STATEMENT_ISSUE_OPTION_PRESETS.find((option) => option.value === value)?.label ?? ''} 옵션을 불러왔습니다.`);
    }, []);

    const handleSaveStatementOptions = useCallback(async () => {
        saveLaborStatementPresetDefaults(statementOptionPreset, {
            showBankColumn,
            showBillingColumns,
            isSplitView,
            showBankUnderAddress,
            showTeamUnderName,
            unitPriceOverride: appliedBulkUnitPrice,
            useWorkerMasterPayType,
            workerPayTypes,
            delegateBankName,
            delegateAccountHolder,
            delegateAccountNumber,
        });
        const label = STATEMENT_ISSUE_OPTION_PRESETS.find((option) => option.value === statementOptionPreset)?.label ?? '선택';
        try {
            await statementOutputService.upsertOutput(buildLaborStatementOutput());
            setStatusMessage(`${label} 노임명세 옵션을 저장하고 문서대장에 반영했습니다.`);
        } catch (error) {
            console.error('[SupportTeamPaymentPage] labor statement output save failed:', error);
            setStatusMessage(`${label} 노임명세 옵션은 저장했지만 문서대장 반영에 실패했습니다.`);
        }
    }, [
        appliedBulkUnitPrice,
        buildLaborStatementOutput,
        delegateAccountHolder,
        delegateAccountNumber,
        delegateBankName,
        isSplitView,
        showBankColumn,
        showBankUnderAddress,
        showBillingColumns,
        showTeamUnderName,
        statementOptionPreset,
        useWorkerMasterPayType,
        workerPayTypes,
    ]);

    const captureStatementImage = async (): Promise<Blob> => {
        if (!statementSheetRef.current) {
            throw new Error('노무비 지급 명세서 표 영역을 찾지 못했습니다.');
        }
        return captureElementToPngBlob(statementSheetRef.current);
    };

    const handleCopy = async () => {
        try {
            setBusyAction('copy');
            const blob = await captureStatementImage();
            await copyPngBlobToClipboard(blob);
            setStatusMessage('노무비 지급 명세서 표 이미지를 복사했습니다.');
        } catch (error) {
            console.error('노무비 지급 명세서 이미지 복사 실패:', error);
            setStatusMessage('이 브라우저에서 이미지 복사를 지원하지 않습니다. 공유 버튼을 사용해 주세요.');
        } finally {
            setBusyAction(null);
        }
    };

    const handleSend = async () => {
        const shareNavigator = navigator as Navigator & {
            canShare?: (data: { files?: File[] }) => boolean;
            share?: (data: { title?: string; text?: string; files?: File[] }) => Promise<void>;
        };

        try {
            setBusyAction('send');
            const blob = await captureStatementImage();
            const file = new File([blob], imageFileName, { type: 'image/png' });

            if (!shareNavigator.share || (shareNavigator.canShare && !shareNavigator.canShare({ files: [file] }))) {
                saveAs(blob, imageFileName);
                setStatusMessage('이미지 공유를 지원하지 않아 PNG 파일로 저장했습니다.');
                return;
            }

            await shareNavigator.share({
                title: shareTitle,
                text: '노무비 지급 명세서',
                files: [file]
            });
            setStatusMessage('노무비 지급 명세서 이미지를 보낼 수 있도록 공유를 열었습니다.');
        } catch (error) {
            if ((error as DOMException)?.name !== 'AbortError') {
                console.error('노무비 지급 명세서 이미지 공유 실패:', error);
                setStatusMessage('이미지 공유를 열지 못했습니다.');
            }
        } finally {
            setBusyAction(null);
        }
    };

    return (
        <div className="space-y-5 rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm" onClick={(event) => event.stopPropagation()}>
            <div className="flex flex-col gap-3 border-b border-emerald-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h3 className="flex items-center gap-2 text-base font-black text-slate-900">
                        <FontAwesomeIcon icon={faFileInvoiceDollar} className="text-emerald-600" />
                        노임명세서
                    </h3>
                    <p className="mt-1 text-xs font-bold text-slate-500">
                        {aggregate.companyName} · {formatYearMonthLabel(yearMonth)}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="노임명세서 닫기"
                    title="닫기"
                    className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 transition hover:bg-slate-50"
                >
                    <FontAwesomeIcon icon={faXmark} />
                    닫기
                </button>
            </div>
            <div className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-[11px] font-black text-slate-500">대상</div>
                        <div className="mt-1 text-sm font-black text-slate-900">{aggregate.companyName}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-[11px] font-black text-slate-500">총공수</div>
                        <div className="mt-1 text-sm font-black text-slate-900">{formatManDayText(statementTotalManDay)}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-emerald-50 p-4">
                        <div className="text-[11px] font-black text-emerald-700">청구합계</div>
                        <div className="mt-1 text-sm font-black text-emerald-800">
                            {formatCurrencyText(statementTotalAmount)}
                        </div>
                    </div>
                </div>

                {payTypeAutoWarningNames.length > 0 && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                        <div className="flex items-center gap-2">
                            <FontAwesomeIcon icon={faTriangleExclamation} />
                            <span>직불/위임 자동선택 경고</span>
                        </div>
                        <div className="mt-1 leading-5 text-amber-700">
                            작업자 DB에 직불여부가 없거나 작업자 매칭이 되지 않아 기본 지급구분으로 적용됐습니다:{' '}
                            {payTypeAutoWarningNames.slice(0, 6).join(', ')}
                            {payTypeAutoWarningNames.length > 6 ? ` 외 ${payTypeAutoWarningNames.length - 6}명` : ''}
                        </div>
                    </div>
                )}

                {statementPreviews.length > 1 && (
                    <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-3">
                        {statementPreviews.map((preview, index) => (
                            <button
                                key={`${preview.aggregate.aggregateId}-${preview.site.siteId}-tab`}
                                type="button"
                                onClick={() => setActivePreviewIndex(index)}
                                className={`rounded-lg px-3 py-1.5 text-xs font-black transition ${activePreviewIndex === index
                                    ? 'bg-emerald-600 text-white shadow-sm'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                            >
                                {preview.site.siteName}
                            </button>
                        ))}
                    </div>
                )}

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 text-xs font-black text-slate-500">
                            <FontAwesomeIcon icon={faFileInvoiceDollar} />
                            보기 설정
                        </span>
                        <label className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-700">
                            <input
                                type="checkbox"
                                data-testid="support-team-labor-statement-bank-column-toggle"
                                aria-label="계좌/지급구분 표시"
                                checked={showBankColumn}
                                onChange={(event) => setShowBankColumn(event.target.checked)}
                                className="accent-emerald-600"
                            />
                            계좌/지급구분
                        </label>
                        <label className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-700">
                            <input
                                type="checkbox"
                                data-testid="support-team-labor-statement-billing-columns-toggle"
                                aria-label="청구단가/청구금액 표시"
                                checked={showBillingColumns}
                                onChange={(event) => setShowBillingColumns(event.target.checked)}
                                className="accent-emerald-600"
                            />
                            청구단가/청구금액
                        </label>
                        <label className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-700">
                            <input type="checkbox" checked={isSplitView} onChange={(event) => setIsSplitView(event.target.checked)} className="accent-emerald-600" />
                            2줄 보기
                        </label>
                        <label className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-700">
                            <input type="checkbox" checked={showBankUnderAddress} onChange={(event) => setShowBankUnderAddress(event.target.checked)} className="accent-emerald-600" />
                            주소 하단 계좌
                        </label>
                        <label className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-700">
                            <input type="checkbox" checked={showTeamUnderName} onChange={(event) => setShowTeamUnderName(event.target.checked)} className="accent-emerald-600" />
                            이름 하단 팀명
                        </label>
                        <label className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-black ${
                            useWorkerMasterPayType
                                ? 'border-blue-200 bg-blue-50 text-blue-700'
                                : 'border-slate-200 bg-white text-slate-600'
                        }`}>
                            <input
                                type="checkbox"
                                checked={useWorkerMasterPayType}
                                onChange={(event) => handleUseWorkerMasterPayTypeChange(event.target.checked)}
                                className="accent-blue-600"
                            />
                            DB 직불여부 적용
                        </label>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3">
                        <span className="text-xs font-black text-slate-500">옵션 저장</span>
                        <div className="inline-flex overflow-hidden rounded-md border border-slate-200 bg-white">
                            {STATEMENT_ISSUE_OPTION_PRESETS.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => handleStatementOptionPresetChange(option.value)}
                                    className={`h-8 px-3 text-xs font-black transition ${
                                        statementOptionPreset === option.value
                                            ? 'bg-emerald-600 text-white'
                                            : 'bg-white text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
                                    }`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                        <button
                            type="button"
                            onClick={handleSaveStatementOptions}
                            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 text-xs font-black text-emerald-700 transition hover:bg-emerald-100"
                        >
                            <FontAwesomeIcon icon={faSave} />
                            옵션 저장
                        </button>
                    </div>

                    <div className="mt-3 grid gap-2 xl:grid-cols-[minmax(280px,0.9fr)_minmax(360px,1.1fr)]">
                        <div className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2">
                            <span className="shrink-0 text-xs font-black text-slate-500">단가 일괄</span>
                            <input
                                type="text"
                                value={bulkUnitPriceInput}
                                onChange={(event) => setBulkUnitPriceInput(normalizeCurrencyAmountInput(event.target.value))}
                                placeholder="예: 230000"
                                className="h-8 min-w-0 flex-1 rounded-md border border-slate-200 bg-slate-50 px-2 text-right text-sm font-bold outline-none focus:border-emerald-500"
                            />
                            <button
                                type="button"
                                onClick={handleApplyBulkUnitPrice}
                                className="inline-flex h-8 items-center rounded-md bg-orange-100 px-2 text-xs font-black text-orange-700 transition hover:bg-orange-200"
                            >
                                적용
                            </button>
                            {appliedBulkUnitPrice > 0 && (
                                <button
                                    type="button"
                                    onClick={handleClearBulkUnitPrice}
                                    className="h-8 rounded-md px-2 text-xs font-black text-slate-500 transition hover:bg-slate-100"
                                >
                                    해제
                                </button>
                            )}
                        </div>
                        <div className="min-w-0 rounded-lg border border-yellow-200 bg-yellow-50 px-2 py-2">
                            <div className="mb-1 flex items-center gap-1 text-xs font-black text-yellow-700">
                                <FontAwesomeIcon icon={faReceipt} />
                                위임 계좌
                            </div>
                            <div className="grid grid-cols-[72px_82px_minmax(120px,1fr)] gap-1.5">
                                <input
                                    type="text"
                                    value={delegateBankName}
                                    onChange={(event) => setDelegateBankName(event.target.value)}
                                    placeholder="은행"
                                    className="h-8 rounded-md border border-yellow-200 bg-white px-2 text-xs font-bold outline-none focus:border-yellow-500"
                                />
                                <input
                                    type="text"
                                    value={delegateAccountHolder}
                                    onChange={(event) => setDelegateAccountHolder(event.target.value)}
                                    placeholder="예금주"
                                    className="h-8 rounded-md border border-yellow-200 bg-white px-2 text-xs font-bold outline-none focus:border-yellow-500"
                                />
                                <input
                                    type="text"
                                    value={delegateAccountNumber}
                                    onChange={(event) => setDelegateAccountNumber(event.target.value)}
                                    placeholder="계좌번호"
                                    className="h-8 rounded-md border border-yellow-200 bg-white px-2 text-xs font-bold outline-none focus:border-yellow-500"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="max-h-[58vh] overflow-auto rounded-2xl border border-slate-200 bg-slate-100 p-4">
                    {activePreview ? (
                        <div ref={statementSheetRef} data-statement-capture="true" className={`w-full ${isSplitView ? 'min-w-[1180px]' : 'min-w-[1680px]'} bg-white`}>
                            <LaborStatementPreview
                                aggregate={activePreview.aggregate}
                                site={activePreview.site}
                                rows={activePreview.rows}
                                yearMonth={yearMonth}
                                viewOptions={statementViewOptions}
                            />
                        </div>
                    ) : (
                        <div ref={statementSheetRef} data-statement-capture="true" className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm font-bold text-slate-500">
                            표시할 노임명세 표가 없습니다.
                        </div>
                    )}
                </div>

                <details className="rounded-xl border border-slate-200 bg-white">
                    <summary className="cursor-pointer px-4 py-3 text-sm font-black text-slate-700">
                        텍스트 보조본 보기
                    </summary>
                    <div className="border-t border-slate-100 p-4">
                        <textarea
                            readOnly
                            value={statementText}
                            onFocus={(event) => event.currentTarget.select()}
                            className="min-h-[220px] w-full resize-y rounded-xl border border-slate-200 bg-white p-4 font-mono text-[13px] leading-6 text-slate-800 outline-none focus:ring-2 focus:ring-emerald-400"
                        />
                    </div>
                </details>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-h-[20px] text-sm font-bold text-emerald-700">{statusMessage}</div>
                    <div className="flex flex-wrap justify-end gap-2">
                        <button
                            type="button"
                            aria-label="노무비 지급 명세서 표 복사"
                            title="노무비 지급 명세서 표 복사"
                            onClick={handleCopy}
                            disabled={busyAction !== null}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <FontAwesomeIcon icon={busyAction === 'copy' ? faSpinner : faCopy} spin={busyAction === 'copy'} />
                            복사
                        </button>
                        <button
                            type="button"
                            aria-label="노무비 지급 명세서 표 보내기"
                            title="노무비 지급 명세서 표 보내기"
                            onClick={handleSend}
                            disabled={busyAction !== null}
                            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <FontAwesomeIcon icon={busyAction === 'send' ? faSpinner : faShareNodes} spin={busyAction === 'send'} />
                            보내기
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ExpenseClaimShareModal: React.FC<{
    aggregate: SupportCompanyAggregate;
    claims: TeamExpenseClaim[];
    yearMonth: string;
    logoUrl?: string | null;
    onClose: () => void;
}> = ({ aggregate, claims, yearMonth, logoUrl, onClose }) => {
    const [statusMessage, setStatusMessage] = useState('');
    const [busyAction, setBusyAction] = useState<'copy' | 'send' | null>(null);
    const statementSheetRef = useRef<HTMLDivElement | null>(null);
    const sortedClaims = useMemo(() => sortExpenseClaims(claims), [claims]);
    const totalAmount = getExpenseClaimsTotal(sortedClaims);
    const statementText = useMemo(
        () => buildExpenseClaimStatementText(aggregate, sortedClaims, yearMonth),
        [aggregate, sortedClaims, yearMonth]
    );
    const shareTitle = `후청구 경비내역_${yearMonth}_${aggregate.companyName}`;
    const imageFileName = `${sanitizeFileNamePart(shareTitle)}.png`;

    const captureStatementImage = async (): Promise<Blob> =>
        createExpenseClaimStatementImageBlob(aggregate, sortedClaims, yearMonth, logoUrl);

    const handleCopy = async () => {
        try {
            setBusyAction('copy');
            const blob = await captureStatementImage();
            await copyPngBlobToClipboard(blob);
            setStatusMessage('후청구 경비내역 표 이미지를 복사했습니다.');
        } catch (error) {
            console.error('후청구 경비내역 이미지 복사 실패:', error);
            setStatusMessage('이 브라우저에서 이미지 복사를 지원하지 않습니다. 공유 버튼을 사용해 주세요.');
        } finally {
            setBusyAction(null);
        }
    };

    const handleSend = async () => {
        const shareNavigator = navigator as Navigator & {
            canShare?: (data: { files?: File[] }) => boolean;
            share?: (data: { title?: string; text?: string; files?: File[] }) => Promise<void>;
        };

        try {
            setBusyAction('send');
            const blob = await captureStatementImage();
            const file = new File([blob], imageFileName, { type: 'image/png' });

            if (!shareNavigator.share || (shareNavigator.canShare && !shareNavigator.canShare({ files: [file] }))) {
                saveAs(blob, imageFileName);
                setStatusMessage('이미지 공유를 지원하지 않아 PNG 파일로 저장했습니다.');
                return;
            }

            await shareNavigator.share({
                title: shareTitle,
                text: '후청구 경비내역',
                files: [file]
            });
            setStatusMessage('후청구 경비내역 이미지를 보낼 수 있도록 공유를 열었습니다.');
        } catch (error) {
            if ((error as DOMException)?.name !== 'AbortError') {
                console.error('후청구 경비내역 이미지 공유 실패:', error);
                setStatusMessage('이미지 공유를 열지 못했습니다.');
            }
        } finally {
            setBusyAction(null);
        }
    };

    return (
        <Modal title="경비내역서" onClose={onClose} widthClass="max-w-7xl">
            <div className="space-y-5 p-6">
                <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-[11px] font-black text-slate-500">정산주체</div>
                        <div className="mt-1 text-sm font-black text-slate-900">{aggregate.companyName}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-[11px] font-black text-slate-500">후청구 건수</div>
                        <div className="mt-1 text-sm font-black text-slate-900">{formatNumber(sortedClaims.length)}건</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-emerald-50 p-4">
                        <div className="text-[11px] font-black text-emerald-700">후청구 합계</div>
                        <div className="mt-1 text-sm font-black text-emerald-800">{formatCurrencyText(totalAmount)}</div>
                    </div>
                </div>

                <div className="max-h-[58vh] overflow-auto rounded-2xl border border-slate-200 bg-slate-100 p-4">
                    <div ref={statementSheetRef} data-statement-capture="true" className="inline-block min-w-[1180px] bg-white">
                        <ExpenseClaimStatementPreview
                            aggregate={aggregate}
                            claims={sortedClaims}
                            yearMonth={yearMonth}
                            logoUrl={logoUrl}
                        />
                    </div>
                </div>

                <details className="rounded-xl border border-slate-200 bg-white">
                    <summary className="cursor-pointer px-4 py-3 text-sm font-black text-slate-700">
                        텍스트 보조본 보기
                    </summary>
                    <div className="border-t border-slate-100 p-4">
                        <textarea
                            readOnly
                            value={statementText}
                            onFocus={(event) => event.currentTarget.select()}
                            className="min-h-[220px] w-full resize-y rounded-xl border border-slate-200 bg-white p-4 font-mono text-[13px] leading-6 text-slate-800 outline-none focus:ring-2 focus:ring-emerald-400"
                        />
                    </div>
                </details>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-h-[20px] text-sm font-bold text-emerald-700">{statusMessage}</div>
                    <div className="flex flex-wrap justify-end gap-2">
                        <button
                            type="button"
                            aria-label="후청구 경비내역 표 복사"
                            title="후청구 경비내역 표 복사"
                            onClick={handleCopy}
                            disabled={busyAction !== null}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <FontAwesomeIcon icon={busyAction === 'copy' ? faSpinner : faCopy} spin={busyAction === 'copy'} />
                            복사
                        </button>
                        <button
                            type="button"
                            aria-label="후청구 경비내역 표 보내기"
                            title="후청구 경비내역 표 보내기"
                            onClick={handleSend}
                            disabled={busyAction !== null}
                            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <FontAwesomeIcon icon={busyAction === 'send' ? faSpinner : faShareNodes} spin={busyAction === 'send'} />
                            보내기
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};


const ExpenseClaimStatementPreview: React.FC<{
    aggregate: SupportCompanyAggregate;
    claims: TeamExpenseClaim[];
    yearMonth: string;
    logoUrl?: string | null;
}> = ({ aggregate, claims, yearMonth, logoUrl }) => {
    const month = parseInt(yearMonth.split('-')[1] ?? '0', 10);
    const rows = sortExpenseClaims(claims);
    const totalAmount = getExpenseClaimsTotal(rows);

    return (
        <div className="inline-block min-w-full border border-slate-200 bg-white p-10 shadow-2xl">
            <h2 className="mb-8 text-center text-3xl font-black tracking-widest text-slate-800 underline decoration-4 underline-offset-8 decoration-emerald-500">
                후 청 구 경 비 내 역 서 ({month}월분)
            </h2>
            <div className="mb-4 flex items-end justify-between px-2">
                <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-600">정산 주체: <span className="border-b-2 border-slate-300 px-2 text-slate-900">{aggregate.companyName}</span></p>
                    <p className="text-sm font-bold text-slate-600">후청구 합계: <span className="border-b-2 border-slate-300 px-2 text-emerald-700">{formatCurrencyText(totalAmount)} / {formatNumber(rows.length)}건</span></p>
                </div>
                <StatementBrand logoUrl={logoUrl} />
            </div>
            <table className="w-full border-collapse border-2 border-slate-800 text-[10px]">
                <thead>
                    <tr className="bg-emerald-50 text-slate-800">
                        <th className="w-10 border-2 border-slate-800 p-2 font-black">NO</th>
                        <th className="w-24 border-2 border-slate-800 p-2 font-black">일자</th>
                        <th className="min-w-[150px] border-2 border-slate-800 p-2 font-black">현장명</th>
                        <th className="w-28 border-2 border-slate-800 p-2 font-black">사용팀</th>
                        <th className="w-28 border-2 border-slate-800 p-2 font-black">청구대상</th>
                        <th className="w-24 border-2 border-slate-800 p-2 font-black">구분</th>
                        <th className="min-w-[220px] border-2 border-slate-800 p-2 font-black">상세내용</th>
                        <th className="w-20 border-2 border-slate-800 p-2 font-black">상태</th>
                        <th className="w-28 border-2 border-slate-800 p-2 font-black">금액</th>
                        <th className="min-w-[160px] border-2 border-slate-800 p-2 font-black">메모</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.length === 0 ? (
                        <tr>
                            <td colSpan={10} className="border-2 border-slate-800 p-8 text-center text-sm font-bold text-slate-500">
                                등록된 후청구 경비내역이 없습니다.
                            </td>
                        </tr>
                    ) : rows.map((claim, index) => (
                        <tr key={getExpenseClaimKey(claim)} className="font-bold">
                            <td className="border-2 border-slate-800 bg-slate-50 p-2 text-center font-mono">{index + 1}</td>
                            <td className="border-2 border-slate-800 p-2 text-center font-mono">{claim.date || '-'}</td>
                            <td className="border-2 border-slate-800 p-2 text-left">{claim.siteName || '-'}</td>
                            <td className="border-2 border-slate-800 p-2 text-center">{claim.payerTeamName || '-'}</td>
                            <td className="border-2 border-slate-800 p-2 text-center">{claim.chargeToTeamName || '-'}</td>
                            <td className="border-2 border-slate-800 p-2 text-center">{claim.category || '기타'}</td>
                            <td className="border-2 border-slate-800 p-2 text-left">{claim.description || '-'}</td>
                            <td className="border-2 border-slate-800 bg-slate-50 p-2 text-center">{getExpenseClaimStatusLabel(claim.status)}</td>
                            <td className="border-2 border-slate-800 bg-emerald-50 p-2 text-right font-mono text-emerald-700">{formatNumber(getExpenseClaimAmount(claim))}</td>
                            <td className="border-2 border-slate-800 p-2 text-left">{claim.memo || '-'}</td>
                        </tr>
                    ))}
                    <tr className="bg-emerald-100 text-xs font-black">
                        <td colSpan={8} className="border-2 border-slate-800 p-2 text-center">합 계</td>
                        <td className="border-2 border-slate-800 p-2 text-right font-mono text-emerald-800">{formatNumber(totalAmount)}</td>
                        <td className="border-2 border-slate-800 p-2 text-center">{formatNumber(rows.length)}건</td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
};

const LaborStatementPreview: React.FC<{
    aggregate: SupportCompanyAggregate;
    site: SupportSiteRow;
    rows: SupportLaborExcelRow[];
    yearMonth: string;
    viewOptions?: SupportLaborStatementViewOptions;
    logoUrl?: string | null;
}> = ({ site, rows, yearMonth, viewOptions = DEFAULT_SUPPORT_LABOR_STATEMENT_VIEW_OPTIONS, logoUrl }) => {
    const [yearString, monthString] = yearMonth.split('-');
    const year = parseInt(yearString ?? '', 10);
    const month = parseInt(monthString ?? '0', 10);
    const statementPeriod = Number.isFinite(year)
        ? `${String(year % 100).padStart(2, '0')}년 ${month || ''}월분`
        : `${month || ''}월분`;
    const dayTotals = Array.from({ length: MAX_DAY_COLUMNS }, () => 0);
    rows.forEach((row) => {
        row.days.forEach((value, index) => {
            dayTotals[index] += value;
        });
    });
    const totalManDay = rows.reduce((acc, row) => acc + row.totalManDay, 0);
    const totalBillingAmount = rows.reduce((acc, row) => acc + row.billingAmount, 0);
    const avgBillingPrice = totalManDay > 0 ? Math.round(totalBillingAmount / totalManDay) : 0;
    const allDayLabels = Array.from({ length: MAX_DAY_COLUMNS }, (_, index) => index + 1);
    const primaryDayLabels = viewOptions.isSplitView ? DAY_LABELS_FIRST : allDayLabels;
    const statementColumns = buildSupportLaborStatementColumns(viewOptions);
    const statementTableMinWidth = statementColumns.reduce((sum, column) => sum + column.width, 0);
    const statementSheetMinWidth = statementTableMinWidth + 82;
    const footerRowSpan = viewOptions.isSplitView && viewOptions.showBillingColumns ? 2 : 1;
    const getPaymentLabel = (payType?: SupportStatementPayType) => payType === 'delegate' ? '위임' : '직불';
    const formatBankInfo = (row: SupportLaborExcelRow) =>
        [row.bankName, row.accountHolder, row.accountNumber].filter(Boolean).join(' / ');
    const getAddressContent = (row: SupportLaborExcelRow) => {
        const parts = [row.address || row.siteAddress || '-'];
        if (viewOptions.showBankUnderAddress) {
            const bankInfo = formatBankInfo(row);
            parts.push(bankInfo ? `${bankInfo} (${getPaymentLabel(row.payType)})` : getPaymentLabel(row.payType));
        }
        return parts;
    };

    return (
        <div className="w-full min-w-full border border-slate-200 bg-white p-10 shadow-2xl" style={{ minWidth: statementSheetMinWidth }}>
            <h2 className="mb-8 text-center text-3xl font-black tracking-widest text-slate-800 underline decoration-4 underline-offset-8 decoration-amber-500">
                노 무 비 지 급 명 세 서 ({statementPeriod})
            </h2>
            <div className="mb-4 flex items-end justify-between gap-4 px-2">
                <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-600">
                        현장명: <span className="border-b-2 border-slate-300 px-2 text-slate-900">{site.siteName}</span>
                    </p>
                </div>
                <StatementBrand logoUrl={logoUrl} />
            </div>
            <table className="w-full table-fixed border-collapse border-2 border-slate-800 text-[11px] leading-snug" style={{ minWidth: statementTableMinWidth }}>
                <colgroup>
                    {statementColumns.map((column) => (
                        <col key={column.key} style={{ width: column.width }} />
                    ))}
                </colgroup>
                <thead>
                    <tr className="bg-slate-100 font-black text-slate-800">
                        <th className="border-2 border-slate-800 p-2" rowSpan={viewOptions.isSplitView ? 2 : 1}>NO</th>
                        <th className="border-2 border-slate-800 p-2" rowSpan={viewOptions.isSplitView ? 2 : 1}>성명</th>
                        <th className="border-2 border-slate-800 p-2">주민번호</th>
                        <th className="border-2 border-slate-800 p-2" rowSpan={viewOptions.isSplitView ? 2 : 1}>주 소</th>
                        {primaryDayLabels.map((day) => (
                            <th key={day} className="border-2 border-slate-800 bg-sky-50 text-sky-700">{String(day).padStart(2, '0')}</th>
                        ))}
                        {viewOptions.isSplitView && <th className="border-2 border-slate-800 bg-slate-50">X</th>}
                        <th className="border-2 border-slate-800 p-2" rowSpan={viewOptions.isSplitView ? 2 : 1}>출역</th>
                        {viewOptions.showBillingColumns && (
                            <th className="border-2 border-slate-800 bg-emerald-100 p-2 text-emerald-950">청구단가</th>
                        )}
                        {viewOptions.showBillingColumns && !viewOptions.isSplitView && (
                            <th className="border-2 border-slate-800 bg-emerald-100 p-2 text-emerald-950">청구금액</th>
                        )}
                        {viewOptions.showBankColumn && (
                            <th className="border-2 border-slate-800 bg-yellow-100 p-2 text-yellow-950" rowSpan={viewOptions.isSplitView ? 2 : 1}>
                                계좌번호 / 지급구분
                            </th>
                        )}
                    </tr>
                    {viewOptions.isSplitView && (
                        <tr className="bg-slate-100 font-black text-slate-800">
                            <th className="border-2 border-slate-800 p-2">전화번호</th>
                            {DAY_LABELS_SECOND.map((day) => (
                                <th key={day} className="border-2 border-slate-800 bg-rose-50 text-rose-700">{day}</th>
                            ))}
                            {viewOptions.showBillingColumns && (
                                <th className="border-2 border-slate-800 bg-emerald-100 p-2 text-emerald-950">청구금액</th>
                            )}
                        </tr>
                    )}
                </thead>
                <tbody>
                    {rows.map((row, index) => {
                        const workerKey = getSupportLaborStatementWorkerKey(row);
                        const teamNames = row.teamNames ?? [];
                        return (
                            <React.Fragment key={`${workerKey}:${site.siteId}:${index}`}>
                                <tr className="font-bold">
                                    <td rowSpan={viewOptions.isSplitView ? 2 : 1} className="border-2 border-slate-800 bg-slate-50 py-1.5 text-center">{index + 1}</td>
                                    <td rowSpan={viewOptions.isSplitView ? 2 : 1} className="border-2 border-slate-800 py-1.5 text-center text-[13px]">
                                        <div>{row.workerName}</div>
                                        {viewOptions.showTeamUnderName && teamNames.length > 0 && (
                                            <div className="mt-1 text-[9px] font-semibold text-slate-500">{teamNames.join(', ')}</div>
                                        )}
                                    </td>
                                    <td className="border-2 border-slate-800 py-1.5 text-center font-mono">{formatFullIdNumber(row.idNumber)}</td>
                                    <td rowSpan={viewOptions.isSplitView ? 2 : 1} className={`break-words border-2 border-slate-800 px-1.5 py-1.5 text-[10px] leading-snug ${row.payType === 'delegate' && viewOptions.showBankUnderAddress ? 'bg-yellow-100' : ''}`}>
                                        {getAddressContent(row).map((line, lineIndex) => (
                                            <div key={`${workerKey}:address:${lineIndex}`} className={lineIndex > 0 ? 'mt-1 border-t border-slate-300 pt-1 font-semibold text-yellow-800' : ''}>{line}</div>
                                        ))}
                                    </td>
                                    {primaryDayLabels.map((day) => (
                                        <td key={day} className="border-2 border-slate-800 bg-sky-50/30 py-1.5 text-center">{formatStatementDayManDay(row.days[day - 1])}</td>
                                    ))}
                                    {viewOptions.isSplitView && <td className="border-2 border-slate-800 bg-slate-50 py-1.5"></td>}
                                    <td rowSpan={viewOptions.isSplitView ? 2 : 1} className="border-2 border-slate-800 bg-slate-50 py-1.5 text-center font-mono text-[13px]">{formatStatementDayManDay(row.totalManDay)}</td>
                                    {viewOptions.showBillingColumns && (
                                        <td className="border-2 border-slate-800 bg-emerald-50 px-2 py-1.5 text-right font-mono text-emerald-700">{formatNumber(row.billingUnitPrice)}</td>
                                    )}
                                    {viewOptions.showBillingColumns && !viewOptions.isSplitView && (
                                        <td className="border-2 border-slate-800 bg-emerald-50 px-2 py-1.5 text-right font-mono text-emerald-800">{formatNumber(row.billingAmount)}</td>
                                    )}
                                    {viewOptions.showBankColumn && (
                                        <td rowSpan={viewOptions.isSplitView ? 2 : 1} className={`break-words border-2 border-slate-800 px-1.5 py-1.5 text-[10px] leading-snug ${row.payType === 'delegate' ? 'bg-yellow-100 text-yellow-900' : 'bg-white text-slate-700'}`}>
                                            <div className="font-black">{getPaymentLabel(row.payType)}</div>
                                            <div className="mt-1 font-semibold">{formatBankInfo(row) || '-'}</div>
                                        </td>
                                    )}
                                </tr>
                                {viewOptions.isSplitView && (
                                    <tr className="font-bold">
                                        <td className="border-2 border-slate-800 py-1.5 text-center font-mono text-slate-500">{row.contact || '-'}</td>
                                        {DAY_LABELS_SECOND.map((day) => (
                                            <td key={day} className="border-2 border-slate-800 bg-rose-50/30 py-1.5 text-center">{formatStatementDayManDay(row.days[day - 1])}</td>
                                        ))}
                                        {viewOptions.showBillingColumns && (
                                            <td className="border-2 border-slate-800 bg-emerald-50 px-2 py-1.5 text-right font-mono text-emerald-800">{formatNumber(row.billingAmount)}</td>
                                        )}
                                    </tr>
                                )}
                            </React.Fragment>
                        );
                    })}
                    <tr className="bg-slate-200 text-[13px] font-black">
                        <td colSpan={4} className="border-2 border-slate-800 py-2.5 text-center">합 계</td>
                        {primaryDayLabels.map((day) => (
                            <td key={day} className="border-2 border-slate-800 py-2.5 text-center">{formatStatementDayManDay(dayTotals[day - 1])}</td>
                        ))}
                        {viewOptions.isSplitView && <td className="border-2 border-slate-800 py-2.5"></td>}
                        <td rowSpan={footerRowSpan} className="border-2 border-slate-800 py-2.5 text-center font-mono">{formatStatementDayManDay(totalManDay)}</td>
                        {viewOptions.showBillingColumns && (
                            <td className="border-2 border-slate-800 bg-emerald-100 px-2 py-2.5 text-right font-mono text-emerald-800">{formatNumber(avgBillingPrice)}</td>
                        )}
                        {viewOptions.showBillingColumns && !viewOptions.isSplitView && (
                            <td className="border-2 border-slate-800 bg-emerald-100 px-2 py-2.5 text-right font-mono text-emerald-900">{formatNumber(totalBillingAmount)}</td>
                        )}
                        {viewOptions.showBankColumn && <td rowSpan={footerRowSpan} className="border-2 border-slate-800 bg-yellow-100 py-2.5"></td>}
                    </tr>
                    {viewOptions.isSplitView && viewOptions.showBillingColumns && (
                        <tr className="bg-slate-200 text-[13px] font-black">
                            <td colSpan={4} className="border-2 border-slate-800 py-2.5 text-center">청구금액</td>
                            {DAY_LABELS_SECOND.map((day) => (
                                <td key={day} className="border-2 border-slate-800 py-2.5 text-center">{formatStatementDayManDay(dayTotals[day - 1])}</td>
                            ))}
                            <td className="border-2 border-slate-800 bg-emerald-100 px-2 py-2.5 text-right font-mono text-emerald-900">{formatNumber(totalBillingAmount)}</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
};

interface ActionButtonProps {
    children: React.ReactNode;
    variant: 'outline-green' | 'outline-amber' | 'solid-green' | 'solid-amber';
    disabled?: boolean;
    onClick?: () => void | Promise<void>;
    className?: string;
}

const ActionButton: React.FC<ActionButtonProps> = ({ children, variant, disabled, onClick, className }) => {
    const base = 'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition-all focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 shadow-sm hover:translate-y-[-1px] active:translate-y-[0px]';
    const variants: Record<ActionButtonProps['variant'], string> = {
        'outline-green': 'border-2 border-emerald-500 text-emerald-600 hover:bg-emerald-50',
        'outline-amber': 'border-2 border-amber-500 text-amber-600 hover:bg-amber-50',
        'solid-green': 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-emerald-200',
        'solid-amber': 'bg-amber-500 text-white hover:bg-amber-400 shadow-amber-200'
    };
    return (
        <button type="button" className={`${base} ${variants[variant]} ${className ?? ''}`} disabled={disabled} onClick={onClick}>
            {children}
        </button>
    );
};

interface SummaryCardProps {
    label: string;
    value: React.ReactNode;
    icon: any;
    tone: 'emerald' | 'sky' | 'orange' | 'violet';
}

const SummaryCard: React.FC<SummaryCardProps> = ({ label, value, icon, tone }) => {
    const toneMap: Record<SummaryCardProps['tone'], { bg: string; text: string; icon: string }> = {
        emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: 'text-emerald-500' },
        sky: { bg: 'bg-sky-50', text: 'text-sky-700', icon: 'text-sky-500' },
        orange: { bg: 'bg-orange-50', text: 'text-orange-700', icon: 'text-orange-500' },
        violet: { bg: 'bg-violet-50', text: 'text-violet-700', icon: 'text-violet-500' }
    };
    return (
        <div className={`rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all hover:shadow-md group`}>
            <div className={`mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl ${toneMap[tone].bg} transition-transform group-hover:scale-110`}>
                <FontAwesomeIcon icon={icon} className={`text-xl ${toneMap[tone].icon}`} />
            </div>
            <p className="text-[12px] font-black text-slate-400 uppercase tracking-wider">{label}</p>
            <p className={`text-2xl font-black mt-1 ${toneMap[tone].text}`}>{value}</p>
        </div>
    );
};

interface ModalProps {
    title: string;
    onClose: () => void;
    widthClass?: string;
    children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ title, onClose, widthClass = 'max-w-2xl', children }) => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
        <div className={`relative w-full rounded-3xl bg-white shadow-2xl ${widthClass} flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200`}>
            <div className="flex items-center justify-between border-b border-slate-100 px-8 py-5">
                <h3 className="text-xl font-black text-slate-800">{title}</h3>
                <button
                    type="button"
                    className="w-10 h-10 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all"
                    onClick={onClose}
                >
                    <FontAwesomeIcon icon={faXmark} className="text-xl" />
                </button>
            </div>
            <div className="flex-1 overflow-y-auto">
                {children}
            </div>
        </div>
    </div>
);

export default SupportTeamPaymentPage;
