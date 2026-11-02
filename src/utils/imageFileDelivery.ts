const MAX_SHARE_BYTES = 50 * 1024 * 1024;

// Chromium enforces 10 files in share(), even when canShare() accepts more.
const usesChromiumFileSharing = (): boolean => {
    const ua = navigator as Navigator & { userAgentData?: { brands?: { brand: string }[] } };
    return ua.userAgentData?.brands?.some(({ brand }) => brand === 'Chromium') ||
        /\b(?:Chrom(?:e|ium)|EdgA?)\//.test(ua.userAgent);
};

export const imageShareRestriction = (files: File[]): string | null => {
    if (!files.length) return '공유할 사진이 없습니다.';
    if (window.isSecureContext === false) return '사진 공유에는 보안 연결(HTTPS)이 필요합니다.';
    if (!navigator.share || !navigator.canShare) return '이 브라우저는 파일 공유를 지원하지 않습니다.';
    if (usesChromiumFileSharing()) {
        if (files.length > 10) return '이 브라우저의 공유창은 한 번에 최대 10장을 받습니다.';
        if (files.reduce((sum, file) => sum + file.size, 0) > MAX_SHARE_BYTES) return '원본 사진 용량이 이 브라우저의 한 묶음 한도인 50MiB를 초과합니다.';
    }
    try {
        return navigator.canShare({ files }) ? null : '기기가 이 사진 형식 또는 파일 조합의 공유를 지원하지 않습니다.';
    } catch {
        return '브라우저에서 파일 공유 가능 여부를 확인하지 못했습니다.';
    }
};

export const canShareImageFiles = (files: File[]): boolean => imageShareRestriction(files) === null;
export const canShareImageFile = (file: File): boolean => canShareImageFiles([file]);

// Do not add text or URLs: receiving apps may append them to the photo.
export const shareImageFiles = (files: File[]): Promise<void> => navigator.share({ files });
export const shareImageFile = (file: File): Promise<void> => shareImageFiles([file]);

// Return only known messages. Storage errors can contain private object paths and download URLs.
export const imageLoadFailureReason = (failure: unknown): string => {
    const { code, status, name, message } = (failure ?? {}) as { code?: string; status?: number; name?: string; message?: string };
    if (status === 401 || code === 'storage/unauthenticated' || code === 'functions/unauthenticated' || message === '로그인이 필요합니다.')
        return '로그인이 필요합니다. 다시 로그인한 뒤 사진을 준비해 주세요.';
    if (message === '로그인 계정이 변경되었습니다. 다시 조회해 주세요.') return message;
    if (status === 403 || code === 'storage/unauthorized' || code === 'functions/permission-denied')
        return '원본 사진을 조회할 권한이 없습니다. 접근 권한을 확인해 주세요.';
    if (status === 404 || code === 'storage/object-not-found' || code === 'functions/not-found')
        return '등록된 경로에 원본 사진이 없습니다. 등록 상태를 확인해 주세요.';
    if (status === 429 || code === 'functions/resource-exhausted' || code === 'storage/quota-exceeded')
        return '서비스의 요청 또는 사용량 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.';
    if (status === 408 || code === 'storage/retry-limit-exceeded' || code === 'functions/deadline-exceeded')
        return '사진을 불러오는 시간이 초과됐습니다. 연결 상태를 확인하고 다시 시도해 주세요.';
    if (code === 'functions/aborted' || message === 'image-transfer-incomplete')
        return '원본이 바뀌었거나 사진을 끝까지 받지 못했습니다. 사진을 다시 준비해 주세요.';
    if (code === 'functions/failed-precondition' && message === '지원되지 않는 원본 사진 형식입니다.')
        return '원본을 지원되는 이미지로 읽을 수 없습니다. 사진 파일을 확인해 주세요.';
    if (message === 'unsupported-image' || message === 'image-header-read-failed' || name === 'InvalidCharacterError')
        return '원본을 지원되는 이미지로 읽을 수 없습니다. 사진 파일을 확인해 주세요.';
    if (message === '서류 사진 형식을 확인하지 못했습니다.' || message === '계좌사진 형식을 확인하지 못했습니다.')
        return '서버가 원본의 사진 형식 또는 용량을 확인하지 못했습니다. 등록 파일을 확인해 주세요.';
    if (status) return `서버가 사진 요청에 HTTP ${status}로 응답했습니다. 잠시 후 다시 시도해 주세요.`;
    if (name === 'TypeError' || code === 'functions/unavailable') return '사진 요청을 완료하지 못했습니다. 네트워크 연결 또는 서비스 상태를 확인해 주세요.';
    return '상세 원인이 제공되지 않았습니다. 다시 시도한 뒤 원본 등록 상태를 확인해 주세요.';
};

