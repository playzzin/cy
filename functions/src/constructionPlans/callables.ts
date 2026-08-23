import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import { PDFParse } from 'pdf-parse';
import {
    addUniquePlanParticipant,
    applyConstructionPlanReviewCommentTransition,
    assertConstructionPlanApprovalEvidenceBinding,
    assertConstructionPlanReviewCommentTransition,
    buildConstructionPlanApprovedSnapshotReference,
    canAddressConstructionPlanReviewComment,
    buildCanonicalConstructionPlanDraftContext,
    buildConstructionPlanCloneDocument,
    buildConstructionPlanDraftDocument,
    buildConstructionPlanMutationClaimId,
    buildConstructionPlanRevisionDocument,
    buildConstructionPlanSeriesIdentity,
    buildConstructionPlanReviewSnapshotContent,
    canonicalStringify,
    classifyConstructionPlanDrawingReviewAnchor,
    classifyConstructionPlanRoleAccess,
    constructionPlanApprovalEvidenceContentForHash,
    CONSTRUCTION_PLAN_PAGE_COUNT,
    CONSTRUCTION_PLAN_RENDERER_VERSION,
    CONSTRUCTION_PLAN_SNAPSHOT_SCHEMA_VERSION,
    decideConstructionPlanIssueSeriesTransition,
    decideConstructionPlanRevisionSeriesTransition,
    emptyConstructionPlanReviewCommentSummary,
    findLegacyConstructionPlanDocumentNoCollisions,
    hasStableConstructionPlanReviewJsonPointer,
    isConstructionPlanParticipant,
    isConstructionPlanRequiredCommentVisibilityAllowed,
    isNormalizedConstructionPlanReviewCoordinate,
    isUnknownRecord,
    normalizeConstructionPlanDocumentNoKey,
    normalizeConstructionPlanReviewCommentSummary,
    projectSafeWorkerDirectoryEntry,
    readTrimmedString,
    resolveConstructionPlanRecordTemplate,
    resolveConstructionPlanMutationClaim,
    resolveConstructionPlanReviewMutationClaim,
    sanitizeConstructionPlanStorageSegment,
    sha256Hex,
    summarizeConstructionPlanReviewDiff,
    transitionConstructionPlanReviewStatus,
    type ConstructionPlanRoleAccess,
    type ConstructionPlanRevisionType,
    type ConstructionPlanReviewCommentStatus,
    type SafeWorkerDirectoryEntry,
    type UnknownRecord,
    validateConstructionPlanForRelease,
} from './domain';
import { callableFirestoreValue } from './callableFirestoreValue';
import {
    assertAuthoritativeConstructionPlanDrawingPreviews,
    assertConstructionPlanDrawingPreviewBindingHash,
    assertConstructionPlanDrawingPreviewMutationPolicy,
    ensureConstructionPlanDrawingPreview,
    parseEnsureConstructionPlanDrawingPreviewRequest,
} from './drawingPreview';
import {
    buildConstructionPlanServerPdfCustomMetadata,
    buildConstructionPlanServerPdfExportId,
    buildConstructionPlanServerPdfStoragePath,
    storeImmutableConstructionPlanServerPdf,
    type ConstructionPlanServerPdfArtifact,
    type ConstructionPlanServerPdfBinding,
} from './issuedPdfArtifact';
import {
    CONSTRUCTION_PLAN_FIELD_USE_DRAWING_RENDER_MODE,
    CONSTRUCTION_PLAN_FIELD_USE_MAX_PHYSICAL_PAGES,
    CONSTRUCTION_PLAN_FIELD_USE_MIN_PHYSICAL_PAGES,
    CONSTRUCTION_PLAN_FIELD_USE_RENDERER_VERSION,
    assertConstructionPlanFieldUseReleaseEligible,
    renderConstructionPlanFieldUsePdf,
    validateConstructionPlanFieldUseAuditPages,
    type ConstructionPlanFieldUseDrawingSourceRef,
    type ConstructionPlanFieldUsePageManifest,
    type ConstructionPlanFieldUsePdfResult,
} from './fieldUsePdfRenderer';
import {
    ISSUED_PDF_VALIDATION_PROJECTION,
    buildIssuedPdfAtomicProjection,
    buildPreparedPdfJobProjection,
    decideIssuedPdfTransactionDisposition,
    terminalIssuedPdfArtifactsMatch,
    type IssuedPdfTransitionArtifact,
} from './issuedPdfTransition';
import {
    resolveConstructionPlanServerTemplate,
    type ConstructionPlanTradeType,
} from './templateContracts';
import {
    assertConstructionPlanTemplateBindingMatchesPlanIdentity,
    assertConstructionPlanTemplateBindingMatchesRecord,
    assertConstructionPlanTemplateUpgradeTarget,
    assertSameConstructionPlanTemplateBinding,
    buildConstructionPlanTemplateBinding,
    constructionPlanTemplateBindingProjection,
    parseConstructionPlanTemplateBinding,
    type ConstructionPlanTemplateBinding,
} from './templateBinding';
import {
    assertConstructionPlanTemplateSnapshotForExistingPlan,
    assertPublishedConstructionPlanTemplateSnapshotForNewDraft,
    constructionPlanTemplateDocumentReferenceForIdentity,
} from './templateLifecycle';
import {
    assertConstructionPlanDrawingReuseJobReady,
    buildConstructionPlanDrawingReuseIdentity,
    cleanupConstructionPlanDrawingReuseAfterKnownPrecommitFailure,
    completedConstructionPlanDrawingReuseJobPatch,
    constructionPlanDrawingReuseJobRef,
    prepareConstructionPlanDerivedDrawingReuse,
    type PreparedConstructionPlanDrawingReuse,
} from './drawingReuse';
import { runMonitoredConstructionPlanPdfRender } from './pdfRenderMonitoring';

const PLANS_COLLECTION = 'constructionPlans';
const SERIES_COLLECTION = 'constructionPlanSeries';
const EXPORT_JOBS_COLLECTION = 'constructionPlanExportJobs';
const MUTATION_KEYS_COLLECTION = 'constructionPlanMutationKeys';
const AUDIT_COLLECTION = 'constructionPlanAuditEvents';
const WORKERS_COLLECTION = 'workers';
const SITES_COLLECTION = 'sites';
const COMPANIES_COLLECTION = 'companies';
const TEAMS_COLLECTION = 'teams';
const MAX_WORKER_RESULTS = 500;
const MAX_PLAN_LIST_RESULTS = 500;
const DEFAULT_PLAN_LIST_LIMIT = 100;
const MAX_REVIEW_COMMENT_RESULTS = 500;
const MAX_REVIEW_MESSAGE_RESULTS = 500;
const MAX_REVIEW_PACKAGE_RESULTS = 100;
const MAX_LEGACY_PLAN_COLLISION_SCAN = 500;
const MAX_SERVER_PDF_SIZE_BYTES = 100 * 1024 * 1024;

const cleanupPreparedDrawingReuseAfterPrecommitFailure = async (
    prepared: PreparedConstructionPlanDrawingReuse | undefined,
    error: unknown,
): Promise<void> => {
    if (!prepared) return;
    try {
        await cleanupConstructionPlanDrawingReuseAfterKnownPrecommitFailure(
            prepared.jobId,
            error instanceof Error ? error.message : 'derivation-precommit-failed',
        );
    } catch (cleanupError) {
        // The original mutation failure must remain visible. The scheduled
        // job cleaner retains the same exact generation/metadata safeguards.
        console.error('[constructionPlanDrawingReuse] precommit cleanup deferred', {
            jobId: prepared.jobId,
            cleanupError,
        });
    }
};

const constructionPlanRunner = functions
    .runWith({ timeoutSeconds: 60, memory: '512MB', maxInstances: 10 })
    .region('asia-northeast3');

const constructionPlanPdfRunner = functions
    .runWith({ timeoutSeconds: 300, memory: '1GB', maxInstances: 3 })
    .region('asia-northeast3');

export type ConstructionPlanReviewAction =
    | 'submit_review'
    | 'request_changes'
    | 'complete_review'
    | 'approve';

interface CallableActor {
    uid: string;
    access: ConstructionPlanRoleAccess;
    profile: UnknownRecord;
    token: UnknownRecord;
}

interface ReviewRequest {
    planId: string;
    action: ConstructionPlanReviewAction;
    reason?: string;
    expectedLockVersion?: number;
    idempotencyKey?: string;
}

interface PrepareIssuedPdfRequest {
    planId: string;
    approvedSnapshotHash: string;
}

interface IssueRequest extends PrepareIssuedPdfRequest {
    jobId: string;
    expectedCandidateSha256: string;
    visualCheckConfirmed: true;
}

interface ServerPdfProvenanceResponse {
    rendererVersion: string;
    rendererTemplateBundleHash: string;
    rendererBuildHash: string;
    renderInputHash: string;
    contentManifestHash: string;
    zeroOmissionCoverageHash: string;
    drawingBindingHash: string;
    drawingRenderMode: string;
    templateHash: string;
    manifestHash: string;
    templateBundleHash: string;
    templateBindingHash: string;
}

interface ServerPdfArtifactResponse {
    storagePath: string;
    storageGeneration: string;
    sha256: string;
    sizeBytes: number;
    pageCount: number;
    fileName: string;
}

interface PrepareIssuedPdfResponse {
    planId: string;
    jobId: string;
    status: 'ready_for_visual_check';
    approvedSnapshotHash: string;
    candidate: ServerPdfArtifactResponse;
    provenance: ServerPdfProvenanceResponse;
    idempotent?: boolean;
}

interface ApprovedPdfSnapshotContext {
    planId: string;
    plan: UnknownRecord;
    envelope: UnknownRecord;
    content: UnknownRecord;
    snapshotId: string;
    snapshotHash: string;
    approvedContentHash: string;
    snapshotStoragePath: string;
    snapshotStorageGeneration: string;
    snapshotByteLength: number;
    evidenceId: string;
    evidenceHash: string;
    approvalEvidence: UnknownRecord;
    authoritativeDrawingPreviewBindingHash: string;
    bindingBase: Omit<ConstructionPlanServerPdfBinding, 'exportJobId'>;
}

export interface PersistedServerPdfArtifactRecord extends ServerPdfArtifactResponse, ServerPdfProvenanceResponse {
    profile: 'candidate' | 'issued';
    releaseEligible: boolean;
    snapshotHash: string;
    approvedContentHash: string;
    pageManifest: ConstructionPlanFieldUsePageManifest[];
}

interface CreateDraftRequest {
    idempotencyKey: string;
    siteId: string;
    siteName?: string;
    title: string;
    tradeType: ConstructionPlanTradeType;
    templateId: string;
    templateVersion: string;
    documentNo: string;
    documentDate?: string;
    projectSnapshot?: UnknownRecord;
    organizationSnapshot?: UnknownRecord;
    participants?: UnknownRecord;
    selectedSectionKeys: string[];
}

interface CreateRevisionRequest {
    idempotencyKey: string;
    sourcePlanId: string;
    revisionReason: string;
    revisionType: ConstructionPlanRevisionType;
    copyDrawings: boolean;
    targetTemplate?: {
        tradeType: ConstructionPlanTradeType;
        templateId: string;
        templateVersion: string;
        migrationReason: string;
    };
}

interface ClonePlanRequest {
    idempotencyKey: string;
    sourcePlanId: string;
    title?: string;
    documentNo?: string;
    copyDrawings: boolean;
}

interface MigrateTemplateBindingRequest {
    planId: string;
    idempotencyKey: string;
    reason: string;
    expectedLockVersion?: number;
}

interface PlanMutationResponse {
    planId: string;
    seriesId: string;
    revisionNo: number;
    documentNo: string;
    idempotent: boolean;
}

interface ListPlansRequest {
    siteId?: string;
    statuses?: string[];
    search?: string;
    limit: number;
}

interface ListPlansResponse {
    plans: UnknownRecord[];
}

interface ReviewResponse {
    planId: string;
    status: string;
    lockVersion: number;
    approvedSnapshotId?: string;
    approvedSnapshotHash?: string;
    approvedSnapshotStoragePath?: string;
    approvedEvidenceId?: string;
    approvedEvidenceHash?: string;
    activeReviewSnapshotId?: string;
    activeReviewSnapshotHash?: string;
    activeReviewSnapshotStoragePath?: string;
    activeReviewSnapshotLockVersion?: number;
    activeReviewPackageId?: string;
    reviewCycleId?: string;
    reviewRound?: number;
    diffSummary?: UnknownRecord;
    idempotent?: boolean;
}

type ReviewCommentVisibility = 'participants' | 'reviewers_and_approvers' | 'central_only';
type ReviewCommentAction = 'address' | 'resolve' | 'reopen';

interface CreateReviewCommentRequest {
    requestId: string;
    planId: string;
    reviewPackageId?: string;
    anchor: UnknownRecord;
    visibility: ReviewCommentVisibility;
    required: boolean;
    body: string;
}

interface ReplyReviewCommentRequest {
    requestId: string;
    planId: string;
    commentId: string;
    body: string;
}

interface TransitionReviewCommentRequest {
    requestId: string;
    planId: string;
    commentId: string;
    action: ReviewCommentAction;
    expectedVersion: number;
    reason?: string;
}

interface ListReviewCommentsRequest {
    planId: string;
    reviewPackageId?: string;
}

interface ListReviewMessagesRequest {
    planId: string;
    commentId: string;
}

interface IssueResponse {
    planId: string;
    jobId: string;
    status: 'issued';
    issuedExportId: string;
    storagePath: string;
    storageGeneration: string;
    sha256: string;
    pageCount: number;
    sizeBytes: number;
    fileName?: string;
    provenance: ServerPdfProvenanceResponse;
    idempotent?: boolean;
}

const db = () => admin.firestore();
const bucket = () => admin.storage().bucket();

const asCallableRecord = (data: unknown): UnknownRecord => {
    if (!isUnknownRecord(data)) {
        throw new functions.https.HttpsError('invalid-argument', '요청 본문이 올바르지 않습니다.');
    }
    return data;
};

const requireString = (record: UnknownRecord, key: string, maxLength = 500): string => {
    const value = record[key];
    if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
        throw new functions.https.HttpsError('invalid-argument', `${key} 값이 올바르지 않습니다.`);
    }
    return value.trim();
};

const readOptionalString = (record: UnknownRecord, key: string, maxLength = 2000): string | undefined => {
    const value = record[key];
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value !== 'string' || value.trim().length > maxLength) {
        throw new functions.https.HttpsError('invalid-argument', `${key} 값이 올바르지 않습니다.`);
    }
    return value.trim() || undefined;
};

const requireDocumentId = (record: UnknownRecord, key: string): string => {
    const value = requireString(record, key, 200);
    if (value.includes('/') || value === '.' || value === '..') {
        throw new functions.https.HttpsError('invalid-argument', `${key} 문서 ID가 올바르지 않습니다.`);
    }
    return value;
};

const readExpectedLockVersion = (record: UnknownRecord): number | undefined => {
    if (record.expectedLockVersion === undefined) return undefined;
    if (!Number.isInteger(record.expectedLockVersion) || Number(record.expectedLockVersion) < 0) {
        throw new functions.https.HttpsError('invalid-argument', 'expectedLockVersion 값이 올바르지 않습니다.');
    }
    return Number(record.expectedLockVersion);
};

const resolveCallableActor = async (context: functions.https.CallableContext): Promise<CallableActor> => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    const token = isUnknownRecord(context.auth.token) ? context.auth.token : {};
    const profileSnapshot = await db().collection('users').doc(context.auth.uid).get();
    const profile = profileSnapshot.exists && isUnknownRecord(profileSnapshot.data())
        ? profileSnapshot.data() as UnknownRecord
        : {};
    const roleFields = ['role', 'position', 'systemRole', 'accountType', 'roles', 'additionalPositions', 'erpRoleGroups'];
    const roleValues = roleFields.flatMap((key) => [token[key], profile[key]]);
    return {
        uid: context.auth.uid,
        access: classifyConstructionPlanRoleAccess(roleValues),
        profile,
        token,
    };
};

const requireDirectoryAccess = (actor: CallableActor): void => {
    if (!actor.access.canUseDirectory) {
        throw new functions.https.HttpsError('permission-denied', '시공계획서 작업자 디렉터리 권한이 없습니다.');
    }
};

const requireReviewAccess = (actor: CallableActor, action: ConstructionPlanReviewAction): void => {
    if (action === 'submit_review') {
        if (!actor.access.canSubmitReview) {
            throw new functions.https.HttpsError('permission-denied', '검토 요청 권한이 없습니다.');
        }
        return;
    }
    if (!actor.access.canReviewApproveIssue) {
        throw new functions.https.HttpsError('permission-denied', '본사 또는 관리자 검토 권한이 필요합니다.');
    }
};

const requireIssueAccess = (actor: CallableActor): void => {
    if (!actor.access.canReviewApproveIssue) {
        throw new functions.https.HttpsError('permission-denied', '본사 또는 관리자 발행 권한이 필요합니다.');
    }
};

const requirePlanMutationAccess = (actor: CallableActor): void => {
    if (!actor.access.canSubmitReview) {
        throw new functions.https.HttpsError('permission-denied', '시공계획서 생성 권한이 없습니다.');
    }
};

const stringList = (value: unknown): string[] => {
    if (Array.isArray(value)) return value.flatMap(stringList);
    if (typeof value !== 'string' || !value.trim()) return [];
    return [value.trim()];
};

const collectScopedIds = (record: UnknownRecord, keys: readonly string[]): Set<string> =>
    new Set(keys.flatMap((key) => stringList(record[key])));

const loadActorLinkedWorkers = async (actor: CallableActor): Promise<UnknownRecord[]> => {
    const linkedWorkerIds = Array.from(new Set([
        ...collectScopedIds(actor.profile, ['linkedWorkerId', 'linkedWorkerIds', 'workerId', 'workerIds']),
        ...collectScopedIds(actor.token, ['linkedWorkerId', 'linkedWorkerIds', 'workerId', 'workerIds']),
    ])).slice(0, 50);
    const [uidSnapshot, linkedSnapshots] = await Promise.all([
        db().collection(WORKERS_COLLECTION).where('uid', '==', actor.uid).limit(10).get(),
        Promise.all(linkedWorkerIds.map((workerId) => (
            db().collection(WORKERS_COLLECTION).doc(workerId).get()
        ))),
    ]);
    const workersById = new Map<string, UnknownRecord>();
    uidSnapshot.docs.forEach((document) => {
        const value = document.data();
        if (isUnknownRecord(value)) workersById.set(document.id, { ...value, id: document.id });
    });
    linkedSnapshots.forEach((snapshot) => {
        const value = snapshot.data();
        if (snapshot.exists && isUnknownRecord(value)) workersById.set(snapshot.id, { ...value, id: snapshot.id });
    });
    return Array.from(workersById.values());
};

const assertSiteActorScope = async (
    actor: CallableActor,
    siteId: string,
    responsibleTeamId: string | undefined,
    site: UnknownRecord,
): Promise<void> => {
    if (actor.access.isAdmin || actor.access.isOffice) return;

    const workers = await loadActorLinkedWorkers(actor);
    const siteIds = new Set([
        ...collectScopedIds(actor.profile, ['siteId', 'siteIds', 'assignedSiteIds']),
        ...collectScopedIds(actor.token, ['siteId', 'siteIds', 'assignedSiteIds']),
        ...workers.flatMap((worker) => Array.from(collectScopedIds(worker, ['siteId', 'siteIds', 'assignedSiteIds']))),
    ]);
    const teamIds = new Set([
        ...collectScopedIds(actor.profile, ['teamId', 'teamIds', 'assignedTeamIds']),
        ...collectScopedIds(actor.token, ['teamId', 'teamIds', 'assignedTeamIds']),
        ...workers.flatMap((worker) => Array.from(collectScopedIds(worker, ['teamId', 'teamIds', 'assignedTeamIds']))),
    ]);
    const linkedWorkerIds = new Set([
        ...collectScopedIds(actor.profile, ['linkedWorkerId', 'linkedWorkerIds', 'workerId', 'workerIds']),
        ...collectScopedIds(actor.token, ['linkedWorkerId', 'linkedWorkerIds', 'workerId', 'workerIds']),
        ...workers.flatMap((worker) => Array.from(collectScopedIds(worker, ['id']))),
    ]);
    const siteManagerIds = collectScopedIds(site, [
        'managerId', 'managerUid', 'siteManagerId', 'siteManagerUid',
        'responsibleManagerId', 'responsibleManagerUid', 'managerIds', 'managerUids',
    ]);

    if (siteIds.has(siteId)
        || (responsibleTeamId && teamIds.has(responsibleTeamId))
        || siteManagerIds.has(actor.uid)
        || Array.from(linkedWorkerIds).some((workerId) => siteManagerIds.has(workerId))) {
        return;
    }
    throw new functions.https.HttpsError('permission-denied', '요청한 현장 또는 담당팀의 작업자 조회 권한이 없습니다.');
};

const loadAuthorizedSite = async (actor: CallableActor, siteId: string): Promise<UnknownRecord> => {
    const siteSnapshot = await db().collection(SITES_COLLECTION).doc(siteId).get();
    if (!siteSnapshot.exists || !isUnknownRecord(siteSnapshot.data())) {
        throw new functions.https.HttpsError('not-found', '현장을 찾을 수 없습니다.');
    }
    const site = siteSnapshot.data() as UnknownRecord;
    await assertSiteActorScope(actor, siteId, readTrimmedString(site, ['responsibleTeamId']), site);
    return site;
};

const loadSafeWorkerDirectoryForSite = async (
    siteId: string,
    responsibleTeamId: string | undefined,
    includeInactive = false,
    trustedWorkerIds: readonly string[] = [],
): Promise<SafeWorkerDirectoryEntry[]> => {
    const queries: Array<Promise<admin.firestore.QuerySnapshot>> = [
        db().collection(WORKERS_COLLECTION)
            .where('siteId', '==', siteId)
            .limit(MAX_WORKER_RESULTS)
            .get(),
    ];
    if (responsibleTeamId) {
        queries.push(db().collection(WORKERS_COLLECTION)
            .where('teamId', '==', responsibleTeamId)
            .limit(MAX_WORKER_RESULTS)
            .get());
    }
    const [snapshots, trustedWorkerSnapshots] = await Promise.all([
        Promise.all(queries),
        Promise.all(Array.from(new Set(trustedWorkerIds)).slice(0, 50).map((workerId) => (
            db().collection(WORKERS_COLLECTION).doc(workerId).get()
        ))),
    ]);
    const workersById = new Map<string, SafeWorkerDirectoryEntry>();
    snapshots.forEach((snapshot) => snapshot.docs.forEach((document) => {
        const entry = projectSafeWorkerDirectoryEntry(document.data(), document.id);
        if (!entry || (!includeInactive && entry.status !== 'active')) return;
        if (!workersById.has(entry.id)) workersById.set(entry.id, entry);
    }));
    trustedWorkerSnapshots.forEach((document) => {
        if (!document.exists) return;
        const entry = projectSafeWorkerDirectoryEntry(document.data(), document.id);
        if (!entry || (!includeInactive && entry.status !== 'active')) return;
        if (!workersById.has(entry.id)) workersById.set(entry.id, entry);
    });
    return Array.from(workersById.values())
        .sort((left, right) => left.name.localeCompare(right.name, 'ko-KR'))
        .slice(0, MAX_WORKER_RESULTS);
};

const loadConstructionPlanLinkedMaster = async (
    collectionName: typeof COMPANIES_COLLECTION | typeof TEAMS_COLLECTION,
    id: string | undefined,
): Promise<UnknownRecord | undefined> => {
    if (!id) return undefined;
    if (id.length > 200 || id.includes('/') || id === '.' || id === '..') {
        throw new functions.https.HttpsError(
            'failed-precondition',
            `현장에 연결된 ${collectionName} 마스터 ID가 올바르지 않습니다.`,
        );
    }
    const snapshot = await db().collection(collectionName).doc(id).get();
    if (!snapshot.exists || !isUnknownRecord(snapshot.data())) return undefined;
    const normalized = callableFirestoreValue(snapshot.data());
    return isUnknownRecord(normalized) ? { ...normalized, id: snapshot.id } : undefined;
};

const callablePlanDocument = (snapshot: admin.firestore.DocumentSnapshot): UnknownRecord => {
    const value = planData(snapshot);
    const normalized = callableFirestoreValue(value);
    if (!isUnknownRecord(normalized)) {
        throw new functions.https.HttpsError('data-loss', '시공계획서 데이터가 손상되었습니다.');
    }
    return { ...normalized, id: snapshot.id };
};

const parseReviewRequest = (data: unknown): ReviewRequest => {
    const record = asCallableRecord(data);
    const action = requireString(record, 'action', 40) as ConstructionPlanReviewAction;
    if (!['submit_review', 'request_changes', 'complete_review', 'approve'].includes(action)) {
        throw new functions.https.HttpsError('invalid-argument', '지원하지 않는 검토 단계입니다.');
    }
    const reason = readOptionalString(record, 'reason');
    const idempotencyKey = readOptionalString(record, 'idempotencyKey', 128);
    return {
        planId: requireDocumentId(record, 'planId'),
        action,
        reason,
        expectedLockVersion: readExpectedLockVersion(record),
        ...(idempotencyKey ? { idempotencyKey } : {}),
    };
};

const requireRequestId = (record: UnknownRecord): string => requireString(record, 'requestId', 128);

const parseReviewCommentAnchor = (value: unknown): UnknownRecord => {
    if (!isUnknownRecord(value)) {
        throw new functions.https.HttpsError('invalid-argument', '댓글 anchor가 올바르지 않습니다.');
    }
    const kind = requireString(value, 'kind', 40);
    if (kind === 'plan') return { kind };
    if (kind === 'section') {
        return { kind, sectionId: requireDocumentId(value, 'sectionId') };
    }
    if (kind === 'field') {
        const entityType = requireString(value, 'entityType', 80);
        if (![
            'plan', 'section', 'engineering_value', 'equipment_item',
            'risk_assessment', 'organization_assignment',
        ].includes(entityType)) {
            throw new functions.https.HttpsError('invalid-argument', 'field entityType이 올바르지 않습니다.');
        }
        const jsonPointer = requireString(value, 'jsonPointer', 500);
        if (!jsonPointer.startsWith('/')
            || /(?:^|\/)(?:__proto__|prototype|constructor)(?:\/|$)/.test(jsonPointer)) {
            throw new functions.https.HttpsError('invalid-argument', 'field jsonPointer가 올바르지 않습니다.');
        }
        return {
            kind,
            entityType,
            entityId: requireString(value, 'entityId', 200),
            jsonPointer,
        };
    }
    if (kind === 'drawing') {
        const pageIndex = value.pageIndex;
        if (!Number.isInteger(pageIndex) || Number(pageIndex) < 0) {
            throw new functions.https.HttpsError('invalid-argument', 'drawing pageIndex가 올바르지 않습니다.');
        }
        const hasX = value.x !== undefined;
        const hasY = value.y !== undefined;
        if (hasX !== hasY
            || (hasX && !isNormalizedConstructionPlanReviewCoordinate(value.x))
            || (hasY && !isNormalizedConstructionPlanReviewCoordinate(value.y))) {
            throw new functions.https.HttpsError('invalid-argument', 'drawing anchor 좌표가 올바르지 않습니다.');
        }
        const annotationId = readOptionalString(value, 'annotationId', 200);
        return {
            kind,
            drawingId: requireDocumentId(value, 'drawingId'),
            pageIndex: Number(pageIndex),
            pageFingerprint: requireString(value, 'pageFingerprint', 256),
            ...(annotationId ? { annotationId } : {}),
            ...(hasX ? { x: value.x, y: value.y } : {}),
        };
    }
    throw new functions.https.HttpsError('invalid-argument', '지원하지 않는 댓글 anchor입니다.');
};

const parseCreateReviewCommentRequest = (data: unknown): CreateReviewCommentRequest => {
    const record = asCallableRecord(data);
    const visibility = requireString(record, 'visibility', 60) as ReviewCommentVisibility;
    if (!['participants', 'reviewers_and_approvers', 'central_only'].includes(visibility)) {
        throw new functions.https.HttpsError('invalid-argument', '댓글 visibility가 올바르지 않습니다.');
    }
    if (typeof record.required !== 'boolean') {
        throw new functions.https.HttpsError('invalid-argument', '댓글 required 값이 올바르지 않습니다.');
    }
    if (!isConstructionPlanRequiredCommentVisibilityAllowed(record.required, visibility)) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            '필수 의견은 모든 계획서 참여자가 볼 수 있어야 합니다.',
        );
    }
    return {
        requestId: requireRequestId(record),
        planId: requireDocumentId(record, 'planId'),
        ...(readOptionalString(record, 'reviewPackageId', 200)
            ? { reviewPackageId: requireDocumentId(record, 'reviewPackageId') }
            : {}),
        anchor: parseReviewCommentAnchor(record.anchor),
        visibility,
        required: record.required,
        body: requireString(record, 'body', 10000),
    };
};

const parseReplyReviewCommentRequest = (data: unknown): ReplyReviewCommentRequest => {
    const record = asCallableRecord(data);
    return {
        requestId: requireRequestId(record),
        planId: requireDocumentId(record, 'planId'),
        commentId: requireDocumentId(record, 'commentId'),
        body: requireString(record, 'body', 10000),
    };
};

const parseTransitionReviewCommentRequest = (data: unknown): TransitionReviewCommentRequest => {
    const record = asCallableRecord(data);
    const action = requireString(record, 'action', 40) as ReviewCommentAction;
    if (!['address', 'resolve', 'reopen'].includes(action)) {
        throw new functions.https.HttpsError('invalid-argument', '댓글 상태 action이 올바르지 않습니다.');
    }
    if (!Number.isInteger(record.expectedVersion) || Number(record.expectedVersion) < 0) {
        throw new functions.https.HttpsError('invalid-argument', 'expectedVersion 값이 올바르지 않습니다.');
    }
    return {
        requestId: requireRequestId(record),
        planId: requireDocumentId(record, 'planId'),
        commentId: requireDocumentId(record, 'commentId'),
        action,
        expectedVersion: Number(record.expectedVersion),
        reason: readOptionalString(record, 'reason', 2000),
    };
};

const parseListReviewCommentsRequest = (data: unknown): ListReviewCommentsRequest => {
    const record = asCallableRecord(data);
    return {
        planId: requireDocumentId(record, 'planId'),
        ...(readOptionalString(record, 'reviewPackageId', 200)
            ? { reviewPackageId: requireDocumentId(record, 'reviewPackageId') }
            : {}),
    };
};

const parseListReviewMessagesRequest = (data: unknown): ListReviewMessagesRequest => {
    const record = asCallableRecord(data);
    return {
        planId: requireDocumentId(record, 'planId'),
        commentId: requireDocumentId(record, 'commentId'),
    };
};

const assertNoClientPdfInput = (record: UnknownRecord): void => {
    const forbidden = ['storagePath', 'expectedSha256', 'bytes', 'candidatePdf', 'pdf'];
    const supplied = forbidden.find((key) => record[key] !== undefined);
    if (supplied) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            `${supplied} 클라이언트 PDF 입력은 서버 권위 발행에서 허용되지 않습니다.`,
        );
    }
};

const assertExactServerPdfRequestKeys = (
    record: UnknownRecord,
    allowedKeys: readonly string[],
): void => {
    const allowed = new Set(allowedKeys);
    const unexpected = Object.keys(record).find((key) => !allowed.has(key));
    if (unexpected) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            `${unexpected} 값은 서버 권위 PDF 요청 계약에 포함되지 않습니다.`,
        );
    }
};

const parseApprovedSnapshotHash = (record: UnknownRecord): string => {
    const approvedSnapshotHash = requireString(record, 'approvedSnapshotHash', 64).toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(approvedSnapshotHash)) {
        throw new functions.https.HttpsError('invalid-argument', 'approvedSnapshotHash 값이 올바르지 않습니다.');
    }
    return approvedSnapshotHash;
};

export const parsePrepareIssuedPdfRequest = (data: unknown): PrepareIssuedPdfRequest => {
    const record = asCallableRecord(data);
    assertNoClientPdfInput(record);
    assertExactServerPdfRequestKeys(record, ['planId', 'approvedSnapshotHash']);
    return {
        planId: requireDocumentId(record, 'planId'),
        approvedSnapshotHash: parseApprovedSnapshotHash(record),
    };
};

