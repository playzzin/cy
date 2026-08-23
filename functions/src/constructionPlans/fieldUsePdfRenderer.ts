import { readFileSync } from 'node:fs';
import { createCanvas, GlobalFonts, loadImage, type SKRSContext2D } from '@napi-rs/canvas';
import PDFDocument = require('pdfkit');
import { PDFParse } from 'pdf-parse';
import {
    canonicalStringify,
    CONSTRUCTION_PLAN_MAX_PHYSICAL_PAGE_COUNT,
    CONSTRUCTION_PLAN_MIN_PHYSICAL_PAGE_COUNT,
    CONSTRUCTION_PLAN_PAGE_COUNT,
    constructionPlanApprovalEvidenceContentForHash,
    isUnknownRecord,
    readTrimmedString,
    sha256Hex,
    type UnknownRecord,
} from './domain';
import {
    assertConstructionPlanDrawingSourceMagic,
    canonicalConstructionPlanDrawingPageFingerprint,
    CONSTRUCTION_PLAN_DRAWING_PREVIEW_MAX_RASTER_DIMENSION,
    normalizePdfPageRotation,
    pdfBoxFromView,
} from './drawingPreview';
import type { VerifiedApprovedSnapshot } from './serverPdfRenderer';
import {
    buildConstructionPlanStructuredSectionRows,
    CONSTRUCTION_PLAN_STRUCTURED_LEGACY_CONTENT_KEYS,
    CONSTRUCTION_PLAN_STRUCTURED_SECTION_CONTENT_KEYS,
    isConstructionPlanStructuredSectionKey,
    validateConstructionPlanStructuredSectionContent,
} from './structuredSectionContract';
import {
    constructionPlanRiskLevelFromScore,
    constructionPlanRiskScore,
    SYSTEM_SCAFFOLD_SERVER_TEMPLATE,
    SYSTEM_SHORING_SERVER_TEMPLATE,
    resolveConstructionPlanServerTemplate,
    type ConstructionPlanServerTemplateContract,
    type ConstructionPlanServerTemplatePage,
} from './templateContracts';
import {
    CONSTRUCTION_PLAN_BRAND_LOGO_SHA256,
    getConstructionPlanBrandLogoPng,
} from './brandAssets';
import {
    constructionPlanServerStandardTextRowsForRender,
    listConstructionPlanServerStandardTextEntries,
    resolveConstructionPlanServerStandardText,
    validateConstructionPlanServerStandardText,
} from './standardTextContract';
import {
    CONSTRUCTION_PLAN_ERP_REFRESH_FIELDS,
    CONSTRUCTION_PLAN_ERP_REFRESH_SLOT_SOURCE,
    isConstructionPlanErpRefreshFieldId,
    type ConstructionPlanErpRefreshSlot,
} from './erpRefreshContract';
import {
    abbreviateConstructionPlanSha256,
    constructionPlanAnnotationStyleDisplay,
    constructionPlanDrawingPanelTitle,
    constructionPlanDrawingSourceDisplay,
    constructionPlanLayerDisplayName,
    constructionPlanSectionPageLabel,
    constructionPlanStatusDisplayName,
    constructionPlanTemplateDisplay,
    constructionPlanTradeDisplayName,
    formatConstructionPlanKstTimestamp,
} from './fieldUsePdfPresentation';
import {
    CONSTRUCTION_PLAN_DRAWING_ANNOTATION_ATTRIBUTE_KEYS,
    CONSTRUCTION_PLAN_DRAWING_ANNOTATION_KEYS,
    CONSTRUCTION_PLAN_DRAWING_LAYER_CONTRACT,
    constructionPlanDrawingAnnotationLayerContractIssues,
} from './drawingAnnotationContract';
import {
    compositeConstructionPlanVectorDrawings,
    CONSTRUCTION_PLAN_VECTOR_DRAWING_COMPOSITOR_VERSION,
    type ConstructionPlanVectorAnnotation,
    type ConstructionPlanVectorDestinationPx,
    type ConstructionPlanVectorDrawingPanel,
} from './vectorDrawingCompositor';

export const CONSTRUCTION_PLAN_FIELD_USE_RENDERER_VERSION = 'server-field-use-v2';
export const CONSTRUCTION_PLAN_FIELD_USE_DRAWING_RENDER_MODE = 'verified-pdf-xobject-source-image-v1';
export const CONSTRUCTION_PLAN_FIELD_USE_MIN_PHYSICAL_PAGES = CONSTRUCTION_PLAN_MIN_PHYSICAL_PAGE_COUNT;
export const CONSTRUCTION_PLAN_FIELD_USE_MAX_PHYSICAL_PAGES = CONSTRUCTION_PLAN_MAX_PHYSICAL_PAGE_COUNT;

export type ConstructionPlanFieldUseProfile = 'candidate' | 'issued';
export type ConstructionPlanFieldUseDrawingMimeType = 'application/pdf' | 'image/png' | 'image/jpeg';

export interface ConstructionPlanFieldUseDrawingSourceRef {
    drawingId: string;
    storagePath: string;
    sourceSha256: string;
    sourceGeneration: string;
    mimeType: ConstructionPlanFieldUseDrawingMimeType;
    sizeBytes: number;
    pageCount: number;
}

export interface ConstructionPlanFieldUseDrawingSource {
    bytes: Buffer;
    storagePath: string;
    sourceGeneration: string;
    mimeType: ConstructionPlanFieldUseDrawingMimeType;
}

export type ConstructionPlanFieldUseDrawingSourceLoader = (
    source: ConstructionPlanFieldUseDrawingSourceRef,
) => Promise<ConstructionPlanFieldUseDrawingSource>;

export interface RenderConstructionPlanFieldUsePdfInput {
    profile: ConstructionPlanFieldUseProfile;
    verifiedSnapshot: VerifiedApprovedSnapshot;
    approvalEvidenceHash: string;
    approvalEvidence: UnknownRecord;
    loadDrawingSource: ConstructionPlanFieldUseDrawingSourceLoader;
}

export interface ConstructionPlanFieldUseDrawingBinding {
    slot: string;
    drawingId: string;
    drawingNo: string;
    storagePath: string;
    sourceGeneration: string;
    sourceSha256: string;
    mimeType: ConstructionPlanFieldUseDrawingMimeType;
    pageIndex: number;
    pageFingerprint: string;
    cropBoxPt: PdfBox;
    rotation: 0 | 90 | 180 | 270;
    annotationCount: number;
    annotationHash: string;
    bindingHash: string;
}

export type ConstructionPlanFieldUseLeafDisposition = 'visible' | 'audit' | 'control' | 'rejected';

export interface ConstructionPlanFieldUseLeafLedgerEntry {
    path: string;
    valueHash: string;
    disposition: ConstructionPlanFieldUseLeafDisposition;
    pageNumber: number;
}

export interface ConstructionPlanFieldUsePageManifest {
    /** @deprecated physicalPageNumber is the authoritative physical identity. */
    pageNumber: number;
    physicalPageNumber: number;
    logicalPageNumber: number;
    continuationIndex: number;
    sectionKey: string;
    title: string;
    required: boolean;
    templateContractHash: string;
    payloadHash: string;
    coveragePaths: string[];
    coverageLedger: ConstructionPlanFieldUseLeafLedgerEntry[];
    drawingBindings: ConstructionPlanFieldUseDrawingBinding[];
    drawingBindingHash: string;
}

export interface ConstructionPlanFieldUsePdfResult {
    profile: ConstructionPlanFieldUseProfile;
    releaseEligible: boolean;
    rendererVersion: typeof CONSTRUCTION_PLAN_FIELD_USE_RENDERER_VERSION;
    drawingRenderMode: typeof CONSTRUCTION_PLAN_FIELD_USE_DRAWING_RENDER_MODE;
    bytes: Buffer;
    sha256: string;
    sizeBytes: number;
    pageCount: number;
    fileName: string;
    snapshotHash: string;
    approvalEvidenceHash: string;
    approvedContentHash: string;
    templateHash: string;
    manifestHash: string;
    templateBundleHash: string;
    templateBindingHash: string;
    rendererTemplateBundleHash: string;
    rendererBuildHash: string;
    renderInputHash: string;
    contentManifestHash: string;
    zeroOmissionCoverageHash: string;
    drawingBindingHash: string;
    coverageLedger: ConstructionPlanFieldUseLeafLedgerEntry[];
    pageManifest: ConstructionPlanFieldUsePageManifest[];
}

type ConstructionPlanFieldUseProvenance = Omit<ConstructionPlanFieldUsePdfResult, 'bytes' | 'sha256' | 'sizeBytes' | 'fileName'>;

interface PdfBox {
    left: number;
    bottom: number;
    right: number;
    top: number;
}

interface CoverageEntry {
    path: string;
    value: unknown;
    valueHash: string;
}

interface HumanRow {
    label: string;
    value: string;
    sourcePath?: string;
}

interface PreparedDrawingPage {
    pageIndex: number;
    bytes: Buffer;
    width: number;
    height: number;
    cropBoxPt: PdfBox;
    rotation: 0 | 90 | 180 | 270;
    pageFingerprint: string;
}

interface PreparedDrawing {
    record: UnknownRecord;
    source: ConstructionPlanFieldUseDrawingSourceRef;
    sourceBytes: Buffer;
    pages: PreparedDrawingPage[];
}

interface PdfJsPageProxy {
    view?: unknown;
    rotate?: unknown;
    getViewport?: (parameters: { scale: number }) => { width: number; height: number };
    cleanup?: () => void;
}

interface PdfJsDocumentProxy {
    getPage: (pageNumber: number) => Promise<PdfJsPageProxy>;
}

interface DrawingPanelModel {
    slot: string;
    decision: UnknownRecord;
    drawing?: PreparedDrawing;
    selectedPage?: PreparedDrawingPage;
    annotations: UnknownRecord[];
    binding?: ConstructionPlanFieldUseDrawingBinding;
    vectorDestinationPx?: ConstructionPlanVectorDestinationPx;
}

interface FieldUsePageModel {
    contract: ConstructionPlanServerTemplatePage;
    title: string;
    coverage: CoverageEntry[];
    rows: HumanRow[];
    drawingPanels: DrawingPanelModel[];
    templateContractHash: string;
    payloadHash: string;
    physicalPageNumber: number;
    continuationIndex: number;
    coveragePaths: string[];
    usesRowContinuationLayout: boolean;
}

const A4_WIDTH_PT = 595.28;
const A4_HEIGHT_PT = 841.89;
const PAGE_WIDTH_PX = 1240;
const PAGE_HEIGHT_PX = 1754;
const PAGE_MARGIN_PX = 68;
const FOOTER_Y_PX = 1605;
const FIELD_USE_FONT_FAMILY = 'Construction Plan Field Use Noto Sans KR';
const JPEG_QUALITY = 92;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const EXECUTION_FORM_PAGES = new Set([13, 28, 39, 40, 41, 42]);
const EXECUTION_FORM_EMPTY_NOTICE = '현장 실행용 빈 양식 · 발행 시점 미실시';
const EXECUTION_FORM_EVIDENCE_NOTICE = '공란·체크박스·서명란은 승인 증적이 아니며 실제 작업일에 기록해야 합니다.';
const MAX_SOURCE_BYTES = 50 * 1024 * 1024;
const MAX_OUTPUT_PDF_BYTES = 100 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 20_000;
const MAX_ANNOTATION_FONT_SIZE_PT = 72;
const MAX_ANNOTATION_VERTICES = 200;
const MIN_BODY_FONT_PX = 14.6;
const MIN_ANNOTATION_CALLOUT_FONT_PX = 13.6;

const FONT_FILES = [
    'noto-sans-kr-korean-400-normal.woff2',
    'noto-sans-kr-latin-400-normal.woff2',
    'noto-sans-kr-korean-700-normal.woff2',
    'noto-sans-kr-latin-700-normal.woff2',
] as const;

const drawingSlotsByPage = (
    contract: ConstructionPlanServerTemplateContract,
): Readonly<Record<number, readonly string[]>> => Object.fromEntries(
    contract.pages.filter((page) => page.drawingSlots.length > 0)
        .map((page) => [page.pageNumber, page.drawingSlots]),
);

const CHECKLIST_ROWS: Readonly<Record<number, readonly string[]>> = {
    13: ['외관·구조부 손상', '안전장치 작동', '와이어·후크 상태', '제동·조향장치', '아웃트리거·지반상태', '검사 유효기간', '운전원 자격', '신호수 배치'],
    39: ['지반 및 받침상태', '지주 간격·수직도', '수평재·가새 설치', '상·하부 잭 체결', '연결부 이탈방지', '개구부·단차 보강', '존치·해체금지 표시', '타설 전 최종 Hold Point'],
    40: ['작업 전 외관점검', '누유·이상소음', '안전장치·경보', '작업반경 통제', '운전원·신호수 확인', '일일 작업 종료점검'],
};

const HANDOVER_ROWS = ['계획서·승인도면 최신본 인계', '설치·존치·해체구간 현장표시', '미결사항 및 금지구역 전달', '장비·자재·점검기록 인계', '비상연락망·책임자 확인'] as const;
const HOLD_POINT_ROWS = ['승인도면·구조검토 조건 일치', '지주·수평재·가새 설치 완료', '상·하부 잭 및 연결부 체결', '개구부·단부 보강', '존치·해체금지 구간 표시', '타설순서·속도·장비동선 확인'] as const;
const HOLD_POINT_DECISION_LABELS = ['Hold Point 결정 기록', '담당자 성명·소속', '확인자 성명·소속', '판단 일시', '결정: □ 승인  □ 조건부 승인  □ 반려', '조건·조치 및 재확인 사항', '담당자 서명', '확인자 서명'] as const;
const HANDOVER_SIGNATURE_LABELS = ['인수인계 서명 및 미결사항 기록', '미결사항·특기사항', '인계자 성명·소속·일시·서명', '인수자 성명·소속·일시·서명', '현장관리자 성명·소속·일시·서명', '안전관리자 성명·소속·일시·서명'] as const;
const BLANK_PERSON_LINES = ['성명: ____________________', '소속: ____________________', '일시: ____________________', '서명: ____________________'] as const;

const PAGE_STANDARD_COPY: Readonly<Record<number, readonly HumanRow[]>> = {
    5: [
        { label: '적용범위', value: '본 계획서는 승인된 현장·동·층·구간의 시스템동바리 설치, 사용, 존치 및 해체 작업에 적용한다.' },
        { label: '우선 기준', value: '승인도면과 승인된 구조검토 문서를 우선 적용하고 상충 시 작업을 중지하여 기술검토를 요청한다.' },
        { label: '변경관리', value: '현장조건·공법·부재·장비·구간이 변경되면 변경내용을 기록하고 승인 절차를 다시 거친다.' },
    ],
    8: [
        { label: '반입검수', value: '수직재·수평재·가새·잭·받침·연결핀의 외관, 규격, 변형, 부식 및 수량을 확인한다.' },
        { label: '체결부 확인', value: '핀·쐐기·볼트 등 체결부의 손상과 누락을 확인하고 부적합품은 즉시 식별한다.' },
        { label: '보관·격리', value: '부재는 종류별로 평탄한 장소에 적치하고 부적합품은 사용가능품과 분리·격리한다.' },
    ],
    12: [
        { label: '작업 전', value: '작업바닥, 추락방호, 비상정지장치, 장비 상태와 작업구간 출입통제를 확인한다.' },
        { label: '작업 중', value: '구조물·가설재·전선·다른 장비와의 간섭을 감시하고 정해진 신호에 따라 운전한다.' },
        { label: '중지조건', value: '지반 침하, 장비 이상, 통제구역 침입, 신호 두절 또는 시야 불량 시 즉시 작업을 중지한다.' },
    ],
    14: [
        { label: '신호체계', value: '신호수를 지정하고 수신호·무전 신호를 작업 전 공유하며 하나의 지휘체계를 유지한다.' },
        { label: '출입통제', value: '장비 회전·양중 반경과 낙하 위험구역을 표시하고 관계자 외 출입을 통제한다.' },
        { label: '통신 이상', value: '신호가 불명확하거나 통신이 끊기면 장비를 안전상태로 정지한 뒤 재확인한다.' },
    ],
    15: [
        { label: '하중전달', value: '상부 하중은 받침·잭·수직재·기초로 연속 전달되도록 설치하고 편심과 국부집중을 방지한다.' },
        { label: '부재 역할', value: '수평재와 가새는 수직재의 좌굴과 변형을 억제하도록 승인도면의 배치에 맞춰 체결한다.' },
        { label: '현장 적용값', value: '실제 부재 간격, 잭 조정범위와 보강조건은 본 문서의 승인 구조값 및 승인도면을 참조한다.' },
    ],
    16: [
        { label: '수직재·수평재', value: '수직하중 전달과 골조 구속 역할을 하며 변형·손상·부식 여부를 반입 및 설치 전에 확인한다.' },
        { label: '가새·연결부', value: '수평 안정성과 접합 연속성을 확보하며 핀·쐐기·볼트의 체결과 이탈방지 상태를 확인한다.' },
        { label: '잭·받침', value: '상·하부 지지와 높이 조정을 담당하며 나사부, 받침면, 편심 및 지지상태를 확인한다.' },
    ],
    18: [
        { label: '1단계', value: '작업구간 통제, 기초상태 확인, 기준선 표시 후 하부 받침과 수직재를 배치한다.' },
        { label: '2단계', value: '수평재와 가새를 순차 체결하고 수직도·간격·연결상태를 확인한다.' },
        { label: '3단계', value: '상부 지지부를 설치하고 승인도면·구조값과 대조한 뒤 검측을 요청한다.' },
    ],
    19: [
        { label: '조립원칙', value: '수직재를 안정시킨 뒤 수평재를 폐합하고 연결핀·쐐기·볼트를 완전 체결한다.' },
        { label: '진행관리', value: '조립 높이에 따라 작업발판과 추락방호를 선행하고 미완성 골조에는 임시 안정조치를 둔다.' },
        { label: '검측', value: '수직도, 간격, 체결, 받침 및 변형을 구간별로 확인하고 부적합은 다음 공정 전에 조치한다.' },
    ],
    20: [
        { label: '가새 설치', value: '승인도면의 방향·구간·연속성에 맞춰 가새를 설치하고 양단 접합을 확실히 체결한다.' },
        { label: '상부 지지', value: '상부 받침면을 밀착시키고 편심·들뜸·국부하중이 발생하지 않도록 조정한다.' },
        { label: '해체 원칙', value: '해체 승인 후 설치의 역순으로 진행하며 안정에 필요한 가새와 지지는 선행 제거하지 않는다.' },
    ],
    29: [
        { label: '하중경로', value: '상부에서 기초까지 하중전달 경로의 단절·편심·침하 가능성을 점검한다.' },
        { label: '핵심 관리', value: '기초, 수직재, 수평재, 가새, 잭, 상부지지와 접합부를 승인 구조값·도면에 따라 관리한다.' },
        { label: '변경관리', value: '부재·간격·하중·타설순서·현장조건 변경 시 구조검토와 승인을 다시 확인한다.' },
    ],
    30: [
        { label: '설치 착수', value: '기준선·기초·자재·작업구역을 확인한 뒤 승인도면의 구간 순서에 따라 설치한다.' },
        { label: '중간 확인', value: '단계별 수직도·간격·체결·가새·작업발판·추락방호 상태를 확인한다.' },
        { label: '완료 검측', value: '상부 지지와 구간표시까지 완료한 뒤 체크리스트와 승인도면으로 최종 검측한다.' },
    ],
    31: [
        { label: '타설 전', value: 'Hold Point 승인, 장비 동선, 타설순서, 하중 편중 방지 및 감시자를 확인한다.' },
        { label: '타설 중', value: '변형·침하·이상음·접합부 이완을 감시하고 이상 발견 시 타설을 즉시 중지한다.' },
        { label: '타설 후', value: '변형과 지지상태를 재확인하고 존치조건을 충족할 때까지 임의 조정·해체하지 않는다.' },
    ],
    32: [
        { label: '해체 승인', value: '강도·존치조건·작업구간 통제와 해체순서가 확인된 후에만 해체를 시작한다.' },
        { label: '역순 해체', value: '하중과 골조 안정성을 유지하며 설치의 역순으로 단계 해체하고 투하를 금지한다.' },
        { label: '중지조건', value: '예상 밖 변형, 잔류하중, 간섭 또는 통제구역 침입이 확인되면 즉시 작업을 중지한다.' },
    ],
    33: [
        { label: '존치구간', value: '승인도면과 구조검토에서 지정한 존치·재동바리 구간을 현장에 명확히 표시한다.' },
        { label: '변경 금지', value: '승인 없는 이동·완화·부분해체를 금지하고 손상 또는 이완 시 담당자에게 즉시 보고한다.' },
        { label: '인계', value: '존치상태, 금지구역, 점검결과와 향후 해체조건을 다음 작업조에 인계한다.' },
    ],
    34: [
        { label: 'ITP', value: '반입·설치·타설 전·존치·해체 단계별 검사 및 시험계획과 확인 책임자를 운영한다.' },
        { label: '부적합', value: '부적합을 식별·격리하고 원인·조치·재검사 결과를 기록한 뒤 다음 공정을 진행한다.' },
        { label: '기록관리', value: '승인도면, 구조값, 검측표, 사진과 변경기록을 문서번호·개정번호로 추적 관리한다.' },
    ],
    35: [
        { label: '중점 위험', value: '붕괴·추락·낙하·끼임 위험을 작업단계별로 확인하고 방호·통제·신호 조치를 시행한다.' },
        { label: '작업중지', value: '승인조건 불일치, 구조 이상, 방호 미설치 또는 통제 실패 시 누구든 작업중지를 요청할 수 있다.' },
        { label: '재개조건', value: '위험요인 조치와 책임자 재확인이 완료된 뒤 작업자에게 변경내용을 공유하고 재개한다.' },
    ],
    37: [
        { label: '초동조치', value: '이상 발견 즉시 작업중지, 장비 정지, 대피 및 위험구역 통제를 실시한다.' },
        { label: '보고·검토', value: '현장책임자와 관계자에게 보고하고 원인·영향·추가 위험을 검토한다.' },
        { label: '재승인', value: '복구·보강·변경조치 후 점검과 필요한 기술검토·승인을 완료해야 작업을 재개한다.' },
    ],
    38: [
        { label: '5S', value: '정리·정돈·청소·청결·습관화를 통해 자재와 작업공간을 상시 관리한다.' },
        { label: '현장관리', value: '적치·폐기·통로·조도·분진·소음을 관리하고 비상통로와 소방시설 접근을 확보한다.' },
        { label: '인수인계', value: '작업 종료 시 잔재·폐기물·통로·조명 상태와 미결 환경조치를 다음 작업조에 인계한다.' },
    ],
};

const SCAFFOLD_PAGE_STANDARD_COPY: Readonly<Record<number, readonly HumanRow[]>> = {
    ...PAGE_STANDARD_COPY,
    5: [
        { label: '적용범위', value: '본 계획서는 승인된 현장·동·층·구간의 시스템비계 설치, 사용, 점검, 변경 및 해체 작업에 적용한다.' },
        { label: '우선 기준', value: '승인도면과 승인된 구조검토 문서를 우선 적용하고 상충 시 사용을 중지하여 기술검토를 요청한다.' },
        { label: '변경관리', value: '벽이음·작업발판·승강로·방호구조 또는 설치구간을 변경하면 변경내용을 기록하고 승인 절차를 다시 거친다.' },
    ],
    8: [
        { label: '반입검수', value: '수직재·수평재·가새·벽이음·발판·받침철물의 외관, 규격, 변형, 부식 및 수량을 확인한다.' },
        { label: '체결부 확인', value: '핀·쐐기·볼트·앵커 등 체결부의 손상과 누락을 확인하고 부적합품은 즉시 식별한다.' },
        { label: '보관·격리', value: '비계 부재는 종류별로 평탄한 장소에 적치하고 손상품과 부적합품은 사용가능품과 분리·격리한다.' },
    ],
    15: [
        { label: '구조 원칙', value: '수직하중과 풍하중이 받침철물·수직재·벽이음·기초로 안전하게 전달되도록 연속적으로 설치한다.' },
        { label: '부재 역할', value: '수평재·가새·벽이음은 비계틀의 변형과 전도를 억제하도록 승인도면의 간격과 배치에 맞춰 체결한다.' },
        { label: '현장 적용값', value: '실제 틀 간격, 벽이음 간격, 작업발판 폭과 보강조건은 승인 구조값 및 승인도면을 참조한다.' },
    ],
    16: [
        { label: '수직재·수평재', value: '비계틀의 골조를 구성하며 변형·손상·부식 여부와 연결부 체결상태를 반입 및 설치 전에 확인한다.' },
        { label: '가새·벽이음', value: '수평 안정성과 전도 방지를 담당하며 앵커, 클램프 및 양단 접합의 이탈방지 상태를 확인한다.' },
        { label: '발판·방호구조', value: '작업발판, 안전난간, 발끝막이, 낙하물방지망과 승강로의 손상·고정·연속성을 확인한다.' },
    ],
    18: [
        { label: '1단계', value: '작업구간 통제, 지반·기초 확인, 기준선 표시 후 받침철물과 수직재를 배치한다.' },
        { label: '2단계', value: '수평재·가새·벽이음을 순차 체결하고 수직도·간격·접합상태를 확인한다.' },
        { label: '3단계', value: '작업발판·승강로·난간·발끝막이·낙하방지망을 설치하고 사용 전 검측을 요청한다.' },
    ],
    19: [
        { label: '조립원칙', value: '받침철물을 평탄하게 고정하고 수직재를 세운 뒤 수평재를 폐합하여 비계틀을 안정시킨다.' },
        { label: '진행관리', value: '조립 높이에 따라 작업발판과 추락방호를 선행하고 미완성 비계틀에는 임시 안정조치를 둔다.' },
        { label: '검측', value: '받침, 수직도, 틀 간격, 체결과 변형을 구간별로 확인하고 부적합은 다음 조립 전에 조치한다.' },
    ],
    20: [
        { label: '가새 설치', value: '승인도면의 방향·구간·연속성에 맞춰 가새를 설치하고 양단 접합을 확실히 체결한다.' },
        { label: '벽이음 설치', value: '승인된 수직·수평 간격으로 벽이음을 구조물에 연결하고 앵커·클램프·접합부를 점검한다.' },
        { label: '해체 원칙', value: '해체 승인 후 설치의 역순으로 진행하며 안정에 필요한 가새와 벽이음은 선행 제거하지 않는다.' },
    ],
    29: [
        { label: '하중경로', value: '작업발판에서 수직재·받침·기초로 이어지는 수직하중과 벽이음을 통한 수평하중 경로를 점검한다.' },
        { label: '핵심 관리', value: '기초, 받침철물, 수직재, 수평재, 가새, 벽이음, 작업발판과 방호구조를 승인값·도면에 따라 관리한다.' },
        { label: '변경관리', value: '부재·간격·벽이음·발판·하중·현장조건 변경 시 구조검토와 승인을 다시 확인한다.' },
    ],
    30: [
        { label: '설치 착수', value: '기준선·기초·자재·작업구역을 확인한 뒤 승인도면의 비계 구간 순서에 따라 설치한다.' },
        { label: '중간 확인', value: '단계별 수직도·간격·체결·가새·벽이음·작업발판·추락방호 상태를 확인한다.' },
        { label: '완료 검측', value: '승강로·난간·발끝막이·낙하방지망과 사용금지 표시까지 완료한 뒤 사용 전 검측한다.' },
    ],
    31: [
        { label: '작업발판', value: '작업발판은 뜨지 않게 고정하고 단차·틈새·돌출부와 재료 적치로 인한 통로 저해를 방지한다.' },
        { label: '승강통로', value: '승강로는 전용 설비로 연속 설치하고 출입구와 개구부에 추락·임의 개방 방지조치를 둔다.' },
        { label: '방호구조', value: '안전난간, 중간난간, 발끝막이와 낙하물방지망의 연속성을 확인하고 임의 해체를 금지한다.' },
    ],
    32: [
        { label: '해체 승인', value: '사용자 퇴거, 적치물 제거, 작업구간 통제와 해체순서가 확인된 후에만 시스템비계 해체를 시작한다.' },
        { label: '역순 해체', value: '낙하방지망·발끝막이·난간·발판을 단계별로 해체하고 비계틀의 안정을 유지하며 부재 투하를 금지한다.' },
        { label: '중지조건', value: '벽이음 선행 제거, 비계틀 변형, 간섭 또는 통제구역 침입이 확인되면 즉시 작업을 중지한다.' },
    ],
    33: [
        { label: '정기점검', value: '기초·받침·수직재·가새·벽이음·발판·난간·망의 이탈, 이완, 변형과 부식을 주기적으로 점검한다.' },
        { label: '변경 금지', value: '승인 없는 벽이음·가새·발판·방호구조의 이동, 완화 또는 부분해체를 금지하고 이상 시 즉시 보고한다.' },
        { label: '인계', value: '점검결과, 사용금지 구역, 보수내용과 향후 해체조건을 다음 작업조와 현장 관리자에게 인계한다.' },
    ],
    34: [
        { label: 'ITP', value: '반입·설치·사용 전·사용 중·변경·해체 단계별 검사계획과 확인 책임자를 운영한다.' },
        ...(PAGE_STANDARD_COPY[34] || []).slice(1),
    ],
};

