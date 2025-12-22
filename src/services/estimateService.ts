import { db } from '../config/firebase';
import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    getDocs,
    query,
    orderBy,
    serverTimestamp,
    Timestamp
} from 'firebase/firestore';

export type EstimateStatus = 'draft' | 'sent' | 'approved' | 'rejected';
export type EstimateRequestType = 'build' | 'modify';

export interface EstimateItem {
    id: string;
    label: string;
    description?: string;
    category?: string; // 예: design, frontend, backend, maintenance 등
    unitPrice: number;
    quantity: number;
    amount: number; // unitPrice * quantity
    isOptional?: boolean;
}

export interface Estimate {
    id?: string;
    title: string;
    clientName: string;
    clientCompany?: string;
    requestType: EstimateRequestType;
    status: EstimateStatus;
    items: EstimateItem[];
    subtotal: number;
    discount?: number;
    tax?: number;
    total: number;
    validUntil?: Timestamp;
    notes?: string;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
}

const COLLECTION_NAME = 'estimates';

export const estimateService = {
    addEstimate: async (estimate: Omit<Estimate, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
        const docRef = await addDoc(collection(db, COLLECTION_NAME), {
            ...estimate,
            status: estimate.status || 'draft',
            items: estimate.items || [],
            discount: estimate.discount ?? 0,
            tax: estimate.tax ?? 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        return docRef.id;
    },

    updateEstimate: async (id: string, estimate: Partial<Estimate>): Promise<void> => {
        const docRef = doc(db, COLLECTION_NAME, id);
        await updateDoc(docRef, {
            ...estimate,
            updatedAt: serverTimestamp()
        });
    },

    deleteEstimate: async (id: string): Promise<void> => {
        await deleteDoc(doc(db, COLLECTION_NAME, id));
    },

    getEstimates: async (): Promise<Estimate[]> => {
        const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map((snap) => ({
            id: snap.id,
            ...(snap.data() as Omit<Estimate, 'id'>)
        }));
    }
};
