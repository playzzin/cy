import type { CardStatementFileDetailPayload, CardStatementImportFile, StoredCardStatementInput } from '../types/cardStatementImport';
import { cardStatementImportService } from './cardStatementImportService';

export const needsCardStatementDetailAnalysis = (file: CardStatementImportFile): boolean => {
  if (['uploading', 'cancelled', 'analyzing'].includes(file.status)) return false;
  if (file.detailAnalysisStatus) return ['not_analyzed', 'failed'].includes(file.detailAnalysisStatus);
  return !(file.analysisSource === 'gemini' && file.transactionCount > 0);
};

export const cardStatementAnalysisInput = (file: CardStatementImportFile, yearMonth: string): StoredCardStatementInput =>
  file.jobId ? { fileId: file.id, yearMonth } : { storagePath: file.storagePath, yearMonth, originalFileName: file.originalFileName };

export interface CardStatementBulkFailure {
  file: CardStatementImportFile;
  message: string;
}

export interface CardStatementBulkProgress {
  total: number;
  processed: number;
  succeeded: number;
  skipped: number;
  failures: CardStatementBulkFailure[];
  currentFileName: string;
  stopped: boolean;
  stopReason?: string;
}

const describeError = (cause: unknown): string => {
  const code = String((cause as { code?: string })?.code || '');
  if (code === 'functions/resource-exhausted') return '분석 요청 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.';
  if (['functions/unauthenticated', 'functions/permission-denied'].includes(code)) return '현재 로그인 계정으로 분석할 수 없습니다. 로그인 상태를 확인해 주세요.';
  const message = cause instanceof Error ? cause.message : '';
  return message && !/^(internal|unavailable|unknown)$/i.test(message) ? message : '분석 연결에 실패했습니다. 다시 시도해 주세요.';
};

export async function runCardStatementBulkAnalysis(options: {
  files: CardStatementImportFile[];
  yearMonth: string;
  shouldStop: () => boolean;
  onProgress: (progress: CardStatementBulkProgress) => void;
  onFile: (payload: CardStatementFileDetailPayload) => void;
}): Promise<CardStatementBulkProgress> {
  const seen = new Set<string>();
  const files = options.files.filter(file => {
    const key = file.storagePath || file.id;
    if (file.yearMonth !== options.yearMonth || !needsCardStatementDetailAnalysis(file) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const progress: CardStatementBulkProgress = { total: files.length, processed: 0, succeeded: 0, skipped: 0, failures: [], currentFileName: '', stopped: false };
  const publish = () => options.onProgress({ ...progress, failures: [...progress.failures] });
  publish();
  for (const file of files) {
    if (options.shouldStop()) { progress.stopped = true; break; }
    progress.currentFileName = file.originalFileName;
    publish();
    const input = cardStatementAnalysisInput(file, options.yearMonth);
    try {
      // Another tab/user may have finished or cancelled this file since the list loaded.
      const latest = await cardStatementImportService.getFileDetail(input);
      options.onFile(latest);
      if (options.shouldStop()) { progress.stopped = true; break; }
      if (latest.analysisAvailable === false) {
        progress.stopReason = '상세 분석 서버에 연결할 수 없습니다. 새로고침한 후 다시 시도해 주세요.';
        progress.stopped = true;
        break;
      }
      if (['completed', 'analyzing'].includes(latest.analysisStatus) || ['cancelled', 'uploading', 'analyzing'].includes(latest.file.status)) {
        progress.skipped += 1;
      } else {
        const result = await cardStatementImportService.analyzeStoredFile(input);
        options.onFile(result);
        if (result.analysisStatus !== 'completed') throw new Error(result.analysisError || '분석이 아직 완료되지 않았습니다. 잠시 후 다시 확인해 주세요.');
        progress.succeeded += 1;
      }
    } catch (cause) {
      // A response can be lost after the server has saved the result. Reconcile
      // before offering a retry so completed files are never analyzed twice.
      let recovered: CardStatementFileDetailPayload | undefined;
      try { recovered = await cardStatementImportService.getFileDetail(input); } catch { /* Keep the original failure. */ }
      if (recovered) options.onFile(recovered);
      if (recovered?.analysisStatus === 'completed') progress.succeeded += 1;
      else if (recovered?.analysisStatus === 'analyzing') progress.skipped += 1;
      else progress.failures.push({ file, message: describeError(cause) });
      const code = String((cause as { code?: string })?.code || '');
      if (['functions/unauthenticated', 'functions/permission-denied', 'functions/resource-exhausted', 'functions/unavailable'].includes(code)) {
        progress.stopReason = describeError(cause);
        progress.stopped = true;
      }
    }
    progress.processed += 1;
    publish();
    if (progress.stopped) break;
  }
  progress.currentFileName = '';
  progress.stopped ||= options.shouldStop() && progress.processed < progress.total;
  publish();
  return progress;
}
