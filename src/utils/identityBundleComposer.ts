import type {
  IdentityBundleOutputOptions,
  IdentityCropBox,
  IdentityDocumentAnalysis,
  IdentityOutputPreset,
  IdentityPerspectiveQuad,
  IdentityPoint,
  IdentityPersonGroup,
} from '../types/identityBundle';

export interface IdentityBundleSlot {
  x: number;
  y: number;
  width: number;
  height: number;
  columnIndex: number;
}

export interface IdentityBundleLayout {
  width: number;
  height: number;
  contentTop: number;
  contentHeight: number;
  slots: IdentityBundleSlot[];
  columns: number[][];
}

const OUTPUT_DIMENSIONS: Record<IdentityOutputPreset, { width: number; height: number }> = {
  A4_300: { width: 2480, height: 3508 },
  A4_150: { width: 1240, height: 1754 },
  MOBILE: { width: 2000, height: 2828 },
};

const MIN_ASPECT_RATIO = 0.18;
const MAX_ASPECT_RATIO = 6;
const LANDSCAPE_THRESHOLD = 1.05;
const PORTRAIT_THRESHOLD = 0.9;
const TARGET_BUNDLE_ASPECT_RATIO = 1.25;
const MAX_COLUMNS = 6;
const CROP_SAFETY_PADDING_RATIO = 0.04;
const EDGE_SNAP_RATIO = 0.04;
const PERSPECTIVE_GRID_SIZE = 14;
const DOCUMENT_TYPE_PRIORITY: Record<string, number> = {
  RESIDENT_CARD: 0,
  DRIVERS_LICENSE: 1,
  FOREIGN_REGISTRATION: 2,
  PASSPORT: 3,
  CONSTRUCTION_WORKER_CARD: 4,
  SAFETY_EDUCATION: 10,
  SCAFFOLD_TRAINING: 20,
  OTHER_ID: 30,
};

const normalizeAspectRatio = (value: number): number => {
  const aspectRatio = Number(value);
  if (!Number.isFinite(aspectRatio) || aspectRatio <= 0) return 1;
  return Math.max(MIN_ASPECT_RATIO, Math.min(MAX_ASPECT_RATIO, aspectRatio));
};

export const getIdentityBundleDimensions = (preset: IdentityOutputPreset) => OUTPUT_DIMENSIONS[preset];

const getColumnWeight = (column: number[], aspectRatios: number[]): number =>
  column.reduce((sum, index) => sum + (1 / normalizeAspectRatio(aspectRatios[index])), 0);

const balanceIntoColumns = (aspectRatios: number[], columnCount: number): number[][] => {
  const columns = Array.from({ length: columnCount }, () => [] as number[]);
  const weights = Array.from({ length: columnCount }, () => 0);
  const indexes = aspectRatios
    .map((aspectRatio, index) => ({ index, weight: 1 / normalizeAspectRatio(aspectRatio) }))
    .sort((left, right) => right.weight - left.weight || left.index - right.index);

  indexes.forEach(({ index, weight }) => {
    let targetColumn = 0;
    for (let columnIndex = 1; columnIndex < columns.length; columnIndex += 1) {
      if (weights[columnIndex] < weights[targetColumn]) targetColumn = columnIndex;
    }
    columns[targetColumn].push(index);
    weights[targetColumn] += weight;
  });

  columns.forEach((column) => column.sort((left, right) => left - right));
  return columns
    .filter((column) => column.length > 0)
    .sort((left, right) => right.length - left.length || left[0] - right[0]);
};

const getLayoutAspectRatio = (columns: number[][], aspectRatios: number[]): number =>
  columns.reduce((sum, column) => {
    const weight = getColumnWeight(column, aspectRatios);
    return sum + (weight > 0 ? 1 / weight : 0);
  }, 0);

/**
 * Arrange documents as a gapless mosaic. Horizontal cards are stacked in a
 * column while a tall certificate occupies a full-height column, matching the
 * compact bundles used by the personnel team.
 */
