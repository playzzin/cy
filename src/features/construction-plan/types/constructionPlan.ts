import { z } from 'zod';
import { DrawingApplicabilityDecisionSchema, PlanDrawingSchema } from './drawing';
import { ConstructionPlanTradeTypeSchema, SectionKindSchema } from './template';
import {
  CONSTRUCTION_PLAN_ERP_REFRESH_FIELDS,
  ConstructionPlanErpFieldProvenanceSchema,
  type ConstructionPlanErpRefreshSlot,
} from './erpRefresh';

export const IsoDateTimeSchema = z.string().datetime({ offset: true });

export const PlanStatusSchema = z.enum([
  'draft',
  'in_review',
  'changes_requested',
  'review_completed',
  'approved_pending_issue',
  'issued',
  'superseded',
  'archived',
  'void',
]);

export const ConstructionPlanRevisionTypeSchema = z.enum([
  'design_change',
  'site_condition',
  'method_change',
  'schedule_change',
  'safety_improvement',
  'other',
]);

export const ConstructionPlanWorkflowEventTypeSchema = z.enum([
  'draft_created',
  'revision_created',
  'plan_cloned',
  'template_binding_migrated',
  'submit_review',
  'request_changes',
  'complete_review',
  'approve',
  'issue',
  'supersede',
  'request_unlock',
  'force_unlock',
  'expire_unlock',
  'withdraw_review',
  'pdf_download_intent',
  'pdf_download_complete',
  'archive',
  'void',
]);

export const PlanSectionStatusSchema = z.enum([
  'empty',
  'in_progress',
  'complete',
  'not_applicable',
]);

export const SourcedValueSourceSchema = z.enum([
  'site',
  'company',
  'team',
  'worker',
  'template',
  'manual',
]);

export const createSourcedValueSchema = <T extends z.ZodTypeAny>(valueSchema: T) => z.object({
  value: valueSchema,
  source: SourcedValueSourceSchema,
  sourceId: z.string().optional(),
  sourceUpdatedAt: IsoDateTimeSchema.optional(),
  capturedAt: IsoDateTimeSchema,
  overridden: z.boolean().optional(),
});

export const ConstructionPlanSiteMasterSnapshotSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  code: z.string().optional(),
  address: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.string().optional(),
  responsibleTeamId: z.string().optional(),
  responsibleTeamName: z.string().optional(),
  clientCompanyId: z.string().optional(),
  clientCompanyName: z.string().optional(),
  contractorCompanyId: z.string().optional(),
  contractorCompanyName: z.string().optional(),
  partnerCompanyId: z.string().optional(),
  partnerCompanyName: z.string().optional(),
  siteType: z.string().optional(),
});

export const ConstructionPlanCompanyMasterSnapshotSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  code: z.string().optional(),
  businessNumber: z.string().optional(),
  representativeName: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  fax: z.string().optional(),
  email: z.string().optional(),
  type: z.string().optional(),
  status: z.string().optional(),
});

export const ConstructionPlanTeamMasterSnapshotSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.string().optional(),
  leaderWorkerId: z.string().optional(),
  leaderName: z.string().optional(),
  companyId: z.string().optional(),
  companyName: z.string().optional(),
  parentTeamId: z.string().optional(),
  parentTeamName: z.string().optional(),
  status: z.string().optional(),
});

const ConstructionPlanSiteMasterSourceSchema = createSourcedValueSchema(
  ConstructionPlanSiteMasterSnapshotSchema,
).extend({ source: z.literal('site'), sourceId: z.string().min(1) });
const ConstructionPlanCompanyMasterSourceSchema = createSourcedValueSchema(
  ConstructionPlanCompanyMasterSnapshotSchema,
).extend({ source: z.literal('company'), sourceId: z.string().min(1) });
const ConstructionPlanTeamMasterSourceSchema = createSourcedValueSchema(
  ConstructionPlanTeamMasterSnapshotSchema,
).extend({ source: z.literal('team'), sourceId: z.string().min(1) });

