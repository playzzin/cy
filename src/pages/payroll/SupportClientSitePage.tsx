import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faArrowLeft,
    faBuilding,
    faCalendarAlt,
    faChevronRight,
    faCircleCheck,
    faCopy,
    faDownload,
    faFileInvoice,
    faFileInvoiceDollar,
    faMapLocationDot,
    faPlus,
    faReceipt,
    faSearch,
    faShareNodes,
    faSave,
    faSpinner,
    faTrash,
    faTriangleExclamation,
    faUsers,
    faXmark,
} from '@fortawesome/free-solid-svg-icons';
import * as XLSX from 'xlsx-js-style';
import { saveAs } from 'file-saver';
import html2canvas from 'html2canvas';
import {
    MAX_DAY_COLUMNS,
    DAY_LABELS_FIRST,
    DAY_LABELS_SECOND,
} from '../../utils/excel/SupportPaymentExcelGenerator';
import { resolveIcon } from '../../constants/iconMap';
import { Team, teamService } from '../../services/teamService';
import { Company, companyService } from '../../services/companyService';
import { Site, siteService } from '../../services/siteService';
import { dailyReportService, DailyReport, DailyReportWorker } from '../../services/dailyReportService';
import { manpowerService, type Worker } from '../../services/manpowerService';
import { SupportRate, supportRateService } from '../../services/supportRateService';
import { teamExpenseLedgerService } from '../../services/teamExpenseLedgerService';
import {
    settlementTargetService,
    SettlementTarget,
    SettlementTargetType,
} from '../../services/settlementTargetService';
import {
    supportClientSiteAllocationService,
    SupportClientAllocation,
    SupportClientAllocationLine,
} from '../../services/supportClientSiteAllocationService';
import { estimateService, Estimate, EstimateItem } from '../../services/estimateService';
import { statementOutputService } from '../../services/statementOutputService';
import materialService from '../../services/materialService';
import type { TeamExpenseClaim } from '../../types/teamExpenseLedger';
import type { StatementOutputRecord, StatementOutputSource } from '../../types/statementOutput';
import type { Material } from '../../types/materials';
import { hexToRgba, normalizeHexColor } from '../../utils/color';
import {
    getLaborStatementWorkerPayType,
    getWorkerMasterLaborStatementPayType,
    loadLaborStatementPresetDefaults,
    loadStatementIssueOptionPreset,
    saveLaborStatementPresetDefaults,
    saveStatementIssueOptionPreset,
    STATEMENT_ISSUE_OPTION_PRESETS,
    type StatementIssueOptionPreset,
} from '../../utils/payrollLaborStatementDefaults';
import {
    createItem,
    DocumentType,
    EstimateDraft,
    getEmptyDraft,
    LOGO_FALLBACK,
} from '../../utils/estimateUtils';
import {
    AmountBarComponent,
    InfoTableComponent,
    TitleComponent,
} from '../../components/estimate/EstimateSharedComponents';
import { TransactionTable } from '../../components/estimate/TransactionTable';
import { RentalTransactionTable } from '../../components/estimate/RentalTransactionTable';
import { downloadEstimateExcel } from '../../utils/estimateExcelUtils';
import {
    calculateRentalLineAmount,
    generateRentalTransactionItems,
    isRentalRateInWorkType,
    mergeRentalRatesWithMaterials,
    RentalAmountBasis,
    RentalGenerationResult,
    RentalMaterialRate,
    RentalWorkType,
} from '../../utils/rentalTransactionGenerator';

export type SupportDirection = '외부지원간곳' | '외부지원온곳' | '본인현장출력';
type SupportStatementPayType = 'direct' | 'delegate';

export interface SupportClientSiteWorkerRow {
    rowId: string;
    reportId: string;
    date: string;
    direction: SupportDirection;
    workerId: string;
    workerName: string;
    workerIdNumber: string;
    workerAddress: string;
    workerContact: string;
    workerBankName: string;
    workerAccountNumber: string;
    workerAccountHolder: string;
    workerLaborStatementPayType?: SupportStatementPayType;
    role?: string;
    manDay: number;
    unitPrice: number;
    amount: number;
    siteId: string;
    siteName: string;
    siteAddress?: string;
    siteType: string;
    paymentType: string;
    clientCompanyId: string;
    clientCompanyName: string;
    constructorCompanyId: string;
    constructorCompanyName: string;
    sourceTeamId: string;
    sourceTeamName: string;
    workerTeamId: string;
    workerTeamName: string;
    responsibleTeamId: string;
    responsibleTeamName: string;
    responsibleTeamColor: string;
    responsibleTeamIcon: string;
    settlementName: string;
    counterpartyName: string;
    evidenceNote: string;
}

interface SupportTeamBadge {
    key: string;
    name: string;
    color: string;
    icon: string;
}

interface SupportSiteSummary {
    key: string;
    siteId: string;
    siteName: string;
    siteAddress?: string;
    siteTypes: string[];
    paymentTypes: string[];
    clientCompanyId: string;
    clientCompanyName: string;
    constructorCompanyId: string;
    constructorCompanyName: string;
    responsibleTeams: SupportTeamBadge[];
    responsibleTeamNames: string[];
    sourceTeamNames: string[];
    settlementNames: string[];
    directions: SupportDirection[];
    activeDates: string[];
    workerCount: number;
    totalManDay: number;
    totalAmount: number;
    avgUnitPrice: number;
    expenseClaimAmount: number;
    expenseClaimCount: number;
    expenseClaims: TeamExpenseClaim[];
    rows: SupportClientSiteWorkerRow[];
}

export interface SupportStatementTarget {
    title: string;
    subtitle?: string;
    rows: SupportClientSiteWorkerRow[];
    expenseClaims: TeamExpenseClaim[];
    billingRateBySiteKey?: Record<string, number>;
    billingRateByRowId?: Record<string, number>;
    transactionAmountOverride?: number;
    transactionItemLabel?: string;
    transactionItemNote?: string;
    transactionIncludeVat?: boolean;
    transactionVatRate?: number;
}

type SupportTransactionStatementDraft = EstimateDraft & {
    supportStatementKey?: string;
    supportStatementSource?: StatementOutputSource;
    supportStatementYearMonth?: string;
    supportStatementTargetTitle?: string;
    supportStatementTargetSubtitle?: string;
};
export type SupportTransactionStatementMode = 'standard' | 'rental';

interface SupportTransactionStatementOptionDefaults {
    includeVat?: boolean;
    vatRate?: number;
    paymentTerms?: string;
    notes?: string;
    rentalAmountBasis?: RentalAmountBasis;
    rentalUsageDays?: number;
    rentalRowCount?: number;
    rentalWorkType?: RentalWorkType;
}

interface SupportClientLaborStatementRow {
    key: string;
    workerId: string;
    workerName: string;
    idNumber: string;
    address: string;
    contact: string;
    teamNames: string[];
    payType: SupportStatementPayType;
    bankName: string;
    accountNumber: string;
    accountHolder: string;
    days: number[];
    totalManDay: number;
    unitPrice: number;
    totalAmount: number;
}

interface SupportClientLaborStatementOptions {
    unitPriceOverride: number;
    defaultPayType: SupportStatementPayType;
    workerPayTypes: Record<string, SupportStatementPayType>;
    delegateBankName: string;
    delegateAccountHolder: string;
    delegateAccountNumber: string;
}

interface SupportClientLaborStatementViewOptions {
    showBankColumn: boolean;
    showBillingColumns: boolean;
    isSplitView: boolean;
    showBankUnderAddress: boolean;
    showTeamUnderName: boolean;
}

interface SupportClientLaborSitePreview {
    key: string;
    siteName: string;
    clientCompanyName: string;
    siteType: string;
    paymentType: string;
    sourceTeamNames: string;
    responsibleTeamNames: string;
    rows: SupportClientLaborStatementRow[];
    totalManDay: number;
    totalAmount: number;
}

interface SupportResponsibleTeamSummary {
    key: string;
    team: SupportTeamBadge;
    siteCount: number;
    workerCount: number;
    totalManDay: number;
    totalAmount: number;
    avgUnitPrice: number;
    directions: SupportDirection[];
    activeDates: string[];
    sourceTeamNames: string[];
    settlementNames: string[];
    sites: SupportSiteSummary[];
    rows: SupportClientSiteWorkerRow[];
}

interface SupportClientSummary {
    key: string;
    clientCompanyId: string;
    clientCompanyName: string;
    siteCount: number;
    workerCount: number;
    totalManDay: number;
    totalAmount: number;
    directions: SupportDirection[];
    sites: SupportSiteSummary[];
}

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

interface SupportClientAllocationModalTarget {
    site: SupportSiteSummary;
    issuedAmount: number;
    settlementAmount: number;
    distributableAmount: number;
    vatAmount: number;
    allocation?: SupportClientAllocation;
}

interface SiteAllocationMetrics {
    issuedAmount: number;
    settlementAmount: number;
    distributableAmount: number;
    allocatedAmount: number;
    unallocatedAmount: number;
    vatAmount: number;
    isOverAllocated: boolean;
}

const DEFAULT_SUPPORT_UNIT_PRICE = 230000;
const EXTERNAL_CLIENT_GROUP_ID = 'external-client-group';
const EXTERNAL_CLIENT_GROUP_NAME = '외부팀';
const EXTERNAL_CLIENT_GROUP_LEGACY_DISPLAY_NAME = '외부지원간곳';
const EXTERNAL_CLIENT_GROUP_DISPLAY_NAME = '지원현장';
const STANDARD_CLIENT_GROUP_DISPLAY_NAME = '도급 직영 현장';
const OWN_SITE_OUTPUT_LABEL = '본인현장출력';
const SUPPORT_DIRECTION_ORDER: SupportDirection[] = ['외부지원간곳', '외부지원온곳', OWN_SITE_OUTPUT_LABEL];
const DIRECTION_META: Record<SupportDirection, { label: string; badgeClass: string; rowClass: string }> = {
    외부지원간곳: {
        label: EXTERNAL_CLIENT_GROUP_DISPLAY_NAME,
        badgeClass: 'border-yellow-200 bg-yellow-100 text-yellow-800',
        rowClass: 'bg-yellow-50 text-yellow-900'
    },
    외부지원온곳: {
        label: '외부지원온곳',
        badgeClass: 'border-orange-200 bg-orange-100 text-orange-800',
        rowClass: 'bg-orange-50 text-orange-900'
    },
    본인현장출력: {
        label: OWN_SITE_OUTPUT_LABEL,
        badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        rowClass: 'bg-emerald-50 text-emerald-900'
    }
};

const DIRECTION_OPTIONS: Array<{ id: 'all' | SupportDirection; label: string }> = [
    { id: 'all', label: '전체 구분' },
    ...SUPPORT_DIRECTION_ORDER
        .filter((direction) => direction !== '외부지원간곳')
        .map((direction) => ({ id: direction, label: DIRECTION_META[direction].label }))
];

const normalize = (value: unknown): string => String(value ?? '').replace(/\s+/g, '').trim();
const normalizeName = (value: unknown): string =>
    String(value ?? '').replace(/\(.*?\)/g, '').replace(/\s+/g, '').trim();
const normalizeTeamComparisonName = (value: unknown): string =>
    normalizeName(value).replace(/(?:현장담당|작업|지원)?팀$/g, '');

const formatNumber = (value: number): string => new Intl.NumberFormat('ko-KR').format(Math.round(value || 0));

const formatCurrencyInputValue = (value?: string): string => {
    const amount = parseCurrencyAmount(value);
    return amount > 0 ? formatNumber(amount) : '';
};

const formatManDay = (value: number): string => {
    const fixed = Number((value || 0).toFixed(1));
    return fixed % 1 === 0 ? fixed.toFixed(0) : fixed.toFixed(1);
};

const formatStatementDayManDay = (value: number): string => {
    const fixed = Number((value || 0).toFixed(1));
    return fixed === 0 ? '' : formatManDay(value);
};

const formatCurrencyText = (value: number): string => `${formatNumber(Math.round(value || 0))}원`;
const formatManDayText = (value: number): string => `${formatManDay(value || 0)}공수`;

const formatFullIdNumber = (value?: string | null): string => {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    const digits = raw.replace(/[^0-9]/g, '');
    if (digits.length === 13) return `${digits.slice(0, 6)}-${digits.slice(6)}`;
    return raw;
};

const getCurrentYearMonth = (): string => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
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

const ISSUED_AMOUNT_STORAGE_PREFIX = 'support-client-site-issued-amounts';
const SETTLEMENT_AMOUNT_STORAGE_PREFIX = 'support-client-site-settlement-amounts';
const ROW_NOTE_STORAGE_PREFIX = 'support-client-site-row-notes';
const PROGRESS_STATUS_STORAGE_PREFIX = 'support-client-site-progress-statuses';
const BILLING_RATE_STORAGE_PREFIX = 'support-client-site-billing-rates';
const TRANSACTION_STATEMENT_OPTION_STORAGE_PREFIX = 'support-client-transaction-statement-options-v1';
const SUPPORT_CLIENT_TAX_INVOICE_VAT_RATE = 0.1;
const SUPPORT_PROGRESS_OPTIONS: SupportProgressOption[] = [
    { value: 'depositComplete', label: '입금 완료', color: '#ffc000', rowColor: '#ffc000' },
    { value: 'dawinIssued', label: '다윈 발행', color: '#00b0f0', rowColor: '#00b0f0' },
    { value: 'cheongyeonIssued', label: '청연 발행', color: '#ffff00', rowColor: '#ffff00' },
    { value: 'laborProcessed', label: '노무 처리', color: '#00b050', rowColor: '#00b050' },
    { value: 'issueRequested', label: '발행 요청', color: '#ff00ff', rowColor: '#ff00ff' }
];

const SETTLEMENT_TARGET_TYPE_OPTIONS: Array<{ value: SettlementTargetType; label: string }> = [
    { value: 'office_income', label: '사무실 수입' },
    { value: 'rental_company', label: '임대사' },
    { value: 'client_company', label: '발주사' },
    { value: 'client_contact', label: '관계자' },
    { value: 'other', label: '기타' },
];

const ALLOCATION_LINE_STATUS_OPTIONS: Array<{ value: SupportClientAllocationLine['status']; label: string }> = [
    { value: 'confirmed', label: '확정' },
    { value: 'payment_pending', label: '지급예정' },
    { value: 'received', label: '입금완료' },
];

const getIssuedAmountStorageKey = (yearMonth: string): string =>
    `${ISSUED_AMOUNT_STORAGE_PREFIX}:${yearMonth || 'unknown-month'}`;

const getSettlementAmountStorageKey = (yearMonth: string): string =>
    `${SETTLEMENT_AMOUNT_STORAGE_PREFIX}:${yearMonth || 'unknown-month'}`;

const getRowNoteStorageKey = (yearMonth: string): string =>
    `${ROW_NOTE_STORAGE_PREFIX}:${yearMonth || 'unknown-month'}`;

const getProgressStatusStorageKey = (yearMonth: string): string =>
    `${PROGRESS_STATUS_STORAGE_PREFIX}:${yearMonth || 'unknown-month'}`;

const getBillingRateStorageKey = (yearMonth: string): string =>
    `${BILLING_RATE_STORAGE_PREFIX}:${yearMonth || 'unknown-month'}`;

const isSupportProgressStatus = (value: unknown): value is SupportProgressStatus =>
    value === '' || SUPPORT_PROGRESS_OPTIONS.some((option) => option.value === value);

const getSupportProgressOption = (value: SupportProgressStatus | undefined): SupportProgressOption | undefined =>
    SUPPORT_PROGRESS_OPTIONS.find((option) => option.value === value);

const getSupportProgressLabel = (value: SupportProgressStatus | undefined): string =>
    getSupportProgressOption(value)?.label || '';

