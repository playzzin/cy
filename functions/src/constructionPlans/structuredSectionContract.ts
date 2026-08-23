export const CONSTRUCTION_PLAN_STRUCTURED_SECTION_KEYS = [
    'material-plan',
    'equipment-signal',
    'site-installation-plan',
    'concrete-pour-plan',
    'dismantling-plan',
    'retention-plan',
    'emergency-plan',
    'quality-plan',
    'safety-plan',
    'environment-plan',
    'work-platform-access-plan',
    'inspection-maintenance-plan',
] as const;

export type ConstructionPlanStructuredSectionKey = typeof CONSTRUCTION_PLAN_STRUCTURED_SECTION_KEYS[number];

export interface ConstructionPlanStructuredSectionIssue {
    path: string;
    label: string;
    code: 'shape' | 'required' | 'capacity';
}

export interface ConstructionPlanStructuredPrintRow {
    label: string;
    value: string;
}

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

const LEGACY_KEYS = new Set([
    'summary', 'scope', 'owner', 'precondition', 'inspection', 'body', 'responsibleTeamName',
    'workMethod', 'note',
]);

const BASE_KEYS = ['structuredDataVersion', 'applicableZones', 'standardTextVersion', 'standardTextCurrent'] as const;

const SECTION_KEYS: Readonly<Record<ConstructionPlanStructuredSectionKey, readonly string[]>> = {
    'material-plan': ['materials', 'deliveryRoute', 'unloadingMethod', 'responsibleWorkerId'],
    'equipment-signal': ['signalerWorkerIds', 'signalMethod', 'communicationChannel', 'signalProtocols', 'accessControlMeasures', 'emergencyStopSignal'],
    'site-installation-plan': ['drawingReferences', 'prerequisites', 'workSequence', 'inspectionPoints', 'weatherStopCriteria'],
    'concrete-pour-plan': ['designStrength', 'pourMethod', 'plannedPourDate', 'pourRate', 'pourSequence', 'concentratedLoadControls', 'monitoringFrequency', 'stopCriteria'],
    'dismantling-plan': ['strengthEvidenceReference', 'approvalReference', 'prerequisites', 'workSequence', 'temporaryStabilityMeasures', 'exclusionZones', 'materialLoweringMethod', 'responsibleWorkerId'],
    'retention-plan': ['retentionZones', 'inspectionFrequency', 'markingMethod', 'changeTriggers', 'changeApprovalRoles', 'drawingRevisionRequired', 'engineeringReviewRequired'],
    'emergency-plan': ['contacts', 'scenarios', 'alarmMethod', 'nearestHospital', 'emergencyEquipment', 'reportingChain'],
    'quality-plan': ['inspectionItems', 'holdPoints', 'nonconformanceProcess', 'recordsRetentionMethod'],
    'safety-plan': ['supervisorWorkerIds', 'toolboxTopics', 'ppeRequirements', 'accessControlMeasures', 'fallPreventionMeasures', 'fallingObjectPreventionMeasures', 'stopWorkCriteria', 'permitTypes'],
    'environment-plan': ['aspects', 'wasteSegregation', 'dustControls', 'noiseControls', 'spillResponse', 'complaintContact', 'monitoringFrequency'],
    'work-platform-access-plan': ['platformWidth', 'platformMaterial', 'platformLoadLimit', 'guardrailMeasures', 'toeBoardMeasures', 'accessType', 'accessLocations', 'openingControls', 'inspectionPoints', 'responsibleWorkerId'],
    'inspection-maintenance-plan': ['inspectionFrequency', 'inspectionItems', 'defectResponse', 'weatherStopCriteria', 'alterationApprovalRoles', 'wallTieChecks', 'platformChecks', 'recordsRetentionMethod', 'responsibleWorkerId'],
};

const ITEM_KEYS = {
    material: new Set(['id', 'materialName', 'specification', 'approvalReference', 'plannedQuantity', 'unit', 'deliveryPeriod', 'inspectionCriteria', 'storageLocation', 'storageControls']),
    signal: new Set(['id', 'situation', 'signal', 'issuerRole', 'receiverRole']),
    sequence: new Set(['id', 'sequence', 'activity', 'responsibleRole', 'workZones', 'prerequisites', 'acceptanceCriteria']),
    pourSequence: new Set(['id', 'sequence', 'zone', 'volume', 'pumpPosition', 'monitoringItems']),
    retention: new Set(['id', 'zone', 'retainUntilCondition', 'releaseEvidence', 'reshoringRequired', 'reshoringSpecification']),
    contact: new Set(['id', 'organization', 'name', 'phone', 'role']),
    scenario: new Set(['id', 'scenario', 'initialActions', 'evacuationRoute', 'assemblyPoint', 'responsibleRole']),
    qualityInspection: new Set(['id', 'stage', 'item', 'criterion', 'method', 'frequency', 'responsibleRole', 'recordForm']),
    // `approverRole` is retained only so legacy records remain readable. New
    // review/release data must populate the complete decision contract below.
    holdPoint: new Set(['id', 'stage', 'evidence', 'responsibleRole', 'completionCondition', 'decisionStatus', 'decisionAt', 'decisionComment', 'approverRole']),
    ppe: new Set(['id', 'workStage', 'item', 'standard']),
    environment: new Set(['id', 'activity', 'impact', 'controlMeasure', 'monitoringMethod', 'responsibleRole']),
} as const;

const MAX_TEXT_LENGTH = 240;
const MAX_LIST_ITEMS = 8;
const MAX_LIST_ITEM_LENGTH = 160;
export const HOLD_POINT_CONDITIONAL_COMMENT_MIN_LENGTH = 10;

