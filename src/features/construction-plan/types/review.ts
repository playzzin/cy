import { z } from 'zod';
import {
  ConstructionPlanReviewCommentSummarySchema,
  ConstructionPlanSchema,
} from './constructionPlan';

export const ConstructionPlanReviewHashSchema = z.string().regex(/^[a-f0-9]{64}$/);

export const ConstructionPlanReviewAnchorKindSchema = z.enum([
  'plan',
  'section',
  'field',
  'drawing',
]);

export const ConstructionPlanReviewCommentStatusSchema = z.enum([
  'open',
  'addressed',
  'resolved',
]);

export const ConstructionPlanReviewAnchorStatusSchema = z.enum([
  'active',
  'carried',
  'stale',
  'orphaned',
]);

export const ConstructionPlanReviewCommentTransitionActionSchema = z.enum([
  'address',
  'resolve',
  'reopen',
]);

export const ConstructionPlanReviewCommentVisibilitySchema = z.enum([
  'participants',
  'reviewers_and_approvers',
  'central_only',
]);

export const ConstructionPlanReviewPackageStatusSchema = z.enum([
  'active',
  'changes_requested',
  'completed',
  'approved',
  'superseded',
]);

export const ConstructionPlanReviewFieldEntityTypeSchema = z.enum([
  'plan',
  'section',
  'engineering_value',
  'equipment_item',
  'risk_assessment',
  'organization_assignment',
]);

export const ConstructionPlanReviewAnchorSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('plan'),
  }).strict(),
  z.object({
    kind: z.literal('section'),
    sectionId: z.string().trim().min(1).max(200),
  }).strict(),
  z.object({
    kind: z.literal('field'),
    entityType: ConstructionPlanReviewFieldEntityTypeSchema,
    entityId: z.string().trim().min(1).max(200),
    jsonPointer: z.string().trim().min(1).max(500).regex(
      /^(?:\/(?:[^~/]|~0|~1)*)+$/,
      'jsonPointer must be an RFC 6901 pointer and cannot use an array fieldPath.',
    ).refine(
      (value) => !/(?:^|\/)(?:__proto__|prototype|constructor)(?:\/|$)/.test(value),
      'jsonPointer contains a forbidden prototype segment.',
    ),
  }).strict(),
  z.object({
    kind: z.literal('drawing'),
    drawingId: z.string().trim().min(1).max(200),
    annotationId: z.string().trim().min(1).max(200).optional(),
    pageIndex: z.number().int().nonnegative(),
    pageFingerprint: z.string().trim().min(1).max(500),
    x: z.number().min(0).max(1).optional(),
    y: z.number().min(0).max(1).optional(),
  }).strict(),
]).superRefine((anchor, context) => {
  if (anchor.kind === 'drawing' && (anchor.x === undefined) !== (anchor.y === undefined)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: [anchor.x === undefined ? 'x' : 'y'],
      message: 'Drawing anchor coordinates must include both x and y.',
    });
  }
});

export const ConstructionPlanReviewDiffChangeTypeSchema = z.enum(['added', 'deleted', 'changed']);

export const ConstructionPlanReviewTextDiffSegmentSchema = z.object({
  kind: z.enum(['equal', 'added', 'removed']),
  text: z.string().max(6_500),
}).strict();

const ConstructionPlanReviewDiffLocationShape = {
  path: z.string().min(1).max(500),
  label: z.string().min(1).max(200),
  sectionId: z.string().min(1).max(200).optional(),
  sectionLabel: z.string().min(1).max(200).optional(),
  pageNumbers: z.array(z.number().int().min(1).max(200)).max(200),
};

export const ConstructionPlanReviewTextChangeSchema = z.object({
  id: z.string().min(1).max(200),
  changeType: ConstructionPlanReviewDiffChangeTypeSchema,
  ...ConstructionPlanReviewDiffLocationShape,
  before: z.string().max(6_500).optional(),
  after: z.string().max(6_500).optional(),
  beforeHash: ConstructionPlanReviewHashSchema.optional(),
  afterHash: ConstructionPlanReviewHashSchema.optional(),
  segments: z.array(ConstructionPlanReviewTextDiffSegmentSchema).max(320),
  valueTruncated: z.boolean(),
}).strict();

export const ConstructionPlanReviewFieldChangeSchema = z.object({
  id: z.string().min(1).max(200),
  entityKind: z.enum(['section', 'field']),
  changeType: ConstructionPlanReviewDiffChangeTypeSchema,
  ...ConstructionPlanReviewDiffLocationShape,
  before: z.string().max(900).optional(),
  after: z.string().max(900).optional(),
  beforeHash: ConstructionPlanReviewHashSchema.optional(),
  afterHash: ConstructionPlanReviewHashSchema.optional(),
  valueTruncated: z.boolean(),
}).strict();

