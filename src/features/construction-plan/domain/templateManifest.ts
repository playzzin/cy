import type { ConstructionPlanTemplateManifest, PlanSection, TemplatePage } from '../types';
import { ConstructionPlanTemplateManifestSchema } from '../types';

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value as Record<string, unknown>).forEach((entry) => deepFreeze(entry));
    Object.freeze(value);
  }
  return value;
};

const STANDARD_RISK_THRESHOLDS = [
  { minScore: 1, maxScore: 4, level: 'low', label: '낮음', action: '현행 통제를 유지하고 작업한다.' },
  { minScore: 5, maxScore: 9, level: 'medium', label: '보통', action: '계획된 저감대책을 이행한 뒤 작업한다.' },
  { minScore: 10, maxScore: 16, level: 'high', label: '높음', action: '책임자 검토와 추가 저감 후 작업한다.' },
  { minScore: 17, maxScore: 25, level: 'critical', label: '매우 높음', action: '작업을 금지하고 공법을 재검토한다.' },
] as const;

const STANDARD_RISK_REVIEW_TRIGGERS = [
  '공법 또는 설치·해체 순서 변경',
  '장비 종류·작업반경 변경',
  '작업구간 또는 승인도면 개정',
  '사고·아차사고 또는 기상조건 변화',
] as const;

const riskAssessmentPolicy = (methodReference: string) => ({
  methodVersion: 2 as const,
  methodReference,
  formula: 'probability * severity' as const,
  probabilityMin: 1 as const,
  probabilityMax: 5 as const,
  severityMin: 1 as const,
  severityMax: 5 as const,
  thresholds: STANDARD_RISK_THRESHOLDS.map((threshold) => ({ ...threshold })),
  acceptance: {
    maxResidualScore: 9,
    requireResidualReduction: true,
    blockedResidualLevels: ['high', 'critical'] as const,
  },
  reviewTriggers: [...STANDARD_RISK_REVIEW_TRIGGERS],
});

/**
 * Immutable MVP page contract derived from the 42-page REV.5 reference plan.
 * It describes content provenance and slots; it intentionally does not copy
 * wording or instructions from the source document.
 */
