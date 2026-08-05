import {
  createSystemConfig,
  listSystemConfigs,
  updateSystemConfig,
  type CreateSystemConfigVariables,
  type UpdateSystemConfigVariables
} from '../services/firestoreCrudCompat';
import { accommodationBillingService } from './accommodationBillingService';
import { accommodationAssignmentService } from './accommodationAssignmentService';
import { accommodationService } from './accommodationService';
import { cardBillingService } from './cardBillingService';
import { cardService } from './cardService';
import { companyService } from './companyService';
import { dailyReportService } from './dailyReportService';
import { manpowerService } from './manpowerService';
import { siteService, type Site } from './siteService';
import { supportClientSiteAllocationService, type SupportClientAllocation } from './supportClientSiteAllocationService';
import { supportRateService } from './supportRateService';
import { teamExpenseLedgerService } from './teamExpenseLedgerService';
import { teamService } from './teamService';
import { vehicleBillingService } from './vehicleBillingService';
import { vehicleService } from './vehicleService';
import { isSupportBillingMonthEnabled } from '../utils/supportBillingPeriod';
import { selectPreferredSettlementBillings } from '../utils/supportSettlementBilling';
import {
  TeamSettlementDocumentSchema,
  type TeamSettlementAdditionItem,
  type TeamSettlementDeductionItem,
  type TeamSettlementDocument,
  type TeamSettlementPurchaseItem,
  type TeamSettlementSalesItem
} from '../types/teamSettlement';
import type { TeamExpenseClaim, TeamExpenseClaimCategory } from '../types/teamExpenseLedger';

const SYSTEM_CONFIG_ID_PREFIX = 'team_settlement_';

export type TeamSettlementSupportDirection = '내부지원간곳' | '내부지원온곳' | '외부지원간곳' | '외부지원온곳';

export type TeamSettlementSupportDetailRow = {
  id: string;
  direction: TeamSettlementSupportDirection;
  date: string;
  siteId?: string;
  siteName: string;
  counterTeamId?: string;
  counterTeamName?: string;
  workerId: string;
  workerName: string;
  workerTeamId?: string;
  workerTeamName?: string;
  manDay: number;
  unitPrice: number;
  amount: number;
};

type SystemConfigRow = {
  id?: unknown;
  data?: unknown;
};

const safeJsonParse = <T,>(value: string): T | null => {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

const toFiniteNumberOrZero = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const cleaned = value.replace(/,/g, '').trim();
    if (!cleaned) return 0;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

const normalizeLookupKey = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .replace(/\s+/g, '')
    .toLowerCase();

const isUuidString = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const SUPPORT_RATE_OVERRIDE_STORAGE_PREFIX = 'support-team-payment-rate-overrides-v1';

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

const normalizeSupportIdentity = (value: unknown): string =>
  String(value ?? '').replace(/\(.*?\)/g, '').replace(/\s+/g, '').trim();

const getSupportRateOverrideStorageKey = (yearMonth: string): string =>
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

const calculateSupportLaborAmount = (manDay: number, supportUnitPrice: number): number =>
  Math.round(Math.max(0, manDay) * Math.max(0, Math.round(supportUnitPrice)));

const DEFAULT_SUPPORT_UNIT_PRICE = 230000;
const CHEONGYEON_COMPANY_NAME_KEYS = [normalizeSupportIdentity('청연이엔지'), normalizeSupportIdentity('청연')].filter(Boolean);

const isCheongyeonCompanyName = (value?: string | null): boolean => {
  const normalized = normalizeSupportIdentity(value);
  if (!normalized) return false;
  return CHEONGYEON_COMPANY_NAME_KEYS.some((key) =>
    normalized.includes(key) || (normalized.length >= 2 && key.includes(normalized))
  );
};

const normalizeSupportSalaryModel = (value: unknown): string => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (raw.includes('지원')) return '지원팀';
  if (raw.includes('월급')) return '월급제';
  if (raw.includes('일급')) return '일급제';
  if (raw.includes('용역')) return '용역팀';
  return raw;
};

const isSameTeamIdentity = (
  leftTeamId?: string | null,
  leftTeamName?: string | null,
  rightTeamId?: string | null,
  rightTeamName?: string | null
): boolean => {
  const leftKeys = [normalizeSupportIdentity(leftTeamId), normalizeSupportIdentity(leftTeamName)].filter(Boolean);
  const rightKeys = [normalizeSupportIdentity(rightTeamId), normalizeSupportIdentity(rightTeamName)].filter(Boolean);
  return leftKeys.length > 0 && rightKeys.length > 0 && leftKeys.some((key) => rightKeys.includes(key));
};

