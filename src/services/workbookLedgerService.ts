import {
    collection,
    doc,
    getDocs,
    limit as firestoreLimit,
    orderBy,
    query,
    type QueryConstraint,
    updateDoc,
    where,
    writeBatch
} from 'firebase/firestore';
import { db } from '../config/firebase';

export type WorkbookTransactionType = '매출' | '매입';
export type WorkbookLedgerTenant = 'cheongyeon' | 'dawon';

export interface WorkbookLedgerEntry {
    id?: string;
    transactionType: WorkbookTransactionType;
    date: string;
    partnerName: string;
    siteName: string;
    description: string;
    manDays?: number | null;
    supplyAmount: number;
    taxAmount: number;
    totalAmount: number;
    paymentAmount: number;
    appliedYear?: number | null;
    appliedMonth?: number | null;
    matchedEntryId?: string;
    note?: string;
    teamName?: string;
    createdAt?: string;
    updatedAt?: string;
    createdBy?: string;
    updatedBy?: string;
    deletedAt?: string;
    deletedBy?: string;
}

type WorkbookLedgerEntryInput = Omit<WorkbookLedgerEntry, 'createdAt' | 'updatedAt'>;
type WorkbookLedgerEntryUpdate = Partial<Omit<WorkbookLedgerEntry, 'id' | 'createdAt' | 'createdBy' | 'deletedAt' | 'deletedBy'>>;
type GetEntriesOptions = {
    force?: boolean;
    startDate?: string;
    endDate?: string;
    limitCount?: number;
    orderDirection?: 'asc' | 'desc';
};

const DEFAULT_COLLECTION_NAME = 'sales_purchase_workbook_entries';
const TENANT_COLLECTIONS: Record<WorkbookLedgerTenant, string> = {
    cheongyeon: DEFAULT_COLLECTION_NAME,
    dawon: 'sales_purchase_workbook_entries_dawon'
};
const BATCH_SIZE = 400;

const resolveCollectionName = (tenantKey: WorkbookLedgerTenant | string): string => {
    const mapped = TENANT_COLLECTIONS[tenantKey as WorkbookLedgerTenant];
    if (mapped) return mapped;
    const normalized = tenantKey.trim().toLowerCase();
    return normalized ? `${DEFAULT_COLLECTION_NAME}_${normalized}` : DEFAULT_COLLECTION_NAME;
};

const normalizeNumber = (value: unknown): number => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const parsed = Number(value.replace(/,/g, '').trim());
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
};

