import { filterReportsByDateRange, type IntegratedDatabaseOverviewSnapshot } from '../../pages/database/manpowerDatabaseOverview';
import type { DailyReport, DailyReportWorker } from '../../services/dailyReportService';
import type { Team } from '../../services/teamService';
import type { Site } from '../../services/siteService';
import type { Company } from '../../services/companyService';

const text = (value: unknown): string => String(value ?? '').trim();
const hasText = (value: unknown): boolean => text(value).length > 0;
const manDay = (worker: DailyReportWorker): number => Number((worker as DailyReportWorker & { manDay?: number; gongsu?: number }).manDay ?? (worker as DailyReportWorker & { gongsu?: number }).gongsu ?? 0);

export const getReportWorkerName = (worker: DailyReportWorker): string =>
    text((worker as DailyReportWorker & { workerName?: string }).workerName || worker.name);

export const getReportWorkerId = (worker: DailyReportWorker): string => text(worker.workerId);

export const reportHasWorker = (report: DailyReport, workerId: string, workerName: string): boolean =>
    (report.workers || []).some((worker) =>
        (workerId && getReportWorkerId(worker) === workerId) ||
        (workerName && getReportWorkerName(worker).replace(/\s+/g, '') === workerName.replace(/\s+/g, ''))
    );

export const filterReports = (
    snapshot: IntegratedDatabaseOverviewSnapshot,
    dateRange?: { startDate: string; endDate: string }
): DailyReport[] => dateRange
    ? filterReportsByDateRange(snapshot.allReports, dateRange.startDate, dateRange.endDate)
    : snapshot.allReports;

export const findActiveWorkersWithoutReports = (
    snapshot: IntegratedDatabaseOverviewSnapshot,
    dateRange: { startDate: string; endDate: string }
) => {
    const reports = filterReports(snapshot, dateRange);
    return snapshot.workers.filter((worker) =>
        (worker.status || '재직') === '재직' &&
        !reports.some((report) => reportHasWorker(report, text(worker.id), text(worker.name)))
    );
};

export const findRetiredWorkersInReports = (
    snapshot: IntegratedDatabaseOverviewSnapshot,
    dateRange: { startDate: string; endDate: string }
) => {
    const reports = filterReports(snapshot, dateRange);
    return snapshot.workers.filter((worker) =>
        worker.status === '퇴사' &&
        reports.some((report) => reportHasWorker(report, text(worker.id), text(worker.name)))
    );
};

export const findWorkersFromReports = (
    snapshot: IntegratedDatabaseOverviewSnapshot,
    reports: DailyReport[]
) => {
    const workerKeys = new Set<string>();
    reports.forEach((report) => {
        (report.workers || []).forEach((worker) => {
            if (manDay(worker) <= 0) return;
            workerKeys.add(getReportWorkerId(worker) || getReportWorkerName(worker));
        });
    });

    return snapshot.workers.filter((worker) => workerKeys.has(text(worker.id)) || workerKeys.has(text(worker.name)));
};

export const findSitesWithoutResponsibleTeamWithReports = (
    snapshot: IntegratedDatabaseOverviewSnapshot,
    dateRange: { startDate: string; endDate: string }
) => {
    const reports = filterReports(snapshot, dateRange);
    return snapshot.sites.filter((site) => {
        const noTeam = !hasText(site.responsibleTeamId) && !hasText(site.responsibleTeamName);
        if (!noTeam) return false;
        return reports.some((report) =>
            (hasText(report.siteId) && text(report.siteId) === text(site.id)) ||
            text(report.siteName).replace(/\s+/g, '').includes(text(site.name).replace(/\s+/g, ''))
        );
    });
};

export interface TeamActivityDelta {
    teamId: string;
    teamName: string;
    currentManDay: number;
    previousManDay: number;
    diff: number;
}

export const compareTeamActivity = (
    snapshot: IntegratedDatabaseOverviewSnapshot,
    currentRange: { startDate: string; endDate: string },
    previousRange: { startDate: string; endDate: string }
): TeamActivityDelta[] => {
    const aggregate = (reports: DailyReport[]) => {
        const map = new Map<string, TeamActivityDelta>();
        reports.forEach((report) => {
            const teamId = text(report.teamId) || text(report.teamName);
            const teamName = text(report.teamName) || text(report.teamId) || '미지정 팀';
            const current = map.get(teamId) || { teamId, teamName, currentManDay: 0, previousManDay: 0, diff: 0 };
            current.currentManDay += (report.workers || []).reduce((sum, worker) => sum + manDay(worker), 0);
            map.set(teamId, current);
        });
        return map;
    };

    const current = aggregate(filterReports(snapshot, currentRange));
    const previous = aggregate(filterReports(snapshot, previousRange));
    previous.forEach((value, key) => {
        const target = current.get(key) || { ...value, currentManDay: 0 };
        target.previousManDay = value.currentManDay;
        current.set(key, target);
    });

    return Array.from(current.values())
        .map((row) => ({ ...row, diff: row.currentManDay - row.previousManDay }))
        .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
};

