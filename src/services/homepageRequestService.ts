import { db } from '../config/firebase';
import {
    collection,
    addDoc,
    updateDoc,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    orderBy,
    serverTimestamp,
    Timestamp
} from 'firebase/firestore';
import { homepageActivityService } from './homepageActivityService';

export type HomepageRequestType = 'build' | 'modify';
export type HomepageRequestStatus = 'requested' | 'accepted' | 'in_progress' | 'review' | 'completed';
export type HomepageRequestPriority = 'low' | 'medium' | 'high';

export interface HomepageRequest {
    id?: string;
    title: string;
    type: HomepageRequestType;
    status: HomepageRequestStatus;
    priority: HomepageRequestPriority;
    clientName: string;
    clientCompany?: string;
    clientEmail?: string;
    clientPhone?: string;
    description?: string;
    referenceUrl?: string;
    referenceNote?: string;
    assignedStaffId?: string;
    estimateId?: string;
    dueDate?: Timestamp;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
}

export interface CreateHomepageRequestInput {
    title: string;
    type: HomepageRequestType;
    clientName: string;
    clientCompany?: string;
    clientEmail?: string;
    clientPhone?: string;
    description?: string;
    referenceUrl?: string;
    referenceNote?: string;
    priority?: HomepageRequestPriority;
}

export interface ListHomepageRequestOptions {
    status?: HomepageRequestStatus;
    type?: HomepageRequestType;
    assignedStaffId?: string;
}

const COLLECTION_NAME = 'homepageRequests';

export const homepageRequestService = {
    createRequest: async (input: CreateHomepageRequestInput): Promise<string> => {
        const docRef = await addDoc(collection(db, COLLECTION_NAME), {
            title: input.title,
            type: input.type,
            status: 'requested' as HomepageRequestStatus,
            priority: input.priority ?? 'medium',
            clientName: input.clientName,
            clientCompany: input.clientCompany ?? '',
            clientEmail: input.clientEmail ?? '',
            clientPhone: input.clientPhone ?? '',
            description: input.description ?? '',
            referenceUrl: input.referenceUrl ?? '',
            referenceNote: input.referenceNote ?? '',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        await homepageActivityService.addActivity(docRef.id, {
            type: 'status_change',
            message: '요청이 등록되었습니다. (requested)',
            createdBy: 'system',
            createdByName: '시스템'
        });

        return docRef.id;
    },

    getRequest: async (id: string): Promise<HomepageRequest | null> => {
        const docRef = doc(db, COLLECTION_NAME, id);
        const snap = await getDoc(docRef);
        if (!snap.exists()) return null;
        return {
            id: snap.id,
            ...(snap.data() as Omit<HomepageRequest, 'id'>)
        };
    },

    listRequests: async (options?: ListHomepageRequestOptions): Promise<HomepageRequest[]> => {
        const colRef = collection(db, COLLECTION_NAME);
        const conditions = [] as Array<ReturnType<typeof where>>;

        if (options?.status) {
            conditions.push(where('status', '==', options.status));
        }
        if (options?.type) {
            conditions.push(where('type', '==', options.type));
        }
        if (options?.assignedStaffId) {
            conditions.push(where('assignedStaffId', '==', options.assignedStaffId));
        }

        const q = conditions.length > 0
            ? query(colRef, ...conditions, orderBy('createdAt', 'desc'))
            : query(colRef, orderBy('createdAt', 'desc'));

        const snapshot = await getDocs(q);
        return snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<HomepageRequest, 'id'>)
        }));
    },

    updateRequest: async (id: string, patch: Partial<Omit<HomepageRequest, 'id'>>): Promise<void> => {
        const docRef = doc(db, COLLECTION_NAME, id);
        await updateDoc(docRef, {
            ...patch,
            updatedAt: serverTimestamp()
        });
    },

    updateStatus: async (
        id: string,
        status: HomepageRequestStatus,
        actor: { id: string; name: string }
    ): Promise<void> => {
        const docRef = doc(db, COLLECTION_NAME, id);
        await updateDoc(docRef, {
            status,
            updatedAt: serverTimestamp()
        });

        await homepageActivityService.addActivity(id, {
            type: 'status_change',
            message: `요청 상태가 '${status}'(으)로 변경되었습니다.`,
            createdBy: actor.id,
            createdByName: actor.name
        });
    },

    assignStaff: async (
        id: string,
        staff: { id: string; name: string }
    ): Promise<void> => {
        const docRef = doc(db, COLLECTION_NAME, id);
        await updateDoc(docRef, {
            assignedStaffId: staff.id,
            updatedAt: serverTimestamp()
        });

        await homepageActivityService.addActivity(id, {
            type: 'status_change',
            message: `담당자가 '${staff.name}'(으)로 배정되었습니다.`,
            createdBy: staff.id,
            createdByName: staff.name
        });
    }
};
