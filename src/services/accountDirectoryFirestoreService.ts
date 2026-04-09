import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    serverTimestamp,
    setDoc,
    updateDoc,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { createConverter } from '../utils/firestoreConverter';
import { stripUndefinedFields } from '../utils/stripUndefinedFields';
import { toast } from '../utils/swal';
import { AccountDirectorySchema, AccountDirectoryZod } from '../types/zod/accountDirectorySchema';

const COLLECTION_NAME = 'account_directory_entries';
const accountDirectoryConverter = createConverter(AccountDirectorySchema);
const sortEntries = (rows: AccountDirectoryZod[]) => {
    return [...rows].sort((a, b) => {
        const categoryCompare = a.category.localeCompare(b.category);
        if (categoryCompare !== 0) return categoryCompare;
        const orderCompare = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
        if (orderCompare !== 0) return orderCompare;
        return String(a.name ?? '').localeCompare(String(b.name ?? ''), 'ko');
    });
};

export const accountDirectoryFirestoreService = {
    getCollection() {
        return collection(db, COLLECTION_NAME).withConverter(accountDirectoryConverter);
    },

    async getEntry(id: string): Promise<AccountDirectoryZod | null> {
        const docRef = doc(db, COLLECTION_NAME, id).withConverter(accountDirectoryConverter);
        const snap = await getDoc(docRef);
        return snap.exists() ? snap.data() : null;
    },

    async getEntries(): Promise<AccountDirectoryZod[]> {
        const snap = await getDocs(this.getCollection());
        return sortEntries(snap.docs.map((entry) => entry.data()));
    },

    async getEntriesByCategory(category: AccountDirectoryZod['category']): Promise<AccountDirectoryZod[]> {
        const snap = await getDocs(this.getCollection());
        return sortEntries(snap.docs.map((entry) => entry.data())).filter((entry) => entry.category === category);
    },

    async addEntry(data: Omit<AccountDirectoryZod, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
        const docRef = doc(collection(db, COLLECTION_NAME)).withConverter(accountDirectoryConverter);
        await setDoc(docRef, {
            ...data,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        } as any);
        toast.saved('계좌', 1);
        return docRef.id;
    },

    async updateEntry(id: string, data: Partial<AccountDirectoryZod>): Promise<void> {
        const docRef = doc(db, COLLECTION_NAME, id).withConverter(accountDirectoryConverter);
        await updateDoc(docRef, {
            ...stripUndefinedFields(data as Record<string, unknown>),
            updatedAt: serverTimestamp(),
        });
        toast.updated('계좌');
    },

    async deleteEntry(id: string): Promise<void> {
        await deleteDoc(doc(db, COLLECTION_NAME, id));
        toast.deleted('계좌', 1);
    },
};
