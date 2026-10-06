import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import CardStatementDetailsPage from './CardStatementDetailsPage';
import { cardStatementImportService } from '../../services/cardStatementImportService';
import type { CardStatementFileDetailPayload, CardStatementImportFile, CardStatementImportResult } from '../../types/cardStatementImport';
import { isDevAdminSessionEnabled } from '../../utils/devAdminSession';
import { getSupportManagementYearMonth, rememberSupportManagementYearMonth } from '../../utils/supportManagementState';

jest.mock('../../utils/devAdminSession', () => ({ isDevAdminSessionEnabled: jest.fn(() => false) }));

jest.mock('../../services/cardStatementImportService', () => ({
  cardStatementImportService: { listStoredFiles: jest.fn(), getFileDetail: jest.fn(), analyzeStoredFile: jest.fn() },
}));
jest.mock('../../components/card/CardStatementFilesDialog', () => ({
  __esModule: true,
  default: ({ paths, onClose }: { paths: string[]; onClose: () => void }) => <div role="dialog" aria-label="원본 파일"><span>{paths[0]}</span><button onClick={onClose}>원본 닫기</button></div>,
}));

const service = cardStatementImportService as jest.Mocked<typeof cardStatementImportService>;
const file: CardStatementImportFile = {
  id: 'file-1', jobId: 'job-1', yearMonth: '2026-09', fileIndex: 0,
  storagePath: 'card-statements/source.pdf', originalFileName: '신한카드 9월.pdf',
  mimeType: 'application/pdf', size: 1234, status: 'completed', cardCount: 1, transactionCount: 3, warnings: [],
};
const result: CardStatementImportResult = {
  id: 'result-1', jobId: 'job-1', fileId: file.id, fileIndex: 0, resultIndex: 0, yearMonth: '2026-09',
  cardName: '신한 법인카드', cardLast4: '1234', holderName: '관리팀', matchConfidence: 1, matchCandidates: [],
  status: 'committed', subtotalAmount: 65000, transactionCount: 3, warnings: [],
  transactions: [
    { id: 'tx-1', date: '2026-09-01', merchant: '서울주유소', amount: 60000, category: 'FUEL', memo: '업무차량', confidence: 0.99 },
    { id: 'tx-2', date: '2026-09-02', merchant: '현장식당', amount: 10000, category: 'MEAL', memo: '점심', confidence: 0.95 },
    { id: 'tx-3', date: '2026-09-03', merchant: '현장식당 취소', amount: -5000, category: 'MEAL', memo: '부분 취소', confidence: 0.6 },
  ],
};
const saved: CardStatementFileDetailPayload = { ok: true, file, job: null, results: [result], analysisStatus: 'completed' };
const unprocessed: CardStatementFileDetailPayload = { ...saved, file: { ...file, status: 'uploaded', transactionCount: 0 }, results: [], analysisStatus: 'not_analyzed' };

