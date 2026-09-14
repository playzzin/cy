import {
    prepareCaptureVideo,
    waitForCaptureOperation,
    waitForCapturePaint,
    waitForCapturedFrame,
    waitForStableCaptureViewport
} from './captureFrameReadiness';

describe('capture readiness on delayed or suspended browsers', () => {
    let video: HTMLVideoElement;
    let readyState: number;
    beforeEach(() => {
        jest.useFakeTimers();
        readyState = HTMLMediaElement.HAVE_METADATA;
        video = document.createElement('video');
        Object.defineProperties(video, {
            videoWidth: { value: 1600 },
            videoHeight: { value: 1200 },
            readyState: { get: () => readyState },
            play: { value: jest.fn().mockResolvedValue(undefined), configurable: true }
        });
    });
    afterEach(() => {
        jest.restoreAllMocks();
        jest.useRealTimers();
    });

    it('starts playback before waiting for the first decodable frame', async () => {
        const ready = jest.fn();
        const result = prepareCaptureVideo(video).then(ready);
        expect(video.play).toHaveBeenCalledTimes(1);
        video.dispatchEvent(new Event('loadedmetadata'));
        await Promise.resolve();
        jest.advanceTimersByTime(1800);
        expect(ready).not.toHaveBeenCalled();
        readyState = HTMLMediaElement.HAVE_CURRENT_DATA;
        video.dispatchEvent(new Event('loadeddata'));
        await result;
        expect(ready).toHaveBeenCalledTimes(1);
        expect(jest.getTimerCount()).toBe(0);
    });

    it('times out a play promise that never settles and releases timers', async () => {
        Object.defineProperty(video, 'play', { value: jest.fn(() => new Promise(() => {})) });
        readyState = HTMLMediaElement.HAVE_CURRENT_DATA;
        const result = prepareCaptureVideo(video).catch((error) => error);
        jest.advanceTimersByTime(10000);
        await expect(result).resolves.toHaveProperty('message', 'video-load-timeout');
        expect(jest.getTimerCount()).toBe(0);
    });

    it('immediately cancels playback preparation and handles a late rejection', async () => {
        let rejectPlay!: (error: Error) => void;
        Object.defineProperty(video, 'play', { value: () => new Promise((_, reject) => { rejectPlay = reject; }) });
        const controller = new AbortController();
        const result = prepareCaptureVideo(video, controller.signal).catch((error) => error);
        controller.abort();
        await expect(result).resolves.toHaveProperty('message', 'capture-aborted');
        rejectPlay(new Error('late browser rejection'));
        await Promise.resolve();
        expect(jest.getTimerCount()).toBe(0);
    });

    it('waits for a temporarily muted shared track to recover', async () => {
        readyState = HTMLMediaElement.HAVE_CURRENT_DATA;
        const track = { readyState: 'live', muted: true };
        Object.defineProperty(video, 'srcObject', { value: { getVideoTracks: () => [track] } });
        const ready = jest.fn();
        const result = prepareCaptureVideo(video).then(ready);
        await Promise.resolve();
        jest.advanceTimersByTime(1000);
        expect(ready).not.toHaveBeenCalled();
        track.muted = false;
        jest.advanceTimersByTime(50);
        await result;
        expect(ready).toHaveBeenCalledTimes(1);
    });

    it('does not treat 120 ms or metadata as a frame on older browsers', async () => {
        const ready = jest.fn();
        const result = waitForCapturedFrame(video, 3000).then(ready);
        jest.advanceTimersByTime(1500);
        await Promise.resolve();
        expect(ready).not.toHaveBeenCalled();
        readyState = HTMLMediaElement.HAVE_CURRENT_DATA;
        jest.advanceTimersByTime(50);
        await result;
        expect(ready).toHaveBeenCalledTimes(1);
        expect(jest.getTimerCount()).toBe(0);
    });

    it('rejects missing pixels even when a compositor callback fires', async () => {
        let callback!: VideoFrameRequestCallback;
        Object.defineProperties(video, {
            requestVideoFrameCallback: { value: jest.fn((next) => { callback = next; return 17; }) },
            cancelVideoFrameCallback: { value: jest.fn() }
        });
        const result = waitForCapturedFrame(video, 900, true).catch((error) => error);
        callback(0, {} as VideoFrameCallbackMetadata);
        jest.advanceTimersByTime(900);
        await expect(result).resolves.toHaveProperty('message', 'video-frame-timeout');
        expect(video.cancelVideoFrameCallback).toHaveBeenCalledWith(17);
    });

    it('cancels stalled compositor callbacks when using a drawable frame', async () => {
        readyState = HTMLMediaElement.HAVE_CURRENT_DATA;
        Object.defineProperties(video, {
            requestVideoFrameCallback: { value: jest.fn(() => 42) },
            cancelVideoFrameCallback: { value: jest.fn() }
        });
        const result = waitForCapturedFrame(video, 900, true);
        jest.advanceTimersByTime(900);
        await result;
        expect(video.cancelVideoFrameCallback).toHaveBeenCalledWith(42);
        expect(jest.getTimerCount()).toBe(0);
    });

    it('requires a fresh callback for scroll stitching', async () => {
        readyState = HTMLMediaElement.HAVE_CURRENT_DATA;
        Object.defineProperty(video, 'requestVideoFrameCallback', { value: jest.fn() });
        const result = waitForCapturedFrame(video, 900).catch((error) => error);
        jest.advanceTimersByTime(900);
        await expect(result).resolves.toHaveProperty('message', 'video-frame-timeout');
    });

    it('returns an error when the browser stops painting instead of hanging', async () => {
        jest.spyOn(window, 'requestAnimationFrame').mockReturnValue(7);
        const cancel = jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
        const result = waitForCapturePaint().catch((error) => error);
        jest.advanceTimersByTime(2500);
        await expect(result).resolves.toHaveProperty('message', 'capture-paint-timeout');
        expect(cancel).toHaveBeenCalledWith(7);
        expect(jest.getTimerCount()).toBe(0);
    });

    it('allows cancellation while browser paints are suspended', async () => {
        jest.spyOn(window, 'requestAnimationFrame').mockReturnValue(7);
        jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
        const controller = new AbortController();
        const result = waitForCapturePaint(controller.signal).catch((error) => error);
        controller.abort();
        await expect(result).resolves.toHaveProperty('message', 'capture-aborted');
        expect(jest.getTimerCount()).toBe(0);
    });

    it('bounds optional browser constraints that never settle', async () => {
        const result = waitForCaptureOperation(new Promise(() => {}), 800, 'constraint-timeout').catch((error) => error);
        jest.advanceTimersByTime(800);
        await expect(result).resolves.toHaveProperty('message', 'constraint-timeout');
        expect(jest.getTimerCount()).toBe(0);
    });
});

