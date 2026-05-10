import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faArrowLeft,
    faCalculator,
    faCheckCircle,
    faDownload,
    faExclamationTriangle,
    faFileArrowUp,
    faFloppyDisk,
    faHelmetSafety,
    faPlus,
    faPrint,
    faRulerCombined,
    faTrash,
    faWandMagicSparkles
} from '@fortawesome/free-solid-svg-icons';
import Swal from 'sweetalert2';
import {
    DEFAULT_DRAWING_ESTIMATE_SETTINGS,
    DIFFICULTY_LABELS,
    DifficultyGrade,
    DrawingAdditionalItem,
    DrawingAnalysisResult,
    DrawingEstimateBucketTotals,
    DrawingEstimateLine,
    DrawingEstimateSettings,
    DrawingEstimateUnit,
    EstimateBucket,
    ScaffoldZone,
    ShoringZone,
    drawingEstimateService
} from '../../services/drawingEstimateService';
import { estimateService, EstimateItem } from '../../services/estimateService';

type UploadedFileState = {
    id: string;
    file: File;
    status: 'ready' | 'unsupported';
};

type ProjectForm = {
    projectName: string;
    clientCompany: string;
    clientName: string;
    clientContact: string;
};

type RateKey = keyof DrawingEstimateSettings['rates'];

const formatMoney = (value: number): string => new Intl.NumberFormat('ko-KR').format(Math.round(value || 0));
const formatNumber = (value: number, digits = 1): string => Number(value || 0).toLocaleString('ko-KR', {
    maximumFractionDigits: digits
});

const makeId = (prefix: string): string => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const isGeminiSupportedFile = (file: File): boolean => {
    const name = file.name.toLowerCase();
    return Boolean(file.type.startsWith('image/')) || file.type === 'application/pdf' || /\.(pdf|png|jpe?g|webp)$/i.test(name);
};

const confidenceLabel = (confidence: number): string => {
    if (confidence >= 0.85) return '높음';
    if (confidence >= 0.7) return '보통';
    return '검토필요';
};

const confidenceClass = (confidence: number): string => {
    if (confidence >= 0.85) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (confidence >= 0.7) return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-rose-50 text-rose-700 border-rose-200';
};

const unitLabel = (unit: DrawingEstimateUnit): string => {
    if (unit === 'm2') return 'm2';
    if (unit === 'm3') return 'm3';
    if (unit === 'm') return 'm';
    if (unit === 'set') return 'set';
    if (unit === 'day') return '일';
    return '개';
};

const bucketLabel = (bucket: EstimateBucket | 'combined'): string => {
    if (bucket === 'construction') return '시공 견적';
    if (bucket === 'rental') return '자재임대 견적';
    return '통합 견적';
};

const defaultScaffoldZone = (): ScaffoldZone => ({
    id: makeId('scaffold'),
    name: '외부 시스템비계',
    location: '',
    lengthM: 0,
    heightM: 0,
    areaM2: 0,
    bayCount: 0,
    pointCount: 0,
    boardAreaM2: 0,
    stairTowerCount: 0,
    bracketCount: 0,
    safetyNetM2: 0,
    toeBoardM: 0,
    guardrailM: 0,
    baseJackCount: 0,
    wallTieCount: 0,
    openingDeductionM2: 0,
    protectiveNet: true,
    installDifficulty: 'normal',
    dismantleDifficulty: 'normal',
    difficultyReason: '',
    evidence: '수동 입력',
    confidence: 1,
    needsReview: false
});

const defaultShoringZone = (): ShoringZone => ({
    id: makeId('shoring'),
    name: '슬래브 시스템동바리',
    floor: '',
    slabAreaM2: 0,
    supportHeightM: 0,
    volumeM3: 0,
    spacingM: 0.8,
    postCount: 0,
    baseJackCount: 0,
    uHeadJackCount: 0,
    beamLengthM: 0,
    ledgerLengthM: 0,
    braceLengthM: 0,
    installDifficulty: 'normal',
    dismantleDifficulty: 'normal',
    difficultyReason: '',
    evidence: '수동 입력',
    confidence: 1,
    needsReview: false
});

const defaultAdditionalItem = (): DrawingAdditionalItem => ({
    id: makeId('extra'),
    bucket: 'rental',
    workType: 'common',
    label: '추가항목',
    quantity: 1,
    unit: 'ea',
    unitPrice: 0,
    evidence: '수동 입력',
    confidence: 1,
    needsReview: false
});

const buildDemoAnalysis = (): DrawingAnalysisResult => ({
    projectName: '샘플 물류센터',
    scaleText: '1/100, 일부 치수 직접 표기',
    buildingSummary: '외부 2개 면 시스템비계와 2층 슬래브 일부 시스템동바리 산출 예시입니다.',
    detectedDrawingTypes: ['평면도', '입면도', '구조 평면도', '가설 특기사항'],
    drawingFacts: [
        {
            id: makeId('fact'),
            label: '건물 최고 높이',
            value: '18m',
            evidence: '입면도 A-201',
            confidence: 0.9
        },
        {
            id: makeId('fact'),
            label: '동바리 설치층',
            value: '2F, 층고 4.2m',
            evidence: '구조평면도 S-102',
            confidence: 0.82
        }
    ],
    scaffoldZones: [
        {
            ...defaultScaffoldZone(),
            id: makeId('scaffold'),
            name: '남측 외부비계',
            location: '남측 입면',
            lengthM: 42.5,
            heightM: 18,
            areaM2: 765,
            bayCount: 24,
            pointCount: 275,
            boardAreaM2: 185,
            stairTowerCount: 1,
            bracketCount: 32,
            safetyNetM2: 765,
            toeBoardM: 255,
            guardrailM: 255,
            baseJackCount: 275,
            wallTieCount: 42,
            installDifficulty: 'hard',
            dismantleDifficulty: 'normal',
            difficultyReason: '남측 차량 동선과 일부 브라켓 구간',
            evidence: '입면도 A-201 남측 길이 42.5m, 높이 18m, 가설특기사항 안전망 포함',
            confidence: 0.88
        },
        {
            ...defaultScaffoldZone(),
            id: makeId('scaffold'),
            name: '동측 외부비계',
            location: '동측 입면',
            lengthM: 28,
            heightM: 12,
            areaM2: 336,
            bayCount: 16,
            pointCount: 119,
            boardAreaM2: 82,
            stairTowerCount: 0,
            bracketCount: 12,
            safetyNetM2: 336,
            toeBoardM: 112,
            guardrailM: 112,
            baseJackCount: 119,
            wallTieCount: 18,
            evidence: '입면도 A-202 동측 길이 28m, 높이 12m',
            confidence: 0.82
        }
    ],
    shoringZones: [
        {
            ...defaultShoringZone(),
            id: makeId('shoring'),
            name: '2F 램프 슬래브',
            floor: '2F',
            slabAreaM2: 320,
            supportHeightM: 4.2,
            volumeM3: 1344,
            spacingM: 0.6,
            postCount: 890,
            baseJackCount: 890,
            uHeadJackCount: 890,
            beamLengthM: 640,
            ledgerLengthM: 580,
            braceLengthM: 210,
            installDifficulty: 'hard',
            dismantleDifficulty: 'normal',
            difficultyReason: '0.6m 촘촘한 배치와 램프 형상',
            evidence: '구조평면도 S-102 슬래브 면적 320m2, 층고 4.2m, 동바리 간격 0.6m',
            confidence: 0.79
        }
    ],
    additionalItems: [
        {
            ...defaultAdditionalItem(),
            id: makeId('extra'),
            bucket: 'construction',
            workType: 'scaffold',
            label: '개구부 주변 보강 설치',
            quantity: 1,
            unit: 'set',
            unitPrice: 450000,
            evidence: 'A-201 개구부 집중 구간',
            confidence: 0.72,
            needsReview: true
        }
    ],
    assumptions: [
        '비계공 일당 하나로 설치/해체 노무비를 계산했습니다.',
        '자재임대는 기본재와 발판, 계단, 브라켓, 안전망, 잭류를 별도 라인으로 분리했습니다.'
    ],
    missingInformation: ['실제 반입 거리, 야적장 위치, 장비 사용 여부는 현장 확인 필요']
});

