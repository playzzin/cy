import { aiSettingsService, normalizeGeminiModelName } from './aiSettingsService';

export type DrawingWorkType = 'scaffold' | 'shoring' | 'common';
export type EstimateBucket = 'construction' | 'rental';
export type DifficultyGrade = 'easy' | 'normal' | 'hard' | 'veryHard';
export type DrawingEstimateUnit = 'm2' | 'm3' | 'm' | 'ea' | 'set' | 'day';

export interface UploadedDrawingSummary {
    name: string;
    size: number;
    type: string;
}

export interface DrawingFact {
    id: string;
    label: string;
    value: string;
    evidence: string;
    confidence: number;
    needsReview?: boolean;
}

export interface ScaffoldZone {
    id: string;
    name: string;
    location: string;
    lengthM: number;
    heightM: number;
    areaM2: number;
    bayCount: number;
    pointCount: number;
    boardAreaM2: number;
    stairTowerCount: number;
    bracketCount: number;
    safetyNetM2: number;
    toeBoardM: number;
    guardrailM: number;
    baseJackCount: number;
    wallTieCount: number;
    openingDeductionM2: number;
    protectiveNet: boolean;
    installDifficulty: DifficultyGrade;
    dismantleDifficulty: DifficultyGrade;
    difficultyReason: string;
    evidence: string;
    confidence: number;
    needsReview?: boolean;
}

export interface ShoringZone {
    id: string;
    name: string;
    floor: string;
    slabAreaM2: number;
    supportHeightM: number;
    volumeM3: number;
    spacingM: number;
    postCount: number;
    baseJackCount: number;
    uHeadJackCount: number;
    beamLengthM: number;
    ledgerLengthM: number;
    braceLengthM: number;
    installDifficulty: DifficultyGrade;
    dismantleDifficulty: DifficultyGrade;
    difficultyReason: string;
    evidence: string;
    confidence: number;
    needsReview?: boolean;
}

export interface DrawingAdditionalItem {
    id: string;
    bucket: EstimateBucket;
    workType: DrawingWorkType;
    label: string;
    quantity: number;
    unit: DrawingEstimateUnit;
    unitPrice: number;
    evidence: string;
    confidence: number;
    needsReview?: boolean;
}

export interface DrawingAnalysisResult {
    projectName: string;
    scaleText: string;
    buildingSummary: string;
    detectedDrawingTypes: string[];
    drawingFacts: DrawingFact[];
    scaffoldZones: ScaffoldZone[];
    shoringZones: ShoringZone[];
    additionalItems: DrawingAdditionalItem[];
    assumptions: string[];
    missingInformation: string[];
}

export interface DrawingEstimateRates {
    scaffoldWorkerDaily: number;
    scaffoldInstallM2PerDay: number;
    scaffoldDismantleM2PerDay: number;
    shoringInstallM3PerDay: number;
    shoringDismantleM3PerDay: number;
    boardInstallM2PerDay: number;
    safetyNetInstallM2PerDay: number;
    stairTowerInstallEachPerDay: number;
    bracketInstallEachPerDay: number;
    scaffoldRentalRateM2Month: number;
    shoringRentalRateM3Month: number;
    boardRentalRateM2Month: number;
    safetyNetRentalRateM2Month: number;
    stairTowerRentalRateEachMonth: number;
    bracketRentalRateEachMonth: number;
    toeBoardRentalRateMMonth: number;
    guardrailRentalRateMMonth: number;
    baseJackRentalRateEachMonth: number;
    wallTieRentalRateEachMonth: number;
    shoringPostRentalRateEachMonth: number;
    shoringJackRentalRateEachMonth: number;
    shoringBeamRentalRateMMonth: number;
    shoringLedgerRentalRateMMonth: number;
    shoringBraceRentalRateMMonth: number;
    scaffoldTransportRateM2: number;
    shoringTransportRateM3: number;
}

export interface DrawingEstimateSettings {
    rentalMonths: number;
    includeVat: boolean;
    vatRate: number;
    constructionOverheadPct: number;
    constructionProfitPct: number;
    rentalOverheadPct: number;
    rentalProfitPct: number;
    constructionDiscount: number;
    rentalDiscount: number;
    rates: DrawingEstimateRates;
}

export interface DrawingEstimateLine {
    id: string;
    bucket: EstimateBucket;
    workType: DrawingWorkType;
    zoneName: string;
    label: string;
    standardBasis: string;
    quantity: number;
    unit: DrawingEstimateUnit;
    unitPrice: number;
    manDays: number;
    laborCost: number;
    rentalCost: number;
    transportCost: number;
    amount: number;
    productivityText: string;
    evidence: string;
    confidence: number;
    needsReview: boolean;
}

export interface DrawingEstimateBucketTotals {
    directCost: number;
    overhead: number;
    profit: number;
    discount: number;
    beforeVat: number;
    vat: number;
    total: number;
}

export interface DrawingEstimateTotals {
    construction: DrawingEstimateBucketTotals;
    rental: DrawingEstimateBucketTotals;
    combined: DrawingEstimateBucketTotals;
}

export interface DrawingEstimateCalculation {
    constructionLines: DrawingEstimateLine[];
    rentalLines: DrawingEstimateLine[];
    allLines: DrawingEstimateLine[];
    totals: DrawingEstimateTotals;
    warnings: string[];
}

const MAX_INLINE_FILE_SIZE_BYTES = 15 * 1024 * 1024;

const DIFFICULTY_FACTORS: Record<DifficultyGrade, number> = {
    easy: 0.9,
    normal: 1,
    hard: 1.18,
    veryHard: 1.35
};

export const DIFFICULTY_LABELS: Record<DifficultyGrade, string> = {
    easy: '쉬움',
    normal: '보통',
    hard: '어려움',
    veryHard: '매우 어려움'
};

