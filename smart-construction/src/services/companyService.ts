import { db } from '../config/firebase';
import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    getDocs,
    query,
    orderBy,
    serverTimestamp,
    Timestamp,
    getDoc,
    increment,
    where,
    limit
} from 'firebase/firestore';

export interface Company {
    id?: string;
    name: string;
    code: string;
    businessNumber: string; // 사업자번호
    ceoName: string; // 대표자명
    address: string; // 주소
    phone: string; // 전화번호
    email?: string; // 이메일
    type: '미지정' | '시공사' | '협력사' | '건설사' | '기타'; // 회사 구분
    bankName?: string; // 은행명
    accountNumber?: string; // 계좌번호
    accountHolder?: string; // 예금주
    siteName?: string; // 현장명 (Legacy or Primary)
    siteManager?: string; // 현장담당자
    siteIds?: string[]; // 담당 현장 IDs
    siteNames?: string[]; // 담당 현장 이름들
    status?: 'active' | 'inactive' | 'archived'; // 상태 (거래중, 거래중지, 폐업/삭제)
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
    color?: string; // 회사 식별용 색상 (HEX)
    iconKey?: string;
    totalManDay?: number; // 누적 공수 (팀/현장 일보 기준)
    assignedClientCompanyIds?: string[]; // 시공사가 맡는 건설사(클라이언트) IDs
}

const COLLECTION_NAME = 'companies';

export const companyService = {
    // 회사 추가
    addCompany: async (company: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
        const docRef = await addDoc(collection(db, COLLECTION_NAME), {
            ...company,
            siteName: company.siteName || '',
            siteManager: company.siteManager || '',
            siteIds: company.siteIds || [],
            siteNames: company.siteNames || [],
            assignedClientCompanyIds: company.assignedClientCompanyIds || [],
            status: company.status || 'active', // Default to active
            iconKey: company.iconKey || '',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        return docRef.id;
    },

    // 회사 정보 수정
    updateCompany: async (id: string, company: Partial<Company>): Promise<void> => {
        const docRef = doc(db, COLLECTION_NAME, id);

        // 1. Get current data to check if name changed (Optimization & Safety)
        const currentSnap = await getDoc(docRef);
        const currentData = currentSnap.data() as Company;

        await updateDoc(docRef, {
            ...company,
            updatedAt: serverTimestamp()
        });

        // 2. Sync if name changed
        if (company.name && currentData && currentData.name !== company.name) {
            try {
                const { manpowerService } = await import('./manpowerService');
                // Don't await strictly if we want faster UI response? 
                // No, for "Data Integrity", we should await to ensure it's done or catch errors.
                await manpowerService.updateWorkersCompanyName(id, company.name);
            } catch (syncError) {
                console.error("Failed to sync worker company names:", syncError);
                // Optional: Toast warning? toast.warning("회사명 변경이 작업자 데이터에 완전히 반영되지 않았을 수 있습니다.");
            }
        }
    },

    // 회사 삭제
    deleteCompany: async (id: string): Promise<void> => {
        await deleteDoc(doc(db, COLLECTION_NAME, id));
    },

    // 전체 회사 목록 조회
    getCompanies: async (): Promise<Company[]> => {
        const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Company));
    },

    getCompanyById: async (id: string): Promise<Company | null> => {
        const companyRef = doc(db, COLLECTION_NAME, id);
        const snap = await getDoc(companyRef);
        if (!snap.exists()) return null;
        return { id: snap.id, ...snap.data() } as Company;
    },

    // 회사 코드로 조회
    getCompanyByCode: async (code: string): Promise<Company | null> => {
        const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        const companies = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Company));

        return companies.find(company => company.code === code) || null;
    },

    // 회사명으로 조회
    getCompanyByName: async (name: string): Promise<Company | null> => {
        // Optimization: Ideally use 'where' query, but 'name' might require precise match or normalization.
        // For mass upload, exact match is usually expected.
        const q = query(collection(db, COLLECTION_NAME), where('name', '==', name), limit(1));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) return null;
        return { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() } as Company;
    },

    // 활성 회사만 조회
    getActiveCompanies: async (): Promise<Company[]> => {
        const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs
            .map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Company))
            .filter(company => company.status === 'active' || !company.status); // Backwards compatibility for existing data
    },

    // 회사 타입별 조회
    getCompaniesByType: async (type: Company['type']): Promise<Company[]> => {
        const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs
            .map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Company))
            .filter(company => company.type === type);
    },

    // 회사명 검색
    searchCompanies: async (searchTerm: string): Promise<Company[]> => {
        const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        const companies = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Company));

        return companies.filter(company =>
            company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            company.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
            company.ceoName.toLowerCase().includes(searchTerm.toLowerCase())
        );
    },

    // 팀 기준으로 회사 누적 공수 증가/감소
    incrementManDayByTeam: async (teamId: string, amount: number): Promise<void> => {
        try {
            if (!teamId || amount === 0) return;

            // 팀에서 회사 ID 조회
            const teamRef = doc(db, 'teams', teamId);
            const teamSnap = await getDoc(teamRef);
            if (!teamSnap.exists()) return;

            const teamData = teamSnap.data() as { companyId?: string };
            const companyId = teamData.companyId;
            if (!companyId) return;

            const companyRef = doc(db, COLLECTION_NAME, companyId);
            await updateDoc(companyRef, {
                totalManDay: increment(amount),
                updatedAt: serverTimestamp()
            });
        } catch (error) {
            console.error(`Error incrementing man-day for company by team ${teamId}:`, error);
        }
    }
};