export const ConstructionPlanErpSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  capturedAt: IsoDateTimeSchema,
  site: ConstructionPlanSiteMasterSourceSchema,
  clientCompany: ConstructionPlanCompanyMasterSourceSchema.optional(),
  contractorCompany: ConstructionPlanCompanyMasterSourceSchema.optional(),
  partnerCompany: ConstructionPlanCompanyMasterSourceSchema.optional(),
  responsibleTeam: ConstructionPlanTeamMasterSourceSchema.optional(),
  fieldProvenance: ConstructionPlanErpFieldProvenanceSchema.optional(),
}).superRefine((snapshot, context) => {
  const sources = ['site', 'clientCompany', 'contractorCompany', 'partnerCompany', 'responsibleTeam'] as const;
  sources.forEach((slot) => {
    const source = snapshot[slot];
    if (!source) return;
    const allowedFields = CONSTRUCTION_PLAN_ERP_REFRESH_FIELDS[slot as ConstructionPlanErpRefreshSlot];
    const provenance = snapshot.fieldProvenance ?? {};
    allowedFields.forEach((field) => {
      const fieldId = `${slot}.${field}`;
      const entry = provenance[fieldId];
      const value = (source.value as Record<string, unknown>)[field];
      if (entry && (entry.sourceId !== source.sourceId || value === undefined)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['fieldProvenance', fieldId],
          message: 'ERP field provenance is not bound to its source value.',
        });
      }
      if (source.overridden === true && value !== undefined && !entry) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['fieldProvenance', fieldId],
          message: 'Mixed ERP source requires provenance for every retained field.',
        });
      }
    });
  });
});

export const SafeWorkerStatusSchema = z.enum([
  'active',
  'inactive',
  'on_leave',
  'unknown',
]);

export const SafeWorkerDtoSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: z.string().optional(),
  position: z.string().optional(),
  teamId: z.string().optional(),
  teamName: z.string().optional(),
  /**
   * Optional source-site identity used only to distinguish an explicitly
   * cross-site assignment. Legacy workers without this field remain neutral.
   */
  siteId: z.string().min(1).optional(),
  status: SafeWorkerStatusSchema,
  photoUrl: z.string().optional(),
  contact: z.string().optional(),
});

export const OrganizationRoleSchema = z.enum([
  'site_manager',
  'construction_manager',
  'safety_manager',
  'quality_manager',
  'equipment_manager',
  'team_leader',
  'crew_member',
]);

export const OrganizationRoleAssignmentSchema = z.object({
  id: z.string().min(1),
  role: OrganizationRoleSchema,
  label: z.string().min(1),
  required: z.boolean(),
  worker: SafeWorkerDtoSchema.optional(),
  responsibilities: z.array(z.string()).default([]),
  order: z.number().int().nonnegative(),
  externalAssignment: z.boolean().default(false),
  exceptionReason: z.string().trim().min(5).max(500).optional(),
});

export const ConstructionPlanWorkerDirectoryProvenanceSchema = z.object({
  captureKind: z.enum(['initial', 'refresh']),
  sourceSiteId: z.string().min(1).max(200),
  sourceTeamId: z.string().min(1).max(200).optional(),
  capturedAt: IsoDateTimeSchema,
  sourceMasterHash: z.string().regex(/^[a-f0-9]{64}$/),
  sourceWorkerIds: z.array(z.string().min(1).max(200)).max(500)
    .refine((ids) => new Set(ids).size === ids.length, 'Worker source IDs must be unique.'),
  appliedBy: z.string().min(1).max(200).optional(),
  appliedAt: IsoDateTimeSchema.optional(),
  changeReason: z.string().min(5).max(500).optional(),
  auditEventId: z.string().min(1).max(200).optional(),
}).strict().superRefine((entry, context) => {
  const evidence = [entry.appliedBy, entry.appliedAt, entry.changeReason, entry.auditEventId];
  if (entry.captureKind === 'refresh' && evidence.some((value) => !value)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Worker refresh provenance is incomplete.' });
  }
  if (entry.captureKind === 'initial' && evidence.some((value) => value !== undefined)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Initial worker provenance cannot claim refresh evidence.' });
  }
});

