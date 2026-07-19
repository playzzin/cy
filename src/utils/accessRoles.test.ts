import {
    canAccessCollection,
    canAccessAllowedRoles,
    getAccessRoleGroups,
    isAdminAccessRole,
    uniqueAccessRoles
} from './accessRoles';

describe('accessRoles', () => {
    it('deduplicates roles case-insensitively while preserving first labels', () => {
        expect(uniqueAccessRoles(['Admin', ' admin ', ['user', 'USER'], '', null])).toEqual(['Admin', 'user']);
    });

    it('allows unrestricted configs when no allowed roles are configured', () => {
        expect(canAccessAllowedRoles([], undefined)).toBe(true);
        expect(canAccessAllowedRoles(['user'], [])).toBe(true);
    });

    it('matches configured roles case-insensitively', () => {
        expect(canAccessAllowedRoles(['Site_Manager'], ['site_manager'])).toBe(true);
        expect(canAccessAllowedRoles(['user'], ['site_manager'])).toBe(false);
    });

    it('lets admin-like roles pass restricted configs', () => {
        expect(isAdminAccessRole('admin')).toBe(true);
        expect(isAdminAccessRole('\uad00\ub9ac\uc790')).toBe(true);
        expect(canAccessAllowedRoles(['admin'], ['restricted-role'])).toBe(true);
    });

    it('resolves access role groups from mixed profile roles', () => {
        expect(getAccessRoleGroups(['user', 'PAYROLL_MANAGER'])).toContain('payroll');
        expect(getAccessRoleGroups(['developer'])).toContain('admin');
        expect(getAccessRoleGroups(['숙소 관리'])).toContain('support');
    });

    it('checks collection access through the shared ERP policy', () => {
        expect(canAccessCollection(['PAYROLL_MANAGER'], 'payments', 'read')).toBe(true);
        expect(canAccessCollection(['SITE_MANAGER'], 'payments', 'read')).toBe(false);
        expect(canAccessCollection(['SITE_MANAGER'], 'daily_reports', 'create')).toBe(true);
        expect(canAccessCollection(['manager1'], 'accommodations', 'write')).toBe(true);
        expect(canAccessCollection(['숙소 관리'], 'accommodations', 'write')).toBe(true);
    });
});
