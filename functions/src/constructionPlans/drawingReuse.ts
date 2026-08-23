import { createHash } from 'node:crypto';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import {
    buildConstructionPlanDrawingCanonicalPath,
    validateConstructionPlanDrawingSourceBytes,
} from './drawingUpload';
import {
    applyConstructionPlanImportedDrawingProjection,
    buildConstructionPlanDrawingReuseProjection,
    projectConstructionPlanDrawingSourceBinding,
    projectConstructionPlanDrawingSourceBindings,
    type ConstructionPlanDrawingCopyBinding,
    type ConstructionPlanDrawingReuseProjection,
    type ConstructionPlanDrawingSourceBinding,
} from './drawingReuseCore';
import {
    canonicalStringify,
    classifyConstructionPlanRoleAccess,
    isConstructionPlanParticipant,
    isUnknownRecord,
    readTrimmedString,
    sha256Hex,
    type ConstructionPlanRoleAccess,
    type UnknownRecord,
} from './domain';
import { callableFirestoreValue as normalizeCallableFirestoreValue } from './callableFirestoreValue';

const PLANS_COLLECTION = 'constructionPlans';
const JOBS_COLLECTION = 'constructionPlanDrawingReuseJobs';
const AUDIT_COLLECTION = 'constructionPlanAuditEvents';
const USERS_COLLECTION = 'users';
const MAX_PLAN_QUERY_RESULTS = 200;
const MAX_LIBRARY_ITEMS = 1_000;
const MAX_LIBRARY_PAGE_SIZE = 50;
const READY_JOB_TTL_MS = 24 * 60 * 60 * 1_000;
const COMPLETED_JOB_TTL_MS = 30 * 24 * 60 * 60 * 1_000;
const MAX_CLEANUP_JOBS = 200;
const DOCUMENT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const EDITABLE_STATUSES = new Set(['draft', 'changes_requested']);
const REUSABLE_SOURCE_STATUSES = new Set([
    'draft', 'changes_requested', 'in_review', 'review_completed',
    'approved_pending_issue', 'issued', 'superseded',
]);

type DrawingReuseOperation = 'revision' | 'clone' | 'library_import';
type DrawingReuseJobStatus = 'queued' | 'copying' | 'ready' | 'completed' | 'failed';

interface DrawingReuseActor {
    uid: string;
    access: ConstructionPlanRoleAccess;
}

interface DrawingReuseJob {
    schemaVersion: 1;
    id: string;
    requestId: string;
    operation: DrawingReuseOperation;
    ownerId: string;
    requestFingerprint: string;
    sourcePlanFingerprint: string;
    sourcePlanId: string;
    targetPlanId: string;
    siteId: string;
    status: DrawingReuseJobStatus;
    attempts: number;
    createdAt: string;
    updatedAt: string;
    cleanupAfterEpochMs: number;
    bindings?: DrawingReuseJobBinding[];
    result?: UnknownRecord;
    errorCode?: string;
}

interface DrawingReuseJobBinding {
    sourcePlanId: string;
    sourceDrawingId: string;
    sourceStoragePath: string;
    sourceGeneration: string;
    sourceSha256: string;
    targetPlanId: string;
    targetDrawingId: string;
    targetStoragePath: string;
    targetGeneration: string;
    mimeType: string;
    sizeBytes: number;
}

export interface ConstructionPlanDrawingReuseCleanupResult {
    claimed: boolean;
    deletedObjects: number;
}

interface DrawingStorageMetadata {
    generation?: string | number;
    contentType?: string;
    size?: string | number;
    metadata?: Record<string, string>;
}

export interface PreparedConstructionPlanDrawingReuse {
    jobId: string;
    targetPlanId: string;
    sourcePlanFingerprint: string;
    bindings: ConstructionPlanDrawingCopyBinding[];
    projection: ConstructionPlanDrawingReuseProjection;
}

export interface ConstructionPlanDrawingLibraryItem {
    sourcePlanId: string;
    sourcePlanTitle: string;
    sourceDocumentNo: string;
    sourcePlanRevision: number;
    sourcePlanStatus: string;
    drawingId: string;
    drawingNo: string;
    title: string;
    originalFileName: string;
    mimeType: string;
    sizeBytes: number;
    sourceSha256: string;
    approvalStatus: string;
    reusable: boolean;
    reuseBlockReason?: string;
}

const runner = functions
    .runWith({ timeoutSeconds: 300, memory: '1GB', maxInstances: 5 })
    .region('asia-northeast3');

const listRunner = functions
    .runWith({ timeoutSeconds: 60, memory: '512MB', maxInstances: 10 })
    .region('asia-northeast3');

const db = () => admin.firestore();
const bucket = () => admin.storage().bucket();

function fail(
    code: functions.https.FunctionsErrorCode,
    message: string,
): never {
    throw new functions.https.HttpsError(code, message);
}

const normalizeFirestoreValue = normalizeCallableFirestoreValue;

const planDocument = (snapshot: admin.firestore.DocumentSnapshot): UnknownRecord => {
    if (!snapshot.exists || !isUnknownRecord(snapshot.data())) {
        fail('not-found', '시공계획서를 찾을 수 없습니다.');
    }
    const normalized = normalizeFirestoreValue(snapshot.data());
    if (!isUnknownRecord(normalized)) fail('data-loss', '시공계획서 데이터가 손상되었습니다.');
    return { ...normalized, id: snapshot.id };
};

const callableRecord = (value: unknown): UnknownRecord => {
    if (!isUnknownRecord(value)) fail('invalid-argument', '도면 재사용 요청이 올바르지 않습니다.');
    return value;
};

const assertExactKeys = (record: UnknownRecord, allowed: readonly string[]): void => {
    const keys = new Set(allowed);
    if (Object.keys(record).some((key) => !keys.has(key))) {
        fail('invalid-argument', '도면 재사용 요청에 허용되지 않은 필드가 있습니다.');
    }
};

const documentId = (record: UnknownRecord, key: string): string => {
    const value = readTrimmedString(record, [key]);
    if (!value || !DOCUMENT_ID_PATTERN.test(value)) {
        fail('invalid-argument', `${key} 문서 ID가 올바르지 않습니다.`);
    }
    return value;
};

const requiredString = (record: UnknownRecord, key: string, maxLength: number): string => {
    const value = readTrimmedString(record, [key]);
    if (!value || value.length > maxLength) fail('invalid-argument', `${key} 값이 올바르지 않습니다.`);
    return value;
};

const parseExpectedLockVersion = (record: UnknownRecord): number => {
    const value = Number(record.expectedLockVersion);
    if (!Number.isSafeInteger(value) || value < 0) {
        fail('invalid-argument', 'expectedLockVersion 값이 올바르지 않습니다.');
    }
    return value;
};

const resolveActor = async (
    context: functions.https.CallableContext,
): Promise<DrawingReuseActor> => {
    if (!context.auth) fail('unauthenticated', '로그인이 필요합니다.');
    const token = isUnknownRecord(context.auth.token) ? context.auth.token : {};
    const profileSnapshot = await db().collection(USERS_COLLECTION).doc(context.auth.uid).get();
    const profile = profileSnapshot.exists && isUnknownRecord(profileSnapshot.data())
        ? profileSnapshot.data() as UnknownRecord
        : {};
    const fields = [
        'role', 'position', 'systemRole', 'accountType', 'roles',
        'additionalPositions', 'erpRoleGroups',
    ];
    return {
        uid: context.auth.uid,
        access: classifyConstructionPlanRoleAccess(fields.flatMap((key) => [token[key], profile[key]])),
    };
};

