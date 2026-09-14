export type CaptureAnnotationTool = 'rectangle' | 'arrow' | 'text' | 'mosaic' | 'cover';
export type CaptureAnnotation = {
    tool: CaptureAnnotationTool;
    x: number; y: number; endX: number; endY: number;
    color: string;
    size: number;
    text?: string;
};
export const getAnnotationPoint = (clientX: number, clientY: number, bounds: { left: number; top: number; width: number; height: number }, width: number, height: number) => ({
    x: Math.max(0, Math.min(width, (clientX - bounds.left) / Math.max(1, bounds.width) * width)),
    y: Math.max(0, Math.min(height, (clientY - bounds.top) / Math.max(1, bounds.height) * height))
});
export const drawCaptureAnnotations = (canvas: HTMLCanvasElement, annotations: CaptureAnnotation[]) => {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('canvas-context-failed');
    annotations.forEach((annotation) => {
        const x = Math.max(0, Math.min(annotation.x, annotation.endX));
        const y = Math.max(0, Math.min(annotation.y, annotation.endY));
        const width = Math.min(canvas.width - x, Math.abs(annotation.endX - annotation.x));
        const height = Math.min(canvas.height - y, Math.abs(annotation.endY - annotation.y));
        context.save();
        context.strokeStyle = annotation.color;
        context.fillStyle = annotation.color;
        context.lineWidth = annotation.size;
        context.lineJoin = 'round';
        context.lineCap = 'round';
        if (annotation.tool === 'rectangle') context.strokeRect(x, y, width, height);
        if (annotation.tool === 'cover') {
            context.fillStyle = '#111111';
            context.fillRect(Math.floor(x), Math.floor(y), Math.ceil(width + 1), Math.ceil(height + 1));
        }
        if (annotation.tool === 'arrow') {
            const angle = Math.atan2(annotation.endY - annotation.y, annotation.endX - annotation.x);
            const head = annotation.size * 4;
            context.beginPath();
            context.moveTo(annotation.x, annotation.y);
            context.lineTo(annotation.endX, annotation.endY);
            context.moveTo(annotation.endX - head * Math.cos(angle - Math.PI / 6), annotation.endY - head * Math.sin(angle - Math.PI / 6));
            context.lineTo(annotation.endX, annotation.endY);
            context.lineTo(annotation.endX - head * Math.cos(angle + Math.PI / 6), annotation.endY - head * Math.sin(angle + Math.PI / 6));
            context.stroke();
        }
        if (annotation.tool === 'text') {
            context.font = `600 ${annotation.size * 6}px sans-serif`;
            context.textBaseline = 'top';
            context.fillText(annotation.text || '', annotation.x, annotation.y);
        }
        if (annotation.tool === 'mosaic' && width >= 1 && height >= 1) {
            const pixels = document.createElement('canvas');
            pixels.width = Math.max(1, Math.ceil(width / Math.max(12, annotation.size * 4)));
            pixels.height = Math.max(1, Math.ceil(height / Math.max(12, annotation.size * 4)));
            const sample = pixels.getContext('2d');
            if (!sample) throw new Error('canvas-context-failed');
            sample.drawImage(canvas, x, y, width, height, 0, 0, pixels.width, pixels.height);
            context.imageSmoothingEnabled = false;
            context.drawImage(pixels, 0, 0, pixels.width, pixels.height, x, y, width, height);
            pixels.width = 0;
            pixels.height = 0;
        }
        context.restore();
    });
};
