import { db } from '../config/firebase';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    writeBatch,
    Timestamp
} from 'firebase/firestore';
import { createConverter } from '../utils/firestoreConverter';
import {
    MaterialSchema,
    MaterialZod,
    MaterialInboundSchema,
    MaterialInboundZod,
    MaterialOutboundSchema,
    MaterialOutboundZod
} from '../types/zod/materialSchema';

const MASTER_COLLECTION = 'materials';
const INBOUND_COLLECTION = 'materialInbounds';
const OUTBOUND_COLLECTION = 'materialOutbounds';

/**
 * MaterialFirestoreService
 * Handles normalized storage for materials and transactions.
 */
export const materialFirestoreService = {
    // --- Material Master ---
    getMaterial: async (id: string) => {
        const ref = doc(db, MASTER_COLLECTION, id).withConverter(createConverter(MaterialSchema));
        const snap = await getDoc(ref);
        return snap.exists() ? snap.data() : null;
    },

    getAllMaterials: async (options?: { includeInactive?: boolean }) => {
        const ref = collection(db, MASTER_COLLECTION).withConverter(createConverter(MaterialSchema));
        // Note: Firestore does not support 'field does not exist' query combined with '== true'.
        // Fetch all and filter in memory to ensure data with missing 'isActive' field is included.
        const snap = await getDocs(ref);
        const rows = snap.docs.map(d => d.data());
        if (options?.includeInactive) return rows;
        return rows.filter(m => m.isActive !== false); // Only exclude if explicitly false
    },

    saveMaterial: async (id: string, data: MaterialZod) => {
        const ref = doc(db, MASTER_COLLECTION, id).withConverter(createConverter(MaterialSchema));
        await setDoc(ref, data, { merge: true });
    },

    // --- Inbound Transactions ---
    getInbound: async (id: string) => {
        const ref = doc(db, INBOUND_COLLECTION, id).withConverter(createConverter(MaterialInboundSchema));
        const snap = await getDoc(ref);
        return snap.exists() ? snap.data() : null;
    },

    saveInbound: async (id: string, data: MaterialInboundZod) => {
        const ref = doc(db, INBOUND_COLLECTION, id).withConverter(createConverter(MaterialInboundSchema));
        await setDoc(ref, data, { merge: true });
    },

    saveInboundsBatch: async (transactions: MaterialInboundZod[]) => {
        const batch = writeBatch(db);
        transactions.forEach(t => {
            const ref = doc(db, INBOUND_COLLECTION, t.id).withConverter(createConverter(MaterialInboundSchema));
            batch.set(ref, t, { merge: true });
        });
        await batch.commit();
    },

    getInboundsByRange: async (startDate: string, endDate: string, siteId?: string) => {
        const ref = collection(db, INBOUND_COLLECTION).withConverter(createConverter(MaterialInboundSchema));
        if (siteId) {
            const siteQuery = query(ref, where('siteId', '==', siteId));
            const snap = await getDocs(siteQuery);
            return snap.docs
                .map(d => d.data())
                .filter(row => row.transactionDate >= startDate && row.transactionDate <= endDate)
                .sort((left, right) => String(right.transactionDate || '').localeCompare(String(left.transactionDate || '')));
        }

        const q = query(ref, where('transactionDate', '>=', startDate), where('transactionDate', '<=', endDate), orderBy('transactionDate', 'desc'));
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data());
    },

    deleteInbound: async (id: string) => {
        await deleteDoc(doc(db, INBOUND_COLLECTION, id));
    },

    // --- Outbound Transactions ---
    getOutbound: async (id: string) => {
        const ref = doc(db, OUTBOUND_COLLECTION, id).withConverter(createConverter(MaterialOutboundSchema));
        const snap = await getDoc(ref);
        return snap.exists() ? snap.data() : null;
    },

    saveOutbound: async (id: string, data: MaterialOutboundZod) => {
        const ref = doc(db, OUTBOUND_COLLECTION, id).withConverter(createConverter(MaterialOutboundSchema));
        await setDoc(ref, data, { merge: true });
    },

    saveOutboundsBatch: async (transactions: MaterialOutboundZod[]) => {
        const batch = writeBatch(db);
        transactions.forEach(t => {
            const ref = doc(db, OUTBOUND_COLLECTION, t.id).withConverter(createConverter(MaterialOutboundSchema));
            batch.set(ref, t, { merge: true });
        });
        await batch.commit();
    },

    getOutboundsByRange: async (startDate: string, endDate: string, siteId?: string) => {
        const ref = collection(db, OUTBOUND_COLLECTION).withConverter(createConverter(MaterialOutboundSchema));
        if (siteId) {
            const siteQuery = query(ref, where('siteId', '==', siteId));
            const snap = await getDocs(siteQuery);
            return snap.docs
                .map(d => d.data())
                .filter(row => row.transactionDate >= startDate && row.transactionDate <= endDate)
                .sort((left, right) => String(right.transactionDate || '').localeCompare(String(left.transactionDate || '')));
        }

        const q = query(ref, where('transactionDate', '>=', startDate), where('transactionDate', '<=', endDate), orderBy('transactionDate', 'desc'));
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data());
    },

    deleteOutbound: async (id: string) => {
        await deleteDoc(doc(db, OUTBOUND_COLLECTION, id));
    }
};