const requirePlanAccess = (plan: UnknownRecord, actor: DrawingReuseActor): void => {
    if (!isConstructionPlanParticipant(plan, actor.uid)
        && !actor.access.isAdmin
        && !actor.access.isOffice) {
        fail('permission-denied', '이 시공계획서의 도면을 조회하거나 재사용할 권한이 없습니다.');
    }
};

const planTemplateIdentity = (plan: UnknownRecord): string => {
    const tradeType = readTrimmedString(plan, ['tradeType']);
    const templateId = readTrimmedString(plan, ['templateId']);
    const templateVersion = readTrimmedString(plan, ['templateVersion']);
    const binding = isUnknownRecord(plan.templateBinding) ? plan.templateBinding : undefined;
    if (!tradeType || !templateId || !templateVersion || !binding
        || binding.tradeType !== tradeType
        || binding.templateId !== templateId
        || binding.templateVersion !== templateVersion
        || !readTrimmedString(binding, ['templateRecordId'])
        || !readTrimmedString(binding, ['manifestHash'])
        || !readTrimmedString(binding, ['templateBundleHash'])) {
        fail('failed-precondition', '원본 계획서의 게시 템플릿 바인딩이 없어 도면을 안전하게 재사용할 수 없습니다.');
    }
    return `${tradeType}:${templateId}:${templateVersion}`;
};

const requireReusableSourcePlan = (plan: UnknownRecord): void => {
    const status = readTrimmedString(plan, ['status']);
    if (!status || !REUSABLE_SOURCE_STATUSES.has(status)) {
        fail('failed-precondition', '이 상태의 계획서 도면은 재사용할 수 없습니다.');
    }
    planTemplateIdentity(plan);
    if (!readTrimmedString(plan, ['seriesId'])) {
        fail('failed-precondition', '원본 계획서의 문서 계보가 없어 도면을 안전하게 재사용할 수 없습니다.');
    }
};

const requireEditableTargetPlan = (
    plan: UnknownRecord,
    actor: DrawingReuseActor,
    expectedLockVersion: number,
    nowEpochMs: number,
): void => {
    requirePlanAccess(plan, actor);
    if (!EDITABLE_STATUSES.has(readTrimmedString(plan, ['status']) || '')) {
        fail('failed-precondition', '작성 중 또는 수정요청 상태의 계획서에만 도면을 가져올 수 있습니다.');
    }
    const lockVersion = Number(plan.lockVersion);
    if (!Number.isSafeInteger(lockVersion) || lockVersion < 0) {
        fail('data-loss', '계획서 잠금 버전이 손상되었습니다.');
    }
    if (lockVersion !== expectedLockVersion) {
        fail('aborted', '다른 사용자가 계획서를 변경했습니다. 새로고침 후 다시 시도해주세요.');
    }
    const lock = isUnknownRecord(plan.editLock) ? plan.editLock : {};
    if (readTrimmedString(lock, ['userId']) !== actor.uid
        || !Number.isFinite(lock.expiresAtEpochMs)
        || Number(lock.expiresAtEpochMs) <= nowEpochMs) {
        fail('failed-precondition', '유효한 편집 잠금을 먼저 획득해야 합니다.');
    }
    planTemplateIdentity(plan);
};

const canonicalPlanFingerprint = (plan: UnknownRecord): string => {
    const { editLock: _editLock, ...stable } = plan;
    return sha256Hex(canonicalStringify(stable));
};

export const buildConstructionPlanDrawingReuseIdentity = (input: {
    actorId: string;
    operation: DrawingReuseOperation;
    idempotencyKey: string;
}): { jobId: string; targetPlanId: string; requestId: string } => {
    if (!input.actorId || !input.idempotencyKey || input.idempotencyKey.length > 128) {
        throw new Error('construction-plan-drawing-reuse-identity-invalid');
    }
    const digest = sha256Hex(canonicalStringify({
        schemaVersion: 1,
        actorId: input.actorId,
        operation: input.operation,
        idempotencyKey: input.idempotencyKey,
    }));
    return {
        jobId: `cpdrj-${digest.slice(0, 48)}`,
        targetPlanId: `cpdr-${digest.slice(0, 48)}`,
        requestId: `cpdrq-${digest.slice(0, 48)}`,
    };
};

export const constructionPlanDrawingReuseJobRef = (
    jobId: string,
): admin.firestore.DocumentReference => db().collection(JOBS_COLLECTION).doc(jobId);

const storageMetadataString = (
    metadata: { metadata?: Record<string, string> },
    key: string,
): string => typeof metadata.metadata?.[key] === 'string' ? metadata.metadata[key] : '';

const sourceMetadataMatches = (
    metadata: DrawingStorageMetadata,
    binding: ConstructionPlanDrawingSourceBinding,
): boolean => Boolean(metadata)
    && storageMetadataString(metadata, 'immutable') === 'true'
    && storageMetadataString(metadata, 'planId') === binding.sourcePlanId
    && storageMetadataString(metadata, 'siteId') === binding.siteId
    && storageMetadataString(metadata, 'drawingId') === binding.drawingId
    && storageMetadataString(metadata, 'sourceRevision') === String(binding.sourceRevision)
    && storageMetadataString(metadata, 'sourceSha256').toLowerCase()
        === binding.sourceSha256;

const verifySourceObject = async (binding: ConstructionPlanDrawingSourceBinding): Promise<void> => {
    const file = bucket().file(binding.storagePath, { generation: binding.sourceGeneration });
    let metadata: DrawingStorageMetadata;
    let bytes: Buffer;
    try {
        const results = await Promise.all([file.getMetadata(), file.download()]);
        metadata = results[0][0];
        bytes = results[1][0];
    } catch (error) {
        if (Number((error as { code?: unknown })?.code) === 404) {
            fail('failed-precondition', '원본 도면 세대가 Storage에 존재하지 않습니다. 원본을 다시 등록해야 합니다.');
        }
        throw error;
    }
    if (String(metadata.generation || '') !== binding.sourceGeneration
        || metadata.contentType !== binding.mimeType
        || Number(metadata.size) !== binding.sizeBytes
        || !sourceMetadataMatches(metadata, binding)) {
        fail('data-loss', '원본 도면의 경로·세대·메타데이터 바인딩이 일치하지 않습니다.');
    }
    try {
        validateConstructionPlanDrawingSourceBytes({
            bytes,
            expectedMimeType: binding.mimeType,
            expectedSizeBytes: binding.sizeBytes,
            expectedSha256: binding.sourceSha256,
        });
    } catch (error) {
        const code = error instanceof Error ? error.message : 'source-invalid';
        fail('data-loss', `원본 도면 바이트 검증에 실패했습니다: ${code}`);
    }
};

const targetObjectMetadata = (input: {
    binding: ConstructionPlanDrawingSourceBinding;
    targetPlanId: string;
    targetDrawingId: string;
    jobId: string;
    requestFingerprint: string;
    actorId: string;
}): Record<string, string> => ({
    immutable: 'true',
    reuseJobId: input.jobId,
    requestId: input.jobId,
    requestFingerprint: input.requestFingerprint,
    sourcePlanId: input.binding.sourcePlanId,
    sourceDrawingId: input.binding.drawingId,
    sourceStoragePathSha256: sha256Hex(input.binding.storagePath),
    sourceGeneration: input.binding.sourceGeneration,
    sourceSha256: input.binding.sourceSha256,
    planId: input.targetPlanId,
    siteId: input.binding.siteId,
    drawingId: input.targetDrawingId,
    sourceRevision: '1',
    copiedBy: input.actorId,
    originalFileName: input.binding.originalFileName,
});

const targetMetadataMatches = (
    metadata: DrawingStorageMetadata,
    expected: Record<string, string>,
): boolean => Object.entries(expected).every(([key, value]) => (
    storageMetadataString(metadata, key) === value
));

