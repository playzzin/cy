import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import type { ConstructionPlan, PlanSection } from '../types';
import {
  countReferenceConstructionPlanPages,
  countReferenceConstructionPlanTocPages,
  referenceConstructionPlanPagePreviewUrl,
  type ReferenceConstructionPlanSection,
} from '../domain/referenceConstructionPlanSections';
import {
  REFERENCE_CONSTRUCTION_PLAN_DEFAULT_COMPANY,
  REFERENCE_CONSTRUCTION_PLAN_DEFAULT_LOGO_URL,
  type ReferenceConstructionPlanInput,
  type ReferenceConstructionPlanUploadedDrawing,
} from './referenceConstructionPlanPdfService';

const COLORS = {
  navy: 'FF071F36',
  blue: 'FF0E7490',
  cyan: 'FF16A8D8',
  paleBlue: 'FFEAF5FA',
  paleSlate: 'FFF1F5F9',
  border: 'FFCBD5E1',
  text: 'FF1E293B',
  muted: 'FF64748B',
  white: 'FFFFFFFF',
  danger: 'FFB91C1C',
};

const FONT_NAME = '맑은 고딕';
const MAX_CELL_TEXT = 30_000;

type ExcelLogoExtension = 'png' | 'jpeg';

export type ReferenceConstructionPlanExcelInput = {
  input: ReferenceConstructionPlanInput;
  sections: readonly ReferenceConstructionPlanSection[];
  drawings: readonly ReferenceConstructionPlanUploadedDrawing[];
};

type ConstructionPlanExcelBuildOptions = {
  embedLogo?: boolean;
  embedSectionPreviews?: boolean;
  embedSiteVisuals?: boolean;
};

type ReferenceContentPage = {
  id: string;
  order: number;
  title: string;
  subtitle: string;
  sourceLabel: string;
  previewUrl?: string;
  imageBytes?: Uint8Array;
  imageMimeType?: 'image/png' | 'image/jpeg';
};

const safeText = (value: unknown): string => {
  const text = String(value ?? '').split(String.fromCharCode(0)).join('').trim().slice(0, MAX_CELL_TEXT);
  return /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
};

const displayValue = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '-';
  if (Array.isArray(value)) return safeText(value.map((item) => displayValue(item)).join(', '));
  if (typeof value === 'object') {
    try {
      return safeText(JSON.stringify(value));
    } catch {
      return safeText(value);
    }
  }
  if (typeof value === 'boolean') return value ? '예' : '아니오';
  return safeText(value);
};

const fileNamePart = (value: unknown, fallback: string): string => (
  safeText(value || fallback)
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '_')
    .slice(0, 70) || fallback
);

const parseDate = (value: unknown): Date | undefined => {
  const text = String(value ?? '').trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return undefined;
  // ExcelJS serializes Date objects as absolute instants. UTC midnight keeps a
  // YYYY-MM-DD input on the same calendar day regardless of the browser zone.
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const fill = (argb: string): ExcelJS.Fill => ({
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb },
});

const border = (color = COLORS.border): Partial<ExcelJS.Borders> => ({
  top: { style: 'thin', color: { argb: color } },
  left: { style: 'thin', color: { argb: color } },
  bottom: { style: 'thin', color: { argb: color } },
  right: { style: 'thin', color: { argb: color } },
});

const setWorkbookMetadata = (workbook: ExcelJS.Workbook, title: string, companyName: string) => {
  workbook.creator = safeText(companyName) || REFERENCE_CONSTRUCTION_PLAN_DEFAULT_COMPANY;
  workbook.lastModifiedBy = workbook.creator;
  workbook.title = safeText(title);
  workbook.subject = '시공계획서 구조화 Excel 내보내기';
  workbook.keywords = '시공계획서, 현장정보, 목차, 도면, 장비계획, 위험성평가';
  workbook.company = workbook.creator;
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;
};

const configureWorksheet = (
  worksheet: ExcelJS.Worksheet,
  widths: number[],
  orientation: 'portrait' | 'landscape' = 'portrait',
) => {
  worksheet.views = [{ state: 'frozen', ySplit: 5, showGridLines: false }];
  worksheet.pageSetup = {
    paperSize: 9,
    orientation,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: true,
    margins: { left: 0.35, right: 0.35, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
  };
  worksheet.headerFooter = {
    oddHeader: '&L&8시공계획서 데이터&C&B&12' + safeText(worksheet.name) + '&R&8REVISION CONTROLLED',
    oddFooter: '&L&8STRUCTURED EXPORT&C&8Page &P / &N&R&8' + safeText(new Date().toISOString().slice(0, 10)),
  };
  widths.forEach((width, index) => {
    worksheet.getColumn(index + 1).width = Math.min(52, Math.max(8, width));
  });
  worksheet.properties.defaultRowHeight = 20;
};

const dataUrlFromBlob = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(blob);
});

const convertBlobToPngDataUrl = async (blob: Blob): Promise<string> => {
  const sourceUrl = URL.createObjectURL(blob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const candidate = new Image();
      candidate.onload = () => resolve(candidate);
      candidate.onerror = () => reject(new Error('construction-plan-excel-logo-image-invalid'));
      candidate.src = sourceUrl;
    });
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('construction-plan-excel-logo-canvas-unavailable');
    context.drawImage(image, 0, 0);
    const png = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => result ? resolve(result) : reject(new Error('construction-plan-excel-logo-convert-failed')), 'image/png');
    });
    return dataUrlFromBlob(png);
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
};

