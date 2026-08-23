const STORAGE_MAX_EDGE = 1600;
const STORAGE_TARGET_BYTES = 650 * 1024;
const STORAGE_QUALITY_STEPS = [0.82, 0.74, 0.66, 0.58];
const STORAGE_DIMENSION_PASSES = 4;

export interface CompressedIdentityImageResult {
  file: File;
  width: number;
  height: number;
  originalBytes: number;
  quality: number;
}

export const calculateIdentityStorageDimensions = (
  width: number,
  height: number,
  maxEdge = STORAGE_MAX_EDGE,
): { width: number; height: number } => {
  const safeWidth = Math.max(1, Math.round(width));
  const safeHeight = Math.max(1, Math.round(height));
  const scale = Math.min(1, maxEdge / Math.max(safeWidth, safeHeight));
  return {
    width: Math.max(1, Math.round(safeWidth * scale)),
    height: Math.max(1, Math.round(safeHeight * scale)),
  };
};

const loadBlobImage = (blob: Blob): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
  const objectUrl = URL.createObjectURL(blob);
  const image = new Image();
  image.onload = () => {
    URL.revokeObjectURL(objectUrl);
    resolve(image);
  };
  image.onerror = () => {
    URL.revokeObjectURL(objectUrl);
    reject(new Error('저장용 신분증 이미지를 열지 못했습니다.'));
  };
  image.src = objectUrl;
});

const canvasToJpegBlob = (canvas: HTMLCanvasElement, quality: number): Promise<Blob> => new Promise((resolve, reject) => {
  canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error('저장용 신분증 이미지 압축에 실패했습니다.')),
    'image/jpeg',
    quality,
  );
});

const ensureJpegFileName = (fileName: string): string => {
  const normalized = fileName.trim().replace(/\.(?:jpe?g|png|webp)$/i, '') || 'identity-card';
  return `${normalized}.jpg`;
};

/**
 * Compresses the final identity bundle entirely in the browser before upload.
 * It first caps the longest edge and then lowers JPEG quality/dimensions until
 * the target size is reached, keeping Storage and network load predictable.
 */
export const compressIdentityImageForStorage = async (
  source: Blob,
  fileName: string,
): Promise<CompressedIdentityImageResult> => {
  const image = await loadBlobImage(source);
  let dimensions = calculateIdentityStorageDimensions(image.naturalWidth, image.naturalHeight);
  let smallest: { blob: Blob; width: number; height: number; quality: number } | null = null;

  for (let pass = 0; pass < STORAGE_DIMENSION_PASSES; pass += 1) {
    const canvas = document.createElement('canvas');
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('브라우저의 이미지 압축 기능을 사용할 수 없습니다.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    for (const quality of STORAGE_QUALITY_STEPS) {
      const blob = await canvasToJpegBlob(canvas, quality);
      if (!smallest || blob.size < smallest.blob.size) {
        smallest = { blob, width: canvas.width, height: canvas.height, quality };
      }
      if (blob.size <= STORAGE_TARGET_BYTES) {
        return {
          file: new File([blob], ensureJpegFileName(fileName), { type: 'image/jpeg', lastModified: Date.now() }),
          width: canvas.width,
          height: canvas.height,
          originalBytes: source.size,
          quality,
        };
      }
    }

    const nextLongestEdge = Math.max(960, Math.round(Math.max(dimensions.width, dimensions.height) * 0.82));
    dimensions = calculateIdentityStorageDimensions(dimensions.width, dimensions.height, nextLongestEdge);
  }

  if (!smallest) throw new Error('저장용 신분증 이미지를 만들지 못했습니다.');
  return {
    file: new File([smallest.blob], ensureJpegFileName(fileName), { type: 'image/jpeg', lastModified: Date.now() }),
    width: smallest.width,
    height: smallest.height,
    originalBytes: source.size,
    quality: smallest.quality,
  };
};
