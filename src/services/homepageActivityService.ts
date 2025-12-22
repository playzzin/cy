import { db } from '../config/firebase';
import {
    collection,
    addDoc,
    getDocs,
    query,
    orderBy,
    Timestamp,
    serverTimestamp
} from 'firebase/firestore';

export type HomepageActivityType = 'status_change' | 'estimate' | 'checklist' | 'comment';

export interface HomepageActivity {
    id?: string;
    requestId: string;
    type: HomepageActivityType;
    message: string;
    createdBy: string; // uid or name key
    createdByName?: string;
    createdAt?: Timestamp;
}

const getActivitiesCollection = (requestId: string) =>
    collection(db, 'homepageRequests', requestId, 'activities');

export const homepageActivityService = {
    addActivity: async (
        requestId: string,
        activity: Omit<HomepageActivity, 'id' | 'requestId' | 'createdAt'>
    ): Promise<string> => {
        const docRef = await addDoc(getActivitiesCollection(requestId), {
            ...activity,
            requestId,
            createdAt: serverTimestamp()
        });
        return docRef.id;
    },

    getActivities: async (requestId: string): Promise<HomepageActivity[]> => {
        const q = query(getActivitiesCollection(requestId), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<HomepageActivity, 'id'>)
        }));
    }
};
