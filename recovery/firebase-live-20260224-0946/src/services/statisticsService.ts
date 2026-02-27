import { dailyReportService } from './dailyReportService';
import { teamService } from './teamService';

interface ManpowerStats {
    workerStats: { [workerId: string]: number }; // workerId -> totalGongsu
    teamStats: { [teamId: string]: number };     // teamId -> totalGongsu
    siteStats: { [siteIdOrName: string]: number }; // siteId (or Name) -> totalGongsu
    companyStats: { [companyId: string]: number }; // companyId -> totalGongsu
}

export const statisticsService = {
    async getCumulativeManpower(): Promise<ManpowerStats> {
        try {
            const teams = await teamService.getTeams();
            const teamToCompanyMap: { [teamId: string]: string } = {};
            teams.forEach(t => {
                const companyId = t.companyId ? String(t.companyId) : '';
                const teamId = t.id ? String(t.id) : '';
                const legacyId = (t as any).legacyId ? String((t as any).legacyId) : '';
                if (!companyId) return;
                if (teamId) teamToCompanyMap[teamId] = companyId;
                if (legacyId) teamToCompanyMap[legacyId] = companyId;
            });

            const reports = await dailyReportService.getAllReports();

            const stats: ManpowerStats = {
                workerStats: {},
                teamStats: {},
                siteStats: {},
                companyStats: {}
            };

            reports.forEach((report: any) => {
                const workers = Array.isArray(report?.workers) ? report.workers : [];

                const teamId = report?.teamId ? String(report.teamId) : '';
                const siteId = report?.siteId ? String(report.siteId) : '';
                const siteName = report?.siteName ? String(report.siteName) : '';
                const companyId = teamId ? (teamToCompanyMap[teamId] ?? null) : null;

                let reportTotalManDay = 0;

                workers.forEach((w: any) => {
                    const manDay = Number(w?.manDay ?? w?.gongsu) || 0;
                    const workerId = w?.workerId ? String(w.workerId) : (w?.id ? String(w.id) : '');

                    if (workerId) {
                        stats.workerStats[workerId] = (stats.workerStats[workerId] || 0) + manDay;
                    }
                    reportTotalManDay += manDay;
                });

                if (teamId) {
                    stats.teamStats[teamId] = (stats.teamStats[teamId] || 0) + reportTotalManDay;
                }

                const siteKey = siteId || siteName;
                if (siteKey) {
                    stats.siteStats[siteKey] = (stats.siteStats[siteKey] || 0) + reportTotalManDay;
                }

                if (companyId) {
                    stats.companyStats[companyId] = (stats.companyStats[companyId] || 0) + reportTotalManDay;
                }
            });

            return stats;

        } catch (error) {
            console.error("Failed to calculate cumulative stats:", error);
            return { workerStats: {}, teamStats: {}, siteStats: {}, companyStats: {} };
        }
    }
};
