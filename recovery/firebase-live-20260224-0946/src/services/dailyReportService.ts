import app from '../config/firebase';
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
} from './dataconnectCompat';
import { Timestamp } from '../types/timestamp';

let dcInstance: any | null = null;
let dcInitError: unknown | null = null;

const isUuidString = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

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
            const id = t?.id ? String(t.id) : '';
            if (id) dcLegacyMaps.teams.set(id, id);
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
            const id = s?.id ? String(s.id) : '';
            if (id) dcLegacyMaps.sites.set(id, id);
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
            const id = w?.id ? String(w.id) : '';
            if (id) dcLegacyMaps.workers.set(id, id);
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
            const id = r?.id ? String(r.id) : '';
            if (id) dcLegacyMaps.dailyReports.set(id, id);
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

const resolveDcTeamId = async (id?: string | null): Promise<string | null> => {
    if (!id) return null;
    const raw = String(id);
    if (isUuidString(raw)) return raw;
    return await getDcTeamIdByLegacyId(raw);
};

const getDcSiteIdByLegacyId = async (legacySiteId?: string | null): Promise<string | null> => {
    if (!legacySiteId) return null;
    await loadDcSites();
    return dcLegacyMaps.sites.get(String(legacySiteId)) ?? null;
};

const resolveDcSiteId = async (id?: string | null): Promise<string | null> => {
    if (!id) return null;
    const raw = String(id);
    if (isUuidString(raw)) return raw;
    return await getDcSiteIdByLegacyId(raw);
};

const getDcDailyReportIdByLegacyId = async (legacyReportId?: string | null): Promise<string | null> => {
    if (!legacyReportId) return null;
    await loadDcDailyReports();
    return dcLegacyMaps.dailyReports.get(String(legacyReportId)) ?? null;
};

const resolveDcDailyReportId = async (id?: string | null): Promise<string | null> => {
    if (!id) return null;
    const raw = String(id);
    if (isUuidString(raw)) return raw;
    return await getDcDailyReportIdByLegacyId(raw);
};

