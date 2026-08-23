export type ConstructionPlanTradeType = 'system-shoring' | 'system-scaffold';

export type ConstructionPlanRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface ConstructionPlanRiskThresholdContract {
    minScore: number;
    maxScore: number;
    level: ConstructionPlanRiskLevel;
    label: string;
    action: string;
}

export interface ConstructionPlanRiskAssessmentPolicyContract {
    methodVersion: 2;
    methodReference: string;
    formula: 'probability * severity';
    probabilityMin: 1;
    probabilityMax: 5;
    severityMin: 1;
    severityMax: 5;
    thresholds: readonly ConstructionPlanRiskThresholdContract[];
    acceptance: {
        maxResidualScore: number;
        requireResidualReduction: boolean;
        blockedResidualLevels: readonly ConstructionPlanRiskLevel[];
    };
    reviewTriggers: readonly string[];
}

export interface ConstructionPlanServerTemplatePage {
    pageNumber: number;
    sectionKey: string;
    required: boolean;
    title: string;
    drawingSlots: readonly string[];
}

export interface ConstructionPlanServerTemplateContract {
    tradeType: ConstructionPlanTradeType;
    templateId: string;
    templateVersion: string;
    rendererVersion: 'field-use-a4-v3';
    schemaVersion: 1;
    pageCount: 42;
    riskAssessmentPolicy: ConstructionPlanRiskAssessmentPolicyContract;
    pages: readonly ConstructionPlanServerTemplatePage[];
}

const deepFreeze = <T>(value: T): T => {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        Object.values(value as Record<string, unknown>).forEach((entry) => deepFreeze(entry));
        Object.freeze(value);
    }
    return value;
};

const STANDARD_RISK_THRESHOLDS: readonly ConstructionPlanRiskThresholdContract[] = [
    { minScore: 1, maxScore: 4, level: 'low', label: '낮음', action: '현행 통제를 유지하고 작업한다.' },
    { minScore: 5, maxScore: 9, level: 'medium', label: '보통', action: '계획된 저감대책을 이행한 뒤 작업한다.' },
    { minScore: 10, maxScore: 16, level: 'high', label: '높음', action: '책임자 검토와 추가 저감 후 작업한다.' },
    { minScore: 17, maxScore: 25, level: 'critical', label: '매우 높음', action: '작업을 금지하고 공법을 재검토한다.' },
];

const STANDARD_RISK_REVIEW_TRIGGERS = [
    '공법 또는 설치·해체 순서 변경',
    '장비 종류·작업반경 변경',
    '작업구간 또는 승인도면 개정',
    '사고·아차사고 또는 기상조건 변화',
] as const;

const riskAssessmentPolicy = (methodReference: string): ConstructionPlanRiskAssessmentPolicyContract => ({
    methodVersion: 2,
    methodReference,
    formula: 'probability * severity',
    probabilityMin: 1,
    probabilityMax: 5,
    severityMin: 1,
    severityMax: 5,
    thresholds: STANDARD_RISK_THRESHOLDS.map((threshold) => ({ ...threshold })),
    acceptance: {
        maxResidualScore: 9,
        requireResidualReduction: true,
        blockedResidualLevels: ['high', 'critical'],
    },
    reviewTriggers: [...STANDARD_RISK_REVIEW_TRIGGERS],
});

export const constructionPlanRiskScore = (
    probability: unknown,
    severity: unknown,
    policy: ConstructionPlanRiskAssessmentPolicyContract,
): number | null => (
    Number.isInteger(probability)
    && Number(probability) >= policy.probabilityMin
    && Number(probability) <= policy.probabilityMax
    && Number.isInteger(severity)
    && Number(severity) >= policy.severityMin
    && Number(severity) <= policy.severityMax
        ? Number(probability) * Number(severity)
        : null
);

