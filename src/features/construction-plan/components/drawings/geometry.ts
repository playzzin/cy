import { DrawingObject, NormalizedPoint } from './types';

const PRECISION = 6;

export const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export const normalizePoint = (point: NormalizedPoint): NormalizedPoint => ({
  x: Number(clamp01(point.x).toFixed(PRECISION)),
  y: Number(clamp01(point.y).toFixed(PRECISION)),
});

export const clientPointToNormalized = (
  clientX: number,
  clientY: number,
  bounds: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
): NormalizedPoint => {
  if (bounds.width <= 0 || bounds.height <= 0) {
    return { x: 0, y: 0 };
  }

  return normalizePoint({
    x: (clientX - bounds.left) / bounds.width,
    y: (clientY - bounds.top) / bounds.height,
  });
};

export interface NormalizedBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type DrawingResizeHandle = 'north-west' | 'north-east' | 'south-east' | 'south-west';

const MIN_SHAPE_SIZE = 0.005;

export const boundsFromPoints = (points: NormalizedPoint[]): NormalizedBounds => {
  if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
};

/**
 * Move a complete annotation without clipping or changing its internal geometry.
 * The requested delta is reduced as a whole when any point would cross the page.
 */
export const translatePointsWithinPage = (
  points: NormalizedPoint[],
  delta: NormalizedPoint,
  constrainToAxis = false,
): NormalizedPoint[] => {
  if (points.length === 0) return [];
  const bounds = boundsFromPoints(points);
  let dx = delta.x;
  let dy = delta.y;
  if (constrainToAxis) {
    if (Math.abs(dx) >= Math.abs(dy)) dy = 0;
    else dx = 0;
  }
  const safeDx = Math.min(1 - (bounds.x + bounds.width), Math.max(-bounds.x, dx));
  const safeDy = Math.min(1 - (bounds.y + bounds.height), Math.max(-bounds.y, dy));
  return points.map((point) => normalizePoint({ x: point.x + safeDx, y: point.y + safeDy }));
};

/** Resize a bounding-box annotation from one corner while keeping every point page-relative. */
export const resizePointsWithinPage = (
  points: NormalizedPoint[],
  handle: DrawingResizeHandle,
  target: NormalizedPoint,
  preserveAspectRatio = false,
): NormalizedPoint[] => {
  if (points.length === 0) return [];
  const bounds = boundsFromPoints(points);
  const east = handle === 'north-east' || handle === 'south-east';
  const south = handle === 'south-east' || handle === 'south-west';
  const anchor = {
    x: east ? bounds.x : bounds.x + bounds.width,
    y: south ? bounds.y : bounds.y + bounds.height,
  };
  const signX = east ? 1 : -1;
  const signY = south ? 1 : -1;
  let width = Math.max(MIN_SHAPE_SIZE, Math.abs(target.x - anchor.x));
  let height = Math.max(MIN_SHAPE_SIZE, Math.abs(target.y - anchor.y));

  if (preserveAspectRatio && bounds.width >= MIN_SHAPE_SIZE && bounds.height >= MIN_SHAPE_SIZE) {
    const widthScale = width / bounds.width;
    const heightScale = height / bounds.height;
    const scale = Math.max(widthScale, heightScale);
    width = bounds.width * scale;
    height = bounds.height * scale;
  }

  const maximumWidth = signX > 0 ? 1 - anchor.x : anchor.x;
  const maximumHeight = signY > 0 ? 1 - anchor.y : anchor.y;
  const pageScale = Math.min(1, maximumWidth / width, maximumHeight / height);
  width = Math.max(Math.min(MIN_SHAPE_SIZE, maximumWidth), width * pageScale);
  height = Math.max(Math.min(MIN_SHAPE_SIZE, maximumHeight), height * pageScale);

  const moving = normalizePoint({ x: anchor.x + signX * width, y: anchor.y + signY * height });
  const nextMinX = Math.min(anchor.x, moving.x);
  const nextMaxX = Math.max(anchor.x, moving.x);
  const nextMinY = Math.min(anchor.y, moving.y);
  const nextMaxY = Math.max(anchor.y, moving.y);
  const nextWidth = nextMaxX - nextMinX;
  const nextHeight = nextMaxY - nextMinY;

  return points.map((point, index) => {
    const xRatio = bounds.width > 0
      ? (point.x - bounds.x) / bounds.width
      : index === 0 ? 0 : 1;
    const yRatio = bounds.height > 0
      ? (point.y - bounds.y) / bounds.height
      : index === 0 ? 0 : 1;
    return normalizePoint({
      x: nextMinX + xRatio * nextWidth,
      y: nextMinY + yRatio * nextHeight,
    });
  });
};

/** Shift-drag constraint used while creating rectangles, ellipses, text and arrows. */
export const constrainDraftPoint = (
  start: NormalizedPoint,
  end: NormalizedPoint,
  kind: DrawingObject['kind'],
  constrain: boolean,
  canvasAspectRatio = 1,
): NormalizedPoint => {
  if (!constrain) return normalizePoint(end);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (kind === 'arrow' || kind === 'polyline') {
    const visualDy = dy / canvasAspectRatio;
    const distance = Math.hypot(dx, visualDy);
    const angle = Math.atan2(visualDy, dx);
    const snappedAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
    return normalizePoint({
      x: start.x + Math.cos(snappedAngle) * distance,
      y: start.y + Math.sin(snappedAngle) * distance * canvasAspectRatio,
    });
  }
  const visualSize = Math.max(Math.abs(dx), Math.abs(dy) / canvasAspectRatio);
  return normalizePoint({
    x: start.x + Math.sign(dx || 1) * visualSize,
    y: start.y + Math.sign(dy || 1) * visualSize * canvasAspectRatio,
  });
};

export const pointDistance = (a: NormalizedPoint, b: NormalizedPoint): number =>
  Math.hypot(a.x - b.x, a.y - b.y);

export const isPracticalShape = (kind: DrawingObject['kind'], points: NormalizedPoint[]): boolean => {
  if (kind === 'marker') return points.length === 1;
  if (kind === 'polygon') {
    return points.length >= 3 && Math.max(boundsFromPoints(points).width, boundsFromPoints(points).height) >= 0.005;
  }

  return points.length >= 2 && pointDistance(points[0], points[1]) >= 0.005;
};

export const objectLabelPoint = (object: DrawingObject): NormalizedPoint => {
  if ((object.kind === 'arrow' || object.kind === 'polyline') && object.points.length >= 2) {
    return {
      x: (object.points[0].x + object.points[1].x) / 2,
      y: (object.points[0].y + object.points[1].y) / 2,
    };
  }

  const bounds = boundsFromPoints(object.points);
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
};

export const toSvgPoints = (points: NormalizedPoint[], width: number, height: number): string =>
  points.map((point) => `${point.x * width},${point.y * height}`).join(' ');

export const objectAccessibleName = (object: DrawingObject, layerLabel: string): string => {
  const kindLabels: Record<DrawingObject['kind'], string> = {
    rectangle: '사각형',
    polygon: '다각형',
    arrow: '화살표',
    polyline: '연속선',
    ellipse: '타원',
    marker: '마커',
    text: '텍스트',
  };
  const identity = [object.zoneCode, object.label].filter(Boolean).join(' ');
  return `${layerLabel} ${kindLabels[object.kind]}${identity ? `, ${identity}` : ''}`;
};
