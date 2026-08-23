import { z } from 'zod';

export const DrawingMimeTypeSchema = z.enum([
  'application/pdf',
  'image/png',
  'image/jpeg',
]);

export const DrawingApprovalStatusSchema = z.enum([
  'example',
  'draft',
  'reviewed',
  'approved',
  'superseded',
]);

export const DrawingPreviewStatusSchema = z.enum([
  'pending',
  'processing',
  'ready',
  'failed',
]);

export const DrawingLayerSchema = z.enum([
  'install',
  'dismantle',
  'retain',
  'equipment',
  'pedestrian',
  'lifting',
  'restricted',
  'storage',
]);

export const DrawingSlotSchema = z.enum(['D-01', 'D-02', 'D-03', 'D-04', 'D-05', 'D-06']);

export const DrawingApplicabilityDecisionSchema = z.object({
  drawingSlot: DrawingSlotSchema,
  decision: z.enum(['applicable', 'replacement', 'not_applicable']),
  drawingId: z.string().optional(),
  reason: z.string().default(''),
  reviewedBy: z.string().optional(),
  technicalReviewReference: z.string().optional(),
});

export const DrawingRotationSchema = z.union([
  z.literal(0),
  z.literal(90),
  z.literal(180),
  z.literal(270),
]);

export const NormalizedPointSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});

export const PdfPointSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

export const PdfBoxSchema = z.object({
  left: z.number().finite(),
  bottom: z.number().finite(),
  right: z.number().finite(),
  top: z.number().finite(),
}).superRefine((box, context) => {
  if (box.right <= box.left) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['right'],
      message: 'PDF box right must be greater than left.',
    });
  }
  if (box.top <= box.bottom) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['top'],
      message: 'PDF box top must be greater than bottom.',
    });
  }
});

export const DrawingPageMetadataSchema = z.object({
  pageIndex: z.number().int().nonnegative(),
  mediaBoxPt: PdfBoxSchema,
  cropBoxPt: PdfBoxSchema,
  rotation: DrawingRotationSchema,
  pageFingerprint: z.string().min(1),
  previewPath: z.string().optional(),
  /** Immutable Storage generation of the derived preview object. */
  previewGeneration: z.string().regex(/^\d+$/).optional(),
  /** SHA-256 of the derived preview bytes, independent from the source PDF hash. */
  previewSha256: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
});

export const AnnotationGeometrySchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('polygon'),
    vertices: z.array(NormalizedPointSchema).min(3),
  }),
  z.object({
    kind: z.literal('rect'),
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    w: z.number().positive().max(1),
    h: z.number().positive().max(1),
    rotationDeg: z.number().finite().default(0),
  }),
  z.object({
    kind: z.literal('polyline'),
    vertices: z.array(NormalizedPointSchema).min(2),
    arrowStart: z.boolean().default(false),
    arrowEnd: z.boolean().default(false),
  }),
  z.object({
    kind: z.literal('ellipse'),
    cx: z.number().min(0).max(1),
    cy: z.number().min(0).max(1),
    rx: z.number().positive().max(1),
    ry: z.number().positive().max(1),
  }),
  z.object({
    kind: z.literal('marker'),
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    markerType: z.string().min(1),
  }),
  z.object({
    kind: z.literal('text'),
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    w: z.number().positive().max(1),
    h: z.number().positive().max(1),
    align: z.enum(['left', 'center', 'right']),
  }),
]);

export const AnnotationStyleSchema = z.object({
  strokeToken: z.string().min(1),
  fillToken: z.string().optional(),
  strokeWidthPt: z.number().positive(),
  opacity: z.number().min(0).max(1),
  dash: z.enum(['solid', 'dash', 'dot']),
  hatch: z.enum(['none', 'diagonal', 'cross']).optional(),
  fontSizePt: z.number().positive().optional(),
});

const DrawingAnnotationAttributeTextSchema = z.string().trim().max(500).refine(
  (value) => !/(?:https?:\/\/|blob:|[?&]token=)/i.test(value),
  '도면 주석 구조화 속성에는 URL 또는 접근 토큰을 입력할 수 없습니다.',
);

