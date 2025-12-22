import { db } from '../config/firebase';
import {
    collection,
    addDoc,
    updateDoc,
    getDoc,
    getDocs,
    doc,
    query,
    orderBy,
    serverTimestamp,
    Timestamp,
    deleteField
} from 'firebase/firestore';
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

const getChecklistCollection = (requestId: string) =>
    collection(db, 'homepageRequests', requestId, 'checklist');

export const homepageChecklistService = {
    addItem: async (
        requestId: string,
        input: CreateHomepageChecklistItemInput,
        actor: { id: string; name: string }
    ): Promise<string> => {
        let order = input.order;

        if (typeof order !== 'number') {
            const snapshot = await getDocs(query(getChecklistCollection(requestId), orderBy('order', 'asc')));
            let maxOrder = 0;
            snapshot.forEach((docSnap) => {
                const data = docSnap.data() as Partial<HomepageChecklistItem>;
                if (typeof data.order === 'number' && data.order > maxOrder) {
                    maxOrder = data.order;
                }
            });
            order = maxOrder + 1;
        }

        const status: HomepageChecklistStatus = input.status ?? 'todo';

        const docRef = await addDoc(getChecklistCollection(requestId), {
            requestId,
            title: input.title,
            status,
            order,
            assigneeId: input.assigneeId ?? '',
            dueDate: input.dueDate ?? null,
            completedAt: status === 'done' ? serverTimestamp() : null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        await homepageActivityService.addActivity(requestId, {
            type: 'checklist',
            message: `체크리스트 항목 "${input.title}" 이(가) 추가되었습니다.`,
            createdBy: actor.id,
            createdByName: actor.name
        });

        return docRef.id;
    },

    updateItem: async (
        requestId: string,
        itemId: string,
        patch: UpdateHomepageChecklistItemInput,
        actor: { id: string; name: string }
    ): Promise<void> => {
        const docRef = doc(getChecklistCollection(requestId), itemId);
        const snap = await getDoc(docRef);
        if (!snap.exists()) return;

        const current = {
            id: snap.id,
            ...(snap.data() as Omit<HomepageChecklistItem, 'id'>)
        } as HomepageChecklistItem;

        const updates: Record<string, any> = {
            updatedAt: serverTimestamp()
        };

        if (typeof patch.title === 'string') {
            updates.title = patch.title;
        }
        if (typeof patch.order === 'number') {
            updates.order = patch.order;
        }
        if (typeof patch.assigneeId === 'string') {
            updates.assigneeId = patch.assigneeId;
        }
        if (patch.dueDate === null) {
            updates.dueDate = deleteField();
        } else if (patch.dueDate instanceof Timestamp) {
            updates.dueDate = patch.dueDate;
        }

        let statusChanged = false;
        let newStatus: HomepageChecklistStatus = current.status;

        if (patch.status) {
            newStatus = patch.status;
            updates.status = newStatus;
            statusChanged = newStatus !== current.status;

            if (newStatus === 'done' && !current.completedAt) {
                updates.completedAt = serverTimestamp();
            } else if (newStatus !== 'done' && current.completedAt) {
                updates.completedAt = deleteField();
            }
        }

        await updateDoc(docRef, updates);

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
        const q = query(getChecklistCollection(requestId), orderBy('order', 'asc'));
        const snapshot = await getDocs(q);

        return snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<HomepageChecklistItem, 'id'>)
        }));
    },

    getProgress: async (requestId: string): Promise<ChecklistProgress> => {
        const snapshot = await getDocs(getChecklistCollection(requestId));
        let total = 0;
        let done = 0;

        snapshot.forEach((docSnap) => {
            const data = docSnap.data() as Partial<HomepageChecklistItem>;
            total += 1;
            if (data.status === 'done') {
                done += 1;
            }
        });

        const percentage = total === 0 ? 0 : Math.round((done / total) * 100);
        return { total, done, percentage };
    }
};
