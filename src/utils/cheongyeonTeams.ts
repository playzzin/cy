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

export type WorkerAffiliationCategory = 'cheongyeon' | 'external' | 'unassigned';

interface WorkerAffiliationSource {
    companyId?: unknown;
    companyName?: unknown;
    teamType?: unknown;
}

const isUnassignedCompanyLabel = (value: unknown): boolean => {
    const normalized = String(value ?? '').trim();
    return !normalized || ['미배정', '미지정', '미소속'].includes(normalized);
};

/**
 * 작업자 목록의 소속 구분에 사용하는 공통 판정 규칙입니다.
 * 회사명/코드가 청연이면 청연 소속, 그 외 회사나 외부 지원팀이면 외부팀으로 봅니다.
 */
export const classifyWorkerAffiliation = (
    source: WorkerAffiliationSource,
    cheongyeonCompanyIds: ReadonlySet<string> = new Set<string>()
): WorkerAffiliationCategory => {
    const companyId = String(source.companyId ?? '').trim();
    const companyName = String(source.companyName ?? '').trim();
    const teamType = String(source.teamType ?? '').trim();

    if (
        isCheongyeonEngCompanyName(companyName) ||
        (companyId.length > 0 && cheongyeonCompanyIds.has(companyId))
    ) {
        return 'cheongyeon';
    }

    if (
        companyId.length > 0 ||
        !isUnassignedCompanyLabel(companyName) ||
        teamType === '지원팀'
    ) {
        return 'external';
    }

    return 'unassigned';
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
