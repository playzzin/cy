import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { CurrencyInput } from '../../components/common/CurrencyInput';
import {
  TeamSettlementWorkspaceHeader,
  type TeamSettlementSaveState
} from '../../components/payroll/TeamSettlementWorkspaceHeader';
import { accommodationAssignmentService } from '../../services/accommodationAssignmentService';
import { accommodationBillingService } from '../../services/accommodationBillingService';
import { accommodationService } from '../../services/accommodationService';
import { cardBillingService } from '../../services/cardBillingService';
import { cardService } from '../../services/cardService';
import { companyService } from '../../services/companyService';
import { dailyReportService, type DailyReportWorkerRow } from '../../services/dailyReportService';
import { laborExchangeService, type LaborExchangeItem, type TeamExchangeSummary } from '../../services/laborExchangeService';
import { manpowerService, type Worker as ManpowerWorker } from '../../services/manpowerService';
import { teamExpenseLedgerService } from '../../services/teamExpenseLedgerService';
import { teamService, type Team } from '../../services/teamService';
import { teamSettlementService, type TeamSettlementSupportDetailRow } from '../../services/teamSettlementService';
import { vehicleBillingService } from '../../services/vehicleBillingService';
import { vehicleService } from '../../services/vehicleService';
import { officeService } from '../../services/officeService';
import { supportRateService, type SupportRate } from '../../services/supportRateService';
import { toast } from '../../utils/swal';
import { selectPreferredSettlementBillings } from '../../utils/supportSettlementBilling';
import {
  createTeamSettlementDraftFingerprint,
  getTeamSettlementConfirmationIssues
} from '../../utils/teamSettlementDraft';
import type { UtilityRecord } from '../../types/accommodation';
import type { AccommodationAssignment } from '../../types/accommodationAssignment';
import type { AccommodationBillingDocument } from '../../types/accommodationBilling';
import type { Card, CardTransaction } from '../../types/card';
import type { CardBillingDocument } from '../../types/cardBilling';
import type {
  TeamSettlementAdditionItem,
  TeamSettlementDeductionItem,
  TeamSettlementDocument,
  TeamSettlementPurchaseItem,
  TeamSettlementSalesItem,
  TeamSettlementWorkKind
} from '../../types/teamSettlement';
import type { Vehicle, VehicleExpenseRecord } from '../../types/vehicle';
import type { VehicleBillingDocument } from '../../types/vehicleBilling';
import type { TeamExpenseClaim, TeamExpenseClaimCategory } from '../../types/teamExpenseLedger';

type LoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string };

const buildDefaultYearMonth = (): string => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

const MONTH_BUTTON_OPTIONS = Array.from({ length: 12 }, (_, index) => index + 1);

const parseYearMonthValue = (value: string): { year: number; month: number } => {
  const now = new Date();
  const fallback = { year: now.getFullYear(), month: now.getMonth() + 1 };
  const matched = /^(\d{4})-(\d{2})$/.exec(String(value ?? '').trim());
  if (!matched) return fallback;

  const year = Number(matched[1]);
  const month = Number(matched[2]);
  return {
    year: Number.isFinite(year) ? year : fallback.year,
    month: Number.isFinite(month) && month >= 1 && month <= 12 ? month : fallback.month
  };
};

const buildYearMonthValue = (year: number, month: number): string => {
  const now = new Date();
  const safeYear = Number.isFinite(year) ? year : now.getFullYear();
  const safeMonth = Number.isFinite(month) && month >= 1 && month <= 12 ? month : now.getMonth() + 1;
  return `${safeYear}-${String(safeMonth).padStart(2, '0')}`;
};

const DEFAULT_TEAM_BUTTON_COLOR = '#4f46e5';

const normalizeHexColor = (value?: string | null): string | null => {
  const trimmed = String(value ?? '').trim();
  const withoutHash = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;

  if (/^[0-9a-fA-F]{6}$/.test(withoutHash)) return `#${withoutHash.toLowerCase()}`;
  if (/^[0-9a-fA-F]{3}$/.test(withoutHash)) {
    return `#${withoutHash
      .split('')
      .map((char) => `${char}${char}`)
      .join('')
      .toLowerCase()}`;
  }

  return null;
};

const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const normalized = normalizeHexColor(hex);
  if (!normalized) return null;

  const value = normalized.slice(1);
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16)
  };
};

const getReadableTextColor = (hex: string): string => {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#ffffff';
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.55 ? '#0f172a' : '#ffffff';
};

const getTeamButtonStyle = (color: string | null | undefined, selected: boolean): React.CSSProperties => {
  const normalized = normalizeHexColor(color) ?? DEFAULT_TEAM_BUTTON_COLOR;
  const rgb = hexToRgb(normalized);
  if (!rgb) return {};

  if (selected) {
    return {
      backgroundColor: normalized,
      borderColor: normalized,
      color: getReadableTextColor(normalized)
    };
  }

  return {
    backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.12)`,
    borderColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.45)`,
    color: 'var(--team-settlement-team-chip-text, #1f2937)'
  };
};

const buildLocalId = (prefix: string): string => {
  const rand = Math.random().toString(16).slice(2);
  return `${prefix}_${Date.now()}_${rand}`;
};

const formatCurrency = (value: number): string => {
  const safe = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat('ko-KR').format(safe);
};

const formatManDay1 = (value: number): string => {
  const safe = Number.isFinite(value) ? value : 0;
  return (Math.round(safe * 10) / 10).toFixed(1);
};

const safeAverage = (numerator: number, denominator: number): number | null => {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return null;
  if (denominator <= 0) return null;
  return numerator / denominator;
};

const formatAverageCurrency = (value: number | null): string => {
  if (value === null) return '-';
  return `${formatCurrency(Math.round(value))}원`;
};


const safeNumber = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const cleaned = value.replace(/,/g, '').trim();
    if (!cleaned) return 0;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

const normalizeRateLookupKey = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .replace(/\s+/g, '')
    .toLowerCase();

const teamExpenseCategoryLabels: Record<TeamExpenseClaimCategory, string> = {
  meal: '식대',
  parking: '주차',
  fuel: '유류',
  toll: '통행료',
  material: '자재',
  tool: '공구',
  deposit: '보증금',
  marking: '마킹',
  fieldGoods: '현장물품',
  equipment: '장비비',
  etc: '기타'
};

const getTeamExpenseCategoryLabel = (category: TeamExpenseClaimCategory): string => {
  return teamExpenseCategoryLabels[category] ?? String(category || '기타');
};

const parseYmdDate = (value: string): Date | null => {
  const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? '').trim());
  if (!matched) return null;

  const year = Number(matched[1]);
  const month = Number(matched[2]);
  const day = Number(matched[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;

  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
};

const calculateOverlapDays = (params: {
  monthStart: Date;
  monthEnd: Date;
  startDate: Date;
  endDate?: Date | null;
}): number => {
  const actualStart = params.startDate.getTime() > params.monthStart.getTime() ? params.startDate : params.monthStart;
  const rawEnd = params.endDate && Number.isFinite(params.endDate.getTime()) ? params.endDate : params.monthEnd;
  const actualEnd = rawEnd.getTime() < params.monthEnd.getTime() ? rawEnd : params.monthEnd;
  if (actualEnd.getTime() < actualStart.getTime()) return 0;

  const oneDayMs = 24 * 60 * 60 * 1000;
  return Math.floor((actualEnd.getTime() - actualStart.getTime()) / oneDayMs) + 1;
};

const selectPreferredTeamBillings = <T extends { status?: unknown }>(
  docs: T[],
  additionalPosted?: (doc: T) => boolean
): T[] => selectPreferredSettlementBillings(docs, additionalPosted);

const hasBillingLineSource = (
  doc: { lineItems?: Array<{ sourceType?: unknown }> },
  sourceType: string
): boolean => (
  (doc.lineItems ?? []).some((item) => String(item.sourceType ?? '') === sourceType)
);

const isTeamIssuedTo = (value: unknown): boolean => {
  const raw = String(value ?? '').trim().toLowerCase();
  return raw === 'team' || raw === 'team_leader';
};

const isTeamBillingTarget = (params: {
  issuedToType?: unknown;
  teamId?: unknown;
  teamName?: unknown;
  issuedToWorkerId?: unknown;
  issuedToWorkerName?: unknown;
}): boolean => {
  if (isTeamIssuedTo(params.issuedToType)) return true;

  const issuedType = String(params.issuedToType ?? '').trim().toLowerCase();
  if (issuedType === 'worker') return false;

  const workerId = String(params.issuedToWorkerId ?? '').trim();
  if (workerId) return false;

  const workerName = String(params.issuedToWorkerName ?? '').trim();
  const teamName = String(params.teamName ?? '').trim();
  if (workerName && teamName && workerName !== teamName) return false;

  return (
    String(params.teamId ?? '').trim().length > 0 ||
    String(params.teamName ?? '').trim().length > 0
  );
};

const mapAccommodationTargetFieldLabel = (field: string): string => {
  if (field === 'accommodation') return '숙소비';
  if (field === 'privateRoom') return '개인실';
  if (field === 'electricity') return '전기';
  if (field === 'gas') return '가스';
  if (field === 'internet') return '인터넷';
  if (field === 'water') return '수도';
  if (field === 'fines') return '공과금';
  if (field === 'deposit') return '보증금';
  if (field === 'gloves') return '장갑비';
  return field;
};

const stripSupportOriginalLines = (doc: TeamSettlementDocument): TeamSettlementDocument => {
  return {
    ...doc,
    sales: (doc.sales ?? []).filter((s) => s.origin !== 'support_outgoing'),
    purchases: (doc.purchases ?? []).filter((p) => p.origin !== 'support_incoming')
  };
};

const isEditable = (doc: TeamSettlementDocument | null): boolean => {
  return Boolean(doc && !doc.confirmedAt);
};

const getKindBadgeClassName = (kind: TeamSettlementWorkKind): string => {
  if (kind === '도급') return 'bg-indigo-50 text-indigo-700 border-indigo-200';
  if (kind === '직영') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  return 'bg-amber-50 text-amber-800 border-amber-200';
};

const EmptySettlementTableRow: React.FC<{ colSpan: number; message?: string }> = ({
  colSpan,
  message = '내역이 없습니다.'
}) => (
  <tr>
    <td className="border border-slate-200 bg-slate-50/60 px-3 py-6 text-center text-sm text-slate-500" colSpan={colSpan}>
      {message}
    </td>
  </tr>
);

const SUPPORT_SALES_ORIGINS = ['support_outgoing', 'support_fee_outgoing', '내부지원간곳', '외부지원간곳'];
const SUPPORT_PURCHASE_ORIGINS = ['support_incoming', 'support_fee_incoming', '내부지원온곳', '외부지원온곳'];
const SUPPORT_SETTLEMENT_ORIGINS = ['support_fee_outgoing', 'support_fee_incoming', '내부지원간곳', '외부지원간곳', '내부지원온곳', '외부지원온곳'];
const SUPPORT_RATE_OVERRIDE_STORAGE_PREFIX = 'support-team-payment-rate-overrides-v1';
const MERGED_SUPPORT_AGGREGATE_PREFIX = 'merged::';

const isSupportSalesOrigin = (origin: unknown): boolean => SUPPORT_SALES_ORIGINS.includes(String(origin));
const isSupportPurchaseOrigin = (origin: unknown): boolean => SUPPORT_PURCHASE_ORIGINS.includes(String(origin));
const isSupportOrigin = (origin: unknown): boolean => isSupportSalesOrigin(origin) || isSupportPurchaseOrigin(origin);
const isSupportSettlementOrigin = (origin: unknown): boolean => SUPPORT_SETTLEMENT_ORIGINS.includes(String(origin));

type SupportMonthlyRateOverrides = {
  bulkSupportRate?: number;
  bulkRate?: number;
  supportTeamRates: Record<string, number>;
  supportAggregateRates: Record<string, number>;
  supportSiteRates: Record<string, number>;
  teamRates: Record<string, number>;
  aggregateRates: Record<string, number>;
  siteRates: Record<string, number>;
};

type SupportRateOverrideContext = {
  direction: TeamSettlementSupportDetailRow['direction'];
  viewTeamId?: string;
  viewTeamName?: string;
  settlementTeamId?: string;
  settlementTeamName?: string;
  siteId?: string;
};

const normalizeSupportIdentity = (value: unknown): string =>
  String(value ?? '').replace(/\(.*?\)/g, '').replace(/\s+/g, '').trim();

const getRateOverrideStorageKey = (yearMonth: string): string =>
  `${SUPPORT_RATE_OVERRIDE_STORAGE_PREFIX}:${yearMonth}`;

const toPositiveRate = (value: unknown): number | null => {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number(value.replace(/,/g, ''))
      : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed);
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
    console.warn('[TeamSettlementPage] support rate override load failed:', error);
    return normalizeRateOverrides(undefined);
  }
};

const saveRateOverrides = (yearMonth: string, overrides: SupportMonthlyRateOverrides): void => {
  if (typeof window === 'undefined' || !yearMonth) return;
  try {
    window.localStorage.setItem(getRateOverrideStorageKey(yearMonth), JSON.stringify(normalizeRateOverrides(overrides)));
  } catch (error) {
    console.warn('[TeamSettlementPage] support rate override save failed:', error);
  }
};

const parseMoneyInput = (value: string): number => {
  const parsed = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round(parsed));
};

const getSupportSettlementMergeKey = (
  direction: string,
  settlementTeamId?: string,
  settlementTeamName?: string
): string => [
  direction,
  normalizeSupportIdentity(settlementTeamId) || normalizeSupportIdentity(settlementTeamName) || 'unknown-settlement'
].join('::');

const getSupportAggregateId = (
  direction: string,
  viewTeamId?: string,
  viewTeamName?: string,
  settlementTeamId?: string,
  settlementTeamName?: string
): string => [
  direction,
  normalizeSupportIdentity(viewTeamId) || normalizeSupportIdentity(viewTeamName) || 'unknown-view',
  normalizeSupportIdentity(settlementTeamId) || normalizeSupportIdentity(settlementTeamName) || 'unknown'
].join('::');

const getSupportMonthlySiteRateKey = (aggregateId: string, siteId: string): string =>
  `${aggregateId}::${siteId}`;

const formatSalesOrigin = (origin: TeamSettlementSalesItem['origin']): string => {
  if (origin === 'daily_report') return '출력';
  if (origin === 'support_client_site') return '지원정산';
  if (origin === 'tax_invoice') return '계산서';
  if (origin === '내부지원간곳') return '내부간곳';
  if (origin === '외부지원간곳') return '외부간곳';
  if (origin === 'support_fee_outgoing') return '지원매출';
  return '수기';
};

const formatPurchaseOrigin = (origin: TeamSettlementPurchaseItem['origin']): string => {
  if (origin === 'daily_report') return '출력';
  if (origin === '내부지원온곳') return '내부온곳';
  if (origin === '외부지원온곳') return '외부온곳';
  if (origin === 'support_fee_incoming') return '지원매입';
  return '수기';
};

const formatAdditionOrigin = (origin: TeamSettlementAdditionItem['origin']): string => {
  if (origin === 'team_expense_claim') return '경비';
  if (origin === 'manual') return '수기';
  return '수기';
};

const formatDeductionOrigin = (origin: TeamSettlementDeductionItem['origin']): string => {
  if (origin === 'team_expense_claim') return '경비';
  if (origin === 'office_expense') return '사무실비';
  if (origin === 'daily_wage_payroll' || origin === 'monthly_wage_payroll' || origin === 'service_team_payroll') return '급여';
  if (origin === 'accommodation_billing') return '숙소';
  if (origin === 'vehicle_billing') return '차량';
  if (origin === 'card_billing') return '카드';
  return '수기';
};

type DeductionGroupDefinition = {
  key: string;
  title: string;
  description: string;
  origins: TeamSettlementDeductionItem['origin'][];
  showWhenEmpty?: boolean;
};

type DeductionGroup = DeductionGroupDefinition & {
  items: TeamSettlementDeductionItem[];
  displayItems: DeductionDisplayItem[];
  sourceSummaries: DeductionSourceSummary[];
  totalAmount: number;
};

type DeductionDisplayItem = TeamSettlementDeductionItem & {
  isAggregate?: boolean;
  itemCount?: number;
};

type DeductionSourceSummary = {
  origin: TeamSettlementDeductionItem['origin'];
  label: string;
  amount: number;
  count: number;
};

const PAYROLL_DEDUCTION_ORIGIN_ORDER: Partial<Record<TeamSettlementDeductionItem['origin'], number>> = {
  monthly_wage_payroll: 1,
  daily_wage_payroll: 2,
  service_team_payroll: 3
};

const EXPENSE_DEDUCTION_ORIGIN_ORDER: Partial<Record<TeamSettlementDeductionItem['origin'], number>> = {
  accommodation_billing: 1,
  vehicle_billing: 2,
  card_billing: 3,
  team_expense_claim: 4
};

const EXPENSE_DEDUCTION_ORIGINS: TeamSettlementDeductionItem['origin'][] = [
  'accommodation_billing',
  'vehicle_billing',
  'card_billing',
  'team_expense_claim'
];
const EXPENSE_GROUP_AGGREGATE_PREFIX = 'deduction-aggregate:expense:';
const EXPENSE_GROUP_AGGREGATE_ALL_ID = `${EXPENSE_GROUP_AGGREGATE_PREFIX}all`;

const getDeductionSourceSummaryLabel = (origin: TeamSettlementDeductionItem['origin']): string => {
  if (origin === 'vehicle_billing') return '차량경비';
  if (origin === 'accommodation_billing') return '숙소비';
  if (origin === 'card_billing') return '카드비';
  if (origin === 'team_expense_claim') return '경비';
  if (origin === 'office_expense') return '사무실비';
  if (origin === 'daily_wage_payroll') return '일급제';
  if (origin === 'monthly_wage_payroll') return '월급제';
  if (origin === 'service_team_payroll') return '용역팀';
  return formatDeductionOrigin(origin);
};

const buildDeductionSourceSummaries = (items: TeamSettlementDeductionItem[]): DeductionSourceSummary[] => {
  const byOrigin = new Map<TeamSettlementDeductionItem['origin'], DeductionSourceSummary>();

  items.forEach((item) => {
    const prev = byOrigin.get(item.origin) ?? {
      origin: item.origin,
      label: getDeductionSourceSummaryLabel(item.origin),
      amount: 0,
      count: 0
    };
    byOrigin.set(item.origin, {
      ...prev,
      amount: prev.amount + safeNumber(item.amount),
      count: prev.count + 1
    });
  });

  return Array.from(byOrigin.values())
    .filter((summary) => summary.amount > 0 || summary.count > 0)
    .sort((a, b) => {
      const expenseOrder = (EXPENSE_DEDUCTION_ORIGIN_ORDER[a.origin] ?? 99) - (EXPENSE_DEDUCTION_ORIGIN_ORDER[b.origin] ?? 99);
      if (expenseOrder !== 0) return expenseOrder;
      const payrollOrder = (PAYROLL_DEDUCTION_ORIGIN_ORDER[a.origin] ?? 99) - (PAYROLL_DEDUCTION_ORIGIN_ORDER[b.origin] ?? 99);
      if (payrollOrder !== 0) return payrollOrder;
      return a.label.localeCompare(b.label, 'ko');
    });
};

const buildDeductionDisplayItems = (
  groupKey: string,
  items: TeamSettlementDeductionItem[]
): DeductionDisplayItem[] => {
  if (groupKey !== 'expense') return items;
  if (items.length === 0) return [];

  return EXPENSE_DEDUCTION_ORIGINS.flatMap((origin): DeductionDisplayItem[] => {
    const originItems = items.filter((item) => item.origin === origin);
    if (originItems.length === 0) return [];

    const amount = originItems.reduce((sum, x) => sum + safeNumber(x.amount), 0);
    const originLabel = formatDeductionOrigin(origin);
    return [{
      ...originItems[0],
      id: `${EXPENSE_GROUP_AGGREGATE_PREFIX}${origin}`,
      source: 'auto',
      origin,
      category: `${originLabel} 전체`,
      amount,
      memo: `${originLabel} ${originItems.length}건 합계`,
      isAggregate: true,
      itemCount: originItems.length
    }];
  });
};

const getDeductionDisplayOriginLabel = (item: DeductionDisplayItem): string => {
  if (item.id.startsWith(EXPENSE_GROUP_AGGREGATE_PREFIX)) return formatDeductionOrigin(item.origin);
  return item.isAggregate ? getDeductionSourceSummaryLabel(item.origin) : formatDeductionOrigin(item.origin);
};

const DEDUCTION_GROUP_DEFINITIONS: DeductionGroupDefinition[] = [
  {
    key: 'office_expense',
    title: '사무실비',
    description: '도급·직영 공수 기준 사무실비',
    origins: ['office_expense'],
    showWhenEmpty: true
  },
  {
    key: 'payroll',
    title: '급여',
    description: '월급제·일급제·용역팀 급여 공제',
    origins: ['monthly_wage_payroll', 'daily_wage_payroll', 'service_team_payroll'],
    showWhenEmpty: true
  },
  {
    key: 'expense',
    title: '경비',
    description: '차량·숙소·카드·경비 청구 공제',
    origins: EXPENSE_DEDUCTION_ORIGINS,
    showWhenEmpty: true
  },
  {
    key: 'manual',
    title: '수기 공제',
    description: '직접 입력한 공제',
    origins: ['manual']
  }
];

const KINDS: TeamSettlementWorkKind[] = ['도급', '직영', '지원'];

type SettlementDirection = 'sales' | 'purchase';

type SettlementUnifiedOrigin = TeamSettlementSalesItem['origin'] | TeamSettlementPurchaseItem['origin'];

type SettlementUnifiedLine = {
  id: string;
  direction: SettlementDirection;
  source: 'auto' | 'manual';
  origin: SettlementUnifiedOrigin;
  originLabel: string;
  kind: TeamSettlementWorkKind;
  siteId?: string;
  siteName: string;
  counterTeamId?: string;
  counterTeamName?: string;
  manDay: number;
  quantity?: number;
  amount: number;
  memo?: string;
};

type SiteSkkumiRow = {
  siteName: string;
  quantity: number;
  manDay: number;
  amount: number;
};

type LineDetailRow = {
  id: string;
  date: string;
  siteId?: string;
  siteName: string;
  workerName: string;
  workerTeamName: string;
  manDay: number;
  unitPrice: number;
  amount: number;
  supportDirection?: TeamSettlementSupportDetailRow['direction'];
  counterTeamId?: string;
  counterTeamName?: string;
};

type ExpenseAggregateDetailChildRow = {
  date?: string;
  subject?: string;
  label: string;
  category?: string;
  amount: number;
  note?: string;
  allocation?: string;
};

type ExpenseAggregateDetailRow = {
  key: string;
  origin: TeamSettlementDeductionItem['origin'];
  originLabel: string;
  subject: string;
  category: string;
  amount: number;
  memo?: string;
  details: ExpenseAggregateDetailChildRow[];
};

type SupportRateMissingRow = {
  key: string;
  directionLabel: string;
  siteName: string;
  counterTeamName: string;
  manDay: number;
  currentRate: number;
  reason: string;
};

type SettlementAmountMissingRow = {
  key: string;
  kind: TeamSettlementWorkKind;
  originLabel: string;
  siteName: string;
  manDay: number;
  amount: number;
  reason: string;
};

type DeductionSourceData = {
  accommodationDocs: AccommodationBillingDocument[];
  accommodationAssignments: AccommodationAssignment[];
  utilityRecords: UtilityRecord[];
  vehicleDocs: VehicleBillingDocument[];
  vehicles: Vehicle[];
  vehicleExpenses: VehicleExpenseRecord[];
  cardDocs: CardBillingDocument[];
  cards: Card[];
  cardTransactions: CardTransaction[];
  teamExpenseClaims: TeamExpenseClaim[];
  workers: ManpowerWorker[];
};

