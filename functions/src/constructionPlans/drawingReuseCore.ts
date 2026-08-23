import {
    buildConstructionPlanDrawingCanonicalPath,
    type ConstructionPlanDrawingMimeType,
} from './drawingUpload';
import {
    isUnknownRecord,
    readTrimmedString,
    type UnknownRecord,
} from './domain';
import {
    canonicalConstructionPlanDrawingAnnotationStyle,
    type ConstructionPlanDrawingLayer,
} from './drawingAnnotationContract';

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const GENERATION_PATTERN = /^[1-9][0-9]*$/;
const DOCUMENT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;
const MAX_DRAWING_BYTES = 50 * 1024 * 1024;
const MAX_DRAWINGS_PER_PLAN = 100;
const MAX_ANNOTATIONS_PER_DRAWING = 2_000;
const MAX_STUDIO_OBJECTS = 2_000;
const DRAWING_LAYERS = new Set([
    'install', 'dismantle', 'retain', 'equipment', 'pedestrian', 'lifting',
    'restricted', 'storage',
]);
const DRAWING_OBJECT_KINDS = new Set([
    'rectangle', 'polygon', 'arrow', 'polyline', 'ellipse', 'marker', 'text',
]);
const DRAWING_SLOTS = new Set(['D-01', 'D-02', 'D-03', 'D-04', 'D-05', 'D-06']);

export interface ConstructionPlanDrawingSourceBinding {
    drawingId: string;
    sourcePlanId: string;
    siteId: string;
    storagePath: string;
    sourceGeneration: string;
    sourceSha256: string;
    sourceRevision: number;
    mimeType: ConstructionPlanDrawingMimeType;
    sizeBytes: number;
    originalFileName: string;
    pageCount: number;
    drawing: UnknownRecord;
}

export interface ConstructionPlanDrawingCopyBinding extends ConstructionPlanDrawingSourceBinding {
    targetPlanId: string;
    targetDrawingId: string;
    targetStoragePath: string;
    targetGeneration: string;
}

export interface ConstructionPlanDrawingReuseProjection {
    drawings: UnknownRecord[];
    sections: UnknownRecord[];
    drawingApplicability: UnknownRecord[];
}

function fail(code: string): never {
    throw new Error(code);
}

const requiredString = (value: unknown, code: string, maxLength: number): string => {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) fail(code);
    return value.trim();
};

const optionalString = (value: unknown, maxLength: number): string | undefined => {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value !== 'string' || value.trim().length > maxLength) fail('construction-plan-drawing-reuse-string-invalid');
    return value.trim() || undefined;
};

const optionalSafeAttribute = (value: unknown, maxLength = 500): string | undefined => {
    const normalized = optionalString(value, maxLength);
    if (normalized && /(?:https?:\/\/|blob:|[?&]token=)/i.test(normalized)) {
        fail('construction-plan-drawing-reuse-annotation-sensitive-value-forbidden');
    }
    return normalized;
};

const finiteNumber = (value: unknown, code: string): number => {
    if (typeof value !== 'number' || !Number.isFinite(value)) fail(code);
    return value;
};

const boundedStringArray = (value: unknown, maxItems = 100, maxLength = 200): string[] => {
    if (!Array.isArray(value) || value.length > maxItems) {
        if (value === undefined) return [];
        fail('construction-plan-drawing-reuse-string-array-invalid');
    }
    return Array.from(new Set(value.map((item) => requiredString(
        item,
        'construction-plan-drawing-reuse-string-array-invalid',
        maxLength,
    ))));
};

const parseMimeType = (value: unknown): ConstructionPlanDrawingMimeType => {
    if (value !== 'application/pdf' && value !== 'image/png' && value !== 'image/jpeg') {
        fail('construction-plan-drawing-reuse-mime-invalid');
    }
    return value;
};

const drawingPathRevision = (
    path: string,
    input: {
        siteId: string;
        planId: string;
        drawingId: string;
        mimeType: ConstructionPlanDrawingMimeType;
    },
): number => {
    const escapedPrefix = `construction-plans/${input.siteId}/${input.planId}/drawings/${input.drawingId}/rev-`;
    if (!path.startsWith(escapedPrefix)) fail('construction-plan-drawing-reuse-source-path-invalid');
    const match = /^([1-9][0-9]{0,3})\/source\.(pdf|png|jpg)$/.exec(path.slice(escapedPrefix.length));
    if (!match) fail('construction-plan-drawing-reuse-source-path-invalid');
    const sourceRevision = Number(match[1]);
    const expected = buildConstructionPlanDrawingCanonicalPath({ ...input, sourceRevision });
    if (expected !== path) fail('construction-plan-drawing-reuse-source-path-invalid');
    return sourceRevision;
};

