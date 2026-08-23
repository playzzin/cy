type UnknownRecord = Record<string, unknown>;

export type ConstructionPlanDrawingLayer =
    | 'install' | 'dismantle' | 'retain' | 'equipment'
    | 'pedestrian' | 'lifting' | 'restricted' | 'storage';

export interface ConstructionPlanDrawingLayerContractEntry {
    label: string;
    shortLabel: string;
    strokeToken: string;
    fillToken: string;
    stroke: string;
    fill: string;
    strokeWidthPt: number;
    opacity: number;
    dash: 'solid' | 'dash' | 'dot';
    hatch: 'none' | 'diagonal' | 'cross';
    dashArray: string;
    pattern: string;
    geometry: 'area' | 'direction' | 'radius';
    preferredTool: 'rectangle' | 'arrow' | 'ellipse';
}

/** Keep byte-for-byte equivalent to the client drawingLayerContract.json. */
export const CONSTRUCTION_PLAN_DRAWING_LAYER_CONTRACT: Readonly<Record<
ConstructionPlanDrawingLayer,
ConstructionPlanDrawingLayerContractEntry
>> = {
    install: { label: '설치 구간', shortLabel: '설치', strokeToken: 'construction-plan.install.stroke', fillToken: 'construction-plan.install.fill', stroke: '#1677ff', fill: '#93c5fd', strokeWidthPt: 2, opacity: 0.42, dash: 'solid', hatch: 'none', dashArray: '', pattern: 'diagonal', geometry: 'area', preferredTool: 'rectangle' },
    dismantle: { label: '해체 구간', shortLabel: '해체', strokeToken: 'construction-plan.dismantle.stroke', fillToken: 'construction-plan.dismantle.fill', stroke: '#f97316', fill: '#fdba74', strokeWidthPt: 2, opacity: 0.42, dash: 'dot', hatch: 'none', dashArray: '3 7', pattern: 'reverse', geometry: 'area', preferredTool: 'rectangle' },
    retain: { label: '존치·해체금지', shortLabel: '존치', strokeToken: 'construction-plan.retain.stroke', fillToken: 'construction-plan.retain.fill', stroke: '#dc2626', fill: '#fecaca', strokeWidthPt: 2, opacity: 0.42, dash: 'solid', hatch: 'diagonal', dashArray: '', pattern: 'diagonal', geometry: 'area', preferredTool: 'rectangle' },
    equipment: { label: '장비 동선', shortLabel: '장비', strokeToken: 'construction-plan.equipment.stroke', fillToken: 'construction-plan.equipment.fill', stroke: '#2563eb', fill: '#bfdbfe', strokeWidthPt: 2, opacity: 1, dash: 'solid', hatch: 'none', dashArray: '', pattern: 'horizontal', geometry: 'direction', preferredTool: 'arrow' },
    pedestrian: { label: '보행 동선', shortLabel: '보행', strokeToken: 'construction-plan.pedestrian.stroke', fillToken: 'construction-plan.pedestrian.fill', stroke: '#16a34a', fill: '#bbf7d0', strokeWidthPt: 2, opacity: 1, dash: 'solid', hatch: 'none', dashArray: '', pattern: 'vertical', geometry: 'direction', preferredTool: 'arrow' },
    lifting: { label: '양중 반경', shortLabel: '양중', strokeToken: 'construction-plan.lifting.stroke', fillToken: 'construction-plan.lifting.fill', stroke: '#ca8a04', fill: '#fef08a', strokeWidthPt: 2, opacity: 0.42, dash: 'dash', hatch: 'none', dashArray: '14 8', pattern: 'grid', geometry: 'radius', preferredTool: 'ellipse' },
    restricted: { label: '출입 통제 구역', shortLabel: '통제', strokeToken: 'construction-plan.restricted.stroke', fillToken: 'construction-plan.restricted.fill', stroke: '#dc2626', fill: '#fecaca', strokeWidthPt: 2, opacity: 0.42, dash: 'dash', hatch: 'none', dashArray: '14 8', pattern: 'dense', geometry: 'area', preferredTool: 'rectangle' },
    storage: { label: '자재 적치 구역', shortLabel: '적치', strokeToken: 'construction-plan.storage.stroke', fillToken: 'construction-plan.storage.fill', stroke: '#16a34a', fill: '#bbf7d0', strokeWidthPt: 2, opacity: 0.42, dash: 'solid', hatch: 'none', dashArray: '', pattern: 'cross', geometry: 'area', preferredTool: 'rectangle' },
};

export const CONSTRUCTION_PLAN_DRAWING_ANNOTATION_ATTRIBUTE_KEYS = [
    'releaseCondition', 'equipmentType', 'equipmentId', 'entrance', 'destination',
    'radius', 'responsibleWorkerId', 'responsibleRole', 'materialType',
] as const;

export const CONSTRUCTION_PLAN_DRAWING_ANNOTATION_KEYS = new Set([
    'id', 'pageIndex', 'pageFingerprint', 'layer', 'geometry', 'style', 'label', 'zoneCode',
    'sequence', 'startDate', 'endDate', 'reason',
    ...CONSTRUCTION_PLAN_DRAWING_ANNOTATION_ATTRIBUTE_KEYS,
    'styleVersion', 'locked', 'createdBy', 'createdAt', 'updatedBy', 'updatedAt',
]);

