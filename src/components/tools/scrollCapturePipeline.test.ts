import { captureScrollRangeParts, createPagedCaptureWriter, waitForScrollContentStable } from './scrollCapturePipeline';
import { getScrollCaptureViewport } from './scrollCaptureGeometry';
import * as readiness from './captureFrameReadiness';

describe('bounded scroll capture output', () => {
    afterEach(() => jest.restoreAllMocks());
    it('encodes consecutive parts while keeping seam rows continuous', async () => {
        const drawImage = jest.fn();
        jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({ drawImage } as unknown as CanvasRenderingContext2D));
        const encodedSizes: number[] = [];
        jest.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (this: HTMLCanvasElement, callback) {
            encodedSizes.push(this.height);
            callback(new Blob(['part'], { type: 'image/png' }));
        });
        const writer = createPagedCaptureWriter(1000, 18000);
        const source = document.createElement('canvas');
        source.width = 1000;
        source.height = 1000;
        await writer.append(source, { sourceY: 0, sourceHeight: 1000, destY: 0, destHeight: 9000, startContentY: 0, endContentY: 9000 });
        await writer.append(source, { sourceY: 0, sourceHeight: 1000, destY: 9000, destHeight: 9000, startContentY: 9000, endContentY: 18000 });
        expect(encodedSizes).toEqual([8000, 8000, 2000]);
        expect(writer.finish().reduce((total, part) => total + part.height, 0)).toBe(18000);
        expect(drawImage.mock.calls.map((call) => [call[6], call[8]])).toEqual([[0, 8000], [0, 1000], [1000, 7000], [0, 2000]]);
        writer.dispose();
    });
    it('rejects missing rows instead of publishing a partial image', async () => {
        const writer = createPagedCaptureWriter(100, 300);
        await expect(writer.append(document.createElement('canvas'), {
            sourceY: 0, sourceHeight: 100, destY: 10, destHeight: 100, startContentY: 10, endContentY: 110
        })).rejects.toThrow('scroll-frame-gap');
        expect(() => writer.finish()).toThrow('scroll-frame-gap');
        writer.dispose();
    });
    it('cancels before allocating output', async () => {
        const controller = new AbortController();
        controller.abort();
        const writer = createPagedCaptureWriter(100, 300, controller.signal);
        await expect(writer.append(document.createElement('canvas'), {
            sourceY: 0, sourceHeight: 100, destY: 0, destHeight: 300, startContentY: 0, endContentY: 300
        })).rejects.toThrow('capture-aborted');
    });
});

describe('scroll content readiness', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => { jest.useRealTimers(); });
    it('waits for a quiet interval after asynchronously inserted rows', async () => {
        const target = document.createElement('div');
        const complete = jest.fn();
        const result = waitForScrollContentStable(target).then(complete);
        jest.advanceTimersByTime(150);
        target.appendChild(document.createElement('div'));
        await Promise.resolve();
        jest.advanceTimersByTime(100);
        expect(complete).not.toHaveBeenCalled();
        jest.advanceTimersByTime(100);
        await result;
        expect(complete).toHaveBeenCalledTimes(1);
        expect(jest.getTimerCount()).toBe(0);
    });
    it('cleans observation and timers on cancellation', async () => {
        const controller = new AbortController();
        const result = waitForScrollContentStable(document.createElement('div'), controller.signal).catch((error) => error);
        controller.abort();
        await expect(result).resolves.toHaveProperty('message', 'capture-aborted');
        expect(jest.getTimerCount()).toBe(0);
    });
});