export const projectConstructionPlanDrawingSourceBinding = (input: {
    plan: UnknownRecord;
    drawing: unknown;
}): ConstructionPlanDrawingSourceBinding => {
    if (!isUnknownRecord(input.drawing)) fail('construction-plan-drawing-reuse-drawing-invalid');
    const drawing = input.drawing;
    const sourcePlanId = requiredString(input.plan.id, 'construction-plan-drawing-reuse-plan-id-invalid', 200);
    const siteId = requiredString(input.plan.siteId, 'construction-plan-drawing-reuse-site-id-invalid', 200);
    const drawingId = requiredString(drawing.id, 'construction-plan-drawing-reuse-drawing-id-invalid', 200);
    if (![sourcePlanId, siteId, drawingId].every((value) => DOCUMENT_ID_PATTERN.test(value))) {
        fail('construction-plan-drawing-reuse-path-segment-invalid');
    }
    if (drawing.planId !== sourcePlanId) fail('construction-plan-drawing-reuse-plan-binding-invalid');
    const mimeType = parseMimeType(drawing.mimeType);
    const storagePath = requiredString(
        drawing.storagePath,
        'construction-plan-drawing-reuse-source-path-missing',
        1_024,
    );
    const sourceRevision = drawingPathRevision(storagePath, {
        siteId,
        planId: sourcePlanId,
        drawingId,
        mimeType,
    });
    const sourceGeneration = requiredString(
        drawing.sourceGeneration,
        'construction-plan-drawing-reuse-source-generation-missing',
        40,
    );
    if (!GENERATION_PATTERN.test(sourceGeneration)) {
        fail('construction-plan-drawing-reuse-source-generation-invalid');
    }
    const sourceSha256 = requiredString(
        drawing.sourceSha256,
        'construction-plan-drawing-reuse-source-sha256-missing',
        64,
    ).toLowerCase();
    if (!SHA256_PATTERN.test(sourceSha256)) fail('construction-plan-drawing-reuse-source-sha256-invalid');
    const sizeBytes = Number(drawing.sizeBytes);
    if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_DRAWING_BYTES) {
        fail('construction-plan-drawing-reuse-source-size-invalid');
    }
    const pageCount = Number(drawing.pageCount);
    if (!Number.isSafeInteger(pageCount) || pageCount < 1 || pageCount > 50) {
        fail('construction-plan-drawing-reuse-page-count-invalid');
    }
    return {
        drawingId,
        sourcePlanId,
        siteId,
        storagePath,
        sourceGeneration,
        sourceSha256,
        sourceRevision,
        mimeType,
        sizeBytes,
        originalFileName: requiredString(
            drawing.originalFileName,
            'construction-plan-drawing-reuse-file-name-invalid',
            255,
        ),
        pageCount,
        drawing,
    };
};

export const projectConstructionPlanDrawingSourceBindings = (
    plan: UnknownRecord,
): ConstructionPlanDrawingSourceBinding[] => {
    if (!Array.isArray(plan.drawings) || plan.drawings.length > MAX_DRAWINGS_PER_PLAN) {
        fail('construction-plan-drawing-reuse-drawings-invalid');
    }
    const ids = new Set<string>();
    const paths = new Set<string>();
    return plan.drawings.map((drawing) => {
        const binding = projectConstructionPlanDrawingSourceBinding({ plan, drawing });
        if (ids.has(binding.drawingId) || paths.has(binding.storagePath)) {
            fail('construction-plan-drawing-reuse-duplicate-binding');
        }
        ids.add(binding.drawingId);
        paths.add(binding.storagePath);
        return binding;
    });
};

const normalizedPoint = (value: unknown): UnknownRecord => {
    if (!isUnknownRecord(value)) fail('construction-plan-drawing-reuse-point-invalid');
    const x = finiteNumber(value.x, 'construction-plan-drawing-reuse-point-invalid');
    const y = finiteNumber(value.y, 'construction-plan-drawing-reuse-point-invalid');
    if (x < 0 || x > 1 || y < 0 || y > 1) fail('construction-plan-drawing-reuse-point-invalid');
    return { x, y };
};