export const constructionPlanRiskLevelFromScore = (
    score: number,
    policy: ConstructionPlanRiskAssessmentPolicyContract,
): ConstructionPlanRiskLevel | null => (
    policy.thresholds.find((threshold) => (
        score >= threshold.minScore && score <= threshold.maxScore
    ))?.level ?? null
);

export const constructionPlanResidualRiskIsAcceptable = (
    score: number,
    level: unknown,
    policy: ConstructionPlanRiskAssessmentPolicyContract,
): boolean => (
    score <= policy.acceptance.maxResidualScore
    && !policy.acceptance.blockedResidualLevels.includes(level as ConstructionPlanRiskLevel)
);

const SHORING_PAGE_INPUT = [
    [1, 'cover', true, '시공계획서 표지'],
    [2, 'document-control', true, '문서관리 및 개정이력'],
    [3, 'toc', true, '목차 (1/2)'],
    [4, 'toc', true, '목차 (2/2)'],
    [5, 'general', true, '일반사항'],
    [6, 'project-overview', true, '공사개요'],
    [7, 'organization', true, '현장 조직도 및 업무분장'],
    [8, 'material-plan', true, '자재 반입 및 보관계획'],
    [9, 'equipment-plan', true, '장비 사용계획'],
    [10, 'equipment-layout', true, '장비 배치 및 작업동선', ['D-06']],
    [11, 'lifting-plan', true, '양중작업 계획'],
    [12, 'equipment-procedure', true, '장비 안전작업 절차'],
    [13, 'equipment-inspection', true, '장비 일상점검 기준'],
    [14, 'equipment-signal', true, '신호체계 및 통제계획'],
    [15, 'system-overview', true, '시스템동바리 개요'],
    [16, 'component-catalog', true, '시스템동바리 구성 부품'],
    [17, 'member-specifications', true, '부재 규격 및 허용범위'],
    [18, 'installation-sequence', true, '표준 설치 순서'],
    [19, 'post-ledger-assembly', true, '지주 및 수평재 조립'],
    [20, 'brace-installation', true, '가새 설치계획'],
    [21, 'connection-details', true, '상·하부 접합 상세', ['D-05']],
    [22, 'drawing-register', true, '도면목록 및 공통주의사항'],
    [23, 'drawing-d01', true, 'D-01 평면 배치도', ['D-01']],
    [24, 'drawing-d02-elevation', true, 'D-02 입면도', ['D-02']],
    [25, 'drawing-d02-section', true, 'D-02 단면도', ['D-02']],
    [26, 'drawing-d03-d04', true, 'D-03·D-04 지지 및 보강 상세', ['D-03', 'D-04']],
    [27, 'drawing-d05-d06', true, 'D-05·D-06 접합 및 장비간섭 상세', ['D-05', 'D-06']],
    [28, 'pre-pour-hold-point', true, '타설 전 Hold Point'],
    [29, 'structural-control', true, '구조관리 기준'],
    [30, 'site-installation-plan', true, '설치 작업계획'],
    [31, 'concrete-pour-plan', true, '콘크리트 타설계획'],
    [32, 'dismantling-plan', true, '해체 작업계획'],
    [33, 'retention-plan', true, '존치 및 재동바리 계획'],
    [34, 'quality-plan', true, '품질관리 계획'],
    [35, 'safety-plan', true, '안전관리 계획'],
    [36, 'risk-assessment', true, '위험성평가'],
    [37, 'emergency-plan', true, '비상조치 계획'],
    [38, 'environment-plan', true, '환경관리 계획'],
    [39, 'installation-inspection', true, '설치 검측 체크리스트'],
    [40, 'equipment-daily-log', true, '장비 일일점검일지'],
    [41, 'photo-sheet', false, '현장사진대지'],
    [42, 'handover', true, '인수인계 및 확인서'],
] as const;

const SHORING_PAGES: readonly ConstructionPlanServerTemplatePage[] = SHORING_PAGE_INPUT.map((page) => ({
    pageNumber: page[0],
    sectionKey: page[1],
    required: page[2],
    title: page[3],
    drawingSlots: page.length > 4 ? page[4] : [],
}));

