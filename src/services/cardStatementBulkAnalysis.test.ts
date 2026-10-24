import { cardStatementImportService } from './cardStatementImportService';
import { needsCardStatementDetailAnalysis, runCardStatementBulkAnalysis } from './cardStatementBulkAnalysis';
import type { CardStatementFileDetailPayload, CardStatementImportFile } from '../types/cardStatementImport';

jest.mock('./cardStatementImportService', () => ({ cardStatementImportService: { getFileDetail: jest.fn(), analyzeStoredFile: jest.fn() } }));
const service = jest.mocked(cardStatementImportService);
const file = (id: string, patch: Partial<CardStatementImportFile> = {}): CardStatementImportFile => ({
  id, jobId: 'job', yearMonth: '2026-08', fileIndex: 0, storagePath: `card-billing-statements/2026-08/imports/job/${id}.pdf`,
  originalFileName: `${id}.pdf`, mimeType: 'application/pdf', size: 100, status: 'completed', cardCount: 1, transactionCount: 1,
  analysisSource: 'fast_text', warnings: [], ...patch,
});
const pending = (value: CardStatementImportFile): CardStatementFileDetailPayload => ({ ok: true, file: value, job: null, results: [], analysisStatus: 'not_analyzed' });
const complete = (value: CardStatementImportFile): CardStatementFileDetailPayload => ({ ...pending(value), analysisStatus: 'completed' });
const run = (files: CardStatementImportFile[], patch = {}) => runCardStatementBulkAnalysis({ files, yearMonth: '2026-08', shouldStop: () => false, onProgress: jest.fn(), onFile: jest.fn(), ...patch });

beforeEach(() => {
  jest.resetAllMocks();
  service.getFileDetail.mockImplementation(async input => pending(file(input.fileId || 'legacy', { ...(input.storagePath ? { storagePath: input.storagePath, jobId: '' } : {}) })));
  service.analyzeStoredFile.mockImplementation(async input => complete(file(input.fileId || 'legacy')));
});

test('targets unprocessed and failed files, never completed or in-progress files', () => {
  expect(needsCardStatementDetailAnalysis(file('summary'))).toBe(true);
  expect(needsCardStatementDetailAnalysis(file('failed', { detailAnalysisStatus: 'failed' }))).toBe(true);
  expect(needsCardStatementDetailAnalysis(file('saved', { detailAnalysisStatus: 'completed' }))).toBe(false);
  expect(needsCardStatementDetailAnalysis(file('saved-import', { analysisSource: 'gemini' }))).toBe(false);
  expect(needsCardStatementDetailAnalysis(file('verified-pdf', { analysisSource: 'pdf_text' }))).toBe(false);
  expect(needsCardStatementDetailAnalysis(file('empty-pdf', { analysisSource: 'pdf_text', transactionCount: 0 }))).toBe(true);
  for (const status of ['cancelled', 'uploading', 'analyzing'] as const) expect(needsCardStatementDetailAnalysis(file(status, { status }))).toBe(false);
  expect(needsCardStatementDetailAnalysis(file('busy', { detailAnalysisStatus: 'analyzing' }))).toBe(false);
});

test('filters by month, deduplicates paths, and publishes saved results', async () => {
  const onFile = jest.fn();
  const result = await run([file('one'), file('duplicate', { storagePath: file('one').storagePath }), file('other-month', { yearMonth: '2026-07' }), file('done', { detailAnalysisStatus: 'completed' }), file('two')], { onFile });
  expect(result).toMatchObject({ total: 2, processed: 2, succeeded: 2, failures: [], stopped: false });
  expect(service.analyzeStoredFile.mock.calls.map(([input]) => input.fileId)).toEqual(['one', 'two']);
  expect(onFile.mock.calls.filter(([payload]) => payload.analysisStatus === 'completed')).toHaveLength(2);
});

test('rechecks saved or running files before spending another analysis request', async () => {
  service.getFileDetail.mockResolvedValueOnce(complete(file('one'))).mockResolvedValueOnce({ ...pending(file('two')), analysisStatus: 'analyzing' });
  const result = await run([file('one'), file('two')]);
  expect(result).toMatchObject({ processed: 2, succeeded: 0, skipped: 2 });
  expect(service.analyzeStoredFile).not.toHaveBeenCalled();
});

test('runs sequentially and stops after the current file without losing its saved result', async () => {
  let finish!: (payload: CardStatementFileDetailPayload) => void;
  let stop = false;
  service.analyzeStoredFile.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const work = run([file('one'), file('two')], { shouldStop: () => stop });
  await Promise.resolve();
  expect(service.analyzeStoredFile).toHaveBeenCalledTimes(1);
  stop = true;
  finish(complete(file('one')));
  const result = await work;
  expect(result).toMatchObject({ total: 2, processed: 1, succeeded: 1, stopped: true });
  expect(service.analyzeStoredFile).toHaveBeenCalledTimes(1);
});

test('an individual file failure does not block later files', async () => {
  service.analyzeStoredFile.mockRejectedValueOnce(new Error('PDF를 읽을 수 없습니다.'));
  const result = await run([file('one'), file('two')]);
  expect(result).toMatchObject({ processed: 2, succeeded: 1, stopped: false });
  expect(result.failures).toEqual([{ file: file('one'), message: 'PDF를 읽을 수 없습니다.' }]);
});

test('a lost response reconciles the saved result instead of offering duplicate analysis', async () => {
  service.getFileDetail.mockResolvedValueOnce(pending(file('one'))).mockResolvedValueOnce(complete(file('one')));
  service.analyzeStoredFile.mockRejectedValueOnce(new Error('connection lost'));
  expect(await run([file('one')])).toMatchObject({ succeeded: 1, failures: [] });
});

test('quota or login failures stop the queue instead of failing every file', async () => {
  service.analyzeStoredFile.mockRejectedValueOnce(Object.assign(new Error('quota'), { code: 'functions/resource-exhausted' }));
  const result = await run([file('one'), file('two')]);
  expect(result).toMatchObject({ processed: 1, succeeded: 0, stopped: true });
  expect(result.stopReason).toContain('요청 한도');
  expect(service.analyzeStoredFile).toHaveBeenCalledTimes(1);
});

test('server unavailability stops before attempting an analysis', async () => {
  service.getFileDetail.mockResolvedValueOnce({ ...pending(file('one')), analysisAvailable: false });
  expect(await run([file('one'), file('two')])).toMatchObject({ processed: 0, stopped: true });
  expect(service.analyzeStoredFile).not.toHaveBeenCalled();
});

test('plain ledger attachments use their storage path instead of an import id', async () => {
  const attachment = file('attachment', { jobId: '' });
  await run([attachment]);
  expect(service.analyzeStoredFile).toHaveBeenCalledWith({ storagePath: attachment.storagePath, yearMonth: '2026-08', originalFileName: attachment.originalFileName });
});