const verifyTargetObject = async (input: {
    copyBinding: ConstructionPlanDrawingCopyBinding;
    expectedMetadata: Record<string, string>;
}): Promise<void> => {
    const file = bucket().file(input.copyBinding.targetStoragePath, {
        generation: input.copyBinding.targetGeneration,
    });
    const [[metadata], [bytes]] = await Promise.all([file.getMetadata(), file.download()]);
    if (String(metadata.generation || '') !== input.copyBinding.targetGeneration
        || metadata.contentType !== input.copyBinding.mimeType
        || Number(metadata.size) !== input.copyBinding.sizeBytes
        || !targetMetadataMatches(metadata, input.expectedMetadata)) {
        fail('data-loss', '복사한 도면의 대상 경로·세대·계보 메타데이터가 일치하지 않습니다.');
    }
    try {
        validateConstructionPlanDrawingSourceBytes({
            bytes,
            expectedMimeType: input.copyBinding.mimeType,
            expectedSizeBytes: input.copyBinding.sizeBytes,
            expectedSha256: input.copyBinding.sourceSha256,
        });
    } catch (error) {
        const code = error instanceof Error ? error.message : 'target-invalid';
        fail('data-loss', `복사한 도면 바이트 검증에 실패했습니다: ${code}`);
    }
};

const copySourceObjectCreateOnly = async (input: {
    binding: ConstructionPlanDrawingSourceBinding;
    targetPlanId: string;
    targetDrawingId: string;
    jobId: string;
    requestFingerprint: string;
    actorId: string;
    onTargetCreated?: (binding: ConstructionPlanDrawingCopyBinding) => Promise<void>;
}): Promise<ConstructionPlanDrawingCopyBinding> => {
    await verifySourceObject(input.binding);
    const targetStoragePath = buildConstructionPlanDrawingCanonicalPath({
        siteId: input.binding.siteId,
        planId: input.targetPlanId,
        drawingId: input.targetDrawingId,
        sourceRevision: 1,
        mimeType: input.binding.mimeType,
    });
    const source = bucket().file(input.binding.storagePath, {
        generation: input.binding.sourceGeneration,
    });
    const destination = bucket().file(targetStoragePath);
    const expectedMetadata = targetObjectMetadata(input);
    let targetGeneration: string;
    try {
        const [, copiedMetadata] = await source.copy(destination, {
            preconditionOpts: { ifGenerationMatch: 0 },
            metadata: {
                contentType: input.binding.mimeType,
                cacheControl: 'private, max-age=31536000, immutable',
                metadata: expectedMetadata,
            },
        });
        // The create response is the strongest evidence of the exact object
        // generation and avoids a second request between creation and durable
        // job binding persistence.
        targetGeneration = String(copiedMetadata.generation || '');
    } catch (error) {
        const code = Number((error as { code?: unknown })?.code);
        let metadata: DrawingStorageMetadata;
        try {
            [metadata] = await destination.getMetadata();
        } catch {
            // No exact generation can be claimed safely. A retry uses the
            // deterministic path and request metadata to recover a copy whose
            // response may have been lost.
            throw error;
        }
        if (!targetMetadataMatches(metadata, expectedMetadata)) {
            if (code === 409 || code === 412) {
                fail('already-exists', '대상 불변 도면 경로가 다른 요청에서 이미 사용되었습니다.');
            }
            throw error;
        }
        // This also recovers a create whose successful response was lost: an
        // object is adopted only when every private request metadata field
        // matches this deterministic job.
        targetGeneration = String(metadata.generation || '');
    }
    if (!/^[1-9][0-9]*$/.test(targetGeneration)) {
        fail('data-loss', '복사한 도면의 Storage generation이 없습니다.');
    }
    const copyBinding: ConstructionPlanDrawingCopyBinding = {
        ...input.binding,
        targetPlanId: input.targetPlanId,
        targetDrawingId: input.targetDrawingId,
        targetStoragePath,
        targetGeneration,
    };
    // Persist the exact target generation before the byte-level verification.
    // If verification or a later source copy fails, the job still owns a
    // complete cleanup binding instead of leaving an untracked canonical file.
    await input.onTargetCreated?.(copyBinding);
    await verifyTargetObject({ copyBinding, expectedMetadata });
    return copyBinding;
};

const asJob = (snapshot: admin.firestore.DocumentSnapshot): DrawingReuseJob => {
    if (!snapshot.exists || !isUnknownRecord(snapshot.data())) {
        fail('not-found', '도면 재사용 작업을 찾을 수 없습니다.');
    }
    const value = normalizeFirestoreValue(snapshot.data());
    if (!isUnknownRecord(value)
        || value.schemaVersion !== 1
        || typeof value.id !== 'string'
        || typeof value.ownerId !== 'string'
        || typeof value.requestFingerprint !== 'string'
        || typeof value.targetPlanId !== 'string') {
        fail('data-loss', '도면 재사용 작업 데이터가 손상되었습니다.');
    }
    return value as unknown as DrawingReuseJob;
};

const jobBindingRecord = (binding: ConstructionPlanDrawingCopyBinding): DrawingReuseJobBinding => ({
    sourcePlanId: binding.sourcePlanId,
    sourceDrawingId: binding.drawingId,
    sourceStoragePath: binding.storagePath,
    sourceGeneration: binding.sourceGeneration,
    sourceSha256: binding.sourceSha256,
    targetPlanId: binding.targetPlanId,
    targetDrawingId: binding.targetDrawingId,
    targetStoragePath: binding.targetStoragePath,
    targetGeneration: binding.targetGeneration,
    mimeType: binding.mimeType,
    sizeBytes: binding.sizeBytes,
});

const sameJobBinding = (
    left: DrawingReuseJobBinding,
    right: DrawingReuseJobBinding,
): boolean => left.sourcePlanId === right.sourcePlanId
    && left.sourceDrawingId === right.sourceDrawingId
    && left.sourceStoragePath === right.sourceStoragePath
    && left.sourceGeneration === right.sourceGeneration
    && left.sourceSha256 === right.sourceSha256
    && left.targetPlanId === right.targetPlanId
    && left.targetDrawingId === right.targetDrawingId
    && left.targetStoragePath === right.targetStoragePath
    && left.targetGeneration === right.targetGeneration
    && left.mimeType === right.mimeType
    && left.sizeBytes === right.sizeBytes;

const persistPreparedJobBindings = async (input: {
    jobId: string;
    actorId: string;
    requestFingerprint: string;
    sourcePlanFingerprint: string;
    bindings: readonly ConstructionPlanDrawingCopyBinding[];
    timestamp: string;
}): Promise<void> => {
    const ref = constructionPlanDrawingReuseJobRef(input.jobId);
    const projected = input.bindings.map(jobBindingRecord);
    await db().runTransaction(async (transaction) => {
        const snapshot = await transaction.get(ref);
        const job = asJob(snapshot);
        if (job.ownerId !== input.actorId
            || job.requestFingerprint !== input.requestFingerprint
            || job.sourcePlanFingerprint !== input.sourcePlanFingerprint) {
            fail('already-exists', '도면 재사용 작업 소유권이 일치하지 않습니다.');
        }
        if (job.status === 'completed') return;
        if (job.status === 'failed') {
            fail('aborted', '도면 재사용 작업이 안전 정리 단계로 전환되었습니다. 같은 요청으로 다시 시도해주세요.');
        }
        const existing = Array.isArray(job.bindings) ? job.bindings : [];
        const sharedLength = Math.min(existing.length, projected.length);
        if (Array.from({ length: sharedLength }, (_, index) => index).some((index) => (
            !sameJobBinding(existing[index], projected[index])
        ))) {
            fail('data-loss', '도면 재사용 작업의 복사 바인딩이 변경되었습니다.');
        }
        // A concurrent identical invocation may already have persisted a
        // longer deterministic prefix. Never truncate that cleanup manifest.
        if (existing.length >= projected.length) return;
        transaction.update(ref, {
            status: 'copying',
            bindings: projected,
            updatedAt: input.timestamp,
            cleanupAfterEpochMs: Date.parse(input.timestamp) + READY_JOB_TTL_MS,
        });
    });
};

