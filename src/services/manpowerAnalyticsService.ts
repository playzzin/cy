/**
 * 공수 데이터 분석 서비스
 * 
 * dailyReportService (Firestore)를 통해 데이터를 조회하고 다양한 기준으로 집계
 */

import { dailyReportService, DailyReport, DailyReportWorker } from './dailyReportService';
import { teamService, type Team } from './teamService';
import { companyService, type Company } from './companyService';
import { siteService, type Site } from './siteService';

const MANPOWER_BY_PERIOD_CACHE_TTL_MS = 10_000;
const manpowerByPeriodCache = new Map<string, {
    createdAt: number;
    promise: Promise<ManpowerData[]>;
}>();

// ===========================
// Types
// ===========================

export interface ManpowerData {
    date: string;
    siteId: string;
    siteName: string;
    teamId: string;
    teamName: string;
    workers: DailyReportWorker[];
    totalManDay: number;
}

export interface ManpowerStats {
    totalManDay: number;
    totalWorkers: number;
    totalAmount: number;
    avgManDay: number;
    maxManDay: number;
    minManDay: number;
}

export interface TeamManpowerSummary {
    teamId: string;
    teamName: string;
    totalManDay: number;
    workerCount: number;
    totalAmount: number;
    avgDailyManDay: number;
    days: number;
}

export interface WorkerManpowerSummary {
    workerId: string;
    workerName: string;
    totalManDay: number;
    workDays: number;
    totalAmount: number;
    avgManDay: number;
    sites: string[];
}

export interface SiteManpowerSummary {
    siteId: string;
    siteName: string;
    totalManDay: number;
    workerCount: number;
    teamCount: number;
    totalAmount: number;
    days: number;
}

export interface DailySummary {
    date: string;
    totalManDay: number;
    workerCount: number;
    totalAmount: number;
    teamCount: number;
    siteCount: number;
    teams: Array<{ teamId: string; teamName: string; manDay: number; workerCount: number; amount: number }>;
    sites: Array<{ siteId: string; siteName: string; manDay: number; workerCount: number; amount: number }>;
}

export type SupportDirection = '외부지원간곳' | '외부지원온곳' | '내부지원간곳' | '내부지원온곳';

export const SUPPORT_DIRECTIONS: SupportDirection[] = [
    '외부지원간곳',
    '외부지원온곳',
    '내부지원간곳',
    '내부지원온곳',
];

export interface SupportAnalysisFilter {
    supportDirection?: SupportDirection;
    teamName?: string;
    workerTeamName?: string;
    siteName?: string;
    workerName?: string;
}

export interface SupportDirectionSummary {
    direction: SupportDirection;
    totalManDay: number;
    totalAmount: number;
    workerCount: number;
    siteCount: number;
    flowCount: number;
}

export interface SupportFlowItem {
    fromTeamId: string;
    fromTeamName: string;
    toSiteName: string;
    toSiteId: string;
    workerName: string;
    workerId: string;
    totalManDay: number;
    totalAmount: number;
    dates: string[];
    direction?: SupportDirection;
    supportOutTeamId?: string;
    supportOutTeamName?: string;
    supportInTeamId?: string;
    supportInTeamName?: string;
    siteResponsibleTeamId?: string;
    siteResponsibleTeamName?: string;
    counterpartyName?: string;
    supportScope?: '외부' | '내부';
    flowType?: '간곳' | '온곳';
}

export interface SupportTeamSummary {
    teamId: string;
    teamName: string;
    sentManDay: number;
    sentAmount: number;
    sentWorkerCount: number;
    receivedManDay: number;
    receivedAmount: number;
    receivedWorkerCount: number;
}

export interface SupportAnalysis {
    totalSupportManDay: number;
    totalSupportAmount: number;
    totalSupportWorkers: number;
    supportRatio: number; // 전체 대비 지원 비율 (%)
    flows: SupportFlowItem[];
    teamSummaries: SupportTeamSummary[];
    supportByDirection?: SupportDirectionSummary[];
    dailyTrend: Array<{ date: string; supportManDay: number; supportAmount: number; normalManDay: number }>;
    supportWorkers: Array<{
        workerId: string;
        workerName: string;
        salaryModel: string;
        totalManDay: number;
        totalAmount: number;
        workDays: number;
        teams: string[];
        sites: string[];
        directions?: SupportDirection[];
        supportOutTeams?: string[];
        supportInTeams?: string[];
    }>;
}

// ===========================
// Main Service
// ===========================