const normalizedPoints = (value: unknown, minimum: number): UnknownRecord[] => {
    if (!Array.isArray(value) || value.length < minimum || value.length > 256) {
        fail('construction-plan-drawing-reuse-points-invalid');
    }
    return value.map(normalizedPoint);
};

const sanitizeAnnotationGeometry = (value: unknown): UnknownRecord => {
    if (!isUnknownRecord(value)) fail('construction-plan-drawing-reuse-geometry-invalid');
    const kind = requiredString(value.kind, 'construction-plan-drawing-reuse-geometry-invalid', 40);
    if (kind === 'polygon') return { kind, vertices: normalizedPoints(value.vertices, 3) };
    if (kind === 'polyline') return {
        kind,
        vertices: normalizedPoints(value.vertices, 2),
        arrowStart: value.arrowStart === true,
        arrowEnd: value.arrowEnd === true,
    };
    if (kind === 'rect') {
        const x = finiteNumber(value.x, 'construction-plan-drawing-reuse-geometry-invalid');
        const y = finiteNumber(value.y, 'construction-plan-drawing-reuse-geometry-invalid');
        const w = finiteNumber(value.w, 'construction-plan-drawing-reuse-geometry-invalid');
        const h = finiteNumber(value.h, 'construction-plan-drawing-reuse-geometry-invalid');
        const rotationDeg = value.rotationDeg === undefined
            ? 0
            : finiteNumber(value.rotationDeg, 'construction-plan-drawing-reuse-geometry-invalid');
        if (x < 0 || x > 1 || y < 0 || y > 1 || w <= 0 || w > 1 || h <= 0 || h > 1
            || x + w > 1.000001 || y + h > 1.000001) {
            fail('construction-plan-drawing-reuse-geometry-invalid');
        }
        return { kind, x, y, w, h, rotationDeg };
    }
    if (kind === 'ellipse') {
        const cx = finiteNumber(value.cx, 'construction-plan-drawing-reuse-geometry-invalid');
        const cy = finiteNumber(value.cy, 'construction-plan-drawing-reuse-geometry-invalid');
        const rx = finiteNumber(value.rx, 'construction-plan-drawing-reuse-geometry-invalid');
        const ry = finiteNumber(value.ry, 'construction-plan-drawing-reuse-geometry-invalid');
        if (cx < 0 || cx > 1 || cy < 0 || cy > 1 || rx <= 0 || rx > 1 || ry <= 0 || ry > 1) {
            fail('construction-plan-drawing-reuse-geometry-invalid');
        }
        return { kind, cx, cy, rx, ry };
    }
    if (kind === 'marker') {
        const point = normalizedPoint(value);
        return {
            kind,
            ...point,
            markerType: requiredString(value.markerType, 'construction-plan-drawing-reuse-geometry-invalid', 80),
        };
    }
    if (kind === 'text') {
        const x = finiteNumber(value.x, 'construction-plan-drawing-reuse-geometry-invalid');
        const y = finiteNumber(value.y, 'construction-plan-drawing-reuse-geometry-invalid');
        const w = finiteNumber(value.w, 'construction-plan-drawing-reuse-geometry-invalid');
        const h = finiteNumber(value.h, 'construction-plan-drawing-reuse-geometry-invalid');
        if (x < 0 || x > 1 || y < 0 || y > 1 || w <= 0 || w > 1 || h <= 0 || h > 1) {
            fail('construction-plan-drawing-reuse-geometry-invalid');
        }
        if (value.align !== 'left' && value.align !== 'center' && value.align !== 'right') {
            fail('construction-plan-drawing-reuse-geometry-invalid');
        }
        return { kind, x, y, w, h, align: value.align };
    }
    return fail('construction-plan-drawing-reuse-geometry-invalid');
};

