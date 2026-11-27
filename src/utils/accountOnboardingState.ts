import type { UserData } from '../services/userService';

export type AccountOnboardingMode = 'active' | 'setup' | 'status';

export interface ResolveAccountOnboardingModeInput {
    profile: UserData | null;
    retrySetup: boolean;
    adminLike: boolean;
}

type AccessProfile = UserData & { systemRole?: unknown; roles?: unknown };
type RoleFields = Partial<Record<'role' | 'position' | 'systemRole' | 'roles' | 'additionalPositions', unknown>>;
const teamRoles = new Set(['팀장', '반장', 'teamlead', 'teamleader', 'foreman', 'posleader', 'posforeman']);
const scopedWorkerRoles = new Set(['user', 'general', '일반', 'worker', '작업자', ...teamRoles]);
const roleKey = (value: unknown) => typeof value === 'string' ? value.trim().toLowerCase().replace(/[\s_-]/g, '') : '';
const isScopedRole = (value: unknown) => scopedWorkerRoles.has(roleKey(value));
const isScopedRoleList = (value: unknown): value is string[] => Array.isArray(value) && value.every(isScopedRole);
const hasTeamRole = (access: RoleFields) =>
    [access.role, access.position, access.systemRole, access.roles, access.additionalPositions]
        .flatMap(value => Array.isArray(value) ? value : [value])
        .some(role => teamRoles.has(roleKey(role)));
const includesProfileRoles = (profileRoles: unknown, tokenRoles: string[]) =>
    profileRoles == null || (isScopedRoleList(profileRoles) && profileRoles.every(role =>
        tokenRoles.some(tokenRole => roleKey(tokenRole) === roleKey(role))));

/** The caller has already received the current user profile from Firestore. */
export function canReuseScopedWorkerClaims(profile: AccessProfile, claims: Record<string, unknown>): boolean {
    if (profile.status !== 'active' || profile.accountType !== 'worker' ||
        !Array.isArray(profile.linkedWorkerIds) || !profile.linkedWorkerIds.some(id => typeof id === 'string' && id.trim()) ||
        (profile.linkedCompanyIds != null && (!Array.isArray(profile.linkedCompanyIds) || profile.linkedCompanyIds.length > 0)) ||
        (profile.linkedOfficeStaffIds != null && (!Array.isArray(profile.linkedOfficeStaffIds) || profile.linkedOfficeStaffIds.length > 0)) ||
        claims.accessClaimsVersion !== 1 || claims.accountType !== 'worker' || claims.devPreview === true ||
        !isScopedRole(claims.role) || !isScopedRole(claims.position) ||
        (claims.systemRole != null && !isScopedRole(claims.systemRole)) ||
        !isScopedRoleList(claims.roles) || !isScopedRoleList(claims.additionalPositions) ||
        !Array.isArray(claims.erpRoleGroups) || claims.erpRoleGroups.some(group => group !== 'user') ||
        (hasTeamRole(claims) && !hasTeamRole(profile))) {
        return false;
    }
    return roleKey(profile.role ?? 'user') === roleKey(claims.role) &&
        roleKey(profile.position) === roleKey(claims.position) &&
        (profile.systemRole == null || roleKey(profile.systemRole) === roleKey(claims.systemRole)) &&
        includesProfileRoles(profile.roles, claims.roles) &&
        includesProfileRoles(profile.additionalPositions, claims.additionalPositions);
}

export const resolveAccountOnboardingMode = ({
    profile,
    retrySetup,
    adminLike,
}: ResolveAccountOnboardingModeInput): AccountOnboardingMode => {
    const hasApprovedPosition = Boolean(String(profile?.position || '').trim());
    const linkedWorkerCount = Array.isArray(profile?.linkedWorkerIds) ? profile.linkedWorkerIds.length : 0;
    const linkedCompanyCount = Array.isArray(profile?.linkedCompanyIds) ? profile.linkedCompanyIds.length : 0;
    const linkedOfficeCount = Array.isArray(profile?.linkedOfficeStaffIds) ? profile.linkedOfficeStaffIds.length : 0;
    const hasLegacyActiveAccess = Boolean(
        profile
        && !profile.status
        && hasApprovedPosition
        && (adminLike || profile.accountType || linkedWorkerCount || linkedCompanyCount || linkedOfficeCount)
    );
    if ((profile?.status === 'active' && hasApprovedPosition) || hasLegacyActiveAccess) return 'active';
    if (
        retrySetup
        || !profile
        || (profile.status === 'pending' && !profile.primaryLinkId && !profile.requestedAccountType)
    ) return 'setup';
    return 'status';
};