export const ConstructionPlanReviewDrawingChangeSchema = z.object({
  id: z.string().min(1).max(200),
  changeType: ConstructionPlanReviewDiffChangeTypeSchema,
  drawingId: z.string().min(1).max(200),
  drawingLabel: z.string().min(1).max(200),
  pageNumbers: z.array(z.number().int().min(1).max(50)).max(50),
  changedFields: z.array(z.string().min(1).max(200)).max(64),
  beforeSummary: z.string().max(500).optional(),
  afterSummary: z.string().max(500).optional(),
  beforeHash: ConstructionPlanReviewHashSchema.optional(),
  afterHash: ConstructionPlanReviewHashSchema.optional(),
}).strict();

export const ConstructionPlanReviewAnnotationChangeSchema = z.object({
  id: z.string().min(1).max(200),
  changeType: ConstructionPlanReviewDiffChangeTypeSchema,
  drawingId: z.string().min(1).max(200),
  drawingLabel: z.string().min(1).max(200),
  annotationId: z.string().min(1).max(200),
  annotationLabel: z.string().min(1).max(200),
  pageIndex: z.number().int().min(0).max(49),
  pageId: z.string().min(1).max(200),
  pageLabel: z.string().min(1).max(50),
  changedParts: z.array(z.enum([
    'binding', 'layer', 'geometry', 'style', 'label', 'zone', 'schedule',
    'equipment', 'route', 'responsibility', 'material', 'release', 'metadata',
  ])).min(1).max(13),
  geometryBefore: z.string().max(500).optional(),
  geometryAfter: z.string().max(500).optional(),
  styleBefore: z.string().max(500).optional(),
  styleAfter: z.string().max(500).optional(),
  metadataBefore: z.string().max(500).optional(),
  metadataAfter: z.string().max(500).optional(),
  beforeHash: ConstructionPlanReviewHashSchema.optional(),
  afterHash: ConstructionPlanReviewHashSchema.optional(),
}).strict();

export const ConstructionPlanReviewDiffSummarySchema = z.object({
  // New packages always carry v2 detail. Defaults keep already immutable v1
  // packages readable without pretending that their missing detail exists.
  summaryVersion: z.literal(2).default(2),
  baselineKind: z.enum(['previous_submission', 'prior_issued', 'empty']).optional(),
  baselineContentHash: ConstructionPlanReviewHashSchema.optional(),
  currentContentHash: ConstructionPlanReviewHashSchema.optional(),
  summaryHash: ConstructionPlanReviewHashSchema.optional(),
  changedTopLevelFields: z.array(z.string().min(1).max(200)).max(1_000),
  changedSectionIds: z.array(z.string().min(1).max(200)).max(1_000),
  changedDrawingIds: z.array(z.string().min(1).max(200)).max(1_000),
  addedDrawingIds: z.array(z.string().min(1).max(200)).max(1_000),
  removedDrawingIds: z.array(z.string().min(1).max(200)).max(1_000),
  textChanges: z.array(ConstructionPlanReviewTextChangeSchema).max(800).default([]),
  fieldChanges: z.array(ConstructionPlanReviewFieldChangeSchema).max(800).default([]),
  drawingChanges: z.array(ConstructionPlanReviewDrawingChangeSchema).max(800).default([]),
  annotationChanges: z.array(ConstructionPlanReviewAnnotationChangeSchema).max(800).default([]),
  changeCount: z.number().int().nonnegative().max(800),
}).strict().superRefine((summary, context) => {
  if (!summary.summaryHash) return;
  const detailedCount = summary.textChanges.length
    + summary.fieldChanges.length
    + summary.drawingChanges.length
    + summary.annotationChanges.length;
  if (summary.changeCount !== detailedCount) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['changeCount'],
      message: 'Detailed review change count does not match the signed summary.',
    });
  }
  if (!summary.baselineKind || !summary.baselineContentHash || !summary.currentContentHash) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['summaryHash'],
      message: 'A signed review diff must include both immutable content bindings.',
    });
  }
});