export const DEFAULT_DRAWING_ESTIMATE_SETTINGS: DrawingEstimateSettings = {
    rentalMonths: 3,
    includeVat: true,
    vatRate: 10,
    constructionOverheadPct: 6,
    constructionProfitPct: 8,
    rentalOverheadPct: 3,
    rentalProfitPct: 5,
    constructionDiscount: 0,
    rentalDiscount: 0,
    rates: {
        scaffoldWorkerDaily: 295000,
        scaffoldInstallM2PerDay: 150,
        scaffoldDismantleM2PerDay: 170,
        shoringInstallM3PerDay: 110,
        shoringDismantleM3PerDay: 130,
        boardInstallM2PerDay: 220,
        safetyNetInstallM2PerDay: 260,
        stairTowerInstallEachPerDay: 2,
        bracketInstallEachPerDay: 60,
        scaffoldRentalRateM2Month: 3200,
        shoringRentalRateM3Month: 2400,
        boardRentalRateM2Month: 900,
        safetyNetRentalRateM2Month: 650,
        stairTowerRentalRateEachMonth: 140000,
        bracketRentalRateEachMonth: 1800,
        toeBoardRentalRateMMonth: 700,
        guardrailRentalRateMMonth: 600,
        baseJackRentalRateEachMonth: 450,
        wallTieRentalRateEachMonth: 500,
        shoringPostRentalRateEachMonth: 900,
        shoringJackRentalRateEachMonth: 650,
        shoringBeamRentalRateMMonth: 800,
        shoringLedgerRentalRateMMonth: 650,
        shoringBraceRentalRateMMonth: 520,
        scaffoldTransportRateM2: 900,
        shoringTransportRateM3: 700
    }
};

const drawingFactSchema = {
    type: 'object',
    properties: {
        label: { type: 'string' },
        value: { type: 'string' },
        evidence: { type: 'string' },
        confidence: { type: 'number' },
        needsReview: { type: 'boolean' }
    },
    required: ['label', 'value', 'evidence', 'confidence', 'needsReview'],
    propertyOrdering: ['label', 'value', 'evidence', 'confidence', 'needsReview']
};

const scaffoldZoneSchema = {
    type: 'object',
    properties: {
        name: { type: 'string' },
        location: { type: 'string' },
        lengthM: { type: 'number' },
        heightM: { type: 'number' },
        areaM2: { type: 'number' },
        bayCount: { type: 'number' },
        pointCount: { type: 'number' },
        boardAreaM2: { type: 'number' },
        stairTowerCount: { type: 'number' },
        bracketCount: { type: 'number' },
        safetyNetM2: { type: 'number' },
        toeBoardM: { type: 'number' },
        guardrailM: { type: 'number' },
        baseJackCount: { type: 'number' },
        wallTieCount: { type: 'number' },
        openingDeductionM2: { type: 'number' },
        protectiveNet: { type: 'boolean' },
        installDifficulty: { type: 'string', enum: ['easy', 'normal', 'hard', 'veryHard'] },
        dismantleDifficulty: { type: 'string', enum: ['easy', 'normal', 'hard', 'veryHard'] },
        difficultyReason: { type: 'string' },
        evidence: { type: 'string' },
        confidence: { type: 'number' },
        needsReview: { type: 'boolean' }
    },
    required: [
        'name',
        'location',
        'lengthM',
        'heightM',
        'areaM2',
        'bayCount',
        'pointCount',
        'boardAreaM2',
        'stairTowerCount',
        'bracketCount',
        'safetyNetM2',
        'toeBoardM',
        'guardrailM',
        'baseJackCount',
        'wallTieCount',
        'openingDeductionM2',
        'protectiveNet',
        'installDifficulty',
        'dismantleDifficulty',
        'difficultyReason',
        'evidence',
        'confidence',
        'needsReview'
    ],
    propertyOrdering: [
        'name',
        'location',
        'lengthM',
        'heightM',
        'areaM2',
        'bayCount',
        'pointCount',
        'boardAreaM2',
        'stairTowerCount',
        'bracketCount',
        'safetyNetM2',
        'toeBoardM',
        'guardrailM',
        'baseJackCount',
        'wallTieCount',
        'openingDeductionM2',
        'protectiveNet',
        'installDifficulty',
        'dismantleDifficulty',
        'difficultyReason',
        'evidence',
        'confidence',
        'needsReview'
    ]
};

const shoringZoneSchema = {
    type: 'object',
    properties: {
        name: { type: 'string' },
        floor: { type: 'string' },
        slabAreaM2: { type: 'number' },
        supportHeightM: { type: 'number' },
        volumeM3: { type: 'number' },
        spacingM: { type: 'number' },
        postCount: { type: 'number' },
        baseJackCount: { type: 'number' },
        uHeadJackCount: { type: 'number' },
        beamLengthM: { type: 'number' },
        ledgerLengthM: { type: 'number' },
        braceLengthM: { type: 'number' },
        installDifficulty: { type: 'string', enum: ['easy', 'normal', 'hard', 'veryHard'] },
        dismantleDifficulty: { type: 'string', enum: ['easy', 'normal', 'hard', 'veryHard'] },
        difficultyReason: { type: 'string' },
        evidence: { type: 'string' },
        confidence: { type: 'number' },
        needsReview: { type: 'boolean' }
    },
    required: [
        'name',
        'floor',
        'slabAreaM2',
        'supportHeightM',
        'volumeM3',
        'spacingM',
        'postCount',
        'baseJackCount',
        'uHeadJackCount',
        'beamLengthM',
        'ledgerLengthM',
        'braceLengthM',
        'installDifficulty',
        'dismantleDifficulty',
        'difficultyReason',
        'evidence',
        'confidence',
        'needsReview'
    ],
    propertyOrdering: [
        'name',
        'floor',
        'slabAreaM2',
        'supportHeightM',
        'volumeM3',
        'spacingM',
        'postCount',
        'baseJackCount',
        'uHeadJackCount',
        'beamLengthM',
        'ledgerLengthM',
        'braceLengthM',
        'installDifficulty',
        'dismantleDifficulty',
        'difficultyReason',
        'evidence',
        'confidence',
        'needsReview'
    ]
};

