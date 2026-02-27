import app from '../config/firebase';
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createSystemConfig, listSystemConfigs, updateSystemConfig } from '../dataconnect-generated';
import { Timestamp } from '../types/timestamp';
import { homepageActivityService } from './homepageActivityService';

export type HomepageChecklistStatus = 'todo' | 'doing' | 'done';

export interface HomepageChecklistItem {
    id?: string;
    requestId: string;
    title: string;
    status: HomepageChecklistStatus;
    order: number;
    assigneeId?: string;
    dueDate?: Timestamp;
    completedAt?: Timestamp;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
}

export interface CreateHomepageChecklistItemInput {
    title: string;
    status?: HomepageChecklistStatus;
    order?: number;
    assigneeId?: string;
    dueDate?: Timestamp;
}

export interface UpdateHomepageChecklistItemInput {
    title?: string;
    status?: HomepageChecklistStatus;
    order?: number;
    assigneeId?: string;
    dueDate?: Timestamp | null;
}

export interface ChecklistProgress {
    total: number;
    done: number;
    percentage: number;
}

type StoredChecklistItem = Omit<HomepageChecklistItem, 'dueDate' | 'completedAt' | 'createdAt' | 'updatedAt'> & {
    dueDate?: string | null;
    completedAt?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
};

const dc = getDataConnect(app, connectorConfig);
const KEY_PREFIX = 'homepage_checklist_';

const generateId = (): string => {
    const c: any = typeof crypto !== 'undefined' ? crypto : undefined;
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
    return `hcl_${Date.now()}_${Math.random().toString(16).slice(2)}`;
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

const serializeItem = (i: HomepageChecklistItem): StoredChecklistItem => {
    const { dueDate, completedAt, createdAt, updatedAt, ...rest } = i;
    return {
        ...rest,
        dueDate: dueDate ? dueDate.toDate().toISOString() : null,
        completedAt: completedAt ? completedAt.toDate().toISOString() : null,
        createdAt: createdAt ? createdAt.toDate().toISOString() : null,
        updatedAt: updatedAt ? updatedAt.toDate().toISOString() : null
    };
};

const deserializeItem = (i: StoredChecklistItem): HomepageChecklistItem => {
    return {
        ...i,
        dueDate: toTimestamp(i.dueDate),
        completedAt: toTimestamp(i.completedAt),
        createdAt: toTimestamp(i.createdAt),
        updatedAt: toTimestamp(i.updatedAt)
    };
};

const loadItems = async (requestId: string): Promise<HomepageChecklistItem[]> => {
    const id = `${KEY_PREFIX}${requestId}`;
    const res = await listSystemConfigs(dc);
    const rows = (res as any)?.data?.systemConfigs ?? [];
    const row = Array.isArray(rows) ? rows.find((r: any) => String(r?.id ?? '') === id) : null;
    const parsed = safeJsonParse<{ items?: StoredChecklistItem[] }>(row?.data, {} as any);
    const list = Array.isArray(parsed?.items) ? parsed.items : [];
    return list.map(deserializeItem);
};

const saveItems = async (requestId: string, items: HomepageChecklistItem[]): Promise<void> => {
    const id = `${KEY_PREFIX}${requestId}`;
    const payload = JSON.stringify({
        items: items.map(serializeItem),
        updatedAt: new Date().toISOString()
    });

    try {
        const upd = await updateSystemConfig(dc, { id, data: payload } as any);
        const didUpdate = (upd as any)?.data?.systemConfig_update != null;
        if (!didUpdate) {
            await createSystemConfig(dc, { id, data: payload } as any);
        }
    } catch {
        try {
            await createSystemConfig(dc, { id, data: payload } as any);
        } catch {
            await updateSystemConfig(dc, { id, data: payload } as any);
        }
    }
};

export const homepageChecklistService = {
    addItem: async (
        requestId: string,
        input: CreateHomepageChecklistItemInput,
        actor: { id: string; name: string }
    ): Promise<string> => {
        let order = input.order;

        if (typeof order !== 'number') {
            const items = await loadItems(requestId);
            const maxOrder = items.reduce((m, it) => (typeof it.order === 'number' && it.order > m ? it.order : m), 0);
            order = maxOrder + 1;
        }

        const status: HomepageChecklistStatus = input.status ?? 'todo';

        const all = await loadItems(requestId);
        const now = Timestamp.now();
        const id = generateId();
        const item: HomepageChecklistItem = {
            id,
            requestId,
            title: input.title,
            status,
            order: order ?? 0,
            assigneeId: input.assigneeId ?? '',
            dueDate: input.dueDate ?? undefined,
            completedAt: status === 'done' ? now : undefined,
            createdAt: now,
            updatedAt: now
        };
        await saveItems(requestId, [...all, item]);

        await homepageActivityService.addActivity(requestId, {
            type: 'checklist',
            message: `체크리스트 항목 "${input.title}" 이(가) 추가되었습니다.`,
            createdBy: actor.id,
            createdByName: actor.name
        });

        return id;
    },

    updateItem: async (
        requestId: string,
        itemId: string,
        patch: UpdateHomepageChecklistItemInput,
        actor: { id: string; name: string }
    ): Promise<void> => {
        const all = await loadItems(requestId);
        const idx = all.findIndex((i) => String(i.id ?? '') === String(itemId));
        if (idx < 0) return;
        const current = all[idx];

        let statusChanged = false;
        let newStatus: HomepageChecklistStatus = current.status;
        if (patch.status) {
            newStatus = patch.status;
            statusChanged = newStatus !== current.status;
        }

        const now = Timestamp.now();
        const { dueDate: dueDatePatch, ...patchRest } = patch;
        const next: HomepageChecklistItem = {
            ...current,
            ...patchRest,
            id: current.id,
            requestId: current.requestId,
            updatedAt: now
        };

        if (dueDatePatch === null) {
            next.dueDate = undefined;
        } else if (dueDatePatch instanceof Timestamp) {
            next.dueDate = dueDatePatch;
        }

        if (patch.status) {
            next.status = newStatus;
            if (newStatus === 'done' && !current.completedAt) {
                next.completedAt = now;
            } else if (newStatus !== 'done' && current.completedAt) {
                next.completedAt = undefined;
            }
        }

        const nextAll = [...all];
        nextAll[idx] = next;
        await saveItems(requestId, nextAll);

        if (statusChanged) {
            await homepageActivityService.addActivity(requestId, {
                type: 'checklist',
                message: `체크리스트 항목 "${current.title}" 상태가 '${newStatus}'(으)로 변경되었습니다.`,
                createdBy: actor.id,
                createdByName: actor.name
            });
        }
    },

    listItems: async (requestId: string): Promise<HomepageChecklistItem[]> => {
        const all = await loadItems(requestId);
        return all.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    },

    getProgress: async (requestId: string): Promise<ChecklistProgress> => {
        const items = await loadItems(requestId);
        const total = items.length;
        const done = items.filter((i) => i.status === 'done').length;
        const percentage = total === 0 ? 0 : Math.round((done / total) * 100);
        return { total, done, percentage };
    }
};