export const ConstructionPlanReviewCommentSchema = z.object({
  id: z.string().min(1),
  planId: z.string().min(1),
  body: z.string().min(1).max(10_000),
  reviewPackageId: z.string().min(1),
  reviewSnapshotId: z.string().min(1),
  reviewSnapshotHash: ConstructionPlanReviewHashSchema,
  reviewCycleId: z.string().min(1),
  anchor: ConstructionPlanReviewAnchorSchema,
  anchorStatus: ConstructionPlanReviewAnchorStatusSchema,
  visibility: ConstructionPlanReviewCommentVisibilitySchema,
  required: z.boolean(),
  status: ConstructionPlanReviewCommentStatusSchema,
  version: z.number().int().nonnegative(),
  replyCount: z.number().int().nonnegative().default(0),
  authorReplyCount: z.number().int().nonnegative().default(0),
  createdBy: z.string().min(1),
  createdByName: z.string().optional(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
  addressedBy: z.string().min(1).optional(),
  addressedAt: z.string().datetime({ offset: true }).optional(),
  resolvedBy: z.string().min(1).optional(),
  resolvedAt: z.string().datetime({ offset: true }).optional(),
  reopenedBy: z.string().min(1).optional(),
  reopenedAt: z.string().datetime({ offset: true }).optional(),
  permissions: z.object({
    canReply: z.boolean(),
    canAddress: z.boolean(),
    canResolve: z.boolean(),
    canReopen: z.boolean(),
  }).partial().optional(),
});

export const ConstructionPlanReviewMessageSchema = z.object({
  id: z.string().min(1),
  planId: z.string().min(1),
  commentId: z.string().min(1),
  body: z.string().min(1),
  createdBy: z.string().min(1),
  createdByName: z.string().optional(),
  createdAt: z.string().datetime({ offset: true }),
});

export const ConstructionPlanReviewPackageSchema = z.object({
  id: z.string().min(1),
  planId: z.string().min(1),
  reviewSnapshotId: z.string().min(1),
  reviewSnapshotHash: ConstructionPlanReviewHashSchema,
  reviewSnapshotStoragePath: z.string().min(1),
  reviewSnapshotLockVersion: z.number().int().nonnegative(),
  reviewCycleId: z.string().min(1),
  round: z.number().int().positive(),
  status: ConstructionPlanReviewPackageStatusSchema,
  unresolvedRequiredAtSubmit: z.number().int().nonnegative(),
  commentSummary: ConstructionPlanReviewCommentSummarySchema,
  diffSummary: ConstructionPlanReviewDiffSummarySchema,
  previousPackageId: z.string().min(1).nullable().optional()
    .transform((value) => value ?? undefined),
  createdBy: z.string().min(1),
  createdByName: z.string().optional(),
  createdAt: z.string().datetime({ offset: true }),
});

export const ConstructionPlanSnapshotPointerSchema = z.object({
  planId: z.string().min(1),
  snapshotId: z.string().min(1),
  storagePath: z.string().min(1),
  contentHash: ConstructionPlanReviewHashSchema,
});

export const ConstructionPlanSnapshotRendererContentSchema = ConstructionPlanSchema.pick({
  siteId: true,
  title: true,
  tradeType: true,
  documentNo: true,
  documentDate: true,
  revision: true,
  seriesId: true,
  lineageRootPlanId: true,
  revisionReason: true,
  revisionType: true,
  sourceSnapshotHash: true,
  sourceRevisionNo: true,
  clonedFromPlanId: true,
  supersedesPlanId: true,
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
  projectSnapshot: true,
  organizationSnapshot: true,
  sections: true,
  sectionOrder: true,
  selectedSectionKeys: true,
  drawings: true,
  drawingApplicability: true,
  engineeringValues: true,
  equipmentPlan: true,
  riskAssessments: true,
  createdBy: true,
  createdByName: true,
  createdAt: true,
}).partial({
  createdBy: true,
  createdByName: true,
  createdAt: true,
}).extend({
  planId: z.string().min(1),
  snapshotSchemaVersion: z.union([z.literal(1), z.literal(2)]),
}).strict();

export const ConstructionPlanSnapshotEnvelopeSchema = z.object({
  snapshotSchemaVersion: z.union([z.literal(1), z.literal(2)]),
  kind: z.literal('review_submission'),
  planId: z.string().min(1),
  content: ConstructionPlanSnapshotRendererContentSchema,
}).strict();

const RequestIdSchema = z.string().trim().min(1).max(128);
const PlanIdSchema = z.string().trim().min(1).max(200);
const CommentBodySchema = z.string().trim().min(1).max(10_000);

export const CreateConstructionPlanReviewCommentRequestSchema = z.object({
  requestId: RequestIdSchema,
  planId: PlanIdSchema,
  reviewPackageId: z.string().trim().min(1).max(200).optional(),
  anchor: ConstructionPlanReviewAnchorSchema,
  visibility: ConstructionPlanReviewCommentVisibilitySchema,
  required: z.boolean(),
  body: CommentBodySchema,
}).superRefine((request, context) => {
  if (request.required && request.visibility !== 'participants') {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['visibility'],
      message: 'Required review comments must be visible to all participants.',
    });
  }
});

export const ReplyConstructionPlanReviewCommentRequestSchema = z.object({
  requestId: RequestIdSchema,
  planId: PlanIdSchema,
  commentId: z.string().trim().min(1).max(200),
  body: CommentBodySchema,
});

