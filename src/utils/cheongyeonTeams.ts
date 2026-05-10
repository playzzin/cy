import type { Company } from '../services/companyService';
import type { Team } from '../services/teamService';

const normalizeCompanyKey = (value: unknown): string => (
    String(value ?? '')
        .toLowerCase()
        .replace(/주식회사|\(주\)|（주）|㈜|\(株\)/g, '')
        .replace(/[\s().,·ㆍ-]/g, '')
);

const CHEONGYEON_ENG_NAME_KEYS = ['청연이엔지', '청연eng', 'cheongyeoneng', 'cyeng'];
const CHEONGYEON_ENG_EXACT_KEYS = ['청연', 'cheongyeon', 'cy'];

export const isCheongyeonEngCompanyName = (value: unknown): boolean => {
    const normalized = normalizeCompanyKey(value);
    if (!normalized) return false;
    return (
        CHEONGYEON_ENG_NAME_KEYS.some((key) => normalized.includes(key)) ||
        CHEONGYEON_ENG_EXACT_KEYS.includes(normalized)
    );
};

const isCheongyeonEngCompany = (company: Company): boolean => (
    isCheongyeonEngCompanyName(company.name) ||
    ['cy', 'cyeng'].includes(normalizeCompanyKey(company.code))
);

export const buildCheongyeonEngTeams = (teamList: Team[], companyList: Company[]): Team[] => {
    const cheongyeonCompanies = companyList.filter(isCheongyeonEngCompany);
    const companyIds = new Set(
        cheongyeonCompanies
            .flatMap((company) => [company.id, company.legacyId])
            .map((id) => String(id ?? '').trim())
            .filter(Boolean)
    );

    return teamList
        .filter((team) => {
            const companyId = String(team.companyId ?? '').trim();
            if (companyId && companyIds.has(companyId)) return true;
            return isCheongyeonEngCompanyName(team.companyName);
        })
        .sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? ''), 'ko-KR'));
};
