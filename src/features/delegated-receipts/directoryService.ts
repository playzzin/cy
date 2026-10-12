import { teamService } from '../../services/teamService';
import { siteService } from '../../services/siteService';
import { manpowerService } from '../../services/manpowerService';
import { companyService } from '../../services/companyService';
import { buildCheongyeonEngTeams } from '../../utils/cheongyeonTeams';
import type { ReceiptDirectory } from './teamDirectory';

export const receiptDirectoryService = {
    async load(): Promise<ReceiptDirectory> {
        const [teams, sites, workers, companies] = await Promise.all([teamService.getTeams(), siteService.getSites(), manpowerService.getWorkers(true), companyService.getCompanies()]);
        const companyById = new Map(companies.flatMap(company => [company.id, company.legacyId].filter(Boolean).map(id => [id!, company] as const)));
        // Prefer the linked company record to a stale company name stored on a team.
        const resolvedTeams = teams.map(team => {
            const company = companyById.get(team.companyId?.trim() || '');
            return company ? { ...team, companyName: company.name } : team;
        });
        const cheongyeonIds = new Set(buildCheongyeonEngTeams(resolvedTeams, companies).map(team => team.id));
        return {
            teams: teams.filter(team => team.id).map(team => ({ id: team.id!, name: team.name, leaderName: team.leaderName, color: team.color, isCheongyeon: cheongyeonIds.has(team.id) })),
            sites: sites.filter(site => site.id).map(site => ({ id: site.id!, name: site.name, responsibleTeamId: site.responsibleTeamId })),
            workers: workers.filter(worker => worker.id).map(worker => ({ id: worker.id!, name: worker.name, color: worker.color,
                ...(worker.teamId ? { teamId: worker.teamId } : {}), ...(worker.teamName ? { teamName: worker.teamName } : {}) })),
        };
    },
};
