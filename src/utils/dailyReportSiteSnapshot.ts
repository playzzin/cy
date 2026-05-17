import type { Site } from '../services/siteService';
import type { Team } from '../services/teamService';

interface CompanySnapshotLike {
    id?: string | null;
    legacyId?: string | null;
    name?: string | null;
}

export interface DailyReportSiteSnapshot {
    source: 'site' | 'fallback';
    siteId: string;
    siteName: string;
    clientCompanyId: string;
    clientCompanyName: string;
    constructorCompanyId: string;
    constructorCompanyName: string;
    partnerId: string;
    partnerName: string;
    siteType: string;
    paymentType: string;
    responsibleTeamId: string;
    responsibleTeamName: string;
}

export interface DailyReportSiteSnapshotFallback {
    siteId?: unknown;
    siteName?: unknown;
    companyId?: unknown;
    companyName?: unknown;
    clientCompanyId?: unknown;
    clientCompanyName?: unknown;
    constructorCompanyId?: unknown;
    constructorCompanyName?: unknown;
    partnerId?: unknown;
    partnerName?: unknown;
    siteType?: unknown;
    paymentMethod?: unknown;
    paymentType?: unknown;
    responsibleTeamId?: unknown;
    responsibleTeamName?: unknown;
}

export const toDailyReportSnapshotText = (value: unknown): string =>
    String(value ?? '').trim();

const normalizeComparableText = (value: unknown): string =>
    toDailyReportSnapshotText(value).replace(/\s+/g, '').toLowerCase();

const sameText = (left: unknown, right: unknown): boolean => {
    const normalizedLeft = normalizeComparableText(left);
    const normalizedRight = normalizeComparableText(right);
    return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
};

export const findDailyReportSite = (
    sites: Site[],
    siteId?: unknown,
    siteName?: unknown
): Site | undefined => {
    const normalizedSiteId = toDailyReportSnapshotText(siteId);
    const normalizedSiteName = toDailyReportSnapshotText(siteName);

    if (normalizedSiteId) {
        const matchedById = sites.find((site) =>
            toDailyReportSnapshotText(site.id) === normalizedSiteId ||
            toDailyReportSnapshotText(site.legacyId) === normalizedSiteId
        );
        if (matchedById) return matchedById;
    }

    if (!normalizedSiteName) return undefined;
    return sites.find((site) => sameText(site.name, normalizedSiteName));
};

export const findDailyReportTeam = (
    teams: Team[],
    teamId?: unknown,
    teamName?: unknown
): Team | undefined => {
    const normalizedTeamId = toDailyReportSnapshotText(teamId);
    const normalizedTeamName = toDailyReportSnapshotText(teamName);

    if (normalizedTeamId) {
        const matchedById = teams.find((team) =>
            toDailyReportSnapshotText(team.id) === normalizedTeamId ||
            toDailyReportSnapshotText(team.legacyId) === normalizedTeamId
        );
        if (matchedById) return matchedById;
    }

    if (!normalizedTeamName) return undefined;
    return teams.find((team) => sameText(team.name, normalizedTeamName));
};

const findDailyReportCompany = (
    companies: CompanySnapshotLike[],
    companyId?: unknown,
    companyName?: unknown
): CompanySnapshotLike | undefined => {
    const normalizedCompanyId = toDailyReportSnapshotText(companyId);
    const normalizedCompanyName = toDailyReportSnapshotText(companyName);

    if (normalizedCompanyId) {
        const matchedById = companies.find((company) =>
            toDailyReportSnapshotText(company.id) === normalizedCompanyId ||
            toDailyReportSnapshotText(company.legacyId) === normalizedCompanyId
        );
        if (matchedById) return matchedById;
    }

    if (!normalizedCompanyName) return undefined;
    return companies.find((company) => sameText(company.name, normalizedCompanyName));
};

