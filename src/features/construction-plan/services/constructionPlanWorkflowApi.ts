import { httpsCallable } from 'firebase/functions';
import {
  getBlob,
  getMetadata,
  ref,
} from 'firebase/storage';
import { functions, storage } from '../../../config/firebase';
import {
  CONSTRUCTION_PLAN_MAX_PHYSICAL_PAGE_COUNT,
  CONSTRUCTION_PLAN_MIN_PHYSICAL_PAGE_COUNT,
} from '../domain/physicalPagePlan';
import {
  ConstructionPlanLineageSchema,
  ConstructionPlanMutationResultSchema,
  ConstructionPlanReviewDiffSummarySchema,
  parseConstructionPlanWithLegacyDefaults,
  type ConstructionPlan,
  type ConstructionPlanLineage,
  type ConstructionPlanListOptions,
  type ConstructionPlanMutationResult,
  type ConstructionPlanRevisionType,
  type ConstructionPlanReviewDiffSummary,
  type ConstructionPlanWorkflowEvent,
  type ConstructionPlanTradeType,
  type OrganizationSnapshot,
  type PlanParticipants,
  type PlanStatus,
  type ProjectSnapshot,
} from '../types';

export const REVIEW_CONSTRUCTION_PLAN_CALLABLE = 'reviewConstructionPlanServer';
export const PREPARE_CONSTRUCTION_PLAN_ISSUED_PDF_CALLABLE =
  'prepareConstructionPlanIssuedPdfServer';
export const ISSUE_CONSTRUCTION_PLAN_CALLABLE = 'issueConstructionPlanServer';
export const CREATE_CONSTRUCTION_PLAN_DRAFT_CALLABLE = 'createConstructionPlanDraftServer';
export const CREATE_CONSTRUCTION_PLAN_REVISION_CALLABLE = 'createConstructionPlanRevisionServer';
export const CLONE_CONSTRUCTION_PLAN_CALLABLE = 'cloneConstructionPlanServer';
export const MIGRATE_CONSTRUCTION_PLAN_TEMPLATE_BINDING_CALLABLE =
  'migrateConstructionPlanTemplateBindingServer';
export const LIST_CONSTRUCTION_PLANS_CALLABLE = 'listConstructionPlansServer';
export const GET_CONSTRUCTION_PLAN_LINEAGE_CALLABLE = 'getConstructionPlanLineageServer';

export type CreateConstructionPlanDraftServerRequest = {
  siteId: string;
  siteName?: string;
  title: string;
  documentNo: string;
  documentDate?: string;
  tradeType: ConstructionPlanTradeType;
  templateId: string;
  templateVersion: string;
  projectSnapshot?: Partial<ProjectSnapshot>;
  organizationSnapshot?: OrganizationSnapshot;
  participants?: Partial<PlanParticipants>;
  selectedSectionKeys?: string[];
  idempotencyKey: string;
};

export type CreateConstructionPlanRevisionServerRequest = {
  sourcePlanId: string;
  idempotencyKey: string;
  revisionReason: string;
  revisionType: ConstructionPlanRevisionType;
  copyDrawings?: boolean;
  targetTemplate?: {
    tradeType: ConstructionPlanTradeType;
    templateId: string;
    templateVersion: string;
    migrationReason: string;
  };
};

export type CloneConstructionPlanServerRequest = {
  sourcePlanId: string;
  idempotencyKey: string;
  title?: string;
  documentNo: string;
  copyDrawings?: boolean;
};

export type MigrateConstructionPlanTemplateBindingServerRequest = {
  planId: string;
  idempotencyKey: string;
  reason: string;
  expectedLockVersion?: number;
};

export type ListConstructionPlansServerRequest = NonNullable<ConstructionPlanListOptions>;

export type GetConstructionPlanLineageServerRequest = {
  planId: string;
};

export type ConstructionPlanReviewAction =
  | 'submit_review'
  | 'request_changes'
  | 'complete_review'
  | 'approve';

