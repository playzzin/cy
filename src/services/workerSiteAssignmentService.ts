import { createSystemConfig, listSystemConfigs, updateSystemConfig } from './firestoreCrudCompat';
import { Timestamp } from '../types/timestamp';
import { toast } from '../utils/swal';

export interface WorkerSiteAssignment {
    id?: string;
    workerId: string;
    workerName?: string;
    siteId: string;
    siteName?: string;
    teamId?: string;
    teamName?: string;
    companyId?: string;
    companyName?: string;
    isPrimary?: boolean;
    status?: 'active' | 'ended';
    startDate?: string;
    endDate?: string;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
}

const SYSTEM_CONFIG_ID = 'worker_site_assignments';

type StoredWorkerSiteAssignment = Omit<WorkerSiteAssignment, 'createdAt' | 'updatedAt'> & {
    createdAt?: string | null;
    updatedAt?: string | null;
};

const generateId = (): string => {
    const c: any = typeof crypto !== 'undefined' ? crypto : undefined;
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
    return `wsa_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

const safeJsonParse = <T>(value: unknown, fallback: T): T => {
    if (typeof value !== 'string') return fallback;
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    try {
        return JSON.parse(trimmed) as T;
    } catch {
        return fallback;
    }
};

const toTimestamp = (value?: string | null): Timestamp | undefined => {
    if (!value) return undefined;
    const d = new Date(String(value));
    if (Number.isNaN(d.getTime())) return undefined;
    return Timestamp.fromDate(d);
};

const serializeAssignment = (a: WorkerSiteAssignment): StoredWorkerSiteAssignment => {
    return {
        ...a,
        createdAt: a.createdAt ? a.createdAt.toDate().toISOString() : null,
        updatedAt: a.updatedAt ? a.updatedAt.toDate().toISOString() : null
    };
};

const deserializeAssignment = (a: StoredWorkerSiteAssignment): WorkerSiteAssignment => {
    return {
        ...a,
        createdAt: toTimestamp(a.createdAt),
        updatedAt: toTimestamp(a.updatedAt)
    };
};

const loadAllAssignments = async (): Promise<WorkerSiteAssignment[]> => {
    const response = await listSystemConfigs();
    const rows = (response as any)?.data?.systemConfigs ?? [];
    const row = Array.isArray(rows) ? rows.find((r: any) => String(r?.id ?? '') === SYSTEM_CONFIG_ID) : null;
    const parsed = safeJsonParse<{ assignments?: StoredWorkerSiteAssignment[] }>(row?.data, {} as any);
    const list = Array.isArray(parsed?.assignments) ? parsed.assignments : [];
    return list.map(deserializeAssignment);
};

const saveAllAssignments = async (assignments: WorkerSiteAssignment[]): Promise<void> => {
    const payload = JSON.stringify({
        assignments: assignments.map(serializeAssignment),
        updatedAt: new Date().toISOString()
    });

    try {
        const res = await updateSystemConfig({ id: SYSTEM_CONFIG_ID, data: payload } as any);
        const didUpdate = (res as any)?.data?.systemConfig_update != null;
        if (!didUpdate) {
            await createSystemConfig({ id: SYSTEM_CONFIG_ID, data: payload } as any);
        }
    } catch {
        try {
            await createSystemConfig({ id: SYSTEM_CONFIG_ID, data: payload } as any);
        } catch {
            await updateSystemConfig({ id: SYSTEM_CONFIG_ID, data: payload } as any);
        }
    }
};

const toMillis = (ts?: Timestamp): number => (ts ? ts.toMillis() : 0);

const isActiveAssignment = (assignment: WorkerSiteAssignment): boolean => {
    const status = assignment.status || 'active';
    return status === 'active';
};

export const workerSiteAssignmentService = {
    addAssignment: async (assignment: Omit<WorkerSiteAssignment, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
        const now = Timestamp.now();
        const id = generateId();

        const all = await loadAllAssignments();
        const next: WorkerSiteAssignment = {
            ...assignment,
            id,
            status: assignment.status || 'active',
            createdAt: now,
            updatedAt: now
        };

        await saveAllAssignments([...all, next]);
        toast.saved('?꾩옣 諛곗젙', 1);

        if (assignment.isPrimary) {
            await workerSiteAssignmentService.setPrimaryAssignment(assignment.workerId, id);
        } else {
            await workerSiteAssignmentService.syncWorkerPrimarySite(assignment.workerId);
        }
        return id;
    },

    updateAssignment: async (id: string, updates: Partial<WorkerSiteAssignment>): Promise<void> => {
        const all = await loadAllAssignments();
        const idx = all.findIndex((a) => String(a.id ?? '') === String(id));
        if (idx < 0) throw new Error('Assignment not found');

        const existing = all[idx];
        const workerId = (updates.workerId ?? existing.workerId) ? String(updates.workerId ?? existing.workerId) : '';

        const next: WorkerSiteAssignment = {
            ...existing,
            ...updates,
            id: existing.id,
            updatedAt: Timestamp.now()
        };

        const nextAll = [...all];
        nextAll[idx] = next;
        await saveAllAssignments(nextAll);

        toast.updated('?꾩옣 諛곗젙');

        if (workerId) {
            if (updates.isPrimary === true) {
                await workerSiteAssignmentService.setPrimaryAssignment(workerId, id);
            } else {
                await workerSiteAssignmentService.syncWorkerPrimarySite(workerId);
            }
        }
    },

    deleteAssignment: async (id: string): Promise<void> => {
        const all = await loadAllAssignments();
        const existing = all.find((a) => String(a.id ?? '') === String(id)) || null;
        const workerId = existing?.workerId ? String(existing.workerId) : undefined;

        const nextAll = all.filter((a) => String(a.id ?? '') !== String(id));
        await saveAllAssignments(nextAll);
        toast.deleted('?꾩옣 諛곗젙', 1);

        if (workerId) {
            await workerSiteAssignmentService.syncWorkerPrimarySite(workerId);
        }
    },

    getAssignmentsByWorker: async (workerId: string): Promise<WorkerSiteAssignment[]> => {
        const all = await loadAllAssignments();
        return all
            .filter((a) => String(a.workerId) === String(workerId))
            .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
    },

    getAllAssignments: async (): Promise<WorkerSiteAssignment[]> => {
        const all = await loadAllAssignments();
        return all.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
    },

    setPrimaryAssignment: async (workerId: string, assignmentId: string): Promise<void> => {
        const assignments = await workerSiteAssignmentService.getAssignmentsByWorker(workerId);

        if (assignments.length === 0) {
            await workerSiteAssignmentService.syncWorkerPrimarySite(workerId);
            return;
        }

        const all = await loadAllAssignments();
        const now = Timestamp.now();

        const nextAll = all.map((a) => {
            if (String(a.workerId) !== String(workerId)) return a;
            if (!a.id) return a;
            if (String(a.id) === String(assignmentId) || a.isPrimary) {
                return {
                    ...a,
                    isPrimary: String(a.id) === String(assignmentId),
                    updatedAt: now
                };
            }
            return a;
        });

        await saveAllAssignments(nextAll);
        await workerSiteAssignmentService.syncWorkerPrimarySite(workerId);
    },

    getActiveAssignmentsByWorker: async (workerId: string): Promise<WorkerSiteAssignment[]> => {
        const assignments = await workerSiteAssignmentService.getAssignmentsByWorker(workerId);
        return assignments.filter(isActiveAssignment);
    },

    getAssignmentsBySite: async (siteId: string): Promise<WorkerSiteAssignment[]> => {
        const all = await loadAllAssignments();
        return all
            .filter((a: WorkerSiteAssignment) => String(a.siteId) === String(siteId))
            .sort((a: WorkerSiteAssignment, b: WorkerSiteAssignment) => toMillis(b.createdAt) - toMillis(a.createdAt));
    },

    getActiveAssignmentsBySite: async (siteId: string): Promise<WorkerSiteAssignment[]> => {
        const assignments = await workerSiteAssignmentService.getAssignmentsBySite(siteId);
        return assignments.filter(isActiveAssignment);
    },

    syncWorkerPrimarySite: async (workerId: string): Promise<void> => {
        const { manpowerService } = await import('./manpowerService');
        const worker = await manpowerService.getWorker(workerId);

        const currentSiteId = worker?.siteId || '';
        const currentSiteName = worker?.siteName || '';

        const activeAssignments = await workerSiteAssignmentService.getActiveAssignmentsByWorker(workerId);

        const explicitPrimary = activeAssignments.find(a => a.isPrimary) || null;
        const primary = explicitPrimary || activeAssignments[0] || null;

        const siteId = primary?.siteId || '';
        const siteName =
            primary?.siteName ||
            (primary?.siteId && primary.siteId === currentSiteId ? currentSiteName : '');

        await manpowerService.updateWorker(workerId, {
            siteId,
            siteName
        });
    }
};