export const parseIssueRequest = (data: unknown): IssueRequest => {
    const record = asCallableRecord(data);
    assertNoClientPdfInput(record);
    assertExactServerPdfRequestKeys(record, [
        'planId', 'jobId', 'expectedCandidateSha256', 'approvedSnapshotHash', 'visualCheckConfirmed',
    ]);
    const expectedCandidateSha256 = requireString(record, 'expectedCandidateSha256', 64).toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(expectedCandidateSha256)) {
        throw new functions.https.HttpsError('invalid-argument', 'expectedCandidateSha256 값이 올바르지 않습니다.');
    }
    if (record.visualCheckConfirmed !== true) {
        throw new functions.https.HttpsError('failed-precondition', '발행 전 육안 검수 확인이 필요합니다.');
    }
    return {
        planId: requireDocumentId(record, 'planId'),
        jobId: requireDocumentId(record, 'jobId'),
        expectedCandidateSha256,
        approvedSnapshotHash: parseApprovedSnapshotHash(record),
        visualCheckConfirmed: true,
    };
};

const rejectServerOwnedPlanFields = (record: UnknownRecord): void => {
    const forbidden = [
        'id', 'createdBy', 'createdByName', 'status', 'revision', 'seriesId',
        'lineageRootPlanId', 'rendererVersion', 'schemaVersion', 'lockVersion',
        'approvedSnapshotId', 'approvedSnapshotHash', 'issuedExportId',
        'templateBinding', 'templateHash', 'manifestHash', 'templateBundleHash',
        'templateBindingHash', 'templateMigration',
    ];
    const supplied = forbidden.find((key) => record[key] !== undefined);
    if (supplied) {
        throw new functions.https.HttpsError('invalid-argument', `${supplied} 값은 서버가 관리합니다.`);
    }
};

const requireIdempotencyKey = (record: UnknownRecord): string =>
    requireString(record, 'idempotencyKey', 128);

const readOptionalRecord = (record: UnknownRecord, key: string): UnknownRecord | undefined => {
    const value = record[key];
    if (value === undefined || value === null) return undefined;
    if (!isUnknownRecord(value)) {
        throw new functions.https.HttpsError('invalid-argument', `${key} 값이 올바르지 않습니다.`);
    }
    return value;
};

const assertOptionalBoolean = (record: UnknownRecord, key: string): void => {
    if (record[key] !== undefined && typeof record[key] !== 'boolean') {
        throw new functions.https.HttpsError('invalid-argument', `${key} 값이 올바르지 않습니다.`);
    }
};

const resolveSupportedTemplateRequest = (record: UnknownRecord) => {
    const tradeType = requireString(record, 'tradeType', 80);
    const templateId = requireString(record, 'templateId', 120);
    const templateVersion = requireString(record, 'templateVersion', 120);
    try {
        return resolveConstructionPlanServerTemplate({ tradeType, templateId, templateVersion });
    } catch {
        throw new functions.https.HttpsError(
            'failed-precondition',
            '공종과 템플릿 ID·버전의 조합을 현재 서버에서 지원하지 않습니다.',
        );
    }
};

const parseCreateDraftRequest = (data: unknown): CreateDraftRequest => {
    const record = asCallableRecord(data);
    rejectServerOwnedPlanFields(record);
    const contract = resolveSupportedTemplateRequest(record);
    const documentDate = readOptionalString(record, 'documentDate', 20);
    if (documentDate && !/^\d{4}-\d{2}-\d{2}$/.test(documentDate)) {
        throw new functions.https.HttpsError('invalid-argument', 'documentDate 값이 올바르지 않습니다.');
    }
    const manifestSectionKeys = Array.from(new Set(contract.pages.map((page) => page.sectionKey)));
    const rawSelectedSectionKeys = record.selectedSectionKeys;
    if (rawSelectedSectionKeys !== undefined && (!Array.isArray(rawSelectedSectionKeys)
        || rawSelectedSectionKeys.length < 4
        || rawSelectedSectionKeys.some((value) => typeof value !== 'string' || !value.trim()))) {
        throw new functions.https.HttpsError('invalid-argument', '선택 목차 값이 올바르지 않습니다.');
    }
    const requestedValues = Array.isArray(rawSelectedSectionKeys)
        ? rawSelectedSectionKeys.map((value) => String(value).trim())
        : manifestSectionKeys;
    const requestedSectionKeys = new Set(requestedValues);
    const coreSectionKeys = ['cover', 'document-control', 'toc', 'project-overview'];
    if (requestedSectionKeys.size !== requestedValues.length
        || Array.from(requestedSectionKeys).some((key) => !manifestSectionKeys.includes(key))
        || coreSectionKeys.some((key) => !requestedSectionKeys.has(key))) {
        throw new functions.https.HttpsError('invalid-argument', '선택 목차에 필수 또는 지원되지 않는 항목이 있습니다.');
    }
    const selectedSectionKeys = manifestSectionKeys.filter((key) => requestedSectionKeys.has(key));
    return {
        idempotencyKey: requireIdempotencyKey(record),
        siteId: requireDocumentId(record, 'siteId'),
        siteName: readOptionalString(record, 'siteName', 200),
        title: requireString(record, 'title', 240),
        tradeType: contract.tradeType,
        templateId: contract.templateId,
        templateVersion: contract.templateVersion,
        documentNo: requireString(record, 'documentNo', 160),
        documentDate,
        projectSnapshot: readOptionalRecord(record, 'projectSnapshot'),
        organizationSnapshot: readOptionalRecord(record, 'organizationSnapshot'),
        participants: readOptionalRecord(record, 'participants'),
        selectedSectionKeys,
    };
};

const REVISION_TYPES: readonly ConstructionPlanRevisionType[] = [
    'design_change', 'site_condition', 'method_change', 'schedule_change',
    'safety_improvement', 'other',
];

const parseCreateRevisionRequest = (data: unknown): CreateRevisionRequest => {
    const record = asCallableRecord(data);
    const revisionReason = requireString(record, 'revisionReason', 2000);
    if (revisionReason.length < 5) {
        throw new functions.https.HttpsError('invalid-argument', '개정 사유는 5자 이상 입력해야 합니다.');
    }
    const revisionType = requireString(record, 'revisionType', 80) as ConstructionPlanRevisionType;
    if (!REVISION_TYPES.includes(revisionType)) {
        throw new functions.https.HttpsError('invalid-argument', 'revisionType 값이 올바르지 않습니다.');
    }
    assertOptionalBoolean(record, 'copyDrawings');
    const rawTargetTemplate = readOptionalRecord(record, 'targetTemplate');
    let targetTemplate: CreateRevisionRequest['targetTemplate'];
    if (rawTargetTemplate) {
        const allowedTargetKeys = new Set([
            'tradeType', 'templateId', 'templateVersion', 'migrationReason',
        ]);
        if (Object.keys(rawTargetTemplate).some((key) => !allowedTargetKeys.has(key))) {
            throw new functions.https.HttpsError('invalid-argument', 'targetTemplate 요청 계약이 올바르지 않습니다.');
        }
        const contract = resolveSupportedTemplateRequest(rawTargetTemplate);
        const migrationReason = requireString(rawTargetTemplate, 'migrationReason', 2000);
        if (migrationReason.length < 10) {
            throw new functions.https.HttpsError('invalid-argument', '템플릿 변경 사유는 10자 이상 입력해야 합니다.');
        }
        targetTemplate = {
            tradeType: contract.tradeType,
            templateId: contract.templateId,
            templateVersion: contract.templateVersion,
            migrationReason,
        };
    }
    return {
        idempotencyKey: requireIdempotencyKey(record),
        sourcePlanId: requireDocumentId(record, 'sourcePlanId'),
        revisionReason,
        revisionType,
        copyDrawings: record.copyDrawings !== false,
        ...(targetTemplate ? { targetTemplate } : {}),
    };
};

const parseClonePlanRequest = (data: unknown): ClonePlanRequest => {
    const record = asCallableRecord(data);
    if (record.targetSiteId !== undefined || record.retainOrganization !== undefined) {
        throw new functions.https.HttpsError('invalid-argument', '복제는 동일 현장에서만 가능하며 조직 배정은 승계하지 않습니다.');
    }
    assertOptionalBoolean(record, 'copyDrawings');
    return {
        idempotencyKey: requireIdempotencyKey(record),
        sourcePlanId: requireDocumentId(record, 'sourcePlanId'),
        title: readOptionalString(record, 'title', 240),
        documentNo: readOptionalString(record, 'documentNo', 160),
        copyDrawings: record.copyDrawings === true,
    };
};

const parseMigrateTemplateBindingRequest = (data: unknown): MigrateTemplateBindingRequest => {
    const record = asCallableRecord(data);
    assertExactServerPdfRequestKeys(record, [
        'planId', 'idempotencyKey', 'reason', 'expectedLockVersion',
    ]);
    const reason = requireString(record, 'reason', 500);
    if (reason.length < 10) {
        throw new functions.https.HttpsError('invalid-argument', '템플릿 바인딩 마이그레이션 사유는 10자 이상 입력해야 합니다.');
    }
    return {
        planId: requireDocumentId(record, 'planId'),
        idempotencyKey: requireIdempotencyKey(record),
        reason,
        expectedLockVersion: readExpectedLockVersion(record),
    };
};

const PLAN_STATUSES = new Set([
    'draft', 'in_review', 'changes_requested', 'review_completed',
    'approved_pending_issue', 'issued', 'superseded', 'archived', 'void',
]);

const parseListPlansRequest = (data: unknown): ListPlansRequest => {
    const record = asCallableRecord(data);
    const siteId = record.siteId === undefined
        ? undefined
        : requireDocumentId(record, 'siteId');
    let statuses: string[] | undefined;
    if (record.statuses !== undefined) {
        if (!Array.isArray(record.statuses) || record.statuses.length > PLAN_STATUSES.size) {
            throw new functions.https.HttpsError('invalid-argument', 'statuses 값이 올바르지 않습니다.');
        }
        statuses = Array.from(new Set(record.statuses.map((status) => {
            if (typeof status !== 'string' || !PLAN_STATUSES.has(status)) {
                throw new functions.https.HttpsError('invalid-argument', 'statuses 값이 올바르지 않습니다.');
            }
            return status;
        })));
    }
    const limit = record.limit === undefined ? DEFAULT_PLAN_LIST_LIMIT : Number(record.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PLAN_LIST_RESULTS) {
        throw new functions.https.HttpsError('invalid-argument', 'limit 값이 올바르지 않습니다.');
    }
    return {
        ...(siteId ? { siteId } : {}),
        ...(statuses ? { statuses } : {}),
        ...(readOptionalString(record, 'search', 240) ? { search: readOptionalString(record, 'search', 240) } : {}),
        limit,
    };
};

const planData = (snapshot: admin.firestore.DocumentSnapshot): UnknownRecord => {
    if (!snapshot.exists || !isUnknownRecord(snapshot.data())) {
        throw new functions.https.HttpsError('not-found', '시공계획서를 찾을 수 없습니다.');
    }
    return snapshot.data() as UnknownRecord;
};

const actorNameSnapshot = (actor: CallableActor): string | undefined =>
    readTrimmedString(actor.profile, ['name', 'displayName'])
    || readTrimmedString(actor.token, ['name']);

const mutationClaimRef = (
    actorId: string,
    operation: string,
    idempotencyKey: string,
): admin.firestore.DocumentReference => {
    const claimId = buildConstructionPlanMutationClaimId(actorId, operation, idempotencyKey);
    return db().collection(MUTATION_KEYS_COLLECTION).doc(claimId);
};

const mutationRequestFingerprint = <T extends { idempotencyKey: string }>(
    actorId: string,
    operation: string,
    request: T,
): string => {
    const { idempotencyKey: _idempotencyKey, ...payload } = request;
    return sha256Hex(canonicalStringify({ actorId, operation, payload }));
};

const readMutationClaimResponse = (
    snapshot: admin.firestore.DocumentSnapshot,
    operation: string,
    requestFingerprint: string,
): PlanMutationResponse | null => {
    if (!snapshot.exists) return null;
    try {
        return resolveConstructionPlanMutationClaim(snapshot.data(), operation, requestFingerprint);
    } catch (error) {
        const code = error instanceof Error ? error.message : '';
        if (code === 'construction-plan-mutation-claim-conflict') {
            throw new functions.https.HttpsError(
                'already-exists',
                '같은 idempotencyKey가 다른 요청에 이미 사용되었습니다.',
            );
        }
        if (code === 'construction-plan-mutation-claim-response-corrupt') {
            throw new functions.https.HttpsError('data-loss', '멱등성 응답 기록이 손상되었습니다.');
        }
        throw new functions.https.HttpsError('data-loss', '멱등성 처리 기록이 손상되었습니다.');
    }
};

const createMutationClaim = (
    transaction: admin.firestore.Transaction,
    claimRef: admin.firestore.DocumentReference,
    actorId: string,
    operation: string,
    requestFingerprint: string,
    response: PlanMutationResponse,
    timestamp: string,
): void => {
    transaction.create(claimRef, {
        operation,
        actorId,
        requestFingerprint,
        response: { ...response, idempotent: false },
        createdAt: timestamp,
    });
};

const assertSeriesIdentity = (
    rawSeries: unknown,
    expected: ReturnType<typeof buildConstructionPlanSeriesIdentity>,
    siteId: string,
    tradeType: ConstructionPlanTradeType,
): UnknownRecord => {
    if (!isUnknownRecord(rawSeries)) {
        throw new functions.https.HttpsError('data-loss', '시공계획서 시리즈 정보가 손상되었습니다.');
    }
    if (rawSeries.siteId !== siteId
        || rawSeries.documentNoKey !== expected.documentNoKey
        || rawSeries.tradeType !== tradeType) {
        throw new functions.https.HttpsError('data-loss', '시공계획서 시리즈 식별자가 문서 정보와 일치하지 않습니다.');
    }
    return rawSeries;
};

const legacyPlanCollisionQuery = (siteId: string): admin.firestore.Query => db()
    .collection(PLANS_COLLECTION)
    .where('siteId', '==', siteId)
    .select('siteId', 'documentNo', 'seriesId')
    .limit(MAX_LEGACY_PLAN_COLLISION_SCAN + 1);

const assertNoLegacyPlanDocumentNoCollision = (
    snapshot: admin.firestore.QuerySnapshot,
    siteId: string,
    identity: ReturnType<typeof buildConstructionPlanSeriesIdentity>,
    allowedPlanIds: readonly string[] = [],
): void => {
    if (snapshot.size > MAX_LEGACY_PLAN_COLLISION_SCAN) {
        throw new functions.https.HttpsError(
            'failed-precondition',
            '기존 시공계획서가 많아 문서번호 중복을 안전하게 확인할 수 없습니다. 계보 마이그레이션 후 다시 시도해주세요.',
        );
    }
    const collisions = findLegacyConstructionPlanDocumentNoCollisions(
        snapshot.docs.map((document) => ({ ...document.data(), id: document.id })),
        siteId,
        identity,
        allowedPlanIds,
    );
    if (collisions.length > 0) {
        throw new functions.https.HttpsError(
            'already-exists',
            '같은 현장과 문서번호의 기존 시공계획서가 있습니다.',
            { collisionPlanIds: collisions.slice(0, 10) },
        );
    }
};

const buildSeriesDocument = (
    identity: ReturnType<typeof buildConstructionPlanSeriesIdentity>,
    siteId: string,
    latestRevisionNo: number,
    latestPlanId: string,
    latestIssuedPlanId: string | null,
    actorId: string,
    timestamp: string,
    tradeType: ConstructionPlanTradeType,
    templateBinding: ConstructionPlanTemplateBinding,
): UnknownRecord => ({
    id: identity.seriesId,
    siteId,
    documentNo: identity.documentNo,
    documentNoKey: identity.documentNoKey,
    tradeType,
    templateBinding,
    ...constructionPlanTemplateBindingProjection(templateBinding),
    latestRevisionNo,
    latestPlanId,
    ...(latestIssuedPlanId ? { latestIssuedPlanId } : {}),
    createdBy: actorId,
    createdAt: timestamp,
    updatedBy: actorId,
    updatedAt: timestamp,
});

const bindConstructionPlanTemplate = (
    plan: UnknownRecord,
    templateBinding: ConstructionPlanTemplateBinding,
): UnknownRecord => ({
    ...plan,
    templateBinding,
    ...constructionPlanTemplateBindingProjection(templateBinding),
});

const templateBindingAuditMetadata = (
    templateBinding: ConstructionPlanTemplateBinding,
): UnknownRecord => ({
    templateBinding,
    ...constructionPlanTemplateBindingProjection(templateBinding),
});

const boundTemplateContextForPlan = (plan: UnknownRecord) => {
    const binding = assertConstructionPlanTemplateBindingMatchesPlanIdentity(
        plan.templateBinding,
        plan,
    );
    const identity = {
        tradeType: binding.tradeType,
        templateId: binding.templateId,
        templateVersion: binding.templateVersion,
    };
    return {
        binding,
        identity,
        reference: constructionPlanTemplateDocumentReferenceForIdentity(identity),
        projection: constructionPlanTemplateBindingProjection(binding),
    };
};

const assertBoundTemplateLifecycleSnapshot = (
    context: ReturnType<typeof boundTemplateContextForPlan>,
    snapshot: admin.firestore.DocumentSnapshot,
): ConstructionPlanTemplateBinding => {
    const record = assertConstructionPlanTemplateSnapshotForExistingPlan(
        context.identity,
        snapshot.exists ? snapshot.data() : undefined,
    );
    return assertConstructionPlanTemplateBindingMatchesRecord(context.binding, record);
};

const buildTemplateMigrationAudit = (input: {
    sourcePlanId: string;
    sourceBinding: ConstructionPlanTemplateBinding;
    targetBinding: ConstructionPlanTemplateBinding;
    reason: string;
    actorId: string;
    timestamp: string;
}): UnknownRecord => ({
    schemaVersion: 1,
    kind: 'template_revision_upgrade',
    sourcePlanId: input.sourcePlanId,
    sourceTemplate: {
        tradeType: input.sourceBinding.tradeType,
        templateId: input.sourceBinding.templateId,
        templateVersion: input.sourceBinding.templateVersion,
        ...constructionPlanTemplateBindingProjection(input.sourceBinding),
    },
    targetTemplate: {
        tradeType: input.targetBinding.tradeType,
        templateId: input.targetBinding.templateId,
        templateVersion: input.targetBinding.templateVersion,
        ...constructionPlanTemplateBindingProjection(input.targetBinding),
    },
    reason: input.reason,
    migratedBy: input.actorId,
    migratedAt: input.timestamp,
});

const toInvalidPlanInputError = (error: unknown): never => {
    if (error instanceof functions.https.HttpsError) throw error;
    functions.logger.warn('[constructionPlans] Invalid server plan builder input.', error);
    throw new functions.https.HttpsError('invalid-argument', '시공계획서 입력 데이터가 올바르지 않습니다.');
};

const currentLockVersion = (plan: UnknownRecord): number =>
    Number.isInteger(plan.lockVersion) && Number(plan.lockVersion) >= 0 ? Number(plan.lockVersion) : 0;

const sameCanonicalValue = (left: unknown, right: unknown): boolean =>
    canonicalStringify(left) === canonicalStringify(right);

const assertExpectedLockVersion = (plan: UnknownRecord, expected: number | undefined): void => {
    if (expected !== undefined && currentLockVersion(plan) !== expected) {
        throw new functions.https.HttpsError('aborted', '다른 사용자가 문서를 변경했습니다. 새로고침 후 다시 시도해주세요.');
    }
};

const assertReleaseValidation = (plan: UnknownRecord): void => {
    const validation = validateConstructionPlanForRelease(plan);
    if (!validation.valid) {
        throw new functions.https.HttpsError(
            'failed-precondition',
            '서버 발행 검증을 통과하지 못했습니다.',
            { issues: validation.issues.slice(0, 100) },
        );
    }
};

const isPlanAuthor = (plan: UnknownRecord, uid: string): boolean => {
    if (plan.createdBy === uid) return true;
    const participants = isUnknownRecord(plan.participants) ? plan.participants : {};
    return stringList(participants.authorIds).includes(uid);
};

const assertPlanParticipantAccess = (plan: UnknownRecord, actor: CallableActor): void => {
    if (actor.access.isAdmin || actor.access.isOffice || isConstructionPlanParticipant(plan, actor.uid)) return;
    throw new functions.https.HttpsError(
        'permission-denied',
        '이 시공계획서의 작성·검토·승인 참여자만 접근할 수 있습니다.',
    );
};

const assertDrawingPreviewMutationAccess = (plan: UnknownRecord, actor: CallableActor): void => {
    assertPlanParticipantAccess(plan, actor);
    assertConstructionPlanDrawingPreviewMutationPolicy(plan, {
        uid: actor.uid,
        isCentral: actor.access.isAdmin || actor.access.isOffice,
    });
};

const verifyAuthoritativeDrawingPreviewsForRelease = async (
    planId: string,
    plan: UnknownRecord,
): Promise<string> => {
    const verification = await assertAuthoritativeConstructionPlanDrawingPreviews({
        database: db(),
        storageBucket: bucket(),
        planId,
        plan,
    });
    return verification.bindingHash;
};

const assertApproverSeparation = (plan: UnknownRecord, actor: CallableActor): void => {
    if (isPlanAuthor(plan, actor.uid)) {
        throw new functions.https.HttpsError('permission-denied', '작성자는 같은 계획서를 승인할 수 없습니다.');
    }
};

const assertSiteSubmitter = (plan: UnknownRecord, actor: CallableActor): void => {
    if (actor.access.isAdmin || actor.access.isOffice || isPlanAuthor(plan, actor.uid)) return;
    throw new functions.https.HttpsError('permission-denied', '현장 권한 사용자는 자신이 작성한 계획서만 검토 요청할 수 있습니다.');
};

const assertTransitionStatus = (plan: UnknownRecord, action: ConstructionPlanReviewAction): string => {
    const status = readTrimmedString(plan, ['status']) || '';
    try {
        return transitionConstructionPlanReviewStatus(status, action);
    } catch (_error) {
        throw new functions.https.HttpsError(
            'failed-precondition',
            `${status || 'unknown'} 상태에서는 ${action} 단계를 수행할 수 없습니다.`,
        );
    }
};

const preconditionError = (error: unknown): boolean => {
    if (!isUnknownRecord(error)) return false;
    return error.code === 409 || error.code === 412 || error.code === '409' || error.code === '412';
};

const ensureImmutableStorageObject = async (
    storagePath: string,
    content: Buffer,
    contentType: string,
    expectedSha256: string,
    artifactClass = 'approved-snapshot',
): Promise<string> => {
    const file = bucket().file(storagePath);
    try {
        await file.save(content, {
            resumable: false,
            contentType,
            metadata: {
                contentType,
                cacheControl: 'private,max-age=31536000,immutable',
                metadata: { sha256: expectedSha256, artifactClass },
            },
            preconditionOpts: { ifGenerationMatch: 0 },
        });
    } catch (error) {
        if (!preconditionError(error)) throw error;
    }

    const [stored] = await file.download();
    if (sha256Hex(stored) !== expectedSha256) {
        throw new functions.https.HttpsError('data-loss', '불변 스냅샷 경로의 콘텐츠 해시가 일치하지 않습니다.');
    }
    const [metadata] = await file.getMetadata();
    return String(metadata.generation || '');
};

const summaryWithTimestamp = (raw: unknown, timestamp: string): UnknownRecord => ({
    ...normalizeConstructionPlanReviewCommentSummary(raw),
    updatedAt: timestamp,
});

const authoritativeReviewSummary = (raw: unknown): ReturnType<typeof normalizeConstructionPlanReviewCommentSummary> => {
    if (!isUnknownRecord(raw)) {
        throw new functions.https.HttpsError('data-loss', '검토 의견 집계가 없습니다.');
    }
    const keys = [
        'totalOpen', 'totalAddressed', 'totalResolved',
        'requiredOpen', 'requiredAddressed', 'requiredResolved', 'unresolvedRequired',
    ] as const;
    if (keys.some((key) => !Number.isInteger(raw[key]) || Number(raw[key]) < 0)) {
        throw new functions.https.HttpsError('data-loss', '검토 의견 집계가 손상되었습니다.');
    }
    const normalized = normalizeConstructionPlanReviewCommentSummary(raw);
    if (raw.unresolvedRequired !== normalized.unresolvedRequired) {
        throw new functions.https.HttpsError('data-loss', '필수 의견 집계가 일치하지 않습니다.');
    }
    return normalized;
};

const reviewCycleIdForPlan = (planId: string, plan: UnknownRecord): string => {
    const revision = Number.isInteger(plan.revision) ? Number(plan.revision) : 0;
    return `cycle-${sha256Hex(`${planId}:${revision}`).slice(0, 24)}`;
};

const reviewStoragePath = (planId: string, plan: UnknownRecord, contentHash: string): string => [
    'construction-plans',
    sanitizeConstructionPlanStorageSegment(readTrimmedString(plan, ['siteId']) || 'unknown-site', 'unknown-site'),
    sanitizeConstructionPlanStorageSegment(planId, 'unknown-plan'),
    'snapshots',
    `${contentHash}.json`,
].join('/');

const readImmutableSnapshotContent = async (storagePath: string, expectedHash: string): Promise<UnknownRecord> => {
    const [bytes] = await bucket().file(storagePath).download();
    if (sha256Hex(bytes) !== expectedHash) {
        throw new functions.https.HttpsError('data-loss', '검토 스냅샷 콘텐츠 해시가 일치하지 않습니다.');
    }
    try {
        const parsed: unknown = JSON.parse(bytes.toString('utf8'));
        if (!isUnknownRecord(parsed) || !isUnknownRecord(parsed.content)) throw new Error('invalid-envelope');
        return parsed;
    } catch (_error) {
        throw new functions.https.HttpsError('data-loss', '검토 스냅샷 JSON이 손상되었습니다.');
    }
};

const loadActiveReviewSnapshotContent = async (plan: UnknownRecord): Promise<UnknownRecord | undefined> => {
    const storagePath = readTrimmedString(plan, ['activeReviewSnapshotStoragePath']);
    const contentHash = readTrimmedString(plan, ['activeReviewSnapshotHash']);
    return storagePath && contentHash
        ? readImmutableSnapshotContent(storagePath, contentHash)
        : undefined;
};

const reviewClaimResponse = (
    snapshot: admin.firestore.DocumentSnapshot,
    operation: string,
    requestFingerprint: string,
): ReviewResponse | null => {
    if (!snapshot.exists) return null;
    try {
        const response = resolveConstructionPlanReviewMutationClaim(
            snapshot.data(),
            operation,
            requestFingerprint,
        );
        return response ? { ...(response as unknown as ReviewResponse), idempotent: true } : null;
    } catch (error) {
        if (error instanceof Error && error.message === 'construction-plan-review-claim-conflict') {
            throw new functions.https.HttpsError(
                'already-exists',
                '같은 idempotencyKey가 다른 검토 요청에 사용되었습니다.',
            );
        }
        throw new functions.https.HttpsError('data-loss', '검토 요청 멱등성 기록이 손상되었습니다.');
    }
};