const additionalItemSchema = {
    type: 'object',
    properties: {
        bucket: { type: 'string', enum: ['construction', 'rental'] },
        workType: { type: 'string', enum: ['scaffold', 'shoring', 'common'] },
        label: { type: 'string' },
        quantity: { type: 'number' },
        unit: { type: 'string', enum: ['m2', 'm3', 'm', 'ea', 'set', 'day'] },
        unitPrice: { type: 'number' },
        evidence: { type: 'string' },
        confidence: { type: 'number' },
        needsReview: { type: 'boolean' }
    },
    required: ['bucket', 'workType', 'label', 'quantity', 'unit', 'unitPrice', 'evidence', 'confidence', 'needsReview'],
    propertyOrdering: ['bucket', 'workType', 'label', 'quantity', 'unit', 'unitPrice', 'evidence', 'confidence', 'needsReview']
};

const DRAWING_ANALYSIS_SCHEMA = {
    type: 'object',
    properties: {
        projectName: { type: 'string' },
        scaleText: { type: 'string' },
        buildingSummary: { type: 'string' },
        detectedDrawingTypes: {
            type: 'array',
            items: { type: 'string' }
        },
        drawingFacts: {
            type: 'array',
            items: drawingFactSchema
        },
        scaffoldZones: {
            type: 'array',
            items: scaffoldZoneSchema
        },
        shoringZones: {
            type: 'array',
            items: shoringZoneSchema
        },
        additionalItems: {
            type: 'array',
            items: additionalItemSchema
        },
        assumptions: {
            type: 'array',
            items: { type: 'string' }
        },
        missingInformation: {
            type: 'array',
            items: { type: 'string' }
        }
    },
    required: [
        'projectName',
        'scaleText',
        'buildingSummary',
        'detectedDrawingTypes',
        'drawingFacts',
        'scaffoldZones',
        'shoringZones',
        'additionalItems',
        'assumptions',
        'missingInformation'
    ],
    propertyOrdering: [
        'projectName',
        'scaleText',
        'buildingSummary',
        'detectedDrawingTypes',
        'drawingFacts',
        'scaffoldZones',
        'shoringZones',
        'additionalItems',
        'assumptions',
        'missingInformation'
    ]
};

const toNumber = (value: unknown, fallback = 0): number => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const parsed = Number(value.replace(/,/g, '').trim());
        return Number.isFinite(parsed) ? parsed : fallback;
    }
    return fallback;
};

const nonNegative = (value: unknown, fallback = 0): number => Math.max(0, toNumber(value, fallback));

const normalizeConfidence = (value: unknown): number => {
    const n = toNumber(value, 0);
    if (n > 1) return Math.max(0, Math.min(1, n / 100));
    return Math.max(0, Math.min(1, n));
};

const normalizeDifficulty = (value: unknown): DifficultyGrade => {
    const raw = String(value || '').trim();
    if (raw === 'easy' || raw === 'normal' || raw === 'hard' || raw === 'veryHard') return raw;
    return 'normal';
};

const normalizeBucket = (value: unknown): EstimateBucket => {
    return value === 'rental' ? 'rental' : 'construction';
};

const normalizeWorkType = (value: unknown): DrawingWorkType => {
    if (value === 'scaffold' || value === 'shoring' || value === 'common') return value;
    return 'common';
};

const normalizeUnit = (value: unknown): DrawingEstimateUnit => {
    const raw = String(value || '').trim();
    if (raw === 'm2' || raw === 'm3' || raw === 'm' || raw === 'ea' || raw === 'set' || raw === 'day') return raw;
    return 'ea';
};

const makeId = (prefix: string, index: number): string => `${prefix}-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`;

const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = String(reader.result || '');
            resolve(result.includes(',') ? result.split(',')[1] : result);
        };
        reader.onerror = () => reject(reader.error || new Error('파일을 읽을 수 없습니다.'));
        reader.readAsDataURL(file);
    });
};

const getMimeType = (file: File): string => {
    if (file.type) return file.type;
    const name = file.name.toLowerCase();
    if (name.endsWith('.pdf')) return 'application/pdf';
    if (name.endsWith('.png')) return 'image/png';
    if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
    if (name.endsWith('.webp')) return 'image/webp';
    return 'application/octet-stream';
};

const extractGeminiText = (data: any): string => {
    const parts = data?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts)) return '';
    return parts.map((part: any) => typeof part?.text === 'string' ? part.text : '').join('').trim();
};

const parseJson = (text: string): any => {
    try {
        return JSON.parse(text);
    } catch {
        const objectStart = text.indexOf('{');
        const objectEnd = text.lastIndexOf('}');
        if (objectStart >= 0 && objectEnd > objectStart) {
            return JSON.parse(text.slice(objectStart, objectEnd + 1));
        }
        throw new Error('Gemini 응답을 JSON으로 해석할 수 없습니다.');
    }
};

const buildPrompt = (files: UploadedDrawingSummary[], projectHint: string): string => `
You are a Korean temporary-works estimator for system scaffold and system shoring.
Analyze the attached drawings and extract measurable takeoff data for two separate estimates:
1. construction labor estimate (시공 견적: install/dismantle labor only)
2. material rental estimate (자재임대 견적: rental and transport only)

Project hint: ${projectHint || 'not provided'}
Files:
${files.map((file, index) => `${index + 1}. ${file.name} (${file.type || 'unknown'}, ${Math.round(file.size / 1024)}KB)`).join('\n')}

Return only JSON that matches the schema.

Important extraction rules:
- Use meters, square meters, cubic meters, and counts.
- Extract every drawing fact that can affect takeoff: scale, drawing number, drawing title, floor, grid, slab area, floor height, building height, perimeter, elevation, section, opening, cantilever, exterior length, stair/tower note, bracket note, safety net note, platform/board note, shoring spacing, shoring height, post/jack/beam/ledger/brace schedule.
- For system scaffold, extract lengthM, heightM, areaM2, bayCount, pointCount, boardAreaM2, stairTowerCount, bracketCount, safetyNetM2, toeBoardM, guardrailM, baseJackCount, wallTieCount, openingDeductionM2.
- For system shoring, extract slabAreaM2, supportHeightM, volumeM3, spacingM, postCount, baseJackCount, uHeadJackCount, beamLengthM, ledgerLengthM, braceLengthM.
- Difficulty must be easy, normal, hard, or veryHard. Use hard/veryHard when drawings show narrow access, high elevation, cantilever/bracket work, many openings, irregular elevations, high shoring, tight spacing, or staged installation/removal.
- Do not invent exact values. If a value is unclear, keep it 0, mark needsReview true, and add the issue to missingInformation.
- You may infer only when dimensions, scale, grid, elevation, schedule, or notes give enough evidence. Explain the evidence with sheet/page/view.
- protectiveNet should be true when safety net/protective net is required or normally included by notes. If absent and unclear, set true but put safetyNetM2 as 0 and needsReview true.
- additionalItems is for items not represented in scaffoldZones/shoringZones, such as special hoist opening, debris net, protection deck, relocation, night work, extra transport, or separate rental/service notes. If unitPrice is unknown, set unitPrice 0.
- confidence must be 0 to 1.
`;

