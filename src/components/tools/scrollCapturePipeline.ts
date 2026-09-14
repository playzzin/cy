import { waitForCaptureOperation, waitForCapturedFrame, waitForCapturePaint } from './captureFrameReadiness';
import { CaptureQuality, getCaptureParts, getScrollCaptureScale } from './capturePolicy';
import { createScrollStitchSlice, getScrollStitchBoundaryContentY, ScrollStitchSlice } from './scrollCaptureStitching';

export type CaptureImagePart = { blob: Blob; width: number; height: number };
type Rect = { left: number; top: number; width: number; height: number };
const MAX_PARTS = 24;
const MAX_RESULT_BYTES = 64 * 1024 * 1024;

export const encodeCapturePng = (canvas: HTMLCanvasElement, signal?: AbortSignal): Promise<Blob> => (
    waitForCaptureOperation(new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('canvas-context-failed')), 'image/png');
    }), 10000, 'png-timeout', signal)
);

export const waitForScrollContentStable = (target: HTMLElement, signal?: AbortSignal): Promise<void> => new Promise((resolve, reject) => {
    let lastChange = performance.now();
    let geometry = `${target.scrollHeight}:${target.clientWidth}:${target.clientHeight}:${target.scrollTop}`;
    const observer = new MutationObserver((mutations) => {
        if (mutations.some((mutation) => {
            const element = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
            return !element?.closest('[data-capture-exclude="true"], [data-capture-overlay="true"]');
        })) lastChange = performance.now();
    });
    const cleanup = () => {
        observer.disconnect();
        window.clearInterval(poll);
        window.clearTimeout(timeout);
        signal?.removeEventListener('abort', abort);
    };
    const fail = (code: string) => { cleanup(); reject(new Error(code)); };
    const abort = () => fail('capture-aborted');
    const poll = window.setInterval(() => {
        const nextGeometry = `${target.scrollHeight}:${target.clientWidth}:${target.clientHeight}:${target.scrollTop}`;
        if (geometry !== nextGeometry) { geometry = nextGeometry; lastChange = performance.now(); }
        const bounds = target.getBoundingClientRect();
        const loadingVisibleImage = Array.from(target.querySelectorAll('img')).some((img) => {
            if (img.complete || img.closest('[data-capture-exclude="true"]')) return false;
            const rect = img.getBoundingClientRect();
            return rect.bottom > Math.max(0, bounds.top) && rect.top < Math.min(window.innerHeight, bounds.bottom) && rect.width > 0;
        });
        if (!loadingVisibleImage && performance.now() - lastChange >= 160) { cleanup(); resolve(); }
    }, 50);
    const timeout = window.setTimeout(() => fail('scroll-content-changing'), 3000);
    observer.observe(target, { childList: true, subtree: true, characterData: true, attributes: true });
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
});

// One bounded canvas is encoded and released before allocating the next part.
// No full-height canvas or array of all uncompressed screenshots is retained.
export const createPagedCaptureWriter = (width: number, height: number, signal?: AbortSignal) => {
    const layout = getCaptureParts(width, height);
    if (layout.length > MAX_PARTS) throw new Error('scroll-range-too-long');
    const parts: CaptureImagePart[] = [];
    let canvas: HTMLCanvasElement | null = null;
    let nextY = 0;
    let bytes = 0;
    const release = () => { if (canvas) { canvas.width = 0; canvas.height = 0; canvas = null; } };
    return {
        async append(source: HTMLCanvasElement, slice: ScrollStitchSlice) {
            if (slice.destY !== nextY) throw new Error('scroll-frame-gap');
            const end = slice.destY + slice.destHeight;
            while (nextY < end) {
                if (signal?.aborted) throw new Error('capture-aborted');
                const part = layout[parts.length];
                if (!part) throw new Error('scroll-frame-gap');
                if (!canvas) {
                    canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = part.height;
                }
                const context = canvas.getContext('2d');
                if (!context) throw new Error('canvas-context-failed');
                const rows = Math.min(end - nextY, part.top + part.height - nextY);
                const sourceY = slice.sourceY + ((nextY - slice.destY) / slice.destHeight) * slice.sourceHeight;
                context.drawImage(source, 0, sourceY, source.width, rows / slice.destHeight * slice.sourceHeight, 0, nextY - part.top, width, rows);
                nextY += rows;
                if (nextY === part.top + part.height) {
                    const blob = await encodeCapturePng(canvas, signal);
                    bytes += blob.size;
                    if (bytes > MAX_RESULT_BYTES) throw new Error('scroll-range-too-long');
                    parts.push({ blob, width, height: part.height });
                    release();
                }
            }
        },
        finish() {
            if (nextY !== height || parts.length !== layout.length) throw new Error('scroll-frame-gap');
            return parts;
        },
        dispose: release
    };
};