export const CONSTRUCTION_PLAN_STRUCTURED_LEGACY_CONTENT_KEYS = new Set(LEGACY_KEYS);

export const CONSTRUCTION_PLAN_STRUCTURED_SECTION_CONTENT_KEYS = new Set([
    ...BASE_KEYS,
    ...Object.values(SECTION_KEYS).flat(),
    ...LEGACY_KEYS,
]);

export const isConstructionPlanStructuredSectionKey = (
    value: unknown,
): value is ConstructionPlanStructuredSectionKey => (
    typeof value === 'string'
    && (CONSTRUCTION_PLAN_STRUCTURED_SECTION_KEYS as readonly string[]).includes(value)
);

const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

const printable = (value: unknown): string => {
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    if (typeof value === 'boolean') return value ? '예' : '아니오';
    const normalized = text(value);
    return normalized || '-';
};

const list = (value: unknown): string[] => Array.isArray(value)
    ? value.flatMap((entry) => typeof entry === 'string' && entry.trim() ? [entry.trim()] : [])
    : [];

const printList = (value: unknown): string => {
    const values = list(value);
    return values.length ? values.join(' · ') : '-';
};

const yesNo = (value: unknown): string => value === true ? '예' : value === false ? '아니오' : '-';

const push = (
    issues: ConstructionPlanStructuredSectionIssue[],
    code: ConstructionPlanStructuredSectionIssue['code'],
    path: string,
    label: string,
): void => {
    issues.push({ code, path, label });
};

const checkText = (
    issues: ConstructionPlanStructuredSectionIssue[],
    value: unknown,
    path: string,
    label: string,
    required: boolean,
): void => {
    if (value !== undefined && typeof value !== 'string') {
        push(issues, 'shape', path, `${label} 형식`);
        return;
    }
    if (typeof value === 'string' && value.length > MAX_TEXT_LENGTH) push(issues, 'capacity', path, `${label} ${MAX_TEXT_LENGTH}자 이내`);
    if (required && !text(value)) push(issues, 'required', path, label);
};

const checkStringList = (
    issues: ConstructionPlanStructuredSectionIssue[],
    value: unknown,
    path: string,
    label: string,
    required: boolean,
): void => {
    if (!Array.isArray(value)) {
        push(issues, 'shape', path, `${label} 목록 형식`);
        return;
    }
    if (value.length > MAX_LIST_ITEMS) push(issues, 'capacity', path, `${label} ${MAX_LIST_ITEMS}개 이내`);
    value.forEach((entry, index) => {
        if (typeof entry !== 'string' || entry.length > MAX_LIST_ITEM_LENGTH) {
            push(issues, 'shape', `${path}.${index}`, `${label} ${index + 1} 형식`);
        }
    });
    if (required && !value.some((entry) => typeof entry === 'string' && entry.trim())) {
        push(issues, 'required', path, label);
    }
};

const checkExactRecord = (
    issues: ConstructionPlanStructuredSectionIssue[],
    value: unknown,
    path: string,
    label: string,
    allowed: ReadonlySet<string>,
): UnknownRecord | null => {
    if (!isRecord(value)) {
        push(issues, 'shape', path, `${label} 행 형식`);
        return null;
    }
    Object.keys(value).forEach((key) => {
        if (!allowed.has(key)) push(issues, 'shape', `${path}.${key}`, `${label} 허용되지 않은 필드`);
    });
    return value;
};

const checkRows = (
    issues: ConstructionPlanStructuredSectionIssue[],
    value: unknown,
    path: string,
    label: string,
    allowed: ReadonlySet<string>,
): UnknownRecord[] => {
    if (!Array.isArray(value)) {
        push(issues, 'shape', path, `${label} 목록 형식`);
        return [];
    }
    if (value.length === 0) push(issues, 'required', path, label);
    return value.flatMap((entry, index) => {
        const record = checkExactRecord(issues, entry, `${path}.${index}`, `${label} ${index + 1}`, allowed);
        return record ? [record] : [];
    });
};

const checkSequence = (
    issues: ConstructionPlanStructuredSectionIssue[],
    rows: UnknownRecord[],
    path: string,
    label: string,
): void => {
    rows.forEach((row, index) => {
        const prefix = `${path}.${index}`;
        if (!Number.isInteger(row.sequence) || Number(row.sequence) < 1) push(issues, 'shape', `${prefix}.sequence`, `${label} ${index + 1} 순번`);
        checkText(issues, row.id, `${prefix}.id`, `${label} ${index + 1} ID`, false);
        checkText(issues, row.activity, `${prefix}.activity`, `${label} ${index + 1} 작업내용`, true);
        checkText(issues, row.responsibleRole, `${prefix}.responsibleRole`, `${label} ${index + 1} 담당역할`, true);
        checkStringList(issues, row.workZones, `${prefix}.workZones`, `${label} ${index + 1} 작업구간`, true);
        checkStringList(issues, row.prerequisites, `${prefix}.prerequisites`, `${label} ${index + 1} 선행조건`, false);
        checkStringList(issues, row.acceptanceCriteria, `${prefix}.acceptanceCriteria`, `${label} ${index + 1} 완료기준`, true);
    });
};

