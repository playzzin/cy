export type SignatureInkTool = 'pencil' | 'ballpoint' | 'marker';

export interface SignatureInkPoint {
    x: number;
    y: number;
    time: number;
    pressure: number;
}

export interface SignatureInkStroke {
    id: number;
    tool: SignatureInkTool;
    color: string;
    size: number;
    points: SignatureInkPoint[];
}

export interface SignatureToolPreset {
    id: SignatureInkTool;
    label: string;
    shortLabel: string;
    description: string;
    texture: string;
    defaultColor: string;
    defaultSize: number;
    baseWidth: number;
}

export interface SignatureInkColor {
    id: string;
    label: string;
    value: string;
}

export interface SignatureMetrics {
    pointCount: number;
    strokeCount: number;
    totalLength: number;
    bounds: {
        width: number;
        height: number;
    };
}

export const SIGNATURE_TOOL_PRESETS: readonly SignatureToolPreset[] = [
    {
        id: 'pencil',
        label: '연필',
        shortLabel: 'Graphite',
        description: '미세한 심 입자와 자연스러운 농담',
        texture: '사각거리는 흑연 질감',
        defaultColor: '#475569',
        defaultSize: 2,
        baseWidth: 1.7,
    },
    {
        id: 'ballpoint',
        label: '볼펜',
        shortLabel: 'Ballpoint',
        description: '속도와 필압에 따라 달라지는 잉크선',
        texture: '선명한 유성 잉크 질감',
        defaultColor: '#163a70',
        defaultSize: 3,
        baseWidth: 1.55,
    },
    {
        id: 'marker',
        label: '사인펜',
        shortLabel: 'Felt tip',
        description: '끊김이 적고 또렷한 서명용 굵은 선',
        texture: '균일한 섬유 팁 질감',
        defaultColor: '#172033',
        defaultSize: 3,
        baseWidth: 3.4,
    },
] as const;

export const SIGNATURE_INK_COLORS: readonly SignatureInkColor[] = [
    { id: 'navy', label: '딥 네이비', value: '#163a70' },
    { id: 'black', label: '잉크 블랙', value: '#172033' },
    { id: 'blue', label: '볼펜 블루', value: '#1d4ed8' },
    { id: 'graphite', label: '흑연 그레이', value: '#475569' },
] as const;

export const clamp = (value: number, min: number, max: number): number =>
    Math.min(max, Math.max(min, value));

/**
 * Stylus/touch pressure is preferred when available. Mouse input has no useful
 * pressure information, so speed is converted into a restrained pressure curve.
 */
export const resolvePointerPressure = (
    rawPressure: number,
    pointerType: string,
    speedPixelsPerMs: number
): number => {
    const safePressure = Number.isFinite(rawPressure) ? rawPressure : 0;

    if (pointerType === 'pen' && safePressure > 0) {
        return clamp(0.12 + safePressure * 0.88, 0.12, 1);
    }

    if (pointerType === 'touch' && safePressure > 0) {
        return clamp(0.2 + safePressure * 0.72, 0.2, 0.92);
    }

    const safeSpeed = Number.isFinite(speedPixelsPerMs)
        ? clamp(speedPixelsPerMs, 0, 2.5)
        : 0;

    return clamp(0.72 - safeSpeed * 0.18, 0.28, 0.72);
};

export const getInkWidth = (
    tool: SignatureInkTool,
    size: number,
    pressure: number
): number => {
    const preset = SIGNATURE_TOOL_PRESETS.find((candidate) => candidate.id === tool)
        ?? SIGNATURE_TOOL_PRESETS[1];
    const sizeScale = 0.72 + (clamp(Math.round(size), 1, 5) - 1) * 0.19;
    const safePressure = clamp(pressure, 0, 1);

    if (tool === 'marker') {
        return preset.baseWidth * sizeScale * (0.86 + safePressure * 0.3);
    }

    if (tool === 'pencil') {
        return preset.baseWidth * sizeScale * (0.5 + safePressure * 0.92);
    }

    return preset.baseWidth * sizeScale * (0.58 + safePressure * 0.76);
};

export const getInkOpacity = (tool: SignatureInkTool, pressure: number): number => {
    const safePressure = clamp(pressure, 0, 1);

    if (tool === 'pencil') return clamp(0.35 + safePressure * 0.38, 0.35, 0.73);
    if (tool === 'marker') return clamp(0.66 + safePressure * 0.18, 0.66, 0.84);
    return clamp(0.72 + safePressure * 0.22, 0.72, 0.94);
};

export const measureSignature = (
    strokes: readonly SignatureInkStroke[],
    width: number,
    height: number
): SignatureMetrics => {
    const safeWidth = Math.max(1, width);
    const safeHeight = Math.max(1, height);
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let totalLength = 0;
    let pointCount = 0;

    strokes.forEach((stroke) => {
        stroke.points.forEach((point, pointIndex) => {
            const x = clamp(point.x, 0, 1) * safeWidth;
            const y = clamp(point.y, 0, 1) * safeHeight;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
            pointCount += 1;

            if (pointIndex > 0) {
                const previous = stroke.points[pointIndex - 1];
                totalLength += Math.hypot(
                    (point.x - previous.x) * safeWidth,
                    (point.y - previous.y) * safeHeight
                );
            }
        });
    });

    const hasPoints = pointCount > 0;

    return {
        pointCount,
        strokeCount: strokes.filter((stroke) => stroke.points.length > 0).length,
        totalLength,
        bounds: {
            width: hasPoints ? Math.max(0, maxX - minX) : 0,
            height: hasPoints ? Math.max(0, maxY - minY) : 0,
        },
    };
};

export const isMeaningfulSignature = (metrics: SignatureMetrics): boolean =>
    metrics.pointCount >= 3
    && metrics.totalLength >= 24
    && (metrics.bounds.width >= 18 || metrics.bounds.height >= 18);
