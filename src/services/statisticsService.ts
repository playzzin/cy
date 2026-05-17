import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';
import { dailyReportService } from './dailyReportService';
import { manpowerService } from './manpowerService';
import { teamService } from './teamService';
import { siteService } from './siteService';
import { companyService } from './companyService';

interface ManpowerStats {
    workerStats: { [workerId: string]: number };
    teamStats: { [teamId: string]: number };
    siteStats: { [siteIdOrName: string]: number };
    companyStats: { [companyId: string]: number };
    companyClientStats: { [companyId: string]: number };
    companyConstructorStats: { [companyId: string]: number };
    companyPartnerStats: { [companyId: string]: number };
}

interface RebuildCumulativeManDaysResult {
    reportsProcessed: number;
    workersUpdated: number;
    teamsUpdated: number;
    sitesUpdated: number;
    companiesUpdated: number;
    workerRowsSkipped: number;
    reportsWithoutTeam: number;
    reportsWithoutSite: number;
    reportsWithoutClientCompany: number;
    reportsWithoutConstructorCompany: number;
    reportsWithoutPartnerCompany: number;
}

type Entity = {
    id?: string | null;
    legacyId?: string | null;
    name?: string | null;
};

const toText = (value: unknown): string => String(value ?? '').trim();

const normalizeName = (value: unknown): string => toText(value).replace(/\s+/g, '').toLowerCase();

const toManDay = (value: unknown): number => {
    const next = Number(value);
    return Number.isFinite(next) ? next : 0;
};

const roundManDay = (value: number): number => Math.round(value * 10) / 10;

const addAmount = (target: Record<string, number>, key: string, amount: number) => {
    if (!key || amount === 0) return;
    target[key] = (target[key] || 0) + amount;
};

const buildEntityResolver = <T extends Entity>(items: T[]) => {
    const byAnyId = new Map<string, T>();
    const byName = new Map<string, T>();

    items.forEach((item) => {
        const id = toText(item.id);
        const legacyId = toText(item.legacyId);
        const name = normalizeName(item.name);
        if (id) byAnyId.set(id, item);
        if (legacyId) byAnyId.set(legacyId, item);
        if (name) byName.set(name, item);
    });

    const resolve = (id?: unknown, name?: unknown): T | undefined => {
        const rawId = toText(id);
        if (rawId) {
            const found = byAnyId.get(rawId);
            if (found) return found;
        }

        const rawName = normalizeName(name);
        return rawName ? byName.get(rawName) : undefined;
    };

    const canonicalId = (id?: unknown, name?: unknown): string => {
        const found = resolve(id, name);
        return toText(found?.id) || toText(id);
    };

    return { resolve, canonicalId };
};

