import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';
import { aiSettingsService } from './aiSettingsService';
import type {
  AnalyzeIdentityDocumentFileInput,
  AnalyzeIdentityDocumentsInput,
  AnalyzeIdentityDocumentsResult,
  IdentityAnalysisProgress,
  IdentityDocumentAnalysis,
  IdentityDocumentType,
  IdentityRegistrationAnalysis,
} from '../types/identityBundle';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const DOCUMENT_TYPES = new Set<IdentityDocumentType>([
  'RESIDENT_CARD',
  'DRIVERS_LICENSE',
  'PASSPORT',
  'SAFETY_EDUCATION',
  'SCAFFOLD_TRAINING',
  'FOREIGN_REGISTRATION',
  'CONSTRUCTION_WORKER_CARD',
  'OTHER_ID',
]);
const MAX_FILE_COUNT = 60;
const MAX_ORIGINAL_FILE_SIZE = 20 * 1024 * 1024;
const MAX_BATCH_FILE_COUNT = 4;
const MAX_ANALYSIS_EDGE = 1800;
const ANALYSIS_JPEG_QUALITY = 0.86;
const MAX_CONCURRENT_BATCHES = 2;
const ANALYSIS_TIMEOUT_MS = 300_000;

const clamp = (value: unknown, fallback = 0): number => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : fallback;
};

const inferMimeType = (file: File): string => {
  const declared = String(file.type || '').toLowerCase();
  if (ALLOWED_MIME_TYPES.has(declared)) return declared;
  const name = file.name.toLowerCase();
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.webp')) return 'image/webp';
  return declared;
};

const blobToBase64 = (blob: Blob, fileName: string): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error(`${fileName}: 분석용 이미지를 읽지 못했습니다.`));
  reader.onload = () => {
    const dataUrl = String(reader.result || '');
    const comma = dataUrl.indexOf(',');
    if (comma < 0) {
      reject(new Error(`${fileName}: 이미지 데이터 형식이 올바르지 않습니다.`));
      return;
    }
    resolve(dataUrl.slice(comma + 1));
  };
  reader.readAsDataURL(blob);
});

const canvasToBlob = (canvas: HTMLCanvasElement, fileName: string): Promise<Blob> => new Promise((resolve, reject) => {
  canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error(`${fileName}: 이미지 축소에 실패했습니다.`)),
    'image/jpeg',
    ANALYSIS_JPEG_QUALITY,
  );
});

const loadImage = (file: File): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    URL.revokeObjectURL(url);
    resolve(image);
  };
  image.onerror = () => {
    URL.revokeObjectURL(url);
    reject(new Error(`${file.name}: 이미지 파일을 열지 못했습니다.`));
  };
  image.src = url;
});

const prepareFile = async (file: File, fileIndex: number): Promise<AnalyzeIdentityDocumentFileInput> => {
  const image = await loadImage(file);
  const scale = Math.min(1, MAX_ANALYSIS_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error(`${file.name}: 이미지 처리 기능을 사용할 수 없습니다.`);
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await canvasToBlob(canvas, file.name);
  return {
    fileIndex,
    originalFileName: file.name,
    mimeType: 'image/jpeg',
    base64: await blobToBase64(blob, file.name),
  };
};

const normalizeDocument = (value: IdentityDocumentAnalysis): IdentityDocumentAnalysis => {
  const source = (value || {}) as IdentityDocumentAnalysis;
  const cropSource = source.crop || { x: 0, y: 0, width: 1, height: 1 };
  const x = clamp(cropSource.x);
  const y = clamp(cropSource.y);
  const width = Math.max(0.05, Math.min(1 - x, clamp(cropSource.width, 1)));
  const height = Math.max(0.05, Math.min(1 - y, clamp(cropSource.height, 1)));
  const documentType = DOCUMENT_TYPES.has(source.documentType) ? source.documentType : 'OTHER_ID';
  return {
    fileIndex: Math.max(0, Math.floor(Number(source.fileIndex) || 0)),
    originalFileName: String(source.originalFileName || ''),
    personName: String(source.personName || '').trim().slice(0, 80),
    birthDate: String(source.birthDate || '').trim().slice(0, 10),
    identityNumber: String(source.identityNumber || '').trim().slice(0, 40),
    address: String(source.address || '').trim().slice(0, 240),
    nationality: String(source.nationality || '').trim().slice(0, 80),
    documentNumber: String(source.documentNumber || '').trim().slice(0, 60),
    expirationDate: String(source.expirationDate || '').trim().slice(0, 10),
    identityHash: String(source.identityHash || '').trim().slice(0, 80),
    documentType,
    documentLabel: String(source.documentLabel || '기타 신분증').trim().slice(0, 80),
    crop: { x, y, width, height },
    confidence: clamp(source.confidence),
    matchingConfidence: clamp(source.matchingConfidence),
    warnings: Array.isArray(source.warnings)
      ? source.warnings.map((warning) => String(warning || '').trim()).filter(Boolean).slice(0, 8)
      : [],
  };
};

const normalizeRegistration = (value: IdentityRegistrationAnalysis | undefined): IdentityRegistrationAnalysis => ({
  name: String(value?.name || '').trim().slice(0, 80),
  idNumber: String(value?.idNumber || '').trim().slice(0, 40),
  address: String(value?.address || '').trim().slice(0, 240),
});

const getErrorMessage = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error || '');
  if (/failed-precondition/i.test(message)) {
    return message.replace(/^.*failed-precondition:?\s*/i, '');
  }
  if (/permission-denied/i.test(message)) {
    return '신분증 묶음사진을 분석할 권한이 없습니다.';
  }
  return message || '신분증 AI 분석에 실패했습니다.';
};

