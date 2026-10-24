import { TeamRow, list, text } from './teamReadPolicy';
type TeamSettlementSupportDirection = '내부지원간곳' | '내부지원온곳' | '외부지원간곳' | '외부지원온곳';
export interface TeamSettlementSupportDetailRow {
 id: string; direction: TeamSettlementSupportDirection; date: string; siteId?: string; siteName: string;
 counterTeamId?: string; counterTeamName?: string; workerId: string; workerName: string;
 workerTeamId?: string; workerTeamName?: string; manDay: number; unitPrice: number; amount: number;
}
type SupportMonthlyRateOverrides = { bulkSupportRate?: number; supportTeamRates: Record<string,number>; supportAggregateRates: Record<string,number>; supportSiteRates: Record<string,number> };
const DEFAULT_SUPPORT_UNIT_PRICE = 230000;
const resolveHistoricalResponsibleTeam = (report: TeamRow, site?: TeamRow | null) => ({
 teamId: text(report.responsibleTeamId) || text(report.teamId) || text(site?.responsibleTeamId),
 teamName: text(report.responsibleTeamName) || text(report.teamName) || text(site?.responsibleTeamName)
});
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

const normalizeSupportIdentity = (value: unknown): string =>
  String(value ?? '').replace(/\(.*?\)/g, '').replace(/\s+/g, '').trim();

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


// Only explicitly selected historical view-team IDs authorize a detail row.
// Master records and original worker objects never leave this projection.
export function buildTeamSettlementSupportDetails(params: {
 teamIds: string[]; teams: TeamRow[]; sites: TeamRow[]; companies: TeamRow[]; reports: TeamRow[];
 supportRates: TeamRow[]; supportRateOverrides: SupportMonthlyRateOverrides;
}): TeamSettlementSupportDetailRow[] {
 const {teamIds, teams, sites, companies, reports, supportRates, supportRateOverrides} = params;
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

    const siteByAnyId = new Map<string, TeamRow>();
    const siteByName = new Map<string, TeamRow>();
    const setSiteIdLookup = (key: unknown, siteRow: TeamRow) => {
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

    const resolveSite = (siteId?: string, siteName?: string): TeamRow | null => {
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

      list(report.workers).forEach((reportWorker, workerIndex) => {
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
          const isSelectedViewTeam = teamIds.includes(String(entry.viewTeamId ?? ''));
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
}