export type ReviewConstructionPlanRequest = {
  planId: string;
  action: ConstructionPlanReviewAction;
  reason?: string;
  expectedLockVersion?: number;
  idempotencyKey?: string;
};

export type ReviewConstructionPlanResponse = {
  planId: string;
  status: PlanStatus;
  lockVersion: number;
  activeReviewSnapshotId?: string;
  activeReviewSnapshotHash?: string;
  activeReviewSnapshotStoragePath?: string;
  activeReviewSnapshotLockVersion?: number;
  activeReviewPackageId?: string;
  reviewCycleId?: string;
  reviewRound?: number;
  diffSummary?: ConstructionPlanReviewDiffSummary;
  idempotent?: boolean;
  approvedSnapshotId?: string;
  approvedSnapshotHash?: string;
  approvedSnapshotStoragePath?: string;
  approvedEvidenceId?: string;
  approvedEvidenceHash?: string;
};

export type ConstructionPlanPdfProvenance = {
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
};

export type ConstructionPlanServerPdfArtifact = {
  storagePath: string;
  storageGeneration: string;
  sha256: string;
  sizeBytes: number;
  pageCount: number;
  fileName: string;
};

export type PrepareConstructionPlanIssuedPdfRequest = {
  planId: string;
  approvedSnapshotHash: string;
};

export type PrepareConstructionPlanIssuedPdfResponse = {
  planId: string;
  jobId: string;
  status: 'ready_for_visual_check';
  approvedSnapshotHash: string;
  candidate: ConstructionPlanServerPdfArtifact;
  provenance: ConstructionPlanPdfProvenance;
};

export type IssueConstructionPlanRequest = {
  planId: string;
  jobId: string;
  expectedCandidateSha256: string;
  approvedSnapshotHash: string;
  visualCheckConfirmed: true;
};

export type IssueConstructionPlanResponse = {
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
  provenance: ConstructionPlanPdfProvenance;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const asNonEmptyString = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`construction-plan-workflow-invalid-response:${field}`);
  }
  return value;
};

const asFiniteNumber = (value: unknown, field: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`construction-plan-workflow-invalid-response:${field}`);
  }
  return value;
};

const asPositiveInteger = (value: unknown, field: string): number => {
  const parsed = asFiniteNumber(value, field);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`construction-plan-workflow-invalid-response:${field}`);
  }
  return parsed;
};

const asSha256 = (value: unknown, field: string): string => {
  const parsed = asNonEmptyString(value, field).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(parsed)) {
    throw new Error(`construction-plan-workflow-invalid-response:${field}`);
  }
  return parsed;
};

const asStorageGeneration = (value: unknown, field: string): string => {
  const parsed = asNonEmptyString(value, field);
  if (!/^[1-9][0-9]*$/.test(parsed)) {
    throw new Error(`construction-plan-workflow-invalid-response:${field}`);
  }
  return parsed;
};

const asConstructionPlanPdfStoragePath = (value: unknown, field: string): string => {
  const parsed = asNonEmptyString(value, field);
  if (!parsed.startsWith('construction-plans/')
    || !parsed.toLowerCase().endsWith('.pdf')
    || parsed.includes('..')
    || parsed.includes('\\')
    || parsed.includes('//')) {
    throw new Error(`construction-plan-workflow-invalid-response:${field}`);
  }
  return parsed;
};

const SERVER_EXPORT_PATH_PATTERN = /^construction-plans\/[^/]+\/[^/]+\/server-exports\/(candidate|issued)\/rev-[0-9]{2,10}\/[^/]+\/([a-f0-9]{64})\/([a-f0-9]{64})\.pdf$/;

const assertServerExportArtifactBinding = (
  artifact: Pick<ConstructionPlanServerPdfArtifact, 'storagePath' | 'sha256'>,
  profile: 'candidate' | 'issued' | undefined,
  approvedSnapshotHash?: string,
): void => {
  const match = SERVER_EXPORT_PATH_PATTERN.exec(artifact.storagePath);
  if (!match
    || (profile !== undefined && match[1] !== profile)
    || (approvedSnapshotHash !== undefined && match[2] !== approvedSnapshotHash.toLowerCase())
    || match[3] !== artifact.sha256) {
    throw new Error('construction-plan-workflow-invalid-response:server-export-path-binding');
  }
};