export class ManpowerAnalyticsService {
    /**
     * 기간별 공수 데이터 조회 (Firestore 기반)
     */
    async getManpowerByPeriod(
        startDate: string,
        endDate: string
    ): Promise<ManpowerData[]> {
        const cacheKey = `${startDate}::${endDate}`;
        const cached = manpowerByPeriodCache.get(cacheKey);
        const now = Date.now();

        if (cached && now - cached.createdAt < MANPOWER_BY_PERIOD_CACHE_TTL_MS) {
            return cached.promise;
        }

        const promise = dailyReportService.getReports({ startDate, endDate }).then((reports) => reports.map(r => ({
            date: r.date,
            siteId: r.siteId || '',
            siteName: r.siteName || '',
            teamId: r.teamId || '',
            teamName: r.teamName || '',
            workers: r.workers || [],
            totalManDay: typeof r.totalManDay === 'number' ? r.totalManDay : 0
        })));

        manpowerByPeriodCache.set(cacheKey, { createdAt: now, promise });
        promise.catch(() => {
            if (manpowerByPeriodCache.get(cacheKey)?.promise === promise) {
                manpowerByPeriodCache.delete(cacheKey);
            }
        });

        return promise;
    }

    /**
     * 팀별 공수 집계
     */
    async getTeamManpower(
        startDate: string,
        endDate: string
    ): Promise<TeamManpowerSummary[]> {
        const data = await this.getManpowerByPeriod(startDate, endDate);

        const teamMap = new Map<string, {
            teamId: string;
            teamName: string;
            totalManDay: number;
            workerIds: Set<string>;
            totalAmount: number;
            dates: Set<string>;
        }>();

        data.forEach(report => {
            const key = report.teamId;
            if (!key) return; // 팀 ID 없는 경우 제외

            if (!teamMap.has(key)) {
                teamMap.set(key, {
                    teamId: report.teamId,
                    teamName: report.teamName,
                    totalManDay: 0,
                    workerIds: new Set(),
                    totalAmount: 0,
                    dates: new Set()
                });
            }

            const team = teamMap.get(key)!;
            team.totalManDay += report.totalManDay;
            team.dates.add(report.date);

            report.workers.forEach(w => {
                const wid = String(w.workerId);
                if (wid && !wid.startsWith('unknown')) {
                    team.workerIds.add(wid);
                }
                const manDay = typeof w.manDay === 'number' ? w.manDay : 0;
                const unitPrice = typeof w.unitPrice === 'number' ? w.unitPrice : 0;
                team.totalAmount += manDay * unitPrice;
            });
        });

        return Array.from(teamMap.values()).map(team => ({
            teamId: team.teamId,
            teamName: team.teamName,
            totalManDay: team.totalManDay,
            workerCount: team.workerIds.size,
            totalAmount: team.totalAmount,
            avgDailyManDay: team.dates.size > 0 ? team.totalManDay / team.dates.size : 0,
            days: team.dates.size
        })).sort((a, b) => b.totalManDay - a.totalManDay);
    }

    /**
     * 작업자별 공수 집계
     */
    async getWorkerManpower(
        startDate: string,
        endDate: string,
        workerName?: string
    ): Promise<WorkerManpowerSummary[]> {
        const data = await this.getManpowerByPeriod(startDate, endDate);

        const workerMap = new Map<string, {
            workerId: string;
            workerName: string;
            totalManDay: number;
            workDays: number;
            totalAmount: number;
            sites: Set<string>;
        }>();

        data.forEach(report => {
            report.workers.forEach(w => {
                // 특정 작업자 필터링
                if (workerName && !w.name.includes(workerName)) {
                    return;
                }

                const wid = String(w.workerId);
                if (!wid || wid.startsWith('unknown')) return;

                if (!workerMap.has(wid)) {
                    workerMap.set(wid, {
                        workerId: wid,
                        workerName: w.name,
                        totalManDay: 0,
                        workDays: 0,
                        totalAmount: 0,
                        sites: new Set()
                    });
                }

                const worker = workerMap.get(wid)!;
                const manDay = typeof w.manDay === 'number' ? w.manDay : 0;
                const unitPrice = typeof w.unitPrice === 'number' ? w.unitPrice : 0;

                worker.totalManDay += manDay;
                if (manDay > 0) worker.workDays += 1;
                worker.totalAmount += manDay * unitPrice;
                if (report.siteName) worker.sites.add(report.siteName);
            });
        });

        return Array.from(workerMap.values()).map(w => ({
            workerId: w.workerId,
            workerName: w.workerName,
            totalManDay: w.totalManDay,
            workDays: w.workDays,
            totalAmount: w.totalAmount,
            avgManDay: w.workDays > 0 ? w.totalManDay / w.workDays : 0,
            sites: Array.from(w.sites)
        })).sort((a, b) => b.totalManDay - a.totalManDay);
    }

