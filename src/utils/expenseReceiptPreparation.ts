const RECEIPT_MAX_EDGE = 2000;
const RECEIPT_MIN_READABLE_EDGE = 1000;
const RECEIPT_JPEG_QUALITY = 0.82;
const RECEIPT_COMPRESSION_THRESHOLD = 768 * 1024;
const COMPRESSIBLE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

interface ReceiptImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
}

const loadReceiptImage = async (file: File): Promise<ReceiptImage> => {
  if (typeof createImageBitmap === 'function') {
    try {
      // The default image orientation applies the camera's EXIF rotation.
      const bitmap = await createImageBitmap(file);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      };
    } catch {
      // Some mobile browsers support Image decoding but not ImageBitmap for a format.
    }
  }

  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    const release = () => {
      image.onload = null;
      image.onerror = null;
      image.src = '';
      URL.revokeObjectURL(objectUrl);
    };
    image.onload = () => resolve({
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      release,
    });
    image.onerror = () => {
      release();
      reject(new Error('영수증 이미지를 열지 못했습니다.'));
    };
    image.src = objectUrl;
  });
};

/** Reduces camera uploads once, retaining the original when conversion is unnecessary or fails. */
export const prepareExpenseReceipt = async (file: File): Promise<File> => {
  if (!COMPRESSIBLE_IMAGE_TYPES.has(file.type.toLowerCase()) || file.size <= RECEIPT_COMPRESSION_THRESHOLD) {
    return file;
  }

  let image: ReceiptImage | undefined;
  let canvas: HTMLCanvasElement | undefined;
  try {
    image = await loadReceiptImage(file);
    if (!Number.isFinite(image.width) || !Number.isFinite(image.height) || image.width <= 0 || image.height <= 0) {
      return file;
    }

    // Long receipts need enough width for small printed text, even above the usual edge target.
    const scale = Math.min(1, Math.max(
      RECEIPT_MAX_EDGE / Math.max(image.width, image.height),
      RECEIPT_MIN_READABLE_EDGE / Math.min(image.width, image.height),
    ));
    canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext('2d');
    if (!context) return file;

    // Transparent screenshots should retain a white paper background in the JPEG.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image.source, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas!.toBlob(resolve, 'image/jpeg', RECEIPT_JPEG_QUALITY);
    });
    if (!blob || blob.size === 0 || blob.size >= file.size || blob.type !== 'image/jpeg') return file;

    const name = file.name.replace(/\.(?:jpe?g|png|webp)$/i, '') || 'receipt';
    return new File([blob], `${name}.jpg`, { type: 'image/jpeg', lastModified: file.lastModified });
  } catch {
    return file;
  } finally {
    image?.release();
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
};
