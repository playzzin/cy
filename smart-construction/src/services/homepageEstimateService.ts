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

const COLLECTION_NAME = 'homepageEstimates';

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
        const q = query(
            collection(db, COLLECTION_NAME),
            where('requestId', '==', input.requestId),
            orderBy('createdAt', 'desc')
        );
        const existingSnapshot = await getDocs(q);

        let maxVersion = 0;
        existingSnapshot.forEach((docSnap) => {
            const data = docSnap.data() as Partial<HomepageEstimate>;
            if (typeof data.version === 'number' && data.version > maxVersion) {
                maxVersion = data.version;
            }
        });
        const newVersion = maxVersion + 1;

        const { items, subtotal } = buildItems(input.items);
        const { discount, tax, total } = calculateTotals(subtotal, input.discount, input.tax);

        const docRef = await addDoc(collection(db, COLLECTION_NAME), {
            requestId: input.requestId,
            version: newVersion,
            status: input.status ?? 'draft',
            items,
            subtotal,
            discount,
            tax,
            total,
            notes: input.notes ?? '',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        await homepageActivityService.addActivity(input.requestId, {
            type: 'estimate',
            message: `견적 v${newVersion} 이(가) 생성되었습니다.`,
            createdBy: actor.id,
            createdByName: actor.name
        });

        return docRef.id;
    },

    getEstimate: async (id: string): Promise<HomepageEstimate | null> => {
        const docRef = doc(db, COLLECTION_NAME, id);
        const snap = await getDoc(docRef);
        if (!snap.exists()) return null;
        return {
            id: snap.id,
            ...(snap.data() as Omit<HomepageEstimate, 'id'>)
        };
    },

    listEstimatesByRequest: async (requestId: string): Promise<HomepageEstimate[]> => {
        const q = query(
            collection(db, COLLECTION_NAME),
            where('requestId', '==', requestId),
            orderBy('version', 'desc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<HomepageEstimate, 'id'>)
        }));
    },

    updateEstimate: async (
        id: string,
        patch: UpdateHomepageEstimateInput,
        actor: { id: string; name: string }
    ): Promise<void> => {
        const docRef = doc(db, COLLECTION_NAME, id);
        const snap = await getDoc(docRef);
        if (!snap.exists()) return;

        const current = {
            id: snap.id,
            ...(snap.data() as Omit<HomepageEstimate, 'id'>)
        } as HomepageEstimate;

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

        await updateDoc(docRef, {
            status,
            items,
            subtotal,
            discount,
            tax,
            total,
            notes,
            updatedAt: serverTimestamp()
        });

        await homepageActivityService.addActivity(current.requestId, {
            type: 'estimate',
            message: `견적 v${current.version} 이(가) 수정되었습니다.`,
            createdBy: actor.id,
            createdByName: actor.name
        });
    }
};
