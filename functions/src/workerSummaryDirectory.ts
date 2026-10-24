import * as admin from 'firebase-admin';
import { TeamRow, text } from './teamReadPolicy';
import { queryByIds, queryRows, TeamQueryMetrics } from './teamScopedQuery';

const companyKey = (value: unknown) => text(value).toLowerCase()
    .replace(/주식회사|\(주\)|（주）|㈜|\(株\)/g, '').replace(/[\s().,·ㆍ-]/g, '');
const companyNameKey = (value: unknown) => {
    const key = companyKey(value);
    return ['청연', '청연이엔지', '청연eng', 'cheongyeon', 'cheongyeoneng', 'cy', 'cyeng'].includes(key) ? '청연이엔지' : key;
};
const active = (row: TeamRow) => row.isActive !== false
    && !['퇴사', '출입금지', 'inactive', 'retired', 'archived', 'deleted', '해체'].includes(text(row.status).toLowerCase());
const pick = (row: TeamRow, fields: string[]) => Object.fromEntries(fields
    .filter(field => row[field] !== undefined).map(field => [field, row[field]]));

// A roster has its own read contract. General worker/payroll/document access
// stays team-scoped, and the caller cannot supply a company or a team to widen it.
export function summaryDirectoryTeams(teams: TeamRow[], companies: TeamRow[], ownTeams: TeamRow[]): TeamRow[] {
    const companyById = new Map(companies.flatMap(company => [company.id, text(company.legacyId)]
        .filter(Boolean).map(id => [id, company] as const)));
    const affiliation = (team: TeamRow) => {
        const id = text(team.companyId);
        const company = companyById.get(id);
        // An existing company record takes precedence over a stale team label.
        const name = companyNameKey(company ? company.name : team.companyName);
        return { id: company?.id || id, name };
    };
    const ownIds = new Set(ownTeams.flatMap(team => [team.id, text(team.legacyId)]).filter(Boolean));
    const affiliations = ownTeams.map(affiliation);
    return teams.filter(team => {
        if (ownIds.has(team.id)) return true;
        if (!active(team)) return false;
        const candidate = affiliation(team);
        return affiliations.some(own => (own.id && own.id === candidate.id)
            || ((!own.id || !candidate.id || own.name === '청연이엔지') && own.name && own.name === candidate.name));
    });
}

export async function readWorkerSummaryDirectory(db: admin.firestore.Firestore, ownTeams: TeamRow[], metrics?: TeamQueryMetrics) {
    const [teams, companies] = await Promise.all([
        queryRows(db.collection('teams').select('legacyId', 'name', 'color', 'companyId', 'companyName', 'isActive', 'status'), metrics),
        queryRows(db.collection('companies').select('legacyId', 'name'), metrics),
    ]);
    const allowedTeams = summaryDirectoryTeams(teams, companies, ownTeams);
    const teamIds = allowedTeams.flatMap(team => [team.id, text(team.legacyId)]).filter(Boolean);
    const ownIds = new Set(ownTeams.flatMap(team => [team.id, text(team.legacyId)]).filter(Boolean));
    const workers = (await queryByIds(db, 'workers', ['teamId'], teamIds, metrics)).filter(active);
    const documentWorkerIds = workers.filter(worker => ownIds.has(text(worker.teamId))).map(worker => worker.id);
    return {
        id: 'worker-summary',
        teams: allowedTeams.map(team => pick(team, ['id', 'legacyId', 'name', 'color', 'companyId', 'companyName'])),
        workers: workers.map(worker => pick(worker, ['id', 'legacyId', 'name', 'teamId', 'teamName', 'color',
            'idNumber', 'contact', 'address', 'bloodType', 'status', 'isActive',
            ...(ownIds.has(text(worker.teamId)) ? ['fileNameSaved', 'bankPhotoId'] : [])])),
        documentWorkerIds,
    };
}