const estimateScaffoldPointCount = (lengthM: number, heightM: number): number => {
    if (lengthM <= 0 || heightM <= 0) return 0;
    const bays = Math.max(1, Math.ceil(lengthM / 1.8));
    const levels = Math.max(1, Math.ceil(heightM / 1.8));
    return (bays + 1) * (levels + 1);
};

const estimateScaffoldBayCount = (lengthM: number): number => {
    if (lengthM <= 0) return 0;
    return Math.max(1, Math.ceil(lengthM / 1.8));
};

const estimateShoringPostCount = (slabAreaM2: number, spacingM: number): number => {
    if (slabAreaM2 <= 0 || spacingM <= 0) return 0;
    return Math.ceil(slabAreaM2 / (spacingM * spacingM));
};

const normalizeAnalysis = (raw: any): DrawingAnalysisResult => {
    const drawingFacts: DrawingFact[] = Array.isArray(raw?.drawingFacts)
        ? raw.drawingFacts.map((fact: any, index: number) => {
            const confidence = normalizeConfidence(fact?.confidence);
            return {
                id: makeId('fact', index),
                label: String(fact?.label || `도면 정보 ${index + 1}`),
                value: String(fact?.value || ''),
                evidence: String(fact?.evidence || ''),
                confidence,
                needsReview: Boolean(fact?.needsReview) || !fact?.value || confidence < 0.7
            };
        })
        : [];

    const scaffoldZones: ScaffoldZone[] = Array.isArray(raw?.scaffoldZones)
        ? raw.scaffoldZones.map((zone: any, index: number) => {
            const lengthM = nonNegative(zone?.lengthM);
            const heightM = nonNegative(zone?.heightM);
            const openingDeductionM2 = nonNegative(zone?.openingDeductionM2);
            const areaFromDims = Math.max(0, lengthM * heightM - openingDeductionM2);
            const areaM2 = nonNegative(zone?.areaM2, areaFromDims);
            const bayCountRaw = nonNegative(zone?.bayCount);
            const pointCountRaw = nonNegative(zone?.pointCount);
            const bayCount = bayCountRaw || estimateScaffoldBayCount(lengthM);
            const pointCount = pointCountRaw || estimateScaffoldPointCount(lengthM, heightM);
            const protectiveNet = zone?.protectiveNet !== false;
            const confidence = normalizeConfidence(zone?.confidence);

            return {
                id: makeId('scaffold', index),
                name: String(zone?.name || `시스템비계 구간 ${index + 1}`),
                location: String(zone?.location || ''),
                lengthM,
                heightM,
                areaM2,
                bayCount,
                pointCount,
                boardAreaM2: nonNegative(zone?.boardAreaM2),
                stairTowerCount: nonNegative(zone?.stairTowerCount),
                bracketCount: nonNegative(zone?.bracketCount),
                safetyNetM2: nonNegative(zone?.safetyNetM2),
                toeBoardM: nonNegative(zone?.toeBoardM),
                guardrailM: nonNegative(zone?.guardrailM),
                baseJackCount: nonNegative(zone?.baseJackCount, pointCount),
                wallTieCount: nonNegative(zone?.wallTieCount),
                openingDeductionM2,
                protectiveNet,
                installDifficulty: normalizeDifficulty(zone?.installDifficulty),
                dismantleDifficulty: normalizeDifficulty(zone?.dismantleDifficulty),
                difficultyReason: String(zone?.difficultyReason || ''),
                evidence: String(zone?.evidence || ''),
                confidence,
                needsReview: Boolean(zone?.needsReview) || areaM2 <= 0 || heightM <= 0 || confidence < 0.7 || !pointCountRaw
            };
        })
        : [];

    const shoringZones: ShoringZone[] = Array.isArray(raw?.shoringZones)
        ? raw.shoringZones.map((zone: any, index: number) => {
            const slabAreaM2 = nonNegative(zone?.slabAreaM2);
            const supportHeightM = nonNegative(zone?.supportHeightM);
            const volumeM3 = nonNegative(zone?.volumeM3, slabAreaM2 * supportHeightM);
            const spacingM = nonNegative(zone?.spacingM);
            const postCountRaw = nonNegative(zone?.postCount);
            const postCount = postCountRaw || estimateShoringPostCount(slabAreaM2, spacingM);
            const confidence = normalizeConfidence(zone?.confidence);

            return {
                id: makeId('shoring', index),
                name: String(zone?.name || `시스템동바리 구간 ${index + 1}`),
                floor: String(zone?.floor || ''),
                slabAreaM2,
                supportHeightM,
                volumeM3,
                spacingM,
                postCount,
                baseJackCount: nonNegative(zone?.baseJackCount, postCount),
                uHeadJackCount: nonNegative(zone?.uHeadJackCount, postCount),
                beamLengthM: nonNegative(zone?.beamLengthM),
                ledgerLengthM: nonNegative(zone?.ledgerLengthM),
                braceLengthM: nonNegative(zone?.braceLengthM),
                installDifficulty: normalizeDifficulty(zone?.installDifficulty),
                dismantleDifficulty: normalizeDifficulty(zone?.dismantleDifficulty),
                difficultyReason: String(zone?.difficultyReason || ''),
                evidence: String(zone?.evidence || ''),
                confidence,
                needsReview: Boolean(zone?.needsReview) || volumeM3 <= 0 || supportHeightM <= 0 || spacingM <= 0 || confidence < 0.7 || !postCountRaw
            };
        })
        : [];

    const additionalItems: DrawingAdditionalItem[] = Array.isArray(raw?.additionalItems)
        ? raw.additionalItems.map((item: any, index: number) => {
            const confidence = normalizeConfidence(item?.confidence);
            return {
                id: makeId('extra', index),
                bucket: normalizeBucket(item?.bucket),
                workType: normalizeWorkType(item?.workType),
                label: String(item?.label || `추가항목 ${index + 1}`),
                quantity: nonNegative(item?.quantity),
                unit: normalizeUnit(item?.unit),
                unitPrice: nonNegative(item?.unitPrice),
                evidence: String(item?.evidence || ''),
                confidence,
                needsReview: Boolean(item?.needsReview) || confidence < 0.7 || !item?.unitPrice
            };
        })
        : [];

    return {
        projectName: String(raw?.projectName || ''),
        scaleText: String(raw?.scaleText || ''),
        buildingSummary: String(raw?.buildingSummary || ''),
        detectedDrawingTypes: Array.isArray(raw?.detectedDrawingTypes) ? raw.detectedDrawingTypes.map(String) : [],
        drawingFacts,
        scaffoldZones,
        shoringZones,
        additionalItems,
        assumptions: Array.isArray(raw?.assumptions) ? raw.assumptions.map(String) : [],
        missingInformation: Array.isArray(raw?.missingInformation) ? raw.missingInformation.map(String) : []
    };
};

