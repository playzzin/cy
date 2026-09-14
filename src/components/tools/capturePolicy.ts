export type CaptureQuality = 'standard' | 'high';
export type CaptureViewport = { width: number; height: number; pixelRatio: number };
export type CaptureRect = { left: number; top: number; width: number; height: number };
export const CAPTURE_HISTORY_LIMIT = 6;
export const CAPTURE_HISTORY_PIXEL_LIMIT = 32_000_000;
export const CAPTURE_HISTORY_BYTE_LIMIT = 32 * 1024 * 1024;
export const CAPTURE_PART_PIXEL_LIMIT = 8_000_000;
export const CAPTURE_PART_HEIGHT_LIMIT = 8000;

export const readCaptureViewport = (): CaptureViewport => ({
    width: window.innerWidth, height: window.innerHeight, pixelRatio: window.devicePixelRatio || 1
});
export const isSameCaptureViewport = (a: CaptureViewport, b: CaptureViewport) => (
    Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1
    && Math.abs(a.pixelRatio - b.pixelRatio) < 0.01
);
export const fitCaptureSize = (width: number, height: number, maxPixels: number) => {
    const scale = Math.min(1, Math.sqrt(maxPixels / Math.max(1, width * height)), 16384 / Math.max(width, height, 1));
    return { width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale)), scale };
};
export const getCaptureConstraints = (
    quality: CaptureQuality,
    viewport: { width: number; height: number },
    pixelRatio = window.devicePixelRatio || 1
): MediaTrackConstraints & { cursor: string; resizeMode: string } => {
    const scale = quality === 'high' ? Math.min(3, Math.max(2, pixelRatio)) : 1;
    const size = fitCaptureSize(viewport.width * scale, viewport.height * scale, quality === 'high' ? 12_000_000 : 4_000_000);
    return {
        width: { ideal: size.width }, height: { ideal: size.height },
        frameRate: { ideal: quality === 'high' ? 30 : 15, max: 30 },
        cursor: 'never', resizeMode: quality === 'high' ? 'none' : 'crop-and-scale'
    };
};

// Scroll capture allocates only a selected strip, never a full-screen canvas.
// Size that strip against the memory budget; empty screen margins must not
// reduce the resolution of a narrow table or memo.
export const getScrollCaptureScale = (
    sourceWidth: number, viewportWidth: number, rangeWidth: number, tileHeight: number, quality: CaptureQuality
) => {
    const sourceScale = sourceWidth / Math.max(1, viewportWidth);
    const size = fitCaptureSize(
        rangeWidth * sourceScale, tileHeight * sourceScale,
        quality === 'high' ? 12_000_000 : 4_000_000
    );
    return Math.min(sourceScale, size.width / Math.max(1, rangeWidth), size.height / Math.max(1, tileHeight));
};

export const retainCaptureHistory = <T extends { width: number; height: number; blob: Blob; parts?: Array<{ blob: Blob }> }>(items: T[]): T[] => {
    let pixels = 0;
    let bytes = 0;
    return items.filter((item, index) => {
        pixels += item.width * item.height;
        bytes += item.parts?.reduce((sum, part) => sum + part.blob.size, 0) ?? item.blob.size;
        // Always preserve the newly completed result so users can save it.
        return index === 0 || (index < CAPTURE_HISTORY_LIMIT && pixels <= CAPTURE_HISTORY_PIXEL_LIMIT && bytes <= CAPTURE_HISTORY_BYTE_LIMIT);
    });
};

export const getCaptureParts = (width: number, height: number) => {
    const partHeight = Math.max(1, Math.min(CAPTURE_PART_HEIGHT_LIMIT, Math.floor(CAPTURE_PART_PIXEL_LIMIT / Math.max(1, width))));
    const result: Array<{ top: number; height: number }> = [];
    for (let top = 0; top < height; top += partHeight) result.push({ top, height: Math.min(partHeight, height - top) });
    return result;
};
