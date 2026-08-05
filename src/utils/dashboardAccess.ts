import {
    isAdminAccessRole,
    normalizeAccessRoleKey,
    uniqueAccessRoles,
} from './accessRoles';

const FULL_ACCESS_POSITION_KEYS = new Set(['full', 'ceo', 'owner', 'admin', 'administrator', 'superadmin']);

export const canUseAdminDashboardActions = (...roles: unknown[]): boolean => {
    return uniqueAccessRoles(roles).some((role) => {
        const roleKey = normalizeAccessRoleKey(role);
        return FULL_ACCESS_POSITION_KEYS.has(roleKey) || isAdminAccessRole(role);
    });
};

export const filterDashboardActionsByAccess = <T extends { adminOnly?: boolean }>(
    actions: T[],
    roles: unknown[]
): T[] => {
    const canUseAdminActions = canUseAdminDashboardActions(roles);
    return actions.filter((action) => !action.adminOnly || canUseAdminActions);
};
