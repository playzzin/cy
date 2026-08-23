import { createHash } from 'node:crypto';
import * as fontkit from '@pdf-lib/fontkit';
import {
    PDFDocument,
    PDFPage,
    clip,
    closePath,
    degrees,
    endPath,
    lineTo,
    moveTo,
    popGraphicsState,
    pushGraphicsState,
    rgb,
    type PDFFont,
    type RGB,
} from 'pdf-lib';

export const CONSTRUCTION_PLAN_VECTOR_DRAWING_COMPOSITOR_VERSION = 'pdf-xobject-v1';

export interface ConstructionPlanVectorPdfBox {
    left: number;
    bottom: number;
    right: number;
    top: number;
}

export interface ConstructionPlanVectorDestinationPx {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface ConstructionPlanVectorAnnotationStyle {
    strokeHex: string;
    fillHex: string;
    strokeWidthPt: number;
    opacity: number;
    dash: 'solid' | 'dash' | 'dot';
    hatch?: 'none' | 'diagonal' | 'cross';
    fontSizePt?: number;
}

export interface ConstructionPlanVectorAnnotation {
    id: string;
    label?: string;
    zoneCode?: string;
    sequence?: number;
    geometry: Record<string, unknown>;
    style: ConstructionPlanVectorAnnotationStyle;
}

export interface ConstructionPlanVectorDrawingPanel {
    physicalPageIndex: number;
    sourcePdfBytes: Buffer;
    sourceSha256: string;
    sourcePageIndex: number;
    sourceCropBoxPt: ConstructionPlanVectorPdfBox;
    sourceRotation: 0 | 90 | 180 | 270;
    destinationPx: ConstructionPlanVectorDestinationPx;
    annotations: ConstructionPlanVectorAnnotation[];
}

export interface CompositeConstructionPlanVectorDrawingsInput {
    basePdfBytes: Buffer;
    pageWidthPx: number;
    pageHeightPx: number;
    annotationFontBytes: Buffer;
    panels: ConstructionPlanVectorDrawingPanel[];
}

interface Point {
    x: number;
    y: number;
}

interface DestinationPt {
    x: number;
    y: number;
    width: number;
    height: number;
    top: number;
}

const sha256Hex = (value: Buffer): string => createHash('sha256').update(value).digest('hex');

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const normalizeRotation = (value: number): 0 | 90 | 180 | 270 => {
    const normalized = ((value % 360) + 360) % 360;
    if (normalized !== 0 && normalized !== 90 && normalized !== 180 && normalized !== 270) {
        throw new Error(`construction-plan-vector-source-rotation-invalid:${value}`);
    }
    return normalized;
};

const assertPdfBox = (box: ConstructionPlanVectorPdfBox): void => {
    if (![box.left, box.bottom, box.right, box.top].every(finite)
        || box.right <= box.left || box.top <= box.bottom) {
        throw new Error('construction-plan-vector-source-crop-box-invalid');
    }
};

const assertDestination = (
    destination: ConstructionPlanVectorDestinationPx,
    pageWidthPx: number,
    pageHeightPx: number,
): void => {
    if (![destination.x, destination.y, destination.width, destination.height].every(finite)
        || destination.x < 0 || destination.y < 0
        || destination.width <= 0 || destination.height <= 0
        || destination.x + destination.width > pageWidthPx + 0.01
        || destination.y + destination.height > pageHeightPx + 0.01) {
        throw new Error('construction-plan-vector-destination-invalid');
    }
};

const destinationInPoints = (
    page: PDFPage,
    destination: ConstructionPlanVectorDestinationPx,
    pageWidthPx: number,
    pageHeightPx: number,
): DestinationPt => {
    const size = page.getSize();
    const xScale = size.width / pageWidthPx;
    const yScale = size.height / pageHeightPx;
    const width = destination.width * xScale;
    const height = destination.height * yScale;
    const x = destination.x * xScale;
    const y = size.height - ((destination.y + destination.height) * yScale);
    return { x, y, width, height, top: y + height };
};

const parseHexColor = (value: string): RGB => {
    if (!/^#[0-9a-f]{6}$/i.test(value)) {
        throw new Error(`construction-plan-vector-annotation-color-invalid:${value}`);
    }
    return rgb(
        Number.parseInt(value.slice(1, 3), 16) / 255,
        Number.parseInt(value.slice(3, 5), 16) / 255,
        Number.parseInt(value.slice(5, 7), 16) / 255,
    );
};

const numberField = (value: Record<string, unknown>, key: string): number => {
    const result = value[key];
    if (!finite(result)) throw new Error(`construction-plan-vector-annotation-geometry-invalid:${key}`);
    return result;
};

const normalizedPoint = (value: unknown): Point => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('construction-plan-vector-annotation-point-invalid');
    }
    const record = value as Record<string, unknown>;
    const x = numberField(record, 'x');
    const y = numberField(record, 'y');
    if (x < 0 || x > 1 || y < 0 || y > 1) {
        throw new Error('construction-plan-vector-annotation-point-outside');
    }
    return { x, y };
};