describe('viewport readiness after the sharing permission UI', () => {
    const properties = ['innerWidth', 'innerHeight', 'devicePixelRatio'] as const;
    let originals: Array<PropertyDescriptor | undefined>;
    let video: HTMLVideoElement;
    let frameHeight: number;
    beforeEach(() => {
        jest.useFakeTimers();
        originals = properties.map((name) => Object.getOwnPropertyDescriptor(window, name));
        [800, 600, 1].forEach((value, index) => Object.defineProperty(window, properties[index], { configurable: true, value, writable: true }));
        frameHeight = 1200;
        video = document.createElement('video');
        Object.defineProperties(video, {
            videoWidth: { value: 1600 }, videoHeight: { get: () => frameHeight },
            readyState: { value: HTMLMediaElement.HAVE_CURRENT_DATA }
        });
    });
    afterEach(() => {
        properties.forEach((name, index) => {
            if (originals[index]) Object.defineProperty(window, name, originals[index]!);
        });
        jest.useRealTimers();
    });
    it('waits through toolbar animation and delayed video resizing before choosing a baseline', async () => {
        const ready = jest.fn();
        const result = waitForStableCaptureViewport(video, new AbortController().signal).then(ready);
        jest.advanceTimersByTime(200);
        window.innerHeight = 580;
        jest.advanceTimersByTime(200);
        window.innerHeight = 550;
        jest.advanceTimersByTime(700);
        expect(ready).not.toHaveBeenCalled();
        frameHeight = 1100;
        jest.advanceTimersByTime(350);
        expect(ready).not.toHaveBeenCalled();
        jest.advanceTimersByTime(50);
        await result;
        expect(ready).toHaveBeenCalledWith({ width: 800, height: 550, pixelRatio: 1 });
        expect(jest.getTimerCount()).toBe(0);
    });
    it('bounds a stream that never matches the current viewport', async () => {
        frameHeight = 1000;
        const result = waitForStableCaptureViewport(video, new AbortController().signal).catch((error) => error);
        jest.advanceTimersByTime(8000);
        await expect(result).resolves.toHaveProperty('message', 'capture-viewport-unsettled');
        expect(jest.getTimerCount()).toBe(0);
    });
    it('cleans up immediately when preparation is cancelled', async () => {
        const controller = new AbortController();
        const result = waitForStableCaptureViewport(video, controller.signal).catch((error) => error);
        controller.abort();
        await expect(result).resolves.toHaveProperty('message', 'capture-aborted');
        expect(jest.getTimerCount()).toBe(0);
    });
});
