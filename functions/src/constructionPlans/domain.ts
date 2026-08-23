import { createHash } from 'crypto';
import {
    isConstructionPlanStructuredSectionKey,
    validateConstructionPlanStructuredSectionContent,
} from './structuredSectionContract';
import {
    constructionPlanResidualRiskIsAcceptable,
    constructionPlanRiskLevelFromScore,
    constructionPlanRiskScore,
    SYSTEM_SHORING_SERVER_TEMPLATE,
    getLatestConstructionPlanServerTemplate,
    resolveConstructionPlanServerTemplate,
    type ConstructionPlanServerTemplateContract,
    type ConstructionPlanTradeType,
} from './templateContracts';
import { validateConstructionPlanServerStandardText } from './standardTextContract';
import {
    buildInitialConstructionPlanErpFieldProvenance,
    sanitizeConstructionPlanErpFieldProvenance,
} from './erpFieldProvenance';
import { constructionPlanDrawingAnnotationLayerContractIssues } from './drawingAnnotationContract';

export type UnknownRecord = Record<string, unknown>;

export interface TemplatePageContract {
    pageNumber: number;
    sectionKey: string;
    required: boolean;
}

export interface ConstructionPlanValidationIssue {
    code: string;
    path: string;
    message: string;
}

export interface ConstructionPlanValidationResult {
    valid: boolean;
    issues: ConstructionPlanValidationIssue[];
}

export interface ConstructionPlanReviewDiffSummary {
    summaryVersion: 2;
    baselineKind: 'previous_submission' | 'prior_issued' | 'empty';
    baselineContentHash: string;
    currentContentHash: string;
    summaryHash: string;
    changedTopLevelFields: string[];
    changedSectionIds: string[];
    changedDrawingIds: string[];
    addedDrawingIds: string[];
    removedDrawingIds: string[];
    textChanges: ConstructionPlanReviewTextChange[];
    fieldChanges: ConstructionPlanReviewFieldChange[];
    drawingChanges: ConstructionPlanReviewDrawingChange[];
    annotationChanges: ConstructionPlanReviewAnnotationChange[];
    changeCount: number;
}

export type ConstructionPlanReviewDiffChangeType = 'added' | 'deleted' | 'changed';

export interface ConstructionPlanReviewTextDiffSegment {
    kind: 'equal' | 'added' | 'removed';
    text: string;
}

export interface ConstructionPlanReviewTextChange {
    id: string;
    changeType: ConstructionPlanReviewDiffChangeType;
    path: string;
    label: string;
    sectionId?: string;
    sectionLabel?: string;
    pageNumbers: number[];
    before?: string;
    after?: string;
    beforeHash?: string;
    afterHash?: string;
    segments: ConstructionPlanReviewTextDiffSegment[];
    valueTruncated: boolean;
}

export interface ConstructionPlanReviewFieldChange {
    id: string;
    entityKind: 'section' | 'field';
    changeType: ConstructionPlanReviewDiffChangeType;
    path: string;
    label: string;
    sectionId?: string;
    sectionLabel?: string;
    pageNumbers: number[];
    before?: string;
    after?: string;
    beforeHash?: string;
    afterHash?: string;
    valueTruncated: boolean;
}

export interface ConstructionPlanReviewDrawingChange {
    id: string;
    changeType: ConstructionPlanReviewDiffChangeType;
    drawingId: string;
    drawingLabel: string;
    pageNumbers: number[];
    changedFields: string[];
    beforeSummary?: string;
    afterSummary?: string;
    beforeHash?: string;
    afterHash?: string;
}

export interface ConstructionPlanReviewAnnotationChange {
    id: string;
    changeType: ConstructionPlanReviewDiffChangeType;
    drawingId: string;
    drawingLabel: string;
    annotationId: string;
    annotationLabel: string;
    pageIndex: number;
    pageId: string;
    pageLabel: string;
    changedParts: Array<
        'binding' | 'layer' | 'geometry' | 'style' | 'label' | 'zone' | 'schedule'
        | 'equipment' | 'route' | 'responsibility' | 'material' | 'release' | 'metadata'
    >;
    geometryBefore?: string;
    geometryAfter?: string;
    styleBefore?: string;
    styleAfter?: string;
    metadataBefore?: string;
    metadataAfter?: string;
    beforeHash?: string;
    afterHash?: string;
}

export type ConstructionPlanReviewCommentStatus = 'open' | 'addressed' | 'resolved';
export type ConstructionPlanReviewAction = 'submit_review' | 'request_changes' | 'complete_review' | 'approve';

export interface ConstructionPlanReviewCommentSummary {
    totalOpen: number;
    totalAddressed: number;
    totalResolved: number;
    requiredOpen: number;
    requiredAddressed: number;
    requiredResolved: number;
    unresolvedRequired: number;
}

export interface SafeWorkerDirectoryEntry {
    id: string;
    name: string;
    status: 'active' | 'inactive' | 'on_leave' | 'unknown';
    role?: string;
    position?: string;
    teamId?: string;
    teamName?: string;
    siteId?: string;
}

export interface ConstructionPlanWorkerDirectoryBinding {
    workers: SafeWorkerDirectoryEntry[];
    sourceWorkerIds: string[];
    sourceMasterHash: string;
}

export interface ConstructionPlanRoleAccess {
    isAdmin: boolean;
    isOffice: boolean;
    isSite: boolean;
    canUseDirectory: boolean;
    canSubmitReview: boolean;
    canReviewApproveIssue: boolean;
}

export interface PdfEnvelopeValidationResult extends ConstructionPlanValidationResult {
    sha256: string;
    pageCount: number;
    sizeBytes: number;
}

export interface PdfAuditExpectation {
    planId: string;
    documentNo: string;
    revision: number;
    templateVersion: string;
    snapshotHash: string;
    physicalPageCount?: number;
}

export type ConstructionPlanRevisionType =
    | 'design_change'
    | 'site_condition'
    | 'method_change'
    | 'schedule_change'
    | 'safety_improvement'
    | 'other';

export interface ConstructionPlanSeriesIdentity {
    seriesId: string;
    documentNo: string;
    documentNoKey: string;
}

export interface ConstructionPlanMutationClaimResponse {
    planId: string;
    seriesId: string;
    revisionNo: number;
    documentNo: string;
    idempotent: true;
}

export interface BuildConstructionPlanDraftInput {
    id: string;
    seriesId: string;
    siteId: string;
    siteName?: string;
    title: string;
    tradeType?: ConstructionPlanTradeType;
    templateId?: string;
    templateVersion?: string;
    documentNo: string;
    documentDate?: string;
    projectSnapshot?: unknown;
    erpSnapshot?: unknown;
    organizationSnapshot?: unknown;
    participants?: unknown;
    selectedSectionKeys?: readonly string[];
    actorId: string;
    actorName?: string;
    timestamp: string;
}

export interface BuildCanonicalConstructionPlanDraftContextInput {
    siteId: string;
    site: unknown;
    clientCompany?: unknown;
    contractorCompany?: unknown;
    partnerCompany?: unknown;
    responsibleTeam?: unknown;
    requestedProjectSnapshot?: unknown;
    safeWorkers: readonly SafeWorkerDirectoryEntry[];
    preferredSiteManagerWorkerIds?: readonly string[];
    actorId: string;
    capturedAt: string;
}

export interface CanonicalConstructionPlanDraftContext {
    siteName?: string;
    projectSnapshot: UnknownRecord;
    erpSnapshot: UnknownRecord;
    organizationSnapshot: UnknownRecord;
    participants: UnknownRecord;
}

export interface BuildConstructionPlanRevisionInput {
    id: string;
    seriesId: string;
    revision: number;
    revisionReason: string;
    revisionType: ConstructionPlanRevisionType;
    sourceSnapshotHash: string;
    copyDrawings: boolean;
    drawingReuseProjection?: {
        drawings: unknown[];
        sections: unknown[];
        drawingApplicability: unknown[];
    };
    actorId: string;
    actorName?: string;
    timestamp: string;
    targetTemplate?: {
        tradeType: ConstructionPlanTradeType;
        templateId: string;
        templateVersion: string;
    };
}

export interface BuildConstructionPlanCloneInput {
    id: string;
    seriesId: string;
    title?: string;
    documentNo: string;
    copyDrawings: boolean;
    drawingReuseProjection?: {
        drawings: unknown[];
        sections: unknown[];
        drawingApplicability: unknown[];
    };
    actorId: string;
    actorName?: string;
    timestamp: string;
}

/** Backward-compatible aliases for existing system-shoring integrations. */
export const CONSTRUCTION_PLAN_TEMPLATE_ID = SYSTEM_SHORING_SERVER_TEMPLATE.templateId;
export const CONSTRUCTION_PLAN_TEMPLATE_VERSION = SYSTEM_SHORING_SERVER_TEMPLATE.templateVersion;
export const CONSTRUCTION_PLAN_RENDERER_VERSION = SYSTEM_SHORING_SERVER_TEMPLATE.rendererVersion;
export const CONSTRUCTION_PLAN_PAGE_COUNT = SYSTEM_SHORING_SERVER_TEMPLATE.pageCount;
export const CONSTRUCTION_PLAN_MIN_PHYSICAL_PAGE_COUNT = CONSTRUCTION_PLAN_PAGE_COUNT;
export const CONSTRUCTION_PLAN_MAX_PHYSICAL_PAGE_COUNT = 200;
export const CONSTRUCTION_PLAN_MAX_SAFE_WORKERS = 500;
export const CONSTRUCTION_PLAN_SCHEMA_VERSION = SYSTEM_SHORING_SERVER_TEMPLATE.schemaVersion;
export const CONSTRUCTION_PLAN_SNAPSHOT_SCHEMA_VERSION = 2;

export const resolveConstructionPlanRecordTemplate = (
    record: UnknownRecord,
    allowLegacySystemShoringDefaults = false,
): ConstructionPlanServerTemplateContract => resolveConstructionPlanServerTemplate({
    tradeType: record.tradeType
        ?? (allowLegacySystemShoringDefaults ? SYSTEM_SHORING_SERVER_TEMPLATE.tradeType : undefined),
    templateId: record.templateId
        ?? (allowLegacySystemShoringDefaults ? SYSTEM_SHORING_SERVER_TEMPLATE.templateId : undefined),
    templateVersion: record.templateVersion
        ?? (allowLegacySystemShoringDefaults ? SYSTEM_SHORING_SERVER_TEMPLATE.templateVersion : undefined),
});

const REVISION_TYPE_VALUES: ReadonlySet<string> = new Set([
    'design_change', 'site_condition', 'method_change', 'schedule_change',
    'safety_improvement', 'other',
]);

/**
 * Server-owned release contract. Keep this list explicit: publishing must not
 * trust a client-provided manifest or the order in the plan document.
 */
export const CONSTRUCTION_PLAN_TEMPLATE_PAGES: readonly TemplatePageContract[] =
    SYSTEM_SHORING_SERVER_TEMPLATE.pages.map(({ pageNumber, sectionKey, required }) => ({
        pageNumber,
        sectionKey,
        required,
    }));

const DRAWING_SLOTS = ['D-01', 'D-02', 'D-03', 'D-04', 'D-05', 'D-06'] as const;
const SNAPSHOT_CONTENT_KEYS = [
    'siteId',
    'title',
    'tradeType',
    'documentNo',
    'documentDate',
    'revision',
    'seriesId',
    'lineageRootPlanId',
    'revisionReason',
    'revisionType',
    'sourceSnapshotHash',
    'sourceRevisionNo',
    'clonedFromPlanId',
    'supersedesPlanId',
    'templateId',
    'templateVersion',
    'rendererVersion',
    'schemaVersion',
    'templateBinding',
    'templateHash',
    'manifestHash',
    'templateBundleHash',
    'templateBindingHash',
    'templateMigration',
    'projectSnapshot',
    'erpSnapshot',
    'organizationSnapshot',
    'sections',
    'sectionOrder',
    'drawings',
    'drawingApplicability',
    'engineeringValues',
    'equipmentPlan',
    'riskAssessments',
    // Stable provenance is renderer-safe. Mutable ACL/workflow state
    // (participants, status, locks, readiness and validation decisions) stays
    // outside the content hash in snapshot/package metadata.
    'createdBy',
    'createdByName',
    'createdAt',
] as const;

const ADMIN_ROLE_ALIASES = new Set([
    'admin', 'administrator', 'super_admin', 'owner', 'dev', 'developer',
    'system_admin', 'jhl2vtnk9v3c4eiz4qqi', 'pos_jhl2vtnk9v3c4eiz4qqi',
    '관리자', '사장', '실장', '개발', '개발자', '시스템관리자',
]);
const OFFICE_ROLE_ALIASES = new Set([
    'office', 'office_staff', '사무', '사무직원', '사무실직원',
]);
const SITE_ROLE_ALIASES = new Set([
    'site', 'site_manager', 'manager', 'manager1', 'manager2', 'manager3',
    'pos_manager1', 'pos_manager2', 'pos_manager3', '매니저', '매니저1',
    '매니저2', '매니저3', '메니저1', '메니저2', '메니저3', '현장관리자',
    '현장소장',
]);

export const isUnknownRecord = (value: unknown): value is UnknownRecord =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

export const readTrimmedString = (record: UnknownRecord, keys: readonly string[]): string | undefined => {
    for (const key of keys) {
        const value = record[key];
        if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return undefined;
};

const SEOUL_CALENDAR_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
});

export const formatSeoulCalendarDate = (value: Date | string | number): string => {
    const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new Error('construction-plan-document-date-source-invalid');
    }
    const parts = SEOUL_CALENDAR_DATE_FORMATTER.formatToParts(date);
    const part = (type: 'year' | 'month' | 'day'): string | undefined =>
        parts.find((candidate) => candidate.type === type)?.value;
    const year = part('year');
    const month = part('month');
    const day = part('day');
    if (!year || !month || !day) {
        throw new Error('construction-plan-document-date-format-failed');
    }
    return `${year}-${month}-${day}`;
};

const normalizedStringList = (value: unknown): string[] => {
    if (Array.isArray(value)) return value.flatMap(normalizedStringList);
    return typeof value === 'string' && value.trim() ? [value.trim()] : [];
};

export const addUniquePlanParticipant = (
    rawParticipants: unknown,
    field: 'reviewerIds' | 'approverIds',
    uid: string,
): UnknownRecord => {
    const participants = isUnknownRecord(rawParticipants) ? rawParticipants : {};
    const current = normalizedStringList(participants[field]);
    return {
        ...participants,
        authorIds: Array.from(new Set(normalizedStringList(participants.authorIds))),
        reviewerIds: Array.from(new Set(normalizedStringList(participants.reviewerIds))),
        approverIds: Array.from(new Set(normalizedStringList(participants.approverIds))),
        [field]: Array.from(new Set([...current, uid.trim()].filter(Boolean))),
    };
};

export const isConstructionPlanParticipant = (rawPlan: unknown, uidValue: string): boolean => {
    if (!isUnknownRecord(rawPlan)) return false;
    const uid = uidValue.trim();
    if (!uid) return false;
    if (readTrimmedString(rawPlan, ['createdBy']) === uid) return true;
    const participants = isUnknownRecord(rawPlan.participants) ? rawPlan.participants : {};
    return ['authorIds', 'reviewerIds', 'approverIds']
        .some((field) => normalizedStringList(participants[field]).includes(uid));
};

const normalizeRole = (value: unknown): string => String(value || '').trim().toLowerCase();

const flattenRoleValues = (value: unknown): string[] => {
    if (Array.isArray(value)) return value.flatMap(flattenRoleValues);
    const normalized = normalizeRole(value);
    return normalized ? [normalized] : [];
};

export const classifyConstructionPlanRoleAccess = (values: readonly unknown[]): ConstructionPlanRoleAccess => {
    const roles = new Set(values.flatMap(flattenRoleValues));
    const hasAlias = (aliases: ReadonlySet<string>) => Array.from(roles).some((role) => aliases.has(role));
    const isAdmin = hasAlias(ADMIN_ROLE_ALIASES);
    const isOffice = isAdmin || hasAlias(OFFICE_ROLE_ALIASES);
    const isSite = isAdmin || isOffice || hasAlias(SITE_ROLE_ALIASES);
    return {
        isAdmin,
        isOffice,
        isSite,
        canUseDirectory: isAdmin || isOffice || isSite,
        canSubmitReview: isAdmin || isOffice || isSite,
        canReviewApproveIssue: isAdmin || isOffice,
    };
};

const normalizeWorkerStatus = (record: UnknownRecord): SafeWorkerDirectoryEntry['status'] => {
    if (record.isActive === false) return 'inactive';
    const status = (readTrimmedString(record, ['status']) || '').toLowerCase();
    if (['퇴사', '비활성', 'inactive', 'terminated', 'resigned'].includes(status)) return 'inactive';
    if (['휴직', '휴가', 'on_leave', 'leave'].includes(status)) return 'on_leave';
    if (record.isActive === true || ['재직', '활성', 'active', 'working'].includes(status)) return 'active';
    return 'unknown';
};

/** Whitelist projection. Raw worker documents must never leave the caller. */
export const projectSafeWorkerDirectoryEntry = (
    raw: unknown,
    fallbackId?: string,
): SafeWorkerDirectoryEntry | null => {
    if (!isUnknownRecord(raw)) return null;
    const id = readTrimmedString(raw, ['id', 'uid', 'legacyId']) || fallbackId?.trim();
    const name = readTrimmedString(raw, ['name']);
    if (!id || !name) return null;

    const result: SafeWorkerDirectoryEntry = { id, name, status: normalizeWorkerStatus(raw) };
    const optionalFields: Array<[keyof Omit<SafeWorkerDirectoryEntry, 'id' | 'name' | 'status'>, readonly string[]]> = [
        ['role', ['role']],
        ['position', ['position', 'rank']],
        ['teamId', ['teamId']],
        ['teamName', ['teamName']],
        ['siteId', ['siteId']],
    ];
    optionalFields.forEach(([key, sourceKeys]) => {
        const value = readTrimmedString(raw, sourceKeys);
        if (value) result[key] = value;
    });
    return result;
};

const compareSafeWorkerDirectoryEntries = (
    left: SafeWorkerDirectoryEntry,
    right: SafeWorkerDirectoryEntry,
): number => left.name.localeCompare(right.name, 'ko-KR') || left.id.localeCompare(right.id);

/**
 * Canonical worker-directory identity shared by initial capture, refresh and
 * release validation. Repeating the same worker in multiple roles is valid;
 * conflicting records for one ID are not. The fingerprint deliberately covers
 * every renderer-safe worker field, not only the display name.
 */
export const buildConstructionPlanWorkerDirectoryBinding = (
    rawWorkers: readonly unknown[],
    requireActive = true,
): ConstructionPlanWorkerDirectoryBinding => {
    if (rawWorkers.length > CONSTRUCTION_PLAN_MAX_SAFE_WORKERS + 50) {
        throw new Error('construction-plan-worker-directory-capacity-exceeded');
    }
    const workersById = new Map<string, SafeWorkerDirectoryEntry>();
    rawWorkers.forEach((rawWorker) => {
        const worker = projectSafeWorkerDirectoryEntry(rawWorker);
        if (!worker) throw new Error('construction-plan-worker-directory-entry-invalid');
        if (requireActive && worker.status !== 'active') {
            throw new Error(`construction-plan-worker-directory-worker-not-active:${worker.id}`);
        }
        const previous = workersById.get(worker.id);
        if (previous && canonicalStringify(previous) !== canonicalStringify(worker)) {
            throw new Error(`construction-plan-worker-directory-worker-conflict:${worker.id}`);
        }
        if (!previous) workersById.set(worker.id, worker);
    });
    const workers = Array.from(workersById.values()).sort(compareSafeWorkerDirectoryEntries);
    if (workers.length > CONSTRUCTION_PLAN_MAX_SAFE_WORKERS) {
        throw new Error('construction-plan-worker-directory-capacity-exceeded');
    }
    return {
        workers,
        sourceWorkerIds: workers.map((worker) => worker.id),
        sourceMasterHash: sha256Hex(canonicalStringify(workers)),
    };
};

const pushIssue = (
    issues: ConstructionPlanValidationIssue[],
    code: string,
    path: string,
    message: string,
) => issues.push({ code, path, message });

const expectedSectionsForContract = (contract: ConstructionPlanServerTemplateContract) => {
    const sections = new Map<string, { order: number; pageNumbers: number[]; required: boolean }>();
    contract.pages.forEach((page) => {
        const current = sections.get(page.sectionKey);
        if (current) {
            current.pageNumbers.push(page.pageNumber);
            current.required = current.required || page.required;
            return;
        }
        sections.set(page.sectionKey, {
            order: page.pageNumber - 1,
            pageNumbers: [page.pageNumber],
            required: page.required,
        });
    });
    return sections;
};

const expectedSections = expectedSectionsForContract(SYSTEM_SHORING_SERVER_TEMPLATE);

export const CONSTRUCTION_PLAN_SECTION_ORDER = Array.from(expectedSections.keys());

const SECTION_METADATA: Readonly<Record<string, { title: string; kind: string }>> = {
    cover: { title: '시공계획서 표지', kind: 'cover' },
    'document-control': { title: '문서관리 및 개정이력', kind: 'document-control' },
    toc: { title: '목차', kind: 'toc' },
    general: { title: '일반사항', kind: 'static-content' },
    'project-overview': { title: '공사개요', kind: 'structured-form' },
    organization: { title: '현장 조직도 및 업무분장', kind: 'organization-chart' },
    'material-plan': { title: '자재 반입 및 보관계획', kind: 'structured-form' },
    'equipment-plan': { title: '장비 사용계획', kind: 'equipment-plan' },
    'equipment-layout': { title: '장비 배치 및 작업동선', kind: 'drawing-page' },
    'lifting-plan': { title: '양중작업 계획', kind: 'equipment-plan' },
    'equipment-procedure': { title: '장비 안전작업 절차', kind: 'static-content' },
    'equipment-inspection': { title: '장비 일상점검 기준', kind: 'checklist-template' },
    'equipment-signal': { title: '신호체계 및 통제계획', kind: 'structured-form' },
    'system-overview': { title: '시스템동바리 개요', kind: 'static-content' },
    'component-catalog': { title: '시스템동바리 구성 부품', kind: 'static-content' },
    'member-specifications': { title: '부재 규격 및 허용범위', kind: 'structured-form' },
    'installation-sequence': { title: '표준 설치 순서', kind: 'static-content' },
    'post-ledger-assembly': { title: '지주 및 수평재 조립', kind: 'static-content' },
    'brace-installation': { title: '가새 설치계획', kind: 'static-content' },
    'connection-details': { title: '상·하부 접합 상세', kind: 'static-content' },
    'base-standard-assembly': { title: '받침철물·수직재·수평재 조립', kind: 'static-content' },
    'brace-tie-installation': { title: '가새 및 벽이음 설치계획', kind: 'static-content' },
    'wall-tie-anchorage': { title: '벽이음·앵커 접합 상세', kind: 'drawing-page' },
    'drawing-register': { title: '도면목록 및 공통주의사항', kind: 'drawing-register' },
    'drawing-d01': { title: 'D-01 평면 배치도', kind: 'drawing-page' },
    'drawing-d02-elevation': { title: 'D-02 입면도', kind: 'drawing-page' },
    'drawing-d02-section': { title: 'D-02 단면도', kind: 'drawing-page' },
    'drawing-d03-d04': { title: 'D-03·D-04 지지 및 보강 상세', kind: 'drawing-page' },
    'drawing-d05-d06': { title: 'D-05·D-06 접합 및 장비간섭 상세', kind: 'drawing-page' },
    'pre-pour-hold-point': { title: '타설 전 Hold Point', kind: 'approval-sheet' },
    'pre-use-hold-point': { title: '사용 전 Hold Point', kind: 'approval-sheet' },
    'structural-control': { title: '구조관리 기준', kind: 'structured-form' },
    'site-installation-plan': { title: '설치 작업계획', kind: 'structured-form' },
    'concrete-pour-plan': { title: '콘크리트 타설계획', kind: 'structured-form' },
    'work-platform-access-plan': { title: '작업발판·승강통로 계획', kind: 'structured-form' },
    'dismantling-plan': { title: '해체 작업계획', kind: 'structured-form' },
    'retention-plan': { title: '존치 및 재동바리 계획', kind: 'structured-form' },
    'inspection-maintenance-plan': { title: '사용 중 점검·보수 및 변경관리', kind: 'structured-form' },
    'quality-plan': { title: '품질관리 계획', kind: 'static-content' },
    'safety-plan': { title: '안전관리 계획', kind: 'static-content' },
    'risk-assessment': { title: '위험성평가', kind: 'risk-assessment' },
    'emergency-plan': { title: '비상조치 계획', kind: 'structured-form' },
    'environment-plan': { title: '환경관리 계획', kind: 'static-content' },
    'installation-inspection': { title: '설치 검측 체크리스트', kind: 'checklist-template' },
    'equipment-daily-log': { title: '장비 일일점검일지', kind: 'checklist-template' },
    'scaffold-daily-log': { title: '시스템비계 일일점검일지', kind: 'checklist-template' },
    'photo-sheet': { title: '현장사진대지', kind: 'photo-sheet' },
    handover: { title: '인수인계 및 확인서', kind: 'approval-sheet' },
};