    /**
     * 현장별 공수 집계
     */
    async getSiteManpower(
        startDate: string,
        endDate: string
    ): Promise<SiteManpowerSummary[]> {
        const data = await this.getManpowerByPeriod(startDate, endDate);

        const siteMap = new Map<string, {
            siteId: string;
            siteName: string;
            totalManDay: number;
            workerIds: Set<string>;
            teamIds: Set<string>;
            totalAmount: number;
            dates: Set<string>;
        }>();

        data.forEach(report => {
            const key = report.siteId;
            if (!key) return; // 현장 ID 없는 경우 제외

            if (!siteMap.has(key)) {
                siteMap.set(key, {
                    siteId: report.siteId,
                    siteName: report.siteName,
                    totalManDay: 0,
                    workerIds: new Set(),
                    teamIds: new Set(),
                    totalAmount: 0,
                    dates: new Set()
                });
            }

            const site = siteMap.get(key)!;
            site.totalManDay += report.totalManDay;
            if (report.teamId) site.teamIds.add(report.teamId);
            site.dates.add(report.date);

            report.workers.forEach(w => {
                const wid = String(w.workerId);
                if (wid && !wid.startsWith('unknown')) {
                    site.workerIds.add(wid);
                }
                const manDay = typeof w.manDay === 'number' ? w.manDay : 0;
                const unitPrice = typeof w.unitPrice === 'number' ? w.unitPrice : 0;
                site.totalAmount += manDay * unitPrice;
            });
        });

        return Array.from(siteMap.values()).map(site => ({
            siteId: site.siteId,
            siteName: site.siteName,
            totalManDay: site.totalManDay,
            workerCount: site.workerIds.size,
            teamCount: site.teamIds.size,
            totalAmount: site.totalAmount,
            days: site.dates.size
        })).sort((a, b) => b.totalManDay - a.totalManDay);
    }

    /**
     * 전체 통계
     */
    async getManpowerStatistics(
        startDate: string,
        endDate: string
    ): Promise<ManpowerStats> {
        const data = await this.getManpowerByPeriod(startDate, endDate);

        let totalManDay = 0;
        const workerIds = new Set<string>();
        let totalAmount = 0;
        const manDays: number[] = [];

        data.forEach(report => {
            totalManDay += report.totalManDay;
            manDays.push(report.totalManDay);

            report.workers.forEach(w => {
                const wid = String(w.workerId);
                if (wid && !wid.startsWith('unknown')) {
                    workerIds.add(wid);
                }
                const manDay = typeof w.manDay === 'number' ? w.manDay : 0;
                const unitPrice = typeof w.unitPrice === 'number' ? w.unitPrice : 0;
                totalAmount += manDay * unitPrice;
            });
        });

        return {
            totalManDay,
            totalWorkers: workerIds.size,
            totalAmount,
            avgManDay: manDays.length > 0 ? totalManDay / manDays.length : 0,
            maxManDay: manDays.length > 0 ? Math.max(...manDays) : 0,
            minManDay: manDays.length > 0 ? Math.min(...manDays) : 0
        };
    }

    /**
     * 일별 상세 공수 (특정 작업자)
     */
    async getWorkerDailyManpower(
        workerId: string,
        startDate: string,
        endDate: string
    ): Promise<Array<{
        date: string;
        siteName: string;
        teamName: string;
        manDay: number;
        unitPrice: number;
        amount: number;
    }>> {
        const data = await this.getManpowerByPeriod(startDate, endDate);

        const results: Array<{
            date: string;
            siteName: string;
            teamName: string;
            manDay: number;
            unitPrice: number;
            amount: number;
        }> = [];

        data.forEach(report => {
            // ID 비교 시 String 변환 보장
            const worker = report.workers.find(w => String(w.workerId) === String(workerId));
            const manDay = worker && typeof worker.manDay === 'number' ? worker.manDay : 0;

            if (worker && manDay > 0) {
                const unitPrice = typeof worker.unitPrice === 'number' ? worker.unitPrice : 0;
                results.push({
                    date: report.date,
                    siteName: report.siteName,
                    teamName: report.teamName,
                    manDay: manDay,
                    unitPrice: unitPrice,
                    amount: manDay * unitPrice
                });
            }
        });

        return results;
    }

