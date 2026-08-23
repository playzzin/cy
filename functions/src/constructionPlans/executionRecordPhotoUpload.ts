import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import {
    canonicalStringify,
    isUnknownRecord,
    readTrimmedString,
    sha256Hex,
    type UnknownRecord,
} from './domain';
import {
    deriveConstructionPlanRecordDraftStatus,
    type ConstructionPlanRecordPhoto,
} from './executionRecordDomain';
import {
    CONSTRUCTION_PLAN_RECORDS_COLLECTION,
    CONSTRUCTION_PLAN_RECORD_UPLOAD_SESSIONS_COLLECTION,
    assertPlanBindingUnchanged,
    assertRecordEditAccess,
    executionRecordBucket,
    executionRecordData,
    executionRecordDb,
    loadIssuedPlanRecordContext,
    resolveExecutionRecordActor,
    type ExecutionRecordActor,
} from './executionRecords';

const PLANS_COLLECTION = 'constructionPlans';
const AUDIT_COLLECTION = 'constructionPlanAuditEvents';
const MAX_PHOTO_BYTES = 12 * 1024 * 1024;
const MAX_RECORD_PHOTOS = 40;
const SESSION_TTL_MS = 30 * 60 * 1000;
const CLEANUP_LIMIT = 300;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export type ExecutionRecordPhotoMimeType = 'image/jpeg' | 'image/png';
export type ExecutionRecordPhotoUploadStatus =
    | 'awaiting_upload'
    | 'completed'
    | 'cancelled'
    | 'expired'
    | 'failed';

interface StartPhotoUploadRequest {
    recordId: string;
    expectedVersion: number;
    originalFileName: string;
    mimeType: ExecutionRecordPhotoMimeType;
    sizeBytes: number;
    sha256: string;
    caption: string;
    takenAt: string;
    zone: string;
    idempotencyKey: string;
}

interface ExecutionRecordPhotoUploadSession extends StartPhotoUploadRequest {
    schemaVersion: 1;
    id: string;
    ownerId: string;
    ownerName?: string;
    planId: string;
    siteId: string;
    photoId: string;
    stagingPath: string;
    canonicalPath: string;
    requestFingerprint: string;
    idempotencyKeyHash: string;
    status: ExecutionRecordPhotoUploadStatus;
    createdAt: string;
    createdAtEpochMs: number;
    expiresAt: string;
    expiresAtEpochMs: number;
    cleanupAfterEpochMs: number | null;
    canonicalGeneration?: string;
    result?: UnknownRecord;
}

const runner = functions.runWith({ timeoutSeconds: 60, memory: '512MB', maxInstances: 20 })
    .region('asia-northeast3');
const uploadRunner = functions.runWith({ timeoutSeconds: 300, memory: '1GB', maxInstances: 5 })
    .region('asia-northeast3');

const requestRecord = (value: unknown): UnknownRecord => {
    if (!isUnknownRecord(value)) {
        throw new functions.https.HttpsError('invalid-argument', '실행기록 사진 업로드 요청이 올바르지 않습니다.');
    }
    return value;
};

const exactKeys = (record: UnknownRecord, allowedKeys: readonly string[]): void => {
    const allowed = new Set(allowedKeys);
    if (Object.keys(record).some((key) => !allowed.has(key))) {
        throw new functions.https.HttpsError('invalid-argument', '사진 업로드 요청에 허용되지 않은 필드가 있습니다.');
    }
};

const requiredText = (record: UnknownRecord, key: string, maximum: number): string => {
    const value = readTrimmedString(record, [key]);
    if (!value || value.length > maximum) {
        throw new functions.https.HttpsError('invalid-argument', `${key} 값이 올바르지 않습니다.`);
    }
    return value.normalize('NFKC').replace(/\s+/g, ' ').trim();
};

const documentId = (record: UnknownRecord, key: string): string => {
    const value = requiredText(record, key, 200);
    if (!ID_PATTERN.test(value) || value.includes('/') || value === '.' || value === '..') {
        throw new functions.https.HttpsError('invalid-argument', `${key} 식별자가 올바르지 않습니다.`);
    }
    return value;
};

const expectedVersion = (record: UnknownRecord): number => {
    const value = Number(record.expectedVersion);
    if (!Number.isInteger(value) || value < 1) {
        throw new functions.https.HttpsError('invalid-argument', 'expectedVersion 값이 올바르지 않습니다.');
    }
    return value;
};

