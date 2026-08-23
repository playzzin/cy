import { z } from 'zod';
import type { DrawingStudioValue } from './types';

const DrawingLayerSchema = z.enum([
  'install',
  'dismantle',
  'retain',
  'equipment',
  'pedestrian',
  'lifting',
  'restricted',
  'storage',
]);

const NormalizedPointSchema = z.object({
  x: z.number().finite().min(0).max(1),
  y: z.number().finite().min(0).max(1),
});

const StructuredAttributeTextSchema = z.string().trim().max(500).refine(
  (value) => !/(?:https?:\/\/|blob:|[?&]token=)/i.test(value),
  'annotation-attribute-url-forbidden',
);

const DrawingObjectSchema = z.object({
  id: z.string().min(1).max(160),
  kind: z.enum(['rectangle', 'polygon', 'arrow', 'polyline', 'ellipse', 'marker', 'text']),
  layer: DrawingLayerSchema,
  points: z.array(NormalizedPointSchema).min(1).max(256),
  label: z.string().max(240),
  zoneCode: z.string().max(120),
  sequence: z.number().int().positive().optional(),
  startDate: StructuredAttributeTextSchema.optional(),
  endDate: StructuredAttributeTextSchema.optional(),
  reason: StructuredAttributeTextSchema.optional(),
  releaseCondition: StructuredAttributeTextSchema.optional(),
  equipmentType: StructuredAttributeTextSchema.optional(),
  equipmentId: StructuredAttributeTextSchema.optional(),
  entrance: StructuredAttributeTextSchema.optional(),
  destination: StructuredAttributeTextSchema.optional(),
  radius: z.number().finite().positive().max(10_000).optional(),
  responsibleWorkerId: StructuredAttributeTextSchema.optional(),
  responsibleRole: StructuredAttributeTextSchema.optional(),
  materialType: StructuredAttributeTextSchema.optional(),
  rotationDeg: z.number().finite().optional(),
  arrowStart: z.boolean().optional(),
  arrowEnd: z.boolean().optional(),
  markerType: z.string().min(1).max(80).optional(),
  textAlign: z.enum(['left', 'center', 'right']).optional(),
  style: z.object({
    strokeToken: z.string().min(1).max(160),
    fillToken: z.string().min(1).max(160).optional(),
    strokeWidthPt: z.number().positive().max(40),
    opacity: z.number().min(0).max(1),
    dash: z.enum(['solid', 'dash', 'dot']),
    hatch: z.enum(['none', 'diagonal', 'cross']).optional(),
    fontSizePt: z.number().positive().max(96).optional(),
  }).optional(),
  locked: z.boolean().optional(),
}).superRefine((object, context) => {
  if (object.kind === 'polygon' && object.points.length < 3) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['points'], message: 'polygon-needs-three-points' });
  }
  if (object.kind !== 'polygon' && object.kind !== 'marker' && object.points.length < 2) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['points'], message: 'shape-needs-two-points' });
  }
  if (object.kind === 'marker' && object.points.length !== 1) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['points'], message: 'marker-needs-one-point' });
  }
});

const DrawingBackgroundSchema = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z.enum(['application/pdf', 'image/png', 'image/jpeg']),
  sizeBytes: z.number().int().nonnegative().max(50 * 1024 * 1024),
  kind: z.enum(['image', 'pdf']),
  storagePath: z.string().min(1).max(1024).optional(),
  // sourceUrl is deliberately runtime-only; parsing supports blob URLs injected
  // after an authenticated Storage read but callers strip it before persistence.
  sourceUrl: z.string().min(1).max(4096).optional(),
}).superRefine((background, context) => {
  if (background.kind === 'pdf' && background.mimeType !== 'application/pdf') {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['mimeType'], message: 'pdf-mime-mismatch' });
  }
  if (background.kind === 'image' && !['image/png', 'image/jpeg'].includes(background.mimeType)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['mimeType'], message: 'image-mime-mismatch' });
  }
});

const DrawingRuntimePreviewSchema = z.discriminatedUnion('status', [
  z.object({ status: z.enum(['pending', 'processing']) }),
  z.object({
    status: z.literal('failed'),
    errorCode: z.string().min(1).max(120).optional(),
    errorMessage: z.string().min(1).max(500).optional(),
  }),
  z.object({
    status: z.literal('ready'),
    pageIndex: z.number().int().nonnegative(),
    pageCount: z.number().int().positive().max(50),
    availablePageIndexes: z.array(z.number().int().nonnegative()).min(1).max(50),
    pageFingerprint: z.string().min(1).max(500),
    storagePath: z.string().min(1).max(1024),
    sourceUrl: z.string().min(1).max(4096).optional(),
  }),
]);

export const DrawingStudioValueSchema = z.preprocess((input) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return input;
  const candidate = input as Record<string, unknown>;
  // Version 0 drafts used the same geometry but omitted the explicit version.
  return candidate.schemaVersion == null ? { ...candidate, schemaVersion: 1 } : input;
}, z.object({
  schemaVersion: z.literal(1),
  background: DrawingBackgroundSchema.optional(),
  preview: DrawingRuntimePreviewSchema.optional(),
  objects: z.array(DrawingObjectSchema).max(2000),
}));

export const emptyDrawingStudioValue = (): DrawingStudioValue => ({
  schemaVersion: 1,
  objects: [],
});

export const parseDrawingStudioValue = (input: unknown): DrawingStudioValue => {
  const parsed = DrawingStudioValueSchema.safeParse(input);
  return parsed.success ? parsed.data : emptyDrawingStudioValue();
};