const loadExcelImage = async (source?: string): Promise<{ base64: string; extension: ExcelLogoExtension } | undefined> => {
  if (!source || typeof fetch !== 'function' || typeof FileReader === 'undefined') return undefined;
  try {
    const response = await fetch(source);
    if (!response.ok) return undefined;
    const blob = await response.blob();
    const type = blob.type.toLowerCase();
    if (type.includes('webp')) return { base64: await convertBlobToPngDataUrl(blob), extension: 'png' };
    return {
      base64: await dataUrlFromBlob(blob),
      extension: type.includes('jpeg') || type.includes('jpg') ? 'jpeg' : 'png',
    };
  } catch (error) {
    console.warn('[constructionPlanExcelService] Logo embed skipped', error);
    return undefined;
  }
};

const loadExcelImageBytes = async (
  bytes?: Uint8Array,
  mimeType?: 'image/png' | 'image/jpeg',
): Promise<{ base64: string; extension: ExcelLogoExtension } | undefined> => {
  if (!bytes || bytes.length === 0 || !mimeType || typeof FileReader === 'undefined') return undefined;
  return {
    base64: await dataUrlFromBlob(new Blob([bytes as BlobPart], { type: mimeType })),
    extension: mimeType === 'image/jpeg' ? 'jpeg' : 'png',
  };
};

const addBrandHeader = async (
  workbook: ExcelJS.Workbook,
  worksheet: ExcelJS.Worksheet,
  title: string,
  subtitle: string,
  companyName: string,
  logoSource?: string,
) => {
  worksheet.mergeCells('A1:E2');
  worksheet.mergeCells('G1:H2');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = safeText(title);
  titleCell.font = { name: FONT_NAME, size: 20, bold: true, color: { argb: COLORS.white } };
  titleCell.fill = fill(COLORS.navy);
  titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  for (let row = 1; row <= 2; row += 1) {
    for (let column = 1; column <= 8; column += 1) {
      const cell = worksheet.getCell(row, column);
      cell.fill = fill(COLORS.navy);
    }
  }
  const brandCell = worksheet.getCell('G1');
  brandCell.value = safeText(companyName);
  brandCell.font = { name: FONT_NAME, size: 11, bold: true, color: { argb: COLORS.white } };
  brandCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  worksheet.getCell('F1').value = 'LOGO';
  worksheet.getCell('F1').font = { name: FONT_NAME, size: 7, color: { argb: COLORS.cyan } };
  worksheet.getCell('F1').alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.mergeCells('A3:H3');
  const subtitleCell = worksheet.getCell('A3');
  subtitleCell.value = safeText(subtitle);
  subtitleCell.font = { name: FONT_NAME, size: 9, color: { argb: COLORS.muted } };
  subtitleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  subtitleCell.fill = fill(COLORS.paleSlate);
  worksheet.getRow(1).height = 25;
  worksheet.getRow(2).height = 25;
  worksheet.getRow(3).height = 23;

  const logo = await loadExcelImage(logoSource);
  if (logo) {
    const imageId = workbook.addImage({ base64: logo.base64, extension: logo.extension });
    worksheet.addImage(imageId, {
      tl: { col: 5.05, row: 0.12 },
      ext: { width: 42, height: 42 },
    } as ExcelJS.ImagePosition);
    worksheet.getCell('F1').value = '';
  }
};

const buildReferenceContentPages = (
  sections: readonly ReferenceConstructionPlanSection[],
  drawings: readonly ReferenceConstructionPlanUploadedDrawing[],
): ReferenceContentPage[] => {
  const pages: ReferenceContentPage[] = [];
  sections.forEach((section, sectionIndex) => {
    section.sourcePages.forEach((sourcePage, pageIndex) => {
      pages.push({
        id: `${section.id}-page-${sourcePage}`,
        order: pages.length + 1,
        title: section.sourcePages.length > 1
          ? `${sectionIndex + 1}. ${section.title} (${pageIndex + 1}/${section.sourcePages.length})`
          : `${sectionIndex + 1}. ${section.title}`,
        subtitle: section.englishTitle,
        sourceLabel: `기준 시공계획서 원본 ${sourcePage}쪽`,
        previewUrl: referenceConstructionPlanPagePreviewUrl(sourcePage),
      });
    });
  });
  drawings.forEach((drawing) => {
    for (let pageIndex = 0; pageIndex < drawing.pageCount; pageIndex += 1) {
      const imageDrawing = drawing.sourceType === 'image' && pageIndex === 0;
      pages.push({
        id: `${drawing.id}-page-${pageIndex + 1}`,
        order: pages.length + 1,
        title: drawing.pageCount > 1
          ? `${drawing.title} (${pageIndex + 1}/${drawing.pageCount})`
          : drawing.title,
        subtitle: '업로드 도면',
        sourceLabel: `${drawing.fileName} · ${drawing.sourceType === 'pdf' ? 'PDF' : '사진'} ${pageIndex + 1}쪽`,
        imageBytes: imageDrawing ? drawing.bytes : undefined,
        imageMimeType: imageDrawing ? drawing.mimeType as 'image/png' | 'image/jpeg' : undefined,
      });
    }
  });
  return pages;
};

