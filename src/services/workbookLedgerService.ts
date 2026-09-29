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
import { normalizeWorkbookNumber } from '../utils/workbookLedgerParsing';
import { workbookLedgerLogService } from './workbookLedgerLogService';
import { getWorkbookNumericIssues } from '../utils/workbookLedgerValidation';

export type WorkbookTransactionType = '매출' | '매입';
export type WorkbookLedgerTenant = 'cheongyeon' | 'dawon';
export type WorkbookLedgerSourceType =
    | 'taxInvoiceIssue'
    | 'expenseLedger'
    | 'manual'
    | 'manualSettlement'
    | 'advanceUsage';

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
    importedFromId?: string;
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
export class WorkbookLedgerBatchError extends Error {
    constructor(public committedEntries: WorkbookLedgerEntry[], public pendingEntries: WorkbookLedgerEntryInput[]) {
        super(`${committedEntries.length}건 저장 완료, ${pendingEntries.length}건 저장을 완료하지 못했습니다. 남은 항목만 재시도해 주세요.`);
        this.name = 'WorkbookLedgerBatchError';
        Object.setPrototypeOf(this, WorkbookLedgerBatchError.prototype);
    }
}

const validateNumericValues = (entry: WorkbookLedgerEntryUpdate) => {
    const issues = getWorkbookNumericIssues(entry);
    if (issues.length) throw new Error(issues.map((issue) => issue.message).join(' '));
};
type GetEntriesOptions = {
    force?: boolean;
    startDate?: string;
    endDate?: string;
    transactionType?: WorkbookTransactionType;
    limitCount?: number;
    orderDirection?: 'asc' | 'desc';
};

const DEFAULT_COLLECTION_NAME = 'sales_purchase_workbook_entries';
const TENANT_COLLECTIONS: Record<WorkbookLedgerTenant, string> = {
    cheongyeon: DEFAULT_COLLECTION_NAME,
    dawon: 'sales_purchase_workbook_entries_dawon'
};
const BATCH_SIZE = 400;
const MAX_CACHED_ENTRY_QUERIES = 8;

const resolveCollectionName = (tenantKey: WorkbookLedgerTenant | string): string => {
    const mapped = TENANT_COLLECTIONS[tenantKey as WorkbookLedgerTenant];
    if (mapped) return mapped;
    const normalized = tenantKey.trim().toLowerCase();
    return normalized ? `${DEFAULT_COLLECTION_NAME}_${normalized}` : DEFAULT_COLLECTION_NAME;
};

const normalizeNumber = (value: unknown): number => {
    return normalizeWorkbookNumber(value, 0);
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
    const transactionType = normalizeText(options.transactionType);
    const limitCount = normalizeLimit(options.limitCount);
    const orderDirection = options.orderDirection === 'desc' ? 'desc' : 'asc';

    return [
        startDate ? `start:${startDate}` : 'start:',
        endDate ? `end:${endDate}` : 'end:',
        transactionType ? `type:${transactionType}` : 'type:',
        limitCount ? `limit:${limitCount}` : 'limit:',
        `order:${orderDirection}`
    ].join('|');
};

