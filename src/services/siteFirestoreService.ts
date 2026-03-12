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
    limit,
    serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { SiteSchema, SiteZod } from '../types/zod/siteSchema';
import { createConverter } from '../utils/firestoreConverter';
import { toast } from '../utils/swal';

const COLLECTION_NAME = 'sites';
const siteConverter = createConverter(SiteSchema);

export const siteFirestoreService = {
    getCollection() {
        return collection(db, COLLECTION_NAME).withConverter(siteConverter);
    },

    async getSite(id: string): Promise<SiteZod | null> {
        const docRef = doc(db, COLLECTION_NAME, id).withConverter(siteConverter);
        const snap = await getDoc(docRef);
        return snap.exists() ? snap.data() : null;
    },

    async getSites(): Promise<SiteZod[]> {
        const q = query(this.getCollection(), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data());
    },

    /**
     * 특정 업체의 현장 목록 조회
     */
    async getSitesByCompany(companyId: string): Promise<SiteZod[]> {
        const q = query(this.getCollection(), where('companyId', '==', companyId), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data());
    },

    async addSite(data: Omit<SiteZod, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
        const docRef = doc(collection(db, COLLECTION_NAME)).withConverter(siteConverter);
        await setDoc(docRef, {
            ...data,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        } as any);
        toast.saved('현장', 1);
        return docRef.id;
    },

    async updateSite(id: string, data: Partial<SiteZod>): Promise<void> {
        const docRef = doc(db, COLLECTION_NAME, id).withConverter(siteConverter);
        await updateDoc(docRef, {
            ...data,
            updatedAt: serverTimestamp(),
        });
        toast.updated('현장');
    },

    async deleteSite(id: string): Promise<void> {
        await deleteDoc(doc(db, COLLECTION_NAME, id));
        toast.deleted('현장', 1);
    },

    async getSiteByCode(code: string): Promise<SiteZod | null> {
        const q = query(this.getCollection(), where('code', '==', code), limit(1));
        const snap = await getDocs(q);
        return snap.empty ? null : snap.docs[0].data();
    }
};