const DEFAULT_COMPLETE_SECTIONS = new Set([
    'document-control', 'toc', 'system-overview', 'component-catalog',
    'equipment-inspection', 'installation-inspection', 'equipment-daily-log', 'scaffold-daily-log',
    'photo-sheet', 'handover',
]);

const DEFAULT_ORGANIZATION_ASSIGNMENTS: readonly UnknownRecord[] = [
    { id: 'site-manager', role: 'site_manager', label: '현장책임자', required: true, responsibilities: ['현장 총괄'], order: 0, externalAssignment: false },
    { id: 'construction-manager', role: 'construction_manager', label: '공사담당', required: true, responsibilities: ['시공 및 공정관리'], order: 1, externalAssignment: false },
    { id: 'safety-manager', role: 'safety_manager', label: '안전담당', required: true, responsibilities: ['안전계획 및 점검'], order: 2, externalAssignment: false },
    { id: 'quality-manager', role: 'quality_manager', label: '품질담당', required: false, responsibilities: ['품질 및 검측관리'], order: 3, externalAssignment: false },
    { id: 'equipment-manager', role: 'equipment_manager', label: '장비담당', required: false, responsibilities: ['장비 및 양중관리'], order: 4, externalAssignment: false },
    { id: 'team-leader', role: 'team_leader', label: '작업반장', required: false, responsibilities: ['작업자 지휘'], order: 5, externalAssignment: false },
];

const ORGANIZATION_ROLES = new Set([
    'site_manager', 'construction_manager', 'safety_manager', 'quality_manager',
    'equipment_manager', 'team_leader', 'crew_member',
]);

const normalizeDisplayString = (value: string): string => value.normalize('NFKC').replace(/\s+/g, ' ').trim();

const requireBoundedString = (value: unknown, field: string, maxLength: number): string => {
    if (typeof value !== 'string') throw new Error(`construction-plan-${field}-invalid`);
    const normalized = normalizeDisplayString(value);
    if (!normalized || normalized.length > maxLength) throw new Error(`construction-plan-${field}-invalid`);
    return normalized;
};

const optionalBoundedString = (value: unknown, field: string, maxLength: number): string | undefined => {
    if (value === undefined || value === null || value === '') return undefined;
    return requireBoundedString(value, field, maxLength);
};

const boundedStringArray = (
    value: unknown,
    field: string,
    maxItems: number,
    maxLength: number,
): string[] => {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value) || value.length > maxItems) throw new Error(`construction-plan-${field}-invalid`);
    return Array.from(new Set(value.map((entry) => requireBoundedString(entry, field, maxLength))));
};

const normalizedIsoDateTime = (value: unknown): string | undefined => {
    let candidate = value;
    if (value instanceof Date) candidate = value.toISOString();
    if (isUnknownRecord(value) && typeof value.toDate === 'function') {
        try {
            candidate = (value.toDate as () => unknown)();
            if (candidate instanceof Date) candidate = candidate.toISOString();
        } catch (_error) {
            return undefined;
        }
    }
    if (typeof candidate !== 'string' || !candidate.trim()) return undefined;
    const parsed = new Date(candidate.trim());
    return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : undefined;
};

const copyOptionalMasterStrings = (
    result: UnknownRecord,
    raw: UnknownRecord,
    fields: ReadonlyArray<{
        target: string;
        source: readonly string[];
        maxLength: number;
    }>,
): void => {
    fields.forEach(({ target, source, maxLength }) => {
        const value = readTrimmedString(raw, source);
        if (value) result[target] = requireBoundedString(value, `erp-${target}`, maxLength);
    });
};

/** Public, document-safe projection of the site master used to create a plan. */
export const projectConstructionPlanSiteMasterSnapshot = (
    raw: unknown,
    fallbackId?: string,
): UnknownRecord | null => {
    if (!isUnknownRecord(raw)) return null;
    const id = readTrimmedString(raw, ['id']) || fallbackId?.trim();
    const name = readTrimmedString(raw, ['siteName', 'name', 'projectName']);
    if (!id || !name) return null;
    const result: UnknownRecord = {
        id: requireBoundedString(id, 'erp-site-id', 200),
        name: requireBoundedString(name, 'erp-site-name', 200),
    };
    copyOptionalMasterStrings(result, raw, [
        { target: 'code', source: ['code', 'siteCode'], maxLength: 100 },
        { target: 'address', source: ['address', 'siteAddress', 'projectAddress'], maxLength: 500 },
        { target: 'startDate', source: ['startDate', 'constructionStartDate'], maxLength: 40 },
        { target: 'endDate', source: ['endDate', 'constructionEndDate'], maxLength: 40 },
        { target: 'status', source: ['status'], maxLength: 40 },
        { target: 'responsibleTeamId', source: ['responsibleTeamId'], maxLength: 200 },
        { target: 'responsibleTeamName', source: ['responsibleTeamName'], maxLength: 200 },
        { target: 'clientCompanyId', source: ['clientCompanyId'], maxLength: 200 },
        { target: 'clientCompanyName', source: ['clientCompanyName'], maxLength: 200 },
        { target: 'contractorCompanyId', source: ['contractorCompanyId', 'constructorCompanyId', 'companyId'], maxLength: 200 },
        { target: 'contractorCompanyName', source: ['contractorCompanyName', 'constructorCompanyName', 'companyName'], maxLength: 200 },
        { target: 'partnerCompanyId', source: ['partnerCompanyId', 'partnerId'], maxLength: 200 },
        { target: 'partnerCompanyName', source: ['partnerCompanyName', 'partnerName'], maxLength: 200 },
        { target: 'siteType', source: ['siteType'], maxLength: 100 },
    ]);
    return result;
};

/**
 * Public business projection. Financial accounts, resident identifiers and
 * internal performance/assignment fields are deliberately not copied.
 */
export const projectConstructionPlanCompanyMasterSnapshot = (
    raw: unknown,
    fallbackId?: string,
): UnknownRecord | null => {
    if (!isUnknownRecord(raw)) return null;
    const id = readTrimmedString(raw, ['id']) || fallbackId?.trim();
    const name = readTrimmedString(raw, ['name', 'companyName']);
    if (!id || !name) return null;
    const result: UnknownRecord = {
        id: requireBoundedString(id, 'erp-company-id', 200),
        name: requireBoundedString(name, 'erp-company-name', 200),
    };
    copyOptionalMasterStrings(result, raw, [
        { target: 'code', source: ['code'], maxLength: 100 },
        { target: 'businessNumber', source: ['businessNumber'], maxLength: 80 },
        { target: 'representativeName', source: ['representativeName', 'ceoName'], maxLength: 120 },
        { target: 'address', source: ['address'], maxLength: 500 },
        { target: 'phone', source: ['phone'], maxLength: 80 },
        { target: 'fax', source: ['fax'], maxLength: 80 },
        { target: 'email', source: ['email'], maxLength: 240 },
        { target: 'type', source: ['type'], maxLength: 80 },
        { target: 'status', source: ['status'], maxLength: 40 },
    ]);
    return result;
};

/** Public work-organization projection; member lists and settlement fields stay private. */
export const projectConstructionPlanTeamMasterSnapshot = (
    raw: unknown,
    fallbackId?: string,
): UnknownRecord | null => {
    if (!isUnknownRecord(raw)) return null;
    const id = readTrimmedString(raw, ['id']) || fallbackId?.trim();
    const name = readTrimmedString(raw, ['name', 'teamName']);
    if (!id || !name) return null;
    const result: UnknownRecord = {
        id: requireBoundedString(id, 'erp-team-id', 200),
        name: requireBoundedString(name, 'erp-team-name', 200),
    };
    copyOptionalMasterStrings(result, raw, [
        { target: 'type', source: ['type'], maxLength: 100 },
        { target: 'leaderWorkerId', source: ['leaderWorkerId', 'leaderId'], maxLength: 200 },
        { target: 'leaderName', source: ['leaderName'], maxLength: 120 },
        { target: 'companyId', source: ['companyId'], maxLength: 200 },
        { target: 'companyName', source: ['companyName'], maxLength: 200 },
        { target: 'parentTeamId', source: ['parentTeamId'], maxLength: 200 },
        { target: 'parentTeamName', source: ['parentTeamName'], maxLength: 200 },
        { target: 'status', source: ['status'], maxLength: 40 },
    ]);
    return result;
};

const buildConstructionPlanErpSourcedValue = (
    value: UnknownRecord,
    source: 'site' | 'company' | 'team',
    rawSource: unknown,
    capturedAt: string,
): UnknownRecord => {
    const sourceId = requireBoundedString(value.id, `erp-${source}-source-id`, 200);
    const rawRecord = isUnknownRecord(rawSource) ? rawSource : {};
    const sourceUpdatedAt = normalizedIsoDateTime(rawRecord.updatedAt ?? rawRecord.modifiedAt);
    return {
        value,
        source,
        sourceId,
        ...(sourceUpdatedAt ? { sourceUpdatedAt } : {}),
        capturedAt,
        overridden: false,
    };
};

export const normalizeConstructionPlanDocumentNoKey = (documentNo: string): string => {
    const display = requireBoundedString(documentNo, 'document-no', 160);
    return display.toLocaleUpperCase('en-US').replace(/\s+/g, '');
};

export const buildConstructionPlanSeriesIdentity = (
    siteIdValue: string,
    documentNoValue: string,
): ConstructionPlanSeriesIdentity => {
    const siteId = requireBoundedString(siteIdValue, 'site-id', 200);
    const documentNo = requireBoundedString(documentNoValue, 'document-no', 160);
    const documentNoKey = normalizeConstructionPlanDocumentNoKey(documentNo);
    return {
        seriesId: `cps-${sha256Hex(`${siteId}\n${documentNoKey}`).slice(0, 40)}`,
        documentNo,
        documentNoKey,
    };
};

/** Finds pre-series documents that would collide with a canonical series identity. */
export const findLegacyConstructionPlanDocumentNoCollisions = (
    rawPlans: readonly unknown[],
    siteIdValue: string,
    identity: ConstructionPlanSeriesIdentity,
    allowedPlanIds: readonly string[] = [],
): string[] => {
    const expectedSiteId = requireBoundedString(siteIdValue, 'site-id', 200);
    const allowed = new Set(allowedPlanIds);
    return rawPlans.flatMap((rawPlan) => {
        if (!isUnknownRecord(rawPlan) || readTrimmedString(rawPlan, ['seriesId'])) return [];
        const id = readTrimmedString(rawPlan, ['id']);
        const siteId = readTrimmedString(rawPlan, ['siteId']);
        const documentNo = readTrimmedString(rawPlan, ['documentNo']);
        if (!id || allowed.has(id) || siteId !== expectedSiteId) return [];
        try {
            return documentNo && normalizeConstructionPlanDocumentNoKey(documentNo) === identity.documentNoKey
                ? [id]
                : [];
        } catch (_error) {
            return [];
        }
    });
};

export const buildConstructionPlanMutationClaimId = (
    actorIdValue: string,
    operationValue: string,
    idempotencyKeyValue: string,
): string => {
    const actorId = requireBoundedString(actorIdValue, 'mutation-actor-id', 200);
    const operation = requireBoundedString(operationValue, 'mutation-operation', 80);
    if (typeof idempotencyKeyValue !== 'string') throw new Error('construction-plan-idempotency-key-invalid');
    const idempotencyKey = idempotencyKeyValue.trim();
    if (!idempotencyKey || idempotencyKey.length > 128) {
        throw new Error('construction-plan-idempotency-key-invalid');
    }
    return `cpm-${sha256Hex(`${actorId}\n${operation}\n${idempotencyKey}`).slice(0, 48)}`;
};

/**
 * Resolves a completed private mutation claim without consulting mutable plan
 * state. Callables use this before source/site preflight so a successful retry
 * remains stable even after the source is later superseded.
 */
export const resolveConstructionPlanMutationClaim = (
    rawClaim: unknown,
    operation: string,
    requestFingerprint: string,
): ConstructionPlanMutationClaimResponse | null => {
    if (rawClaim === undefined || rawClaim === null) return null;
    if (!isUnknownRecord(rawClaim)) {
        throw new Error('construction-plan-mutation-claim-corrupt');
    }
    if (rawClaim.operation !== operation || rawClaim.requestFingerprint !== requestFingerprint) {
        throw new Error('construction-plan-mutation-claim-conflict');
    }
    if (!isUnknownRecord(rawClaim.response)) {
        throw new Error('construction-plan-mutation-claim-response-corrupt');
    }
    try {
        const planId = requireBoundedString(rawClaim.response.planId, 'mutation-claim-plan-id', 200);
        const seriesId = requireBoundedString(rawClaim.response.seriesId, 'mutation-claim-series-id', 200);
        const documentNo = requireBoundedString(rawClaim.response.documentNo, 'mutation-claim-document-no', 160);
        const revisionNo = Number(rawClaim.response.revisionNo);
        if (planId.includes('/') || planId === '.' || planId === '..'
            || seriesId.includes('/') || seriesId === '.' || seriesId === '..'
            || !Number.isInteger(revisionNo) || revisionNo < 0) {
            throw new Error('invalid-claim-response');
        }
        return { planId, seriesId, revisionNo, documentNo, idempotent: true };
    } catch {
        throw new Error('construction-plan-mutation-claim-response-corrupt');
    }
};

export interface ConstructionPlanRevisionSeriesDecision {
    kind: 'bootstrap' | 'advance';
    nextRevision: number;
}

/**
 * Pure transaction decision used after reading the source plan and its
 * deterministic series document in the same Firestore transaction.
 */
export const decideConstructionPlanRevisionSeriesTransition = (
    rawSeries: unknown,
    identity: ConstructionPlanSeriesIdentity,
    source: UnknownRecord,
    rawLatestPlan?: unknown,
): ConstructionPlanRevisionSeriesDecision => {
    const sourceTemplate = resolveConstructionPlanRecordTemplate(source, true);
    const sourcePlanId = requireBoundedString(source.id, 'source-plan-id', 200);
    const sourceSiteId = requireBoundedString(source.siteId, 'source-site-id', 200);
    const sourceDocumentNo = requireBoundedString(source.documentNo, 'source-document-no', 160);
    const sourceRevision = Number(source.revision);
    if (!Number.isInteger(sourceRevision) || sourceRevision < 0
        || sourceSiteId !== source.siteId
        || normalizeConstructionPlanDocumentNoKey(sourceDocumentNo) !== identity.documentNoKey) {
        throw new Error('construction-plan-revision-source-identity-invalid');
    }
    const recordedSeriesId = readTrimmedString(source, ['seriesId']);
    if (recordedSeriesId && recordedSeriesId !== identity.seriesId) {
        throw new Error('construction-plan-revision-source-series-invalid');
    }

    if (rawSeries === undefined || rawSeries === null) {
        if (source.status !== 'issued') {
            throw new Error('construction-plan-legacy-revision-source-invalid');
        }
        return { kind: 'bootstrap', nextRevision: sourceRevision + 1 };
    }
    if (!isUnknownRecord(rawSeries)
        || rawSeries.siteId !== sourceSiteId
        || rawSeries.documentNoKey !== identity.documentNoKey
        || rawSeries.tradeType !== sourceTemplate.tradeType) {
        throw new Error('construction-plan-series-identity-invalid');
    }
    const latestRevisionNo = Number(rawSeries.latestRevisionNo);
    const latestPlanId = readTrimmedString(rawSeries, ['latestPlanId']);
    if (source.status !== 'issued'
        || !Number.isInteger(latestRevisionNo)
        || latestRevisionNo < sourceRevision
        || !latestPlanId
        || rawSeries.latestIssuedPlanId !== sourcePlanId) {
        throw new Error('construction-plan-revision-source-stale');
    }
    if (latestPlanId === sourcePlanId) {
        if (latestRevisionNo !== sourceRevision) {
            throw new Error('construction-plan-revision-source-stale');
        }
        return { kind: 'advance', nextRevision: latestRevisionNo + 1 };
    }

    if (!isUnknownRecord(rawLatestPlan)) {
        throw new Error('construction-plan-revision-latest-plan-required');
    }
    const latestPlanDocumentNo = requireBoundedString(rawLatestPlan.documentNo, 'latest-plan-document-no', 160);
    const latestPlanRevision = Number(rawLatestPlan.revision);
    if (rawLatestPlan.id !== latestPlanId
        || rawLatestPlan.status !== 'void'
        || rawLatestPlan.seriesId !== identity.seriesId
        || rawLatestPlan.siteId !== sourceSiteId
        || normalizeConstructionPlanDocumentNoKey(latestPlanDocumentNo) !== identity.documentNoKey
        || !Number.isInteger(latestPlanRevision)
        || latestPlanRevision !== latestRevisionNo
        || latestPlanRevision <= sourceRevision
        || rawLatestPlan.supersedesPlanId !== sourcePlanId) {
        throw new Error('construction-plan-revision-latest-plan-not-void');
    }
    const latestTemplate = resolveConstructionPlanRecordTemplate(rawLatestPlan, true);
    if (latestTemplate.tradeType !== sourceTemplate.tradeType
        || latestTemplate.templateId !== sourceTemplate.templateId
        || latestTemplate.templateVersion !== sourceTemplate.templateVersion) {
        throw new Error('construction-plan-revision-latest-template-mismatch');
    }
    return { kind: 'advance', nextRevision: latestRevisionNo + 1 };
};

export interface ConstructionPlanIssueSeriesDecision {
    supersedeSource: boolean;
    sourceRevision?: number;
}

/** Pure release guard for both adjacent and skipped/voided revision numbers. */
export const decideConstructionPlanIssueSeriesTransition = (
    rawSeries: unknown,
    identity: ConstructionPlanSeriesIdentity,
    plan: UnknownRecord,
    rawSource?: unknown,
): ConstructionPlanIssueSeriesDecision => {
    const planTemplate = resolveConstructionPlanRecordTemplate(plan, true);
    const planId = requireBoundedString(plan.id, 'issue-plan-id', 200);
    const siteId = requireBoundedString(plan.siteId, 'issue-site-id', 200);
    const documentNo = requireBoundedString(plan.documentNo, 'issue-document-no', 160);
    const revision = Number(plan.revision);
    if (siteId !== plan.siteId
        || normalizeConstructionPlanDocumentNoKey(documentNo) !== identity.documentNoKey
        || !Number.isInteger(revision)
        || revision < 0
        || (readTrimmedString(plan, ['seriesId'])
            && readTrimmedString(plan, ['seriesId']) !== identity.seriesId)) {
        throw new Error('construction-plan-issue-plan-identity-invalid');
    }

    const series = rawSeries === undefined || rawSeries === null ? null : rawSeries;
    if (series !== null && (!isUnknownRecord(series)
        || series.siteId !== siteId
        || series.documentNoKey !== identity.documentNoKey
        || series.tradeType !== planTemplate.tradeType
        || Number(series.latestRevisionNo) !== revision
        || series.latestPlanId !== planId)) {
        throw new Error('construction-plan-issue-series-stale');
    }

    const sourcePlanId = readTrimmedString(plan, ['supersedesPlanId']);
    if (!sourcePlanId) {
        if (isUnknownRecord(series) && readTrimmedString(series, ['latestIssuedPlanId'])) {
            throw new Error('construction-plan-issue-source-required');
        }
        return { supersedeSource: false };
    }
    if (!isUnknownRecord(rawSource)) {
        throw new Error('construction-plan-issue-source-required');
    }
    const sourceDocumentNo = requireBoundedString(rawSource.documentNo, 'issue-source-document-no', 160);
    const sourceRevision = Number(rawSource.revision);
    const recordedSourceRevision = plan.sourceRevisionNo;
    if (rawSource.id !== sourcePlanId
        || rawSource.status !== 'issued'
        || rawSource.siteId !== siteId
        || normalizeConstructionPlanDocumentNoKey(sourceDocumentNo) !== identity.documentNoKey
        || !Number.isInteger(sourceRevision)
        || sourceRevision < 0
        || sourceRevision >= revision
        || (recordedSourceRevision !== undefined
            && (!Number.isInteger(recordedSourceRevision) || Number(recordedSourceRevision) !== sourceRevision))
        || (readTrimmedString(rawSource, ['seriesId'])
            && readTrimmedString(rawSource, ['seriesId']) !== identity.seriesId)
        || (isUnknownRecord(series) && series.latestIssuedPlanId !== sourcePlanId)) {
        throw new Error('construction-plan-issue-source-lineage-invalid');
    }
    const sourceTemplate = resolveConstructionPlanRecordTemplate(rawSource, true);
    if (sourceTemplate.tradeType !== planTemplate.tradeType
        || sourceTemplate.templateId !== planTemplate.templateId
        || sourceTemplate.templateVersion !== planTemplate.templateVersion) {
        throw new Error('construction-plan-issue-source-template-mismatch');
    }
    return { supersedeSource: true, sourceRevision };
};

export const createServerDefaultPlanSections = (
    contract: ConstructionPlanServerTemplateContract = SYSTEM_SHORING_SERVER_TEMPLATE,
): UnknownRecord[] => {
    const expectedByKey = expectedSectionsForContract(contract);
    return Array.from(expectedByKey.keys()).map((key) => {
        const expected = expectedByKey.get(key);
        const metadata = SECTION_METADATA[key];
        if (!expected || !metadata) throw new Error(`construction-plan-template-section-missing:${key}`);
        const contractTitle = contract.pages.find((page) => page.sectionKey === key)?.title;
        return {
            id: key,
            key,
            title: contractTitle || metadata.title,
            kind: metadata.kind,
            order: expected.order,
            pageNumbers: [...expected.pageNumbers],
            required: expected.required,
            status: DEFAULT_COMPLETE_SECTIONS.has(key) ? 'complete' : 'empty',
            content: {},
            placeholders: [],
            containsExampleValues: false,
            standardTextModified: false,
        };
    });
};

export const sanitizeConstructionPlanProjectSnapshot = (
    raw: unknown,
    timestamp: string,
    siteNameFallback = '',
): UnknownRecord => {
    const record = isUnknownRecord(raw) ? raw : {};
    const siteName = optionalBoundedString(record.siteName, 'project-site-name', 200)
        || optionalBoundedString(siteNameFallback, 'project-site-name', 200)
        || '';
    const result: UnknownRecord = {
        capturedAt: timestamp,
        siteName,
        buildings: boundedStringArray(record.buildings, 'project-buildings', 100, 100),
        floors: boundedStringArray(record.floors, 'project-floors', 100, 100),
        zones: boundedStringArray(record.zones, 'project-zones', 200, 120),
        sitePhotos: [],
        emergencyContactsComplete: record.emergencyContactsComplete === true,
        differsFromMaster: record.differsFromMaster === true,
    };
    const optionalFields: Array<[string, number]> = [
        ['address', 500], ['clientName', 200], ['contractorName', 200],
    ];
    optionalFields.forEach(([key, maxLength]) => {
        const value = optionalBoundedString(record[key], `project-${key}`, maxLength);
        if (value) result[key] = value;
    });
    if (record.constructionPeriod !== undefined && record.constructionPeriod !== null) {
        if (!isUnknownRecord(record.constructionPeriod)) {
            throw new Error('construction-plan-project-construction-period-invalid');
        }
        const startDate = optionalBoundedString(record.constructionPeriod.startDate, 'project-start-date', 40);
        const endDate = optionalBoundedString(record.constructionPeriod.endDate, 'project-end-date', 40);
        result.constructionPeriod = {
            ...(startDate ? { startDate } : {}),
            ...(endDate ? { endDate } : {}),
        };
    }
    return result;
};

