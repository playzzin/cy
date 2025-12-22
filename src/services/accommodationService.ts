import {
    collection,
    doc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    serverTimestamp,
    writeBatch
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Accommodation, UtilityRecord, UtilityCosts } from '../types/accommodation';

const ACCOMMODATION_COLLECTION = 'accommodations';
const UTILITY_RECORD_COLLECTION = 'utility_records';

export const accommodationService = {
    // --- Accommodation CRUD ---

    async getAccommodations(): Promise<Accommodation[]> {
        const q = query(collection(db, ACCOMMODATION_COLLECTION), orderBy('name'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Accommodation));
    },

    async addAccommodation(data: Omit<Accommodation, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
        const docRef = await addDoc(collection(db, ACCOMMODATION_COLLECTION), {
            ...data,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        return docRef.id;
    },

    async updateAccommodation(id: string, data: Partial<Accommodation>): Promise<void> {
        const docRef = doc(db, ACCOMMODATION_COLLECTION, id);
        await updateDoc(docRef, {
            ...data,
            updatedAt: serverTimestamp()
        });
    },

    async deleteAccommodation(id: string): Promise<void> {
        await deleteDoc(doc(db, ACCOMMODATION_COLLECTION, id));
    },

    // --- Utility Record CRUD ---

    async getUtilityRecords(yearMonth: string): Promise<UtilityRecord[]> {
        const q = query(
            collection(db, UTILITY_RECORD_COLLECTION),
            where('yearMonth', '==', yearMonth)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as UtilityRecord));
    },

    // Batch creation/update for the "Smart Ledger" grid save
    async saveUtilityRecords(records: UtilityRecord[]): Promise<void> {
        const batch = writeBatch(db);

        records.forEach(record => {
            const docRef = record.id
                ? doc(db, UTILITY_RECORD_COLLECTION, record.id)
                : doc(collection(db, UTILITY_RECORD_COLLECTION)); // New ID if not exists

            // Calculate total just in case
            const costs = record.costs;
            const calculatedTotal = (costs.rent || 0) + (costs.electricity || 0) + (costs.gas || 0) + (costs.water || 0) + (costs.internet || 0) + (costs.maintenance || 0) + (costs.other || 0);

            const dataToSave: Record<string, any> = {
                ...record,
                costs: {
                    ...costs,
                    total: calculatedTotal
                },
                updatedAt: serverTimestamp()
            };

            if (!record.id) {
                // New record
                dataToSave.createdAt = serverTimestamp();
                batch.set(docRef, dataToSave);
            } else {
                // Update
                batch.update(docRef, dataToSave);
            }
        });

        await batch.commit();
    },

    async getRecordHistory(accommodationId: string): Promise<UtilityRecord[]> {
        const q = query(
            collection(db, UTILITY_RECORD_COLLECTION),
            where('accommodationId', '==', accommodationId),
            orderBy('yearMonth', 'desc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as UtilityRecord));
    },

    // --- Smart Logic: Get Ledger with Drafts ---
    async getMonthlyLedger(yearMonth: string): Promise<UtilityRecord[]> {
        // 1. Fetch all accommodations (to know what rows we need)
        const accommodations = await this.getAccommodations();

        // 2. Fetch existing records for this month
        const existingRecords = await this.getUtilityRecords(yearMonth);
        const recordMap = new Map(existingRecords.map(r => [r.accommodationId, r]));

        // 3. Merge: Create drafts for missing records based on Cost Profile
        const mergedRecords: UtilityRecord[] = accommodations.map(acc => {
            if (recordMap.has(acc.id)) {
                return recordMap.get(acc.id)!;
            }

            // Create Draft based on Profile
            const profile = acc.costProfile;
            const contract = acc.contract;

            // Helper to determine cost value based on profile
            const getCost = (type: string, fixedVal?: number) => {
                if (type === 'included') return 0;
                if (type === 'fixed') return fixedVal || 0;
                return 0; // variable starts at 0
            };

            const costs: UtilityCosts = {
                rent: contract.monthlyRent,
                electricity: getCost(profile.electricity, profile.fixedElectricity),
                gas: getCost(profile.gas, profile.fixedGas),
                water: getCost(profile.water, profile.fixedWater),
                internet: getCost(profile.internet, profile.fixedInternet),
                maintenance: getCost(profile.maintenance, profile.fixedMaintenance),
                other: 0,
                total: 0 // Will be calculated by UI or save
            };

            // Calc initial total
            costs.total = costs.rent + costs.electricity + costs.gas + costs.water + costs.internet + costs.maintenance + costs.other;

            return {
                id: '', // Empty ID means it's a new draft
                accommodationId: acc.id,
                accommodationName: acc.name,
                yearMonth: yearMonth,
                costs: costs,
                paymentStatus: 'unpaid',
                createdAt: null,
                updatedAt: null
            };
        });

        return mergedRecords;
    }
};