const addReferenceContentSheet = async (
  workbook: ExcelJS.Workbook,
  input: ReferenceConstructionPlanInput,
  sections: readonly ReferenceConstructionPlanSection[],
  drawings: readonly ReferenceConstructionPlanUploadedDrawing[],
  embedPreviews: boolean,
) => {
  const worksheet = workbook.addWorksheet('선택본문');
  configureWorksheet(worksheet, [10, 12, 12, 12, 12, 12, 12, 10]);
  worksheet.views = [{ state: 'frozen', ySplit: 4, showGridLines: false }];
  addSimpleHeader(
    worksheet,
    '선택 목차 본문',
    `PDF와 동일한 선택 순서 · ${sections.length}개 목차 · ${drawings.reduce((total, drawing) => total + drawing.pageCount, 0)}장 업로드 도면`,
    8,
  );

  const pages = buildReferenceContentPages(sections, drawings);
  const previews = embedPreviews
    ? await Promise.all(pages.map((page) => (
      page.previewUrl
        ? loadExcelImage(page.previewUrl)
        : loadExcelImageBytes(page.imageBytes, page.imageMimeType)
    )))
    : [];
  const blockRows = 40;
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex];
    const startRow = 5 + (pageIndex * blockRows);
    const imageStartRow = startRow + 3;
    const endRow = startRow + blockRows - 1;
    worksheet.mergeCells(startRow, 1, startRow, 8);
    const titleCell = worksheet.getCell(startRow, 1);
    titleCell.value = `${String(page.order).padStart(2, '0')}  ${safeText(page.title)}`;
    titleCell.font = { name: FONT_NAME, size: 12, bold: true, color: { argb: COLORS.white } };
    titleCell.fill = fill(COLORS.blue);
    titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    titleCell.border = border(COLORS.blue);
    worksheet.getRow(startRow).height = 28;

    worksheet.mergeCells(startRow + 1, 1, startRow + 1, 8);
    const sourceCell = worksheet.getCell(startRow + 1, 1);
    sourceCell.value = `${safeText(page.subtitle)} · ${safeText(page.sourceLabel)} · ${safeText(input.siteName)}`;
    sourceCell.font = { name: FONT_NAME, size: 9, color: { argb: COLORS.muted } };
    sourceCell.fill = fill(COLORS.paleSlate);
    sourceCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    sourceCell.border = border();
    worksheet.getRow(startRow + 1).height = 22;

    for (let row = imageStartRow; row <= endRow; row += 1) worksheet.getRow(row).height = 15;
    worksheet.mergeCells(imageStartRow, 1, endRow, 8);
    const fallbackCell = worksheet.getCell(imageStartRow, 1);
    fallbackCell.value = page.previewUrl
      ? `선택한 목차의 실제 본문 미리보기 · ${page.sourceLabel}`
      : page.imageBytes
        ? `업로드 사진 도면 · ${page.sourceLabel}`
        : `업로드 PDF 도면은 Excel 도면목록에서 원본 파일명과 페이지를 확인할 수 있습니다. · ${page.sourceLabel}`;
    fallbackCell.font = { name: FONT_NAME, size: 10, color: { argb: COLORS.muted }, italic: true };
    fallbackCell.fill = fill(COLORS.white);
    fallbackCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    fallbackCell.border = border();

    if (embedPreviews) {
      const preview = previews[pageIndex];
      if (preview) {
        const imageId = workbook.addImage({ base64: preview.base64, extension: preview.extension });
        worksheet.addImage(imageId, {
          tl: { col: 0.35, row: imageStartRow - 0.7 },
          ext: { width: 488, height: 690 },
        } as ExcelJS.ImagePosition);
        fallbackCell.value = null;
      }
    }
    if (pageIndex < pages.length - 1) worksheet.getRow(endRow).addPageBreak();
  }

  if (pages.length === 0) {
    worksheet.mergeCells('A5:H8');
    worksheet.getCell('A5').value = '선택한 목차 또는 업로드 도면이 없습니다.';
    worksheet.getCell('A5').alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getCell('A5').font = { name: FONT_NAME, size: 11, color: { argb: COLORS.muted } };
  }
  const lastRow = pages.length > 0 ? 4 + (pages.length * blockRows) : 8;
  worksheet.pageSetup.printArea = `A1:H${lastRow}`;
  return worksheet;
};

const addSimpleHeader = (
  worksheet: ExcelJS.Worksheet,
  title: string,
  subtitle: string,
  lastColumn: number,
) => {
  worksheet.mergeCells(1, 1, 2, lastColumn);
  const titleCell = worksheet.getCell(1, 1);
  titleCell.value = safeText(title);
  titleCell.font = { name: FONT_NAME, size: 18, bold: true, color: { argb: COLORS.white } };
  titleCell.fill = fill(COLORS.navy);
  titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  for (let row = 1; row <= 2; row += 1) {
    for (let column = 1; column <= lastColumn; column += 1) worksheet.getCell(row, column).fill = fill(COLORS.navy);
  }
  worksheet.mergeCells(3, 1, 3, lastColumn);
  const subtitleCell = worksheet.getCell(3, 1);
  subtitleCell.value = safeText(subtitle);
  subtitleCell.font = { name: FONT_NAME, size: 9, color: { argb: COLORS.muted } };
  subtitleCell.fill = fill(COLORS.paleSlate);
  subtitleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  worksheet.getRow(1).height = 25;
  worksheet.getRow(2).height = 25;
  worksheet.getRow(3).height = 23;
};

