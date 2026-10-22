export const canShareImageFiles = (files: File[]): boolean => {
    try { return files.length > 0 && !!navigator.share && !!navigator.canShare?.({ files }); }
    catch { return false; }
};

export const canShareImageFile = (file: File): boolean => canShareImageFiles([file]);

// Do not add text or URLs: receiving apps may append them to the photo.
export const shareImageFiles = (files: File[]): Promise<void> => navigator.share({ files });
export const shareImageFile = (file: File): Promise<void> => shareImageFiles([file]);

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
    if (!response.ok) throw new Error('image-load-failed');
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