const sanitizeAnnotationStyle = (
    value: unknown,
    layer?: ConstructionPlanDrawingLayer,
): UnknownRecord => {
    if (!isUnknownRecord(value)) fail('construction-plan-drawing-reuse-style-invalid');
    const strokeWidthPt = finiteNumber(value.strokeWidthPt, 'construction-plan-drawing-reuse-style-invalid');
    const opacity = finiteNumber(value.opacity, 'construction-plan-drawing-reuse-style-invalid');
    if (strokeWidthPt <= 0 || strokeWidthPt > 40 || opacity < 0 || opacity > 1) {
        fail('construction-plan-drawing-reuse-style-invalid');
    }
    if (value.dash !== 'solid' && value.dash !== 'dash' && value.dash !== 'dot') {
        fail('construction-plan-drawing-reuse-style-invalid');
    }
    if (value.hatch !== undefined
        && value.hatch !== 'none' && value.hatch !== 'diagonal' && value.hatch !== 'cross') {
        fail('construction-plan-drawing-reuse-style-invalid');
    }
    const fontSizePt = value.fontSizePt === undefined
        ? undefined
        : finiteNumber(value.fontSizePt, 'construction-plan-drawing-reuse-style-invalid');
    if (fontSizePt !== undefined && (fontSizePt <= 0 || fontSizePt > 96)) {
        fail('construction-plan-drawing-reuse-style-invalid');
    }
    const sanitized = {
        strokeToken: requiredString(value.strokeToken, 'construction-plan-drawing-reuse-style-invalid', 160),
        ...(optionalString(value.fillToken, 160) ? { fillToken: optionalString(value.fillToken, 160) } : {}),
        strokeWidthPt,
        opacity,
        dash: value.dash,
        ...(value.hatch === undefined ? {} : { hatch: value.hatch }),
        ...(fontSizePt === undefined ? {} : { fontSizePt }),
    };
    return layer ? canonicalConstructionPlanDrawingAnnotationStyle(layer) : sanitized;
};

const sanitizeAnnotation = (value: unknown): UnknownRecord => {
    if (!isUnknownRecord(value)) fail('construction-plan-drawing-reuse-annotation-invalid');
    const pageIndex = Number(value.pageIndex);
    if (!Number.isSafeInteger(pageIndex) || pageIndex < 0 || pageIndex >= 50) {
        fail('construction-plan-drawing-reuse-annotation-page-invalid');
    }
    const layer = requiredString(value.layer, 'construction-plan-drawing-reuse-annotation-layer-invalid', 40);
    if (!DRAWING_LAYERS.has(layer)) fail('construction-plan-drawing-reuse-annotation-layer-invalid');
    const sequence = value.sequence === undefined ? undefined : Number(value.sequence);
    if (sequence !== undefined && (!Number.isSafeInteger(sequence) || sequence < 1)) {
        fail('construction-plan-drawing-reuse-annotation-sequence-invalid');
    }
    const styleVersion = value.styleVersion === undefined ? 1 : Number(value.styleVersion);
    if (!Number.isSafeInteger(styleVersion) || styleVersion < 1) {
        fail('construction-plan-drawing-reuse-annotation-style-version-invalid');
    }
    return {
        id: requiredString(value.id, 'construction-plan-drawing-reuse-annotation-id-invalid', 160),
        pageIndex,
        ...(optionalString(value.pageFingerprint, 500)
            ? { pageFingerprint: optionalString(value.pageFingerprint, 500) }
            : {}),
        layer,
        geometry: sanitizeAnnotationGeometry(value.geometry),
        style: sanitizeAnnotationStyle(value.style, layer as ConstructionPlanDrawingLayer),
        label: typeof value.label === 'string' && value.label.length <= 240 ? value.label : '',
        ...(optionalString(value.zoneCode, 120) ? { zoneCode: optionalString(value.zoneCode, 120) } : {}),
        ...(sequence === undefined ? {} : { sequence }),
        ...(optionalSafeAttribute(value.startDate, 40) ? { startDate: optionalSafeAttribute(value.startDate, 40) } : {}),
        ...(optionalSafeAttribute(value.endDate, 40) ? { endDate: optionalSafeAttribute(value.endDate, 40) } : {}),
        ...(optionalSafeAttribute(value.reason) ? { reason: optionalSafeAttribute(value.reason) } : {}),
        ...(optionalSafeAttribute(value.releaseCondition) ? { releaseCondition: optionalSafeAttribute(value.releaseCondition) } : {}),
        ...(optionalSafeAttribute(value.equipmentType) ? { equipmentType: optionalSafeAttribute(value.equipmentType) } : {}),
        ...(optionalSafeAttribute(value.equipmentId) ? { equipmentId: optionalSafeAttribute(value.equipmentId) } : {}),
        ...(optionalSafeAttribute(value.entrance) ? { entrance: optionalSafeAttribute(value.entrance) } : {}),
        ...(optionalSafeAttribute(value.destination) ? { destination: optionalSafeAttribute(value.destination) } : {}),
        ...(value.radius === undefined ? {} : {
            radius: (() => {
                const radius = finiteNumber(value.radius, 'construction-plan-drawing-reuse-annotation-radius-invalid');
                if (radius <= 0 || radius > 10_000) fail('construction-plan-drawing-reuse-annotation-radius-invalid');
                return radius;
            })(),
        }),
        ...(optionalSafeAttribute(value.responsibleWorkerId) ? { responsibleWorkerId: optionalSafeAttribute(value.responsibleWorkerId) } : {}),
        ...(optionalSafeAttribute(value.responsibleRole) ? { responsibleRole: optionalSafeAttribute(value.responsibleRole) } : {}),
        ...(optionalSafeAttribute(value.materialType) ? { materialType: optionalSafeAttribute(value.materialType) } : {}),
        styleVersion,
        locked: false,
        createdBy: requiredString(value.createdBy, 'construction-plan-drawing-reuse-annotation-actor-invalid', 200),
        createdAt: requiredString(value.createdAt, 'construction-plan-drawing-reuse-annotation-time-invalid', 80),
        updatedBy: requiredString(value.updatedBy, 'construction-plan-drawing-reuse-annotation-actor-invalid', 200),
        updatedAt: requiredString(value.updatedAt, 'construction-plan-drawing-reuse-annotation-time-invalid', 80),
    };
};