const styleSectionBar = (worksheet: ExcelJS.Worksheet, rowNumber: number, title: string) => {
  worksheet.mergeCells(rowNumber, 1, rowNumber, 8);
  const cell = worksheet.getCell(rowNumber, 1);
  cell.value = safeText(title);
  cell.font = { name: FONT_NAME, size: 11, bold: true, color: { argb: COLORS.white } };
  cell.fill = fill(COLORS.blue);
  cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  cell.border = border(COLORS.blue);
  worksheet.getRow(rowNumber).height = 24;
};

const setInfoPair = (
  worksheet: ExcelJS.Worksheet,
  row: number,
  leftLabel: string,
  leftValue: unknown,
  rightLabel: string,
  rightValue: unknown,
) => {
  worksheet.mergeCells(row, 2, row, 4);
  worksheet.mergeCells(row, 6, row, 8);
  const entries: Array<[number, unknown, boolean]> = [
    [1, leftLabel, true], [2, leftValue, false], [5, rightLabel, true], [6, rightValue, false],
  ];
  entries.forEach(([column, value, label]) => {
    const cell = worksheet.getCell(row, column);
    const date = !label ? parseDate(value) : undefined;
    cell.value = date ?? (typeof value === 'number' ? value : displayValue(value));
    if (date) cell.numFmt = 'yyyy-mm-dd';
    cell.font = {
      name: FONT_NAME,
      size: label ? 9 : 10,
      bold: label,
      color: { argb: label ? COLORS.navy : COLORS.text },
    };
    cell.fill = fill(label ? COLORS.paleBlue : COLORS.white);
    cell.alignment = { vertical: 'middle', horizontal: label ? 'center' : 'left', wrapText: true };
    cell.border = border();
  });
  [3, 4, 7, 8].forEach((column) => {
    worksheet.getCell(row, column).fill = fill(COLORS.white);
    worksheet.getCell(row, column).border = border();
  });
  worksheet.getRow(row).height = 28;
};

const styleTable = (
  worksheet: ExcelJS.Worksheet,
  headerRowNumber: number,
  lastRowNumber: number,
  lastColumnNumber: number,
) => {
  const header = worksheet.getRow(headerRowNumber);
  header.height = 28;
  header.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
    if (columnNumber > lastColumnNumber) return;
    cell.font = { name: FONT_NAME, size: 9, bold: true, color: { argb: COLORS.white } };
    cell.fill = fill(COLORS.blue);
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = border(COLORS.white);
  });
  for (let rowNumber = headerRowNumber + 1; rowNumber <= lastRowNumber; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    row.height = Math.max(row.height || 20, 25);
    row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      if (columnNumber > lastColumnNumber) return;
      cell.font = { name: FONT_NAME, size: 9, color: { argb: COLORS.text } };
      cell.fill = fill(rowNumber % 2 === 0 ? COLORS.white : COLORS.paleSlate);
      cell.alignment = { vertical: 'middle', horizontal: columnNumber === 1 ? 'center' : 'left', wrapText: true };
      cell.border = border();
    });
  }
  worksheet.autoFilter = {
    from: { row: headerRowNumber, column: 1 },
    to: { row: Math.max(headerRowNumber, lastRowNumber), column: lastColumnNumber },
  };
};

const buildReferenceTocRows = (
  sections: readonly ReferenceConstructionPlanSection[],
  drawings: readonly ReferenceConstructionPlanUploadedDrawing[],
  additionalFixedPageCount = 0,
  hasSiteMap = false,
) => {
  const drawingPageCount = drawings.reduce((total, drawing) => total + drawing.pageCount, 0);
  const tocPageCount = countReferenceConstructionPlanTocPages(
    sections.map(({ id }) => id),
    drawingPageCount,
    sections,
    additionalFixedPageCount,
  );
  let outputPage = 3 + Math.max(0, additionalFixedPageCount) + tocPageCount;
  const rows: Array<Array<string | number>> = [];
  if (additionalFixedPageCount > 0) {
    rows.push([
      1,
      '현장정보',
      'S-01',
      '현장 위치 지도',
      'SITE LOCATION MAP',
      hasSiteMap ? '지도 등록' : '지도 미등록',
      3,
      1,
    ]);
  }
  sections.forEach((section, index) => {
    rows.push([
      rows.length + 1,
      section.group,
      index + 1,
      section.title,
      section.englishTitle,
      section.sourcePages.join(', '),
      outputPage,
      section.sourcePages.length,
    ]);
    outputPage += section.sourcePages.length;
  });
  drawings.forEach((drawing) => {
    for (let page = 1; page <= drawing.pageCount; page += 1) {
      rows.push([
        rows.length + 1,
        '업로드 도면',
        `D-${String(rows.length + 1).padStart(2, '0')}`,
        drawing.pageCount > 1 ? `${drawing.title} (${page}/${drawing.pageCount})` : drawing.title,
        drawing.fileName,
        page,
        outputPage,
        1,
      ]);
      outputPage += 1;
    }
  });
  return rows;
};