const submitConstructionPlanReview = async (
    request: ReviewRequest,
    actor: CallableActor,
    expectedDrawingPreviewBindingHash: string,
): Promise<ReviewResponse> => {
    if (request.expectedLockVersion === undefined) {
        throw new functions.https.HttpsError('invalid-argument', '검토 제출에는 expectedLockVersion이 필요합니다.');
    }
    const effectiveKey = request.idempotencyKey || `lock-${request.expectedLockVersion}`;
    const operation = 'submit_review';
    const claimRef = mutationClaimRef(actor.uid, operation, `${request.planId}:${effectiveKey}`);
    const requestFingerprint = sha256Hex(canonicalStringify({
        actorId: actor.uid,
        operation,
        planId: request.planId,
        expectedLockVersion: request.expectedLockVersion,
        reason: request.reason || null,
    }));
    const earlyClaim = reviewClaimResponse(await claimRef.get(), operation, requestFingerprint);
    if (earlyClaim) return earlyClaim;

    const planRef = db().collection(PLANS_COLLECTION).doc(request.planId);
    const preflightPlan = planData(await planRef.get());
    const templateContext = boundTemplateContextForPlan(preflightPlan);
    assertExpectedLockVersion(preflightPlan, request.expectedLockVersion);
    assertTransitionStatus(preflightPlan, 'submit_review');
    assertSiteSubmitter(preflightPlan, actor);
    assertReleaseValidation(preflightPlan);
    assertConstructionPlanDrawingPreviewBindingHash(
        request.planId,
        preflightPlan,
        expectedDrawingPreviewBindingHash,
    );

    const snapshotEnvelope = buildConstructionPlanReviewSnapshotContent(
        request.planId,
        preflightPlan,
        request.expectedLockVersion,
    );
    const canonicalBuffer = Buffer.from(canonicalStringify(snapshotEnvelope), 'utf8');
    const contentHash = sha256Hex(canonicalBuffer);
    const snapshotId = `content-${contentHash.slice(0, 24)}`;
    const storagePath = reviewStoragePath(request.planId, preflightPlan, contentHash);
    const storageGeneration = await ensureImmutableStorageObject(
        storagePath,
        canonicalBuffer,
        'application/json',
        contentHash,
        'review-submission-snapshot',
    );

    const cycleId = readTrimmedString(preflightPlan, ['activeReviewCycleId'])
        || reviewCycleIdForPlan(request.planId, preflightPlan);
    const packageId = `package-${buildConstructionPlanMutationClaimId(
        actor.uid,
        `${operation}:${request.planId}`,
        effectiveKey,
    ).slice(0, 24)}`;
    const snapshotRef = planRef.collection('snapshots').doc(snapshotId);
    const packageRef = planRef.collection('reviewPackages').doc(packageId);
    const cycleRef = planRef.collection('reviewCycles').doc(cycleId);
    const previousPackageId = readTrimmedString(preflightPlan, ['activeReviewPackageId']);
    const previousPackageRef = previousPackageId
        ? planRef.collection('reviewPackages').doc(previousPackageId)
        : null;
    let previousEnvelope: UnknownRecord = {};
    let baselineKind: 'previous_submission' | 'prior_issued' | 'empty' = 'empty';
    let previousStoragePath = readTrimmedString(preflightPlan, ['activeReviewSnapshotStoragePath']);
    let previousHash = readTrimmedString(preflightPlan, ['activeReviewSnapshotHash']);
    if (previousStoragePath && previousHash) {
        previousEnvelope = await readImmutableSnapshotContent(previousStoragePath, previousHash);
        baselineKind = 'previous_submission';
    } else {
        const sourceSnapshotHash = readTrimmedString(preflightPlan, ['sourceSnapshotHash']);
        const sourcePlanId = readTrimmedString(preflightPlan, ['supersedesPlanId', 'clonedFromPlanId']);
        if (sourceSnapshotHash || sourcePlanId) {
            if (!sourceSnapshotHash || !sourcePlanId || !/^[a-f0-9]{64}$/.test(sourceSnapshotHash)) {
                throw new functions.https.HttpsError(
                    'data-loss',
                    '직전 발행본 비교 기준의 계보 정보가 완전하지 않습니다.',
                );
            }
            const sourcePlan = planData(await db().collection(PLANS_COLLECTION).doc(sourcePlanId).get());
            previousStoragePath = readTrimmedString(sourcePlan, ['approvedSnapshotStoragePath']);
            previousHash = readTrimmedString(sourcePlan, ['approvedSnapshotHash']);
            if (!previousStoragePath || previousHash !== sourceSnapshotHash) {
                throw new functions.https.HttpsError(
                    'data-loss',
                    '직전 발행본의 불변 스냅샷 바인딩이 현재 문서 계보와 일치하지 않습니다.',
                );
            }
            previousEnvelope = await readImmutableSnapshotContent(previousStoragePath, previousHash);
            baselineKind = 'prior_issued';
        }
    }
    let diffSummary: ReturnType<typeof summarizeConstructionPlanReviewDiff>;
    try {
        diffSummary = summarizeConstructionPlanReviewDiff(previousEnvelope, snapshotEnvelope, {
            baselineKind,
            ...(previousHash ? { baselineContentHash: previousHash } : {}),
            currentContentHash: contentHash,
        });
    } catch (error) {
        if (error instanceof RangeError) {
            throw new functions.https.HttpsError(
                'resource-exhausted',
                '검토 변경요약이 안전한 저장 한도를 초과했습니다. 변경 범위를 나누어 제출하세요.',
            );
        }
        throw error;
    }
    const eventRef = planRef.collection('workflowEvents').doc();

    return db().runTransaction(async (transaction): Promise<ReviewResponse> => {
        const reads = await Promise.all([
            transaction.get(planRef),
            transaction.get(claimRef),
            transaction.get(snapshotRef),
            transaction.get(packageRef),
            transaction.get(cycleRef),
            transaction.get(templateContext.reference),
            ...(previousPackageRef ? [transaction.get(previousPackageRef)] : []),
        ]);
        const plan = planData(reads[0]);
        const claimed = reviewClaimResponse(reads[1], operation, requestFingerprint);
        if (claimed) return claimed;
        assertExpectedLockVersion(plan, request.expectedLockVersion);
        const nextStatus = assertTransitionStatus(plan, 'submit_review');
        assertSiteSubmitter(plan, actor);
        assertReleaseValidation(plan);
        assertConstructionPlanDrawingPreviewBindingHash(
            request.planId,
            plan,
            expectedDrawingPreviewBindingHash,
        );
        assertSameConstructionPlanTemplateBinding(templateContext.binding, plan.templateBinding);
        assertBoundTemplateLifecycleSnapshot(templateContext, reads[5]);

        const latestEnvelope = buildConstructionPlanReviewSnapshotContent(
            request.planId,
            plan,
            request.expectedLockVersion,
        );
        if (sha256Hex(canonicalStringify(latestEnvelope)) !== contentHash) {
            throw new functions.https.HttpsError('aborted', '검토 제출 중 계획서 본문이 변경되었습니다.');
        }
        const existingSnapshot = reads[2];
        const existingPackage = reads[3];
        const existingCycle = reads[4];
        if (existingSnapshot.exists && existingSnapshot.data()?.contentHash !== contentHash) {
            throw new functions.https.HttpsError('data-loss', '검토 스냅샷 ID 충돌이 발생했습니다.');
        }
        if (existingPackage.exists) {
            throw new functions.https.HttpsError('already-exists', '검토 package ID 충돌이 발생했습니다.');
        }

        const cycle = existingCycle.exists && isUnknownRecord(existingCycle.data())
            ? existingCycle.data() as UnknownRecord
            : {};
        if (existingCycle.exists && cycle.frozen === true) {
            throw new functions.https.HttpsError('failed-precondition', '승인 완료된 검토 cycle은 재제출할 수 없습니다.');
        }
        const summary = existingCycle.exists
            ? authoritativeReviewSummary(cycle.commentSummary)
            : emptyConstructionPlanReviewCommentSummary();
        if (plan.status === 'changes_requested' && summary.requiredOpen > 0) {
            throw new functions.https.HttpsError(
                'failed-precondition',
                '필수 의견을 addressed 이상으로 처리한 뒤 재제출할 수 있습니다.',
            );
        }
        const round = (Number.isInteger(cycle.round) ? Number(cycle.round) : 0) + 1;
        const timestamp = new Date().toISOString();
        const summaryRecord = summaryWithTimestamp(summary, timestamp);
        const nextLockVersion = currentLockVersion(plan) + 1;
        if (!existingSnapshot.exists) {
            transaction.create(snapshotRef, {
                id: snapshotId,
                planId: request.planId,
                kind: 'review_submission',
                immutable: true,
                contentHash,
                contentByteLength: canonicalBuffer.length,
                storagePath,
                storageGeneration,
                firstSubmittedPlanLockVersion: request.expectedLockVersion,
                templateId: plan.templateId,
                templateVersion: plan.templateVersion,
                rendererVersion: templateContext.binding.rendererVersion,
                pageCount: templateContext.binding.logicalPageCount,
                ...templateBindingAuditMetadata(templateContext.binding),
                createdAt: timestamp,
            });
        }
        transaction.create(packageRef, {
            id: packageId,
            planId: request.planId,
            reviewCycleId: cycleId,
            round,
            status: 'active',
            reviewSnapshotId: snapshotId,
            reviewSnapshotHash: contentHash,
            reviewSnapshotStoragePath: storagePath,
            reviewSnapshotLockVersion: request.expectedLockVersion,
            previousPackageId: previousPackageId || null,
            unresolvedRequiredAtSubmit: summary.unresolvedRequired,
            commentSummary: summaryRecord,
            diffSummary,
            reviewDecision: 'pending',
            ...templateBindingAuditMetadata(templateContext.binding),
            createdBy: actor.uid,
            ...(actorNameSnapshot(actor) ? { createdByName: actorNameSnapshot(actor) } : {}),
            createdAt: timestamp,
            updatedAt: timestamp,
        });
        if (previousPackageRef && reads[6]?.exists) {
            transaction.update(previousPackageRef, { status: 'superseded', supersededAt: timestamp });
        }
        const cycleRecord: UnknownRecord = {
            id: cycleId,
            planId: request.planId,
            revision: Number.isInteger(plan.revision) ? Number(plan.revision) : 0,
            round,
            activePackageId: packageId,
            status: 'active',
            frozen: false,
            commentSummary: summaryRecord,
            ...templateBindingAuditMetadata(templateContext.binding),
            updatedAt: timestamp,
        };
        if (existingCycle.exists) transaction.update(cycleRef, cycleRecord);
        else transaction.create(cycleRef, { ...cycleRecord, createdAt: timestamp });
        const response: ReviewResponse = {
            planId: request.planId,
            status: nextStatus,
            lockVersion: nextLockVersion,
            activeReviewSnapshotId: snapshotId,
            activeReviewSnapshotHash: contentHash,
            activeReviewSnapshotStoragePath: storagePath,
            activeReviewSnapshotLockVersion: request.expectedLockVersion,
            activeReviewPackageId: packageId,
            reviewCycleId: cycleId,
            reviewRound: round,
            diffSummary: diffSummary as unknown as UnknownRecord,
            idempotent: false,
        };
        transaction.update(planRef, {
            status: nextStatus,
            activeReviewSnapshotId: snapshotId,
            activeReviewSnapshotHash: contentHash,
            activeReviewSnapshotStoragePath: storagePath,
            activeReviewSnapshotLockVersion: request.expectedLockVersion,
            activeReviewPackageId: packageId,
            activeReviewCycleId: cycleId,
            reviewRound: round,
            commentSummary: summaryRecord,
            lockVersion: nextLockVersion,
            updatedBy: actor.uid,
            updatedAt: timestamp,
            editLock: admin.firestore.FieldValue.delete(),
            validationSummary: { errors: 0, warnings: 0, checkedAt: timestamp },
            'releaseReadiness.requiredReviewsComplete': false,
            'releaseReadiness.unresolvedRequiredComments': summary.unresolvedRequired,
            'releaseReadiness.snapshotHashMatches': true,
        });
        transaction.create(claimRef, {
            operation,
            actorId: actor.uid,
            requestFingerprint,
            response,
            createdAt: timestamp,
        });
        transaction.create(eventRef, {
            id: eventRef.id,
            planId: request.planId,
            ...(readTrimmedString(plan, ['seriesId']) ? { seriesId: readTrimmedString(plan, ['seriesId']) } : {}),
            type: 'submit_review',
            action: 'submit_review',
            fromStatus: plan.status,
            toStatus: nextStatus,
            reason: request.reason || null,
            actorId: actor.uid,
            ...(actorNameSnapshot(actor) ? { actorName: actorNameSnapshot(actor) } : {}),
            at: timestamp,
            createdAt: timestamp,
            reviewCycleId: cycleId,
            reviewPackageId: packageId,
            reviewRound: round,
            reviewSnapshotId: snapshotId,
            reviewSnapshotHash: contentHash,
            reviewSnapshotLockVersion: request.expectedLockVersion,
            diffSummary,
            ...templateBindingAuditMetadata(templateContext.binding),
            metadata: {
                reviewCycleId: cycleId,
                reviewPackageId: packageId,
                reviewRound: round,
                reviewSnapshotId: snapshotId,
                reviewSnapshotHash: contentHash,
                reviewSnapshotLockVersion: request.expectedLockVersion,
                diffSummary,
                ...templateBindingAuditMetadata(templateContext.binding),
            },
        });
        return response;
    });
};

const runReviewTransition = async (
    request: ReviewRequest,
    actor: CallableActor,
    expectedDrawingPreviewBindingHash?: string,
): Promise<ReviewResponse> => {
    if (request.action === 'submit_review') {
        if (!expectedDrawingPreviewBindingHash) {
            throw new functions.https.HttpsError('internal', '도면 미리보기 권위 검증 결과가 없습니다.');
        }
        return submitConstructionPlanReview(request, actor, expectedDrawingPreviewBindingHash);
    }
    const operation = `review_${request.action}`;
    const requestFingerprint = sha256Hex(canonicalStringify({
        actorId: actor.uid,
        operation,
        planId: request.planId,
        expectedLockVersion: request.expectedLockVersion ?? null,
        reason: request.reason || null,
    }));
    const claimRef = request.idempotencyKey
        ? mutationClaimRef(actor.uid, operation, `${request.planId}:${request.idempotencyKey}`)
        : null;
    if (claimRef) {
        const earlyClaim = reviewClaimResponse(await claimRef.get(), operation, requestFingerprint);
        if (earlyClaim) return earlyClaim;
    }
    const planRef = db().collection(PLANS_COLLECTION).doc(request.planId);
    const preflightPlan = planData(await planRef.get());
    const templateContext = request.action === 'complete_review'
        ? boundTemplateContextForPlan(preflightPlan)
        : undefined;
    if (request.action === 'complete_review') {
        if (!expectedDrawingPreviewBindingHash) {
            throw new functions.https.HttpsError('internal', '도면 미리보기 권위 검증 결과가 없습니다.');
        }
        assertReleaseValidation(preflightPlan);
        assertConstructionPlanDrawingPreviewBindingHash(
            request.planId,
            preflightPlan,
            expectedDrawingPreviewBindingHash,
        );
    }
    const packageId = readTrimmedString(preflightPlan, ['activeReviewPackageId']);
    const cycleId = readTrimmedString(preflightPlan, ['activeReviewCycleId']);
    if (!packageId || !cycleId) {
        throw new functions.https.HttpsError('failed-precondition', '활성 검토 package가 없습니다. 다시 제출해주세요.');
    }
    const packageRef = planRef.collection('reviewPackages').doc(packageId);
    const cycleRef = planRef.collection('reviewCycles').doc(cycleId);
    const eventRef = planRef.collection('workflowEvents').doc();
    return db().runTransaction(async (transaction): Promise<ReviewResponse> => {
        const reads = await Promise.all([
            transaction.get(planRef), transaction.get(packageRef), transaction.get(cycleRef),
            ...(claimRef ? [transaction.get(claimRef)] : []),
            ...(templateContext ? [transaction.get(templateContext.reference)] : []),
        ]);
        const [planSnapshot, packageSnapshot, cycleSnapshot] = reads;
        if (claimRef) {
            const claimed = reviewClaimResponse(reads[3], operation, requestFingerprint);
            if (claimed) return claimed;
        }
        const plan = planData(planSnapshot);
        assertExpectedLockVersion(plan, request.expectedLockVersion);
        const nextStatus = assertTransitionStatus(plan, request.action);
        if (plan.activeReviewPackageId !== packageId || plan.activeReviewCycleId !== cycleId) {
            throw new functions.https.HttpsError('aborted', '활성 검토 package가 변경되었습니다.');
        }
        const packageData = packageSnapshot.data();
        const cycle = cycleSnapshot.data();
        if (!packageSnapshot.exists || !isUnknownRecord(packageData)
            || !cycleSnapshot.exists || !isUnknownRecord(cycle)
            || cycle.activePackageId !== packageId || cycle.frozen === true) {
            throw new functions.https.HttpsError('failed-precondition', '검토 cycle 무결성을 확인할 수 없습니다.');
        }
        const summary = authoritativeReviewSummary(cycle.commentSummary);
        if (request.action === 'request_changes' && !request.reason && summary.unresolvedRequired === 0) {
            throw new functions.https.HttpsError('invalid-argument', '변경 요청 사유 또는 미해결 필수 의견이 필요합니다.');
        }
        if (request.action === 'complete_review') {
            if (!templateContext) throw new functions.https.HttpsError('internal', '템플릿 검증 문맥이 없습니다.');
            const templateSnapshot = reads[claimRef ? 4 : 3];
            assertSameConstructionPlanTemplateBinding(templateContext.binding, plan.templateBinding);
            assertSameConstructionPlanTemplateBinding(templateContext.binding, packageData.templateBinding);
            assertBoundTemplateLifecycleSnapshot(templateContext, templateSnapshot);
            assertReleaseValidation(plan);
            assertConstructionPlanDrawingPreviewBindingHash(
                request.planId,
                plan,
                expectedDrawingPreviewBindingHash as string,
            );
            if (summary.unresolvedRequired !== 0) {
                throw new functions.https.HttpsError('failed-precondition', '미해결 필수 의견이 있어 검토를 완료할 수 없습니다.');
            }
        }

        const timestamp = new Date().toISOString();
        const nextLockVersion = currentLockVersion(plan) + 1;
        const participants = addUniquePlanParticipant(plan.participants, 'reviewerIds', actor.uid);
        const packageStatus = request.action === 'request_changes' ? 'changes_requested' : 'completed';
        transaction.update(packageRef, {
            status: packageStatus,
            reviewDecision: request.action === 'complete_review' ? 'completed' : 'changes_requested',
            updatedAt: timestamp,
            ...(request.action === 'complete_review'
                ? {
                    completedBy: actor.uid,
                    ...(actorNameSnapshot(actor) ? { completedByName: actorNameSnapshot(actor) } : {}),
                    completedAt: timestamp,
                }
                : { changesRequestedBy: actor.uid, changesRequestedAt: timestamp }),
        });
        transaction.update(cycleRef, { status: packageStatus, updatedAt: timestamp });
        transaction.update(planRef, {
            status: nextStatus,
            participants,
            lockVersion: nextLockVersion,
            updatedBy: actor.uid,
            updatedAt: timestamp,
            editLock: admin.firestore.FieldValue.delete(),
            validationSummary: { errors: 0, warnings: 0, checkedAt: timestamp },
            'releaseReadiness.requiredReviewsComplete': request.action === 'complete_review',
            'releaseReadiness.unresolvedRequiredComments': summary.unresolvedRequired,
        });
        const response: ReviewResponse = {
            planId: request.planId,
            status: nextStatus,
            lockVersion: nextLockVersion,
            activeReviewSnapshotId: readTrimmedString(plan, ['activeReviewSnapshotId']),
            activeReviewSnapshotHash: readTrimmedString(plan, ['activeReviewSnapshotHash']),
            activeReviewSnapshotStoragePath: readTrimmedString(plan, ['activeReviewSnapshotStoragePath']),
            activeReviewSnapshotLockVersion: Number(plan.activeReviewSnapshotLockVersion),
            activeReviewPackageId: packageId,
            reviewCycleId: cycleId,
            reviewRound: Number(plan.reviewRound),
            idempotent: false,
        };
        if (claimRef) {
            transaction.create(claimRef, {
                operation,
                actorId: actor.uid,
                requestFingerprint,
                response,
                createdAt: timestamp,
            });
        }
        transaction.create(eventRef, {
            id: eventRef.id,
            planId: request.planId,
            ...(readTrimmedString(plan, ['seriesId']) ? { seriesId: readTrimmedString(plan, ['seriesId']) } : {}),
            type: request.action,
            action: request.action,
            fromStatus: plan.status,
            toStatus: nextStatus,
            reason: request.reason || null,
            actorId: actor.uid,
            ...(actorNameSnapshot(actor) ? { actorName: actorNameSnapshot(actor) } : {}),
            at: timestamp,
            createdAt: timestamp,
            reviewCycleId: cycleId,
            reviewPackageId: packageId,
            reviewSnapshotId: packageData.reviewSnapshotId,
            reviewSnapshotHash: packageData.reviewSnapshotHash,
            ...(templateContext ? templateBindingAuditMetadata(templateContext.binding) : {}),
            metadata: {
                reviewCycleId: cycleId,
                reviewPackageId: packageId,
                reviewSnapshotId: packageData.reviewSnapshotId,
                reviewSnapshotHash: packageData.reviewSnapshotHash,
                unresolvedRequired: summary.unresolvedRequired,
                ...(templateContext ? templateBindingAuditMetadata(templateContext.binding) : {}),
            },
        });
        return response;
    });
};

const approveConstructionPlan = async (
    request: ReviewRequest,
    actor: CallableActor,
    expectedDrawingPreviewBindingHash: string,
): Promise<ReviewResponse> => {
    const operation = 'review_approve';
    const requestFingerprint = sha256Hex(canonicalStringify({
        actorId: actor.uid,
        operation,
        planId: request.planId,
        expectedLockVersion: request.expectedLockVersion ?? null,
        reason: request.reason || null,
    }));
    const claimRef = request.idempotencyKey
        ? mutationClaimRef(actor.uid, operation, `${request.planId}:${request.idempotencyKey}`)
        : null;
    if (claimRef) {
        const earlyClaim = reviewClaimResponse(await claimRef.get(), operation, requestFingerprint);
        if (earlyClaim) return earlyClaim;
    }
    const planRef = db().collection(PLANS_COLLECTION).doc(request.planId);
    const preflightPlan = planData(await planRef.get());
    const templateContext = boundTemplateContextForPlan(preflightPlan);
    if (!claimRef
        && preflightPlan.status === 'approved_pending_issue'
        && preflightPlan.updatedBy === actor.uid
        && preflightPlan.approvedSnapshotId === preflightPlan.activeReviewSnapshotId
        && preflightPlan.approvedSnapshotHash === preflightPlan.activeReviewSnapshotHash) {
        return {
            planId: request.planId,
            status: 'approved_pending_issue',
            lockVersion: currentLockVersion(preflightPlan),
            approvedSnapshotId: readTrimmedString(preflightPlan, ['approvedSnapshotId']),
            approvedSnapshotHash: readTrimmedString(preflightPlan, ['approvedSnapshotHash']),
            approvedSnapshotStoragePath: readTrimmedString(preflightPlan, ['approvedSnapshotStoragePath']),
            approvedEvidenceId: readTrimmedString(preflightPlan, ['approvedEvidenceId']),
            approvedEvidenceHash: readTrimmedString(preflightPlan, ['approvedEvidenceHash']),
            activeReviewSnapshotId: readTrimmedString(preflightPlan, ['activeReviewSnapshotId']),
            activeReviewSnapshotHash: readTrimmedString(preflightPlan, ['activeReviewSnapshotHash']),
            activeReviewSnapshotStoragePath: readTrimmedString(preflightPlan, ['activeReviewSnapshotStoragePath']),
            activeReviewSnapshotLockVersion: Number(preflightPlan.activeReviewSnapshotLockVersion),
            activeReviewPackageId: readTrimmedString(preflightPlan, ['activeReviewPackageId']),
            reviewCycleId: readTrimmedString(preflightPlan, ['activeReviewCycleId']),
            reviewRound: Number(preflightPlan.reviewRound),
            idempotent: true,
        };
    }
    assertExpectedLockVersion(preflightPlan, request.expectedLockVersion);
    assertTransitionStatus(preflightPlan, 'approve');
    assertApproverSeparation(preflightPlan, actor);
    assertReleaseValidation(preflightPlan);
    assertConstructionPlanDrawingPreviewBindingHash(
        request.planId,
        preflightPlan,
        expectedDrawingPreviewBindingHash,
    );
    const packageId = requireString(preflightPlan, 'activeReviewPackageId', 200);
    const cycleId = requireString(preflightPlan, 'activeReviewCycleId', 200);
    const snapshotId = requireString(preflightPlan, 'activeReviewSnapshotId', 200);
    const contentHash = requireString(preflightPlan, 'activeReviewSnapshotHash', 64);
    const storagePath = requireString(preflightPlan, 'activeReviewSnapshotStoragePath', 1000);
    const preflightEnvelope = await readImmutableSnapshotContent(storagePath, contentHash);
    const preflightContent = isUnknownRecord(preflightEnvelope.content) ? preflightEnvelope.content : {};
    assertSameConstructionPlanTemplateBinding(templateContext.binding, preflightContent.templateBinding);

    const packageRef = planRef.collection('reviewPackages').doc(packageId);
    const cycleRef = planRef.collection('reviewCycles').doc(cycleId);
    const snapshotRef = planRef.collection('snapshots').doc(snapshotId);
    const preflightPackageSnapshot = await packageRef.get();
    if (!preflightPackageSnapshot.exists || !isUnknownRecord(preflightPackageSnapshot.data())) {
        throw new functions.https.HttpsError('failed-precondition', '승인할 검토 package를 찾을 수 없습니다.');
    }
    const preflightPackage = preflightPackageSnapshot.data() as UnknownRecord;
    if (preflightPackage.reviewDecision !== 'completed') {
        throw new functions.https.HttpsError('failed-precondition', '검토 완료 package만 승인할 수 있습니다.');
    }
    const completedByName = readTrimmedString(preflightPackage, ['completedByName']);
    const completedAt = readTrimmedString(preflightPackage, ['completedAt']);
    if (completedAt && !Number.isFinite(Date.parse(completedAt))) {
        throw new functions.https.HttpsError('data-loss', '검토 완료 시각 스냅샷이 손상되었습니다.');
    }
    const approverName = actorNameSnapshot(actor);
    const approvalTimestamp = new Date().toISOString();
    const approvalEvidenceContent = constructionPlanApprovalEvidenceContentForHash({
        evidenceSchemaVersion: 1,
        kind: 'construction_plan_approval',
        planId: request.planId,
        reviewCycleId: cycleId,
        reviewPackageId: packageId,
        snapshotId,
        contentHash,
        storagePath,
        reviewDecision: 'completed',
        approverId: actor.uid,
        ...(completedByName ? { completedByName } : {}),
        ...(completedAt ? { completedAt } : {}),
        ...(approverName ? { approverName } : {}),
        approvedAt: approvalTimestamp,
        ...templateContext.projection,
    });
    const approvalEvidenceHash = sha256Hex(canonicalStringify(approvalEvidenceContent));
    const approvalEvidenceId = `approval-${approvalEvidenceHash.slice(0, 24)}`;
    const approvalEvidenceRef = planRef.collection('approvals').doc(approvalEvidenceId);
    const eventRef = planRef.collection('workflowEvents').doc();
    return db().runTransaction(async (transaction): Promise<ReviewResponse> => {
        const reads = await Promise.all([
            transaction.get(planRef), transaction.get(packageRef),
            transaction.get(cycleRef), transaction.get(snapshotRef), transaction.get(approvalEvidenceRef),
            transaction.get(templateContext.reference),
            ...(claimRef ? [transaction.get(claimRef)] : []),
        ]);
        const [planSnapshot, packageSnapshot, cycleSnapshot, contentSnapshot, approvalEvidenceSnapshot] = reads;
        if (claimRef) {
            const claimed = reviewClaimResponse(reads[6], operation, requestFingerprint);
            if (claimed) return claimed;
        }
        const plan = planData(planSnapshot);
        assertExpectedLockVersion(plan, request.expectedLockVersion);
        const nextStatus = assertTransitionStatus(plan, 'approve');
        assertApproverSeparation(plan, actor);
        assertReleaseValidation(plan);
        assertConstructionPlanDrawingPreviewBindingHash(
            request.planId,
            plan,
            expectedDrawingPreviewBindingHash,
        );
        assertSameConstructionPlanTemplateBinding(templateContext.binding, plan.templateBinding);
        assertBoundTemplateLifecycleSnapshot(templateContext, reads[5]);
        const packageData = packageSnapshot.data();
        const cycle = cycleSnapshot.data();
        const snapshotData = contentSnapshot.data();
        if (!packageSnapshot.exists || !isUnknownRecord(packageData)
            || !cycleSnapshot.exists || !isUnknownRecord(cycle)
            || !contentSnapshot.exists || !isUnknownRecord(snapshotData)
            || plan.activeReviewPackageId !== packageId
            || plan.activeReviewCycleId !== cycleId
            || cycle.activePackageId !== packageId
            || cycle.frozen === true
            || packageData.reviewDecision !== 'completed'
            || canonicalStringify(packageData.templateBinding) !== canonicalStringify(templateContext.binding)
            || canonicalStringify(snapshotData.templateBinding) !== canonicalStringify(templateContext.binding)
            || readTrimmedString(packageData, ['completedByName']) !== completedByName
            || readTrimmedString(packageData, ['completedAt']) !== completedAt) {
            throw new functions.https.HttpsError('failed-precondition', '승인할 검토 package 무결성을 확인할 수 없습니다.');
        }
        const summary = authoritativeReviewSummary(cycle.commentSummary);
        if (summary.unresolvedRequired !== 0) {
            throw new functions.https.HttpsError('failed-precondition', '미해결 필수 의견이 있어 승인할 수 없습니다.');
        }
        let approvedReference: UnknownRecord;
        try {
            approvedReference = buildConstructionPlanApprovedSnapshotReference(
                plan,
                snapshotData,
                packageData,
                cycle,
            );
        } catch (_error) {
            throw new functions.https.HttpsError('data-loss', '제출 스냅샷과 계획서의 바인딩이 손상되었습니다.');
        }
        if (packageData.reviewSnapshotId !== approvedReference.approvedSnapshotId
            || packageData.reviewSnapshotHash !== approvedReference.approvedSnapshotHash
            || packageData.reviewSnapshotStoragePath !== approvedReference.approvedSnapshotStoragePath
            || packageData.reviewSnapshotLockVersion !== plan.activeReviewSnapshotLockVersion) {
            throw new functions.https.HttpsError('data-loss', '검토 package와 스냅샷 바인딩이 손상되었습니다.');
        }

        const timestamp = approvalTimestamp;
        const nextLockVersion = currentLockVersion(plan) + 1;
        const participants = addUniquePlanParticipant(plan.participants, 'approverIds', actor.uid);
        transaction.update(packageRef, {
            status: 'approved',
            approvedBy: actor.uid,
            ...(approverName ? { approverName } : {}),
            approvedAt: timestamp,
            ...templateBindingAuditMetadata(templateContext.binding),
            updatedAt: timestamp,
        });
        transaction.update(cycleRef, {
            status: 'approved', frozen: true, frozenAt: timestamp, frozenBy: actor.uid, updatedAt: timestamp,
            ...templateBindingAuditMetadata(templateContext.binding),
        });
        if (approvalEvidenceSnapshot.exists) {
            if (approvalEvidenceSnapshot.data()?.evidenceHash !== approvalEvidenceHash) {
                throw new functions.https.HttpsError('data-loss', '승인 증적 ID 충돌이 발생했습니다.');
            }
        } else {
            transaction.create(approvalEvidenceRef, {
                id: approvalEvidenceId,
                ...approvalEvidenceContent,
                evidenceHash: approvalEvidenceHash,
                immutable: true,
                createdAt: approvalTimestamp,
            });
        }
        transaction.update(planRef, {
            status: nextStatus,
            participants,
            ...approvedReference,
            approvedEvidenceId: approvalEvidenceId,
            approvedEvidenceHash: approvalEvidenceHash,
            ...(approverName ? { approverName } : {}),
            approvedAt: timestamp,
            metadata: {
                reviewCycleId: cycleId,
                reviewPackageId: packageId,
                approvedSnapshotId: approvedReference.approvedSnapshotId,
                approvedSnapshotHash: approvedReference.approvedSnapshotHash,
                approvedSnapshotStoragePath: approvedReference.approvedSnapshotStoragePath,
                approvedEvidenceId: approvalEvidenceId,
                approvedEvidenceHash: approvalEvidenceHash,
                ...(approverName ? { approverName } : {}),
                approvedAt: timestamp,
                ...templateBindingAuditMetadata(templateContext.binding),
            },
            lockVersion: nextLockVersion,
            updatedBy: actor.uid,
            updatedAt: timestamp,
            editLock: admin.firestore.FieldValue.delete(),
            validationSummary: { errors: 0, warnings: 0, checkedAt: timestamp },
            'releaseReadiness.requiredReviewsComplete': true,
            'releaseReadiness.unresolvedRequiredComments': 0,
            'releaseReadiness.snapshotHashMatches': true,
        });
        const response: ReviewResponse = {
            planId: request.planId,
            status: nextStatus,
            lockVersion: nextLockVersion,
            approvedSnapshotId: String(approvedReference.approvedSnapshotId),
            approvedSnapshotHash: String(approvedReference.approvedSnapshotHash),
            approvedSnapshotStoragePath: String(approvedReference.approvedSnapshotStoragePath),
            approvedEvidenceId: approvalEvidenceId,
            approvedEvidenceHash: approvalEvidenceHash,
            activeReviewSnapshotId: snapshotId,
            activeReviewSnapshotHash: contentHash,
            activeReviewSnapshotStoragePath: storagePath,
            activeReviewSnapshotLockVersion: Number(plan.activeReviewSnapshotLockVersion),
            activeReviewPackageId: packageId,
            reviewCycleId: cycleId,
            reviewRound: Number(plan.reviewRound),
            idempotent: false,
        };
        if (claimRef) {
            transaction.create(claimRef, {
                operation,
                actorId: actor.uid,
                requestFingerprint,
                response,
                createdAt: timestamp,
            });
        }
        transaction.create(eventRef, {
            id: eventRef.id,
            planId: request.planId,
            ...(readTrimmedString(plan, ['seriesId']) ? { seriesId: readTrimmedString(plan, ['seriesId']) } : {}),
            type: 'approve',
            action: 'approve',
            fromStatus: plan.status,
            toStatus: nextStatus,
            actorId: actor.uid,
            ...(actorNameSnapshot(actor) ? { actorName: actorNameSnapshot(actor) } : {}),
            at: timestamp,
            createdAt: timestamp,
            reviewCycleId: cycleId,
            reviewPackageId: packageId,
            approvedSnapshotId: approvedReference.approvedSnapshotId,
            approvedSnapshotHash: approvedReference.approvedSnapshotHash,
            approvedSnapshotStoragePath: approvedReference.approvedSnapshotStoragePath,
            approvedEvidenceId: approvalEvidenceId,
            approvedEvidenceHash: approvalEvidenceHash,
            ...templateBindingAuditMetadata(templateContext.binding),
        });
        return response;
    });
};