const sanitizeConstructionPlanErpSourcedValue = (
    raw: unknown,
    expectedSource: 'site' | 'company' | 'team',
    fallbackCapturedAt: string,
    projectValue: (value: unknown, fallbackId?: string) => UnknownRecord | null,
): UnknownRecord => {
    if (!isUnknownRecord(raw) || raw.source !== expectedSource || !isUnknownRecord(raw.value)) {
        throw new Error(`construction-plan-erp-${expectedSource}-source-invalid`);
    }
    const sourceId = requireBoundedString(raw.sourceId, `erp-${expectedSource}-source-id`, 200);
    const value = projectValue(raw.value, sourceId);
    if (!value || value.id !== sourceId) {
        throw new Error(`construction-plan-erp-${expectedSource}-binding-invalid`);
    }
    const rawCapturedAt = raw.capturedAt;
    const normalizedCapturedAt = normalizedIsoDateTime(rawCapturedAt);
    if (rawCapturedAt !== undefined && !normalizedCapturedAt) {
        throw new Error(`construction-plan-erp-${expectedSource}-captured-at-invalid`);
    }
    const capturedAt = normalizedCapturedAt || fallbackCapturedAt;
    const rawSourceUpdatedAt = raw.sourceUpdatedAt;
    const sourceUpdatedAt = normalizedIsoDateTime(rawSourceUpdatedAt);
    if (rawSourceUpdatedAt !== undefined && !sourceUpdatedAt) {
        throw new Error(`construction-plan-erp-${expectedSource}-updated-at-invalid`);
    }
    return {
        value,
        source: expectedSource,
        sourceId,
        ...(sourceUpdatedAt ? { sourceUpdatedAt } : {}),
        capturedAt,
        overridden: raw.overridden === true,
    };
};

/**
 * Sanitizes the immutable-at-capture ERP provenance envelope. Older plans do
 * not have this field, so absence remains valid and is not synthesized from
 * client-provided denormalized names.
 */
export const sanitizeConstructionPlanErpSnapshot = (
    raw: unknown,
    timestamp: string,
): UnknownRecord | undefined => {
    if (raw === undefined || raw === null) return undefined;
    if (!isUnknownRecord(raw)) throw new Error('construction-plan-erp-snapshot-invalid');
    const fallbackCapturedAt = normalizedIsoDateTime(timestamp);
    if (!fallbackCapturedAt) throw new Error('construction-plan-erp-snapshot-timestamp-invalid');
    const rawCapturedAt = raw.capturedAt;
    const normalizedCapturedAt = normalizedIsoDateTime(rawCapturedAt);
    if (rawCapturedAt !== undefined && !normalizedCapturedAt) {
        throw new Error('construction-plan-erp-snapshot-captured-at-invalid');
    }
    const capturedAt = normalizedCapturedAt || fallbackCapturedAt;
    if (!raw.site) throw new Error('construction-plan-erp-site-source-required');
    const result: UnknownRecord = {
        schemaVersion: 1,
        capturedAt,
        site: sanitizeConstructionPlanErpSourcedValue(
            raw.site,
            'site',
            capturedAt,
            projectConstructionPlanSiteMasterSnapshot,
        ),
    };
    const optionalSources: ReadonlyArray<[
        string,
        'company' | 'team',
        (value: unknown, fallbackId?: string) => UnknownRecord | null,
    ]> = [
        ['clientCompany', 'company', projectConstructionPlanCompanyMasterSnapshot],
        ['contractorCompany', 'company', projectConstructionPlanCompanyMasterSnapshot],
        ['partnerCompany', 'company', projectConstructionPlanCompanyMasterSnapshot],
        ['responsibleTeam', 'team', projectConstructionPlanTeamMasterSnapshot],
    ];
    optionalSources.forEach(([key, source, projector]) => {
        if (raw[key] === undefined || raw[key] === null) return;
        result[key] = sanitizeConstructionPlanErpSourcedValue(raw[key], source, capturedAt, projector);
    });
    const fieldProvenance = sanitizeConstructionPlanErpFieldProvenance(raw.fieldProvenance, result);
    if (fieldProvenance && Object.keys(fieldProvenance).length > 0) {
        result.fieldProvenance = fieldProvenance;
    }
    return result;
};

/**
 * Resolves the project fields printed in the PDF from a canonical ERP
 * envelope. A mixed-source refresh may retain older fields inside an
 * overridden envelope; the envelope value plus its validated per-field
 * provenance remains the single source of truth.
 */
export const resolveConstructionPlanErpVisibleProjectFields = (
    raw: unknown,
    fallbackCapturedAt: string,
): UnknownRecord => {
    const snapshot = sanitizeConstructionPlanErpSnapshot(raw, fallbackCapturedAt);
    if (!snapshot) throw new Error('construction-plan-erp-snapshot-required');
    const valueFor = (slot: string): UnknownRecord => {
        const candidate = snapshot[slot];
        const source: UnknownRecord = isUnknownRecord(candidate) ? candidate : {};
        return isUnknownRecord(source.value) ? source.value : {};
    };
    const site = valueFor('site');
    const clientCompany = valueFor('clientCompany');
    const contractorCompany = valueFor('contractorCompany');
    const siteName = readTrimmedString(site, ['name']);
    if (!siteName) throw new Error('construction-plan-erp-visible-site-name-required');
    const address = readTrimmedString(site, ['address']);
    const startDate = readTrimmedString(site, ['startDate']);
    const endDate = readTrimmedString(site, ['endDate']);
    const clientName = readTrimmedString(clientCompany, ['name'])
        || readTrimmedString(site, ['clientCompanyName']);
    const contractorName = readTrimmedString(contractorCompany, ['name'])
        || readTrimmedString(site, ['contractorCompanyName']);
    return {
        siteName,
        ...(address ? { address } : {}),
        ...(clientName ? { clientName } : {}),
        ...(contractorName ? { contractorName } : {}),
        ...((startDate || endDate) ? {
            constructionPeriod: {
                ...(startDate ? { startDate } : {}),
                ...(endDate ? { endDate } : {}),
            },
        } : {}),
        sitePhotos: [],
    };
};

const sanitizeOrganizationWorker = (raw: unknown, field: string): UnknownRecord => {
    const projected = projectSafeWorkerDirectoryEntry(raw);
    if (!projected) throw new Error(`construction-plan-${field}-invalid`);
    return projected as unknown as UnknownRecord;
};

const sanitizeConstructionPlanWorkerDirectoryProvenance = (
    raw: unknown,
    siteId: string,
): UnknownRecord | undefined => {
    if (raw === undefined || raw === null) return undefined;
    if (!isUnknownRecord(raw)) throw new Error('construction-plan-worker-directory-provenance-invalid');
    const allowed = new Set([
        'captureKind', 'sourceSiteId', 'sourceTeamId', 'capturedAt', 'sourceMasterHash',
        'sourceWorkerIds', 'appliedBy', 'appliedAt', 'changeReason', 'auditEventId',
    ]);
    if (Object.keys(raw).some((key) => !allowed.has(key))) {
        throw new Error('construction-plan-worker-directory-provenance-field-invalid');
    }
    const captureKind = raw.captureKind;
    if (captureKind !== 'initial' && captureKind !== 'refresh') {
        throw new Error('construction-plan-worker-directory-provenance-kind-invalid');
    }
    const sourceSiteId = requireBoundedString(raw.sourceSiteId, 'worker-directory-source-site-id', 200);
    if (sourceSiteId !== siteId) throw new Error('construction-plan-worker-directory-site-binding-invalid');
    const sourceTeamId = optionalBoundedString(raw.sourceTeamId, 'worker-directory-source-team-id', 200);
    const capturedAt = normalizedIsoDateTime(raw.capturedAt);
    const sourceMasterHash = requireBoundedString(raw.sourceMasterHash, 'worker-directory-source-hash', 64)
        .toLowerCase();
    if (!capturedAt || !/^[a-f0-9]{64}$/.test(sourceMasterHash)) {
        throw new Error('construction-plan-worker-directory-provenance-evidence-invalid');
    }
    const sourceWorkerIds = boundedStringArray(
        raw.sourceWorkerIds,
        'worker-directory-source-worker-ids',
        CONSTRUCTION_PLAN_MAX_SAFE_WORKERS,
        200,
    );
    if (new Set(sourceWorkerIds).size !== sourceWorkerIds.length) {
        throw new Error('construction-plan-worker-directory-source-worker-ids-duplicate');
    }
    const appliedBy = optionalBoundedString(raw.appliedBy, 'worker-directory-applied-by', 200);
    const appliedAt = raw.appliedAt === undefined ? undefined : normalizedIsoDateTime(raw.appliedAt);
    const changeReason = optionalBoundedString(raw.changeReason, 'worker-directory-change-reason', 500);
    const auditEventId = optionalBoundedString(raw.auditEventId, 'worker-directory-audit-event-id', 200);
    const hasAnyRefreshEvidence = Boolean(appliedBy || appliedAt || changeReason || auditEventId);
    const hasCompleteRefreshEvidence = Boolean(appliedBy && appliedAt && changeReason && auditEventId);
    if ((raw.appliedAt !== undefined && !appliedAt)
        || (captureKind === 'initial' && hasAnyRefreshEvidence)
        || (captureKind === 'refresh' && (!hasCompleteRefreshEvidence || changeReason!.length < 5))) {
        throw new Error('construction-plan-worker-directory-change-evidence-invalid');
    }
    return {
        captureKind,
        sourceSiteId,
        ...(sourceTeamId ? { sourceTeamId } : {}),
        capturedAt,
        sourceMasterHash,
        sourceWorkerIds,
        ...(captureKind === 'refresh' ? { appliedBy, appliedAt, changeReason, auditEventId } : {}),
    };
};

export const sanitizeConstructionPlanOrganizationSnapshot = (
    raw: unknown,
    timestamp: string,
    siteId: string,
    strictInput = false,
): UnknownRecord => {
    const record = isUnknownRecord(raw) ? raw : {};
    const rawAssignments = record.assignments === undefined
        ? DEFAULT_ORGANIZATION_ASSIGNMENTS
        : record.assignments;
    if (!Array.isArray(rawAssignments) || rawAssignments.length > 50) {
        throw new Error('construction-plan-organization-assignments-invalid');
    }
    const assignments = rawAssignments.map((value, index) => {
        if (!isUnknownRecord(value)) throw new Error('construction-plan-organization-assignment-invalid');
        const role = requireBoundedString(value.role, 'organization-role', 80);
        if (!ORGANIZATION_ROLES.has(role)) throw new Error('construction-plan-organization-role-invalid');
        const id = optionalBoundedString(value.id, 'organization-assignment-id', 120);
        const label = optionalBoundedString(value.label, 'organization-assignment-label', 120);
        if (strictInput && (!id || !label)) {
            throw new Error('construction-plan-organization-assignment-required-fields');
        }
        const assignment: UnknownRecord = {
            id: id || `assignment-${index + 1}`,
            role,
            label: label || role,
            required: value.required === true,
            responsibilities: boundedStringArray(
                value.responsibilities,
                'organization-responsibilities',
                30,
                300,
            ),
            order: Number.isInteger(value.order) && Number(value.order) >= 0 ? Number(value.order) : index,
            externalAssignment: false,
        };
        if (value.worker !== undefined && value.worker !== null) {
            const worker = sanitizeOrganizationWorker(value.worker, 'organization-worker');
            const workerSiteId = readTrimmedString(worker, ['siteId']);
            const inferredExternalAssignment = Boolean(workerSiteId && workerSiteId !== siteId);
            if (value.externalAssignment !== undefined && typeof value.externalAssignment !== 'boolean') {
                throw new Error('construction-plan-organization-external-assignment-invalid');
            }
            assignment.worker = worker;
            assignment.externalAssignment = value.externalAssignment === true || inferredExternalAssignment;
            const exceptionReason = optionalBoundedString(
                value.exceptionReason,
                'organization-exception-reason',
                500,
            );
            if (exceptionReason && exceptionReason.length < 5) {
                throw new Error('construction-plan-organization-exception-reason-invalid');
            }
            if (exceptionReason) assignment.exceptionReason = exceptionReason;
        }
        return assignment;
    });
    const rawAdditionalWorkers = record.additionalWorkers ?? [];
    if (!Array.isArray(rawAdditionalWorkers)
        || rawAdditionalWorkers.length > CONSTRUCTION_PLAN_MAX_SAFE_WORKERS) {
        throw new Error('construction-plan-organization-additional-workers-invalid');
    }
    const sanitizedAdditionalWorkers = rawAdditionalWorkers.map((worker) =>
        sanitizeOrganizationWorker(worker, 'organization-additional-worker'));
    const assignedWorkerRecords = assignments.flatMap((assignment) =>
        isUnknownRecord(assignment.worker) ? [assignment.worker] : []);
    const directoryBinding = buildConstructionPlanWorkerDirectoryBinding([
        ...assignedWorkerRecords,
        ...sanitizedAdditionalWorkers,
    ]);
    const assignedWorkerIds = new Set(assignedWorkerRecords
        .map((worker) => readTrimmedString(worker, ['id']))
        .filter((workerId): workerId is string => Boolean(workerId)));
    const additionalWorkers = directoryBinding.workers
        .filter((worker) => !assignedWorkerIds.has(worker.id));
    const workerDirectoryProvenance = sanitizeConstructionPlanWorkerDirectoryProvenance(
        record.workerDirectoryProvenance,
        siteId,
    );
    if (workerDirectoryProvenance) {
        if (canonicalStringify(workerDirectoryProvenance.sourceWorkerIds)
                !== canonicalStringify(directoryBinding.sourceWorkerIds)
            || workerDirectoryProvenance.sourceMasterHash !== directoryBinding.sourceMasterHash) {
            throw new Error('construction-plan-worker-directory-provenance-binding-invalid');
        }
    }
    return {
        capturedAt: timestamp,
        sourceSiteId: siteId,
        assignments,
        additionalWorkers,
        ...(workerDirectoryProvenance ? { workerDirectoryProvenance } : {}),
    };
};

const organizationRoleSearchText = (worker: SafeWorkerDirectoryEntry): string => [
    worker.role,
    worker.position,
].filter((value): value is string => Boolean(value)).join(' ').normalize('NFKC').toLowerCase();

const ORGANIZATION_ROLE_MATCHERS: Readonly<Record<string, readonly string[]>> = {
    site_manager: ['site_manager', '현장책임', '현장소장', '현장관리'],
    construction_manager: ['construction_manager', '공사담당', '공사관리', '시공관리'],
    safety_manager: ['safety_manager', '안전담당', '안전관리'],
    quality_manager: ['quality_manager', '품질담당', '품질관리'],
    equipment_manager: ['equipment_manager', '장비담당', '장비관리', '양중관리'],
    team_leader: ['team_leader', '작업반장', '반장', '팀장'],
};

const projectStringList = (record: UnknownRecord, keys: readonly string[]): string[] =>
    Array.from(new Set(keys.flatMap((key) => normalizedStringList(record[key]))));

/**
 * Builds the only server-approved initial snapshot for a new plan.
 *
 * Site identity fields always come from the site master. Plan-specific scope
 * arrays may come from the request, with the site master used as a fallback.
 * Linked company/team values are projections of documents loaded by the
 * callable from IDs on that site; denormalized client names never replace a
 * resolved master. The ERP envelope records the exact source and capture time.
 * Organization workers are exclusively sourced from the already-whitelisted
 * directory entries; caller-supplied worker/participant objects are not used.
 */
export const buildCanonicalConstructionPlanDraftContext = (
    input: BuildCanonicalConstructionPlanDraftContextInput,
): CanonicalConstructionPlanDraftContext => {
    if (!isUnknownRecord(input.site)) {
        throw new Error('construction-plan-canonical-site-invalid');
    }
    const capturedAt = normalizedIsoDateTime(input.capturedAt);
    if (!capturedAt) throw new Error('construction-plan-canonical-captured-at-invalid');
    const requested = isUnknownRecord(input.requestedProjectSnapshot)
        ? input.requestedProjectSnapshot
        : {};
    const site = input.site;
    const siteMaster = projectConstructionPlanSiteMasterSnapshot(site, input.siteId);
    if (!siteMaster || siteMaster.id !== input.siteId) {
        throw new Error('construction-plan-canonical-site-binding-invalid');
    }
    const clientCompanyId = readTrimmedString(site, ['clientCompanyId']);
    const contractorCompanyId = readTrimmedString(site, ['constructorCompanyId', 'companyId']);
    const partnerCompanyId = readTrimmedString(site, ['partnerId']);
    const responsibleTeamId = readTrimmedString(site, ['responsibleTeamId']);
    const linkedCompany = (raw: unknown, expectedId: string | undefined): UnknownRecord | null => {
        if (!expectedId || raw === undefined || raw === null) return null;
        const projected = projectConstructionPlanCompanyMasterSnapshot(raw, expectedId);
        if (!projected || projected.id !== expectedId) {
            throw new Error('construction-plan-canonical-company-binding-invalid');
        }
        return projected;
    };
    const clientCompany = linkedCompany(input.clientCompany, clientCompanyId);
    const contractorCompany = linkedCompany(input.contractorCompany, contractorCompanyId);
    const partnerCompany = linkedCompany(input.partnerCompany, partnerCompanyId);
    const responsibleTeam = responsibleTeamId && input.responsibleTeam !== undefined
        ? projectConstructionPlanTeamMasterSnapshot(input.responsibleTeam, responsibleTeamId)
        : null;
    if (responsibleTeamId && input.responsibleTeam !== undefined
        && (!responsibleTeam || responsibleTeam.id !== responsibleTeamId)) {
        throw new Error('construction-plan-canonical-team-binding-invalid');
    }
    const requestedBuildings = projectStringList(requested, ['buildings']);
    const requestedFloors = projectStringList(requested, ['floors']);
    const requestedZones = projectStringList(requested, ['zones']);
    const siteBuildings = projectStringList(site, ['buildings', 'buildingNames', 'buildingList']);
    const siteFloors = projectStringList(site, ['floors', 'floorNames', 'floorList']);
    const siteZones = projectStringList(site, ['zones', 'zoneNames', 'workZones']);
    const erpSnapshot: UnknownRecord = {
        schemaVersion: 1,
        capturedAt,
        site: buildConstructionPlanErpSourcedValue(siteMaster, 'site', site, capturedAt),
        ...(clientCompany ? {
            clientCompany: buildConstructionPlanErpSourcedValue(
                clientCompany,
                'company',
                input.clientCompany,
                capturedAt,
            ),
        } : {}),
        ...(contractorCompany ? {
            contractorCompany: buildConstructionPlanErpSourcedValue(
                contractorCompany,
                'company',
                input.contractorCompany,
                capturedAt,
            ),
        } : {}),
        ...(partnerCompany ? {
            partnerCompany: buildConstructionPlanErpSourcedValue(
                partnerCompany,
                'company',
                input.partnerCompany,
                capturedAt,
            ),
        } : {}),
        ...(responsibleTeam ? {
            responsibleTeam: buildConstructionPlanErpSourcedValue(
                responsibleTeam,
                'team',
                input.responsibleTeam,
                capturedAt,
            ),
        } : {}),
    };
    erpSnapshot.fieldProvenance = buildInitialConstructionPlanErpFieldProvenance(erpSnapshot);
    // Build every PDF-visible ERP field from the exact allowlisted envelope we
    // persist. Falling back to raw aliases or caller values here would create
    // a projectSnapshot that cannot satisfy release-time source equality when
    // an optional master field is absent.
    const projectSnapshot: UnknownRecord = {
        ...resolveConstructionPlanErpVisibleProjectFields(erpSnapshot, capturedAt),
        buildings: requestedBuildings.length > 0 ? requestedBuildings : siteBuildings,
        floors: requestedFloors.length > 0 ? requestedFloors : siteFloors,
        zones: requestedZones.length > 0 ? requestedZones : siteZones,
        sitePhotos: [],
        emergencyContactsComplete: typeof site.emergencyContactsComplete === 'boolean'
            ? site.emergencyContactsComplete
            : requested.emergencyContactsComplete === true,
        differsFromMaster: false,
    };

    const initialWorkerDirectory = buildConstructionPlanWorkerDirectoryBinding(
        input.safeWorkers
            .map((worker) => projectSafeWorkerDirectoryEntry(worker, worker.id))
            .filter((worker): worker is SafeWorkerDirectoryEntry => Boolean(worker?.status === 'active')),
    );
    const availableWorkers = initialWorkerDirectory.workers;
    const assignedWorkerIds = new Set<string>();
    const preferredSiteManagers = new Set(input.preferredSiteManagerWorkerIds ?? []);
    const assignments = DEFAULT_ORGANIZATION_ASSIGNMENTS.map((template) => {
        const role = String(template.role);
        const matchers = ORGANIZATION_ROLE_MATCHERS[role] ?? [];
        const worker = availableWorkers.find((candidate) => (
            !assignedWorkerIds.has(candidate.id)
            && ((role === 'site_manager' && preferredSiteManagers.has(candidate.id))
                || matchers.some((matcher) => organizationRoleSearchText(candidate).includes(matcher)))
        ));
        if (worker) assignedWorkerIds.add(worker.id);
        return {
            ...template,
            ...(worker ? {
                worker,
                externalAssignment: Boolean(worker.siteId && worker.siteId !== input.siteId),
            } : {}),
        };
    });
    const additionalWorkers = availableWorkers
        .filter((worker) => !assignedWorkerIds.has(worker.id));
    const canonicalSiteName = readTrimmedString(projectSnapshot, ['siteName']);

    return {
        ...(canonicalSiteName ? { siteName: canonicalSiteName } : {}),
        projectSnapshot,
        erpSnapshot,
        organizationSnapshot: {
            sourceSiteId: input.siteId,
            assignments,
            additionalWorkers,
            workerDirectoryProvenance: {
                captureKind: 'initial',
                sourceSiteId: input.siteId,
                ...(responsibleTeamId ? { sourceTeamId: responsibleTeamId } : {}),
                capturedAt,
                sourceMasterHash: initialWorkerDirectory.sourceMasterHash,
                sourceWorkerIds: initialWorkerDirectory.sourceWorkerIds,
            },
        },
        participants: { authorIds: [input.actorId], reviewerIds: [], approverIds: [] },
    };
};

const sanitizePlanParticipants = (
    raw: unknown,
    actorId: string,
    inheritedAuthorIds: readonly string[] = [],
): UnknownRecord => {
    const record = isUnknownRecord(raw) ? raw : {};
    const authorIds = Array.from(new Set([
        actorId,
        ...inheritedAuthorIds,
        ...boundedStringArray(record.authorIds, 'participant-author-ids', 50, 200),
    ]));
    return {
        authorIds,
        reviewerIds: boundedStringArray(record.reviewerIds, 'participant-reviewer-ids', 50, 200),
        approverIds: boundedStringArray(record.approverIds, 'participant-approver-ids', 50, 200),
    };
};

const resetReleaseReadiness = (raw: unknown): UnknownRecord => ({
    ...(isUnknownRecord(raw) ? raw : {}),
    requiredReviewsComplete: false,
    unresolvedRequiredComments: 0,
    snapshotHashMatches: false,
    pdfVisualCheckPassed: false,
    pdfTextCheckPassed: false,
    drawingLegendMonochromeDistinct: true,
    latestTemplateAvailable: false,
    latestDrawingRevisionAvailable: false,
    workerRefreshAvailable: false,
    recordAppendixAvailable: false,
});

const scrubSectionDrawingReferences = (
    rawSections: unknown,
    contract: ConstructionPlanServerTemplateContract,
): UnknownRecord[] => {
    if (!Array.isArray(rawSections)) return createServerDefaultPlanSections(contract);
    return rawSections.map((rawSection) => {
        if (!isUnknownRecord(rawSection)) throw new Error('construction-plan-section-invalid');
        const content = isUnknownRecord(rawSection.content) ? rawSection.content : {};
        const { drawingId: _drawingId, drawingStudio: _drawingStudio, ...cleanContent } = content;
        const hadDrawingReference = Object.keys(cleanContent).length !== Object.keys(content).length;
        return {
            ...rawSection,
            content: cleanContent,
            ...(hadDrawingReference && rawSection.kind === 'drawing-page' ? { status: 'empty' } : {}),
        };
    });
};

const sectionHasUserContent = (rawSection: UnknownRecord): boolean => {
    if (rawSection.status !== undefined && rawSection.status !== 'empty') return true;
    if (!isUnknownRecord(rawSection.content)) return false;
    return Object.entries(rawSection.content).some(([key, value]) => {
        if (key === 'standardTextVersion' || key === 'standardTextCurrent') return false;
        if (value === undefined || value === null || value === '') return false;
        if (Array.isArray(value)) return value.length > 0;
        if (isUnknownRecord(value)) return Object.keys(value).length > 0;
        return true;
    });
};