export type ManpowerDbSupportDirection = '외부지원간곳' | '외부지원온곳' | '내부지원간곳' | '내부지원온곳';
export type ManpowerDbSupportScope = '외부' | '내부';
export type ManpowerDbSupportFlowType = '간곳' | '온곳';

export interface ManpowerDbSupportFlow {
    id: string;
    direction: ManpowerDbSupportDirection;
    supportScope: ManpowerDbSupportScope;
    flowType: ManpowerDbSupportFlowType;
    supportOutTeamId: string;
    supportOutTeamName: string;
    supportInTeamId: string;
    supportInTeamName: string;
    siteId: string;
    siteName: string;
    workerId: string;
    workerName: string;
    counterpartyName: string;
    totalManDay: number;
    totalAmount: number;
    dates: string[];
}

export interface ManpowerDbSupportFilters {
    supportDirection?: ManpowerDbSupportDirection;
    supportScope?: ManpowerDbSupportScope;
    supportFlowType?: ManpowerDbSupportFlowType;
    teamName?: string;
    workerTeamName?: string;
    siteName?: string;
    workerName?: string;
    dateRange?: { startDate: string; endDate: string };
}

const key = (value: unknown): string => text(value).toLowerCase().replace(/\s+/g, '');
const matches = (value: unknown, keyword?: string): boolean => {
    const target = key(value);
    const query = key(keyword);
    if (!query) return true;
    return target.includes(query) || query.includes(target);
};

const findByIdOrName = <T extends { id?: string | null; name?: string | null }>(
    rows: T[],
    id?: string | null,
    name?: string | null
): T | undefined => {
    const idText = text(id);
    const nameKey = key(name);
    return rows.find((row) =>
        (idText && text(row.id) === idText) ||
        (nameKey && key(row.name) === nameKey)
    );
};

const isCheongyeonCompany = (company?: Company, fallbackName?: string | null): boolean => {
    const name = key(`${company?.name || ''} ${fallbackName || ''}`);
    return Boolean((company as Company & { isMyCompany?: boolean } | undefined)?.isMyCompany) ||
        name.includes('청연') ||
        name.includes('cheongyeon');
};

const findCompany = (
    companies: Company[],
    id?: string | null,
    name?: string | null
): Company | undefined => findByIdOrName(companies, id, name);

const resolveTeam = (
    snapshot: IntegratedDatabaseOverviewSnapshot,
    id?: string | null,
    name?: string | null,
    fallbackId?: string | null,
    fallbackName?: string | null
): { id: string; name: string; team?: Team } => {
    const team = findByIdOrName(snapshot.teams, id, name) ||
        findByIdOrName(snapshot.teams, fallbackId, fallbackName);
    return {
        id: text(team?.id) || text(id) || text(fallbackId) || key(name || fallbackName),
        name: text(team?.name) || text(name) || text(fallbackName) || '미지정',
        team,
    };
};

const resolveSite = (snapshot: IntegratedDatabaseOverviewSnapshot, report: DailyReport): Site | undefined =>
    findByIdOrName(snapshot.sites, report.siteId, report.siteName);

const isTeamInternal = (
    snapshot: IntegratedDatabaseOverviewSnapshot,
    teamRef: { name: string; team?: Team }
): boolean => {
    const company = findCompany(snapshot.companies, teamRef.team?.companyId, teamRef.team?.companyName);
    const identity = `${teamRef.name} ${teamRef.team?.companyName || ''}`;
    return isCheongyeonCompany(company, teamRef.team?.companyName) || key(identity).includes('청연');
};

const reportWorkerTeamName = (worker: DailyReportWorker): string =>
    text((worker as DailyReportWorker & { workerTeamName?: string }).workerTeamName);

const classifySupportDirections = (
    snapshot: IntegratedDatabaseOverviewSnapshot,
    report: DailyReport,
    worker: DailyReportWorker
): ManpowerDbSupportDirection[] => {
    const site = resolveSite(snapshot, report);
    const rawReport = report as DailyReport & {
        responsibleTeamId?: string | null;
        responsibleTeamName?: string | null;
        constructorCompanyId?: string | null;
        constructorCompanyName?: string | null;
        companyId?: string | null;
        companyName?: string | null;
    };
    const sourceTeam = resolveTeam(snapshot, worker.teamId, reportWorkerTeamName(worker), report.teamId, report.teamName);
    const targetTeam = resolveTeam(
        snapshot,
        rawReport.responsibleTeamId || site?.responsibleTeamId,
        rawReport.responsibleTeamName || site?.responsibleTeamName,
        report.teamId,
        report.teamName
    );
    const siteOwnerName = text(rawReport.constructorCompanyName || site?.constructorCompanyName || rawReport.companyName || site?.companyName);
    const siteOwnerCompany = findCompany(snapshot.companies, rawReport.constructorCompanyId || site?.constructorCompanyId, siteOwnerName) ||
        findCompany(snapshot.companies, rawReport.companyId || site?.companyId, rawReport.companyName || site?.companyName);
    const hasSiteOwner = Boolean(siteOwnerName || siteOwnerCompany);
    const siteInternal = !hasSiteOwner || isCheongyeonCompany(siteOwnerCompany, siteOwnerName);
    const sourceInternal = isTeamInternal(snapshot, sourceTeam);
    const targetInternal = isTeamInternal(snapshot, targetTeam) || siteInternal;
    const sourceKey = sourceTeam.id || key(sourceTeam.name);
    const targetKey = targetTeam.id || key(targetTeam.name);
    const isDifferentTeam = Boolean(sourceKey && targetKey && sourceKey !== targetKey);
    const salaryModel = text((worker as DailyReportWorker & { salaryModel?: string; payType?: string }).salaryModel || (worker as DailyReportWorker & { payType?: string }).payType);
    const isSupportModel = /지원|용역/.test(`${salaryModel} ${sourceTeam.name} ${reportWorkerTeamName(worker)}`);

    if (sourceInternal && targetInternal && isDifferentTeam) return ['내부지원간곳', '내부지원온곳'];
    if (!siteInternal && sourceInternal) return ['외부지원간곳'];
    if (siteInternal && targetInternal && !sourceInternal) return ['외부지원온곳'];
    if (siteInternal && targetInternal && isSupportModel) return ['외부지원온곳'];
    return [];
};

