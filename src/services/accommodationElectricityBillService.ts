import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';
import { aiSettingsService } from './aiSettingsService';
import {
    AccommodationElectricityBillAnalysis,
    AccommodationElectricityBillAnalysisProgress,
    AccommodationGasBillAnalysis,
    AccommodationWaterBillAnalysis,
    AnalyzeAccommodationElectricityBillFileInput,
    AnalyzeAccommodationElectricityBillsInput,
    AnalyzeAccommodationElectricityBillsResult,
    AnalyzeAccommodationGasBillsInput,
    AnalyzeAccommodationGasBillsResult,
    AnalyzeAccommodationWaterBillsInput,
    AnalyzeAccommodationWaterBillsResult,
} from '../types/accommodationElectricityBillImport';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_FILE_COUNT = 20;
const MAX_BATCH_FILE_COUNT = 6;
const MAX_BATCH_RAW_SIZE = 4.5 * 1024 * 1024;
const ANALYSIS_TIMEOUT_MS = 300_000;

const inferMimeType = (file: File): string => {
    const declared = String(file.type || '').toLowerCase();
    if (ALLOWED_MIME_TYPES.has(declared)) return declared;
    const name = String(file.name || '').toLowerCase();
    if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
    if (name.endsWith('.png')) return 'image/png';
    if (name.endsWith('.webp')) return 'image/webp';
    if (name.endsWith('.pdf')) return 'application/pdf';
    return declared;
};

const validateFile = (file: File): void => {
    const mimeType = inferMimeType(file);
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
        throw new Error(`${file.name}: JPG, PNG, WEBP, PDF 파일만 첨부할 수 있습니다.`);
    }
    if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
        throw new Error(`${file.name}: 파일 크기는 5MB 이하여야 합니다.`);
    }
};

const readFileAsBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`${file.name}: 파일을 읽지 못했습니다.`));
    reader.onload = () => {
        const dataUrl = String(reader.result || '');
        const comma = dataUrl.indexOf(',');
        if (comma < 0) {
            reject(new Error(`${file.name}: 파일 데이터 형식이 올바르지 않습니다.`));
            return;
        }
        resolve(dataUrl.slice(comma + 1));
    };
    reader.readAsDataURL(file);
});

const calculateFileSha256 = async (file: File): Promise<string | undefined> => {
    if (typeof crypto === 'undefined' || !crypto.subtle) return undefined;
    try {
        const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
        return Array.from(new Uint8Array(digest))
            .map((byte) => byte.toString(16).padStart(2, '0'))
            .join('');
    } catch {
        return undefined;
    }
};

const buildBatches = (files: File[]): Array<Array<{ file: File; fileIndex: number }>> => {
    const batches: Array<Array<{ file: File; fileIndex: number }>> = [];
    let current: Array<{ file: File; fileIndex: number }> = [];
    let currentSize = 0;

    files.forEach((file, fileIndex) => {
        const mustSplit = current.length > 0 && (
            current.length >= MAX_BATCH_FILE_COUNT || currentSize + file.size > MAX_BATCH_RAW_SIZE
        );
        if (mustSplit) {
            batches.push(current);
            current = [];
            currentSize = 0;
        }
        current.push({ file, fileIndex });
        currentSize += file.size;
    });
    if (current.length > 0) batches.push(current);
    return batches;
};

const getCallableErrorMessage = (error: unknown, billLabel: string): string => {
    const message = error instanceof Error ? error.message : String(error || '');
    if (message.includes('failed-precondition')) {
        return `서버 Gemini 설정을 확인해 주세요. ${message.replace(/^.*failed-precondition:?\s*/i, '')}`;
    }
    return message || `${billLabel} 청구서 분석에 실패했습니다.`;
};

const validateFiles = (files: File[], billLabel: string): void => {
    if (files.length === 0) throw new Error(`분석할 ${billLabel} 청구서를 선택해 주세요.`);
    if (files.length > MAX_FILE_COUNT) throw new Error(`한 번에 최대 ${MAX_FILE_COUNT}개까지 선택할 수 있습니다.`);
    files.forEach(validateFile);
};

const analyzeFiles = async <
    TInput,
    TResult extends { bills: TAnalysis[] },
    TAnalysis extends { fileIndex?: number; sourceFileSha256?: string },