const sanitizeStudioStyle = (value: unknown, layer: ConstructionPlanDrawingLayer): UnknownRecord => (
    value === undefined
        ? canonicalConstructionPlanDrawingAnnotationStyle(layer)
        : sanitizeAnnotationStyle(value, layer)
);

const sanitizeStudioObject = (value: unknown): UnknownRecord => {
    if (!isUnknownRecord(value)) fail('construction-plan-drawing-reuse-studio-object-invalid');
    const kind = requiredString(value.kind, 'construction-plan-drawing-reuse-studio-object-invalid', 40);
    const layer = requiredString(value.layer, 'construction-plan-drawing-reuse-studio-object-invalid', 40);
    if (!DRAWING_OBJECT_KINDS.has(kind) || !DRAWING_LAYERS.has(layer)) {
        fail('construction-plan-drawing-reuse-studio-object-invalid');
    }
    const minimum = kind === 'polygon' ? 3 : kind === 'marker' ? 1 : 2;
    const points = normalizedPoints(value.points, minimum);
    if (kind === 'marker' && points.length !== 1) fail('construction-plan-drawing-reuse-studio-object-invalid');
    const rotationDeg = value.rotationDeg === undefined
        ? undefined
        : finiteNumber(value.rotationDeg, 'construction-plan-drawing-reuse-studio-object-invalid');
    const sequence = value.sequence === undefined ? undefined : Number(value.sequence);
    if (sequence !== undefined && (!Number.isSafeInteger(sequence) || sequence < 1)) {
        fail('construction-plan-drawing-reuse-studio-object-invalid');
    }
    const radius = value.radius === undefined
        ? undefined
        : finiteNumber(value.radius, 'construction-plan-drawing-reuse-studio-object-invalid');
    if (radius !== undefined && (radius <= 0 || radius > 10_000)) {
        fail('construction-plan-drawing-reuse-studio-object-invalid');
    }
    const style = sanitizeStudioStyle(value.style, layer as ConstructionPlanDrawingLayer);
    if (value.textAlign !== undefined
        && value.textAlign !== 'left' && value.textAlign !== 'center' && value.textAlign !== 'right') {
        fail('construction-plan-drawing-reuse-studio-object-invalid');
    }
    return {
        id: requiredString(value.id, 'construction-plan-drawing-reuse-studio-object-invalid', 160),
        kind,
        layer,
        points,
        label: typeof value.label === 'string' && value.label.length <= 240 ? value.label : '',
        zoneCode: typeof value.zoneCode === 'string' && value.zoneCode.length <= 120 ? value.zoneCode : '',
        ...(sequence === undefined ? {} : { sequence }),
        ...(optionalSafeAttribute(value.startDate, 40) ? { startDate: optionalSafeAttribute(value.startDate, 40) } : {}),
        ...(optionalSafeAttribute(value.endDate, 40) ? { endDate: optionalSafeAttribute(value.endDate, 40) } : {}),
        ...(optionalSafeAttribute(value.reason) ? { reason: optionalSafeAttribute(value.reason) } : {}),
        ...(optionalSafeAttribute(value.releaseCondition) ? { releaseCondition: optionalSafeAttribute(value.releaseCondition) } : {}),
        ...(optionalSafeAttribute(value.equipmentType) ? { equipmentType: optionalSafeAttribute(value.equipmentType) } : {}),
        ...(optionalSafeAttribute(value.equipmentId) ? { equipmentId: optionalSafeAttribute(value.equipmentId) } : {}),
        ...(optionalSafeAttribute(value.entrance) ? { entrance: optionalSafeAttribute(value.entrance) } : {}),
        ...(optionalSafeAttribute(value.destination) ? { destination: optionalSafeAttribute(value.destination) } : {}),
        ...(radius === undefined ? {} : { radius }),
        ...(optionalSafeAttribute(value.responsibleWorkerId) ? { responsibleWorkerId: optionalSafeAttribute(value.responsibleWorkerId) } : {}),
        ...(optionalSafeAttribute(value.responsibleRole) ? { responsibleRole: optionalSafeAttribute(value.responsibleRole) } : {}),
        ...(optionalSafeAttribute(value.materialType) ? { materialType: optionalSafeAttribute(value.materialType) } : {}),
        ...(rotationDeg === undefined ? {} : { rotationDeg }),
        ...(value.arrowStart === undefined ? {} : { arrowStart: value.arrowStart === true }),
        ...(value.arrowEnd === undefined ? {} : { arrowEnd: value.arrowEnd === true }),
        ...(optionalString(value.markerType, 80) ? { markerType: optionalString(value.markerType, 80) } : {}),
        ...(value.textAlign === undefined ? {} : { textAlign: value.textAlign }),
        style,
        locked: false,
    };
};