const localPoint = (point: Point, destination: DestinationPt): Point => ({
    x: point.x * destination.width,
    y: point.y * destination.height,
});

const rotatedRectPoints = (
    geometry: Record<string, unknown>,
    destination: DestinationPt,
): Point[] => {
    const x = numberField(geometry, 'x');
    const y = numberField(geometry, 'y');
    const width = numberField(geometry, 'w');
    const height = numberField(geometry, 'h');
    const rotation = finite(geometry.rotationDeg) ? geometry.rotationDeg : 0;
    const center = localPoint({ x: x + (width / 2), y: y + (height / 2) }, destination);
    const halfWidth = (width * destination.width) / 2;
    const halfHeight = (height * destination.height) / 2;
    const radians = rotation * Math.PI / 180;
    return [
        { x: -halfWidth, y: -halfHeight },
        { x: halfWidth, y: -halfHeight },
        { x: halfWidth, y: halfHeight },
        { x: -halfWidth, y: halfHeight },
    ].map((point) => ({
        x: center.x + (point.x * Math.cos(radians)) - (point.y * Math.sin(radians)),
        y: center.y + (point.x * Math.sin(radians)) + (point.y * Math.cos(radians)),
    }));
};

const ellipsePoints = (
    geometry: Record<string, unknown>,
    destination: DestinationPt,
): Point[] => {
    const cx = numberField(geometry, 'cx') * destination.width;
    const cy = numberField(geometry, 'cy') * destination.height;
    const rx = numberField(geometry, 'rx') * destination.width;
    const ry = numberField(geometry, 'ry') * destination.height;
    return Array.from({ length: 40 }, (_, index) => {
        const angle = (Math.PI * 2 * index) / 40;
        return { x: cx + (Math.cos(angle) * rx), y: cy + (Math.sin(angle) * ry) };
    });
};

const markerPoints = (
    geometry: Record<string, unknown>,
    destination: DestinationPt,
): Point[] => {
    const center = localPoint({ x: numberField(geometry, 'x'), y: numberField(geometry, 'y') }, destination);
    const radius = clamp(Math.min(destination.width, destination.height) * 0.025, 5, 10);
    const markerType = String(geometry.markerType || 'pin');
    if (markerType === 'warning' || markerType === 'access') {
        return [
            { x: center.x, y: center.y - radius },
            { x: center.x + radius, y: center.y + radius * 0.85 },
            { x: center.x - radius, y: center.y + radius * 0.85 },
        ];
    }
    if (markerType === 'inspection') {
        return [
            { x: center.x, y: center.y - radius },
            { x: center.x + radius, y: center.y },
            { x: center.x, y: center.y + radius },
            { x: center.x - radius, y: center.y },
        ];
    }
    if (markerType === 'hold') {
        return [
            { x: center.x - radius, y: center.y - radius },
            { x: center.x + radius, y: center.y - radius },
            { x: center.x + radius, y: center.y + radius },
            { x: center.x - radius, y: center.y + radius },
        ];
    }
    return Array.from({ length: 24 }, (_, index) => {
        const angle = (Math.PI * 2 * index) / 24;
        return { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius };
    });
};

