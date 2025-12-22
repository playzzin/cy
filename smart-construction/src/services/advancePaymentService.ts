import { db } from '../config/firebase';
import { collection, doc, getDocs, setDoc, query, where, deleteDoc, Timestamp, deleteField } from 'firebase/firestore';

export interface AdvancePayment {
    id?: string;
    workerId: string;
    workerName: string;
    teamId: string;
    teamName: string;
    yearMonth: string; // "YYYY-MM"

    // Dynamic deduction items (custom fields)
    items?: Record<string, number>;

    // Explicit Columns from Image
    prevMonthCarryover: number; // 전월이월
    accommodation: number;      // 숙소비
    privateRoom: number;        // 개인방
    gloves: number;            // 장갑
    deposit: number;           // 보증금
    fines: number;             // 과태료
    electricity: number;       // 전기료
    gas: number;               // 도시가스
    internet: number;          // 인터넷
    water: number;             // 수도세

    totalDeduction: number;    // 공제 합계 (Calculated)
    updatedAt?: Date;
}

const COLLECTION_NAME = 'advance_payments';

export const advancePaymentService = {
    // Get list by Year-Month and Team
    getAdvancePayments: async (year: number, month: number, teamId: string): Promise<AdvancePayment[]> => {
        try {
            const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
            const q = query(
                collection(db, COLLECTION_NAME),
                where('yearMonth', '==', yearMonth),
                where('teamId', '==', teamId)
            );

            const querySnapshot = await getDocs(q);
            const items: AdvancePayment[] = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();

                const rawItems = (data as { items?: unknown }).items;
                const normalizedItems: Record<string, number> =
                    rawItems && typeof rawItems === 'object' && !Array.isArray(rawItems)
                        ? Object.fromEntries(
                            Object.entries(rawItems as Record<string, unknown>)
                                .map(([key, value]) => [key, typeof value === 'number' && Number.isFinite(value) ? value : 0] as const)
                        )
                        : {};

                items.push({
                    id: doc.id,
                    ...data,
                    privateRoom: (data as { privateRoom?: number }).privateRoom ?? 0,
                    items: normalizedItems,
                    updatedAt: data.updatedAt?.toDate(),
                } as AdvancePayment);
            });

            return items;
        } catch (error) {
            console.error("Error fetching advance payments:", error);
            throw error;
        }
    },

    getAdvancePaymentsByYearMonth: async (year: number, month: number): Promise<AdvancePayment[]> => {
        try {
            const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
            const q = query(collection(db, COLLECTION_NAME), where('yearMonth', '==', yearMonth));

            const querySnapshot = await getDocs(q);
            const items: AdvancePayment[] = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();

                const rawItems = (data as { items?: unknown }).items;
                const normalizedItems: Record<string, number> =
                    rawItems && typeof rawItems === 'object' && !Array.isArray(rawItems)
                        ? Object.fromEntries(
                            Object.entries(rawItems as Record<string, unknown>)
                                .map(([key, value]) => [key, typeof value === 'number' && Number.isFinite(value) ? value : 0] as const)
                        )
                        : {};

                items.push({
                    id: doc.id,
                    ...data,
                    privateRoom: (data as { privateRoom?: number }).privateRoom ?? 0,
                    items: normalizedItems,
                    updatedAt: data.updatedAt?.toDate(),
                } as AdvancePayment);
            });

            return items;
        } catch (error) {
            console.error("Error fetching advance payments by yearMonth:", error);
            throw error;
        }
    },

    // Save (Update/Insert) Logic
    // Using a composite ID (teamId_workerId_yearMonth) to prevent duplicates per worker per month
    saveAdvancePayment: async (data: AdvancePayment) => {
        try {
            // Create a unique ID if not provided, or ensure uniqueness
            // Format: {teamId}_{workerId}_{yearMonth}
            const docId = `${data.teamId}_${data.workerId}_${data.yearMonth}`;
            const docRef = doc(db, COLLECTION_NAME, docId);

            const normalizedItems: Record<string, number> = data.items
                ? Object.fromEntries(
                    Object.entries(data.items)
                        .filter(([key]) => typeof key === 'string' && key.trim().length > 0)
                        .map(([key, value]) => [key, Number.isFinite(value) ? value : 0] as const)
                )
                : {};

            const payload = {
                ...data,
                id: docId,
                privateRoom: data.privateRoom ?? 0,
                items: normalizedItems,
                absenceFine: deleteField(),
                updatedAt: Timestamp.now()
            };

            await setDoc(docRef, payload, { merge: true });
            return docId;
        } catch (error) {
            console.error("Error saving advance payment:", error);
            throw error;
        }
    },

    deleteAdvancePayment: async (id: string) => {
        try {
            await deleteDoc(doc(db, COLLECTION_NAME, id));
        } catch (error) {
            console.error("Error deleting advance payment:", error);
            throw error;
        }
    }
};