const createConstructionPlanDraft = async (
    request: CreateDraftRequest,
    actor: CallableActor,
): Promise<PlanMutationResponse> => {
    const operation = 'create_draft';
    const templateIdentity = {
        tradeType: request.tradeType,
        templateId: request.templateId,
        templateVersion: request.templateVersion,
    };
    const templateRef = constructionPlanTemplateDocumentReferenceForIdentity(templateIdentity);
    const claimRef = mutationClaimRef(actor.uid, operation, request.idempotencyKey);
    const requestFingerprint = mutationRequestFingerprint(actor.uid, operation, request);
    const earlyIdempotent = readMutationClaimResponse(await claimRef.get(), operation, requestFingerprint);
    if (earlyIdempotent) return earlyIdempotent;
    const site = await loadAuthorizedSite(actor, request.siteId);
    const responsibleTeamId = readTrimmedString(site, ['responsibleTeamId']);
    const clientCompanyId = readTrimmedString(site, ['clientCompanyId']);
    const contractorCompanyId = readTrimmedString(site, ['constructorCompanyId', 'companyId']);
    const partnerCompanyId = readTrimmedString(site, ['partnerId']);
    const siteManagerWorkerIds = Array.from(collectScopedIds(site, [
        'managerId', 'managerUid', 'siteManagerId', 'siteManagerUid',
        'responsibleManagerId', 'responsibleManagerUid', 'managerIds', 'managerUids',
    ]));
    const linkedCompanyIds = Array.from(new Set([
        clientCompanyId,
        contractorCompanyId,
        partnerCompanyId,
    ].filter((value): value is string => Boolean(value))));
    const [safeWorkers, companyMasters, responsibleTeam] = await Promise.all([
        loadSafeWorkerDirectoryForSite(
            request.siteId,
            responsibleTeamId,
            false,
            siteManagerWorkerIds,
        ),
        Promise.all(linkedCompanyIds.map((companyId) => (
            loadConstructionPlanLinkedMaster(COMPANIES_COLLECTION, companyId)
        ))),
        loadConstructionPlanLinkedMaster(TEAMS_COLLECTION, responsibleTeamId),
    ]);
    const companiesById = new Map<string, UnknownRecord>();
    companyMasters.forEach((company) => {
        const id = company && readTrimmedString(company, ['id']);
        if (id && company) companiesById.set(id, company);
    });
    const normalizedSite = callableFirestoreValue({ ...site, id: request.siteId });
    if (!isUnknownRecord(normalizedSite)) {
        throw new functions.https.HttpsError('data-loss', '현장 마스터 스냅샷을 정규화할 수 없습니다.');
    }
    const timestamp = new Date().toISOString();
    const canonicalDraft = buildCanonicalConstructionPlanDraftContext({
        siteId: request.siteId,
        site: normalizedSite,
        clientCompany: clientCompanyId ? companiesById.get(clientCompanyId) : undefined,
        contractorCompany: contractorCompanyId ? companiesById.get(contractorCompanyId) : undefined,
        partnerCompany: partnerCompanyId ? companiesById.get(partnerCompanyId) : undefined,
        responsibleTeam,
        requestedProjectSnapshot: request.projectSnapshot,
        safeWorkers,
        preferredSiteManagerWorkerIds: siteManagerWorkerIds,
        actorId: actor.uid,
        capturedAt: timestamp,
    });
    const identity = buildConstructionPlanSeriesIdentity(request.siteId, request.documentNo);
    const planRef = db().collection(PLANS_COLLECTION).doc();
    const seriesRef = db().collection(SERIES_COLLECTION).doc(identity.seriesId);
    const eventRef = planRef.collection('workflowEvents').doc();
    const response: PlanMutationResponse = {
        planId: planRef.id,
        seriesId: identity.seriesId,
        revisionNo: 0,
        documentNo: identity.documentNo,
        idempotent: false,
    };
    let plan: UnknownRecord;
    try {
        plan = buildConstructionPlanDraftDocument({
            id: planRef.id,
            seriesId: identity.seriesId,
            siteId: request.siteId,
            siteName: canonicalDraft.siteName,
            title: request.title,
            tradeType: request.tradeType,
            templateId: request.templateId,
            templateVersion: request.templateVersion,
            documentNo: identity.documentNo,
            documentDate: request.documentDate,
            projectSnapshot: canonicalDraft.projectSnapshot,
            erpSnapshot: canonicalDraft.erpSnapshot,
            organizationSnapshot: canonicalDraft.organizationSnapshot,
            participants: canonicalDraft.participants,
            selectedSectionKeys: request.selectedSectionKeys,
            actorId: actor.uid,
            actorName: actorNameSnapshot(actor),
            timestamp,
        });
    } catch (error) {
        return toInvalidPlanInputError(error);
    }

    return db().runTransaction(async (transaction) => {
        const [claimSnapshot, seriesSnapshot, legacyCollisionSnapshot, templateSnapshot] = await Promise.all([
            transaction.get(claimRef),
            transaction.get(seriesRef),
            transaction.get(legacyPlanCollisionQuery(request.siteId)),
            transaction.get(templateRef),
        ]);
        const idempotent = readMutationClaimResponse(claimSnapshot, operation, requestFingerprint);
        if (idempotent) return idempotent;
        const templateRecord = assertPublishedConstructionPlanTemplateSnapshotForNewDraft(
            templateIdentity,
            templateSnapshot.exists ? templateSnapshot.data() : undefined,
        );
        const templateBinding = buildConstructionPlanTemplateBinding(templateRecord, timestamp);
        const boundPlan = bindConstructionPlanTemplate(plan, templateBinding);
        if (seriesSnapshot.exists) {
            throw new functions.https.HttpsError(
                'already-exists',
                '같은 현장과 문서번호의 시공계획서 시리즈가 이미 존재합니다.',
            );
        }
        assertNoLegacyPlanDocumentNoCollision(
            legacyCollisionSnapshot,
            request.siteId,
            identity,
        );

        transaction.create(seriesRef, buildSeriesDocument(
            identity,
            request.siteId,
            0,
            planRef.id,
            null,
            actor.uid,
            timestamp,
            request.tradeType,
            templateBinding,
        ));
        transaction.create(planRef, boundPlan);
        transaction.create(eventRef, {
            id: eventRef.id,
            planId: planRef.id,
            seriesId: identity.seriesId,
            type: 'draft_created',
            action: 'draft_created',
            actorId: actor.uid,
            ...(actorNameSnapshot(actor) ? { actorName: actorNameSnapshot(actor) } : {}),
            at: timestamp,
            createdAt: timestamp,
            toStatus: 'draft',
            revisionNo: 0,
            metadata: {
                documentNo: identity.documentNo,
                ...templateBindingAuditMetadata(templateBinding),
            },
        });
        createMutationClaim(
            transaction,
            claimRef,
            actor.uid,
            operation,
            requestFingerprint,
            response,
            timestamp,
        );
        return response;
    });
};

const createConstructionPlanRevision = async (
    request: CreateRevisionRequest,
    actor: CallableActor,
): Promise<PlanMutationResponse> => {
    const operation = 'create_revision';
    const claimRef = mutationClaimRef(actor.uid, operation, request.idempotencyKey);
    const requestFingerprint = mutationRequestFingerprint(actor.uid, operation, request);
    const earlyIdempotent = readMutationClaimResponse(await claimRef.get(), operation, requestFingerprint);
    if (earlyIdempotent) return earlyIdempotent;
    const sourceRef = db().collection(PLANS_COLLECTION).doc(request.sourcePlanId);
    const preflightSnapshot = await sourceRef.get();
    const preflightRaw = planData(preflightSnapshot);
    const preflightSource: UnknownRecord = { ...preflightRaw, id: request.sourcePlanId };
    const sourceBinding = assertConstructionPlanTemplateBindingMatchesPlanIdentity(
        preflightSource.templateBinding,
        preflightSource,
    );
    const sourceTemplateIdentity = {
        tradeType: sourceBinding.tradeType,
        templateId: sourceBinding.templateId,
        templateVersion: sourceBinding.templateVersion,
    };
    const sourceTemplateRef = constructionPlanTemplateDocumentReferenceForIdentity(sourceTemplateIdentity);
    const targetTemplateIdentity = request.targetTemplate
        ? {
            tradeType: request.targetTemplate.tradeType,
            templateId: request.targetTemplate.templateId,
            templateVersion: request.targetTemplate.templateVersion,
        }
        : undefined;
    const targetTemplateRef = targetTemplateIdentity
        ? constructionPlanTemplateDocumentReferenceForIdentity(targetTemplateIdentity)
        : undefined;
    const preflightSourceFingerprint = sha256Hex(canonicalStringify(preflightSource));
    const siteId = readTrimmedString(preflightSource, ['siteId']);
    const documentNo = readTrimmedString(preflightSource, ['documentNo']);
    const sourceSnapshotHash = readTrimmedString(preflightSource, ['approvedSnapshotHash']);
    const sourceRevision = Number(preflightSource.revision);
    if (!siteId || !documentNo || !sourceSnapshotHash || !/^[a-f0-9]{64}$/.test(sourceSnapshotHash)
        || !Number.isInteger(sourceRevision) || sourceRevision < 0) {
        throw new functions.https.HttpsError('failed-precondition', '원본 발행본의 시리즈·승인 스냅샷 정보가 부족합니다.');
    }
    if (preflightSource.status !== 'issued') {
        throw new functions.https.HttpsError('failed-precondition', '최신 현장사용 발행본에서만 개정본을 만들 수 있습니다.');
    }
    assertPlanParticipantAccess(preflightSource, actor);
    if (actor.access.isAdmin || actor.access.isOffice) await loadAuthorizedSite(actor, siteId);

    const identity = buildConstructionPlanSeriesIdentity(siteId, documentNo);
    const recordedSeriesId = readTrimmedString(preflightSource, ['seriesId']);
    if (recordedSeriesId && recordedSeriesId !== identity.seriesId) {
        throw new functions.https.HttpsError('data-loss', '원본의 seriesId가 문서번호와 일치하지 않습니다.');
    }
    const timestamp = new Date().toISOString();
    const drawingReuseIdentity = request.copyDrawings
        ? buildConstructionPlanDrawingReuseIdentity({
            actorId: actor.uid,
            operation: 'revision',
            idempotencyKey: request.idempotencyKey,
        })
        : undefined;
    const planRef = drawingReuseIdentity
        ? db().collection(PLANS_COLLECTION).doc(drawingReuseIdentity.targetPlanId)
        : db().collection(PLANS_COLLECTION).doc();
    const seriesRef = db().collection(SERIES_COLLECTION).doc(identity.seriesId);
    const newEventRef = planRef.collection('workflowEvents').doc();
    const sourceEventRef = sourceRef.collection('workflowEvents').doc();
    let preparedDrawingReuse: PreparedConstructionPlanDrawingReuse | undefined;
    if (request.copyDrawings) {
        if (!recordedSeriesId) {
            throw new functions.https.HttpsError(
                'failed-precondition',
                '문서 계보가 없는 legacy 발행본의 도면은 자동 복사할 수 없습니다. 원본 계보를 먼저 복원하세요.',
            );
        }
        const [preflightSeriesSnapshot, preflightTemplateSnapshot] = await Promise.all([
            seriesRef.get(),
            sourceTemplateRef.get(),
        ]);
        if (!preflightSeriesSnapshot.exists) {
            throw new functions.https.HttpsError('failed-precondition', '원본 발행본의 시리즈 계보를 찾을 수 없습니다.');
        }
        const preflightSeries = assertSeriesIdentity(
            preflightSeriesSnapshot.data(),
            identity,
            siteId,
            sourceBinding.tradeType,
        );
        if (preflightSeries.latestPlanId !== request.sourcePlanId
            || Number(preflightSeries.latestRevisionNo) !== sourceRevision
            || (preflightSeries.latestIssuedPlanId !== undefined
                && preflightSeries.latestIssuedPlanId !== request.sourcePlanId)) {
            throw new functions.https.HttpsError(
                'failed-precondition',
                '최신 현장사용 발행본의 정확한 시리즈 계보에서만 도면을 복사할 수 있습니다.',
            );
        }
        const sourceTemplateRecord = assertConstructionPlanTemplateSnapshotForExistingPlan(
            sourceTemplateIdentity,
            preflightTemplateSnapshot.exists ? preflightTemplateSnapshot.data() : undefined,
        );
        assertConstructionPlanTemplateBindingMatchesRecord(sourceBinding, sourceTemplateRecord);
        preparedDrawingReuse = await prepareConstructionPlanDerivedDrawingReuse({
            actorId: actor.uid,
            operation: 'revision',
            idempotencyKey: request.idempotencyKey,
            requestFingerprint,
            sourcePlan: preflightSource,
            targetPlanId: planRef.id,
            timestamp,
        });
    }

    const drawingReuseAuditRef = preparedDrawingReuse
        ? db().collection(AUDIT_COLLECTION).doc(`drawing-reuse-${preparedDrawingReuse.jobId}`)
        : undefined;
    let transactionWritesQueued = false;
    try {
        return await db().runTransaction(async (transaction) => {
        const [
            claimSnapshot,
            latestSourceSnapshot,
            seriesSnapshot,
            legacyCollisionSnapshot,
            sourceTemplateSnapshot,
            targetTemplateSnapshot,
            drawingReuseJobSnapshot,
        ] = await Promise.all([
            transaction.get(claimRef),
            transaction.get(sourceRef),
            transaction.get(seriesRef),
            recordedSeriesId
                ? Promise.resolve(null)
                : transaction.get(legacyPlanCollisionQuery(siteId)),
            transaction.get(sourceTemplateRef),
            targetTemplateRef ? transaction.get(targetTemplateRef) : Promise.resolve(null),
            preparedDrawingReuse
                ? transaction.get(constructionPlanDrawingReuseJobRef(preparedDrawingReuse.jobId))
                : Promise.resolve(null),
        ]);
        const idempotent = readMutationClaimResponse(claimSnapshot, operation, requestFingerprint);
        if (idempotent) return idempotent;
        if (legacyCollisionSnapshot) {
            assertNoLegacyPlanDocumentNoCollision(
                legacyCollisionSnapshot,
                siteId,
                identity,
                [request.sourcePlanId],
            );
        }
        const sourceRaw = planData(latestSourceSnapshot);
        const source: UnknownRecord = { ...sourceRaw, id: request.sourcePlanId };
        assertSameConstructionPlanTemplateBinding(sourceBinding, source.templateBinding);
        const sourceTemplateRecord = assertConstructionPlanTemplateSnapshotForExistingPlan(
            sourceTemplateIdentity,
            sourceTemplateSnapshot.exists ? sourceTemplateSnapshot.data() : undefined,
        );
        assertConstructionPlanTemplateBindingMatchesRecord(sourceBinding, sourceTemplateRecord);
        if (preparedDrawingReuse) {
            assertConstructionPlanDrawingReuseJobReady({
                value: drawingReuseJobSnapshot?.data(),
                jobId: preparedDrawingReuse.jobId,
                actorId: actor.uid,
                operation: 'revision',
                requestFingerprint,
                sourcePlanFingerprint: preparedDrawingReuse.sourcePlanFingerprint,
                targetPlanId: planRef.id,
            });
        }
        const currentSourceRevision = Number(source.revision);
        if (source.siteId !== siteId
            || normalizeConstructionPlanDocumentNoKey(String(source.documentNo || '')) !== identity.documentNoKey
            || source.approvedSnapshotHash !== sourceSnapshotHash
            || currentSourceRevision !== sourceRevision
            || currentLockVersion(source) !== currentLockVersion(preflightSource)
            || !sameCanonicalValue(source.updatedAt, preflightSource.updatedAt)
            || sha256Hex(canonicalStringify(source)) !== preflightSourceFingerprint) {
            throw new functions.https.HttpsError('aborted', '개정본 생성 중 원본 문서가 변경되었습니다.');
        }

        let latestSeriesPlan: UnknownRecord | undefined;
        if (seriesSnapshot.exists) {
            const rawSeries = seriesSnapshot.data();
            const latestPlanId = isUnknownRecord(rawSeries)
                ? readTrimmedString(rawSeries, ['latestPlanId'])
                : undefined;
            if (latestPlanId && latestPlanId !== request.sourcePlanId) {
                const latestPlanRef = db().collection(PLANS_COLLECTION).doc(latestPlanId);
                const latestPlanSnapshot = await transaction.get(latestPlanRef);
                latestSeriesPlan = { ...planData(latestPlanSnapshot), id: latestPlanId };
            }
        }

        let seriesDecision: ReturnType<typeof decideConstructionPlanRevisionSeriesTransition>;
        try {
            seriesDecision = decideConstructionPlanRevisionSeriesTransition(
                seriesSnapshot.exists ? seriesSnapshot.data() : null,
                identity,
                source,
                latestSeriesPlan,
            );
        } catch (error) {
            const code = error instanceof Error ? error.message : '';
            if (code.includes('identity-invalid') || code.includes('series-invalid')) {
                throw new functions.https.HttpsError('data-loss', '원본 또는 시리즈 식별 정보가 손상되었습니다.');
            }
            throw new functions.https.HttpsError(
                'failed-precondition',
                '최신 현장사용 발행본에서만 다음 개정본을 만들 수 있습니다.',
            );
        }
        const nextRevision = seriesDecision.nextRevision;
        const bootstrappingLegacySeries = seriesDecision.kind === 'bootstrap';
        let revisionTemplateBinding = sourceBinding;
        let templateMigration: UnknownRecord | undefined;
        if (request.targetTemplate && targetTemplateIdentity) {
            if (!targetTemplateSnapshot) {
                throw new functions.https.HttpsError('data-loss', '업그레이드 대상 템플릿 조회가 누락되었습니다.');
            }
            const targetTemplateRecord = assertPublishedConstructionPlanTemplateSnapshotForNewDraft(
                targetTemplateIdentity,
                targetTemplateSnapshot.exists ? targetTemplateSnapshot.data() : undefined,
            );
            assertConstructionPlanTemplateUpgradeTarget(sourceBinding, targetTemplateRecord);
            revisionTemplateBinding = buildConstructionPlanTemplateBinding(targetTemplateRecord, timestamp);
            templateMigration = buildTemplateMigrationAudit({
                sourcePlanId: request.sourcePlanId,
                sourceBinding,
                targetBinding: revisionTemplateBinding,
                reason: request.targetTemplate.migrationReason,
                actorId: actor.uid,
                timestamp,
            });
        }
        let revisionPlan: UnknownRecord;
        try {
            revisionPlan = bindConstructionPlanTemplate(buildConstructionPlanRevisionDocument(source, {
                id: planRef.id,
                seriesId: identity.seriesId,
                revision: nextRevision,
                revisionReason: request.revisionReason,
                revisionType: request.revisionType,
                sourceSnapshotHash,
                copyDrawings: request.copyDrawings,
                ...(preparedDrawingReuse
                    ? { drawingReuseProjection: preparedDrawingReuse.projection }
                    : {}),
                actorId: actor.uid,
                actorName: actorNameSnapshot(actor),
                timestamp,
                ...(targetTemplateIdentity ? { targetTemplate: targetTemplateIdentity } : {}),
            }), revisionTemplateBinding);
            if (templateMigration) revisionPlan.templateMigration = templateMigration;
        } catch (error) {
            toInvalidPlanInputError(error);
        }
        const response: PlanMutationResponse = {
            planId: planRef.id,
            seriesId: identity.seriesId,
            revisionNo: nextRevision,
            documentNo: identity.documentNo,
            idempotent: false,
        };

        if (bootstrappingLegacySeries) {
            transaction.create(seriesRef, buildSeriesDocument(
                identity,
                siteId,
                nextRevision,
                planRef.id,
                request.sourcePlanId,
                actor.uid,
                timestamp,
                revisionPlan.tradeType as ConstructionPlanTradeType,
                revisionTemplateBinding,
            ));
        } else {
            transaction.update(seriesRef, {
                documentNo: identity.documentNo,
                latestRevisionNo: nextRevision,
                latestPlanId: planRef.id,
                templateBinding: revisionTemplateBinding,
                ...constructionPlanTemplateBindingProjection(revisionTemplateBinding),
                updatedBy: actor.uid,
                updatedAt: timestamp,
            });
        }
        const sourceBackfill: UnknownRecord = {};
        if (!readTrimmedString(source, ['seriesId'])) sourceBackfill.seriesId = identity.seriesId;
        if (!readTrimmedString(source, ['lineageRootPlanId'])) sourceBackfill.lineageRootPlanId = request.sourcePlanId;
        if (Object.keys(sourceBackfill).length > 0) transaction.update(sourceRef, sourceBackfill);

        transaction.create(planRef, revisionPlan);
        const event = {
            seriesId: identity.seriesId,
            type: 'revision_created',
            action: 'revision_created',
            actorId: actor.uid,
            ...(actorNameSnapshot(actor) ? { actorName: actorNameSnapshot(actor) } : {}),
            at: timestamp,
            createdAt: timestamp,
            sourcePlanId: request.sourcePlanId,
            targetPlanId: planRef.id,
            revisionNo: nextRevision,
            reason: request.revisionReason,
            revisionType: request.revisionType,
            metadata: {
                copyDrawings: request.copyDrawings,
                sourceSnapshotHash,
                sourceRevisionNo: sourceRevision,
                ...(preparedDrawingReuse ? {
                    drawingReuseJobId: preparedDrawingReuse.jobId,
                    copiedDrawingCount: preparedDrawingReuse.bindings.length,
                } : {}),
                ...templateBindingAuditMetadata(revisionTemplateBinding),
                ...(templateMigration ? { templateMigration } : {}),
            },
        };
        transaction.create(newEventRef, {
            id: newEventRef.id,
            planId: planRef.id,
            ...event,
            toStatus: 'draft',
        });
        transaction.create(sourceEventRef, {
            id: sourceEventRef.id,
            planId: request.sourcePlanId,
            ...event,
            fromStatus: source.status,
        });
        createMutationClaim(
            transaction,
            claimRef,
            actor.uid,
            operation,
            requestFingerprint,
            response,
            timestamp,
        );
        if (preparedDrawingReuse) {
            transaction.update(
                constructionPlanDrawingReuseJobRef(preparedDrawingReuse.jobId),
                completedConstructionPlanDrawingReuseJobPatch(response as unknown as UnknownRecord, timestamp),
            );
            transaction.create(drawingReuseAuditRef!, {
                id: drawingReuseAuditRef!.id,
                planId: planRef.id,
                siteId,
                seriesId: identity.seriesId,
                type: 'construction_plan_drawings_reused_for_revision',
                actorId: actor.uid,
                at: timestamp,
                requestId: preparedDrawingReuse.jobId,
                sourcePlanId: request.sourcePlanId,
                targetPlanId: planRef.id,
                sourcePlanFingerprint: preparedDrawingReuse.sourcePlanFingerprint,
                copiedDrawingCount: preparedDrawingReuse.bindings.length,
                bindingsHash: sha256Hex(canonicalStringify(preparedDrawingReuse.bindings.map((binding) => ({
                    sourceDrawingId: binding.drawingId,
                    sourceGeneration: binding.sourceGeneration,
                    sourceSha256: binding.sourceSha256,
                    targetDrawingId: binding.targetDrawingId,
                    targetGeneration: binding.targetGeneration,
                    targetStoragePath: binding.targetStoragePath,
                })))),
                reReviewRequired: true,
            });
        }
        transactionWritesQueued = true;
        return response;
        });
    } catch (error) {
        if (!transactionWritesQueued) {
            await cleanupPreparedDrawingReuseAfterPrecommitFailure(preparedDrawingReuse, error);
        }
        throw error;
    }
};

const cloneConstructionPlan = async (
    request: ClonePlanRequest,
    actor: CallableActor,
): Promise<PlanMutationResponse> => {
    const operation = 'clone_plan';
    const claimRef = mutationClaimRef(actor.uid, operation, request.idempotencyKey);
    const requestFingerprint = mutationRequestFingerprint(actor.uid, operation, request);
    const earlyIdempotent = readMutationClaimResponse(await claimRef.get(), operation, requestFingerprint);
    if (earlyIdempotent) return earlyIdempotent;
    const sourceRef = db().collection(PLANS_COLLECTION).doc(request.sourcePlanId);
    const preflightSnapshot = await sourceRef.get();
    const preflightRaw = planData(preflightSnapshot);
    const preflightSource: UnknownRecord = { ...preflightRaw, id: request.sourcePlanId };
    const sourceTemplateBinding = assertConstructionPlanTemplateBindingMatchesPlanIdentity(
        preflightSource.templateBinding,
        preflightSource,
    );
    const sourceTemplateIdentity = {
        tradeType: sourceTemplateBinding.tradeType,
        templateId: sourceTemplateBinding.templateId,
        templateVersion: sourceTemplateBinding.templateVersion,
    };
    const sourceTemplateRef = constructionPlanTemplateDocumentReferenceForIdentity(sourceTemplateIdentity);
    const preflightSourceFingerprint = sha256Hex(canonicalStringify(preflightSource));
    const siteId = readTrimmedString(preflightSource, ['siteId']);
    const sourceDocumentNo = readTrimmedString(preflightSource, ['documentNo']);
    if (!siteId || !sourceDocumentNo) {
        throw new functions.https.HttpsError('failed-precondition', '복제 원본의 현장 또는 문서번호가 없습니다.');
    }
    assertPlanParticipantAccess(preflightSource, actor);
    if (actor.access.isAdmin || actor.access.isOffice) await loadAuthorizedSite(actor, siteId);
    const identity = buildConstructionPlanSeriesIdentity(
        siteId,
        request.documentNo || `${sourceDocumentNo}-COPY`,
    );
    const timestamp = new Date().toISOString();
    const drawingReuseIdentity = request.copyDrawings
        ? buildConstructionPlanDrawingReuseIdentity({
            actorId: actor.uid,
            operation: 'clone',
            idempotencyKey: request.idempotencyKey,
        })
        : undefined;
    const planRef = drawingReuseIdentity
        ? db().collection(PLANS_COLLECTION).doc(drawingReuseIdentity.targetPlanId)
        : db().collection(PLANS_COLLECTION).doc();
    const seriesRef = db().collection(SERIES_COLLECTION).doc(identity.seriesId);
    const newEventRef = planRef.collection('workflowEvents').doc();
    const sourceEventRef = sourceRef.collection('workflowEvents').doc();
    let preparedDrawingReuse: PreparedConstructionPlanDrawingReuse | undefined;
    if (request.copyDrawings) {
        const sourceIdentity = buildConstructionPlanSeriesIdentity(siteId, sourceDocumentNo);
        const recordedSourceSeriesId = readTrimmedString(preflightSource, ['seriesId']);
        if (!recordedSourceSeriesId || recordedSourceSeriesId !== sourceIdentity.seriesId) {
            throw new functions.https.HttpsError(
                'failed-precondition',
                '문서 계보가 없는 legacy 계획서의 도면은 자동 복사할 수 없습니다. 원본 계보를 먼저 복원하세요.',
            );
        }
        const sourceSeriesRef = db().collection(SERIES_COLLECTION).doc(sourceIdentity.seriesId);
        const [
            preflightSourceSeriesSnapshot,
            preflightTargetSeriesSnapshot,
            preflightLegacyCollisionSnapshot,
            preflightTemplateSnapshot,
        ] = await Promise.all([
            sourceSeriesRef.get(),
            seriesRef.get(),
            legacyPlanCollisionQuery(siteId).get(),
            sourceTemplateRef.get(),
        ]);
        if (!preflightSourceSeriesSnapshot.exists) {
            throw new functions.https.HttpsError('failed-precondition', '복제 원본의 시리즈 계보를 찾을 수 없습니다.');
        }
        assertSeriesIdentity(
            preflightSourceSeriesSnapshot.data(),
            sourceIdentity,
            siteId,
            sourceTemplateBinding.tradeType,
        );
        if (preflightTargetSeriesSnapshot.exists) {
            throw new functions.https.HttpsError(
                'already-exists',
                '복제 대상 문서번호가 동일 현장에 이미 존재합니다.',
            );
        }
        assertNoLegacyPlanDocumentNoCollision(
            preflightLegacyCollisionSnapshot,
            siteId,
            identity,
        );
        const sourceTemplateRecord = assertConstructionPlanTemplateSnapshotForExistingPlan(
            sourceTemplateIdentity,
            preflightTemplateSnapshot.exists ? preflightTemplateSnapshot.data() : undefined,
        );
        assertConstructionPlanTemplateBindingMatchesRecord(sourceTemplateBinding, sourceTemplateRecord);
        preparedDrawingReuse = await prepareConstructionPlanDerivedDrawingReuse({
            actorId: actor.uid,
            operation: 'clone',
            idempotencyKey: request.idempotencyKey,
            requestFingerprint,
            sourcePlan: preflightSource,
            targetPlanId: planRef.id,
            timestamp,
        });
    }
    let clonePlan: UnknownRecord;
    try {
        clonePlan = bindConstructionPlanTemplate(buildConstructionPlanCloneDocument(preflightSource, {
            id: planRef.id,
            seriesId: identity.seriesId,
            title: request.title,
            documentNo: identity.documentNo,
            copyDrawings: request.copyDrawings,
            ...(preparedDrawingReuse
                ? { drawingReuseProjection: preparedDrawingReuse.projection }
                : {}),
            actorId: actor.uid,
            actorName: actorNameSnapshot(actor),
            timestamp,
        }), sourceTemplateBinding);
    } catch (error) {
        await cleanupPreparedDrawingReuseAfterPrecommitFailure(preparedDrawingReuse, error);
        return toInvalidPlanInputError(error);
    }
    const response: PlanMutationResponse = {
        planId: planRef.id,
        seriesId: identity.seriesId,
        revisionNo: 0,
        documentNo: identity.documentNo,
        idempotent: false,
    };

    const drawingReuseAuditRef = preparedDrawingReuse
        ? db().collection(AUDIT_COLLECTION).doc(`drawing-reuse-${preparedDrawingReuse.jobId}`)
        : undefined;
    let transactionWritesQueued = false;
    try {
        return await db().runTransaction(async (transaction) => {
        const [
            claimSnapshot,
            latestSourceSnapshot,
            seriesSnapshot,
            legacyCollisionSnapshot,
            sourceTemplateSnapshot,
            drawingReuseJobSnapshot,
        ] = await Promise.all([
            transaction.get(claimRef),
            transaction.get(sourceRef),
            transaction.get(seriesRef),
            transaction.get(legacyPlanCollisionQuery(siteId)),
            transaction.get(sourceTemplateRef),
            preparedDrawingReuse
                ? transaction.get(constructionPlanDrawingReuseJobRef(preparedDrawingReuse.jobId))
                : Promise.resolve(null),
        ]);
        const idempotent = readMutationClaimResponse(claimSnapshot, operation, requestFingerprint);
        if (idempotent) return idempotent;
        const source: UnknownRecord = { ...planData(latestSourceSnapshot), id: request.sourcePlanId };
        assertSameConstructionPlanTemplateBinding(sourceTemplateBinding, source.templateBinding);
        const sourceTemplateRecord = assertConstructionPlanTemplateSnapshotForExistingPlan(
            sourceTemplateIdentity,
            sourceTemplateSnapshot.exists ? sourceTemplateSnapshot.data() : undefined,
        );
        assertConstructionPlanTemplateBindingMatchesRecord(sourceTemplateBinding, sourceTemplateRecord);
        if (preparedDrawingReuse) {
            assertConstructionPlanDrawingReuseJobReady({
                value: drawingReuseJobSnapshot?.data(),
                jobId: preparedDrawingReuse.jobId,
                actorId: actor.uid,
                operation: 'clone',
                requestFingerprint,
                sourcePlanFingerprint: preparedDrawingReuse.sourcePlanFingerprint,
                targetPlanId: planRef.id,
            });
        }
        if (source.siteId !== siteId
            || currentLockVersion(source) !== currentLockVersion(preflightSource)
            || !sameCanonicalValue(source.updatedAt, preflightSource.updatedAt)
            || sha256Hex(canonicalStringify(source)) !== preflightSourceFingerprint) {
            throw new functions.https.HttpsError('aborted', '복제 중 원본 문서가 변경되었습니다.');
        }
        if (seriesSnapshot.exists) {
            throw new functions.https.HttpsError(
                'already-exists',
                '복제 대상 문서번호가 동일 현장에 이미 존재합니다.',
            );
        }
        assertNoLegacyPlanDocumentNoCollision(
            legacyCollisionSnapshot,
            siteId,
            identity,
        );

        transaction.create(seriesRef, buildSeriesDocument(
            identity,
            siteId,
            0,
            planRef.id,
            null,
            actor.uid,
            timestamp,
            clonePlan.tradeType as ConstructionPlanTradeType,
            sourceTemplateBinding,
        ));
        transaction.create(planRef, clonePlan);
        const event = {
            seriesId: identity.seriesId,
            type: 'plan_cloned',
            action: 'plan_cloned',
            actorId: actor.uid,
            ...(actorNameSnapshot(actor) ? { actorName: actorNameSnapshot(actor) } : {}),
            at: timestamp,
            createdAt: timestamp,
            sourcePlanId: request.sourcePlanId,
            targetPlanId: planRef.id,
            revisionNo: 0,
            metadata: {
                copyDrawings: request.copyDrawings,
                organizationAssignmentsReset: true,
                ...(preparedDrawingReuse ? {
                    drawingReuseJobId: preparedDrawingReuse.jobId,
                    copiedDrawingCount: preparedDrawingReuse.bindings.length,
                } : {}),
                ...templateBindingAuditMetadata(sourceTemplateBinding),
            },
        };
        transaction.create(newEventRef, {
            id: newEventRef.id,
            planId: planRef.id,
            ...event,
            toStatus: 'draft',
        });
        transaction.create(sourceEventRef, {
            id: sourceEventRef.id,
            planId: request.sourcePlanId,
            ...event,
            fromStatus: source.status,
        });
        createMutationClaim(
            transaction,
            claimRef,
            actor.uid,
            operation,
            requestFingerprint,
            response,
            timestamp,
        );
        if (preparedDrawingReuse) {
            transaction.update(
                constructionPlanDrawingReuseJobRef(preparedDrawingReuse.jobId),
                completedConstructionPlanDrawingReuseJobPatch(response as unknown as UnknownRecord, timestamp),
            );
            transaction.create(drawingReuseAuditRef!, {
                id: drawingReuseAuditRef!.id,
                planId: planRef.id,
                siteId,
                seriesId: identity.seriesId,
                type: 'construction_plan_drawings_reused_for_clone',
                actorId: actor.uid,
                at: timestamp,
                requestId: preparedDrawingReuse.jobId,
                sourcePlanId: request.sourcePlanId,
                targetPlanId: planRef.id,
                sourcePlanFingerprint: preparedDrawingReuse.sourcePlanFingerprint,
                copiedDrawingCount: preparedDrawingReuse.bindings.length,
                bindingsHash: sha256Hex(canonicalStringify(preparedDrawingReuse.bindings.map((binding) => ({
                    sourceDrawingId: binding.drawingId,
                    sourceGeneration: binding.sourceGeneration,
                    sourceSha256: binding.sourceSha256,
                    targetDrawingId: binding.targetDrawingId,
                    targetGeneration: binding.targetGeneration,
                    targetStoragePath: binding.targetStoragePath,
                })))),
                reReviewRequired: true,
            });
        }
        transactionWritesQueued = true;
        return response;
        });
    } catch (error) {
        if (!transactionWritesQueued) {
            await cleanupPreparedDrawingReuseAfterPrecommitFailure(preparedDrawingReuse, error);
        }
        throw error;
    }
};

