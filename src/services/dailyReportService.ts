import { db } from '../config/firebase';
import { toast } from '../utils/swal';
import {
    collection,
    addDoc,
    updateDoc,
    doc,
    getDocs,
    query,
    where,
    orderBy,
    serverTimestamp,
    Timestamp,
    writeBatch,
    limit,
    getCountFromServer
} from 'firebase/firestore';

export interface DailyReportWorker {
    workerId: string;
    name: string;
    role: string;
    status: 'attendance' | 'absent' | 'half';
    manDay: number;
    workContent: string;
    teamId?: string;
    unitPrice?: number;
    payType?: string;
    salaryModel?: string; // 급여방식 (일급제, 월급제, 지원팀, 용역팀)
}

export interface DailyReport {
    id?: string;
    date: string;
    teamId: string;
    teamName: string;
    siteId: string;
    siteName: string;
    responsibleTeamId?: string;
    responsibleTeamName?: string;
    companyId?: string;
    companyName?: string;
    writerId: string;
    workers: DailyReportWorker[];
    totalManDay: number;
    totalAmount?: number;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
    weather?: string;
    workContent?: string;
}

const COLLECTION_NAME = 'daily_reports';

export const dailyReportService = {
    // Add Report
    addReport: async (report: Omit<DailyReport, 'id'>): Promise<string> => {
        try {
            const docRef = await addDoc(collection(db, COLLECTION_NAME), {
                ...report,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            // Update cumulative man-days for each worker
            const { manpowerService } = await import('./manpowerService');
            const { teamService } = await import('./teamService');
            const { siteService } = await import('./siteService');
            const { companyService } = await import('./companyService');

            const updatePromises = report.workers.map(worker => {
                if (worker.manDay > 0) {
                    return manpowerService.incrementManDay(worker.workerId, worker.manDay);
                }
                return Promise.resolve();
            });

            // Update cumulative man-days for team
            if (report.totalManDay > 0) {
                updatePromises.push(teamService.incrementManDay(report.teamId, report.totalManDay));
                updatePromises.push(companyService.incrementManDayByTeam(report.teamId, report.totalManDay));
            }

            // Update cumulative man-days for site
            if (report.totalManDay > 0) {
                updatePromises.push(siteService.incrementManDay(report.siteId, report.totalManDay));
            }

            await Promise.all(updatePromises);

            toast.saved('일보', 1);
            return docRef.id;
        } catch (error) {
            console.error("Error adding report:", error);
            throw error;
        }
    },

    // Update Report (Full replacement of workers)
    updateReport: async (id: string, updates: Partial<DailyReport> & { workers: DailyReportWorker[] }): Promise<void> => {
        try {
            const reportRef = doc(db, COLLECTION_NAME, id);

            // 1. Get Old Report for Stats adjustment
            const oldSnap = await getDocs(query(collection(db, COLLECTION_NAME), where('__name__', '==', id)));
            if (oldSnap.empty) throw new Error("Report not found");
            const oldReport = oldSnap.docs[0].data() as DailyReport;

            // 2. Adjust Stats (Decrement old, Increment new)
            // Ideally we should calculate diff, but for simplicity:
            // Decrement Old
            const { manpowerService } = await import('./manpowerService');
            const { teamService } = await import('./teamService');
            const { siteService } = await import('./siteService');
            const { companyService } = await import('./companyService');

            const decrementPromises: Promise<void>[] = [];
            if (oldReport.totalManDay > 0) {
                decrementPromises.push(teamService.incrementManDay(oldReport.teamId, -oldReport.totalManDay));
                decrementPromises.push(companyService.incrementManDayByTeam(oldReport.teamId, -oldReport.totalManDay));
                decrementPromises.push(siteService.incrementManDay(oldReport.siteId, -oldReport.totalManDay));
            }
            oldReport.workers.forEach(w => {
                if (w.manDay > 0) decrementPromises.push(manpowerService.incrementManDay(w.workerId, -w.manDay));
            });
            await Promise.all(decrementPromises);

            // 3. Update Document
            await updateDoc(reportRef, {
                ...updates,
                updatedAt: serverTimestamp()
            });

            // 4. Increment New
            const incrementPromises: Promise<void>[] = [];
            if (updates.totalManDay && updates.totalManDay > 0) {
                // Warning: updates.teamId might be missing if not updated, assuming teamId doesn't change usually
                // Safe fallback: use oldReport.teamId unless mapped
                const teamId = updates.teamId || oldReport.teamId;
                const siteId = updates.siteId || oldReport.siteId;

                incrementPromises.push(teamService.incrementManDay(teamId, updates.totalManDay));
                incrementPromises.push(companyService.incrementManDayByTeam(teamId, updates.totalManDay));
                incrementPromises.push(siteService.incrementManDay(siteId, updates.totalManDay));
            }
            if (updates.workers) {
                updates.workers.forEach(w => {
                    if (w.manDay > 0) incrementPromises.push(manpowerService.incrementManDay(w.workerId, w.manDay));
                });
            }
            await Promise.all(incrementPromises);

            toast.updated('일보');
        } catch (error) {
            console.error("Error updating report:", error);
            throw error;
        }
    },

    // Add Reports Batch
    addReportsBatch: async (reports: Omit<DailyReport, 'id'>[]): Promise<void> => {
        try {
            const batch = writeBatch(db);
            const { manpowerService } = await import('./manpowerService');
            const { teamService } = await import('./teamService');
            const { siteService } = await import('./siteService');
            const { companyService } = await import('./companyService');

            // 1. Create Report Documents
            reports.forEach(report => {
                const docRef = doc(collection(db, COLLECTION_NAME));
                batch.set(docRef, {
                    ...report,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });
            });

            // 2. Update Stats
            const workerUpdates = new Map<string, number>();
            const teamUpdates = new Map<string, number>();
            const siteUpdates = new Map<string, number>();

            reports.forEach(report => {
                // Team & Site
                if (report.totalManDay > 0) {
                    teamUpdates.set(report.teamId, (teamUpdates.get(report.teamId) || 0) + report.totalManDay);
                    siteUpdates.set(report.siteId, (siteUpdates.get(report.siteId) || 0) + report.totalManDay);
                }

                // Workers
                report.workers.forEach(worker => {
                    if (worker.manDay > 0) {
                        workerUpdates.set(worker.workerId, (workerUpdates.get(worker.workerId) || 0) + worker.manDay);
                    }
                });
            });

            await batch.commit();
            toast.saved('일보', reports.length);

            // 3. Update Stats (Parallel)
            const updatePromises: Promise<void>[] = [];

            workerUpdates.forEach((amount, id) => {
                updatePromises.push(manpowerService.incrementManDay(id, amount));
            });
            teamUpdates.forEach((amount, id) => {
                updatePromises.push(teamService.incrementManDay(id, amount));
                updatePromises.push(companyService.incrementManDayByTeam(id, amount));
            });
            siteUpdates.forEach((amount, id) => {
                updatePromises.push(siteService.incrementManDay(id, amount));
            });

            await Promise.all(updatePromises);

        } catch (error) {
            console.error("Error adding batch reports:", error);
            throw error;
        }
    },

    // Overwrite Reports for Date (Delete existing for teams, then Insert new)
    overwriteReports: async (date: string, reports: Omit<DailyReport, 'id'>[], teamIdsToCheck: string[]): Promise<void> => {
        try {
            const batch = writeBatch(db);
            const { manpowerService } = await import('./manpowerService');
            const { teamService } = await import('./teamService');
            const { siteService } = await import('./siteService');
            const { companyService } = await import('./companyService');

            // 1. Find Existing Reports for these Teams on this Date
            // We fetch ALL reports for the date first to avoid 'in' query limits (max 10)
            const q = query(collection(db, COLLECTION_NAME), where('date', '==', date));
            const snapshot = await getDocs(q);

            const docsToDelete = snapshot.docs.filter(doc => {
                const data = doc.data() as DailyReport;
                return teamIdsToCheck.includes(data.teamId);
            });

            // 2. Delete matches
            docsToDelete.forEach(d => {
                batch.delete(d.ref);
            });

            // 3. Create New Report Documents
            // Helper to remove undefined values (Firestore rejects them)
            const sanitizeData = (data: any): any => {
                if (Array.isArray(data)) {
                    return data.map(item => sanitizeData(item));
                }
                if (data !== null && typeof data === 'object') {
                    const newObj: any = {};
                    Object.keys(data).forEach(key => {
                        const value = data[key];
                        if (value !== undefined) {
                            newObj[key] = sanitizeData(value);
                        } else {
                            newObj[key] = null; // Convert undefined to null
                        }
                    });
                    return newObj;
                }
                return data;
            };

            reports.forEach(report => {
                const docRef = doc(collection(db, COLLECTION_NAME)); // Auto ID
                const sanitizedReport = sanitizeData(report);

                batch.set(docRef, {
                    ...sanitizedReport,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });
            });

            // 4. Update Stats (Blind Increment for new reports)
            // Note: Ideally we should decrement old stats first. 
            // Since we deleted the documents, the stats are now "stale" (high).
            // Complexity: To decrement, we need to aggregate the deleted docs.
            // Let's DO IT properly to avoid infinite growth of stats.

            const workerUpdates = new Map<string, number>();
            const teamUpdates = new Map<string, number>();
            const siteUpdates = new Map<string, number>();

            // A. Decrement for Deleted
            docsToDelete.forEach(d => {
                const data = d.data() as DailyReport;
                // Team & Site (Decrement)
                if (data.totalManDay > 0) {
                    teamUpdates.set(data.teamId, (teamUpdates.get(data.teamId) || 0) - data.totalManDay);
                    siteUpdates.set(data.siteId, (siteUpdates.get(data.siteId) || 0) - data.totalManDay);
                }
                // Workers (Decrement)
                data.workers.forEach(w => {
                    if (w.manDay > 0) {
                        workerUpdates.set(w.workerId, (workerUpdates.get(w.workerId) || 0) - w.manDay);
                    }
                });
            });

            // B. Increment for New
            reports.forEach(report => {
                if (report.totalManDay > 0) {
                    teamUpdates.set(report.teamId, (teamUpdates.get(report.teamId) || 0) + report.totalManDay);
                    siteUpdates.set(report.siteId, (siteUpdates.get(report.siteId) || 0) + report.totalManDay);
                }
                report.workers.forEach(worker => {
                    if (worker.manDay > 0) {
                        workerUpdates.set(worker.workerId, (workerUpdates.get(worker.workerId) || 0) + worker.manDay);
                    }
                });
            });

            await batch.commit();
            toast.saved('일보 (덮어쓰기)', reports.length);

            // 5. Apply Stats Updates
            const updatePromises: Promise<void>[] = [];

            workerUpdates.forEach((amount, id) => {
                if (amount !== 0) updatePromises.push(manpowerService.incrementManDay(id, amount));
            });
            teamUpdates.forEach((amount, id) => {
                if (amount !== 0) {
                    updatePromises.push(teamService.incrementManDay(id, amount));
                    updatePromises.push(companyService.incrementManDayByTeam(id, amount));
                }
            });
            siteUpdates.forEach((amount, id) => {
                if (amount !== 0) updatePromises.push(siteService.incrementManDay(id, amount));
            });

            await Promise.all(updatePromises);

        } catch (error) {
            console.error("Error overwriting reports:", error);
            throw error;
        }
    },
    getLastReportDate: async (teamId?: string): Promise<string | null> => {
        try {
            let q = query(collection(db, COLLECTION_NAME), orderBy('date', 'desc'), limit(1));
            if (teamId) {
                q = query(collection(db, COLLECTION_NAME), where('teamId', '==', teamId), orderBy('date', 'desc'), limit(1));
            }

            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                return snapshot.docs[0].data().date;
            }
            return null;
        } catch (error) {
            console.error("Error fetching last report date:", error);
            return null;
        }
    },

    // Get Reports by Date and Team
    getReports: async (date: string, teamId?: string): Promise<DailyReport[]> => {
        try {
            let q = query(collection(db, COLLECTION_NAME), where('date', '==', date));
            if (teamId) {
                q = query(q, where('teamId', '==', teamId));
            }
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as DailyReport));
        } catch (error) {
            console.error("Error fetching reports:", error);
            throw error;
        }
    },

    // Get Reports by Date Range and Team
    getReportsByRange: async (startDate: string, endDate: string, teamId?: string, siteId?: string): Promise<DailyReport[]> => {
        try {
            const q = query(
                collection(db, COLLECTION_NAME),
                where('date', '>=', startDate),
                where('date', '<=', endDate),
                orderBy('date', 'desc')
            );

            const querySnapshot = await getDocs(q);
            let reports = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as DailyReport));

            // Client-side filtering
            if (teamId) {
                reports = reports.filter(report => report.teamId === teamId);
            }

            if (siteId) {
                reports = reports.filter(report => report.siteId === siteId);
            }

            return reports;
        } catch (error) {
            console.error("Error fetching reports by range:", error);
            throw error;
        }
    },

    // Check if report exists
    checkReportExists: async (date: string, teamId: string, siteId: string): Promise<boolean> => {
        try {
            const q = query(
                collection(db, COLLECTION_NAME),
                where('date', '==', date),
                where('teamId', '==', teamId),
                where('siteId', '==', siteId)
            );
            const querySnapshot = await getDocs(q);
            return !querySnapshot.empty;
        } catch (error) {
            console.error("Error checking report existence:", error);
            throw error;
        }
    },

    // Remove worker from report and update cumulative stats
    removeWorkerFromReport: async (reportId: string, workerId: string): Promise<void> => {
        try {
            const reportRef = doc(db, COLLECTION_NAME, reportId);
            const reportSnap = await getDocs(query(collection(db, COLLECTION_NAME), where('__name__', '==', reportId)));

            if (reportSnap.empty) throw new Error("Report not found");

            const reportData = reportSnap.docs[0].data() as DailyReport;
            const workerToRemove = reportData.workers.find(w => w.workerId === workerId);

            if (!workerToRemove) throw new Error("Worker not found in report");

            // 1. Decrement cumulative man-days
            const { manpowerService } = await import('./manpowerService');
            const { teamService } = await import('./teamService');
            const { siteService } = await import('./siteService');
            const { companyService } = await import('./companyService');

            const updatePromises = [];

            if (workerToRemove.manDay > 0) {
                updatePromises.push(manpowerService.incrementManDay(workerId, -workerToRemove.manDay));
                updatePromises.push(teamService.incrementManDay(reportData.teamId, -workerToRemove.manDay));
                updatePromises.push(siteService.incrementManDay(reportData.siteId, -workerToRemove.manDay));
                updatePromises.push(companyService.incrementManDayByTeam(reportData.teamId, -workerToRemove.manDay));
            }

            await Promise.all(updatePromises);

            // 2. Remove worker from array
            const updatedWorkers = reportData.workers.filter(w => w.workerId !== workerId);
            const updatedTotalManDay = updatedWorkers.reduce((sum, w) => sum + w.manDay, 0);

            // 3. Update report
            await updateDoc(reportRef, {
                workers: updatedWorkers,
                totalManDay: updatedTotalManDay,
                updatedAt: serverTimestamp()
            });

        } catch (error) {
            console.error("Error removing worker from report:", error);
            throw error;
        }
    },

    // Update worker in report and update cumulative stats
    updateWorkerInReport: async (reportId: string, workerId: string, updates: Partial<DailyReportWorker>): Promise<void> => {
        try {
            const reportRef = doc(db, COLLECTION_NAME, reportId);
            const reportSnap = await getDocs(query(collection(db, COLLECTION_NAME), where('__name__', '==', reportId)));

            if (reportSnap.empty) throw new Error("Report not found");

            const reportData = reportSnap.docs[0].data() as DailyReport;
            const workerIndex = reportData.workers.findIndex(w => w.workerId === workerId);

            if (workerIndex === -1) throw new Error("Worker not found in report");

            const originalWorker = reportData.workers[workerIndex];
            const newManDay = updates.manDay !== undefined ? updates.manDay : originalWorker.manDay;
            const manDayDiff = newManDay - originalWorker.manDay;

            // 1. Update cumulative man-days if changed
            if (manDayDiff !== 0) {
                const { manpowerService } = await import('./manpowerService');
                const { teamService } = await import('./teamService');
                const { siteService } = await import('./siteService');
                const { companyService } = await import('./companyService');

                await Promise.all([
                    manpowerService.incrementManDay(workerId, manDayDiff),
                    teamService.incrementManDay(reportData.teamId, manDayDiff),
                    siteService.incrementManDay(reportData.siteId, manDayDiff),
                    companyService.incrementManDayByTeam(reportData.teamId, manDayDiff)
                ]);
            }

            // 2. Update worker in array
            const updatedWorkers = [...reportData.workers];
            updatedWorkers[workerIndex] = { ...originalWorker, ...updates };
            const updatedTotalManDay = updatedWorkers.reduce((sum, w) => sum + w.manDay, 0);

            // 3. Update report
            await updateDoc(reportRef, {
                workers: updatedWorkers,
                totalManDay: updatedTotalManDay,
                updatedAt: serverTimestamp()
            });

        } catch (error) {
            console.error("Error updating worker in report:", error);
            throw error;
        }
    },

    // Get Reports by Site (for History)
    getReportsBySite: async (siteId: string): Promise<DailyReport[]> => {
        try {
            const q = query(
                collection(db, COLLECTION_NAME),
                where('siteId', '==', siteId),
                orderBy('date', 'desc')
            );
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as DailyReport));
        } catch (error) {
            console.error("Error fetching reports by site:", error);
            throw error;
        }
    },

    // Add Worker to Report (Find or Create)
    addWorkerToReport: async (date: string, teamId: string, teamName: string, siteId: string, siteName: string, worker: DailyReportWorker): Promise<void> => {
        try {
            // 1. Check if report exists
            const q = query(
                collection(db, COLLECTION_NAME),
                where('date', '==', date),
                where('teamId', '==', teamId),
                where('siteId', '==', siteId),
                limit(1)
            );
            const snapshot = await getDocs(q);

            if (!snapshot.empty) {
                // Report exists, add worker
                const reportDoc = snapshot.docs[0];
                const reportData = reportDoc.data() as DailyReport;

                // Check if worker already exists
                const existingWorkerIndex = reportData.workers.findIndex(w => w.workerId === worker.workerId);
                if (existingWorkerIndex !== -1) {
                    // Update existing worker
                    await dailyReportService.updateWorkerInReport(reportDoc.id, worker.workerId, worker);
                } else {
                    // Add new worker
                    const updatedWorkers = [...reportData.workers, worker];
                    const updatedTotalManDay = updatedWorkers.reduce((sum, w) => sum + w.manDay, 0);

                    await updateDoc(doc(db, COLLECTION_NAME, reportDoc.id), {
                        workers: updatedWorkers,
                        totalManDay: updatedTotalManDay,
                        updatedAt: serverTimestamp()
                    });
                    toast.updated('일보');

                    // Update stats
                    const { manpowerService } = await import('./manpowerService');
                    const { teamService } = await import('./teamService');
                    const { siteService } = await import('./siteService');
                    const { companyService } = await import('./companyService');

                    await Promise.all([
                        manpowerService.incrementManDay(worker.workerId, worker.manDay),
                        teamService.incrementManDay(teamId, worker.manDay),
                        siteService.incrementManDay(siteId, worker.manDay),
                        companyService.incrementManDayByTeam(teamId, worker.manDay)
                    ]);
                }
            } else {
                // Report does not exist, create new
                const newReport: DailyReport = {
                    id: '', // Will be set by addDoc
                    date,
                    siteId,
                    siteName,
                    teamId,
                    teamName,
                    responsibleTeamName: teamName, // Default to team name
                    totalManDay: worker.manDay,
                    totalAmount: (worker.manDay || 0) * (worker.unitPrice || 0),
                    workers: [worker],
                    createdAt: new Date() as any,
                    updatedAt: new Date() as any,
                    weather: '맑음',
                    workContent: worker.workContent || '',
                    writerId: 'system'
                };

                // Remove id from object before saving
                const { id, ...reportData } = newReport;
                await addDoc(collection(db, COLLECTION_NAME), {
                    ...reportData,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });

                // Update stats
                const { manpowerService } = await import('./manpowerService');
                const { teamService } = await import('./teamService');
                const { siteService } = await import('./siteService');
                const { companyService } = await import('./companyService');

                await Promise.all([
                    manpowerService.incrementManDay(worker.workerId, worker.manDay),
                    teamService.incrementManDay(teamId, worker.manDay),
                    siteService.incrementManDay(siteId, worker.manDay),
                    companyService.incrementManDayByTeam(teamId, worker.manDay)
                ]);
            }
        } catch (error) {
            console.error("Error adding worker to report:", error);
            throw error;
        }
    },

    // Get DB Stats (Count only - Optimized)
    getDBStats: async (): Promise<{ total: number; thisMonth: number; today: number }> => {
        try {
            const now = new Date();
            const todayStr = now.toISOString().split('T')[0];
            const year = now.getFullYear();
            const month = now.getMonth() + 1;
            const monthStr = month.toString().padStart(2, '0');

            // Start of month: "2024-05-01"
            const startOfMonth = `${year}-${monthStr}-01`;
            // End of month: "2024-05-31" or similar
            const lastDay = new Date(year, month, 0).getDate();
            const endOfMonth = `${year}-${monthStr}-${lastDay}`;

            const colRef = collection(db, COLLECTION_NAME);

            // Parallel Queries
            const [totalSnap, todaySnap, monthSnap] = await Promise.all([
                // 1. Total
                getCountFromServer(query(colRef)),
                // 2. Today
                getCountFromServer(query(colRef, where('date', '==', todayStr))),
                // 3. This Month
                getCountFromServer(query(colRef,
                    where('date', '>=', startOfMonth),
                    where('date', '<=', endOfMonth)
                ))
            ]);

            return {
                total: totalSnap.data().count,
                today: todaySnap.data().count,
                thisMonth: monthSnap.data().count
            };
        } catch (error) {
            console.error("Error fetching DB stats:", error);
            return { total: 0, today: 0, thisMonth: 0 };
        }
    },

    // Get All Reports (for Lookup)
    getAllReports: async (): Promise<DailyReport[]> => {
        try {
            const q = query(collection(db, COLLECTION_NAME), orderBy('date', 'desc'));
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as DailyReport));
        } catch (error) {
            console.error("Error fetching all reports:", error);
            throw error;
        }
    },

    // Delete Reports (Batch)
    deleteReports: async (reportIds: string[]): Promise<void> => {
        try {
            const batchSize = 500;
            for (let i = 0; i < reportIds.length; i += batchSize) {
                const batch = writeBatch(db);
                const chunk = reportIds.slice(i, i + batchSize);

                chunk.forEach(id => {
                    const docRef = doc(db, COLLECTION_NAME, id);
                    batch.delete(docRef);
                });

                await batch.commit();
            }
            toast.deleted('일보', reportIds.length);
        } catch (error) {
            console.error("Error deleting reports:", error);
            throw error;
        }
    },

    // Sync salaryModel to all existing daily reports
    syncReportsSalaryModel: async (): Promise<{ updated: number, errors: string[] }> => {
        const errors: string[] = [];
        let updatedCount = 0;

        try {
            // 1. Get all workers for lookup
            const { manpowerService } = await import('./manpowerService');
            const workers = await manpowerService.getWorkers();
            const workerMap = new Map<string, { teamType: string; salaryModel?: string }>();
            workers.forEach(w => {
                if (w.id) workerMap.set(w.id, { teamType: w.teamType, salaryModel: w.salaryModel });
            });

            // 2. Get all reports
            const reportsSnapshot = await getDocs(collection(db, COLLECTION_NAME));
            const reportsToUpdate: { id: string; workers: DailyReportWorker[] }[] = [];

            reportsSnapshot.docs.forEach(docSnap => {
                const data = docSnap.data() as DailyReport;
                let hasUpdate = false;

                const updatedWorkers = data.workers.map(w => {
                    // Skip if already has salaryModel
                    if (w.salaryModel) return w;

                    const workerInfo = workerMap.get(w.workerId);
                    if (workerInfo) {
                        hasUpdate = true;
                        let salaryModel: string;
                        if (workerInfo.teamType === '지원팀') {
                            salaryModel = '지원팀';
                        } else if (workerInfo.teamType === '용역팀') {
                            salaryModel = '용역팀';
                        } else {
                            salaryModel = workerInfo.salaryModel || '일급제';
                        }
                        return { ...w, salaryModel };
                    }
                    return w;
                });

                if (hasUpdate) {
                    reportsToUpdate.push({ id: docSnap.id, workers: updatedWorkers });
                }
            });

            if (reportsToUpdate.length === 0) {
                return { updated: 0, errors: [] };
            }

            // 3. Batch update (max 500 per batch)
            const batchSize = 500;
            for (let i = 0; i < reportsToUpdate.length; i += batchSize) {
                const batch = writeBatch(db);
                const chunk = reportsToUpdate.slice(i, i + batchSize);

                chunk.forEach(report => {
                    batch.update(doc(db, COLLECTION_NAME, report.id), {
                        workers: report.workers,
                        updatedAt: serverTimestamp()
                    });
                });

                await batch.commit();
                updatedCount += chunk.length;
            }

            return { updated: updatedCount, errors };
        } catch (error) {
            console.error('Error syncing reports salaryModel:', error);
            errors.push(`동기화 중 오류 발생: ${error}`);
            return { updated: updatedCount, errors };
        }
    }
};