export const createTightIdentityColumns = (rawAspectRatios: number[]): number[][] => {
  const aspectRatios = rawAspectRatios.map(normalizeAspectRatio);
  const documentCount = aspectRatios.length;
  if (documentCount === 0) return [];
  if (documentCount === 1) return [[0]];

  const landscapeIndexes = aspectRatios
    .map((aspectRatio, index) => ({ aspectRatio, index }))
    .filter(({ aspectRatio }) => aspectRatio >= LANDSCAPE_THRESHOLD)
    .map(({ index }) => index);
  const portraitIndexes = aspectRatios
    .map((aspectRatio, index) => ({ aspectRatio, index }))
    .filter(({ aspectRatio }) => aspectRatio < PORTRAIT_THRESHOLD)
    .map(({ index }) => index);

  if (documentCount === 2) {
    if (landscapeIndexes.length === 2) return [[0, 1]];
    if (portraitIndexes.length === 2) return [[0], [1]];
    return balanceIntoColumns(aspectRatios, 2);
  }

  if (documentCount === 3) {
    if (landscapeIndexes.length === 3) return [[0, 1, 2]];
    if (portraitIndexes.length === 3) return [[0], [1], [2]];
    if (landscapeIndexes.length === 2 && portraitIndexes.length === 1) {
      return [landscapeIndexes, portraitIndexes];
    }
  }

  const maxColumns = Math.min(
    MAX_COLUMNS,
    documentCount,
    Math.max(2, Math.ceil(Math.sqrt(documentCount * 1.35))),
  );
  let bestColumns = balanceIntoColumns(aspectRatios, 1);
  let bestScore = Number.POSITIVE_INFINITY;

  for (let columnCount = 1; columnCount <= maxColumns; columnCount += 1) {
    const columns = balanceIntoColumns(aspectRatios, columnCount);
    const layoutAspectRatio = getLayoutAspectRatio(columns, aspectRatios);
    const columnWeights = columns.map((column) => getColumnWeight(column, aspectRatios));
    const averageWeight = columnWeights.reduce((sum, weight) => sum + weight, 0) / columnWeights.length;
    const imbalance = columnWeights.reduce(
      (sum, weight) => sum + Math.abs(weight - averageWeight) / Math.max(averageWeight, 0.001),
      0,
    ) / columnWeights.length;
    const score = Math.abs(Math.log(layoutAspectRatio / TARGET_BUNDLE_ASPECT_RATIO)) + (imbalance * 0.08);
    if (score < bestScore) {
      bestScore = score;
      bestColumns = columns;
    }
  }

  return bestColumns;
};

export const createTightIdentityBundleLayout = (
  rawAspectRatios: number[],
  preset: IdentityOutputPreset,
  includeHeader: boolean,
): IdentityBundleLayout => {
  const aspectRatios = rawAspectRatios.map(normalizeAspectRatio);
  const bounds = OUTPUT_DIMENSIONS[preset];
  if (aspectRatios.length === 0) {
    return { width: bounds.width, height: bounds.height, contentTop: 0, contentHeight: bounds.height, slots: [], columns: [] };
  }

  const columns = createTightIdentityColumns(aspectRatios);
  const layoutAspectRatio = Math.max(0.01, getLayoutAspectRatio(columns, aspectRatios));
  const headerToWidthRatio = includeHeader ? 0.095 : 0;
  const contentHeight = Math.max(1, Math.floor(Math.min(
    bounds.width / layoutAspectRatio,
    bounds.height / (1 + (layoutAspectRatio * headerToWidthRatio)),
  )));
  const width = Math.max(1, Math.floor(contentHeight * layoutAspectRatio));
  const headerHeight = includeHeader ? Math.max(1, Math.round(width * headerToWidthRatio)) : 0;
  const height = contentHeight + headerHeight;
  const slots = Array.from({ length: aspectRatios.length }, () => ({
    x: 0,
    y: headerHeight,
    width: 0,
    height: 0,
    columnIndex: 0,
  }));

  let columnX = 0;
  columns.forEach((column, columnIndex) => {
    const columnWeight = getColumnWeight(column, aspectRatios);
    const idealColumnWidth = contentHeight / Math.max(columnWeight, 0.001);
    const columnWidth = columnIndex === columns.length - 1
      ? width - columnX
      : idealColumnWidth;
    let itemY = headerHeight;

    column.forEach((documentIndex, itemIndex) => {
      const idealItemHeight = columnWidth / aspectRatios[documentIndex];
      const itemHeight = itemIndex === column.length - 1
        ? (headerHeight + contentHeight) - itemY
        : idealItemHeight;
      slots[documentIndex] = {
        x: columnX,
        y: itemY,
        width: columnWidth,
        height: itemHeight,
        columnIndex,
      };
      itemY += itemHeight;
    });
    columnX += columnWidth;
  });

  return { width, height, contentTop: headerHeight, contentHeight, slots, columns };
};

