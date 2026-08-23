import { z } from 'zod';
import {
  DrawingPageMetadataSchema,
  DrawingPreviewStatusSchema,
  PlanDrawingSchema,
  type DrawingPageMetadata,
  type DrawingPreviewStatus,
  type PlanDrawing,
} from '../types';

const SHA256_PATTERN = /^[a-f0-9]{64}$/i;
const SAFE_DRAWING_ID_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9_-]{0,158}[A-Za-z0-9])?$/;
const MAX_PDF_PAGE_COUNT = 50;

const normalizedSourceSha256 = (value: string): string => value.trim().toLowerCase();

export const sanitizeDrawingPreviewStorageSegment = (value: string): string => {
  const normalized = value
    .normalize('NFKC')
    .replace(/[\\/#?%[\]*]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/\.{2,}/g, '.')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return normalized || 'drawing';
};

/**
 * Stable page identity for an immutable source object. Geometry lives beside
 * this value and must not change the identity used by comments/annotations.
 */
export const canonicalDrawingPageFingerprint = (
  sourceSha256: string,
  pageIndex: number,
): string => {
  if (!Number.isInteger(pageIndex) || pageIndex < 0) {
    throw new Error('construction-plan-drawing-preview-invalid-page-index');
  }
  const normalizedSha256 = normalizedSourceSha256(sourceSha256);
  if (!normalizedSha256) {
    throw new Error('construction-plan-drawing-preview-source-sha-required');
  }
  return `source:${normalizedSha256}:page:${pageIndex}`;
};

const ReadyDrawingPreviewPageSchema = DrawingPageMetadataSchema.extend({
  previewPath: z.string().min(1).max(1024),
  previewGeneration: z.string().regex(/^\d+$/).max(200),
  previewSha256: z.string().regex(SHA256_PATTERN),
});

export const EnsureConstructionPlanDrawingPreviewRequestSchema = z.object({
  planId: z.string().trim().min(1).max(200),
  // Preview path authority requires a one-to-one Storage segment. Legacy IDs
  // outside this alphabet must be migrated before server rendering.
  drawingId: z.string().trim().regex(SAFE_DRAWING_ID_PATTERN),
  expectedSourceStoragePath: z.string().trim().min(1).max(1024),
  expectedSourceSha256: z.string().trim().regex(SHA256_PATTERN),
  expectedSourceGeneration: z.string().trim().regex(/^\d+$/).max(200),
  // Omit to render every physical page. Supplying indexes is reserved for an
  // idempotent repair/retry; READY still requires a complete page manifest.
  requestedPageIndexes: z.array(z.number().int().min(0).max(MAX_PDF_PAGE_COUNT - 1))
    .min(1)
    .max(MAX_PDF_PAGE_COUNT)
    .optional(),
  idempotencyKey: z.string().trim().min(1).max(128),
}).superRefine((request, context) => {
  if (request.requestedPageIndexes
    && new Set(request.requestedPageIndexes).size !== request.requestedPageIndexes.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['requestedPageIndexes'],
      message: 'drawing-preview-page-index-duplicate',
    });
  }
});

