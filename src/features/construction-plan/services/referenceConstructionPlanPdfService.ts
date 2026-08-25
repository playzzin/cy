import { PDFDocument, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import {
  countReferenceConstructionPlanPages,
  countReferenceConstructionPlanTocPages,
  getSelectedReferenceSections,
  REFERENCE_CONSTRUCTION_PLAN_SECTIONS,
  REFERENCE_CONSTRUCTION_PLAN_TOC_ITEMS_PER_PAGE,
  type ReferenceConstructionPlanSection,
} from '../domain/referenceConstructionPlanSections';

export const REFERENCE_CONSTRUCTION_PLAN_TEMPLATE_URL =
  '/assets/construction-plan/system-shoring-rev5-template.pdf';
export const REFERENCE_CONSTRUCTION_PLAN_DEFAULT_LOGO_URL =
  '/assets/construction-plan/cheongyeon-rev5-logo.png';
export const REFERENCE_CONSTRUCTION_PLAN_COVER_URL =
  '/assets/construction-plan/system-shoring-rev5-cover.png';
export const REFERENCE_CONSTRUCTION_PLAN_PAGE_COUNT = 42;
export const REFERENCE_CONSTRUCTION_PLAN_DEFAULT_COMPANY = '청연이엔지';
export const REFERENCE_CONSTRUCTION_PLAN_PAGE_HEADER_LAYOUT = {
  pageWidth: 595.28,
  height: 42,
  brand: { x: 455, y: 0, width: 129, height: 42 },
  logoPanel: { x: 459, y: 4, width: 36, height: 34 },
  logo: { x: 461, y: 6, width: 32, height: 30 },
} as const;

export type ReferenceConstructionPlanCoverTemplate = 'blueprint' | 'executive' | 'minimal';

export type ReferenceConstructionPlanInput = {
  siteName: string;
  projectName: string;
  siteAddress?: string;
  clientName?: string;
  contractorName?: string;
  companyName: string;
  documentNo: string;
  revision: number;
  preparedDate: string;
  constructionStartDate?: string;
  constructionEndDate?: string;
  applicationScope: string;
  structuralReviewNo?: string;
  installationDrawingNo?: string;
  buildings?: string;
  floors?: string;
  zones?: string;
  customLogoDataUrl?: string;
  siteMapImageDataUrl?: string;
  siteMapAddress?: string;
  siteMapLink?: string;
  aerialViewDataUrl?: string;
  aerialViewFileName?: string;
  coverTemplate?: ReferenceConstructionPlanCoverTemplate;
};

export type ReferenceConstructionPlanUploadedDrawing = {
  id: string;
  title: string;
  fileName: string;
  bytes: Uint8Array;
  pageCount: number;
  sourceType: 'pdf' | 'image';
  mimeType: 'application/pdf' | 'image/png' | 'image/jpeg';
  pixelWidth?: number;
  pixelHeight?: number;
};

type CanvasContext = CanvasRenderingContext2D;

const PAGE_WIDTH = REFERENCE_CONSTRUCTION_PLAN_PAGE_HEADER_LAYOUT.pageWidth;
const PAGE_HEIGHT = 841.89;
const DRAWING_FRAME_WIDTH = PAGE_WIDTH - 64;
const DRAWING_FRAME_HEIGHT = 688;
const OVERLAY_SCALE = 2.4;
const FONT_FAMILY = '"Malgun Gothic", "Apple SD Gothic Neo", Arial, sans-serif';

export const estimateReferenceDrawingImagePrintDpi = (width: number, height: number): number => {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return 0;
  const pointsPerPixel = Math.min(DRAWING_FRAME_WIDTH / width, DRAWING_FRAME_HEIGHT / height);
  return Math.round(72 / pointsPerPixel);
};

const clean = (value: unknown, fallback = ''): string => {
  const normalized = String(value ?? '').replace(/\s+/g, ' ').trim();
  return normalized || fallback;
};

const dottedDate = (value: string): string => {
  const normalized = clean(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  return match ? `${match[1]}. ${match[2]}. ${match[3]}.` : normalized;
};

const scopeLabel = (input: ReferenceConstructionPlanInput): string => {
  const detailed = [input.buildings, input.floors, input.zones]
    .map((value) => clean(value))
    .filter(Boolean)
    .join(' · ');
  return detailed || clean(input.applicationScope, '지하층 · 저층부 · 기준층 · 특수구간');
};

export const normalizeReferenceConstructionPlanInput = (
  input: ReferenceConstructionPlanInput,
): ReferenceConstructionPlanInput => ({
  siteName: clean(input.siteName, '[현장명 기입]'),
  projectName: clean(
    input.projectName,
    '공동주택(아파트) 신축공사 - 시스템동바리 설치 및 해체공사',
  ),
  siteAddress: clean(input.siteAddress),
  clientName: clean(input.clientName),
  contractorName: clean(input.contractorName),
  companyName: clean(input.companyName, REFERENCE_CONSTRUCTION_PLAN_DEFAULT_COMPANY),
  documentNo: clean(input.documentNo, 'CY-SSP-001'),
  revision: Number.isInteger(input.revision) && input.revision >= 0 ? input.revision : 5,
  preparedDate: clean(input.preparedDate),
  constructionStartDate: clean(input.constructionStartDate),
  constructionEndDate: clean(input.constructionEndDate),
  applicationScope: clean(input.applicationScope, '지하층 · 저층부 · 기준층 · 특수구간'),
  structuralReviewNo: clean(input.structuralReviewNo),
  installationDrawingNo: clean(input.installationDrawingNo),
  buildings: clean(input.buildings),
  floors: clean(input.floors),
  zones: clean(input.zones),
  customLogoDataUrl: clean(input.customLogoDataUrl) || undefined,
  siteMapImageDataUrl: clean(input.siteMapImageDataUrl) || undefined,
  siteMapAddress: clean(input.siteMapAddress) || undefined,
  siteMapLink: clean(input.siteMapLink) || undefined,
  aerialViewDataUrl: clean(input.aerialViewDataUrl) || undefined,
  aerialViewFileName: clean(input.aerialViewFileName) || undefined,
  coverTemplate: ['blueprint', 'executive', 'minimal'].includes(input.coverTemplate ?? '')
    ? input.coverTemplate
    : 'blueprint',
});

export const createReferenceConstructionPlanFileName = (
  input: Pick<ReferenceConstructionPlanInput, 'siteName' | 'companyName' | 'revision'>,
): string => {
  const safe = (value: string, fallback: string) => clean(value, fallback)
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '_')
    .slice(0, 70);
  return `${safe(input.companyName, REFERENCE_CONSTRUCTION_PLAN_DEFAULT_COMPANY)}_${safe(input.siteName, '현장')}_시스템동바리_시공계획서_REV${input.revision}.pdf`;
};

const loadBrowserImage = (source: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('construction-plan-brand-logo-load-failed'));
  image.src = source;
});

