import {
  createSystemConfig,
  listSystemConfigs,
  updateSystemConfig,
  type CreateSystemConfigVariables,
  type UpdateSystemConfigVariables
} from '../services/firestoreCrudCompat';
import { getTeamScopedRows } from './teamScopedReadService';
import { accommodationBillingService } from './accommodationBillingService';
import { cardBillingService } from './cardBillingService';
import { companyService } from './companyService';
import { dailyReportService } from './dailyReportService';
import { siteService, type Site } from './siteService';
import { supportClientSiteAllocationService, type SupportClientAllocation } from './supportClientSiteAllocationService';
import { supportRateService } from './supportRateService';
import { teamExpenseLedgerService } from './teamExpenseLedgerService';
import { teamService } from './teamService';
import { vehicleBillingService } from './vehicleBillingService';
import {
  TeamSettlementDocumentSchema,
  type TeamSettlementAdditionItem,
  type TeamSettlementDeductionItem,
  type TeamSettlementDocument,
  type TeamSettlementPurchaseItem,
  type TeamSettlementSalesItem,
  type TeamSettlementSupportDetailSnapshot
} from '../types/teamSettlement';
import { resolveHistoricalResponsibleTeam } from '../utils/dailyReportHistoricalSite';
import {
  DEFAULT_SUPPORT_UNIT_PRICE,
  hasSupportRateOverrides,
  mergeSupportRateOverridePatch,
  normalizeSupportRateOverrides,
  type SupportMonthlyRateOverridePatch,
  type SupportMonthlyRateOverrides
} from '../utils/teamSettlementSupportRateOverrides';
import { getTeamSettlementConfirmationIssues } from '../utils/teamSettlementDraft';
import { compactTeamSettlementAutoMemo } from '../utils/teamSettlementMemo';
import { buildTeamSettlementExpenseEntries } from '../utils/teamSettlementExpenses';
import { calculateTeamSettlementOfficeExpense, TEAM_SETTLEMENT_OFFICE_RATES } from '../utils/teamSettlementOfficeExpense';

export type {
  SupportMonthlyRateOverridePatch,
  SupportMonthlyRateOverrides
} from '../utils/teamSettlementSupportRateOverrides';

const SYSTEM_CONFIG_ID_PREFIX = 'team_settlement_';
const TEAM_DISPLAY_ORDER_CONFIG_ID = 'team_settlement_team_display_order_v1';
const SUPPORT_RATE_OVERRIDE_CONFIG_ID_PREFIX = 'team_settlement_support_rate_overrides_v1_';

export type TeamSettlementSupportDirection = '내부지원간곳' | '내부지원온곳' | '외부지원간곳' | '외부지원온곳';

export type TeamSettlementSupportDetailRow = TeamSettlementSupportDetailSnapshot;

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

const loadLocalSupportRateOverrides = (yearMonth: string): SupportMonthlyRateOverrides => {
  if (typeof window === 'undefined' || !yearMonth) return normalizeSupportRateOverrides(undefined);
  try {
    const raw = window.localStorage.getItem(getSupportRateOverrideStorageKey(yearMonth));
    if (!raw) return normalizeSupportRateOverrides(undefined);
    return normalizeSupportRateOverrides(JSON.parse(raw) as Partial<SupportMonthlyRateOverrides>);
  } catch {
    return normalizeSupportRateOverrides(undefined);
  }
};

const getSupportRateOverrideConfigId = (yearMonth: string): string =>
  `${SUPPORT_RATE_OVERRIDE_CONFIG_ID_PREFIX}${yearMonth}`;

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
    return stripSupportOriginalLines(savedDoc);
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
    transactionMemo: savedDoc.transactionMemo,
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

