import { MENU_PATHS } from '../constants/menuPaths';
import type { MenuItem } from '../types/menu';
const key = (value: unknown) => String(value ?? '').toLowerCase().replace(/[\s_-]/g, '');
export const isTeamLeaderRole = (value: unknown) => ['팀장', 'teamlead', 'teamleader'].includes(key(value));
const officeRoles = new Set(['admin', 'administrator', 'superadmin', 'owner', 'developer', 'dev', 'systemadmin', '관리자', '사장', '실장', '개발자', 'office', 'officestaff', '사무실직원', '사무직원', '사무', 'manager', 'manager1', 'manager2', 'manager3', 'sitemanager', '현장관리자', '현장소장', '매니저', '메니저', 'payrollmanager', 'finance', 'accounting', '회계', '재무', '경리']);
export function isRestrictedTeamLeader(profile: any, positions: Array<{id: string; name: string}> = [], workers: any[] = []) {
    const roles = [profile?.role, profile?.position, profile?.systemRole, profile?.accountType, ...(profile?.roles || []), ...(profile?.additionalPositions || [])]
        .flatMap(value => [value, positions.find(position => value === position.id || value === `pos_${position.id}`)?.name]);
    if (roles.some(value => officeRoles.has(key(value)))) return false;
    return [...roles, ...workers.map(worker => worker.role)].some(isTeamLeaderRole);
}
const readAliases = new Set(['/manpower/team-worker-daily-report', '/reports/daily-worker-calendar', '/reports/worker-calendar', '/reports/daily-logs', '/reports/labor-check', '/jeonkuk/total-history']);
const blocked = new Set(['/reports/daily', '/reports/daily-v2', '/assignment/off-duty-request', '/worker/off-duty-request', '/database/manpower-db', '/database/team-db', '/database/worker-input', '/manpower', '/mass-upload/daily-report', '/mass-upload/daily-report-integrated', '/mass-upload/integrated', '/upload/worker']);
export const teamWorkflowDestination = (path: string): 'work' | 'blocked' | null => {
    const pathname = path.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
    if (readAliases.has(pathname)) return 'work';
    if (blocked.has(pathname)) return 'blocked';
    return null;
};
const removedLabels = new Set(['일보작성', '보드입력', '일보보드입력', '일보목록', '일보목록v2', '출력일보', '개인달력', '노임체크', '인원전체관리', '인원전체내역조회', '휴무신청', '작업자휴무신청', '내휴무신청']);
export const hideTeamWorkflowLink = (item: { text?: string; path?: string }) => {
    const path = (item.path || MENU_PATHS[item.text || ''] || '').split(/[?#]/)[0].replace(/\/+$/, '');
    // The dedicated site calendar replaces the retired general report menu.
    if (path === '/manpower/site-daily-report') return false;
    return removedLabels.has(String(item.text ?? '').replace(/\s/g, '')) || Boolean(teamWorkflowDestination(path));
};

export function filterTeamWorkflowMenu(items: (MenuItem | string)[]): MenuItem[] {
    return items.flatMap(value => {
        const item = typeof value === 'string' ? { text: value } : value;
        if (hideTeamWorkflowLink(item)) return [];
        const sub = item.sub ? filterTeamWorkflowMenu(item.sub) : undefined;
        if (sub && !sub.length && !item.path) return [];
        return [{ ...item, ...(sub ? { sub } : {}) }];
    });
}