export const OrganizationSnapshotSchema = z.object({
  capturedAt: IsoDateTimeSchema,
  sourceSiteId: z.string().optional(),
  assignments: z.array(OrganizationRoleAssignmentSchema).default([]),
  additionalWorkers: z.array(SafeWorkerDtoSchema).default([]),
  workerDirectoryProvenance: ConstructionPlanWorkerDirectoryProvenanceSchema.optional(),
}).superRefine((snapshot, context) => {
  if (snapshot.workerDirectoryProvenance
    && snapshot.sourceSiteId
    && snapshot.workerDirectoryProvenance.sourceSiteId !== snapshot.sourceSiteId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['workerDirectoryProvenance', 'sourceSiteId'],
      message: 'Worker directory provenance is not bound to the organization site.',
    });
  }
});

export const ProjectSnapshotSchema = z.object({
  capturedAt: IsoDateTimeSchema,
  siteName: z.string().default(''),
  address: z.string().optional(),
  clientName: z.string().optional(),
  contractorName: z.string().optional(),
  constructionPeriod: z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }).optional(),
  buildings: z.array(z.string()).default([]),
  floors: z.array(z.string()).default([]),
  zones: z.array(z.string()).default([]),
  // Site-master media URLs can contain long-lived download tokens. Drawings
  // and approved photo records use their own controlled Storage contracts;
  // legacy projectSnapshot photos are therefore removed at the read boundary.
  sitePhotos: z.array(z.string()).transform(() => [] as string[]).default([]),
  emergencyContactsComplete: z.boolean().default(false),
  differsFromMaster: z.boolean().default(false),
});

/** Only plan-specific scope may be changed by the generic browser save path. */
export const ConstructionPlanProjectScopeUpdateSchema = ProjectSnapshotSchema.pick({
  buildings: true,
  floors: true,
  zones: true,
  emergencyContactsComplete: true,
}).partial().strict();

export const PlanSectionSchema = z.object({
  id: z.string().min(1),
  key: z.string().min(1),
  title: z.string().min(1),
  kind: SectionKindSchema,
  order: z.number().int().nonnegative(),
  pageNumbers: z.array(z.number().int().min(1)).default([]),
  required: z.boolean(),
  status: PlanSectionStatusSchema,
  content: z.record(z.unknown()).default({}),
  placeholders: z.array(z.string()).default([]),
  containsExampleValues: z.boolean().default(false),
  standardTextModified: z.boolean().default(false),
  standardTextModificationReason: z.string().optional(),
  notApplicableReason: z.string().optional(),
  updatedAt: IsoDateTimeSchema.optional(),
  updatedBy: z.string().optional(),
});

export const VerifiedEngineeringValueSchema = z.object({
  key: z.string().default(''),
  value: z.union([z.number(), z.string()]),
  unit: z.string().optional(),
  sourceDocumentId: z.string().default(''),
  sourceRevision: z.string().default(''),
  sourcePageOrSection: z.string().optional(),
  applicableZones: z.array(z.string()).default([]),
  verificationStatus: z.enum(['unverified', 'reviewed', 'approved']),
  verifiedBy: z.string().optional(),
  verifiedAt: IsoDateTimeSchema.optional(),
  manualInputReason: z.string().optional(),
});

export const EquipmentPlanItemSchema = z.object({
  id: z.string().min(1),
  category: z.enum(['lifting', 'transport', 'work-at-height', 'assembly', 'measurement']),
  equipmentName: z.string().default(''),
  model: z.string().optional(),
  registrationNo: z.string().optional(),
  ratedCapacity: z.string().optional(),
  workRadius: z.string().optional(),
  inspectionValidUntil: z.string().optional(),
  operatorWorkerId: z.string().optional(),
  signalerWorkerId: z.string().optional(),
  workZones: z.array(z.string()).default([]),
  plannedStages: z.array(z.string()).default([]),
  controlMeasures: z.array(z.string()).default([]),
});

