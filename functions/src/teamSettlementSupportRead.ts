import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import { FieldPath } from 'firebase-admin/firestore';
import { TeamRow, text, list } from './teamReadPolicy';
import { queryByIds, queryRows, TeamQueryMetrics } from './teamScopedQuery';
import { buildTeamSettlementSupportDetails } from './teamSettlementSupportDetails';

const parse = (value: any): any => {
    if (typeof value !== 'string') return value;
    try { return JSON.parse(value); } catch { return null; }
};

export async function readTeamSettlementSupportDetails(
    db: admin.firestore.Firestore, authorizedTeams: TeamRow[], filters: Record<string, any>, metrics: TeamQueryMetrics
) {
    const yearMonth = text(filters.yearMonth);
    if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(yearMonth)) {
        throw new functions.https.HttpsError('invalid-argument', '정산 조회 월을 확인해 주세요.');
    }
    const team = authorizedTeams.find(row => [row.id, text(row.legacyId)].filter(Boolean).includes(text(filters.teamId)));
    if (!team) throw new functions.https.HttpsError('permission-denied', '본인 팀의 정산만 조회할 수 있습니다.');
    const [year, month] = yearMonth.split('-').map(Number);
    const endDate = `${yearMonth}-${new Date(Date.UTC(year, month, 0)).getUTCDate()}`;
    // Classification uses historical report ownership and canonical/legacy
    // master identities. Only the explicit worker-detail projection is returned.
    const [reports, teams, sites, companies, configs] = await Promise.all([
        queryRows(db.collection('daily_reports').where('date', '>=', `${yearMonth}-01`).where('date', '<=', endDate)
            .select('date', 'siteId', 'siteName', 'responsibleTeamId', 'responsibleTeamName', 'teamId', 'teamName',
                'constructorCompanyId', 'constructorCompanyName', 'companyId', 'companyName', 'workers'), metrics),
        queryRows(db.collection('teams').select('legacyId', 'name', 'companyId', 'companyName', 'type', 'supportRate'), metrics),
        queryRows(db.collection('sites').select('legacyId', 'name', 'responsibleTeamId', 'responsibleTeamName',
            'constructorCompanyId', 'constructorCompanyName', 'companyId', 'companyName'), metrics),
        queryRows(db.collection('companies').select('legacyId', 'name', 'isMyCompany'), metrics),
        queryByIds(db, 'system_configs', [FieldPath.documentId()],
            ['support_site_rates', `team_settlement_support_rate_overrides_v1_${yearMonth}`], metrics),
    ]);
    const rates = parse(configs.find(row => row.id === 'support_site_rates')?.data);
    const overrides = parse(configs.find(row => row.id !== 'support_site_rates')?.data) || {};
    return buildTeamSettlementSupportDetails({
        teamIds: [team.id, text(team.legacyId)].filter(Boolean), teams, sites, companies, reports,
        supportRates: list(Array.isArray(rates) ? rates : rates?.rates),
        supportRateOverrides: {
            bulkSupportRate: overrides.bulkSupportRate,
            supportTeamRates: overrides.supportTeamRates || {},
            supportAggregateRates: overrides.supportAggregateRates || {},
            supportSiteRates: overrides.supportSiteRates || {},
        },
    });
}