export const ConstructionPlanDrawingPreviewResultSchema = z.object({
  siteId: z.string().trim().min(1).max(200),
  planId: z.string().trim().min(1).max(200),
  drawingId: z.string().trim().regex(SAFE_DRAWING_ID_PATTERN),
  sourceStoragePath: z.string().trim().min(1).max(1024),
  sourceSha256: z.string().trim().regex(SHA256_PATTERN),
  sourceGeneration: z.string().trim().regex(/^\d+$/).max(200),
  previewStatus: DrawingPreviewStatusSchema,
  pageCount: z.number().int().min(1).max(MAX_PDF_PAGE_COUNT),
  pages: z.array(ReadyDrawingPreviewPageSchema).max(MAX_PDF_PAGE_COUNT).default([]),
  previewPaths: z.array(z.string().trim().min(1).max(1024)).max(MAX_PDF_PAGE_COUNT).default([]),
  errorCode: z.string().trim().min(1).max(120).optional(),
  errorMessage: z.string().trim().min(1).max(500).optional(),
  processedAt: z.string().datetime({ offset: true }),
  idempotent: z.boolean().default(false),
}).superRefine((result, context) => {
  const sortedPages = [...result.pages].sort((left, right) => left.pageIndex - right.pageIndex);
  const pageIndexes = sortedPages.map((page) => page.pageIndex);
  const pagePreviewPaths = sortedPages.map((page) => page.previewPath);
  if (new Set(pageIndexes).size !== pageIndexes.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['pages'], message: 'drawing-preview-page-index-duplicate' });
  }
  if (new Set(pagePreviewPaths).size !== pagePreviewPaths.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['pages'], message: 'drawing-preview-path-duplicate' });
  }
  sortedPages.forEach((page, index) => {
    if (page.pageIndex >= result.pageCount) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['pages', index, 'pageIndex'], message: 'drawing-preview-page-out-of-range' });
    }
    const expectedFingerprint = canonicalDrawingPageFingerprint(result.sourceSha256, page.pageIndex);
    if (page.pageFingerprint !== expectedFingerprint) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['pages', index, 'pageFingerprint'], message: 'drawing-preview-fingerprint-mismatch' });
    }
    const pathParts = page.previewPath.split('/');
    const expectedFileName = `page-${String(page.pageIndex + 1).padStart(4, '0')}.png`;
    if (pathParts.length !== 7
      || pathParts[0] !== 'construction-plans'
      || pathParts[1] !== result.siteId
      || pathParts[2] !== result.planId
      || pathParts[3] !== 'previews'
      || pathParts[4] !== sanitizeDrawingPreviewStorageSegment(result.drawingId)
      || pathParts[5] !== normalizedSourceSha256(result.sourceSha256)
      || pathParts[6] !== expectedFileName) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['pages', index, 'previewPath'], message: 'drawing-preview-server-path-required' });
    }
  });

  if (!result.sourceStoragePath.startsWith(
    `construction-plans/${result.siteId}/${result.planId}/drawings/`,
  )) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['sourceStoragePath'], message: 'drawing-preview-source-path-mismatch' });
  }

  if (result.previewStatus === 'ready') {
    if (sortedPages.length !== result.pageCount
      || sortedPages.some((page, index) => page.pageIndex !== index)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['pages'], message: 'drawing-preview-ready-all-pages-required' });
    }
    if (pagePreviewPaths.length !== result.previewPaths.length
      || pagePreviewPaths.some((path, index) => path !== result.previewPaths[index])) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['previewPaths'], message: 'drawing-preview-path-map-mismatch' });
    }
  } else if (result.pages.length > 0 || result.previewPaths.length > 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['pages'], message: 'drawing-preview-non-ready-pages-not-allowed' });
  }

  if (result.previewStatus === 'failed' && !result.errorCode) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['errorCode'], message: 'drawing-preview-failure-code-required' });
  }
});

export type EnsureConstructionPlanDrawingPreviewRequest = z.input<
  typeof EnsureConstructionPlanDrawingPreviewRequestSchema
>;
export type ConstructionPlanDrawingPreviewResult = z.infer<
  typeof ConstructionPlanDrawingPreviewResultSchema
>;

export type DrawingPreviewUnavailableReason =
  | 'preview-not-ready'
  | 'page-out-of-range'
  | 'page-metadata-required'
  | 'page-not-generated'
  | 'page-path-map-mismatch'
  | 'page-fingerprint-missing'
  | 'pdf-source-is-not-preview';

export type DrawingPreviewPageResolution =
  | {
      ready: true;
      status: 'ready';
      pageIndex: number;
      pageFingerprint: string;
      storagePath: string;
      metadata?: DrawingPageMetadata;
    }
  | {
      ready: false;
      status: DrawingPreviewStatus;
      pageIndex: number;
      reason: DrawingPreviewUnavailableReason;
      errorCode?: string;
      errorMessage?: string;
    };

/**
 * Resolve one exact page. It deliberately never substitutes another generated
 * page because doing so would move normalized annotations between pages.
 */
