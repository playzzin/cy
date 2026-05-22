import {
    collection,
    doc,
    getDoc,
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
import { workbookLedgerLogService } from './workbookLedgerLogService';

export type WorkbookTransactionType = '매출' | '매입';
export type WorkbookLedgerTenant = 'cheongyeon' | 'dawon';
export type WorkbookLedgerSourceType =
    | 'taxInvoiceIssue'
    | 'expenseLedger'
    | 'manual'
    | 'manualSettlement';

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
    sourceType?: WorkbookLedgerSourceType | string;
    sourceId?: string;
    sourceMonth?: string;
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

const normalizeTransactionType = (value: unknown): WorkbookTransactionType => {
    return normalizeText(value).includes('매입') ? '매입' : '매출';
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
    transactionType: normalizeTransactionType(entry.transactionType),
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
    sourceType: normalizeText(entry.sourceType) || null,
    sourceId: normalizeText(entry.sourceId) || null,
    sourceMonth: normalizeText(entry.sourceMonth) || null,
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

    if (entry.transactionType !== undefined) payload.transactionType = normalizeTransactionType(entry.transactionType);
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
    if (entry.sourceType !== undefined) payload.sourceType = normalizeText(entry.sourceType) || null;
    if (entry.sourceId !== undefined) payload.sourceId = normalizeText(entry.sourceId) || null;
    if (entry.sourceMonth !== undefined) payload.sourceMonth = normalizeText(entry.sourceMonth) || null;
    if (entry.note !== undefined) payload.note = normalizeText(entry.note);
    if (entry.teamName !== undefined) payload.teamName = normalizeText(entry.teamName);
    if (entry.updatedBy !== undefined) payload.updatedBy = normalizeText(entry.updatedBy) || null;

    return payload;
};

const normalizeStoredEntry = (id: string, data: Record<string, unknown>): WorkbookLedgerEntry => ({
    id,
    transactionType: normalizeTransactionType(data.transactionType),
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
    sourceType: normalizeText(data.sourceType),
    sourceId: normalizeText(data.sourceId),
    sourceMonth: normalizeText(data.sourceMonth),
    note: normalizeFirstText(data.note, data.memo, data.remark, data.remarks, data.notes),
    teamName: normalizeText(data.teamName),
    createdAt: normalizeText(data.createdAt),
    updatedAt: normalizeText(data.updatedAt),
    createdBy: normalizeText(data.createdBy),
    updatedBy: normalizeText(data.updatedBy),
    deletedAt: normalizeText(data.deletedAt),
    deletedBy: normalizeText(data.deletedBy)
});

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

    const getEntrySnapshot = async (id: string): Promise<WorkbookLedgerEntry | null> => {
        const entrySnapshot = await getDoc(doc(collection(db, collectionName), id));
        if (!entrySnapshot.exists()) return null;
        return normalizeStoredEntry(entrySnapshot.id, entrySnapshot.data() as Record<string, unknown>);
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

                return normalizeStoredEntry(entryDoc.id, data);
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

            await Promise.all(
                createdEntries.map((entry) =>
                    workbookLedgerLogService.safeCreateLog({
                        action: 'created',
                        tenantKey,
                        after: entry,
                        source: 'workbookLedgerService.addEntries'
                    })
                )
            );

            return cloneEntries(createdEntries);
        },

        async updateEntry(id: string, updates: WorkbookLedgerEntryUpdate): Promise<void> {
            const now = new Date().toISOString();
            const payload = sanitizeUpdate(updates, now);
            const entryRef = doc(collection(db, collectionName), id);
            const before = await getEntrySnapshot(id);
            await updateDoc(entryRef, payload);
            const after = await getEntrySnapshot(id);

            clearCachedEntries();

            await workbookLedgerLogService.safeCreateLog({
                action: 'updated',
                tenantKey,
                before,
                after,
                source: 'workbookLedgerService.updateEntry'
            });
        },

        async softDeleteEntry(id: string, deletedBy?: string): Promise<void> {
            const now = new Date().toISOString();
            const entryRef = doc(collection(db, collectionName), id);
            const before = await getEntrySnapshot(id);
            const deletePayload = {
                deletedAt: now,
                deletedBy: normalizeText(deletedBy) || null,
                updatedAt: now
            };
            await updateDoc(entryRef, deletePayload);

            clearCachedEntries();

            await workbookLedgerLogService.safeCreateLog({
                action: 'deleted',
                tenantKey,
                before,
                after: before ? {
                    ...before,
                    deletedAt: now,
                    deletedBy: normalizeText(deletedBy),
                    updatedAt: now
                } : null,
                source: 'workbookLedgerService.softDeleteEntry'
            });
        },

        async softDeleteEntries(ids: string[], deletedBy?: string): Promise<number> {
            const normalizedIds = Array.from(new Set(
                ids
                    .map((id) => normalizeText(id))
                    .filter((id) => id.length > 0)
            ));

            if (normalizedIds.length === 0) return 0;

            const beforeEntries = new Map(
                await Promise.all(
                    normalizedIds.map(async (id) => [id, await getEntrySnapshot(id)] as const)
                )
            );
            const now = new Date().toISOString();
            const deletePayload = {
                deletedAt: now,
                deletedBy: normalizeText(deletedBy) || null,
                updatedAt: now
            };
            for (let index = 0; index < normalizedIds.length; index += BATCH_SIZE) {
                const batch = writeBatch(db);
                const chunk = normalizedIds.slice(index, index + BATCH_SIZE);

                chunk.forEach((id) => {
                    batch.update(doc(collection(db, collectionName), id), deletePayload);
                });

                await batch.commit();
            }

            clearCachedEntries();

            await Promise.all(
                normalizedIds.map((id) => {
                    const before = beforeEntries.get(id);
                    return workbookLedgerLogService.safeCreateLog({
                        action: 'deleted',
                        tenantKey,
                        before,
                        after: before ? {
                            ...before,
                            deletedAt: now,
                            deletedBy: normalizeText(deletedBy),
                            updatedAt: now
                        } : null,
                        source: 'workbookLedgerService.softDeleteEntries'
                    });
                })
            );

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
