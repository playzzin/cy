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
    increment,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { TeamSchema, TeamZod } from '../types/zod/teamSchema';
import { createConverter } from '../utils/firestoreConverter';
import { toast } from '../utils/swal';

const COLLECTION_NAME = 'teams';
const teamConverter = createConverter(TeamSchema);

export const teamFirestoreService = {
    getCollection() {
        return collection(db, COLLECTION_NAME).withConverter(teamConverter);
    },

    async getTeam(id: string): Promise<TeamZod | null> {
        const docRef = doc(db, COLLECTION_NAME, id).withConverter(teamConverter);
        const snap = await getDoc(docRef);
        return snap.exists() ? snap.data() : null;
    },

    async getTeams(): Promise<TeamZod[]> {
        const q = query(this.getCollection(), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data());
    },

    /**
     * 특정 업체의 팀 목록 조회
     */
    async getTeamsByCompany(companyId: string): Promise<TeamZod[]> {
        const q = query(this.getCollection(), where('companyId', '==', companyId), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data());
    },

    async addTeam(data: Omit<TeamZod, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
        const docRef = doc(collection(db, COLLECTION_NAME)).withConverter(teamConverter);
        await setDoc(docRef, {
            ...data,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        } as any);
        toast.saved('팀', 1);
        return docRef.id;
    },

    async updateTeam(id: string, data: Partial<TeamZod>): Promise<void> {
        const docRef = doc(db, COLLECTION_NAME, id).withConverter(teamConverter);
        await updateDoc(docRef, {
            ...data,
            updatedAt: serverTimestamp(),
        });
        toast.updated('팀');
    },

    async deleteTeam(id: string): Promise<void> {
        await deleteDoc(doc(db, COLLECTION_NAME, id));
        toast.deleted('팀', 1);
    },

    // 누적 공수 증가/감소
    async incrementManDay(id: string, amount: number): Promise<void> {
        const docRef = doc(db, COLLECTION_NAME, id);
        await updateDoc(docRef, {
            totalManDay: increment(amount),
            updatedAt: serverTimestamp(),
        });
    }
};
