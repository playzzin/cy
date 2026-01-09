import app, { db } from '../config/firebase';
import { toast } from '../utils/swal';
import { getDataConnect } from 'firebase/data-connect';
import {
    connectorConfig,
    listDailyReports,
    listDailyReportWorkers,
    listTeams,
    listSites,
    listWorkers,
    createDailyReport,
    updateDailyReport,
    deleteDailyReport,
    createDailyReportWorker,
    updateDailyReportWorker,
    deleteDailyReportWorker,
    createWorker
} from '../dataconnect-generated';
import { useDataConnectDailyReports, useDataConnectDailyReportsWrite, useDataConnectDailyReportsWriteVerify } from '../config/featureFlags';
import {
    collection,
    addDoc,
    updateDoc,
    doc,
    getDocs,
    getDocsFromServer,
    query,
    where,
    orderBy,
    serverTimestamp,
    Timestamp,
    writeBatch,
    limit,
    getCountFromServer
} from 'firebase/firestore';

let dcInstance: any | null = null;
let dcInitError: unknown | null = null;

const getDc = (): any => {
    if (dcInstance) return dcInstance;
    if (dcInitError) throw dcInitError;
    try {
        dcInstance = getDataConnect(app, connectorConfig);
        return dcInstance;
    } catch (error) {
        dcInitError = error;
        console.warn('[DataConnect] getDataConnect init failed; Data Connect features will be disabled', { error });
        throw error;
    }
};

const sanitizeFirestoreData = (data: any): any => {
    if (Array.isArray(data)) {
        return data.map(item => sanitizeFirestoreData(item));
    }

    if (data instanceof Date) return data;
    if (data instanceof Timestamp) return data;

    const isPlainObject = data !== null
        && typeof data === 'object'
        && Object.getPrototypeOf(data) === Object.prototype;

    if (isPlainObject) {
        const newObj: any = {};
        Object.keys(data).forEach(key => {
            const value = data[key];
            if (value !== undefined) {
                newObj[key] = sanitizeFirestoreData(value);
            } else {
                newObj[key] = null;
            }
        });
        return newObj;
    }

    return data;
};

const dcLegacyMaps = {
    teams: new Map<string, string>(),
    sites: new Map<string, string>(),
    workers: new Map<string, string>(),
    dailyReports: new Map<string, string>(),
    loaded: {
        teams: false,
        sites: false,
        workers: false,
        dailyReports: false
    },
    loading: {
        teams: null as Promise<void> | null,
        sites: null as Promise<void> | null,
        workers: null as Promise<void> | null,
        dailyReports: null as Promise<void> | null
    }
};

const loadDcTeams = async (): Promise<void> => {
    if (dcLegacyMaps.loaded.teams) return;
    if (dcLegacyMaps.loading.teams) return dcLegacyMaps.loading.teams;
    dcLegacyMaps.loading.teams = (async () => {
        const res = await listTeams(getDc());
        const teams = (res as any)?.data?.teams ?? [];
        dcLegacyMaps.teams.clear();
        teams.forEach((t: any) => {
            const legacyId = t?.legacyId;
            if (!legacyId) return;
            dcLegacyMaps.teams.set(String(legacyId), String(t.id));
        });
        dcLegacyMaps.loaded.teams = true;
        dcLegacyMaps.loading.teams = null;
    })();
    return dcLegacyMaps.loading.teams;
};

const loadDcSites = async (): Promise<void> => {
    if (dcLegacyMaps.loaded.sites) return;
    if (dcLegacyMaps.loading.sites) return dcLegacyMaps.loading.sites;
    dcLegacyMaps.loading.sites = (async () => {
        const res = await listSites(getDc());
        const sites = (res as any)?.data?.sites ?? [];
        dcLegacyMaps.sites.clear();
        sites.forEach((s: any) => {
            const legacyId = s?.legacyId;
            if (!legacyId) return;
            dcLegacyMaps.sites.set(String(legacyId), String(s.id));
        });
        dcLegacyMaps.loaded.sites = true;
        dcLegacyMaps.loading.sites = null;
    })();
    return dcLegacyMaps.loading.sites;
};

const loadDcWorkers = async (): Promise<void> => {
    if (dcLegacyMaps.loaded.workers) return;
    if (dcLegacyMaps.loading.workers) return dcLegacyMaps.loading.workers;
    dcLegacyMaps.loading.workers = (async () => {
        const res = await listWorkers(getDc());
        const workers = (res as any)?.data?.workers ?? [];
        dcLegacyMaps.workers.clear();
        workers.forEach((w: any) => {
            const legacyId = w?.legacyId;
            if (!legacyId) return;
            dcLegacyMaps.workers.set(String(legacyId), String(w.id));
        });
        dcLegacyMaps.loaded.workers = true;
        dcLegacyMaps.loading.workers = null;
    })();
    return dcLegacyMaps.loading.workers;
};

