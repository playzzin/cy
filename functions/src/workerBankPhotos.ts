import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import { createHash } from 'crypto';
import { protectedRegion, requireCallableAuth } from './auth';
import { isPreviewIdentity } from './devPreviewPolicy';
import { resolvedRoleNames } from './teamExpenseRequests';
import { isTeamLeader, text } from './teamReadPolicy';

const MAX_BYTES = 5 * 1024 * 1024;
const officeRoles = new Set(['admin', 'administrator', 'superadmin', 'owner', 'dev', 'developer', 'systemadmin', '관리자', '사장', '대표', 'ceo', '실장', '개발자', 'office', 'officestaff', '사무실', '사무실직원', '사무직원', '사무', 'manager', 'manager1', 'manager2', 'manager3', '매니저', '메니저', 'payrollmanager', 'finance', 'accounting', '회계', '재무', '경리']);
const fail = (code: functions.https.FunctionsErrorCode, message: string): never => { throw new functions.https.HttpsError(code, message); };
const validId = (id: unknown): id is string => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(id);
const photoIdValid = (id: unknown): id is string => typeof id === 'string' && /^[a-f0-9]{32}$/.test(id);
const active = (row: any) => row && row.isActive !== false && !['퇴사', 'inactive', 'retired', 'archived', '출입금지'].includes(text(row.status));
// This namespace is already excluded from all browser Storage fallback rules.
export const bankPhotoPath = (workerId: string, photoId: string, directPay = false) => `team-worker-documents/account-photos/${workerId}/${directPay ? 'direct-pay/' : ''}${photoId}`;

export function validateBankPhoto(encoded: unknown): { bytes: Buffer; contentType: string } {
    if (typeof encoded !== 'string' || encoded.length > Math.ceil(MAX_BYTES / 3) * 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) fail('invalid-argument', '계좌사진은 JPG·PNG·WEBP 원본을 5MB 이하로 올려 주세요.');
    const bytes = Buffer.from(encoded as string, 'base64');
    if (bytes.length < 12 || bytes.length > MAX_BYTES || bytes.toString('base64') !== encoded) fail('invalid-argument', '계좌사진 파일을 확인해 주세요.');
    const contentType = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? 'image/jpeg'
        : bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? 'image/png'
            : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' ? 'image/webp' : '';
    if (!contentType) fail('invalid-argument', 'JPG·PNG·WEBP 계좌사진만 등록할 수 있습니다.');
    return { bytes, contentType };
}

async function authorize(transaction: FirebaseFirestore.Transaction, uid: string, workerId: string) {
    const db = admin.firestore();
    const [user, menu, worker] = await transaction.getAll(db.doc(`users/${uid}`), db.doc('settings/menus_v12'), db.collection('workers').doc(workerId));
    const profile = user.data(), row = worker.data();
    const deny = () => fail('permission-denied', '현재 소속 팀의 작업자 계좌사진만 이용할 수 있습니다.');
    if (profile?.status !== 'active' || !worker.exists || !active(row)) deny();
    const roles = resolvedRoleNames(profile, menu.data());
    if (!roles.some(role => officeRoles.has(role.toLowerCase().replace(/[\s_-]/g, '')))) {
        const links: string[] = Array.isArray(profile.linkedWorkerIds) ? [...new Set<string>(profile.linkedWorkerIds)] : [];
        if (!links.length || links.length > 30 || !links.every(validId)) deny();
        const anchors = (await transaction.getAll(...links.map(id => db.collection('workers').doc(id)))).filter(doc => active(doc.data()));
        if (![...roles, ...anchors.map(doc => doc.data()?.role)].some(isTeamLeader)) deny();
        const teamIds = [...new Set(anchors.map(doc => text(doc.data()?.teamId)).filter(Boolean))];
        if (!teamIds.length || !teamIds.every(validId)) deny();
        const direct = await transaction.getAll(...teamIds.map(id => db.collection('teams').doc(id)));
        const legacy = await transaction.get(db.collection('teams').where('legacyId', 'in', teamIds));
        const allowed = new Set([...direct, ...legacy.docs].filter(doc => doc.exists && doc.data()?.isActive !== false)
            .flatMap(doc => [doc.id, text(doc.data()?.legacyId)]).filter(Boolean));
        if (!allowed.has(text(row.teamId))) deny();
    }
    return { ref: worker.ref, row };
}

