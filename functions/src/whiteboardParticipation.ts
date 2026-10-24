import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import { FieldPath } from 'firebase-admin/firestore';
import { list, TeamRow, text } from './teamReadPolicy';
import { queryByIds, queryRows, TeamQueryMetrics } from './teamScopedQuery';

const ids = (rows: TeamRow[]) => [...new Set(rows.flatMap(row => [row.id, text(row.legacyId)]).filter(Boolean))];
const indexById = (rows: TeamRow[]) => new Map(rows.flatMap(row => ids([row]).map(id => [id, row] as const)));
const positive = (value: unknown) => {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? Math.round(number * 10000) / 10000 : 0;
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
        participationDetails: { reportId: string; workerId: string; workerName: string; date: string; manDay: number }[];
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
                reportId: report.id, workerId: text(worker?.workerId),
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

// A source report is always read afresh and projected; never return wage or identity fields.
export function whiteboardSourceProjection(report: TeamRow) {
    const workers = list(report.workers).map(worker => ({
        workerId: text(worker.workerId || worker.id), name: text(worker.name) || '이름 미기록',
        teamId: text(worker.teamId || report.teamId), teamName: text(worker.workerTeamName || report.teamName),
        manDay: positive(worker.manDay),
    }));
    return {
        id: report.id, date: text(report.date), siteId: text(report.siteId), siteName: text(report.siteName),
        teamId: text(report.teamId), teamName: text(report.teamName), workers,
        totalManDay: Math.round((workers.length ? workers.reduce((sum, worker) => sum + worker.manDay, 0) : positive(report.totalManDay)) * 10000) / 10000,
        recordedTotalManDay: positive(report.totalManDay),
    };
}

export async function readWhiteboardSource(db: admin.firestore.Firestore, filters: Record<string, any>,
    access: { teams: TeamRow[] } | { workerIds: string[] }) {
    const reportId = text(filters.reportId);
    if (!reportId || reportId.includes('/') || reportId.length > 1500) {
        throw new functions.https.HttpsError('invalid-argument', '원본 일보를 확인해 주세요.');
    }
    const snapshot = await db.collection('daily_reports').doc(reportId).get();
    if (!snapshot.exists) throw new functions.https.HttpsError('not-found', '원본 일보가 삭제되었거나 존재하지 않습니다.');
    const report = { ...snapshot.data(), id: snapshot.id } as TeamRow;
    if ('workerIds' in access) {
        const workers = list(report.workers).filter(worker => access.workerIds.includes(text(worker.workerId || worker.id)));
        if (!workers.length) throw new functions.https.HttpsError('permission-denied', '내 참여 내역이 있는 일보만 조회할 수 있습니다.');
        const own = whiteboardSourceProjection({ ...report, workers });
        // The report's saved total includes other people and is outside a worker's scope.
        return { ...own, recordedTotalManDay: own.totalManDay };
    }
    const sites = await queryByIds(db, 'sites', [FieldPath.documentId(), 'legacyId'], [text(report.siteId)]);
    if (!sites.some(site => ids(access.teams).includes(responsibleId(site)))) {
        throw new functions.https.HttpsError('permission-denied', '현재 담당 현장의 일보만 조회할 수 있습니다.');
    }
    return whiteboardSourceProjection(report);
}