const addReferenceSiteVisualSheet = async (
  workbook: ExcelJS.Workbook,
  input: ReferenceConstructionPlanInput,
  companyName: string,
  logoSource: string,
  options: ConstructionPlanExcelBuildOptions,
): Promise<void> => {
  if (!input.siteAddress && !input.siteMapImageDataUrl) return;
  const worksheet = workbook.addWorksheet('현장위치');
  configureWorksheet(worksheet, [15, 15, 15, 15, 15, 15, 15, 15], 'landscape');
  await addBrandHeader(
    workbook,
    worksheet,
    '현장 위치 지도',
    '입력한 현장주소를 기준으로 자동 생성한 Google 지도',
    companyName,
    options.embedLogo === false ? undefined : logoSource,
  );
  worksheet.mergeCells('A5:H6');
  const addressCell = worksheet.getCell('A5');
  addressCell.value = input.siteMapLink
    ? { text: `현장주소 · ${safeText(input.siteAddress)}`, hyperlink: input.siteMapLink }
    : `현장주소 · ${displayValue(input.siteAddress)}`;
  addressCell.font = { name: FONT_NAME, size: 12, bold: true, color: { argb: COLORS.blue }, underline: Boolean(input.siteMapLink) };
  addressCell.fill = fill(COLORS.paleBlue);
  addressCell.border = border();
  addressCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1, wrapText: true };
  worksheet.getRow(5).height = 24;
  worksheet.getRow(6).height = 24;

  worksheet.mergeCells('A8:H8');
  const mapTitleCell = worksheet.getCell('A8');
  mapTitleCell.value = 'Google 지도 · 현장 위치';
  mapTitleCell.font = { name: FONT_NAME, size: 11, bold: true, color: { argb: COLORS.white } };
  mapTitleCell.fill = fill(COLORS.navy);
  mapTitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(8).height = 25;
  worksheet.mergeCells('A9:H28');
  const mapFallback = worksheet.getCell('A9');
  mapFallback.value = input.siteMapImageDataUrl ? 'Google 지도 이미지' : '주소로 생성된 지도 이미지가 없습니다.';
  mapFallback.font = { name: FONT_NAME, size: 10, color: { argb: COLORS.muted }, italic: true };
  mapFallback.fill = fill(COLORS.white);
  mapFallback.border = border();
  mapFallback.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  for (let row = 9; row <= 28; row += 1) worksheet.getRow(row).height = 16;

  if (options.embedSiteVisuals !== false) {
    const mapImage = await loadExcelImage(input.siteMapImageDataUrl);
    if (mapImage) {
      const imageId = workbook.addImage({ base64: mapImage.base64, extension: mapImage.extension });
      worksheet.addImage(imageId, {
        tl: { col: 0.62, row: 8.3 },
        ext: { width: 700, height: 420 },
      } as ExcelJS.ImagePosition);
      mapFallback.value = null;
    }
  }
  worksheet.pageSetup.printArea = 'A1:H28';
};

export const createReferenceConstructionPlanExcelFileName = (
  input: Pick<ReferenceConstructionPlanInput, 'siteName' | 'companyName' | 'revision'>,
): string => `${fileNamePart(input.companyName, REFERENCE_CONSTRUCTION_PLAN_DEFAULT_COMPANY)}_${fileNamePart(input.siteName, '현장')}_시스템동바리_시공계획서_REV${input.revision}.xlsx`;