const frameFingerprint = (canvas: HTMLCanvasElement): number | null => {
    const sample = document.createElement('canvas');
    sample.width = 32;
    sample.height = 24;
    try {
        const context = sample.getContext('2d', { willReadFrequently: true });
        if (!context?.getImageData) return null;
        context.drawImage(canvas, 0, 0, 32, 24);
        const pixels = context.getImageData(0, 0, 32, 24).data;
        let hash = 2166136261;
        let min = 255;
        let max = 0;
        for (let i = 0; i < pixels.length; i += 4) {
            const luminance = Math.round((pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3);
            min = Math.min(min, luminance);
            max = Math.max(max, luminance);
            hash = Math.imul(hash ^ (luminance >> 3), 16777619);
        }
        return max - min < 16 ? null : hash;
    } finally { sample.width = 0; sample.height = 0; }
};

export const captureScrollRangeParts = async (options: {
    video: HTMLVideoElement;
    target: HTMLElement;
    range: { left: number; width: number; topContentY: number; bottomContentY: number };
    quality: CaptureQuality;
    signal: AbortSignal;
    getVisibleRect: () => Rect;
    scrollTo: (top: number) => void;
    getScrollTop: () => number;
    validate: () => void;
    onProgress: (percent: number) => void;
    hideCaptureUi: () => () => void;
}): Promise<CaptureImagePart[]> => {
    const { video, target, range, signal, validate } = options;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    await waitForScrollContentStable(target, signal);
    const initialScrollHeight = target.scrollHeight;
    const initialClientWidth = target.clientWidth;
    const initialClientHeight = target.clientHeight;
    const maxScrollTop = Math.max(0, initialScrollHeight - initialClientHeight);
    const check = () => {
        validate();
        if (signal.aborted) throw new Error('capture-aborted');
        if (!target.isConnected || target.scrollHeight !== initialScrollHeight || target.clientWidth !== initialClientWidth || target.clientHeight !== initialClientHeight) throw new Error('scroll-content-changing');
        if (window.innerWidth !== viewportWidth || window.innerHeight !== viewportHeight) throw new Error('capture-viewport-changed');
    };
    const scale = getScrollCaptureScale(video.videoWidth, viewportWidth, range.width,
        Math.min(viewportHeight, options.getVisibleRect().height, range.bottomContentY - range.topContentY), options.quality);
    const outputWidth = Math.max(1, Math.round(range.width * scale));
    const outputHeight = Math.max(1, Math.round((range.bottomContentY - range.topContentY) * scale));
    const writer = createPagedCaptureWriter(outputWidth, outputHeight, signal);
    let pending: { canvas: HTMLCanvasElement; topContentY: number; bottomContentY: number; sourceHeight: number } | null = null;
    let committed = range.topContentY;
    let capturedUntil = range.topContentY;
    let previousFingerprint: number | null = null;
    let requestedTop = Math.min(maxScrollTop, Math.max(0, range.topContentY));
    let restoreFrameUi: (() => void) | null = null;
    const drawThrough = async (end: number) => {
        if (!pending) return;
        const slice = createScrollStitchSlice(pending, committed, end, range.topContentY, range.bottomContentY, outputHeight);
        if (slice) await writer.append(pending.canvas, slice);
        committed = end;
    };
    const crop = (rect: Rect) => {
        const canvas = document.createElement('canvas');
        canvas.width = outputWidth;
        canvas.height = Math.max(1, Math.round(rect.height * scale));
        const context = canvas.getContext('2d');
        if (!context) throw new Error('canvas-context-failed');
        context.drawImage(video, rect.left * video.videoWidth / viewportWidth, rect.top * video.videoHeight / viewportHeight,
            rect.width * video.videoWidth / viewportWidth, rect.height * video.videoHeight / viewportHeight,
            0, 0, canvas.width, canvas.height);
        return canvas;
    };
    try {
        for (let step = 0; capturedUntil < range.bottomContentY - 0.5 && step < 100; step += 1) {
            check();
            options.scrollTo(requestedTop);
            await waitForCapturePaint(signal);
            await waitForScrollContentStable(target, signal);
            restoreFrameUi = options.hideCaptureUi();
            await waitForCapturePaint(signal);
            await waitForCapturedFrame(video, 3000, false, signal);
            await waitForCapturedFrame(video, 3000, false, signal);
            check();
            const top = options.getScrollTop();
            const visible = options.getVisibleRect();
            const segmentTop = Math.max(range.topContentY, top);
            const bottom = Math.min(range.bottomContentY, top + visible.height);
            if (bottom <= capturedUntil + 0.2 || segmentTop > capturedUntil + 0.5) throw new Error('scroll-frame-gap');
            const rect = { left: range.left, top: visible.top + segmentTop - top, width: range.width, height: bottom - segmentTop };
            let canvas = crop(rect);
            let fingerprint = frameFingerprint(canvas);
            if (fingerprint !== null && fingerprint === previousFingerprint && pending?.canvas.height === canvas.height) {
                canvas.width = 0;
                canvas.height = 0;
                await waitForCapturedFrame(video, 3000, false, signal);
                check();
                canvas = crop(rect);
                fingerprint = frameFingerprint(canvas);
                if (fingerprint === previousFingerprint) { canvas.width = 0; canvas.height = 0; throw new Error('scroll-frame-unchanged'); }
            }
            const current = { canvas, topContentY: segmentTop, bottomContentY: bottom, sourceHeight: canvas.height };
            restoreFrameUi();
            restoreFrameUi = null;
            if (pending) {
                try { await drawThrough(getScrollStitchBoundaryContentY(pending, current)); }
                catch (error) { canvas.width = 0; canvas.height = 0; throw error; }
                pending.canvas.width = 0;
                pending.canvas.height = 0;
            }
            pending = current;
            previousFingerprint = fingerprint;
            capturedUntil = bottom;
            options.onProgress(Math.round(100 * (capturedUntil - range.topContentY) / (range.bottomContentY - range.topContentY)));
            requestedTop = Math.min(maxScrollTop, Math.max(top + 1, bottom - 24));
        }
        check();
        if (capturedUntil < range.bottomContentY - 0.5) throw new Error('scroll-range-too-long');
        await drawThrough(range.bottomContentY);
        return writer.finish();
    } finally {
        restoreFrameUi?.();
        writer.dispose();
        if (pending) { pending.canvas.width = 0; pending.canvas.height = 0; }
    }
};