const SCAFFOLD_OVERRIDES: Readonly<Record<number, Partial<ConstructionPlanServerTemplatePage>>> = {
    1: { title: '시스템비계 시공계획서 표지' },
    5: { title: '시스템비계 공사 일반사항' },
    8: { title: '비계 자재 반입·검수 및 보관계획' },
    10: { title: '장비 배치·양중 및 자재 동선' },
    15: { title: '시스템비계 개요' },
    16: { title: '시스템비계 구성 부품' },
    17: { title: '비계 부재 규격 및 허용범위' },
    18: { title: '시스템비계 표준 설치 순서' },
    19: { sectionKey: 'base-standard-assembly', title: '받침철물·수직재·수평재 조립' },
    20: { sectionKey: 'brace-tie-installation', title: '가새 및 벽이음 설치계획' },
    21: { sectionKey: 'wall-tie-anchorage', title: '벽이음·앵커 접합 상세', drawingSlots: ['D-04'] },
    23: { title: 'D-01 비계 평면 배치도' },
    24: { title: 'D-02 비계 입면도' },
    25: { title: 'D-02 비계 단면도' },
    26: { title: 'D-03·D-04 기초 및 벽이음 상세' },
    27: { title: 'D-05·D-06 승강·추락·낙하 방지 상세' },
    28: { sectionKey: 'pre-use-hold-point', title: '사용 전 Hold Point' },
    29: { title: '구조 및 설치 관리기준' },
    30: { title: '시스템비계 설치 작업계획' },
    31: { sectionKey: 'work-platform-access-plan', title: '작업발판·승강통로 계획' },
    32: { title: '시스템비계 해체 작업계획' },
    33: { sectionKey: 'inspection-maintenance-plan', title: '사용 중 점검·보수 및 변경관리' },
    39: { title: '시스템비계 설치 검측 체크리스트' },
    40: { sectionKey: 'scaffold-daily-log', title: '시스템비계 일일점검일지' },
};

const SCAFFOLD_PAGES: readonly ConstructionPlanServerTemplatePage[] = SHORING_PAGES.map((page) => ({
    ...page,
    drawingSlots: [...page.drawingSlots],
    ...(SCAFFOLD_OVERRIDES[page.pageNumber] ?? {}),
}));

export const SYSTEM_SHORING_SERVER_TEMPLATE: ConstructionPlanServerTemplateContract = deepFreeze({
    tradeType: 'system-shoring',
    templateId: 'system-shoring-standard',
    templateVersion: '1.0.0',
    rendererVersion: 'field-use-a4-v3',
    schemaVersion: 1,
    pageCount: 42,
    riskAssessmentPolicy: riskAssessmentPolicy('청연이엔지 시스템동바리 5×5 위험성평가 기준 v2'),
    pages: SHORING_PAGES,
});

export const SYSTEM_SCAFFOLD_SERVER_TEMPLATE: ConstructionPlanServerTemplateContract = deepFreeze({
    tradeType: 'system-scaffold',
    templateId: 'system-scaffold-standard',
    templateVersion: '1.0.0',
    rendererVersion: 'field-use-a4-v3',
    schemaVersion: 1,
    pageCount: 42,
    riskAssessmentPolicy: riskAssessmentPolicy('청연이엔지 시스템비계 5×5 위험성평가 기준 v2'),
    pages: SCAFFOLD_PAGES,
});

const TEMPLATE_BY_ID_VERSION = new Map<string, ConstructionPlanServerTemplateContract>([
    [`${SYSTEM_SHORING_SERVER_TEMPLATE.templateId}@${SYSTEM_SHORING_SERVER_TEMPLATE.templateVersion}`, SYSTEM_SHORING_SERVER_TEMPLATE],
    [`${SYSTEM_SCAFFOLD_SERVER_TEMPLATE.templateId}@${SYSTEM_SCAFFOLD_SERVER_TEMPLATE.templateVersion}`, SYSTEM_SCAFFOLD_SERVER_TEMPLATE],
]);