describe('scroll range capture through the last visible content row', () => {
    let target: HTMLDivElement;
    let video: HTMLVideoElement;
    let drawImage: jest.Mock;
    let scrollHeight: number;
    let scrollTop: number;
    let targetTop: number;
    let clientHeight: number;
    let border: number;

    beforeEach(() => {
        scrollHeight = 600;
        scrollTop = 0;
        targetTop = 0;
        clientHeight = 200;
        border = 0;
        target = document.createElement('div');
        document.body.appendChild(target);
        Object.defineProperties(target, {
            clientLeft: { get: () => border }, clientTop: { get: () => border },
            clientWidth: { value: 300 }, clientHeight: { get: () => clientHeight },
            scrollHeight: { get: () => scrollHeight }, scrollTop: { get: () => scrollTop }
        });
        target.getBoundingClientRect = () => ({ left: 0, top: targetTop, width: 300 + border * 2, height: clientHeight + border * 2,
            right: 300 + border * 2, bottom: targetTop + clientHeight + border * 2 } as DOMRect);
        video = document.createElement('video');
        Object.defineProperties(video, { videoWidth: { value: window.innerWidth }, videoHeight: { value: window.innerHeight } });
        drawImage = jest.fn();
        const pixels = new Uint8ClampedArray(32 * 24 * 4);
        for (let i = 0; i < pixels.length; i += 4) {
            const value = i % 8 === 0 ? 0 : 255;
            pixels[i] = value; pixels[i + 1] = value; pixels[i + 2] = value; pixels[i + 3] = 255;
        }
        jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({ drawImage, getImageData: () => ({ data: pixels }) } as unknown as CanvasRenderingContext2D));
        jest.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(new Blob(['png'], { type: 'image/png' })));
        jest.spyOn(readiness, 'waitForCapturePaint').mockResolvedValue();
        jest.spyOn(readiness, 'waitForCapturedFrame').mockResolvedValue();
    });
    afterEach(() => { target.remove(); jest.restoreAllMocks(); });

    const capture = (topContentY: number, bottomContentY: number, scrollTo = (top: number) => {
        scrollTop = Math.max(0, Math.min(scrollHeight - clientHeight, top));
    }) => captureScrollRangeParts({
        video, target, range: { left: border, width: 300, topContentY, bottomContentY },
        quality: 'standard', signal: new AbortController().signal,
        getVisibleRect: () => getScrollCaptureViewport(target),
        getScrollTop: () => scrollTop, scrollTo, validate: () => {}, onProgress: () => {}, hideCaptureUi: () => () => {}
    });

    it('accepts identical repeated table frames when fresh frames and scrolling advance', async () => {
        const parts = await capture(0, 600);
        expect(parts.map((part) => part.height)).toEqual([600]);
        expect(scrollTop).toBe(400);
        // Two compositor frames per step, with one retry for the equal middle frame.
        expect(readiness.waitForCapturedFrame).toHaveBeenCalledTimes(11);
        expect(drawImage.mock.calls.filter((call) => call[0] === video).map((call) => call[2])).toEqual([0, 0, 0, 0, 0, 0, 0]);
    });

    it('captures a bordered scroller clipped above the viewport all the way to its bottom', async () => {
        targetTop = -52;
        border = 2;
        const parts = await capture(50, 600);
        expect(parts.map((part) => part.height)).toEqual([550]);
        expect(scrollTop).toBe(400);
        const crops = drawImage.mock.calls.filter((call) => call[0] === video);
        expect(crops[0].slice(1, 5)).toEqual([2, 0, 300, 150]);
        expect(crops[crops.length - 1].slice(1, 5)).toEqual([2, 0, 300, 150]);
    });

    it('captures a scroller clipped above by an ancestor using the same content origin', async () => {
        const ancestor = document.createElement('div');
        ancestor.style.overflowY = 'hidden';
        Object.defineProperties(ancestor, { clientWidth: { value: 300 }, clientHeight: { value: 150 } });
        ancestor.getBoundingClientRect = () => ({ left: 0, top: 50, right: 300, bottom: 200, width: 300, height: 150 } as DOMRect);
        document.body.appendChild(ancestor);
        ancestor.appendChild(target);
        try {
            const parts = await capture(50, 600);
            expect(parts.map((part) => part.height)).toEqual([550]);
            const crops = drawImage.mock.calls.filter((call) => call[0] === video);
            expect(crops.every((call) => call[2] === 50 && call[4] === 150)).toBe(true);
            expect(scrollTop).toBe(400);
        } finally { ancestor.remove(); }
    });

    it('rejects a scroller that stops moving before the requested end', async () => {
        await expect(capture(0, 600, () => {})).rejects.toThrow('scroll-frame-gap');
    });

    it('rejects an actual skipped content range', async () => {
        await expect(capture(0, 600, (top) => { scrollTop = top === 0 ? 0 : 400; })).rejects.toThrow('scroll-frame-gap');
    });

    it('rejects a bottom range hidden outside the viewport instead of claiming complete output', async () => {
        targetTop = window.innerHeight - 150;
        await expect(capture(0, 600)).rejects.toThrow('scroll-frame-gap');
        expect(scrollTop).toBe(400);
    });

    it('rejects geometry changes while a new frame is arriving', async () => {
        jest.mocked(readiness.waitForCapturedFrame).mockImplementation(async () => { clientHeight = 190; });
        await expect(capture(0, 600)).rejects.toThrow('scroll-content-changing');
    });

    it('rejects a stalled compositor rather than reusing old video pixels', async () => {
        jest.mocked(readiness.waitForCapturedFrame).mockRejectedValue(new Error('video-frame-timeout'));
        await expect(capture(0, 600)).rejects.toThrow('video-frame-timeout');
        expect(drawImage.mock.calls.filter((call) => call[0] === video)).toHaveLength(0);
    });
});