const drawContainedImage = (
  context: CanvasContext,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
): void => {
  const ratio = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const renderedWidth = image.naturalWidth * ratio;
  const renderedHeight = image.naturalHeight * ratio;
  context.drawImage(
    image,
    x + ((width - renderedWidth) / 2),
    y + ((height - renderedHeight) / 2),
    renderedWidth,
    renderedHeight,
  );
};

const fittedText = (
  context: CanvasContext,
  value: string,
  x: number,
  centerY: number,
  maxWidth: number,
  options: {
    size?: number;
    minSize?: number;
    weight?: number;
    color?: string;
    align?: CanvasTextAlign;
  } = {},
): void => {
  const text = clean(value, '-');
  const weight = options.weight ?? 500;
  let size = options.size ?? 8.4;
  const minSize = options.minSize ?? 5.4;
  context.textAlign = options.align ?? 'left';
  context.textBaseline = 'middle';
  context.fillStyle = options.color ?? '#263748';
  do {
    context.font = `${weight} ${size}px ${FONT_FAMILY}`;
    if (context.measureText(text).width <= maxWidth || size <= minSize) break;
    size -= 0.25;
  } while (size >= minSize);
  context.fillText(text, x, centerY, maxWidth);
};

const coverCell = (
  context: CanvasContext,
  value: string,
  top: number,
  color = '#dbeafe',
): void => {
  context.fillStyle = '#031a2e';
  context.fillRect(137, top, 417, 26);
  fittedText(context, value, 143, top + 13, 401, {
    size: 10.2,
    minSize: 6.8,
    color,
    weight: 500,
  });
};

const projectCell = (
  context: CanvasContext,
  value: string,
  x: number,
  top: number,
  width: number,
  alternate: boolean,
): void => {
  context.fillStyle = alternate ? '#f0f5f9' : '#ffffff';
  context.fillRect(x, top, width, 24.8);
  fittedText(context, value, x + 5, top + 12.6, width - 10, {
    size: 9.8,
    minSize: 6.4,
    color: '#34495e',
    weight: 500,
  });
};

const drawHeaderBrand = (
  context: CanvasContext,
  input: ReferenceConstructionPlanInput,
  logo: HTMLImageElement,
): void => {
  const { brand, logoPanel, logo: logoBounds } = REFERENCE_CONSTRUCTION_PLAN_PAGE_HEADER_LAYOUT;
  context.save();
  context.beginPath();
  context.rect(brand.x, brand.y, brand.width, brand.height);
  context.clip();
  context.fillStyle = '#061d36';
  context.fillRect(brand.x, brand.y, brand.width, brand.height);
  context.fillStyle = 'rgba(255, 255, 255, 0.96)';
  context.beginPath();
  context.roundRect(logoPanel.x, logoPanel.y, logoPanel.width, logoPanel.height, 5);
  context.fill();
  context.strokeStyle = 'rgba(145, 205, 236, 0.72)';
  context.lineWidth = 0.7;
  context.stroke();
  drawContainedImage(
    context,
    logo,
    logoBounds.x,
    logoBounds.y,
    logoBounds.width,
    logoBounds.height,
  );
  fittedText(context, input.companyName, 501, 21, 76, {
    size: 9.6,
    minSize: 6.4,
    color: '#ffffff',
    weight: 750,
  });
  context.restore();
};

const drawStandardPageHeader = (
  context: CanvasContext,
  input: ReferenceConstructionPlanInput,
  logo: HTMLImageElement,
  kicker: string,
  title: string,
): void => {
  const { height, brand } = REFERENCE_CONSTRUCTION_PLAN_PAGE_HEADER_LAYOUT;
  context.fillStyle = '#061d36';
  context.fillRect(0, 0, PAGE_WIDTH, height);
  context.fillStyle = '#1291d0';
  context.fillRect(0, 0, 9, height);
  fittedText(context, kicker, 28, 9.5, brand.x - 44, {
    size: 5.8,
    minSize: 5.2,
    color: '#9eb8ca',
    weight: 750,
  });
  fittedText(context, title, 28, 28, brand.x - 40, {
    size: 17,
    minSize: 10.5,
    color: '#ffffff',
    weight: 820,
  });
  drawHeaderBrand(context, input, logo);
};

const drawFooterBrand = (context: CanvasContext, input: ReferenceConstructionPlanInput): void => {
  context.fillStyle = '#ffffff';
  context.fillRect(27, 825, 260, 13);
  fittedText(
    context,
    `시스템동바리 시공계획서 | ${input.companyName} | REV.${input.revision}`,
    29,
    832,
    252,
    { size: 6.8, minSize: 5.4, color: '#74879a', weight: 550 },
  );
};

const canvasPngBytes = async (
  draw: (context: CanvasContext) => void | Promise<void>,
): Promise<Uint8Array> => {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(PAGE_WIDTH * OVERLAY_SCALE);
  canvas.height = Math.round(PAGE_HEIGHT * OVERLAY_SCALE);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('construction-plan-overlay-canvas-unavailable');
  context.scale(OVERLAY_SCALE, OVERLAY_SCALE);
  await draw(context);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result);
      else reject(new Error('construction-plan-overlay-png-failed'));
    }, 'image/png');
  });
  return new Uint8Array(await blob.arrayBuffer());
};

const drawBlueprintCover = (
  context: CanvasContext,
  input: ReferenceConstructionPlanInput,
  logo: HTMLImageElement,
  customBranding: boolean,
): void => {
  drawHeaderBrand(context, input, logo);
  if (customBranding) {
    context.fillStyle = '#031a2e';
    context.fillRect(37, 337, 153, 153);
    context.strokeStyle = '#1582bd';
    context.lineWidth = 0.8;
    context.strokeRect(38, 338, 151, 151);
    drawContainedImage(context, logo, 47, 347, 133, 133);
    context.fillStyle = '#07315a';
    context.fillRect(215, 801, 170, 17);
    fittedText(context, input.companyName, 300, 810, 160, {
      size: 6.6,
      minSize: 5,
      color: '#9bdcff',
      weight: 600,
      align: 'center',
    });
  }
  coverCell(context, input.projectName, 554);
  coverCell(context, `${scopeLabel(input)} / 현장 승인도서 적용`, 581);
  coverCell(context, `${input.companyName} (가설안전사업부)`, 609);
  coverCell(context, dottedDate(input.preparedDate), 637);
  coverCell(context, `${input.documentNo} / REV.${input.revision}`, 665, '#bfe9ff');
};