const migrateConstructionPlanTemplateBinding = async (
    request: MigrateTemplateBindingRequest,
    actor: CallableActor,
): Promise<PlanMutationResponse> => {
    const operation = 'migrate_template_binding';
    const claimRef = mutationClaimRef(actor.uid, operation, request.idempotencyKey);
    const requestFingerprint = mutationRequestFingerprint(actor.uid, operation, request);
    const earlyIdempotent = readMutationClaimResponse(await claimRef.get(), operation, requestFingerprint);
    if (earlyIdempotent) return earlyIdempotent;

    const planRef = db().collection(PLANS_COLLECTION).doc(request.planId);
    const preflight: UnknownRecord = { ...planData(await planRef.get()), id: request.planId };
    if (preflight.status !== 'draft' && preflight.status !== 'changes_requested') {
        throw new functions.https.HttpsError(
            'failed-precondition',
            'legacy 템플릿 바인딩은 작성 중 또는 수정 요청 문서에서만 마이그레이션할 수 있습니다.',
        );
    }
    if (preflight.templateBinding !== undefined) {
        throw new functions.https.HttpsError('failed-precondition', '이미 서버 게시 템플릿에 바인딩된 문서입니다.');
    }
    assertExpectedLockVersion(preflight, request.expectedLockVersion);
    assertPlanParticipantAccess(preflight, actor);
    const siteId = readTrimmedString(preflight, ['siteId']);
    const documentNo = readTrimmedString(preflight, ['documentNo']);
    const seriesId = readTrimmedString(preflight, ['seriesId']);
    const revisionNo = Number(preflight.revision);
    if (!siteId || !documentNo || !seriesId || !Number.isInteger(revisionNo) || revisionNo < 0) {
        throw new functions.https.HttpsError(
            'failed-precondition',
            '계보가 없는 legacy 문서는 자동 바인딩할 수 없습니다. 관리자가 계보를 먼저 복원해야 합니다.',
        );
    }
    if (actor.access.isAdmin || actor.access.isOffice) await loadAuthorizedSite(actor, siteId);
    const identity = buildConstructionPlanSeriesIdentity(siteId, documentNo);
    if (identity.seriesId !== seriesId) {
        throw new functions.https.HttpsError('data-loss', 'legacy 문서의 seriesId와 문서번호가 일치하지 않습니다.');
    }
    const contract = resolveConstructionPlanRecordTemplate(preflight);
    const templateIdentity = {
        tradeType: contract.tradeType,
        templateId: contract.templateId,
        templateVersion: contract.templateVersion,
    };
    const templateRef = constructionPlanTemplateDocumentReferenceForIdentity(templateIdentity);
    const seriesRef = db().collection(SERIES_COLLECTION).doc(seriesId);
    const eventRef = planRef.collection('workflowEvents').doc();
    const preflightFingerprint = sha256Hex(canonicalStringify(preflight));
    const timestamp = new Date().toISOString();

    return db().runTransaction(async (transaction) => {
        const [claimSnapshot, planSnapshot, seriesSnapshot, templateSnapshot] = await Promise.all([
            transaction.get(claimRef),
            transaction.get(planRef),
            transaction.get(seriesRef),
            transaction.get(templateRef),
        ]);
        const idempotent = readMutationClaimResponse(claimSnapshot, operation, requestFingerprint);
        if (idempotent) return idempotent;
        const plan: UnknownRecord = { ...planData(planSnapshot), id: request.planId };
        if ((plan.status !== 'draft' && plan.status !== 'changes_requested')
            || plan.templateBinding !== undefined
            || sha256Hex(canonicalStringify(plan)) !== preflightFingerprint) {
            throw new functions.https.HttpsError('aborted', '마이그레이션 중 계획서가 변경되었습니다. 새로고침 후 다시 시도하세요.');
        }
        assertExpectedLockVersion(plan, request.expectedLockVersion);
        if (!seriesSnapshot.exists) {
            throw new functions.https.HttpsError('failed-precondition', 'legacy 문서 계보가 없어 템플릿을 바인딩할 수 없습니다.');
        }
        const series = assertSeriesIdentity(seriesSnapshot.data(), identity, siteId, contract.tradeType);
        if (series.latestPlanId !== request.planId || Number(series.latestRevisionNo) !== revisionNo) {
            throw new functions.https.HttpsError('failed-precondition', '계보의 최신 초안만 템플릿 바인딩을 마이그레이션할 수 있습니다.');
        }
        const templateRecord = assertPublishedConstructionPlanTemplateSnapshotForNewDraft(
            templateIdentity,
            templateSnapshot.exists ? templateSnapshot.data() : undefined,
        );
        const binding = buildConstructionPlanTemplateBinding(templateRecord, timestamp);
        const projection = constructionPlanTemplateBindingProjection(binding);
        const releaseReadiness = isUnknownRecord(plan.releaseReadiness)
            ? { ...plan.releaseReadiness }
            : {};
        Object.assign(releaseReadiness, {
            requiredReviewsComplete: false,
            snapshotHashMatches: false,
            pdfVisualCheckPassed: false,
            pdfTextCheckPassed: false,
        });
        const nextLockVersion = currentLockVersion(plan) + 1;
        transaction.update(planRef, {
            templateBinding: binding,
            ...projection,
            status: 'draft',
            releaseReadiness,
            validationSummary: {
                errors: 1,
                warnings: 0,
                checkedAt: timestamp,
            },
            lockVersion: nextLockVersion,
            updatedBy: actor.uid,
            updatedAt: timestamp,
            activeReviewSnapshotId: admin.firestore.FieldValue.delete(),
            activeReviewSnapshotHash: admin.firestore.FieldValue.delete(),
            activeReviewSnapshotStoragePath: admin.firestore.FieldValue.delete(),
            activeReviewSnapshotLockVersion: admin.firestore.FieldValue.delete(),
            activeReviewPackageId: admin.firestore.FieldValue.delete(),
            activeReviewCycleId: admin.firestore.FieldValue.delete(),
            approvedSnapshotId: admin.firestore.FieldValue.delete(),
            approvedSnapshotHash: admin.firestore.FieldValue.delete(),
            approvedSnapshotStoragePath: admin.firestore.FieldValue.delete(),
            approvedEvidenceId: admin.firestore.FieldValue.delete(),
            approvedEvidenceHash: admin.firestore.FieldValue.delete(),
            approverName: admin.firestore.FieldValue.delete(),
            approvedAt: admin.firestore.FieldValue.delete(),
        });
        transaction.update(seriesRef, {
            templateBinding: binding,
            ...projection,
            updatedBy: actor.uid,
            updatedAt: timestamp,
        });
        transaction.create(eventRef, {
            id: eventRef.id,
            planId: request.planId,
            seriesId,
            type: 'template_binding_migrated',
            action: 'template_binding_migrated',
            actorId: actor.uid,
            ...(actorNameSnapshot(actor) ? { actorName: actorNameSnapshot(actor) } : {}),
            at: timestamp,
            createdAt: timestamp,
            fromStatus: plan.status,
            toStatus: 'draft',
            reason: request.reason,
            revisionNo,
            metadata: {
                reviewResetRequired: true,
                ...templateBindingAuditMetadata(binding),
            },
        });
        const response: PlanMutationResponse = {
            planId: request.planId,
            seriesId,
            revisionNo,
            documentNo,
            idempotent: false,
        };
        createMutationClaim(
            transaction,
            claimRef,
            actor.uid,
            operation,
            requestFingerprint,
            response,
            timestamp,
        );
        return response;
    });
};

const planUpdatedEpoch = (plan: UnknownRecord): number => {
    const updatedAt = readTrimmedString(plan, ['updatedAt', 'createdAt']);
    const parsed = updatedAt ? Date.parse(updatedAt) : Number.NaN;
    return Number.isFinite(parsed) ? parsed : 0;
};

const listConstructionPlansForActor = async (
    request: ListPlansRequest,
    actor: CallableActor,
): Promise<ListPlansResponse> => {
    const officeScope = actor.access.isAdmin || actor.access.isOffice;
    if (officeScope && request.siteId) await loadAuthorizedSite(actor, request.siteId);
    const snapshots = officeScope
        ? [await (request.siteId
            ? db().collection(PLANS_COLLECTION).where('siteId', '==', request.siteId)
            : db().collection(PLANS_COLLECTION))
            .limit(MAX_PLAN_LIST_RESULTS)
            .get()]
        : await Promise.all([
            db().collection(PLANS_COLLECTION)
                .where('createdBy', '==', actor.uid)
                .limit(MAX_PLAN_LIST_RESULTS)
                .get(),
            ...['authorIds', 'reviewerIds', 'approverIds'].map((field) => db()
                .collection(PLANS_COLLECTION)
                .where(`participants.${field}`, 'array-contains', actor.uid)
                .limit(MAX_PLAN_LIST_RESULTS)
                .get()),
        ]);
    const plansById = new Map<string, UnknownRecord>();
    snapshots.forEach((snapshot) => snapshot.docs.forEach((document) => {
        const plan = callablePlanDocument(document);
        const siteId = readTrimmedString(plan, ['siteId']);
        if (!siteId || (request.siteId && request.siteId !== siteId)) return;
        if (!officeScope && !isConstructionPlanParticipant(plan, actor.uid)) return;
        plansById.set(document.id, plan);
    }));

    const statuses = request.statuses ? new Set(request.statuses) : null;
    const search = request.search?.normalize('NFKC').trim().toLowerCase();
    const plans = Array.from(plansById.values())
        .filter((plan) => {
            const status = readTrimmedString(plan, ['status']);
            if (statuses && (!status || !statuses.has(status))) return false;
            if (!search) return true;
            const project = isUnknownRecord(plan.projectSnapshot) ? plan.projectSnapshot : {};
            const searchable = [
                readTrimmedString(plan, ['title']),
                readTrimmedString(plan, ['documentNo']),
                readTrimmedString(project, ['siteName']),
                readTrimmedString(project, ['contractorName']),
            ].filter((value): value is string => Boolean(value)).join(' ').normalize('NFKC').toLowerCase();
            return searchable.includes(search);
        })
        .sort((left, right) => planUpdatedEpoch(right) - planUpdatedEpoch(left))
        .slice(0, request.limit);
    return { plans };
};

const CONSTRUCTION_PLAN_SUMMARY_FIELDS = [
    'id', 'seriesId', 'lineageRootPlanId', 'siteId', 'title', 'tradeType',
    'documentNo', 'documentDate', 'revision', 'status', 'revisionReason',
    'revisionType', 'sourceRevisionNo', 'sourceSnapshotHash', 'clonedFromPlanId',
    'supersedesPlanId', 'supersededByPlanId', 'approvedSnapshotHash',
    'issuedExportId', 'issuedExportStoragePath', 'issuedExportSha256',
    'issuedExportFileName', 'issuedAt', 'issuedBy', 'createdBy', 'createdByName',
    'createdAt', 'updatedBy', 'updatedAt',
] as const;

const summarizeCallablePlan = (plan: UnknownRecord): UnknownRecord =>
    CONSTRUCTION_PLAN_SUMMARY_FIELDS.reduce<UnknownRecord>((summary, field) => {
        if (plan[field] !== undefined) summary[field] = plan[field];
        return summary;
    }, {});

const getConstructionPlanLineageForActor = async (
    planId: string,
    actor: CallableActor,
): Promise<UnknownRecord> => {
    const currentSnapshot = await db().collection(PLANS_COLLECTION).doc(planId).get();
    const current = callablePlanDocument(currentSnapshot);
    const siteId = readTrimmedString(current, ['siteId']);
    const documentNo = readTrimmedString(current, ['documentNo']);
    if (!siteId || !documentNo) {
        throw new functions.https.HttpsError('data-loss', '시공계획서 현장 또는 문서번호가 없습니다.');
    }
    assertPlanParticipantAccess(current, actor);
    if (actor.access.isAdmin || actor.access.isOffice) await loadAuthorizedSite(actor, siteId);
    const recordedSeriesId = readTrimmedString(current, ['seriesId']);
    let series: UnknownRecord | undefined;
    let plans: UnknownRecord[] = [current];

    if (recordedSeriesId) {
        const [seriesSnapshot, plansSnapshot] = await Promise.all([
            db().collection(SERIES_COLLECTION).doc(recordedSeriesId).get(),
            db().collection(PLANS_COLLECTION)
                .where('seriesId', '==', recordedSeriesId)
                .limit(MAX_PLAN_LIST_RESULTS)
                .get(),
        ]);
        if (seriesSnapshot.exists) {
            const normalizedSeries = callableFirestoreValue(seriesSnapshot.data());
            if (!isUnknownRecord(normalizedSeries)) {
                throw new functions.https.HttpsError('data-loss', '시공계획서 시리즈 데이터가 손상되었습니다.');
            }
            series = { ...normalizedSeries, id: seriesSnapshot.id };
        }
        plans = plansSnapshot.docs.map(callablePlanDocument);
        if (plans.some((plan) => readTrimmedString(plan, ['siteId']) !== siteId)) {
            throw new functions.https.HttpsError('data-loss', '시공계획서 계보의 현장 범위가 손상되었습니다.');
        }
        if (!plans.some((plan) => plan.id === planId)) plans.push(current);
    }

    plans.sort((left, right) => (
        Number(left.revision) - Number(right.revision)
        || planUpdatedEpoch(left) - planUpdatedEpoch(right)
    ));
    const latest = plans[plans.length - 1] ?? current;
    const latestIssued = [...plans].reverse().find((plan) => (
        plan.status === 'issued' || plan.status === 'superseded' || Boolean(plan.issuedExportId)
    ));
    const identity = buildConstructionPlanSeriesIdentity(siteId, documentNo);
    let lineageTemplate: ReturnType<typeof resolveConstructionPlanRecordTemplate>;
    try {
        lineageTemplate = resolveConstructionPlanRecordTemplate(current, true);
    } catch {
        throw new functions.https.HttpsError('data-loss', '시공계획서 계보의 공종·템플릿 식별자가 손상되었습니다.');
    }
    if (!series) {
        series = {
            id: recordedSeriesId || `legacy-${planId}`,
            siteId,
            documentNo: identity.documentNo,
            documentNoKey: identity.documentNoKey,
            tradeType: lineageTemplate.tradeType,
            latestRevisionNo: Number.isInteger(latest.revision) ? Number(latest.revision) : 0,
            latestPlanId: String(latest.id),
            ...(latestIssued ? { latestIssuedPlanId: String(latestIssued.id) } : {}),
        };
    } else if (series.siteId !== siteId
        || series.documentNoKey !== identity.documentNoKey
        || series.tradeType !== lineageTemplate.tradeType) {
        throw new functions.https.HttpsError('data-loss', '시공계획서 시리즈 식별자가 현재 문서와 일치하지 않습니다.');
    }
    const summaries = plans.map(summarizeCallablePlan);
    const currentIndex = summaries.findIndex((plan) => plan.id === planId);
    if (currentIndex < 0) {
        throw new functions.https.HttpsError('data-loss', '현재 문서가 시공계획서 계보에 없습니다.');
    }
    return {
        series,
        plans: summaries,
        currentIndex,
        ...(currentIndex > 0 ? { previous: summaries[currentIndex - 1] } : {}),
        ...(currentIndex < summaries.length - 1 ? { next: summaries[currentIndex + 1] } : {}),
    };
};

export const createConstructionPlanDraftServer = constructionPlanRunner.https.onCall(
    async (data: unknown, context): Promise<PlanMutationResponse> => {
        const request = parseCreateDraftRequest(data);
        const actor = await resolveCallableActor(context);
        requirePlanMutationAccess(actor);
        return createConstructionPlanDraft(request, actor);
    },
);

export const createConstructionPlanRevisionServer = constructionPlanRunner.https.onCall(
    async (data: unknown, context): Promise<PlanMutationResponse> => {
        const request = parseCreateRevisionRequest(data);
        const actor = await resolveCallableActor(context);
        requirePlanMutationAccess(actor);
        return createConstructionPlanRevision(request, actor);
    },
);

export const cloneConstructionPlanServer = constructionPlanRunner.https.onCall(
    async (data: unknown, context): Promise<PlanMutationResponse> => {
        const request = parseClonePlanRequest(data);
        const actor = await resolveCallableActor(context);
        requirePlanMutationAccess(actor);
        return cloneConstructionPlan(request, actor);
    },
);

export const migrateConstructionPlanTemplateBindingServer = constructionPlanRunner.https.onCall(
    async (data: unknown, context): Promise<PlanMutationResponse> => {
        const request = parseMigrateTemplateBindingRequest(data);
        const actor = await resolveCallableActor(context);
        requirePlanMutationAccess(actor);
        return migrateConstructionPlanTemplateBinding(request, actor);
    },
);

export const listConstructionPlansServer = constructionPlanRunner.https.onCall(
    async (data: unknown, context): Promise<ListPlansResponse> => {
        const request = parseListPlansRequest(data);
        const actor = await resolveCallableActor(context);
        requirePlanMutationAccess(actor);
        return listConstructionPlansForActor(request, actor);
    },
);

export const getConstructionPlanLineageServer = constructionPlanRunner.https.onCall(
    async (data: unknown, context): Promise<UnknownRecord> => {
        const record = asCallableRecord(data);
        const planId = requireDocumentId(record, 'planId');
        const actor = await resolveCallableActor(context);
        requirePlanMutationAccess(actor);
        return getConstructionPlanLineageForActor(planId, actor);
    },
);

/**
 * Server privacy boundary for worker candidates. The legacy workers documents
 * still mix directory and sensitive HR/payroll fields; this callable performs
 * scoped queries and immediately returns a fixed whitelist projection only.
 */
export const getConstructionPlanSafeWorkers = constructionPlanRunner.https.onCall(
    async (data: unknown, context): Promise<{
        siteId: string;
        responsibleTeamId?: string;
        workers: SafeWorkerDirectoryEntry[];
    }> => {
        const actor = await resolveCallableActor(context);
        requireDirectoryAccess(actor);
        const record = asCallableRecord(data);
        const siteId = requireDocumentId(record, 'siteId');
        const suppliedTeamId = readOptionalString(record, 'responsibleTeamId', 200);
        const includeInactive = record.includeInactive === true;
        if (includeInactive && !actor.access.canReviewApproveIssue) {
            throw new functions.https.HttpsError('permission-denied', '비활성 작업자 조회는 본사 또는 관리자만 가능합니다.');
        }

        const siteSnapshot = await db().collection(SITES_COLLECTION).doc(siteId).get();
        if (!siteSnapshot.exists || !isUnknownRecord(siteSnapshot.data())) {
            throw new functions.https.HttpsError('not-found', '현장을 찾을 수 없습니다.');
        }
        const site = siteSnapshot.data() as UnknownRecord;
        const canonicalTeamId = readTrimmedString(site, ['responsibleTeamId']);
        if (canonicalTeamId && suppliedTeamId && canonicalTeamId !== suppliedTeamId) {
            throw new functions.https.HttpsError('failed-precondition', '요청한 담당팀이 현장 마스터와 일치하지 않습니다.');
        }
        const responsibleTeamId = canonicalTeamId || suppliedTeamId;
        await assertSiteActorScope(actor, siteId, responsibleTeamId, site);

        const workers = await loadSafeWorkerDirectoryForSite(
            siteId,
            responsibleTeamId,
            includeInactive,
            Array.from(collectScopedIds(site, [
                'managerId', 'managerUid', 'siteManagerId', 'siteManagerUid',
                'responsibleManagerId', 'responsibleManagerUid', 'managerIds', 'managerUids',
            ])),
        );
        return {
            siteId,
            ...(responsibleTeamId ? { responsibleTeamId } : {}),
            workers,
        };
    },
);

const planParticipantIds = (plan: UnknownRecord, key: 'authorIds' | 'reviewerIds' | 'approverIds'): string[] => {
    const participants = isUnknownRecord(plan.participants) ? plan.participants : {};
    return stringList(participants[key]);
};

const canCreateReviewComment = (plan: UnknownRecord, actor: CallableActor): boolean =>
    actor.access.isAdmin
    || actor.access.isOffice
    || planParticipantIds(plan, 'reviewerIds').includes(actor.uid)
    || planParticipantIds(plan, 'approverIds').includes(actor.uid);

const canViewReviewComment = (plan: UnknownRecord, comment: UnknownRecord, actor: CallableActor): boolean => {
    if (actor.access.isAdmin || actor.access.isOffice) return true;
    const visibility = readTrimmedString(comment, ['visibility']);
    if (visibility === 'participants') return isConstructionPlanParticipant(plan, actor.uid);
    if (visibility === 'reviewers_and_approvers') {
        return planParticipantIds(plan, 'reviewerIds').includes(actor.uid)
            || planParticipantIds(plan, 'approverIds').includes(actor.uid);
    }
    return false;
};

const reviewCommentPermissions = (
    plan: UnknownRecord,
    comment: UnknownRecord,
    actor: CallableActor,
): UnknownRecord => {
    const visible = canViewReviewComment(plan, comment, actor);
    const participant = isConstructionPlanParticipant(plan, actor.uid)
        || actor.access.isAdmin || actor.access.isOffice;
    const resolver = actor.access.isAdmin || actor.access.isOffice
        || comment.createdBy === actor.uid
        || planParticipantIds(plan, 'reviewerIds').includes(actor.uid)
        || planParticipantIds(plan, 'approverIds').includes(actor.uid);
    const editableReview = ['in_review', 'changes_requested'].includes(String(plan.status));
    return {
        canReply: visible && participant && editableReview,
        canAddress: visible && canAddressConstructionPlanReviewComment({
            planCreatedBy: readTrimmedString(plan, ['createdBy']),
            authorIds: planParticipantIds(plan, 'authorIds'),
            actorId: actor.uid,
            isCentral: actor.access.isAdmin || actor.access.isOffice,
            planStatus: String(plan.status),
            commentStatus: String(comment.status),
            authorReplyCount: Number(comment.authorReplyCount),
        }),
        canResolve: visible && resolver && editableReview
            && ['open', 'addressed'].includes(String(comment.status)),
        canReopen: visible && resolver && plan.status === 'changes_requested'
            && comment.status === 'resolved',
    };
};

const decorateReviewComment = (
    plan: UnknownRecord,
    comment: UnknownRecord,
    actor: CallableActor,
    activeEnvelope?: UnknownRecord,
): UnknownRecord => ({
    ...comment,
    anchorStatus: reviewCommentAnchorStatus(plan, comment, activeEnvelope),
    permissions: reviewCommentPermissions(plan, comment, actor),
});

const findSnapshotEntity = (content: UnknownRecord, anchor: UnknownRecord): UnknownRecord | undefined => {
    const entityType = readTrimmedString(anchor, ['entityType']);
    const entityId = readTrimmedString(anchor, ['entityId']);
    if (!entityType || !entityId) return undefined;
    if (entityType === 'plan') return entityId === content.planId ? content : undefined;
    let entries: unknown = [];
    let keys: readonly string[] = ['id'];
    if (entityType === 'section') entries = content.sections;
    else if (entityType === 'engineering_value') {
        entries = content.engineeringValues;
        keys = ['key'];
    } else if (entityType === 'equipment_item') entries = content.equipmentPlan;
    else if (entityType === 'risk_assessment') entries = content.riskAssessments;
    else if (entityType === 'organization_assignment') {
        const organization = isUnknownRecord(content.organizationSnapshot) ? content.organizationSnapshot : {};
        entries = organization.assignments;
    }
    if (!Array.isArray(entries)) return undefined;
    return entries.find((entry) => isUnknownRecord(entry) && keys.some((key) => entry[key] === entityId));
};

const assertReviewCommentAnchorExists = (snapshotEnvelope: UnknownRecord, anchor: UnknownRecord): void => {
    const content = isUnknownRecord(snapshotEnvelope.content) ? snapshotEnvelope.content : {};
    const kind = readTrimmedString(anchor, ['kind']);
    if (kind === 'plan') return;
    if (kind === 'section') {
        const sectionId = readTrimmedString(anchor, ['sectionId']);
        if (!Array.isArray(content.sections)
            || !content.sections.some((entry) => isUnknownRecord(entry)
                && (entry.id === sectionId || entry.key === sectionId))) {
            throw new functions.https.HttpsError('failed-precondition', '댓글 section anchor가 스냅샷에 없습니다.');
        }
        return;
    }
    if (kind === 'field') {
        const entity = findSnapshotEntity(content, anchor);
        const pointer = readTrimmedString(anchor, ['jsonPointer']);
        if (!entity || !pointer || !hasStableConstructionPlanReviewJsonPointer(entity, pointer)) {
            throw new functions.https.HttpsError('failed-precondition', '댓글 field anchor가 스냅샷에 없습니다.');
        }
        return;
    }
    if (kind === 'drawing') {
        const drawingId = readTrimmedString(anchor, ['drawingId']);
        const drawing = Array.isArray(content.drawings)
            ? content.drawings.find((entry) => isUnknownRecord(entry) && entry.id === drawingId)
            : undefined;
        if (classifyConstructionPlanDrawingReviewAnchor(drawing, anchor) !== 'valid') {
            throw new functions.https.HttpsError('failed-precondition', '댓글 drawing page anchor가 스냅샷과 일치하지 않습니다.');
        }
        return;
    }
    throw new functions.https.HttpsError('invalid-argument', '댓글 anchor가 올바르지 않습니다.');
};

const reviewCommentAnchorStatus = (
    plan: UnknownRecord,
    comment: UnknownRecord,
    activeEnvelope?: UnknownRecord,
): 'active' | 'carried' | 'stale' | 'orphaned' => {
    if (comment.reviewPackageId === plan.activeReviewPackageId) return 'active';
    if (!activeEnvelope || !isUnknownRecord(comment.anchor)) return 'orphaned';
    try {
        assertReviewCommentAnchorExists(activeEnvelope, comment.anchor);
        return 'carried';
    } catch (_error) {
        const anchor = comment.anchor;
        if (anchor.kind === 'drawing') {
            const content = isUnknownRecord(activeEnvelope.content) ? activeEnvelope.content : {};
            const drawing = Array.isArray(content.drawings)
                ? content.drawings.find((entry) => isUnknownRecord(entry) && entry.id === anchor.drawingId)
                : undefined;
            const classification = classifyConstructionPlanDrawingReviewAnchor(drawing, anchor);
            if (classification === 'stale') return 'stale';
        }
        return 'orphaned';
    }
};

const callableReviewRecord = (snapshot: admin.firestore.DocumentSnapshot): UnknownRecord => {
    const raw = snapshot.data();
    if (!snapshot.exists || !isUnknownRecord(raw)) {
        throw new functions.https.HttpsError('not-found', '검토 데이터를 찾을 수 없습니다.');
    }
    const normalized = callableFirestoreValue(raw);
    return isUnknownRecord(normalized) ? { ...normalized, id: snapshot.id } : { id: snapshot.id };
};

const createReviewComment = async (
    request: CreateReviewCommentRequest,
    actor: CallableActor,
): Promise<UnknownRecord> => {
    const planRef = db().collection(PLANS_COLLECTION).doc(request.planId);
    const preflightPlan = planData(await planRef.get());
    assertPlanParticipantAccess(preflightPlan, actor);
    const commentId = `comment-${buildConstructionPlanMutationClaimId(
        actor.uid,
        `review-comment:${request.planId}`,
        request.requestId,
    ).slice(0, 24)}`;
    const commentRef = planRef.collection('comments').doc(commentId);
    const preflightExisting = await commentRef.get();
    if (preflightExisting.exists) {
        const existing = callableReviewRecord(preflightExisting);
        const existingPackageId = readTrimmedString(existing, ['reviewPackageId']);
        const retryFingerprint = sha256Hex(canonicalStringify({
            ...request,
            reviewPackageId: existingPackageId,
            actorId: actor.uid,
        }));
        if (!existingPackageId
            || (request.reviewPackageId && request.reviewPackageId !== existingPackageId)
            || existing.requestFingerprint !== retryFingerprint) {
            throw new functions.https.HttpsError('already-exists', '같은 requestId가 다른 의견에 사용되었습니다.');
        }
        if (!canViewReviewComment(preflightPlan, existing, actor)) {
            throw new functions.https.HttpsError('permission-denied', '의견을 조회할 권한이 없습니다.');
        }
        // A deterministic requestId retry must recover the committed result even
        // after the plan has advanced to review_completed/changes_requested.
        // Participant access and per-comment visibility are still re-evaluated.
        const { requestFingerprint: _fingerprint, ...response } = existing;
        return response;
    }
    if (!canCreateReviewComment(preflightPlan, actor)) {
        throw new functions.https.HttpsError('permission-denied', '검토자·승인자 또는 본사 권한만 의견을 생성할 수 있습니다.');
    }
    if (preflightPlan.status !== 'in_review') {
        throw new functions.https.HttpsError('failed-precondition', '검토 진행 중인 package에만 의견을 생성할 수 있습니다.');
    }
    const packageId = readTrimmedString(preflightPlan, ['activeReviewPackageId']);
    const cycleId = readTrimmedString(preflightPlan, ['activeReviewCycleId']);
    const snapshotId = readTrimmedString(preflightPlan, ['activeReviewSnapshotId']);
    const snapshotHash = readTrimmedString(preflightPlan, ['activeReviewSnapshotHash']);
    const snapshotPath = readTrimmedString(preflightPlan, ['activeReviewSnapshotStoragePath']);
    if (!packageId || !cycleId || !snapshotId || !snapshotHash || !snapshotPath
        || (request.reviewPackageId && request.reviewPackageId !== packageId)) {
        throw new functions.https.HttpsError('failed-precondition', '활성 검토 package 바인딩이 올바르지 않습니다.');
    }
    const envelope = await readImmutableSnapshotContent(snapshotPath, snapshotHash);
    assertReviewCommentAnchorExists(envelope, request.anchor);

    const packageRef = planRef.collection('reviewPackages').doc(packageId);
    const cycleRef = planRef.collection('reviewCycles').doc(cycleId);
    const requestFingerprint = sha256Hex(canonicalStringify({ ...request, reviewPackageId: packageId, actorId: actor.uid }));
    return db().runTransaction(async (transaction): Promise<UnknownRecord> => {
        const [planSnapshot, packageSnapshot, cycleSnapshot, existingComment] = await Promise.all([
            transaction.get(planRef), transaction.get(packageRef),
            transaction.get(cycleRef), transaction.get(commentRef),
        ]);
        const plan = planData(planSnapshot);
        assertPlanParticipantAccess(plan, actor);
        if (!canCreateReviewComment(plan, actor)) {
            throw new functions.https.HttpsError('permission-denied', '의견 생성 권한이 없습니다.');
        }
        if (existingComment.exists) {
            if (existingComment.data()?.requestFingerprint !== requestFingerprint) {
                throw new functions.https.HttpsError('already-exists', '같은 requestId가 다른 의견에 사용되었습니다.');
            }
            const { requestFingerprint: _fingerprint, ...existing } = callableReviewRecord(existingComment);
            return existing;
        }
        const packageData = packageSnapshot.data();
        const cycle = cycleSnapshot.data();
        if (plan.status !== 'in_review'
            || plan.activeReviewPackageId !== packageId
            || plan.activeReviewCycleId !== cycleId
            || plan.activeReviewSnapshotId !== snapshotId
            || plan.activeReviewSnapshotHash !== snapshotHash
            || !packageSnapshot.exists || !isUnknownRecord(packageData)
            || packageData.status !== 'active'
            || packageData.reviewSnapshotId !== snapshotId
            || packageData.reviewSnapshotHash !== snapshotHash
            || !cycleSnapshot.exists || !isUnknownRecord(cycle)
            || cycle.activePackageId !== packageId || cycle.frozen === true) {
            throw new functions.https.HttpsError('aborted', '의견 생성 중 활성 검토 package가 변경되었습니다.');
        }
        const timestamp = new Date().toISOString();
        // The plan/package summary is readable by every participant. Hidden
        // non-blocking threads are intentionally excluded so counters cannot
        // become a cross-visibility existence side channel. Required threads
        // are always participant-visible at the parser boundary.
        const countedInParticipantSummary = request.visibility === 'participants';
        const nextSummary = countedInParticipantSummary
            ? applyConstructionPlanReviewCommentTransition(cycle.commentSummary, null, 'open', request.required)
            : authoritativeReviewSummary(cycle.commentSummary);
        const summaryRecord = summaryWithTimestamp(nextSummary, timestamp);
        const comment: UnknownRecord = {
            id: commentId,
            planId: request.planId,
            reviewPackageId: packageId,
            reviewSnapshotId: snapshotId,
            reviewSnapshotHash: snapshotHash,
            reviewCycleId: cycleId,
            anchor: request.anchor,
            visibility: request.visibility,
            required: request.required,
            body: request.body,
            status: 'open',
            version: 0,
            replyCount: 0,
            authorReplyCount: 0,
            createdBy: actor.uid,
            ...(actorNameSnapshot(actor) ? { createdByName: actorNameSnapshot(actor) } : {}),
            createdAt: timestamp,
            updatedAt: timestamp,
            requestFingerprint,
        };
        transaction.create(commentRef, comment);
        if (countedInParticipantSummary) {
            transaction.update(cycleRef, { commentSummary: summaryRecord, updatedAt: timestamp });
            transaction.update(packageRef, { commentSummary: summaryRecord, updatedAt: timestamp });
            transaction.update(planRef, {
                commentSummary: summaryRecord,
                'releaseReadiness.unresolvedRequiredComments': nextSummary.unresolvedRequired,
            });
        }
        const { requestFingerprint: _fingerprint, ...response } = comment;
        return response;
    });
};