const mimeType = (value: unknown): ExecutionRecordPhotoMimeType => {
    if (value !== 'image/jpeg' && value !== 'image/png') {
        throw new functions.https.HttpsError('invalid-argument', '현장사진은 JPEG 또는 PNG만 등록할 수 있습니다.');
    }
    return value;
};

const capturedAt = (record: UnknownRecord): string => {
    const value = requiredText(record, 'takenAt', 40);
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) || Number.isNaN(Date.parse(value))) {
        throw new functions.https.HttpsError('invalid-argument', 'takenAt 촬영시각이 올바르지 않습니다.');
    }
    return value;
};

const parseStartRequest = (value: unknown): StartPhotoUploadRequest => {
    const record = requestRecord(value);
    exactKeys(record, [
        'recordId', 'expectedVersion', 'originalFileName', 'mimeType', 'sizeBytes',
        'sha256', 'caption', 'takenAt', 'zone', 'idempotencyKey',
    ]);
    const sizeBytes = Number(record.sizeBytes);
    const sha256 = requiredText(record, 'sha256', 64).toLowerCase();
    const idempotencyKey = requiredText(record, 'idempotencyKey', 128);
    if (!Number.isInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_PHOTO_BYTES) {
        throw new functions.https.HttpsError('invalid-argument', '현장사진은 12MB 이하이어야 합니다.');
    }
    if (!SHA256_PATTERN.test(sha256)) {
        throw new functions.https.HttpsError('invalid-argument', 'sha256 값이 올바르지 않습니다.');
    }
    if (!IDEMPOTENCY_PATTERN.test(idempotencyKey)) {
        throw new functions.https.HttpsError('invalid-argument', 'idempotencyKey 값이 올바르지 않습니다.');
    }
    return {
        recordId: documentId(record, 'recordId'),
        expectedVersion: expectedVersion(record),
        originalFileName: requiredText(record, 'originalFileName', 255),
        mimeType: mimeType(record.mimeType),
        sizeBytes,
        sha256,
        caption: requiredText(record, 'caption', 500),
        takenAt: capturedAt(record),
        zone: requiredText(record, 'zone', 200),
        idempotencyKey,
    };
};

export const detectExecutionRecordPhotoMimeType = (bytes: Buffer): ExecutionRecordPhotoMimeType | null => {
    if (bytes.length >= 8
        && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
        && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) {
        return 'image/png';
    }
    if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8
        && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9) {
        return 'image/jpeg';
    }
    return null;
};

export const validateExecutionRecordPhotoBytes = (input: {
    bytes: Buffer;
    expectedMimeType: ExecutionRecordPhotoMimeType;
    expectedSizeBytes: number;
    expectedSha256: string;
}): void => {
    if (input.bytes.length !== input.expectedSizeBytes
        || input.bytes.length <= 0 || input.bytes.length > MAX_PHOTO_BYTES) {
        throw new Error('execution-record-photo-size-mismatch');
    }
    if (detectExecutionRecordPhotoMimeType(input.bytes) !== input.expectedMimeType) {
        throw new Error('execution-record-photo-magic-mismatch');
    }
    if (sha256Hex(input.bytes) !== input.expectedSha256) {
        throw new Error('execution-record-photo-sha256-mismatch');
    }
};

const extensionFor = (type: ExecutionRecordPhotoMimeType): 'jpg' | 'png' =>
    type === 'image/png' ? 'png' : 'jpg';

const canonicalSegment = (value: string, label: string): string => {
    const normalized = value.normalize('NFKC').trim();
    if (!normalized || normalized === '.' || normalized === '..'
        || normalized.includes('/') || normalized.includes('\\') || normalized.length > 200) {
        throw new Error(`execution-record-photo-${label}-path-segment-invalid`);
    }
    return normalized;
};

export const buildExecutionRecordPhotoCanonicalPath = (input: {
    siteId: string;
    planId: string;
    recordId: string;
    photoId: string;
    sha256: string;
    mimeType: ExecutionRecordPhotoMimeType;
}): string => `construction-plan-records/${canonicalSegment(input.siteId, 'site')}/${canonicalSegment(input.planId, 'plan')}/${canonicalSegment(input.recordId, 'record')}/photos/${canonicalSegment(input.photoId, 'photo')}/${input.sha256}.${extensionFor(input.mimeType)}`;

