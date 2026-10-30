import * as admin from 'firebase-admin';
import { FieldPath, FieldValue } from 'firebase-admin/firestore';
import * as functions from 'firebase-functions/v1';
import { createHash } from 'crypto';
import { protectedRegion, requireCallableAuth } from './auth';
import { resolvedRoleNames } from './teamExpenseRequests';
import { isPreviewIdentity } from './devPreviewPolicy';
import { isTeamLeader, text } from './teamReadPolicy';

type Row = Record<string, any> & { id: string };
type Change = { workerId: string; accommodationId: string | null };
type RoomChange = { accommodationId: string; roomCount: number | null; maxOccupants: number | null };
const fail = (code: functions.https.FunctionsErrorCode, message: string): never => { throw new functions.https.HttpsError(code, message); };
const validId = (value: unknown): value is string => typeof value === 'string' && value.trim() === value
    && value.length > 0 && value.length <= 1500 && !value.includes('/') && !['.', '..'].includes(value);
const keys = (row: Row) => [row.id, text(row.legacyId)].filter(Boolean);
const fieldId = (row: Row, field: string) => text(row[`${field}Id`] || row[field]?.id);
const activeWorker = (row: Row) => row.isActive !== false && !['퇴사', 'inactive', 'retired', 'archived'].includes(text(row.status));
const current = (row: Row, date: string) => row.status !== 'ended' && (!row.startDate || row.startDate <= date) && (!row.endDate || row.endDate >= date);
const today = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
const ALL_TEAMS = '__all__';
const adminRoles = new Set(['admin', 'administrator', 'superadmin', 'systemadmin', 'owner', 'dev', 'developer', '관리자', '개발', '개발자', '시스템관리자', 'ceo', '대표', '대표이사', '사장',
    'manager', 'manager1', 'manager2', 'manager3', '매니저', '매니저1', '매니저2', '매니저3', '메니저', '메니저1', '메니저2', '메니저3']);
const roleKey = (role: unknown) => text(role).toLowerCase().replace(/[\s_-]/g, '');
const validRoomNumber = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 1 && Number(value) <= 999;
const roomCount = (room: Row): number | null => room.roomCount === undefined
    ? ({ OneRoom: 1, TwoRoom: 2, ThreeRoom: 3 } as Record<string, number>)[text(room.type)] || null
    : validRoomNumber(room.roomCount) ? room.roomCount : null;
const companyKey = (value: unknown) => text(value).normalize('NFKC').toLowerCase()
    .replace(/주식회사|\(주\)|\(株\)/g, '').replace(/[\s().,·ㆍ-]/g, '');
const isCheongyeonName = (value: unknown) => ['청연이엔지', '청연엔지', '청연eng', 'cheongyeoneng', 'cyeng', '청연', 'cheongyeon', 'cy'].includes(companyKey(value));

export function accommodationCompanyTeams(teams: Row[], companies: Row[]): Row[] {
    const companyById = new Map(companies.flatMap(company => keys(company).map(id => [id, company] as const)));
    return teams.filter(team => {
        const company = companyById.get(text(team.companyId));
        // A resolved company reference takes precedence over a stale copied name on a team.
        if (company) return isCheongyeonName(company.name) || ['cy', 'cyeng'].includes(companyKey(company.code));
        return isCheongyeonName(team.companyName);
    });
}

export function validateAccommodationChanges(input: any): Change[] {
    const changes = input?.changes;
    if (!validId(input?.teamId) || typeof input?.revision !== 'string' || !/^[a-f0-9]{64}$/.test(input.revision)
        || !Array.isArray(changes) || (!changes.length && !input?.roomChanges?.length) || changes.length > 100
        || changes.some(change => !change || !validId(change.workerId) || (change.accommodationId !== null && !validId(change.accommodationId)))
        || new Set(changes.map(change => change.workerId)).size !== changes.length) {
        fail('invalid-argument', '배정할 작업자와 숙소를 확인해 주세요. 한 번에 최대 100명을 저장할 수 있습니다.');
    }
    return changes;
}

export function validateAccommodationRoomChanges(input: any): RoomChange[] {
    const changes = input?.roomChanges === undefined ? [] : input.roomChanges;
    if (!Array.isArray(changes) || changes.length > 100
        || changes.some(change => !change || !validId(change.accommodationId)
            || (change.roomCount !== null && !validRoomNumber(change.roomCount))
            || (change.maxOccupants !== null && !validRoomNumber(change.maxOccupants)))
        || new Set(changes.map(change => change.accommodationId)).size !== changes.length) {
        fail('invalid-argument', '방 개수와 최대 인원은 1~999의 정수 또는 미설정 값이어야 합니다. 한 번에 최대 100곳까지 저장할 수 있습니다.');
    }
    return changes;
}