    /**
     * 달력용 일별 요약 집계
     */
    async getDailySummary(
        startDate: string,
        endDate: string
    ): Promise<DailySummary[]> {
        const data = await this.getManpowerByPeriod(startDate, endDate);

        const dayMap = new Map<string, {
            totalManDay: number;
            workerIds: Set<string>;
            totalAmount: number;
            teamIds: Set<string>;
            siteIds: Set<string>;
            teams: Map<string, { teamName: string; manDay: number; workerIds: Set<string>; amount: number }>;
            sites: Map<string, { siteName: string; manDay: number; workerIds: Set<string>; amount: number }>;
        }>();

        data.forEach(report => {
            const date = report.date;
            if (!date) return;

            if (!dayMap.has(date)) {
                dayMap.set(date, {
                    totalManDay: 0,
                    workerIds: new Set(),
                    totalAmount: 0,
                    teamIds: new Set(),
                    siteIds: new Set(),
                    teams: new Map(),
                    sites: new Map()
                });
            }

            const day = dayMap.get(date)!;
            day.totalManDay += report.totalManDay;
            if (report.teamId) day.teamIds.add(report.teamId);
            if (report.siteId) day.siteIds.add(report.siteId);

            // 팀별 집계
            if (report.teamId) {
                if (!day.teams.has(report.teamId)) {
                    day.teams.set(report.teamId, { teamName: report.teamName, manDay: 0, workerIds: new Set(), amount: 0 });
                }
                const team = day.teams.get(report.teamId)!;
                team.manDay += report.totalManDay;
            }

            // 현장별 집계
            if (report.siteId) {
                if (!day.sites.has(report.siteId)) {
                    day.sites.set(report.siteId, { siteName: report.siteName, manDay: 0, workerIds: new Set(), amount: 0 });
                }
                const site = day.sites.get(report.siteId)!;
                site.manDay += report.totalManDay;
            }

            report.workers.forEach(w => {
                const wid = String(w.workerId);
                if (wid && !wid.startsWith('unknown')) {
                    day.workerIds.add(wid);
                    if (report.teamId) {
                        day.teams.get(report.teamId)?.workerIds.add(wid);
                    }
                    if (report.siteId) {
                        day.sites.get(report.siteId)?.workerIds.add(wid);
                    }
                }
                const manDay = typeof w.manDay === 'number' ? w.manDay : 0;
                const unitPrice = typeof w.unitPrice === 'number' ? w.unitPrice : 0;
                const amount = manDay * unitPrice;
                day.totalAmount += amount;
                if (report.teamId) {
                    const team = day.teams.get(report.teamId);
                    if (team) team.amount += amount;
                }
                if (report.siteId) {
                    const site = day.sites.get(report.siteId);
                    if (site) site.amount += amount;
                }
            });
        });

        return Array.from(dayMap.entries()).map(([date, day]) => ({
            date,
            totalManDay: day.totalManDay,
            workerCount: day.workerIds.size,
            totalAmount: day.totalAmount,
            teamCount: day.teamIds.size,
            siteCount: day.siteIds.size,
            teams: Array.from(day.teams.entries()).map(([teamId, t]) => ({
                teamId,
                teamName: t.teamName,
                manDay: t.manDay,
                workerCount: t.workerIds.size,
                amount: t.amount
            })).sort((a, b) => b.manDay - a.manDay),
            sites: Array.from(day.sites.entries()).map(([siteId, s]) => ({
                siteId,
                siteName: s.siteName,
                manDay: s.manDay,
                workerCount: s.workerIds.size,
                amount: s.amount
            })).sort((a, b) => b.manDay - a.manDay)
        })).sort((a, b) => a.date.localeCompare(b.date));
    }

    /**
     * 지원팀 분석
     * 지원 정산 페이지와 같은 외부/내부, 온곳/간곳 방향 기준으로 분류
     */
    async getSupportAnalysis(
        startDate: string,
        endDate: string,
        filters: SupportAnalysisFilter = {}
    ): Promise<SupportAnalysis> {
        return this.getDirectionalSupportAnalysis(startDate, endDate, filters);
    }

