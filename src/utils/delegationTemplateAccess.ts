import { getAccessRoleGroups } from './accessRoles';

export interface DelegationTemplateAccessProfile {
    role?: unknown;
    position?: unknown;
    systemRole?: unknown;
    accountType?: unknown;
    roles?: unknown;
    additionalPositions?: unknown;
}

export const canEditDelegationTemplate = (
    profile: DelegationTemplateAccessProfile | null | undefined
): boolean => {
    if (!profile) return false;

    const groups = getAccessRoleGroups([
        profile.role,
        profile.position,
        profile.systemRole,
        profile.accountType,
        profile.roles,
        profile.additionalPositions,
    ]);

    return groups.includes('admin') || groups.includes('site');
};
