import type { Team } from '../../../services/teamService';
import type { Company } from '../../../services/companyService';
import type { Site } from '../../../services/siteService';
import type { DailyReport } from '../../../services/dailyReportService';

// Synthetic records shared by component tests and the local browser preview.
export const hierarchyTeams = [
    { id: 'a', name: '가상지원팀', companyId: 'own', companyName: '청연' },
    { id: 'b', name: '가상담당팀', companyId: 'own', companyName: '청연' },
    { id: 'c', name: '가상협력팀', companyId: 'own', companyName: '청연' },
    { id: 'd', name: '가상다른담당팀', companyId: 'own', companyName: '청연' },
    { id: 'external', name: '가상외부팀', companyId: 'outside', companyName: '가상외부회사' },
    { id: 'external-two', name: '가상다른외부팀', companyId: 'outside', companyName: '가상외부회사' },
] as Team[];
export const hierarchyCompanies = [
    { id: 'own', name: '청연' }, { id: 'outside', name: '가상외부회사' },
] as Company[];
export const hierarchySites = [
    { id: 'one', name: '가상 1현장', responsibleTeamId: 'b', constructorCompanyId: 'own' },
    { id: 'two', name: '가상 2현장', responsibleTeamId: 'b', constructorCompanyId: 'own' },
    { id: 'three', name: '가상 3현장', responsibleTeamId: 'd', constructorCompanyId: 'own' },
    { id: 'self', name: '가상 본인현장', responsibleTeamId: 'a', constructorCompanyId: 'own' },
    { id: 'outside', name: '가상 외부현장', responsibleTeamId: 'external', constructorCompanyId: 'outside' },
    { id: 'outside-two', name: '가상 외부2현장', responsibleTeamId: 'external', constructorCompanyId: 'outside' },
    { id: 'outside-three', name: '가상 외부3현장', responsibleTeamId: 'external-two', constructorCompanyId: 'outside' },
] as Site[];
export const hierarchyReports = [
    ['one', 'a', 1], ['two', 'a', 2], ['one', 'c', 0.5],
    ['self', 'a', 10], ['outside', 'a', 1], ['one', 'external', 1],
    ['three', 'a', 1.5],
    ['outside', 'c', 0.5], ['outside-two', 'a', 2], ['outside-three', 'a', 1.5],
    ['one', 'external-two', 0.5], ['two', 'external', 2], ['three', 'external', 1.5],
].map(([siteId, teamId, manDay], index) => ({
    id: `synthetic-${index}`, date: '2026-10-01', siteId,
    siteName: hierarchySites.find(site => site.id === siteId)!.name,
    teamId, teamName: hierarchyTeams.find(team => team.id === teamId)!.name,
    workers: [{ workerId: `synthetic-worker-${index}`, name: `가상작업자${index + 1}`, teamId, manDay, unitPrice: 230000 }],
})) as DailyReport[];
