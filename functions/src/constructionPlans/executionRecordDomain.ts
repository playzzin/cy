import {
    canonicalStringify,
    isUnknownRecord,
    readTrimmedString,
    sha256Hex,
    type UnknownRecord,
} from './domain';
import type { ConstructionPlanTradeType } from './templateContracts';

export const CONSTRUCTION_PLAN_RECORD_TYPES = [
    'equipment_daily_inspection',
    'material_receiving_inspection',
    'installation_inspection',
    'pre_pour_inspection',
    'pre_dismantling_inspection',
    'daily_safety_log',
    'photo_sheet',
    'final_handover',
] as const;

export type ConstructionPlanRecordType = typeof CONSTRUCTION_PLAN_RECORD_TYPES[number];
export type ConstructionPlanRecordStatus = 'draft' | 'incomplete' | 'confirmed';
export type ConstructionPlanChecklistResult = 'pass' | 'fail' | 'not_applicable';

export interface ConstructionPlanRecordQuestion {
    id: string;
    category: string;
    text: string;
    required: true;
    allowNotApplicable: boolean;
    measuredValueLabel?: string;
}

export interface ConstructionPlanRecordCatalog {
    schemaVersion: 1;
    tradeType: ConstructionPlanTradeType;
    recordType: ConstructionPlanRecordType;
    version: string;
    hash: string;
    questions: ConstructionPlanRecordQuestion[];
}

export interface ConstructionPlanRecordResponse {
    questionId: string;
    result?: ConstructionPlanChecklistResult;
    note?: string;
    measuredValue?: string;
    action?: {
        description: string;
        owner: string;
        due: string;
        status: 'open' | 'resolved';
        resolution?: string;
    };
}

export interface ConstructionPlanRecordPhoto {
    id: string;
    storagePath: string;
    storageGeneration: string;
    sha256: string;
    sizeBytes: number;
    mimeType: 'image/jpeg' | 'image/png';
    caption: string;
    takenAt: string;
    zone: string;
    uploadedBy: string;
    uploadedByName?: string;
    uploadedAt: string;
}

export interface ConstructionPlanRecordValidationIssue {
    code: string;
    path: string;
    message: string;
}

const q = (
    id: string,
    category: string,
    text: string,
    allowNotApplicable = false,
    measuredValueLabel?: string,
): ConstructionPlanRecordQuestion => ({
    id, category, text, required: true, allowNotApplicable,
    ...(measuredValueLabel ? { measuredValueLabel } : {}),
});