const loadDcDailyReports = async (): Promise<void> => {
    if (dcLegacyMaps.loaded.dailyReports) return;
    if (dcLegacyMaps.loading.dailyReports) return dcLegacyMaps.loading.dailyReports;
    dcLegacyMaps.loading.dailyReports = (async () => {
        const res = await listDailyReports(getDc());
        const reports = (res as any)?.data?.dailyReports ?? [];
        dcLegacyMaps.dailyReports.clear();
        reports.forEach((r: any) => {
            const legacyId = r?.legacyId;
            if (!legacyId) return;
            dcLegacyMaps.dailyReports.set(String(legacyId), String(r.id));
        });
        dcLegacyMaps.loaded.dailyReports = true;
        dcLegacyMaps.loading.dailyReports = null;
    })();
    return dcLegacyMaps.loading.dailyReports;
};

const getDcTeamIdByLegacyId = async (legacyTeamId?: string | null): Promise<string | null> => {
    if (!legacyTeamId) return null;
    await loadDcTeams();
    return dcLegacyMaps.teams.get(String(legacyTeamId)) ?? null;
};

const getDcSiteIdByLegacyId = async (legacySiteId?: string | null): Promise<string | null> => {
    if (!legacySiteId) return null;
    await loadDcSites();
    return dcLegacyMaps.sites.get(String(legacySiteId)) ?? null;
};

const getDcDailyReportIdByLegacyId = async (legacyReportId?: string | null): Promise<string | null> => {
    if (!legacyReportId) return null;
    await loadDcDailyReports();
    return dcLegacyMaps.dailyReports.get(String(legacyReportId)) ?? null;
};

const ensureDcWorkerIdByLegacyId = async (params: {
    legacyWorkerId?: string | null;
    name?: string | null;
    legacyTeamId?: string | null;
    role?: string | null;
    payType?: string | null;
    unitPrice?: number | null;
}): Promise<string | null> => {
    const legacyWorkerId = params.legacyWorkerId ? String(params.legacyWorkerId) : null;
    if (!legacyWorkerId) return null;
    await loadDcWorkers();
    const existing = dcLegacyMaps.workers.get(legacyWorkerId);
    if (existing) return existing;

    const teamId = await getDcTeamIdByLegacyId(params.legacyTeamId ?? null);
    if (!params.name) return null;

    try {
        const res = await createWorker(getDc(), {
            name: params.name,
            legacyId: legacyWorkerId,
            teamId: teamId ?? null,
            role: params.role ?? null,
            payType: params.payType ?? null,
            unitPrice: typeof params.unitPrice === 'number' ? params.unitPrice : null,
            phone: null,
            residentNumber: null,
            address: null,
            bankAccount: null,
            bankName: null,
            isActive: true,
            joinDate: null
        });

        const workerId = (res as any)?.data?.worker_insert?.id ?? null;
        if (workerId) {
            dcLegacyMaps.workers.set(legacyWorkerId, String(workerId));
            return String(workerId);
        }
    } catch (e) {
        try {
            dcLegacyMaps.loaded.workers = false;
            await loadDcWorkers();
            const refreshed = dcLegacyMaps.workers.get(legacyWorkerId);
            if (refreshed) return refreshed;
        } catch {
            // ignore
        }
        console.warn('[DataConnect] Failed to create placeholder worker for shadow write', { legacyWorkerId, error: e });
    }

    return null;
};

const upsertDailyReportInDataConnect = async (legacyReportId: string, report: DailyReport): Promise<string | null> => {
    const teamId = await getDcTeamIdByLegacyId(report.teamId);
    if (!teamId) {
        console.warn('[DataConnect] Missing Team mapping for daily report shadow write', { legacyReportId, legacyTeamId: report.teamId });
        return null;
    }

    const siteId = await getDcSiteIdByLegacyId(report.siteId);
    const existingId = await getDcDailyReportIdByLegacyId(legacyReportId);

    const vars: any = {
        date: report.date,
        teamId,
        siteId: siteId ?? null,
        siteName: report.siteName || null,
        status: (report as any)?.status ?? null,
        totalManDay: typeof report.totalManDay === 'number' ? report.totalManDay : null,
        totalAmount: typeof report.totalAmount === 'number' ? report.totalAmount : null,
        weather: report.weather ?? null,
        writerUid: report.writerId ?? null,
        companyName: report.companyName ?? null,
        responsibleTeamName: report.responsibleTeamName ?? null,
        responsibleTeamLegacyId: report.responsibleTeamId ?? null,
        workContent: report.workContent ?? null
    };

    if (existingId) {
        try {
            await updateDailyReport(getDc(), { id: existingId, ...vars });
        } catch (error) {
            console.warn('[DataConnect] Failed to update daily report during shadow write', { legacyReportId, existingId, vars, error });
            throw error;
        }
        return existingId;
    }

    let created: unknown;
    try {
        created = await createDailyReport(getDc(), { legacyId: legacyReportId, ...vars });
    } catch (error) {
        console.warn('[DataConnect] Failed to create daily report during shadow write', { legacyReportId, vars, error });
        throw error;
    }
    const newId = (created as any)?.data?.dailyReport_insert?.id ?? null;
    if (newId) {
        dcLegacyMaps.dailyReports.set(String(legacyReportId), String(newId));
        return String(newId);
    }

    dcLegacyMaps.loaded.dailyReports = false;
    return await getDcDailyReportIdByLegacyId(legacyReportId);
};

