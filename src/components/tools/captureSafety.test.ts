import { createCaptureDiagnostics, getCaptureErrorCode } from './captureDiagnostics';
import { createCaptureIdentity } from './captureIdentity';
import { fitCaptureSize, getCaptureConstraints, getCaptureParts, getScrollCaptureScale, isSameCaptureViewport, retainCaptureHistory } from './capturePolicy';

describe('camera resource and coordinate safety', () => {
    it('keeps standard capture within four megapixels on a 4K display', () => {
        const constraints = getCaptureConstraints('standard', { width: 3840, height: 2160 }, 2);
        const width = (constraints.width as ConstrainULongRange).ideal as number;
        const height = (constraints.height as ConstrainULongRange).ideal as number;
        expect(width * height).toBeLessThanOrEqual(4_000_000);
        expect(width / height).toBeCloseTo(3840 / 2160, 2);
        expect((constraints.frameRate as ConstrainDoubleRange).ideal).toBe(15);
    });
    it('caps high quality before allocating a canvas', () => {
        const size = fitCaptureSize(15360, 8640, 12_000_000);
        expect(size.width * size.height).toBeLessThanOrEqual(12_000_000);
        expect(size.scale).toBeLessThan(1);
    });
    it('requests all native 4K pixels at high quality on a high-DPI screen', () => {
        expect(getCaptureConstraints('high', { width: 1920, height: 1080 }, 2)).toMatchObject({
            width: { ideal: 3840 }, height: { ideal: 2160 }, resizeMode: 'none'
        });
    });
    it.each(['standard', 'high'] as const)('keeps a narrow scrolling region at its native pixel density in %s quality', (quality) => {
        expect(getScrollCaptureScale(5760, 2880, 600, 1000, quality)).toBe(2);
    });
    it.each([['standard', 4_000_000], ['high', 12_000_000]] as const)('bounds large scrolling tiles in %s quality without enlarging the source', (quality, budget) => {
        const scale = getScrollCaptureScale(11520, 3840, 3840, 2160, quality);
        expect(Math.round(3840 * scale) * Math.round(2160 * scale)).toBeLessThanOrEqual(budget);
        expect(scale).toBeLessThan(3);
        expect(getScrollCaptureScale(1280, 1920, 300, 600, quality)).toBeLessThanOrEqual(1280 / 1920);
    });
    it('invalidates saved coordinates on resizing or DPI changes', () => {
        const original = { width: 1920, height: 1080, pixelRatio: 1 };
        expect(isSameCaptureViewport(original, { ...original })).toBe(true);
        expect(isSameCaptureViewport(original, { ...original, pixelRatio: 1.25 })).toBe(false);
        expect(isSameCaptureViewport(original, { ...original, width: 1280 })).toBe(false);
    });
    it('preserves the newest result while evicting oversized history', () => {
        const items = Array.from({ length: 8 }, () => ({ width: 4000, height: 3000, blob: new Blob(['image']) }));
        expect(retainCaptureHistory(items)).toEqual(items.slice(0, 2));
    });
    it('splits long images without missing or overlapping rows', () => {
        const parts = getCaptureParts(2400, 28000);
        expect(parts.reduce((sum, part) => sum + part.height, 0)).toBe(28000);
        parts.forEach((part) => {
            expect(part.height * 2400).toBeLessThanOrEqual(8_000_000);
        });
        parts.slice(1).forEach((part, index) => expect(part.top).toBe(parts[index].top + parts[index].height));
    });
});

describe('local capture diagnostics', () => {
    it('keeps only 20 attempts and never copies exception text into exports', () => {
        const diagnostics = createCaptureDiagnostics();
        for (let i = 0; i < 22; i += 1) {
            const run = diagnostics.start('screen', 'standard');
            run.mark('video');
            run.finish('failed', new Error('https://private.example/?secret=do-not-record'));
        }
        const exported = diagnostics.snapshot();
        expect(exported.records).toHaveLength(20);
        expect(JSON.stringify(exported)).not.toMatch(/private|secret|do-not-record/);
        expect(exported.records[0].errorCode).toBe('unknown');
        expect(getCaptureErrorCode(new DOMException('private description', 'NotAllowedError'))).toBe('NotAllowedError');
    });
    it('ignores a late result after cancellation', () => {
        const diagnostics = createCaptureDiagnostics();
        const run = diagnostics.start('screen', 'high');
        run.mark('permission');
        run.finish('cancelled');
        run.finish('success');
        run.mark('encoding');
        expect(diagnostics.snapshot().records[0]).toMatchObject({ outcome: 'cancelled', stages: [{ stage: 'permission', elapsedMs: expect.any(Number) }] });
    });
});

describe('current-tab identity', () => {
    const descriptor = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
    afterEach(() => {
        if (descriptor) Object.defineProperty(navigator, 'mediaDevices', descriptor);
        else delete (navigator as unknown as { mediaDevices?: MediaDevices }).mediaDevices;
    });
    it('accepts only this page handle, even when another tab has the same dimensions', () => {
        let handle = '';
        const configure = jest.fn((config: { handle: string }) => { handle = config.handle; });
        Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { setCaptureHandleConfig: configure } });
        const identity = createCaptureIdentity();
        const track = { getSettings: () => ({ displaySurface: 'browser' }), getCaptureHandle: () => ({ handle }) };
        expect(identity.verify(track as unknown as MediaStreamTrack)).toBe(true);
        expect(configure).toHaveBeenCalledWith({ handle, exposeOrigin: false, permittedOrigins: [window.location.origin] });
        track.getCaptureHandle = () => ({ handle: 'different-tab' });
        expect(() => identity.verify(track as unknown as MediaStreamTrack)).toThrow('screen-tab-mismatch');
        identity.dispose();
        expect(handle).toBe('');
    });
    it('requires visual confirmation when identity APIs are unavailable', () => {
        Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {} });
        const identity = createCaptureIdentity();
        expect(identity.verify({ getSettings: () => ({ displaySurface: 'browser' }) } as MediaStreamTrack)).toBe(false);
        expect(() => identity.verify({ getSettings: () => ({ displaySurface: 'monitor' }) } as MediaStreamTrack)).toThrow('screen-browser-only');
    });
});
