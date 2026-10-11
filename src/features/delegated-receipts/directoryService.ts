import { teamService } from '../../services/teamService';
import { siteService } from '../../services/siteService';
import type { ReceiptDirectory } from './teamDirectory';

export const receiptDirectoryService = {
    async load(): Promise<ReceiptDirectory> {
        const [teams, sites] = await Promise.all([teamService.getTeams(), siteService.getSites()]);
        return {
            teams: teams.filter(team => team.id).map(team => ({ id: team.id!, name: team.name, leaderName: team.leaderName, color: team.color })),
            sites: sites.filter(site => site.id).map(site => ({ id: site.id!, name: site.name, responsibleTeamId: site.responsibleTeamId })),
        };
    },
};
