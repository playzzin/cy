import * as functions from 'firebase-functions/v1';
import { filterTeamRows, list, TeamReadScope, TeamRow, text } from './teamReadPolicy';

const ids = (row: TeamRow) => [row.id, text(row.legacyId)].filter(Boolean);
const responsible = (site: TeamRow) => text(site.responsibleTeamId ?? site.responsibleTeam?.id)
    || text(site.teamId ?? site.team?.id);
const number = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;

export function validateSiteWorkRange(filters: Record<string, any>) {
    const start = text(filters.startDate), end = text(filters.endDate);
    const valid = (date: string) => /^20\d{2}-\d{2}-\d{2}$/.test(date)
        && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
    if (!valid(start) || !valid(end) || start > end || Date.parse(end) - Date.parse(start) > 31 * 86400000) {
        throw new functions.https.HttpsError('invalid-argument', '현장 공수는 한 달 이내의 기간으로 조회해 주세요.');
    }
}

// Only current site responsibility opens site-wide attendance. Assignment,
// payment relationships and report/team/name labels cannot grant this access.
export function responsibleSites(sites: TeamRow[], scope: TeamReadScope) {
    return sites.filter(site => scope.teamIds.includes(responsible(site)));
}

export function projectSiteWorkReports(reports: TeamRow[], sites: TeamRow[], scope: TeamReadScope,
    workers: TeamRow[] = [], teams: TeamRow[] = []): TeamRow[] {
    const siteById = new Map(responsibleSites(sites, scope).flatMap(site => ids(site).map(id => [id, site] as const)));
    const workerById = new Map(workers.flatMap(worker => ids(worker).map(id => [id, worker] as const)));
    const teamById = new Map(teams.flatMap(team => ids(team).map(id => [id, team] as const)));
    return reports.flatMap(report => {
        const site = siteById.get(text(report.siteId));
        // Preserve existing own-worker access when working on another site.
        if (!site) return filterTeamRows('daily_reports', [report], scope);
        const entries = list(report.workers).map(worker => {
            const workerId = text(worker.workerId || worker.id);
            const own = scope.workerIds.includes(workerId);
            const master = workerById.get(workerId);
            const teamId = text(worker.teamId) || text(master?.teamId);
            const team = teamById.get(teamId);
            const teamColor = text(team?.color);
            // Never spread worker rows: supporting workers expose attendance
            // only, with no wage, contact, identity, bank or private note fields.
            return {
                workerId: master?.id || workerId, name: text(worker.name || worker.workerName) || text(master?.name) || '작업자 미지정',
                teamId: team?.id || teamId,
                workerTeamName: text(worker.workerTeamName) || text(team?.name) || text(master?.teamName) || '소속 미확인',
                ...(/^#[0-9a-f]{6}$/i.test(teamColor) ? { workerTeamColorHex: teamColor } : {}),
                manDay: number(worker.manDay), status: text(worker.status) || 'attendance', isSiteSupport: !own,
                ...(own ? { unitPrice: number(worker.unitPrice), payType: text(worker.payType),
                    salaryModel: text(worker.salaryModel), workContent: text(worker.workContent) } : {}),
            };
        });
        return [{ id: report.id, date: text(report.date), siteId: site.id, siteName: text(site.name) || text(report.siteName),
            teamId: responsible(site), teamName: text(site.responsibleTeamName || site.teamName),
            responsibleTeamId: responsible(site), responsibleTeamName: text(site.responsibleTeamName || site.teamName),
            workers: entries, totalManDay: entries.reduce((sum, worker) => sum + worker.manDay, 0),
            totalAmount: entries.reduce((sum, worker) => sum + worker.manDay * number(worker.unitPrice), 0) }];
    });
}