const parsePdfProvenance = (value: unknown): ConstructionPlanPdfProvenance => {
  if (!isRecord(value)) {
    throw new Error('construction-plan-workflow-invalid-response:provenance');
  }
  return {
    rendererVersion: asNonEmptyString(value.rendererVersion, 'provenance.rendererVersion'),
    rendererTemplateBundleHash: asSha256(
      value.rendererTemplateBundleHash,
      'provenance.rendererTemplateBundleHash',
    ),
    rendererBuildHash: asSha256(value.rendererBuildHash, 'provenance.rendererBuildHash'),
    renderInputHash: asSha256(value.renderInputHash, 'provenance.renderInputHash'),
    contentManifestHash: asSha256(value.contentManifestHash, 'provenance.contentManifestHash'),
    zeroOmissionCoverageHash: asSha256(
      value.zeroOmissionCoverageHash,
      'provenance.zeroOmissionCoverageHash',
    ),
    drawingBindingHash: asSha256(value.drawingBindingHash, 'provenance.drawingBindingHash'),
    drawingRenderMode: asNonEmptyString(value.drawingRenderMode, 'provenance.drawingRenderMode'),
    templateHash: asSha256(value.templateHash, 'provenance.templateHash'),
    manifestHash: asSha256(value.manifestHash, 'provenance.manifestHash'),
    templateBundleHash: asSha256(value.templateBundleHash, 'provenance.templateBundleHash'),
    templateBindingHash: asSha256(value.templateBindingHash, 'provenance.templateBindingHash'),
  };
};

const parseServerPdfArtifact = (
  value: unknown,
  field = 'candidate',
  profile?: 'candidate' | 'issued',
): ConstructionPlanServerPdfArtifact => {
  if (!isRecord(value)) {
    throw new Error(`construction-plan-workflow-invalid-response:${field}`);
  }
  const pageCount = asPositiveInteger(value.pageCount, `${field}.pageCount`);
  if (pageCount < CONSTRUCTION_PLAN_MIN_PHYSICAL_PAGE_COUNT
    || pageCount > CONSTRUCTION_PLAN_MAX_PHYSICAL_PAGE_COUNT) {
    throw new Error(`construction-plan-workflow-invalid-response:${field}.pageCount`);
  }
  const fileName = asNonEmptyString(value.fileName, `${field}.fileName`);
  if (!fileName.toLowerCase().endsWith('.pdf')) {
    throw new Error(`construction-plan-workflow-invalid-response:${field}.fileName`);
  }
  const artifact: ConstructionPlanServerPdfArtifact = {
    storagePath: asConstructionPlanPdfStoragePath(value.storagePath, `${field}.storagePath`),
    storageGeneration: asStorageGeneration(
      value.storageGeneration,
      `${field}.storageGeneration`,
    ),
    sha256: asSha256(value.sha256, `${field}.sha256`),
    sizeBytes: asPositiveInteger(value.sizeBytes, `${field}.sizeBytes`),
    pageCount,
    fileName,
  };
  assertServerExportArtifactBinding(artifact, profile);
  return artifact;
};

const callConstructionPlanMutation = async <TRequest>(
  callableName: string,
  request: TRequest,
): Promise<ConstructionPlanMutationResult> => {
  const callable = httpsCallable<TRequest, unknown>(functions, callableName);
  const result = await callable(request);
  const parsed = ConstructionPlanMutationResultSchema.safeParse(result.data);
  if (!parsed.success) {
    throw new Error(`construction-plan-lifecycle-invalid-response:${callableName}`);
  }
  return parsed.data;
};

