import { teamService } from '../../services/teamService';
import { siteService } from '../../services/siteService';
import { manpowerService } from '../../services/manpowerService';
import type { ReceiptDirectory } from './teamDirectory';

export const receiptDirectoryService = {
    async load(): Promise<ReceiptDirectory> {
        const [teams, sites, workers] = await Promise.all([teamService.getTeams(), siteService.getSites(), manpowerService.getWorkers(true)]);
        return {
            teams: teams.filter(team => team.id).map(team => ({ id: team.id!, name: team.name, leaderName: team.leaderName, color: team.color })),
            sites: sites.filter(site => site.id).map(site => ({ id: site.id!, name: site.name, responsibleTeamId: site.responsibleTeamId })),
            workers: workers.filter(worker => worker.id).map(worker => ({ id: worker.id!, name: worker.name, color: worker.color,
                ...(worker.teamId ? { teamId: worker.teamId } : {}), ...(worker.teamName ? { teamName: worker.teamName } : {}) })),
        };
    },
};
