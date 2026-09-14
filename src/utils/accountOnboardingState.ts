import type { UserData } from '../services/userService';

export type AccountOnboardingMode = 'active' | 'setup' | 'status';

export interface ResolveAccountOnboardingModeInput {
    profile: UserData | null;
    retrySetup: boolean;
    adminLike: boolean;
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