const Location = () => {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}{location.search}</div>;
};
const renderPage = (entry = '/support/cards/statements?month=2026-09') => render(
  <MemoryRouter initialEntries={[entry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <Routes>
      <Route path="/support/cards/statements" element={<CardStatementDetailsPage />} />
      <Route path="*" element={<div>통합관리 화면</div>} />
    </Routes>
    <Location />
  </MemoryRouter>,
);

beforeEach(() => {
  jest.resetAllMocks();
  window.sessionStorage.clear();
  jest.mocked(isDevAdminSessionEnabled).mockReturnValue(false);
  service.listStoredFiles.mockResolvedValue([file]);
  service.getFileDetail.mockResolvedValue(saved);
  service.analyzeStoredFile.mockResolvedValue(saved);
});

test('loads a saved statement, selects it in the URL, and filters signed transaction totals', async () => {
  renderPage();
  expect(await screen.findByRole('cell', { name: '서울주유소' })).toBeInTheDocument();
  expect(service.listStoredFiles).toHaveBeenCalledWith('2026-09');
  expect(service.getFileDetail).toHaveBeenCalledWith({ fileId: 'file-1', yearMonth: '2026-09' });
  expect(screen.getByTestId('location')).toHaveTextContent('fileId=file-1');
  expect(screen.getByRole('button', { name: `${file.originalFileName} 상세내역` })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getAllByText('65,000원')).toHaveLength(2);
  expect(screen.getByText('AI가 추출한 날짜·가맹점·금액·분류는 원본 명세서와 대조해 주세요.', { exact: false })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('분류'), { target: { value: 'MEAL' } });
  expect(screen.queryByRole('cell', { name: '서울주유소' })).not.toBeInTheDocument();
  expect(screen.getByText('5,000원')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('이용내역 검색'), { target: { value: '부분 취소' } });
  expect(screen.getAllByText('-5,000원')).toHaveLength(2);
  expect(screen.queryByRole('cell', { name: '현장식당' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('이용내역 검색'), { target: { value: '일치하지 않음' } });
  expect(screen.getByText('검색 조건에 맞는 이용내역이 없습니다.')).toBeInTheDocument();
  expect(service.analyzeStoredFile).not.toHaveBeenCalled();
});

test('shows loading and an empty month without inventing details, and synchronizes month changes', async () => {
  let resolveList!: (items: CardStatementImportFile[]) => void;
  service.listStoredFiles.mockImplementationOnce(() => new Promise(resolve => { resolveList = resolve; }));
  renderPage();
  expect(screen.getByText('명세서 목록을 불러오는 중…')).toHaveAttribute('role', 'status');
  await act(async () => { resolveList([]); });
  expect(screen.getByText(/이 월에 등록된 명세서가 없습니다/)).toBeInTheDocument();
  expect(service.getFileDetail).not.toHaveBeenCalled();
  service.listStoredFiles.mockResolvedValue([]);
  fireEvent.click(screen.getByRole('button', { name: '이전 달' }));
  await waitFor(() => expect(service.listStoredFiles).toHaveBeenCalledWith('2026-08'));
  expect(screen.getByTestId('location')).toHaveTextContent('?month=2026-08');
});

test('shows saved details when the new backend is unavailable and explains disabled analysis', async () => {
  service.getFileDetail.mockResolvedValue({ ...saved, analysisAvailable: false, readNotice: '기존 업로드 기록을 표시하고 있습니다.' });
  renderPage();
  expect(await screen.findByRole('cell', { name: '서울주유소' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Gemini 재분석 및 저장' })).toBeDisabled();
  expect(screen.getByText(/기존 업로드 기록을 표시하고 있습니다/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '원본 열기' })).toBeEnabled();
});

test('uses the month last viewed in the ledger when no month is specified', async () => {
  rememberSupportManagementYearMonth('2026-08');
  service.listStoredFiles.mockResolvedValue([]);
  renderPage('/support/cards/statements');
  await screen.findByText(/이 월에 등록된 명세서가 없습니다/);
  expect(service.listStoredFiles).toHaveBeenCalledWith('2026-08');
  expect(screen.getByRole('group', { name: '통합관리 조회월' })).toHaveTextContent('2026년 8월');
});

test('does not label an old summary extraction as saved itemized transactions', async () => {
  service.listStoredFiles.mockResolvedValue([{ ...file, analysisSource: 'fast_text', transactionCount: 1 }]);
  service.getFileDetail.mockResolvedValue({ ...unprocessed, analysisAvailable: false });
  renderPage();
  const fileButton = await screen.findByRole('button', { name: `${file.originalFileName} 상세내역` });
  expect(fileButton).toHaveTextContent('상세 분석 전');
  expect(fileButton).toHaveTextContent('0건');
  expect(await screen.findByText(/새 분석 기능이 연결되면 이 파일을 분석할 수 있습니다/)).toBeInTheDocument();
});

test('offers retry after a list error and independently reports detail loading failures', async () => {
  service.listStoredFiles.mockRejectedValueOnce(new Error('목록을 불러올 수 없습니다.'));
  service.getFileDetail.mockRejectedValueOnce(new Error('상세 조회 연결이 끊겼습니다.'));
  renderPage();
  expect(await screen.findByRole('alert')).toHaveTextContent('목록을 불러올 수 없습니다.');
  fireEvent.click(screen.getByRole('button', { name: '목록 다시 불러오기' }));
  expect(await screen.findByText('상세 조회 연결이 끊겼습니다.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '상세내역 다시 불러오기' }));
  expect(await screen.findByRole('cell', { name: '서울주유소' })).toBeInTheDocument();
});

test('file selection clears previous filters and only shows the newly selected detail', async () => {
  const second = { ...file, id: 'file-2', originalFileName: '삼성카드 9월.pdf' };
  service.listStoredFiles.mockResolvedValue([file, second]);
  service.getFileDetail.mockImplementation(async input => input.fileId === second.id
    ? { ...saved, file: second, results: [{ ...result, id: 'result-2', cardName: '삼성카드', transactions: [{ ...result.transactions[0], merchant: '부산주유소' }] }] }
    : saved);
  renderPage();
  await screen.findByRole('cell', { name: '서울주유소' });
  fireEvent.change(screen.getByLabelText('이용내역 검색'), { target: { value: '서울' } });
  fireEvent.click(screen.getByRole('button', { name: '삼성카드 9월.pdf 상세내역' }));
  expect(await screen.findByRole('cell', { name: '부산주유소' })).toBeInTheDocument();
  expect(screen.queryByRole('cell', { name: '서울주유소' })).not.toBeInTheDocument();
  expect(screen.getByLabelText('이용내역 검색')).toHaveValue('');
  expect(screen.getByTestId('location')).toHaveTextContent('fileId=file-2');
});

test('changing the month does not select a file from the previous month', async () => {
  renderPage();
  await screen.findByRole('cell', { name: '서울주유소' });
  service.listStoredFiles.mockResolvedValue([]);
  fireEvent.click(screen.getByRole('button', { name: '이전 달' }));
  expect(await screen.findByText(/이 월에 등록된 명세서가 없습니다/)).toBeInTheDocument();
  expect(screen.getByTestId('location')).toHaveTextContent('?month=2026-08');
  expect(screen.getByTestId('location')).not.toHaveTextContent('fileId');
  expect(getSupportManagementYearMonth()).toBe('2026-08');
  expect(service.getFileDetail).not.toHaveBeenCalledWith({ fileId: file.id, yearMonth: '2026-08' });
  expect(screen.queryByRole('cell', { name: '서울주유소' })).not.toBeInTheDocument();
});

test('analyzes once, reloads the persisted result and can show it again after returning to the page', async () => {
  service.getFileDetail.mockResolvedValueOnce(unprocessed).mockResolvedValue(saved);
  let finishAnalysis!: (payload: CardStatementFileDetailPayload) => void;
  service.analyzeStoredFile.mockImplementationOnce(() => new Promise(resolve => { finishAnalysis = resolve; }));
  const view = renderPage('/support/cards/statements?month=2026-09&fileId=file-1');
  const analyze = await screen.findByRole('button', { name: 'Gemini 분석 및 저장' });
  fireEvent.click(analyze);
  fireEvent.click(analyze);
  expect(service.analyzeStoredFile).toHaveBeenCalledTimes(1);
  expect(service.analyzeStoredFile).toHaveBeenCalledWith({ fileId: 'file-1', yearMonth: '2026-09' });
  expect(screen.getByRole('button', { name: '분석 및 저장 중…' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '이전 달' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '다음 달' })).toBeDisabled();
  await act(async () => { finishAnalysis(saved); });
  expect(await screen.findByRole('cell', { name: '서울주유소' })).toBeInTheDocument();
  expect(screen.getByText(/분석한 상세내역을 저장했습니다/)).toBeInTheDocument();
  expect(service.getFileDetail).toHaveBeenCalledTimes(2);
  view.unmount();
  renderPage('/support/cards/statements?month=2026-09&fileId=file-1');
  expect(await screen.findByRole('cell', { name: '서울주유소' })).toBeInTheDocument();
  expect(service.getFileDetail).toHaveBeenCalledTimes(3);
  expect(service.analyzeStoredFile).toHaveBeenCalledTimes(1);
});

test('a failed reanalysis keeps the saved transactions visible and allows a retry', async () => {
  service.analyzeStoredFile.mockRejectedValueOnce(new Error('Gemini가 응답하지 않았습니다. 다시 시도해 주세요.'));
  renderPage('/support/cards/statements?month=2026-09&fileId=file-1');
  fireEvent.click(await screen.findByRole('button', { name: 'Gemini 재분석 및 저장' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Gemini가 응답하지 않았습니다.');
  expect(screen.getByRole('cell', { name: '서울주유소' })).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Gemini 재분석 및 저장' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Gemini 재분석 및 저장' }));
  expect(await screen.findByText(/분석한 상세내역을 저장했습니다/)).toBeInTheDocument();
});

test('opens and analyzes a legacy attachment passed by storage path even with no import history', async () => {
  const path = 'card-statements/legacy.pdf';
  service.listStoredFiles.mockResolvedValue([]);
  service.getFileDetail.mockResolvedValue({ ...unprocessed, file: { ...unprocessed.file, id: 'stored-1', jobId: '', storagePath: path, originalFileName: '현대카드.pdf' } });
  renderPage(`/support/cards/statements?month=2026-09&storagePath=${encodeURIComponent(path)}&fileName=${encodeURIComponent('현대카드.pdf')}`);
  fireEvent.click(await screen.findByRole('button', { name: '원본 열기' }));
  expect(within(screen.getByRole('dialog')).getByText(path)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '원본 닫기' }));
  fireEvent.click(screen.getByRole('button', { name: 'Gemini 분석 및 저장' }));
  await waitFor(() => expect(service.analyzeStoredFile).toHaveBeenCalledWith({ storagePath: path, yearMonth: '2026-09', originalFileName: '현대카드.pdf' }));
});

test('does not display a completed analysis as an error when it contains no transaction rows', async () => {
  service.getFileDetail.mockResolvedValue({ ...saved, results: [] });
  renderPage('/support/cards/statements?month=2026-09&fileId=file-1');
  expect(await screen.findByText(/저장된 상세 이용내역이 없습니다/)).toBeInTheDocument();
  expect(screen.getByText('상세내역 저장됨')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('selects unregistered ledger attachments by storage path both automatically and from the file list', async () => {
  const firstLegacy = { ...file, id: 'stored-first', jobId: '', originalFileName: '기존 현대카드.pdf', storagePath: 'card-ledger-statements/2026-09/hyundai.pdf' };
  const secondLegacy = { ...firstLegacy, id: 'stored-second', originalFileName: '기존 롯데카드.pdf', storagePath: 'card-ledger-statements/2026-09/lotte.pdf' };
  service.listStoredFiles.mockResolvedValue([firstLegacy, secondLegacy]);
  service.getFileDetail.mockImplementation(async input => ({ ...unprocessed, file: input.storagePath === secondLegacy.storagePath ? secondLegacy : firstLegacy }));
  renderPage();
  expect(await screen.findByRole('heading', { name: firstLegacy.originalFileName })).toBeInTheDocument();
  expect(service.getFileDetail).toHaveBeenCalledWith({ yearMonth: '2026-09', storagePath: firstLegacy.storagePath, originalFileName: firstLegacy.originalFileName });
  expect(screen.getByTestId('location')).not.toHaveTextContent('fileId');
  fireEvent.click(screen.getByRole('button', { name: `${secondLegacy.originalFileName} 상세내역` }));
  expect(await screen.findByRole('heading', { name: secondLegacy.originalFileName })).toBeInTheDocument();
  expect(service.getFileDetail).toHaveBeenCalledWith({ yearMonth: '2026-09', storagePath: secondLegacy.storagePath, originalFileName: secondLegacy.originalFileName });
  expect(screen.getByRole('button', { name: `${secondLegacy.originalFileName} 상세내역` })).toHaveAttribute('aria-pressed', 'true');
});

test('refreshes an in-progress analysis and displays its completed saved rows', async () => {
  jest.useFakeTimers();
  try {
    service.getFileDetail.mockResolvedValueOnce({ ...unprocessed, analysisStatus: 'analyzing' }).mockResolvedValue(saved);
    renderPage('/support/cards/statements?month=2026-09&fileId=file-1');
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole('button', { name: '분석 및 저장 중…' })).toBeDisabled();
    await act(async () => { jest.advanceTimersByTime(3000); });
    expect(screen.getByRole('cell', { name: '서울주유소' })).toBeInTheDocument();
    expect(screen.getByText(/분석한 상세내역을 저장했습니다/)).toBeInTheDocument();
    expect(service.analyzeStoredFile).not.toHaveBeenCalled();
  } finally { jest.useRealTimers(); }
});

test('explains the sample account and preserves the selected month and file when returning to real login', async () => {
  jest.mocked(isDevAdminSessionEnabled).mockReturnValue(true);
  service.listStoredFiles.mockRejectedValue(new Error('INTERNAL'));
  service.getFileDetail.mockRejectedValue(new Error('INTERNAL'));
  renderPage('/support/cards/statements?month=2026-09&fileId=file-1&devAdmin=1');
  expect(screen.getByText(/개발용 화면으로 보고 있습니다/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '실제 계정으로 돌아가기' })).toHaveAttribute('href', '/support/cards/statements?month=2026-09&fileId=file-1&devAdmin=0');
  await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(2));
  expect(screen.queryByText('INTERNAL')).not.toBeInTheDocument();
  expect(screen.getByText(/명세서 상세내역을 불러오지 못했습니다/)).toBeInTheDocument();
});

test('returns to the ledger with the selected month remembered', async () => {
  service.listStoredFiles.mockResolvedValue([]);
  renderPage('/support/cards/statements?month=2026-08');
  await screen.findByText(/이 월에 등록된 명세서가 없습니다/);
  fireEvent.click(screen.getByRole('link', { name: '카드 통합관리대장' }));
  expect(getSupportManagementYearMonth()).toBe('2026-08');
  expect(screen.getByTestId('location')).toHaveTextContent('view=ledger&month=2026-08');
});

test.each([
  ['통합현황', '/support/expense-ledger'],
  ['경비입력', '/support/expense-claims'],
  ['차량', '/support/vehicles'],
  ['숙소', '/support/accommodation'],
  ['카드', '/support/cards'],
])('opens %s from the shared header with the month preserved and no statement selection', async (label, path) => {
  rememberSupportManagementYearMonth('2026-10');
  renderPage('/support/cards/statements?month=2026-09&fileId=file-1&fileName=statement.pdf');
  await screen.findByRole('cell', { name: '서울주유소' });
  const tabs = screen.getByRole('tablist', { name: '통합관리 업무 선택' });
  expect(within(tabs).getAllByRole('tab')).toHaveLength(5);
  expect(within(tabs).getByRole('tab', { name: '카드' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('group', { name: '통합관리 조회월' })).toHaveTextContent('2026년 9월');
  fireEvent.click(within(tabs).getByRole('tab', { name: label }));
  expect(screen.getByTestId('location').textContent).toBe(`${path}?view=ledger&month=2026-09`);
  expect(getSupportManagementYearMonth()).toBe('2026-09');
  expect(screen.queryByRole('heading', { name: '카드 명세서 상세내역' })).not.toBeInTheDocument();
});

const setupBulkFiles = () => {
  const pendingFiles: CardStatementImportFile[] = [1, 2].map(index => ({
    ...file, id: `file-${index}`, storagePath: `card-statements/${index}.pdf`, originalFileName: `명세서 ${index}.pdf`,
    analysisSource: 'fast_text', detailAnalysisStatus: 'not_analyzed', transactionCount: 0,
  }));
  const stored = new Map(pendingFiles.map(item => [item.id, { ...unprocessed, file: item }]));
  const save = (id: string) => {
    const payload: CardStatementFileDetailPayload = { ...saved, file: { ...stored.get(id)!.file, detailAnalysisStatus: 'completed', analysisSource: 'gemini', transactionCount: 3 } };
    stored.set(id, payload);
    return payload;
  };
  service.listStoredFiles.mockImplementation(async () => Array.from(stored.values(), payload => payload.file));
  service.getFileDetail.mockImplementation(async input => stored.get(input.fileId!)!);
  service.analyzeStoredFile.mockImplementation(async input => save(input.fileId!));
  return { stored, save, pendingFiles };
};

test('bulk analysis saves pending statements and updates selected details while locking conflicting controls', async () => {
  const { stored, save } = setupBulkFiles();
  stored.set('already-saved', { ...saved, file: { ...file, id: 'already-saved', storagePath: 'saved.pdf', detailAnalysisStatus: 'completed' } });
  let finish!: (payload: CardStatementFileDetailPayload) => void;
  service.analyzeStoredFile.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  renderPage('/support/cards/statements?month=2026-09&fileId=file-1');
  const button = await screen.findByRole('button', { name: '미분석 전체 분석 (2개)' });
  await screen.findByRole('button', { name: 'Gemini 분석 및 저장' });
  expect(service.analyzeStoredFile).not.toHaveBeenCalled();
  fireEvent.click(button);
  await waitFor(() => expect(service.analyzeStoredFile).toHaveBeenCalledTimes(1));
  expect(screen.getByRole('button', { name: '이전 달' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '다음 달' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Gemini 분석 및 저장' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '명세서 2.pdf 상세내역' })).toBeDisabled();
  expect(screen.getByRole('progressbar', { name: '전체 분석 진행률' })).toHaveAttribute('value', '0');
  await act(async () => { finish(save('file-1')); });
  await screen.findByText('전체 분석 완료 · 2/2개 처리');
  expect(service.analyzeStoredFile.mock.calls.map(([input]) => input.fileId)).toEqual(['file-1', 'file-2']);
  expect(await screen.findByRole('cell', { name: '서울주유소' })).toBeInTheDocument();
  expect(await screen.findByRole('button', { name: '미분석 전체 분석 (0개)' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '이전 달' })).toBeEnabled();
  expect(screen.getByRole('button', { name: '다음 달' })).toBeEnabled();
});

test('bulk failure remains retryable without reanalyzing successful files', async () => {
  setupBulkFiles();
  service.analyzeStoredFile.mockRejectedValueOnce(new Error('PDF 분석 실패'));
  renderPage('/support/cards/statements?month=2026-09&fileId=file-1');
  fireEvent.click(await screen.findByRole('button', { name: '미분석 전체 분석 (2개)' }));
  const retry = await screen.findByRole('button', { name: '실패한 파일만 재시도 (1개)' });
  await waitFor(() => expect(retry).toBeEnabled());
  expect(screen.getByText(/성공 1개 · 실패 1개/)).toBeInTheDocument();
  fireEvent.click(retry);
  await screen.findByText('전체 분석 완료 · 1/1개 처리');
  expect(service.analyzeStoredFile.mock.calls.map(([input]) => input.fileId)).toEqual(['file-1', 'file-2', 'file-1']);
  expect(screen.queryByRole('button', { name: /실패한 파일만 재시도/ })).not.toBeInTheDocument();
});

test('stopping a bulk run keeps saved results and the next run continues with pending files', async () => {
  const { save } = setupBulkFiles();
  let finish!: (payload: CardStatementFileDetailPayload) => void;
  service.analyzeStoredFile.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  renderPage('/support/cards/statements?month=2026-09&fileId=file-1');
  fireEvent.click(await screen.findByRole('button', { name: '미분석 전체 분석 (2개)' }));
  await waitFor(() => expect(service.analyzeStoredFile).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole('button', { name: '현재 파일 완료 후 중단' }));
  await act(async () => { finish(save('file-1')); });
  await screen.findByText('전체 분석 중단 · 1/2개 처리');
  expect(service.analyzeStoredFile).toHaveBeenCalledTimes(1);
  const resume = await screen.findByRole('button', { name: '미분석 전체 분석 (1개)' });
  await waitFor(() => expect(resume).toBeEnabled());
  fireEvent.click(resume);
  await screen.findByText('전체 분석 완료 · 1/1개 처리');
  expect(service.analyzeStoredFile.mock.calls.map(([input]) => input.fileId)).toEqual(['file-1', 'file-2']);
});

test('leaving the page stops queued files after the in-flight request completes', async () => {
  const { save } = setupBulkFiles();
  let finish!: (payload: CardStatementFileDetailPayload) => void;
  service.analyzeStoredFile.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const view = renderPage('/support/cards/statements?month=2026-09&fileId=file-1');
  fireEvent.click(await screen.findByRole('button', { name: '미분석 전체 분석 (2개)' }));
  await waitFor(() => expect(service.analyzeStoredFile).toHaveBeenCalledTimes(1));
  view.unmount();
  await act(async () => { finish(save('file-1')); });
  expect(service.analyzeStoredFile).toHaveBeenCalledTimes(1);
});
