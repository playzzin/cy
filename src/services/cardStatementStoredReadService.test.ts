import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { cardStatementImportService } from './cardStatementImportService';
import { getStoredStatementRecordDetail, isStatementReadEndpointUnavailable, listStoredStatementRecords } from './cardStatementStoredReadService';

jest.mock('../config/firebase', () => ({ db: {}, functions: {}, storage: {} }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db, ...segments) => segments.join('/')), doc: jest.fn((_db, name, id) => `${name}/${id}`),
  where: jest.fn((field, _operator, value) => ({ field, value })),
  query: jest.fn((name, constraint) => ({ name, ...constraint })),
  getDocs: jest.fn(), getDoc: jest.fn(), onSnapshot: jest.fn(),
}));
jest.mock('firebase/functions', () => ({ httpsCallable: jest.fn() }));
jest.mock('firebase/storage', () => ({ ref: jest.fn(), uploadBytes: jest.fn(), getDownloadURL: jest.fn(), getBlob: jest.fn() }));

const storedPath = 'card-billing-statements/2026-09/imports/job/source.pdf';
const ledgerPath = 'card-ledger-statements/2026-09/card/row/statement.pdf';
const imported = { id: 'file-1', jobId: 'job-1', yearMonth: '2026-09', storagePath: storedPath, originalFileName: '원본.pdf', status: 'completed', fileIndex: 0 };
const detailResult = (overrides: Record<string, unknown> = {}) => ({
  id: 'details', fileId: 'file-1', jobId: 'job-1', yearMonth: '2026-09', resultIndex: 0,
  analysisSource: 'gemini', sourceStoragePath: storedPath, transactionCount: 1,
  transactions: [{ amount: -5000, merchant: '취소' }], ...overrides,
});
const savedAnalysis = (overrides: Record<string, unknown> = {}) => ({
  id: 'analysis-1', yearMonth: '2026-09', storagePath: storedPath,
  file: { ...imported, cardCount: 1, transactionCount: 2, grandTotalAmount: 45000 },
  activeRunId: 'run-current', analysisStatus: 'completed', ...overrides,
});
const docs = (rows: Record<string, unknown>[]) => ({ docs: rows.map((row, index) => ({ id: row.id || `id-${index}`, data: () => row })) });
let records: Record<string, Record<string, unknown>[]>;
const callable = Object.assign(jest.fn(), { stream: jest.fn() });

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(collection).mockImplementation(((_db: unknown, ...segments: string[]) => segments.join('/')) as any);
  jest.mocked(doc).mockImplementation(((_db: unknown, name: string, id: string) => `${name}/${id}`) as any);
  jest.mocked(where).mockImplementation(((field: string, _operator: string, value: unknown) => ({ field, value })) as any);
  jest.mocked(query).mockImplementation(((name: string, constraint: object) => ({ name, ...constraint })) as any);
  records = {
    cardStatementImportFiles: [imported],
    cardTransactions: [{ statementAttachmentPaths: [storedPath, ledgerPath] }],
    cardBillings: [{ statementAttachmentPaths: [ledgerPath] }],
    cardStatementImportResults: [],
    cardStatementFileAnalyses: [],
  };
  jest.mocked(getDocs).mockImplementation(async (q: any) => docs(records[q.name] || []) as any);
  jest.mocked(getDoc).mockImplementation(async (path: any) => ({ exists: () => path.startsWith('cardStatementImportFiles/'), id: 'file-1', data: () => imported }) as any);
  jest.mocked(httpsCallable).mockReturnValue(callable);
  callable.mockReset().mockRejectedValue(Object.assign(new Error('INTERNAL'), { code: 'functions/internal' }));
});

test('missing callable falls back to stored import and ledger attachments with deduplication', async () => {
  const files = await cardStatementImportService.listStoredFiles('2026-09');
  expect(files).toHaveLength(2);
  expect(files.find(file => file.storagePath === storedPath)?.id).toBe('file-1');
  expect(files.find(file => file.storagePath === ledgerPath)?.jobId).toBe('');
  expect(getDocs).toHaveBeenCalledWith({ name: 'cardTransactions', field: 'yearMonth', value: '2026-09' });
});

test('available callable stays authoritative and does not query legacy records', async () => {
  callable.mockResolvedValue({ data: { ok: true, files: [imported] } });
  expect(await cardStatementImportService.listStoredFiles('2026-09')).toEqual([imported]);
  expect(getDocs).not.toHaveBeenCalled();
});