export const RiskAssessmentItemSchema = z.object({
  id: z.string().min(1),
  assessmentMethodVersion: z.literal(2).optional(),
  workStage: z.string().default(''),
  hazard: z.string().default(''),
  initialProbability: z.number().int().min(1).max(5).optional(),
  initialSeverity: z.number().int().min(1).max(5).optional(),
  initialRiskLevel: z.enum(['low', 'medium', 'high', 'critical']),
  mitigationMeasures: z.array(z.string()).default([]),
  responsibleWorkerId: z.string().optional(),
  residualProbability: z.number().int().min(1).max(5).optional(),
  residualSeverity: z.number().int().min(1).max(5).optional(),
  residualRiskLevel: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  methodReference: z.string().optional(),
  reviewTrigger: z.string().optional(),
  verifiedBy: z.string().optional(),
});

export const ReleaseReadinessSchema = z.object({
  requiredReviewsComplete: z.boolean().default(false),
  unresolvedRequiredComments: z.number().int().nonnegative().default(0),
  snapshotHashMatches: z.boolean().default(false),
  pdfVisualCheckPassed: z.boolean().default(false),
  pdfTextCheckPassed: z.boolean().default(false),
  drawingLegendMonochromeDistinct: z.boolean().default(true),
  latestTemplateAvailable: z.boolean().default(false),
  latestDrawingRevisionAvailable: z.boolean().default(false),
  workerRefreshAvailable: z.boolean().default(false),
  recordAppendixAvailable: z.boolean().default(false),
});

export const ValidationSummarySchema = z.object({
  errors: z.number().int().nonnegative(),
  warnings: z.number().int().nonnegative(),
  checkedAt: IsoDateTimeSchema,
});

export const EditLockSchema = z.object({
  userId: z.string().min(1),
  userName: z.string().min(1),
  acquiredAt: IsoDateTimeSchema,
  heartbeatAt: IsoDateTimeSchema,
  expiresAt: IsoDateTimeSchema,
  expiresAtEpochMs: z.number().int().positive(),
});

export const PlanParticipantsSchema = z.object({
  authorIds: z.array(z.string()).default([]),
  reviewerIds: z.array(z.string()).default([]),
  approverIds: z.array(z.string()).default([]),
});

export const ConstructionPlanReviewCommentSummarySchema = z.object({
  totalOpen: z.number().int().nonnegative(),
  totalAddressed: z.number().int().nonnegative(),
  totalResolved: z.number().int().nonnegative(),
  requiredOpen: z.number().int().nonnegative(),
  requiredAddressed: z.number().int().nonnegative(),
  requiredResolved: z.number().int().nonnegative(),
  unresolvedRequired: z.number().int().nonnegative(),
  updatedAt: IsoDateTimeSchema,
}).superRefine((summary, context) => {
  if (summary.unresolvedRequired !== summary.requiredOpen + summary.requiredAddressed) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['unresolvedRequired'],
      message: 'unresolvedRequired must equal requiredOpen plus requiredAddressed.',
    });
  }
});

const ConstructionPlanTemplateSha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

/**
 * Server-owned immutable identity of the exact template publication used by
 * this plan. It is optional at the general read boundary only so that legacy
 * drafts can be opened and migrated; review/release validation requires it.
 */
export const ConstructionPlanTemplateBindingSchema = z.object({
  schemaVersion: z.literal(1),
  templateRecordId: z.string().min(1).max(240),
  templateKey: z.string().min(1).max(500),
  tradeType: ConstructionPlanTradeTypeSchema,
  templateId: z.string().min(1).max(160),
  templateVersion: z.string().min(1).max(80),
  rendererVersion: z.string().min(1).max(160),
  logicalPageCount: z.literal(42),
  manifestHash: ConstructionPlanTemplateSha256Schema,
  templateBundleHash: ConstructionPlanTemplateSha256Schema,
  templateHash: ConstructionPlanTemplateSha256Schema,
  lifecycleVersionAtCapture: z.number().int().positive(),
  publishedAt: IsoDateTimeSchema,
  capturedAt: IsoDateTimeSchema,
}).strict().superRefine((binding, context) => {
  const expectedKey = `${binding.tradeType}:${binding.templateId}@${binding.templateVersion}`;
  if (binding.templateKey !== expectedKey) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['templateKey'],
      message: 'Template binding key and exact identity do not match.',
    });
  }
});

