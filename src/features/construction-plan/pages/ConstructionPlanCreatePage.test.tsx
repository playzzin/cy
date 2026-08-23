import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  REFERENCE_CONSTRUCTION_PLAN_ALL_SECTION_IDS,
  REFERENCE_CONSTRUCTION_PLAN_SECTIONS,
} from '../domain/referenceConstructionPlanSections';
import {
  loadReferenceConstructionPlanSectionCatalog,
  saveReferenceConstructionPlanSectionCatalog,
} from '../services/referenceConstructionPlanSectionCatalogService';
import {
  estimateReferenceDrawingImagePrintDpi,
  generateReferenceConstructionPlanPdf,
  readReferenceDrawingFile,
  readLogoFileAsDataUrl,
} from '../services/referenceConstructionPlanPdfService';
import ConstructionPlanCreatePage from './ConstructionPlanCreatePage';

jest.mock('../services/referenceConstructionPlanPdfService', () => ({
  REFERENCE_CONSTRUCTION_PLAN_TEMPLATE_URL: '/assets/construction-plan/system-shoring-rev5-template.pdf',
  REFERENCE_CONSTRUCTION_PLAN_DEFAULT_LOGO_URL: '/assets/construction-plan/cheongyeon-rev5-logo.png',
  REFERENCE_CONSTRUCTION_PLAN_COVER_URL: '/assets/construction-plan/system-shoring-rev5-cover.png',
  REFERENCE_CONSTRUCTION_PLAN_PAGE_COUNT: 42,
  REFERENCE_CONSTRUCTION_PLAN_DEFAULT_COMPANY: '청연이엔지',
  createReferenceConstructionPlanFileName: jest.fn(() => '청연이엔지_테스트현장_시스템동바리_시공계획서_REV5.pdf'),
  estimateReferenceDrawingImagePrintDpi: jest.fn(() => 325),
  generateReferenceConstructionPlanPdf: jest.fn(),
  readReferenceDrawingFile: jest.fn(),
  readLogoFileAsDataUrl: jest.fn(),
}));

jest.mock('../services/referenceConstructionPlanSectionCatalogService', () => ({
  loadReferenceConstructionPlanSectionCatalog: jest.fn(),
  saveReferenceConstructionPlanSectionCatalog: jest.fn(),
  getReferenceSectionCatalogErrorMessage: jest.fn(() => '목차 데이터베이스 오류'),
}));

const generatePdf = generateReferenceConstructionPlanPdf as jest.MockedFunction<
  typeof generateReferenceConstructionPlanPdf
>;
const estimateDrawingDpi = estimateReferenceDrawingImagePrintDpi as jest.MockedFunction<
  typeof estimateReferenceDrawingImagePrintDpi
>;
const readLogo = readLogoFileAsDataUrl as jest.MockedFunction<typeof readLogoFileAsDataUrl>;
const readDrawing = readReferenceDrawingFile as jest.MockedFunction<
  typeof readReferenceDrawingFile
>;
const loadCatalog = loadReferenceConstructionPlanSectionCatalog as jest.MockedFunction<
  typeof loadReferenceConstructionPlanSectionCatalog
>;
const saveCatalog = saveReferenceConstructionPlanSectionCatalog as jest.MockedFunction<
  typeof saveReferenceConstructionPlanSectionCatalog
>;

const renderPage = () => render(
  <MemoryRouter initialEntries={['/construction-plans/create']}>
    <ConstructionPlanCreatePage />
  </MemoryRouter>,
);

const enterRequiredProjectData = () => {
  fireEvent.change(screen.getByLabelText('현장명 *'), { target: { value: '테스트 신축공사 현장' } });
};

const goToSiteInput = () => {
  fireEvent.click(screen.getByRole('button', { name: /다음: 현장정보 직접입력/ }));
};

const goToTocSelection = () => {
  goToSiteInput();
  enterRequiredProjectData();
  fireEvent.click(screen.getByRole('button', { name: /다음: 목차 선택·미리보기/ }));
};

const goToPdfPreview = () => {
  goToTocSelection();
  fireEvent.click(screen.getByRole('button', { name: /다음: PDF 구성 확인/ }));
};