export const validateConstructionPlanStructuredSectionContent = (
    key: ConstructionPlanStructuredSectionKey,
    value: unknown,
): ConstructionPlanStructuredSectionIssue[] => {
    const issues: ConstructionPlanStructuredSectionIssue[] = [];
    if (!isRecord(value)) {
        push(issues, 'shape', '', '구조화 입력 데이터');
        return issues;
    }
    const allowed = new Set([...BASE_KEYS, ...SECTION_KEYS[key], ...LEGACY_KEYS]);
    Object.keys(value).forEach((contentKey) => {
        if (!allowed.has(contentKey)) push(issues, 'shape', contentKey, '허용되지 않은 구조화 필드');
    });
    LEGACY_KEYS.forEach((legacyKey) => {
        if (value[legacyKey] !== undefined) checkText(issues, value[legacyKey], legacyKey, '레거시 자유서술', false);
    });
    if (value.structuredDataVersion !== 1) push(issues, 'shape', 'structuredDataVersion', '구조화 데이터 버전 1');
    checkStringList(issues, value.applicableZones, 'applicableZones', '적용구간', true);

    switch (key) {
        case 'material-plan': {
            const rows = checkRows(issues, value.materials, 'materials', '자재계획', ITEM_KEYS.material);
            rows.forEach((row, index) => {
                const prefix = `materials.${index}`;
                checkText(issues, row.id, `${prefix}.id`, `자재 ${index + 1} ID`, false);
                checkText(issues, row.materialName, `${prefix}.materialName`, `자재 ${index + 1} 자재명`, true);
                checkText(issues, row.specification, `${prefix}.specification`, `자재 ${index + 1} 규격`, true);
                checkText(issues, row.approvalReference, `${prefix}.approvalReference`, `자재 ${index + 1} 승인근거`, true);
                checkText(issues, row.plannedQuantity, `${prefix}.plannedQuantity`, `자재 ${index + 1} 계획수량`, false);
                checkText(issues, row.unit, `${prefix}.unit`, `자재 ${index + 1} 단위`, false);
                checkText(issues, row.deliveryPeriod, `${prefix}.deliveryPeriod`, `자재 ${index + 1} 반입기간`, false);
                checkStringList(issues, row.inspectionCriteria, `${prefix}.inspectionCriteria`, `자재 ${index + 1} 반입검수 기준`, true);
                checkText(issues, row.storageLocation, `${prefix}.storageLocation`, `자재 ${index + 1} 보관위치`, true);
                checkStringList(issues, row.storageControls, `${prefix}.storageControls`, `자재 ${index + 1} 보관 통제대책`, true);
            });
            checkText(issues, value.deliveryRoute, 'deliveryRoute', '반입동선', true);
            checkText(issues, value.unloadingMethod, 'unloadingMethod', '하역방법', true);
            checkText(issues, value.responsibleWorkerId, 'responsibleWorkerId', '자재계획 담당자', true);
            break;
        }
        case 'equipment-signal': {
            checkStringList(issues, value.signalerWorkerIds, 'signalerWorkerIds', '신호수·유도자', true);
            if (!['hand', 'radio', 'combined', 'other'].includes(String(value.signalMethod || ''))) push(issues, 'required', 'signalMethod', '신호방법');
            checkText(issues, value.communicationChannel, 'communicationChannel', '통신채널', false);
            const rows = checkRows(issues, value.signalProtocols, 'signalProtocols', '상황별 신호체계', ITEM_KEYS.signal);
            rows.forEach((row, index) => {
                const prefix = `signalProtocols.${index}`;
                checkText(issues, row.id, `${prefix}.id`, `신호체계 ${index + 1} ID`, false);
                checkText(issues, row.situation, `${prefix}.situation`, `신호체계 ${index + 1} 상황`, true);
                checkText(issues, row.signal, `${prefix}.signal`, `신호체계 ${index + 1} 신호`, true);
                checkText(issues, row.issuerRole, `${prefix}.issuerRole`, `신호체계 ${index + 1} 발신 역할`, true);
                checkText(issues, row.receiverRole, `${prefix}.receiverRole`, `신호체계 ${index + 1} 수신 역할`, true);
            });
            checkStringList(issues, value.accessControlMeasures, 'accessControlMeasures', '출입통제 대책', true);
            checkText(issues, value.emergencyStopSignal, 'emergencyStopSignal', '비상정지 신호', true);
            break;
        }
        case 'site-installation-plan': {
            checkStringList(issues, value.drawingReferences, 'drawingReferences', '적용 승인도면', true);
            checkStringList(issues, value.prerequisites, 'prerequisites', '설치 선행조건', true);
            checkSequence(issues, checkRows(issues, value.workSequence, 'workSequence', '설치 순서', ITEM_KEYS.sequence), 'workSequence', '설치 순서');
            checkStringList(issues, value.inspectionPoints, 'inspectionPoints', '설치 검측항목', true);
            checkStringList(issues, value.weatherStopCriteria, 'weatherStopCriteria', '기상 작업중지 기준', true);
            break;
        }
        case 'concrete-pour-plan': {
            checkText(issues, value.designStrength, 'designStrength', '설계기준강도', true);
            if (!['pump', 'crane-bucket', 'direct', 'other'].includes(String(value.pourMethod || ''))) push(issues, 'required', 'pourMethod', '타설방법');
            checkText(issues, value.plannedPourDate, 'plannedPourDate', '계획 타설일', false);
            checkText(issues, value.pourRate, 'pourRate', '계획 타설속도', true);
            const rows = checkRows(issues, value.pourSequence, 'pourSequence', '타설 순서', ITEM_KEYS.pourSequence);
            rows.forEach((row, index) => {
                const prefix = `pourSequence.${index}`;
                if (!Number.isInteger(row.sequence) || Number(row.sequence) < 1) push(issues, 'shape', `${prefix}.sequence`, `타설 순서 ${index + 1} 순번`);
                checkText(issues, row.id, `${prefix}.id`, `타설 순서 ${index + 1} ID`, false);
                checkText(issues, row.zone, `${prefix}.zone`, `타설 순서 ${index + 1} 구간`, true);
                checkText(issues, row.volume, `${prefix}.volume`, `타설 순서 ${index + 1} 물량`, true);
                checkText(issues, row.pumpPosition, `${prefix}.pumpPosition`, `타설 순서 ${index + 1} 펌프 위치`, true);
                checkStringList(issues, row.monitoringItems, `${prefix}.monitoringItems`, `타설 순서 ${index + 1} 계측·관찰항목`, true);
            });
            checkStringList(issues, value.concentratedLoadControls, 'concentratedLoadControls', '집중하중 통제대책', true);
            checkText(issues, value.monitoringFrequency, 'monitoringFrequency', '타설 중 점검주기', true);
            checkStringList(issues, value.stopCriteria, 'stopCriteria', '타설 중지 기준', true);
            break;
        }
        case 'dismantling-plan': {
            checkText(issues, value.strengthEvidenceReference, 'strengthEvidenceReference', '강도확인 근거', true);
            checkText(issues, value.approvalReference, 'approvalReference', '해체 승인근거', true);
            checkStringList(issues, value.prerequisites, 'prerequisites', '해체 선행조건', true);
            checkSequence(issues, checkRows(issues, value.workSequence, 'workSequence', '해체 순서', ITEM_KEYS.sequence), 'workSequence', '해체 순서');
            checkStringList(issues, value.temporaryStabilityMeasures, 'temporaryStabilityMeasures', '해체 중 안정대책', true);
            checkStringList(issues, value.exclusionZones, 'exclusionZones', '해체 통제구역', true);
            checkText(issues, value.materialLoweringMethod, 'materialLoweringMethod', '자재 하강방법', true);
            checkText(issues, value.responsibleWorkerId, 'responsibleWorkerId', '해체 책임자', true);
            break;
        }
        case 'retention-plan': {
            const rows = checkRows(issues, value.retentionZones, 'retentionZones', '존치·재동바리 구간', ITEM_KEYS.retention);
            rows.forEach((row, index) => {
                const prefix = `retentionZones.${index}`;
                checkText(issues, row.id, `${prefix}.id`, `존치구간 ${index + 1} ID`, false);
                checkText(issues, row.zone, `${prefix}.zone`, `존치구간 ${index + 1} 구간`, true);
                checkText(issues, row.retainUntilCondition, `${prefix}.retainUntilCondition`, `존치구간 ${index + 1} 해제조건`, true);
                checkText(issues, row.releaseEvidence, `${prefix}.releaseEvidence`, `존치구간 ${index + 1} 해제근거`, true);
                if (typeof row.reshoringRequired !== 'boolean') push(issues, 'required', `${prefix}.reshoringRequired`, `존치구간 ${index + 1} 재동바리 여부`);
                checkText(issues, row.reshoringSpecification, `${prefix}.reshoringSpecification`, `존치구간 ${index + 1} 재동바리 사양`, row.reshoringRequired === true);
            });
            checkText(issues, value.inspectionFrequency, 'inspectionFrequency', '존치상태 점검주기', true);
            checkText(issues, value.markingMethod, 'markingMethod', '존치구간 표시방법', true);
            checkStringList(issues, value.changeTriggers, 'changeTriggers', '변경관리 재검토 조건', true);
            checkStringList(issues, value.changeApprovalRoles, 'changeApprovalRoles', '변경 승인 역할', true);
            if (typeof value.drawingRevisionRequired !== 'boolean') push(issues, 'required', 'drawingRevisionRequired', '도면 Rev. 갱신 여부');
            if (typeof value.engineeringReviewRequired !== 'boolean') push(issues, 'required', 'engineeringReviewRequired', '기술 재검토 여부');
            break;
        }
        case 'emergency-plan': {
            const contacts = checkRows(issues, value.contacts, 'contacts', '비상연락망', ITEM_KEYS.contact);
            contacts.forEach((row, index) => {
                const prefix = `contacts.${index}`;
                checkText(issues, row.id, `${prefix}.id`, `연락망 ${index + 1} ID`, false);
                checkText(issues, row.organization, `${prefix}.organization`, `연락망 ${index + 1} 기관·조직`, true);
                checkText(issues, row.name, `${prefix}.name`, `연락망 ${index + 1} 담당자`, true);
                checkText(issues, row.phone, `${prefix}.phone`, `연락망 ${index + 1} 전화번호`, true);
                checkText(issues, row.role, `${prefix}.role`, `연락망 ${index + 1} 역할`, true);
            });
            const scenarios = checkRows(issues, value.scenarios, 'scenarios', '비상상황별 조치계획', ITEM_KEYS.scenario);
            scenarios.forEach((row, index) => {
                const prefix = `scenarios.${index}`;
                checkText(issues, row.id, `${prefix}.id`, `비상상황 ${index + 1} ID`, false);
                checkText(issues, row.scenario, `${prefix}.scenario`, `비상상황 ${index + 1} 유형`, true);
                checkStringList(issues, row.initialActions, `${prefix}.initialActions`, `비상상황 ${index + 1} 초동조치`, true);
                checkText(issues, row.evacuationRoute, `${prefix}.evacuationRoute`, `비상상황 ${index + 1} 대피동선`, true);
                checkText(issues, row.assemblyPoint, `${prefix}.assemblyPoint`, `비상상황 ${index + 1} 집결지`, true);
                checkText(issues, row.responsibleRole, `${prefix}.responsibleRole`, `비상상황 ${index + 1} 지휘역할`, true);
            });
            checkText(issues, value.alarmMethod, 'alarmMethod', '경보·전파방법', true);
            checkText(issues, value.nearestHospital, 'nearestHospital', '후송병원', true);
            checkStringList(issues, value.emergencyEquipment, 'emergencyEquipment', '비상장비', true);
            checkStringList(issues, value.reportingChain, 'reportingChain', '보고체계', true);
            break;
        }
        case 'quality-plan': {
            const inspections = checkRows(issues, value.inspectionItems, 'inspectionItems', '품질 검측계획', ITEM_KEYS.qualityInspection);
            inspections.forEach((row, index) => {
                const prefix = `inspectionItems.${index}`;
                checkText(issues, row.id, `${prefix}.id`, `검측 ${index + 1} ID`, false);
                ['stage', 'item', 'criterion', 'method', 'frequency', 'responsibleRole', 'recordForm'].forEach((field) => {
                    checkText(issues, row[field], `${prefix}.${field}`, `검측 ${index + 1} ${field}`, true);
                });
            });
            const holdPoints = checkRows(issues, value.holdPoints, 'holdPoints', 'Hold Point', ITEM_KEYS.holdPoint);
            holdPoints.forEach((row, index) => {
                const prefix = `holdPoints.${index}`;
                checkText(issues, row.id, `${prefix}.id`, `Hold Point ${index + 1} ID`, false);
                checkText(issues, row.stage, `${prefix}.stage`, `Hold Point ${index + 1} 단계`, true);
                checkText(issues, row.evidence, `${prefix}.evidence`, `Hold Point ${index + 1} 증빙`, true);
                checkText(issues, row.responsibleRole, `${prefix}.responsibleRole`, `Hold Point ${index + 1} 담당역할`, true);
                checkText(issues, row.completionCondition, `${prefix}.completionCondition`, `Hold Point ${index + 1} 완료조건`, true);
                const decisionStatus = text(row.decisionStatus);
                if (!['approved', 'conditional'].includes(decisionStatus)) {
                    push(
                        issues,
                        'required',
                        `${prefix}.decisionStatus`,
                        decisionStatus === 'rejected'
                            ? `Hold Point ${index + 1} 반려 해소 및 승인`
                            : `Hold Point ${index + 1} 명시적 결정상태`,
                    );
                }
                checkText(issues, row.decisionAt, `${prefix}.decisionAt`, `Hold Point ${index + 1} 결정시각`, true);
                const decisionAt = text(row.decisionAt);
                const parsedDecisionAt = decisionAt ? new Date(decisionAt) : undefined;
                if (decisionAt && (!parsedDecisionAt
                    || Number.isNaN(parsedDecisionAt.getTime())
                    || parsedDecisionAt.toISOString() !== decisionAt)) {
                    push(issues, 'shape', `${prefix}.decisionAt`, `Hold Point ${index + 1} 정규 ISO 결정시각`);
                }
                checkText(issues, row.decisionComment, `${prefix}.decisionComment`, `Hold Point ${index + 1} 결정의견`, true);
                const decisionComment = text(row.decisionComment);
                if (decisionStatus === 'conditional'
                    && decisionComment.length > 0
                    && decisionComment.length < HOLD_POINT_CONDITIONAL_COMMENT_MIN_LENGTH) {
                    push(
                        issues,
                        'required',
                        `${prefix}.decisionComment`,
                        `Hold Point ${index + 1} 조건부 승인 조건(${HOLD_POINT_CONDITIONAL_COMMENT_MIN_LENGTH}자 이상)`,
                    );
                }
            });
            checkStringList(issues, value.nonconformanceProcess, 'nonconformanceProcess', '부적합 처리절차', true);
            checkText(issues, value.recordsRetentionMethod, 'recordsRetentionMethod', '품질기록 보존방법', true);
            break;
        }
        case 'safety-plan': {
            checkStringList(issues, value.supervisorWorkerIds, 'supervisorWorkerIds', '안전관리 책임자', true);
            checkStringList(issues, value.toolboxTopics, 'toolboxTopics', 'TBM 교육주제', true);
            const ppe = checkRows(issues, value.ppeRequirements, 'ppeRequirements', '개인보호구 계획', ITEM_KEYS.ppe);
            ppe.forEach((row, index) => {
                const prefix = `ppeRequirements.${index}`;
                checkText(issues, row.id, `${prefix}.id`, `보호구 ${index + 1} ID`, false);
                checkText(issues, row.workStage, `${prefix}.workStage`, `보호구 ${index + 1} 작업단계`, true);
                checkText(issues, row.item, `${prefix}.item`, `보호구 ${index + 1} 품목`, true);
                checkText(issues, row.standard, `${prefix}.standard`, `보호구 ${index + 1} 적용기준`, true);
            });
            checkStringList(issues, value.accessControlMeasures, 'accessControlMeasures', '출입통제 대책', true);
            checkStringList(issues, value.fallPreventionMeasures, 'fallPreventionMeasures', '추락방지 대책', true);
            checkStringList(issues, value.fallingObjectPreventionMeasures, 'fallingObjectPreventionMeasures', '낙하물방지 대책', true);
            checkStringList(issues, value.stopWorkCriteria, 'stopWorkCriteria', '작업중지 기준', true);
            checkStringList(issues, value.permitTypes, 'permitTypes', '작업허가 종류', false);
            break;
        }
        case 'environment-plan': {
            const aspects = checkRows(issues, value.aspects, 'aspects', '환경영향 관리항목', ITEM_KEYS.environment);
            aspects.forEach((row, index) => {
                const prefix = `aspects.${index}`;
                checkText(issues, row.id, `${prefix}.id`, `환경항목 ${index + 1} ID`, false);
                checkText(issues, row.activity, `${prefix}.activity`, `환경항목 ${index + 1} 작업`, true);
                checkText(issues, row.impact, `${prefix}.impact`, `환경항목 ${index + 1} 영향`, true);
                checkText(issues, row.controlMeasure, `${prefix}.controlMeasure`, `환경항목 ${index + 1} 통제대책`, true);
                checkText(issues, row.monitoringMethod, `${prefix}.monitoringMethod`, `환경항목 ${index + 1} 확인방법`, true);
                checkText(issues, row.responsibleRole, `${prefix}.responsibleRole`, `환경항목 ${index + 1} 담당역할`, true);
            });
            checkStringList(issues, value.wasteSegregation, 'wasteSegregation', '폐기물 분리·반출대책', true);
            checkStringList(issues, value.dustControls, 'dustControls', '비산먼지 대책', true);
            checkStringList(issues, value.noiseControls, 'noiseControls', '소음·진동 대책', true);
            checkStringList(issues, value.spillResponse, 'spillResponse', '유출사고 대응', true);
            checkText(issues, value.complaintContact, 'complaintContact', '환경민원 연락처', true);
            checkText(issues, value.monitoringFrequency, 'monitoringFrequency', '환경점검 주기', true);
            break;
        }
        case 'work-platform-access-plan': {
            checkText(issues, value.platformWidth, 'platformWidth', '작업발판 유효폭', true);
            checkText(issues, value.platformMaterial, 'platformMaterial', '작업발판 재질·규격', true);
            checkText(issues, value.platformLoadLimit, 'platformLoadLimit', '작업발판 적재하중', true);
            checkStringList(issues, value.guardrailMeasures, 'guardrailMeasures', '안전난간 설치대책', true);
            checkStringList(issues, value.toeBoardMeasures, 'toeBoardMeasures', '발끝막이판 설치대책', true);
            if (!['stair', 'ladder', 'tower', 'combined', 'other'].includes(String(value.accessType || ''))) {
                push(issues, 'required', 'accessType', '승강통로 형식');
            }
            checkStringList(issues, value.accessLocations, 'accessLocations', '승강통로 위치', true);
            checkStringList(issues, value.openingControls, 'openingControls', '개구부 통제대책', true);
            checkStringList(issues, value.inspectionPoints, 'inspectionPoints', '발판·승강통로 검측항목', true);
            checkText(issues, value.responsibleWorkerId, 'responsibleWorkerId', '발판·승강통로 담당자', true);
            break;
        }
        case 'inspection-maintenance-plan': {
            checkText(issues, value.inspectionFrequency, 'inspectionFrequency', '사용 중 점검주기', true);
            checkStringList(issues, value.inspectionItems, 'inspectionItems', '사용 중 점검항목', true);
            checkStringList(issues, value.defectResponse, 'defectResponse', '결함 발견 시 조치', true);
            checkStringList(issues, value.weatherStopCriteria, 'weatherStopCriteria', '기상 작업중지·재점검 기준', true);
            checkStringList(issues, value.alterationApprovalRoles, 'alterationApprovalRoles', '변경 승인 역할', true);
            checkStringList(issues, value.wallTieChecks, 'wallTieChecks', '벽이음 점검항목', true);
            checkStringList(issues, value.platformChecks, 'platformChecks', '작업발판 점검항목', true);
            checkText(issues, value.recordsRetentionMethod, 'recordsRetentionMethod', '점검기록 보존방법', true);
            checkText(issues, value.responsibleWorkerId, 'responsibleWorkerId', '점검·보수 책임자', true);
            break;
        }
    }
    return issues;
};