export const ConstructionPlanTemplateBindingProjectionSchema = z.object({
  tradeType: ConstructionPlanTradeTypeSchema,
  templateId: z.string().min(1).max(160),
  templateVersion: z.string().min(1).max(80),
  templateHash: ConstructionPlanTemplateSha256Schema,
  manifestHash: ConstructionPlanTemplateSha256Schema,
  templateBundleHash: ConstructionPlanTemplateSha256Schema,
  templateBindingHash: ConstructionPlanTemplateSha256Schema,
}).strict();

export const ConstructionPlanTemplateMigrationSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal('template_revision_upgrade'),
  sourcePlanId: z.string().min(1).max(200),
  sourceTemplate: ConstructionPlanTemplateBindingProjectionSchema,
  targetTemplate: ConstructionPlanTemplateBindingProjectionSchema,
  reason: z.string().trim().min(10).max(500),
  migratedBy: z.string().min(1).max(200),
  migratedAt: IsoDateTimeSchema,
}).strict().superRefine((migration, context) => {
  if (migration.sourceTemplate.tradeType !== migration.targetTemplate.tradeType
    || (migration.sourceTemplate.templateId === migration.targetTemplate.templateId
      && migration.sourceTemplate.templateVersion === migration.targetTemplate.templateVersion)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['targetTemplate'],
      message: 'Template migration must select a different version of the same trade.',
    });
  }
});

export const ConstructionPlanSchema = z.object({
  id: z.string().min(1),
  siteId: z.string(),
  title: z.string(),
  tradeType: ConstructionPlanTradeTypeSchema,
  documentNo: z.string(),
  documentDate: z.string(),
  revision: z.number().int().nonnegative(),
  status: PlanStatusSchema,
  templateId: z.string().min(1),
  templateVersion: z.string().min(1),
  rendererVersion: z.string().min(1),
  templateBinding: ConstructionPlanTemplateBindingSchema.optional(),
  templateHash: ConstructionPlanTemplateSha256Schema.optional(),
  manifestHash: ConstructionPlanTemplateSha256Schema.optional(),
  templateBundleHash: ConstructionPlanTemplateSha256Schema.optional(),
  templateBindingHash: ConstructionPlanTemplateSha256Schema.optional(),
  templateMigration: ConstructionPlanTemplateMigrationSchema.optional(),
  schemaVersion: z.number().int().positive(),
  projectSnapshot: ProjectSnapshotSchema,
  erpSnapshot: ConstructionPlanErpSnapshotSchema.optional(),
  organizationSnapshot: OrganizationSnapshotSchema,
  sections: z.array(PlanSectionSchema).default([]),
  sectionOrder: z.array(z.string()).default([]),
  selectedSectionKeys: z.array(z.string().trim().min(1).max(160)).min(4).optional(),
  drawings: z.array(PlanDrawingSchema).default([]),
  drawingApplicability: z.array(DrawingApplicabilityDecisionSchema).default([]),
  engineeringValues: z.array(VerifiedEngineeringValueSchema).default([]),
  equipmentPlan: z.array(EquipmentPlanItemSchema).default([]),
  riskAssessments: z.array(RiskAssessmentItemSchema).default([]),
  releaseReadiness: ReleaseReadinessSchema,
  validationSummary: ValidationSummarySchema,
  lockVersion: z.number().int().nonnegative(),
  editLock: EditLockSchema.optional(),
  activeReviewSnapshotId: z.string().optional(),
  activeReviewSnapshotHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  activeReviewSnapshotStoragePath: z.string().optional(),
  activeReviewSnapshotLockVersion: z.number().int().nonnegative().optional(),
  activeReviewPackageId: z.string().min(1).optional(),
  activeReviewCycleId: z.string().min(1).optional(),
  reviewRound: z.number().int().positive().optional(),
  commentSummary: ConstructionPlanReviewCommentSummarySchema.optional(),
  approvedSnapshotId: z.string().optional(),
  approvedSnapshotHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  approvedSnapshotStoragePath: z.string().optional(),
  approvedEvidenceId: z.string().min(1).optional(),
  approvedEvidenceHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  approverName: z.string().min(1).optional(),
  approvedAt: IsoDateTimeSchema.optional(),
  issuedExportId: z.string().optional(),
  issuedAt: IsoDateTimeSchema.optional(),
  issuedBy: z.string().min(1).optional(),
  issuedExportStoragePath: z.string().optional(),
  issuedExportSha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  issuedExportFileName: z.string().optional(),
  issuedExportPageCount: z.number().int().min(42).max(200).optional(),
  seriesId: z.string().min(1).optional(),
  lineageRootPlanId: z.string().min(1).optional(),
  revisionReason: z.string().min(5).optional(),
  revisionType: ConstructionPlanRevisionTypeSchema.optional(),
  sourceRevisionNo: z.number().int().nonnegative().optional(),
  sourceSnapshotHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  clonedFromPlanId: z.string().min(1).optional(),
  supersedesPlanId: z.string().optional(),
  supersededByPlanId: z.string().min(1).optional(),
  participants: PlanParticipantsSchema,
  createdBy: z.string().min(1),
  createdByName: z.string().optional(),
  createdAt: IsoDateTimeSchema,
  updatedBy: z.string().min(1),
  updatedAt: IsoDateTimeSchema,
});