export const SYSTEM_SHORING_TEMPLATE_MANIFEST = deepFreeze(ConstructionPlanTemplateManifestSchema.parse({
  id: 'system-shoring-standard',
  name: '시스템동바리 시공계획서 표준',
  tradeType: 'system-shoring',
  version: '1.0.0',
  schemaVersion: 1,
  rendererVersion: 'field-use-a4-v3',
  pageSize: {
    name: 'A4',
    widthPt: 595.28,
    heightPt: 841.89,
    orientation: 'portrait',
  },
  sourceReference: {
    title: '청연이엔지 시스템동바리 시공계획서',
    revision: 'REV.5',
    pageCount: 42,
  },
  riskAssessmentPolicy: riskAssessmentPolicy('청연이엔지 시스템동바리 5×5 위험성평가 기준 v2'),
  pages: [
    { pageNumber: 1, sectionKey: 'cover', chapter: '표지', title: '시공계획서 표지', kind: 'cover', dataStrategy: 'project-and-document', required: true, editable: true },
    { pageNumber: 2, sectionKey: 'document-control', chapter: '문서관리', title: '문서관리 및 개정이력', kind: 'document-control', dataStrategy: 'revision-and-approval', required: true, editable: false },
    { pageNumber: 3, sectionKey: 'toc', chapter: '목차', title: '목차 (1/2)', kind: 'toc', dataStrategy: 'generated-toc', required: true, editable: false },
    { pageNumber: 4, sectionKey: 'toc', chapter: '목차', title: '목차 (2/2)', kind: 'toc', dataStrategy: 'generated-toc', required: true, editable: false },
    { pageNumber: 5, sectionKey: 'general', chapter: '1. 일반사항', title: '일반사항', kind: 'static-content', dataStrategy: 'template-with-override', required: true, editable: true },
    { pageNumber: 6, sectionKey: 'project-overview', chapter: '2. 공사개요', title: '공사개요', kind: 'structured-form', dataStrategy: 'project-snapshot', required: true, editable: true },
    { pageNumber: 7, sectionKey: 'organization', chapter: '3. 시공조직', title: '현장 조직도 및 업무분장', kind: 'organization-chart', dataStrategy: 'organization-snapshot', required: true, editable: true },
    { pageNumber: 8, sectionKey: 'material-plan', chapter: '4. 자재계획', title: '자재 반입 및 보관계획', kind: 'structured-form', dataStrategy: 'structured-input', required: true, editable: true },
    { pageNumber: 9, sectionKey: 'equipment-plan', chapter: '5. 장비계획', title: '장비 사용계획', kind: 'equipment-plan', dataStrategy: 'equipment-and-drawing', required: true, editable: true },
    { pageNumber: 10, sectionKey: 'equipment-layout', chapter: '5. 장비계획', title: '장비 배치 및 작업동선', kind: 'drawing-page', dataStrategy: 'equipment-and-drawing', required: true, editable: true, drawingSlot: 'D-06', drawingSlots: ['D-06'] },
    { pageNumber: 11, sectionKey: 'lifting-plan', chapter: '5. 장비계획', title: '양중작업 계획', kind: 'equipment-plan', dataStrategy: 'structured-input', required: true, editable: true },
    { pageNumber: 12, sectionKey: 'equipment-procedure', chapter: '5. 장비계획', title: '장비 안전작업 절차', kind: 'static-content', dataStrategy: 'template-with-override', required: true, editable: true },
    { pageNumber: 13, sectionKey: 'equipment-inspection', chapter: '5. 장비계획', title: '장비 일상점검 기준', kind: 'checklist-template', dataStrategy: 'blank-record-template', required: true, editable: true },
    { pageNumber: 14, sectionKey: 'equipment-signal', chapter: '5. 장비계획', title: '신호체계 및 통제계획', kind: 'structured-form', dataStrategy: 'structured-input', required: true, editable: true },
    { pageNumber: 15, sectionKey: 'system-overview', chapter: '6. 공법계획', title: '시스템동바리 개요', kind: 'static-content', dataStrategy: 'template-catalog', required: true, editable: false },
    { pageNumber: 16, sectionKey: 'component-catalog', chapter: '6. 공법계획', title: '시스템동바리 구성 부품', kind: 'static-content', dataStrategy: 'template-catalog', required: true, editable: false },
    { pageNumber: 17, sectionKey: 'member-specifications', chapter: '6. 공법계획', title: '부재 규격 및 허용범위', kind: 'structured-form', dataStrategy: 'engineering-reference', required: true, editable: true },
    { pageNumber: 18, sectionKey: 'installation-sequence', chapter: '6. 공법계획', title: '표준 설치 순서', kind: 'static-content', dataStrategy: 'template-with-override', required: true, editable: true },
    { pageNumber: 19, sectionKey: 'post-ledger-assembly', chapter: '6. 공법계획', title: '지주 및 수평재 조립', kind: 'static-content', dataStrategy: 'template-with-override', required: true, editable: true },
    { pageNumber: 20, sectionKey: 'brace-installation', chapter: '6. 공법계획', title: '가새 설치계획', kind: 'static-content', dataStrategy: 'template-with-override', required: true, editable: true },
    { pageNumber: 21, sectionKey: 'connection-details', chapter: '6. 공법계획', title: '상·하부 접합 상세', kind: 'static-content', dataStrategy: 'engineering-reference', required: true, editable: true, drawingSlot: 'D-05', drawingSlots: ['D-05'] },
    { pageNumber: 22, sectionKey: 'drawing-register', chapter: '7. 시공도면', title: '도면목록 및 공통주의사항', kind: 'drawing-register', dataStrategy: 'drawing-register', required: true, editable: true },
    { pageNumber: 23, sectionKey: 'drawing-d01', chapter: '7. 시공도면', title: 'D-01 평면 배치도', kind: 'drawing-page', dataStrategy: 'approved-drawing', required: true, editable: true, drawingSlot: 'D-01', drawingSlots: ['D-01'] },
    { pageNumber: 24, sectionKey: 'drawing-d02-elevation', chapter: '7. 시공도면', title: 'D-02 입면도', kind: 'drawing-page', dataStrategy: 'approved-drawing', required: true, editable: true, drawingSlot: 'D-02', drawingSlots: ['D-02'] },
    { pageNumber: 25, sectionKey: 'drawing-d02-section', chapter: '7. 시공도면', title: 'D-02 단면도', kind: 'drawing-page', dataStrategy: 'approved-drawing', required: true, editable: true, drawingSlot: 'D-02', drawingSlots: ['D-02'] },
    { pageNumber: 26, sectionKey: 'drawing-d03-d04', chapter: '7. 시공도면', title: 'D-03·D-04 지지 및 보강 상세', kind: 'drawing-page', dataStrategy: 'approved-drawing', required: true, editable: true, drawingSlot: 'D-03', drawingSlots: ['D-03', 'D-04'] },
    { pageNumber: 27, sectionKey: 'drawing-d05-d06', chapter: '7. 시공도면', title: 'D-05·D-06 접합 및 장비간섭 상세', kind: 'drawing-page', dataStrategy: 'approved-drawing', required: true, editable: true, drawingSlot: 'D-06', drawingSlots: ['D-05', 'D-06'] },
    { pageNumber: 28, sectionKey: 'pre-pour-hold-point', chapter: '8. 타설관리', title: '타설 전 Hold Point', kind: 'approval-sheet', dataStrategy: 'hold-point', required: true, editable: true },
    { pageNumber: 29, sectionKey: 'structural-control', chapter: '8. 타설관리', title: '구조관리 기준', kind: 'structured-form', dataStrategy: 'engineering-reference', required: true, editable: true },
    { pageNumber: 30, sectionKey: 'site-installation-plan', chapter: '9. 시공계획', title: '설치 작업계획', kind: 'structured-form', dataStrategy: 'structured-input', required: true, editable: true },
    { pageNumber: 31, sectionKey: 'concrete-pour-plan', chapter: '9. 시공계획', title: '콘크리트 타설계획', kind: 'structured-form', dataStrategy: 'structured-input', required: true, editable: true },
    { pageNumber: 32, sectionKey: 'dismantling-plan', chapter: '9. 시공계획', title: '해체 작업계획', kind: 'structured-form', dataStrategy: 'structured-input', required: true, editable: true },
    { pageNumber: 33, sectionKey: 'retention-plan', chapter: '9. 시공계획', title: '존치 및 재동바리 계획', kind: 'structured-form', dataStrategy: 'structured-input', required: true, editable: true },
    { pageNumber: 34, sectionKey: 'quality-plan', chapter: '10. 관리계획', title: '품질관리 계획', kind: 'static-content', dataStrategy: 'template-with-override', required: true, editable: true },
    { pageNumber: 35, sectionKey: 'safety-plan', chapter: '10. 관리계획', title: '안전관리 계획', kind: 'static-content', dataStrategy: 'template-with-override', required: true, editable: true },
    { pageNumber: 36, sectionKey: 'risk-assessment', chapter: '10. 관리계획', title: '위험성평가', kind: 'risk-assessment', dataStrategy: 'risk-register', required: true, editable: true },
    { pageNumber: 37, sectionKey: 'emergency-plan', chapter: '10. 관리계획', title: '비상조치 계획', kind: 'structured-form', dataStrategy: 'structured-input', required: true, editable: true },
    { pageNumber: 38, sectionKey: 'environment-plan', chapter: '10. 관리계획', title: '환경관리 계획', kind: 'static-content', dataStrategy: 'template-with-override', required: true, editable: true },
    { pageNumber: 39, sectionKey: 'installation-inspection', chapter: '11. 현장양식', title: '설치 검측 체크리스트', kind: 'checklist-template', dataStrategy: 'blank-record-template', required: true, editable: true },
    { pageNumber: 40, sectionKey: 'equipment-daily-log', chapter: '11. 현장양식', title: '장비 일일점검일지', kind: 'checklist-template', dataStrategy: 'blank-record-template', required: true, editable: true },
    { pageNumber: 41, sectionKey: 'photo-sheet', chapter: '11. 현장양식', title: '현장사진대지', kind: 'photo-sheet', dataStrategy: 'blank-record-template', required: false, editable: true },
    { pageNumber: 42, sectionKey: 'handover', chapter: '11. 현장양식', title: '인수인계 및 확인서', kind: 'approval-sheet', dataStrategy: 'blank-record-template', required: true, editable: true },
  ],
}));

