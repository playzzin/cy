import type { DrawingAnnotation, PlanDrawing } from '../../types';
import { PlanDrawingSchema } from '../../types';
import {
  canonicalDrawingPageFingerprint,
  resolveDrawingPreviewPage,
} from '../../domain/drawingPreview';
import type {
  DrawingObject,
  DrawingStudioValue,
  NormalizedPoint,
} from './types';
import { canonicalDrawingObjectStyle } from './layers';

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const normalizedPoints = (points: readonly NormalizedPoint[]): NormalizedPoint[] =>
  points.map((point) => ({
    x: Number(clamp01(point.x).toFixed(6)),
    y: Number(clamp01(point.y).toFixed(6)),
  }));

/** Remove tab-local/blob/bearer preview URLs before a studio value is saved. */
export const toPersistedDrawingStudioValue = (
  studio: DrawingStudioValue,
): DrawingStudioValue => ({
  schemaVersion: 1,
  objects: studio.objects.map((object) => ({
    ...object,
    points: object.points.map((point) => ({ ...point })),
    style: canonicalDrawingObjectStyle(object.layer),
  })),
  ...(studio.background
    ? {
        background: {
          fileName: studio.background.fileName,
          mimeType: studio.background.mimeType,
          sizeBytes: studio.background.sizeBytes,
          kind: studio.background.kind,
          ...(studio.background.storagePath ? { storagePath: studio.background.storagePath } : {}),
        },
      }
    : {}),
});

const optionalAnnotationAttributes = (
  source: DrawingAnnotation | DrawingObject,
): Partial<DrawingObject> => ({
  ...(source.sequence !== undefined ? { sequence: source.sequence } : {}),
  ...(source.startDate !== undefined ? { startDate: source.startDate } : {}),
  ...(source.endDate !== undefined ? { endDate: source.endDate } : {}),
  ...(source.reason !== undefined ? { reason: source.reason } : {}),
  ...(source.releaseCondition !== undefined ? { releaseCondition: source.releaseCondition } : {}),
  ...(source.equipmentType !== undefined ? { equipmentType: source.equipmentType } : {}),
  ...(source.equipmentId !== undefined ? { equipmentId: source.equipmentId } : {}),
  ...(source.entrance !== undefined ? { entrance: source.entrance } : {}),
  ...(source.destination !== undefined ? { destination: source.destination } : {}),
  ...(source.radius !== undefined ? { radius: source.radius } : {}),
  ...(source.responsibleWorkerId !== undefined ? { responsibleWorkerId: source.responsibleWorkerId } : {}),
  ...(source.responsibleRole !== undefined ? { responsibleRole: source.responsibleRole } : {}),
  ...(source.materialType !== undefined ? { materialType: source.materialType } : {}),
});

const objectGeometry = (object: DrawingObject): DrawingAnnotation['geometry'] | null => {
  const points = normalizedPoints(object.points);
  if (object.kind === 'rectangle' && points.length >= 2) {
    const left = Math.min(points[0].x, points[1].x);
    const top = Math.min(points[0].y, points[1].y);
    const width = Math.abs(points[1].x - points[0].x);
    const height = Math.abs(points[1].y - points[0].y);
    if (width <= 0 || height <= 0) return null;
    return { kind: 'rect', x: left, y: top, w: width, h: height, rotationDeg: object.rotationDeg ?? 0 };
  }
  if (object.kind === 'polygon' && points.length >= 3) {
    return { kind: 'polygon', vertices: points };
  }
  if ((object.kind === 'arrow' || object.kind === 'polyline') && points.length >= 2) {
    return {
      kind: 'polyline',
      vertices: object.kind === 'arrow' ? points.slice(0, 2) : points,
      arrowStart: object.arrowStart ?? false,
      arrowEnd: object.arrowEnd ?? object.kind === 'arrow',
    };
  }
  if (object.kind === 'ellipse' && points.length >= 2) {
    const left = Math.min(points[0].x, points[1].x);
    const top = Math.min(points[0].y, points[1].y);
    const width = Math.abs(points[1].x - points[0].x);
    const height = Math.abs(points[1].y - points[0].y);
    if (width <= 0 || height <= 0) return null;
    return { kind: 'ellipse', cx: left + width / 2, cy: top + height / 2, rx: width / 2, ry: height / 2 };
  }
  if (object.kind === 'marker' && points.length === 1) {
    return { kind: 'marker', x: points[0].x, y: points[0].y, markerType: object.markerType ?? 'pin' };
  }
  if (object.kind === 'text' && points.length >= 2) {
    const left = Math.min(points[0].x, points[1].x);
    const top = Math.min(points[0].y, points[1].y);
    const width = Math.abs(points[1].x - points[0].x);
    const height = Math.abs(points[1].y - points[0].y);
    if (width <= 0 || height <= 0) return null;
    return { kind: 'text', x: left, y: top, w: width, h: height, align: object.textAlign ?? 'left' };
  }
  return null;
};