const loadImage = (file: File): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    URL.revokeObjectURL(url);
    resolve(image);
  };
  image.onerror = () => {
    URL.revokeObjectURL(url);
    reject(new Error(`${file.name}: 결과 이미지를 만들기 위해 원본을 열지 못했습니다.`));
  };
  image.src = url;
});

const normalizeCrop = (crop: IdentityCropBox): IdentityCropBox => {
  const rawX = Number(crop?.x);
  const rawY = Number(crop?.y);
  const rawWidth = Number(crop?.width);
  const rawHeight = Number(crop?.height);
  if (
    !Number.isFinite(rawX)
    || !Number.isFinite(rawY)
    || !Number.isFinite(rawWidth)
    || !Number.isFinite(rawHeight)
    || rawWidth <= 0
    || rawHeight <= 0
  ) {
    return { x: 0, y: 0, width: 1, height: 1 };
  }
  const x = Math.max(0, Math.min(0.98, rawX));
  const y = Math.max(0, Math.min(0.98, rawY));
  const width = Math.max(0.02, Math.min(1 - x, rawWidth));
  const height = Math.max(0.02, Math.min(1 - y, rawHeight));
  return { x, y, width, height };
};

/** Add a conservative outer margin so AI corner estimates never clip text or card edges. */
export const expandIdentityCropForSafety = (
  crop: IdentityCropBox,
  paddingRatio = CROP_SAFETY_PADDING_RATIO,
): IdentityCropBox => {
  const normalized = normalizeCrop(crop);
  const safePaddingRatio = Math.max(0, Math.min(0.15, Number(paddingRatio) || 0));
  const horizontalPadding = normalized.width * safePaddingRatio;
  const verticalPadding = normalized.height * safePaddingRatio;
  const paddedX = Math.max(0, normalized.x - horizontalPadding);
  const paddedY = Math.max(0, normalized.y - verticalPadding);
  const paddedRight = Math.min(1, normalized.x + normalized.width + horizontalPadding);
  const paddedBottom = Math.min(1, normalized.y + normalized.height + verticalPadding);
  const x = paddedX <= EDGE_SNAP_RATIO ? 0 : paddedX;
  const y = paddedY <= EDGE_SNAP_RATIO ? 0 : paddedY;
  const right = 1 - paddedRight <= EDGE_SNAP_RATIO ? 1 : paddedRight;
  const bottom = 1 - paddedBottom <= EDGE_SNAP_RATIO ? 1 : paddedBottom;
  return { x, y, width: right - x, height: bottom - y };
};

export const getIdentityCropForOutput = (
  crop: IdentityCropBox,
  confidence: number,
  warnings: string[] = [],
): IdentityCropBox => {
  const boundaryWarning = warnings.some((warning) => (
    /잘림|잘렸|모서리|경계|일부만|누락|cropp?ed|cut\s*off|edge/i.test(String(warning || ''))
  ));
  if (confidence < 0.35 || boundaryWarning) {
    return { x: 0, y: 0, width: 1, height: 1 };
  }
  return expandIdentityCropForSafety(crop, confidence < 0.72 ? 0.07 : CROP_SAFETY_PADDING_RATIO);
};

const clampPoint = (point: IdentityPoint): IdentityPoint => ({
  x: Math.max(0, Math.min(1, Number(point?.x) || 0)),
  y: Math.max(0, Math.min(1, Number(point?.y) || 0)),
});

export const cropBoxToIdentityQuad = (crop: IdentityCropBox): IdentityPerspectiveQuad => {
  const normalized = normalizeCrop(crop);
  const right = normalized.x + normalized.width;
  const bottom = normalized.y + normalized.height;
  return [
    { x: normalized.x, y: normalized.y },
    { x: right, y: normalized.y },
    { x: right, y: bottom },
    { x: normalized.x, y: bottom },
  ];
};

const signedPolygonArea = (quad: IdentityPerspectiveQuad): number => (
  quad.reduce((sum, point, index) => {
    const next = quad[(index + 1) % quad.length];
    return sum + ((point.x * next.y) - (next.x * point.y));
  }, 0) / 2
);

