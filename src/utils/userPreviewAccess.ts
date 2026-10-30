const normalize = (value: unknown) => String(value || '').trim().toLowerCase().replace(/^pos_/, '');
const previewRoles = new Set(['dev', 'developer', '개발', '개발자', 'ceo', '대표', '대표이사', '사장']);

export function canPreviewUsers(
    profile: { status?: unknown; role?: unknown; position?: unknown; systemRole?: unknown; roles?: unknown; additionalPositions?: unknown } | null | undefined,
    positions: Array<{ id: string; name: string }> = [],
): boolean {
    if (profile?.status !== 'active') return false;
    const roles = [profile.role, profile.position, profile.systemRole,
        ...(Array.isArray(profile.roles) ? profile.roles : []),
        ...(Array.isArray(profile.additionalPositions) ? profile.additionalPositions : [])];
    return roles.some(value => typeof value === 'string' && (previewRoles.has(normalize(value))
        || positions.some(position => normalize(position.id) === normalize(value) && previewRoles.has(normalize(position.name)))));
}
