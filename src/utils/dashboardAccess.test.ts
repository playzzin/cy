import {
    canUseAdminDashboardActions,
    filterDashboardActionsByAccess,
} from './dashboardAccess';

describe('dashboardAccess', () => {
    const actions = [
        { label: '일반 메뉴' },
        { label: '관리자 메뉴', adminOnly: true },
    ];

    it('allows full access position keys to use admin dashboard actions', () => {
        expect(canUseAdminDashboardActions('full')).toBe(true);
        expect(canUseAdminDashboardActions('ceo')).toBe(true);
    });

    it('allows admin-like role names to use admin dashboard actions', () => {
        expect(canUseAdminDashboardActions('관리자')).toBe(true);
        expect(canUseAdminDashboardActions('developer')).toBe(true);
    });

    it('filters admin-only actions for regular dashboard roles', () => {
        expect(filterDashboardActionsByAccess(actions, ['worker'])).toEqual([
            { label: '일반 메뉴' },
        ]);
    });

    it('keeps admin-only actions for full access roles', () => {
        expect(filterDashboardActionsByAccess(actions, ['full'])).toEqual(actions);
    });
});
