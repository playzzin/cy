import { type Unsubscribe } from 'firebase/firestore';
import { auth } from '../config/firebase';
import { isDevAdminSessionEnabled } from '../utils/devAdminSession';
import { companyService } from './companyService';
import { dailyReportService, type DailyReport } from './dailyReportService';
import { manpowerService } from './manpowerService';
import { siteService } from './siteService';
import { taskService } from './taskService';
import { teamService } from './teamService';
import type { Task } from '../types/task';
import {
    buildDailyReportCoverage,
    type DailyReportCoverageSummary,
} from '../features/daily-report-coverage/dailyReportCoverage';
import {
    buildDashboardDailyTrend,
    buildDashboardOperationInsights,
    type DashboardDailyTrendPoint,
    type DashboardOperationInsights,
} from '../features/dashboard-operations';

export interface DashboardExecutiveStats {
    workers: {
        total: number;
        active: number;
    };
    sites: {
        total: number;
        active: number;
    };
    teams: {
        total: number;
    };
    reports: {
        today: number;
        thisMonth: number;
        todayManDay: number;
        thisMonthManDay: number;
    };
    support: {
        inbound: number;
        outbound: number;
        total: number;
    };
    operations: {
        reportCoverageRate: number;
        averageManDayPerReport: number;
        supportBalance: number;
        reportCountTrendPercent: number;
        manDayTrendPercent: number;
        monthlyManDayRunRate: number;
        healthScore: number;
        healthLabel: DashboardOperationInsights['healthLabel'];
    };
    dailyReportCoverage: DailyReportCoverageSummary;
    dailyTrend: DashboardDailyTrendPoint[];
    recentReports: DailyReport[];
    recentTasks: Task[];
}

const SNAPSHOT_CACHE_TTL_MS = 60 * 1000;
const getSnapshotOwner = () => isDevAdminSessionEnabled() ? 'dev-admin' as const : auth.currentUser;
type SnapshotOwner = NonNullable<ReturnType<typeof getSnapshotOwner>>;
let snapshotCache: { owner: SnapshotOwner; value: DashboardExecutiveStats; expiresAt: number } | null = null;
let snapshotRequest: { owner: SnapshotOwner; promise: Promise<DashboardExecutiveStats> } | null = null;

export const createEmptyDashboardExecutiveStats = (): DashboardExecutiveStats => ({
    workers: { total: 0, active: 0 },
    sites: { total: 0, active: 0 },
    teams: { total: 0 },
    reports: { today: 0, thisMonth: 0, todayManDay: 0, thisMonthManDay: 0 },
    support: { inbound: 0, outbound: 0, total: 0 },
    operations: {
        reportCoverageRate: 0,
        averageManDayPerReport: 0,
        supportBalance: 0,
        reportCountTrendPercent: 0,
        manDayTrendPercent: 0,
        monthlyManDayRunRate: 0,
        healthScore: 0,
        healthLabel: 'critical',
    },
    dailyReportCoverage: {
        date: new Date().toISOString().slice(0, 10),
        activeSiteCount: 0,
        reportedSiteCount: 0,
        missingSiteCount: 0,
        coverageRate: 100,
        missingSites: [],
    },
    dailyTrend: [],
    recentReports: [],
    recentTasks: [],
});

const getReportDate = (report: DailyReport): string => String(report.date || '');

const getReportManDay = (report: DailyReport): number => Number(report.totalManDay) || 0;

const sortReportsByDateDesc = (reports: DailyReport[]): DailyReport[] => {
    return [...reports].sort((a, b) => new Date(getReportDate(b)).getTime() - new Date(getReportDate(a)).getTime());
};

