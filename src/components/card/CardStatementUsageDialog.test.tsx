import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { CardStatementFileDetailPayload, CardStatementImportResult } from '../../types/cardStatementImport';
import { cardStatementImportService } from '../../services/cardStatementImportService';
import CardStatementUsageDialog from './CardStatementUsageDialog';

jest.mock('../../services/cardStatementImportService', () => ({ cardStatementImportService: { getFileDetail: jest.fn(), analyzeStoredFile: jest.fn() } }));
jest.mock('../../services/cardStatementAttachmentService', () => ({ getCardStatementFileName: (path: string) => path.split('/').pop() || '명세서' }));
jest.mock('./CardStatementFilesDialog', () => ({
  __esModule: true,
  default: ({ paths, onClose }: { paths: string[]; onClose: () => void }) => {
    const { createPortal } = jest.requireActual('react-dom');
    return createPortal(<div role="dialog" aria-label="원본 파일"><span>{paths[0]}</span><button type="button" onClick={onClose}>원본 닫기</button></div>, globalThis.document.body);
  },
}));

const service = cardStatementImportService as jest.Mocked<typeof cardStatementImportService>;
const first = 'card-ledger-statements/2026-09/first.pdf';
const second = 'card-ledger-statements/2026-09/second.pdf';
const result = (amount = 15000, merchant = '첫 파일 식당', extra: Partial<CardStatementImportResult> = {}): CardStatementImportResult => ({
  id: merchant, jobId: 'job', fileId: 'file', fileIndex: 0, resultIndex: 0, yearMonth: '2026-09',
  matchedCardId: 'card-1', cardLast4: '1234', matchConfidence: 1, matchCandidates: [], status: 'matched',
  subtotalAmount: amount, statementTotalAvailable: true, transactionCount: 1, warnings: [],
  transactions: [{ id: '1', date: '2026-09-01', merchant, amount, category: 'MEAL', confidence: 1 }], ...extra,
});
const payload = (path = first, results = [result()]): CardStatementFileDetailPayload => ({
  ok: true, job: null, results, analysisStatus: 'completed',
  file: { id: path, jobId: 'job', yearMonth: '2026-09', fileIndex: 0, storagePath: path, originalFileName: path === first ? '첫 명세서.pdf' : '둘째 명세서.pdf', mimeType: 'application/pdf', size: 500, status: 'completed', cardCount: results.length, transactionCount: results.length, warnings: [] },
});
const props = { yearMonth: '2026-09', cardId: 'card-1', cardLast4: '1234', cardName: '법인카드', ledgerTotal: 15000, paths: [first], onClose: jest.fn() };
const summary = () => within(screen.getByRole('region', { name: '연결된 전체 PDF · 월 사용금액 대조' }));

beforeEach(() => {
  jest.resetAllMocks();
  service.getFileDetail.mockImplementation(async input => payload(input.storagePath));
  service.analyzeStoredFile.mockResolvedValue(payload());
});

test('opens stored analysis and original from the ledger without automatically analyzing', async () => {
  render(<CardStatementUsageDialog {...props} />);
  expect(await screen.findByRole('cell', { name: '첫 파일 식당' })).toBeInTheDocument();
  expect(summary().getByText('일치', { exact: true })).toBeInTheDocument();
  expect(service.getFileDetail).toHaveBeenCalledWith({ storagePath: first, yearMonth: '2026-09' });
  expect(service.analyzeStoredFile).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '원본 열기' }));
  expect(screen.getByRole('dialog', { name: '원본 파일' })).toHaveTextContent(first);
  fireEvent.click(screen.getByRole('button', { name: '원본 닫기' }));
  fireEvent.click(screen.getByRole('button', { name: '사용내역 상세 닫기' }));
  expect(props.onClose).toHaveBeenCalledTimes(1);
});