const normalizeSupportRateOverrides = (value: Partial<SupportMonthlyRateOverrides> | undefined): SupportMonthlyRateOverrides => {
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

const loadSupportRateOverrides = (yearMonth: string): SupportMonthlyRateOverrides => {
  if (typeof window === 'undefined' || !yearMonth) return normalizeSupportRateOverrides(undefined);
  try {
    const raw = window.localStorage.getItem(getSupportRateOverrideStorageKey(yearMonth));
    if (!raw) return normalizeSupportRateOverrides(undefined);
    return normalizeSupportRateOverrides(JSON.parse(raw) as Partial<SupportMonthlyRateOverrides>);
  } catch {
    return normalizeSupportRateOverrides(undefined);
  }
};

const getSupportSettlementMergeKey = (direction: string, settlementTeamId?: string, settlementTeamName?: string): string => [
  direction,
  normalizeSupportIdentity(settlementTeamId) || normalizeSupportIdentity(settlementTeamName) || 'unknown-settlement'
].join('::');

const getSupportAggregateId = (direction: string, viewTeamId?: string, viewTeamName?: string, settlementTeamId?: string, settlementTeamName?: string): string => [
  direction,
  normalizeSupportIdentity(viewTeamId) || normalizeSupportIdentity(viewTeamName) || 'unknown-view',
  normalizeSupportIdentity(settlementTeamId) || normalizeSupportIdentity(settlementTeamName) || 'unknown'
].join('::');

const getSupportMonthlySiteRateKey = (aggregateId: string, siteId: string): string => `${aggregateId}::${siteId}`;

type SupportRateLookupContext = {
  direction: string;
  viewTeamId?: string;
  viewTeamName?: string;
  settlementTeamId?: string;
  settlementTeamName?: string;
};

const resolveSupportUnitRate = (params: {
  overrides: SupportMonthlyRateOverrides;
  baseRate: number;
  contexts: SupportRateLookupContext[];
  siteId?: string;
}): number => {
  const positiveBaseRate = toPositiveRate(params.baseRate) ?? 0;
  const siteId = normalizeSupportIdentity(params.siteId);
  const uniqueKeys = (values: string[]): string[] => Array.from(new Set(values.filter(Boolean)));
  const lookupContexts = params.contexts.filter((context) => context.direction);
  const teamRateKeys = uniqueKeys(lookupContexts.map((context) =>
    getSupportSettlementMergeKey(context.direction, context.settlementTeamId, context.settlementTeamName)
  ));
  const aggregateIds = uniqueKeys(lookupContexts.map((context) =>
    getSupportAggregateId(
      context.direction,
      context.viewTeamId,
      context.viewTeamName,
      context.settlementTeamId,
      context.settlementTeamName
    )
  ));
  const mergedAggregateIds = teamRateKeys.map((key) => `merged::${key}`);

  if (siteId) {
    const siteRateKeys = [...teamRateKeys, ...aggregateIds, ...mergedAggregateIds]
      .map((key) => getSupportMonthlySiteRateKey(key, siteId));
    for (const key of siteRateKeys) {
      const rate = toPositiveRate(params.overrides.supportSiteRates[key]);
      if (rate) return rate;
    }
  }

  for (const key of [...aggregateIds, ...mergedAggregateIds]) {
    const rate = toPositiveRate(params.overrides.supportAggregateRates[key]);
    if (rate) return rate;
  }

  for (const key of teamRateKeys) {
    const rate = toPositiveRate(params.overrides.supportTeamRates[key]);
    if (rate) return rate;
  }

  return toPositiveRate(params.overrides.bulkSupportRate) ?? positiveBaseRate;
};

const buildSystemConfigId = (params: { yearMonth: string; teamId: string }): string => {
  return `${SYSTEM_CONFIG_ID_PREFIX}${params.yearMonth}__${params.teamId}`;
};

const getMonthRange = (yearMonth: string): { startDate: string; endDate: string; year: number; month: number } => {
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

  return { startDate: toIsoDate(start), endDate: toIsoDate(end), year: safeYear, month: safeMonth };
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

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const selectPreferredTeamBillings = <T extends { status?: unknown }>(
  docs: T[],
  additionalPosted?: (doc: T) => boolean
): T[] => {
  return selectPreferredSettlementBillings(docs, additionalPosted);
};

const allowUnconfirmedLedgerFallback = false;

const isVehicleLedgerClaim = (doc: { lineItems?: Array<{ sourceType?: unknown }> }): boolean =>
  (doc.lineItems ?? []).some((item) => String(item.sourceType ?? '') === 'vehicle_ledger');

const isAccommodationLedgerClaim = (doc: { lineItems?: Array<{ sourceType?: unknown }> }): boolean =>
  (doc.lineItems ?? []).some((item) => String(item.sourceType ?? '') === 'utility_ledger');

const isCardLedgerClaim = (doc: { lineItems?: Array<{ sourceType?: unknown }> }): boolean =>
  (doc.lineItems ?? []).some((item) => String(item.sourceType ?? '') === 'card_ledger');

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

const isPostedTeamExpenseClaim = (claim: TeamExpenseClaim): boolean => {
  return claim.status === 'charged' || claim.status === 'settled';
};

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

const buildTeamIdVariants = async (teamId: string): Promise<{ canonicalTeamId: string; teamName: string; variants: Set<string> }> => {
  const raw = String(teamId);
  const variants = new Set<string>();
  const addVariant = (value: unknown) => {
    const trimmed = String(value ?? '').trim();
    if (!trimmed) return;
    variants.add(trimmed);
    const normalized = normalizeSupportIdentity(trimmed);
    if (normalized) variants.add(normalized);
  };

  addVariant(raw);

  let canonicalTeamId = raw;
  let teamName = '';

  try {
    const teams = await teamService.getTeams();
    const matched = teams.find((t) => String(t.id ?? '') === raw || String(t.legacyId ?? '') === raw);
    if (matched?.id) canonicalTeamId = String(matched.id);
    addVariant(matched?.legacyId);
    addVariant(matched?.id);
    addVariant(matched?.name);
    teamName = matched?.name ?? '';
  } catch {
    // ignore
  }

  return { canonicalTeamId, teamName, variants };
};

const extractSystemConfigRows = (value: unknown): SystemConfigRow[] => {
  if (!value || typeof value !== 'object') return [];
  const root = value as { data?: unknown };
  const data = root.data;
  if (!data || typeof data !== 'object') return [];
  const obj = data as { systemConfigs?: unknown };
  const rows = obj.systemConfigs;
  if (!Array.isArray(rows)) return [];
  return rows as SystemConfigRow[];
};

const SUPPORT_SALES_ORIGINS = ['support_outgoing', 'support_fee_outgoing', '내부지원간곳', '외부지원간곳'];
const SUPPORT_PURCHASE_ORIGINS = ['support_incoming', 'support_fee_incoming', '내부지원온곳', '외부지원온곳'];
const SUPPORT_SALES_SETTLEMENT_ORIGINS = ['support_fee_outgoing', '내부지원간곳', '외부지원간곳'];
const SUPPORT_PURCHASE_SETTLEMENT_ORIGINS = ['support_fee_incoming', '내부지원온곳', '외부지원온곳'];

type SupportSettlementOrigin = TeamSettlementSupportDirection;

const isSupportSalesOrigin = (origin: unknown): boolean => SUPPORT_SALES_ORIGINS.includes(String(origin));
const isSupportPurchaseOrigin = (origin: unknown): boolean => SUPPORT_PURCHASE_ORIGINS.includes(String(origin));
const isSupportSalesSettlementOrigin = (origin: unknown): boolean => SUPPORT_SALES_SETTLEMENT_ORIGINS.includes(String(origin));
const isSupportPurchaseSettlementOrigin = (origin: unknown): boolean => SUPPORT_PURCHASE_SETTLEMENT_ORIGINS.includes(String(origin));

const toSupportSalesOrigin = (direction: SupportSettlementOrigin): TeamSettlementSalesItem['origin'] =>
  direction === '내부지원간곳' ? '내부지원간곳' : '외부지원간곳';

const toSupportPurchaseOrigin = (direction: SupportSettlementOrigin): TeamSettlementPurchaseItem['origin'] =>
  direction === '내부지원온곳' ? '내부지원온곳' : '외부지원온곳';

const stripSupportOriginalLines = (doc: TeamSettlementDocument): TeamSettlementDocument => {
  return {
    ...doc,
    sales: (doc.sales ?? []).filter((s) => s.origin !== 'support_outgoing'),
    purchases: (doc.purchases ?? []).filter((p) => p.origin !== 'support_incoming')
  };
};

const mergeLatestSupportAutoLines = (params: {
  baseDoc: TeamSettlementDocument;
  autoDoc: TeamSettlementDocument;
}): TeamSettlementDocument => {
  const { baseDoc, autoDoc } = params;
  const latestSupportSales = autoDoc.sales.filter((item) =>
    item.source === 'auto' && isSupportSalesSettlementOrigin(item.origin)
  );
  const latestSupportPurchases = autoDoc.purchases.filter((item) =>
    item.source === 'auto' && isSupportPurchaseSettlementOrigin(item.origin)
  );

  return {
    ...baseDoc,
    teamName: baseDoc.teamName || autoDoc.teamName,
    sales: [
      ...baseDoc.sales.filter((item) =>
        !(item.source === 'auto' && isSupportSalesOrigin(item.origin))
      ),
      ...latestSupportSales
    ],
    purchases: [
      ...baseDoc.purchases.filter((item) =>
        !(item.source === 'auto' && isSupportPurchaseOrigin(item.origin))
      ),
      ...latestSupportPurchases
    ]
  };
};

const mergeAutoAndDraft = (params: { autoDoc: TeamSettlementDocument; savedDoc: TeamSettlementDocument | null }): TeamSettlementDocument => {
  const { autoDoc, savedDoc } = params;
  if (!savedDoc) return autoDoc;
  if (savedDoc.confirmedAt) {
    return mergeLatestSupportAutoLines({ baseDoc: stripSupportOriginalLines(savedDoc), autoDoc });
  }

  const savedSalesById = new Map(savedDoc.sales.map((x) => [x.id, x] as const));
  const patchedAutoSales = autoDoc.sales.map((autoItem) => {
    const saved = savedSalesById.get(autoItem.id);
    if (!saved) return autoItem;

    const nextQuantity = typeof saved.quantity === 'number' && Number.isFinite(saved.quantity) ? saved.quantity : autoItem.quantity;
    const hasAmountOverride = saved.amountOverridden === true;
    const nextMemo = typeof saved.memo === 'string' && saved.memo.trim() ? saved.memo : autoItem.memo;

    return {
      ...autoItem,
      quantity: nextQuantity,
      amount: hasAmountOverride ? saved.amount : autoItem.amount,
      amountOverridden: hasAmountOverride ? true : undefined,
      memo: nextMemo
    };
  });

  return {
    ...autoDoc,
    sales: [...patchedAutoSales, ...savedDoc.sales.filter((x) => x.source === 'manual')],
    purchases: [...autoDoc.purchases, ...savedDoc.purchases.filter((x) => x.source === 'manual')],
    deductions: [...autoDoc.deductions, ...savedDoc.deductions.filter((x) => x.source === 'manual')],
    additions: [
      ...(autoDoc.additions ?? []),
      ...((savedDoc.additions ?? []) as TeamSettlementAdditionItem[]).filter((x) => x.source === 'manual')
    ],
    summary: savedDoc.summary,
    confirmedAt: null,
    updatedAt: new Date().toISOString()
  };
};

const didUpdateSystemConfig = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') return false;
  const root = value as { data?: unknown };
  if (!root.data || typeof root.data !== 'object') return false;
  const data = root.data as { systemConfig_update?: unknown };
  return data.systemConfig_update != null;
};

const notifyTeamSettlementSystemMessage = async (
  event: 'teamSettlement.confirmed' | 'teamSettlement.unconfirmed',
  doc: TeamSettlementDocument
): Promise<void> => {
  try {
    const { systemMessageService } = await import('./systemMessageService');
    await systemMessageService.notifyTeamSettlementEvent(event, doc);
  } catch (error) {
    console.warn('[teamSettlementService] system message notification failed:', error);
  }
};

export const teamSettlementService = {
  async getSupportSettlementDetailRows(params: { yearMonth: string; teamId: string }): Promise<TeamSettlementSupportDetailRow[]> {
    const team = await buildTeamIdVariants(params.teamId);
    const period = getMonthRange(params.yearMonth);

    const [sites, teams, companies, reports, supportRates] = await Promise.all([
      siteService.getSites(),
      teamService.getTeams(),
      companyService.getCompanies(),
      dailyReportService.getReportsByRange(period.startDate, period.endDate),
      supportRateService.getAllSiteRates()
    ]);

    const matchesTeam = (value: unknown): boolean => {
      if (typeof value !== 'string') return false;
      const trimmed = value.trim();
      if (!trimmed) return false;
      const normalized = normalizeSupportIdentity(trimmed);
      if (team.variants.has(trimmed) || (normalized && team.variants.has(normalized))) return true;
      if (isUuidString(trimmed)) return trimmed === team.canonicalTeamId;
      return false;
    };

    const teamByAnyId = new Map<string, (typeof teams)[number]>();
    const teamByName = new Map<string, (typeof teams)[number]>();
    const setTeamIdLookup = (key: unknown, teamRow: (typeof teams)[number]) => {
      const trimmed = String(key ?? '').trim();
      if (!trimmed) return;
      teamByAnyId.set(trimmed, teamRow);
      const normalized = normalizeSupportIdentity(trimmed);
      if (normalized) teamByAnyId.set(normalized, teamRow);
    };
    teams.forEach((t) => {
      setTeamIdLookup(t?.id, t);
      setTeamIdLookup(t?.legacyId, t);
      const nameKey = normalizeSupportIdentity(t?.name);
      if (nameKey && !teamByName.has(nameKey)) teamByName.set(nameKey, t);
    });

    const companyByAnyId = new Map<string, (typeof companies)[number]>();
    const setCompanyIdLookup = (key: unknown, companyRow: (typeof companies)[number]) => {
      const trimmed = String(key ?? '').trim();
      if (!trimmed) return;
      companyByAnyId.set(trimmed, companyRow);
      const normalized = normalizeSupportIdentity(trimmed);
      if (normalized) companyByAnyId.set(normalized, companyRow);
    };
    companies.forEach((company) => {
      setCompanyIdLookup(company?.id, company);
      setCompanyIdLookup(company?.legacyId, company);
    });

    const siteByAnyId = new Map<string, Site>();
    const siteByName = new Map<string, Site>();
    const setSiteIdLookup = (key: unknown, siteRow: Site) => {
      const trimmed = String(key ?? '').trim();
      if (!trimmed) return;
      siteByAnyId.set(trimmed, siteRow);
      const normalized = normalizeSupportIdentity(trimmed);
      if (normalized) siteByAnyId.set(normalized, siteRow);
    };
    sites.forEach((s) => {
      setSiteIdLookup(s?.id, s);
      setSiteIdLookup(s?.legacyId, s);
      if (s?.name) siteByName.set(String(s.name), s);
    });

    const resolveSite = (siteId?: string, siteName?: string): Site | null => {
      const idKey = siteId ? String(siteId).trim() : '';
      const nameKey = siteName ? String(siteName).trim() : '';
      if (idKey) {
        const byId = siteByAnyId.get(idKey) ?? siteByAnyId.get(normalizeSupportIdentity(idKey));
        if (byId) return byId;
      }
      if (nameKey && siteByName.has(nameKey)) return siteByName.get(nameKey) ?? null;
      return null;
    };

    const supportRateBySiteId = new Map<string, number>();
    const supportRateBySiteName = new Map<string, number>();
    supportRates.forEach((rate) => {
      const configuredRate = toPositiveRate(rate.defaultRate);
      if (!configuredRate) return;
      const siteId = normalizeLookupKey(rate.siteId || rate.id);
      const siteName = normalizeLookupKey(rate.siteName);
      if (siteId) supportRateBySiteId.set(siteId, configuredRate);
      if (siteName) supportRateBySiteName.set(siteName, configuredRate);
    });

    const resolveConfiguredSiteRate = (siteId?: string | null, siteName?: string | null): number | null => {
      const normalizedSiteId = normalizeLookupKey(siteId);
      if (normalizedSiteId) {
        const direct = supportRateBySiteId.get(normalizedSiteId);
        if (direct) return direct;
        const site = resolveSite(String(siteId ?? ''), String(siteName ?? ''));
        const byResolvedName = site ? supportRateBySiteName.get(normalizeLookupKey(site.name)) : undefined;
        if (byResolvedName) return byResolvedName;
      }
      const normalizedSiteName = normalizeLookupKey(siteName);
      return normalizedSiteName ? (supportRateBySiteName.get(normalizedSiteName) ?? null) : null;
    };

    const findTeamByIdentity = (teamId?: string | null, teamName?: string | null): (typeof teams)[number] | undefined => {
      const idKey = String(teamId ?? '').trim();
      if (idKey) {
        const byId = teamByAnyId.get(idKey) ?? teamByAnyId.get(normalizeSupportIdentity(idKey));
        if (byId) return byId;
      }
      const nameKey = normalizeSupportIdentity(teamName);
      return nameKey ? teamByName.get(nameKey) : undefined;
    };

    const isCheongyeonCompany = (companyId?: string | null, companyName?: string | null): boolean => {
      const idKey = String(companyId ?? '').trim();
      if (idKey) {
        const company = companyByAnyId.get(idKey) ?? companyByAnyId.get(normalizeSupportIdentity(idKey));
        if (company?.isMyCompany) return true;
        if (isCheongyeonCompanyName(company?.name)) return true;
      }
      return isCheongyeonCompanyName(companyName);
    };

    const isCheongyeonTeamIdentity = (
      teamRow?: (typeof teams)[number],
      teamId?: string | null,
      teamName?: string | null
    ): boolean => {
      const resolved = teamRow ?? findTeamByIdentity(teamId, teamName);
      if (!resolved) return false;
      const companyId = String(resolved.companyId ?? '').trim();
      const companyName = String(resolved.companyName ?? (companyId ? companyByAnyId.get(companyId)?.name : '') ?? '').trim();
      return isCheongyeonCompany(companyId, companyName);
    };

    type ClassifiedSupportEntry = {
      direction: TeamSettlementSupportDirection;
      viewTeamId?: string;
      viewTeamName?: string;
      settlementTeamId?: string;
      settlementTeamName?: string;
      counterTeamId?: string;
      counterTeamName?: string;
    };

    const rows: TeamSettlementSupportDetailRow[] = [];
    reports.forEach((report) => {
      const rawSiteId = String(report.siteId ?? '').trim();
      const rawSiteName = String(report.siteName ?? '').trim() || '현장 미지정';
      const site = resolveSite(rawSiteId, rawSiteName);
      const siteId = site?.id ? String(site.id) : (rawSiteId || undefined);
      const siteName = site?.name ? String(site.name) : rawSiteName;

      const siteConstructorCompanyId = String(site?.constructorCompanyId ?? site?.companyId ?? report.constructorCompanyId ?? report.companyId ?? '').trim();
      const siteConstructorCompanyName = String(site?.constructorCompanyName ?? site?.companyName ?? report.constructorCompanyName ?? report.companyName ?? '').trim();
      const siteIsCheongyeon = isCheongyeonCompany(siteConstructorCompanyId, siteConstructorCompanyName);

      (Array.isArray(report.workers) ? report.workers : []).forEach((reportWorker, workerIndex) => {
        const reportWorkerTeamId = String(reportWorker.teamId ?? '').trim();
        const reportWorkerTeamName = String(reportWorker.workerTeamName ?? '').trim();
        const fallbackSourceTeam = findTeamByIdentity(undefined, reportWorkerTeamName);
        const fallbackReportTeamId = reportWorkerTeamName ? '' : String(report.teamId ?? '').trim();
        const workerTeamId = reportWorkerTeamId || (fallbackSourceTeam?.id ? String(fallbackSourceTeam.id) : '') || fallbackReportTeamId;
        const resolvedSourceTeam = findTeamByIdentity(workerTeamId, reportWorkerTeamName) ?? fallbackSourceTeam;
        const sourceTeamId = String(
          resolvedSourceTeam?.id ??
          (reportWorkerTeamId || normalizeSupportIdentity(reportWorkerTeamName) || fallbackReportTeamId || '')
        ).trim();
        const sourceTeamName = String(
          resolvedSourceTeam?.name ??
          (reportWorkerTeamName || report.teamName || '팀 미지정')
        ).trim();
        const workerCompanyId = String(resolvedSourceTeam?.companyId ?? '').trim();
        const workerCompanyName = String(
          resolvedSourceTeam?.companyName ??
          (workerCompanyId ? companyByAnyId.get(workerCompanyId)?.name : '') ??
          ''
        ).trim();

        const targetTeamIdRaw = String(report.responsibleTeamId ?? site?.responsibleTeamId ?? report.teamId ?? '').trim();
        const targetTeamNameRaw = String(report.responsibleTeamName ?? site?.responsibleTeamName ?? report.teamName ?? '').trim();
        const resolvedTargetTeam = findTeamByIdentity(targetTeamIdRaw, targetTeamNameRaw);
        const targetTeamId = String(resolvedTargetTeam?.id ?? targetTeamIdRaw).trim();
        const targetTeamName = String(resolvedTargetTeam?.name ?? targetTeamNameRaw ?? '팀 미지정').trim();
        const targetCompanyId = String(resolvedTargetTeam?.companyId ?? siteConstructorCompanyId ?? report.companyId ?? '').trim();
        const targetCompanyName = String(resolvedTargetTeam?.companyName ?? siteConstructorCompanyName ?? report.companyName ?? '').trim();

        const workerIsCheongyeon = isCheongyeonTeamIdentity(resolvedSourceTeam, sourceTeamId, sourceTeamName);
        const targetIsCheongyeon = isCheongyeonTeamIdentity(resolvedTargetTeam, targetTeamId, targetTeamName);
        const isSameFieldAndWorkerTeam = isSameTeamIdentity(sourceTeamId, sourceTeamName, targetTeamId, targetTeamName);
        const normalizedSalary = normalizeSupportSalaryModel(reportWorker.salaryModel ?? reportWorker.payType);
        const isSupportModel = normalizedSalary === '지원팀';
        const isSupportTeam = normalizeSupportIdentity(resolvedSourceTeam?.type).includes('지원');

        const entries: ClassifiedSupportEntry[] = [];
        if (workerIsCheongyeon && targetIsCheongyeon && isSameFieldAndWorkerTeam) return;

        if (workerIsCheongyeon && targetIsCheongyeon && sourceTeamId && targetTeamId) {
          entries.push({
            direction: '내부지원간곳',
            viewTeamId: sourceTeamId,
            viewTeamName: sourceTeamName,
            settlementTeamId: sourceTeamId,
            settlementTeamName: sourceTeamName,
            counterTeamId: targetTeamId,
            counterTeamName: targetTeamName
          });
          entries.push({
            direction: '내부지원온곳',
            viewTeamId: targetTeamId,
            viewTeamName: targetTeamName,
            settlementTeamId: targetTeamId,
            settlementTeamName: targetTeamName,
            counterTeamId: sourceTeamId,
            counterTeamName: sourceTeamName
          });
        } else if (!siteIsCheongyeon && workerIsCheongyeon) {
          entries.push({
            direction: '외부지원간곳',
            viewTeamId: sourceTeamId,
            viewTeamName: sourceTeamName,
            settlementTeamId: targetTeamId || targetCompanyId,
            settlementTeamName: targetTeamName || targetCompanyName || siteConstructorCompanyName || '외부 시공사',
            counterTeamId: targetTeamId || targetCompanyId,
            counterTeamName: targetTeamName || targetCompanyName || siteConstructorCompanyName || '외부 현장'
          });
        } else if (siteIsCheongyeon && targetIsCheongyeon && !workerIsCheongyeon) {
          entries.push({
            direction: '외부지원온곳',
            viewTeamId: targetTeamId,
            viewTeamName: targetTeamName,
            settlementTeamId: sourceTeamId || workerCompanyId,
            settlementTeamName: sourceTeamName || workerCompanyName || '외부 지원팀',
            counterTeamId: sourceTeamId || workerCompanyId,
            counterTeamName: sourceTeamName || workerCompanyName || '외부 지원팀'
          });
        } else if (siteIsCheongyeon && targetIsCheongyeon && (isSupportModel || isSupportTeam)) {
          entries.push({
            direction: '외부지원온곳',
            viewTeamId: targetTeamId,
            viewTeamName: targetTeamName,
            settlementTeamId: sourceTeamId || workerCompanyId,
            settlementTeamName: sourceTeamName || workerCompanyName || '지원팀',
            counterTeamId: sourceTeamId || workerCompanyId,
            counterTeamName: sourceTeamName || workerCompanyName || '외부 지원팀'
          });
        }

        if (entries.length === 0) return;

        const rateSiteId = rawSiteId || siteId;
        const configuredSupportRate = resolveConfiguredSiteRate(rateSiteId, rawSiteName || siteName);
        const sourceTeamSupportRate = toPositiveRate(resolvedSourceTeam?.supportRate);
        const baseSupportRate = configuredSupportRate ?? sourceTeamSupportRate ?? toPositiveRate(reportWorker.unitPrice) ?? DEFAULT_SUPPORT_UNIT_PRICE;
        const manDay = toFiniteNumberOrZero(reportWorker.manDay);
        if (manDay <= 0) return;

        entries.forEach((entry) => {
          const isSelectedViewTeam = matchesTeam(String(entry.viewTeamId ?? '')) || isSameTeamIdentity(entry.viewTeamId, entry.viewTeamName, team.canonicalTeamId, team.teamName);
          if (!isSelectedViewTeam) return;

          const supportUnitPrice = resolveSupportUnitRate({
            overrides: loadSupportRateOverrides(params.yearMonth),
            baseRate: baseSupportRate,
            contexts: [entry],
            siteId: rateSiteId || siteName
          });

          rows.push({
            id: `${report.id ?? report.date}:${workerIndex}:${entry.direction}:${siteId ?? siteName}:${reportWorker.workerId ?? reportWorker.name ?? 'worker'}`,
            direction: entry.direction,
            date: report.date,
            siteId,
            siteName,
            counterTeamId: entry.counterTeamId,
            counterTeamName: entry.counterTeamName,
            workerId: String(reportWorker.workerId ?? ''),
            workerName: String(reportWorker.name ?? '이름 미상'),
            workerTeamId: sourceTeamId,
            workerTeamName: sourceTeamName,
            manDay,
            unitPrice: supportUnitPrice,
            amount: calculateSupportLaborAmount(manDay, supportUnitPrice)
          });
        });
      });
    });

    return rows;
  },

  async getTeamSettlement(params: { yearMonth: string; teamId: string }): Promise<TeamSettlementDocument> {
    const team = await buildTeamIdVariants(params.teamId);
    const systemId = buildSystemConfigId({ yearMonth: params.yearMonth, teamId: team.canonicalTeamId });

    const res = await listSystemConfigs();
    const rows = extractSystemConfigRows(res);
    const row = rows.find((r) => String(r.id ?? '') === systemId);

    const savedUnknown = typeof row?.data === 'string' ? safeJsonParse<unknown>(row.data) : null;
    const savedParsed = savedUnknown ? TeamSettlementDocumentSchema.safeParse(savedUnknown) : null;
    const savedDoc = savedParsed && savedParsed.success ? savedParsed.data : null;

    const autoDoc = await this.calculateAutoSettlement({
      yearMonth: params.yearMonth,
      teamId: team.canonicalTeamId,
      teamName: team.teamName,
      teamIdVariants: team.variants
    });

    return mergeAutoAndDraft({ autoDoc, savedDoc });
  },

  async recalculateAndSaveTeamSettlement(params: { yearMonth: string; teamId: string; keepConfirmed?: boolean }): Promise<void> {
    const team = await buildTeamIdVariants(params.teamId);
    const systemId = buildSystemConfigId({ yearMonth: params.yearMonth, teamId: team.canonicalTeamId });

    const res = await listSystemConfigs();
    const rows = extractSystemConfigRows(res);
    const row = rows.find((r) => String(r.id ?? '') === systemId);

    const savedUnknown = typeof row?.data === 'string' ? safeJsonParse<unknown>(row.data) : null;
    const savedParsed = savedUnknown ? TeamSettlementDocumentSchema.safeParse(savedUnknown) : null;
    const savedDoc = savedParsed && savedParsed.success ? savedParsed.data : null;

    const confirmedAt = savedDoc?.confirmedAt ? String(savedDoc.confirmedAt) : null;

    const autoDoc = await this.calculateAutoSettlement({
      yearMonth: params.yearMonth,
      teamId: team.canonicalTeamId,
      teamName: team.teamName,
      teamIdVariants: team.variants
    });

    const merged = mergeAutoAndDraft({
      autoDoc,
      savedDoc: savedDoc ? { ...savedDoc, confirmedAt: null } : null
    });

    const keepConfirmed = Boolean(params.keepConfirmed);
    const next: TeamSettlementDocument = {
      ...merged,
      confirmedAt: keepConfirmed ? confirmedAt : null,
      updatedAt: new Date().toISOString()
    };

    await this.saveTeamSettlement(next);
  },

  async saveTeamSettlement(doc: TeamSettlementDocument): Promise<void> {
    const parsed = TeamSettlementDocumentSchema.parse(doc);
    const stripped = stripSupportOriginalLines(parsed);
    const team = await buildTeamIdVariants(stripped.teamId);

    const next: TeamSettlementDocument = {
      ...stripped,
      teamId: team.canonicalTeamId,
      teamName: stripped.teamName || team.teamName,
      updatedAt: new Date().toISOString()
    };

    const systemId = buildSystemConfigId({ yearMonth: next.yearMonth, teamId: next.teamId });
    const payload = JSON.stringify(next);

    const updateVars: UpdateSystemConfigVariables = { id: systemId, data: payload };
    const createVars: CreateSystemConfigVariables = { id: systemId, data: payload };

    try {
      const updateRes = await updateSystemConfig(updateVars);
      if (!didUpdateSystemConfig(updateRes)) {
        await createSystemConfig(createVars);
      }
    } catch {
      try {
        await createSystemConfig(createVars);
      } catch {
        await updateSystemConfig(updateVars);
      }
    }
  },

  async saveAndConfirmTeamSettlement(doc: TeamSettlementDocument): Promise<TeamSettlementDocument> {
    const parsed = TeamSettlementDocumentSchema.parse(doc);
    const now = new Date().toISOString();
    const nextDoc: TeamSettlementDocument = {
      ...parsed,
      confirmedAt: now,
      updatedAt: now
    };

    await this.saveTeamSettlement(nextDoc);
    try {
      await notifyTeamSettlementSystemMessage('teamSettlement.confirmed', nextDoc);
    } catch (error) {
      console.error('[teamSettlementService] confirmation notification failed:', error);
    }
    return nextDoc;
  },

  async confirmTeamSettlement(params: { yearMonth: string; teamId: string }): Promise<void> {
    const doc = await this.getTeamSettlement(params);
    const now = new Date().toISOString();
    const nextDoc: TeamSettlementDocument = {
      ...doc,
      confirmedAt: now,
      updatedAt: now
    };
    await this.saveTeamSettlement(nextDoc);
    await notifyTeamSettlementSystemMessage('teamSettlement.confirmed', nextDoc);
  },

  async unconfirmTeamSettlement(params: { yearMonth: string; teamId: string }): Promise<void> {
    const doc = await this.getTeamSettlement(params);
    const nextDoc: TeamSettlementDocument = {
      ...doc,
      confirmedAt: null,
      updatedAt: new Date().toISOString()
    };
    await this.saveTeamSettlement(nextDoc);
    await notifyTeamSettlementSystemMessage('teamSettlement.unconfirmed', nextDoc);
  },

  async calculateAutoSettlement(params: {
    yearMonth: string;
    teamId: string;
    teamName: string;
    teamIdVariants: Set<string>;
  }): Promise<TeamSettlementDocument> {
    const period = getMonthRange(params.yearMonth);

    const roundManDay = (value: number): number => {
      if (!Number.isFinite(value)) return 0;
      return Math.round(value * 10) / 10;
    };

    const [
      sites,
      teams,
      companies,
      workerRows,
      supportReports,
      supportRates,
      supportClientAllocations,
      accommodationDocs,
      vehicleDocs,
      cardDocs,
      teamExpenseClaims
    ] = await Promise.all([
      siteService.getSites(),
      teamService.getTeams(),
      companyService.getCompanies(),
      dailyReportService.getReportWorkerRowsByRange({ startDate: period.startDate, endDate: period.endDate }),
      dailyReportService.getReportsByRange(period.startDate, period.endDate),
      supportRateService.getAllSiteRates(),
      supportClientSiteAllocationService.getAllocationsByMonth(params.yearMonth).catch(() => [] as SupportClientAllocation[]),
      accommodationBillingService.getBillingDocuments({ teamId: 'all', yearMonth: params.yearMonth }),
      vehicleBillingService.getBillingsByMonth(params.yearMonth),
      cardBillingService.getBillingsByMonth(params.yearMonth),
      teamExpenseLedgerService.getClaimsByMonth(params.yearMonth)
    ]);

    const matchesTeam = (value: unknown): boolean => {
      if (typeof value !== 'string') return false;
      const trimmed = value.trim();
      if (!trimmed) return false;
      const normalized = normalizeSupportIdentity(trimmed);
      if (params.teamIdVariants.has(trimmed) || (normalized && params.teamIdVariants.has(normalized))) return true;
      if (isUuidString(trimmed)) return trimmed === params.teamId;
      return false;
    };

    const teamByAnyId = new Map<string, (typeof teams)[number]>();
    const teamByName = new Map<string, (typeof teams)[number]>();
    const setTeamIdLookup = (key: string, teamRow: (typeof teams)[number]) => {
      const trimmed = String(key ?? '').trim();
      if (!trimmed) return;
      teamByAnyId.set(trimmed, teamRow);
      const normalized = normalizeSupportIdentity(trimmed);
      if (normalized) teamByAnyId.set(normalized, teamRow);
    };
    teams.forEach((t) => {
      const id = t?.id ? String(t.id) : '';
      const legacyId = t?.legacyId ? String(t.legacyId) : '';
      const name = t?.name ? String(t.name) : '';
      setTeamIdLookup(id, t);
      setTeamIdLookup(legacyId, t);
      const nameKey = normalizeSupportIdentity(name);
      if (nameKey && !teamByName.has(nameKey)) teamByName.set(nameKey, t);
    });

    const companyByAnyId = new Map<string, (typeof companies)[number]>();
    const setCompanyIdLookup = (key: string, companyRow: (typeof companies)[number]) => {
      const trimmed = String(key ?? '').trim();
      if (!trimmed) return;
      companyByAnyId.set(trimmed, companyRow);
      const normalized = normalizeSupportIdentity(trimmed);
      if (normalized) companyByAnyId.set(normalized, companyRow);
    };
    companies.forEach((company) => {
      const id = company?.id ? String(company.id) : '';
      const legacyId = company?.legacyId ? String(company.legacyId) : '';
      setCompanyIdLookup(id, company);
      setCompanyIdLookup(legacyId, company);
    });

    const resolveTeamIdFromAny = (rawId?: string, rawName?: string): string => {
      const idKey = rawId ? String(rawId).trim() : '';
      if (idKey) {
        const found = teamByAnyId.get(idKey) ?? teamByAnyId.get(normalizeSupportIdentity(idKey));
        if (found?.id) return String(found.id);
        return idKey;
      }
      const nameKey = rawName ? String(rawName).trim() : '';
      if (nameKey) {
        const found = teamByName.get(normalizeSupportIdentity(nameKey));
        if (found?.id) return String(found.id);
      }
      return '';
    };

    const siteByAnyId = new Map<string, Site>();
    const siteByName = new Map<string, Site>();
    const setSiteIdLookup = (key: string, siteRow: Site) => {
      const trimmed = String(key ?? '').trim();
      if (!trimmed) return;
      siteByAnyId.set(trimmed, siteRow);
      const normalized = normalizeSupportIdentity(trimmed);
      if (normalized) siteByAnyId.set(normalized, siteRow);
    };
    sites.forEach((s) => {
      const id = s?.id ? String(s.id) : '';
      const legacyId = s?.legacyId ? String(s.legacyId) : '';
      const name = s?.name ? String(s.name) : '';
      setSiteIdLookup(id, s);
      setSiteIdLookup(legacyId, s);
      if (name) siteByName.set(name, s);
    });

    const resolveSite = (siteId?: string, siteName?: string): Site | null => {
      const idKey = siteId ? String(siteId).trim() : '';
      const nameKey = siteName ? String(siteName).trim() : '';
      if (idKey) {
        const byId = siteByAnyId.get(idKey) ?? siteByAnyId.get(normalizeSupportIdentity(idKey));
        if (byId) return byId;
      }
      if (nameKey && siteByName.has(nameKey)) return siteByName.get(nameKey) ?? null;
      return null;
    };

    const supportRateBySiteId = new Map<string, number>();
    const supportRateBySiteName = new Map<string, number>();
    supportRates.forEach((rate) => {
      const configuredRate = toPositiveRate(rate.defaultRate);
      if (!configuredRate) return;
      const siteId = normalizeLookupKey(rate.siteId || rate.id);
      const siteName = normalizeLookupKey(rate.siteName);
      if (siteId) supportRateBySiteId.set(siteId, configuredRate);
      if (siteName) supportRateBySiteName.set(siteName, configuredRate);
    });

    const resolveConfiguredSiteRate = (siteId?: string | null, siteName?: string | null): number | null => {
      const normalizedSiteId = normalizeLookupKey(siteId);
      if (normalizedSiteId) {
        const direct = supportRateBySiteId.get(normalizedSiteId);
        if (direct) return direct;
        const site = resolveSite(String(siteId ?? ''), String(siteName ?? ''));
        const byResolvedName = site ? supportRateBySiteName.get(normalizeLookupKey(site.name)) : undefined;
        if (byResolvedName) return byResolvedName;
      }
      const normalizedSiteName = normalizeLookupKey(siteName);
      return normalizedSiteName ? (supportRateBySiteName.get(normalizedSiteName) ?? null) : null;
    };

    const findTeamByIdentity = (teamId?: string | null, teamName?: string | null): (typeof teams)[number] | undefined => {
      const idKey = String(teamId ?? '').trim();
      if (idKey) {
        const byId = teamByAnyId.get(idKey) ?? teamByAnyId.get(normalizeSupportIdentity(idKey));
        if (byId) return byId;
      }
      const nameKey = normalizeSupportIdentity(teamName);
      return nameKey ? teamByName.get(nameKey) : undefined;
    };

    const isCheongyeonCompany = (companyId?: string | null, companyName?: string | null): boolean => {
      const idKey = String(companyId ?? '').trim();
      if (idKey) {
        const company = companyByAnyId.get(idKey) ?? companyByAnyId.get(normalizeSupportIdentity(idKey));
        if (company?.isMyCompany) return true;
        if (isCheongyeonCompanyName(company?.name)) return true;
      }
      return isCheongyeonCompanyName(companyName);
    };

    const isCheongyeonTeamIdentity = (
      team?: (typeof teams)[number],
      teamId?: string | null,
      teamName?: string | null
    ): boolean => {
      const resolved = team ?? findTeamByIdentity(teamId, teamName);
      if (!resolved) return false;
      const companyId = String(resolved.companyId ?? '').trim();
      const companyName = String(resolved.companyName ?? (companyId ? companyByAnyId.get(companyId)?.name : '') ?? '').trim();
      return isCheongyeonCompany(companyId, companyName);
    };

    const supportSettlementAmountBySiteId = new Map<string, number>();
    const supportSettlementAmountBySiteName = new Map<string, number>();

    const addSupportSettlementAmount = (map: Map<string, number>, key: string, amount: number) => {
      if (!key || amount <= 0) return;
      map.set(key, (map.get(key) ?? 0) + amount);
    };

    supportClientAllocations.forEach((allocation) => {
      const amount = Math.round(toFiniteNumberOrZero(allocation.settlementAmount));
      if (amount <= 0) return;

      const siteId = String(allocation.siteId ?? '').trim();
      const siteName = String(allocation.siteName ?? '').trim();
      const resolvedSite = resolveSite(siteId, siteName);
      const resolvedSiteId = String(resolvedSite?.id ?? siteId).trim();
      const resolvedSiteName = String(resolvedSite?.name ?? siteName).trim();

      if (resolvedSiteId && resolvedSiteId !== 'unknown-site') {
        addSupportSettlementAmount(supportSettlementAmountBySiteId, resolvedSiteId, amount);
      }
      addSupportSettlementAmount(supportSettlementAmountBySiteName, normalizeLookupKey(resolvedSiteName), amount);
    });

    const getSupportClientSettlementAmount = (siteId?: string, siteName?: string): number => {
      const idKey = String(siteId ?? '').trim();
      if (idKey && idKey !== 'unknown-site' && supportSettlementAmountBySiteId.has(idKey)) {
        return supportSettlementAmountBySiteId.get(idKey) ?? 0;
      }

      const nameKey = normalizeLookupKey(siteName);
      if (nameKey && supportSettlementAmountBySiteName.has(nameKey)) {
        return supportSettlementAmountBySiteName.get(nameKey) ?? 0;
      }

      return 0;
    };

    const supportRateOverrides = loadSupportRateOverrides(params.yearMonth);

    const supportSalesGrouped = new Map<
      string,
      {
        direction: SupportSettlementOrigin;
        siteId?: string;
        siteName: string;
        counterTeamId?: string;
        counterTeamName?: string;
        manDay: number;
        amountOriginal: number;
        amountFee: number;
      }
    >();

    const supportPurchasesGrouped = new Map<
      string,
      {
        direction: SupportSettlementOrigin;
        siteId?: string;
        siteName: string;
        counterTeamId?: string;
        counterTeamName?: string;
        manDay: number;
        amountOriginal: number;
        amountFee: number;
      }
    >();

    const getWorkerRowResponsibleTeamId = (row: (typeof workerRows)[number]): string => {
      const rawSiteId = row.siteId ? String(row.siteId) : '';
      const rawSiteName = row.siteName ? String(row.siteName) : '현장 미지정';
      const site = resolveSite(rawSiteId, rawSiteName);
      const reportTeamId = row.teamId ? String(row.teamId) : '';
      const rowResponsibleTeamId = row.responsibleTeamId ? String(row.responsibleTeamId) : '';
      const siteResponsibleTeamId = site?.responsibleTeamId ? String(site.responsibleTeamId) : '';
      return siteResponsibleTeamId || rowResponsibleTeamId || reportTeamId;
    };

    const getWorkerRowManagedKind = (row: (typeof workerRows)[number]): '도급' | '직영' | '지원' => {
      const rawSiteId = row.siteId ? String(row.siteId) : '';
      const rawSiteName = row.siteName ? String(row.siteName) : '현장 미지정';
      const site = resolveSite(rawSiteId, rawSiteName);
      const rowSiteType = String(row.siteType ?? '').trim();
      const resolvedSiteType = rowSiteType || String(site?.siteType ?? '').trim();
      return resolvedSiteType === '도급' || resolvedSiteType === '직영' || resolvedSiteType === '지원'
        ? resolvedSiteType
        : '직영';
    };

    const isSelectedTeamDirectWorkRow = (row: (typeof workerRows)[number]): boolean => {
      if (!matchesTeam(getWorkerRowResponsibleTeamId(row))) return false;
      const managedKind = getWorkerRowManagedKind(row);
      return managedKind === '도급' || managedKind === '직영';
    };

    const managedSalesGrouped = new Map<
      string,
      {
        siteId?: string;
        siteName: string;
        kind: '도급' | '직영';
        manDay: number;
        amount: number;
      }
    >();

    type ClassifiedSupportEntry = Omit<SupportRateLookupContext, 'direction'> & {
      direction: SupportSettlementOrigin;
      counterTeamId?: string;
      counterTeamName?: string;
    };

    const addSupportSettlementLine = (
      map: typeof supportSalesGrouped,
      row: { manDay: unknown; unitPrice: unknown },
      entry: ClassifiedSupportEntry,
      siteId: string | undefined,
      siteName: string,
      supportUnitPrice: number
    ) => {
      const itemManDay = toFiniteNumberOrZero(row.manDay);
      if (itemManDay <= 0) return;

      const counterTeamId = String(entry.counterTeamId ?? '').trim();
      const counterTeamName = String(entry.counterTeamName ?? '').trim();
      const siteKey = String(siteId ?? '').trim() || siteName;
      const counterKey = normalizeSupportIdentity(counterTeamId) || normalizeSupportIdentity(counterTeamName) || entry.direction;
      const key = `${entry.direction}__${siteKey}__${counterKey}`;
      const current = map.get(key) ?? {
        direction: entry.direction,
        siteId,
        siteName,
        counterTeamId: counterTeamId || undefined,
        counterTeamName: counterTeamName || undefined,
        manDay: 0,
        amountOriginal: 0,
        amountFee: 0
      };

      map.set(key, {
        ...current,
        manDay: current.manDay + itemManDay,
        amountOriginal: current.amountOriginal + itemManDay * toFiniteNumberOrZero(row.unitPrice),
        amountFee: current.amountFee + calculateSupportLaborAmount(itemManDay, supportUnitPrice)
      });
    };

    supportReports.forEach((report) => {
      const rawSiteId = String(report.siteId ?? '').trim();
      const rawSiteName = String(report.siteName ?? '').trim() || '현장 미지정';
      const site = resolveSite(rawSiteId, rawSiteName);
      const siteId = site?.id ? String(site.id) : (rawSiteId || undefined);
      const siteName = site?.name ? String(site.name) : rawSiteName;

      const siteConstructorCompanyId = String(site?.constructorCompanyId ?? site?.companyId ?? report.constructorCompanyId ?? report.companyId ?? '').trim();
      const siteConstructorCompanyName = String(site?.constructorCompanyName ?? site?.companyName ?? report.constructorCompanyName ?? report.companyName ?? '').trim();
      const siteIsCheongyeon = isCheongyeonCompany(siteConstructorCompanyId, siteConstructorCompanyName);

      (Array.isArray(report.workers) ? report.workers : []).forEach((reportWorker) => {
        const reportWorkerTeamId = String(reportWorker.teamId ?? '').trim();
        const reportWorkerTeamName = String(reportWorker.workerTeamName ?? '').trim();
        const fallbackSourceTeam = findTeamByIdentity(undefined, reportWorkerTeamName);
        const fallbackReportTeamId = reportWorkerTeamName ? '' : String(report.teamId ?? '').trim();
        const workerTeamId = reportWorkerTeamId || (fallbackSourceTeam?.id ? String(fallbackSourceTeam.id) : '') || fallbackReportTeamId;
        const resolvedSourceTeam = findTeamByIdentity(workerTeamId, reportWorkerTeamName) ?? fallbackSourceTeam;
        const sourceTeamId = String(
          resolvedSourceTeam?.id ??
          (reportWorkerTeamId || normalizeSupportIdentity(reportWorkerTeamName) || fallbackReportTeamId || '')
        ).trim();
        const sourceTeamName = String(
          resolvedSourceTeam?.name ??
          (reportWorkerTeamName || report.teamName || '팀 미지정')
        ).trim();
        const workerCompanyId = String(resolvedSourceTeam?.companyId ?? '').trim();
        const workerCompanyName = String(
          resolvedSourceTeam?.companyName ??
          (workerCompanyId ? companyByAnyId.get(workerCompanyId)?.name : '') ??
          ''
        ).trim();

        const targetTeamIdRaw = String(report.responsibleTeamId ?? site?.responsibleTeamId ?? report.teamId ?? '').trim();
        const targetTeamNameRaw = String(report.responsibleTeamName ?? site?.responsibleTeamName ?? report.teamName ?? '').trim();
        const resolvedTargetTeam = findTeamByIdentity(targetTeamIdRaw, targetTeamNameRaw);
        const targetTeamId = String(resolvedTargetTeam?.id ?? targetTeamIdRaw).trim();
        const targetTeamName = String(resolvedTargetTeam?.name ?? targetTeamNameRaw ?? '팀 미지정').trim();
        const targetCompanyId = String(resolvedTargetTeam?.companyId ?? siteConstructorCompanyId ?? report.companyId ?? '').trim();
        const targetCompanyName = String(resolvedTargetTeam?.companyName ?? siteConstructorCompanyName ?? report.companyName ?? '').trim();

        const workerIsCheongyeon = isCheongyeonTeamIdentity(resolvedSourceTeam, sourceTeamId, sourceTeamName);
        const targetIsCheongyeon = isCheongyeonTeamIdentity(resolvedTargetTeam, targetTeamId, targetTeamName);
        const isSameFieldAndWorkerTeam = isSameTeamIdentity(sourceTeamId, sourceTeamName, targetTeamId, targetTeamName);
        const normalizedSalary = normalizeSupportSalaryModel(reportWorker.salaryModel ?? reportWorker.payType);
        const isSupportModel = normalizedSalary === '지원팀';
        const isSupportTeam = normalizeSupportIdentity(resolvedSourceTeam?.type).includes('지원');

        const entries: ClassifiedSupportEntry[] = [];
        if (workerIsCheongyeon && targetIsCheongyeon && isSameFieldAndWorkerTeam) {
          return;
        }

        if (workerIsCheongyeon && targetIsCheongyeon && sourceTeamId && targetTeamId) {
          entries.push({
            direction: '내부지원간곳',
            viewTeamId: sourceTeamId,
            viewTeamName: sourceTeamName,
            settlementTeamId: sourceTeamId,
            settlementTeamName: sourceTeamName,
            counterTeamId: targetTeamId,
            counterTeamName: targetTeamName
          });
          entries.push({
            direction: '내부지원온곳',
            viewTeamId: targetTeamId,
            viewTeamName: targetTeamName,
            settlementTeamId: targetTeamId,
            settlementTeamName: targetTeamName,
            counterTeamId: sourceTeamId,
            counterTeamName: sourceTeamName
          });
        } else if (!siteIsCheongyeon && workerIsCheongyeon) {
          entries.push({
            direction: '외부지원간곳',
            viewTeamId: sourceTeamId,
            viewTeamName: sourceTeamName,
            settlementTeamId: targetTeamId || targetCompanyId,
            settlementTeamName: targetTeamName || targetCompanyName || siteConstructorCompanyName || '외부 시공사',
            counterTeamId: targetTeamId || targetCompanyId,
            counterTeamName: targetTeamName || targetCompanyName || siteConstructorCompanyName || '외부 현장'
          });
        } else if (siteIsCheongyeon && targetIsCheongyeon && !workerIsCheongyeon) {
          entries.push({
            direction: '외부지원온곳',
            viewTeamId: targetTeamId,
            viewTeamName: targetTeamName,
            settlementTeamId: sourceTeamId || workerCompanyId,
            settlementTeamName: sourceTeamName || workerCompanyName || '외부 지원팀',
            counterTeamId: sourceTeamId || workerCompanyId,
            counterTeamName: sourceTeamName || workerCompanyName || '외부 지원팀'
          });
        } else if (siteIsCheongyeon && targetIsCheongyeon && (isSupportModel || isSupportTeam)) {
          entries.push({
            direction: '외부지원온곳',
            viewTeamId: targetTeamId,
            viewTeamName: targetTeamName,
            settlementTeamId: sourceTeamId || workerCompanyId,
            settlementTeamName: sourceTeamName || workerCompanyName || '지원팀',
            counterTeamId: sourceTeamId || workerCompanyId,
            counterTeamName: sourceTeamName || workerCompanyName || '외부 지원팀'
          });
        }

        if (entries.length === 0) return;

        const rateSiteId = rawSiteId || siteId;
        const configuredSupportRate = resolveConfiguredSiteRate(rateSiteId, rawSiteName || siteName);
        const sourceTeamSupportRate = toPositiveRate(resolvedSourceTeam?.supportRate);
        const baseSupportRate = configuredSupportRate ?? sourceTeamSupportRate ?? toPositiveRate(reportWorker.unitPrice) ?? DEFAULT_SUPPORT_UNIT_PRICE;
        const manDay = toFiniteNumberOrZero(reportWorker.manDay);

        entries.forEach((entry) => {
          const isSelectedViewTeam = matchesTeam(entry.viewTeamId) || isSameTeamIdentity(entry.viewTeamId, entry.viewTeamName, params.teamId, params.teamName);
          if (!isSelectedViewTeam) return;

          const supportUnitPrice = resolveSupportUnitRate({
            overrides: supportRateOverrides,
            baseRate: baseSupportRate,
            contexts: [entry],
            siteId: rateSiteId || siteName
          });

          const targetMap = entry.direction === '외부지원간곳' || entry.direction === '내부지원간곳'
            ? supportSalesGrouped
            : supportPurchasesGrouped;

          addSupportSettlementLine(targetMap, { manDay, unitPrice: reportWorker.unitPrice }, entry, siteId, siteName, supportUnitPrice);
        });
      });
    });

    workerRows.forEach((row) => {
      const rawSiteId = row.siteId ? String(row.siteId) : '';
      const rawSiteName = row.siteName ? String(row.siteName) : '현장 미지정';

      const rowManDay = toFiniteNumberOrZero(row.manDay);
      const rowAmount = toFiniteNumberOrZero(row.amount);

      const site = resolveSite(rawSiteId, rawSiteName);
      const responsibleTeamId = getWorkerRowResponsibleTeamId(row);

      const isManagedSiteStrict = matchesTeam(responsibleTeamId);
      if (!isManagedSiteStrict) return;

      const managedKind = getWorkerRowManagedKind(row);

      if (managedKind !== '도급' && managedKind !== '직영') return;

      const siteKey = site?.id ? String(site.id) : (rawSiteId || rawSiteName);
      const key = `${managedKind}__${siteKey}__`;

      const current = managedSalesGrouped.get(key) ?? {
        siteId: site?.id ? String(site.id) : (rawSiteId || undefined),
        siteName: site?.name ? String(site.name) : rawSiteName,
        kind: managedKind,
        manDay: 0,
        amount: 0
      };

      managedSalesGrouped.set(key, {
        ...current,
        manDay: current.manDay + rowManDay,
        amount: current.amount + rowAmount
      });
    });

    const dailyReportSales: TeamSettlementSalesItem[] = Array.from(managedSalesGrouped.entries()).map(([key, value]) => {
      const supportClientSettlementAmount = getSupportClientSettlementAmount(value.siteId, value.siteName);
      const usesSupportClientSettlement = supportClientSettlementAmount > 0;
      return {
        id: `daily_report_sales:${params.yearMonth}:${key}`,
        source: 'auto',
        origin: usesSupportClientSettlement ? 'support_client_site' : 'daily_report',
        kind: value.kind,
        siteId: value.siteId,
        siteName: value.siteName,
        counterTeamId: undefined,
        counterTeamName: undefined,
        manDay: roundManDay(value.manDay),
        amount: value.kind === '도급' ? 0 : (usesSupportClientSettlement ? supportClientSettlementAmount : value.amount),
        memo: value.kind !== '도급' && usesSupportClientSettlement ? '지원정산 정산금액 기준' : undefined
      };
    });

    const supportFeeSales: TeamSettlementSalesItem[] = Array.from(supportSalesGrouped.entries())
      .filter(([, value]) => Number.isFinite(value.amountFee) && value.amountFee > 0)
      .map(([key, value]) => {
        return {
          id: `labor_exchange_support_fee_sales:${params.yearMonth}:${key}`,
          source: 'auto',
          origin: toSupportSalesOrigin(value.direction),
          kind: '지원',
          siteId: value.siteId,
          siteName: value.siteName,
          counterTeamId: value.counterTeamId,
          counterTeamName: value.counterTeamName,
          manDay: roundManDay(value.manDay),
          amount: Math.round(value.amountFee),
          memo: '지원단가 기준 노임총액'
        };
      });

    const supportFeePurchases: TeamSettlementPurchaseItem[] = Array.from(supportPurchasesGrouped.entries())
      .filter(([, value]) => Number.isFinite(value.amountFee) && value.amountFee > 0)
      .map(([key, value]) => {
        return {
          id: `labor_exchange_support_fee_purchases:${params.yearMonth}:${key}`,
          source: 'auto',
          origin: toSupportPurchaseOrigin(value.direction),
          kind: '지원',
          siteId: value.siteId,
          siteName: value.siteName,
          counterTeamId: value.counterTeamId,
          counterTeamName: value.counterTeamName,
          manDay: roundManDay(value.manDay),
          amount: Math.round(value.amountFee),
          memo: '지원단가 기준 노임총액'
        };
      });

    let cachedWorkers: Awaited<ReturnType<typeof manpowerService.getWorkers>> | null = null;
    let cachedWorkerTeamByAnyId: Map<string, string> | null = null;
    let cachedWorkerTeamByName: Map<string, string> | null = null;

    const getWorkersOnce = async () => {
      if (cachedWorkers) return cachedWorkers;
      cachedWorkers = await manpowerService.getWorkers();
      return cachedWorkers;
    };

    const buildWorkerTeamLookups = async () => {
      if (cachedWorkerTeamByAnyId && cachedWorkerTeamByName) {
        return { byAnyId: cachedWorkerTeamByAnyId, byName: cachedWorkerTeamByName };
      }

      const workers = await getWorkersOnce();
      const byAnyId = new Map<string, string>();
      const byName = new Map<string, string>();

      workers.forEach((w) => {
        const teamId = resolveTeamIdFromAny(
          w.teamId ? String(w.teamId) : '',
          w.teamName ? String(w.teamName) : ''
        );
        if (!teamId) return;

        const id = w.id ? String(w.id).trim() : '';
        const legacyId = w.legacyId ? String(w.legacyId).trim() : '';
        const name = w.name ? String(w.name).trim() : '';

        if (id) byAnyId.set(id, teamId);
        if (legacyId) byAnyId.set(legacyId, teamId);
        if (name) byName.set(name, teamId);
      });

      cachedWorkerTeamByAnyId = byAnyId;
      cachedWorkerTeamByName = byName;
      return { byAnyId, byName };
    };

    const supportBillingEnabled = isSupportBillingMonthEnabled(params.yearMonth);
    const [assignmentRows, utilityRecords] = supportBillingEnabled
      ? await Promise.all([
        accommodationAssignmentService.getAllAssignments(),
        accommodationService.getMonthlyLedger(params.yearMonth)
      ])
      : [[], []] as const;

    const accommodationNameById = new Map<string, string>();
    utilityRecords
      .filter((record) => String(record.yearMonth ?? '') === String(params.yearMonth))
      .forEach((record) => {
        const accommodationId = String(record.accommodationId ?? '').trim();
        if (!accommodationId) return;
        const accommodationName = String(record.accommodationName ?? '').trim();
        if (accommodationName) accommodationNameById.set(accommodationId, accommodationName);
      });

    const utilityTotalByAccommodation = new Map<string, number>();
    const monthStart = parseYmdDate(period.startDate);
    const monthEnd = parseYmdDate(period.endDate);
    if (monthStart && monthEnd) {
      const teamDaysByAccommodation = new Map<string, number>();
      const totalTeamDaysByAccommodation = new Map<string, number>();

      const workerLookupsForAssignment = await buildWorkerTeamLookups();
      assignmentRows.forEach((assignment) => {
        const accommodationId = String(assignment.accommodationId ?? '').trim();
        if (!accommodationId) return;

        const startDate = parseYmdDate(String(assignment.startDate ?? '').trim());
        if (!startDate) return;
        const endDate = assignment.endDate ? parseYmdDate(String(assignment.endDate).trim()) : null;

        const overlapDays = calculateOverlapDays({
          monthStart,
          monthEnd,
          startDate,
          endDate
        });
        if (overlapDays <= 0) return;

        let assignmentTeamId = resolveTeamIdFromAny(
          assignment.teamId ? String(assignment.teamId) : '',
          assignment.teamName ? String(assignment.teamName) : ''
        );
        if (!assignmentTeamId) {
          const workerId = String(assignment.workerId ?? '').trim();
          const workerName = String(assignment.workerName ?? '').trim();
          assignmentTeamId =
            workerLookupsForAssignment.byAnyId.get(workerId) ??
            workerLookupsForAssignment.byName.get(workerName) ??
            '';
        }
        if (!assignmentTeamId) return;

        totalTeamDaysByAccommodation.set(
          accommodationId,
          (totalTeamDaysByAccommodation.get(accommodationId) ?? 0) + overlapDays
        );

        if (matchesTeam(assignmentTeamId)) {
          teamDaysByAccommodation.set(
            accommodationId,
            (teamDaysByAccommodation.get(accommodationId) ?? 0) + overlapDays
          );
        }
      });

      utilityRecords
        .filter((record) => String(record.yearMonth ?? '') === String(params.yearMonth))
        .forEach((record) => {
          const accommodationId = String(record.accommodationId ?? '').trim();
          if (!accommodationId) return;

          const teamDays = teamDaysByAccommodation.get(accommodationId) ?? 0;
          const totalDays = totalTeamDaysByAccommodation.get(accommodationId) ?? 0;
          if (teamDays <= 0 || totalDays <= 0) return;

          const ratio = teamDays / totalDays;
          const apportionedTotal =
            Math.round(toFiniteNumberOrZero(record.costs?.rent) * ratio) +
            Math.round(toFiniteNumberOrZero(record.costs?.electricity) * ratio) +
            Math.round(toFiniteNumberOrZero(record.costs?.gas) * ratio) +
            Math.round(toFiniteNumberOrZero(record.costs?.water) * ratio) +
            Math.round(toFiniteNumberOrZero(record.costs?.internet) * ratio) +
            Math.round(toFiniteNumberOrZero(record.costs?.maintenance) * ratio) +
            Math.round(toFiniteNumberOrZero(record.costs?.other) * ratio);

          if (apportionedTotal <= 0) return;
          utilityTotalByAccommodation.set(
            accommodationId,
            (utilityTotalByAccommodation.get(accommodationId) ?? 0) + apportionedTotal
          );
        });
    }

    let accommodationDeductions: TeamSettlementDeductionItem[] = allowUnconfirmedLedgerFallback
      ? Array.from(utilityTotalByAccommodation.entries())
      .filter(([, amount]) => Number.isFinite(amount) && amount > 0)
      .map(([accommodationId, amount]): TeamSettlementDeductionItem => ({
        id: `accommodation_billing:${params.yearMonth}:ledger:${accommodationId}`,
        source: 'auto',
        origin: 'accommodation_billing',
        category: `숙소비 (${accommodationNameById.get(accommodationId) ?? accommodationId})`,
        amount,
        memo: '월별 공과금 대장 자동집계'
      }))
      : [];

    if (supportBillingEnabled && accommodationDeductions.length === 0) {
      const teamAccommodationDocs = accommodationDocs.filter((doc) => {
        if (!isTeamBillingTarget({
          issuedToType: doc.issuedToType,
          teamId: doc.teamId,
          teamName: doc.teamName,
          issuedToWorkerId: doc.issuedToWorkerId,
          issuedToWorkerName: doc.issuedToWorkerName
        })) return false;
        const resolved = resolveTeamIdFromAny(
          doc.teamId ? String(doc.teamId) : '',
          doc.teamName ? String(doc.teamName) : ''
        );
        return resolved ? matchesTeam(resolved) : false;
      });
      const selectedAccommodationDocs = selectPreferredTeamBillings(teamAccommodationDocs, isAccommodationLedgerClaim);

      accommodationDeductions = selectedAccommodationDocs
        .map((doc): TeamSettlementDeductionItem | null => {
          const totalAmount = Math.round(
            (doc.lineItems ?? []).reduce((sum, li) => sum + toFiniteNumberOrZero(li.amount), 0)
          );
          if (totalAmount <= 0) return null;

          const targetName =
            String(doc.teamName ?? '').trim() ||
            String(doc.issuedToWorkerName ?? '').trim() ||
            params.teamName ||
            '팀';

          return {
            id: `accommodation_billing:${params.yearMonth}:${doc.id}`,
            source: 'auto',
            origin: 'accommodation_billing',
            category: `숙소비 (${targetName})`,
            amount: totalAmount
          };
        })
        .filter((item): item is TeamSettlementDeductionItem => Boolean(item));
    }

    const teamVehicleDocs = supportBillingEnabled ? vehicleDocs.filter((doc) => {
      if (!isTeamBillingTarget({
        issuedToType: doc.issuedToType,
        teamId: doc.teamId ?? doc.assignedTeamId,
        teamName: doc.teamName ?? doc.assignedTeamName,
        issuedToWorkerId: doc.issuedToWorkerId,
        issuedToWorkerName: doc.issuedToWorkerName
      })) return false;
      const resolved = resolveTeamIdFromAny(
        doc.teamId ? String(doc.teamId) : (doc.assignedTeamId ? String(doc.assignedTeamId) : ''),
        doc.teamName ? String(doc.teamName) : (doc.assignedTeamName ? String(doc.assignedTeamName) : '')
      );
      return resolved ? matchesTeam(resolved) : false;
    }) : [];
    const selectedVehicleDocs = selectPreferredTeamBillings(teamVehicleDocs, isVehicleLedgerClaim);

    const vehicleDeductionsFromDocs: TeamSettlementDeductionItem[] = selectedVehicleDocs
      .map((doc): TeamSettlementDeductionItem => {
        const lineTotal = (doc.lineItems ?? []).reduce((sum, li) => sum + toFiniteNumberOrZero(li.amount), 0);
        const fixedCost = toFiniteNumberOrZero(doc.fixedCost);
        const variableCost = toFiniteNumberOrZero(doc.variableCost);
        const fallbackTotal = toFiniteNumberOrZero(doc.totalAmount);
        const amount = Math.round(lineTotal > 0 ? lineTotal : (fixedCost + variableCost > 0 ? fixedCost + variableCost : fallbackTotal));

        return {
          id: `vehicle_billing:${params.yearMonth}:${doc.vehicleId || doc.vehiclePlate}`,
          source: 'auto',
          origin: 'vehicle_billing',
          category: `차량비 (${doc.vehiclePlate})`,
          amount
        };
      })
      .filter((d) => d.amount > 0);

    let vehicleDeductions: TeamSettlementDeductionItem[] = vehicleDeductionsFromDocs;

    if (supportBillingEnabled && allowUnconfirmedLedgerFallback && vehicleDeductions.length === 0) {
      const [vehicles, expenses, workerLookups, vehicleAssignments] = await Promise.all([
        vehicleService.getVehicles(),
        vehicleService.getExpensesByMonth(params.yearMonth),
        buildWorkerTeamLookups(),
        vehicleService.listAllVehicleAssignments().catch(() => [])
      ]);

      const expenseByVehicleId = new Map<string, typeof expenses>();
      expenses.forEach((expense) => {
        const vehicleId = String(expense.vehicleId ?? '').trim();
        if (!vehicleId) return;
        const list = expenseByVehicleId.get(vehicleId) ?? [];
        list.push(expense);
        expenseByVehicleId.set(vehicleId, list);
      });

      const assignmentsByVehicleId = new Map<string, typeof vehicleAssignments>();
      vehicleAssignments.forEach((assignment) => {
        const vehicleId = String(assignment.vehicleId ?? '').trim();
        if (!vehicleId) return;
        const list = assignmentsByVehicleId.get(vehicleId) ?? [];
        list.push(assignment);
        assignmentsByVehicleId.set(vehicleId, list);
      });

      const resolveVehicleAssignmentTeamId = (assignment: { assigneeType?: unknown; assigneeId?: unknown; assigneeName?: unknown }): string => {
        if (assignment.assigneeType === 'TEAM') {
          return resolveTeamIdFromAny(
            assignment.assigneeId ? String(assignment.assigneeId) : '',
            assignment.assigneeName ? String(assignment.assigneeName) : ''
          );
        }

        const workerId = String(assignment.assigneeId ?? '').trim();
        const workerName = String(assignment.assigneeName ?? '').trim();
        return workerLookups.byAnyId.get(workerId) ?? workerLookups.byName.get(workerName) ?? '';
      };

      type VehicleCostSegment = {
        key: string;
        teamId: string;
        startDate: Date;
        endDate: Date;
        overlapDays: number;
      };

      const allocateVehicleFixedCosts = (fixedCost: number, segments: VehicleCostSegment[]): Map<string, number> => {
        const result = new Map<string, number>();
        if (fixedCost <= 0 || segments.length === 0) return result;

        const totalDays = segments.reduce((sum, segment) => sum + Math.max(0, segment.overlapDays), 0);
        if (totalDays <= 0) return result;

        let allocated = 0;
        segments.forEach((segment, index) => {
          const share = index === segments.length - 1
            ? fixedCost - allocated
            : Math.round(fixedCost * (segment.overlapDays / totalDays));
          allocated += share;
          result.set(segment.key, share);
        });

        return result;
      };

      const buildVehicleCostSegments = (vehicle: Awaited<ReturnType<typeof vehicleService.getVehicles>>[number]): VehicleCostSegment[] => {
        if (!monthStart || !monthEnd) return [];
        const vehicleId = String(vehicle.id ?? '').trim();
        const activeAssignments = (assignmentsByVehicleId.get(vehicleId) ?? [])
          .map((assignment) => ({
            assignment,
            startDate: parseYmdDate(String(assignment.startDate ?? '').trim()),
            endDate: assignment.endDate ? parseYmdDate(String(assignment.endDate).trim()) : null
          }))
          .filter((entry) => {
            if (!entry.startDate) return false;
            if (entry.startDate.getTime() > monthEnd.getTime()) return false;
            if (entry.endDate && entry.endDate.getTime() < monthStart.getTime()) return false;
            return true;
          })
          .sort((a, b) => (a.startDate?.getTime() ?? 0) - (b.startDate?.getTime() ?? 0));

        const segments = activeAssignments.flatMap((entry, index): VehicleCostSegment[] => {
          if (!entry.startDate) return [];
          const teamId = resolveVehicleAssignmentTeamId(entry.assignment);
          if (!teamId) return [];

          const nextStartDate = activeAssignments[index + 1]?.startDate ?? null;
          const explicitEndDate = entry.endDate ?? monthEnd;
          const handoffEndDate = nextStartDate ? addDays(nextStartDate, -1) : monthEnd;
          const startDate = entry.startDate.getTime() > monthStart.getTime() ? entry.startDate : monthStart;
          const endDate = [explicitEndDate, handoffEndDate, monthEnd]
            .reduce((min, date) => date.getTime() < min.getTime() ? date : min);
          const overlapDays = calculateOverlapDays({ monthStart, monthEnd, startDate, endDate });
          if (overlapDays <= 0) return [];

          return [{
            key: String(entry.assignment.id ?? `${vehicleId}:${index}`),
            teamId,
            startDate,
            endDate,
            overlapDays
          }];
        });

        if (segments.length > 0) return segments;

        let currentTeamId = '';
        if (vehicle.currentAssigneeType === 'TEAM') {
          currentTeamId = resolveTeamIdFromAny(
            vehicle.currentAssigneeId ? String(vehicle.currentAssigneeId) : '',
            vehicle.currentAssigneeName ? String(vehicle.currentAssigneeName) : ''
          );
        } else if (vehicle.currentAssigneeType === 'WORKER') {
          const workerId = String(vehicle.currentAssigneeId ?? '').trim();
          const workerName = String(vehicle.currentAssigneeName ?? '').trim();
          currentTeamId = workerLookups.byAnyId.get(workerId) ?? workerLookups.byName.get(workerName) ?? '';
        }

        return currentTeamId
          ? [{
            key: `current:${vehicleId || vehicle.licensePlate}`,
            teamId: currentTeamId,
            startDate: monthStart,
            endDate: monthEnd,
            overlapDays: monthEnd.getDate()
          }]
          : [];
      };

      vehicleDeductions = vehicles
        .flatMap((vehicle): TeamSettlementDeductionItem[] => {
          const vehicleId = String(vehicle.id ?? '').trim();
          const segments = buildVehicleCostSegments(vehicle);
          if (segments.length === 0 || !monthEnd) return [];
          const fixedCost =
            vehicle.type === 'RENT' || vehicle.type === 'LEASE'
              ? toFiniteNumberOrZero(vehicle.contract?.monthlyFee)
              : 0;
          const fixedCostBySegment = allocateVehicleFixedCosts(fixedCost, segments);

          const variableCostBySegment = new Map<string, number>();
          (expenseByVehicleId.get(vehicleId) ?? []).forEach((expense) => {
            const expenseDate = parseYmdDate(String(expense.date ?? '').trim());
            const targetSegment = expenseDate
              ? segments.find((segment) =>
                expenseDate.getTime() >= segment.startDate.getTime() &&
                expenseDate.getTime() <= segment.endDate.getTime()
              )
              : undefined;
            const segment = targetSegment ?? segments[0];
            if (!segment) return;
            variableCostBySegment.set(
              segment.key,
              (variableCostBySegment.get(segment.key) ?? 0) + toFiniteNumberOrZero(expense.amount)
            );
          });

          return segments
            .filter((segment) => matchesTeam(segment.teamId))
            .map((segment): TeamSettlementDeductionItem | null => {
              const fixedShare = Math.round(fixedCostBySegment.get(segment.key) ?? 0);
              const variableCost = Math.round(variableCostBySegment.get(segment.key) ?? 0);
              const totalAmount = Math.round(fixedShare + variableCost);
              if (totalAmount <= 0) return null;

              return {
                id: `vehicle_billing:${params.yearMonth}:${vehicle.id || vehicle.licensePlate}:ledger:${segment.key}`,
                source: 'auto',
                origin: 'vehicle_billing',
                category: `차량비 (${vehicle.licensePlate})`,
                amount: totalAmount,
                memo: `월별 차량 대장 배정일 자동배분 (${segment.overlapDays}일)`
              };
            })
            .filter((item): item is TeamSettlementDeductionItem => Boolean(item));
        })
        .filter((item): item is TeamSettlementDeductionItem => Boolean(item));
    }

    const teamCardDocs = supportBillingEnabled ? cardDocs.filter((doc) => {
      if (!isTeamBillingTarget({
        issuedToType: doc.issuedToType,
        teamId: doc.teamId ?? doc.assignedTeamId,
        teamName: doc.teamName ?? doc.assignedTeamName,
        issuedToWorkerId: doc.issuedToWorkerId,
        issuedToWorkerName: doc.issuedToWorkerName
      })) return false;
      const resolved = resolveTeamIdFromAny(
        doc.teamId ? String(doc.teamId) : (doc.assignedTeamId ? String(doc.assignedTeamId) : ''),
        doc.teamName ? String(doc.teamName) : (doc.assignedTeamName ? String(doc.assignedTeamName) : '')
      );
      return resolved ? matchesTeam(resolved) : false;
    }) : [];
    const selectedCardDocs = selectPreferredTeamBillings(teamCardDocs, isCardLedgerClaim);

    const cardDeductionsFromDocs: TeamSettlementDeductionItem[] = selectedCardDocs
      .map((doc): TeamSettlementDeductionItem => {
        const lineTotal = (doc.lineItems ?? []).reduce((sum, li) => sum + toFiniteNumberOrZero(li.amount), 0);
        const fallbackTotal = toFiniteNumberOrZero(doc.totalAmount);
        const amount = Math.round(lineTotal > 0 ? lineTotal : fallbackTotal);

        return {
          id: `card_billing:${params.yearMonth}:${doc.cardId || doc.cardLabel}`,
          source: 'auto',
          origin: 'card_billing',
          category: `카드비 (${doc.cardLabel})`,
          amount
        };
      })
      .filter((d) => d.amount > 0);

    let cardDeductions: TeamSettlementDeductionItem[] = cardDeductionsFromDocs;

    if (supportBillingEnabled && allowUnconfirmedLedgerFallback && cardDeductions.length === 0) {
      const [cards, txs, workerLookups] = await Promise.all([
        cardService.getCards(),
        cardService.getTransactionsByMonth(params.yearMonth),
        buildWorkerTeamLookups()
      ]);

      const amountByCardId = new Map<string, number>();
      txs.forEach((tx) => {
        const cardId = String(tx.cardId ?? '').trim();
        if (!cardId) return;
        amountByCardId.set(cardId, (amountByCardId.get(cardId) ?? 0) + toFiniteNumberOrZero(tx.amount));
      });

      cardDeductions = cards
        .map((card): TeamSettlementDeductionItem | null => {
          let assignedTeamId = '';

          if (card.currentAssigneeType === 'TEAM') {
            assignedTeamId = resolveTeamIdFromAny(
              card.currentAssigneeId ? String(card.currentAssigneeId) : '',
              card.currentAssigneeName ? String(card.currentAssigneeName) : ''
            );
          } else if (card.currentAssigneeType === 'WORKER') {
            const workerId = String(card.currentAssigneeId ?? '').trim();
            const workerName = String(card.currentAssigneeName ?? '').trim();
            assignedTeamId = workerLookups.byAnyId.get(workerId) ?? workerLookups.byName.get(workerName) ?? '';
          }

          if (!assignedTeamId || !matchesTeam(assignedTeamId)) return null;

          const totalAmount = Math.round(toFiniteNumberOrZero(amountByCardId.get(String(card.id ?? '').trim())));
          if (totalAmount <= 0) return null;

          const cardLabel = `${card.name} (${card.last4})`;
          return {
            id: `card_billing:${params.yearMonth}:${card.id || cardLabel}:ledger`,
            source: 'auto',
            origin: 'card_billing',
            category: `카드비 (${cardLabel})`,
            amount: totalAmount,
            memo: '월별 카드 대장 자동집계'
          };
        })
        .filter((item): item is TeamSettlementDeductionItem => Boolean(item));
    }

    const postedTeamExpenseClaims = teamExpenseClaims.filter(isPostedTeamExpenseClaim);
    const teamExpenseDeductions: TeamSettlementDeductionItem[] = postedTeamExpenseClaims
      .flatMap((claim): TeamSettlementDeductionItem[] => {
        const amount = Math.round(toFiniteNumberOrZero(claim.amount));
        if (amount <= 0) return [];

        const isOtherExpense =
          claim.claimType !== 'teamCharge' ||
          !String(claim.chargeToTeamId ?? '').trim();
        const payerTeamId = resolveTeamIdFromAny(claim.payerTeamId, claim.payerTeamName);
        const chargeToTeamId = resolveTeamIdFromAny(claim.chargeToTeamId, claim.chargeToTeamName);
        const shouldDeduct = isOtherExpense
          ? Boolean(payerTeamId && matchesTeam(payerTeamId))
          : Boolean(chargeToTeamId && matchesTeam(chargeToTeamId));

        if (!shouldDeduct) return [];

        const categoryLabel = getTeamExpenseCategoryLabel(claim.category);
        const description = String(claim.description ?? '').trim();
        const counterpartyName = String(claim.payerTeamName ?? '').trim();
        const memoParts = [
          String(claim.date ?? '').trim(),
          String(claim.siteName ?? '').trim(),
          String(claim.cardLabel ?? '').trim(),
          isOtherExpense ? (claim.claimType === 'officeExpense' ? '사무실경비' : '기타청구') : `후청구: ${counterpartyName || '사용팀 미지정'}`,
          String(claim.memo ?? '').trim()
        ].filter(Boolean);

        return [{
          id: `team_expense_claim:${params.yearMonth}:${claim.id}:deduction`,
          source: 'auto',
          origin: 'team_expense_claim',
          category: `경비(${categoryLabel}${description ? ` - ${description}` : ''})`,
          amount,
          memo: memoParts.join(' / ')
        }];
      });

    const teamExpenseAdditions: TeamSettlementAdditionItem[] = postedTeamExpenseClaims
      .flatMap((claim): TeamSettlementAdditionItem[] => {
        if (claim.claimType !== 'teamCharge' || !String(claim.chargeToTeamId ?? '').trim()) return [];
        const amount = Math.round(toFiniteNumberOrZero(claim.amount));
        if (amount <= 0) return [];

        const payerTeamId = resolveTeamIdFromAny(claim.payerTeamId, claim.payerTeamName);
        if (!payerTeamId || !matchesTeam(payerTeamId)) return [];

        const categoryLabel = getTeamExpenseCategoryLabel(claim.category);
        const description = String(claim.description ?? '').trim();
        const chargeToName = String(claim.chargeToTeamName ?? '').trim();
        const memoParts = [
          String(claim.date ?? '').trim(),
          String(claim.siteName ?? '').trim(),
          String(claim.cardLabel ?? '').trim(),
          `받을 후청구: ${chargeToName || '청구대상 미지정'}`,
          String(claim.memo ?? '').trim()
        ].filter(Boolean);

        return [{
          id: `team_expense_claim:${params.yearMonth}:${claim.id}:addition`,
          source: 'auto',
          origin: 'team_expense_claim',
          category: `경비 환급(${categoryLabel}${description ? ` - ${description}` : ''})`,
          amount,
          memo: memoParts.join(' / ')
        }];
      });

    const officeExpenseManDay = roundManDay(
      dailyReportSales
        .filter((s) => s.kind === '도급' || s.kind === '직영')
        .reduce((sum, s) => sum + (Number.isFinite(s.manDay) ? s.manDay : 0), 0)
    );

    const officeExpenseDeduction: TeamSettlementDeductionItem = {
      id: `office_expense:${params.yearMonth}:${params.teamId}`,
      source: 'auto',
      origin: 'office_expense',
      category: '사무실비',
      amount: Math.round(officeExpenseManDay * 10000),
      memo: `도급+직영 총공수 ${officeExpenseManDay} * 10,000원`
    };

    const getWorkerTeamId = (r: (typeof workerRows)[number]): string => {
      const v = r.workerTeamId ? String(r.workerTeamId) : (r.teamId ? String(r.teamId) : '');
      return v.trim();
    };

    const normalizeSalaryModel = (r: (typeof workerRows)[number]): string => {
      const raw = typeof r.salaryModel === 'string' ? r.salaryModel : (typeof r.payType === 'string' ? r.payType : '');
      const trimmed = String(raw ?? '').trim();
      if (!trimmed) return '일급제';
      if (trimmed.includes('용역')) return '용역팀';
      if (trimmed.includes('월급')) return '월급제';
      if (trimmed.includes('일급') || trimmed.includes('일당')) return '일급제';
      return trimmed;
    };

    const teamWorkerRows = workerRows.filter((r) => {
      const workerTeamId = getWorkerTeamId(r);
      return workerTeamId ? matchesTeam(workerTeamId) : false;
    });

    const buildPayrollDeduction = (params2: {
      origin: 'daily_wage_payroll' | 'monthly_wage_payroll' | 'service_team_payroll';
      category: string;
      salaryModel: '일급제' | '월급제' | '용역팀';
      rows: (typeof workerRows)[number][];
    }): TeamSettlementDeductionItem | null => {
      const manDay = roundManDay(params2.rows.reduce((sum, r) => sum + (Number.isFinite(r.manDay) ? r.manDay : 0), 0));
      const amount = Math.round(params2.rows.reduce((sum, r) => sum + (Number.isFinite(r.amount) ? r.amount : 0), 0));
      if (amount <= 0 && manDay <= 0) return null;

      const workerIdSet = new Set(params2.rows.map((r) => String(r.workerId)).filter((v) => v.trim().length > 0));

      return {
        id: `payroll:${params2.origin}:${params.yearMonth}:${params.teamId}`,
        source: 'auto',
        origin: params2.origin,
        category: params2.category,
        amount,
        memo: `${params2.salaryModel} ${workerIdSet.size}명 / 총공수 ${manDay}`
      };
    };

    const dailyWageRows = teamWorkerRows.filter((r) => normalizeSalaryModel(r) === '일급제');
    const monthlyWageRows = teamWorkerRows.filter((r) => normalizeSalaryModel(r) === '월급제');
    const serviceTeamRows = workerRows.filter((r) =>
      normalizeSalaryModel(r) === '용역팀' &&
      isSelectedTeamDirectWorkRow(r)
    );

    const dailyWageDeduction = buildPayrollDeduction({
      origin: 'daily_wage_payroll',
      category: '일급제 급여',
      salaryModel: '일급제',
      rows: dailyWageRows
    });

    const monthlyWageDeduction = buildPayrollDeduction({
      origin: 'monthly_wage_payroll',
      category: '월급제 급여',
      salaryModel: '월급제',
      rows: monthlyWageRows
    });

    const serviceTeamDeduction = buildPayrollDeduction({
      origin: 'service_team_payroll',
      category: '용역팀 급여',
      salaryModel: '용역팀',
      rows: serviceTeamRows
    });

    const nowIso = new Date().toISOString();

    return {
      yearMonth: params.yearMonth,
      teamId: params.teamId,
      teamName: params.teamName,
      sales: [...dailyReportSales, ...supportFeeSales],
      purchases: [...supportFeePurchases],
      deductions: [
        officeExpenseDeduction,
        ...(dailyWageDeduction ? [dailyWageDeduction] : []),
        ...(monthlyWageDeduction ? [monthlyWageDeduction] : []),
        ...(serviceTeamDeduction ? [serviceTeamDeduction] : []),
        ...accommodationDeductions,
        ...vehicleDeductions,
        ...cardDeductions,
        ...teamExpenseDeductions
      ],
      additions: [...teamExpenseAdditions],
      summary: {
        prevCarryover: 0,
        deposit: 0
      },
      confirmedAt: null,
      updatedAt: nowIso
    };
  }
};


