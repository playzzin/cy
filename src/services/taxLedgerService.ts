import {
    collection,
    deleteDoc,
    doc,
    setDoc,
    getDocs,
    query,
    where,
    orderBy,
    Timestamp,
    writeBatch
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { TaxAffairsRecord } from '../pages/tax/components/TransactionTable';

const COLLECTION_NAME = 'tax_invoice_ledger';

export const taxLedgerService = {
    /**
     * Save multiple records to the ledger.
     * Uses batch write for atomicity.
     * Overwrites if ID exists (Upsert).
     */
    async saveRecords(records: TaxAffairsRecord[]) {
        const batch = writeBatch(db);
        const preparedRecords = records.map((record) => ({
            record,
            docRef: doc(db, COLLECTION_NAME, record.id)
        }));

        preparedRecords.forEach(({ record, docRef }) => {
            // Ensure no undefined values for Firestore
            const safeRecord = JSON.parse(JSON.stringify(record));
            batch.set(docRef, {
                ...safeRecord,
                updatedAt: Timestamp.now()
            }, { merge: true });
        });

        await batch.commit();
    },

    /**
     * Fetch ledger records by date range.
     */
    async fetchRecords(startDate: string, endDate: string) {
        // Query by date string (YYYY-MM-DD)
        // Assuming date format is YYYY-MM-DD
        const q = query(
            collection(db, COLLECTION_NAME),
            where('date', '>=', startDate),
            where('date', '<=', endDate),
            orderBy('date', 'desc')
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as TaxAffairsRecord[];
    },

    /**
     * Update a single field of a record.
     */
    async updateField(id: string, field: string, value: any) {
        const docRef = doc(db, COLLECTION_NAME, id);
        await setDoc(docRef, {
            [field]: value,
            updatedAt: Timestamp.now()
        }, { merge: true });
    },

    /**
     * Delete a record.
     */
    async deleteRecord(id: string) {
        const docRef = doc(db, COLLECTION_NAME, id);
        await deleteDoc(docRef);
    }
};
