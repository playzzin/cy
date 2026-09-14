import { createPagedCaptureWriter, waitForScrollContentStable } from './scrollCapturePipeline';

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
