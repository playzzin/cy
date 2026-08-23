import type {
  AnnotationGeometry,
  DrawingRotation,
  NormalizedPoint,
  PdfBox,
  PdfPoint,
} from '../types';
import {
  AnnotationGeometrySchema,
  DrawingRotationSchema,
  NormalizedPointSchema,
  PdfBoxSchema,
  PdfPointSchema,
} from '../types';

export const DRAWING_COORDINATE_CONVENTION = {
  origin: 'top-left',
  unit: 'normalized-0-to-1',
  referenceBox: 'rotated-crop-box',
  pdfRotationDirection: 'clockwise',
} as const;

export type ViewportSize = { width: number; height: number };
export type GeometryBounds = { left: number; top: number; right: number; bottom: number };

const assertViewport = (viewport: ViewportSize): void => {
  if (!Number.isFinite(viewport.width) || !Number.isFinite(viewport.height)
    || viewport.width <= 0 || viewport.height <= 0) {
    throw new Error('construction-plan-invalid-drawing-viewport');
  }
};

const clampUnit = (value: number): number => Math.max(0, Math.min(1, value));

export const clampNormalizedPoint = (point: PdfPoint): NormalizedPoint => ({
  x: clampUnit(point.x),
  y: clampUnit(point.y),
});

export const normalizeScreenPoint = (
  point: PdfPoint,
  viewport: ViewportSize,
): NormalizedPoint => {
  assertViewport(viewport);
  PdfPointSchema.parse(point);
  return clampNormalizedPoint({
    x: point.x / viewport.width,
    y: point.y / viewport.height,
  });
};

export const denormalizeScreenPoint = (
  point: NormalizedPoint,
  viewport: ViewportSize,
): PdfPoint => {
  assertViewport(viewport);
  NormalizedPointSchema.parse(point);
  return {
    x: point.x * viewport.width,
    y: point.y * viewport.height,
  };
};

/** Rotates an unrotated, top-left normalized CropBox point for display. */
export const rotateNormalizedPoint = (
  point: NormalizedPoint,
  rotation: DrawingRotation,
): NormalizedPoint => {
  NormalizedPointSchema.parse(point);
  DrawingRotationSchema.parse(rotation);
  switch (rotation) {
    case 0:
      return { ...point };
    case 90:
      return { x: 1 - point.y, y: point.x };
    case 180:
      return { x: 1 - point.x, y: 1 - point.y };
    case 270:
      return { x: point.y, y: 1 - point.x };
  }
};

/** Removes display rotation and returns a top-left normalized CropBox point. */
export const unrotateNormalizedPoint = (
  point: NormalizedPoint,
  rotation: DrawingRotation,
): NormalizedPoint => {
  NormalizedPointSchema.parse(point);
  DrawingRotationSchema.parse(rotation);
  switch (rotation) {
    case 0:
      return { ...point };
    case 90:
      return { x: point.y, y: 1 - point.x };
    case 180:
      return { x: 1 - point.x, y: 1 - point.y };
    case 270:
      return { x: 1 - point.y, y: point.x };
  }
};

/**
 * Converts a PDF user-space point (bottom-left origin) to the persisted
 * annotation system (clockwise rotation applied, CropBox, top-left origin).
 */
export const pdfPointToNormalized = (
  point: PdfPoint,
  cropBox: PdfBox,
  rotation: DrawingRotation,
): NormalizedPoint => {
  PdfPointSchema.parse(point);
  PdfBoxSchema.parse(cropBox);
  DrawingRotationSchema.parse(rotation);
  const width = cropBox.right - cropBox.left;
  const height = cropBox.top - cropBox.bottom;
  const unrotated = clampNormalizedPoint({
    x: (point.x - cropBox.left) / width,
    y: (cropBox.top - point.y) / height,
  });
  return rotateNormalizedPoint(unrotated, rotation);
};

/** Inverse of pdfPointToNormalized for PDF annotation composition. */
export const normalizedPointToPdf = (
  point: NormalizedPoint,
  cropBox: PdfBox,
  rotation: DrawingRotation,
): PdfPoint => {
  NormalizedPointSchema.parse(point);
  PdfBoxSchema.parse(cropBox);
  DrawingRotationSchema.parse(rotation);
  const unrotated = unrotateNormalizedPoint(point, rotation);
  return {
    x: cropBox.left + unrotated.x * (cropBox.right - cropBox.left),
    y: cropBox.top - unrotated.y * (cropBox.top - cropBox.bottom),
  };
};

export const getRotatedCropSizePt = (
  cropBox: PdfBox,
  rotation: DrawingRotation,
): ViewportSize => {
  PdfBoxSchema.parse(cropBox);
  DrawingRotationSchema.parse(rotation);
  const width = cropBox.right - cropBox.left;
  const height = cropBox.top - cropBox.bottom;
  return rotation === 90 || rotation === 270
    ? { width: height, height: width }
    : { width, height };
};

const rotateAround = (
  point: NormalizedPoint,
  center: NormalizedPoint,
  degrees: number,
): NormalizedPoint => {
  if (degrees === 0) return point;
  const radians = degrees * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return clampNormalizedPoint({
    x: center.x + dx * cosine - dy * sine,
    y: center.y + dx * sine + dy * cosine,
  });
};

export const getAnnotationControlPoints = (geometry: AnnotationGeometry): NormalizedPoint[] => {
  const parsed = AnnotationGeometrySchema.parse(geometry);
  switch (parsed.kind) {
    case 'polygon':
    case 'polyline':
      return parsed.vertices;
    case 'marker':
      return [{ x: parsed.x, y: parsed.y }];
    case 'ellipse':
      return [
        clampNormalizedPoint({ x: parsed.cx - parsed.rx, y: parsed.cy - parsed.ry }),
        clampNormalizedPoint({ x: parsed.cx + parsed.rx, y: parsed.cy + parsed.ry }),
      ];
    case 'text':
      return [
        { x: parsed.x, y: parsed.y },
        clampNormalizedPoint({ x: parsed.x + parsed.w, y: parsed.y + parsed.h }),
      ];
    case 'rect': {
      const center = { x: parsed.x + parsed.w / 2, y: parsed.y + parsed.h / 2 };
      return [
        { x: parsed.x, y: parsed.y },
        { x: parsed.x + parsed.w, y: parsed.y },
        { x: parsed.x + parsed.w, y: parsed.y + parsed.h },
        { x: parsed.x, y: parsed.y + parsed.h },
      ].map((point) => rotateAround(clampNormalizedPoint(point), center, parsed.rotationDeg));
    }
  }
};

export const getAnnotationBounds = (geometry: AnnotationGeometry): GeometryBounds => {
  const points = getAnnotationControlPoints(geometry);
  return points.reduce<GeometryBounds>((bounds, point) => ({
    left: Math.min(bounds.left, point.x),
    top: Math.min(bounds.top, point.y),
    right: Math.max(bounds.right, point.x),
    bottom: Math.max(bounds.bottom, point.y),
  }), { left: 1, top: 1, right: 0, bottom: 0 });
};

export const annotationGeometryToPdfPoints = (
  geometry: AnnotationGeometry,
  cropBox: PdfBox,
  rotation: DrawingRotation,
): PdfPoint[] => getAnnotationControlPoints(geometry)
  .map((point) => normalizedPointToPdf(point, cropBox, rotation));
