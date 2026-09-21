import * as admin from 'firebase-admin';
import { FieldPath, Filter } from 'firebase-admin/firestore';
import * as functions from 'firebase-functions/v1';
import { TeamReadScope, TeamRow } from './teamReadPolicy';

const MAX_ROWS = 5000;
export interface TeamQueryMetrics { queries: number; documents: number }
export const mergeTeamQueryRows = (groups: TeamRow[][]): TeamRow[] => {
    const rows = Array.from(new Map(groups.flat().map(row => [row.id, row])).values());
    if (rows.length > MAX_ROWS) throw new functions.https.HttpsError('resource-exhausted', '조회 대상이 많습니다. 월별로 조회해 주세요.');
    return rows.sort((a, b) => a.id.localeCompare(b.id));
};
export const queryRows = async (query: admin.firestore.Query, metrics?: TeamQueryMetrics): Promise<TeamRow[]> => {
    if (metrics) metrics.queries += 1;
    const snapshot = await query.limit(MAX_ROWS + 1).get();
    if (metrics) metrics.documents += snapshot.size;
    return mergeTeamQueryRows([snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }))]);
};

// Document IDs must be read separately. Mixing __name__ and data fields in an
// OR query can require an unavailable index in production (not in the emulator).
export const queryByIds = async (db: admin.firestore.Firestore, collection: string,
    fields: Array<string | FieldPath>, ids: string[], metrics?: TeamQueryMetrics): Promise<TeamRow[]> => {
    const values = [...new Set(ids)].filter(Boolean);
    const isDocumentId = (field: string | FieldPath) => typeof field !== 'string' && field.isEqual(FieldPath.documentId());
    const clauses = fields.filter(field => !isDocumentId(field)).flatMap(field => values.map(id => Filter.where(field, '==', id)));
    const readDocuments = async (): Promise<TeamRow[]> => {
        if (!fields.some(isDocumentId)) return [];
        const rows: TeamRow[] = [];
        for (let offset = 0; offset < values.length; offset += 100) {
            if (metrics) metrics.queries += 1;
            const documents = await db.getAll(...values.slice(offset, offset + 100).map(id => db.collection(collection).doc(id)));
            if (metrics) metrics.documents += documents.length;
            rows.push(...documents.filter(doc => doc.exists).map(doc => ({ ...doc.data(), id: doc.id })));
        }
        return rows;
    };
    return mergeTeamQueryRows(await Promise.all([readDocuments(), queryClauses(db, collection, clauses, metrics)]));
};
const queryClauses = async (db: admin.firestore.Firestore, collection: string, clauses: Filter[], metrics?: TeamQueryMetrics) => {
    const groups: TeamRow[][] = [];
    for (let offset = 0; offset < clauses.length; offset += 120) {
        groups.push(...await Promise.all([0, 30, 60, 90].map(start => clauses.slice(offset + start, Math.min(offset + start + 30, offset + 120)))
            .filter(chunk => chunk.length).map(chunk => queryRows(db.collection(collection).where(Filter.or(...chunk)), metrics))));
    }
    return mergeTeamQueryRows(groups);
};

export const queryTeamCandidates = async (db: admin.firestore.Firestore, collection: string, scope: TeamReadScope, metrics?: TeamQueryMetrics): Promise<TeamRow[]> => {
    const teamFields = ['teamId', 'assignedTeamId', 'responsibleTeamId', 'payerTeamId', 'chargeToTeamId', 'relatedTeamId'];
    const workerFields = ['workerId', 'issuedToWorkerId'];
    const aliases = (fields: string[]) => fields.flatMap(field => [field, `${field.replace(/Id$/, '')}.id`]);
    // These are candidate queries. Type checks and nested-field precedence remain
    // in belongsToTeam/filterTeamRows before anything is returned to the caller.
    const clauses = [
        { fields: aliases(teamFields), ids: scope.teamIds },
        { fields: aliases(workerFields), ids: scope.workerIds },
        { fields: ['assigneeId', 'targetId', 'currentAssigneeId'], ids: [...scope.teamIds, ...scope.workerIds] },
    ].flatMap(({ fields, ids }) => fields.flatMap(field => [...new Set(ids)].filter(Boolean).map(id => Filter.where(field, '==', id))));
    return queryClauses(db, collection, clauses, metrics);
};