const normalizeInteger = (value: unknown): number | null => {
    const parsed = normalizeNumber(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : null;
};

const normalizeText = (value: unknown): string => {
    return typeof value === 'string' ? value.trim() : '';
};

const normalizeFirstText = (...values: unknown[]): string => {
    for (const value of values) {
        const normalized = normalizeText(value);
        if (normalized) return normalized;
    }
    return '';
};

const sortEntries = (left: WorkbookLedgerEntry, right: WorkbookLedgerEntry) => {
    const dateCompare = (left.date ?? '').localeCompare(right.date ?? '', 'en');
    if (dateCompare !== 0) return dateCompare;

    const createdCompare = (left.createdAt ?? '').localeCompare(right.createdAt ?? '', 'en');
    if (createdCompare !== 0) return createdCompare;

    return (left.id ?? '').localeCompare(right.id ?? '', 'en');
};

const cloneEntry = (entry: WorkbookLedgerEntry): WorkbookLedgerEntry => ({ ...entry });
const cloneEntries = (entries: WorkbookLedgerEntry[]) => entries.map(cloneEntry);

const normalizeLimit = (value: unknown): number | null => {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return Math.trunc(parsed);
};

const buildCacheKey = (options: GetEntriesOptions) => {
    const startDate = normalizeText(options.startDate);
    const endDate = normalizeText(options.endDate);
    const limitCount = normalizeLimit(options.limitCount);
    const orderDirection = options.orderDirection === 'desc' ? 'desc' : 'asc';

    return [
        startDate ? `start:${startDate}` : 'start:',
        endDate ? `end:${endDate}` : 'end:',
        limitCount ? `limit:${limitCount}` : 'limit:',
        `order:${orderDirection}`
    ].join('|');
};

const sanitizeEntry = (entry: WorkbookLedgerEntryInput, timestamp: string) => ({
    transactionType: entry.transactionType,
    date: normalizeText(entry.date),
    partnerName: normalizeText(entry.partnerName),
    siteName: normalizeText(entry.siteName),
    description: normalizeText(entry.description),
    manDays: entry.manDays === null || entry.manDays === undefined ? null : normalizeNumber(entry.manDays),
    supplyAmount: normalizeNumber(entry.supplyAmount),
    taxAmount: normalizeNumber(entry.taxAmount),
    totalAmount: normalizeNumber(entry.totalAmount),
    paymentAmount: normalizeNumber(entry.paymentAmount),
    appliedYear: normalizeInteger(entry.appliedYear),
    appliedMonth: normalizeInteger(entry.appliedMonth),
    matchedEntryId: normalizeText(entry.matchedEntryId) || null,
    note: normalizeText(entry.note),
    teamName: normalizeText(entry.teamName),
    createdBy: normalizeText(entry.createdBy) || null,
    updatedBy: normalizeText(entry.updatedBy) || null,
    createdAt: timestamp,
    updatedAt: timestamp
});

const sanitizeUpdate = (entry: WorkbookLedgerEntryUpdate, timestamp: string) => {
    const payload: Record<string, unknown> = {
        updatedAt: timestamp
    };

    if (entry.transactionType !== undefined) payload.transactionType = entry.transactionType;
    if (entry.date !== undefined) payload.date = normalizeText(entry.date);
    if (entry.partnerName !== undefined) payload.partnerName = normalizeText(entry.partnerName);
    if (entry.siteName !== undefined) payload.siteName = normalizeText(entry.siteName);
    if (entry.description !== undefined) payload.description = normalizeText(entry.description);
    if (entry.manDays !== undefined) payload.manDays = entry.manDays === null ? null : normalizeNumber(entry.manDays);
    if (entry.supplyAmount !== undefined) payload.supplyAmount = normalizeNumber(entry.supplyAmount);
    if (entry.taxAmount !== undefined) payload.taxAmount = normalizeNumber(entry.taxAmount);
    if (entry.totalAmount !== undefined) payload.totalAmount = normalizeNumber(entry.totalAmount);
    if (entry.paymentAmount !== undefined) payload.paymentAmount = normalizeNumber(entry.paymentAmount);
    if (entry.appliedYear !== undefined) payload.appliedYear = entry.appliedYear === null ? null : normalizeInteger(entry.appliedYear);
    if (entry.appliedMonth !== undefined) payload.appliedMonth = entry.appliedMonth === null ? null : normalizeInteger(entry.appliedMonth);
    if (entry.matchedEntryId !== undefined) payload.matchedEntryId = normalizeText(entry.matchedEntryId) || null;
    if (entry.note !== undefined) payload.note = normalizeText(entry.note);
    if (entry.teamName !== undefined) payload.teamName = normalizeText(entry.teamName);
    if (entry.updatedBy !== undefined) payload.updatedBy = normalizeText(entry.updatedBy) || null;

    return payload;
};

export interface WorkbookLedgerService {
    getEntries(options?: GetEntriesOptions): Promise<WorkbookLedgerEntry[]>;
    addEntries(entries: WorkbookLedgerEntryInput[]): Promise<WorkbookLedgerEntry[]>;
    updateEntry(id: string, updates: WorkbookLedgerEntryUpdate): Promise<void>;
    softDeleteEntry(id: string, deletedBy?: string): Promise<void>;
    softDeleteEntries(ids: string[], deletedBy?: string): Promise<number>;
    softDeleteAllEntries(deletedBy?: string): Promise<number>;
    invalidateCache(): void;
}

export const createWorkbookLedgerService = (tenantKey: WorkbookLedgerTenant | string = 'cheongyeon'): WorkbookLedgerService => {
    const collectionName = resolveCollectionName(tenantKey);
    const cachedEntriesByQuery = new Map<string, WorkbookLedgerEntry[]>();

    const setCachedEntries = (cacheKey: string, entries: WorkbookLedgerEntry[]) => {
        cachedEntriesByQuery.set(cacheKey, cloneEntries(entries).sort(sortEntries));
    };

    const clearCachedEntries = () => {
        cachedEntriesByQuery.clear();
    };

    const getEntriesCollectionQuery = (options: GetEntriesOptions = {}) => {
        const constraints: QueryConstraint[] = [];
        const startDate = normalizeText(options.startDate);
        const endDate = normalizeText(options.endDate);
        const limitCount = normalizeLimit(options.limitCount);
        const orderDirection = options.orderDirection === 'desc' ? 'desc' : 'asc';

        if (startDate) {
            constraints.push(where('date', '>=', startDate));
        }

        if (endDate) {
            constraints.push(where('date', '<=', endDate));
        }

        if (startDate || endDate || limitCount) {
            constraints.push(orderBy('date', orderDirection));
        }

        if (limitCount) {
            constraints.push(firestoreLimit(limitCount));
        }

        const entriesCollection = collection(db, collectionName);
        return constraints.length > 0 ? query(entriesCollection, ...constraints) : entriesCollection;
    };

    const service: WorkbookLedgerService = {
        async getEntries(options: GetEntriesOptions = {}): Promise<WorkbookLedgerEntry[]> {
            const cacheKey = buildCacheKey(options);
            const cachedEntries = cachedEntriesByQuery.get(cacheKey);
            if (!options.force && cachedEntries) {
                return cloneEntries(cachedEntries);
            }

            if (options.force) {
                clearCachedEntries();
            }

            const snapshot = await getDocs(getEntriesCollectionQuery(options));
            const entries = snapshot.docs.map((entryDoc) => {
                const data = entryDoc.data() as Record<string, unknown>;
                const deletedAt = normalizeText(data.deletedAt);

                if (deletedAt) return null;

                return {
                    id: entryDoc.id,
                    transactionType: (data.transactionType === '매입' ? '매입' : '매출') as WorkbookTransactionType,
                    date: normalizeText(data.date),
                    partnerName: normalizeText(data.partnerName),
                    siteName: normalizeText(data.siteName),
                    description: normalizeText(data.description),
                    manDays: data.manDays === null || data.manDays === undefined ? null : normalizeNumber(data.manDays),
                    supplyAmount: normalizeNumber(data.supplyAmount),
                    taxAmount: normalizeNumber(data.taxAmount),
                    totalAmount: normalizeNumber(data.totalAmount),
                    paymentAmount: normalizeNumber(data.paymentAmount),
                    appliedYear: normalizeInteger(data.appliedYear),
                    appliedMonth: normalizeInteger(data.appliedMonth),
                    matchedEntryId: normalizeText(data.matchedEntryId),
                    note: normalizeFirstText(data.note, data.memo, data.remark, data.remarks, data.notes),
                    teamName: normalizeText(data.teamName),
                    createdAt: normalizeText(data.createdAt),
                    updatedAt: normalizeText(data.updatedAt),
                    createdBy: normalizeText(data.createdBy),
                    updatedBy: normalizeText(data.updatedBy),
                    deletedAt,
                    deletedBy: normalizeText(data.deletedBy)
                } as WorkbookLedgerEntry;
            }).filter((entry): entry is WorkbookLedgerEntry => entry !== null);

            setCachedEntries(cacheKey, entries);
            return cloneEntries(entries);
        },

        async addEntries(entries: WorkbookLedgerEntryInput[]): Promise<WorkbookLedgerEntry[]> {
            if (entries.length === 0) return [];

            const now = new Date().toISOString();
            const createdEntries: WorkbookLedgerEntry[] = [];

            for (let index = 0; index < entries.length; index += BATCH_SIZE) {
                const batch = writeBatch(db);
                const chunk = entries.slice(index, index + BATCH_SIZE);

                chunk.forEach((entry) => {
                    const entryRef = entry.id
                        ? doc(collection(db, collectionName), entry.id)
                        : doc(collection(db, collectionName));
                    const payload = sanitizeEntry(entry, now);
                    batch.set(entryRef, payload);
                    createdEntries.push({
                        id: entryRef.id,
                        ...(payload as Omit<WorkbookLedgerEntry, 'id'>)
                    });
                });

                await batch.commit();
            }

            clearCachedEntries();

            return cloneEntries(createdEntries);
        },

        async updateEntry(id: string, updates: WorkbookLedgerEntryUpdate): Promise<void> {
            const now = new Date().toISOString();
            const payload = sanitizeUpdate(updates, now);
            await updateDoc(doc(collection(db, collectionName), id), payload);

            clearCachedEntries();
        },

        async softDeleteEntry(id: string, deletedBy?: string): Promise<void> {
            const now = new Date().toISOString();
            await updateDoc(doc(collection(db, collectionName), id), {
                deletedAt: now,
                deletedBy: normalizeText(deletedBy) || null,
                updatedAt: now
            });

            clearCachedEntries();
        },

        async softDeleteEntries(ids: string[], deletedBy?: string): Promise<number> {
            const normalizedIds = Array.from(new Set(
                ids
                    .map((id) => normalizeText(id))
                    .filter((id) => id.length > 0)
            ));

            if (normalizedIds.length === 0) return 0;

            const now = new Date().toISOString();
            for (let index = 0; index < normalizedIds.length; index += BATCH_SIZE) {
                const batch = writeBatch(db);
                const chunk = normalizedIds.slice(index, index + BATCH_SIZE);

                chunk.forEach((id) => {
                    batch.update(doc(collection(db, collectionName), id), {
                        deletedAt: now,
                        deletedBy: normalizeText(deletedBy) || null,
                        updatedAt: now
                    });
                });

                await batch.commit();
            }

            clearCachedEntries();

            return normalizedIds.length;
        },

        async softDeleteAllEntries(deletedBy?: string): Promise<number> {
            const snapshot = await getDocs(collection(db, collectionName));
            const activeEntryIds = snapshot.docs
                .filter((entryDoc) => {
                    const data = entryDoc.data() as Record<string, unknown>;
                    return !normalizeText(data.deletedAt);
                })
                .map((entryDoc) => entryDoc.id);

            if (activeEntryIds.length === 0) {
                clearCachedEntries();
                return 0;
            }

            return service.softDeleteEntries(activeEntryIds, deletedBy);
        },

        invalidateCache(): void {
            clearCachedEntries();
        }
    };

    return service;
};

export const workbookLedgerService = createWorkbookLedgerService('cheongyeon');