const listReviewComments = async (
    request: ListReviewCommentsRequest,
    actor: CallableActor,
): Promise<UnknownRecord[]> => {
    const planRef = db().collection(PLANS_COLLECTION).doc(request.planId);
    const plan = planData(await planRef.get());
    assertPlanParticipantAccess(plan, actor);
    let cycleId = readTrimmedString(plan, ['activeReviewCycleId']);
    if (request.reviewPackageId) {
        const packageSnapshot = await planRef.collection('reviewPackages').doc(request.reviewPackageId).get();
        const packageData = packageSnapshot.data();
        if (!packageSnapshot.exists || !isUnknownRecord(packageData)) {
            throw new functions.https.HttpsError('not-found', '검토 package를 찾을 수 없습니다.');
        }
        cycleId = readTrimmedString(packageData, ['reviewCycleId']);
    }
    if (!cycleId) return [];
    const activeEnvelope = await loadActiveReviewSnapshotContent(plan);
    const snapshots = await planRef.collection('comments')
        .where('reviewCycleId', '==', cycleId)
        .limit(MAX_REVIEW_COMMENT_RESULTS)
        .get();
    return snapshots.docs
        .map((snapshot) => callableReviewRecord(snapshot))
        .filter((comment) => canViewReviewComment(plan, comment, actor))
        .map(({ requestFingerprint: _fingerprint, ...comment }) => decorateReviewComment(
            plan,
            comment,
            actor,
            activeEnvelope,
        ))
        .sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt)));
};

const replyReviewComment = async (
    request: ReplyReviewCommentRequest,
    actor: CallableActor,
): Promise<UnknownRecord> => {
    const planRef = db().collection(PLANS_COLLECTION).doc(request.planId);
    const commentRef = planRef.collection('comments').doc(request.commentId);
    const messageId = `message-${buildConstructionPlanMutationClaimId(
        actor.uid,
        `review-reply:${request.planId}:${request.commentId}`,
        request.requestId,
    ).slice(0, 24)}`;
    const messageRef = commentRef.collection('messages').doc(messageId);
    const requestFingerprint = sha256Hex(canonicalStringify({ ...request, actorId: actor.uid }));
    return db().runTransaction(async (transaction): Promise<UnknownRecord> => {
        const [planSnapshot, commentSnapshot, existingMessage] = await Promise.all([
            transaction.get(planRef), transaction.get(commentRef), transaction.get(messageRef),
        ]);
        const plan = planData(planSnapshot);
        assertPlanParticipantAccess(plan, actor);
        const comment = callableReviewRecord(commentSnapshot);
        if (!canViewReviewComment(plan, comment, actor)) {
            throw new functions.https.HttpsError('permission-denied', '이 의견에 답글을 작성할 권한이 없습니다.');
        }
        if (existingMessage.exists) {
            if (existingMessage.data()?.requestFingerprint !== requestFingerprint) {
                throw new functions.https.HttpsError('already-exists', '같은 requestId가 다른 답글에 사용되었습니다.');
            }
            const { requestFingerprint: _fingerprint, ...existing } = callableReviewRecord(existingMessage);
            return existing;
        }
        const cycleId = readTrimmedString(comment, ['reviewCycleId']);
        if (!cycleId || plan.activeReviewCycleId !== cycleId
            || !['in_review', 'changes_requested'].includes(String(plan.status))) {
            throw new functions.https.HttpsError('failed-precondition', '종료된 검토 cycle에는 답글을 추가할 수 없습니다.');
        }
        const cycleRef = planRef.collection('reviewCycles').doc(cycleId);
        const cycleSnapshot = await transaction.get(cycleRef);
        if (!cycleSnapshot.exists || cycleSnapshot.data()?.frozen === true) {
            throw new functions.https.HttpsError('failed-precondition', '동결된 검토 cycle에는 답글을 추가할 수 없습니다.');
        }
        const timestamp = new Date().toISOString();
        const replyWasWrittenByPlanAuthor = isPlanAuthor(plan, actor.uid);
        const message: UnknownRecord = {
            id: messageId,
            planId: request.planId,
            commentId: request.commentId,
            body: request.body,
            createdBy: actor.uid,
            ...(actorNameSnapshot(actor) ? { createdByName: actorNameSnapshot(actor) } : {}),
            createdAt: timestamp,
            requestFingerprint,
        };
        transaction.create(messageRef, message);
        transaction.update(commentRef, {
            replyCount: (Number.isInteger(comment.replyCount) ? Number(comment.replyCount) : 0) + 1,
            authorReplyCount: (Number.isInteger(comment.authorReplyCount) ? Number(comment.authorReplyCount) : 0)
                + (replyWasWrittenByPlanAuthor ? 1 : 0),
            version: Number(comment.version) + 1,
            updatedAt: timestamp,
        });
        const { requestFingerprint: _fingerprint, ...response } = message;
        return response;
    });
};

const listReviewMessages = async (
    request: ListReviewMessagesRequest,
    actor: CallableActor,
): Promise<UnknownRecord[]> => {
    const planRef = db().collection(PLANS_COLLECTION).doc(request.planId);
    const [planSnapshot, commentSnapshot] = await Promise.all([
        planRef.get(), planRef.collection('comments').doc(request.commentId).get(),
    ]);
    const plan = planData(planSnapshot);
    assertPlanParticipantAccess(plan, actor);
    const comment = callableReviewRecord(commentSnapshot);
    if (!canViewReviewComment(plan, comment, actor)) {
        throw new functions.https.HttpsError('permission-denied', '이 의견의 답글을 볼 권한이 없습니다.');
    }
    const messages = await commentSnapshot.ref.collection('messages')
        .orderBy('createdAt', 'asc')
        .limit(MAX_REVIEW_MESSAGE_RESULTS)
        .get();
    return messages.docs.map((snapshot) => {
        const { requestFingerprint: _fingerprint, ...message } = callableReviewRecord(snapshot);
        return message;
    });
};

const transitionReviewComment = async (
    request: TransitionReviewCommentRequest,
    actor: CallableActor,
): Promise<UnknownRecord> => {
    const planRef = db().collection(PLANS_COLLECTION).doc(request.planId);
    const commentRef = planRef.collection('comments').doc(request.commentId);
    const mutationId = `mutation-${buildConstructionPlanMutationClaimId(
        actor.uid,
        `review-comment-transition:${request.planId}:${request.commentId}`,
        request.requestId,
    ).slice(0, 24)}`;
    const mutationRef = commentRef.collection('mutations').doc(mutationId);
    const requestFingerprint = sha256Hex(canonicalStringify({ ...request, actorId: actor.uid }));
    const preflightComment = callableReviewRecord(await commentRef.get());
    const cycleId = requireString(preflightComment, 'reviewCycleId', 200);
    const preflightPlan = planData(await planRef.get());
    const activePackageId = requireString(preflightPlan, 'activeReviewPackageId', 200);
    const cycleRef = planRef.collection('reviewCycles').doc(cycleId);
    const packageRef = planRef.collection('reviewPackages').doc(activePackageId);
    return db().runTransaction(async (transaction): Promise<UnknownRecord> => {
        const [planSnapshot, commentSnapshot, cycleSnapshot, packageSnapshot, mutationSnapshot] = await Promise.all([
            transaction.get(planRef), transaction.get(commentRef), transaction.get(cycleRef),
            transaction.get(packageRef), transaction.get(mutationRef),
        ]);
        const plan = planData(planSnapshot);
        assertPlanParticipantAccess(plan, actor);
        const comment = callableReviewRecord(commentSnapshot);
        if (mutationSnapshot.exists) {
            const mutation = mutationSnapshot.data();
            if (!isUnknownRecord(mutation) || mutation.requestFingerprint !== requestFingerprint
                || !isUnknownRecord(mutation.response)) {
                throw new functions.https.HttpsError('already-exists', '같은 requestId가 다른 상태 변경에 사용되었습니다.');
            }
            return callableFirestoreValue(mutation.response) as UnknownRecord;
        }
        if (!canViewReviewComment(plan, comment, actor)) {
            throw new functions.https.HttpsError('permission-denied', '이 의견의 상태를 변경할 권한이 없습니다.');
        }
        if (Number(comment.version) !== request.expectedVersion) {
            throw new functions.https.HttpsError('aborted', '의견이 다른 사용자에 의해 변경되었습니다.');
        }
        const cycle = cycleSnapshot.data();
        const packageData = packageSnapshot.data();
        if (!cycleSnapshot.exists || !isUnknownRecord(cycle)
            || !packageSnapshot.exists || !isUnknownRecord(packageData)
            || plan.activeReviewCycleId !== cycleId
            || plan.activeReviewPackageId !== activePackageId
            || cycle.activePackageId !== activePackageId
            || cycle.frozen === true) {
            throw new functions.https.HttpsError('failed-precondition', '활성 검토 cycle이 아니거나 동결되었습니다.');
        }
        const status = requireString(comment, 'status', 40) as ConstructionPlanReviewCommentStatus;
        let nextStatus: ConstructionPlanReviewCommentStatus;
        try {
            nextStatus = assertConstructionPlanReviewCommentTransition(status, request.action);
        } catch (_error) {
            throw new functions.https.HttpsError('failed-precondition', '현재 의견 상태에서 요청한 변경을 할 수 없습니다.');
        }
        if (request.action === 'address') {
            if (!canAddressConstructionPlanReviewComment({
                planCreatedBy: readTrimmedString(plan, ['createdBy']),
                authorIds: planParticipantIds(plan, 'authorIds'),
                actorId: actor.uid,
                isCentral: actor.access.isAdmin || actor.access.isOffice,
                planStatus: String(plan.status),
                commentStatus: status,
                authorReplyCount: Number(comment.authorReplyCount),
            })) {
                throw new functions.https.HttpsError(
                    'failed-precondition',
                    '계획서 작성자(또는 본사)가 조치 답글을 기록한 뒤 addressed 처리할 수 있습니다.',
                );
            }
        } else {
            const canResolve = actor.access.isAdmin || actor.access.isOffice
                || comment.createdBy === actor.uid
                || planParticipantIds(plan, 'reviewerIds').includes(actor.uid)
                || planParticipantIds(plan, 'approverIds').includes(actor.uid);
            if (!canResolve) {
                throw new functions.https.HttpsError('permission-denied', '검토자·승인자 또는 원 의견 작성자만 처리할 수 있습니다.');
            }
            if (request.action === 'reopen'
                && (plan.status !== 'changes_requested' || !request.reason)) {
                throw new functions.https.HttpsError(
                    'failed-precondition',
                    'reopen은 changes_requested 상태에서 사유와 함께 수행해야 합니다.',
                );
            }
        }
        if (!['in_review', 'changes_requested'].includes(String(plan.status))) {
            throw new functions.https.HttpsError('failed-precondition', '현재 검토 상태에서는 의견을 변경할 수 없습니다.');
        }
        const countedInParticipantSummary = comment.visibility === 'participants';
        const nextSummary = countedInParticipantSummary
            ? applyConstructionPlanReviewCommentTransition(
                cycle.commentSummary,
                status,
                nextStatus,
                comment.required === true,
            )
            : authoritativeReviewSummary(cycle.commentSummary);
        const timestamp = new Date().toISOString();
        const summaryRecord = summaryWithTimestamp(nextSummary, timestamp);
        const nextVersion = Number(comment.version) + 1;
        const auditFields: UnknownRecord = request.action === 'address'
            ? { addressedBy: actor.uid, addressedAt: timestamp }
            : request.action === 'resolve'
                ? { resolvedBy: actor.uid, resolvedAt: timestamp }
                : { reopenedBy: actor.uid, reopenedAt: timestamp, reopenReason: request.reason };
        const response: UnknownRecord = {
            ...comment,
            status: nextStatus,
            version: nextVersion,
            updatedAt: timestamp,
            ...auditFields,
        };
        delete response.requestFingerprint;
        transaction.update(commentRef, {
            status: nextStatus,
            version: nextVersion,
            updatedAt: timestamp,
            ...auditFields,
        });
        if (countedInParticipantSummary) {
            transaction.update(cycleRef, { commentSummary: summaryRecord, updatedAt: timestamp });
            transaction.update(packageRef, { commentSummary: summaryRecord, updatedAt: timestamp });
            transaction.update(planRef, {
                commentSummary: summaryRecord,
                'releaseReadiness.unresolvedRequiredComments': nextSummary.unresolvedRequired,
            });
        }
        transaction.create(mutationRef, {
            id: mutationId,
            requestFingerprint,
            response,
            actorId: actor.uid,
            action: request.action,
            createdAt: timestamp,
        });
        return response;
    });
};

export const createConstructionPlanReviewCommentServer = constructionPlanRunner.https.onCall(
    async (data: unknown, context): Promise<{ comment: UnknownRecord }> => {
        const request = parseCreateReviewCommentRequest(data);
        const actor = await resolveCallableActor(context);
        const comment = await createReviewComment(request, actor);
        const plan = planData(await db().collection(PLANS_COLLECTION).doc(request.planId).get());
        const activeEnvelope = await loadActiveReviewSnapshotContent(plan);
        return { comment: decorateReviewComment(plan, comment, actor, activeEnvelope) };
    },
);

export const replyConstructionPlanReviewCommentServer = constructionPlanRunner.https.onCall(
    async (data: unknown, context): Promise<{ message: UnknownRecord }> => {
        const request = parseReplyReviewCommentRequest(data);
        const actor = await resolveCallableActor(context);
        return { message: await replyReviewComment(request, actor) };
    },
);

export const transitionConstructionPlanReviewCommentServer = constructionPlanRunner.https.onCall(
    async (data: unknown, context): Promise<{ comment: UnknownRecord }> => {
        const request = parseTransitionReviewCommentRequest(data);
        const actor = await resolveCallableActor(context);
        const comment = await transitionReviewComment(request, actor);
        const plan = planData(await db().collection(PLANS_COLLECTION).doc(request.planId).get());
        const activeEnvelope = await loadActiveReviewSnapshotContent(plan);
        return { comment: decorateReviewComment(plan, comment, actor, activeEnvelope) };
    },
);

export const listConstructionPlanReviewCommentsServer = constructionPlanRunner.https.onCall(
    async (data: unknown, context): Promise<{ comments: UnknownRecord[]; permissions: UnknownRecord }> => {
        const request = parseListReviewCommentsRequest(data);
        const actor = await resolveCallableActor(context);
        const comments = await listReviewComments(request, actor);
        const plan = planData(await db().collection(PLANS_COLLECTION).doc(request.planId).get());
        return {
            comments,
            permissions: {
                canCreateComment: plan.status === 'in_review' && canCreateReviewComment(plan, actor),
            },
        };
    },
);

export const listConstructionPlanReviewMessagesServer = constructionPlanRunner.https.onCall(
    async (data: unknown, context): Promise<{ messages: UnknownRecord[] }> => {
        const request = parseListReviewMessagesRequest(data);
        const actor = await resolveCallableActor(context);
        return { messages: await listReviewMessages(request, actor) };
    },
);

export const listConstructionPlanReviewPackagesServer = constructionPlanRunner.https.onCall(
    async (data: unknown, context): Promise<{ packages: UnknownRecord[] }> => {
        const record = asCallableRecord(data);
        const planId = requireDocumentId(record, 'planId');
        const actor = await resolveCallableActor(context);
        const planRef = db().collection(PLANS_COLLECTION).doc(planId);
        const plan = planData(await planRef.get());
        assertPlanParticipantAccess(plan, actor);
        const packages = await planRef.collection('reviewPackages')
            .orderBy('round', 'desc')
            .limit(MAX_REVIEW_PACKAGE_RESULTS)
            .get();
        return { packages: packages.docs.map(callableReviewRecord) };
    },
);

export const reviewConstructionPlanServer = constructionPlanRunner.https.onCall(
    async (data: unknown, context): Promise<ReviewResponse> => {
        const request = parseReviewRequest(data);
        const actor = await resolveCallableActor(context);
        requireReviewAccess(actor, request.action);
        let drawingPreviewBindingHash: string | undefined;
        if (request.action !== 'request_changes') {
            const plan = planData(await db().collection(PLANS_COLLECTION).doc(request.planId).get());
            assertPlanParticipantAccess(plan, actor);
            if (request.action === 'submit_review') assertSiteSubmitter(plan, actor);
            if (request.action === 'approve') assertApproverSeparation(plan, actor);
            drawingPreviewBindingHash = await verifyAuthoritativeDrawingPreviewsForRelease(
                request.planId,
                plan,
            );
        }
        return request.action === 'approve'
            ? approveConstructionPlan(request, actor, drawingPreviewBindingHash as string)
            : runReviewTransition(request, actor, drawingPreviewBindingHash);
    },
);

const pdfPipelineDataLoss = (message: string): never => {
    throw new functions.https.HttpsError('data-loss', message);
};

const storedString = (record: UnknownRecord, key: string, maximum = 2000): string => {
    const value = readTrimmedString(record, [key]);
    if (!value || value.length > maximum) pdfPipelineDataLoss(`${key} 저장 바인딩이 손상되었습니다.`);
    return value as string;
};

const storedSha256 = (record: UnknownRecord, key: string): string => {
    const value = storedString(record, key, 64).toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(value)) pdfPipelineDataLoss(`${key} SHA-256 바인딩이 손상되었습니다.`);
    return value;
};

const storedPositiveInteger = (record: UnknownRecord, key: string): number => {
    const value = Number(record[key]);
    if (!Number.isInteger(value) || value < 1) pdfPipelineDataLoss(`${key} 숫자 바인딩이 손상되었습니다.`);
    return value;
};

const storedGeneration = (record: UnknownRecord, key = 'storageGeneration'): string => {
    const value = storedString(record, key, 200);
    if (!/^\d+$/.test(value)) pdfPipelineDataLoss(`${key} generation 바인딩이 손상되었습니다.`);
    return value;
};

const serverPdfProvenanceFromRecord = (record: UnknownRecord): ServerPdfProvenanceResponse => ({
    rendererVersion: storedString(record, 'rendererVersion', 160),
    rendererTemplateBundleHash: storedSha256(record, 'rendererTemplateBundleHash'),
    rendererBuildHash: storedSha256(record, 'rendererBuildHash'),
    renderInputHash: storedSha256(record, 'renderInputHash'),
    contentManifestHash: storedSha256(record, 'contentManifestHash'),
    zeroOmissionCoverageHash: storedSha256(record, 'zeroOmissionCoverageHash'),
    drawingBindingHash: storedSha256(record, 'drawingBindingHash'),
    drawingRenderMode: storedString(record, 'drawingRenderMode', 160),
    templateHash: storedSha256(record, 'templateHash'),
    manifestHash: storedSha256(record, 'manifestHash'),
    templateBundleHash: storedSha256(record, 'templateBundleHash'),
    templateBindingHash: storedSha256(record, 'templateBindingHash'),
});

const storedPhysicalPageManifest = (
    raw: unknown,
    pageCount: number,
): ConstructionPlanFieldUsePageManifest[] => {
    if (!Array.isArray(raw) || raw.length !== pageCount) {
        pdfPipelineDataLoss('서버 PDF physical page manifest가 없습니다.');
    }
    const rawPages = raw as unknown[];
    const seenLogical = new Set<number>();
    const seenCoverage = new Set<string>();
    let previousLogical = 0;
    let previousContinuation = -1;
    return rawPages.map((value, index) => {
        if (!isUnknownRecord(value)) pdfPipelineDataLoss(`서버 PDF ${index + 1}쪽 manifest가 손상되었습니다.`);
        const page = value as UnknownRecord;
        const physicalPageNumber = Number(page.physicalPageNumber);
        const logicalPageNumber = Number(page.logicalPageNumber);
        const continuationIndex = Number(page.continuationIndex);
        const coveragePaths = page.coveragePaths;
        if (Number(page.pageNumber) !== index + 1 || physicalPageNumber !== index + 1
            || !Number.isInteger(logicalPageNumber) || logicalPageNumber < 1
            || logicalPageNumber > CONSTRUCTION_PLAN_PAGE_COUNT
            || !Number.isInteger(continuationIndex) || continuationIndex < 0
            || logicalPageNumber < previousLogical
            || (logicalPageNumber === previousLogical && continuationIndex !== previousContinuation + 1)
            || (logicalPageNumber !== previousLogical && continuationIndex !== 0)
            || !Array.isArray(coveragePaths)
            || coveragePaths.some((path) => typeof path !== 'string' || !path || seenCoverage.has(path))
            || !Array.isArray(page.coverageLedger) || !Array.isArray(page.drawingBindings)
            || !/^[a-f0-9]{64}$/.test(String(page.templateContractHash || ''))
            || !/^[a-f0-9]{64}$/.test(String(page.payloadHash || ''))
            || !/^[a-f0-9]{64}$/.test(String(page.drawingBindingHash || ''))
            || typeof page.sectionKey !== 'string' || !page.sectionKey
            || typeof page.title !== 'string' || !page.title
            || typeof page.required !== 'boolean') {
            pdfPipelineDataLoss(`서버 PDF ${index + 1}쪽 physical manifest가 손상되었습니다.`);
        }
        (coveragePaths as string[]).forEach((path) => seenCoverage.add(path));
        seenLogical.add(logicalPageNumber);
        previousLogical = logicalPageNumber;
        previousContinuation = continuationIndex;
        return value as unknown as ConstructionPlanFieldUsePageManifest;
    }).map((page, index, pages) => {
        if (index === pages.length - 1 && seenLogical.size !== CONSTRUCTION_PLAN_PAGE_COUNT) {
            pdfPipelineDataLoss('서버 PDF logical 42쪽 coverage가 불완전합니다.');
        }
        return page;
    });
};

const persistedArtifactFromRecord = (
    raw: unknown,
    expectedProfile: 'candidate' | 'issued',
): PersistedServerPdfArtifactRecord => {
    if (!isUnknownRecord(raw)) pdfPipelineDataLoss('서버 PDF artifact 레코드가 없습니다.');
    const record = raw as UnknownRecord;
    if (record.profile !== expectedProfile || typeof record.releaseEligible !== 'boolean') {
        pdfPipelineDataLoss('서버 PDF artifact profile 바인딩이 손상되었습니다.');
    }
    if ((expectedProfile === 'issued' && record.releaseEligible !== true)
        || (expectedProfile === 'candidate' && record.releaseEligible !== false)) {
        pdfPipelineDataLoss('서버 PDF profile별 release eligibility 바인딩이 손상되었습니다.');
    }
    const pageCount = Number(record.pageCount);
    if (!Number.isInteger(pageCount)
        || pageCount < CONSTRUCTION_PLAN_FIELD_USE_MIN_PHYSICAL_PAGES
        || pageCount > CONSTRUCTION_PLAN_FIELD_USE_MAX_PHYSICAL_PAGES) {
        pdfPipelineDataLoss('서버 PDF artifact 페이지 수가 손상되었습니다.');
    }
    const pageManifest = storedPhysicalPageManifest(record.pageManifest, pageCount);
    const sizeBytes = storedPositiveInteger(record, 'sizeBytes');
    if (sizeBytes > MAX_SERVER_PDF_SIZE_BYTES) {
        pdfPipelineDataLoss('서버 PDF artifact 크기가 허용 범위를 벗어났습니다.');
    }
    return {
        profile: expectedProfile,
        releaseEligible: record.releaseEligible as boolean,
        storagePath: storedString(record, 'storagePath', 1000),
        storageGeneration: storedGeneration(record),
        sha256: storedSha256(record, 'sha256'),
        sizeBytes,
        pageCount,
        pageManifest,
        fileName: storedString(record, 'fileName', 240),
        snapshotHash: storedSha256(record, 'snapshotHash'),
        approvedContentHash: storedSha256(record, 'approvedContentHash'),
        ...serverPdfProvenanceFromRecord(record),
    };
};

const artifactResponse = (record: PersistedServerPdfArtifactRecord): ServerPdfArtifactResponse => ({
    storagePath: record.storagePath,
    storageGeneration: record.storageGeneration,
    sha256: record.sha256,
    sizeBytes: record.sizeBytes,
    pageCount: record.pageCount,
    fileName: record.fileName,
});

const artifactProvenance = (
    record: Pick<PersistedServerPdfArtifactRecord,
    keyof ServerPdfProvenanceResponse>,
): ServerPdfProvenanceResponse => ({
    rendererVersion: record.rendererVersion,
    rendererTemplateBundleHash: record.rendererTemplateBundleHash,
    rendererBuildHash: record.rendererBuildHash,
    renderInputHash: record.renderInputHash,
    contentManifestHash: record.contentManifestHash,
    zeroOmissionCoverageHash: record.zeroOmissionCoverageHash,
    drawingBindingHash: record.drawingBindingHash,
    drawingRenderMode: record.drawingRenderMode,
    templateHash: record.templateHash,
    manifestHash: record.manifestHash,
    templateBundleHash: record.templateBundleHash,
    templateBindingHash: record.templateBindingHash,
});

const persistedArtifactRecord = (
    artifact: ConstructionPlanServerPdfArtifact,
    stored: { storagePath: string; storageGeneration: string },
): PersistedServerPdfArtifactRecord => ({
    profile: artifact.profile,
    releaseEligible: artifact.releaseEligible,
    storagePath: stored.storagePath,
    storageGeneration: stored.storageGeneration,
    sha256: artifact.sha256,
    sizeBytes: artifact.sizeBytes,
    pageCount: artifact.pageCount,
    pageManifest: artifact.pageManifest,
    fileName: artifact.fileName,
    snapshotHash: artifact.snapshotHash,
    approvedContentHash: artifact.approvedContentHash,
    rendererVersion: artifact.rendererVersion,
    rendererTemplateBundleHash: artifact.rendererTemplateBundleHash,
    rendererBuildHash: artifact.rendererBuildHash,
    templateHash: artifact.templateHash,
    manifestHash: artifact.manifestHash,
    templateBundleHash: artifact.templateBundleHash,
    templateBindingHash: artifact.templateBindingHash,
    renderInputHash: artifact.renderInputHash,
    contentManifestHash: artifact.contentManifestHash,
    zeroOmissionCoverageHash: artifact.zeroOmissionCoverageHash,
    drawingBindingHash: artifact.drawingBindingHash,
    drawingRenderMode: artifact.drawingRenderMode,
});

const assertFieldUsePdfPhysicalAudit = async (
    bytes: Buffer,
    artifact: ConstructionPlanServerPdfArtifact,
    approvalEvidenceHash: string,
): Promise<void> => {
    if (bytes.length !== artifact.sizeBytes || sha256Hex(bytes) !== artifact.sha256
        || bytes.subarray(0, 5).toString('ascii') !== '%PDF-') {
        pdfPipelineDataLoss('저장된 서버 PDF byte envelope가 손상되었습니다.');
    }
    if (artifact.rendererVersion !== CONSTRUCTION_PLAN_FIELD_USE_RENDERER_VERSION
        || artifact.drawingRenderMode !== CONSTRUCTION_PLAN_FIELD_USE_DRAWING_RENDER_MODE) {
        pdfPipelineDataLoss('서버 PDF renderer version 또는 drawing mode가 production 계약과 다릅니다.');
    }
    const parser = new PDFParse({ data: bytes });
    try {
        const info = await parser.getInfo({ parsePageInfo: true });
        const textResult = await parser.getText();
        const documentProxy = (parser as unknown as {
            doc?: {
                getAttachments?: () => Promise<unknown>;
                getJSActions?: () => Promise<unknown>;
                getOpenAction?: () => Promise<unknown>;
                getPermissions?: () => Promise<unknown>;
            };
        }).doc;
        if (!documentProxy?.getAttachments || !documentProxy.getJSActions
            || !documentProxy.getOpenAction || !documentProxy.getPermissions) {
            pdfPipelineDataLoss('서버 PDF 보안 구조 검사기를 초기화할 수 없습니다.');
        }
        const [attachments, jsActions, openAction, permissions] = await Promise.all([
            documentProxy.getAttachments(),
            documentProxy.getJSActions(),
            documentProxy.getOpenAction(),
            documentProxy.getPermissions(),
        ]);
        const hasFeaturePayload = (value: unknown): boolean => (
            value != null && (!isUnknownRecord(value) || Object.keys(value).length > 0)
        );
        if (hasFeaturePayload(attachments) || hasFeaturePayload(jsActions)
            || openAction != null || permissions != null || info.permission != null) {
            pdfPipelineDataLoss('서버 PDF에 암호화·스크립트·첨부 또는 자동 실행 기능이 포함되었습니다.');
        }
        if (info.total !== artifact.pageCount
            || textResult.total !== artifact.pageCount
            || info.pages.length !== artifact.pageCount
            || textResult.pages.length !== artifact.pageCount) {
            pdfPipelineDataLoss('서버 PDF physical page count가 artifact manifest와 일치하지 않습니다.');
        }
        info.pages.forEach((page, index) => {
            const a4Portrait = Math.abs(Number(page.width) - 595.28) <= 2
                && Math.abs(Number(page.height) - 841.89) <= 2;
            if (!a4Portrait) pdfPipelineDataLoss(`서버 PDF ${index + 1}쪽이 A4 세로 규격이 아닙니다.`);
        });
        const pageTexts = textResult.pages.map((page) => String(page.text || ''));
        const audit = validateConstructionPlanFieldUseAuditPages(pageTexts, {
            profile: artifact.profile,
            snapshotHash: artifact.snapshotHash,
            approvalEvidenceHash,
            approvedContentHash: artifact.approvedContentHash,
            templateHash: artifact.templateHash,
            manifestHash: artifact.manifestHash,
            templateBundleHash: artifact.templateBundleHash,
            templateBindingHash: artifact.templateBindingHash,
            rendererVersion: CONSTRUCTION_PLAN_FIELD_USE_RENDERER_VERSION,
            drawingRenderMode: CONSTRUCTION_PLAN_FIELD_USE_DRAWING_RENDER_MODE,
            rendererTemplateBundleHash: artifact.rendererTemplateBundleHash,
            rendererBuildHash: artifact.rendererBuildHash,
            renderInputHash: artifact.renderInputHash,
            contentManifestHash: artifact.contentManifestHash,
            zeroOmissionCoverageHash: artifact.zeroOmissionCoverageHash,
            drawingBindingHash: artifact.drawingBindingHash,
            pageCount: artifact.pageCount,
            pageManifest: artifact.pageManifest,
        });
        if (!audit.valid) {
            throw new functions.https.HttpsError(
                'data-loss',
                '서버 PDF 매 페이지 provenance/profile 감사마커가 손상되었습니다.',
                { issues: audit.issues.slice(0, 100) },
            );
        }
    } catch (error) {
        if (error instanceof functions.https.HttpsError) throw error;
        functions.logger.error('[constructionPlans] Server field-use PDF audit failed.', error);
        pdfPipelineDataLoss('저장된 서버 PDF를 안전하게 해석할 수 없습니다.');
    } finally {
        await parser.destroy();
    }
};