const drawExecutiveCover = (
  context: CanvasContext,
  input: ReferenceConstructionPlanInput,
  logo: HTMLImageElement,
): void => {
  const background = context.createLinearGradient(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
  background.addColorStop(0, '#04182c');
  background.addColorStop(0.62, '#082d4e');
  background.addColorStop(1, '#0b4267');
  context.fillStyle = background;
  context.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);

  context.fillStyle = '#17a9e6';
  context.fillRect(0, 0, 10, PAGE_HEIGHT);
  context.fillStyle = 'rgba(29, 169, 230, 0.08)';
  context.beginPath();
  context.moveTo(330, 0);
  context.lineTo(PAGE_WIDTH, 0);
  context.lineTo(PAGE_WIDTH, 415);
  context.closePath();
  context.fill();
  context.beginPath();
  context.moveTo(0, 610);
  context.lineTo(360, 275);
  context.lineTo(PAGE_WIDTH, 275);
  context.lineTo(PAGE_WIDTH, 475);
  context.lineTo(205, 742);
  context.closePath();
  context.fill();

  context.strokeStyle = 'rgba(108, 207, 255, 0.14)';
  context.lineWidth = 0.65;
  for (let x = 315; x < 690; x += 28) {
    context.beginPath();
    context.moveTo(x, 75);
    context.lineTo(x - 245, 480);
    context.stroke();
  }
  for (let y = 104; y < 480; y += 30) {
    context.beginPath();
    context.moveTo(294, y);
    context.lineTo(PAGE_WIDTH, y);
    context.stroke();
  }

  context.fillStyle = 'rgba(2, 15, 29, 0.72)';
  context.fillRect(420, 22, 145, 66);
  context.strokeStyle = 'rgba(121, 211, 255, 0.48)';
  context.strokeRect(420.5, 22.5, 144, 65);
  drawContainedImage(context, logo, 430, 31, 43, 43);
  fittedText(context, input.companyName, 479, 48, 78, {
    size: 10.5,
    minSize: 6.4,
    color: '#ffffff',
    weight: 750,
  });
  fittedText(context, 'CONSTRUCTION ENGINEERING', 479, 67, 78, {
    size: 4.7,
    minSize: 3.8,
    color: '#79d3ff',
    weight: 600,
  });

  fittedText(context, 'METHOD STATEMENT · REVISION CONTROLLED', 42, 54, 335, {
    size: 7.2,
    minSize: 5,
    color: '#7ed8ff',
    weight: 650,
  });
  context.fillStyle = '#20b4ef';
  context.fillRect(42, 83, 94, 4);
  fittedText(context, 'SYSTEM SHORING', 42, 117, 250, {
    size: 10,
    minSize: 7,
    color: '#b9e9ff',
    weight: 650,
  });
  fittedText(context, '시스템동바리', 42, 166, 430, {
    size: 31,
    minSize: 22,
    color: '#ffffff',
    weight: 800,
  });
  fittedText(context, '시공계획서', 42, 211, 430, {
    size: 31,
    minSize: 22,
    color: '#ffffff',
    weight: 800,
  });
  fittedText(context, '구조안전 · 품질관리 · 정밀시공 · 책임관리', 44, 250, 430, {
    size: 9.8,
    minSize: 7,
    color: '#9ddfff',
    weight: 600,
  });

  context.fillStyle = 'rgba(3, 22, 40, 0.82)';
  context.fillRect(42, 312, 511, 122);
  context.strokeStyle = 'rgba(104, 203, 248, 0.38)';
  context.strokeRect(42.5, 312.5, 510, 121);
  fittedText(context, 'PROJECT', 60, 334, 80, {
    size: 6.4,
    minSize: 5,
    color: '#52c8fa',
    weight: 700,
  });
  fittedText(context, input.projectName, 60, 362, 472, {
    size: 13.4,
    minSize: 8.2,
    color: '#ffffff',
    weight: 700,
  });
  fittedText(context, input.siteName, 60, 394, 472, {
    size: 10.4,
    minSize: 7,
    color: '#d5edf8',
    weight: 550,
  });
  fittedText(context, scopeLabel(input), 60, 416, 472, {
    size: 7.4,
    minSize: 5.6,
    color: '#8fbfd4',
    weight: 500,
  });

  const metrics = [
    ['DOCUMENT NO.', input.documentNo],
    ['REVISION', `REV.${input.revision}`],
    ['DATE', dottedDate(input.preparedDate)],
  ];
  metrics.forEach(([label, value], index) => {
    const x = 42 + (index * 171);
    context.fillStyle = index % 2 === 0 ? 'rgba(6, 35, 61, 0.88)' : 'rgba(9, 47, 78, 0.88)';
    context.fillRect(x, 458, 159, 70);
    context.strokeStyle = 'rgba(92, 193, 240, 0.28)';
    context.strokeRect(x + 0.5, 458.5, 158, 69);
    fittedText(context, label, x + 14, 477, 130, {
      size: 5.8,
      color: '#5acbf9',
      weight: 700,
    });
    fittedText(context, value, x + 14, 505, 130, {
      size: 10.2,
      minSize: 7,
      color: '#ffffff',
      weight: 650,
    });
  });

  context.fillStyle = 'rgba(2, 18, 33, 0.88)';
  context.fillRect(42, 704, 511, 83);
  context.strokeStyle = 'rgba(92, 193, 240, 0.28)';
  context.strokeRect(42.5, 704.5, 510, 82);
  fittedText(context, input.companyName, 60, 731, 210, {
    size: 11,
    minSize: 7,
    color: '#ffffff',
    weight: 750,
  });
  fittedText(context, '가설안전사업부 · CONSTRUCTION SAFETY DIVISION', 60, 754, 300, {
    size: 6.3,
    minSize: 5,
    color: '#8bcde9',
    weight: 550,
  });
  fittedText(context, 'APPROVAL DOCUMENT', 538, 745, 145, {
    size: 6.1,
    minSize: 4.5,
    color: '#56c7f6',
    weight: 700,
    align: 'right',
  });
};