test('permission denial never becomes an empty list or an alternate access attempt', async () => {
  const denied = Object.assign(new Error('denied'), { code: 'functions/permission-denied' });
  callable.mockRejectedValue(denied);
  await expect(cardStatementImportService.listStoredFiles('2026-09')).rejects.toBe(denied);
  expect(getDocs).not.toHaveBeenCalled();
});

test('a failed source read is reported instead of returning an incomplete successful list', async () => {
  const failure = Object.assign(new Error('Missing permissions'), { code: 'permission-denied' });
  jest.mocked(getDocs).mockRejectedValueOnce(failure);
  await expect(cardStatementImportService.listStoredFiles('2026-09')).rejects.toBe(failure);
});

test('ignores cancelled rows and attachments outside the selected statement namespace', async () => {
  records.cardTransactions = [{ statementAttachmentPaths: [ledgerPath], status: 'CANCELLED' }];
  records.cardBillings = [{ statementAttachmentPaths: ['other/file.pdf', 'card-ledger-statements/2026-08/card/row/file.pdf'] }];
  expect(await listStoredStatementRecords('2026-09')).toEqual([imported]);
});

test('cancelled import stays authoritative over a duplicate attached path', async () => {
  records.cardStatementImportFiles = [{ ...imported, status: 'cancelled' }];
  expect((await listStoredStatementRecords('2026-09')).find(file => file.storagePath === storedPath)?.status).toBe('cancelled');
});

test('reads saved itemized details and retains refund signs while excluding summary-only imports', async () => {
  records.cardStatementImportResults = [
    detailResult({ id: 'summary', analysisSource: 'fast_text', transactions: [{ amount: 100000 }] }),
    detailResult(),
  ];
  const payload = await cardStatementImportService.getFileDetail({ fileId: 'file-1', yearMonth: '2026-09' });
  expect(payload.results.map(result => result.id)).toEqual(['details']);
  expect(payload.results[0].transactions[0].amount).toBe(-5000);
  expect(payload.analysisStatus).toBe('completed');
  expect(payload.analysisAvailable).toBe(false);
  expect(payload.readNotice).toBeTruthy();
});

test('a registered ledger attachment opens without inventing analyzed transactions', async () => {
  const payload = await getStoredStatementRecordDetail({ storagePath: ledgerPath, yearMonth: '2026-09' });
  expect(payload.file.storagePath).toBe(ledgerPath);
  expect(payload.results).toEqual([]);
  expect(payload.analysisStatus).toBe('not_analyzed');
});

test('rejects a file selection in another month', async () => {
  await expect(getStoredStatementRecordDetail({ fileId: 'file-1', yearMonth: '2026-08' })).rejects.toThrow('기존 업로드 기록');
});

test('reads only the active saved detail run and joins long statements in order', async () => {
  records.cardStatementFileAnalyses = [savedAnalysis()];
  records['cardStatementFileAnalyses/analysis-1/results'] = [
    { runId: 'run-current', resultIndex: 0, chunkIndex: 1, result: detailResult({ transactionCount: 2 }) },
    { runId: 'run-current', resultIndex: 0, chunkIndex: 0, result: detailResult({ transactionCount: 2, transactions: [{ amount: 50000, merchant: '구입' }] }) },
  ];
  records.cardStatementImportResults = [detailResult({ transactions: [{ amount: 999 }] })];
  const payload = await getStoredStatementRecordDetail({ storagePath: storedPath, yearMonth: '2026-09' });
  expect(payload.results[0].transactions.map(row => row.amount)).toEqual([50000, -5000]);
  expect(payload.file.grandTotalAmount).toBe(45000);
  expect(payload.analysisStatus).toBe('completed');
  expect(getDocs).toHaveBeenCalledWith({ name: 'cardStatementFileAnalyses/analysis-1/results', field: 'runId', value: 'run-current' });
  expect(getDocs).not.toHaveBeenCalledWith(expect.objectContaining({ name: 'cardStatementImportResults' }));
});

