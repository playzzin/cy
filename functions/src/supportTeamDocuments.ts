import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import { createHash } from 'crypto';
import { protectedRegion, requireCallableAuth } from './auth';
import { resolvedRoleNames } from './teamExpenseRequests';
import { isTeamLeader, TeamRow, text } from './teamReadPolicy';
import { queryByIds, queryRows } from './teamScopedQuery';
import { activeDocumentWorker, documentRowIds, supportDocumentOfficeRole, supportDocumentPeople } from './supportTeamDocumentPolicy';
import { summaryDirectoryTeams } from './workerSummaryDirectory';
import { bankPhotoPath, documentPhotoContentType, validateBankPhoto } from './workerBankPhotos';

const deny = (): never => { throw new functions.https.HttpsError('permission-denied', '팀장 계정과 작업자 목록의 서류 조회 권한을 확인해 주세요.'); };
const validId = (id: unknown): id is string => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(id);
const IDENTITY_PART_BYTES = 3 * 1024 * 1024; // Each base64 response fits a v1 callable. The original has no size cap.

async function readDocumentPhoto(path: string, input: { kind: string; offset?: number; revision?: string }) {
    const bucket = admin.storage().bucket();
    const file = bucket.file(path);
    try {
        const [metadata] = await file.getMetadata();
        if (input.kind !== 'identity' || input.offset === undefined) {
            // Older clients expect a complete photo in one response.
            if (Number(metadata.size) > 5 * 1024 * 1024) throw new functions.https.HttpsError('failed-precondition', '이 공유 방식은 5MiB까지 지원합니다. 화면을 새로고침해 주세요.');
            const [bytes] = await file.download();
            const { contentType } = validateBankPhoto(bytes.toString('base64'));
            return { base64: bytes.toString('base64'), contentType };
        }
        const size = Number(metadata.size), offset = input.offset;
        if (!Number.isSafeInteger(size) || size < 12 || !metadata.generation)
            throw new functions.https.HttpsError('failed-precondition', '등록된 원본 파일을 확인해 주세요.');
        const revision = createHash('sha256').update(JSON.stringify([path, String(metadata.generation)])).digest('hex');
        if (offset > 0 && input.revision !== revision)
            throw new functions.https.HttpsError('aborted', '서류가 변경되었습니다. 다시 준비해 주세요.');
        if (!Number.isSafeInteger(offset) || offset < 0 || offset >= size || offset % IDENTITY_PART_BYTES !== 0)
            throw new functions.https.HttpsError('invalid-argument', '사진 읽기 위치를 확인해 주세요.');
        const end = Math.min(offset + IDENTITY_PART_BYTES, size) - 1;
        const original = bucket.file(path, { generation: metadata.generation });
        const [bytes] = await original.download({ start: offset, end, validation: false });
        const header = offset === 0 ? bytes : (await original.download({ start: 0, end: 11, validation: false }))[0];
        const contentType = documentPhotoContentType(header);
        if (!contentType) throw new functions.https.HttpsError('failed-precondition', '지원되지 않는 원본 사진 형식입니다.');
        if (bytes.length !== end - offset + 1 || String((await file.getMetadata())[0].generation) !== String(metadata.generation))
            throw new functions.https.HttpsError('aborted', '서류가 변경되었습니다. 다시 준비해 주세요.');
        return { base64: bytes.toString('base64'), contentType, offset, size, revision };
    } catch (error) {
        if ((error as { code?: number })?.code === 404) throw new functions.https.HttpsError('not-found', '등록한 원본 사진을 찾을 수 없습니다.');
        throw error;
    }
}