const buildIdCandidateSet = async (params: {
    rawId?: string | null;
    ensureLoaded: () => Promise<void>;
    resolveUuid: (id: string) => Promise<string | null>;
    legacyMap: Map<string, string>;
}): Promise<Set<string>> => {
    const set = new Set<string>();
    const raw = params.rawId ? String(params.rawId).trim() : '';
    if (!raw) return set;

    set.add(raw);
    await params.ensureLoaded();

    const uuid = await params.resolveUuid(raw);
    const uuidKey = uuid ? String(uuid).trim() : '';
    if (uuidKey) set.add(uuidKey);

    if (uuidKey) {
        params.legacyMap.forEach((mappedUuid, legacyOrUuidKey) => {
            if (String(mappedUuid).trim() === uuidKey) {
                const key = String(legacyOrUuidKey).trim();
                if (key) set.add(key);
            }
        });
    }

    return set;
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
    if (isUuidString(legacyWorkerId)) return legacyWorkerId;
    await loadDcWorkers();
    const existing = dcLegacyMaps.workers.get(legacyWorkerId);
    if (existing) return existing;

    const teamId = await resolveDcTeamId(params.legacyTeamId ?? null);
    if (!params.name) return null;

    try {
        const res = await createWorker(getDc(), {
            name: params.name,
            legacyId: legacyWorkerId,
            teamId: teamId ?? null,
            role: params.role ?? null,
            payType: params.payType ?? null,
            unitPrice: typeof params.unitPrice === 'number' ? params.unitPrice : null,
            totalManDay: null,
            phone: null,
            residentNumber: null,
            address: null,
            bankAccount: null,
            bankName: null,
            isActive: true,
            joinDate: null
        } as any);

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

const insertDailyReportWorkersInDataConnect = async (params: {
    dailyReportId: string;
    report: DailyReport;
    legacyReportId?: string;
}): Promise<void> => {
    const unknownKeyCounts = new Map<string, number>();
    const reportKeyForUnknown = params.legacyReportId ? String(params.legacyReportId) : String(params.dailyReportId);

    const tasks: Array<Promise<void>> = [];

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
                : `unknown:${reportKeyForUnknown}:${normalizedName}:${normalizedRole}`;
            const nextCount = (unknownKeyCounts.get(base) ?? 0) + 1;
            unknownKeyCounts.set(base, nextCount);
            derivedLegacyWorkerId = nextCount > 1 ? `${base}:${nextCount}` : base;
        }
        const legacyWorkerIdForDc = hasRealLegacyWorkerId
            ? rawLegacyWorkerId
            : (derivedLegacyWorkerId ?? null);

        const workerDcId = legacyWorkerIdForDc && isUuidString(String(legacyWorkerIdForDc))
            ? String(legacyWorkerIdForDc)
            : await ensureDcWorkerIdByLegacyId({
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

        const insertVars: any = {
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

        tasks.push((async () => {
            try {
                await createDailyReportWorker(getDc(), insertVars);
            } catch {
                try {
                    await updateDailyReportWorker(getDc(), insertVars);
                } catch {
                    // ignore
                }
            }
        })());
    }

    const batchSize = 25;
    for (let i = 0; i < tasks.length; i += batchSize) {
        await Promise.all(tasks.slice(i, i + batchSize));
    }
};

const syncDailyReportWorkersInDataConnect = async (params: {
    dailyReportId: string;
    report: DailyReport;
    legacyReportId?: string;
}): Promise<void> => {
    const res = await listDailyReportWorkers(getDc());
    const all = (res as any)?.data?.dailyReportWorkers ?? [];
    const existing = all.filter((rw: any) => {
        const dcId = rw?.dailyReport?.id ? String(rw.dailyReport.id) : '';
        if (dcId && dcId === String(params.dailyReportId)) return true;
        if (params.legacyReportId) {
            const legacyId = rw?.dailyReport?.legacyId ? String(rw.dailyReport.legacyId) : '';
            if (legacyId && legacyId === String(params.legacyReportId)) return true;
        }
        return false;
    });

    const existingByWorkerDcId = new Map<string, any>();
    existing.forEach((rw: any) => {
        const workerDcId = rw?.worker?.id;
        if (!workerDcId) return;
        existingByWorkerDcId.set(String(workerDcId), rw);
    });

    const unknownKeyCounts = new Map<string, number>();

    const reportKeyForUnknown = params.legacyReportId ? String(params.legacyReportId) : String(params.dailyReportId);

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
                : `unknown:${reportKeyForUnknown}:${normalizedName}:${normalizedRole}`;
            const nextCount = (unknownKeyCounts.get(base) ?? 0) + 1;
            unknownKeyCounts.set(base, nextCount);
            derivedLegacyWorkerId = nextCount > 1 ? `${base}:${nextCount}` : base;
        }
        const legacyWorkerIdForDc = hasRealLegacyWorkerId
            ? rawLegacyWorkerId
            : (derivedLegacyWorkerId ?? null);

        const workerDcId = legacyWorkerIdForDc && isUuidString(String(legacyWorkerIdForDc))
            ? String(legacyWorkerIdForDc)
            : await ensureDcWorkerIdByLegacyId({
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

const maybeShadowSyncDailyReport = (_legacyReportId: string): void => {
    return;
};

const toTimestamp = (dateStr?: string | null): Timestamp | undefined => {
    if (!dateStr) return undefined;
    try {
        return Timestamp.fromDate(new Date(dateStr));
    } catch {
        return undefined;
    }
};

const normalizeYmd = (dateStr?: string | null): string => {
    if (!dateStr) return '';
    const raw = String(dateStr).trim();

    const ymdMatch = raw.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/);
    if (ymdMatch) {
        const y = ymdMatch[1];
        const m = String(ymdMatch[2]).padStart(2, '0');
        const d = String(ymdMatch[3]).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    const isoMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    if (isoMatch) return isoMatch[1];

    return raw;
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
        const reportKey = rw?.dailyReport?.legacyId ?? rw?.dailyReport?.id ?? null;
        if (!reportKey) return;

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

        const list = workersByLegacyReportId.get(String(reportKey)) ?? [];
        list.push(worker);
        workersByLegacyReportId.set(String(reportKey), list);
    });

    let mapped: DailyReport[] = reports.map((r: any) => {
        const legacyId = r?.legacyId ?? undefined;
        const reportKey = legacyId ?? (r?.id ?? undefined);
        const teamUuid = r?.team?.id ? String(r.team.id) : '';
        const teamLegacyId = r?.team?.legacyId ? String(r.team.legacyId) : '';
        const siteUuid = r?.site?.id ? String(r.site.id) : '';
        const siteLegacyId = r?.site?.legacyId ? String(r.site.legacyId) : '';
        const legacyOrUuidTeamId = teamUuid || teamLegacyId || '';
        const legacyOrUuidSiteId = siteUuid || siteLegacyId || '';
        const workers = reportKey ? (workersByLegacyReportId.get(String(reportKey)) ?? []) : [];

        const result: DailyReport = {
            id: legacyId ?? (r?.id ?? undefined),
            date: normalizeYmd(r?.date),
            teamId: legacyOrUuidTeamId,
            teamName: r?.team?.name ?? '',
            siteId: legacyOrUuidSiteId,
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

    const startDate = params.startDate ? normalizeYmd(params.startDate) : '';
    const endDate = params.endDate ? normalizeYmd(params.endDate) : '';

    if (startDate) {
        mapped = mapped.filter(r => String(r.date ?? '') >= startDate);
    }
    if (endDate) {
        mapped = mapped.filter(r => String(r.date ?? '') <= endDate);
    }
    const teamFilterRaw = params.teamId ? String(params.teamId) : null;
    const siteFilterRaw = params.siteId ? String(params.siteId) : null;
    const [teamFilterCandidates, siteFilterCandidates] = await Promise.all([
        buildIdCandidateSet({
            rawId: teamFilterRaw,
            ensureLoaded: loadDcTeams,
            resolveUuid: resolveDcTeamId,
            legacyMap: dcLegacyMaps.teams
        }),
        buildIdCandidateSet({
            rawId: siteFilterRaw,
            ensureLoaded: loadDcSites,
            resolveUuid: resolveDcSiteId,
            legacyMap: dcLegacyMaps.sites
        })
    ]);

    if (teamFilterRaw) {
        mapped = mapped.filter((r) => teamFilterCandidates.has(String(r.teamId ?? '').trim()));
    }
    if (siteFilterRaw) {
        mapped = mapped.filter((r) => siteFilterCandidates.has(String(r.siteId ?? '').trim()));
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
    siteType?: string;
    paymentType?: string;
    workerTeamName?: string;
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
    siteType?: string; // 현장구분 (New)
    paymentType?: string; // 결제구분 (New)
    workerTeamName?: string;
}

export interface DailyReportWorkerRow {
    reportId: string;
    reportLegacyId?: string | null;
    date: string;
    teamId?: string;
    teamName?: string;
    siteId?: string;
    siteName?: string;
    responsibleTeamId?: string | null;
    responsibleTeamName?: string | null;
    workerId: string;
    workerLegacyId?: string | null;
    workerName: string;
    workerTeamId?: string | null;
    workerTeamName?: string | null;
    role?: string | null;
    status?: string | null;
    manDay: number;
    unitPrice: number;
    amount: number;
    payType?: string | null;
    salaryModel?: string | null;
    workContent?: string | null;
    siteType?: string;
    paymentType?: string;
    createdAt?: Timestamp;
}

const computeTotalManDay = (workers: DailyReportWorker[] = []): number => {
    return workers.reduce((sum, w) => sum + (typeof w?.manDay === 'number' ? w.manDay : 0), 0);
};

const computeTotalAmount = (workers: DailyReportWorker[] = []): number => {
    return workers.reduce((sum, w) => {
        const manDay = typeof w?.manDay === 'number' ? w.manDay : 0;
        const unitPrice = typeof w?.unitPrice === 'number' ? w.unitPrice : 0;
        return sum + (manDay * unitPrice);
    }, 0);
};

const getDailyReportSnapshotFromDataConnect = async (idOrLegacyId: string): Promise<{
    dcId: string;
    legacyId?: string | null;
    report: DailyReport;
} | null> => {
    const reportsRes = await listDailyReports(getDc());
    const reports = (reportsRes as any)?.data?.dailyReports ?? [];

    const raw = String(idOrLegacyId);
    let row = reports.find((r: any) => String(r?.id ?? '') === raw || (r?.legacyId && String(r.legacyId) === raw));

    if (!row) {
        const maybeUuid = await resolveDcDailyReportId(raw);
        if (maybeUuid) {
            row = reports.find((r: any) => String(r?.id ?? '') === String(maybeUuid));
        }
    }

    if (!row) return null;

    const dcId = String(row.id);
    const legacyId = row?.legacyId ?? null;
    const reportKey = legacyId ?? dcId;

    const workersRes = await listDailyReportWorkers(getDc());
    const allWorkers = (workersRes as any)?.data?.dailyReportWorkers ?? [];
    const reportWorkers = allWorkers.filter((rw: any) => String(rw?.dailyReport?.id ?? '') === dcId);

    const workers: DailyReportWorker[] = reportWorkers.map((rw: any) => {
        const legacyWorkerId = rw?.legacyWorkerId ? String(rw.legacyWorkerId) : null;
        const workerId = legacyWorkerId
            ? legacyWorkerId
            : (rw?.worker?.legacyId ?? rw?.worker?.id ?? '');

        return {
            workerId: String(workerId),
            name: (rw?.workerName ?? rw?.worker?.name ?? '') as string,
            role: (rw?.role ?? '') as string,
            status: ((rw?.status ?? 'attendance') as any),
            manDay: typeof rw?.manDay === 'number' ? rw.manDay : (typeof rw?.gongsu === 'number' ? rw.gongsu : 0),
            workContent: (rw?.workContent ?? '') as string,
            teamId: rw?.legacyTeamId ? String(rw.legacyTeamId) : undefined,
            unitPrice: typeof rw?.unitPrice === 'number' ? rw.unitPrice : undefined,
            payType: rw?.payType ?? undefined,
            salaryModel: rw?.salaryModel ?? undefined
        };
    });

    const totalManDay = typeof row?.totalManDay === 'number' ? row.totalManDay : computeTotalManDay(workers);
    const totalAmount = typeof row?.totalAmount === 'number' ? row.totalAmount : computeTotalAmount(workers);

    const report: DailyReport = {
        id: String(reportKey),
        date: normalizeYmd(row?.date),
        teamId: row?.team?.id ? String(row.team.id) : (row?.team?.legacyId ? String(row.team.legacyId) : ''),
        teamName: row?.team?.name ?? '',
        siteId: row?.site?.id ? String(row.site.id) : (row?.site?.legacyId ? String(row.site.legacyId) : ''),
        siteName: row?.site?.name ?? (row?.siteName ?? ''),
        responsibleTeamId: row?.responsibleTeamLegacyId ?? undefined,
        responsibleTeamName: row?.responsibleTeamName ?? undefined,
        companyName: row?.companyName ?? undefined,
        writerId: row?.writerUid ?? '',
        workers,
        totalManDay,
        totalAmount,
        createdAt: toTimestamp(row?.createdAt),
        weather: row?.weather ?? undefined,
        workContent: row?.workContent ?? undefined,
        siteType: row?.siteType ?? undefined,
        paymentType: row?.paymentType ?? undefined
    };

    return { dcId, legacyId, report };
};

const deleteDailyReportCascadeInDataConnect = async (reportIdOrLegacyId: string, preFetchedWorkers?: any[]): Promise<void> => {
    const dcId = await resolveDcDailyReportId(reportIdOrLegacyId);
    if (!dcId) return;

    const allWorkers = Array.isArray(preFetchedWorkers)
        ? preFetchedWorkers
        : (((await listDailyReportWorkers(getDc())) as any)?.data?.dailyReportWorkers ?? []);

    const reportWorkers = allWorkers.filter((rw: any) => String(rw?.dailyReport?.id ?? '') === String(dcId));

    for (const rw of reportWorkers) {
        const workerDcId = rw?.worker?.id;
        if (!workerDcId) continue;
        await deleteDailyReportWorker(getDc(), { dailyReportId: String(dcId), workerId: String(workerDcId) });
    }

    await deleteDailyReport(getDc(), { id: String(dcId) } as any);

    dcLegacyMaps.loaded.dailyReports = false;
};

const createDailyReportAndWorkersInDataConnect = async (report: Omit<DailyReport, 'id'>): Promise<string> => {
    const teamUuid = await resolveDcTeamId(report.teamId);
    if (!teamUuid) throw new Error('Team not found');

    const siteUuid = report.siteId ? await resolveDcSiteId(report.siteId) : null;

    const totalManDay = typeof report.totalManDay === 'number' ? report.totalManDay : computeTotalManDay(report.workers);
    const totalAmount = typeof report.totalAmount === 'number' ? report.totalAmount : computeTotalAmount(report.workers);

    const vars: any = {
        date: normalizeYmd(report.date),
        legacyId: (report as any)?.legacyId ? String((report as any).legacyId) : null,
        teamId: teamUuid,
        siteId: siteUuid ?? null,
        siteName: report.siteName || null,
        status: (report as any)?.status ?? null,
        totalManDay,
        totalAmount,
        weather: report.weather ?? null,
        writerUid: report.writerId ?? null,
        companyName: report.companyName ?? null,
        responsibleTeamName: report.responsibleTeamName ?? null,
        responsibleTeamLegacyId: report.responsibleTeamId ?? null,
        workContent: report.workContent ?? null,
        siteType: report.siteType ?? null,
        paymentType: report.paymentType ?? null
    };

    if (!vars.legacyId) delete vars.legacyId;

    const created = await createDailyReport(getDc(), vars);
    const newId = (created as any)?.data?.dailyReport_insert?.id ?? null;
    if (!newId) throw new Error('Failed to create daily report');

    await insertDailyReportWorkersInDataConnect({
        dailyReportId: String(newId),
        report: { ...(report as any), id: String(newId), totalManDay, totalAmount }
    });

    dcLegacyMaps.loaded.dailyReports = false;
    return String(newId);
};

export const dailyReportService = {
    // Add Report
    addReport: async (report: Omit<DailyReport, 'id'>): Promise<string> => {
        try {
            const id = await createDailyReportAndWorkersInDataConnect(report);

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
            maybeShadowSyncDailyReport(id);
            return id;
        } catch (error) {
            console.error("Error adding report:", error);
            throw error;
        }
    },

    // Update Report (Full replacement of workers)
    updateReport: async (id: string, updates: Partial<DailyReport> & { workers: DailyReportWorker[] }): Promise<void> => {
        try {
            const snap = await getDailyReportSnapshotFromDataConnect(id);
            if (!snap) throw new Error('Report not found');
            const oldReport = snap.report;

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

            // 3. Update Document (Data Connect)
            const nextWorkers = Array.isArray(updates.workers) ? updates.workers : [];
            const nextTotalManDay = typeof updates.totalManDay === 'number' ? updates.totalManDay : computeTotalManDay(nextWorkers);
            const nextTotalAmount = typeof updates.totalAmount === 'number' ? updates.totalAmount : computeTotalAmount(nextWorkers);

            const teamId = updates.teamId || oldReport.teamId;
            const siteId = updates.siteId || oldReport.siteId;

            const teamUuid = await resolveDcTeamId(teamId);
            if (!teamUuid) throw new Error('Team not found');
            const siteUuid = siteId ? await resolveDcSiteId(siteId) : null;

            const vars: any = {
                id: snap.dcId,
                date: normalizeYmd(updates.date ?? oldReport.date),
                teamId: teamUuid,
                siteId: siteUuid ?? null,
                siteName: (updates.siteName ?? oldReport.siteName) || null,
                status: (updates as any)?.status ?? (oldReport as any)?.status ?? null,
                totalManDay: nextTotalManDay,
                totalAmount: nextTotalAmount,
                weather: updates.weather ?? oldReport.weather ?? null,
                writerUid: updates.writerId ?? oldReport.writerId ?? null,
                companyName: updates.companyName ?? oldReport.companyName ?? null,
                responsibleTeamName: updates.responsibleTeamName ?? oldReport.responsibleTeamName ?? null,
                responsibleTeamLegacyId: updates.responsibleTeamId ?? oldReport.responsibleTeamId ?? null,
                workContent: updates.workContent ?? oldReport.workContent ?? null,
                siteType: updates.siteType ?? oldReport.siteType ?? null,
                paymentType: updates.paymentType ?? oldReport.paymentType ?? null
            };

            await updateDailyReport(getDc(), vars);

            const merged: DailyReport = {
                ...oldReport,
                ...updates,
                teamId,
                siteId,
                workers: nextWorkers,
                totalManDay: nextTotalManDay,
                totalAmount: nextTotalAmount
            } as any;

            await syncDailyReportWorkersInDataConnect({
                dailyReportId: snap.dcId,
                legacyReportId: snap.legacyId ? String(snap.legacyId) : undefined,
                report: merged
            });

            // 4. Increment New
            const incrementPromises: Promise<void>[] = [];
            if (nextTotalManDay > 0) {
                if (teamId) {
                    incrementPromises.push(teamService.incrementManDay(teamId, nextTotalManDay));
                    incrementPromises.push(companyService.incrementManDayByTeam(teamId, nextTotalManDay));
                }
                if (siteId) {
                    incrementPromises.push(siteService.incrementManDay(siteId, nextTotalManDay));
                }
            }
            if (nextWorkers) {
                nextWorkers.forEach(w => {
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
            const { manpowerService } = await import('./manpowerService');
            const { teamService } = await import('./teamService');
            const { siteService } = await import('./siteService');
            const { companyService } = await import('./companyService');

            const createdIds: string[] = [];

            // 1. Create Reports (Data Connect)
            for (const report of reports) {
                const id = await createDailyReportAndWorkersInDataConnect(report);
                createdIds.push(id);
            }

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

            createdIds.forEach(id => maybeShadowSyncDailyReport(id));

        } catch (error) {
            console.error("Error adding batch reports:", error);
            throw error;
        }
    },

    // Overwrite Reports for Date (Delete existing for teams, then Insert new)
    overwriteReports: async (date: string, reports: Omit<DailyReport, 'id'>[], teamIdsToCheck: string[]): Promise<void> => {
        try {
            const { manpowerService } = await import('./manpowerService');
            const { teamService } = await import('./teamService');
            const { siteService } = await import('./siteService');
            const { companyService } = await import('./companyService');

            const deletedIds: string[] = [];
            const createdIds: string[] = [];

            // 1. Find Existing Reports for these Teams on this Date (Data Connect)
            const teamIds = teamIdsToCheck.map(String);
            const teamUuids = await Promise.all(teamIds.map(tid => resolveDcTeamId(tid)));
            const teamKeySet = new Set<string>([...teamIds, ...teamUuids.filter((v): v is string => !!v)]);

            const existingForDate = await mapDailyReportsFromDataConnect({ startDate: date, endDate: date });
            const reportsToDelete = existingForDate.filter(r => r.id && teamKeySet.has(String(r.teamId)));

            const preFetchedWorkersRes = await listDailyReportWorkers(getDc());
            const preFetchedWorkers = (preFetchedWorkersRes as any)?.data?.dailyReportWorkers ?? [];

            // 2. Delete matches (Data Connect)
            for (const r of reportsToDelete) {
                if (!r.id) continue;
                deletedIds.push(String(r.id));
                await deleteDailyReportCascadeInDataConnect(String(r.id), preFetchedWorkers);
            }

            // 3. Create New Reports (Data Connect)
            for (const report of reports) {
                const id = await createDailyReportAndWorkersInDataConnect(report);
                createdIds.push(id);
            }

            // 4. Update Stats (Blind Increment for new reports)
            // Note: Ideally we should decrement old stats first. 
            // Since we deleted the documents, the stats are now "stale" (high).
            // Complexity: To decrement, we need to aggregate the deleted docs.
            // Let's DO IT properly to avoid infinite growth of stats.

            const workerUpdates = new Map<string, number>();
            const teamUpdates = new Map<string, number>();
            const siteUpdates = new Map<string, number>();

            // A. Decrement for Deleted
            reportsToDelete.forEach(data => {
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

            toast.saved('일보 (덮어쓰기)', reports.length);

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

            deletedIds.forEach(id => maybeShadowSyncDailyReport(id));
            createdIds.forEach(id => maybeShadowSyncDailyReport(id));

        } catch (error) {
            console.error("Error overwriting reports:", error);
            throw error;
        }
    },
    getLastReportDate: async (teamId?: string): Promise<string | null> => {
        try {
            const res = await listDailyReports(getDc());
            const rows = (res as any)?.data?.dailyReports ?? [];
            let filtered = rows;
            if (teamId) {
                const teamUuid = await resolveDcTeamId(teamId);
                if (!teamUuid) return null;
                filtered = rows.filter((r: any) => String(r?.team?.id ?? '') === String(teamUuid));
            }

            let last: string | null = null;
            for (const r of filtered) {
                const d = r?.date ? String(r.date) : '';
                if (!d) continue;
                if (!last || d > last) last = d;
            }
            return last;
        } catch (error) {
            console.error("Error fetching last report date:", error);
            return null;
        }
    },

    // Get Reports by Date and Team
    getReports: async (date: string, teamId?: string): Promise<DailyReport[]> => {
        try {
            const reports = await mapDailyReportsFromDataConnect({ startDate: date, endDate: date });
            if (!teamId) return reports;
            const teamUuid = await resolveDcTeamId(teamId);
            return reports.filter(r => String(r.teamId) === String(teamId) || (teamUuid && String(r.teamId) === String(teamUuid)));
        } catch (error) {
            console.error("Error fetching reports:", error);
            throw error;
        }
    },

    // Get Reports by Date Range and Team
    getReportsByRange: async (startDate: string, endDate: string, teamId?: string, siteId?: string): Promise<DailyReport[]> => {
        try {
            let result = await mapDailyReportsFromDataConnect({ startDate, endDate });

            if (teamId) {
                const teamUuid = await resolveDcTeamId(teamId);
                result = result.filter(r => String(r.teamId) === String(teamId) || (teamUuid && String(r.teamId) === String(teamUuid)));
            }

            if (siteId) {
                const siteUuid = await resolveDcSiteId(siteId);
                result = result.filter(r => String(r.siteId) === String(siteId) || (siteUuid && String(r.siteId) === String(siteUuid)));
            }

            return result;
        } catch (error) {
            console.error("Error fetching reports by range:", error);
            throw error;
        }
    },

    getReportWorkerRowsByRange: async (params: {
        startDate: string;
        endDate: string;
        teamId?: string;
        siteId?: string;
    }): Promise<DailyReportWorkerRow[]> => {
        try {
            const start = normalizeYmd(params.startDate);
            const end = normalizeYmd(params.endDate);

            const [reportsRes, reportWorkersRes, teamsRes, sitesRes] = await Promise.all([
                listDailyReports(getDc()),
                listDailyReportWorkers(getDc()),
                listTeams(getDc()),
                listSites(getDc()) // Fetch sites for fallback logic
            ]);

            const reports = (reportsRes as any)?.data?.dailyReports ?? [];
            const reportWorkers = (reportWorkersRes as any)?.data?.dailyReportWorkers ?? [];
            const teams = (teamsRes as any)?.data?.teams ?? [];
            const sites = (sitesRes as any)?.data?.sites ?? []; // Sites data

            // Map Site Defaults
            const siteDefsMap = new Map<string, { siteType?: string; paymentType?: string }>();
            sites.forEach((s: any) => {
                const id = s.id ? String(s.id) : '';
                const legacyId = s.legacyId ? String(s.legacyId) : '';
                const defs = {
                    siteType: s.siteType || undefined,
                    paymentType: s.paymentMethod || undefined // Note: Site has 'paymentMethod', Report has 'paymentType'
                };
                if (id) siteDefsMap.set(id, defs);
                if (legacyId) siteDefsMap.set(legacyId, defs);
            });

            const teamNameMap = new Map<string, string>();
            teams.forEach((t: any) => {
                const name = t.name ? String(t.name) : '';
                if (name) {
                    if (t.id) teamNameMap.set(String(t.id), name);
                    if (t.legacyId) teamNameMap.set(String(t.legacyId), name);
                }
            });

            const reportMetaById = new Map<
                string,
                {
                    teamId?: string;
                    teamName?: string;
                    siteId?: string;
                    siteName?: string;
                    responsibleTeamId?: string;
                    responsibleTeamName?: string;
                    legacyId?: string | null;
                    siteType?: string;
                    paymentType?: string;
                }
            >();
            reports.forEach((r: any) => {
                const id = r?.id ? String(r.id) : '';
                const legacyId = r?.legacyId ?? null;
                const teamId = r?.team?.id ? String(r.team.id) : (r?.team?.legacyId ? String(r.team.legacyId) : undefined);
                const teamName = r?.team?.name ? String(r.team.name) : undefined;
                const siteId = r?.site?.id ? String(r.site.id) : (r?.site?.legacyId ? String(r.site.legacyId) : undefined);
                const siteName = r?.site?.name ? String(r.site.name) : (r?.siteName ? String(r.siteName) : undefined);
                const responsibleTeamId = r?.responsibleTeamLegacyId ? String(r.responsibleTeamLegacyId) : undefined;
                const responsibleTeamName = r?.responsibleTeamName ? String(r.responsibleTeamName) : undefined;
                const siteType = r?.siteType ?? undefined;
                const paymentType = r?.paymentType ?? undefined;

                if (id) reportMetaById.set(id, { teamId, teamName, siteId, siteName, responsibleTeamId, responsibleTeamName, legacyId, siteType, paymentType });
                if (legacyId) {
                    reportMetaById.set(String(legacyId), { teamId, teamName, siteId, siteName, responsibleTeamId, responsibleTeamName, legacyId, siteType, paymentType });
                }
            });

            const teamFilterRaw = params.teamId ? String(params.teamId) : null;
            const siteFilterRaw = params.siteId ? String(params.siteId) : null;
            const [teamFilterCandidates, siteFilterCandidates] = await Promise.all([
                buildIdCandidateSet({
                    rawId: teamFilterRaw,
                    ensureLoaded: loadDcTeams,
                    resolveUuid: resolveDcTeamId,
                    legacyMap: dcLegacyMaps.teams
                }),
                buildIdCandidateSet({
                    rawId: siteFilterRaw,
                    ensureLoaded: loadDcSites,
                    resolveUuid: resolveDcSiteId,
                    legacyMap: dcLegacyMaps.sites
                })
            ]);

            const rows: DailyReportWorkerRow[] = [];

            for (const rw of reportWorkers) {
                const reportId = rw?.dailyReport?.id ? String(rw.dailyReport.id) : '';
                const reportLegacyId = rw?.dailyReport?.legacyId ?? null;
                const date = normalizeYmd(rw?.dailyReport?.date);
                if (!reportId || !date) continue;
                if (start && date < start) continue;
                if (end && date > end) continue;

                const meta = reportMetaById.get(reportId)
                    ?? (reportLegacyId ? reportMetaById.get(String(reportLegacyId)) : undefined);

                if (teamFilterRaw) {
                    const tid = meta?.teamId ? String(meta.teamId).trim() : '';
                    if (!teamFilterCandidates.has(tid)) continue;
                }
                if (siteFilterRaw) {
                    const sid = meta?.siteId ? String(meta.siteId).trim() : '';
                    if (!siteFilterCandidates.has(sid)) continue;
                }

                const workerId = rw?.worker?.id ? String(rw.worker.id) : '';
                const workerLegacyId = rw?.worker?.legacyId ?? null;
                const legacyWorkerId = rw?.legacyWorkerId ? String(rw.legacyWorkerId) : null;
                const resolvedWorkerId = legacyWorkerId || (workerLegacyId ? String(workerLegacyId) : workerId);

                const manDay = typeof rw?.manDay === 'number'
                    ? rw.manDay
                    : (typeof rw?.gongsu === 'number' ? rw.gongsu : 0);
                const unitPrice = typeof rw?.unitPrice === 'number' ? rw.unitPrice : 0;
                const amount = typeof rw?.amount === 'number' ? rw.amount : (manDay * unitPrice);

                const workerTeamId = rw?.legacyTeamId ? String(rw.legacyTeamId) : (rw?.team?.id ? String(rw.team.id) : undefined);
                const workerTeamName = workerTeamId ? teamNameMap.get(workerTeamId) : undefined;

                rows.push({
                    reportId,
                    reportLegacyId,
                    date,
                    teamId: meta?.teamId,
                    teamName: meta?.teamName,
                    siteId: meta?.siteId,
                    siteName: meta?.siteName,
                    responsibleTeamId: meta?.responsibleTeamId ?? null,
                    responsibleTeamName: meta?.responsibleTeamName ?? null,
                    workerId: resolvedWorkerId,
                    workerLegacyId,
                    workerName: (rw?.workerName ?? rw?.worker?.name ?? '') as string,
                    workerTeamId: workerTeamId ?? null,
                    workerTeamName,
                    role: rw?.role ?? null,
                    status: rw?.status ?? null,
                    manDay,
                    unitPrice,
                    amount,
                    payType: rw?.payType ?? null,
                    salaryModel: rw?.salaryModel ?? null,
                    workContent: rw?.workContent ?? null,
                    siteType: meta?.siteType || (meta?.siteId ? siteDefsMap.get(String(meta.siteId))?.siteType : undefined) || undefined,
                    paymentType: meta?.paymentType || (meta?.siteId ? siteDefsMap.get(String(meta.siteId))?.paymentType : undefined) || undefined,
                    createdAt: toTimestamp(rw?.createdAt)
                });
            }

            rows.sort((a, b) => {
                const d = (b.date ?? '').localeCompare(a.date ?? '', 'en');
                if (d !== 0) return d;
                const t = (a.teamName ?? '').localeCompare(b.teamName ?? '', 'ko');
                if (t !== 0) return t;
                return (a.workerName ?? '').localeCompare(b.workerName ?? '', 'ko');
            });

            return rows;
        } catch (error) {
            console.error('[DailyReport] getReportWorkerRowsByRange failed:', error);
            throw error;
        }
    },

    // Check if report exists
    checkReportExists: async (date: string, teamId: string, siteId: string): Promise<boolean> => {
        try {
            const reports = await dailyReportService.getReportsByRange(date, date, teamId, siteId);
            return reports.length > 0;
        } catch (error) {
            console.error("Error checking report existence:", error);
            throw error;
        }
    },

    // Remove worker from report and update cumulative stats
    // Remove worker from report and update cumulative stats
    removeWorkerFromReport: async (reportId: string, workerId: string): Promise<void> => {
        try {
            const snap = await getDailyReportSnapshotFromDataConnect(reportId);
            if (!snap) throw new Error('Report not found');

            const reportData = snap.report;
            const workerToRemove = reportData.workers.find(w => String(w.workerId) === String(workerId));

            if (!workerToRemove) {
                console.warn(`[DailyReport] removeWorkerFromReport: Worker ${workerId} not found in report snapshot. Proceeding with best-effort deletion.`);
            }

            // 1. Resolve Worker UUID for Data Connect Deletion
            let workerDcId = String(workerId);
            if (!isUuidString(workerDcId)) {
                await loadDcWorkers();
                const resolved = dcLegacyMaps.workers.get(workerDcId);
                if (resolved) {
                    workerDcId = resolved;
                } else {
                    // Fallback: If we can't resolve it via map, we can't delete it via DC if it relies on UUID.
                    // But maybe the ID passed IS the UUID (if isUuidString returned false incorrectly? Unlikely).
                    // If it's a legacy ID not in map (truncation?), we are stuck.
                    // But usually current session would have encountered it.
                    console.warn(`[DailyReport] Could not resolve DC UUID for worker ${workerId}. Deletion might fail if ID is legacy.`);
                }
            }

            // 2. Decrement cumulative man-days
            const { manpowerService } = await import('./manpowerService');
            const { teamService } = await import('./teamService');
            const { siteService } = await import('./siteService');
            const { companyService } = await import('./companyService');

            const updatePromises = [];

            if (workerToRemove && workerToRemove.manDay > 0) {
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

            // 3. Remove worker row via Data Connect (Atomic Delete)
            // Note: This avoids syncing the entire list which can cause data loss if lists are truncated.
            await deleteDailyReportWorker(getDc(), {
                dailyReportId: String(snap.dcId),
                workerId: String(workerDcId)
            });

            // 4. Update Report Header Totals
            if (workerToRemove) {
                const currentTotalManDay = typeof reportData.totalManDay === 'number' ? reportData.totalManDay : 0;
                const currentTotalAmount = typeof reportData.totalAmount === 'number' ? reportData.totalAmount : 0;

                const subtractManDay = typeof workerToRemove.manDay === 'number' ? workerToRemove.manDay : 0;
                const subtractAmount = (typeof workerToRemove.manDay === 'number' ? workerToRemove.manDay : 0) *
                    (typeof workerToRemove.unitPrice === 'number' ? workerToRemove.unitPrice : 0);

                const newTotalManDay = Math.max(0, currentTotalManDay - subtractManDay);
                const newTotalAmount = Math.max(0, currentTotalAmount - subtractAmount);

                await updateDailyReport(getDc(), {
                    id: String(snap.dcId),
                    totalManDay: newTotalManDay,
                    totalAmount: newTotalAmount
                } as any);
            }

            maybeShadowSyncDailyReport(reportId);

        } catch (error) {
            console.error("Error removing worker from report:", error);
            throw error;
        }
    },

    // Update worker in report and update cumulative stats
    updateWorkerInReport: async (reportId: string, workerId: string, updates: Partial<DailyReportWorker>): Promise<void> => {
        try {
            const snap = await getDailyReportSnapshotFromDataConnect(reportId);
            if (!snap) throw new Error('Report not found');

            const reportData = snap.report;
            const workerIndex = reportData.workers.findIndex(w => String(w.workerId) === String(workerId));

            if (workerIndex === -1) throw new Error("Worker not found in report");

            const originalWorker = reportData.workers[workerIndex];
            const nextWorker: DailyReportWorker = {
                ...originalWorker,
                ...updates
            } as any;

            // Handle Daily Report Level Updates if passed (siteType, paymentType)
            // But this function is 'updateWorkerInReport'. 
            // If we want to update the report fields, we should use 'updateReport' or a new method.
            // However, DailyReportWorkerRow edits might trigger this. 
            // If the user edits "Site Type" column, that's a report-level change.
            // We should check if we need to call updateDailyReport for those fields.


            const isWorkerChange = updates.workerId && String(updates.workerId) !== String(workerId);
            const { manpowerService } = await import('./manpowerService');
            const { teamService } = await import('./teamService');
            const { siteService } = await import('./siteService');
            const { companyService } = await import('./companyService');
            const promises: Promise<void>[] = [];

            if (isWorkerChange) {
                // CASE 1: Worker Swap (Remove Old -> Add New)
                // 1. Decrement stats for OLD worker/context
                if (originalWorker.manDay > 0) {
                    if (workerId && !String(workerId).startsWith('unknown')) {
                        promises.push(manpowerService.incrementManDay(workerId, -originalWorker.manDay));
                    }
                    if (reportData.teamId) {
                        promises.push(teamService.incrementManDay(reportData.teamId, -originalWorker.manDay));
                        promises.push(companyService.incrementManDayByTeam(reportData.teamId, -originalWorker.manDay));
                    }
                    if (reportData.siteId) {
                        promises.push(siteService.incrementManDay(reportData.siteId, -originalWorker.manDay));
                    }
                }

                // 2. Increment stats for NEW worker/context
                const newManDay = typeof nextWorker.manDay === 'number' ? nextWorker.manDay : 0;
                const newWorkerId = String(nextWorker.workerId);

                if (newManDay > 0) {
                    if (newWorkerId && !String(newWorkerId).startsWith('unknown')) {
                        promises.push(manpowerService.incrementManDay(newWorkerId, newManDay));
                    }
                    if (reportData.teamId) {
                        promises.push(teamService.incrementManDay(reportData.teamId, newManDay));
                        promises.push(companyService.incrementManDayByTeam(reportData.teamId, newManDay));
                    }
                    if (reportData.siteId) {
                        promises.push(siteService.incrementManDay(reportData.siteId, newManDay));
                    }
                }
            } else {
                // CASE 2: Same Worker, Update Stats Diff
                const newManDay = typeof nextWorker.manDay === 'number' ? nextWorker.manDay : originalWorker.manDay;
                const manDayDiff = newManDay - (typeof originalWorker.manDay === 'number' ? originalWorker.manDay : 0);

                if (manDayDiff !== 0) {
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
                }
            }

            try {
                await Promise.all(promises);
            } catch (error) {
                console.warn('[DailyReport] updateWorkerInReport stats update failed (ignored)', { error });
            }

            // 2. Update worker in array
            const updatedWorkers = [...reportData.workers];
            updatedWorkers[workerIndex] = nextWorker;
            const updatedTotalManDay = computeTotalManDay(updatedWorkers);
            const updatedTotalAmount = computeTotalAmount(updatedWorkers);

            // 3. Update report (Data Connect)
            // 3. Update report (Data Connect)
            const reportUpdates: any = {
                id: String(snap.dcId),
                totalManDay: updatedTotalManDay,
                totalAmount: updatedTotalAmount
            };
            if (updates.siteType !== undefined) reportUpdates.siteType = updates.siteType;
            if (updates.paymentType !== undefined) reportUpdates.paymentType = updates.paymentType;

            await updateDailyReport(getDc(), reportUpdates);

            await syncDailyReportWorkersInDataConnect({
                dailyReportId: String(snap.dcId),
                legacyReportId: snap.legacyId ? String(snap.legacyId) : undefined,
                report: {
                    ...reportData,
                    workers: updatedWorkers,
                    totalManDay: updatedTotalManDay,
                    totalAmount: updatedTotalAmount,
                    workerTeamName: updates.workerTeamName !== undefined ? updates.workerTeamName : originalWorker.workerTeamName,
                    ...(updates.siteType !== undefined ? { siteType: updates.siteType } : {}),
                    ...(updates.paymentType !== undefined ? { paymentType: updates.paymentType } : {})
                }
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
            const all = await mapDailyReportsFromDataConnect({});
            const siteUuid = await resolveDcSiteId(siteId);
            return all.filter(r => String(r.siteId) === String(siteId) || (siteUuid && String(r.siteId) === String(siteUuid)));
        } catch (error) {
            console.error("Error fetching reports by site:", error);
            throw error;
        }
    },

    // Add Worker to Report (Find or Create)
    addWorkerToReport: async (date: string, teamId: string, teamName: string, siteId: string, siteName: string, worker: DailyReportWorker, siteData?: { constructorCompanyId?: string; constructorCompanyName?: string; partnerId?: string; partnerName?: string; companyId?: string; companyName?: string }): Promise<void> => {
        try {
            const teamUuid = await resolveDcTeamId(teamId);
            if (!teamUuid) throw new Error('Team not found');
            const siteUuid = siteId ? await resolveDcSiteId(siteId) : null;

            const reportsRes = await listDailyReports(getDc());
            const rows = (reportsRes as any)?.data?.dailyReports ?? [];
            const found = rows.find((r: any) => {
                if (String(r?.date ?? '') !== String(date)) return false;
                if (String(r?.team?.id ?? '') !== String(teamUuid)) return false;
                const rSiteId = r?.site?.id ? String(r.site.id) : '';
                const wantSiteId = siteUuid ? String(siteUuid) : '';
                return rSiteId === wantSiteId;
            });

            if (found?.id) {
                const snap = await getDailyReportSnapshotFromDataConnect(String(found.id));
                if (!snap) throw new Error('Report not found');
                const reportKey = snap.report.id ?? String(found.id);

                const existingWorkerIndex = snap.report.workers.findIndex(w => String(w.workerId) === String(worker.workerId));
                if (existingWorkerIndex !== -1) {
                    await dailyReportService.updateWorkerInReport(String(reportKey), worker.workerId, worker);
                    return;
                }

                const updatedWorkers = [...snap.report.workers, worker];
                const updatedTotalManDay = computeTotalManDay(updatedWorkers);
                const updatedTotalAmount = computeTotalAmount(updatedWorkers);

                await updateDailyReport(getDc(), {
                    id: String(snap.dcId),
                    totalManDay: updatedTotalManDay,
                    totalAmount: updatedTotalAmount
                } as any);

                await syncDailyReportWorkersInDataConnect({
                    dailyReportId: String(snap.dcId),
                    legacyReportId: snap.legacyId ? String(snap.legacyId) : undefined,
                    report: {
                        ...snap.report,
                        workers: updatedWorkers,
                        totalManDay: updatedTotalManDay,
                        totalAmount: updatedTotalAmount
                    }
                });

                toast.updated('일보');
                maybeShadowSyncDailyReport(String(reportKey));

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
                return;
            }

            const newReport: Omit<DailyReport, 'id'> = {
                date,
                siteId,
                siteName,
                teamId,
                teamName,
                companyId: siteData?.companyId || '',
                companyName: siteData?.companyName || '',
                constructorCompanyId: siteData?.constructorCompanyId || '',
                constructorCompanyName: siteData?.constructorCompanyName || '',
                partnerId: siteData?.partnerId || '',
                partnerName: siteData?.partnerName || '',
                responsibleTeamName: teamName,
                totalManDay: worker.manDay,
                totalAmount: (worker.manDay || 0) * (worker.unitPrice || 0),
                workers: [worker],
                weather: '맑음',
                workContent: worker.workContent || '',
                writerId: 'system'
            };

            const createdId = await createDailyReportAndWorkersInDataConnect(newReport);
            maybeShadowSyncDailyReport(createdId);

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

            const all = await mapDailyReportsFromDataConnect({});
            const today = all.filter(r => r.date === todayStr).length;
            const thisMonth = all.filter(r => r.date >= startOfMonth && r.date <= endOfMonth).length;
            return { total: all.length, today, thisMonth };
        } catch (error) {
            console.error("Error fetching DB stats:", error);
            return { total: 0, today: 0, thisMonth: 0 };
        }
    },

    // Get All Reports (for Lookup)
    getAllReports: async (): Promise<DailyReport[]> => {
        try {
            return await mapDailyReportsFromDataConnect({});
        } catch (error) {
            console.error("Error fetching all reports:", error);
            throw error;
        }
    },



    // Delete Reports (Batch)
    deleteReports: async (reportIds: string[]): Promise<void> => {
        try {
            const batchSize = 100;
            for (let i = 0; i < reportIds.length; i += batchSize) {
                const chunk = reportIds.slice(i, i + batchSize);
                for (const id of chunk) {
                    await deleteDailyReportCascadeInDataConnect(String(id));
                }
            }
            toast.deleted('일보', reportIds.length);

            reportIds.forEach(id => maybeShadowSyncDailyReport(id));
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
            const teamsRes = await listTeams(getDc());
            const teams = (teamsRes as any)?.data?.teams ?? [];
            const teamTypeById = new Map<string, string>();
            teams.forEach((t: any) => {
                const type = t?.type ? String(t.type) : '';
                const id = t?.id ? String(t.id) : '';
                const legacyId = t?.legacyId ? String(t.legacyId) : '';
                if (id && type) teamTypeById.set(id, type);
                if (legacyId && type) teamTypeById.set(legacyId, type);
            });

            const workersRes = await listWorkers(getDc());
            const workers = (workersRes as any)?.data?.workers ?? [];
            const workerMetaById = new Map<string, { teamType?: string; payType?: string }>();
            workers.forEach((w: any) => {
                const id = w?.id ? String(w.id) : '';
                const legacyId = w?.legacyId ? String(w.legacyId) : '';
                const teamId = w?.team?.id ? String(w.team.id) : '';
                const teamType = teamId ? teamTypeById.get(teamId) : undefined;
                const payType = w?.payType ? String(w.payType) : undefined;
                if (id) workerMetaById.set(id, { teamType, payType });
                if (legacyId) workerMetaById.set(legacyId, { teamType, payType });
            });

            // 2. Get all reports
            const reportWorkersRes = await listDailyReportWorkers(getDc());
            const rows = (reportWorkersRes as any)?.data?.dailyReportWorkers ?? [];

            for (const rw of rows) {
                try {
                    const existing = rw?.salaryModel;
                    if (typeof existing === 'string' && existing.trim()) continue;

                    const dailyReportId = rw?.dailyReport?.id ? String(rw.dailyReport.id) : '';
                    const workerId = rw?.worker?.id ? String(rw.worker.id) : '';
                    if (!dailyReportId || !workerId) continue;

                    const legacyWorkerId = rw?.legacyWorkerId ? String(rw.legacyWorkerId) : '';
                    const workerLegacyId = rw?.worker?.legacyId ? String(rw.worker.legacyId) : '';
                    const meta = workerMetaById.get(workerId)
                        ?? (workerLegacyId ? workerMetaById.get(workerLegacyId) : undefined)
                        ?? (legacyWorkerId ? workerMetaById.get(legacyWorkerId) : undefined);

                    const teamType = meta?.teamType ? String(meta.teamType) : '';
                    const payType = meta?.payType ? String(meta.payType) : '';

                    let salaryModel = '일급제';
                    if (teamType === '지원팀' || teamType === '용역팀') {
                        salaryModel = teamType;
                    } else if (payType) {
                        salaryModel = payType;
                    }

                    await updateDailyReportWorker(getDc(), {
                        dailyReportId,
                        workerId,
                        salaryModel
                    } as any);

                    updatedCount += 1;
                } catch (e) {
                    errors.push(String(e));
                }
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
                    const dailyReportDcId = await resolveDcDailyReportId(String(report.id));
                    if (dailyReportDcId) {
                        for (const w of updatedWorkers) {
                            const masterWorker = workerMap.get(w.workerId);
                            if (!masterWorker?.teamId) continue;
                            if (masterWorker.teamId === w.teamId) continue;
                            if (!w.workerId || String(w.workerId).startsWith('unknown')) continue;

                            const workerDcId = await (async () => {
                                const raw = String(w.workerId);
                                if (isUuidString(raw)) return raw;
                                await loadDcWorkers();
                                return dcLegacyMaps.workers.get(raw) ?? null;
                            })();
                            if (!workerDcId) continue;

                            try {
                                await updateDailyReportWorker(getDc(), {
                                    dailyReportId: String(dailyReportDcId),
                                    workerId: String(workerDcId),
                                    legacyTeamId: String(masterWorker.teamId)
                                } as any);
                            } catch (e) {
                                errors.push(String(e));
                            }
                        }
                    }
                    batchCount++;
                    updated++;

                    // Commit batch if it reaches the limit
                    if (batchCount >= MAX_BATCH_SIZE) {
                        console.log(`[Migration] Committed batch of ${batchCount} updates`);
                        batchCount = 0;
                    }
                } else {
                    skipped++;
                }
            }

            // Commit remaining
            if (batchCount > 0) {
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