const loadApprovedPdfSnapshotContext = async (
    planId: string,
    plan: UnknownRecord,
    requestedSnapshotHash: string,
): Promise<ApprovedPdfSnapshotContext> => {
    if (plan.status !== 'approved_pending_issue') {
        throw new functions.https.HttpsError('failed-precondition', '승인 완료 후에만 서버 PDF를 준비할 수 있습니다.');
    }
    const siteId = readTrimmedString(plan, ['siteId']);
    const documentNo = readTrimmedString(plan, ['documentNo']);
    const snapshotId = readTrimmedString(plan, ['approvedSnapshotId']);
    const snapshotHash = readTrimmedString(plan, ['approvedSnapshotHash'])?.toLowerCase();
    const snapshotStoragePath = readTrimmedString(plan, ['approvedSnapshotStoragePath']);
    const evidenceId = readTrimmedString(plan, ['approvedEvidenceId']);
    const evidenceHash = readTrimmedString(plan, ['approvedEvidenceHash'])?.toLowerCase();
    const reviewPackageId = readTrimmedString(plan, ['activeReviewPackageId']);
    const reviewCycleId = readTrimmedString(plan, ['activeReviewCycleId']);
    const revision = Number(plan.revision);
    if (!siteId || !documentNo || !snapshotId || !snapshotHash || !snapshotStoragePath
        || !evidenceId || !evidenceHash || !reviewPackageId || !reviewCycleId
        || !/^[a-f0-9]{64}$/.test(snapshotHash) || !/^[a-f0-9]{64}$/.test(evidenceHash)
        || !Number.isInteger(revision) || revision < 0) {
        throw new functions.https.HttpsError(
            'failed-precondition',
            '서버 발행에 필요한 승인 스냅샷·승인 증적·문서 식별 정보가 없습니다.',
        );
    }
    if (snapshotHash !== requestedSnapshotHash) {
        throw new functions.https.HttpsError('aborted', '요청 승인 스냅샷 해시가 현재 승인본과 일치하지 않습니다.');
    }
    if (snapshotStoragePath !== reviewStoragePath(planId, plan, snapshotHash)) {
        pdfPipelineDataLoss('승인 스냅샷 Storage path가 서버 콘텐츠 주소 계약과 일치하지 않습니다.');
    }
    const templateContext = boundTemplateContextForPlan(plan);

    const planRef = db().collection(PLANS_COLLECTION).doc(planId);
    const snapshotRef = planRef.collection('snapshots').doc(snapshotId);
    const evidenceRef = planRef.collection('approvals').doc(evidenceId);
    const [snapshotDocument, evidenceDocument, templateDocument] = await Promise.all([
        snapshotRef.get(),
        evidenceRef.get(),
        templateContext.reference.get(),
    ]);
    assertBoundTemplateLifecycleSnapshot(templateContext, templateDocument);
    if (!snapshotDocument.exists || !isUnknownRecord(snapshotDocument.data())) {
        pdfPipelineDataLoss('승인 스냅샷 Firestore 레코드를 찾을 수 없습니다.');
    }
    const snapshotData = snapshotDocument.data() as UnknownRecord;
    const snapshotStorageGeneration = storedGeneration(snapshotData);
    const snapshotByteLength = storedPositiveInteger(snapshotData, 'contentByteLength');
    if (snapshotData.id !== snapshotId
        || snapshotData.planId !== planId
        || snapshotData.kind !== 'review_submission'
        || snapshotData.immutable !== true
        || snapshotData.contentHash !== snapshotHash
        || snapshotData.storagePath !== snapshotStoragePath
        || snapshotData.templateId !== plan.templateId
        || snapshotData.templateVersion !== plan.templateVersion
        || snapshotData.rendererVersion !== templateContext.binding.rendererVersion
        || Number(snapshotData.pageCount) !== templateContext.binding.logicalPageCount
        || canonicalStringify(snapshotData.templateBinding) !== canonicalStringify(templateContext.binding)) {
        pdfPipelineDataLoss('승인 스냅샷 Firestore 바인딩이 손상되었습니다.');
    }
    if (!evidenceDocument.exists || !isUnknownRecord(evidenceDocument.data())) {
        pdfPipelineDataLoss('승인 증적 Firestore 레코드를 찾을 수 없습니다.');
    }
    try {
        assertConstructionPlanApprovalEvidenceBinding(evidenceDocument.data(), {
            planId,
            evidenceHash,
            snapshotId,
            contentHash: snapshotHash,
            storagePath: snapshotStoragePath,
            reviewPackageId,
            reviewCycleId,
            ...templateContext.projection,
        });
    } catch (_error) {
        pdfPipelineDataLoss('승인 증적 바인딩 또는 evidence SHA-256이 손상되었습니다.');
    }
    const approvalEvidence = constructionPlanApprovalEvidenceContentForHash(evidenceDocument.data());

    const snapshotFile = bucket().file(snapshotStoragePath, { generation: snapshotStorageGeneration });
    let rawMetadata: UnknownRecord;
    let bytes: Buffer;
    try {
        const [metadataResult, downloadResult] = await Promise.all([
            snapshotFile.getMetadata(),
            snapshotFile.download(),
        ]);
        rawMetadata = metadataResult[0] as unknown as UnknownRecord;
        bytes = downloadResult[0];
    } catch (error) {
        functions.logger.error('[constructionPlans] Approved snapshot Storage read failed.', error);
        pdfPipelineDataLoss('승인 스냅샷 Storage 객체를 읽을 수 없습니다.');
    }
    const snapshotCustomMetadata = isUnknownRecord(rawMetadata.metadata) ? rawMetadata.metadata : {};
    if (String(rawMetadata.generation || '') !== snapshotStorageGeneration
        || rawMetadata.contentType !== 'application/json'
        || Number(rawMetadata.size) !== snapshotByteLength
        || bytes.length !== snapshotByteLength
        || readTrimmedString(snapshotCustomMetadata, ['sha256']) !== snapshotHash
        || readTrimmedString(snapshotCustomMetadata, ['artifactClass']) !== 'review-submission-snapshot'
        || sha256Hex(bytes) !== snapshotHash) {
        pdfPipelineDataLoss('승인 스냅샷 Storage generation/크기/MIME/SHA-256 바인딩이 일치하지 않습니다.');
    }

    let envelope: UnknownRecord;
    try {
        const parsed: unknown = JSON.parse(bytes.toString('utf8'));
        if (!isUnknownRecord(parsed) || !isUnknownRecord(parsed.content)) throw new Error('shape');
        envelope = parsed;
        if (Buffer.from(canonicalStringify(envelope), 'utf8').equals(bytes) !== true) {
            throw new Error('not-canonical');
        }
    } catch (_error) {
        pdfPipelineDataLoss('승인 스냅샷 JSON canonical envelope가 손상되었습니다.');
    }
    const content = envelope.content as UnknownRecord;
    assertSameConstructionPlanTemplateBinding(templateContext.binding, content.templateBinding);
    const envelopeKeys = Object.keys(envelope).sort();
    if (canonicalStringify(envelopeKeys) !== canonicalStringify([
        'content', 'kind', 'planId', 'snapshotSchemaVersion',
    ])
        || envelope.snapshotSchemaVersion !== CONSTRUCTION_PLAN_SNAPSHOT_SCHEMA_VERSION
        || content.snapshotSchemaVersion !== CONSTRUCTION_PLAN_SNAPSHOT_SCHEMA_VERSION
        || envelope.kind !== 'review_submission'
        || envelope.planId !== planId
        || content.planId !== planId) {
        throw new functions.https.HttpsError(
            'failed-precondition',
            '스냅샷 schema v2만 서버 권위 현장사용 PDF로 발행할 수 있습니다.',
        );
    }
    const identityKeys = [
        'siteId', 'documentNo', 'revision', 'seriesId', 'lineageRootPlanId',
        'supersedesPlanId', 'templateId', 'templateVersion', 'rendererVersion',
        'templateBinding', 'templateHash', 'manifestHash', 'templateBundleHash',
        'templateBindingHash', 'templateMigration',
    ] as const;
    identityKeys.forEach((key) => {
        if (canonicalStringify(content[key]) !== canonicalStringify(plan[key])) {
            pdfPipelineDataLoss(`승인 스냅샷과 live plan의 ${key} 제어 바인딩이 일치하지 않습니다.`);
        }
    });
    assertReleaseValidation({
        ...content,
        id: planId,
        status: plan.status,
        participants: plan.participants,
        releaseReadiness: plan.releaseReadiness,
        validationSummary: plan.validationSummary,
    });

    const snapshotDrawingVerification = await assertAuthoritativeConstructionPlanDrawingPreviews({
        database: db(),
        storageBucket: bucket(),
        planId,
        plan: content,
    });
    assertConstructionPlanDrawingPreviewBindingHash(
        planId,
        plan,
        snapshotDrawingVerification.bindingHash,
    );

    return {
        planId,
        plan,
        envelope,
        content,
        snapshotId,
        snapshotHash,
        approvedContentHash: sha256Hex(canonicalStringify(content)),
        snapshotStoragePath,
        snapshotStorageGeneration,
        snapshotByteLength,
        evidenceId,
        evidenceHash,
        approvalEvidence,
        authoritativeDrawingPreviewBindingHash: snapshotDrawingVerification.bindingHash,
        bindingBase: {
            siteId,
            planId,
            documentNo,
            revision,
            approvedSnapshotId: snapshotId,
            approvedSnapshotStoragePath: snapshotStoragePath,
            approvedSnapshotStorageGeneration: snapshotStorageGeneration,
            authoritativeDrawingPreviewBindingHash: snapshotDrawingVerification.bindingHash,
            approvedEvidenceId: evidenceId,
            approvedEvidenceHash: evidenceHash,
            ...templateContext.projection,
        },
    };
};

const loadImmutableDrawingSource = async (
    reference: ConstructionPlanFieldUseDrawingSourceRef,
) => {
    const file = bucket().file(reference.storagePath, { generation: reference.sourceGeneration });
    let metadata: UnknownRecord;
    let bytes: Buffer;
    try {
        const [metadataResult, downloadResult] = await Promise.all([file.getMetadata(), file.download()]);
        metadata = metadataResult[0] as unknown as UnknownRecord;
        bytes = downloadResult[0];
    } catch (error) {
        functions.logger.error('[constructionPlans] Drawing source Storage read failed.', {
            drawingId: reference.drawingId,
            storagePath: reference.storagePath,
            error,
        });
        throw new functions.https.HttpsError('failed-precondition', '승인 도면 원본을 읽을 수 없습니다.');
    }
    if (String(metadata.generation || '') !== reference.sourceGeneration
        || metadata.contentType !== reference.mimeType
        || Number(metadata.size) !== reference.sizeBytes
        || bytes.length !== reference.sizeBytes
        || sha256Hex(bytes) !== reference.sourceSha256) {
        pdfPipelineDataLoss(`도면 ${reference.drawingId} 원본 generation/MIME/크기/SHA-256이 변경되었습니다.`);
    }
    return {
        bytes,
        storagePath: reference.storagePath,
        sourceGeneration: reference.sourceGeneration,
        mimeType: reference.mimeType,
    };
};

const serverPdfArtifactFromRenderResult = (
    result: ConstructionPlanFieldUsePdfResult,
    context: ApprovedPdfSnapshotContext,
    expectedProfile: 'candidate' | 'issued',
): ConstructionPlanServerPdfArtifact => {
    if (result.profile !== expectedProfile
        || result.snapshotHash !== context.snapshotHash
        || result.approvedContentHash !== context.approvedContentHash
        || result.approvalEvidenceHash !== context.evidenceHash
        || result.templateHash !== context.bindingBase.templateHash
        || result.manifestHash !== context.bindingBase.manifestHash
        || result.templateBundleHash !== context.bindingBase.templateBundleHash
        || result.templateBindingHash !== context.bindingBase.templateBindingHash
        || result.pageCount < CONSTRUCTION_PLAN_FIELD_USE_MIN_PHYSICAL_PAGES
        || result.pageCount > CONSTRUCTION_PLAN_FIELD_USE_MAX_PHYSICAL_PAGES
        || result.pageManifest.length !== result.pageCount
        || result.bytes.length !== result.sizeBytes
        || sha256Hex(result.bytes) !== result.sha256) {
        pdfPipelineDataLoss('field-use renderer 결과가 승인 입력 또는 byte envelope와 일치하지 않습니다.');
    }
    if ((expectedProfile === 'candidate' && result.releaseEligible !== false)
        || (expectedProfile === 'issued' && result.releaseEligible !== true)) {
        pdfPipelineDataLoss('field-use renderer profile/release eligibility가 일치하지 않습니다.');
    }
    if (expectedProfile === 'issued') {
        try {
            assertConstructionPlanFieldUseReleaseEligible(result);
        } catch (_error) {
            pdfPipelineDataLoss('field-use issued renderer release gate를 통과하지 못했습니다.');
        }
    }
    return {
        profile: result.profile,
        releaseEligible: result.releaseEligible,
        rendererVersion: result.rendererVersion,
        drawingRenderMode: result.drawingRenderMode,
        bytes: result.bytes,
        sha256: result.sha256,
        sizeBytes: result.sizeBytes,
        pageCount: result.pageCount,
        pageManifest: result.pageManifest,
        snapshotHash: result.snapshotHash,
        approvedContentHash: result.approvedContentHash,
        templateHash: result.templateHash,
        manifestHash: result.manifestHash,
        templateBundleHash: result.templateBundleHash,
        templateBindingHash: result.templateBindingHash,
        rendererTemplateBundleHash: result.rendererTemplateBundleHash,
        rendererBuildHash: result.rendererBuildHash,
        renderInputHash: result.renderInputHash,
        contentManifestHash: result.contentManifestHash,
        zeroOmissionCoverageHash: result.zeroOmissionCoverageHash,
        drawingBindingHash: result.drawingBindingHash,
        fileName: result.fileName,
    };
};

const renderApprovedFieldUsePdf = async (
    profile: 'candidate' | 'issued',
    approved: ApprovedPdfSnapshotContext,
): Promise<ConstructionPlanFieldUsePdfResult> => {
    try {
        return await renderConstructionPlanFieldUsePdf({
            profile,
            verifiedSnapshot: {
                snapshotHash: approved.snapshotHash,
                envelope: approved.envelope,
                content: approved.content,
            },
            approvalEvidenceHash: approved.evidenceHash,
            approvalEvidence: approved.approvalEvidence,
            loadDrawingSource: loadImmutableDrawingSource,
        });
    } catch (error) {
        if (error instanceof functions.https.HttpsError) throw error;
        const rawCode = error instanceof Error ? error.message.split(':', 1)[0] : '';
        if (/^construction-plan-field-use-[a-z0-9-]+$/.test(rawCode)) {
            throw new functions.https.HttpsError(
                'failed-precondition',
                '발행 데이터 또는 고정 A4 레이아웃을 보완한 뒤 다시 준비해 주세요.',
                { errorCode: rawCode, profile },
            );
        }
        functions.logger.error('[constructionPlans] Unexpected field-use renderer failure.', {
            planId: approved.planId,
            profile,
            error,
        });
        throw new functions.https.HttpsError('internal', '서버 현장사용 PDF 렌더링에 실패했습니다.');
    }
};

const buildExportJobId = (
    context: ApprovedPdfSnapshotContext,
    artifact: ConstructionPlanServerPdfArtifact,
): string => `pdf-${sha256Hex(canonicalStringify({
    jobSchemaVersion: 1,
    planId: context.planId,
    snapshotHash: context.snapshotHash,
    evidenceHash: context.evidenceHash,
    rendererVersion: artifact.rendererVersion,
    rendererTemplateBundleHash: artifact.rendererTemplateBundleHash,
    rendererBuildHash: artifact.rendererBuildHash,
    contentManifestHash: artifact.contentManifestHash,
    zeroOmissionCoverageHash: artifact.zeroOmissionCoverageHash,
    drawingBindingHash: artifact.drawingBindingHash,
})).slice(0, 40)}`;

const verifyPersistedServerPdfArtifact = async (
    raw: unknown,
    expectedProfile: 'candidate' | 'issued',
    bindingBase: Omit<ConstructionPlanServerPdfBinding, 'exportJobId'>,
    jobId: string,
): Promise<{ record: PersistedServerPdfArtifactRecord; artifact: ConstructionPlanServerPdfArtifact }> => {
    const record = persistedArtifactFromRecord(raw, expectedProfile);
    const file = bucket().file(record.storagePath, { generation: record.storageGeneration });
    let rawMetadata: UnknownRecord;
    try {
        const [metadataResult] = await file.getMetadata();
        rawMetadata = metadataResult as unknown as UnknownRecord;
    } catch (error) {
        functions.logger.error('[constructionPlans] Server PDF metadata lookup failed.', error);
        pdfPipelineDataLoss('서버 PDF Storage 객체를 찾을 수 없습니다.');
    }
    if (rawMetadata.contentType !== 'application/pdf'
        || Number(rawMetadata.size) !== record.sizeBytes
        || String(rawMetadata.generation || '') !== record.storageGeneration) {
        pdfPipelineDataLoss('서버 PDF Storage generation/크기/MIME 바인딩이 일치하지 않습니다.');
    }
    let bytes: Buffer;
    try {
        [bytes] = await file.download();
    } catch (error) {
        functions.logger.error('[constructionPlans] Server PDF download failed.', error);
        pdfPipelineDataLoss('서버 PDF Storage bytes를 읽을 수 없습니다.');
    }
    const artifact: ConstructionPlanServerPdfArtifact = {
        profile: record.profile,
        releaseEligible: record.releaseEligible,
        rendererVersion: record.rendererVersion,
        drawingRenderMode: record.drawingRenderMode,
        bytes,
        sha256: record.sha256,
        sizeBytes: record.sizeBytes,
        pageCount: record.pageCount,
        pageManifest: record.pageManifest,
        snapshotHash: record.snapshotHash,
        approvedContentHash: record.approvedContentHash,
        templateHash: record.templateHash,
        manifestHash: record.manifestHash,
        templateBundleHash: record.templateBundleHash,
        templateBindingHash: record.templateBindingHash,
        rendererTemplateBundleHash: record.rendererTemplateBundleHash,
        rendererBuildHash: record.rendererBuildHash,
        renderInputHash: record.renderInputHash,
        contentManifestHash: record.contentManifestHash,
        zeroOmissionCoverageHash: record.zeroOmissionCoverageHash,
        drawingBindingHash: record.drawingBindingHash,
        fileName: record.fileName,
    };
    const binding: ConstructionPlanServerPdfBinding = { ...bindingBase, exportJobId: jobId };
    const expectedPath = buildConstructionPlanServerPdfStoragePath(binding, artifact);
    if (record.storagePath !== expectedPath) {
        pdfPipelineDataLoss('서버 PDF Storage path가 콘텐츠 주소 경로와 일치하지 않습니다.');
    }
    await assertFieldUsePdfPhysicalAudit(bytes, artifact, bindingBase.approvedEvidenceHash || '');
    const expectedCustomMetadata = buildConstructionPlanServerPdfCustomMetadata(binding, artifact);
    const storedCustomMetadata = isUnknownRecord(rawMetadata.metadata) ? rawMetadata.metadata : {};
    if (canonicalStringify(Object.keys(storedCustomMetadata).sort())
        !== canonicalStringify(Object.keys(expectedCustomMetadata).sort())) {
        pdfPipelineDataLoss('서버 PDF custom metadata schema가 일치하지 않습니다.');
    }
    const metadataMismatch = Object.entries(expectedCustomMetadata)
        .find(([key, value]) => readTrimmedString(storedCustomMetadata, [key]) !== value);
    if (metadataMismatch) {
        pdfPipelineDataLoss(`서버 PDF ${metadataMismatch[0]} custom metadata 바인딩이 일치하지 않습니다.`);
    }
    return { record, artifact };
};

const assertSharedFieldUseProvenance = (
    candidate: PersistedServerPdfArtifactRecord,
    issued: ConstructionPlanServerPdfArtifact,
): void => {
    const fields: Array<keyof Pick<ConstructionPlanServerPdfArtifact,
    'rendererVersion' | 'rendererTemplateBundleHash' | 'rendererBuildHash'
    | 'templateHash' | 'manifestHash' | 'templateBundleHash' | 'templateBindingHash'
    | 'contentManifestHash' | 'zeroOmissionCoverageHash' | 'drawingBindingHash'
    | 'drawingRenderMode' | 'snapshotHash' | 'approvedContentHash' | 'pageCount'>> = [
        'rendererVersion',
        'rendererTemplateBundleHash',
        'rendererBuildHash',
        'templateHash',
        'manifestHash',
        'templateBundleHash',
        'templateBindingHash',
        'contentManifestHash',
        'zeroOmissionCoverageHash',
        'drawingBindingHash',
        'drawingRenderMode',
        'snapshotHash',
        'approvedContentHash',
        'pageCount',
    ];
    const mismatch = fields.find((field) => candidate[field] !== issued[field]);
    if (mismatch) {
        throw new functions.https.HttpsError(
            'aborted',
            `candidate와 issued renderer provenance(${mismatch})가 동일 입력을 가리키지 않습니다.`,
        );
    }
    if (canonicalStringify(candidate.pageManifest) !== canonicalStringify(issued.pageManifest)) {
        throw new functions.https.HttpsError(
            'aborted',
            'candidate와 issued physical page manifest/coverage가 일치하지 않습니다.',
        );
    }
    if (candidate.renderInputHash === issued.renderInputHash || candidate.sha256 === issued.sha256) {
        throw new functions.https.HttpsError(
            'data-loss',
            'candidate/issued profile 격리 표식이 renderer 출력에 반영되지 않았습니다.',
        );
    }
};

const assertLivePlanMatchesApprovedPdfContext = (
    plan: UnknownRecord,
    context: ApprovedPdfSnapshotContext,
): void => {
    if (plan.status !== 'approved_pending_issue'
        || plan.approvedSnapshotId !== context.snapshotId
        || plan.approvedSnapshotHash !== context.snapshotHash
        || plan.approvedSnapshotStoragePath !== context.snapshotStoragePath
        || plan.approvedEvidenceId !== context.evidenceId
        || plan.approvedEvidenceHash !== context.evidenceHash
        || plan.templateHash !== context.bindingBase.templateHash
        || plan.manifestHash !== context.bindingBase.manifestHash
        || plan.templateBundleHash !== context.bindingBase.templateBundleHash
        || plan.templateBindingHash !== context.bindingBase.templateBindingHash) {
        throw new functions.https.HttpsError('aborted', '서버 PDF 처리 중 승인 제어 바인딩이 변경되었습니다.');
    }
    assertConstructionPlanDrawingPreviewBindingHash(
        context.planId,
        plan,
        context.authoritativeDrawingPreviewBindingHash,
    );
};

const assertSnapshotDocumentMatchesApprovedPdfContext = (
    raw: unknown,
    context: ApprovedPdfSnapshotContext,
): void => {
    if (!isUnknownRecord(raw)
        || raw.id !== context.snapshotId
        || raw.planId !== context.planId
        || raw.immutable !== true
        || raw.contentHash !== context.snapshotHash
        || raw.storagePath !== context.snapshotStoragePath
        || raw.storageGeneration !== context.snapshotStorageGeneration
        || Number(raw.contentByteLength) !== context.snapshotByteLength
        || canonicalStringify(raw.templateBinding) !== canonicalStringify(context.content.templateBinding)) {
        pdfPipelineDataLoss('트랜잭션 승인 스냅샷 바인딩이 변경되거나 손상되었습니다.');
    }
};

const assertApprovalEvidenceMatchesApprovedPdfContext = (
    raw: unknown,
    context: ApprovedPdfSnapshotContext,
): void => {
    try {
        assertConstructionPlanApprovalEvidenceBinding(raw, {
            planId: context.planId,
            evidenceHash: context.evidenceHash,
            snapshotId: context.snapshotId,
            contentHash: context.snapshotHash,
            storagePath: context.snapshotStoragePath,
            reviewPackageId: storedString(context.plan, 'activeReviewPackageId', 240),
            reviewCycleId: storedString(context.plan, 'activeReviewCycleId', 240),
            templateHash: context.bindingBase.templateHash,
            manifestHash: context.bindingBase.manifestHash,
            templateBundleHash: context.bindingBase.templateBundleHash,
            templateBindingHash: context.bindingBase.templateBindingHash,
        });
    } catch (error) {
        if (error instanceof functions.https.HttpsError) throw error;
        pdfPipelineDataLoss('트랜잭션 승인 증적 바인딩이 변경되거나 손상되었습니다.');
    }
};

const exportJobCore = (
    jobId: string,
    context: ApprovedPdfSnapshotContext,
    candidateArtifact: PersistedServerPdfArtifactRecord,
): UnknownRecord => ({
    id: jobId,
    jobSchemaVersion: 1,
    authority: 'server',
    planId: context.planId,
    siteId: context.bindingBase.siteId,
    documentNo: context.bindingBase.documentNo,
    revision: context.bindingBase.revision,
    approvedSnapshotHash: context.snapshotHash,
    approvedContentHash: context.approvedContentHash,
    snapshot: {
        schemaVersion: CONSTRUCTION_PLAN_SNAPSHOT_SCHEMA_VERSION,
        id: context.snapshotId,
        hash: context.snapshotHash,
        storagePath: context.snapshotStoragePath,
        storageGeneration: context.snapshotStorageGeneration,
        byteLength: context.snapshotByteLength,
    },
    approval: {
        evidenceId: context.evidenceId,
        evidenceHash: context.evidenceHash,
    },
    templateBinding: context.content.templateBinding,
    templateHash: context.bindingBase.templateHash,
    manifestHash: context.bindingBase.manifestHash,
    templateBundleHash: context.bindingBase.templateBundleHash,
    templateBindingHash: context.bindingBase.templateBindingHash,
    authoritativeDrawingPreviewBindingHash: context.authoritativeDrawingPreviewBindingHash,
    candidateArtifact,
});

const assertExistingExportJobCore = (
    raw: unknown,
    expectedCore: UnknownRecord,
): void => {
    if (!isUnknownRecord(raw)) pdfPipelineDataLoss('기존 서버 PDF job이 손상되었습니다.');
    const projection: UnknownRecord = {};
    Object.keys(expectedCore).forEach((key) => { projection[key] = raw[key]; });
    if (canonicalStringify(projection) !== canonicalStringify(expectedCore)) {
        pdfPipelineDataLoss('기존 서버 PDF job의 immutable input 바인딩이 일치하지 않습니다.');
    }
};

const assertExportJobTopLevelCandidateAudit = (
    job: UnknownRecord,
    candidate: PersistedServerPdfArtifactRecord,
): void => {
    const expected: UnknownRecord = {
        candidateStoragePath: candidate.storagePath,
        candidateStorageGeneration: candidate.storageGeneration,
        candidateSha256: candidate.sha256,
        candidatePageCount: candidate.pageCount,
        rendererVersion: candidate.rendererVersion,
        rendererTemplateBundleHash: candidate.rendererTemplateBundleHash,
        rendererBuildHash: candidate.rendererBuildHash,
        candidateRenderInputHash: candidate.renderInputHash,
        contentManifestHash: candidate.contentManifestHash,
        zeroOmissionCoverageHash: candidate.zeroOmissionCoverageHash,
        drawingBindingHash: candidate.drawingBindingHash,
        drawingRenderMode: candidate.drawingRenderMode,
        templateHash: candidate.templateHash,
        manifestHash: candidate.manifestHash,
        templateBundleHash: candidate.templateBundleHash,
        templateBindingHash: candidate.templateBindingHash,
    };
    const mismatch = Object.entries(expected).find(([key, value]) => job[key] !== value);
    if (mismatch) pdfPipelineDataLoss(`서버 PDF job ${mismatch[0]} 감사 바인딩이 손상되었습니다.`);
};

const bindingBaseFromExportJob = (
    job: UnknownRecord,
): Omit<ConstructionPlanServerPdfBinding, 'exportJobId'> => {
    if (!isUnknownRecord(job.snapshot) || !isUnknownRecord(job.approval)) {
        pdfPipelineDataLoss('서버 PDF job snapshot/approval 바인딩이 손상되었습니다.');
    }
    const snapshot = job.snapshot as UnknownRecord;
    const approval = job.approval as UnknownRecord;
    if (snapshot.schemaVersion !== CONSTRUCTION_PLAN_SNAPSHOT_SCHEMA_VERSION) {
        throw new functions.https.HttpsError(
            'failed-precondition',
            'schema v2 서버 PDF job만 현장사용 발행할 수 있습니다.',
        );
    }
    const nestedSnapshotHash = storedSha256(snapshot, 'hash');
    if (nestedSnapshotHash !== storedSha256(job, 'approvedSnapshotHash')) {
        pdfPipelineDataLoss('서버 PDF job의 top-level/nested snapshot hash가 일치하지 않습니다.');
    }
    storedPositiveInteger(snapshot, 'byteLength');
    storedSha256(job, 'authoritativeDrawingPreviewBindingHash');
    const revision = Number(job.revision);
    if (!Number.isInteger(revision) || revision < 0) pdfPipelineDataLoss('서버 PDF job revision이 손상되었습니다.');
    return {
        siteId: storedString(job, 'siteId', 200),
        planId: storedString(job, 'planId', 200),
        documentNo: storedString(job, 'documentNo', 240),
        revision,
        approvedSnapshotId: storedString(snapshot, 'id', 240),
        approvedSnapshotStoragePath: storedString(snapshot, 'storagePath', 1000),
        approvedSnapshotStorageGeneration: storedGeneration(snapshot),
        authoritativeDrawingPreviewBindingHash: storedSha256(
            job,
            'authoritativeDrawingPreviewBindingHash',
        ),
        approvedEvidenceId: storedString(approval, 'evidenceId', 240),
        approvedEvidenceHash: storedSha256(approval, 'evidenceHash'),
        templateHash: storedSha256(job, 'templateHash'),
        manifestHash: storedSha256(job, 'manifestHash'),
        templateBundleHash: storedSha256(job, 'templateBundleHash'),
        templateBindingHash: storedSha256(job, 'templateBindingHash'),
    };
};

const assertPrimitiveAuditProjection = (
    record: UnknownRecord,
    expected: UnknownRecord,
    label: string,
): void => {
    const mismatch = Object.entries(expected).find(([key, value]) => record[key] !== value);
    if (mismatch) pdfPipelineDataLoss(`${label} ${mismatch[0]} 중복 감사 바인딩이 손상되었습니다.`);
};