const COMMON: Readonly<Record<ConstructionPlanRecordType, readonly ConstructionPlanRecordQuestion[]>> = {
    equipment_daily_inspection: [
        q('equipment-identity', '장비·운전원', '장비 등록번호·기종과 실제 운전원이 작업계획과 일치한다.'),
        q('equipment-license', '장비·운전원', '운전원 자격과 장비 검사 유효기간을 확인했다.'),
        q('equipment-structure', '기계상태', '구조부·와이어·후크·체결부에 균열, 변형 또는 이탈이 없다.'),
        q('equipment-safety-device', '안전장치', '제동·경보·과부하방지 등 안전장치가 정상 작동한다.'),
        q('equipment-ground', '작업환경', '지반·아웃트리거·작업반경 통제상태가 적합하다.', false, '지반/수평 확인값'),
        q('equipment-signal', '작업환경', '신호수·유도자와 작업 전 신호체계를 확인했다.'),
    ],
    material_receiving_inspection: [
        q('material-approved', '승인자재', '반입 자재의 제조사·규격·형식이 승인 자재와 일치한다.'),
        q('material-lot', '반입정보', '로트·수량·납품서와 실제 반입 수량을 대조했다.', false, '로트/수량'),
        q('material-damage', '외관검사', '부식·균열·휨·용접불량·변형 자재를 분리했다.'),
        q('material-dimensions', '치수검사', '표본 부재의 주요 치수와 두께를 확인했다.', false, '측정 치수'),
        q('material-storage', '보관', '규격별 구획, 받침목, 전도·낙하·침수 방지 상태가 적합하다.'),
    ],
    installation_inspection: [
        q('installation-base', '기초', '지반·바닥·받침철물과 침하 방지 조치가 적합하다.'),
        q('installation-spacing', '배치', '수직재·수평재 간격과 수직도를 승인도면 기준으로 확인했다.', false, '간격/수직도'),
        q('installation-brace', '보강', '가새·수평재·연결부와 이탈방지 장치를 빠짐없이 설치했다.'),
        q('installation-edge', '단부·개구부', '개구부·단차·단부 보강과 추락·낙하 방지 조치가 적합하다.', true),
        q('installation-zone', '구간통제', '설치·존치·해체금지 구간 표시가 실제 현장과 일치한다.'),
    ],
    pre_pour_inspection: [
        q('pour-drawing', '선행조건', '승인도면·구조검토 조건과 실제 설치상태가 일치한다.'),
        q('pour-connection', '설치완료', '지주·수평재·가새·상하부 잭과 연결부 체결을 완료했다.'),
        q('pour-deformation', '변형관리', '침하·변형·편심·집중하중 징후가 없음을 확인했다.', false, '수직도/처짐 측정값'),
        q('pour-sequence', '타설계획', '타설 순서·속도·장비 동선·편중 방지계획을 작업자와 공유했다.'),
        q('pour-hold', 'Hold Point', '공사·안전·품질 담당자가 타설 전 Hold Point를 확인했다.'),
    ],
    pre_dismantling_inspection: [
        q('dismantling-strength', '해체조건', '콘크리트 강도 또는 사용 종료 조건이 계획 기준을 충족한다.', false, '강도/확인값'),
        q('dismantling-approval', '승인', '해체 승인자와 해체 대상 동·층·구간을 확정했다.'),
        q('dismantling-sequence', '작업순서', '해체 순서·존치부·재동바리 조건을 작업자에게 교육했다.'),
        q('dismantling-control', '통제', '하부·인접구간 출입통제와 낙하물 방지조치를 완료했다.'),
        q('dismantling-equipment', '장비', '해체·양중 장비와 반출 동선의 안전상태를 확인했다.', true),
    ],
    daily_safety_log: [
        q('safety-tbm', '작업 전', '당일 작업·변경위험·금지사항을 TBM에서 공유했다.'),
        q('safety-ppe', '보호구', '작업자 보호구 착용과 추락방지 장비 상태를 확인했다.'),
        q('safety-weather', '환경', '기상·조도·통로·정리정돈 상태가 작업에 적합하다.', false, '기상/환경 측정값'),
        q('safety-zone', '통제', '장비반경·낙하위험·위험구간 출입통제를 유지했다.'),
        q('safety-change', '변경관리', '계획과 다른 현장조건·도면변경·추가위험을 확인하고 조치했다.', true),
        q('safety-close', '작업 종료', '작업 종료 후 잔류위험·미결조치·다음 작업 인계사항을 기록했다.'),
    ],
    photo_sheet: [
        q('photo-context', '촬영정보', '모든 사진에 실제 촬영시각·구간·설명 정보가 기록되어 있다.'),
        q('photo-coverage', '촬영범위', '전체·근접 사진으로 작업상태와 주요 확인점을 식별할 수 있다.'),
        q('photo-integrity', '증적', '사진은 원본에서 변조되지 않았으며 해당 실행기록과 직접 관련된다.'),
    ],
    final_handover: [
        q('handover-document', '문서', '최신 계획서 Rev.·승인도면·점검기록을 인계했다.'),
        q('handover-zone', '현장표시', '설치·존치·해체구간과 금지·통제구역을 현장에서 확인했다.'),
        q('handover-open-actions', '미결사항', '미결 조치의 내용·담당·기한을 인수자에게 전달했다.', true),
        q('handover-material', '자원', '잔여 자재·장비·폐기물과 반출계획을 확인했다.', true),
        q('handover-emergency', '안전', '비상연락망·책임자·현장 위험사항을 최종 확인했다.'),
    ],
};

const TRADE_OVERRIDES: Readonly<Record<ConstructionPlanTradeType, Partial<Record<ConstructionPlanRecordType, readonly ConstructionPlanRecordQuestion[]>>>> = {
    'system-shoring': {},
    'system-scaffold': {
        installation_inspection: [
            q('scaffold-base', '기초', '받침철물·깔판·기초 지지와 침하 방지 조치가 적합하다.'),
            q('scaffold-spacing', '배치', '수직재·수평재 간격과 수직도를 승인도면 기준으로 확인했다.', false, '간격/수직도'),
            q('scaffold-brace-tie', '보강', '가새·벽이음·앵커의 위치와 체결상태가 승인도면과 일치한다.'),
            q('scaffold-platform', '작업발판', '작업발판·안전난간·발끝막이판·승강통로가 적합하다.'),
            q('scaffold-falling', '낙하방지', '낙하물방지망·수직보호망·출입통제를 확인했다.', true),
        ],
        pre_pour_inspection: [
            q('scaffold-use-drawing', '사용 전', '승인도면과 실제 비계 설치상태가 일치한다.'),
            q('scaffold-use-tie', '벽이음', '벽이음·가새·연결핀·받침철물의 체결을 확인했다.'),
            q('scaffold-use-platform', '작업면', '발판·난간·승강통로·개구부 조치가 사용 가능한 상태다.'),
            q('scaffold-use-load', '하중', '자재 적치와 작업하중이 계획 범위를 넘지 않는다.', false, '적치/하중 확인값'),
            q('scaffold-use-hold', 'Hold Point', '공사·안전 담당자가 사용 전 Hold Point를 확인했다.'),
        ],
    },
};

