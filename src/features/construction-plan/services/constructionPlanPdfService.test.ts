import html2canvas from 'html2canvas';
import { writeA4RasterPdf } from './a4RasterPdfWriter';
import {
  ConstructionPlanPdfError,
  downloadConstructionPlanPdf,
  generateConstructionPlanPdf,
} from './constructionPlanPdfService';

jest.mock('html2canvas', () => jest.fn());
jest.mock('./a4RasterPdfWriter', () => ({
  normalizePdfFileName: (value: string) => value.endsWith('.pdf') ? value : `${value}.pdf`,
  sanitizePdfAuditText: (value: string) => value,
  sha256Hex: () => 'a'.repeat(64),
  writeA4RasterPdf: jest.fn(() => new Uint8Array([0x25, 0x50, 0x44, 0x46])),
}));

const pageContainer = (pageCount: number): HTMLElement => {
  const container = document.createElement('section');
  Array.from({ length: pageCount }, (_, index) => {
    const page = document.createElement('article');
    page.className = 'cp-a4';
    page.dataset.physicalPage = String(index + 1);
    page.innerText = `시공계획서 ${index + 1}페이지 검색 본문`;
    container.appendChild(page);
    return page;
  });
  return container;
};

describe('constructionPlanPdfService dynamic physical pages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (writeA4RasterPdf as jest.MockedFunction<typeof writeA4RasterPdf>)
      .mockReturnValue(new Uint8Array([0x25, 0x50, 0x44, 0x46]));
    const renderCanvas = async () => ({
      width: 1240,
      height: 1754,
      toBlob: (callback: BlobCallback) => callback({
        type: 'image/jpeg',
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      } as Blob),
    } as HTMLCanvasElement);
    (html2canvas as jest.MockedFunction<typeof html2canvas>)
      .mockImplementation(renderCanvas as unknown as typeof html2canvas);
  });

  it('captures and assembles every continuation page in DOM order', async () => {
    const container = pageContainer(43);
    const result = await generateConstructionPlanPdf({
      container,
      fileName: 'dynamic-plan',
      audit: {
        planId: 'plan-dynamic',
        documentNo: 'CP-DYNAMIC',
        revision: 0,
        templateVersion: '1.0.0',
      },
    });

    expect(result.pageCount).toBe(43);
    expect(html2canvas).toHaveBeenCalledTimes(43);
    expect(writeA4RasterPdf).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({
        auditText: expect.stringContaining('PAGE 43/43'),
        searchText: '시공계획서 43페이지 검색 본문',
      }),
    ]));
  });

  it('creates a draft PDF from a selected seven-page TOC composition', async () => {
    const result = await generateConstructionPlanPdf({
      container: pageContainer(7),
      profile: 'draft',
      fileName: 'selected-toc-plan',
    });

    expect(result.pageCount).toBe(7);
    expect(html2canvas).toHaveBeenCalledTimes(7);
  });

  it.each([41, 201])('rejects %i issued-candidate pages outside the 42-through-200 boundary', async (pageCount) => {
    await expect(generateConstructionPlanPdf({
      container: pageContainer(pageCount),
      profile: 'issued-candidate',
    }))
      .rejects.toMatchObject<Partial<ConstructionPlanPdfError>>({ code: 'PAGE_COUNT_MISMATCH' });
    expect(html2canvas).not.toHaveBeenCalled();
  });

  it('rejects a draft above the shared 200-page safety ceiling', async () => {
    await expect(generateConstructionPlanPdf({ container: pageContainer(201), profile: 'draft' }))
      .rejects.toMatchObject<Partial<ConstructionPlanPdfError>>({ code: 'PAGE_COUNT_MISMATCH' });
  });
});

describe('constructionPlanPdfService download', () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  beforeEach(() => {
    jest.useFakeTimers();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: jest.fn(() => 'blob:construction-plan') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: jest.fn() });
  });

  afterEach(() => {
    jest.useRealTimers();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreateObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: originalRevokeObjectURL });
  });

  it('keeps the Blob URL alive until Chromium has started the download', () => {
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    downloadConstructionPlanPdf(new Blob(['pdf'], { type: 'application/pdf' }), 'draft-plan');

    expect(click).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    jest.advanceTimersByTime(59_999);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:construction-plan');
    click.mockRestore();
  });
});
