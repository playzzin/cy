import html2canvas from 'html2canvas';
import {
  normalizePdfFileName,
  sanitizePdfAuditText,
  sha256Hex,
  writeA4RasterPdf,
  type A4RasterPdfPage,
} from './a4RasterPdfWriter';

export const CONSTRUCTION_PLAN_PDF_PAGE_COUNT = 42;
export const CONSTRUCTION_PLAN_PDF_MIN_PHYSICAL_PAGE_COUNT = CONSTRUCTION_PLAN_PDF_PAGE_COUNT;
export const CONSTRUCTION_PLAN_PDF_MAX_PHYSICAL_PAGE_COUNT = 200;
export const CONSTRUCTION_PLAN_PDF_RENDERER_VERSION = 'field-use-a4-v3';

export type ConstructionPlanPdfProfile = 'draft' | 'issued-candidate';

export type ConstructionPlanPdfProgressStage =
  | 'preparing'
  | 'rendering'
  | 'assembling'
  | 'hashing'
  | 'complete';

export type ConstructionPlanPdfProgress = {
  stage: ConstructionPlanPdfProgressStage;
  currentPage: number;
  totalPages: number;
  percent: number;
  message: string;
};

export type ConstructionPlanPdfAudit = {
  planId: string;
  documentNo: string;
  revision: number | string;
  templateVersion: string;
  snapshotHash?: string;
};

export type GenerateConstructionPlanPdfOptions = {
  container: HTMLElement;
  fileName?: string;
  profile?: ConstructionPlanPdfProfile;
  captureScale?: number;
  jpegQuality?: number;
  audit?: ConstructionPlanPdfAudit;
  signal?: AbortSignal;
  onProgress?: (progress: ConstructionPlanPdfProgress) => void;
};

export type ConstructionPlanPdfResult = {
  blob: Blob;
  sha256: string;
  pageCount: number;
  byteLength: number;
  fileName: string;
  profile: ConstructionPlanPdfProfile;
  rendererVersion: typeof CONSTRUCTION_PLAN_PDF_RENDERER_VERSION;
};

export type ConstructionPlanPdfErrorCode =
  | 'PAGE_COUNT_MISMATCH'
  | 'ABORTED'
  | 'CAPTURE_FAILED'
  | 'JPEG_ENCODING_FAILED'
  | 'PDF_ASSEMBLY_FAILED';

export class ConstructionPlanPdfError extends Error {
  readonly code: ConstructionPlanPdfErrorCode;
  readonly pageNumber?: number;
  readonly cause?: unknown;

  constructor(
    code: ConstructionPlanPdfErrorCode,
    message: string,
    options: { pageNumber?: number; cause?: unknown } = {},
  ) {
    super(message);
    this.name = 'ConstructionPlanPdfError';
    this.code = code;
    this.pageNumber = options.pageNumber;
    this.cause = options.cause;
    Object.setPrototypeOf(this, ConstructionPlanPdfError.prototype);
  }
}

const assertNotAborted = (signal?: AbortSignal): void => {
  if (signal?.aborted) {
    throw new ConstructionPlanPdfError('ABORTED', 'PDF 생성이 취소되었습니다.');
  }
};

const reportProgress = (
  callback: GenerateConstructionPlanPdfOptions['onProgress'],
  progress: ConstructionPlanPdfProgress,
): void => {
  callback?.(progress);
};

const waitForDocumentAssets = async (container: HTMLElement, signal?: AbortSignal): Promise<void> => {
  assertNotAborted(signal);
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    await document.fonts.ready;
  }
  assertNotAborted(signal);

  const images = Array.from(container.querySelectorAll<HTMLImageElement>('img'));
  await Promise.all(images.map(async (image) => {
    if (image.complete && image.naturalWidth > 0) return;
    if (typeof image.decode === 'function') {
      try {
        await image.decode();
      } catch {
        // html2canvas reports the actionable capture failure if decoding remains impossible.
      }
    }
  }));
  assertNotAborted(signal);
};