const cloneQuestion = (question: ConstructionPlanRecordQuestion): ConstructionPlanRecordQuestion => ({
    ...question,
});

export const buildConstructionPlanRecordCatalog = (
    tradeType: ConstructionPlanTradeType,
    recordType: ConstructionPlanRecordType,
    version: string,
    questions: readonly ConstructionPlanRecordQuestion[],
): ConstructionPlanRecordCatalog => {
    const base = {
        schemaVersion: 1 as const,
        tradeType,
        recordType,
        version,
        questions: questions.map(cloneQuestion),
    };
    return { ...base, hash: sha256Hex(canonicalStringify(base)) };
};

export const getConstructionPlanRecordCatalog = (
    tradeType: ConstructionPlanTradeType,
    recordType: ConstructionPlanRecordType,
): ConstructionPlanRecordCatalog => {
    const questions = (TRADE_OVERRIDES[tradeType][recordType] ?? COMMON[recordType]).map(cloneQuestion);
    return buildConstructionPlanRecordCatalog(
        tradeType,
        recordType,
        `${tradeType}:${recordType}:v1`,
        questions,
    );
};

export const isConstructionPlanRecordType = (value: unknown): value is ConstructionPlanRecordType =>
    CONSTRUCTION_PLAN_RECORD_TYPES.includes(value as ConstructionPlanRecordType);

const cleanText = (value: unknown, maximum: number): string | undefined => {
    if (typeof value !== 'string') return undefined;
    const cleaned = value.normalize('NFKC').replace(/\s+/g, ' ').trim();
    return cleaned && cleaned.length <= maximum ? cleaned : undefined;
};