const createStatsSnapshot = async (): Promise<{
    stats: ManpowerStats;
    result: RebuildCumulativeManDaysResult;
}> => {
    const [reports, workers, teams, sites, companies] = await Promise.all([
        dailyReportService.getAllReports(),
        manpowerService.getWorkers(true),
        teamService.getTeams(),
        siteService.getSites(),
        companyService.getCompanies(),
    ]);

    const workerResolver = buildEntityResolver(workers);
    const teamResolver = buildEntityResolver(teams);
    const siteResolver = buildEntityResolver(sites);
    const companyResolver = buildEntityResolver(companies);

    const stats: ManpowerStats = {
        workerStats: {},
        teamStats: {},
        siteStats: {},
        companyStats: {},
        companyClientStats: {},
        companyConstructorStats: {},
        companyPartnerStats: {},
    };

    const result: RebuildCumulativeManDaysResult = {
        reportsProcessed: reports.length,
        workersUpdated: 0,
        teamsUpdated: 0,
        sitesUpdated: 0,
        companiesUpdated: 0,
        workerRowsSkipped: 0,
        reportsWithoutTeam: 0,
        reportsWithoutSite: 0,
        reportsWithoutClientCompany: 0,
        reportsWithoutConstructorCompany: 0,
        reportsWithoutPartnerCompany: 0,
    };

    reports.forEach((report: any) => {
        const rows = Array.isArray(report?.workers) ? report.workers : [];
        const reportTotalManDay = rows.reduce((sum: number, row: any) => {
            return sum + toManDay(row?.manDay ?? row?.gongsu);
        }, 0);

        rows.forEach((row: any) => {
            const workerId = workerResolver.canonicalId(row?.workerId ?? row?.id, row?.name);
            if (!workerId || workerId.startsWith('unknown') || workerId.startsWith('__empty__')) {
                result.workerRowsSkipped += 1;
                return;
            }
            addAmount(stats.workerStats, workerId, toManDay(row?.manDay ?? row?.gongsu));
        });

        const teamId = teamResolver.canonicalId(report?.teamId, report?.teamName);
        if (teamId) addAmount(stats.teamStats, teamId, reportTotalManDay);
        else if (reportTotalManDay > 0) result.reportsWithoutTeam += 1;

        const site = siteResolver.resolve(report?.siteId, report?.siteName);
        const siteId = toText(site?.id) || toText(report?.siteId) || toText(report?.siteName);
        if (siteId) addAmount(stats.siteStats, siteId, reportTotalManDay);
        else if (reportTotalManDay > 0) result.reportsWithoutSite += 1;

        const clientCompanyId = site
            ? companyResolver.canonicalId((site as any).clientCompanyId, (site as any).clientCompanyName)
            : '';
        const fallbackCompanyId = companyResolver.canonicalId(report?.companyId, report?.companyName);
        const companyId = clientCompanyId || fallbackCompanyId;

        if (companyId) {
            addAmount(stats.companyStats, companyId, reportTotalManDay);
            addAmount(stats.companyClientStats, companyId, reportTotalManDay);
        }
        else if (reportTotalManDay > 0) result.reportsWithoutClientCompany += 1;

        const constructorCompanyId = site
            ? companyResolver.canonicalId(
                (site as any).companyId || (site as any).constructorCompanyId,
                (site as any).companyName || (site as any).constructorCompanyName
            )
            : '';
        const fallbackConstructorCompanyId = companyResolver.canonicalId(
            report?.constructorCompanyId,
            report?.constructorCompanyName
        );
        const resolvedConstructorCompanyId = constructorCompanyId || fallbackConstructorCompanyId;

        if (resolvedConstructorCompanyId) {
            addAmount(stats.companyConstructorStats, resolvedConstructorCompanyId, reportTotalManDay);
        } else if (reportTotalManDay > 0) {
            result.reportsWithoutConstructorCompany += 1;
        }

        const partnerCompanyId = site
            ? companyResolver.canonicalId((site as any).partnerId, (site as any).partnerName)
            : '';
        const fallbackPartnerCompanyId = companyResolver.canonicalId(report?.partnerId, report?.partnerName);
        const resolvedPartnerCompanyId = partnerCompanyId || fallbackPartnerCompanyId;

        if (resolvedPartnerCompanyId) {
            addAmount(stats.companyPartnerStats, resolvedPartnerCompanyId, reportTotalManDay);
        } else if (reportTotalManDay > 0) {
            result.reportsWithoutPartnerCompany += 1;
        }
    });

    Object.keys(stats.workerStats).forEach((key) => { stats.workerStats[key] = roundManDay(stats.workerStats[key]); });
    Object.keys(stats.teamStats).forEach((key) => { stats.teamStats[key] = roundManDay(stats.teamStats[key]); });
    Object.keys(stats.siteStats).forEach((key) => { stats.siteStats[key] = roundManDay(stats.siteStats[key]); });
    Object.keys(stats.companyStats).forEach((key) => { stats.companyStats[key] = roundManDay(stats.companyStats[key]); });
    Object.keys(stats.companyClientStats).forEach((key) => { stats.companyClientStats[key] = roundManDay(stats.companyClientStats[key]); });
    Object.keys(stats.companyConstructorStats).forEach((key) => { stats.companyConstructorStats[key] = roundManDay(stats.companyConstructorStats[key]); });
    Object.keys(stats.companyPartnerStats).forEach((key) => { stats.companyPartnerStats[key] = roundManDay(stats.companyPartnerStats[key]); });

    result.workersUpdated = Object.keys(stats.workerStats).length;
    result.teamsUpdated = Object.keys(stats.teamStats).length;
    result.sitesUpdated = Object.keys(stats.siteStats).length;
    result.companiesUpdated = new Set([
        ...Object.keys(stats.companyStats),
        ...Object.keys(stats.companyConstructorStats),
        ...Object.keys(stats.companyPartnerStats),
    ]).size;

    return { stats, result };
};

