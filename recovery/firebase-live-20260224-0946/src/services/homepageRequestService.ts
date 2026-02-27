import app from '../config/firebase';
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createSystemConfig, listSystemConfigs, updateSystemConfig } from '../dataconnect-generated';
import { Timestamp } from '../types/timestamp';
import { homepageActivityService } from './homepageActivityService';

export type HomepageRequestType = 'build' | 'modify';
export type HomepageRequestStatus = 'requested' | 'accepted' | 'in_progress' | 'review' | 'completed';
export type HomepageRequestPriority = 'low' | 'medium' | 'high';

export interface HomepageRequest {
    id?: string;
    title: string;
    type: HomepageRequestType;
    status: HomepageRequestStatus;
    priority: HomepageRequestPriority;
    clientName: string;
    clientCompany?: string;
    clientEmail?: string;
    clientPhone?: string;
    description?: string;
    referenceUrl?: string;
    referenceNote?: string;
    assignedStaffId?: string;
    estimateId?: string;
    dueDate?: Timestamp;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
}

export interface CreateHomepageRequestInput {
    title: string;
    type: HomepageRequestType;
    clientName: string;
    clientCompany?: string;
    clientEmail?: string;
    clientPhone?: string;
    description?: string;
    referenceUrl?: string;
    referenceNote?: string;
    priority?: HomepageRequestPriority;
}

export interface ListHomepageRequestOptions {
    status?: HomepageRequestStatus;
    type?: HomepageRequestType;
    assignedStaffId?: string;
}

 type StoredHomepageRequest = Omit<HomepageRequest, 'dueDate' | 'createdAt' | 'updatedAt'> & {
     dueDate?: string | null;
     createdAt?: string | null;
     updatedAt?: string | null;
 };

 const dc = getDataConnect(app, connectorConfig);
 const SYSTEM_CONFIG_ID = 'homepage_requests';

 const generateId = (): string => {
     const c: any = typeof crypto !== 'undefined' ? crypto : undefined;
     if (c && typeof c.randomUUID === 'function') return c.randomUUID();
     return `hr_${Date.now()}_${Math.random().toString(16).slice(2)}`;
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

 const serializeRequest = (r: HomepageRequest): StoredHomepageRequest => {
     const { dueDate, createdAt, updatedAt, ...rest } = r;
     return {
         ...rest,
         dueDate: dueDate ? dueDate.toDate().toISOString() : null,
         createdAt: createdAt ? createdAt.toDate().toISOString() : null,
         updatedAt: updatedAt ? updatedAt.toDate().toISOString() : null
     };
 };

 const deserializeRequest = (r: StoredHomepageRequest): HomepageRequest => {
     return {
         ...r,
         dueDate: toTimestamp(r.dueDate),
         createdAt: toTimestamp(r.createdAt),
         updatedAt: toTimestamp(r.updatedAt)
     };
 };

 const loadAllRequests = async (): Promise<HomepageRequest[]> => {
     const res = await listSystemConfigs(dc);
     const rows = (res as any)?.data?.systemConfigs ?? [];
     const row = Array.isArray(rows) ? rows.find((r: any) => String(r?.id ?? '') === SYSTEM_CONFIG_ID) : null;
     const parsed = safeJsonParse<{ requests?: StoredHomepageRequest[] }>(row?.data, {} as any);
     const list = Array.isArray(parsed?.requests) ? parsed.requests : [];
     return list.map(deserializeRequest);
 };

 const saveAllRequests = async (requests: HomepageRequest[]): Promise<void> => {
     const payload = JSON.stringify({
         requests: requests.map(serializeRequest),
         updatedAt: new Date().toISOString()
     });

     try {
         const upd = await updateSystemConfig(dc, { id: SYSTEM_CONFIG_ID, data: payload } as any);
         const didUpdate = (upd as any)?.data?.systemConfig_update != null;
         if (!didUpdate) {
             await createSystemConfig(dc, { id: SYSTEM_CONFIG_ID, data: payload } as any);
         }
     } catch {
         try {
             await createSystemConfig(dc, { id: SYSTEM_CONFIG_ID, data: payload } as any);
         } catch {
             await updateSystemConfig(dc, { id: SYSTEM_CONFIG_ID, data: payload } as any);
         }
     }
 };

export const homepageRequestService = {
    createRequest: async (input: CreateHomepageRequestInput): Promise<string> => {
        const all = await loadAllRequests();
        const id = generateId();
        const now = Timestamp.now();
        const next: HomepageRequest = {
            id,
            title: input.title,
            type: input.type,
            status: 'requested' as HomepageRequestStatus,
            priority: input.priority ?? 'medium',
            clientName: input.clientName,
            clientCompany: input.clientCompany ?? '',
            clientEmail: input.clientEmail ?? '',
            clientPhone: input.clientPhone ?? '',
            description: input.description ?? '',
            referenceUrl: input.referenceUrl ?? '',
            referenceNote: input.referenceNote ?? '',
            createdAt: now,
            updatedAt: now
        };
        await saveAllRequests([next, ...all]);

        await homepageActivityService.addActivity(id, {
            type: 'status_change',
            message: '요청이 등록되었습니다. (requested)',
            createdBy: 'system',
            createdByName: '시스템'
        });

        return id;
    },

    getRequest: async (id: string): Promise<HomepageRequest | null> => {
        const all = await loadAllRequests();
        return all.find((r) => String(r.id ?? '') === String(id)) ?? null;
    },

    listRequests: async (options?: ListHomepageRequestOptions): Promise<HomepageRequest[]> => {
        const all = await loadAllRequests();
        const filtered = all.filter((r) => {
            if (options?.status && r.status !== options.status) return false;
            if (options?.type && r.type !== options.type) return false;
            if (options?.assignedStaffId && String(r.assignedStaffId ?? '') !== String(options.assignedStaffId)) return false;
            return true;
        });

        filtered.sort((a, b) => {
            const aMs = a.createdAt?.toMillis?.() ?? 0;
            const bMs = b.createdAt?.toMillis?.() ?? 0;
            return bMs - aMs;
        });

        return filtered;
    },

    updateRequest: async (id: string, patch: Partial<Omit<HomepageRequest, 'id'>>): Promise<void> => {
        const all = await loadAllRequests();
        const idx = all.findIndex((r) => String(r.id ?? '') === String(id));
        if (idx < 0) return;
        const existing = all[idx];
        const next: HomepageRequest = {
            ...existing,
            ...patch,
            id: existing.id,
            updatedAt: Timestamp.now()
        };
        const nextAll = [...all];
        nextAll[idx] = next;
        await saveAllRequests(nextAll);
    },

    updateStatus: async (
        id: string,
        status: HomepageRequestStatus,
        actor: { id: string; name: string }
    ): Promise<void> => {
        await homepageRequestService.updateRequest(id, { status } as any);

        await homepageActivityService.addActivity(id, {
            type: 'status_change',
            message: `요청 상태가 '${status}'(으)로 변경되었습니다.`,
            createdBy: actor.id,
            createdByName: actor.name
        });
    },

    assignStaff: async (
        id: string,
        staff: { id: string; name: string }
    ): Promise<void> => {
        await homepageRequestService.updateRequest(id, { assignedStaffId: staff.id } as any);

        await homepageActivityService.addActivity(id, {
            type: 'status_change',
            message: `담당자가 '${staff.name}'(으)로 배정되었습니다.`,
            createdBy: staff.id,
            createdByName: staff.name
        });
    }
};