const cross = (a: IdentityPoint, b: IdentityPoint, c: IdentityPoint): number => (
  ((b.x - a.x) * (c.y - b.y)) - ((b.y - a.y) * (c.x - b.x))
);

export const isValidIdentityPerspectiveQuad = (quad: IdentityPerspectiveQuad): boolean => {
  const normalized = quad.map(clampPoint) as IdentityPerspectiveQuad;
  if (Math.abs(signedPolygonArea(normalized)) < 0.012) return false;
  const signs = normalized.map((point, index) => {
    const next = normalized[(index + 1) % normalized.length];
    const after = normalized[(index + 2) % normalized.length];
    return Math.sign(cross(point, next, after));
  });
  return signs.every((sign) => sign !== 0 && sign === signs[0]);
};

export const getIdentityDocumentQuadForOutput = (
  document: Pick<IdentityDocumentAnalysis, 'crop' | 'confidence' | 'warnings' | 'correctionMode' | 'perspectiveQuad'>,
): IdentityPerspectiveQuad => {
  if (document.correctionMode === 'ORIGINAL') {
    return cropBoxToIdentityQuad({ x: 0, y: 0, width: 1, height: 1 });
  }
  if (
    document.correctionMode === 'MANUAL'
    && document.perspectiveQuad
    && isValidIdentityPerspectiveQuad(document.perspectiveQuad)
  ) {
    return document.perspectiveQuad.map(clampPoint) as IdentityPerspectiveQuad;
  }
  return cropBoxToIdentityQuad(getIdentityCropForOutput(
    document.crop,
    document.confidence,
    document.warnings,
  ));
};

const pointDistance = (left: IdentityPoint, right: IdentityPoint, width: number, height: number): number => (
  Math.hypot((right.x - left.x) * width, (right.y - left.y) * height)
);

export const getIdentityPerspectiveDimensions = (
  quad: IdentityPerspectiveQuad,
  imageWidth: number,
  imageHeight: number,
): { width: number; height: number; aspectRatio: number } => {
  const safeWidth = Math.max(1, imageWidth);
  const safeHeight = Math.max(1, imageHeight);
  const topWidth = pointDistance(quad[0], quad[1], safeWidth, safeHeight);
  const bottomWidth = pointDistance(quad[3], quad[2], safeWidth, safeHeight);
  const leftHeight = pointDistance(quad[0], quad[3], safeWidth, safeHeight);
  const rightHeight = pointDistance(quad[1], quad[2], safeWidth, safeHeight);
  const width = Math.max(1, (topWidth + bottomWidth) / 2);
  const height = Math.max(1, (leftHeight + rightHeight) / 2);
  return { width, height, aspectRatio: normalizeAspectRatio(width / height) };
};

interface SquareToQuadTransform {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
  g: number;
  h: number;
}

const createSquareToQuadTransform = (quad: IdentityPerspectiveQuad): SquareToQuadTransform => {
  const [topLeft, topRight, bottomRight, bottomLeft] = quad;
  const dx1 = topRight.x - bottomRight.x;
  const dx2 = bottomLeft.x - bottomRight.x;
  const dx3 = topLeft.x - topRight.x + bottomRight.x - bottomLeft.x;
  const dy1 = topRight.y - bottomRight.y;
  const dy2 = bottomLeft.y - bottomRight.y;
  const dy3 = topLeft.y - topRight.y + bottomRight.y - bottomLeft.y;
  const determinant = (dx1 * dy2) - (dx2 * dy1);
  let g = 0;
  let h = 0;
  if ((Math.abs(dx3) > 1e-8 || Math.abs(dy3) > 1e-8) && Math.abs(determinant) > 1e-8) {
    g = ((dx3 * dy2) - (dx2 * dy3)) / determinant;
    h = ((dx1 * dy3) - (dx3 * dy1)) / determinant;
  }
  return {
    a: topRight.x - topLeft.x + (g * topRight.x),
    b: bottomLeft.x - topLeft.x + (h * bottomLeft.x),
    c: topLeft.x,
    d: topRight.y - topLeft.y + (g * topRight.y),
    e: bottomLeft.y - topLeft.y + (h * bottomLeft.y),
    f: topLeft.y,
    g,
    h,
  };
};