export const buildDailyReportSiteSnapshot = (params: {
    site?: Site | null;
    siteId?: unknown;
    siteName?: unknown;
    teams?: Team[];
    companies?: CompanySnapshotLike[];
    fallback?: DailyReportSiteSnapshotFallback | null;
}): DailyReportSiteSnapshot => {
    const { site, teams = [], companies = [], fallback = null } = params;
    const hasSite = Boolean(site);
    const source: DailyReportSiteSnapshot['source'] = hasSite ? 'site' : 'fallback';

    const siteValue = (value: unknown) => hasSite ? toDailyReportSnapshotText(value) : '';
    const fallbackValue = (value: unknown) => hasSite ? '' : toDailyReportSnapshotText(value);

    const siteId = hasSite
        ? siteValue(site?.id) || siteValue(site?.legacyId) || toDailyReportSnapshotText(params.siteId) || toDailyReportSnapshotText(fallback?.siteId)
        : toDailyReportSnapshotText(params.siteId) || fallbackValue(fallback?.siteId);
    const siteName = hasSite
        ? siteValue(site?.name) || toDailyReportSnapshotText(params.siteName) || toDailyReportSnapshotText(fallback?.siteName)
        : toDailyReportSnapshotText(params.siteName) || fallbackValue(fallback?.siteName);

    const responsibleTeamSeedId = hasSite
        ? siteValue(site?.responsibleTeamId) || toDailyReportSnapshotText(fallback?.responsibleTeamId)
        : fallbackValue(fallback?.responsibleTeamId);
    const responsibleTeamSeedName = hasSite
        ? siteValue(site?.responsibleTeamName) || toDailyReportSnapshotText(fallback?.responsibleTeamName)
        : fallbackValue(fallback?.responsibleTeamName);
    const responsibleTeam = findDailyReportTeam(teams, responsibleTeamSeedId, responsibleTeamSeedName);

    const clientCompanyId = hasSite
        ? siteValue(site?.clientCompanyId) || toDailyReportSnapshotText(fallback?.clientCompanyId) || toDailyReportSnapshotText(fallback?.companyId)
        : fallbackValue(fallback?.clientCompanyId) || fallbackValue(fallback?.companyId);
    const clientCompanyName = hasSite
        ? siteValue(site?.clientCompanyName) || toDailyReportSnapshotText(fallback?.clientCompanyName) || toDailyReportSnapshotText(fallback?.companyName)
        : fallbackValue(fallback?.clientCompanyName) || fallbackValue(fallback?.companyName);
    const clientCompany = findDailyReportCompany(companies, clientCompanyId, clientCompanyName);

    const constructorCompanyId = hasSite
        ? siteValue(site?.companyId) || siteValue(site?.constructorCompanyId) || toDailyReportSnapshotText(fallback?.constructorCompanyId)
        : fallbackValue(fallback?.constructorCompanyId);
    const constructorCompanyName = hasSite
        ? siteValue(site?.companyName) || siteValue(site?.constructorCompanyName) || toDailyReportSnapshotText(fallback?.constructorCompanyName)
        : fallbackValue(fallback?.constructorCompanyName);
    const constructorCompany = findDailyReportCompany(companies, constructorCompanyId, constructorCompanyName);

    const partnerId = hasSite
        ? siteValue(site?.partnerId) || toDailyReportSnapshotText(fallback?.partnerId)
        : fallbackValue(fallback?.partnerId);
    const partnerName = hasSite
        ? siteValue(site?.partnerName) || toDailyReportSnapshotText(fallback?.partnerName)
        : fallbackValue(fallback?.partnerName);
    const partnerCompany = findDailyReportCompany(companies, partnerId, partnerName);

    return {
        source,
        siteId,
        siteName,
        clientCompanyId,
        clientCompanyName: toDailyReportSnapshotText(clientCompany?.name) || clientCompanyName,
        constructorCompanyId,
        constructorCompanyName: toDailyReportSnapshotText(constructorCompany?.name) || constructorCompanyName,
        partnerId,
        partnerName: toDailyReportSnapshotText(partnerCompany?.name) || partnerName,
        siteType: hasSite
            ? siteValue(site?.siteType) || toDailyReportSnapshotText(fallback?.siteType)
            : fallbackValue(fallback?.siteType),
        paymentType: hasSite
            ? siteValue(site?.paymentMethod) || toDailyReportSnapshotText(fallback?.paymentType) || toDailyReportSnapshotText(fallback?.paymentMethod)
            : fallbackValue(fallback?.paymentType) || fallbackValue(fallback?.paymentMethod),
        responsibleTeamId: toDailyReportSnapshotText(responsibleTeam?.id) || responsibleTeamSeedId,
        responsibleTeamName: toDailyReportSnapshotText(responsibleTeam?.name) || responsibleTeamSeedName,
    };
};

export const applyDailyReportSiteSnapshotToReport = <T extends {
    workers?: any[];
}>(report: T, snapshot: DailyReportSiteSnapshot): T => {
    const workers = Array.isArray(report.workers)
        ? report.workers.map((worker) => ({
            ...worker,
            siteType: snapshot.siteType,
            paymentType: snapshot.paymentType,
        }))
        : report.workers;

    return {
        ...report,
        siteId: snapshot.siteId,
        siteName: snapshot.siteName,
        companyId: snapshot.clientCompanyId,
        companyName: snapshot.clientCompanyName,
        constructorCompanyId: snapshot.constructorCompanyId,
        constructorCompanyName: snapshot.constructorCompanyName,
        partnerId: snapshot.partnerId,
        partnerName: snapshot.partnerName,
        siteType: snapshot.siteType,
        paymentType: snapshot.paymentType,
        responsibleTeamId: snapshot.responsibleTeamId,
        responsibleTeamName: snapshot.responsibleTeamName,
        ...(Array.isArray(workers) ? { workers } : {}),
    } as T;
};