const canvasToJpegPage = (
  canvas: HTMLCanvasElement,
  quality: number,
  pageNumber: number,
  auditText?: string,
  searchText?: string,
): Promise<A4RasterPdfPage> => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => {
    if (!blob || blob.type !== 'image/jpeg') {
      reject(new ConstructionPlanPdfError(
        'JPEG_ENCODING_FAILED',
        `${pageNumber}페이지를 JPEG로 변환하지 못했습니다.`,
        { pageNumber },
      ));
      return;
    }
    blob.arrayBuffer()
      .then((buffer) => resolve({
        jpegBytes: new Uint8Array(buffer),
        width: canvas.width,
        height: canvas.height,
        auditText,
        searchText,
      }))
      .catch((cause) => reject(new ConstructionPlanPdfError(
        'JPEG_ENCODING_FAILED',
        `${pageNumber}페이지 JPEG 데이터를 읽지 못했습니다.`,
        { pageNumber, cause },
      )));
  }, 'image/jpeg', quality);
});

const restoreClass = (element: HTMLElement, className: string, originallyPresent: boolean): void => {
  element.classList.toggle(className, originallyPresent);
};

const sanitizeAuditValue = (value: string | number, maxLength: number): string => (
  sanitizePdfAuditText(String(value), maxLength)
    .replace(/[|=;]/g, '_')
    || '-'
);

const buildPageAuditText = (
  audit: ConstructionPlanPdfAudit | undefined,
  pageNumber: number,
  pageCount: number,
): string | undefined => {
  if (!audit) return undefined;
  const markers = [
    `PLAN_ID=${sanitizeAuditValue(audit.planId, 72)}`,
    `DOCUMENT_NO=${sanitizeAuditValue(audit.documentNo, 72)}`,
    `REV=${sanitizeAuditValue(audit.revision, 24)}`,
    `TEMPLATE_VERSION=${sanitizeAuditValue(audit.templateVersion, 72)}`,
    `PAGE ${pageNumber}/${pageCount}`,
  ];
  if (audit.snapshotHash !== undefined && String(audit.snapshotHash).trim()) {
    markers.push(`SNAPSHOT_HASH=${sanitizeAuditValue(audit.snapshotHash, 128)}`);
  }
  return markers.join(' | ');
};

/**
 * Rasterizes the bounded physical `.cp-a4` continuation plan in DOM order and
 * assembles an A4 PDF. Draft composition may contain a selected subset of the
 * standard TOC; issued candidates retain the exact 42-through-200 contract.
 * CSS can use `is-pdf-rendering` to reveal the off-screen print document and
 * `is-issued-candidate` to remove DRAFT/field-use-prohibited marks for issuance.
 */
