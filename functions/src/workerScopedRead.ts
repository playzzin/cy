import { readWhiteboardSource } from './whiteboardParticipation';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import { FieldPath } from 'firebase-admin/firestore';
import { filterTeamRows, list, TeamRow, text } from './teamReadPolicy';
import { mergeTeamQueryRows, queryByIds, queryRows } from './teamScopedQuery';

const permitted = new Set(['whiteboard_participation', 'whiteboard_source_report', 'workers', 'teams', 'sites', 'companies', 'daily_reports', 'daily_dispatches',
    'schedule_confirmation_boards', 'field_schedule_requests', 'advance_payments', 'advance_requests']);
const pick = (row: TeamRow, fields: string[]): TeamRow => Object.fromEntries(['id', ...fields]
    .filter(key => row[key] !== undefined).map(key => [key, row[key]])) as TeamRow;
export const workerCatalogRow = (collection: string, row: TeamRow) => pick(row, collection === 'teams'
    ? ['legacyId', 'name', 'type', 'companyId', 'companyName', 'status', 'isActive', 'color', 'icon', 'iconKey']
    : collection === 'sites' ? ['legacyId', 'name', 'code', 'address', 'status', 'color', 'teamId', 'teamName',
        'responsibleTeamId', 'responsibleTeamName', 'companyId', 'companyName', 'constructorCompanyId', 'constructorCompanyName', 'clientCompanyId', 'clientCompanyName']
        : ['legacyId', 'name', 'type', 'code']);

export function ownWorkerRows(collection: string, rows: TeamRow[], workerIds: string[]): TeamRow[] {
    const owns = (value: unknown) => workerIds.includes(text(value));
    if (collection === 'daily_reports') return rows.flatMap(row => {
        const workers = list(row.workers).filter(worker => owns(worker.workerId || worker.id));
        if (!workers.length) return [];
        return [{ ...pick(row, ['date', 'teamId', 'teamName', 'siteId', 'siteName', 'companyId', 'companyName', 'status', 'createdAt', 'updatedAt']), workers,
            totalManDay: workers.reduce((sum, worker) => sum + (Number(worker.manDay) || 0), 0),
            totalAmount: workers.reduce((sum, worker) => sum + (Number(worker.manDay) || 0) * (Number(worker.unitPrice) || 0), 0) }];
    });
    if (['daily_dispatches', 'schedule_confirmation_boards'].includes(collection)) {
        // Reuse the assignment whitelist, with only the current account's IDs.
        return filterTeamRows(collection, rows, { teamIds: ['__self__'], workerIds, siteIds: [] });
    }
    if (collection === 'field_schedule_requests') return rows.flatMap(row => {
        const ownIds = list(row.offDutyWorkerIds).filter(owns);
        if (!ownIds.length) return [];
        return [{ ...pick(row, ['date', 'siteId', 'siteName', 'status', 'createdAt', 'updatedAt']), offDutyWorkerIds: ownIds,
            offDutyWorkerNames: [], memo: '', offDutyRequestActors: Object.fromEntries(ownIds
                .filter(id => row.offDutyRequestActors?.[id]).map(id => [id, row.offDutyRequestActors[id]])) }];
    });
    if (['advance_payments', 'advance_requests'].includes(collection)) return rows.filter(row => owns(row.workerId || row.worker?.id));
    return [];
}