const sanitizeDrawingStudio = (
    value: unknown,
    binding: ConstructionPlanDrawingCopyBinding,
): UnknownRecord => {
    if (!isUnknownRecord(value)) {
        return {
            schemaVersion: 1,
            background: {
                fileName: binding.originalFileName,
                mimeType: binding.mimeType,
                sizeBytes: binding.sizeBytes,
                kind: binding.mimeType === 'application/pdf' ? 'pdf' : 'image',
                storagePath: binding.targetStoragePath,
            },
            objects: [],
        };
    }
    if (!Array.isArray(value.objects) || value.objects.length > MAX_STUDIO_OBJECTS) {
        fail('construction-plan-drawing-reuse-studio-objects-invalid');
    }
    return {
        schemaVersion: 1,
        background: {
            fileName: binding.originalFileName,
            mimeType: binding.mimeType,
            sizeBytes: binding.sizeBytes,
            kind: binding.mimeType === 'application/pdf' ? 'pdf' : 'image',
            storagePath: binding.targetStoragePath,
        },
        objects: value.objects.map(sanitizeStudioObject),
    };
};

export const buildConstructionPlanReusedDrawing = (input: {
    binding: ConstructionPlanDrawingCopyBinding;
    actorId: string;
    timestamp: string;
}): UnknownRecord => {
    const { binding } = input;
    const source = binding.drawing;
    if (!Array.isArray(source.annotations) || source.annotations.length > MAX_ANNOTATIONS_PER_DRAWING) {
        fail('construction-plan-drawing-reuse-annotations-invalid');
    }
    const annotations = source.annotations.map(sanitizeAnnotation);
    if (annotations.some((annotation) => Number(annotation.pageIndex) >= binding.pageCount)) {
        fail('construction-plan-drawing-reuse-annotation-page-out-of-range');
    }
    return {
        id: binding.targetDrawingId,
        planId: binding.targetPlanId,
        storagePath: binding.targetStoragePath,
        sourceSha256: binding.sourceSha256,
        sourceGeneration: binding.targetGeneration,
        sourceRevision: 1,
        originalFileName: binding.originalFileName,
        mimeType: binding.mimeType,
        sizeBytes: binding.sizeBytes,
        pageCount: binding.pageCount,
        drawingNo: typeof source.drawingNo === 'string' ? source.drawingNo.slice(0, 200) : '',
        title: typeof source.title === 'string' ? source.title.slice(0, 240) : '',
        revision: typeof source.revision === 'string' ? source.revision.slice(0, 120) : '',
        approvalStatus: 'draft',
        ...(optionalString(source.building, 160) ? { building: optionalString(source.building, 160) } : {}),
        ...(optionalString(source.floor, 160) ? { floor: optionalString(source.floor, 160) } : {}),
        ...(optionalString(source.zone, 160) ? { zone: optionalString(source.zone, 160) } : {}),
        applicableZones: boundedStringArray(source.applicableZones),
        ...(optionalString(source.scaleText, 120) ? { scaleText: optionalString(source.scaleText, 120) } : {}),
        previewStatus: binding.mimeType === 'application/pdf' ? 'pending' : 'ready',
        previewPaths: binding.mimeType === 'application/pdf' ? [] : [binding.targetStoragePath],
        pages: [],
        annotations,
        uploadedBy: input.actorId,
        uploadedAt: input.timestamp,
    };
};