export const createConstructionPlanDraftServer = (
  request: CreateConstructionPlanDraftServerRequest,
): Promise<ConstructionPlanMutationResult> => callConstructionPlanMutation(
  CREATE_CONSTRUCTION_PLAN_DRAFT_CALLABLE,
  request,
);

export const createConstructionPlanRevisionServer = (
  request: CreateConstructionPlanRevisionServerRequest,
): Promise<ConstructionPlanMutationResult> => callConstructionPlanMutation(
  CREATE_CONSTRUCTION_PLAN_REVISION_CALLABLE,
  request,
);

export const cloneConstructionPlanServer = (
  request: CloneConstructionPlanServerRequest,
): Promise<ConstructionPlanMutationResult> => callConstructionPlanMutation(
  CLONE_CONSTRUCTION_PLAN_CALLABLE,
  request,
);

export const migrateConstructionPlanTemplateBindingServer = (
  request: MigrateConstructionPlanTemplateBindingServerRequest,
): Promise<ConstructionPlanMutationResult> => callConstructionPlanMutation(
  MIGRATE_CONSTRUCTION_PLAN_TEMPLATE_BINDING_CALLABLE,
  request,
);

export const listConstructionPlansServer = async (
  request: ListConstructionPlansServerRequest = {},
): Promise<ConstructionPlan[]> => {
  const callable = httpsCallable<ListConstructionPlansServerRequest, unknown>(
    functions,
    LIST_CONSTRUCTION_PLANS_CALLABLE,
  );
  const result = await callable(request);
  if (!isRecord(result.data) || !Array.isArray(result.data.plans)) {
    throw new Error('construction-plan-list-invalid-response');
  }
  try {
    return result.data.plans.map(parseConstructionPlanWithLegacyDefaults);
  } catch (_error) {
    throw new Error('construction-plan-list-invalid-response');
  }
};

export const getConstructionPlanLineageServer = async (
  request: GetConstructionPlanLineageServerRequest,
): Promise<ConstructionPlanLineage> => {
  const callable = httpsCallable<GetConstructionPlanLineageServerRequest, unknown>(
    functions,
    GET_CONSTRUCTION_PLAN_LINEAGE_CALLABLE,
  );
  const result = await callable(request);
  const parsed = ConstructionPlanLineageSchema.safeParse(result.data);
  if (!parsed.success) throw new Error('construction-plan-lineage-invalid-response');
  return parsed.data;
};

// Keep the workflow-facing public import stable without creating a static
// constructionPlanService <-> workflowApi initialization cycle.
export const listConstructionPlanWorkflowEvents = async (
  planId: string,
): Promise<ConstructionPlanWorkflowEvent[]> => {
  const service = await import('./constructionPlanService');
  return service.listConstructionPlanWorkflowEvents(planId);
};

export const getConstructionPlanLineage = async (
  planId: string,
): Promise<ConstructionPlanLineage> => {
  const service = await import('./constructionPlanService');
  return service.getConstructionPlanLineage(planId);
};