/** Both reads and writes use live profile/membership and the same transaction snapshot. */
async function loadBoard(transaction: FirebaseFirestore.Transaction, uid: string, requestedTeam: unknown) {
    const db = admin.firestore();
    const [profileDoc, menuDoc] = await transaction.getAll(db.doc(`users/${uid}`), db.doc('settings/menus_v12'));
    const profile = profileDoc.data();
    if (profile?.status !== 'active') fail('permission-denied', '활성 계정이 필요합니다.');
    const roles = resolvedRoleNames(profile, menuDoc.data());
    const administrator = roles.some(role => adminRoles.has(roleKey(role)));
    if (!administrator && !roles.some(isTeamLeader)) fail('permission-denied', '팀장, DEV, CEO 또는 매니저 계정으로 이용해 주세요.');
    const readQuery = async (query: FirebaseFirestore.Query): Promise<Row[]> => {
        const rows: Row[] = [];
        let page = query.orderBy(FieldPath.documentId()).limit(500);
        while (true) {
            const snapshot = await transaction.get(page);
            rows.push(...snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
            if (snapshot.size < 500) return rows;
            page = query.orderBy(FieldPath.documentId()).startAfter(snapshot.docs[snapshot.docs.length - 1]).limit(500);
        }
    };
    const byIds = async (collection: string, fields: Array<string | FieldPath>, ids: string[]): Promise<Row[]> => {
        const unique = [...new Set(ids.filter(Boolean))];
        if (!unique.length) return [];
        const rows = await Promise.all(fields.flatMap(field => Array.from({ length: Math.ceil(unique.length / 30) }, (_, i) =>
            readQuery(db.collection(collection).where(field, 'in', unique.slice(i * 30, i * 30 + 30))))));
        return [...new Map(rows.flat().map(row => [row.id, row])).values()];
    };
    let teams: Row[];
    if (administrator) teams = await readQuery(db.collection('teams'));
    else {
        const links = profile?.linkedWorkerIds;
        if (!Array.isArray(links) || !links.length || links.length > 30 || !links.every(validId)) fail('permission-denied', '계정에 연결된 팀 작업자를 확인해 주세요.');
        const anchors = (await byIds('workers', [FieldPath.documentId()], links)).filter(activeWorker);
        teams = await byIds('teams', [FieldPath.documentId(), 'legacyId'], anchors.map(row => text(row.teamId)));
    }
    const companies = await readQuery(db.collection('companies').select('name', 'code', 'legacyId'));
    teams = accommodationCompanyTeams(teams, companies).filter(team => team.isActive !== false)
        .sort((a, b) => text(a.name).localeCompare(text(b.name), 'ko'));
    // "All teams" includes only Cheongyeon ENG teams, using the same scope for reads and saves.
    const teamId = text(requestedTeam) || teams[0]?.id || (administrator ? ALL_TEAMS : '');
    const team = teams.find(row => row.id === teamId);
    const allTeams = administrator && teamId === ALL_TEAMS;
    if (!allTeams && !team) fail('permission-denied', '배정 가능한 청연이엔지 소속 팀이 없습니다.');
    const teamKeys = allTeams ? teams.flatMap(keys) : team ? keys(team) : [];
    const workers = (await byIds('workers', ['teamId'], teamKeys)).filter(activeWorker);
    const workerKeys = workers.flatMap(keys);
    const assignments = await byIds('accommodationAssignments', ['teamId', 'team.id'], teamKeys);
    const workerAssignments = await byIds('accommodationAssignments', ['workerId', 'worker.id'], workerKeys);
    const allAssignments = [...new Map([...assignments, ...workerAssignments].map(row => [row.id, row])).values()];
    const date = today();
    // A team's current room list includes team allocations and individual occupancies recorded for it.
    // Team-level allocations remain intact when the last occupant leaves or moves.
    const allocations = assignments.filter(row => current(row, date));
    const houses = allTeams ? await readQuery(db.collection('accommodations'))
        : await byIds('accommodations', [FieldPath.documentId(), 'legacyId'], allocations.map(row => fieldId(row, 'accommodation')));
    const rooms = houses.filter(row => row.status === 'active'
        && (!row.contract?.startDate || row.contract.startDate <= date) && (!row.contract?.endDate || row.contract.endDate >= date));
    // Capacity includes occupants outside the currently selected company/team, without returning their identities.
    const roomOccupancies = (await byIds('accommodationAssignments', ['accommodationId', 'accommodation.id'], rooms.flatMap(keys)))
        .filter(row => fieldId(row, 'worker') && current(row, date));
    const roomFor = (id: string) => rooms.find(room => keys(room).includes(id));
    const occupants = (room: Row) => new Set(roomOccupancies.filter(row => keys(room).includes(fieldId(row, 'accommodation')))
        .map(row => workers.find(worker => keys(worker).includes(fieldId(row, 'worker')))?.id || fieldId(row, 'worker')));
    const workerRows = workers.map(worker => {
        const related = allAssignments.filter(row => keys(worker).includes(fieldId(row, 'worker')));
        const occupied = related.filter(row => current(row, date));
        const room = occupied[0] && roomFor(fieldId(occupied[0], 'accommodation'));
        let lockedReason = '';
        if (occupied.length > 1) lockedReason = '중복 입실 기록을 관리자에게 확인해 주세요.';
        else if (occupied.length && (!room || (!administrator && !teamKeys.includes(fieldId(occupied[0], 'team'))))) lockedReason = '배정 가능한 숙소 범위 밖의 입실 기록을 관리자에게 확인해 주세요.';
        else if (related.some(row => row.status !== 'ended' && row.startDate > date)) lockedReason = '예정된 입실 기록이 있어 관리자 확인이 필요합니다.';
        const workerTeam = teams.find(row => keys(row).includes(text(worker.teamId)));
        return { id: worker.id, name: text(worker.name), role: text(worker.role), teamId: workerTeam?.id || text(worker.teamId),
            teamName: text(workerTeam?.name || worker.teamName) || '소속 미지정', accommodationId: room?.id || null, ...(lockedReason ? { lockedReason } : {}) };
    }).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    const revision = createHash('sha256').update(JSON.stringify({ date, teamId, workers: workerRows,
        rooms: rooms.map(row => [row.id, row.status, row.contract?.endDate || '', roomCount(row), row.maxOccupants ?? null, row.ownership || '', [...occupants(row)].sort()]).sort(),
        assignments: allAssignments.map(row => [row.id, fieldId(row, 'worker'), fieldId(row, 'team'), fieldId(row, 'accommodation'),
            row.status || '', row.startDate || '', row.endDate || '', row.updatedAt?.toMillis?.() || 0]).sort(),
    })).digest('hex');
    return { teams, workers, rooms, allAssignments, date, occupants, board: {
        canManageAll: administrator, teamId, teams: teams.map(row => ({ id: row.id, name: text(row.name), color: text(row.color) })), date, revision,
        rooms: rooms.map(row => ({ id: row.id, name: text(row.name), address: text(row.address), type: text(row.type), ownership: text(row.ownership),
            roomCount: roomCount(row), maxOccupants: validRoomNumber(row.maxOccupants) ? row.maxOccupants : null, totalOccupants: occupants(row).size })), workers: workerRows,
    } };
}

export async function getTeamAccommodationBoardData(input: any, context: functions.https.CallableContext) {
    const auth = requireCallableAuth(context);
    if (input?.teamId && !validId(input.teamId)) fail('invalid-argument', '팀 정보를 확인해 주세요.');
    return admin.firestore().runTransaction(async transaction => (await loadBoard(transaction, auth.uid, input?.teamId)).board);
}

export async function saveTeamAccommodationBoardData(input: any, context: functions.https.CallableContext) {
    if (context.auth && isPreviewIdentity(context.auth.uid, context.auth.token)) fail('permission-denied', '조회 미리보기에서는 배정을 저장할 수 없습니다.');
    const auth = requireCallableAuth(context);
    const changes = validateAccommodationChanges(input);
    const roomChanges = validateAccommodationRoomChanges(input);
    const db = admin.firestore();
    return db.runTransaction(async transaction => {
        const { board, teams, workers, rooms, allAssignments, date, occupants } = await loadBoard(transaction, auth.uid, input.teamId);
        if (board.revision !== input.revision) fail('failed-precondition', '배정 정보가 변경되었습니다. 새로고침 후 다시 배정해 주세요.');
        // Validate the entire batch before queuing any writes.
        for (const change of changes) {
            const worker = board.workers.find(row => row.id === change.workerId);
            if (!worker || worker.lockedReason || (change.accommodationId !== null && !rooms.some(row => row.id === change.accommodationId))) {
                fail('permission-denied', '현재 계정에서 배정 가능한 작업자와 숙소만 변경할 수 있습니다.');
            }
        }
        for (const change of roomChanges) {
            if (!rooms.some(room => room.id === change.accommodationId)) fail('permission-denied', '현재 팀에서 배정 가능한 숙소의 설정만 변경할 수 있습니다.');
        }
        const affectedRooms = new Set(roomChanges.map(change => change.accommodationId));
        for (const change of changes) {
            const previous = board.workers.find(worker => worker.id === change.workerId)!.accommodationId;
            if (previous) affectedRooms.add(previous);
            if (change.accommodationId) affectedRooms.add(change.accommodationId);
        }
        for (const id of affectedRooms) {
            const room = rooms.find(row => row.id === id)!;
            const currentOccupants = occupants(room);
            const nextOccupants = new Set(currentOccupants);
            for (const change of changes) {
                nextOccupants.delete(change.workerId);
                if (change.accommodationId === id) nextOccupants.add(change.workerId);
            }
            const setting = roomChanges.find(change => change.accommodationId === id);
            const maximum = setting ? setting.maxOccupants : board.rooms.find(row => row.id === id)!.maxOccupants;
            if (maximum !== null && nextOccupants.size > maximum
                && (nextOccupants.size > currentOccupants.size || (setting && setting.maxOccupants !== (room.maxOccupants ?? null)))) {
                fail('failed-precondition', `${text(room.name)}의 최대 인원은 ${maximum}명입니다. 현재 입실 인원과 배정 변경을 확인해 주세요.`);
            }
        }
        const yesterday = new Date(new Date(`${date}T00:00:00Z`).getTime() - 86400_000).toISOString().slice(0, 10);
        for (const change of changes) {
            const worker = workers.find(row => row.id === change.workerId)!;
            const workerTeam = teams.find(row => keys(row).includes(text(worker.teamId)));
            const previous = allAssignments.find(row => keys(worker).includes(fieldId(row, 'worker')) && current(row, date));
            const target = rooms.find(row => row.id === change.accommodationId);
            if (board.workers.find(row => row.id === worker.id)!.accommodationId === change.accommodationId) continue;
            const stamp = { updatedAt: FieldValue.serverTimestamp(), updatedByUid: auth.uid };
            const next = target ? { workerId: worker.id, workerName: text(worker.name), teamId: workerTeam?.id || text(worker.teamId) || null, teamName: text(workerTeam?.name || worker.teamName) || null,
                accommodationId: target.id, accommodationName: text(target.name), source: 'worker', status: 'active', startDate: date, endDate: null, ...stamp } : null;
            if (previous && previous.startDate === date && next) {
                // Same-day correction: keep a single interval instead of creating overlapping history.
                transaction.update(db.doc(`accommodationAssignments/${previous.id}`), next);
            } else {
                if (previous) transaction.update(db.doc(`accommodationAssignments/${previous.id}`), {
                    status: 'ended', endDate: previous.startDate === date ? date : yesterday, ...stamp,
                });
                if (next) transaction.create(db.collection('accommodationAssignments').doc(), { ...next, createdAt: FieldValue.serverTimestamp() });
            }
            // Serialize concurrent assignments even when both initially had no occupancy row.
            transaction.update(db.doc(`workers/${worker.id}`), { accommodationAssignmentUpdatedAt: FieldValue.serverTimestamp() });
        }
        // Serialize settings and occupancy changes across teams sharing a room.
        for (const id of affectedRooms) {
            const setting = roomChanges.find(change => change.accommodationId === id);
            transaction.update(db.doc(`accommodations/${id}`), {
                ...(setting ? { roomCount: setting.roomCount, maxOccupants: setting.maxOccupants } : {}),
                updatedAt: FieldValue.serverTimestamp(), updatedByUid: auth.uid,
            });
        }
        return { saved: changes.length, roomsSaved: roomChanges.length };
    });
}

export const getTeamAccommodationBoard = protectedRegion.https.onCall(getTeamAccommodationBoardData);
export const saveTeamAccommodationBoard = protectedRegion.https.onCall(saveTeamAccommodationBoardData);
