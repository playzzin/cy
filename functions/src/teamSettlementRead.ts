import * as admin from 'firebase-admin';
import { FieldPath } from 'firebase-admin/firestore';
import * as functions from 'firebase-functions/v1';
import { list, TeamReadScope, TeamRow, text } from './teamReadPolicy';
import { queryByIds, queryRows, queryTeamCandidates, TeamQueryMetrics } from './teamScopedQuery';

const ids = (row: TeamRow) => [row.id, text(row.legacyId)].filter(Boolean);
const responsibleTeam = (row: TeamRow) => text(row.responsibleTeamId ?? row.responsibleTeam?.id)
    || text(row.teamId ?? row.team?.id);

export interface IncomingTeamSummary {
    id: string; date: string; siteId: string; siteName: string;
    teamId: string; teamName: string; manDay: number; teamLegacyId?: string; siteLegacyId?: string;
}

const positiveRate = (value: unknown): number | null => {
    const rate = Number(typeof value === 'string' ? value.replace(/,/g, '') : value);
    return Number.isFinite(rate) && rate > 0 ? Math.round(rate) : null;
};
export const withIncomingSupportRates = (rows: IncomingTeamSummary[], teams: TeamRow[], siteRates: any[]) => rows.map(row => {
    const configured = siteRates.find(rate => [row.siteId, row.siteLegacyId].filter(Boolean).includes(text(rate.siteId || rate.id)));
    const siteRate = positiveRate(configured?.defaultRate);
    const teamRate = positiveRate(teams.find(team => ids(team).includes(row.teamId))?.supportRate);
    // The documented support default is 230,000. Worker unitPrice is never a
    // fallback here: that is an individual wage, not the team's support rate.
    const supportRate = siteRate ?? teamRate ?? 230000;
    return { ...row, supportRate, supportAmount: Math.round(row.manDay * supportRate),
        rateSource: siteRate ? 'site' : teamRate ? 'team' : 'default' };
});

// Authorize against historical report responsibility, then aggregate before
// returning anything. Never spread a report/worker/master row into this result.
export const summarizeIncomingTeams = (reports: TeamRow[], scope: TeamReadScope, teams: TeamRow[] = [], sites: TeamRow[] = []): IncomingTeamSummary[] => {
    const summaries = new Map<string, IncomingTeamSummary>();
    if (!scope.teamIds.length) return [];
    for (const report of reports) {
        const responsible = responsibleTeam(report);
        if (responsible ? !scope.teamIds.includes(responsible) : !scope.siteIds.includes(text(report.siteId))) continue;
        for (const worker of list(report.workers)) {
            const workerTeamId = text(worker.teamId);
            const team = teams.find(row => ids(row).includes(workerTeamId));
            if (scope.workerIds.includes(text(worker.workerId || worker.id)) || scope.teamIds.includes(workerTeamId)
                || (team && ids(team).some(id => scope.teamIds.includes(id)))) continue;
            const teamId = team?.id || workerTeamId;
            const teamName = text(worker.workerTeamName) || text(team?.name);
            if (!teamId && !teamName) continue;
            const manDay = Number(worker.manDay);
            if (!Number.isFinite(manDay) || manDay <= 0) continue;
            const site = sites.find(row => ids(row).includes(text(report.siteId)));
            const date = text(report.date), siteId = site?.id || text(report.siteId), siteName = text(report.siteName) || text(site?.name);
            const key = JSON.stringify([date, siteId || siteName, teamId || teamName]);
            const previous = summaries.get(key);
            summaries.set(key, { id: key, date, siteId, siteName, teamId, teamName: teamName || '지원팀',
                ...(text(team?.legacyId) ? { teamLegacyId: text(team?.legacyId) } : {}),
                ...(text(site?.legacyId) ? { siteLegacyId: text(site?.legacyId) } : {}),
                manDay: Math.round(((previous?.manDay || 0) + manDay) * 10000) / 10000 });
        }
    }
    return [...summaries.values()].sort((a, b) => a.date.localeCompare(b.date) || a.teamName.localeCompare(b.teamName));
};

export const readTeamSettlementIncoming = async (
    db: admin.firestore.Firestore, authorizedTeams: TeamRow[], authorizedWorkers: TeamRow[],
    filters: Record<string, any>, metrics: TeamQueryMetrics
) => {
    const yearMonth = text(filters.yearMonth);
    if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(yearMonth)) {
        throw new functions.https.HttpsError('invalid-argument', '정산 조회 월을 확인해 주세요.');
    }
    const team = authorizedTeams.find(row => ids(row).includes(text(filters.teamId)));
    if (!team) throw new functions.https.HttpsError('permission-denied', '본인 팀의 정산만 조회할 수 있습니다.');
    const scope: TeamReadScope = { teamIds: ids(team), workerIds: [], siteIds: [] };
    scope.workerIds = authorizedWorkers.filter(row => scope.teamIds.includes(text(row.teamId))).flatMap(ids);
    const [year, month] = yearMonth.split('-').map(Number);
    const endDate = `${yearMonth}-${new Date(Date.UTC(year, month, 0)).getUTCDate()}`;
    const [reports, sites] = await Promise.all([
        queryRows(db.collection('daily_reports').where('date', '>=', `${yearMonth}-01`).where('date', '<=', endDate)
            .select('date', 'siteId', 'siteName', 'responsibleTeamId', 'teamId', 'workers'), metrics),
        queryTeamCandidates(db, 'sites', scope, metrics).then(rows => rows.filter(row => scope.teamIds.includes(responsibleTeam(row)))),
    ]);
    scope.siteIds = sites.flatMap(ids);
    const incoming = summarizeIncomingTeams(reports, scope);
    // Master records stay server-side. Only canonical IDs and display names
    // enter the aggregate response; no wages, companies, or member lists.
    const [teams, reportSites, rateConfigs] = await Promise.all([
        queryByIds(db, 'teams', [FieldPath.documentId(), 'legacyId'], incoming.map(row => row.teamId).filter(Boolean), metrics),
        queryByIds(db, 'sites', [FieldPath.documentId(), 'legacyId'], incoming.map(row => row.siteId).filter(Boolean), metrics),
        queryByIds(db, 'system_configs', [FieldPath.documentId()], ['support_site_rates'], metrics),
    ]);
    let rateData: any = rateConfigs[0]?.data;
    if (typeof rateData === 'string') {
        try { rateData = JSON.parse(rateData); } catch { rateData = null; }
    }
    return withIncomingSupportRates(summarizeIncomingTeams(reports, scope, teams, reportSites), teams, list(Array.isArray(rateData) ? rateData : rateData?.rates));
};