const getGeminiGenerateContentUrl = (apiKey: string): string => {
    const model = normalizeGeminiModelName(aiSettingsService.getModels().textModel, 'gemini-2.5-flash');
    return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
};

const roundWon = (value: number): number => Math.round(value || 0);

const addTotals = (a: DrawingEstimateBucketTotals, b: DrawingEstimateBucketTotals): DrawingEstimateBucketTotals => ({
    directCost: roundWon(a.directCost + b.directCost),
    overhead: roundWon(a.overhead + b.overhead),
    profit: roundWon(a.profit + b.profit),
    discount: roundWon(a.discount + b.discount),
    beforeVat: roundWon(a.beforeVat + b.beforeVat),
    vat: roundWon(a.vat + b.vat),
    total: roundWon(a.total + b.total)
});

const calculateBucketTotals = (
    directCost: number,
    overheadPct: number,
    profitPct: number,
    discount: number,
    includeVat: boolean,
    vatRate: number
): DrawingEstimateBucketTotals => {
    const overhead = directCost * (overheadPct / 100);
    const profit = (directCost + overhead) * (profitPct / 100);
    const beforeVat = Math.max(0, directCost + overhead + profit - discount);
    const vat = includeVat ? beforeVat * (vatRate / 100) : 0;
    return {
        directCost: roundWon(directCost),
        overhead: roundWon(overhead),
        profit: roundWon(profit),
        discount: roundWon(discount),
        beforeVat: roundWon(beforeVat),
        vat: roundWon(vat),
        total: roundWon(beforeVat + vat)
    };
};

const addLine = (
    lines: DrawingEstimateLine[],
    input: Omit<DrawingEstimateLine, 'unitPrice' | 'amount' | 'laborCost' | 'rentalCost' | 'transportCost'> & {
        laborCost?: number;
        rentalCost?: number;
        transportCost?: number;
        amount?: number;
    }
) => {
    if (input.quantity <= 0) return;
    const laborCost = roundWon(input.laborCost || 0);
    const rentalCost = roundWon(input.rentalCost || 0);
    const transportCost = roundWon(input.transportCost || 0);
    const amount = roundWon(input.amount ?? laborCost + rentalCost + transportCost);
    if (amount <= 0) return;

    lines.push({
        ...input,
        quantity: Number(input.quantity.toFixed(3)),
        unitPrice: roundWon(amount / input.quantity),
        manDays: Number((input.manDays || 0).toFixed(3)),
        laborCost,
        rentalCost,
        transportCost,
        amount
    });
};

const difficultyText = (install: DifficultyGrade, dismantle: DifficultyGrade): string => {
    return `설치 ${DIFFICULTY_LABELS[install]} x${DIFFICULTY_FACTORS[install]}, 해체 ${DIFFICULTY_LABELS[dismantle]} x${DIFFICULTY_FACTORS[dismantle]}`;
};

