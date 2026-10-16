import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import { FieldPath } from 'firebase-admin/firestore';
import { list, TeamRow, text } from './teamReadPolicy';
import { queryByIds, queryRows, TeamQueryMetrics } from './teamScopedQuery';

const ids = (rows: TeamRow[]) => [...new Set(rows.flatMap(row => [row.id, text(row.legacyId)]).filter(Boolean))];
const indexById = (rows: TeamRow[]) => new Map(rows.flatMap(row => ids([row]).map(id => [id, row] as const)));
const positive = (value: unknown) => {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : 0;
};
const responsibleId = (site: TeamRow) => text(site.responsibleTeamId ?? site.responsibleTeam?.id);

// Site owners may drill into participants' names, work dates and man-days.
// Project only those fields, never personnel records, contact details or wages.
export function buildWhiteboardParticipation(authorizedTeams: TeamRow[], sites: TeamRow[], teams: TeamRow[], reports: TeamRow[]) {
    const ownTeamIds = new Set(ids(authorizedTeams));
    const siteById = indexById(sites.filter(site => ownTeamIds.has(responsibleId(site))));
    const teamById = indexById([...teams, ...authorizedTeams]);
    const totals = new Map<string, {
        id: string; date: string; siteId: string; siteName: string; companyId: string;
        responsibleTeamId: string; responsibleTeamName: string;
        teamId: string; teamName: string; teamCompanyId: string; teamColor: string; totalManDay: number;
        participationDetails: { workerId: string; workerName: string; date: string; manDay: number }[];
    }>();
    for (const report of reports) {
        // Never use report.teamId, a URL filter or a report's ownership label
        // to grant site access. Current site ownership is authoritative.
        const site = siteById.get(text(report.siteId));
        if (!site) continue;
        const owner = teamById.get(responsibleId(site));
        const add = (teamIdValue: unknown, teamNameValue: unknown, manDayValue: unknown, worker?: any) => {
            const manDay = positive(manDayValue);
            if (!manDay) return;
            const team = teamById.get(text(teamIdValue));
            const teamName = text(team?.name) || text(teamNameValue) || '소속 미지정';
            const teamId = team?.id || text(teamIdValue) || `unassigned:${teamName}`;
            const key = JSON.stringify([site.id, teamId]);
            let row = totals.get(key);
            if (!row) {
                row = {
                    id: key, date: text(report.date), siteId: site.id, siteName: text(site.name),
                    companyId: text(site.companyId), responsibleTeamId: owner?.id || responsibleId(site),
                    responsibleTeamName: text(owner?.name) || text(site.responsibleTeamName),
                    teamId, teamName, teamCompanyId: text(team?.companyId), teamColor: text(team?.color), totalManDay: 0, participationDetails: [],
                };
                totals.set(key, row);
            }
            row.totalManDay += manDay;
            row.participationDetails.push({
                workerId: text(worker?.workerId),
                workerName: worker ? text(worker.name) || '이름 미기록' : '작업자 미기록 (일보 합계)',
                date: text(report.date), manDay,
            });
        };
        const workers = list(report.workers);
        if (workers.length) workers.forEach(worker => add(worker.teamId || report.teamId,
            worker.workerTeamName || (!worker.teamId || worker.teamId === report.teamId ? report.teamName : ''), worker.manDay, worker));
        else add(report.teamId, report.teamName, report.totalManDay);
    }
    return [...totals.values()].map(row => ({ ...row, totalManDay: Math.round(row.totalManDay * 10000) / 10000 }));
}

export async function readWhiteboardParticipation(db: admin.firestore.Firestore, authorizedTeams: TeamRow[],
    filters: Record<string, any>, metrics: TeamQueryMetrics) {
    const yearMonth = text(filters.yearMonth);
    if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(yearMonth)) {
        throw new functions.https.HttpsError('invalid-argument', '참여 현황 조회 월을 확인해 주세요.');
    }
    const sites = await queryByIds(db, 'sites', ['responsibleTeamId', 'responsibleTeam.id'], ids(authorizedTeams), metrics);
    const ownSites = sites.filter(site => ids(authorizedTeams).includes(responsibleId(site)));
    if (!ownSites.length) return { mode: 'responsible-sites', reports: [] };
    const [year, month] = yearMonth.split('-').map(Number);
    const endDate = `${yearMonth}-${new Date(Date.UTC(year, month, 0)).getUTCDate()}`;
    const ownSiteIds = new Set(ids(ownSites));
    // Embedded worker teams need a month-bounded read. Filter by owned site
    // before resolving participants; no unrelated site's totals are returned.
    const reports = (await queryRows(db.collection('daily_reports')
        .where('date', '>=', `${yearMonth}-01`).where('date', '<=', endDate)
        .select('date', 'siteId', 'teamId', 'teamName', 'totalManDay', 'workers'), metrics))
        .filter(row => ownSiteIds.has(text(row.siteId)));
    const participantIds = [...new Set(reports.flatMap(row => [row.teamId, ...list(row.workers).map(worker => worker.teamId)]).map(text).filter(Boolean))];
    const teams = participantIds.length ? await queryByIds(db, 'teams', [FieldPath.documentId(), 'legacyId'], participantIds, metrics) : [];
    const currentSites = await queryByIds(db, 'sites', [FieldPath.documentId()], ownSites.map(site => site.id), metrics);
    return { mode: 'responsible-sites', reports: buildWhiteboardParticipation(authorizedTeams, currentSites, teams, reports) };
}
