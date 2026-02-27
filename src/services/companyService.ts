import { dc, db } from '../config/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { createCompany, listAllCompanies, updateCompany, deleteCompany, getCompany, Status } from '../dataconnect-generated';
import { Timestamp } from '../types/timestamp';

const isUuidString = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const dcCompanyLegacyIdToUuid = new Map<string, string>();
let dcCompaniesLoaded = false;

const loadDcCompanies = async (): Promise<void> => {
    if (dcCompaniesLoaded) return;
    const response = await listAllCompanies(dc);
    const rows = (response as any)?.data?.companies ?? [];
    dcCompanyLegacyIdToUuid.clear();
    for (const row of rows) {
        const legacyId = row?.legacyId ? String(row.legacyId) : '';
        const id = row?.id ? String(row.id) : '';
        if (legacyId && id) dcCompanyLegacyIdToUuid.set(legacyId, id);
        if (id) dcCompanyLegacyIdToUuid.set(id, id);
    }
    dcCompaniesLoaded = true;
};

const resolveCompanyUuid = async (id: string): Promise<string | null> => {
    const raw = id ? String(id) : '';
    if (!raw) return null;
    if (isUuidString(raw)) return raw;
    await loadDcCompanies();
    const existing = dcCompanyLegacyIdToUuid.get(raw);
    if (existing) return existing;

    dcCompaniesLoaded = false;
    await loadDcCompanies();
    return dcCompanyLegacyIdToUuid.get(raw) ?? null;
};

let didWarnIncrementManDayByTeamNotImplemented = false;

export interface Company {
    id?: string;
    legacyId?: string;
    name: string;
    code?: string;
    businessNumber: string;
    ceoName: string;
    address: string;
    phone: string;
    email?: string;
    type: '미지정' | '시공사' | '협력사' | '건설사' | '기타';
    bankName?: string;
    accountNumber?: string;
    accountHolder?: string;
    ceoResidentNumber?: string;
    siteName?: string;
    siteManager?: string;
    siteIds?: string[];
    siteNames?: string[];
    status?: 'active' | 'inactive' | 'archived';
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
    color?: string;
    iconKey?: string;
    totalManDay?: number;
    assignedClientCompanyIds?: string[];
}

const mapToLegacyCompany = (data: any): Company => {
    // Helper to safely parse dates/timestamps
    const toTimestamp = (dateStr?: string | null) => {
        if (!dateStr) return undefined;
        try {
            return Timestamp.fromDate(new Date(dateStr));
        } catch {
            return undefined;
        }
    };

    return {
        id: data.id,
        legacyId: data.legacyId ? String(data.legacyId) : undefined,
        name: data.name,
        code: data.code || '',
        businessNumber: data.businessNumber || '',
        ceoName: data.ceoName || '',
        type: (data.type as any) || '미지정',
        status: data.status === Status.ACTIVE ? 'active' : (data.status === Status.ARCHIVED ? 'archived' : 'inactive'),
        createdAt: toTimestamp(data.createdAt),
        updatedAt: undefined, // DataConnect might not return updatedAt yet

        // Fields potentially missing in Data Connect Schema or reserved for future use
        address: data.address || '',
        phone: data.phone || '',
        email: data.email || '',
        bankName: data.bankName || '',
        accountNumber: data.accountNumber || '',
        accountHolder: data.accountHolder || '',
        ceoResidentNumber: data.ceoResidentNumber || '',
        color: data.color || '',
        siteName: '',
        siteManager: '',
        siteIds: [],
        siteNames: [],
        iconKey: '',
        totalManDay: 0,
        assignedClientCompanyIds: []
    } as Company;
};

