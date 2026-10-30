import type { DailyReportWorkerRow } from '../../services/dailyReportService';
import type { Team } from '../../services/teamService';
import { getReadableAccentColor, hexToRgba, normalizeHexColor } from '../../utils/color';

export type WorkHistoryTeam = Pick<Team, 'id' | 'legacyId' | 'name' | 'color'>;
const text = (value: unknown) => String(value ?? '').trim();
const nameKey = (value: unknown) => text(value).replace(/\s+/g, '').toLowerCase();
const findTeam = (id: string, name: string, teams: WorkHistoryTeam[]) =>
    id ? teams.find(team => team.id === id || team.legacyId === id)
        : teams.find(team => nameKey(team.name) === nameKey(name));

export function recordedWorkTeam(row: DailyReportWorkerRow, teams: WorkHistoryTeam[] = []) {
    const workerId = text(row.workerTeamId);
    const workerName = text(row.workerTeamName);
    const team = findTeam(workerId, workerName, teams);
    const teamId = text(team?.id) || workerId;
    const responsibleId = text(row.responsibleTeamId || row.teamId);
    const responsibleName = text(row.responsibleTeamName || row.teamName);
    const responsibleTeam = findTeam(responsibleId, responsibleName, teams);
    const canonicalResponsibleId = text(responsibleTeam?.id) || responsibleId;
    const name = workerName || text(team?.name) || '소속 미확인';
    const key = teamId ? `id:${teamId}` : `name:${nameKey(name)}`;
    // isSiteSupport on the response is also a wage-redaction flag based on
    // current roster access. Historical attendance labels follow saved teams;
    // changing their display must never restore redacted wages.
    const support = teamId && canonicalResponsibleId ? teamId !== canonicalResponsibleId
        : workerName && responsibleName ? nameKey(workerName) !== nameKey(responsibleName)
            : row.isSiteSupport === true;
    // Team leaders receive only their own team catalog. Support attendance
    // carries the current DB color without exposing the other team's details.
    // Missing colors stay neutral instead of inventing a different team color.
    const color = normalizeHexColor(team?.color, normalizeHexColor(row.workerTeamColorHex));
    return { key, name, support, color };
}

export const workTeamStyle = (color: string) => ({
    '--work-team-color': color,
    '--work-team-tint': hexToRgba(color, 0.08),
    '--work-team-border': hexToRgba(color, 0.22),
    '--work-team-text': getReadableAccentColor(color, '#ffffff', 4.5),
});

export function groupWorkTeams(rows: DailyReportWorkerRow[], catalog: WorkHistoryTeam[] = []) {
    const teams = new Map<string, ReturnType<typeof recordedWorkTeam> & { manDay: number;
        workers: Map<string, { key: string; name: string; manDay: number }> }>();
    rows.filter(row => !row.isEmptyReport).forEach(row => {
        const identity = recordedWorkTeam(row, catalog);
        const team = teams.get(identity.key) ?? { ...identity, manDay: 0, workers: new Map() };
        const workerKey = row.workerId || row.workerName || row.name || 'unknown';
        const worker = team.workers.get(workerKey) ?? { key: workerKey, name: row.workerName || row.name || '작업자 미지정', manDay: 0 };
        const manDay = Number.isFinite(Number(row.manDay)) ? Number(row.manDay) : 0;
        worker.manDay += manDay;
        team.manDay += manDay;
        team.workers.set(workerKey, worker);
        teams.set(team.key, team);
    });
    return [...teams.values()].sort((a, b) => a.name.localeCompare(b.name, 'ko-KR'));
}
