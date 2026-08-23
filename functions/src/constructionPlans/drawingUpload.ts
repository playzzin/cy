import { createHash } from 'node:crypto';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import {
    classifyConstructionPlanRoleAccess,
    isConstructionPlanParticipant,
    isUnknownRecord,
    readTrimmedString,
    type ConstructionPlanRoleAccess,
    type UnknownRecord,
} from './domain';

const PLANS_COLLECTION = 'constructionPlans';
const SESSIONS_COLLECTION = 'constructionPlanUploadSessions';
const AUDIT_COLLECTION = 'constructionPlanAuditEvents';
const USERS_COLLECTION = 'users';
const SESSION_TTL_MS = 30 * 60 * 1000;
const MAX_DRAWING_BYTES = 50 * 1024 * 1024;
const MAX_CLEANUP_SESSIONS = 500;
const EDITABLE_STATUSES = new Set(['draft', 'changes_requested']);
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const DOCUMENT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;

export type ConstructionPlanDrawingMimeType = 'application/pdf' | 'image/png' | 'image/jpeg';
export type ConstructionPlanDrawingUploadStatus =
    | 'awaiting_upload'
    | 'completed'
    | 'expired'
    | 'failed';

interface DrawingUploadActor {
    uid: string;
    access: ConstructionPlanRoleAccess;
}

interface StartDrawingUploadRequest {
    planId: string;
    sectionId: string;
    drawingId: string;
    originalFileName: string;
    mimeType: ConstructionPlanDrawingMimeType;
    sizeBytes: number;
    sha256: string;
    expectedLockVersion?: number;
    idempotencyKey: string;
}

interface DrawingUploadSession extends StartDrawingUploadRequest {
    schemaVersion: 1;
    id: string;
    ownerId: string;
    siteId: string;
    sourceRevision: number;
    stagingPath: string;
    canonicalPath: string;
    baseSourceBindingHash: string;
    requestFingerprint: string;
    idempotencyKeyHash: string;
    status: ConstructionPlanDrawingUploadStatus;
    createdAt: string;
    createdAtEpochMs: number;
    expiresAt: string;
    expiresAtEpochMs: number;
    cleanupAfterEpochMs: number | null;
    completedAt?: string;
    result?: UnknownRecord;
}

export interface FinalizedDrawingUploadResponse {
    sessionId: string;
    planId: string;
    sectionId: string;
    drawingId: string;
    storagePath: string;
    sourceSha256: string;
    sourceGeneration: string;
    mimeType: ConstructionPlanDrawingMimeType;
    sizeBytes: number;
    sourceRevision: number;
    lockVersion: number;
    updatedAt: string;
    drawing: UnknownRecord;
    section: UnknownRecord;
    drawingApplicability: unknown[];
    idempotent: boolean;
}

const runner = functions
    .runWith({ timeoutSeconds: 60, memory: '512MB', maxInstances: 10 })
    .region('asia-northeast3');

const uploadRunner = functions
    .runWith({ timeoutSeconds: 300, memory: '1GB', maxInstances: 3 })
    .region('asia-northeast3');

const db = () => admin.firestore();
const bucket = () => admin.storage().bucket();

const canonicalJson = (value: unknown): string => {
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
    if (isUnknownRecord(value)) {
        return `{${Object.keys(value).sort().map((key) => (
            `${JSON.stringify(key)}:${canonicalJson(value[key])}`
        )).join(',')}}`;
    }
    return JSON.stringify(value) ?? 'null';
};

const sha256 = (value: string | Buffer): string =>
    createHash('sha256').update(value).digest('hex');

const callableRecord = (value: unknown): UnknownRecord => {
    if (!isUnknownRecord(value)) {
        throw new functions.https.HttpsError('invalid-argument', '도면 업로드 요청이 올바르지 않습니다.');
    }
    return value;
};

const documentId = (record: UnknownRecord, key: string): string => {
    const value = readTrimmedString(record, [key]);
    if (!value || !DOCUMENT_ID_PATTERN.test(value)) {
        throw new functions.https.HttpsError('invalid-argument', `${key} 문서 ID가 올바르지 않습니다.`);
    }
    return value;
};

const requiredString = (record: UnknownRecord, key: string, maxLength: number): string => {
    const value = readTrimmedString(record, [key]);
    if (!value || value.length > maxLength) {
        throw new functions.https.HttpsError('invalid-argument', `${key} 값이 올바르지 않습니다.`);
    }
    return value;
};

const parseMimeType = (value: unknown): ConstructionPlanDrawingMimeType => {
    if (value !== 'application/pdf' && value !== 'image/png' && value !== 'image/jpeg') {
        throw new functions.https.HttpsError('invalid-argument', '지원하지 않는 도면 파일 형식입니다.');
    }
    return value;
};

