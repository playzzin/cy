import {
    getInkOpacity,
    getInkWidth,
    isMeaningfulSignature,
    measureSignature,
    resolvePointerPressure,
    SignatureInkStroke,
} from './signatureInk';

describe('signatureInk', () => {
    it('uses real stylus pressure when a pen provides it', () => {
        expect(resolvePointerPressure(0.8, 'pen', 2)).toBeGreaterThan(
            resolvePointerPressure(0.2, 'pen', 0.1)
        );
    });

    it('makes slower mouse movement slightly heavier than fast movement', () => {
        expect(resolvePointerPressure(0.5, 'mouse', 0.1)).toBeGreaterThan(
            resolvePointerPressure(0.5, 'mouse', 2)
        );
    });

    it('keeps ink width and opacity inside a practical range', () => {
        expect(getInkWidth('ballpoint', 1, 0)).toBeGreaterThan(0);
        expect(getInkWidth('marker', 5, 1)).toBeGreaterThan(getInkWidth('ballpoint', 5, 1));
        expect(getInkOpacity('pencil', 0.2)).toBeLessThan(getInkOpacity('ballpoint', 0.8));
    });

    it('rejects a dot but accepts a deliberate signature stroke', () => {
        const dot: SignatureInkStroke[] = [{
            id: 1,
            tool: 'ballpoint',
            color: '#000000',
            size: 2,
            points: [{ x: 0.5, y: 0.5, pressure: 0.5, time: 0 }],
        }];
        const line: SignatureInkStroke[] = [{
            id: 2,
            tool: 'ballpoint',
            color: '#000000',
            size: 2,
            points: [
                { x: 0.1, y: 0.6, pressure: 0.4, time: 0 },
                { x: 0.3, y: 0.4, pressure: 0.6, time: 20 },
                { x: 0.6, y: 0.55, pressure: 0.5, time: 40 },
            ],
        }];

        expect(isMeaningfulSignature(measureSignature(dot, 600, 260))).toBe(false);
        expect(isMeaningfulSignature(measureSignature(line, 600, 260))).toBe(true);
    });
});
