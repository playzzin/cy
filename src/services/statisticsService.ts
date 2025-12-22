import { collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

interface ManpowerStats {
    workerStats: { [workerId: string]: number }; // workerId -> totalGongsu
    teamStats: { [teamId: string]: number };     // teamId -> totalGongsu
    siteStats: { [siteIdOrName: string]: number }; // siteId (or Name) -> totalGongsu
    companyStats: { [companyId: string]: number }; // companyId -> totalGongsu
}

export const statisticsService = {
    async getCumulativeManpower(): Promise<ManpowerStats> {
        try {
            // 1. Fetch needed collections
            // To aggregate by Company, we need Team->Company mapping
            const teamsSnapshot = await getDocs(collection(db, 'teams'));
            const teamToCompanyMap: { [teamId: string]: string } = {};
            teamsSnapshot.docs.forEach(doc => {
                const data = doc.data();
                if (data.companyId) {
                    teamToCompanyMap[doc.id] = data.companyId;
                }
            });

            // 2. Fetch All Daily Reports (This is the heavy part, might need pagination later)
            const reportsSnapshot = await getDocs(collection(db, 'daily_reports'));

            const stats: ManpowerStats = {
                workerStats: {},
                teamStats: {},
                siteStats: {},
                companyStats: {}
            };

            // 3. Aggregate
            reportsSnapshot.docs.forEach(doc => {
                const report = doc.data();
                const workers = report.workers || []; // Array of workers in this report

                // Fields in report
                const teamId = report.teamId;
                const siteId = report.siteId; // Using ID preference
                const siteName = report.siteName;
                const companyId = teamId ? teamToCompanyMap[teamId] : null;

                // Sum up gongsu for this report
                let reportTotalGongsu = 0;

                workers.forEach((w: any) => {
                    const gongsu = Number(w.gongsu) || 0;
                    const workerId = w.workerId || w.id;

                    if (workerId) {
                        stats.workerStats[workerId] = (stats.workerStats[workerId] || 0) + gongsu;
                    }
                    reportTotalGongsu += gongsu;
                });

                // Add to Team
                if (teamId) {
                    stats.teamStats[teamId] = (stats.teamStats[teamId] || 0) + reportTotalGongsu;
                }

                // Add to Site (Use ID if avail, else Name)
                const siteKey = siteId || siteName;
                if (siteKey) {
                    stats.siteStats[siteKey] = (stats.siteStats[siteKey] || 0) + reportTotalGongsu;
                }

                // Add to Company
                if (companyId) {
                    stats.companyStats[companyId] = (stats.companyStats[companyId] || 0) + reportTotalGongsu;
                }
            });

            return stats;

        } catch (error) {
            console.error("Failed to calculate cumulative stats:", error);
            return { workerStats: {}, teamStats: {}, siteStats: {}, companyStats: {} };
        }
    }
};