const SCAFFOLD_CHECKLIST_ROWS: Readonly<Record<number, readonly string[]>> = {
    ...CHECKLIST_ROWS,
    39: ['지반·받침철물 상태', '수직재 간격·수직도', '수평재·가새 체결', '벽이음·앵커 체결', '작업발판 고정·틈새', '안전난간·발끝막이', '승강로·낙하방지망', '사용 전 Hold Point'],
    40: ['기초·받침 침하 여부', '수직재·수평재·가새 이완', '벽이음·앵커 손상', '발판·난간·발끝막이 상태', '승강로·방지망 상태', '변경·보수·사용금지 표시'],
};
const SCAFFOLD_HOLD_POINT_ROWS = ['승인도면·구조검토 조건 일치', '받침철물·수직재·수평재 설치 완료', '가새·벽이음·앵커 체결', '작업발판·승강로 설치', '난간·발끝막이·낙하방지망 설치', '사용구간 통제·표시 확인'] as const;

const pageStandardCopyFor = (contract: ConstructionPlanServerTemplateContract) => (
    contract.tradeType === 'system-scaffold' ? SCAFFOLD_PAGE_STANDARD_COPY : PAGE_STANDARD_COPY
);
const checklistRowsFor = (contract: ConstructionPlanServerTemplateContract) => (
    contract.tradeType === 'system-scaffold' ? SCAFFOLD_CHECKLIST_ROWS : CHECKLIST_ROWS
);
const holdPointRowsFor = (contract: ConstructionPlanServerTemplateContract) => (
    contract.tradeType === 'system-scaffold' ? SCAFFOLD_HOLD_POINT_ROWS : HOLD_POINT_ROWS
);

const ALLOWED_GENERIC_SECTION_CONTENT_KEYS = new Set([
    'summary', 'scope', 'owner', 'precondition', 'inspection', 'body', 'responsibleTeamName',
    'workMethod', 'note', 'drawingId', 'drawingPageIndex', 'drawingPageIndexes',
    'standardTextVersion', 'standardTextCurrent',
]);

const ALLOWED_SECTION_CONTENT_KEYS = new Set([
    ...ALLOWED_GENERIC_SECTION_CONTENT_KEYS,
    ...CONSTRUCTION_PLAN_STRUCTURED_SECTION_CONTENT_KEYS,
]);

const CANONICAL_RECORD_KEYS = {
    project: new Set(['capturedAt', 'siteName', 'address', 'clientName', 'contractorName', 'constructionPeriod', 'buildings', 'floors', 'zones', 'sitePhotos', 'emergencyContactsComplete', 'differsFromMaster']),
    constructionPeriod: new Set(['startDate', 'endDate']),
    erpSnapshot: new Set(['schemaVersion', 'capturedAt', 'site', 'clientCompany', 'contractorCompany', 'partnerCompany', 'responsibleTeam', 'fieldProvenance']),
    erpSource: new Set(['value', 'source', 'sourceId', 'sourceUpdatedAt', 'capturedAt', 'overridden']),
    erpFieldProvenance: new Set(['source', 'sourceId', 'sourceUpdatedAt', 'capturedAt', 'captureKind', 'sourceMasterHash', 'appliedBy', 'appliedAt', 'changeReason', 'auditEventId']),
    erpSite: new Set(['id', 'name', 'code', 'address', 'startDate', 'endDate', 'status', 'responsibleTeamId', 'responsibleTeamName', 'clientCompanyId', 'clientCompanyName', 'contractorCompanyId', 'contractorCompanyName', 'partnerCompanyId', 'partnerCompanyName', 'siteType', 'imageUrl', 'photos']),
    erpCompany: new Set(['id', 'name', 'code', 'businessNumber', 'representativeName', 'address', 'phone', 'fax', 'email', 'type', 'status']),
    erpTeam: new Set(['id', 'name', 'type', 'leaderWorkerId', 'leaderName', 'companyId', 'companyName', 'parentTeamId', 'parentTeamName', 'status']),
    organization: new Set(['capturedAt', 'sourceSiteId', 'assignments', 'additionalWorkers', 'workerDirectoryProvenance']),
    workerDirectoryProvenance: new Set(['captureKind', 'sourceSiteId', 'sourceTeamId', 'capturedAt', 'sourceMasterHash', 'sourceWorkerIds', 'appliedBy', 'appliedAt', 'changeReason', 'auditEventId']),
    assignment: new Set(['id', 'role', 'label', 'required', 'worker', 'responsibilities', 'order', 'externalAssignment', 'exceptionReason']),
    worker: new Set(['id', 'name', 'role', 'position', 'teamId', 'teamName', 'siteId', 'status']),
    section: new Set(['id', 'key', 'title', 'kind', 'order', 'pageNumbers', 'required', 'status', 'content', 'placeholders', 'containsExampleValues', 'standardTextModified', 'standardTextModificationReason', 'notApplicableReason', 'updatedAt', 'updatedBy']),
    engineering: new Set(['key', 'value', 'unit', 'sourceDocumentId', 'sourceRevision', 'sourcePageOrSection', 'applicableZones', 'verificationStatus', 'verifiedBy', 'verifiedAt', 'manualInputReason']),
    equipment: new Set(['id', 'category', 'equipmentName', 'model', 'registrationNo', 'ratedCapacity', 'workRadius', 'inspectionValidUntil', 'operatorWorkerId', 'signalerWorkerId', 'workZones', 'plannedStages', 'controlMeasures']),
    risk: new Set(['id', 'assessmentMethodVersion', 'workStage', 'hazard', 'initialProbability', 'initialSeverity', 'initialRiskLevel', 'mitigationMeasures', 'responsibleWorkerId', 'residualProbability', 'residualSeverity', 'residualRiskLevel', 'methodReference', 'reviewTrigger', 'verifiedBy']),
    drawing: new Set(['id', 'planId', 'storagePath', 'sourceSha256', 'sourceGeneration', 'originalFileName', 'mimeType', 'sizeBytes', 'pageCount', 'drawingNo', 'title', 'revision', 'approvalStatus', 'approvalReference', 'building', 'floor', 'zone', 'applicableZones', 'scaleText', 'previewStatus', 'previewPaths', 'previewErrorCode', 'previewErrorMessage', 'previewUpdatedAt', 'pages', 'annotations', 'uploadedBy', 'uploadedAt']),
    drawingPage: new Set(['pageIndex', 'mediaBoxPt', 'cropBoxPt', 'rotation', 'pageFingerprint', 'previewPath', 'previewGeneration', 'previewSha256']),
    pdfBox: new Set(['left', 'bottom', 'right', 'top']),
    drawingDecision: new Set(['drawingSlot', 'decision', 'drawingId', 'reason', 'reviewedBy', 'technicalReviewReference']),
} as const;

const LAYER_STYLE: Readonly<Record<string, { stroke: string; fill: string; dash: number[]; label: string }>> =
    Object.fromEntries(Object.entries(CONSTRUCTION_PLAN_DRAWING_LAYER_CONTRACT).map(([layer, contract]) => [layer, {
        stroke: contract.stroke,
        fill: contract.fill,
        dash: contract.dash === 'dash' ? [18, 10] : contract.dash === 'dot' ? [4, 9] : [],
        label: contract.label,
    }]));

const COLOR_TOKENS: Readonly<Record<string, string>> = {
    blue: '#1677ff', red: '#dc2626', purple: '#7c3aed', orange: '#d97706', green: '#059669',
    black: '#111827', teal: '#0f766e', gray: '#9ca3af',
    ...Object.fromEntries(Object.values(CONSTRUCTION_PLAN_DRAWING_LAYER_CONTRACT).flatMap((contract) => [
        [contract.strokeToken, contract.stroke],
        [contract.fillToken, contract.fill],
    ])),
};

const MARKER_TYPES = new Set(['pin', 'warning', 'hold', 'inspection', 'sequence', 'equipment', 'access']);

if (SYSTEM_SHORING_SERVER_TEMPLATE.pages.length !== CONSTRUCTION_PLAN_PAGE_COUNT
    || SYSTEM_SCAFFOLD_SERVER_TEMPLATE.pages.length !== CONSTRUCTION_PLAN_PAGE_COUNT) {
    throw new Error('construction-plan-field-use-page-title-count-invalid');
}

let registeredFontAssets: Array<{ fileName: string; sha256: string }> | null = null;
let searchableFontBytes: Buffer | null = null;

const fontPath = (fileName: string): string => require.resolve(`@fontsource/noto-sans-kr/files/${fileName}`);

const ensureFieldUseFonts = (): Array<{ fileName: string; sha256: string }> => {
    if (registeredFontAssets) return registeredFontAssets.map((asset) => ({ ...asset }));
    registeredFontAssets = FONT_FILES.map((fileName) => {
        const bytes = readFileSync(fontPath(fileName));
        GlobalFonts.register(bytes, FIELD_USE_FONT_FAMILY);
        if (fileName === FONT_FILES[0]) searchableFontBytes = bytes;
        return { fileName, sha256: sha256Hex(bytes) };
    });
    if (!GlobalFonts.has(FIELD_USE_FONT_FAMILY) || !searchableFontBytes) {
        throw new Error('construction-plan-field-use-font-registration-failed');
    }
    return registeredFontAssets.map((asset) => ({ ...asset }));
};

const staticRendererContract = {
    rendererVersion: CONSTRUCTION_PLAN_FIELD_USE_RENDERER_VERSION,
    drawingRenderMode: CONSTRUCTION_PLAN_FIELD_USE_DRAWING_RENDER_MODE,
    vectorDrawingCompositorVersion: CONSTRUCTION_PLAN_VECTOR_DRAWING_COMPOSITOR_VERSION,
    page: { widthPx: PAGE_WIDTH_PX, heightPx: PAGE_HEIGHT_PX, widthPt: A4_WIDTH_PT, heightPt: A4_HEIGHT_PT },
    maxDrawingRasterDimension: CONSTRUCTION_PLAN_DRAWING_PREVIEW_MAX_RASTER_DIMENSION,
    maxOutputPdfBytes: MAX_OUTPUT_PDF_BYTES,
    jpegQuality: JPEG_QUALITY,
    pageContracts: [SYSTEM_SHORING_SERVER_TEMPLATE, SYSTEM_SCAFFOLD_SERVER_TEMPLATE],
    drawingSlotsByTrade: {
        'system-shoring': drawingSlotsByPage(SYSTEM_SHORING_SERVER_TEMPLATE),
        'system-scaffold': drawingSlotsByPage(SYSTEM_SCAFFOLD_SERVER_TEMPLATE),
    },
    pageStandardCopyByTrade: {
        'system-shoring': PAGE_STANDARD_COPY,
        'system-scaffold': SCAFFOLD_PAGE_STANDARD_COPY,
    },
    serverStandardTextCatalogs: {
        'system-shoring': listConstructionPlanServerStandardTextEntries(SYSTEM_SHORING_SERVER_TEMPLATE),
        'system-scaffold': listConstructionPlanServerStandardTextEntries(SYSTEM_SCAFFOLD_SERVER_TEMPLATE),
    },
    checklistRowsByTrade: {
        'system-shoring': CHECKLIST_ROWS,
        'system-scaffold': SCAFFOLD_CHECKLIST_ROWS,
    },
    holdPointRowsByTrade: {
        'system-shoring': HOLD_POINT_ROWS,
        'system-scaffold': SCAFFOLD_HOLD_POINT_ROWS,
    },
    handoverRows: HANDOVER_ROWS,
    brandLogoSha256: CONSTRUCTION_PLAN_BRAND_LOGO_SHA256,
    annotationKinds: ['rect', 'polygon', 'polyline', 'ellipse', 'marker', 'text'],
    minimumBodyFontPx: MIN_BODY_FONT_PX,
    minimumAnnotationCalloutFontPx: MIN_ANNOTATION_CALLOUT_FONT_PX,
    auditFooterFontPx: 12.5,
    holdPointDecisionLabels: HOLD_POINT_DECISION_LABELS,
    handoverSignatureLabels: HANDOVER_SIGNATURE_LABELS,
    blankPersonLines: BLANK_PERSON_LINES,
    sectionContentKeys: Array.from(ALLOWED_SECTION_CONTENT_KEYS).sort(),
    overflowPolicy: 'fail-closed-no-truncation',
    tocPolicy: 'pages-5-through-42-split-19-19',
};

/** Digest of the exact JavaScript/TypeScript module bytes executing the render. */
export const getConstructionPlanFieldUseRendererBuildHash = (): string => sha256Hex(canonicalStringify([
    ['fieldUsePdfRenderer', __filename],
    ['vectorDrawingCompositor', require.resolve('./vectorDrawingCompositor')],
    ['standardTextContract', require.resolve('./standardTextContract')],
    ['templateContracts', require.resolve('./templateContracts')],
    ['brandAssets', require.resolve('./brandAssets')],
    ['pdfLibPackage', require.resolve('pdf-lib/package.json')],
    ['pdfLibFontkitPackage', require.resolve('@pdf-lib/fontkit/package.json')],
].map(([moduleName, fileName]) => ({ moduleName, sha256: sha256Hex(readFileSync(fileName)) }))));

export const getConstructionPlanFieldUseTemplateBundleHash = (): string => sha256Hex(canonicalStringify({
    ...staticRendererContract,
    fontAssets: ensureFieldUseFonts(),
}));

const assertSha256 = (value: string, code: string): string => {
    const normalized = String(value || '').trim().toLowerCase();
    if (!SHA256_PATTERN.test(normalized)) throw new Error(code);
    return normalized;
};

const assertProfile = (profile: unknown): ConstructionPlanFieldUseProfile => {
    if (profile !== 'candidate' && profile !== 'issued') {
        throw new Error('construction-plan-field-use-profile-invalid');
    }
    return profile;
};

const assertApprovalEvidenceContent = (
    rawEvidence: unknown,
    evidenceHash: string,
    content: UnknownRecord,
    snapshotHash: string,
): UnknownRecord => {
    let normalized: UnknownRecord;
    try {
        normalized = constructionPlanApprovalEvidenceContentForHash(rawEvidence);
    } catch (_error) {
        throw new Error('construction-plan-field-use-approval-evidence-content-invalid');
    }
    if (!isUnknownRecord(rawEvidence)
        || canonicalStringify(rawEvidence) !== canonicalStringify(normalized)
        || sha256Hex(canonicalStringify(normalized)) !== evidenceHash
        || normalized.planId !== content.planId
        || normalized.contentHash !== snapshotHash) {
        throw new Error('construction-plan-field-use-approval-evidence-binding-invalid');
    }
    return normalized;
};

const FIELD_USE_TEMPLATE_BINDING_KEYS = new Set([
    'schemaVersion', 'templateRecordId', 'templateKey', 'tradeType', 'templateId',
    'templateVersion', 'rendererVersion', 'logicalPageCount', 'manifestHash',
    'templateBundleHash', 'templateHash', 'lifecycleVersionAtCapture', 'publishedAt',
    'capturedAt',
]);

const assertFieldUseTemplateBinding = (
    content: UnknownRecord,
    contract: ConstructionPlanServerTemplateContract,
    selectedRendererBundleHash: string,
): {
    binding: UnknownRecord;
    templateHash: string;
    manifestHash: string;
    templateBundleHash: string;
    templateBindingHash: string;
} => {
    if (!isUnknownRecord(content.templateBinding)
        || Object.keys(content.templateBinding).some((key) => !FIELD_USE_TEMPLATE_BINDING_KEYS.has(key))) {
        throw new Error('construction-plan-field-use-template-binding-invalid');
    }
    const binding = content.templateBinding;
    const templateHash = assertSha256(String(binding.templateHash || ''), 'construction-plan-field-use-template-hash-invalid');
    const manifestHash = assertSha256(String(binding.manifestHash || ''), 'construction-plan-field-use-manifest-hash-invalid');
    const templateBundleHash = assertSha256(String(binding.templateBundleHash || ''), 'construction-plan-field-use-bound-template-bundle-hash-invalid');
    const templateBindingHash = sha256Hex(canonicalStringify(binding));
    if (binding.schemaVersion !== 1
        || binding.tradeType !== contract.tradeType
        || binding.templateId !== contract.templateId
        || binding.templateVersion !== contract.templateVersion
        || binding.rendererVersion !== contract.rendererVersion
        || binding.logicalPageCount !== contract.pageCount
        || !Number.isInteger(binding.lifecycleVersionAtCapture)
        || Number(binding.lifecycleVersionAtCapture) < 1
        || typeof binding.templateRecordId !== 'string' || !binding.templateRecordId
        || typeof binding.templateKey !== 'string' || !binding.templateKey
        || typeof binding.publishedAt !== 'string' || !Number.isFinite(Date.parse(binding.publishedAt))
        || typeof binding.capturedAt !== 'string' || !Number.isFinite(Date.parse(binding.capturedAt))
        || templateBundleHash !== selectedRendererBundleHash
        || content.templateHash !== templateHash
        || content.manifestHash !== manifestHash
        || content.templateBundleHash !== templateBundleHash
        || content.templateBindingHash !== templateBindingHash) {
        throw new Error('construction-plan-field-use-template-binding-mismatch');
    }
    return { binding, templateHash, manifestHash, templateBundleHash, templateBindingHash };
};

const sectionByKey = (content: UnknownRecord, key: string): UnknownRecord => {
    const sections = Array.isArray(content.sections) ? content.sections : [];
    const section = sections.find((entry) => isUnknownRecord(entry) && entry.key === key);
    if (!isUnknownRecord(section)) throw new Error(`construction-plan-field-use-section-missing:${key}`);
    return section;
};

const assertKnownSectionContent = (
    content: UnknownRecord,
    contract: ConstructionPlanServerTemplateContract,
): void => {
    const sections = content.sections as unknown[];
    sections.forEach((rawSection, index) => {
        if (!isUnknownRecord(rawSection) || !isUnknownRecord(rawSection.content)) {
            throw new Error(`construction-plan-field-use-section-content-invalid:${index}`);
        }
        const sectionKey = readTrimmedString(rawSection, ['key']);
        const standardIssues = validateConstructionPlanServerStandardText(contract, rawSection);
        if (standardIssues.length > 0) {
            throw new Error(`construction-plan-field-use-standard-text-invalid:${sectionKey}:${standardIssues[0].code}`);
        }
        if (isConstructionPlanStructuredSectionKey(sectionKey)) {
            const issues = validateConstructionPlanStructuredSectionContent(sectionKey, rawSection.content);
            if (issues.length > 0) {
                const first = issues[0];
                throw new Error(`construction-plan-field-use-structured-section-invalid:${sectionKey}:${first.code}:${first.path}`);
            }
            return;
        }
        Object.keys(rawSection.content).forEach((key) => {
            if (!ALLOWED_GENERIC_SECTION_CONTENT_KEYS.has(key)) {
                throw new Error(`construction-plan-field-use-section-content-unknown:${rawSection.key}:${key}`);
            }
        });
        ['summary', 'scope', 'owner', 'precondition', 'inspection', 'body', 'responsibleTeamName', 'workMethod', 'note', 'drawingId', 'standardTextVersion', 'standardTextCurrent']
            .forEach((key) => {
                const value = rawSection.content[key];
                if (value !== undefined && typeof value !== 'string') {
                    throw new Error(`construction-plan-field-use-section-content-type-invalid:${rawSection.key}:${key}`);
                }
            });
        const pageIndex = rawSection.content.drawingPageIndex;
        if (pageIndex !== undefined && (!Number.isInteger(pageIndex) || Number(pageIndex) < 0)) {
            throw new Error(`construction-plan-field-use-drawing-page-index-invalid:${rawSection.key}`);
        }
        const pageIndexes = rawSection.content.drawingPageIndexes;
        if (pageIndexes !== undefined) {
            if (!isUnknownRecord(pageIndexes)) {
                throw new Error(`construction-plan-field-use-drawing-page-index-map-invalid:${rawSection.key}`);
            }
            Object.entries(pageIndexes).forEach(([slot, value]) => {
                if (!/^D-0[1-6]$/.test(slot) || !Number.isInteger(value) || Number(value) < 0) {
                    throw new Error(`construction-plan-field-use-drawing-page-index-map-invalid:${rawSection.key}:${slot}`);
                }
            });
        }
    });
};

const assertCanonicalRecordShapes = (content: UnknownRecord): void => {
    const exact = (value: unknown, allowed: ReadonlySet<string>, path: string): UnknownRecord => {
        if (!isUnknownRecord(value)) throw new Error(`construction-plan-field-use-record-invalid:${path}`);
        const unknown = Object.keys(value).filter((key) => !allowed.has(key));
        if (unknown.length) throw new Error(`construction-plan-field-use-record-field-unknown:${path}:${unknown.join(',')}`);
        return value;
    };
    const records = (value: unknown, allowed: ReadonlySet<string>, path: string): UnknownRecord[] => {
        if (!Array.isArray(value)) throw new Error(`construction-plan-field-use-record-array-invalid:${path}`);
        return value.map((entry, index) => exact(entry, allowed, `${path}[${index}]`));
    };
    const project = exact(content.projectSnapshot, CANONICAL_RECORD_KEYS.project, 'projectSnapshot');
    if (project.constructionPeriod !== undefined) exact(project.constructionPeriod, CANONICAL_RECORD_KEYS.constructionPeriod, 'projectSnapshot.constructionPeriod');
    if (content.erpSnapshot !== undefined) {
        const erp = exact(content.erpSnapshot, CANONICAL_RECORD_KEYS.erpSnapshot, 'erpSnapshot');
        if (erp.schemaVersion !== 1 || typeof erp.capturedAt !== 'string' || !Number.isFinite(Date.parse(erp.capturedAt))) {
            throw new Error('construction-plan-field-use-erp-snapshot-invalid');
        }
        const sourceEnvelopes = new Map<string, UnknownRecord>();
        const source = (key: string, valueKeys: ReadonlySet<string>, expectedSource: 'site' | 'company' | 'team'): void => {
            const envelope = exact(erp[key], CANONICAL_RECORD_KEYS.erpSource, `erpSnapshot.${key}`);
            if (envelope.source !== expectedSource || typeof envelope.overridden !== 'boolean') {
                throw new Error(`construction-plan-field-use-erp-source-invalid:erpSnapshot.${key}`);
            }
            const value = exact(envelope.value, valueKeys, `erpSnapshot.${key}.value`);
            if (typeof envelope.sourceId !== 'string' || envelope.sourceId.trim() === ''
                || value.id !== envelope.sourceId
                || typeof envelope.capturedAt !== 'string' || !Number.isFinite(Date.parse(envelope.capturedAt))) {
                throw new Error(`construction-plan-field-use-erp-binding-invalid:erpSnapshot.${key}`);
            }
            sourceEnvelopes.set(key, envelope);
        };
        source('site', CANONICAL_RECORD_KEYS.erpSite, 'site');
        ['clientCompany', 'contractorCompany', 'partnerCompany'].forEach((key) => {
            if (erp[key] !== undefined) source(key, CANONICAL_RECORD_KEYS.erpCompany, 'company');
        });
        if (erp.responsibleTeam !== undefined) source('responsibleTeam', CANONICAL_RECORD_KEYS.erpTeam, 'team');
        if (erp.fieldProvenance !== undefined) {
            if (!isUnknownRecord(erp.fieldProvenance)) {
                throw new Error('construction-plan-field-use-erp-field-provenance-invalid');
            }
            Object.entries(erp.fieldProvenance).forEach(([fieldId, rawEntry]) => {
                if (!isConstructionPlanErpRefreshFieldId(fieldId)) {
                    throw new Error(`construction-plan-field-use-erp-field-provenance-id-invalid:${fieldId}`);
                }
                const entry = exact(
                    rawEntry,
                    CANONICAL_RECORD_KEYS.erpFieldProvenance,
                    `erpSnapshot.fieldProvenance.${fieldId}`,
                );
                const [slot, field] = fieldId.split('.') as [ConstructionPlanErpRefreshSlot, string];
                const envelope = sourceEnvelopes.get(slot);
                const sourceValue = envelope && isUnknownRecord(envelope.value) ? envelope.value : undefined;
                const refreshEvidence = [entry.appliedBy, entry.appliedAt, entry.changeReason, entry.auditEventId];
                if (!envelope || !sourceValue || sourceValue[field] === undefined
                    || entry.source !== CONSTRUCTION_PLAN_ERP_REFRESH_SLOT_SOURCE[slot]
                    || entry.sourceId !== envelope.sourceId
                    || typeof entry.capturedAt !== 'string' || !Number.isFinite(Date.parse(entry.capturedAt))
                    || typeof entry.sourceMasterHash !== 'string' || !SHA256_PATTERN.test(entry.sourceMasterHash)
                    || (entry.captureKind !== 'initial' && entry.captureKind !== 'refresh')
                    || (entry.captureKind === 'initial' && refreshEvidence.some((value) => value !== undefined))
                    || (entry.captureKind === 'refresh' && refreshEvidence.some((value) => (
                        typeof value !== 'string' || value.trim() === ''
                    )))
                    || (entry.captureKind === 'refresh' && String(entry.changeReason).trim().length < 5)) {
                    throw new Error(`construction-plan-field-use-erp-field-provenance-binding-invalid:${fieldId}`);
                }
            });
        }
        sourceEnvelopes.forEach((envelope, slotValue) => {
            if (envelope.overridden !== true || !isUnknownRecord(envelope.value)) return;
            const slot = slotValue as ConstructionPlanErpRefreshSlot;
            CONSTRUCTION_PLAN_ERP_REFRESH_FIELDS[slot].forEach((field) => {
                if ((envelope.value as UnknownRecord)[field] !== undefined
                    && (!isUnknownRecord(erp.fieldProvenance)
                        || !isUnknownRecord(erp.fieldProvenance[`${slot}.${field}`]))) {
                    throw new Error(`construction-plan-field-use-erp-field-provenance-missing:${slot}.${field}`);
                }
            });
        });
    }
    const organization = exact(content.organizationSnapshot, CANONICAL_RECORD_KEYS.organization, 'organizationSnapshot');
    records(organization.assignments, CANONICAL_RECORD_KEYS.assignment, 'organizationSnapshot.assignments').forEach((assignment, index) => {
        if (assignment.worker !== undefined) exact(assignment.worker, CANONICAL_RECORD_KEYS.worker, `organizationSnapshot.assignments[${index}].worker`);
    });
    records(organization.additionalWorkers, CANONICAL_RECORD_KEYS.worker, 'organizationSnapshot.additionalWorkers');
    if (organization.workerDirectoryProvenance !== undefined) {
        const provenance = exact(
            organization.workerDirectoryProvenance,
            CANONICAL_RECORD_KEYS.workerDirectoryProvenance,
            'organizationSnapshot.workerDirectoryProvenance',
        );
        const refreshEvidence = [
            provenance.appliedBy, provenance.appliedAt, provenance.changeReason, provenance.auditEventId,
        ];
        if ((provenance.captureKind !== 'initial' && provenance.captureKind !== 'refresh')
            || provenance.sourceSiteId !== organization.sourceSiteId
            || typeof provenance.capturedAt !== 'string' || !Number.isFinite(Date.parse(provenance.capturedAt))
            || typeof provenance.sourceMasterHash !== 'string' || !SHA256_PATTERN.test(provenance.sourceMasterHash)
            || !Array.isArray(provenance.sourceWorkerIds)
            || provenance.sourceWorkerIds.length > 500
            || provenance.sourceWorkerIds.some((workerId) => typeof workerId !== 'string' || !workerId.trim())
            || new Set(provenance.sourceWorkerIds).size !== provenance.sourceWorkerIds.length
            || (provenance.captureKind === 'initial' && refreshEvidence.some((value) => value !== undefined))
            || (provenance.captureKind === 'refresh' && refreshEvidence.some((value) => (
                typeof value !== 'string' || value.trim() === ''
            )))
            || (provenance.captureKind === 'refresh' && String(provenance.changeReason).trim().length < 5)) {
            throw new Error('construction-plan-field-use-worker-directory-provenance-invalid');
        }
    }
    records(content.sections, CANONICAL_RECORD_KEYS.section, 'sections');
    records(content.engineeringValues, CANONICAL_RECORD_KEYS.engineering, 'engineeringValues');
    records(content.equipmentPlan, CANONICAL_RECORD_KEYS.equipment, 'equipmentPlan');
    records(content.riskAssessments, CANONICAL_RECORD_KEYS.risk, 'riskAssessments');
    records(content.drawingApplicability, CANONICAL_RECORD_KEYS.drawingDecision, 'drawingApplicability');
    records(content.drawings, CANONICAL_RECORD_KEYS.drawing, 'drawings').forEach((drawing, drawingIndex) => {
        records(drawing.pages, CANONICAL_RECORD_KEYS.drawingPage, `drawings[${drawingIndex}].pages`).forEach((page, pageIndex) => {
            exact(page.mediaBoxPt, CANONICAL_RECORD_KEYS.pdfBox, `drawings[${drawingIndex}].pages[${pageIndex}].mediaBoxPt`);
            exact(page.cropBoxPt, CANONICAL_RECORD_KEYS.pdfBox, `drawings[${drawingIndex}].pages[${pageIndex}].cropBoxPt`);
        });
        if (!Array.isArray(drawing.annotations)) throw new Error(`construction-plan-field-use-record-array-invalid:drawings[${drawingIndex}].annotations`);
    });
};

