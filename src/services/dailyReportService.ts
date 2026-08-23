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
import { normalizeLooseDateString, normalizeLooseDateText } from '../utils/dateNormalization';
import { resolveReportPayType, resolveWorkerPayType, syncPayTypeFields } from '../utils/payType';
import {
    applyDailyReportSiteSnapshotToReport,
    buildDailyReportSiteSnapshot,
    findDailyReportSite,
    DailyReportSiteSnapshot,
    DailyReportSiteSnapshotFallback,
} from '../utils/dailyReportSiteSnapshot';

export type { DailyReport, DailyReportWorker };

type SiteSnapshotResolver = (report: DailyReportSiteSnapshotFallback & {
    siteId?: unknown;
    siteName?: unknown;
}) => Promise<DailyReportSiteSnapshot>;

export interface DailyReportWorkerRow {
    reportId: string;
    isEmptyReport?: boolean;
    workerIndex?: number;
    date: string;
    teamId: string;
    teamName: string | undefined;
    siteId: string;
    siteName: string | undefined;
    siteAddress?: string | undefined;
    responsibleTeamId?: string | undefined;
    responsibleTeamName?: string | undefined;
    siteManagerId?: string | undefined;
    siteManagerName?: string | undefined;
    companyId?: string | undefined;
    companyName?: string | undefined;
    constructorCompanyId?: string | undefined;
    constructorCompanyName?: string | undefined;
    partnerId?: string | undefined;
    partnerName?: string | undefined;
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

export interface DailyReportWorkerBulkUpdateTarget {
    reportId: string;
    workerId: string;
    workerIndex?: number;
    updates: Partial<DailyReportWorker>;
}

export interface DailyReportWorkerBulkDeleteTarget {
    reportId: string;
    workerId: string;
    workerIndex?: number;
}

interface DailyReportUpdateDraft {
    id: string;
    oldData: DailyReport;
    newData: DailyReport;
}

const toSnapshotText = (value: unknown): string | undefined => {
    const text = String(value ?? '').trim();
    return text || undefined;
};

const createSiteSnapshotResolver = (): SiteSnapshotResolver => {
    let sitesPromise: Promise<any[]> | null = null;
    let teamsPromise: Promise<any[]> | null = null;
    let companiesPromise: Promise<any[]> | null = null;

    return async (report) => {
        const reportSiteId = toSnapshotText(report.siteId);
        const reportSiteName = toSnapshotText(report.siteName);
        if (!reportSiteId && !reportSiteName) {
            return buildDailyReportSiteSnapshot({ fallback: report });
        }

        if (!sitesPromise) {
            const { siteService } = await import('./siteService');
            sitesPromise = siteService.getSites();
        }
        if (!teamsPromise) {
            const { teamService } = await import('./teamService');
            teamsPromise = teamService.getTeams();
        }
        if (!companiesPromise) {
            const { companyService } = await import('./companyService');
            companiesPromise = companyService.getCompanies();
        }

        const [sites, teams, companies] = await Promise.all([sitesPromise, teamsPromise, companiesPromise]);
        const matchedSite = findDailyReportSite(sites, reportSiteId, reportSiteName);

        return buildDailyReportSiteSnapshot({
            site: matchedSite,
            siteId: reportSiteId,
            siteName: reportSiteName,
            teams,
            companies,
            fallback: report,
        });
    };
};

const enrichReportWithSiteSnapshot = async <T extends Partial<DailyReportInput> & {
    siteId?: unknown;
    siteName?: unknown;
    workers?: any[];
}>(
    report: T,
    resolveSiteSnapshot: SiteSnapshotResolver = createSiteSnapshotResolver()
): Promise<T> => {
    const snapshot = await resolveSiteSnapshot(report as any);
    return applyDailyReportSiteSnapshotToReport(report, snapshot);
};

const enrichReportsWithSiteSnapshots = async <T extends Partial<DailyReportInput> & {
    siteId?: unknown;
    siteName?: unknown;
    workers?: any[];
}>(reports: T[]): Promise<T[]> => {
    const resolveSiteSnapshot = createSiteSnapshotResolver();
    return Promise.all(reports.map(report => enrichReportWithSiteSnapshot(report, resolveSiteSnapshot)));
};

const normalizeReport = (report: Partial<DailyReport> & { date: string; teamId: string; siteId: string }): DailyReport => ({
    ...report,
    date: normalizeLooseDateText(report.date),
    workers: Array.isArray(report.workers)
        ? report.workers.map((worker) => syncPayTypeFields(worker, { returnUndefinedOnEmpty: true, priority: 'salaryModel' }))
        : [],
    totalManDay: report.totalManDay ?? 0,
    totalAmount: report.totalAmount ?? 0,
}) as DailyReport;

const normalizeReportForStats = async (
    report: Partial<DailyReport> & { date: string; teamId: string; siteId: string },
    resolveSiteSnapshot: SiteSnapshotResolver = createSiteSnapshotResolver()
): Promise<DailyReport> => {
    const normalized = normalizeReport(report);
    const enriched = await enrichReportWithSiteSnapshot(normalized as any, resolveSiteSnapshot);
    return normalizeReport(enriched as any);
};

const didDailyReportSiteIdentityChange = (
    existingReport: Partial<DailyReport>,
    updates: Partial<DailyReport>
): boolean => {
    const changedField = (key: 'siteId' | 'siteName'): boolean => {
        if (updates[key] === undefined) return false;
        return String(updates[key] ?? '').trim() !== String(existingReport[key] ?? '').trim();
    };
    return changedField('siteId') || changedField('siteName');
};

const filterReportsByParams = (reports: DailyReport[], params: {
    startDate?: string;
    endDate?: string;
    teamId?: string;
    siteId?: string;
}): DailyReport[] => {
    const normalizedStartDate = normalizeLooseDateString(params.startDate);
    const normalizedEndDate = normalizeLooseDateString(params.endDate);

    return reports.filter((report) => {
        const normalizedReportDate = normalizeLooseDateString(report.date);
        if (!normalizedReportDate) return false;
        if (normalizedStartDate && normalizedReportDate < normalizedStartDate) return false;
        if (normalizedEndDate && normalizedReportDate > normalizedEndDate) return false;
        if (params.teamId && report.teamId !== params.teamId) return false;
        if (params.siteId && report.siteId !== params.siteId) return false;
        return true;
    }).sort((a, b) => {
        const dateCompare = String(b.date ?? '').localeCompare(String(a.date ?? ''));
        if (dateCompare !== 0) return dateCompare;
        return String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? ''));
    });
};