const asSession = (value: unknown): ExecutionRecordPhotoUploadSession => {
    if (!isUnknownRecord(value)
        || value.schemaVersion !== 1
        || typeof value.id !== 'string'
        || typeof value.ownerId !== 'string'
        || typeof value.recordId !== 'string'
        || typeof value.planId !== 'string'
        || typeof value.siteId !== 'string'
        || typeof value.photoId !== 'string'
        || typeof value.stagingPath !== 'string'
        || typeof value.canonicalPath !== 'string'
        || !['awaiting_upload', 'completed', 'cancelled', 'expired', 'failed'].includes(String(value.status))) {
        throw new functions.https.HttpsError('data-loss', '실행기록 사진 업로드 세션이 손상되었습니다.');
    }
    return value as unknown as ExecutionRecordPhotoUploadSession;
};

const sessionResponse = (session: ExecutionRecordPhotoUploadSession, idempotent = false): UnknownRecord => ({
    schemaVersion: 1,
    sessionId: session.id,
    status: session.status,
    recordId: session.recordId,
    planId: session.planId,
    photoId: session.photoId,
    stagingPath: session.stagingPath,
    canonicalPath: session.canonicalPath,
    expiresAt: session.expiresAt,
    expiresAtEpochMs: session.expiresAtEpochMs,
    ...(session.status === 'completed' && session.result ? { result: session.result } : {}),
    idempotent,
});

const assertSessionOwner = (session: ExecutionRecordPhotoUploadSession, actor: ExecutionRecordActor): void => {
    if (session.ownerId !== actor.uid && !actor.access.isAdmin && !actor.access.isOffice) {
        throw new functions.https.HttpsError('permission-denied', '이 사진 업로드 세션을 사용할 권한이 없습니다.');
    }
};

const storageMetadataString = (metadata: UnknownRecord, key: string): string => {
    const custom = isUnknownRecord(metadata.metadata) ? metadata.metadata : {};
    return typeof custom[key] === 'string' ? String(custom[key]) : '';
};

const auditRecord = (
    actor: ExecutionRecordActor,
    record: UnknownRecord,
    action: string,
    at: string,
    metadata: UnknownRecord,
): UnknownRecord => ({
    schemaVersion: 1,
    entityType: 'construction-plan-record',
    entityId: record.id,
    recordId: record.id,
    planId: record.planId,
    siteId: record.siteId,
    recordType: record.recordType,
    recordRevision: record.recordRevision,
    action,
    type: action,
    actorId: actor.uid,
    ...(actor.name ? { actorName: actor.name } : {}),
    metadata,
    at,
    createdAt: at,
});