const parseReviewResponse = (value: unknown): ReviewConstructionPlanResponse => {
  if (!isRecord(value)) throw new Error('construction-plan-workflow-invalid-response:review');
  const diffSummary = value.diffSummary === undefined
    ? undefined
    : ConstructionPlanReviewDiffSummarySchema.parse(value.diffSummary);
  return {
    planId: asNonEmptyString(value.planId, 'planId'),
    status: asNonEmptyString(value.status, 'status') as PlanStatus,
    lockVersion: asFiniteNumber(value.lockVersion, 'lockVersion'),
    ...(typeof value.activeReviewSnapshotId === 'string'
      ? { activeReviewSnapshotId: value.activeReviewSnapshotId }
      : {}),
    ...(typeof value.activeReviewSnapshotHash === 'string'
      ? { activeReviewSnapshotHash: value.activeReviewSnapshotHash }
      : {}),
    ...(typeof value.activeReviewSnapshotStoragePath === 'string'
      ? { activeReviewSnapshotStoragePath: value.activeReviewSnapshotStoragePath }
      : {}),
    ...(typeof value.activeReviewSnapshotLockVersion === 'number'
      ? { activeReviewSnapshotLockVersion: asFiniteNumber(
        value.activeReviewSnapshotLockVersion,
        'activeReviewSnapshotLockVersion',
      ) }
      : {}),
    ...(typeof value.activeReviewPackageId === 'string'
      ? { activeReviewPackageId: value.activeReviewPackageId }
      : {}),
    ...(typeof value.reviewCycleId === 'string'
      ? { reviewCycleId: value.reviewCycleId }
      : {}),
    ...(typeof value.reviewRound === 'number'
      ? { reviewRound: asFiniteNumber(value.reviewRound, 'reviewRound') }
      : {}),
    ...(diffSummary ? { diffSummary } : {}),
    ...(typeof value.idempotent === 'boolean' ? { idempotent: value.idempotent } : {}),
    ...(typeof value.approvedSnapshotId === 'string'
      ? { approvedSnapshotId: value.approvedSnapshotId }
      : {}),
    ...(typeof value.approvedSnapshotHash === 'string'
      ? { approvedSnapshotHash: value.approvedSnapshotHash }
      : {}),
    ...(typeof value.approvedSnapshotStoragePath === 'string'
      ? { approvedSnapshotStoragePath: value.approvedSnapshotStoragePath }
      : {}),
    ...(typeof value.approvedEvidenceId === 'string'
      ? { approvedEvidenceId: value.approvedEvidenceId }
      : {}),
    ...(typeof value.approvedEvidenceHash === 'string'
      ? { approvedEvidenceHash: value.approvedEvidenceHash }
      : {}),
  };
};

const parsePrepareIssuedPdfResponse = (
  value: unknown,
): PrepareConstructionPlanIssuedPdfResponse => {
  if (!isRecord(value)) {
    throw new Error('construction-plan-workflow-invalid-response:prepare-issued-pdf');
  }
  const status = asNonEmptyString(value.status, 'status');
  if (status !== 'ready_for_visual_check') {
    throw new Error('construction-plan-workflow-invalid-response:prepare-issued-pdf-status');
  }
  const approvedSnapshotHash = asSha256(value.approvedSnapshotHash, 'approvedSnapshotHash');
  const candidate = parseServerPdfArtifact(value.candidate, 'candidate', 'candidate');
  assertServerExportArtifactBinding(candidate, 'candidate', approvedSnapshotHash);
  return {
    planId: asNonEmptyString(value.planId, 'planId'),
    jobId: asNonEmptyString(value.jobId, 'jobId'),
    status,
    approvedSnapshotHash,
    candidate,
    provenance: parsePdfProvenance(value.provenance),
  };
};

const parseIssueResponse = (value: unknown): IssueConstructionPlanResponse => {
  if (!isRecord(value)) throw new Error('construction-plan-workflow-invalid-response:issue');
  const status = asNonEmptyString(value.status, 'status');
  const pageCount = asPositiveInteger(value.pageCount, 'pageCount');
  if (status !== 'issued'
    || pageCount < CONSTRUCTION_PLAN_MIN_PHYSICAL_PAGE_COUNT
    || pageCount > CONSTRUCTION_PLAN_MAX_PHYSICAL_PAGE_COUNT) {
    throw new Error('construction-plan-workflow-invalid-response:issue-invariants');
  }
  const fileName = value.fileName === undefined
    ? undefined
    : asNonEmptyString(value.fileName, 'fileName');
  if (fileName !== undefined && !fileName.toLowerCase().endsWith('.pdf')) {
    throw new Error('construction-plan-workflow-invalid-response:fileName');
  }
  const storagePath = asConstructionPlanPdfStoragePath(value.storagePath, 'storagePath');
  const sha256 = asSha256(value.sha256, 'sha256');
  assertServerExportArtifactBinding({ storagePath, sha256 }, 'issued');
  return {
    planId: asNonEmptyString(value.planId, 'planId'),
    jobId: asNonEmptyString(value.jobId, 'jobId'),
    status,
    issuedExportId: asNonEmptyString(value.issuedExportId, 'issuedExportId'),
    storagePath,
    storageGeneration: asStorageGeneration(value.storageGeneration, 'storageGeneration'),
    sha256,
    pageCount,
    sizeBytes: asPositiveInteger(value.sizeBytes, 'sizeBytes'),
    ...(fileName ? { fileName } : {}),
    provenance: parsePdfProvenance(value.provenance),
  };
};