const drawMinimalCover = (
  context: CanvasContext,
  input: ReferenceConstructionPlanInput,
  logo: HTMLImageElement,
): void => {
  context.fillStyle = '#f7f9fb';
  context.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
  context.fillStyle = '#071f36';
  context.fillRect(0, 0, 168, PAGE_HEIGHT);
  context.fillStyle = '#12a9e5';
  context.fillRect(168, 0, 7, PAGE_HEIGHT);

  context.strokeStyle = '#e1e7ed';
  context.lineWidth = 0.55;
  for (let x = 199; x < PAGE_WIDTH; x += 31) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, PAGE_HEIGHT);
    context.stroke();
  }
  for (let y = 0; y < PAGE_HEIGHT; y += 31) {
    context.beginPath();
    context.moveTo(175, y);
    context.lineTo(PAGE_WIDTH, y);
    context.stroke();
  }

  context.fillStyle = '#0d3558';
  context.fillRect(28, 38, 112, 112);
  context.strokeStyle = '#218ac0';
  context.strokeRect(28.5, 38.5, 111, 111);
  drawContainedImage(context, logo, 44, 54, 80, 80);
  fittedText(context, input.companyName, 84, 177, 122, {
    size: 10.5,
    minSize: 6.5,
    color: '#ffffff',
    weight: 750,
    align: 'center',
  });
  fittedText(context, 'METHOD', 84, 260, 128, {
    size: 17,
    minSize: 12,
    color: '#45c5f5',
    weight: 300,
    align: 'center',
  });
  fittedText(context, 'STATEMENT', 84, 287, 128, {
    size: 17,
    minSize: 12,
    color: '#ffffff',
    weight: 750,
    align: 'center',
  });
  context.save();
  context.translate(83, 725);
  context.rotate(-Math.PI / 2);
  fittedText(context, `SYSTEM SHORING · ${input.documentNo} · REV.${input.revision}`, 0, 0, 350, {
    size: 7,
    minSize: 5,
    color: '#7acdf0',
    weight: 600,
    align: 'center',
  });
  context.restore();

  fittedText(context, 'CONSTRUCTION PLAN', 211, 66, 330, {
    size: 7.4,
    minSize: 5,
    color: '#2487b5',
    weight: 700,
  });
  context.fillStyle = '#12a9e5';
  context.fillRect(211, 87, 58, 4);
  fittedText(context, '시스템동바리', 211, 148, 330, {
    size: 26,
    minSize: 19,
    color: '#071f36',
    weight: 800,
  });
  fittedText(context, '시공계획서', 211, 188, 330, {
    size: 26,
    minSize: 19,
    color: '#071f36',
    weight: 800,
  });
  fittedText(context, 'SYSTEM SHORING METHOD STATEMENT', 213, 224, 330, {
    size: 8,
    minSize: 5.8,
    color: '#5f7484',
    weight: 550,
  });

  context.fillStyle = 'rgba(255, 255, 255, 0.94)';
  context.fillRect(211, 300, 334, 142);
  context.strokeStyle = '#cbd8e2';
  context.strokeRect(211.5, 300.5, 333, 141);
  fittedText(context, 'PROJECT INFORMATION', 230, 324, 285, {
    size: 6.4,
    color: '#2298ca',
    weight: 700,
  });
  fittedText(context, input.projectName, 230, 356, 295, {
    size: 12,
    minSize: 7.5,
    color: '#102f47',
    weight: 700,
  });
  fittedText(context, input.siteName, 230, 389, 295, {
    size: 9.2,
    minSize: 6.4,
    color: '#405d72',
    weight: 550,
  });
  fittedText(context, scopeLabel(input), 230, 418, 295, {
    size: 7,
    minSize: 5.4,
    color: '#698090',
    weight: 500,
  });

  const detailRows = [
    ['문서번호', input.documentNo],
    ['개정번호', `REV.${input.revision}`],
    ['작성일자', dottedDate(input.preparedDate)],
    ['시공사', input.companyName],
  ];
  detailRows.forEach(([label, value], index) => {
    const y = 495 + (index * 47);
    context.fillStyle = index % 2 === 0 ? '#edf3f7' : '#ffffff';
    context.fillRect(211, y, 334, 39);
    context.fillStyle = '#0b3556';
    context.fillRect(211, y, 82, 39);
    fittedText(context, label, 252, y + 20, 70, {
      size: 7,
      color: '#dff4ff',
      weight: 650,
      align: 'center',
    });
    fittedText(context, value, 308, y + 20, 219, {
      size: 8.8,
      minSize: 6.2,
      color: '#203d52',
      weight: 600,
    });
  });

  context.fillStyle = '#071f36';
  context.fillRect(211, 745, 334, 42);
  fittedText(context, '구조안전 · 품질관리 · 정밀시공 · 책임관리', 228, 766, 300, {
    size: 7.4,
    minSize: 5.8,
    color: '#ffffff',
    weight: 600,
  });
};

const buildCoverOverlay = async (
  input: ReferenceConstructionPlanInput,
  logo: HTMLImageElement,
  customBranding: boolean,
): Promise<Uint8Array> => canvasPngBytes((context) => {
  if (input.coverTemplate === 'executive') {
    drawExecutiveCover(context, input, logo);
    return;
  }
  if (input.coverTemplate === 'minimal') {
    drawMinimalCover(context, input, logo);
    return;
  }
  drawBlueprintCover(context, input, logo, customBranding);
});

const buildDocumentControlOverlay = async (
  input: ReferenceConstructionPlanInput,
  logo: HTMLImageElement,
  customBranding: boolean,
): Promise<Uint8Array> => canvasPngBytes((context) => {
  drawHeaderBrand(context, input, logo);
  drawFooterBrand(context, input);
  if (customBranding) {
  }
  const leftX = 130;
  const leftWidth = 194.5;
  const rightX = 430;
  const rightWidth = 134.5;
  const rows = [194, 219, 244, 269, 294];
  projectCell(context, input.siteName, leftX, rows[0], leftWidth, false);
  projectCell(context, input.documentNo, rightX, rows[0], rightWidth, false);
  projectCell(context, input.projectName, leftX, rows[1], leftWidth, true);
  projectCell(context, String(input.revision), rightX, rows[1], rightWidth, true);
  projectCell(
    context,
    [input.clientName, input.contractorName].filter(Boolean).join(' / ') || '[기입]',
    leftX,
    rows[2],
    leftWidth,
    false,
  );
  projectCell(context, dottedDate(input.preparedDate), rightX, rows[2], rightWidth, false);
  projectCell(context, input.companyName, leftX, rows[3], leftWidth, true);
  projectCell(context, scopeLabel(input), rightX, rows[3], rightWidth, true);
  projectCell(context, input.structuralReviewNo || '[기입]', leftX, rows[4], leftWidth, false);
  projectCell(context, input.installationDrawingNo || '[기입]', rightX, rows[4], rightWidth, false);
});

const buildCommonBrandOverlay = async (
  input: ReferenceConstructionPlanInput,
  logo: HTMLImageElement,
): Promise<Uint8Array> => canvasPngBytes((context) => {
  drawHeaderBrand(context, input, logo);
  drawFooterBrand(context, input);
});