export const companyService = {
    // 회사 추가
    addCompany: async (company: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
        try {
            const legacyId = (company as any)?.legacyId;
            const response = await createCompany(dc, {
                name: company.name,
                code: company.code || '',
                legacyId: legacyId ? String(legacyId) : null,
                businessNumber: company.businessNumber,
                ceoName: company.ceoName,
                type: company.type,

                status: company.status === 'inactive' ? Status.INACTIVE : Status.ACTIVE,
                address: company.address || null,
                phone: company.phone || null,
                email: company.email || null,
                bankName: company.bankName || null,
                accountNumber: company.accountNumber || null,
                accountHolder: company.accountHolder || null,
                ceoResidentNumber: company.ceoResidentNumber || null,
                color: company.color || null
            } as any);
            return response.data.company_insert.id;
        } catch (error) {
            console.error("DataConnect: createCompany failed in addCompany", error);
            throw error;
        }
    },

    // 회사 정보 수정
    updateCompany: async (id: string, company: Partial<Company>): Promise<void> => {
        try {
            const uuid = await resolveCompanyUuid(id);
            if (!uuid) throw new Error('Company not found');

            const vars: any = { id: uuid };
            if (company.name !== undefined) vars.name = company.name;
            if (company.code !== undefined) vars.code = company.code;
            if (company.businessNumber !== undefined) vars.businessNumber = company.businessNumber;
            if (company.ceoName !== undefined) vars.ceoName = company.ceoName;
            if (company.type !== undefined) vars.type = company.type;
            if (company.status !== undefined) {
                vars.status = company.status === 'inactive'
                    ? Status.INACTIVE
                    : (company.status === 'archived' ? Status.ARCHIVED : Status.ACTIVE);
            }
            if (company.address !== undefined) vars.address = company.address;
            if (company.phone !== undefined) vars.phone = company.phone;
            if (company.email !== undefined) vars.email = company.email;
            if (company.bankName !== undefined) vars.bankName = company.bankName;
            if (company.accountNumber !== undefined) vars.accountNumber = company.accountNumber;
            if (company.accountHolder !== undefined) vars.accountHolder = company.accountHolder;
            if (company.ceoResidentNumber !== undefined) vars.ceoResidentNumber = company.ceoResidentNumber;
            if (company.color !== undefined) vars.color = company.color;

            await updateCompany(dc, vars);
            dcCompaniesLoaded = false;
        } catch (error) {
            console.error("DataConnect: updateCompany failed in updateCompany", error);
            throw error;
        }
    },

    // 회사 삭제
    deleteCompany: async (id: string): Promise<void> => {
        try {
            const uuid = await resolveCompanyUuid(id);
            if (!uuid) return;
            await deleteCompany(dc, { id: uuid });
            dcCompaniesLoaded = false;
        } catch (error) {
            console.error("DataConnect: deleteCompany failed in deleteCompany", error);
            throw error;
        }
    },

    // 전체 회사 목록 조회
    getCompanies: async (): Promise<Company[]> => {
        try {
            const response = await listAllCompanies(dc);
            const mapped = response.data.companies.map(mapToLegacyCompany);
            dcCompaniesLoaded = false;
            return mapped;
        } catch (error) {
            console.error("DataConnect: listCompanies failed in getCompanies", error);
            return [];
        }
    },

    /**
     * 자사 정보 (공급자 정보) 조회
     * 저장된 정보가 없으면 null 반환
     */
    async getMyCompanyInfo(): Promise<Record<string, any> | null> {
        try {
            const docRef = doc(db, 'settings', 'company_info');
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                // Ensure default structure if fields missing
                return data;
            }
            return null;
        } catch (error) {
            console.error('Error getting my company info:', error);
            return null;
        }
    },

    /**
     * 자사 정보 (공급자 정보) 저장
     */
    async saveMyCompanyInfo(info: Record<string, any>): Promise<void> {
        try {
            const docRef = doc(db, 'settings', 'company_info');
            await setDoc(docRef, { ...info, updatedAt: new Date() }, { merge: true });
        } catch (error) {
            console.error('Error saving my company info:', error);
            throw error;
        }
    },

    getCompanyById: async (id: string): Promise<Company | null> => {
        try {
            const uuid = await resolveCompanyUuid(id);
            if (!uuid) return null;

            const response = await getCompany(dc, { id: uuid });
            if (!response.data.company) return null;
            return mapToLegacyCompany({ ...response.data.company, id: response.data.company.id });
        } catch (e) {
            console.error(e);
            return null;
        }
    },

    // 회사 코드로 조회
    getCompanyByCode: async (code: string): Promise<Company | null> => {
        const companies = await companyService.getCompanies();
        return companies.find(c => (c.code ?? '') === code) || null;
    },

    // 회사명으로 조회
    getCompanyByName: async (name: string): Promise<Company | null> => {
        const companies = await companyService.getCompanies();
        return companies.find(c => c.name === name) || null;
    },

    // 활성 회사만 조회
    getActiveCompanies: async (): Promise<Company[]> => {
        const companies = await companyService.getCompanies();
        return companies.filter(c => c.status === 'active' || !c.status);
    },

    // 회사 타입별 조회
    getCompaniesByType: async (type: Company['type']): Promise<Company[]> => {
        const companies = await companyService.getCompanies();
        return companies.filter(c => c.type === type);
    },

    // 회사명 검색
    searchCompanies: async (searchTerm: string): Promise<Company[]> => {
        const companies = await companyService.getCompanies();
        return companies.filter(company =>
            company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (company.code ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            company.ceoName.toLowerCase().includes(searchTerm.toLowerCase())
        );
    },

    // 팀 기준으로 회사 누적 공수 증가/감소 (구현 보류/간소화)
    incrementManDayByTeam: async (teamId: string, amount: number): Promise<void> => {
        // DataConnect doesn't support increment easily yet. 
        // For now, logging to console as a placeholder or TODO.
        if (!didWarnIncrementManDayByTeamNotImplemented) {
            didWarnIncrementManDayByTeamNotImplemented = true;
            console.warn("incrementManDayByTeam not fully implemented in Data Connect migration yet.");
        }
    }
};