const commitCompanyExactTotals = async (
    ids: string[],
    stats: Pick<ManpowerStats, 'companyClientStats' | 'companyConstructorStats' | 'companyPartnerStats'>
) => {
    const chunks: string[][] = [];
    for (let index = 0; index < ids.length; index += 400) {
        chunks.push(ids.slice(index, index + 400));
    }

    for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach((id) => {
            const clientTotalManDay = roundManDay(stats.companyClientStats[id] || 0);
            batch.update(doc(collection(db, 'companies'), id), {
                totalManDay: clientTotalManDay,
                clientTotalManDay,
                constructorTotalManDay: roundManDay(stats.companyConstructorStats[id] || 0),
                partnerTotalManDay: roundManDay(stats.companyPartnerStats[id] || 0),
                updatedAt: serverTimestamp(),
            });
        });
        await batch.commit();
    }
};

const commitExactTotals = async (
    collectionName: 'workers' | 'teams' | 'sites' | 'companies',
    ids: string[],
    totals: Record<string, number>
) => {
    const chunks: string[][] = [];
    for (let index = 0; index < ids.length; index += 400) {
        chunks.push(ids.slice(index, index + 400));
    }

    for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach((id) => {
            batch.update(doc(collection(db, collectionName), id), {
                totalManDay: roundManDay(totals[id] || 0),
                updatedAt: serverTimestamp(),
            });
        });
        await batch.commit();
    }
};

export const statisticsService = {
    async getCumulativeManpower(): Promise<ManpowerStats> {
        try {
            const { stats } = await createStatsSnapshot();
            return stats;
        } catch (error) {
            console.error('Failed to calculate cumulative stats:', error);
            return {
                workerStats: {},
                teamStats: {},
                siteStats: {},
                companyStats: {},
                companyClientStats: {},
                companyConstructorStats: {},
                companyPartnerStats: {},
            };
        }
    },

    async rebuildCumulativeManDays(): Promise<RebuildCumulativeManDaysResult> {
        const [workers, teams, sites, companies, snapshot] = await Promise.all([
            manpowerService.getWorkers(true),
            teamService.getTeams(),
            siteService.getSites(),
            companyService.getCompanies(),
            createStatsSnapshot(),
        ]);

        const workerIds = workers.map((worker) => toText(worker.id)).filter(Boolean);
        const teamIds = teams.map((team) => toText(team.id)).filter(Boolean);
        const siteIds = sites.map((site) => toText(site.id)).filter(Boolean);
        const companyIds = companies.map((company) => toText(company.id)).filter(Boolean);

        await commitExactTotals('workers', workerIds, snapshot.stats.workerStats);
        await commitExactTotals('teams', teamIds, snapshot.stats.teamStats);
        await commitExactTotals('sites', siteIds, snapshot.stats.siteStats);
        await commitCompanyExactTotals(companyIds, snapshot.stats);

        return {
            ...snapshot.result,
            workersUpdated: workerIds.length,
            teamsUpdated: teamIds.length,
            sitesUpdated: siteIds.length,
            companiesUpdated: companyIds.length,
        };
    },
};
