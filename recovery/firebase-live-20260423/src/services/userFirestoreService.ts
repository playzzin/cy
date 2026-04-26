import { db } from '../config/firebase';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    Timestamp
} from 'firebase/firestore';
import { UserData } from './userService';

const COLLECTION_NAME = 'users';

/**
 * UserFirestoreService
 * Handles all direct Firestore operations for user data.
 */
export const userFirestoreService = {
    // Get user by UID
    getUser: async (uid: string): Promise<UserData | null> => {
        const docRef = doc(db, COLLECTION_NAME, uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return { uid: docSnap.id, ...docSnap.data() } as UserData;
        }
        return null;
    },

    // Get all users
    getAllUsers: async (): Promise<UserData[]> => {
        const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));
        return querySnapshot.docs.map(doc => ({
            uid: doc.id,
            ...doc.data()
        } as UserData));
    },

    // Save or merge user data
    saveUser: async (uid: string, data: Partial<UserData>): Promise<void> => {
        const docRef = doc(db, COLLECTION_NAME, uid);
        await setDoc(docRef, {
            ...data,
            updatedAt: Timestamp.now()
        }, { merge: true });
    },

    // Update specific user fields
    updateUser: async (uid: string, updates: Partial<UserData>): Promise<void> => {
        const docRef = doc(db, COLLECTION_NAME, uid);
        await updateDoc(docRef, {
            ...updates,
            updatedAt: Timestamp.now()
        });
    }
};
