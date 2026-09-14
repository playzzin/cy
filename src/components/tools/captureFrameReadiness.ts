import { CaptureViewport, isSameCaptureViewport, readCaptureViewport } from './capturePolicy';

const aborted = () => new Error('capture-aborted');

export const waitForCaptureOperation = <T>(
    operation: Promise<T>,
    timeoutMs: number,
    timeoutMessage: string,
    signal?: AbortSignal
): Promise<T> => new Promise((resolve, reject) => {
    const cleanup = () => {
        window.clearTimeout(timeoutId);
        signal?.removeEventListener('abort', onAbort);
    };
    const onAbort = () => { cleanup(); reject(aborted()); };
    const timeoutId = window.setTimeout(() => {
        cleanup();
        reject(new Error(timeoutMessage));
    }, timeoutMs);
    // Observe the browser promise even after cancellation to absorb late rejections.
    operation.then((value) => { cleanup(); resolve(value); }, (error) => { cleanup(); reject(error); });
    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) onAbort();
});

export const waitForCapturePaint = (signal?: AbortSignal): Promise<void> => new Promise((resolve, reject) => {
    let frameId = 0;
    const cleanup = () => {
        window.clearTimeout(timeoutId);
        window.cancelAnimationFrame(frameId);
        signal?.removeEventListener('abort', onAbort);
    };
    const onAbort = () => { cleanup(); reject(aborted()); };
    const timeoutId = window.setTimeout(() => {
        cleanup();
        reject(new Error('capture-paint-timeout'));
    }, 2500);
    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) { onAbort(); return; }
    frameId = window.requestAnimationFrame(() => {
        frameId = window.requestAnimationFrame(() => { cleanup(); resolve(); });
    });
});

export const hasUsableCapturedFrame = (video: HTMLVideoElement) => {
    const stream = video.srcObject as MediaStream | null;
    const track = stream?.getVideoTracks?.()[0];
    return video.videoWidth > 0 && video.videoHeight > 0
    && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
    && !video.error && !video.ended
    && (!track || (track.readyState !== 'ended' && !track.muted));
};

// Sharing UI can resize the tab after permission, and the video can follow a
// few frames later. Establish selection coordinates only after both settle.
export const waitForStableCaptureViewport = (
    video: HTMLVideoElement,
    signal: AbortSignal
): Promise<CaptureViewport> => new Promise((resolve, reject) => {
    let previous = readCaptureViewport();
    let videoWidth = video.videoWidth;
    let videoHeight = video.videoHeight;
    let stableSince = performance.now();
    const cleanup = () => {
        window.clearInterval(pollId);
        window.clearTimeout(timeoutId);
        signal.removeEventListener('abort', onAbort);
    };
    const onAbort = () => { cleanup(); reject(aborted()); };
    const check = () => {
        const viewport = readCaptureViewport();
        const aspectError = Math.abs((video.videoWidth / video.videoHeight) / (viewport.width / viewport.height) - 1);
        if (!isSameCaptureViewport(previous, viewport)
            || videoWidth !== video.videoWidth || videoHeight !== video.videoHeight
            || !hasUsableCapturedFrame(video) || document.visibilityState !== 'visible'
            || !Number.isFinite(aspectError) || aspectError > 0.015) {
            stableSince = performance.now();
        } else if (performance.now() - stableSince >= 350) {
            cleanup();
            resolve(viewport);
        }
        previous = viewport;
        videoWidth = video.videoWidth;
        videoHeight = video.videoHeight;
    };
    const pollId = window.setInterval(check, 50);
    const timeoutId = window.setTimeout(() => {
        cleanup();
        reject(new Error('capture-viewport-unsettled'));
    }, 8000);
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) onAbort();
});

// Metadata alone does not guarantee drawable pixels. Start playback immediately
// and wait for actual data; some browsers do not deliver data until play() runs.
export const prepareCaptureVideo = (video: HTMLVideoElement, signal?: AbortSignal): Promise<void> => (
    new Promise((resolve, reject) => {
        let playbackStarted = false;
        const events = ['loadedmetadata', 'loadeddata', 'canplay', 'playing', 'resize', 'error'];
        const cleanup = () => {
            window.clearTimeout(timeoutId);
            window.clearInterval(pollId);
            events.forEach((event) => video.removeEventListener(event, check));
            signal?.removeEventListener('abort', onAbort);
        };
        const fail = (error: unknown) => { cleanup(); reject(error); };
        const check = () => {
            if (video.error) { fail(new Error('video-load-failed')); return; }
            if (playbackStarted && hasUsableCapturedFrame(video)) { cleanup(); resolve(); }
        };
        const onAbort = () => fail(aborted());
        const timeoutId = window.setTimeout(() => fail(new Error('video-load-timeout')), 10000);
        const pollId = window.setInterval(check, 50);
        events.forEach((event) => video.addEventListener(event, check));
        signal?.addEventListener('abort', onAbort, { once: true });
        if (signal?.aborted) { onAbort(); return; }
        try {
            Promise.resolve(video.play()).then(() => { playbackStarted = true; check(); }, fail);
        } catch (error) {
            fail(error);
        }
    })
);

export const waitForCapturedFrame = (
    video: HTMLVideoElement,
    frameTimeoutMs = 5000,
    allowExistingFrameOnTimeout = false,
    signal?: AbortSignal
): Promise<void> => new Promise((resolve, reject) => {
    let settled = false;
    let callbackId: number | undefined;
    let fallbackId = 0;
    const cleanup = () => {
        window.clearTimeout(timeoutId);
        window.clearTimeout(fallbackId);
        if (callbackId !== undefined) video.cancelVideoFrameCallback?.(callbackId);
        signal?.removeEventListener('abort', onAbort);
    };
    const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        cleanup();
        error ? reject(error) : resolve();
    };
    const onAbort = () => finish(aborted());
    const timeoutId = window.setTimeout(() => {
        finish(allowExistingFrameOnTimeout && hasUsableCapturedFrame(video)
            ? undefined : new Error('video-frame-timeout'));
    }, frameTimeoutMs);
    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) { onAbort(); return; }

    const requestFrame = () => {
        if (settled) return;
        try {
            callbackId = video.requestVideoFrameCallback(() => {
                if (hasUsableCapturedFrame(video)) finish();
                else requestFrame();
            });
        } catch {
            // The deadline still validates an existing frame on implementations
            // that expose the API but cannot register a compositor callback.
        }
    };
    if (typeof video.requestVideoFrameCallback === 'function') {
        requestFrame();
    } else {
        // Older browsers have no compositor callback. Poll data readiness rather
        // than assuming a fixed 120 ms delay means the first frame has arrived.
        const check = () => {
            if (hasUsableCapturedFrame(video)) finish();
            else fallbackId = window.setTimeout(check, 50);
        };
        fallbackId = window.setTimeout(check, 120);
    }
});