const drawSiteVisualPanel = (
  context: CanvasContext,
  title: string,
  helper: string,
  image: HTMLImageElement | undefined,
  x: number,
  y: number,
  width: number,
  height: number,
): void => {
  context.fillStyle = '#ffffff';
  context.strokeStyle = '#d4e0e9';
  context.lineWidth = 0.8;
  context.beginPath();
  context.roundRect(x, y, width, height, 8);
  context.fill();
  context.stroke();
  context.fillStyle = '#e9f5fa';
  context.beginPath();
  context.roundRect(x + 1, y + 1, width - 2, 43, [7, 7, 0, 0]);
  context.fill();
  fittedText(context, title, x + 15, y + 18, width - 30, {
    size: 11.2,
    minSize: 8.2,
    color: '#123e5b',
    weight: 800,
  });
  fittedText(context, helper, x + 15, y + 33, width - 30, {
    size: 6.2,
    minSize: 5.2,
    color: '#698496',
    weight: 600,
  });
  const imageX = x + 12;
  const imageY = y + 55;
  const imageWidth = width - 24;
  const imageHeight = height - 67;
  context.fillStyle = '#f3f7fa';
  context.fillRect(imageX, imageY, imageWidth, imageHeight);
  if (image) {
    drawContainedImage(context, image, imageX, imageY, imageWidth, imageHeight);
  } else {
    fittedText(context, '등록된 이미지가 없습니다.', x + (width / 2), imageY + (imageHeight / 2), imageWidth - 40, {
      size: 9,
      minSize: 9,
      color: '#8a9ba8',
      weight: 650,
      align: 'center',
    });
  }
};

const buildSiteVisualsOverlay = async (
  input: ReferenceConstructionPlanInput,
  logo: HTMLImageElement,
  mapImage?: HTMLImageElement,
): Promise<Uint8Array> => canvasPngBytes((context) => {
  context.fillStyle = '#f4f8fb';
  context.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
  drawStandardPageHeader(context, input, logo, 'SITE INFORMATION', '현장 위치 지도');
  context.fillStyle = '#e8f5fc';
  context.beginPath();
  context.roundRect(24, 106, 547, 44, 8);
  context.fill();
  fittedText(context, '현장주소', 38, 128, 52, {
    size: 7.2,
    minSize: 7.2,
    color: '#1178aa',
    weight: 850,
  });
  fittedText(context, input.siteAddress || '-', 99, 128, 455, {
    size: 10.2,
    minSize: 7.2,
    color: '#173b57',
    weight: 750,
  });
  drawSiteVisualPanel(
    context,
    'Google 지도 · 현장 위치',
    '입력한 현장주소를 기준으로 생성한 지도입니다.',
    mapImage,
    24,
    164,
    547,
    632,
  );
  drawFooterBrand(context, input);
});

type TocItemLayout = {
  id: string;
  title: string;
  englishTitle: string;
  sourceLabel: string;
  kind: 'site-visuals' | 'standard' | 'uploaded-drawing';
  outputOrder: number;
  outputStartPage: number;
  outputEndPage: number;
};

const buildTocLayout = (
  sections: ReferenceConstructionPlanSection[],
  drawings: ReferenceConstructionPlanUploadedDrawing[],
  firstContentPage: number,
  includeSiteVisuals = false,
  hasSiteMap = false,
): TocItemLayout[] => {
  let outputPage = firstContentPage;
  const items: TocItemLayout[] = [];
  if (includeSiteVisuals) {
    items.push({
      id: 'site-visuals',
      title: '현장 위치 지도',
      englishTitle: 'SITE LOCATION MAP',
      sourceLabel: hasSiteMap ? '지도 등록' : '지도 미등록',
      kind: 'site-visuals',
      outputOrder: 1,
      outputStartPage: 3,
      outputEndPage: 3,
    });
  }
  sections.forEach((current) => {
    items.push({
      id: current.id,
      title: current.title,
      englishTitle: current.englishTitle,
      sourceLabel:
        current.sourcePages.length > 1
          ? `원본 ${current.sourcePages[0]}-${current.sourcePages[current.sourcePages.length - 1]}쪽`
          : `원본 ${current.sourcePages[0]}쪽`,
      kind: 'standard',
      outputOrder: items.length + 1,
      outputStartPage: outputPage,
      outputEndPage: outputPage + current.sourcePages.length - 1,
    });
    outputPage += current.sourcePages.length;
  });
  drawings.forEach((drawing) => {
    Array.from({ length: drawing.pageCount }, (_, pageIndex) => pageIndex).forEach((pageIndex) => {
      items.push({
        id: `${drawing.id}-page-${pageIndex + 1}`,
        title: drawing.pageCount > 1 ? `${drawing.title} (${pageIndex + 1}/${drawing.pageCount})` : drawing.title,
        englishTitle: drawing.fileName,
        sourceLabel: drawing.sourceType === 'image' ? '업로드 사진' : '업로드 PDF 도면',
        kind: 'uploaded-drawing',
        outputOrder: items.length + 1,
        outputStartPage: outputPage,
        outputEndPage: outputPage,
      });
      outputPage += 1;
    });
  });
  return items;
};

const drawTocCard = (
  context: CanvasContext,
  item: TocItemLayout,
  x: number,
  y: number,
  width: number,
): void => {
  const isSiteVisuals = item.kind === 'site-visuals';
  context.fillStyle = isSiteVisuals ? '#e9f8f5' : '#ffffff';
  context.strokeStyle = isSiteVisuals ? '#55ad9a' : '#d5e0e9';
  context.lineWidth = 0.8;
  context.beginPath();
  context.roundRect(x, y, width, 49, 6);
  context.fill();
  context.stroke();
  context.fillStyle = isSiteVisuals ? '#11846e' : '#08375f';
  context.beginPath();
  context.roundRect(x + 8, y + 8, 31, 31, 7);
  context.fill();
  fittedText(context, String(item.outputOrder).padStart(2, '0'), x + 23.5, y + 24, 25, {
    size: 9.2,
    minSize: 9.2,
    color: '#ffffff',
    weight: 800,
    align: 'center',
  });
  fittedText(context, item.title, x + 49, y + 18, width - 93, {
    size: 9.4,
    minSize: 6.4,
    color: '#20384e',
    weight: 750,
  });
  fittedText(context, `${item.sourceLabel} · ${item.englishTitle}`, x + 49, y + 34, width - 93, {
    size: 5.8,
    minSize: 4.8,
    color: '#8a9aaa',
    weight: 600,
  });
  const pageLabel = item.outputStartPage === item.outputEndPage
    ? String(item.outputStartPage)
    : `${item.outputStartPage}-${item.outputEndPage}`;
  fittedText(context, pageLabel, x + width - 13, y + 24, 30, {
    size: 8.5,
    minSize: 7,
    color: '#1876a6',
    weight: 800,
    align: 'right',
  });
};