const parseStartRequest = (value: unknown): StartDrawingUploadRequest => {
    const record = callableRecord(value);
    const sizeBytes = Number(record.sizeBytes);
    const sha = requiredString(record, 'sha256', 64).toLowerCase();
    if (!Number.isInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_DRAWING_BYTES) {
        throw new functions.https.HttpsError('invalid-argument', '도면 원본은 50MB 이하의 파일이어야 합니다.');
    }
    if (!SHA256_PATTERN.test(sha)) {
        throw new functions.https.HttpsError('invalid-argument', 'sha256 값이 올바르지 않습니다.');
    }
    const expectedLockVersion = record.expectedLockVersion === undefined
        ? undefined
        : Number(record.expectedLockVersion);
    if (expectedLockVersion !== undefined
        && (!Number.isInteger(expectedLockVersion) || expectedLockVersion < 0)) {
        throw new functions.https.HttpsError('invalid-argument', 'expectedLockVersion 값이 올바르지 않습니다.');
    }
    return {
        planId: documentId(record, 'planId'),
        sectionId: documentId(record, 'sectionId'),
        drawingId: documentId(record, 'drawingId'),
        originalFileName: requiredString(record, 'originalFileName', 255),
        mimeType: parseMimeType(record.mimeType),
        sizeBytes,
        sha256: sha,
        ...(expectedLockVersion === undefined ? {} : { expectedLockVersion }),
        idempotencyKey: requiredString(record, 'idempotencyKey', 128),
    };
};

const resolveActor = async (
    context: functions.https.CallableContext,
): Promise<DrawingUploadActor> => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    const token = isUnknownRecord(context.auth.token) ? context.auth.token : {};
    const profileSnapshot = await db().collection(USERS_COLLECTION).doc(context.auth.uid).get();
    const profile = profileSnapshot.exists && isUnknownRecord(profileSnapshot.data())
        ? profileSnapshot.data() as UnknownRecord
        : {};
    const keys = ['role', 'position', 'systemRole', 'accountType', 'roles', 'additionalPositions', 'erpRoleGroups'];
    return {
        uid: context.auth.uid,
        access: classifyConstructionPlanRoleAccess(keys.flatMap((key) => [token[key], profile[key]])),
    };
};

const requirePlanAccess = (plan: UnknownRecord, actor: DrawingUploadActor): void => {
    if (!isConstructionPlanParticipant(plan, actor.uid)
        && !actor.access.isAdmin
        && !actor.access.isOffice) {
        throw new functions.https.HttpsError('permission-denied', '이 시공계획서의 도면을 등록할 권한이 없습니다.');
    }
};

const requireEditableLockedPlan = (
    plan: UnknownRecord,
    actor: DrawingUploadActor,
    nowEpochMs: number,
    expectedLockVersion?: number,
): void => {
    requirePlanAccess(plan, actor);
    const status = readTrimmedString(plan, ['status']);
    if (!status || !EDITABLE_STATUSES.has(status)) {
        throw new functions.https.HttpsError('failed-precondition', '작성 중인 계획서에서만 도면을 등록할 수 있습니다.');
    }
    const lock = isUnknownRecord(plan.editLock) ? plan.editLock : {};
    if (readTrimmedString(lock, ['userId']) !== actor.uid
        || !Number.isFinite(lock.expiresAtEpochMs)
        || Number(lock.expiresAtEpochMs) <= nowEpochMs) {
        throw new functions.https.HttpsError('failed-precondition', '유효한 편집 잠금을 먼저 획득해야 합니다.');
    }
    const lockVersion = Number(plan.lockVersion);
    if (!Number.isInteger(lockVersion) || lockVersion < 0) {
        throw new functions.https.HttpsError('data-loss', '계획서 잠금 버전이 손상되었습니다.');
    }
    if (expectedLockVersion !== undefined && expectedLockVersion !== lockVersion) {
        throw new functions.https.HttpsError('aborted', '다른 사용자가 계획서를 변경했습니다. 새로고침 후 다시 시도해주세요.');
    }
};

const sourceBinding = (plan: UnknownRecord, drawingId: string): UnknownRecord | null => {
    const drawings = Array.isArray(plan.drawings) ? plan.drawings : [];
    const drawing = drawings.find((candidate) => (
        isUnknownRecord(candidate) && readTrimmedString(candidate, ['id']) === drawingId
    ));
    if (!isUnknownRecord(drawing)) return null;
    return {
        storagePath: readTrimmedString(drawing, ['storagePath']) || '',
        sourceSha256: (readTrimmedString(drawing, ['sourceSha256']) || '').toLowerCase(),
        sourceGeneration: readTrimmedString(drawing, ['sourceGeneration']) || '',
    };
};

const sourceBindingHash = (plan: UnknownRecord, drawingId: string): string =>
    sha256(canonicalJson(sourceBinding(plan, drawingId)));