const resetSectionDrawingBinding = (
    rawSection: unknown,
    bindingBySourceId: ReadonlyMap<string, ConstructionPlanDrawingCopyBinding>,
    actorId: string,
    timestamp: string,
): UnknownRecord => {
    if (!isUnknownRecord(rawSection)) fail('construction-plan-drawing-reuse-section-invalid');
    if (!isUnknownRecord(rawSection.content)) return { ...rawSection };
    const sourceDrawingId = readTrimmedString(rawSection.content, ['drawingId']);
    if (!sourceDrawingId) return { ...rawSection, content: { ...rawSection.content } };
    const binding = bindingBySourceId.get(sourceDrawingId);
    if (!binding) fail('construction-plan-drawing-reuse-section-drawing-missing');
    const pageIndex = rawSection.content.drawingPageIndex === undefined
        ? 0
        : Number(rawSection.content.drawingPageIndex);
    if (!Number.isSafeInteger(pageIndex) || pageIndex < 0 || pageIndex >= binding.pageCount) {
        fail('construction-plan-drawing-reuse-section-page-invalid');
    }
    return {
        ...rawSection,
        content: {
            ...rawSection.content,
            drawingId: binding.targetDrawingId,
            drawingPageIndex: pageIndex,
            drawingStudio: sanitizeDrawingStudio(rawSection.content.drawingStudio, binding),
        },
        status: rawSection.status === 'complete' ? 'in_progress' : rawSection.status,
        updatedBy: actorId,
        updatedAt: timestamp,
    };
};

const resetApplicability = (
    value: unknown,
    bindingBySourceId: ReadonlyMap<string, ConstructionPlanDrawingCopyBinding>,
): UnknownRecord => {
    if (!isUnknownRecord(value)) fail('construction-plan-drawing-reuse-applicability-invalid');
    const drawingSlot = requiredString(
        value.drawingSlot,
        'construction-plan-drawing-reuse-applicability-slot-invalid',
        20,
    );
    if (!DRAWING_SLOTS.has(drawingSlot)) fail('construction-plan-drawing-reuse-applicability-slot-invalid');
    if (value.decision !== 'applicable'
        && value.decision !== 'replacement'
        && value.decision !== 'not_applicable') {
        fail('construction-plan-drawing-reuse-applicability-decision-invalid');
    }
    const sourceDrawingId = readTrimmedString(value, ['drawingId']);
    const targetDrawingId = sourceDrawingId
        ? bindingBySourceId.get(sourceDrawingId)?.targetDrawingId
        : undefined;
    if (sourceDrawingId && !targetDrawingId) {
        fail('construction-plan-drawing-reuse-applicability-drawing-missing');
    }
    return {
        drawingSlot,
        decision: value.decision,
        ...(targetDrawingId ? { drawingId: targetDrawingId } : {}),
        reason: '재사용 도면의 현장 적용성 및 승인근거 재검토 필요',
    };
};

export const buildConstructionPlanDrawingReuseProjection = (input: {
    sourcePlan: UnknownRecord;
    bindings: readonly ConstructionPlanDrawingCopyBinding[];
    actorId: string;
    timestamp: string;
}): ConstructionPlanDrawingReuseProjection => {
    const bindingBySourceId = new Map<string, ConstructionPlanDrawingCopyBinding>();
    const targetIds = new Set<string>();
    input.bindings.forEach((binding) => {
        if (bindingBySourceId.has(binding.drawingId) || targetIds.has(binding.targetDrawingId)) {
            fail('construction-plan-drawing-reuse-target-binding-duplicate');
        }
        bindingBySourceId.set(binding.drawingId, binding);
        targetIds.add(binding.targetDrawingId);
    });
    const drawings = input.bindings.map((binding) => buildConstructionPlanReusedDrawing({
        binding,
        actorId: input.actorId,
        timestamp: input.timestamp,
    }));
    if (!Array.isArray(input.sourcePlan.sections)) fail('construction-plan-drawing-reuse-sections-invalid');
    const sections = input.sourcePlan.sections.map((section) => resetSectionDrawingBinding(
        section,
        bindingBySourceId,
        input.actorId,
        input.timestamp,
    ));
    if (!Array.isArray(input.sourcePlan.drawingApplicability)) {
        fail('construction-plan-drawing-reuse-applicability-invalid');
    }
    const drawingApplicability = input.sourcePlan.drawingApplicability.map((value) => (
        resetApplicability(value, bindingBySourceId)
    ));
    return { drawings, sections, drawingApplicability };
};