const syncDailyReportWorkersInDataConnect = async (params: {
    legacyReportId: string;
    dailyReportId: string;
    report: DailyReport;
}): Promise<void> => {
    const res = await listDailyReportWorkers(getDc());
    const all = (res as any)?.data?.dailyReportWorkers ?? [];
    const existing = all.filter((rw: any) => String(rw?.dailyReport?.legacyId ?? '') === String(params.legacyReportId));

    const existingByWorkerDcId = new Map<string, any>();
    existing.forEach((rw: any) => {
        const workerDcId = rw?.worker?.id;
        if (!workerDcId) return;
        existingByWorkerDcId.set(String(workerDcId), rw);
    });

    const unknownKeyCounts = new Map<string, number>();

    for (const w of params.report.workers ?? []) {
        const rawLegacyWorkerId = w.workerId ? String(w.workerId) : '';
        const hasRealLegacyWorkerId = rawLegacyWorkerId && !rawLegacyWorkerId.startsWith('unknown');
        const resolvedLegacyTeamId = w.teamId ?? params.report.teamId;
        const normalizedName = typeof w.name === 'string'
            ? w.name.trim().replace(/\s+/g, ' ')
            : '';
        const normalizedRole = typeof w.role === 'string'
            ? w.role.trim().replace(/\s+/g, ' ')
            : '';

        let derivedLegacyWorkerId: string | null = null;
        if (!hasRealLegacyWorkerId && normalizedName) {
            const teamKey = resolvedLegacyTeamId ? String(resolvedLegacyTeamId) : '';
            const base = teamKey
                ? `unknown:${teamKey}:${normalizedName}:${normalizedRole}`
                : `unknown:${params.legacyReportId}:${normalizedName}:${normalizedRole}`;
            const nextCount = (unknownKeyCounts.get(base) ?? 0) + 1;
            unknownKeyCounts.set(base, nextCount);
            derivedLegacyWorkerId = nextCount > 1 ? `${base}:${nextCount}` : base;
        }
        const legacyWorkerIdForDc = hasRealLegacyWorkerId
            ? rawLegacyWorkerId
            : (derivedLegacyWorkerId ?? null);

        const workerDcId = await ensureDcWorkerIdByLegacyId({
            legacyWorkerId: legacyWorkerIdForDc,
            name: w.name,
            legacyTeamId: resolvedLegacyTeamId,
            role: w.role,
            payType: w.payType ?? null,
            unitPrice: typeof w.unitPrice === 'number' ? w.unitPrice : null
        });
        if (!workerDcId) continue;

        const manDay = typeof w.manDay === 'number' ? w.manDay : 0;
        const unitPrice = typeof w.unitPrice === 'number' ? w.unitPrice : 0;
        const amount = manDay * unitPrice;

        const updateVars: any = {
            dailyReportId: params.dailyReportId,
            workerId: workerDcId,
            gongsu: manDay,
            unitPrice,
            amount,
            workDescription: null,
            legacyWorkerId: legacyWorkerIdForDc,
            legacyTeamId: resolvedLegacyTeamId ? String(resolvedLegacyTeamId) : null,
            workerName: w.name ?? null,
            role: w.role ?? null,
            status: w.status ?? null,
            manDay,
            payType: w.payType ?? null,
            salaryModel: w.salaryModel ?? null,
            workContent: w.workContent ?? null
        };

        if (existingByWorkerDcId.has(String(workerDcId))) {
            await updateDailyReportWorker(getDc(), updateVars);
            existingByWorkerDcId.delete(String(workerDcId));
            continue;
        }

        try {
            await createDailyReportWorker(getDc(), updateVars);
        } catch (createError) {
            try {
                await updateDailyReportWorker(getDc(), updateVars);
            } catch (updateError) {
                console.warn('[DataConnect] Failed to upsert daily report worker during shadow write', {
                    legacyReportId: params.legacyReportId,
                    dailyReportId: params.dailyReportId,
                    legacyWorkerId: legacyWorkerIdForDc,
                    workerDcId,
                    createError,
                    updateError
                });
            }
        }
    }

    for (const workerDcId of existingByWorkerDcId.keys()) {
        await deleteDailyReportWorker(getDc(), {
            dailyReportId: params.dailyReportId,
            workerId: workerDcId
        });
    }
};