const numericInputClass = 'w-24 rounded-md border border-slate-200 px-2 py-1.5 text-right text-sm focus:border-blue-500 focus:outline-none';
const textInputClass = 'w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none';

const constructionRateFields: Array<{ key: RateKey; label: string; suffix: string }> = [
    { key: 'scaffoldWorkerDaily', label: '비계공 일당', suffix: '원/일' },
    { key: 'scaffoldInstallM2PerDay', label: '비계 설치 생산성', suffix: 'm2/일' },
    { key: 'scaffoldDismantleM2PerDay', label: '비계 해체 생산성', suffix: 'm2/일' },
    { key: 'shoringInstallM3PerDay', label: '동바리 설치 생산성', suffix: 'm3/일' },
    { key: 'shoringDismantleM3PerDay', label: '동바리 해체 생산성', suffix: 'm3/일' },
    { key: 'boardInstallM2PerDay', label: '발판 생산성', suffix: 'm2/일' },
    { key: 'safetyNetInstallM2PerDay', label: '안전망 생산성', suffix: 'm2/일' },
    { key: 'stairTowerInstallEachPerDay', label: '계단타워 생산성', suffix: '개/일' },
    { key: 'bracketInstallEachPerDay', label: '브라켓 생산성', suffix: '개/일' }
];

const rentalRateFields: Array<{ key: RateKey; label: string; suffix: string }> = [
    { key: 'scaffoldRentalRateM2Month', label: '비계 기본재', suffix: '원/m2/월' },
    { key: 'shoringRentalRateM3Month', label: '동바리 기본재', suffix: '원/m3/월' },
    { key: 'boardRentalRateM2Month', label: '발판', suffix: '원/m2/월' },
    { key: 'safetyNetRentalRateM2Month', label: '안전망', suffix: '원/m2/월' },
    { key: 'stairTowerRentalRateEachMonth', label: '계단타워', suffix: '원/개/월' },
    { key: 'bracketRentalRateEachMonth', label: '브라켓', suffix: '원/개/월' },
    { key: 'toeBoardRentalRateMMonth', label: '폭목', suffix: '원/m/월' },
    { key: 'guardrailRentalRateMMonth', label: '난간대', suffix: '원/m/월' },
    { key: 'baseJackRentalRateEachMonth', label: '베이스잭', suffix: '원/개/월' },
    { key: 'wallTieRentalRateEachMonth', label: '벽이음', suffix: '원/개/월' },
    { key: 'shoringPostRentalRateEachMonth', label: '동바리 포스트', suffix: '원/개/월' },
    { key: 'shoringJackRentalRateEachMonth', label: '동바리 잭류', suffix: '원/개/월' },
    { key: 'shoringBeamRentalRateMMonth', label: '멍에재', suffix: '원/m/월' },
    { key: 'shoringLedgerRentalRateMMonth', label: '장선재', suffix: '원/m/월' },
    { key: 'shoringBraceRentalRateMMonth', label: '가새재', suffix: '원/m/월' },
    { key: 'scaffoldTransportRateM2', label: '비계 운반', suffix: '원/m2' },
    { key: 'shoringTransportRateM3', label: '동바리 운반', suffix: '원/m3' }
];

