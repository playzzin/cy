const params = new URLSearchParams(window.location.search);
const restricted = params.get('mode') === 'leader';
const team = { id: 'qa-team', name: '검증팀', companyName: '청연이엔지' };
const now = new Date();
const monthOf = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const month = monthOf(now);
const previousMonth = monthOf(new Date(now.getFullYear(), now.getMonth() - 1, 1));
const sites = [
    { id: 'worked', name: '가상 이번달현장' },
    { id: 'empty', name: '가상 미출력현장' },
    { id: 'zero', name: '가상 영공수현장' },
    { id: 'previous', name: '가상 지난달현장' },
].map(site => ({ ...site, status: 'active', responsibleTeamId: team.id, responsibleTeamName: team.name }));
const rows = [
    { siteId: 'worked', date: `${month}-01`, manDay: 1 },
    { siteId: 'zero', date: `${month}-01`, manDay: 0 },
    { siteId: 'previous', date: `${previousMonth}-01`, manDay: 1 },
].map(row => ({ ...row, reportId: row.siteId, teamId: team.id, teamName: team.name,
    workerId: 'qa-worker', workerName: '가상작업자', workerTeamId: team.id, unitPrice: 0 }));

export const useRestrictedTeamWorkflow = () => restricted;
export const useWorkerAccessScope = () => ({ mode: restricted ? 'team' : 'all', loading: false });
export const workerAccessMatchesReportRow = () => true;
export const workerAccessMatchesTeamRef = () => true;
export const siteService = { getSites: async () => sites };
export const teamService = { getTeams: async () => [team] };
export const manpowerService = { getWorkers: async () => [] };
export const dailyReportService = { getWorkerRows: async ({ startDate, endDate }: { startDate: string; endDate: string }) =>
    rows.filter(row => row.date >= startDate && row.date <= endDate) };
export const teamResourceStatusService = { update: async () => { throw new Error('읽기 전용 검증입니다.'); } };
export const toast = { error: () => undefined, warning: () => undefined };
export const showConfirmAlert = async () => ({ isConfirmed: false });