// undefined를 null로 치환 (타입 보존)
const cleanWorker = (worker: any): DailyReportWorker => {
    const cleaned: any = { ...worker };
    Object.keys(cleaned).forEach((k) => {
        if (cleaned[k] === undefined) cleaned[k] = null;
    });
    return cleaned as DailyReportWorker;
};

const normalizeReportUpdates = (updates: Partial<DailyReport>): Partial<DailyReport> => {
    let normalizedUpdates: Partial<DailyReport> = {
        ...updates,
        ...(updates.date !== undefined ? { date: normalizeLooseDateText(updates.date) } : {})
    };

    if (Array.isArray(normalizedUpdates.workers)) {
        normalizedUpdates = {
            ...normalizedUpdates,
            workers: normalizedUpdates.workers.map(cleanWorker)
        };
    }

    return normalizedUpdates;
};

const notifyDailyReportSystemMessage = async (
    event: 'dailyReport.created' | 'dailyReport.updated' | 'dailyReport.deleted',
    report: DailyReport,
    beforeReport?: DailyReport | null,
    source = 'dailyReportService'
): Promise<void> => {
    let changeLog: any = null;
    const actionMap = {
        'dailyReport.created': 'created',
        'dailyReport.updated': 'updated',
        'dailyReport.deleted': 'deleted',
    } as const;

    try {
        const { dailyReportLogService } = await import('./dailyReportLogService');
        changeLog = await dailyReportLogService.createLog({
            action: actionMap[event],
            before: beforeReport || null,
            after: event === 'dailyReport.deleted' ? null : report,
            source,
        });
    } catch (error) {
        console.warn('[dailyReportService] daily report log failed:', error);
    }

    try {
        const { systemMessageService } = await import('./systemMessageService');
        await systemMessageService.notifyDailyReportEvent(event, report as any, changeLog || undefined);
    } catch (error) {
        console.warn('[dailyReportService] system message notification failed:', error);
    }
};

const buildReportUpdateDraft = async (
    id: string,
    existingReport: Partial<DailyReport> & { date: string; teamId: string; siteId: string },
    updates: Partial<DailyReport>,
    resolveSiteSnapshot: SiteSnapshotResolver = createSiteSnapshotResolver()
): Promise<DailyReportUpdateDraft> => {
    // 기존 출력일보에 저장된 당시 팀·현장 스냅샷을 현재 마스터로 덮어쓰지 않는다.
    const oldData = normalizeReport({ id, ...existingReport });
    const normalizedUpdates = normalizeReportUpdates(updates);
    const merged = normalizeReport({ ...oldData, ...normalizedUpdates } as any);
    const newData = didDailyReportSiteIdentityChange(oldData, normalizedUpdates)
        ? await normalizeReportForStats(merged as any, resolveSiteSnapshot)
        : merged;

    return { id, oldData, newData };
};

const runReportUpdateSideEffects = async (
    draft: DailyReportUpdateDraft,
    source = 'dailyReportService'
): Promise<void> => {
    await dailyReportService._updateStatsDelta(draft.oldData, draft.newData);
    await notifyDailyReportSystemMessage('dailyReport.updated', { ...draft.newData, id: draft.id } as DailyReport, draft.oldData, source);
};