const SYSTEM_SCAFFOLD_PAGE_OVERRIDES: Readonly<Record<number, Partial<TemplatePage>>> = {
  1: { title: '시스템비계 시공계획서 표지' },
  5: { title: '시스템비계 공사 일반사항' },
  8: { title: '비계 자재 반입·검수 및 보관계획' },
  10: { title: '장비 배치·양중 및 자재 동선' },
  15: { title: '시스템비계 개요' },
  16: { title: '시스템비계 구성 부품' },
  17: { title: '비계 부재 규격 및 허용범위' },
  18: { title: '시스템비계 표준 설치 순서' },
  19: {
    sectionKey: 'base-standard-assembly',
    title: '받침철물·수직재·수평재 조립',
  },
  20: {
    sectionKey: 'brace-tie-installation',
    title: '가새 및 벽이음 설치계획',
  },
  21: {
    sectionKey: 'wall-tie-anchorage',
    title: '벽이음·앵커 접합 상세',
    drawingSlot: 'D-04',
    drawingSlots: ['D-04'],
  },
  23: { title: 'D-01 비계 평면 배치도' },
  24: { title: 'D-02 비계 입면도' },
  25: { title: 'D-02 비계 단면도' },
  26: { title: 'D-03·D-04 기초 및 벽이음 상세' },
  27: { title: 'D-05·D-06 승강·추락·낙하 방지 상세' },
  28: {
    sectionKey: 'pre-use-hold-point',
    chapter: '8. 설치검사',
    title: '사용 전 Hold Point',
  },
  29: {
    chapter: '8. 설치검사',
    title: '구조 및 설치 관리기준',
  },
  30: { title: '시스템비계 설치 작업계획' },
  31: {
    sectionKey: 'work-platform-access-plan',
    title: '작업발판·승강통로 계획',
  },
  32: { title: '시스템비계 해체 작업계획' },
  33: {
    sectionKey: 'inspection-maintenance-plan',
    title: '사용 중 점검·보수 및 변경관리',
  },
  39: { title: '시스템비계 설치 검측 체크리스트' },
  40: {
    sectionKey: 'scaffold-daily-log',
    title: '시스템비계 일일점검일지',
  },
};

