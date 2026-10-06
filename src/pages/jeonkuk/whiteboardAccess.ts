import type { DailyReport } from '../../services/dailyReportService';
import type { Worker } from '../../services/manpowerService';
import type { Site } from '../../services/siteService';
import type { Team } from '../../services/teamService';
import { getTeamScopedRows } from '../../services/teamScopedReadService';

export interface WhiteboardTeamAccess {
    teams: Team[];
    sites: Site[];
    workers: Worker[];
}

const idText = (value: unknown) => String(value ?? '').trim();
const indexById = <T extends { id?: string; legacyId?: string | null }>(rows: T[]) => {
    const index = new Map<string, T>();
    rows.forEach(row => [row.id, row.legacyId].forEach(id => {
        if (idText(id)) index.set(idText(id), row);
    }));
    return index;
};

// Only the server's authenticated team scope can grant access. URL filters and
// the shared master-data cache must never be used as authorization evidence.
export const loadWhiteboardTeamAccess = async (): Promise<WhiteboardTeamAccess | null> => {
    const teams = await getTeamScopedRows<Team>('teams');
    if (teams === null) return null;
    if (!teams.length) throw new Error('연결된 소속 팀을 확인해 주세요.');
    const [sites, workers] = await Promise.all([
        getTeamScopedRows<Site>('sites'),
        getTeamScopedRows<Worker>('workers'),
    ]);
    if (sites === null || workers === null) throw new Error('조회 권한을 다시 확인해 주세요.');
    const teamById = indexById(teams);
    return {
        teams,
        sites: sites.filter(site => teamById.has(idText(site.responsibleTeamId))),
        workers: workers.filter(worker => teamById.has(idText(worker.teamId))),
    };
};

export const scopeWhiteboardReports = (reports: DailyReport[], access: WhiteboardTeamAccess): DailyReport[] => {
    const teamById = indexById(access.teams);
    const siteById = indexById(access.sites);
    const workerById = indexById(access.workers);

    return reports.flatMap(report => {
        const site = siteById.get(idText(report.siteId));
        const responsibleTeam = site && teamById.get(idText(site.responsibleTeamId));
        if (!site || !responsibleTeam) return [];
        const workers = (report.workers ?? []).flatMap(row => {
            const worker = workerById.get(idText(row.workerId));
            const team = worker && teamById.get(idText(worker.teamId));
            if (!team) return [];
            return [{ ...row, teamId: team.id, workerTeamName: team.name }];
        });
        // An unscoped legacy total cannot be attributed safely to this team.
        if (!workers.length) return [];
        const writerTeam = teamById.get(idText(report.teamId));
        return [{
            ...report,
            siteId: site.id || report.siteId,
            siteName: site.name,
            responsibleTeamId: responsibleTeam.id,
            responsibleTeamName: responsibleTeam.name,
            teamId: writerTeam?.id || '',
            teamName: writerTeam?.name,
            workers,
            totalManDay: workers.reduce((sum, worker) => sum + (Number(worker.manDay) || 0), 0),
            totalAmount: workers.reduce((sum, worker) => sum + (Number(worker.manDay) || 0) * (Number(worker.unitPrice) || 0), 0),
        }];
    });
};