export const mapIdentityPerspectivePoint = (
  quad: IdentityPerspectiveQuad,
  u: number,
  v: number,
): IdentityPoint => {
  const transform = createSquareToQuadTransform(quad);
  const denominator = (transform.g * u) + (transform.h * v) + 1;
  return {
    x: ((transform.a * u) + (transform.b * v) + transform.c) / denominator,
    y: ((transform.d * u) + (transform.e * v) + transform.f) / denominator,
  };
};

const setTriangleTransform = (
  context: CanvasRenderingContext2D,
  source: [IdentityPoint, IdentityPoint, IdentityPoint],
  destination: [IdentityPoint, IdentityPoint, IdentityPoint],
): boolean => {
  const [s0, s1, s2] = source;
  const [d0, d1, d2] = destination;
  const denominator = (s0.x * (s1.y - s2.y)) + (s1.x * (s2.y - s0.y)) + (s2.x * (s0.y - s1.y));
  if (Math.abs(denominator) < 1e-5) return false;
  const a = ((d0.x * (s1.y - s2.y)) + (d1.x * (s2.y - s0.y)) + (d2.x * (s0.y - s1.y))) / denominator;
  const c = ((d0.x * (s2.x - s1.x)) + (d1.x * (s0.x - s2.x)) + (d2.x * (s1.x - s0.x))) / denominator;
  const e = (
    (d0.x * ((s1.x * s2.y) - (s2.x * s1.y)))
    + (d1.x * ((s2.x * s0.y) - (s0.x * s2.y)))
    + (d2.x * ((s0.x * s1.y) - (s1.x * s0.y)))
  ) / denominator;
  const b = ((d0.y * (s1.y - s2.y)) + (d1.y * (s2.y - s0.y)) + (d2.y * (s0.y - s1.y))) / denominator;
  const d = ((d0.y * (s2.x - s1.x)) + (d1.y * (s0.x - s2.x)) + (d2.y * (s1.x - s0.x))) / denominator;
  const f = (
    (d0.y * ((s1.x * s2.y) - (s2.x * s1.y)))
    + (d1.y * ((s2.x * s0.y) - (s0.x * s2.y)))
    + (d2.y * ((s0.x * s1.y) - (s1.x * s0.y)))
  ) / denominator;
  context.setTransform(a, b, c, d, e, f);
  return true;
};

const expandTriangle = (
  triangle: [IdentityPoint, IdentityPoint, IdentityPoint],
  pixels = 0.65,
): [IdentityPoint, IdentityPoint, IdentityPoint] => {
  const center = {
    x: (triangle[0].x + triangle[1].x + triangle[2].x) / 3,
    y: (triangle[0].y + triangle[1].y + triangle[2].y) / 3,
  };
  return triangle.map((point) => {
    const distance = Math.max(0.001, Math.hypot(point.x - center.x, point.y - center.y));
    return {
      x: point.x + (((point.x - center.x) / distance) * pixels),
      y: point.y + (((point.y - center.y) / distance) * pixels),
    };
  }) as [IdentityPoint, IdentityPoint, IdentityPoint];
};

/** Draw a projectively corrected document by tessellating the homography into seam-safe triangles. */
export const drawWarpedIdentityDocument = (
  context: CanvasRenderingContext2D,
  image: CanvasImageSource,
  imageWidth: number,
  imageHeight: number,
  quad: IdentityPerspectiveQuad,
  destination: { x: number; y: number; width: number; height: number },
): void => {
  const gridSize = PERSPECTIVE_GRID_SIZE;
  const sourceAt = (u: number, v: number): IdentityPoint => {
    const point = mapIdentityPerspectivePoint(quad, u, v);
    return { x: point.x * imageWidth, y: point.y * imageHeight };
  };
  const destinationAt = (u: number, v: number): IdentityPoint => ({
    x: destination.x + (u * destination.width),
    y: destination.y + (v * destination.height),
  });

  context.save();
  context.beginPath();
  context.rect(destination.x, destination.y, destination.width, destination.height);
  context.clip();
  for (let row = 0; row < gridSize; row += 1) {
    for (let column = 0; column < gridSize; column += 1) {
      const u0 = column / gridSize;
      const u1 = (column + 1) / gridSize;
      const v0 = row / gridSize;
      const v1 = (row + 1) / gridSize;
      const sourceCorners = [sourceAt(u0, v0), sourceAt(u1, v0), sourceAt(u1, v1), sourceAt(u0, v1)];
      const destinationCorners = [destinationAt(u0, v0), destinationAt(u1, v0), destinationAt(u1, v1), destinationAt(u0, v1)];
      const triangles: Array<[number, number, number]> = [[0, 1, 2], [0, 2, 3]];
      triangles.forEach(([a, b, c]) => {
        const sourceTriangle = [sourceCorners[a], sourceCorners[b], sourceCorners[c]] as [IdentityPoint, IdentityPoint, IdentityPoint];
        const destinationTriangle = [destinationCorners[a], destinationCorners[b], destinationCorners[c]] as [IdentityPoint, IdentityPoint, IdentityPoint];
        const clipTriangle = expandTriangle(destinationTriangle);
        context.save();
        context.beginPath();
        context.moveTo(clipTriangle[0].x, clipTriangle[0].y);
        context.lineTo(clipTriangle[1].x, clipTriangle[1].y);
        context.lineTo(clipTriangle[2].x, clipTriangle[2].y);
        context.closePath();
        context.clip();
        if (setTriangleTransform(context, sourceTriangle, destinationTriangle)) {
          context.drawImage(image, 0, 0);
        }
        context.restore();
      });
    }
  }
  context.restore();
};

