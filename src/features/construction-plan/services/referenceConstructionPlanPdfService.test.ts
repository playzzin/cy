import {
  createReferenceConstructionPlanFileName,
  estimateReferenceDrawingImagePrintDpi,
  normalizeReferenceConstructionPlanInput,
  REFERENCE_CONSTRUCTION_PLAN_DEFAULT_COMPANY,
  REFERENCE_CONSTRUCTION_PLAN_PAGE_COUNT,
  REFERENCE_CONSTRUCTION_PLAN_PAGE_HEADER_LAYOUT,
} from './referenceConstructionPlanPdfService';

describe('referenceConstructionPlanPdfService', () => {
  const baseInput = {
    siteName: '  서울 / 테스트 현장  ',
    projectName: '  시스템동바리 설치 공사  ',
    companyName: '',
    documentNo: ' CY-001 ',
    revision: 5,
    preparedDate: '2026-08-22',
    applicationScope: '',
  };

  it('normalizes direct input and restores the attached document defaults', () => {
    const normalized = normalizeReferenceConstructionPlanInput(baseInput);

    expect(normalized.siteName).toBe('서울 / 테스트 현장');
    expect(normalized.projectName).toBe('시스템동바리 설치 공사');
    expect(normalized.companyName).toBe(REFERENCE_CONSTRUCTION_PLAN_DEFAULT_COMPANY);
    expect(normalized.applicationScope).toBe('지하층 · 저층부 · 기준층 · 특수구간');
    expect(normalized.coverTemplate).toBe('blueprint');
    expect(REFERENCE_CONSTRUCTION_PLAN_PAGE_COUNT).toBe(42);
  });

  it('keeps a supported premium cover and falls back from an unknown cover', () => {
    expect(normalizeReferenceConstructionPlanInput({
      ...baseInput,
      coverTemplate: 'executive',
    }).coverTemplate).toBe('executive');
    expect(normalizeReferenceConstructionPlanInput({
      ...baseInput,
      coverTemplate: 'unsupported' as never,
    }).coverTemplate).toBe('blueprint');
  });

  it('creates a Windows-safe download filename from the direct inputs', () => {
    const filename = createReferenceConstructionPlanFileName({
      siteName: baseInput.siteName,
      companyName: '청연:이엔지',
      revision: 5,
    });

    expect(filename).toBe('청연-이엔지_서울_-_테스트_현장_시스템동바리_시공계획서_REV5.pdf');
    expect(filename).not.toMatch(/[\\/:*?"<>|]/);
  });

  it('calculates the effective DPI after fitting a photo into the A4 drawing frame', () => {
    expect(estimateReferenceDrawingImagePrintDpi(2400, 1600)).toBe(325);
    expect(estimateReferenceDrawingImagePrintDpi(0, 1600)).toBe(0);
  });

  it('keeps every content-page brand and logo inside the standardized header', () => {
    const { pageWidth, height, brand, logoPanel, logo } = REFERENCE_CONSTRUCTION_PLAN_PAGE_HEADER_LAYOUT;

    expect(height).toBe(42);
    expect(brand.height).toBe(height);
    expect(brand.x + brand.width).toBeLessThanOrEqual(pageWidth);
    expect(logoPanel.x).toBeGreaterThanOrEqual(brand.x);
    expect(logoPanel.y).toBeGreaterThanOrEqual(brand.y);
    expect(logoPanel.x + logoPanel.width).toBeLessThanOrEqual(brand.x + brand.width);
    expect(logoPanel.y + logoPanel.height).toBeLessThanOrEqual(height);
    expect(logo.x).toBeGreaterThanOrEqual(logoPanel.x);
    expect(logo.y).toBeGreaterThanOrEqual(logoPanel.y);
    expect(logo.x + logo.width).toBeLessThanOrEqual(logoPanel.x + logoPanel.width);
    expect(logo.y + logo.height).toBeLessThanOrEqual(logoPanel.y + logoPanel.height);
  });
});