/**
 * A version upgrade may change manifest metadata. Matching section keys retain
 * their structured content, newly-added keys start from the server default,
 * and a removed populated key fails closed instead of silently dropping data.
 */
const migrateSectionsToTemplateContract = (
    rawSections: unknown,
    targetContract: ConstructionPlanServerTemplateContract,
): UnknownRecord[] => {
    if (!Array.isArray(rawSections)) throw new Error('construction-plan-template-migration-sections-invalid');
    const sourceByKey = new Map<string, UnknownRecord>();
    rawSections.forEach((rawSection) => {
        if (!isUnknownRecord(rawSection)) throw new Error('construction-plan-template-migration-section-invalid');
        const key = readTrimmedString(rawSection, ['key', 'id']);
        if (!key || sourceByKey.has(key)) throw new Error('construction-plan-template-migration-section-key-invalid');
        sourceByKey.set(key, rawSection);
    });
    const defaults = createServerDefaultPlanSections(targetContract);
    const targetKeys = new Set(defaults.map((section) => String(section.key)));
    sourceByKey.forEach((section, key) => {
        if (!targetKeys.has(key) && sectionHasUserContent(section)) {
            throw new Error('construction-plan-template-migration-would-drop-content');
        }
    });
    return defaults.map((defaultSection) => {
        const sourceSection = sourceByKey.get(String(defaultSection.key));
        if (!sourceSection) return defaultSection;
        return {
            ...sourceSection,
            id: defaultSection.id,
            key: defaultSection.key,
            title: defaultSection.title,
            kind: defaultSection.kind,
            order: defaultSection.order,
            required: defaultSection.required,
            pageNumbers: defaultSection.pageNumbers,
            content: isUnknownRecord(sourceSection.content) ? sourceSection.content : {},
        };
    });
};

const requireDrawingReuseProjection = (
    value: unknown,
    planId: string,
): { drawings: UnknownRecord[]; sections: UnknownRecord[]; drawingApplicability: UnknownRecord[] } => {
    if (!isUnknownRecord(value)
        || !Array.isArray(value.drawings)
        || !Array.isArray(value.sections)
        || !Array.isArray(value.drawingApplicability)) {
        throw new Error('construction-plan-drawing-reuse-projection-required');
    }
    const drawingIds = new Set<string>();
    const drawings = value.drawings.map((drawing) => {
        if (!isUnknownRecord(drawing)
            || drawing.planId !== planId
            || typeof drawing.id !== 'string'
            || drawingIds.has(drawing.id)
            || drawing.approvalStatus !== 'draft'
            || typeof drawing.storagePath !== 'string'
            || !drawing.storagePath.includes(`/${planId}/drawings/${drawing.id}/rev-1/source.`)
            || typeof drawing.sourceGeneration !== 'string'
            || !/^[1-9][0-9]*$/.test(drawing.sourceGeneration)
            || typeof drawing.sourceSha256 !== 'string'
            || !/^[a-f0-9]{64}$/.test(drawing.sourceSha256)
            || !Array.isArray(drawing.previewPaths)
            || !Array.isArray(drawing.pages)
            || drawing.pages.length !== 0
            || (drawing.mimeType === 'application/pdf'
                && (drawing.previewStatus !== 'pending' || drawing.previewPaths.length !== 0))) {
            throw new Error('construction-plan-drawing-reuse-projection-invalid');
        }
        drawingIds.add(drawing.id);
        return drawing;
    });
    const sections = value.sections.map((section) => {
        if (!isUnknownRecord(section)) throw new Error('construction-plan-drawing-reuse-section-invalid');
        const content = isUnknownRecord(section.content) ? section.content : {};
        const drawingId = readTrimmedString(content, ['drawingId']);
        if (drawingId && !drawingIds.has(drawingId)) {
            throw new Error('construction-plan-drawing-reuse-section-binding-invalid');
        }
        return section;
    });
    const drawingApplicability = value.drawingApplicability.map((decision) => {
        if (!isUnknownRecord(decision)) {
            throw new Error('construction-plan-drawing-reuse-applicability-invalid');
        }
        const drawingId = readTrimmedString(decision, ['drawingId']);
        if (drawingId && !drawingIds.has(drawingId)) {
            throw new Error('construction-plan-drawing-reuse-applicability-binding-invalid');
        }
        if (decision.reviewedBy !== undefined || decision.technicalReviewReference !== undefined) {
            throw new Error('construction-plan-drawing-reuse-applicability-review-not-reset');
        }
        return decision;
    });
    return { drawings, sections, drawingApplicability };
};

const mergeDrawingReuseSections = (
    templateSections: UnknownRecord[],
    reusedSections: UnknownRecord[],
): UnknownRecord[] => {
    const byKey = new Map<string, UnknownRecord>();
    reusedSections.forEach((section) => {
        const key = readTrimmedString(section, ['key', 'id']);
        if (!key || byKey.has(key)) throw new Error('construction-plan-drawing-reuse-section-key-invalid');
        byKey.set(key, section);
    });
    return templateSections.map((templateSection) => {
        const key = readTrimmedString(templateSection, ['key', 'id']);
        const reused = key ? byKey.get(key) : undefined;
        if (!reused) return templateSection;
        return {
            ...reused,
            id: templateSection.id,
            key: templateSection.key,
            title: templateSection.title,
            kind: templateSection.kind,
            order: templateSection.order,
            required: templateSection.required,
            pageNumbers: templateSection.pageNumbers,
        };
    });
};

const resetEngineeringValuesForReview = (raw: unknown): UnknownRecord[] => {
    if (!Array.isArray(raw)) return [];
    return raw.map((value) => {
        if (!isUnknownRecord(value)) throw new Error('construction-plan-engineering-value-invalid');
        const { verifiedBy: _verifiedBy, verifiedAt: _verifiedAt, ...content } = value;
        return { ...content, verificationStatus: 'unverified' };
    });
};

const resetRiskAssessmentsForReview = (raw: unknown): UnknownRecord[] => {
    if (!Array.isArray(raw)) return [];
    return raw.map((value) => {
        if (!isUnknownRecord(value)) throw new Error('construction-plan-risk-assessment-invalid');
        const { verifiedBy: _verifiedBy, ...content } = value;
        return content;
    });
};

const sourceAuthors = (source: UnknownRecord): string[] => {
    const participants = isUnknownRecord(source.participants) ? source.participants : {};
    const participantAuthors = boundedStringArray(
        participants.authorIds,
        'participant-author-ids',
        50,
        200,
    );
    const legacyCreator = readTrimmedString(source, ['createdBy']);
    return Array.from(new Set([
        ...(legacyCreator ? [legacyCreator] : []),
        ...participantAuthors,
    ]));
};

const commonSourceDraftContent = (
    source: UnknownRecord,
    planId: string,
    siteId: string,
    timestamp: string,
    copyDrawings: boolean,
    refreshCapturedAt: boolean,
    contract: ConstructionPlanServerTemplateContract,
    migrateTemplate = false,
    drawingReuseProjection?: unknown,
): UnknownRecord => {
    const sourceProject = isUnknownRecord(source.projectSnapshot) ? source.projectSnapshot : {};
    const sourceOrganization = isUnknownRecord(source.organizationSnapshot) ? source.organizationSnapshot : {};
    const existingProjectCapturedAt = readTrimmedString(sourceProject, ['capturedAt']);
    const existingOrganizationCapturedAt = readTrimmedString(sourceOrganization, ['capturedAt']);
    const projectCapturedAt = !refreshCapturedAt
        && existingProjectCapturedAt
        && Number.isFinite(Date.parse(existingProjectCapturedAt))
        ? existingProjectCapturedAt
        : timestamp;
    const organizationCapturedAt = !refreshCapturedAt
        && existingOrganizationCapturedAt
        && Number.isFinite(Date.parse(existingOrganizationCapturedAt))
        ? existingOrganizationCapturedAt
        : timestamp;
    const erpSnapshot = sanitizeConstructionPlanErpSnapshot(source.erpSnapshot, timestamp);
    const reusable = copyDrawings
        ? requireDrawingReuseProjection(drawingReuseProjection, planId)
        : undefined;
    const templateSections = migrateTemplate
        ? migrateSectionsToTemplateContract(source.sections, contract)
        : (Array.isArray(source.sections) ? source.sections : createServerDefaultPlanSections(contract));
    const selectedSectionKeys = !migrateTemplate && Array.isArray(source.selectedSectionKeys)
        ? source.selectedSectionKeys.filter((key): key is string => typeof key === 'string')
        : undefined;
    return {
    templateId: contract.templateId,
    templateVersion: contract.templateVersion,
    rendererVersion: contract.rendererVersion,
    schemaVersion: contract.schemaVersion,
    projectSnapshot: sanitizeConstructionPlanProjectSnapshot(source.projectSnapshot, projectCapturedAt),
    ...(erpSnapshot ? { erpSnapshot } : {}),
    organizationSnapshot: sanitizeConstructionPlanOrganizationSnapshot(
        source.organizationSnapshot,
        organizationCapturedAt,
        siteId,
    ),
    sections: reusable
        ? mergeDrawingReuseSections(templateSections, reusable.sections)
        : scrubSectionDrawingReferences(templateSections, contract),
    sectionOrder: Array.from(expectedSectionsForContract(contract).keys()),
    ...(selectedSectionKeys ? { selectedSectionKeys } : {}),
    drawings: reusable?.drawings ?? [],
    drawingApplicability: reusable?.drawingApplicability ?? [],
    engineeringValues: resetEngineeringValuesForReview(source.engineeringValues),
    equipmentPlan: Array.isArray(source.equipmentPlan) ? source.equipmentPlan : [],
    riskAssessments: resetRiskAssessmentsForReview(source.riskAssessments),
    releaseReadiness: resetReleaseReadiness(source.releaseReadiness),
    };
};

export const buildConstructionPlanDraftDocument = (
    input: BuildConstructionPlanDraftInput,
): UnknownRecord => {
    const contract = resolveConstructionPlanServerTemplate({
        tradeType: input.tradeType ?? SYSTEM_SHORING_SERVER_TEMPLATE.tradeType,
        templateId: input.templateId ?? SYSTEM_SHORING_SERVER_TEMPLATE.templateId,
        templateVersion: input.templateVersion ?? SYSTEM_SHORING_SERVER_TEMPLATE.templateVersion,
    });
    const sections = createServerDefaultPlanSections(contract);
    const manifestSectionKeys = Array.from(new Set(contract.pages.map((page) => page.sectionKey)));
    const requestedSectionKeys = input.selectedSectionKeys
        ? new Set(input.selectedSectionKeys.map((key) => String(key).trim()).filter(Boolean))
        : new Set(manifestSectionKeys);
    const coreSectionKeys = ['cover', 'document-control', 'toc', 'project-overview'];
    if (coreSectionKeys.some((key) => !requestedSectionKeys.has(key))
        || Array.from(requestedSectionKeys).some((key) => !manifestSectionKeys.includes(key))) {
        throw new Error('construction-plan-selected-section-keys-invalid');
    }
    const selectedSectionKeys = manifestSectionKeys.filter((key) => requestedSectionKeys.has(key));
    const documentDate = input.documentDate ?? formatSeoulCalendarDate(input.timestamp);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(documentDate)) {
        throw new Error('construction-plan-document-date-invalid');
    }
    const erpSnapshot = sanitizeConstructionPlanErpSnapshot(input.erpSnapshot, input.timestamp);
    return {
        id: input.id,
        seriesId: input.seriesId,
        lineageRootPlanId: input.id,
        siteId: input.siteId,
        title: requireBoundedString(input.title, 'title', 240),
        tradeType: contract.tradeType,
        documentNo: requireBoundedString(input.documentNo, 'document-no', 160),
        documentDate,
        revision: 0,
        status: 'draft',
        templateId: contract.templateId,
        templateVersion: contract.templateVersion,
        rendererVersion: contract.rendererVersion,
        schemaVersion: contract.schemaVersion,
        projectSnapshot: sanitizeConstructionPlanProjectSnapshot(
            input.projectSnapshot,
            input.timestamp,
            input.siteName,
        ),
        ...(erpSnapshot ? { erpSnapshot } : {}),
        organizationSnapshot: sanitizeConstructionPlanOrganizationSnapshot(
            input.organizationSnapshot,
            input.timestamp,
            input.siteId,
            true,
        ),
        sections,
        sectionOrder: sections.map((section) => String(section.id)),
        selectedSectionKeys,
        drawings: [],
        drawingApplicability: [],
        engineeringValues: [],
        equipmentPlan: [],
        riskAssessments: [],
        releaseReadiness: resetReleaseReadiness(undefined),
        validationSummary: { errors: 0, warnings: 0, checkedAt: input.timestamp },
        lockVersion: 0,
        participants: sanitizePlanParticipants(input.participants, input.actorId),
        createdBy: input.actorId,
        ...(input.actorName ? { createdByName: input.actorName } : {}),
        createdAt: input.timestamp,
        updatedBy: input.actorId,
        updatedAt: input.timestamp,
    };
};

export const buildConstructionPlanRevisionDocument = (
    source: UnknownRecord,
    input: BuildConstructionPlanRevisionInput,
): UnknownRecord => {
    const sourceContract = resolveConstructionPlanRecordTemplate(source, true);
    const contract = input.targetTemplate
        ? resolveConstructionPlanServerTemplate(input.targetTemplate)
        : sourceContract;
    if (input.targetTemplate && (
        contract.tradeType !== sourceContract.tradeType
        || (contract.templateId === sourceContract.templateId
            && contract.templateVersion === sourceContract.templateVersion)
    )) {
        throw new Error('construction-plan-template-migration-target-invalid');
    }
    const sourceId = requireBoundedString(source.id, 'source-plan-id', 200);
    const siteId = requireBoundedString(source.siteId, 'site-id', 200);
    const sourceRevisionNo = Number(source.revision);
    if (!Number.isInteger(sourceRevisionNo) || sourceRevisionNo < 0 || sourceRevisionNo >= input.revision) {
        throw new Error('construction-plan-source-revision-invalid');
    }
    const lineageRootPlanId = readTrimmedString(source, ['lineageRootPlanId']) || sourceId;
    return {
        id: input.id,
        seriesId: input.seriesId,
        lineageRootPlanId,
        supersedesPlanId: sourceId,
        sourceSnapshotHash: input.sourceSnapshotHash,
        sourceRevisionNo,
        revisionReason: requireBoundedString(input.revisionReason, 'revision-reason', 2000),
        revisionType: input.revisionType,
        siteId,
        title: requireBoundedString(source.title, 'title', 240),
        tradeType: contract.tradeType,
        documentNo: requireBoundedString(source.documentNo, 'document-no', 160),
        documentDate: formatSeoulCalendarDate(input.timestamp),
        revision: input.revision,
        status: 'draft',
        ...commonSourceDraftContent(
            source,
            input.id,
            siteId,
            input.timestamp,
            input.copyDrawings,
            false,
            contract,
            Boolean(input.targetTemplate),
            input.drawingReuseProjection,
        ),
        validationSummary: { errors: 0, warnings: 0, checkedAt: input.timestamp },
        lockVersion: 0,
        participants: {
            authorIds: Array.from(new Set([...sourceAuthors(source), input.actorId])),
            reviewerIds: [],
            approverIds: [],
        },
        createdBy: input.actorId,
        ...(input.actorName ? { createdByName: input.actorName } : {}),
        createdAt: input.timestamp,
        updatedBy: input.actorId,
        updatedAt: input.timestamp,
    };
};

export const buildConstructionPlanCloneDocument = (
    source: UnknownRecord,
    input: BuildConstructionPlanCloneInput,
): UnknownRecord => {
    const contract = resolveConstructionPlanRecordTemplate(source, true);
    const sourceId = requireBoundedString(source.id, 'source-plan-id', 200);
    const siteId = requireBoundedString(source.siteId, 'site-id', 200);
    const sourceSnapshotHash = readTrimmedString(source, ['approvedSnapshotHash']);
    return {
        id: input.id,
        seriesId: input.seriesId,
        lineageRootPlanId: input.id,
        clonedFromPlanId: sourceId,
        ...(sourceSnapshotHash ? { sourceSnapshotHash } : {}),
        siteId,
        title: requireBoundedString(input.title || source.title, 'title', 240),
        tradeType: contract.tradeType,
        documentNo: requireBoundedString(input.documentNo, 'document-no', 160),
        documentDate: formatSeoulCalendarDate(input.timestamp),
        revision: 0,
        status: 'draft',
        ...commonSourceDraftContent(
            source,
            input.id,
            siteId,
            input.timestamp,
            input.copyDrawings,
            true,
            contract,
            false,
            input.drawingReuseProjection,
        ),
        organizationSnapshot: sanitizeConstructionPlanOrganizationSnapshot(undefined, input.timestamp, siteId),
        validationSummary: { errors: 0, warnings: 0, checkedAt: input.timestamp },
        lockVersion: 0,
        participants: { authorIds: [input.actorId], reviewerIds: [], approverIds: [] },
        createdBy: input.actorId,
        ...(input.actorName ? { createdByName: input.actorName } : {}),
        createdAt: input.timestamp,
        updatedBy: input.actorId,
        updatedAt: input.timestamp,
    };
};

const samePrimitiveArray = (left: readonly unknown[], right: readonly unknown[]) =>
    left.length === right.length && left.every((value, index) => value === right[index]);

const TEMPLATE_BINDING_KEYS = new Set([
    'schemaVersion', 'templateRecordId', 'templateKey', 'tradeType', 'templateId',
    'templateVersion', 'rendererVersion', 'logicalPageCount', 'manifestHash',
    'templateBundleHash', 'templateHash', 'lifecycleVersionAtCapture', 'publishedAt',
    'capturedAt',
]);

const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;

const validateBoundTemplateIdentity = (
    plan: UnknownRecord,
    contract: ConstructionPlanServerTemplateContract,
    issues: ConstructionPlanValidationIssue[],
): void => {
    const binding = plan.templateBinding;
    if (!isUnknownRecord(binding)
        || Object.keys(binding).some((key) => !TEMPLATE_BINDING_KEYS.has(key))) {
        pushIssue(
            issues,
            'template.binding_required',
            'templateBinding',
            'A server-owned immutable published template binding is required.',
        );
        return;
    }
    const hashesValid = ['manifestHash', 'templateBundleHash', 'templateHash']
        .every((key) => typeof binding[key] === 'string' && SHA256_HEX_PATTERN.test(String(binding[key])));
    const instantsValid = normalizedIsoDateTime(binding.publishedAt) !== undefined
        && normalizedIsoDateTime(binding.capturedAt) !== undefined;
    if (binding.schemaVersion !== 1
        || binding.tradeType !== contract.tradeType
        || binding.templateId !== contract.templateId
        || binding.templateVersion !== contract.templateVersion
        || binding.rendererVersion !== contract.rendererVersion
        || binding.logicalPageCount !== contract.pageCount
        || !Number.isInteger(binding.lifecycleVersionAtCapture)
        || Number(binding.lifecycleVersionAtCapture) < 1
        || typeof binding.templateRecordId !== 'string'
        || !binding.templateRecordId
        || typeof binding.templateKey !== 'string'
        || !binding.templateKey
        || !hashesValid
        || !instantsValid) {
        pushIssue(
            issues,
            'template.binding_invalid',
            'templateBinding',
            'Published template binding does not match the selected server template.',
        );
        return;
    }
    const bindingHash = sha256Hex(canonicalStringify(binding));
    if (plan.templateHash !== binding.templateHash
        || plan.manifestHash !== binding.manifestHash
        || plan.templateBundleHash !== binding.templateBundleHash
        || plan.templateBindingHash !== bindingHash) {
        pushIssue(
            issues,
            'template.binding_projection',
            'templateBindingHash',
            'Template hash projections must exactly match the immutable binding.',
        );
    }
};

const validateTemplateInvariant = (plan: UnknownRecord, issues: ConstructionPlanValidationIssue[]): void => {
    let contract: ConstructionPlanServerTemplateContract;
    try {
        contract = resolveConstructionPlanRecordTemplate(plan);
    } catch {
        pushIssue(issues, 'template.identity', 'templateId', 'tradeType, templateId and templateVersion must identify one supported server template exactly.');
        if (plan.tradeType === 'system-shoring' || plan.tradeType === 'system-scaffold') {
            const expected = getLatestConstructionPlanServerTemplate(plan.tradeType);
            contract = expected;
            if (plan.templateId !== expected.templateId) {
                pushIssue(issues, 'template.id', 'templateId', `templateId must be ${expected.templateId}.`);
            }
            if (plan.templateVersion !== expected.templateVersion) {
                pushIssue(issues, 'template.version', 'templateVersion', `templateVersion must be ${expected.templateVersion}.`);
            }
            if (plan.rendererVersion !== expected.rendererVersion) {
                pushIssue(issues, 'renderer.version', 'rendererVersion', `rendererVersion must be ${expected.rendererVersion}.`);
            }
            if (plan.schemaVersion !== expected.schemaVersion) {
                pushIssue(issues, 'template.schema_version', 'schemaVersion', `schemaVersion must be ${expected.schemaVersion}.`);
            }
        } else return;
    }
    if (plan.rendererVersion !== contract.rendererVersion) {
        pushIssue(issues, 'renderer.version', 'rendererVersion', `rendererVersion must be ${contract.rendererVersion}.`);
    }
    if (plan.schemaVersion !== contract.schemaVersion) {
        pushIssue(issues, 'template.schema_version', 'schemaVersion', `schemaVersion must be ${contract.schemaVersion}.`);
    }
    validateBoundTemplateIdentity(plan, contract, issues);
    const contractSections = expectedSectionsForContract(contract);
    const contractSectionOrder = Array.from(contractSections.keys());

    const rawSections = plan.sections;
    if (!Array.isArray(rawSections)) {
        pushIssue(issues, 'sections.required', 'sections', 'sections must be an array.');
        return;
    }
    if (rawSections.length !== contractSections.size) {
        pushIssue(issues, 'sections.count', 'sections', `Exactly ${contractSections.size} manifest sections are required.`);
    }

    const sectionOrder = plan.sectionOrder;
    if (!Array.isArray(sectionOrder) || !samePrimitiveArray(sectionOrder, contractSectionOrder)) {
        pushIssue(issues, 'sections.order', 'sectionOrder', 'sectionOrder must exactly match the server manifest.');
    }

    const byKey = new Map<string, UnknownRecord>();
    rawSections.forEach((rawSection, index) => {
        if (!isUnknownRecord(rawSection)) {
            pushIssue(issues, 'section.shape', `sections[${index}]`, 'Section must be an object.');
            return;
        }
        const key = readTrimmedString(rawSection, ['key']);
        if (!key) {
            pushIssue(issues, 'section.key', `sections[${index}].key`, 'Section key is required.');
            return;
        }
        if (byKey.has(key)) pushIssue(issues, 'section.duplicate', `sections[${index}].key`, `Duplicate section key: ${key}.`);
        byKey.set(key, rawSection);
    });

    contractSections.forEach((expected, key) => {
        const section = byKey.get(key);
        if (!section) {
            pushIssue(issues, 'section.missing', `sections.${key}`, `Manifest section ${key} is missing.`);
            return;
        }
        if (section.id !== key) pushIssue(issues, 'section.id', `sections.${key}.id`, `Section id must be ${key}.`);
        if (section.order !== expected.order) pushIssue(issues, 'section.order', `sections.${key}.order`, `Section order must be ${expected.order}.`);
        if (section.required !== expected.required) pushIssue(issues, 'section.required_flag', `sections.${key}.required`, 'Section required flag differs from the server manifest.');
        if (!Array.isArray(section.pageNumbers) || !samePrimitiveArray(section.pageNumbers, expected.pageNumbers)) {
            pushIssue(issues, 'section.pages', `sections.${key}.pageNumbers`, `Section pages must be [${expected.pageNumbers.join(', ')}].`);
        }
    });

    const flattenedPages = contractSectionOrder.flatMap((key) => {
        const pageNumbers = byKey.get(key)?.pageNumbers;
        return Array.isArray(pageNumbers) ? pageNumbers : [];
    });
    const expectedPageNumbers = Array.from({ length: contract.pageCount }, (_, index) => index + 1);
    if (!samePrimitiveArray(flattenedPages, expectedPageNumbers)) {
        pushIssue(issues, 'template.pages', 'sections.pageNumbers', 'Pages must cover 1 through 42 exactly once in manifest order.');
    }
};