const startPhotoUpload = async (
    data: unknown,
    context: functions.https.CallableContext,
): Promise<UnknownRecord> => {
    const [request, actor] = await Promise.all([parseStartRequest(data), resolveExecutionRecordActor(context)]);
    const fingerprint = sha256Hex(canonicalStringify({ ...request, idempotencyKey: undefined }));
    const sessionId = `record-photo-${sha256Hex(canonicalStringify({ actorId: actor.uid, key: request.idempotencyKey })).slice(0, 40)}`;
    const photoId = `photo-${sha256Hex(canonicalStringify({ sessionId, sha256: request.sha256 })).slice(0, 32)}`;
    const sessionRef = executionRecordDb().collection(CONSTRUCTION_PLAN_RECORD_UPLOAD_SESSIONS_COLLECTION).doc(sessionId);
    const existing = await sessionRef.get();
    if (existing.exists) {
        const session = asSession(existing.data());
        assertSessionOwner(session, actor);
        if (session.requestFingerprint !== fingerprint) {
            throw new functions.https.HttpsError('already-exists', '같은 idempotencyKey가 다른 사진 요청에 사용되었습니다.');
        }
        return sessionResponse(session, true);
    }

    const recordRef = executionRecordDb().collection(CONSTRUCTION_PLAN_RECORDS_COLLECTION).doc(request.recordId);
    const preflight = executionRecordData(await recordRef.get());
    const planId = String(preflight.planId);
    const planContext = await loadIssuedPlanRecordContext(planId);
    assertRecordEditAccess(preflight, planContext.plan, actor);
    const nowEpochMs = Date.now();
    const expiresAtEpochMs = nowEpochMs + SESSION_TTL_MS;

    return executionRecordDb().runTransaction(async (transaction) => {
        const planRef = executionRecordDb().collection(PLANS_COLLECTION).doc(planId);
        const exportRef = planRef.collection('exports').doc(planContext.exportId);
        const [sessionSnapshot, recordSnapshot, planSnapshot, exportSnapshot] = await Promise.all([
            transaction.get(sessionRef), transaction.get(recordRef), transaction.get(planRef), transaction.get(exportRef),
        ]);
        if (sessionSnapshot.exists) {
            const replay = asSession(sessionSnapshot.data());
            assertSessionOwner(replay, actor);
            if (replay.requestFingerprint !== fingerprint) {
                throw new functions.https.HttpsError('already-exists', '같은 idempotencyKey가 다른 사진 요청에 사용되었습니다.');
            }
            return sessionResponse(replay, true);
        }
        const record = executionRecordData(recordSnapshot);
        const plan = planSnapshot.exists && isUnknownRecord(planSnapshot.data()) ? planSnapshot.data() as UnknownRecord : {};
        const exported = exportSnapshot.exists && isUnknownRecord(exportSnapshot.data()) ? exportSnapshot.data() as UnknownRecord : {};
        const binding = assertPlanBindingUnchanged(record, planId, plan, exported);
        assertRecordEditAccess(record, plan, actor);
        if (record.version !== request.expectedVersion) {
            throw new functions.https.HttpsError('aborted', '다른 사용자가 실행기록을 변경했습니다. 새로고침하세요.');
        }
        const photos = Array.isArray(record.photos) ? record.photos : [];
        if (photos.length >= MAX_RECORD_PHOTOS) {
            throw new functions.https.HttpsError('resource-exhausted', `실행기록 사진은 최대 ${MAX_RECORD_PHOTOS}장입니다.`);
        }
        const stagingPath = `construction-plan-record-staging/${actor.uid}/${sessionId}/source`;
        const canonicalPath = buildExecutionRecordPhotoCanonicalPath({
            siteId: String(binding.siteId), planId, recordId: request.recordId, photoId,
            sha256: request.sha256, mimeType: request.mimeType,
        });
        const createdAt = new Date(nowEpochMs).toISOString();
        const session: ExecutionRecordPhotoUploadSession = {
            schemaVersion: 1,
            id: sessionId,
            ownerId: actor.uid,
            ...(actor.name ? { ownerName: actor.name } : {}),
            planId,
            siteId: String(binding.siteId),
            photoId,
            ...request,
            stagingPath,
            canonicalPath,
            requestFingerprint: fingerprint,
            idempotencyKeyHash: sha256Hex(request.idempotencyKey),
            status: 'awaiting_upload',
            createdAt,
            createdAtEpochMs: nowEpochMs,
            expiresAt: new Date(expiresAtEpochMs).toISOString(),
            expiresAtEpochMs,
            cleanupAfterEpochMs: expiresAtEpochMs,
        };
        transaction.create(sessionRef, session);
        return sessionResponse(session);
    });
};

const validateStagedPhoto = async (session: ExecutionRecordPhotoUploadSession): Promise<{
    bytes: Buffer;
    stagingGeneration: string;
}> => {
    const file = executionRecordBucket().file(session.stagingPath);
    const [exists] = await file.exists();
    if (!exists) throw new functions.https.HttpsError('failed-precondition', '업로드한 현장사진을 찾을 수 없습니다.');
    const [[metadata], [bytes]] = await Promise.all([file.getMetadata(), file.download()]);
    const generation = String(metadata.generation || '');
    if (metadata.contentType !== session.mimeType
        || Number(metadata.size) !== session.sizeBytes
        || storageMetadataString(metadata as UnknownRecord, 'uploadSessionId') !== session.id
        || storageMetadataString(metadata as UnknownRecord, 'sourceSha256').toLowerCase() !== session.sha256
        || !/^\d+$/.test(generation)) {
        throw new functions.https.HttpsError('data-loss', '업로드 사진의 메타데이터·generation이 세션과 일치하지 않습니다.');
    }
    try {
        validateExecutionRecordPhotoBytes({
            bytes,
            expectedMimeType: session.mimeType,
            expectedSizeBytes: session.sizeBytes,
            expectedSha256: session.sha256,
        });
    } catch (error) {
        const code = error instanceof Error ? error.message : 'execution-record-photo-invalid';
        throw new functions.https.HttpsError('data-loss', `현장사진 원본 검증에 실패했습니다: ${code}`);
    }
    return { bytes, stagingGeneration: generation };
};