export async function readSupportDocumentScope(db: admin.firestore.Firestore, uid: string) {
    const [user, menu] = await db.getAll(db.doc(`users/${uid}`), db.doc('settings/menus_v12'));
    const profile = user.data();
    if (!profile || profile.status !== 'active') deny();
    const roles = resolvedRoleNames(profile, menu.data());
    const office = roles.some(supportDocumentOfficeRole);
    let ownTeamIds: string[] = [];
    if (!office) {
        const links = Array.isArray(profile.linkedWorkerIds) ? [...new Set<string>(profile.linkedWorkerIds)] : [];
        if (!roles.some(isTeamLeader) || !links.length || links.length > 30 || !links.every(validId)) deny();
        const anchors = (await db.getAll(...links.map(id => db.collection('workers').doc(id))))
            .filter(row => row.exists).map(row => ({ ...row.data(), id: row.id } as TeamRow)).filter(activeDocumentWorker);
        ownTeamIds = [...new Set(anchors.map(row => text(row.teamId)).filter(Boolean))];
        if (!ownTeamIds.length) deny();
    }
    const [teams, companies] = await Promise.all([
        queryRows(db.collection('teams').select('legacyId', 'name', 'leaderId', 'companyId', 'companyName', 'isActive', 'status')),
        queryRows(db.collection('companies').select('legacyId', 'name')),
    ]);
    const ownTeams = teams.filter(team => team.isActive !== false && documentRowIds(team).some(id => ownTeamIds.includes(id)));
    ownTeamIds = ownTeams.flatMap(documentRowIds);
    if (!office && !ownTeamIds.length) deny();
    // Reuse the worker list's company scope. Attendance, payroll month and site
    // filters do not limit a team leader's document viewing or sharing.
    const allowedTeams = office ? teams : summaryDirectoryTeams(teams, companies, ownTeams);
    const allowedTeamIds = allowedTeams.flatMap(documentRowIds);
    const workers = office ? await queryRows(db.collection('workers')) : await queryByIds(db, 'workers', ['teamId'], allowedTeamIds);
    // No paths, account numbers or identity numbers leave the directory.
    return { people: supportDocumentPeople({ ownTeamIds, allowedTeamIds, office, teams, workers }), workers };
}

export async function handleSupportTeamDocuments(input: any, context: functions.https.CallableContext) {
    const { uid } = requireCallableAuth(context);
    // The entrypoint validates preview sessions; requireCallableAuth resolves
    // the selected user's UID so the same directory scope applies to reads.
    if (!['list', 'read'].includes(input?.action) || (input.action === 'read'
        && (!validId(input.workerId) || !['identity', 'bank', 'directPayBank'].includes(input.kind)))) {
        throw new functions.https.HttpsError('invalid-argument', '서류 공유 요청을 확인해 주세요.');
    }
    const db = admin.firestore();
    const scope = await readSupportDocumentScope(db, uid);
    if (input.action === 'list') return { workers: scope.people };
    if (!scope.people.some(worker => worker.id === input.workerId)) deny();
    const worker = scope.workers.find(row => row.id === input.workerId)!;
    const field = input.kind === 'identity' ? 'fileNameSaved' : input.kind === 'bank' ? 'bankPhotoId' : 'directPayBankPhotoId';
    const version = text(worker[field]);
    if (!version) return { photo: null };
    if (input.kind !== 'identity' && !/^[a-f0-9]{32}$/.test(version)) {
        throw new functions.https.HttpsError('failed-precondition', '등록된 통장사본을 확인해 주세요.');
    }
    // The server binds the object to the current worker record. No public URL.
    const path = input.kind === 'identity' ? version : bankPhotoPath(worker.id, version, input.kind === 'directPayBank');
    if ((input.kind === 'identity' && !path.startsWith('id_cards/')) || path.startsWith('/') || path.includes('..') || /^(https?:|gs:)/.test(path)) {
        throw new functions.https.HttpsError('failed-precondition', '서류 원본 경로를 확인해 주세요.');
    }
    const photo = await readDocumentPhoto(path, input);
    const current = await readSupportDocumentScope(db, uid);
    if (!current.people.some(row => row.id === worker.id)) deny();
    if (text(current.workers.find(row => row.id === worker.id)?.[field]) !== version) {
        throw new functions.https.HttpsError('aborted', '서류가 변경되었습니다. 다시 준비해 주세요.');
    }
    return { photo };
}

export const supportTeamDocuments = protectedRegion.https.onCall(handleSupportTeamDocuments);