>(
    yearMonth: string,
    files: File[],
    callableName: string,
    featureLabel: string,
    onProgress?: (progress: AccommodationElectricityBillAnalysisProgress) => void,
): Promise<TAnalysis[]> => {
    if (!/^\d{4}-\d{2}$/.test(String(yearMonth || ''))) {
        throw new Error('대장 월이 yyyy-MM 형식이 아닙니다.');
    }
    validateFiles(files, featureLabel);
    aiSettingsService.assertPathEnabled('/support/accommodation', `${featureLabel} 청구서 AI 분석`);

    const callable = httpsCallable<TInput, TResult>(functions, callableName, { timeout: ANALYSIS_TIMEOUT_MS });
    const batches = buildBatches(files);
    const analyses: TAnalysis[] = [];
    const sha256ByFileIndex = new Map<number, string>();
    const clientHashOwners = new Map<string, string>();
    const serverHashOwners = new Map<string, string>();
    let completedFiles = 0;

    const calculatedHashes = await Promise.all(files.map(calculateFileSha256));
    calculatedHashes.forEach((sha256, fileIndex) => {
        if (!sha256) return;
        const previousFileName = clientHashOwners.get(sha256);
        if (previousFileName) {
            throw new Error(`${files[fileIndex].name}: ${previousFileName}와 동일한 파일입니다. 같은 청구서는 한 번만 첨부해 주세요.`);
        }
        clientHashOwners.set(sha256, files[fileIndex].name);
        sha256ByFileIndex.set(fileIndex, sha256);
    });

    for (const batch of batches) {
        const encodedFiles: AnalyzeAccommodationElectricityBillFileInput[] = await Promise.all(
            batch.map(async ({ file, fileIndex }) => ({
                fileIndex,
                originalFileName: file.name,
                mimeType: inferMimeType(file),
                base64: await readFileAsBase64(file),
                sourceFileSha256: sha256ByFileIndex.get(fileIndex),
            })),
        );
        onProgress?.({
            completedFiles,
            totalFiles: files.length,
            currentFileName: batch.map(({ file }) => file.name).join(', '),
        });

        try {
            const response = await callable({ yearMonth, files: encodedFiles } as TInput);
            (response.data.bills || []).forEach((analysis) => {
                const fileIndex = Number(analysis.fileIndex ?? -1);
                const expectedHash = sha256ByFileIndex.get(fileIndex) || '';
                const returnedHash = String(analysis.sourceFileSha256 || '').trim().toLowerCase();
                if (expectedHash && returnedHash && expectedHash !== returnedHash) {
                    throw new Error(`${files[fileIndex]?.name || '첨부파일'}: 서버 파일 지문 검증에 실패했습니다.`);
                }
                const sourceFileSha256 = returnedHash || expectedHash;
                if (sourceFileSha256) {
                    const previousFileName = serverHashOwners.get(sourceFileSha256);
                    if (previousFileName) {
                        throw new Error(`${files[fileIndex]?.name || '첨부파일'}: ${previousFileName}와 동일한 파일입니다. 같은 청구서는 한 번만 첨부해 주세요.`);
                    }
                    serverHashOwners.set(sourceFileSha256, files[fileIndex]?.name || String(fileIndex));
                }
                analyses.push({ ...analysis, sourceFileSha256 } as TAnalysis);
            });
        } catch (error) {
            throw new Error(getCallableErrorMessage(error, featureLabel));
        }
        completedFiles += batch.length;
        onProgress?.({ completedFiles, totalFiles: files.length, currentFileName: '' });
    }

    return analyses.sort((left, right) => {
        const leftIndex = Number((left as { fileIndex?: number }).fileIndex ?? 0);
        const rightIndex = Number((right as { fileIndex?: number }).fileIndex ?? 0);
        return leftIndex - rightIndex;
    });
};

export const accommodationElectricityBillService = {
    validateFiles(files: File[]): void {
        validateFiles(files, '전기요금');
    },

    async analyzeFiles(
        yearMonth: string,
        files: File[],
        onProgress?: (progress: AccommodationElectricityBillAnalysisProgress) => void,
    ): Promise<AccommodationElectricityBillAnalysis[]> {
        return analyzeFiles<
            AnalyzeAccommodationElectricityBillsInput,
            AnalyzeAccommodationElectricityBillsResult,
            AccommodationElectricityBillAnalysis
        >(yearMonth, files, 'analyzeAccommodationElectricityBills', '전기요금', onProgress);
    },
};

export const accommodationGasBillService = {
    validateFiles(files: File[]): void {
        validateFiles(files, '가스요금');
    },

    async analyzeFiles(
        yearMonth: string,
        files: File[],
        onProgress?: (progress: AccommodationElectricityBillAnalysisProgress) => void,
    ): Promise<AccommodationGasBillAnalysis[]> {
        return analyzeFiles<
            AnalyzeAccommodationGasBillsInput,
            AnalyzeAccommodationGasBillsResult,
            AccommodationGasBillAnalysis
        >(yearMonth, files, 'analyzeAccommodationGasBills', '가스요금', onProgress);
    },
};

export const accommodationWaterBillService = {
    validateFiles(files: File[]): void {
        validateFiles(files, '수도요금');
    },

    async analyzeFiles(
        yearMonth: string,
        files: File[],
        onProgress?: (progress: AccommodationElectricityBillAnalysisProgress) => void,
    ): Promise<AccommodationWaterBillAnalysis[]> {
        return analyzeFiles<
            AnalyzeAccommodationWaterBillsInput,
            AnalyzeAccommodationWaterBillsResult,
            AccommodationWaterBillAnalysis
        >(yearMonth, files, 'analyzeAccommodationWaterBills', '수도요금', onProgress);
    },
};