const upsertSystemConfigPayload = async (id: string, payload: string): Promise<void> => {
  const updateVars: UpdateSystemConfigVariables = { id, data: payload };
  const createVars: CreateSystemConfigVariables = { id, data: payload };

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
  async getSupportRateOverrides(yearMonth: string): Promise<SupportMonthlyRateOverrides> {
    const normalizedYearMonth = String(yearMonth ?? '').trim();
    if (!/^\d{4}-\d{2}$/.test(normalizedYearMonth)) {
      return normalizeSupportRateOverrides(undefined);
    }

    const res = await listSystemConfigs({ configId: getSupportRateOverrideConfigId(normalizedYearMonth) });
    const rows = extractSystemConfigRows(res);
    const row = rows.find((item) => String(item.id ?? '') === getSupportRateOverrideConfigId(normalizedYearMonth));

    if (typeof row?.data === 'string') {
      const parsed = safeJsonParse<Partial<SupportMonthlyRateOverrides> & {
        overrides?: Partial<SupportMonthlyRateOverrides>;
      }>(row.data);
      if (parsed) {
        return normalizeSupportRateOverrides(parsed.overrides ?? parsed);
      }
    }

    // 예전에 이 브라우저에만 저장된 단가는 서버 설정이 없는 달에 한 번 자동 이관한다.
    const localOverrides = loadLocalSupportRateOverrides(normalizedYearMonth);
    if (hasSupportRateOverrides(localOverrides)) {
      await this.saveSupportRateOverrides(normalizedYearMonth, localOverrides);
      return localOverrides;
    }

    return normalizeSupportRateOverrides(undefined);
  },

  async saveSupportRateOverrides(
    yearMonth: string,
    overrides: SupportMonthlyRateOverrides
  ): Promise<SupportMonthlyRateOverrides> {
    const normalizedYearMonth = String(yearMonth ?? '').trim();
    if (!/^\d{4}-\d{2}$/.test(normalizedYearMonth)) {
      throw new Error('지원단가 저장 월이 올바르지 않습니다.');
    }

    const normalized = normalizeSupportRateOverrides(overrides);
    await upsertSystemConfigPayload(
      getSupportRateOverrideConfigId(normalizedYearMonth),
      JSON.stringify({
        version: 1,
        yearMonth: normalizedYearMonth,
        overrides: normalized,
        updatedAt: new Date().toISOString()
      })
    );
    return normalized;
  },

  async saveSupportRateOverridePatch(
    yearMonth: string,
    patch: SupportMonthlyRateOverridePatch
  ): Promise<SupportMonthlyRateOverrides> {
    const current = await this.getSupportRateOverrides(yearMonth);
    const next = mergeSupportRateOverridePatch(current, patch);
    return this.saveSupportRateOverrides(yearMonth, next);
  },

  async getTeamDisplayOrder(): Promise<string[]> {
    const res = await listSystemConfigs({ configId: TEAM_DISPLAY_ORDER_CONFIG_ID });
    const rows = extractSystemConfigRows(res);
    const row = rows.find((item) => String(item.id ?? '') === TEAM_DISPLAY_ORDER_CONFIG_ID);
    const parsed = typeof row?.data === 'string'
      ? safeJsonParse<{ teamIds?: unknown }>(row.data)
      : null;
    const teamIds = Array.isArray(parsed?.teamIds) ? parsed.teamIds : [];
    return Array.from(new Set(teamIds.map((value) => String(value ?? '').trim()).filter(Boolean)));
  },

  async saveTeamDisplayOrder(teamIds: string[]): Promise<void> {
    const normalizedTeamIds = Array.from(new Set(
      teamIds.map((value) => String(value ?? '').trim()).filter(Boolean)
    ));
    await upsertSystemConfigPayload(TEAM_DISPLAY_ORDER_CONFIG_ID, JSON.stringify({
      version: 1,
      teamIds: normalizedTeamIds,
      updatedAt: new Date().toISOString()
    }));
  },

  async resetTeamDisplayOrder(): Promise<void> {
    await this.saveTeamDisplayOrder([]);
  },

  async getSupportSettlementDetailRows(params: { yearMonth: string; teamId: string }): Promise<TeamSettlementSupportDetailRow[]> {
    const scoped = await getTeamScopedRows<TeamSettlementSupportDetailRow>('team_settlement_support_details', params);
    if (scoped !== null) return scoped;
    const team = await buildTeamIdVariants(params.teamId);
    const period = getMonthRange(params.yearMonth);

    const [sites, teams, companies, reports, supportRates, supportRateOverrides] = await Promise.all([
      siteService.getSites(),
      teamService.getTeams(),
      companyService.getCompanies(),
      dailyReportService.getReportsByRange(period.startDate, period.endDate),
      supportRateService.getAllSiteRates(),
      this.getSupportRateOverrides(params.yearMonth)
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
      const siteId = rawSiteId || (site?.id ? String(site.id) : undefined);
      const siteName = rawSiteName || (site?.name ? String(site.name) : '현장 미지정');

      const siteConstructorCompanyId = String(report.constructorCompanyId ?? report.companyId ?? site?.constructorCompanyId ?? site?.companyId ?? '').trim();
      const siteConstructorCompanyName = String(report.constructorCompanyName ?? report.companyName ?? site?.constructorCompanyName ?? site?.companyName ?? '').trim();
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

        const historicalResponsibleTeam = resolveHistoricalResponsibleTeam(report, site);
        const targetTeamIdRaw = historicalResponsibleTeam.teamId;
        const targetTeamNameRaw = historicalResponsibleTeam.teamName;
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
        const baseSupportRate = configuredSupportRate ?? sourceTeamSupportRate ?? DEFAULT_SUPPORT_UNIT_PRICE;
        const manDay = toFiniteNumberOrZero(reportWorker.manDay);
        if (manDay <= 0) return;

        entries.forEach((entry) => {
          const isSelectedViewTeam = matchesTeam(String(entry.viewTeamId ?? '')) || isSameTeamIdentity(entry.viewTeamId, entry.viewTeamName, team.canonicalTeamId, team.teamName);
          if (!isSelectedViewTeam) return;

          const supportUnitPrice = resolveSupportUnitRate({
            overrides: supportRateOverrides,
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

    const res = await listSystemConfigs({ configId: systemId });
    const rows = extractSystemConfigRows(res);
    const row = rows.find((r) => String(r.id ?? '') === systemId);

    const savedUnknown = typeof row?.data === 'string' ? safeJsonParse<unknown>(row.data) : null;
    const savedParsed = savedUnknown ? TeamSettlementDocumentSchema.safeParse(savedUnknown) : null;
    const savedDoc = savedParsed && savedParsed.success ? savedParsed.data : null;

    // 저장된 스냅샷은 명시적인 재집계 전까지 그대로 사용한다.
    // 확정된 구 문서도 현재 마스터 데이터로 다시 계산하지 않아 과거 정산을 보호한다.
    if (savedDoc?.sourceSnapshot || savedDoc?.confirmedAt) {
      const stableDocument = stripSupportOriginalLines(savedDoc);
      return stableDocument;
    }

    const autoDoc = await this.calculateAutoSettlement({
      yearMonth: params.yearMonth,
      teamId: team.canonicalTeamId,
      teamName: team.teamName,
      teamIdVariants: team.variants
    });

    const merged = mergeAutoAndDraft({ autoDoc, savedDoc });
    // 최초 조회 또는 구 문서 보완 시 계산 결과를 즉시 저장해 같은 월의 원천을 고정한다.
    await this.saveTeamSettlement(merged);
    return merged;
  },

  async recalculateAndSaveTeamSettlement(params: { yearMonth: string; teamId: string; keepConfirmed?: boolean }): Promise<void> {
    const team = await buildTeamIdVariants(params.teamId);
    const systemId = buildSystemConfigId({ yearMonth: params.yearMonth, teamId: team.canonicalTeamId });

    const res = await listSystemConfigs({ configId: systemId });
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
    await upsertSystemConfigPayload(systemId, payload);
  },

  async saveAndConfirmTeamSettlement(doc: TeamSettlementDocument): Promise<TeamSettlementDocument> {
    const parsed = TeamSettlementDocumentSchema.parse(doc);
    const team = await buildTeamIdVariants(parsed.teamId);
    const autoDoc = await this.calculateAutoSettlement({
      yearMonth: parsed.yearMonth,
      teamId: team.canonicalTeamId,
      teamName: parsed.teamName || team.teamName,
      teamIdVariants: team.variants
    });
    const refreshed = mergeAutoAndDraft({
      autoDoc,
      savedDoc: { ...parsed, confirmedAt: null }
    });
    const confirmationIssues = getTeamSettlementConfirmationIssues(refreshed);
    if (confirmationIssues.length > 0) {
      throw new Error(`team-settlement-confirmation-blocked:${confirmationIssues[0]?.code ?? 'validation'}`);
    }
    const now = new Date().toISOString();
    const nextDoc: TeamSettlementDocument = {
      ...refreshed,
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
    await this.saveAndConfirmTeamSettlement(doc);
  },

  async unconfirmTeamSettlement(params: { yearMonth: string; teamId: string }): Promise<TeamSettlementDocument> {
    const doc = await this.getTeamSettlement(params);
    const nextDoc: TeamSettlementDocument = {
      ...doc,
      confirmedAt: null,
      updatedAt: new Date().toISOString()
    };
    await this.saveTeamSettlement(nextDoc);
    await notifyTeamSettlementSystemMessage('teamSettlement.unconfirmed', nextDoc);
    return nextDoc;
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
      supportRateOverrides,
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
      this.getSupportRateOverrides(params.yearMonth),
      supportClientSiteAllocationService.getAllocationsByMonth(params.yearMonth).catch(() => [] as SupportClientAllocation[]),
      accommodationBillingService.getBillingDocuments({ teamId: 'all', yearMonth: params.yearMonth, strict: true }),
      vehicleBillingService.getBillingsByMonth(params.yearMonth, { throwOnError: true }),
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
    const supportDetailSnapshots: TeamSettlementSupportDetailSnapshot[] = [];

    const getWorkerRowResponsibleTeamId = (row: (typeof workerRows)[number]): string => {
      const rawSiteId = row.siteId ? String(row.siteId) : '';
      const rawSiteName = row.siteName ? String(row.siteName) : '현장 미지정';
      const site = resolveSite(rawSiteId, rawSiteName);
      const historicalResponsibleTeam = resolveHistoricalResponsibleTeam(row, site);
      return historicalResponsibleTeam.teamId || historicalResponsibleTeam.teamName;
    };

    const getWorkerRowManagedKind = (row: (typeof workerRows)[number]): '도급' | '직영' | '지원' => {
      const rowSiteType = String(row.siteType ?? '').trim();
      return rowSiteType === '도급' || rowSiteType === '직영' || rowSiteType === '지원'
        ? rowSiteType
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
      const siteId = rawSiteId || (site?.id ? String(site.id) : undefined);
      const siteName = rawSiteName || (site?.name ? String(site.name) : '현장 미지정');

      const siteConstructorCompanyId = String(
        report.constructorCompanyId ?? report.companyId ?? site?.constructorCompanyId ?? site?.companyId ?? ''
      ).trim();
      const siteConstructorCompanyName = String(
        report.constructorCompanyName ?? report.companyName ?? site?.constructorCompanyName ?? site?.companyName ?? ''
      ).trim();
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

        const historicalResponsibleTeam = resolveHistoricalResponsibleTeam(report, site);
        const targetTeamIdRaw = historicalResponsibleTeam.teamId;
        const targetTeamNameRaw = historicalResponsibleTeam.teamName;
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
        const baseSupportRate = configuredSupportRate ?? sourceTeamSupportRate ?? DEFAULT_SUPPORT_UNIT_PRICE;
        const manDay = toFiniteNumberOrZero(reportWorker.manDay);
        if (manDay <= 0) return;

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

          supportDetailSnapshots.push({
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

          addSupportSettlementLine(targetMap, { manDay, unitPrice: reportWorker.unitPrice }, entry, siteId, siteName, supportUnitPrice);
        });
      });
    });

    workerRows.forEach((row) => {
      const rawSiteId = row.siteId ? String(row.siteId) : '';
      const rawSiteName = row.siteName ? String(row.siteName) : '현장 미지정';

      const rowManDay = toFiniteNumberOrZero(row.manDay);
      const rowAmount = toFiniteNumberOrZero(row.amount);

      const responsibleTeamId = getWorkerRowResponsibleTeamId(row);

      const isManagedSiteStrict = matchesTeam(responsibleTeamId);
      if (!isManagedSiteStrict) return;

      const managedKind = getWorkerRowManagedKind(row);

      if (managedKind !== '도급' && managedKind !== '직영') return;

      const siteKey = rawSiteId || rawSiteName;
      const key = `${managedKind}__${siteKey}__`;

      const current = managedSalesGrouped.get(key) ?? {
        siteId: rawSiteId || undefined,
        siteName: rawSiteName,
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

    const expenseEntries = buildTeamSettlementExpenseEntries({
      yearMonth: params.yearMonth,
      matchesTeam: (id, name) => {
        const resolved = resolveTeamIdFromAny(String(id ?? ''), String(name ?? ''));
        return Boolean(resolved && matchesTeam(resolved));
      },
      accommodationDocs, vehicleDocs, cardDocs, teamExpenseClaims
    });

    const officeExpense = calculateTeamSettlementOfficeExpense(dailyReportSales);

    const officeExpenseDeduction: TeamSettlementDeductionItem = {
      id: `office_expense:${params.yearMonth}:${params.teamId}`,
      source: 'auto',
      origin: 'office_expense',
      category: '사무실비',
      amount: officeExpense.totalAmount,
      officeExpenseRates: { ...TEAM_SETTLEMENT_OFFICE_RATES },
      memo: officeExpense.memo
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
    const sales = [...dailyReportSales, ...supportFeeSales];
    const purchases = [...supportFeePurchases];
    const deductions = [
      officeExpenseDeduction,
      ...(dailyWageDeduction ? [dailyWageDeduction] : []),
      ...(monthlyWageDeduction ? [monthlyWageDeduction] : []),
      ...(serviceTeamDeduction ? [serviceTeamDeduction] : []),
      ...expenseEntries.filter(entry => entry.direction === 'deduction').map(entry => entry.item as TeamSettlementDeductionItem)
    ];
    const additions = expenseEntries.filter(entry => entry.direction === 'addition').map(entry => entry.item as TeamSettlementAdditionItem);
    const sumAmounts = (rows: Array<{ amount: number }>): number => Math.round(
      rows.reduce((sum, row) => sum + toFiniteNumberOrZero(row.amount), 0)
    );
    const sourceTotals = {
      sales: sumAmounts(sales),
      purchases: sumAmounts(purchases),
      deductions: sumAmounts(deductions),
      additions: sumAmounts(additions),
      net: 0
    };
    sourceTotals.net = sourceTotals.sales - sourceTotals.purchases - sourceTotals.deductions + sourceTotals.additions;

    const relevantReportSnapshots = supportReports
      .filter((report) => {
        const reportSite = resolveSite(String(report.siteId ?? ''), String(report.siteName ?? ''));
        const historicalResponsibleTeam = resolveHistoricalResponsibleTeam(report, reportSite);
        if (matchesTeam(historicalResponsibleTeam.teamId) || matchesTeam(historicalResponsibleTeam.teamName)) return true;
        if (matchesTeam(report.teamId) || matchesTeam(report.teamName)) return true;
        return (report.workers ?? []).some((worker) =>
          matchesTeam(worker.teamId) || matchesTeam(worker.workerTeamName)
        );
      })
      .map((report, index) => {
        const reportSite = resolveSite(String(report.siteId ?? ''), String(report.siteName ?? ''));
        const historicalResponsibleTeam = resolveHistoricalResponsibleTeam(report, reportSite);
        const teamAssignmentMissing = !String(report.responsibleTeamId ?? '').trim()
          && !String(report.responsibleTeamName ?? '').trim()
          && !String(report.teamId ?? '').trim()
          && !String(report.teamName ?? '').trim();
        const workerTeamIds = Array.from(new Set(
          (report.workers ?? []).map((worker) => String(worker.teamId ?? '').trim()).filter(Boolean)
        ));
        const workerTeamNames = Array.from(new Set(
          (report.workers ?? []).map((worker) => String(worker.workerTeamName ?? '').trim()).filter(Boolean)
        ));
        return {
          reportId: String(report.id ?? '').trim() || `${report.date}:${report.siteId}:${report.teamId}:${index}`,
          date: String(report.date ?? '').trim(),
          reportTeamId: String(report.teamId ?? '').trim(),
          reportTeamName: String(report.teamName ?? '').trim(),
          siteId: String(report.siteId ?? '').trim(),
          siteName: String(report.siteName ?? '').trim(),
          responsibleTeamId: historicalResponsibleTeam.teamId,
          responsibleTeamName: historicalResponsibleTeam.teamName,
          teamAssignmentMissing,
          workerTeamIds,
          workerTeamNames
        };
      });

    return {
      yearMonth: params.yearMonth,
      teamId: params.teamId,
      teamName: params.teamName,
      sales: sales.map(compactTeamSettlementAutoMemo),
      purchases: purchases.map(compactTeamSettlementAutoMemo),
      deductions: deductions.map(compactTeamSettlementAutoMemo),
      additions: additions.map(compactTeamSettlementAutoMemo),
      summary: {
        prevCarryover: 0,
        deposit: 0
      },
      sourceSnapshot: {
        version: 2,
        capturedAt: nowIso,
        dailyReports: relevantReportSnapshots,
        supportDetails: supportDetailSnapshots,
        totals: sourceTotals
      },
      confirmedAt: null,
      updatedAt: nowIso
    };
  }
};


