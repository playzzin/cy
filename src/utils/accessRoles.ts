import {
    ERP_ACCESS_ROLE_GROUPS,
    canAccessErpCollection,
    getErpRoleGroupKeys,
    getErpRoleGroupsForRoles,
    isErpAdminRole,
    normalizeErpAccessRole,
    normalizeErpAccessRoleKey,
    type ErpAccessOperation,
    type ErpAccessRoleGroup,
} from '../security/erpAccessPolicy';

export const ADMIN_ACCESS_ROLE_KEYS = getErpRoleGroupKeys(['admin']);

export const normalizeAccessRole = normalizeErpAccessRole;

export const normalizeAccessRoleKey = normalizeErpAccessRoleKey;

export const toAccessRoleList = (value: unknown): string[] => {
    if (Array.isArray(value)) {
        return value.map(normalizeAccessRole).filter(Boolean);
    }

    const normalized = normalizeAccessRole(value);
    return normalized ? [normalized] : [];
};

export const uniqueAccessRoles = (roles: unknown[]): string[] => {
    const seen = new Set<string>();
    const result: string[] = [];

    roles.flatMap(toAccessRoleList).forEach((role) => {
        const key = normalizeAccessRoleKey(role);
        if (!key || seen.has(key)) return;
        seen.add(key);
        result.push(role);
    });

    return result;
};

export const accessRoleListIncludes = (actualRoles: string[], allowedRoles: string[]): boolean => {
    const actualKeys = new Set(actualRoles.map(normalizeAccessRoleKey));
    return allowedRoles.some((role) => actualKeys.has(normalizeAccessRoleKey(role)));
};

export const isAdminAccessRole = (role: unknown): boolean => {
    return isErpAdminRole(role);
};

export const canAccessAllowedRoles = (actualRoles: string[], allowedRoles?: string[]): boolean => {
    const normalizedAllowedRoles = Array.isArray(allowedRoles)
        ? allowedRoles.map(normalizeAccessRole).filter(Boolean)
        : [];

    if (normalizedAllowedRoles.length === 0) return true;
    if (actualRoles.some(isAdminAccessRole)) return true;

    return accessRoleListIncludes(actualRoles, normalizedAllowedRoles);
};

export const getAccessRoleGroups = (roles: unknown[]): ErpAccessRoleGroup[] => {
    return getErpRoleGroupsForRoles(uniqueAccessRoles(roles));
};

export const canAccessCollection = (
    roles: unknown[],
    collectionId: string,
    operation: ErpAccessOperation = 'read'
): boolean => {
    return canAccessErpCollection(uniqueAccessRoles(roles), collectionId, operation);
};

export { ERP_ACCESS_ROLE_GROUPS };
