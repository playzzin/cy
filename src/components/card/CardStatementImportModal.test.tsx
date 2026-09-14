import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CardStatementImportModal } from './CardStatementImportModal';
import { cardStatementImportService } from '../../services/cardStatementImportService';
import type { CardStatementImportJobPayload } from '../../types/cardStatementImport';

jest.mock('../../services/cardStatementImportService', () => ({ cardStatementImportService: {
  createJobFromFiles: jest.fn(), analyzeJob: jest.fn(), commitJob: jest.fn(),
  subscribeJob: jest.fn(), subscribeFiles: jest.fn(), subscribeResults: jest.fn(),
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

const openReview = async () => {
  render(<CardStatementImportModal isOpen yearMonth="2026-08" cards={[]} onClose={jest.fn()} />);
  fireEvent.change(screen.getByLabelText(/PDF 여러 장 선택/), { target: { files: [new File(['fixture'], 'sample.pdf', { type: 'application/pdf' })] } });
  fireEvent.click(screen.getByRole('button', { name: '업로드 후 분석' }));
  return screen.findByRole('button', { name: '금액·PDF 임시저장' });
};

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

test.each(['network', 'rejected'])('a %s failure never shows a successful-save popup', async (failure) => {
  if (failure === 'network') service.commitJob.mockRejectedValue(new Error('네트워크 저장 오류'));
  else service.commitJob.mockResolvedValue(makePayload(['committed'], { ok: false }));
  fireEvent.click(await openReview());
  await screen.findByText(failure === 'network' ? '네트워크 저장 오류' : '저장 결과를 확인하지 못했습니다. 잠시 후 다시 확인해 주세요.');
  expect(alertSpy).not.toHaveBeenCalled();
});
