// Shared by notice reads, writes and notification delivery. Identity comes only
// from server-owned account links/worker UIDs, never display names or email.
type Row = Record<string, any>;
const text = (value: unknown) => String(value ?? '').trim();
const key = (value: unknown) => text(value).toLowerCase().replace(/[\s_-]/g, '');
const list = (value: unknown): string[] => {
    if (typeof value === 'string') { try { return list(JSON.parse(value)); } catch { return value.split(',').map(text).filter(Boolean); } }
    return Array.isArray(value) ? [...new Set(value.map(text).filter(Boolean))] : [];
};
export const activeNoticeUser = (user: Row | undefined): user is Row => !!user && user.isActive !== false && (!user.status || user.status === 'active');
const managerRoles = new Set(['admin', 'administrator', 'superadmin', 'owner', 'manager', '관리자', '사장', '실장', '매니저', 'dev', 'developer', 'systemadmin', '개발', '개발자', '시스템관리자']);
const leaderRoles = new Set(['팀장', '반장', 'teamlead', 'teamleader', 'foreman']);
const roleNames = (user: Row, menu: Row = {}) => {
    const raw = [user.role, user.position, user.systemRole, ...list(user.additionalPositions), ...list(user.roles)];
    const positions: Row[] = menu.admin?.positionConfig || [];
    return raw.flatMap(value => [value, positions.find(p => value === p.id || value === `pos_${p.id}`)?.name]).map(key).filter(Boolean);
};
export function isNoticeManager(user: Row | undefined, menu: Row = {}): boolean {
    return activeNoticeUser(user) && roleNames(user, menu).some(role => managerRoles.has(role));
}
const activeWorker = (worker: Row) => worker.isActive !== false && !['퇴사', 'inactive', 'retired', 'archived', 'suspended'].includes(text(worker.status));
export function noticeIdentity(user: Row, workers: Row[], teams: Row[], menu: Row = {}) {
    const linked = list(user.linkedWorkerIds);
    const ownWorkers = workers.filter(worker => activeWorker(worker) && (
        (user.uid && worker.uid === user.uid)
        || linked.some(id => [worker.id, worker.legacyId].includes(id)
            && workers.filter(candidate => [candidate.id, candidate.legacyId].includes(id)).length === 1)
    ));
    const roles = [...roleNames(user, menu), ...ownWorkers.map(worker => key(worker.role))];
    const ownTeams = teams.filter(team => team.isActive !== false && ownWorkers.some(worker => [team.id, team.legacyId].filter(Boolean).includes(worker.teamId)));
    const ledTeams = ownTeams.filter(team => ownWorkers.some(worker => [team.id, team.legacyId].filter(Boolean).includes(worker.teamId) && (
        roleNames(user, menu).some(role => leaderRoles.has(role)) || leaderRoles.has(key(worker.role))
        || (team.leaderId ? [worker.id, worker.legacyId].includes(team.leaderId)
            : team.leaderName && team.leaderName === worker.name && workers.filter(candidate => activeWorker(candidate)
                && [team.id, team.legacyId].filter(Boolean).includes(candidate.teamId) && candidate.name === team.leaderName).length === 1)
    )));
    return { roles, ownWorkers, ownTeams, ledTeams, isLeader: roles.some(role => leaderRoles.has(role)) || ledTeams.length > 0 };
}
export function matchesNoticeAudience(notice: Row, user: Row, workers: Row[], teams: Row[], menu: Row = {}): boolean {
    if (!activeNoticeUser(user)) return false;
    const identity = noticeIdentity(user, workers, teams, menu);
    switch (notice.audience || 'positions') {
        case 'all': return true;
        case 'teamLeaders': return identity.isLeader;
        case 'team': return !!notice.teamId && identity.ownTeams.some(team => team.id === notice.teamId);
        case 'positions': {
            const targets = list(notice.targetPositions).map(key);
            return !targets.length || targets.some(value => ['all', '*', 'global', '전체', '전체직책', '전직책', '모든직책'].includes(value))
                || identity.roles.some(role => targets.includes(role));
        }
        default: return false;
    }
}
export function canReadNotice(notice: Row, user: Row, workers: Row[], teams: Row[], menu: Row = {}, now = Date.now()): boolean {
    if (!activeNoticeUser(user)) return false;
    if (isNoticeManager(user, menu)) return true;
    return notice.status === 'published' && (!notice.expiresAt || notice.expiresAt.toMillis() > now)
        && matchesNoticeAudience(notice, user, workers, teams, menu);
}
export function canManageNotice(notice: Row, user: Row, workers: Row[], teams: Row[], menu: Row = {}): boolean {
    return activeNoticeUser(user) && (isNoticeManager(user, menu) || (
        notice.audience === 'team' && notice.createdBy?.uid === user.uid
        && noticeIdentity(user, workers, teams, menu).ledTeams.some(team => team.id === notice.teamId)
    ));
}
export function noticeBoardAccess(user: Row, workers: Row[], teams: Row[], menu: Row = {}) {
    const identity = noticeIdentity(user, workers, teams, menu);
    const isManager = isNoticeManager(user, menu);
    return { isManager, isTeamLeader: activeNoticeUser(user) && identity.isLeader,
        teams: (activeNoticeUser(user) ? (isManager ? teams.filter(team => team.isActive !== false) : identity.ledTeams) : [])
            .map(team => ({ id: team.id, name: text(team.name) || '소속 팀' })) };
}
