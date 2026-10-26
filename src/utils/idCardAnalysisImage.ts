// Leave room for base64 expansion and the gateway's 8 MiB JSON request limit.
export const ID_CARD_ANALYSIS_MAX_BYTES = 5 * 1024 * 1024;
const DIRECT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
const CONVERTIBLE_TYPES = new Set(['image/bmp', 'image/x-ms-bmp', 'image/gif', 'image/avif']);
const EXTENSION_TYPES: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  heic: 'image/heic', heif: 'image/heif', bmp: 'image/bmp', gif: 'image/gif', avif: 'image/avif',
};

export async function prepareIdCardAnalysisImage(file: File): Promise<File> {
  if (!file.size) throw new Error('비어 있는 사진입니다. 다른 사진을 선택해 주세요.');
  const declaredType = file.type.toLowerCase();
  const mimeType = declaredType === 'image/jpg' || declaredType === 'image/pjpeg' ? 'image/jpeg'
    : (!declaredType || declaredType === 'application/octet-stream')
      ? EXTENSION_TYPES[file.name.split('.').pop()?.toLowerCase() || ''] : declaredType;
  if (!DIRECT_TYPES.has(mimeType) && !CONVERTIBLE_TYPES.has(mimeType)) {
    throw new Error('지원하지 않는 사진 형식입니다. JPG, PNG 또는 WEBP 사진으로 다시 선택해 주세요.');
  }
  const source = mimeType === file.type ? file : new File([file], file.name, { type: mimeType, lastModified: file.lastModified });
  if (DIRECT_TYPES.has(mimeType) && file.size <= ID_CARD_ANALYSIS_MAX_BYTES) return source;

  const objectUrl = URL.createObjectURL(source);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const value = new Image();
      value.onload = () => resolve(value);
      value.onerror = () => reject(new Error('사진을 열지 못했습니다. HEIC/HEIF 사진은 JPG로 변환하고, 손상된 사진은 다시 선택해 주세요.'));
      value.src = objectUrl;
    });
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('사진 크기를 확인하지 못했습니다. 다른 사진을 선택해 주세요.');
    const scale = Math.min(1, 2400 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('사진 크기를 조정할 수 없습니다. 5MB 이하의 JPG 또는 PNG 사진을 선택해 주세요.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.92, 0.85, 0.75]) {
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (blob?.size && blob.size <= ID_CARD_ANALYSIS_MAX_BYTES) {
        return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'identity-card'}.jpg`, {
          type: 'image/jpeg', lastModified: file.lastModified,
        });
      }
    }
    throw new Error('사진 용량을 줄이지 못했습니다. 5MB 이하의 JPG 또는 PNG 사진을 선택해 주세요.');
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