test('includes saved standalone analysis files in fallback without an import or ledger attachment', async () => {
  records.cardStatementFileAnalyses = [savedAnalysis({
    storagePath: ledgerPath,
    file: { ...imported, id: 'stored_analysis-1', jobId: '', storagePath: ledgerPath, cardCount: 1 },
  })];
  records.cardTransactions = [];
  records.cardBillings = [];
  records['cardStatementFileAnalyses/analysis-1/results'] = [
    { runId: 'run-current', resultIndex: 0, chunkIndex: 0, result: detailResult({ sourceStoragePath: ledgerPath, fileId: 'stored_analysis-1', jobId: '' }) },
  ];
  const payload = await getStoredStatementRecordDetail({ storagePath: ledgerPath, yearMonth: '2026-09' });
  expect(payload.file.id).toBe('stored_analysis-1');
  expect(payload.results).toHaveLength(1);
});

test('saved analysis cannot revive a cancelled import or expose its transactions', async () => {
  records.cardStatementImportFiles = [{ ...imported, status: 'cancelled' }];
  records.cardStatementFileAnalyses = [savedAnalysis()];
  await expect(getStoredStatementRecordDetail({ storagePath: storedPath, yearMonth: '2026-09' })).rejects.toThrow('취소된 명세서');
  expect(getDocs).not.toHaveBeenCalledWith(expect.objectContaining({ name: 'cardStatementFileAnalyses/analysis-1/results' }));
});

test('legacy results from another month or file and cancelled results are never returned', async () => {
  records.cardStatementImportResults = [
    detailResult({ yearMonth: '2026-08' }), detailResult({ fileId: 'other' }),
    detailResult({ cancelledAt: { seconds: 1 } }), detailResult({ sourceStoragePath: ledgerPath }),
  ];
  expect((await getStoredStatementRecordDetail({ fileId: 'file-1' })).results).toEqual([]);
});

test.each([
  ['another run', { runId: 'old-run' }],
  ['missing first chunk', { chunkIndex: 1 }],
  ['another month', { result: detailResult({ yearMonth: '2026-08' }) }],
  ['another file', { result: detailResult({ sourceStoragePath: ledgerPath }) }],
  ['summary-only result', { result: detailResult({ analysisSource: 'fast_text' }) }],
  ['missing transactions', { result: detailResult({ transactionCount: 2 }) }],
])('refuses incomplete or unrelated saved details: %s', async (_reason, overrides) => {
  records.cardStatementFileAnalyses = [savedAnalysis()];
  records['cardStatementFileAnalyses/analysis-1/results'] = [
    { runId: 'run-current', resultIndex: 0, chunkIndex: 0, result: detailResult(), ...overrides },
  ];
  await expect(getStoredStatementRecordDetail({ fileId: 'file-1' })).rejects.toThrow('저장된 상세 분석 결과가 완전하지 않습니다');
});

test('a saved-detail permission failure is propagated without returning legacy results', async () => {
  records.cardStatementFileAnalyses = [savedAnalysis()];
  const denied = Object.assign(new Error('Missing permissions'), { code: 'permission-denied' });
  jest.mocked(getDocs).mockImplementation(async (q: any) => {
    if (q.name === 'cardStatementFileAnalyses/analysis-1/results') throw denied;
    return docs(records[q.name] || []) as any;
  });
  await expect(getStoredStatementRecordDetail({ fileId: 'file-1' })).rejects.toBe(denied);
  expect(getDocs).not.toHaveBeenCalledWith(expect.objectContaining({ name: 'cardStatementImportResults' }));
});

test('an interrupted saved analysis remains failed while retaining its previous complete details', async () => {
  records.cardStatementFileAnalyses = [savedAnalysis({ analysisStatus: 'analyzing', analysisStartedAtMillis: Date.now() - 700000 })];
  records['cardStatementFileAnalyses/analysis-1/results'] = [
    { runId: 'run-current', resultIndex: 0, chunkIndex: 0, result: detailResult() },
  ];
  const payload = await getStoredStatementRecordDetail({ fileId: 'file-1' });
  expect(payload.analysisStatus).toBe('failed');
  expect(payload.analysisError).toContain('중단');
  expect(payload.results).toHaveLength(1);
});

test('does not replace meaningful server errors with legacy results', () => {
  expect(isStatementReadEndpointUnavailable({ code: 'functions/internal', message: '분석 결과 검증 실패' })).toBe(false);
  expect(isStatementReadEndpointUnavailable({ code: 'functions/not-found', message: '업로드한 명세서를 찾을 수 없습니다.' })).toBe(false);
  expect(isStatementReadEndpointUnavailable({ code: 'functions/not-found', message: 'NOT FOUND' })).toBe(true);
});
