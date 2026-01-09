
import app from '../config/firebase';
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createCompany, listCompanies, updateCompany, deleteCompany, getCompany, Status } from '../dataconnect-generated';
import { Timestamp } from 'firebase/firestore';

const dc = getDataConnect(app, connectorConfig);

let didWarnIncrementManDayByTeamNotImplemented = false;

export interface Company {
    id?: string;
    name: string;
    code: string;
    businessNumber: string;
    ceoName: string;
    idNumber?: string;
    address: string;
    phone: string;
    email?: string;
    type: '미지정' | '시공사' | '협력사' | '건설사' | '기타';
    bankName?: string;
    accountNumber?: string;
    accountHolder?: string;
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
        name: data.name,
        code: data.code,
        businessNumber: data.businessNumber || '',
        ceoName: data.ceoName || '',
        type: (data.type as any) || '미지정',
        status: data.status === Status.ACTIVE ? 'active' : 'inactive',
        createdAt: toTimestamp(data.createdAt),
        updatedAt: undefined, // DataConnect might not return updatedAt yet

        // Fields potentially missing in Data Connect Schema or reserved for future use
        idNumber: '',
        address: '',
        phone: '',
        email: '',
        bankName: '',
        accountNumber: '',
        accountHolder: '',
        siteName: '',
        siteManager: '',
        siteIds: [],
        siteNames: [],
        color: '',
        iconKey: '',
        totalManDay: 0,
        assignedClientCompanyIds: []
    } as Company;
};

export const companyService = {
    // 회사 추가
    addCompany: async (company: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
        const response = await createCompany(dc, {
            name: company.name,
            code: company.code,
            businessNumber: company.businessNumber,
            ceoName: company.ceoName,
            type: company.type,
            status: company.status === 'inactive' ? Status.INACTIVE : Status.ACTIVE
        });
        return response.data.company_insert.id;
    },

    // 회사 정보 수정
    updateCompany: async (id: string, company: Partial<Company>): Promise<void> => {
        await updateCompany(dc, {
            id: id,
            name: company.name,
            code: company.code,
            businessNumber: company.businessNumber,
            ceoName: company.ceoName,
            type: company.type,
            status: company.status === 'inactive' ? Status.INACTIVE : Status.ACTIVE
        });
    },

    // 회사 삭제
    deleteCompany: async (id: string): Promise<void> => {
        await deleteCompany(dc, { id: id });
    },

    // 전체 회사 목록 조회
    getCompanies: async (): Promise<Company[]> => {
        const response = await listCompanies(dc);
        return response.data.companies.map(mapToLegacyCompany);
    },

    getCompanyById: async (id: string): Promise<Company | null> => {
        try {
            const response = await getCompany(dc, { id: id });
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
        return companies.find(c => c.code === code) || null;
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
            company.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
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
