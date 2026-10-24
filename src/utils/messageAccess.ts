import { isAdminAccessRole } from './accessRoles';

// Match the deployed team position ID as well as the legacy role names used by Firestore rules.
const readOnlyRoles = new Set(['팀장', '반장', 'teamlead', 'teamleader', 'foreman', 'mhoudnsutnunopenvfol']);
const key = (value: unknown) => String(value ?? '').trim().toLowerCase().replace(/^pos_/, '').replace(/[\s_-]/g, '');
export function isMessageReadOnlyProfile(profile: object | null | undefined): boolean {
    if (!profile) return true;
    const data = profile as Record<string, unknown>;
    const roles = ['role', 'position', 'systemRole', 'accountType', 'roles', 'additionalPositions']
        .flatMap(field => Array.isArray(data[field]) ? data[field] as unknown[] : [data[field]]);
    if (roles.some(isAdminAccessRole)) return false;
    return roles.some(role => readOnlyRoles.has(key(role)));
}