/**
 * Immutable 42-page system-scaffold contract. Shared project, organization,
 * equipment, drawing, safety and record slots intentionally keep the same
 * page identities as the shoring contract; scaffold-specific construction
 * pages use independent section keys so data cannot be interpreted as
 * shoring content by mistake.
 */
export const SYSTEM_SCAFFOLD_TEMPLATE_MANIFEST = deepFreeze(ConstructionPlanTemplateManifestSchema.parse({
  ...SYSTEM_SHORING_TEMPLATE_MANIFEST,
  id: 'system-scaffold-standard',
  name: '시스템비계 시공계획서 표준',
  tradeType: 'system-scaffold',
  version: '1.0.0',
  sourceReference: {
    title: '청연이엔지 시스템비계 표준 시공계획서',
    revision: 'STANDARD.1',
    pageCount: 42,
  },
  riskAssessmentPolicy: riskAssessmentPolicy('청연이엔지 시스템비계 5×5 위험성평가 기준 v2'),
  pages: SYSTEM_SHORING_TEMPLATE_MANIFEST.pages.map((page) => ({
    ...page,
    drawingSlots: [...page.drawingSlots],
    ...(SYSTEM_SCAFFOLD_PAGE_OVERRIDES[page.pageNumber] ?? {}),
  })),
}));

const GENERATED_SECTION_KEYS = new Set(['document-control', 'toc']);
const TEMPLATE_COMPLETE_STRATEGIES = new Set(['template-catalog', 'blank-record-template']);

export const createDefaultPlanSections = (
  manifest: ConstructionPlanTemplateManifest = SYSTEM_SHORING_TEMPLATE_MANIFEST,
): PlanSection[] => {
  const byKey = new Map<string, PlanSection>();

  manifest.pages.forEach((page) => {
    const existing = byKey.get(page.sectionKey);
    if (existing) {
      existing.pageNumbers.push(page.pageNumber);
      return;
    }

    const isGenerated = GENERATED_SECTION_KEYS.has(page.sectionKey);
    const isTemplateComplete = TEMPLATE_COMPLETE_STRATEGIES.has(page.dataStrategy);
    byKey.set(page.sectionKey, {
      id: page.sectionKey,
      key: page.sectionKey,
      title: page.title.replace(/\s*\(\d\/\d\)$/, ''),
      kind: page.kind,
      order: page.pageNumber - 1,
      pageNumbers: [page.pageNumber],
      required: page.required,
      status: isGenerated || isTemplateComplete ? 'complete' : 'empty',
      content: {},
      placeholders: [],
      containsExampleValues: false,
      standardTextModified: false,
    });
  });

  return Array.from(byKey.values()).sort((left, right) => left.order - right.order);
};

export const getTemplatePage = (
  pageNumber: number,
  manifest: ConstructionPlanTemplateManifest = SYSTEM_SHORING_TEMPLATE_MANIFEST,
) => manifest.pages.find((page) => page.pageNumber === pageNumber);

export const getTemplatePagesForSection = (
  sectionKey: string,
  manifest: ConstructionPlanTemplateManifest = SYSTEM_SHORING_TEMPLATE_MANIFEST,
) => manifest.pages.filter((page) => page.sectionKey === sectionKey);