describe('ConstructionPlanCreatePage selectable reference PDF flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    generatePdf.mockResolvedValue(new Blob(['reference-pdf'], { type: 'application/pdf' }));
    estimateDrawingDpi.mockReturnValue(325);
    readLogo.mockResolvedValue('data:image/png;base64,dGVzdA==');
    loadCatalog.mockResolvedValue({
      sections: REFERENCE_CONSTRUCTION_PLAN_SECTIONS,
      source: 'database',
    });
    saveCatalog.mockImplementation(async (sections) => ({
      sections: [...sections],
      source: 'database',
    }));
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: jest.fn(() => 'blob:construction-plan-preview'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: jest.fn(),
    });
  });

  it('starts with branding and routes the user through site input to the 33-item TOC step', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: '시스템동바리 시공계획서 만들기' })).toBeInTheDocument();
    expect(screen.getByText(/DB 목차 33개 선택 가능/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '로고·상호 등록' })).toBeInTheDocument();
    expect(screen.getByLabelText(/^상호 \*/)).toHaveValue('청연이엔지');
    expect(screen.getByRole('button', { name: '블루프린트 표지 선택' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '이그제큐티브 블루 표지 선택' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '아키텍처 미니멀 표지 선택' })).toBeEnabled();
    expect(screen.getByRole('button', { name: /다음: 현장정보 직접입력/ })).toBeEnabled();

    goToSiteInput();
    expect(screen.getByLabelText('현장명 *')).toHaveValue('');
    expect(screen.queryByPlaceholderText(/현장명 또는 주소로 검색/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /다음: 목차 선택·미리보기/ })).toBeDisabled();
  });

  it('shows the real source page before the user decides whether to include a TOC item', () => {
    renderPage();
    goToTocSelection();

    expect(screen.getByRole('heading', { name: '목차 선택·미리보기' })).toBeInTheDocument();
    expect(screen.getByText('33/33개 DB 목차 · 업로드 도면 0장')).toBeInTheDocument();
    expect(screen.getByAltText('일반사항 원본 5쪽 미리보기')).toHaveAttribute(
      'src',
      '/assets/construction-plan/pages/page-05.png',
    );
    expect(screen.getByLabelText('일반사항 PDF 포함')).toBeChecked();

    fireEvent.click(screen.getByLabelText('일반사항 PDF 포함'));
    expect(screen.getByLabelText('일반사항 PDF 포함')).not.toBeChecked();
    expect(screen.getByText('32/33개 DB 목차 · 업로드 도면 0장')).toBeInTheDocument();
    expect(screen.getByText(/선택 구성: DB 목차 32개 · 업로드 도면 0장 · 41쪽/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '이 목차 PDF에 포함' })).toBeEnabled();
  });

  it('passes the selected TOC IDs to the PDF generator and updates the page count', async () => {
    renderPage();
    goToTocSelection();
    fireEvent.click(screen.getByLabelText('일반사항 PDF 포함'));
    fireEvent.click(screen.getByRole('button', { name: /다음: PDF 구성 확인/ }));

    await waitFor(() => expect(generatePdf).toHaveBeenCalledWith(
      expect.objectContaining({ siteName: '테스트 신축공사 현장', companyName: '청연이엔지' }),
      expect.not.arrayContaining(['section-01']),
      [],
      REFERENCE_CONSTRUCTION_PLAN_SECTIONS,
    ));
    expect(await screen.findByAltText('첨부 원본 기반 A4 표지 미리보기')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '41쪽 PDF 다운로드' })).toBeEnabled();
  });

  it('lets the user reorder selected TOC items and passes that order to the PDF generator', async () => {
    renderPage();
    goToTocSelection();

    expect(screen.getByRole('region', { name: '선택 목차 순서 편집' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '일반사항 아래로 이동' }));
    fireEvent.click(screen.getByRole('button', { name: /다음: PDF 구성 확인/ }));

    await waitFor(() => expect(generatePdf).toHaveBeenCalledWith(
      expect.objectContaining({ siteName: '테스트 신축공사 현장' }),
      expect.arrayContaining(['section-01', 'section-02']),
      [],
      REFERENCE_CONSTRUCTION_PLAN_SECTIONS,
    ));
    const selectedIds = generatePdf.mock.calls[0][1] as string[];
    expect(selectedIds.slice(0, 3)).toEqual(['section-02', 'section-01', 'section-03']);
  });

  it('registers multiple PDF drawings, edits their titles, and passes every source page to the PDF generator', async () => {
    readDrawing
      .mockResolvedValueOnce({
        title: '구조 평면도',
        fileName: '구조-평면도.pdf',
        bytes: new Uint8Array([1]),
        pageCount: 1,
        sourceType: 'pdf',
        mimeType: 'application/pdf',
      })
      .mockResolvedValueOnce({
        title: '동바리 상세도',
        fileName: '동바리-상세도.pdf',
        bytes: new Uint8Array([2]),
        pageCount: 2,
        sourceType: 'pdf',
        mimeType: 'application/pdf',
      });
    renderPage();
    goToTocSelection();

    const files = [
      new File(['one'], '구조-평면도.pdf', { type: 'application/pdf' }),
      new File(['two'], '동바리-상세도.pdf', { type: 'application/pdf' }),
    ];
    const drawingInput = document.querySelector<HTMLInputElement>('input[type="file"][multiple]');
    fireEvent.change(drawingInput as HTMLInputElement, { target: { files } });

    await waitFor(() => expect(readDrawing).toHaveBeenCalledTimes(2));
    expect(await screen.findByDisplayValue('구조 평면도')).toBeInTheDocument();
    expect(screen.getByText('PDF 2개 · 사진 0장 · 총 3쪽 등록')).toBeInTheDocument();
    expect(screen.getAllByText(/업로드 도면 3장/).length).toBeGreaterThan(0);
    expect(screen.getByText(/최종 45쪽/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('1번 도면 제목'), { target: { value: 'A동 구조 평면도' } });
    fireEvent.click(screen.getByRole('button', { name: '동바리 상세도 도면 위로 이동' }));
    expect(screen.getByLabelText('1번 도면 제목')).toHaveValue('동바리 상세도');

    fireEvent.click(screen.getByRole('button', { name: /다음: PDF 구성 확인/ }));
    await waitFor(() => expect(generatePdf).toHaveBeenCalled());
    const drawings = generatePdf.mock.calls[0][2] as Array<{ title: string; pageCount: number }>;
    expect(drawings.map(({ title, pageCount }) => [title, pageCount])).toEqual([
      ['동바리 상세도', 2],
      ['A동 구조 평면도', 1],
    ]);
  });

  it('registers a photo drawing with print dimensions and passes it to the A4 PDF generator', async () => {
    readDrawing.mockResolvedValueOnce({
      title: 'A동 설치구간 사진',
      fileName: 'A동-설치구간.jpg',
      bytes: new Uint8Array([3]),
      pageCount: 1,
      sourceType: 'image',
      mimeType: 'image/jpeg',
      pixelWidth: 2400,
      pixelHeight: 1600,
    });
    renderPage();
    goToTocSelection();

    const photo = new File(['photo'], 'A동-설치구간.jpg', { type: 'image/jpeg' });
    const drawingInput = document.querySelector<HTMLInputElement>('input[type="file"][multiple]');
    fireEvent.change(drawingInput as HTMLInputElement, { target: { files: [photo] } });

    await waitFor(() => expect(readDrawing).toHaveBeenCalledWith(photo));
    expect(await screen.findByDisplayValue('A동 설치구간 사진')).toBeInTheDocument();
    expect(screen.getByText('PDF 0개 · 사진 1장 · 총 1쪽 등록')).toBeInTheDocument();
    expect(screen.getByLabelText('1번 도면 제목').closest('label')).toHaveTextContent(
      '2400×1600px · 약 325DPI · A4 비율 유지 맞춤',
    );

    fireEvent.click(screen.getByRole('button', { name: /다음: PDF 구성 확인/ }));
    await waitFor(() => expect(generatePdf).toHaveBeenCalled());
    expect(generatePdf.mock.calls[0][2]).toEqual([
      expect.objectContaining({ sourceType: 'image', pageCount: 1, pixelWidth: 2400, pixelHeight: 1600 }),
    ]);
  });

  it('uses the attached Cheongyeon brand by default and generates all 42 pages when all items remain selected', async () => {
    renderPage();
    expect(screen.getByLabelText(/^상호 \*/)).toHaveValue('청연이엔지');
    expect(screen.getByAltText('청연이엔지 로고')).toHaveAttribute(
      'src',
      '/assets/construction-plan/cheongyeon-rev5-logo.png',
    );
    goToSiteInput();
    enterRequiredProjectData();
    fireEvent.click(screen.getByRole('button', { name: /다음: 목차 선택·미리보기/ }));
    fireEvent.click(screen.getByRole('button', { name: /다음: PDF 구성 확인/ }));

    await waitFor(() => expect(generatePdf).toHaveBeenCalledWith(
      expect.objectContaining({ companyName: '청연이엔지', revision: 5 }),
      REFERENCE_CONSTRUCTION_PLAN_ALL_SECTION_IDS,
      [],
      REFERENCE_CONSTRUCTION_PLAN_SECTIONS,
    ));
    expect(await screen.findByRole('link', { name: /전체 PDF 보기/ })).toHaveAttribute('href', 'blob:construction-plan-preview');
    expect(screen.getByRole('button', { name: '42쪽 PDF 다운로드' })).toBeEnabled();
  });

  it('passes a registered company name and logo into the selected PDF', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText(/^상호 \*/), { target: { value: '테스트건설 주식회사' } });
    fireEvent.click(screen.getByRole('button', { name: '이그제큐티브 블루 표지 선택' }));
    expect(screen.getByRole('button', { name: '이그제큐티브 블루 표지 선택' })).toHaveAttribute('aria-pressed', 'true');
    const file = new File(['logo'], 'company-logo.png', { type: 'image/png' });
    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    fireEvent.change(fileInput as HTMLInputElement, { target: { files: [file] } });

    await waitFor(() => expect(readLogo).toHaveBeenCalledWith(file));
    expect(await screen.findByText('사용자 등록 로고')).toBeInTheDocument();
    goToSiteInput();
    enterRequiredProjectData();
    fireEvent.click(screen.getByRole('button', { name: /다음: 목차 선택·미리보기/ }));
    fireEvent.click(screen.getByRole('button', { name: /다음: PDF 구성 확인/ }));

    await waitFor(() => expect(generatePdf).toHaveBeenCalledWith(
      expect.objectContaining({
        companyName: '테스트건설 주식회사',
        customLogoDataUrl: 'data:image/png;base64,dGVzdA==',
        coverTemplate: 'executive',
      }),
      REFERENCE_CONSTRUCTION_PLAN_ALL_SECTION_IDS,
      [],
      REFERENCE_CONSTRUCTION_PLAN_SECTIONS,
    ));
  });

  it('adds, edits, and deletes TOC catalog items through the database-backed manager', async () => {
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage();
    goToTocSelection();

    expect(await screen.findByRole('region', { name: '목차 데이터베이스 관리' })).toBeInTheDocument();
    const addButton = screen.getByRole('button', { name: /새 목차 추가/ });
    await waitFor(() => expect(addButton).toBeEnabled());
    fireEvent.click(addButton);
    fireEvent.change(screen.getByLabelText('목차 제목 *'), { target: { value: '현장 추가 안전계획' } });
    fireEvent.change(screen.getByLabelText('영문 제목'), { target: { value: 'SITE SAFETY ADDENDUM' } });
    fireEvent.change(screen.getByLabelText(/연결할 원본 PDF 쪽/), { target: { value: '35' } });
    fireEvent.click(screen.getByRole('button', { name: /데이터베이스에 저장/ }));

    await waitFor(() => expect(saveCatalog).toHaveBeenCalled());
    const editButton = await screen.findByRole('button', { name: '현장 추가 안전계획 목차 수정' });
    await waitFor(() => expect(editButton).toBeEnabled());
    fireEvent.click(editButton);
    const titleInput = await screen.findByDisplayValue('현장 추가 안전계획');
    fireEvent.change(titleInput, { target: { value: '현장 특별 안전계획' } });
    const updateButton = screen.getByRole('button', { name: /데이터베이스에 저장/ });
    await waitFor(() => expect(updateButton).toBeEnabled());
    fireEvent.click(updateButton);

    await waitFor(() => expect(saveCatalog).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('button', { name: '현장 특별 안전계획 목차 수정' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '현장 특별 안전계획 목차 삭제' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: '현장 특별 안전계획 목차 수정' })).not.toBeInTheDocument());
    expect(confirm).toHaveBeenCalled();
    confirm.mockRestore();
  }, 15_000);

  it('offers retry on the final preview when generation fails', async () => {
    generatePdf.mockRejectedValueOnce(new Error('template fetch failed'));
    renderPage();
    goToPdfPreview();

    expect(await screen.findByRole('alert')).toHaveTextContent('PDF를 만들지 못했습니다');
    expect(screen.getByRole('button', { name: /다시 생성/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: '42쪽 PDF 다운로드' })).toBeDisabled();
  });

  it('offers direct edit shortcuts from the final PDF preview', async () => {
    renderPage();
    goToPdfPreview();

    expect(await screen.findByRole('region', { name: 'PDF 빠른 수정' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '목차·순서' }));
    expect(screen.getByRole('heading', { name: '목차 선택·미리보기' })).toBeInTheDocument();
  });

  it('shows a clear validation message for an unsupported logo file', async () => {
    readLogo.mockRejectedValueOnce(new Error('construction-plan-brand-logo-type-invalid'));
    renderPage();
    const invalidFile = new File(['bad'], 'logo.svg', { type: 'image/svg+xml' });
    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    fireEvent.change(fileInput as HTMLInputElement, { target: { files: [invalidFile] } });

    expect(await screen.findByRole('alert')).toHaveTextContent('PNG, JPG, WebP');
  });
});