export const ListConstructionPlanReviewCommentsRequestSchema = z.object({
  planId: PlanIdSchema,
  reviewPackageId: z.string().trim().min(1).max(200).optional(),
});

export const ListConstructionPlanReviewMessagesRequestSchema = z.object({
  planId: PlanIdSchema,
  commentId: z.string().trim().min(1).max(200),
});

export const TransitionConstructionPlanReviewCommentRequestSchema = z.object({
  requestId: RequestIdSchema,
  planId: PlanIdSchema,
  commentId: z.string().trim().min(1).max(200),
  action: ConstructionPlanReviewCommentTransitionActionSchema,
  expectedVersion: z.number().int().nonnegative(),
  reason: z.string().trim().min(1).max(2_000).optional(),
});

export const ListConstructionPlanReviewPackagesRequestSchema = z.object({
  planId: PlanIdSchema,
});

export type ConstructionPlanReviewHash = z.infer<typeof ConstructionPlanReviewHashSchema>;
export type ConstructionPlanReviewAnchorKind = z.infer<typeof ConstructionPlanReviewAnchorKindSchema>;
export type ConstructionPlanReviewFieldEntityType = z.infer<typeof ConstructionPlanReviewFieldEntityTypeSchema>;
export type ConstructionPlanReviewCommentStatus = z.infer<typeof ConstructionPlanReviewCommentStatusSchema>;
export type ConstructionPlanReviewAnchorStatus = z.infer<typeof ConstructionPlanReviewAnchorStatusSchema>;
export type ConstructionPlanReviewCommentTransitionAction = z.infer<typeof ConstructionPlanReviewCommentTransitionActionSchema>;
export type ConstructionPlanReviewCommentVisibility = z.infer<typeof ConstructionPlanReviewCommentVisibilitySchema>;
export type ConstructionPlanReviewPackageStatus = z.infer<typeof ConstructionPlanReviewPackageStatusSchema>;
export type ConstructionPlanReviewAnchor = z.infer<typeof ConstructionPlanReviewAnchorSchema>;
export type ConstructionPlanReviewDiffChangeType = z.infer<typeof ConstructionPlanReviewDiffChangeTypeSchema>;
export type ConstructionPlanReviewTextDiffSegment = z.infer<typeof ConstructionPlanReviewTextDiffSegmentSchema>;
export type ConstructionPlanReviewTextChange = z.infer<typeof ConstructionPlanReviewTextChangeSchema>;
export type ConstructionPlanReviewFieldChange = z.infer<typeof ConstructionPlanReviewFieldChangeSchema>;
export type ConstructionPlanReviewDrawingChange = z.infer<typeof ConstructionPlanReviewDrawingChangeSchema>;
export type ConstructionPlanReviewAnnotationChange = z.infer<typeof ConstructionPlanReviewAnnotationChangeSchema>;
export type ConstructionPlanReviewDiffSummary = z.infer<typeof ConstructionPlanReviewDiffSummarySchema>;
export type ConstructionPlanReviewComment = z.infer<typeof ConstructionPlanReviewCommentSchema>;
export type ConstructionPlanReviewMessage = z.infer<typeof ConstructionPlanReviewMessageSchema>;
export type ConstructionPlanReviewPackage = z.infer<typeof ConstructionPlanReviewPackageSchema>;
export type ConstructionPlanSnapshotPointer = z.infer<typeof ConstructionPlanSnapshotPointerSchema>;
export type ConstructionPlanSnapshotRendererContent = z.infer<typeof ConstructionPlanSnapshotRendererContentSchema>;
export type ConstructionPlanSnapshotEnvelope = z.infer<typeof ConstructionPlanSnapshotEnvelopeSchema>;
export type ConstructionPlanSnapshotContent = ConstructionPlanSnapshotEnvelope['content'];
export type CreateConstructionPlanReviewCommentRequest = z.infer<typeof CreateConstructionPlanReviewCommentRequestSchema>;
export type ReplyConstructionPlanReviewCommentRequest = z.infer<typeof ReplyConstructionPlanReviewCommentRequestSchema>;
export type ListConstructionPlanReviewCommentsRequest = z.infer<typeof ListConstructionPlanReviewCommentsRequestSchema>;
export type ListConstructionPlanReviewMessagesRequest = z.infer<typeof ListConstructionPlanReviewMessagesRequestSchema>;
export type TransitionConstructionPlanReviewCommentRequest = z.infer<typeof TransitionConstructionPlanReviewCommentRequestSchema>;
export type ListConstructionPlanReviewPackagesRequest = z.infer<typeof ListConstructionPlanReviewPackagesRequestSchema>;