/**
 * Rebuild the editor's supported object set from the persisted domain record.
 * The domain annotations are authoritative because validation, review snapshots,
 * and final PDF output all operate on that immutable representation.
 */
export const drawingAnnotationsToStudioObjects = (
  annotations: readonly DrawingAnnotation[],
  pageIndex = 0,
  pageFingerprint?: string,
): DrawingObject[] => annotations
  .filter((annotation) => annotation.pageIndex === pageIndex
    && (!pageFingerprint || !annotation.pageFingerprint || annotation.pageFingerprint === pageFingerprint))
  .sort((left, right) => (left.sequence ?? Number.MAX_SAFE_INTEGER) - (right.sequence ?? Number.MAX_SAFE_INTEGER))
  .flatMap((annotation): DrawingObject[] => {
    const base = {
      id: annotation.id,
      layer: annotation.layer,
      label: annotation.label,
      zoneCode: annotation.zoneCode ?? '',
      ...optionalAnnotationAttributes(annotation),
      style: canonicalDrawingObjectStyle(annotation.layer),
      locked: annotation.locked,
    };
    if (annotation.geometry.kind === 'rect') {
      return [{
        ...base,
        kind: 'rectangle',
        points: normalizedPoints([
          { x: annotation.geometry.x, y: annotation.geometry.y },
          {
            x: annotation.geometry.x + annotation.geometry.w,
            y: annotation.geometry.y + annotation.geometry.h,
          },
        ]),
        rotationDeg: annotation.geometry.rotationDeg,
      }];
    }
    if (annotation.geometry.kind === 'polygon') {
      return [{ ...base, kind: 'polygon', points: normalizedPoints(annotation.geometry.vertices) }];
    }
    if (annotation.geometry.kind === 'polyline') {
      const vertices = normalizedPoints(annotation.geometry.vertices);
      if (vertices.length < 2) return [];
      const simpleArrow = vertices.length === 2 && !annotation.geometry.arrowStart && annotation.geometry.arrowEnd;
      return [{
        ...base,
        kind: simpleArrow ? 'arrow' : 'polyline',
        points: simpleArrow ? [vertices[0], vertices[1]] : vertices,
        arrowStart: annotation.geometry.arrowStart,
        arrowEnd: annotation.geometry.arrowEnd,
      }];
    }
    if (annotation.geometry.kind === 'ellipse') {
      return [{
        ...base,
        kind: 'ellipse',
        points: normalizedPoints([
          { x: annotation.geometry.cx - annotation.geometry.rx, y: annotation.geometry.cy - annotation.geometry.ry },
          { x: annotation.geometry.cx + annotation.geometry.rx, y: annotation.geometry.cy + annotation.geometry.ry },
        ]),
      }];
    }
    if (annotation.geometry.kind === 'marker') {
      return [{
        ...base,
        kind: 'marker',
        points: normalizedPoints([{ x: annotation.geometry.x, y: annotation.geometry.y }]),
        markerType: annotation.geometry.markerType,
      }];
    }
    if (annotation.geometry.kind === 'text') {
      return [{
        ...base,
        kind: 'text',
        points: normalizedPoints([
          { x: annotation.geometry.x, y: annotation.geometry.y },
          { x: annotation.geometry.x + annotation.geometry.w, y: annotation.geometry.y + annotation.geometry.h },
        ]),
        textAlign: annotation.geometry.align,
      }];
    }
    return [];
  });

export const drawingStudioObjectsToAnnotations = (
  objects: readonly DrawingObject[],
  actorId: string,
  now = new Date().toISOString(),
  previous: readonly DrawingAnnotation[] = [],
  page: { pageIndex: number; pageFingerprint?: string } = { pageIndex: 0 },
): DrawingAnnotation[] => {
  const previousById = new Map(previous.map((annotation) => [annotation.id, annotation]));
  return objects.flatMap((object, index) => {
    const geometry = objectGeometry(object);
    if (!geometry) return [];
    const prior = previousById.get(object.id);
    const attributes = {
      ...optionalAnnotationAttributes(prior ?? object),
      ...optionalAnnotationAttributes(object),
    };
    return [{
      id: object.id,
      pageIndex: page.pageIndex,
      ...(page.pageFingerprint ? { pageFingerprint: page.pageFingerprint } : {}),
      layer: object.layer,
      geometry,
      style: canonicalDrawingObjectStyle(object.layer),
      label: object.label,
      ...(object.zoneCode ? { zoneCode: object.zoneCode } : {}),
      ...attributes,
      sequence: object.sequence ?? prior?.sequence ?? index + 1,
      styleVersion: prior?.styleVersion ?? 1,
      locked: object.locked ?? false,
      createdBy: prior?.createdBy ?? actorId,
      createdAt: prior?.createdAt ?? now,
      updatedBy: actorId,
      updatedAt: now,
    } satisfies DrawingAnnotation];
  });
};

