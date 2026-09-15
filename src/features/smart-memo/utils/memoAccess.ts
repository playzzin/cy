import type { UserData } from '../../../services/userService';

const DEV_ROLES = new Set(['dev', 'developer', '개발', '개발자']);

export const canViewAllSmartMemos = (
    profile: Pick<UserData, 'role' | 'position' | 'additionalPositions' | 'status'> | null | undefined
): boolean => {
    if (!profile || (profile.status && profile.status !== 'active')) return false;

    return [
        profile.role,
        profile.position,
        ...(Array.isArray(profile.additionalPositions) ? profile.additionalPositions : [])
    ].some(value => DEV_ROLES.has(String(value ?? '').trim().normalize('NFKC').toLowerCase()));
};