export const applyConstructionPlanImportedDrawingProjection = (input: {
    targetPlan: UnknownRecord;
    targetSectionId: string;
    binding: ConstructionPlanDrawingCopyBinding;
    actorId: string;
    timestamp: string;
}): { plan: UnknownRecord; drawing: UnknownRecord; section: UnknownRecord; lockVersion: number } => {
    const drawing = buildConstructionPlanReusedDrawing({
        binding: input.binding,
        actorId: input.actorId,
        timestamp: input.timestamp,
    });
    const rawSections = Array.isArray(input.targetPlan.sections) ? input.targetPlan.sections : [];
    const rawSection = rawSections.find((candidate) => (
        isUnknownRecord(candidate) && readTrimmedString(candidate, ['id']) === input.targetSectionId
    ));
    if (!isUnknownRecord(rawSection)
        || !['drawing-page', 'drawing-register'].includes(readTrimmedString(rawSection, ['kind']) || '')) {
        fail('construction-plan-drawing-reuse-target-section-invalid');
    }
    const content = isUnknownRecord(rawSection.content) ? rawSection.content : {};
    const section: UnknownRecord = {
        ...rawSection,
        content: {
            ...content,
            drawingId: input.binding.targetDrawingId,
            drawingPageIndex: 0,
            drawingStudio: sanitizeDrawingStudio(undefined, input.binding),
        },
        status: 'in_progress',
        updatedBy: input.actorId,
        updatedAt: input.timestamp,
    };
    const sections = rawSections.map((candidate) => (
        isUnknownRecord(candidate) && candidate.id === input.targetSectionId ? section : candidate
    ));
    const existingDrawings = Array.isArray(input.targetPlan.drawings) ? input.targetPlan.drawings : [];
    if (existingDrawings.some((candidate) => (
        isUnknownRecord(candidate) && candidate.id === input.binding.targetDrawingId
    ))) fail('construction-plan-drawing-reuse-target-drawing-collision');
    const lockVersion = Number(input.targetPlan.lockVersion) + 1;
    if (!Number.isSafeInteger(lockVersion) || lockVersion < 1) {
        fail('construction-plan-drawing-reuse-target-lock-version-invalid');
    }
    const releaseReadiness = isUnknownRecord(input.targetPlan.releaseReadiness)
        ? { ...input.targetPlan.releaseReadiness }
        : {};
    Object.assign(releaseReadiness, {
        requiredReviewsComplete: false,
        snapshotHashMatches: false,
        pdfVisualCheckPassed: false,
        pdfTextCheckPassed: false,
    });
    const linkedSlots = Array.from(new Set(Array.from(
        (readTrimmedString(rawSection, ['title']) || '').matchAll(/D-\d{2}/gi),
        (match) => match[0].toUpperCase(),
    ).filter((slot) => DRAWING_SLOTS.has(slot))));
    const priorApplicability = Array.isArray(input.targetPlan.drawingApplicability)
        ? input.targetPlan.drawingApplicability
        : [];
    const drawingApplicability = linkedSlots.length
        ? [
            ...priorApplicability.filter((candidate) => (
                !isUnknownRecord(candidate)
                || !linkedSlots.includes(readTrimmedString(candidate, ['drawingSlot']) || '')
            )),
            ...linkedSlots.map((drawingSlot) => ({
                drawingSlot,
                decision: 'applicable',
                drawingId: input.binding.targetDrawingId,
                reason: '재사용 도면의 현장 적용성 및 승인근거 재검토 필요',
            })),
        ].sort((left, right) => String((left as UnknownRecord).drawingSlot || '')
            .localeCompare(String((right as UnknownRecord).drawingSlot || '')))
        : priorApplicability;
    return {
        plan: {
            ...input.targetPlan,
            sections,
            drawings: [...existingDrawings, drawing],
            drawingApplicability,
            releaseReadiness,
            validationSummary: { errors: 1, warnings: 0, checkedAt: input.timestamp },
            lockVersion,
            updatedBy: input.actorId,
            updatedAt: input.timestamp,
        },
        drawing,
        section,
        lockVersion,
    };
};
