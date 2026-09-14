import type { UserData } from '../services/userService';
import { resolveAccountOnboardingMode } from './accountOnboardingState';

const profile = (overrides: Partial<UserData>): UserData => ({
    uid: 'user-1',
    email: 'user@example.com',
    displayName: '신규 사용자',
    photoURL: null,
    lastLogin: null as unknown as UserData['lastLogin'],
    role: 'user',
    linkedWorkerIds: [],
    linkedCompanyIds: [],
    linkedOfficeStaffIds: [],
    linkedSiteIds: [],
    ...overrides,
});

describe('resolveAccountOnboardingMode', () => {
    it('keeps a pending account out of ERP even when accountType is already present', () => {
        expect(resolveAccountOnboardingMode({
            profile: profile({ status: 'pending', accountType: 'office', primaryLinkId: 'link-1' }),
            retrySetup: false,
            adminLike: false,
        })).toBe('status');
    });

    it('shows setup for a first-login pending user without a submitted request', () => {
        expect(resolveAccountOnboardingMode({
            profile: profile({ status: 'pending' }),
            retrySetup: false,
            adminLike: false,
        })).toBe('setup');
    });

    it('allows only an active account into ERP', () => {
        expect(resolveAccountOnboardingMode({
            profile: profile({ status: 'active', accountType: 'construction_company', position: '건설' }),
            retrySetup: false,
            adminLike: false,
        })).toBe('active');
    });

    it('returns an active but unassigned user to the approval status screen', () => {
        expect(resolveAccountOnboardingMode({
            profile: profile({ status: 'active', accountType: 'worker', position: '' }),
            retrySetup: false,
            adminLike: false,
        })).toBe('status');
    });

    it('lets a rejected user open setup only after choosing retry', () => {
        const rejected = profile({ status: 'rejected', requestedAccountType: 'worker' });
        expect(resolveAccountOnboardingMode({ profile: rejected, retrySetup: false, adminLike: false })).toBe('status');
        expect(resolveAccountOnboardingMode({ profile: rejected, retrySetup: true, adminLike: false })).toBe('setup');
    });

    it('keeps an existing legacy administrator active when status is absent', () => {
        expect(resolveAccountOnboardingMode({
            profile: profile({ status: undefined, role: 'admin', position: '사장' }),
            retrySetup: false,
            adminLike: true,
        })).toBe('active');
    });
});