/** Read-boundary migration for plans created before participant snapshots existed. */
export const normalizeLegacyConstructionPlanParticipants = (value: unknown): unknown => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return value;
  const record = value as Record<string, unknown>;
  if (record.participants !== undefined && record.participants !== null) return value;
  const createdBy = typeof record.createdBy === 'string' ? record.createdBy.trim() : '';
  if (!createdBy) return value;
  return {
    ...record,
    participants: {
      authorIds: [createdBy],
      reviewerIds: [],
      approverIds: [],
    },
  };
};

export const parseConstructionPlanWithLegacyDefaults = (value: unknown) =>
  ConstructionPlanSchema.parse(normalizeLegacyConstructionPlanParticipants(value));

export const CreateConstructionPlanInputSchema = z.object({
  siteId: z.string().min(1),
  tradeType: ConstructionPlanTradeTypeSchema.optional().default('system-shoring'),
  siteName: z.string().optional(),
  title: z.string().optional(),
  documentNo: z.string().optional(),
  documentDate: z.string().optional(),
  createdBy: z.string().min(1),
  createdByName: z.string().optional(),
  authorName: z.string().optional(),
  templateId: z.string().optional(),
  templateVersion: z.string().optional(),
  rendererVersion: z.string().optional(),
  projectSnapshot: ProjectSnapshotSchema.partial().optional(),
  organizationSnapshot: OrganizationSnapshotSchema.optional(),
  participants: PlanParticipantsSchema.partial().optional(),
  idempotencyKey: z.string().trim().min(1).max(128).optional(),
});