export const assertExistingIssuedRedundantAudit = (
    plan: UnknownRecord,
    job: UnknownRecord,
    exported: UnknownRecord,
    exportId: string,
    binding: Omit<ConstructionPlanServerPdfBinding, 'exportJobId'>,
    candidate: PersistedServerPdfArtifactRecord,
    issued: PersistedServerPdfArtifactRecord,
): void => {
    const visualCheckedBy = storedString(job, 'visualCheckedBy', 200);
    const visualCheckedAt = storedString(job, 'visualCheckedAt', 100);
    const issuedBy = storedString(job, 'issuedBy', 200);
    const issuedAt = storedString(job, 'issuedAt', 100);
    if (job.visualCheckConfirmed !== true || visualCheckedBy !== issuedBy
        || visualCheckedAt !== issuedAt || Number.isNaN(Date.parse(visualCheckedAt))) {
        pdfPipelineDataLoss('기존 발행 job의 육안검수/발행 actor·시각 감사 바인딩이 손상되었습니다.');
    }
    assertPrimitiveAuditProjection(job, {
        issuedExportId: exportId,
        issuedStoragePath: issued.storagePath,
        issuedStorageGeneration: issued.storageGeneration,
        issuedSha256: issued.sha256,
        issuedPageCount: issued.pageCount,
        approvedSnapshotHash: issued.snapshotHash,
        approvedContentHash: issued.approvedContentHash,
        templateHash: binding.templateHash,
        manifestHash: binding.manifestHash,
        templateBundleHash: binding.templateBundleHash,
        templateBindingHash: binding.templateBindingHash,
        issuedRenderInputHash: issued.renderInputHash,
        visualCheckConfirmed: true,
        visualCheckedBy,
        visualCheckedAt,
        issuedBy,
        issuedAt,
        updatedAt: issuedAt,
    }, '기존 발행 job');

    const snapshot = job.snapshot as UnknownRecord;
    assertPrimitiveAuditProjection(exported, {
        id: exportId,
        planId: binding.planId,
        jobId: storedString(job, 'id', 240),
        snapshotId: binding.approvedSnapshotId,
        snapshotHash: issued.snapshotHash,
        approvedContentHash: issued.approvedContentHash,
        snapshotStoragePath: binding.approvedSnapshotStoragePath,
        snapshotStorageGeneration: binding.approvedSnapshotStorageGeneration,
        snapshotByteLength: storedPositiveInteger(snapshot, 'byteLength'),
        approvalEvidenceId: binding.approvedEvidenceId,
        approvalEvidenceHash: binding.approvedEvidenceHash,
        templateHash: binding.templateHash,
        manifestHash: binding.manifestHash,
        templateBundleHash: binding.templateBundleHash,
        templateBindingHash: binding.templateBindingHash,
        authoritativeDrawingPreviewBindingHash: binding.authoritativeDrawingPreviewBindingHash,
        candidateStoragePath: candidate.storagePath,
        candidateStorageGeneration: candidate.storageGeneration,
        candidateSha256: candidate.sha256,
        kind: 'issued',
        status: 'ready',
        immutable: true,
        storagePath: issued.storagePath,
        storageGeneration: issued.storageGeneration,
        sha256: issued.sha256,
        sizeBytes: issued.sizeBytes,
        pageCount: issued.pageCount,
        fileName: issued.fileName,
        rendererVersion: issued.rendererVersion,
        rendererTemplateBundleHash: issued.rendererTemplateBundleHash,
        rendererBuildHash: issued.rendererBuildHash,
        renderInputHash: issued.renderInputHash,
        contentManifestHash: issued.contentManifestHash,
        zeroOmissionCoverageHash: issued.zeroOmissionCoverageHash,
        drawingBindingHash: issued.drawingBindingHash,
        drawingRenderMode: issued.drawingRenderMode,
        visualCheckedBy,
        visualCheckedAt,
        generatedBy: issuedBy,
        generatedAt: issuedAt,
        createdAt: issuedAt,
    }, '기존 발행 export');
    if (!isUnknownRecord(exported.validation)
        || canonicalStringify(exported.validation)
            !== canonicalStringify(ISSUED_PDF_VALIDATION_PROJECTION)) {
        pdfPipelineDataLoss('기존 발행 export validation 감사 바인딩이 손상되었습니다.');
    }

    assertPrimitiveAuditProjection(plan, {
        issuedExportId: exportId,
        issuedExportJobId: storedString(job, 'id', 240),
        issuedExportStoragePath: issued.storagePath,
        issuedExportStorageGeneration: issued.storageGeneration,
        issuedExportSha256: issued.sha256,
        issuedExportFileName: issued.fileName,
        issuedExportPageCount: issued.pageCount,
        issuedCandidateStoragePath: candidate.storagePath,
        issuedCandidateStorageGeneration: candidate.storageGeneration,
        issuedCandidateSha256: candidate.sha256,
        issuedApprovedContentHash: issued.approvedContentHash,
        issuedTemplateHash: binding.templateHash,
        issuedManifestHash: binding.manifestHash,
        issuedTemplateBundleHash: binding.templateBundleHash,
        issuedTemplateBindingHash: binding.templateBindingHash,
        issuedRendererVersion: issued.rendererVersion,
        issuedRendererTemplateBundleHash: issued.rendererTemplateBundleHash,
        issuedRendererBuildHash: issued.rendererBuildHash,
        issuedRenderInputHash: issued.renderInputHash,
        issuedContentManifestHash: issued.contentManifestHash,
        issuedZeroOmissionCoverageHash: issued.zeroOmissionCoverageHash,
        issuedDrawingBindingHash: issued.drawingBindingHash,
        issuedAuthoritativeDrawingPreviewBindingHash: binding.authoritativeDrawingPreviewBindingHash,
        issuedVisualCheckedBy: visualCheckedBy,
        issuedVisualCheckedAt: visualCheckedAt,
        issuedAt,
        issuedBy,
    }, '기존 발행 plan');
};

const existingIssuedResponse = async (
    request: IssueRequest,
    plan: UnknownRecord,
): Promise<IssueResponse | null> => {
    if (plan.status !== 'issued' && plan.status !== 'superseded') return null;
    const templateContext = boundTemplateContextForPlan(plan);
    assertBoundTemplateLifecycleSnapshot(templateContext, await templateContext.reference.get());
    const exportId = readTrimmedString(plan, ['issuedExportId']);
    const planJobId = readTrimmedString(plan, ['issuedExportJobId']);
    if (!exportId || !planJobId || planJobId !== request.jobId) {
        throw new functions.https.HttpsError('already-exists', '다른 서버 PDF job으로 이미 발행되었습니다.');
    }
    if (plan.approvedSnapshotHash !== request.approvedSnapshotHash) {
        pdfPipelineDataLoss('기존 발행 plan의 승인 스냅샷 바인딩이 손상되었습니다.');
    }
    const [exportSnapshot, jobSnapshot] = await Promise.all([
        db().collection(PLANS_COLLECTION).doc(request.planId).collection('exports').doc(exportId).get(),
        db().collection(EXPORT_JOBS_COLLECTION).doc(request.jobId).get(),
    ]);
    const exportRecord = exportSnapshot.data();
    const jobRecord = jobSnapshot.data();
    if (!exportSnapshot.exists || !isUnknownRecord(exportRecord)
        || !jobSnapshot.exists || !isUnknownRecord(jobRecord)
        || jobRecord.status !== 'ISSUED'
        || jobRecord.id !== request.jobId
        || jobRecord.planId !== request.planId
        || jobRecord.approvedSnapshotHash !== request.approvedSnapshotHash
        || !isUnknownRecord(jobRecord.candidateArtifact)
        || !isUnknownRecord(jobRecord.issuedArtifact)
        || !isUnknownRecord(exportRecord.artifact)) {
        pdfPipelineDataLoss('기존 발행 export/job 감사 레코드가 손상되었습니다.');
    }
    const candidateProjection = persistedArtifactFromRecord(jobRecord.candidateArtifact, 'candidate');
    assertExportJobTopLevelCandidateAudit(jobRecord, candidateProjection);
    if (storedSha256(jobRecord, 'approvedContentHash') !== candidateProjection.approvedContentHash) {
        pdfPipelineDataLoss('기존 발행 job approvedContentHash가 candidate와 일치하지 않습니다.');
    }
    if (candidateProjection.sha256 !== request.expectedCandidateSha256) {
        throw new functions.https.HttpsError('already-exists', '다른 candidate PDF가 이미 발행되었습니다.');
    }
    if (canonicalStringify(jobRecord.issuedArtifact) !== canonicalStringify(exportRecord.artifact)) {
        pdfPipelineDataLoss('기존 발행 job과 export의 issued artifact 바인딩이 일치하지 않습니다.');
    }
    const bindingBase = bindingBaseFromExportJob(jobRecord);
    if (bindingBase.planId !== request.planId
        || bindingBase.siteId !== plan.siteId
        || bindingBase.documentNo !== plan.documentNo
        || bindingBase.revision !== Number(plan.revision)
        || bindingBase.approvedSnapshotId !== plan.approvedSnapshotId
        || bindingBase.approvedSnapshotStoragePath !== plan.approvedSnapshotStoragePath
        || bindingBase.approvedEvidenceId !== plan.approvedEvidenceId
        || bindingBase.approvedEvidenceHash !== plan.approvedEvidenceHash
        || candidateProjection.snapshotHash !== request.approvedSnapshotHash) {
        pdfPipelineDataLoss('기존 발행 plan/job 승인 입력 바인딩이 손상되었습니다.');
    }
    const { record: candidate } = await verifyPersistedServerPdfArtifact(
        jobRecord.candidateArtifact,
        'candidate',
        bindingBase,
        request.jobId,
    );
    const { record: issued, artifact: issuedArtifact } = await verifyPersistedServerPdfArtifact(
        jobRecord.issuedArtifact,
        'issued',
        bindingBase,
        request.jobId,
    );
    if (issued.snapshotHash !== request.approvedSnapshotHash) {
        pdfPipelineDataLoss('기존 issued artifact snapshot hash가 job과 일치하지 않습니다.');
    }
    assertSharedFieldUseProvenance(candidate, issuedArtifact);
    if (decideIssuedPdfTransactionDisposition({
        planStatus: plan.status,
        planJobId: plan.issuedExportJobId,
        planExportId: plan.issuedExportId,
        jobStatus: jobRecord.status,
        exportExists: exportSnapshot.exists,
        expectedJobId: request.jobId,
        expectedExportId: exportId,
        terminalArtifactsMatch: terminalIssuedPdfArtifactsMatch(
            jobRecord.issuedArtifact,
            exportRecord.artifact,
            issued,
        ),
    }) !== 'idempotent') {
        pdfPipelineDataLoss('기존 발행 terminal recovery 상태 투영이 일치하지 않습니다.');
    }
    assertExistingIssuedRedundantAudit(
        plan,
        jobRecord,
        exportRecord,
        exportId,
        bindingBase,
        candidate,
        issued,
    );
    return {
        planId: request.planId,
        jobId: request.jobId,
        status: 'issued',
        issuedExportId: exportId,
        storagePath: issued.storagePath,
        storageGeneration: issued.storageGeneration,
        sha256: issued.sha256,
        pageCount: issued.pageCount,
        sizeBytes: issued.sizeBytes,
        fileName: issued.fileName,
        provenance: artifactProvenance(issued),
        idempotent: true,
    };
};

// Server-authoritative PREPARE -> visual check -> FINALIZE pipeline.
export const prepareConstructionPlanIssuedPdfServer = constructionPlanPdfRunner.https.onCall(
    async (data: unknown, callableContext): Promise<PrepareIssuedPdfResponse> => {
        const request = parsePrepareIssuedPdfRequest(data);
        const actor = await resolveCallableActor(callableContext);
        requireIssueAccess(actor);

        const planRef = db().collection(PLANS_COLLECTION).doc(request.planId);
        const preflightPlan = planData(await planRef.get());
        assertPlanParticipantAccess(preflightPlan, actor);
        const approved = await loadApprovedPdfSnapshotContext(
            request.planId,
            preflightPlan,
            request.approvedSnapshotHash,
        );
        const templateContext = boundTemplateContextForPlan(approved.plan);
        const rendered = await runMonitoredConstructionPlanPdfRender({
            planId: approved.planId,
            approvedSnapshotHash: approved.snapshotHash,
            templateBindingHash: approved.bindingBase.templateBindingHash,
            drawingBindingHash: approved.authoritativeDrawingPreviewBindingHash,
            rendererVersion: CONSTRUCTION_PLAN_FIELD_USE_RENDERER_VERSION,
            profile: 'candidate',
            actorId: actor.uid,
            task: () => renderApprovedFieldUsePdf('candidate', approved),
            summarize: (result) => ({
                sha256: result.sha256,
                sizeBytes: result.sizeBytes,
                pageCount: result.pageCount,
                renderInputHash: result.renderInputHash,
            }),
        });
        const candidate = serverPdfArtifactFromRenderResult(rendered, approved, 'candidate');
        const jobId = buildExportJobId(approved, candidate);
        const binding: ConstructionPlanServerPdfBinding = {
            ...approved.bindingBase,
            exportJobId: jobId,
        };
        const stored = await storeImmutableConstructionPlanServerPdf(bucket(), binding, candidate);
        const candidateRecord = persistedArtifactRecord(candidate, stored);
        const verifiedCandidate = await verifyPersistedServerPdfArtifact(
            candidateRecord,
            'candidate',
            approved.bindingBase,
            jobId,
        );
        const jobCore = exportJobCore(jobId, approved, verifiedCandidate.record);
        const jobRef = db().collection(EXPORT_JOBS_COLLECTION).doc(jobId);
        const snapshotRef = planRef.collection('snapshots').doc(approved.snapshotId);
        const evidenceRef = planRef.collection('approvals').doc(approved.evidenceId);
        let idempotent = false;
        await db().runTransaction(async (transaction) => {
            const [latestPlanSnapshot, snapshotDocument, evidenceDocument, existingJob, templateDocument] = await Promise.all([
                transaction.get(planRef),
                transaction.get(snapshotRef),
                transaction.get(evidenceRef),
                transaction.get(jobRef),
                transaction.get(templateContext.reference),
            ]);
            const latestPlan = planData(latestPlanSnapshot);
            assertPlanParticipantAccess(latestPlan, actor);
            assertLivePlanMatchesApprovedPdfContext(latestPlan, approved);
            assertSnapshotDocumentMatchesApprovedPdfContext(snapshotDocument.data(), approved);
            assertApprovalEvidenceMatchesApprovedPdfContext(evidenceDocument.data(), approved);
            assertBoundTemplateLifecycleSnapshot(templateContext, templateDocument);
            if (existingJob.exists) {
                assertExistingExportJobCore(existingJob.data(), jobCore);
                if (!isUnknownRecord(existingJob.data())
                    || !['READY_FOR_VISUAL_CHECK', 'ISSUED'].includes(String(existingJob.data()?.status || ''))) {
                    pdfPipelineDataLoss('기존 서버 PDF job 상태가 손상되었습니다.');
                }
                assertExportJobTopLevelCandidateAudit(
                    existingJob.data() as UnknownRecord,
                    verifiedCandidate.record,
                );
                idempotent = true;
                return;
            }
            const timestamp = new Date().toISOString();
            transaction.create(jobRef, buildPreparedPdfJobProjection({
                jobCore,
                candidate: verifiedCandidate.record,
                actorId: actor.uid,
                timestamp,
            }));
        });
        return {
            planId: request.planId,
            jobId,
            status: 'ready_for_visual_check',
            approvedSnapshotHash: approved.snapshotHash,
            candidate: artifactResponse(verifiedCandidate.record),
            provenance: artifactProvenance(verifiedCandidate.record),
            idempotent,
        };
    },
);

export const issueConstructionPlanServer = constructionPlanPdfRunner.https.onCall(
    async (data: unknown, callableContext): Promise<IssueResponse> => {
        const request = parseIssueRequest(data);
        const actor = await resolveCallableActor(callableContext);
        requireIssueAccess(actor);

        const planRef = db().collection(PLANS_COLLECTION).doc(request.planId);
        const preflightPlan = planData(await planRef.get());
        assertPlanParticipantAccess(preflightPlan, actor);
        // Issued/superseded retry deliberately runs before snapshot/drawing reads.
        const alreadyIssued = await existingIssuedResponse(request, preflightPlan);
        if (alreadyIssued) return alreadyIssued;
        if (preflightPlan.status !== 'approved_pending_issue') {
            throw new functions.https.HttpsError('failed-precondition', '승인 완료 후 준비된 서버 PDF만 발행할 수 있습니다.');
        }

        const jobRef = db().collection(EXPORT_JOBS_COLLECTION).doc(request.jobId);
        const jobSnapshot = await jobRef.get();
        if (!jobSnapshot.exists || !isUnknownRecord(jobSnapshot.data())) {
            throw new functions.https.HttpsError('not-found', '서버 PDF 준비 job을 찾을 수 없습니다.');
        }
        const preflightJob = jobSnapshot.data() as UnknownRecord;
        if (preflightJob.id !== request.jobId
            || preflightJob.authority !== 'server'
            || preflightJob.jobSchemaVersion !== 1
            || preflightJob.planId !== request.planId
            || preflightJob.status !== 'READY_FOR_VISUAL_CHECK'
            || preflightJob.approvedSnapshotHash !== request.approvedSnapshotHash
            || !isUnknownRecord(preflightJob.candidateArtifact)) {
            throw new functions.https.HttpsError('failed-precondition', '서버 PDF 준비 job 바인딩 또는 상태가 올바르지 않습니다.');
        }
        const jobBindingBase = bindingBaseFromExportJob(preflightJob);
        const verifiedCandidate = await verifyPersistedServerPdfArtifact(
            preflightJob.candidateArtifact,
            'candidate',
            jobBindingBase,
            request.jobId,
        );
        assertExportJobTopLevelCandidateAudit(preflightJob, verifiedCandidate.record);
        if (verifiedCandidate.record.sha256 !== request.expectedCandidateSha256
            || preflightJob.candidateSha256 !== verifiedCandidate.record.sha256
            || preflightJob.candidateStorageGeneration !== verifiedCandidate.record.storageGeneration) {
            throw new functions.https.HttpsError('aborted', '육안 검수한 candidate SHA/generation이 서버 job과 일치하지 않습니다.');
        }

        const approved = await loadApprovedPdfSnapshotContext(
            request.planId,
            preflightPlan,
            request.approvedSnapshotHash,
        );
        const templateContext = boundTemplateContextForPlan(approved.plan);
        if (canonicalStringify(jobBindingBase) !== canonicalStringify(approved.bindingBase)
            || verifiedCandidate.record.snapshotHash !== approved.snapshotHash
            || verifiedCandidate.record.approvedContentHash !== approved.approvedContentHash
            || preflightJob.authoritativeDrawingPreviewBindingHash
                !== approved.authoritativeDrawingPreviewBindingHash
            || buildExportJobId(approved, verifiedCandidate.artifact) !== request.jobId) {
            throw new functions.https.HttpsError('aborted', '서버 PDF job이 현재 승인 입력과 동일하지 않습니다.');
        }

        const issuedRender = await runMonitoredConstructionPlanPdfRender({
            planId: approved.planId,
            approvedSnapshotHash: approved.snapshotHash,
            templateBindingHash: approved.bindingBase.templateBindingHash,
            drawingBindingHash: approved.authoritativeDrawingPreviewBindingHash,
            rendererVersion: CONSTRUCTION_PLAN_FIELD_USE_RENDERER_VERSION,
            profile: 'issued',
            actorId: actor.uid,
            task: () => renderApprovedFieldUsePdf('issued', approved),
            summarize: (result) => ({
                sha256: result.sha256,
                sizeBytes: result.sizeBytes,
                pageCount: result.pageCount,
                renderInputHash: result.renderInputHash,
            }),
        });
        const issuedArtifact = serverPdfArtifactFromRenderResult(issuedRender, approved, 'issued');
        assertSharedFieldUseProvenance(verifiedCandidate.record, issuedArtifact);
        const binding: ConstructionPlanServerPdfBinding = {
            ...approved.bindingBase,
            exportJobId: request.jobId,
        };
        const storedIssued = await storeImmutableConstructionPlanServerPdf(bucket(), binding, issuedArtifact);
        const issuedRecord = persistedArtifactRecord(issuedArtifact, storedIssued);
        const verifiedIssued = await verifyPersistedServerPdfArtifact(
            issuedRecord,
            'issued',
            approved.bindingBase,
            request.jobId,
        );

        const siteId = approved.bindingBase.siteId;
        const documentNo = approved.bindingBase.documentNo;
        const revision = approved.bindingBase.revision;
        const seriesIdentity = buildConstructionPlanSeriesIdentity(siteId, documentNo);
        const recordedSeriesId = readTrimmedString(preflightPlan, ['seriesId']);
        if (recordedSeriesId && recordedSeriesId !== seriesIdentity.seriesId) {
            pdfPipelineDataLoss('발행 대상 seriesId가 승인 문서번호와 일치하지 않습니다.');
        }
        const supersedesPlanId = readTrimmedString(preflightPlan, ['supersedesPlanId']);
        const exportId = buildConstructionPlanServerPdfExportId(verifiedIssued.artifact);
        const exportRef = planRef.collection('exports').doc(exportId);
        const snapshotRef = planRef.collection('snapshots').doc(approved.snapshotId);
        const evidenceRef = planRef.collection('approvals').doc(approved.evidenceId);
        const seriesRef = db().collection(SERIES_COLLECTION).doc(seriesIdentity.seriesId);
        const eventRef = planRef.collection('workflowEvents').doc();
        const supersededSourceRef = supersedesPlanId
            ? db().collection(PLANS_COLLECTION).doc(supersedesPlanId)
            : null;
        const supersedeEventRef = supersededSourceRef
            ? supersededSourceRef.collection('workflowEvents').doc()
            : null;
        const expectedJobCore = exportJobCore(request.jobId, approved, verifiedCandidate.record);

        return db().runTransaction(async (transaction): Promise<IssueResponse> => {
            const snapshots = await Promise.all([
                transaction.get(planRef),
                transaction.get(snapshotRef),
                transaction.get(evidenceRef),
                transaction.get(jobRef),
                transaction.get(exportRef),
                transaction.get(seriesRef),
                transaction.get(templateContext.reference),
                ...(supersededSourceRef ? [transaction.get(supersededSourceRef)] : []),
            ]);
            const [latestPlanSnapshot, snapshotDocument, evidenceDocument,
                latestJobSnapshot, existingExport, seriesSnapshot] = snapshots;
            const templateDocument = snapshots[6];
            const supersededSourceSnapshot = supersededSourceRef ? snapshots[7] : undefined;
            const plan = planData(latestPlanSnapshot);
            assertPlanParticipantAccess(plan, actor);
            const latestJob = latestJobSnapshot.data();
            if (!latestJobSnapshot.exists || !isUnknownRecord(latestJob)) {
                pdfPipelineDataLoss('발행 트랜잭션 중 서버 PDF job이 삭제되었습니다.');
            }
            assertExistingExportJobCore(latestJob, expectedJobCore);
            assertExportJobTopLevelCandidateAudit(latestJob, verifiedCandidate.record);

            const existingExportData = existingExport.data();
            const terminalArtifactsMatch = terminalIssuedPdfArtifactsMatch(
                latestJob.issuedArtifact,
                isUnknownRecord(existingExportData) ? existingExportData.artifact : undefined,
                verifiedIssued.record,
            );
            const disposition = decideIssuedPdfTransactionDisposition({
                planStatus: plan.status,
                planJobId: plan.issuedExportJobId,
                planExportId: plan.issuedExportId,
                jobStatus: latestJob.status,
                exportExists: existingExport.exists,
                expectedJobId: request.jobId,
                expectedExportId: exportId,
                terminalArtifactsMatch,
            });
            if (disposition === 'idempotent') {
                if (!isUnknownRecord(existingExportData)) {
                    pdfPipelineDataLoss('동시 발행 완료 export 감사 레코드가 손상되었습니다.');
                }
                assertExistingIssuedRedundantAudit(
                    plan,
                    latestJob,
                    existingExportData,
                    exportId,
                    jobBindingBase,
                    verifiedCandidate.record,
                    verifiedIssued.record,
                );
                return {
                    planId: request.planId,
                    jobId: request.jobId,
                    status: 'issued',
                    issuedExportId: exportId,
                    storagePath: verifiedIssued.record.storagePath,
                    storageGeneration: verifiedIssued.record.storageGeneration,
                    sha256: verifiedIssued.record.sha256,
                    pageCount: verifiedIssued.record.pageCount,
                    sizeBytes: verifiedIssued.record.sizeBytes,
                    fileName: verifiedIssued.record.fileName,
                    provenance: artifactProvenance(verifiedIssued.record),
                    idempotent: true,
                };
            }
            const terminalIdentityMatches = (plan.status === 'issued' || plan.status === 'superseded')
                && plan.issuedExportId === exportId
                && plan.issuedExportJobId === request.jobId
                && latestJob.status === 'ISSUED'
                && existingExport.exists;
            if (terminalIdentityMatches && !terminalArtifactsMatch) {
                pdfPipelineDataLoss('동시 발행 완료 artifact가 동일한 deterministic 결과와 일치하지 않습니다.');
            }
            if (disposition !== 'apply') {
                if (plan.status === 'approved_pending_issue'
                    && latestJob.status === 'READY_FOR_VISUAL_CHECK' && existingExport.exists) {
                    pdfPipelineDataLoss('READY job에 issued export가 비정상적으로 선점되어 있습니다.');
                }
                throw new functions.https.HttpsError('aborted', '발행 트랜잭션 상태가 처리 중 변경되었습니다.');
            }

            assertLivePlanMatchesApprovedPdfContext(plan, approved);
            assertSnapshotDocumentMatchesApprovedPdfContext(snapshotDocument.data(), approved);
            assertApprovalEvidenceMatchesApprovedPdfContext(evidenceDocument.data(), approved);
            assertBoundTemplateLifecycleSnapshot(templateContext, templateDocument);

            if (readTrimmedString(plan, ['seriesId'])
                && readTrimmedString(plan, ['seriesId']) !== seriesIdentity.seriesId) {
                pdfPipelineDataLoss('발행 대상의 시리즈 연결이 손상되었습니다.');
            }
            let planTemplate: ReturnType<typeof resolveConstructionPlanServerTemplate>;
            try {
                planTemplate = resolveConstructionPlanServerTemplate({
                    tradeType: plan.tradeType,
                    templateId: plan.templateId,
                    templateVersion: plan.templateVersion,
                });
            } catch {
                pdfPipelineDataLoss('발행 대상의 공종·템플릿 식별자가 손상되었습니다.');
            }
            let series: UnknownRecord | null = null;
            if (seriesSnapshot.exists) {
                series = assertSeriesIdentity(
                    seriesSnapshot.data(),
                    seriesIdentity,
                    siteId,
                    planTemplate.tradeType,
                );
                if (Number(series.latestRevisionNo) !== revision || series.latestPlanId !== request.planId) {
                    throw new functions.https.HttpsError(
                        'failed-precondition',
                        '현재 시리즈의 최신 개정본만 현장사용 발행할 수 있습니다.',
                    );
                }
            }

            let supersededSource: UnknownRecord | null = null;
            if (supersededSourceRef) {
                if (!supersededSourceSnapshot) pdfPipelineDataLoss('대체할 이전 발행본을 확인할 수 없습니다.');
                const sourceRaw = planData(supersededSourceSnapshot as admin.firestore.DocumentSnapshot);
                supersededSource = { ...sourceRaw, id: supersedesPlanId };
                const sourceRevision = Number(supersededSource.revision);
                const sourceDocumentNo = readTrimmedString(supersededSource, ['documentNo']);
                if (supersededSource.siteId !== siteId
                    || !sourceDocumentNo
                    || normalizeConstructionPlanDocumentNoKey(sourceDocumentNo) !== seriesIdentity.documentNoKey
                    || !Number.isInteger(sourceRevision)
                    || sourceRevision < 0
                    || sourceRevision >= revision
                    || (plan.sourceRevisionNo !== undefined
                        && (!Number.isInteger(plan.sourceRevisionNo)
                            || Number(plan.sourceRevisionNo) !== sourceRevision))
                    || supersededSource.status !== 'issued'
                    || (readTrimmedString(supersededSource, ['seriesId'])
                        && readTrimmedString(supersededSource, ['seriesId']) !== seriesIdentity.seriesId)) {
                    throw new functions.https.HttpsError('failed-precondition', '이전 발행본과 새 개정본의 계보가 일치하지 않습니다.');
                }
                if (series && series.latestIssuedPlanId !== supersedesPlanId) {
                    throw new functions.https.HttpsError('failed-precondition', '이전 발행본이 현재 시리즈의 최신 발행본이 아닙니다.');
                }
            } else if (series?.latestIssuedPlanId) {
                throw new functions.https.HttpsError(
                    'failed-precondition',
                    '기존 발행본을 대체하지 않는 개정본은 발행할 수 없습니다.',
                );
            }
            try {
                const decision = decideConstructionPlanIssueSeriesTransition(
                    seriesSnapshot.exists ? seriesSnapshot.data() : null,
                    seriesIdentity,
                    { ...plan, id: request.planId },
                    supersededSource || undefined,
                );
                if (decision.supersedeSource !== Boolean(supersededSource)) {
                    throw new Error('construction-plan-issue-source-decision-mismatch');
                }
            } catch (error) {
                const code = error instanceof Error ? error.message : '';
                if (code.includes('identity-invalid')) {
                    pdfPipelineDataLoss('발행 대상의 시리즈 또는 계보 식별 정보가 손상되었습니다.');
                }
                throw new functions.https.HttpsError('failed-precondition', '발행 대상의 최신 시리즈 계보가 일치하지 않습니다.');
            }

            const timestamp = new Date().toISOString();
            const lineageRootPlanId = readTrimmedString(plan, ['lineageRootPlanId'])
                || (supersededSource ? readTrimmedString(supersededSource, ['lineageRootPlanId']) : undefined)
                || supersedesPlanId
                || request.planId;
            const projection = buildIssuedPdfAtomicProjection({
                planId: request.planId,
                jobId: request.jobId,
                exportId,
                siteId,
                tradeType: planTemplate.tradeType,
                documentNo: seriesIdentity.documentNo,
                documentNoKey: seriesIdentity.documentNoKey,
                revision,
                seriesId: seriesIdentity.seriesId,
                lineageRootPlanId,
                currentPlanLockVersion: currentLockVersion(plan),
                ...(supersedesPlanId ? { supersedesPlanId } : {}),
                ...(supersededSource
                    ? { supersededSourceLockVersion: currentLockVersion(supersededSource) }
                    : {}),
                issueEventId: eventRef.id,
                ...(supersedeEventRef ? { supersedeEventId: supersedeEventRef.id } : {}),
                snapshot: {
                    id: approved.snapshotId,
                    hash: approved.snapshotHash,
                    storagePath: approved.snapshotStoragePath,
                    storageGeneration: approved.snapshotStorageGeneration,
                    byteLength: approved.snapshotByteLength,
                },
                approval: { evidenceId: approved.evidenceId, evidenceHash: approved.evidenceHash },
                templateBinding: approved.content.templateBinding as UnknownRecord,
                templateHash: approved.bindingBase.templateHash,
                manifestHash: approved.bindingBase.manifestHash,
                templateBundleHash: approved.bindingBase.templateBundleHash,
                templateBindingHash: approved.bindingBase.templateBindingHash,
                authoritativeDrawingPreviewBindingHash:
                    approved.authoritativeDrawingPreviewBindingHash,
                candidate: verifiedCandidate.record,
                issued: verifiedIssued.record,
                actorId: actor.uid,
                ...(actorNameSnapshot(actor) ? { actorName: actorNameSnapshot(actor) } : {}),
                timestamp,
            });
            transaction.create(exportRef, projection.exportCreate);
            if (seriesSnapshot.exists) {
                transaction.update(seriesRef, projection.seriesUpdate);
            } else {
                transaction.create(seriesRef, projection.seriesCreate);
            }

            if (supersededSourceRef && supersededSource) {
                const sourceUpdate: UnknownRecord = {};
                if (!readTrimmedString(supersededSource, ['seriesId'])) sourceUpdate.seriesId = seriesIdentity.seriesId;
                if (!readTrimmedString(supersededSource, ['lineageRootPlanId'])) {
                    sourceUpdate.lineageRootPlanId = supersedesPlanId;
                }
                Object.assign(sourceUpdate, {
                    ...projection.supersededPlanUpdate,
                    editLock: admin.firestore.FieldValue.delete(),
                });
                transaction.update(supersededSourceRef, sourceUpdate);
                if (supersedeEventRef && projection.supersedeEventCreate) {
                    transaction.create(supersedeEventRef, projection.supersedeEventCreate);
                }
            }

            transaction.update(jobRef, projection.jobUpdate);
            transaction.update(planRef, {
                ...projection.planUpdate,
                editLock: admin.firestore.FieldValue.delete(),
            });
            transaction.create(eventRef, projection.issueEventCreate);
            return {
                planId: request.planId,
                jobId: request.jobId,
                status: 'issued',
                issuedExportId: exportId,
                storagePath: verifiedIssued.record.storagePath,
                storageGeneration: verifiedIssued.record.storageGeneration,
                sha256: verifiedIssued.record.sha256,
                pageCount: verifiedIssued.record.pageCount,
                sizeBytes: verifiedIssued.record.sizeBytes,
                fileName: verifiedIssued.record.fileName,
                provenance: artifactProvenance(verifiedIssued.record),
                idempotent: false,
            };
        });
    },
);

export const ensureConstructionPlanDrawingPreviewServer = constructionPlanPdfRunner.https.onCall(
    async (data: unknown, context) => {
        const request = parseEnsureConstructionPlanDrawingPreviewRequest(data);
        const actor = await resolveCallableActor(context);
        const planRef = db().collection(PLANS_COLLECTION).doc(request.planId);
        const plan = planData(await planRef.get());
        assertDrawingPreviewMutationAccess(plan, actor);
        return ensureConstructionPlanDrawingPreview({
            database: db(),
            storageBucket: bucket(),
            actorId: actor.uid,
            request,
            assertPlanMutationAllowed: (currentPlan) => {
                assertDrawingPreviewMutationAccess(currentPlan, actor);
            },
        });
    },
);