const assertFieldUseContentReady = (
    verifiedSnapshot: VerifiedApprovedSnapshot,
): ConstructionPlanServerTemplateContract => {
    const { content, envelope, snapshotHash } = verifiedSnapshot;
    if (!isUnknownRecord(envelope) || envelope.kind !== 'review_submission'
        || envelope.snapshotSchemaVersion !== 2 || content.snapshotSchemaVersion !== 2
        || envelope.planId !== content.planId
        || !isUnknownRecord(envelope.content)
        || canonicalStringify(envelope.content) !== canonicalStringify(content)
        || sha256Hex(Buffer.from(canonicalStringify(envelope), 'utf8')) !== snapshotHash) {
        throw new Error('construction-plan-field-use-approved-snapshot-v2-binding-invalid');
    }
    const requiredStrings = ['planId', 'siteId', 'title', 'documentNo', 'documentDate', 'templateId', 'templateVersion', 'rendererVersion', 'createdBy', 'createdAt'];
    requiredStrings.forEach((key) => {
        if (!readTrimmedString(content, [key])) throw new Error(`construction-plan-field-use-required-value-missing:${key}`);
    });
    let contract: ConstructionPlanServerTemplateContract;
    try {
        contract = resolveConstructionPlanServerTemplate({
            tradeType: content.tradeType,
            templateId: content.templateId,
            templateVersion: content.templateVersion,
        });
    } catch {
        throw new Error('construction-plan-field-use-template-identity-invalid');
    }
    if (content.rendererVersion !== contract.rendererVersion
        || content.schemaVersion !== contract.schemaVersion
        || !Number.isInteger(content.revision) || Number(content.revision) < 0) {
        throw new Error('construction-plan-field-use-document-identity-invalid');
    }
    const expectedSections = Array.from(new Set(contract.pages.map((page) => page.sectionKey)));
    if (!Array.isArray(content.sections) || content.sections.length !== expectedSections.length
        || !Array.isArray(content.sectionOrder)
        || content.sectionOrder.length !== expectedSections.length
        || !content.sectionOrder.every((key, index) => key === expectedSections[index])) {
        throw new Error('construction-plan-field-use-sections-invalid');
    }
    content.sections.forEach((section, index) => {
        if (!isUnknownRecord(section)) throw new Error(`construction-plan-field-use-section-invalid:${index}`);
        if (section.required === true && section.status !== 'complete') {
            throw new Error(`construction-plan-field-use-required-section-incomplete:${section.key}`);
        }
        if (Array.isArray(section.placeholders) && section.placeholders.length > 0) {
            throw new Error(`construction-plan-field-use-section-placeholder:${section.key}`);
        }
        if (section.containsExampleValues === true) {
            throw new Error(`construction-plan-field-use-section-example-value:${section.key}`);
        }
    });
    const requiredArrays: Array<[string, number]> = [
        ['engineeringValues', 1], ['equipmentPlan', 1], ['riskAssessments', 1],
    ];
    requiredArrays.forEach(([key, minimum]) => {
        const value = content[key];
        if (!Array.isArray(value) || value.length < minimum) {
            throw new Error(`construction-plan-field-use-capacity-invalid:${key}`);
        }
    });
    if (!isUnknownRecord(content.projectSnapshot) || !Array.isArray(content.projectSnapshot.sitePhotos)) {
        throw new Error('construction-plan-field-use-project-snapshot-invalid');
    }
    if (content.projectSnapshot.sitePhotos.length > 0) {
        throw new Error('construction-plan-field-use-immutable-photo-artifact-required');
    }
    if (!isUnknownRecord(content.organizationSnapshot)
        || !Array.isArray(content.organizationSnapshot.assignments)
        || content.organizationSnapshot.assignments.length < 1
        || !Array.isArray(content.organizationSnapshot.additionalWorkers)) {
        throw new Error('construction-plan-field-use-organization-capacity-invalid');
    }
    return contract;
};

const coverageEntry = (path: string, value: unknown): CoverageEntry => ({
    path,
    value,
    valueHash: sha256Hex(canonicalStringify(value)),
});

const addArrayCoverage = (
    result: Map<number, CoverageEntry[]>,
    pageNumber: number,
    path: string,
    value: unknown,
): void => {
    if (!Array.isArray(value)) throw new Error(`construction-plan-field-use-array-invalid:${path}`);
    const target = result.get(pageNumber) || [];
    if (value.length === 0) target.push(coverageEntry(path, value));
    else value.forEach((entry, index) => target.push(coverageEntry(`${path}[${index}]`, entry)));
    result.set(pageNumber, target);
};

/** Assigns every canonical snapshot root exactly once to a physical page. */
export const buildConstructionPlanFieldUseCoverage = (
    content: UnknownRecord,
    resolvedContract?: ConstructionPlanServerTemplateContract,
): Map<number, CoverageEntry[]> => {
    const contract = resolvedContract ?? resolveConstructionPlanServerTemplate({
        tradeType: content.tradeType,
        templateId: content.templateId,
        templateVersion: content.templateVersion,
    });
    const result = new Map<number, CoverageEntry[]>();
    const assign = (page: number, path: string, value: unknown): void => {
        result.set(page, [...(result.get(page) || []), coverageEntry(path, value)]);
    };
    const pageOneKeys = ['planId', 'siteId', 'title', 'tradeType', 'documentNo', 'documentDate', 'revision'];
    const pageTwoKeys = [
        'snapshotSchemaVersion', 'seriesId', 'lineageRootPlanId', 'revisionReason', 'revisionType',
        'sourceSnapshotHash', 'sourceRevisionNo', 'clonedFromPlanId', 'supersedesPlanId', 'templateId',
        'templateVersion', 'rendererVersion', 'schemaVersion', 'createdBy', 'createdByName', 'createdAt',
        'templateBinding', 'templateHash', 'manifestHash', 'templateBundleHash', 'templateBindingHash',
        'templateMigration',
    ];
    pageOneKeys.forEach((key) => { if (content[key] !== undefined) assign(1, key, content[key]); });
    pageTwoKeys.forEach((key) => { if (content[key] !== undefined) assign(2, key, content[key]); });
    assign(3, 'sectionOrder', content.sectionOrder);
    assign(6, 'projectSnapshot', content.projectSnapshot);
    if (content.erpSnapshot !== undefined) assign(6, 'erpSnapshot', content.erpSnapshot);
    assign(7, 'organizationSnapshot', content.organizationSnapshot);

    if (!Array.isArray(content.sections)) throw new Error('construction-plan-field-use-sections-invalid');
    content.sections.forEach((section, index) => {
        if (!isUnknownRecord(section)) throw new Error(`construction-plan-field-use-section-invalid:${index}`);
        const key = readTrimmedString(section, ['key']);
        const page = key ? contract.pages.find((candidate) => candidate.sectionKey === key) : undefined;
        if (!key || !page) throw new Error(`construction-plan-field-use-section-contract-invalid:${index}`);
        assign(page.pageNumber, `sections[${index}]`, section);
    });
    addArrayCoverage(result, 22, 'drawings', content.drawings);
    addArrayCoverage(result, 22, 'drawingApplicability', content.drawingApplicability);
    addArrayCoverage(result, 17, 'engineeringValues', content.engineeringValues);
    addArrayCoverage(result, 9, 'equipmentPlan', content.equipmentPlan);
    addArrayCoverage(result, 36, 'riskAssessments', content.riskAssessments);

    const assignedRoots = new Set<string>();
    result.forEach((entries) => entries.forEach((entry) => assignedRoots.add(entry.path.replace(/\[\d+\]$/, ''))));
    const missing = Object.keys(content).filter((key) => !assignedRoots.has(key));
    if (missing.length) throw new Error(`construction-plan-field-use-unassigned-content:${missing.join(',')}`);
    return result;
};

const flattenCoverageLeaves = (
    path: string,
    value: unknown,
    result: Array<{ path: string; valueHash: string }> = [],
): Array<{ path: string; valueHash: string }> => {
    if (Array.isArray(value)) {
        if (value.length === 0) result.push({ path, valueHash: sha256Hex(canonicalStringify(value)) });
        else value.forEach((entry, index) => flattenCoverageLeaves(`${path}[${index}]`, entry, result));
        return result;
    }
    if (isUnknownRecord(value)) {
        const keys = Object.keys(value).sort();
        if (keys.length === 0) result.push({ path, valueHash: sha256Hex(canonicalStringify(value)) });
        else keys.forEach((key) => flattenCoverageLeaves(`${path}.${key}`, value[key], result));
        return result;
    }
    result.push({ path, valueHash: sha256Hex(canonicalStringify(value)) });
    return result;
};