    private async getDirectionalSupportAnalysis(
        startDate: string,
        endDate: string,
        filters: SupportAnalysisFilter
    ): Promise<SupportAnalysis> {
        const [data, teams, companies, sites] = await Promise.all([
            this.getManpowerByPeriod(startDate, endDate),
            teamService.getTeams().catch(() => [] as Team[]),
            companyService.getCompanies().catch(() => [] as Company[]),
            siteService.getSites().catch(() => [] as Site[]),
        ]);

        type TeamRef = { id: string; name: string; team?: Team };
        type DirectionBucket = {
            direction: SupportDirection;
            totalManDay: number;
            totalAmount: number;
            workerIds: Set<string>;
            siteIds: Set<string>;
            flowKeys: Set<string>;
        };

        const normalize = (value: unknown): string => String(value ?? '').trim();
        const toKey = (value: unknown): string => normalize(value).toLowerCase().replace(/\s+/g, '');
        const pickString = (...values: unknown[]): string => {
            for (const value of values) {
                const normalized = normalize(value);
                if (normalized) return normalized;
            }
            return '';
        };
        const matchesText = (value: unknown, keyword?: string): boolean => {
            const kw = toKey(keyword);
            if (!kw) return true;
            const target = toKey(value);
            return target.includes(kw) || kw.includes(target);
        };
        const round1 = (num: number): number => Math.round(num * 10) / 10;

        const teamById = new Map<string, Team>();
        const teamByName = new Map<string, Team>();
        teams.forEach(team => {
            if (team.id) teamById.set(String(team.id), team);
            if (team.name) teamByName.set(toKey(team.name), team);
        });

        const companyById = new Map<string, Company>();
        const companyByName = new Map<string, Company>();
        companies.forEach(company => {
            if (company.id) companyById.set(String(company.id), company);
            if (company.name) companyByName.set(toKey(company.name), company);
        });

        const siteById = new Map<string, Site>();
        const siteByName = new Map<string, Site>();
        sites.forEach(site => {
            if (site.id) siteById.set(String(site.id), site);
            if (site.name) siteByName.set(toKey(site.name), site);
        });

        const findCompany = (id?: string | null, name?: string | null): Company | undefined => {
            const cleanId = normalize(id);
            const cleanName = normalize(name);
            if (cleanId && companyById.has(cleanId)) return companyById.get(cleanId);
            if (cleanName && companyByName.has(toKey(cleanName))) return companyByName.get(toKey(cleanName));
            return undefined;
        };

        const isCheongyeonCompany = (company?: Company, fallbackName?: string): boolean => {
            const isMyCompany = Boolean(company && (company as any).isMyCompany);
            const name = toKey(`${company?.name ?? ''} ${fallbackName ?? ''}`);
            return isMyCompany || name.includes('청연') || name.includes('cheongyeon');
        };

        const resolveTeam = (
            id?: string | null,
            name?: string | null,
            fallbackId?: string | null,
            fallbackName?: string | null
        ): TeamRef => {
            const cleanId = normalize(id);
            const cleanName = normalize(name);
            const fallbackCleanId = normalize(fallbackId);
            const fallbackCleanName = normalize(fallbackName);
            const team =
                (cleanId ? teamById.get(cleanId) : undefined) ||
                (cleanName ? teamByName.get(toKey(cleanName)) : undefined) ||
                (fallbackCleanId ? teamById.get(fallbackCleanId) : undefined) ||
                (fallbackCleanName ? teamByName.get(toKey(fallbackCleanName)) : undefined);

            return {
                id: normalize(team?.id) || cleanId || fallbackCleanId || toKey(cleanName || fallbackCleanName),
                name: normalize(team?.name) || cleanName || fallbackCleanName || '미지정',
                team,
            };
        };

        const findSite = (report: ManpowerData): Site | undefined => {
            const byId = report.siteId ? siteById.get(report.siteId) : undefined;
            if (byId) return byId;
            return report.siteName ? siteByName.get(toKey(report.siteName)) : undefined;
        };

        const resolveWorkerTeam = (worker: DailyReportWorker, report: ManpowerData): TeamRef => (
            resolveTeam(worker.teamId, worker.workerTeamName, report.teamId, report.teamName)
        );

        const resolveTargetTeam = (report: ManpowerData, site?: Site): TeamRef => {
            const rawReport = report as ManpowerData & Partial<DailyReport>;
            return resolveTeam(
                rawReport.responsibleTeamId || site?.responsibleTeamId,
                rawReport.responsibleTeamName || site?.responsibleTeamName,
                report.teamId,
                report.teamName
            );
        };

        const isTeamCheongyeon = (teamRef: TeamRef): boolean => {
            const team = teamRef.team;
            const company = findCompany(team?.companyId, team?.companyName);
            return isCheongyeonCompany(company, team?.companyName);
        };

        const classifyWorker = (
            report: ManpowerData,
            worker: DailyReportWorker,
            sourceTeam: TeamRef,
            targetTeam: TeamRef,
            site?: Site
        ): SupportDirection[] => {
            const rawReport = report as ManpowerData & Partial<DailyReport>;
            const siteOwnerName = pickString(
                rawReport.constructorCompanyName,
                site?.constructorCompanyName,
                rawReport.companyName,
                site?.companyName
            );
            const siteOwnerCompany =
                findCompany(rawReport.constructorCompanyId || site?.constructorCompanyId, siteOwnerName) ||
                findCompany(rawReport.companyId || site?.companyId, rawReport.companyName || site?.companyName);

            const hasSiteOwnerInfo = Boolean(siteOwnerName || siteOwnerCompany);
            const siteIsCheongyeon = isCheongyeonCompany(siteOwnerCompany, siteOwnerName);
            const siteClassification: 'internal' | 'external' =
                hasSiteOwnerInfo && !siteIsCheongyeon ? 'external' : 'internal';

            const sourceIsCheongyeon = isTeamCheongyeon(sourceTeam);
            const targetIsCheongyeon = isTeamCheongyeon(targetTeam) || siteIsCheongyeon;
            const sourceKey = sourceTeam.id || toKey(sourceTeam.name);
            const targetKey = targetTeam.id || toKey(targetTeam.name);
            const hasBothTeams = Boolean(sourceKey && targetKey);
            const isDifferentTeam = hasBothTeams && sourceKey !== targetKey;
            const salaryModel = normalize(worker.salaryModel || worker.payType);
            const isSupportModel = /지원|용역/.test(salaryModel);
            const isSupportTeam = /지원|용역/.test(`${sourceTeam.name} ${worker.workerTeamName || ''}`);

            const directions: SupportDirection[] = [];
            if (sourceIsCheongyeon && targetIsCheongyeon && isDifferentTeam) {
                directions.push('내부지원간곳', '내부지원온곳');
            } else if (siteClassification === 'external' && sourceIsCheongyeon) {
                directions.push('외부지원간곳');
            } else if (siteClassification === 'internal' && targetIsCheongyeon && !sourceIsCheongyeon) {
                directions.push('외부지원온곳');
            } else if (siteClassification === 'internal' && targetIsCheongyeon && (isSupportModel || isSupportTeam)) {
                directions.push('외부지원온곳');
            }

            return Array.from(new Set(directions));
        };

        const matchesFilters = (
            direction: SupportDirection,
            report: ManpowerData,
            worker: DailyReportWorker,
            sourceTeam: TeamRef,
            targetTeam: TeamRef
        ): boolean => {
            if (filters.supportDirection && filters.supportDirection !== direction) return false;
            if (filters.siteName && !matchesText(report.siteName, filters.siteName)) return false;
            if (filters.workerName && !matchesText(worker.name, filters.workerName)) return false;
            if (filters.workerTeamName && !matchesText(sourceTeam.name, filters.workerTeamName)) return false;
            if (filters.teamName && !(
                matchesText(targetTeam.name, filters.teamName) ||
                matchesText(sourceTeam.name, filters.teamName) ||
                matchesText(report.teamName, filters.teamName)
            )) {
                return false;
            }
            return true;
        };

        const directionMap = new Map<SupportDirection, DirectionBucket>();
        SUPPORT_DIRECTIONS.forEach(direction => directionMap.set(direction, {
            direction,
            totalManDay: 0,
            totalAmount: 0,
            workerIds: new Set(),
            siteIds: new Set(),
            flowKeys: new Set(),
        }));

        const flowMap = new Map<string, SupportFlowItem>();
        const teamSupportMap = new Map<string, {
            teamId: string;
            teamName: string;
            sentManDay: number;
            sentAmount: number;
            sentWorkerIds: Set<string>;
            receivedManDay: number;
            receivedAmount: number;
            receivedWorkerIds: Set<string>;
        }>();
        const dailyMap = new Map<string, { supportManDay: number; supportAmount: number; totalManDay: number }>();
        const supportWorkerMap = new Map<string, {
            workerId: string;
            workerName: string;
            salaryModel: string;
            totalManDay: number;
            totalAmount: number;
            dates: Set<string>;
            teams: Set<string>;
            sites: Set<string>;
            directions: Set<SupportDirection>;
            supportOutTeams: Set<string>;
            supportInTeams: Set<string>;
        }>();

        const supportWorkerIds = new Set<string>();
        let totalManDay = 0;
        let totalSupportManDay = 0;
        let totalSupportAmount = 0;

        const ensureTeamSummary = (team: TeamRef) => {
            const key = team.id || team.name || '미지정';
            if (!teamSupportMap.has(key)) {
                teamSupportMap.set(key, {
                    teamId: team.id,
                    teamName: team.name,
                    sentManDay: 0,
                    sentAmount: 0,
                    sentWorkerIds: new Set(),
                    receivedManDay: 0,
                    receivedAmount: 0,
                    receivedWorkerIds: new Set(),
                });
            }
            return teamSupportMap.get(key)!;
        };

        data.forEach(report => {
            const workers = report.workers || [];
            const reportWorkerManDay = workers.reduce((sum, worker) => (
                sum + (typeof worker.manDay === 'number' ? worker.manDay : 0)
            ), 0);
            const reportTotalManDay = report.totalManDay > 0 ? report.totalManDay : reportWorkerManDay;

            totalManDay += reportTotalManDay;
            if (!dailyMap.has(report.date)) {
                dailyMap.set(report.date, { supportManDay: 0, supportAmount: 0, totalManDay: 0 });
            }
            dailyMap.get(report.date)!.totalManDay += reportTotalManDay;

            const site = findSite(report);
            const targetTeam = resolveTargetTeam(report, site);
            const rawReport = report as ManpowerData & Partial<DailyReport>;

            workers.forEach(worker => {
                const manDay = typeof worker.manDay === 'number' ? worker.manDay : 0;
                if (manDay <= 0) return;

                const sourceTeam = resolveWorkerTeam(worker, report);
                const directions = classifyWorker(report, worker, sourceTeam, targetTeam, site);
                if (directions.length === 0) return;

                const matchedDirections = directions.filter(direction => (
                    matchesFilters(direction, report, worker, sourceTeam, targetTeam)
                ));
                if (matchedDirections.length === 0) return;

                const unitPrice = typeof worker.unitPrice === 'number' ? worker.unitPrice : 0;
                const amount = manDay * unitPrice;
                const workerKey = normalize(worker.workerId) || `${normalize(worker.name) || '미지정'}:${sourceTeam.id || sourceTeam.name}`;
                const workerName = normalize(worker.name) || '미지정';

                totalSupportManDay += manDay;
                totalSupportAmount += amount;
                supportWorkerIds.add(workerKey);
                const dayEntry = dailyMap.get(report.date)!;
                dayEntry.supportManDay += manDay;
                dayEntry.supportAmount += amount;

                if (!supportWorkerMap.has(workerKey)) {
                    supportWorkerMap.set(workerKey, {
                        workerId: workerKey,
                        workerName,
                        salaryModel: normalize(worker.salaryModel || worker.payType),
                        totalManDay: 0,
                        totalAmount: 0,
                        dates: new Set(),
                        teams: new Set(),
                        sites: new Set(),
                        directions: new Set(),
                        supportOutTeams: new Set(),
                        supportInTeams: new Set(),
                    });
                }
                const supportWorker = supportWorkerMap.get(workerKey)!;
                supportWorker.totalManDay += manDay;
                supportWorker.totalAmount += amount;
                supportWorker.dates.add(report.date);
                if (sourceTeam.name) supportWorker.teams.add(sourceTeam.name);
                if (report.siteName) supportWorker.sites.add(report.siteName);
                if (sourceTeam.name) supportWorker.supportOutTeams.add(sourceTeam.name);
                if (targetTeam.name) supportWorker.supportInTeams.add(targetTeam.name);
                matchedDirections.forEach(direction => supportWorker.directions.add(direction));

                matchedDirections.forEach(direction => {
                    const directionBucket = directionMap.get(direction)!;
                    const flowKey = [
                        direction,
                        sourceTeam.id || sourceTeam.name,
                        targetTeam.id || targetTeam.name,
                        report.siteId || report.siteName,
                        workerKey,
                    ].join('|');

                    directionBucket.totalManDay += manDay;
                    directionBucket.totalAmount += amount;
                    directionBucket.workerIds.add(workerKey);
                    if (report.siteId || report.siteName) directionBucket.siteIds.add(report.siteId || report.siteName);
                    directionBucket.flowKeys.add(flowKey);

                    if (!flowMap.has(flowKey)) {
                        flowMap.set(flowKey, {
                            direction,
                            fromTeamId: sourceTeam.id,
                            fromTeamName: sourceTeam.name,
                            toSiteId: report.siteId,
                            toSiteName: report.siteName,
                            workerId: workerKey,
                            workerName,
                            totalManDay: 0,
                            totalAmount: 0,
                            dates: [],
                            supportOutTeamId: sourceTeam.id,
                            supportOutTeamName: sourceTeam.name,
                            supportInTeamId: targetTeam.id,
                            supportInTeamName: targetTeam.name,
                            siteResponsibleTeamId: rawReport.responsibleTeamId || site?.responsibleTeamId,
                            siteResponsibleTeamName: rawReport.responsibleTeamName || site?.responsibleTeamName,
                            counterpartyName: direction.startsWith('외부') ? pickString(
                                rawReport.constructorCompanyName,
                                site?.constructorCompanyName,
                                rawReport.companyName,
                                site?.companyName
                            ) : targetTeam.name,
                            supportScope: direction.startsWith('외부') ? '외부' : '내부',
                            flowType: direction.endsWith('간곳') ? '간곳' : '온곳',
                        });
                    }

                    const flow = flowMap.get(flowKey)!;
                    flow.totalManDay += manDay;
                    flow.totalAmount += amount;
                    if (!flow.dates.includes(report.date)) flow.dates.push(report.date);

                    if (direction.endsWith('간곳')) {
                        const sourceSummary = ensureTeamSummary(sourceTeam);
                        sourceSummary.sentManDay += manDay;
                        sourceSummary.sentAmount += amount;
                        sourceSummary.sentWorkerIds.add(workerKey);
                    }
                    if (direction.endsWith('온곳')) {
                        const targetSummary = ensureTeamSummary(targetTeam);
                        targetSummary.receivedManDay += manDay;
                        targetSummary.receivedAmount += amount;
                        targetSummary.receivedWorkerIds.add(workerKey);
                    }
                });
            });
        });

        return {
            totalSupportManDay: round1(totalSupportManDay),
            totalSupportAmount: Math.round(totalSupportAmount),
            totalSupportWorkers: supportWorkerIds.size,
            supportRatio: totalManDay > 0 ? round1((totalSupportManDay / totalManDay) * 100) : 0,
            flows: Array.from(flowMap.values())
                .map(flow => ({
                    ...flow,
                    totalManDay: round1(flow.totalManDay),
                    totalAmount: Math.round(flow.totalAmount),
                    dates: [...flow.dates].sort(),
                }))
                .sort((a, b) => b.totalManDay - a.totalManDay),
            teamSummaries: Array.from(teamSupportMap.values()).map(ts => ({
                teamId: ts.teamId,
                teamName: ts.teamName,
                sentManDay: round1(ts.sentManDay),
                sentAmount: Math.round(ts.sentAmount),
                sentWorkerCount: ts.sentWorkerIds.size,
                receivedManDay: round1(ts.receivedManDay),
                receivedAmount: Math.round(ts.receivedAmount),
                receivedWorkerCount: ts.receivedWorkerIds.size,
            })).sort((a, b) => (
                (b.sentManDay + b.receivedManDay) - (a.sentManDay + a.receivedManDay)
            )),
            supportByDirection: SUPPORT_DIRECTIONS.map(direction => {
                const bucket = directionMap.get(direction)!;
                return {
                    direction,
                    totalManDay: round1(bucket.totalManDay),
                    totalAmount: Math.round(bucket.totalAmount),
                    workerCount: bucket.workerIds.size,
                    siteCount: bucket.siteIds.size,
                    flowCount: bucket.flowKeys.size,
                };
            }),
            dailyTrend: Array.from(dailyMap.entries()).map(([date, day]) => ({
                date,
                supportManDay: round1(day.supportManDay),
                supportAmount: Math.round(day.supportAmount),
                normalManDay: round1(Math.max(0, day.totalManDay - day.supportManDay)),
            })).sort((a, b) => a.date.localeCompare(b.date)),
            supportWorkers: Array.from(supportWorkerMap.values()).map(worker => ({
                workerId: worker.workerId,
                workerName: worker.workerName,
                salaryModel: worker.salaryModel || '지원',
                totalManDay: round1(worker.totalManDay),
                totalAmount: Math.round(worker.totalAmount),
                workDays: worker.dates.size,
                teams: Array.from(worker.teams),
                sites: Array.from(worker.sites),
                directions: SUPPORT_DIRECTIONS.filter(direction => worker.directions.has(direction)),
                supportOutTeams: Array.from(worker.supportOutTeams),
                supportInTeams: Array.from(worker.supportInTeams),
            })).sort((a, b) => b.totalManDay - a.totalManDay),
        };
    }
}

// Singleton instance
export const manpowerAnalyticsService = new ManpowerAnalyticsService();