const buildSelectedTocOverlay = async (
  input: ReferenceConstructionPlanInput,
  logo: HTMLImageElement,
  allItems: TocItemLayout[],
  tocPageIndex: number,
  tocPageCount: number,
  tocPageNumber: number,
  totalPageCount: number,
): Promise<Uint8Array> => canvasPngBytes((context) => {
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
  drawStandardPageHeader(context, input, logo, 'DOCUMENT', '선택 목차 · Visual Index');

  const itemStart = tocPageIndex * REFERENCE_CONSTRUCTION_PLAN_TOC_ITEMS_PER_PAGE;
  const items = allItems.slice(
    itemStart,
    itemStart + REFERENCE_CONSTRUCTION_PLAN_TOC_ITEMS_PER_PAGE,
  );
  const firstOrder = items[0]?.outputOrder;
  const lastOrder = items[items.length - 1]?.outputOrder;
  context.fillStyle = '#e8f5fc';
  context.beginPath();
  context.roundRect(24, 108, 547, 38, 8);
  context.fill();
  fittedText(context, `ORDER ${String(tocPageIndex + 1).padStart(2, '0')}`, 36, 127, 64, {
    size: 7.8,
    minSize: 7.8,
    color: '#1178aa',
    weight: 850,
  });
  fittedText(context, '선택 목차 및 업로드 도면', 106, 127, 320, {
    size: 12.8,
    minSize: 11,
    color: '#173b57',
    weight: 800,
  });
  fittedText(context, items.length > 0 ? `${firstOrder}~${lastOrder}번 · ${items.length}개` : '선택 항목 없음', 552, 127, 150, {
    size: 8,
    minSize: 7,
    color: '#58758b',
    weight: 700,
    align: 'right',
  });

  if (items.length === 0) {
    fittedText(context, '이 그룹에서 선택한 목차가 없습니다.', PAGE_WIDTH / 2, 390, 430, {
      size: 11,
      minSize: 11,
      color: '#8a99a8',
      weight: 650,
      align: 'center',
    });
  } else {
    const columns = 2;
    const rowsPerColumn = 9;
    const cardWidth = 263;
    items.forEach((item, index) => {
      const column = Math.floor(index / rowsPerColumn);
      const row = index % rowsPerColumn;
      if (column >= columns) return;
      drawTocCard(context, item, 24 + (column * 283), 160 + (row * 55), cardWidth);
    });
  }

  context.fillStyle = '#f3f8fb';
  context.beginPath();
  context.roundRect(24, 734, 547, 62, 8);
  context.fill();
  fittedText(context, '선택 구성 안내', 37, 754, 110, {
    size: 7,
    minSize: 7,
    color: '#176d96',
    weight: 800,
  });
  fittedText(
    context,
    `목차 ${allItems.length}개를 ${tocPageCount}쪽에 나누어 표시하고 총 ${totalPageCount}쪽으로 구성했습니다.`,
    37,
    776,
    515,
    { size: 6.4, minSize: 5.2, color: '#5c7182', weight: 550 },
  );
  fittedText(context, `${tocPageNumber} / ${totalPageCount}`, 567, 828, 60, {
    size: 5.8,
    minSize: 5.8,
    color: '#536b7e',
    weight: 750,
    align: 'right',
  });
});

const buildUploadedDrawingOverlay = async (
  input: ReferenceConstructionPlanInput,
  logo: HTMLImageElement,
  title: string,
  fileName: string,
  sourcePageNumber: number,
  sourcePageCount: number,
  sourceType: ReferenceConstructionPlanUploadedDrawing['sourceType'],
): Promise<Uint8Array> => canvasPngBytes((context) => {
  drawStandardPageHeader(
    context,
    input,
    logo,
    sourceType === 'image' ? 'UPLOADED PHOTO DRAWING' : 'UPLOADED PDF DRAWING',
    sourcePageCount > 1 ? `${title} (${sourcePageNumber}/${sourcePageCount})` : title,
  );
  fittedText(context, fileName, 28, 66, PAGE_WIDTH - 56, {
    size: 6.2,
    minSize: 5.2,
    color: '#61788b',
    weight: 550,
  });
  context.strokeStyle = '#b9cddd';
  context.lineWidth = 0.8;
  context.strokeRect(24, 96, PAGE_WIDTH - 48, 704);
  drawFooterBrand(context, input);
});

const fetchTemplateBytes = async (): Promise<ArrayBuffer> => {
  const response = await fetch(REFERENCE_CONSTRUCTION_PLAN_TEMPLATE_URL, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`construction-plan-reference-template-load-failed:${response.status}`);
  }
  return response.arrayBuffer();
};