const markDrawingReuseJobCopying = async (input: {
    jobId: string;
    actorId: string;
    requestFingerprint: string;
    sourcePlanFingerprint: string;
    timestamp: string;
}): Promise<void> => {
    const ref = constructionPlanDrawingReuseJobRef(input.jobId);
    await db().runTransaction(async (transaction) => {
        const snapshot = await transaction.get(ref);
        const job = asJob(snapshot);
        if (job.ownerId !== input.actorId
            || job.requestFingerprint !== input.requestFingerprint
            || job.sourcePlanFingerprint !== input.sourcePlanFingerprint) {
            fail('already-exists', '도면 재사용 작업 소유권이 일치하지 않습니다.');
        }
        if (job.status === 'completed' || job.status === 'copying') return;
        if (job.status === 'failed') {
            fail('aborted', '도면 재사용 작업이 안전 정리 단계로 전환되었습니다. 같은 요청으로 다시 시도해주세요.');
        }
        transaction.update(ref, {
            status: 'copying',
            updatedAt: input.timestamp,
            cleanupAfterEpochMs: Date.parse(input.timestamp) + READY_JOB_TTL_MS,
        });
    });
};

const markDrawingReuseJobReady = async (input: {
    jobId: string;
    actorId: string;
    requestFingerprint: string;
    sourcePlanFingerprint: string;
    bindings: readonly ConstructionPlanDrawingCopyBinding[];
    timestamp: string;
}): Promise<void> => {
    const ref = constructionPlanDrawingReuseJobRef(input.jobId);
    const projected = input.bindings.map(jobBindingRecord);
    await db().runTransaction(async (transaction) => {
        const snapshot = await transaction.get(ref);
        const job = asJob(snapshot);
        if (job.ownerId !== input.actorId
            || job.requestFingerprint !== input.requestFingerprint
            || job.sourcePlanFingerprint !== input.sourcePlanFingerprint) {
            fail('already-exists', '도면 재사용 작업 소유권이 일치하지 않습니다.');
        }
        if (job.status === 'completed') return;
        if (job.status === 'failed') {
            fail('aborted', '도면 재사용 작업이 안전 정리 단계로 전환되었습니다. 같은 요청으로 다시 시도해주세요.');
        }
        const existing = Array.isArray(job.bindings) ? job.bindings : [];
        if (existing.length !== projected.length
            || existing.some((binding, index) => !sameJobBinding(binding, projected[index]))) {
            fail('data-loss', '도면 재사용 작업의 준비 완료 바인딩이 일치하지 않습니다.');
        }
        transaction.update(ref, {
            status: 'ready',
            bindings: projected,
            updatedAt: input.timestamp,
            cleanupAfterEpochMs: Date.parse(input.timestamp) + READY_JOB_TTL_MS,
        });
    });
};

const ensureDrawingReuseJob = async (input: {
    jobId: string;
    operation: DrawingReuseOperation;
    actorId: string;
    requestFingerprint: string;
    sourcePlanFingerprint: string;
    sourcePlanId: string;
    targetPlanId: string;
    siteId: string;
    timestamp: string;
}): Promise<DrawingReuseJob> => {
    if (!SHA256_PATTERN.test(input.requestFingerprint)
        || !SHA256_PATTERN.test(input.sourcePlanFingerprint)) {
        throw new Error('construction-plan-drawing-reuse-job-fingerprint-invalid');
    }
    const ref = constructionPlanDrawingReuseJobRef(input.jobId);
    return db().runTransaction(async (transaction) => {
        const snapshot = await transaction.get(ref);
        if (snapshot.exists) {
            const job = asJob(snapshot);
            if (job.ownerId !== input.actorId
                || job.operation !== input.operation
                || job.requestFingerprint !== input.requestFingerprint
                || job.sourcePlanFingerprint !== input.sourcePlanFingerprint
                || job.sourcePlanId !== input.sourcePlanId
                || job.targetPlanId !== input.targetPlanId
                || job.siteId !== input.siteId) {
                fail('already-exists', '같은 멱등 키가 다른 도면 재사용 요청에 이미 사용되었습니다.');
            }
            if (job.status === 'failed') {
                transaction.update(ref, {
                    status: 'queued',
                    attempts: Number(job.attempts || 0) + 1,
                    updatedAt: input.timestamp,
                    cleanupAfterEpochMs: Date.parse(input.timestamp) + READY_JOB_TTL_MS,
                    errorCode: admin.firestore.FieldValue.delete(),
                    bindings: admin.firestore.FieldValue.delete(),
                    result: admin.firestore.FieldValue.delete(),
                    completedAt: admin.firestore.FieldValue.delete(),
                });
                return {
                    ...job,
                    status: 'queued',
                    attempts: Number(job.attempts || 0) + 1,
                    bindings: undefined,
                    result: undefined,
                };
            }
            return job;
        }
        const job: DrawingReuseJob = {
            schemaVersion: 1,
            id: input.jobId,
            requestId: input.jobId,
            operation: input.operation,
            ownerId: input.actorId,
            requestFingerprint: input.requestFingerprint,
            sourcePlanFingerprint: input.sourcePlanFingerprint,
            sourcePlanId: input.sourcePlanId,
            targetPlanId: input.targetPlanId,
            siteId: input.siteId,
            status: 'queued',
            attempts: 1,
            createdAt: input.timestamp,
            updatedAt: input.timestamp,
            cleanupAfterEpochMs: Date.parse(input.timestamp) + READY_JOB_TTL_MS,
        };
        transaction.create(ref, job);
        return job;
    });
};

const markJobFailed = async (jobId: string, error: unknown): Promise<void> => {
    const errorCode = error instanceof functions.https.HttpsError
        ? error.code
        : error instanceof Error ? error.message.slice(0, 160) : 'unknown';
    const ref = constructionPlanDrawingReuseJobRef(jobId);
    try {
        await db().runTransaction(async (transaction) => {
            const snapshot = await transaction.get(ref);
            if (!snapshot.exists) return;
            const job = asJob(snapshot);
            if (job.status === 'ready' || job.status === 'completed') return;
            const timestamp = new Date().toISOString();
            transaction.update(ref, {
                status: 'failed',
                errorCode,
                updatedAt: timestamp,
                cleanupAfterEpochMs: Date.parse(timestamp) + READY_JOB_TTL_MS,
            });
        });
    } catch (writeError) {
        console.error('[constructionPlanDrawingReuse] failed job update failed', { jobId, writeError });
    }
};

const cleanupKnownPrecommitFailureBestEffort = async (
    jobId: string,
    error: unknown,
    fallbackCode: string,
): Promise<void> => {
    try {
        await cleanupConstructionPlanDrawingReuseAfterKnownPrecommitFailure(
            jobId,
            error instanceof Error ? error.message : fallbackCode,
        );
    } catch (cleanupError) {
        console.error('[constructionPlanDrawingReuse] exact precommit cleanup deferred', {
            jobId,
            cleanupError,
        });
    }
};

