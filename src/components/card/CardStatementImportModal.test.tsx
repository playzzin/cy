import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { CardStatementImportModal } from './CardStatementImportModal';
import { cardStatementImportService } from '../../services/cardStatementImportService';
import type { CardStatementImportJobPayload } from '../../types/cardStatementImport';
import type { Card } from '../../types/card';

jest.mock('../../services/cardStatementImportService', () => ({ cardStatementImportService: {
  createJobFromFiles: jest.fn(), analyzeJob: jest.fn(), commitJob: jest.fn(),
  subscribeJob: jest.fn(), subscribeFiles: jest.fn(), subscribeResults: jest.fn(),
  updateResultReview: jest.fn(),
} }));
const service = cardStatementImportService as jest.Mocked<typeof cardStatementImportService>;
const makePayload = (statuses: string[], overrides: Record<string, unknown> = {}): CardStatementImportJobPayload => ({
  ok: true,
  job: { id: 'job-test', yearMonth: '2026-08', status: statuses.every((status) => ['committed', 'excluded'].includes(status)) ? 'completed' : 'reviewing', totalFiles: 1, analyzedFiles: 1 },
  files: [{ id: 'file-test', originalFileName: 'sample.pdf', status: 'completed', warnings: [] }],
  results: statuses.map((status, index) => ({ id: `result-${index}`, fileId: 'file-test', jobId: 'job-test', yearMonth: '2026-08', fileIndex: 0, resultIndex: index, status, matchedCardId: 'card-test', matchedCardLabel: '테스트 카드', subtotalAmount: 11600, transactionCount: 0, transactions: [], warnings: [], matchCandidates: [] })),
  ...overrides,
} as unknown as CardStatementImportJobPayload);

let alertSpy: jest.SpyInstance;
beforeEach(() => {
  jest.resetAllMocks();
  alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  service.createJobFromFiles.mockResolvedValue({ jobId: 'job-test' } as any);
  service.analyzeJob.mockResolvedValue(makePayload(['matched']));
  service.commitJob.mockResolvedValue(makePayload(['committed']));
  service.subscribeJob.mockReturnValue(() => {});
  service.subscribeFiles.mockReturnValue(() => {});
  service.subscribeResults.mockReturnValue(() => {});
});
afterEach(() => jest.restoreAllMocks());

const openReview = async (cards: Card[] = []) => {
  render(<CardStatementImportModal isOpen yearMonth="2026-08" cards={cards} onClose={jest.fn()} />);
  fireEvent.change(screen.getByLabelText(/PDF 여러 장 선택/), { target: { files: [new File(['fixture'], 'sample.pdf', { type: 'application/pdf' })] } });
  fireEvent.click(screen.getByRole('button', { name: '업로드 후 분석' }));
  return screen.findByRole('button', { name: '금액·PDF 임시저장' });
};

test('same-number cards show their status and holder, and a lost card can be selected for historical usage', async () => {
  const cards: Card[] = [
    { id: 'lost', name: '테스트 카드', issuer: '테스트발급사', last4: '1234', maskedNumber: '**** 1234', cardType: 'CREDIT', status: 'SUSPENDED', currentAssigneeName: '이전담당자' },
    { id: 'card-test', name: '테스트 카드', issuer: '테스트발급사', last4: '1234', maskedNumber: '**** 1234', cardType: 'CREDIT', status: 'ASSIGNED', currentAssigneeName: '현재담당자' },
    { id: 'closed', name: '테스트 카드', issuer: '테스트발급사', last4: '1234', maskedNumber: '**** 1234', cardType: 'CREDIT', status: 'CLOSED' },
  ];
  const lostPayload = makePayload(['matched']);
  lostPayload.results[0].matchedCardId = 'lost';
  service.updateResultReview.mockResolvedValue(lostPayload);
  await openReview(cards);
  const select = screen.getByRole('combobox', { name: /수동 매칭 카드/ });
  expect(select).toHaveValue('card-test');
  expect(screen.getByRole('option', { name: '사용중 · 테스트 카드 (1234) · 현재담당자 · 테스트발급사' })).toBeEnabled();
  expect(screen.getByRole('option', { name: '분실/정지 · 테스트 카드 (1234) · 이전담당자 · 테스트발급사' })).toBeEnabled();
  expect(screen.getByRole('option', { name: '해지 · 테스트 카드 (1234) · 테스트발급사' })).toBeEnabled();
  fireEvent.change(select, { target: { value: 'lost' } });
  await waitFor(() => expect(service.updateResultReview).toHaveBeenCalledWith('result-0', { matchedCardId: 'lost' }));
  expect(select).toHaveValue('lost');
  expect(await screen.findByText('분실·정지/해지 카드입니다. 사용 중단 전 내역인지 확인해 주세요.')).toBeInTheDocument();
});