const updateReportFromExistingData = async (
    id: string,
    existingReport: Partial<DailyReport> & { date: string; teamId: string; siteId: string },
    updates: Partial<DailyReport>,
): Promise<void> => {
    const draft = await buildReportUpdateDraft(id, existingReport, updates);
    await dailyReportFirestoreService.updateReport(id, draft.newData as any);
    await runReportUpdateSideEffects(draft);
};

export const dailyReportService = {
    addReport: async (report: DailyReportInput): Promise<string> => {
        const enriched = await enrichReportWithSiteSnapshot(report as any);
        const normalized = normalizeReport(enriched as any);
        const docId = await dailyReportFirestoreService.addReport(normalized as any);
        await dailyReportService._updateStats(normalized, 1);
        await notifyDailyReportSystemMessage('dailyReport.created', { ...normalized, id: docId } as DailyReport, null);
        return docId;
    },

    updateReport: async (id: string, updates: Partial<DailyReport>): Promise<void> => {
        const oldSnap = await getDoc(doc(db, 'daily_reports', id));
        if (!oldSnap.exists()) throw new Error('Report not found');
        await updateReportFromExistingData(
            id,
            { id, ...(oldSnap.data() as any) },
            updates
        );
    },

    addReportsBatch: async (reports: DailyReportInput[]): Promise<void> => {
        const enriched = await enrichReportsWithSiteSnapshots(reports as any[]);
        const normalized = enriched.map(report => normalizeReport(report as any));
        const docIds = await dailyReportFirestoreService.saveReportsBatch(normalized as any[]);
        for (const [index, report] of normalized.entries()) {
            const reportWithId = { ...report, id: docIds[index] } as DailyReport;
            await dailyReportService._updateStats(report, 1);
            await notifyDailyReportSystemMessage('dailyReport.created', reportWithId, null, 'dailyReportBatch');
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
            await dailyReportFirestoreService.deleteReport(snapshot.id);
            const oldReport = normalizeReport({ id: snapshot.id, ...(snapshot.data() as any) });
            await dailyReportService._updateStats(oldReport, -1);
            await notifyDailyReportSystemMessage('dailyReport.deleted', oldReport, oldReport, 'dailyReportOverwrite');
        }

        await dailyReportService.addReportsBatch(reports);
    },

    deleteReport: async (id: string): Promise<void> => {
        const snap = await getDoc(doc(db, 'daily_reports', id));
        const oldData = snap.exists() ? normalizeReport({ id, ...(snap.data() as any) }) : null;
        await dailyReportFirestoreService.deleteReport(id);
        if (oldData) {
            await dailyReportService._updateStats(oldData, -1);
            await notifyDailyReportSystemMessage('dailyReport.deleted', oldData, oldData);
        }
    },

    deleteReports: async (ids: string[]): Promise<void> => {
        const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
        const oldReports: DailyReport[] = [];
        for (const id of uniqueIds) {
            const snap = await getDoc(doc(db, 'daily_reports', id));
            if (snap.exists()) {
                oldReports.push(normalizeReport({ id, ...(snap.data() as any) }));
            }
        }

        const chunkSize = 450;
        for (let index = 0; index < uniqueIds.length; index += chunkSize) {
            const batch = writeBatch(db);
            uniqueIds.slice(index, index + chunkSize).forEach((id) => {
                batch.delete(doc(db, 'daily_reports', id));
            });
            await batch.commit();
        }

        for (const report of oldReports) {
            await dailyReportService._updateStats(report, -1);
            await notifyDailyReportSystemMessage('dailyReport.deleted', report, report, 'dailyReportBulkDelete');
        }
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
            teamIds?: string[];
            siteId?: string;
            companyIds?: string[];
        } | string = {},
        legacyTeamId?: string,
        legacySiteId?: string
    ): Promise<DailyReport[]> => {
        const params = typeof paramsOrDate === 'string'
            ? { startDate: paramsOrDate, endDate: paramsOrDate, teamId: legacyTeamId, siteId: legacySiteId }
            : paramsOrDate;

        const normalized = {
            startDate: normalizeLooseDateText(params.startDate ?? params.endDate ?? ''),
            endDate: normalizeLooseDateText(params.endDate ?? params.startDate ?? ''),
            teamId: params.teamId,
            teamIds: Array.from(new Set((params.teamIds || []).map((value) => String(value ?? '').trim()).filter(Boolean))),
            siteId: params.siteId,
            companyIds: Array.from(new Set((params.companyIds || []).map((value) => String(value ?? '').trim()).filter(Boolean))),
        };

        if (normalized.companyIds.length > 0) {
            const reportsByCompany = await Promise.all(
                normalized.companyIds.map((companyId) => dailyReportFirestoreService.getReportsByClientCompany(companyId))
            );
            const uniqueReports = new Map<string, DailyReport>();
            reportsByCompany.flat().forEach((report) => {
                const id = String(report.id || '').trim();
                if (id) uniqueReports.set(id, report as DailyReport);
            });
            return filterReportsByParams(Array.from(uniqueReports.values()), normalized);
        }

        if (normalized.teamIds.length > 0) {
            const hasDateRange = !!normalized.startDate && !!normalized.endDate;
            const reportsByTeam = await Promise.all(normalized.teamIds.map((teamId) => {
                if (hasDateRange) {
                    return dailyReportFirestoreService.getReportsByRange({
                        startDate: normalized.startDate,
                        endDate: normalized.endDate,
                        teamId,
                        siteId: normalized.siteId,
                    });
                }
                return dailyReportFirestoreService.getReportsByTeam(teamId);
            }));
            const uniqueReports = new Map<string, DailyReport>();
            reportsByTeam.flat().forEach((report) => {
                const id = String(report.id || '').trim();
                if (id) uniqueReports.set(id, report as DailyReport);
            });
            return filterReportsByParams(Array.from(uniqueReports.values()), normalized)
                .filter((report) => normalized.teamIds.includes(String(report.teamId ?? '').trim()));
        }

        const hasDateRange = !!normalized.startDate && !!normalized.endDate;
        if (hasDateRange) {
            if (normalized.startDate === normalized.endDate) {
                const daily = await dailyReportFirestoreService.getReportsByDate(normalized.startDate);
                return filterReportsByParams(daily as DailyReport[], normalized);
            }

            const ranged = await dailyReportFirestoreService.getReportsByRange({
                startDate: normalized.startDate,
                endDate: normalized.endDate,
                teamId: normalized.teamId,
                siteId: normalized.siteId,
            });
            return filterReportsByParams(ranged as DailyReport[], normalized);
        }

        const all = await dailyReportService.getAllReports();
        return filterReportsByParams(all, normalized);
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
            }

            if (totalManDay > 0 && report.siteId) {
                promises.push(siteService.incrementManDay(report.siteId, totalManDay * multiplier));
            }

            const clientCompanyId = toSnapshotText(report.companyId);
            if (totalManDay > 0 && clientCompanyId) {
                promises.push(companyService.incrementManDay(clientCompanyId, totalManDay * multiplier));
            }

            const constructorCompanyId = toSnapshotText(report.constructorCompanyId);
            if (totalManDay > 0 && constructorCompanyId) {
                promises.push(companyService.incrementConstructorManDay(constructorCompanyId, totalManDay * multiplier));
            }

            const partnerId = toSnapshotText(report.partnerId);
            if (totalManDay > 0 && partnerId) {
                promises.push(companyService.incrementPartnerManDay(partnerId, totalManDay * multiplier));
            }

            const results = await Promise.allSettled(promises);
            results.forEach((result) => {
                if (result.status === 'rejected') {
                    console.warn('[dailyReportService] cumulative man-day update failed:', result.reason);
                }
            });
        } catch (error) {
            console.warn('[dailyReportService] _updateStats failed (ignored):', error);
        }
    },

    _updateStatsDelta: async (oldReport: DailyReport, newReport: DailyReport) => {
        try {
            const { manpowerService } = await import('./manpowerService');
            const { teamService } = await import('./teamService');
            const { siteService } = await import('./siteService');
            const { companyService } = await import('./companyService');

            const promises: Promise<any>[] = [];
            const addDelta = (deltas: Map<string, number>, id: unknown, amount: number, skipUnknownId = false) => {
                const normalizedId = String(id ?? '').trim();
                if (!normalizedId) return;
                if (skipUnknownId && normalizedId.startsWith('unknown')) return;
                if (!Number.isFinite(amount) || Math.abs(amount) < 0.000001) return;
                deltas.set(normalizedId, (deltas.get(normalizedId) ?? 0) + amount);
            };
            const positiveManDay = (value: unknown): number => {
                const amount = Number(value ?? 0);
                return Number.isFinite(amount) && amount > 0 ? amount : 0;
            };
            const addEntityDelta = (
                oldId: unknown,
                oldAmount: number,
                newId: unknown,
                newAmount: number,
                incrementer: (id: string, amount: number) => Promise<void>
            ) => {
                const deltas = new Map<string, number>();
                addDelta(deltas, oldId, -oldAmount);
                addDelta(deltas, newId, newAmount);
                deltas.forEach((amount, id) => {
                    if (Math.abs(amount) >= 0.000001) {
                        promises.push(incrementer(id, amount));
                    }
                });
            };

            const workerDeltas = new Map<string, number>();
            oldReport.workers.forEach(worker => {
                addDelta(workerDeltas, worker.workerId, -positiveManDay(worker.manDay), true);
            });
            newReport.workers.forEach(worker => {
                addDelta(workerDeltas, worker.workerId, positiveManDay(worker.manDay), true);
            });
            workerDeltas.forEach((amount, workerId) => {
                if (Math.abs(amount) >= 0.000001) {
                    promises.push(manpowerService.incrementManDay(workerId, amount));
                }
            });

            const oldTotalManDay = positiveManDay(oldReport.totalManDay);
            const newTotalManDay = positiveManDay(newReport.totalManDay);
            addEntityDelta(oldReport.teamId, oldTotalManDay, newReport.teamId, newTotalManDay, teamService.incrementManDay);
            addEntityDelta(oldReport.siteId, oldTotalManDay, newReport.siteId, newTotalManDay, siteService.incrementManDay);
            addEntityDelta(toSnapshotText(oldReport.companyId), oldTotalManDay, toSnapshotText(newReport.companyId), newTotalManDay, companyService.incrementManDay);
            addEntityDelta(toSnapshotText(oldReport.constructorCompanyId), oldTotalManDay, toSnapshotText(newReport.constructorCompanyId), newTotalManDay, companyService.incrementConstructorManDay);
            addEntityDelta(toSnapshotText(oldReport.partnerId), oldTotalManDay, toSnapshotText(newReport.partnerId), newTotalManDay, companyService.incrementPartnerManDay);

            const results = await Promise.allSettled(promises);
            results.forEach((result) => {
                if (result.status === 'rejected') {
                    console.warn('[dailyReportService] cumulative man-day delta update failed:', result.reason);
                }
            });
        } catch (error) {
            console.warn('[dailyReportService] _updateStatsDelta failed (ignored):', error);
        }
    },

    getWorkerRows: async (params: {
        startDate?: string;
        endDate?: string;
        teamId?: string;
        teamIds?: string[];
        siteId?: string;
        companyIds?: string[];
    } = {}): Promise<DailyReportWorkerRow[]> => {
        const reports = await dailyReportService.getReports(params);
        const rows: DailyReportWorkerRow[] = [];

        reports.forEach(report => {
            const reportWorkers = Array.isArray(report.workers) ? report.workers : [];

            if (reportWorkers.length === 0) {
                rows.push({
                    reportId: report.id || '',
                    isEmptyReport: true,
                    date: report.date,
                    teamId: report.teamId,
                    teamName: report.teamName,
                    siteId: report.siteId,
                    siteName: report.siteName,
                    ...(toSnapshotText((report as any).siteAddress) ? { siteAddress: toSnapshotText((report as any).siteAddress) } : {}),
                    responsibleTeamId: report.responsibleTeamId ?? report.teamId,
                    responsibleTeamName: report.responsibleTeamName ?? report.teamName,
                    siteManagerId: toSnapshotText((report as any).siteManagerId),
                    siteManagerName: toSnapshotText((report as any).siteManagerName),
                    companyId: toSnapshotText(report.companyId),
                    companyName: toSnapshotText(report.companyName),
                    constructorCompanyId: toSnapshotText(report.constructorCompanyId),
                    constructorCompanyName: toSnapshotText(report.constructorCompanyName),
                    partnerId: toSnapshotText(report.partnerId),
                    partnerName: toSnapshotText(report.partnerName),
                    workerId: `__empty__:${report.id || `${report.date}:${report.siteId}:${report.teamId}`}`,
                    workerName: '작업자 없음',
                    role: undefined,
                    status: 'absent',
                    manDay: 0,
                    unitPrice: 0,
                    amount: 0,
                    payType: undefined,
                    salaryModel: undefined,
                    workContent: report.workContent || '작업자 행이 없는 출력일보',
                    siteType: toSnapshotText(report.siteType) || '',
                    paymentType: toSnapshotText(report.paymentType) || '',
                    createdAt: report.createdAt,
                    workerTeamName: '',
                    workerTeamId: '',
                });
                return;
            }

            reportWorkers.forEach((worker, workerIndex) => {
                const unitPrice = worker.unitPrice || 0;
                const resolvedPayType = resolveReportPayType(worker) || undefined;
                rows.push({
                    reportId: report.id || '',
                    workerIndex,
                    date: report.date,
                    teamId: report.teamId,
                    teamName: report.teamName,
                    siteId: report.siteId,
                    siteName: report.siteName,
                    ...(toSnapshotText((report as any).siteAddress) ? { siteAddress: toSnapshotText((report as any).siteAddress) } : {}),
                    responsibleTeamId: report.responsibleTeamId ?? report.teamId,
                    responsibleTeamName: report.responsibleTeamName ?? report.teamName,
                    siteManagerId: toSnapshotText((report as any).siteManagerId),
                    siteManagerName: toSnapshotText((report as any).siteManagerName),
                    companyId: toSnapshotText(report.companyId),
                    companyName: toSnapshotText(report.companyName),
                    constructorCompanyId: toSnapshotText(report.constructorCompanyId),
                    constructorCompanyName: toSnapshotText(report.constructorCompanyName),
                    partnerId: toSnapshotText(report.partnerId),
                    partnerName: toSnapshotText(report.partnerName),
                    workerId: worker.workerId,
                    workerName: worker.name,
                    role: worker.role,
                    status: worker.status,
                    manDay: worker.manDay,
                    unitPrice,
                    amount: worker.manDay * unitPrice,
                    payType: resolvedPayType,
                    salaryModel: resolvedPayType,
                    workContent: worker.workContent,
                    // Read only saved snapshot values. Master-data fallback belongs to write paths.
                    siteType: toSnapshotText(worker.siteType) || toSnapshotText(report.siteType) || '',
                    paymentType: toSnapshotText(worker.paymentType) || toSnapshotText(report.paymentType) || '',
                    createdAt: report.createdAt,
                    workerTeamName: worker.workerTeamName,
                    workerTeamId: worker.teamId,
                });
            });
        });

        return rows;
    },

    getReportWorkerRowsByRange: async (params: { startDate: string; endDate: string; teamId?: string; teamIds?: string[]; siteId?: string }) => {
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
            for (const site of allSites) {
                const id = String(site.id ?? '').trim();
                const legacyId = String(site.legacyId ?? '').trim();
                if (!id && !legacyId) continue;

                const isLinked = (id && candidateSiteIds.has(id)) || (legacyId && candidateSiteIds.has(legacyId));
                if (!isLinked) continue;

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
            }
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
                            payType: resolveWorkerPayType(worker) || undefined,
                            salaryModel: resolveWorkerPayType(worker) || undefined,
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

                    const nextPayType = resolveReportPayType(worker, current) || undefined;
                    const nextSalaryModel = nextPayType;
                    if (nextPayType !== worker.payType || nextSalaryModel !== worker.salaryModel) {
                        changed = true;
                    }

                    return {
                        ...worker,
                        payType: nextPayType,
                        salaryModel: nextSalaryModel,
                    };
                });

                if (!changed) continue;

                const totalManDay = nextWorkers.reduce((sum, worker) => sum + (worker.manDay || 0), 0);
                const totalAmount = nextWorkers.reduce((sum, worker) => sum + ((worker.manDay || 0) * (worker.unitPrice || 0)), 0);
                const nextReport = {
                    ...report,
                    workers: nextWorkers,
                    totalManDay,
                    totalAmount,
                } as DailyReport;
                await dailyReportFirestoreService.updateReport(report.id, {
                    workers: nextWorkers,
                    totalManDay,
                    totalAmount,
                } as any);
                await notifyDailyReportSystemMessage('dailyReport.updated', nextReport, report, 'salaryModelSync');
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
            updatedWorkers[existingIndex] = syncPayTypeFields({ ...updatedWorkers[existingIndex], ...worker } as DailyReportWorker, { returnUndefinedOnEmpty: true, priority: 'salaryModel' });
        } else {
            updatedWorkers.push(syncPayTypeFields(worker as DailyReportWorker, { returnUndefinedOnEmpty: true, priority: 'salaryModel' }));
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

    bulkUpdateWorkersInReports: async (
        targets: DailyReportWorkerBulkUpdateTarget[]
    ): Promise<{ updatedReportCount: number; updatedWorkerCount: number }> => {
        const grouped = new Map<string, DailyReportWorkerBulkUpdateTarget[]>();
        targets.forEach((target) => {
            if (!target.reportId) return;
            const current = grouped.get(target.reportId) ?? [];
            current.push(target);
            grouped.set(target.reportId, current);
        });

        let updatedReportCount = 0;
        let updatedWorkerCount = 0;
        const reportUpdateDrafts: DailyReportUpdateDraft[] = [];
        const resolveSiteSnapshot = createSiteSnapshotResolver();

        for (const [reportId, reportTargets] of grouped.entries()) {
            const report = await dailyReportService.getReport(reportId);
            if (!report) throw new Error('Report not found');

            const updatedWorkers = [...report.workers];
            const touchedIndexes = new Set<number>();

            for (const target of reportTargets) {
                const index = typeof target.workerIndex === 'number'
                    ? target.workerIndex
                    : updatedWorkers.findIndex(worker => worker.workerId === target.workerId);
                if (index === -1) throw new Error('Worker not found in report');
                if (updatedWorkers[index]?.workerId !== target.workerId) {
                    throw new Error('Worker row no longer matches report');
                }
                if (touchedIndexes.has(index)) {
                    throw new Error('Duplicate worker update target');
                }

                const nextWorker = syncPayTypeFields(
                    { ...updatedWorkers[index], ...target.updates } as DailyReportWorker,
                    { returnUndefinedOnEmpty: true, priority: 'salaryModel' }
                );
                const nextManDay = Number(nextWorker.manDay ?? 0);
                const nextUnitPrice = Number(nextWorker.unitPrice ?? 0);
                if (!Number.isFinite(nextManDay) || nextManDay < 0) {
                    throw new Error('Invalid manDay');
                }
                if (!Number.isFinite(nextUnitPrice) || nextUnitPrice < 0) {
                    throw new Error('Invalid unitPrice');
                }

                updatedWorkers[index] = {
                    ...nextWorker,
                    manDay: nextManDay,
                    unitPrice: nextUnitPrice,
                };
                touchedIndexes.add(index);
                updatedWorkerCount += 1;
            }

            const totalManDay = updatedWorkers.reduce((sum, worker) => sum + (worker.manDay || 0), 0);
            const totalAmount = updatedWorkers.reduce((sum, worker) => sum + ((worker.manDay || 0) * (worker.unitPrice || 0)), 0);

            const draft = await buildReportUpdateDraft(reportId, report, {
                workers: updatedWorkers,
                totalManDay,
                totalAmount,
            }, resolveSiteSnapshot);
            reportUpdateDrafts.push(draft);
            updatedReportCount += 1;
        }

        if (reportUpdateDrafts.length > 0) {
            await dailyReportFirestoreService.updateReportsBatch(
                reportUpdateDrafts.map(draft => ({ id: draft.id, data: draft.newData as any }))
            );

            for (const draft of reportUpdateDrafts) {
                await runReportUpdateSideEffects(draft, 'dailyReportBulkUpdate');
            }
        }

        return { updatedReportCount, updatedWorkerCount };
    },

    deleteWorkersFromReports: async (
        targets: DailyReportWorkerBulkDeleteTarget[]
    ): Promise<{ deletedReportCount: number; updatedReportCount: number; deletedWorkerCount: number }> => {
        const grouped = new Map<string, DailyReportWorkerBulkDeleteTarget[]>();
        targets.forEach((target) => {
            if (!target.reportId) return;
            const current = grouped.get(target.reportId) ?? [];
            current.push(target);
            grouped.set(target.reportId, current);
        });

        let deletedWorkerCount = 0;
        const reportUpdateDrafts: DailyReportUpdateDraft[] = [];
        const reportIdsToDelete: string[] = [];
        const resolveSiteSnapshot = createSiteSnapshotResolver();

        for (const [reportId, reportTargets] of grouped.entries()) {
            const report = await dailyReportService.getReport(reportId);
            if (!report) throw new Error('Report not found');

            const deleteIndexes = new Set<number>();

            for (const target of reportTargets) {
                const index = typeof target.workerIndex === 'number'
                    ? target.workerIndex
                    : report.workers.findIndex((worker, workerIndex) => (
                        !deleteIndexes.has(workerIndex) && worker.workerId === target.workerId
                    ));

                if (index < 0 || index >= report.workers.length) {
                    throw new Error('Worker not found in report');
                }
                if (report.workers[index]?.workerId !== target.workerId) {
                    throw new Error('Worker row no longer matches report');
                }
                if (deleteIndexes.has(index)) {
                    throw new Error('Duplicate worker delete target');
                }

                deleteIndexes.add(index);
            }

            const updatedWorkers = report.workers
                .filter((_, index) => !deleteIndexes.has(index))
                .map(cleanWorker);

            deletedWorkerCount += deleteIndexes.size;

            if (updatedWorkers.length === 0) {
                reportIdsToDelete.push(reportId);
                continue;
            }

            const totalManDay = updatedWorkers.reduce((sum, worker) => sum + ((worker.manDay || 0) as number), 0);
            const totalAmount = updatedWorkers.reduce((sum, worker) => sum + (((worker.manDay || 0) as number) * ((worker.unitPrice || 0) as number)), 0);

            const draft = await buildReportUpdateDraft(reportId, report, {
                workers: updatedWorkers,
                totalManDay,
                totalAmount,
            }, resolveSiteSnapshot);
            reportUpdateDrafts.push(draft);
        }

        if (reportUpdateDrafts.length > 0) {
            await dailyReportFirestoreService.updateReportsBatch(
                reportUpdateDrafts.map(draft => ({ id: draft.id, data: draft.newData as any }))
            );

            for (const draft of reportUpdateDrafts) {
                await runReportUpdateSideEffects(draft, 'dailyReportBulkDelete');
            }
        }

        if (reportIdsToDelete.length > 0) {
            await dailyReportService.deleteReports(reportIdsToDelete);
        }

        return {
            deletedReportCount: reportIdsToDelete.length,
            updatedReportCount: reportUpdateDrafts.length,
            deletedWorkerCount,
        };
    },

    updateWorkerInReport: async (
        reportId: string,
        workerId: string,
        updates: Partial<DailyReportWorker>,
        workerIndex?: number,
        reportUpdates: Partial<DailyReport> = {}
    ): Promise<void> => {
        const report = await dailyReportService.getReport(reportId);
        if (!report) throw new Error('Report not found');

        const updatedWorkers = [...report.workers];
        const index = typeof workerIndex === 'number'
            ? workerIndex
            : updatedWorkers.findIndex(worker => worker.workerId === workerId);
        if (index === -1) throw new Error('Worker not found in report');
        if (updatedWorkers[index]?.workerId !== workerId) {
            throw new Error('Worker row no longer matches report');
        }

        const nextWorker = syncPayTypeFields({ ...updatedWorkers[index], ...updates } as DailyReportWorker, { returnUndefinedOnEmpty: true, priority: 'salaryModel' });
        const nextManDay = Number(nextWorker.manDay ?? 0);
        const nextUnitPrice = Number(nextWorker.unitPrice ?? 0);
        if (!Number.isFinite(nextManDay) || nextManDay < 0) {
            throw new Error('Invalid manDay');
        }
        if (!Number.isFinite(nextUnitPrice) || nextUnitPrice < 0) {
            throw new Error('Invalid unitPrice');
        }

        updatedWorkers[index] = {
            ...nextWorker,
            manDay: nextManDay,
            unitPrice: nextUnitPrice,
        };
        const totalManDay = updatedWorkers.reduce((sum, worker) => sum + (worker.manDay || 0), 0);
        const totalAmount = updatedWorkers.reduce((sum, worker) => sum + ((worker.manDay || 0) * (worker.unitPrice || 0)), 0);

        await updateReportFromExistingData(reportId, report, {
            ...reportUpdates,
            workers: updatedWorkers,
            totalManDay,
            totalAmount,
        });
    },

    removeWorkerFromReport: async (reportId: string, workerId: string, workerIndex?: number): Promise<void> => {
        const report = await dailyReportService.getReport(reportId);
        if (!report) throw new Error('Report not found');

                // undefined 필드를 null로 치환하되 타입 보존
        const cleanWorker = (worker: any): DailyReportWorker => {
            const cleaned: any = { ...worker };
            Object.keys(cleaned).forEach((k) => {
                if (cleaned[k] === undefined) cleaned[k] = null;
            });
            return cleaned as DailyReportWorker;
        };

        let removed = false;
        const updatedWorkers = report.workers
            .filter((worker, index) => {
                const isTarget = typeof workerIndex === 'number'
                    ? index === workerIndex && worker.workerId === workerId
                    : !removed && worker.workerId === workerId;
                if (isTarget) {
                    removed = true;
                    return false;
                }
                return true;
            })
            .map(cleanWorker);
        if (!removed) {
            throw new Error('Worker not found in report');
        }
        if (updatedWorkers.length === 0) {
            await dailyReportService.deleteReport(reportId);
            return;
        }

        const totalManDay = updatedWorkers.reduce((sum, worker) => sum + ((worker.manDay || 0) as number), 0);
        const totalAmount = updatedWorkers.reduce((sum, worker) => sum + (((worker.manDay || 0) as number) * ((worker.unitPrice || 0) as number)), 0);

        await updateReportFromExistingData(reportId, report, {
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
        const siteSnapshot = await createSiteSnapshotResolver()({
            siteId: params.siteId,
            siteName: params.siteName,
        });
        const nextWorkers = params.workers.map(worker => syncPayTypeFields({
            ...worker,
            siteType: siteSnapshot.siteType,
            paymentType: siteSnapshot.paymentType,
        } as DailyReportWorker, { returnUndefinedOnEmpty: true, priority: 'salaryModel' }));

        const reports = await dailyReportService.getReports({
            startDate: params.date,
            endDate: params.date,
            teamId: params.teamId,
            siteId: params.siteId,
        });
        const report = reports[0];

        if (!report?.id) {
            await dailyReportService.addReport({
                date: params.date,
                teamId: params.teamId,
                teamName: params.teamName,
                siteId: params.siteId,
                siteName: params.siteName,
                siteType: siteSnapshot.siteType,
                paymentType: siteSnapshot.paymentType,
                workers: nextWorkers,
                totalManDay: nextWorkers.reduce((sum, worker) => sum + (worker.manDay || 0), 0),
                totalAmount: nextWorkers.reduce((sum, worker) => sum + ((worker.manDay || 0) * (worker.unitPrice || 0)), 0),
            });
            return;
        }

        const mergedWorkers = [...report.workers];
        nextWorkers.forEach(newWorker => {
            const index = mergedWorkers.findIndex(worker => worker.workerId === newWorker.workerId);
            if (index >= 0) {
                mergedWorkers[index] = syncPayTypeFields({
                    ...mergedWorkers[index],
                    ...newWorker,
                } as DailyReportWorker, { returnUndefinedOnEmpty: true, priority: 'salaryModel' });
            } else {
                mergedWorkers.push(newWorker);
            }
        });

        await dailyReportService.updateReport(report.id, {
            teamName: params.teamName,
            siteName: params.siteName,
            siteType: siteSnapshot.siteType,
            paymentType: siteSnapshot.paymentType,
            workers: mergedWorkers,
            totalManDay: mergedWorkers.reduce((sum, worker) => sum + (worker.manDay || 0), 0),
            totalAmount: mergedWorkers.reduce((sum, worker) => sum + ((worker.manDay || 0) * (worker.unitPrice || 0)), 0),
        });
    },
};


