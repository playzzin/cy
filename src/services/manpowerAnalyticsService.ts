/**
 * 공수 데이터 분석 서비스
 * 
 * dailyReportService (Firestore)를 통해 데이터를 조회하고 다양한 기준으로 집계
 */

import { dailyReportService, DailyReport, DailyReportWorker } from './dailyReportService';

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
        const reports = await dailyReportService.getReports({ startDate, endDate });

        return reports.map(r => ({
            date: r.date,
            siteId: r.siteId || '',
            siteName: r.siteName || '',
            teamId: r.teamId || '',
            teamName: r.teamName || '',
            workers: r.workers || [],
            totalManDay: typeof r.totalManDay === 'number' ? r.totalManDay : 0
        }));
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
     * salaryModel이 '지원팀' 또는 '용역팀'인 작업자를 지원으로 분류
     */
    async getSupportAnalysis(
        startDate: string,
        endDate: string
    ): Promise<SupportAnalysis> {
        const data = await this.getManpowerByPeriod(startDate, endDate);

        const isSupportWorker = (w: DailyReportWorker): boolean => {
            const model = (w.salaryModel || w.payType || '').trim();
            return model === '지원팀' || model === '용역팀' || model === '지원';
        };

        let totalManDay = 0;
        let totalSupportManDay = 0;
        let totalSupportAmount = 0;
        const supportWorkerIds = new Set<string>();

        // 지원 흐름 추적
        const flowMap = new Map<string, SupportFlowItem>();
        // 팀별 지원 요약
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
        // 일별 추이
        const dailyMap = new Map<string, { supportManDay: number; supportAmount: number; normalManDay: number }>();
        // 지원 작업자 상세
        const supportWorkerMap = new Map<string, {
            workerId: string;
            workerName: string;
            salaryModel: string;
            totalManDay: number;
            totalAmount: number;
            workDays: number;
            teams: Set<string>;
            sites: Set<string>;
        }>();

        data.forEach(report => {
            totalManDay += report.totalManDay;

            if (!dailyMap.has(report.date)) {
                dailyMap.set(report.date, { supportManDay: 0, supportAmount: 0, normalManDay: 0 });
            }
            const dayEntry = dailyMap.get(report.date)!;

            report.workers.forEach(w => {
                const manDay = typeof w.manDay === 'number' ? w.manDay : 0;
                const unitPrice = typeof w.unitPrice === 'number' ? w.unitPrice : 0;
                const amount = manDay * unitPrice;

                if (isSupportWorker(w)) {
                    totalSupportManDay += manDay;
                    totalSupportAmount += amount;
                    dayEntry.supportManDay += manDay;
                    dayEntry.supportAmount += amount;

                    const wid = String(w.workerId);
                    if (wid && !wid.startsWith('unknown')) {
                        supportWorkerIds.add(wid);

                        // 지원 작업자 상세
                        if (!supportWorkerMap.has(wid)) {
                            supportWorkerMap.set(wid, {
                                workerId: wid,
                                workerName: w.name,
                                salaryModel: (w.salaryModel || w.payType || '').trim(),
                                totalManDay: 0,
                                totalAmount: 0,
                                workDays: 0,
                                teams: new Set(),
                                sites: new Set()
                            });
                        }
                        const sw = supportWorkerMap.get(wid)!;
                        sw.totalManDay += manDay;
                        sw.totalAmount += amount;
                        if (manDay > 0) sw.workDays += 1;
                        if (report.teamName) sw.teams.add(report.teamName);
                        if (report.siteName) sw.sites.add(report.siteName);
                    }

                    // 지원 흐름: 팀 → 현장
                    const flowKey = `${report.teamId}:${report.siteId}:${wid}`;
                    if (!flowMap.has(flowKey)) {
                        flowMap.set(flowKey, {
                            fromTeamId: report.teamId,
                            fromTeamName: report.teamName,
                            toSiteId: report.siteId,
                            toSiteName: report.siteName,
                            workerId: wid,
                            workerName: w.name,
                            totalManDay: 0,
                            totalAmount: 0,
                            dates: []
                        });
                    }
                    const flow = flowMap.get(flowKey)!;
                    flow.totalManDay += manDay;
                    flow.totalAmount += amount;
                    if (!flow.dates.includes(report.date)) flow.dates.push(report.date);

                    // 팀 지원 요약 - 보낸 팀
                    if (report.teamId) {
                        if (!teamSupportMap.has(report.teamId)) {
                            teamSupportMap.set(report.teamId, {
                                teamId: report.teamId,
                                teamName: report.teamName,
                                sentManDay: 0, sentAmount: 0, sentWorkerIds: new Set(),
                                receivedManDay: 0, receivedAmount: 0, receivedWorkerIds: new Set()
                            });
                        }
                        const ts = teamSupportMap.get(report.teamId)!;
                        ts.sentManDay += manDay;
                        ts.sentAmount += amount;
                        if (wid && !wid.startsWith('unknown')) ts.sentWorkerIds.add(wid);
                    }
                } else {
                    dayEntry.normalManDay += manDay;
                }
            });
        });

        return {
            totalSupportManDay,
            totalSupportAmount,
            totalSupportWorkers: supportWorkerIds.size,
            supportRatio: totalManDay > 0 ? (totalSupportManDay / totalManDay) * 100 : 0,
            flows: Array.from(flowMap.values()).sort((a, b) => b.totalManDay - a.totalManDay),
            teamSummaries: Array.from(teamSupportMap.values()).map(ts => ({
                teamId: ts.teamId,
                teamName: ts.teamName,
                sentManDay: ts.sentManDay,
                sentAmount: ts.sentAmount,
                sentWorkerCount: ts.sentWorkerIds.size,
                receivedManDay: ts.receivedManDay,
                receivedAmount: ts.receivedAmount,
                receivedWorkerCount: ts.receivedWorkerIds.size
            })).sort((a, b) => b.sentManDay - a.sentManDay),
            dailyTrend: Array.from(dailyMap.entries()).map(([date, d]) => ({
                date,
                ...d
            })).sort((a, b) => a.date.localeCompare(b.date)),
            supportWorkers: Array.from(supportWorkerMap.values()).map(sw => ({
                workerId: sw.workerId,
                workerName: sw.workerName,
                salaryModel: sw.salaryModel,
                totalManDay: sw.totalManDay,
                totalAmount: sw.totalAmount,
                workDays: sw.workDays,
                teams: Array.from(sw.teams),
                sites: Array.from(sw.sites)
            })).sort((a, b) => b.totalManDay - a.totalManDay)
        };
    }
}

// Singleton instance
export const manpowerAnalyticsService = new ManpowerAnalyticsService();
