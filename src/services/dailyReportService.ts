import { dailyReportFirestoreService } from './dailyReportFirestoreService';
import {
    DailyReportZod as DailyReport,
    DailyReportInputZod as DailyReportInput,
    DailyReportWorkerZod as DailyReportWorker,
    DailyReportWorkerInputZod as DailyReportWorkerInput,
} from '../types/zod/dailyReportSchema';
import { db } from '../config/firebase';
import {
    collection,
    getDocs,
    query,
    where,
    writeBatch,
    doc,
    getDoc,
} from 'firebase/firestore';

export type { DailyReport, DailyReportWorker };

export interface DailyReportWorkerRow {
    reportId: string;
    date: string;
    teamId: string;
    teamName: string | undefined;
    siteId: string;
    siteName: string | undefined;
    responsibleTeamId?: string | undefined;
    responsibleTeamName?: string | undefined;
    workerId: string;
    name?: string;
    workerName: string;
    role: string | undefined;
    status: 'attendance' | 'absent' | 'half';
    manDay: number;
    unitPrice: number;
    amount: number;
    payType: string | undefined;
    salaryModel: string | undefined;
    workContent: string | undefined;
    siteType: string;
    paymentType: string;
    createdAt: any;
    workerTeamName?: string | undefined;
    workerTeamId?: string | undefined;
}

const normalizeReport = (report: Partial<DailyReport> & { date: string; teamId: string; siteId: string }): DailyReport => ({
    ...report,
    workers: report.workers ?? [],
    totalManDay: report.totalManDay ?? 0,
    totalAmount: report.totalAmount ?? 0,
}) as DailyReport;