const DrawingAiEstimatePage: React.FC = () => {
    const [project, setProject] = useState<ProjectForm>({
        projectName: '',
        clientCompany: '',
        clientName: '',
        clientContact: ''
    });
    const [files, setFiles] = useState<UploadedFileState[]>([]);
    const [analysis, setAnalysis] = useState<DrawingAnalysisResult | null>(null);
    const [scaffoldZones, setScaffoldZones] = useState<ScaffoldZone[]>([]);
    const [shoringZones, setShoringZones] = useState<ShoringZone[]>([]);
    const [additionalItems, setAdditionalItems] = useState<DrawingAdditionalItem[]>([]);
    const [settings, setSettings] = useState<DrawingEstimateSettings>(DEFAULT_DRAWING_ESTIMATE_SETTINGS);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [savingBucket, setSavingBucket] = useState<EstimateBucket | 'combined' | null>(null);

    const calculation = useMemo(
        () => drawingEstimateService.calculate(scaffoldZones, shoringZones, additionalItems, settings),
        [scaffoldZones, shoringZones, additionalItems, settings]
    );

    const supportedFiles = useMemo(() => files.filter((item) => item.status === 'ready').map((item) => item.file), [files]);
    const reviewCount = useMemo(
        () =>
            scaffoldZones.filter((zone) => zone.needsReview).length +
            shoringZones.filter((zone) => zone.needsReview).length +
            additionalItems.filter((item) => item.needsReview).length +
            (analysis?.drawingFacts.filter((fact) => fact.needsReview).length || 0) +
            calculation.warnings.length,
        [scaffoldZones, shoringZones, additionalItems, analysis, calculation.warnings]
    );
    const avgConfidence = useMemo(() => {
        const values = [
            ...scaffoldZones.map((zone) => zone.confidence),
            ...shoringZones.map((zone) => zone.confidence),
            ...additionalItems.map((item) => item.confidence)
        ];
        if (values.length === 0) return 0;
        return values.reduce((sum, value) => sum + value, 0) / values.length;
    }, [scaffoldZones, shoringZones, additionalItems]);

    const handleFiles = (fileList: FileList | null) => {
        if (!fileList) return;
        const next = Array.from(fileList).map((file) => ({
            id: makeId('file'),
            file,
            status: isGeminiSupportedFile(file) ? 'ready' as const : 'unsupported' as const
        }));
        setFiles((prev) => [...prev, ...next]);
    };

    const removeFile = (id: string) => {
        setFiles((prev) => prev.filter((item) => item.id !== id));
    };

    const applyAnalysis = (result: DrawingAnalysisResult) => {
        setAnalysis(result);
        setScaffoldZones(result.scaffoldZones);
        setShoringZones(result.shoringZones);
        setAdditionalItems(result.additionalItems);
        setProject((prev) => ({
            ...prev,
            projectName: prev.projectName || result.projectName
        }));
    };

    const handleAnalyze = async () => {
        if (supportedFiles.length === 0) {
            Swal.fire('도면 파일 필요', 'Gemini가 직접 읽을 수 있는 PDF/이미지 파일을 업로드해 주세요.', 'warning');
            return;
        }

        setIsAnalyzing(true);
        try {
            const result = await drawingEstimateService.analyzeDrawingFiles(supportedFiles, project.projectName);
            applyAnalysis(result);
            Swal.fire('분석 완료', '도면에서 시공/임대 분리 산출 정보를 추출했습니다. 검토 필요 항목을 확인해 주세요.', 'success');
        } catch (error) {
            console.error(error);
            Swal.fire('분석 실패', error instanceof Error ? error.message : 'Gemini 도면 분석 중 오류가 발생했습니다.', 'error');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const updateSettings = <K extends keyof DrawingEstimateSettings>(field: K, value: DrawingEstimateSettings[K]) => {
        setSettings((prev) => ({ ...prev, [field]: value }));
    };

    const updateRate = (field: RateKey, value: number) => {
        setSettings((prev) => ({
            ...prev,
            rates: {
                ...prev.rates,
                [field]: value
            }
        }));
    };

    const updateScaffoldZone = (id: string, patch: Partial<ScaffoldZone>) => {
        setScaffoldZones((prev) => prev.map((zone) => {
            if (zone.id !== id) return zone;
            const next = { ...zone, ...patch };
            const changedDims = patch.lengthM !== undefined || patch.heightM !== undefined || patch.openingDeductionM2 !== undefined;
            const areaM2 = changedDims ? Math.max(0, next.lengthM * next.heightM - next.openingDeductionM2) : next.areaM2;
            return {
                ...next,
                areaM2: Number(areaM2.toFixed(2)),
                needsReview: areaM2 <= 0 || next.heightM <= 0 || next.confidence < 0.7 || next.pointCount <= 0
            };
        }));
    };

    const updateShoringZone = (id: string, patch: Partial<ShoringZone>) => {
        setShoringZones((prev) => prev.map((zone) => {
            if (zone.id !== id) return zone;
            const next = { ...zone, ...patch };
            const changedDims = patch.slabAreaM2 !== undefined || patch.supportHeightM !== undefined;
            const volumeM3 = changedDims ? next.slabAreaM2 * next.supportHeightM : next.volumeM3;
            return {
                ...next,
                volumeM3: Number(volumeM3.toFixed(2)),
                needsReview: volumeM3 <= 0 || next.supportHeightM <= 0 || next.spacingM <= 0 || next.confidence < 0.7 || next.postCount <= 0
            };
        }));
    };

    const updateAdditionalItem = (id: string, patch: Partial<DrawingAdditionalItem>) => {
        setAdditionalItems((prev) => prev.map((item) => {
            if (item.id !== id) return item;
            const next = { ...item, ...patch };
            return {
                ...next,
                needsReview: next.quantity <= 0 || next.unitPrice <= 0 || next.confidence < 0.7
            };
        }));
    };

    const deleteScaffoldZone = (id: string) => setScaffoldZones((prev) => prev.filter((zone) => zone.id !== id));
    const deleteShoringZone = (id: string) => setShoringZones((prev) => prev.filter((zone) => zone.id !== id));
    const deleteAdditionalItem = (id: string) => setAdditionalItems((prev) => prev.filter((item) => item.id !== id));

    const getLinesForBucket = (bucket: EstimateBucket | 'combined'): DrawingEstimateLine[] => {
        if (bucket === 'construction') return calculation.constructionLines;
        if (bucket === 'rental') return calculation.rentalLines;
        return calculation.allLines;
    };

    const getTotalsForBucket = (bucket: EstimateBucket | 'combined'): DrawingEstimateBucketTotals => {
        if (bucket === 'construction') return calculation.totals.construction;
        if (bucket === 'rental') return calculation.totals.rental;
        return calculation.totals.combined;
    };

    const buildEstimateItems = (bucket: EstimateBucket | 'combined'): EstimateItem[] => {
        const lines = getLinesForBucket(bucket);
        const totals = getTotalsForBucket(bucket);
        const items: EstimateItem[] = lines.map((line) => ({
            id: `drawing-${line.id}`,
            category: line.bucket === 'construction' ? '시공' : '자재임대',
            section: line.zoneName,
            label: line.label,
            description: `${line.standardBasis} / ${line.productivityText}`,
            workType: line.workType,
            unit: unitLabel(line.unit),
            quantity: line.quantity,
            finalUnitPrice: line.unitPrice,
            unitPrice: line.unitPrice,
            amount: line.amount,
            laborUnitPrice: line.quantity > 0 ? Math.round(line.laborCost / line.quantity) : 0,
            rentalUnitPrice: line.quantity > 0 ? Math.round((line.rentalCost + line.transportCost) / line.quantity) : 0,
            period: settings.rentalMonths,
            note: `노무 ${formatMoney(line.laborCost)} / 임대 ${formatMoney(line.rentalCost)} / 운반 ${formatMoney(line.transportCost)} / 근거 ${line.evidence}`,
            pointBase: 0,
            pointMultiplier: 0
        }));

        if (totals.overhead > 0) {
            items.push({
                id: `drawing-overhead-${bucket}-${Date.now()}`,
                category: '간접비',
                section: '일반관리비',
                label: bucket === 'rental' ? `임대 일반관리비 ${settings.rentalOverheadPct}%` : `시공 일반관리비 ${settings.constructionOverheadPct}%`,
                unit: '식',
                quantity: 1,
                finalUnitPrice: totals.overhead,
                unitPrice: totals.overhead,
                amount: totals.overhead,
                pointBase: 0,
                pointMultiplier: 0
            });
        }

        if (totals.profit > 0) {
            items.push({
                id: `drawing-profit-${bucket}-${Date.now()}`,
                category: '간접비',
                section: '이윤',
                label: bucket === 'rental' ? `임대 이윤 ${settings.rentalProfitPct}%` : `시공 이윤 ${settings.constructionProfitPct}%`,
                unit: '식',
                quantity: 1,
                finalUnitPrice: totals.profit,
                unitPrice: totals.profit,
                amount: totals.profit,
                pointBase: 0,
                pointMultiplier: 0
            });
        }

        return items;
    };

    const buildScopeNotes = (bucket: EstimateBucket | 'combined'): string => [
        `도면 AI 견적 페이지에서 생성한 ${bucketLabel(bucket)}입니다.`,
        '시공 견적은 비계공 일당 하나와 설치/해체 생산성, 난이도 계수로 계산했습니다.',
        '자재임대 견적은 기본재와 발판, 계단, 브라켓, 안전망, 잭류, 운반비를 별도 라인으로 분리했습니다.',
        'AI 추출 수량은 도면 해상도, 축척, 치수 표기, 특기사항 누락 여부에 따라 현장 검토 후 확정해야 합니다.',
        ...(analysis?.assumptions || []),
        ...(analysis?.missingInformation || []).map((item) => `검토필요: ${item}`)
    ].join('\n');

    const handleSaveEstimate = async (bucket: EstimateBucket | 'combined') => {
        const lines = getLinesForBucket(bucket);
        if (lines.length === 0) {
            Swal.fire('저장할 산출 없음', `${bucketLabel(bucket)}에 저장할 산출 라인이 없습니다.`, 'warning');
            return;
        }

        setSavingBucket(bucket);
        try {
            const totals = getTotalsForBucket(bucket);
            const subtotal = totals.directCost + totals.overhead + totals.profit;
            const id = await estimateService.addEstimate({
                documentType: 'estimate',
                templateType: 'detailed',
                estimateNo: `DWG-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Date.now()).slice(-4)}`,
                title: `${project.projectName || '도면 기반'} ${bucketLabel(bucket)}`,
                projectName: project.projectName,
                clientName: project.clientName || project.clientCompany || '미지정',
                clientCompany: project.clientCompany,
                clientContact: project.clientContact,
                requestType: 'construction',
                status: 'draft',
                issueDate: new Date().toISOString().slice(0, 10),
                items: buildEstimateItems(bucket),
                subtotal,
                discount: totals.discount,
                tax: totals.vat,
                vatRate: settings.vatRate,
                includeVat: settings.includeVat,
                total: totals.total,
                paymentTerms: '협의 후 확정',
                scopeNotes: buildScopeNotes(bucket),
                notes: '도면 기반 AI 산출 견적',
                installRatio: 50,
                estimateMode: bucket === 'construction' ? 'standard' : 'rental'
            });

            Swal.fire('견적 저장 완료', `${bucketLabel(bucket)}이 견적 관리에 저장되었습니다. 문서 ID: ${id}`, 'success');
        } catch (error) {
            console.error(error);
            Swal.fire('저장 실패', error instanceof Error ? error.message : '견적 저장 중 오류가 발생했습니다.', 'error');
        } finally {
            setSavingBucket(null);
        }
    };

    const handleDownloadCsv = () => {
        const headers = ['견적구분', '공종', '구간', '품명', '기준', '수량', '단위', '공수', '노무비', '임대료', '운반비', '금액', '근거'];
        const rows = calculation.allLines.map((line) => [
            bucketLabel(line.bucket),
            line.workType === 'scaffold' ? '시스템비계' : line.workType === 'shoring' ? '시스템동바리' : '공통',
            line.zoneName,
            line.label,
            line.standardBasis,
            String(line.quantity),
            unitLabel(line.unit),
            String(line.manDays),
            String(line.laborCost),
            String(line.rentalCost),
            String(line.transportCost),
            String(line.amount),
            line.evidence
        ]);
        rows.push(['시공 합계', '', '', '', '', '', '', '', '', '', '', String(calculation.totals.construction.total), 'VAT 포함']);
        rows.push(['임대 합계', '', '', '', '', '', '', '', '', '', '', String(calculation.totals.rental.total), 'VAT 포함']);
        rows.push(['통합 합계', '', '', '', '', '', '', '', '', '', '', String(calculation.totals.combined.total), 'VAT 포함']);

        const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
        const csv = [headers, ...rows].map((row) => row.map(escape).join(',')).join('\n');
        const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `${project.projectName || 'drawing-estimate'}-시공-임대-분리견적.csv`;
        anchor.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900">
            <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8 print:px-0">
                <header className="mb-4 flex flex-col gap-3 border-b border-slate-200 pb-4 print:hidden lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            <FontAwesomeIcon icon={faHelmetSafety} className="text-emerald-600" />
                            시스템동바리 · 시스템비계
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-950">도면 AI 시공/자재임대 분리 견적</h1>
                        <p className="mt-1 text-sm text-slate-600">
                            도면에서 수량을 추출하고 시공 견적과 자재임대 견적을 별도 산출합니다. 노무비는 비계공 일당만 사용합니다.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Link to="/estimate/manage" className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                            <FontAwesomeIcon icon={faArrowLeft} className="mr-2" />
                            견적 관리
                        </Link>
                        <button type="button" onClick={handleDownloadCsv} className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                            <FontAwesomeIcon icon={faDownload} className="mr-2" />
                            CSV
                        </button>
                        <button type="button" onClick={() => window.print()} className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                            <FontAwesomeIcon icon={faPrint} className="mr-2" />
                            인쇄
                        </button>
                        <button type="button" onClick={() => handleSaveEstimate('construction')} disabled={Boolean(savingBucket)} className="inline-flex items-center rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60">
                            <FontAwesomeIcon icon={faFloppyDisk} className="mr-2" />
                            {savingBucket === 'construction' ? '저장 중' : '시공 저장'}
                        </button>
                        <button type="button" onClick={() => handleSaveEstimate('rental')} disabled={Boolean(savingBucket)} className="inline-flex items-center rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60">
                            <FontAwesomeIcon icon={faFloppyDisk} className="mr-2" />
                            {savingBucket === 'rental' ? '저장 중' : '임대 저장'}
                        </button>
                        <button type="button" onClick={() => handleSaveEstimate('combined')} disabled={Boolean(savingBucket)} className="inline-flex items-center rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
                            <FontAwesomeIcon icon={faFloppyDisk} className="mr-2" />
                            {savingBucket === 'combined' ? '저장 중' : '통합 저장'}
                        </button>
                    </div>
                </header>

                <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
                    <aside className="space-y-4 print:hidden">
                        <section className="rounded-lg border border-slate-200 bg-white p-4">
                            <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-900">
                                <FontAwesomeIcon icon={faFileArrowUp} className="text-blue-600" />
                                도면 업로드
                            </h2>
                            <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center hover:border-blue-400 hover:bg-blue-50">
                                <FontAwesomeIcon icon={faWandMagicSparkles} className="mb-3 text-2xl text-blue-600" />
                                <span className="text-sm font-semibold text-slate-800">PDF/이미지 도면 선택</span>
                                <span className="mt-1 text-xs text-slate-500">DWG/DXF는 PDF 또는 이미지 변환 후 분석</span>
                                <input type="file" className="hidden" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,image/*,application/pdf" onChange={(event) => handleFiles(event.target.files)} />
                            </label>
                            <div className="mt-3 space-y-2">
                                {files.map((item) => (
                                    <div key={item.id} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-xs">
                                        <div className="min-w-0">
                                            <div className="truncate font-semibold text-slate-800">{item.file.name}</div>
                                            <div className={item.status === 'ready' ? 'text-emerald-600' : 'text-amber-600'}>
                                                {item.status === 'ready' ? 'Gemini 분석 가능' : '변환 필요'}
                                            </div>
                                        </div>
                                        <button type="button" onClick={() => removeFile(item.id)} className="ml-2 rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                                            <FontAwesomeIcon icon={faTrash} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-2">
                                <button type="button" onClick={handleAnalyze} disabled={isAnalyzing} className="inline-flex items-center justify-center rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60">
                                    <FontAwesomeIcon icon={faCalculator} className="mr-2" />
                                    {isAnalyzing ? '분석 중' : 'Gemini 분석'}
                                </button>
                                <button type="button" onClick={() => applyAnalysis(buildDemoAnalysis())} className="inline-flex items-center justify-center rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                                    샘플 적용
                                </button>
                            </div>
                        </section>

                        <section className="rounded-lg border border-slate-200 bg-white p-4">
                            <h2 className="mb-3 text-base font-bold text-slate-900">프로젝트 정보</h2>
                            <div className="space-y-3 text-sm">
                                <label className="block font-semibold text-slate-500">현장명<input className={`${textInputClass} mt-1`} value={project.projectName} onChange={(event) => setProject((prev) => ({ ...prev, projectName: event.target.value }))} /></label>
                                <label className="block font-semibold text-slate-500">거래처<input className={`${textInputClass} mt-1`} value={project.clientCompany} onChange={(event) => setProject((prev) => ({ ...prev, clientCompany: event.target.value }))} /></label>
                                <label className="block font-semibold text-slate-500">담당자<input className={`${textInputClass} mt-1`} value={project.clientName} onChange={(event) => setProject((prev) => ({ ...prev, clientName: event.target.value }))} /></label>
                                <label className="block font-semibold text-slate-500">연락처<input className={`${textInputClass} mt-1`} value={project.clientContact} onChange={(event) => setProject((prev) => ({ ...prev, clientContact: event.target.value }))} /></label>
                            </div>
                        </section>

                        <section className="rounded-lg border border-slate-200 bg-white p-4">
                            <h2 className="mb-3 text-base font-bold text-slate-900">견적 조건</h2>
                            <div className="grid grid-cols-2 gap-3 text-xs">
                                <label className="font-semibold text-slate-500">임대 개월<input className={`${numericInputClass} mt-1 w-full`} type="number" value={settings.rentalMonths} onChange={(event) => updateSettings('rentalMonths', Number(event.target.value))} /></label>
                                <label className="font-semibold text-slate-500">VAT %<input className={`${numericInputClass} mt-1 w-full`} type="number" value={settings.vatRate} onChange={(event) => updateSettings('vatRate', Number(event.target.value))} /></label>
                                <label className="font-semibold text-slate-500">시공 일반관리 %<input className={`${numericInputClass} mt-1 w-full`} type="number" value={settings.constructionOverheadPct} onChange={(event) => updateSettings('constructionOverheadPct', Number(event.target.value))} /></label>
                                <label className="font-semibold text-slate-500">시공 이윤 %<input className={`${numericInputClass} mt-1 w-full`} type="number" value={settings.constructionProfitPct} onChange={(event) => updateSettings('constructionProfitPct', Number(event.target.value))} /></label>
                                <label className="font-semibold text-slate-500">임대 일반관리 %<input className={`${numericInputClass} mt-1 w-full`} type="number" value={settings.rentalOverheadPct} onChange={(event) => updateSettings('rentalOverheadPct', Number(event.target.value))} /></label>
                                <label className="font-semibold text-slate-500">임대 이윤 %<input className={`${numericInputClass} mt-1 w-full`} type="number" value={settings.rentalProfitPct} onChange={(event) => updateSettings('rentalProfitPct', Number(event.target.value))} /></label>
                                <label className="font-semibold text-slate-500">시공 할인<input className={`${numericInputClass} mt-1 w-full`} type="number" value={settings.constructionDiscount} onChange={(event) => updateSettings('constructionDiscount', Number(event.target.value))} /></label>
                                <label className="font-semibold text-slate-500">임대 할인<input className={`${numericInputClass} mt-1 w-full`} type="number" value={settings.rentalDiscount} onChange={(event) => updateSettings('rentalDiscount', Number(event.target.value))} /></label>
                            </div>
                            <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-600">
                                <input type="checkbox" checked={settings.includeVat} onChange={(event) => updateSettings('includeVat', event.target.checked)} />
                                VAT 포함
                            </label>
                        </section>

                        <RateSection title="시공 단가" fields={constructionRateFields} settings={settings} onChange={updateRate} />
                        <RateSection title="자재임대 단가" fields={rentalRateFields} settings={settings} onChange={updateRate} />
                    </aside>

                    <main className="space-y-4">
                        <section className="grid gap-3 md:grid-cols-4">
                            <TotalsCard title="시공 견적" value={calculation.totals.construction.total} tone="blue" />
                            <TotalsCard title="자재임대 견적" value={calculation.totals.rental.total} tone="emerald" />
                            <TotalsCard title="통합 합계" value={calculation.totals.combined.total} tone="slate" />
                            <div className="rounded-lg border border-slate-200 bg-white p-4">
                                <div className="text-xs font-semibold text-slate-500">검토 필요</div>
                                <div className="mt-2 text-2xl font-bold text-amber-700">{reviewCount}</div>
                                <div className="mt-1 text-xs text-slate-500">평균 신뢰도 {avgConfidence ? `${Math.round(avgConfidence * 100)}% · ${confidenceLabel(avgConfidence)}` : '분석 전'}</div>
                            </div>
                        </section>

                        <section className="rounded-lg border border-slate-200 bg-white p-4">
                            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
                                        <FontAwesomeIcon icon={faRulerCombined} className="text-blue-600" />
                                        AI 도면 분석 결과
                                    </h2>
                                    <p className="mt-1 text-xs text-slate-500">도면에서 가져온 기본 정보와 산출 근거입니다.</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {(analysis?.detectedDrawingTypes || []).map((item) => (
                                        <span key={item} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600">{item}</span>
                                    ))}
                                </div>
                            </div>
                            {analysis ? (
                                <div className="space-y-3">
                                    <div className="grid gap-3 lg:grid-cols-3">
                                        <InfoBlock label="축척" value={analysis.scaleText || '미확인'} />
                                        <div className="lg:col-span-2">
                                            <InfoBlock label="건물/도면 요약" value={analysis.buildingSummary || '요약 없음'} />
                                        </div>
                                    </div>
                                    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                                        {analysis.drawingFacts.map((fact) => (
                                            <div key={fact.id} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="text-xs font-semibold text-slate-500">{fact.label}</div>
                                                    <span className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${confidenceClass(fact.confidence)}`}>{Math.round(fact.confidence * 100)}%</span>
                                                </div>
                                                <div className="mt-1 text-sm font-bold text-slate-900">{fact.value || '미확인'}</div>
                                                <div className="mt-1 text-xs text-slate-500">{fact.evidence}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                                    도면을 업로드하고 Gemini 분석을 실행하면 축척, 층고, 외곽 길이, 발판, 계단, 브라켓, 안전망, 동바리 간격 같은 산출 정보가 표시됩니다.
                                </div>
                            )}
                            {(analysis?.missingInformation?.length || calculation.warnings.length) ? (
                                <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3">
                                    <div className="mb-1 flex items-center gap-2 text-sm font-bold text-amber-800">
                                        <FontAwesomeIcon icon={faExclamationTriangle} />
                                        검토 필요
                                    </div>
                                    <div className="grid gap-1 text-xs text-amber-800">
                                        {[...(analysis?.missingInformation || []), ...calculation.warnings].map((item, index) => (
                                            <div key={`${item}-${index}`}>· {item}</div>
                                        ))}
                                    </div>
                                </div>
                            ) : null}
                        </section>

                        <ScaffoldTable
                            zones={scaffoldZones}
                            onAdd={() => setScaffoldZones((prev) => [...prev, defaultScaffoldZone()])}
                            onChange={updateScaffoldZone}
                            onDelete={deleteScaffoldZone}
                        />

                        <ShoringTable
                            zones={shoringZones}
                            onAdd={() => setShoringZones((prev) => [...prev, defaultShoringZone()])}
                            onChange={updateShoringZone}
                            onDelete={deleteShoringZone}
                        />

                        <AdditionalItemsTable
                            items={additionalItems}
                            onAdd={() => setAdditionalItems((prev) => [...prev, defaultAdditionalItem()])}
                            onChange={updateAdditionalItem}
                            onDelete={deleteAdditionalItem}
                        />

                        <EstimateLinesTable title="시공 견적 산출 내역" lines={calculation.constructionLines} totals={calculation.totals.construction} />
                        <EstimateLinesTable title="자재임대 견적 산출 내역" lines={calculation.rentalLines} totals={calculation.totals.rental} />

                        <section className="rounded-lg border border-slate-200 bg-white p-4 print:hidden">
                            <h2 className="mb-2 text-base font-bold text-slate-900">통합메뉴 등록 정보</h2>
                            <div className="grid gap-2 text-sm md:grid-cols-2">
                                <div className="rounded-md bg-slate-50 p-3">
                                    <div className="text-xs font-semibold text-slate-500">메뉴명</div>
                                    <div className="mt-1 font-mono text-slate-900">도면 AI 견적</div>
                                </div>
                                <div className="rounded-md bg-slate-50 p-3">
                                    <div className="text-xs font-semibold text-slate-500">경로</div>
                                    <div className="mt-1 font-mono text-slate-900">/estimate/drawing-ai</div>
                                </div>
                            </div>
                        </section>
                    </main>
                </div>
            </div>
        </div>
    );
};

interface RateSectionProps {
    title: string;
    fields: Array<{ key: RateKey; label: string; suffix: string }>;
    settings: DrawingEstimateSettings;
    onChange: (key: RateKey, value: number) => void;
}

const RateSection: React.FC<RateSectionProps> = ({ title, fields, settings, onChange }) => (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-base font-bold text-slate-900">{title}</h2>
        <div className="grid gap-2 text-xs">
            {fields.map((field) => (
                <label key={field.key} className="grid grid-cols-[1fr_120px] items-center gap-2 font-semibold text-slate-500">
                    <span>{field.label}<span className="ml-1 font-normal text-slate-400">{field.suffix}</span></span>
                    <input className={numericInputClass} type="number" value={settings.rates[field.key]} onChange={(event) => onChange(field.key, Number(event.target.value))} />
                </label>
            ))}
        </div>
    </section>
);

const InfoBlock: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div>
        <div className="text-xs font-semibold text-slate-500">{label}</div>
        <div className="mt-1 text-sm font-semibold text-slate-800">{value}</div>
    </div>
);

const TotalsCard: React.FC<{ title: string; value: number; tone: 'blue' | 'emerald' | 'slate' }> = ({ title, value, tone }) => {
    const toneClass = tone === 'blue' ? 'text-blue-700' : tone === 'emerald' ? 'text-emerald-700' : 'text-slate-900';
    return (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-xs font-semibold text-slate-500">{title}</div>
            <div className={`mt-2 text-2xl font-bold ${toneClass}`}>{formatMoney(value)}원</div>
            <div className="mt-1 text-xs text-slate-500">VAT 포함 합계</div>
        </div>
    );
};

const DifficultySelect: React.FC<{ value: DifficultyGrade; onChange: (value: DifficultyGrade) => void }> = ({ value, onChange }) => (
    <select className="w-24 rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none" value={value} onChange={(event) => onChange(event.target.value as DifficultyGrade)}>
        {Object.entries(DIFFICULTY_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
        ))}
    </select>
);

interface ScaffoldTableProps {
    zones: ScaffoldZone[];
    onAdd: () => void;
    onChange: (id: string, patch: Partial<ScaffoldZone>) => void;
    onDelete: (id: string) => void;
}

const ScaffoldTable: React.FC<ScaffoldTableProps> = ({ zones, onAdd, onChange, onDelete }) => (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">시스템비계 상세 산출</h2>
            <button type="button" onClick={onAdd} className="inline-flex items-center rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                <FontAwesomeIcon icon={faPlus} className="mr-2" />
                구간 추가
            </button>
        </div>
        <div className="overflow-x-auto">
            <table className="min-w-[1760px] w-full border-collapse text-sm">
                <thead>
                    <tr className="border-y border-slate-200 bg-slate-50 text-xs text-slate-500">
                        <th className="px-2 py-2 text-left">구간</th>
                        <th className="px-2 py-2 text-left">위치</th>
                        <th className="px-2 py-2 text-right">길이</th>
                        <th className="px-2 py-2 text-right">높이</th>
                        <th className="px-2 py-2 text-right">공제</th>
                        <th className="px-2 py-2 text-right">면적</th>
                        <th className="px-2 py-2 text-right">스팬</th>
                        <th className="px-2 py-2 text-right">포인트</th>
                        <th className="px-2 py-2 text-right">발판</th>
                        <th className="px-2 py-2 text-right">계단</th>
                        <th className="px-2 py-2 text-right">브라켓</th>
                        <th className="px-2 py-2 text-right">안전망</th>
                        <th className="px-2 py-2 text-right">폭목</th>
                        <th className="px-2 py-2 text-right">난간</th>
                        <th className="px-2 py-2 text-right">베이스잭</th>
                        <th className="px-2 py-2 text-right">벽이음</th>
                        <th className="px-2 py-2 text-center">설치</th>
                        <th className="px-2 py-2 text-center">해체</th>
                        <th className="px-2 py-2 text-left">난이도 사유</th>
                        <th className="px-2 py-2 text-left">근거</th>
                        <th className="px-2 py-2"></th>
                    </tr>
                </thead>
                <tbody>
                    {zones.map((zone) => (
                        <tr key={zone.id} className="border-b border-slate-100">
                            <td className="px-2 py-2"><input className={textInputClass} value={zone.name} onChange={(event) => onChange(zone.id, { name: event.target.value })} /></td>
                            <td className="px-2 py-2"><input className={textInputClass} value={zone.location} onChange={(event) => onChange(zone.id, { location: event.target.value })} /></td>
                            <NumberCell value={zone.lengthM} onChange={(value) => onChange(zone.id, { lengthM: value })} />
                            <NumberCell value={zone.heightM} onChange={(value) => onChange(zone.id, { heightM: value })} />
                            <NumberCell value={zone.openingDeductionM2} onChange={(value) => onChange(zone.id, { openingDeductionM2: value })} />
                            <NumberCell value={zone.areaM2} onChange={(value) => onChange(zone.id, { areaM2: value })} />
                            <NumberCell value={zone.bayCount} onChange={(value) => onChange(zone.id, { bayCount: value })} />
                            <NumberCell value={zone.pointCount} onChange={(value) => onChange(zone.id, { pointCount: value })} />
                            <NumberCell value={zone.boardAreaM2} onChange={(value) => onChange(zone.id, { boardAreaM2: value })} />
                            <NumberCell value={zone.stairTowerCount} onChange={(value) => onChange(zone.id, { stairTowerCount: value })} />
                            <NumberCell value={zone.bracketCount} onChange={(value) => onChange(zone.id, { bracketCount: value })} />
                            <NumberCell value={zone.safetyNetM2} onChange={(value) => onChange(zone.id, { safetyNetM2: value })} />
                            <NumberCell value={zone.toeBoardM} onChange={(value) => onChange(zone.id, { toeBoardM: value })} />
                            <NumberCell value={zone.guardrailM} onChange={(value) => onChange(zone.id, { guardrailM: value })} />
                            <NumberCell value={zone.baseJackCount} onChange={(value) => onChange(zone.id, { baseJackCount: value })} />
                            <NumberCell value={zone.wallTieCount} onChange={(value) => onChange(zone.id, { wallTieCount: value })} />
                            <td className="px-2 py-2 text-center"><DifficultySelect value={zone.installDifficulty} onChange={(value) => onChange(zone.id, { installDifficulty: value })} /></td>
                            <td className="px-2 py-2 text-center"><DifficultySelect value={zone.dismantleDifficulty} onChange={(value) => onChange(zone.id, { dismantleDifficulty: value })} /></td>
                            <td className="px-2 py-2"><input className={textInputClass} value={zone.difficultyReason} onChange={(event) => onChange(zone.id, { difficultyReason: event.target.value })} /></td>
                            <td className="px-2 py-2"><input className={textInputClass} value={zone.evidence} onChange={(event) => onChange(zone.id, { evidence: event.target.value })} /></td>
                            <td className="px-2 py-2 text-right"><button type="button" onClick={() => onDelete(zone.id)} className="rounded-md p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><FontAwesomeIcon icon={faTrash} /></button></td>
                        </tr>
                    ))}
                    {zones.length === 0 && <tr><td colSpan={21} className="px-2 py-5 text-center text-sm text-slate-500">시스템비계 구간이 없습니다.</td></tr>}
                </tbody>
            </table>
        </div>
    </section>
);

interface ShoringTableProps {
    zones: ShoringZone[];
    onAdd: () => void;
    onChange: (id: string, patch: Partial<ShoringZone>) => void;
    onDelete: (id: string) => void;
}

const ShoringTable: React.FC<ShoringTableProps> = ({ zones, onAdd, onChange, onDelete }) => (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">시스템동바리 상세 산출</h2>
            <button type="button" onClick={onAdd} className="inline-flex items-center rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                <FontAwesomeIcon icon={faPlus} className="mr-2" />
                구간 추가
            </button>
        </div>
        <div className="overflow-x-auto">
            <table className="min-w-[1480px] w-full border-collapse text-sm">
                <thead>
                    <tr className="border-y border-slate-200 bg-slate-50 text-xs text-slate-500">
                        <th className="px-2 py-2 text-left">구간</th>
                        <th className="px-2 py-2 text-left">층</th>
                        <th className="px-2 py-2 text-right">슬래브</th>
                        <th className="px-2 py-2 text-right">높이</th>
                        <th className="px-2 py-2 text-right">체적</th>
                        <th className="px-2 py-2 text-right">간격</th>
                        <th className="px-2 py-2 text-right">포스트</th>
                        <th className="px-2 py-2 text-right">베이스잭</th>
                        <th className="px-2 py-2 text-right">U헤드</th>
                        <th className="px-2 py-2 text-right">멍에 m</th>
                        <th className="px-2 py-2 text-right">장선 m</th>
                        <th className="px-2 py-2 text-right">가새 m</th>
                        <th className="px-2 py-2 text-center">설치</th>
                        <th className="px-2 py-2 text-center">해체</th>
                        <th className="px-2 py-2 text-left">난이도 사유</th>
                        <th className="px-2 py-2 text-left">근거</th>
                        <th className="px-2 py-2"></th>
                    </tr>
                </thead>
                <tbody>
                    {zones.map((zone) => (
                        <tr key={zone.id} className="border-b border-slate-100">
                            <td className="px-2 py-2"><input className={textInputClass} value={zone.name} onChange={(event) => onChange(zone.id, { name: event.target.value })} /></td>
                            <td className="px-2 py-2"><input className="w-20 rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none" value={zone.floor} onChange={(event) => onChange(zone.id, { floor: event.target.value })} /></td>
                            <NumberCell value={zone.slabAreaM2} onChange={(value) => onChange(zone.id, { slabAreaM2: value })} />
                            <NumberCell value={zone.supportHeightM} onChange={(value) => onChange(zone.id, { supportHeightM: value })} />
                            <NumberCell value={zone.volumeM3} onChange={(value) => onChange(zone.id, { volumeM3: value })} />
                            <NumberCell value={zone.spacingM} onChange={(value) => onChange(zone.id, { spacingM: value })} />
                            <NumberCell value={zone.postCount} onChange={(value) => onChange(zone.id, { postCount: value })} />
                            <NumberCell value={zone.baseJackCount} onChange={(value) => onChange(zone.id, { baseJackCount: value })} />
                            <NumberCell value={zone.uHeadJackCount} onChange={(value) => onChange(zone.id, { uHeadJackCount: value })} />
                            <NumberCell value={zone.beamLengthM} onChange={(value) => onChange(zone.id, { beamLengthM: value })} />
                            <NumberCell value={zone.ledgerLengthM} onChange={(value) => onChange(zone.id, { ledgerLengthM: value })} />
                            <NumberCell value={zone.braceLengthM} onChange={(value) => onChange(zone.id, { braceLengthM: value })} />
                            <td className="px-2 py-2 text-center"><DifficultySelect value={zone.installDifficulty} onChange={(value) => onChange(zone.id, { installDifficulty: value })} /></td>
                            <td className="px-2 py-2 text-center"><DifficultySelect value={zone.dismantleDifficulty} onChange={(value) => onChange(zone.id, { dismantleDifficulty: value })} /></td>
                            <td className="px-2 py-2"><input className={textInputClass} value={zone.difficultyReason} onChange={(event) => onChange(zone.id, { difficultyReason: event.target.value })} /></td>
                            <td className="px-2 py-2"><input className={textInputClass} value={zone.evidence} onChange={(event) => onChange(zone.id, { evidence: event.target.value })} /></td>
                            <td className="px-2 py-2 text-right"><button type="button" onClick={() => onDelete(zone.id)} className="rounded-md p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><FontAwesomeIcon icon={faTrash} /></button></td>
                        </tr>
                    ))}
                    {zones.length === 0 && <tr><td colSpan={17} className="px-2 py-5 text-center text-sm text-slate-500">시스템동바리 구간이 없습니다.</td></tr>}
                </tbody>
            </table>
        </div>
    </section>
);

interface AdditionalItemsTableProps {
    items: DrawingAdditionalItem[];
    onAdd: () => void;
    onChange: (id: string, patch: Partial<DrawingAdditionalItem>) => void;
    onDelete: (id: string) => void;
}

const AdditionalItemsTable: React.FC<AdditionalItemsTableProps> = ({ items, onAdd, onChange, onDelete }) => (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">추가항목</h2>
            <button type="button" onClick={onAdd} className="inline-flex items-center rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                <FontAwesomeIcon icon={faPlus} className="mr-2" />
                항목 추가
            </button>
        </div>
        <div className="overflow-x-auto">
            <table className="min-w-[920px] w-full border-collapse text-sm">
                <thead>
                    <tr className="border-y border-slate-200 bg-slate-50 text-xs text-slate-500">
                        <th className="px-2 py-2 text-left">견적구분</th>
                        <th className="px-2 py-2 text-left">공종</th>
                        <th className="px-2 py-2 text-left">항목명</th>
                        <th className="px-2 py-2 text-right">수량</th>
                        <th className="px-2 py-2 text-left">단위</th>
                        <th className="px-2 py-2 text-right">단가</th>
                        <th className="px-2 py-2 text-left">근거</th>
                        <th className="px-2 py-2"></th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item) => (
                        <tr key={item.id} className="border-b border-slate-100">
                            <td className="px-2 py-2">
                                <select className="rounded-md border border-slate-200 px-2 py-1.5 text-sm" value={item.bucket} onChange={(event) => onChange(item.id, { bucket: event.target.value as EstimateBucket })}>
                                    <option value="construction">시공</option>
                                    <option value="rental">자재임대</option>
                                </select>
                            </td>
                            <td className="px-2 py-2">
                                <select className="rounded-md border border-slate-200 px-2 py-1.5 text-sm" value={item.workType} onChange={(event) => onChange(item.id, { workType: event.target.value as DrawingAdditionalItem['workType'] })}>
                                    <option value="scaffold">비계</option>
                                    <option value="shoring">동바리</option>
                                    <option value="common">공통</option>
                                </select>
                            </td>
                            <td className="px-2 py-2"><input className={textInputClass} value={item.label} onChange={(event) => onChange(item.id, { label: event.target.value })} /></td>
                            <NumberCell value={item.quantity} onChange={(value) => onChange(item.id, { quantity: value })} />
                            <td className="px-2 py-2">
                                <select className="rounded-md border border-slate-200 px-2 py-1.5 text-sm" value={item.unit} onChange={(event) => onChange(item.id, { unit: event.target.value as DrawingEstimateUnit })}>
                                    <option value="m2">m2</option>
                                    <option value="m3">m3</option>
                                    <option value="m">m</option>
                                    <option value="ea">개</option>
                                    <option value="set">set</option>
                                    <option value="day">일</option>
                                </select>
                            </td>
                            <NumberCell value={item.unitPrice} onChange={(value) => onChange(item.id, { unitPrice: value })} />
                            <td className="px-2 py-2"><input className={textInputClass} value={item.evidence} onChange={(event) => onChange(item.id, { evidence: event.target.value })} /></td>
                            <td className="px-2 py-2 text-right"><button type="button" onClick={() => onDelete(item.id)} className="rounded-md p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><FontAwesomeIcon icon={faTrash} /></button></td>
                        </tr>
                    ))}
                    {items.length === 0 && <tr><td colSpan={8} className="px-2 py-5 text-center text-sm text-slate-500">추가항목이 없습니다.</td></tr>}
                </tbody>
            </table>
        </div>
    </section>
);

const NumberCell: React.FC<{ value: number; onChange: (value: number) => void }> = ({ value, onChange }) => (
    <td className="px-2 py-2 text-right">
        <input className={numericInputClass} type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </td>
);

const EstimateLinesTable: React.FC<{ title: string; lines: DrawingEstimateLine[]; totals: DrawingEstimateBucketTotals }> = ({ title, lines, totals }) => (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-base font-bold text-slate-900">{title}</h2>
        <div className="overflow-x-auto">
            <table className="min-w-[1240px] w-full border-collapse text-sm">
                <thead>
                    <tr className="border-y border-slate-200 bg-slate-50 text-xs text-slate-500">
                        <th className="px-2 py-2 text-left">품명</th>
                        <th className="px-2 py-2 text-left">기준</th>
                        <th className="px-2 py-2 text-right">수량</th>
                        <th className="px-2 py-2 text-right">단가</th>
                        <th className="px-2 py-2 text-right">공수</th>
                        <th className="px-2 py-2 text-right">노무비</th>
                        <th className="px-2 py-2 text-right">임대료</th>
                        <th className="px-2 py-2 text-right">운반비</th>
                        <th className="px-2 py-2 text-right">금액</th>
                        <th className="px-2 py-2 text-left">생산성/단가</th>
                        <th className="px-2 py-2 text-center">검토</th>
                    </tr>
                </thead>
                <tbody>
                    {lines.map((line) => (
                        <tr key={line.id} className="border-b border-slate-100">
                            <td className="px-2 py-2 font-semibold text-slate-800">{line.label}</td>
                            <td className="px-2 py-2 text-slate-600">{line.standardBasis}</td>
                            <td className="px-2 py-2 text-right">{formatNumber(line.quantity, 2)} {unitLabel(line.unit)}</td>
                            <td className="px-2 py-2 text-right">{formatMoney(line.unitPrice)}</td>
                            <td className="px-2 py-2 text-right">{formatNumber(line.manDays, 3)}</td>
                            <td className="px-2 py-2 text-right">{formatMoney(line.laborCost)}</td>
                            <td className="px-2 py-2 text-right">{formatMoney(line.rentalCost)}</td>
                            <td className="px-2 py-2 text-right">{formatMoney(line.transportCost)}</td>
                            <td className="px-2 py-2 text-right font-bold text-slate-900">{formatMoney(line.amount)}</td>
                            <td className="px-2 py-2 text-xs text-slate-500">{line.productivityText}</td>
                            <td className="px-2 py-2 text-center">
                                {line.needsReview ? (
                                    <FontAwesomeIcon icon={faExclamationTriangle} className="text-amber-500" />
                                ) : (
                                    <FontAwesomeIcon icon={faCheckCircle} className="text-emerald-500" />
                                )}
                            </td>
                        </tr>
                    ))}
                    {lines.length === 0 && <tr><td colSpan={11} className="px-2 py-5 text-center text-sm text-slate-500">산출 내역이 없습니다.</td></tr>}
                </tbody>
            </table>
        </div>
        <div className="mt-4 ml-auto max-w-md space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">직접비</span><strong>{formatMoney(totals.directCost)}원</strong></div>
            <div className="flex justify-between"><span className="text-slate-500">일반관리비</span><strong>{formatMoney(totals.overhead)}원</strong></div>
            <div className="flex justify-between"><span className="text-slate-500">이윤</span><strong>{formatMoney(totals.profit)}원</strong></div>
            <div className="flex justify-between"><span className="text-slate-500">할인</span><strong>-{formatMoney(totals.discount)}원</strong></div>
            <div className="flex justify-between"><span className="text-slate-500">VAT</span><strong>{formatMoney(totals.vat)}원</strong></div>
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base"><span className="font-bold text-slate-900">합계</span><strong className="text-emerald-700">{formatMoney(totals.total)}원</strong></div>
        </div>
    </section>
);

export default DrawingAiEstimatePage;