const copyStagingPhoto = async (
    session: ExecutionRecordPhotoUploadSession,
    stagingGeneration: string,
): Promise<{ generation: string; created: boolean }> => {
    const source = executionRecordBucket().file(session.stagingPath, { generation: stagingGeneration });
    const destination = executionRecordBucket().file(session.canonicalPath);
    const metadata = {
        contentType: session.mimeType,
        cacheControl: 'private, max-age=31536000, immutable',
        metadata: {
            immutable: 'true',
            uploadSessionId: session.id,
            sourceSha256: session.sha256,
            uploaderId: session.ownerId,
            siteId: session.siteId,
            planId: session.planId,
            recordId: session.recordId,
            photoId: session.photoId,
            originalFileName: session.originalFileName,
        },
    };
    try {
        await source.copy(destination, { preconditionOpts: { ifGenerationMatch: 0 }, metadata });
        const [stored] = await destination.getMetadata();
        const generation = String(stored.generation || '');
        if (!/^\d+$/.test(generation)) throw new Error('execution-record-photo-generation-missing');
        return { generation, created: true };
    } catch (error) {
        const code = Number((error as { code?: unknown })?.code);
        if (code !== 409 && code !== 412) throw error;
        const [stored] = await destination.getMetadata();
        const generation = String(stored.generation || '');
        if (storageMetadataString(stored as UnknownRecord, 'uploadSessionId') !== session.id
            || storageMetadataString(stored as UnknownRecord, 'sourceSha256') !== session.sha256
            || !/^\d+$/.test(generation)) {
            throw new functions.https.HttpsError('already-exists', '불변 현장사진 경로가 이미 다른 객체에 사용 중입니다.');
        }
        return { generation, created: false };
    }
};

