import { db } from '../config/firebase';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';

export interface DispatchAssignment {
    siteId: string;
    siteName: string;
    workerIds: string[]; // Assigned workers
    vehicleIds: string[]; // Assigned vehicles
    note?: string;
}

export interface DailyDispatch {
    id?: string; // date string (YYYY-MM-DD)
    date: string;
    assignments: DispatchAssignment[];
    updatedAt: Timestamp;
}

const COLLECTION_NAME = 'daily_dispatches';

export const dispatchService = {
    // Get dispatch plan for a specific date
    getDispatchByDate: async (date: string): Promise<DailyDispatch | null> => {
        const docRef = doc(db, COLLECTION_NAME, date);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return docSnap.data() as DailyDispatch;
        } else {
            return null;
        }
    },

    // Save dispatch plan
    saveDispatch: async (date: string, assignments: DispatchAssignment[]): Promise<void> => {
        const docRef = doc(db, COLLECTION_NAME, date);
        const data: DailyDispatch = {
            date,
            assignments,
            updatedAt: Timestamp.now()
        };
        await setDoc(docRef, data);
    },

    // Copy dispatch plan from one date to another
    copyDispatch: async (fromDate: string, toDate: string): Promise<void> => {
        const source = await dispatchService.getDispatchByDate(fromDate);
        if (source) {
            await dispatchService.saveDispatch(toDate, source.assignments);
        }
    }
};