const parseCurrencyAmount = (value?: string): number => {
    const parsed = Number(String(value ?? '').replace(/[^0-9]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeCurrencyAmountInput = (value: string): string =>
    value.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');

const parseIssuedAmount = parseCurrencyAmount;
const parseSettlementAmount = parseCurrencyAmount;
const parseBillingRate = parseCurrencyAmount;
const normalizeIssuedAmountInput = normalizeCurrencyAmountInput;
const normalizeSettlementAmountInput = normalizeCurrencyAmountInput;
const normalizeBillingRateInput = normalizeCurrencyAmountInput;

const getTransactionStatementOptionStorageKey = (
    mode: SupportTransactionStatementMode,
    preset: StatementIssueOptionPreset
): string => `${TRANSACTION_STATEMENT_OPTION_STORAGE_PREFIX}:${mode}:${preset}`;

const isRentalAmountBasis = (value: unknown): value is RentalAmountBasis =>
    value === 'supply' || value === 'total';

const isRentalWorkType = (value: unknown): value is RentalWorkType =>
    value === 'shoring' || value === 'scaffold';

const cleanPositiveInteger = (value: unknown): number | undefined => {
    const parsed = typeof value === 'number' ? value : Number(String(value ?? '').replace(/[^0-9]/g, ''));
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : undefined;
};

const normalizeSupportTransactionStatementOptions = (
    value: unknown
): SupportTransactionStatementOptionDefaults => {
    const raw = value && typeof value === 'object' && !Array.isArray(value)
        ? value as Partial<SupportTransactionStatementOptionDefaults>
        : {};
    const vatRate = cleanPositiveInteger(raw.vatRate);
    const rentalUsageDays = cleanPositiveInteger(raw.rentalUsageDays);
    const rentalRowCount = cleanPositiveInteger(raw.rentalRowCount);

    return {
        ...(typeof raw.includeVat === 'boolean' ? { includeVat: raw.includeVat } : {}),
        ...(vatRate ? { vatRate } : {}),
        ...(typeof raw.paymentTerms === 'string' ? { paymentTerms: raw.paymentTerms } : {}),
        ...(typeof raw.notes === 'string' ? { notes: raw.notes } : {}),
        ...(isRentalAmountBasis(raw.rentalAmountBasis) ? { rentalAmountBasis: raw.rentalAmountBasis } : {}),
        ...(rentalUsageDays ? { rentalUsageDays } : {}),
        ...(rentalRowCount ? { rentalRowCount } : {}),
        ...(isRentalWorkType(raw.rentalWorkType) ? { rentalWorkType: raw.rentalWorkType } : {}),
    };
};

const loadSupportTransactionStatementOptions = (
    mode: SupportTransactionStatementMode,
    preset: StatementIssueOptionPreset
): SupportTransactionStatementOptionDefaults => {
    if (typeof window === 'undefined') return {};

    try {
        const raw = window.localStorage.getItem(getTransactionStatementOptionStorageKey(mode, preset));
        return raw ? normalizeSupportTransactionStatementOptions(JSON.parse(raw)) : {};
    } catch (error) {
        console.warn('[SupportClientSitePage] transaction statement option load failed:', error);
        return {};
    }
};

const saveSupportTransactionStatementOptions = (
    mode: SupportTransactionStatementMode,
    preset: StatementIssueOptionPreset,
    options: SupportTransactionStatementOptionDefaults
): void => {
    if (typeof window === 'undefined') return;

    try {
        window.localStorage.setItem(
            getTransactionStatementOptionStorageKey(mode, preset),
            JSON.stringify(normalizeSupportTransactionStatementOptions(options))
        );
        saveStatementIssueOptionPreset(preset);
    } catch (error) {
        console.warn('[SupportClientSitePage] transaction statement option save failed:', error);
    }
};

const applySupportTransactionStatementOptions = (
    draft: SupportTransactionStatementDraft,
    options: SupportTransactionStatementOptionDefaults
): SupportTransactionStatementDraft => ({
    ...draft,
    ...(typeof options.includeVat === 'boolean' ? { includeVat: options.includeVat } : {}),
    ...(options.vatRate ? { vatRate: options.vatRate } : {}),
    ...(options.paymentTerms !== undefined ? { paymentTerms: options.paymentTerms } : {}),
    ...(options.notes !== undefined ? { notes: options.notes } : {}),
});


const normalizeAllocationTargetType = (value?: SettlementTargetType | string | null): SettlementTargetType =>
    SETTLEMENT_TARGET_TYPE_OPTIONS.some((option) => option.value === value) ? value as SettlementTargetType : 'other';

const createAllocationLineId = (): string =>
    `allocation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const normalizeAllocationLineAmountInput = normalizeCurrencyAmountInput;

const getAllocationStatus = (distributableAmount: number, allocatedAmount: number): SupportClientAllocation['status'] => {
    if (allocatedAmount <= 0) return 'draft';
    if (allocatedAmount > distributableAmount) return 'over';
    if (allocatedAmount === distributableAmount) return 'balanced';
    return 'partial';
};

const loadIssuedAmounts = (yearMonth: string): Record<string, string> => {
    if (typeof window === 'undefined') return {};
    try {
        const raw = window.localStorage.getItem(getIssuedAmountStorageKey(yearMonth));
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
        return Object.fromEntries(
            Object.entries(parsed)
                .map(([key, value]) => [key, normalizeIssuedAmountInput(String(value ?? ''))])
                .filter(([, value]) => value)
        );
    } catch (error) {
        console.warn('[SupportClientSitePage] issued amount load failed:', error);
        return {};
    }
};

const loadSettlementAmounts = (yearMonth: string): Record<string, string> => {
    if (typeof window === 'undefined') return {};
    try {
        const raw = window.localStorage.getItem(getSettlementAmountStorageKey(yearMonth));
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
        return Object.fromEntries(
            Object.entries(parsed)
                .map(([key, value]) => [key, normalizeSettlementAmountInput(String(value ?? ''))])
                .filter(([, value]) => value)
        );
    } catch (error) {
        console.warn('[SupportClientSitePage] settlement amount load failed:', error);
        return {};
    }
};

const loadRowNotes = (yearMonth: string): Record<string, string> => {
    if (typeof window === 'undefined') return {};
    try {
        const raw = window.localStorage.getItem(getRowNoteStorageKey(yearMonth));
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
        return Object.fromEntries(
            Object.entries(parsed)
                .map(([key, value]) => [key, String(value ?? '')])
                .filter(([, value]) => value.trim())
        );
    } catch (error) {
        console.warn('[SupportClientSitePage] row note load failed:', error);
        return {};
    }
};

const loadProgressStatuses = (yearMonth: string): Record<string, SupportProgressStatus> => {
    if (typeof window === 'undefined') return {};
    try {
        const raw = window.localStorage.getItem(getProgressStatusStorageKey(yearMonth));
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
        return Object.fromEntries(
            Object.entries(parsed)
                .map(([key, value]) => [key, isSupportProgressStatus(value) ? value : ''])
                .filter(([, value]) => value)
        ) as Record<string, SupportProgressStatus>;
    } catch (error) {
        console.warn('[SupportClientSitePage] progress status load failed:', error);
        return {};
    }
};

const loadBillingRates = (yearMonth: string): Record<string, string> => {
    if (typeof window === 'undefined') return {};
    try {
        const raw = window.localStorage.getItem(getBillingRateStorageKey(yearMonth));
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
        return Object.fromEntries(
            Object.entries(parsed)
                .map(([key, value]) => [key, normalizeBillingRateInput(String(value ?? ''))])
                .filter(([, value]) => value)
        );
    } catch (error) {
        console.warn('[SupportClientSitePage] billing rate load failed:', error);
        return {};
    }
};

const toPositiveRate = (value: unknown): number | null => {
    const parsed = typeof value === 'number'
        ? value
        : typeof value === 'string'
            ? Number(value.replace(/,/g, ''))
            : NaN;
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return Math.round(parsed);
};

const getIdentityKey = (id: unknown, name: unknown, fallback: string): string =>
    normalize(id) || normalizeName(name) || fallback;

const uniqueValues = (values: Array<string | undefined | null>): string[] => {
    const seen = new Set<string>();
    values.forEach((value) => {
        const trimmed = String(value ?? '').trim();
        if (trimmed) seen.add(trimmed);
    });
    return Array.from(seen);
};

const summarizeNames = (values: Array<string | undefined | null>, fallback = '-'): string => {
    const unique = uniqueValues(values);
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
    site: Pick<SupportSiteSummary, 'siteId' | 'siteName'>
): boolean => (
    isSameIdentity(claim.siteId, site.siteId) ||
    (!!normalizeName(claim.siteName) && normalizeName(claim.siteName) === normalizeName(site.siteName))
);

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

const getSupportLaborStatementWorkerKey = (
    row: Pick<SupportClientSiteWorkerRow, 'workerId' | 'siteId' | 'workerName'>
): string => row.workerId || `${row.siteId}:${row.workerName}`;

const buildSupportWorkerPayTypesFromDefaults = (
    rows: SupportClientSiteWorkerRow[],
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

const buildSupportClientLaborPreviews = (
    rows: SupportClientSiteWorkerRow[],
    billingRateBySiteKey: Record<string, number> = {},
    billingRateByRowId: Record<string, number> = {},
    options?: SupportClientLaborStatementOptions
): SupportClientLaborSitePreview[] => {
    const statementOptions = options ?? {
        unitPriceOverride: 0,
        defaultPayType: 'direct' as SupportStatementPayType,
        workerPayTypes: {},
        delegateBankName: '',
        delegateAccountHolder: '',
        delegateAccountNumber: ''
    };
    const siteMap = new Map<string, {
        siteName: string;
        clientCompanyName: string;
        siteType: string;
        paymentType: string;
        sourceTeamNames: string[];
        responsibleTeamNames: string[];
        workerMap: Map<string, SupportClientLaborStatementRow>;
    }>();

    rows.forEach((row) => {
        const siteKey = `${clientKeyForRow(row)}::${siteKeyForRow(row)}`;
        if (!siteMap.has(siteKey)) {
            siteMap.set(siteKey, {
                siteName: row.siteName || '현장 미지정',
                clientCompanyName: getClientCompanyName(row),
                siteType: row.siteType,
                paymentType: row.paymentType,
                sourceTeamNames: [],
                responsibleTeamNames: [],
                workerMap: new Map<string, SupportClientLaborStatementRow>()
            });
        }

        const siteGroup = siteMap.get(siteKey)!;
        siteGroup.siteType = siteGroup.siteType || row.siteType;
        siteGroup.paymentType = siteGroup.paymentType || row.paymentType;
        const sourceTeamName = getSourceTeamDisplayName(row);
        siteGroup.sourceTeamNames.push(sourceTeamName);
        siteGroup.responsibleTeamNames.push(row.responsibleTeamName);

        const configuredBillingUnitPrice = Math.max(0, Math.round(billingRateByRowId[row.rowId] || billingRateBySiteKey[siteKey] || row.unitPrice || 0));
        const billingUnitPrice = statementOptions.unitPriceOverride > 0
            ? statementOptions.unitPriceOverride
            : configuredBillingUnitPrice;
        const billingAmount = calculateSupportClientBillingAmount(row.manDay, billingUnitPrice);
        const workerKey = getSupportLaborStatementWorkerKey(row);
        const payType = statementOptions.workerPayTypes[workerKey] ?? statementOptions.defaultPayType;
        const useDelegateAccount = payType === 'delegate';
        if (!siteGroup.workerMap.has(workerKey)) {
            siteGroup.workerMap.set(workerKey, {
                key: workerKey,
                workerId: workerKey,
                workerName: row.workerName || '이름 미상',
                idNumber: row.workerIdNumber || '',
                address: row.workerAddress || '',
                contact: row.workerContact || '',
                teamNames: [],
                payType,
                bankName: useDelegateAccount ? statementOptions.delegateBankName : row.workerBankName,
                accountNumber: useDelegateAccount ? statementOptions.delegateAccountNumber : row.workerAccountNumber,
                accountHolder: useDelegateAccount ? statementOptions.delegateAccountHolder : row.workerAccountHolder,
                days: Array.from({ length: MAX_DAY_COLUMNS }, () => 0),
                totalManDay: 0,
                unitPrice: billingUnitPrice,
                totalAmount: 0
            });
        }

        const workerRow = siteGroup.workerMap.get(workerKey)!;
        workerRow.teamNames = uniqueValues([...workerRow.teamNames, row.workerTeamName, sourceTeamName]);
        workerRow.payType = payType;
        if (useDelegateAccount) {
            workerRow.bankName = statementOptions.delegateBankName;
            workerRow.accountNumber = statementOptions.delegateAccountNumber;
            workerRow.accountHolder = statementOptions.delegateAccountHolder;
        } else {
            workerRow.bankName = workerRow.bankName || row.workerBankName;
            workerRow.accountNumber = workerRow.accountNumber || row.workerAccountNumber;
            workerRow.accountHolder = workerRow.accountHolder || row.workerAccountHolder;
        }
        const day = new Date(row.date).getDate();
        if (day >= 1 && day <= MAX_DAY_COLUMNS) workerRow.days[day - 1] += row.manDay;
        workerRow.totalManDay += row.manDay;
        workerRow.totalAmount += billingAmount;
        workerRow.unitPrice = workerRow.totalManDay > 0
            ? Math.round(workerRow.totalAmount / workerRow.totalManDay)
            : billingUnitPrice;
    });

    return Array.from(siteMap.entries())
        .map(([key, siteGroup]) => {
            const laborRows = Array.from(siteGroup.workerMap.values()).sort((a, b) =>
                a.workerName.localeCompare(b.workerName, 'ko-KR')
            );
            const totalManDay = laborRows.reduce((sum, row) => sum + row.totalManDay, 0);
            const totalAmount = laborRows.reduce((sum, row) => sum + row.totalAmount, 0);

            return {
                key,
                siteName: siteGroup.siteName,
                clientCompanyName: siteGroup.clientCompanyName,
                siteType: siteGroup.siteType,
                paymentType: siteGroup.paymentType,
                sourceTeamNames: summarizeNames(siteGroup.sourceTeamNames),
                responsibleTeamNames: summarizeNames(siteGroup.responsibleTeamNames),
                rows: laborRows,
                totalManDay,
                totalAmount
            };
        })
        .sort((a, b) => b.totalAmount - a.totalAmount || a.siteName.localeCompare(b.siteName, 'ko-KR'));
};

const buildSupportClientLaborStatementText = (
    target: SupportStatementTarget,
    previews: SupportClientLaborSitePreview[],
    yearMonth: string
): string => {
    const totalManDay = previews.reduce((sum, preview) => sum + preview.totalManDay, 0);
    const totalAmount = previews.reduce((sum, preview) => sum + preview.totalAmount, 0);
    const lines = [
        `[노임명세서] ${yearMonth}`,
        `대상: ${target.title}`,
        target.subtitle ? `분류: ${target.subtitle}` : '',
        `현장수: ${previews.length}개`,
        `총공수: ${formatManDayText(totalManDay)}`,
        `청구합계: ${formatCurrencyText(totalAmount)}`,
        '',
        '[현장별 내역]'
    ].filter(Boolean);

    previews.forEach((preview, index) => {
        lines.push(`${index + 1}. ${preview.siteName}`);
        lines.push(`   공수 ${formatManDayText(preview.totalManDay)} / 청구금액 ${formatCurrencyText(preview.totalAmount)}`);
        preview.rows.forEach((row) => {
            lines.push(`   - ${row.workerName}: 청구 ${formatManDayText(row.totalManDay)} x ${formatCurrencyText(row.unitPrice)} = ${formatCurrencyText(row.totalAmount)}`);
        });
    });

    return lines.join('\n');
};

type OwnSiteOutputComparableRow = Pick<
    SupportClientSiteWorkerRow,
    'sourceTeamId' | 'sourceTeamName' | 'responsibleTeamId' | 'responsibleTeamName'
> & Partial<Pick<SupportClientSiteWorkerRow, 'workerTeamId' | 'workerTeamName' | 'direction'>>;

const isOwnSiteOutputDirection = (row: OwnSiteOutputComparableRow): boolean =>
    row.direction === OWN_SITE_OUTPUT_LABEL;

const isOwnSiteOutputRow = (
    row: OwnSiteOutputComparableRow
): boolean => {
    if (row.direction) return isOwnSiteOutputDirection(row);

    const sourceTeamId = normalize(row.sourceTeamId);
    const responsibleTeamId = normalize(row.responsibleTeamId);
    const sourceTeamName = normalizeTeamComparisonName(row.sourceTeamName);
    const responsibleTeamName = normalizeTeamComparisonName(row.responsibleTeamName);
    const workerTeamId = normalize(row.workerTeamId);
    const workerTeamName = normalizeTeamComparisonName(row.workerTeamName);

    const sourceMatchesResponsible =
        (sourceTeamId && responsibleTeamId && sourceTeamId === responsibleTeamId) ||
        (sourceTeamName && responsibleTeamName && sourceTeamName === responsibleTeamName);

    const workerMatchesResponsible =
        (workerTeamId && responsibleTeamId && workerTeamId === responsibleTeamId) ||
        (workerTeamName && responsibleTeamName && workerTeamName === responsibleTeamName);

    return Boolean(sourceMatchesResponsible || workerMatchesResponsible);
};

const getSourceTeamDisplayName = (
    row: OwnSiteOutputComparableRow
): string => String(row.sourceTeamName || row.workerTeamName || '').trim();

const summarizeSourceTeamDisplayNames = (rows: SupportClientSiteWorkerRow[], fallback = '-'): string =>
    summarizeNames(rows.map((row) => getSourceTeamDisplayName(row)), fallback);

const getDirectionDisplayName = (direction: SupportDirection): string =>
    DIRECTION_META[direction]?.label ?? direction;

const getOutputTypeDisplayName = (row: SupportClientSiteWorkerRow): string =>
    isOwnSiteOutputRow(row) ? OWN_SITE_OUTPUT_LABEL : getDirectionDisplayName(row.direction);

const summarizeOutputTypeDisplayNames = (rows: SupportClientSiteWorkerRow[], fallback = '-'): string =>
    summarizeNames(rows.map((row) => getOutputTypeDisplayName(row)), fallback);

const uniqueResponsibleTeams = (rows: SupportClientSiteWorkerRow[]): SupportTeamBadge[] => {
    const map = new Map<string, SupportTeamBadge>();

    rows.forEach((row) => {
        const name = String(row.responsibleTeamName || '').trim();
        if (!name) return;

        const key = normalize(row.responsibleTeamId) || normalizeName(name) || name;
        if (map.has(key)) return;

        map.set(key, {
            key,
            name,
            color: normalizeHexColor(row.responsibleTeamColor),
            icon: row.responsibleTeamIcon || 'fa-users'
        });
    });

    return Array.from(map.values());
};

const getPrimaryResponsibleTeam = (site: SupportSiteSummary): SupportTeamBadge => {
    const existing = site.responsibleTeams[0];
    if (existing) return existing;

    const row = site.rows[0];
    const name = String(row?.responsibleTeamName || '현장담당팀 미지정').trim();
    const key = normalize(row?.responsibleTeamId) || normalizeName(name) || `${site.key}:responsible-team`;
    return {
        key,
        name,
        color: normalizeHexColor(row?.responsibleTeamColor),
        icon: row?.responsibleTeamIcon || 'fa-users'
    };
};

const groupSitesByResponsibleTeam = (sites: SupportSiteSummary[]): SupportResponsibleTeamSummary[] => {
    const groupMap = new Map<string, { team: SupportTeamBadge; sites: SupportSiteSummary[] }>();

    sites.forEach((site) => {
        const team = getPrimaryResponsibleTeam(site);
        const key = team.key || normalizeName(team.name) || `${site.key}:responsible-team`;
        if (!groupMap.has(key)) {
            groupMap.set(key, { team: { ...team, key }, sites: [] });
        }
        groupMap.get(key)!.sites.push(site);
    });

    return Array.from(groupMap.values())
        .map((group) => {
            const rows = group.sites.flatMap((site) => site.rows);
            const totalManDay = group.sites.reduce((sum, site) => sum + site.totalManDay, 0);
            const totalAmount = group.sites.reduce((sum, site) => sum + site.totalAmount, 0);
            const workerKeys = new Set(rows.map((row) => row.workerId || row.workerName));

            return {
                key: group.team.key,
                team: group.team,
                siteCount: group.sites.length,
                workerCount: workerKeys.size,
                totalManDay,
                totalAmount,
                avgUnitPrice: totalManDay > 0 ? Math.round(totalAmount / totalManDay) : 0,
                directions: uniqueValues(rows.map((row) => row.direction)) as SupportDirection[],
                activeDates: uniqueValues(rows.map((row) => row.date)).sort(),
                sourceTeamNames: uniqueValues(rows.map((row) => row.sourceTeamName)),
                settlementNames: uniqueValues(rows.map((row) => row.settlementName)),
                sites: group.sites,
                rows
            };
        })
        .sort((a, b) => b.totalAmount - a.totalAmount || a.team.name.localeCompare(b.team.name, 'ko-KR'));
};

const isExternalClientSummary = (client: Pick<SupportClientSummary, 'clientCompanyId' | 'clientCompanyName'>): boolean =>
    client.clientCompanyId === EXTERNAL_CLIENT_GROUP_ID ||
    client.clientCompanyName === EXTERNAL_CLIENT_GROUP_NAME ||
    client.clientCompanyName === EXTERNAL_CLIENT_GROUP_LEGACY_DISPLAY_NAME ||
    client.clientCompanyName === EXTERNAL_CLIENT_GROUP_DISPLAY_NAME;

const claimMatchesSiteSettlement = (claim: TeamExpenseClaim, site: SupportSiteSummary): boolean =>
    site.rows.some((row) => {
        if (row.direction.endsWith('간곳')) {
            return matchesTeamReference(claim.chargeToTeamId, claim.chargeToTeamName, row.responsibleTeamId, row.responsibleTeamName);
        }
        return matchesTeamReference(claim.payerTeamId, claim.payerTeamName, row.sourceTeamId, row.sourceTeamName);
    });

const applyExpenseClaimsToClientGroups = (
    clients: SupportClientSummary[],
    claims: TeamExpenseClaim[]
): SupportClientSummary[] => {
    const postedClaims = claims.filter(isPostedTeamChargeClaim);

    return clients.map((client) => ({
        ...client,
        sites: client.sites.map((site) => {
            const expenseClaims = dedupeExpenseClaims(postedClaims.filter((claim) =>
                matchesSiteReference(claim, site) && claimMatchesSiteSettlement(claim, site)
            ));
            const expenseClaimAmount = getExpenseClaimsTotal(expenseClaims);

            return {
                ...site,
                expenseClaims,
                expenseClaimAmount,
                expenseClaimCount: expenseClaims.length
            };
        })
    }));
};

const getSiteExpenseClaims = (site: SupportSiteSummary): TeamExpenseClaim[] =>
    dedupeExpenseClaims(site.expenseClaims ?? []);

const getSitesExpenseClaims = (sites: SupportSiteSummary[]): TeamExpenseClaim[] =>
    dedupeExpenseClaims(sites.flatMap((site) => getSiteExpenseClaims(site)));

const normalizePaymentMethodForVat = (value?: string | null): string => {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    if (raw.includes('계산서')) return '계산서';
    if (raw.includes('노무')) return '노무';
    return raw;
};

const isTaxInvoicePaymentMethod = (value?: string | null): boolean =>
    normalizePaymentMethodForVat(value) === '계산서';

const isTaxInvoiceSite = (site: SupportSiteSummary): boolean =>
    site.paymentTypes.some((paymentType) => isTaxInvoicePaymentMethod(paymentType));

const getSiteIssuedSupplyAmount = (site: SupportSiteSummary): number =>
    Math.max(0, Math.round(site.totalAmount || 0));

const getVatAmountToAdd = (supplyAmount: number): number =>
    Math.round(Math.max(0, Math.round(supplyAmount || 0)) * SUPPORT_CLIENT_TAX_INVOICE_VAT_RATE);

const getIncludedVatAmount = (grossAmount: number): number => {
    const normalizedGrossAmount = Math.max(0, Math.round(grossAmount || 0));
    if (normalizedGrossAmount <= 0) return 0;
    const supplyAmount = Math.round(normalizedGrossAmount / (1 + SUPPORT_CLIENT_TAX_INVOICE_VAT_RATE));
    return Math.max(0, normalizedGrossAmount - supplyAmount);
};

const getSiteDefaultVatAmount = (site: SupportSiteSummary, supplyAmount = getSiteIssuedSupplyAmount(site)): number =>
    isTaxInvoiceSite(site) ? getVatAmountToAdd(supplyAmount) : 0;

const getSiteVatAmount = (site: SupportSiteSummary, issuedAmount?: number, supplyAmount = getSiteIssuedSupplyAmount(site)): number => {
    if (!isTaxInvoiceSite(site)) return 0;
    if (issuedAmount === undefined) return getSiteDefaultVatAmount(site, supplyAmount);
    return getIncludedVatAmount(issuedAmount);
};

const getSiteDefaultIssuedAmount = (site: SupportSiteSummary, supplyAmount = getSiteIssuedSupplyAmount(site)): number =>
    isTaxInvoiceSite(site) ? supplyAmount + getSiteDefaultVatAmount(site, supplyAmount) : supplyAmount;

const calculateSupportClientBillingAmount = (manDay: number, billingUnitPrice: number): number =>
    Math.round(Math.max(0, manDay || 0) * Math.max(0, Math.round(billingUnitPrice || 0)));

const sanitizeFileNamePart = (value: string): string =>
    (value || '미지정').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim();

const waitForDocumentFonts = async (): Promise<void> => {
    try {
        const fontSet = (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts;
        if (fontSet?.ready) await fontSet.ready;
    } catch (error) {
        console.warn('[SupportClientSitePage] font readiness check failed:', error);
    }
};

const getCaptureScale = (width: number, height: number): number => {
    const baseScale = Math.max(2, window.devicePixelRatio || 1);
    const maxCanvasArea = 18000000;
    const area = Math.max(1, width * height);
    if (area * baseScale * baseScale <= maxCanvasArea) return baseScale;
    return Math.max(1, Math.sqrt(maxCanvasArea / area));
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

type ClipboardImageItemCtor = new (items: Record<string, Blob | Promise<Blob>>) => ClipboardItem;

const getClipboardImageWriter = (): {
    ClipboardItemCtor?: ClipboardImageItemCtor;
    clipboard?: Clipboard & { write?: (data: ClipboardItem[]) => Promise<void> };
} => ({
    ClipboardItemCtor: (window as unknown as {
        ClipboardItem?: ClipboardImageItemCtor;
    }).ClipboardItem,
    clipboard: navigator.clipboard as Clipboard & {
        write?: (data: ClipboardItem[]) => Promise<void>;
    }
});

const escapeHtmlAttribute = (value: string): string =>
    value.replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char] ?? char));

const copyPngBlobBySelection = async (blob: Blob, altText: string, clipboardError: unknown = null): Promise<void> => {
    const safeAltText = escapeHtmlAttribute(altText);
    const dataUrl = await blobToDataUrl(blob);
    const fallbackFile = new File([blob], `${safeAltText || 'statement'}.png`, { type: 'image/png' });
    const wrapper = document.createElement('div');
    wrapper.contentEditable = 'true';
    wrapper.style.position = 'fixed';
    wrapper.style.left = '0';
    wrapper.style.top = '0';
    wrapper.style.zIndex = '-1';
    wrapper.style.opacity = '0';
    wrapper.style.pointerEvents = 'none';
    wrapper.style.overflow = 'visible';
    wrapper.innerHTML = `<img src="${dataUrl}" alt="${safeAltText}" />`;
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
        event.clipboardData?.setData('text/html', `<img src="${dataUrl}" alt="${safeAltText}" />`);
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

const copyPngBlobToClipboard = async (blob: Blob, altText = '명세서'): Promise<void> => {
    const { ClipboardItemCtor, clipboard } = getClipboardImageWriter();

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

    await copyPngBlobBySelection(blob, altText, clipboardError);
};

const COPY_STYLE_PROPERTIES = [
    'backgroundColor',
    'borderBottom',
    'borderCollapse',
    'borderLeft',
    'borderRight',
    'borderTop',
    'color',
    'display',
    'fontFamily',
    'fontSize',
    'fontWeight',
    'height',
    'lineHeight',
    'minWidth',
    'paddingBottom',
    'paddingLeft',
    'paddingRight',
    'paddingTop',
    'textAlign',
    'textDecoration',
    'verticalAlign',
    'whiteSpace',
    'width'
] as const;

const inlineComputedStyles = (source: HTMLElement, target: HTMLElement): void => {
    const sourceElements = [source, ...Array.from(source.querySelectorAll<HTMLElement>('*'))];
    const targetElements = [target, ...Array.from(target.querySelectorAll<HTMLElement>('*'))];

    sourceElements.forEach((sourceElement, index) => {
        const targetElement = targetElements[index];
        if (!targetElement) return;

        const computed = window.getComputedStyle(sourceElement);
        COPY_STYLE_PROPERTIES.forEach((property) => {
            targetElement.style[property] = computed[property];
        });
    });
};

const copyElementHtmlToClipboard = (node: HTMLElement): boolean => {
    const clone = node.cloneNode(true) as HTMLElement;
    inlineComputedStyles(node, clone);
    clone.style.width = `${Math.ceil(node.scrollWidth || node.getBoundingClientRect().width)}px`;
    clone.style.height = 'auto';
    clone.style.maxHeight = 'none';
    clone.style.overflow = 'visible';
    clone.style.backgroundColor = '#ffffff';

    const wrapper = document.createElement('div');
    wrapper.contentEditable = 'true';
    wrapper.style.position = 'fixed';
    wrapper.style.left = '-10000px';
    wrapper.style.top = '0';
    wrapper.style.width = '1px';
    wrapper.style.height = '1px';
    wrapper.style.opacity = '0.01';
    wrapper.style.pointerEvents = 'none';
    wrapper.style.overflow = 'hidden';
    wrapper.appendChild(clone);
    document.body.appendChild(wrapper);

    const html = clone.outerHTML;
    const plainText = (node.innerText || node.textContent || '').trim();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(wrapper);
    selection?.removeAllRanges();
    selection?.addRange(range);
    wrapper.focus();

    const handleCopy = (event: ClipboardEvent) => {
        event.preventDefault();
        event.clipboardData?.setData('text/html', html);
        event.clipboardData?.setData('text/plain', plainText);
    };

    document.addEventListener('copy', handleCopy);
    const copied = document.execCommand('copy');
    document.removeEventListener('copy', handleCopy);
    selection?.removeAllRanges();
    wrapper.remove();

    return copied;
};

const copyElementToPngClipboard = async (node: HTMLElement, altText = '명세서'): Promise<void> => {
    const { ClipboardItemCtor, clipboard } = getClipboardImageWriter();
    const blobPromise = captureElementToPngBlob(node);

    if (ClipboardItemCtor && clipboard?.write) {
        try {
            await clipboard.write([
                new ClipboardItemCtor({
                    'image/png': blobPromise
                })
            ]);
            return;
        } catch (error) {
            console.warn('Image clipboard write failed, trying selection copy:', error);
            const blob = await blobPromise;
            await copyPngBlobBySelection(blob, altText, error);
            return;
        }
    }

    const blob = await blobPromise;
    await copyPngBlobBySelection(blob, altText);
};

const isCheongyeonCompanyName = (name?: string | null): boolean => {
    const normalized = normalizeName(name);
    return Boolean(normalized && (normalized.includes('청연') || normalized.includes('청연이엔지')));
};

const normalizeSalaryModel = (value: unknown): string => {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    if (raw.includes('지원') || raw.toLowerCase().includes('support')) return '지원팀';
    if (raw.includes('월급')) return '월급제';
    if (raw.includes('일급')) return '일급제';
    if (raw.includes('용역')) return '용역팀';
    return raw;
};

const getClientCompanyName = (row: Pick<SupportClientSiteWorkerRow, 'clientCompanyName'>): string =>
    String(row.clientCompanyName || '발주사 미지정').trim();

const clientKeyForRow = (row: Pick<SupportClientSiteWorkerRow, 'clientCompanyId' | 'clientCompanyName'>): string =>
    getIdentityKey(row.clientCompanyId, getClientCompanyName(row), 'client:unknown');

const siteKeyForRow = (row: Pick<SupportClientSiteWorkerRow, 'siteId' | 'siteName'>): string =>
    getIdentityKey(row.siteId, row.siteName, 'site:unknown');

const getBillingRowRateKey = (row: Pick<SupportClientSiteWorkerRow, 'rowId'>): string =>
    `row:${row.rowId}`;

const SUPPORT_TRANSACTION_STATEMENT_SOURCE = 'support-client-site' as const;
const SUPPORT_RENTAL_RATE_STORAGE_KEY = 'cy-transaction-rental-material-rates-v1';
const SUPPORT_RENTAL_WORK_TYPE_LABELS: Record<RentalWorkType, string> = {
    shoring: '시스템 동바리',
    scaffold: '시스템 비계',
};

const getEstimateTransactionMode = (statement: Pick<Estimate, 'estimateMode'>): SupportTransactionStatementMode =>
    statement.estimateMode === 'rental' ? 'rental' : 'standard';

const isEstimateTransactionMode = (
    statement: Pick<Estimate, 'estimateMode'>,
    mode: SupportTransactionStatementMode
): boolean => getEstimateTransactionMode(statement) === mode;

const readStoredSupportRentalRates = (): RentalMaterialRate[] => {
    if (typeof window === 'undefined') return [];
    try {
        const raw = window.localStorage.getItem(SUPPORT_RENTAL_RATE_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn('[SupportClientSitePage] rental rate settings load failed:', error);
        return [];
    }
};

const writeStoredSupportRentalRates = (rates: RentalMaterialRate[]) => {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(SUPPORT_RENTAL_RATE_STORAGE_KEY, JSON.stringify(rates));
    } catch (error) {
        console.warn('[SupportClientSitePage] rental rate settings save failed:', error);
    }
};

const parseSupportMoneyInput = (value: string): number => {
    const parsed = Number(String(value || '').replace(/,/g, '').trim());
    return Number.isFinite(parsed) ? parsed : 0;
};

const getSupportTransactionDefaultClientCompany = (target: SupportStatementTarget): string => {
    const clientNames = uniqueValues(target.rows.map((row) => getClientCompanyName(row)));
    return clientNames.length === 1 ? clientNames[0] : target.title;
};

const getSupportTransactionDefaultProjectName = (target: SupportStatementTarget): string => {
    const siteNames = uniqueValues(target.rows.map((row) => row.siteName));
    return siteNames.length === 1 ? siteNames[0] : target.title;
};

const getSupportTransactionItemDate = (yearMonth: string, rows: SupportClientSiteWorkerRow[]): string =>
    rows.map((row) => row.date).filter(Boolean).sort()[0] ||
    (/^\d{4}-\d{2}$/.test(yearMonth) ? `${yearMonth}-01` : new Date().toISOString().split('T')[0]);

const buildSupportTransactionItems = (target: SupportStatementTarget, yearMonth: string): EstimateItem[] => {
    const overrideAmount = Math.max(0, Math.round(Number(target.transactionAmountOverride || 0)));
    if (overrideAmount > 0) {
        const itemDate = getSupportTransactionItemDate(yearMonth, target.rows);
        const label = target.transactionItemLabel || target.title || '현장별 기성';

        return [
            createItem({
                category: label,
                section: label,
                label,
                unit: '식',
                quantity: 1,
                finalUnitPrice: overrideAmount,
                note: target.transactionItemNote || `${yearMonth} 기성청구`,
                itemDate
            } as Partial<EstimateItem>)
        ];
    }

    const siteMap = new Map<string, {
        siteName: string;
        manDay: number;
        amount: number;
        dates: string[];
        sourceTeams: string[];
    }>();

    target.rows.forEach((row) => {
        const siteKey = `${clientKeyForRow(row)}::${siteKeyForRow(row)}`;
        if (!siteMap.has(siteKey)) {
            siteMap.set(siteKey, {
                siteName: row.siteName || target.title,
                manDay: 0,
                amount: 0,
                dates: [],
                sourceTeams: []
            });
        }

        const siteGroup = siteMap.get(siteKey)!;
        const billingUnitPrice = Math.max(
            0,
            Math.round(target.billingRateByRowId?.[row.rowId] || target.billingRateBySiteKey?.[siteKey] || row.unitPrice || 0)
        );
        const billingAmount = billingUnitPrice > 0
            ? calculateSupportClientBillingAmount(row.manDay, billingUnitPrice)
            : Math.max(0, Math.round(row.amount || 0));

        siteGroup.manDay += row.manDay || 0;
        siteGroup.amount += billingAmount;
        if (row.date) siteGroup.dates.push(row.date);
        const sourceTeamName = getSourceTeamDisplayName(row);
        if (sourceTeamName) siteGroup.sourceTeams.push(sourceTeamName);
    });

    const itemDate = getSupportTransactionItemDate(yearMonth, target.rows);
    const items = Array.from(siteMap.values()).map((siteGroup) => {
        const manDayText = formatManDay(siteGroup.manDay);
        const sourceTeamText = summarizeNames(siteGroup.sourceTeams, '');
        const dateText = siteGroup.dates.length > 0
            ? uniqueValues(siteGroup.dates).sort().join(', ')
            : yearMonth;

        return createItem({
            category: siteGroup.siteName || target.title,
            section: '지원 노무비',
            label: siteGroup.siteName || target.title,
            unit: '식',
            quantity: 1,
            finalUnitPrice: Math.round(siteGroup.amount || 0),
            note: [`${manDayText}공수`, dateText, sourceTeamText].filter(Boolean).join(' / '),
            itemDate
        } as Partial<EstimateItem>);
    });

    return items.length > 0 ? items : [
        createItem({
            category: target.title || '지원 노무비',
            section: '지원 노무비',
            label: target.title || '지원 노무비',
            unit: '식',
            quantity: 1,
            finalUnitPrice: 0,
            itemDate
        } as Partial<EstimateItem>)
    ];
};

const getSupportTransactionTargetAmount = (target: SupportStatementTarget, yearMonth: string): number =>
    buildSupportTransactionItems(target, yearMonth).reduce((sum, item) => (
        sum + Math.max(0, Math.round(item.amount || ((item.finalUnitPrice || 0) * (item.quantity || 0))))
    ), 0);

const getSupportTransactionLinkFields = (
    statementKey: string,
    target: SupportStatementTarget,
    yearMonth: string,
    source: StatementOutputSource = SUPPORT_TRANSACTION_STATEMENT_SOURCE
) => ({
    supportStatementKey: statementKey,
    supportStatementSource: source,
    supportStatementYearMonth: yearMonth,
    supportStatementTargetTitle: target.title,
    supportStatementTargetSubtitle: target.subtitle || ''
});

const buildSupportTransactionDraft = (
    target: SupportStatementTarget,
    yearMonth: string,
    statementKey: string,
    mode: SupportTransactionStatementMode = 'standard'
): SupportTransactionStatementDraft => {
    const draft = getEmptyDraft('transaction') as SupportTransactionStatementDraft;
    const projectName = getSupportTransactionDefaultProjectName(target);
    const clientCompany = getSupportTransactionDefaultClientCompany(target);
    const isRental = mode === 'rental';
    const transactionItems = isRental ? [] : buildSupportTransactionItems(target, yearMonth);
    const title = isRental ? '임대 거래명세서' : '거래명세서';
    const notes = isRental ? `${yearMonth} 임대 거래명세서` : `${yearMonth} 지원 노무비`;

    return {
        ...draft,
        ...getSupportTransactionLinkFields(statementKey, target, yearMonth),
        estimateMode: mode,
        title,
        projectName,
        clientCompany,
        clientName: '',
        paymentTerms: '정기 결제',
        notes,
        includeVat: target.transactionIncludeVat ?? draft.includeVat,
        vatRate: target.transactionVatRate ?? draft.vatRate,
        items: transactionItems,
    };
};

const buildSupportTransactionDraftFromEstimate = (
    estimate: Estimate,
    target: SupportStatementTarget,
    yearMonth: string,
    statementKey: string
): SupportTransactionStatementDraft => {
    const mode = getEstimateTransactionMode(estimate);
    const baseDraft = buildSupportTransactionDraft(target, yearMonth, statementKey, mode);
    return {
        ...baseDraft,
        ...estimate,
        estimateMode: mode,
        documentType: 'transaction',
        items: estimate.items?.length ? estimate.items : baseDraft.items,
        ...getSupportTransactionLinkFields(statementKey, target, yearMonth),
    } as SupportTransactionStatementDraft;
};

const buildSupportRows = (
    reports: DailyReport[],
    teams: Team[],
    companies: Company[],
    sites: Site[],
    supportRates: SupportRate[],
    workers: Worker[] = []
): SupportClientSiteWorkerRow[] => {
    const teamById = new Map<string, Team>();
    const teamByName = new Map<string, Team>();
    const teamByMemberId = new Map<string, Team>();
    const teamByMemberName = new Map<string, Team>();
    teams.forEach((team) => {
        if (team.id) teamById.set(String(team.id), team);
        if (team.legacyId) teamById.set(String(team.legacyId), team);
        const nameKey = normalizeName(team.name);
        if (nameKey && !teamByName.has(nameKey)) teamByName.set(nameKey, team);
        (team.memberIds || []).forEach((value) => {
            const id = String(value ?? '').trim();
            if (!id || teamByMemberId.has(id)) return;
            teamByMemberId.set(id, team);
            const normalizedId = normalize(id);
            if (normalizedId && !teamByMemberId.has(normalizedId)) teamByMemberId.set(normalizedId, team);
        });
        (team.memberNames || []).forEach((value) => {
            const nameKeyByMember = normalizeName(value);
            if (nameKeyByMember && !teamByMemberName.has(nameKeyByMember)) teamByMemberName.set(nameKeyByMember, team);
        });
    });

    const workerByAnyId = new Map<string, Worker>();
    const workerByName = new Map<string, Worker>();
    workers.forEach((worker) => {
        [worker.id, worker.legacyId].forEach((value) => {
            const id = String(value ?? '').trim();
            if (!id) return;
            if (!workerByAnyId.has(id)) workerByAnyId.set(id, worker);
            const normalizedId = normalize(id);
            if (normalizedId && !workerByAnyId.has(normalizedId)) workerByAnyId.set(normalizedId, worker);
        });

        const nameKey = normalizeName(worker.name);
        if (nameKey && !workerByName.has(nameKey)) workerByName.set(nameKey, worker);
    });

    const companyById = new Map<string, Company>();
    companies.forEach((company) => {
        if (company.id) companyById.set(String(company.id), company);
    });

    const siteById = new Map<string, Site>();
    const siteByName = new Map<string, Site>();
    sites.forEach((site) => {
        if (site.id) siteById.set(String(site.id), site);
        const nameKey = normalizeName(site.name);
        if (nameKey && !siteByName.has(nameKey)) siteByName.set(nameKey, site);
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

    const findCompanyByName = (companyName?: string | null): Company | undefined => {
        const key = normalizeName(companyName);
        if (!key) return undefined;
        return companies.find((company) => normalizeName(company.name) === key);
    };

    const isMyCompany = (companyId?: string | null, companyName?: string | null): boolean => {
        const id = String(companyId ?? '').trim();
        const company = id ? companyById.get(id) : undefined;
        if (company?.isMyCompany) return true;
        if (company && isCheongyeonCompanyName(company.name)) return true;
        const byName = findCompanyByName(companyName);
        if (byName?.isMyCompany) return true;
        return isCheongyeonCompanyName(companyName);
    };

    const findTeam = (teamId?: string | null, teamName?: string | null): Team | undefined => {
        const id = String(teamId ?? '').trim();
        if (id) {
            const byId = teamById.get(id);
            if (byId) return byId;
        }
        const nameKey = normalizeName(teamName);
        return nameKey ? teamByName.get(nameKey) : undefined;
    };

    const findWorker = (workerId?: string | null, workerName?: string | null): Worker | undefined => {
        const id = String(workerId ?? '').trim();
        const byId = id ? (workerByAnyId.get(id) || workerByAnyId.get(normalize(id))) : undefined;
        if (byId) return byId;
        const nameKey = normalizeName(workerName);
        return nameKey ? workerByName.get(nameKey) : undefined;
    };

    const findTeamByMember = (workerId?: string | null, workerName?: string | null): Team | undefined => {
        const id = String(workerId ?? '').trim();
        const byId = id ? (teamByMemberId.get(id) || teamByMemberId.get(normalize(id))) : undefined;
        if (byId) return byId;
        const nameKey = normalizeName(workerName);
        return nameKey ? teamByMemberName.get(nameKey) : undefined;
    };

    const normalizeClientCompany = (companyId?: string | null, companyName?: string | null): { id: string; name: string } => {
        const rawId = String(companyId ?? '').trim();
        const rawName = String(companyName ?? '').trim();
        const companyByIdValue = rawId ? companyById.get(rawId) : undefined;
        const companyByNameValue = findCompanyByName(rawName);
        const resolvedId = String(companyByIdValue?.id || companyByNameValue?.id || rawId || '').trim();
        const resolvedName = String(companyByIdValue?.name || companyByNameValue?.name || rawName || '발주사 미지정').trim();
        const isTeamName = Boolean(findTeam('', resolvedName) || /팀$/.test(resolvedName));

        if (
            resolvedName === EXTERNAL_CLIENT_GROUP_NAME ||
            resolvedName === EXTERNAL_CLIENT_GROUP_LEGACY_DISPLAY_NAME ||
            resolvedName === EXTERNAL_CLIENT_GROUP_DISPLAY_NAME
        ) {
            return {
                id: EXTERNAL_CLIENT_GROUP_ID,
                name: EXTERNAL_CLIENT_GROUP_DISPLAY_NAME
            };
        }

        if (isTeamName && !companyByIdValue && !companyByNameValue) {
            return {
                id: EXTERNAL_CLIENT_GROUP_ID,
                name: EXTERNAL_CLIENT_GROUP_DISPLAY_NAME
            };
        }

        return {
            id: resolvedId,
            name: resolvedName
        };
    };

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

    const rows: SupportClientSiteWorkerRow[] = [];

    reports.forEach((report) => {
        const reportSite = report.siteId
            ? siteById.get(String(report.siteId))
            : siteByName.get(normalizeName(report.siteName));
        const siteId = String(report.siteId || reportSite?.id || 'unknown-site').trim();
        const siteName = String(report.siteName || reportSite?.name || '현장 미지정').trim();
        const siteAddress = String(reportSite?.address || '').trim();
        const siteType = String(report.siteType || reportSite?.siteType || '').trim();
        const paymentType = String(reportSite?.paymentMethod || report.paymentType || '').trim();
        const rawClientCompanyId = String(
            reportSite?.clientCompanyId ||
            report.companyId ||
            ''
        ).trim();
        const rawClientCompanyName = String(
            reportSite?.clientCompanyName ||
            report.companyName ||
            '발주사 미지정'
        ).trim();
        const normalizedClientCompany = normalizeClientCompany(rawClientCompanyId, rawClientCompanyName);
        const clientCompanyId = normalizedClientCompany.id;
        const clientCompanyName = normalizedClientCompany.name;
        const constructorCompanyId = String(
            reportSite?.constructorCompanyId ||
            reportSite?.companyId ||
            report.constructorCompanyId ||
            report.companyId ||
            ''
        ).trim();
        const constructorCompanyName = String(
            reportSite?.constructorCompanyName ||
            reportSite?.companyName ||
            report.constructorCompanyName ||
            report.companyName ||
            '시공사 미지정'
        ).trim();
        const siteIsMyCompany = isMyCompany(constructorCompanyId, constructorCompanyName);

        const targetTeamNameRaw = String(report.responsibleTeamName || reportSite?.responsibleTeamName || report.teamName || '').trim();
        const targetTeamIdRaw = String(report.responsibleTeamId || reportSite?.responsibleTeamId || report.teamId || '').trim();
        const targetTeam = findTeam(targetTeamIdRaw, targetTeamNameRaw);
        const responsibleTeamId = String(targetTeam?.id || targetTeamIdRaw || '').trim();
        const responsibleTeamName = String(targetTeam?.name || targetTeamNameRaw || '현장담당팀 미지정').trim();
        const responsibleTeamColor = normalizeHexColor(targetTeam?.color);
        const responsibleTeamIcon = String(targetTeam?.iconKey || targetTeam?.icon || 'fa-users').trim();
        const targetCompanyId = String(targetTeam?.companyId || constructorCompanyId || report.companyId || '').trim();
        const targetCompanyName = String(targetTeam?.companyName || constructorCompanyName || report.companyName || '').trim();
        const targetIsMyCompany = isMyCompany(targetCompanyId, targetCompanyName);

        const reportWorkers = Array.isArray(report.workers) ? report.workers : [];
        reportWorkers.forEach((reportWorker: DailyReportWorker, workerIndex) => {
            const normalizedSalary = normalizeSalaryModel(reportWorker.salaryModel || reportWorker.payType);
            const isSupportModel = normalizedSalary === '지원팀';
            const workerId = String(reportWorker.workerId || `${report.id || 'report'}-${workerIndex}`).trim();
            const workerName = String(reportWorker.name || '이름 미상').trim();
            const workerSiteType = String(reportWorker.siteType || siteType || '').trim();
            const workerPaymentType = String(reportSite?.paymentMethod || reportWorker.paymentType || paymentType || '').trim();
            const workerProfile = findWorker(workerId, workerName);
            const workerIdNumber = String(workerProfile?.idNumber || '').trim();
            const workerAddress = String(workerProfile?.address || siteAddress || '').trim();
            const workerContact = String(workerProfile?.contact || '').trim();
            const workerBankName = String(workerProfile?.bankName || '').trim();
            const workerAccountNumber = String(workerProfile?.accountNumber || '').trim();
            const workerAccountHolder = String(workerProfile?.accountHolder || '').trim();
            const workerLaborStatementPayType = getWorkerMasterLaborStatementPayType(workerProfile);
            const profileTeamId = String(workerProfile?.teamId || '').trim();
            const profileTeamName = String(workerProfile?.teamName || '').trim();
            const memberTeam = findTeamByMember(workerId, workerName);
            const reportWorkerTeamId = String(reportWorker.teamId || '').trim();
            const reportWorkerTeamName = String(reportWorker.workerTeamName || '').trim();
            const fallbackTeamId = reportWorkerTeamName ? '' : String(report.teamId || '').trim();
            const sourceTeam = findTeam(reportWorkerTeamId || fallbackTeamId, reportWorkerTeamName || report.teamName);
            const sourceTeamId = String(sourceTeam?.id || reportWorkerTeamId || fallbackTeamId || normalizeName(reportWorkerTeamName) || '').trim();
            const sourceTeamName = String(sourceTeam?.name || reportWorkerTeamName || report.teamName || '작업팀 미지정').trim();
            const workerTeam =
                findTeam(profileTeamId, profileTeamName) ||
                memberTeam ||
                findTeam(reportWorkerTeamId || fallbackTeamId, reportWorkerTeamName || report.teamName);
            const workerTeamId = String(workerTeam?.id || profileTeamId || reportWorkerTeamId || fallbackTeamId || normalizeName(profileTeamName || reportWorkerTeamName) || '').trim();
            const workerTeamName = String(workerTeam?.name || profileTeamName || reportWorkerTeamName || report.teamName || sourceTeamName || '작업팀 미지정').trim();
            const sourceCompanyId = String(sourceTeam?.companyId || '').trim();
            const sourceCompanyName = String(sourceTeam?.companyName || (sourceCompanyId ? companyById.get(sourceCompanyId)?.name : '') || '').trim();
            const sourceIsMyCompany = isMyCompany(sourceCompanyId, sourceCompanyName);
            const isSupportTeam = normalize(sourceTeam?.type).includes('지원');

            const classifiedEntries: Array<{
                direction: SupportDirection;
                settlementName: string;
                counterpartyName: string;
                evidenceNote: string;
            }> = [];

            if (!siteIsMyCompany && sourceIsMyCompany) {
                classifiedEntries.push({
                    direction: '외부지원간곳',
                    settlementName: responsibleTeamName || constructorCompanyName,
                    counterpartyName: constructorCompanyName || siteName,
                    evidenceNote: '청연 소속 작업팀이 외부 현장으로 지원 나간 건'
                });
            } else if (siteIsMyCompany && targetIsMyCompany && sourceIsMyCompany) {
                classifiedEntries.push({
                    direction: OWN_SITE_OUTPUT_LABEL,
                    settlementName: responsibleTeamName || clientCompanyName,
                    counterpartyName: clientCompanyName || siteName,
                    evidenceNote: '청연 현장 공수를 발주사 현장 기준으로 집계한 건'
                });
            } else if (siteIsMyCompany && targetIsMyCompany && !sourceIsMyCompany) {
                classifiedEntries.push({
                    direction: '외부지원온곳',
                    settlementName: sourceTeamName || sourceCompanyName || '외부 지원팀',
                    counterpartyName: sourceTeamName || sourceCompanyName || '외부 지원팀',
                    evidenceNote: '외부 작업팀이 청연 담당 현장으로 지원 온 건'
                });
            } else if (siteIsMyCompany && targetIsMyCompany && (isSupportModel || isSupportTeam)) {
                classifiedEntries.push({
                    direction: '외부지원온곳',
                    settlementName: sourceTeamName || sourceCompanyName || '지원팀',
                    counterpartyName: sourceTeamName || sourceCompanyName || '지원팀',
                    evidenceNote: '지원팀 소속 인원이 청연 담당 현장으로 지원 온 건'
                });
            }

            if (classifiedEntries.length === 0) return;

            const rawManDay = Number(reportWorker.manDay || 0);
            const manDay = Number.isFinite(rawManDay) ? rawManDay : 0;
            if (manDay <= 0) return;

            const unitPrice =
                resolveConfiguredSiteRate(siteId, siteName) ??
                toPositiveRate(sourceTeam?.supportRate) ??
                toPositiveRate(reportWorker.unitPrice) ??
                DEFAULT_SUPPORT_UNIT_PRICE;
            const amount = Math.round(manDay * unitPrice);

            classifiedEntries.forEach((entry) => {
                rows.push({
                    rowId: [
                        report.id || 'report',
                        workerIndex,
                        entry.direction,
                        workerId,
                        siteId
                    ].join('::'),
                    reportId: String(report.id || ''),
                    date: String(report.date || ''),
                    direction: entry.direction,
                    workerId,
                    workerName,
                    workerIdNumber,
                    workerAddress,
                    workerContact,
                    workerBankName,
                    workerAccountNumber,
                    workerAccountHolder,
                    workerLaborStatementPayType,
                    role: reportWorker.role || undefined,
                    manDay,
                    unitPrice,
                    amount,
                    siteId,
                    siteName,
                    siteAddress,
                    siteType: workerSiteType,
                    paymentType: workerPaymentType,
                    clientCompanyId,
                    clientCompanyName,
                    constructorCompanyId,
                    constructorCompanyName,
                    sourceTeamId,
                    sourceTeamName,
                    workerTeamId,
                    workerTeamName,
                    responsibleTeamId,
                    responsibleTeamName,
                    responsibleTeamColor,
                    responsibleTeamIcon,
                    settlementName: entry.settlementName,
                    counterpartyName: entry.counterpartyName,
                    evidenceNote: entry.evidenceNote
                });
            });
        });
    });

    return rows.sort((a, b) =>
        getClientCompanyName(a).localeCompare(getClientCompanyName(b), 'ko-KR') ||
        a.siteName.localeCompare(b.siteName, 'ko-KR') ||
        SUPPORT_DIRECTION_ORDER.indexOf(a.direction) - SUPPORT_DIRECTION_ORDER.indexOf(b.direction) ||
        a.date.localeCompare(b.date)
    );
};

const groupRowsByClientAndSite = (rows: SupportClientSiteWorkerRow[]): SupportClientSummary[] => {
    const clientMap = new Map<string, {
        key: string;
        clientCompanyId: string;
        clientCompanyName: string;
        siteMap: Map<string, SupportSiteSummary>;
    }>();

    rows.forEach((row) => {
        const clientKey = clientKeyForRow(row);
        if (!clientMap.has(clientKey)) {
            clientMap.set(clientKey, {
                key: clientKey,
                clientCompanyId: row.clientCompanyId,
                clientCompanyName: getClientCompanyName(row),
                siteMap: new Map<string, SupportSiteSummary>()
            });
        }

        const client = clientMap.get(clientKey)!;
        const siteKey = `${clientKey}::${siteKeyForRow(row)}`;
        if (!client.siteMap.has(siteKey)) {
            client.siteMap.set(siteKey, {
                key: siteKey,
                siteId: row.siteId,
                siteName: row.siteName,
                siteAddress: row.siteAddress,
                siteTypes: [],
                paymentTypes: [],
                clientCompanyId: row.clientCompanyId,
                clientCompanyName: getClientCompanyName(row),
                constructorCompanyId: row.constructorCompanyId,
                constructorCompanyName: row.constructorCompanyName,
                responsibleTeams: [],
                responsibleTeamNames: [],
                sourceTeamNames: [],
                settlementNames: [],
                directions: [],
                activeDates: [],
                workerCount: 0,
                totalManDay: 0,
                totalAmount: 0,
                avgUnitPrice: 0,
                expenseClaimAmount: 0,
                expenseClaimCount: 0,
                expenseClaims: [],
                rows: []
            });
        }

        client.siteMap.get(siteKey)!.rows.push(row);
    });

    return Array.from(clientMap.values())
        .map((client) => {
            const sites = Array.from(client.siteMap.values())
                .map((site) => {
                    const sortedRows = [...site.rows].sort((a, b) =>
                        a.date.localeCompare(b.date) ||
                        a.workerName.localeCompare(b.workerName, 'ko-KR') ||
                        SUPPORT_DIRECTION_ORDER.indexOf(a.direction) - SUPPORT_DIRECTION_ORDER.indexOf(b.direction)
                    );
                    const totalManDay = sortedRows.reduce((sum, row) => sum + row.manDay, 0);
                    const totalAmount = sortedRows.reduce((sum, row) => sum + row.amount, 0);
                    const workerKeys = new Set(sortedRows.map((row) => row.workerId || row.workerName));

                    return {
                        ...site,
                        rows: sortedRows,
                        responsibleTeams: uniqueResponsibleTeams(sortedRows),
                        responsibleTeamNames: uniqueValues(sortedRows.map((row) => row.responsibleTeamName)),
                        sourceTeamNames: uniqueValues(sortedRows.map((row) => row.sourceTeamName)),
                        settlementNames: uniqueValues(sortedRows.map((row) => row.settlementName)),
                        siteTypes: uniqueValues(sortedRows.map((row) => row.siteType)),
                        paymentTypes: uniqueValues(sortedRows.map((row) => row.paymentType)),
                        directions: uniqueValues(sortedRows.map((row) => row.direction)) as SupportDirection[],
                        activeDates: uniqueValues(sortedRows.map((row) => row.date)).sort(),
                        workerCount: workerKeys.size,
                        totalManDay,
                        totalAmount,
                        avgUnitPrice: totalManDay > 0 ? Math.round(totalAmount / totalManDay) : 0
                    };
                })
                .sort((a, b) => b.totalAmount - a.totalAmount || a.siteName.localeCompare(b.siteName, 'ko-KR'));

            const allRows = sites.flatMap((site) => site.rows);
            return {
                key: client.key,
                clientCompanyId: client.clientCompanyId,
                clientCompanyName: client.clientCompanyName,
                siteCount: sites.length,
                workerCount: new Set(allRows.map((row) => row.workerId || row.workerName)).size,
                totalManDay: sites.reduce((sum, site) => sum + site.totalManDay, 0),
                totalAmount: sites.reduce((sum, site) => sum + site.totalAmount, 0),
                directions: uniqueValues(allRows.map((row) => row.direction)) as SupportDirection[],
                sites
            };
        })
        .sort((a, b) => b.totalAmount - a.totalAmount || a.clientCompanyName.localeCompare(b.clientCompanyName, 'ko-KR'));
};

const DirectionBadge: React.FC<{ direction: SupportDirection }> = ({ direction }) => (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-black ${DIRECTION_META[direction].badgeClass}`}>
        {DIRECTION_META[direction].label}
    </span>
);

const OwnSiteOutputBadge: React.FC = () => (
    <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-black text-emerald-700">
        {OWN_SITE_OUTPUT_LABEL}
    </span>
);

const OutputTypeBadge: React.FC<{ label: string }> = ({ label }) => {
    if (label === OWN_SITE_OUTPUT_LABEL) return <OwnSiteOutputBadge />;

    const direction = SUPPORT_DIRECTION_ORDER.find((candidate) =>
        candidate === label || DIRECTION_META[candidate].label === label
    );

    return <DirectionBadge direction={direction ?? '외부지원간곳'} />;
};

const AccordionChevron: React.FC<{ expanded: boolean; className?: string }> = ({ expanded, className = '' }) => (
    <FontAwesomeIcon
        icon={faChevronRight}
        className={`shrink-0 transition-transform duration-300 ${expanded ? 'rotate-90' : ''} ${className}`}
    />
);

const ResponsibleTeamChips: React.FC<{ teams: SupportTeamBadge[]; size?: 'sm' | 'lg' }> = ({ teams, size = 'sm' }) => {
    if (teams.length === 0) {
        return <span className="text-[11px] font-bold text-slate-400">미지정</span>;
    }

    const isLarge = size === 'lg';

    return (
        <span className={`inline-flex min-w-0 flex-wrap items-center ${isLarge ? 'gap-2' : 'gap-1.5'}`}>
            {teams.map((team) => {
                const color = normalizeHexColor(team.color);
                return (
                    <span
                        key={team.key}
                        className={`inline-flex max-w-full items-center rounded-full border font-black ${
                            isLarge ? 'gap-2 px-3 py-1.5 text-sm' : 'gap-1.5 px-2 py-1 text-[11px]'
                        }`}
                        style={{
                            borderColor: hexToRgba(color, 0.28),
                            backgroundColor: hexToRgba(color, 0.08),
                            color
                        }}
                        title={team.name}
                    >
                        <span
                            className={`flex shrink-0 items-center justify-center rounded-full text-white shadow-sm ${
                                isLarge ? 'h-6 w-6' : 'h-5 w-5'
                            }`}
                            style={{ backgroundColor: color }}
                        >
                            <FontAwesomeIcon icon={resolveIcon(team.icon, faUsers)} className={isLarge ? 'text-xs' : 'text-[10px]'} />
                        </span>
                        <span className="truncate">{team.name}</span>
                    </span>
                );
            })}
        </span>
    );
};

const SiteMetaBadge: React.FC<{ label: string; value: string; tone: 'violet' | 'sky' }> = ({ label, value, tone }) => {
    if (!value || value === '-') return null;

    const toneClass = tone === 'violet'
        ? 'border-violet-200 bg-violet-50 text-violet-700'
        : 'border-sky-200 bg-sky-50 text-sky-700';

    return (
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black ${toneClass}`}>
            <span className="text-slate-400">{label}</span>
            <span>{value}</span>
        </span>
    );
};

export const StatementActionButtons: React.FC<{
    target: SupportStatementTarget;
    onOpenLabor: (target: SupportStatementTarget) => void;
    onOpenTransaction: (target: SupportStatementTarget) => void;
    onOpenRentalTransaction: (target: SupportStatementTarget) => void;
    onOpenExpense: (target: SupportStatementTarget) => void;
    laborOpen?: boolean;
    transactionOpen?: boolean;
    rentalTransactionOpen?: boolean;
    transactionCount?: number;
    rentalTransactionCount?: number;
}> = ({
    target,
    onOpenLabor,
    onOpenTransaction,
    onOpenRentalTransaction,
    onOpenExpense,
    laborOpen = false,
    transactionOpen = false,
    rentalTransactionOpen = false,
    transactionCount = 0,
    rentalTransactionCount = 0,
}) => {
    const expenseAmount = getExpenseClaimsTotal(target.expenseClaims);
    const columnClass = expenseAmount > 0 ? 'grid-cols-2' : 'grid-cols-3';

    return (
        <div className={`grid gap-1 ${columnClass}`}>
            <button
                type="button"
                aria-label={`${target.title} 노임명세서`}
                title="노임명세서"
                aria-expanded={laborOpen}
                onClick={(event) => {
                    event.stopPropagation();
                    onOpenLabor(target);
                }}
                className={`inline-flex h-7 items-center justify-center gap-1 whitespace-nowrap rounded px-2 text-[10px] font-black text-white shadow-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
                    laborOpen ? 'bg-emerald-800 ring-2 ring-emerald-300' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
            >
                <FontAwesomeIcon icon={faFileInvoiceDollar} />
                <span>노임명세</span>
            </button>
            <button
                type="button"
                aria-label={`${target.title} 거래명세서`}
                title="거래명세서"
                aria-expanded={transactionOpen}
                onClick={(event) => {
                    event.stopPropagation();
                    onOpenTransaction(target);
                }}
                className={`relative inline-flex h-7 items-center justify-center gap-1 whitespace-nowrap rounded px-2 text-[10px] font-black text-white shadow-sm transition focus:outline-none focus:ring-2 focus:ring-teal-400 ${
                    transactionOpen ? 'bg-teal-800 ring-2 ring-teal-300' : 'bg-teal-600 hover:bg-teal-700'
                }`}
            >
                <FontAwesomeIcon icon={faFileInvoice} />
                <span>거래명세</span>
                {transactionCount > 0 && (
                    <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-white px-1 text-[9px] font-black leading-4 text-teal-700 shadow">
                        {transactionCount}
                    </span>
                )}
            </button>
            <button
                type="button"
                aria-label={`${target.title} 임대거래명세서 열기`}
                title="임대거래명세서"
                aria-expanded={rentalTransactionOpen}
                onClick={(event) => {
                    event.stopPropagation();
                    onOpenRentalTransaction(target);
                }}
                className={`relative inline-flex h-7 items-center justify-center gap-1 whitespace-nowrap rounded px-2 text-[10px] font-black text-white shadow-sm transition focus:outline-none focus:ring-2 focus:ring-amber-400 ${
                    rentalTransactionOpen ? 'bg-amber-800 ring-2 ring-amber-300' : 'bg-amber-600 hover:bg-amber-700'
                }`}
            >
                <FontAwesomeIcon icon={faFileInvoice} />
                <span>임대거래</span>
                {rentalTransactionCount > 0 && (
                    <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-white px-1 text-[9px] font-black leading-4 text-amber-700 shadow">
                        {rentalTransactionCount}
                    </span>
                )}
            </button>
            {expenseAmount > 0 && (
                <button
                    type="button"
                    aria-label={`${target.title} 경비내역서`}
                    title="경비내역서"
                    onClick={(event) => {
                        event.stopPropagation();
                        onOpenExpense(target);
                    }}
                    className="inline-flex h-7 items-center justify-center gap-1 whitespace-nowrap rounded bg-teal-600 px-2 text-[10px] font-black text-white shadow-sm transition hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-400"
                >
                    <FontAwesomeIcon icon={faReceipt} />
                    <span>경비내역</span>
                </button>
            )}
        </div>
    );
};

const SupportClientStatementModalShell: React.FC<{
    title: string;
    onClose: () => void;
    children: React.ReactNode;
}> = ({ title, onClose, children }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
        <div className="flex max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <h2 className="text-base font-black text-slate-900">{title}</h2>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="닫기"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                >
                    <FontAwesomeIcon icon={faXmark} />
                </button>
            </div>
            <div className="min-h-0 overflow-auto p-5">
                {children}
            </div>
        </div>
    </div>
);

const DEFAULT_STATEMENT_LOGO_URL = '/icons/icon-192.png';

const resolveStatementLogoUrl = (logoUrl?: string | null): string => {
    const trimmed = typeof logoUrl === 'string' ? logoUrl.trim() : '';
    return trimmed || DEFAULT_STATEMENT_LOGO_URL;
};

const wrapCanvasText = (
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
    maxLines: number
): string[] => {
    const chars = Array.from(text);
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


const SupportClientStatementBrand: React.FC<{ logoUrl?: string | null }> = ({ logoUrl }) => {
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

const SUPPORT_CLIENT_LABOR_STATEMENT_SPLIT_WIDTHS = {
    no: 42,
    name: 100,
    identity: 132,
    address: 250,
    day: 30,
    total: 70,
    amount: 157,
    bank: 120,
};

const SUPPORT_CLIENT_LABOR_STATEMENT_FULL_WIDTHS = {
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

const buildSupportClientLaborStatementColumns = (
    viewOptions: SupportClientLaborStatementViewOptions
): Array<{ key: string; width: number }> => {
    if (viewOptions.isSplitView) {
        const widths = SUPPORT_CLIENT_LABOR_STATEMENT_SPLIT_WIDTHS;
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

    const widths = SUPPORT_CLIENT_LABOR_STATEMENT_FULL_WIDTHS;
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

const SupportClientLaborStatementPreview: React.FC<{
    target: SupportStatementTarget;
    preview: SupportClientLaborSitePreview;
    yearMonth: string;
    viewOptions: SupportClientLaborStatementViewOptions;
}> = ({ target, preview, yearMonth, viewOptions }) => {
    const [yearString, monthString] = yearMonth.split('-');
    const year = parseInt(yearString ?? '', 10);
    const month = parseInt(monthString ?? '0', 10);
    const statementPeriod = Number.isFinite(year)
        ? `${String(year % 100).padStart(2, '0')}년 ${month || ''}월분`
        : `${month || ''}월분`;
    const dayTotals = Array.from({ length: MAX_DAY_COLUMNS }, () => 0);
    preview.rows.forEach((row) => {
        row.days.forEach((value, index) => {
            dayTotals[index] += value;
        });
    });
    const avgPrice = preview.totalManDay > 0 ? Math.round(preview.totalAmount / preview.totalManDay) : 0;
    const allDayLabels = Array.from({ length: MAX_DAY_COLUMNS }, (_, index) => index + 1);
    const primaryDayLabels = viewOptions.isSplitView ? DAY_LABELS_FIRST : allDayLabels;
    const statementColumns = buildSupportClientLaborStatementColumns(viewOptions);
    const statementTableMinWidth = statementColumns.reduce((sum, column) => sum + column.width, 0);
    const statementSheetMinWidth = statementTableMinWidth + 82;
    const footerRowSpan = viewOptions.isSplitView && viewOptions.showBillingColumns ? 2 : 1;
    const getPaymentLabel = (payType: SupportStatementPayType) => payType === 'delegate' ? '위임' : '직불';
    const formatBankInfo = (row: SupportClientLaborStatementRow) =>
        [row.bankName, row.accountHolder, row.accountNumber].filter(Boolean).join(' / ');
    const getAddressContent = (row: SupportClientLaborStatementRow) => {
        const parts = [row.address || '-'];
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
                        현장명: <span className="border-b-2 border-slate-300 px-2 text-slate-900">{preview.siteName}</span>
                    </p>
                </div>
                <SupportClientStatementBrand />
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
                        <th className="border-2 border-slate-800 bg-yellow-100 p-2 text-yellow-950" rowSpan={viewOptions.isSplitView ? 2 : 1}>계좌번호 / 지급구분</th>
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
                {preview.rows.map((row, index) => (
                    <React.Fragment key={row.key || row.workerId || `${row.workerName}:${index}`}>
                        <tr className="font-bold">
                            <td rowSpan={viewOptions.isSplitView ? 2 : 1} className="border-2 border-slate-800 bg-slate-50 py-1.5 text-center">{index + 1}</td>
                            <td rowSpan={viewOptions.isSplitView ? 2 : 1} className="border-2 border-slate-800 py-1.5 text-center text-[13px]">
                                <div>{row.workerName}</div>
                                {viewOptions.showTeamUnderName && row.teamNames.length > 0 && (
                                    <div className="mt-1 text-[9px] font-semibold text-slate-500">{row.teamNames.join(', ')}</div>
                                )}
                            </td>
                            <td className="border-2 border-slate-800 py-1.5 text-center font-mono">{formatFullIdNumber(row.idNumber)}</td>
                            <td rowSpan={viewOptions.isSplitView ? 2 : 1} className={`break-words border-2 border-slate-800 px-1.5 py-1.5 text-[10px] leading-snug ${row.payType === 'delegate' && viewOptions.showBankUnderAddress ? 'bg-yellow-100' : ''}`}>
                                {getAddressContent(row).map((line, lineIndex) => (
                                    <div key={`${row.key}:address:${lineIndex}`} className={lineIndex > 0 ? 'mt-1 border-t border-slate-300 pt-1 font-semibold text-yellow-800' : ''}>{line}</div>
                                ))}
                            </td>
                            {primaryDayLabels.map((day) => (
                                <td key={day} className="border-2 border-slate-800 bg-sky-50/30 py-1.5 text-center">{formatStatementDayManDay(row.days[day - 1])}</td>
                            ))}
                            {viewOptions.isSplitView && <td className="border-2 border-slate-800 bg-slate-50 py-1.5"></td>}
                            <td rowSpan={viewOptions.isSplitView ? 2 : 1} className="border-2 border-slate-800 bg-slate-50 py-1.5 text-center font-mono text-[13px]">{formatManDay(row.totalManDay)}</td>
                            {viewOptions.showBillingColumns && (
                                <td className="border-2 border-slate-800 bg-emerald-50 px-2 py-1.5 text-right font-mono text-emerald-700">{formatNumber(row.unitPrice)}</td>
                            )}
                            {viewOptions.showBillingColumns && !viewOptions.isSplitView && (
                                <td className="border-2 border-slate-800 bg-emerald-50 px-2 py-1.5 text-right font-mono text-emerald-800">{formatNumber(row.totalAmount)}</td>
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
                                    <td className="border-2 border-slate-800 bg-emerald-50 px-2 py-1.5 text-right font-mono text-emerald-800">{formatNumber(row.totalAmount)}</td>
                                )}
                            </tr>
                        )}
                    </React.Fragment>
                ))}
                <tr className="bg-slate-200 text-[13px] font-black">
                    <td colSpan={4} className="border-2 border-slate-800 py-2.5 text-center">합 계</td>
                    {primaryDayLabels.map((day) => (
                        <td key={day} className="border-2 border-slate-800 py-2.5 text-center">{formatStatementDayManDay(dayTotals[day - 1])}</td>
                    ))}
                    {viewOptions.isSplitView && <td className="border-2 border-slate-800 py-2.5"></td>}
                    <td rowSpan={footerRowSpan} className="border-2 border-slate-800 py-2.5 text-center font-mono">{formatManDay(preview.totalManDay)}</td>
                    {viewOptions.showBillingColumns && (
                        <td className="border-2 border-slate-800 bg-emerald-100 px-2 py-2.5 text-right font-mono text-emerald-800">{formatNumber(avgPrice)}</td>
                    )}
                    {viewOptions.showBillingColumns && !viewOptions.isSplitView && (
                        <td className="border-2 border-slate-800 bg-emerald-100 px-2 py-2.5 text-right font-mono text-emerald-900">{formatNumber(preview.totalAmount)}</td>
                    )}
                    {viewOptions.showBankColumn && <td rowSpan={footerRowSpan} className="border-2 border-slate-800 bg-yellow-100 py-2.5"></td>}
                </tr>
                {viewOptions.isSplitView && viewOptions.showBillingColumns && (
                    <tr className="bg-slate-200 text-[13px] font-black">
                        <td colSpan={4} className="border-2 border-slate-800 py-2.5 text-center">청구금액</td>
                        {DAY_LABELS_SECOND.map((day) => (
                            <td key={day} className="border-2 border-slate-800 py-2.5 text-center">{formatStatementDayManDay(dayTotals[day - 1])}</td>
                        ))}
                        <td className="border-2 border-slate-800 bg-emerald-100 px-2 py-2.5 text-right font-mono text-emerald-900">{formatNumber(preview.totalAmount)}</td>
                    </tr>
                )}
                </tbody>
            </table>
        </div>
    );
};

const loadSupportClientLaborStatementDefaults = (
    preset: StatementIssueOptionPreset = loadStatementIssueOptionPreset()
) => loadLaborStatementPresetDefaults(preset);

export const SupportClientLaborStatementPanel: React.FC<{
    target: SupportStatementTarget;
    yearMonth: string;
    statementKey?: string;
    outputSource?: StatementOutputSource;
    onOutputSaved?: () => Promise<void> | void;
    onClose: () => void;
}> = ({ target, yearMonth, statementKey, outputSource = 'support-client-site', onOutputSaved, onClose }) => {
    const [statementOptionPreset, setStatementOptionPreset] = useState<StatementIssueOptionPreset>(() => loadStatementIssueOptionPreset());
    const [showBankColumn, setShowBankColumn] = useState(() => loadSupportClientLaborStatementDefaults(statementOptionPreset).showBankColumn);
    const [showBillingColumns, setShowBillingColumns] = useState(() => loadSupportClientLaborStatementDefaults(statementOptionPreset).showBillingColumns);
    const [isSplitView, setIsSplitView] = useState(() => loadSupportClientLaborStatementDefaults(statementOptionPreset).isSplitView);
    const [showBankUnderAddress, setShowBankUnderAddress] = useState(() => loadSupportClientLaborStatementDefaults(statementOptionPreset).showBankUnderAddress);
    const [showTeamUnderName, setShowTeamUnderName] = useState(() => loadSupportClientLaborStatementDefaults(statementOptionPreset).showTeamUnderName);
    const [bulkUnitPriceInput, setBulkUnitPriceInput] = useState(() => {
        const unitPrice = loadSupportClientLaborStatementDefaults(statementOptionPreset).unitPriceOverride;
        return unitPrice > 0 ? String(unitPrice) : '';
    });
    const [appliedBulkUnitPrice, setAppliedBulkUnitPrice] = useState(() => loadSupportClientLaborStatementDefaults(statementOptionPreset).unitPriceOverride);
    const [useWorkerMasterPayType, setUseWorkerMasterPayType] = useState(() => loadSupportClientLaborStatementDefaults(statementOptionPreset).useWorkerMasterPayType);
    const [workerPayTypes, setWorkerPayTypes] = useState<Record<string, SupportStatementPayType>>(() =>
        buildSupportWorkerPayTypesFromDefaults(
            target.rows,
            loadSupportClientLaborStatementDefaults(statementOptionPreset).useWorkerMasterPayType,
            loadSupportClientLaborStatementDefaults(statementOptionPreset)
        )
    );
    const [delegateBankName, setDelegateBankName] = useState(() => loadSupportClientLaborStatementDefaults(statementOptionPreset).delegateBankName);
    const [delegateAccountHolder, setDelegateAccountHolder] = useState(() => loadSupportClientLaborStatementDefaults(statementOptionPreset).delegateAccountHolder);
    const [delegateAccountNumber, setDelegateAccountNumber] = useState(() => loadSupportClientLaborStatementDefaults(statementOptionPreset).delegateAccountNumber);
    const statementOptions = useMemo<SupportClientLaborStatementOptions>(() => ({
        unitPriceOverride: appliedBulkUnitPrice,
        defaultPayType: 'direct',
        workerPayTypes,
        delegateBankName,
        delegateAccountHolder,
        delegateAccountNumber
    }), [appliedBulkUnitPrice, workerPayTypes, delegateBankName, delegateAccountHolder, delegateAccountNumber]);
    const statementViewOptions = useMemo<SupportClientLaborStatementViewOptions>(() => ({
        showBankColumn,
        showBillingColumns,
        isSplitView,
        showBankUnderAddress,
        showTeamUnderName
    }), [showBankColumn, showBillingColumns, isSplitView, showBankUnderAddress, showTeamUnderName]);
    const previews = useMemo(
        () => buildSupportClientLaborPreviews(target.rows, target.billingRateBySiteKey, target.billingRateByRowId, statementOptions),
        [target.rows, target.billingRateBySiteKey, target.billingRateByRowId, statementOptions]
    );
    const [statusMessage, setStatusMessage] = useState('');
    const [busyAction, setBusyAction] = useState<'copy' | 'send' | null>(null);
    const [activePreviewIndex, setActivePreviewIndex] = useState(0);
    const statementSheetRef = useRef<HTMLDivElement | null>(null);
    const activePreview = previews[activePreviewIndex] ?? previews[0] ?? null;
    const totalManDay = previews.reduce((sum, preview) => sum + preview.totalManDay, 0);
    const totalAmount = previews.reduce((sum, preview) => sum + preview.totalAmount, 0);
    const payTypeAutoWarningNames = useMemo(() => {
        if (!useWorkerMasterPayType) return [];
        const missingByKey = new Map<string, string>();
        target.rows.forEach((row) => {
            if (row.workerLaborStatementPayType) return;
            const key = getSupportLaborStatementWorkerKey(row);
            if (!key || missingByKey.has(key)) return;
            missingByKey.set(key, row.workerName || row.workerId || '이름 없음');
        });
        return Array.from(missingByKey.values());
    }, [target.rows, useWorkerMasterPayType]);
    const statementText = useMemo(
        () => buildSupportClientLaborStatementText(target, previews, yearMonth),
        [target, previews, yearMonth]
    );
    const shareTitle = `노무비 지급 명세서_${yearMonth}_${target.title}`;
    const imageFileName = `${sanitizeFileNamePart(shareTitle)}.png`;
    const outputStatementKey = statementKey || `support-client-site::${yearMonth}::${target.title}`;

    const buildLaborStatementOutput = useCallback((): StatementOutputRecord => {
        const firstRow = target.rows[0];
        const firstPreview = previews[0];

        return {
            source: outputSource,
            statementKey: outputStatementKey,
            kind: 'labor',
            status: statementOptionPreset,
            yearMonth,
            targetTitle: target.title,
            targetSubtitle: target.subtitle,
            siteId: firstRow?.siteId,
            siteName: firstPreview?.siteName || firstRow?.siteName || target.title,
            clientCompanyName: firstRow?.clientCompanyName || firstRow?.constructorCompanyName || target.title,
            teamName: firstRow?.responsibleTeamName || firstRow?.sourceTeamName,
            documentTitle: shareTitle,
            amountSummary: {
                manDay: totalManDay,
                supplyAmount: totalAmount,
                totalAmount,
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
                previewCount: previews.length,
                workerCount: target.rows.length,
                previews: previews.map((preview) => ({
                    key: preview.key,
                    siteName: preview.siteName,
                    totalManDay: preview.totalManDay,
                    totalAmount: preview.totalAmount,
                    workerCount: preview.rows.length,
                })),
            },
        };
    }, [
        delegateAccountHolder,
        delegateAccountNumber,
        delegateBankName,
        outputSource,
        outputStatementKey,
        previews,
        shareTitle,
        statementOptionPreset,
        statementOptions.unitPriceOverride,
        statementViewOptions,
        target.rows,
        target.subtitle,
        target.title,
        totalAmount,
        totalManDay,
        useWorkerMasterPayType,
        workerPayTypes,
        yearMonth,
    ]);

    useEffect(() => {
        setActivePreviewIndex(0);
    }, [target.title, previews.length]);

    const applyLaborStatementDefaults = useCallback((preset: StatementIssueOptionPreset) => {
        const defaults = loadSupportClientLaborStatementDefaults(preset);
        setShowBankColumn(defaults.showBankColumn);
        setShowBillingColumns(defaults.showBillingColumns);
        setIsSplitView(defaults.isSplitView);
        setShowBankUnderAddress(defaults.showBankUnderAddress);
        setShowTeamUnderName(defaults.showTeamUnderName);
        setUseWorkerMasterPayType(defaults.useWorkerMasterPayType);
        setWorkerPayTypes(buildSupportWorkerPayTypesFromDefaults(target.rows, defaults.useWorkerMasterPayType, defaults));
        setBulkUnitPriceInput(defaults.unitPriceOverride > 0 ? String(defaults.unitPriceOverride) : '');
        setAppliedBulkUnitPrice(defaults.unitPriceOverride);
        setDelegateBankName(defaults.delegateBankName);
        setDelegateAccountHolder(defaults.delegateAccountHolder);
        setDelegateAccountNumber(defaults.delegateAccountNumber);
    }, [target.rows]);

    useEffect(() => {
        applyLaborStatementDefaults(statementOptionPreset);
    }, [applyLaborStatementDefaults, statementOptionPreset]);

    useEffect(() => {
        let mounted = true;
        const companyName = String(
            target.rows.find((row) => row.constructorCompanyName)?.constructorCompanyName ||
            target.title ||
            ''
        ).trim();

        const loadDelegateAccount = async () => {
            if (!companyName) return;
            const defaults = loadSupportClientLaborStatementDefaults(statementOptionPreset);
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
                console.warn('[SupportClientSitePage] delegate account load failed:', delegateAccountError);
            }
        };

        void loadDelegateAccount();

        return () => {
            mounted = false;
        };
    }, [statementOptionPreset, target.rows, target.title]);

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
        setWorkerPayTypes(buildSupportWorkerPayTypesFromDefaults(
            target.rows,
            checked,
            loadSupportClientLaborStatementDefaults(statementOptionPreset)
        ));
    }, [statementOptionPreset, target.rows]);

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
            await onOutputSaved?.();
            setStatusMessage(`${label} 노임명세 옵션을 저장하고 문서대장에 반영했습니다.`);
        } catch (error) {
            console.error('[SupportClientSitePage] labor statement output save failed:', error);
            setStatusMessage(`${label} 노임명세 옵션은 저장했지만 문서대장 반영에 실패했습니다.`);
        }
    }, [
        appliedBulkUnitPrice,
        buildLaborStatementOutput,
        delegateAccountHolder,
        delegateAccountNumber,
        delegateBankName,
        isSplitView,
        onOutputSaved,
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
            await copyPngBlobToClipboard(blob, '노무비 지급 명세서');
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
                        {target.title}{target.subtitle ? ` · ${target.subtitle}` : ''}
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
                        <div className="mt-1 text-sm font-black text-slate-900">{target.title}</div>
                        {target.subtitle && <div className="mt-1 text-[11px] font-bold text-slate-500">{target.subtitle}</div>}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-[11px] font-black text-slate-500">총공수</div>
                        <div className="mt-1 text-sm font-black text-slate-900">{formatManDayText(totalManDay)}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-emerald-50 p-4">
                        <div className="text-[11px] font-black text-emerald-700">청구합계</div>
                        <div className="mt-1 text-sm font-black text-emerald-800">{formatCurrencyText(totalAmount)}</div>
                    </div>
                </div>

                {payTypeAutoWarningNames.length > 0 && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                        <div className="flex items-center gap-2">
                            <FontAwesomeIcon icon={faTriangleExclamation} />
                            <span>직불/위임 자동선택 경고</span>
                        </div>
                        <div className="mt-1 leading-5 text-amber-700">
                            작업자 DB의 직불여부가 없거나 작업자 매칭이 되지 않아 기본 지급구분으로 적용했습니다:
                            {' '}
                            {payTypeAutoWarningNames.slice(0, 6).join(', ')}
                            {payTypeAutoWarningNames.length > 6 ? ` 외 ${payTypeAutoWarningNames.length - 6}명` : ''}
                        </div>
                    </div>
                )}

                {previews.length > 1 && (
                    <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-3">
                        {previews.map((preview, index) => (
                            <button
                                key={`${preview.key}:tab`}
                                type="button"
                                onClick={() => setActivePreviewIndex(index)}
                                className={`rounded-lg px-3 py-1.5 text-xs font-black transition ${
                                    activePreviewIndex === index
                                        ? 'bg-emerald-600 text-white shadow-sm'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                {preview.siteName}
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
                            <input type="checkbox" checked={showBankColumn} onChange={(event) => setShowBankColumn(event.target.checked)} className="accent-emerald-600" />
                            계좌/지급구분
                        </label>
                        <label className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-700">
                            <input
                                type="checkbox"
                                data-testid="support-labor-statement-billing-columns-toggle"
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
                            <SupportClientLaborStatementPreview
                                target={target}
                                preview={activePreview}
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

export const SupportClientTransactionStatementPanel: React.FC<{
    panelKey: string;
    target: SupportStatementTarget;
    yearMonth: string;
    mode: SupportTransactionStatementMode;
    linkedStatements: Estimate[];
    allStatements: Estimate[];
    loading: boolean;
    onSaved: () => Promise<void> | void;
    outputSource?: StatementOutputSource;
    onOutputSaved?: () => Promise<void> | void;
    onClose: () => void;
}> = ({ panelKey, target, yearMonth, mode, linkedStatements, allStatements, loading, onSaved, outputSource = 'support-client-site', onOutputSaved, onClose }) => {
    const [statementOptionPreset, setStatementOptionPreset] = useState<StatementIssueOptionPreset>(() => loadStatementIssueOptionPreset());
    const linkedStatementIds = linkedStatements.map((statement) => statement.id || '').join('|');
    const getInitialDraft = useCallback((preset: StatementIssueOptionPreset) => {
        const linkedStatement = linkedStatements[0];
        const initialDraft = linkedStatement
            ? buildSupportTransactionDraftFromEstimate(linkedStatement, target, yearMonth, panelKey)
            : buildSupportTransactionDraft(target, yearMonth, panelKey, mode);
        return linkedStatement
            ? initialDraft
            : applySupportTransactionStatementOptions(initialDraft, loadSupportTransactionStatementOptions(mode, preset));
    }, [linkedStatementIds, mode, panelKey, target, yearMonth]);
    const [draft, setDraft] = useState<SupportTransactionStatementDraft>(() => getInitialDraft(statementOptionPreset));
    const [saving, setSaving] = useState(false);
    const [linking, setLinking] = useState(false);
    const [selectedExistingStatementId, setSelectedExistingStatementId] = useState('');
    const [statusMessage, setStatusMessage] = useState('');
    const [rentalMaterials, setRentalMaterials] = useState<Material[]>([]);
    const [rentalRates, setRentalRates] = useState<RentalMaterialRate[]>([]);
    const [rentalSettingsOpen, setRentalSettingsOpen] = useState(false);
    const [rentalRateSearch, setRentalRateSearch] = useState('');
    const [rentalWorkType, setRentalWorkType] = useState<RentalWorkType>(() =>
        loadSupportTransactionStatementOptions(mode, statementOptionPreset).rentalWorkType ?? 'shoring'
    );
    const [rentalTargetAmount, setRentalTargetAmount] = useState(() => {
        const amount = getSupportTransactionTargetAmount(target, yearMonth);
        return amount > 0 ? formatNumber(amount) : '';
    });
    const [rentalAmountBasis, setRentalAmountBasis] = useState<RentalAmountBasis>(() =>
        loadSupportTransactionStatementOptions(mode, statementOptionPreset).rentalAmountBasis ?? 'supply'
    );
    const [rentalUsageDays, setRentalUsageDays] = useState(() =>
        loadSupportTransactionStatementOptions(mode, statementOptionPreset).rentalUsageDays ?? 26
    );
    const [rentalRowCount, setRentalRowCount] = useState(() =>
        loadSupportTransactionStatementOptions(mode, statementOptionPreset).rentalRowCount ?? 10
    );
    const [lastRentalGeneration, setLastRentalGeneration] = useState<RentalGenerationResult | null>(null);
    const linkableStatements = useMemo(() =>
        allStatements.filter((statement) =>
            statement.id &&
            statement.documentType === 'transaction' &&
            isEstimateTransactionMode(statement, mode) &&
            !statement.supportStatementKey
        ),
    [allStatements, mode]);

    const applyTransactionOptionControls = useCallback((options: SupportTransactionStatementOptionDefaults) => {
        if (options.rentalAmountBasis) setRentalAmountBasis(options.rentalAmountBasis);
        if (options.rentalUsageDays) setRentalUsageDays(options.rentalUsageDays);
        if (options.rentalRowCount) setRentalRowCount(options.rentalRowCount);
        if (options.rentalWorkType) setRentalWorkType(options.rentalWorkType);
    }, []);

    useEffect(() => {
        const options = loadSupportTransactionStatementOptions(mode, statementOptionPreset);
        setDraft(getInitialDraft(statementOptionPreset));
        applyTransactionOptionControls(options);
        setStatusMessage('');
        setLastRentalGeneration(null);
        if (mode === 'rental') {
            const amount = getSupportTransactionTargetAmount(target, yearMonth);
            setRentalTargetAmount(amount > 0 ? formatNumber(amount) : '');
        }
    }, [applyTransactionOptionControls, getInitialDraft, mode, target, yearMonth]);

    const loadRentalMaterials = useCallback(async () => {
        try {
            const materials = await materialService.getUniqueMaterialsForSelection();
            const mergedRates = mergeRentalRatesWithMaterials(materials, readStoredSupportRentalRates());
            setRentalMaterials(materials);
            setRentalRates(mergedRates);
        } catch (error) {
            console.error('[SupportClientSitePage] rental materials load failed:', error);
            setStatusMessage('임대 자재 정보를 불러오는 중 문제가 발생했습니다.');
        }
    }, []);

    useEffect(() => {
        if (mode === 'rental') {
            loadRentalMaterials();
        }
    }, [loadRentalMaterials, mode]);

    useEffect(() => {
        if (rentalRates.length > 0) {
            writeStoredSupportRentalRates(rentalRates);
        }
    }, [rentalRates]);

    const isRentalTransaction = draft.estimateMode === 'rental';
    const statementTitle = isRentalTransaction ? '임대 거래명세서' : '거래명세서';

    const itemsWithCalc = useMemo(() => draft.items.map((item) => {
        if (isRentalTransaction) {
            const amount = calculateRentalLineAmount(item);
            return {
                ...item,
                amount,
                rentalAmount: amount,
                unitPrice: item.finalUnitPrice || 0,
            };
        }

        const amount = (item.finalUnitPrice || 0) * (item.quantity || 0);
        return { ...item, amount };
    }), [draft.items, isRentalTransaction]);

    const { subtotal, tax, total } = useMemo(() => {
        const baseSubtotal = itemsWithCalc.reduce((sum, item) => sum + (item.amount || 0), 0);
        const taxableSubtotal = Math.max(0, baseSubtotal - (draft.discount || 0));
        const taxAmount = draft.includeVat ? Math.round(taxableSubtotal * ((draft.vatRate || 10) / 100)) : 0;
        return {
            subtotal: baseSubtotal,
            tax: taxAmount,
            total: taxableSubtotal + taxAmount
        };
    }, [draft.discount, draft.includeVat, draft.vatRate, itemsWithCalc]);

    const buildTransactionStatementOutput = useCallback((
        documentId = draft.id,
        sourceDraft: SupportTransactionStatementDraft = draft
    ): StatementOutputRecord => {
        const outputItems = (sourceDraft.items || []).map((item) => {
            if (sourceDraft.estimateMode === 'rental') {
                const amount = calculateRentalLineAmount(item);
                return {
                    ...item,
                    amount,
                    rentalAmount: amount,
                    unitPrice: item.finalUnitPrice || 0,
                };
            }

            const amount = (item.finalUnitPrice || 0) * (item.quantity || 0);
            return { ...item, amount };
        });
        const outputSubtotal = outputItems.reduce((sum, item) => sum + (item.amount || 0), 0);
        const taxableSubtotal = Math.max(0, outputSubtotal - (sourceDraft.discount || 0));
        const outputTax = sourceDraft.includeVat !== false
            ? Math.round(taxableSubtotal * ((sourceDraft.vatRate || 10) / 100))
            : 0;
        const outputTotal = taxableSubtotal + outputTax;
        const firstRow = target.rows[0];
        const outputKind = sourceDraft.estimateMode === 'rental' ? 'rental' : 'transaction';

        return {
            source: outputSource,
            statementKey: panelKey,
            kind: outputKind,
            status: statementOptionPreset,
            yearMonth,
            targetTitle: target.title,
            targetSubtitle: target.subtitle,
            siteId: firstRow?.siteId,
            siteName: firstRow?.siteName || sourceDraft.projectName || target.title,
            clientCompanyName: sourceDraft.clientCompany || firstRow?.clientCompanyName || firstRow?.constructorCompanyName,
            teamName: firstRow?.responsibleTeamName || firstRow?.sourceTeamName,
            documentId,
            documentNo: sourceDraft.estimateNo,
            documentTitle: sourceDraft.title || (outputKind === 'rental' ? '임대명세서' : '거래명세서'),
            amountSummary: {
                supplyAmount: outputSubtotal,
                vatAmount: outputTax,
                totalAmount: outputTotal,
            },
            optionPreset: statementOptionPreset,
            optionSnapshot: {
                includeVat: sourceDraft.includeVat !== false,
                vatRate: sourceDraft.vatRate || 10,
                paymentTerms: sourceDraft.paymentTerms || '',
                notes: sourceDraft.notes || '',
                rentalAmountBasis,
                rentalUsageDays,
                rentalRowCount,
                rentalWorkType,
            },
            snapshot: {
                itemCount: outputItems.length,
                discount: sourceDraft.discount || 0,
                issueDate: sourceDraft.issueDate || '',
                items: outputItems.map((item) => ({
                    id: item.id,
                    label: item.label,
                    section: item.section,
                    quantity: item.quantity,
                    unit: item.unit,
                    unitPrice: item.finalUnitPrice || item.unitPrice || 0,
                    amount: item.amount || 0,
                })),
                rentalGeneration: lastRentalGeneration ? {
                    targetSupply: lastRentalGeneration.targetSupply,
                    subtotal: lastRentalGeneration.subtotal,
                    difference: lastRentalGeneration.difference,
                    itemCount: lastRentalGeneration.items.length,
                } : undefined,
            },
        };
    }, [
        draft,
        lastRentalGeneration,
        outputSource,
        panelKey,
        rentalAmountBasis,
        rentalRowCount,
        rentalUsageDays,
        rentalWorkType,
        statementOptionPreset,
        target.rows,
        target.subtitle,
        target.title,
        yearMonth,
    ]);

    const updateDraft = useCallback((field: keyof EstimateDraft, value: any) => {
        setDraft((prev) => ({ ...prev, [field]: value }));
    }, []);

    const updateItem = useCallback((itemId: string, field: string, value: any) => {
        setDraft((prev) => ({
            ...prev,
            items: prev.items.map((item) => {
                if (item.id !== itemId) return item;
                const nextItem = { ...item, [field]: value };
                if (field === 'finalUnitPrice') nextItem.unitPrice = value;
                return nextItem;
            })
        }));
    }, []);

    const rentalRatesForSelectedWorkType = useMemo(() => (
        rentalRates.filter((rate) => isRentalRateInWorkType(rate, rentalWorkType))
    ), [rentalRates, rentalWorkType]);

    const filteredRentalRates = useMemo(() => {
        const keyword = rentalRateSearch.trim().toLowerCase();
        if (!keyword) return rentalRatesForSelectedWorkType;
        return rentalRatesForSelectedWorkType.filter((rate) => (
            `${rate.category} ${rate.itemName} ${rate.spec} ${rate.unit}`.toLowerCase().includes(keyword)
        ));
    }, [rentalRateSearch, rentalRatesForSelectedWorkType]);

    const rentalActiveCount = rentalRatesForSelectedWorkType.filter((rate) => rate.active !== false).length;

    const updateRentalRate = useCallback((materialId: string, field: keyof RentalMaterialRate, value: any) => {
        setRentalRates((prev) => prev.map((rate) => (
            rate.materialId === materialId ? { ...rate, [field]: value } : rate
        )));
        setLastRentalGeneration(null);
    }, []);

    const resetRentalRatesFromMaster = useCallback(() => {
        setRentalRates(mergeRentalRatesWithMaterials(rentalMaterials, []));
        setLastRentalGeneration(null);
    }, [rentalMaterials]);

    const applyRentalGeneration = useCallback(() => {
        const targetAmount = parseSupportMoneyInput(rentalTargetAmount);
        if (targetAmount <= 0) {
            setStatusMessage('자동 생성할 목표 금액을 입력해주세요.');
            return;
        }
        if (rentalActiveCount === 0) {
            setStatusMessage(`${SUPPORT_RENTAL_WORK_TYPE_LABELS[rentalWorkType]} 자재를 1개 이상 선택해주세요.`);
            return;
        }

        const result = generateRentalTransactionItems(rentalRates, {
            targetAmount,
            amountBasis: rentalAmountBasis,
            usageDays: rentalUsageDays,
            rowCount: rentalRowCount,
            vatRate: draft.vatRate || 10,
            includeVat: draft.includeVat !== false,
            issueDate: draft.issueDate || new Date().toISOString().split('T')[0],
            workType: rentalWorkType,
        });

        if (result.items.length === 0) {
            setStatusMessage('조건에 맞는 임대 자재 품목을 생성하지 못했습니다. 단가 설정을 확인해주세요.');
            return;
        }

        setDraft((prev) => ({
            ...prev,
            estimateMode: 'rental',
            title: '임대 거래명세서',
            notes: '',
            items: result.items,
        }));
        setLastRentalGeneration(result);
        setStatusMessage(`임대 품목 ${result.items.length}개를 공급가 ${formatNumber(result.subtotal)}원 기준으로 생성했습니다.`);
    }, [
        draft.includeVat,
        draft.issueDate,
        draft.vatRate,
        rentalActiveCount,
        rentalAmountBasis,
        rentalRates,
        rentalRowCount,
        rentalTargetAmount,
        rentalUsageDays,
        rentalWorkType,
    ]);

    const handleExcelDownload = useCallback(async () => {
        try {
            await downloadEstimateExcel(draft, itemsWithCalc, subtotal, tax, total, 'transaction', { freezePanes: false });
            setStatusMessage(`${statementTitle} 엑셀 파일을 생성했습니다.`);
        } catch (error) {
            console.error('[SupportClientSitePage] transaction statement excel download failed:', error);
            setStatusMessage('엑셀 파일 생성 중 문제가 발생했습니다.');
        }
    }, [draft, itemsWithCalc, statementTitle, subtotal, tax, total]);

    const handleNewStatement = useCallback(() => {
        const options = loadSupportTransactionStatementOptions(mode, statementOptionPreset);
        setDraft(applySupportTransactionStatementOptions(
            buildSupportTransactionDraft(target, yearMonth, panelKey, mode),
            options
        ));
        applyTransactionOptionControls(options);
        setLastRentalGeneration(null);
        setStatusMessage(`새 ${statementTitle}를 작성 중입니다.`);
    }, [applyTransactionOptionControls, mode, panelKey, statementOptionPreset, statementTitle, target, yearMonth]);

    const handleLoadStatement = useCallback((statement: Estimate) => {
        setDraft(buildSupportTransactionDraftFromEstimate(statement, target, yearMonth, panelKey));
        setLastRentalGeneration(null);
        setStatusMessage(`연동된 ${statementTitle}를 불러왔습니다.`);
    }, [panelKey, statementTitle, target, yearMonth]);

    const handleLinkExistingStatement = async () => {
        const statement = linkableStatements.find((candidate) => candidate.id === selectedExistingStatementId);
        if (!statement?.id) {
            setStatusMessage(`연결할 ${statementTitle}를 선택해주세요.`);
            return;
        }

        try {
            setLinking(true);
            await estimateService.updateEstimate(statement.id, getSupportTransactionLinkFields(panelKey, target, yearMonth, outputSource));
            const linkedDraft = buildSupportTransactionDraftFromEstimate(statement, target, yearMonth, panelKey);
            setDraft(linkedDraft);
            await statementOutputService.upsertOutput(buildTransactionStatementOutput(statement.id, linkedDraft));
            setSelectedExistingStatementId('');
            setStatusMessage(`기존 ${statementTitle}를 이 행에 연결했습니다.`);
            await onSaved();
            await onOutputSaved?.();
        } catch (error) {
            console.error('[SupportClientSitePage] transaction statement link failed:', error);
            setStatusMessage(`기존 ${statementTitle} 연결 중 문제가 발생했습니다.`);
        } finally {
            setLinking(false);
        }
    };

    const handleStatementOptionPresetChange = useCallback((value: StatementIssueOptionPreset) => {
        setStatementOptionPreset(value);
        saveStatementIssueOptionPreset(value);
        const options = loadSupportTransactionStatementOptions(mode, value);
        setDraft((prev) => applySupportTransactionStatementOptions(prev, options));
        applyTransactionOptionControls(options);
        const label = STATEMENT_ISSUE_OPTION_PRESETS.find((option) => option.value === value)?.label ?? '선택';
        setStatusMessage(`${label} ${statementTitle} 옵션을 불러왔습니다.`);
    }, [applyTransactionOptionControls, mode, statementTitle]);

    const handleSaveStatementOptions = useCallback(async () => {
        saveSupportTransactionStatementOptions(mode, statementOptionPreset, {
            includeVat: draft.includeVat !== false,
            vatRate: draft.vatRate || 10,
            paymentTerms: draft.paymentTerms || '',
            notes: draft.notes || '',
            rentalAmountBasis,
            rentalUsageDays,
            rentalRowCount,
            rentalWorkType,
        });
        const label = STATEMENT_ISSUE_OPTION_PRESETS.find((option) => option.value === statementOptionPreset)?.label ?? '선택';
        try {
            await statementOutputService.upsertOutput(buildTransactionStatementOutput());
            await onOutputSaved?.();
            setStatusMessage(`${label} ${statementTitle} 옵션을 저장하고 문서대장에 반영했습니다.`);
        } catch (error) {
            console.error('[SupportClientSitePage] transaction statement output option save failed:', error);
            setStatusMessage(`${label} ${statementTitle} 옵션은 저장했지만 문서대장 반영에 실패했습니다.`);
        }
    }, [
        buildTransactionStatementOutput,
        draft.includeVat,
        draft.notes,
        draft.paymentTerms,
        draft.vatRate,
        mode,
        onOutputSaved,
        rentalAmountBasis,
        rentalRowCount,
        rentalUsageDays,
        rentalWorkType,
        statementOptionPreset,
        statementTitle,
    ]);

    const handleSave = async () => {
        const title = String(draft.title || '').trim();
        const clientCompany = String(draft.clientCompany || '').trim();
        const projectName = String(draft.projectName || '').trim();
        if (!title || !clientCompany || !projectName) {
            setStatusMessage('업체명, 현장명, 제목을 입력해주세요.');
            return;
        }

        try {
            setSaving(true);
            const payload = {
                ...draft,
                ...getSupportTransactionLinkFields(panelKey, target, yearMonth, outputSource),
                documentType: 'transaction' as DocumentType,
                estimateMode: isRentalTransaction ? 'rental' as const : 'standard' as const,
                title,
                clientCompany,
                projectName,
                items: itemsWithCalc,
                subtotal,
                tax,
                total
            };
            const { id, ...savePayload } = payload;
            let savedId = id;

            if (id) {
                await estimateService.updateEstimate(id, savePayload as Partial<Estimate>);
                setStatusMessage(`${statementTitle}가 수정되었습니다.`);
            } else {
                const newId = await estimateService.addEstimate(savePayload as Omit<Estimate, 'id' | 'createdAt' | 'updatedAt'>);
                savedId = newId;
                setDraft((prev) => ({ ...prev, id: newId }));
                setStatusMessage(`새 ${statementTitle}가 저장되고 이 행에 연결되었습니다.`);
            }

            await statementOutputService.upsertOutput(buildTransactionStatementOutput(
                savedId,
                { ...payload, id: savedId } as SupportTransactionStatementDraft
            ));
            await onSaved();
            await onOutputSaved?.();
        } catch (error) {
            console.error('[SupportClientSitePage] transaction statement save failed:', error);
            setStatusMessage('저장 중 문제가 발생했습니다. 다시 시도해주세요.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-4 rounded-2xl border border-teal-200 bg-white p-4 shadow-sm" onClick={(event) => event.stopPropagation()}>
            <div className="flex flex-col gap-3 border-b border-teal-100 pb-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <h3 className="flex items-center gap-2 text-base font-black text-slate-900">
                        <FontAwesomeIcon icon={faFileInvoice} className={isRentalTransaction ? 'text-amber-600' : 'text-teal-600'} />
                        {statementTitle}
                    </h3>
                    <p className="mt-1 text-xs font-bold text-slate-500">
                        {target.title}{target.subtitle ? ` · ${target.subtitle}` : ''}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={handleNewStatement}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-3 text-xs font-black text-teal-700 transition hover:bg-teal-100"
                    >
                        <FontAwesomeIcon icon={faPlus} />
                        {mode === 'rental' ? '새 임대명세' : '새 거래명세'}
                    </button>
                    <button
                        type="button"
                        onClick={handleExcelDownload}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-black text-emerald-700 transition hover:bg-emerald-100"
                    >
                        <FontAwesomeIcon icon={faDownload} />
                        엑셀
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label={`${statementTitle} 닫기`}
                        title="닫기"
                        className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 transition hover:bg-slate-50"
                    >
                        <FontAwesomeIcon icon={faXmark} />
                        닫기
                    </button>
                </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.2fr)]">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                        <div className="text-xs font-black text-slate-600">연동된 {statementTitle}</div>
                        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-black text-teal-700">
                            {linkedStatements.length}건
                        </span>
                    </div>
                    <div className="mt-3 max-h-40 space-y-2 overflow-auto">
                        {loading ? (
                            <div className="rounded-lg border border-slate-200 bg-white px-3 py-3 text-xs font-bold text-slate-400">
                                불러오는 중...
                            </div>
                        ) : linkedStatements.length > 0 ? linkedStatements.map((statement) => (
                            <button
                                key={statement.id}
                                type="button"
                                onClick={() => handleLoadStatement(statement)}
                                className={`block w-full rounded-lg border px-3 py-2 text-left transition ${
                                    draft.id === statement.id
                                        ? 'border-teal-400 bg-teal-50 text-teal-900'
                                        : 'border-slate-200 bg-white text-slate-700 hover:border-teal-200 hover:bg-teal-50/50'
                                }`}
                            >
                                <div className="truncate text-xs font-black">{statement.projectName || statement.title || '거래명세표'}</div>
                                <div className="mt-1 flex items-center justify-between gap-2 text-[11px] font-bold text-slate-500">
                                    <span className="truncate">{statement.clientCompany || '업체명 미입력'}</span>
                                    <span className="shrink-0 font-mono">{formatNumber(statement.total || 0)}원</span>
                                </div>
                                <div className="mt-0.5 text-[10px] font-bold text-slate-400">{statement.issueDate || '-'}</div>
                            </button>
                        )) : (
                            <div className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-4 text-xs font-bold text-slate-400">
                                아직 연결된 {statementTitle}가 없습니다.
                            </div>
                        )}
                    </div>
                    <div className="mt-3 rounded-lg border border-teal-100 bg-white p-2">
                        <div className="mb-1 text-[11px] font-black text-slate-500">기존 {statementTitle} 연결</div>
                        <div className="flex gap-1.5">
                            <select
                                value={selectedExistingStatementId}
                                onChange={(event) => setSelectedExistingStatementId(event.target.value)}
                                disabled={loading || linking || linkableStatements.length === 0}
                                className="h-8 min-w-0 flex-1 rounded-md border border-slate-200 bg-slate-50 px-2 text-xs font-bold text-slate-700 outline-none focus:border-teal-500 disabled:text-slate-400"
                            >
                                <option value="">
                                    {linkableStatements.length > 0 ? `${statementTitle} 선택` : `연결 가능한 ${statementTitle} 없음`}
                                </option>
                                {linkableStatements.map((statement) => (
                                    <option key={statement.id} value={statement.id}>
                                        {[statement.projectName || statement.title || '거래명세표', statement.clientCompany, statement.issueDate]
                                            .filter(Boolean)
                                            .join(' / ')}
                                    </option>
                                ))}
                            </select>
                            <button
                                type="button"
                                onClick={handleLinkExistingStatement}
                                disabled={loading || linking || !selectedExistingStatementId}
                                className="inline-flex h-8 items-center rounded-md bg-teal-600 px-2 text-xs font-black text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {linking ? '연결 중' : '연결'}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="grid gap-2 md:grid-cols-6">
                        <label className="block">
                            <span className="text-[11px] font-black text-slate-500">업체명</span>
                            <input
                                type="text"
                                value={draft.clientCompany || ''}
                                onChange={(event) => updateDraft('clientCompany', event.target.value)}
                                className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-bold outline-none focus:border-teal-500 focus:bg-white"
                                placeholder="수기 입력"
                            />
                        </label>
                        <label className="block">
                            <span className="text-[11px] font-black text-slate-500">현장명</span>
                            <input
                                type="text"
                                value={draft.projectName || ''}
                                onChange={(event) => updateDraft('projectName', event.target.value)}
                                className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-bold outline-none focus:border-teal-500 focus:bg-white"
                                placeholder="수기 입력"
                            />
                        </label>
                        <label className="block">
                            <span className="text-[11px] font-black text-slate-500">작성일</span>
                            <input
                                type="date"
                                value={draft.issueDate || ''}
                                onChange={(event) => updateDraft('issueDate', event.target.value)}
                                className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-bold outline-none focus:border-teal-500 focus:bg-white"
                            />
                        </label>
                        <label className="block">
                            <span className="text-[11px] font-black text-slate-500">제목</span>
                            <input
                                type="text"
                                value={draft.title || ''}
                                onChange={(event) => updateDraft('title', event.target.value)}
                                className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-bold outline-none focus:border-teal-500 focus:bg-white"
                            />
                        </label>
                        <label className="block">
                            <span className="text-[11px] font-black text-slate-500">VAT</span>
                            <select
                                value={draft.includeVat === false ? 'excluded' : 'included'}
                                onChange={(event) => updateDraft('includeVat', event.target.value === 'included')}
                                className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-bold outline-none focus:border-teal-500 focus:bg-white"
                            >
                                <option value="included">VAT 포함</option>
                                <option value="excluded">VAT 제외</option>
                            </select>
                        </label>
                        <label className="block">
                            <span className="text-[11px] font-black text-slate-500">부가세율</span>
                            <input
                                type="number"
                                min={0}
                                step={1}
                                value={draft.vatRate || 10}
                                onChange={(event) => updateDraft('vatRate', Math.max(0, Number(event.target.value) || 0))}
                                className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-right text-sm font-bold outline-none focus:border-teal-500 focus:bg-white"
                            />
                        </label>
                    </div>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-black text-slate-500">옵션 저장</span>
                                <div className="inline-flex overflow-hidden rounded-md border border-slate-200 bg-white">
                                    {STATEMENT_ISSUE_OPTION_PRESETS.map((option) => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => handleStatementOptionPresetChange(option.value)}
                                            className={`h-8 px-3 text-xs font-black transition ${
                                                statementOptionPreset === option.value
                                                    ? 'bg-teal-600 text-white'
                                                    : 'bg-white text-slate-600 hover:bg-teal-50 hover:text-teal-700'
                                            }`}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    onClick={handleSaveStatementOptions}
                                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-teal-200 bg-teal-50 px-3 text-xs font-black text-teal-700 transition hover:bg-teal-100"
                                >
                                    <FontAwesomeIcon icon={faSave} />
                                    옵션 저장
                                </button>
                            </div>
                            <div className="min-h-[20px] text-xs font-bold text-teal-700">{statusMessage}</div>
                        </div>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving}
                            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-black text-white shadow-sm transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <FontAwesomeIcon icon={saving ? faSpinner : faSave} spin={saving} />
                            {saving ? '저장 중...' : (draft.id ? `${statementTitle} 수정` : `${statementTitle} 저장`)}
                        </button>
                    </div>
                </div>
            </div>

            {isRentalTransaction && (
                <section className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-sm font-black text-slate-900">임대 금액 자동 생성</h4>
                                <span className="rounded-lg bg-white px-2 py-1 text-[11px] font-black text-amber-700">
                                    사용 {rentalActiveCount} / 선택 {rentalRatesForSelectedWorkType.length}
                                </span>
                            </div>
                            {lastRentalGeneration && (
                                <div className="mt-2 flex flex-wrap gap-2 text-[12px] font-bold text-slate-600">
                                    <span>목표 공급가 {formatNumber(lastRentalGeneration.targetSupply)}원</span>
                                    <span>생성 공급가 {formatNumber(lastRentalGeneration.subtotal)}원</span>
                                    <span className={lastRentalGeneration.difference === 0 ? 'text-emerald-600' : 'text-rose-600'}>
                                        차이 {formatNumber(lastRentalGeneration.difference)}원
                                    </span>
                                </div>
                            )}
                        </div>

                        <div className="grid w-full grid-cols-2 gap-2 md:grid-cols-6 xl:w-auto xl:min-w-[920px]">
                            <label className="col-span-2 md:col-span-1">
                                <span className="mb-1 block text-[11px] font-black text-slate-500">임대 항목</span>
                                <select
                                    value={rentalWorkType}
                                    onChange={(event) => {
                                        setRentalWorkType(event.target.value as RentalWorkType);
                                        setLastRentalGeneration(null);
                                    }}
                                    className="h-10 w-full rounded-lg border border-amber-200 bg-white px-3 text-sm font-bold outline-none focus:border-amber-500"
                                >
                                    <option value="shoring">시스템 동바리</option>
                                    <option value="scaffold">시스템 비계</option>
                                </select>
                            </label>
                            <label className="col-span-2 md:col-span-1">
                                <span className="mb-1 block text-[11px] font-black text-slate-500">목표 금액</span>
                                <input
                                    value={rentalTargetAmount}
                                    onChange={(event) => setRentalTargetAmount(event.target.value)}
                                    onBlur={() => setRentalTargetAmount(rentalTargetAmount ? formatNumber(parseSupportMoneyInput(rentalTargetAmount)) : '')}
                                    inputMode="numeric"
                                    className="h-10 w-full rounded-lg border border-amber-200 bg-white px-3 text-right text-sm font-black outline-none focus:border-amber-500"
                                    placeholder="0"
                                />
                            </label>
                            <label>
                                <span className="mb-1 block text-[11px] font-black text-slate-500">금액 기준</span>
                                <select
                                    value={rentalAmountBasis}
                                    onChange={(event) => setRentalAmountBasis(event.target.value as RentalAmountBasis)}
                                    className="h-10 w-full rounded-lg border border-amber-200 bg-white px-3 text-sm font-bold outline-none focus:border-amber-500"
                                >
                                    <option value="supply">공급가</option>
                                    <option value="total">VAT 포함</option>
                                </select>
                            </label>
                            <label>
                                <span className="mb-1 block text-[11px] font-black text-slate-500">사용일수</span>
                                <input
                                    type="number"
                                    min={1}
                                    value={rentalUsageDays}
                                    onChange={(event) => setRentalUsageDays(Math.max(1, Number(event.target.value) || 1))}
                                    className="h-10 w-full rounded-lg border border-amber-200 bg-white px-3 text-right text-sm font-bold outline-none focus:border-amber-500"
                                />
                            </label>
                            <label>
                                <span className="mb-1 block text-[11px] font-black text-slate-500">자재 수</span>
                                <input
                                    type="number"
                                    min={1}
                                    max={30}
                                    value={rentalRowCount}
                                    onChange={(event) => setRentalRowCount(Math.max(1, Math.min(30, Number(event.target.value) || 1)))}
                                    className="h-10 w-full rounded-lg border border-amber-200 bg-white px-3 text-right text-sm font-bold outline-none focus:border-amber-500"
                                />
                            </label>
                            <div className="flex items-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setRentalSettingsOpen((open) => !open)}
                                    className="h-10 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-black text-slate-600 transition hover:border-amber-400 hover:text-amber-700"
                                >
                                    단가 설정
                                </button>
                                <button
                                    type="button"
                                    onClick={applyRentalGeneration}
                                    className="h-10 flex-1 rounded-lg bg-amber-600 px-3 text-[12px] font-black text-white shadow-sm transition hover:bg-amber-700"
                                >
                                    적용
                                </button>
                            </div>
                        </div>
                    </div>

                    {rentalSettingsOpen && (
                        <div className="mt-4 border-t border-amber-100 pt-4">
                            <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                <input
                                    value={rentalRateSearch}
                                    onChange={(event) => setRentalRateSearch(event.target.value)}
                                    className="h-9 w-full rounded-lg border border-amber-200 bg-white px-3 text-sm font-bold outline-none focus:border-amber-500 md:max-w-sm"
                                    placeholder="분류, 품목, 규격 검색"
                                />
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={loadRentalMaterials}
                                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-black text-slate-600 hover:border-slate-300"
                                    >
                                        자재 새로고침
                                    </button>
                                    <button
                                        type="button"
                                        onClick={resetRentalRatesFromMaster}
                                        className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-[12px] font-black text-amber-700 hover:bg-amber-100"
                                    >
                                        단가 초기화
                                    </button>
                                </div>
                            </div>
                            <div className="max-h-[300px] overflow-auto rounded-xl border border-amber-100 bg-white">
                                <table className="w-full min-w-[900px] text-sm">
                                    <thead className="sticky top-0 z-10 bg-slate-100 text-[12px] text-slate-600">
                                        <tr>
                                            <th className="w-16 px-3 py-2 text-center font-black">사용</th>
                                            <th className="px-3 py-2 text-left font-black">분류</th>
                                            <th className="px-3 py-2 text-left font-black">품목</th>
                                            <th className="px-3 py-2 text-left font-black">규격</th>
                                            <th className="w-20 px-3 py-2 text-center font-black">단위</th>
                                            <th className="w-28 px-3 py-2 text-right font-black">기본료</th>
                                            <th className="w-28 px-3 py-2 text-right font-black">일 임대료</th>
                                            <th className="w-28 px-3 py-2 text-right font-black">최대수량</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredRentalRates.map((rate) => (
                                            <tr key={rate.materialId} className="hover:bg-amber-50/60">
                                                <td className="px-3 py-2 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={rate.active !== false}
                                                        onChange={(event) => updateRentalRate(rate.materialId, 'active', event.target.checked)}
                                                        className="h-4 w-4 rounded border-slate-300 text-amber-600"
                                                    />
                                                </td>
                                                <td className="px-3 py-2 font-bold text-slate-700">{rate.category}</td>
                                                <td className="px-3 py-2 font-black text-slate-900">{rate.itemName}</td>
                                                <td className="px-3 py-2 text-slate-600">{rate.spec || '-'}</td>
                                                <td className="px-3 py-2 text-center font-bold text-slate-600">{rate.unit}</td>
                                                <td className="px-3 py-2">
                                                    <input
                                                        type="number"
                                                        value={rate.baseFee}
                                                        onChange={(event) => updateRentalRate(rate.materialId, 'baseFee', Math.max(0, Number(event.target.value) || 0))}
                                                        className="h-8 w-full rounded-md border border-slate-200 px-2 text-right font-bold outline-none focus:border-amber-500"
                                                    />
                                                </td>
                                                <td className="px-3 py-2">
                                                    <input
                                                        type="number"
                                                        value={rate.dailyFee}
                                                        onChange={(event) => updateRentalRate(rate.materialId, 'dailyFee', Math.max(0, Number(event.target.value) || 0))}
                                                        className="h-8 w-full rounded-md border border-slate-200 px-2 text-right font-bold outline-none focus:border-amber-500"
                                                    />
                                                </td>
                                                <td className="px-3 py-2">
                                                    <input
                                                        type="number"
                                                        value={rate.maxQuantity}
                                                        onChange={(event) => updateRentalRate(rate.materialId, 'maxQuantity', Math.max(1, Number(event.target.value) || 1))}
                                                        className="h-8 w-full rounded-md border border-slate-200 px-2 text-right font-bold outline-none focus:border-amber-500"
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                        {filteredRentalRates.length === 0 && (
                                            <tr>
                                                <td colSpan={8} className="px-3 py-10 text-center text-sm font-bold text-slate-400">
                                                    표시할 자재가 없습니다.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </section>
            )}

            <div className="max-h-[64vh] overflow-auto rounded-2xl border border-slate-200 bg-slate-100 p-4">
                <div className={`inline-block ${isRentalTransaction ? 'min-w-[1240px]' : 'min-w-[1120px]'} bg-white p-8 shadow-sm`}>
                    <TitleComponent text={isRentalTransaction ? '임 대 거 래 명 세 표' : '거 래 명 세 표'} logoUrl={LOGO_FALLBACK} />
                    <InfoTableComponent draft={draft} isEdit={true} updateDraft={updateDraft} />
                    <AmountBarComponent subtotal={subtotal} totalAmt={total} taxAmt={tax} isTransaction={true} draft={draft} />
                    {isRentalTransaction ? (
                        <RentalTransactionTable draft={draft} itemsWithCalc={itemsWithCalc} isEdit={true} updateItem={updateItem} setDraft={setDraft} />
                    ) : (
                        <TransactionTable draft={draft} itemsWithCalc={itemsWithCalc} isEdit={true} updateItem={updateItem} setDraft={setDraft} />
                    )}
                    <div className="mt-4 rounded-xl border-2 border-dashed border-slate-200 p-4 text-center text-sm font-black tracking-widest text-slate-400">
                        위 금액을 정히 영수(청구)함
                    </div>
                </div>
            </div>
        </div>
    );
};

const SupportClientExpenseStatementModal: React.FC<{
    target: SupportStatementTarget;
    yearMonth: string;
    onClose: () => void;
}> = ({ target, yearMonth, onClose }) => {
    const [statusMessage, setStatusMessage] = useState('');
    const [busyAction, setBusyAction] = useState<'copy' | 'send' | null>(null);
    const statementSheetRef = useRef<HTMLDivElement | null>(null);
    const sortedClaims = useMemo(() => sortExpenseClaims(target.expenseClaims), [target.expenseClaims]);
    const totalAmount = getExpenseClaimsTotal(sortedClaims);
    const shareTitle = `후청구 경비내역_${yearMonth}_${target.title}`;
    const imageFileName = `${sanitizeFileNamePart(shareTitle)}.png`;

    const captureStatementImage = async (): Promise<Blob> => {
        if (!statementSheetRef.current) {
            throw new Error('후청구 경비내역 표 영역을 찾지 못했습니다.');
        }
        return captureElementToPngBlob(statementSheetRef.current);
    };

    const handleCopy = async () => {
        let htmlCopied = false;
        try {
            setBusyAction('copy');
            if (!statementSheetRef.current) {
                throw new Error('후청구 경비내역 표 영역을 찾지 못했습니다.');
            }
            htmlCopied = copyElementHtmlToClipboard(statementSheetRef.current);
            await copyElementToPngClipboard(statementSheetRef.current, '후청구 경비내역');
            setStatusMessage('후청구 경비내역 표 이미지를 복사했습니다.');
        } catch (error) {
            console.error('후청구 경비내역 이미지 복사 실패:', error);
            setStatusMessage(
                htmlCopied
                    ? '이미지 복사가 제한되어 후청구 경비내역 표 형식으로 복사했습니다.'
                    : '이 브라우저에서 이미지 복사를 지원하지 않습니다. 공유 버튼을 사용해 주세요.'
            );
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
        <SupportClientStatementModalShell title="경비내역서" onClose={onClose}>
            <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-[11px] font-black text-slate-500">대상</div>
                        <div className="mt-1 text-sm font-black text-slate-900">{target.title}</div>
                        {target.subtitle && <div className="mt-1 text-[11px] font-bold text-slate-500">{target.subtitle}</div>}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-[11px] font-black text-slate-500">후청구 건수</div>
                        <div className="mt-1 text-sm font-black text-slate-900">{formatNumber(sortedClaims.length)}건</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-teal-50 p-4">
                        <div className="text-[11px] font-black text-teal-700">후청구 합계</div>
                        <div className="mt-1 text-sm font-black text-teal-800">{formatNumber(totalAmount)}원</div>
                    </div>
                </div>

                <div className="overflow-auto rounded-xl border border-slate-900 bg-white">
                    <div ref={statementSheetRef} data-statement-capture="true" className="inline-block min-w-[1120px] bg-white">
                        <table className="w-full border-collapse text-xs">
                            <thead className="bg-slate-100 text-slate-700">
                            <tr>
                                <th className="border border-slate-900 px-3 py-2 text-left">일자</th>
                                <th className="border border-slate-900 px-3 py-2 text-left">현장</th>
                                <th className="border border-slate-900 px-3 py-2 text-left">사용팀</th>
                                <th className="border border-slate-900 px-3 py-2 text-left">청구대상</th>
                                <th className="border border-slate-900 px-3 py-2 text-left">구분</th>
                                <th className="border border-slate-900 px-3 py-2 text-left">내용</th>
                                <th className="border border-slate-900 px-3 py-2 text-left">상태</th>
                                <th className="border border-slate-900 px-3 py-2 text-right">금액</th>
                                <th className="border border-slate-900 px-3 py-2 text-left">메모</th>
                            </tr>
                            </thead>
                            <tbody>
                            {sortedClaims.length > 0 ? sortedClaims.map((claim) => (
                                <tr key={getExpenseClaimKey(claim)}>
                                    <td className="border border-slate-900 px-3 py-2 font-mono text-slate-500">{claim.date}</td>
                                    <td className="border border-slate-900 px-3 py-2 font-bold text-slate-700">{claim.siteName || '-'}</td>
                                    <td className="border border-slate-900 px-3 py-2">{claim.payerTeamName || '-'}</td>
                                    <td className="border border-slate-900 px-3 py-2">{claim.chargeToTeamName || '-'}</td>
                                    <td className="border border-slate-900 px-3 py-2">{claim.category || '-'}</td>
                                    <td className="border border-slate-900 px-3 py-2 font-bold text-slate-700">{claim.description || '-'}</td>
                                    <td className="border border-slate-900 px-3 py-2">{getExpenseClaimStatusLabel(claim.status)}</td>
                                    <td className="border border-slate-900 px-3 py-2 text-right font-mono font-black">{formatNumber(getExpenseClaimAmount(claim))}</td>
                                    <td className="border border-slate-900 px-3 py-2 text-slate-500">{claim.memo || '-'}</td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={9} className="border border-slate-900 px-3 py-10 text-center font-bold text-slate-400">
                                        등록된 후청구 경비내역이 없습니다.
                                    </td>
                                </tr>
                            )}
                            </tbody>
                        </table>
                    </div>
                </div>

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
        </SupportClientStatementModalShell>
    );
};

const SummaryCard: React.FC<{
    label: string;
    value: React.ReactNode;
    icon: any;
    tone: 'emerald' | 'sky' | 'orange' | 'violet';
}> = ({ label, value, icon, tone }) => {
    const toneMap = {
        emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-500', text: 'text-emerald-700' },
        sky: { bg: 'bg-sky-50', icon: 'text-sky-500', text: 'text-sky-700' },
        orange: { bg: 'bg-orange-50', icon: 'text-orange-500', text: 'text-orange-700' },
        violet: { bg: 'bg-violet-50', icon: 'text-violet-500', text: 'text-violet-700' }
    } as const;

    return (
        <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
            <div className={`mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg ${toneMap[tone].bg}`}>
                <FontAwesomeIcon icon={icon} className={`text-sm ${toneMap[tone].icon}`} />
            </div>
            <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">{label}</p>
            <p className={`mt-0.5 text-lg font-black leading-tight ${toneMap[tone].text}`}>{value}</p>
        </div>
    );
};

const SupportClientAllocationModal: React.FC<{
    target: SupportClientAllocationModalTarget;
    settlementTargets: SettlementTarget[];
    companies: Company[];
    saving: boolean;
    onClose: () => void;
    onSave: (lines: SupportClientAllocationLine[]) => Promise<void>;
}> = ({ target, settlementTargets, companies, saving, onClose, onSave }) => {
    const [lines, setLines] = useState<SupportClientAllocationLine[]>(() => (
        target.allocation?.lines?.length
            ? target.allocation.lines.map((line) => ({ ...line, amount: Number(line.amount || 0) }))
            : []
    ));
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setLines(target.allocation?.lines?.length
            ? target.allocation.lines.map((line) => ({ ...line, amount: Number(line.amount || 0) }))
            : []);
        setError(null);
    }, [target]);

    const activeTargets = useMemo(
        () => settlementTargets.filter((item) => item.status !== 'inactive'),
        [settlementTargets]
    );

    const contactTargets = useMemo(
        () => activeTargets
            .filter((item) => item.targetType === 'client_contact')
            .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ko')),
        [activeTargets]
    );

    const otherTargets = useMemo(
        () => activeTargets
            .filter((item) => item.targetType === 'other')
            .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ko')),
        [activeTargets]
    );

    const rentalCompanyOptions = useMemo(
        () => companies
            .filter((company) => company.type === '임대사')
            .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ko')),
        [companies]
    );

    const clientCompanyOptions = useMemo(
        () => companies
            .filter((company) => company.type === '건설사')
            .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ko')),
        [companies]
    );

    const allocatedAmount = useMemo(
        () => lines.reduce((sum, line) => sum + Number(line.amount || 0), 0),
        [lines]
    );
    const unallocatedAmount = target.distributableAmount - allocatedAmount;

    const updateLine = (lineId: string, updates: Partial<SupportClientAllocationLine>) => {
        setLines((prev) => prev.map((line) => line.id === lineId ? { ...line, ...updates } : line));
    };

    const addLine = () => {
        setLines((prev) => [
            ...prev,
            {
                id: createAllocationLineId(),
                targetId: '',
                targetName: '사무실 수입',
                targetType: 'office_income',
                companyId: '',
                companyName: '',
                amount: 0,
                processType: 'office_income',
                dueDate: '',
                status: 'confirmed',
                memo: '',
            },
        ]);
    };

    const removeLine = (lineId: string) => {
        setLines((prev) => prev.filter((line) => line.id !== lineId));
    };

    const applyLineType = (lineId: string, targetType: SettlementTargetType) => {
        updateLine(lineId, {
            targetId: '',
            targetName: targetType === 'office_income' ? '사무실 수입' : '',
            targetType,
            companyId: '',
            companyName: '',
            processType: targetType === 'office_income' ? 'office_income' : 'payable',
            memo: '',
        });
    };

    const applyTargetToLine = (lineId: string, targetType: SettlementTargetType, targetId: string) => {
        if (targetType === 'office_income') {
            updateLine(lineId, {
                targetId: '',
                targetName: '사무실 수입',
                targetType: 'office_income',
                companyId: '',
                companyName: '',
                processType: 'office_income',
            });
            return;
        }

        if (targetType === 'rental_company' || targetType === 'client_company') {
            const source = targetType === 'rental_company' ? rentalCompanyOptions : clientCompanyOptions;
            const selected = source.find((item) => (item.id || item.name) === targetId);
            if (!selected) {
                updateLine(lineId, { targetId: '', targetName: '', companyId: '', companyName: '' });
                return;
            }
            updateLine(lineId, {
                targetId: selected.id || '',
                targetName: selected.name,
                targetType,
                companyId: selected.id || '',
                companyName: selected.name,
                processType: 'payable',
            });
            return;
        }

        const source = targetType === 'client_contact' ? contactTargets : otherTargets;
        const selected = source.find((item) => item.id === targetId);
        if (!selected) {
            updateLine(lineId, { targetId: '', targetName: '', companyId: '', companyName: '' });
            return;
        }

        updateLine(lineId, {
            targetId: selected.id || '',
            targetName: selected.name,
            targetType,
            companyId: selected.companyId || '',
            companyName: selected.companyName || '',
            processType: 'payable',
            memo: selected.evidenceRequired ? '증빙 필요' : '',
        });
    };

    const handleSave = async () => {
        const normalizedLines = lines
            .map((line) => ({
                ...line,
                targetType: normalizeAllocationTargetType(line.targetType),
                targetName: String(line.targetName || '').trim(),
                companyName: String(line.companyName || '').trim(),
                amount: Number(line.amount || 0),
                processType: normalizeAllocationTargetType(line.targetType) === 'office_income' ? 'office_income' as const : 'payable' as const,
                status: (line.status === 'draft' || line.status === 'paid' ? 'confirmed' : line.status) as SupportClientAllocationLine['status'],
                memo: String(line.memo || '').trim(),
            }))
            .filter((line) => line.targetName && line.amount > 0);
        const total = normalizedLines.reduce((sum, line) => sum + Number(line.amount || 0), 0);

        if (total > target.distributableAmount) {
            setError(`배분합계가 차액보다 큽니다. 초과금액 ${formatNumber(total - target.distributableAmount)}원`);
            return;
        }

        setError(null);
        await onSave(normalizedLines);
    };

    const metricClassName = unallocatedAmount < 0 ? 'text-rose-700' : unallocatedAmount === 0 ? 'text-emerald-700' : 'text-amber-700';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
            <div className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-xl bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
                    <div>
                        <h2 className="text-lg font-black text-slate-900">차액 배분 관리</h2>
                        <p className="mt-1 text-xs font-bold text-slate-500">
                            {target.site.clientCompanyName} / {target.site.siteName}
                        </p>
                    </div>
                    <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <FontAwesomeIcon icon={faXmark} />
                    </button>
                </div>

                <div className="max-h-[72vh] overflow-y-auto p-6">
                    <div className="grid gap-3 md:grid-cols-6">
                        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                            <div className="text-xs font-black text-slate-400">부가세</div>
                            <div className="mt-1 text-lg font-black tabular-nums text-amber-700">{formatNumber(target.vatAmount)}원</div>
                        </div>
                        {[
                            ['발행금액', target.issuedAmount, 'text-sky-700'],
                            ['정산금액', target.settlementAmount, 'text-emerald-700'],
                            ['차액', target.distributableAmount, 'text-slate-900'],
                            ['배분합계', allocatedAmount, 'text-indigo-700'],
                            ['미배분', unallocatedAmount, metricClassName],
                        ].map(([label, amount, className]) => (
                            <div key={String(label)} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                                <div className="text-xs font-black text-slate-400">{label}</div>
                                <div className={`mt-1 text-lg font-black tabular-nums ${className}`}>{formatNumber(Number(amount))}원</div>
                            </div>
                        ))}
                    </div>

                    {error && (
                        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                            {error}
                        </div>
                    )}

                    <div className="mt-4 flex items-center justify-between gap-3">
                        <div className="text-xs font-bold text-slate-400">
                            여러 대상자에게 동시에 배분할 수 있습니다.
                        </div>
                        <button
                            type="button"
                            onClick={addLine}
                            className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-black text-indigo-700 hover:bg-indigo-100"
                        >
                            <FontAwesomeIcon icon={faPlus} />
                            배분 라인 추가
                        </button>
                    </div>

                    <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
                        <table className="w-full min-w-[900px] text-sm">
                            <thead className="bg-slate-50 text-xs font-black text-slate-500">
                                <tr>
                                    <th className="px-3 py-2 text-left">구분</th>
                                    <th className="px-3 py-2 text-left">대상자명</th>
                                    <th className="px-3 py-2 text-right">금액</th>
                                    <th className="px-3 py-2 text-left">상태</th>
                                    <th className="px-3 py-2 text-left">예정일</th>
                                    <th className="px-3 py-2 text-left">메모</th>
                                    <th className="px-3 py-2 text-center">삭제</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {lines.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-10 text-center text-sm font-bold text-slate-400">
                                            등록된 배분 라인이 없습니다.
                                        </td>
                                    </tr>
                                ) : (
                                    lines.map((line) => {
                                        const lineType = normalizeAllocationTargetType(line.targetType);
                                        const companyOptions = lineType === 'rental_company'
                                            ? rentalCompanyOptions
                                            : lineType === 'client_company'
                                                ? clientCompanyOptions
                                                : [];
                                        const isCompanySelect = lineType === 'rental_company' || lineType === 'client_company';
                                        const isContactSelect = lineType === 'client_contact';

                                        return (
                                            <tr key={line.id} className="align-middle">
                                                <td className="px-3 py-2">
                                                    <select
                                                        value={lineType}
                                                        onChange={(event) => applyLineType(line.id, event.target.value as SettlementTargetType)}
                                                        className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs font-bold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                                    >
                                                        {SETTLEMENT_TARGET_TYPE_OPTIONS.map((option) => (
                                                            <option key={option.value} value={option.value}>{option.label}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="px-3 py-2">
                                                    {lineType === 'office_income' ? (
                                                        <div className="rounded border border-emerald-100 bg-emerald-50 px-2 py-1.5 text-sm font-black text-emerald-700">
                                                            사무실 수입
                                                        </div>
                                                    ) : isCompanySelect ? (
                                                        <select
                                                            value={line.targetId || ''}
                                                            onChange={(event) => applyTargetToLine(line.id, lineType, event.target.value)}
                                                            className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs font-bold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                                        >
                                                            <option value="">{lineType === 'rental_company' ? '임대사 선택' : '발주사 선택'}</option>
                                                            {companyOptions.map((company) => (
                                                                <option key={company.id || company.name} value={company.id || company.name}>
                                                                    {company.name}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    ) : isContactSelect ? (
                                                        <select
                                                            value={line.targetId || ''}
                                                            onChange={(event) => applyTargetToLine(line.id, lineType, event.target.value)}
                                                            className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs font-bold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                                        >
                                                            <option value="">관계자 선택</option>
                                                            {contactTargets.map((item) => (
                                                                <option key={item.id || item.name} value={item.id || ''}>
                                                                    {item.name}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    ) : (
                                                        <>
                                                            <input
                                                                value={line.targetName || ''}
                                                                onChange={(event) => updateLine(line.id, { targetName: event.target.value, targetId: '' })}
                                                                list={`allocation-other-targets-${line.id}`}
                                                                className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                                                placeholder="대상자명"
                                                            />
                                                            {otherTargets.length > 0 && (
                                                                <datalist id={`allocation-other-targets-${line.id}`}>
                                                                    {otherTargets.map((item) => (
                                                                        <option key={item.id || item.name} value={item.name} />
                                                                    ))}
                                                                </datalist>
                                                            )}
                                                        </>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2">
                                                    <input
                                                        value={line.amount ? String(line.amount) : ''}
                                                        onChange={(event) => updateLine(line.id, { amount: parseCurrencyAmount(normalizeAllocationLineAmountInput(event.target.value)) })}
                                                        className="w-full rounded border border-slate-200 px-2 py-1.5 text-right font-mono text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                                        inputMode="numeric"
                                                        placeholder="0"
                                                    />
                                                </td>
                                                <td className="px-3 py-2">
                                                    <select
                                                        value={(line.status === 'draft' || line.status === 'paid') ? 'confirmed' : line.status || 'confirmed'}
                                                        onChange={(event) => updateLine(line.id, { status: event.target.value as SupportClientAllocationLine['status'] })}
                                                        className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs font-bold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                                    >
                                                        {ALLOCATION_LINE_STATUS_OPTIONS.map((option) => (
                                                            <option key={option.value} value={option.value}>{option.label}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="px-3 py-2">
                                                    <input
                                                        type="date"
                                                        value={line.dueDate || ''}
                                                        onChange={(event) => updateLine(line.id, { dueDate: event.target.value })}
                                                        className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs font-bold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                                    />
                                                </td>
                                                <td className="px-3 py-2">
                                                    <input
                                                        value={line.memo || ''}
                                                        onChange={(event) => updateLine(line.id, { memo: event.target.value })}
                                                        className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                                        placeholder="메모"
                                                    />
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => removeLine(line.id)}
                                                        className="inline-flex h-8 w-8 items-center justify-center rounded border border-rose-200 text-rose-600 hover:bg-rose-50"
                                                        title="삭제"
                                                    >
                                                        <FontAwesomeIcon icon={faTrash} />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50"
                    >
                        취소
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60"
                    >
                        <FontAwesomeIcon icon={saving ? faSpinner : faCircleCheck} spin={saving} className="mr-2" />
                        저장
                    </button>
                </div>
            </div>
        </div>
    );
};

const SupportClientSitePage: React.FC = () => {
    const navigate = useNavigate();
    const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentYearMonth());
    const [selectedDirection, setSelectedDirection] = useState<'all' | SupportDirection>('all');
    const [selectedClientKey, setSelectedClientKey] = useState<string>('');
    const [selectedSiteKey, setSelectedSiteKey] = useState<string>('');
    const [rows, setRows] = useState<SupportClientSiteWorkerRow[]>([]);
    const [expenseClaims, setExpenseClaims] = useState<TeamExpenseClaim[]>([]);
    const [settlementTargets, setSettlementTargets] = useState<SettlementTarget[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [allocationLoading, setAllocationLoading] = useState<boolean>(false);
    const [allocationSaving, setAllocationSaving] = useState<boolean>(false);
    const [errors, setErrors] = useState<string[]>([]);
    const [laborStatementPanel, setLaborStatementPanel] = useState<{ key: string; target: SupportStatementTarget } | null>(null);
    const [transactionStatementPanel, setTransactionStatementPanel] = useState<{ key: string; target: SupportStatementTarget; mode: SupportTransactionStatementMode } | null>(null);
    const [transactionStatements, setTransactionStatements] = useState<Estimate[]>([]);
    const [transactionStatementsLoading, setTransactionStatementsLoading] = useState<boolean>(false);
    const [expenseStatementTarget, setExpenseStatementTarget] = useState<SupportStatementTarget | null>(null);
    const [allocationModalTarget, setAllocationModalTarget] = useState<SupportClientAllocationModalTarget | null>(null);
    const [showAllocationColumns, setShowAllocationColumns] = useState<boolean>(false);
    const [expandedClientKeys, setExpandedClientKeys] = useState<Set<string>>(new Set());
    const [expandedResponsibleTeamKeys, setExpandedResponsibleTeamKeys] = useState<Set<string>>(new Set());
    const [expandedSiteKeys, setExpandedSiteKeys] = useState<Set<string>>(new Set());
    const [issuedAmountState, setIssuedAmountState] = useState<{ month: string; amounts: Record<string, string> }>(() => {
        const initialMonth = getCurrentYearMonth();
        return {
            month: initialMonth,
            amounts: loadIssuedAmounts(initialMonth)
        };
    });
    const [settlementAmountState, setSettlementAmountState] = useState<{ month: string; amounts: Record<string, string> }>(() => {
        const initialMonth = getCurrentYearMonth();
        return {
            month: initialMonth,
            amounts: loadSettlementAmounts(initialMonth)
        };
    });
    const [rowNoteState, setRowNoteState] = useState<{ month: string; notes: Record<string, string> }>(() => {
        const initialMonth = getCurrentYearMonth();
        return {
            month: initialMonth,
            notes: loadRowNotes(initialMonth)
        };
    });
    const [progressStatusState, setProgressStatusState] = useState<{ month: string; statuses: Record<string, SupportProgressStatus> }>(() => {
        const initialMonth = getCurrentYearMonth();
        return {
            month: initialMonth,
            statuses: loadProgressStatuses(initialMonth)
        };
    });
    const [billingRateState, setBillingRateState] = useState<{ month: string; rates: Record<string, string> }>(() => {
        const initialMonth = getCurrentYearMonth();
        return {
            month: initialMonth,
            rates: loadBillingRates(initialMonth)
        };
    });
    const [bulkBillingRateInput, setBulkBillingRateInput] = useState<string>(() => {
        const initialMonth = getCurrentYearMonth();
        const storedRate = loadBillingRates(initialMonth).bulkRate || '';
        return storedRate ? formatNumber(parseBillingRate(storedRate)) : '';
    });
    const [allocationState, setAllocationState] = useState<{ month: string; allocations: Record<string, SupportClientAllocation> }>(() => ({
        month: getCurrentYearMonth(),
        allocations: {}
    }));
    const issuedAmounts = issuedAmountState.month === selectedMonth
        ? issuedAmountState.amounts
        : loadIssuedAmounts(selectedMonth);
    const settlementAmounts = settlementAmountState.month === selectedMonth
        ? settlementAmountState.amounts
        : loadSettlementAmounts(selectedMonth);
    const rowNotes = rowNoteState.month === selectedMonth
        ? rowNoteState.notes
        : loadRowNotes(selectedMonth);
    const progressStatuses = progressStatusState.month === selectedMonth
        ? progressStatusState.statuses
        : loadProgressStatuses(selectedMonth);
    const billingRates = billingRateState.month === selectedMonth ? billingRateState.rates : loadBillingRates(selectedMonth);
    const appliedBulkBillingRate = parseBillingRate(billingRates.bulkRate);
    const siteAllocations = allocationState.month === selectedMonth ? allocationState.allocations : {};

    const fetchData = useCallback(async () => {
        if (!selectedMonth) return;
        setLoading(true);
        setErrors([]);
        try {
            const { start, end } = getMonthRange(selectedMonth);
            const [reports, teams, companies, sites, supportRates, workers, teamExpenseClaims] = await Promise.all([
                dailyReportService.getReportsByRange(start, end),
                teamService.getTeams(),
                companyService.getCompanies(),
                siteService.getSites(),
                supportRateService.getAllSiteRates().catch((error) => {
                    console.error('[SupportClientSitePage] support rate load failed:', error);
                    return [] as SupportRate[];
                }),
                manpowerService.getWorkers().catch((error) => {
                    console.error('[SupportClientSitePage] worker master load failed:', error);
                    return [] as Worker[];
                }),
                teamExpenseLedgerService.getClaimsByMonth(selectedMonth).catch((error) => {
                    console.error('[SupportClientSitePage] expense claim load failed:', error);
                    return [] as TeamExpenseClaim[];
                })
            ]);

            setRows(buildSupportRows(reports, teams, companies, sites, supportRates, workers));
            setCompanies(companies);
            setExpenseClaims(teamExpenseClaims);
        } catch (error) {
            console.error('[SupportClientSitePage] support client-site data load failed:', error);
            setRows([]);
            setCompanies([]);
            setExpenseClaims([]);
            setErrors(['발주사별/현장별 지원 정산 데이터를 불러오지 못했습니다. 일보, 현장, 팀 데이터 권한을 확인해주세요.']);
        } finally {
            setLoading(false);
        }
    }, [selectedMonth]);

    useEffect(() => {
        void fetchData();
    }, [fetchData]);

    const fetchTransactionStatements = useCallback(async () => {
        setTransactionStatementsLoading(true);
        try {
            const statements = await estimateService.getEstimates();
            setTransactionStatements(statements.filter((statement) => statement.documentType === 'transaction'));
        } catch (error) {
            console.error('[SupportClientSitePage] transaction statement load failed:', error);
            setTransactionStatements([]);
        } finally {
            setTransactionStatementsLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchTransactionStatements();
    }, [fetchTransactionStatements]);

    useEffect(() => {
        settlementTargetService.getTargets(true)
            .then(setSettlementTargets)
            .catch((error) => {
                console.error('[SupportClientSitePage] settlement target load failed:', error);
                setSettlementTargets([]);
            });
    }, []);

    useEffect(() => {
        if (!selectedMonth) return;
        let alive = true;
        setAllocationLoading(true);
        supportClientSiteAllocationService.getAllocationsByMonth(selectedMonth)
            .then((allocationRows) => {
                if (!alive) return;
                const allocations = Object.fromEntries(allocationRows.map((allocation) => [allocation.siteKey, allocation]));
                setAllocationState({
                    month: selectedMonth,
                    allocations
                });
                setIssuedAmountState((prev) => {
                    const base = prev.month === selectedMonth ? prev.amounts : loadIssuedAmounts(selectedMonth);
                    const next = { ...base };
                    allocationRows.forEach((allocation) => {
                        if (Number(allocation.issuedAmount || 0) > 0) {
                            next[allocation.siteKey] = String(Math.round(Number(allocation.issuedAmount || 0)));
                        }
                    });
                    return {
                        month: selectedMonth,
                        amounts: next
                    };
                });
                setSettlementAmountState((prev) => {
                    const base = prev.month === selectedMonth ? prev.amounts : loadSettlementAmounts(selectedMonth);
                    const next = { ...base };
                    allocationRows.forEach((allocation) => {
                        if (Number(allocation.settlementAmount || 0) > 0) {
                            next[allocation.siteKey] = String(Math.round(Number(allocation.settlementAmount || 0)));
                        }
                    });
                    return {
                        month: selectedMonth,
                        amounts: next
                    };
                });
            })
            .catch((error) => {
                console.error('[SupportClientSitePage] allocation load failed:', error);
                if (alive) setAllocationState({ month: selectedMonth, allocations: {} });
            })
            .finally(() => {
                if (alive) setAllocationLoading(false);
            });
        return () => {
            alive = false;
        };
    }, [selectedMonth]);

    useEffect(() => {
        setIssuedAmountState({
            month: selectedMonth,
            amounts: loadIssuedAmounts(selectedMonth)
        });
        setSettlementAmountState({
            month: selectedMonth,
            amounts: loadSettlementAmounts(selectedMonth)
        });
        setRowNoteState({
            month: selectedMonth,
            notes: loadRowNotes(selectedMonth)
        });
        setProgressStatusState({
            month: selectedMonth,
            statuses: loadProgressStatuses(selectedMonth)
        });
        const nextBillingRates = loadBillingRates(selectedMonth);
        setBillingRateState({
            month: selectedMonth,
            rates: nextBillingRates
        });
        setBulkBillingRateInput(nextBillingRates.bulkRate ? formatNumber(parseBillingRate(nextBillingRates.bulkRate)) : '');
    }, [selectedMonth]);

    useEffect(() => {
        if (issuedAmountState.month !== selectedMonth || typeof window === 'undefined') return;
        try {
            window.localStorage.setItem(
                getIssuedAmountStorageKey(selectedMonth),
                JSON.stringify(issuedAmountState.amounts)
            );
        } catch (error) {
            console.warn('[SupportClientSitePage] issued amount save failed:', error);
        }
    }, [issuedAmountState, selectedMonth]);

    useEffect(() => {
        if (settlementAmountState.month !== selectedMonth || typeof window === 'undefined') return;
        try {
            window.localStorage.setItem(
                getSettlementAmountStorageKey(selectedMonth),
                JSON.stringify(settlementAmountState.amounts)
            );
        } catch (error) {
            console.warn('[SupportClientSitePage] settlement amount save failed:', error);
        }
    }, [settlementAmountState, selectedMonth]);

    useEffect(() => {
        if (rowNoteState.month !== selectedMonth || typeof window === 'undefined') return;
        try {
            window.localStorage.setItem(
                getRowNoteStorageKey(selectedMonth),
                JSON.stringify(rowNoteState.notes)
            );
        } catch (error) {
            console.warn('[SupportClientSitePage] row note save failed:', error);
        }
    }, [rowNoteState, selectedMonth]);

    useEffect(() => {
        if (progressStatusState.month !== selectedMonth || typeof window === 'undefined') return;
        try {
            window.localStorage.setItem(
                getProgressStatusStorageKey(selectedMonth),
                JSON.stringify(progressStatusState.statuses)
            );
        } catch (error) {
            console.warn('[SupportClientSitePage] progress status save failed:', error);
        }
    }, [progressStatusState, selectedMonth]);

    useEffect(() => {
        if (billingRateState.month !== selectedMonth || typeof window === 'undefined') return;
        try {
            window.localStorage.setItem(
                getBillingRateStorageKey(selectedMonth),
                JSON.stringify(billingRateState.rates)
            );
        } catch (error) {
            console.warn('[SupportClientSitePage] billing rate save failed:', error);
        }
    }, [billingRateState, selectedMonth]);

    useEffect(() => {
        setExpandedResponsibleTeamKeys(new Set());
        setExpandedSiteKeys(new Set());
    }, [selectedMonth, selectedDirection, selectedClientKey, selectedSiteKey]);

    const displayRows = useMemo(
        () => rows.filter((row) => !isExternalClientSummary(row)),
        [rows]
    );

    useEffect(() => {
        if (selectedDirection === '외부지원간곳') {
            setSelectedDirection('all');
        }
    }, [selectedDirection]);

    const directionFilteredRows = useMemo(() => (
        displayRows.filter((row) => selectedDirection === 'all' || row.direction === selectedDirection)
    ), [displayRows, selectedDirection]);

    const clientOptions = useMemo(() => groupRowsByClientAndSite(directionFilteredRows), [directionFilteredRows]);

    const clientFilteredRows = useMemo(() => (
        directionFilteredRows.filter((row) => !selectedClientKey || clientKeyForRow(row) === selectedClientKey)
    ), [directionFilteredRows, selectedClientKey]);

    const siteOptions = useMemo(() => {
        const siteMap = new Map<string, { key: string; name: string; clientCompanyName: string }>();
        clientFilteredRows.forEach((row) => {
            const key = siteKeyForRow(row);
            if (!siteMap.has(key)) {
                siteMap.set(key, {
                    key,
                    name: row.siteName || '현장 미지정',
                    clientCompanyName: getClientCompanyName(row)
                });
            }
        });
        return Array.from(siteMap.values()).sort((a, b) =>
            a.clientCompanyName.localeCompare(b.clientCompanyName, 'ko-KR') ||
            a.name.localeCompare(b.name, 'ko-KR')
        );
    }, [clientFilteredRows]);

    const filteredRows = useMemo(() => (
        clientFilteredRows.filter((row) => !selectedSiteKey || siteKeyForRow(row) === selectedSiteKey)
    ), [clientFilteredRows, selectedSiteKey]);

    const clientGroups = useMemo(
        () => applyExpenseClaimsToClientGroups(groupRowsByClientAndSite(filteredRows), expenseClaims),
        [filteredRows, expenseClaims]
    );

    const getRowBillingOverrideRate = (row: SupportClientSiteWorkerRow): number =>
        parseBillingRate(billingRates[getBillingRowRateKey(row)]);

    const getRowBillingUnitPrice = (row: SupportClientSiteWorkerRow): number => {
        const rowBillingRate = getRowBillingOverrideRate(row);
        if (rowBillingRate > 0) return rowBillingRate;
        return appliedBulkBillingRate > 0 ? appliedBulkBillingRate : Math.max(0, Math.round(row.unitPrice || 0));
    };

    const getRowBillingAmount = (row: SupportClientSiteWorkerRow): number =>
        getRowBillingOverrideRate(row) > 0 || appliedBulkBillingRate > 0
            ? calculateSupportClientBillingAmount(row.manDay, getRowBillingUnitPrice(row))
            : Math.max(0, Math.round(row.amount || 0));

    const getSiteBillingAmount = (site: SupportSiteSummary): number =>
        site.rows.reduce((sum, row) => sum + getRowBillingAmount(row), 0);

    const getSiteBillingUnitPrice = (site: SupportSiteSummary): number =>
        site.totalManDay > 0 ? Math.round(getSiteBillingAmount(site) / site.totalManDay) : 0;

    const getSitesBillingMetrics = (sites: SupportSiteSummary[]): { billingUnitPrice: number; billingAmount: number } => {
        const billingAmount = sites.reduce((sum, site) => sum + getSiteBillingAmount(site), 0);
        const totalManDay = sites.reduce((sum, site) => sum + site.totalManDay, 0);
        return {
            billingUnitPrice: totalManDay > 0 ? Math.round(billingAmount / totalManDay) : 0,
            billingAmount
        };
    };

    const getBillingRateBySiteKey = (sites: SupportSiteSummary[]): Record<string, number> =>
        appliedBulkBillingRate > 0
            ? Object.fromEntries(sites.map((site) => [site.key, getSiteBillingUnitPrice(site)]))
            : {};

    const getBillingRateByRowId = (rows: SupportClientSiteWorkerRow[]): Record<string, number> =>
        Object.fromEntries(rows.map((row) => [row.rowId, getRowBillingUnitPrice(row)]));

    useEffect(() => {
        const initiallyOpenClient = clientGroups[0];
        setExpandedClientKeys(initiallyOpenClient ? new Set([initiallyOpenClient.key]) : new Set());
        setExpandedResponsibleTeamKeys(new Set());
        setExpandedSiteKeys(new Set());
    }, [clientGroups]);

    const totalSummary = useMemo(() => {
        const siteKeys = new Set(filteredRows.map(siteKeyForRow));
        const clientKeys = new Set(filteredRows.map(clientKeyForRow));
        const workerKeys = new Set(filteredRows.map((row) => row.workerId || row.workerName));
        return {
            totalManDay: filteredRows.reduce((sum, row) => sum + row.manDay, 0),
            totalAmount: filteredRows.reduce((sum, row) => sum + row.amount, 0),
            totalBillingAmount: filteredRows.reduce((sum, row) => sum + getRowBillingAmount(row), 0),
            clientCount: clientKeys.size,
            siteCount: siteKeys.size,
            workerCount: workerKeys.size
        };
    }, [filteredRows, appliedBulkBillingRate, billingRates]);

    const resolveSiteIssuedAmount = (site: SupportSiteSummary, value?: string): number => {
        const rawValue = value ?? issuedAmounts[site.key];
        const hasManualValue = String(rawValue ?? '').trim() !== '';
        return hasManualValue ? parseIssuedAmount(rawValue) : getSiteDefaultIssuedAmount(site);
    };

    const getSiteAllocationMetrics = (site: SupportSiteSummary): SiteAllocationMetrics => {
        const issuedAmount = resolveSiteIssuedAmount(site);
        const settlementAmount = parseSettlementAmount(settlementAmounts[site.key]);
        const distributableAmount = Math.max(issuedAmount - settlementAmount, 0);
        const allocatedAmount = (siteAllocations[site.key]?.lines || []).reduce((sum, line) => sum + Number(line.amount || 0), 0);
        const unallocatedAmount = distributableAmount - allocatedAmount;
        return {
            issuedAmount,
            settlementAmount,
            distributableAmount,
            allocatedAmount,
            unallocatedAmount,
            vatAmount: getSiteVatAmount(site, issuedAmount),
            isOverAllocated: unallocatedAmount < 0
        };
    };

    const getSitesAllocationMetrics = (sites: SupportSiteSummary[]): SiteAllocationMetrics =>
        sites.reduce<SiteAllocationMetrics>((acc, site) => {
            const metrics = getSiteAllocationMetrics(site);
            return {
                issuedAmount: acc.issuedAmount + metrics.issuedAmount,
                settlementAmount: acc.settlementAmount + metrics.settlementAmount,
                distributableAmount: acc.distributableAmount + metrics.distributableAmount,
                allocatedAmount: acc.allocatedAmount + metrics.allocatedAmount,
                unallocatedAmount: acc.unallocatedAmount + metrics.unallocatedAmount,
                vatAmount: acc.vatAmount + metrics.vatAmount,
                isOverAllocated: acc.isOverAllocated || metrics.isOverAllocated
            };
        }, {
            issuedAmount: 0,
            settlementAmount: 0,
            distributableAmount: 0,
            allocatedAmount: 0,
            unallocatedAmount: 0,
            vatAmount: 0,
            isOverAllocated: false
        });

    const persistSiteSettlementSnapshot = async (
        site: SupportSiteSummary,
        overrides: { issuedValue?: string; settlementValue?: string } = {}
    ) => {
        const existing = siteAllocations[site.key];
        const lines = existing?.lines || [];
        const issuedAmount = resolveSiteIssuedAmount(site, overrides.issuedValue ?? issuedAmounts[site.key]);
        const settlementAmount = parseSettlementAmount(overrides.settlementValue ?? settlementAmounts[site.key]);
        const distributableAmount = Math.max(issuedAmount - settlementAmount, 0);
        const allocatedAmount = lines.reduce((sum, line) => sum + Number(line.amount || 0), 0);

        if (!existing && issuedAmount <= 0 && settlementAmount <= 0 && lines.length === 0) return;

        try {
            if (issuedAmount <= 0 && settlementAmount <= 0 && lines.length === 0) {
                await supportClientSiteAllocationService.deleteAllocation(selectedMonth, site.key);
                setAllocationState((prev) => {
                    const base = prev.month === selectedMonth ? prev.allocations : {};
                    const next = { ...base };
                    delete next[site.key];
                    return { month: selectedMonth, allocations: next };
                });
                return;
            }

            const allocation: SupportClientAllocation = {
                id: existing?.id || supportClientSiteAllocationService.getDocumentId(selectedMonth, site.key),
                yearMonth: selectedMonth,
                siteKey: site.key,
                siteId: site.siteId || '',
                siteName: site.siteName,
                clientCompanyId: site.clientCompanyId || '',
                clientCompanyName: site.clientCompanyName || '',
                issuedAmount,
                settlementAmount,
                distributableAmount,
                allocatedAmount,
                status: getAllocationStatus(distributableAmount, allocatedAmount),
                lines,
            };

            await supportClientSiteAllocationService.upsertAllocation(allocation);
            setAllocationState((prev) => ({
                month: selectedMonth,
                allocations: {
                    ...(prev.month === selectedMonth ? prev.allocations : {}),
                    [site.key]: allocation,
                }
            }));
        } catch (error) {
            console.error('[SupportClientSitePage] settlement snapshot save failed:', error);
            setErrors(['정산금액 저장 중 오류가 발생했습니다. 다시 시도해주세요.']);
        }
    };

    const amountSummary = useMemo(() => {
        const sites = clientGroups.flatMap((client) => client.sites);
        const siteMetrics = sites.map((site) => getSiteAllocationMetrics(site));
        const totalIssuedAmount = siteMetrics.reduce((sum, metrics) => sum + metrics.issuedAmount, 0);
        const totalSettlementAmount = sites.reduce((sum, site) => sum + parseSettlementAmount(settlementAmounts[site.key]), 0);
        const totalAllocatedAmount = sites.reduce((sum, site) => sum + (siteAllocations[site.key]?.lines || []).reduce((lineSum, line) => lineSum + Number(line.amount || 0), 0), 0);
        const totalDistributableAmount = Math.max(totalIssuedAmount - totalSettlementAmount, 0);
        const totalVatAmount = siteMetrics.reduce((sum, metrics) => sum + metrics.vatAmount, 0);
        const totalManDay = sites.reduce((sum, site) => sum + site.totalManDay, 0);
        return {
            totalIssuedAmount,
            totalSettlementAmount,
            totalDistributableAmount,
            totalAllocatedAmount,
            totalUnallocatedAmount: totalDistributableAmount - totalAllocatedAmount,
            totalVatAmount,
            avgSsukkumi: totalSettlementAmount > 0 && totalManDay > 0 ? Math.round(totalSettlementAmount / totalManDay) : 0
        };
    }, [clientGroups, issuedAmounts, settlementAmounts, siteAllocations]);

    const toggleSite = (siteKey: string) => {
        setExpandedSiteKeys((prev) => {
            if (prev.has(siteKey)) return new Set();
            return new Set([siteKey]);
        });
    };

    const toggleResponsibleTeam = (teamKey: string) => {
        setExpandedResponsibleTeamKeys((prev) => {
            if (prev.has(teamKey)) return new Set();
            return new Set([teamKey]);
        });
        setExpandedSiteKeys(new Set());
    };

    const toggleClient = (clientKey: string) => {
        setExpandedClientKeys((prev) => {
            if (prev.has(clientKey)) return new Set();
            return new Set([clientKey]);
        });
        setExpandedResponsibleTeamKeys(new Set());
        setExpandedSiteKeys(new Set());
    };

    const handleIssuedAmountChange = (siteKey: string, value: string) => {
        const normalizedValue = normalizeIssuedAmountInput(value);
        setIssuedAmountState((prev) => {
            const base = prev.month === selectedMonth ? prev.amounts : loadIssuedAmounts(selectedMonth);
            const next = { ...base };
            if (normalizedValue) next[siteKey] = normalizedValue;
            else delete next[siteKey];
            return {
                month: selectedMonth,
                amounts: next
            };
        });
    };

    const handleSettlementAmountChange = (siteKey: string, value: string) => {
        const normalizedValue = normalizeSettlementAmountInput(value);
        setSettlementAmountState((prev) => {
            const base = prev.month === selectedMonth ? prev.amounts : loadSettlementAmounts(selectedMonth);
            const next = { ...base };
            if (normalizedValue) next[siteKey] = normalizedValue;
            else delete next[siteKey];
            return {
                month: selectedMonth,
                amounts: next
            };
        });
    };

    const handleApplyBulkBillingRate = () => {
        const billingRate = parseBillingRate(bulkBillingRateInput);
        if (billingRate <= 0) {
            window.alert('적용할 청구단가를 입력해주세요.');
            return;
        }
        setBulkBillingRateInput(formatNumber(billingRate));
        setBillingRateState((prev) => {
            const base = prev.month === selectedMonth ? prev.rates : loadBillingRates(selectedMonth);
            return {
                month: selectedMonth,
                rates: {
                    ...base,
                    bulkRate: String(billingRate)
                }
            };
        });
    };

    const handleRowBillingRateChange = (row: SupportClientSiteWorkerRow, value: string) => {
        const normalizedValue = normalizeBillingRateInput(value);
        setBillingRateState((prev) => {
            const base = prev.month === selectedMonth ? prev.rates : loadBillingRates(selectedMonth);
            const next = { ...base };
            const key = getBillingRowRateKey(row);
            if (normalizedValue) {
                next[key] = normalizedValue;
            } else {
                delete next[key];
            }
            return {
                month: selectedMonth,
                rates: next
            };
        });
    };

    const handleSiteBillingRateChange = (site: SupportSiteSummary, value: string) => {
        const normalizedValue = normalizeBillingRateInput(value);
        setBillingRateState((prev) => {
            const base = prev.month === selectedMonth ? prev.rates : loadBillingRates(selectedMonth);
            const next = { ...base };
            site.rows.forEach((row) => {
                const key = getBillingRowRateKey(row);
                if (normalizedValue) {
                    next[key] = normalizedValue;
                } else {
                    delete next[key];
                }
            });
            return {
                month: selectedMonth,
                rates: next
            };
        });
    };

    const openAllocationModal = (site: SupportSiteSummary) => {
        const metrics = getSiteAllocationMetrics(site);
        setAllocationModalTarget({
            site,
            issuedAmount: metrics.issuedAmount,
            settlementAmount: metrics.settlementAmount,
            distributableAmount: metrics.distributableAmount,
            vatAmount: metrics.vatAmount,
            allocation: siteAllocations[site.key]
        });
    };

    const saveAllocationLines = async (lines: SupportClientAllocationLine[]) => {
        if (!allocationModalTarget) return;
        const { site, issuedAmount, settlementAmount, distributableAmount } = allocationModalTarget;
        const allocatedAmount = lines.reduce((sum, line) => sum + Number(line.amount || 0), 0);
        setAllocationSaving(true);
        try {
            if (lines.length === 0 && issuedAmount <= 0 && settlementAmount <= 0) {
                await supportClientSiteAllocationService.deleteAllocation(selectedMonth, site.key);
                setAllocationState((prev) => {
                    const base = prev.month === selectedMonth ? prev.allocations : {};
                    const next = { ...base };
                    delete next[site.key];
                    return { month: selectedMonth, allocations: next };
                });
                setAllocationModalTarget(null);
                return;
            }
            const allocation: SupportClientAllocation = {
                id: allocationModalTarget.allocation?.id || supportClientSiteAllocationService.getDocumentId(selectedMonth, site.key),
                yearMonth: selectedMonth,
                siteKey: site.key,
                siteId: site.siteId || '',
                siteName: site.siteName,
                clientCompanyId: site.clientCompanyId || '',
                clientCompanyName: site.clientCompanyName || '',
                issuedAmount,
                settlementAmount,
                distributableAmount,
                allocatedAmount,
                status: getAllocationStatus(distributableAmount, allocatedAmount),
                lines,
            };
            await supportClientSiteAllocationService.upsertAllocation(allocation);
            setAllocationState((prev) => ({
                month: selectedMonth,
                allocations: {
                    ...(prev.month === selectedMonth ? prev.allocations : {}),
                    [site.key]: allocation,
                }
            }));
            setAllocationModalTarget(null);
        } catch (error) {
            console.error('[SupportClientSitePage] allocation save failed:', error);
            setErrors(['차액 배분 저장 중 오류가 발생했습니다. 다시 시도해주세요.']);
        } finally {
            setAllocationSaving(false);
        }
    };

    const getClientNoteKey = (clientKey: string): string => `client:${clientKey}`;
    const getResponsibleTeamNoteKey = (clientKey: string, teamKey: string): string => `team:${clientKey}:${teamKey}`;
    const getSiteNoteKey = (siteKey: string): string => `site:${siteKey}`;
    const summaryDetailColSpan = showAllocationColumns ? 15 : 10;

    const toggleLaborStatementPanel = useCallback((key: string, target: SupportStatementTarget) => {
        setTransactionStatementPanel(null);
        setLaborStatementPanel((prev) => prev?.key === key ? null : { key, target });
    }, []);

    const closeLaborStatementPanel = useCallback(() => {
        setLaborStatementPanel(null);
    }, []);

    const isLaborStatementPanelOpen = useCallback((key: string): boolean =>
        laborStatementPanel?.key === key,
    [laborStatementPanel]);

    const toggleTransactionStatementPanel = useCallback((key: string, target: SupportStatementTarget, mode: SupportTransactionStatementMode = 'standard') => {
        setLaborStatementPanel(null);
        setTransactionStatementPanel((prev) => prev?.key === key && prev.mode === mode ? null : { key, target, mode });
    }, []);

    const closeTransactionStatementPanel = useCallback(() => {
        setTransactionStatementPanel(null);
    }, []);

    const isTransactionStatementPanelOpen = useCallback((key: string, mode?: SupportTransactionStatementMode): boolean =>
        transactionStatementPanel?.key === key && (!mode || transactionStatementPanel.mode === mode),
    [transactionStatementPanel]);

    const getLinkedTransactionStatements = useCallback((key: string, mode?: SupportTransactionStatementMode): Estimate[] =>
        transactionStatements.filter((statement) =>
            statement.documentType === 'transaction' &&
            statement.supportStatementSource === SUPPORT_TRANSACTION_STATEMENT_SOURCE &&
            statement.supportStatementKey === key &&
            statement.supportStatementYearMonth === selectedMonth &&
            (!mode || isEstimateTransactionMode(statement, mode))
        ),
    [selectedMonth, transactionStatements]);

    useEffect(() => {
        setLaborStatementPanel(null);
        setTransactionStatementPanel(null);
    }, [selectedMonth, selectedDirection, selectedClientKey, selectedSiteKey]);

    const handleRowNoteChange = (noteKey: string, value: string) => {
        setRowNoteState((prev) => {
            const base = prev.month === selectedMonth ? prev.notes : loadRowNotes(selectedMonth);
            const next = { ...base };
            if (value.trim()) next[noteKey] = value;
            else delete next[noteKey];
            return {
                month: selectedMonth,
                notes: next
            };
        });
    };

    const handleProgressStatusChange = (progressKey: string, value: SupportProgressStatus) => {
        setProgressStatusState((prev) => {
            const base = prev.month === selectedMonth ? prev.statuses : loadProgressStatuses(selectedMonth);
            const next = { ...base };
            if (value) next[progressKey] = value;
            else delete next[progressKey];
            return {
                month: selectedMonth,
                statuses: next
            };
        });
    };

    const renderProgressCell = (progressKey: string, label: string) => {
        const progressStatus = progressStatuses[progressKey] || '';
        const progressOption = getSupportProgressOption(progressStatus);

        return (
            <td className="border border-slate-900 px-1 py-1 text-center font-medium text-slate-900" onClick={(event) => event.stopPropagation()}>
                <select
                    aria-label={`${label} 진행구분`}
                    value={progressStatus}
                    onChange={(event) => handleProgressStatusChange(
                        progressKey,
                        isSupportProgressStatus(event.target.value) ? event.target.value : ''
                    )}
                    className="h-7 w-full border border-slate-900/20 px-1 text-center text-[12px] font-black text-slate-950 outline-none transition focus:bg-white focus:ring-1 focus:ring-emerald-400"
                    style={{ backgroundColor: progressOption?.color ?? '#ffffff' }}
                >
                    <option value="">선택</option>
                    {SUPPORT_PROGRESS_OPTIONS.map((option) => (
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
        );
    };

    const renderNoteCell = (noteKey: string, label: string) => (
        <td className="border border-slate-900 px-1.5 py-1" onClick={(event) => event.stopPropagation()}>
            <textarea
                value={rowNotes[noteKey] || ''}
                onChange={(event) => handleRowNoteChange(noteKey, event.target.value)}
                aria-label={`${label} 비고 입력`}
                placeholder="비고 입력"
                rows={2}
                className="block min-h-[46px] w-full resize-y rounded border border-transparent bg-slate-50 px-2 py-1.5 text-xs font-bold leading-4 text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-amber-300 focus:bg-white focus:ring-1 focus:ring-amber-300"
            />
        </td>
    );

    const renderLaborStatementPanelRow = (panelKey: string) => {
        if (!laborStatementPanel || laborStatementPanel.key !== panelKey) return null;

        return (
            <tr>
                <td colSpan={summaryDetailColSpan} className="border border-slate-900 bg-emerald-50 p-4">
                    <SupportClientLaborStatementPanel
                        target={laborStatementPanel.target}
                        yearMonth={selectedMonth}
                        statementKey={panelKey}
                        outputSource="support-client-site"
                        onClose={closeLaborStatementPanel}
                    />
                </td>
            </tr>
        );
    };

    const renderTransactionStatementPanelRow = (panelKey: string) => {
        if (!transactionStatementPanel || transactionStatementPanel.key !== panelKey) return null;

        return (
            <tr>
                <td colSpan={summaryDetailColSpan} className="border border-slate-900 bg-teal-50 p-4">
                    <SupportClientTransactionStatementPanel
                        panelKey={panelKey}
                        target={transactionStatementPanel.target}
                        yearMonth={selectedMonth}
                        mode={transactionStatementPanel.mode}
                        linkedStatements={getLinkedTransactionStatements(panelKey, transactionStatementPanel.mode)}
                        allStatements={transactionStatements}
                        loading={transactionStatementsLoading}
                        onSaved={fetchTransactionStatements}
                        outputSource="support-client-site"
                        onClose={closeTransactionStatementPanel}
                    />
                </td>
            </tr>
        );
    };

    const handleDownloadExcel = () => {
        const siteAmountMetrics = new Map<string, SiteAllocationMetrics & { ssukkumi: number }>();
        clientGroups.forEach((client) => {
            client.sites.forEach((site) => {
                const metrics = getSiteAllocationMetrics(site);
                siteAmountMetrics.set(site.key, {
                    ...metrics,
                    ssukkumi: metrics.settlementAmount > 0 && site.totalManDay > 0 ? Math.round(metrics.settlementAmount / site.totalManDay) : 0
                });
            });
        });

        const summaryRows = clientGroups.flatMap((client) =>
            client.sites.map((site) => {
                const amountMetric = siteAmountMetrics.get(site.key) || { issuedAmount: 0, settlementAmount: 0, distributableAmount: 0, allocatedAmount: 0, unallocatedAmount: 0, vatAmount: 0, isOverAllocated: false, ssukkumi: 0 };
                return {
                    발주사: client.clientCompanyName,
                    현장: site.siteName,
                    현장구분: summarizeNames(site.siteTypes),
                    결제방식: summarizeNames(site.paymentTypes),
                    시공사: site.constructorCompanyName || '',
                    지원구분: summarizeOutputTypeDisplayNames(site.rows),
                    현장담당팀: summarizeNames(site.responsibleTeamNames),
                    작업팀: summarizeSourceTeamDisplayNames(site.rows),
                    정산주체: summarizeNames(site.settlementNames),
                    투입일수: site.activeDates.length,
                    인원수: site.workerCount,
                    공수: Number(site.totalManDay.toFixed(1)),
                    평균단가: site.avgUnitPrice,
                    노무금액: site.totalAmount,
                    청구단가: getSiteBillingUnitPrice(site),
                    청구금액: getSiteBillingAmount(site),
                    발행금액: amountMetric.issuedAmount || '',
                    정산금액: amountMetric.settlementAmount || '',
                    차액: amountMetric.distributableAmount || '',
                    배분합계: amountMetric.allocatedAmount || '',
                    미배분: amountMetric.unallocatedAmount || '',
                    쓰꾸미: amountMetric.ssukkumi || '',
                    진행구분: getSupportProgressLabel(progressStatuses[getSiteNoteKey(site.key)]),
                    비고: rowNotes[getSiteNoteKey(site.key)] || ''
                };
            })
        );

        const detailRows = filteredRows.map((row) => {
            const siteKey = `${clientKeyForRow(row)}::${siteKeyForRow(row)}`;
            const amountMetric = siteAmountMetrics.get(siteKey) || { issuedAmount: 0, settlementAmount: 0, distributableAmount: 0, allocatedAmount: 0, unallocatedAmount: 0, vatAmount: 0, isOverAllocated: false, ssukkumi: 0 };
            return {
                일자: row.date,
                발주사: getClientCompanyName(row),
                시공사: row.constructorCompanyName,
                현장: row.siteName,
                현장구분: row.siteType,
                결제방식: row.paymentType,
                지원구분: getOutputTypeDisplayName(row),
                작업자: row.workerName,
                직종: row.role || '',
                작업팀: getSourceTeamDisplayName(row),
                현장담당팀: row.responsibleTeamName,
                정산주체: row.settlementName,
                공수: Number(row.manDay.toFixed(1)),
                단가: row.unitPrice,
                노무금액: row.amount,
                청구단가: getRowBillingUnitPrice(row),
                청구금액: getRowBillingAmount(row),
                발행금액: amountMetric.issuedAmount || '',
                정산금액: amountMetric.settlementAmount || '',
                차액: amountMetric.distributableAmount || '',
                배분합계: amountMetric.allocatedAmount || '',
                미배분: amountMetric.unallocatedAmount || '',
                쓰꾸미: amountMetric.ssukkumi || '',
                진행구분: getSupportProgressLabel(progressStatuses[getSiteNoteKey(siteKey)]),
                근거: row.evidenceNote,
                비고: rowNotes[getSiteNoteKey(siteKey)] || ''
            };
        });

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), '발주사별_현장요약');
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(detailRows), '작업자상세');
        XLSX.writeFile(workbook, `support-client-site-${selectedMonth}.xlsx`);
    };

    const hasRows = filteredRows.length > 0;

    const renderSiteRows = (site: SupportSiteSummary, indentClass = 'pl-5', siteLevelLabel?: string) => {
        const isSiteExpanded = expandedSiteKeys.has(site.key);
        const issuedAmountInputValue = issuedAmounts[site.key] || '';
        const settlementAmountInputValue = settlementAmounts[site.key] || '';
        const allocationMetrics = getSiteAllocationMetrics(site);
        const siteVatAmount = allocationMetrics.vatAmount;
        const siteBillingUnitPrice = getSiteBillingUnitPrice(site);
        const siteBillingAmount = getSiteBillingAmount(site);
        const defaultIssuedAmount = getSiteDefaultIssuedAmount(site);
        const ssukkumi = allocationMetrics.settlementAmount > 0 && site.totalManDay > 0
            ? Math.round(allocationMetrics.settlementAmount / site.totalManDay)
            : 0;
        const siteTypeDisplay = summarizeNames(site.siteTypes);
        const paymentTypeDisplay = summarizeNames(site.paymentTypes);
        const siteStatementTarget: SupportStatementTarget = {
            title: site.siteName,
            subtitle: `${site.clientCompanyName} · 현장`,
            rows: site.rows,
            expenseClaims: getSiteExpenseClaims(site),
            billingRateBySiteKey: getBillingRateBySiteKey([site]),
            billingRateByRowId: getBillingRateByRowId(site.rows)
        };
        const siteProgressKey = getSiteNoteKey(site.key);
        const siteProgressOption = getSupportProgressOption(progressStatuses[siteProgressKey]);
        const siteOutputTypeLabels = uniqueValues(site.rows.map((row) => getOutputTypeDisplayName(row)))
            .filter((label) => label !== OWN_SITE_OUTPUT_LABEL);

        return (
            <React.Fragment key={site.key}>
                <tr
                    onClick={() => toggleSite(site.key)}
                    className={`cursor-pointer transition-colors ${siteProgressOption ? '' : 'bg-white hover:bg-slate-50'}`}
                    style={siteProgressOption ? { backgroundColor: siteProgressOption.rowColor } : undefined}
                >
                    <td className={`border border-slate-900 px-2 py-2 ${indentClass}`}>
                        <div className="flex min-w-0 items-start gap-2">
                            <AccordionChevron expanded={isSiteExpanded} className="mt-1 text-[11px] text-slate-500" />
                            <div className="min-w-0">
                                {siteOutputTypeLabels.length > 0 && (
                                    <div className="mb-1 flex flex-wrap items-center gap-1">
                                        {siteOutputTypeLabels.map((label) => (
                                            <OutputTypeBadge key={label} label={label} />
                                        ))}
                                    </div>
                                )}
                                <div className="flex min-w-0 items-center gap-2 font-black text-slate-900">
                                    {siteLevelLabel && (
                                        <span className="shrink-0 rounded bg-slate-700 px-1.5 py-0.5 text-[10px] font-black text-white">
                                            {siteLevelLabel}
                                        </span>
                                    )}
                                    <FontAwesomeIcon icon={faMapLocationDot} className="shrink-0 text-slate-400" />
                                    <span className="truncate">{site.siteName}</span>
                                </div>
                                <div className="mt-1 flex flex-wrap gap-1.5">
                                    <SiteMetaBadge label="구분" value={siteTypeDisplay} tone="violet" />
                                    <SiteMetaBadge label="결제" value={paymentTypeDisplay} tone="sky" />
                                </div>
                                <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                                    <span className="text-[10px] font-black text-slate-500">현장담당</span>
                                    <ResponsibleTeamChips teams={site.responsibleTeams} />
                                </div>
                            </div>
                        </div>
                    </td>
                    <td className="border border-slate-900 px-2 py-2 text-center font-mono font-black">{formatManDay(site.totalManDay)}</td>
                    <td className="border border-slate-900 px-2 py-2 text-right font-mono">{formatNumber(site.avgUnitPrice)}</td>
                    <td className="border border-slate-900 px-2 py-2 text-right font-mono font-black">{formatNumber(site.totalAmount)}</td>
                    {showAllocationColumns && (
                        <>
                    <td className="border border-slate-900 bg-emerald-50 px-1 py-1 text-right font-mono font-black text-emerald-800" onClick={(event) => event.stopPropagation()}>
                        <input
                            type="text"
                            inputMode="numeric"
                            aria-label={`${site.siteName} 청구단가`}
                            value={siteBillingUnitPrice > 0 ? formatNumber(siteBillingUnitPrice) : ''}
                            onChange={(event) => handleSiteBillingRateChange(site, event.target.value)}
                            onFocus={(event) => event.currentTarget.select()}
                            placeholder="0"
                            className="h-7 w-full bg-transparent px-1 text-right font-mono font-black text-emerald-800 outline-none transition focus:bg-emerald-100 focus:ring-1 focus:ring-emerald-400"
                        />
                    </td>
                    <td className="border border-slate-900 bg-emerald-50 px-2 py-2 text-right font-mono font-black text-emerald-900">{siteBillingAmount > 0 ? formatNumber(siteBillingAmount) : '-'}</td>
                        </>
                    )}
                    <td className="border border-slate-900 bg-yellow-50 px-1 py-1 text-right font-mono" onClick={(event) => event.stopPropagation()}>
                        <div className="flex items-center">
                            <input
                                type="text"
                                inputMode="numeric"
                                aria-label={`${site.siteName} 발행금액 입력`}
                                value={formatCurrencyInputValue(issuedAmountInputValue)}
                                onChange={(event) => handleIssuedAmountChange(site.key, event.target.value)}
                                onBlur={(event) => void persistSiteSettlementSnapshot(site, { issuedValue: event.currentTarget.value })}
                                placeholder={defaultIssuedAmount > 0 ? formatNumber(defaultIssuedAmount) : '0'}
                                className="h-7 min-w-0 flex-1 bg-transparent px-1 text-right font-mono font-black text-amber-900 outline-none transition focus:bg-amber-100 focus:ring-1 focus:ring-amber-400"
                            />
                            <span className="ml-1 text-[11px] font-black text-slate-500">원</span>
                        </div>
                        {siteVatAmount > 0 && (
                            <div className="mt-0.5 text-[10px] font-black leading-none text-amber-700">
                                부가세 +{formatNumber(siteVatAmount)} 포함
                            </div>
                        )}
                    </td>
                    <td className="border border-slate-900 bg-amber-100 px-1 py-1 text-right font-mono" onClick={(event) => event.stopPropagation()}>
                        <div className="flex items-center">
                            <input
                                type="text"
                                inputMode="numeric"
                                aria-label={`${site.siteName} 정산금액 입력`}
                                value={formatCurrencyInputValue(settlementAmountInputValue)}
                                onChange={(event) => handleSettlementAmountChange(site.key, event.target.value)}
                                onBlur={(event) => void persistSiteSettlementSnapshot(site, { settlementValue: event.currentTarget.value })}
                                placeholder="0"
                                className="h-7 min-w-0 flex-1 bg-transparent px-1 text-right font-mono font-black text-amber-950 outline-none transition focus:bg-amber-200 focus:ring-1 focus:ring-amber-500"
                            />
                            <span className="ml-1 text-[11px] font-black text-slate-500">원</span>
                        </div>
                    </td>
                    {showAllocationColumns && (
                        <>
                            <td className="border border-slate-900 px-2 py-2 text-right font-mono font-black text-slate-900">
                                {allocationMetrics.distributableAmount > 0 ? formatNumber(allocationMetrics.distributableAmount) : '-'}
                            </td>
                            <td className="border border-slate-900 px-2 py-2 text-right font-mono font-black text-indigo-700">
                                {allocationMetrics.allocatedAmount > 0 ? formatNumber(allocationMetrics.allocatedAmount) : '-'}
                            </td>
                            <td className={`border border-slate-900 px-2 py-2 text-right font-mono font-black ${allocationMetrics.isOverAllocated ? 'text-rose-700' : allocationMetrics.unallocatedAmount === 0 && allocationMetrics.distributableAmount > 0 ? 'text-emerald-700' : 'text-amber-800'}`}>
                                {allocationMetrics.distributableAmount > 0 || allocationMetrics.allocatedAmount > 0 ? formatNumber(allocationMetrics.unallocatedAmount) : '-'}
                            </td>
                        </>
                    )}
                    <td className="border border-slate-900 px-2 py-2 text-right font-mono font-black text-amber-800">{ssukkumi > 0 ? formatNumber(ssukkumi) : '-'}</td>
                    {renderProgressCell(siteProgressKey, site.siteName)}
                    {renderNoteCell(siteProgressKey, site.siteName)}
                    <td className="border border-slate-900 px-1 py-1 text-center" onClick={(event) => event.stopPropagation()}>
                        <div className="flex flex-wrap items-center justify-center gap-1">
                            <StatementActionButtons
                                target={siteStatementTarget}
                                onOpenLabor={(target) => toggleLaborStatementPanel(siteProgressKey, target)}
                                onOpenTransaction={(target) => toggleTransactionStatementPanel(siteProgressKey, target, 'standard')}
                                onOpenRentalTransaction={(target) => toggleTransactionStatementPanel(siteProgressKey, target, 'rental')}
                                onOpenExpense={setExpenseStatementTarget}
                                laborOpen={isLaborStatementPanelOpen(siteProgressKey)}
                                transactionOpen={isTransactionStatementPanelOpen(siteProgressKey, 'standard')}
                                rentalTransactionOpen={isTransactionStatementPanelOpen(siteProgressKey, 'rental')}
                                transactionCount={getLinkedTransactionStatements(siteProgressKey, 'standard').length}
                                rentalTransactionCount={getLinkedTransactionStatements(siteProgressKey, 'rental').length}
                            />
                            {showAllocationColumns && (
                                <button
                                    type="button"
                                    onClick={() => openAllocationModal(site)}
                                    className="rounded border border-indigo-200 bg-indigo-50 px-1.5 py-1 text-[11px] font-black text-indigo-700 hover:bg-indigo-100"
                                >
                                    배분
                                </button>
                            )}
                        </div>
                    </td>
                </tr>

                {renderLaborStatementPanelRow(siteProgressKey)}
                {renderTransactionStatementPanelRow(siteProgressKey)}

                {isSiteExpanded && (
                    <tr>
                        <td colSpan={summaryDetailColSpan} className="border border-slate-900 bg-slate-50 p-4">
                            <div className="mb-3">
                                <h3 className="flex flex-wrap items-center gap-2 text-sm font-black text-slate-800">
                                    {siteLevelLabel && (
                                        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-black text-white">
                                            4단
                                        </span>
                                    )}
                                    <span>{site.siteName} 작업자 상세</span>
                                </h3>
                                <p className="mt-1 text-[11px] font-semibold text-slate-500">
                                    {formatNumber(site.rows.length)}개 투입 행 · {formatManDay(site.totalManDay)}공수 · 노무 {formatNumber(site.totalAmount)}원
                                    {showAllocationColumns && ` · 청구 ${formatNumber(siteBillingAmount)}원`}
                                </p>
                            </div>
                            <div className="overflow-x-auto border border-slate-900 bg-white">
                                <table className={`w-full border-collapse text-xs ${showAllocationColumns ? 'min-w-[1120px]' : 'min-w-[940px]'}`}>
                                    <thead className="bg-slate-100 text-slate-700">
                                    <tr>
                                        <th className="border border-slate-900 px-4 py-2.5 text-left">일자</th>
                                        <th className="border border-slate-900 px-4 py-2.5 text-left">구분</th>
                                        <th className="border border-slate-900 px-4 py-2.5 text-left">작업자</th>
                                        <th className="border border-slate-900 px-4 py-2.5 text-left">작업팀</th>
                                        <th className="border border-slate-900 px-4 py-2.5 text-left">현장담당팀</th>
                                        <th className="border border-slate-900 px-4 py-2.5 text-left">정산주체</th>
                                        <th className="border border-slate-900 px-4 py-2.5 text-right">공수</th>
                                        <th className="border border-slate-900 px-4 py-2.5 text-right">단가</th>
                                        <th className="border border-slate-900 px-4 py-2.5 text-right">금액</th>
                                        {showAllocationColumns && (
                                            <>
                                        <th className="border border-slate-900 bg-emerald-100 px-4 py-2.5 text-right text-emerald-950">청구단가</th>
                                        <th className="border border-slate-900 bg-emerald-100 px-4 py-2.5 text-right text-emerald-950">청구금액</th>
                                            </>
                                        )}
                                        <th className="border border-slate-900 px-4 py-2.5 text-left">근거</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {site.rows.map((row) => (
                                        <tr key={row.rowId}>
                                            <td className="border border-slate-900 px-4 py-2.5 font-mono text-slate-500">{row.date}</td>
                                            <td className="border border-slate-900 px-4 py-2.5"><OutputTypeBadge label={getOutputTypeDisplayName(row)} /></td>
                                            <td className="border border-slate-900 px-4 py-2.5 font-black text-slate-800">{row.workerName}</td>
                                            <td className="border border-slate-900 px-4 py-2.5 font-bold text-slate-600">
                                                {getSourceTeamDisplayName(row) || '-'}
                                            </td>
                                            <td className="border border-slate-900 px-4 py-2.5 font-bold text-slate-600">{row.responsibleTeamName || '-'}</td>
                                            <td className="border border-slate-900 px-4 py-2.5 font-bold text-slate-600">{row.settlementName || '-'}</td>
                                            <td className="border border-slate-900 px-4 py-2.5 text-right font-mono font-bold">{formatManDay(row.manDay)}</td>
                                            <td className="border border-slate-900 px-4 py-2.5 text-right font-mono text-slate-500">{formatNumber(row.unitPrice)}</td>
                                            <td className="border border-slate-900 px-4 py-2.5 text-right font-mono font-black text-slate-800">{formatNumber(row.amount)}</td>
                                            {showAllocationColumns && (
                                                <>
                                            <td className="border border-slate-900 bg-emerald-50 px-1 py-1 text-right font-mono text-emerald-700" onClick={(event) => event.stopPropagation()}>
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    aria-label={`${row.workerName} 청구단가`}
                                                    value={formatNumber(getRowBillingUnitPrice(row))}
                                                    onChange={(event) => handleRowBillingRateChange(row, event.target.value)}
                                                    onFocus={(event) => event.currentTarget.select()}
                                                    className="h-7 w-full bg-transparent px-1 text-right font-mono text-emerald-700 outline-none transition focus:bg-emerald-100 focus:ring-1 focus:ring-emerald-400"
                                                    placeholder="0"
                                                />
                                            </td>
                                            <td className="border border-slate-900 bg-emerald-50 px-4 py-2.5 text-right font-mono font-black text-emerald-800">{formatNumber(getRowBillingAmount(row))}</td>
                                                </>
                                            )}
                                            <td className="border border-slate-900 px-4 py-2.5 text-slate-500">{row.evidenceNote}</td>
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
    };

    const getClientVisibleRowCount = (client: SupportClientSummary): number => {
        const clientPanelKey = getClientNoteKey(client.key);
        const clientPanelCount =
            (isLaborStatementPanelOpen(clientPanelKey) ? 1 : 0) +
            (isTransactionStatementPanelOpen(clientPanelKey) ? 1 : 0);
        const isClientExpanded = expandedClientKeys.has(client.key);
        if (!isClientExpanded) return 1 + clientPanelCount;

        const getVisibleSiteExtraRowCount = (site: SupportSiteSummary): number => {
            const sitePanelKey = getSiteNoteKey(site.key);
            return (
                (isLaborStatementPanelOpen(sitePanelKey) ? 1 : 0) +
                (isTransactionStatementPanelOpen(sitePanelKey) ? 1 : 0) +
                (expandedSiteKeys.has(site.key) ? 1 : 0)
            );
        };
        if (isExternalClientSummary(client)) {
            const responsibleTeamGroups = groupSitesByResponsibleTeam(client.sites);
            const teamPanelCount = responsibleTeamGroups.reduce((sum, teamGroup) => {
                const teamPanelKey = getResponsibleTeamNoteKey(client.key, teamGroup.key);
                return sum +
                    (isLaborStatementPanelOpen(teamPanelKey) ? 1 : 0) +
                    (isTransactionStatementPanelOpen(teamPanelKey) ? 1 : 0);
            }, 0);
            const expandedResponsibleTeamSiteRowCount = responsibleTeamGroups
                .filter((teamGroup) => expandedResponsibleTeamKeys.has(teamGroup.key))
                .reduce((sum, teamGroup) =>
                    sum + teamGroup.sites.length + teamGroup.sites.reduce((siteSum, site) => siteSum + getVisibleSiteExtraRowCount(site), 0),
                0);
            return 1 + clientPanelCount + responsibleTeamGroups.length + teamPanelCount + expandedResponsibleTeamSiteRowCount;
        }

        return 1 + clientPanelCount + client.sites.length + client.sites.reduce((sum, site) => sum + getVisibleSiteExtraRowCount(site), 0);
    };

    const standardClientGroups = clientGroups.filter((client) => !isExternalClientSummary(client));
    const orderedClientGroups = standardClientGroups;
    const standardClientGroupRowSpan = standardClientGroups.reduce((sum, client) => sum + getClientVisibleRowCount(client), 0);

    return (
        <div className="support-team-font w-full max-w-none space-y-6 p-6 font-['Pretendard']">
            <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                    <div className="rounded-xl bg-emerald-100 p-3 text-emerald-600 shadow-inner">
                        <FontAwesomeIcon icon={faBuilding} size="lg" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-slate-800">발주사별 현장별 지원 정산</h1>
                        <p className="mt-0.5 flex items-center gap-2 text-[13px] font-bold text-slate-500">
                            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-700">BETA</span>
                            지원팀 지급 관리 데이터를 발주사와 현장 단위로 재집계합니다.
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2.5">
                    <button
                        type="button"
                        onClick={() => navigate('/payroll/support-team')}
                        className="inline-flex items-center gap-2 rounded-xl border-2 border-slate-200 px-4 py-2.5 text-sm font-black text-slate-600 transition hover:bg-slate-50"
                    >
                        <FontAwesomeIcon icon={faArrowLeft} />
                        지원팀 지급 관리
                    </button>
                    <button
                        type="button"
                        onClick={handleDownloadExcel}
                        disabled={!hasRows}
                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <FontAwesomeIcon icon={faDownload} />
                        엑셀 다운로드
                    </button>
                </div>
            </div>

            <div className="flex w-full flex-col gap-6 lg:flex-row">
                <aside className="hidden">
                    <div className="sticky top-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3.5">
                            <span className="text-sm font-black text-slate-700">발주사 필터</span>
                            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-black text-slate-600">{clientOptions.length}</span>
                        </div>
                        <div className="max-h-[calc(100vh-300px)] space-y-1.5 overflow-y-auto p-2">
                            <button
                                type="button"
                                onClick={() => setSelectedClientKey('')}
                                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-bold transition-all ${
                                    selectedClientKey === '' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'
                                }`}
                            >
                                <FontAwesomeIcon icon={faBuilding} className={selectedClientKey === '' ? 'opacity-100' : 'opacity-40'} />
                                <span className="flex-1 truncate">전체 발주사</span>
                            </button>
                            <div className="mx-2 my-2 h-px bg-slate-100" />
                            {clientOptions.map((client) => (
                                <button
                                    key={client.key}
                                    type="button"
                                    onClick={() => setSelectedClientKey(client.key)}
                                    className={`flex w-full items-center justify-between gap-2 rounded-xl px-4 py-3 text-left text-sm font-bold transition-all ${
                                        selectedClientKey === client.key ? 'bg-emerald-700 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'
                                    }`}
                                >
                                    <span className="min-w-0 flex-1 truncate">{client.clientCompanyName}</span>
                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                                        selectedClientKey === client.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                                    }`}>
                                        {client.siteCount}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                </aside>

                <main className="min-w-0 flex-1 space-y-6">
                    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:flex-row xl:items-center xl:justify-between">
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-3">
                                <FontAwesomeIcon icon={faCalendarAlt} className="text-emerald-500" />
                                <span className="text-sm font-bold text-slate-500">집계 기준월</span>
                                <input
                                    type="month"
                                    value={selectedMonth}
                                    onChange={(event) => setSelectedMonth(event.target.value)}
                                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-black outline-none transition focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>
                            {showAllocationColumns && (
                                <>
                            <div className="hidden h-6 w-px bg-slate-200 sm:block" />
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-bold text-slate-500">청구단가</span>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={bulkBillingRateInput}
                                    onChange={(event) => setBulkBillingRateInput(event.target.value)}
                                    onFocus={(event) => event.currentTarget.select()}
                                    aria-label="일괄 적용 청구단가"
                                    className="h-9 w-32 rounded-lg border border-slate-200 bg-slate-50 px-3 text-right text-sm font-black text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                                />
                                <span className="text-sm font-bold text-slate-500">원</span>
                                <button
                                    type="button"
                                    onClick={handleApplyBulkBillingRate}
                                    disabled={loading || filteredRows.length === 0}
                                    className="inline-flex h-9 items-center gap-2 rounded-lg bg-slate-900 px-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                                >
                                    <FontAwesomeIcon icon={faCircleCheck} />
                                    월 적용
                                </button>
                                {appliedBulkBillingRate > 0 && (
                                    <span className="text-[11px] font-bold text-emerald-600">{selectedMonth} 적용됨</span>
                                )}
                            </div>
                                </>
                            )}
                            <button
                                type="button"
                                onClick={() => setShowAllocationColumns((prev) => !prev)}
                                aria-pressed={showAllocationColumns}
                                className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-black transition ${
                                    showAllocationColumns
                                        ? 'border-indigo-500 bg-indigo-600 text-white shadow-sm'
                                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                <FontAwesomeIcon icon={faShareNodes} />
                                분배
                            </button>
                            <div className="hidden h-6 w-px bg-slate-200 sm:block" />
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                                <FontAwesomeIcon icon={loading ? faSpinner : faCircleCheck} spin={loading} />
                                {loading ? '집계 중' : `${formatNumber(displayRows.length)}건 로드`}
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <select
                                value={selectedDirection}
                                onChange={(event) => setSelectedDirection(event.target.value as 'all' | SupportDirection)}
                                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-black outline-none focus:ring-2 focus:ring-emerald-500"
                            >
                                {DIRECTION_OPTIONS.map((option) => (
                                    <option key={option.id} value={option.id}>{option.label}</option>
                                ))}
                            </select>
                            <select
                                value={selectedSiteKey}
                                onChange={(event) => setSelectedSiteKey(event.target.value)}
                                className="max-w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-black outline-none focus:ring-2 focus:ring-emerald-500 sm:max-w-[260px]"
                            >
                                <option value="">모든 현장</option>
                                {siteOptions.map((site) => (
                                    <option key={site.key} value={site.key}>{site.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {errors.length > 0 && (
                        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
                            <FontAwesomeIcon icon={faTriangleExclamation} className="mr-2" />
                            {errors[0]}
                        </div>
                    )}

                    <div className={`grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 ${showAllocationColumns ? '2xl:grid-cols-11' : '2xl:grid-cols-7'}`}>
                        <SummaryCard label="총 투입 공수" value={`${formatManDay(totalSummary.totalManDay)} 공수`} icon={faCalendarAlt} tone="violet" />
                        <SummaryCard label="총 노무금액" value={`${formatNumber(totalSummary.totalAmount)} 원`} icon={faCircleCheck} tone="emerald" />
                        {showAllocationColumns && (
                            <SummaryCard label="총 청구금액" value={`${formatNumber(totalSummary.totalBillingAmount)} 원`} icon={faFileInvoiceDollar} tone="orange" />
                        )}
                        <SummaryCard label="총 발행금액" value={`${formatNumber(amountSummary.totalIssuedAmount)} 원`} icon={faDownload} tone="sky" />
                        <SummaryCard label="총 정산금액" value={`${formatNumber(amountSummary.totalSettlementAmount)} 원`} icon={faReceipt} tone="emerald" />
                        {showAllocationColumns && (
                            <>
                        <SummaryCard label="총 차액" value={`${formatNumber(amountSummary.totalDistributableAmount)} 원`} icon={faShareNodes} tone="violet" />
                        <SummaryCard label="배분합계" value={`${formatNumber(amountSummary.totalAllocatedAmount)} 원`} icon={faFileInvoiceDollar} tone="sky" />
                        <SummaryCard label="미배분" value={`${formatNumber(amountSummary.totalUnallocatedAmount)} 원`} icon={faTriangleExclamation} tone={amountSummary.totalUnallocatedAmount < 0 ? 'orange' : 'violet'} />
                            </>
                        )}
                        <SummaryCard label="평균 쓰꾸미" value={amountSummary.avgSsukkumi > 0 ? `${formatNumber(amountSummary.avgSsukkumi)} 원` : '-'} icon={faCircleCheck} tone="orange" />
                        <SummaryCard label="발주사 / 현장" value={`${formatNumber(totalSummary.clientCount)} / ${formatNumber(totalSummary.siteCount)}`} icon={faBuilding} tone="sky" />
                        <SummaryCard label="투입 인원" value={`${formatNumber(totalSummary.workerCount)} 명`} icon={faUsers} tone="orange" />
                    </div>

                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-black text-amber-800">
                        계산서 현장 부가세 합계: {formatNumber(amountSummary.totalVatAmount)}원
                    </div>

                    <div className="overflow-hidden border border-slate-900 bg-white shadow-sm">
                        <div className="flex flex-col gap-2 border-b border-slate-900 bg-white px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                            <h2 className="text-base font-black text-slate-900">
                                {selectedClientKey
                                    ? clientOptions.find((client) => client.key === selectedClientKey)?.clientCompanyName || '선택 발주사'
                                    : '전체 발주사'} 현장별 지원 요약
                            </h2>
                            <span className="text-[11px] font-bold text-slate-500">도급 직영 현장은 2단 발주사 · 3단 현장 · 4단 작업자 상세로 표시합니다.</span>
                        </div>

                        {loading ? (
                            <div className="px-4 py-16 text-center font-bold text-slate-400">
                                <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
                                지원 정산 데이터를 집계하고 있습니다.
                            </div>
                        ) : !hasRows ? (
                            <div className="px-4 py-16 text-center font-bold text-slate-400">
                                <FontAwesomeIcon icon={faSearch} className="mr-2" />
                                해당 조건의 발주사별/현장별 지원 내역이 없습니다.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className={`w-full table-fixed border-collapse text-[13px] ${showAllocationColumns ? 'min-w-[2120px]' : 'min-w-[1460px]'}`}>
                                    <thead>
                                        <tr className="text-center font-black text-slate-950">
                                            <th className="w-14 border border-slate-900 bg-gradient-to-br from-yellow-100 via-yellow-400 to-white p-2"></th>
                                            <th className="w-64 border border-slate-900 bg-gradient-to-br from-white via-slate-200 to-slate-500 p-2 tracking-[0.2em]">발주사 / 담당팀 / 현장</th>
                                            <th className="w-20 border border-slate-900 bg-gradient-to-br from-white via-slate-200 to-slate-500 p-2 tracking-[0.35em]">공수</th>
                                            <th className="w-28 border border-slate-900 bg-gradient-to-br from-white via-slate-200 to-slate-500 p-2 tracking-[0.2em]">평균단가</th>
                                            <th className="w-32 border border-slate-900 bg-gradient-to-br from-white via-slate-200 to-slate-500 p-2 tracking-[0.2em]">노무금액</th>
                                            {showAllocationColumns && (
                                                <>
                                            <th className="w-28 border border-slate-900 bg-gradient-to-br from-white via-emerald-100 to-emerald-300 p-2 tracking-[0.05em] text-emerald-950">청구단가</th>
                                            <th className="w-32 border border-slate-900 bg-gradient-to-br from-white via-emerald-100 to-emerald-300 p-2 tracking-[0.05em] text-emerald-950">청구금액</th>
                                                </>
                                            )}
                                            <th className="w-28 border border-slate-900 bg-gradient-to-br from-yellow-50 via-yellow-300 to-yellow-500 p-2 tracking-[0.2em] text-slate-950">발행금액</th>
                                            <th className="w-28 border border-slate-900 bg-gradient-to-br from-amber-100 via-amber-300 to-amber-500 p-2 tracking-[0.2em] text-slate-950">정산금액</th>
                                            {showAllocationColumns && (
                                                <>
                                            <th className="w-32 border border-slate-900 bg-gradient-to-br from-white via-slate-200 to-slate-500 p-2 tracking-[0.35em]">차액</th>
                                            <th className="w-36 border border-slate-900 bg-gradient-to-br from-white via-slate-200 to-slate-500 p-2 tracking-[0.2em]">배분합계</th>
                                            <th className="w-32 border border-slate-900 bg-gradient-to-br from-white via-slate-200 to-slate-500 p-2 tracking-[0.35em]">미배분</th>
                                                </>
                                            )}
                                            <th className="w-28 border border-slate-900 bg-gradient-to-br from-white via-slate-200 to-slate-500 p-2 tracking-[0.35em]">쓰꾸미</th>
                                            <th className="w-36 border border-slate-900 bg-gradient-to-br from-white via-slate-200 to-slate-500 p-2 tracking-[0.2em]">진행구분</th>
                                            <th className="w-72 border border-slate-900 bg-gradient-to-br from-white via-slate-200 to-slate-500 p-2 tracking-[0.35em]">비고</th>
                                            <th className="w-64 border border-slate-900 bg-gradient-to-br from-white via-slate-200 to-slate-500 p-2 tracking-[0.35em]">기타</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                {orderedClientGroups.map((client) => {
                                    const isClientExpanded = expandedClientKeys.has(client.key);
                                    const isExternalClient = isExternalClientSummary(client);
                                    const isFirstStandardClient = !isExternalClient && standardClientGroups[0]?.key === client.key;
                                    const responsibleTeamGroups = isExternalClient ? groupSitesByResponsibleTeam(client.sites) : [];
                                    const clientAllocationMetrics = getSitesAllocationMetrics(client.sites);
                                    const clientBillingMetrics = getSitesBillingMetrics(client.sites);
                                    const clientSsukkumi = clientAllocationMetrics.settlementAmount > 0 && client.totalManDay > 0
                                        ? Math.round(clientAllocationMetrics.settlementAmount / client.totalManDay)
                                        : 0;
                                    const clientAverageUnitPrice = client.totalManDay > 0
                                        ? Math.round(client.totalAmount / client.totalManDay)
                                        : 0;
                                    const clientRowSpan = getClientVisibleRowCount(client);
                                    const firstLevelRowSpan = isExternalClient ? clientRowSpan : standardClientGroupRowSpan;
                                    const firstLevelLabel = isExternalClient ? EXTERNAL_CLIENT_GROUP_DISPLAY_NAME : STANDARD_CLIENT_GROUP_DISPLAY_NAME;
                                    const clientDisplayName = isExternalClient ? '지원현장 전체' : client.clientCompanyName;
                                    const clientStatementTarget: SupportStatementTarget = {
                                        title: clientDisplayName,
                                        subtitle: isExternalClient ? EXTERNAL_CLIENT_GROUP_DISPLAY_NAME : STANDARD_CLIENT_GROUP_DISPLAY_NAME,
                                        rows: client.sites.flatMap((site) => site.rows),
                                        expenseClaims: getSitesExpenseClaims(client.sites),
                                        billingRateBySiteKey: getBillingRateBySiteKey(client.sites),
                                        billingRateByRowId: getBillingRateByRowId(client.sites.flatMap((site) => site.rows))
                                    };
                                    const clientProgressKey = getClientNoteKey(client.key);
                                    const clientProgressOption = getSupportProgressOption(progressStatuses[clientProgressKey]);
                                    return (
                                        <React.Fragment key={client.key}>
                                            <tr
                                                onClick={() => toggleClient(client.key)}
                                                className={`cursor-pointer transition-colors ${clientProgressOption ? '' : 'bg-white hover:bg-emerald-50'}`}
                                                style={clientProgressOption ? { backgroundColor: clientProgressOption.rowColor } : undefined}
                                            >
                                                {(isExternalClient || isFirstStandardClient) && (
                                                    <td
                                                        rowSpan={firstLevelRowSpan}
                                                        className={`border border-slate-900 text-center align-middle text-lg font-black text-slate-950 ${
                                                            isExternalClient
                                                                ? 'bg-gradient-to-br from-yellow-100 via-yellow-400 to-white'
                                                                : 'bg-gradient-to-br from-emerald-100 via-emerald-400 to-white'
                                                        }`}
                                                    >
                                                        <div className="mx-auto leading-8" style={{ writingMode: 'vertical-rl', textOrientation: 'upright' }}>
                                                            {firstLevelLabel}
                                                        </div>
                                                    </td>
                                                )}
                                                <td className={`border border-slate-900 px-2 py-2 font-black ${isExternalClient ? 'text-slate-950' : 'pl-4 text-slate-900'}`}>
                                                    <span className={`inline-flex min-w-0 items-center ${isExternalClient ? 'gap-2' : 'gap-2.5'}`}>
                                                        <AccordionChevron expanded={isClientExpanded} className={`${isExternalClient ? 'text-[11px]' : 'text-sm'} text-emerald-700`} />
                                                        {!isExternalClient && (
                                                            <span className="shrink-0 rounded bg-emerald-700 px-2 py-1 text-[12px] font-black text-white">2단</span>
                                                        )}
                                                        <span className={`truncate ${isExternalClient ? '' : 'text-sm'}`}>{clientDisplayName}</span>
                                                    </span>
                                                </td>
                                                <td className="border border-slate-900 px-2 py-2 text-center font-mono font-black">{formatManDay(client.totalManDay)}</td>
                                                <td className="border border-slate-900 px-2 py-2 text-right font-mono">{clientAverageUnitPrice > 0 ? formatNumber(clientAverageUnitPrice) : '-'}</td>
                                                <td className="border border-slate-900 px-2 py-2 text-right font-mono font-black text-slate-950">{formatNumber(client.totalAmount)}</td>
                                                {showAllocationColumns && (
                                                    <>
                                                <td className="border border-slate-900 bg-emerald-50 px-2 py-2 text-right font-mono font-black text-emerald-800">{clientBillingMetrics.billingUnitPrice > 0 ? formatNumber(clientBillingMetrics.billingUnitPrice) : '-'}</td>
                                                <td className="border border-slate-900 bg-emerald-50 px-2 py-2 text-right font-mono font-black text-emerald-900">{clientBillingMetrics.billingAmount > 0 ? formatNumber(clientBillingMetrics.billingAmount) : '-'}</td>
                                                    </>
                                                )}
                                                <td className="border border-slate-900 bg-yellow-50 px-2 py-2 text-right font-mono font-black text-amber-900">{clientAllocationMetrics.issuedAmount > 0 ? formatNumber(clientAllocationMetrics.issuedAmount) : '-'}</td>
                                                <td className="border border-slate-900 bg-amber-100 px-2 py-2 text-right font-mono font-black text-amber-950">{clientAllocationMetrics.settlementAmount > 0 ? formatNumber(clientAllocationMetrics.settlementAmount) : '-'}</td>
                                                {showAllocationColumns && (
                                                    <>
                                                        <td className="border border-slate-900 px-2 py-2 text-right font-mono font-black text-slate-950">{clientAllocationMetrics.distributableAmount > 0 ? formatNumber(clientAllocationMetrics.distributableAmount) : '-'}</td>
                                                <td className="border border-slate-900 px-2 py-2 text-right font-mono font-black text-indigo-700">{clientAllocationMetrics.allocatedAmount > 0 ? formatNumber(clientAllocationMetrics.allocatedAmount) : '-'}</td>
                                                        <td className={`border border-slate-900 px-2 py-2 text-right font-mono font-black ${clientAllocationMetrics.isOverAllocated ? 'text-rose-700' : 'text-amber-800'}`}>{clientAllocationMetrics.distributableAmount > 0 || clientAllocationMetrics.allocatedAmount > 0 ? formatNumber(clientAllocationMetrics.unallocatedAmount) : '-'}</td>
                                                    </>
                                                )}
                                                <td className="border border-slate-900 px-2 py-2 text-right font-mono font-black text-amber-800">{clientSsukkumi > 0 ? formatNumber(clientSsukkumi) : '-'}</td>
                                                {renderProgressCell(clientProgressKey, clientDisplayName)}
                                                {renderNoteCell(clientProgressKey, clientDisplayName)}
                                                <td className="border border-slate-900 px-1 py-1 text-center" onClick={(event) => event.stopPropagation()}>
                                                    <StatementActionButtons
                                                        target={clientStatementTarget}
                                                        onOpenLabor={(target) => toggleLaborStatementPanel(clientProgressKey, target)}
                                                        onOpenTransaction={(target) => toggleTransactionStatementPanel(clientProgressKey, target, 'standard')}
                                                        onOpenRentalTransaction={(target) => toggleTransactionStatementPanel(clientProgressKey, target, 'rental')}
                                                        onOpenExpense={setExpenseStatementTarget}
                                                        laborOpen={isLaborStatementPanelOpen(clientProgressKey)}
                                                        transactionOpen={isTransactionStatementPanelOpen(clientProgressKey, 'standard')}
                                                        rentalTransactionOpen={isTransactionStatementPanelOpen(clientProgressKey, 'rental')}
                                                        transactionCount={getLinkedTransactionStatements(clientProgressKey, 'standard').length}
                                                        rentalTransactionCount={getLinkedTransactionStatements(clientProgressKey, 'rental').length}
                                                    />
                                                </td>
                                            </tr>

                                            {renderLaborStatementPanelRow(clientProgressKey)}
                                            {renderTransactionStatementPanelRow(clientProgressKey)}

                                            {isClientExpanded && (
                                                <>
                                                    {isExternalClient ? (
                                                        responsibleTeamGroups.map((teamGroup) => {
                                                            const isTeamExpanded = expandedResponsibleTeamKeys.has(teamGroup.key);
                                                            const teamAllocationMetrics = getSitesAllocationMetrics(teamGroup.sites);
                                                            const teamBillingMetrics = getSitesBillingMetrics(teamGroup.sites);
                                                            const teamSsukkumi = teamAllocationMetrics.settlementAmount > 0 && teamGroup.totalManDay > 0
                                                                ? Math.round(teamAllocationMetrics.settlementAmount / teamGroup.totalManDay)
                                                                : 0;
                                                            const teamStatementTarget: SupportStatementTarget = {
                                                                title: teamGroup.team.name,
                                                                subtitle: `${EXTERNAL_CLIENT_GROUP_DISPLAY_NAME} · 현장담당팀`,
                                                                rows: teamGroup.rows,
                                                                expenseClaims: getSitesExpenseClaims(teamGroup.sites),
                                                                billingRateBySiteKey: getBillingRateBySiteKey(teamGroup.sites),
                                                                billingRateByRowId: getBillingRateByRowId(teamGroup.rows)
                                                            };
                                                            const teamProgressKey = getResponsibleTeamNoteKey(client.key, teamGroup.key);
                                                            const teamProgressOption = getSupportProgressOption(progressStatuses[teamProgressKey]);

                                                            return (
                                                                <React.Fragment key={teamGroup.key}>
                                                                    <tr
                                                                        onClick={() => toggleResponsibleTeam(teamGroup.key)}
                                                                        className={`cursor-pointer transition-colors ${teamProgressOption ? '' : 'bg-emerald-50 hover:bg-emerald-100'}`}
                                                                        style={teamProgressOption ? { backgroundColor: teamProgressOption.rowColor } : undefined}
                                                                    >
                                                                        <td className="border border-slate-900 px-2 py-2 pl-4 font-black text-slate-900">
                                                                            <div className="flex min-w-0 items-center gap-2.5">
                                                                                <AccordionChevron expanded={isTeamExpanded} className="text-sm text-emerald-700" />
                                                                                <span className="shrink-0 rounded bg-emerald-700 px-2 py-1 text-[12px] font-black text-white">2단</span>
                                                                                <ResponsibleTeamChips teams={[teamGroup.team]} size="lg" />
                                                                            </div>
                                                                        </td>
                                                                        <td className="border border-slate-900 px-2 py-2 text-center font-mono font-black">{formatManDay(teamGroup.totalManDay)}</td>
                                                                        <td className="border border-slate-900 px-2 py-2 text-right font-mono">{teamGroup.avgUnitPrice > 0 ? formatNumber(teamGroup.avgUnitPrice) : '-'}</td>
                                                                        <td className="border border-slate-900 px-2 py-2 text-right font-mono font-black">{formatNumber(teamGroup.totalAmount)}</td>
                                                                        {showAllocationColumns && (
                                                                            <>
                                                                                <td className="border border-slate-900 bg-emerald-50 px-2 py-2 text-right font-mono font-black text-emerald-800">{teamBillingMetrics.billingUnitPrice > 0 ? formatNumber(teamBillingMetrics.billingUnitPrice) : '-'}</td>
                                                                        <td className="border border-slate-900 bg-emerald-50 px-2 py-2 text-right font-mono font-black text-emerald-900">{teamBillingMetrics.billingAmount > 0 ? formatNumber(teamBillingMetrics.billingAmount) : '-'}</td>
                                                                            </>
                                                                        )}
                                                                        <td className="border border-slate-900 bg-yellow-50 px-2 py-2 text-right font-mono font-black text-amber-900">{teamAllocationMetrics.issuedAmount > 0 ? formatNumber(teamAllocationMetrics.issuedAmount) : '-'}</td>
                                                                        <td className="border border-slate-900 bg-amber-100 px-2 py-2 text-right font-mono font-black text-amber-950">{teamAllocationMetrics.settlementAmount > 0 ? formatNumber(teamAllocationMetrics.settlementAmount) : '-'}</td>
                                                                        {showAllocationColumns && (
                                                                            <>
                                                                        <td className="border border-slate-900 px-2 py-2 text-right font-mono font-black">{teamAllocationMetrics.distributableAmount > 0 ? formatNumber(teamAllocationMetrics.distributableAmount) : '-'}</td>
                                                                        <td className="border border-slate-900 px-2 py-2 text-right font-mono font-black text-indigo-700">{teamAllocationMetrics.allocatedAmount > 0 ? formatNumber(teamAllocationMetrics.allocatedAmount) : '-'}</td>
                                                                        <td className={`border border-slate-900 px-2 py-2 text-right font-mono font-black ${teamAllocationMetrics.isOverAllocated ? 'text-rose-700' : 'text-amber-800'}`}>{teamAllocationMetrics.distributableAmount > 0 || teamAllocationMetrics.allocatedAmount > 0 ? formatNumber(teamAllocationMetrics.unallocatedAmount) : '-'}</td>
                                                                            </>
                                                                        )}
                                                                        <td className="border border-slate-900 px-2 py-2 text-right font-mono font-black text-amber-800">{teamSsukkumi > 0 ? formatNumber(teamSsukkumi) : '-'}</td>
                                                                        {renderProgressCell(teamProgressKey, teamGroup.team.name)}
                                                                        {renderNoteCell(teamProgressKey, teamGroup.team.name)}
                                                                        <td className="border border-slate-900 px-1 py-1 text-center" onClick={(event) => event.stopPropagation()}>
                                                                            <StatementActionButtons
                                                                                target={teamStatementTarget}
                                                                                onOpenLabor={(target) => toggleLaborStatementPanel(teamProgressKey, target)}
                                                                                onOpenTransaction={(target) => toggleTransactionStatementPanel(teamProgressKey, target, 'standard')}
                                                                                onOpenRentalTransaction={(target) => toggleTransactionStatementPanel(teamProgressKey, target, 'rental')}
                                                                                onOpenExpense={setExpenseStatementTarget}
                                                                                laborOpen={isLaborStatementPanelOpen(teamProgressKey)}
                                                                                transactionOpen={isTransactionStatementPanelOpen(teamProgressKey, 'standard')}
                                                                                rentalTransactionOpen={isTransactionStatementPanelOpen(teamProgressKey, 'rental')}
                                                                                transactionCount={getLinkedTransactionStatements(teamProgressKey, 'standard').length}
                                                                                rentalTransactionCount={getLinkedTransactionStatements(teamProgressKey, 'rental').length}
                                                                            />
                                                                        </td>
                                                                    </tr>
                                                                    {renderLaborStatementPanelRow(teamProgressKey)}
                                                                    {renderTransactionStatementPanelRow(teamProgressKey)}
                                                                    {isTeamExpanded && teamGroup.sites.map((site) => renderSiteRows(site, 'pl-9', '3단'))}
                                                                </React.Fragment>
                                                            );
                                                        })
                                                    ) : (
                                                        client.sites.map((site) => renderSiteRows(site, 'pl-9', '3단'))
                                                    )}
                                                </>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </main>
            </div>
            {expenseStatementTarget && (
                <SupportClientExpenseStatementModal
                    target={expenseStatementTarget}
                    yearMonth={selectedMonth}
                    onClose={() => setExpenseStatementTarget(null)}
                />
            )}
            {allocationModalTarget && (
                <SupportClientAllocationModal
                    target={allocationModalTarget}
                    settlementTargets={settlementTargets}
                    companies={companies}
                    saving={allocationSaving}
                    onClose={() => setAllocationModalTarget(null)}
                    onSave={saveAllocationLines}
                />
            )}
        </div>
    );
};

export default SupportClientSitePage;
