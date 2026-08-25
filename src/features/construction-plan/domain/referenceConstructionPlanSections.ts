export type ReferenceConstructionPlanSectionGroup = '시공·장비 계획' | '도면·안전·품질 관리';

export type ReferenceConstructionPlanSection = {
  id: string;
  number: number;
  title: string;
  englishTitle: string;
  group: ReferenceConstructionPlanSectionGroup;
  sourcePages: number[];
};

export const REFERENCE_CONSTRUCTION_PLAN_MIN_SOURCE_PAGE = 5;
export const REFERENCE_CONSTRUCTION_PLAN_MAX_SOURCE_PAGE = 42;

const section = (
  number: number,
  title: string,
  englishTitle: string,
  group: ReferenceConstructionPlanSectionGroup,
  sourcePages: number[],
): ReferenceConstructionPlanSection => ({
  id: `section-${String(number).padStart(2, '0')}`,
  number,
  title,
  englishTitle,
  group,
  sourcePages,
});

export const REFERENCE_CONSTRUCTION_PLAN_SECTIONS: ReferenceConstructionPlanSection[] = [
  section(1, '일반사항', 'GENERAL REQUIREMENTS', '시공·장비 계획', [5]),
  section(2, '공사개요 및 시공방침', 'OVERVIEW', '시공·장비 계획', [6]),
  section(3, '조직 및 책임', 'ORGANIZATION', '시공·장비 계획', [7]),
  section(4, '자재·장비 및 반입관리', 'MATERIAL CONTROL', '시공·장비 계획', [8]),
  section(5, '장비사용계획 총괄', 'EQUIPMENT PLAN', '시공·장비 계획', [9]),
  section(6, '장비 반입·배치·동선도', 'SITE LOGISTICS', '시공·장비 계획', [10]),
  section(7, '양중장비 사용계획', 'LIFTING PLAN', '시공·장비 계획', [11]),
  section(8, '고소작업장비 사용계획', 'WORK AT HEIGHT', '시공·장비 계획', [12]),
  section(9, '운반·조립·측량장비 사용계획', 'HANDLING & TOOLS', '시공·장비 계획', [13]),
  section(10, '장비 작업허가 및 일일점검표', 'EQUIPMENT CHECK', '시공·장비 계획', [14]),
  section(11, '시스템동바리 구성 및 설치 개념도', 'SYSTEM & DETAILS', '시공·장비 계획', [15]),
  section(12, '시스템동바리 구성품 품목 LIST', 'COMPONENT CATALOG', '시공·장비 계획', [16, 17]),
  section(13, '표준 규격·치수 참고표', 'DIMENSION GUIDE', '시공·장비 계획', [18]),
  section(14, '시스템동바리 설치 순서도', 'INSTALLATION SEQUENCE', '시공·장비 계획', [19, 20]),
  section(15, '상세 설치도 및 중요 접합부', 'DETAIL DRAWING', '도면·안전·품질 관리', [21]),
  section(16, '도면목록 및 공통 주기사항', 'DRAWING REGISTER', '도면·안전·품질 관리', [22]),
  section(17, 'D-01 시스템동바리 평면배치도', 'PLAN LAYOUT', '도면·안전·품질 관리', [23]),
  section(18, 'D-02 입면 및 단면도', 'ELEVATION & SECTION', '도면·안전·품질 관리', [24]),
  section(19, 'D-03 슬래브·보 지지 상세도', 'SLAB & BEAM DETAILS', '도면·안전·품질 관리', [25]),
  section(20, 'D-04 개구부·단차·가장자리 상세도', 'EDGE & OPENING', '도면·안전·품질 관리', [26]),
  section(21, 'D-05/D-06 접합·장비간섭 상세', 'CONNECTION & INTERFERENCE', '도면·안전·품질 관리', [27]),
  section(22, '타설 전 HOLD POINT 및 승인 흐름', 'PRE-POUR HOLD POINT', '도면·안전·품질 관리', [28]),
  section(23, '구성 및 구조관리 원칙', 'STRUCTURAL CONTROL', '도면·안전·품질 관리', [29]),
  section(24, '설치 시공계획', 'INSTALLATION PLAN', '도면·안전·품질 관리', [30, 31]),
  section(25, '타설 중 관리', 'POUR CONTROL', '도면·안전·품질 관리', [32]),
  section(26, '해체 및 반출계획', 'DISMANTLING', '도면·안전·품질 관리', [33]),
  section(27, '품질관리 및 검측', 'QUALITY', '도면·안전·품질 관리', [34]),
  section(28, '안전관리', 'SAFETY', '도면·안전·품질 관리', [35]),
  section(29, '위험성평가', 'RISK ASSESSMENT', '도면·안전·품질 관리', [36]),
  section(30, '비상대응', 'EMERGENCY', '도면·안전·품질 관리', [37]),
  section(31, '환경·정리정돈', 'HOUSEKEEPING', '도면·안전·품질 관리', [38]),
  section(32, '검측 체크리스트', 'INSPECTION CHECKLIST', '도면·안전·품질 관리', [39, 40]),
  section(33, '현장 기록양식·사진대지 및 인수인계', 'FIELD RECORD', '도면·안전·품질 관리', [41, 42]),
];