export const resolveDrawingPreviewPage = (
  drawing: PlanDrawing,
  pageIndex = 0,
): DrawingPreviewPageResolution => {
  if (!Number.isInteger(pageIndex) || pageIndex < 0 || pageIndex >= drawing.pageCount) {
    return { ready: false, status: drawing.previewStatus, pageIndex, reason: 'page-out-of-range' };
  }
  if (drawing.previewStatus !== 'ready') {
    return {
      ready: false,
      status: drawing.previewStatus,
      pageIndex,
      reason: 'preview-not-ready',
      ...(drawing.previewErrorCode ? { errorCode: drawing.previewErrorCode } : {}),
      ...(drawing.previewErrorMessage ? { errorMessage: drawing.previewErrorMessage } : {}),
    };
  }

  const page = drawing.pages.find((candidate) => candidate.pageIndex === pageIndex);
  let storagePath = page?.previewPath?.trim();
  let pageFingerprint = page?.pageFingerprint.trim();

  if (page) {
    if (!storagePath) {
      return { ready: false, status: 'ready', pageIndex, reason: 'page-not-generated' };
    }
    if (!drawing.previewPaths.includes(storagePath)) {
      return { ready: false, status: 'ready', pageIndex, reason: 'page-path-map-mismatch' };
    }
  } else if (drawing.pages.length > 0) {
    return { ready: false, status: 'ready', pageIndex, reason: 'page-not-generated' };
  } else if (drawing.pageCount === 1 && pageIndex === 0) {
    // Read-boundary support for existing single-page image/manual-preview data.
    storagePath = drawing.previewPaths[0]?.trim()
      || (drawing.mimeType !== 'application/pdf' ? drawing.storagePath.trim() : undefined);
    pageFingerprint = canonicalDrawingPageFingerprint(drawing.sourceSha256, 0);
  } else {
    return { ready: false, status: 'ready', pageIndex, reason: 'page-metadata-required' };
  }

  if (!storagePath) {
    return { ready: false, status: 'ready', pageIndex, reason: 'page-not-generated' };
  }
  if (!pageFingerprint) {
    return { ready: false, status: 'ready', pageIndex, reason: 'page-fingerprint-missing' };
  }
  if (drawing.mimeType === 'application/pdf' && storagePath === drawing.storagePath) {
    return { ready: false, status: 'ready', pageIndex, reason: 'pdf-source-is-not-preview' };
  }
  return {
    ready: true,
    status: 'ready',
    pageIndex,
    pageFingerprint,
    storagePath,
    ...(page ? { metadata: page } : {}),
  };
};

const VALID_PREVIEW_STATUS_TRANSITIONS: Record<DrawingPreviewStatus, readonly DrawingPreviewStatus[]> = {
  pending: ['pending', 'processing', 'ready', 'failed'],
  processing: ['processing', 'ready', 'failed'],
  failed: ['processing', 'ready', 'failed'],
  ready: ['ready'],
};

/**
 * Merge a server-authored preview manifest while proving that it still belongs
 * to the same immutable source. Only derived fields can change.
 */
export const applyDrawingPreviewResult = (
  drawing: PlanDrawing,
  rawResult: unknown,
): PlanDrawing => {
  const result = ConstructionPlanDrawingPreviewResultSchema.parse(rawResult);
  if (result.planId !== drawing.planId
    || result.drawingId !== drawing.id
    || result.sourceStoragePath !== drawing.storagePath
    || normalizedSourceSha256(result.sourceSha256) !== normalizedSourceSha256(drawing.sourceSha256)
    || (drawing.sourceGeneration && result.sourceGeneration !== drawing.sourceGeneration)) {
    throw new Error('construction-plan-drawing-preview-stale-source');
  }
  if (!VALID_PREVIEW_STATUS_TRANSITIONS[drawing.previewStatus].includes(result.previewStatus)) {
    throw new Error('construction-plan-drawing-preview-status-regression');
  }

  const pages = result.previewStatus === 'ready'
    ? [...result.pages].sort((left, right) => left.pageIndex - right.pageIndex)
    : [];
  const fingerprints = new Map(pages.map((page) => [page.pageIndex, page.pageFingerprint]));

  return PlanDrawingSchema.parse({
    ...drawing,
    sourceGeneration: drawing.sourceGeneration ?? result.sourceGeneration,
    pageCount: result.pageCount,
    previewStatus: result.previewStatus,
    previewPaths: result.previewStatus === 'ready' ? pages.map((page) => page.previewPath) : [],
    pages,
    annotations: drawing.annotations.map((annotation) => (
      annotation.pageFingerprint || !fingerprints.has(annotation.pageIndex)
        ? annotation
        : { ...annotation, pageFingerprint: fingerprints.get(annotation.pageIndex) }
    )),
    ...(result.previewStatus === 'failed'
      ? {
          previewErrorCode: result.errorCode,
          ...(result.errorMessage ? { previewErrorMessage: result.errorMessage } : {}),
        }
      : {
          previewErrorCode: undefined,
          previewErrorMessage: undefined,
        }),
    previewUpdatedAt: result.processedAt,
  });
};
