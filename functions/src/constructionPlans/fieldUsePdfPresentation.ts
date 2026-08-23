export type ConstructionPlanPresentationTradeType = 'system-shoring' | 'system-scaffold';

const STATUS_LABELS: Readonly<Record<string, string>> = {
    not_started: '작성 전',
    draft: '작성 중',
    in_progress: '작성 중',
    complete: '작성완료',
    not_applicable: '해당없음',
    changes_requested: '수정요청',
    in_review: '검토 중',
    review_completed: '검토완료',
    approved_pending_issue: '발행대기',
    issued: '발행완료',
    superseded: '이전 개정',
    voided: '폐기',
};

const COLOR_LABELS: Readonly<Record<string, string>> = {
    blue: '파랑',
    red: '빨강',
    purple: '보라',
    orange: '주황',
    green: '초록',
    black: '검정',
    teal: '청록',
    gray: '회색',
    'construction-plan.install.stroke': '파랑',
    'construction-plan.install.fill': '연파랑',
    'construction-plan.dismantle.stroke': '주황',
    'construction-plan.dismantle.fill': '연주황',
    'construction-plan.retain.stroke': '빨강',
    'construction-plan.retain.fill': '연빨강',
    'construction-plan.equipment.stroke': '파랑',
    'construction-plan.equipment.fill': '연파랑',
    'construction-plan.pedestrian.stroke': '초록',
    'construction-plan.pedestrian.fill': '연초록',
    'construction-plan.lifting.stroke': '황색',
    'construction-plan.lifting.fill': '연황색',
    'construction-plan.restricted.stroke': '빨강',
    'construction-plan.restricted.fill': '연빨강',
    'construction-plan.storage.stroke': '초록',
    'construction-plan.storage.fill': '연초록',
};

const LAYER_LABELS: Readonly<Record<string, string>> = {
    install: '설치구간',
    dismantle: '해체구간',
    retain: '존치구간',
    equipment: '장비사용구간',
    pedestrian: '보행동선',
    lifting: '양중구간',
    restricted: '출입통제구간',
    storage: '자재적치구간',
};

const DASH_LABELS: Readonly<Record<string, string>> = {
    solid: '실선',
    dash: '파선',
    dot: '점선',
};

const HATCH_LABELS: Readonly<Record<string, string>> = {
    none: '없음',
    diagonal: '사선',
    cross: '교차선',
};

const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export const constructionPlanTradeDisplayName = (tradeType: unknown): string => (
    tradeType === 'system-scaffold' ? '시스템비계' : tradeType === 'system-shoring' ? '시스템동바리' : '공종 미확인'
);

export const constructionPlanStatusDisplayName = (status: unknown): string => (
    typeof status === 'string' && STATUS_LABELS[status] ? STATUS_LABELS[status] : '상태 미확인'
);

export const constructionPlanSectionPageLabel = (pageNumber: number): string => (
    `표준 페이지 ${String(pageNumber).padStart(2, '0')}`
);

export const formatConstructionPlanKstTimestamp = (value: unknown): string => {
    if (typeof value !== 'string' || !value.trim()) return '기록 없음';
    const epochMs = Date.parse(value);
    if (!Number.isFinite(epochMs)) return '기록 없음';
    return `${new Date(epochMs + (9 * 60 * 60 * 1_000)).toISOString().slice(0, 16).replace('T', ' ')} (KST)`;
};

export const abbreviateConstructionPlanSha256 = (value: unknown): string => {
    const normalized = typeof value === 'string' ? value.toLowerCase() : '';
    return SHA256_PATTERN.test(normalized) ? `SHA-256 ${normalized.slice(0, 16)}…` : 'SHA-256 기록 없음';
};

export const constructionPlanTemplateDisplay = (input: {
    tradeType: unknown;
    templateVersion: unknown;
    rendererVersion: unknown;
    schemaVersion: unknown;
    snapshotSchemaVersion: unknown;
}): string => {
    const renderer = input.rendererVersion === 'field-use-a4-v3'
        ? '서버 현장사용본 A4 렌더러 v3'
        : input.rendererVersion === 'field-use-a4-v2' || input.rendererVersion === 'a4-raster-v2'
            ? '서버 A4 렌더러 v2'
            : '서버 A4 렌더러';
    return `${constructionPlanTradeDisplayName(input.tradeType)} 표준 ${String(input.templateVersion || '-')} · ${renderer}`
        + ` · 문서구조 v${String(input.schemaVersion || '-')} · 승인스냅샷 v${String(input.snapshotSchemaVersion || '-')}`;
};

export const constructionPlanDrawingPanelTitle = (input: {
    drawingNo: unknown;
    pageIndex: number;
    revision: unknown;
}): string => `${String(input.drawingNo || '도면')} · 도면 ${input.pageIndex + 1}쪽 · 개정 ${String(input.revision || '-')}`;

export const constructionPlanDrawingSourceDisplay = (input: {
    sourceSha256: unknown;
    sourceGeneration: unknown;
    pageFingerprintHash: unknown;
}): string => `원본 ${abbreviateConstructionPlanSha256(input.sourceSha256)}`
    + ` · 원본 버전 ${String(input.sourceGeneration || '-')}`
    + ` · 페이지 지문 ${abbreviateConstructionPlanSha256(input.pageFingerprintHash)}`;

export const constructionPlanLayerDisplayName = (layer: unknown): string => (
    typeof layer === 'string' && LAYER_LABELS[layer] ? LAYER_LABELS[layer] : '구간 미확인'
);

export const constructionPlanAnnotationStyleDisplay = (style: Record<string, unknown>): string => {
    const color = (token: unknown, emptyLabel: string): string => (
        typeof token === 'string' && COLOR_LABELS[token] ? COLOR_LABELS[token] : emptyLabel
    );
    return `선색 ${color(style.strokeToken, '기본색')}`
        + ` · 채움 ${color(style.fillToken, '없음')}`
        + ` · 굵기 ${String(style.strokeWidthPt || '-')}pt`
        + ` · 불투명도 ${String(style.opacity ?? '-')}`
        + ` · 선형 ${DASH_LABELS[String(style.dash)] || '기본선'}`
        + ` · 해치 ${HATCH_LABELS[String(style.hatch)] || '없음'}`
        + (typeof style.fontSizePt === 'number' ? ` · 글자 ${String(style.fontSizePt)}pt` : '');
};