const recordRows = (value: unknown): UnknownRecord[] => Array.isArray(value)
    ? value.filter(isRecord)
    : [];

const sequenceRow = (row: UnknownRecord): string => (
    `순번 ${printable(row.sequence)} · 작업 ${printable(row.activity)} · 담당 ${printable(row.responsibleRole)}`
    + ` · 구간 ${printList(row.workZones)} · 선행 ${printList(row.prerequisites)} · 완료기준 ${printList(row.acceptanceCriteria)}`
    + ` · ID ${printable(row.id)}`
);

export const buildConstructionPlanStructuredSectionRows = (
    key: ConstructionPlanStructuredSectionKey,
    value: unknown,
): ConstructionPlanStructuredPrintRow[] => {
    const issues = validateConstructionPlanStructuredSectionContent(key, value);
    if (issues.length > 0) {
        const first = issues[0];
        throw new Error(`construction-plan-structured-section-invalid:${key}:${first.code}:${first.path}`);
    }
    const content = value as UnknownRecord;
    const rows: ConstructionPlanStructuredPrintRow[] = [
        { label: '구조화 데이터 계약', value: `버전 ${printable(content.structuredDataVersion)}` },
        { label: '적용구간', value: printList(content.applicableZones) },
    ];
    switch (key) {
        case 'material-plan':
            recordRows(content.materials).forEach((row, index) => rows.push({
                label: `자재 ${index + 1} · ${printable(row.materialName)}`,
                value: `ID ${printable(row.id)} · 규격 ${printable(row.specification)} · 승인근거 ${printable(row.approvalReference)} · 계획 ${printable(row.plannedQuantity)} ${printable(row.unit)} · 반입기간 ${printable(row.deliveryPeriod)} · 검수 ${printList(row.inspectionCriteria)} · 보관 ${printable(row.storageLocation)} · 통제 ${printList(row.storageControls)}`,
            }));
            rows.push({ label: '반입동선·하역방법', value: `${printable(content.deliveryRoute)} · ${printable(content.unloadingMethod)}` });
            rows.push({ label: '자재계획 담당자', value: printable(content.responsibleWorkerId) });
            break;
        case 'equipment-signal': {
            const method = ({ hand: '수신호', radio: '무전', combined: '수신호+무전', other: '기타' } as Record<string, string>)[String(content.signalMethod)] || '-';
            rows.push({ label: '신호수·유도자', value: printList(content.signalerWorkerIds) });
            rows.push({ label: '신호방법·통신채널', value: `${method} · ${printable(content.communicationChannel)}` });
            recordRows(content.signalProtocols).forEach((row, index) => rows.push({
                label: `신호체계 ${index + 1} · ${printable(row.situation)}`,
                value: `신호 ${printable(row.signal)} · 발신 ${printable(row.issuerRole)} · 수신 ${printable(row.receiverRole)} · ID ${printable(row.id)}`,
            }));
            rows.push({ label: '출입통제 대책', value: printList(content.accessControlMeasures) });
            rows.push({ label: '비상정지 신호', value: printable(content.emergencyStopSignal) });
            break;
        }
        case 'site-installation-plan':
            rows.push({ label: '적용 승인도면', value: printList(content.drawingReferences) });
            rows.push({ label: '설치 선행조건', value: printList(content.prerequisites) });
            recordRows(content.workSequence).forEach((row, index) => rows.push({ label: `설치 순서 ${index + 1}`, value: sequenceRow(row) }));
            rows.push({ label: '설치 검측항목', value: printList(content.inspectionPoints) });
            rows.push({ label: '기상 작업중지 기준', value: printList(content.weatherStopCriteria) });
            break;
        case 'concrete-pour-plan': {
            const method = ({ pump: '펌프카', 'crane-bucket': '크레인 버킷', direct: '직접 타설', other: '기타' } as Record<string, string>)[String(content.pourMethod)] || '-';
            rows.push({ label: '강도·타설방법', value: `${printable(content.designStrength)} · ${method}` });
            rows.push({ label: '계획일·타설속도', value: `${printable(content.plannedPourDate)} · ${printable(content.pourRate)}` });
            recordRows(content.pourSequence).forEach((row, index) => rows.push({
                label: `타설 순서 ${index + 1} · ${printable(row.zone)}`,
                value: `순번 ${printable(row.sequence)} · 물량 ${printable(row.volume)} · 펌프위치 ${printable(row.pumpPosition)} · 계측·관찰 ${printList(row.monitoringItems)} · ID ${printable(row.id)}`,
            }));
            rows.push({ label: '집중하중 통제대책', value: printList(content.concentratedLoadControls) });
            rows.push({ label: '점검주기·중지기준', value: `${printable(content.monitoringFrequency)} · ${printList(content.stopCriteria)}` });
            break;
        }
        case 'dismantling-plan':
            rows.push({ label: '강도확인·해체 승인근거', value: `${printable(content.strengthEvidenceReference)} · ${printable(content.approvalReference)}` });
            rows.push({ label: '해체 선행조건', value: printList(content.prerequisites) });
            recordRows(content.workSequence).forEach((row, index) => rows.push({ label: `해체 순서 ${index + 1}`, value: sequenceRow(row) }));
            rows.push({ label: '해체 중 안정대책', value: printList(content.temporaryStabilityMeasures) });
            rows.push({ label: '해체 통제구역', value: printList(content.exclusionZones) });
            rows.push({ label: '자재 하강방법·책임자', value: `${printable(content.materialLoweringMethod)} · ${printable(content.responsibleWorkerId)}` });
            break;
        case 'retention-plan':
            recordRows(content.retentionZones).forEach((row, index) => rows.push({
                label: `존치구간 ${index + 1} · ${printable(row.zone)}`,
                value: `해제조건 ${printable(row.retainUntilCondition)} · 해제근거 ${printable(row.releaseEvidence)} · 재동바리 ${yesNo(row.reshoringRequired)} · 사양 ${printable(row.reshoringSpecification)} · ID ${printable(row.id)}`,
            }));
            rows.push({ label: '점검주기·표시방법', value: `${printable(content.inspectionFrequency)} · ${printable(content.markingMethod)}` });
            rows.push({ label: '변경관리 재검토 조건', value: printList(content.changeTriggers) });
            rows.push({ label: '변경 승인 역할', value: printList(content.changeApprovalRoles) });
            rows.push({ label: '도면 Rev.·기술 재검토', value: `도면 갱신 ${yesNo(content.drawingRevisionRequired)} · 기술 재검토 ${yesNo(content.engineeringReviewRequired)}` });
            break;
        case 'emergency-plan':
            recordRows(content.contacts).forEach((row, index) => rows.push({
                label: `비상연락망 ${index + 1} · ${printable(row.organization)}`,
                value: `담당 ${printable(row.name)} · 전화 ${printable(row.phone)} · 역할 ${printable(row.role)} · ID ${printable(row.id)}`,
            }));
            recordRows(content.scenarios).forEach((row, index) => rows.push({
                label: `비상상황 ${index + 1} · ${printable(row.scenario)}`,
                value: `초동조치 ${printList(row.initialActions)} · 대피동선 ${printable(row.evacuationRoute)} · 집결지 ${printable(row.assemblyPoint)} · 지휘 ${printable(row.responsibleRole)} · ID ${printable(row.id)}`,
            }));
            rows.push({ label: '경보·전파방법', value: printable(content.alarmMethod) });
            rows.push({ label: '후송병원', value: printable(content.nearestHospital) });
            rows.push({ label: '비상장비', value: printList(content.emergencyEquipment) });
            rows.push({ label: '보고체계', value: printList(content.reportingChain) });
            break;
        case 'quality-plan':
            recordRows(content.inspectionItems).forEach((row, index) => rows.push({
                label: `품질 검측 ${index + 1} · ${printable(row.stage)}`,
                value: `항목 ${printable(row.item)} · 기준 ${printable(row.criterion)} · 방법 ${printable(row.method)} · 빈도 ${printable(row.frequency)} · 담당 ${printable(row.responsibleRole)} · 기록 ${printable(row.recordForm)} · ID ${printable(row.id)}`,
            }));
            recordRows(content.holdPoints).forEach((row, index) => rows.push({
                label: `Hold Point ${index + 1} · ${printable(row.stage)}`,
                value: `요구 증빙 ${printable(row.evidence)} · 담당역할 ${printable(row.responsibleRole || row.approverRole)} · 완료조건 ${printable(row.completionCondition)} · 계획상 결정 ${printable(({ approved: '승인', conditional: '조건부 승인', rejected: '반려·작업중지', pending: '결정 필요' } as UnknownRecord)[String(row.decisionStatus)] || row.decisionStatus)} · 결정시각 ${printable(row.decisionAt)} · 의견 ${printable(row.decisionComment)} · ID ${printable(row.id)}`,
            }));
            rows.push({ label: '부적합 처리절차', value: printList(content.nonconformanceProcess) });
            rows.push({ label: '품질기록 보존방법', value: printable(content.recordsRetentionMethod) });
            break;
        case 'safety-plan':
            rows.push({ label: '안전관리 책임자', value: printList(content.supervisorWorkerIds) });
            rows.push({ label: 'TBM 교육주제', value: printList(content.toolboxTopics) });
            recordRows(content.ppeRequirements).forEach((row, index) => rows.push({
                label: `보호구 ${index + 1} · ${printable(row.workStage)}`,
                value: `품목 ${printable(row.item)} · 적용기준 ${printable(row.standard)} · ID ${printable(row.id)}`,
            }));
            rows.push({ label: '출입통제 대책', value: printList(content.accessControlMeasures) });
            rows.push({ label: '추락방지 대책', value: printList(content.fallPreventionMeasures) });
            rows.push({ label: '낙하물방지 대책', value: printList(content.fallingObjectPreventionMeasures) });
            rows.push({ label: '작업중지 기준', value: printList(content.stopWorkCriteria) });
            rows.push({ label: '작업허가 종류', value: printList(content.permitTypes) });
            break;
        case 'environment-plan':
            recordRows(content.aspects).forEach((row, index) => rows.push({
                label: `환경항목 ${index + 1} · ${printable(row.activity)}`,
                value: `영향 ${printable(row.impact)} · 통제 ${printable(row.controlMeasure)} · 확인 ${printable(row.monitoringMethod)} · 담당 ${printable(row.responsibleRole)} · ID ${printable(row.id)}`,
            }));
            rows.push({ label: '폐기물 분리·반출대책', value: printList(content.wasteSegregation) });
            rows.push({ label: '비산먼지 대책', value: printList(content.dustControls) });
            rows.push({ label: '소음·진동 대책', value: printList(content.noiseControls) });
            rows.push({ label: '유출사고 대응', value: printList(content.spillResponse) });
            rows.push({ label: '환경민원 연락처', value: printable(content.complaintContact) });
            rows.push({ label: '환경점검 주기', value: printable(content.monitoringFrequency) });
            break;
        case 'work-platform-access-plan': {
            const accessType = ({ stair: '계단', ladder: '사다리', tower: '승강타워', combined: '복합', other: '기타' } as Record<string, string>)[String(content.accessType)] || '-';
            rows.push({ label: '작업발판 규격', value: `유효폭 ${printable(content.platformWidth)} · 재질·규격 ${printable(content.platformMaterial)} · 적재하중 ${printable(content.platformLoadLimit)}` });
            rows.push({ label: '안전난간 설치대책', value: printList(content.guardrailMeasures) });
            rows.push({ label: '발끝막이판 설치대책', value: printList(content.toeBoardMeasures) });
            rows.push({ label: '승강통로 형식·위치', value: `${accessType} · ${printList(content.accessLocations)}` });
            rows.push({ label: '개구부 통제대책', value: printList(content.openingControls) });
            rows.push({ label: '검측항목', value: printList(content.inspectionPoints) });
            rows.push({ label: '담당자', value: printable(content.responsibleWorkerId) });
            break;
        }
        case 'inspection-maintenance-plan':
            rows.push({ label: '사용 중 점검주기', value: printable(content.inspectionFrequency) });
            rows.push({ label: '사용 중 점검항목', value: printList(content.inspectionItems) });
            rows.push({ label: '벽이음 점검항목', value: printList(content.wallTieChecks) });
            rows.push({ label: '작업발판 점검항목', value: printList(content.platformChecks) });
            rows.push({ label: '결함 발견 시 조치', value: printList(content.defectResponse) });
            rows.push({ label: '기상 중지·재점검 기준', value: printList(content.weatherStopCriteria) });
            rows.push({ label: '변경 승인 역할', value: printList(content.alterationApprovalRoles) });
            rows.push({ label: '기록 보존·책임자', value: `${printable(content.recordsRetentionMethod)} · ${printable(content.responsibleWorkerId)}` });
            break;
    }
    if (Array.from(LEGACY_KEYS).some((legacyKey) => text(content[legacyKey]))) {
        rows.push({ label: '레거시 자유서술', value: '구조화 데이터로 전환됨 · 본문 값은 승인 해시로만 추적' });
    }
    return rows;
};
