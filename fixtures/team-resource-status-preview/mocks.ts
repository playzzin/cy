const team = { id: 'qa-team', name: '검증팀', companyName: '청연이엔지', color: '#2563eb' };
let workers = [
    { id: 'qa-active', name: '가상 재직자', teamId: team.id, teamName: team.name, companyName: team.companyName, status: '재직', isActive: true },
    { id: 'qa-retired', name: '가상 퇴사자', teamId: team.id, teamName: team.name, companyName: team.companyName, status: '퇴사', isActive: false },
];
let sites = [
    { id: 'qa-active-site', name: '가상 진행현장', responsibleTeamId: team.id, responsibleTeamName: team.name, status: 'active' },
    { id: 'qa-closed-site', name: '가상 종료현장', responsibleTeamId: team.id, responsibleTeamName: team.name, status: 'completed' },
];
const user = { uid: 'local-status-qa' };
export const useAuth = () => ({ currentUser: user });
export const useRestrictedTeamWorkflow = () => true;
export const useWorkerAccessScope = () => ({ mode: 'team', loading: false, label: '검증팀', teamIds: [team.id], teamNameKeys: [team.name], teamWorkerIds: workers.map(worker => worker.id), teamWorkerNameKeys: workers.map(worker => worker.name), workerIds: [], workerUids: [], workerNameKeys: [] });
export const workerAccessMatchesTeam = (_scope: unknown, value: any) => value?.id === team.id;
export const workerAccessMatchesWorker = (_scope: unknown, value: any) => value?.teamId === team.id;
export const workerAccessMatchesReportRow = (_scope: unknown, value: any) => value?.teamId === team.id;
export const workerAccessMatchesTeamRef = (_scope: unknown, id: unknown) => id === team.id;
export const manpowerService = { getWorkers: async () => workers.map(worker => ({ ...worker })) };
export const teamService = { getTeams: async () => [team] };
export const siteService = { getSites: async () => sites.map(site => ({ ...site })) };
export const dailyReportService = { getWorkerRows: async () => [] };
export const teamResourceStatusService = {
    update: async (input: any) => {
        await new Promise(resolve => setTimeout(resolve, 150));
        if (input.kind === 'worker') {
            workers = workers.map(worker => worker.id === input.id ? { ...worker, status: input.status, isActive: input.status === '재직' } : worker);
            return { id: input.id, status: input.status, isActive: input.status === '재직' };
        }
        sites = sites.map(site => site.id === input.id ? { ...site, status: input.status } : site);
        return { id: input.id, status: input.status };
    },
};
