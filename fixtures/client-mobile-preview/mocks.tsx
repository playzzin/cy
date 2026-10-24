import React from 'react';
export const workers = [
    { id: 'sample-worker', name: '가상작업자', teamId: 'sample-team', teamName: '검증팀', companyName: '청연이엔지', status: '재직', unitPrice: 100000 },
    { id: 'retired-worker', name: '퇴사검증', teamId: 'sample-team', teamName: '검증팀', companyName: '청연이엔지', status: '퇴사', isActive: false, unitPrice: 100000 },
];
export const manpowerService = { getWorkers: async () => workers };
const teams = [{ id: 'sample-team', name: '검증팀', companyId: 'sample-company', companyName: '청연이엔지', color: '#2563eb' }];
const sites = [{ id: 'site-a', name: '아주 긴 이름의 첫 번째 가상 검증 현장', responsibleTeamId: 'sample-team', companyId: 'sample-company', status: 'active' }, { id: 'site-b', name: '두 번째 가상 현장', responsibleTeamId: 'sample-team', companyId: 'sample-company', status: 'active' }];
export const teamService = { getTeams: async () => teams };
const reports = sites.map((site, index) => ({ id: site.id, date: `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}-01`, siteId: site.id, siteName: site.name, teamId: 'sample-team', teamName: '검증팀', companyId: 'sample-company', totalManDay: index ? 0.5 : 1, workers: [{ workerId: 'sample-worker', name: '가상작업자', manDay: index ? 0.5 : 1, unitPrice: 100000 }] }));
export const dailyReportService = { getReportsByRange: async () => reports, getWorkerRows: async ({ startDate }: { startDate: string }) => workers.flatMap(worker => [
    { reportId: `${worker.id}-a`, date: startDate, workerId: worker.id, workerName: worker.name, teamId: worker.teamId, teamName: worker.teamName, siteId: 'site-a', siteName: '아주 긴 이름의 첫 번째 가상 검증 현장', manDay: 1, unitPrice: 100000, amount: 100000, workContent: '합성 자료 검증' },
    { reportId: `${worker.id}-b`, date: startDate, workerId: worker.id, workerName: worker.name, teamId: worker.teamId, teamName: worker.teamName, siteId: 'site-b', siteName: '두 번째 가상 현장', manDay: 0.5, unitPrice: 100000, amount: 50000 },
]) };
const scope = { mode: 'team', loading: false, label: '소속팀', teamIds: ['sample-team'], teamNameKeys: ['검증팀'], teamWorkerIds: [], teamWorkerNameKeys: [], workerIds: [], workerUids: [], workerNameKeys: [] };
export const useWorkerAccessScope = () => scope;
export const workerAccessMatchesWorker = (_: unknown, worker: typeof workers[0]) => worker.teamId === 'sample-team';
export const workerAccessMatchesTeam = (_: unknown, team: { id: string }) => team.id === 'sample-team';
export const workerAccessMatchesReportRow = (_: unknown, row: { teamId: string }) => row.teamId === 'sample-team';
export const storage = {};
export const useAuth = () => ({ currentUser: { uid: 'preview-leader' } });
export const useMasterData = () => ({ companies: [{ id: 'sample-company', name: '청연이엔지' }], teams, sites, workers, loading: false });
export const getTeamScopedRows = async (collection: string) => ({ teams, workers, sites, daily_reports: reports }[collection] || []);
export const teamSettlementService = { getTeamDisplayOrder: async () => [] };
export const userService = { getUser: async () => ({ linkedWorkerIds: ['sample-worker'], position: '팀장' }) };
export const getRequestWorkers = async () => ({ workers, canRequestForTeam: true });
export const advancePaymentService = { getAdvancePaymentsByYearMonth: async () => [] };
export const advanceRequestService = { listForWorkerIds: async () => [], createRequest: async () => 'preview-saved' };
export const teamAccountApprovalEnabled = () => true;
const approvalRows = Array.from({ length: 3 }, (_, index) => ({ linkId: `sample-link-${index}`, workerId: `sample-worker-${index}`, name: `합성작업자 ${index + 1}`, teamId: 'sample-team', teamName: '검증팀', status: 'pending' }));
export const teamAccountApprovalService = { list: async () => ({ rows: approvalRows, teams, nextCursor: null }), approve: async (ids: string[]) => ({ results: ids.map(linkId => ({ linkId, status: 'active' })) }) };
export default function UnusedSignature() { return <span />; }
