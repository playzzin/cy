import {
    collection,
    query,
    where,
    getDocs,
    doc,
    setDoc,
    getDoc,
    Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { SettlementEntry } from '../types/settlement';
import { Worker } from '../types/worker'; // Assuming this exists, or I'll use any for now if not strict
import { DailyReport } from '../types/dailyReport'; // Assuming this exists

export const settlementService = {
    // 1. Fetch Monthly Settlement Data (Aggregated or Saved)
    async getMonthlySettlement(teamId: string, month: string): Promise<SettlementEntry[]> {
        try {
            // A. Check if a saved settlement already exists for this month/team
            // We'll store settlements in a subcollection or a top-level collection 'settlements'
            // Structure: settlements/{teamId_month}/entries/{workerId}
            // OR simpler: settlements collection with composite ID

            // Let's use a 'settlements' collection where each doc is a worker's settlement for a month
            // Query: where teamId == teamId, where month == month
            const settlementsRef = collection(db, 'settlements');
            const q = query(
                settlementsRef,
                where('teamId', '==', teamId),
                where('month', '==', month)
            );

            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                // Return saved data
                return querySnapshot.docs.map(doc => doc.data() as SettlementEntry);
            }

            // B. If no saved data, calculate from scratch (Live View)
            return await this.calculateLiveSettlement(teamId, month);

        } catch (error) {
            console.error("Error fetching settlement:", error);
            throw error;
        }
    },

    // 2. Calculate Settlement from Daily Reports & Worker DB
    async calculateLiveSettlement(teamId: string, month: string): Promise<SettlementEntry[]> {
        // Step 1: Fetch all workers in the team
        const workersRef = collection(db, 'workers');
        const workersQuery = query(workersRef, where('teamId', '==', teamId));
        const workersSnapshot = await getDocs(workersQuery);
        const workers = workersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

        // Step 2: Fetch all daily reports for the month & team
        // Assuming 'date' field is string YYYY-MM-DD
        const startDay = `${month}-01`;
        const endDay = `${month}-31`; // Simple range

        const reportsRef = collection(db, 'daily_reports');
        const reportsQuery = query(
            reportsRef,
            where('teamId', '==', teamId),
            where('date', '>=', startDay),
            where('date', '<=', endDay)
        );
        const reportsSnapshot = await getDocs(reportsQuery);
        const reports = reportsSnapshot.docs.map(doc => doc.data() as any);

        // Step 3: Aggregate Gongsu per Worker & Track Sites
        const gongsuMap: { [workerId: string]: number } = {};
        const amountMap: { [workerId: string]: number } = {};
        const missingUnitPriceGongsuMap: { [workerId: string]: number } = {};
        const unitPriceMap: { [workerId: string]: number[] } = {};
        const siteMap: { [workerId: string]: { [siteName: string]: number } } = {};

        reports.forEach(report => {
            if (report.workers && Array.isArray(report.workers)) {
                report.workers.forEach((w: any) => {
                    const id = w.workerId || w.id;
                    if (id) {
                        const gongsu = Number(w.manDay ?? w.gongsu) || 0;
                        gongsuMap[id] = (gongsuMap[id] || 0) + gongsu;

                        const hasSnapshotUnitPrice = w.unitPrice !== undefined && w.unitPrice !== null && Number.isFinite(Number(w.unitPrice));
                        const snapshotUnitPrice = hasSnapshotUnitPrice ? Number(w.unitPrice) : null;

                        if (snapshotUnitPrice !== null) {
                            amountMap[id] = (amountMap[id] || 0) + (gongsu * snapshotUnitPrice);
                            if (!unitPriceMap[id]) unitPriceMap[id] = [];
                            if (!unitPriceMap[id].includes(snapshotUnitPrice)) unitPriceMap[id].push(snapshotUnitPrice);
                        } else {
                            missingUnitPriceGongsuMap[id] = (missingUnitPriceGongsuMap[id] || 0) + gongsu;
                        }

                        // Track site usage
                        if (!siteMap[id]) siteMap[id] = {};
                        const siteName = report.siteName || 'Unknown Site';
                        siteMap[id][siteName] = (siteMap[id][siteName] || 0) + gongsu;
                    }
                });
            }
        });

        // Step 4: Build Settlement Entries
        const entries: SettlementEntry[] = workers.map(worker => {
            const daysWorked = gongsuMap[worker.id] || 0;
            const fallbackUnitPrice = Number(worker.unitPrice) || 0;
            const snapshotAmount = amountMap[worker.id] || 0;
            const missingGongsu = missingUnitPriceGongsuMap[worker.id] || 0;
            const grossPay = snapshotAmount + (missingGongsu * fallbackUnitPrice);

            const usedUnitPrices = unitPriceMap[worker.id] || [];
            const unitPrice = usedUnitPrices.length === 1
                ? usedUnitPrices[0]
                : (daysWorked > 0 ? Math.round(grossPay / daysWorked) : fallbackUnitPrice);

            // Determine Labor Site (Site with max gongsu)
            const workerSites = siteMap[worker.id] || {};
            let laborSite = '-';
            let maxSiteGongsu = 0;

            Object.entries(workerSites).forEach(([site, gongsu]) => {
                if (gongsu > maxSiteGongsu) {
                    maxSiteGongsu = gongsu;
                    laborSite = site;
                }
            });

            const reportedSite = laborSite;

            // Default: No split, full report
            const reportedDays = daysWorked;
            const remainingDays = 0;
            const reportedGrossPay = grossPay;

            // Default Tax (3.3%)
            const taxRate = 0.033;
            const taxAmount = Math.floor(reportedGrossPay * taxRate);

            return {
                id: `${worker.id}_${month}`,
                workerId: worker.id,
                workerName: worker.name,
                teamId: teamId,
                role: worker.role || '일반공',

                laborSite,
                reportedSite,

                daysWorked,
                reportedDays,
                remainingDays,

                unitPrice,
                grossPay,
                reportedGrossPay,

                taxRate,
                taxAmount,

                nationalPension: 0,
                healthInsurance: 0,
                careInsurance: 0,
                employmentInsurance: 0,

                advancePayment: 0,
                accommodationFee: 0,
                foodExpense: 0,
                otherDeduction: 0,

                netPay: grossPay - taxAmount,
                status: 'pending',

                month,
                updatedAt: new Date().toISOString()
            };
        });

        return entries;
    },

    // 3. Save/Update Settlement Data
    async saveSettlement(entries: SettlementEntry[]) {
        try {
            const batchPromises = entries.map(entry => {
                const docRef = doc(db, 'settlements', entry.id);
                return setDoc(docRef, {
                    ...entry,
                    updatedAt: new Date().toISOString()
                }, { merge: true });
            });

            await Promise.all(batchPromises);
            return true;
        } catch (error) {
            console.error("Error saving settlement:", error);
            throw error;
        }
    },
    // 4. Get All Settlements (Aggregated for Total History)
    async getAllSettlements(month: string): Promise<SettlementEntry[]> {
        try {
            // 1. Fetch all teams
            const teamsRef = collection(db, 'teams');
            const teamsSnapshot = await getDocs(teamsRef);
            const teams = teamsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

            // 2. Fetch settlement for each team (Parallel)
            const promises = teams.map(team => this.getMonthlySettlement(team.id, month));
            const results = await Promise.all(promises);

            // 3. Flatten results
            return results.flat();
        } catch (error) {
            console.error("Error fetching all settlements:", error);
            throw error;
        }
    }
};