export async function readWorkerScopedData(db: admin.firestore.Firestore, uid: string, profile: any,
    anchors: TeamRow[], requests: any[], batch: boolean) {
    if (profile.status !== 'active' || !anchors.length) throw new functions.https.HttpsError('permission-denied', '활성 작업자 계정의 연결을 확인해 주세요.');
    const workerIds = [...new Set(anchors.flatMap(row => [row.id, text(row.legacyId)]).filter(Boolean))];
    const teamIds = [...new Set(anchors.map(row => text(row.teamId)).filter(Boolean))];
    const byIds = (name: string, fields: Array<string | FieldPath>, ids: string[]) => queryByIds(db, name, fields, ids);
    let teamsPromise: Promise<TeamRow[]> | undefined;
    const teams = () => teamsPromise ||= byIds('teams', [FieldPath.documentId(), 'legacyId'], teamIds);
    let sitesPromise: Promise<TeamRow[]> | undefined;
    const sites = () => sitesPromise ||= (async () => {
        const ownTeams = await teams();
        const ids = [...new Set([...anchors, ...ownTeams].flatMap(row => [row.siteId, row.assignedSiteId, ...list(row.siteIds)]).map(text).filter(Boolean))];
        const resolvedTeams = [...new Set([...teamIds, ...ownTeams.flatMap(row => [row.id, text(row.legacyId)])].filter(Boolean))];
        return mergeTeamQueryRows(await Promise.all([
            byIds('sites', [FieldPath.documentId(), 'legacyId'], ids),
            byIds('sites', ['teamId', 'responsibleTeamId', 'assignedTeamId'], resolvedTeams),
        ]));
    })();
    const resolve = async (request: any) => {
        const name = text(request.collection), filters = request.filters || {};
        if (!permitted.has(name)) throw new functions.https.HttpsError('permission-denied', '작업자 계정에서 조회할 수 없는 업무입니다.');
        // Ordinary workers retain their own-worker board; site-wide team
        // summaries are available only through the team-leader branch.
        if (name === 'whiteboard_participation') return { rows: [{ mode: 'own-workers' }] };
        if (name === 'whiteboard_source_report') return { rows: [await readWhiteboardSource(db, filters, { workerIds })] };
        let rows: TeamRow[];
        if (name === 'workers') rows = anchors;
        else if (name === 'teams') rows = (await teams()).map(row => workerCatalogRow(name, row));
        else if (name === 'sites') rows = (await sites()).map(row => workerCatalogRow(name, row));
        else if (name === 'companies') {
            const related = [...await teams(), ...await sites(), ...anchors];
            const ids = related.flatMap(row => [row.companyId, row.constructorCompanyId, row.clientCompanyId]).map(text).filter(Boolean);
            rows = (await byIds(name, [FieldPath.documentId(), 'legacyId'], ids)).map(row => workerCatalogRow(name, row));
        } else if (['advance_payments', 'advance_requests'].includes(name)) {
            rows = ownWorkerRows(name, await byIds(name, ['workerId', 'worker.id'], workerIds), workerIds);
        } else {
            let query: admin.firestore.Query = db.collection(name);
            if (filters.startDate) query = query.where('date', '>=', text(filters.startDate));
            if (filters.endDate) query = query.where('date', '<=', text(filters.endDate));
            if (filters.yearMonth) query = query.where('date', '>=', `${text(filters.yearMonth)}-01`).where('date', '<=', `${text(filters.yearMonth)}-31`);
            rows = ownWorkerRows(name, await queryRows(query), workerIds);
        }
        return { rows: rows.filter(row => (!filters.yearMonth || text(row.yearMonth || row.date).startsWith(text(filters.yearMonth)))
            && (!filters.startDate || text(row.date) >= text(filters.startDate)) && (!filters.endDate || text(row.date) <= text(filters.endDate))) };
    };
    const results = batch ? await Promise.all(requests.map(async request => {
        try { return await resolve(request); } catch (error) {
            return { error: error instanceof functions.https.HttpsError ? { code: error.code, message: error.message }
                : { code: 'internal', message: '내 업무 데이터를 불러오지 못했습니다.' } };
        }
    })) : await resolve(requests[0]);
    const [current, ...currentWorkers] = await db.getAll(db.doc(`users/${uid}`), ...anchors.map(row => db.collection('workers').doc(row.id)));
    const identity = (row: any) => JSON.stringify([Boolean(row), row?.status, row?.isActive, row?.uid, row?.teamId, row?.role]);
    const authority = (row: any) => JSON.stringify([Boolean(row), row?.status, row?.accountType, row?.role, row?.position, row?.systemRole,
        row?.roles, row?.additionalPositions, list(row?.linkedWorkerIds).map(text).sort()]);
    if (authority(current.data()) !== authority(profile) || currentWorkers.some((doc, index) => identity(doc.data()) !== identity(anchors[index]))) {
        throw new functions.https.HttpsError('permission-denied', '조회 중 계정 연결 또는 권한이 변경되었습니다. 다시 조회해 주세요.');
    }
    return batch ? { results } : results;
}