const sortTasksByCreatedDateDesc = (tasks: Task[]): Task[] => {
    return [...tasks].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

const loadSnapshotFromFirebase = async (): Promise<DashboardExecutiveStats> => {
    const [workersData, sitesData, teamsData, reportsData, companiesData] = await Promise.all([
        manpowerService.getWorkerCounts(),
        siteService.getSites(),
        teamService.getTeams(),
        dailyReportService.getAllReports(),
        companyService.getCompanies(),
    ]);

    const todayStr = new Date().toISOString().split('T')[0];
    const thisMonthStr = todayStr.substring(0, 7);
    const todayReports = reportsData.filter((report) => getReportDate(report) === todayStr);
    const thisMonthReports = reportsData.filter((report) => getReportDate(report).startsWith(thisMonthStr));
    const dailyReportCoverage = buildDailyReportCoverage({
        sites: sitesData as Array<Record<string, any>>,
        reports: reportsData as Array<Record<string, any>>,
        date: todayStr,
    });
    const activeSiteCount = sitesData.filter((site) => site.status === 'active').length;
    const myCompany = companiesData.find((company) => company.name.includes('청연')) || companiesData[0];
    const myCompanyId = myCompany?.id;
    let inboundManDay = 0;
    let outboundManDay = 0;

    if (myCompanyId) {
        const siteMap = new Map(sitesData.map((site) => [site.id, site]));
        const teamMap = new Map(teamsData.map((team) => [team.id, team]));

        thisMonthReports.forEach((report) => {
            const site = siteMap.get(report.siteId);
            const team = teamMap.get(report.teamId);
            if (!site || !team) return;

            const manDay = getReportManDay(report);
            const siteCompanyId = String((site as { companyId?: unknown }).companyId || '');
            const teamCompanyId = String((team as { companyId?: unknown }).companyId || '');

            if (siteCompanyId === myCompanyId && teamCompanyId !== myCompanyId) {
                inboundManDay += manDay;
            }

            if (siteCompanyId !== myCompanyId && teamCompanyId === myCompanyId) {
                outboundManDay += manDay;
            }
        });
    }

    const todayManDay = todayReports.reduce((sum, report) => sum + getReportManDay(report), 0);
    const thisMonthManDay = thisMonthReports.reduce((sum, report) => sum + getReportManDay(report), 0);
    const supportBalance = inboundManDay - outboundManDay;
    const operationInsights = buildDashboardOperationInsights({
        reports: reportsData,
        today: todayStr,
        reportCoverageRate: dailyReportCoverage.coverageRate,
        activeSiteCount,
        supportBalance,
    });

    return {
        workers: workersData,
        sites: {
            total: sitesData.length,
            active: activeSiteCount,
        },
        teams: {
            total: teamsData.length,
        },
        reports: {
            today: todayReports.length,
            thisMonth: thisMonthReports.length,
            todayManDay,
            thisMonthManDay,
        },
        support: {
            inbound: inboundManDay,
            outbound: outboundManDay,
            total: inboundManDay + outboundManDay,
        },
        operations: {
            reportCoverageRate: dailyReportCoverage.coverageRate,
            averageManDayPerReport: thisMonthReports.length > 0
                ? thisMonthManDay / thisMonthReports.length
                : 0,
            supportBalance,
            ...operationInsights,
        },
        dailyReportCoverage,
        dailyTrend: buildDashboardDailyTrend(reportsData, todayStr, 14),
        recentReports: sortReportsByDateDesc(reportsData).slice(0, 5),
        recentTasks: [],
    };
};

export const dashboardExecutiveService = {
    async getSnapshot(options: { forceRefresh?: boolean } = {}): Promise<DashboardExecutiveStats> {
        const owner = getSnapshotOwner();
        if (snapshotCache?.owner !== owner) snapshotCache = null;
        if (snapshotRequest?.owner !== owner) snapshotRequest = null;
        if (!owner) throw new Error('로그인 후 대시보드를 조회해 주세요.');
        const now = Date.now();
        if (!options.forceRefresh && snapshotCache && snapshotCache.expiresAt > now) {
            return snapshotCache.value;
        }

        if (!options.forceRefresh && snapshotRequest) {
            return snapshotRequest.promise;
        }

        const promise = loadSnapshotFromFirebase()
            .then((value) => {
                // A cleared/replaced request must never repopulate the cache or reach the UI.
                if (getSnapshotOwner() !== owner || snapshotRequest?.promise !== promise) {
                    throw new Error('대시보드 조회가 만료되었습니다. 현재 계정으로 다시 조회해 주세요.');
                }
                snapshotCache = {
                    owner,
                    value,
                    expiresAt: Date.now() + SNAPSHOT_CACHE_TTL_MS,
                };
                return value;
            })
            .finally(() => {
                if (snapshotRequest?.promise === promise) snapshotRequest = null;
            });

        snapshotRequest = { owner, promise };
        return promise;
    },

    clearSnapshotCache(): void {
        snapshotCache = null;
        snapshotRequest = null;
    },

    subscribeRecentTasks(callback: (tasks: Task[]) => void): Unsubscribe {
        return taskService.subscribeRecent((tasksData) => {
            callback(sortTasksByCreatedDateDesc(tasksData).slice(0, 5));
        }, 5);
    },
};
