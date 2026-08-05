import React, {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useLayoutEffect,
    useRef,
    useState,
} from 'react';
import {
    getInkOpacity,
    getInkWidth,
    isMeaningfulSignature,
    measureSignature,
    resolvePointerPressure,
    SignatureInkPoint,
    SignatureInkStroke,
    SignatureInkTool,
    SignatureMetrics,
    clamp,
} from '../../features/signatures/signatureInk';

export interface SignatureCanvasState {
    hasInk: boolean;
    canUndo: boolean;
    canRedo: boolean;
    isMeaningful: boolean;
}

export interface RealisticSignatureCanvasHandle {
    clear: () => void;
    undo: () => void;
    redo: () => void;
    isEmpty: () => boolean;
    isMeaningful: () => boolean;
    getMetrics: () => SignatureMetrics;
    toDataURL: () => string | null;
}

interface RealisticSignatureCanvasProps {
    tool: SignatureInkTool;
    color: string;
    size: number;
    onStateChange?: (state: SignatureCanvasState) => void;
    className?: string;
}

interface CanvasDimensions {
    width: number;
    height: number;
    dpr: number;
}

interface CanvasViewport {
    scale: number;
    offsetX: number;
    offsetY: number;
}

interface RenderedPoint extends SignatureInkPoint {
    canvasX: number;
    canvasY: number;
}

const SIGNATURE_LOGICAL_WIDTH = 640;
const SIGNATURE_LOGICAL_HEIGHT = 300;
const EMPTY_DIMENSIONS: CanvasDimensions = { width: 640, height: 300, dpr: 1 };

const getCanvasViewport = (width: number, height: number): CanvasViewport => {
    const scale = Math.min(
        Math.max(1, width) / SIGNATURE_LOGICAL_WIDTH,
        Math.max(1, height) / SIGNATURE_LOGICAL_HEIGHT
    );
    return {
        scale,
        offsetX: (width - SIGNATURE_LOGICAL_WIDTH * scale) / 2,
        offsetY: (height - SIGNATURE_LOGICAL_HEIGHT * scale) / 2,
    };
};

const seededUnit = (seed: number): number => {
    const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return value - Math.floor(value);
};

const drawLine = (
    ctx: CanvasRenderingContext2D,
    from: RenderedPoint,
    to: RenderedPoint,
    width: number,
    color: string,
    opacity: number,
    offsetX = 0,
    offsetY = 0
) => {
    ctx.save();
    ctx.globalAlpha = clamp(opacity, 0, 1);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(0.3, width);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(from.canvasX + offsetX, from.canvasY + offsetY);
    ctx.lineTo(to.canvasX + offsetX, to.canvasY + offsetY);
    ctx.stroke();
    ctx.restore();
};

const toRenderedPoints = (
    points: readonly SignatureInkPoint[],
    width: number,
    height: number
): RenderedPoint[] => {
    if (points.length < 3) {
        return points.map((point) => ({
            ...point,
            canvasX: point.x * width,
            canvasY: point.y * height,
        }));
    }

    const rendered: RenderedPoint[] = [];
    const catmullRom = (p0: number, p1: number, p2: number, p3: number, t: number) => {
        const t2 = t * t;
        const t3 = t2 * t;
        return 0.5 * (
            (2 * p1)
            + (-p0 + p2) * t
            + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
            + (-p0 + 3 * p1 - 3 * p2 + p3) * t3
        );
    };

    for (let index = 0; index < points.length - 1; index += 1) {
        const p0 = points[Math.max(0, index - 1)];
        const p1 = points[index];
        const p2 = points[index + 1];
        const p3 = points[Math.min(points.length - 1, index + 2)];
        const distance = Math.hypot((p2.x - p1.x) * width, (p2.y - p1.y) * height);
        const samples = Math.min(4, Math.max(1, Math.ceil(distance / 6)));

        for (let sample = 0; sample < samples; sample += 1) {
            const t = sample / samples;
            const x = catmullRom(p0.x, p1.x, p2.x, p3.x, t);
            const y = catmullRom(p0.y, p1.y, p2.y, p3.y, t);
            rendered.push({
                x,
                y,
                canvasX: x * width,
                canvasY: y * height,
                time: p1.time + (p2.time - p1.time) * t,
                pressure: p1.pressure + (p2.pressure - p1.pressure) * t,
            });
        }
    }

    const last = points[points.length - 1];
    rendered.push({ ...last, canvasX: last.x * width, canvasY: last.y * height });
    return rendered;
};

