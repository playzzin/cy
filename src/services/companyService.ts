import { companyFirestoreService } from './companyFirestoreService';
import { databaseLogService } from './databaseLogService';
import { CompanyZod as Company } from '../types/zod/companySchema';
import { stripUndefinedFields } from '../utils/stripUndefinedFields';

export type { Company };

const snapshotCompany = (id: string, data: Record<string, unknown>): Record<string, unknown> => ({
    id,
    ...stripUndefinedFields(data),
});

const logCompanyChange = async (
    action: 'created' | 'updated' | 'deleted',
    before: Record<string, unknown> | null,
    after: Record<string, unknown> | null,
    source = 'companyService'
): Promise<void> => {
    await databaseLogService.safeCreateLog({
        action,
        entityType: 'company',
        before,
        after,
        source,
    });
};

export const companyService = {
    // 회사 추가
    addCompany: async (company: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
        const id = await companyFirestoreService.addCompany(company as any);
        await logCompanyChange('created', null, snapshotCompany(id, company as Record<string, unknown>), 'companyService.addCompany');
        return id;
    },

    // 회사 정보 수정
    updateCompany: async (id: string, company: Partial<Company>): Promise<void> => {
        const existing = await companyFirestoreService.getCompany(id);
        const nameChanged = company.name && existing && existing.name !== company.name;
        const cleanedUpdates = stripUndefinedFields(company as Record<string, unknown>);
        await companyFirestoreService.updateCompany(id, cleanedUpdates as Partial<Company>);
        await logCompanyChange(
            'updated',
            existing ? snapshotCompany(id, existing as Record<string, unknown>) : null,
            snapshotCompany(id, { ...(existing ? existing as Record<string, unknown> : {}), ...cleanedUpdates }),
            'companyService.updateCompany'
        );

        if (nameChanged && company.name) {
            try {
                const { manpowerService } = await import('./manpowerService');
                await manpowerService.updateWorkersCompanyName(id, company.name);
            } catch (error) {
                console.error("Failed to sync company name to workers:", error);
            }
        }
    },

    // 회사 삭제
    deleteCompany: async (id: string): Promise<void> => {
        const existing = await companyFirestoreService.getCompany(id);
        await companyFirestoreService.deleteCompany(id);
        await logCompanyChange(
            'deleted',
            existing ? snapshotCompany(id, existing as Record<string, unknown>) : null,
            null,
            'companyService.deleteCompany'
        );
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
            await companyService.updateCompany(existing.id, company);
        } else {
            await companyService.addCompany({
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
    incrementManDay: async (companyId: string, amount: number): Promise<void> => {
        if (!companyId || amount === 0) return;
        await companyFirestoreService.incrementManDay(companyId, amount);
    },

    incrementConstructorManDay: async (companyId: string, amount: number): Promise<void> => {
        if (!companyId || amount === 0) return;
        await companyFirestoreService.incrementManDayFields(companyId, {
            constructorTotalManDay: amount,
        });
    },

    incrementPartnerManDay: async (companyId: string, amount: number): Promise<void> => {
        if (!companyId || amount === 0) return;
        await companyFirestoreService.incrementManDayFields(companyId, {
            partnerTotalManDay: amount,
        });
    },

    incrementManDayByTeam: async (teamId: string, amount: number): Promise<void> => {
        const { teamService } = await import('./teamService');
        const team = await teamService.getTeam(teamId);
        if (!team?.companyId) return;
        await companyFirestoreService.incrementManDay(team.companyId, amount);
    }
};
