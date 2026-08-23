import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';
import { aiSettingsService } from './aiSettingsService';
import type {
    AnalyzeVehicleTollFileInput,
    AnalyzeVehicleTollUsagesInput,
    AnalyzeVehicleTollUsagesResult,
    CommitVehicleTollImportsInput,
    CommitVehicleTollImportsResult,
    VehicleTollAnalysisProgress,
    VehicleTollUsageAnalysis,
} from '../types/vehicleTollImport';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const MAX_FILE_SIZE = 8 * 1024 * 1024;
const MAX_FILE_COUNT = 20;
const MAX_BATCH_FILE_COUNT = 1;
const MAX_BATCH_RAW_SIZE = 4.5 * 1024 * 1024;
const MAX_CONCURRENT_ANALYSES = 2;
const ANALYSIS_TIMEOUT_MS = 300_000;
const COMMIT_TIMEOUT_MS = 120_000;

const inferMimeType = (file: File): string => {
    const declared = String(file.type || '').toLowerCase();
    if (ALLOWED_MIME_TYPES.has(declared)) return declared;
    const name = file.name.toLowerCase();
    if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
    if (name.endsWith('.png')) return 'image/png';
    if (name.endsWith('.webp')) return 'image/webp';
    if (name.endsWith('.pdf')) return 'application/pdf';
    return declared;
};

const validateFile = (file: File): void => {
    if (!ALLOWED_MIME_TYPES.has(inferMimeType(file))) {
        throw new Error(`${file.name}: JPG, PNG, WEBP, PDF 파일만 등록할 수 있습니다.`);
    }
    if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
        throw new Error(`${file.name}: 파일 크기는 8MB 이하여야 합니다.`);
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

const buildBatches = (files: File[]): Array<Array<{ file: File; fileIndex: number }>> => {
    const batches: Array<Array<{ file: File; fileIndex: number }>> = [];
    let current: Array<{ file: File; fileIndex: number }> = [];
    let currentSize = 0;

    files.forEach((file, fileIndex) => {
        const shouldSplit = current.length > 0 && (
            current.length >= MAX_BATCH_FILE_COUNT || currentSize + file.size > MAX_BATCH_RAW_SIZE
        );
        if (shouldSplit) {
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

const getErrorMessage = (error: unknown, fallback: string): string => {
    const message = error instanceof Error ? error.message : String(error || '');
    if (message.includes('failed-precondition')) {
        return message.replace(/^.*failed-precondition:?\s*/i, '') || fallback;
    }
    return message || fallback;
};

const createOperationId = (): string => {
    const random = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);
    return `vehicle-toll-import:${new Date().toISOString()}:${random}`;
};

export const vehicleTollImportService = {
    validateFiles(files: File[]): void {
        if (files.length === 0) throw new Error('분석할 통행료 이용내역 파일을 선택해 주세요.');
        if (files.length > MAX_FILE_COUNT) throw new Error(`한 번에 최대 ${MAX_FILE_COUNT}개까지 등록할 수 있습니다.`);
        files.forEach(validateFile);
    },

    async analyzeFiles(
        files: File[],
        onProgress?: (progress: VehicleTollAnalysisProgress) => void,
    ): Promise<VehicleTollUsageAnalysis[]> {
        this.validateFiles(files);
        aiSettingsService.assertPathEnabled('/support/vehicles', '차량 통행료 AI 분석');

        const callable = httpsCallable<AnalyzeVehicleTollUsagesInput, AnalyzeVehicleTollUsagesResult>(
            functions,
            'analyzeVehicleTollUsages',
            { timeout: ANALYSIS_TIMEOUT_MS },
        );
        const analyses: VehicleTollUsageAnalysis[] = [];
        const batches = buildBatches(files);
        let completedFiles = 0;
        let nextBatchIndex = 0;
        const activeFileNames = new Set<string>();
        const reportProgress = () => onProgress?.({
            completedFiles,
            totalFiles: files.length,
            currentFileName: Array.from(activeFileNames).join(', '),
        });

        const analyzeNextBatch = async (): Promise<void> => {
            const batchIndex = nextBatchIndex;
            nextBatchIndex += 1;
            const batch = batches[batchIndex];
            if (!batch) return;
            const currentFileName = batch.map(({ file }) => file.name).join(', ');
            activeFileNames.add(currentFileName);
            reportProgress();
            const encodedFiles: AnalyzeVehicleTollFileInput[] = await Promise.all(batch.map(async ({ file, fileIndex }) => ({
                fileIndex,
                originalFileName: file.name,
                mimeType: inferMimeType(file),
                base64: await readFileAsBase64(file),
            })));

            try {
                const response = await callable({ files: encodedFiles });
                analyses.push(...(response.data.usages || []));
            } catch (error) {
                throw new Error(getErrorMessage(error, '통행료 이용내역 분석에 실패했습니다.'));
            } finally {
                activeFileNames.delete(currentFileName);
            }

            completedFiles += batch.length;
            reportProgress();
            await analyzeNextBatch();
        };

        await Promise.all(Array.from(
            { length: Math.min(MAX_CONCURRENT_ANALYSES, batches.length) },
            () => analyzeNextBatch(),
        ));

        return analyses.sort((left, right) => left.fileIndex - right.fileIndex || left.entryIndex - right.entryIndex);
    },

    createOperationId,

    async commit(input: CommitVehicleTollImportsInput): Promise<CommitVehicleTollImportsResult> {
        const callable = httpsCallable<CommitVehicleTollImportsInput, CommitVehicleTollImportsResult>(
            functions,
            'commitVehicleTollImports',
            { timeout: COMMIT_TIMEOUT_MS },
        );
        try {
            const response = await callable(input);
            return response.data;
        } catch (error) {
            throw new Error(getErrorMessage(error, '통행료 대장 등록에 실패했습니다.'));
        }
    },
};
