export const canShareImageFiles = (files: File[]): boolean => {
    try { return files.length > 0 && !!navigator.share && !!navigator.canShare?.({ files }); }
    catch { return false; }
};

export const canShareImageFile = (file: File): boolean => canShareImageFiles([file]);

// Do not add text or URLs: receiving apps may append them to the photo.
export const shareImageFiles = (files: File[]): Promise<void> => navigator.share({ files });
export const shareImageFile = (file: File): Promise<void> => shareImageFiles([file]);

export const imageFileFromUrl = async (url: string, name: string, signal?: AbortSignal): Promise<File> => {
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error('image-load-failed');
    const blob = await response.blob();
    const extensions: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/bmp': 'bmp' };
    const extension = extensions[blob.type];
    if (!extension || !blob.size) throw new Error('unsupported-image');
    const safeName = Array.from(name).map(char => char.charCodeAt(0) < 32 || /[\\/:*?"<>|]/.test(char) ? '_' : char).join('');
    return new File([blob], `${safeName}.${extension}`, { type: blob.type });
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