const prepareDrawingCopies = async (input: {
    jobId: string;
    operation: DrawingReuseOperation;
    actorId: string;
    requestFingerprint: string;
    sourcePlan: UnknownRecord;
    targetPlanId: string;
    targetDrawingIds?: ReadonlyMap<string, string>;
    timestamp: string;
}): Promise<{
    sourcePlanFingerprint: string;
    bindings: ConstructionPlanDrawingCopyBinding[];
}> => {
    const sourcePlanId = requiredString(input.sourcePlan, 'id', 200);
    const siteId = requiredString(input.sourcePlan, 'siteId', 200);
    const sourcePlanFingerprint = canonicalPlanFingerprint(input.sourcePlan);
    const sources = projectConstructionPlanDrawingSourceBindings(input.sourcePlan);
    await ensureDrawingReuseJob({
        jobId: input.jobId,
        operation: input.operation,
        actorId: input.actorId,
        requestFingerprint: input.requestFingerprint,
        sourcePlanFingerprint,
        sourcePlanId,
        targetPlanId: input.targetPlanId,
        siteId,
        timestamp: input.timestamp,
    });
    await markDrawingReuseJobCopying({
        jobId: input.jobId,
        actorId: input.actorId,
        requestFingerprint: input.requestFingerprint,
        sourcePlanFingerprint,
        timestamp: new Date().toISOString(),
    });
    try {
        const bindings: ConstructionPlanDrawingCopyBinding[] = [];
        for (const binding of sources) {
            const targetDrawingId = input.targetDrawingIds?.get(binding.drawingId) || binding.drawingId;
            const copied = await copySourceObjectCreateOnly({
                binding,
                targetPlanId: input.targetPlanId,
                targetDrawingId,
                jobId: input.jobId,
                requestFingerprint: input.requestFingerprint,
                actorId: input.actorId,
                onTargetCreated: async (created) => {
                    const prepared = [...bindings, created];
                    await persistPreparedJobBindings({
                        jobId: input.jobId,
                        actorId: input.actorId,
                        requestFingerprint: input.requestFingerprint,
                        sourcePlanFingerprint,
                        bindings: prepared,
                        timestamp: new Date().toISOString(),
                    });
                },
            });
            bindings.push(copied);
        }
        const readyAt = new Date().toISOString();
        await markDrawingReuseJobReady({
            jobId: input.jobId,
            actorId: input.actorId,
            requestFingerprint: input.requestFingerprint,
            sourcePlanFingerprint,
            bindings,
            timestamp: readyAt,
        });
        return { sourcePlanFingerprint, bindings };
    } catch (error) {
        await cleanupKnownPrecommitFailureBestEffort(input.jobId, error, 'copy-precommit-failed');
        await markJobFailed(input.jobId, error);
        throw error;
    }
};

export const prepareConstructionPlanDerivedDrawingReuse = async (input: {
    actorId: string;
    operation: 'revision' | 'clone';
    idempotencyKey: string;
    requestFingerprint: string;
    sourcePlan: UnknownRecord;
    targetPlanId: string;
    timestamp: string;
}): Promise<PreparedConstructionPlanDrawingReuse> => {
    requireReusableSourcePlan(input.sourcePlan);
    const identity = buildConstructionPlanDrawingReuseIdentity(input);
    if (identity.targetPlanId !== input.targetPlanId) {
        throw new Error('construction-plan-drawing-reuse-target-plan-id-invalid');
    }
    const prepared = await prepareDrawingCopies({
        jobId: identity.jobId,
        operation: input.operation,
        actorId: input.actorId,
        requestFingerprint: input.requestFingerprint,
        sourcePlan: input.sourcePlan,
        targetPlanId: input.targetPlanId,
        timestamp: input.timestamp,
    });
    try {
        return {
            jobId: identity.jobId,
            targetPlanId: input.targetPlanId,
            sourcePlanFingerprint: prepared.sourcePlanFingerprint,
            bindings: prepared.bindings,
            projection: buildConstructionPlanDrawingReuseProjection({
                sourcePlan: input.sourcePlan,
                bindings: prepared.bindings,
                actorId: input.actorId,
                timestamp: input.timestamp,
            }),
        };
    } catch (error) {
        await cleanupKnownPrecommitFailureBestEffort(identity.jobId, error, 'projection-precommit-failed');
        await markJobFailed(identity.jobId, error);
        throw error;
    }
};

export const assertConstructionPlanDrawingReuseJobReady = (input: {
    value: unknown;
    jobId: string;
    actorId: string;
    operation: DrawingReuseOperation;
    requestFingerprint: string;
    sourcePlanFingerprint: string;
    targetPlanId: string;
}): void => {
    if (!isUnknownRecord(input.value)
        || input.value.schemaVersion !== 1
        || input.value.id !== input.jobId
        || input.value.ownerId !== input.actorId
        || input.value.operation !== input.operation
        || input.value.requestFingerprint !== input.requestFingerprint
        || input.value.sourcePlanFingerprint !== input.sourcePlanFingerprint
        || input.value.targetPlanId !== input.targetPlanId
        || (input.value.status !== 'ready' && input.value.status !== 'completed')
        || !Array.isArray(input.value.bindings)) {
        fail('failed-precondition', '도면 재사용 작업이 완료되지 않았거나 요청 바인딩이 일치하지 않습니다.');
    }
};

export const completedConstructionPlanDrawingReuseJobPatch = (
    response: UnknownRecord,
    timestamp: string,
): UnknownRecord => ({
    status: 'completed',
    result: response,
    updatedAt: timestamp,
    completedAt: timestamp,
    cleanupAfterEpochMs: Date.parse(timestamp) + COMPLETED_JOB_TTL_MS,
});

const listAccessiblePlans = async (
    actor: DrawingReuseActor,
    siteId: string,
): Promise<UnknownRecord[]> => {
    const snapshots = actor.access.isAdmin || actor.access.isOffice
        ? [await db().collection(PLANS_COLLECTION)
            .where('siteId', '==', siteId)
            .limit(MAX_PLAN_QUERY_RESULTS)
            .get()]
        : await Promise.all([
            db().collection(PLANS_COLLECTION)
                .where('createdBy', '==', actor.uid)
                .limit(MAX_PLAN_QUERY_RESULTS)
                .get(),
            ...['authorIds', 'reviewerIds', 'approverIds'].map((field) => db()
                .collection(PLANS_COLLECTION)
                .where(`participants.${field}`, 'array-contains', actor.uid)
                .limit(MAX_PLAN_QUERY_RESULTS)
                .get()),
        ]);
    const plans = new Map<string, UnknownRecord>();
    snapshots.forEach((snapshot) => snapshot.docs.forEach((document) => {
        const plan = planDocument(document);
        if (plan.siteId === siteId
            && (actor.access.isAdmin || actor.access.isOffice
                || isConstructionPlanParticipant(plan, actor.uid))) {
            plans.set(document.id, plan);
        }
    }));
    return Array.from(plans.values());
};

const reuseBlockReason = (plan: UnknownRecord, drawing: unknown): string | undefined => {
    try {
        requireReusableSourcePlan(plan);
        projectConstructionPlanDrawingSourceBinding({ plan, drawing });
        return undefined;
    } catch (error) {
        const code = error instanceof Error ? error.message : '';
        if (code.includes('generation')) return '원본 Storage generation이 없는 legacy 도면입니다.';
        if (code.includes('path') || code.includes('binding')) return '원본 경로 계보가 검증되지 않은 legacy 도면입니다.';
        if (code.includes('sha256')) return '원본 SHA-256이 없어 무결성을 검증할 수 없습니다.';
        if (code.includes('template')) return '게시 템플릿 바인딩이 없는 계획서의 도면입니다.';
        if (code.includes('lineage')) return '문서 계보가 없는 계획서의 도면입니다.';
        return '원본 무결성 계약을 충족하지 않아 재사용할 수 없습니다.';
    }
};