export const generateReferenceConstructionPlanPdf = async (
  rawInput: ReferenceConstructionPlanInput,
  selectedSectionIds?: string[],
  uploadedDrawings: ReferenceConstructionPlanUploadedDrawing[] = [],
  sectionCatalog: readonly ReferenceConstructionPlanSection[] = REFERENCE_CONSTRUCTION_PLAN_SECTIONS,
): Promise<Blob> => {
  const input = normalizeReferenceConstructionPlanInput(rawInput);
  const templateBytes = await fetchTemplateBytes();
  const sourceDocument = await PDFDocument.load(templateBytes, { ignoreEncryption: true });
  if (sourceDocument.getPageCount() !== REFERENCE_CONSTRUCTION_PLAN_PAGE_COUNT) {
    throw new Error('construction-plan-reference-template-page-count-mismatch');
  }
  const selectedSections = getSelectedReferenceSections(selectedSectionIds, sectionCatalog);
  const loadedDrawings = await Promise.all(uploadedDrawings.map(async (drawing) => {
    if (drawing.sourceType === 'image') {
      if (!['image/png', 'image/jpeg'].includes(drawing.mimeType)) {
        throw new Error('construction-plan-drawing-image-type-invalid');
      }
      return {
        ...drawing,
        title: clean(drawing.title, drawing.fileName.replace(/\.(png|jpe?g|webp)$/i, '')),
        fileName: clean(drawing.fileName, 'uploaded-drawing-image'),
        pageCount: 1,
        document: undefined,
      };
    }
    const drawingDocument = await PDFDocument.load(drawing.bytes, { ignoreEncryption: true });
    const pageCount = drawingDocument.getPageCount();
    if (pageCount === 0) throw new Error('construction-plan-drawing-pdf-empty');
    return {
      ...drawing,
      title: clean(drawing.title, drawing.fileName.replace(/\.pdf$/i, '')),
      fileName: clean(drawing.fileName, 'uploaded-drawing.pdf'),
      pageCount,
      sourceType: 'pdf' as const,
      mimeType: 'application/pdf' as const,
      document: drawingDocument,
    };
  }));
  const uploadedDrawingPageCount = loadedDrawings.reduce(
    (total, drawing) => total + drawing.pageCount,
    0,
  );
  if (selectedSections.length === 0 && uploadedDrawingPageCount === 0) {
    throw new Error('construction-plan-reference-no-sections-selected');
  }
  const tocPageCount = countReferenceConstructionPlanTocPages(
    selectedSectionIds,
    uploadedDrawingPageCount,
    sectionCatalog,
    input.siteAddress ? 1 : 0,
  );
  const siteVisualPageCount = input.siteAddress ? 1 : 0;
  const totalPageCount = countReferenceConstructionPlanPages(
    selectedSectionIds,
    uploadedDrawingPageCount,
    sectionCatalog,
    siteVisualPageCount,
    siteVisualPageCount,
  );
  const document = await PDFDocument.create();
  const fixedPages = await document.copyPages(sourceDocument, [0, 1]);
  fixedPages.forEach((page) => document.addPage(page));
  if (siteVisualPageCount > 0) document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  Array.from({ length: tocPageCount }).forEach(() => document.addPage([PAGE_WIDTH, PAGE_HEIGHT]));
  const selectedSourceIndices = selectedSections
    .flatMap(({ sourcePages }) => sourcePages.map((pageNumber) => pageNumber - 1));
  const selectedPages = await document.copyPages(sourceDocument, selectedSourceIndices);
  selectedPages.forEach((page) => document.addPage(page));

  const renderedDrawingPages: Array<{
    page: PDFPage;
    title: string;
    fileName: string;
    sourcePageNumber: number;
    sourcePageCount: number;
    sourceType: ReferenceConstructionPlanUploadedDrawing['sourceType'];
  }> = [];
  for (const drawing of loadedDrawings) {
    if (drawing.sourceType === 'image') {
      const embeddedImage = drawing.mimeType === 'image/jpeg'
        ? await document.embedJpg(drawing.bytes)
        : await document.embedPng(drawing.bytes);
      const page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      const scale = Math.min(
        DRAWING_FRAME_WIDTH / embeddedImage.width,
        DRAWING_FRAME_HEIGHT / embeddedImage.height,
      );
      const renderedWidth = embeddedImage.width * scale;
      const renderedHeight = embeddedImage.height * scale;
      page.drawImage(embeddedImage, {
        x: (PAGE_WIDTH - renderedWidth) / 2,
        y: 50 + ((DRAWING_FRAME_HEIGHT - renderedHeight) / 2),
        width: renderedWidth,
        height: renderedHeight,
      });
      renderedDrawingPages.push({
        page,
        title: drawing.title,
        fileName: drawing.fileName,
        sourcePageNumber: 1,
        sourcePageCount: 1,
        sourceType: 'image',
      });
      continue;
    }
    const sourcePages = drawing.document?.getPages() ?? [];
    for (let pageIndex = 0; pageIndex < sourcePages.length; pageIndex += 1) {
      const embeddedPage = await document.embedPage(sourcePages[pageIndex]);
      const page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      const scale = Math.min(
        DRAWING_FRAME_WIDTH / embeddedPage.width,
        DRAWING_FRAME_HEIGHT / embeddedPage.height,
      );
      const renderedWidth = embeddedPage.width * scale;
      const renderedHeight = embeddedPage.height * scale;
      page.drawPage(embeddedPage, {
        x: (PAGE_WIDTH - renderedWidth) / 2,
        y: 50 + ((DRAWING_FRAME_HEIGHT - renderedHeight) / 2),
        width: renderedWidth,
        height: renderedHeight,
      });
      renderedDrawingPages.push({
        page,
        title: drawing.title,
        fileName: drawing.fileName,
        sourcePageNumber: pageIndex + 1,
        sourcePageCount: drawing.pageCount,
        sourceType: 'pdf',
      });
    }
  }

  const customBranding = Boolean(
    input.customLogoDataUrl
    || input.companyName !== REFERENCE_CONSTRUCTION_PLAN_DEFAULT_COMPANY,
  );
  const logo = await loadBrowserImage(
    input.customLogoDataUrl || REFERENCE_CONSTRUCTION_PLAN_DEFAULT_LOGO_URL,
  );
  const siteMapImage = input.siteMapImageDataUrl
    ? await loadBrowserImage(input.siteMapImageDataUrl)
    : undefined;
  const coverOverlay = await document.embedPng(await buildCoverOverlay(input, logo, customBranding));
  const controlOverlay = await document.embedPng(
    await buildDocumentControlOverlay(input, logo, customBranding),
  );
  const commonBrandOverlay = await document.embedPng(await buildCommonBrandOverlay(input, logo));
  const siteVisualsOverlay = siteVisualPageCount > 0
    ? await document.embedPng(await buildSiteVisualsOverlay(input, logo, siteMapImage))
    : undefined;
  const tocLayout = buildTocLayout(
    selectedSections,
    loadedDrawings,
    3 + siteVisualPageCount + tocPageCount,
    siteVisualPageCount > 0,
    Boolean(input.siteMapImageDataUrl),
  );
  for (let tocPageIndex = 0; tocPageIndex < tocPageCount; tocPageIndex += 1) {
    const tocOverlay = await document.embedPng(await buildSelectedTocOverlay(
      input,
      logo,
      tocLayout,
      tocPageIndex,
      tocPageCount,
      tocPageIndex + 3 + siteVisualPageCount,
      totalPageCount,
    ));
    document.getPage(tocPageIndex + 2 + siteVisualPageCount).drawImage(tocOverlay, {
      x: 0,
      y: 0,
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT,
    });
  }

  document.getPage(0).drawImage(coverOverlay, {
    x: 0,
    y: 0,
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
  });
  document.getPage(1).drawImage(controlOverlay, {
    x: 0,
    y: 0,
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
  });
  if (siteVisualsOverlay) {
    document.getPage(2).drawImage(siteVisualsOverlay, {
      x: 0,
      y: 0,
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT,
    });
  }
  const standardPageStartIndex = 2 + siteVisualPageCount;
  const standardPageEndIndex = standardPageStartIndex + tocPageCount + selectedPages.length;
  document.getPages().slice(standardPageStartIndex, standardPageEndIndex).forEach((page) => page.drawImage(commonBrandOverlay, {
    x: 0,
    y: 0,
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
  }));
  for (const drawingPage of renderedDrawingPages) {
    const drawingOverlay = await document.embedPng(await buildUploadedDrawingOverlay(
      input,
      logo,
      drawingPage.title,
      drawingPage.fileName,
      drawingPage.sourcePageNumber,
      drawingPage.sourcePageCount,
      drawingPage.sourceType,
    ));
    drawingPage.page.drawImage(drawingOverlay, {
      x: 0,
      y: 0,
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT,
    });
  }
  const pageNumberFont = await document.embedFont(StandardFonts.Helvetica);
  document.getPages().slice(1).forEach((page, index) => {
    page.drawRectangle({ x: 540, y: 4, width: 45, height: 16, color: rgb(1, 1, 1) });
    page.drawText(`${index + 2}/${totalPageCount}`, {
      x: 552,
      y: 8,
      size: 6.4,
      font: pageNumberFont,
      color: rgb(0.25, 0.34, 0.42),
    });
  });

  document.setTitle(`${input.siteName} 시스템동바리 시공계획서 REV.${input.revision}`);
  document.setAuthor(input.companyName);
  document.setSubject(`${input.projectName} 시스템동바리 설치 및 해체 시공계획`);
  document.setKeywords([
    '시스템동바리', '시공계획서', input.siteName, input.companyName,
    input.documentNo, `REV.${input.revision}`, `선택목차 ${selectedSections.length}개`,
    `업로드도면 ${uploadedDrawingPageCount}장`,
  ]);
  document.setProducer(`${input.companyName} 시공계획서 제작 시스템`);
  document.setCreator(`${input.companyName} 시공계획서 제작 시스템`);
  document.setModificationDate(new Date());

  const bytes = await document.save({ useObjectStreams: false, addDefaultPage: false });
  return new Blob([bytes as BlobPart], { type: 'application/pdf' });
};