export type CreatePlanDrawingFromStudioInput = {
  id: string;
  planId: string;
  studio: DrawingStudioValue;
  storagePath: string;
  sourceSha256: string;
  sourceGeneration?: string;
  previewPath?: string;
  drawingNo: string;
  title: string;
  applicableZones: string[];
  uploadedBy: string;
  now?: string;
};

export const createPlanDrawingFromStudio = (
  input: CreatePlanDrawingFromStudioInput,
): PlanDrawing => {
  const background = input.studio.background;
  if (!background) throw new Error('construction-plan-drawing-background-required');
  const now = input.now ?? new Date().toISOString();
  const mimeType = background.mimeType === 'application/pdf'
    ? 'application/pdf'
    : background.mimeType === 'image/png'
      ? 'image/png'
      : 'image/jpeg';

  return PlanDrawingSchema.parse({
    id: input.id,
    planId: input.planId,
    storagePath: input.storagePath,
    sourceSha256: input.sourceSha256,
    ...(input.sourceGeneration ? { sourceGeneration: input.sourceGeneration } : {}),
    originalFileName: background.fileName,
    mimeType,
    sizeBytes: background.sizeBytes,
    pageCount: 1,
    drawingNo: input.drawingNo,
    title: input.title,
    revision: '',
    approvalStatus: 'draft',
    applicableZones: input.applicableZones,
    previewStatus: background.kind === 'image' && input.previewPath ? 'ready' : 'pending',
    previewPaths: input.previewPath ? [input.previewPath] : [],
    pages: [],
    annotations: drawingStudioObjectsToAnnotations(
      input.studio.objects,
      input.uploadedBy,
      now,
      [],
      {
        pageIndex: 0,
        pageFingerprint: canonicalDrawingPageFingerprint(input.sourceSha256, 0),
      },
    ),
    uploadedBy: input.uploadedBy,
    uploadedAt: now,
  });
};

export const syncPlanDrawingFromStudio = (
  drawing: PlanDrawing,
  studio: DrawingStudioValue,
  actorId: string,
  now = new Date().toISOString(),
  pageIndex = 0,
): PlanDrawing => PlanDrawingSchema.parse({
  ...drawing,
  annotations: [
    ...drawing.annotations.filter((annotation) => annotation.pageIndex !== pageIndex),
    ...drawingStudioObjectsToAnnotations(
      studio.objects,
      actorId,
      now,
      drawing.annotations.filter((annotation) => annotation.pageIndex === pageIndex),
      {
        pageIndex,
        pageFingerprint: drawing.pages.find((page) => page.pageIndex === pageIndex)?.pageFingerprint
          ?? canonicalDrawingPageFingerprint(drawing.sourceSha256, pageIndex),
      },
    ),
  ],
});

export type ProjectPlanDrawingToStudioInput = {
  studio: DrawingStudioValue;
  drawing?: PlanDrawing;
  pageIndex?: number;
  runtimePreviewUrl?: string;
};

/**
 * Reconnect a stored editor value to the server-authored page manifest. The
 * editor background is always rebuilt from the immutable source drawing; a
 * derived raster URL is carried only by the runtime preview projection.
 */
export const projectPlanDrawingToStudio = ({
  studio,
  drawing,
  pageIndex = 0,
  runtimePreviewUrl,
}: ProjectPlanDrawingToStudioInput): DrawingStudioValue => {
  if (!drawing) return studio;
  const resolution = resolveDrawingPreviewPage(drawing, pageIndex);
  const originalBackground = {
    fileName: drawing.originalFileName,
    mimeType: drawing.mimeType,
    sizeBytes: drawing.sizeBytes,
    kind: drawing.mimeType === 'application/pdf' ? 'pdf' as const : 'image' as const,
    storagePath: drawing.storagePath,
  };
  if (!resolution.ready) {
    return {
      schemaVersion: 1,
      background: originalBackground,
      preview: resolution.status === 'failed'
        ? {
            status: 'failed',
            ...(resolution.errorCode ? { errorCode: resolution.errorCode } : {}),
            ...(resolution.errorMessage ? { errorMessage: resolution.errorMessage } : {}),
          }
        : { status: resolution.status === 'processing' ? 'processing' : 'pending' },
      objects: drawingAnnotationsToStudioObjects(drawing.annotations, pageIndex),
    };
  }
  return {
    schemaVersion: 1,
    background: originalBackground,
    preview: {
      status: 'ready',
      pageIndex,
      pageCount: drawing.pageCount,
      availablePageIndexes: drawing.pages.length
        ? drawing.pages.map((page) => page.pageIndex).sort((left, right) => left - right)
        : [0],
      pageFingerprint: resolution.pageFingerprint,
      storagePath: resolution.storagePath,
      ...(runtimePreviewUrl ? { sourceUrl: runtimePreviewUrl } : {}),
    },
    objects: drawingAnnotationsToStudioObjects(
      drawing.annotations,
      pageIndex,
      resolution.pageFingerprint,
    ),
  };
};

export const sha256File = async (file: File): Promise<string> => {
  const bytes = await file.arrayBuffer();
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
};