const PLACEHOLDER_PATTERN = /(\{\{[^}]+\}\}|\b(?:todo|tbd)\b|추후\s*입력|미입력|<[^>]*(?:입력|placeholder)[^>]*>)/i;
const EXAMPLE_VALUE_PATTERN = /^(?:예시|샘플|sample|example)\s*(?:[:：-]|$)/i;

const findDraftMarker = (value: unknown, path: string, seen: Set<object>): string | null => {
    if (typeof value === 'string') {
        return PLACEHOLDER_PATTERN.test(value) || EXAMPLE_VALUE_PATTERN.test(value) ? path : null;
    }
    if (Array.isArray(value)) {
        for (let index = 0; index < value.length; index += 1) {
            const match = findDraftMarker(value[index], `${path}[${index}]`, seen);
            if (match) return match;
        }
        return null;
    }
    if (!isUnknownRecord(value)) return null;
    if (seen.has(value)) return null;
    seen.add(value);
    for (const [key, entry] of Object.entries(value)) {
        const match = findDraftMarker(entry, path ? `${path}.${key}` : key, seen);
        if (match) return match;
    }
    return null;
};

const validateRequiredContent = (plan: UnknownRecord, issues: ConstructionPlanValidationIssue[]): void => {
    ['siteId', 'title', 'documentNo', 'documentDate'].forEach((path) => {
        if (!readTrimmedString(plan, [path])) {
            pushIssue(issues, 'document.required', path, `${path} is required for release.`);
        }
    });
    const seriesId = readTrimmedString(plan, ['seriesId']);
    const lineageRootPlanId = readTrimmedString(plan, ['lineageRootPlanId']);
    const supersedesPlanId = readTrimmedString(plan, ['supersedesPlanId']);
    const clonedFromPlanId = readTrimmedString(plan, ['clonedFromPlanId']);
    if (seriesId && !lineageRootPlanId) {
        pushIssue(issues, 'lineage.root', 'lineageRootPlanId', 'A series-backed plan requires a lineage root plan id.');
    }
    if (supersedesPlanId) {
        const revision = Number(plan.revision);
        const reason = readTrimmedString(plan, ['revisionReason']);
        const revisionType = readTrimmedString(plan, ['revisionType']);
        const sourceSnapshotHash = readTrimmedString(plan, ['sourceSnapshotHash']);
        const rawSourceRevisionNo = plan.sourceRevisionNo;
        const sourceRevisionNoValid = rawSourceRevisionNo === undefined
            || (Number.isInteger(rawSourceRevisionNo)
                && Number(rawSourceRevisionNo) >= 0
                && Number(rawSourceRevisionNo) < revision);
        if (!seriesId || !lineageRootPlanId || !Number.isInteger(revision) || revision < 1
            || !reason || reason.length < 5
            || !REVISION_TYPE_VALUES.has(revisionType || '')
            || !sourceSnapshotHash || !/^[a-f0-9]{64}$/.test(sourceSnapshotHash)
            || !sourceRevisionNoValid) {
            pushIssue(issues, 'lineage.revision', 'supersedesPlanId', 'A revision requires complete series, reason, type and source snapshot lineage.');
        }
    }
    if (clonedFromPlanId && (!seriesId || !lineageRootPlanId || Number(plan.revision) !== 0)) {
        pushIssue(issues, 'lineage.clone', 'clonedFromPlanId', 'A clone must start a new series at revision zero.');
    }
    const requiredArrayPaths = [
        'sections', 'sectionOrder', 'drawings', 'drawingApplicability', 'engineeringValues',
        'equipmentPlan', 'riskAssessments',
    ];
    requiredArrayPaths.forEach((path) => {
        if (!Array.isArray(plan[path])) pushIssue(issues, 'array.required', path, `${path} must be an array.`);
    });

    const project = isUnknownRecord(plan.projectSnapshot) ? plan.projectSnapshot : null;
    if (!project) {
        pushIssue(issues, 'project.required', 'projectSnapshot', 'Project snapshot is required.');
    } else {
        ['buildings', 'floors', 'zones'].forEach((key) => {
            const values = project[key];
            if (!Array.isArray(values) || values.length === 0) {
                pushIssue(issues, 'project.array_empty', `projectSnapshot.${key}`, `${key} must contain at least one value.`);
            }
        });
        if (!Array.isArray(project.sitePhotos) || project.sitePhotos.length !== 0) {
            pushIssue(
                issues,
                'project.site_photos_forbidden',
                'projectSnapshot.sitePhotos',
                'Site-master photos and download URLs cannot be embedded in a construction-plan snapshot.',
            );
        }
    }

    if (plan.erpSnapshot !== undefined) {
        try {
            const fallbackCapturedAt = readTrimmedString(plan, ['createdAt']) || '2000-01-01T00:00:00.000Z';
            const sanitized = sanitizeConstructionPlanErpSnapshot(plan.erpSnapshot, fallbackCapturedAt);
            if (canonicalStringify(sanitized) !== canonicalStringify(plan.erpSnapshot)) {
                pushIssue(issues, 'erp_snapshot.noncanonical', 'erpSnapshot', 'ERP snapshot must contain only the server public-work projection.');
            }
            const planSiteId = readTrimmedString(plan, ['siteId']);
            const siteSource = sanitized && isUnknownRecord(sanitized.site) ? sanitized.site : {};
            if (!planSiteId || siteSource.sourceId !== planSiteId) {
                pushIssue(
                    issues,
                    'erp_snapshot.site_binding',
                    'erpSnapshot.site.sourceId',
                    'ERP site source must match the construction-plan site.',
                );
            }
            if (project) {
                const expected = resolveConstructionPlanErpVisibleProjectFields(
                    sanitized,
                    fallbackCapturedAt,
                );
                const visibleKeys = ['siteName', 'address', 'clientName', 'contractorName'] as const;
                visibleKeys.forEach((key) => {
                    const actualValue = readTrimmedString(project, [key]);
                    const expectedValue = readTrimmedString(expected, [key]);
                    if (actualValue !== expectedValue) {
                        pushIssue(
                            issues,
                            'erp_snapshot.project_binding',
                            `projectSnapshot.${key}`,
                            `${key} must exactly match its canonical ERP source.`,
                        );
                    }
                });
                const actualPeriod = isUnknownRecord(project.constructionPeriod)
                    ? project.constructionPeriod
                    : {};
                const expectedPeriod = isUnknownRecord(expected.constructionPeriod)
                    ? expected.constructionPeriod
                    : {};
                ['startDate', 'endDate'].forEach((key) => {
                    if (readTrimmedString(actualPeriod, [key]) !== readTrimmedString(expectedPeriod, [key])) {
                        pushIssue(
                            issues,
                            'erp_snapshot.project_binding',
                            `projectSnapshot.constructionPeriod.${key}`,
                            `constructionPeriod.${key} must exactly match its canonical ERP source.`,
                        );
                    }
                });
            }
        } catch {
            pushIssue(issues, 'erp_snapshot.invalid', 'erpSnapshot', 'ERP snapshot source, identity and captured timestamps must be valid.');
        }
    }

    const organization = isUnknownRecord(plan.organizationSnapshot) ? plan.organizationSnapshot : null;
    const assignments = organization?.assignments;
    if (!Array.isArray(assignments) || assignments.length === 0) {
        pushIssue(issues, 'organization.empty', 'organizationSnapshot.assignments', 'Organization assignments are required.');
    } else {
        assignments.forEach((assignment, index) => {
            if (!isUnknownRecord(assignment) || assignment.required !== true) return;
            const worker = isUnknownRecord(assignment.worker) ? assignment.worker : null;
            if (!worker || !readTrimmedString(worker, ['id']) || !readTrimmedString(worker, ['name'])) {
                pushIssue(issues, 'organization.required_role', `organizationSnapshot.assignments[${index}].worker`, 'Every required organization role must have a safe worker assignment.');
            }
        });
        ['site_manager', 'construction_manager', 'safety_manager'].forEach((requiredRole) => {
            const assigned = assignments.some((assignment) => {
                if (!isUnknownRecord(assignment) || assignment.role !== requiredRole) return false;
                const worker = isUnknownRecord(assignment.worker) ? assignment.worker : null;
                return Boolean(worker && readTrimmedString(worker, ['id']) && readTrimmedString(worker, ['name']));
            });
            if (!assigned) {
                pushIssue(issues, 'organization.required_role', `organizationSnapshot.assignments.${requiredRole}`, `Required role ${requiredRole} must be assigned.`);
            }
        });
        const workerAssignmentCounts = new Map<string, number>();
        assignments.forEach((assignment) => {
            if (!isUnknownRecord(assignment) || !isUnknownRecord(assignment.worker)) return;
            const workerId = readTrimmedString(assignment.worker, ['id']);
            if (workerId) workerAssignmentCounts.set(workerId, (workerAssignmentCounts.get(workerId) ?? 0) + 1);
        });
        const planSiteId = readTrimmedString(plan, ['siteId']);
        assignments.forEach((assignment, index) => {
            if (!isUnknownRecord(assignment) || !isUnknownRecord(assignment.worker)) return;
            const workerId = readTrimmedString(assignment.worker, ['id']);
            const workerSiteId = readTrimmedString(assignment.worker, ['siteId']);
            const isDuplicate = Boolean(workerId && (workerAssignmentCounts.get(workerId) ?? 0) > 1);
            const isExplicitlyCrossSite = Boolean(planSiteId && workerSiteId && workerSiteId !== planSiteId);
            const isMarkedExternal = assignment.externalAssignment === true;
            if (isExplicitlyCrossSite && !isMarkedExternal) {
                pushIssue(
                    issues,
                    'organization.external_assignment_flag',
                    `organizationSnapshot.assignments[${index}].externalAssignment`,
                    'A worker explicitly sourced from another site must be marked as an external assignment.',
                );
            }
            if (isDuplicate || isExplicitlyCrossSite || isMarkedExternal) {
                const reason = readTrimmedString(assignment, ['exceptionReason']);
                if (!reason || reason.length < 5 || reason.length > 500) {
                    pushIssue(
                        issues,
                        isDuplicate
                            ? 'organization.duplicate_assignment_reason'
                            : 'organization.external_assignment_reason',
                        `organizationSnapshot.assignments[${index}].exceptionReason`,
                        isDuplicate
                            ? 'Every role held concurrently by the same worker requires its own bounded reason.'
                            : 'Every external assignment requires a bounded reason.',
                    );
                }
            }
        });
    }
    if (organization) {
        const planSiteId = readTrimmedString(plan, ['siteId']);
        const organizationSiteId = readTrimmedString(organization, ['sourceSiteId']);
        if (!planSiteId || organizationSiteId !== planSiteId) {
            pushIssue(
                issues,
                'organization.site_binding',
                'organizationSnapshot.sourceSiteId',
                'Organization source site must match the construction-plan site.',
            );
        }
        try {
            const rawAdditionalWorkers = Array.isArray(organization.additionalWorkers)
                ? organization.additionalWorkers
                : [];
            const rawAssignedWorkers = Array.isArray(assignments)
                ? assignments.flatMap((assignment) => (
                    isUnknownRecord(assignment) && isUnknownRecord(assignment.worker)
                        ? [assignment.worker]
                        : []
                ))
                : [];
            const directory = buildConstructionPlanWorkerDirectoryBinding([
                ...rawAssignedWorkers,
                ...rawAdditionalWorkers,
            ]);
            const assignedIds = new Set(rawAssignedWorkers.flatMap((worker) => {
                const id = readTrimmedString(worker, ['id']);
                return id ? [id] : [];
            }));
            const canonicalAdditionalWorkers = directory.workers
                .filter((worker) => !assignedIds.has(worker.id));
            const projectedAdditionalWorkers = rawAdditionalWorkers.map((worker) => {
                const projected = projectSafeWorkerDirectoryEntry(worker);
                if (!projected) throw new Error('construction-plan-worker-directory-entry-invalid');
                return projected;
            });
            if (canonicalStringify(projectedAdditionalWorkers)
                    !== canonicalStringify(canonicalAdditionalWorkers)) {
                pushIssue(
                    issues,
                    'organization.worker_directory_noncanonical',
                    'organizationSnapshot.additionalWorkers',
                    'Additional workers must be unique, unassigned and ordered by name and ID.',
                );
            }
            const provenance = isUnknownRecord(organization.workerDirectoryProvenance)
                ? organization.workerDirectoryProvenance
                : null;
            if (!provenance) {
                pushIssue(
                    issues,
                    'organization.worker_directory_provenance_required',
                    'organizationSnapshot.workerDirectoryProvenance',
                    'A server-captured worker-directory provenance record is required.',
                );
            } else {
                const provenanceSiteId = readTrimmedString(provenance, ['sourceSiteId']);
                if (provenanceSiteId !== planSiteId
                    || canonicalStringify(provenance.sourceWorkerIds)
                        !== canonicalStringify(directory.sourceWorkerIds)
                    || provenance.sourceMasterHash !== directory.sourceMasterHash) {
                    pushIssue(
                        issues,
                        'organization.worker_directory_binding',
                        'organizationSnapshot.workerDirectoryProvenance',
                        'Worker IDs and source hash must exactly match the canonical active organization directory.',
                    );
                }
            }
        } catch {
            pushIssue(
                issues,
                'organization.worker_directory_invalid',
                'organizationSnapshot',
                'Organization workers must be active, safe, unique and internally consistent.',
            );
        }
    }
    const participants = isUnknownRecord(plan.participants) ? plan.participants : null;
    if (!participants || !['authorIds', 'reviewerIds', 'approverIds'].every((key) => Array.isArray(participants[key]))) {
        pushIssue(issues, 'participants.arrays', 'participants', 'Participant author/reviewer/approver arrays are required.');
    }

    if (Array.isArray(plan.sections)) {
        let standardTextContract: ConstructionPlanServerTemplateContract | undefined;
        try {
            standardTextContract = resolveConstructionPlanRecordTemplate(plan);
        } catch {
            standardTextContract = undefined;
        }
        plan.sections.forEach((rawSection, index) => {
            if (!isUnknownRecord(rawSection)) return;
            const key = readTrimmedString(rawSection, ['key']) || String(index);
            if (standardTextContract) {
                validateConstructionPlanServerStandardText(standardTextContract, rawSection).forEach((issue) => {
                    pushIssue(
                        issues,
                        `standard_text.${issue.code}`,
                        `sections.${key}.${issue.path}`,
                        issue.message,
                    );
                });
            }
            if (rawSection.required === true && rawSection.status !== 'complete') {
                pushIssue(issues, 'section.incomplete', `sections.${key}.status`, 'Required section must be complete.');
            }
            if (rawSection.status === 'not_applicable' && !readTrimmedString(rawSection, ['notApplicableReason'])) {
                pushIssue(issues, 'section.na_reason', `sections.${key}.notApplicableReason`, 'Not-applicable section requires a reason.');
            }
            if (Array.isArray(rawSection.placeholders) && rawSection.placeholders.length > 0) {
                pushIssue(issues, 'section.placeholders', `sections.${key}.placeholders`, 'Section still has unresolved placeholders.');
            }
            if (rawSection.containsExampleValues === true) {
                pushIssue(issues, 'section.example_values', `sections.${key}.containsExampleValues`, 'Example values cannot be released.');
            }
            if (rawSection.status === 'complete' && isConstructionPlanStructuredSectionKey(key)) {
                validateConstructionPlanStructuredSectionContent(key, rawSection.content).forEach((issue) => {
                    pushIssue(
                        issues,
                        `structured.${issue.code}`,
                        `sections.${key}.content${issue.path ? `.${issue.path}` : ''}`,
                        `${issue.label} is required by the structured section contract.`,
                    );
                });
            }
        });
    }

    const risks = plan.riskAssessments;
    let riskPolicy: ConstructionPlanServerTemplateContract['riskAssessmentPolicy'] | undefined;
    try {
        riskPolicy = resolveConstructionPlanRecordTemplate(plan).riskAssessmentPolicy;
    } catch {
        riskPolicy = undefined;
    }
    if (Array.isArray(risks)) {
        if (risks.length === 0) {
            pushIssue(issues, 'risk.required', 'riskAssessments', 'At least one risk assessment is required.');
        }
        risks.forEach((risk, index) => {
            const path = `riskAssessments[${index}]`;
            if (!isUnknownRecord(risk)) {
                pushIssue(issues, 'risk.shape', path, 'Risk assessment must be an object.');
                return;
            }
            const mitigationMeasures = risk.mitigationMeasures;
            const complete = Boolean(
                readTrimmedString(risk, ['id'])
                && readTrimmedString(risk, ['workStage'])
                && readTrimmedString(risk, ['hazard'])
                && ['low', 'medium', 'high', 'critical'].includes(String(risk.initialRiskLevel || ''))
                && Array.isArray(mitigationMeasures)
                && mitigationMeasures.length > 0
                && mitigationMeasures.every((measure) => typeof measure === 'string' && measure.trim().length > 0)
                && readTrimmedString(risk, ['responsibleWorkerId'])
                && ['low', 'medium', 'high', 'critical'].includes(String(risk.residualRiskLevel || ''))
                && readTrimmedString(risk, ['verifiedBy'])
            );
            if (!complete) {
                pushIssue(issues, 'risk.incomplete', path, 'Risk stage, hazard, controls, owner, residual risk and verifier must all be complete.');
            }
            if ((risk.initialRiskLevel === 'high' || risk.initialRiskLevel === 'critical')
                && (!Array.isArray(mitigationMeasures)
                    || mitigationMeasures.length === 0
                    || !readTrimmedString(risk, ['responsibleWorkerId']))) {
                pushIssue(issues, 'risk.high_control_incomplete', path, 'High and critical initial risks require explicit controls and a responsible worker.');
            }
            if (riskPolicy) {
                const initialScore = constructionPlanRiskScore(
                    risk.initialProbability,
                    risk.initialSeverity,
                    riskPolicy,
                );
                const residualScore = constructionPlanRiskScore(
                    risk.residualProbability,
                    risk.residualSeverity,
                    riskPolicy,
                );
                if (risk.assessmentMethodVersion !== riskPolicy.methodVersion
                    || readTrimmedString(risk, ['methodReference']) !== riskPolicy.methodReference) {
                    pushIssue(issues, 'risk.template_policy_mismatch', `${path}.methodReference`, 'Risk method version and reference must exactly match the selected immutable template policy.');
                }
                if (initialScore === null || residualScore === null) {
                    pushIssue(issues, 'risk.matrix_incomplete', path, 'Initial and residual risk matrix inputs must be within the selected template bounds.');
                } else {
                    if (risk.initialRiskLevel !== constructionPlanRiskLevelFromScore(initialScore, riskPolicy)
                        || risk.residualRiskLevel !== constructionPlanRiskLevelFromScore(residualScore, riskPolicy)) {
                        pushIssue(issues, 'risk.matrix_level_mismatch', path, 'Stored risk levels must match the selected template probability multiplied by severity thresholds.');
                    }
                    if (riskPolicy.acceptance.requireResidualReduction && residualScore >= initialScore) {
                        pushIssue(issues, 'risk.residual_not_reduced', `${path}.residualRiskLevel`, 'Residual risk score must be lower than initial risk score under the selected template policy.');
                    }
                    if (!constructionPlanResidualRiskIsAcceptable(
                        residualScore,
                        risk.residualRiskLevel,
                        riskPolicy,
                    )) {
                        pushIssue(issues, 'risk.residual_not_acceptable', `${path}.residualRiskLevel`, 'Residual risk does not satisfy the selected template acceptance criterion.');
                    }
                }
                const reviewTrigger = readTrimmedString(risk, ['reviewTrigger']);
                if (!reviewTrigger || !riskPolicy.reviewTriggers.includes(reviewTrigger)) {
                    pushIssue(issues, 'risk.review_trigger_contract', `${path}.reviewTrigger`, 'Reassessment trigger must be one of the selected template policy triggers.');
                }
            }
        });
    }

    const engineeringValues = plan.engineeringValues;
    if (Array.isArray(engineeringValues)) {
        if (engineeringValues.length === 0) {
            pushIssue(issues, 'engineering.required', 'engineeringValues', 'At least one verified engineering value is required.');
        }
        engineeringValues.forEach((value, index) => {
            if (!isUnknownRecord(value)
                || !readTrimmedString(value, ['key'])
                || !readTrimmedString(value, ['sourceDocumentId'])
                || !readTrimmedString(value, ['sourceRevision'])
                || !Array.isArray(value.applicableZones)
                || value.applicableZones.length === 0
                || value.verificationStatus === 'unverified') {
                pushIssue(issues, 'engineering.incomplete', `engineeringValues[${index}]`, 'Engineering source, revision, zones and review status must be complete.');
            }
        });
    }

    const equipmentPlan = plan.equipmentPlan;
    if (Array.isArray(equipmentPlan)) {
        const categories = new Set(['lifting', 'transport', 'work-at-height', 'assembly', 'measurement']);
        equipmentPlan.forEach((equipment, index) => {
            const path = `equipmentPlan[${index}]`;
            if (!isUnknownRecord(equipment)) {
                pushIssue(issues, 'equipment.shape', path, 'Equipment plan must be an object.');
                return;
            }
            const complete = Boolean(
                readTrimmedString(equipment, ['id'])
                && categories.has(readTrimmedString(equipment, ['category']) || '')
                && readTrimmedString(equipment, ['equipmentName'])
                && Array.isArray(equipment.workZones)
                && equipment.workZones.some((value) => typeof value === 'string' && value.trim())
                && Array.isArray(equipment.plannedStages)
                && equipment.plannedStages.some((value) => typeof value === 'string' && value.trim())
                && Array.isArray(equipment.controlMeasures)
                && equipment.controlMeasures.some((value) => typeof value === 'string' && value.trim())
            );
            if (!complete) {
                pushIssue(issues, 'equipment.incomplete', path, 'Equipment id, category, name, work zones, planned stages and control measures are required.');
            }
        });
        const liftingEquipment = equipmentPlan.filter((item) => isUnknownRecord(item) && item.category === 'lifting');
        if (liftingEquipment.length === 0) {
            pushIssue(issues, 'equipment.lifting_required', 'equipmentPlan', 'At least one lifting equipment plan is required.');
        }
        liftingEquipment.forEach((equipment, index) => {
            const expiry = readTrimmedString(equipment, ['inspectionValidUntil']);
            const expiryMillis = expiry ? Date.parse(expiry) : Number.NaN;
            if (!readTrimmedString(equipment, ['model'])
                || !readTrimmedString(equipment, ['ratedCapacity'])
                || !readTrimmedString(equipment, ['workRadius'])
                || !expiry
                || !Number.isFinite(expiryMillis)
                || expiryMillis < Date.now()) {
                pushIssue(issues, 'equipment.lifting_incomplete', `equipmentPlan.lifting[${index}]`, 'Lifting model, capacity, radius and valid inspection date are required.');
            }
        });
    }

    const draftMarker = findDraftMarker(plan, '', new Set<object>());
    if (draftMarker) pushIssue(issues, 'content.draft_marker', draftMarker, 'Placeholder or example marker remains in release content.');
};