test('reissued-card warnings stay readable and require choosing the actual transaction card before saving', async () => {
  const warning = 'PDF 상단의 선택 카드번호와 거래내역 카드번호가 다릅니다. 재발급 전 내역일 수 있으므로 수동 매칭에서 실제 사용 카드를 확인해 주세요.';
  const pending = makePayload(['needs_review']);
  Object.assign(pending.results[0], { matchedCardId: null, matchedCardLabel: null, cardLast4: '5678', warnings: [warning] });
  const cards: Card[] = [
    { id: 'original', name: '기존 카드', issuer: '테스트발급사', last4: '5678', maskedNumber: '**** 5678', cardType: 'CREDIT', status: 'ASSIGNED' },
    { id: 'replacement', name: '재발급 카드', issuer: '테스트발급사', last4: '1234', maskedNumber: '**** 1234', cardType: 'CREDIT', status: 'ASSIGNED' },
  ];
  service.analyzeJob.mockResolvedValue(pending);
  service.updateResultReview.mockResolvedValue({ ...pending, results: [{ ...pending.results[0], matchedCardId: 'original', status: 'matched' }] });
  const saveButton = await openReview(cards);
  const select = screen.getByRole('combobox', { name: '수동 매칭 카드 5678' });
  expect(select).toHaveValue('');
  expect(saveButton).toBeDisabled();
  expect(screen.getByText(warning)).not.toHaveClass('truncate');
  fireEvent.change(select, { target: { value: 'original' } });
  await waitFor(() => expect(saveButton).toBeEnabled());
  expect(service.updateResultReview).toHaveBeenCalledWith('result-0', { matchedCardId: 'original' });
  expect(select).toHaveValue('original');
});

test('shows the server-confirmed month, saved amount and count, then disables repeat saving', async () => {
  fireEvent.click(await openReview());
  await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));
  expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('2026-08 카드 청구서 저장이 완료되었습니다.'));
  expect(alertSpy.mock.calls[0][0]).toContain('저장된 내역: 1건');
  expect(alertSpy.mock.calls[0][0]).toContain('11,600원');
  expect(alertSpy.mock.calls[0][0]).toContain('청구 확정은 별도');
  expect(screen.getByRole('button', { name: '저장 완료' })).toBeDisabled();
});

test('never announces success before the save request finishes and prevents repeated requests', async () => {
  let finish!: (payload: CardStatementImportJobPayload) => void;
  service.commitJob.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
  const button = await openReview();
  fireEvent.click(button);
  fireEvent.click(button);
  expect(alertSpy).not.toHaveBeenCalled();
  expect(service.commitJob).toHaveBeenCalledTimes(1);
  await act(async () => finish(makePayload(['committed'])));
  await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));
});

test('partial saves are not reported as fully completed', async () => {
  service.commitJob.mockResolvedValue(makePayload(['committed', 'failed']));
  fireEvent.click(await openReview());
  await waitFor(() => expect(alertSpy).toHaveBeenCalled());
  expect(alertSpy.mock.calls[0][0]).toContain('일부 내역만 저장되었습니다.');
  expect(alertSpy.mock.calls[0][0]).toContain('추가 확인이 필요한 내역: 1건');
  expect(alertSpy.mock.calls[0][0]).not.toContain('저장이 완료되었습니다');
});