const drawPencilGrain = (
    ctx: CanvasRenderingContext2D,
    stroke: SignatureInkStroke,
    from: RenderedPoint,
    to: RenderedPoint,
    segmentIndex: number,
    width: number,
    renderScale: number
) => {
    const distance = Math.hypot(to.canvasX - from.canvasX, to.canvasY - from.canvasY);
    const grainCount = Math.min(12, Math.max(1, Math.floor(distance / Math.max(2, 3 * renderScale))));

    ctx.save();
    ctx.fillStyle = stroke.color;
    for (let grainIndex = 0; grainIndex < grainCount; grainIndex += 1) {
        const seed = stroke.id * 97 + segmentIndex * 31 + grainIndex * 7;
        const progress = (grainIndex + seededUnit(seed)) / grainCount;
        const normalX = -(to.canvasY - from.canvasY) / Math.max(distance, 1);
        const normalY = (to.canvasX - from.canvasX) / Math.max(distance, 1);
        const offset = (seededUnit(seed + 2) - 0.5) * width * 1.8;
        const radius = (0.16 + seededUnit(seed + 4) * 0.34) * renderScale;
        ctx.globalAlpha = 0.08 + seededUnit(seed + 6) * 0.16;
        ctx.beginPath();
        ctx.arc(
            from.canvasX + (to.canvasX - from.canvasX) * progress + normalX * offset,
            from.canvasY + (to.canvasY - from.canvasY) * progress + normalY * offset,
            radius,
            0,
            Math.PI * 2
        );
        ctx.fill();
    }
    ctx.restore();
};