const finalizePhotoUpload = async (
    data: unknown,
    context: functions.https.CallableContext,
): Promise<UnknownRecord> => {
    const actor = await resolveExecutionRecordActor(context);
    const request = requestRecord(data);
    exactKeys(request, ['sessionId']);
    const sessionId = documentId(request, 'sessionId');
    const sessionRef = executionRecordDb().collection(CONSTRUCTION_PLAN_RECORD_UPLOAD_SESSIONS_COLLECTION).doc(sessionId);
    let session = asSession((await sessionRef.get()).data());
    assertSessionOwner(session, actor);
    if (session.status === 'completed') return sessionResponse(session, true);
    if (session.status !== 'awaiting_upload') {
        throw new functions.https.HttpsError('failed-precondition', '완료할 수 없는 사진 업로드 세션입니다.');
    }
    if (session.expiresAtEpochMs <= Date.now()) {
        await sessionRef.update({ status: 'expired', cleanupAfterEpochMs: Date.now(), expiredAt: new Date().toISOString() });
        throw new functions.https.HttpsError('deadline-exceeded', '사진 업로드 세션이 만료되었습니다.');
    }
    const staged = await validateStagedPhoto(session);
    const copied = await copyStagingPhoto(session, staged.stagingGeneration);
    try {
        const recordRef = executionRecordDb().collection(CONSTRUCTION_PLAN_RECORDS_COLLECTION).doc(session.recordId);
        const planContext = await loadIssuedPlanRecordContext(session.planId);
        const eventRef = executionRecordDb().collection(AUDIT_COLLECTION).doc();
        const response = await executionRecordDb().runTransaction(async (transaction) => {
            const planRef = executionRecordDb().collection(PLANS_COLLECTION).doc(session.planId);
            const exportRef = planRef.collection('exports').doc(planContext.exportId);
            const [sessionSnapshot, recordSnapshot, planSnapshot, exportSnapshot] = await Promise.all([
                transaction.get(sessionRef), transaction.get(recordRef), transaction.get(planRef), transaction.get(exportRef),
            ]);
            session = asSession(sessionSnapshot.data());
            assertSessionOwner(session, actor);
            if (session.status === 'completed') return sessionResponse(session, true);
            if (session.status !== 'awaiting_upload' || session.expiresAtEpochMs <= Date.now()) {
                throw new functions.https.HttpsError('failed-precondition', '사진 업로드 세션 상태가 변경되었습니다.');
            }
            const record = executionRecordData(recordSnapshot);
            const plan = planSnapshot.exists && isUnknownRecord(planSnapshot.data()) ? planSnapshot.data() as UnknownRecord : {};
            const exported = exportSnapshot.exists && isUnknownRecord(exportSnapshot.data()) ? exportSnapshot.data() as UnknownRecord : {};
            assertPlanBindingUnchanged(record, session.planId, plan, exported);
            assertRecordEditAccess(record, plan, actor);
            if (record.version !== session.expectedVersion) {
                throw new functions.https.HttpsError('aborted', '사진 업로드 중 실행기록이 변경되었습니다. 다시 등록하세요.');
            }
            const photos = Array.isArray(record.photos) ? [...record.photos] : [];
            if (photos.some((photo) => isUnknownRecord(photo) && photo.id === session.photoId)) {
                throw new functions.https.HttpsError('already-exists', '같은 사진이 이미 실행기록에 연결되어 있습니다.');
            }
            if (photos.length >= MAX_RECORD_PHOTOS) {
                throw new functions.https.HttpsError('resource-exhausted', `실행기록 사진은 최대 ${MAX_RECORD_PHOTOS}장입니다.`);
            }
            const timestamp = new Date().toISOString();
            const photo: ConstructionPlanRecordPhoto = {
                id: session.photoId,
                storagePath: session.canonicalPath,
                storageGeneration: copied.generation,
                sha256: session.sha256,
                sizeBytes: session.sizeBytes,
                mimeType: session.mimeType,
                caption: session.caption,
                takenAt: session.takenAt,
                zone: session.zone,
                uploadedBy: actor.uid,
                ...(actor.name ? { uploadedByName: actor.name } : {}),
                uploadedAt: timestamp,
            };
            photos.push(photo);
            const next: UnknownRecord = {
                ...record,
                photos,
                version: Number(record.version) + 1,
                updatedBy: actor.uid,
                ...(actor.name ? { updatedByName: actor.name } : {}),
                updatedAt: timestamp,
            };
            next.status = deriveConstructionPlanRecordDraftStatus(next);
            const result: UnknownRecord = { record: next, photo };
            const completed: ExecutionRecordPhotoUploadSession = {
                ...session,
                status: 'completed',
                canonicalGeneration: copied.generation,
                completedAt: timestamp,
                cleanupAfterEpochMs: Date.now(),
                result,
            } as ExecutionRecordPhotoUploadSession;
            transaction.set(recordRef, next);
            transaction.set(sessionRef, completed);
            transaction.create(eventRef, auditRecord(actor, next, 'execution_record_photo_attached', timestamp, {
                photoId: photo.id,
                sha256: photo.sha256,
                storageGeneration: photo.storageGeneration,
            }));
            return sessionResponse(completed);
        });
        await executionRecordBucket().file(session.stagingPath, { generation: staged.stagingGeneration })
            .delete({ ignoreNotFound: true }).catch(() => undefined);
        await sessionRef.update({ cleanupAfterEpochMs: null, stagingDeletedAt: new Date().toISOString() }).catch(() => undefined);
        return response;
    } catch (error) {
        await sessionRef.update({
            status: 'failed',
            canonicalGeneration: copied.generation,
            cleanupAfterEpochMs: Date.now(),
            failedAt: new Date().toISOString(),
        }).catch(() => undefined);
        throw error;
    }
};

const cancelPhotoUpload = async (
    data: unknown,
    context: functions.https.CallableContext,
): Promise<UnknownRecord> => {
    const actor = await resolveExecutionRecordActor(context);
    const request = requestRecord(data);
    exactKeys(request, ['sessionId']);
    const sessionId = documentId(request, 'sessionId');
    const sessionRef = executionRecordDb().collection(CONSTRUCTION_PLAN_RECORD_UPLOAD_SESSIONS_COLLECTION).doc(sessionId);
    const result = await executionRecordDb().runTransaction(async (transaction) => {
        const session = asSession((await transaction.get(sessionRef)).data());
        assertSessionOwner(session, actor);
        if (session.status === 'completed') {
            throw new functions.https.HttpsError('failed-precondition', '기록에 연결된 사진은 업로드 취소할 수 없습니다.');
        }
        if (session.status === 'cancelled' || session.status === 'expired') return sessionResponse(session, true);
        const cancelled: ExecutionRecordPhotoUploadSession = {
            ...session,
            status: 'cancelled',
            cancelledAt: new Date().toISOString(),
            cleanupAfterEpochMs: Date.now(),
        } as ExecutionRecordPhotoUploadSession;
        transaction.set(sessionRef, cancelled);
        return sessionResponse(cancelled);
    });
    const session = asSession((await sessionRef.get()).data());
    await executionRecordBucket().file(session.stagingPath).delete({ ignoreNotFound: true }).catch(() => undefined);
    return result;
};