const createSessionId = (): string => {
  const random = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `identity-bundle-${random}`;
};

export const identityBundleService = {
  validateFiles(files: File[]): void {
    if (files.length === 0) throw new Error('분석할 신분증 사진을 선택해 주세요.');
    if (files.length > MAX_FILE_COUNT) throw new Error(`한 번에 최대 ${MAX_FILE_COUNT}장까지 올릴 수 있습니다.`);
    files.forEach((file) => {
      if (!ALLOWED_MIME_TYPES.has(inferMimeType(file))) {
        throw new Error(`${file.name}: JPG, PNG, WEBP 이미지만 올릴 수 있습니다.`);
      }
      if (file.size <= 0 || file.size > MAX_ORIGINAL_FILE_SIZE) {
        throw new Error(`${file.name}: 파일 크기는 20MB 이하여야 합니다.`);
      }
    });
  },

  async analyzeFiles(
    files: File[],
    onProgress?: (progress: IdentityAnalysisProgress) => void,
  ): Promise<IdentityDocumentAnalysis[]> {
    this.validateFiles(files);
    aiSettingsService.assertPathEnabled('/database/identity-bundle', '신분증 묶음사진 AI 분석');

    const callable = httpsCallable<AnalyzeIdentityDocumentsInput, AnalyzeIdentityDocumentsResult>(
      functions,
      'analyzeIdentityDocuments',
      { timeout: ANALYSIS_TIMEOUT_MS },
    );
    const sessionId = createSessionId();
    const batches: Array<Array<{ file: File; fileIndex: number }>> = [];
    for (let index = 0; index < files.length; index += MAX_BATCH_FILE_COUNT) {
      batches.push(files.slice(index, index + MAX_BATCH_FILE_COUNT).map((file, offset) => ({
        file,
        fileIndex: index + offset,
      })));
    }

    const documents: IdentityDocumentAnalysis[] = [];
    const activeFileNames = new Set<string>();
    let completedFiles = 0;
    let nextBatchIndex = 0;
    const reportProgress = () => onProgress?.({
      completedFiles,
      totalFiles: files.length,
      currentFileNames: Array.from(activeFileNames),
    });

    const analyzeNextBatch = async (): Promise<void> => {
      const batchIndex = nextBatchIndex;
      nextBatchIndex += 1;
      const batch = batches[batchIndex];
      if (!batch) return;
      const batchLabel = batch.map(({ file }) => file.name).join(', ');
      activeFileNames.add(batchLabel);
      reportProgress();
      try {
        const prepared = await Promise.all(batch.map(({ file, fileIndex }) => prepareFile(file, fileIndex)));
        const response = await callable({ sessionId, files: prepared, mode: 'GROUPING' });
        documents.push(...(response.data.documents || []).map(normalizeDocument));
      } catch (error) {
        throw new Error(getErrorMessage(error));
      } finally {
        activeFileNames.delete(batchLabel);
      }
      completedFiles += batch.length;
      reportProgress();
      await analyzeNextBatch();
    };

    await Promise.all(Array.from(
      { length: Math.min(MAX_CONCURRENT_BATCHES, batches.length) },
      () => analyzeNextBatch(),
    ));

    return documents.sort((left, right) => left.fileIndex - right.fileIndex);
  },

  async analyzeRegistrationPreview(file: File): Promise<IdentityRegistrationAnalysis> {
    this.validateFiles([file]);
    aiSettingsService.assertPathEnabled('/database/identity-bundle', '신분증 묶음사진 인적정보 분석');

    const callable = httpsCallable<AnalyzeIdentityDocumentsInput, AnalyzeIdentityDocumentsResult>(
      functions,
      'analyzeIdentityDocuments',
      { timeout: ANALYSIS_TIMEOUT_MS },
    );
    try {
      const prepared = await prepareFile(file, 0);
      const response = await callable({
        sessionId: createSessionId(),
        files: [prepared],
        mode: 'REGISTRATION',
      });
      return normalizeRegistration(response.data.registration);
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },
};