const classifyLeafDisposition = (
    path: string,
    structuredSectionIndexes: ReadonlySet<number>,
): ConstructionPlanFieldUseLeafDisposition => {
    if (/\.sitePhotos(?:\[|$)/.test(path)) return 'control';
    if (/^erpSnapshot\.site\.value\.(?:photos|imageUrl)(?:\.|\[|$)/.test(path)) return 'control';
    if (/^erpSnapshot\.(?:clientCompany|contractorCompany|partnerCompany)\.value\.email$/.test(path)) return 'audit';
    if (/^erpSnapshot\.fieldProvenance(?:\.|\[|$)/.test(path)
        || /^organizationSnapshot\.workerDirectoryProvenance(?:\.|\[|$)/.test(path)) return 'audit';
    if (/^templateBinding(?:\.|\[|$)/.test(path)) return 'audit';
    const legacyMatch = path.match(/^sections\[(\d+)\]\.content\.([^.\[]+)$/);
    if (legacyMatch
        && structuredSectionIndexes.has(Number(legacyMatch[1]))
        && CONSTRUCTION_PLAN_STRUCTURED_LEGACY_CONTENT_KEYS.has(legacyMatch[2])) return 'audit';
    if (/^drawings\[\d+\]\.(?:previewStatus|previewPaths|previewErrorCode|previewErrorMessage|previewUpdatedAt)(?:\.|\[|$)/.test(path)
        || /^drawings\[\d+\]\.pages\[/.test(path)) return 'control';
    if (/^drawings\[\d+\]\.(?:storagePath|sourceSha256|sourceGeneration|mimeType|sizeBytes|uploadedBy|uploadedAt)(?:\.|\[|$)/.test(path)
        || /^drawings\[\d+\]\.annotations\[\d+\]\.(?:createdBy|createdAt|updatedBy|updatedAt|locked|styleVersion)$/.test(path)) return 'audit';
    if (/^(?:createdBy|createdAt)$/.test(path) || /^sections\[\d+\]\.(?:updatedAt|updatedBy)$/.test(path)) return 'audit';
    if (/^(?:sectionOrder)(?:\.|\[|$)/.test(path)
        || /^drawings\[\d+\]\.planId$/.test(path)
        || /^sections\[\d+\]\.(?:id|key|title|kind|order|pageNumbers|placeholders|containsExampleValues)(?:\.|\[|$)/.test(path)) return 'control';
    return 'visible';
};

export const buildConstructionPlanFieldUseLeafLedger = (
    coverage: Map<number, CoverageEntry[]>,
): ConstructionPlanFieldUseLeafLedgerEntry[] => {
    const structuredSectionIndexes = new Set<number>();
    coverage.forEach((entries) => entries.forEach((entry) => {
        const match = entry.path.match(/^sections\[(\d+)\]$/);
        if (match && isUnknownRecord(entry.value)
            && isConstructionPlanStructuredSectionKey(entry.value.key)) {
            structuredSectionIndexes.add(Number(match[1]));
        }
    }));
    const ledger = Array.from(coverage.entries()).flatMap(([pageNumber, entries]) => entries.flatMap((entry) => (
        flattenCoverageLeaves(entry.path, entry.value).map((leaf) => ({
            ...leaf,
            disposition: classifyLeafDisposition(leaf.path, structuredSectionIndexes),
            pageNumber,
        }))
    ))).sort((left, right) => left.path.localeCompare(right.path, 'en') || left.pageNumber - right.pageNumber);
    const seen = new Set<string>();
    ledger.forEach((entry) => {
        if (seen.has(entry.path)) throw new Error(`construction-plan-field-use-leaf-duplicate:${entry.path}`);
        seen.add(entry.path);
        if (entry.disposition === 'rejected') throw new Error(`construction-plan-field-use-leaf-rejected:${entry.path}`);
    });
    if (ledger.length === 0) throw new Error('construction-plan-field-use-leaf-ledger-empty');
    return ledger;
};

const primitiveText = (value: unknown): string => {
    if (value === undefined || value === null || value === '') return '-';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
    return canonicalStringify(value);
};

const sectionRows = (section: UnknownRecord): HumanRow[] => {
    const rows: HumanRow[] = [
        { label: '작성상태', value: constructionPlanStatusDisplayName(section.status) },
        { label: '필수 절', value: section.required === true ? '예' : '아니오' },
        { label: '표준문구 변경', value: section.standardTextModified === true ? '변경' : '변경없음' },
    ];
    if (section.notApplicableReason !== undefined) rows.push({ label: '해당없음 사유', value: primitiveText(section.notApplicableReason) });
    if (section.standardTextModificationReason !== undefined) rows.push({ label: '표준문구 변경사유', value: primitiveText(section.standardTextModificationReason) });
    const content = isUnknownRecord(section.content) ? section.content : {};
    const sectionKey = readTrimmedString(section, ['key']);
    if (isConstructionPlanStructuredSectionKey(sectionKey)) {
        return [
            ...rows,
            ...buildConstructionPlanStructuredSectionRows(sectionKey, content).map((row, index) => ({
                ...row,
                sourcePath: `sections.${sectionKey}.structuredRows[${index}]`,
            })),
        ];
    }
    const labels: Readonly<Record<string, string>> = {
        summary: '요약', scope: '적용범위', owner: '담당', precondition: '선행조건', inspection: '검측사항',
        body: '시공방법', responsibleTeamName: '담당팀', workMethod: '작업방법', note: '비고',
        drawingId: '연결도면', drawingPageIndex: '도면 페이지', drawingPageIndexes: '슬롯별 도면 페이지',
    };
    Object.keys(content).sort().forEach((key) => {
        if (key === 'standardTextVersion' || key === 'standardTextCurrent') return;
        const value = key === 'drawingPageIndex'
            ? `${Number(content[key]) + 1}쪽`
            : key === 'drawingPageIndexes' && isUnknownRecord(content[key])
            ? Object.entries(content[key] as UnknownRecord).sort(([left], [right]) => left.localeCompare(right, 'en'))
                .map(([slot, pageIndex]) => `${slot} ${Number(pageIndex) + 1}쪽`).join(' · ')
            : primitiveText(content[key]);
        rows.push({ label: labels[key] || key, value });
    });
    return rows;
};

const listText = (value: unknown): string => Array.isArray(value)
    ? value.map((entry) => primitiveText(entry)).join(', ') || '-'
    : primitiveText(value);

const ORGANIZATION_ROLE_LABELS: Readonly<Record<string, string>> = {
    site_manager: '현장소장',
    construction_manager: '공사담당자',
    safety_manager: '안전관리자',
    quality_manager: '품질관리자',
    equipment_manager: '장비담당자',
    team_leader: '작업반장',
    crew_member: '작업자',
};

const WORKER_STATUS_LABELS: Readonly<Record<string, string>> = {
    active: '재직',
    inactive: '비활성',
    on_leave: '휴직',
    unknown: '확인필요',
};

const MASTER_STATUS_LABELS: Readonly<Record<string, string>> = {
    active: '사용 중',
    inactive: '사용 중지',
    enabled: '사용 중',
    disabled: '사용 중지',
    pending: '확인 중',
    complete: '완료',
};

const DRAWING_DECISION_LABELS: Readonly<Record<string, string>> = {
    applicable: '적용',
    replacement: '대체도면 적용',
    not_applicable: '해당없음',
};

const DRAWING_APPROVAL_LABELS: Readonly<Record<string, string>> = {
    example: '예시도면',
    draft: '작성 중',
    reviewed: '검토완료',
    approved: '승인완료',
    superseded: '이전 개정',
};

const ENGINEERING_VERIFICATION_LABELS: Readonly<Record<string, string>> = {
    unverified: '미검증',
    reviewed: '검토완료',
    approved: '승인완료',
};

const mappedLabel = (
    labels: Readonly<Record<string, string>>,
    value: unknown,
    fallback = '확인필요',
): string => labels[String(value)] || fallback;

const workerNameById = (content: UnknownRecord, workerId: unknown): string => {
    const id = typeof workerId === 'string' ? workerId.trim() : '';
    if (!id) return '미배정';
    const organization = isUnknownRecord(content.organizationSnapshot) ? content.organizationSnapshot : {};
    const candidates = [
        ...((Array.isArray(organization.assignments) ? organization.assignments : []).flatMap((entry) => (
            isUnknownRecord(entry) && isUnknownRecord(entry.worker) ? [entry.worker] : []
        ))),
        ...(Array.isArray(organization.additionalWorkers) ? organization.additionalWorkers.filter(isUnknownRecord) : []),
    ];
    const worker = candidates.find((candidate) => readTrimmedString(candidate, ['id']) === id);
    return worker ? readTrimmedString(worker, ['name']) || '성명 미확인' : '배정정보 확인필요';
};

const approvalControlRows = (
    content: UnknownRecord,
    approvalEvidence: UnknownRecord,
    coverLabels = false,
): HumanRow[] => {
    const controlValue = (name: unknown, at: unknown): string => {
        const safeName = typeof name === 'string' && name.trim() ? name.trim() : '';
        if (!safeName) return '기록 없음';
        const safeAt = formatConstructionPlanKstTimestamp(at);
        return `${safeName} · ${safeAt}`;
    };
    const label = (role: string): string => coverLabels ? `결재 · ${role}` : `${role}자`;
    return [
        { label: label('작성'), value: controlValue(content.createdByName, content.createdAt) },
        { label: label('검토'), value: controlValue(approvalEvidence.completedByName, approvalEvidence.completedAt) },
        { label: label('승인'), value: controlValue(approvalEvidence.approverName, approvalEvidence.approvedAt) },
    ];
};

const localizedDocumentRows = (
    content: UnknownRecord,
    snapshotHash: string,
    approvalEvidenceHash: string,
    approvalEvidence: UnknownRecord,
): HumanRow[] => {
    const binding = isUnknownRecord(content.templateBinding) ? content.templateBinding : {};
    const migration = isUnknownRecord(content.templateMigration) ? content.templateMigration : undefined;
    const sourceTemplate = migration && isUnknownRecord(migration.sourceTemplate) ? migration.sourceTemplate : {};
    const targetTemplate = migration && isUnknownRecord(migration.targetTemplate) ? migration.targetTemplate : {};
    return [
        { label: '문서번호', value: primitiveText(content.documentNo) },
        { label: '작성일', value: primitiveText(content.documentDate) },
        { label: '개정번호', value: `REV.${String(content.revision).padStart(2, '0')}` },
        { label: '개정유형·사유', value: [content.revisionType, content.revisionReason].filter(Boolean).map(String).join(' · ') || '최초 작성' },
        { label: '기준 문서', value: content.sourceRevisionNo || content.sourceSnapshotHash || content.supersedesPlanId ? '이전 개정과 연결됨' : '최초 작성' },
        { label: '문서 계보', value: content.clonedFromPlanId ? '복제 원본과 연결된 신규 계보' : '신규 계보' },
        { label: '템플릿·렌더러', value: constructionPlanTemplateDisplay({
            tradeType: content.tradeType,
            templateVersion: content.templateVersion,
            rendererVersion: content.rendererVersion,
            schemaVersion: content.schemaVersion,
            snapshotSchemaVersion: content.snapshotSchemaVersion,
        }) },
        { label: '게시 템플릿 바인딩', value: `서버 게시본 확인 · 게시 ${formatConstructionPlanKstTimestamp(binding.publishedAt)} · 캡처 ${formatConstructionPlanKstTimestamp(binding.capturedAt)}` },
        ...(migration ? [{
            label: '템플릿 개정 이력',
            value: `${primitiveText(sourceTemplate.templateVersion)} → ${primitiveText(targetTemplate.templateVersion)} · ${primitiveText(migration.reason)} · ${formatConstructionPlanKstTimestamp(migration.migratedAt)}`,
        }] : []),
        ...approvalControlRows(content, approvalEvidence),
        { label: '승인 스냅샷', value: abbreviateConstructionPlanSha256(snapshotHash) },
        { label: '승인 증적', value: abbreviateConstructionPlanSha256(approvalEvidenceHash) },
    ];
};

const localizedFullAuditRows = (provenance: ConstructionPlanFieldUseProvenance): HumanRow[] => [
    { label: '승인 콘텐츠', value: abbreviateConstructionPlanSha256(provenance.approvedContentHash) },
    { label: '게시 템플릿', value: abbreviateConstructionPlanSha256(provenance.templateHash) },
    { label: '템플릿 매니페스트', value: abbreviateConstructionPlanSha256(provenance.manifestHash) },
    { label: '선택 템플릿 번들', value: abbreviateConstructionPlanSha256(provenance.templateBundleHash) },
    { label: '템플릿 바인딩', value: abbreviateConstructionPlanSha256(provenance.templateBindingHash) },
    { label: '렌더러·도면모드', value: '서버 A4 렌더링 · 승인 원본 도면 합성' },
    { label: '렌더러 템플릿 번들', value: abbreviateConstructionPlanSha256(provenance.rendererTemplateBundleHash) },
    { label: '렌더러 빌드', value: abbreviateConstructionPlanSha256(provenance.rendererBuildHash) },
    { label: '렌더 입력', value: abbreviateConstructionPlanSha256(provenance.renderInputHash) },
    { label: '콘텐츠 매니페스트', value: abbreviateConstructionPlanSha256(provenance.contentManifestHash) },
    { label: '누락방지 원장', value: abbreviateConstructionPlanSha256(provenance.zeroOmissionCoverageHash) },
    { label: '도면 바인딩', value: abbreviateConstructionPlanSha256(provenance.drawingBindingHash) },
    { label: '회사 로고', value: abbreviateConstructionPlanSha256(CONSTRUCTION_PLAN_BRAND_LOGO_SHA256) },
    { label: '전체 해시 값', value: 'PDF 문서속성 및 검색 감사층에 보존' },
];

const localizedProjectRows = (content: UnknownRecord): HumanRow[] => {
    const project = content.projectSnapshot as UnknownRecord;
    const period = isUnknownRecord(project.constructionPeriod) ? project.constructionPeriod : {};
    return [
        { label: '현장명', value: primitiveText(project.siteName) },
        { label: '주소', value: primitiveText(project.address) },
        { label: '발주처', value: primitiveText(project.clientName) },
        { label: '원도급사', value: primitiveText(project.contractorName) },
        { label: '공사기간', value: `${primitiveText(period.startDate)} ~ ${primitiveText(period.endDate)}` },
        { label: '적용 동', value: listText(project.buildings) },
        { label: '적용 층', value: listText(project.floors) },
        { label: '적용 구간', value: listText(project.zones) },
        { label: '원천 스냅샷', value: `${formatConstructionPlanKstTimestamp(project.capturedAt)} · 비상연락망 ${project.emergencyContactsComplete === true ? '확인완료' : '확인필요'} · 원천차이 ${project.differsFromMaster === true ? '있음' : '없음'}` },
    ];
};

const localizedErpRows = (content: UnknownRecord): HumanRow[] => {
    if (!isUnknownRecord(content.erpSnapshot)) return [];
    const erp = content.erpSnapshot;
    const sourceSuffix = (envelope: UnknownRecord): string => {
        const sourceLabels: Readonly<Record<string, string>> = {
            site: '현장 마스터', company: '회사 마스터', team: '팀 마스터',
        };
        return `원천 ${sourceLabels[String(envelope.source)] || 'ERP 마스터'}`
            + ` · 원천수정 ${formatConstructionPlanKstTimestamp(envelope.sourceUpdatedAt)}`
            + ` · 캡처 ${formatConstructionPlanKstTimestamp(envelope.capturedAt)} · 사용자 덮어쓰기 ${envelope.overridden === true ? '예' : '아니오'}`;
    };
    const rows: HumanRow[] = [{
        label: 'ERP 기준시점',
        value: `데이터 구조 ${primitiveText(erp.schemaVersion)} · ${formatConstructionPlanKstTimestamp(erp.capturedAt)}`,
    }];
    const siteEnvelope = erp.site as UnknownRecord;
    const site = siteEnvelope.value as UnknownRecord;
    rows.push({
        label: 'ERP 현장 원천',
        value: `현장명 ${primitiveText(site.name)} · 코드 ${primitiveText(site.code)} · 주소 ${primitiveText(site.address)} · 기간 ${primitiveText(site.startDate)}~${primitiveText(site.endDate)} · 상태 ${mappedLabel(MASTER_STATUS_LABELS, site.status)} · 현장유형 ${primitiveText(site.siteType)} · 담당팀 ${primitiveText(site.responsibleTeamName)} · 발주사 ${primitiveText(site.clientCompanyName)} · 원도급사 ${primitiveText(site.contractorCompanyName)} · 협력사 ${primitiveText(site.partnerCompanyName)} · ${sourceSuffix(siteEnvelope)}`,
    });
    const companyLabels: Readonly<Record<string, string>> = {
        clientCompany: 'ERP 발주사 원천',
        contractorCompany: 'ERP 원도급사 원천',
        partnerCompany: 'ERP 협력사 원천',
    };
    Object.entries(companyLabels).forEach(([key, label]) => {
        if (!isUnknownRecord(erp[key])) return;
        const envelope = erp[key] as UnknownRecord;
        const company = envelope.value as UnknownRecord;
        rows.push({
            label,
            value: `회사명 ${primitiveText(company.name)} · 코드 ${primitiveText(company.code)} · 사업자번호 ${primitiveText(company.businessNumber)} · 대표자 ${primitiveText(company.representativeName)} · 주소 ${primitiveText(company.address)} · 대표전화 ${primitiveText(company.phone)} · 팩스 ${primitiveText(company.fax)} · 유형 ${primitiveText(company.type)} · 상태 ${mappedLabel(MASTER_STATUS_LABELS, company.status)} · ${sourceSuffix(envelope)}`,
        });
    });
    if (isUnknownRecord(erp.responsibleTeam)) {
        const envelope = erp.responsibleTeam;
        const team = envelope.value as UnknownRecord;
        rows.push({
            label: 'ERP 담당팀 원천',
            value: `팀명 ${primitiveText(team.name)} · 유형 ${primitiveText(team.type)} · 책임자 ${primitiveText(team.leaderName)} · 회사 ${primitiveText(team.companyName)} · 상위팀 ${primitiveText(team.parentTeamName)} · 상태 ${mappedLabel(MASTER_STATUS_LABELS, team.status)} · ${sourceSuffix(envelope)}`,
        });
    }
    return rows;
};

export const constructionPlanOrganizationRowsForFieldUsePdf = (content: UnknownRecord): HumanRow[] => {
    const organization = content.organizationSnapshot as UnknownRecord;
    const assignments = organization.assignments as unknown[];
    const workers = organization.additionalWorkers as unknown[];
    const assignmentCounts = new Map<string, number>();
    assignments.forEach((raw) => {
        if (!isUnknownRecord(raw) || !isUnknownRecord(raw.worker)) return;
        const workerId = readTrimmedString(raw.worker, ['id']);
        if (workerId) assignmentCounts.set(workerId, (assignmentCounts.get(workerId) ?? 0) + 1);
    });
    return [
        { label: '조직 스냅샷', value: `${formatConstructionPlanKstTimestamp(organization.capturedAt)} · 현장 마스터 연결` },
        ...assignments.map((raw, index): HumanRow => {
            const assignment = raw as UnknownRecord;
            const worker = isUnknownRecord(assignment.worker) ? assignment.worker : {};
            const workerId = readTrimmedString(worker, ['id']);
            const workerSiteId = readTrimmedString(worker, ['siteId']);
            const sourceSiteId = readTrimmedString(organization, ['sourceSiteId']);
            const duplicate = Boolean(workerId && (assignmentCounts.get(workerId) ?? 0) > 1);
            const external = assignment.externalAssignment === true
                || Boolean(workerSiteId && sourceSiteId && workerSiteId !== sourceSiteId);
            const exceptionLabels = [duplicate ? '겸임' : '', external ? '현장 외 배정' : ''].filter(Boolean);
            const exceptionText = exceptionLabels.length > 0
                ? ` · 구분 ${exceptionLabels.join('·')} · 사유 ${primitiveText(assignment.exceptionReason)}`
                : '';
            return {
                label: `${index + 1}. ${primitiveText(assignment.label)}`,
                value: `역할 ${mappedLabel(ORGANIZATION_ROLE_LABELS, assignment.role, primitiveText(assignment.label))} · 순서 ${Number(assignment.order) + 1} · 작업자 ${primitiveText(worker.name)} · 직책 ${primitiveText(worker.position)} · 직무 ${primitiveText(worker.role)} · 팀 ${primitiveText(worker.teamName)} · 상태 ${mappedLabel(WORKER_STATUS_LABELS, worker.status)} · 업무 ${listText(assignment.responsibilities)} · ${assignment.required === true ? '필수' : '선택'}${exceptionText}`,
                sourcePath: `organizationSnapshot.assignments[${index}]`,
            };
        }),
        ...workers.map((raw, index): HumanRow => {
            const worker = raw as UnknownRecord;
            return {
                label: `추가 작업자 ${index + 1}`,
                value: `${primitiveText(worker.name)} · 직책 ${primitiveText(worker.position)} · 역할 ${primitiveText(worker.role)} · 팀 ${primitiveText(worker.teamName)} · 상태 ${mappedLabel(WORKER_STATUS_LABELS, worker.status)}`,
                sourcePath: `organizationSnapshot.additionalWorkers[${index}]`,
            };
        }),
    ];
};

const localizedEquipmentRows = (content: UnknownRecord, liftingOnly = false): HumanRow[] => {
    const equipment = (content.equipmentPlan as unknown[]).filter((raw) => !liftingOnly || (isUnknownRecord(raw) && raw.category === 'lifting'));
    const categoryLabels: Readonly<Record<string, string>> = {
        lifting: '양중장비',
        transport: '운반장비',
        'work-at-height': '고소작업장비',
        assembly: '조립·체결장비',
        measurement: '측정·검측장비',
    };
    return equipment.map((raw, index) => {
        const item = raw as UnknownRecord;
        return {
            label: `${liftingOnly ? '양중장비' : '장비'} ${index + 1} · ${primitiveText(item.equipmentName)}`,
            value: `분류 ${categoryLabels[String(item.category)] || '미분류'} · 모델 ${primitiveText(item.model)} · 등록 ${primitiveText(item.registrationNo)} · 정격 ${primitiveText(item.ratedCapacity)} · 반경 ${primitiveText(item.workRadius)} · 검사·인증 ${primitiveText(item.inspectionValidUntil)} · 운전원 ${workerNameById(content, item.operatorWorkerId)} · 신호수·유도자 ${workerNameById(content, item.signalerWorkerId)} · 작업구간 ${listText(item.workZones)} · 예정 작업단계 ${listText(item.plannedStages)} · 통제대책 ${listText(item.controlMeasures)}`,
            sourcePath: `equipmentPlan[${index}]`,
        };
    });
};

const localizedEngineeringRows = (content: UnknownRecord): HumanRow[] => (content.engineeringValues as unknown[]).map((raw, index) => {
    const value = raw as UnknownRecord;
    return {
        label: `구조값 ${index + 1} · ${primitiveText(value.key)}`,
        value: `기준 ${primitiveText(value.value)} ${primitiveText(value.unit)} · 적용 ${listText(value.applicableZones)} · 출처 ${primitiveText(value.sourceDocumentId)} · Rev.${primitiveText(value.sourceRevision)} · 페이지·절 ${primitiveText(value.sourcePageOrSection)} · 검증 ${mappedLabel(ENGINEERING_VERIFICATION_LABELS, value.verificationStatus)} · 검증자 ${value.verifiedBy ? '기록됨' : '미기록'} · ${formatConstructionPlanKstTimestamp(value.verifiedAt)}${value.manualInputReason ? ` · 직접입력사유 ${value.manualInputReason}` : ''}`,
        sourcePath: `engineeringValues[${index}]`,
    };
});

const localizedEngineeringSummaryRows = (content: UnknownRecord): HumanRow[] => {
    const values = content.engineeringValues as unknown[];
    const approved = values.filter((raw) => isUnknownRecord(raw) && raw.verificationStatus === 'approved').length;
    const reviewed = values.filter((raw) => isUnknownRecord(raw) && raw.verificationStatus === 'reviewed').length;
    return [{
        label: 'D-05 구조기준 연결',
        value: `구조값 총 ${values.length}건 · 승인 ${approved}건 · 검토 ${reviewed}건 · 전체 제원·출처·Rev.·적용구간은 논리 17쪽 및 29쪽 연속표 참조`,
    }];
};

const geometryText = (raw: unknown): string => {
    const geometry = raw as UnknownRecord;
    if (geometry.kind === 'rect') return `사각형 x ${geometry.x}, y ${geometry.y}, 폭 ${geometry.w}, 높이 ${geometry.h}, 회전 ${geometry.rotationDeg || 0}°`;
    if (geometry.kind === 'ellipse') return `타원 중심 ${geometry.cx},${geometry.cy}, 반경 ${geometry.rx},${geometry.ry}`;
    if (geometry.kind === 'marker') {
        const markerLabels: Readonly<Record<string, string>> = {
            pin: '위치표시', warning: '주의표시', sequence: '순서표시',
        };
        return `마커 ${markerLabels[String(geometry.markerType)] || '표시점'}, 위치 ${geometry.x},${geometry.y}`;
    }
    if (geometry.kind === 'text') {
        const alignLabels: Readonly<Record<string, string>> = {
            left: '왼쪽', center: '가운데', right: '오른쪽',
        };
        return `텍스트영역 x ${geometry.x}, y ${geometry.y}, 폭 ${geometry.w}, 높이 ${geometry.h}, 정렬 ${alignLabels[String(geometry.align)] || '기본'}`;
    }
    const vertices = Array.isArray(geometry.vertices)
        ? geometry.vertices.map((point) => isUnknownRecord(point) ? `${point.x},${point.y}` : '-').join(' / ')
        : '-';
    return `${geometry.kind === 'polygon' ? '다각형' : '선'} ${vertices}${geometry.arrowStart ? ' · 시작화살표' : ''}${geometry.arrowEnd ? ' · 끝화살표' : ''}`;
};

const annotationStyleAuditText = (raw: unknown): string => {
    const style = raw as UnknownRecord;
    return `선 ${primitiveText(style.strokeToken)} · 채움 ${primitiveText(style.fillToken)} · 굵기 ${primitiveText(style.strokeWidthPt)}pt · 불투명도 ${primitiveText(style.opacity)} · 선형 ${primitiveText(style.dash)} · 해치 ${primitiveText(style.hatch)} · 글자 ${primitiveText(style.fontSizePt)}pt`;
};

const annotationStructuredAttributeText = (
    annotation: UnknownRecord,
    audit: boolean,
): string[] => {
    const layer = String(annotation.layer || '');
    if (layer === 'retain') return [
        `${audit ? 'releaseCondition' : '해제조건'} ${primitiveText(annotation.releaseCondition)}`,
    ];
    if (layer === 'equipment') return [
        `${audit ? 'equipmentType' : '장비종류'} ${primitiveText(annotation.equipmentType)}`,
        `${audit ? 'equipmentId' : '장비 식별'} ${primitiveText(annotation.equipmentId)}`,
    ];
    if (layer === 'pedestrian') return [
        `${audit ? 'entrance' : '출입구'} ${primitiveText(annotation.entrance)}`,
        `${audit ? 'destination' : '도착지'} ${primitiveText(annotation.destination)}`,
    ];
    if (layer === 'lifting') return [
        `${audit ? 'equipmentId' : '양중장비'} ${primitiveText(annotation.equipmentId)}`,
        `${audit ? 'radius' : '양중반경'} ${primitiveText(annotation.radius)}m`,
    ];
    if (layer === 'restricted') return [
        `${audit ? 'responsibleWorkerId' : '담당'} ${audit
            ? (readTrimmedString(annotation, ['responsibleWorkerId']) ? '지정됨' : '미지정')
            : primitiveText(annotation.responsibleRole)}`,
        `${audit ? 'responsibleRole' : '담당역할'} ${primitiveText(annotation.responsibleRole)}`,
    ];
    if (layer === 'storage') return [
        `${audit ? 'materialType' : '자재종류'} ${primitiveText(annotation.materialType)}`,
    ];
    return [];
};

const annotationCalloutAuditText = (annotation: UnknownRecord, index: number): string => [
    `${index + 1}. ID ${primitiveText(annotation.id)}`,
    `p.${Number(annotation.pageIndex) + 1}`,
    `지문 ${primitiveText(annotation.pageFingerprint)}`,
    `계층 ${primitiveText(annotation.layer)}`,
    `구간 ${primitiveText(annotation.zoneCode)}`,
    `라벨 ${primitiveText(annotation.label)}`,
    `순번 ${primitiveText(annotation.sequence)}`,
    `기간 ${primitiveText(annotation.startDate)}~${primitiveText(annotation.endDate)}`,
    `사유 ${primitiveText(annotation.reason)}`,
    ...annotationStructuredAttributeText(annotation, true),
    geometryText(annotation.geometry),
    annotationStyleAuditText(annotation.style),
].join(' · ');

const annotationCalloutVisibleText = (annotation: UnknownRecord, index: number): string => [
    `${index + 1}. 주석 ${index + 1}`,
    `도면 ${Number(annotation.pageIndex) + 1}쪽`,
    `구분 ${constructionPlanLayerDisplayName(annotation.layer)}`,
    `구간 ${primitiveText(annotation.zoneCode)}`,
    `표시명 ${primitiveText(annotation.label)}`,
    `순번 ${primitiveText(annotation.sequence)}`,
    `기간 ${primitiveText(annotation.startDate)}~${primitiveText(annotation.endDate)}`,
    `사유 ${primitiveText(annotation.reason)}`,
    ...annotationStructuredAttributeText(annotation, false),
    geometryText(annotation.geometry),
    constructionPlanAnnotationStyleDisplay(annotation.style as UnknownRecord),
].join(' · ');

const localizedDrawingRegisterRows = (content: UnknownRecord): HumanRow[] => {
    const decisions = content.drawingApplicability as unknown[];
    const drawings = content.drawings as unknown[];
    const drawingsById = new Map(drawings.flatMap((raw) => {
        if (!isUnknownRecord(raw)) return [];
        const id = readTrimmedString(raw, ['id']);
        return id ? [[id, raw] as const] : [];
    }));
    const rows: HumanRow[] = [];
    decisions.forEach((raw) => {
        const decision = raw as UnknownRecord;
        const drawingId = readTrimmedString(decision, ['drawingId']);
        const drawing = drawingId ? drawingsById.get(drawingId) : undefined;
        rows.push({
            label: primitiveText(decision.drawingSlot),
            value: drawing
                ? `결정 ${mappedLabel(DRAWING_DECISION_LABELS, decision.decision)} · ${primitiveText(drawing.drawingNo)} / ${primitiveText(drawing.title)} · 파일 ${primitiveText(drawing.originalFileName)} · REV.${primitiveText(drawing.revision)} · 상태 ${mappedLabel(DRAWING_APPROVAL_LABELS, drawing.approvalStatus)} · 승인근거 ${primitiveText(drawing.approvalReference)} · 위치 ${primitiveText(drawing.building)} / ${primitiveText(drawing.floor)} / ${primitiveText(drawing.zone)} · 적용 ${listText(drawing.applicableZones)} · 축척 ${primitiveText(drawing.scaleText)} · 페이지 ${primitiveText(drawing.pageCount)}쪽 · 주석 ${Array.isArray(drawing.annotations) ? drawing.annotations.length : 0}건 · 원본 ${abbreviateConstructionPlanSha256(drawing.sourceSha256)} · 사유 ${primitiveText(decision.reason)} · 확인 ${decision.reviewedBy ? '완료' : '미확인'} · 기술검토 ${primitiveText(decision.technicalReviewReference)}`
                : `결정 ${mappedLabel(DRAWING_DECISION_LABELS, decision.decision)} · 사유 ${primitiveText(decision.reason)} · 확인 ${decision.reviewedBy ? '완료' : '미확인'} · 기술검토 ${primitiveText(decision.technicalReviewReference)}`,
        });
    });
    return rows;
};

const localizedRiskRows = (content: UnknownRecord): HumanRow[] => {
    const template = resolveConstructionPlanServerTemplate({
        tradeType: content.tradeType,
        templateId: content.templateId,
        templateVersion: content.templateVersion,
    });
    const policy = template.riskAssessmentPolicy;
    const levelLabels: Readonly<Record<string, string>> = {
        low: '낮음', medium: '보통', high: '높음', critical: '매우 높음',
    };
    const level = (value: unknown): string => levelLabels[String(value)] || primitiveText(value);
    const policyRows: HumanRow[] = [
        {
            label: '템플릿 위험성평가 계산식',
            value: `${policy.methodReference} · 가능성 ${policy.probabilityMin}~${policy.probabilityMax} × 중대성 ${policy.severityMin}~${policy.severityMax}`,
        },
        {
            label: '등급 임계 및 조치',
            value: policy.thresholds.map((threshold) => `${threshold.minScore}~${threshold.maxScore}점 ${threshold.label}: ${threshold.action}`).join(' / '),
        },
        {
            label: '잔여 위험 허용기준',
            value: `${policy.acceptance.maxResidualScore}점 이하 · 최초 대비 저감 ${policy.acceptance.requireResidualReduction ? '필수' : '선택'} · 금지등급 ${policy.acceptance.blockedResidualLevels.map(level).join('·')}`,
        },
        { label: '재검토 트리거', value: policy.reviewTriggers.join(' / ') },
    ];
    return [
        ...policyRows,
        ...(content.riskAssessments as unknown[]).map((raw, index) => {
            const risk = raw as UnknownRecord;
            const initialScore = constructionPlanRiskScore(risk.initialProbability, risk.initialSeverity, policy);
            const residualScore = constructionPlanRiskScore(risk.residualProbability, risk.residualSeverity, policy);
            const quantitative = risk.assessmentMethodVersion === policy.methodVersion
                ? `평가법 5×5 v${policy.methodVersion} · 최초 ${primitiveText(risk.initialProbability)}×${primitiveText(risk.initialSeverity)}=${primitiveText(initialScore)}점(${level(constructionPlanRiskLevelFromScore(initialScore ?? 0, policy) || risk.initialRiskLevel)}) · 저감 후 ${primitiveText(risk.residualProbability)}×${primitiveText(risk.residualSeverity)}=${primitiveText(residualScore)}점(${level(constructionPlanRiskLevelFromScore(residualScore ?? 0, policy) || risk.residualRiskLevel)}) · 평가기준 ${primitiveText(risk.methodReference)} · 재평가 조건 ${primitiveText(risk.reviewTrigger)}`
                : `템플릿 평가법 불일치 · 최초 ${level(risk.initialRiskLevel)} · 잔여 ${level(risk.residualRiskLevel)}`;
            return {
                label: `위험 ${index + 1} · ${primitiveText(risk.workStage)}`,
                value: `위험요인 ${primitiveText(risk.hazard)} · ${quantitative} · 저감대책 ${listText(risk.mitigationMeasures)} · 담당 ${workerNameById(content, risk.responsibleWorkerId)} · 확인 ${risk.verifiedBy ? '완료' : '미확인'}`,
                sourcePath: `riskAssessments[${index}]`,
            };
        }),
    ];
};

const visualRowsForPage = (
    model: FieldUsePageModel,
    content: UnknownRecord,
    snapshotHash: string,
    approvalEvidenceHash: string,
    approvalEvidence: UnknownRecord,
    provenance?: ConstructionPlanFieldUseProvenance,
): HumanRow[] => {
    const page = model.contract.pageNumber;
    const template = resolveConstructionPlanServerTemplate({
        tradeType: content.tradeType,
        templateId: content.templateId,
        templateVersion: content.templateVersion,
    });
    const standardCopy = pageStandardCopyFor(template);
    const section = sectionByKey(content, model.contract.sectionKey);
    const perSection = sectionRows(section);
    const standardTextEntry = resolveConstructionPlanServerStandardText(template, model.contract.sectionKey);
    const serverStandardRows = constructionPlanServerStandardTextRowsForRender(template, section);
    const fallbackStandardRows = standardTextEntry ? [] : (standardCopy[page] || []);
    if (page === 2) return [
        ...localizedDocumentRows(content, snapshotHash, approvalEvidenceHash, approvalEvidence),
        ...(provenance ? localizedFullAuditRows(provenance) : []),
        ...perSection,
    ];
    if (page === 6) return [...localizedProjectRows(content), ...localizedErpRows(content), ...perSection];
    if (page === 7) return [...constructionPlanOrganizationRowsForFieldUsePdf(content), ...perSection];
    if (page === 9) return [...localizedEquipmentRows(content), ...perSection];
    if (page === 11) return [...localizedEquipmentRows(content, true), ...perSection];
    if (page === 17 || page === 29) return [...localizedEngineeringRows(content), ...perSection, ...serverStandardRows, ...fallbackStandardRows];
    if (page === 22) return [...localizedDrawingRegisterRows(content), ...perSection];
    if (page === 36) return [...localizedRiskRows(content), ...perSection];
    return [...perSection, ...serverStandardRows, ...fallbackStandardRows];
};

const humanRowsForCoverage = (entry: CoverageEntry): HumanRow[] => {
    if (/^sections\[\d+\]$/.test(entry.path) && isUnknownRecord(entry.value)) return sectionRows(entry.value);
    if (entry.path === 'projectSnapshot' && isUnknownRecord(entry.value)) {
        return Object.keys(entry.value).sort().map((key) => ({ label: key, value: primitiveText(entry.value[key]) }));
    }
    if (entry.path === 'organizationSnapshot' && isUnknownRecord(entry.value)) {
        const assignments = Array.isArray(entry.value.assignments) ? entry.value.assignments : [];
        const workers = Array.isArray(entry.value.additionalWorkers) ? entry.value.additionalWorkers : [];
        return [
            { label: '조직 스냅샷', value: primitiveText(entry.value.capturedAt) },
            ...assignments.map((value, index) => ({ label: `역할 ${index + 1}`, value: primitiveText(value) })),
            ...workers.map((value, index) => ({ label: `작업자 ${index + 1}`, value: primitiveText(value) })),
        ];
    }
    if (/^drawings\[\d+\]$/.test(entry.path) && isUnknownRecord(entry.value)) {
        const rows: HumanRow[] = [{
            label: readTrimmedString(entry.value, ['drawingNo']) || readTrimmedString(entry.value, ['id']) || entry.path,
            value: [
                readTrimmedString(entry.value, ['id']),
                readTrimmedString(entry.value, ['originalFileName']),
                readTrimmedString(entry.value, ['title']),
                `REV.${readTrimmedString(entry.value, ['revision']) || '-'}`,
                readTrimmedString(entry.value, ['approvalStatus']),
                readTrimmedString(entry.value, ['approvalReference']),
                readTrimmedString(entry.value, ['building']),
                readTrimmedString(entry.value, ['floor']),
                readTrimmedString(entry.value, ['zone']),
                Array.isArray(entry.value.applicableZones) ? entry.value.applicableZones.join(', ') : undefined,
                readTrimmedString(entry.value, ['scaleText']),
                `${Number(entry.value.pageCount)} page`,
                `SHA ${readTrimmedString(entry.value, ['sourceSha256']) || '-'}`,
            ].filter(Boolean).join(' · '),
        }];
        const annotations = Array.isArray(entry.value.annotations) ? entry.value.annotations : [];
        annotations.forEach((rawAnnotation, index) => {
            if (!isUnknownRecord(rawAnnotation)) return;
            const operational: UnknownRecord = {};
            [
                'id', 'pageIndex', 'pageFingerprint', 'layer', 'geometry', 'style', 'label', 'zoneCode',
                'sequence', 'startDate', 'endDate', 'reason',
                ...CONSTRUCTION_PLAN_DRAWING_ANNOTATION_ATTRIBUTE_KEYS,
            ].forEach((key) => {
                if (rawAnnotation[key] !== undefined) operational[key] = rawAnnotation[key];
            });
            rows.push({ label: `주석 ${index + 1}`, value: canonicalStringify(operational) });
        });
        return rows;
    }
    if (/^drawingApplicability\[\d+\]$/.test(entry.path) && isUnknownRecord(entry.value)) {
        return [{
            label: readTrimmedString(entry.value, ['drawingSlot']) || entry.path,
            value: [entry.value.decision, entry.value.drawingId, entry.value.reason, entry.value.technicalReviewReference, entry.value.reviewedBy]
                .filter((value) => value !== undefined && value !== '').map(String).join(' · '),
        }];
    }
    if (/^(engineeringValues|equipmentPlan|riskAssessments)\[\d+\]$/.test(entry.path)) {
        return [{ label: entry.path, value: primitiveText(entry.value) }];
    }
    return [{ label: entry.path, value: primitiveText(entry.value) }];
};

const normalizeRotation = (value: unknown): 0 | 90 | 180 | 270 => {
    if (value === 0 || value === 90 || value === 180 || value === 270) return value;
    throw new Error('construction-plan-field-use-drawing-rotation-invalid');
};

const pdfBox = (value: unknown): PdfBox => {
    if (!isUnknownRecord(value)) throw new Error('construction-plan-field-use-drawing-crop-box-invalid');
    const box = { left: Number(value.left), bottom: Number(value.bottom), right: Number(value.right), top: Number(value.top) };
    if (Object.values(box).some((coordinate) => !Number.isFinite(coordinate)) || box.right <= box.left || box.top <= box.bottom) {
        throw new Error('construction-plan-field-use-drawing-crop-box-invalid');
    }
    return box;
};

const pdfBoxesEqual = (left: PdfBox, right: PdfBox): boolean => (
    (['left', 'bottom', 'right', 'top'] as const).every((key) => Math.abs(left[key] - right[key]) <= 0.01)
);

const assertExactObjectKeys = (record: UnknownRecord, allowed: ReadonlySet<string>, code: string): void => {
    const unknown = Object.keys(record).filter((key) => !allowed.has(key));
    if (unknown.length) throw new Error(`${code}:${unknown.join(',')}`);
};

const assertAnnotationString = (
    record: UnknownRecord,
    key: string,
    maximumLength: number,
    code: string,
    options: { required?: boolean; allowEmpty?: boolean; isoOffset?: boolean } = {},
): string | undefined => {
    const raw = record[key];
    if (raw === undefined) {
        if (options.required) throw new Error(`${code}:${key}`);
        return undefined;
    }
    if (typeof raw !== 'string' || raw.length > maximumLength
        || (!options.allowEmpty && raw.trim().length === 0)) {
        throw new Error(`${code}:${key}`);
    }
    const value = raw.trim();
    if (options.isoOffset
        && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
            || !Number.isFinite(Date.parse(value)))) {
        throw new Error(`${code}:${key}`);
    }
    return value;
};

const normalizedPoint = (value: unknown, code: string): { x: number; y: number } => {
    if (!isUnknownRecord(value)) throw new Error(code);
    assertExactObjectKeys(value, new Set(['x', 'y']), code);
    const x = Number(value.x);
    const y = Number(value.y);
    if (typeof value.x !== 'number' || typeof value.y !== 'number'
        || !Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1) throw new Error(code);
    return { x, y };
};

const resolveColorToken = (value: unknown, fallback: string, code: string): string => {
    if (value === undefined) return fallback;
    const token = typeof value === 'string' ? value.trim() : '';
    const color = COLOR_TOKENS[token];
    if (!color) throw new Error(`${code}:${token || '-'}`);
    return color;
};

const assertAnnotation = (annotation: unknown, drawingId: string, fingerprint: string): UnknownRecord => {
    if (!isUnknownRecord(annotation)) throw new Error(`construction-plan-field-use-annotation-invalid:${drawingId}`);
    assertExactObjectKeys(
        annotation,
        CONSTRUCTION_PLAN_DRAWING_ANNOTATION_KEYS,
        `construction-plan-field-use-annotation-field-unknown:${drawingId}`,
    );
    const id = assertAnnotationString(annotation, 'id', 200, `construction-plan-field-use-annotation-field-invalid:${drawingId}`, { required: true }) as string;
    const pageFingerprint = assertAnnotationString(annotation, 'pageFingerprint', 256, `construction-plan-field-use-annotation-field-invalid:${id}`, { required: true });
    if (pageFingerprint !== fingerprint || typeof annotation.pageIndex !== 'number'
        || !Number.isInteger(annotation.pageIndex) || annotation.pageIndex < 0) {
        throw new Error(`construction-plan-field-use-annotation-binding-invalid:${drawingId}:${id || '-'}`);
    }
    const layer = assertAnnotationString(annotation, 'layer', 40, `construction-plan-field-use-annotation-field-invalid:${id}`, { required: true });
    if (!layer || !LAYER_STYLE[layer]) throw new Error(`construction-plan-field-use-annotation-layer-invalid:${drawingId}:${id}`);
    assertAnnotationString(annotation, 'label', 300, `construction-plan-field-use-annotation-field-invalid:${id}`, { allowEmpty: true });
    assertAnnotationString(annotation, 'zoneCode', 120, `construction-plan-field-use-annotation-field-invalid:${id}`);
    assertAnnotationString(annotation, 'startDate', 40, `construction-plan-field-use-annotation-field-invalid:${id}`);
    assertAnnotationString(annotation, 'endDate', 40, `construction-plan-field-use-annotation-field-invalid:${id}`);
    assertAnnotationString(annotation, 'reason', 1_000, `construction-plan-field-use-annotation-field-invalid:${id}`);
    [
        'releaseCondition', 'equipmentType', 'equipmentId', 'entrance', 'destination',
        'responsibleWorkerId', 'responsibleRole', 'materialType',
    ].forEach((key) => {
        const value = assertAnnotationString(annotation, key, 500, `construction-plan-field-use-annotation-field-invalid:${id}`);
        if (value && /(?:https?:\/\/|blob:|[?&]token=)/i.test(value)) {
            throw new Error(`construction-plan-field-use-annotation-sensitive-value-forbidden:${id}:${key}`);
        }
    });
    if (annotation.radius !== undefined && (typeof annotation.radius !== 'number'
        || !Number.isFinite(annotation.radius) || annotation.radius <= 0 || annotation.radius > 10_000)) {
        throw new Error(`construction-plan-field-use-annotation-radius-invalid:${id}`);
    }
    if (annotation.sequence !== undefined && (typeof annotation.sequence !== 'number'
        || !Number.isInteger(annotation.sequence) || annotation.sequence < 1)) {
        throw new Error(`construction-plan-field-use-annotation-sequence-invalid:${id}`);
    }
    assertAnnotationString(annotation, 'createdBy', 200, `construction-plan-field-use-annotation-provenance-invalid:${id}`, { required: true });
    assertAnnotationString(annotation, 'createdAt', 64, `construction-plan-field-use-annotation-provenance-invalid:${id}`, { required: true, isoOffset: true });
    assertAnnotationString(annotation, 'updatedBy', 200, `construction-plan-field-use-annotation-provenance-invalid:${id}`, { required: true });
    assertAnnotationString(annotation, 'updatedAt', 64, `construction-plan-field-use-annotation-provenance-invalid:${id}`, { required: true, isoOffset: true });
    if (typeof annotation.styleVersion !== 'number' || !Number.isInteger(annotation.styleVersion) || annotation.styleVersion < 1
        || typeof annotation.locked !== 'boolean') {
        throw new Error(`construction-plan-field-use-annotation-provenance-invalid:${id}`);
    }
    if (!isUnknownRecord(annotation.style) || !isUnknownRecord(annotation.geometry)) {
        throw new Error(`construction-plan-field-use-annotation-shape-invalid:${drawingId}:${id}`);
    }
    const style = annotation.style;
    assertExactObjectKeys(style, new Set([
        'strokeToken', 'fillToken', 'strokeWidthPt', 'opacity', 'dash', 'hatch', 'fontSizePt',
    ]), `construction-plan-field-use-annotation-style-unknown:${id}`);
    const strokeWidth = style.strokeWidthPt;
    const opacity = style.opacity;
    const fontSize = style.fontSizePt;
    if (!readTrimmedString(style, ['strokeToken']) || typeof strokeWidth !== 'number' || !Number.isFinite(strokeWidth) || strokeWidth <= 0 || strokeWidth > 20
        || typeof opacity !== 'number'
        || !Number.isFinite(opacity) || opacity < 0 || opacity > 1
        || !['solid', 'dash', 'dot'].includes(String(style.dash || ''))
        || (style.hatch !== undefined && !['none', 'diagonal', 'cross'].includes(String(style.hatch)))
        || (fontSize !== undefined && (typeof fontSize !== 'number' || !Number.isFinite(fontSize)
            || fontSize <= 0 || fontSize > MAX_ANNOTATION_FONT_SIZE_PT))) {
        throw new Error(`construction-plan-field-use-annotation-style-invalid:${drawingId}:${id}`);
    }
    resolveColorToken(style.strokeToken, LAYER_STYLE[layer].stroke, `construction-plan-field-use-annotation-stroke-token-invalid:${id}`);
    resolveColorToken(style.fillToken, LAYER_STYLE[layer].fill, `construction-plan-field-use-annotation-fill-token-invalid:${id}`);
    const geometry = annotation.geometry;
    const kind = geometry.kind;
    if (kind === 'rect') {
        assertExactObjectKeys(geometry, new Set(['kind', 'x', 'y', 'w', 'h', 'rotationDeg']), `construction-plan-field-use-annotation-geometry-unknown:${id}`);
        const x = Number(geometry.x); const y = Number(geometry.y); const w = Number(geometry.w); const h = Number(geometry.h);
        const rotation = geometry.rotationDeg;
        if (![geometry.x, geometry.y, geometry.w, geometry.h].every((value) => typeof value === 'number' && Number.isFinite(value))
            || (rotation !== undefined && (typeof rotation !== 'number' || !Number.isFinite(rotation)))
            || x < 0 || y < 0 || w <= 0 || h <= 0 || x + w > 1 || y + h > 1) {
            throw new Error(`construction-plan-field-use-annotation-rect-invalid:${id}`);
        }
    } else if (kind === 'polygon' || kind === 'polyline') {
        const allowed = kind === 'polygon'
            ? new Set(['kind', 'vertices'])
            : new Set(['kind', 'vertices', 'arrowStart', 'arrowEnd']);
        assertExactObjectKeys(geometry, allowed, `construction-plan-field-use-annotation-geometry-unknown:${id}`);
        if (!Array.isArray(geometry.vertices) || geometry.vertices.length < (kind === 'polygon' ? 3 : 2)
            || geometry.vertices.length > MAX_ANNOTATION_VERTICES
            || (kind === 'polyline' && ((geometry.arrowStart !== undefined && typeof geometry.arrowStart !== 'boolean')
                || (geometry.arrowEnd !== undefined && typeof geometry.arrowEnd !== 'boolean')))) {
            throw new Error(`construction-plan-field-use-annotation-vertices-invalid:${id}`);
        }
        geometry.vertices.forEach((point) => normalizedPoint(point, `construction-plan-field-use-annotation-point-invalid:${id}`));
    } else if (kind === 'ellipse') {
        assertExactObjectKeys(geometry, new Set(['kind', 'cx', 'cy', 'rx', 'ry']), `construction-plan-field-use-annotation-geometry-unknown:${id}`);
        const cx = Number(geometry.cx); const cy = Number(geometry.cy); const rx = Number(geometry.rx); const ry = Number(geometry.ry);
        if (![geometry.cx, geometry.cy, geometry.rx, geometry.ry].every((value) => typeof value === 'number' && Number.isFinite(value))
            || rx <= 0 || ry <= 0 || cx - rx < 0 || cx + rx > 1 || cy - ry < 0 || cy + ry > 1) {
            throw new Error(`construction-plan-field-use-annotation-ellipse-invalid:${id}`);
        }
    } else if (kind === 'marker') {
        assertExactObjectKeys(geometry, new Set(['kind', 'x', 'y', 'markerType']), `construction-plan-field-use-annotation-geometry-unknown:${id}`);
        const x = Number(geometry.x); const y = Number(geometry.y);
        if (typeof geometry.x !== 'number' || typeof geometry.y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)
            || x < 0 || x > 1 || y < 0 || y > 1) {
            throw new Error(`construction-plan-field-use-annotation-marker-invalid:${id}`);
        }
        const markerType = assertAnnotationString(geometry, 'markerType', 40, `construction-plan-field-use-annotation-marker-invalid:${id}`, { required: true });
        if (!markerType || !MARKER_TYPES.has(markerType)) throw new Error(`construction-plan-field-use-annotation-marker-invalid:${id}`);
    } else if (kind === 'text') {
        assertExactObjectKeys(geometry, new Set(['kind', 'x', 'y', 'w', 'h', 'align']), `construction-plan-field-use-annotation-geometry-unknown:${id}`);
        const x = Number(geometry.x); const y = Number(geometry.y); const w = Number(geometry.w); const h = Number(geometry.h);
        if (![geometry.x, geometry.y, geometry.w, geometry.h].every((value) => typeof value === 'number' && Number.isFinite(value))
            || x < 0 || y < 0 || w <= 0 || h <= 0 || x + w > 1 || y + h > 1
            || !['left', 'center', 'right'].includes(String(geometry.align))) {
            throw new Error(`construction-plan-field-use-annotation-text-invalid:${id}`);
        }
        if (!readTrimmedString(annotation, ['label'])) throw new Error(`construction-plan-field-use-annotation-text-empty:${id}`);
    } else {
        throw new Error(`construction-plan-field-use-annotation-kind-invalid:${drawingId}:${id}`);
    }
    const contractIssues = constructionPlanDrawingAnnotationLayerContractIssues(annotation);
    if (contractIssues.length > 0) {
        throw new Error(`construction-plan-field-use-annotation-layer-contract-invalid:${id}:${contractIssues.join(',')}`);
    }
    return annotation;
};

const inspectRasterDimensions = async (bytes: Buffer): Promise<{ width: number; height: number }> => {
    const image = await loadImage(bytes);
    const width = Number(image.width);
    const height = Number(image.height);
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1
        || width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
        throw new Error('construction-plan-field-use-drawing-image-dimensions-invalid');
    }
    return { width, height };
};

const prepareDrawing = async (
    record: UnknownRecord,
    loadDrawingSource: ConstructionPlanFieldUseDrawingSourceLoader,
    selectedPageIndexes: ReadonlySet<number>,
): Promise<PreparedDrawing> => {
    const drawingId = readTrimmedString(record, ['id']);
    const storagePath = readTrimmedString(record, ['storagePath']);
    const sourceSha256 = assertSha256(readTrimmedString(record, ['sourceSha256']) || '', 'construction-plan-field-use-source-sha-invalid');
    const sourceGeneration = readTrimmedString(record, ['sourceGeneration']);
    const mimeType = readTrimmedString(record, ['mimeType']) as ConstructionPlanFieldUseDrawingMimeType | undefined;
    const sizeBytes = Number(record.sizeBytes);
    const pageCount = Number(record.pageCount);
    if (!drawingId || !storagePath || !sourceGeneration || !/^\d+$/.test(sourceGeneration)
        || !mimeType || !['application/pdf', 'image/png', 'image/jpeg'].includes(mimeType)
        || !Number.isInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > MAX_SOURCE_BYTES
        || !Number.isInteger(pageCount) || pageCount < 1 || pageCount > 50) {
        throw new Error(`construction-plan-field-use-source-binding-invalid:${drawingId || '-'}`);
    }
    const ref: ConstructionPlanFieldUseDrawingSourceRef = {
        drawingId, storagePath, sourceSha256, sourceGeneration, mimeType, sizeBytes, pageCount,
    };
    const loaded = await loadDrawingSource(ref);
    if (!loaded || !Buffer.isBuffer(loaded.bytes)
        || loaded.storagePath !== storagePath
        || loaded.sourceGeneration !== sourceGeneration
        || loaded.mimeType !== mimeType
        || loaded.bytes.length !== sizeBytes
        || sha256Hex(loaded.bytes) !== sourceSha256) {
        throw new Error(`construction-plan-field-use-source-integrity-failed:${drawingId}`);
    }
    assertConstructionPlanDrawingSourceMagic(mimeType, loaded.bytes);

    const pages: PreparedDrawingPage[] = [];
    if (mimeType === 'application/pdf') {
        const snapshotPages = Array.isArray(record.pages) ? record.pages : [];
        if (snapshotPages.length !== pageCount) throw new Error(`construction-plan-field-use-snapshot-page-manifest-incomplete:${drawingId}`);
        const parser = new PDFParse({ data: loaded.bytes });
        try {
            const info = await parser.getInfo({ parsePageInfo: true });
            if (info.total !== pageCount) throw new Error(`construction-plan-field-use-source-page-count-mismatch:${drawingId}`);
            const documentProxy = (parser as unknown as { doc?: PdfJsDocumentProxy }).doc;
            if (!documentProxy?.getPage) throw new Error(`construction-plan-field-use-source-geometry-reader-invalid:${drawingId}`);
            for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
                const page = await documentProxy.getPage(pageIndex + 1);
                let cropBoxPt: PdfBox;
                let rotation: 0 | 90 | 180 | 270;
                let viewportWidth: number;
                let viewportHeight: number;
                try {
                    cropBoxPt = pdfBoxFromView(page.view);
                    rotation = normalizePdfPageRotation(page.rotate);
                    const viewport = page.getViewport?.({ scale: 1 });
                    viewportWidth = Number(viewport?.width || (cropBoxPt.right - cropBoxPt.left));
                    viewportHeight = Number(viewport?.height || (cropBoxPt.top - cropBoxPt.bottom));
                } finally {
                    page.cleanup?.();
                }
                const manifest = snapshotPages.find((value) => isUnknownRecord(value) && value.pageIndex === pageIndex);
                const fingerprint = canonicalConstructionPlanDrawingPageFingerprint(sourceSha256, pageIndex);
                if (!isUnknownRecord(manifest)
                    || readTrimmedString(manifest, ['pageFingerprint']) !== fingerprint
                    || !pdfBoxesEqual(pdfBox(manifest.cropBoxPt), cropBoxPt)
                    || normalizeRotation(manifest.rotation) !== rotation
                    || !Number.isFinite(viewportWidth) || viewportWidth <= 0
                    || !Number.isFinite(viewportHeight) || viewportHeight <= 0) {
                    throw new Error(`construction-plan-field-use-page-manifest-mismatch:${drawingId}:${pageIndex}`);
                }
                if (!selectedPageIndexes.has(pageIndex)) continue;
                const scale = Math.min(
                    2,
                    CONSTRUCTION_PLAN_DRAWING_PREVIEW_MAX_RASTER_DIMENSION / Math.max(viewportWidth, viewportHeight),
                );
                const screenshot = await parser.getScreenshot({
                    partial: [pageIndex + 1],
                    scale: Math.max(scale, 0.1),
                    imageDataUrl: false,
                    imageBuffer: true,
                });
                const screenshotPage = screenshot.pages[0];
                const png = screenshotPage ? Buffer.from(screenshotPage.data) : Buffer.alloc(0);
                if (screenshot.pages.length !== 1 || screenshotPage?.pageNumber !== pageIndex + 1
                    || png.length < 8 || !png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
                    throw new Error(`construction-plan-field-use-source-page-raster-invalid:${drawingId}:${pageIndex}`);
                }
                const dimensions = await inspectRasterDimensions(png);
                pages.push({ pageIndex, bytes: png, ...dimensions, cropBoxPt, rotation, pageFingerprint: fingerprint });
            }
        } finally {
            await parser.destroy();
        }
        if (pages.length !== selectedPageIndexes.size) throw new Error(`construction-plan-field-use-selected-page-missing:${drawingId}`);
    } else {
        if (pageCount !== 1) throw new Error(`construction-plan-field-use-image-page-count-invalid:${drawingId}`);
        const dimensions = await inspectRasterDimensions(loaded.bytes);
        const manifest = Array.isArray(record.pages) && isUnknownRecord(record.pages[0]) ? record.pages[0] : undefined;
        const cropBoxPt = manifest
            ? pdfBox(manifest.cropBoxPt)
            : { left: 0, bottom: 0, right: dimensions.width, top: dimensions.height };
        const fingerprint = canonicalConstructionPlanDrawingPageFingerprint(sourceSha256, 0);
        if (manifest && (manifest.pageIndex !== 0 || readTrimmedString(manifest, ['pageFingerprint']) !== fingerprint)) {
            throw new Error(`construction-plan-field-use-page-manifest-mismatch:${drawingId}:0`);
        }
        pages.push({
            pageIndex: 0,
            bytes: loaded.bytes,
            ...dimensions,
            cropBoxPt,
            rotation: manifest ? normalizeRotation(manifest.rotation) : 0,
            pageFingerprint: fingerprint,
        });
    }
    return { record, source: ref, sourceBytes: Buffer.from(loaded.bytes), pages };
};

const drawingPageIndexForRecord = (
    content: UnknownRecord,
    pageNumber: number,
    slot: string,
    drawing: UnknownRecord,
    contract: ConstructionPlanServerTemplateContract,
): number => {
    const sectionKey = contract.pages[pageNumber - 1].sectionKey;
    const section = sectionByKey(content, sectionKey);
    const sectionContent = section.content as UnknownRecord;
    const map = isUnknownRecord(sectionContent.drawingPageIndexes) ? sectionContent.drawingPageIndexes : undefined;
    const explicit = map?.[slot] ?? sectionContent.drawingPageIndex;
    if (explicit === undefined) {
        if (drawing.pageCount !== 1) throw new Error(`construction-plan-field-use-drawing-page-selection-required:${pageNumber}:${slot}`);
        return 0;
    }
    if (!Number.isInteger(explicit) || Number(explicit) < 0 || Number(explicit) >= Number(drawing.pageCount)) {
        throw new Error(`construction-plan-field-use-drawing-page-selection-invalid:${pageNumber}:${slot}`);
    }
    return Number(explicit);
};

const buildDrawingPanels = async (
    content: UnknownRecord,
    loadDrawingSource: ConstructionPlanFieldUseDrawingSourceLoader,
    contract: ConstructionPlanServerTemplateContract,
): Promise<Map<number, DrawingPanelModel[]>> => {
    if (!Array.isArray(content.drawings) || !Array.isArray(content.drawingApplicability)) {
        throw new Error('construction-plan-field-use-drawing-arrays-invalid');
    }
    const records = new Map<string, UnknownRecord>();
    content.drawings.forEach((record, index) => {
        if (!isUnknownRecord(record)) throw new Error(`construction-plan-field-use-drawing-record-invalid:${index}`);
        const id = readTrimmedString(record, ['id']);
        if (!id || records.has(id)) throw new Error(`construction-plan-field-use-drawing-id-invalid:${index}`);
        records.set(id, record);
    });
    const decisions = new Map<string, UnknownRecord>();
    content.drawingApplicability.forEach((decision, index) => {
        if (!isUnknownRecord(decision)) throw new Error(`construction-plan-field-use-drawing-decision-invalid:${index}`);
        const slot = readTrimmedString(decision, ['drawingSlot']);
        if (!slot || !/^D-0[1-6]$/.test(slot) || decisions.has(slot)) {
            throw new Error(`construction-plan-field-use-drawing-decision-slot-invalid:${index}`);
        }
        decisions.set(slot, decision);
    });
    ['D-01', 'D-02', 'D-03', 'D-04', 'D-05', 'D-06'].forEach((slot) => {
        if (!decisions.has(slot)) throw new Error(`construction-plan-field-use-drawing-decision-missing:${slot}`);
    });
    const referencedIds = Array.from(new Set(Array.from(decisions.values()).flatMap((decision) => {
        if (decision.decision === 'not_applicable') {
            if (!readTrimmedString(decision, ['reason']) || !readTrimmedString(decision, ['reviewedBy'])) {
                throw new Error(`construction-plan-field-use-drawing-na-evidence-missing:${decision.drawingSlot}`);
            }
            return [];
        }
        if (decision.decision !== 'applicable' && decision.decision !== 'replacement') {
            throw new Error(`construction-plan-field-use-drawing-decision-invalid:${decision.drawingSlot}`);
        }
        if (decision.decision === 'replacement' && !readTrimmedString(decision, ['technicalReviewReference'])) {
            throw new Error(`construction-plan-field-use-drawing-replacement-evidence-missing:${decision.drawingSlot}`);
        }
        const id = readTrimmedString(decision, ['drawingId']);
        if (!id || !records.has(id)) throw new Error(`construction-plan-field-use-drawing-reference-invalid:${decision.drawingSlot}`);
        return [id];
    })));
    records.forEach((record, drawingId) => {
        if (referencedIds.includes(drawingId)) return;
        if (Array.isArray(record.annotations) && record.annotations.length > 0) {
            throw new Error(`construction-plan-field-use-unreferenced-annotation-drawing:${drawingId}`);
        }
        throw new Error(`construction-plan-field-use-unreferenced-drawing:${drawingId}`);
    });
    const prepared = new Map<string, PreparedDrawing>();
    const selectedIndexesByDrawing = new Map<string, Set<number>>();
    const slotsByPage = drawingSlotsByPage(contract);
    Object.entries(slotsByPage).forEach(([rawPageNumber, slots]) => {
        const pageNumber = Number(rawPageNumber);
        slots.forEach((slot) => {
            const decision = decisions.get(slot) as UnknownRecord;
            if (decision.decision === 'not_applicable') return;
            const drawingId = readTrimmedString(decision, ['drawingId']) as string;
            const record = records.get(drawingId) as UnknownRecord;
            const pageIndex = drawingPageIndexForRecord(content, pageNumber, slot, record, contract);
            const selected = selectedIndexesByDrawing.get(drawingId) || new Set<number>();
            selected.add(pageIndex);
            selectedIndexesByDrawing.set(drawingId, selected);
        });
    });
    for (const drawingId of referencedIds.sort()) {
        const record = records.get(drawingId) as UnknownRecord;
        if (record.approvalStatus !== 'approved' || !readTrimmedString(record, ['approvalReference'])) {
            throw new Error(`construction-plan-field-use-drawing-not-approved:${drawingId}`);
        }
        prepared.set(drawingId, await prepareDrawing(
            record,
            loadDrawingSource,
            selectedIndexesByDrawing.get(drawingId) || new Set<number>(),
        ));
    }

    const validatedAnnotations = new Map<string, UnknownRecord[]>();
    prepared.forEach((drawing, drawingId) => {
        const rawAnnotations = Array.isArray(drawing.record.annotations) ? drawing.record.annotations : [];
        const ids = new Set<string>();
        const validated = rawAnnotations.map((rawAnnotation) => {
            if (!isUnknownRecord(rawAnnotation) || !Number.isInteger(rawAnnotation.pageIndex)
                || Number(rawAnnotation.pageIndex) < 0 || Number(rawAnnotation.pageIndex) >= Number(drawing.record.pageCount)) {
                throw new Error(`construction-plan-field-use-annotation-page-invalid:${drawingId}`);
            }
            const annotationId = readTrimmedString(rawAnnotation, ['id']);
            if (!annotationId || ids.has(annotationId)) {
                throw new Error(`construction-plan-field-use-annotation-id-duplicate:${drawingId}:${annotationId || '-'}`);
            }
            ids.add(annotationId);
            const fingerprint = canonicalConstructionPlanDrawingPageFingerprint(
                drawing.source.sourceSha256,
                Number(rawAnnotation.pageIndex),
            );
            return assertAnnotation(rawAnnotation, drawingId, fingerprint);
        });
        validatedAnnotations.set(drawingId, validated);
    });

    const result = new Map<number, DrawingPanelModel[]>();
    const renderedAnnotationIds = new Map<string, Set<string>>();
    for (const [rawPageNumber, slots] of Object.entries(slotsByPage)) {
        const pageNumber = Number(rawPageNumber);
        const panels: DrawingPanelModel[] = [];
        for (const slot of slots) {
            const decision = decisions.get(slot) as UnknownRecord;
            if (decision.decision === 'not_applicable') {
                panels.push({ slot, decision, annotations: [] });
                continue;
            }
            const drawingId = readTrimmedString(decision, ['drawingId']) as string;
            const drawing = prepared.get(drawingId) as PreparedDrawing;
            const pageIndex = drawingPageIndexForRecord(content, pageNumber, slot, drawing.record, contract);
            const selectedPage = drawing.pages.find((page) => page.pageIndex === pageIndex);
            if (!selectedPage) throw new Error(`construction-plan-field-use-selected-page-missing:${drawingId}:${pageIndex}`);
            const annotations = (validatedAnnotations.get(drawingId) || [])
                .filter((annotation) => annotation.pageIndex === pageIndex)
                .sort((left, right) => Number(left.sequence || Number.MAX_SAFE_INTEGER) - Number(right.sequence || Number.MAX_SAFE_INTEGER)
                    || String(left.id).localeCompare(String(right.id), 'en'));
            const seen = renderedAnnotationIds.get(drawingId) || new Set<string>();
            annotations.forEach((annotation) => seen.add(String(annotation.id)));
            renderedAnnotationIds.set(drawingId, seen);
            const annotationHash = sha256Hex(canonicalStringify(annotations));
            const bindingWithoutHash = {
                slot,
                drawingId,
                drawingNo: readTrimmedString(drawing.record, ['drawingNo']) || drawingId,
                storagePath: drawing.source.storagePath,
                sourceGeneration: drawing.source.sourceGeneration,
                sourceSha256: drawing.source.sourceSha256,
                mimeType: drawing.source.mimeType,
                pageIndex,
                pageFingerprint: selectedPage.pageFingerprint,
                cropBoxPt: selectedPage.cropBoxPt,
                rotation: selectedPage.rotation,
                annotationCount: annotations.length,
                annotationHash,
            };
            const binding: ConstructionPlanFieldUseDrawingBinding = {
                ...bindingWithoutHash,
                bindingHash: sha256Hex(canonicalStringify(bindingWithoutHash)),
            };
            panels.push({ slot, decision, drawing, selectedPage, annotations, binding });
        }
        result.set(pageNumber, panels);
    }
    prepared.forEach((drawing, drawingId) => {
        const annotations = Array.isArray(drawing.record.annotations) ? drawing.record.annotations : [];
        const expectedIds = annotations.map((annotation) => isUnknownRecord(annotation) ? readTrimmedString(annotation, ['id']) : undefined);
        if (expectedIds.some((id) => !id) || expectedIds.some((id) => !renderedAnnotationIds.get(drawingId)?.has(id as string))) {
            throw new Error(`construction-plan-field-use-annotation-not-composed:${drawingId}`);
        }
    });
    return result;
};

const wrapText = (context: SKRSContext2D, value: string, maxWidth: number): string[] => {
    const paragraphs = String(value ?? '-').replace(/\r/g, '').split('\n');
    const result: string[] = [];
    paragraphs.forEach((paragraph) => {
        if (!paragraph) { result.push(''); return; }
        let line = '';
        Array.from(paragraph).forEach((character) => {
            const candidate = `${line}${character}`;
            if (line && context.measureText(candidate).width > maxWidth) {
                result.push(line);
                line = character;
            } else line = candidate;
        });
        if (line) result.push(line);
    });
    return result.length ? result : ['-'];
};

const drawWrapped = (
    context: SKRSContext2D,
    value: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number,
): number => {
    const lines = wrapText(context, value, maxWidth);
    lines.forEach((line, index) => context.fillText(line, x, y + (index * lineHeight)));
    return lines.length * lineHeight;
};

const drawHeader = (
    context: SKRSContext2D,
    model: FieldUsePageModel,
    content: UnknownRecord,
    profile: ConstructionPlanFieldUseProfile,
): void => {
    const tradeTitle = content.tradeType === 'system-scaffold' ? '시스템비계 시공계획서' : '시스템동바리 시공계획서';
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, PAGE_WIDTH_PX, PAGE_HEIGHT_PX);
    context.fillStyle = profile === 'issued' ? '#0b486b' : '#7c2d12';
    context.fillRect(0, 0, PAGE_WIDTH_PX, 22);
    context.fillRect(0, PAGE_HEIGHT_PX - 22, PAGE_WIDTH_PX, 22);
    context.fillStyle = '#0f172a';
    context.font = `700 27px "${FIELD_USE_FONT_FAMILY}"`;
    context.fillText(tradeTitle, PAGE_MARGIN_PX, 75);
    context.textAlign = 'right';
    context.font = `400 15px "${FIELD_USE_FONT_FAMILY}"`;
    context.fillStyle = '#475569';
    context.fillText(`${primitiveText(content.documentNo)} · REV.${String(content.revision).padStart(2, '0')}`, PAGE_WIDTH_PX - PAGE_MARGIN_PX, 72);
    context.textAlign = 'left';
    context.fillStyle = '#0f172a';
    context.font = `700 32px "${FIELD_USE_FONT_FAMILY}"`;
    const continuationLabel = model.continuationIndex > 0 ? ` (계속 ${model.continuationIndex})` : '';
    context.fillText(`${String(model.contract.pageNumber).padStart(2, '0')}. ${model.title}${continuationLabel}`, PAGE_MARGIN_PX, 132);
    context.fillStyle = profile === 'issued' ? '#075985' : '#9a3412';
    context.font = `700 16px "${FIELD_USE_FONT_FAMILY}"`;
    context.fillText(profile === 'issued' ? '현장사용 발행본' : '발행 후보 · 현장사용 금지', PAGE_MARGIN_PX, 168);
    context.textAlign = 'right';
    context.fillStyle = '#64748b';
    context.font = `400 ${MIN_BODY_FONT_PX}px "${FIELD_USE_FONT_FAMILY}"`;
    context.fillText(constructionPlanSectionPageLabel(model.contract.pageNumber), PAGE_WIDTH_PX - PAGE_MARGIN_PX, 166);
    context.textAlign = 'left';
    context.strokeStyle = '#cbd5e1';
    context.lineWidth = 2;
    context.beginPath(); context.moveTo(PAGE_MARGIN_PX, 190); context.lineTo(PAGE_WIDTH_PX - PAGE_MARGIN_PX, 190); context.stroke();
};

const drawExecutionNotice = (context: SKRSContext2D, pageNumber: number, y: number): number => {
    if (!EXECUTION_FORM_PAGES.has(pageNumber)) return y;
    context.fillStyle = '#fff7ed'; context.fillRect(PAGE_MARGIN_PX, y, PAGE_WIDTH_PX - (PAGE_MARGIN_PX * 2), 72);
    context.strokeStyle = '#ea580c'; context.strokeRect(PAGE_MARGIN_PX, y, PAGE_WIDTH_PX - (PAGE_MARGIN_PX * 2), 72);
    context.fillStyle = '#9a3412'; context.font = `700 15px "${FIELD_USE_FONT_FAMILY}"`;
    context.fillText(EXECUTION_FORM_EMPTY_NOTICE, PAGE_MARGIN_PX + 16, y + 27);
    context.font = `400 ${MIN_BODY_FONT_PX}px "${FIELD_USE_FONT_FAMILY}"`;
    context.fillText(EXECUTION_FORM_EVIDENCE_NOTICE, PAGE_MARGIN_PX + 16, y + 53);
    return y + 92;
};

const drawRows = (
    context: SKRSContext2D,
    rows: HumanRow[],
    startY: number,
    maxY: number,
    pageNumber: number,
): number => {
    let y = startY;
    rows.forEach((row, index) => {
        context.font = `400 15px "${FIELD_USE_FONT_FAMILY}"`;
        const valueLines = wrapText(context, row.value, PAGE_WIDTH_PX - 445);
        context.font = `700 ${MIN_BODY_FONT_PX}px "${FIELD_USE_FONT_FAMILY}"`;
        const labelLines = wrapText(context, row.label, 270);
        const rowHeight = Math.max(46, (Math.max(valueLines.length, labelLines.length) * 22) + 22);
        if (y + rowHeight > maxY) throw new Error(`construction-plan-field-use-overflow:page-${pageNumber}:row-${index + 1}`);
        context.fillStyle = index % 2 === 0 ? '#f8fafc' : '#ffffff';
        context.fillRect(PAGE_MARGIN_PX, y, PAGE_WIDTH_PX - (PAGE_MARGIN_PX * 2), rowHeight);
        context.strokeStyle = '#d8e1e8'; context.strokeRect(PAGE_MARGIN_PX, y, PAGE_WIDTH_PX - (PAGE_MARGIN_PX * 2), rowHeight);
        context.fillStyle = '#164e63'; context.font = `700 ${MIN_BODY_FONT_PX}px "${FIELD_USE_FONT_FAMILY}"`;
        drawWrapped(context, row.label, PAGE_MARGIN_PX + 15, y + 29, 270, 22);
        context.fillStyle = '#111827'; context.font = `400 15px "${FIELD_USE_FONT_FAMILY}"`;
        valueLines.forEach((line, lineIndex) => context.fillText(line, 382, y + 29 + (lineIndex * 22)));
        y += rowHeight;
    });
    return y;
};

const drawCompactRows = (
    context: SKRSContext2D,
    rows: HumanRow[],
    startY: number,
    maxY: number,
    pageNumber: number,
): number => {
    let y = startY;
    rows.forEach((row, index) => {
        context.font = `400 ${MIN_BODY_FONT_PX}px "${FIELD_USE_FONT_FAMILY}"`;
        const valueLines = wrapText(context, row.value, PAGE_WIDTH_PX - 390);
        context.font = `700 ${MIN_BODY_FONT_PX}px "${FIELD_USE_FONT_FAMILY}"`;
        const labelLines = wrapText(context, row.label, 235);
        const rowHeight = Math.max(42, (Math.max(valueLines.length, labelLines.length) * 20) + 16);
        if (y + rowHeight > maxY) throw new Error(`construction-plan-field-use-overflow:page-${pageNumber}:compact-row-${index + 1}`);
        context.fillStyle = index % 2 === 0 ? '#f8fafc' : '#ffffff';
        context.fillRect(PAGE_MARGIN_PX, y, PAGE_WIDTH_PX - (PAGE_MARGIN_PX * 2), rowHeight);
        context.strokeStyle = '#d8e1e8'; context.strokeRect(PAGE_MARGIN_PX, y, PAGE_WIDTH_PX - (PAGE_MARGIN_PX * 2), rowHeight);
        context.fillStyle = '#164e63'; context.font = `700 ${MIN_BODY_FONT_PX}px "${FIELD_USE_FONT_FAMILY}"`;
        labelLines.forEach((line, lineIndex) => context.fillText(line, PAGE_MARGIN_PX + 12, y + 27 + (lineIndex * 20)));
        context.fillStyle = '#111827'; context.font = `400 ${MIN_BODY_FONT_PX}px "${FIELD_USE_FONT_FAMILY}"`;
        valueLines.forEach((line, lineIndex) => context.fillText(line, 340, y + 27 + (lineIndex * 20)));
        y += rowHeight;
    });
    return y;
};

const drawDenseRows = (
    context: SKRSContext2D,
    rows: HumanRow[],
    startY: number,
    maxY: number,
    pageNumber: number,
): number => {
    let y = startY;
    rows.forEach((row, index) => {
        context.font = `400 ${MIN_BODY_FONT_PX}px "${FIELD_USE_FONT_FAMILY}"`;
        const valueLines = wrapText(context, row.value, PAGE_WIDTH_PX - 338);
        context.font = `700 ${MIN_BODY_FONT_PX}px "${FIELD_USE_FONT_FAMILY}"`;
        const labelLines = wrapText(context, row.label, 185);
        const rowHeight = Math.max(38, (Math.max(valueLines.length, labelLines.length) * 20) + 14);
        if (y + rowHeight > maxY) throw new Error(`construction-plan-field-use-overflow:page-${pageNumber}:dense-row-${index + 1}`);
        context.fillStyle = index % 2 === 0 ? '#f8fafc' : '#ffffff';
        context.fillRect(PAGE_MARGIN_PX, y, PAGE_WIDTH_PX - (PAGE_MARGIN_PX * 2), rowHeight);
        context.strokeStyle = '#d8e1e8'; context.strokeRect(PAGE_MARGIN_PX, y, PAGE_WIDTH_PX - (PAGE_MARGIN_PX * 2), rowHeight);
        context.fillStyle = '#164e63'; context.font = `700 ${MIN_BODY_FONT_PX}px "${FIELD_USE_FONT_FAMILY}"`;
        labelLines.forEach((line, lineIndex) => context.fillText(line, PAGE_MARGIN_PX + 9, y + 25 + (lineIndex * 20)));
        context.fillStyle = '#111827'; context.font = `400 ${MIN_BODY_FONT_PX}px "${FIELD_USE_FONT_FAMILY}"`;
        valueLines.forEach((line, lineIndex) => context.fillText(line, 278, y + 25 + (lineIndex * 20)));
        y += rowHeight;
    });
    return y;
};

const drawTwoColumnRows = (
    context: SKRSContext2D,
    rows: HumanRow[],
    startY: number,
    maxY: number,
    pageNumber: number,
): number => {
    const gap = 14;
    const columnWidth = (PAGE_WIDTH_PX - (PAGE_MARGIN_PX * 2) - gap) / 2;
    const rowsPerColumn = Math.ceil(rows.length / 2);
    let bottom = startY;
    for (let column = 0; column < 2; column += 1) {
        let y = startY;
        const start = column * rowsPerColumn;
        const entries = rows.slice(start, start + rowsPerColumn);
        const x = PAGE_MARGIN_PX + (column * (columnWidth + gap));
        entries.forEach((row, localIndex) => {
            const index = start + localIndex;
            context.font = `400 ${MIN_BODY_FONT_PX}px "${FIELD_USE_FONT_FAMILY}"`;
            const valueLines = wrapText(context, row.value, columnWidth - 145);
            context.font = `700 ${MIN_BODY_FONT_PX}px "${FIELD_USE_FONT_FAMILY}"`;
            const labelLines = wrapText(context, row.label, 108);
            const rowHeight = Math.max(38, (Math.max(valueLines.length, labelLines.length) * 20) + 14);
            if (y + rowHeight > maxY) throw new Error(`construction-plan-field-use-overflow:page-${pageNumber}:two-column-row-${index + 1}`);
            context.fillStyle = localIndex % 2 === 0 ? '#f8fafc' : '#ffffff';
            context.fillRect(x, y, columnWidth, rowHeight);
            context.strokeStyle = '#d8e1e8'; context.strokeRect(x, y, columnWidth, rowHeight);
            context.fillStyle = '#164e63'; context.font = `700 ${MIN_BODY_FONT_PX}px "${FIELD_USE_FONT_FAMILY}"`;
            labelLines.forEach((line, lineIndex) => context.fillText(line, x + 8, y + 25 + (lineIndex * 20)));
            context.fillStyle = '#111827'; context.font = `400 ${MIN_BODY_FONT_PX}px "${FIELD_USE_FONT_FAMILY}"`;
            valueLines.forEach((line, lineIndex) => context.fillText(line, x + 126, y + 25 + (lineIndex * 20)));
            y += rowHeight;
        });
        bottom = Math.max(bottom, y);
    }
    return bottom;
};

const drawCoverPage = (
    context: SKRSContext2D,
    model: FieldUsePageModel,
    content: UnknownRecord,
    profile: ConstructionPlanFieldUseProfile,
    snapshotHash: string,
    approvalEvidence: UnknownRecord,
    brandLogo: Awaited<ReturnType<typeof loadImage>>,
    totalPhysicalPages: number,
): void => {
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, PAGE_WIDTH_PX, PAGE_HEIGHT_PX);
    context.fillStyle = profile === 'issued' ? '#0b486b' : '#7c2d12'; context.fillRect(0, 0, PAGE_WIDTH_PX, 34);
    context.fillStyle = '#0f172a'; context.textAlign = 'center';
    const logoWidth = 280;
    const logoHeight = logoWidth * Number(brandLogo.height) / Number(brandLogo.width);
    if (!Number.isFinite(logoHeight) || logoHeight <= 0 || logoHeight > 140) throw new Error('construction-plan-field-use-brand-logo-dimensions-invalid');
    context.drawImage(brandLogo, (PAGE_WIDTH_PX - logoWidth) / 2, 82, logoWidth, logoHeight);
    context.font = `700 20px "${FIELD_USE_FONT_FAMILY}"`; context.fillText('청연이엔지', PAGE_WIDTH_PX / 2, 232);
    const isScaffold = content.tradeType === 'system-scaffold';
    context.font = `700 32px "${FIELD_USE_FONT_FAMILY}"`; context.fillText(isScaffold ? 'SYSTEM SCAFFOLD' : 'SYSTEM SHORING', PAGE_WIDTH_PX / 2, 278);
    context.font = `700 58px "${FIELD_USE_FONT_FAMILY}"`; context.fillText(isScaffold ? '시스템비계 시공계획서' : '시스템동바리 시공계획서', PAGE_WIDTH_PX / 2, 365);
    context.fillStyle = profile === 'issued' ? '#075985' : '#9a3412'; context.font = `700 22px "${FIELD_USE_FONT_FAMILY}"`;
    context.fillText(profile === 'issued' ? '현장사용 발행본' : '발행 후보 · 현장사용 금지', PAGE_WIDTH_PX / 2, 425);
    context.textAlign = 'left';
    const project = content.projectSnapshot as UnknownRecord;
    const coverRows: HumanRow[] = [
        { label: '계획서명', value: primitiveText(content.title) },
        { label: '현장명', value: primitiveText(project.siteName) },
        { label: '공종', value: constructionPlanTradeDisplayName(content.tradeType) },
        { label: '문서번호', value: primitiveText(content.documentNo) },
        { label: '개정·작성일', value: `REV.${String(content.revision).padStart(2, '0')} · ${primitiveText(content.documentDate)}` },
        { label: '발주처·원도급사', value: `${primitiveText(project.clientName)} · ${primitiveText(project.contractorName)}` },
        ...approvalControlRows(content, approvalEvidence, true),
        { label: '승인 스냅샷', value: abbreviateConstructionPlanSha256(snapshotHash) },
        ...sectionRows(sectionByKey(content, 'cover')),
    ];
    drawRows(context, coverRows, 520, 1410, 1);
    context.fillStyle = '#334155'; context.font = `400 ${MIN_BODY_FONT_PX}px "${FIELD_USE_FONT_FAMILY}"`; context.textAlign = 'center';
    context.fillText('본 문서는 승인 스냅샷과 원본 도면 무결성을 서버에서 검증하여 생성했습니다.', PAGE_WIDTH_PX / 2, 1495);
    context.textAlign = 'left';
    drawFooter(context, model, profile, snapshotHash, totalPhysicalPages);
};

const drawOrganizationHierarchy = (
    context: SKRSContext2D,
    content: UnknownRecord,
    rows: HumanRow[],
    startY: number,
): void => {
    const organization = content.organizationSnapshot as UnknownRecord;
    const assignments = organization.assignments as UnknownRecord[];
    if (assignments.length > 8) throw new Error('construction-plan-field-use-overflow:page-7:role-card-count');
    const assignmentRows = rows.slice(1, assignments.length + 1);
    const workerCount = (organization.additionalWorkers as unknown[]).length;
    const workerRows = rows.slice(assignments.length + 1, assignments.length + 1 + workerCount);
    const sectionAndSnapshotRows = [rows[0], ...rows.slice(assignments.length + 1 + workerCount)];
    let y = drawTwoColumnRows(context, sectionAndSnapshotRows, startY, FOOTER_Y_PX - 45, 7) + 12;
    const gap = 12;
    const cardWidth = (PAGE_WIDTH_PX - (PAGE_MARGIN_PX * 2) - gap) / 2;
    for (let pair = 0; pair < Math.ceil(assignments.length / 2); pair += 1) {
        const pairModels = [0, 1].flatMap((column) => {
            const index = (pair * 2) + column;
            const assignment = assignments[index];
            if (!assignment) return [];
            const worker = isUnknownRecord(assignment.worker) ? assignment.worker : {};
            context.font = `700 ${MIN_BODY_FONT_PX}px "${FIELD_USE_FONT_FAMILY}"`;
            const heading = `${index + 1}. ${primitiveText(assignment.label)} · ${primitiveText(assignment.role)} · ${primitiveText(worker.name)} · ${primitiveText(worker.position)}`;
            const headingLines = wrapText(context, heading, cardWidth - 24);
            context.font = `400 ${MIN_BODY_FONT_PX}px "${FIELD_USE_FONT_FAMILY}"`;
            const detailLines = wrapText(context, assignmentRows[index]?.value || '-', cardWidth - 24);
            const height = 20 + (headingLines.length * 20) + (detailLines.length * 20) + 18;
            return [{ index, column, headingLines, detailLines, height }];
        });
        const rowHeight = Math.max(...pairModels.map((model) => model.height));
        if (!Number.isFinite(rowHeight) || y + rowHeight > FOOTER_Y_PX - 45) {
            throw new Error(`construction-plan-field-use-overflow:page-7:role-card-row-${pair + 1}`);
        }
        pairModels.forEach((card) => {
            const x = PAGE_MARGIN_PX + (card.column * (cardWidth + gap));
            context.fillStyle = card.index === 0 ? '#e0f2fe' : '#f8fafc'; context.fillRect(x, y, cardWidth, rowHeight);
            context.strokeStyle = card.index === 0 ? '#0284c7' : '#94a3b8'; context.strokeRect(x, y, cardWidth, rowHeight);
            context.fillStyle = '#164e63'; context.font = `700 ${MIN_BODY_FONT_PX}px "${FIELD_USE_FONT_FAMILY}"`;
            card.headingLines.forEach((line, lineIndex) => context.fillText(line, x + 12, y + 25 + (lineIndex * 20)));
            const detailY = y + 25 + (card.headingLines.length * 20) + 8;
            context.fillStyle = '#111827'; context.font = `400 ${MIN_BODY_FONT_PX}px "${FIELD_USE_FONT_FAMILY}"`;
            card.detailLines.forEach((line, lineIndex) => context.fillText(line, x + 12, detailY + (lineIndex * 20)));
        });
        y += rowHeight + gap;
    }
    drawTwoColumnRows(context, workerRows, y, FOOTER_Y_PX - 45, 7);
};

const dedicatedDataPageHeading = (pageNumber: number): string | undefined => ({
    2: '문서 식별 · 계보 · 승인 증적',
    6: '공사 및 적용구간 개요',
    7: '역할 위계 · 업무분장 · 작업반 편성',
    9: '장비 제원 · 작업구간 · 배정 · 통제조치',
    11: '양중장비 전용 작업계획',
    17: '구조값 · 단위 · 출처 · 개정 · 적용구간 · 검증',
    22: 'D-01~D-06 적용성 · 승인도면 등록부',
    29: '구조값 · 단위 · 출처 · 개정 · 적용구간 · 검증',
    36: '작업단계 · 위험요인 · 초기등급 · 대책 · 담당 · 잔여등급 · 검증',
} as Readonly<Record<number, string>>)[pageNumber];

const drawDedicatedDataPage = (
    context: SKRSContext2D,
    model: FieldUsePageModel,
    content: UnknownRecord,
    snapshotHash: string,
    approvalEvidenceHash: string,
    approvalEvidence: UnknownRecord,
    provenance: ConstructionPlanFieldUseProvenance,
    startY: number,
): boolean => {
    const page = model.contract.pageNumber;
    const rows = visualRowsForPage(model, content, snapshotHash, approvalEvidenceHash, approvalEvidence, provenance);
    const heading = dedicatedDataPageHeading(page);
    if (page === 2) {
        context.fillStyle = '#164e63'; context.font = `700 16px "${FIELD_USE_FONT_FAMILY}"`; context.fillText(heading as string, PAGE_MARGIN_PX, startY + 8);
        drawTwoColumnRows(context, rows, startY + 28, FOOTER_Y_PX - 45, page); return true;
    }
    if (page === 6) {
        context.fillStyle = '#164e63'; context.font = `700 16px "${FIELD_USE_FONT_FAMILY}"`; context.fillText(heading as string, PAGE_MARGIN_PX, startY + 8);
        drawRows(context, rows, startY + 28, FOOTER_Y_PX - 45, page); return true;
    }
    if (page === 7) {
        context.fillStyle = '#164e63'; context.font = `700 16px "${FIELD_USE_FONT_FAMILY}"`; context.fillText(heading as string, PAGE_MARGIN_PX, startY + 8);
        drawOrganizationHierarchy(context, content, rows, startY + 28); return true;
    }
    if (page === 9 || page === 11) {
        context.fillStyle = '#164e63'; context.font = `700 16px "${FIELD_USE_FONT_FAMILY}"`; context.fillText(heading as string, PAGE_MARGIN_PX, startY + 8);
        drawTwoColumnRows(context, rows, startY + 28, FOOTER_Y_PX - 45, page); return true;
    }
    if (page === 17 || page === 29) {
        context.fillStyle = '#164e63'; context.font = `700 16px "${FIELD_USE_FONT_FAMILY}"`; context.fillText(heading as string, PAGE_MARGIN_PX, startY + 8);
        drawTwoColumnRows(context, rows, startY + 28, FOOTER_Y_PX - 45, page); return true;
    }
    if (page === 22) {
        context.fillStyle = '#164e63'; context.font = `700 16px "${FIELD_USE_FONT_FAMILY}"`; context.fillText(heading as string, PAGE_MARGIN_PX, startY + 8);
        drawTwoColumnRows(context, rows, startY + 28, FOOTER_Y_PX - 45, page); return true;
    }
    if (page === 36) {
        context.fillStyle = '#164e63'; context.font = `700 16px "${FIELD_USE_FONT_FAMILY}"`; context.fillText(heading as string, PAGE_MARGIN_PX, startY + 8);
        drawTwoColumnRows(context, rows, startY + 28, FOOTER_Y_PX - 45, page); return true;
    }
    return false;
};

const drawToc = (
    context: SKRSContext2D,
    pageNumber: number,
    contract: ConstructionPlanServerTemplateContract,
    logicalStartPhysicalPages: ReadonlyMap<number, number>,
): number => {
    const entries = contract.pages.filter((page) => page.pageNumber >= 5);
    const rows = pageNumber === 3 ? entries.slice(0, 19) : entries.slice(19, 38);
    if (rows.length !== 19) throw new Error(`construction-plan-field-use-toc-count-invalid:${pageNumber}`);
    let y = 235;
    rows.forEach((page) => {
        context.fillStyle = page.pageNumber % 2 ? '#f8fafc' : '#ffffff';
        context.fillRect(PAGE_MARGIN_PX, y, PAGE_WIDTH_PX - (PAGE_MARGIN_PX * 2), 58);
        context.strokeStyle = '#d8e1e8'; context.strokeRect(PAGE_MARGIN_PX, y, PAGE_WIDTH_PX - (PAGE_MARGIN_PX * 2), 58);
        context.fillStyle = '#0f172a'; context.font = `700 15px "${FIELD_USE_FONT_FAMILY}"`;
        context.fillText(String(page.pageNumber).padStart(2, '0'), PAGE_MARGIN_PX + 18, y + 36);
        context.font = `400 15px "${FIELD_USE_FONT_FAMILY}"`;
        context.fillText(page.title, PAGE_MARGIN_PX + 92, y + 36);
        context.textAlign = 'right'; context.fillStyle = '#64748b';
        const physicalStart = logicalStartPhysicalPages.get(page.pageNumber);
        if (!physicalStart) throw new Error(`construction-plan-field-use-toc-physical-start-missing:${page.pageNumber}`);
        context.fillText(`${constructionPlanSectionPageLabel(page.pageNumber)} · ${physicalStart}쪽`, PAGE_WIDTH_PX - PAGE_MARGIN_PX - 18, y + 36); context.textAlign = 'left';
        y += 58;
    });
    return y;
};

const annotationPath = (
    context: SKRSContext2D,
    geometry: UnknownRecord,
    x: number,
    y: number,
    width: number,
    height: number,
): void => {
    context.beginPath();
    if (geometry.kind === 'rect') {
        const cx = x + ((Number(geometry.x) + (Number(geometry.w) / 2)) * width);
        const cy = y + ((Number(geometry.y) + (Number(geometry.h) / 2)) * height);
        const halfW = Number(geometry.w) * width / 2;
        const halfH = Number(geometry.h) * height / 2;
        const angle = Number(geometry.rotationDeg || 0) * Math.PI / 180;
        const corners = [[-halfW, -halfH], [halfW, -halfH], [halfW, halfH], [-halfW, halfH]];
        corners.forEach(([dx, dy], index) => {
            const px = cx + (dx * Math.cos(angle)) - (dy * Math.sin(angle));
            const py = cy + (dx * Math.sin(angle)) + (dy * Math.cos(angle));
            if (index === 0) context.moveTo(px, py); else context.lineTo(px, py);
        });
        context.closePath();
    } else if (geometry.kind === 'polygon' || geometry.kind === 'polyline') {
        (geometry.vertices as unknown[]).forEach((rawPoint, index) => {
            const point = rawPoint as UnknownRecord;
            const px = x + (Number(point.x) * width); const py = y + (Number(point.y) * height);
            if (index === 0) context.moveTo(px, py); else context.lineTo(px, py);
        });
        if (geometry.kind === 'polygon') context.closePath();
    } else if (geometry.kind === 'ellipse') {
        context.ellipse(x + (Number(geometry.cx) * width), y + (Number(geometry.cy) * height), Number(geometry.rx) * width, Number(geometry.ry) * height, 0, 0, Math.PI * 2);
    } else if (geometry.kind === 'marker') {
        const cx = x + (Number(geometry.x) * width); const cy = y + (Number(geometry.y) * height);
        const markerType = String(geometry.markerType);
        if (markerType === 'warning' || markerType === 'access') {
            context.moveTo(cx, cy - 16); context.lineTo(cx + 16, cy + 14); context.lineTo(cx - 16, cy + 14); context.closePath();
        } else if (markerType === 'inspection') {
            context.moveTo(cx, cy - 16); context.lineTo(cx + 16, cy); context.lineTo(cx, cy + 16); context.lineTo(cx - 16, cy); context.closePath();
        } else if (markerType === 'hold') {
            context.rect(cx - 14, cy - 14, 28, 28);
        } else if (markerType === 'pin') {
            context.arc(cx, cy - 5, 12, Math.PI, 0); context.lineTo(cx, cy + 18); context.closePath();
        } else {
            context.arc(cx, cy, 15, 0, Math.PI * 2);
        }
    } else if (geometry.kind === 'text') {
        context.rect(x + (Number(geometry.x) * width), y + (Number(geometry.y) * height), Number(geometry.w) * width, Number(geometry.h) * height);
    }
};

const drawHatch = (
    context: SKRSContext2D,
    geometry: UnknownRecord,
    style: UnknownRecord,
    x: number,
    y: number,
    width: number,
    height: number,
    color: string,
): void => {
    if (style.hatch !== 'diagonal' && style.hatch !== 'cross') return;
    context.save();
    annotationPath(context, geometry, x, y, width, height);
    context.clip();
    context.strokeStyle = color; context.globalAlpha = Math.min(0.5, Number(style.opacity)); context.lineWidth = 1.5;
    for (let offset = -height; offset < width + height; offset += 22) {
        context.beginPath(); context.moveTo(x + offset, y + height); context.lineTo(x + offset + height, y); context.stroke();
        if (style.hatch === 'cross') {
            context.beginPath(); context.moveTo(x + offset, y); context.lineTo(x + offset + height, y + height); context.stroke();
        }
    }
    context.restore();
};

const drawArrowHead = (context: SKRSContext2D, from: { x: number; y: number }, to: { x: number; y: number }, color: string): void => {
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    context.fillStyle = color; context.beginPath(); context.moveTo(to.x, to.y);
    context.lineTo(to.x - (18 * Math.cos(angle - Math.PI / 6)), to.y - (18 * Math.sin(angle - Math.PI / 6)));
    context.lineTo(to.x - (18 * Math.cos(angle + Math.PI / 6)), to.y - (18 * Math.sin(angle + Math.PI / 6)));
    context.closePath(); context.fill();
};

const drawAnnotations = (
    context: SKRSContext2D,
    annotations: UnknownRecord[],
    x: number,
    y: number,
    width: number,
    height: number,
): void => {
    annotations.forEach((annotation) => {
        const geometry = annotation.geometry as UnknownRecord;
        const style = annotation.style as UnknownRecord;
        const palette = LAYER_STYLE[String(annotation.layer)];
        const strokeColor = resolveColorToken(style.strokeToken, palette.stroke, 'construction-plan-field-use-annotation-stroke-token-invalid');
        const fillColor = resolveColorToken(style.fillToken, palette.fill, 'construction-plan-field-use-annotation-fill-token-invalid');
        context.save();
        context.globalAlpha = Number(style.opacity);
        context.strokeStyle = strokeColor;
        context.fillStyle = fillColor;
        context.lineWidth = Math.max(2, Number(style.strokeWidthPt) * 2);
        const dash = style.dash === 'dash' ? [18, 10] : style.dash === 'dot' ? [4, 9] : palette.dash;
        context.setLineDash(dash);
        annotationPath(context, geometry, x, y, width, height);
        if (geometry.kind !== 'polyline') context.fill();
        context.stroke();
        drawHatch(context, geometry, style, x, y, width, height, strokeColor);
        if (geometry.kind === 'polyline') {
            const vertices = geometry.vertices as UnknownRecord[];
            const first = { x: x + (Number(vertices[0].x) * width), y: y + (Number(vertices[0].y) * height) };
            const lastIndex = vertices.length - 1;
            const last = { x: x + (Number(vertices[lastIndex].x) * width), y: y + (Number(vertices[lastIndex].y) * height) };
            if (geometry.arrowStart === true) drawArrowHead(context, last, first, strokeColor);
            if (geometry.arrowEnd === true) drawArrowHead(context, first, last, strokeColor);
        }
        context.restore();

        if (geometry.kind === 'marker') {
            const cx = x + (Number(geometry.x) * width); const cy = y + (Number(geometry.y) * height);
            const symbol: Readonly<Record<string, string>> = {
                pin: '•', warning: '!', hold: '×', inspection: '✓', sequence: String(annotation.sequence || '#'), equipment: 'E', access: '→',
            };
            context.fillStyle = '#111827'; context.font = `700 15px "${FIELD_USE_FONT_FAMILY}"`;
            context.textAlign = 'center'; context.textBaseline = 'middle';
            context.fillText(symbol[String(geometry.markerType)] || '?', cx, cy);
            context.textBaseline = 'alphabetic'; context.textAlign = 'left';
        }

        const label = [annotation.zoneCode, annotation.label].filter((value) => typeof value === 'string' && value).join(' · ');
        if (label) {
            const anchor = geometry.kind === 'ellipse'
                ? { x: Number(geometry.cx), y: Number(geometry.cy) }
                : geometry.kind === 'marker'
                    ? { x: Number(geometry.x), y: Number(geometry.y) }
                    : geometry.kind === 'text' || geometry.kind === 'rect'
                        ? { x: Number(geometry.x) + (Number(geometry.w) / 2), y: Number(geometry.y) + (Number(geometry.h) / 2) }
                        : (() => {
                            const points = geometry.vertices as UnknownRecord[];
                            return {
                                x: points.reduce((sum, point) => sum + Number(point.x), 0) / points.length,
                                y: points.reduce((sum, point) => sum + Number(point.y), 0) / points.length,
                            };
                        })();
            context.font = `700 ${Math.max(MIN_BODY_FONT_PX, Number(style.fontSizePt || 10) * 1.7)}px "${FIELD_USE_FONT_FAMILY}"`;
            const alignment = geometry.kind === 'text' && ['left', 'center', 'right'].includes(String(geometry.align))
                ? String(geometry.align) as 'left' | 'center' | 'right'
                : 'center';
            context.textAlign = alignment;
            context.strokeStyle = '#ffffff'; context.lineWidth = 5; context.strokeText(label, x + (anchor.x * width), y + (anchor.y * height));
            context.fillStyle = '#111827'; context.fillText(label, x + (anchor.x * width), y + (anchor.y * height));
            context.textAlign = 'left';
        }
    });
};

const drawDrawingPanel = async (
    context: SKRSContext2D,
    panel: DrawingPanelModel,
    x: number,
    y: number,
    width: number,
    height: number,
): Promise<void> => {
    context.fillStyle = '#f8fafc'; context.fillRect(x, y, width, height);
    context.strokeStyle = '#94a3b8'; context.lineWidth = 2; context.strokeRect(x, y, width, height);
    context.fillStyle = '#0f172a'; context.font = `700 16px "${FIELD_USE_FONT_FAMILY}"`;
    context.fillText(panel.slot, x + 14, y + 27);
    if (!panel.drawing || !panel.selectedPage || !panel.binding) {
        context.fillStyle = '#7c2d12'; context.font = `700 20px "${FIELD_USE_FONT_FAMILY}"`;
        context.fillText('해당없음', x + 20, y + 74);
        context.fillStyle = '#334155'; context.font = `400 15px "${FIELD_USE_FONT_FAMILY}"`;
        drawWrapped(context, primitiveText(panel.decision.reason), x + 20, y + 108, width - 40, 23);
        context.fillText(`확인자 ${primitiveText(panel.decision.reviewedBy)}`, x + 20, y + height - 24);
        return;
    }
    context.fillStyle = '#334155'; context.font = `400 ${MIN_ANNOTATION_CALLOUT_FONT_PX}px "${FIELD_USE_FONT_FAMILY}"`;
    context.fillText(constructionPlanDrawingPanelTitle({
        drawingNo: panel.binding.drawingNo,
        pageIndex: panel.binding.pageIndex,
        revision: panel.drawing.record.revision,
    }), x + 75, y + 27);
    const image = await loadImage(panel.selectedPage.bytes);
    context.font = `400 ${MIN_ANNOTATION_CALLOUT_FONT_PX}px "${FIELD_USE_FONT_FAMILY}"`;
    const callouts = panel.annotations.map(annotationCalloutVisibleText);
    const calloutLines = callouts.map((callout) => wrapText(context, callout, width - 28));
    const sourceText = constructionPlanDrawingSourceDisplay({
        sourceSha256: panel.binding.sourceSha256,
        sourceGeneration: panel.binding.sourceGeneration,
        pageFingerprintHash: sha256Hex(panel.binding.pageFingerprint),
    });
    context.font = `400 12.5px "${FIELD_USE_FONT_FAMILY}"`;
    const sourceLines = wrapText(context, sourceText, width - 28);
    const calloutHeight = calloutLines.reduce((sum, lines) => sum + (lines.length * 18) + 4, 0)
        + (sourceLines.length * 16) + 6;
    if (calloutHeight > height * 0.46) {
        throw new Error(`construction-plan-field-use-overflow:drawing-${panel.binding.drawingId}:annotation-callouts`);
    }
    const availableX = x + 12; const availableY = y + 42; const availableWidth = width - 24;
    const availableHeight = height - 82 - calloutHeight;
    if (availableHeight < 170) throw new Error(`construction-plan-field-use-overflow:drawing-${panel.binding.drawingId}:image-area`);
    const cropWidth = panel.selectedPage.cropBoxPt.right - panel.selectedPage.cropBoxPt.left;
    const cropHeight = panel.selectedPage.cropBoxPt.top - panel.selectedPage.cropBoxPt.bottom;
    const cropAspect = panel.selectedPage.rotation === 90 || panel.selectedPage.rotation === 270
        ? cropHeight / cropWidth
        : cropWidth / cropHeight;
    const rasterAspect = panel.selectedPage.width / panel.selectedPage.height;
    if (Math.abs(Math.log(cropAspect / rasterAspect)) > 0.08) {
        throw new Error(`construction-plan-field-use-drawing-aspect-mismatch:${panel.binding.drawingId}:${panel.binding.pageIndex}`);
    }
    const scale = Math.min(availableWidth / panel.selectedPage.width, availableHeight / panel.selectedPage.height);
    const drawWidth = panel.selectedPage.width * scale; const drawHeight = panel.selectedPage.height * scale;
    const drawX = availableX + ((availableWidth - drawWidth) / 2); const drawY = availableY + ((availableHeight - drawHeight) / 2);
    panel.vectorDestinationPx = { x: drawX, y: drawY, width: drawWidth, height: drawHeight };
    context.fillStyle = '#ffffff'; context.fillRect(drawX, drawY, drawWidth, drawHeight);
    context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
    drawAnnotations(context, panel.annotations, drawX, drawY, drawWidth, drawHeight);
    let calloutY = availableY + availableHeight + 10;
    context.fillStyle = '#111827'; context.font = `400 ${MIN_ANNOTATION_CALLOUT_FONT_PX}px "${FIELD_USE_FONT_FAMILY}"`;
    calloutLines.forEach((lines) => {
        lines.forEach((line) => {
            context.fillText(line, x + 14, calloutY);
            calloutY += 18;
        });
        calloutY += 4;
    });
    context.fillStyle = '#475569'; context.font = `400 12.5px "${FIELD_USE_FONT_FAMILY}"`;
    sourceLines.forEach((line) => {
        context.fillText(line, x + 14, calloutY);
        calloutY += 16;
    });
};

const vectorAnnotation = (annotation: UnknownRecord): ConstructionPlanVectorAnnotation => {
    const style = annotation.style as UnknownRecord;
    const layer = String(annotation.layer);
    const palette = LAYER_STYLE[layer];
    if (!palette || !isUnknownRecord(annotation.geometry) || !isUnknownRecord(style)) {
        throw new Error(`construction-plan-field-use-vector-annotation-invalid:${String(annotation.id || '-')}`);
    }
    const hatch = style.hatch === 'diagonal' || style.hatch === 'cross' || style.hatch === 'none'
        ? style.hatch
        : undefined;
    return {
        id: String(annotation.id),
        label: typeof annotation.label === 'string' ? annotation.label : undefined,
        zoneCode: typeof annotation.zoneCode === 'string' ? annotation.zoneCode : undefined,
        sequence: typeof annotation.sequence === 'number' ? annotation.sequence : undefined,
        geometry: annotation.geometry,
        style: {
            strokeHex: resolveColorToken(
                style.strokeToken,
                palette.stroke,
                `construction-plan-field-use-vector-stroke-token-invalid:${String(annotation.id)}`,
            ),
            fillHex: resolveColorToken(
                style.fillToken,
                palette.fill,
                `construction-plan-field-use-vector-fill-token-invalid:${String(annotation.id)}`,
            ),
            strokeWidthPt: Number(style.strokeWidthPt),
            opacity: Number(style.opacity),
            dash: style.dash as ConstructionPlanVectorAnnotation['style']['dash'],
            hatch,
            fontSizePt: typeof style.fontSizePt === 'number' ? style.fontSizePt : undefined,
        },
    };
};

const vectorDrawingPanels = (models: readonly FieldUsePageModel[]): ConstructionPlanVectorDrawingPanel[] => (
    models.flatMap((model) => model.drawingPanels.flatMap((panel) => {
        if (!panel.drawing || !panel.selectedPage || !panel.binding
            || panel.drawing.source.mimeType !== 'application/pdf') return [];
        if (!panel.vectorDestinationPx) {
            throw new Error(`construction-plan-field-use-vector-destination-missing:${panel.binding.drawingId}`);
        }
        return [{
            physicalPageIndex: model.physicalPageNumber - 1,
            sourcePdfBytes: panel.drawing.sourceBytes,
            sourceSha256: panel.binding.sourceSha256,
            sourcePageIndex: panel.binding.pageIndex,
            sourceCropBoxPt: panel.binding.cropBoxPt,
            sourceRotation: panel.binding.rotation,
            destinationPx: panel.vectorDestinationPx,
            annotations: panel.annotations.map(vectorAnnotation),
        }];
    }))
);

const drawBlankFormBox = (
    context: SKRSContext2D,
    label: string,
    x: number,
    y: number,
    width: number,
    height: number,
    lines: readonly string[] = [],
): void => {
    context.fillStyle = '#ffffff'; context.fillRect(x, y, width, height);
    context.strokeStyle = '#94a3b8'; context.lineWidth = 1.5; context.strokeRect(x, y, width, height);
    context.fillStyle = '#164e63'; context.font = `700 ${MIN_BODY_FONT_PX}px "${FIELD_USE_FONT_FAMILY}"`;
    context.fillText(label, x + 14, y + 26);
    context.fillStyle = '#334155'; context.font = `400 ${MIN_BODY_FONT_PX}px "${FIELD_USE_FONT_FAMILY}"`;
    lines.forEach((line, index) => context.fillText(line, x + 14, y + 55 + (index * 24)));
};

const drawHoldPointDecisionForm = (context: SKRSContext2D, startY: number): number => {
    const width = PAGE_WIDTH_PX - (PAGE_MARGIN_PX * 2);
    const gap = 14;
    const half = (width - gap) / 2;
    const requiredHeight = 420;
    if (startY + requiredHeight > FOOTER_Y_PX - 40) throw new Error('construction-plan-field-use-overflow:page-28:decision-form');
    context.fillStyle = '#164e63'; context.font = `700 17px "${FIELD_USE_FONT_FAMILY}"`;
    context.fillText(HOLD_POINT_DECISION_LABELS[0], PAGE_MARGIN_PX, startY + 22);
    let y = startY + 38;
    drawBlankFormBox(context, HOLD_POINT_DECISION_LABELS[1], PAGE_MARGIN_PX, y, half, 74, ['성명: ____________________   소속: ____________________']);
    drawBlankFormBox(context, HOLD_POINT_DECISION_LABELS[2], PAGE_MARGIN_PX + half + gap, y, half, 74, ['성명: ____________________   소속: ____________________']);
    y += 88;
    drawBlankFormBox(context, HOLD_POINT_DECISION_LABELS[3], PAGE_MARGIN_PX, y, half, 68, ['일시: ____________________']);
    drawBlankFormBox(context, HOLD_POINT_DECISION_LABELS[4], PAGE_MARGIN_PX + half + gap, y, half, 68);
    y += 82;
    drawBlankFormBox(context, HOLD_POINT_DECISION_LABELS[5], PAGE_MARGIN_PX, y, width, 130, ['________________________________________________________________________________', '________________________________________________________________________________']);
    y += 144;
    drawBlankFormBox(context, HOLD_POINT_DECISION_LABELS[6], PAGE_MARGIN_PX, y, half, 64, ['서명: ____________________']);
    drawBlankFormBox(context, HOLD_POINT_DECISION_LABELS[7], PAGE_MARGIN_PX + half + gap, y, half, 64, ['서명: ____________________']);
    return y + 64;
};

const drawHandoverSignatureForm = (context: SKRSContext2D, startY: number): number => {
    const width = PAGE_WIDTH_PX - (PAGE_MARGIN_PX * 2);
    const gap = 14;
    const half = (width - gap) / 2;
    const requiredHeight = 530;
    if (startY + requiredHeight > FOOTER_Y_PX - 40) throw new Error('construction-plan-field-use-overflow:page-42:signature-form');
    context.fillStyle = '#164e63'; context.font = `700 17px "${FIELD_USE_FONT_FAMILY}"`;
    context.fillText(HANDOVER_SIGNATURE_LABELS[0], PAGE_MARGIN_PX, startY + 22);
    let y = startY + 38;
    drawBlankFormBox(context, HANDOVER_SIGNATURE_LABELS[1], PAGE_MARGIN_PX, y, width, 142, ['________________________________________________________________________________', '________________________________________________________________________________', '________________________________________________________________________________']);
    y += 156;
    for (let index = 0; index < 4; index += 1) {
        const column = index % 2;
        const row = Math.floor(index / 2);
        drawBlankFormBox(
            context,
            HANDOVER_SIGNATURE_LABELS[index + 2],
            PAGE_MARGIN_PX + (column * (half + gap)),
            y + (row * 158),
            half,
            144,
            BLANK_PERSON_LINES,
        );
    }
    return y + 302;
};

const drawSpecialExecutionForm = (
    context: SKRSContext2D,
    pageNumber: number,
    y: number,
    contract: ConstructionPlanServerTemplateContract,
): number => {
    const rows = pageNumber === 28
        ? holdPointRowsFor(contract)
        : pageNumber === 42 ? HANDOVER_ROWS : checklistRowsFor(contract)[pageNumber];
    if (!rows) return y;
    const tableRows = rows.map((value, index) => ({ label: `${index + 1}`, value: `${value}  □ 적합  □ 부적합  □ 해당없음  조치: ______  확인: ______` }));
    const tableBottom = drawRows(context, tableRows, y, FOOTER_Y_PX - 40, pageNumber);
    if (pageNumber === 28) return drawHoldPointDecisionForm(context, tableBottom + 18);
    if (pageNumber === 42) return drawHandoverSignatureForm(context, tableBottom + 18);
    return tableBottom;
};

const drawPhotoSheet = (context: SKRSContext2D, y: number): void => {
    const gap = 22; const width = (PAGE_WIDTH_PX - (PAGE_MARGIN_PX * 2) - gap) / 2; const height = 510;
    for (let index = 0; index < 4; index += 1) {
        const column = index % 2; const row = Math.floor(index / 2);
        const x = PAGE_MARGIN_PX + (column * (width + gap)); const boxY = y + (row * (height + gap));
        context.fillStyle = '#f8fafc'; context.fillRect(x, boxY, width, height);
        context.strokeStyle = '#94a3b8'; context.strokeRect(x, boxY, width, height);
        context.fillStyle = '#334155'; context.font = `700 18px "${FIELD_USE_FONT_FAMILY}"`;
        context.fillText(`사진 ${index + 1}`, x + 18, boxY + 35);
        context.font = `400 ${MIN_BODY_FONT_PX}px "${FIELD_USE_FONT_FAMILY}"`;
        drawWrapped(context, '현장 실행 시 사진 첨부 위치', x + 18, boxY + 72, width - 36, 21);
        context.fillText('촬영일: __________  위치: __________', x + 18, boxY + height - 52);
        context.fillText('내용: __________________________________', x + 18, boxY + height - 25);
    }
};

const drawFooter = (
    context: SKRSContext2D,
    model: FieldUsePageModel,
    profile: ConstructionPlanFieldUseProfile,
    snapshotHash: string,
    totalPhysicalPages: number,
): void => {
    context.strokeStyle = '#cbd5e1'; context.beginPath(); context.moveTo(PAGE_MARGIN_PX, FOOTER_Y_PX - 28); context.lineTo(PAGE_WIDTH_PX - PAGE_MARGIN_PX, FOOTER_Y_PX - 28); context.stroke();
    context.fillStyle = '#475569'; context.font = `400 12.5px "${FIELD_USE_FONT_FAMILY}"`;
    context.fillText(`${profile === 'issued' ? '발행본' : '발행 후보'} · 승인 스냅샷 ${snapshotHash.slice(0, 16)}… · 본문 ${model.payloadHash.slice(0, 16)}…`, PAGE_MARGIN_PX, FOOTER_Y_PX);
    context.textAlign = 'right'; context.font = `700 14px "${FIELD_USE_FONT_FAMILY}"`;
    context.fillText(`${model.physicalPageNumber} / ${totalPhysicalPages}`, PAGE_WIDTH_PX - PAGE_MARGIN_PX, FOOTER_Y_PX); context.textAlign = 'left';
};

const drawContinuationRowsPage = (
    context: SKRSContext2D,
    model: FieldUsePageModel,
    startY: number,
): void => {
    const heading = dedicatedDataPageHeading(model.contract.pageNumber)
        || '현장별 구조화 데이터 · 표준 시공기준';
    context.fillStyle = '#164e63';
    context.font = `700 16px "${FIELD_USE_FONT_FAMILY}"`;
    context.fillText(`${heading}${model.continuationIndex > 0 ? ` · 계속 ${model.continuationIndex}` : ''}`, PAGE_MARGIN_PX, startY + 8);
    const headerY = startY + 28;
    context.fillStyle = '#e2e8f0';
    context.fillRect(PAGE_MARGIN_PX, headerY, PAGE_WIDTH_PX - (PAGE_MARGIN_PX * 2), 42);
    context.strokeStyle = '#94a3b8';
    context.strokeRect(PAGE_MARGIN_PX, headerY, PAGE_WIDTH_PX - (PAGE_MARGIN_PX * 2), 42);
    context.fillStyle = '#164e63';
    context.font = `700 ${MIN_BODY_FONT_PX}px "${FIELD_USE_FONT_FAMILY}"`;
    context.fillText('항목', PAGE_MARGIN_PX + 12, headerY + 27);
    context.fillText('내용 · 기준 · 책임 · 확인', PAGE_MARGIN_PX + 310, headerY + 27);
    drawTwoColumnRows(
        context,
        model.rows,
        continuationRowStartY(model.contract.pageNumber),
        CONTINUATION_ROW_MAX_Y,
        model.contract.pageNumber,
    );
};

const drawPage = async (
    model: FieldUsePageModel,
    content: UnknownRecord,
    profile: ConstructionPlanFieldUseProfile,
    snapshotHash: string,
    approvalEvidenceHash: string,
    approvalEvidence: UnknownRecord,
    provenance: ConstructionPlanFieldUseProvenance,
    contract: ConstructionPlanServerTemplateContract,
    brandLogo: Awaited<ReturnType<typeof loadImage>>,
    logicalStartPhysicalPages: ReadonlyMap<number, number>,
): Promise<Buffer> => {
    ensureFieldUseFonts();
    const canvas = createCanvas(PAGE_WIDTH_PX, PAGE_HEIGHT_PX);
    const context = canvas.getContext('2d');
    if (model.contract.pageNumber === 1) {
        drawCoverPage(context, model, content, profile, snapshotHash, approvalEvidence, brandLogo, provenance.pageCount);
        return canvas.toBuffer('image/jpeg', JPEG_QUALITY);
    }
    drawHeader(context, model, content, profile);
    const pageNumber = model.contract.pageNumber;
    let y = drawExecutionNotice(context, pageNumber, 215);
    if (model.usesRowContinuationLayout) {
        drawContinuationRowsPage(context, model, y);
    } else if (pageNumber === 3 || pageNumber === 4) {
        const tocBottom = drawToc(context, pageNumber, contract, logicalStartPhysicalPages);
        drawTwoColumnRows(context, sectionRows(sectionByKey(content, 'toc')), tocBottom + 16, FOOTER_Y_PX - 45, pageNumber);
    } else if (pageNumber === 41) {
        y = drawTwoColumnRows(context, sectionRows(sectionByKey(content, 'photo-sheet')), y, y + 260, pageNumber);
        drawPhotoSheet(context, y + 8);
    } else if (model.drawingPanels.length > 0) {
        const engineeringRows = pageNumber === 21 && contract.tradeType === 'system-shoring'
            ? localizedEngineeringSummaryRows(content)
            : [];
        const topRows = [...sectionRows(sectionByKey(content, model.contract.sectionKey)), ...engineeringRows];
        y = pageNumber === 21
            ? drawTwoColumnRows(context, topRows, y, 720, pageNumber)
            : drawDenseRows(context, topRows, y, 480, pageNumber);
        const panelTop = pageNumber === 21 ? Math.max(740, y + 12) : Math.max(500, y + 18);
        const panelGap = 18;
        const panelHeight = (FOOTER_Y_PX - 60 - panelTop - ((model.drawingPanels.length - 1) * panelGap)) / model.drawingPanels.length;
        if (panelHeight < 300) throw new Error(`construction-plan-field-use-overflow:page-${pageNumber}:drawing-panels`);
        for (let index = 0; index < model.drawingPanels.length; index += 1) {
            await drawDrawingPanel(context, model.drawingPanels[index], PAGE_MARGIN_PX, panelTop + (index * (panelHeight + panelGap)), PAGE_WIDTH_PX - (PAGE_MARGIN_PX * 2), panelHeight);
        }
    } else if (!drawDedicatedDataPage(context, model, content, snapshotHash, approvalEvidenceHash, approvalEvidence, provenance, y)) {
        y = drawRows(
            context,
            visualRowsForPage(model, content, snapshotHash, approvalEvidenceHash, approvalEvidence, provenance),
            y,
            FOOTER_Y_PX - 45,
            pageNumber,
        );
        drawSpecialExecutionForm(context, pageNumber, y + 20, contract);
    }
    drawFooter(context, model, profile, snapshotHash, provenance.pageCount);
    return canvas.toBuffer('image/jpeg', JPEG_QUALITY);
};

const visibleSearchStrings = (
    model: FieldUsePageModel,
    content: UnknownRecord,
    profile: ConstructionPlanFieldUseProfile,
    snapshotHash: string,
    approvalEvidenceHash: string,
    approvalEvidence: UnknownRecord,
    provenance: ConstructionPlanFieldUseProvenance,
    contract: ConstructionPlanServerTemplateContract,
    logicalStartPhysicalPages: ReadonlyMap<number, number>,
): string[] => {
    const pageNumber = model.contract.pageNumber;
    const strings = [
        contract.tradeType === 'system-scaffold' ? '시스템비계 시공계획서' : '시스템동바리 시공계획서',
        `${primitiveText(content.documentNo)} · REV.${String(content.revision).padStart(2, '0')}`,
        `${String(pageNumber).padStart(2, '0')}. ${model.title}${model.continuationIndex > 0 ? ` (계속 ${model.continuationIndex})` : ''}`,
        profile === 'issued' ? '현장사용 발행본' : '발행 후보 · 현장사용 금지',
    ];
    const auditSection = sectionByKey(content, model.contract.sectionKey);
    strings.push(
        constructionPlanSectionPageLabel(model.contract.pageNumber),
        `작성상태 ${constructionPlanStatusDisplayName(auditSection.status)}`,
    );
    const dedicatedHeading = dedicatedDataPageHeading(pageNumber);
    if (dedicatedHeading) strings.push(dedicatedHeading);
    if (pageNumber === 1) {
        const project = content.projectSnapshot as UnknownRecord;
        strings.push(
            contract.tradeType === 'system-scaffold' ? 'SYSTEM SCAFFOLD' : 'SYSTEM SHORING',
            contract.tradeType === 'system-scaffold' ? '시스템비계 시공계획서' : '시스템동바리 시공계획서',
            '청연이엔지', '회사 로고 SHA-256', CONSTRUCTION_PLAN_BRAND_LOGO_SHA256,
            '계획서 ID', primitiveText(content.planId), '계획서명', primitiveText(content.title), '현장명', primitiveText(project.siteName),
            '현장 ID', primitiveText(content.siteId), '공종', constructionPlanTradeDisplayName(content.tradeType),
            '문서번호', primitiveText(content.documentNo), '개정·작성일', `REV.${String(content.revision).padStart(2, '0')} · ${primitiveText(content.documentDate)}`,
            '발주처·원도급사', `${primitiveText(project.clientName)} · ${primitiveText(project.contractorName)}`,
            ...approvalControlRows(content, approvalEvidence, true).flatMap((row) => [row.label, row.value]),
            '승인 스냅샷', snapshotHash,
            '본 문서는 승인 스냅샷과 원본 도면 무결성을 서버에서 검증하여 생성했습니다.',
        );
        strings.push(...sectionRows(sectionByKey(content, 'cover')).flatMap((row) => [row.label, row.value]));
    } else if (pageNumber === 3 || pageNumber === 4) {
        strings.push(...sectionRows(sectionByKey(content, 'toc')).flatMap((row) => [row.label, row.value]));
    } else if (pageNumber === 41) {
        strings.push(...sectionRows(sectionByKey(content, 'photo-sheet')).flatMap((row) => [row.label, row.value]));
    } else if (model.drawingPanels.length > 0) {
        strings.push(...sectionRows(sectionByKey(content, model.contract.sectionKey)).flatMap((row) => [row.label, row.value]));
    } else if (model.usesRowContinuationLayout) {
        strings.push(...model.rows.flatMap((row) => [row.label, row.value]));
    } else {
        strings.push(...visualRowsForPage(model, content, snapshotHash, approvalEvidenceHash, approvalEvidence, provenance).flatMap((row) => [row.label, row.value]));
    }
    if (pageNumber === 2) {
        strings.push(
            `AUDIT_SERIES_ID ${primitiveText(content.seriesId)}`,
            `AUDIT_LINEAGE_ROOT_PLAN_ID ${primitiveText(content.lineageRootPlanId)}`,
            `AUDIT_CLONED_FROM_PLAN_ID ${primitiveText(content.clonedFromPlanId)}`,
            `AUDIT_TEMPLATE_ID ${primitiveText(content.templateId)}`,
            `AUDIT_TEMPLATE_VERSION ${primitiveText(content.templateVersion)}`,
            `AUDIT_RENDERER_VERSION ${primitiveText(content.rendererVersion)}`,
            `AUDIT_FIELD_USE_RENDERER_VERSION ${provenance.rendererVersion}`,
            `AUDIT_DRAWING_RENDER_MODE ${provenance.drawingRenderMode}`,
            `AUDIT_CREATED_AT ${primitiveText(content.createdAt)}`,
            `AUDIT_REVIEW_COMPLETED_AT ${primitiveText(approvalEvidence.completedAt)}`,
            `AUDIT_APPROVED_AT ${primitiveText(approvalEvidence.approvedAt)}`,
            `AUDIT_APPROVED_SNAPSHOT_SHA256 ${snapshotHash}`,
            `AUDIT_APPROVAL_EVIDENCE_SHA256 ${approvalEvidenceHash}`,
            `AUDIT_APPROVED_CONTENT_SHA256 ${provenance.approvedContentHash}`,
            `AUDIT_PUBLISHED_TEMPLATE_SHA256 ${provenance.templateHash}`,
            `AUDIT_TEMPLATE_MANIFEST_SHA256 ${provenance.manifestHash}`,
            `AUDIT_SELECTED_TEMPLATE_BUNDLE_SHA256 ${provenance.templateBundleHash}`,
            `AUDIT_TEMPLATE_BINDING_SHA256 ${provenance.templateBindingHash}`,
            `AUDIT_RENDERER_TEMPLATE_BUNDLE_SHA256 ${provenance.rendererTemplateBundleHash}`,
            `AUDIT_RENDERER_BUILD_SHA256 ${provenance.rendererBuildHash}`,
            `AUDIT_RENDER_INPUT_SHA256 ${provenance.renderInputHash}`,
            `AUDIT_CONTENT_MANIFEST_SHA256 ${provenance.contentManifestHash}`,
            `AUDIT_ZERO_OMISSION_COVERAGE_SHA256 ${provenance.zeroOmissionCoverageHash}`,
            `AUDIT_DRAWING_BINDING_SHA256 ${provenance.drawingBindingHash}`,
            `AUDIT_BRAND_LOGO_SHA256 ${CONSTRUCTION_PLAN_BRAND_LOGO_SHA256}`,
        );
    }
    if (pageNumber === 3 || pageNumber === 4) {
        const entries = contract.pages.filter((page) => page.pageNumber >= 5);
        const toc = pageNumber === 3 ? entries.slice(0, 19) : entries.slice(19, 38);
        toc.forEach((page) => strings.push(
            String(page.pageNumber).padStart(2, '0'),
            page.title,
            `${logicalStartPhysicalPages.get(page.pageNumber) ?? page.pageNumber}쪽`,
        ));
    }
    if (EXECUTION_FORM_PAGES.has(pageNumber)) strings.push(EXECUTION_FORM_EMPTY_NOTICE, EXECUTION_FORM_EVIDENCE_NOTICE);
    model.drawingPanels.forEach((panel) => {
        strings.push(panel.slot);
        if (!panel.drawing || !panel.selectedPage || !panel.binding) {
            strings.push('해당없음', primitiveText(panel.decision.reason), `확인자 ${primitiveText(panel.decision.reviewedBy)}`);
        } else {
            strings.push(
                constructionPlanDrawingPanelTitle({
                    drawingNo: panel.binding.drawingNo,
                    pageIndex: panel.binding.pageIndex,
                    revision: panel.drawing.record.revision,
                }),
                constructionPlanDrawingSourceDisplay({
                    sourceSha256: panel.binding.sourceSha256,
                    sourceGeneration: panel.binding.sourceGeneration,
                    pageFingerprintHash: sha256Hex(panel.binding.pageFingerprint),
                }),
                `AUDIT_DRAWING_HEADER ${panel.binding.drawingNo} · page ${panel.binding.pageIndex + 1} · REV.${primitiveText(panel.drawing.record.revision)}`,
                `AUDIT_DRAWING_SOURCE ${panel.binding.sourceSha256} · gen ${panel.binding.sourceGeneration} · ${panel.binding.pageFingerprint}`,
            );
            panel.annotations.forEach((annotation) => {
                const label = [annotation.zoneCode, annotation.label]
                    .filter((value) => typeof value === 'string' && value).join(' · ');
                if (label) strings.push(label);
            });
            panel.annotations.forEach((annotation, index) => strings.push(
                annotationCalloutVisibleText(annotation, index),
                `AUDIT_ANNOTATION ${annotationCalloutAuditText(annotation, index)}`,
            ));
        }
    });
    if (pageNumber === 21 && contract.tradeType === 'system-shoring') {
        localizedEngineeringSummaryRows(content).forEach((row) => strings.push(row.label, row.value));
    }
    const formRows = pageNumber === 28
        ? holdPointRowsFor(contract)
        : pageNumber === 42 ? HANDOVER_ROWS : checklistRowsFor(contract)[pageNumber];
    formRows?.forEach((value, index) => strings.push(
        `${index + 1}`,
        `${value}  □ 적합  □ 부적합  □ 해당없음  조치: ______  확인: ______`,
    ));
    if (pageNumber === 28) strings.push(
        ...HOLD_POINT_DECISION_LABELS,
        '성명: ____________________   소속: ____________________',
        '일시: ____________________',
        '서명: ____________________',
        '________________________________________________________________________________',
    );
    if (pageNumber === 42) strings.push(
        ...HANDOVER_SIGNATURE_LABELS,
        ...BLANK_PERSON_LINES,
        '________________________________________________________________________________',
    );
    if (pageNumber === 41) {
        for (let index = 0; index < 4; index += 1) {
            strings.push(
                `사진 ${index + 1}`,
                '현장 실행 시 사진 첨부 위치',
                '촬영일: __________  위치: __________',
                '내용: __________________________________',
            );
        }
    }
    strings.push(
        `${profile.toUpperCase()} · SNAPSHOT ${snapshotHash.slice(0, 16)}… · PAYLOAD ${model.payloadHash.slice(0, 16)}…`,
        `${model.physicalPageNumber} / ${provenance.pageCount}`,
        `LOGICAL_PAGE ${pageNumber} / ${CONSTRUCTION_PLAN_PAGE_COUNT} · CONTINUATION_INDEX ${model.continuationIndex}`,
    );
    return strings;
};

interface FieldUseOutlineGroup {
    key: string;
    title: string;
    firstPage: number;
    lastPage: number;
}

const FIELD_USE_OUTLINE_GROUPS: readonly FieldUseOutlineGroup[] = [
    { key: 'cover', title: '표지', firstPage: 1, lastPage: 1 },
    { key: 'document-control', title: '문서관리', firstPage: 2, lastPage: 2 },
    { key: 'toc', title: '목차', firstPage: 3, lastPage: 4 },
    { key: 'chapter-1', title: '제1장 일반사항', firstPage: 5, lastPage: 5 },
    { key: 'chapter-2', title: '제2장 공사개요', firstPage: 6, lastPage: 6 },
    { key: 'chapter-3', title: '제3장 현장조직 및 업무분장', firstPage: 7, lastPage: 7 },
    { key: 'chapter-4', title: '제4장 자재계획', firstPage: 8, lastPage: 8 },
    { key: 'chapter-5', title: '제5장 장비계획', firstPage: 9, lastPage: 14 },
    { key: 'chapter-6', title: '제6장 공종 및 설치기준', firstPage: 15, lastPage: 21 },
    { key: 'chapter-7', title: '제7장 승인도면', firstPage: 22, lastPage: 27 },
    { key: 'chapter-8', title: '제8장 구조관리', firstPage: 28, lastPage: 29 },
    { key: 'chapter-9', title: '제9장 현장 작업계획', firstPage: 30, lastPage: 33 },
    { key: 'chapter-10', title: '제10장 품질·안전·환경관리', firstPage: 34, lastPage: 38 },
    { key: 'chapter-11', title: '제11장 검측·기록·인수인계', firstPage: 39, lastPage: 42 },
];

const outlineGroupForPage = (pageNumber: number): FieldUseOutlineGroup => {
    const group = FIELD_USE_OUTLINE_GROUPS.find((candidate) => (
        pageNumber >= candidate.firstPage && pageNumber <= candidate.lastPage
    ));
    if (!group) throw new Error(`construction-plan-field-use-outline-page-unmapped:${pageNumber}`);
    return group;
};

const writeSearchablePdf = async (
    jpegPages: Buffer[],
    models: FieldUsePageModel[],
    provenance: Omit<ConstructionPlanFieldUsePdfResult, 'bytes' | 'sha256' | 'sizeBytes' | 'fileName'>,
    content: UnknownRecord,
    approvalEvidence: UnknownRecord,
    contract: ConstructionPlanServerTemplateContract,
    logicalStartPhysicalPages: ReadonlyMap<number, number>,
): Promise<Buffer> => new Promise<Buffer>((resolve, reject) => {
    ensureFieldUseFonts();
    const fixedDate = new Date('2000-01-01T00:00:00.000Z');
    const document = new PDFDocument({
        autoFirstPage: false,
        compress: true,
        bufferPages: true,
        pdfVersion: '1.7',
        info: {
            Title: `${content.documentNo} Rev.${content.revision}`,
            Author: 'Construction Plan Field Use Server Renderer',
            Subject: provenance.profile === 'issued' ? '현장사용 발행본' : '발행 후보 현장사용 금지',
            Keywords: `construction plan,system shoring,${provenance.profile},${provenance.drawingRenderMode}`,
            CreationDate: fixedDate,
            ModDate: fixedDate,
            RendererVersion: provenance.rendererVersion,
            DrawingRenderMode: provenance.drawingRenderMode,
            RendererBuildHash: provenance.rendererBuildHash,
            RendererTemplateBundleHash: provenance.rendererTemplateBundleHash,
            RenderInputHash: provenance.renderInputHash,
            ContentManifestHash: provenance.contentManifestHash,
            ApprovedSnapshotHash: provenance.snapshotHash,
            ApprovalEvidenceHash: provenance.approvalEvidenceHash,
            ApprovedContentHash: provenance.approvedContentHash,
            PublishedTemplateHash: provenance.templateHash,
            TemplateManifestHash: provenance.manifestHash,
            SelectedTemplateBundleHash: provenance.templateBundleHash,
            TemplateBindingHash: provenance.templateBindingHash,
            ZeroOmissionCoverageHash: provenance.zeroOmissionCoverageHash,
            DrawingBindingHash: provenance.drawingBindingHash,
            BrandLogoSha256: CONSTRUCTION_PLAN_BRAND_LOGO_SHA256,
        } as PDFKit.DocumentInfo,
    });
    const chunks: Buffer[] = [];
    document.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    document.on('error', reject);
    document.on('end', () => resolve(Buffer.concat(chunks)));
    document.registerFont('ConstructionPlanFieldUseSearch', searchableFontBytes as Buffer);
    let activeOutlineKey = '';
    let activeOutline: PDFKit.PDFOutline | undefined;
    models.forEach((model, index) => {
        document.addPage({ size: [A4_WIDTH_PT, A4_HEIGHT_PT], margin: 0 });
        document.addNamedDestination(`construction-plan-physical-page-${String(model.physicalPageNumber).padStart(3, '0')}`);
        if (model.continuationIndex === 0) {
            document.addNamedDestination(`construction-plan-page-${String(model.contract.pageNumber).padStart(2, '0')}`);
        }
        const outlineGroup = outlineGroupForPage(model.contract.pageNumber);
        if (outlineGroup.key !== activeOutlineKey) {
            activeOutlineKey = outlineGroup.key;
            activeOutline = document.outline.addItem(outlineGroup.title, { expanded: false });
        }
        activeOutline?.addItem(
            `${String(model.contract.pageNumber).padStart(2, '0')}. ${model.title}${model.continuationIndex > 0 ? ` (계속 ${model.continuationIndex})` : ''}`,
        );
        document.image(jpegPages[index], 0, 0, { width: A4_WIDTH_PT, height: A4_HEIGHT_PT });
        const searchable = visibleSearchStrings(
            model,
            content,
            provenance.profile,
            provenance.snapshotHash,
            provenance.approvalEvidenceHash,
            approvalEvidence,
            provenance,
            contract,
            logicalStartPhysicalPages,
        ).filter(Boolean).join('\n');
        document.save(); document.fillOpacity(0); document.fillColor('#000000'); document.font('ConstructionPlanFieldUseSearch'); document.fontSize(4);
        document.text(searchable, 8, 100, { width: A4_WIDTH_PT - 16, height: A4_HEIGHT_PT - 120, lineGap: 0 });
        document.restore();
    });
    document.end();
});

const normalizedFileName = (documentNo: string, revision: number, profile: ConstructionPlanFieldUseProfile): string => {
    const base = `${documentNo}_REV-${String(revision).padStart(2, '0')}_${profile === 'issued' ? 'ISSUED' : 'CANDIDATE'}`
        .normalize('NFKC').replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, '-').replace(/\s+/g, '_')
        .replace(/-+/g, '-').replace(/_+/g, '_').replace(/^[.\s_-]+|[.\s_-]+$/g, '').slice(0, 120)
        || `construction-plan-${profile}`;
    return `${base}.pdf`;
};

const buildPageModels = (
    content: UnknownRecord,
    approvalEvidence: UnknownRecord,
    coverage: Map<number, CoverageEntry[]>,
    drawingPanels: Map<number, DrawingPanelModel[]>,
    template: ConstructionPlanServerTemplateContract,
): FieldUsePageModel[] => template.pages.map((contract) => {
    const standardCopy = pageStandardCopyFor(template);
    const checklists = checklistRowsFor(template);
    const pageCoverage = coverage.get(contract.pageNumber) || [];
    const panels = drawingPanels.get(contract.pageNumber) || [];
    const coverageRows = pageCoverage.flatMap(humanRowsForCoverage);
    const section = sectionByKey(content, contract.sectionKey);
    const perSectionRows = sectionRows(section);
    const standardTextEntry = resolveConstructionPlanServerStandardText(template, contract.sectionKey);
    const serverStandardRows = constructionPlanServerStandardTextRowsForRender(template, section);
    const fallbackStandardRows = standardTextEntry ? [] : (standardCopy[contract.pageNumber] || []);
    const rows = contract.pageNumber === 7
        ? [...constructionPlanOrganizationRowsForFieldUsePdf(content), ...perSectionRows]
        : contract.pageNumber === 9
            ? [...localizedEquipmentRows(content), ...perSectionRows]
            : contract.pageNumber === 11
                ? [...localizedEquipmentRows(content, true), ...perSectionRows]
                : contract.pageNumber === 17 || contract.pageNumber === 29
                    ? [...localizedEngineeringRows(content), ...perSectionRows, ...serverStandardRows, ...fallbackStandardRows]
                    : contract.pageNumber === 36
                        ? [...localizedRiskRows(content), ...perSectionRows]
                        : isConstructionPlanStructuredSectionKey(contract.sectionKey)
                            ? [...perSectionRows, ...serverStandardRows, ...fallbackStandardRows]
                            : coverageRows;
    const templateContractHash = sha256Hex(canonicalStringify({
        ...contract,
        tradeType: template.tradeType,
        templateId: template.templateId,
        templateVersion: template.templateVersion,
        rendererVersion: CONSTRUCTION_PLAN_FIELD_USE_RENDERER_VERSION,
        brandLogoSha256: CONSTRUCTION_PLAN_BRAND_LOGO_SHA256,
    }));
    const payloadHash = sha256Hex(canonicalStringify({
        pageNumber: contract.pageNumber,
        sectionKey: contract.sectionKey,
        coverage: pageCoverage.map((entry) => ({ path: entry.path, valueHash: entry.valueHash })),
        rows,
        drawingBindings: panels.map((panel) => panel.binding || { slot: panel.slot, decision: 'not_applicable', reason: panel.decision.reason, reviewedBy: panel.decision.reviewedBy }),
        ...(contract.pageNumber === 1 ? { cover: { title: content.title, siteId: content.siteId, tradeType: content.tradeType, projectSnapshot: content.projectSnapshot } } : {}),
        ...(contract.pageNumber === 2 ? { documentControl: {
            documentNo: content.documentNo, documentDate: content.documentDate, revision: content.revision,
            revisionType: content.revisionType, revisionReason: content.revisionReason, seriesId: content.seriesId,
            lineageRootPlanId: content.lineageRootPlanId, sourceSnapshotHash: content.sourceSnapshotHash,
            sourceRevisionNo: content.sourceRevisionNo, clonedFromPlanId: content.clonedFromPlanId,
            supersedesPlanId: content.supersedesPlanId, templateId: content.templateId,
            templateVersion: content.templateVersion, rendererVersion: content.rendererVersion,
            schemaVersion: content.schemaVersion, snapshotSchemaVersion: content.snapshotSchemaVersion,
            createdBy: content.createdBy, createdByName: content.createdByName, createdAt: content.createdAt,
        } } : {}),
        ...(contract.pageNumber === 1 || contract.pageNumber === 2
            ? { approvalControl: approvalControlRows(content, approvalEvidence) }
            : {}),
        ...(contract.pageNumber === 6 ? { projectOverview: content.projectSnapshot, erpSnapshot: content.erpSnapshot } : {}),
        ...(contract.pageNumber === 7 ? { organization: content.organizationSnapshot } : {}),
        ...(contract.pageNumber === 9 ? { equipment: content.equipmentPlan } : {}),
        ...(contract.pageNumber === 11 ? { liftingEquipment: (content.equipmentPlan as unknown[]).filter((value) => isUnknownRecord(value) && value.category === 'lifting') } : {}),
        ...(contract.pageNumber === 17 || contract.pageNumber === 29 ? { engineeringValues: content.engineeringValues } : {}),
        ...(contract.pageNumber === 22 ? { drawingRegister: { drawings: content.drawings, drawingApplicability: content.drawingApplicability } } : {}),
        ...(contract.pageNumber === 36 ? { riskAssessments: content.riskAssessments } : {}),
        ...(contract.pageNumber === 21 && template.tradeType === 'system-shoring' ? { engineeringValues: content.engineeringValues } : {}),
        ...(contract.pageNumber === 3 || contract.pageNumber === 4 ? { tocRange: contract.pageNumber === 3 ? [5, 23] : [24, 42] } : {}),
        ...(checklists[contract.pageNumber] ? { checklistRows: checklists[contract.pageNumber] } : {}),
        ...(contract.pageNumber === 28 ? { holdPointRows: holdPointRowsFor(template) } : {}),
        ...(contract.pageNumber === 42 ? { handoverRows: HANDOVER_ROWS } : {}),
        ...(standardCopy[contract.pageNumber] ? { standardCopy: standardCopy[contract.pageNumber] } : {}),
        brandLogoSha256: CONSTRUCTION_PLAN_BRAND_LOGO_SHA256,
    }));
    return {
        contract,
        title: contract.title,
        coverage: pageCoverage,
        rows,
        drawingPanels: panels,
        templateContractHash,
        payloadHash,
        physicalPageNumber: contract.pageNumber,
        continuationIndex: 0,
        coveragePaths: [],
        usesRowContinuationLayout: false,
    };
});

const CONTINUATION_DATA_LOGICAL_PAGES = new Set([7, 9, 11, 17, 29, 36]);
const CONTINUATION_ROW_START_Y = 292;
const CONTINUATION_EXECUTION_ROW_START_Y = 384;
const CONTINUATION_ROW_MAX_Y = FOOTER_Y_PX - 45;

const continuationRowStartY = (logicalPageNumber: number): number => (
    EXECUTION_FORM_PAGES.has(logicalPageNumber)
        ? CONTINUATION_EXECUTION_ROW_START_Y
        : CONTINUATION_ROW_START_Y
);

const isContinuationDataModel = (model: FieldUsePageModel): boolean => (
    CONTINUATION_DATA_LOGICAL_PAGES.has(model.contract.pageNumber)
    || isConstructionPlanStructuredSectionKey(model.contract.sectionKey)
);

const measureTwoColumnRowHeight = (
    context: SKRSContext2D,
    row: HumanRow,
    columnWidth: number,
): number => {
    context.font = `400 ${MIN_BODY_FONT_PX}px "${FIELD_USE_FONT_FAMILY}"`;
    const valueLines = wrapText(context, row.value, columnWidth - 145);
    context.font = `700 ${MIN_BODY_FONT_PX}px "${FIELD_USE_FONT_FAMILY}"`;
    const labelLines = wrapText(context, row.label, 108);
    return Math.max(38, (Math.max(valueLines.length, labelLines.length) * 20) + 14);
};

const twoColumnRowsFit = (
    context: SKRSContext2D,
    rows: readonly HumanRow[],
    startY: number,
): boolean => {
    if (rows.length === 0) return true;
    const gap = 14;
    const columnWidth = (PAGE_WIDTH_PX - (PAGE_MARGIN_PX * 2) - gap) / 2;
    const capacity = CONTINUATION_ROW_MAX_Y - startY;
    const rowsPerColumn = Math.ceil(rows.length / 2);
    return [0, 1].every((column) => rows
        .slice(column * rowsPerColumn, (column + 1) * rowsPerColumn)
        .reduce((height, row) => height + measureTwoColumnRowHeight(context, row, columnWidth), 0) <= capacity);
};

const splitIndivisibleRows = (
    rows: readonly HumanRow[],
    logicalPageNumber: number,
): HumanRow[][] => {
    if (rows.length === 0) return [[]];
    ensureFieldUseFonts();
    const context = createCanvas(32, 32).getContext('2d');
    const chunks: HumanRow[][] = [];
    const startY = continuationRowStartY(logicalPageNumber);
    let start = 0;
    while (start < rows.length) {
        let end = start + 1;
        if (!twoColumnRowsFit(context, rows.slice(start, end), startY)) {
            throw new Error(
                `construction-plan-field-use-continuation-row-too-tall:logical-page-${logicalPageNumber}`
                + `:${rows[start].sourcePath || `rows[${start}]`}`,
            );
        }
        while (end < rows.length && twoColumnRowsFit(context, rows.slice(start, end + 1), startY)) end += 1;
        chunks.push(rows.slice(start, end));
        start = end;
    }
    if (chunks.some((chunk) => chunk.length === 0) || chunks.flat().length !== rows.length) {
        throw new Error('construction-plan-field-use-continuation-empty-or-row-loss');
    }
    return chunks;
};

/**
 * Section/control rows are fixed context, while rows with a sourcePath are
 * independently coverable data units. Keep fixed context on the logical
 * page's first physical sheet and guarantee that every later continuation
 * contains at least one real data unit. This prevents a trailing
 * "(계속 n)" sheet made only from status/summary metadata.
 */
const splitRowsForPhysicalPages = (
    rows: readonly HumanRow[],
    logicalPageNumber: number,
): HumanRow[][] => {
    const dataRows = rows.filter((row) => Boolean(row.sourcePath));
    const fixedRows = rows.filter((row) => !row.sourcePath);
    if (dataRows.length === 0 || fixedRows.length === 0) {
        return splitIndivisibleRows(rows, logicalPageNumber);
    }
    ensureFieldUseFonts();
    const context = createCanvas(32, 32).getContext('2d');
    const startY = continuationRowStartY(logicalPageNumber);
    if (!twoColumnRowsFit(context, fixedRows, startY)) {
        throw new Error(`construction-plan-field-use-fixed-context-too-tall:logical-page-${logicalPageNumber}`);
    }
    let firstDataCount = 0;
    while (firstDataCount < dataRows.length
        && twoColumnRowsFit(
            context,
            [...dataRows.slice(0, firstDataCount + 1), ...fixedRows],
            startY,
        )) {
        firstDataCount += 1;
    }
    const first = firstDataCount > 0
        ? [...dataRows.slice(0, firstDataCount), ...fixedRows]
        : [...fixedRows];
    const remaining = dataRows.slice(firstDataCount);
    const chunks = remaining.length > 0
        ? [first, ...splitIndivisibleRows(remaining, logicalPageNumber)]
        : [first];
    if (chunks.slice(1).some((chunk) => !chunk.some((row) => Boolean(row.sourcePath)))) {
        throw new Error('construction-plan-field-use-continuation-without-data');
    }
    return chunks;
};

const distributeCoveragePaths = (paths: readonly string[], count: number): string[][] => {
    if (!Number.isInteger(count) || count < 1) throw new Error('construction-plan-field-use-continuation-count-invalid');
    const result = Array.from({ length: count }, () => [] as string[]);
    paths.forEach((path, index) => {
        result[Math.min(count - 1, Math.floor((index * count) / Math.max(1, paths.length)))].push(path);
    });
    return result;
};

const buildPhysicalPageModels = (
    logicalModels: readonly FieldUsePageModel[],
    logicalCoverageLedger: readonly ConstructionPlanFieldUseLeafLedgerEntry[],
): { models: FieldUsePageModel[]; coverageLedger: ConstructionPlanFieldUseLeafLedgerEntry[] } => {
    const pathToPhysicalPage = new Map<string, number>();
    const physicalModels: FieldUsePageModel[] = [];
    logicalModels.forEach((logicalModel) => {
        const chunks = isContinuationDataModel(logicalModel)
            ? splitRowsForPhysicalPages(logicalModel.rows, logicalModel.contract.pageNumber)
            : [logicalModel.rows];
        const logicalPaths = logicalCoverageLedger
            .filter((entry) => entry.pageNumber === logicalModel.contract.pageNumber)
            .map((entry) => entry.path);
        const chunkPaths = distributeCoveragePaths(logicalPaths, chunks.length);
        chunks.forEach((rows, continuationIndex) => {
            const physicalPageNumber = physicalModels.length + 1;
            const coveragePaths = chunkPaths[continuationIndex];
            coveragePaths.forEach((path) => {
                if (pathToPhysicalPage.has(path)) throw new Error(`construction-plan-field-use-physical-coverage-duplicate:${path}`);
                pathToPhysicalPage.set(path, physicalPageNumber);
            });
            const drawingPanels = continuationIndex === 0 ? logicalModel.drawingPanels : [];
            const payloadHash = sha256Hex(canonicalStringify({
                physicalPageNumber,
                logicalPageNumber: logicalModel.contract.pageNumber,
                continuationIndex,
                sectionKey: logicalModel.contract.sectionKey,
                rows,
                coveragePaths,
                drawingBindings: drawingPanels.map((panel) => panel.binding || {
                    slot: panel.slot,
                    decision: 'not_applicable',
                    reason: panel.decision.reason,
                    reviewedBy: panel.decision.reviewedBy,
                }),
                templateContractHash: logicalModel.templateContractHash,
            }));
            physicalModels.push({
                ...logicalModel,
                rows: [...rows],
                coverage: continuationIndex === 0 ? logicalModel.coverage : [],
                drawingPanels,
                payloadHash,
                physicalPageNumber,
                continuationIndex,
                coveragePaths,
                usesRowContinuationLayout: chunks.length > 1
                    || (isConstructionPlanStructuredSectionKey(logicalModel.contract.sectionKey)
                        && logicalModel.rows.length > 8),
            });
        });
    });
    if (physicalModels.length < CONSTRUCTION_PLAN_FIELD_USE_MIN_PHYSICAL_PAGES
        || physicalModels.length > CONSTRUCTION_PLAN_FIELD_USE_MAX_PHYSICAL_PAGES) {
        throw new Error(`construction-plan-field-use-physical-page-count-invalid:${physicalModels.length}`);
    }
    const coverageLedger = logicalCoverageLedger.map((entry) => {
        const pageNumber = pathToPhysicalPage.get(entry.path);
        if (!pageNumber) throw new Error(`construction-plan-field-use-physical-coverage-missing:${entry.path}`);
        return { ...entry, pageNumber };
    });
    const expectedPaths = [...logicalCoverageLedger].map((entry) => entry.path).sort();
    const actualPaths = physicalModels.flatMap((model) => model.coveragePaths).sort();
    if (canonicalStringify(expectedPaths) !== canonicalStringify(actualPaths)) {
        throw new Error('construction-plan-field-use-physical-coverage-partition-invalid');
    }
    return { models: physicalModels, coverageLedger };
};

/**
 * Creates a 42-page logical document with bounded row-level physical
 * continuations from immutable approved content and source drawing bytes.
 */
export const renderConstructionPlanFieldUsePdf = async (
    input: RenderConstructionPlanFieldUsePdfInput,
): Promise<ConstructionPlanFieldUsePdfResult> => {
    const profile = assertProfile(input.profile);
    const approvalEvidenceHash = assertSha256(input.approvalEvidenceHash, 'construction-plan-field-use-approval-evidence-hash-invalid');
    const { verifiedSnapshot } = input;
    if (!verifiedSnapshot || !isUnknownRecord(verifiedSnapshot.content) || typeof input.loadDrawingSource !== 'function') {
        throw new Error('construction-plan-field-use-input-invalid');
    }
    const snapshotHash = assertSha256(verifiedSnapshot.snapshotHash, 'construction-plan-field-use-snapshot-hash-invalid');
    const content = verifiedSnapshot.content;
    const template = assertFieldUseContentReady(verifiedSnapshot);
    const rendererTemplateBundleHash = getConstructionPlanFieldUseTemplateBundleHash();
    const templateBinding = assertFieldUseTemplateBinding(content, template, rendererTemplateBundleHash);
    const approvalEvidence = assertApprovalEvidenceContent(
        input.approvalEvidence,
        approvalEvidenceHash,
        content,
        snapshotHash,
    );
    if (approvalEvidence.templateHash !== templateBinding.templateHash
        || approvalEvidence.manifestHash !== templateBinding.manifestHash
        || approvalEvidence.templateBundleHash !== templateBinding.templateBundleHash
        || approvalEvidence.templateBindingHash !== templateBinding.templateBindingHash) {
        throw new Error('construction-plan-field-use-approval-template-binding-mismatch');
    }
    assertKnownSectionContent(content, template);
    assertCanonicalRecordShapes(content);
    const coverage = buildConstructionPlanFieldUseCoverage(content, template);
    const drawingPanels = await buildDrawingPanels(content, input.loadDrawingSource, template);
    const logicalModels = buildPageModels(content, approvalEvidence, coverage, drawingPanels, template);
    if (logicalModels.length !== CONSTRUCTION_PLAN_PAGE_COUNT || logicalModels.some((model, index) => model.contract.pageNumber !== index + 1)) {
        throw new Error('construction-plan-field-use-template-manifest-invalid');
    }
    const logicalCoverageLedger = buildConstructionPlanFieldUseLeafLedger(coverage);
    const { models, coverageLedger } = buildPhysicalPageModels(logicalModels, logicalCoverageLedger);
    const logicalStartPhysicalPages = new Map<number, number>();
    models.forEach((model) => {
        if (model.continuationIndex === 0) logicalStartPhysicalPages.set(model.contract.pageNumber, model.physicalPageNumber);
    });
    if (logicalStartPhysicalPages.size !== CONSTRUCTION_PLAN_PAGE_COUNT) {
        throw new Error('construction-plan-field-use-logical-page-starts-invalid');
    }
    const pageManifest: ConstructionPlanFieldUsePageManifest[] = models.map((model) => {
        const bindings = model.drawingPanels.flatMap((panel) => panel.binding ? [panel.binding] : []);
        const pageLedger = coverageLedger.filter((entry) => entry.pageNumber === model.physicalPageNumber);
        return {
            pageNumber: model.physicalPageNumber,
            physicalPageNumber: model.physicalPageNumber,
            logicalPageNumber: model.contract.pageNumber,
            continuationIndex: model.continuationIndex,
            sectionKey: model.contract.sectionKey,
            title: model.title,
            required: model.contract.required,
            templateContractHash: model.templateContractHash,
            payloadHash: model.payloadHash,
            coveragePaths: [...model.coveragePaths],
            coverageLedger: pageLedger,
            drawingBindings: bindings,
            drawingBindingHash: sha256Hex(canonicalStringify(model.drawingPanels.map((panel) => panel.binding || {
                slot: panel.slot, decision: 'not_applicable', reason: panel.decision.reason, reviewedBy: panel.decision.reviewedBy,
            }))),
        };
    });
    const rendererBuildHash = getConstructionPlanFieldUseRendererBuildHash();
    const approvedContentHash = sha256Hex(canonicalStringify(content));
    const zeroOmissionCoverageHash = sha256Hex(canonicalStringify(coverageLedger));
    const drawingBindingHash = sha256Hex(canonicalStringify(pageManifest.map((page) => ({
        physicalPageNumber: page.physicalPageNumber,
        logicalPageNumber: page.logicalPageNumber,
        continuationIndex: page.continuationIndex,
        drawingBindingHash: page.drawingBindingHash,
    }))));
    const contentManifestHash = sha256Hex(canonicalStringify({
        schemaVersion: 2,
        rendererVersion: CONSTRUCTION_PLAN_FIELD_USE_RENDERER_VERSION,
        tradeType: template.tradeType,
        templateId: template.templateId,
        templateVersion: template.templateVersion,
        brandLogoSha256: CONSTRUCTION_PLAN_BRAND_LOGO_SHA256,
        snapshotHash,
        approvedContentHash,
        rendererTemplateBundleHash,
        rendererBuildHash,
        templateHash: templateBinding.templateHash,
        manifestHash: templateBinding.manifestHash,
        templateBundleHash: templateBinding.templateBundleHash,
        templateBindingHash: templateBinding.templateBindingHash,
        zeroOmissionCoverageHash,
        drawingBindingHash,
        coverageLedger,
        pageManifest,
    }));
    const renderInputHash = sha256Hex(canonicalStringify({
        snapshotHash,
        approvalEvidenceHash,
        approvalEvidence,
        rendererTemplateBundleHash,
        rendererBuildHash,
        templateHash: templateBinding.templateHash,
        manifestHash: templateBinding.manifestHash,
        templateBundleHash: templateBinding.templateBundleHash,
        templateBindingHash: templateBinding.templateBindingHash,
        drawingBindingHash,
        brandLogoSha256: CONSTRUCTION_PLAN_BRAND_LOGO_SHA256,
        profile,
    }));
    const provenance: Omit<ConstructionPlanFieldUsePdfResult, 'bytes' | 'sha256' | 'sizeBytes' | 'fileName'> = {
        profile,
        releaseEligible: profile === 'issued',
        rendererVersion: CONSTRUCTION_PLAN_FIELD_USE_RENDERER_VERSION,
        drawingRenderMode: CONSTRUCTION_PLAN_FIELD_USE_DRAWING_RENDER_MODE,
        pageCount: models.length,
        snapshotHash,
        approvalEvidenceHash,
        approvedContentHash,
        templateHash: templateBinding.templateHash,
        manifestHash: templateBinding.manifestHash,
        templateBundleHash: templateBinding.templateBundleHash,
        templateBindingHash: templateBinding.templateBindingHash,
        rendererTemplateBundleHash,
        rendererBuildHash,
        renderInputHash,
        contentManifestHash,
        zeroOmissionCoverageHash,
        drawingBindingHash,
        coverageLedger,
        pageManifest,
    };
    const brandLogo = await loadImage(getConstructionPlanBrandLogoPng());
    const jpegPages: Buffer[] = [];
    for (const model of models) jpegPages.push(await drawPage(
        model,
        content,
        profile,
        snapshotHash,
        approvalEvidenceHash,
        approvalEvidence,
        provenance,
        template,
        brandLogo,
        logicalStartPhysicalPages,
    ));
    const searchablePdfBytes = await writeSearchablePdf(
        jpegPages,
        models,
        provenance,
        content,
        approvalEvidence,
        template,
        logicalStartPhysicalPages,
    );
    const pdfDrawingPanels = vectorDrawingPanels(models);
    const bytes = pdfDrawingPanels.length > 0
        ? await compositeConstructionPlanVectorDrawings({
            basePdfBytes: searchablePdfBytes,
            pageWidthPx: PAGE_WIDTH_PX,
            pageHeightPx: PAGE_HEIGHT_PX,
            annotationFontBytes: searchableFontBytes as Buffer,
            panels: pdfDrawingPanels,
        })
        : searchablePdfBytes;
    if (bytes.length < 1 || bytes.length > MAX_OUTPUT_PDF_BYTES) {
        throw new Error(`construction-plan-field-use-output-size-invalid:${bytes.length}`);
    }
    const documentNo = readTrimmedString(content, ['documentNo']);
    const revision = Number(content.revision);
    if (!documentNo || !Number.isInteger(revision) || revision < 0) throw new Error('construction-plan-field-use-file-identity-invalid');
    return {
        ...provenance,
        bytes,
        sha256: sha256Hex(bytes),
        sizeBytes: bytes.length,
        fileName: normalizedFileName(documentNo, revision, profile),
    };
};

export const assertConstructionPlanFieldUseReleaseEligible = (
    result: ConstructionPlanFieldUsePdfResult,
): void => {
    if (result.profile !== 'issued' || result.releaseEligible !== true
        || result.pageCount < CONSTRUCTION_PLAN_FIELD_USE_MIN_PHYSICAL_PAGES
        || result.pageCount > CONSTRUCTION_PLAN_FIELD_USE_MAX_PHYSICAL_PAGES
        || result.pageManifest.length !== result.pageCount
        || result.drawingRenderMode !== CONSTRUCTION_PLAN_FIELD_USE_DRAWING_RENDER_MODE
        || sha256Hex(result.bytes) !== result.sha256) {
        throw new Error('construction-plan-field-use-artifact-not-release-eligible');
    }
    const seenLogicalPages = new Set<number>();
    const seenCoveragePaths = new Set<string>();
    let previousLogicalPage = 0;
    let previousContinuationIndex = -1;
    result.pageManifest.forEach((page, index) => {
        if (page.pageNumber !== index + 1 || page.physicalPageNumber !== index + 1
            || page.logicalPageNumber < 1 || page.logicalPageNumber > CONSTRUCTION_PLAN_PAGE_COUNT
            || page.logicalPageNumber < previousLogicalPage
            || (page.logicalPageNumber === previousLogicalPage && page.continuationIndex !== previousContinuationIndex + 1)
            || (page.logicalPageNumber !== previousLogicalPage && page.continuationIndex !== 0)
            || page.coveragePaths.some((path) => seenCoveragePaths.has(path))) {
            throw new Error('construction-plan-field-use-physical-manifest-invalid');
        }
        page.coveragePaths.forEach((path) => seenCoveragePaths.add(path));
        seenLogicalPages.add(page.logicalPageNumber);
        previousLogicalPage = page.logicalPageNumber;
        previousContinuationIndex = page.continuationIndex;
    });
    if (seenLogicalPages.size !== CONSTRUCTION_PLAN_PAGE_COUNT
        || seenCoveragePaths.size !== result.coverageLedger.length
        || result.coverageLedger.some((entry) => !seenCoveragePaths.has(entry.path))) {
        throw new Error('construction-plan-field-use-physical-manifest-coverage-invalid');
    }
    [
        result.snapshotHash, result.approvalEvidenceHash, result.approvedContentHash,
        result.templateHash, result.manifestHash, result.templateBundleHash, result.templateBindingHash,
        result.rendererTemplateBundleHash, result.rendererBuildHash, result.renderInputHash,
        result.contentManifestHash, result.zeroOmissionCoverageHash, result.drawingBindingHash,
    ].forEach((hash) => assertSha256(hash, 'construction-plan-field-use-provenance-invalid'));
};

/** Validates the renderer-specific audit layer on every physical page. */
export const validateConstructionPlanFieldUseAuditPages = (
    pageTexts: readonly string[],
    result: Pick<ConstructionPlanFieldUsePdfResult,
        'profile' | 'snapshotHash' | 'approvalEvidenceHash' | 'approvedContentHash' | 'rendererVersion'
        | 'templateHash' | 'manifestHash' | 'templateBundleHash' | 'templateBindingHash'
        | 'drawingRenderMode' | 'rendererTemplateBundleHash' | 'rendererBuildHash' | 'renderInputHash'
        | 'contentManifestHash' | 'zeroOmissionCoverageHash' | 'drawingBindingHash' | 'pageCount'>
        & { pageManifest?: readonly Pick<ConstructionPlanFieldUsePageManifest,
            'pageNumber' | 'physicalPageNumber' | 'logicalPageNumber' | 'continuationIndex' | 'payloadHash'>[] },
): { valid: boolean; issues: string[] } => {
    const issues: string[] = [];
    if (result.pageCount < CONSTRUCTION_PLAN_FIELD_USE_MIN_PHYSICAL_PAGES
        || result.pageCount > CONSTRUCTION_PLAN_FIELD_USE_MAX_PHYSICAL_PAGES
        || pageTexts.length !== result.pageCount) {
        return { valid: false, issues: ['field-use-page-count-mismatch'] };
    }
    pageTexts.forEach((raw, index) => {
        const text = raw.replace(/\s+/g, ' ');
        const page = result.pageManifest?.[index];
        const expectedPrefix = `${result.profile.toUpperCase()} · SNAPSHOT ${result.snapshotHash.slice(0, 16)}… · PAYLOAD `;
        const footerValid = page
            ? page.pageNumber === index + 1 && page.physicalPageNumber === index + 1
                && text.includes(`${expectedPrefix}${page.payloadHash.slice(0, 16)}…`)
            : new RegExp(`${expectedPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[a-f0-9]{16}…`).test(text);
        if (!footerValid) issues.push(`page-footer-marker-missing:page-${index + 1}`);
        if (!text.includes(`${index + 1} / ${result.pageCount}`)) issues.push(`page-number-marker-missing:page-${index + 1}`);
        if (page && !text.includes(`LOGICAL_PAGE ${page.logicalPageNumber} / ${CONSTRUCTION_PLAN_PAGE_COUNT} · CONTINUATION_INDEX ${page.continuationIndex}`)) {
            issues.push(`logical-page-marker-missing:page-${index + 1}`);
        }
    });
    const fullAuditText = String(pageTexts[1] || '').replace(/\s+/g, ' ');
    const fullAuditValues: Array<[string, string]> = [
        ['snapshot-hash', result.snapshotHash], ['approval-evidence-hash', result.approvalEvidenceHash],
        ['approved-content-hash', result.approvedContentHash], ['renderer-version', result.rendererVersion],
        ['published-template-hash', result.templateHash], ['template-manifest-hash', result.manifestHash],
        ['selected-template-bundle-hash', result.templateBundleHash], ['template-binding-hash', result.templateBindingHash],
        ['drawing-render-mode', result.drawingRenderMode], ['template-bundle-hash', result.rendererTemplateBundleHash],
        ['renderer-build-hash', result.rendererBuildHash], ['render-input-hash', result.renderInputHash],
        ['content-manifest-hash', result.contentManifestHash], ['zero-omission-coverage-hash', result.zeroOmissionCoverageHash],
        ['drawing-binding-hash', result.drawingBindingHash],
    ];
    fullAuditValues.forEach(([label, value]) => {
        if (!fullAuditText.includes(value)) issues.push(`${label}-missing:page-2`);
    });
    return { valid: issues.length === 0, issues };
};