export async function handleWorkerBankPhotos(input: any, context: functions.https.CallableContext) {
    if (context.auth && isPreviewIdentity(context.auth.uid, context.auth.token)) fail('permission-denied', '미리보기에서는 계좌사진을 처리할 수 없습니다.');
    const { uid } = requireCallableAuth(context);
    if (!validId(input?.workerId) || !['read', 'save', 'readDirectPay', 'saveDirectPay'].includes(input?.action)) fail('invalid-argument', '작업자와 요청을 확인해 주세요.');
    const workerId: string = input.workerId, db = admin.firestore(), bucket = admin.storage().bucket();
    const directPay = input.action === 'readDirectPay' || input.action === 'saveDirectPay';
    const photoField = directPay ? 'directPayBankPhotoId' : 'bankPhotoId';
    const updatedField = directPay ? 'directPayBankPhotoUpdatedAt' : 'bankPhotoUpdatedAt';
    if (input.action === 'read' || input.action === 'readDirectPay') {
        const { row } = await db.runTransaction(tx => authorize(tx, uid, workerId));
        const photoId = row[photoField];
        if (!photoId) return { photo: null };
        if (!photoIdValid(photoId)) fail('failed-precondition', '등록된 계좌사진을 확인해 주세요.');
        const file = bucket.file(bankPhotoPath(workerId, photoId, directPay));
        const [metadata] = await file.getMetadata();
        if (Number(metadata.size) > MAX_BYTES) fail('failed-precondition', '계좌사진 크기를 확인해 주세요.');
        const [bytes] = await file.download();
        const validated = validateBankPhoto(bytes.toString('base64'));
        const current = await db.runTransaction(tx => authorize(tx, uid, workerId));
        if (current.row[photoField] !== photoId) fail('aborted', '계좌사진이 변경됐습니다. 다시 준비해 주세요.');
        return { photo: { photoId, contentType: validated.contentType, base64: bytes.toString('base64') } };
    }
    if (!photoIdValid(input.photoId) || (input.expectedPhotoId !== '' && !photoIdValid(input.expectedPhotoId))) fail('invalid-argument', '사진 등록 정보를 확인해 주세요.');
    const { bytes, contentType } = validateBankPhoto(input.base64);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const checkVersion = (row: any) => {
        if ((row[photoField] || '') !== input.expectedPhotoId && row[photoField] !== input.photoId) fail('aborted', '다른 곳에서 계좌사진을 변경했습니다. 새로고침 후 다시 등록해 주세요.');
    };
    const before = await db.runTransaction(async tx => { const result = await authorize(tx, uid, workerId); checkVersion(result.row); return result; });
    const file = bucket.file(bankPhotoPath(workerId, input.photoId, directPay));
    const sameOriginal = async () => {
        try {
            const [metadata] = await file.getMetadata();
            if (metadata.metadata?.sha256 !== sha256) fail('already-exists', '같은 등록 요청의 사진이 달라졌습니다. 사진을 다시 선택해 주세요.');
            return true;
        } catch (error) {
            if (Number((error as any)?.code) === 404) return false;
            throw error;
        }
    };
    try {
        // Skip completed uploads on retries; the generation precondition also protects concurrent uploads.
        if (!await sameOriginal()) await file.save(bytes, { resumable: false, preconditionOpts: { ifGenerationMatch: 0 }, metadata: { contentType, cacheControl: 'private, no-store', metadata: { sha256 } } });
    } catch (error) {
        if (Number((error as any)?.code) !== 412) throw error;
        if (!await sameOriginal()) fail('aborted', '계좌사진을 다시 등록해 주세요.');
    }
    await db.runTransaction(async tx => {
        const { ref, row } = await authorize(tx, uid, workerId);
        checkVersion(row);
        if (row[photoField] === input.photoId) return;
        tx.update(ref, { [photoField]: input.photoId, [updatedField]: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        tx.create(db.collection('audit_logs').doc(), {
            category: 'WORKER_BANK_PHOTO', action: 'REGISTER', actorId: uid, targetId: workerId,
            timestamp: new Date().toISOString(), details: JSON.stringify({ fileCount: 1, purpose: directPay ? 'directPay' : 'default', replaced: Boolean(row[photoField]) }),
        });
    });
    if (photoIdValid(before.row[photoField]) && before.row[photoField] !== input.photoId) {
        await bucket.file(bankPhotoPath(workerId, before.row[photoField], directPay)).delete({ ignoreNotFound: true }).catch(() => undefined);
    }
    return { photoId: input.photoId };
}

export const workerBankPhotos = protectedRegion.https.onCall(handleWorkerBankPhotos);