export const buildReferenceConstructionPlanExcelWorkbook = async ({
  input,
  sections,
  drawings,
}: ReferenceConstructionPlanExcelInput, options: ConstructionPlanExcelBuildOptions = {}): Promise<ExcelJS.Workbook> => {
  const workbook = new ExcelJS.Workbook();
  const companyName = safeText(input.companyName) || REFERENCE_CONSTRUCTION_PLAN_DEFAULT_COMPANY;
  const logoSource = input.customLogoDataUrl || REFERENCE_CONSTRUCTION_PLAN_DEFAULT_LOGO_URL;
  const drawingPageCount = drawings.reduce((total, drawing) => total + drawing.pageCount, 0);
  const siteVisualPageCount = input.siteAddress ? 1 : 0;
  const totalPageCount = countReferenceConstructionPlanPages(
    sections.map(({ id }) => id),
    drawingPageCount,
    sections,
    siteVisualPageCount,
    siteVisualPageCount,
  );
  setWorkbookMetadata(workbook, `${input.siteName} 시스템동바리 시공계획서`, companyName);

  const summary = workbook.addWorksheet('문서개요');
  configureWorksheet(summary, [16, 22, 18, 18, 16, 18, 18, 24]);
  await addBrandHeader(
    workbook,
    summary,
    '시스템동바리 시공계획서',
    'PDF와 동일한 입력값을 구조화한 편집·검토용 Excel 문서',
    companyName,
    options.embedLogo === false ? undefined : logoSource,
  );
  styleSectionBar(summary, 5, '문서 및 현장 기본정보');
  setInfoPair(summary, 6, '상호', companyName, '문서명', '시스템동바리 시공계획서');
  setInfoPair(summary, 7, '현장명', input.siteName, '공사명', input.projectName);
  setInfoPair(summary, 8, '발주처', input.clientName, '원도급사', input.contractorName);
  setInfoPair(summary, 9, '현장주소', input.siteAddress, '공사기간', [input.constructionStartDate, input.constructionEndDate].filter(Boolean).join(' ~ '));
  setInfoPair(summary, 10, '문서번호', input.documentNo, '개정번호', input.revision);
  setInfoPair(summary, 11, '작성일자', input.preparedDate, '적용범위', input.applicationScope);
  setInfoPair(summary, 12, '구조검토번호', input.structuralReviewNo, '설치도면번호', input.installationDrawingNo);
  setInfoPair(summary, 13, '동', input.buildings, '층', input.floors);
  setInfoPair(summary, 14, '구간', input.zones, '표지 디자인', input.coverTemplate || 'blueprint');
  styleSectionBar(summary, 16, '문서 구성 요약');
  setInfoPair(summary, 17, '선택 목차', sections.length, '업로드 도면 파일', drawings.length);
  setInfoPair(summary, 18, '업로드 도면 페이지', drawingPageCount, '최종 PDF 예상 쪽수', totalPageCount);
  setInfoPair(summary, 19, 'Excel 시트 구성', siteVisualPageCount ? '문서개요 · 현장위치 · 목차 · 선택본문 · 도면목록' : '문서개요 · 목차 · 선택본문 · 도면목록', '데이터 기준', '현재 화면 입력값');
  const tocSummaryLastRow = Math.max(6, 5 + sections.length + drawingPageCount + siteVisualPageCount);
  summary.getCell('B17').value = {
    formula: `COUNTA('목차'!A6:A${tocSummaryLastRow})-COUNTIF('목차'!B6:B${tocSummaryLastRow},"업로드 도면")-COUNTIF('목차'!B6:B${tocSummaryLastRow},"현장정보")`,
    result: sections.length,
  };
  summary.getCell('F17').value = drawings.length;
  summary.getCell('B18').value = { formula: `SUM('도면목록'!F6:F${Math.max(6, 5 + drawingPageCount)})`, result: drawingPageCount };
  summary.getCell('F18').value = totalPageCount;
  summary.pageSetup.printArea = 'A1:H19';

  await addReferenceSiteVisualSheet(workbook, input, companyName, logoSource, options);

  const toc = workbook.addWorksheet('목차');
  configureWorksheet(toc, [8, 22, 12, 34, 30, 14, 14, 12], 'landscape');
  addSimpleHeader(toc, '선택 목차 및 출력 순서', `최종 PDF 예상 ${totalPageCount}쪽 · 선택 목차와 업로드 도면을 출력 순서대로 표시`, 8);
  toc.addRow([]);
  toc.addRow(['순서', '구분', '목차번호', '목차명', '영문명 / 원본파일', '원본 PDF 쪽', '최종 시작쪽', '쪽수']);
  const tocRows = buildReferenceTocRows(
    sections,
    drawings,
    siteVisualPageCount,
    Boolean(input.siteMapImageDataUrl),
  );
  if (tocRows.length > 0) toc.addRows(tocRows);
  else toc.addRow([null, '안내', null, '선택한 목차 또는 도면이 없습니다.', null, null, null, null]);
  const tocLastRow = Math.max(6, 5 + tocRows.length);
  styleTable(toc, 5, tocLastRow, 8);
  if (siteVisualPageCount > 0) {
    toc.getRow(6).eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = fill(COLORS.paleBlue);
      cell.font = { name: FONT_NAME, size: 9, bold: true, color: { argb: COLORS.blue } };
    });
  }
  toc.getColumn(1).numFmt = '0';
  toc.getColumn(7).numFmt = '0';
  toc.getColumn(8).numFmt = '0';
  toc.pageSetup.printArea = `A1:H${tocLastRow}`;

  await addReferenceContentSheet(
    workbook,
    input,
    sections,
    drawings,
    options.embedSectionPreviews !== false,
  );

  const drawingSheet = workbook.addWorksheet('도면목록');
  configureWorksheet(drawingSheet, [8, 34, 30, 14, 14, 12, 18, 18], 'landscape');
  addSimpleHeader(drawingSheet, '업로드 도면 목록', 'PDF는 원본 한 장당, 사진은 파일 한 장당 최종 PDF 한 페이지로 등록', 8);
  drawingSheet.addRow([]);
  drawingSheet.addRow(['순서', '도면 제목', '원본 파일명', '파일 형식', '원본 페이지', '쪽수', '사진 해상도', '예상 출력 품질']);
  const drawingRows: Array<Array<string | number>> = [];
  drawings.forEach((drawing) => {
    for (let page = 1; page <= drawing.pageCount; page += 1) {
      const dimensions = drawing.pixelWidth && drawing.pixelHeight
        ? `${drawing.pixelWidth.toLocaleString()} × ${drawing.pixelHeight.toLocaleString()} px`
        : '-';
      drawingRows.push([
        drawingRows.length + 1,
        drawing.title,
        drawing.fileName,
        drawing.sourceType === 'pdf' ? 'PDF' : 'IMAGE',
        page,
        1,
        dimensions,
        drawing.sourceType === 'pdf' ? '벡터/원본 PDF 유지' : 'A4 비율 맞춤 이미지',
      ]);
    }
  });
  if (drawingRows.length > 0) drawingSheet.addRows(drawingRows);
  else drawingSheet.addRow([null, '등록된 도면이 없습니다.', null, null, null, 0, null, null]);
  const drawingLastRow = Math.max(6, 5 + drawingRows.length);
  styleTable(drawingSheet, 5, drawingLastRow, 8);
  drawingSheet.pageSetup.printArea = `A1:H${drawingLastRow}`;

  return workbook;
};

export const generateReferenceConstructionPlanExcel = async (
  data: ReferenceConstructionPlanExcelInput,
): Promise<Blob> => {
  const workbook = await buildReferenceConstructionPlanExcelWorkbook(data);
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
};

const planCompanyName = (plan: ConstructionPlan): string => (
  safeText(plan.erpSnapshot?.partnerCompany?.value.name)
  || safeText(plan.erpSnapshot?.contractorCompany?.value.name)
  || safeText(plan.erpSnapshot?.clientCompany?.value.name)
  || REFERENCE_CONSTRUCTION_PLAN_DEFAULT_COMPANY
);