export const UpdateConstructionPlanInputSchema = ConstructionPlanSchema.omit({
  id: true,
  siteId: true,
  tradeType: true,
  documentNo: true,
  revision: true,
  status: true,
  templateId: true,
  templateVersion: true,
  rendererVersion: true,
  templateBinding: true,
  templateHash: true,
  manifestHash: true,
  templateBundleHash: true,
  templateBindingHash: true,
  templateMigration: true,
  schemaVersion: true,
  erpSnapshot: true,
  projectSnapshot: true,
  releaseReadiness: true,
  validationSummary: true,
  activeReviewSnapshotId: true,
  activeReviewSnapshotHash: true,
  activeReviewSnapshotStoragePath: true,
  activeReviewSnapshotLockVersion: true,
  activeReviewPackageId: true,
  activeReviewCycleId: true,
  reviewRound: true,
  commentSummary: true,
  approvedSnapshotId: true,
  approvedSnapshotHash: true,
  approvedSnapshotStoragePath: true,
  approvedEvidenceId: true,
  approvedEvidenceHash: true,
  approverName: true,
  approvedAt: true,
  issuedExportId: true,
  issuedAt: true,
  issuedBy: true,
  issuedExportStoragePath: true,
  issuedExportSha256: true,
  issuedExportFileName: true,
  issuedExportPageCount: true,
  participants: true,
  createdBy: true,
  createdByName: true,
  createdAt: true,
  updatedAt: true,
  lockVersion: true,
  editLock: true,
  seriesId: true,
  lineageRootPlanId: true,
  revisionReason: true,
  revisionType: true,
  sourceRevisionNo: true,
  sourceSnapshotHash: true,
  clonedFromPlanId: true,
  supersedesPlanId: true,
  supersededByPlanId: true,
}).partial().extend({
  projectSnapshot: ConstructionPlanProjectScopeUpdateSchema.optional(),
  updatedBy: z.string().min(1),
  expectedLockVersion: z.number().int().nonnegative().optional(),
});

export const ConstructionPlanListOptionsSchema = z.object({
  siteId: z.string().optional(),
  statuses: z.array(PlanStatusSchema).optional(),
  search: z.string().optional(),
  limit: z.number().int().positive().max(500).optional(),
}).optional();

export const EditLockResultSchema = z.object({
  acquired: z.boolean(),
  plan: ConstructionPlanSchema,
  lock: EditLockSchema.optional(),
  reason: z.enum(['held_by_other', 'not_found']).optional(),
});

export const ConstructionPlanSeriesSchema = z.object({
  id: z.string().min(1),
  siteId: z.string().min(1),
  documentNo: z.string().min(1),
  documentNoKey: z.string().min(1),
  tradeType: ConstructionPlanTradeTypeSchema,
  latestRevisionNo: z.number().int().nonnegative(),
  latestPlanId: z.string().min(1),
  latestIssuedPlanId: z.string().min(1).optional(),
});

export const ConstructionPlanSummarySchema = ConstructionPlanSchema.pick({
  id: true,
  seriesId: true,
  lineageRootPlanId: true,
  siteId: true,
  title: true,
  tradeType: true,
  documentNo: true,
  documentDate: true,
  revision: true,
  status: true,
  revisionReason: true,
  revisionType: true,
  sourceRevisionNo: true,
  sourceSnapshotHash: true,
  clonedFromPlanId: true,
  supersedesPlanId: true,
  supersededByPlanId: true,
  approvedSnapshotHash: true,
  issuedExportId: true,
  issuedExportStoragePath: true,
  issuedExportSha256: true,
  issuedExportFileName: true,
  issuedExportPageCount: true,
  issuedAt: true,
  issuedBy: true,
  createdBy: true,
  createdByName: true,
  createdAt: true,
  updatedBy: true,
  updatedAt: true,
});