const libraryItem = (
    plan: UnknownRecord,
    drawing: UnknownRecord,
): ConstructionPlanDrawingLibraryItem => {
    const blocked = reuseBlockReason(plan, drawing);
    return {
        sourcePlanId: String(plan.id),
        sourcePlanTitle: readTrimmedString(plan, ['title']) || '제목 없음',
        sourceDocumentNo: readTrimmedString(plan, ['documentNo']) || '-',
        sourcePlanRevision: Number.isSafeInteger(plan.revision) ? Number(plan.revision) : 0,
        sourcePlanStatus: readTrimmedString(plan, ['status']) || 'unknown',
        drawingId: readTrimmedString(drawing, ['id']) || '',
        drawingNo: readTrimmedString(drawing, ['drawingNo']) || '-',
        title: readTrimmedString(drawing, ['title']) || readTrimmedString(drawing, ['originalFileName']) || '도면',
        originalFileName: readTrimmedString(drawing, ['originalFileName']) || '-',
        mimeType: readTrimmedString(drawing, ['mimeType']) || '',
        sizeBytes: Number.isSafeInteger(drawing.sizeBytes) ? Number(drawing.sizeBytes) : 0,
        sourceSha256: /^[a-f0-9]{64}$/i.test(String(drawing.sourceSha256 || ''))
            ? String(drawing.sourceSha256).toLowerCase()
            : '',
        approvalStatus: readTrimmedString(drawing, ['approvalStatus']) || 'unknown',
        reusable: !blocked,
        ...(blocked ? { reuseBlockReason: blocked } : {}),
    };
};

const encodeCursor = (key: string): string => Buffer.from(key, 'utf8').toString('base64url');
const decodeCursor = (value: unknown): string | undefined => {
    if (value === undefined) return undefined;
    if (typeof value !== 'string' || value.length > 1_000) {
        fail('invalid-argument', '도면 라이브러리 cursor가 올바르지 않습니다.');
    }
    try {
        const decoded = Buffer.from(value, 'base64url').toString('utf8');
        if (!decoded || decoded.length > 500) throw new Error('cursor-invalid');
        return decoded;
    } catch (_error) {
        return fail('invalid-argument', '도면 라이브러리 cursor가 올바르지 않습니다.');
    }
};

const listDrawingLibrary = async (
    data: unknown,
    context: functions.https.CallableContext,
): Promise<UnknownRecord> => {
    const record = callableRecord(data);
    assertExactKeys(record, ['targetPlanId', 'pageSize', 'cursor']);
    const targetPlanId = documentId(record, 'targetPlanId');
    const pageSize = record.pageSize === undefined ? 20 : Number(record.pageSize);
    if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > MAX_LIBRARY_PAGE_SIZE) {
        fail('invalid-argument', `pageSize는 1~${MAX_LIBRARY_PAGE_SIZE}이어야 합니다.`);
    }
    const cursor = decodeCursor(record.cursor);
    const actor = await resolveActor(context);
    const target = planDocument(await db().collection(PLANS_COLLECTION).doc(targetPlanId).get());
    requirePlanAccess(target, actor);
    const siteId = requiredString(target, 'siteId', 200);
    const plans = await listAccessiblePlans(actor, siteId);
    const rows = plans.flatMap((plan) => {
        if (plan.id === targetPlanId || !Array.isArray(plan.drawings)) return [];
        return plan.drawings.flatMap((drawing): Array<{ key: string; item: ConstructionPlanDrawingLibraryItem }> => {
            if (!isUnknownRecord(drawing) || !readTrimmedString(drawing, ['id'])) return [];
            const updatedAt = readTrimmedString(plan, ['updatedAt', 'createdAt']) || '';
            return [{
                key: `${updatedAt}\u0000${String(plan.id)}\u0000${String(drawing.id)}`,
                item: libraryItem(plan, drawing),
            }];
        });
    }).sort((left, right) => right.key.localeCompare(left.key)).slice(0, MAX_LIBRARY_ITEMS);
    const start = cursor ? rows.findIndex((row) => row.key === cursor) + 1 : 0;
    if (cursor && start === 0) fail('invalid-argument', '도면 라이브러리 cursor가 만료되었습니다.');
    const page = rows.slice(start, start + pageSize);
    const hasMore = start + page.length < rows.length;
    return {
        items: page.map((row) => row.item),
        ...(hasMore && page.length ? { nextCursor: encodeCursor(page[page.length - 1].key) } : {}),
    };
};

const parseImportRequest = (data: unknown): {
    targetPlanId: string;
    targetSectionId: string;
    sourcePlanId: string;
    sourceDrawingId: string;
    expectedLockVersion: number;
    idempotencyKey: string;
} => {
    const record = callableRecord(data);
    assertExactKeys(record, [
        'targetPlanId', 'targetSectionId', 'sourcePlanId', 'sourceDrawingId',
        'expectedLockVersion', 'idempotencyKey',
    ]);
    return {
        targetPlanId: documentId(record, 'targetPlanId'),
        targetSectionId: documentId(record, 'targetSectionId'),
        sourcePlanId: documentId(record, 'sourcePlanId'),
        sourceDrawingId: documentId(record, 'sourceDrawingId'),
        expectedLockVersion: parseExpectedLockVersion(record),
        idempotencyKey: requiredString(record, 'idempotencyKey', 128),
    };
};

const recoveredLibraryImportResponse = (
    job: DrawingReuseJob,
    plan: UnknownRecord,
): UnknownRecord => {
    if (!isUnknownRecord(job.result)) {
        fail('data-loss', '완료된 도면 가져오기 작업의 결과가 손상되었습니다.');
    }
    const targetDrawingId = readTrimmedString(job.result, ['targetDrawingId']);
    const targetSectionId = readTrimmedString(job.result, ['targetSectionId']);
    const drawing = targetDrawingId && Array.isArray(plan.drawings)
        ? plan.drawings.find((candidate) => isUnknownRecord(candidate) && candidate.id === targetDrawingId)
        : undefined;
    const section = targetSectionId && Array.isArray(plan.sections)
        ? plan.sections.find((candidate) => isUnknownRecord(candidate) && candidate.id === targetSectionId)
        : undefined;
    if (!targetDrawingId || !targetSectionId || !isUnknownRecord(drawing) || !isUnknownRecord(section)) {
        fail('data-loss', '완료된 도면 가져오기 작업과 대상 계획서 바인딩이 일치하지 않습니다.');
    }
    return {
        ...job.result,
        plan,
        drawing,
        section,
        lockVersion: Number(plan.lockVersion),
        idempotent: true,
    };
};