const orderedPlanSections = (plan: ConstructionPlan): PlanSection[] => {
  const byId = new Map(plan.sections.map((section) => [section.id, section]));
  const ordered = plan.sectionOrder.map((id) => byId.get(id)).filter((section): section is PlanSection => Boolean(section));
  const included = new Set(ordered.map(({ id }) => id));
  return [...ordered, ...plan.sections.filter(({ id }) => !included.has(id)).sort((a, b) => a.order - b.order)];
};

const addPlanTableSheet = (
  workbook: ExcelJS.Workbook,
  name: string,
  title: string,
  subtitle: string,
  headers: string[],
  rows: Array<Array<string | number | Date | null>>,
  widths: number[],
) => {
  const worksheet = workbook.addWorksheet(name);
  configureWorksheet(worksheet, widths, widths.length > 7 ? 'landscape' : 'portrait');
  addSimpleHeader(worksheet, title, subtitle, headers.length);
  worksheet.addRow([]);
  worksheet.addRow(headers);
  if (rows.length > 0) worksheet.addRows(rows);
  else worksheet.addRow(['등록된 데이터가 없습니다.']);
  const lastRow = Math.max(6, 5 + rows.length);
  styleTable(worksheet, 5, lastRow, headers.length);
  worksheet.pageSetup.printArea = `A1:${worksheet.getColumn(headers.length).letter}${lastRow}`;
  return worksheet;
};

export const createConstructionPlanExcelFileName = (plan: ConstructionPlan): string => (
  `${fileNamePart(plan.projectSnapshot.siteName, '현장')}_${fileNamePart(plan.title, '시공계획서')}_REV-${String(plan.revision).padStart(2, '0')}.xlsx`
);