export const REFERENCE_CONSTRUCTION_PLAN_ALL_SECTION_IDS =
  REFERENCE_CONSTRUCTION_PLAN_SECTIONS.map(({ id }) => id);

export const normalizeReferenceSectionCatalog = (
  sections: readonly ReferenceConstructionPlanSection[] | undefined,
): ReferenceConstructionPlanSection[] => {
  const seen = new Set<string>();
  return (sections ?? []).flatMap((item) => {
    const id = String(item?.id ?? '').trim().slice(0, 120);
    const title = String(item?.title ?? '').trim().slice(0, 120);
    const englishTitle = String(item?.englishTitle ?? '').trim().slice(0, 160);
    const group = item?.group;
    if (
      !id
      || !title
      || !englishTitle
      || seen.has(id)
      || !['시공·장비 계획', '도면·안전·품질 관리'].includes(group)
    ) return [];
    const sourcePages = Array.from(new Set(
      (Array.isArray(item.sourcePages) ? item.sourcePages : [])
        .map(Number)
        .filter((page) => (
          Number.isInteger(page)
          && page >= REFERENCE_CONSTRUCTION_PLAN_MIN_SOURCE_PAGE
          && page <= REFERENCE_CONSTRUCTION_PLAN_MAX_SOURCE_PAGE
        )),
    )).sort((a, b) => a - b);
    if (sourcePages.length === 0) return [];
    seen.add(id);
    return [{
      id,
      number: seen.size,
      title,
      englishTitle,
      group,
      sourcePages,
    }];
  });
};

export const normalizeReferenceSectionIds = (
  sectionIds?: string[],
  catalog: readonly ReferenceConstructionPlanSection[] = REFERENCE_CONSTRUCTION_PLAN_SECTIONS,
): string[] => {
  const normalizedCatalog = normalizeReferenceSectionCatalog(catalog);
  const sectionById = new Map(normalizedCatalog.map((item) => [item.id, item]));
  const requested = sectionIds ?? normalizedCatalog.map(({ id }) => id);
  const seen = new Set<string>();
  return requested.filter((id) => {
    if (!sectionById.has(id) || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

export const getSelectedReferenceSections = (
  sectionIds?: string[],
  catalog: readonly ReferenceConstructionPlanSection[] = REFERENCE_CONSTRUCTION_PLAN_SECTIONS,
) => {
  const normalizedCatalog = normalizeReferenceSectionCatalog(catalog);
  const sectionById = new Map(normalizedCatalog.map((item) => [item.id, item]));
  return normalizeReferenceSectionIds(sectionIds, normalizedCatalog)
    .map((id) => sectionById.get(id))
    .filter((item): item is ReferenceConstructionPlanSection => Boolean(item));
};

export const REFERENCE_CONSTRUCTION_PLAN_TOC_ITEMS_PER_PAGE = 18;

export const countReferenceConstructionPlanTocPages = (
  sectionIds?: string[],
  uploadedDrawingPageCount = 0,
  catalog: readonly ReferenceConstructionPlanSection[] = REFERENCE_CONSTRUCTION_PLAN_SECTIONS,
  additionalTocItemCount = 0,
): number => Math.max(
  1,
  Math.ceil(
    (
      getSelectedReferenceSections(sectionIds, catalog).length
      + Math.max(0, uploadedDrawingPageCount)
      + Math.max(0, Math.floor(additionalTocItemCount))
    )
    / REFERENCE_CONSTRUCTION_PLAN_TOC_ITEMS_PER_PAGE,
  ),
);

export const countReferenceConstructionPlanPages = (
  sectionIds?: string[],
  uploadedDrawingPageCount = 0,
  catalog: readonly ReferenceConstructionPlanSection[] = REFERENCE_CONSTRUCTION_PLAN_SECTIONS,
  additionalFixedPageCount = 0,
  additionalTocItemCount = 0,
): number => (
  2
  + Math.max(0, Math.floor(additionalFixedPageCount))
  + countReferenceConstructionPlanTocPages(
    sectionIds,
    uploadedDrawingPageCount,
    catalog,
    additionalTocItemCount,
  )
  + getSelectedReferenceSections(sectionIds, catalog)
    .reduce((total, current) => total + current.sourcePages.length, 0)
  + Math.max(0, uploadedDrawingPageCount)
);

export const referenceConstructionPlanPagePreviewUrl = (pageNumber: number): string => (
  `/assets/construction-plan/pages/page-${String(pageNumber).padStart(2, '0')}.png`
);
