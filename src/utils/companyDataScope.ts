import type { UserData } from '../services/userService';

export type CompanyDataScopeMode = 'all' | 'construction-company' | 'rental-company' | 'blocked';

export interface CompanyDataScope {
    loading: boolean;
    mode: CompanyDataScopeMode;
    label: string;
    profile: UserData | null;
    companyIds: string[];
}

const uniqueTexts = (values: unknown[]): string[] =>
    Array.from(new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean)));

export const normalizeCompanyAccessText = (value?: unknown): string =>
    String(value ?? '').replace(/\s+/g, '').trim().toLowerCase();

export const parseCompanyAccessLinkedIds = (raw?: unknown): string[] => {
    if (Array.isArray(raw)) return uniqueTexts(raw);

    const rawText = String(raw ?? '').trim();
    if (!rawText) return [];

    try {
        const parsed = JSON.parse(rawText);
        return Array.isArray(parsed) ? uniqueTexts(parsed) : [rawText];
    } catch {
        return [rawText];
    }
};

const buildScope = (
    mode: CompanyDataScopeMode,
    profile: UserData | null,
    companyIds: string[] = [],
    loading = false
): CompanyDataScope => ({
    loading,
    mode,
    label: mode === 'all'
        ? '전체 데이터'
        : mode === 'construction-company'
            ? '연결 발주사 현장'
            : mode === 'rental-company'
                ? '연결 임대사 거래'
                : '연결 회사 확인 필요',
    profile,
    companyIds: uniqueTexts(companyIds),
});

export const createLoadingCompanyDataScope = (): CompanyDataScope =>
    buildScope('blocked', null, [], true);

export const createBlockedCompanyDataScope = (profile: UserData | null = null): CompanyDataScope =>
    buildScope('blocked', profile);

const profileBypassesCompanyDataScope = (profile: UserData | null): boolean => {
    const accountType = normalizeCompanyAccessText(profile?.accountType).replace(/[-_]/g, '');
    if (accountType === 'office') return true;
    if (parseCompanyAccessLinkedIds(profile?.linkedOfficeStaffIds).length > 0) return true;

    const role = normalizeCompanyAccessText(profile?.role);
    return [
        'admin', 'administrator', 'manager', 'office',
        '관리자', '사장', '실장', '매니저', '본사', '사무',
    ].some((keyword) => role.includes(normalizeCompanyAccessText(keyword)));
};

const resolveExternalCompanyMode = (profile: UserData): CompanyDataScopeMode | null => {
    const accountType = normalizeCompanyAccessText(profile.accountType).replace(/[-_]/g, '');
    if (accountType === 'constructioncompany') return 'construction-company';
    if (accountType === 'rentalcompany') return 'rental-company';

    const roleText = [profile.role, profile.position, ...(profile.additionalPositions || [])]
        .map(normalizeCompanyAccessText)
        .join(' ');
    if (['발주', '건설', '시공', 'clientcompany', 'constructioncompany'].some((keyword) => roleText.includes(normalizeCompanyAccessText(keyword)))) {
        return 'construction-company';
    }
    if (['임대', 'rentalcompany', 'rental'].some((keyword) => roleText.includes(normalizeCompanyAccessText(keyword)))) {
        return 'rental-company';
    }

    return null;
};

/**
 * 메뉴 표시 권한과 별개로, 로그인 계정이 읽을 수 있는 회사 데이터 범위를 결정한다.
 * 외부 회사 계정에 연결 회사가 없으면 전체가 아니라 차단 범위로 처리한다.
 */
export const resolveCompanyDataScope = (profile: UserData | null): CompanyDataScope => {
    if (!profile) return createBlockedCompanyDataScope();
    if (profileBypassesCompanyDataScope(profile)) return buildScope('all', profile);

    const mode = resolveExternalCompanyMode(profile);
    if (!mode) return buildScope('all', profile);

    const companyIds = parseCompanyAccessLinkedIds(profile.linkedCompanyIds);
    return companyIds.length > 0
        ? buildScope(mode, profile, companyIds)
        : createBlockedCompanyDataScope(profile);
};

export const companyDataScopeMatchesId = (scope: CompanyDataScope, candidateIds: unknown[]): boolean => {
    if (scope.mode === 'all') return true;
    if (scope.mode === 'blocked') return false;

    const allowedIds = new Set(scope.companyIds);
    return candidateIds
        .map((value) => String(value ?? '').trim())
        .filter(Boolean)
        .some((value) => allowedIds.has(value));
};

/** 발주사 계정이 조회할 수 있는 현장인지 확인한다. */
export const companyDataScopeMatchesClientSite = (
    scope: CompanyDataScope,
    site: { clientCompanyId?: unknown; constructorCompanyId?: unknown; companyId?: unknown }
): boolean => {
    if (scope.mode === 'all') return true;
    if (scope.mode !== 'construction-company') return false;

    // 기존 현장 데이터의 세 회사 ID 필드를 함께 호환하되, 명칭 비교는 허용하지 않는다.
    return companyDataScopeMatchesId(scope, [site.clientCompanyId, site.constructorCompanyId, site.companyId]);
};

/** 발주사 계정의 노무 행은 회사 ID가 일치할 때만 표시한다. */
export const companyDataScopeMatchesLaborRow = (
    scope: CompanyDataScope,
    row: { companyId?: unknown; constructorCompanyId?: unknown; clientCompanyId?: unknown }
): boolean => {
    if (scope.mode === 'all') return true;
    if (scope.mode !== 'construction-company') return false;
    return companyDataScopeMatchesId(scope, [row.companyId, row.constructorCompanyId, row.clientCompanyId]);
};

/** 임대사 계정의 거래는 거래 자체에 저장된 임대사 ID가 일치해야 한다. */
export const companyDataScopeMatchesMaterialTransaction = (
    scope: CompanyDataScope,
    transaction: { rentalCompanyId?: unknown; counterpartyCompanyId?: unknown }
): boolean => {
    if (scope.mode === 'all' || scope.mode === 'construction-company') return true;
    if (scope.mode !== 'rental-company') return false;
    return companyDataScopeMatchesId(scope, [transaction.rentalCompanyId, transaction.counterpartyCompanyId]);
};