export const dailyReportService = {
    addReport: async (report: DailyReportInput): Promise<string> => {
        const normalized = normalizeReport(report as any);
        const docId = await dailyReportFirestoreService.addReport(normalized as any);
        await dailyReportService._updateStats(normalized, 1);
        return docId;
    },

    updateReport: async (id: string, updates: Partial<DailyReport>): Promise<void> => {
        const oldSnap = await getDoc(doc(db, 'daily_reports', id));
        if (!oldSnap.exists()) throw new Error('Report not found');
        const oldData = normalizeReport(oldSnap.data() as any);

        await dailyReportService._updateStats(oldData, -1);
        await dailyReportFirestoreService.updateReport(id, updates);

        const newData = normalizeReport({ ...oldData, ...updates } as any);
        await dailyReportService._updateStats(newData, 1);
    },

    addReportsBatch: async (reports: DailyReportInput[]): Promise<void> => {
        const normalized = reports.map(report => normalizeReport(report as any));
        await dailyReportFirestoreService.saveReportsBatch(normalized as any[]);
        for (const report of normalized) {
            await dailyReportService._updateStats(report, 1);
        }
    },

    overwriteReports: async (date: string, reports: DailyReportInput[], teamIdsToCheck: string[]): Promise<void> => {
        const teamIdSet = new Set(teamIdsToCheck);
        const existingSnap = await getDocs(query(
            collection(db, 'daily_reports'),
            where('date', '==', date)
        ));

        const toDelete = existingSnap.docs.filter(snapshot => teamIdSet.has(String(snapshot.data().teamId ?? '')));
        for (const snapshot of toDelete) {
            await dailyReportService._updateStats(normalizeReport(snapshot.data() as any), -1);
            await dailyReportFirestoreService.deleteReport(snapshot.id);
        }

        await dailyReportService.addReportsBatch(reports);
    },

    deleteReport: async (id: string): Promise<void> => {
        const snap = await getDoc(doc(db, 'daily_reports', id));
        if (snap.exists()) {
            await dailyReportService._updateStats(normalizeReport(snap.data() as any), -1);
        }
        await dailyReportFirestoreService.deleteReport(id);
    },

    deleteReports: async (ids: string[]): Promise<void> => {
        const batch = writeBatch(db);
        for (const id of ids) {
            const snap = await getDoc(doc(db, 'daily_reports', id));
            if (snap.exists()) {
                await dailyReportService._updateStats(normalizeReport(snap.data() as any), -1);
            }
            batch.delete(doc(db, 'daily_reports', id));
        }
        await batch.commit();
    },

    getReport: async (id: string): Promise<DailyReport | null> => {
        const report = await dailyReportFirestoreService.getReport(id);
        return report ? normalizeReport(report as any) : null;
    },

    getReports: async (
        paramsOrDate: {
            startDate?: string;
            endDate?: string;
            teamId?: string;
            siteId?: string;
        } | string = {},
        legacyTeamId?: string,
        legacySiteId?: string
    ): Promise<DailyReport[]> => {
        const params = typeof paramsOrDate === 'string'
            ? { startDate: paramsOrDate, endDate: paramsOrDate, teamId: legacyTeamId, siteId: legacySiteId }
            : paramsOrDate;

        const normalized = {
            startDate: params.startDate ?? params.endDate,
            endDate: params.endDate ?? params.startDate,
            teamId: params.teamId,
            siteId: params.siteId,
        };

        if (!normalized.startDate && !normalized.endDate) {
            const all = await dailyReportService.getAllReports();
            return all.filter(report => {
                if (normalized.teamId && report.teamId !== normalized.teamId) return false;
                if (normalized.siteId && report.siteId !== normalized.siteId) return false;
                return true;
            });
        }

        const reports = await dailyReportFirestoreService.getReportsByRange({
            startDate: normalized.startDate || '',
            endDate: normalized.endDate || '',
            teamId: normalized.teamId,
            siteId: normalized.siteId,
        });
        return reports.map(report => normalizeReport(report as any));
    },

    getReportsList: async (): Promise<DailyReport[]> => {
        return dailyReportService.getReports();
    },

    getAllReports: async (): Promise<DailyReport[]> => {
        const snapshots = await getDocs(collection(db, 'daily_reports'));
        return snapshots.docs.map(snapshot => normalizeReport({ id: snapshot.id, ...(snapshot.data() as any) }));
    },

    _updateStats: async (report: DailyReport, multiplier: number) => {
        try {
            const { manpowerService } = await import('./manpowerService');
            const { teamService } = await import('./teamService');
            const { siteService } = await import('./siteService');
            const { companyService } = await import('./companyService');

            const promises: Promise<any>[] = [];
            const totalManDay = report.totalManDay || 0;

            report.workers.forEach(worker => {
                if (worker.workerId && !worker.workerId.startsWith('unknown') && worker.manDay > 0) {
                    promises.push(manpowerService.incrementManDay(worker.workerId, worker.manDay * multiplier));
                }
            });

            if (totalManDay > 0 && report.teamId) {
                promises.push(teamService.incrementManDay(report.teamId, totalManDay * multiplier));
                try {
                    promises.push(companyService.incrementManDayByTeam(report.teamId, totalManDay * multiplier));
                } catch {
                }
            }

            if (totalManDay > 0 && report.siteId) {
                promises.push(siteService.incrementManDay(report.siteId, totalManDay * multiplier));
            }

            await Promise.all(promises);
        } catch (error) {
            console.warn('[dailyReportService] _updateStats failed (ignored):', error);
        }
    },

    getWorkerRows: async (params: {
        startDate?: string;
        endDate?: string;
        teamId?: string;
        siteId?: string;
    } = {}): Promise<DailyReportWorkerRow[]> => {
        const reports = await dailyReportService.getReports(params);
        const { siteService } = await import('./siteService');
        const sites = await siteService.getSites();
        const siteMap = new Map(sites.map(site => [site.id, site]));

        const rows: DailyReportWorkerRow[] = [];
        reports.forEach(report => {
            const site = report.siteId ? siteMap.get(report.siteId) : undefined;

            report.workers.forEach(worker => {
                const unitPrice = worker.unitPrice || 0;
                rows.push({
                    reportId: report.id || '',
                    date: report.date,
                    teamId: report.teamId,
                    teamName: report.teamName,
                    siteId: report.siteId,
                    siteName: report.siteName,
                    responsibleTeamId: report.responsibleTeamId ?? site?.responsibleTeamId,
                    responsibleTeamName: report.responsibleTeamName ?? site?.responsibleTeamName,
                    workerId: worker.workerId,
                    workerName: worker.name,
                    role: worker.role,
                    status: worker.status,
                    manDay: worker.manDay,
                    unitPrice,
                    amount: worker.manDay * unitPrice,
                    payType: worker.payType,
                    salaryModel: worker.salaryModel,
                    workContent: worker.workContent,
                    siteType: worker.siteType || report.siteType || '',
                    paymentType: worker.paymentType || report.paymentType || '',
                    createdAt: report.createdAt,
                    workerTeamName: worker.workerTeamName,
                    workerTeamId: worker.teamId,
                });
            });
        });

        return rows;
    },

    getReportWorkerRowsByRange: async (params: { startDate: string; endDate: string; teamId?: string; siteId?: string }) => {
        return dailyReportService.getWorkerRows(params);
    },

    getReportsByRange: async (startDate: string, endDate: string, teamId?: string, siteId?: string): Promise<DailyReport[]> => {
        return dailyReportService.getReports({ startDate, endDate, teamId, siteId });
    },

    checkReportExists: async (date: string, teamId: string, siteId: string): Promise<boolean> => {
        const reports = await dailyReportService.getReports(date, teamId, siteId);
        return reports.length > 0;
    },

    getReportsBySite: async (siteId: string): Promise<DailyReport[]> => {
        const normalizedTargetSiteId = String(siteId ?? '').trim();
        if (!normalizedTargetSiteId) return [];

        const reports = await dailyReportService.getAllReports();

        // 현장 ID 체계가 바뀐 경우(legacyId <-> id)에도 과거 일보를 함께 조회한다.
        const { siteService } = await import('./siteService');
        const allSites = await siteService.getSites();

        const candidateSiteIds = new Set<string>();
        const candidateSiteNames = new Set<string>();
        candidateSiteIds.add(normalizedTargetSiteId);

        let expanded = true;
        while (expanded) {
            expanded = false;
            allSites.forEach((site) => {
                const id = String(site.id ?? '').trim();
                const legacyId = String(site.legacyId ?? '').trim();
                if (!id && !legacyId) return;

                const isLinked = (id && candidateSiteIds.has(id)) || (legacyId && candidateSiteIds.has(legacyId));
                if (!isLinked) return;

                if (id && !candidateSiteIds.has(id)) {
                    candidateSiteIds.add(id);
                    expanded = true;
                }
                if (legacyId && !candidateSiteIds.has(legacyId)) {
                    candidateSiteIds.add(legacyId);
                    expanded = true;
                }

                const name = String(site.name ?? '').trim();
                if (name) candidateSiteNames.add(name);
            });
        }

        return reports.filter((report) => {
            const reportSiteId = String(report.siteId ?? '').trim();
            if (reportSiteId && candidateSiteIds.has(reportSiteId)) return true;

            // 일부 구 데이터가 siteId가 비정상인 경우를 대비해 siteName도 보조 매칭한다.
            const reportSiteName = String(report.siteName ?? '').trim();
            return !!reportSiteName && candidateSiteNames.has(reportSiteName);
        });
    },

    syncReportsSalaryModel: async (): Promise<{ updated: number; errors: string[] }> => {
        const errors: string[] = [];
        let updated = 0;

        try {
            const { manpowerService } = await import('./manpowerService');
            const workers = await manpowerService.getWorkers(true);
            const workerMap = new Map(
                workers
                    .filter(worker => worker.id)
                    .map(worker => [
                        String(worker.id),
                        {
                            salaryModel: worker.salaryModel ?? worker.payType,
                            payType: worker.payType ?? worker.salaryModel,
                        },
                    ])
            );

            const reports = await dailyReportService.getAllReports();
            for (const report of reports) {
                if (!report.id) continue;

                let changed = false;
                const nextWorkers = report.workers.map(worker => {
                    const current = workerMap.get(String(worker.workerId));
                    if (!current) return worker;

                    const nextSalaryModel = current.salaryModel ?? worker.salaryModel;
                    const nextPayType = current.payType ?? worker.payType;
                    if (nextSalaryModel !== worker.salaryModel || nextPayType !== worker.payType) {
                        changed = true;
                    }

                    return {
                        ...worker,
                        salaryModel: nextSalaryModel,
                        payType: nextPayType,
                    };
                });

                if (!changed) continue;

                const totalManDay = nextWorkers.reduce((sum, worker) => sum + (worker.manDay || 0), 0);
                const totalAmount = nextWorkers.reduce((sum, worker) => sum + ((worker.manDay || 0) * (worker.unitPrice || 0)), 0);
                await dailyReportFirestoreService.updateReport(report.id, {
                    workers: nextWorkers,
                    totalManDay,
                    totalAmount,
                } as any);
                updated += 1;
            }
        } catch (error) {
            console.error('Error syncing daily report salary models:', error);
            errors.push(String(error));
        }

        return { updated, errors };
    },

    getLastReportDate: async (teamId: string): Promise<string | null> => {
        const reports = await dailyReportFirestoreService.getReportsByTeam(teamId, 1);
        return reports.length > 0 ? reports[0].date : null;
    },

    addWorkerToReport: async (
        date: string,
        teamId: string,
        teamName: string,
        siteId: string,
        siteName: string,
        worker: DailyReportWorkerInput,
        extraFields: Partial<DailyReport> = {}
    ): Promise<void> => {
        const reports = await dailyReportService.getReports({ startDate: date, endDate: date, teamId, siteId });
        const report = reports[0];

        if (!report) {
            await dailyReportService.addReport({
                ...extraFields,
                date,
                teamId,
                teamName,
                siteId,
                siteName,
                workers: [worker],
                totalManDay: worker.manDay || 0,
                totalAmount: (worker.manDay || 0) * (worker.unitPrice || 0),
            });
            return;
        }

        const updatedWorkers = [...report.workers];
        const existingIndex = updatedWorkers.findIndex(existingWorker => existingWorker.workerId === worker.workerId);
        if (existingIndex >= 0) {
            updatedWorkers[existingIndex] = { ...updatedWorkers[existingIndex], ...worker };
        } else {
            updatedWorkers.push(worker as DailyReportWorker);
        }

        const totalManDay = updatedWorkers.reduce((sum, currentWorker) => sum + (currentWorker.manDay || 0), 0);
        const totalAmount = updatedWorkers.reduce((sum, currentWorker) => sum + ((currentWorker.manDay || 0) * (currentWorker.unitPrice || 0)), 0);
        await dailyReportService.updateReport(report.id as string, {
            ...extraFields,
            workers: updatedWorkers,
            totalManDay,
            totalAmount,
        });
    },

    updateWorkerInReport: async (reportId: string, workerId: string, updates: Partial<DailyReportWorker>): Promise<void> => {
        const report = await dailyReportService.getReport(reportId);
        if (!report) throw new Error('Report not found');

        const updatedWorkers = [...report.workers];
        const index = updatedWorkers.findIndex(worker => worker.workerId === workerId);
        if (index === -1) throw new Error('Worker not found in report');

        updatedWorkers[index] = { ...updatedWorkers[index], ...updates };
        const totalManDay = updatedWorkers.reduce((sum, worker) => sum + (worker.manDay || 0), 0);
        const totalAmount = updatedWorkers.reduce((sum, worker) => sum + ((worker.manDay || 0) * (worker.unitPrice || 0)), 0);

        await dailyReportService.updateReport(reportId, {
            workers: updatedWorkers,
            totalManDay,
            totalAmount,
        });
    },

    removeWorkerFromReport: async (reportId: string, workerId: string): Promise<void> => {
        const report = await dailyReportService.getReport(reportId);
        if (!report) throw new Error('Report not found');

        const updatedWorkers = report.workers.filter(worker => worker.workerId !== workerId);
        const totalManDay = updatedWorkers.reduce((sum, worker) => sum + (worker.manDay || 0), 0);
        const totalAmount = updatedWorkers.reduce((sum, worker) => sum + ((worker.manDay || 0) * (worker.unitPrice || 0)), 0);

        await dailyReportService.updateReport(reportId, {
            workers: updatedWorkers,
            totalManDay,
            totalAmount,
        });
    },

    getDBStats: async () => {
        return dailyReportFirestoreService.getDBStats();
    },

    addWorkersToReportBatch: async (params: {
        date: string;
        teamId: string;
        teamName: string;
        siteId: string;
        siteName: string;
        workers: DailyReportWorker[];
    }) => {
        await dailyReportFirestoreService.upsertReportWorkersBatch(params);

        const tempReport: DailyReport = normalizeReport({
            date: params.date,
            teamId: params.teamId,
            teamName: params.teamName,
            siteId: params.siteId,
            siteName: params.siteName,
            workers: params.workers,
            totalManDay: params.workers.reduce((sum, worker) => sum + (worker.manDay || 0), 0),
            totalAmount: params.workers.reduce((sum, worker) => sum + ((worker.manDay || 0) * (worker.unitPrice || 0)), 0),
        });

        await dailyReportService._updateStats(tempReport, 1);
    },
};