export const reviewConstructionPlanServer = async (
  request: ReviewConstructionPlanRequest,
): Promise<ReviewConstructionPlanResponse> => {
  const callable = httpsCallable<ReviewConstructionPlanRequest, unknown>(
    functions,
    REVIEW_CONSTRUCTION_PLAN_CALLABLE,
  );
  const result = await callable(request);
  return parseReviewResponse(result.data);
};

export const prepareConstructionPlanIssuedPdfServer = async (
  request: PrepareConstructionPlanIssuedPdfRequest,
): Promise<PrepareConstructionPlanIssuedPdfResponse> => {
  const normalizedRequest: PrepareConstructionPlanIssuedPdfRequest = {
    planId: asNonEmptyString(request.planId, 'request.planId'),
    approvedSnapshotHash: asSha256(
      request.approvedSnapshotHash,
      'request.approvedSnapshotHash',
    ),
  };
  const callable = httpsCallable<PrepareConstructionPlanIssuedPdfRequest, unknown>(
    functions,
    PREPARE_CONSTRUCTION_PLAN_ISSUED_PDF_CALLABLE,
  );
  const result = await callable(normalizedRequest);
  const response = parsePrepareIssuedPdfResponse(result.data);
  if (response.planId !== normalizedRequest.planId) {
    throw new Error('construction-plan-prepared-plan-id-mismatch');
  }
  if (response.approvedSnapshotHash !== normalizedRequest.approvedSnapshotHash) {
    throw new Error('construction-plan-prepared-snapshot-hash-mismatch');
  }
  return response;
};

export const issueConstructionPlanServer = async (
  request: IssueConstructionPlanRequest,
): Promise<IssueConstructionPlanResponse> => {
  if (request.visualCheckConfirmed !== true) {
    throw new Error('construction-plan-visual-check-required');
  }
  const normalizedRequest: IssueConstructionPlanRequest = {
    planId: asNonEmptyString(request.planId, 'request.planId'),
    jobId: asNonEmptyString(request.jobId, 'request.jobId'),
    expectedCandidateSha256: asSha256(
      request.expectedCandidateSha256,
      'request.expectedCandidateSha256',
    ),
    approvedSnapshotHash: asSha256(
      request.approvedSnapshotHash,
      'request.approvedSnapshotHash',
    ),
    visualCheckConfirmed: true,
  };
  const callable = httpsCallable<IssueConstructionPlanRequest, unknown>(
    functions,
    ISSUE_CONSTRUCTION_PLAN_CALLABLE,
  );
  const result = await callable(normalizedRequest);
  const response = parseIssueResponse(result.data);
  if (response.planId !== normalizedRequest.planId) {
    throw new Error('construction-plan-issued-plan-id-mismatch');
  }
  if (response.jobId !== normalizedRequest.jobId) {
    throw new Error('construction-plan-issued-job-id-mismatch');
  }
  assertServerExportArtifactBinding(
    { storagePath: response.storagePath, sha256: response.sha256 },
    'issued',
    normalizedRequest.approvedSnapshotHash,
  );
  return response;
};

