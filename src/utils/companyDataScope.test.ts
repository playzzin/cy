import {
    companyDataScopeMatchesClientSite,
    companyDataScopeMatchesLaborRow,
    companyDataScopeMatchesMaterialTransaction,
    resolveCompanyDataScope,
} from './companyDataScope';
import type { UserData } from '../services/userService';

const profile = (overrides: Partial<UserData>): UserData => ({
    uid: 'user-1',
    email: 'user@example.com',
    displayName: '테스트 사용자',
    photoURL: null,
    lastLogin: {} as UserData['lastLogin'],
    ...overrides,
});

describe('companyDataScope', () => {
    it('발주사 계정은 연결된 회사의 현장과 노무 행만 허용한다', () => {
        const scope = resolveCompanyDataScope(profile({
            accountType: 'construction_company',
            linkedCompanyIds: ['client-a'],
        }));

        expect(scope.mode).toBe('construction-company');
        expect(companyDataScopeMatchesClientSite(scope, { clientCompanyId: 'client-a' })).toBe(true);
        expect(companyDataScopeMatchesClientSite(scope, { clientCompanyId: 'client-b' })).toBe(false);
        expect(companyDataScopeMatchesLaborRow(scope, { companyId: 'client-a' })).toBe(true);
        expect(companyDataScopeMatchesLaborRow(scope, { constructorCompanyId: 'client-b' })).toBe(false);
    });

    it('임대사 계정은 거래에 저장된 동일 임대사 ID만 허용한다', () => {
        const scope = resolveCompanyDataScope(profile({
            accountType: 'rental_company',
            linkedCompanyIds: ['rental-a'],
        }));

        expect(scope.mode).toBe('rental-company');
        expect(companyDataScopeMatchesMaterialTransaction(scope, { rentalCompanyId: 'rental-a' })).toBe(true);
        expect(companyDataScopeMatchesMaterialTransaction(scope, { rentalCompanyId: 'rental-b' })).toBe(false);
        expect(companyDataScopeMatchesMaterialTransaction(scope, {})).toBe(false);
    });

    it('외부 회사 연결이 없으면 전체가 아닌 차단 범위를 사용한다', () => {
        const scope = resolveCompanyDataScope(profile({ accountType: 'rental_company' }));

        expect(scope.mode).toBe('blocked');
        expect(companyDataScopeMatchesMaterialTransaction(scope, { rentalCompanyId: 'rental-a' })).toBe(false);
    });
});
