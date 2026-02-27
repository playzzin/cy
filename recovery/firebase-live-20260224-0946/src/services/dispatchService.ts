import app from '../config/firebase';
import { getDataConnect } from 'firebase/data-connect';
import {
    connectorConfig,
    createDailyDispatch,
    updateDailyDispatch,
    deleteDailyDispatch,
    listAllDailyDispatches
} from './dataconnectCompat';
import { Timestamp } from '../types/timestamp';

export interface DispatchAssignment {
    siteId: string;
    siteName: string;
    workerIds: string[]; // Assigned workers
    vehicleIds: string[]; // Assigned vehicles
    note?: string;
}

export interface DailyDispatch {
    id?: string; // date string (YYYY-MM-DD)
    date: string;
    assignments: DispatchAssignment[];
    updatedAt: Timestamp;
}

const dc = getDataConnect(app, connectorConfig);

const parseAssignments = (raw: unknown): DispatchAssignment[] => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw as DispatchAssignment[];
    if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? (parsed as DispatchAssignment[]) : [];
        } catch {
            return [];
        }
    }
    return [];
};

const toTimestamp = (value: unknown): Timestamp => {
    if (!value) return Timestamp.now();
    if (value instanceof Timestamp) return value;
    if (typeof value === 'string') {
        const d = new Date(value);
        if (!Number.isNaN(d.getTime())) return Timestamp.fromDate(d);
    }
    return Timestamp.now();
};

export const dispatchService = {
    // List all dispatch plans
    getAllDispatches: async (): Promise<DailyDispatch[]> => {
        try {
            const res = await listAllDailyDispatches(dc);
            const rows = (res as any)?.data?.dailyDispatches ?? [];
            const mapped = rows.map((row: any) => ({
                id: String(row.id),
                date: String(row.date),
                assignments: parseAssignments(row.assignments),
                updatedAt: toTimestamp(row.updatedAt)
            } as DailyDispatch));
            mapped.sort((a: DailyDispatch, b: DailyDispatch) => (b.date ?? '').localeCompare(a.date ?? '', 'en'));
            return mapped;
        } catch (e) {
            console.error(e);
            return [];
        }
    },

    // Get dispatch plan for a specific date
    getDispatchByDate: async (date: string): Promise<DailyDispatch | null> => {
        try {
            const res = await listAllDailyDispatches(dc, { limit: 5000, offset: 0 } as any);
            const rows = (res as any)?.data?.dailyDispatches ?? [];
            const row = Array.isArray(rows)
                ? rows.find((r: any) => String(r?.id ?? '') === String(date) || String(r?.date ?? '') === String(date))
                : null;
            if (!row) return null;
            return {
                id: String(row.id),
                date: String(row.date),
                assignments: parseAssignments(row.assignments),
                updatedAt: toTimestamp(row.updatedAt)
            } as DailyDispatch;
        } catch (e) {
            console.error(e);
            return null;
        }
    },

    // Save dispatch plan
    saveDispatch: async (date: string, assignments: DispatchAssignment[]): Promise<void> => {
        const assignmentsStr = JSON.stringify(assignments ?? []);
        const updatedAt = Timestamp.now().toDate().toISOString();

        const existing = await dispatchService.getDispatchByDate(date);
        if (existing) {
            await updateDailyDispatch(dc, {
                id: date,
                date,
                assignments: assignmentsStr,
                updatedAt
            });
            return;
        }

        await createDailyDispatch(dc, {
            id: date,
            date,
            assignments: assignmentsStr,
            updatedAt
        });
    },

    // Copy dispatch plan from one date to another
    copyDispatch: async (fromDate: string, toDate: string): Promise<void> => {
        const source = await dispatchService.getDispatchByDate(fromDate);
        if (source) {
            await dispatchService.saveDispatch(toDate, source.assignments);
        }
    },

    deleteDispatch: async (id: string): Promise<void> => {
        await deleteDailyDispatch(dc, { id: String(id) });
    },

    deleteDispatches: async (ids: string[]): Promise<void> => {
        const batchSize = 50;
        for (let i = 0; i < ids.length; i += batchSize) {
            const chunk = ids.slice(i, i + batchSize);
            await Promise.all(chunk.map((id) => dispatchService.deleteDispatch(id)));
        }
    }
};