const createEmptyDeductionSourceData = (): DeductionSourceData => ({
  accommodationDocs: [],
  accommodationAssignments: [],
  utilityRecords: [],
  vehicleDocs: [],
  vehicles: [],
  vehicleExpenses: [],
  cardDocs: [],
  cards: [],
  cardTransactions: [],
  teamExpenseClaims: [],
  workers: []
});

const buildMonthRange = (yearMonth: string): { startDate: string; endDate: string } => {
  const [y, m] = String(yearMonth).split('-');
  const year = Number(y);
  const month = Number(m);
  const safeYear = Number.isFinite(year) ? year : new Date().getFullYear();
  const safeMonth = Number.isFinite(month) ? month : new Date().getMonth() + 1;

  const start = new Date(safeYear, safeMonth - 1, 1);
  const end = new Date(safeYear, safeMonth, 0);

  const toIsoDate = (d: Date) => {
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  };

  return { startDate: toIsoDate(start), endDate: toIsoDate(end) };
};

export const TeamSettlementPage: React.FC = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [yearMonth, setYearMonth] = useState<string>(buildDefaultYearMonth());
  const [doc, setDoc] = useState<TeamSettlementDocument | null>(null);
  const [savedDocumentFingerprint, setSavedDocumentFingerprint] = useState<string>('');
  const [saveState, setSaveState] = useState<TeamSettlementSaveState>('idle');
  const [loadState, setLoadState] = useState<LoadState>({ status: 'idle' });
  const [detailRows, setDetailRows] = useState<DailyReportWorkerRow[]>([]);
  const [supportDetailRows, setSupportDetailRows] = useState<TeamSettlementSupportDetailRow[]>([]);
  const [laborExchangeSummary, setLaborExchangeSummary] = useState<TeamExchangeSummary | null>(null);
  const [expandedLineIds, setExpandedLineIds] = useState<Set<string>>(() => new Set());
  const [expandedSiteKeys, setExpandedSiteKeys] = useState<Set<string>>(() => new Set());
  const [expandedDeductionIds, setExpandedDeductionIds] = useState<Set<string>>(() => new Set());
  const [expandedExpenseDetailKeys, setExpandedExpenseDetailKeys] = useState<Set<string>>(() => new Set());
  const [deductionSourceData, setDeductionSourceData] = useState<DeductionSourceData>(() => createEmptyDeductionSourceData());
  const [supportRates, setSupportRates] = useState<SupportRate[]>([]);
  const [supportRatesLoaded, setSupportRatesLoaded] = useState<boolean>(false);
  const [bulkSupportRateInput, setBulkSupportRateInput] = useState<string>('');

  const currentDocumentFingerprint = useMemo(
    () => createTeamSettlementDraftFingerprint(doc),
    [doc]
  );
  const isDirty = Boolean(
    doc &&
    savedDocumentFingerprint &&
    currentDocumentFingerprint !== savedDocumentFingerprint
  );
  const confirmationIssues = useMemo(
    () => getTeamSettlementConfirmationIssues(doc),
    [doc]
  );

  useEffect(() => {
    if (!isDirty) return undefined;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    let cancelled = false;
    const loadTeams = async () => {
      try {
        const [teamList, constructionCompanies] = await Promise.all([
          teamService.getTeams(),
          companyService.getCompaniesByType('시공사')
        ]);

        if (cancelled) return;

        const constructionCompanyIdSet = new Set(
          constructionCompanies
            .map((c) => c.id)
            .filter((id): id is string => Boolean(id))
        );
        const constructionCompanyNameSet = new Set(constructionCompanies.map((c) => c.name));

        const constructionCompanyTeams = teamList.filter((team) => {
          if (team.companyId) return constructionCompanyIdSet.has(team.companyId);
          if (team.companyName) return constructionCompanyNameSet.has(team.companyName);
          return false;
        });

        const siteConstructionTeams = constructionCompanyTeams.filter((team) => {
          const raw = String(team.type ?? '').trim();
          return raw === '시공팀' || raw === '시공사팀';
        });

        const rows = siteConstructionTeams.length > 0 ? siteConstructionTeams : constructionCompanyTeams;
        setTeams(rows);
      } catch (error) {
        console.error(error);
        toast.error('팀 목록 로드 실패');
      }
    };
    void loadTeams();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadSupportRates = async () => {
      try {
        const rows = await supportRateService.getAllSiteRates();
        if (!cancelled) setSupportRates(rows);
      } catch (error) {
        console.error(error);
        if (!cancelled) setSupportRates([]);
      } finally {
        if (!cancelled) setSupportRatesLoaded(true);
      }
    };

    void loadSupportRates();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const overrides = loadRateOverrides(yearMonth);
    setBulkSupportRateInput(overrides.bulkSupportRate ? formatCurrency(overrides.bulkSupportRate) : '');
  }, [yearMonth]);

  // Set default selected team when teams are loaded
  useEffect(() => {
    if (teams.length > 0) {
      const currentExists = teams.some((t) => String(t.id ?? '') === String(selectedTeamId));
      if (!currentExists) {
        setSelectedTeamId(String(teams[0].id ?? ''));
      }
    }
  }, [teams, selectedTeamId]);

  useEffect(() => {
    let cancelled = false;
    const loadDetails = async () => {
      if (!doc) {
        setDetailRows([]);
        setSupportDetailRows([]);
        return;
      }
      try {
        const range = buildMonthRange(yearMonth);
        const [rows, supportRows] = await Promise.all([
          dailyReportService.getReportWorkerRowsByRange({
            startDate: range.startDate,
            endDate: range.endDate
          }),
          selectedTeamId
            ? teamSettlementService.getSupportSettlementDetailRows({ yearMonth, teamId: selectedTeamId })
            : Promise.resolve([] as TeamSettlementSupportDetailRow[])
        ]);
        if (cancelled) return;
        setDetailRows(rows);
        setSupportDetailRows(supportRows);
      } catch (error) {
        console.error(error);
        if (cancelled) return;
        setDetailRows([]);
        setSupportDetailRows([]);
      }
    };

    void loadDetails();
    return () => {
      cancelled = true;
    };
  }, [doc, selectedTeamId, yearMonth]);

  useEffect(() => {
    let cancelled = false;

    const parseYearMonth = (value: string): { year: number; month: number } => {
      const [y, m] = String(value).split('-');
      const year = Number(y);
      const month = Number(m);
      return {
        year: Number.isFinite(year) ? year : new Date().getFullYear(),
        month: Number.isFinite(month) ? month : new Date().getMonth() + 1
      };
    };

    const loadLaborExchange = async () => {
      if (!selectedTeamId) {
        setLaborExchangeSummary(null);
        return;
      }

      try {
        const { year, month } = parseYearMonth(yearMonth);
        const snapshotInfo = await laborExchangeService.getMonthSnapshotInfo(year, month);
        const reports = await laborExchangeService.getExchangeReport(year, month, selectedTeamId, {
          preferSnapshot: Boolean(snapshotInfo?.confirmedAt)
        });
        if (cancelled) return;
        setLaborExchangeSummary(reports.length > 0 ? reports[0] : null);
      } catch (error) {
        console.error(error);
        if (cancelled) return;
        setLaborExchangeSummary(null);
      }
    };

    void loadLaborExchange();
    return () => {
      cancelled = true;
    };
  }, [selectedTeamId, yearMonth]);

  useEffect(() => {
    let cancelled = false;

    const loadDeductionSources = async () => {
      if (!selectedTeamId || !yearMonth) {
        setDeductionSourceData(createEmptyDeductionSourceData());
        return;
      }

      try {
        const [
          accommodationDocs,
          accommodationAssignments,
          utilityRecords,
          vehicleDocs,
          vehicles,
          vehicleExpenses,
          cardDocs,
          cards,
          cardTransactions,
          teamExpenseClaims,
          workers
        ] = await Promise.all([
          accommodationBillingService.getBillingDocuments({ teamId: 'all', yearMonth }),
          accommodationAssignmentService.getAllAssignments(),
          accommodationService.getMonthlyLedger(yearMonth),
          vehicleBillingService.getBillingsByMonth(yearMonth),
          vehicleService.getVehicles(),
          vehicleService.getExpensesByMonth(yearMonth),
          cardBillingService.getBillingsByMonth(yearMonth),
          cardService.getCards(),
          cardService.getTransactionsByMonth(yearMonth),
          teamExpenseLedgerService.getClaimsByMonth(yearMonth),
          manpowerService.getWorkers()
        ]);

        if (cancelled) return;
        setDeductionSourceData({
          accommodationDocs,
          accommodationAssignments,
          utilityRecords,
          vehicleDocs,
          vehicles,
          vehicleExpenses,
          cardDocs,
          cards,
          cardTransactions,
          teamExpenseClaims,
          workers
        });
      } catch (error) {
        console.error(error);
        if (cancelled) return;
        setDeductionSourceData(createEmptyDeductionSourceData());
      }
    };

    void loadDeductionSources();
    return () => {
      cancelled = true;
    };
  }, [selectedTeamId, yearMonth]);

  const loadSettlement = useCallback(async () => {
    if (!selectedTeamId || !yearMonth) return;

    setLoadState({ status: 'loading' });
    try {
      const loaded = await teamSettlementService.getTeamSettlement({ yearMonth, teamId: selectedTeamId });
      const nextDoc = stripSupportOriginalLines(loaded);
      setDoc(nextDoc);
      setSavedDocumentFingerprint(createTeamSettlementDraftFingerprint(nextDoc));
      setSaveState('idle');
      setLoadState({ status: 'idle' });
    } catch (error) {
      console.error(error);
      setLoadState({ status: 'error', message: '팀정산 데이터를 불러오지 못했습니다.' });
    }
  }, [selectedTeamId, yearMonth]);

  useEffect(() => {
    void loadSettlement();
  }, [loadSettlement]);

  const selectedTeamName = useMemo(() => {
    const t = teams.find((x) => String(x.id ?? '') === String(selectedTeamId));
    return t?.name ?? '';
  }, [selectedTeamId, teams]);

  const teamIdVariants = useMemo(() => {
    const variants = new Set<string>();
    if (selectedTeamId) variants.add(String(selectedTeamId));
    const matched = teams.find((x) => String(x.id ?? '') === String(selectedTeamId));
    if (matched?.id) variants.add(String(matched.id));
    if (matched?.legacyId) variants.add(String(matched.legacyId));
    return variants;
  }, [selectedTeamId, teams]);

  const matchesTeam = useCallback(
    (value: unknown): boolean => {
      if (typeof value !== 'string') return false;
      const trimmed = value.trim();
      if (!trimmed) return false;
      return teamIdVariants.has(trimmed);
    },
    [teamIdVariants]
  );

  const teamNameVariants = useMemo(() => {
    const variants = new Set<string>();
    const matched = teams.find((x) => String(x.id ?? '') === String(selectedTeamId));
    if (matched?.name) variants.add(String(matched.name).trim());
    if (selectedTeamName) variants.add(String(selectedTeamName).trim());
    return variants;
  }, [selectedTeamId, selectedTeamName, teams]);

  const matchesTeamByIdOrName = useCallback(
    (id: unknown, name: unknown): boolean => {
      const idText = typeof id === 'string' ? id.trim() : '';
      if (idText && matchesTeam(idText)) return true;

      const nameText = typeof name === 'string' ? name.trim() : '';
      if (nameText && teamNameVariants.has(nameText)) return true;

      return false;
    },
    [matchesTeam, teamNameVariants]
  );

  const transactionSectionTotals = useMemo(() => {
    const summarize = (lines: Array<{ amount: number; manDay: number }>) => lines.reduce(
      (sum, line) => ({
        amount: sum.amount + safeNumber(line.amount),
        manDay: sum.manDay + safeNumber(line.manDay)
      }),
      { amount: 0, manDay: 0 }
    );

    const sales = doc?.sales ?? [];
    const purchases = doc?.purchases ?? [];

    const salesSupport = summarize(sales.filter((line) => line.kind === '지원'));
    const salesContract = summarize(sales.filter((line) => line.kind === '도급'));
    const salesDirect = summarize(sales.filter((line) => line.kind === '직영'));
    const purchaseSupport = summarize(purchases.filter((line) => line.kind === '지원'));

    return {
      salesSupport,
      salesContract,
      salesDirect,
      purchaseSupport,
      salesTotal: summarize(sales),
      purchasesTotal: summarize(purchases)
    };
  }, [doc]);

  const totals = useMemo(() => {
    const salesTotal = transactionSectionTotals.salesTotal.amount;
    const purchasesTotal = transactionSectionTotals.purchasesTotal.amount;
    const deductionsTotal = (doc?.deductions ?? []).reduce((sum, x) => sum + safeNumber(x.amount), 0);
    const additionsTotal = (doc?.additions ?? []).reduce((sum, x) => sum + safeNumber(x.amount), 0);
    const prevCarryover = safeNumber(doc?.summary?.prevCarryover ?? 0);
    const deposit = safeNumber(doc?.summary?.deposit ?? 0);

    const net = salesTotal - purchasesTotal - deductionsTotal + additionsTotal + prevCarryover + deposit;

    return { salesTotal, purchasesTotal, deductionsTotal, additionsTotal, prevCarryover, deposit, net };
  }, [doc, transactionSectionTotals]);

  const siteSkkumiRows = useMemo<SiteSkkumiRow[]>(() => {
    if (!doc) return [];

    const bySite = new Map<string, SiteSkkumiRow>();
    doc.sales
      .filter((s) => s.source === 'auto' && (s.origin === 'daily_report' || s.origin === 'support_client_site') && (s.kind === '도급' || s.kind === '직영'))
      .forEach((s) => {
        const siteName = String(s.siteName ?? '').trim() || '현장 미지정';
        const prev = bySite.get(siteName) ?? { siteName, quantity: 0, manDay: 0, amount: 0 };
        const nextQuantity = s.kind === '도급' ? safeNumber(s.quantity ?? 0) : 0;
        bySite.set(siteName, {
          siteName,
          quantity: prev.quantity + nextQuantity,
          manDay: prev.manDay + safeNumber(s.manDay),
          amount: prev.amount + safeNumber(s.amount)
        });
      });

    return Array.from(bySite.values()).sort((a, b) => b.amount - a.amount);
  }, [doc]);

  const avgUnitPrice = useMemo(() => {
    const payrollAmountTotal = (doc?.deductions ?? [])
      .filter((d) => (
        d.origin === 'daily_wage_payroll' ||
        d.origin === 'monthly_wage_payroll' ||
        d.origin === 'service_team_payroll'
      ))
      .reduce((sum, d) => sum + safeNumber(d.amount), 0);

    const getWorkerTeamId = (r: DailyReportWorkerRow): string => {
      const v = r.workerTeamId ?? r.teamId ?? '';
      return String(v ?? '').trim();
    };

    const getResponsibleTeamId = (r: DailyReportWorkerRow): string => {
      const v = r.responsibleTeamId ?? r.teamId ?? '';
      return String(v ?? '').trim();
    };

    const isDirectWorkKind = (r: DailyReportWorkerRow): boolean => {
      const raw = String(r.siteType ?? '').trim();
      const kind = raw === '도급' || raw === '직영' || raw === '지원' ? raw : '직영';
      return kind === '도급' || kind === '직영';
    };

    const normalizeSalaryModel = (r: DailyReportWorkerRow): string => {
      const raw = typeof r.salaryModel === 'string' ? r.salaryModel : (typeof r.payType === 'string' ? r.payType : '');
      const trimmed = String(raw ?? '').trim();
      if (!trimmed) return '일급제';
      if (trimmed.includes('용역')) return '용역팀';
      if (trimmed.includes('월급')) return '월급제';
      if (trimmed.includes('일급') || trimmed.includes('일당')) return '일급제';
      return trimmed;
    };

    const payrollManDayTotal = detailRows
      .filter((r) => {
        const model = normalizeSalaryModel(r);
        if (model === '용역팀') {
          const responsibleTeamId = getResponsibleTeamId(r);
          return Boolean(responsibleTeamId && matchesTeam(responsibleTeamId) && isDirectWorkKind(r));
        }
        const workerTeamId = getWorkerTeamId(r);
        return Boolean(workerTeamId && matchesTeam(workerTeamId) && (model === '일급제' || model === '월급제'));
      })
      .reduce((sum, r) => sum + safeNumber(r.manDay), 0);

    const siteTotalAmount = siteSkkumiRows.reduce((sum, r) => sum + safeNumber(r.amount), 0);
    const siteTotalManDay = siteSkkumiRows.reduce((sum, r) => sum + safeNumber(r.manDay), 0);

    const teamAvgPerManDay = safeAverage(payrollAmountTotal, payrollManDayTotal);
    const siteAvgPerManDay = safeAverage(siteTotalAmount, siteTotalManDay);

    return { teamAvgPerManDay, siteAvgPerManDay };
  }, [detailRows, doc, matchesTeam, siteSkkumiRows]);

  const supportRateMissingRows = useMemo<SupportRateMissingRow[]>(() => {
    if (!supportRatesLoaded) return [];
    if (!laborExchangeSummary) return [];

    const rateBySiteId = new Map<string, number>();
    const rateBySiteName = new Map<string, number>();
    supportRates.forEach((rate) => {
      const parsedRate = safeNumber(rate.defaultRate);
      const siteId = String(rate.siteId ?? rate.id ?? '').trim();
      const siteName = String(rate.siteName ?? '').trim();
      if (siteId) rateBySiteId.set(siteId, parsedRate);
      if (siteName) rateBySiteName.set(normalizeRateLookupKey(siteName), parsedRate);
    });

    type MissingAgg = SupportRateMissingRow & { rateAmount: number };
    const grouped = new Map<string, MissingAgg>();

    const getConfiguredRate = (item: LaborExchangeItem): number => {
      const siteId = String(item.siteId ?? '').trim();
      if (siteId && rateBySiteId.has(siteId)) return safeNumber(rateBySiteId.get(siteId));
      const siteNameKey = normalizeRateLookupKey(item.siteName);
      if (siteNameKey && rateBySiteName.has(siteNameKey)) return safeNumber(rateBySiteName.get(siteNameKey));
      return 0;
    };

    const matchesSite = (lineSiteId: unknown, lineSiteName: unknown, item: LaborExchangeItem): boolean => {
      const lineId = String(lineSiteId ?? '').trim();
      const itemId = String(item.siteId ?? '').trim();
      if (lineId && itemId && lineId === itemId) return true;
      const lineName = normalizeRateLookupKey(lineSiteName);
      const itemName = normalizeRateLookupKey(item.siteName);
      return Boolean(lineName && itemName && lineName === itemName);
    };

    const matchesCounterTeam = (lineTeamId: unknown, lineTeamName: unknown, itemTeamId: unknown, itemTeamName: unknown): boolean => {
      const lineId = String(lineTeamId ?? '').trim();
      const itemId = String(itemTeamId ?? '').trim();
      if (lineId && itemId && lineId === itemId) return true;
      const lineName = normalizeRateLookupKey(lineTeamName);
      const itemName = normalizeRateLookupKey(itemTeamName);
      return Boolean(lineName && itemName && lineName === itemName);
    };

    const getAppliedSupportRate = (item: LaborExchangeItem, direction: 'outgoing' | 'incoming'): number => {
      const supportLines = direction === 'outgoing'
        ? (doc?.sales ?? []).filter((line) => line.source === 'auto' && isSupportSettlementOrigin(line.origin))
        : (doc?.purchases ?? []).filter((line) => line.source === 'auto' && isSupportSettlementOrigin(line.origin));
      const matched = supportLines.find((line) => {
        if (!matchesSite(line.siteId, line.siteName, item)) return false;
        return direction === 'outgoing'
          ? matchesCounterTeam(line.counterTeamId, line.counterTeamName, item.reportTeamId, item.reportTeamName)
          : matchesCounterTeam(line.counterTeamId, line.counterTeamName, item.workerTeamId, item.workerTeamName);
      });
      return matched ? (safeAverage(safeNumber(matched.amount), safeNumber(matched.manDay)) ?? 0) : 0;
    };

    const addMissing = (params: {
      item: LaborExchangeItem;
      directionLabel: string;
      counterTeamName: string;
      reason: string;
    }) => {
      const siteName = String(params.item.siteName ?? '').trim() || '현장 미지정';
      const counterTeamName = String(params.counterTeamName ?? '').trim() || '-';
      const key = `${params.directionLabel}__${siteName}__${counterTeamName}__${params.reason}`;
      const currentRate = safeNumber(params.item.supportRate);
      const manDay = safeNumber(params.item.manDay);
      const prev = grouped.get(key) ?? {
        key,
        directionLabel: params.directionLabel,
        siteName,
        counterTeamName,
        manDay: 0,
        currentRate: 0,
        reason: params.reason,
        rateAmount: 0
      };
      grouped.set(key, {
        ...prev,
        manDay: prev.manDay + manDay,
        rateAmount: prev.rateAmount + currentRate * manDay,
        currentRate: safeAverage(prev.rateAmount + currentRate * manDay, prev.manDay + manDay) ?? currentRate
      });
    };

    (laborExchangeSummary.outgoing.items ?? []).forEach((item) => {
      const configuredRate = getConfiguredRate(item);
      const appliedRate = getAppliedSupportRate(item, 'outgoing');
      const currentRate = appliedRate > 0 ? appliedRate : safeNumber(item.supportRate);
      if ((configuredRate > 0 || appliedRate > 0) && currentRate > 0) return;

      addMissing({
        item,
        directionLabel: '지원 매출',
        counterTeamName: item.reportTeamName || item.reportTeamId,
        reason: configuredRate <= 0 && appliedRate <= 0 ? '현장 지원단가 미등록' : '지원단가 0원'
      });
    });

    (laborExchangeSummary.incoming.items ?? []).forEach((item) => {
      const configuredRate = getConfiguredRate(item);
      const appliedRate = getAppliedSupportRate(item, 'incoming');
      const currentRate = appliedRate > 0 ? appliedRate : safeNumber(item.supportRate);
      if ((configuredRate > 0 || appliedRate > 0) && currentRate > 0) return;

      addMissing({
        item,
        directionLabel: '지원 매입',
        counterTeamName: item.workerTeamName || item.workerTeamId,
        reason: configuredRate <= 0 && appliedRate <= 0 ? '현장 지원단가 미등록' : '지원단가 0원'
      });
    });

    return Array.from(grouped.values())
      .map(({ rateAmount, ...row }) => row)
      .sort((a, b) => {
        const directionSort = a.directionLabel.localeCompare(b.directionLabel, 'ko');
        if (directionSort !== 0) return directionSort;
        const siteSort = a.siteName.localeCompare(b.siteName, 'ko');
        if (siteSort !== 0) return siteSort;
        return a.counterTeamName.localeCompare(b.counterTeamName, 'ko');
      });
  }, [doc, laborExchangeSummary, supportRates, supportRatesLoaded]);

  const deductionGroups = useMemo<DeductionGroup[]>(() => {
    const deductionItems = doc?.deductions ?? [];
    const assignedIds = new Set<string>();
    const groups = DEDUCTION_GROUP_DEFINITIONS.map((definition): DeductionGroup => {
      const items = deductionItems
        .filter((item) => definition.origins.includes(item.origin))
        .sort((a, b) => {
          if (definition.key === 'payroll') {
            return (PAYROLL_DEDUCTION_ORIGIN_ORDER[a.origin] ?? 99) - (PAYROLL_DEDUCTION_ORIGIN_ORDER[b.origin] ?? 99);
          }
          if (definition.key === 'expense') {
            return (EXPENSE_DEDUCTION_ORIGIN_ORDER[a.origin] ?? 99) - (EXPENSE_DEDUCTION_ORIGIN_ORDER[b.origin] ?? 99);
          }
          return 0;
        });
      items.forEach((item) => assignedIds.add(item.id));
      return {
        ...definition,
        items,
        displayItems: buildDeductionDisplayItems(definition.key, items),
        sourceSummaries: buildDeductionSourceSummaries(items),
        totalAmount: items.reduce((sum, item) => sum + safeNumber(item.amount), 0)
      };
    });

    const otherItems = deductionItems.filter((item) => !assignedIds.has(item.id));
    if (otherItems.length > 0) {
      groups.push({
        key: 'other',
        title: '기타 공제',
        description: '분류되지 않은 공제',
        origins: [],
        items: otherItems,
        displayItems: buildDeductionDisplayItems('other', otherItems),
        sourceSummaries: buildDeductionSourceSummaries(otherItems),
        totalAmount: otherItems.reduce((sum, item) => sum + safeNumber(item.amount), 0)
      });
    }

    return groups.filter((group) => group.showWhenEmpty || group.items.length > 0);
  }, [doc]);

  const updateDoc = useCallback((updater: (prev: TeamSettlementDocument) => TeamSettlementDocument) => {
    setDoc((prev) => {
      if (!prev) return prev;
      return updater(prev);
    });
  }, []);

  const handleAddManualSale = useCallback((kind: TeamSettlementWorkKind = '직영') => {
    updateDoc((prev) => {
      const item: TeamSettlementSalesItem = {
        id: buildLocalId('sale_manual'),
        source: 'manual',
        origin: 'manual',
        kind,
        siteName: '수기',
        manDay: 0,
        amount: 0
      };
      return { ...prev, sales: [...prev.sales, item] };
    });
  }, [updateDoc]);

  const handleAddManualPurchase = useCallback(() => {
    updateDoc((prev) => {
      const item: TeamSettlementPurchaseItem = {
        id: buildLocalId('purchase_manual'),
        source: 'manual',
        origin: 'manual',
        kind: '지원',
        siteName: '수기',
        manDay: 0,
        amount: 0
      };
      return { ...prev, purchases: [...prev.purchases, item] };
    });
  }, [updateDoc]);

  const handleAddManualDeduction = useCallback(() => {
    updateDoc((prev) => {
      const item: TeamSettlementDeductionItem = {
        id: buildLocalId('deduction_manual'),
        source: 'manual',
        origin: 'manual',
        category: '수기',
        amount: 0
      };
      return { ...prev, deductions: [...prev.deductions, item] };
    });
  }, [updateDoc]);

  const handleAddManualAddition = useCallback(() => {
    updateDoc((prev) => {
      const item: TeamSettlementAdditionItem = {
        id: buildLocalId('addition_manual'),
        source: 'manual',
        origin: 'manual',
        category: '수기',
        amount: 0
      };
      const additions = prev.additions ?? [];
      return { ...prev, additions: [...additions, item] };
    });
  }, [updateDoc]);

  const persistCurrentDocument = useCallback(async (showSuccessToast = true): Promise<TeamSettlementDocument | null> => {
    if (!doc) return null;

    const nextDoc: TeamSettlementDocument = {
      ...doc,
      teamName: doc.teamName || selectedTeamName,
      updatedAt: new Date().toISOString()
    };

    setSaveState('saving');
    try {
      await teamSettlementService.saveTeamSettlement(nextDoc);
      setDoc(nextDoc);
      setSavedDocumentFingerprint(createTeamSettlementDraftFingerprint(nextDoc));
      setSaveState('idle');
      if (showSuccessToast) toast.success('변경사항을 저장했습니다.');
      return nextDoc;
    } catch (error) {
      console.error(error);
      setSaveState('error');
      toast.error('저장하지 못했습니다. 네트워크 상태를 확인해 주세요.');
      return null;
    }
  }, [doc, selectedTeamName]);

  const confirmBeforeDiscard = useCallback(async (nextAction: string): Promise<boolean> => {
    if (!isDirty) return true;

    const result = await Swal.fire({
      title: '저장하지 않은 변경사항',
      text: `${nextAction} 전에 변경사항을 저장할까요?`,
      icon: 'warning',
      showCancelButton: true,
      showDenyButton: true,
      confirmButtonText: '저장 후 계속',
      denyButtonText: '저장 안 함',
      cancelButtonText: '취소'
    });

    if (result.isConfirmed) {
      return Boolean(await persistCurrentDocument(false));
    }
    return result.isDenied;
  }, [isDirty, persistCurrentDocument]);

  const handleSave = useCallback(async () => {
    await persistCurrentDocument(true);
  }, [persistCurrentDocument]);

  const handleRefresh = useCallback(async () => {
    if (!(await confirmBeforeDiscard('새로고침'))) return;
    await loadSettlement();
  }, [confirmBeforeDiscard, loadSettlement]);

  const handleRecalculate = useCallback(async () => {
    if (!selectedTeamId || !yearMonth) return;
    if (!(await confirmBeforeDiscard('재집계'))) return;

    const isConfirmed = Boolean(doc?.confirmedAt);

    if (isConfirmed) {
      const result = await Swal.fire({
        title: '강제 재집계',
        text: '확정된 팀정산입니다. 최신 자동집계(지원비 포함)로 다시 계산하여 저장할까요?',
        icon: 'warning',
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText: '확정 유지하고 재집계',
        denyButtonText: '확정 해제하고 재집계',
        cancelButtonText: '취소'
      });

      if (result.isConfirmed) {
        await teamSettlementService.recalculateAndSaveTeamSettlement({ yearMonth, teamId: selectedTeamId, keepConfirmed: true });
        toast.success('재집계 완료 (확정 유지)');
        await loadSettlement();
        return;
      }

      if (result.isDenied) {
        await teamSettlementService.recalculateAndSaveTeamSettlement({ yearMonth, teamId: selectedTeamId, keepConfirmed: false });
        toast.success('재집계 완료 (확정 해제)');
        await loadSettlement();
        return;
      }

      return;
    }

    try {
      await teamSettlementService.recalculateAndSaveTeamSettlement({ yearMonth, teamId: selectedTeamId, keepConfirmed: false });
      toast.success('재집계 완료');
      await loadSettlement();
    } catch (error) {
      console.error(error);
      toast.error('재집계 실패');
    }
  }, [confirmBeforeDiscard, doc?.confirmedAt, loadSettlement, selectedTeamId, yearMonth]);

  const handleConfirm = useCallback(async () => {
    if (!doc) return;

    if (confirmationIssues.length > 0) {
      await Swal.fire({
        title: '확정 전 검토가 필요합니다',
        text: `${confirmationIssues
          .slice(0, 6)
          .map((issue) => `• ${issue.message}`)
          .join('\n')}${confirmationIssues.length > 6 ? `\n외 ${confirmationIssues.length - 6}건` : ''}`,
        icon: 'error',
        confirmButtonText: '확인'
      });
      return;
    }

    const result = await Swal.fire({
      title: '팀정산 확정',
      text: isDirty
        ? '저장하지 않은 변경사항을 함께 저장한 뒤 확정합니다. 계속하시겠습니까?'
        : '확정 후에는 자동집계와 수기 수정이 잠깁니다. 계속하시겠습니까?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '저장 후 확정',
      cancelButtonText: '취소'
    });

    if (!result.isConfirmed) return;

    setSaveState('saving');
    try {
      const confirmedDoc = await teamSettlementService.saveAndConfirmTeamSettlement({
        ...doc,
        teamName: doc.teamName || selectedTeamName
      });
      setDoc(confirmedDoc);
      setSavedDocumentFingerprint(createTeamSettlementDraftFingerprint(confirmedDoc));
      setSaveState('idle');

      try {
        await officeService.syncTeamFeeFromSettlement(confirmedDoc);
      } catch (syncError) {
        console.error(syncError);
        toast.error('정산은 확정됐지만 사무실비 동기화에 실패했습니다. 다시 확인해 주세요.');
        await loadSettlement();
        return;
      }

      toast.success('확정 완료');
      await loadSettlement();
    } catch (error) {
      console.error(error);
      setSaveState('error');
      toast.error('확정 실패');
    }
  }, [confirmationIssues, doc, isDirty, loadSettlement, selectedTeamName]);

  const handleUnconfirm = useCallback(async () => {
    if (!doc) return;

    const result = await Swal.fire({
      title: '확정 취소',
      text: '확정된 팀정산을 취소하시겠습니까? 취소 후에는 다시 편집할 수 있습니다.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '확정 취소',
      cancelButtonText: '닫기'
    });

    if (!result.isConfirmed) return;

    try {
      await teamSettlementService.unconfirmTeamSettlement({ yearMonth: doc.yearMonth, teamId: doc.teamId });

      // Remove Office Fee from Office Management
      await officeService.deleteTeamFeeTransaction(doc.teamId, doc.yearMonth);

      toast.success('확정 취소 완료');
      await loadSettlement();
    } catch (error) {
      console.error(error);
      toast.error('확정 취소 실패');
    }
  }, [doc, loadSettlement]);

  const canEdit = isEditable(doc);

  const primaryButtonClassName =
    'inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed';
  const secondaryButtonClassName =
    'inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-semibold border bg-white text-slate-700 hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed';
  const ghostButtonClassName =
    'inline-flex items-center justify-center px-3 py-2 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-100 transition disabled:opacity-50 disabled:cursor-not-allowed';
  const addButtonClassName =
    'inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold border bg-slate-900 text-white hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed';
  const selectedYearMonth = useMemo(() => parseYearMonthValue(yearMonth), [yearMonth]);

  const handleSettlementYearChange = useCallback((delta: number) => {
    void (async () => {
      if (!(await confirmBeforeDiscard('정산 연도 이동'))) return;
      setYearMonth((prev) => {
        const current = parseYearMonthValue(prev);
        return buildYearMonthValue(current.year + delta, current.month);
      });
    })();
  }, [confirmBeforeDiscard]);

  const handleSettlementMonthSelect = useCallback((month: number) => {
    void (async () => {
      const current = parseYearMonthValue(yearMonth);
      if (current.month === month) return;
      if (!(await confirmBeforeDiscard('정산월 이동'))) return;
      setYearMonth(buildYearMonthValue(current.year, month));
    })();
  }, [confirmBeforeDiscard, yearMonth]);

  const handleTeamSelect = useCallback((teamId: string) => {
    void (async () => {
      if (String(selectedTeamId) === String(teamId)) return;
      if (!(await confirmBeforeDiscard('팀 변경'))) return;
      setSelectedTeamId(teamId);
    })();
  }, [confirmBeforeDiscard, selectedTeamId]);

  const toggleLineExpanded = useCallback((id: string) => {
    setExpandedLineIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSiteExpanded = useCallback((key: string) => {
    setExpandedSiteKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleDeductionExpanded = useCallback((id: string) => {
    setExpandedDeductionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleExpenseDetailExpanded = useCallback((key: string) => {
    setExpandedExpenseDetailKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const getSupportDirectionsForLine = useCallback((line: SettlementUnifiedLine): TeamSettlementSupportDetailRow['direction'][] => {
    if (line.origin === '내부지원간곳' || line.origin === '외부지원간곳' || line.origin === '내부지원온곳' || line.origin === '외부지원온곳') {
      return [line.origin];
    }
    if (isSupportSalesOrigin(line.origin)) return ['내부지원간곳', '외부지원간곳'];
    if (isSupportPurchaseOrigin(line.origin)) return ['내부지원온곳', '외부지원온곳'];
    return [];
  }, []);

  const getSupportDetailRowsForLine = useCallback((line: SettlementUnifiedLine): TeamSettlementSupportDetailRow[] => {
    if (line.source !== 'auto' || !isSupportOrigin(line.origin)) return [];

    const lineCounterId = String(line.counterTeamId ?? '').trim();
    const lineCounterName = String(line.counterTeamName ?? '').trim();
    const lineSiteId = String(line.siteId ?? '').trim();
    const lineSiteName = String(line.siteName ?? '').trim();
    const supportDirections = getSupportDirectionsForLine(line);

    const matchesSiteByIdOrName = (row: TeamSettlementSupportDetailRow): boolean => {
      if (!lineSiteId && !lineSiteName) return true;
      const rowSiteId = String(row.siteId ?? '').trim();
      if (lineSiteId && rowSiteId && lineSiteId === rowSiteId) return true;
      const rowSiteName = String(row.siteName ?? '').trim();
      return Boolean(lineSiteName && rowSiteName && normalizeRateLookupKey(lineSiteName) === normalizeRateLookupKey(rowSiteName));
    };

    const matchesCounterByIdOrName = (row: TeamSettlementSupportDetailRow): boolean => {
      if (!lineCounterId && !lineCounterName) return true;
      const rowCounterId = String(row.counterTeamId ?? '').trim();
      if (lineCounterId && rowCounterId && lineCounterId === rowCounterId) return true;
      const rowCounterName = String(row.counterTeamName ?? '').trim();
      return Boolean(lineCounterName && rowCounterName && normalizeRateLookupKey(lineCounterName) === normalizeRateLookupKey(rowCounterName));
    };

    return supportDetailRows.filter((row) => {
      if (!supportDirections.includes(row.direction)) return false;
      return matchesSiteByIdOrName(row) && matchesCounterByIdOrName(row);
    });
  }, [getSupportDirectionsForLine, supportDetailRows]);

  const unifiedLines = useMemo<SettlementUnifiedLine[]>(() => {
    if (!doc) return [];

    const shouldHideSupportOriginal = (origin: SettlementUnifiedOrigin): boolean => {
      return origin === 'support_outgoing' || origin === 'support_incoming';
    };

    const sales: SettlementUnifiedLine[] = doc.sales
      .filter((s) => !shouldHideSupportOriginal(s.origin))
      .map((s) => ({
        id: s.id,
        direction: 'sales',
        source: s.source,
        origin: s.origin,
        originLabel: formatSalesOrigin(s.origin),
        kind: s.kind,
        siteId: s.siteId,
        siteName: s.siteName,
        counterTeamId: s.counterTeamId,
        counterTeamName: s.counterTeamName,
        manDay: safeNumber(s.manDay),
        quantity: typeof s.quantity === 'number' ? s.quantity : undefined,
        amount: safeNumber(s.amount),
        memo: s.memo
      }));

    const purchases: SettlementUnifiedLine[] = doc.purchases
      .filter((p) => !shouldHideSupportOriginal(p.origin))
      .map((p) => ({
        id: p.id,
        direction: 'purchase',
        source: p.source,
        origin: p.origin,
        originLabel: formatPurchaseOrigin(p.origin),
        kind: p.kind,
        siteId: p.siteId,
        siteName: p.siteName,
        counterTeamId: p.counterTeamId,
        counterTeamName: p.counterTeamName,
        manDay: safeNumber(p.manDay),
        amount: safeNumber(p.amount),
        memo: p.memo
      }));

    const lines = [...sales, ...purchases];
    lines.sort((a, b) => {
      const s = a.siteName.localeCompare(b.siteName, 'ko');
      if (s !== 0) return s;
      if (a.direction !== b.direction) return a.direction === 'sales' ? -1 : 1;
      return a.kind.localeCompare(b.kind, 'ko');
    });
    return lines;
  }, [doc]);

  const getDeductionDetail = useCallback(
    (item: TeamSettlementDeductionItem):
      | { kind: 'office_expense'; sites: SiteSkkumiRow[]; totalManDay: number; totalAmount: number }
      | { kind: 'payroll'; rows: Array<{ workerId: string; workerName: string; manDay: number; amount: number }>; totalManDay: number; totalAmount: number }
      | {
        kind: 'accommodation_billing';
        mode: 'document' | 'ledger';
        rows: Array<{
          subject: string;
          label: string;
          amount: number;
          teamDays?: number;
          totalDays?: number;
        }>;
        totalAmount: number;
      }
      | {
        kind: 'vehicle_billing';
        mode: 'document' | 'ledger';
        rows: Array<{ subject: string; label: string; amount: number; date?: string; note?: string }>;
        totalAmount: number;
      }
      | {
        kind: 'card_billing';
        mode: 'document' | 'ledger';
        rows: Array<{ subject: string; label: string; amount: number; date?: string; note?: string }>;
        totalAmount: number;
      }
      | {
        kind: 'team_expense_claim';
        rows: Array<{ date: string; subject: string; label: string; amount: number; note?: string }>;
        totalAmount: number;
      }
      | {
        kind: 'expense_aggregate';
        rows: ExpenseAggregateDetailRow[];
        totalAmount: number;
      }
      | null => {
      if (!doc) return null;

      const deductionCategory = String(item.category ?? '').trim();
      const itemIdText = String(item.id ?? '');
      const isAggregateDetailItem = itemIdText.startsWith('deduction-aggregate:');
      const isExpenseAggregateItem = itemIdText === EXPENSE_GROUP_AGGREGATE_ALL_ID;
      const isExpenseOriginAggregateItem = itemIdText.startsWith(EXPENSE_GROUP_AGGREGATE_PREFIX) && !isExpenseAggregateItem;
      const extractBracketValue = (value: string, prefix: string): string => {
        const regex = new RegExp(`^${prefix}\\s*\\((.+)\\)$`);
        const matched = regex.exec(String(value ?? '').trim());
        return matched ? matched[1].trim() : '';
      };
      const extractParenthesizedText = (value: string): string => {
        const matched = /\((.+)\)/.exec(String(value ?? '').trim());
        return matched ? matched[1].trim() : '';
      };
      const splitMemoParts = (memo?: string): string[] =>
        String(memo ?? '')
          .split('/')
          .map((part) => part.trim())
          .filter(Boolean);

      if (isExpenseAggregateItem || isExpenseOriginAggregateItem) {
        type ChildWithSubject = ExpenseAggregateDetailChildRow & { subject: string };

        const buildWorkerTeamMaps = () => {
          const workerTeamByAnyId = new Map<string, { teamId?: string; teamName?: string }>();
          const workerTeamByName = new Map<string, { teamId?: string; teamName?: string }>();
          deductionSourceData.workers.forEach((w) => {
            const info = { teamId: w.teamId, teamName: w.teamName };
            const id = String(w.id ?? '').trim();
            const legacyId = String(w.legacyId ?? '').trim();
            const name = String(w.name ?? '').trim();
            if (id) workerTeamByAnyId.set(id, info);
            if (legacyId) workerTeamByAnyId.set(legacyId, info);
            if (name) workerTeamByName.set(name, info);
          });
          return { workerTeamByAnyId, workerTeamByName };
        };

        const buildGenericExpenseRow = (
          deduction: TeamSettlementDeductionItem,
          originLabel = getDeductionSourceSummaryLabel(deduction.origin),
          subject = extractParenthesizedText(String(deduction.category ?? '')) || '-',
          category = String(deduction.category ?? '').trim() || getDeductionSourceSummaryLabel(deduction.origin)
        ): ExpenseAggregateDetailRow => {
          const memoParts = splitMemoParts(deduction.memo);
          const date = memoParts.find((part) => /^\d{4}-\d{2}-\d{2}/.test(part));
          const memo = memoParts.filter((part) => part !== date).join(' / ');
          return {
            key: `expense-detail:${deduction.origin}:${String(deduction.id ?? '')}:${subject}:${category}`,
            origin: deduction.origin,
            originLabel,
            subject,
            category,
            amount: safeNumber(deduction.amount),
            memo: memo || undefined,
            details: []
          };
        };

        const groupChildrenBySubject = (
          deduction: TeamSettlementDeductionItem,
          originLabel: string,
          category: string,
          fallbackSubject: string,
          children: ChildWithSubject[]
        ): ExpenseAggregateDetailRow[] => {
          const bySubject = new Map<string, ChildWithSubject[]>();
          children
            .filter((child) => safeNumber(child.amount) > 0)
            .forEach((child) => {
              const subject = String(child.subject ?? '').trim() || fallbackSubject || '-';
              const list = bySubject.get(subject) ?? [];
              list.push({ ...child, subject });
              bySubject.set(subject, list);
            });

          return Array.from(bySubject.entries()).map(([subject, detailRows]) => ({
            key: `expense-detail:${deduction.origin}:${String(deduction.id ?? '')}:${subject}:${category}`,
            origin: deduction.origin,
            originLabel,
            subject,
            category,
            amount: detailRows.reduce((sum, row) => sum + safeNumber(row.amount), 0),
            memo: deduction.memo,
            details: detailRows.map(({ subject: _subject, ...detail }) => detail)
          }));
        };

        const buildVehicleExpenseRows = (deduction: TeamSettlementDeductionItem): ExpenseAggregateDetailRow[] => {
          const category = String(deduction.category ?? '').trim();
          const deductionIdText = String(deduction.id ?? '');
          const targetPlate = extractBracketValue(category, '차량비') || extractParenthesizedText(category);
          const originLabel = '차량';
          const summaryCategory = '차량별 경비';

          const selectedDocs = selectPreferredTeamBillings(
            deductionSourceData.vehicleDocs.filter((row) =>
              isTeamBillingTarget({
                issuedToType: row.issuedToType,
                teamId: row.teamId ?? row.assignedTeamId,
                teamName: row.teamName ?? row.assignedTeamName,
                issuedToWorkerId: row.issuedToWorkerId,
                issuedToWorkerName: row.issuedToWorkerName
              }) &&
              matchesTeamByIdOrName(row.teamId ?? row.assignedTeamId, row.teamName ?? row.assignedTeamName)
            ),
            (doc) => hasBillingLineSource(doc, 'vehicle_ledger')
          );
          const isLedgerVehicleItem = deductionIdText.endsWith(':ledger');
          const matchedDocs = selectedDocs.filter((row) => {
            if (isLedgerVehicleItem) return false;
            const plate = String(row.vehiclePlate ?? '').trim();
            const id = String(row.vehicleId ?? '').trim();
            if (targetPlate && plate === targetPlate) return true;
            if (id && deductionIdText.includes(id)) return true;
            if (plate && deductionIdText.includes(plate)) return true;
            return false;
          });

          const docChildren: ChildWithSubject[] = matchedDocs
            .flatMap((billing) => {
              const plate = String(billing.vehiclePlate ?? '').trim() || String(billing.vehicleId ?? '').trim() || targetPlate || '-';
              if ((billing.lineItems ?? []).length === 0) {
                return [
                  { subject: plate, label: '고정비', amount: safeNumber(billing.fixedCost), note: 'FIXED' },
                  { subject: plate, label: '변동비', amount: safeNumber(billing.variableCost), note: 'VARIABLE' }
                ];
              }
              return (billing.lineItems ?? []).map((li) => ({
                subject: plate,
                label: String(li.label ?? '').trim() || '차량비',
                amount: safeNumber(li.amount),
                note: String(li.category ?? li.type ?? '').trim() || undefined
              }));
            })
            .filter((row) => row.amount > 0);

          if (docChildren.length > 0) {
            return groupChildrenBySubject(deduction, originLabel, summaryCategory, targetPlate || '-', docChildren);
          }

          const { workerTeamByAnyId, workerTeamByName } = buildWorkerTeamMaps();
          const expenseByVehicleId = new Map<string, VehicleExpenseRecord[]>();
          deductionSourceData.vehicleExpenses.forEach((expense) => {
            const vehicleId = String(expense.vehicleId ?? '').trim();
            if (!vehicleId) return;
            const list = expenseByVehicleId.get(vehicleId) ?? [];
            list.push(expense);
            expenseByVehicleId.set(vehicleId, list);
          });

          const ledgerChildren: ChildWithSubject[] = deductionSourceData.vehicles
            .flatMap((vehicle) => {
              const plate = String(vehicle.licensePlate ?? '').trim();
              const vehicleId = String(vehicle.id ?? '').trim();
              if (targetPlate && plate !== targetPlate) return [] as ChildWithSubject[];
              if (!targetPlate && vehicleId && !deductionIdText.includes(vehicleId) && plate && !deductionIdText.includes(plate)) return [] as ChildWithSubject[];

              let isAssignedTeam = false;
              if (vehicle.currentAssigneeType === 'TEAM') {
                isAssignedTeam = matchesTeamByIdOrName(vehicle.currentAssigneeId, vehicle.currentAssigneeName);
              } else if (vehicle.currentAssigneeType === 'WORKER') {
                const workerId = String(vehicle.currentAssigneeId ?? '').trim();
                const workerName = String(vehicle.currentAssigneeName ?? '').trim();
                const info = (workerId ? workerTeamByAnyId.get(workerId) : undefined) ?? (workerName ? workerTeamByName.get(workerName) : undefined);
                isAssignedTeam = info ? matchesTeamByIdOrName(info.teamId, info.teamName) : false;
              }
              if (!isAssignedTeam) return [] as ChildWithSubject[];

              const subject = plate || vehicleId || targetPlate || '-';
              const rows: ChildWithSubject[] = [];
              const fixedCost =
                vehicle.type === 'RENT' || vehicle.type === 'LEASE'
                  ? safeNumber(vehicle.contract?.monthlyFee)
                  : 0;
              if (fixedCost > 0) {
                rows.push({ subject, label: '월 고정비', amount: fixedCost, note: 'FIXED' });
              }

              const expenses = [...(expenseByVehicleId.get(vehicleId) ?? [])].sort((a, b) => String(a.date ?? '').localeCompare(String(b.date ?? '')));
              expenses.forEach((expense) => {
                rows.push({
                  subject,
                  label: String(expense.type ?? '').trim() || '변동비',
                  amount: safeNumber(expense.amount),
                  date: String(expense.date ?? '').trim() || undefined,
                  note: 'VARIABLE'
                });
              });
              return rows;
            })
            .filter((row) => row.amount > 0);

          if (ledgerChildren.length > 0) {
            return groupChildrenBySubject(deduction, originLabel, summaryCategory, targetPlate || '-', ledgerChildren);
          }

          return [buildGenericExpenseRow(deduction, originLabel, targetPlate || '-', summaryCategory)];
        };

        const buildAccommodationExpenseRows = (deduction: TeamSettlementDeductionItem): ExpenseAggregateDetailRow[] => {
          const category = String(deduction.category ?? '').trim();
          const deductionIdText = String(deduction.id ?? '');
          const itemIdParts = deductionIdText.split(':');
          const rawKey = itemIdParts.length >= 3 ? itemIdParts.slice(2).join(':') : '';
          const isLedgerItem = rawKey.startsWith('ledger:');
          const targetDocId = !isLedgerItem && rawKey ? rawKey : '';
          const fallbackSubject = extractParenthesizedText(category) || '-';
          const originLabel = '숙소';
          const summaryCategory = '숙소별 경비';

          const accommodationNameById = new Map<string, string>();
          const accommodationNameByUtilityRecordId = new Map<string, string>();
          deductionSourceData.utilityRecords.forEach((record) => {
            const accommodationId = String(record.accommodationId ?? '').trim();
            const accommodationName = String(record.accommodationName ?? '').trim();
            const recordId = String(record.id ?? '').trim();
            if (accommodationId && accommodationName) accommodationNameById.set(accommodationId, accommodationName);
            if (recordId && accommodationName) accommodationNameByUtilityRecordId.set(recordId, accommodationName);
          });

          const selectedDocs = selectPreferredTeamBillings(
            deductionSourceData.accommodationDocs.filter((row) =>
              isTeamBillingTarget({
                issuedToType: row.issuedToType,
                teamId: row.teamId,
                teamName: row.teamName,
                issuedToWorkerId: row.issuedToWorkerId,
                issuedToWorkerName: row.issuedToWorkerName
              }) && matchesTeamByIdOrName(row.teamId, row.teamName)
            ),
            (doc) => hasBillingLineSource(doc, 'utility_ledger')
          );

          const docChildren: ChildWithSubject[] = selectedDocs
            .filter((billing) => {
              if (isLedgerItem) return false;
              if (!targetDocId) return true;
              return String(billing.id ?? '') === targetDocId;
            })
            .flatMap((billing) => {
              const billedTo = billing.teamName ? String(billing.teamName) : selectedTeamName || '팀';
              return (billing.lineItems ?? []).map((li) => ({
                subject:
                  (li.sourceUtilityRecordId ? accommodationNameByUtilityRecordId.get(String(li.sourceUtilityRecordId).trim()) : undefined) ||
                  (li.sourceAccommodationId ? accommodationNameById.get(String(li.sourceAccommodationId).trim()) : undefined) ||
                  String(li.sourceAccommodationId ?? '').trim() ||
                  billedTo,
                label: String(li.label ?? '').trim() || mapAccommodationTargetFieldLabel(String(li.targetField ?? '')),
                amount: safeNumber(li.amount)
              }));
            })
            .filter((row) => row.amount > 0);

          if (docChildren.length > 0) {
            return groupChildrenBySubject(deduction, originLabel, summaryCategory, fallbackSubject, docChildren);
          }

          const range = buildMonthRange(yearMonth);
          const monthStart = parseYmdDate(range.startDate);
          const monthEnd = parseYmdDate(range.endDate);
          if (!monthStart || !monthEnd) return [buildGenericExpenseRow(deduction, originLabel, fallbackSubject, summaryCategory)];

          const targetAccommodationId = isLedgerItem ? rawKey.replace(/^ledger:/, '').trim() : '';
          const teamDaysByAccommodation = new Map<string, number>();
          const totalDaysByAccommodation = new Map<string, number>();
          const { workerTeamByAnyId, workerTeamByName } = buildWorkerTeamMaps();

          deductionSourceData.accommodationAssignments.forEach((assignment) => {
            const accommodationId = String(assignment.accommodationId ?? '').trim();
            if (!accommodationId) return;

            const startDate = parseYmdDate(String(assignment.startDate ?? '').trim());
            if (!startDate) return;
            const endDate = assignment.endDate ? parseYmdDate(String(assignment.endDate).trim()) : null;
            const overlapDays = calculateOverlapDays({ monthStart, monthEnd, startDate, endDate });
            if (overlapDays <= 0) return;

            totalDaysByAccommodation.set(accommodationId, (totalDaysByAccommodation.get(accommodationId) ?? 0) + overlapDays);

            let teamMatched = matchesTeamByIdOrName(assignment.teamId, assignment.teamName);
            if (!teamMatched) {
              const workerId = String(assignment.workerId ?? '').trim();
              const workerName = String(assignment.workerName ?? '').trim();
              const workerTeam =
                (workerId ? workerTeamByAnyId.get(workerId) : undefined) ??
                (workerName ? workerTeamByName.get(workerName) : undefined);
              if (workerTeam) {
                teamMatched = matchesTeamByIdOrName(workerTeam.teamId, workerTeam.teamName);
              }
            }

            if (teamMatched) {
              teamDaysByAccommodation.set(accommodationId, (teamDaysByAccommodation.get(accommodationId) ?? 0) + overlapDays);
            }
          });

          const ledgerChildren: ChildWithSubject[] = deductionSourceData.utilityRecords
            .flatMap((record) => {
              const accommodationId = String(record.accommodationId ?? '').trim();
              if (!accommodationId) return [] as ChildWithSubject[];
              if (targetAccommodationId && accommodationId !== targetAccommodationId) return [] as ChildWithSubject[];

              const teamDays = teamDaysByAccommodation.get(accommodationId) ?? 0;
              const totalDays = totalDaysByAccommodation.get(accommodationId) ?? 0;
              if (teamDays <= 0 || totalDays <= 0) return [] as ChildWithSubject[];

              const ratio = teamDays / totalDays;
              const subject = String(record.accommodationName ?? '').trim() || accommodationId;
              const allocation = `${safeNumber(teamDays)}/${safeNumber(totalDays)}`;

              return [
                { label: '월세', amount: Math.round(safeNumber(record.costs?.rent) * ratio) },
                { label: '전기', amount: Math.round(safeNumber(record.costs?.electricity) * ratio) },
                { label: '가스', amount: Math.round(safeNumber(record.costs?.gas) * ratio) },
                { label: '수도', amount: Math.round(safeNumber(record.costs?.water) * ratio) },
                { label: '인터넷', amount: Math.round(safeNumber(record.costs?.internet) * ratio) },
                { label: '관리비', amount: Math.round(safeNumber(record.costs?.maintenance) * ratio) },
                { label: '기타', amount: Math.round(safeNumber(record.costs?.other) * ratio) }
              ]
                .filter((row) => row.amount > 0)
                .map((row) => ({
                  subject,
                  label: row.label,
                  amount: row.amount,
                  allocation
                }));
            })
            .filter((row) => row.amount > 0);

          if (ledgerChildren.length > 0) {
            return groupChildrenBySubject(deduction, originLabel, summaryCategory, fallbackSubject, ledgerChildren);
          }

          return [buildGenericExpenseRow(deduction, originLabel, fallbackSubject, summaryCategory)];
        };

        const rawRows = (doc.deductions ?? [])
          .filter((deduction) => EXPENSE_DEDUCTION_ORIGINS.includes(deduction.origin))
          .flatMap((deduction): ExpenseAggregateDetailRow[] => {
            if (deduction.origin === 'vehicle_billing') return buildVehicleExpenseRows(deduction);
            if (deduction.origin === 'accommodation_billing') return buildAccommodationExpenseRows(deduction);
            return [buildGenericExpenseRow(deduction)];
          })
          .filter((row) => row.amount > 0);

        const grouped = new Map<string, ExpenseAggregateDetailRow>();
        rawRows.forEach((row) => {
          const key = `${row.origin}:${row.subject}:${row.category}`;
          const prev = grouped.get(key);
          if (!prev) {
            grouped.set(key, { ...row, key, details: [...row.details] });
            return;
          }
          grouped.set(key, {
            ...prev,
            amount: prev.amount + row.amount,
            memo: [prev.memo, row.memo].filter(Boolean).join(' / ') || undefined,
            details: [...prev.details, ...row.details]
          });
        });

        const resourceRows = Array.from(grouped.values()).sort((a, b) => {
          const order = (EXPENSE_DEDUCTION_ORIGIN_ORDER[a.origin] ?? 99) - (EXPENSE_DEDUCTION_ORIGIN_ORDER[b.origin] ?? 99);
          if (order !== 0) return order;
          return a.subject.localeCompare(b.subject, 'ko');
        });
        if (isExpenseOriginAggregateItem) {
          const rows = resourceRows.filter((row) => row.origin === item.origin);
          const totalAmount = rows.reduce((sum, row) => sum + row.amount, 0);
          return { kind: 'expense_aggregate', rows, totalAmount };
        }

        const rows = EXPENSE_DEDUCTION_ORIGINS
          .map((origin): ExpenseAggregateDetailRow | null => {
            const originRows = resourceRows.filter((row) => row.origin === origin);
            if (originRows.length === 0) return null;

            const originLabel = formatDeductionOrigin(origin);
            return {
              key: `expense-origin:${origin}`,
              origin,
              originLabel,
              subject: '전체',
              category: `${originLabel} 전체`,
              amount: originRows.reduce((sum, row) => sum + safeNumber(row.amount), 0),
              memo: `${originRows.length}건`,
              details: originRows.map((row) => ({
                subject: row.subject,
                label: row.subject,
                category: row.category,
                amount: row.amount,
                note: row.memo,
                allocation: row.details.length > 0 ? `${row.details.length}건` : undefined
              }))
            };
          })
          .filter((row): row is ExpenseAggregateDetailRow => Boolean(row));
        const totalAmount = rows.reduce((sum, row) => sum + row.amount, 0);
        return { kind: 'expense_aggregate', rows, totalAmount };
      }

      if (item.origin === 'office_expense') {
        const bySite = new Map<string, SiteSkkumiRow>();
        doc.sales
          .filter((s) => s.source === 'auto' && (s.origin === 'daily_report' || s.origin === 'support_client_site') && (s.kind === '도급' || s.kind === '직영'))
          .forEach((s) => {
            const siteName = String(s.siteName ?? '').trim() || '현장 미지정';
            const prev = bySite.get(siteName) ?? { siteName, quantity: 0, manDay: 0, amount: 0 };
            bySite.set(siteName, {
              siteName,
              quantity: prev.quantity,
              manDay: prev.manDay + safeNumber(s.manDay),
              amount: prev.amount + safeNumber(s.amount)
            });
          });

        const sites = Array.from(bySite.values()).sort((a, b) => b.manDay - a.manDay);
        const totalManDay = sites.reduce((sum, x) => sum + x.manDay, 0);
        const totalAmount = sites.reduce((sum, x) => sum + x.amount, 0);
        return { kind: 'office_expense', sites, totalManDay, totalAmount };
      }

      if (
        item.origin === 'daily_wage_payroll' ||
        item.origin === 'monthly_wage_payroll' ||
        item.origin === 'service_team_payroll'
      ) {
        const salaryModel =
          item.origin === 'daily_wage_payroll' ? '일급제' :
            item.origin === 'monthly_wage_payroll' ? '월급제' : '용역팀';

        const getWorkerTeamId = (r: DailyReportWorkerRow): string => {
          const v = r.workerTeamId ?? r.teamId ?? '';
          return String(v ?? '').trim();
        };

        const getResponsibleTeamId = (r: DailyReportWorkerRow): string => {
          const v = r.responsibleTeamId ?? r.teamId ?? '';
          return String(v ?? '').trim();
        };

        const isDirectWorkKind = (r: DailyReportWorkerRow): boolean => {
          const raw = String(r.siteType ?? '').trim();
          const kind = raw === '도급' || raw === '직영' || raw === '지원' ? raw : '직영';
          return kind === '도급' || kind === '직영';
        };

        const normalizeSalaryModel = (r: DailyReportWorkerRow): string => {
          const raw = typeof r.salaryModel === 'string' ? r.salaryModel : (typeof r.payType === 'string' ? r.payType : '');
          const trimmed = String(raw ?? '').trim();
          if (!trimmed) return '일급제';
          if (trimmed.includes('용역')) return '용역팀';
          if (trimmed.includes('월급')) return '월급제';
          if (trimmed.includes('일급') || trimmed.includes('일당')) return '일급제';
          return trimmed;
        };

        const grouped = new Map<string, { workerId: string; workerName: string; manDay: number; amount: number }>();

        detailRows
          .filter((r) => {
            if (normalizeSalaryModel(r) !== salaryModel) return false;
            if (salaryModel === '용역팀') {
              const responsibleTeamId = getResponsibleTeamId(r);
              return Boolean(responsibleTeamId && matchesTeam(responsibleTeamId) && isDirectWorkKind(r));
            }
            const workerTeamId = getWorkerTeamId(r);
            return Boolean(workerTeamId && matchesTeam(workerTeamId));
          })
          .forEach((r) => {
            const workerId = String(r.workerId ?? '').trim();
            if (!workerId) return;
            const prev = grouped.get(workerId) ?? { workerId, workerName: r.workerName, manDay: 0, amount: 0 };
            grouped.set(workerId, {
              workerId,
              workerName: prev.workerName || r.workerName,
              manDay: prev.manDay + safeNumber(r.manDay),
              amount: prev.amount + safeNumber(r.amount)
            });
          });

        const rows = Array.from(grouped.values()).sort((a, b) => b.amount - a.amount);
        const totalManDay = rows.reduce((sum, x) => sum + x.manDay, 0);
        const totalAmount = rows.reduce((sum, x) => sum + x.amount, 0);
        return { kind: 'payroll', rows, totalManDay, totalAmount };
      }

      if (item.origin === 'accommodation_billing') {
        const selectedDocs = selectPreferredTeamBillings(
          deductionSourceData.accommodationDocs.filter((row) =>
            isTeamBillingTarget({
              issuedToType: row.issuedToType,
              teamId: row.teamId,
              teamName: row.teamName,
              issuedToWorkerId: row.issuedToWorkerId,
              issuedToWorkerName: row.issuedToWorkerName
            }) && matchesTeamByIdOrName(row.teamId, row.teamName)
          ),
          (doc) => hasBillingLineSource(doc, 'utility_ledger')
        );

        const itemIdParts = itemIdText.split(':');
        const rawKey = isAggregateDetailItem ? '' : (itemIdParts.length >= 3 ? itemIdParts.slice(2).join(':') : '');
        const isLedgerItem = rawKey.startsWith('ledger:');
        const targetDocId = !isLedgerItem && rawKey ? rawKey : '';
        const accommodationNameById = new Map<string, string>();
        const accommodationNameByUtilityRecordId = new Map<string, string>();
        deductionSourceData.utilityRecords.forEach((record) => {
          const accommodationId = String(record.accommodationId ?? '').trim();
          const accommodationName = String(record.accommodationName ?? '').trim();
          const recordId = String(record.id ?? '').trim();
          if (accommodationId && accommodationName) accommodationNameById.set(accommodationId, accommodationName);
          if (recordId && accommodationName) accommodationNameByUtilityRecordId.set(recordId, accommodationName);
        });

        const docRows = selectedDocs
          .filter((billing) => {
            if (isLedgerItem) return false;
            if (!targetDocId) return true;
            return String(billing.id ?? '') === targetDocId;
          })
          .flatMap((billing) => {
            const billedTo = billing.teamName ? String(billing.teamName) : selectedTeamName || '팀';
            return (billing.lineItems ?? []).map((li) => ({
              subject:
                (li.sourceUtilityRecordId ? accommodationNameByUtilityRecordId.get(String(li.sourceUtilityRecordId).trim()) : undefined) ||
                (li.sourceAccommodationId ? accommodationNameById.get(String(li.sourceAccommodationId).trim()) : undefined) ||
                String(li.sourceAccommodationId ?? '').trim() ||
                billedTo,
              label: String(li.label ?? '').trim() || mapAccommodationTargetFieldLabel(String(li.targetField ?? '')),
              amount: safeNumber(li.amount)
            }));
          })
          .filter((row) => row.amount > 0);

        if (docRows.length > 0) {
          const totalAmount = docRows.reduce((sum, row) => sum + row.amount, 0);
          return { kind: 'accommodation_billing', mode: 'document', rows: docRows, totalAmount };
        }

        const range = buildMonthRange(yearMonth);
        const monthStart = parseYmdDate(range.startDate);
        const monthEnd = parseYmdDate(range.endDate);
        if (!monthStart || !monthEnd) return { kind: 'accommodation_billing', mode: 'ledger', rows: [], totalAmount: 0 };

        const targetAccommodationId = isLedgerItem ? rawKey.replace(/^ledger:/, '').trim() : '';

        const teamDaysByAccommodation = new Map<string, number>();
        const totalDaysByAccommodation = new Map<string, number>();
        const workerTeamByAnyId = new Map<string, { teamId?: string; teamName?: string }>();
        const workerTeamByName = new Map<string, { teamId?: string; teamName?: string }>();
        deductionSourceData.workers.forEach((w) => {
          const info = { teamId: w.teamId, teamName: w.teamName };
          const id = String(w.id ?? '').trim();
          const legacyId = String(w.legacyId ?? '').trim();
          const name = String(w.name ?? '').trim();
          if (id) workerTeamByAnyId.set(id, info);
          if (legacyId) workerTeamByAnyId.set(legacyId, info);
          if (name) workerTeamByName.set(name, info);
        });

        deductionSourceData.accommodationAssignments.forEach((assignment) => {

          const accommodationId = String(assignment.accommodationId ?? '').trim();
          if (!accommodationId) return;

          const startDate = parseYmdDate(String(assignment.startDate ?? '').trim());
          if (!startDate) return;
          const endDate = assignment.endDate ? parseYmdDate(String(assignment.endDate).trim()) : null;
          const overlapDays = calculateOverlapDays({ monthStart, monthEnd, startDate, endDate });
          if (overlapDays <= 0) return;

          totalDaysByAccommodation.set(accommodationId, (totalDaysByAccommodation.get(accommodationId) ?? 0) + overlapDays);

          let teamMatched = matchesTeamByIdOrName(assignment.teamId, assignment.teamName);
          if (!teamMatched) {
            const workerId = String(assignment.workerId ?? '').trim();
            const workerName = String(assignment.workerName ?? '').trim();
            const workerTeam =
              (workerId ? workerTeamByAnyId.get(workerId) : undefined) ??
              (workerName ? workerTeamByName.get(workerName) : undefined);
            if (workerTeam) {
              teamMatched = matchesTeamByIdOrName(workerTeam.teamId, workerTeam.teamName);
            }
          }

          if (teamMatched) {
            teamDaysByAccommodation.set(accommodationId, (teamDaysByAccommodation.get(accommodationId) ?? 0) + overlapDays);
          }
        });

        const ledgerRows = deductionSourceData.utilityRecords
          .map((record) => {
            const accommodationId = String(record.accommodationId ?? '').trim();
            if (!accommodationId) return [] as Array<{ subject: string; label: string; amount: number; teamDays: number; totalDays: number }>;
            if (targetAccommodationId && accommodationId !== targetAccommodationId) return [] as Array<{ subject: string; label: string; amount: number; teamDays: number; totalDays: number }>;

            const teamDays = teamDaysByAccommodation.get(accommodationId) ?? 0;
            const totalDays = totalDaysByAccommodation.get(accommodationId) ?? 0;
            if (teamDays <= 0 || totalDays <= 0) return [] as Array<{ subject: string; label: string; amount: number; teamDays: number; totalDays: number }>;

            const ratio = teamDays / totalDays;
            const subject = String(record.accommodationName ?? '').trim() || accommodationId;

            const rows = [
              { label: '월세', amount: Math.round(safeNumber(record.costs?.rent) * ratio) },
              { label: '전기', amount: Math.round(safeNumber(record.costs?.electricity) * ratio) },
              { label: '가스', amount: Math.round(safeNumber(record.costs?.gas) * ratio) },
              { label: '수도', amount: Math.round(safeNumber(record.costs?.water) * ratio) },
              { label: '인터넷', amount: Math.round(safeNumber(record.costs?.internet) * ratio) },
              { label: '관리비', amount: Math.round(safeNumber(record.costs?.maintenance) * ratio) },
              { label: '기타', amount: Math.round(safeNumber(record.costs?.other) * ratio) }
            ]
              .filter((row) => row.amount > 0)
              .map((row) => ({
                subject,
                label: row.label,
                amount: row.amount,
                teamDays,
                totalDays
              }));

            return rows;
          })
          .flat()
          .sort((a, b) => b.amount - a.amount);

        const totalAmount = ledgerRows.reduce((sum, row) => sum + row.amount, 0);
        return { kind: 'accommodation_billing', mode: 'ledger', rows: ledgerRows, totalAmount };
      }

      if (item.origin === 'vehicle_billing') {
        const selectedDocs = selectPreferredTeamBillings(
          deductionSourceData.vehicleDocs.filter((row) =>
            isTeamBillingTarget({
              issuedToType: row.issuedToType,
              teamId: row.teamId ?? row.assignedTeamId,
              teamName: row.teamName ?? row.assignedTeamName,
              issuedToWorkerId: row.issuedToWorkerId,
              issuedToWorkerName: row.issuedToWorkerName
            }) &&
            matchesTeamByIdOrName(row.teamId ?? row.assignedTeamId, row.teamName ?? row.assignedTeamName)
          ),
          (doc) => hasBillingLineSource(doc, 'vehicle_ledger')
        );
        const isLedgerVehicleItem = !isAggregateDetailItem && itemIdText.endsWith(':ledger');
        const targetPlate = extractBracketValue(deductionCategory, '차량비');

        const matchedDocs = selectedDocs.filter((row) => {
          if (isAggregateDetailItem) return true;
          if (isLedgerVehicleItem) return false;
          const plate = String(row.vehiclePlate ?? '').trim();
          const id = String(row.vehicleId ?? '').trim();
          if (targetPlate && plate === targetPlate) return true;
          if (id && itemIdText.includes(id)) return true;
          if (plate && itemIdText.includes(plate)) return true;
          return false;
        });

        const docRows = matchedDocs
          .flatMap((billing) => {
            const plate = String(billing.vehiclePlate ?? '').trim() || String(billing.vehicleId ?? '').trim();
            if ((billing.lineItems ?? []).length === 0) {
              return [
                { subject: plate, label: '고정비', amount: safeNumber(billing.fixedCost), note: 'FIXED' },
                { subject: plate, label: '변동비', amount: safeNumber(billing.variableCost), note: 'VARIABLE' }
              ];
            }
            return (billing.lineItems ?? []).map((li) => ({
              subject: plate,
              label: String(li.label ?? '').trim() || '차량비',
              amount: safeNumber(li.amount),
              note: String(li.category ?? li.type ?? '').trim() || undefined
            }));
          })
          .filter((row) => row.amount > 0);

        if (docRows.length > 0) {
          const totalAmount = docRows.reduce((sum, row) => sum + row.amount, 0);
          return { kind: 'vehicle_billing', mode: 'document', rows: docRows, totalAmount };
        }

        const workerTeamByAnyId = new Map<string, { teamId?: string; teamName?: string }>();
        const workerTeamByName = new Map<string, { teamId?: string; teamName?: string }>();
        deductionSourceData.workers.forEach((w) => {
          const info = { teamId: w.teamId, teamName: w.teamName };
          const id = String(w.id ?? '').trim();
          const legacyId = String(w.legacyId ?? '').trim();
          const name = String(w.name ?? '').trim();
          if (id) workerTeamByAnyId.set(id, info);
          if (legacyId) workerTeamByAnyId.set(legacyId, info);
          if (name) workerTeamByName.set(name, info);
        });

        const expenseByVehicleId = new Map<string, VehicleExpenseRecord[]>();
        deductionSourceData.vehicleExpenses.forEach((expense) => {
          const vehicleId = String(expense.vehicleId ?? '').trim();
          if (!vehicleId) return;
          const list = expenseByVehicleId.get(vehicleId) ?? [];
          list.push(expense);
          expenseByVehicleId.set(vehicleId, list);
        });

        const ledgerRows = deductionSourceData.vehicles
          .flatMap((vehicle) => {
            const plate = String(vehicle.licensePlate ?? '').trim();
            const vehicleId = String(vehicle.id ?? '').trim();
            if (targetPlate && plate !== targetPlate) return [];
            if (!isAggregateDetailItem && !targetPlate && vehicleId && !itemIdText.includes(vehicleId) && plate && !itemIdText.includes(plate)) return [];

            let isAssignedTeam = false;
            if (vehicle.currentAssigneeType === 'TEAM') {
              isAssignedTeam = matchesTeamByIdOrName(vehicle.currentAssigneeId, vehicle.currentAssigneeName);
            } else if (vehicle.currentAssigneeType === 'WORKER') {
              const workerId = String(vehicle.currentAssigneeId ?? '').trim();
              const workerName = String(vehicle.currentAssigneeName ?? '').trim();
              const info = (workerId ? workerTeamByAnyId.get(workerId) : undefined) ?? (workerName ? workerTeamByName.get(workerName) : undefined);
              isAssignedTeam = info ? matchesTeamByIdOrName(info.teamId, info.teamName) : false;
            }

            if (!isAssignedTeam) return [];

            const rows: Array<{ subject: string; label: string; amount: number; date?: string; note?: string }> = [];
            const fixedCost =
              vehicle.type === 'RENT' || vehicle.type === 'LEASE'
                ? safeNumber(vehicle.contract?.monthlyFee)
                : 0;
            if (fixedCost > 0) {
              rows.push({
                subject: plate || vehicleId,
                label: '월 고정비',
                amount: fixedCost,
                note: 'FIXED'
              });
            }

            const expenses = [...(expenseByVehicleId.get(vehicleId) ?? [])].sort((a, b) => String(a.date ?? '').localeCompare(String(b.date ?? '')));
            expenses.forEach((expense) => {
              rows.push({
                subject: plate || vehicleId,
                label: String(expense.type ?? '').trim() || '변동비',
                amount: safeNumber(expense.amount),
                date: String(expense.date ?? '').trim() || undefined,
                note: 'VARIABLE'
              });
            });
            return rows;
          })
          .filter((row) => row.amount > 0);

        const totalAmount = ledgerRows.reduce((sum, row) => sum + row.amount, 0);
        return { kind: 'vehicle_billing', mode: 'ledger', rows: ledgerRows, totalAmount };
      }

      if (item.origin === 'card_billing') {
        const selectedDocs = selectPreferredTeamBillings(
          deductionSourceData.cardDocs.filter((row) =>
            isTeamBillingTarget({
              issuedToType: row.issuedToType,
              teamId: row.teamId ?? row.assignedTeamId,
              teamName: row.teamName ?? row.assignedTeamName,
              issuedToWorkerId: row.issuedToWorkerId,
              issuedToWorkerName: row.issuedToWorkerName
            }) &&
            matchesTeamByIdOrName(row.teamId ?? row.assignedTeamId, row.teamName ?? row.assignedTeamName)
          ),
          (doc) => hasBillingLineSource(doc, 'card_ledger')
        );
        const isLedgerCardItem = !isAggregateDetailItem && itemIdText.endsWith(':ledger');
        const targetCardLabel = extractBracketValue(deductionCategory, '카드비');

        const matchedDocs = selectedDocs.filter((row) => {
          if (isAggregateDetailItem) return true;
          if (isLedgerCardItem) return false;
          const cardId = String(row.cardId ?? '').trim();
          const cardLabel = String(row.cardLabel ?? '').trim();
          if (targetCardLabel && cardLabel === targetCardLabel) return true;
          if (cardId && itemIdText.includes(cardId)) return true;
          if (cardLabel && itemIdText.includes(cardLabel)) return true;
          return false;
        });

        const docRows = matchedDocs
          .flatMap((billing) => {
            const label = String(billing.cardLabel ?? '').trim() || String(billing.cardId ?? '').trim();
            return (billing.lineItems ?? []).map((li) => ({
              subject: label,
              label: String(li.label ?? '').trim() || '카드비',
              amount: safeNumber(li.amount),
              note: String(li.category ?? '').trim() || undefined
            }));
          })
          .filter((row) => row.amount > 0);

        if (docRows.length > 0) {
          const totalAmount = docRows.reduce((sum, row) => sum + row.amount, 0);
          return { kind: 'card_billing', mode: 'document', rows: docRows, totalAmount };
        }

        const workerTeamByAnyId = new Map<string, { teamId?: string; teamName?: string }>();
        const workerTeamByName = new Map<string, { teamId?: string; teamName?: string }>();
        deductionSourceData.workers.forEach((w) => {
          const info = { teamId: w.teamId, teamName: w.teamName };
          const id = String(w.id ?? '').trim();
          const legacyId = String(w.legacyId ?? '').trim();
          const name = String(w.name ?? '').trim();
          if (id) workerTeamByAnyId.set(id, info);
          if (legacyId) workerTeamByAnyId.set(legacyId, info);
          if (name) workerTeamByName.set(name, info);
        });

        const txByCardId = new Map<string, CardTransaction[]>();
        deductionSourceData.cardTransactions.forEach((tx) => {
          const cardId = String(tx.cardId ?? '').trim();
          if (!cardId) return;
          const list = txByCardId.get(cardId) ?? [];
          list.push(tx);
          txByCardId.set(cardId, list);
        });

        const ledgerRows = deductionSourceData.cards
          .flatMap((card) => {
            const cardId = String(card.id ?? '').trim();
            const cardLabel = `${String(card.name ?? '').trim()} (${String(card.last4 ?? '').trim()})`.trim();

            if (targetCardLabel && cardLabel !== targetCardLabel) return [];
            if (!isAggregateDetailItem && !targetCardLabel && cardId && !itemIdText.includes(cardId) && cardLabel && !itemIdText.includes(cardLabel)) return [];

            let isAssignedTeam = false;
            if (card.currentAssigneeType === 'TEAM') {
              isAssignedTeam = matchesTeamByIdOrName(card.currentAssigneeId, card.currentAssigneeName);
            } else if (card.currentAssigneeType === 'WORKER') {
              const workerId = String(card.currentAssigneeId ?? '').trim();
              const workerName = String(card.currentAssigneeName ?? '').trim();
              const info = (workerId ? workerTeamByAnyId.get(workerId) : undefined) ?? (workerName ? workerTeamByName.get(workerName) : undefined);
              isAssignedTeam = info ? matchesTeamByIdOrName(info.teamId, info.teamName) : false;
            }
            if (!isAssignedTeam) return [];

            const txs = [...(txByCardId.get(cardId) ?? [])].sort((a, b) => String(a.date ?? '').localeCompare(String(b.date ?? '')));
            return txs.map((tx) => ({
              subject: cardLabel,
              label: String(tx.merchant ?? '').trim() || '카드 사용',
              amount: safeNumber(tx.amount),
              date: String(tx.date ?? '').trim() || undefined,
              note: String(tx.category ?? '').trim() || undefined
            }));
          })
          .filter((row) => row.amount > 0);

        const totalAmount = ledgerRows.reduce((sum, row) => sum + row.amount, 0);
        return { kind: 'card_billing', mode: 'ledger', rows: ledgerRows, totalAmount };
      }

      if (item.origin === 'team_expense_claim') {
        const itemIdParts = itemIdText.split(':');
        const targetClaimId = itemIdParts.length >= 3 ? itemIdParts[2] : '';
        const rows = deductionSourceData.teamExpenseClaims
          .filter((claim) => claim.status === 'charged' || claim.status === 'settled')
          .filter((claim) => !targetClaimId || String(claim.id ?? '') === targetClaimId)
          .filter((claim) => {
            const isOtherExpense = claim.claimType !== 'teamCharge' || !String(claim.chargeToTeamId ?? '').trim();
            if (isOtherExpense) return matchesTeamByIdOrName(claim.payerTeamId, claim.payerTeamName);
            return matchesTeamByIdOrName(claim.chargeToTeamId, claim.chargeToTeamName);
          })
          .map((claim) => {
            const isOtherExpense = claim.claimType !== 'teamCharge' || !String(claim.chargeToTeamId ?? '').trim();
            const subject = isOtherExpense
              ? (claim.payerTeamName || selectedTeamName || '-')
              : (claim.payerTeamName || '-');
            const description = String(claim.description ?? '').trim();
            return {
              date: String(claim.date ?? '').trim(),
              subject,
              label: `${getTeamExpenseCategoryLabel(claim.category)}${description ? ` - ${description}` : ''}`,
              amount: safeNumber(claim.amount),
              note: [
                isOtherExpense ? (claim.claimType === 'officeExpense' ? '사무실경비' : '기타청구') : '내야 할 후청구',
                String(claim.siteName ?? '').trim(),
                String(claim.cardLabel ?? '').trim()
              ].filter(Boolean).join(' / ')
            };
          })
          .filter((row) => row.amount > 0);

        const totalAmount = rows.reduce((sum, row) => sum + row.amount, 0);
        return { kind: 'team_expense_claim', rows, totalAmount };
      }

      return null;
    },
    [deductionSourceData, detailRows, doc, matchesTeam, matchesTeamByIdOrName, selectedTeamName, yearMonth]
  );

  const getLineDetailRows = useCallback(
    (line: SettlementUnifiedLine): LineDetailRow[] => {
      if (line.source !== 'auto') return [];

      const supportOrigin = isSupportOrigin(line.origin);

      const matchesSiteByIdOrName = (args: { lineSiteId?: string; lineSiteName: string; rowSiteId?: string; rowSiteName?: string }): boolean => {
        const lineSiteId = args.lineSiteId ? String(args.lineSiteId).trim() : '';
        const rowSiteId = args.rowSiteId ? String(args.rowSiteId).trim() : '';
        const lineSiteName = String(args.lineSiteName ?? '').trim();
        if (!lineSiteId && !lineSiteName) return true;
        if (lineSiteId && rowSiteId && lineSiteId === rowSiteId) return true;
        const rowSiteName = String(args.rowSiteName ?? '').trim();
        if (lineSiteName && rowSiteName && lineSiteName === rowSiteName) return true;
        return false;
      };

      if (supportOrigin) {
        const rows = getSupportDetailRowsForLine(line)
          .map((row) => {
            return {
              id: `${row.id}__${line.id}`,
              date: row.date,
              siteId: row.siteId,
              siteName: String(row.siteName ?? '').trim() || '현장 미지정',
              workerName: row.workerName,
              workerTeamName: String(row.workerTeamName ?? '').trim() || '-',
              manDay: safeNumber(row.manDay),
              unitPrice: safeNumber(row.unitPrice),
              amount: safeNumber(row.amount),
              supportDirection: row.direction,
              counterTeamId: row.counterTeamId,
              counterTeamName: row.counterTeamName
            };
          });

        const targetAmount = Math.round(safeNumber(line.amount));
        const currentAmount = rows.reduce((sum, row) => sum + safeNumber(row.amount), 0);
        const diff = Math.round(targetAmount - currentAmount);
        if (rows.length > 0 && diff !== 0) {
          rows[rows.length - 1].amount = safeNumber(rows[rows.length - 1].amount) + diff;
        }

        return rows;
      }

      if (line.origin !== 'daily_report' && line.origin !== 'support_client_site') return [];

      const matchesSite = (r: DailyReportWorkerRow): boolean => {
        return matchesSiteByIdOrName({
          lineSiteId: line.siteId,
          lineSiteName: line.siteName,
          rowSiteId: r.siteId,
          rowSiteName: r.siteName
        });
      };

      const getWorkerTeamId = (r: DailyReportWorkerRow): string => {
        const v = r.workerTeamId ?? r.teamId ?? '';
        return String(v ?? '').trim();
      };

      const getResponsibleTeamId = (r: DailyReportWorkerRow): string => {
        const v = r.responsibleTeamId ?? r.teamId ?? '';
        return String(v ?? '').trim();
      };

      return detailRows
        .filter((r) => {
          if (!matchesSite(r)) return false;

          const workerTeamId = getWorkerTeamId(r);
          const responsibleTeamId = getResponsibleTeamId(r);

          if (line.direction === 'sales') {
            if (!matchesTeam(responsibleTeamId)) return false;
            if (line.counterTeamId || line.counterTeamName) return false;
            return true;
          }

          if (!matchesTeam(responsibleTeamId)) return false;
          if (line.counterTeamId || line.counterTeamName) return false;
          if (matchesTeam(workerTeamId)) return false;
          return true;
        })
        .map((r) => {
          const manDay = safeNumber(r.manDay);
          const settlementUnitPrice = line.origin === 'support_client_site' ? (safeAverage(line.amount, line.manDay) ?? 0) : 0;
          const unitPrice = settlementUnitPrice > 0 ? settlementUnitPrice : safeNumber(r.unitPrice);
          const amount = settlementUnitPrice > 0 ? Math.round(manDay * settlementUnitPrice) : safeNumber(r.amount);
          const siteName = String(r.siteName ?? '').trim() || '현장 미지정';
          const workerTeamName = String(r.workerTeamName ?? r.teamName ?? '').trim() || '-';
          return {
            id: `${r.reportId}:${r.workerId}`,
            date: r.date,
            siteId: r.siteId,
            siteName,
            workerName: r.workerName,
            workerTeamName,
            manDay,
            unitPrice,
            amount
          };
        });
    },
    [detailRows, getSupportDetailRowsForLine, matchesTeam]
  );

  const salesLines = useMemo(() => unifiedLines.filter((x) => x.direction === 'sales'), [unifiedLines]);
  const purchaseLines = useMemo(() => unifiedLines.filter((x) => x.direction === 'purchase'), [unifiedLines]);

  const mergeSupportLines = useCallback((lines: SettlementUnifiedLine[]): SettlementUnifiedLine[] => {
    const autoLines = lines.filter((x) => x.source === 'auto');
    const manualLines = lines.filter((x) => x.source === 'manual');

    const grouped = new Map<string, SettlementUnifiedLine>();
    const passthrough: SettlementUnifiedLine[] = [];

    autoLines.forEach((line) => {
      const counterKey = String(line.counterTeamId ?? '').trim() || String(line.counterTeamName ?? '').trim() || '-';
      if (counterKey === '-') {
        passthrough.push(line);
        return;
      }

      const key = `${line.direction}__${line.origin}__${counterKey}`;
      const prev = grouped.get(key);

      if (!prev) {
        grouped.set(key, {
          ...line,
          id: `merged_support:${line.direction}:${line.origin}:${encodeURIComponent(counterKey)}`,
          siteId: undefined,
          siteName: '',
          counterTeamName: line.counterTeamName ?? counterKey,
          quantity: undefined,
          manDay: safeNumber(line.manDay),
          amount: safeNumber(line.amount)
        });
        return;
      }

      grouped.set(key, {
        ...prev,
        manDay: safeNumber(prev.manDay) + safeNumber(line.manDay),
        amount: safeNumber(prev.amount) + safeNumber(line.amount)
      });
    });

    const merged = Array.from(grouped.values()).sort((a, b) => {
      const aName = String(a.counterTeamName ?? '').trim();
      const bName = String(b.counterTeamName ?? '').trim();
      const nameSort = aName.localeCompare(bName, 'ko');
      if (nameSort !== 0) return nameSort;
      return b.amount - a.amount;
    });

    const passSorted = [...passthrough].sort((a, b) => {
      const originSort = a.originLabel.localeCompare(b.originLabel, 'ko');
      if (originSort !== 0) return originSort;
      const manDaySort = safeNumber(b.manDay) - safeNumber(a.manDay);
      if (manDaySort !== 0) return manDaySort;
      return safeNumber(b.amount) - safeNumber(a.amount);
    });

    return [...merged, ...passSorted, ...manualLines];
  }, []);

  const salesSupportLinesMerged = useMemo(() => {
    return mergeSupportLines(salesLines.filter((x) => x.kind === '지원'));
  }, [mergeSupportLines, salesLines]);

  const salesContractDirectLines = useMemo(() => {
    const lines = salesLines.filter((x) => x.kind === '도급' || x.kind === '직영');
    return [...lines].sort((a, b) => a.kind.localeCompare(b.kind, 'ko'));
  }, [salesLines]);

  const settlementAmountMissingRows = useMemo<SettlementAmountMissingRow[]>(() => {
    return salesLines
      .filter((line) => {
        if (line.source !== 'auto') return false;
        if (line.kind !== '도급' && line.kind !== '직영') return false;
        if (safeNumber(line.amount) > 0) return false;
        return safeNumber(line.manDay) > 0 || safeNumber(line.quantity) > 0;
      })
      .map((line) => ({
        key: line.id,
        kind: line.kind,
        originLabel: line.originLabel,
        siteName: String(line.siteName ?? '').trim() || '현장 미지정',
        manDay: safeNumber(line.manDay),
        amount: safeNumber(line.amount),
        reason: '정산금액 미입력'
      }))
      .sort((a, b) => {
        const kindSort = a.kind.localeCompare(b.kind, 'ko');
        if (kindSort !== 0) return kindSort;
        return a.siteName.localeCompare(b.siteName, 'ko');
      });
  }, [salesLines]);

  const purchaseSupportLinesMerged = useMemo(() => {
    return mergeSupportLines(purchaseLines.filter((x) => x.kind === '지원'));
  }, [mergeSupportLines, purchaseLines]);

  const buildSupportRateOverrideContext = useCallback((
    line: SettlementUnifiedLine,
    direction: TeamSettlementSupportDetailRow['direction'],
    row?: { counterTeamId?: string; counterTeamName?: string; siteId?: string; siteName?: string }
  ): SupportRateOverrideContext => {
    const isExternalSettlement = direction === '외부지원간곳' || direction === '외부지원온곳';
    const settlementTeamId = isExternalSettlement
      ? String(row?.counterTeamId ?? line.counterTeamId ?? '').trim()
      : selectedTeamId;
    const settlementTeamName = isExternalSettlement
      ? String(row?.counterTeamName ?? line.counterTeamName ?? '').trim()
      : selectedTeamName;

    return {
      direction,
      viewTeamId: selectedTeamId,
      viewTeamName: selectedTeamName,
      settlementTeamId,
      settlementTeamName,
      siteId: String(row?.siteId ?? line.siteId ?? row?.siteName ?? line.siteName ?? '').trim()
    };
  }, [selectedTeamId, selectedTeamName]);

  const buildSupportRateOverrideContextsForLine = useCallback((line: SettlementUnifiedLine): SupportRateOverrideContext[] => {
    const rows = getSupportDetailRowsForLine(line);

    if (rows.length > 0) {
      return rows.map((row) => buildSupportRateOverrideContext(line, row.direction, row));
    }

    return getSupportDirectionsForLine(line).map((direction) => buildSupportRateOverrideContext(line, direction));
  }, [buildSupportRateOverrideContext, getSupportDetailRowsForLine, getSupportDirectionsForLine]);

  const buildSupportRateOverrideContextsForDetailRows = useCallback((
    line: SettlementUnifiedLine,
    rows: LineDetailRow[]
  ): SupportRateOverrideContext[] => {
    return rows
      .filter((row) => Boolean(row.supportDirection))
      .map((row) => buildSupportRateOverrideContext(line, row.supportDirection as TeamSettlementSupportDetailRow['direction'], row));
  }, [buildSupportRateOverrideContext]);

  const getSupportRateOverrideKeysForContexts = useCallback((contexts: SupportRateOverrideContext[]) => {
    const teamRateKeys = new Set<string>();
    const aggregateRateKeys = new Set<string>();
    const siteRateKeys = new Set<string>();

    contexts.forEach((context) => {
      const teamRateKey = getSupportSettlementMergeKey(context.direction, context.settlementTeamId, context.settlementTeamName);
      const aggregateId = getSupportAggregateId(
        context.direction,
        context.viewTeamId,
        context.viewTeamName,
        context.settlementTeamId,
        context.settlementTeamName
      );
      const mergedAggregateId = `${MERGED_SUPPORT_AGGREGATE_PREFIX}${teamRateKey}`;

      teamRateKeys.add(teamRateKey);
      aggregateRateKeys.add(aggregateId);
      aggregateRateKeys.add(mergedAggregateId);

      const siteId = normalizeSupportIdentity(context.siteId);
      if (siteId) {
        siteRateKeys.add(getSupportMonthlySiteRateKey(teamRateKey, siteId));
        siteRateKeys.add(getSupportMonthlySiteRateKey(aggregateId, siteId));
        siteRateKeys.add(getSupportMonthlySiteRateKey(mergedAggregateId, siteId));
      }
    });

    return {
      teamRateKeys: Array.from(teamRateKeys),
      aggregateRateKeys: Array.from(aggregateRateKeys),
      siteRateKeys: Array.from(siteRateKeys)
    };
  }, []);

  const getSupportRateOverrideKeysForLine = useCallback((line: SettlementUnifiedLine) => {
    return getSupportRateOverrideKeysForContexts(buildSupportRateOverrideContextsForLine(line));
  }, [buildSupportRateOverrideContextsForLine, getSupportRateOverrideKeysForContexts]);

  const saveSupportRateOverridesForLines = useCallback((lines: SettlementUnifiedLine[], unitPrice: number): boolean => {
    const normalizedRate = toPositiveRate(unitPrice);
    if (!normalizedRate) return false;

    const targetKeys = lines.reduce(
      (acc, line) => {
        const keys = getSupportRateOverrideKeysForLine(line);
        keys.teamRateKeys.forEach((key) => acc.teamRateKeys.add(key));
        keys.aggregateRateKeys.forEach((key) => acc.aggregateRateKeys.add(key));
        keys.siteRateKeys.forEach((key) => acc.siteRateKeys.add(key));
        return acc;
      },
      {
        teamRateKeys: new Set<string>(),
        aggregateRateKeys: new Set<string>(),
        siteRateKeys: new Set<string>()
      }
    );

    if (targetKeys.teamRateKeys.size === 0 && targetKeys.aggregateRateKeys.size === 0 && targetKeys.siteRateKeys.size === 0) {
      return false;
    }

    const base = loadRateOverrides(yearMonth);
    const supportTeamRates = { ...base.supportTeamRates };
    const supportAggregateRates = { ...base.supportAggregateRates };
    const supportSiteRates = { ...base.supportSiteRates };

    targetKeys.teamRateKeys.forEach((key) => {
      supportTeamRates[key] = normalizedRate;
    });
    targetKeys.aggregateRateKeys.forEach((key) => {
      supportAggregateRates[key] = normalizedRate;
    });
    targetKeys.siteRateKeys.forEach((key) => {
      supportSiteRates[key] = normalizedRate;
    });

    saveRateOverrides(yearMonth, normalizeRateOverrides({
      ...base,
      supportTeamRates,
      supportAggregateRates,
      supportSiteRates
    }));
    return true;
  }, [getSupportRateOverrideKeysForLine, yearMonth]);

  const saveSupportSiteRateOverridesForContexts = useCallback((contexts: SupportRateOverrideContext[], unitPrice: number): boolean => {
    const normalizedRate = toPositiveRate(unitPrice);
    if (!normalizedRate) return false;

    const { siteRateKeys } = getSupportRateOverrideKeysForContexts(contexts);
    if (siteRateKeys.length === 0) return false;

    const base = loadRateOverrides(yearMonth);
    const supportSiteRates = { ...base.supportSiteRates };
    siteRateKeys.forEach((key) => {
      supportSiteRates[key] = normalizedRate;
    });

    saveRateOverrides(yearMonth, normalizeRateOverrides({
      ...base,
      supportSiteRates
    }));
    return true;
  }, [getSupportRateOverrideKeysForContexts, yearMonth]);

  const reloadSettlementAfterSupportRateChange = useCallback(async (successMessage: string) => {
    if (!selectedTeamId || !yearMonth) return;
    try {
      await teamSettlementService.recalculateAndSaveTeamSettlement({
        yearMonth,
        teamId: selectedTeamId,
        keepConfirmed: false
      });
      toast.success(successMessage);
      await loadSettlement();
    } catch (error) {
      console.error(error);
      toast.error('지원단가 변경 실패');
    }
  }, [loadSettlement, selectedTeamId, yearMonth]);

  const handleApplySupportLineRate = useCallback(async (line: SettlementUnifiedLine, rawValue: string) => {
    if (!canEdit) return;
    const unitPrice = parseMoneyInput(rawValue);
    if (unitPrice <= 0) {
      toast.error('적용할 지원단가를 입력해주세요.');
      return;
    }

    if (line.source === 'manual') {
      updateDoc((prev) => {
        const amount = Math.round(safeNumber(line.manDay) * unitPrice);
        if (line.direction === 'sales') {
          return {
            ...prev,
            sales: prev.sales.map((x) => (x.id === line.id ? { ...x, amount } : x))
          };
        }
        return {
          ...prev,
          purchases: prev.purchases.map((x) => (x.id === line.id ? { ...x, amount } : x))
        };
      });
      return;
    }

    const saved = saveSupportRateOverridesForLines([line], unitPrice);
    if (!saved) {
      toast.error('지원단가 적용 대상이 없습니다.');
      return;
    }

    await reloadSettlementAfterSupportRateChange('지원단가 변경 완료');
  }, [canEdit, reloadSettlementAfterSupportRateChange, saveSupportRateOverridesForLines, updateDoc]);

  const handleApplySupportSiteRate = useCallback(async (line: SettlementUnifiedLine, siteRows: LineDetailRow[], rawValue: string) => {
    if (!canEdit) return;
    const unitPrice = parseMoneyInput(rawValue);
    if (unitPrice <= 0) {
      toast.error('적용할 지원단가를 입력해주세요.');
      return;
    }

    const contexts = buildSupportRateOverrideContextsForDetailRows(line, siteRows);
    if (contexts.length === 0) {
      toast.error('현장별 지원단가 적용 대상이 없습니다.');
      return;
    }

    const saved = saveSupportSiteRateOverridesForContexts(contexts, unitPrice);
    if (!saved) {
      toast.error('현장별 지원단가 적용 대상이 없습니다.');
      return;
    }

    await reloadSettlementAfterSupportRateChange('현장별 지원단가 변경 완료');
  }, [
    buildSupportRateOverrideContextsForDetailRows,
    canEdit,
    reloadSettlementAfterSupportRateChange,
    saveSupportSiteRateOverridesForContexts
  ]);

  const handleApplyBulkSupportRate = useCallback(async () => {
    if (!canEdit) return;
    const unitPrice = parseMoneyInput(bulkSupportRateInput);
    if (unitPrice <= 0) {
      toast.error('적용할 지원단가를 입력해주세요.');
      return;
    }

    const autoSupportLines = [...salesSupportLinesMerged, ...purchaseSupportLinesMerged]
      .filter((line) => line.source === 'auto' && isSupportOrigin(line.origin));
    if (autoSupportLines.length === 0) {
      toast.error('일괄변경할 지원 내역이 없습니다.');
      return;
    }

    const saved = saveSupportRateOverridesForLines(autoSupportLines, unitPrice);
    if (!saved) {
      toast.error('지원단가 적용 대상이 없습니다.');
      return;
    }

    setBulkSupportRateInput(formatCurrency(unitPrice));
    await reloadSettlementAfterSupportRateChange('지원단가 일괄변경 완료');
  }, [
    bulkSupportRateInput,
    canEdit,
    purchaseSupportLinesMerged,
    reloadSettlementAfterSupportRateChange,
    salesSupportLinesMerged,
    saveSupportRateOverridesForLines
  ]);



  const renderTransactionLineRows = (
    lines: SettlementUnifiedLine[],
    options?: { showKindColumn?: boolean; originDisplay?: 'origin' | 'kind'; showSupportRateColumn?: boolean }
  ) => {
    const showKindColumn = options?.showKindColumn ?? true;
    const originDisplay = options?.originDisplay ?? 'origin';
    const showSupportRateColumn = options?.showSupportRateColumn ?? false;
    const detailColSpan = (showKindColumn ? 7 : 6) + (showSupportRateColumn ? 1 : 0);

    return lines.map((line) => {
      const isExpanded = expandedLineIds.has(line.id);
      const editableManual = canEdit && line.source === 'manual';
      const isMergedSupportLine = line.source === 'auto' && line.id.startsWith('merged_support:');
      const showSiteInsteadOfCounterTeam = line.kind === '도급' || line.kind === '직영';
      const showSupportCounterAndSite = line.kind === '지원' && line.source === 'auto' && !isMergedSupportLine;
      const editableAmount =
        canEdit && (line.source === 'manual' || (line.direction === 'sales' && (line.kind === '도급' || line.kind === '직영')));

      const isSupportSales = line.direction === 'sales' && line.kind === '지원';
      const isSupportPurchase = line.direction === 'purchase' && line.kind === '지원';

      const summaryRowClassName =
        isSupportSales
          ? 'bg-purple-50'
          : isSupportPurchase
            ? 'bg-orange-50'
            : line.source === 'manual'
              ? 'bg-amber-50'
              : 'bg-white';

      const detail = isExpanded ? getLineDetailRows(line) : [];
      const isSupportFeeLine = isSupportSettlementOrigin(line.origin);
      const lineIsSupportOrigin = isSupportOrigin(line.origin);
      const supportUnitPrice = line.kind === '지원' ? safeAverage(safeNumber(line.amount), safeNumber(line.manDay)) : null;
      const supportRateAvg = isSupportFeeLine ? supportUnitPrice : null;
      const showSiteRateColumn = lineIsSupportOrigin && line.kind === '지원';
      const siteDetailColSpan = showSiteRateColumn ? 6 : 5;

      const siteSummaries = (() => {
        if (detail.length === 0) return [] as Array<{ key: string; siteId?: string; siteName: string; manDay: number; amount: number; rows: LineDetailRow[] }>;
        const grouped = new Map<string, { key: string; siteId?: string; siteName: string; manDay: number; amount: number; rows: LineDetailRow[] }>();
        detail.forEach((r) => {
          const siteId = String(r.siteId ?? '').trim();
          const siteName = String(r.siteName ?? '').trim() || '현장 미지정';
          const key = siteId || normalizeRateLookupKey(siteName) || siteName;
          const prev = grouped.get(key) ?? { key, siteId: siteId || undefined, siteName, manDay: 0, amount: 0, rows: [] as LineDetailRow[] };
          grouped.set(key, {
            key,
            siteId: prev.siteId || siteId || undefined,
            siteName,
            manDay: prev.manDay + safeNumber(r.manDay),
            amount: prev.amount + safeNumber(r.amount),
            rows: [...prev.rows, r]
          });
        });
        return Array.from(grouped.values()).sort((a, b) => b.manDay - a.manDay);
      })();

      return (
        <React.Fragment key={line.id}>
          <tr className={summaryRowClassName}>
            {showKindColumn && (
              <td className="px-2 py-2 border text-center align-middle whitespace-nowrap">
                <span
                  className={`inline-flex items-center px-2 py-1 rounded-full border text-xs font-semibold ${getKindBadgeClassName(
                    line.kind
                  )}`}
                >
                  {line.kind}
                </span>
              </td>
            )}
            <td className="px-2 py-2 border text-center align-middle text-slate-700 whitespace-nowrap">
              {originDisplay === 'kind' ? line.kind : line.originLabel}
            </td>
            <td className="px-2 py-2 border text-center align-middle whitespace-nowrap">
              {showSupportCounterAndSite ? (
                <div className="space-y-0.5 text-center">
                  <div className="text-[11px] font-medium text-slate-500">해당 {selectedTeamName || '-'}</div>
                  <div className="text-slate-800 font-medium">상대 {String(line.counterTeamName ?? '').trim() || '-'}</div>
                  <div className="text-[11px] text-slate-500">현장 {String(line.siteName ?? '').trim() || '현장 미지정'}</div>
                </div>
              ) : showSiteInsteadOfCounterTeam ? (
                editableManual ? (
                  <input
                    className="mx-auto block w-full border rounded px-2 py-1 text-center"
                    value={line.siteName}
                    onChange={(e) => {
                      const next = e.target.value;
                      if (line.direction === 'sales') {
                        updateDoc((prev) => ({
                          ...prev,
                          sales: prev.sales.map((x) => (x.id === line.id ? { ...x, siteName: next } : x))
                        }));
                      } else {
                        updateDoc((prev) => ({
                          ...prev,
                          purchases: prev.purchases.map((x) => (x.id === line.id ? { ...x, siteName: next } : x))
                        }));
                      }
                    }}
                  />
                ) : (
                  <div className="text-center text-slate-800 font-medium">{String(line.siteName ?? '').trim() || '-'}</div>
                )
              ) : editableManual ? (
                <input
                  className="mx-auto block w-full border rounded px-2 py-1 text-center"
                  value={line.counterTeamName ?? ''}
                  onChange={(e) => {
                    const next = e.target.value;
                    if (line.direction === 'sales') {
                      updateDoc((prev) => ({
                        ...prev,
                        sales: prev.sales.map((x) => (x.id === line.id ? { ...x, counterTeamName: next } : x))
                      }));
                    } else {
                      updateDoc((prev) => ({
                        ...prev,
                        purchases: prev.purchases.map((x) => (x.id === line.id ? { ...x, counterTeamName: next } : x))
                      }));
                    }
                  }}
                />
              ) : (
                <div className="text-center text-slate-700">{line.counterTeamName ?? '-'}</div>
              )}
            </td>
            <td className="px-1 py-2 border text-center align-middle whitespace-nowrap">
              <input
                className="mx-auto block w-20 border rounded px-2 py-1 text-center"
                value={formatManDay1(line.manDay)}
                disabled={!editableManual}
                onChange={(e) => {
                  const n = safeNumber(e.target.value);
                  if (line.direction === 'sales') {
                    updateDoc((prev) => ({
                      ...prev,
                      sales: prev.sales.map((x) => (x.id === line.id ? { ...x, manDay: n } : x))
                    }));
                  } else {
                    updateDoc((prev) => ({
                      ...prev,
                      purchases: prev.purchases.map((x) => (x.id === line.id ? { ...x, manDay: n } : x))
                    }));
                  }
                }}
              />
            </td>
            {showSupportRateColumn && (
              <td className="px-1 py-2 border text-center align-middle whitespace-nowrap">
                <input
                  key={`support-rate:${line.id}:${Math.round(supportUnitPrice ?? 0)}`}
                  type="text"
                  inputMode="numeric"
                  className="mx-auto block w-24 border rounded px-2 py-1 text-center font-medium text-sky-700 disabled:bg-slate-50 disabled:text-slate-500"
                  defaultValue={supportUnitPrice ? formatCurrency(Math.round(supportUnitPrice)) : ''}
                  disabled={!canEdit || line.kind !== '지원'}
                  placeholder="0"
                  onFocus={(e) => e.currentTarget.select()}
                  onBlur={(e) => {
                    const current = Math.round(supportUnitPrice ?? 0);
                    const next = parseMoneyInput(e.currentTarget.value);
                    if (next !== current) {
                      void handleApplySupportLineRate(line, e.currentTarget.value);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.currentTarget.blur();
                    }
                  }}
                />
              </td>
            )}
            <td className="px-1 py-2 border text-center align-middle whitespace-nowrap">
              <CurrencyInput
                className="mx-auto block w-28 border rounded px-2 py-1 text-center"
                value={line.amount}
                disabled={!editableAmount}
                emptyWhenZero={line.kind === '도급'}
                onChange={(n) => {
                  if (line.direction === 'sales') {
                    updateDoc((prev) => ({
                      ...prev,
                      sales: prev.sales.map((x) => (
                        x.id === line.id
                          ? { ...x, amount: n, amountOverridden: line.source === 'auto' ? true : x.amountOverridden }
                          : x
                      ))
                    }));
                  } else {
                    updateDoc((prev) => ({
                      ...prev,
                      purchases: prev.purchases.map((x) => (x.id === line.id ? { ...x, amount: n } : x))
                    }));
                  }
                }}
              />
            </td>
            <td className="px-2 py-2 border text-center align-middle">
              <input
                className="w-full border rounded px-2 py-1 text-center"
                value={line.memo ?? ''}
                disabled={!canEdit || isMergedSupportLine}
                onChange={(e) => {
                  const next = e.target.value;
                  if (line.direction === 'sales') {
                    updateDoc((prev) => ({
                      ...prev,
                      sales: prev.sales.map((x) => (x.id === line.id ? { ...x, memo: next } : x))
                    }));
                  } else {
                    updateDoc((prev) => ({
                      ...prev,
                      purchases: prev.purchases.map((x) => (x.id === line.id ? { ...x, memo: next } : x))
                    }));
                  }
                }}
              />
            </td>
            <td className="px-2 py-2 border text-center">
              <div className="flex items-center justify-center gap-1">
                <button
                  type="button"
                  className={ghostButtonClassName}
                  onClick={() => toggleLineExpanded(line.id)}
                >
                  {isExpanded ? '닫기' : '상세'}
                </button>
              </div>
            </td>
          </tr>

          {isExpanded && (
            <tr className={summaryRowClassName}>
              <td className="px-3 py-3 border" colSpan={detailColSpan}>
                <div className="rounded-lg border bg-white p-3">
                  <div className="text-sm font-semibold text-slate-800">{lineIsSupportOrigin ? '인력교류 상세' : '출력 상세'}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    {detail.length > 0
                      ? `총 ${detail.length}건 / ${siteSummaries.length}개 현장`
                      : '상세 데이터 없음 (수기 항목이거나 필터 조건에 해당 없음)'}
                  </div>

                  {editableManual && (
                    <div className="mt-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div>
                          <div className="text-xs text-slate-500 mb-1">현장</div>
                          <input
                            className="w-full border rounded px-2 py-1"
                            value={line.siteName}
                            onChange={(e) => {
                              const next = e.target.value;
                              if (line.direction === 'sales') {
                                updateDoc((prev) => ({
                                  ...prev,
                                  sales: prev.sales.map((x) => (x.id === line.id ? { ...x, siteName: next } : x))
                                }));
                              } else {
                                updateDoc((prev) => ({
                                  ...prev,
                                  purchases: prev.purchases.map((x) => (x.id === line.id ? { ...x, siteName: next } : x))
                                }));
                              }
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {isSupportFeeLine && (
                    <div className="text-xs text-slate-500 mt-1">평균 지원단가: {formatAverageCurrency(supportRateAvg)}</div>
                  )}

                  {detail.length > 0 && (
                    <div className="mt-3 space-y-3">
                      <div className="overflow-auto">
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-50 text-slate-600">
                              <th className="text-left px-2 py-2 border">현장</th>
                              <th className="text-right px-2 py-2 border">작업자수</th>
                              <th className="text-right px-2 py-2 border">공수 합계</th>
                              {showSiteRateColumn && <th className="text-right px-2 py-2 border">지원단가</th>}
                              <th className="text-right px-2 py-2 border">{lineIsSupportOrigin ? '노임총액 합계' : '금액 합계'}</th>
                              <th className="text-center px-2 py-2 border">상세</th>
                            </tr>
                          </thead>
                          <tbody>
                            {siteSummaries.map((site) => {
                              const siteKey = `${line.id}__${site.key}`;
                              const isSiteExpanded = expandedSiteKeys.has(siteKey);
                              const workerKeySet = new Set(site.rows.map((r) => `${r.workerName}__${r.workerTeamName || ''}`));
                              const workerCount = workerKeySet.size;
                              const siteSupportUnitPrice = safeAverage(site.amount, site.manDay);

                              const workerSummaries = (() => {
                                const grouped = new Map<
                                  string,
                                  { workerName: string; workerTeamName: string; manDay: number; amount: number }
                                >();

                                site.rows.forEach((r) => {
                                  const workerName = String(r.workerName ?? '').trim() || '-';
                                  const workerTeamName = String(r.workerTeamName ?? '').trim() || '-';
                                  const key = `${workerName}__${workerTeamName}`;
                                  const prev = grouped.get(key) ?? { workerName, workerTeamName, manDay: 0, amount: 0 };
                                  grouped.set(key, {
                                    workerName,
                                    workerTeamName,
                                    manDay: prev.manDay + safeNumber(r.manDay),
                                    amount: prev.amount + safeNumber(r.amount)
                                  });
                                });

                                return Array.from(grouped.values()).sort((a, b) => b.amount - a.amount);
                              })();

                              return (
                                <React.Fragment key={siteKey}>
                                  <tr className="bg-white">
                                    <td className="px-2 py-2 border">{site.siteName}</td>
                                    <td className="px-2 py-2 border text-right">{workerCount}</td>
                                    <td className="px-2 py-2 border text-right">{formatManDay1(site.manDay)}</td>
                                    {showSiteRateColumn && (
                                      <td className="px-2 py-2 border text-right">
                                        <input
                                          key={`support-site-rate:${line.id}:${site.key}:${Math.round(siteSupportUnitPrice ?? 0)}`}
                                          type="text"
                                          inputMode="numeric"
                                          className="w-24 border rounded px-2 py-1 text-right font-medium text-sky-700 disabled:bg-slate-50 disabled:text-slate-500"
                                          defaultValue={siteSupportUnitPrice ? formatCurrency(Math.round(siteSupportUnitPrice)) : ''}
                                          disabled={!canEdit}
                                          placeholder="0"
                                          onFocus={(e) => e.currentTarget.select()}
                                          onBlur={(e) => {
                                            const current = Math.round(siteSupportUnitPrice ?? 0);
                                            const next = parseMoneyInput(e.currentTarget.value);
                                            if (next !== current) {
                                              void handleApplySupportSiteRate(line, site.rows, e.currentTarget.value);
                                            }
                                          }}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              e.currentTarget.blur();
                                            }
                                          }}
                                        />
                                      </td>
                                    )}
                                    <td className="px-2 py-2 border text-right">{formatCurrency(site.amount)}</td>
                                    <td className="px-2 py-2 border text-center">
                                      <button
                                        type="button"
                                        className={ghostButtonClassName}
                                        onClick={() => toggleSiteExpanded(siteKey)}
                                      >
                                        {isSiteExpanded ? '닫기' : '상세'}
                                      </button>
                                    </td>
                                  </tr>

                                  {isSiteExpanded && (
                                    <tr className="bg-white">
                                      <td className="px-3 py-3 border" colSpan={siteDetailColSpan}>
                                        <div className="rounded-lg border bg-slate-50 p-3">
                                          <div className="text-xs font-semibold text-slate-700">작업자 상세 ({site.siteName})</div>
                                          <div className="mt-2 overflow-auto">
                                            <table className="w-full text-xs border-collapse">
                                              <thead>
                                                <tr className="bg-white text-slate-600">
                                                  <th className="text-left px-2 py-2 border">작업자</th>
                                                  <th className="text-left px-2 py-2 border">소속팀</th>
                                                  <th className="text-right px-2 py-2 border">공수</th>
                                                  <th className="text-right px-2 py-2 border">평균단가</th>
                                                  <th className="text-right px-2 py-2 border">{lineIsSupportOrigin ? '노임총액' : '금액'}</th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {workerSummaries.map((w) => {
                                                  const avgUnit = safeAverage(w.amount, w.manDay);
                                                  return (
                                                    <tr key={`${siteKey}__${w.workerName}__${w.workerTeamName}`} className="bg-white">
                                                      <td className="px-2 py-2 border">{w.workerName}</td>
                                                      <td className="px-2 py-2 border">{w.workerTeamName}</td>
                                                      <td className="px-2 py-2 border text-right">{formatManDay1(w.manDay)}</td>
                                                      <td className="px-2 py-2 border text-right">{formatAverageCurrency(avgUnit)}</td>
                                                      <td className="px-2 py-2 border text-right">{formatCurrency(w.amount)}</td>
                                                    </tr>
                                                  );
                                                })}
                                              </tbody>
                                            </table>
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </td>
            </tr>
          )}
        </React.Fragment>
      );
    });
  };

  return (
    <div className="team-settlement-page w-full p-3 sm:p-4 lg:p-6">
      <style>{`
        .team-settlement-page {
          color: #0f172a;
        }

        .team-settlement-page .overflow-auto > table > thead {
          position: sticky;
          top: 0;
          z-index: 20;
          background: #f8fafc;
          box-shadow: 0 1px 0 rgba(148, 163, 184, 0.45);
        }

        .team-settlement-page__team-list {
          -webkit-overflow-scrolling: touch;
          flex-wrap: nowrap;
          overflow-x: auto;
          padding: 0 0.125rem 0.375rem;
          scroll-snap-type: x proximity;
          scrollbar-width: thin;
        }

        .team-settlement-page__team-list > button {
          flex: 0 0 auto;
          scroll-snap-align: start;
        }

        .team-settlement-page .overflow-auto {
          -webkit-overflow-scrolling: touch;
          overscroll-behavior-inline: contain;
        }

        @media (max-width: 639px) {
          .team-settlement-page {
            padding-bottom: calc(1rem + env(safe-area-inset-bottom));
          }

          .team-settlement-page__action-grid > button {
            min-height: 44px;
          }

          .team-settlement-page__team-list {
            scroll-snap-type: x mandatory;
          }

          .team-settlement-page__team-list > button {
            min-height: 44px;
          }

          .team-settlement-page .overflow-auto > table {
            min-width: 640px;
          }
        }
      `}</style>
      <TeamSettlementWorkspaceHeader
        teamName={doc?.teamName || selectedTeamName || '팀 선택'}
        year={selectedYearMonth.year}
        month={selectedYearMonth.month}
        confirmedAt={doc?.confirmedAt ?? null}
        updatedAt={doc?.updatedAt ?? null}
        isDirty={isDirty}
        issueCount={doc ? confirmationIssues.length : 0}
        saveState={saveState}
        loading={loadState.status === 'loading'}
        canEdit={Boolean(doc && canEdit)}
        canRecalculate={Boolean(selectedTeamId && yearMonth)}
        onRefresh={handleRefresh}
        onRecalculate={handleRecalculate}
        onSave={handleSave}
        onConfirm={handleConfirm}
        onUnconfirm={handleUnconfirm}
      />

      <div className="mt-4 grid grid-cols-1 gap-3 sm:mt-6 sm:gap-4 lg:grid-cols-2">
        <div className="team-settlement-page__selector-card rounded-xl border bg-white p-3 sm:p-2.5">
          <div className="text-sm font-semibold text-slate-700">정산월</div>
          <div className="mt-2 flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="inline-flex shrink-0 items-center rounded-lg border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-sm font-bold text-slate-600 hover:bg-white hover:text-slate-900 sm:h-6 sm:w-6"
                aria-label={`${selectedYearMonth.year - 1}년으로 이동`}
                onClick={() => handleSettlementYearChange(-1)}
              >
                {'<'}
              </button>
              <div className="min-w-[88px] px-2 text-center text-sm font-bold text-slate-800 sm:min-w-[58px] sm:px-1">{selectedYearMonth.year}년</div>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-sm font-bold text-slate-600 hover:bg-white hover:text-slate-900 sm:h-6 sm:w-6"
                aria-label={`${selectedYearMonth.year + 1}년으로 이동`}
                onClick={() => handleSettlementYearChange(1)}
              >
                {'>'}
              </button>
            </div>

            <div className="team-settlement-page__month-picker grid flex-1 grid-cols-6 gap-1 lg:grid-cols-12">
              {MONTH_BUTTON_OPTIONS.map((month) => {
                const isSelected = selectedYearMonth.month === month;
                return (
                  <button
                    key={month}
                    type="button"
                    className={`h-9 min-w-0 whitespace-nowrap rounded border px-0 text-sm font-bold leading-none transition sm:h-6 lg:text-xs ${isSelected
                      ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50'
                      }`}
                    aria-pressed={isSelected}
                    onClick={() => handleSettlementMonthSelect(month)}
                  >
                    {month}월
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="team-settlement-page__selector-card rounded-xl border bg-white p-3 sm:p-4">
          <div className="text-sm font-semibold text-slate-700">팀</div>
          <label className="sr-only" htmlFor="team-settlement-team-select">정산 팀 선택</label>
          <select
            id="team-settlement-team-select"
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 sm:hidden"
            value={selectedTeamId}
            onChange={(event) => handleTeamSelect(event.target.value)}
          >
            {teams.map((team) => (
              <option key={String(team.id ?? '')} value={String(team.id ?? '')}>{team.name}</option>
            ))}
          </select>
          <div className="team-settlement-page__team-list mt-2 hidden gap-2 sm:flex" role="group" aria-label="팀 선택">
            {teams.map((t) => {
              const teamId = String(t.id ?? '');
              const isSelected = teamId === String(selectedTeamId);
              return (
                <button
                  key={teamId}
                  type="button"
                  className={`h-11 rounded-md border px-3 text-sm font-semibold transition hover:brightness-95 sm:h-8 sm:px-2 sm:text-xs ${isSelected ? 'shadow-sm ring-1 ring-slate-900/10' : ''
                    }`}
                  style={getTeamButtonStyle(t.color, isSelected)}
                  aria-pressed={isSelected}
                  onClick={() => handleTeamSelect(teamId)}
                >
                  {t.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {doc && (
        <div className="mt-4 space-y-4">
          <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-6" aria-label="정산 요약">
            <div className="col-span-2 rounded-2xl border border-slate-900 bg-slate-950 p-4 text-white shadow-lg sm:p-5 lg:col-span-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-300">최종 정산 잔액</div>
                <div
                  className={`rounded-full border px-2 py-1 text-xs font-semibold ${doc.confirmedAt ? 'border-emerald-400 text-emerald-300' : 'border-amber-400 text-amber-300'}`}
                >
                  {doc.confirmedAt ? '확정' : '미확정'}
                </div>
              </div>
              <div className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">{formatCurrency(totals.net)}원</div>
              <div className="mt-3 text-xs text-slate-300">매출 - 매입 - 공제 + 추가 + 전월이월 + 입금조정</div>
              <div className="mt-1 font-mono text-xs text-slate-400">
                {formatCurrency(totals.salesTotal)} - {formatCurrency(totals.purchasesTotal)} - {formatCurrency(totals.deductionsTotal)} +
                {formatCurrency(totals.additionsTotal)} + {formatCurrency(totals.prevCarryover)} + {formatCurrency(totals.deposit)}
              </div>
            </div>

            <div className="team-settlement-page__summary-card rounded-2xl border bg-white p-3 shadow-sm sm:p-5">
              <div className="text-xs text-slate-500">매출 합계</div>
              <div className="mt-1 text-xl font-extrabold text-slate-900 sm:text-2xl">{formatCurrency(totals.salesTotal)}원</div>
              <div className="mt-2 text-xs text-slate-500">도급/직영/지원 + 지원비 포함</div>
            </div>

            <div className="team-settlement-page__summary-card rounded-2xl border bg-white p-3 shadow-sm sm:p-5">
              <div className="text-xs text-slate-500">매입 합계</div>
              <div className="mt-1 text-xl font-extrabold text-slate-900 sm:text-2xl">{formatCurrency(totals.purchasesTotal)}원</div>
              <div className="mt-2 text-xs text-slate-500">지원(받음) + 지원비 포함</div>
            </div>

            <div className="team-settlement-page__summary-card rounded-2xl border bg-white p-3 shadow-sm sm:p-5">
              <div className="text-xs text-slate-500">공제 합계</div>
              <div className="mt-1 text-xl font-extrabold text-slate-900 sm:text-2xl">{formatCurrency(totals.deductionsTotal)}원</div>
              <div className="mt-2 text-xs text-slate-500">사무실비/급여/차량/숙소/카드/경비</div>
            </div>

            <div className="team-settlement-page__summary-card rounded-2xl border bg-white p-3 shadow-sm sm:p-5">
              <div className="text-xs text-slate-500">추가 합계</div>
              <div className="mt-1 text-xl font-extrabold text-slate-900 sm:text-2xl">{formatCurrency(totals.additionsTotal)}원</div>
              <div className="mt-2 text-xs text-slate-500">수기 추가</div>
            </div>
          </section>

          {supportRateMissingRows.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-sm font-bold text-amber-900">지원단가 누락</div>
                  <div className="text-xs text-amber-800 mt-0.5">
                    지원 매입/매출에 적용할 지원단가가 없거나 0원인 내역입니다. 정산 확정 전에 단가를 확인하세요.
                  </div>
                </div>
                <div className="text-xs font-semibold text-amber-900">{supportRateMissingRows.length}건</div>
              </div>

              <div className="mt-3 overflow-auto">
                <table className="w-full text-xs border-collapse bg-white">
                  <thead>
                    <tr className="bg-amber-100 text-amber-900">
                      <th className="text-left px-2 py-2 border border-amber-200 whitespace-nowrap">구분</th>
                      <th className="text-left px-2 py-2 border border-amber-200 whitespace-nowrap">현장</th>
                      <th className="text-left px-2 py-2 border border-amber-200 whitespace-nowrap">상대팀</th>
                      <th className="text-right px-2 py-2 border border-amber-200 whitespace-nowrap">공수</th>
                      <th className="text-right px-2 py-2 border border-amber-200 whitespace-nowrap">현재단가</th>
                      <th className="text-left px-2 py-2 border border-amber-200 whitespace-nowrap">사유</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supportRateMissingRows.map((row) => (
                      <tr key={row.key} className="text-slate-800">
                        <td className="px-2 py-2 border border-amber-100 whitespace-nowrap">{row.directionLabel}</td>
                        <td className="px-2 py-2 border border-amber-100 font-medium">{row.siteName}</td>
                        <td className="px-2 py-2 border border-amber-100">{row.counterTeamName}</td>
                        <td className="px-2 py-2 border border-amber-100 text-right">{formatManDay1(row.manDay)}</td>
                        <td className="px-2 py-2 border border-amber-100 text-right">{formatCurrency(Math.round(row.currentRate))}</td>
                        <td className="px-2 py-2 border border-amber-100 text-amber-800">{row.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {settlementAmountMissingRows.length > 0 && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-sm font-bold text-rose-900">정산금액 누락</div>
                  <div className="text-xs text-rose-800 mt-0.5">
                    도급/직영 공수는 있으나 매출 정산금액이 0원인 현장입니다. 정산 확정 전에 금액을 확인하세요.
                  </div>
                </div>
                <div className="text-xs font-semibold text-rose-900">{settlementAmountMissingRows.length}건</div>
              </div>

              <div className="mt-3 overflow-auto">
                <table className="w-full text-xs border-collapse bg-white">
                  <thead>
                    <tr className="bg-rose-100 text-rose-900">
                      <th className="text-left px-2 py-2 border border-rose-200 whitespace-nowrap">구분</th>
                      <th className="text-left px-2 py-2 border border-rose-200 whitespace-nowrap">원천</th>
                      <th className="text-left px-2 py-2 border border-rose-200 whitespace-nowrap">현장</th>
                      <th className="text-right px-2 py-2 border border-rose-200 whitespace-nowrap">공수</th>
                      <th className="text-right px-2 py-2 border border-rose-200 whitespace-nowrap">현재금액</th>
                      <th className="text-left px-2 py-2 border border-rose-200 whitespace-nowrap">사유</th>
                    </tr>
                  </thead>
                  <tbody>
                    {settlementAmountMissingRows.map((row) => (
                      <tr key={row.key} className="text-slate-800">
                        <td className="px-2 py-2 border border-rose-100 whitespace-nowrap">{row.kind}</td>
                        <td className="px-2 py-2 border border-rose-100 whitespace-nowrap">{row.originLabel}</td>
                        <td className="px-2 py-2 border border-rose-100 font-medium">{row.siteName}</td>
                        <td className="px-2 py-2 border border-rose-100 text-right">{formatManDay1(row.manDay)}</td>
                        <td className="px-2 py-2 border border-rose-100 text-right">{formatCurrency(row.amount)}</td>
                        <td className="px-2 py-2 border border-rose-100 text-rose-800">{row.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}


        </div>
      )}

      {loadState.status === 'loading' && (
        <div className="mt-6 rounded-xl border bg-white p-4 text-slate-600">불러오는 중...</div>
      )}

      {loadState.status === 'error' && (
        <div className="mt-6 rounded-xl border bg-rose-50 p-4 text-rose-700">{loadState.message}</div>
      )}

      {doc && (
        <div className="mt-6 grid grid-cols-1 2xl:grid-cols-3 gap-4">
          <section id="settlement-transactions" className="team-settlement-page__transaction-card scroll-mt-36 rounded-2xl border bg-white p-5 shadow-sm 2xl:col-span-2">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h2 className="team-settlement-page__transaction-title font-bold text-slate-900">
                  <span className="mr-2 text-blue-600">01</span>매출·매입 조정
                </h2>
                <div className="team-settlement-page__transaction-subtitle text-xs text-slate-500 mt-0.5">
                  도급/직영/지원 공수 기반 자동집계 + 상세(출력/인력교류) 아코디언
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="team-settlement-page__transaction-bulk-label text-xs font-semibold text-slate-600">지원단가 일괄변경</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={bulkSupportRateInput}
                  onChange={(e) => setBulkSupportRateInput(e.target.value)}
                  onFocus={(e) => e.currentTarget.select()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      void handleApplyBulkSupportRate();
                    }
                  }}
                  disabled={!canEdit}
                  placeholder="단가"
                  className="w-28 border rounded-lg px-3 py-2 text-right text-sm font-medium text-sky-700 disabled:bg-slate-50 disabled:text-slate-400"
                  aria-label="지원단가 일괄변경 금액"
                />
                <button type="button" className={secondaryButtonClassName} onClick={handleApplyBulkSupportRate} disabled={!canEdit}>
                  일괄적용
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 xl:grid-cols-2 gap-8">
              <div>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="team-settlement-page__transaction-section-title font-semibold text-slate-800">매출</div>
                </div>

                <div className="mt-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="team-settlement-page__transaction-section-title text-sm font-semibold text-slate-700">지원</div>
                    <button type="button" className={addButtonClassName} onClick={() => handleAddManualSale('지원')} disabled={!canEdit}>
                      + 수기 지원 매출
                    </button>
                  </div>
                  <div className="mt-2 overflow-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-600">
                          <th className="px-2 py-2 border text-center align-middle whitespace-nowrap">원천</th>
                          <th className="px-2 py-2 border text-center align-middle whitespace-nowrap">해당/상대/현장</th>
                          <th className="px-1 py-2 border text-center align-middle whitespace-nowrap">공수</th>
                          <th className="px-1 py-2 border text-center align-middle whitespace-nowrap">지원단가</th>
                          <th className="px-1 py-2 border text-center align-middle whitespace-nowrap">노임총액</th>
                          <th className="px-2 py-2 border text-center align-middle">비고</th>
                          <th className="px-2 py-2 border text-center align-middle"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {salesSupportLinesMerged.length === 0
                          ? <EmptySettlementTableRow colSpan={7} message="지원 매출 내역이 없습니다. 재집계하거나 수기로 추가해 주세요." />
                          : renderTransactionLineRows(salesSupportLinesMerged, { showKindColumn: false, showSupportRateColumn: true })}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-2 flex items-center justify-end gap-3 rounded-lg bg-purple-50 px-3 py-2 text-sm">
                    <span className="font-semibold text-purple-700">총금액</span>
                    <span className="font-extrabold text-purple-900">{formatCurrency(transactionSectionTotals.salesSupport.amount)}원</span>
                    <span className="font-semibold text-purple-700">공수</span>
                    <span className="font-extrabold text-purple-900">{formatManDay1(transactionSectionTotals.salesSupport.manDay)}공</span>
                  </div>
                </div>

                <div className="mt-6">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="team-settlement-page__transaction-section-title text-sm font-semibold text-slate-700">도급/직영</div>
                    <button type="button" className={addButtonClassName} onClick={() => handleAddManualSale('직영')} disabled={!canEdit}>
                      + 수기 직영 매출
                    </button>
                  </div>
                  <div className="mt-2 overflow-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-600">
                          <th className="px-2 py-2 border text-center align-middle whitespace-nowrap">구분</th>
                          <th className="px-2 py-2 border text-center align-middle whitespace-nowrap">원천</th>
                          <th className="px-2 py-2 border text-center align-middle whitespace-nowrap">현장</th>
                          <th className="px-1 py-2 border text-center align-middle whitespace-nowrap">공수</th>
                          <th className="px-1 py-2 border text-center align-middle whitespace-nowrap">금액</th>
                          <th className="px-2 py-2 border text-center align-middle">비고</th>
                          <th className="px-2 py-2 border text-center align-middle"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {salesContractDirectLines.length === 0
                          ? <EmptySettlementTableRow colSpan={7} message="도급·직영 매출 내역이 없습니다. 재집계하거나 수기로 추가해 주세요." />
                          : renderTransactionLineRows(salesContractDirectLines, { originDisplay: 'kind' })}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-end gap-x-3 gap-y-1 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <span className="font-bold text-indigo-700">도급</span>
                    <span className="font-semibold text-slate-700">총금액</span>
                    <span className="font-extrabold text-slate-900">{formatCurrency(transactionSectionTotals.salesContract.amount)}원</span>
                    <span className="font-semibold text-slate-700">공수</span>
                    <span className="font-extrabold text-slate-900">{formatManDay1(transactionSectionTotals.salesContract.manDay)}공</span>
                    <span className="mx-1 h-4 w-px bg-slate-300" aria-hidden="true" />
                    <span className="font-bold text-emerald-700">직영</span>
                    <span className="font-semibold text-slate-700">총금액</span>
                    <span className="font-extrabold text-slate-900">{formatCurrency(transactionSectionTotals.salesDirect.amount)}원</span>
                    <span className="font-semibold text-slate-700">공수</span>
                    <span className="font-extrabold text-slate-900">{formatManDay1(transactionSectionTotals.salesDirect.manDay)}공</span>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="team-settlement-page__transaction-section-title font-semibold text-slate-800">매입</div>
                </div>

                <div className="mt-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="team-settlement-page__transaction-section-title text-sm font-semibold text-slate-700">지원</div>
                    <button type="button" className={addButtonClassName} onClick={handleAddManualPurchase} disabled={!canEdit}>
                      + 수기 지원 매입
                    </button>
                  </div>

                  <div className="mt-2 overflow-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-600">
                          <th className="px-2 py-2 border text-center align-middle whitespace-nowrap">원천</th>
                          <th className="px-2 py-2 border text-center align-middle whitespace-nowrap">상대팀</th>
                          <th className="px-1 py-2 border text-center align-middle whitespace-nowrap">공수</th>
                          <th className="px-1 py-2 border text-center align-middle whitespace-nowrap">지원단가</th>
                          <th className="px-1 py-2 border text-center align-middle whitespace-nowrap">노임총액</th>
                          <th className="px-2 py-2 border text-center align-middle">비고</th>
                          <th className="px-2 py-2 border text-center align-middle"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {purchaseSupportLinesMerged.length === 0
                          ? <EmptySettlementTableRow colSpan={7} message="지원 매입 내역이 없습니다. 재집계하거나 수기로 추가해 주세요." />
                          : renderTransactionLineRows(purchaseSupportLinesMerged, { showKindColumn: false, showSupportRateColumn: true })}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-2 flex items-center justify-end gap-3 rounded-lg bg-orange-50 px-3 py-2 text-sm">
                    <span className="font-semibold text-orange-700">총금액</span>
                    <span className="font-extrabold text-orange-900">{formatCurrency(transactionSectionTotals.purchaseSupport.amount)}원</span>
                    <span className="font-semibold text-orange-700">공수</span>
                    <span className="font-extrabold text-orange-900">{formatManDay1(transactionSectionTotals.purchaseSupport.manDay)}공</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 text-sm">
              <div>
                <div className="team-settlement-page__transaction-total-label text-slate-600">거래내역 합계 (매출 / 매입)</div>
                <div className="team-settlement-page__transaction-total-value mt-1 font-bold text-slate-800">
                  {formatCurrency(totals.salesTotal)}원 / {formatCurrency(totals.purchasesTotal)}원
                  <span className="mx-2 text-slate-300">·</span>
                  {formatManDay1(transactionSectionTotals.salesTotal.manDay)}공 / {formatManDay1(transactionSectionTotals.purchasesTotal.manDay)}공
                </div>
              </div>
              <div className="text-xs font-medium text-slate-500">
                전체 변경사항은 상단 작업 표시줄에서 한 번에 저장됩니다.
              </div>
            </div>
          </section>

          <section id="settlement-deductions" className="scroll-mt-36 rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-slate-900"><span className="mr-2 text-blue-600">02</span>공제</h2>
                <div className="text-xs text-slate-500 mt-0.5">사무실비·급여·차량·숙소·카드·경비 구분</div>
              </div>
              <button type="button" className={addButtonClassName} onClick={handleAddManualDeduction} disabled={!canEdit}>
                + 수기 공제
              </button>
            </div>

            <div className="mt-4 space-y-5">
              {deductionGroups.map((group) => (
                <div key={group.key} className="border-t border-slate-200 pt-4 first:border-t-0 first:pt-0">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-bold text-slate-800">{group.title}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{group.description}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-500">{group.items.length}건</div>
                      <div className="text-sm font-extrabold text-slate-900">{formatCurrency(group.totalAmount)}원</div>
                      {group.sourceSummaries.length > 0 && (group.key === 'expense' || group.sourceSummaries.length > 1) && (
                        <div className="mt-2 flex max-w-sm flex-wrap justify-end gap-1">
                          {group.sourceSummaries.map((summary) => (
                            <span
                              key={`${group.key}-${summary.origin}`}
                              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600"
                            >
                              <span>{summary.label}</span>
                              <span className="text-slate-900">{formatCurrency(summary.amount)}원</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-2 overflow-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-600">
                          <th className="text-left px-2 py-2 border">구분</th>
                          <th className="text-left px-2 py-2 border">항목</th>
                          <th className="text-right px-2 py-2 border">금액</th>
                          <th className="text-left px-2 py-2 border">비고</th>
                          <th className="text-center px-2 py-2 border whitespace-nowrap">상세</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.displayItems.length === 0 ? (
                          <tr className="bg-white">
                            <td className="px-2 py-3 border text-center text-slate-400" colSpan={5}>
                              내역 없음
                            </td>
                          </tr>
                        ) : group.displayItems.map((item) => {
                    const editableRow = canEdit && item.source === 'manual';
                    const canExpand =
                      item.source === 'auto' &&
                      (
                        item.origin === 'office_expense' ||
                        item.origin === 'daily_wage_payroll' ||
                        item.origin === 'monthly_wage_payroll' ||
                        item.origin === 'service_team_payroll' ||
                        item.origin === 'team_expense_claim' ||
                        item.origin === 'accommodation_billing' ||
                        item.origin === 'vehicle_billing' ||
                        item.origin === 'card_billing'
                      );
                    const isExpanded = canExpand && expandedDeductionIds.has(item.id);
                    const detail = isExpanded ? getDeductionDetail(item) : null;
                    return (
                      <React.Fragment key={item.id}>
                        <tr className={item.source === 'auto' ? 'bg-white' : 'bg-amber-50'}>
                          <td className="px-2 py-2 border text-slate-700">
                            {getDeductionDisplayOriginLabel(item)}
                          </td>
                          <td className="px-2 py-2 border">
                            <input
                              className="w-full border rounded px-2 py-1"
                              value={item.category}
                              disabled={!editableRow}
                              onChange={(e) => {
                                const next = e.target.value;
                                updateDoc((prev) => ({
                                  ...prev,
                                  deductions: prev.deductions.map((x) => (x.id === item.id ? { ...x, category: next } : x))
                                }));
                              }}
                            />
                          </td>
                          <td className="px-2 py-2 border text-right">
                            <CurrencyInput
                              className="w-full border rounded px-2 py-1 text-right"
                              value={item.amount}
                              disabled={!editableRow}
                              onChange={(n) => {
                                updateDoc((prev) => ({
                                  ...prev,
                                  deductions: prev.deductions.map((x) => (x.id === item.id ? { ...x, amount: n } : x))
                                }));
                              }}
                            />
                          </td>
                          <td className="px-2 py-2 border">
                            <input
                              className="w-full border rounded px-2 py-1"
                              value={item.memo ?? ''}
                              disabled={!editableRow}
                              onChange={(e) => {
                                const next = e.target.value;
                                updateDoc((prev) => ({
                                  ...prev,
                                  deductions: prev.deductions.map((x) => (x.id === item.id ? { ...x, memo: next } : x))
                                }));
                              }}
                            />
                          </td>
                          <td className="px-2 py-2 border text-center">
                            <div className="flex items-center justify-center gap-1">
                              {canExpand && (
                                <button
                                  type="button"
                                  className={ghostButtonClassName}
                                  onClick={() => toggleDeductionExpanded(item.id)}
                                >
                                  {isExpanded ? '닫기' : '상세'}
                                </button>
                              )}
                              <button
                                type="button"
                                className="px-2 py-1 rounded border bg-white text-slate-700 disabled:opacity-50"
                                disabled={!editableRow}
                                onClick={() => {
                                  updateDoc((prev) => ({
                                    ...prev,
                                    deductions: prev.deductions.filter((x) => x.id !== item.id)
                                  }));
                                }}
                              >
                                삭제
                              </button>
                            </div>
                          </td>
                        </tr>

                        {isExpanded && detail && (
                          <tr className={item.source === 'auto' ? 'bg-white' : 'bg-amber-50'}>
                            <td className="px-3 py-3 border" colSpan={5}>
                              <div className="rounded-lg border bg-white p-3">
                                {detail.kind === 'office_expense' && (
                                  <div>
                                    <div className="text-sm font-semibold text-slate-800">사무실비 상세</div>
                                    <div className="text-xs text-slate-500 mt-1">
                                      도급+직영 총공수 {formatManDay1(detail.totalManDay)} 기준
                                    </div>
                                    <div className="mt-3 overflow-auto">
                                      <table className="w-full text-xs border-collapse">
                                        <thead>
                                          <tr className="bg-slate-50 text-slate-600">
                                            <th className="text-left px-2 py-2 border">현장</th>
                                            <th className="text-right px-2 py-2 border">공수</th>
                                            <th className="text-right px-2 py-2 border">금액</th>
                                            <th className="text-right px-2 py-2 border">원/공수</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {detail.sites.length === 0 ? (
                                            <tr>
                                              <td className="px-2 py-2 border text-slate-500" colSpan={4}>
                                                데이터 없음
                                              </td>
                                            </tr>
                                          ) : (
                                            detail.sites.map((s) => (
                                              <tr key={s.siteName} className="bg-white">
                                                <td className="px-2 py-2 border text-slate-800 font-medium">{s.siteName}</td>
                                                <td className="px-2 py-2 border text-right">{formatManDay1(s.manDay)}</td>
                                                <td className="px-2 py-2 border text-right">{formatCurrency(s.amount)}</td>
                                                <td className="px-2 py-2 border text-right">
                                                  {formatAverageCurrency(safeAverage(s.amount, s.manDay))}
                                                </td>
                                              </tr>
                                            ))
                                          )}
                                        </tbody>
                                      </table>
                                    </div>
                                    <div className="mt-3 text-sm">
                                      <div className="flex items-center justify-between">
                                        <div className="text-slate-600">총공수</div>
                                        <div className="font-bold text-slate-900">{formatManDay1(detail.totalManDay)}</div>
                                      </div>
                                      <div className="flex items-center justify-between mt-1">
                                        <div className="text-slate-600">사무실비(총공수×10,000)</div>
                                        <div className="font-bold text-slate-900">{formatCurrency(Math.round(detail.totalManDay * 10000))}원</div>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {detail.kind === 'payroll' && (
                                  <div>
                                    <div className="text-sm font-semibold text-slate-800">급여 상세</div>
                                    <div className="text-xs text-slate-500 mt-1">
                                      작업자별 공수·금액 합계
                                    </div>

                                    <div className="mt-3 overflow-auto">
                                      <table className="w-full text-xs border-collapse">
                                        <thead>
                                          <tr className="bg-slate-50 text-slate-600">
                                            <th className="text-left px-2 py-2 border">작업자</th>
                                            <th className="text-right px-2 py-2 border">공수</th>
                                            <th className="text-right px-2 py-2 border">금액</th>
                                            <th className="text-right px-2 py-2 border">원/공수</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {detail.rows.length === 0 ? (
                                            <tr>
                                              <td className="px-2 py-2 border text-slate-500" colSpan={4}>
                                                데이터 없음
                                              </td>
                                            </tr>
                                          ) : (
                                            detail.rows.map((r) => (
                                              <tr key={r.workerId} className="bg-white">
                                                <td className="px-2 py-2 border text-slate-800 font-medium">{r.workerName}</td>
                                                <td className="px-2 py-2 border text-right">{formatManDay1(r.manDay)}</td>
                                                <td className="px-2 py-2 border text-right">{formatCurrency(r.amount)}</td>
                                                <td className="px-2 py-2 border text-right">
                                                  {formatAverageCurrency(safeAverage(r.amount, r.manDay))}
                                                </td>
                                              </tr>
                                            ))
                                          )}
                                        </tbody>
                                      </table>
                                    </div>

                                    <div className="mt-3 text-sm">
                                      <div className="flex items-center justify-between">
                                        <div className="text-slate-600">총공수</div>
                                        <div className="font-bold text-slate-900">{formatManDay1(detail.totalManDay)}</div>
                                      </div>
                                      <div className="flex items-center justify-between mt-1">
                                        <div className="text-slate-600">총금액</div>
                                        <div className="font-bold text-slate-900">{formatCurrency(detail.totalAmount)}원</div>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {detail.kind === 'accommodation_billing' && (
                                  <div>
                                    <div className="text-sm font-semibold text-slate-800">숙소 공제 상세</div>
                                    <div className="text-xs text-slate-500 mt-1">
                                      {detail.mode === 'document' ? '숙소 청구서 기준' : '월별 공과금 대장 배분 기준'}
                                    </div>

                                    <div className="mt-3 overflow-auto">
                                      <table className="w-full text-xs border-collapse">
                                        <thead>
                                          <tr className="bg-slate-50 text-slate-600">
                                            <th className="text-left px-2 py-2 border">대상</th>
                                            <th className="text-left px-2 py-2 border">항목</th>
                                            <th className="text-right px-2 py-2 border">금액</th>
                                            {detail.mode === 'ledger' && (
                                              <th className="text-right px-2 py-2 border">배분일수(팀/전체)</th>
                                            )}
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {detail.rows.length === 0 ? (
                                            <tr>
                                              <td className="px-2 py-2 border text-slate-500" colSpan={detail.mode === 'ledger' ? 4 : 3}>
                                                데이터 없음
                                              </td>
                                            </tr>
                                          ) : (
                                            detail.rows.map((row, idx) => (
                                              <tr key={`accommodation-row-${idx}`} className="bg-white">
                                                <td className="px-2 py-2 border text-slate-800 font-medium">{row.subject}</td>
                                                <td className="px-2 py-2 border">{row.label}</td>
                                                <td className="px-2 py-2 border text-right">{formatCurrency(row.amount)}</td>
                                                {detail.mode === 'ledger' && (
                                                  <td className="px-2 py-2 border text-right">
                                                    {safeNumber(row.teamDays)}/{safeNumber(row.totalDays)}
                                                  </td>
                                                )}
                                              </tr>
                                            ))
                                          )}
                                        </tbody>
                                      </table>
                                    </div>

                                    <div className="mt-3 text-sm">
                                      <div className="flex items-center justify-between mt-1">
                                        <div className="text-slate-600">총금액</div>
                                        <div className="font-bold text-slate-900">{formatCurrency(detail.totalAmount)}원</div>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {detail.kind === 'vehicle_billing' && (
                                  <div>
                                    <div className="text-sm font-semibold text-slate-800">차량 공제 상세</div>
                                    <div className="text-xs text-slate-500 mt-1">
                                      {detail.mode === 'document' ? '차량 청구서 기준' : '월별 차량 대장 자동집계 기준'}
                                    </div>

                                    <div className="mt-3 overflow-auto">
                                      <table className="w-full text-xs border-collapse">
                                        <thead>
                                          <tr className="bg-slate-50 text-slate-600">
                                            <th className="text-left px-2 py-2 border">차량</th>
                                            <th className="text-left px-2 py-2 border">항목</th>
                                            <th className="text-left px-2 py-2 border">구분</th>
                                            <th className="text-left px-2 py-2 border">일자</th>
                                            <th className="text-right px-2 py-2 border">금액</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {detail.rows.length === 0 ? (
                                            <tr>
                                              <td className="px-2 py-2 border text-slate-500" colSpan={5}>
                                                데이터 없음
                                              </td>
                                            </tr>
                                          ) : (
                                            detail.rows.map((row, idx) => (
                                              <tr key={`vehicle-row-${idx}`} className="bg-white">
                                                <td className="px-2 py-2 border text-slate-800 font-medium">{row.subject}</td>
                                                <td className="px-2 py-2 border">{row.label}</td>
                                                <td className="px-2 py-2 border">{row.note ?? '-'}</td>
                                                <td className="px-2 py-2 border">{row.date ?? '-'}</td>
                                                <td className="px-2 py-2 border text-right">{formatCurrency(row.amount)}</td>
                                              </tr>
                                            ))
                                          )}
                                        </tbody>
                                      </table>
                                    </div>

                                    <div className="mt-3 text-sm">
                                      <div className="flex items-center justify-between mt-1">
                                        <div className="text-slate-600">총금액</div>
                                        <div className="font-bold text-slate-900">{formatCurrency(detail.totalAmount)}원</div>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {detail.kind === 'card_billing' && (
                                  <div>
                                    <div className="text-sm font-semibold text-slate-800">카드 공제 상세</div>
                                    <div className="text-xs text-slate-500 mt-1">
                                      {detail.mode === 'document' ? '카드 청구서 기준' : '월별 카드 대장 자동집계 기준'}
                                    </div>

                                    <div className="mt-3 overflow-auto">
                                      <table className="w-full text-xs border-collapse">
                                        <thead>
                                          <tr className="bg-slate-50 text-slate-600">
                                            <th className="text-left px-2 py-2 border">카드</th>
                                            <th className="text-left px-2 py-2 border">사용처</th>
                                            <th className="text-left px-2 py-2 border">구분</th>
                                            <th className="text-left px-2 py-2 border">일자</th>
                                            <th className="text-right px-2 py-2 border">금액</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {detail.rows.length === 0 ? (
                                            <tr>
                                              <td className="px-2 py-2 border text-slate-500" colSpan={5}>
                                                데이터 없음
                                              </td>
                                            </tr>
                                          ) : (
                                            detail.rows.map((row, idx) => (
                                              <tr key={`card-row-${idx}`} className="bg-white">
                                                <td className="px-2 py-2 border text-slate-800 font-medium">{row.subject}</td>
                                                <td className="px-2 py-2 border">{row.label}</td>
                                                <td className="px-2 py-2 border">{row.note ?? '-'}</td>
                                                <td className="px-2 py-2 border">{row.date ?? '-'}</td>
                                                <td className="px-2 py-2 border text-right">{formatCurrency(row.amount)}</td>
                                              </tr>
                                            ))
                                          )}
                                        </tbody>
                                      </table>
                                    </div>

                                    <div className="mt-3 text-sm">
                                      <div className="flex items-center justify-between mt-1">
                                        <div className="text-slate-600">총금액</div>
                                        <div className="font-bold text-slate-900">{formatCurrency(detail.totalAmount)}원</div>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {detail.kind === 'expense_aggregate' && (
                                  <div>
                                    <div className="text-sm font-semibold text-slate-800">경비 상세</div>
                                    <div className="text-xs text-slate-500 mt-1">
                                      차량·숙소·카드·경비 청구 공제 항목 합계 기준
                                    </div>

                                    <div className="mt-3 overflow-auto">
                                      <table className="w-full text-xs border-collapse">
                                        <thead>
                                          <tr className="bg-slate-50 text-slate-600">
                                            <th className="text-left px-2 py-2 border">구분</th>
                                            <th className="text-left px-2 py-2 border">대상</th>
                                            <th className="text-left px-2 py-2 border">항목</th>
                                            <th className="text-left px-2 py-2 border">비고</th>
                                            <th className="text-right px-2 py-2 border">금액</th>
                                            <th className="text-center px-2 py-2 border whitespace-nowrap">더상세</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {detail.rows.length === 0 ? (
                                            <tr>
                                              <td className="px-2 py-2 border text-slate-500" colSpan={6}>
                                                데이터 없음
                                              </td>
                                            </tr>
                                          ) : (
                                            detail.rows.map((row, idx) => {
                                              const hasMoreDetail = row.details.length > 0;
                                              const isMoreDetailExpanded = expandedExpenseDetailKeys.has(row.key);
                                              return (
                                                <React.Fragment key={`expense-aggregate-row-${row.key}-${idx}`}>
                                                  <tr className="bg-white">
                                                    <td className="px-2 py-2 border text-slate-800 font-medium">{row.originLabel}</td>
                                                    <td className="px-2 py-2 border">{row.subject}</td>
                                                    <td className="px-2 py-2 border">{row.category}</td>
                                                    <td className="px-2 py-2 border">{row.memo || '-'}</td>
                                                    <td className="px-2 py-2 border text-right">{formatCurrency(row.amount)}</td>
                                                    <td className="px-2 py-2 border text-center">
                                                      {hasMoreDetail ? (
                                                        <button
                                                          type="button"
                                                          className={ghostButtonClassName}
                                                          onClick={() => toggleExpenseDetailExpanded(row.key)}
                                                        >
                                                          {isMoreDetailExpanded ? '닫기' : '더상세'}
                                                        </button>
                                                      ) : (
                                                        <span className="text-slate-400">-</span>
                                                      )}
                                                    </td>
                                                  </tr>

                                                  {hasMoreDetail && isMoreDetailExpanded && (
                                                    <tr className="bg-slate-50">
                                                      <td className="px-3 py-3 border" colSpan={6}>
                                                        <div className="rounded-md border bg-white p-3">
                                                          <div className="text-xs font-semibold text-slate-700">
                                                            {row.originLabel}별 경비
                                                          </div>
                                                          <div className="mt-2 overflow-auto">
                                                            <table className="w-full text-xs border-collapse">
                                                              <thead>
                                                                <tr className="bg-slate-50 text-slate-600">
                                                                  <th className="text-left px-2 py-2 border">대상</th>
                                                                  <th className="text-left px-2 py-2 border">항목</th>
                                                                  <th className="text-left px-2 py-2 border">비고</th>
                                                                  <th className="text-right px-2 py-2 border">세부</th>
                                                                  <th className="text-right px-2 py-2 border">금액</th>
                                                                </tr>
                                                              </thead>
                                                              <tbody>
                                                                {row.details.map((child, childIdx) => (
                                                                  <tr key={`expense-aggregate-child-${row.key}-${childIdx}`} className="bg-white">
                                                                    <td className="px-2 py-2 border">{child.subject || child.label}</td>
                                                                    <td className="px-2 py-2 border">{child.category || '-'}</td>
                                                                    <td className="px-2 py-2 border">{child.note || '-'}</td>
                                                                    <td className="px-2 py-2 border text-right">{child.allocation || '-'}</td>
                                                                    <td className="px-2 py-2 border text-right">{formatCurrency(child.amount)}</td>
                                                                  </tr>
                                                                ))}
                                                              </tbody>
                                                            </table>
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

                                    <div className="mt-3 text-sm">
                                      <div className="flex items-center justify-between mt-1">
                                        <div className="text-slate-600">총금액</div>
                                        <div className="font-bold text-slate-900">{formatCurrency(detail.totalAmount)}원</div>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {detail.kind === 'team_expense_claim' && (
                                  <div>
                                    <div className="text-sm font-semibold text-slate-800">경비 차감 상세</div>
                                    <div className="text-xs text-slate-500 mt-1">
                                      청구완료/정산완료 경비내역 기준
                                    </div>

                                    <div className="mt-3 overflow-auto">
                                      <table className="w-full text-xs border-collapse">
                                        <thead>
                                          <tr className="bg-slate-50 text-slate-600">
                                            <th className="text-left px-2 py-2 border">일자</th>
                                            <th className="text-left px-2 py-2 border">상대/대상</th>
                                            <th className="text-left px-2 py-2 border">항목</th>
                                            <th className="text-left px-2 py-2 border">비고</th>
                                            <th className="text-right px-2 py-2 border">금액</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {detail.rows.length === 0 ? (
                                            <tr>
                                              <td className="px-2 py-2 border text-slate-500" colSpan={5}>
                                                데이터 없음
                                              </td>
                                            </tr>
                                          ) : (
                                            detail.rows.map((row, idx) => (
                                              <tr key={`team-expense-row-${idx}`} className="bg-white">
                                                <td className="px-2 py-2 border">{row.date || '-'}</td>
                                                <td className="px-2 py-2 border text-slate-800 font-medium">{row.subject}</td>
                                                <td className="px-2 py-2 border">{row.label}</td>
                                                <td className="px-2 py-2 border">{row.note || '-'}</td>
                                                <td className="px-2 py-2 border text-right">{formatCurrency(row.amount)}</td>
                                              </tr>
                                            ))
                                          )}
                                        </tbody>
                                      </table>
                                    </div>

                                    <div className="mt-3 text-sm">
                                      <div className="flex items-center justify-between mt-1">
                                        <div className="text-slate-600">총금액</div>
                                        <div className="font-bold text-slate-900">{formatCurrency(detail.totalAmount)}원</div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>

            <div id="settlement-additions" className="mt-6 scroll-mt-36">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-bold text-slate-900"><span className="mr-2 text-blue-600">03</span>추가</h2>
                  <div className="text-xs text-slate-500 mt-0.5">공제와 반대로 (+) 더해지는 항목</div>
                </div>
                <button type="button" className={addButtonClassName} onClick={handleAddManualAddition} disabled={!canEdit}>
                  + 수기 추가
                </button>
              </div>

              <div className="mt-3 overflow-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600">
                      <th className="text-left px-2 py-2 border">구분</th>
                      <th className="text-left px-2 py-2 border">항목</th>
                      <th className="text-right px-2 py-2 border">금액</th>
                      <th className="text-left px-2 py-2 border">비고</th>
                      <th className="text-center px-2 py-2 border whitespace-nowrap">상세</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(doc.additions ?? []).length === 0 ? (
                      <EmptySettlementTableRow colSpan={5} message="추가 항목이 없습니다. 필요한 경우 수기 추가를 사용해 주세요." />
                    ) : (doc.additions ?? []).map((item) => {
                      const editableRow = canEdit && item.source === 'manual';
                      return (
                        <tr key={item.id} className={item.source === 'auto' ? 'bg-white' : 'bg-emerald-50'}>
                          <td className="px-2 py-2 border text-slate-700">{formatAdditionOrigin(item.origin)}</td>
                          <td className="px-2 py-2 border">
                            <input
                              className="w-full border rounded px-2 py-1"
                              value={item.category}
                              disabled={!editableRow}
                              onChange={(e) => {
                                const next = e.target.value;
                                updateDoc((prev) => ({
                                  ...prev,
                                  additions: (prev.additions ?? []).map((x) => (x.id === item.id ? { ...x, category: next } : x))
                                }));
                              }}
                            />
                          </td>
                          <td className="px-2 py-2 border text-right">
                            <CurrencyInput
                              className="w-full border rounded px-2 py-1 text-right"
                              value={item.amount}
                              disabled={!editableRow}
                              onChange={(n) => {
                                updateDoc((prev) => ({
                                  ...prev,
                                  additions: (prev.additions ?? []).map((x) => (x.id === item.id ? { ...x, amount: n } : x))
                                }));
                              }}
                            />
                          </td>
                          <td className="px-2 py-2 border">
                            <input
                              className="w-full border rounded px-2 py-1"
                              value={item.memo ?? ''}
                              disabled={!editableRow}
                              onChange={(e) => {
                                const next = e.target.value;
                                updateDoc((prev) => ({
                                  ...prev,
                                  additions: (prev.additions ?? []).map((x) => (x.id === item.id ? { ...x, memo: next } : x))
                                }));
                              }}
                            />
                          </td>
                          <td className="px-2 py-2 border text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                className={ghostButtonClassName}
                                onClick={() => {
                                  Swal.fire({
                                    title: '추가 상세',
                                    html: `<div style="text-align:left; font-size:12px;">
                                      <div><b>항목</b>: ${String(item.category ?? '')}</div>
                                      <div style="margin-top:4px;"><b>금액</b>: ${formatCurrency(safeNumber(item.amount))}원</div>
                                      <div style="margin-top:4px;"><b>비고</b>: ${String(item.memo ?? '') || '-'}</div>
                                    </div>`,
                                    confirmButtonText: '닫기'
                                  });
                                }}
                              >
                                상세
                              </button>
                              <button
                                type="button"
                                className="px-2 py-1 rounded border bg-white text-slate-700 disabled:opacity-50"
                                disabled={!editableRow}
                                onClick={() => {
                                  updateDoc((prev) => ({
                                    ...prev,
                                    additions: (prev.additions ?? []).filter((x) => x.id !== item.id)
                                  }));
                                }}
                              >
                                삭제
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div id="settlement-finalize" className="mt-5 scroll-mt-36 space-y-3 border-t border-slate-200 pt-5">
              <div>
                <h2 className="font-bold text-slate-900"><span className="mr-2 text-blue-600">04</span>최종 조정</h2>
                <p className="mt-0.5 text-xs text-slate-500">평균 단가와 이월·입금 조정을 확인한 뒤 상단에서 확정합니다.</p>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="text-slate-600">공제 합계</div>
                <div className="font-bold text-slate-800">{formatCurrency(totals.deductionsTotal)}원</div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="text-slate-600">추가 합계</div>
                <div className="font-bold text-slate-800">{formatCurrency(totals.additionsTotal)}원</div>
              </div>

              <div className="rounded-lg border bg-slate-50 px-3 py-3">
                <div className="text-sm font-semibold text-slate-800">평균 단가</div>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center justify-between">
                    <div className="text-slate-600">팀 평균단가 (원/공수)</div>
                    <div className="font-bold text-slate-900">{formatAverageCurrency(avgUnitPrice.teamAvgPerManDay)}</div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-slate-600">현장 평균단가 (원/공수)</div>
                    <div className="font-bold text-slate-900">{formatAverageCurrency(avgUnitPrice.siteAvgPerManDay)}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border bg-white px-3 py-3">
                <div className="text-sm font-semibold text-slate-800">현장별 쓰꾸미</div>
                <div className="mt-2 overflow-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600">
                        <th className="text-left px-2 py-2 border">현장</th>
                        <th className="text-right px-2 py-2 border">공수</th>
                        <th className="text-right px-2 py-2 border">금액</th>
                        <th className="text-right px-2 py-2 border">쓰꾸미(원/공수)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {siteSkkumiRows.length === 0 ? (
                        <tr>
                          <td className="px-2 py-2 border text-slate-500" colSpan={4}>
                            데이터 없음
                          </td>
                        </tr>
                      ) : (
                        siteSkkumiRows.map((r) => {
                          const skkumi = safeAverage(r.amount, r.manDay);

                          return (
                            <tr key={r.siteName} className="bg-white">
                              <td className="px-2 py-2 border text-slate-800 font-medium">{r.siteName}</td>
                              <td className="px-2 py-2 border text-right">{formatManDay1(r.manDay)}</td>
                              <td className="px-2 py-2 border text-right">{formatCurrency(r.amount)}</td>
                              <td className="px-2 py-2 border text-right">{formatAverageCurrency(skkumi)}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-600" htmlFor="team-settlement-prev-carryover">전월 이월</label>
                  <CurrencyInput
                    id="team-settlement-prev-carryover"
                    inputMode="numeric"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-right focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    value={totals.prevCarryover}
                    disabled={!canEdit}
                    onChange={(n) => {
                      updateDoc((prev) => ({
                        ...prev,
                        summary: { ...prev.summary, prevCarryover: n }
                      }));
                    }}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600" htmlFor="team-settlement-deposit-adjustment">입금/정산조정</label>
                  <CurrencyInput
                    id="team-settlement-deposit-adjustment"
                    inputMode="numeric"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-right focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    value={totals.deposit}
                    disabled={!canEdit}
                    onChange={(n) => {
                      updateDoc((prev) => ({
                        ...prev,
                        summary: { ...prev.summary, deposit: n }
                      }));
                    }}
                  />
                </div>
              </div>

              <div className="rounded-lg bg-slate-900 text-white px-3 py-3 flex items-center justify-between">
                <div className="font-semibold">정산 잔액</div>
                <div className="text-xl font-bold">{formatCurrency(totals.net)}원</div>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default TeamSettlementPage;
