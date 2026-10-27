const team = { id: 'qa-team', name: '검증팀', companyName: '청연이엔지', type: '시공팀', color: '#2563eb' };
const workers = [
    ...Array.from({ length: 14 }, (_, index) => ({ id: `qa-${index}`, name: `가상작업자 ${String(index + 1).padStart(2, '0')}`, teamId: team.id,
        teamName: team.name, companyName: team.companyName, status: '재직', isActive: true, joinDate: '2026-01-01',
        fileNameSaved: index > 9 ? 'synthetic.png' : '', signatureUrl: '' })),
    { id: 'qa-retired', name: '기간검증', teamId: team.id, teamName: team.name, companyName: team.companyName,
        status: '퇴사', isActive: false, joinDate: '2026-07-15', retirementDate: '2026-09-10', fileNameSaved: 'retired.png', signatureUrl: 'retired-signature' },
];
const user = { uid: 'local-requirements-qa' };
export const useAuth = () => ({ currentUser: user });
export const useRestrictedTeamWorkflow = () => true;
export const useSiteMode = () => ({ currentSite: 'test', currentPosition: 'full' });
export const useWorkerAccessScope = () => ({ mode: 'team', loading: false, label: '검증팀', teamIds: [team.id], teamNameKeys: [team.name], teamWorkerIds: workers.map(worker => worker.id), teamWorkerNameKeys: workers.map(worker => worker.name), workerIds: [], workerUids: [], workerNameKeys: [] });
export const workerAccessMatchesTeam = (_scope: unknown, value: any) => value?.id === team.id;
export const workerAccessMatchesWorker = (_scope: unknown, value: any) => value?.teamId === team.id;
export const workerAccessMatchesReportRow = (_scope: unknown, value: any) => value?.teamId === team.id;
export const workerAccessMatchesTeamRef = (_scope: unknown, id: unknown) => id === team.id;
export const manpowerService = { getWorkers: async () => workers.map(worker => ({ ...worker })) };
export const teamService = { getTeams: async () => [team] };
export const companyService = { getCompanies: async () => [] };
export const siteService = { getSites: async () => [] };
export const dailyReportService = {
    getWorkerRows: async (range?: { startDate: string }) => range ? [{ workerId: 'qa-0', workerName: workers[0].name, teamId: team.id, teamName: team.name,
        date: range.startDate, manDay: 1, unitPrice: 100000, siteName: '전체 이름을 확인하는 가상현장' }] : [],
    getReportWorkerRowsByRange: async () => [],
};
const rejectWrite = async () => { throw new Error('This preview never writes to a remote service'); };
export const teamResourceStatusService = { update: rejectWrite };
export const dailyWorkerReportSiteService = { getByDateRange: async () => [], save: rejectWrite, delete: rejectWrite };
