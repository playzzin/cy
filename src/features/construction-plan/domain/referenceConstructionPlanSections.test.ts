import {
  countReferenceConstructionPlanPages,
  countReferenceConstructionPlanTocPages,
  getSelectedReferenceSections,
  normalizeReferenceSectionCatalog,
  normalizeReferenceSectionIds,
  referenceConstructionPlanPagePreviewUrl,
  REFERENCE_CONSTRUCTION_PLAN_ALL_SECTION_IDS,
  REFERENCE_CONSTRUCTION_PLAN_SECTIONS,
} from './referenceConstructionPlanSections';

describe('referenceConstructionPlanSections', () => {
  it('maps all 33 selectable TOC items to the complete 42-page reference document', () => {
    expect(REFERENCE_CONSTRUCTION_PLAN_SECTIONS).toHaveLength(33);
    expect(REFERENCE_CONSTRUCTION_PLAN_ALL_SECTION_IDS).toHaveLength(33);
    expect(countReferenceConstructionPlanPages()).toBe(42);
    expect(REFERENCE_CONSTRUCTION_PLAN_SECTIONS.flatMap(({ sourcePages }) => sourcePages)).toEqual(
      Array.from({ length: 38 }, (_, index) => index + 5),
    );
  });

  it('preserves the user-selected order, removes duplicates and unknown IDs, and counts only selected pages', () => {
    const selected = normalizeReferenceSectionIds(['unknown', 'section-12', 'section-01']);
    expect(selected).toEqual(['section-12', 'section-01']);
    expect(getSelectedReferenceSections([...selected, 'section-12']).map(({ number }) => number)).toEqual([12, 1]);
    expect(countReferenceConstructionPlanPages(selected)).toBe(6);
  });

  it('creates the exact source-page preview asset URL', () => {
    expect(referenceConstructionPlanPagePreviewUrl(5)).toBe('/assets/construction-plan/pages/page-05.png');
    expect(referenceConstructionPlanPagePreviewUrl(42)).toBe('/assets/construction-plan/pages/page-42.png');
  });

  it('adds every uploaded drawing page and expands the TOC when more than 18 items are registered', () => {
    expect(countReferenceConstructionPlanTocPages([], 3)).toBe(1);
    expect(countReferenceConstructionPlanPages([], 3)).toBe(6);
    expect(countReferenceConstructionPlanTocPages(['section-01'], 20)).toBe(2);
    expect(countReferenceConstructionPlanPages(['section-01'], 20)).toBe(25);
    expect(countReferenceConstructionPlanTocPages(undefined, 4)).toBe(3);
    expect(countReferenceConstructionPlanPages(undefined, 4)).toBe(47);
  });

  it('uses database catalog titles and added items for selection and page counting', () => {
    const catalog = normalizeReferenceSectionCatalog([
      { ...REFERENCE_CONSTRUCTION_PLAN_SECTIONS[0], title: '수정된 일반사항' },
      {
        id: 'custom-safety',
        number: 99,
        title: '현장 특별 안전계획',
        englishTitle: 'SITE SAFETY ADDENDUM',
        group: '도면·안전·품질 관리',
        sourcePages: [35],
      },
    ]);

    expect(getSelectedReferenceSections(undefined, catalog).map(({ title }) => title)).toEqual([
      '수정된 일반사항',
      '현장 특별 안전계획',
    ]);
    expect(catalog.map(({ number }) => number)).toEqual([1, 2]);
    expect(countReferenceConstructionPlanPages(undefined, 0, catalog)).toBe(5);
  });
});
