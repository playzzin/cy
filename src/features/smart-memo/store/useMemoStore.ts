import { create } from 'zustand';
import {
    addDoc,
    collection,
    deleteDoc,
    deleteField,
    doc,
    getDocs,
    onSnapshot,
    query,
    serverTimestamp,
    updateDoc,
    where,
    writeBatch,
    setDoc
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { Timestamp } from '../../../types/timestamp';
import { v4 as uuidv4 } from 'uuid';
import { Memo, Category, MemoState } from '../types/memo';

const MEMO_COLLECTION = 'smart_memos';
const CATEGORY_COLLECTION = 'smart_memo_categories';
let activeMemoBackend: 'firestore' = 'firestore';
const memoAliasToUuid = new Map<string, string>();
const categoryAliasToUuid = new Map<string, string>();

type ListAllSmartMemoCategoriesVariables = {
    limit?: number;
    offset?: number;
};

type ListAllSmartMemosVariables = {
    limit?: number;
    offset?: number;
};

const LIST_ALL_CATEGORIES_FALLBACK_VARS: ListAllSmartMemoCategoriesVariables = {
    limit: 5000,
    offset: 0
};
const LIST_ALL_MEMOS_FALLBACK_VARS: ListAllSmartMemosVariables = {
    limit: 5000,
    offset: 0
};

const paginateRows = <T>(rows: T[], vars?: { limit?: number; offset?: number }): T[] => {
    const offset = typeof vars?.offset === 'number' ? vars.offset : 0;
    const limit = typeof vars?.limit === 'number' ? vars.limit : rows.length;
    return rows.slice(offset, offset + limit);
};

const readCollectionRows = async (collectionName: string): Promise<any[]> => {
    const snapshot = await getDocs(collection(db, collectionName));
    return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
};

const listAllSmartMemos = async (vars: ListAllSmartMemosVariables = LIST_ALL_MEMOS_FALLBACK_VARS): Promise<any> => {
    const rows = await readCollectionRows(MEMO_COLLECTION);
    return { data: { smartMemos: paginateRows(rows, vars) } };
};

const listAllSmartMemoCategories = async (vars: ListAllSmartMemoCategoriesVariables = LIST_ALL_CATEGORIES_FALLBACK_VARS): Promise<any> => {
    const rows = await readCollectionRows(CATEGORY_COLLECTION);
    return { data: { smartMemoCategories: paginateRows(rows, vars) } };
};

const buildMutationPayload = (vars: Record<string, unknown>): Record<string, unknown> => {
    const payload = stripUndefined({ ...vars }) as Record<string, unknown>;
    delete payload.id;
    return payload;
};

const createSmartMemo = async (vars: Record<string, unknown>): Promise<any> => {
    const ref = doc(collection(db, MEMO_COLLECTION));
    await setDoc(ref, buildMutationPayload({
        ...vars,
        createdAt: vars.createdAt ?? new Date().toISOString(),
        updatedAt: vars.updatedAt ?? new Date().toISOString()
    }), { merge: true });
    return { data: { smartMemo_insert: { id: ref.id } } };
};

const updateSmartMemo = async (vars: Record<string, unknown>): Promise<any> => {
    const id = typeof vars.id === 'string' ? vars.id.trim() : '';
    if (!id) throw new Error('Memo id is required');
    await setDoc(doc(db, MEMO_COLLECTION, id), buildMutationPayload({
        ...vars,
        updatedAt: vars.updatedAt ?? new Date().toISOString()
    }), { merge: true });
    return { data: { smartMemo_update: { id } } };
};

const deleteSmartMemo = async (vars: Record<string, unknown>): Promise<any> => {
    const id = typeof vars.id === 'string' ? vars.id.trim() : '';
    if (!id) throw new Error('Memo id is required');
    await deleteDoc(doc(db, MEMO_COLLECTION, id));
    return { data: { smartMemo_delete: { id } } };
};

const createSmartMemoCategory = async (vars: Record<string, unknown>): Promise<any> => {
    const ref = doc(collection(db, CATEGORY_COLLECTION));
    await setDoc(ref, buildMutationPayload({
        ...vars,
        createdAt: vars.createdAt ?? new Date().toISOString(),
        updatedAt: vars.updatedAt ?? new Date().toISOString()
    }), { merge: true });
    return { data: { smartMemoCategory_insert: { id: ref.id } } };
};

const updateSmartMemoCategory = async (vars: Record<string, unknown>): Promise<any> => {
    const id = typeof vars.id === 'string' ? vars.id.trim() : '';
    if (!id) throw new Error('Category id is required');
    await setDoc(doc(db, CATEGORY_COLLECTION, id), buildMutationPayload({
        ...vars,
        updatedAt: vars.updatedAt ?? new Date().toISOString()
    }), { merge: true });
    return { data: { smartMemoCategory_update: { id } } };
};

const deleteSmartMemoCategory = async (vars: Record<string, unknown>): Promise<any> => {
    const id = typeof vars.id === 'string' ? vars.id.trim() : '';
    if (!id) throw new Error('Category id is required');
    await deleteDoc(doc(db, CATEGORY_COLLECTION, id));
    return { data: { smartMemoCategory_delete: { id } } };
};

const getRows = <T = any>(response: unknown, key: string): T[] => {
    const rows = (response as any)?.data?.[key];
    return Array.isArray(rows) ? rows : [];
};

const listSmartMemosRows = async (_allowLegacyFallback: boolean = true): Promise<any[]> => {
    const legacy = await listAllSmartMemos(LIST_ALL_MEMOS_FALLBACK_VARS);
    return getRows(legacy, 'smartMemos');
};

const listSmartMemoCategoriesRows = async (_allowLegacyFallback: boolean = true): Promise<any[]> => {
    const legacy = await listAllSmartMemoCategories(LIST_ALL_CATEGORIES_FALLBACK_VARS);
    return getRows(legacy, 'smartMemoCategories');
};

const isUuidString = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const toTimestamp = (value: unknown): Timestamp | null => {
    if (!value) return null;
    if (value instanceof Timestamp) return value;
    if (typeof (value as any)?.toMillis === 'function') {
        try {
            return Timestamp.fromMillis((value as any).toMillis());
        } catch {
            return null;
        }
    }
    if (typeof (value as any)?.toDate === 'function') {
        try {
            return Timestamp.fromDate((value as any).toDate());
        } catch {
            return null;
        }
    }
    if (typeof value === 'string') {
        const d = new Date(value);
        if (!Number.isNaN(d.getTime())) return Timestamp.fromDate(d);
        return null;
    }
    return null;
};

const safeJsonParse = <T>(raw: unknown): T | null => {
    if (typeof raw !== 'string') return null;
    try {
        return JSON.parse(raw) as T;
    } catch {
        return null;
    }
};

const normalizeMemoErrorMessage = (error: unknown): string => {
    const raw = error instanceof Error ? error.message : String(error);
    const prefix = 'Backend error while performing request:';
    const index = raw.indexOf(prefix);
    if (index < 0) return raw;

    const jsonPart = raw.slice(index + prefix.length).trim();
    const parsed = safeJsonParse<unknown>(jsonPart);
    if (!Array.isArray(parsed) || parsed.length === 0) return raw;

    const first = parsed[0];
    if (!first || typeof first !== 'object') return raw;

    const record = first as Record<string, unknown>;
    const message = typeof record.message === 'string' ? record.message : raw;
    const path = Array.isArray(record.path)
        ? record.path.filter((p): p is string => typeof p === 'string').join('.')
        : '';

    return path ? `${path}: ${message}` : message;
};

const generateLegacyId = (prefix: string): string => {
    return `${prefix}_${uuidv4().replace(/-/g, '')}`;
};

const resolveSmartMemoUuid = async (legacyOrUuid: string): Promise<string | null> => {
    const v = String(legacyOrUuid);
    if (isUuidString(v)) return v;
    const cached = memoAliasToUuid.get(v);
    if (cached) return cached;
    const rows = await listSmartMemosRows();
    const found = rows.find((r: any) => String(r?.legacyId ?? '') === v);
    if (found?.id) {
        memoAliasToUuid.set(v, String(found.id));
        return String(found.id);
    }
    return found?.id ? String(found.id) : null;
};

const resolveSmartMemoCategoryUuid = async (legacyOrUuid: string): Promise<string | null> => {
    const v = String(legacyOrUuid);
    if (isUuidString(v)) return v;
    const cached = categoryAliasToUuid.get(v);
    if (cached) return cached;
    try {
        const rows = await listSmartMemoCategoriesRows();
        const found = rows.find((r: any) => String(r?.legacyId ?? '') === v);
        if (found?.id) {
            categoryAliasToUuid.set(v, String(found.id));
            return String(found.id);
        }
        return found?.id ? String(found.id) : null;
    } catch {
        try {
            const rows = await listSmartMemoCategoriesRows();
            const found = rows.find((r: any) => String(r?.legacyId ?? '') === v);
            if (found?.id) {
                categoryAliasToUuid.set(v, String(found.id));
                return String(found.id);
            }
            return found?.id ? String(found.id) : null;
        } catch {
            return null;
        }
    }
};

const stripUndefined = <T extends Record<string, any>>(obj: T): Partial<T> => {
    const result: Record<string, any> = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const value = obj[key];
            if (value !== undefined) {
                result[key] = value;
            }
        }
    }
    return result as Partial<T>;
};

