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
    writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { WorkerSchema, WorkerZod } from '../types/zod/workerSchema';
import { createConverter } from '../utils/firestoreConverter';
import { toast } from '../utils/swal';

const COLLECTION_NAME = 'workers';
const workerConverter = createConverter(WorkerSchema);

export const workerFirestoreService = {
    getCollection() {
        return collection(db, COLLECTION_NAME).withConverter(workerConverter);
    },

    async getWorker(id: string): Promise<WorkerZod | null> {
        const docRef = doc(db, COLLECTION_NAME, id).withConverter(workerConverter);
        const snap = await getDoc(docRef);
        return snap.exists() ? snap.data() : null;
    },

    async getWorkers(): Promise<WorkerZod[]> {
        const q = query(this.getCollection(), orderBy('name', 'asc'));
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data());
    },

    /**
     * 특정 팀의 근로자 목록 조회
     */
    async getWorkersByTeam(teamId: string): Promise<WorkerZod[]> {
        const q = query(this.getCollection(), where('teamId', '==', teamId), orderBy('name', 'asc'));
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data());
    },

    async addWorker(data: Omit<WorkerZod, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
        const docRef = doc(collection(db, COLLECTION_NAME)).withConverter(workerConverter);
        await setDoc(docRef, {
            ...data,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        } as any);
        toast.saved('근로자', 1);
        return docRef.id;
    },

    async updateWorker(id: string, data: Partial<WorkerZod>): Promise<void> {
        const docRef = doc(db, COLLECTION_NAME, id).withConverter(workerConverter);
        await updateDoc(docRef, {
            ...data,
            updatedAt: serverTimestamp(),
        });
        toast.updated('근로자');
    },

    async deleteWorker(id: string): Promise<void> {
        await deleteDoc(doc(db, COLLECTION_NAME, id));
        toast.deleted('근로자', 1);
    },

    // 누적 공수 증가/감소
    async incrementManDay(id: string, amount: number): Promise<void> {
        const docRef = doc(db, COLLECTION_NAME, id);
        await updateDoc(docRef, {
            totalManDay: increment(amount),
            updatedAt: serverTimestamp(),
        });
    },

    // 배치 수정 (팀 일괄 변경 등)
    async updateWorkersBatch(workerIds: string[], data: Partial<WorkerZod>): Promise<void> {
        const batch = writeBatch(db);
        workerIds.forEach(id => {
            const docRef = doc(db, COLLECTION_NAME, id);
            batch.update(docRef, {
                ...data,
                updatedAt: serverTimestamp(),
            });
        });
        await batch.commit();
        toast.updated(`${workerIds.length}명의 근로자`);
    }
};
