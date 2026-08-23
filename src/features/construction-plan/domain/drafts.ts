import type {
  ConstructionPlan,
  ConstructionPlanRevisionType,
  CreateConstructionPlanInput,
  DrawingApplicabilityDecision,
  OrganizationRoleAssignment,
  OrganizationSnapshot,
  PlanDrawing,
  ProjectSnapshot,
} from '../types';
import {
  ConstructionPlanSchema,
  CreateConstructionPlanInputSchema,
  OrganizationSnapshotSchema,
  ProjectSnapshotSchema,
} from '../types';
import {
  createDefaultPlanSections,
  SYSTEM_SCAFFOLD_TEMPLATE_MANIFEST,
  SYSTEM_SHORING_TEMPLATE_MANIFEST,
} from './templateManifest';

const isoNow = (now?: Date | string): string => {
  const date = typeof now === 'string' ? new Date(now) : now ?? new Date();
  if (Number.isNaN(date.getTime())) {
    throw new Error('construction-plan-invalid-draft-date');
  }
  return date.toISOString();
};

const SEOUL_CALENDAR_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export const formatSeoulCalendarDate = (value: Date | string = new Date()): string => {
  const date = typeof value === 'string' ? new Date(value) : new Date(value.getTime());
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

const unique = (values: readonly string[]): string[] =>
  Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));

const DEFAULT_ORGANIZATION_ROLES: readonly Omit<OrganizationRoleAssignment, 'worker'>[] = [
  { id: 'site-manager', role: 'site_manager', label: '현장책임자', required: true, responsibilities: ['현장 총괄'], order: 0, externalAssignment: false },
  { id: 'construction-manager', role: 'construction_manager', label: '공사담당', required: true, responsibilities: ['시공 및 공정관리'], order: 1, externalAssignment: false },
  { id: 'safety-manager', role: 'safety_manager', label: '안전담당', required: true, responsibilities: ['안전계획 및 점검'], order: 2, externalAssignment: false },
  { id: 'quality-manager', role: 'quality_manager', label: '품질담당', required: false, responsibilities: ['품질 및 검측관리'], order: 3, externalAssignment: false },
  { id: 'equipment-manager', role: 'equipment_manager', label: '장비담당', required: false, responsibilities: ['장비 및 양중관리'], order: 4, externalAssignment: false },
  { id: 'team-leader', role: 'team_leader', label: '작업반장', required: false, responsibilities: ['작업자 지휘'], order: 5, externalAssignment: false },
];

export const createDefaultOrganizationSnapshot = (
  capturedAt: string,
  siteId?: string,
): OrganizationSnapshot => OrganizationSnapshotSchema.parse({
  capturedAt,
  ...(siteId ? { sourceSiteId: siteId } : {}),
  assignments: DEFAULT_ORGANIZATION_ROLES,
  additionalWorkers: [],
});

const buildProjectSnapshot = (
  input: CreateConstructionPlanInput,
  capturedAt: string,
): ProjectSnapshot => ProjectSnapshotSchema.parse({
  ...(input.projectSnapshot ?? {}),
  capturedAt: input.projectSnapshot?.capturedAt ?? capturedAt,
  siteName: input.projectSnapshot?.siteName ?? input.siteName ?? '',
  buildings: input.projectSnapshot?.buildings ?? [],
  floors: input.projectSnapshot?.floors ?? [],
  zones: input.projectSnapshot?.zones ?? [],
  sitePhotos: input.projectSnapshot?.sitePhotos ?? [],
  emergencyContactsComplete: input.projectSnapshot?.emergencyContactsComplete ?? false,
  differsFromMaster: input.projectSnapshot?.differsFromMaster ?? false,
});