export const generateConstructionPlanPdf = async (
  options: GenerateConstructionPlanPdfOptions,
): Promise<ConstructionPlanPdfResult> => {
  const {
    container,
    fileName = 'construction-plan',
    profile = 'draft',
    captureScale,
    jpegQuality = 0.92,
    audit,
    signal,
    onProgress,
  } = options;
  const pages = Array.from(container.querySelectorAll<HTMLElement>('.cp-a4'));
  const minimumPageCount = profile === 'draft' ? 1 : CONSTRUCTION_PLAN_PDF_MIN_PHYSICAL_PAGE_COUNT;
  if (pages.length < minimumPageCount
    || pages.length > CONSTRUCTION_PLAN_PDF_MAX_PHYSICAL_PAGE_COUNT) {
    throw new ConstructionPlanPdfError(
      'PAGE_COUNT_MISMATCH',
      `PDF 생성에는 ${minimumPageCount}~${CONSTRUCTION_PLAN_PDF_MAX_PHYSICAL_PAGE_COUNT} 물리 페이지가 필요하지만 ${pages.length}페이지가 확인되었습니다.`,
    );
  }
  if (captureScale !== undefined && (!Number.isFinite(captureScale) || captureScale <= 0)) {
    throw new RangeError('captureScale은 0보다 큰 유한한 수여야 합니다.');
  }
  if (!Number.isFinite(jpegQuality) || jpegQuality <= 0 || jpegQuality > 1) {
    throw new RangeError('jpegQuality는 0보다 크고 1 이하여야 합니다.');
  }

  const hadRenderingClass = container.classList.contains('is-pdf-rendering');
  const hadIssuedCandidateClass = container.classList.contains('is-issued-candidate');
  container.classList.add('is-pdf-rendering');
  container.classList.toggle('is-issued-candidate', profile === 'issued-candidate');

  try {
    assertNotAborted(signal);
    reportProgress(onProgress, {
      stage: 'preparing',
      currentPage: 0,
      totalPages: pages.length,
      percent: 0,
      message: '폰트와 도면 이미지를 준비하고 있습니다.',
    });
    await waitForDocumentAssets(container, signal);

    const rasterPages: A4RasterPdfPage[] = [];
    for (let index = 0; index < pages.length; index += 1) {
      assertNotAborted(signal);
      const pageNumber = index + 1;
      reportProgress(onProgress, {
        stage: 'rendering',
        currentPage: index,
        totalPages: pages.length,
        percent: Math.round((index / pages.length) * 90),
        message: `${pageNumber}/${pages.length}페이지를 렌더링하고 있습니다.`,
      });

      const page = pages[index];
      const measuredWidth = page.getBoundingClientRect().width || page.offsetWidth || 794;
      const scale = captureScale ?? Math.max(1, Math.min(2, 1240 / measuredWidth));
      let canvas: HTMLCanvasElement;
      try {
        const captureOptions = {
          backgroundColor: '#ffffff',
          scale,
          useCORS: true,
          allowTaint: false,
          logging: false,
          removeContainer: true,
          imageTimeout: 20_000,
        } as unknown as Parameters<typeof html2canvas>[1];
        canvas = await html2canvas(page, captureOptions);
      } catch (cause) {
        throw new ConstructionPlanPdfError(
          'CAPTURE_FAILED',
          `${pageNumber}페이지 렌더링에 실패했습니다. 도면 이미지 접근 권한과 로딩 상태를 확인해 주세요.`,
          { pageNumber, cause },
        );
      }

      try {
        rasterPages.push(await canvasToJpegPage(
          canvas,
          jpegQuality,
          pageNumber,
          buildPageAuditText(audit, pageNumber, pages.length),
          page.innerText,
        ));
      } finally {
        canvas.width = 1;
        canvas.height = 1;
      }

      reportProgress(onProgress, {
        stage: 'rendering',
        currentPage: pageNumber,
        totalPages: pages.length,
        percent: Math.round((pageNumber / pages.length) * 90),
        message: `${pageNumber}/${pages.length}페이지 렌더링을 완료했습니다.`,
      });
    }

    assertNotAborted(signal);
    reportProgress(onProgress, {
      stage: 'assembling',
      currentPage: pages.length,
      totalPages: pages.length,
      percent: 94,
      message: 'A4 PDF를 조립하고 있습니다.',
    });

    let pdfBytes: Uint8Array;
    try {
      pdfBytes = writeA4RasterPdf(rasterPages);
    } catch (cause) {
      throw new ConstructionPlanPdfError(
        'PDF_ASSEMBLY_FAILED',
        'A4 PDF 조립에 실패했습니다.',
        { cause },
      );
    }

    assertNotAborted(signal);
    reportProgress(onProgress, {
      stage: 'hashing',
      currentPage: pages.length,
      totalPages: pages.length,
      percent: 98,
      message: 'PDF 무결성 해시를 계산하고 있습니다.',
    });
    const sha256 = sha256Hex(pdfBytes);
    const pdfBuffer = pdfBytes.buffer.slice(
      pdfBytes.byteOffset,
      pdfBytes.byteOffset + pdfBytes.byteLength,
    ) as ArrayBuffer;
    const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
    const result: ConstructionPlanPdfResult = {
      blob,
      sha256,
      pageCount: pages.length,
      byteLength: pdfBytes.byteLength,
      fileName: normalizePdfFileName(fileName),
      profile,
      rendererVersion: CONSTRUCTION_PLAN_PDF_RENDERER_VERSION,
    };

    reportProgress(onProgress, {
      stage: 'complete',
      currentPage: pages.length,
      totalPages: pages.length,
      percent: 100,
      message: 'PDF 생성을 완료했습니다.',
    });
    return result;
  } finally {
    restoreClass(container, 'is-pdf-rendering', hadRenderingClass);
    restoreClass(container, 'is-issued-candidate', hadIssuedCandidateClass);
  }
};

/** Starts a browser download while keeping the caller-owned Blob immutable. */
export const downloadConstructionPlanPdf = (blob: Blob, fileName: string): void => {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = normalizePdfFileName(fileName);
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoking in the same task can cancel larger Blob downloads in Chromium
  // before the browser has opened the object URL. Keep it alive long enough
  // for the transfer to start, then release it deterministically.
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
};