export const renderIdentityBundleBlob = async (
  group: IdentityPersonGroup,
  filesByIndex: Map<number, File>,
  options: IdentityBundleOutputOptions,
): Promise<Blob> => {
  const preparedDocuments = await Promise.all(group.documents.map(async (document) => {
    const file = filesByIndex.get(document.fileIndex);
    if (!file) throw new Error(`${document.originalFileName}: 원본 파일을 찾지 못했습니다.`);
    const image = await loadImage(file);
    const quad = getIdentityDocumentQuadForOutput(document);
    const perspectiveSize = getIdentityPerspectiveDimensions(quad, image.naturalWidth, image.naturalHeight);
    return {
      image,
      quad,
      aspectRatio: perspectiveSize.aspectRatio,
      documentType: document.documentType,
      originalIndex: document.fileIndex,
    };
  }));
  preparedDocuments.sort((left, right) => (
    (DOCUMENT_TYPE_PRIORITY[left.documentType] ?? 99) - (DOCUMENT_TYPE_PRIORITY[right.documentType] ?? 99)
    || left.originalIndex - right.originalIndex
  ));

  const layout = createTightIdentityBundleLayout(
    preparedDocuments.map((document) => document.aspectRatio),
    options.preset,
    options.includeHeader,
  );
  const canvas = document.createElement('canvas');
  canvas.width = layout.width;
  canvas.height = layout.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('결과 이미지를 만들 수 없는 브라우저입니다.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, layout.width, layout.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';

  if (options.includeHeader) {
    const scale = layout.width / 2480;
    context.fillStyle = '#111827';
    context.font = `700 ${Math.max(22, Math.round(58 * scale))}px "Noto Sans KR", sans-serif`;
    context.textBaseline = 'middle';
    context.fillText(
      `${group.personName} · 신분증 묶음`,
      Math.max(24, Math.round(80 * scale)),
      layout.contentTop / 2,
    );
    context.fillStyle = '#94a3b8';
    context.font = `500 ${Math.max(12, Math.round(25 * scale))}px "Noto Sans KR", sans-serif`;
    context.textAlign = 'right';
    context.fillText(
      `${group.documents.length}개 문서`,
      layout.width - Math.max(24, Math.round(80 * scale)),
      layout.contentTop / 2,
    );
    context.textAlign = 'left';
  }

  preparedDocuments.forEach((prepared, index) => {
    const slot = layout.slots[index];
    const destinationX = Math.floor(slot.x);
    const destinationY = Math.floor(slot.y);
    const destinationRight = Math.ceil(slot.x + slot.width);
    const destinationBottom = Math.ceil(slot.y + slot.height);
    drawWarpedIdentityDocument(
      context,
      prepared.image,
      prepared.image.naturalWidth,
      prepared.image.naturalHeight,
      prepared.quad,
      {
        x: destinationX,
        y: destinationY,
        width: destinationRight - destinationX,
        height: destinationBottom - destinationY,
      },
    );
  });

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('JPG 결과 생성에 실패했습니다.')),
      'image/jpeg',
      options.jpegQuality,
    );
  });
};