export const buildConstructionPlanDraft = (
  id: string,
  rawInput: CreateConstructionPlanInput,
  now?: Date | string,
): ConstructionPlan => {
  if (!id.trim()) throw new Error('construction-plan-id-required');
  const input = CreateConstructionPlanInputSchema.parse(rawInput);
  const manifest = input.tradeType === 'system-scaffold'
    ? SYSTEM_SCAFFOLD_TEMPLATE_MANIFEST
    : SYSTEM_SHORING_TEMPLATE_MANIFEST;
  if ((input.templateId && input.templateId !== manifest.id)
    || (input.templateVersion && input.templateVersion !== manifest.version)
    || (input.rendererVersion && input.rendererVersion !== manifest.rendererVersion)) {
    throw new Error('construction-plan-template-identity-invalid');
  }
  const timestamp = isoNow(now);
  const documentDate = input.documentDate ?? formatSeoulCalendarDate(timestamp);
  const generatedDocumentNo = `CP-${input.siteId}-${documentDate.replace(/-/g, '')}`;
  const sections = createDefaultPlanSections(manifest);
  const authorIds = unique([input.createdBy, ...(input.participants?.authorIds ?? [])]);

  return ConstructionPlanSchema.parse({
    id,
    siteId: input.siteId,
    title: input.title ?? `${input.siteName ?? '현장'} ${input.tradeType === 'system-scaffold' ? '시스템비계' : '시스템동바리'} 시공계획서`,
    tradeType: input.tradeType,
    documentNo: input.documentNo ?? generatedDocumentNo,
    documentDate,
    revision: 0,
    status: 'draft',
    templateId: manifest.id,
    templateVersion: manifest.version,
    rendererVersion: manifest.rendererVersion,
    schemaVersion: manifest.schemaVersion,
    projectSnapshot: buildProjectSnapshot(input, timestamp),
    organizationSnapshot: input.organizationSnapshot
      ?? createDefaultOrganizationSnapshot(timestamp, input.siteId),
    sections,
    sectionOrder: sections.map((section) => section.id),
    drawings: [],
    drawingApplicability: [],
    engineeringValues: [],
    equipmentPlan: [],
    riskAssessments: [],
    releaseReadiness: {
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
    },
    validationSummary: { errors: 0, warnings: 0, checkedAt: timestamp },
    lockVersion: 0,
    participants: {
      authorIds,
      reviewerIds: unique(input.participants?.reviewerIds ?? []),
      approverIds: unique(input.participants?.approverIds ?? []),
    },
    createdBy: input.createdBy,
    ...((input.createdByName ?? input.authorName)
      ? { createdByName: input.createdByName ?? input.authorName }
      : {}),
    createdAt: timestamp,
    updatedBy: input.createdBy,
    updatedAt: timestamp,
  });
};

export type CreatePlanRevisionOptions = {
  id: string;
  createdBy: string;
  createdByName?: string;
  now?: Date | string;
  copyDrawings?: boolean;
  seriesId?: string;
  revisionNo?: number;
  revisionReason: string;
  revisionType: ConstructionPlanRevisionType;
};

const resetCopiedDrawingsForReview = (
  drawings: readonly PlanDrawing[],
  planId: string,
): PlanDrawing[] => drawings.map((drawing) => {
  const { approvalReference: _approvalReference, ...copy } = drawing;
  return {
    ...copy,
    planId,
    approvalStatus: drawing.approvalStatus === 'example' ? 'example' : 'reviewed',
    annotations: drawing.annotations.map((annotation) => ({ ...annotation, locked: false })),
  };
});

const resetDrawingApplicabilityForReview = (
  decisions: readonly DrawingApplicabilityDecision[],
): DrawingApplicabilityDecision[] => decisions.map((decision) => {
  const {
    reviewedBy: _reviewedBy,
    technicalReviewReference: _technicalReviewReference,
    ...unreviewed
  } = decision;
  return unreviewed;
});

const resetEngineeringValuesForReview = (
  values: readonly ConstructionPlan['engineeringValues'][number][],
): ConstructionPlan['engineeringValues'] => values.map((value) => {
  const {
    verifiedBy: _verifiedBy,
    verifiedAt: _verifiedAt,
    ...unverified
  } = value;
  return { ...unverified, verificationStatus: 'unverified' };
});

