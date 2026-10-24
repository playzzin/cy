import React from 'react';
import html2canvas from 'html2canvas';
import { MAX_DAY_COLUMNS, DAY_LABELS_FIRST, DAY_LABELS_SECOND } from '../../utils/excel/SupportPaymentExcelGenerator';
import { Team } from '../../services/teamService';
import { Company } from '../../services/companyService';
import { Site } from '../../services/siteService';
import { DailyReport, DailyReportWorker } from '../../services/dailyReportService';
import { type Worker } from '../../services/manpowerService';
import { SupportRate } from '../../services/supportRateService';
import { SettlementTargetType } from '../../services/settlementTargetService';
import { SupportClientAllocation, SupportClientAllocationLine } from '../../services/supportClientSiteAllocationService';
import { Estimate, EstimateItem } from '../../services/estimateService';
import type { TeamExpenseClaim } from '../../types/teamExpenseLedger';
import type { StatementOutputSource } from '../../types/statementOutput';
import { normalizeHexColor } from '../../utils/color';
import { getLaborStatementWorkerPayType, getWorkerMasterLaborStatementPayType, loadLaborStatementPresetDefaults, loadStatementIssueOptionPreset, saveStatementIssueOptionPreset, type StatementIssueOptionPreset } from '../../utils/payrollLaborStatementDefaults';
import { createItem, EstimateDraft, getEmptyDraft } from '../../utils/estimateUtils';
import { RentalAmountBasis, RentalMaterialRate, RentalWorkType } from '../../utils/rentalTransactionGenerator';


export type SupportDirection = '외부지원간곳' | '외부지원온곳' | '본인현장출력';

export type SupportStatementPayType = 'direct' | 'delegate';

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

export interface SupportTeamBadge {
    key: string;
    name: string;
    color: string;
    icon: string;
}

