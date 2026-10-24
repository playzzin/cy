import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { CardStatementFileAnalysisStatus, CardStatementFileDetailPayload, CardStatementImportFile, CardStatementImportJob, CardStatementImportResult, StoredCardStatementInput } from '../types/cardStatementImport';
import { getCardStatementFileName } from './cardStatementAttachmentService';

// Older servers already store these records. Reading them does not require the
// newly added callables, and still uses the signed-in user's Firestore rules.
const readMonth = (collectionName: string, yearMonth: string) => getDocs(
  query(collection(db, collectionName), where('yearMonth', '==', yearMonth)),
);

const matchesMonth = (path: string, yearMonth: string) =>
  /^(card-billing-statements|card-ledger-statements|card-statement-imports)\/\d{4}-(0[1-9]|1[0-2])\/.+/.test(path)
  && path.split('/')[1] === yearMonth && !path.includes('..') && !/[\\\r\n?#]/.test(path)
  && path.split('/').every(Boolean);

interface SavedFileAnalysis {
  id: string;
  yearMonth: string;
  storagePath: string;
  file: CardStatementImportFile;
  activeRunId?: string;
  analysisStatus?: CardStatementFileAnalysisStatus;
  analysisStartedAtMillis?: number;
  analysisError?: string;
  analyzedAt?: CardStatementFileDetailPayload['analyzedAt'];
}

const analysisState = (analysis: SavedFileAnalysis) => {
  if (analysis.analysisStatus === 'analyzing'
    && (!Number.isFinite(Number(analysis.analysisStartedAtMillis)) || Number(analysis.analysisStartedAtMillis) <= Date.now() - 600_000)) {
    return { analysisStatus: 'failed' as const, analysisError: '분석 응답이 중단되었습니다. 상세 분석 기능에 연결된 뒤 다시 분석해 주세요.' };
  }
  return { analysisStatus: analysis.analysisStatus, analysisError: analysis.analysisError };
};

const isMatchingAnalysis = (analysis: SavedFileAnalysis, yearMonth: string, storagePath = analysis.storagePath) =>
  analysis.yearMonth === yearMonth && analysis.storagePath === storagePath
  && analysis.file?.yearMonth === yearMonth && analysis.file.storagePath === storagePath
  && matchesMonth(storagePath, yearMonth);

const mergeAnalyzedFile = (file: CardStatementImportFile, analysis: SavedFileAnalysis): CardStatementImportFile => ({
  ...file,
  ...(analysis.activeRunId ? analysis.file : {}),
  id: file.id, jobId: file.jobId, status: file.status,
  detailAnalysisStatus: analysisState(analysis).analysisStatus,
});

export const isStatementReadEndpointUnavailable = (error: unknown): boolean => {
  const { code, message } = (error || {}) as { code?: string; message?: string };
  return code === 'functions/unavailable'
    || (code === 'functions/internal' && /^(internal|unknown)$/i.test(message || ''))
    || (code === 'functions/not-found' && /^not[ -]found$/i.test(message || ''));
};

export const listStoredStatementRecords = async (yearMonth: string): Promise<CardStatementImportFile[]> => {
  const [imports, transactions, billings, analyses] = await Promise.all([
    readMonth('cardStatementImportFiles', yearMonth),
    readMonth('cardTransactions', yearMonth),
    readMonth('cardBillings', yearMonth),
    readMonth('cardStatementFileAnalyses', yearMonth),
  ]);
  const byPath = new Map<string, CardStatementImportFile>();
  imports.docs.forEach(entry => {
    const file = { ...entry.data(), id: entry.id } as CardStatementImportFile;
    if (file.yearMonth === yearMonth && matchesMonth(file.storagePath || '', yearMonth)) byPath.set(file.storagePath, file);
  });
  analyses.docs.forEach(entry => {
    const analysis = { ...entry.data(), id: entry.id } as SavedFileAnalysis;
    if (!isMatchingAnalysis(analysis, yearMonth)) return;
    const file = byPath.get(analysis.storagePath) || analysis.file;
    byPath.set(analysis.storagePath, mergeAnalyzedFile(file, analysis));
  });
  [...transactions.docs, ...billings.docs].forEach(entry => {
    const row = entry.data();
    if (row.status === 'CANCELLED' || row.cancelledAt) return;
    const paths: unknown[] = Array.isArray(row.statementAttachmentPaths) ? row.statementAttachmentPaths : [];
    paths.forEach(path => {
      if (typeof path !== 'string' || !matchesMonth(path, yearMonth) || byPath.has(path)) return;
      const fileName = getCardStatementFileName(path);
      byPath.set(path, {
        id: `attachment:${path}`, jobId: '', yearMonth, fileIndex: 0, storagePath: path,
        originalFileName: paths.length === 1 && typeof row.statementOriginalFileName === 'string'
          ? row.statementOriginalFileName : fileName,
        mimeType: /\.pdf$/i.test(fileName) ? 'application/pdf' : '', size: 0,
        status: 'uploaded', cardCount: 0, transactionCount: 0, warnings: [],
        createdAt: row.createdAt,
      });
    });
  });
  return [...byPath.values()];
};

export const getStoredStatementRecordDetail = async (input: StoredCardStatementInput): Promise<CardStatementFileDetailPayload> => {
  let file: CardStatementImportFile | undefined;
  if (input.fileId && !input.fileId.startsWith('stored_') && !input.fileId.startsWith('attachment:')) {
    if (input.fileId.includes('/')) throw new Error('명세서 파일 ID가 올바르지 않습니다.');
    const snapshot = await getDoc(doc(db, 'cardStatementImportFiles', input.fileId));
    if (snapshot.exists()) file = { ...snapshot.data(), id: snapshot.id } as CardStatementImportFile;
  } else if (input.storagePath && input.yearMonth) {
    file = (await listStoredStatementRecords(input.yearMonth)).find(item => item.storagePath === input.storagePath);
  }
  if (!file || !matchesMonth(file.storagePath || '', file.yearMonth) || (input.yearMonth && input.yearMonth !== file.yearMonth)
    || (input.storagePath && input.storagePath !== file.storagePath)) {
    throw new Error('기존 업로드 기록에서 명세서를 찾을 수 없습니다. 목록을 새로고침해 주세요.');
  }
  if (file.status === 'cancelled') throw new Error('취소된 명세서의 상세내역은 조회할 수 없습니다.');
  const analysisSnapshot = await getDocs(query(collection(db, 'cardStatementFileAnalyses'), where('storagePath', '==', file.storagePath)));
  if (analysisSnapshot.docs.length > 1) throw new Error('저장된 명세서 분석이 중복되어 상세내역을 확인할 수 없습니다.');
  const analysisEntry = analysisSnapshot.docs[0];
  const analysis = analysisEntry ? { ...analysisEntry.data(), id: analysisEntry.id } as SavedFileAnalysis : undefined;
  if (analysis && (!isMatchingAnalysis(analysis, file.yearMonth, file.storagePath) || analysis.file.status === 'cancelled')) {
    throw new Error('저장된 상세 분석의 월 또는 파일 정보가 일치하지 않습니다.');
  }
  let results: CardStatementImportResult[] = [];
  let job: CardStatementImportJob | null = null;
  if (file.jobId) {
    if (file.jobId.includes('/')) throw new Error('명세서 작업 ID가 올바르지 않습니다.');
    const jobSnapshot = await getDoc(doc(db, 'cardStatementImportJobs', file.jobId));
    if (jobSnapshot.exists()) {
      job = { ...jobSnapshot.data(), id: jobSnapshot.id } as CardStatementImportJob;
      if (job.yearMonth !== file.yearMonth) throw new Error('명세서 작업의 월이 일치하지 않습니다.');
    }
  }
  if (analysis?.activeRunId) {
    const chunks = await getDocs(query(collection(db, 'cardStatementFileAnalyses', analysis.id, 'results'), where('runId', '==', analysis.activeRunId)));
    const grouped = new Map<number, CardStatementImportResult>();
    const nextChunk = new Map<number, number>();
    const invalidDetails = () => new Error('저장된 상세 분석 결과가 완전하지 않습니다. 상세 분석 기능에 연결된 뒤 다시 분석해 주세요.');
    if (chunks.docs.length === 0) throw invalidDetails();
    for (const chunk of chunks.docs.map(entry => entry.data()).sort((a, b) => a.resultIndex - b.resultIndex || a.chunkIndex - b.chunkIndex)) {
      const result = chunk.result as CardStatementImportResult | undefined;
      if (chunk.runId !== analysis.activeRunId || !Number.isInteger(chunk.resultIndex) || chunk.resultIndex < 0
        || chunk.chunkIndex !== (nextChunk.get(chunk.resultIndex) || 0) || !result || !Array.isArray(result.transactions)
        || result.resultIndex !== chunk.resultIndex || result.yearMonth !== file.yearMonth || result.sourceStoragePath !== file.storagePath
        || result.analysisSource === 'fast_text' || (result as CardStatementImportResult & { cancelledAt?: unknown }).cancelledAt) {
        throw invalidDetails();
      }
      const existing = grouped.get(chunk.resultIndex);
      if (existing && (existing.id !== result.id || existing.transactionCount !== result.transactionCount)) throw invalidDetails();
      if (existing) existing.transactions.push(...result.transactions);
      else grouped.set(chunk.resultIndex, { ...result, transactions: [...result.transactions] });
      nextChunk.set(chunk.resultIndex, chunk.chunkIndex + 1);
    }
    results = [...grouped.values()];
    if (results.some((result, index) => result.resultIndex !== index || result.transactionCount !== result.transactions.length)
      || (Number.isFinite(analysis.file.cardCount) && analysis.file.cardCount !== results.length)) throw invalidDetails();
  } else if (file.jobId) {
    const resultSnapshot = await getDocs(query(collection(db, 'cardStatementImportResults'), where('fileId', '==', file.id)));
    // Fast-text imports contain summary amounts, not itemized card usage.
    results = resultSnapshot.docs.map(entry => ({ ...entry.data(), id: entry.id } as CardStatementImportResult))
      .filter(result => result.analysisSource !== 'fast_text'
        && !(result as CardStatementImportResult & { cancelledAt?: unknown }).cancelledAt
        && result.fileId === file!.id && result.yearMonth === file!.yearMonth
        && (!result.sourceStoragePath || result.sourceStoragePath === file!.storagePath))
      .sort((a, b) => a.resultIndex - b.resultIndex);
  }
  const state = analysis ? analysisState(analysis) : { analysisStatus: undefined, analysisError: undefined };
  return {
    ok: true, file: analysis ? mergeAnalyzedFile(file, analysis) : file, job, results,
    analysisStatus: state.analysisStatus || (results.some(result => result.transactions?.length) ? 'completed' : 'not_analyzed'),
    analysisError: state.analysisError,
    analyzedAt: analysis?.analyzedAt,
    analysisAvailable: false,
    readNotice: '기존 업로드 기록을 표시하고 있습니다. 현재 새 상세 분석 기능에 연결할 수 없습니다.',
  };
};
