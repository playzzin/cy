import * as admin from 'firebase-admin';
import { FieldPath, FieldValue } from 'firebase-admin/firestore';
import * as functions from 'firebase-functions/v1';
import { protectedRegion, requireCallableAuth } from './auth';
import { resolvedRoleNames } from './teamExpenseRequests';
import { isTeamLeader, TeamRow, text } from './teamReadPolicy';
import { projectTeamVehicleOil } from './teamVehicleOilSummary';
import { isPreviewIdentity } from './devPreviewPolicy';

type OilMetric = { id: string; currentKm: number; lastOilKm: number; cycleKm: number };
const fail = (code: functions.https.FunctionsErrorCode, message: string): never => { throw new functions.https.HttpsError(code, message); };
const validId = (id: unknown): id is string => typeof id === 'string' && id.trim() === id && id.length > 0 && id.length <= 1500 && !id.includes('/') && !['.', '..'].includes(id);

export const saveTeamVehicleOilData = async (input: any, context: functions.https.CallableContext) => {
    if (context.auth && isPreviewIdentity(context.auth.uid, context.auth.token)) fail('permission-denied', '조회 미리보기에서는 저장할 수 없습니다.');
    const auth = requireCallableAuth(context);
    const records: OilMetric[] = input?.records;
    if (!Array.isArray(records) || !records.length || records.length > 100
        || records.some(record => !record || !validId(record.id)
            || !['currentKm', 'lastOilKm', 'cycleKm'].every(key => typeof record[key] === 'number' && Number.isFinite(record[key]) && record[key] >= 0 && record[key] <= 1_000_000_000)
            || record.cycleKm <= 0 || record.lastOilKm > record.currentKm)
        || new Set(records.map(record => record.id)).size !== records.length) {
        fail('invalid-argument', '차량과 거리 값을 확인해 주세요. 최근 교체거리는 현재거리 이하여야 합니다.');
    }
    const db = admin.firestore();
    await db.runTransaction(async transaction => {
        const [profile, menu] = await transaction.getAll(db.doc(`users/${auth.uid}`), db.doc('settings/menus_v12'));
        const user = profile.data();
        if (user?.status !== 'active' || !resolvedRoleNames(user, menu.data()).some(isTeamLeader)) {
            fail('permission-denied', '활성 팀장 계정이 필요합니다.');
        }
        const linkedIds = Array.isArray(user.linkedWorkerIds) ? [...new Set(user.linkedWorkerIds)] : [];
        if (!linkedIds.length || linkedIds.length > 30 || !linkedIds.every(validId)) fail('permission-denied', '팀장 계정의 작업자 연결을 확인해 주세요.');
        const anchors = await transaction.getAll(...linkedIds.map(id => db.collection('workers').doc(String(id))));
        const anchorTeamIds = [...new Set(anchors.filter(doc => doc.exists && doc.data()?.isActive !== false
            && !['퇴사', 'inactive', 'retired', 'archived'].includes(text(doc.data()?.status)))
            .map(doc => text(doc.data()?.teamId)).filter(Boolean))];
        if (!anchorTeamIds.length || !anchorTeamIds.every(validId)) fail('permission-denied', '연결된 소속 팀이 없습니다.');
        const queryRows = async (collection: string, field: string | FieldPath, ids: string[]): Promise<TeamRow[]> => {
            const snapshots = await Promise.all(Array.from({ length: Math.ceil(ids.length / 30) }, (_, index) =>
                transaction.get(db.collection(collection).where(field, 'in', ids.slice(index * 30, index * 30 + 30)))));
            return snapshots.flatMap(snapshot => snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
        };
        const teams = [...new Map((await Promise.all([
            queryRows('teams', FieldPath.documentId(), anchorTeamIds), queryRows('teams', 'legacyId', anchorTeamIds),
        ])).flat().map(row => [row.id, row])).values()];
        const teamIds = [...new Set(teams.flatMap(row => [row.id, text(row.legacyId)]).filter(Boolean))];
        if (!teamIds.length || teamIds.length > 30) fail('permission-denied', '소속 팀 연결을 확인해 주세요.');
        const workers = await queryRows('workers', 'teamId', teamIds);
        const vehicles = (await transaction.getAll(...records.map(record => db.collection('vehicles').doc(record.id))))
            .filter(doc => doc.exists).map(doc => ({ ...doc.data(), id: doc.id }));
        const permitted = new Set(projectTeamVehicleOil(vehicles, workers, teams, {}).map(row => row.id));
        if (records.some(record => !permitted.has(record.id))) fail('permission-denied', '현재 본인 팀에 배정된 차량만 수정할 수 있습니다. 새로고침해 주세요.');
        // Merge only supplied vehicle fields. Other teams and untouched vehicles
        // survive concurrent saves; all authorization reads are in this transaction.
        transaction.set(db.doc('support_shared_data/engine_oil_cycle'), {
            data: Object.fromEntries(records.map(({ id, currentKm, lastOilKm, cycleKm }) => [id, { id, currentKm, lastOilKm, cycleKm }])),
            schemaVersion: 1, updatedAt: FieldValue.serverTimestamp(), updatedByUid: auth.uid,
        }, { merge: true });
    });
    return { savedIds: records.map(record => record.id) };
};

export const saveTeamVehicleOil = protectedRegion.https.onCall(saveTeamVehicleOilData);