test('keeps the monthly reconciliation across file selection and filtering, and excludes other cards', async () => {
  service.getFileDetail.mockImplementation(async input => payload(input.storagePath, input.storagePath === first ? [result(), result(999, '다른 카드 식당', { matchedCardId: 'card-2' })] : [result(5000, '둘째 파일 카페')]));
  render(<CardStatementUsageDialog {...props} ledgerTotal={20000} paths={[first, second]} />);
  expect(await screen.findByRole('cell', { name: '둘째 파일 카페' })).toBeInTheDocument();
  expect(summary().getByText('일치', { exact: true })).toBeInTheDocument();
  expect(summary().getAllByText('20,000원')).toHaveLength(3);
  fireEvent.change(screen.getByLabelText('상세 조회할 PDF'), { target: { value: first } });
  expect(screen.getByRole('cell', { name: '첫 파일 식당' })).toBeInTheDocument();
  expect(screen.queryByRole('cell', { name: '다른 카드 식당' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('사용내역 검색'), { target: { value: '없는 내역' } });
  expect(screen.getByText('검색 조건에 맞는 사용내역이 없습니다.')).toBeInTheDocument();
  expect(summary().getAllByText('20,000원')).toHaveLength(3);
  expect(summary().getByText('일치', { exact: true })).toBeInTheDocument();
});

test('analyzes only after an explicit click and then permits reanalysis', async () => {
  const pending: CardStatementFileDetailPayload = { ...payload(), results: [], analysisStatus: 'not_analyzed' };
  service.getFileDetail.mockResolvedValueOnce(pending).mockResolvedValue(payload());
  render(<CardStatementUsageDialog {...props} />);
  fireEvent.click(await screen.findByRole('button', { name: '선택 PDF 분석 및 저장' }));
  await screen.findByRole('cell', { name: '첫 파일 식당' });
  expect(service.analyzeStoredFile).toHaveBeenCalledTimes(1);
  expect(service.analyzeStoredFile).toHaveBeenCalledWith({ storagePath: first, yearMonth: '2026-09' });
  const button = await screen.findByRole('button', { name: '선택 PDF 재분석 및 저장' });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
  await waitFor(() => expect(service.analyzeStoredFile).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(button).toBeEnabled());
});

test('never shows an empty or unprocessed statement as a match', async () => {
  service.getFileDetail.mockResolvedValue({ ...payload(), results: [], analysisStatus: 'not_analyzed' });
  render(<CardStatementUsageDialog {...props} ledgerTotal={0} />);
  await screen.findByRole('button', { name: '선택 PDF 분석 및 저장' });
  expect(summary().queryByText('일치', { exact: true })).not.toBeInTheDocument();
  expect(summary().getByText(/모든 연결 파일의 분석이 완료/)).toBeInTheDocument();
});

test('withholds whole-month agreement if another connected file failed, then retries', async () => {
  service.getFileDetail.mockImplementation(async input => { if (input.storagePath === second) throw new Error('조회 연결 실패'); return payload(); });
  render(<CardStatementUsageDialog {...props} paths={[first, second]} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('조회 연결 실패');
  expect(summary().queryByText('일치', { exact: true })).not.toBeInTheDocument();
  expect(screen.getByText(/파일 1개를 조회하지 못했습니다/)).toBeInTheDocument();
  service.getFileDetail.mockResolvedValue(payload(second, [result(5000, '복구 카페')]));
  fireEvent.click(screen.getByRole('button', { name: '선택 파일 다시 불러오기' }));
  expect(await screen.findByRole('cell', { name: '복구 카페' })).toBeInTheDocument();
  expect(summary().getByText('불일치', { exact: true })).toBeInTheDocument();
});

test('deduplicates identical source PDFs and repeated paths in the whole-month sum', async () => {
  service.getFileDetail.mockImplementation(async input => {
    const detail = payload(input.storagePath);
    detail.file.sha256 = 'same-source-hash';
    return detail;
  });
  render(<CardStatementUsageDialog {...props} paths={[first, second, first]} />);
  await screen.findByRole('cell', { name: '첫 파일 식당' });
  expect(service.getFileDetail).toHaveBeenCalledTimes(2);
  expect(summary().getAllByText('15,000원')).toHaveLength(3);
  expect(summary().getByText('일치', { exact: true })).toBeInTheDocument();
  expect(screen.getByText(/동일한 원본 PDF 1개/)).toBeInTheDocument();
});

test('does not mix a delayed old selection response into the visible file', async () => {
  let finish!: (value: CardStatementFileDetailPayload) => void;
  service.getFileDetail.mockImplementation(input => input.storagePath === second ? new Promise(resolve => { finish = resolve; }) : Promise.resolve(payload()));
  render(<CardStatementUsageDialog {...props} paths={[first, second]} />);
  fireEvent.change(screen.getByLabelText('상세 조회할 PDF'), { target: { value: first } });
  await screen.findByRole('cell', { name: '첫 파일 식당' });
  await act(async () => { finish(payload(second, [result(5000, '지연된 둘째 카페')])); });
  expect(screen.getByRole('cell', { name: '첫 파일 식당' })).toBeInTheDocument();
  expect(screen.queryByRole('cell', { name: '지연된 둘째 카페' })).not.toBeInTheDocument();
});

test('does not apply an old card response after the dialog card changes', async () => {
  let finish!: (value: CardStatementFileDetailPayload) => void;
  service.getFileDetail.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValue(payload(second, [result(5000, '새 카드 내역', { matchedCardId: 'card-2', cardLast4: '2222' })]));
  const view = render(<CardStatementUsageDialog {...props} />);
  view.rerender(<CardStatementUsageDialog {...props} cardId="card-2" cardLast4="2222" ledgerTotal={5000} paths={[second]} />);
  await screen.findByRole('cell', { name: '새 카드 내역' });
  await act(async () => { finish(payload()); });
  expect(screen.queryByRole('cell', { name: '첫 파일 식당' })).not.toBeInTheDocument();
  expect(summary().getByText('일치', { exact: true })).toBeInTheDocument();
});

test('keeps an analysis result on its original file when the selection changes during analysis', async () => {
  let finish!: (value: CardStatementFileDetailPayload) => void;
  service.getFileDetail.mockImplementation(async input => payload(input.storagePath, [result(5000, input.storagePath === first ? '첫 파일 식당' : '둘째 파일 식당')]));
  service.analyzeStoredFile.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  render(<CardStatementUsageDialog {...props} paths={[first, second]} />);
  fireEvent.click(await screen.findByRole('button', { name: '선택 PDF 재분석 및 저장' }));
  fireEvent.change(screen.getByLabelText('상세 조회할 PDF'), { target: { value: first } });
  await act(async () => { finish(payload(second, [result(5000, '분석된 둘째 식당')])); });
  expect(screen.getByRole('cell', { name: '첫 파일 식당' })).toBeInTheDocument();
  expect(screen.queryByRole('cell', { name: '분석된 둘째 식당' })).not.toBeInTheDocument();
});

test('shows analysis failures while preserving saved rows and disables unavailable analysis', async () => {
  service.analyzeStoredFile.mockRejectedValueOnce(new Error('PDF 분석 실패'));
  const view = render(<CardStatementUsageDialog {...props} />);
  fireEvent.click(await screen.findByRole('button', { name: '선택 PDF 재분석 및 저장' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('PDF 분석 실패');
  expect(screen.getByRole('cell', { name: '첫 파일 식당' })).toBeInTheDocument();
  expect(summary().queryByText('일치', { exact: true })).not.toBeInTheDocument();
  service.getFileDetail.mockResolvedValue({ ...payload(second), analysisAvailable: false });
  view.rerender(<CardStatementUsageDialog {...props} paths={[second]} />);
  expect(await screen.findByRole('button', { name: '선택 PDF 재분석 및 저장' })).toBeDisabled();
});

test.each(['cancelled', 'uploading'] as const)('excludes stale transactions belonging to a %s file', async status => {
  const detail = payload();
  detail.file.status = status;
  service.getFileDetail.mockResolvedValue(detail);
  render(<CardStatementUsageDialog {...props} />);
  expect(await screen.findByRole('button', { name: '선택 PDF 재분석 및 저장' })).toBeDisabled();
  expect(screen.queryByRole('cell', { name: '첫 파일 식당' })).not.toBeInTheDocument();
  expect(summary().queryByText('일치', { exact: true })).not.toBeInTheDocument();
});

test('polls an already-running analysis without initiating another analysis', async () => {
  jest.useFakeTimers();
  try {
    service.getFileDetail.mockResolvedValueOnce({ ...payload(), results: [], analysisStatus: 'analyzing' }).mockResolvedValue(payload());
    render(<CardStatementUsageDialog {...props} />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole('button', { name: '분석 및 저장 중…' })).toBeDisabled();
    await act(async () => { jest.advanceTimersByTime(3000); });
    expect(screen.getByRole('cell', { name: '첫 파일 식당' })).toBeInTheDocument();
    expect(service.analyzeStoredFile).not.toHaveBeenCalled();
  } finally { jest.useRealTimers(); }
});