export const DrawingAnnotationSchema = z.object({
  id: z.string().min(1),
  pageIndex: z.number().int().nonnegative(),
  pageFingerprint: z.string().min(1).optional(),
  layer: DrawingLayerSchema,
  geometry: AnnotationGeometrySchema,
  style: AnnotationStyleSchema,
  label: z.string().default(''),
  zoneCode: z.string().optional(),
  sequence: z.number().int().positive().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  reason: z.string().optional(),
  releaseCondition: DrawingAnnotationAttributeTextSchema.optional(),
  equipmentType: DrawingAnnotationAttributeTextSchema.optional(),
  equipmentId: DrawingAnnotationAttributeTextSchema.optional(),
  entrance: DrawingAnnotationAttributeTextSchema.optional(),
  destination: DrawingAnnotationAttributeTextSchema.optional(),
  radius: z.number().finite().positive().max(10_000).optional(),
  responsibleWorkerId: DrawingAnnotationAttributeTextSchema.optional(),
  responsibleRole: DrawingAnnotationAttributeTextSchema.optional(),
  materialType: DrawingAnnotationAttributeTextSchema.optional(),
  styleVersion: z.number().int().positive().default(1),
  locked: z.boolean().default(false),
  createdBy: z.string().min(1),
  createdAt: z.string().datetime({ offset: true }),
  updatedBy: z.string().min(1),
  updatedAt: z.string().datetime({ offset: true }),
});

export const PlanDrawingSchema = z.object({
  id: z.string().min(1),
  planId: z.string().min(1),
  storagePath: z.string().min(1),
  sourceSha256: z.string().min(1),
  /** Firebase Storage object generation captured when the immutable source was uploaded. */
  sourceGeneration: z.string().regex(/^\d+$/).optional(),
  /** Immutable canonical source revision encoded in storagePath (`rev-N`). */
  sourceRevision: z.number().int().positive().max(9999).optional(),
  originalFileName: z.string().min(1),
  mimeType: DrawingMimeTypeSchema,
  sizeBytes: z.number().int().positive(),
  pageCount: z.number().int().positive().max(50),
  drawingNo: z.string().default(''),
  title: z.string().default(''),
  revision: z.string().default(''),
  approvalStatus: DrawingApprovalStatusSchema,
  approvalReference: z.string().optional(),
  building: z.string().optional(),
  floor: z.string().optional(),
  zone: z.string().optional(),
  applicableZones: z.array(z.string()).default([]),
  scaleText: z.string().optional(),
  previewStatus: DrawingPreviewStatusSchema,
  previewPaths: z.array(z.string()).default([]),
  previewErrorCode: z.string().min(1).optional(),
  previewErrorMessage: z.string().min(1).optional(),
  previewUpdatedAt: z.string().datetime({ offset: true }).optional(),
  pages: z.array(DrawingPageMetadataSchema).default([]),
  annotations: z.array(DrawingAnnotationSchema).default([]),
  uploadedBy: z.string().min(1),
  uploadedAt: z.string().datetime({ offset: true }),
});

export type DrawingMimeType = z.infer<typeof DrawingMimeTypeSchema>;
export type DrawingApprovalStatus = z.infer<typeof DrawingApprovalStatusSchema>;
export type DrawingPreviewStatus = z.infer<typeof DrawingPreviewStatusSchema>;
export type DrawingLayer = z.infer<typeof DrawingLayerSchema>;
export type DrawingSlot = z.infer<typeof DrawingSlotSchema>;
export type DrawingApplicabilityDecision = z.infer<typeof DrawingApplicabilityDecisionSchema>;
export type DrawingRotation = z.infer<typeof DrawingRotationSchema>;
export type NormalizedPoint = z.infer<typeof NormalizedPointSchema>;
export type PdfPoint = z.infer<typeof PdfPointSchema>;
export type PdfBox = z.infer<typeof PdfBoxSchema>;
export type DrawingPageMetadata = z.infer<typeof DrawingPageMetadataSchema>;
export type AnnotationGeometry = z.infer<typeof AnnotationGeometrySchema>;
export type AnnotationStyle = z.infer<typeof AnnotationStyleSchema>;
export type DrawingAnnotation = z.infer<typeof DrawingAnnotationSchema>;
export type PlanDrawing = z.infer<typeof PlanDrawingSchema>;