export const buildManpowerDbSupportFlows = (
    snapshot: IntegratedDatabaseOverviewSnapshot,
    filters: ManpowerDbSupportFilters = {}
): ManpowerDbSupportFlow[] => {
    const reports = filterReports(snapshot, filters.dateRange);
    const flowMap = new Map<string, ManpowerDbSupportFlow>();

    reports.forEach((report) => {
        const site = resolveSite(snapshot, report);
        const rawReport = report as DailyReport & {
            responsibleTeamId?: string | null;
            responsibleTeamName?: string | null;
            constructorCompanyName?: string | null;
            companyName?: string | null;
        };
        const targetTeam = resolveTeam(
            snapshot,
            rawReport.responsibleTeamId || site?.responsibleTeamId,
            rawReport.responsibleTeamName || site?.responsibleTeamName,
            report.teamId,
            report.teamName
        );
        const counterpartyName = text(rawReport.constructorCompanyName || site?.constructorCompanyName || rawReport.companyName || site?.companyName || targetTeam.name);

        (report.workers || []).forEach((worker) => {
            const workerManDay = manDay(worker);
            if (workerManDay <= 0) return;

            const sourceTeam = resolveTeam(snapshot, worker.teamId, reportWorkerTeamName(worker), report.teamId, report.teamName);
            const directions = classifySupportDirections(snapshot, report, worker);
            directions.forEach((direction) => {
                const supportScope: ManpowerDbSupportScope = direction.startsWith('외부') ? '외부' : '내부';
                const flowType: ManpowerDbSupportFlowType = direction.endsWith('간곳') ? '간곳' : '온곳';
                if (filters.supportDirection && filters.supportDirection !== direction) return;
                if (filters.supportScope && filters.supportScope !== supportScope) return;
                if (filters.supportFlowType && filters.supportFlowType !== flowType) return;
                if (filters.siteName && !matches(report.siteName, filters.siteName)) return;
                if (filters.workerName && !matches(getReportWorkerName(worker), filters.workerName)) return;
                if (filters.workerTeamName && !matches(sourceTeam.name, filters.workerTeamName)) return;
                if (filters.teamName && !(
                    matches(sourceTeam.name, filters.teamName) ||
                    matches(targetTeam.name, filters.teamName) ||
                    matches(report.teamName, filters.teamName)
                )) return;

                const workerId = getReportWorkerId(worker) || `${getReportWorkerName(worker)}:${sourceTeam.id || sourceTeam.name}`;
                const flowKey = [direction, sourceTeam.id || sourceTeam.name, targetTeam.id || targetTeam.name, report.siteId || report.siteName, workerId].join('|');
                const amount = workerManDay * Number((worker as DailyReportWorker & { unitPrice?: number }).unitPrice || 0);

                if (!flowMap.has(flowKey)) {
                    flowMap.set(flowKey, {
                        id: flowKey,
                        direction,
                        supportScope,
                        flowType,
                        supportOutTeamId: sourceTeam.id,
                        supportOutTeamName: sourceTeam.name,
                        supportInTeamId: targetTeam.id,
                        supportInTeamName: targetTeam.name,
                        siteId: text(report.siteId),
                        siteName: text(report.siteName),
                        workerId,
                        workerName: getReportWorkerName(worker) || '미지정',
                        counterpartyName,
                        totalManDay: 0,
                        totalAmount: 0,
                        dates: [],
                    });
                }

                const flow = flowMap.get(flowKey)!;
                flow.totalManDay += workerManDay;
                flow.totalAmount += amount;
                if (report.date && !flow.dates.includes(report.date)) flow.dates.push(report.date);
            });
        });
    });

    return Array.from(flowMap.values())
        .map((flow) => ({
            ...flow,
            totalManDay: Math.round(flow.totalManDay * 10) / 10,
            totalAmount: Math.round(flow.totalAmount),
            dates: [...flow.dates].sort(),
        }))
        .sort((a, b) => b.totalManDay - a.totalManDay);
};