const generateId = (): string => {
    const c: any = typeof crypto !== 'undefined' ? crypto : undefined;
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
    return uuidv4();
};

const getMillisSafe = (val: any): number => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    if (typeof val?.toMillis === 'function') return val.toMillis();
    return Date.now();
};

const mapRowToMemo = (row: any): Memo => {
    const legacyId = row?.legacyId ? String(row.legacyId) : null;
    const uuid = row?.id ? String(row.id) : '';
    if (uuid) {
        memoAliasToUuid.set(uuid, uuid);
        if (legacyId) memoAliasToUuid.set(legacyId, uuid);
    }
    const id = legacyId ?? uuid;

    const scopeRaw = typeof row?.scope === 'string' ? row.scope : null;
    const scope: Memo['scope'] = scopeRaw === 'public' ? 'public' : 'private';

    const typeRaw = typeof row?.type === 'string' ? row.type : 'text';
    const type: any = typeRaw === 'checklist' ? 'checklist' : 'text';

    const checklistParsed = safeJsonParse<any[]>(row?.checklistItems);
    const checklistItems = Array.isArray(checklistParsed) ? checklistParsed : [];

    const tagsParsed = safeJsonParse<any[]>(row?.tags);
    const tags = Array.isArray(tagsParsed) ? tagsParsed : undefined;

    const categoryIdRaw =
        (row?.categoryLegacyId ? String(row.categoryLegacyId) : null) ??
        (row?.category?.legacyId ? String(row.category.legacyId) : null) ??
        (row?.category?.id ? String(row.category.id) : null);

    return {
        id,
        userId: String(row?.userId ?? ''),
        scope,
        type,
        title: String(row?.title ?? ''),
        content: row?.content ? String(row.content) : '',
        checklistItems,
        color: (row?.color ? String(row.color) : 'white') as any,
        order: typeof row?.order === 'number' ? row.order : 0,
        isPinned: !!row?.isPinned,
        tags,
        categoryId: categoryIdRaw,
        priority: (row?.priority ?? undefined) as any,
        x: typeof row?.x === 'number' ? row.x : 0,
        y: typeof row?.y === 'number' ? row.y : 0,
        w: typeof row?.w === 'number' ? row.w : 4,
        h: typeof row?.h === 'number' ? row.h : 4,
        isCollapsed: !!row?.isCollapsed,
        prevW: typeof row?.prevW === 'number' ? row.prevW : undefined,
        prevH: typeof row?.prevH === 'number' ? row.prevH : undefined,
        createdAt: toTimestamp(row?.createdAt),
        updatedAt: toTimestamp(row?.updatedAt)
    } as Memo;
};

const mapRowToCategory = (row: any): Category => {
    const legacyId = row?.legacyId ? String(row.legacyId) : null;
    const uuid = row?.id ? String(row.id) : '';
    if (uuid) {
        categoryAliasToUuid.set(uuid, uuid);
        if (legacyId) categoryAliasToUuid.set(legacyId, uuid);
    }
    const id = legacyId ?? uuid;
    return {
        id,
        userId: String(row?.userId ?? ''),
        name: String(row?.name ?? ''),
        color: typeof row?.color === 'string' ? row.color : undefined,
        icon: typeof row?.icon === 'string' ? row.icon : undefined,
        order: typeof row?.order === 'number' ? row.order : 0,
        createdAt: toTimestamp(row?.createdAt)
    } as Category;
};

const listSmartMemoUuidMap = async (): Promise<Map<string, string>> => {
    const rows = await listSmartMemosRows();
    const map = new Map<string, string>();
    rows.forEach((r: any) => {
        const uuid = r?.id ? String(r.id) : '';
        if (!uuid) return;
        map.set(uuid, uuid);
        memoAliasToUuid.set(uuid, uuid);
        if (r?.legacyId) {
            const legacy = String(r.legacyId);
            map.set(legacy, uuid);
            memoAliasToUuid.set(legacy, uuid);
        }
    });
    return map;
};

