import { httpsCallable } from 'firebase/functions';
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes } from 'firebase/storage';
import { db, functions, storage } from '../config/firebase';
import type {
  CardStatementImportFile,
  CardStatementImportJob,
  CardStatementImportJobPayload,
  CardStatementImportResult,
  CardStatementImportUploadSessionFile,
  CardStatementImportUploadProgress,
  CancelCardStatementImportUploadSessionInput,
  CompleteCardStatementImportUploadInput,
  CreateCardStatementImportFileInput,
  CreateCardStatementImportJobInput,
  CreateCardStatementImportJobResult,
  CreateCardStatementImportUploadSessionInput,
  CreateCardStatementImportUploadSessionResult,
  UpdateCardStatementImportResultReviewInput,
} from '../types/cardStatementImport';

const COLLECTIONS = {
  jobs: 'cardStatementImportJobs',
  files: 'cardStatementImportFiles',
  results: 'cardStatementImportResults',
} as const;

const START_ANALYSIS_CALLABLE_TIMEOUT_MS = 60_000;
const LONG_MUTATION_CALLABLE_TIMEOUT_MS = 540_000;

type CardStatementImportJobIdInput = {
  jobId: string;
};

const assertYearMonth = (yearMonth: string): void => {
  if (!/^\d{4}-\d{2}$/.test(String(yearMonth || '').trim())) {
    throw new Error('가져오기 월은 yyyy-MM 형식이어야 합니다.');
  }
};

const assertPdfFile = (file: File): void => {
  const name = String(file.name || '').toLowerCase();
  const type = String(file.type || '').toLowerCase();
  if (type === 'application/pdf' || name.endsWith('.pdf')) return;
  throw new Error(`${file.name} 파일은 PDF가 아닙니다.`);
};

const calculateSha256 = async (file: File): Promise<string | undefined> => {
  if (typeof crypto === 'undefined' || !crypto.subtle) return undefined;
  try {
    const hashBuffer = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    return Array.from(new Uint8Array(hashBuffer))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return undefined;
  }
};

const sortFiles = (files: CardStatementImportFile[]): CardStatementImportFile[] =>
  files.slice().sort((a, b) => Number(a.fileIndex ?? 0) - Number(b.fileIndex ?? 0));

const sortResults = (results: CardStatementImportResult[]): CardStatementImportResult[] =>
  results.slice().sort((a, b) => (
    Number(a.fileIndex ?? 0) - Number(b.fileIndex ?? 0) ||
    Number(a.resultIndex ?? 0) - Number(b.resultIndex ?? 0)
  ));