const cleanDate = (value: unknown): string | undefined => {
    const date = cleanText(value, 10);
    return date && /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00Z`))
        ? date
        : undefined;
};

export const normalizeConstructionPlanRecordResponses = (
    value: unknown,
    catalog: ConstructionPlanRecordCatalog,
): ConstructionPlanRecordResponse[] => {
    if (!Array.isArray(value) || value.length > catalog.questions.length) {
        throw new Error('construction-plan-record-responses-invalid');
    }
    const known = new Set(catalog.questions.map((question) => question.id));
    const seen = new Set<string>();
    return value.map((raw) => {
        if (!isUnknownRecord(raw)
            || Object.keys(raw).some((key) => ![
                'questionId', 'result', 'note', 'measuredValue', 'action',
            ].includes(key))) {
            throw new Error('construction-plan-record-response-invalid');
        }
        const questionId = cleanText(raw.questionId, 120);
        if (!questionId || !known.has(questionId) || seen.has(questionId)) {
            throw new Error('construction-plan-record-question-invalid');
        }
        seen.add(questionId);
        const result = raw.result;
        if (result !== undefined && !['pass', 'fail', 'not_applicable'].includes(String(result))) {
            throw new Error('construction-plan-record-result-invalid');
        }
        const note = cleanText(raw.note, 1000);
        const measuredValue = cleanText(raw.measuredValue, 300);
        let action: ConstructionPlanRecordResponse['action'];
        if (raw.action !== undefined) {
            if (!isUnknownRecord(raw.action)
                || Object.keys(raw.action).some((key) => ![
                    'description', 'owner', 'due', 'status', 'resolution',
                ].includes(key))) {
                throw new Error('construction-plan-record-action-invalid');
            }
            const description = cleanText(raw.action.description, 1000);
            const owner = cleanText(raw.action.owner, 200);
            const due = cleanDate(raw.action.due);
            const status = raw.action.status;
            const resolution = cleanText(raw.action.resolution, 1000);
            if (!description || !owner || !due || (status !== 'open' && status !== 'resolved')
                || (status === 'resolved' && !resolution)) {
                throw new Error('construction-plan-record-action-invalid');
            }
            action = { description, owner, due, status, ...(resolution ? { resolution } : {}) };
        }
        return {
            questionId,
            ...(result ? { result: result as ConstructionPlanChecklistResult } : {}),
            ...(note ? { note } : {}),
            ...(measuredValue ? { measuredValue } : {}),
            ...(action ? { action } : {}),
        };
    });
};

export const validateConstructionPlanRecordForConfirmation = (
    record: UnknownRecord,
    catalog: ConstructionPlanRecordCatalog,
): ConstructionPlanRecordValidationIssue[] => {
    const issues: ConstructionPlanRecordValidationIssue[] = [];
    const add = (code: string, path: string, message: string) => issues.push({ code, path, message });
    ['workDate', 'building', 'floor', 'zone'].forEach((field) => {
        const value = readTrimmedString(record, [field]);
        if (!value || (field === 'workDate' && !cleanDate(value))) {
            add(`scope.${field}`, field, `${field} 필수값이 없습니다.`);
        }
    });
    const workers = Array.isArray(record.actualWorkers) ? record.actualWorkers : [];
    if (workers.length < 1) add('workers.required', 'actualWorkers', '실제 참여 작업자를 1명 이상 기록해야 합니다.');
    if (record.recordType === 'equipment_daily_inspection'
        && (!Array.isArray(record.actualEquipment) || record.actualEquipment.length < 1)) {
        add('equipment.required', 'actualEquipment', '장비 일일점검에는 실제 장비가 필요합니다.');
    }
    let responses: ConstructionPlanRecordResponse[] = [];
    try {
        responses = normalizeConstructionPlanRecordResponses(record.responses, catalog);
    } catch {
        add('responses.invalid', 'responses', '체크리스트 응답 계약이 올바르지 않습니다.');
        return issues;
    }
    const byQuestion = new Map(responses.map((response) => [response.questionId, response]));
    catalog.questions.forEach((question) => {
        const response = byQuestion.get(question.id);
        if (!response?.result) {
            add('response.required', `responses.${question.id}`, '모든 문항을 판정해야 합니다.');
            return;
        }
        if (response.result === 'not_applicable' && (!question.allowNotApplicable || !response.note)) {
            add('response.na-reason', `responses.${question.id}.note`, '해당없음은 허용된 문항에 사유를 기록해야 합니다.');
        }
        if (response.result === 'fail' && (!response.note || !response.action)) {
            add('response.fail-action', `responses.${question.id}.action`, '부적합은 사유와 조치 담당·기한을 기록해야 합니다.');
        }
    });
    const photos = Array.isArray(record.photos) ? record.photos : [];
    if (record.recordType === 'photo_sheet' && photos.length < 1) {
        add('photos.required', 'photos', '사진대지 확인에는 사진이 1장 이상 필요합니다.');
    }
    return issues;
};

export const deriveConstructionPlanRecordDraftStatus = (record: UnknownRecord): 'draft' | 'incomplete' => {
    const responses = Array.isArray(record.responses) ? record.responses : [];
    const photos = Array.isArray(record.photos) ? record.photos : [];
    const workers = Array.isArray(record.actualWorkers) ? record.actualWorkers : [];
    const hasResponseData = responses.some((response) => isUnknownRecord(response)
        && (response.result !== undefined || response.note !== undefined
            || response.measuredValue !== undefined || response.action !== undefined));
    return hasResponseData || photos.length || workers.length ? 'incomplete' : 'draft';
};

export const constructionPlanRecordConfirmationHash = (record: UnknownRecord): string => {
    const content: UnknownRecord = {
        schemaVersion: record.schemaVersion,
        id: record.id,
        rootRecordId: record.rootRecordId,
        recordRevision: record.recordRevision,
        supersedesRecordId: record.supersedesRecordId ?? null,
        correctionReason: record.correctionReason ?? null,
        supersededConfirmationHash: record.supersededConfirmationHash ?? null,
        correctionLineage: record.correctionLineage ?? null,
        planBinding: record.planBinding,
        recordType: record.recordType,
        catalogVersion: record.catalogVersion,
        catalogHash: record.catalogHash,
        workDate: record.workDate,
        building: record.building,
        floor: record.floor,
        zone: record.zone,
        actualWorkers: record.actualWorkers,
        actualEquipment: record.actualEquipment,
        responses: record.responses,
        photos: record.photos,
        designatedConfirmerId: record.designatedConfirmerId ?? null,
        designatedConfirmerName: record.designatedConfirmerName ?? null,
        createdBy: record.createdBy,
        createdAt: record.createdAt,
    };
    return sha256Hex(canonicalStringify(content));
};
