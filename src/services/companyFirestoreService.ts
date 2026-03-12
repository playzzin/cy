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
    startAfter,
    serverTimestamp,
    increment,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { CompanySchema, CompanyZod } from '../types/zod/companySchema';
import { createConverter } from '../utils/firestoreConverter';
import { toast } from '../utils/swal';

const COLLECTION_NAME = 'companies';
const companyConverter = createConverter(CompanySchema);

export const companyFirestoreService = {
    // 컬렉션 참조
    getCollection() {
        return collection(db, COLLECTION_NAME).withConverter(companyConverter);
    },

    // 단일 조회
    async getCompany(id: string): Promise<CompanyZod | null> {
        const docRef = doc(db, COLLECTION_NAME, id).withConverter(companyConverter);
        const snap = await getDoc(docRef);
        return snap.exists() ? snap.data() : null;
    },

    // 전체 조회
    async getCompanies(): Promise<CompanyZod[]> {
        const q = query(this.getCollection(), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data());
    },

    // 페이지네이션 조회
    async getCompaniesPaginated(limitCount: number, lastDoc: any = null): Promise<{ companies: CompanyZod[], lastDoc: any }> {
        let q = query(this.getCollection(), orderBy('createdAt', 'desc'), limit(limitCount));
        if (lastDoc) {
            q = query(this.getCollection(), orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(limitCount));
        }
        const snap = await getDocs(q);
        return {
            companies: snap.docs.map(d => d.data()),
            lastDoc: snap.docs[snap.docs.length - 1]
        };
    },

    // 회사 추가
    async addCompany(data: Omit<CompanyZod, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
        const docRef = doc(collection(db, COLLECTION_NAME)).withConverter(companyConverter);
        await setDoc(docRef, {
            ...data,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        } as any);
        toast.saved('회사', 1);
        return docRef.id;
    },

    // 회사 수정
    async updateCompany(id: string, data: Partial<CompanyZod>): Promise<void> {
        const docRef = doc(db, COLLECTION_NAME, id).withConverter(companyConverter);
        await updateDoc(docRef, {
            ...data,
            updatedAt: serverTimestamp(),
        });
        toast.updated('회사');
    },

    // 회사 삭제
    async deleteCompany(id: string): Promise<void> {
        await deleteDoc(doc(db, COLLECTION_NAME, id));
        toast.deleted('회사', 1);
    },

    // 회사 코드로 조회
    async getCompanyByCode(code: string): Promise<CompanyZod | null> {
        const q = query(this.getCollection(), where('code', '==', code), limit(1));
        const snap = await getDocs(q);
        return snap.empty ? null : snap.docs[0].data();
    },

    // 회사명으로 조회
    async getCompanyByName(name: string): Promise<CompanyZod | null> {
        const q = query(this.getCollection(), where('name', '==', name), limit(1));
        const snap = await getDocs(q);
        return snap.empty ? null : snap.docs[0].data();
    },

    // 마이컴퍼니 정보 조회
    async getMyCompanyInfo(): Promise<CompanyZod | null> {
        const q = query(this.getCollection(), where('isMyCompany', '==', true), limit(1));
        const snap = await getDocs(q);
        return snap.empty ? null : snap.docs[0].data();
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
