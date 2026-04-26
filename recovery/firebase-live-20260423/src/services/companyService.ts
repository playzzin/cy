import { companyFirestoreService } from './companyFirestoreService';
import { CompanyZod as Company } from '../types/zod/companySchema';

export type { Company };

export const companyService = {
    // 회사 추가
    addCompany: async (company: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
        return companyFirestoreService.addCompany(company as any);
    },

    // 회사 정보 수정
    updateCompany: async (id: string, company: Partial<Company>): Promise<void> => {
        return companyFirestoreService.updateCompany(id, company);
    },

    // 회사 삭제
    deleteCompany: async (id: string): Promise<void> => {
        return companyFirestoreService.deleteCompany(id);
    },

    // 전체 회사 목록 조회
    getCompanies: async (): Promise<Company[]> => {
        return companyFirestoreService.getCompanies();
    },

    getCompanyById: async (id: string): Promise<Company | null> => {
        let company = await companyFirestoreService.getCompany(id);
        if (!company) {
            // legacyId로 fallback 조회 (필요한 경우 companyFirestoreService에 추가해도 되지만 일단 여기서 구현)
            const companies = await companyFirestoreService.getCompanies();
            company = companies.find(c => c.legacyId === id) || null;
        }
        return company;
    },

    // 회사 코드로 조회
    getCompanyByCode: async (code: string): Promise<Company | null> => {
        return companyFirestoreService.getCompanyByCode(code);
    },

    // 회사명으로 조회
    getCompanyByName: async (name: string): Promise<Company | null> => {
        return companyFirestoreService.getCompanyByName(name);
    },

    // 활성 회사만 조회
    getActiveCompanies: async (): Promise<Company[]> => {
        const companies = await companyFirestoreService.getCompanies();
        return companies.filter(c => c.status === 'active' || !c.status);
    },

    // 회사 타입별 조회
    getCompaniesByType: async (type: Company['type']): Promise<Company[]> => {
        const companies = await companyFirestoreService.getCompanies();
        return companies.filter(c => c.type === type);
    },

    // 회사명 검색
    searchCompanies: async (searchTerm: string): Promise<Company[]> => {
        const companies = await companyFirestoreService.getCompanies();
        const term = searchTerm.toLowerCase();
        return companies.filter(company =>
            company.name.toLowerCase().includes(term) ||
            company.code.toLowerCase().includes(term) ||
            (company as any).ceoName?.toLowerCase().includes(term)
        );
    },

    // 마이컴퍼니 정보 조회 (세금계산서용)
    getMyCompanyInfo: async (): Promise<Company | null> => {
        return companyFirestoreService.getMyCompanyInfo();
    },

    // 마이컴퍼니 정보 저장
    saveMyCompanyInfo: async (company: Partial<Company>): Promise<void> => {
        const existing = await companyFirestoreService.getMyCompanyInfo();
        if (existing?.id) {
            await companyFirestoreService.updateCompany(existing.id, company);
        } else {
            await companyFirestoreService.addCompany({
                ...company,
                isMyCompany: true,
            } as any);
        }
    },

    // 회사 페이지네이션 조회
    getCompaniesPaginated: async (limitCount: number, lastDoc: any = null): Promise<{ companies: Company[], lastDoc: any }> => {
        return companyFirestoreService.getCompaniesPaginated(limitCount, lastDoc);
    },

    // 팀 기준으로 회사 누적 공수 증가/감소
    incrementManDayByTeam: async (teamId: string, amount: number): Promise<void> => {
        const { teamService } = await import('./teamService');
        const team = await teamService.getTeam(teamId);
        if (!team?.companyId) return;
        await companyFirestoreService.incrementManDay(team.companyId, amount);
    }
};