export interface SupportSiteSummary {
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

export type SupportTransactionStatementDraft = EstimateDraft & {
    supportStatementKey?: string;
    supportStatementSource?: StatementOutputSource;
    supportStatementYearMonth?: string;
    supportStatementTargetTitle?: string;
    supportStatementTargetSubtitle?: string;
};

export type SupportTransactionStatementMode = 'standard' | 'rental';

export interface SupportTransactionStatementOptionDefaults {
    includeVat?: boolean;
    vatRate?: number;
    paymentTerms?: string;
    notes?: string;
    rentalAmountBasis?: RentalAmountBasis;
    rentalUsageDays?: number;
    rentalRowCount?: number;
    rentalWorkType?: RentalWorkType;
}

export interface SupportClientLaborStatementRow {
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

export interface SupportClientLaborStatementOptions {
    unitPriceOverride: number;
    defaultPayType: SupportStatementPayType;
    workerPayTypes: Record<string, SupportStatementPayType>;
    delegateBankName: string;
    delegateAccountHolder: string;
    delegateAccountNumber: string;
}

export interface SupportClientLaborStatementViewOptions {
    showBankColumn: boolean;
    showBillingColumns: boolean;
    isSplitView: boolean;
    showBankUnderAddress: boolean;
    showTeamUnderName: boolean;
}

export interface SupportClientLaborSitePreview {
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

export interface SupportResponsibleTeamSummary {
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

export interface SupportClientSummary {
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

export type SupportProgressStatus =
    | ''
    | 'depositComplete'
    | 'dawinIssued'
    | 'cheongyeonIssued'
    | 'laborProcessed'
    | 'issueRequested';

export interface SupportProgressOption {
    value: Exclude<SupportProgressStatus, ''>;
    label: string;
    color: string;
    rowColor: string;
}

export interface SupportClientAllocationModalTarget {
    site: SupportSiteSummary;
    issuedAmount: number;
    settlementAmount: number;
    distributableAmount: number;
    vatAmount: number;
    allocation?: SupportClientAllocation;
}

export interface SiteAllocationMetrics {
    issuedAmount: number;
    settlementAmount: number;
    distributableAmount: number;
    allocatedAmount: number;
    unallocatedAmount: number;
    vatAmount: number;
    isOverAllocated: boolean;
}

export const DEFAULT_SUPPORT_UNIT_PRICE = 230000;

export const EXTERNAL_CLIENT_GROUP_ID = 'external-client-group';

export const EXTERNAL_CLIENT_GROUP_NAME = '외부팀';

export const EXTERNAL_CLIENT_GROUP_LEGACY_DISPLAY_NAME = '외부지원간곳';

export const EXTERNAL_CLIENT_GROUP_DISPLAY_NAME = '지원현장';

export const STANDARD_CLIENT_GROUP_DISPLAY_NAME = '도급 직영 현장';

export const OWN_SITE_OUTPUT_LABEL = '본인현장출력';

export const SUPPORT_DIRECTION_ORDER: SupportDirection[] = ['외부지원간곳', '외부지원온곳', OWN_SITE_OUTPUT_LABEL];

export const DIRECTION_META: Record<SupportDirection, { label: string; badgeClass: string; rowClass: string }> = {
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

export const DIRECTION_OPTIONS: Array<{ id: 'all' | SupportDirection; label: string }> = [
    { id: 'all', label: '전체 구분' },
    ...SUPPORT_DIRECTION_ORDER
        .filter((direction) => direction !== '외부지원간곳')
        .map((direction) => ({ id: direction, label: DIRECTION_META[direction].label }))
];

export const normalize = (value: unknown): string => String(value ?? '').replace(/\s+/g, '').trim();

export const normalizeName = (value: unknown): string =>
    String(value ?? '').replace(/\(.*?\)/g, '').replace(/\s+/g, '').trim();

export const normalizeTeamComparisonName = (value: unknown): string =>
    normalizeName(value).replace(/(?:현장담당|작업|지원)?팀$/g, '');

export const formatNumber = (value: number): string => new Intl.NumberFormat('ko-KR').format(Math.round(value || 0));

export const formatCurrencyInputValue = (value?: string): string => {
    const amount = parseCurrencyAmount(value);
    return amount > 0 ? formatNumber(amount) : '';
};

export const formatManDay = (value: number): string => {
    const fixed = Number((value || 0).toFixed(1));
    return fixed % 1 === 0 ? fixed.toFixed(0) : fixed.toFixed(1);
};

export const formatStatementDayManDay = (value: number): string => {
    const fixed = Number((value || 0).toFixed(1));
    return fixed === 0 ? '' : formatManDay(value);
};

export const formatCurrencyText = (value: number): string => `${formatNumber(Math.round(value || 0))}원`;

export const formatManDayText = (value: number): string => `${formatManDay(value || 0)}공수`;

export const formatFullIdNumber = (value?: string | null): string => {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    const digits = raw.replace(/[^0-9]/g, '');
    if (digits.length === 13) return `${digits.slice(0, 6)}-${digits.slice(6)}`;
    return raw;
};

export const getCurrentYearMonth = (): string => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
};

export const formatYearMonthLabel = (yearMonth: string): string => {
    const [year, month] = yearMonth.split('-');
    const monthNumber = parseInt(month ?? '', 10);
    return `${year || ''}년 ${Number.isFinite(monthNumber) && monthNumber > 0 ? monthNumber : ''}월`.trim();
};

export const shiftYearMonth = (yearMonth: string, monthOffset: number): string => {
    const [rawYear, rawMonth] = yearMonth.split('-').map(Number);
    const fallback = new Date();
    const year = Number.isFinite(rawYear) ? rawYear : fallback.getFullYear();
    const month = Number.isFinite(rawMonth) ? rawMonth : fallback.getMonth() + 1;
    const target = new Date(year, month - 1 + monthOffset, 1);
    return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}`;
};

export const getMonthRange = (yearMonth: string): { start: string; end: string } => {
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

export const ISSUED_AMOUNT_STORAGE_PREFIX = 'support-client-site-issued-amounts';

export const SETTLEMENT_AMOUNT_STORAGE_PREFIX = 'support-client-site-settlement-amounts';

export const ROW_NOTE_STORAGE_PREFIX = 'support-client-site-row-notes';

export const PROGRESS_STATUS_STORAGE_PREFIX = 'support-client-site-progress-statuses';

export const BILLING_RATE_STORAGE_PREFIX = 'support-client-site-billing-rates';

export const TRANSACTION_STATEMENT_OPTION_STORAGE_PREFIX = 'support-client-transaction-statement-options-v1';

export const SUPPORT_CLIENT_TAX_INVOICE_VAT_RATE = 0.1;

export const SUPPORT_PROGRESS_OPTIONS: SupportProgressOption[] = [
    { value: 'depositComplete', label: '입금 완료', color: '#ffc000', rowColor: '#ffc000' },
    { value: 'dawinIssued', label: '다윈 발행', color: '#00b0f0', rowColor: '#00b0f0' },
    { value: 'cheongyeonIssued', label: '청연 발행', color: '#ffff00', rowColor: '#ffff00' },
    { value: 'laborProcessed', label: '노무 처리', color: '#00b050', rowColor: '#00b050' },
    { value: 'issueRequested', label: '발행 요청', color: '#ff00ff', rowColor: '#ff00ff' }
];

export const SETTLEMENT_TARGET_TYPE_OPTIONS: Array<{ value: SettlementTargetType; label: string }> = [
    { value: 'office_income', label: '사무실 수입' },
    { value: 'rental_company', label: '임대사' },
    { value: 'client_company', label: '발주사' },
    { value: 'client_contact', label: '관계자' },
    { value: 'other', label: '기타' },
];

export const ALLOCATION_LINE_STATUS_OPTIONS: Array<{ value: SupportClientAllocationLine['status']; label: string }> = [
    { value: 'confirmed', label: '확정' },
    { value: 'payment_pending', label: '지급예정' },
    { value: 'received', label: '입금완료' },
];

export const getIssuedAmountStorageKey = (yearMonth: string): string =>
    `${ISSUED_AMOUNT_STORAGE_PREFIX}:${yearMonth || 'unknown-month'}`;

export const getSettlementAmountStorageKey = (yearMonth: string): string =>
    `${SETTLEMENT_AMOUNT_STORAGE_PREFIX}:${yearMonth || 'unknown-month'}`;

export const getRowNoteStorageKey = (yearMonth: string): string =>
    `${ROW_NOTE_STORAGE_PREFIX}:${yearMonth || 'unknown-month'}`;

export const getProgressStatusStorageKey = (yearMonth: string): string =>
    `${PROGRESS_STATUS_STORAGE_PREFIX}:${yearMonth || 'unknown-month'}`;

export const getBillingRateStorageKey = (yearMonth: string): string =>
    `${BILLING_RATE_STORAGE_PREFIX}:${yearMonth || 'unknown-month'}`;

export const isSupportProgressStatus = (value: unknown): value is SupportProgressStatus =>
    value === '' || SUPPORT_PROGRESS_OPTIONS.some((option) => option.value === value);

export const getSupportProgressOption = (value: SupportProgressStatus | undefined): SupportProgressOption | undefined =>
    SUPPORT_PROGRESS_OPTIONS.find((option) => option.value === value);

export const getSupportProgressLabel = (value: SupportProgressStatus | undefined): string =>
    getSupportProgressOption(value)?.label || '';

export const parseCurrencyAmount = (value?: string): number => {
    const parsed = Number(String(value ?? '').replace(/[^0-9]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
};

export const normalizeCurrencyAmountInput = (value: string): string =>
    value.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');

export const parseIssuedAmount = parseCurrencyAmount;

export const parseSettlementAmount = parseCurrencyAmount;

export const parseBillingRate = parseCurrencyAmount;

export const normalizeIssuedAmountInput = normalizeCurrencyAmountInput;

export const normalizeSettlementAmountInput = normalizeCurrencyAmountInput;

export const normalizeBillingRateInput = normalizeCurrencyAmountInput;

export const getTransactionStatementOptionStorageKey = (
    mode: SupportTransactionStatementMode,
    preset: StatementIssueOptionPreset
): string => `${TRANSACTION_STATEMENT_OPTION_STORAGE_PREFIX}:${mode}:${preset}`;

export const isRentalAmountBasis = (value: unknown): value is RentalAmountBasis =>
    value === 'supply' || value === 'total';

export const isRentalWorkType = (value: unknown): value is RentalWorkType =>
    value === 'shoring' || value === 'scaffold';

export const cleanPositiveInteger = (value: unknown): number | undefined => {
    const parsed = typeof value === 'number' ? value : Number(String(value ?? '').replace(/[^0-9]/g, ''));
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : undefined;
};

export const normalizeSupportTransactionStatementOptions = (
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

export const loadSupportTransactionStatementOptions = (
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

export const saveSupportTransactionStatementOptions = (
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

export const applySupportTransactionStatementOptions = (
    draft: SupportTransactionStatementDraft,
    options: SupportTransactionStatementOptionDefaults
): SupportTransactionStatementDraft => ({
    ...draft,
    ...(typeof options.includeVat === 'boolean' ? { includeVat: options.includeVat } : {}),
    ...(options.vatRate ? { vatRate: options.vatRate } : {}),
    ...(options.paymentTerms !== undefined ? { paymentTerms: options.paymentTerms } : {}),
    ...(options.notes !== undefined ? { notes: options.notes } : {}),
});

export const normalizeAllocationTargetType = (value?: SettlementTargetType | string | null): SettlementTargetType =>
    SETTLEMENT_TARGET_TYPE_OPTIONS.some((option) => option.value === value) ? value as SettlementTargetType : 'other';

export const createAllocationLineId = (): string =>
    `allocation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const normalizeAllocationLineAmountInput = normalizeCurrencyAmountInput;

export const getAllocationStatus = (distributableAmount: number, allocatedAmount: number): SupportClientAllocation['status'] => {
    if (allocatedAmount <= 0) return 'draft';
    if (allocatedAmount > distributableAmount) return 'over';
    if (allocatedAmount === distributableAmount) return 'balanced';
    return 'partial';
};

export const loadIssuedAmounts = (yearMonth: string): Record<string, string> => {
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

export const loadSettlementAmounts = (yearMonth: string): Record<string, string> => {
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

export const loadRowNotes = (yearMonth: string): Record<string, string> => {
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

export const loadProgressStatuses = (yearMonth: string): Record<string, SupportProgressStatus> => {
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

export const loadBillingRates = (yearMonth: string): Record<string, string> => {
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

export const toPositiveRate = (value: unknown): number | null => {
    const parsed = typeof value === 'number'
        ? value
        : typeof value === 'string'
            ? Number(value.replace(/,/g, ''))
            : NaN;
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return Math.round(parsed);
};

export const getIdentityKey = (id: unknown, name: unknown, fallback: string): string =>
    normalize(id) || normalizeName(name) || fallback;

export const uniqueValues = (values: Array<string | undefined | null>): string[] => {
    const seen = new Set<string>();
    values.forEach((value) => {
        const trimmed = String(value ?? '').trim();
        if (trimmed) seen.add(trimmed);
    });
    return Array.from(seen);
};

export const summarizeNames = (values: Array<string | undefined | null>, fallback = '-'): string => {
    const unique = uniqueValues(values);
    return unique.length > 0 ? unique.join(', ') : fallback;
};

export const isSameIdentity = (a?: string | null, b?: string | null): boolean =>
    !!normalize(a) && normalize(a) === normalize(b);

export const matchesTeamReference = (
    leftId?: string | null,
    leftName?: string | null,
    rightId?: string | null,
    rightName?: string | null
): boolean => (
    isSameIdentity(leftId, rightId) ||
    (!!normalizeName(leftName) && normalizeName(leftName) === normalizeName(rightName))
);

export const matchesSiteReference = (
    claim: Pick<TeamExpenseClaim, 'siteId' | 'siteName'>,
    site: Pick<SupportSiteSummary, 'siteId' | 'siteName'>
): boolean => (
    isSameIdentity(claim.siteId, site.siteId) ||
    (!!normalizeName(claim.siteName) && normalizeName(claim.siteName) === normalizeName(site.siteName))
);

export const isPostedTeamChargeClaim = (claim: TeamExpenseClaim): boolean =>
    claim.claimType === 'teamCharge' &&
    (claim.status === 'charged' || claim.status === 'settled') &&
    Number(claim.amount || 0) > 0;

export const getExpenseClaimAmount = (claim: TeamExpenseClaim): number =>
    Math.max(0, Math.round(Number(claim.amount || 0)));

export const getExpenseClaimStatusLabel = (status: TeamExpenseClaim['status']): string => {
    if (status === 'charged') return '청구완료';
    if (status === 'settled') return '정산완료';
    return '작성중';
};

export const getExpenseClaimKey = (claim: TeamExpenseClaim): string =>
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

export const sortExpenseClaims = (claims: TeamExpenseClaim[]): TeamExpenseClaim[] =>
    [...claims].sort((a, b) =>
        (a.date || '').localeCompare(b.date || '') ||
        (a.siteName || '').localeCompare(b.siteName || '', 'ko-KR') ||
        (a.description || '').localeCompare(b.description || '', 'ko-KR')
    );

export const dedupeExpenseClaims = (claims: TeamExpenseClaim[]): TeamExpenseClaim[] => {
    const claimMap = new Map<string, TeamExpenseClaim>();
    claims.forEach((claim) => {
        claimMap.set(getExpenseClaimKey(claim), claim);
    });
    return sortExpenseClaims(Array.from(claimMap.values()));
};

export const getExpenseClaimsTotal = (claims: TeamExpenseClaim[]): number =>
    claims.reduce((sum, claim) => sum + getExpenseClaimAmount(claim), 0);

export const getSupportLaborStatementWorkerKey = (
    row: Pick<SupportClientSiteWorkerRow, 'workerId' | 'siteId' | 'workerName'>
): string => row.workerId || `${row.siteId}:${row.workerName}`;

export const buildSupportWorkerPayTypesFromDefaults = (
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

export const buildSupportClientLaborPreviews = (
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

export const buildSupportClientLaborStatementText = (
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

export type OwnSiteOutputComparableRow = Pick<
    SupportClientSiteWorkerRow,
    'sourceTeamId' | 'sourceTeamName' | 'responsibleTeamId' | 'responsibleTeamName'
> & Partial<Pick<SupportClientSiteWorkerRow, 'workerTeamId' | 'workerTeamName' | 'direction'>>;

export const isOwnSiteOutputDirection = (row: OwnSiteOutputComparableRow): boolean =>
    row.direction === OWN_SITE_OUTPUT_LABEL;

export const isOwnSiteOutputRow = (
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

export const getSourceTeamDisplayName = (
    row: OwnSiteOutputComparableRow
): string => String(row.sourceTeamName || row.workerTeamName || '').trim();

export const summarizeSourceTeamDisplayNames = (rows: SupportClientSiteWorkerRow[], fallback = '-'): string =>
    summarizeNames(rows.map((row) => getSourceTeamDisplayName(row)), fallback);

export const getDirectionDisplayName = (direction: SupportDirection): string =>
    DIRECTION_META[direction]?.label ?? direction;

export const getOutputTypeDisplayName = (row: SupportClientSiteWorkerRow): string =>
    isOwnSiteOutputRow(row) ? OWN_SITE_OUTPUT_LABEL : getDirectionDisplayName(row.direction);

export const summarizeOutputTypeDisplayNames = (rows: SupportClientSiteWorkerRow[], fallback = '-'): string =>
    summarizeNames(rows.map((row) => getOutputTypeDisplayName(row)), fallback);

export const uniqueResponsibleTeams = (rows: SupportClientSiteWorkerRow[]): SupportTeamBadge[] => {
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

export const getPrimaryResponsibleTeam = (site: SupportSiteSummary): SupportTeamBadge => {
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

export const groupSitesByResponsibleTeam = (sites: SupportSiteSummary[]): SupportResponsibleTeamSummary[] => {
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

export const isExternalClientSummary = (client: Pick<SupportClientSummary, 'clientCompanyId' | 'clientCompanyName'>): boolean =>
    client.clientCompanyId === EXTERNAL_CLIENT_GROUP_ID ||
    client.clientCompanyName === EXTERNAL_CLIENT_GROUP_NAME ||
    client.clientCompanyName === EXTERNAL_CLIENT_GROUP_LEGACY_DISPLAY_NAME ||
    client.clientCompanyName === EXTERNAL_CLIENT_GROUP_DISPLAY_NAME;

export const claimMatchesSiteSettlement = (claim: TeamExpenseClaim, site: SupportSiteSummary): boolean =>
    site.rows.some((row) => {
        if (row.direction.endsWith('간곳')) {
            return matchesTeamReference(claim.chargeToTeamId, claim.chargeToTeamName, row.responsibleTeamId, row.responsibleTeamName);
        }
        return matchesTeamReference(claim.payerTeamId, claim.payerTeamName, row.sourceTeamId, row.sourceTeamName);
    });

export const applyExpenseClaimsToClientGroups = (
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

export const getSiteExpenseClaims = (site: SupportSiteSummary): TeamExpenseClaim[] =>
    dedupeExpenseClaims(site.expenseClaims ?? []);

export const getSitesExpenseClaims = (sites: SupportSiteSummary[]): TeamExpenseClaim[] =>
    dedupeExpenseClaims(sites.flatMap((site) => getSiteExpenseClaims(site)));

export const normalizePaymentMethodForVat = (value?: string | null): string => {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    if (raw.includes('계산서')) return '계산서';
    if (raw.includes('노무')) return '노무';
    return raw;
};

export const isTaxInvoicePaymentMethod = (value?: string | null): boolean =>
    normalizePaymentMethodForVat(value) === '계산서';

export const isTaxInvoiceSite = (site: SupportSiteSummary): boolean =>
    site.paymentTypes.some((paymentType) => isTaxInvoicePaymentMethod(paymentType));

export const getSiteIssuedSupplyAmount = (site: SupportSiteSummary): number =>
    Math.max(0, Math.round(site.totalAmount || 0));

export const getVatAmountToAdd = (supplyAmount: number): number =>
    Math.round(Math.max(0, Math.round(supplyAmount || 0)) * SUPPORT_CLIENT_TAX_INVOICE_VAT_RATE);

export const getIncludedVatAmount = (grossAmount: number): number => {
    const normalizedGrossAmount = Math.max(0, Math.round(grossAmount || 0));
    if (normalizedGrossAmount <= 0) return 0;
    const supplyAmount = Math.round(normalizedGrossAmount / (1 + SUPPORT_CLIENT_TAX_INVOICE_VAT_RATE));
    return Math.max(0, normalizedGrossAmount - supplyAmount);
};

export const getSiteDefaultVatAmount = (site: SupportSiteSummary, supplyAmount = getSiteIssuedSupplyAmount(site)): number =>
    isTaxInvoiceSite(site) ? getVatAmountToAdd(supplyAmount) : 0;

export const getSiteVatAmount = (site: SupportSiteSummary, issuedAmount?: number, supplyAmount = getSiteIssuedSupplyAmount(site)): number => {
    if (!isTaxInvoiceSite(site)) return 0;
    if (issuedAmount === undefined) return getSiteDefaultVatAmount(site, supplyAmount);
    return getIncludedVatAmount(issuedAmount);
};

export const getSiteDefaultIssuedAmount = (site: SupportSiteSummary, supplyAmount = getSiteIssuedSupplyAmount(site)): number =>
    isTaxInvoiceSite(site) ? supplyAmount + getSiteDefaultVatAmount(site, supplyAmount) : supplyAmount;

export const calculateSupportClientBillingAmount = (manDay: number, billingUnitPrice: number): number =>
    Math.round(Math.max(0, manDay || 0) * Math.max(0, Math.round(billingUnitPrice || 0)));

export const sanitizeFileNamePart = (value: string): string =>
    (value || '미지정').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim();

export const waitForDocumentFonts = async (): Promise<void> => {
    try {
        const fontSet = (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts;
        if (fontSet?.ready) await fontSet.ready;
    } catch (error) {
        console.warn('[SupportClientSitePage] font readiness check failed:', error);
    }
};

export const getCaptureScale = (width: number, height: number): number => {
    const baseScale = Math.max(2, window.devicePixelRatio || 1);
    const maxCanvasArea = 18000000;
    const area = Math.max(1, width * height);
    if (area * baseScale * baseScale <= maxCanvasArea) return baseScale;
    return Math.max(1, Math.sqrt(maxCanvasArea / area));
};

export const captureElementToPngBlob = async (node: HTMLElement): Promise<Blob> => {
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

export const blobToDataUrl = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error ?? new Error('Blob read failed'));
        reader.readAsDataURL(blob);
    });

export type ClipboardImageItemCtor = new (items: Record<string, Blob | Promise<Blob>>) => ClipboardItem;

export const getClipboardImageWriter = (): {
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

export const escapeHtmlAttribute = (value: string): string =>
    value.replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char] ?? char));

export const copyPngBlobBySelection = async (blob: Blob, altText: string, clipboardError: unknown = null): Promise<void> => {
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

export const copyPngBlobToClipboard = async (blob: Blob, altText = '명세서'): Promise<void> => {
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

export const COPY_STYLE_PROPERTIES = [
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

export const inlineComputedStyles = (source: HTMLElement, target: HTMLElement): void => {
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

export const copyElementHtmlToClipboard = (node: HTMLElement): boolean => {
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

export const copyElementToPngClipboard = async (node: HTMLElement, altText = '명세서'): Promise<void> => {
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

export const isCheongyeonCompanyName = (name?: string | null): boolean => {
    const normalized = normalizeName(name);
    return Boolean(normalized && (normalized.includes('청연') || normalized.includes('청연이엔지')));
};

export const normalizeSalaryModel = (value: unknown): string => {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    if (raw.includes('지원') || raw.toLowerCase().includes('support')) return '지원팀';
    if (raw.includes('월급')) return '월급제';
    if (raw.includes('일급')) return '일급제';
    if (raw.includes('용역')) return '용역팀';
    return raw;
};

export const getClientCompanyName = (row: Pick<SupportClientSiteWorkerRow, 'clientCompanyName'>): string =>
    String(row.clientCompanyName || '발주사 미지정').trim();

export const clientKeyForRow = (row: Pick<SupportClientSiteWorkerRow, 'clientCompanyId' | 'clientCompanyName'>): string =>
    getIdentityKey(row.clientCompanyId, getClientCompanyName(row), 'client:unknown');

export const siteKeyForRow = (row: Pick<SupportClientSiteWorkerRow, 'siteId' | 'siteName'>): string =>
    getIdentityKey(row.siteId, row.siteName, 'site:unknown');

export const getBillingRowRateKey = (row: Pick<SupportClientSiteWorkerRow, 'rowId'>): string =>
    `row:${row.rowId}`;

export const SUPPORT_TRANSACTION_STATEMENT_SOURCE = 'support-client-site' as const;

export const SUPPORT_RENTAL_RATE_STORAGE_KEY = 'cy-transaction-rental-material-rates-v1';

export const SUPPORT_RENTAL_WORK_TYPE_LABELS: Record<RentalWorkType, string> = {
    shoring: '시스템 동바리',
    scaffold: '시스템 비계',
};

export const getEstimateTransactionMode = (statement: Pick<Estimate, 'estimateMode'>): SupportTransactionStatementMode =>
    statement.estimateMode === 'rental' ? 'rental' : 'standard';

export const isEstimateTransactionMode = (
    statement: Pick<Estimate, 'estimateMode'>,
    mode: SupportTransactionStatementMode
): boolean => getEstimateTransactionMode(statement) === mode;

export const readStoredSupportRentalRates = (): RentalMaterialRate[] => {
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

export const writeStoredSupportRentalRates = (rates: RentalMaterialRate[]) => {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(SUPPORT_RENTAL_RATE_STORAGE_KEY, JSON.stringify(rates));
    } catch (error) {
        console.warn('[SupportClientSitePage] rental rate settings save failed:', error);
    }
};

export const parseSupportMoneyInput = (value: string): number => {
    const parsed = Number(String(value || '').replace(/,/g, '').trim());
    return Number.isFinite(parsed) ? parsed : 0;
};

export const getSupportTransactionDefaultClientCompany = (target: SupportStatementTarget): string => {
    const clientNames = uniqueValues(target.rows.map((row) => getClientCompanyName(row)));
    return clientNames.length === 1 ? clientNames[0] : target.title;
};

export const getSupportTransactionDefaultProjectName = (target: SupportStatementTarget): string => {
    const siteNames = uniqueValues(target.rows.map((row) => row.siteName));
    return siteNames.length === 1 ? siteNames[0] : target.title;
};

export const getSupportTransactionItemDate = (yearMonth: string, rows: SupportClientSiteWorkerRow[]): string =>
    rows.map((row) => row.date).filter(Boolean).sort()[0] ||
    (/^\d{4}-\d{2}$/.test(yearMonth) ? `${yearMonth}-01` : new Date().toISOString().split('T')[0]);

export const buildSupportTransactionItems = (target: SupportStatementTarget, yearMonth: string): EstimateItem[] => {
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

export const getSupportTransactionTargetAmount = (target: SupportStatementTarget, yearMonth: string): number =>
    buildSupportTransactionItems(target, yearMonth).reduce((sum, item) => (
        sum + Math.max(0, Math.round(item.amount || ((item.finalUnitPrice || 0) * (item.quantity || 0))))
    ), 0);

export const getSupportTransactionLinkFields = (
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

export const buildSupportTransactionDraft = (
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

export const buildSupportTransactionDraftFromEstimate = (
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

export const buildSupportRows = (
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

export const groupRowsByClientAndSite = (rows: SupportClientSiteWorkerRow[]): SupportClientSummary[] => {
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

export const DEFAULT_STATEMENT_LOGO_URL = '/icons/icon-192.png';

export const resolveStatementLogoUrl = (logoUrl?: string | null): string => {
    const trimmed = typeof logoUrl === 'string' ? logoUrl.trim() : '';
    return trimmed || DEFAULT_STATEMENT_LOGO_URL;
};

export const wrapCanvasText = (
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

export const drawCanvasCell = (
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

export const loadCanvasImage = (src: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
        const image = new Image();
        if (/^https?:\/\//i.test(src) && !src.startsWith(window.location.origin)) {
            image.crossOrigin = 'anonymous';
        }
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(`Image load failed: ${src}`));
        image.src = src;
    });

export const SUPPORT_CLIENT_LABOR_STATEMENT_SPLIT_WIDTHS = {
    no: 42,
    name: 100,
    identity: 132,
    address: 250,
    day: 30,
    total: 70,
    amount: 157,
    bank: 120,
};

export const SUPPORT_CLIENT_LABOR_STATEMENT_FULL_WIDTHS = {
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

export const buildSupportClientLaborStatementColumns = (
    viewOptions: SupportClientLaborStatementViewOptions
): Array<{ key: string; width: number }> => {
    if (viewOptions.isSplitView) {
        const widths = SUPPORT_CLIENT_LABOR_STATEMENT_SPLIT_WIDTHS;
        const columns = [
            { key: 'no', width: widths.no },
            { key: 'name', width: widths.name },
            { key: 'identity', width: widths.identity },
            { key: 'address', width: widths.address },
            ...Array.from({ length: Math.max(DAY_LABELS_FIRST.length, DAY_LABELS_SECOND.length) }, (_, index) => ({
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

export const loadSupportClientLaborStatementDefaults = (
    preset: StatementIssueOptionPreset = loadStatementIssueOptionPreset()
) => loadLaborStatementPresetDefaults(preset);