export const ConstructionPlanWorkflowEventSchema = z.object({
  id: z.string().min(1),
  planId: z.string().min(1),
  seriesId: z.string().min(1).optional(),
  type: ConstructionPlanWorkflowEventTypeSchema,
  actorId: z.string().min(1),
  actorName: z.string().optional(),
  at: IsoDateTimeSchema,
  fromStatus: PlanStatusSchema.optional(),
  toStatus: PlanStatusSchema.optional(),
  sourcePlanId: z.string().min(1).optional(),
  targetPlanId: z.string().min(1).optional(),
  revisionNo: z.number().int().nonnegative().optional(),
  reason: z.string().optional(),
  revisionType: ConstructionPlanRevisionTypeSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const ConstructionPlanLineageSchema = z.object({
  series: ConstructionPlanSeriesSchema,
  plans: z.array(ConstructionPlanSummarySchema),
  currentIndex: z.number().int().nonnegative(),
  previous: ConstructionPlanSummarySchema.optional(),
  next: ConstructionPlanSummarySchema.optional(),
});

export const ConstructionPlanMutationResultSchema = z.object({
  planId: z.string().min(1),
  seriesId: z.string().min(1),
  revisionNo: z.number().int().nonnegative(),
  documentNo: z.string().min(1),
  idempotent: z.boolean(),
});

export type PlanStatus = z.infer<typeof PlanStatusSchema>;
export type ConstructionPlanRevisionType = z.infer<typeof ConstructionPlanRevisionTypeSchema>;
export type ConstructionPlanWorkflowEventType = z.infer<typeof ConstructionPlanWorkflowEventTypeSchema>;
export type PlanSectionStatus = z.infer<typeof PlanSectionStatusSchema>;
export type SourcedValueSource = z.infer<typeof SourcedValueSourceSchema>;
export type SourcedValue<T> = {
  value: T;
  source: SourcedValueSource;
  sourceId?: string;
  sourceUpdatedAt?: string;
  capturedAt: string;
  overridden?: boolean;
};
export type ConstructionPlanSiteMasterSnapshot = z.infer<typeof ConstructionPlanSiteMasterSnapshotSchema>;
export type ConstructionPlanCompanyMasterSnapshot = z.infer<typeof ConstructionPlanCompanyMasterSnapshotSchema>;
export type ConstructionPlanTeamMasterSnapshot = z.infer<typeof ConstructionPlanTeamMasterSnapshotSchema>;
export type ConstructionPlanErpSnapshot = z.infer<typeof ConstructionPlanErpSnapshotSchema>;
export type SafeWorkerStatus = z.infer<typeof SafeWorkerStatusSchema>;
export type SafeWorkerDto = z.infer<typeof SafeWorkerDtoSchema>;
export type OrganizationRole = z.infer<typeof OrganizationRoleSchema>;
export type OrganizationRoleAssignment = z.infer<typeof OrganizationRoleAssignmentSchema>;
export type OrganizationSnapshot = z.infer<typeof OrganizationSnapshotSchema>;
export type ProjectSnapshot = z.infer<typeof ProjectSnapshotSchema>;
export type PlanSection = z.infer<typeof PlanSectionSchema>;
export type VerifiedEngineeringValue = z.infer<typeof VerifiedEngineeringValueSchema>;
export type EquipmentPlanItem = z.infer<typeof EquipmentPlanItemSchema>;
export type RiskAssessmentItem = z.infer<typeof RiskAssessmentItemSchema>;
export type ReleaseReadiness = z.infer<typeof ReleaseReadinessSchema>;
export type ValidationSummary = z.infer<typeof ValidationSummarySchema>;
export type EditLock = z.infer<typeof EditLockSchema>;
export type PlanParticipants = z.infer<typeof PlanParticipantsSchema>;
export type ConstructionPlanReviewCommentSummary = z.infer<typeof ConstructionPlanReviewCommentSummarySchema>;
export type ConstructionPlanTemplateBinding = z.infer<typeof ConstructionPlanTemplateBindingSchema>;
export type ConstructionPlanTemplateBindingProjection = z.infer<typeof ConstructionPlanTemplateBindingProjectionSchema>;
export type ConstructionPlanTemplateMigration = z.infer<typeof ConstructionPlanTemplateMigrationSchema>;
export type ConstructionPlan = z.infer<typeof ConstructionPlanSchema>;
export type CreateConstructionPlanInput = z.input<typeof CreateConstructionPlanInputSchema>;
export type UpdateConstructionPlanInput = z.input<typeof UpdateConstructionPlanInputSchema>;
export type ConstructionPlanListOptions = z.input<typeof ConstructionPlanListOptionsSchema>;
export type EditLockResult = z.infer<typeof EditLockResultSchema>;
export type ConstructionPlanSeries = z.infer<typeof ConstructionPlanSeriesSchema>;
export type ConstructionPlanSummary = z.infer<typeof ConstructionPlanSummarySchema>;
export type ConstructionPlanWorkflowEvent = z.infer<typeof ConstructionPlanWorkflowEventSchema>;
export type ConstructionPlanLineage = z.infer<typeof ConstructionPlanLineageSchema>;
export type ConstructionPlanMutationResult = z.infer<typeof ConstructionPlanMutationResultSchema>;