export const readReferenceDrawingPdfFile = async (
  file: File,
): Promise<Omit<ReferenceConstructionPlanUploadedDrawing, 'id'>> => {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    throw new Error('construction-plan-drawing-file-type-invalid');
  }
  if (file.size > 50 * 1024 * 1024) {
    throw new Error('construction-plan-drawing-file-size-invalid');
  }
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const document = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const pageCount = document.getPageCount();
    if (pageCount === 0) throw new Error('construction-plan-drawing-pdf-empty');
    return {
      title: clean(file.name.replace(/\.pdf$/i, ''), '업로드 도면'),
      fileName: file.name,
      bytes,
      pageCount,
      sourceType: 'pdf',
      mimeType: 'application/pdf',
    };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('construction-plan-')) throw error;
    throw new Error('construction-plan-drawing-pdf-invalid');
  }
};

const REFERENCE_DRAWING_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
const REFERENCE_DRAWING_IMAGE_MAX_BYTES = 20 * 1024 * 1024;
const REFERENCE_DRAWING_IMAGE_MAX_PIXELS = 48_000_000;

const loadReferenceDrawingImage = (file: File): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
  const previewUrl = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    URL.revokeObjectURL(previewUrl);
    resolve(image);
  };
  image.onerror = () => {
    URL.revokeObjectURL(previewUrl);
    reject(new Error('construction-plan-drawing-image-invalid'));
  };
  image.src = previewUrl;
});

const canvasToDrawingBytes = (
  canvas: HTMLCanvasElement,
  mimeType: 'image/png' | 'image/jpeg',
): Promise<Uint8Array> => new Promise((resolve, reject) => {
  canvas.toBlob(async (blob) => {
    if (!blob) {
      reject(new Error('construction-plan-drawing-image-convert-failed'));
      return;
    }
    resolve(new Uint8Array(await blob.arrayBuffer()));
  }, mimeType, mimeType === 'image/jpeg' ? 0.94 : undefined);
});

export const readReferenceDrawingImageFile = async (
  file: File,
): Promise<Omit<ReferenceConstructionPlanUploadedDrawing, 'id'>> => {
  const extension = file.name.toLowerCase().split('.').pop();
  const detectedType = file.type || (
    extension === 'png' ? 'image/png'
      : extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg'
        : extension === 'webp' ? 'image/webp'
          : ''
  );
  if (!REFERENCE_DRAWING_IMAGE_TYPES.includes(detectedType as typeof REFERENCE_DRAWING_IMAGE_TYPES[number])) {
    throw new Error('construction-plan-drawing-image-type-invalid');
  }
  if (file.size > REFERENCE_DRAWING_IMAGE_MAX_BYTES) {
    throw new Error('construction-plan-drawing-image-size-invalid');
  }
  const image = await loadReferenceDrawingImage(file);
  if (!image.naturalWidth || !image.naturalHeight) {
    throw new Error('construction-plan-drawing-image-invalid');
  }
  if (image.naturalWidth * image.naturalHeight > REFERENCE_DRAWING_IMAGE_MAX_PIXELS) {
    throw new Error('construction-plan-drawing-image-dimensions-invalid');
  }
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('construction-plan-drawing-image-convert-failed');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const normalizedMimeType: 'image/png' | 'image/jpeg' = detectedType === 'image/jpeg'
    ? 'image/jpeg'
    : 'image/png';
  const bytes = await canvasToDrawingBytes(canvas, normalizedMimeType);
  return {
    title: clean(file.name.replace(/\.(png|jpe?g|webp)$/i, ''), '업로드 사진 도면'),
    fileName: file.name,
    bytes,
    pageCount: 1,
    sourceType: 'image',
    mimeType: normalizedMimeType,
    pixelWidth: canvas.width,
    pixelHeight: canvas.height,
  };
};

export const readReferenceDrawingFile = async (
  file: File,
): Promise<Omit<ReferenceConstructionPlanUploadedDrawing, 'id'>> => {
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    return readReferenceDrawingPdfFile(file);
  }
  return readReferenceDrawingImageFile(file);
};

export const readReferenceSiteImageAsDataUrl = async (file: File): Promise<string> => {
  const image = await readReferenceDrawingImageFile(file);
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error('construction-plan-site-image-read-failed'));
    reader.onerror = () => reject(new Error('construction-plan-site-image-read-failed'));
    reader.readAsDataURL(new Blob([image.bytes as BlobPart], { type: image.mimeType }));
  });
};

export const readLogoFileAsDataUrl = async (file: File): Promise<string> => {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    throw new Error('construction-plan-logo-file-type-invalid');
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('construction-plan-logo-file-size-invalid');
  }
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error('construction-plan-logo-file-read-failed'));
    reader.onerror = () => reject(new Error('construction-plan-logo-file-read-failed'));
    reader.readAsDataURL(file);
  });
};