test('all-excluded results report no saved entries, not success', async () => {
  service.commitJob.mockResolvedValue(makePayload(['excluded']));
  fireEvent.click(await openReview());
  await waitFor(() => expect(alertSpy).toHaveBeenCalled());
  expect(alertSpy.mock.calls[0][0]).toContain('저장된 내역이 없습니다.');
  expect(alertSpy.mock.calls[0][0]).toContain('중복');
  expect(alertSpy.mock.calls[0][0]).not.toContain('저장이 완료되었습니다');
  expect(screen.getByRole('button', { name: '금액·PDF 임시저장' })).toBeDisabled();
});

test('failed PDF files prevent a misleading full-success announcement', async () => {
  service.commitJob.mockResolvedValue(makePayload(['committed'], { files: [{ status: 'failed' }] }));
  fireEvent.click(await openReview());
  await waitFor(() => expect(alertSpy).toHaveBeenCalled());
  expect(alertSpy.mock.calls[0][0]).toContain('처리하지 못한 PDF: 1개');
  expect(alertSpy.mock.calls[0][0]).not.toContain('저장이 완료되었습니다');
});

test.each([
  ['KB 승인내역 원본 대사 실패: 선택 카드번호와 거래 카드번호가 일치하지 않습니다. PDF 전체 페이지를 확인해 주세요.', 'PDF 카드번호 확인 필요', 'PDF 상단의 선택 카드번호'],
  ['KB 승인내역 원본 대사 실패: 전체 거래의 정상·취소 건수 또는 금액이 요약과 일치하지 않습니다. PDF 전체 페이지를 확인해 주세요.', 'PDF 거래 건수·합계 확인 필요', '정상 거래와 취소 거래'],
  ['KB 승인내역 원본 대사 실패: 거래 행의 날짜·금액·상태를 확인할 수 없습니다. PDF 전체 페이지를 확인해 주세요.', 'PDF 거래내역 판독 확인 필요', '일부 거래의 날짜·금액·취소 여부'],
  ['KB 승인내역 원본 대사 실패: 정상·취소 요약을 읽을 수 없습니다. PDF 전체 페이지를 확인해 주세요.', 'PDF 내용 확인 필요', 'PDF의 요약과 상세내역'],
  ['분석 서버 연결 실패', 'PDF 분석 실패', '일시적인 연결 오류라면'],
])('explains a failed file without clipping the original error or enabling save: %s', async (errorMessage, title, guidance) => {
  service.analyzeJob.mockResolvedValue(makePayload([], {
    job: { id: 'job-test', yearMonth: '2026-08', status: 'reviewing', totalFiles: 1, analyzedFiles: 1 },
    files: [{ id: 'file-test', originalFileName: 'sample.pdf', status: 'failed', warnings: [], errorMessage }],
  }));
  const saveButton = await openReview();
  const alert = screen.getByRole('alert', { name: 'sample.pdf 분석 오류' });
  expect(within(alert).getByText(title)).toBeVisible();
  expect(within(alert).getByText(new RegExp(guidance))).toBeVisible();
  const originalError = within(alert).getByText(errorMessage);
  expect(originalError).toBeVisible();
  expect(originalError).not.toHaveClass('truncate');
  expect(saveButton).toBeDisabled();
  expect(service.commitJob).not.toHaveBeenCalled();
});

test.each(['network', 'rejected'])('a %s failure never shows a successful-save popup', async (failure) => {
  if (failure === 'network') service.commitJob.mockRejectedValue(new Error('네트워크 저장 오류'));
  else service.commitJob.mockResolvedValue(makePayload(['committed'], { ok: false }));
  fireEvent.click(await openReview());
  await screen.findByText(failure === 'network' ? '네트워크 저장 오류' : '저장 결과를 확인하지 못했습니다. 잠시 후 다시 확인해 주세요.');
  expect(alertSpy).not.toHaveBeenCalled();
});
