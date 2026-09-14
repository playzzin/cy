import { drawCaptureAnnotations, getAnnotationPoint } from './captureAnnotations';

describe('capture annotations', () => {
    afterEach(() => jest.restoreAllMocks());
    it('maps a scaled preview to source pixels and clamps outside drags', () => {
        const bounds = { left: 20, top: 40, width: 400, height: 200 };
        expect(getAnnotationPoint(220, 140, bounds, 1600, 800)).toEqual({ x: 800, y: 400 });
        expect(getAnnotationPoint(-100, 500, bounds, 1600, 800)).toEqual({ x: 0, y: 800 });
    });
    it('covers a reverse-dragged region with opaque pixels', () => {
        const fillRect = jest.fn();
        const context = { save: jest.fn(), restore: jest.fn(), fillRect, fillStyle: '' };
        jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 600;
        drawCaptureAnnotations(canvas, [{ tool: 'cover', x: 300, y: 250, endX: 100, endY: 80, color: '#ff0000', size: 3 }]);
        expect(fillRect).toHaveBeenCalledWith(100, 80, 201, 171);
        expect(context.fillStyle).toBe('#111111');
    });
    it('draws text literally without interpreting HTML', () => {
        const fillText = jest.fn();
        jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ save: jest.fn(), restore: jest.fn(), fillText } as unknown as CanvasRenderingContext2D);
        const canvas = document.createElement('canvas');
        drawCaptureAnnotations(canvas, [{ tool: 'text', x: 20, y: 40, endX: 20, endY: 40, color: '#fff', size: 4, text: '<script>검토 필요</script>' }]);
        expect(fillText).toHaveBeenCalledWith('<script>검토 필요</script>', 20, 40);
    });
});