const shadowSyncDailyReportToDataConnect = async (legacyReportId: string): Promise<void> => {
    const snap = await getDocs(query(collection(db, COLLECTION_NAME), where('__name__', '==', legacyReportId)));
    if (snap.empty) {
        const dcId = await getDcDailyReportIdByLegacyId(legacyReportId);
        if (!dcId) return;

        const workersRes = await listDailyReportWorkers(getDc());
        const all = (workersRes as any)?.data?.dailyReportWorkers ?? [];
        const reportWorkers = all.filter((rw: any) => String(rw?.dailyReport?.legacyId ?? '') === String(legacyReportId));

        for (const rw of reportWorkers) {
            const workerDcId = rw?.worker?.id;
            if (!workerDcId) continue;
            await deleteDailyReportWorker(getDc(), { dailyReportId: dcId, workerId: String(workerDcId) });
        }

        await deleteDailyReport(getDc(), { id: dcId });
        dcLegacyMaps.dailyReports.delete(String(legacyReportId));
        return;
    }

    const report = snap.docs[0].data() as DailyReport;
    const dcId = await upsertDailyReportInDataConnect(legacyReportId, report);
    if (!dcId) return;

    await syncDailyReportWorkersInDataConnect({ legacyReportId, dailyReportId: dcId, report });

    if (useDataConnectDailyReportsWriteVerify) {
        try {
            const res = await listDailyReports(getDc());
            const all = (res as any)?.data?.dailyReports ?? [];
            const found = all.some((r: any) => String(r?.legacyId ?? '') === String(legacyReportId));
            if (!found) {
                console.warn('[DataConnect] Daily report shadow write verification failed (missing in Data Connect)', {
                    legacyReportId,
                    dailyReportId: dcId
                });
                toast.warning('Data Connect 저장 확인 실패 (일보)');
            }

            const workersRes = await listDailyReportWorkers(getDc());
            const allWorkers = (workersRes as any)?.data?.dailyReportWorkers ?? [];
            const dcWorkersForReport = allWorkers.filter((rw: any) => String(rw?.dailyReport?.legacyId ?? '') === String(legacyReportId));
            const expectedWorkers = Array.isArray(report?.workers) ? report.workers.length : 0;
            if (expectedWorkers > 0 && dcWorkersForReport.length === 0) {
                console.warn('[DataConnect] Daily report workers shadow write verification failed (no workers found in Data Connect)', {
                    legacyReportId,
                    dailyReportId: dcId,
                    expectedWorkers
                });
                toast.warning('Data Connect 저장 확인 실패 (일보 작업자)');
            } else if (expectedWorkers > 0 && dcWorkersForReport.length !== expectedWorkers) {
                console.warn('[DataConnect] Daily report workers shadow write verification mismatch', {
                    legacyReportId,
                    dailyReportId: dcId,
                    expectedWorkers,
                    actualWorkers: dcWorkersForReport.length
                });
            } else if (found) {
                console.info('[DataConnect] Daily report shadow write verified', {
                    legacyReportId,
                    dailyReportId: dcId,
                    expectedWorkers,
                    actualWorkers: dcWorkersForReport.length
                });
            }
        } catch (error) {
            console.warn('[DataConnect] Daily report shadow write verification failed (ignored)', { legacyReportId, error });
        }
    }
};

const maybeShadowSyncDailyReport = (legacyReportId: string): void => {
    if (!useDataConnectDailyReportsWrite) return;
    shadowSyncDailyReportToDataConnect(legacyReportId).catch(error => {
        const e = error as any;
        console.warn('[DataConnect] Daily report shadow write failed', {
            legacyReportId,
            message: typeof e?.message === 'string' ? e.message : undefined,
            code: typeof e?.code === 'string' ? e.code : undefined,
            error
        });
    });
};

const toTimestamp = (dateStr?: string | null): Timestamp | undefined => {
    if (!dateStr) return undefined;
    try {
        return Timestamp.fromDate(new Date(dateStr));
    } catch {
        return undefined;
    }
};