const validateDrawings = (plan: UnknownRecord, issues: ConstructionPlanValidationIssue[]): void => {
    if (!Array.isArray(plan.drawings) || !Array.isArray(plan.drawingApplicability)) return;
    const drawings = new Map<string, UnknownRecord>();
    plan.drawings.forEach((drawing, index) => {
        if (!isUnknownRecord(drawing)) {
            pushIssue(issues, 'drawing.shape', `drawings[${index}]`, 'Drawing must be an object.');
            return;
        }
        const id = readTrimmedString(drawing, ['id']);
        if (!id) pushIssue(issues, 'drawing.id', `drawings[${index}].id`, 'Drawing id is required.');
        else if (drawings.has(id)) pushIssue(issues, 'drawing.duplicate', `drawings[${index}].id`, `Duplicate drawing id: ${id}.`);
        else drawings.set(id, drawing);
    });
    const activeDrawings = Array.from(drawings.entries())
        .filter(([, drawing]) => drawing.approvalStatus !== 'superseded');
    if (activeDrawings.length === 0) {
        pushIssue(issues, 'drawing.required', 'drawings', 'At least one active site drawing is required.');
    }
    let hasInstallAnnotation = false;
    let hasDismantleOrRetainAnnotation = false;
    activeDrawings.forEach(([id, drawing]) => {
        if (drawing.approvalStatus !== 'approved' || !readTrimmedString(drawing, ['approvalReference'])) {
            pushIssue(issues, 'drawing.not_approved', `drawings.${id}`, 'Every active drawing must be approved with an approval reference.');
        }
        if (drawing.previewStatus !== 'ready') {
            pushIssue(issues, 'drawing.preview', `drawings.${id}.previewStatus`, 'Every active drawing preview must be ready.');
        }
        if (!readTrimmedString(drawing, ['drawingNo'])
            || !readTrimmedString(drawing, ['revision'])
            || !Array.isArray(drawing.applicableZones)
            || drawing.applicableZones.length === 0) {
            pushIssue(issues, 'drawing.metadata', `drawings.${id}`, 'Drawing number, revision and applicable zones are required.');
        }
        if (Array.isArray(drawing.annotations)) {
            drawing.annotations.forEach((annotation, annotationIndex) => {
                if (!isUnknownRecord(annotation)) return;
                if (annotation.layer === 'install') hasInstallAnnotation = true;
                if (annotation.layer === 'dismantle' || annotation.layer === 'retain') hasDismantleOrRetainAnnotation = true;
                const contractIssues = constructionPlanDrawingAnnotationLayerContractIssues(annotation);
                if (contractIssues.length > 0) {
                    pushIssue(
                        issues,
                        'drawing.annotation_contract',
                        `drawings.${id}.annotations[${annotationIndex}]`,
                        `Drawing annotation layer contract is incomplete: ${contractIssues.join(', ')}.`,
                    );
                }
            });
        }
    });
    if (!hasInstallAnnotation) {
        pushIssue(issues, 'drawing.install_annotation', 'drawings.annotations', 'At least one installation-zone annotation is required.');
    }
    if (!hasDismantleOrRetainAnnotation) {
        pushIssue(issues, 'drawing.dismantle_annotation', 'drawings.annotations', 'At least one dismantle or retain-zone annotation is required.');
    }

    const decisions = new Map<string, UnknownRecord>();
    plan.drawingApplicability.forEach((decision, index) => {
        if (!isUnknownRecord(decision)) {
            pushIssue(issues, 'drawing_decision.shape', `drawingApplicability[${index}]`, 'Drawing applicability must be an object.');
            return;
        }
        const slot = readTrimmedString(decision, ['drawingSlot']);
        if (!slot || !DRAWING_SLOTS.includes(slot as typeof DRAWING_SLOTS[number])) {
            pushIssue(issues, 'drawing_decision.slot', `drawingApplicability[${index}].drawingSlot`, 'Unknown drawing slot.');
            return;
        }
        if (decisions.has(slot)) pushIssue(issues, 'drawing_decision.duplicate', `drawingApplicability[${index}].drawingSlot`, `Duplicate decision for ${slot}.`);
        decisions.set(slot, decision);
    });

    DRAWING_SLOTS.forEach((slot) => {
        const decision = decisions.get(slot);
        if (!decision) {
            pushIssue(issues, 'drawing_decision.missing', `drawingApplicability.${slot}`, `Applicability decision for ${slot} is required.`);
            return;
        }
        const decisionValue = readTrimmedString(decision, ['decision']);
        if (decisionValue === 'not_applicable') {
            const reason = readTrimmedString(decision, ['reason']);
            if (!reason || reason.length < 10 || !readTrimmedString(decision, ['reviewedBy'])) {
                pushIssue(issues, 'drawing_decision.na_evidence', `drawingApplicability.${slot}`, 'Not-applicable drawing requires a detailed reason and reviewer.');
            }
            return;
        }
        if (!['applicable', 'replacement'].includes(decisionValue || '')) {
            pushIssue(issues, 'drawing_decision.value', `drawingApplicability.${slot}.decision`, 'Drawing decision is invalid.');
            return;
        }
        if (decisionValue === 'replacement' && !readTrimmedString(decision, ['technicalReviewReference'])) {
            pushIssue(issues, 'drawing_decision.replacement_evidence', `drawingApplicability.${slot}.technicalReviewReference`, 'Replacement drawing requires a technical review reference.');
        }
        const drawingId = readTrimmedString(decision, ['drawingId']);
        const drawing = drawingId ? drawings.get(drawingId) : undefined;
        if (!drawing) {
            pushIssue(issues, 'drawing_decision.reference', `drawingApplicability.${slot}.drawingId`, 'Applicable drawing must reference an uploaded drawing.');
            return;
        }
        if (drawing.approvalStatus !== 'approved' || !readTrimmedString(drawing, ['approvalReference'])) {
            pushIssue(issues, 'drawing.not_approved', `drawings.${drawingId}`, 'Released drawing must be approved with an approval reference.');
        }
        if (drawing.previewStatus !== 'ready') {
            pushIssue(issues, 'drawing.preview', `drawings.${drawingId}.previewStatus`, 'Released drawing preview must be ready.');
        }
    });

    drawings.forEach((drawing, id) => {
        if (drawing.approvalStatus === 'example') {
            pushIssue(issues, 'drawing.example', `drawings.${id}.approvalStatus`, 'Example drawings cannot be released.');
        }
    });
};

export const validateConstructionPlanForRelease = (rawPlan: unknown): ConstructionPlanValidationResult => {
    const issues: ConstructionPlanValidationIssue[] = [];
    if (!isUnknownRecord(rawPlan)) {
        return { valid: false, issues: [{ code: 'plan.shape', path: '', message: 'Construction plan must be an object.' }] };
    }
    validateTemplateInvariant(rawPlan, issues);
    validateRequiredContent(rawPlan, issues);
    validateDrawings(rawPlan, issues);
    return { valid: issues.length === 0, issues };
};

interface FirestoreTimestampLike {
    toDate: () => Date;
}

const isTimestampLike = (value: unknown): value is FirestoreTimestampLike =>
    isUnknownRecord(value) && typeof value.toDate === 'function';

const normalizeCanonicalValue = (value: unknown, seen: Set<object>): unknown => {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) throw new TypeError('Canonical JSON cannot contain a non-finite number.');
        return value;
    }
    if (value instanceof Date) return value.toISOString();
    if (isTimestampLike(value)) return value.toDate().toISOString();
    if (Array.isArray(value)) {
        if (seen.has(value)) throw new TypeError('Canonical JSON cannot contain a cycle.');
        seen.add(value);
        const result = value.map((entry) => normalizeCanonicalValue(entry, seen));
        seen.delete(value);
        return result;
    }
    if (!isUnknownRecord(value)) {
        if (value === undefined) return undefined;
        throw new TypeError(`Unsupported canonical JSON value: ${typeof value}.`);
    }
    if (seen.has(value)) throw new TypeError('Canonical JSON cannot contain a cycle.');
    seen.add(value);
    const result: UnknownRecord = {};
    Object.keys(value).sort().forEach((key) => {
        const normalized = normalizeCanonicalValue(value[key], seen);
        if (normalized !== undefined) result[key] = normalized;
    });
    seen.delete(value);
    return result;
};

export const canonicalStringify = (value: unknown): string =>
    JSON.stringify(normalizeCanonicalValue(value, new Set<object>()));

export const sha256Hex = (value: Buffer | string): string =>
    createHash('sha256').update(value).digest('hex');

const snapshotSectionsWithoutDrawingStudioCache = (rawSections: unknown): unknown => {
    if (!Array.isArray(rawSections)) return rawSections;
    return rawSections.map((rawSection) => {
        if (!isUnknownRecord(rawSection) || !isUnknownRecord(rawSection.content)) return rawSection;
        const { drawingStudio: _drawingStudio, ...content } = rawSection.content;
        return { ...rawSection, content };
    });
};

export const buildApprovedSnapshotContent = (planId: string, rawPlan: unknown): UnknownRecord => {
    if (!isUnknownRecord(rawPlan)) throw new TypeError('Construction plan must be an object.');
    const content: UnknownRecord = { planId, snapshotSchemaVersion: CONSTRUCTION_PLAN_SNAPSHOT_SCHEMA_VERSION };
    SNAPSHOT_CONTENT_KEYS.forEach((key) => {
        if (rawPlan[key] === undefined) return;
        if (key === 'sections') {
            content[key] = snapshotSectionsWithoutDrawingStudioCache(rawPlan[key]);
            return;
        }
        if (key === 'erpSnapshot') {
            content[key] = sanitizeConstructionPlanErpSnapshot(
                rawPlan[key],
                readTrimmedString(rawPlan, ['createdAt']) || '2000-01-01T00:00:00.000Z',
            );
            return;
        }
        content[key] = rawPlan[key];
    });
    return normalizeCanonicalValue(content, new Set<object>()) as UnknownRecord;
};

export const buildConstructionPlanReviewSnapshotContent = (
    planId: string,
    rawPlan: unknown,
    planLockVersion: number,
): UnknownRecord => {
    if (!Number.isInteger(planLockVersion) || planLockVersion < 0) {
        throw new TypeError('Construction plan review snapshot lock version must be non-negative.');
    }
    // Lock/round/ACL evidence is deliberately kept in Firestore metadata. The
    // immutable blob contains only renderer input so identical document
    // content reuses the same content-addressed object across review rounds.
    return normalizeCanonicalValue({
        snapshotSchemaVersion: CONSTRUCTION_PLAN_SNAPSHOT_SCHEMA_VERSION,
        kind: 'review_submission',
        planId,
        content: buildApprovedSnapshotContent(planId, rawPlan),
    }, new Set<object>()) as UnknownRecord;
};

const REVIEW_DIFF_MAX_ENTITY_COUNT = 1_000;
const REVIEW_DIFF_MAX_FLAT_NODES = 8_000;
const REVIEW_DIFF_MAX_CHANGE_COUNT = 800;
const REVIEW_DIFF_MAX_SUMMARY_BYTES = 180_000;
const REVIEW_DIFF_MAX_FIELD_VALUE_CHARS = 800;
const REVIEW_DIFF_MAX_TEXT_VALUE_CHARS = 6_000;
const REVIEW_DIFF_MAX_TEXT_SEGMENTS = 320;

export interface ConstructionPlanReviewDiffOptions {
    baselineKind?: 'previous_submission' | 'prior_issued' | 'empty';
    baselineContentHash?: string;
    currentContentHash?: string;
}

interface ReviewDiffSectionContext {
    sectionId?: string;
    sectionLabel?: string;
    pageNumbers: number[];
}

interface ReviewDiffDisplayValue {
    value: string;
    truncated: boolean;
}

const reviewDiffHash = (value: unknown): string => sha256Hex(canonicalStringify(value));