export const buildConstructionPlanExcelWorkbook = async (
  plan: ConstructionPlan,
  options: ConstructionPlanExcelBuildOptions = {},
): Promise<ExcelJS.Workbook> => {
  const workbook = new ExcelJS.Workbook();
  const companyName = planCompanyName(plan);
  const sections = orderedPlanSections(plan);
  const tradeName = plan.tradeType === 'system-scaffold' ? '시스템비계' : '시스템동바리';
  setWorkbookMetadata(workbook, plan.title, companyName);

  const summary = workbook.addWorksheet('문서개요');
  configureWorksheet(summary, [16, 22, 18, 18, 16, 18, 18, 24]);
  await addBrandHeader(
    workbook,
    summary,
    plan.title,
    `${tradeName} 시공계획서 · 구조화 데이터 내보내기`,
    companyName,
    options.embedLogo === false ? undefined : REFERENCE_CONSTRUCTION_PLAN_DEFAULT_LOGO_URL,
  );
  styleSectionBar(summary, 5, '문서 및 현장 기본정보');
  setInfoPair(summary, 6, '회사명', companyName, '문서종류', tradeName);
  setInfoPair(summary, 7, '현장명', plan.projectSnapshot.siteName, '현장주소', plan.projectSnapshot.address);
  setInfoPair(summary, 8, '발주처', plan.projectSnapshot.clientName, '원도급사', plan.projectSnapshot.contractorName);
  setInfoPair(summary, 9, '문서번호', plan.documentNo, '개정번호', plan.revision);
  setInfoPair(summary, 10, '문서일자', plan.documentDate, '상태', plan.status);
  setInfoPair(summary, 11, '공사기간', [plan.projectSnapshot.constructionPeriod?.startDate, plan.projectSnapshot.constructionPeriod?.endDate].filter(Boolean).join(' ~ '), '템플릿', `${plan.templateId} / ${plan.templateVersion}`);
  setInfoPair(summary, 12, '동', plan.projectSnapshot.buildings, '층', plan.projectSnapshot.floors);
  setInfoPair(summary, 13, '구간', plan.projectSnapshot.zones, '비상연락망 확인', plan.projectSnapshot.emergencyContactsComplete);
  styleSectionBar(summary, 15, '데이터 구성 요약');
  setInfoPair(summary, 16, '목차', sections.length, '도면', plan.drawings.length);
  setInfoPair(summary, 17, '장비계획', plan.equipmentPlan.length, '위험성평가', plan.riskAssessments.length);
  setInfoPair(summary, 18, '조직 역할', plan.organizationSnapshot.assignments.length, '도면 주석', plan.drawings.reduce((total, drawing) => total + drawing.annotations.length, 0));
  summary.pageSetup.printArea = 'A1:H18';

  addPlanTableSheet(
    workbook,
    '목차·입력',
    '목차 및 구조화 입력',
    '현재 문서의 목차 순서, 상태와 입력 데이터를 재사용 가능한 형태로 표시',
    ['순서', '목차키', '목차명', '종류', '필수', '상태', '입력 필드', '입력값'],
    sections.flatMap((section, sectionIndex) => {
      const entries = Object.entries(section.content);
      const normalizedEntries = entries.length > 0 ? entries : [['', ''] as [string, unknown]];
      return normalizedEntries.map(([key, value], valueIndex) => [
        valueIndex === 0 ? sectionIndex + 1 : null,
        section.key,
        section.title,
        section.kind,
        section.required ? '필수' : '선택',
        section.status,
        key,
        displayValue(value),
      ]);
    }),
    [8, 23, 30, 20, 10, 14, 24, 48],
  );
  const equipmentSheet = addPlanTableSheet(
    workbook,
    '장비계획',
    '장비사용계획',
    '장비 제원, 작업구간, 담당자와 통제대책',
    ['순서', '분류', '장비명', '모델', '등록번호', '정격용량', '작업반경', '검사유효일', '작업구간', '작업단계', '통제대책'],
    plan.equipmentPlan.map((item, index) => [
      index + 1,
      item.category,
      displayValue(item.equipmentName),
      displayValue(item.model),
      displayValue(item.registrationNo),
      displayValue(item.ratedCapacity),
      displayValue(item.workRadius),
      parseDate(item.inspectionValidUntil) ?? displayValue(item.inspectionValidUntil),
      displayValue(item.workZones),
      displayValue(item.plannedStages),
      displayValue(item.controlMeasures),
    ]),
    [8, 16, 22, 18, 18, 16, 16, 16, 24, 26, 42],
  );
  equipmentSheet.getColumn(8).numFmt = 'yyyy-mm-dd';

  addPlanTableSheet(
    workbook,
    '위험성평가',
    '위험성평가',
    '작업단계별 최초위험, 저감대책과 잔여위험',
    ['순서', '작업단계', '유해·위험요인', '최초 가능성', '최초 중대성', '최초 위험', '저감대책', '잔여 가능성', '잔여 중대성', '잔여 위험', '검토자'],
    plan.riskAssessments.map((item, index) => [
      index + 1,
      displayValue(item.workStage),
      displayValue(item.hazard),
      item.initialProbability ?? null,
      item.initialSeverity ?? null,
      item.initialRiskLevel,
      displayValue(item.mitigationMeasures),
      item.residualProbability ?? null,
      item.residualSeverity ?? null,
      displayValue(item.residualRiskLevel),
      displayValue(item.verifiedBy),
    ]),
    [8, 22, 34, 13, 13, 14, 44, 13, 13, 14, 18],
  );
  const drawingDataSheet = addPlanTableSheet(
    workbook,
    '도면·주석',
    '도면 및 좌표 주석 데이터',
    '원본 도면 정보와 수정 가능한 좌표 기반 구간 표시를 함께 기록',
    ['도면번호', '도면명', '원본파일', 'REV', '승인상태', '페이지', '주석레이어', '주석명', '구간', '시작일', '종료일', '좌표·형상'],
    plan.drawings.flatMap((drawing) => {
      const annotations = drawing.annotations.length > 0 ? drawing.annotations : [undefined];
      return annotations.map((annotation) => [
        displayValue(drawing.drawingNo),
        displayValue(drawing.title),
        displayValue(drawing.originalFileName),
        displayValue(drawing.revision),
        drawing.approvalStatus,
        annotation ? annotation.pageIndex + 1 : drawing.pageCount,
        displayValue(annotation?.layer),
        displayValue(annotation?.label),
        displayValue(annotation?.zoneCode || drawing.zone || drawing.applicableZones),
        parseDate(annotation?.startDate) ?? displayValue(annotation?.startDate),
        parseDate(annotation?.endDate) ?? displayValue(annotation?.endDate),
        annotation ? displayValue(annotation.geometry) : '-',
      ]);
    }),
    [16, 28, 30, 12, 15, 10, 16, 28, 20, 14, 14, 48],
  );
  drawingDataSheet.getColumn(10).numFmt = 'yyyy-mm-dd';
  drawingDataSheet.getColumn(11).numFmt = 'yyyy-mm-dd';

  addPlanTableSheet(
    workbook,
    '조직도',
    '현장 조직 및 책임',
    '역할별 지정 작업자와 책임사항',
    ['순서', '역할', '필수', '성명', '직책', '팀', '연락처', '책임사항', '외부지정', '예외사유'],
    plan.organizationSnapshot.assignments.map((assignment, index) => [
      index + 1,
      assignment.label,
      assignment.required ? '필수' : '선택',
      displayValue(assignment.worker?.name),
      displayValue(assignment.worker?.position || assignment.worker?.role),
      displayValue(assignment.worker?.teamName),
      displayValue(assignment.worker?.contact),
      displayValue(assignment.responsibilities),
      assignment.externalAssignment ? '예' : '아니오',
      displayValue(assignment.exceptionReason),
    ]),
    [8, 20, 10, 18, 18, 20, 18, 38, 12, 38],
  );

  workbook.eachSheet((worksheet) => {
    worksheet.eachRow((row) => row.eachCell((cell) => {
      if (!cell.font?.name) cell.font = { ...cell.font, name: FONT_NAME };
    }));
  });
  return workbook;
};

export const generateConstructionPlanExcel = async (plan: ConstructionPlan): Promise<Blob> => {
  const workbook = await buildConstructionPlanExcelWorkbook(plan);
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
};

export const downloadConstructionPlanExcelBlob = (blob: Blob, fileName: string) => {
  saveAs(blob, fileName);
};

export const downloadReferenceConstructionPlanExcel = async (
  data: ReferenceConstructionPlanExcelInput,
): Promise<void> => {
  const blob = await generateReferenceConstructionPlanExcel(data);
  downloadConstructionPlanExcelBlob(blob, createReferenceConstructionPlanExcelFileName(data.input));
};

export const downloadConstructionPlanExcel = async (plan: ConstructionPlan): Promise<void> => {
  const blob = await generateConstructionPlanExcel(plan);
  downloadConstructionPlanExcelBlob(blob, createConstructionPlanExcelFileName(plan));
};
