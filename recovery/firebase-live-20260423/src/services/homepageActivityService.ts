import { createSystemConfig, listSystemConfigs, updateSystemConfig } from '../services/firestoreCrudCompat';
import { Timestamp } from '../types/timestamp';

export type HomepageActivityType = 'status_change' | 'estimate' | 'checklist' | 'comment';

export interface HomepageActivity {
    id?: string;
    requestId: string;
    type: HomepageActivityType;
    message: string;
    createdBy: string; // uid or name key
    createdByName?: string;
    createdAt?: Timestamp;
}

type StoredHomepageActivity = Omit<HomepageActivity, 'createdAt'> & { createdAt?: string | null };

const KEY_PREFIX = 'homepage_activities_';

const generateId = (): string => {
    const c: any = typeof crypto !== 'undefined' ? crypto : undefined;
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
    return `ha_${Date.now()}_${Math.random().toString(16).slice(2)}`;
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

const loadActivities = async (requestId: string): Promise<HomepageActivity[]> => {
    const id = `${KEY_PREFIX}${requestId}`;
    const res = await listSystemConfigs();
    const rows = (res as any)?.data?.systemConfigs ?? [];
    const row = Array.isArray(rows) ? rows.find((r: any) => String(r?.id ?? '') === id) : null;
    const parsed = safeJsonParse<{ activities?: StoredHomepageActivity[] }>(row?.data, {} as any);
    const list = Array.isArray(parsed?.activities) ? parsed.activities : [];
    return list.map((a) => ({
        ...a,
        createdAt: toTimestamp(a.createdAt)
    }));
};

const saveActivities = async (requestId: string, activities: HomepageActivity[]): Promise<void> => {
    const id = `${KEY_PREFIX}${requestId}`;
    const payload = JSON.stringify({
        activities: activities.map((a) => ({
            ...a,
            createdAt: a.createdAt ? a.createdAt.toDate().toISOString() : null
        })),
        updatedAt: new Date().toISOString()
    });

    try {
        const upd = await updateSystemConfig({ id, data: payload } as any);
        const didUpdate = (upd as any)?.data?.systemConfig_update != null;
        if (!didUpdate) {
            await createSystemConfig({ id, data: payload } as any);
        }
    } catch {
        try {
            await createSystemConfig({ id, data: payload } as any);
        } catch {
            await updateSystemConfig({ id, data: payload } as any);
        }
    }
};

export const homepageActivityService = {
    addActivity: async (
        requestId: string,
        activity: Omit<HomepageActivity, 'id' | 'requestId' | 'createdAt'>
    ): Promise<string> => {
        const all = await loadActivities(requestId);
        const id = generateId();
        const next: HomepageActivity = {
            id,
            requestId,
            ...activity,
            createdAt: Timestamp.now()
        };
        await saveActivities(requestId, [next, ...all]);
        return id;
    },

    getActivities: async (requestId: string): Promise<HomepageActivity[]> => {
        const all = await loadActivities(requestId);
        return all.sort((a, b) => {
            const aMs = a.createdAt?.toMillis?.() ?? 0;
            const bMs = b.createdAt?.toMillis?.() ?? 0;
            return bMs - aMs;
        });
    }
};