const boundedReviewDiffIdentifier = (raw: string, prefix: string): string => {
    const normalized = raw.trim().normalize('NFC');
    if (normalized.length > 0
        && normalized.length <= 200
        && !/(?:https?:\/\/|gs:\/\/|data:|[@/?#\\])/iu.test(normalized)) return normalized;
    return `${prefix}-${sha256Hex(normalized).slice(0, 16)}`;
};

const reviewDiffPointerSegment = (raw: string): string => raw.replace(/~/g, '~0').replace(/\//g, '~1');

const reviewDiffRedactText = (raw: string): string => raw.normalize('NFC')
    .replace(/\b(?:https?|ftp|gs):\/\/[^\s<>"']+/giu, '[링크 숨김]')
    .replace(/\bdata:[^\s<>"']+/giu, '[데이터 링크 숨김]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu, '[이메일 숨김]')
    .replace(/(?<!\d)(?:\+?82[-.\s]?)?0(?:1[016789]|2|[3-6][1-5])[-.\s]?\d{3,4}[-.\s]?\d{4}(?!\d)/gu, '[연락처 숨김]')
    .replace(/\b(?:bearer\s+)[A-Z0-9._~+/=-]+/giu, 'Bearer [보안 값 숨김]')
    .replace(/([?&](?:token|key|secret|signature|credential|alt)=)[^&\s]+/giu, '$1[보안 값 숨김]');

const reviewDiffProtectedPath = (path: string): boolean => (
    /(?:password|secret|token|credential|downloadUrl|storagePath|previewPath|originalFileName|phone|email|resident|bank|accountNumber)/iu.test(path)
    || /\/(?:createdBy|updatedBy|uploadedBy|operatorWorkerId|signalerWorkerId|responsibleWorkerId|workerId)$/iu.test(path)
    || /\/organizationSnapshot\/.*\/(?:id|name|workerId)$/iu.test(path)
    || /\/projectSnapshot\/address$/iu.test(path)
);

const reviewDiffCompactHash = (raw: string): string => raw.length >= 32
    && /^[a-f0-9]+$/iu.test(raw)
    ? `${raw.slice(0, 8)}…${raw.slice(-6)}`
    : raw;

const reviewDiffDisplayValue = (
    raw: unknown,
    path: string,
    maximum: number,
): ReviewDiffDisplayValue => {
    if (reviewDiffProtectedPath(path)) {
        return { value: raw === undefined || raw === null || raw === '' ? '없음' : '[보호 정보]', truncated: false };
    }
    let serialized: string;
    if (typeof raw === 'string') serialized = reviewDiffCompactHash(raw);
    else if (raw === undefined || raw === null) serialized = '없음';
    else if (typeof raw === 'number' || typeof raw === 'boolean') serialized = String(raw);
    else serialized = canonicalStringify(raw);
    const safe = reviewDiffRedactText(serialized).replace(/\s+$/u, '');
    if (safe.length <= maximum) return { value: safe, truncated: false };
    return { value: `${safe.slice(0, maximum - 1)}…`, truncated: true };
};

const reviewDiffPageNumbers = (raw: unknown): number[] => Array.isArray(raw)
    ? Array.from(new Set(raw.filter((value): value is number => (
        Number.isInteger(value) && value >= 1 && value <= CONSTRUCTION_PLAN_MAX_PHYSICAL_PAGE_COUNT
    )))).sort((left, right) => left - right)
    : [];

const REVIEW_DIFF_FIELD_LABELS: Readonly<Record<string, string>> = {
    title: '문서 제목',
    tradeType: '계획서 종류',
    documentNo: '문서 번호',
    documentDate: '문서 일자',
    revision: '문서 버전',
    revisionReason: '개정 사유',
    revisionType: '개정 유형',
    templateId: '표준 템플릿',
    templateVersion: '템플릿 버전',
    projectSnapshot: '현장 정보',
    organizationSnapshot: '조직·작업자 정보',
    engineeringValues: '구조 검토값',
    equipmentPlan: '장비 사용계획',
    riskAssessments: '위험성 평가',
    standardTextCurrent: '표준 시공문구',
    standardTextVersion: '표준문구 버전',
    standardTextModified: '표준문구 수정 여부',
    standardTextModificationReason: '표준문구 변경 사유',
    status: '작성 상태',
    notApplicableReason: '해당없음 사유',
    value: '입력값',
    unit: '단위',
    equipmentName: '장비명',
    workZones: '작업구간',
    plannedStages: '작업단계',
    controlMeasures: '통제대책',
    hazard: '유해·위험요인',
    mitigationMeasures: '감소대책',
    verificationStatus: '검토 상태',
    approvalStatus: '승인 상태',
    approvalReference: '승인 근거',
    drawingApplicability: '도면 적용 결정',
    sectionOrder: '문서 구성 순서',
};

const reviewDiffHumanizeKey = (key: string): string => REVIEW_DIFF_FIELD_LABELS[key]
    || key
        .replace(/^@[^/]+$/u, '항목')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[_-]+/g, ' ')
        .trim();

const reviewDiffLabelForPath = (path: string): string => {
    const segments = path.split('/').filter(Boolean)
        .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'));
    const key = [...segments].reverse().find((segment) => !segment.startsWith('@')) || '변경 항목';
    return reviewDiffHumanizeKey(key).slice(0, 200);
};

const strictSnapshotEntityMap = (raw: unknown, entityKind: string): Map<string, UnknownRecord> => {
    if (raw === undefined || raw === null) return new Map();
    if (!Array.isArray(raw) || raw.length > REVIEW_DIFF_MAX_ENTITY_COUNT) {
        throw new TypeError(`construction-plan-review-diff-${entityKind}-collection-invalid`);
    }
    const result = new Map<string, UnknownRecord>();
    raw.forEach((entry) => {
        if (!isUnknownRecord(entry)) throw new TypeError(`construction-plan-review-diff-${entityKind}-invalid`);
        const sourceId = readTrimmedString(entry, ['id', 'key']);
        if (!sourceId) throw new TypeError(`construction-plan-review-diff-${entityKind}-id-missing`);
        const id = boundedReviewDiffIdentifier(sourceId, entityKind);
        if (result.has(id)) throw new TypeError(`construction-plan-review-diff-${entityKind}-id-duplicate`);
        result.set(id, entry);
    });
    return result;
};

const changedSnapshotEntityIds = (previous: unknown, current: unknown, entityKind: string): string[] => {
    const before = strictSnapshotEntityMap(previous, entityKind);
    const after = strictSnapshotEntityMap(current, entityKind);
    return Array.from(new Set([...before.keys(), ...after.keys()]))
        .filter((id) => canonicalStringify(before.get(id)) !== canonicalStringify(after.get(id)))
        .sort();
};

const reviewDiffArrayEntityId = (value: unknown): string | undefined => {
    if (!isUnknownRecord(value)) return undefined;
    return readTrimmedString(value, ['id', 'key']) || undefined;
};

const flattenReviewDiffValue = (
    value: unknown,
    path: string,
    output: Map<string, unknown>,
    state: { nodes: number },
    depth = 0,
): void => {
    state.nodes += 1;
    if (state.nodes > REVIEW_DIFF_MAX_FLAT_NODES || depth > 12) {
        throw new RangeError('construction-plan-review-diff-content-too-complex');
    }
    if (Array.isArray(value)) {
        const identifiers = value.map(reviewDiffArrayEntityId);
        if (value.length > 0 && identifiers.every((id): id is string => Boolean(id))) {
            const entries = value.map((entry, index) => ({ entry, id: identifiers[index] }))
                .sort((left, right) => left.id.localeCompare(right.id));
            const seen = new Set<string>();
            entries.forEach(({ entry, id }) => {
                const stableId = `id-${sha256Hex(id).slice(0, 12)}`;
                if (seen.has(stableId)) throw new TypeError('construction-plan-review-diff-array-id-duplicate');
                seen.add(stableId);
                flattenReviewDiffValue(entry, `${path}/@${stableId}`, output, state, depth + 1);
            });
            return;
        }
        output.set(path, value);
        return;
    }
    if (isUnknownRecord(value)) {
        const keys = Object.keys(value).sort();
        if (keys.length === 0) {
            output.set(path, value);
            return;
        }
        keys.forEach((key) => flattenReviewDiffValue(
            value[key],
            `${path}/${reviewDiffPointerSegment(key)}`,
            output,
            state,
            depth + 1,
        ));
        return;
    }
    output.set(path, value);
};

const reviewDiffNarrativePath = (path: string, previous: unknown, current: unknown): boolean => {
    if (typeof previous !== 'string' && typeof current !== 'string') return false;
    const key = path.split('/').pop() || '';
    return /(?:standardTextCurrent|bodyText|generalText|customText|description|reason|notes?|summary|procedure|method|measures?|criteria|hazard|activity|content)$/iu.test(key)
        || Math.max(typeof previous === 'string' ? previous.length : 0, typeof current === 'string' ? current.length : 0) >= 160;
};

const reviewDiffChangeType = (before: unknown, after: unknown): ConstructionPlanReviewDiffChangeType => (
    before === undefined ? 'added' : after === undefined ? 'deleted' : 'changed'
);

const tokenizeReviewDiffText = (text: string): string[] => text.match(/\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu) || [];

const mergeReviewDiffSegments = (
    segments: ConstructionPlanReviewTextDiffSegment[],
): ConstructionPlanReviewTextDiffSegment[] => segments.reduce<ConstructionPlanReviewTextDiffSegment[]>((result, segment) => {
    if (!segment.text) return result;
    const previous = result[result.length - 1];
    if (previous?.kind === segment.kind) previous.text += segment.text;
    else result.push({ ...segment });
    return result;
}, []);

const boundedPrefixSuffixTextDiff = (
    beforeTokens: string[],
    afterTokens: string[],
): ConstructionPlanReviewTextDiffSegment[] => {
    let prefix = 0;
    while (prefix < beforeTokens.length
        && prefix < afterTokens.length
        && beforeTokens[prefix] === afterTokens[prefix]) prefix += 1;
    let suffix = 0;
    while (suffix < beforeTokens.length - prefix
        && suffix < afterTokens.length - prefix
        && beforeTokens[beforeTokens.length - 1 - suffix] === afterTokens[afterTokens.length - 1 - suffix]) suffix += 1;
    return mergeReviewDiffSegments([
        { kind: 'equal', text: beforeTokens.slice(0, prefix).join('') },
        { kind: 'removed', text: beforeTokens.slice(prefix, beforeTokens.length - suffix).join('') },
        { kind: 'added', text: afterTokens.slice(prefix, afterTokens.length - suffix).join('') },
        { kind: 'equal', text: suffix ? beforeTokens.slice(beforeTokens.length - suffix).join('') : '' },
    ]);
};

const reviewDiffTextSegments = (before: string, after: string): ConstructionPlanReviewTextDiffSegment[] => {
    const beforeTokens = tokenizeReviewDiffText(before);
    const afterTokens = tokenizeReviewDiffText(after);
    if (beforeTokens.length * afterTokens.length > 90_000) {
        return boundedPrefixSuffixTextDiff(beforeTokens, afterTokens);
    }
    const columns = afterTokens.length + 1;
    const table = new Uint16Array((beforeTokens.length + 1) * columns);
    for (let left = beforeTokens.length - 1; left >= 0; left -= 1) {
        for (let right = afterTokens.length - 1; right >= 0; right -= 1) {
            const offset = left * columns + right;
            table[offset] = beforeTokens[left] === afterTokens[right]
                ? table[(left + 1) * columns + right + 1] + 1
                : Math.max(table[(left + 1) * columns + right], table[left * columns + right + 1]);
        }
    }
    const segments: ConstructionPlanReviewTextDiffSegment[] = [];
    let left = 0;
    let right = 0;
    while (left < beforeTokens.length || right < afterTokens.length) {
        if (left < beforeTokens.length && right < afterTokens.length && beforeTokens[left] === afterTokens[right]) {
            segments.push({ kind: 'equal', text: beforeTokens[left] });
            left += 1;
            right += 1;
        } else if (right < afterTokens.length
            && (left >= beforeTokens.length
                || table[left * columns + right + 1] >= table[(left + 1) * columns + right])) {
            segments.push({ kind: 'added', text: afterTokens[right] });
            right += 1;
        } else {
            segments.push({ kind: 'removed', text: beforeTokens[left] });
            left += 1;
        }
    }
    const merged = mergeReviewDiffSegments(segments);
    return merged.length <= REVIEW_DIFF_MAX_TEXT_SEGMENTS
        ? merged
        : boundedPrefixSuffixTextDiff(beforeTokens, afterTokens);
};

const createReviewDiffTextChange = (
    path: string,
    beforeRaw: unknown,
    afterRaw: unknown,
    context: ReviewDiffSectionContext,
): ConstructionPlanReviewTextChange => {
    const before = beforeRaw === undefined
        ? undefined
        : reviewDiffDisplayValue(beforeRaw, path, REVIEW_DIFF_MAX_TEXT_VALUE_CHARS);
    const after = afterRaw === undefined
        ? undefined
        : reviewDiffDisplayValue(afterRaw, path, REVIEW_DIFF_MAX_TEXT_VALUE_CHARS);
    let beforeText = before?.value || '';
    let afterText = after?.value || '';
    if (beforeRaw !== undefined && afterRaw !== undefined
        && beforeText === afterText && reviewDiffHash(beforeRaw) !== reviewDiffHash(afterRaw)) {
        afterText = `${afterText || '[보호 정보]'} (보호 정보 변경됨)`;
    }
    return {
        id: `text-${sha256Hex(path).slice(0, 24)}`,
        changeType: reviewDiffChangeType(beforeRaw, afterRaw),
        path: path.slice(0, 500),
        label: reviewDiffLabelForPath(path),
        ...(context.sectionId ? { sectionId: context.sectionId } : {}),
        ...(context.sectionLabel ? { sectionLabel: context.sectionLabel } : {}),
        pageNumbers: context.pageNumbers,
        ...(beforeRaw !== undefined ? { before: beforeText, beforeHash: reviewDiffHash(beforeRaw) } : {}),
        ...(afterRaw !== undefined ? { after: afterText, afterHash: reviewDiffHash(afterRaw) } : {}),
        segments: reviewDiffTextSegments(beforeText, afterText),
        valueTruncated: Boolean(before?.truncated || after?.truncated),
    };
};

const createReviewDiffFieldChange = (
    path: string,
    beforeRaw: unknown,
    afterRaw: unknown,
    context: ReviewDiffSectionContext,
    entityKind: 'section' | 'field' = 'field',
    explicitLabel?: string,
): ConstructionPlanReviewFieldChange => {
    const before = beforeRaw === undefined
        ? undefined
        : reviewDiffDisplayValue(beforeRaw, path, REVIEW_DIFF_MAX_FIELD_VALUE_CHARS);
    const after = afterRaw === undefined
        ? undefined
        : reviewDiffDisplayValue(afterRaw, path, REVIEW_DIFF_MAX_FIELD_VALUE_CHARS);
    let afterValue = after?.value;
    if (beforeRaw !== undefined && afterRaw !== undefined
        && before?.value === after?.value && reviewDiffHash(beforeRaw) !== reviewDiffHash(afterRaw)) {
        afterValue = `${after?.value || '[보호 정보]'} (변경됨)`;
    }
    return {
        id: `${entityKind}-${sha256Hex(path).slice(0, 24)}`,
        entityKind,
        changeType: reviewDiffChangeType(beforeRaw, afterRaw),
        path: path.slice(0, 500),
        label: (explicitLabel || reviewDiffLabelForPath(path)).slice(0, 200),
        ...(context.sectionId ? { sectionId: context.sectionId } : {}),
        ...(context.sectionLabel ? { sectionLabel: context.sectionLabel } : {}),
        pageNumbers: context.pageNumbers,
        ...(beforeRaw !== undefined ? { before: before?.value, beforeHash: reviewDiffHash(beforeRaw) } : {}),
        ...(afterRaw !== undefined ? { after: afterValue, afterHash: reviewDiffHash(afterRaw) } : {}),
        valueTruncated: Boolean(before?.truncated || after?.truncated),
    };
};

const appendReviewDiffLeafChanges = (
    beforeRaw: unknown,
    afterRaw: unknown,
    rootPath: string,
    context: ReviewDiffSectionContext,
    textChanges: ConstructionPlanReviewTextChange[],
    fieldChanges: ConstructionPlanReviewFieldChange[],
): void => {
    const before = new Map<string, unknown>();
    const after = new Map<string, unknown>();
    flattenReviewDiffValue(beforeRaw, rootPath, before, { nodes: 0 });
    flattenReviewDiffValue(afterRaw, rootPath, after, { nodes: 0 });
    Array.from(new Set([...before.keys(), ...after.keys()])).sort().forEach((path) => {
        const previousValue = before.get(path);
        const currentValue = after.get(path);
        if (canonicalStringify(previousValue) === canonicalStringify(currentValue)) return;
        if (reviewDiffNarrativePath(path, previousValue, currentValue)) {
            textChanges.push(createReviewDiffTextChange(path, previousValue, currentValue, context));
        } else {
            fieldChanges.push(createReviewDiffFieldChange(path, previousValue, currentValue, context));
        }
    });
};

const reviewDiffSectionContext = (
    before: UnknownRecord | undefined,
    after: UnknownRecord | undefined,
    sectionId: string,
): ReviewDiffSectionContext => {
    const source = after || before || {};
    const rawLabel = readTrimmedString(source, ['title']) || sectionId;
    return {
        sectionId,
        sectionLabel: reviewDiffRedactText(rawLabel).slice(0, 200),
        pageNumbers: reviewDiffPageNumbers(source.pageNumbers),
    };
};

const reviewDiffDrawingLabel = (drawing: UnknownRecord | undefined, drawingId: string): string => {
    const raw = drawing
        ? readTrimmedString(drawing, ['title', 'drawingNo']) || drawingId
        : drawingId;
    return reviewDiffRedactText(raw).slice(0, 200);
};

const REVIEW_DIFF_DRAWING_FIELD_LABELS: Readonly<Record<string, string>> = {
    drawingNo: '도면번호', title: '도면명', revision: '도면 Rev.', approvalStatus: '승인상태',
    approvalReference: '승인근거', building: '동', floor: '층', zone: '구간', applicableZones: '적용구간',
    scaleText: '축척', pageCount: '페이지 수', pages: '페이지 바인딩', mimeType: '파일 형식',
    sourceSha256: '원본 무결성', sourceGeneration: '원본 세대', sourceRevision: '원본 개정',
    previewStatus: '미리보기 상태', previewPaths: '미리보기 바인딩',
};

const reviewDiffDrawingSummary = (drawing: UnknownRecord): string => {
    const drawingNo = reviewDiffRedactText(readTrimmedString(drawing, ['drawingNo']) || '미지정').slice(0, 60);
    const title = reviewDiffRedactText(readTrimmedString(drawing, ['title']) || '제목 없음').slice(0, 100);
    const revision = reviewDiffRedactText(readTrimmedString(drawing, ['revision']) || '-').slice(0, 30);
    const approvalStatus = reviewDiffRedactText(readTrimmedString(drawing, ['approvalStatus']) || '미지정').slice(0, 40);
    const pageCount = Number.isInteger(drawing.pageCount) ? Number(drawing.pageCount) : 0;
    return `도면 ${drawingNo} · ${title} · Rev.${revision} · ${approvalStatus} · ${pageCount}쪽`;
};

const reviewDiffDrawingPageNumbers = (drawing: UnknownRecord | undefined): number[] => {
    if (!drawing) return [];
    const pages = Array.isArray(drawing.pages)
        ? drawing.pages.map((page) => {
            if (!isUnknownRecord(page) || !Number.isInteger(page.pageIndex)
                || Number(page.pageIndex) < 0 || Number(page.pageIndex) >= 50) {
                throw new TypeError('construction-plan-review-diff-drawing-page-invalid');
            }
            return Number(page.pageIndex) + 1;
        })
        : [];
    if (pages.length > 0) return Array.from(new Set(pages)).sort((left, right) => left - right);
    const count = Number.isInteger(drawing.pageCount) ? Math.min(Number(drawing.pageCount), 50) : 0;
    return Array.from({ length: count }, (_entry, index) => index + 1);
};

const drawingWithoutAnnotations = (drawing: UnknownRecord): UnknownRecord => {
    const { annotations: _annotations, storagePath: _storagePath, originalFileName: _fileName, ...metadata } = drawing;
    return metadata;
};

const reviewDiffDrawingChangedFields = (
    before: UnknownRecord | undefined,
    after: UnknownRecord | undefined,
): string[] => {
    if (!before || !after) return ['도면 전체'];
    const beforeMetadata = drawingWithoutAnnotations(before);
    const afterMetadata = drawingWithoutAnnotations(after);
    const fields = Array.from(new Set([...Object.keys(beforeMetadata), ...Object.keys(afterMetadata)]))
        .filter((key) => canonicalStringify(beforeMetadata[key]) !== canonicalStringify(afterMetadata[key]))
        .map((key) => REVIEW_DIFF_DRAWING_FIELD_LABELS[key] || reviewDiffHumanizeKey(key));
    if (before.storagePath !== after.storagePath || before.originalFileName !== after.originalFileName) {
        fields.push('원본 파일 바인딩');
    }
    if (canonicalStringify(before.annotations) !== canonicalStringify(after.annotations)) fields.push('주석');
    return Array.from(new Set(fields)).sort();
};

const createReviewDiffDrawingChange = (
    drawingId: string,
    before: UnknownRecord | undefined,
    after: UnknownRecord | undefined,
): ConstructionPlanReviewDrawingChange => {
    const source = after || before;
    if (!source) throw new TypeError('construction-plan-review-diff-drawing-missing');
    return {
        id: `drawing-${sha256Hex(drawingId).slice(0, 24)}`,
        changeType: reviewDiffChangeType(before, after),
        drawingId,
        drawingLabel: reviewDiffDrawingLabel(source, drawingId),
        pageNumbers: reviewDiffDrawingPageNumbers(source),
        changedFields: reviewDiffDrawingChangedFields(before, after),
        ...(before ? { beforeSummary: reviewDiffDrawingSummary(before), beforeHash: reviewDiffHash(before) } : {}),
        ...(after ? { afterSummary: reviewDiffDrawingSummary(after), afterHash: reviewDiffHash(after) } : {}),
    };
};

const reviewDiffAnnotationMap = (drawing: UnknownRecord | undefined): Map<string, UnknownRecord> => (
    strictSnapshotEntityMap(drawing?.annotations, 'annotation')
);

const reviewDiffNumber = (value: unknown): string => typeof value === 'number' && Number.isFinite(value)
    ? value.toFixed(3).replace(/0+$/u, '').replace(/\.$/u, '')
    : '-';

const reviewDiffGeometrySummary = (raw: unknown): string | undefined => {
    if (!isUnknownRecord(raw)) return undefined;
    const kind = readTrimmedString(raw, ['kind']) || 'geometry';
    if (kind === 'rect') return `사각형 · x ${reviewDiffNumber(raw.x)}, y ${reviewDiffNumber(raw.y)}, 폭 ${reviewDiffNumber(raw.w)}, 높이 ${reviewDiffNumber(raw.h)}, 회전 ${reviewDiffNumber(raw.rotationDeg)}°`;
    if (kind === 'ellipse') return `타원 · 중심 ${reviewDiffNumber(raw.cx)}, ${reviewDiffNumber(raw.cy)} · 반경 ${reviewDiffNumber(raw.rx)}, ${reviewDiffNumber(raw.ry)}`;
    if (kind === 'marker') return `표식 · x ${reviewDiffNumber(raw.x)}, y ${reviewDiffNumber(raw.y)} · ${reviewDiffRedactText(readTrimmedString(raw, ['markerType']) || '기본')}`;
    if (kind === 'text') return `텍스트 상자 · x ${reviewDiffNumber(raw.x)}, y ${reviewDiffNumber(raw.y)}, 폭 ${reviewDiffNumber(raw.w)}, 높이 ${reviewDiffNumber(raw.h)} · ${reviewDiffRedactText(readTrimmedString(raw, ['align']) || 'left')}`;
    const vertices = Array.isArray(raw.vertices) ? raw.vertices.length : 0;
    if (kind === 'polygon') return `다각형 · 꼭짓점 ${vertices}개`;
    if (kind === 'polyline') return `선 · 꼭짓점 ${vertices}개 · 시작화살표 ${raw.arrowStart === true ? '있음' : '없음'} · 끝화살표 ${raw.arrowEnd === true ? '있음' : '없음'}`;
    return reviewDiffRedactText(kind).slice(0, 200);
};

const reviewDiffStyleSummary = (raw: unknown): string | undefined => {
    if (!isUnknownRecord(raw)) return undefined;
    const stroke = reviewDiffRedactText(readTrimmedString(raw, ['strokeToken']) || '기본').slice(0, 50);
    const fill = reviewDiffRedactText(readTrimmedString(raw, ['fillToken']) || '없음').slice(0, 50);
    const dash = reviewDiffRedactText(readTrimmedString(raw, ['dash']) || 'solid').slice(0, 30);
    return `선 ${stroke} · 채움 ${fill} · 두께 ${reviewDiffNumber(raw.strokeWidthPt)}pt · 불투명도 ${reviewDiffNumber(raw.opacity)} · ${dash}`;
};

const reviewDiffAnnotationMetadataSummary = (raw: unknown): string | undefined => {
    if (!isUnknownRecord(raw)) return undefined;
    const items: string[] = [];
    const append = (label: string, key: string, protectedValue = false): void => {
        const value = raw[key];
        if (value === undefined || value === null || value === '') return;
        const display = protectedValue
            ? '지정됨'
            : reviewDiffDisplayValue(value, `/annotation/${key}`, 90).value;
        items.push(`${label} ${display}`);
    };
    append('라벨', 'label');
    if (Number.isInteger(raw.pageIndex) && Number(raw.pageIndex) >= 0 && Number(raw.pageIndex) < 50) {
        items.push(`페이지 ${Number(raw.pageIndex) + 1}쪽`);
    }
    const pageFingerprint = readTrimmedString(raw, ['pageFingerprint']);
    if (pageFingerprint) items.push(`페이지 ID ${sha256Hex(pageFingerprint).slice(0, 12)}`);
    append('구간유형', 'layer');
    append('구간코드', 'zoneCode');
    append('순서', 'sequence');
    append('시작일', 'startDate');
    append('종료일', 'endDate');
    append('해제조건', 'releaseCondition');
    append('장비종류', 'equipmentType');
    append('장비 ID', 'equipmentId');
    append('진입지점', 'entrance');
    append('도착지점', 'destination');
    append('작업반경', 'radius');
    append('담당자', 'responsibleWorkerId', true);
    append('담당역할', 'responsibleRole');
    append('자재종류', 'materialType');
    append('근거', 'reason');
    return items.length ? items.join(' · ').slice(0, 500) : undefined;
};

const reviewDiffAnnotationChangedParts = (
    before: UnknownRecord | undefined,
    after: UnknownRecord | undefined,
): ConstructionPlanReviewAnnotationChange['changedParts'] => {
    if (!before || !after) {
        const source = before || after || {};
        const parts: ConstructionPlanReviewAnnotationChange['changedParts'] = ['binding', 'layer', 'geometry', 'style', 'label'];
        if (source.zoneCode !== undefined) parts.push('zone');
        if (source.startDate !== undefined || source.endDate !== undefined) parts.push('schedule');
        if (source.equipmentType !== undefined || source.equipmentId !== undefined || source.radius !== undefined) parts.push('equipment');
        if (source.entrance !== undefined || source.destination !== undefined) parts.push('route');
        if (source.responsibleWorkerId !== undefined || source.responsibleRole !== undefined) parts.push('responsibility');
        if (source.materialType !== undefined) parts.push('material');
        if (source.releaseCondition !== undefined) parts.push('release');
        if (source.reason !== undefined || source.sequence !== undefined || source.locked !== undefined) parts.push('metadata');
        return parts;
    }
    const parts: ConstructionPlanReviewAnnotationChange['changedParts'] = [];
    if (before.pageIndex !== after.pageIndex || before.pageFingerprint !== after.pageFingerprint) parts.push('binding');
    if (before.layer !== after.layer) parts.push('layer');
    if (canonicalStringify(before.geometry) !== canonicalStringify(after.geometry)) parts.push('geometry');
    if (canonicalStringify(before.style) !== canonicalStringify(after.style)) parts.push('style');
    if (before.label !== after.label) parts.push('label');
    if (before.zoneCode !== after.zoneCode) parts.push('zone');
    if (before.startDate !== after.startDate || before.endDate !== after.endDate) parts.push('schedule');
    if (before.equipmentType !== after.equipmentType
        || before.equipmentId !== after.equipmentId
        || before.radius !== after.radius) parts.push('equipment');
    if (before.entrance !== after.entrance || before.destination !== after.destination) parts.push('route');
    if (before.responsibleWorkerId !== after.responsibleWorkerId
        || before.responsibleRole !== after.responsibleRole) parts.push('responsibility');
    if (before.materialType !== after.materialType) parts.push('material');
    if (before.releaseCondition !== after.releaseCondition) parts.push('release');
    const known = new Set([
        'id', 'pageIndex', 'pageFingerprint', 'layer', 'geometry', 'style', 'label', 'zoneCode',
        'startDate', 'endDate', 'reason', 'sequence', 'styleVersion', 'locked',
        'releaseCondition', 'equipmentType', 'equipmentId', 'entrance', 'destination', 'radius',
        'responsibleWorkerId', 'responsibleRole', 'materialType',
        'createdBy', 'createdAt', 'updatedBy', 'updatedAt',
    ]);
    const metadataKeys = ['reason', 'sequence', 'styleVersion', 'locked', 'createdBy', 'createdAt', 'updatedBy', 'updatedAt'];
    if (metadataKeys.some((key) => canonicalStringify(before[key]) !== canonicalStringify(after[key]))
        || Array.from(new Set([...Object.keys(before), ...Object.keys(after)]))
        .some((key) => !known.has(key) && canonicalStringify(before[key]) !== canonicalStringify(after[key]))) {
        parts.push('metadata');
    }
    return parts;
};

const reviewDiffPageIdentity = (
    annotation: UnknownRecord,
    drawing: UnknownRecord,
    drawingId: string,
): { pageIndex: number; pageId: string; pageLabel: string } => {
    const pageIndex = Number.isInteger(annotation.pageIndex) && Number(annotation.pageIndex) >= 0
        ? Number(annotation.pageIndex)
        : 0;
    if (pageIndex >= 50) throw new TypeError('construction-plan-review-diff-annotation-page-invalid');
    const page = Array.isArray(drawing.pages)
        ? drawing.pages.find((candidate) => isUnknownRecord(candidate) && candidate.pageIndex === pageIndex)
        : undefined;
    const fingerprint = readTrimmedString(annotation, ['pageFingerprint'])
        || (isUnknownRecord(page) ? readTrimmedString(page, ['pageFingerprint']) : '')
        || `${drawingId}:page:${pageIndex}`;
    return {
        pageIndex,
        pageId: `page-${pageIndex + 1}-${sha256Hex(fingerprint).slice(0, 12)}`,
        pageLabel: `${pageIndex + 1}쪽`,
    };
};

const createReviewDiffAnnotationChange = (
    drawingId: string,
    drawing: UnknownRecord,
    annotationId: string,
    before: UnknownRecord | undefined,
    after: UnknownRecord | undefined,
): ConstructionPlanReviewAnnotationChange => {
    const source = after || before;
    if (!source) throw new TypeError('construction-plan-review-diff-annotation-missing');
    const page = reviewDiffPageIdentity(source, drawing, drawingId);
    const rawLabel = readTrimmedString(source, ['label']) || readTrimmedString(source, ['layer']) || annotationId;
    return {
        id: `annotation-${sha256Hex(`${drawingId}:${annotationId}`).slice(0, 24)}`,
        changeType: reviewDiffChangeType(before, after),
        drawingId,
        drawingLabel: reviewDiffDrawingLabel(drawing, drawingId),
        annotationId,
        annotationLabel: reviewDiffRedactText(rawLabel).slice(0, 200),
        ...page,
        changedParts: reviewDiffAnnotationChangedParts(before, after),
        ...(before?.geometry ? { geometryBefore: reviewDiffGeometrySummary(before.geometry) } : {}),
        ...(after?.geometry ? { geometryAfter: reviewDiffGeometrySummary(after.geometry) } : {}),
        ...(before?.style ? { styleBefore: reviewDiffStyleSummary(before.style) } : {}),
        ...(after?.style ? { styleAfter: reviewDiffStyleSummary(after.style) } : {}),
        ...(reviewDiffAnnotationMetadataSummary(before) ? { metadataBefore: reviewDiffAnnotationMetadataSummary(before) } : {}),
        ...(reviewDiffAnnotationMetadataSummary(after) ? { metadataAfter: reviewDiffAnnotationMetadataSummary(after) } : {}),
        ...(before ? { beforeHash: reviewDiffHash(before) } : {}),
        ...(after ? { afterHash: reviewDiffHash(after) } : {}),
    };
};

const appendReviewDiffAnnotationChanges = (
    drawingId: string,
    beforeDrawing: UnknownRecord | undefined,
    afterDrawing: UnknownRecord | undefined,
    output: ConstructionPlanReviewAnnotationChange[],
): void => {
    const before = reviewDiffAnnotationMap(beforeDrawing);
    const after = reviewDiffAnnotationMap(afterDrawing);
    const drawing = afterDrawing || beforeDrawing;
    if (!drawing) return;
    Array.from(new Set([...before.keys(), ...after.keys()])).sort().forEach((annotationId) => {
        const previous = before.get(annotationId);
        const current = after.get(annotationId);
        if (canonicalStringify(previous) === canonicalStringify(current)) return;
        output.push(createReviewDiffAnnotationChange(drawingId, drawing, annotationId, previous, current));
    });
};

export const summarizeConstructionPlanReviewDiff = (
    previousSnapshot: unknown,
    currentSnapshot: unknown,
    options: ConstructionPlanReviewDiffOptions = {},
): ConstructionPlanReviewDiffSummary => {
    const previousEnvelope = isUnknownRecord(previousSnapshot) ? previousSnapshot : {};
    const currentEnvelope = isUnknownRecord(currentSnapshot) ? currentSnapshot : {};
    const previous = isUnknownRecord(previousEnvelope.content) ? previousEnvelope.content : {};
    const current = isUnknownRecord(currentEnvelope.content) ? currentEnvelope.content : {};
    const baselineKind = options.baselineKind
        || (Object.keys(previous).length ? 'previous_submission' : 'empty');
    const ignoredTopLevel = new Set(['sections', 'drawings', 'planId', 'snapshotSchemaVersion', 'createdBy', 'createdByName', 'createdAt']);
    const changedTopLevelFields = Array.from(new Set([
        ...Object.keys(previous),
        ...Object.keys(current),
    ]))
        .filter((key) => !ignoredTopLevel.has(key))
        .filter((key) => canonicalStringify(previous[key]) !== canonicalStringify(current[key]))
        .sort();
    const previousSections = strictSnapshotEntityMap(previous.sections, 'section');
    const currentSections = strictSnapshotEntityMap(current.sections, 'section');
    const changedSectionIds = changedSnapshotEntityIds(previous.sections, current.sections, 'section');
    const previousDrawings = strictSnapshotEntityMap(previous.drawings, 'drawing');
    const currentDrawings = strictSnapshotEntityMap(current.drawings, 'drawing');
    const addedDrawingIds = Array.from(currentDrawings.keys())
        .filter((id) => !previousDrawings.has(id))
        .sort();
    const removedDrawingIds = Array.from(previousDrawings.keys())
        .filter((id) => !currentDrawings.has(id))
        .sort();
    const changedDrawingIds = Array.from(currentDrawings.keys())
        .filter((id) => previousDrawings.has(id))
        .filter((id) => canonicalStringify(previousDrawings.get(id)) !== canonicalStringify(currentDrawings.get(id)))
        .sort();

    const textChanges: ConstructionPlanReviewTextChange[] = [];
    const fieldChanges: ConstructionPlanReviewFieldChange[] = [];
    const drawingChanges: ConstructionPlanReviewDrawingChange[] = [];
    const annotationChanges: ConstructionPlanReviewAnnotationChange[] = [];
    const planContext: ReviewDiffSectionContext = { pageNumbers: [] };

    changedTopLevelFields.forEach((key) => appendReviewDiffLeafChanges(
        previous[key],
        current[key],
        `/${reviewDiffPointerSegment(key)}`,
        planContext,
        textChanges,
        fieldChanges,
    ));

    changedSectionIds.forEach((sectionId) => {
        const before = previousSections.get(sectionId);
        const after = currentSections.get(sectionId);
        const context = reviewDiffSectionContext(before, after, sectionId);
        const sectionPath = `/sections/${reviewDiffPointerSegment(sectionId)}`;
        if (!before || !after) {
            fieldChanges.push(createReviewDiffFieldChange(
                sectionPath,
                before ? context.sectionLabel : undefined,
                after ? context.sectionLabel : undefined,
                context,
                'section',
                context.sectionLabel || sectionId,
            ));
            return;
        }
        const { id: _beforeId, ...beforeContent } = before;
        const { id: _afterId, ...afterContent } = after;
        appendReviewDiffLeafChanges(
            beforeContent,
            afterContent,
            sectionPath,
            context,
            textChanges,
            fieldChanges,
        );
    });

    Array.from(new Set([...addedDrawingIds, ...removedDrawingIds, ...changedDrawingIds])).sort().forEach((drawingId) => {
        const before = previousDrawings.get(drawingId);
        const after = currentDrawings.get(drawingId);
        drawingChanges.push(createReviewDiffDrawingChange(drawingId, before, after));
        appendReviewDiffAnnotationChanges(drawingId, before, after, annotationChanges);
    });

    textChanges.sort((left, right) => left.path.localeCompare(right.path));
    fieldChanges.sort((left, right) => left.path.localeCompare(right.path));
    drawingChanges.sort((left, right) => left.drawingId.localeCompare(right.drawingId));
    annotationChanges.sort((left, right) => (
        left.drawingId.localeCompare(right.drawingId)
        || left.pageIndex - right.pageIndex
        || left.annotationId.localeCompare(right.annotationId)
    ));
    const changeCount = textChanges.length + fieldChanges.length + drawingChanges.length + annotationChanges.length;
    if (changeCount > REVIEW_DIFF_MAX_CHANGE_COUNT) {
        throw new RangeError('construction-plan-review-diff-too-many-changes');
    }
    const summaryBody: Omit<ConstructionPlanReviewDiffSummary, 'summaryHash'> = {
        summaryVersion: 2,
        baselineKind,
        baselineContentHash: options.baselineContentHash || reviewDiffHash(previous),
        currentContentHash: options.currentContentHash || reviewDiffHash(current),
        changedTopLevelFields,
        changedSectionIds,
        changedDrawingIds,
        addedDrawingIds,
        removedDrawingIds,
        textChanges,
        fieldChanges,
        drawingChanges,
        annotationChanges,
        changeCount,
    };
    const canonicalBody = canonicalStringify(summaryBody);
    if (Buffer.byteLength(canonicalBody, 'utf8') > REVIEW_DIFF_MAX_SUMMARY_BYTES) {
        throw new RangeError('construction-plan-review-diff-summary-too-large');
    }
    return {
        ...summaryBody,
        summaryHash: sha256Hex(canonicalBody),
    };
};

export const emptyConstructionPlanReviewCommentSummary = (): ConstructionPlanReviewCommentSummary => ({
    totalOpen: 0,
    totalAddressed: 0,
    totalResolved: 0,
    requiredOpen: 0,
    requiredAddressed: 0,
    requiredResolved: 0,
    unresolvedRequired: 0,
});

export const isConstructionPlanRequiredCommentVisibilityAllowed = (
    required: boolean,
    visibility: string,
): boolean => !required || visibility === 'participants';

export const hasStableConstructionPlanReviewJsonPointer = (
    value: unknown,
    pointer: string,
): boolean => {
    if (!pointer.startsWith('/')
        || /(?:^|\/)(?:__proto__|prototype|constructor)(?:\/|$)/.test(pointer)) return false;
    let current = value;
    const segments = pointer.split('/').slice(1)
        .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'));
    for (const segment of segments) {
        if (Array.isArray(current)) return false;
        if (!isUnknownRecord(current) || !Object.prototype.hasOwnProperty.call(current, segment)) return false;
        current = current[segment];
    }
    return true;
};

export const isNormalizedConstructionPlanReviewCoordinate = (value: unknown): value is number => (
    typeof value === 'number'
    && Number.isFinite(value)
    && value >= 0
    && value <= 1
);

export const buildConstructionPlanFallbackPageFingerprint = (
    sourceSha256: string,
    pageIndex: number,
): string => `source:${sourceSha256.trim().toLowerCase()}:page:${pageIndex}`;

export const classifyConstructionPlanDrawingReviewAnchor = (
    rawDrawing: unknown,
    rawAnchor: unknown,
): 'valid' | 'stale' | 'orphaned' => {
    if (!isUnknownRecord(rawDrawing) || !isUnknownRecord(rawAnchor)) return 'orphaned';
    const pageIndex = rawAnchor.pageIndex;
    const fingerprint = readTrimmedString(rawAnchor, ['pageFingerprint']);
    if (!Number.isInteger(pageIndex) || Number(pageIndex) < 0 || !fingerprint) return 'orphaned';
    const pages = Array.isArray(rawDrawing.pages) ? rawDrawing.pages : [];
    const page = pages.find((entry) => isUnknownRecord(entry) && entry.pageIndex === pageIndex);
    let pageMatches = isUnknownRecord(page) && page.pageFingerprint === fingerprint;
    if (!pageMatches && pages.length === 0 && rawDrawing.pageCount === 1 && pageIndex === 0) {
        const sourceSha256 = readTrimmedString(rawDrawing, ['sourceSha256']);
        pageMatches = Boolean(sourceSha256)
            && fingerprint === buildConstructionPlanFallbackPageFingerprint(sourceSha256 || '', 0);
    }
    if (!pageMatches) return 'stale';
    const annotationId = readTrimmedString(rawAnchor, ['annotationId']);
    if (!annotationId) return 'valid';
    if (!Array.isArray(rawDrawing.annotations)) return 'orphaned';
    const annotation = rawDrawing.annotations.find((entry) => isUnknownRecord(entry)
        && entry.id === annotationId
        && entry.pageIndex === pageIndex);
    if (!isUnknownRecord(annotation)) return 'orphaned';
    const annotationFingerprint = readTrimmedString(annotation, ['pageFingerprint']);
    return annotationFingerprint && annotationFingerprint !== fingerprint ? 'stale' : 'valid';
};

export const transitionConstructionPlanReviewStatus = (
    currentStatus: string,
    action: ConstructionPlanReviewAction,
): string => {
    const contract: Record<ConstructionPlanReviewAction, { from: readonly string[]; to: string }> = {
        submit_review: { from: ['draft', 'changes_requested'], to: 'in_review' },
        request_changes: { from: ['in_review', 'review_completed'], to: 'changes_requested' },
        complete_review: { from: ['in_review'], to: 'review_completed' },
        approve: { from: ['review_completed'], to: 'approved_pending_issue' },
    };
    const transition = contract[action];
    if (!transition.from.includes(currentStatus)) {
        throw new Error('construction-plan-review-transition-invalid');
    }
    return transition.to;
};

export const canAddressConstructionPlanReviewComment = (input: {
    planCreatedBy?: string;
    authorIds: readonly string[];
    actorId: string;
    isCentral: boolean;
    planStatus: string;
    commentStatus: string;
    authorReplyCount: number;
}): boolean => (
    (input.isCentral || input.planCreatedBy === input.actorId || input.authorIds.includes(input.actorId))
    && ['in_review', 'changes_requested'].includes(input.planStatus)
    && input.commentStatus === 'open'
    && Number.isInteger(input.authorReplyCount)
    && input.authorReplyCount >= 1
);

const commentStatusCounter = (status: ConstructionPlanReviewCommentStatus): keyof ConstructionPlanReviewCommentSummary => {
    if (status === 'open') return 'totalOpen';
    if (status === 'addressed') return 'totalAddressed';
    return 'totalResolved';
};

const requiredCommentStatusCounter = (
    status: ConstructionPlanReviewCommentStatus,
): keyof ConstructionPlanReviewCommentSummary => {
    if (status === 'open') return 'requiredOpen';
    if (status === 'addressed') return 'requiredAddressed';
    return 'requiredResolved';
};

const normalizedCommentCounter = (value: unknown): number =>
    Number.isInteger(value) && Number(value) >= 0 ? Number(value) : 0;

export const normalizeConstructionPlanReviewCommentSummary = (
    raw: unknown,
): ConstructionPlanReviewCommentSummary => {
    const value = isUnknownRecord(raw) ? raw : {};
    const summary: ConstructionPlanReviewCommentSummary = {
        totalOpen: normalizedCommentCounter(value.totalOpen),
        totalAddressed: normalizedCommentCounter(value.totalAddressed),
        totalResolved: normalizedCommentCounter(value.totalResolved),
        requiredOpen: normalizedCommentCounter(value.requiredOpen),
        requiredAddressed: normalizedCommentCounter(value.requiredAddressed),
        requiredResolved: normalizedCommentCounter(value.requiredResolved),
        unresolvedRequired: 0,
    };
    summary.unresolvedRequired = summary.requiredOpen + summary.requiredAddressed;
    return summary;
};

export const applyConstructionPlanReviewCommentTransition = (
    rawSummary: unknown,
    fromStatus: ConstructionPlanReviewCommentStatus | null,
    toStatus: ConstructionPlanReviewCommentStatus,
    required: boolean,
): ConstructionPlanReviewCommentSummary => {
    const summary = normalizeConstructionPlanReviewCommentSummary(rawSummary);
    if (fromStatus) {
        const totalKey = commentStatusCounter(fromStatus);
        if (summary[totalKey] < 1) throw new Error('construction-plan-comment-summary-underflow');
        summary[totalKey] -= 1;
        if (required) {
            const requiredKey = requiredCommentStatusCounter(fromStatus);
            if (summary[requiredKey] < 1) throw new Error('construction-plan-comment-summary-underflow');
            summary[requiredKey] -= 1;
        }
    }
    summary[commentStatusCounter(toStatus)] += 1;
    if (required) summary[requiredCommentStatusCounter(toStatus)] += 1;
    summary.unresolvedRequired = summary.requiredOpen + summary.requiredAddressed;
    return summary;
};

export const assertConstructionPlanReviewCommentTransition = (
    status: ConstructionPlanReviewCommentStatus,
    action: 'address' | 'resolve' | 'reopen',
): ConstructionPlanReviewCommentStatus => {
    if (action === 'address' && status === 'open') return 'addressed';
    if (action === 'resolve' && (status === 'open' || status === 'addressed')) return 'resolved';
    if (action === 'reopen' && status === 'resolved') return 'open';
    throw new Error('construction-plan-comment-transition-invalid');
};

/**
 * Approval promotes the active review evidence by reference. It must never
 * re-canonicalize the mutable plan because reviewer/approver ACL metadata is
 * intentionally outside the document content hash.
 */
export const buildConstructionPlanApprovedSnapshotReference = (
    rawPlan: unknown,
    rawSnapshot: unknown,
    rawPackage?: unknown,
    rawCycle?: unknown,
): UnknownRecord => {
    if (!isUnknownRecord(rawPlan) || !isUnknownRecord(rawSnapshot)) {
        throw new Error('construction-plan-review-snapshot-invalid');
    }
    const snapshotId = readTrimmedString(rawPlan, ['activeReviewSnapshotId']);
    const contentHash = readTrimmedString(rawPlan, ['activeReviewSnapshotHash']);
    const storagePath = readTrimmedString(rawPlan, ['activeReviewSnapshotStoragePath']);
    if (!snapshotId || !contentHash || !/^[a-f0-9]{64}$/.test(contentHash)
        || !storagePath
        || rawSnapshot.id !== snapshotId
        || rawSnapshot.contentHash !== contentHash
        || rawSnapshot.storagePath !== storagePath
        || rawSnapshot.immutable !== true) {
        throw new Error('construction-plan-review-snapshot-binding-invalid');
    }
    if (rawPackage !== undefined || rawCycle !== undefined) {
        if (!isUnknownRecord(rawPackage) || !isUnknownRecord(rawCycle)
            || rawPlan.activeReviewPackageId !== rawPackage.id
            || rawPlan.activeReviewCycleId !== rawCycle.id
            || rawCycle.activePackageId !== rawPackage.id
            || rawCycle.frozen === true
            || rawPackage.reviewDecision !== 'completed'
            || rawPackage.reviewSnapshotId !== snapshotId
            || rawPackage.reviewSnapshotHash !== contentHash
            || rawPackage.reviewSnapshotStoragePath !== storagePath
            || rawPackage.reviewSnapshotLockVersion !== rawPlan.activeReviewSnapshotLockVersion) {
            throw new Error('construction-plan-review-package-binding-invalid');
        }
        const summary = normalizeConstructionPlanReviewCommentSummary(rawCycle.commentSummary);
        if (!isUnknownRecord(rawCycle.commentSummary)
            || rawCycle.commentSummary.unresolvedRequired !== summary.unresolvedRequired
            || summary.unresolvedRequired !== 0) {
            throw new Error('construction-plan-review-comments-unresolved');
        }
    }
    return {
        approvedSnapshotId: snapshotId,
        approvedSnapshotHash: contentHash,
        approvedSnapshotStoragePath: storagePath,
    };
};

export const resolveConstructionPlanReviewMutationClaim = (
    rawClaim: unknown,
    operation: string,
    requestFingerprint: string,
): UnknownRecord | null => {
    if (rawClaim === undefined || rawClaim === null) return null;
    if (!isUnknownRecord(rawClaim)
        || rawClaim.operation !== operation
        || typeof rawClaim.requestFingerprint !== 'string'
        || !isUnknownRecord(rawClaim.response)) {
        throw new Error('construction-plan-review-claim-corrupt');
    }
    if (rawClaim.requestFingerprint !== requestFingerprint) {
        throw new Error('construction-plan-review-claim-conflict');
    }
    return rawClaim.response;
};

/**
 * Returns the exact immutable payload covered by an approval evidence hash.
 * Wrapper fields such as `id`, `evidenceHash`, `immutable`, and `createdAt`
 * deliberately remain outside the payload. Optional human-readable control
 * names are server snapshots; account IDs stay hash-bound but are never
 * rendered in the field-use document.
 */
export const constructionPlanApprovalEvidenceContentForHash = (
    rawEvidence: unknown,
): UnknownRecord => {
    if (!isUnknownRecord(rawEvidence)
        || rawEvidence.evidenceSchemaVersion !== 1
        || rawEvidence.kind !== 'construction_plan_approval'
        || rawEvidence.reviewDecision !== 'completed') {
        throw new Error('construction-plan-approval-evidence-shape-invalid');
    }
    const requiredStrings: ReadonlyArray<[string, number]> = [
        ['planId', 200], ['reviewCycleId', 200], ['reviewPackageId', 200],
        ['snapshotId', 200], ['contentHash', 64], ['storagePath', 1000],
        ['approverId', 200], ['templateHash', 64], ['manifestHash', 64],
        ['templateBundleHash', 64], ['templateBindingHash', 64],
    ];
    const evidenceContent: UnknownRecord = {
        evidenceSchemaVersion: 1,
        kind: 'construction_plan_approval',
    };
    requiredStrings.forEach(([key, maximum]) => {
        evidenceContent[key] = requireBoundedString(rawEvidence[key], `approval-evidence-${key}`, maximum);
    });
    if (!['contentHash', 'templateHash', 'manifestHash', 'templateBundleHash', 'templateBindingHash']
        .every((key) => SHA256_HEX_PATTERN.test(String(evidenceContent[key])))) {
        throw new Error('construction-plan-approval-evidence-hash-invalid');
    }
    const approvedAt = normalizedIsoDateTime(rawEvidence.approvedAt);
    if (!approvedAt) throw new Error('construction-plan-approval-evidence-approved-at-invalid');
    Object.assign(evidenceContent, {
        reviewDecision: 'completed',
        approvedAt,
    });
    const completedByName = optionalBoundedString(
        rawEvidence.completedByName,
        'approval-evidence-completed-by-name',
        200,
    );
    const completedAt = rawEvidence.completedAt === undefined
        ? undefined
        : normalizedIsoDateTime(rawEvidence.completedAt);
    if (rawEvidence.completedAt !== undefined && !completedAt) {
        throw new Error('construction-plan-approval-evidence-completed-at-invalid');
    }
    const approverName = optionalBoundedString(
        rawEvidence.approverName,
        'approval-evidence-approver-name',
        200,
    );
    if (completedByName) evidenceContent.completedByName = completedByName;
    if (completedAt) evidenceContent.completedAt = completedAt;
    if (approverName) evidenceContent.approverName = approverName;
    return evidenceContent;
};

export const assertConstructionPlanApprovalEvidenceBinding = (
    rawEvidence: unknown,
    expected: {
        planId: string;
        evidenceHash: string;
        snapshotId: string;
        contentHash: string;
        storagePath: string;
        reviewPackageId: string;
        reviewCycleId: string;
        templateHash: string;
        manifestHash: string;
        templateBundleHash: string;
        templateBindingHash: string;
    },
): void => {
    if (!isUnknownRecord(rawEvidence) || rawEvidence.immutable !== true
        || rawEvidence.planId !== expected.planId
        || rawEvidence.snapshotId !== expected.snapshotId
        || rawEvidence.contentHash !== expected.contentHash
        || rawEvidence.storagePath !== expected.storagePath
        || rawEvidence.reviewPackageId !== expected.reviewPackageId
        || rawEvidence.reviewCycleId !== expected.reviewCycleId
        || rawEvidence.templateHash !== expected.templateHash
        || rawEvidence.manifestHash !== expected.manifestHash
        || rawEvidence.templateBundleHash !== expected.templateBundleHash
        || rawEvidence.templateBindingHash !== expected.templateBindingHash
        || rawEvidence.evidenceHash !== expected.evidenceHash) {
        throw new Error('construction-plan-approval-evidence-binding-invalid');
    }
    const evidenceContent = constructionPlanApprovalEvidenceContentForHash(rawEvidence);
    if (sha256Hex(canonicalStringify(evidenceContent)) !== expected.evidenceHash) {
        throw new Error('construction-plan-approval-evidence-hash-invalid');
    }
};

export const hasPdfMagic = (buffer: Buffer): boolean =>
    buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-';

export const validatePdfEnvelope = (
    buffer: Buffer,
    pageCount: number,
    expectedSha256?: string,
): PdfEnvelopeValidationResult => {
    const issues: ConstructionPlanValidationIssue[] = [];
    const sha256 = sha256Hex(buffer);
    if (!hasPdfMagic(buffer)) pushIssue(issues, 'pdf.magic', 'file', 'File does not begin with a PDF header.');
    if (!Number.isInteger(pageCount)
        || pageCount < CONSTRUCTION_PLAN_MIN_PHYSICAL_PAGE_COUNT
        || pageCount > CONSTRUCTION_PLAN_MAX_PHYSICAL_PAGE_COUNT) {
        pushIssue(
            issues,
            'pdf.page_count',
            'file',
            `Issued PDF must contain ${CONSTRUCTION_PLAN_MIN_PHYSICAL_PAGE_COUNT} through ${CONSTRUCTION_PLAN_MAX_PHYSICAL_PAGE_COUNT} physical pages.`,
        );
    }
    if (expectedSha256 && sha256 !== expectedSha256.toLowerCase()) {
        pushIssue(issues, 'pdf.sha256', 'file', 'PDF SHA-256 does not match the expected digest.');
    }
    return { valid: issues.length === 0, issues, sha256, pageCount, sizeBytes: buffer.length };
};

const escapeRegularExpression = (value: string): string =>
    value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const hasAuditField = (text: string, label: string, value: string): boolean => {
    const expression = new RegExp(
        `${escapeRegularExpression(label)}\\s*[:=]\\s*${escapeRegularExpression(value)}(?:\\s|[|;,]|$)`,
        'i',
    );
    return expression.test(text);
};

/**
 * Raster PDFs do not expose their Korean body copy as searchable text in this
 * MVP. The renderer therefore adds a small ASCII audit layer on every page;
 * this validator proves document identity and page sequence, not visual or
 * Korean full-text equivalence.
 */
export const validatePdfAuditText = (
    rawText: string,
    expected: PdfAuditExpectation,
): ConstructionPlanValidationResult => {
    const issues: ConstructionPlanValidationIssue[] = [];
    const text = rawText.replace(/\s+/g, ' ').trim();
    const physicalPageCount = expected.physicalPageCount ?? CONSTRUCTION_PLAN_PAGE_COUNT;
    if (!Number.isInteger(physicalPageCount)
        || physicalPageCount < CONSTRUCTION_PLAN_MIN_PHYSICAL_PAGE_COUNT
        || physicalPageCount > CONSTRUCTION_PLAN_MAX_PHYSICAL_PAGE_COUNT) {
        pushIssue(issues, 'pdf.audit.page_count', 'file.auditText', 'Physical page count is outside the allowed 42 through 200 range.');
        return { valid: false, issues };
    }
    const fields: Array<[string, string, string]> = [
        ['PLAN_ID', sanitizeExpectedPdfAuditValue(expected.planId, 72), 'pdf.audit.plan_id'],
        ['DOCUMENT_NO', sanitizeExpectedPdfAuditValue(expected.documentNo, 72), 'pdf.audit.document_no'],
        ['REV', sanitizeExpectedPdfAuditValue(String(expected.revision), 24), 'pdf.audit.revision'],
        ['TEMPLATE_VERSION', sanitizeExpectedPdfAuditValue(expected.templateVersion, 72), 'pdf.audit.template_version'],
        ['SNAPSHOT_HASH', sanitizeExpectedPdfAuditValue(expected.snapshotHash, 128), 'pdf.audit.snapshot_hash'],
    ];
    fields.forEach(([label, value, code]) => {
        if (!hasAuditField(text, label, value)) {
            pushIssue(issues, code, 'file.auditText', `${label} audit marker is missing or mismatched.`);
        }
    });
    for (let page = 1; page <= physicalPageCount; page += 1) {
        const pageExpression = new RegExp(`PAGE\\s*[:=]?\\s*${page}\\s*\\/\\s*${physicalPageCount}(?:\\s|[|;,]|$)`, 'i');
        if (!pageExpression.test(text)) {
            pushIssue(issues, 'pdf.audit.page_marker', 'file.auditText', `PAGE ${page}/${physicalPageCount} audit marker is missing.`);
        }
    }
    return { valid: issues.length === 0, issues };
};

const sanitizeExpectedPdfAuditValue = (value: string, maxLength: number): string => {
    let ascii = '';
    for (const character of String(value)) {
        const codePoint = character.codePointAt(0) || 0;
        if (codePoint >= 0x20 && codePoint <= 0x7e) ascii += character;
        else if (/\s/.test(character)) ascii += ' ';
        else ascii += '_';
    }
    return ascii
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, Math.max(0, maxLength))
        .replace(/[|=;]/g, '_') || '-';
};

/** Verifies that each physical PDF page carries its own identity/page marker. */
export const validatePdfAuditPages = (
    rawPageTexts: readonly string[],
    expected: PdfAuditExpectation,
): ConstructionPlanValidationResult => {
    const issues: ConstructionPlanValidationIssue[] = [];
    const physicalPageCount = expected.physicalPageCount ?? CONSTRUCTION_PLAN_PAGE_COUNT;
    if (!Number.isInteger(physicalPageCount)
        || physicalPageCount < CONSTRUCTION_PLAN_MIN_PHYSICAL_PAGE_COUNT
        || physicalPageCount > CONSTRUCTION_PLAN_MAX_PHYSICAL_PAGE_COUNT
        || rawPageTexts.length !== physicalPageCount) {
        pushIssue(issues, 'pdf.audit.page_count', 'file.auditPages', 'PDF text layer physical page count must match the allowed 42 through 200 page expectation.');
        return { valid: false, issues };
    }
    const fields: Array<[string, string, string]> = [
        ['PLAN_ID', sanitizeExpectedPdfAuditValue(expected.planId, 72), 'pdf.audit.plan_id'],
        ['DOCUMENT_NO', sanitizeExpectedPdfAuditValue(expected.documentNo, 72), 'pdf.audit.document_no'],
        ['REV', sanitizeExpectedPdfAuditValue(String(expected.revision), 24), 'pdf.audit.revision'],
        ['TEMPLATE_VERSION', sanitizeExpectedPdfAuditValue(expected.templateVersion, 72), 'pdf.audit.template_version'],
        ['SNAPSHOT_HASH', sanitizeExpectedPdfAuditValue(expected.snapshotHash, 128), 'pdf.audit.snapshot_hash'],
    ];
    rawPageTexts.forEach((rawText, index) => {
        const pageNumber = index + 1;
        const text = rawText.replace(/\s+/g, ' ').trim();
        fields.forEach(([label, value, code]) => {
            if (!hasAuditField(text, label, value)) {
                pushIssue(issues, code, `file.auditPages[${index}]`, `${label} audit marker is missing or mismatched on page ${pageNumber}.`);
            }
        });
        const pageExpression = new RegExp(`PAGE\\s*[:=]?\\s*${pageNumber}\\s*\\/\\s*${physicalPageCount}(?:\\s|[|;,]|$)`, 'i');
        if (!pageExpression.test(text)) {
            pushIssue(issues, 'pdf.audit.page_marker', `file.auditPages[${index}]`, `PAGE ${pageNumber}/${physicalPageCount} marker is missing from its physical page.`);
        }
    });
    return { valid: issues.length === 0, issues };
};

export const sanitizeConstructionPlanStorageSegment = (value: string, fallback: string): string => {
    const normalized = value
        .normalize('NFKC')
        .replace(/[\\/#?%\[\]*]/g, '-')
        .replace(/\s+/g, '-')
        .replace(/\.{2,}/g, '.')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
    return normalized || fallback;
};

export const buildIssuedPdfCandidatePath = (
    siteId: string,
    planId: string,
    revision: number,
    sha256: string,
): string => {
    const siteSegment = sanitizeConstructionPlanStorageSegment(siteId, 'unknown-site');
    const planSegment = sanitizeConstructionPlanStorageSegment(planId, 'unknown-plan');
    const revisionSegment = String(revision).padStart(2, '0');
    return `construction-plans/${siteSegment}/${planSegment}/exports/rev-${revisionSegment}/${sha256.toLowerCase()}.pdf`;
};

export const isAllowedConstructionPlanPdfSourcePath = (
    storagePath: string,
    siteId: string,
    planId: string,
): boolean => {
    const siteSegment = sanitizeConstructionPlanStorageSegment(siteId, 'unknown-site');
    const planSegment = sanitizeConstructionPlanStorageSegment(planId, 'unknown-plan');
    const expectedPrefix = `construction-plans/${siteSegment}/${planSegment}/exports/`;
    return storagePath.startsWith(expectedPrefix)
        && storagePath.toLowerCase().endsWith('.pdf')
        && !storagePath.includes('..')
        && !storagePath.includes('\\');
};
