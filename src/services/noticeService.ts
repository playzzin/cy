import {
    Timestamp,
    collection,
    deleteDoc,
    doc,
    getDocs,
    onSnapshot,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
    writeBatch,
    type DocumentData,
    type Unsubscribe
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type {
    Notice,
    NoticeAuthor,
    NoticeCategory,
    NoticePriority,
    NoticeStatus,
    UpsertNoticeCategoryInput,
    UpsertNoticeInput
} from '../types/notice';

const COLLECTION_NAME = 'notices';
const CATEGORY_COLLECTION_NAME = 'notice_categories';
const DEFAULT_CATEGORY = '일반';

const priorityWeight: Record<NoticePriority, number> = {
    urgent: 3,
    important: 2,
    normal: 1
};

const normalizeText = (value: unknown): string => String(value || '').trim();
const normalizeColor = (value: unknown): string => {
    const color = normalizeText(value);
    return /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#0f766e';
};

const normalizeKey = (value: unknown): string =>
    normalizeText(value).toLowerCase().replace(/[\s_-]/g, '');

const uniqueStrings = (values: unknown[] = []): string[] =>
    Array.from(new Set(values.map(normalizeText).filter(Boolean)));

const asTimestamp = (value: unknown, fallback = Timestamp.now()): Timestamp => {
    if (value instanceof Timestamp) return value;
    if (value && typeof (value as { toDate?: unknown }).toDate === 'function') {
        return Timestamp.fromDate((value as { toDate: () => Date }).toDate());
    }
    if (typeof value === 'string' || typeof value === 'number') {
        const date = new Date(value);
        if (!Number.isNaN(date.getTime())) return Timestamp.fromDate(date);
    }
    return fallback;
};

const asOptionalTimestamp = (value: unknown): Timestamp | null => {
    if (!value) return null;
    return asTimestamp(value);
};

const normalizePriority = (value: unknown): NoticePriority => {
    if (value === 'urgent' || value === 'important' || value === 'normal') return value;
    return 'normal';
};

const normalizeStatus = (value: unknown): NoticeStatus => {
    if (value === 'draft' || value === 'published' || value === 'archived') return value;
    return 'published';
};

const normalizeAuthor = (value: unknown): NoticeAuthor => {
    const data = value && typeof value === 'object' ? value as Partial<NoticeAuthor> : {};
    return {
        uid: normalizeText(data.uid) || 'system',
        name: normalizeText(data.name) || '관리자',
        email: data.email ?? null
    };
};

const normalizeNotice = (id: string, data: DocumentData): Notice => {
    const now = Timestamp.now();
    return {
        id,
        title: normalizeText(data.title) || '제목 없음',
        body: String(data.body || ''),
        category: normalizeText(data.category) || DEFAULT_CATEGORY,
        targetPositions: uniqueStrings(data.targetPositions || []),
        priority: normalizePriority(data.priority),
        status: normalizeStatus(data.status),
        pinned: Boolean(data.pinned),
        createdBy: normalizeAuthor(data.createdBy),
        updatedBy: data.updatedBy ? normalizeAuthor(data.updatedBy) : null,
        createdAt: asTimestamp(data.createdAt, now),
        updatedAt: asTimestamp(data.updatedAt, now),
        publishedAt: asOptionalTimestamp(data.publishedAt),
        expiresAt: asOptionalTimestamp(data.expiresAt)
    };
};

const normalizeCategory = (id: string, data: DocumentData, fallbackOrder: number): NoticeCategory => ({
    id,
    name: normalizeText(data.name) || DEFAULT_CATEGORY,
    color: normalizeColor(data.color),
    order: typeof data.order === 'number' && Number.isFinite(data.order) ? data.order : fallbackOrder,
    createdAt: asOptionalTimestamp(data.createdAt),
    updatedAt: asOptionalTimestamp(data.updatedAt)
});

const getNoticeTime = (notice: Notice): number =>
    (notice.publishedAt || notice.updatedAt || notice.createdAt).toMillis();

const sortNotices = (items: Notice[]): Notice[] =>
    [...items].sort((left, right) => {
        if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
        const priorityDiff = priorityWeight[right.priority] - priorityWeight[left.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return getNoticeTime(right) - getNoticeTime(left);
    });

const sortCategories = (items: NoticeCategory[]): NoticeCategory[] =>
    [...items].sort((left, right) => (
        left.order - right.order || left.name.localeCompare(right.name, 'ko-KR')
    ));

const allPositionKeys = new Set(['all', '*', '전체', '전체직책', '전직책', '모든직책']);

const isAllPositionsNotice = (targetPositions: string[]): boolean => {
    if (targetPositions.length === 0) return true;
    return targetPositions.some((position) => allPositionKeys.has(normalizeKey(position)));
};

const isExpired = (notice: Notice): boolean =>
    Boolean(notice.expiresAt && notice.expiresAt.toMillis() < Date.now());

const prepareInput = (input: UpsertNoticeInput) => ({
    title: input.title.trim(),
    body: input.body.trim(),
    category: input.category.trim() || DEFAULT_CATEGORY,
    targetPositions: uniqueStrings(input.targetPositions),
    priority: input.priority || 'normal',
    status: 'published' as const,
    pinned: Boolean(input.pinned),
    expiresAt: input.expiresAt || null
});

const prepareCategoryInput = (input: UpsertNoticeCategoryInput) => ({
    name: input.name.trim(),
    color: normalizeColor(input.color),
    order: typeof input.order === 'number' && Number.isFinite(input.order) ? input.order : Date.now()
});

const updateNoticeCategoryName = async (oldName: string, nextName: string): Promise<void> => {
    if (!oldName || oldName === nextName) return;

    const snapshot = await getDocs(query(collection(db, COLLECTION_NAME), where('category', '==', oldName)));
    const docs = snapshot.docs;

    for (let index = 0; index < docs.length; index += 450) {
        const batch = writeBatch(db);
        docs.slice(index, index + 450).forEach((docSnap) => {
            batch.update(docSnap.ref, {
                category: nextName,
                updatedAt: serverTimestamp()
            });
        });
        await batch.commit();
    }
};

export const noticeService = {
    collectionName: COLLECTION_NAME,
    categoryCollectionName: CATEGORY_COLLECTION_NAME,

    subscribeNotices: (
        callback: (notices: Notice[]) => void,
        onError?: (error: Error) => void
    ): Unsubscribe => {
        return onSnapshot(
            collection(db, COLLECTION_NAME),
            (snapshot) => {
                callback(sortNotices(snapshot.docs.map((docSnap) => normalizeNotice(docSnap.id, docSnap.data()))));
            },
            (error) => {
                console.error('[noticeService] subscription failed:', error);
                onError?.(error);
            }
        );
    },

    subscribeCategories: (
        callback: (categories: NoticeCategory[]) => void,
        onError?: (error: Error) => void
    ): Unsubscribe => {
        return onSnapshot(
            collection(db, CATEGORY_COLLECTION_NAME),
            (snapshot) => {
                callback(sortCategories(snapshot.docs.map((docSnap, index) => normalizeCategory(docSnap.id, docSnap.data(), index))));
            },
            (error) => {
                console.error('[noticeService] category subscription failed:', error);
                onError?.(error);
            }
        );
    },

    createCategory: async (input: UpsertNoticeCategoryInput): Promise<string> => {
        const payload = prepareCategoryInput(input);
        if (!payload.name) throw new Error('category-name-required');

        const categoryRef = doc(collection(db, CATEGORY_COLLECTION_NAME));
        await setDoc(categoryRef, {
            ...payload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        return categoryRef.id;
    },

    createCategories: async (inputs: UpsertNoticeCategoryInput[]): Promise<void> => {
        const payloads = inputs.map(prepareCategoryInput).filter((payload) => payload.name);
        if (payloads.length === 0) return;

        const batch = writeBatch(db);
        payloads.forEach((payload) => {
            const categoryRef = doc(collection(db, CATEGORY_COLLECTION_NAME));
            batch.set(categoryRef, {
                ...payload,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
        });
        await batch.commit();
    },

    renameCategory: async (oldName: string, nextName: string): Promise<void> => {
        await updateNoticeCategoryName(oldName, nextName);
    },

    updateCategory: async (
        category: NoticeCategory,
        input: UpsertNoticeCategoryInput
    ): Promise<void> => {
        const payload = prepareCategoryInput(input);
        if (!category.id) throw new Error('category-id-required');
        if (!payload.name) throw new Error('category-name-required');

        await updateDoc(doc(db, CATEGORY_COLLECTION_NAME, category.id), {
            ...payload,
            updatedAt: serverTimestamp()
        });
        await updateNoticeCategoryName(category.name, payload.name);
    },

    deleteCategory: async (
        category: NoticeCategory,
        fallbackCategory = DEFAULT_CATEGORY
    ): Promise<void> => {
        if (!category.id) return;
        await updateNoticeCategoryName(category.name, fallbackCategory);
        await deleteDoc(doc(db, CATEGORY_COLLECTION_NAME, category.id));
    },

    createNotice: async (input: UpsertNoticeInput, actor: NoticeAuthor): Promise<string> => {
        const payload = prepareInput(input);
        if (!payload.title) throw new Error('title-required');
        if (!payload.body) throw new Error('body-required');

        const noticeRef = doc(collection(db, COLLECTION_NAME));
        await setDoc(noticeRef, {
            ...payload,
            createdBy: actor,
            updatedBy: actor,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            publishedAt: payload.status === 'published' ? serverTimestamp() : null
        });

        return noticeRef.id;
    },

    updateNotice: async (noticeId: string, input: UpsertNoticeInput, actor: NoticeAuthor): Promise<void> => {
        const payload = prepareInput(input);
        if (!noticeId) throw new Error('notice-id-required');
        if (!payload.title) throw new Error('title-required');
        if (!payload.body) throw new Error('body-required');

        await updateDoc(doc(db, COLLECTION_NAME, noticeId), {
            ...payload,
            updatedBy: actor,
            updatedAt: serverTimestamp(),
            publishedAt: payload.status === 'published' ? serverTimestamp() : null
        });
    },

    deleteNotice: async (noticeId: string): Promise<void> => {
        if (!noticeId) return;
        await deleteDoc(doc(db, COLLECTION_NAME, noticeId));
    },

    isAllPositionsNotice,

    isNoticeVisibleToPositions: (notice: Notice, positions: string[], isAdmin = false): boolean => {
        if (isAdmin) return true;
        if (isExpired(notice)) return false;
        if (isAllPositionsNotice(notice.targetPositions)) return true;

        const viewerKeys = new Set(positions.map(normalizeKey).filter(Boolean));
        return notice.targetPositions.some((position) => viewerKeys.has(normalizeKey(position)));
    },

    isExpired,

    normalizePositionKey: normalizeKey
};
