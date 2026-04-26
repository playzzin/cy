import { createSystemConfig, listSystemConfigs, updateSystemConfig } from '../services/firestoreCrudCompat';
import { Timestamp } from '../types/timestamp';
import { homepageActivityService } from './homepageActivityService';

export type HomepageEstimateStatus = 'draft' | 'sent' | 'approved' | 'rejected';

export interface HomepageEstimateItem {
    id: string;
    label: string;
    description?: string;
    category?: string;
    unitPrice: number;
    quantity: number;
    amount: number;
    isOptional?: boolean;
}

export interface HomepageEstimate {
    id?: string;
    requestId: string;
    version: number;
    status: HomepageEstimateStatus;
    items: HomepageEstimateItem[];
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    notes?: string;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
}

export interface HomepageEstimateItemInput {
    label: string;
    description?: string;
    category?: string;
    unitPrice: number;
    quantity: number;
    isOptional?: boolean;
}

export interface CreateHomepageEstimateInput {
    requestId: string;
    status?: HomepageEstimateStatus;
    items: HomepageEstimateItemInput[];
    discount?: number;
    tax?: number;
    notes?: string;
}

export interface UpdateHomepageEstimateInput {
    status?: HomepageEstimateStatus;
    items?: HomepageEstimateItemInput[];
    discount?: number;
    tax?: number;
    notes?: string;
}

type StoredHomepageEstimate = Omit<HomepageEstimate, 'createdAt' | 'updatedAt'> & {
    createdAt?: string | null;
    updatedAt?: string | null;
};

const SYSTEM_CONFIG_ID = 'homepage_estimates';

const generateId = (): string => {
    const c: any = typeof crypto !== 'undefined' ? crypto : undefined;
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
    return `he_${Date.now()}_${Math.random().toString(16).slice(2)}`;
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

const serializeEstimate = (e: HomepageEstimate): StoredHomepageEstimate => {
    const { createdAt, updatedAt, ...rest } = e;
    return {
        ...rest,
        createdAt: createdAt ? createdAt.toDate().toISOString() : null,
        updatedAt: updatedAt ? updatedAt.toDate().toISOString() : null
    };
};

const deserializeEstimate = (e: StoredHomepageEstimate): HomepageEstimate => {
    return {
        ...e,
        createdAt: toTimestamp(e.createdAt),
        updatedAt: toTimestamp(e.updatedAt)
    };
};

const loadAllEstimates = async (): Promise<HomepageEstimate[]> => {
    const res = await listSystemConfigs();
    const rows = (res as any)?.data?.systemConfigs ?? [];
    const row = Array.isArray(rows) ? rows.find((r: any) => String(r?.id ?? '') === SYSTEM_CONFIG_ID) : null;
    const parsed = safeJsonParse<{ estimates?: StoredHomepageEstimate[] }>(row?.data, {} as any);
    const list = Array.isArray(parsed?.estimates) ? parsed.estimates : [];
    return list.map(deserializeEstimate);
};

const saveAllEstimates = async (estimates: HomepageEstimate[]): Promise<void> => {
    const payload = JSON.stringify({
        estimates: estimates.map(serializeEstimate),
        updatedAt: new Date().toISOString()
    });

    try {
        const upd = await updateSystemConfig({ id: SYSTEM_CONFIG_ID, data: payload } as any);
        const didUpdate = (upd as any)?.data?.systemConfig_update != null;
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

const generateItemId = (): string => {
    return `item-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
};

const buildItems = (inputs: HomepageEstimateItemInput[]): { items: HomepageEstimateItem[]; subtotal: number } => {
    let subtotal = 0;
    const items: HomepageEstimateItem[] = inputs.map((input) => {
        const unitPrice = Number.isNaN(input.unitPrice) ? 0 : input.unitPrice;
        const quantity = Number.isNaN(input.quantity) ? 0 : input.quantity;
        const amount = unitPrice * quantity;
        subtotal += amount;
        return {
            id: generateItemId(),
            label: input.label,
            description: input.description,
            category: input.category,
            unitPrice,
            quantity,
            amount,
            isOptional: input.isOptional
        };
    });
    return { items, subtotal };
};

const calculateTotals = (
    subtotal: number,
    discountInput?: number,
    taxInput?: number
): { discount: number; tax: number; total: number } => {
    const discount = typeof discountInput === 'number' ? discountInput : 0;
    const tax = typeof taxInput === 'number' ? taxInput : 0;
    const total = subtotal - discount + tax;
    return { discount, tax, total };
};

export const homepageEstimateService = {
    createEstimate: async (
        input: CreateHomepageEstimateInput,
        actor: { id: string; name: string }
    ): Promise<string> => {
        const all = await loadAllEstimates();
        const related = all.filter((e) => String(e.requestId) === String(input.requestId));
        let maxVersion = 0;
        related.forEach((e) => {
            if (typeof e.version === 'number' && e.version > maxVersion) maxVersion = e.version;
        });
        const newVersion = maxVersion + 1;

        const { items, subtotal } = buildItems(input.items);
        const { discount, tax, total } = calculateTotals(subtotal, input.discount, input.tax);

        const id = generateId();
        const now = Timestamp.now();
        const next: HomepageEstimate = {
            id,
            requestId: input.requestId,
            version: newVersion,
            status: input.status ?? 'draft',
            items,
            subtotal,
            discount,
            tax,
            total,
            notes: input.notes ?? '',
            createdAt: now,
            updatedAt: now
        };

        await saveAllEstimates([next, ...all]);

        await homepageActivityService.addActivity(input.requestId, {
            type: 'estimate',
            message: `寃ъ쟻 v${newVersion} ??媛) ?앹꽦?섏뿀?듬땲??`,
            createdBy: actor.id,
            createdByName: actor.name
        });

        return id;
    },

    getEstimate: async (id: string): Promise<HomepageEstimate | null> => {
        const all = await loadAllEstimates();
        return all.find((e) => String(e.id ?? '') === String(id)) ?? null;
    },

    listEstimatesByRequest: async (requestId: string): Promise<HomepageEstimate[]> => {
        const all = await loadAllEstimates();
        const filtered = all.filter((e) => String(e.requestId) === String(requestId));
        filtered.sort((a, b) => (b.version ?? 0) - (a.version ?? 0));
        return filtered;
    },

    updateEstimate: async (
        id: string,
        patch: UpdateHomepageEstimateInput,
        actor: { id: string; name: string }
    ): Promise<void> => {
        const all = await loadAllEstimates();
        const idx = all.findIndex((e) => String(e.id ?? '') === String(id));
        if (idx < 0) return;

        const current = all[idx];

        let items = current.items;
        let subtotal = current.subtotal;

        if (patch.items) {
            const built = buildItems(patch.items);
            items = built.items;
            subtotal = built.subtotal;
        }

        const { discount, tax, total } = calculateTotals(
            subtotal,
            patch.discount ?? current.discount,
            patch.tax ?? current.tax
        );

        const status = patch.status ?? current.status;
        const notes = patch.notes ?? current.notes ?? '';

        const next: HomepageEstimate = {
            ...current,
            status,
            items,
            subtotal,
            discount,
            tax,
            total,
            notes,
            updatedAt: Timestamp.now()
        };

        const nextAll = [...all];
        nextAll[idx] = next;
        await saveAllEstimates(nextAll);

        await homepageActivityService.addActivity(current.requestId, {
            type: 'estimate',
            message: `寃ъ쟻 v${current.version} ??媛) ?섏젙?섏뿀?듬땲??`,
            createdBy: actor.id,
            createdByName: actor.name
        });
    }
};