export const nextConstructionPlanDrawingSourceRevision = (
    existingStoragePath: string | undefined,
): number => {
    const match = /\/rev-(\d+)\/source\.(?:pdf|png|jpg)$/i.exec(existingStoragePath || '');
    if (!match) return 1;
    const current = Number(match[1]);
    if (!Number.isSafeInteger(current) || current < 1 || current >= 9999) {
        throw new Error('construction-plan-drawing-source-revision-invalid');
    }
    return current + 1;
};

const extensionForMime = (mimeType: ConstructionPlanDrawingMimeType): string => {
    if (mimeType === 'application/pdf') return 'pdf';
    if (mimeType === 'image/png') return 'png';
    return 'jpg';
};

export const buildConstructionPlanDrawingCanonicalPath = (input: {
    siteId: string;
    planId: string;
    drawingId: string;
    sourceRevision: number;
    mimeType: ConstructionPlanDrawingMimeType;
}): string => {
    for (const value of [input.siteId, input.planId, input.drawingId]) {
        if (!DOCUMENT_ID_PATTERN.test(value)) throw new Error('construction-plan-drawing-path-segment-invalid');
    }
    if (!Number.isSafeInteger(input.sourceRevision) || input.sourceRevision < 1 || input.sourceRevision > 9999) {
        throw new Error('construction-plan-drawing-source-revision-invalid');
    }
    return `construction-plans/${input.siteId}/${input.planId}/drawings/${input.drawingId}`
        + `/rev-${input.sourceRevision}/source.${extensionForMime(input.mimeType)}`;
};

export const detectConstructionPlanDrawingMimeType = (
    bytes: Uint8Array,
): ConstructionPlanDrawingMimeType | null => {
    if (bytes.length >= 8
        && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
        && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) {
        return 'image/png';
    }
    if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
        return 'image/jpeg';
    }
    if (bytes.length >= 5
        && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44
        && bytes[3] === 0x46 && bytes[4] === 0x2d) {
        return 'application/pdf';
    }
    return null;
};

export const validateConstructionPlanDrawingSourceBytes = (input: {
    bytes: Buffer;
    expectedMimeType: ConstructionPlanDrawingMimeType;
    expectedSizeBytes: number;
    expectedSha256: string;
}): void => {
    if (input.bytes.byteLength !== input.expectedSizeBytes
        || input.bytes.byteLength <= 0
        || input.bytes.byteLength > MAX_DRAWING_BYTES) {
        throw new Error('construction-plan-drawing-source-size-mismatch');
    }
    if (detectConstructionPlanDrawingMimeType(input.bytes) !== input.expectedMimeType) {
        throw new Error('construction-plan-drawing-source-magic-mismatch');
    }
    if (sha256(input.bytes) !== input.expectedSha256.toLowerCase()) {
        throw new Error('construction-plan-drawing-source-sha256-mismatch');
    }
};

const findSection = (plan: UnknownRecord, sectionId: string): UnknownRecord => {
    const section = (Array.isArray(plan.sections) ? plan.sections : []).find((candidate) => (
        isUnknownRecord(candidate) && readTrimmedString(candidate, ['id']) === sectionId
    ));
    if (!isUnknownRecord(section)) {
        throw new functions.https.HttpsError('failed-precondition', '도면을 연결할 문서 섹션을 찾을 수 없습니다.');
    }
    if (!['drawing-page', 'drawing-register'].includes(readTrimmedString(section, ['kind']) || '')) {
        throw new functions.https.HttpsError('failed-precondition', '선택한 섹션은 도면 등록 섹션이 아닙니다.');
    }
    const linkedDrawingId = isUnknownRecord(section.content)
        ? readTrimmedString(section.content, ['drawingId'])
        : undefined;
    return { section, linkedDrawingId };
};

const existingDrawing = (plan: UnknownRecord, drawingId: string): UnknownRecord | undefined =>
    (Array.isArray(plan.drawings) ? plan.drawings : []).find((candidate): candidate is UnknownRecord => (
        isUnknownRecord(candidate) && readTrimmedString(candidate, ['id']) === drawingId
    ));

const requestFingerprint = (request: StartDrawingUploadRequest): string => sha256(canonicalJson({
    planId: request.planId,
    sectionId: request.sectionId,
    drawingId: request.drawingId,
    originalFileName: request.originalFileName,
    mimeType: request.mimeType,
    sizeBytes: request.sizeBytes,
    sha256: request.sha256,
}));

const sessionResponse = (session: DrawingUploadSession, idempotent = false): UnknownRecord => ({
    sessionId: session.id,
    status: session.status,
    planId: session.planId,
    sectionId: session.sectionId,
    drawingId: session.drawingId,
    stagingPath: session.stagingPath,
    canonicalPath: session.canonicalPath,
    sourceRevision: session.sourceRevision,
    expiresAt: session.expiresAt,
    expiresAtEpochMs: session.expiresAtEpochMs,
    ...(session.status === 'completed' && session.result ? { result: session.result } : {}),
    idempotent,
});