const drawStrokeDot = (
    ctx: CanvasRenderingContext2D,
    stroke: SignatureInkStroke,
    point: RenderedPoint,
    renderScale: number
) => {
    const width = getInkWidth(stroke.tool, stroke.size, point.pressure) * renderScale;
    ctx.save();
    ctx.fillStyle = stroke.color;
    ctx.globalAlpha = getInkOpacity(stroke.tool, point.pressure);
    ctx.beginPath();
    ctx.arc(point.canvasX, point.canvasY, Math.max(0.65, width / 2), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
};

const renderSignatureStrokes = (
    ctx: CanvasRenderingContext2D,
    strokes: readonly SignatureInkStroke[],
    width: number,
    height: number,
    renderScale: number
) => {
    strokes.forEach((stroke) => {
        const points = toRenderedPoints(stroke.points, width, height);
        if (points.length === 1) {
            drawStrokeDot(ctx, stroke, points[0], renderScale);
            return;
        }

        for (let index = 1; index < points.length; index += 1) {
            const from = points[index - 1];
            const to = points[index];
            const pressure = (from.pressure + to.pressure) / 2;
            const inkWidth = getInkWidth(stroke.tool, stroke.size, pressure) * renderScale;
            const opacity = getInkOpacity(stroke.tool, pressure);
            const seed = stroke.id * 131 + index * 17;

            if (stroke.tool === 'pencil') {
                drawLine(ctx, from, to, inkWidth * 1.28, stroke.color, opacity * 0.28);
                for (let pass = 0; pass < 3; pass += 1) {
                    const offsetX = (seededUnit(seed + pass * 5) - 0.5) * inkWidth * 0.55;
                    const offsetY = (seededUnit(seed + pass * 5 + 1) - 0.5) * inkWidth * 0.55;
                    drawLine(
                        ctx,
                        from,
                        to,
                        inkWidth * (0.3 + seededUnit(seed + pass * 5 + 2) * 0.2),
                        stroke.color,
                        opacity * (0.2 + seededUnit(seed + pass * 5 + 3) * 0.12),
                        offsetX,
                        offsetY
                    );
                }
                drawPencilGrain(ctx, stroke, from, to, index, inkWidth, renderScale);
                continue;
            }

            if (stroke.tool === 'marker') {
                drawLine(ctx, from, to, inkWidth * 1.12, stroke.color, opacity * 0.23);
                drawLine(ctx, from, to, inkWidth * 0.82, stroke.color, opacity * 0.74);
                continue;
            }

            drawLine(ctx, from, to, inkWidth * 1.24, stroke.color, opacity * 0.24);
            drawLine(ctx, from, to, inkWidth * 0.92, stroke.color, opacity * 0.92);

            if (seededUnit(seed) > 0.72) {
                ctx.save();
                ctx.fillStyle = stroke.color;
                ctx.globalAlpha = opacity * 0.22;
                ctx.beginPath();
                ctx.arc(to.canvasX, to.canvasY, Math.max(0.35, inkWidth * 0.28), 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        }
    });
};

const trimTransparentCanvas = (
    source: HTMLCanvasElement,
    padding: number
): HTMLCanvasElement | null => {
    const sourceContext = source.getContext('2d');
    if (!sourceContext) return null;

    const { width, height } = source;
    const pixels = sourceContext.getImageData(0, 0, width, height).data;
    let top = height;
    let left = width;
    let right = -1;
    let bottom = -1;

    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            if (pixels[(y * width + x) * 4 + 3] > 2) {
                top = Math.min(top, y);
                left = Math.min(left, x);
                right = Math.max(right, x);
                bottom = Math.max(bottom, y);
            }
        }
    }

    if (right < left || bottom < top) return null;

    const cropX = Math.max(0, left - padding);
    const cropY = Math.max(0, top - padding);
    const cropRight = Math.min(width - 1, right + padding);
    const cropBottom = Math.min(height - 1, bottom + padding);
    const trimmed = document.createElement('canvas');
    trimmed.width = Math.max(1, cropRight - cropX + 1);
    trimmed.height = Math.max(1, cropBottom - cropY + 1);
    trimmed.getContext('2d')?.drawImage(
        source,
        cropX,
        cropY,
        trimmed.width,
        trimmed.height,
        0,
        0,
        trimmed.width,
        trimmed.height
    );
    return trimmed;
};

const RealisticSignatureCanvas = forwardRef<
    RealisticSignatureCanvasHandle,
    RealisticSignatureCanvasProps
>(({ tool, color, size, onStateChange, className = '' }, forwardedRef) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const strokesRef = useRef<SignatureInkStroke[]>([]);
    const redoStrokesRef = useRef<SignatureInkStroke[]>([]);
    const activePointerRef = useRef<number | null>(null);
    const activeStrokeRef = useRef<SignatureInkStroke | null>(null);
    const dimensionsRef = useRef<CanvasDimensions>(EMPTY_DIMENSIONS);
    const nextStrokeIdRef = useRef(1);
    const redrawFrameRef = useRef<number | null>(null);
    const [hasInk, setHasInk] = useState(false);

    const getMetrics = useCallback(() => {
        return measureSignature(
            strokesRef.current,
            SIGNATURE_LOGICAL_WIDTH,
            SIGNATURE_LOGICAL_HEIGHT
        );
    }, []);

    const emitState = useCallback(() => {
        const nextHasInk = strokesRef.current.some((stroke) => stroke.points.length > 0);
        setHasInk(nextHasInk);
        onStateChange?.({
            hasInk: nextHasInk,
            canUndo: strokesRef.current.length > 0,
            canRedo: redoStrokesRef.current.length > 0,
            isMeaningful: isMeaningfulSignature(getMetrics()),
        });
    }, [getMetrics, onStateChange]);

    const redraw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext('2d');
        if (!context) return;
        const { width, height, dpr } = dimensionsRef.current;
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        context.clearRect(0, 0, width, height);
        const viewport = getCanvasViewport(width, height);
        context.save();
        context.translate(viewport.offsetX, viewport.offsetY);
        context.scale(viewport.scale, viewport.scale);
        renderSignatureStrokes(
            context,
            strokesRef.current,
            SIGNATURE_LOGICAL_WIDTH,
            SIGNATURE_LOGICAL_HEIGHT,
            1 / viewport.scale
        );
        context.restore();
    }, []);

    const scheduleRedraw = useCallback(() => {
        if (redrawFrameRef.current !== null) return;
        redrawFrameRef.current = window.requestAnimationFrame(() => {
            redrawFrameRef.current = null;
            redraw();
        });
    }, [redraw]);

    const resizeCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;
        const rect = container.getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        dimensionsRef.current = { width: rect.width, height: rect.height, dpr };
        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);
        redraw();
    }, [redraw]);

    useLayoutEffect(() => {
        resizeCanvas();
        const container = containerRef.current;
        if (!container) return undefined;

        if (typeof ResizeObserver !== 'undefined') {
            const observer = new ResizeObserver(resizeCanvas);
            observer.observe(container);
            return () => observer.disconnect();
        }

        window.addEventListener('resize', resizeCanvas);
        return () => window.removeEventListener('resize', resizeCanvas);
    }, [resizeCanvas]);

    useEffect(() => () => {
        if (redrawFrameRef.current !== null) {
            window.cancelAnimationFrame(redrawFrameRef.current);
        }
    }, []);

    useEffect(() => {
        redraw();
    }, [color, redraw, size, tool]);

    const pointFromPointer = useCallback((event: PointerEvent): SignatureInkPoint | null => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) return null;
        const viewport = getCanvasViewport(rect.width, rect.height);
        const stroke = activeStrokeRef.current;
        const previous = stroke?.points[stroke.points.length - 1];
        const x = clamp(
            ((event.clientX - rect.left - viewport.offsetX) / viewport.scale)
                / SIGNATURE_LOGICAL_WIDTH,
            0,
            1
        );
        const y = clamp(
            ((event.clientY - rect.top - viewport.offsetY) / viewport.scale)
                / SIGNATURE_LOGICAL_HEIGHT,
            0,
            1
        );
        const distance = previous
            ? Math.hypot(
                (x - previous.x) * SIGNATURE_LOGICAL_WIDTH * viewport.scale,
                (y - previous.y) * SIGNATURE_LOGICAL_HEIGHT * viewport.scale
            )
            : 0;
        const elapsed = previous ? Math.max(1, event.timeStamp - previous.time) : 16;
        const shouldKeepPreviousPressure = Boolean(
            previous
            && (event.pointerType === 'pen' || event.pointerType === 'touch')
            && event.pressure <= 0
        );

        return {
            x,
            y,
            time: event.timeStamp,
            pressure: shouldKeepPreviousPressure
                ? previous!.pressure
                : resolvePointerPressure(event.pressure, event.pointerType, distance / elapsed),
        };
    }, []);

    const appendPointerEvent = useCallback((event: PointerEvent) => {
        const stroke = activeStrokeRef.current;
        if (!stroke) return;
        const point = pointFromPointer(event);
        if (!point) return;
        const previous = stroke.points[stroke.points.length - 1];
        if (previous) {
            const { width, height } = dimensionsRef.current;
            const viewport = getCanvasViewport(width, height);
            const distance = Math.hypot(
                (point.x - previous.x) * SIGNATURE_LOGICAL_WIDTH * viewport.scale,
                (point.y - previous.y) * SIGNATURE_LOGICAL_HEIGHT * viewport.scale
            );
            if (distance < 0.35) return;
        }
        stroke.points.push(point);
    }, [pointFromPointer]);

    const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
        if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        const stroke: SignatureInkStroke = {
            id: nextStrokeIdRef.current,
            tool,
            color,
            size,
            points: [],
        };
        nextStrokeIdRef.current += 1;
        strokesRef.current.push(stroke);
        redoStrokesRef.current = [];
        activePointerRef.current = event.pointerId;
        activeStrokeRef.current = stroke;
        appendPointerEvent(event.nativeEvent);
        redraw();
        emitState();
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
        if (activePointerRef.current !== event.pointerId) return;
        event.preventDefault();
        const nativeEvent = event.nativeEvent;
        const coalescedEvents = typeof nativeEvent.getCoalescedEvents === 'function'
            ? nativeEvent.getCoalescedEvents()
            : [nativeEvent];
        (coalescedEvents.length > 0 ? coalescedEvents : [nativeEvent]).forEach(appendPointerEvent);
        scheduleRedraw();
    };

    const finishPointer = (event: React.PointerEvent<HTMLCanvasElement>) => {
        if (activePointerRef.current !== event.pointerId) return;
        event.preventDefault();
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        activePointerRef.current = null;
        activeStrokeRef.current = null;
        redraw();
        emitState();
    };

    const clear = useCallback(() => {
        strokesRef.current = [];
        redoStrokesRef.current = [];
        activePointerRef.current = null;
        activeStrokeRef.current = null;
        redraw();
        emitState();
    }, [emitState, redraw]);

    const undo = useCallback(() => {
        const removed = strokesRef.current[strokesRef.current.length - 1];
        if (removed) redoStrokesRef.current.push(removed);
        strokesRef.current = strokesRef.current.slice(0, -1);
        activePointerRef.current = null;
        activeStrokeRef.current = null;
        redraw();
        emitState();
    }, [emitState, redraw]);

    const redo = useCallback(() => {
        const restored = redoStrokesRef.current.pop();
        if (!restored) return;
        strokesRef.current.push(restored);
        activePointerRef.current = null;
        activeStrokeRef.current = null;
        redraw();
        emitState();
    }, [emitState, redraw]);

    const toDataURL = useCallback((): string | null => {
        if (strokesRef.current.length === 0) return null;
        const exportScale = 2;
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = SIGNATURE_LOGICAL_WIDTH * exportScale;
        exportCanvas.height = SIGNATURE_LOGICAL_HEIGHT * exportScale;
        const exportContext = exportCanvas.getContext('2d');
        if (!exportContext) return null;
        renderSignatureStrokes(
            exportContext,
            strokesRef.current,
            exportCanvas.width,
            exportCanvas.height,
            exportScale
        );
        const trimmed = trimTransparentCanvas(exportCanvas, Math.round(18 * exportScale));
        return trimmed?.toDataURL('image/png') ?? null;
    }, []);

    useImperativeHandle(forwardedRef, () => ({
        clear,
        undo,
        redo,
        isEmpty: () => strokesRef.current.length === 0,
        isMeaningful: () => isMeaningfulSignature(getMetrics()),
        getMetrics,
        toDataURL,
    }), [clear, getMetrics, redo, toDataURL, undo]);

    return (
        <div
            ref={containerRef}
            className={`relative w-full overflow-hidden rounded-2xl border border-slate-200 bg-[#fcfbf7] shadow-inner ${className}`}
            style={{
                aspectRatio: '32 / 15',
                backgroundImage: [
                    'linear-gradient(rgba(148,163,184,0.08) 1px, transparent 1px)',
                    'linear-gradient(90deg, rgba(148,163,184,0.05) 1px, transparent 1px)',
                    'radial-gradient(circle at 20% 15%, rgba(148,163,184,0.08) 0.6px, transparent 0.8px)',
                ].join(','),
                backgroundSize: '28px 28px, 28px 28px, 7px 7px',
            }}
        >
            <canvas
                ref={canvasRef}
                data-testid="signature-ink-canvas"
                role="application"
                aria-label="서명을 직접 그리는 영역"
                tabIndex={0}
                className="absolute inset-0 h-full w-full cursor-crosshair touch-none select-none outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={finishPointer}
                onPointerCancel={finishPointer}
                onKeyDown={(event) => {
                    if (event.key === 'Delete' || event.key === 'Backspace') {
                        event.preventDefault();
                        clear();
                    }
                }}
            />
            {!hasInk && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center">
                    <div>
                        <div className="mx-auto mb-3 h-px w-28 bg-gradient-to-r from-transparent via-slate-300 to-transparent" />
                        <p className="text-sm font-semibold text-slate-400">이 영역에 평소처럼 서명해 주세요</p>
                        <p className="mt-1 text-xs text-slate-300">스타일러스 · 터치 · 마우스 입력 지원</p>
                    </div>
                </div>
            )}
            <div className="pointer-events-none absolute bottom-3 left-4 right-4 flex items-center justify-between text-[11px] font-medium text-slate-400">
                <span>투명 배경으로 저장됩니다</span>
                <span className="rounded-full bg-white/80 px-2 py-1 shadow-sm">필압 · 속도 보정</span>
            </div>
        </div>
    );
});

RealisticSignatureCanvas.displayName = 'RealisticSignatureCanvas';

export default RealisticSignatureCanvas;