const importDrawingFromLibrary = async (
    data: unknown,
    context: functions.https.CallableContext,
): Promise<UnknownRecord> => {
    const request = parseImportRequest(data);
    const actor = await resolveActor(context);
    const identity = buildConstructionPlanDrawingReuseIdentity({
        actorId: actor.uid,
        operation: 'library_import',
        idempotencyKey: request.idempotencyKey,
    });
    const requestFingerprint = sha256Hex(canonicalStringify({ ...request, actorId: actor.uid }));
    const jobRef = constructionPlanDrawingReuseJobRef(identity.jobId);
    const existingJobSnapshot = await jobRef.get();
    if (existingJobSnapshot.exists) {
        const existing = asJob(existingJobSnapshot);
        if (existing.ownerId !== actor.uid || existing.requestFingerprint !== requestFingerprint) {
            fail('already-exists', '같은 멱등 키가 다른 도면 가져오기 요청에 이미 사용되었습니다.');
        }
        if (existing.status === 'completed' && isUnknownRecord(existing.result)) {
            const completedTarget = planDocument(await db()
                .collection(PLANS_COLLECTION)
                .doc(existing.targetPlanId)
                .get());
            requirePlanAccess(completedTarget, actor);
            return recoveredLibraryImportResponse(existing, completedTarget);
        }
    }

    const targetRef = db().collection(PLANS_COLLECTION).doc(request.targetPlanId);
    const sourceRef = db().collection(PLANS_COLLECTION).doc(request.sourcePlanId);
    const [targetSnapshot, sourceSnapshot] = await Promise.all([targetRef.get(), sourceRef.get()]);
    const target = planDocument(targetSnapshot);
    const source = planDocument(sourceSnapshot);
    const nowEpochMs = Date.now();
    requireEditableTargetPlan(target, actor, request.expectedLockVersion, nowEpochMs);
    requirePlanAccess(source, actor);
    requireReusableSourcePlan(source);
    if (target.siteId !== source.siteId) {
        fail('failed-precondition', '같은 현장의 도면만 라이브러리에서 가져올 수 있습니다.');
    }
    const sourceDrawing = Array.isArray(source.drawings)
        ? source.drawings.find((candidate) => (
            isUnknownRecord(candidate) && candidate.id === request.sourceDrawingId
        ))
        : undefined;
    if (!sourceDrawing) fail('not-found', '재사용할 원본 도면을 찾을 수 없습니다.');
    const sourceBinding = projectConstructionPlanDrawingSourceBinding({ plan: source, drawing: sourceDrawing });
    const targetDrawingId = `drw-${sha256Hex(canonicalStringify({
        jobId: identity.jobId,
        sourceDrawingId: sourceBinding.drawingId,
    })).slice(0, 40)}`;
    const timestamp = new Date().toISOString();
    const sourcePlanFingerprint = canonicalPlanFingerprint(source);
    const targetPlanFingerprint = canonicalPlanFingerprint(target);
    await ensureDrawingReuseJob({
        jobId: identity.jobId,
        operation: 'library_import',
        actorId: actor.uid,
        requestFingerprint,
        sourcePlanFingerprint,
        sourcePlanId: request.sourcePlanId,
        targetPlanId: request.targetPlanId,
        siteId: String(source.siteId),
        timestamp,
    });
    await markDrawingReuseJobCopying({
        jobId: identity.jobId,
        actorId: actor.uid,
        requestFingerprint,
        sourcePlanFingerprint,
        timestamp,
    });
    let binding: ConstructionPlanDrawingCopyBinding;
    try {
        binding = await copySourceObjectCreateOnly({
            binding: sourceBinding,
            targetPlanId: request.targetPlanId,
            targetDrawingId,
            jobId: identity.jobId,
            requestFingerprint,
            actorId: actor.uid,
            onTargetCreated: async (created) => {
                await persistPreparedJobBindings({
                    jobId: identity.jobId,
                    actorId: actor.uid,
                    requestFingerprint,
                    sourcePlanFingerprint,
                    bindings: [created],
                    timestamp: new Date().toISOString(),
                });
            },
        });
        await markDrawingReuseJobReady({
            jobId: identity.jobId,
            actorId: actor.uid,
            requestFingerprint,
            sourcePlanFingerprint,
            bindings: [binding],
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        await cleanupKnownPrecommitFailureBestEffort(identity.jobId, error, 'library-copy-precommit-failed');
        await markJobFailed(identity.jobId, error);
        throw error;
    }

    const eventRef = targetRef.collection('workflowEvents').doc();
    const auditRef = db().collection(AUDIT_COLLECTION).doc();
    let transactionWritesQueued = false;
    try {
        return await db().runTransaction(async (transaction) => {
            const [jobSnapshot, latestTargetSnapshot, latestSourceSnapshot] = await Promise.all([
                transaction.get(jobRef),
                transaction.get(targetRef),
                transaction.get(sourceRef),
            ]);
            const job = asJob(jobSnapshot);
            if (job.status === 'completed' && isUnknownRecord(job.result)) {
                return recoveredLibraryImportResponse(job, planDocument(latestTargetSnapshot));
            }
            assertConstructionPlanDrawingReuseJobReady({
                value: job,
                jobId: identity.jobId,
                actorId: actor.uid,
                operation: 'library_import',
                requestFingerprint,
                sourcePlanFingerprint,
                targetPlanId: request.targetPlanId,
            });
            const latestTarget = planDocument(latestTargetSnapshot);
            const latestSource = planDocument(latestSourceSnapshot);
            requireEditableTargetPlan(latestTarget, actor, request.expectedLockVersion, Date.now());
            requirePlanAccess(latestSource, actor);
            requireReusableSourcePlan(latestSource);
            if (canonicalPlanFingerprint(latestTarget) !== targetPlanFingerprint
                || canonicalPlanFingerprint(latestSource) !== sourcePlanFingerprint
                || latestTarget.siteId !== latestSource.siteId) {
                fail('aborted', '도면 복사 중 원본 또는 대상 계획서가 변경되었습니다. 새로고침 후 다시 시도해주세요.');
            }
            const projection = applyConstructionPlanImportedDrawingProjection({
                targetPlan: latestTarget,
                targetSectionId: request.targetSectionId,
                binding,
                actorId: actor.uid,
                timestamp,
            });
            const beforeHash = sha256Hex(canonicalStringify({
                drawings: latestTarget.drawings,
                sections: latestTarget.sections,
                drawingApplicability: latestTarget.drawingApplicability,
            }));
            const afterHash = sha256Hex(canonicalStringify({
                drawings: projection.plan.drawings,
                sections: projection.plan.sections,
                drawingApplicability: projection.plan.drawingApplicability,
            }));
            const response: UnknownRecord = {
                planId: request.targetPlanId,
                sourcePlanId: request.sourcePlanId,
                sourceDrawingId: request.sourceDrawingId,
                targetDrawingId,
                lockVersion: projection.lockVersion,
                plan: projection.plan,
                drawing: projection.drawing,
                section: projection.section,
                idempotent: false,
            };
            const durableResponse: UnknownRecord = {
                planId: request.targetPlanId,
                sourcePlanId: request.sourcePlanId,
                sourceDrawingId: request.sourceDrawingId,
                targetDrawingId,
                targetSectionId: request.targetSectionId,
            };
            transaction.update(targetRef, {
                sections: projection.plan.sections,
                drawings: projection.plan.drawings,
                drawingApplicability: projection.plan.drawingApplicability,
                releaseReadiness: projection.plan.releaseReadiness,
                validationSummary: projection.plan.validationSummary,
                lockVersion: projection.lockVersion,
                updatedBy: actor.uid,
                updatedAt: timestamp,
            });
            transaction.update(jobRef, completedConstructionPlanDrawingReuseJobPatch(durableResponse, timestamp));
            transaction.create(eventRef, {
                id: eventRef.id,
                planId: request.targetPlanId,
                seriesId: readTrimmedString(latestTarget, ['seriesId']),
                type: 'drawing_reused',
                action: 'drawing_reused',
                actorId: actor.uid,
                at: timestamp,
                createdAt: timestamp,
                sourcePlanId: request.sourcePlanId,
                targetPlanId: request.targetPlanId,
                metadata: {
                    requestId: identity.jobId,
                    sourceDrawingId: request.sourceDrawingId,
                    targetDrawingId,
                    sourceGeneration: binding.sourceGeneration,
                    sourceSha256: binding.sourceSha256,
                    targetGeneration: binding.targetGeneration,
                    targetStoragePath: binding.targetStoragePath,
                    reReviewRequired: true,
                },
            });
            transaction.create(auditRef, {
                id: auditRef.id,
                planId: request.targetPlanId,
                siteId: latestTarget.siteId,
                type: 'construction_plan_drawing_reused',
                actorId: actor.uid,
                at: timestamp,
                requestId: identity.jobId,
                sourcePlanId: request.sourcePlanId,
                sourceDrawingId: request.sourceDrawingId,
                targetDrawingId,
                sourceGeneration: binding.sourceGeneration,
                sourceSha256: binding.sourceSha256,
                targetGeneration: binding.targetGeneration,
                targetStoragePath: binding.targetStoragePath,
                beforeHash,
                afterHash,
            });
            // The callback has queued every atomic write. Any later transport
            // failure may be a lost successful response, so target objects must
            // remain until the durable plan/job state resolves ownership.
            transactionWritesQueued = true;
            return response;
        });
    } catch (error) {
        if (!transactionWritesQueued) {
            await cleanupKnownPrecommitFailureBestEffort(
                identity.jobId,
                error,
                'library-transaction-precommit-failed',
            );
        }
        await markJobFailed(identity.jobId, error);
        throw error;
    }
};

const getDrawingReuseDerivationStatus = async (
    data: unknown,
    context: functions.https.CallableContext,
): Promise<UnknownRecord> => {
    const record = callableRecord(data);
    assertExactKeys(record, ['operation', 'idempotencyKey']);
    const rawOperation = requiredString(record, 'operation', 20);
    if (rawOperation !== 'revision' && rawOperation !== 'clone') {
        fail('invalid-argument', '도면 복사 작업 종류가 올바르지 않습니다.');
    }
    const idempotencyKey = requiredString(record, 'idempotencyKey', 128);
    const actor = await resolveActor(context);
    const identity = buildConstructionPlanDrawingReuseIdentity({
        actorId: actor.uid,
        operation: rawOperation,
        idempotencyKey,
    });
    const snapshot = await constructionPlanDrawingReuseJobRef(identity.jobId).get();
    if (!snapshot.exists) return { status: 'not_started' };
    const job = asJob(snapshot);
    if (job.ownerId !== actor.uid || job.operation !== rawOperation) {
        fail('permission-denied', '도면 복사 작업을 조회할 권한이 없습니다.');
    }
    return {
        status: job.status,
        targetPlanId: job.targetPlanId,
        ...(job.status === 'completed' && isUnknownRecord(job.result) ? { result: job.result } : {}),
        ...(job.status === 'failed' && job.errorCode ? { errorCode: job.errorCode } : {}),
    };
};

const targetPlanContainsBinding = (
    plan: unknown,
    job: DrawingReuseJob,
    binding: DrawingReuseJobBinding,
): boolean => isUnknownRecord(plan)
    && Array.isArray(plan.drawings)
    && plan.drawings.some((drawing) => (
        isUnknownRecord(drawing)
        && drawing.id === binding.targetDrawingId
        && drawing.planId === job.targetPlanId
        && drawing.storagePath === binding.targetStoragePath
        && drawing.sourceGeneration === binding.targetGeneration
        && String(drawing.sourceSha256 || '').toLowerCase() === binding.sourceSha256
    ));

const deleteOwnedTargetObject = async (
    job: DrawingReuseJob,
    binding: DrawingReuseJobBinding,
): Promise<boolean> => {
    const file = bucket().file(binding.targetStoragePath, { generation: binding.targetGeneration });
    try {
        const [metadata] = await file.getMetadata();
        if (storageMetadataString(metadata, 'reuseJobId') !== job.id
            || storageMetadataString(metadata, 'requestFingerprint') !== job.requestFingerprint
            || storageMetadataString(metadata, 'planId') !== job.targetPlanId
            || storageMetadataString(metadata, 'drawingId') !== binding.targetDrawingId
            || String(metadata.generation || '') !== binding.targetGeneration) return false;
        // GCS generations are uint64 decimal strings and can exceed JS's safe
        // integer range. The REST query accepts the exact decimal value even
        // though this SDK version narrows its TypeScript declaration to number.
        await file.delete({
            ifGenerationMatch: binding.targetGeneration as unknown as number,
        });
        return true;
    } catch (error) {
        if (Number((error as { code?: unknown })?.code) !== 404) throw error;
        return false;
    }
};

/**
 * Claims and removes canonical objects only when a deterministic derivation or
 * library-import transaction is known to have failed before it queued writes.
 * The job and target plan are read in the same Firestore transaction: a
 * concurrent/ambiguous successful commit therefore wins and prevents deletion.
 */
export const cleanupConstructionPlanDrawingReuseAfterKnownPrecommitFailure = async (
    jobId: string,
    errorCode = 'precommit-failed',
): Promise<ConstructionPlanDrawingReuseCleanupResult> => {
    const jobRef = constructionPlanDrawingReuseJobRef(jobId);
    let claimedJob: DrawingReuseJob | undefined;
    const claimed = await db().runTransaction(async (transaction) => {
        const jobSnapshot = await transaction.get(jobRef);
        if (!jobSnapshot.exists) return false;
        const job = asJob(jobSnapshot);
        const targetSnapshot = await transaction.get(
            db().collection(PLANS_COLLECTION).doc(job.targetPlanId),
        );
        const target = targetSnapshot.exists ? targetSnapshot.data() : undefined;
        const bindings = Array.isArray(job.bindings) ? job.bindings : [];
        if (job.status === 'completed'
            || bindings.some((binding) => targetPlanContainsBinding(target, job, binding))) {
            return false;
        }
        const timestamp = new Date().toISOString();
        claimedJob = job;
        transaction.update(jobRef, {
            status: 'failed',
            errorCode: errorCode.slice(0, 160),
            updatedAt: timestamp,
            cleanupAfterEpochMs: Date.parse(timestamp) + READY_JOB_TTL_MS,
        });
        return true;
    });
    if (!claimed || !claimedJob) return { claimed: false, deletedObjects: 0 };
    let deletedObjects = 0;
    for (const binding of Array.isArray(claimedJob.bindings) ? claimedJob.bindings : []) {
        if (await deleteOwnedTargetObject(claimedJob, binding)) deletedObjects += 1;
    }
    return { claimed: true, deletedObjects };
};

export const cleanupExpiredConstructionPlanDrawingReuseJobs = async (
    nowEpochMs = Date.now(),
): Promise<{ scanned: number; deletedJobs: number; deletedObjects: number }> => {
    const snapshot = await db().collection(JOBS_COLLECTION)
        .where('cleanupAfterEpochMs', '<=', nowEpochMs)
        .limit(MAX_CLEANUP_JOBS)
        .get();
    let deletedJobs = 0;
    let deletedObjects = 0;
    for (const document of snapshot.docs) {
        let job: DrawingReuseJob;
        try {
            job = asJob(document);
        } catch (error) {
            console.error('[constructionPlanDrawingReuse] malformed cleanup job', document.id, error);
            continue;
        }
        const targetSnapshot = await db().collection(PLANS_COLLECTION).doc(job.targetPlanId).get();
        const target = targetSnapshot.exists ? targetSnapshot.data() : undefined;
        for (const binding of Array.isArray(job.bindings) ? job.bindings : []) {
            if (!targetPlanContainsBinding(target, job, binding)
                && await deleteOwnedTargetObject(job, binding)) {
                deletedObjects += 1;
            }
        }
        await document.ref.delete();
        deletedJobs += 1;
    }
    return { scanned: snapshot.size, deletedJobs, deletedObjects };
};

export const listConstructionPlanDrawingLibraryServer = listRunner.https.onCall(listDrawingLibrary);
export const importConstructionPlanDrawingFromLibraryServer = runner.https.onCall(importDrawingFromLibrary);
export const getConstructionPlanDrawingReuseDerivationStatusServer = listRunner.https.onCall(
    getDrawingReuseDerivationStatus,
);
export const cleanupConstructionPlanDrawingReuseScheduled = functions
    .runWith({ timeoutSeconds: 300, memory: '512MB', maxInstances: 1 })
    .region('asia-northeast3')
    .pubsub.schedule('every 24 hours')
    .timeZone('Asia/Seoul')
    .onRun(async () => {
        await cleanupExpiredConstructionPlanDrawingReuseJobs();
        return null;
    });