const sha256Blob = async (blob: Blob): Promise<string> => {
  if (!globalThis.crypto?.subtle) {
    throw new Error('construction-plan-pdf-sha256-unavailable');
  }
  const digest = await globalThis.crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

const assertServerPdfMetadata = (
  metadata: Awaited<ReturnType<typeof getMetadata>>,
  artifact: ConstructionPlanServerPdfArtifact,
): void => {
  const custom = metadata.customMetadata ?? {};
  if (metadata.contentType !== 'application/pdf'
    || metadata.generation !== artifact.storageGeneration
    || metadata.size !== artifact.sizeBytes
    || custom.sha256?.toLowerCase() !== artifact.sha256) {
    throw new Error('construction-plan-server-pdf-metadata-mismatch');
  }
};

/**
 * Downloads exactly the immutable server artifact named by PREPARE/FINALIZE.
 * Metadata is checked on both sides of the byte download and the bytes are
 * independently hashed in the browser before they may be shown or saved.
 */
export const readVerifiedConstructionPlanServerPdf = async (
  artifactInput: ConstructionPlanServerPdfArtifact,
): Promise<Blob> => {
  const artifact = parseServerPdfArtifact(artifactInput, 'artifact');
  const objectRef = ref(storage, artifact.storagePath);
  const before = await getMetadata(objectRef);
  assertServerPdfMetadata(before, artifact);
  const blob = await getBlob(objectRef);
  if (blob.size !== artifact.sizeBytes || await sha256Blob(blob) !== artifact.sha256) {
    throw new Error('construction-plan-server-pdf-byte-mismatch');
  }
  const after = await getMetadata(objectRef);
  assertServerPdfMetadata(after, artifact);
  if (after.generation !== before.generation) {
    throw new Error('construction-plan-server-pdf-generation-changed');
  }
  return blob;
};

export const isConstructionPlanIssuedPdfProvenanceCompatible = (
  candidate: ConstructionPlanPdfProvenance,
  issued: ConstructionPlanPdfProvenance,
): boolean => (
  candidate.rendererVersion === issued.rendererVersion
  && candidate.rendererTemplateBundleHash === issued.rendererTemplateBundleHash
  && candidate.rendererBuildHash === issued.rendererBuildHash
  && candidate.renderInputHash !== issued.renderInputHash
  && candidate.contentManifestHash === issued.contentManifestHash
  && candidate.zeroOmissionCoverageHash === issued.zeroOmissionCoverageHash
  && candidate.drawingBindingHash === issued.drawingBindingHash
  && candidate.drawingRenderMode === issued.drawingRenderMode
  && candidate.templateHash === issued.templateHash
  && candidate.manifestHash === issued.manifestHash
  && candidate.templateBundleHash === issued.templateBundleHash
  && candidate.templateBindingHash === issued.templateBindingHash
);

export const getConstructionPlanWorkflowErrorMessage = (error: unknown): string => {
  const code = isRecord(error) && typeof error.code === 'string' ? error.code : '';
  if (code.includes('permission-denied')) return '이 단계는 본사 또는 관리자 권한이 필요합니다.';
  if (code.includes('unauthenticated')) return '로그인 세션을 확인한 뒤 다시 시도해주세요.';
  if (code.includes('failed-precondition')) return '문서 상태 또는 승인 스냅샷이 변경되었습니다. 새로고침 후 다시 시도해주세요.';
  if (code.includes('aborted')) return '승인 스냅샷 또는 발행 작업이 변경되었습니다. 최신 승인본으로 후보를 다시 준비해주세요.';
  if (code.includes('already-exists')) return '이미 발행된 문서입니다. 최신 발행본을 내려받아주세요.';
  if (code.includes('data-loss')) return '서버 PDF 무결성 검증에 실패했습니다. 후보를 다시 준비해주세요.';
  if (code.includes('deadline-exceeded') || code.includes('resource-exhausted')) {
    return '서버 A4 PDF 생성이 지연되고 있습니다. 잠시 후 다시 시도해주세요.';
  }
  if (code.includes('unavailable')) return '승인 서버에 연결할 수 없습니다. 네트워크를 확인해주세요.';
  if (error instanceof Error && error.message.startsWith('construction-plan-')) {
    return '서버 응답을 검증하지 못했습니다. 새로고침 후 다시 시도해주세요.';
  }
  return '요청을 완료하지 못했습니다. 잠시 후 다시 시도해주세요.';
};
