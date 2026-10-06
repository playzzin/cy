import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { CardStatementFileDetailPayload, CardStatementImportFile, CardStatementImportJob, CardStatementImportResult, StoredCardStatementInput } from '../types/cardStatementImport';
import { getCardStatementFileName } from './cardStatementAttachmentService';

// Older servers already store these records. Reading them does not require the
// newly added callables, and still uses the signed-in user's Firestore rules.
const readMonth = (collectionName: string, yearMonth: string) => getDocs(
  query(collection(db, collectionName), where('yearMonth', '==', yearMonth)),
);

const matchesMonth = (path: string, yearMonth: string) =>
  path.startsWith(`card-billing-statements/${yearMonth}/`) || path.startsWith(`card-ledger-statements/${yearMonth}/`);

export const isStatementReadEndpointUnavailable = (error: unknown): boolean => {
  const { code, message } = (error || {}) as { code?: string; message?: string };
  return code === 'functions/unavailable'
    || (code === 'functions/internal' && /^(internal|unknown)$/i.test(message || ''))
    || (code === 'functions/not-found' && /^not[ -]found$/i.test(message || ''));
};

export const listStoredStatementRecords = async (yearMonth: string): Promise<CardStatementImportFile[]> => {
  const [imports, transactions, billings] = await Promise.all([
    readMonth('cardStatementImportFiles', yearMonth),
    readMonth('cardTransactions', yearMonth),
    readMonth('cardBillings', yearMonth),
  ]);
  const byPath = new Map<string, CardStatementImportFile>();
  imports.docs.forEach(entry => {
    const file = { ...entry.data(), id: entry.id } as CardStatementImportFile;
    if (file.storagePath) byPath.set(file.storagePath, file);
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
  if (!file || (input.yearMonth && input.yearMonth !== file.yearMonth)
    || (input.storagePath && input.storagePath !== file.storagePath)) {
    throw new Error('기존 업로드 기록에서 명세서를 찾을 수 없습니다. 목록을 새로고침해 주세요.');
  }
  let results: CardStatementImportResult[] = [];
  let job: CardStatementImportJob | null = null;
  if (file.jobId) {
    const [resultSnapshot, jobSnapshot] = await Promise.all([
      getDocs(query(collection(db, 'cardStatementImportResults'), where('fileId', '==', file.id))),
      getDoc(doc(db, 'cardStatementImportJobs', file.jobId)),
    ]);
    // Fast-text imports contain summary amounts, not itemized card usage.
    results = resultSnapshot.docs.map(entry => ({ ...entry.data(), id: entry.id } as CardStatementImportResult))
      .filter(result => result.analysisSource !== 'fast_text');
    if (jobSnapshot.exists()) job = { ...jobSnapshot.data(), id: jobSnapshot.id } as CardStatementImportJob;
  }
  return {
    ok: true, file, job, results,
    analysisStatus: results.some(result => result.transactions?.length) ? 'completed' : 'not_analyzed',
    analysisAvailable: false,
    readNotice: '기존 업로드 기록을 표시하고 있습니다. 현재 새 상세 분석 기능에 연결할 수 없습니다.',
  };
};
