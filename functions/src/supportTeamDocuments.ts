import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import { protectedRegion, requireCallableAuth } from './auth';
import { isPreviewIdentity } from './devPreviewPolicy';
import { resolvedRoleNames } from './teamExpenseRequests';
import { isTeamLeader, TeamRow, text } from './teamReadPolicy';
import { queryByIds, queryRows } from './teamScopedQuery';
import { activeDocumentWorker, documentRowIds, supportDocumentOfficeRole, supportDocumentPeople } from './supportTeamDocumentPolicy';
import { summaryDirectoryTeams } from './workerSummaryDirectory';
import { bankPhotoPath, validateBankPhoto } from './workerBankPhotos';

const deny = (): never => { throw new functions.https.HttpsError('permission-denied', '팀장 계정과 작업자 목록의 서류 조회 권한을 확인해 주세요.'); };
const validId = (id: unknown): id is string => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(id);

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
    if (isPreviewIdentity(uid, context.auth?.token)) deny();
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
    const file = admin.storage().bucket().file(path);
    const [metadata] = await file.getMetadata();
    if (Number(metadata.size) > 5 * 1024 * 1024) throw new functions.https.HttpsError('failed-precondition', '서류 사진은 5MB 이하만 공유할 수 있습니다.');
    const [bytes] = await file.download();
    const photo = validateBankPhoto(bytes.toString('base64'));
    const current = await readSupportDocumentScope(db, uid);
    if (!current.people.some(row => row.id === worker.id)) deny();
    if (text(current.workers.find(row => row.id === worker.id)?.[field]) !== version) {
        throw new functions.https.HttpsError('aborted', '서류가 변경되었습니다. 다시 준비해 주세요.');
    }
    return { photo: { base64: photo.bytes.toString('base64'), contentType: photo.contentType } };
}

export const supportTeamDocuments = protectedRegion.https.onCall(handleSupportTeamDocuments);