export const canonicalConstructionPlanDrawingAnnotationStyle = (
    layer: ConstructionPlanDrawingLayer,
): UnknownRecord => {
    const contract = CONSTRUCTION_PLAN_DRAWING_LAYER_CONTRACT[layer];
    return {
        strokeToken: contract.strokeToken,
        fillToken: contract.fillToken,
        strokeWidthPt: contract.strokeWidthPt,
        opacity: contract.opacity,
        dash: contract.dash,
        hatch: contract.hatch,
    };
};

const isRecord = (value: unknown): value is UnknownRecord => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

const text = (record: UnknownRecord, key: string): string => (
    typeof record[key] === 'string' ? String(record[key]).trim() : ''
);

const positiveSequence = (value: unknown): boolean => (
    typeof value === 'number' && Number.isInteger(value) && value > 0
);

const safeAttribute = (value: unknown): boolean => (
    value === undefined || (typeof value === 'string'
        && value.length <= 500
        && !/(?:https?:\/\/|blob:|[?&]token=)/i.test(value))
);

const hasAreaGeometry = (geometry: UnknownRecord): boolean => (
    geometry.kind === 'rect' || geometry.kind === 'polygon'
);

const hasDirectionGeometry = (geometry: UnknownRecord): boolean => {
    if (geometry.kind !== 'polyline' || geometry.arrowEnd !== true || !Array.isArray(geometry.vertices)) return false;
    const first = geometry.vertices[0];
    const last = geometry.vertices[geometry.vertices.length - 1];
    return isRecord(first) && isRecord(last)
        && (Number(first.x) !== Number(last.x) || Number(first.y) !== Number(last.y));
};

export const constructionPlanDrawingAnnotationLayerContractIssues = (
    annotation: UnknownRecord,
): string[] => {
    const layer = text(annotation, 'layer') as ConstructionPlanDrawingLayer;
    const contract = CONSTRUCTION_PLAN_DRAWING_LAYER_CONTRACT[layer];
    if (!contract) return ['layer'];
    const issues: string[] = [];
    CONSTRUCTION_PLAN_DRAWING_ANNOTATION_ATTRIBUTE_KEYS.forEach((key) => {
        if (key === 'radius') {
            const radius = annotation.radius;
            if (radius !== undefined && (
                typeof radius !== 'number'
                || !Number.isFinite(radius)
                || radius <= 0
                || radius > 10_000
            )) {
                issues.push('radius.unsafe');
            }
            return;
        }
        if (!safeAttribute(annotation[key])) issues.push(`${key}.unsafe`);
    });
    if (layer === 'install') {
        if (!text(annotation, 'zoneCode')) issues.push('zoneCode');
        if (!positiveSequence(annotation.sequence)) issues.push('sequence');
    } else if (layer === 'dismantle') {
        if (!text(annotation, 'zoneCode')) issues.push('zoneCode');
        if (!positiveSequence(annotation.sequence)) issues.push('sequence');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(text(annotation, 'startDate'))) issues.push('startDate');
    } else if (layer === 'retain') {
        if (!text(annotation, 'reason')) issues.push('reason');
        if (!text(annotation, 'releaseCondition')) issues.push('releaseCondition');
    } else if (layer === 'equipment') {
        if (!text(annotation, 'equipmentType')) issues.push('equipmentType');
        if (!text(annotation, 'equipmentId')) issues.push('equipmentId');
    } else if (layer === 'pedestrian') {
        if (!text(annotation, 'entrance')) issues.push('entrance');
        if (!text(annotation, 'destination')) issues.push('destination');
    } else if (layer === 'lifting') {
        if (!text(annotation, 'equipmentId')) issues.push('equipmentId');
        if (typeof annotation.radius !== 'number' || !Number.isFinite(annotation.radius) || annotation.radius <= 0) issues.push('radius');
    } else if (layer === 'restricted') {
        if (!text(annotation, 'startDate')) issues.push('startDate');
        if (!text(annotation, 'endDate')) issues.push('endDate');
        if (!text(annotation, 'responsibleWorkerId')) issues.push('responsibleWorkerId');
        if (!text(annotation, 'responsibleRole')) issues.push('responsibleRole');
    } else if (layer === 'storage' && !text(annotation, 'materialType')) {
        issues.push('materialType');
    }
    const geometry = isRecord(annotation.geometry) ? annotation.geometry : {};
    const geometryValid = contract.geometry === 'direction'
        ? hasDirectionGeometry(geometry)
        : contract.geometry === 'radius'
            ? geometry.kind === 'ellipse'
            : hasAreaGeometry(geometry);
    if (!geometryValid) issues.push('geometry');
    const style = isRecord(annotation.style) ? annotation.style : {};
    const expected = canonicalConstructionPlanDrawingAnnotationStyle(layer);
    const styleKeys = new Set([...Object.keys(style), ...Object.keys(expected)]);
    if (Array.from(styleKeys).some((key) => style[key] !== expected[key])) issues.push('style');
    return Array.from(new Set(issues));
};