const isTradeType = (value: unknown): value is ConstructionPlanTradeType => (
    value === 'system-shoring' || value === 'system-scaffold'
);

export const resolveConstructionPlanServerTemplate = (input: {
    tradeType: unknown;
    templateId: unknown;
    templateVersion: unknown;
}): ConstructionPlanServerTemplateContract => {
    if (!isTradeType(input.tradeType)
        || typeof input.templateId !== 'string'
        || typeof input.templateVersion !== 'string') {
        throw new Error('construction-plan-template-identity-invalid');
    }
    const contract = TEMPLATE_BY_ID_VERSION.get(`${input.templateId}@${input.templateVersion}`);
    if (!contract || contract.tradeType !== input.tradeType) {
        throw new Error('construction-plan-template-unsupported');
    }
    return contract;
};

export const getLatestConstructionPlanServerTemplate = (
    tradeType: ConstructionPlanTradeType,
): ConstructionPlanServerTemplateContract => (
    tradeType === 'system-scaffold'
        ? SYSTEM_SCAFFOLD_SERVER_TEMPLATE
        : SYSTEM_SHORING_SERVER_TEMPLATE
);

export const assertConstructionPlanServerTemplateIntegrity = (
    contract: ConstructionPlanServerTemplateContract,
): void => {
    const policy = contract.riskAssessmentPolicy;
    if (policy.methodVersion !== 2
        || policy.formula !== 'probability * severity'
        || policy.probabilityMin !== 1
        || policy.probabilityMax !== 5
        || policy.severityMin !== 1
        || policy.severityMax !== 5
        || !policy.methodReference.trim()
        || policy.thresholds.length !== 4
        || policy.reviewTriggers.length === 0
        || new Set(policy.reviewTriggers).size !== policy.reviewTriggers.length
        || policy.acceptance.maxResidualScore < 1
        || policy.acceptance.maxResidualScore > 25
        || policy.acceptance.blockedResidualLevels.length === 0) {
        throw new Error('construction-plan-template-risk-policy-invalid');
    }
    const seenLevels = new Set<ConstructionPlanRiskLevel>();
    let nextRiskScore = 1;
    policy.thresholds.forEach((threshold) => {
        if (threshold.minScore !== nextRiskScore
            || threshold.maxScore < threshold.minScore
            || !threshold.label.trim()
            || !threshold.action.trim()
            || seenLevels.has(threshold.level)) {
            throw new Error('construction-plan-template-risk-threshold-invalid');
        }
        seenLevels.add(threshold.level);
        nextRiskScore = threshold.maxScore + 1;
    });
    if (nextRiskScore !== 26 || seenLevels.size !== 4) {
        throw new Error('construction-plan-template-risk-threshold-coverage-invalid');
    }
    if (contract.pages.length !== contract.pageCount) {
        throw new Error('construction-plan-template-page-count-invalid');
    }
    const seenSections = new Set<string>();
    contract.pages.forEach((page, index) => {
        if (page.pageNumber !== index + 1 || !page.sectionKey || !page.title) {
            throw new Error('construction-plan-template-page-order-invalid');
        }
        seenSections.add(page.sectionKey);
        page.drawingSlots.forEach((slot) => {
            if (!/^D-0[1-6]$/.test(slot)) {
                throw new Error('construction-plan-template-drawing-slot-invalid');
            }
        });
    });
    if (!seenSections.has('cover') || !seenSections.has('handover')) {
        throw new Error('construction-plan-template-required-section-missing');
    }
};

[SYSTEM_SHORING_SERVER_TEMPLATE, SYSTEM_SCAFFOLD_SERVER_TEMPLATE]
    .forEach(assertConstructionPlanServerTemplateIntegrity);