const geometryPoints = (
    geometry: Record<string, unknown>,
    destination: DestinationPt,
): { points: Point[]; closed: boolean } => {
    const kind = String(geometry.kind || '');
    if (kind === 'rect' || kind === 'text') {
        return { points: rotatedRectPoints(geometry, destination), closed: true };
    }
    if (kind === 'polygon' || kind === 'polyline') {
        if (!Array.isArray(geometry.vertices) || geometry.vertices.length < (kind === 'polygon' ? 3 : 2)) {
            throw new Error(`construction-plan-vector-annotation-vertices-invalid:${kind}`);
        }
        return {
            points: geometry.vertices.map(normalizedPoint).map((point) => localPoint(point, destination)),
            closed: kind === 'polygon',
        };
    }
    if (kind === 'ellipse') return { points: ellipsePoints(geometry, destination), closed: true };
    if (kind === 'marker') return { points: markerPoints(geometry, destination), closed: true };
    throw new Error(`construction-plan-vector-annotation-kind-invalid:${kind}`);
};

const svgPath = (points: readonly Point[], closed: boolean): string => {
    if (points.length < 2) throw new Error('construction-plan-vector-annotation-path-invalid');
    const body = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(4)} ${point.y.toFixed(4)}`).join(' ');
    return closed ? `${body} Z` : body;
};

const dashArray = (dash: ConstructionPlanVectorAnnotationStyle['dash']): number[] => (
    dash === 'dash' ? [5, 3] : dash === 'dot' ? [1.2, 2.2] : []
);

const toPagePoint = (point: Point, destination: DestinationPt): Point => ({
    x: destination.x + point.x,
    y: destination.top - point.y,
});

const drawHatch = (
    page: PDFPage,
    points: readonly Point[],
    destination: DestinationPt,
    style: ConstructionPlanVectorAnnotationStyle,
    color: RGB,
): void => {
    if ((style.hatch !== 'diagonal' && style.hatch !== 'cross') || points.length < 3) return;
    const pagePoints = points.map((point) => toPagePoint(point, destination));
    page.pushOperators(
        pushGraphicsState(),
        moveTo(pagePoints[0].x, pagePoints[0].y),
        ...pagePoints.slice(1).map((point) => lineTo(point.x, point.y)),
        closePath(),
        clip(),
        endPath(),
    );
    const spacing = 8;
    for (let offset = -destination.height; offset <= destination.width + destination.height; offset += spacing) {
        page.drawLine({
            start: { x: destination.x + offset, y: destination.y },
            end: { x: destination.x + offset + destination.height, y: destination.top },
            thickness: 0.7,
            color,
            opacity: Math.min(0.5, style.opacity),
        });
        if (style.hatch === 'cross') {
            page.drawLine({
                start: { x: destination.x + offset, y: destination.top },
                end: { x: destination.x + offset + destination.height, y: destination.y },
                thickness: 0.7,
                color,
                opacity: Math.min(0.5, style.opacity),
            });
        }
    }
    page.pushOperators(popGraphicsState());
};

const annotationAnchor = (
    geometry: Record<string, unknown>,
    destination: DestinationPt,
): Point => {
    const kind = String(geometry.kind || '');
    if (kind === 'ellipse') return localPoint({ x: numberField(geometry, 'cx'), y: numberField(geometry, 'cy') }, destination);
    if (kind === 'marker') return localPoint({ x: numberField(geometry, 'x'), y: numberField(geometry, 'y') }, destination);
    if (kind === 'rect' || kind === 'text') {
        return localPoint({
            x: numberField(geometry, 'x') + (numberField(geometry, 'w') / 2),
            y: numberField(geometry, 'y') + (numberField(geometry, 'h') / 2),
        }, destination);
    }
    const vertices = Array.isArray(geometry.vertices) ? geometry.vertices.map(normalizedPoint) : [];
    if (vertices.length === 0) throw new Error('construction-plan-vector-annotation-anchor-invalid');
    return localPoint({
        x: vertices.reduce((sum, point) => sum + point.x, 0) / vertices.length,
        y: vertices.reduce((sum, point) => sum + point.y, 0) / vertices.length,
    }, destination);
};

const wrapText = (font: PDFFont, value: string, size: number, maxWidth: number): string[] => {
    const lines: string[] = [];
    let line = '';
    Array.from(value).forEach((character) => {
        const candidate = `${line}${character}`;
        if (line && font.widthOfTextAtSize(candidate, size) > maxWidth) {
            lines.push(line);
            line = character;
        } else {
            line = candidate;
        }
    });
    if (line) lines.push(line);
    return lines.length > 0 ? lines : [''];
};

const drawAnnotationLabel = (
    page: PDFPage,
    annotation: ConstructionPlanVectorAnnotation,
    destination: DestinationPt,
    font: PDFFont,
): void => {
    const text = [annotation.zoneCode, annotation.label]
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .join(' · ');
    if (!text) return;
    const anchor = toPagePoint(annotationAnchor(annotation.geometry, destination), destination);
    const maxWidth = Math.max(36, destination.width * 0.82);
    let fontSize = clamp(annotation.style.fontSizePt || 10, 6, 18);
    while (fontSize > 6 && font.widthOfTextAtSize(text, fontSize) > maxWidth * 3) fontSize -= 0.5;
    const lines = wrapText(font, text, fontSize, maxWidth);
    const lineHeight = fontSize * 1.18;
    const startY = anchor.y + ((lines.length - 1) * lineHeight / 2);
    const align = annotation.geometry.kind === 'text' && ['left', 'center', 'right'].includes(String(annotation.geometry.align))
        ? String(annotation.geometry.align)
        : 'center';
    lines.forEach((line, index) => {
        const width = font.widthOfTextAtSize(line, fontSize);
        const x = align === 'left' ? anchor.x : align === 'right' ? anchor.x - width : anchor.x - (width / 2);
        const y = startY - (index * lineHeight) - (fontSize * 0.35);
        page.drawRectangle({
            x: x - 1.5,
            y: y - 1,
            width: width + 3,
            height: lineHeight,
            color: rgb(1, 1, 1),
            opacity: 0.82,
        });
        page.drawText(line, { x, y, size: fontSize, font, color: rgb(0.07, 0.09, 0.13) });
    });
};

const drawArrowHead = (
    page: PDFPage,
    from: Point,
    to: Point,
    destination: DestinationPt,
    color: RGB,
    opacity: number,
): void => {
    const fromPage = toPagePoint(from, destination);
    const toPage = toPagePoint(to, destination);
    const angle = Math.atan2(toPage.y - fromPage.y, toPage.x - fromPage.x);
    const length = 7;
    const points = [
        toPage,
        { x: toPage.x - length * Math.cos(angle - Math.PI / 6), y: toPage.y - length * Math.sin(angle - Math.PI / 6) },
        { x: toPage.x - length * Math.cos(angle + Math.PI / 6), y: toPage.y - length * Math.sin(angle + Math.PI / 6) },
    ];
    const local = points.map((point) => ({ x: point.x, y: -point.y }));
    page.drawSvgPath(svgPath(local, true), {
        x: 0,
        y: 0,
        color,
        opacity,
    });
};

const drawMarkerSymbol = (
    page: PDFPage,
    annotation: ConstructionPlanVectorAnnotation,
    destination: DestinationPt,
    font: PDFFont,
): void => {
    if (annotation.geometry.kind !== 'marker') return;
    const anchor = toPagePoint(annotationAnchor(annotation.geometry, destination), destination);
    const symbols: Readonly<Record<string, string>> = {
        pin: '•', warning: '!', hold: '×', inspection: '✓',
        sequence: String(annotation.sequence || '#'), equipment: 'E', access: '→',
    };
    const symbol = symbols[String(annotation.geometry.markerType)] || '?';
    const size = 7.5;
    const width = font.widthOfTextAtSize(symbol, size);
    page.drawText(symbol, {
        x: anchor.x - width / 2,
        y: anchor.y - size * 0.32,
        size,
        font,
        color: rgb(0.07, 0.09, 0.13),
    });
};

const drawVectorAnnotation = (
    page: PDFPage,
    annotation: ConstructionPlanVectorAnnotation,
    destination: DestinationPt,
    font: PDFFont,
): void => {
    if (!annotation.id || !annotation.geometry || !annotation.style) {
        throw new Error('construction-plan-vector-annotation-invalid');
    }
    const { points, closed } = geometryPoints(annotation.geometry, destination);
    const stroke = parseHexColor(annotation.style.strokeHex);
    const fill = parseHexColor(annotation.style.fillHex);
    const width = clamp(annotation.style.strokeWidthPt, 0.25, 20);
    const opacity = clamp(annotation.style.opacity, 0, 1);
    const kind = String(annotation.geometry.kind || '');
    page.drawSvgPath(svgPath(points, closed), {
        x: destination.x,
        y: destination.top,
        ...(kind === 'polyline' ? {} : { color: fill, opacity }),
        borderColor: stroke,
        borderWidth: width,
        borderOpacity: opacity,
        borderDashArray: dashArray(annotation.style.dash),
        borderDashPhase: 0,
    });
    drawHatch(page, points, destination, annotation.style, stroke);
    if (kind === 'polyline') {
        if (annotation.geometry.arrowStart === true) drawArrowHead(page, points[1], points[0], destination, stroke, opacity);
        if (annotation.geometry.arrowEnd === true) drawArrowHead(page, points[points.length - 2], points[points.length - 1], destination, stroke, opacity);
    }
    drawMarkerSymbol(page, annotation, destination, font);
    drawAnnotationLabel(page, annotation, destination, font);
};

const assertSourcePageMatches = (
    page: PDFPage,
    panel: ConstructionPlanVectorDrawingPanel,
): void => {
    const crop = page.getCropBox();
    const expected = panel.sourceCropBoxPt;
    const tolerance = 0.02;
    if (Math.abs(crop.x - expected.left) > tolerance
        || Math.abs(crop.y - expected.bottom) > tolerance
        || Math.abs(crop.width - (expected.right - expected.left)) > tolerance
        || Math.abs(crop.height - (expected.top - expected.bottom)) > tolerance
        || normalizeRotation(page.getRotation().angle) !== panel.sourceRotation) {
        throw new Error(`construction-plan-vector-source-page-binding-mismatch:${panel.sourcePageIndex}`);
    }
};

const drawEmbeddedPage = (
    page: PDFPage,
    embeddedPage: Awaited<ReturnType<PDFDocument['embedPage']>>,
    destination: DestinationPt,
    rotation: 0 | 90 | 180 | 270,
): void => {
    page.drawRectangle({
        x: destination.x,
        y: destination.y,
        width: destination.width,
        height: destination.height,
        color: rgb(1, 1, 1),
    });
    if (rotation === 0) {
        page.drawPage(embeddedPage, {
            x: destination.x,
            y: destination.y,
            width: destination.width,
            height: destination.height,
        });
    } else if (rotation === 90) {
        page.drawPage(embeddedPage, {
            x: destination.x + destination.width,
            y: destination.y,
            width: destination.height,
            height: destination.width,
            rotate: degrees(90),
        });
    } else if (rotation === 180) {
        page.drawPage(embeddedPage, {
            x: destination.x + destination.width,
            y: destination.y + destination.height,
            width: destination.width,
            height: destination.height,
            rotate: degrees(180),
        });
    } else {
        page.drawPage(embeddedPage, {
            x: destination.x,
            y: destination.y + destination.height,
            width: destination.height,
            height: destination.width,
            rotate: degrees(270),
        });
    }
};

/**
 * Replaces the verified raster drawing area with the immutable source PDF page
 * as a Form XObject, then writes normalized annotations as PDF primitives.
 * The raster remains underneath as a deterministic fallback for viewers that
 * cannot display an imported Form XObject.
 */
export const compositeConstructionPlanVectorDrawings = async (
    input: CompositeConstructionPlanVectorDrawingsInput,
): Promise<Buffer> => {
    if (!Buffer.isBuffer(input.basePdfBytes) || input.basePdfBytes.length < 8
        || !Buffer.isBuffer(input.annotationFontBytes) || input.annotationFontBytes.length < 8
        || !finite(input.pageWidthPx) || !finite(input.pageHeightPx)
        || input.pageWidthPx <= 0 || input.pageHeightPx <= 0
        || !Array.isArray(input.panels) || input.panels.length > 80) {
        throw new Error('construction-plan-vector-compositor-input-invalid');
    }
    if (input.panels.length === 0) return Buffer.from(input.basePdfBytes);
    const document = await PDFDocument.load(input.basePdfBytes, { updateMetadata: false });
    document.registerFontkit(fontkit);
    const annotationFont = await document.embedFont(input.annotationFontBytes, { subset: true });
    const pages = document.getPages();
    const sourceDocuments = new Map<string, PDFDocument>();
    const embeddedPages = new Map<string, Awaited<ReturnType<PDFDocument['embedPage']>>>();

    for (const panel of input.panels) {
        if (!Number.isInteger(panel.physicalPageIndex) || panel.physicalPageIndex < 0 || panel.physicalPageIndex >= pages.length
            || !Number.isInteger(panel.sourcePageIndex) || panel.sourcePageIndex < 0
            || !/^[a-f0-9]{64}$/.test(panel.sourceSha256)
            || !Buffer.isBuffer(panel.sourcePdfBytes)
            || !panel.sourcePdfBytes.subarray(0, 5).equals(Buffer.from('%PDF-'))
            || sha256Hex(panel.sourcePdfBytes) !== panel.sourceSha256) {
            throw new Error('construction-plan-vector-source-binding-invalid');
        }
        assertPdfBox(panel.sourceCropBoxPt);
        assertDestination(panel.destinationPx, input.pageWidthPx, input.pageHeightPx);
        const targetPage = pages[panel.physicalPageIndex];
        const destination = destinationInPoints(targetPage, panel.destinationPx, input.pageWidthPx, input.pageHeightPx);
        let sourceDocument = sourceDocuments.get(panel.sourceSha256);
        if (!sourceDocument) {
            sourceDocument = await PDFDocument.load(panel.sourcePdfBytes, { updateMetadata: false });
            sourceDocuments.set(panel.sourceSha256, sourceDocument);
        }
        if (panel.sourcePageIndex >= sourceDocument.getPageCount()) {
            throw new Error('construction-plan-vector-source-page-index-invalid');
        }
        const sourcePage = sourceDocument.getPage(panel.sourcePageIndex);
        assertSourcePageMatches(sourcePage, panel);
        const cacheKey = [
            panel.sourceSha256,
            panel.sourcePageIndex,
            panel.sourceCropBoxPt.left,
            panel.sourceCropBoxPt.bottom,
            panel.sourceCropBoxPt.right,
            panel.sourceCropBoxPt.top,
        ].join(':');
        let embeddedPage = embeddedPages.get(cacheKey);
        if (!embeddedPage) {
            embeddedPage = await document.embedPage(sourcePage, {
                left: panel.sourceCropBoxPt.left,
                bottom: panel.sourceCropBoxPt.bottom,
                right: panel.sourceCropBoxPt.right,
                top: panel.sourceCropBoxPt.top,
            });
            embeddedPages.set(cacheKey, embeddedPage);
        }
        drawEmbeddedPage(targetPage, embeddedPage, destination, panel.sourceRotation);
        panel.annotations.forEach((annotation) => drawVectorAnnotation(targetPage, annotation, destination, annotationFont));
    }
    return Buffer.from(await document.save({ useObjectStreams: false, addDefaultPage: false }));
};