const canonicalIsBound = async (session: ExecutionRecordPhotoUploadSession): Promise<boolean> => {
    const snapshot = await executionRecordDb().collection(CONSTRUCTION_PLAN_RECORDS_COLLECTION).doc(session.recordId).get();
    if (!snapshot.exists || !isUnknownRecord(snapshot.data())) return false;
    const photos = Array.isArray(snapshot.data()?.photos) ? snapshot.data()?.photos as unknown[] : [];
    return photos.some((photo) => isUnknownRecord(photo)
        && photo.id === session.photoId
        && photo.storagePath === session.canonicalPath
        && photo.storageGeneration === session.canonicalGeneration
        && photo.sha256 === session.sha256);
};

export const cleanupExpiredExecutionRecordPhotoUploads = async (nowEpochMs = Date.now()): Promise<void> => {
    const snapshot = await executionRecordDb().collection(CONSTRUCTION_PLAN_RECORD_UPLOAD_SESSIONS_COLLECTION)
        .where('cleanupAfterEpochMs', '<=', nowEpochMs).limit(CLEANUP_LIMIT).get();
    for (const document of snapshot.docs) {
        let session: ExecutionRecordPhotoUploadSession;
        try { session = asSession(document.data()); } catch (error) {
            functions.logger.error('[executionRecordPhoto] malformed cleanup session', document.id, error);
            await document.ref.update({ cleanupAfterEpochMs: null, cleanupError: 'SESSION_SCHEMA_INVALID' }).catch(() => undefined);
            continue;
        }
        await executionRecordBucket().file(session.stagingPath).delete({ ignoreNotFound: true }).catch((error) => {
            functions.logger.error('[executionRecordPhoto] staging cleanup failed', session.id, error);
        });
        if (session.canonicalGeneration && !(await canonicalIsBound(session))) {
            const canonical = executionRecordBucket().file(session.canonicalPath, { generation: session.canonicalGeneration });
            try {
                const [metadata] = await canonical.getMetadata();
                if (storageMetadataString(metadata as UnknownRecord, 'uploadSessionId') === session.id) {
                    await canonical.delete({ ifGenerationMatch: Number(session.canonicalGeneration), ignoreNotFound: true });
                }
            } catch (error) {
                if (Number((error as { code?: unknown })?.code) !== 404) {
                    functions.logger.error('[executionRecordPhoto] canonical orphan cleanup failed', session.id, error);
                }
            }
        }
        const status: ExecutionRecordPhotoUploadStatus = session.status === 'awaiting_upload' ? 'expired' : session.status;
        await document.ref.update({
            status,
            cleanupAfterEpochMs: null,
            cleanupCompletedAt: new Date(nowEpochMs).toISOString(),
            ...(status === 'expired' ? { expiredAt: new Date(nowEpochMs).toISOString() } : {}),
        }).catch((error) => functions.logger.error('[executionRecordPhoto] session cleanup update failed', session.id, error));
    }
};

export const startConstructionPlanRecordPhotoUploadServer = runner.https.onCall(startPhotoUpload);
export const finalizeConstructionPlanRecordPhotoUploadServer = uploadRunner.https.onCall(finalizePhotoUpload);
export const cancelConstructionPlanRecordPhotoUploadServer = runner.https.onCall(cancelPhotoUpload);

export const cleanupConstructionPlanRecordPhotoUploadsScheduled = functions
    .region('asia-northeast3')
    .runWith({ timeoutSeconds: 540, memory: '512MB', maxInstances: 1 })
    .pubsub.schedule('every 30 minutes')
    .timeZone('Asia/Seoul')
    .onRun(async () => {
        await cleanupExpiredExecutionRecordPhotoUploads();
        return null;
    });