export const cardStatementImportService = {
  async createUploadSession(
    input: CreateCardStatementImportUploadSessionInput,
  ): Promise<CreateCardStatementImportUploadSessionResult> {
    const callable = httpsCallable<
      CreateCardStatementImportUploadSessionInput,
      CreateCardStatementImportUploadSessionResult
    >(
      functions,
      'createCardStatementImportUploadSession',
    );
    const result = await callable(input);
    return result.data;
  },

  async completeUpload(input: CompleteCardStatementImportUploadInput): Promise<CreateCardStatementImportJobResult> {
    const callable = httpsCallable<CompleteCardStatementImportUploadInput, CreateCardStatementImportJobResult>(
      functions,
      'completeCardStatementImportUpload',
    );
    const result = await callable(input);
    return result.data;
  },

  async cancelUploadSession(input: CancelCardStatementImportUploadSessionInput): Promise<void> {
    const callable = httpsCallable<CancelCardStatementImportUploadSessionInput, { ok: boolean }>(
      functions,
      'cancelCardStatementImportUploadSession',
    );
    await callable(input);
  },

  async uploadStatementFilesToSession(
    files: File[],
    sessionFiles: CardStatementImportUploadSessionFile[],
    onProgress?: (progress: CardStatementImportUploadProgress) => void,
  ): Promise<CreateCardStatementImportFileInput[]> {
    const uploaded: CreateCardStatementImportFileInput[] = [];

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const sessionFile = sessionFiles[index];
      assertPdfFile(file);
      if (!sessionFile?.storagePath) {
        throw new Error('업로드 세션 파일 경로가 없습니다.');
      }
      const storagePath = sessionFile.storagePath;

      onProgress?.({
        fileName: file.name,
        fileIndex: index,
        uploadedCount: uploaded.length,
        totalCount: files.length,
        status: 'uploading',
        storagePath,
      });

      try {
        await uploadBytes(storageRef(storage, storagePath), file, {
          contentType: file.type || 'application/pdf',
          customMetadata: {
            yearMonth: String(sessionFile.yearMonth || ''),
            originalFileName: file.name,
            importJobId: String(sessionFile.jobId || ''),
            importFileId: String(sessionFile.id || ''),
          },
        });

        const fileInput: CreateCardStatementImportFileInput = {
          storagePath,
          originalFileName: file.name,
          mimeType: file.type || 'application/pdf',
          size: file.size,
          sha256: await calculateSha256(file),
        };
        uploaded.push(fileInput);
        onProgress?.({
          fileName: file.name,
          fileIndex: index,
          uploadedCount: uploaded.length,
          totalCount: files.length,
          status: 'uploaded',
          storagePath,
        });
      } catch (error) {
        onProgress?.({
          fileName: file.name,
          fileIndex: index,
          uploadedCount: uploaded.length,
          totalCount: files.length,
          status: 'failed',
          storagePath,
          errorMessage: error instanceof Error ? error.message : '업로드에 실패했습니다.',
        });
        throw error;
      }
    }

    return uploaded;
  },

  async createJob(input: CreateCardStatementImportJobInput): Promise<CreateCardStatementImportJobResult> {
    const callable = httpsCallable<CreateCardStatementImportJobInput, CreateCardStatementImportJobResult>(
      functions,
      'createCardStatementImportJob',
    );
    const result = await callable(input);
    return result.data;
  },

  async createJobFromFiles(
    yearMonth: string,
    files: File[],
    onProgress?: (progress: CardStatementImportUploadProgress) => void,
  ): Promise<CreateCardStatementImportJobResult> {
    assertYearMonth(yearMonth);
    files.forEach(assertPdfFile);
    let session: CreateCardStatementImportUploadSessionResult | null = null;
    let completeAttempted = false;
    try {
      session = await this.createUploadSession({
        yearMonth,
        bankName: 'KB국민카드',
        files: files.map((file) => ({
          originalFileName: file.name,
          mimeType: file.type || 'application/pdf',
          size: file.size,
        })),
      });
      const uploadedFiles = await this.uploadStatementFilesToSession(files, session.files, onProgress);
      completeAttempted = true;
      return await this.completeUpload({
        jobId: session.jobId,
        files: uploadedFiles,
      });
    } catch (error) {
      if (session?.jobId) {
        const latestPayload = completeAttempted
          ? await this.getJobStatus(session.jobId).catch(() => null)
          : null;
        const shouldCleanup = completeAttempted
          ? ['uploading', 'failed'].includes(String(latestPayload?.job?.status || ''))
          : true;
        if (shouldCleanup) {
          await this.cancelUploadSession({
            jobId: session.jobId,
            reason: error instanceof Error ? error.message : 'PDF 업로드 또는 작업 생성에 실패했습니다.',
          }).catch((cleanupError) => {
            console.warn('[cardStatementImportService] failed to cleanup upload session', cleanupError);
          });
        }
      }
      throw error;
    }
  },

  async analyzeJob(jobId: string): Promise<CardStatementImportJobPayload> {
    const callable = httpsCallable<CardStatementImportJobIdInput, CardStatementImportJobPayload>(
      functions,
      'analyzeCardStatementImportJob',
      { timeout: START_ANALYSIS_CALLABLE_TIMEOUT_MS },
    );
    const result = await callable({ jobId });
    return {
      ...result.data,
      files: sortFiles(result.data.files || []),
      results: sortResults(result.data.results || []),
    };
  },

  async recoverAnalysisJob(jobId: string): Promise<CardStatementImportJobPayload> {
    const callable = httpsCallable<CardStatementImportJobIdInput, CardStatementImportJobPayload>(
      functions,
      'recoverCardStatementImportJobAnalysis',
      { timeout: LONG_MUTATION_CALLABLE_TIMEOUT_MS },
    );
    const result = await callable({ jobId });
    return {
      ...result.data,
      files: sortFiles(result.data.files || []),
      results: sortResults(result.data.results || []),
    };
  },

  async getJobStatus(jobId: string): Promise<CardStatementImportJobPayload> {
    const callable = httpsCallable<CardStatementImportJobIdInput, CardStatementImportJobPayload>(
      functions,
      'getCardStatementImportJobStatus',
    );
    const result = await callable({ jobId });
    return {
      ...result.data,
      files: sortFiles(result.data.files || []),
      results: sortResults(result.data.results || []),
    };
  },

  async commitJob(jobId: string): Promise<CardStatementImportJobPayload> {
    const callable = httpsCallable<CardStatementImportJobIdInput, CardStatementImportJobPayload>(
      functions,
      'commitCardStatementImportJob',
      { timeout: LONG_MUTATION_CALLABLE_TIMEOUT_MS },
    );
    const result = await callable({ jobId });
    return {
      ...result.data,
      files: sortFiles(result.data.files || []),
      results: sortResults(result.data.results || []),
    };
  },

  subscribeJob(jobId: string, callback: (job: CardStatementImportJob | null) => void): Unsubscribe {
    return onSnapshot(doc(db, COLLECTIONS.jobs, jobId), (snapshot) => {
      callback(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as CardStatementImportJob) : null);
    });
  },

  subscribeFiles(jobId: string, callback: (files: CardStatementImportFile[]) => void): Unsubscribe {
    const q = query(collection(db, COLLECTIONS.files), where('jobId', '==', jobId));
    return onSnapshot(q, (snapshot) => {
      callback(sortFiles(snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      } as CardStatementImportFile))));
    });
  },

  subscribeResults(jobId: string, callback: (results: CardStatementImportResult[]) => void): Unsubscribe {
    const q = query(collection(db, COLLECTIONS.results), where('jobId', '==', jobId));
    return onSnapshot(q, (snapshot) => {
      callback(sortResults(snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      } as CardStatementImportResult))));
    });
  },

  async updateResultReview(
    resultId: string,
    input: Omit<UpdateCardStatementImportResultReviewInput, 'resultId'>,
  ): Promise<CardStatementImportJobPayload> {
    if (!resultId) throw new Error('검수 결과 ID가 없습니다.');
    const callable = httpsCallable<UpdateCardStatementImportResultReviewInput, CardStatementImportJobPayload>(
      functions,
      'updateCardStatementImportResultReview',
    );
    const result = await callable({ resultId, ...input });
    return {
      ...result.data,
      files: sortFiles(result.data.files || []),
      results: sortResults(result.data.results || []),
    };
  },

  async excludeResult(resultId: string, reason = '사용자 제외'): Promise<CardStatementImportJobPayload> {
    return this.updateResultReview(resultId, {
      exclude: true,
      exclusionReason: reason,
    });
  },
};