const isMissingFirestoreIndexError = (error: unknown): boolean => {
    const code = typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code?: unknown }).code ?? '')
        : '';
    const message = error instanceof Error ? error.message : String(error ?? '');

    return code === 'failed-precondition' && message.toLowerCase().includes('index');
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
    importedFromId: normalizeText(entry.importedFromId) || null,
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
    importedFromId: normalizeText(data.importedFromId),
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
    createEntryId(): string;
    getEntries(options?: GetEntriesOptions): Promise<WorkbookLedgerEntry[]>;
    getLinkedEntries(matchedEntryId: string): Promise<WorkbookLedgerEntry[]>;
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
    const pendingEntriesByQuery = new Map<string, Promise<WorkbookLedgerEntry[]>>();
    let cacheGeneration = 0;

    const setCachedEntries = (cacheKey: string, entries: WorkbookLedgerEntry[]) => {
        cachedEntriesByQuery.delete(cacheKey);
        cachedEntriesByQuery.set(cacheKey, entries);

        while (cachedEntriesByQuery.size > MAX_CACHED_ENTRY_QUERIES) {
            const oldestCacheKey = cachedEntriesByQuery.keys().next().value;
            if (!oldestCacheKey) break;
            cachedEntriesByQuery.delete(oldestCacheKey);
        }
    };

    const clearCachedEntries = () => {
        cacheGeneration += 1;
        cachedEntriesByQuery.clear();
        pendingEntriesByQuery.clear();
    };

    const sortEntriesForOptions = (entries: WorkbookLedgerEntry[], options: GetEntriesOptions) => {
        const direction = options.orderDirection === 'desc' ? -1 : 1;
        return entries.slice().sort((left, right) => direction * sortEntries(left, right));
    };

    const getEntriesCollectionQuery = (
        options: GetEntriesOptions = {},
        omitTransactionType = false,
        omitLimit = false
    ) => {
        const constraints: QueryConstraint[] = [];
        const startDate = normalizeText(options.startDate);
        const endDate = normalizeText(options.endDate);
        const transactionType = normalizeText(options.transactionType);
        const limitCount = normalizeLimit(options.limitCount);
        const orderDirection = options.orderDirection === 'desc' ? 'desc' : 'asc';

        if (transactionType && !omitTransactionType) {
            constraints.push(where('transactionType', '==', transactionType));
        }

        if (startDate) {
            constraints.push(where('date', '>=', startDate));
        }

        if (endDate) {
            constraints.push(where('date', '<=', endDate));
        }

        if (startDate || endDate || limitCount) {
            constraints.push(orderBy('date', orderDirection));
        }

        if (limitCount && !omitLimit) {
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

    const assertNoDependents = async (ids: string[]) => {
        const selected = new Set(ids);
        const candidates = ids.length > 1
            ? await service.getEntries({ force: true })
            : (await Promise.all(['matchedEntryId', 'sourceId'].map(async (field) => {
                const snapshot = await getDocs(query(collection(db, collectionName), where(field, '==', ids[0])));
                return snapshot.docs.map((entryDoc) => normalizeStoredEntry(entryDoc.id, entryDoc.data()));
            }))).flat();
        if (candidates.some((entry) => !entry.deletedAt && !selected.has(entry.id ?? '') && (
            selected.has(entry.matchedEntryId ?? '')
            || (entry.sourceType === 'advanceUsage' && selected.has(entry.sourceId ?? ''))
        ))) {
            throw new Error('조회 범위 밖을 포함해 연결된 입금·취소·선수금 사용 이력이 남아 있습니다. 연결 이력을 먼저 확인해 주세요.');
        }
    };

    const service: WorkbookLedgerService = {
        createEntryId: () => doc(collection(db, collectionName)).id,
        async getEntries(options: GetEntriesOptions = {}): Promise<WorkbookLedgerEntry[]> {
            const cacheKey = buildCacheKey(options);
            if (options.force) {
                clearCachedEntries();
            } else {
                const cachedEntries = cachedEntriesByQuery.get(cacheKey);
                if (cachedEntries) {
                    cachedEntriesByQuery.delete(cacheKey);
                    cachedEntriesByQuery.set(cacheKey, cachedEntries);
                    return cloneEntries(cachedEntries);
                }

                const pendingEntries = pendingEntriesByQuery.get(cacheKey);
                if (pendingEntries) {
                    return cloneEntries(await pendingEntries);
                }
            }

            const requestCacheGeneration = cacheGeneration;
            const loadEntries = (async () => {
                const transactionType = normalizeText(options.transactionType);
                const limitCount = normalizeLimit(options.limitCount);
                let snapshot;

                try {
                    snapshot = await getDocs(getEntriesCollectionQuery(options));
                } catch (error) {
                    if (!transactionType || !isMissingFirestoreIndexError(error)) {
                        throw error;
                    }

                    console.warn(
                        `[workbookLedgerService] Missing Firestore index for ${collectionName} transactionType/date query. Falling back to client-side transactionType filtering.`
                    );
                    snapshot = await getDocs(getEntriesCollectionQuery(options, true, true));
                }

                const entries = snapshot.docs.map((entryDoc) => {
                    const data = entryDoc.data() as Record<string, unknown>;
                    const deletedAt = normalizeText(data.deletedAt);

                    if (deletedAt) return null;

                    return normalizeStoredEntry(entryDoc.id, data);
                })
                    .filter((entry): entry is WorkbookLedgerEntry => entry !== null)
                    .filter((entry) => !transactionType || entry.transactionType === transactionType);

                const sortedEntries = sortEntriesForOptions(entries, options);
                const limitedEntries = limitCount ? sortedEntries.slice(0, limitCount) : sortedEntries;

                if (requestCacheGeneration === cacheGeneration) {
                    setCachedEntries(cacheKey, limitedEntries);
                }
                return limitedEntries;
            })();

            pendingEntriesByQuery.set(cacheKey, loadEntries);

            try {
                return cloneEntries(await loadEntries);
            } finally {
                if (pendingEntriesByQuery.get(cacheKey) === loadEntries) {
                    pendingEntriesByQuery.delete(cacheKey);
                }
            }
        },

        async getLinkedEntries(matchedEntryId: string): Promise<WorkbookLedgerEntry[]> {
            const normalizedMatchedEntryId = normalizeText(matchedEntryId);
            if (!normalizedMatchedEntryId) return [];

            const entriesCollection = collection(db, collectionName);
            const snapshot = await getDocs(query(
                entriesCollection,
                where('matchedEntryId', '==', normalizedMatchedEntryId)
            ));

            return snapshot.docs
                .map((entryDoc) => {
                    const data = entryDoc.data() as Record<string, unknown>;
                    if (normalizeText(data.deletedAt)) return null;
                    return normalizeStoredEntry(entryDoc.id, data);
                })
                .filter((entry): entry is WorkbookLedgerEntry => entry !== null)
                .sort(sortEntries);
        },

        async addEntries(entries: WorkbookLedgerEntryInput[]): Promise<WorkbookLedgerEntry[]> {
            if (entries.length === 0) return [];
            entries.forEach(validateNumericValues);
            const prepared = entries.map((entry) => ({ ...entry, id: entry.id || service.createEntryId() }));
            // Commit invoices before linked settlements even when an uploaded file lists payments first.
            prepared.sort((left, right) => Number(right.totalAmount > 0) - Number(left.totalAmount > 0));
            const now = new Date().toISOString();
            const createdEntries: WorkbookLedgerEntry[] = [];

            for (let index = 0; index < prepared.length; index += BATCH_SIZE) {
                const batch = writeBatch(db);
                const chunk = prepared.slice(index, index + BATCH_SIZE);
                const chunkEntries: WorkbookLedgerEntry[] = [];

                chunk.forEach((entry) => {
                    const entryRef = entry.id
                        ? doc(collection(db, collectionName), entry.id)
                        : doc(collection(db, collectionName));
                    const payload = sanitizeEntry(entry, now);
                    batch.set(entryRef, payload);
                    chunkEntries.push({
                        id: entryRef.id,
                        ...(payload as Omit<WorkbookLedgerEntry, 'id'>)
                    });
                });

                try {
                    await batch.commit();
                } catch (error) {
                    clearCachedEntries();
                    throw new WorkbookLedgerBatchError(cloneEntries(createdEntries), prepared.slice(index));
                }
                createdEntries.push(...chunkEntries);
                clearCachedEntries();
                await Promise.all(chunkEntries.map((entry) =>
                    workbookLedgerLogService.safeCreateLog({
                        action: 'created',
                        tenantKey,
                        after: entry,
                        source: 'workbookLedgerService.addEntries'
                    })
                ));
            }

            return cloneEntries(createdEntries);
        },

        async updateEntry(id: string, updates: WorkbookLedgerEntryUpdate): Promise<void> {
            validateNumericValues(updates);
            const now = new Date().toISOString();
            const payload = sanitizeUpdate(updates, now);
            const entryRef = doc(collection(db, collectionName), id);
            const before = await getEntrySnapshot(id);
            if (before && before.totalAmount > 0 && (
                (updates.transactionType !== undefined && updates.transactionType !== before.transactionType)
                || (updates.totalAmount !== undefined && updates.totalAmount <= 0)
            )) {
                await assertNoDependents([id]);
            }
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
            await assertNoDependents([id]);
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
            let normalizedIds = Array.from(new Set(
                ids
                    .map((id) => normalizeText(id))
                    .filter((id) => id.length > 0)
            ));

            if (normalizedIds.length === 0) return 0;
            await assertNoDependents(normalizedIds);

            const beforeEntries = new Map(
                await Promise.all(
                    normalizedIds.map(async (id) => [id, await getEntrySnapshot(id)] as const)
                )
            );
            // Remove dependents first, so a later failed chunk cannot leave a live payment without its invoice.
            normalizedIds = normalizedIds.filter((id) => {
                const entry = beforeEntries.get(id);
                return entry && !entry.deletedAt;
            }).sort((left, right) => {
                const priority = (id: string) => {
                    const entry = beforeEntries.get(id)!;
                    return entry.sourceType === 'advanceUsage' ? 0 : entry.totalAmount > 0 ? 2 : 1;
                };
                return priority(left) - priority(right);
            });
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

                try {
                    await batch.commit();
                } catch (error) {
                    clearCachedEntries();
                    throw new Error(`${index}건 삭제 완료, ${normalizedIds.length - index}건 미완료입니다. 새로고침 후 남은 항목을 확인해 주세요.`);
                }
                clearCachedEntries();
                await Promise.all(chunk.map((id) => {
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
                }));
            }

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