export const drawingEstimateService = {
    async analyzeDrawingFiles(files: File[], projectHint: string): Promise<DrawingAnalysisResult> {
        aiSettingsService.assertCurrentPageEnabled('도면 Gemini 분석');
        const apiKey = aiSettingsService.getApiKey();
        if (!apiKey) {
            throw new Error('Gemini API Key가 없습니다. /settings/ai에서 API Key를 등록해 주세요.');
        }

        if (files.length === 0) {
            throw new Error('분석할 도면 파일을 업로드해 주세요.');
        }

        const tooLarge = files.find((file) => file.size > MAX_INLINE_FILE_SIZE_BYTES);
        if (tooLarge) {
            throw new Error(`${tooLarge.name} 파일이 15MB를 초과합니다. 현재 브라우저 직접 분석은 15MB 이하 PDF/이미지만 지원합니다.`);
        }

        const summaries = files.map((file) => ({
            name: file.name,
            size: file.size,
            type: getMimeType(file)
        }));

        const fileParts = await Promise.all(files.map(async (file) => ({
            inlineData: {
                mimeType: getMimeType(file),
                data: await readFileAsBase64(file)
            }
        })));

        const response = await fetch(getGeminiGenerateContentUrl(apiKey), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    role: 'user',
                    parts: [
                        { text: buildPrompt(summaries, projectHint) },
                        ...fileParts
                    ]
                }],
                generationConfig: {
                    temperature: 0.05,
                    responseMimeType: 'application/json',
                    responseJsonSchema: DRAWING_ANALYSIS_SCHEMA
                }
            })
        });

        const rawText = await response.text();
        let data: any = null;
        try {
            data = rawText ? JSON.parse(rawText) : null;
        } catch {
            data = null;
        }

        if (!response.ok || data?.error) {
            const message = data?.error?.message || `${response.status} ${response.statusText}`;
            throw new Error(`Gemini 도면 분석 실패: ${message}`);
        }

        const text = extractGeminiText(data);
        if (!text) {
            throw new Error('Gemini 응답이 비어 있습니다. 도면 해상도 또는 API 모델 설정을 확인해 주세요.');
        }

        return normalizeAnalysis(parseJson(text));
    },

    calculate(
        scaffoldZones: ScaffoldZone[],
        shoringZones: ShoringZone[],
        additionalItems: DrawingAdditionalItem[],
        settings: DrawingEstimateSettings
    ): DrawingEstimateCalculation {
        const warnings: string[] = [];
        const constructionLines: DrawingEstimateLine[] = [];
        const rentalLines: DrawingEstimateLine[] = [];
        const rates = settings.rates;

        scaffoldZones.forEach((zone) => {
            const area = zone.areaM2 > 0 ? zone.areaM2 : Math.max(0, zone.lengthM * zone.heightM - zone.openingDeductionM2);
            if (area <= 0 || zone.heightM <= 0) {
                warnings.push(`${zone.name}: 비계 면적 또는 높이가 없어 시공/임대 계산에서 제외했습니다.`);
                return;
            }

            if (zone.heightM > 30) {
                warnings.push(`${zone.name}: 시스템비계 30m 초과 구간은 구조검토와 별도 할증 검토가 필요합니다.`);
            }

            if (zone.pointCount <= 0) {
                warnings.push(`${zone.name}: 포인트 수가 없어 자재 상세 임대 산출 정확도가 낮습니다.`);
            }

            const installFactor = DIFFICULTY_FACTORS[zone.installDifficulty];
            const dismantleFactor = DIFFICULTY_FACTORS[zone.dismantleDifficulty];
            const installManDays = area / Math.max(1, rates.scaffoldInstallM2PerDay) * installFactor;
            const dismantleManDays = area / Math.max(1, rates.scaffoldDismantleM2PerDay) * dismantleFactor;

            addLine(constructionLines, {
                id: `${zone.id}-scaffold-labor`,
                bucket: 'construction',
                workType: 'scaffold',
                zoneName: zone.name,
                label: `${zone.name} 시스템비계 설치/해체`,
                standardBasis: '면적 x 설치/해체 생산성 x 난이도',
                quantity: area,
                unit: 'm2',
                manDays: installManDays + dismantleManDays,
                laborCost: (installManDays + dismantleManDays) * rates.scaffoldWorkerDaily,
                productivityText: `설치 ${rates.scaffoldInstallM2PerDay}m2/일, 해체 ${rates.scaffoldDismantleM2PerDay}m2/일, ${difficultyText(zone.installDifficulty, zone.dismantleDifficulty)}`,
                evidence: zone.evidence,
                confidence: zone.confidence,
                needsReview: Boolean(zone.needsReview)
            });

            const boardManDays = zone.boardAreaM2 > 0
                ? (zone.boardAreaM2 / Math.max(1, rates.boardInstallM2PerDay)) * (installFactor + dismantleFactor * 0.7)
                : 0;
            addLine(constructionLines, {
                id: `${zone.id}-board-labor`,
                bucket: 'construction',
                workType: 'scaffold',
                zoneName: zone.name,
                label: `${zone.name} 발판 설치/해체`,
                standardBasis: '발판 면적 x 발판 생산성',
                quantity: zone.boardAreaM2,
                unit: 'm2',
                manDays: boardManDays,
                laborCost: boardManDays * rates.scaffoldWorkerDaily,
                productivityText: `${rates.boardInstallM2PerDay}m2/일, ${difficultyText(zone.installDifficulty, zone.dismantleDifficulty)}`,
                evidence: zone.evidence,
                confidence: zone.confidence,
                needsReview: Boolean(zone.needsReview)
            });

            const netManDays = zone.safetyNetM2 > 0
                ? (zone.safetyNetM2 / Math.max(1, rates.safetyNetInstallM2PerDay)) * (installFactor + dismantleFactor * 0.6)
                : 0;
            addLine(constructionLines, {
                id: `${zone.id}-safety-net-labor`,
                bucket: 'construction',
                workType: 'scaffold',
                zoneName: zone.name,
                label: `${zone.name} 안전망 설치/해체`,
                standardBasis: '안전망 면적 x 안전망 생산성',
                quantity: zone.safetyNetM2,
                unit: 'm2',
                manDays: netManDays,
                laborCost: netManDays * rates.scaffoldWorkerDaily,
                productivityText: `${rates.safetyNetInstallM2PerDay}m2/일, ${difficultyText(zone.installDifficulty, zone.dismantleDifficulty)}`,
                evidence: zone.evidence,
                confidence: zone.confidence,
                needsReview: Boolean(zone.needsReview)
            });

            const stairManDays = zone.stairTowerCount > 0
                ? (zone.stairTowerCount / Math.max(0.1, rates.stairTowerInstallEachPerDay)) * (installFactor + dismantleFactor * 0.8)
                : 0;
            addLine(constructionLines, {
                id: `${zone.id}-stair-labor`,
                bucket: 'construction',
                workType: 'scaffold',
                zoneName: zone.name,
                label: `${zone.name} 계단타워 설치/해체`,
                standardBasis: '계단타워 수량 x 계단 생산성',
                quantity: zone.stairTowerCount,
                unit: 'ea',
                manDays: stairManDays,
                laborCost: stairManDays * rates.scaffoldWorkerDaily,
                productivityText: `${rates.stairTowerInstallEachPerDay}개/일, ${difficultyText(zone.installDifficulty, zone.dismantleDifficulty)}`,
                evidence: zone.evidence,
                confidence: zone.confidence,
                needsReview: Boolean(zone.needsReview)
            });

            const bracketManDays = zone.bracketCount > 0
                ? (zone.bracketCount / Math.max(1, rates.bracketInstallEachPerDay)) * (installFactor + dismantleFactor * 0.8)
                : 0;
            addLine(constructionLines, {
                id: `${zone.id}-bracket-labor`,
                bucket: 'construction',
                workType: 'scaffold',
                zoneName: zone.name,
                label: `${zone.name} 브라켓 설치/해체`,
                standardBasis: '브라켓 수량 x 브라켓 생산성',
                quantity: zone.bracketCount,
                unit: 'ea',
                manDays: bracketManDays,
                laborCost: bracketManDays * rates.scaffoldWorkerDaily,
                productivityText: `${rates.bracketInstallEachPerDay}개/일, ${difficultyText(zone.installDifficulty, zone.dismantleDifficulty)}`,
                evidence: zone.evidence,
                confidence: zone.confidence,
                needsReview: Boolean(zone.needsReview)
            });

            addLine(rentalLines, {
                id: `${zone.id}-scaffold-rental`,
                bucket: 'rental',
                workType: 'scaffold',
                zoneName: zone.name,
                label: `${zone.name} 시스템비계 기본재 임대`,
                standardBasis: `면적 x ${settings.rentalMonths}개월`,
                quantity: area,
                unit: 'm2',
                manDays: 0,
                rentalCost: area * settings.rentalMonths * rates.scaffoldRentalRateM2Month,
                productivityText: `${formatRate(rates.scaffoldRentalRateM2Month)}원/m2/월`,
                evidence: zone.evidence,
                confidence: zone.confidence,
                needsReview: Boolean(zone.needsReview)
            });

            addRentalAccessory(rentalLines, zone, 'boardAreaM2', '발판 임대', 'm2', rates.boardRentalRateM2Month, settings.rentalMonths);
            addRentalAccessory(rentalLines, zone, 'safetyNetM2', '안전망 임대', 'm2', rates.safetyNetRentalRateM2Month, settings.rentalMonths);
            addRentalAccessory(rentalLines, zone, 'stairTowerCount', '계단타워 임대', 'ea', rates.stairTowerRentalRateEachMonth, settings.rentalMonths);
            addRentalAccessory(rentalLines, zone, 'bracketCount', '브라켓 임대', 'ea', rates.bracketRentalRateEachMonth, settings.rentalMonths);
            addRentalAccessory(rentalLines, zone, 'toeBoardM', '폭목 임대', 'm', rates.toeBoardRentalRateMMonth, settings.rentalMonths);
            addRentalAccessory(rentalLines, zone, 'guardrailM', '난간대 임대', 'm', rates.guardrailRentalRateMMonth, settings.rentalMonths);
            addRentalAccessory(rentalLines, zone, 'baseJackCount', '베이스잭 임대', 'ea', rates.baseJackRentalRateEachMonth, settings.rentalMonths);
            addRentalAccessory(rentalLines, zone, 'wallTieCount', '벽이음 임대', 'ea', rates.wallTieRentalRateEachMonth, settings.rentalMonths);

            addLine(rentalLines, {
                id: `${zone.id}-scaffold-transport`,
                bucket: 'rental',
                workType: 'scaffold',
                zoneName: zone.name,
                label: `${zone.name} 비계 자재 운반`,
                standardBasis: '비계 면적 x 운반 단가',
                quantity: area,
                unit: 'm2',
                manDays: 0,
                transportCost: area * rates.scaffoldTransportRateM2,
                productivityText: `${formatRate(rates.scaffoldTransportRateM2)}원/m2`,
                evidence: zone.evidence,
                confidence: zone.confidence,
                needsReview: Boolean(zone.needsReview)
            });
        });

        shoringZones.forEach((zone) => {
            const volume = zone.volumeM3 > 0 ? zone.volumeM3 : zone.slabAreaM2 * zone.supportHeightM;
            if (volume <= 0 || zone.supportHeightM <= 0) {
                warnings.push(`${zone.name}: 동바리 체적 또는 높이가 없어 시공/임대 계산에서 제외했습니다.`);
                return;
            }

            if (zone.supportHeightM > 30) {
                warnings.push(`${zone.name}: 시스템동바리 30m 초과 구간은 구조검토와 별도 할증 검토가 필요합니다.`);
            }

            if (zone.spacingM <= 0) {
                warnings.push(`${zone.name}: 설치간격이 불명확합니다. 포스트/잭 수량과 생산성을 검토해 주세요.`);
            }

            const installFactor = DIFFICULTY_FACTORS[zone.installDifficulty];
            const dismantleFactor = DIFFICULTY_FACTORS[zone.dismantleDifficulty];
            const installManDays = volume / Math.max(1, rates.shoringInstallM3PerDay) * installFactor;
            const dismantleManDays = volume / Math.max(1, rates.shoringDismantleM3PerDay) * dismantleFactor;

            addLine(constructionLines, {
                id: `${zone.id}-shoring-labor`,
                bucket: 'construction',
                workType: 'shoring',
                zoneName: zone.name,
                label: `${zone.name} 시스템동바리 설치/해체`,
                standardBasis: '체적 x 설치/해체 생산성 x 난이도',
                quantity: volume,
                unit: 'm3',
                manDays: installManDays + dismantleManDays,
                laborCost: (installManDays + dismantleManDays) * rates.scaffoldWorkerDaily,
                productivityText: `설치 ${rates.shoringInstallM3PerDay}m3/일, 해체 ${rates.shoringDismantleM3PerDay}m3/일, ${difficultyText(zone.installDifficulty, zone.dismantleDifficulty)}`,
                evidence: zone.evidence,
                confidence: zone.confidence,
                needsReview: Boolean(zone.needsReview)
            });

            addLine(rentalLines, {
                id: `${zone.id}-shoring-rental`,
                bucket: 'rental',
                workType: 'shoring',
                zoneName: zone.name,
                label: `${zone.name} 시스템동바리 기본재 임대`,
                standardBasis: `체적 x ${settings.rentalMonths}개월`,
                quantity: volume,
                unit: 'm3',
                manDays: 0,
                rentalCost: volume * settings.rentalMonths * rates.shoringRentalRateM3Month,
                productivityText: `${formatRate(rates.shoringRentalRateM3Month)}원/m3/월`,
                evidence: zone.evidence,
                confidence: zone.confidence,
                needsReview: Boolean(zone.needsReview)
            });

            addShoringRentalAccessory(rentalLines, zone, 'postCount', '동바리 포스트 임대', 'ea', rates.shoringPostRentalRateEachMonth, settings.rentalMonths);
            addShoringRentalAccessory(rentalLines, zone, 'baseJackCount', '베이스잭 임대', 'ea', rates.shoringJackRentalRateEachMonth, settings.rentalMonths);
            addShoringRentalAccessory(rentalLines, zone, 'uHeadJackCount', 'U헤드잭 임대', 'ea', rates.shoringJackRentalRateEachMonth, settings.rentalMonths);
            addShoringRentalAccessory(rentalLines, zone, 'beamLengthM', '멍에재 임대', 'm', rates.shoringBeamRentalRateMMonth, settings.rentalMonths);
            addShoringRentalAccessory(rentalLines, zone, 'ledgerLengthM', '장선재 임대', 'm', rates.shoringLedgerRentalRateMMonth, settings.rentalMonths);
            addShoringRentalAccessory(rentalLines, zone, 'braceLengthM', '가새재 임대', 'm', rates.shoringBraceRentalRateMMonth, settings.rentalMonths);

            addLine(rentalLines, {
                id: `${zone.id}-shoring-transport`,
                bucket: 'rental',
                workType: 'shoring',
                zoneName: zone.name,
                label: `${zone.name} 동바리 자재 운반`,
                standardBasis: '동바리 체적 x 운반 단가',
                quantity: volume,
                unit: 'm3',
                manDays: 0,
                transportCost: volume * rates.shoringTransportRateM3,
                productivityText: `${formatRate(rates.shoringTransportRateM3)}원/m3`,
                evidence: zone.evidence,
                confidence: zone.confidence,
                needsReview: Boolean(zone.needsReview)
            });
        });

        additionalItems.forEach((item) => {
            addLine(item.bucket === 'construction' ? constructionLines : rentalLines, {
                id: item.id,
                bucket: item.bucket,
                workType: item.workType,
                zoneName: '추가항목',
                label: item.label,
                standardBasis: item.bucket === 'construction' ? '추가 시공 항목' : '추가 임대 항목',
                quantity: item.quantity,
                unit: item.unit,
                manDays: 0,
                laborCost: item.bucket === 'construction' ? item.quantity * item.unitPrice : 0,
                rentalCost: item.bucket === 'rental' ? item.quantity * item.unitPrice : 0,
                productivityText: '도면/특기사항 추가항목',
                evidence: item.evidence,
                confidence: item.confidence,
                needsReview: Boolean(item.needsReview)
            });
        });

        const constructionDirectCost = constructionLines.reduce((sum, line) => sum + line.amount, 0);
        const rentalDirectCost = rentalLines.reduce((sum, line) => sum + line.amount, 0);
        const constructionTotals = calculateBucketTotals(
            constructionDirectCost,
            settings.constructionOverheadPct,
            settings.constructionProfitPct,
            settings.constructionDiscount,
            settings.includeVat,
            settings.vatRate
        );
        const rentalTotals = calculateBucketTotals(
            rentalDirectCost,
            settings.rentalOverheadPct,
            settings.rentalProfitPct,
            settings.rentalDiscount,
            settings.includeVat,
            settings.vatRate
        );

        return {
            constructionLines,
            rentalLines,
            allLines: [...constructionLines, ...rentalLines],
            totals: {
                construction: constructionTotals,
                rental: rentalTotals,
                combined: addTotals(constructionTotals, rentalTotals)
            },
            warnings
        };
    }
};