export const imageShareFailureReason = (failure: unknown): string => {
    switch ((failure as { name?: string } | null)?.name) {
        case 'AbortError': return '공유창이 닫혔습니다. 취소했거나 사진을 받을 앱이 없을 수 있습니다.';
        case 'NotAllowedError': return '브라우저가 공유를 거절했습니다. 공유 권한이나 파일 제한이 원인일 수 있습니다.';
        case 'DataError': return '브라우저가 받을 앱으로 사진을 전달하는 중 오류가 발생했습니다.';
        case 'InvalidStateError': return '화면이 비활성 상태이거나 다른 공유창이 열려 있습니다. 공유창을 닫고 다시 시도해 주세요.';
        case 'TypeError': return '브라우저가 이 파일 형식 또는 사진 조합을 받아들이지 않았습니다.';
        default: return '브라우저가 상세 원인을 제공하지 않았습니다.';
    }
};

const actualImageType = async (blob: Blob): Promise<string> => {
    // Storage metadata and file extensions can disagree with the original bytes.
    // Match the helper's supported raster signatures before assigning a name/type;
    // do not recompress the photo or trust an image/* label on a non-image response.
    if (blob.size < 12) throw new Error('unsupported-image');
    const bytes = new Uint8Array(await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(new Error('image-header-read-failed'));
        reader.readAsArrayBuffer(blob.slice(0, 12));
    }));
    const starts = (...prefix: number[]) => prefix.every((byte, index) => bytes[index] === byte);
    const ascii = (start: number, end: number) => String.fromCharCode(...Array.from(bytes.slice(start, end)));
    if (starts(255, 216, 255)) return 'image/jpeg';
    if (starts(137, 80, 78, 71, 13, 10, 26, 10)) return 'image/png';
    if (['GIF87a', 'GIF89a'].includes(ascii(0, 6))) return 'image/gif';
    if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
    if (starts(66, 77)) return 'image/bmp';
    throw new Error('unsupported-image');
};

export const imageFileFromUrl = async (url: string, name: string, signal?: AbortSignal): Promise<File> => {
    const response = await fetch(url, { signal });
    if (!response.ok) throw Object.assign(new Error('image-load-failed'), { status: response.status });
    const blob = await response.blob();
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    const type = await actualImageType(blob);
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    const extensions: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/bmp': 'bmp' };
    const extension = extensions[type];
    const safeName = Array.from(name).map(char => char.charCodeAt(0) < 32 || /[\\/:*?"<>|]/.test(char) ? '_' : char).join('');
    return new File([blob], `${safeName}.${extension}`, { type });
};

export const copyImageFile = async (file: File): Promise<void> => {
    if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error('clipboard-unsupported');
    let png: Blob = file;
    if (file.type !== 'image/png') {
        const bitmap = await createImageBitmap(file);
        try {
            const canvas = document.createElement('canvas');
            canvas.width = bitmap.width; canvas.height = bitmap.height;
            const context = canvas.getContext('2d');
            if (!context) throw new Error('canvas-unavailable');
            context.drawImage(bitmap, 0, 0);
            png = await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('image-conversion-failed')), 'image/png'));
        } finally { bitmap.close(); }
    }
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
};