const resetRiskAssessmentsForReview = (
  risks: readonly ConstructionPlan['riskAssessments'][number][],
): ConstructionPlan['riskAssessments'] => risks.map((risk) => {
  const { verifiedBy: _verifiedBy, ...unverified } = risk;
  return unverified;
});

export const scrubPlanSectionDrawingReferences = (
  sections: readonly ConstructionPlan['sections'][number][],
): ConstructionPlan['sections'] => sections.map((section) => {
  const {
    drawingId: _drawingId,
    drawingStudio: _drawingStudio,
    ...contentWithoutDrawing
  } = section.content;
  const containedDrawingReference = Object.keys(contentWithoutDrawing).length !== Object.keys(section.content).length;
  if (!containedDrawingReference) return section;
  return {
    ...section,
    content: contentWithoutDrawing,
    status: section.kind === 'drawing-page' ? 'empty' : section.status,
  };
});

const resetReleaseReadiness = (): ConstructionPlan['releaseReadiness'] => ({
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

const withoutReleaseFields = (plan: ConstructionPlan) => {
  const {
    editLock: _editLock,
    activeReviewSnapshotId: _activeReviewSnapshotId,
    activeReviewSnapshotHash: _activeReviewSnapshotHash,
    activeReviewSnapshotStoragePath: _activeReviewSnapshotStoragePath,
    activeReviewSnapshotLockVersion: _activeReviewSnapshotLockVersion,
    activeReviewPackageId: _activeReviewPackageId,
    activeReviewCycleId: _activeReviewCycleId,
    reviewRound: _reviewRound,
    commentSummary: _commentSummary,
    approvedSnapshotId: _approvedSnapshotId,
    approvedSnapshotHash: _approvedSnapshotHash,
    approvedSnapshotStoragePath: _approvedSnapshotStoragePath,
    approvedEvidenceId: _approvedEvidenceId,
    approvedEvidenceHash: _approvedEvidenceHash,
    issuedExportId: _issuedExportId,
    issuedExportStoragePath: _issuedExportStoragePath,
    issuedExportSha256: _issuedExportSha256,
    issuedExportFileName: _issuedExportFileName,
    issuedAt: _issuedAt,
    issuedBy: _issuedBy,
    supersedesPlanId: _supersedesPlanId,
    supersededByPlanId: _supersededByPlanId,
    revisionReason: _revisionReason,
    revisionType: _revisionType,
    sourceRevisionNo: _sourceRevisionNo,
    sourceSnapshotHash: _sourceSnapshotHash,
    clonedFromPlanId: _clonedFromPlanId,
    ...editable
  } = plan;
  return editable;
};

export const createConstructionPlanRevision = (
  sourceValue: ConstructionPlan,
  options: CreatePlanRevisionOptions,
): ConstructionPlan => {
  const source = ConstructionPlanSchema.parse(sourceValue);
  if (source.status !== 'issued' && source.status !== 'superseded') {
    throw new Error('construction-plan-revision-source-must-be-issued');
  }
  const revisionReason = options.revisionReason.trim();
  if (revisionReason.length < 5) {
    throw new Error('construction-plan-revision-reason-too-short');
  }
  const revisionNo = options.revisionNo ?? source.revision + 1;
  if (!Number.isInteger(revisionNo) || revisionNo <= source.revision) {
    throw new Error('construction-plan-revision-number-invalid');
  }
  const timestamp = isoNow(options.now);
  const copy = withoutReleaseFields(source);

  return ConstructionPlanSchema.parse({
    ...copy,
    id: options.id,
    ...(options.seriesId || source.seriesId
      ? { seriesId: options.seriesId ?? source.seriesId }
      : {}),
    lineageRootPlanId: source.lineageRootPlanId ?? source.id,
    revision: revisionNo,
    revisionReason,
    revisionType: options.revisionType,
    sourceRevisionNo: source.revision,
    ...(source.approvedSnapshotHash
      ? { sourceSnapshotHash: source.approvedSnapshotHash }
      : {}),
    documentDate: formatSeoulCalendarDate(timestamp),
    status: 'draft',
    drawings: options.copyDrawings === false
      ? []
      : resetCopiedDrawingsForReview(source.drawings, options.id),
    sections: options.copyDrawings === false
      ? scrubPlanSectionDrawingReferences(source.sections)
      : source.sections,
    drawingApplicability: options.copyDrawings === false
      ? []
      : resetDrawingApplicabilityForReview(source.drawingApplicability),
    engineeringValues: resetEngineeringValuesForReview(source.engineeringValues),
    riskAssessments: resetRiskAssessmentsForReview(source.riskAssessments),
    releaseReadiness: resetReleaseReadiness(),
    validationSummary: { errors: 0, warnings: 0, checkedAt: timestamp },
    lockVersion: 0,
    supersedesPlanId: source.id,
    participants: {
      authorIds: unique([source.createdBy, ...source.participants.authorIds, options.createdBy]),
      reviewerIds: [],
      approverIds: [],
    },
    createdBy: options.createdBy,
    ...(options.createdByName ? { createdByName: options.createdByName } : {}),
    createdAt: timestamp,
    updatedBy: options.createdBy,
    updatedAt: timestamp,
  });
};

export type CloneConstructionPlanOptions = Omit<
  CreatePlanRevisionOptions,
  'revisionNo' | 'revisionReason' | 'revisionType'
> & {
  siteId?: string;
  siteName?: string;
  title?: string;
  documentNo?: string;
  copyDrawings?: boolean;
  retainOrganization?: boolean;
};

export const cloneConstructionPlanAsDraft = (
  sourceValue: ConstructionPlan,
  options: CloneConstructionPlanOptions,
): ConstructionPlan => {
  const source = ConstructionPlanSchema.parse(sourceValue);
  const timestamp = isoNow(options.now);
  const siteId = options.siteId ?? source.siteId;
  const copy = withoutReleaseFields(source);
  const {
    seriesId: _sourceSeriesId,
    lineageRootPlanId: _sourceLineageRootPlanId,
    ...independentCopy
  } = copy;

  return ConstructionPlanSchema.parse({
    ...independentCopy,
    id: options.id,
    ...(options.seriesId ? { seriesId: options.seriesId } : {}),
    lineageRootPlanId: options.id,
    clonedFromPlanId: source.id,
    ...(source.approvedSnapshotHash
      ? { sourceSnapshotHash: source.approvedSnapshotHash }
      : {}),
    siteId,
    title: options.title ?? source.title,
    documentNo: options.documentNo ?? `${source.documentNo}-COPY`,
    documentDate: formatSeoulCalendarDate(timestamp),
    revision: 0,
    status: 'draft',
    projectSnapshot: {
      ...source.projectSnapshot,
      capturedAt: timestamp,
      siteName: options.siteName ?? source.projectSnapshot.siteName,
    },
    organizationSnapshot: options.retainOrganization === true
      ? { ...source.organizationSnapshot, capturedAt: timestamp, sourceSiteId: siteId }
      : createDefaultOrganizationSnapshot(timestamp, siteId),
    drawings: options.copyDrawings
      ? resetCopiedDrawingsForReview(source.drawings, options.id)
      : [],
    sections: options.copyDrawings
      ? source.sections
      : scrubPlanSectionDrawingReferences(source.sections),
    drawingApplicability: options.copyDrawings
      ? resetDrawingApplicabilityForReview(source.drawingApplicability)
      : [],
    engineeringValues: resetEngineeringValuesForReview(source.engineeringValues),
    riskAssessments: resetRiskAssessmentsForReview(source.riskAssessments),
    releaseReadiness: resetReleaseReadiness(),
    validationSummary: { errors: 0, warnings: 0, checkedAt: timestamp },
    lockVersion: 0,
    participants: {
      authorIds: [options.createdBy],
      reviewerIds: [],
      approverIds: [],
    },
    createdBy: options.createdBy,
    ...(options.createdByName ? { createdByName: options.createdByName } : {}),
    createdAt: timestamp,
    updatedBy: options.createdBy,
    updatedAt: timestamp,
  });
};