export const useMemoStore = create<MemoState>((set, get) => ({
    memos: [],
    categories: [],
    isLoading: false,
    error: null,
    unsubscribeMemos: null,
    unsubscribeCategories: null,
    expandedMemos: {},
    isGlobalExpanded: true,
    pendingMemoUpdates: {},
    commentDrafts: {},
    recentLocalUpdates: {},

    // Initial State
    sortMode: 'manual',
    sortConfig: { field: 'createdAt', direction: 'desc' },
    filters: { colorFilter: null, typeFilter: null, onlyFavorites: false },
    activeSpace: null,
    searchQuery: '',
    selectedMemoId: null,

    layoutVersion: 0,

    setSearchQuery: (query) => set({ searchQuery: query }),
    setSortMode: (mode) => set({ sortMode: mode }), // Legacy support

    // New Actions Implementation
    setFilters: (newFilters) => set((state) => ({
        filters: { ...state.filters, ...newFilters }
    })),
    setSortConfig: (config) => set({ sortConfig: config }),
    setActiveSpace: (spaceId) => set({ activeSpace: spaceId }),
    setSelectedMemoId: (id) => set({ selectedMemoId: id }),

    toggleMemoExpanded: (id) => {
        set((state) => {
            const current = state.expandedMemos[id] ?? state.isGlobalExpanded;
            return {
                expandedMemos: {
                    ...state.expandedMemos,
                    [id]: !current
                }
            };
        });
    },

    setAllExpanded: (expanded) => {
        set((state) => {
            const newExpandedMap: Record<string, boolean> = {};
            state.memos.forEach(memo => {
                newExpandedMap[memo.id] = expanded;
            });
            return {
                expandedMemos: newExpandedMap,
                isGlobalExpanded: expanded
            };
        });
    },

    subscribeMemos: (userRef: string | { uid?: string | null; email?: string | null }) => {
        const state = get();

        if (state.unsubscribeMemos) {
            state.unsubscribeMemos();
        }
        if (state.unsubscribeCategories) {
            state.unsubscribeCategories();
        }

        const uid = typeof userRef === 'string'
            ? String(userRef ?? '').trim()
            : String(userRef?.uid ?? '').trim();
        const email = typeof userRef === 'string'
            ? ''
            : String(userRef?.email ?? '').trim().toLowerCase();

        const userKeys = new Set<string>();
        if (uid) userKeys.add(uid);
        if (email) userKeys.add(email);

        const matchesUser = (value: unknown): boolean => {
            const raw = String(value ?? '').trim();
            if (!raw) return false;
            if (userKeys.has(raw)) return true;
            const lowered = raw.toLowerCase();
            return userKeys.has(lowered);
        };

        if (userKeys.size === 0) {
            set({ error: "User ID is required for subscription" });
            return () => { };
        }

        activeMemoBackend = 'firestore';
        set({ isLoading: true });

        // Internal buffers for merge
        let privateMemos: Memo[] = [];
        let publicMemos: Memo[] = [];

        let categoriesBackoffMs = 0;
        let categoriesNextFetchAt = 0;
        let lastReportedError: string | null = null;
        let lastReportedErrorAt = 0;

        const updateMergedState = () => {
            // Merge: Private + Public
            const memoMap = new Map<string, Memo>();
            const currentMemos = get().memos;
            const pending = get().pendingMemoUpdates || {};

            // Helper to preserve local state if pending update exists
            const mergeMemo = (m: Memo) => {
                const local = currentMemos.find(cm => cm.id === m.id);

                // 1. Pending updates always win (Optimistic UI)
                if (pending[m.id] && local) {
                    memoMap.set(m.id, local);
                    return;
                }

                if (local) {
                    const localTime = getMillisSafe(local.updatedAt);
                    const serverTime = getMillisSafe(m.updatedAt);

                    // 2. Grace Period: Trust local if updated recently (fixes clock skew invalidating optimistic updates)
                    const recentUpdates = get().recentLocalUpdates || {};
                    const lastLocalUpdate = recentUpdates[m.id] || 0;
                    const isRecentlyUpdated = (Date.now() - lastLocalUpdate) < 5000; // 5s grace buffer

                    if (isRecentlyUpdated) {
                        memoMap.set(m.id, local);
                        return;
                    }

                    // 3. Last Write Wins: If local is newer than server, keep local
                    if (localTime > serverTime) {
                        memoMap.set(m.id, local);
                        return;
                    }
                }

                // 4. Otherwise, use server data
                memoMap.set(m.id, m);
            };

            // Add private first
            privateMemos.forEach(mergeMemo);
            // Add public (overwrite if exists)
            publicMemos.forEach(mergeMemo);

            const merged = Array.from(memoMap.values());

            // Client-side sorting
            merged.sort((a, b) => {
                const pinnedA = a.isPinned ? 1 : 0;
                const pinnedB = b.isPinned ? 1 : 0;
                if (pinnedA !== pinnedB) return pinnedB - pinnedA;

                if (a.order !== undefined && b.order !== undefined) {
                    return a.order - b.order;
                }
                const dateA = getMillisSafe(a.updatedAt);
                const dateB = getMillisSafe(b.updatedAt);
                return dateB - dateA;
            });

            set({ memos: merged, isLoading: false });
        };

        let pollTimer: ReturnType<typeof setInterval> | null = null;
        let firestoreMemosUnsub: (() => void) | null = null;
        let firestoreMemosEmailUnsub: (() => void) | null = null;
        let firestorePublicMemosUnsub: (() => void) | null = null;
        let firestoreCategoriesUnsub: (() => void) | null = null;
        let firestoreCategoriesEmailUnsub: (() => void) | null = null;
        let usingFirestoreFallback = false;

        const stopFirestore = () => {
            if (firestoreMemosUnsub) {
                firestoreMemosUnsub();
                firestoreMemosUnsub = null;
            }
            if (firestoreMemosEmailUnsub) {
                firestoreMemosEmailUnsub();
                firestoreMemosEmailUnsub = null;
            }
            if (firestorePublicMemosUnsub) {
                firestorePublicMemosUnsub();
                firestorePublicMemosUnsub = null;
            }
            if (firestoreCategoriesUnsub) {
                firestoreCategoriesUnsub();
                firestoreCategoriesUnsub = null;
            }
            if (firestoreCategoriesEmailUnsub) {
                firestoreCategoriesEmailUnsub();
                firestoreCategoriesEmailUnsub = null;
            }
        };

        const stop = () => {
            if (pollTimer) {
                clearInterval(pollTimer);
                pollTimer = null;
            }
        };

        const startFirestoreFallback = (reason: string) => {
            if (usingFirestoreFallback) return;
            usingFirestoreFallback = true;
            activeMemoBackend = 'firestore';
            stop();
            const privateUidRows: Memo[] = [];
            const privateEmailRows: Memo[] = [];
            const publicRows: Memo[] = [];
            const categoryUidRows: Category[] = [];
            const categoryEmailRows: Category[] = [];

            const mergeMemos = () => {
                const privateMap = new Map<string, Memo>();
                [...privateUidRows, ...privateEmailRows].forEach((row: any) => {
                    const id = String(row?.id ?? '');
                    if (!id) return;
                    privateMap.set(id, row);
                });
                privateMemos = Array.from(privateMap.values());

                const publicMap = new Map<string, Memo>();
                publicRows.forEach((row: any) => {
                    const id = String(row?.id ?? '');
                    if (!id) return;
                    publicMap.set(id, row);
                });
                publicMemos = Array.from(publicMap.values());

                updateMergedState();
                set((state) => ({ isLoading: false, error: state.error === reason ? null : state.error }));
            };

            const mergeCategories = () => {
                const categoryMap = new Map<string, Category>();
                [...categoryUidRows, ...categoryEmailRows].forEach((row: any) => {
                    const id = String(row?.id ?? '');
                    if (!id) return;
                    categoryMap.set(id, row);
                });
                const categories = Array.from(categoryMap.values());
                categories.sort((a: Category, b: Category) => (a.order || 0) - (b.order || 0));
                set((state) => ({
                    categories,
                    isLoading: false,
                    error: state.error === reason ? null : state.error
                }));
            };

            if (uid) {
                firestoreMemosUnsub = onSnapshot(
                    query(collection(db, MEMO_COLLECTION), where('userId', '==', uid)),
                    (snapshot) => {
                        privateUidRows.length = 0;
                        snapshot.docs.forEach((memoDoc) => privateUidRows.push({ id: memoDoc.id, ...memoDoc.data() } as Memo));
                        mergeMemos();
                    },
                    (error) => {
                        console.error('Firestore private memo subscription error:', error);
                        set({ error: reason, isLoading: false });
                    }
                );
            }

            if (email && email !== uid) {
                firestoreMemosEmailUnsub = onSnapshot(
                    query(collection(db, MEMO_COLLECTION), where('userId', '==', email)),
                    (snapshot) => {
                        privateEmailRows.length = 0;
                        snapshot.docs.forEach((memoDoc) => privateEmailRows.push({ id: memoDoc.id, ...memoDoc.data() } as Memo));
                        mergeMemos();
                    },
                    (error) => {
                        console.error('Firestore private(email) memo subscription error:', error);
                    }
                );
            }

            firestorePublicMemosUnsub = onSnapshot(
                query(collection(db, MEMO_COLLECTION), where('scope', '==', 'public')),
                (snapshot) => {
                    publicRows.length = 0;
                    snapshot.docs.forEach((memoDoc) => publicRows.push({ id: memoDoc.id, ...memoDoc.data() } as Memo));
                    mergeMemos();
                },
                (error) => {
                    console.error('Firestore public memo subscription error:', error);
                }
            );

            if (uid) {
                firestoreCategoriesUnsub = onSnapshot(
                    query(collection(db, CATEGORY_COLLECTION), where('userId', '==', uid)),
                    (snapshot) => {
                        categoryUidRows.length = 0;
                        snapshot.docs.forEach((catDoc) => categoryUidRows.push({ id: catDoc.id, ...catDoc.data() } as Category));
                        mergeCategories();
                    },
                    (error) => {
                        console.error('Firestore category subscription error:', error);
                    }
                );
            }

            if (email && email !== uid) {
                firestoreCategoriesEmailUnsub = onSnapshot(
                    query(collection(db, CATEGORY_COLLECTION), where('userId', '==', email)),
                    (snapshot) => {
                        categoryEmailRows.length = 0;
                        snapshot.docs.forEach((catDoc) => categoryEmailRows.push({ id: catDoc.id, ...catDoc.data() } as Category));
                        mergeCategories();
                    },
                    (error) => {
                        console.error('Firestore category(email) subscription error:', error);
                    }
                );
            }
        };

        const tick = async () => {
            if (usingFirestoreFallback) return;
            const now = Date.now();
            const shouldFetchCategories = now >= categoriesNextFetchAt;

            const [memosResult, categoriesResult] = await Promise.allSettled([
                listSmartMemosRows(false),
                shouldFetchCategories ? listSmartMemoCategoriesRows(false) : Promise.resolve(null)
            ]);

            if (memosResult.status === 'fulfilled') {
                const memoRows = memosResult.value ?? [];
                const hasMissingCoreShape =
                    memoRows.length > 0 &&
                    memoRows.every((r: any) =>
                        r?.content === undefined &&
                        r?.scope === undefined &&
                        r?.legacyId === undefined
                    );

                if (hasMissingCoreShape) {
                    startFirestoreFallback('메모 ?�세 ?�드가 ?�락?�어 Firestore ?�스�??�환?�습?�다.');
                    return;
                }

                activeMemoBackend = 'firestore';
                const nonPublicRows = memoRows.filter((r: any) => String(r?.scope ?? '') !== 'public');
                privateMemos = nonPublicRows
                    .filter((r: any) => matchesUser(r?.userId))
                    .map(mapRowToMemo);

                // ?�거???�환: userId 체계가 ?�른 과거 ?�이?�는 ?�체 비공�?메모�?fallback 로드
                if (privateMemos.length === 0 && nonPublicRows.length > 0) {
                    privateMemos = nonPublicRows.map(mapRowToMemo);
                }

                publicMemos = memoRows
                    .filter((r: any) => String(r?.scope ?? '') === 'public')
                    .map(mapRowToMemo);

                updateMergedState();
            } else {
                const message = normalizeMemoErrorMessage(memosResult.reason);
                console.error('Memo subscription error:', memosResult.reason);
                startFirestoreFallback(message);
                return;
            }

            if (categoriesResult.status === 'fulfilled') {
                const value = categoriesResult.value as any[] | null;
                if (value) {
                    const catRows = value;
                    let categories = catRows
                        .filter((r: any) => matchesUser(r?.userId))
                        .map(mapRowToCategory);
                    if (categories.length === 0 && catRows.length > 0) {
                        categories = catRows.map(mapRowToCategory);
                    }
                    categories.sort((a: Category, b: Category) => (a.order || 0) - (b.order || 0));
                    set((state) => ({
                        categories,
                        error: state.error === lastReportedError ? null : state.error
                    }));

                    categoriesBackoffMs = 0;
                    categoriesNextFetchAt = 0;
                    lastReportedError = null;
                    lastReportedErrorAt = 0;
                }
            } else if (shouldFetchCategories) {
                const message = normalizeMemoErrorMessage(categoriesResult.reason);
                console.error('Memo category subscription error:', categoriesResult.reason);

                try {
                    const catRows = await listSmartMemoCategoriesRows(false);
                    let categories = catRows
                        .filter((r: any) => matchesUser(r?.userId))
                        .map(mapRowToCategory);
                    if (categories.length === 0 && catRows.length > 0) {
                        categories = catRows.map(mapRowToCategory);
                    }
                    categories.sort((a: Category, b: Category) => (a.order || 0) - (b.order || 0));
                    set((state) => ({
                        categories,
                        error: state.error === message ? null : state.error
                    }));

                    categoriesBackoffMs = 0;
                    categoriesNextFetchAt = now + 30_000;
                    lastReportedError = null;
                    lastReportedErrorAt = 0;
                    return;
                } catch {
                    // ignore
                }

                const nextBackoff = categoriesBackoffMs > 0 ? Math.min(categoriesBackoffMs * 2, 60_000) : 2_000;
                categoriesBackoffMs = nextBackoff;
                categoriesNextFetchAt = now + nextBackoff;

                const shouldReport =
                    message !== lastReportedError ||
                    now - lastReportedErrorAt > 8_000;

                if (shouldReport) {
                    lastReportedError = message;
                    lastReportedErrorAt = now;
                    set({ error: message, isLoading: false });
                } else {
                    set((state) => ({ isLoading: state.isLoading ? false : state.isLoading }));
                }
            }
        };

        const unsubscribeMemos = () => {
            stop();
            stopFirestore();
        };
        const unsubscribeCategories = () => {
            stop();
            stopFirestore();
        };
        startFirestoreFallback('firestore');

        set({ unsubscribeMemos, unsubscribeCategories });

        return () => {
            unsubscribeMemos();
            unsubscribeCategories();
            set({ unsubscribeMemos: null, unsubscribeCategories: null });
        };
    },

    addMemo: async (memoData, userId) => {
        try {
            if (!userId) throw new Error("User ID is missing");

            if (activeMemoBackend === 'firestore') {
                const docRef = doc(collection(db, MEMO_COLLECTION));
                const now = serverTimestamp();
                const scope = memoData.categoryId === 'public' ? 'public' : 'private';
                const sanitizedMemoData = stripUndefined(memoData as Record<string, any>);

                await setDoc(docRef, {
                    ...sanitizedMemoData,
                    categoryId: memoData.categoryId === 'public' ? 'public' : (memoData.categoryId ?? null),
                    scope,
                    userId,
                    order: 0,
                    createdAt: now,
                    updatedAt: now
                });

                return docRef.id;
            }

            const newId = generateLegacyId('memo');

            // Logic: Category 'public' maps to scope 'public'
            const scope = memoData.categoryId === 'public' ? 'public' : 'private';

            const sanitizedMemoData = stripUndefined(memoData as Record<string, any>);

            let categoryId: string | null = null;
            let categoryLegacyId: string | null = null;
            const rawCategory = memoData.categoryId === 'public' ? 'public' : (memoData.categoryId ?? null);
            if (rawCategory === 'public') {
                categoryLegacyId = 'public';
            } else if (typeof rawCategory === 'string' && rawCategory.length > 0) {
                if (isUuidString(rawCategory)) {
                    categoryId = rawCategory;
                } else {
                    const resolved = await resolveSmartMemoCategoryUuid(rawCategory);
                    if (resolved) categoryId = resolved;
                    else categoryLegacyId = rawCategory;
                }
            }

            await createSmartMemo({
                legacyId: newId,
                userId,
                scope,
                type: (sanitizedMemoData as any)?.type ?? 'text',
                title: (sanitizedMemoData as any)?.title ?? '',
                content: (sanitizedMemoData as any)?.content ?? '',
                checklistItems: (sanitizedMemoData as any)?.checklistItems
                    ? JSON.stringify((sanitizedMemoData as any).checklistItems)
                    : null,
                color: (sanitizedMemoData as any)?.color ?? null,
                order: 0,
                isPinned: (sanitizedMemoData as any)?.isPinned ?? false,
                tags: (sanitizedMemoData as any)?.tags ? JSON.stringify((sanitizedMemoData as any).tags) : null,
                categoryId,
                categoryLegacyId,
                priority: (sanitizedMemoData as any)?.priority ?? null,
                x: (sanitizedMemoData as any)?.x ?? null,
                y: (sanitizedMemoData as any)?.y ?? null,
                w: (sanitizedMemoData as any)?.w ?? null,
                h: (sanitizedMemoData as any)?.h ?? null,
                isCollapsed: (sanitizedMemoData as any)?.isCollapsed ?? false,
                prevW: (sanitizedMemoData as any)?.prevW ?? null,
                prevH: (sanitizedMemoData as any)?.prevH ?? null
            } as any);

            return newId;
        } catch (error: any) {
            console.error("Failed to add memo:", error);
            set({ error: error.message });
            throw error;
        }
    },

    setMemosCollapsed: async (memoIds, collapsed, options) => {
        const state = get();
        const previousMemos = state.memos;

        if (!Array.isArray(memoIds) || memoIds.length === 0) return;

        const idSet = new Set<string>(memoIds);
        const gridCols = Math.max(1, Math.floor(options?.gridCols ?? 12));

        const COLLAPSED_W = 2;
        const COLLAPSED_H = 1;

        const memoById = new Map<string, Memo>();
        previousMemos.forEach(m => memoById.set(m.id, m));

        const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
        const getSafeNumber = (value: unknown, fallback: number) => (isFiniteNumber(value) ? value : fallback);

        const perRow = Math.max(1, Math.floor(gridCols / COLLAPSED_W));

        const layoutForId = new Map<string, { x: number; y: number; w: number; h: number }>();

        if (collapsed) {
            memoIds.forEach((id, index) => {
                const col = index % perRow;
                const row = Math.floor(index / perRow);
                layoutForId.set(id, {
                    x: col * COLLAPSED_W,
                    y: row * COLLAPSED_H,
                    w: COLLAPSED_W,
                    h: COLLAPSED_H
                });
            });
        } else {
            // Repack expanded memos using a simple masonry placement to avoid overlaps.
            const colHeights = new Array(gridCols).fill(0);

            memoIds.forEach((id) => {
                const memo = memoById.get(id);
                if (!memo) return;

                const rawW = getSafeNumber(memo.prevW ?? memo.w, 4);
                const rawH = getSafeNumber(memo.prevH ?? memo.h, 4);

                const w = Math.min(Math.max(1, Math.floor(rawW)), gridCols);
                const h = Math.max(2, Math.floor(rawH));

                let bestX = 0;
                let bestY = Infinity;

                for (let x = 0; x <= gridCols - w; x++) {
                    let maxYInSpan = 0;
                    for (let k = x; k < x + w; k++) {
                        maxYInSpan = Math.max(maxYInSpan, colHeights[k]);
                    }
                    if (maxYInSpan < bestY) {
                        bestY = maxYInSpan;
                        bestX = x;
                    }
                }

                for (let k = bestX; k < bestX + w; k++) {
                    colHeights[k] = bestY + h;
                }

                layoutForId.set(id, { x: bestX, y: bestY, w, h });
            });
        }

        const nextMemos = previousMemos.map(m => {
            if (!idSet.has(m.id)) return m;

            const layout = layoutForId.get(m.id);
            if (!layout) return m;

            // Avoid rewriting prevW/prevH when already collapsed
            const shouldStorePrev = collapsed && !m.isCollapsed;
            const shouldClearPrev = !collapsed && m.isCollapsed;

            const restoredW = !collapsed ? (m.prevW ?? m.w ?? 4) : layout.w;
            const restoredH = !collapsed ? (m.prevH ?? m.h ?? 4) : layout.h;

            return {
                ...m,
                isCollapsed: collapsed,
                x: layout.x,
                y: layout.y,
                w: collapsed ? layout.w : restoredW,
                h: collapsed ? layout.h : restoredH,
                prevW: shouldStorePrev ? m.w : (shouldClearPrev ? undefined : m.prevW),
                prevH: shouldStorePrev ? m.h : (shouldClearPrev ? undefined : m.prevH)
            };
        });

        set((s) => ({ memos: nextMemos, layoutVersion: s.layoutVersion + 1 }));

        try {
            if (activeMemoBackend === 'firestore') {
                const batch = writeBatch(db);
                memoIds.forEach((id) => {
                    const before = memoById.get(id);
                    const after = nextMemos.find(m => m.id === id);
                    if (!before || !after) return;

                    const data: any = {
                        isCollapsed: after.isCollapsed,
                        x: after.x,
                        y: after.y,
                        w: after.w,
                        h: after.h,
                        updatedAt: serverTimestamp()
                    };

                    if (collapsed) {
                        if (!before.isCollapsed) {
                            data.prevW = before.w;
                            data.prevH = before.h;
                        }
                    } else if (before.isCollapsed) {
                        data.prevW = deleteField();
                        data.prevH = deleteField();
                    }

                    batch.update(doc(db, MEMO_COLLECTION, id), data);
                });
                await batch.commit();
                return;
            }

            const uuidById = await listSmartMemoUuidMap();
            await Promise.all(
                memoIds.map(async (id) => {
                    const before = memoById.get(id);
                    const after = nextMemos.find(m => m.id === id);
                    if (!before || !after) return;

                    const uuid = uuidById.get(id);
                    if (!uuid) return;

                    const data: any = {
                        id: uuid,
                        isCollapsed: after.isCollapsed,
                        x: after.x,
                        y: after.y,
                        w: after.w,
                        h: after.h
                    };

                    if (collapsed) {
                        if (!before.isCollapsed) {
                            data.prevW = before.w;
                            data.prevH = before.h;
                        }
                    } else {
                        if (before.isCollapsed) {
                            data.prevW = null;
                            data.prevH = null;
                        }
                    }

                    await updateSmartMemo(data);
                })
            );
        } catch (error: any) {
            console.error('Failed to set memos collapsed:', error);
            set({ memos: previousMemos, error: error.message });
        }
    },

    updateMemo: async (id, updates) => {
        set(state => ({
            pendingMemoUpdates: { ...state.pendingMemoUpdates, [id]: true }
        }));
        try {
            if (activeMemoBackend === 'firestore') {
                const docRef = doc(db, MEMO_COLLECTION, id);
                const sanitizedUpdates = stripUndefined(updates as Record<string, any>);
                await updateDoc(docRef, {
                    ...sanitizedUpdates,
                    updatedAt: serverTimestamp(),
                });
                return;
            }

            const resolvedId = await resolveSmartMemoUuid(id);
            if (!resolvedId) throw new Error('Memo not found');

            const sanitizedUpdates = stripUndefined(updates as Record<string, any>);

            const vars: any = { id: resolvedId };
            const setIfDefined = (key: string, value: unknown) => {
                if (value !== undefined) vars[key] = value;
            };

            setIfDefined('userId', (sanitizedUpdates as any).userId ?? undefined);
            setIfDefined('scope', (sanitizedUpdates as any).scope ?? undefined);
            setIfDefined('type', (sanitizedUpdates as any).type ?? undefined);
            setIfDefined('title', (sanitizedUpdates as any).title ?? undefined);
            setIfDefined('content', (sanitizedUpdates as any).content ?? undefined);
            setIfDefined('color', (sanitizedUpdates as any).color ?? undefined);
            setIfDefined('order', (sanitizedUpdates as any).order ?? undefined);
            setIfDefined('isPinned', (sanitizedUpdates as any).isPinned ?? undefined);
            setIfDefined('priority', (sanitizedUpdates as any).priority ?? undefined);
            setIfDefined('x', (sanitizedUpdates as any).x ?? undefined);
            setIfDefined('y', (sanitizedUpdates as any).y ?? undefined);
            setIfDefined('w', (sanitizedUpdates as any).w ?? undefined);
            setIfDefined('h', (sanitizedUpdates as any).h ?? undefined);
            setIfDefined('isCollapsed', (sanitizedUpdates as any).isCollapsed ?? undefined);
            setIfDefined('prevW', (sanitizedUpdates as any).prevW ?? undefined);
            setIfDefined('prevH', (sanitizedUpdates as any).prevH ?? undefined);

            if ((sanitizedUpdates as any).checklistItems !== undefined) {
                const ci = (sanitizedUpdates as any).checklistItems;
                vars.checklistItems = ci === null ? null : JSON.stringify(ci);
            }

            if ((sanitizedUpdates as any).tags !== undefined) {
                const tg = (sanitizedUpdates as any).tags;
                vars.tags = tg === null ? null : JSON.stringify(tg);
            }

            if ((sanitizedUpdates as any).categoryId !== undefined) {
                const raw = (sanitizedUpdates as any).categoryId;
                if (raw === null) {
                    vars.categoryId = null;
                    vars.categoryLegacyId = null;
                } else if (raw === 'public') {
                    vars.categoryId = null;
                    vars.categoryLegacyId = 'public';
                } else if (typeof raw === 'string' && isUuidString(raw)) {
                    vars.categoryId = raw;
                    vars.categoryLegacyId = null;
                } else if (typeof raw === 'string') {
                    const resolved = await resolveSmartMemoCategoryUuid(raw);
                    if (resolved) {
                        vars.categoryId = resolved;
                        vars.categoryLegacyId = null;
                    } else {
                        vars.categoryId = null;
                        vars.categoryLegacyId = raw;
                    }
                }
            }

            await updateSmartMemo(vars);
        } catch (error: any) {
            console.error("Failed to update memo:", error);
            set({ error: error.message });
            throw error;
        } finally {
            set(state => {
                const pending = { ...state.pendingMemoUpdates };
                delete pending[id];
                return {
                    pendingMemoUpdates: pending,
                    recentLocalUpdates: {
                        ...state.recentLocalUpdates,
                        [id]: Date.now()
                    }
                };
            });
        }
    },

    reorderMemos: async (newMemos: Memo[]) => {
        const previousMemos = get().memos;

        // 1. Optimistic Update
        set({ memos: newMemos });

        try {
            if (activeMemoBackend === 'firestore') {
                const batch = writeBatch(db);
                newMemos.forEach((memo, index) => {
                    const newOrder = (index + 1) * 1000;
                    if (memo.order !== newOrder) {
                        batch.update(doc(db, MEMO_COLLECTION, memo.id), {
                            order: newOrder,
                            updatedAt: serverTimestamp()
                        });
                        memo.order = newOrder;
                    }
                });
                await batch.commit();
                return;
            }

            const uuidById = await listSmartMemoUuidMap();
            const updates: Promise<any>[] = [];

            newMemos.forEach((memo, index) => {
                const newOrder = (index + 1) * 1000;
                if (memo.order !== newOrder) {
                    const uuid = uuidById.get(memo.id);
                    if (!uuid) return;
                    updates.push(updateSmartMemo({ id: uuid, order: newOrder } as any));
                    memo.order = newOrder;
                }
            });

            await Promise.all(updates);
        } catch (error: any) {
            console.error("Failed to reorder memos:", error);
            set({ error: error.message, memos: previousMemos }); // Rollback
        }
    },

    moveMemoToCategory: async (memoId: string, categoryId: string | null) => {
        const previousMemos = get().memos;

        // Scope logic
        const newScope = categoryId === 'public' ? 'public' : 'private';

        // 1. Optimistic Update
        set(state => ({
            memos: state.memos.map(m =>
                m.id === memoId ? { ...m, categoryId: categoryId ?? null, scope: newScope } : m
            )
        }));

        try {
            // 2. Firestore Update
            await get().updateMemo(memoId, {
                categoryId: categoryId || null,
                scope: newScope as any
            } as any);
        } catch (error: any) {
            console.error("Failed to move memo category:", error);
            set({ error: error.message, memos: previousMemos }); // Rollback
        }
    },

    deleteMemo: async (id) => {
        try {
            if (activeMemoBackend === 'firestore') {
                await deleteDoc(doc(db, MEMO_COLLECTION, id));
                return;
            }

            const resolvedId = await resolveSmartMemoUuid(id);
            if (!resolvedId) return;
            await deleteSmartMemo({ id: resolvedId } as any);
        } catch (error: any) {
            console.error("Failed to delete memo:", error);
            set({ error: error.message });
            throw error;
        }
    },

    addCategory: async (categoryData, userId) => {
        try {
            if (!userId) throw new Error("User ID is missing");

            if (activeMemoBackend === 'firestore') {
                await addDoc(collection(db, CATEGORY_COLLECTION), {
                    ...categoryData,
                    userId,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });
                return;
            }

            await createSmartMemoCategory({
                legacyId: generateLegacyId('cat'),
                userId,
                name: (categoryData as any)?.name ?? '',
                color: (categoryData as any)?.color ?? null,
                icon: (categoryData as any)?.icon ?? null,
                order: (categoryData as any)?.order ?? null
            } as any);
        } catch (error: any) {
            console.error("Failed to add category:", error);
            set({ error: error.message });
            throw error;
        }
    },

    updateCategory: async (id, updates) => {
        try {
            if (activeMemoBackend === 'firestore') {
                await updateDoc(doc(db, CATEGORY_COLLECTION, id), {
                    ...(updates as any),
                    updatedAt: serverTimestamp()
                });
                return;
            }

            const resolvedId = await resolveSmartMemoCategoryUuid(id);
            if (!resolvedId) throw new Error('Category not found');

            const vars: any = { id: resolvedId };
            if ((updates as any).userId !== undefined) vars.userId = (updates as any).userId;
            if ((updates as any).name !== undefined) vars.name = (updates as any).name;
            if ((updates as any).order !== undefined) vars.order = (updates as any).order;
            if ((updates as any).color !== undefined) vars.color = (updates as any).color;
            if ((updates as any).icon !== undefined) vars.icon = (updates as any).icon;

            await updateSmartMemoCategory(vars);
        } catch (error: any) {
            console.error("Failed to update category:", error);
            set({ error: error.message });
            throw error;
        }
    },

    deleteCategory: async (id) => {
        try {
            if (activeMemoBackend === 'firestore') {
                await deleteDoc(doc(db, CATEGORY_COLLECTION, id));
                return;
            }

            const resolvedId = await resolveSmartMemoCategoryUuid(id);
            if (!resolvedId) return;

            try {
                const memoRows = await listSmartMemosRows();
                const affected = memoRows.filter((r: any) => {
                    const cid = r?.category?.id ? String(r.category.id) : '';
                    const cLegacy = r?.categoryLegacyId ? String(r.categoryLegacyId) : '';
                    return cid === resolvedId || cLegacy === id;
                });

                await Promise.all(
                    affected.map(async (r: any) => {
                        const memoUuid = r?.id ? String(r.id) : null;
                        if (!memoUuid) return;
                        await updateSmartMemo({
                            id: memoUuid,
                            categoryId: null,
                            categoryLegacyId: null
                        } as any);
                    })
                );
            } catch {
                // ignore
            }

            await deleteSmartMemoCategory({ id: resolvedId } as any);
        } catch (error: any) {
            console.error("Failed to delete category:", error);
            set({ error: error.message });
            throw error;
        }
    },

    reorderCategories: async (newCategories: Category[]) => {
        // 1. Optimistic Update
        set({ categories: newCategories });

        try {
            if (activeMemoBackend === 'firestore') {
                const batch = writeBatch(db);
                newCategories.forEach((cat, index) => {
                    batch.update(doc(db, CATEGORY_COLLECTION, cat.id), {
                        order: index,
                        updatedAt: serverTimestamp()
                    });
                });
                await batch.commit();
                return;
            }

            // 2. Batch Update
            const catRows = await listSmartMemoCategoriesRows();
            const uuidById = new Map<string, string>();
            catRows.forEach((r: any) => {
                const uuid = r?.id ? String(r.id) : '';
                if (!uuid) return;
                uuidById.set(uuid, uuid);
                if (r?.legacyId) uuidById.set(String(r.legacyId), uuid);
            });

            await Promise.all(
                newCategories.map(async (cat, index) => {
                    const uuid = uuidById.get(cat.id);
                    if (!uuid) return;
                    await updateSmartMemoCategory({ id: uuid, order: index } as any);
                })
            );
        } catch (error: any) {
            console.error("Failed to reorder categories:", error);
            // Rollback is tricky here without keeping validation state, but manageable.
        }
    },

    toggleChecklistItem: async (memoId: string, itemId: string) => {
        const previousMemos = get().memos;
        // 1. Optimistic Update
        set(state => ({
            memos: state.memos.map(m => {
                if (m.id !== memoId || !m.checklistItems) return m;
                return {
                    ...m,
                    updatedAt: Date.now(), // Force update timestamp for Last-Write-Wins
                    checklistItems: m.checklistItems.map(item =>
                        item.id === itemId ? { ...item, isChecked: !item.isChecked } : item
                    )
                };
            })
        }));

        try {
            const memo = get().memos.find(m => m.id === memoId);
            if (!memo || !memo.checklistItems) return;

            await get().updateMemo(memoId, { checklistItems: memo.checklistItems } as any);
        } catch (error: any) {
            console.error("Failed to toggle checklist item:", error);
            set({ error: error.message, memos: previousMemos }); // Rollback
        }
    },

    addChecklistItem: async (memoId: string, text: string, index?: number) => {
        const previousMemos = get().memos;
        const newItem = {
            id: generateId(), // Local ID generation
            text,
            isChecked: false
        };

        // 1. Optimistic Update
        set(state => ({
            memos: state.memos.map(m => {
                if (m.id !== memoId) return m;
                const currentItems = m.checklistItems || [];
                const newItems = [...currentItems];
                if (typeof index === 'number' && index >= 0) {
                    newItems.splice(index, 0, newItem);
                } else {
                    newItems.push(newItem);
                }
                return { ...m, checklistItems: newItems, type: 'checklist', updatedAt: Date.now() }; // Force update timestamp
            })
        }));

        try {
            const memo = get().memos.find(m => m.id === memoId);
            if (!memo) return;

            await get().updateMemo(memoId, { checklistItems: memo.checklistItems } as any);
        } catch (error: any) {
            console.error("Failed to add checklist item:", error);
            set({ error: error.message, memos: previousMemos }); // Rollback
        }
    },

    updateChecklistItem: async (memoId: string, itemId: string, text: string) => {
        const previousMemos = get().memos;

        set(state => ({
            memos: state.memos.map(m => {
                if (m.id !== memoId || !m.checklistItems) return m;
                return {
                    ...m,
                    updatedAt: Date.now(), // Force update timestamp
                    checklistItems: m.checklistItems.map(item =>
                        item.id === itemId ? { ...item, text } : item
                    )
                };
            })
        }));

        try {
            // Debounce logic could be applied at UI component level, 
            // but here we just blindly update content for simplicity.
            // If high traffic, might need debounce.
            const memo = get().memos.find(m => m.id === memoId);
            if (!memo || !memo.checklistItems) return;

            await get().updateMemo(memoId, { checklistItems: memo.checklistItems } as any);
        } catch (error: any) {
            console.error("Failed to update checklist item:", error);
            set({ error: error.message, memos: previousMemos });
        }
    },

    deleteChecklistItem: async (memoId: string, itemId: string) => {
        const previousMemos = get().memos;

        set(state => ({
            memos: state.memos.map(m => {
                if (m.id !== memoId || !m.checklistItems) return m;
                return {
                    ...m,
                    updatedAt: Date.now(), // Force update timestamp
                    checklistItems: m.checklistItems.filter(item => item.id !== itemId)
                };
            })
        }));

        try {
            const memo = get().memos.find(m => m.id === memoId);
            if (!memo) return;

            await get().updateMemo(memoId, { checklistItems: memo.checklistItems } as any);
        } catch (error: any) {
            console.error("Failed to delete checklist item:", error);
            set({ error: error.message, memos: previousMemos });
        }
    },

    addChecklistComment: async (memoId: string, itemId: string, text: string) => {
        const previousMemos = get().memos;
        const newComment = {
            id: generateId(),
            text,
            createdAt: Date.now()
        };

        set(state => ({
            memos: state.memos.map(m => {
                if (m.id !== memoId || !m.checklistItems) return m;
                return {
                    ...m,
                    updatedAt: Date.now(), // Force update timestamp for Last-Write-Wins
                    checklistItems: m.checklistItems.map(item =>
                        item.id === itemId
                            ? { ...item, comments: [...(item.comments || []), newComment] }
                            : item
                    )
                };
            })
        }));

        try {
            const memo = get().memos.find(m => m.id === memoId);
            if (!memo || !memo.checklistItems) return;

            await get().updateMemo(memoId, {
                checklistItems: memo.checklistItems.map(item => ({
                    ...item,
                    comments: item.comments?.map(comment =>
                        comment.id === newComment.id ? { ...comment, createdAt: Date.now() } : comment
                    )
                }))
            } as any);
        } catch (error: any) {
            console.error("Failed to add checklist comment:", error);
            set({ error: error.message, memos: previousMemos });
        }
    },

    deleteChecklistComment: async (memoId: string, itemId: string, commentId: string) => {
        const previousMemos = get().memos;

        set(state => ({
            memos: state.memos.map(m => {
                if (m.id !== memoId || !m.checklistItems) return m;
                return {
                    ...m,
                    updatedAt: Date.now(), // Force update timestamp for Last-Write-Wins
                    checklistItems: m.checklistItems.map(item =>
                        item.id === itemId
                            ? { ...item, comments: (item.comments || []).filter(comment => comment.id !== commentId) }
                            : item
                    )
                };
            })
        }));

        try {
            const memo = get().memos.find(m => m.id === memoId);
            if (!memo || !memo.checklistItems) return;

            await get().updateMemo(memoId, { checklistItems: memo.checklistItems } as any);
        } catch (error: any) {
            console.error("Failed to delete checklist comment:", error);
            set({ error: error.message, memos: previousMemos });
        }
    },

    convertToChecklist: async (memoId: string) => {
        const previousMemos = get().memos;

        set(state => ({
            memos: state.memos.map(m => {
                if (m.id !== memoId) return m;
                const text = m.content || "";
                const lines = text.split('\n').filter(line => line.trim() !== '');
                const checklistItems = lines.map(line => ({
                    id: generateId(),
                    text: line,
                    isChecked: false
                }));
                return { ...m, type: 'checklist', checklistItems, content: "" }; // Clear content? Or keep as backup? Clear to avoid confusing sync.
            })
        }));

        try {
            const memo = get().memos.find(m => m.id === memoId);
            if (!memo) return;
            await get().updateMemo(memoId, {
                type: 'checklist' as any,
                checklistItems: memo.checklistItems,
                content: ''
            } as any);
        } catch (error: any) {
            console.error("Failed to convert to checklist:", error);
            set({ error: error.message, memos: previousMemos });
        }
    },

    convertToText: async (memoId: string) => {
        const previousMemos = get().memos;

        set(state => ({
            memos: state.memos.map(m => {
                if (m.id !== memoId) return m;
                const items = m.checklistItems || [];
                const content = items.map(item => item.isChecked ? `[x] ${item.text}` : item.text).join('\n');
                return { ...m, type: 'text', content, checklistItems: [] };
            })
        }));

        try {
            const memo = get().memos.find(m => m.id === memoId);
            if (!memo) return;
            await get().updateMemo(memoId, {
                type: 'text' as any,
                content: memo.content,
                checklistItems: []
            } as any);
        } catch (error: any) {
            console.error("Failed to convert to text:", error);
            set({ error: error.message, memos: previousMemos });
        }
    },
    updateMemoLayouts: async (layouts) => {
        const previousMemos = get().memos;

        // 1. Optimistic Update
        set(state => ({
            memos: state.memos.map(m => {
                const layout = layouts.find(l => l.i === m.id);
                if (layout) {
                    return { ...m, x: layout.x, y: layout.y, w: layout.w, h: layout.h };
                }
                return m;
            })
        }));

        try {
            if (activeMemoBackend === 'firestore') {
                const batch = writeBatch(db);
                let updateCount = 0;
                layouts.forEach((layout: any) => {
                    const original = previousMemos.find(m => m.id === layout.i);
                    if (
                        original &&
                        (original.x !== layout.x || original.y !== layout.y || original.w !== layout.w || original.h !== layout.h)
                    ) {
                        batch.update(doc(db, MEMO_COLLECTION, layout.i), {
                            x: layout.x,
                            y: layout.y,
                            w: layout.w,
                            h: layout.h,
                            updatedAt: serverTimestamp()
                        });
                        updateCount++;
                    }
                });
                if (updateCount > 0) {
                    await batch.commit();
                }
                return;
            }

            const uuidById = await listSmartMemoUuidMap();
            const updates: Promise<any>[] = [];

            layouts.forEach((layout: any) => {
                const original = previousMemos.find(m => m.id === layout.i);
                if (
                    original &&
                    (original.x !== layout.x || original.y !== layout.y || original.w !== layout.w || original.h !== layout.h)
                ) {
                    const uuid = uuidById.get(layout.i);
                    if (!uuid) return;
                    updates.push(updateSmartMemo({
                        id: uuid,
                        x: layout.x,
                        y: layout.y,
                        w: layout.w,
                        h: layout.h
                    } as any));
                }
            });

            if (updates.length > 0) {
                await Promise.all(updates);
            }
        } catch (error: any) {
            console.error("Failed to update layout:", error);
            set({ error: error.message, memos: previousMemos }); // Rollback
        }
    },

    toggleMemoCollapse: async (id, updates) => {
        const state = get();
        const memo = state.memos.find(m => m.id === id);

        if (!memo) return;
        if (memo.isCollapsed === updates.isCollapsed) return;

        // 1. Calculate new dimensions
        // Collapsed size: W=2, H=1 (Title only view)
        const COLLAPSED_W = 2;
        const COLLAPSED_H = 1;

        const newW = updates.isCollapsed ? COLLAPSED_W : (memo.prevW || memo.w || 4);
        const newH = updates.isCollapsed ? COLLAPSED_H : (memo.prevH || memo.h || 4);

        // 2. Optimistic State Preparation
        // Deep copy needed for mutation during collision resolution
        let newMemos = state.memos.map(m => m.id === id
            ? { ...m, isCollapsed: updates.isCollapsed, w: newW, h: newH }
            : { ...m }
        );

        // 3. PUSH LOGIC (Only when Expanding)
        // If expanding, we shove other memos down to make space.
        if (!updates.isCollapsed) {
            const collides = (r1: any, r2: any) => {
                return (r1.x < r2.x + r2.w && r1.x + r1.w > r2.x && r1.y < r2.y + r2.h && r1.y + r1.h > r2.y);
            };

            const resolveCollisions = () => {
                let changed = false;
                // Sort by Y (top to bottom) to resolve cascading pushes
                newMemos.sort((a, b) => a.y - b.y || a.x - b.x);

                for (let i = 0; i < newMemos.length; i++) {
                    const m1 = newMemos[i];
                    for (let j = 0; j < newMemos.length; j++) {
                        const m2 = newMemos[j];
                        if (m1.id === m2.id) continue;

                        if (collides(m1, m2)) {
                            // Collision detected. 
                            // Rule: The one that is "below" or isn't the active one moves.
                            let mover, anchor;

                            if (m1.id === id) { mover = m2; anchor = m1; }
                            else if (m2.id === id) { mover = m1; anchor = m2; }
                            else {
                                // If neither is the expander, move the one visibly lower
                                if (m1.y < m2.y) { mover = m2; anchor = m1; }
                                else { mover = m1; anchor = m2; }
                            }

                            // Move mover below anchor
                            const requiredY = anchor.y + anchor.h;
                            if (mover.y < requiredY) {
                                mover.y = requiredY;
                                changed = true;
                            }
                        }
                    }
                }
                return changed;
            };

            // Run resolution until stable (max 10 passes to prevent infinite loops)
            let passes = 0;
            while (resolveCollisions() && passes < 10) {
                passes++;
            }
        }

        // 4. Update Store
        set((s) => ({ memos: newMemos, layoutVersion: s.layoutVersion + 1 }));

        // 5. Update Firestore
        try {
            if (activeMemoBackend === 'firestore') {
                const batch = writeBatch(db);
                const targetData: any = {
                    isCollapsed: updates.isCollapsed,
                    w: newW,
                    h: newH,
                    updatedAt: serverTimestamp()
                };

                if (updates.isCollapsed) {
                    targetData.prevW = memo.w;
                    targetData.prevH = memo.h;
                } else {
                    targetData.prevW = deleteField();
                    targetData.prevH = deleteField();
                }

                batch.update(doc(db, MEMO_COLLECTION, id), targetData);

                newMemos.forEach((m) => {
                    if (m.id === id) return;
                    const original = state.memos.find(om => om.id === m.id);
                    if (original && (original.x !== m.x || original.y !== m.y)) {
                        batch.update(doc(db, MEMO_COLLECTION, m.id), {
                            x: m.x,
                            y: m.y,
                            updatedAt: serverTimestamp()
                        });
                    }
                });

                await batch.commit();
                return;
            }

            const uuidById = await listSmartMemoUuidMap();
            const targetUuid = uuidById.get(id);

            if (targetUuid) {
                const targetData: any = {
                    id: targetUuid,
                    isCollapsed: updates.isCollapsed,
                    w: newW,
                    h: newH
                };

                if (updates.isCollapsed) {
                    targetData.prevW = memo.w;
                    targetData.prevH = memo.h;
                } else {
                    targetData.prevW = null;
                    targetData.prevH = null;
                }

                await updateSmartMemo(targetData);
            }

            await Promise.all(
                newMemos.map(async (m) => {
                    if (m.id === id) return;
                    const original = state.memos.find(om => om.id === m.id);
                    if (original && (original.x !== m.x || original.y !== m.y)) {
                        const uuid = uuidById.get(m.id);
                        if (!uuid) return;
                        await updateSmartMemo({ id: uuid, x: m.x, y: m.y } as any);
                    }
                })
            );
        } catch (error: any) {
            console.error("Failed to toggle collapse:", error);
            // Rollback on error
            set({ memos: state.memos, error: error.message });
        }
    },

    repackMemos: async (strategy: 'date-desc' | 'date-asc' | 'title' = 'date-desc', options) => {
        const previousMemos = get().memos;

        const gridCols = Math.max(1, Math.floor(options?.gridCols ?? 12));
        const scopeSet = options?.scopeIds ? new Set(options.scopeIds) : null;
        const scopeMemos = scopeSet ? previousMemos.filter(m => scopeSet.has(m.id)) : previousMemos;

        const sortedMemos = [...scopeMemos];

        const getUpdatedMillis = (memo: Memo) => {
            const val = memo.updatedAt;
            // Handle Firestore Timestamp
            if (val && typeof val.toMillis === 'function') {
                return val.toMillis();
            }
            // Handle Optimistic ServerTimestamp (FieldValue or similar object)
            // If it exists but no toMillis, assume it's "now" (pending write)
            if (val && typeof val === 'object') {
                return Date.now();
            }
            // Fallback for missing date
            return 0;
        };

        sortedMemos.sort((a, b) => {
            const pinnedA = a.isPinned ? 1 : 0;
            const pinnedB = b.isPinned ? 1 : 0;
            if (pinnedA !== pinnedB) return pinnedB - pinnedA;

            if (strategy === 'date-desc') {
                return getUpdatedMillis(b) - getUpdatedMillis(a);
            }
            if (strategy === 'date-asc') {
                return getUpdatedMillis(a) - getUpdatedMillis(b);
            }
            return a.title.localeCompare(b.title);
        });

        const colHeights = new Array(gridCols).fill(0);

        const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
        const getSafeNumber = (value: unknown, fallback: number) => (isFiniteNumber(value) ? value : fallback);

        const layouts = sortedMemos.map(memo => {
            const rawW = getSafeNumber(memo.w, 4);
            const rawH = memo.isCollapsed ? 1 : getSafeNumber(memo.h, 4);

            const w = Math.min(Math.max(1, Math.floor(rawW)), gridCols);
            const h = Math.max(1, Math.floor(rawH));

            let bestX = 0;
            let bestY = Infinity;

            // Find the absolute lowest position that fits the width
            for (let x = 0; x <= gridCols - w; x++) {
                let maxYInSpan = 0;
                for (let k = x; k < x + w; k++) {
                    maxYInSpan = Math.max(maxYInSpan, colHeights[k]);
                }

                if (maxYInSpan < bestY) {
                    bestY = maxYInSpan;
                    bestX = x;
                }
            }

            // Update column heights
            for (let k = bestX; k < bestX + w; k++) {
                colHeights[k] = bestY + h;
            }

            return {
                i: memo.id,
                x: bestX,
                y: bestY,
                w,
                h
            };
        });

        const newVersion = get().layoutVersion + 1;
        set({ layoutVersion: newVersion });
        await get().updateMemoLayouts(layouts);
    },

    setCommentDraft: (memoId: string, itemId: string, text: string) => {
        const key = `${memoId}:${itemId}`;
        set((state) => ({
            commentDrafts: { ...state.commentDrafts, [key]: text }
        }));
    }
}));