const startDrawingUpload = async (
    data: unknown,
    context: functions.https.CallableContext,
): Promise<UnknownRecord> => {
    const [request, actor] = await Promise.all([parseStartRequest(data), resolveActor(context)]);
    const nowEpochMs = Date.now();
    const fingerprint = requestFingerprint(request);
    const idempotencyKeyHash = sha256(request.idempotencyKey);
    const sessionId = sha256(`construction-plan-drawing-upload:${actor.uid}:${request.idempotencyKey}`).slice(0, 48);
    const sessionRef = db().collection(SESSIONS_COLLECTION).doc(sessionId);
    const planRef = db().collection(PLANS_COLLECTION).doc(request.planId);

    return db().runTransaction(async (transaction) => {
        const [sessionSnapshot, planSnapshot] = await Promise.all([
            transaction.get(sessionRef),
            transaction.get(planRef),
        ]);
        if (!planSnapshot.exists || !isUnknownRecord(planSnapshot.data())) {
            throw new functions.https.HttpsError('not-found', '시공계획서를 찾을 수 없습니다.');
        }
        const plan = planSnapshot.data() as UnknownRecord;
        requireEditableLockedPlan(plan, actor, nowEpochMs, request.expectedLockVersion);
        const located = findSection(plan, request.sectionId);
        const linkedDrawingId = readTrimmedString(located, ['linkedDrawingId']);
        if (linkedDrawingId && linkedDrawingId !== request.drawingId) {
            throw new functions.https.HttpsError('failed-precondition', '섹션에 연결된 도면 ID와 요청이 일치하지 않습니다.');
        }
        if (!linkedDrawingId && request.drawingId !== `drawing-${request.sectionId}`) {
            throw new functions.https.HttpsError('invalid-argument', '신규 도면 ID는 섹션 식별자에서 파생되어야 합니다.');
        }

        if (sessionSnapshot.exists) {
            const stored = sessionSnapshot.data();
            if (!isUnknownRecord(stored)
                || stored.ownerId !== actor.uid
                || stored.requestFingerprint !== fingerprint
                || stored.idempotencyKeyHash !== idempotencyKeyHash) {
                throw new functions.https.HttpsError('already-exists', '같은 멱등 키가 다른 도면 업로드에 사용되었습니다.');
            }
            const session = stored as unknown as DrawingUploadSession;
            if (session.status !== 'completed' && Number(session.expiresAtEpochMs) <= nowEpochMs) {
                throw new functions.https.HttpsError('deadline-exceeded', '도면 업로드 세션이 만료되었습니다.');
            }
            return sessionResponse(session, true);
        }

        const siteId = readTrimmedString(plan, ['siteId']);
        if (!siteId || !DOCUMENT_ID_PATTERN.test(siteId)) {
            throw new functions.https.HttpsError('data-loss', '계획서 현장 식별자가 올바르지 않습니다.');
        }
        const prior = existingDrawing(plan, request.drawingId);
        const sourceRevision = nextConstructionPlanDrawingSourceRevision(
            prior ? readTrimmedString(prior, ['storagePath']) : undefined,
        );
        const stagingPath = `construction-plan-staging/${actor.uid}/${sessionId}/source`;
        const canonicalPath = buildConstructionPlanDrawingCanonicalPath({
            siteId,
            planId: request.planId,
            drawingId: request.drawingId,
            sourceRevision,
            mimeType: request.mimeType,
        });
        const createdAt = new Date(nowEpochMs).toISOString();
        const expiresAtEpochMs = nowEpochMs + SESSION_TTL_MS;
        const session: DrawingUploadSession = {
            schemaVersion: 1,
            id: sessionId,
            ownerId: actor.uid,
            siteId,
            ...request,
            sourceRevision,
            stagingPath,
            canonicalPath,
            baseSourceBindingHash: sourceBindingHash(plan, request.drawingId),
            requestFingerprint: fingerprint,
            idempotencyKeyHash,
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

const asSession = (value: unknown): DrawingUploadSession => {
    if (!isUnknownRecord(value)
        || value.schemaVersion !== 1
        || typeof value.id !== 'string'
        || typeof value.ownerId !== 'string'
        || typeof value.planId !== 'string'
        || typeof value.stagingPath !== 'string'
        || typeof value.canonicalPath !== 'string') {
        throw new functions.https.HttpsError('data-loss', '도면 업로드 세션이 손상되었습니다.');
    }
    return value as unknown as DrawingUploadSession;
};

const storageMetadataString = (
    metadata: { metadata?: Record<string, string> },
    key: string,
): string => typeof metadata.metadata?.[key] === 'string' ? metadata.metadata[key] : '';

const validateStagedSource = async (session: DrawingUploadSession): Promise<{
    bytes: Buffer;
    stagingGeneration: string;
}> => {
    const file = bucket().file(session.stagingPath);
    const [exists] = await file.exists();
    if (!exists) {
        throw new functions.https.HttpsError('failed-precondition', '업로드한 도면 원본을 찾을 수 없습니다.');
    }
    const [metadata, download] = await Promise.all([file.getMetadata(), file.download()]);
    const rawMetadata = metadata[0];
    const bytes = download[0];
    if (rawMetadata.contentType !== session.mimeType
        || Number(rawMetadata.size) !== session.sizeBytes
        || storageMetadataString(rawMetadata, 'uploadSessionId') !== session.id
        || storageMetadataString(rawMetadata, 'sourceSha256').toLowerCase() !== session.sha256) {
        throw new functions.https.HttpsError('data-loss', '업로드 파일의 메타데이터가 세션과 일치하지 않습니다.');
    }
    try {
        validateConstructionPlanDrawingSourceBytes({
            bytes,
            expectedMimeType: session.mimeType,
            expectedSizeBytes: session.sizeBytes,
            expectedSha256: session.sha256,
        });
    } catch (error) {
        const code = error instanceof Error ? error.message : 'construction-plan-drawing-source-invalid';
        throw new functions.https.HttpsError('data-loss', `도면 원본 검증에 실패했습니다: ${code}`);
    }
    const generation = String(rawMetadata.generation || '');
    if (!/^\d+$/.test(generation)) {
        throw new functions.https.HttpsError('data-loss', '업로드 파일의 Storage generation이 없습니다.');
    }
    return { bytes, stagingGeneration: generation };
};

const copyStagingToCanonical = async (
    session: DrawingUploadSession,
    stagingGeneration: string,
): Promise<{ generation: string; createdByThisCall: boolean }> => {
    const source = bucket().file(session.stagingPath, { generation: stagingGeneration });
    const destination = bucket().file(session.canonicalPath);
    try {
        await source.copy(destination, {
            preconditionOpts: { ifGenerationMatch: 0 },
            metadata: {
                contentType: session.mimeType,
                cacheControl: 'private, max-age=31536000, immutable',
                metadata: {
                    immutable: 'true',
                    uploadSessionId: session.id,
                    sourceSha256: session.sha256,
                    uploaderId: session.ownerId,
                    planId: session.planId,
                    siteId: session.siteId,
                    drawingId: session.drawingId,
                    sourceRevision: String(session.sourceRevision),
                    originalFileName: session.originalFileName,
                },
            },
        });
        const [metadata] = await destination.getMetadata();
        const generation = String(metadata.generation || '');
        if (!/^\d+$/.test(generation)) throw new Error('canonical-generation-missing');
        return { generation, createdByThisCall: true };
    } catch (error) {
        const code = Number((error as { code?: unknown })?.code);
        if (code !== 409 && code !== 412) throw error;
        const [metadata] = await destination.getMetadata();
        const sameSession = storageMetadataString(metadata, 'uploadSessionId') === session.id
            && storageMetadataString(metadata, 'sourceSha256').toLowerCase() === session.sha256;
        const generation = String(metadata.generation || '');
        if (!sameSession || !/^\d+$/.test(generation)) {
            throw new functions.https.HttpsError('already-exists', '불변 도면 원본 경로가 이미 사용 중입니다.');
        }
        return { generation, createdByThisCall: false };
    }
};

const stringArray = (value: unknown): string[] => Array.isArray(value)
    ? Array.from(new Set(value.filter((entry): entry is string => typeof entry === 'string' && Boolean(entry.trim()))
        .map((entry) => entry.trim())))
    : [];

const drawingNumber = (section: UnknownRecord): string => {
    const title = readTrimmedString(section, ['title']) || '';
    return title.match(/D-\d{2}/i)?.[0]?.toUpperCase()
        || `P-${(Array.isArray(section.pageNumbers) && Number.isInteger(section.pageNumbers[0]))
            ? section.pageNumbers[0]
            : Number(section.order) + 1}`;
};

export const buildFinalizedConstructionPlanDrawingProjection = (input: {
    plan: UnknownRecord;
    session: DrawingUploadSession;
    actorId: string;
    canonicalGeneration: string;
    now: string;
}): { plan: UnknownRecord; drawing: UnknownRecord; section: UnknownRecord; lockVersion: number } => {
    const { plan, session } = input;
    const located = findSection(plan, session.sectionId);
    const section = located.section as UnknownRecord;
    const prior = existingDrawing(plan, session.drawingId);
    const project = isUnknownRecord(plan.projectSnapshot) ? plan.projectSnapshot : {};
    const applicableZones = prior && stringArray(prior.applicableZones).length
        ? stringArray(prior.applicableZones)
        : stringArray(project.zones);
    const drawing: UnknownRecord = {
        id: session.drawingId,
        planId: session.planId,
        storagePath: session.canonicalPath,
        sourceSha256: session.sha256,
        sourceGeneration: input.canonicalGeneration,
        originalFileName: session.originalFileName,
        mimeType: session.mimeType,
        sizeBytes: session.sizeBytes,
        pageCount: 1,
        drawingNo: prior ? readTrimmedString(prior, ['drawingNo']) || drawingNumber(section) : drawingNumber(section),
        title: prior ? readTrimmedString(prior, ['title']) || readTrimmedString(section, ['title']) || '도면' : readTrimmedString(section, ['title']) || '도면',
        revision: '',
        approvalStatus: 'draft',
        ...(prior && readTrimmedString(prior, ['building']) ? { building: readTrimmedString(prior, ['building']) } : {}),
        ...(prior && readTrimmedString(prior, ['floor']) ? { floor: readTrimmedString(prior, ['floor']) } : {}),
        ...(prior && readTrimmedString(prior, ['zone']) ? { zone: readTrimmedString(prior, ['zone']) } : {}),
        applicableZones,
        ...(prior && readTrimmedString(prior, ['scaleText']) ? { scaleText: readTrimmedString(prior, ['scaleText']) } : {}),
        previewStatus: session.mimeType === 'application/pdf' ? 'pending' : 'ready',
        previewPaths: session.mimeType === 'application/pdf' ? [] : [session.canonicalPath],
        pages: [],
        annotations: [],
        uploadedBy: input.actorId,
        uploadedAt: input.now,
    };
    const sectionContent = isUnknownRecord(section.content) ? section.content : {};
    const nextSection: UnknownRecord = {
        ...section,
        content: {
            ...sectionContent,
            drawingId: session.drawingId,
            drawingPageIndex: 0,
            drawingStudio: {
                schemaVersion: 1,
                background: {
                    fileName: session.originalFileName,
                    mimeType: session.mimeType,
                    sizeBytes: session.sizeBytes,
                    kind: session.mimeType === 'application/pdf' ? 'pdf' : 'image',
                    storagePath: session.canonicalPath,
                },
                objects: [],
            },
        },
        status: 'in_progress',
        updatedAt: input.now,
        updatedBy: input.actorId,
    };
    const sections = (Array.isArray(plan.sections) ? plan.sections : [])
        .map((candidate) => isUnknownRecord(candidate) && candidate.id === session.sectionId ? nextSection : candidate);
    const drawings = [
        ...(Array.isArray(plan.drawings) ? plan.drawings : []).filter((candidate) => (
            !isUnknownRecord(candidate) || candidate.id !== session.drawingId
        )),
        drawing,
    ];
    const slots = Array.from(new Set(Array.from(
        (readTrimmedString(section, ['title']) || '').matchAll(/D-\d{2}/gi),
        (match) => match[0].toUpperCase(),
    ).filter((slot) => ['D-01', 'D-02', 'D-03', 'D-04', 'D-05', 'D-06'].includes(slot))));
    const priorApplicability = Array.isArray(plan.drawingApplicability) ? plan.drawingApplicability : [];
    const drawingApplicability = slots.length
        ? [
            ...priorApplicability.filter((candidate) => (
                !isUnknownRecord(candidate) || !slots.includes(readTrimmedString(candidate, ['drawingSlot']) || '')
            )),
            ...slots.map((drawingSlot) => ({
                drawingSlot,
                decision: 'applicable',
                drawingId: session.drawingId,
                reason: '서버 검증 승인도면 원본 연결',
                reviewedBy: input.actorId,
            })),
        ].sort((left, right) => String((left as UnknownRecord).drawingSlot || '')
            .localeCompare(String((right as UnknownRecord).drawingSlot || '')))
        : priorApplicability;
    const currentLockVersion = Number(plan.lockVersion);
    const lockVersion = currentLockVersion + 1;
    return {
        plan: {
            ...plan,
            sections,
            drawings,
            drawingApplicability,
            updatedAt: input.now,
            updatedBy: input.actorId,
            lockVersion,
        },
        drawing,
        section: nextSection,
        lockVersion,
    };
};

const deleteOwnedCanonicalObject = async (session: DrawingUploadSession): Promise<void> => {
    const file = bucket().file(session.canonicalPath);
    try {
        const [metadata] = await file.getMetadata();
        if (storageMetadataString(metadata, 'uploadSessionId') === session.id) {
            await file.delete({ ifGenerationMatch: Number(metadata.generation) });
        }
    } catch (error) {
        if (Number((error as { code?: unknown })?.code) !== 404) throw error;
    }
};

const finalizeDrawingUpload = async (
    data: unknown,
    context: functions.https.CallableContext,
): Promise<FinalizedDrawingUploadResponse> => {
    const record = callableRecord(data);
    const sessionId = documentId(record, 'sessionId');
    const actor = await resolveActor(context);
    const sessionRef = db().collection(SESSIONS_COLLECTION).doc(sessionId);
    const initialSnapshot = await sessionRef.get();
    if (!initialSnapshot.exists) {
        throw new functions.https.HttpsError('not-found', '도면 업로드 세션을 찾을 수 없습니다.');
    }
    const session = asSession(initialSnapshot.data());
    if (session.ownerId !== actor.uid) {
        throw new functions.https.HttpsError('permission-denied', '다른 사용자의 도면 업로드 세션입니다.');
    }
    if (session.status === 'completed' && session.result) {
        return { ...(session.result as unknown as FinalizedDrawingUploadResponse), idempotent: true };
    }
    if (session.status !== 'awaiting_upload') {
        throw new functions.https.HttpsError('failed-precondition', '완료할 수 없는 도면 업로드 세션입니다.');
    }
    if (session.expiresAtEpochMs <= Date.now()) {
        throw new functions.https.HttpsError('deadline-exceeded', '도면 업로드 세션이 만료되었습니다.');
    }

    const planSnapshot = await db().collection(PLANS_COLLECTION).doc(session.planId).get();
    if (!planSnapshot.exists || !isUnknownRecord(planSnapshot.data())) {
        throw new functions.https.HttpsError('not-found', '시공계획서를 찾을 수 없습니다.');
    }
    requireEditableLockedPlan(planSnapshot.data() as UnknownRecord, actor, Date.now());
    const staged = await validateStagedSource(session);
    let copied: { generation: string; createdByThisCall: boolean };
    try {
        copied = await copyStagingToCanonical(session, staged.stagingGeneration);
    } catch (error) {
        if (error instanceof functions.https.HttpsError) throw error;
        throw new functions.https.HttpsError('internal', '검증된 도면 원본을 불변 경로에 저장하지 못했습니다.');
    }

    try {
        const response = await db().runTransaction(async (transaction): Promise<FinalizedDrawingUploadResponse> => {
            const [latestSessionSnapshot, latestPlanSnapshot] = await Promise.all([
                transaction.get(sessionRef),
                transaction.get(db().collection(PLANS_COLLECTION).doc(session.planId)),
            ]);
            const latestSession = asSession(latestSessionSnapshot.data());
            if (latestSession.status === 'completed' && latestSession.result) {
                return { ...(latestSession.result as unknown as FinalizedDrawingUploadResponse), idempotent: true };
            }
            if (latestSession.ownerId !== actor.uid
                || latestSession.requestFingerprint !== session.requestFingerprint
                || latestSession.status !== 'awaiting_upload') {
                throw new functions.https.HttpsError('aborted', '도면 업로드 세션 상태가 변경되었습니다.');
            }
            if (latestSession.expiresAtEpochMs <= Date.now()) {
                throw new functions.https.HttpsError('deadline-exceeded', '도면 업로드 세션이 만료되었습니다.');
            }
            if (!latestPlanSnapshot.exists || !isUnknownRecord(latestPlanSnapshot.data())) {
                throw new functions.https.HttpsError('not-found', '시공계획서를 찾을 수 없습니다.');
            }
            const latestPlan = latestPlanSnapshot.data() as UnknownRecord;
            requireEditableLockedPlan(latestPlan, actor, Date.now());
            if (sourceBindingHash(latestPlan, session.drawingId) !== session.baseSourceBindingHash) {
                throw new functions.https.HttpsError('aborted', '도면 원본이 이미 변경되었습니다. 새 업로드 세션을 시작해주세요.');
            }
            const now = new Date().toISOString();
            const projection = buildFinalizedConstructionPlanDrawingProjection({
                plan: latestPlan,
                session,
                actorId: actor.uid,
                canonicalGeneration: copied.generation,
                now,
            });
            const result: FinalizedDrawingUploadResponse = {
                sessionId,
                planId: session.planId,
                sectionId: session.sectionId,
                drawingId: session.drawingId,
                storagePath: session.canonicalPath,
                sourceSha256: session.sha256,
                sourceGeneration: copied.generation,
                mimeType: session.mimeType,
                sizeBytes: session.sizeBytes,
                sourceRevision: session.sourceRevision,
                lockVersion: projection.lockVersion,
                updatedAt: now,
                drawing: projection.drawing,
                section: projection.section,
                drawingApplicability: Array.isArray(projection.plan.drawingApplicability)
                    ? projection.plan.drawingApplicability
                    : [],
                idempotent: false,
            };
            const planRef = db().collection(PLANS_COLLECTION).doc(session.planId);
            const completedSession: DrawingUploadSession = {
                ...latestSession,
                status: 'completed',
                completedAt: now,
                cleanupAfterEpochMs: Date.now(),
                result: { ...result },
            };
            transaction.set(planRef, projection.plan);
            transaction.set(sessionRef, completedSession);
            transaction.create(db().collection(AUDIT_COLLECTION).doc(`drawing-upload-${sessionId}`), {
                schemaVersion: 1,
                type: 'drawing_source_finalized',
                planId: session.planId,
                siteId: session.siteId,
                sectionId: session.sectionId,
                drawingId: session.drawingId,
                uploadSessionId: sessionId,
                actorId: actor.uid,
                at: now,
                storagePath: session.canonicalPath,
                storageGeneration: copied.generation,
                sourceSha256: session.sha256,
                sourceRevision: session.sourceRevision,
                mimeType: session.mimeType,
                sizeBytes: session.sizeBytes,
            });
            return result;
        });
        const stagingDeleted = await bucket().file(session.stagingPath, { generation: staged.stagingGeneration })
            .delete({ ignoreNotFound: true })
            .then(() => true)
            .catch(() => false);
        if (stagingDeleted) {
            await sessionRef.set({
                cleanupAfterEpochMs: null,
                stagingDeletedAt: new Date().toISOString(),
            }, { merge: true }).catch(() => undefined);
        }
        return response;
    } catch (error) {
        if (copied.createdByThisCall) {
            // A transaction commit can be ambiguous if the Firestore response
            // is lost. Never remove an immutable source until a fresh read
            // proves that no plan is bound to it.
            let canonicalIsBound = true;
            try {
                canonicalIsBound = await hasCanonicalPlanBinding(session);
            } catch (bindingError) {
                console.error(
                    '[constructionPlanDrawingUpload] canonical binding verification failed',
                    session.id,
                    bindingError,
                );
            }
            if (!canonicalIsBound) await deleteOwnedCanonicalObject(session).catch(() => undefined);
        }
        throw error;
    }
};

const hasCanonicalPlanBinding = async (session: DrawingUploadSession): Promise<boolean> => {
    const snapshot = await db().collection(PLANS_COLLECTION).doc(session.planId).get();
    if (!snapshot.exists || !isUnknownRecord(snapshot.data())) return false;
    const drawing = existingDrawing(snapshot.data() as UnknownRecord, session.drawingId);
    return Boolean(drawing
        && readTrimmedString(drawing, ['storagePath']) === session.canonicalPath
        && (readTrimmedString(drawing, ['sourceSha256']) || '').toLowerCase() === session.sha256);
};

export const cleanupExpiredConstructionPlanDrawingUploads = async (
    nowEpochMs = Date.now(),
): Promise<{ examined: number; expired: number; deletedStaging: number; deletedCanonicalOrphans: number }> => {
    const snapshots = await db().collection(SESSIONS_COLLECTION)
        .where('cleanupAfterEpochMs', '<=', nowEpochMs)
        .limit(MAX_CLEANUP_SESSIONS)
        .get();
    let expired = 0;
    let deletedStaging = 0;
    let deletedCanonicalOrphans = 0;
    for (const document of snapshots.docs) {
        let session: DrawingUploadSession;
        try {
            session = asSession(document.data());
        } catch (error) {
            console.error('[constructionPlanDrawingUpload] malformed cleanup session', document.id, error);
            await document.ref.set({
                status: 'failed',
                cleanupAfterEpochMs: null,
                cleanupErrorCode: 'SESSION_SCHEMA_INVALID',
                cleanupFailedAt: new Date(nowEpochMs).toISOString(),
            }, { merge: true });
            continue;
        }
        let cleanupSucceeded = true;
        try {
            await bucket().file(session.stagingPath).delete({ ignoreNotFound: true });
            deletedStaging += 1;
        } catch (error) {
            cleanupSucceeded = false;
            console.error('[constructionPlanDrawingUpload] staging cleanup failed', session.id, error);
        }
        if (session.status !== 'completed') {
            expired += 1;
            try {
                if (!(await hasCanonicalPlanBinding(session))) {
                    await deleteOwnedCanonicalObject(session);
                    deletedCanonicalOrphans += 1;
                }
            } catch (error) {
                cleanupSucceeded = false;
                console.error('[constructionPlanDrawingUpload] canonical orphan cleanup failed', session.id, error);
            }
            await document.ref.set({
                status: 'expired',
                expiredAt: new Date(nowEpochMs).toISOString(),
                ...(cleanupSucceeded ? { cleanupAfterEpochMs: null, cleanupCompletedAt: new Date(nowEpochMs).toISOString() } : {}),
            }, { merge: true });
        } else if (cleanupSucceeded) {
            await document.ref.set({
                cleanupAfterEpochMs: null,
                cleanupCompletedAt: new Date(nowEpochMs).toISOString(),
            }, { merge: true });
        }
    }
    return { examined: snapshots.size, expired, deletedStaging, deletedCanonicalOrphans };
};

export const startConstructionPlanDrawingUploadServer = runner.https.onCall(startDrawingUpload);

export const finalizeConstructionPlanDrawingUploadServer = uploadRunner.https.onCall(finalizeDrawingUpload);

export const cleanupConstructionPlanDrawingUploadsScheduled = functions
    .runWith({ timeoutSeconds: 300, memory: '512MB', maxInstances: 1 })
    .region('asia-northeast3')
    .pubsub.schedule('every 24 hours')
    .timeZone('Asia/Seoul')
    .onRun(async () => {
        await cleanupExpiredConstructionPlanDrawingUploads();
    });
