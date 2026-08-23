import type { DrawingRotation, NormalizedPoint, PdfBox } from '../types';
import {
  annotationGeometryToPdfPoints,
  denormalizeScreenPoint,
  getAnnotationBounds,
  getRotatedCropSizePt,
  normalizedPointToPdf,
  normalizeScreenPoint,
  pdfPointToNormalized,
} from './geometry';

describe('construction plan drawing geometry', () => {
  const cropBox: PdfBox = { left: 20, bottom: 40, right: 620, top: 840 };
  const rotations: DrawingRotation[] = [0, 90, 180, 270];

  it.each(rotations)('round-trips PDF points through rotation %i and an offset CropBox', (rotation) => {
    const pdfPoint = { x: 173.25, y: 517.75 };
    const normalized = pdfPointToNormalized(pdfPoint, cropBox, rotation);
    const restored = normalizedPointToPdf(normalized, cropBox, rotation);

    expect(normalized.x).toBeGreaterThanOrEqual(0);
    expect(normalized.x).toBeLessThanOrEqual(1);
    expect(normalized.y).toBeGreaterThanOrEqual(0);
    expect(normalized.y).toBeLessThanOrEqual(1);
    expect(restored.x).toBeCloseTo(pdfPoint.x, 8);
    expect(restored.y).toBeCloseTo(pdfPoint.y, 8);
  });

  it('round-trips normalized points independently of display pixel size', () => {
    const point = { x: 216, y: 384 };
    const viewport = { width: 1080, height: 1920 };
    const normalized = normalizeScreenPoint(point, viewport);

    expect(normalized).toEqual({ x: 0.2, y: 0.2 });
    expect(denormalizeScreenPoint(normalized, viewport)).toEqual(point);
  });

  it('swaps CropBox dimensions for quarter-turn page rotations', () => {
    expect(getRotatedCropSizePt(cropBox, 0)).toEqual({ width: 600, height: 800 });
    expect(getRotatedCropSizePt(cropBox, 90)).toEqual({ width: 800, height: 600 });
    expect(getRotatedCropSizePt(cropBox, 270)).toEqual({ width: 800, height: 600 });
  });

  it('maps persisted polygon vertices to PDF primitives and reports bounds', () => {
    const vertices: NormalizedPoint[] = [
      { x: 0.1, y: 0.2 },
      { x: 0.7, y: 0.2 },
      { x: 0.5, y: 0.8 },
    ];
    const geometry = { kind: 'polygon' as const, vertices };

    expect(getAnnotationBounds(geometry)).toEqual({ left: 0.1, top: 0.2, right: 0.7, bottom: 0.8 });
    expect(annotationGeometryToPdfPoints(geometry, cropBox, 0)).toHaveLength(3);
  });
});