type ScaffoldRentalKey =
    | 'boardAreaM2'
    | 'safetyNetM2'
    | 'stairTowerCount'
    | 'bracketCount'
    | 'toeBoardM'
    | 'guardrailM'
    | 'baseJackCount'
    | 'wallTieCount';

const addRentalAccessory = (
    lines: DrawingEstimateLine[],
    zone: ScaffoldZone,
    key: ScaffoldRentalKey,
    label: string,
    unit: DrawingEstimateUnit,
    monthlyRate: number,
    rentalMonths: number
) => {
    const quantity = nonNegative(zone[key]);
    addLine(lines, {
        id: `${zone.id}-${key}-rental`,
        bucket: 'rental',
        workType: 'scaffold',
        zoneName: zone.name,
        label: `${zone.name} ${label}`,
        standardBasis: `${label} x ${rentalMonths}개월`,
        quantity,
        unit,
        manDays: 0,
        rentalCost: quantity * monthlyRate * rentalMonths,
        productivityText: `${formatRate(monthlyRate)}원/${unit}/월`,
        evidence: zone.evidence,
        confidence: zone.confidence,
        needsReview: Boolean(zone.needsReview)
    });
};

type ShoringRentalKey =
    | 'postCount'
    | 'baseJackCount'
    | 'uHeadJackCount'
    | 'beamLengthM'
    | 'ledgerLengthM'
    | 'braceLengthM';

const addShoringRentalAccessory = (
    lines: DrawingEstimateLine[],
    zone: ShoringZone,
    key: ShoringRentalKey,
    label: string,
    unit: DrawingEstimateUnit,
    monthlyRate: number,
    rentalMonths: number
) => {
    const quantity = nonNegative(zone[key]);
    addLine(lines, {
        id: `${zone.id}-${key}-rental`,
        bucket: 'rental',
        workType: 'shoring',
        zoneName: zone.name,
        label: `${zone.name} ${label}`,
        standardBasis: `${label} x ${rentalMonths}개월`,
        quantity,
        unit,
        manDays: 0,
        rentalCost: quantity * monthlyRate * rentalMonths,
        productivityText: `${formatRate(monthlyRate)}원/${unit}/월`,
        evidence: zone.evidence,
        confidence: zone.confidence,
        needsReview: Boolean(zone.needsReview)
    });
};

const formatRate = (value: number): string => new Intl.NumberFormat('ko-KR').format(Math.round(value || 0));
