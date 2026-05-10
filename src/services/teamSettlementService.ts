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
import { dailyReportService } from './dailyReportService';
import { laborExchangeService } from './laborExchangeService';
import { manpowerService } from './manpowerService';
import { siteService, type Site } from './siteService';
import { teamService } from './teamService';
import { vehicleBillingService } from './vehicleBillingService';
import { vehicleService } from './vehicleService';
import {
  TeamSettlementDocumentSchema,
  type TeamSettlementAdditionItem,
  type TeamSettlementDeductionItem,
  type TeamSettlementDocument,
  type TeamSettlementPurchaseItem,
  type TeamSettlementSalesItem
} from '../types/teamSettlement';

const SYSTEM_CONFIG_ID_PREFIX = 'team_settlement_';

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

const isUuidString = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

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

const normalizeBillingStatus = (value: unknown): string => {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return '';
  if (raw === '확정') return 'confirmed';
  if (raw === 'draft') return 'draft';
  return raw;
};

const selectPreferredTeamBillings = <T extends { status?: unknown }>(docs: T[]): T[] => {
  if (!Array.isArray(docs) || docs.length === 0) return [];
  const confirmed = docs.filter((doc) => normalizeBillingStatus(doc.status) === 'confirmed');
  if (confirmed.length > 0) return confirmed;
  return docs;
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
  if (raw) variants.add(raw);

  let canonicalTeamId = raw;
  let teamName = '';

  try {
    const teams = await teamService.getTeams();
    const matched = teams.find((t) => String(t.id ?? '') === raw || String(t.legacyId ?? '') === raw);
    if (matched?.id) canonicalTeamId = String(matched.id);
    if (matched?.legacyId) variants.add(String(matched.legacyId));
    if (matched?.id) variants.add(String(matched.id));
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

const stripSupportOriginalLines = (doc: TeamSettlementDocument): TeamSettlementDocument => {
  return {
    ...doc,
    sales: (doc.sales ?? []).filter((s) => s.origin !== 'support_outgoing'),
    purchases: (doc.purchases ?? []).filter((p) => p.origin !== 'support_incoming')
  };
};

const mergeAutoAndDraft = (params: { autoDoc: TeamSettlementDocument; savedDoc: TeamSettlementDocument | null }): TeamSettlementDocument => {
  const { autoDoc, savedDoc } = params;
  if (!savedDoc) return autoDoc;
  if (savedDoc.confirmedAt) return savedDoc;

  const savedSalesById = new Map(savedDoc.sales.map((x) => [x.id, x] as const));
  const patchedAutoSales = autoDoc.sales.map((autoItem) => {
    const saved = savedSalesById.get(autoItem.id);
    if (!saved) return autoItem;

    const nextQuantity = typeof saved.quantity === 'number' && Number.isFinite(saved.quantity) ? saved.quantity : autoItem.quantity;
    const nextMemo = typeof saved.memo === 'string' && saved.memo.trim() ? saved.memo : autoItem.memo;

    return {
      ...autoItem,
      quantity: nextQuantity,
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

export const teamSettlementService = {
  async getTeamSettlement(params: { yearMonth: string; teamId: string }): Promise<TeamSettlementDocument> {
    const team = await buildTeamIdVariants(params.teamId);
    const systemId = buildSystemConfigId({ yearMonth: params.yearMonth, teamId: team.canonicalTeamId });

    const res = await listSystemConfigs();
    const rows = extractSystemConfigRows(res);
    const row = rows.find((r) => String(r.id ?? '') === systemId);

    const savedUnknown = typeof row?.data === 'string' ? safeJsonParse<unknown>(row.data) : null;
    const savedParsed = savedUnknown ? TeamSettlementDocumentSchema.safeParse(savedUnknown) : null;
    const savedDoc = savedParsed && savedParsed.success ? savedParsed.data : null;

    if (savedDoc?.confirmedAt) return stripSupportOriginalLines(savedDoc);

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

  async confirmTeamSettlement(params: { yearMonth: string; teamId: string }): Promise<void> {
    const doc = await this.getTeamSettlement(params);
    await this.saveTeamSettlement({
      ...doc,
      confirmedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  },

  async unconfirmTeamSettlement(params: { yearMonth: string; teamId: string }): Promise<void> {
    const doc = await this.getTeamSettlement(params);
    await this.saveTeamSettlement({
      ...doc,
      confirmedAt: null,
      updatedAt: new Date().toISOString()
    });
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

    const exchangeSnapshotInfo = await laborExchangeService.getMonthSnapshotInfo(period.year, period.month);

    const [sites, teams, workerRows, exchangeSummaries, accommodationDocs, vehicleDocs, cardDocs] = await Promise.all([
      siteService.getSites(),
      teamService.getTeams(),
      dailyReportService.getReportWorkerRowsByRange({ startDate: period.startDate, endDate: period.endDate }),
      laborExchangeService.getExchangeReport(period.year, period.month, params.teamId, { preferSnapshot: Boolean(exchangeSnapshotInfo?.confirmedAt) }),
      accommodationBillingService.getBillingDocuments({ teamId: 'all', yearMonth: params.yearMonth }),
      vehicleBillingService.getBillingsByMonth(params.yearMonth),
      cardBillingService.getBillingsByMonth(params.yearMonth)
    ]);

    const matchesTeam = (value: unknown): boolean => {
      if (typeof value !== 'string') return false;
      const trimmed = value.trim();
      if (!trimmed) return false;
      if (params.teamIdVariants.has(trimmed)) return true;
      if (isUuidString(trimmed)) return trimmed === params.teamId;
      return false;
    };

    const teamByAnyId = new Map<string, { id: string; name: string }>();
    const teamByName = new Map<string, { id: string; name: string }>();
    teams.forEach((t) => {
      const id = t?.id ? String(t.id) : '';
      const legacyId = t?.legacyId ? String(t.legacyId) : '';
      const name = t?.name ? String(t.name) : '';
      if (id) teamByAnyId.set(id, { id, name });
      if (legacyId) teamByAnyId.set(legacyId, { id, name });
      if (name) teamByName.set(name, { id, name });
    });

    const resolveTeam = (raw: unknown): { id?: string; name?: string } => {
      if (typeof raw !== 'string') return {};
      const trimmed = raw.trim();
      if (!trimmed) return {};
      const found = teamByAnyId.get(trimmed);
      if (found) return { id: found.id, name: found.name };
      return { id: trimmed };
    };

    const resolveTeamIdFromAny = (rawId?: string, rawName?: string): string => {
      const idKey = rawId ? String(rawId).trim() : '';
      if (idKey) {
        const found = teamByAnyId.get(idKey);
        if (found?.id) return String(found.id);
        return idKey;
      }
      const nameKey = rawName ? String(rawName).trim() : '';
      if (nameKey) {
        const found = teamByName.get(nameKey);
        if (found?.id) return String(found.id);
      }
      return '';
    };

    const siteByAnyId = new Map<string, Site>();
    const siteByName = new Map<string, Site>();
    sites.forEach((s) => {
      const id = s?.id ? String(s.id) : '';
      const legacyId = s?.legacyId ? String(s.legacyId) : '';
      const name = s?.name ? String(s.name) : '';
      if (id) siteByAnyId.set(id, s);
      if (legacyId) siteByAnyId.set(legacyId, s);
      if (name) siteByName.set(name, s);
    });

    const resolveSite = (siteId?: string, siteName?: string): Site | null => {
      const idKey = siteId ? String(siteId).trim() : '';
      const nameKey = siteName ? String(siteName).trim() : '';
      if (idKey && siteByAnyId.has(idKey)) return siteByAnyId.get(idKey) ?? null;
      if (nameKey && siteByName.has(nameKey)) return siteByName.get(nameKey) ?? null;
      return null;
    };

    const exchange = Array.isArray(exchangeSummaries) && exchangeSummaries.length > 0 ? exchangeSummaries[0] : null;

    const supportSalesGrouped = new Map<
      string,
      {
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
        siteId?: string;
        siteName: string;
        counterTeamId?: string;
        counterTeamName?: string;
        manDay: number;
        amountOriginal: number;
        amountFee: number;
      }
    >();

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

    (exchange?.outgoing?.items ?? []).forEach((item) => {
      const rawSiteId = String(item.siteId ?? '').trim();
      const rawSiteName = String(item.siteName ?? '').trim() || '현장 미지정';
      const site = resolveSite(rawSiteId, rawSiteName);

      const siteId = site?.id ? String(site.id) : (rawSiteId || undefined);
      const siteName = site?.name ? String(site.name) : rawSiteName;

      const rawCounterTeamId = item.reportTeamId ? String(item.reportTeamId).trim() : '';
      const rawCounterTeamName = String(item.reportTeamName ?? '').trim();
      const counter = rawCounterTeamId ? resolveTeam(rawCounterTeamId) : {};
      const counterTeamId = rawCounterTeamId || (counter.id ? String(counter.id) : '');
      const counterTeamName = rawCounterTeamName || (counter.name ? String(counter.name) : '');

      const siteKey = (siteId ? String(siteId) : '').trim() || siteName;
      const counterKey = counterTeamId || counterTeamName;
      const key = `${siteKey}__${counterKey}`;

      const current = supportSalesGrouped.get(key) ?? {
        siteId,
        siteName,
        counterTeamId: counterTeamId || undefined,
        counterTeamName: counterTeamName || undefined,
        manDay: 0,
        amountOriginal: 0,
        amountFee: 0
      };

      const itemManDay = toFiniteNumberOrZero(item.manDay);
      const itemUnitPrice = toFiniteNumberOrZero(item.unitPrice);
      const itemSupportRate = toFiniteNumberOrZero(item.supportRate);
      const feeAmount = Number.isFinite(item.amount) ? item.amount : itemManDay * itemSupportRate;
      const originalAmount = itemManDay * itemUnitPrice;

      supportSalesGrouped.set(key, {
        ...current,
        manDay: current.manDay + itemManDay,
        amountOriginal: current.amountOriginal + originalAmount,
        amountFee: current.amountFee + feeAmount
      });
    });

    (exchange?.incoming?.items ?? []).forEach((item) => {
      const rawSiteId = String(item.siteId ?? '').trim();
      const rawSiteName = String(item.siteName ?? '').trim() || '현장 미지정';
      const site = resolveSite(rawSiteId, rawSiteName);

      const siteId = site?.id ? String(site.id) : (rawSiteId || undefined);
      const siteName = site?.name ? String(site.name) : rawSiteName;

      const rawCounterTeamId = item.workerTeamId ? String(item.workerTeamId).trim() : '';
      const rawCounterTeamName = String(item.workerTeamName ?? '').trim();
      const counter = rawCounterTeamId ? resolveTeam(rawCounterTeamId) : {};
      const counterTeamId = rawCounterTeamId || (counter.id ? String(counter.id) : '');
      const counterTeamName = rawCounterTeamName || (counter.name ? String(counter.name) : '');

      const siteKey = (siteId ? String(siteId) : '').trim() || siteName;
      const counterKey = counterTeamId || counterTeamName;
      const key = `${siteKey}__${counterKey}`;

      const current = supportPurchasesGrouped.get(key) ?? {
        siteId,
        siteName,
        counterTeamId: counterTeamId || undefined,
        counterTeamName: counterTeamName || undefined,
        manDay: 0,
        amountOriginal: 0,
        amountFee: 0
      };

      const itemManDay = toFiniteNumberOrZero(item.manDay);
      const itemUnitPrice = toFiniteNumberOrZero(item.unitPrice);
      const itemSupportRate = toFiniteNumberOrZero(item.supportRate);
      const feeAmount = Number.isFinite(item.amount) ? item.amount : itemManDay * itemSupportRate;
      const originalAmount = itemManDay * itemUnitPrice;

      supportPurchasesGrouped.set(key, {
        ...current,
        manDay: current.manDay + itemManDay,
        amountOriginal: current.amountOriginal + originalAmount,
        amountFee: current.amountFee + feeAmount
      });
    });

    workerRows.forEach((row) => {
      const rawSiteId = row.siteId ? String(row.siteId) : '';
      const rawSiteName = row.siteName ? String(row.siteName) : '현장 미지정';

      const rowManDay = toFiniteNumberOrZero(row.manDay);
      const rowAmount = toFiniteNumberOrZero(row.amount);

      const site = resolveSite(rawSiteId, rawSiteName);
      const reportTeamId = row.teamId ? String(row.teamId) : '';
      const rowResponsibleTeamId = row.responsibleTeamId ? String(row.responsibleTeamId) : '';
      const siteResponsibleTeamId = site?.responsibleTeamId ? String(site.responsibleTeamId) : '';
      const responsibleTeamId = siteResponsibleTeamId || rowResponsibleTeamId || reportTeamId;

      const isManagedSiteStrict = matchesTeam(responsibleTeamId);
      if (!isManagedSiteStrict) return;

      const rowSiteType = String(row.siteType ?? '').trim();
      const resolvedSiteType = rowSiteType || String(site?.siteType ?? '').trim();
      const managedKind: '도급' | '직영' | '지원' =
        resolvedSiteType === '도급' || resolvedSiteType === '직영' || resolvedSiteType === '지원' ? resolvedSiteType : '직영';

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
      return {
        id: `daily_report_sales:${params.yearMonth}:${key}`,
        source: 'auto',
        origin: 'daily_report',
        kind: value.kind,
        siteId: value.siteId,
        siteName: value.siteName,
        counterTeamId: undefined,
        counterTeamName: undefined,
        manDay: roundManDay(value.manDay),
        amount: value.amount
      };
    });

    const supportFeeSales: TeamSettlementSalesItem[] = Array.from(supportSalesGrouped.entries())
      .filter(([, value]) => Number.isFinite(value.amountFee) && value.amountFee > 0)
      .map(([key, value]) => {
        return {
          id: `labor_exchange_support_fee_sales:${params.yearMonth}:${key}`,
          source: 'auto',
          origin: 'support_fee_outgoing',
          kind: '지원',
          siteId: value.siteId,
          siteName: value.siteName,
          counterTeamId: value.counterTeamId,
          counterTeamName: value.counterTeamName,
          manDay: roundManDay(value.manDay),
          amount: Math.round(value.amountFee)
        };
      });

    const supportFeePurchases: TeamSettlementPurchaseItem[] = Array.from(supportPurchasesGrouped.entries())
      .filter(([, value]) => Number.isFinite(value.amountFee) && value.amountFee > 0)
      .map(([key, value]) => {
        return {
          id: `labor_exchange_support_fee_purchases:${params.yearMonth}:${key}`,
          source: 'auto',
          origin: 'support_fee_incoming',
          kind: '지원',
          siteId: value.siteId,
          siteName: value.siteName,
          counterTeamId: value.counterTeamId,
          counterTeamName: value.counterTeamName,
          manDay: roundManDay(value.manDay),
          amount: Math.round(value.amountFee)
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

    const [assignmentRows, utilityRecords] = await Promise.all([
      accommodationAssignmentService.getAllAssignments(),
      accommodationService.getMonthlyLedger(params.yearMonth)
    ]);

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

    let accommodationDeductions: TeamSettlementDeductionItem[] = Array.from(utilityTotalByAccommodation.entries())
      .filter(([, amount]) => Number.isFinite(amount) && amount > 0)
      .map(([accommodationId, amount]): TeamSettlementDeductionItem => ({
        id: `accommodation_billing:${params.yearMonth}:ledger:${accommodationId}`,
        source: 'auto',
        origin: 'accommodation_billing',
        category: `숙소비 (${accommodationNameById.get(accommodationId) ?? accommodationId})`,
        amount,
        memo: '월별 공과금 대장 자동집계'
      }));

    if (accommodationDeductions.length === 0) {
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
      const selectedAccommodationDocs = selectPreferredTeamBillings(teamAccommodationDocs);

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

    const teamVehicleDocs = vehicleDocs.filter((doc) => {
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
    });
    const selectedVehicleDocs = selectPreferredTeamBillings(teamVehicleDocs);

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

    if (vehicleDeductions.length === 0) {
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

    const teamCardDocs = cardDocs.filter((doc) => {
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
    });
    const selectedCardDocs = selectPreferredTeamBillings(teamCardDocs);

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

    if (cardDeductions.length === 0) {
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
      return trimmed || '일급제';
    };

    const teamWorkerRows = workerRows.filter((r) => {
      const workerTeamId = getWorkerTeamId(r);
      return workerTeamId ? matchesTeam(workerTeamId) : false;
    });

    const buildPayrollDeduction = (params2: {
      origin: 'daily_wage_payroll' | 'monthly_wage_payroll';
      category: string;
      salaryModel: '일급제' | '월급제';
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
        ...accommodationDeductions,
        ...vehicleDeductions,
        ...cardDeductions
      ],
      additions: [],
      summary: {
        prevCarryover: 0,
        deposit: 0
      },
      confirmedAt: null,
      updatedAt: nowIso
    };
  }
};