const mapDailyReportsFromDataConnect = async (params: {
    startDate?: string;
    endDate?: string;
    teamId?: string;
    siteId?: string;
}): Promise<DailyReport[]> => {
    const reportsRes = await listDailyReports(getDc());
    const reportWorkersRes = await listDailyReportWorkers(getDc());

    const reports = (reportsRes as any)?.data?.dailyReports ?? [];
    const reportWorkers = (reportWorkersRes as any)?.data?.dailyReportWorkers ?? [];

    const workersByLegacyReportId = new Map<string, DailyReportWorker[]>();
    reportWorkers.forEach((rw: any) => {
        const legacyReportId = rw?.dailyReport?.legacyId ?? null;
        if (!legacyReportId) return;

        const legacyWorkerId = rw?.legacyWorkerId ? String(rw.legacyWorkerId) : null;
        const workerId = legacyWorkerId
            ? legacyWorkerId
            : (rw?.worker?.legacyId ?? rw?.worker?.id ?? '');

        const worker: DailyReportWorker = {
            workerId: String(workerId),
            name: (rw?.workerName ?? rw?.worker?.name ?? '') as string,
            role: (rw?.role ?? '') as string,
            status: (rw?.status ?? 'attendance') as any,
            manDay: typeof rw?.manDay === 'number' ? rw.manDay : (typeof rw?.gongsu === 'number' ? rw.gongsu : 0),
            workContent: (rw?.workContent ?? '') as string,
            teamId: rw?.legacyTeamId ? String(rw.legacyTeamId) : undefined,
            unitPrice: typeof rw?.unitPrice === 'number' ? rw.unitPrice : undefined,
            payType: rw?.payType ?? undefined,
            salaryModel: rw?.salaryModel ?? undefined
        };

        const list = workersByLegacyReportId.get(String(legacyReportId)) ?? [];
        list.push(worker);
        workersByLegacyReportId.set(String(legacyReportId), list);
    });

    let mapped: DailyReport[] = reports.map((r: any) => {
        const legacyId = r?.legacyId ?? undefined;
        const legacyTeamId = r?.team?.legacyId ?? '';
        const legacySiteId = r?.site?.legacyId ?? '';
        const workers = legacyId ? (workersByLegacyReportId.get(String(legacyId)) ?? []) : [];

        const result: DailyReport = {
            id: legacyId ?? (r?.id ?? undefined),
            date: r?.date,
            teamId: legacyTeamId,
            teamName: r?.team?.name ?? '',
            siteId: legacySiteId,
            siteName: r?.site?.name ?? (r?.siteName ?? ''),
            responsibleTeamId: r?.responsibleTeamLegacyId ?? undefined,
            responsibleTeamName: r?.responsibleTeamName ?? undefined,
            companyId: '',
            companyName: r?.companyName ?? undefined,
            constructorCompanyId: '',
            constructorCompanyName: '',
            partnerId: '',
            partnerName: '',
            writerId: r?.writerUid ?? '',
            workers,
            totalManDay: typeof r?.totalManDay === 'number' ? r.totalManDay : 0,
            totalAmount: typeof r?.totalAmount === 'number' ? r.totalAmount : undefined,
            createdAt: toTimestamp(r?.createdAt),
            updatedAt: toTimestamp(r?.updatedAt),
            weather: r?.weather ?? undefined,
            workContent: r?.workContent ?? undefined
        };
        return result;
    });

    if (params.startDate) {
        mapped = mapped.filter(r => r.date >= params.startDate!);
    }
    if (params.endDate) {
        mapped = mapped.filter(r => r.date <= params.endDate!);
    }
    if (params.teamId) {
        mapped = mapped.filter(r => r.teamId === params.teamId);
    }
    if (params.siteId) {
        mapped = mapped.filter(r => r.siteId === params.siteId);
    }

    mapped.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '', 'en'));
    return mapped;
};

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
    companyId?: string; // 발주사 (Client)
    companyName?: string;
    constructorCompanyId?: string; // 시공사 (Constructor)
    constructorCompanyName?: string;
    partnerId?: string; // 협력사 (Partner)
    partnerName?: string;
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
            const sanitizedReport = sanitizeFirestoreData(report);
            const docRef = await addDoc(collection(db, COLLECTION_NAME), {
                ...sanitizedReport,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            // Update cumulative man-days for each worker
            const { manpowerService } = await import('./manpowerService');
            const { teamService } = await import('./teamService');
            const { siteService } = await import('./siteService');
            const { companyService } = await import('./companyService');

            const updatePromises = report.workers.map(worker => {
                if (!worker?.workerId) return Promise.resolve();
                if (String(worker.workerId).startsWith('unknown')) return Promise.resolve();
                if (worker.manDay > 0) {
                    return manpowerService.incrementManDay(worker.workerId, worker.manDay);
                }
                return Promise.resolve();
            });

            // Update cumulative man-days for team
            if (report.totalManDay > 0 && report.teamId) {
                updatePromises.push(teamService.incrementManDay(report.teamId, report.totalManDay));
                updatePromises.push(companyService.incrementManDayByTeam(report.teamId, report.totalManDay));
            }

            // Update cumulative man-days for site
            if (report.totalManDay > 0 && report.siteId) {
                updatePromises.push(siteService.incrementManDay(report.siteId, report.totalManDay));
            }

            try {
                await Promise.all(updatePromises);
            } catch (error) {
                console.warn('[DailyReport] addReport stats update failed (ignored)', { error });
            }

            toast.saved('일보', 1);
            maybeShadowSyncDailyReport(docRef.id);
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
            if (oldReport.totalManDay > 0 && oldReport.teamId) {
                decrementPromises.push(teamService.incrementManDay(oldReport.teamId, -oldReport.totalManDay));
                decrementPromises.push(companyService.incrementManDayByTeam(oldReport.teamId, -oldReport.totalManDay));
            }
            if (oldReport.totalManDay > 0 && oldReport.siteId) {
                decrementPromises.push(siteService.incrementManDay(oldReport.siteId, -oldReport.totalManDay));
            }
            oldReport.workers.forEach(w => {
                if (!w?.workerId) return;
                if (String(w.workerId).startsWith('unknown')) return;
                if (w.manDay > 0) decrementPromises.push(manpowerService.incrementManDay(w.workerId, -w.manDay));
            });
            try {
                await Promise.all(decrementPromises);
            } catch (error) {
                console.warn('[DailyReport] updateReport decrement stats failed (ignored)', { error });
            }

            // 3. Update Document
            const sanitizedUpdates = sanitizeFirestoreData(updates);
            await updateDoc(reportRef, {
                ...sanitizedUpdates,
                updatedAt: serverTimestamp()
            });

            // 4. Increment New
            const incrementPromises: Promise<void>[] = [];
            if (updates.totalManDay && updates.totalManDay > 0) {
                // Warning: updates.teamId might be missing if not updated, assuming teamId doesn't change usually
                // Safe fallback: use oldReport.teamId unless mapped
                const teamId = updates.teamId || oldReport.teamId;
                const siteId = updates.siteId || oldReport.siteId;

                if (teamId) {
                    incrementPromises.push(teamService.incrementManDay(teamId, updates.totalManDay));
                    incrementPromises.push(companyService.incrementManDayByTeam(teamId, updates.totalManDay));
                }
                if (siteId) {
                    incrementPromises.push(siteService.incrementManDay(siteId, updates.totalManDay));
                }
            }
            if (updates.workers) {
                updates.workers.forEach(w => {
                    if (!w?.workerId) return;
                    if (String(w.workerId).startsWith('unknown')) return;
                    if (w.manDay > 0) incrementPromises.push(manpowerService.incrementManDay(w.workerId, w.manDay));
                });
            }
            try {
                await Promise.all(incrementPromises);
            } catch (error) {
                console.warn('[DailyReport] updateReport increment stats failed (ignored)', { error });
            }

            toast.updated('일보');
            maybeShadowSyncDailyReport(id);
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

            const createdIds: string[] = [];

            // 1. Create Report Documents
            reports.forEach(report => {
                const docRef = doc(collection(db, COLLECTION_NAME));
                createdIds.push(docRef.id);
                const sanitizedReport = sanitizeFirestoreData(report);
                batch.set(docRef, {
                    ...sanitizedReport,
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
                    if (!worker?.workerId) return;
                    if (String(worker.workerId).startsWith('unknown')) return;
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
                if (!id) return;
                if (String(id).startsWith('unknown')) return;
                updatePromises.push(manpowerService.incrementManDay(id, amount));
            });
            teamUpdates.forEach((amount, id) => {
                if (!id) return;
                updatePromises.push(teamService.incrementManDay(id, amount));
                updatePromises.push(companyService.incrementManDayByTeam(id, amount));
            });
            siteUpdates.forEach((amount, id) => {
                if (!id) return;
                updatePromises.push(siteService.incrementManDay(id, amount));
            });

            try {
                await Promise.all(updatePromises);
            } catch (error) {
                console.warn('[DailyReport] addReportsBatch stats update failed (ignored)', { error });
            }

            if (useDataConnectDailyReportsWrite) {
                createdIds.forEach(id => maybeShadowSyncDailyReport(id));
            }

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

            const deletedIds: string[] = [];
            const createdIds: string[] = [];

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
                deletedIds.push(d.id);
                batch.delete(d.ref);
            });

            // 3. Create New Report Documents
            // Helper to remove undefined values (Firestore rejects them)
            const sanitizeData = sanitizeFirestoreData;

            reports.forEach(report => {
                const docRef = doc(collection(db, COLLECTION_NAME)); // Auto ID
                createdIds.push(docRef.id);
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
                    if (!w?.workerId) return;
                    if (String(w.workerId).startsWith('unknown')) return;
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
                    if (!worker?.workerId) return;
                    if (String(worker.workerId).startsWith('unknown')) return;
                    if (worker.manDay > 0) {
                        workerUpdates.set(worker.workerId, (workerUpdates.get(worker.workerId) || 0) + worker.manDay);
                    }
                });
            });

            await batch.commit();
            toast.saved('일보 (덮어쓰기)', reports.length);

            try {
                const serverSnapshot = await getDocsFromServer(query(collection(db, COLLECTION_NAME), where('date', '==', date)));
                const serverIds = new Set(serverSnapshot.docs.map(d => d.id));
                const missingIds = createdIds.filter(id => !serverIds.has(id));
                if (missingIds.length > 0) {
                    console.warn('[DailyReport] overwriteReports server verification failed: missing created docs on server', {
                        projectId: (app as any)?.options?.projectId,
                        date,
                        missingCount: missingIds.length,
                        missingIds: missingIds.slice(0, 20)
                    });
                    toast.warning('서버 저장 확인에 실패했습니다. (오프라인/프로젝트 확인 필요)');
                }
            } catch (error) {
                console.warn('[DailyReport] overwriteReports server verification failed (ignored)', {
                    projectId: (app as any)?.options?.projectId,
                    date,
                    error
                });
            }

            // 5. Apply Stats Updates
            const updatePromises: Promise<void>[] = [];

            workerUpdates.forEach((amount, id) => {
                if (!id) return;
                if (String(id).startsWith('unknown')) return;
                if (amount !== 0) updatePromises.push(manpowerService.incrementManDay(id, amount));
            });
            teamUpdates.forEach((amount, id) => {
                if (!id) return;
                if (amount !== 0) {
                    updatePromises.push(teamService.incrementManDay(id, amount));
                    updatePromises.push(companyService.incrementManDayByTeam(id, amount));
                }
            });
            siteUpdates.forEach((amount, id) => {
                if (!id) return;
                if (amount !== 0) updatePromises.push(siteService.incrementManDay(id, amount));
            });

            try {
                await Promise.all(updatePromises);
            } catch (error) {
                console.warn('[DailyReport] overwriteReports stats update failed (ignored)', { error });
            }

            if (useDataConnectDailyReportsWrite) {
                deletedIds.forEach(id => maybeShadowSyncDailyReport(id));
                createdIds.forEach(id => maybeShadowSyncDailyReport(id));
            }

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
            if (useDataConnectDailyReports) {
                try {
                    return await mapDailyReportsFromDataConnect({ startDate: date, endDate: date, teamId });
                } catch (error) {
                    console.warn('[DataConnect] getReports failed; falling back to Firestore', { error });
                }
            }
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
            if (useDataConnectDailyReports) {
                try {
                    return await mapDailyReportsFromDataConnect({ startDate, endDate, teamId, siteId });
                } catch (error) {
                    console.warn('[DataConnect] getReportsByRange failed; falling back to Firestore', { error });
                }
            }
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
            if (useDataConnectDailyReports) {
                try {
                    const reports = await mapDailyReportsFromDataConnect({ startDate: date, endDate: date, teamId, siteId });
                    return reports.length > 0;
                } catch (error) {
                    console.warn('[DataConnect] checkReportExists failed; falling back to Firestore', { error });
                }
            }
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
                if (workerId && !String(workerId).startsWith('unknown')) {
                    updatePromises.push(manpowerService.incrementManDay(workerId, -workerToRemove.manDay));
                }
                if (reportData.teamId) {
                    updatePromises.push(teamService.incrementManDay(reportData.teamId, -workerToRemove.manDay));
                    updatePromises.push(companyService.incrementManDayByTeam(reportData.teamId, -workerToRemove.manDay));
                }
                if (reportData.siteId) {
                    updatePromises.push(siteService.incrementManDay(reportData.siteId, -workerToRemove.manDay));
                }
            }

            try {
                await Promise.all(updatePromises);
            } catch (error) {
                console.warn('[DailyReport] removeWorkerFromReport stats update failed (ignored)', { error });
            }

            // 2. Remove worker from array
            const updatedWorkers = reportData.workers.filter(w => w.workerId !== workerId);
            const updatedTotalManDay = updatedWorkers.reduce((sum, w) => sum + w.manDay, 0);

            // 3. Update report
            await updateDoc(reportRef, {
                workers: sanitizeFirestoreData(updatedWorkers),
                totalManDay: updatedTotalManDay,
                updatedAt: serverTimestamp()
            });

            maybeShadowSyncDailyReport(reportId);

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

                const promises: Promise<void>[] = [];
                if (workerId && !String(workerId).startsWith('unknown')) {
                    promises.push(manpowerService.incrementManDay(workerId, manDayDiff));
                }
                if (reportData.teamId) {
                    promises.push(teamService.incrementManDay(reportData.teamId, manDayDiff));
                    promises.push(companyService.incrementManDayByTeam(reportData.teamId, manDayDiff));
                }
                if (reportData.siteId) {
                    promises.push(siteService.incrementManDay(reportData.siteId, manDayDiff));
                }

                try {
                    await Promise.all(promises);
                } catch (error) {
                    console.warn('[DailyReport] updateWorkerInReport stats update failed (ignored)', { error });
                }
            }

            // 2. Update worker in array
            const updatedWorkers = [...reportData.workers];
            updatedWorkers[workerIndex] = { ...originalWorker, ...updates };
            const updatedTotalManDay = updatedWorkers.reduce((sum, w) => sum + w.manDay, 0);

            // 3. Update report
            await updateDoc(reportRef, {
                workers: sanitizeFirestoreData(updatedWorkers),
                totalManDay: updatedTotalManDay,
                updatedAt: serverTimestamp()
            });

            maybeShadowSyncDailyReport(reportId);

        } catch (error) {
            console.error("Error updating worker in report:", error);
            throw error;
        }
    },

    // Get Reports by Site (for History)
    getReportsBySite: async (siteId: string): Promise<DailyReport[]> => {
        try {
            if (useDataConnectDailyReports) {
                try {
                    return await mapDailyReportsFromDataConnect({ siteId });
                } catch (error) {
                    console.warn('[DataConnect] getReportsBySite failed; falling back to Firestore', { error });
                }
            }
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
    addWorkerToReport: async (date: string, teamId: string, teamName: string, siteId: string, siteName: string, worker: DailyReportWorker, siteData?: { constructorCompanyId?: string; constructorCompanyName?: string; partnerId?: string; partnerName?: string; companyId?: string; companyName?: string }): Promise<void> => {
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
                        workers: sanitizeFirestoreData(updatedWorkers),
                        totalManDay: updatedTotalManDay,
                        updatedAt: serverTimestamp()
                    });
                    toast.updated('일보');

                    maybeShadowSyncDailyReport(reportDoc.id);

                    // Update stats
                    const { manpowerService } = await import('./manpowerService');
                    const { teamService } = await import('./teamService');
                    const { siteService } = await import('./siteService');
                    const { companyService } = await import('./companyService');

                    const promises: Promise<void>[] = [];
                    if (worker.workerId && !String(worker.workerId).startsWith('unknown')) {
                        promises.push(manpowerService.incrementManDay(worker.workerId, worker.manDay));
                    }
                    if (teamId) {
                        promises.push(teamService.incrementManDay(teamId, worker.manDay));
                        promises.push(companyService.incrementManDayByTeam(teamId, worker.manDay));
                    }
                    if (siteId) {
                        promises.push(siteService.incrementManDay(siteId, worker.manDay));
                    }

                    try {
                        await Promise.all(promises);
                    } catch (error) {
                        console.warn('[DailyReport] addWorkerToReport stats update failed (ignored)', { error });
                    }
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
                    // New Fields
                    companyId: siteData?.companyId || '',
                    companyName: siteData?.companyName || '',
                    constructorCompanyId: siteData?.constructorCompanyId || '',
                    constructorCompanyName: siteData?.constructorCompanyName || '',
                    partnerId: siteData?.partnerId || '',
                    partnerName: siteData?.partnerName || '',

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
                const createdRef = await addDoc(collection(db, COLLECTION_NAME), {
                    ...sanitizeFirestoreData(reportData),
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });

                maybeShadowSyncDailyReport(createdRef.id);

                // Update stats
                const { manpowerService } = await import('./manpowerService');
                const { teamService } = await import('./teamService');
                const { siteService } = await import('./siteService');
                const { companyService } = await import('./companyService');

                const promises: Promise<void>[] = [];
                if (worker.workerId && !String(worker.workerId).startsWith('unknown')) {
                    promises.push(manpowerService.incrementManDay(worker.workerId, worker.manDay));
                }
                if (teamId) {
                    promises.push(teamService.incrementManDay(teamId, worker.manDay));
                    promises.push(companyService.incrementManDayByTeam(teamId, worker.manDay));
                }
                if (siteId) {
                    promises.push(siteService.incrementManDay(siteId, worker.manDay));
                }

                try {
                    await Promise.all(promises);
                } catch (error) {
                    console.warn('[DailyReport] addWorkerToReport(create) stats update failed (ignored)', { error });
                }
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

            if (useDataConnectDailyReports) {
                try {
                    const all = await mapDailyReportsFromDataConnect({});
                    const today = all.filter(r => r.date === todayStr).length;
                    const thisMonth = all.filter(r => r.date >= startOfMonth && r.date <= endOfMonth).length;
                    return { total: all.length, today, thisMonth };
                } catch (error) {
                    console.warn('[DataConnect] getDBStats failed; falling back to Firestore', { error });
                }
            }

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
            if (useDataConnectDailyReports) {
                try {
                    return await mapDailyReportsFromDataConnect({});
                } catch (error) {
                    console.warn('[DataConnect] getAllReports failed; falling back to Firestore', { error });
                }
            }
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

            if (useDataConnectDailyReportsWrite) {
                reportIds.forEach(id => maybeShadowSyncDailyReport(id));
            }
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
    },

    /**
     * 일보의 worker.teamId를 작업자 마스터 기준으로 수정하는 마이그레이션 함수
     * @param startDate 시작일 (YYYY-MM-DD)
     * @param endDate 종료일 (YYYY-MM-DD)
     * @param workerMap 작업자 ID -> 작업자 정보 맵
     */
    async migrateWorkerTeamIds(
        startDate: string,
        endDate: string,
        workerMap: Map<string, { teamId?: string; teamName?: string }>
    ): Promise<{ updated: number; skipped: number; errors: string[] }> {
        let updated = 0;
        let skipped = 0;
        const errors: string[] = [];

        try {
            const reports = await this.getReportsByRange(startDate, endDate);
            console.log(`[Migration] Found ${reports.length} reports to check`);

            const batch = writeBatch(db);
            let batchCount = 0;
            const MAX_BATCH_SIZE = 500;

            for (const report of reports) {
                if (!report.id) continue;

                let hasChanges = false;
                const updatedWorkers = report.workers.map(worker => {
                    const masterWorker = workerMap.get(worker.workerId);

                    // 마스터에서 팀 정보 조회
                    if (masterWorker?.teamId && masterWorker.teamId !== worker.teamId) {
                        hasChanges = true;
                        return {
                            ...worker,
                            teamId: masterWorker.teamId
                        };
                    }
                    return worker;
                });

                if (hasChanges) {
                    const docRef = doc(db, COLLECTION_NAME, report.id);
                    batch.update(docRef, {
                        workers: updatedWorkers,
                        updatedAt: serverTimestamp()
                    });
                    batchCount++;
                    updated++;

                    // Commit batch if it reaches the limit
                    if (batchCount >= MAX_BATCH_SIZE) {
                        await batch.commit();
                        console.log(`[Migration] Committed batch of ${batchCount} updates`);
                        batchCount = 0;
                    }
                } else {
                    skipped++;
                }
            }

            // Commit remaining
            if (batchCount > 0) {
                await batch.commit();
                console.log(`[Migration] Committed final batch of ${batchCount} updates`);
            }

            console.log(`[Migration] Complete: ${updated} updated, ${skipped} skipped`);
            return { updated, skipped, errors };

        } catch (error) {
            console.error('[Migration] Error:', error);
            errors.push(String(error));
            return { updated, skipped, errors };
        }
    }
};
