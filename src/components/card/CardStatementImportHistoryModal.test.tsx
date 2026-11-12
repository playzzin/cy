import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CardStatementImportHistoryModal } from './CardStatementImportHistoryModal';
import { cardStatementImportService } from '../../services/cardStatementImportService';
import { cardStatementAttachmentService } from '../../services/cardStatementAttachmentService';

jest.mock('../../services/cardStatementAttachmentService', () => ({
  cardStatementAttachmentService: { resolve: jest.fn() },
  getCardStatementFileName: (path: string) => path.split('/').pop(),
  getCardStatementAttachmentError: () => '파일 조회 실패',
}));

jest.mock('../../services/cardStatementImportService', () => ({ cardStatementImportService: { listUploadHistory: jest.fn(), cancelStoredFile: jest.fn() } }));
const service = cardStatementImportService as jest.Mocked<typeof cardStatementImportService>;
const file = { id: 'file-1', jobId: 'job-1', originalFileName: 'statement.pdf', status: 'completed', fileIndex: 0 } as any;

beforeEach(() => { jest.resetAllMocks(); service.listUploadHistory.mockResolvedValue([file]); service.cancelStoredFile.mockResolvedValue(); });

test('opens an original from upload history without cancelling or modifying the file', async () => {
  service.listUploadHistory.mockResolvedValue([{ ...file, storagePath: 'statements/original.pdf' }]);
  jest.mocked(cardStatementAttachmentService.resolve).mockResolvedValue({ url: 'https://example.com/original.pdf', release: jest.fn() });
  const onCancelled = jest.fn();
  render(<CardStatementImportHistoryModal isOpen yearMonth="2026-09" onClose={jest.fn()} onCancelled={onCancelled} />);
  fireEvent.click(await screen.findByRole('button', { name: 'statement.pdf 원본 열기' }));
  expect(await screen.findByRole('link', { name: '새 탭에서 원본 열기' })).toHaveAttribute('href', 'https://example.com/original.pdf');
  expect(cardStatementAttachmentService.resolve).toHaveBeenCalledWith('statements/original.pdf');
  fireEvent.click(screen.getByRole('button', { name: '청구서 파일 닫기' }));
  expect(screen.getByRole('button', { name: 'statement.pdf 원본 열기' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'statement.pdf 상세내역' })).toHaveAttribute('href', '/support/cards/statements?month=2026-09&fileId=file-1');
  expect(service.cancelStoredFile).not.toHaveBeenCalled();
  expect(onCancelled).not.toHaveBeenCalled();
});

test('lists the selected month and only cancels after explicit confirmation', async () => {
  const onCancelled = jest.fn();
  render(<CardStatementImportHistoryModal isOpen yearMonth="2026-09" onClose={jest.fn()} onCancelled={onCancelled} />);
  fireEvent.click(await screen.findByRole('button', { name: 'statement.pdf 업로드·원본 삭제' }));
  expect(service.listUploadHistory).toHaveBeenCalledWith('2026-09');
  expect(service.cancelStoredFile).not.toHaveBeenCalled();
  service.listUploadHistory.mockResolvedValue([{ ...file, status: 'cancelled' }]);
  fireEvent.click(screen.getByRole('button', { name: '확인, 원본까지 삭제' }));
  await waitFor(() => expect(onCancelled).toHaveBeenCalledTimes(1));
  expect(service.cancelStoredFile).toHaveBeenCalledWith('file-1', { deleteOriginal: true });
  expect(await screen.findByText(/업로드와 원본 파일을 삭제했습니다/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'statement.pdf 업로드·원본 삭제' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByLabelText('취소 내역도 보기'));
  expect(screen.getByText(/취소됨/)).toBeInTheDocument();
});

test('an attachment without an import job cannot be cancelled as an import', async () => {
  service.listUploadHistory.mockResolvedValue([{ ...file, jobId: '', id: 'stored-file' }]);
  render(<CardStatementImportHistoryModal isOpen yearMonth="2026-09" onClose={jest.fn()} onCancelled={jest.fn()} />);
  await screen.findByRole('link', { name: 'statement.pdf 상세내역' });
  expect(screen.queryByRole('button', { name: 'statement.pdf 업로드·원본 삭제' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '선택한 0건 업로드·원본 삭제' })).toBeDisabled();
});

test('a blocked cancellation keeps the file and explains the remaining amount', async () => {
  service.cancelStoredFile.mockRejectedValue(new Error('저장된 카드 금액이 남아 있습니다. 0으로 저장해 주세요.'));
  const onCancelled = jest.fn();
  render(<CardStatementImportHistoryModal isOpen yearMonth="2026-09" onClose={jest.fn()} onCancelled={onCancelled} />);
  fireEvent.click(await screen.findByRole('button', { name: 'statement.pdf 업로드·원본 삭제' }));
  fireEvent.click(screen.getByRole('button', { name: '확인, 원본까지 삭제' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('금액이 남아');
  expect(onCancelled).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'statement.pdf 업로드·원본 삭제' })).toBeInTheDocument();
});

test('load errors are visible and closed modal does not load data', async () => {
  const props = { yearMonth: '2026-09', onClose: jest.fn(), onCancelled: jest.fn() };
  const view = render(<CardStatementImportHistoryModal {...props} isOpen={false} />);
  expect(service.listUploadHistory).not.toHaveBeenCalled();
  service.listUploadHistory.mockRejectedValue(new Error('offline'));
  view.rerender(<CardStatementImportHistoryModal {...props} isOpen />);
  expect(await screen.findByRole('alert')).toHaveTextContent('불러오지 못했습니다');
});

test('select all excludes cancelled and processing files and requires batch confirmation', async () => {
  service.listUploadHistory.mockResolvedValue([
    file, { ...file, id: 'file-2', originalFileName: 'second.pdf' },
    { ...file, id: 'old', originalFileName: 'old.pdf', status: 'cancelled' },
    { ...file, id: 'busy', originalFileName: 'busy.pdf', status: 'analyzing' },
    { ...file, id: 'upload', originalFileName: 'upload.pdf', status: 'uploading' },
  ]);
  const onCancelled = jest.fn();
  render(<CardStatementImportHistoryModal isOpen yearMonth="2026-09" onClose={jest.fn()} onCancelled={onCancelled} />);
  fireEvent.click(await screen.findByLabelText('삭제 가능한 내역 전체 선택'));
  expect(screen.getByLabelText('busy.pdf 선택')).toBeDisabled();
  expect(screen.getByLabelText('upload.pdf 선택')).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '선택한 2건 업로드·원본 삭제' }));
  expect(service.cancelStoredFile).not.toHaveBeenCalled();
  expect(screen.getByText(/선택한 2건의 2026-09 업로드/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '확인, 2건 원본까지 삭제' }));
  await waitFor(() => expect(onCancelled).toHaveBeenCalledTimes(1));
  expect(service.cancelStoredFile.mock.calls).toEqual([['file-1', { deleteOriginal: true }], ['file-2', { deleteOriginal: true }]]);
  expect(await screen.findByText(/선택한 2건 중 2건의 업로드와 원본 파일을 삭제했습니다/)).toBeInTheDocument();
});

test('batch cancellation continues after a blocked file and retains only failed selection for retry', async () => {
  const second = { ...file, id: 'file-2', originalFileName: 'second.pdf' };
  service.listUploadHistory.mockResolvedValue([file, second]);
  service.cancelStoredFile.mockRejectedValueOnce(new Error('확정된 청구서는 취소할 수 없습니다.')).mockResolvedValueOnce();
  const onCancelled = jest.fn();
  render(<CardStatementImportHistoryModal isOpen yearMonth="2026-09" onClose={jest.fn()} onCancelled={onCancelled} />);
  fireEvent.click(await screen.findByLabelText('삭제 가능한 내역 전체 선택'));
  fireEvent.click(screen.getByRole('button', { name: '선택한 2건 업로드·원본 삭제' }));
  service.listUploadHistory.mockResolvedValue([file, { ...second, status: 'cancelled' }]);
  fireEvent.click(screen.getByRole('button', { name: '확인, 2건 원본까지 삭제' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('statement.pdf: 확정된 청구서는 취소할 수 없습니다.');
  expect(screen.getByRole('status')).toHaveTextContent('선택한 2건 중 1건의 업로드와 원본 파일을 삭제했습니다');
  expect(service.cancelStoredFile).toHaveBeenCalledTimes(2);
  expect(onCancelled).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText('statement.pdf 선택')).toBeChecked();
  expect(screen.getByRole('button', { name: '선택한 1건 업로드·원본 삭제' })).toBeEnabled();
});

test('batch processing is sequential and locks selection, confirmation and closing', async () => {
  let finishFirst!: () => void;
  service.listUploadHistory.mockResolvedValue([file, { ...file, id: 'file-2', originalFileName: 'second.pdf' }]);
  service.cancelStoredFile.mockImplementationOnce(() => new Promise<void>((resolve) => { finishFirst = resolve; }));
  const onClose = jest.fn();
  render(<CardStatementImportHistoryModal isOpen yearMonth="2026-09" onClose={onClose} onCancelled={jest.fn()} />);
  fireEvent.click(await screen.findByLabelText('삭제 가능한 내역 전체 선택'));
  fireEvent.click(screen.getByRole('button', { name: '선택한 2건 업로드·원본 삭제' }));
  const confirm = screen.getByRole('button', { name: '확인, 2건 원본까지 삭제' });
  fireEvent.click(confirm);
  fireEvent.click(confirm);
  expect(service.cancelStoredFile).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText('삭제 가능한 내역 전체 선택')).toBeDisabled();
  expect(screen.getByRole('button', { name: '닫기' })).toBeDisabled();
  expect(onClose).not.toHaveBeenCalled();
  finishFirst();
  await waitFor(() => expect(service.cancelStoredFile).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.getByRole('button', { name: '닫기' })).toBeEnabled());
});

test('changing month clears selected files and any pending confirmation', async () => {
  const props = { isOpen: true, onClose: jest.fn(), onCancelled: jest.fn() };
  const view = render(<CardStatementImportHistoryModal {...props} yearMonth="2026-09" />);
  fireEvent.click(await screen.findByLabelText('statement.pdf 선택'));
  fireEvent.click(screen.getByRole('button', { name: '선택한 1건 업로드·원본 삭제' }));
  service.listUploadHistory.mockResolvedValue([{ ...file, id: 'august', originalFileName: 'august.pdf' }]);
  view.rerender(<CardStatementImportHistoryModal {...props} yearMonth="2026-08" />);
  expect(await screen.findByLabelText('august.pdf 선택')).not.toBeChecked();
  expect(screen.queryByRole('button', { name: /확인,.*원본까지 삭제/ })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '선택한 0건 업로드·원본 삭제' })).toBeDisabled();
  expect(service.cancelStoredFile).not.toHaveBeenCalled();
});

test('successful cancellations stay hidden even when the list refresh fails', async () => {
  render(<CardStatementImportHistoryModal isOpen yearMonth="2026-09" onClose={jest.fn()} onCancelled={jest.fn()} />);
  fireEvent.click(await screen.findByLabelText('statement.pdf 선택'));
  fireEvent.click(screen.getByRole('button', { name: '선택한 1건 업로드·원본 삭제' }));
  service.listUploadHistory.mockRejectedValue(new Error('offline'));
  fireEvent.click(screen.getByRole('button', { name: '확인, 원본까지 삭제' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('목록 새로고침에 실패');
  expect(screen.queryByRole('button', { name: 'statement.pdf 업로드·원본 삭제' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '선택한 0건 업로드·원본 삭제' })).toBeDisabled();
});

test('previously cancelled originals can be selected in bulk and completed deletion has no action', async () => {
  service.listUploadHistory.mockResolvedValue([
    { ...file, status: 'cancelled', storagePath: 'statements/one.pdf' },
    { ...file, id: 'file-2', originalFileName: 'second.pdf', status: 'cancelled', storagePath: 'statements/two.pdf' },
    { ...file, id: 'deleted', originalFileName: 'deleted.pdf', status: 'cancelled', storagePath: 'statements/deleted.pdf', sourceDeletionStatus: 'deleted' },
  ]);
  render(<CardStatementImportHistoryModal isOpen yearMonth="2026-09" onClose={jest.fn()} onCancelled={jest.fn()} />);
  await screen.findByText('이 월에는 표시할 업로드 내역이 없습니다.');
  fireEvent.click(screen.getByLabelText('취소 내역도 보기'));
  expect(screen.getByRole('button', { name: 'statement.pdf 남은 원본 삭제' })).toBeEnabled();
  expect(screen.queryByRole('button', { name: 'deleted.pdf 원본 열기' })).not.toBeInTheDocument();
  expect(screen.queryByLabelText('deleted.pdf 선택')).not.toBeInTheDocument();
  fireEvent.click(screen.getByLabelText('삭제 가능한 내역 전체 선택'));
  fireEvent.click(screen.getByRole('button', { name: '선택한 2건 업로드·원본 삭제' }));
  expect(screen.getByText(/원본 PDF는 복구할 수 없으니/)).toBeVisible();
  expect(service.cancelStoredFile).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '확인, 2건 원본까지 삭제' }));
  await screen.findByText(/선택한 2건 중 2건의 업로드와 원본 파일을 삭제했습니다/);
  await waitFor(() => expect(screen.getAllByText('원본 삭제됨')).toHaveLength(3));
  expect(screen.queryByRole('button', { name: 'statement.pdf 남은 원본 삭제' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '선택한 0건 업로드·원본 삭제' })).toBeDisabled();
});

test('storage failure refreshes detached ledger rows and keeps a selected, visible retry', async () => {
  service.listUploadHistory.mockResolvedValue([{ ...file, storagePath: 'statements/one.pdf' }]);
  service.cancelStoredFile.mockRejectedValueOnce(Object.assign(new Error('원본 삭제를 완료하지 못했습니다.'), { details: { sourceDeletionStatus: 'pending' } }));
  const onCancelled = jest.fn();
  render(<CardStatementImportHistoryModal isOpen yearMonth="2026-09" onClose={jest.fn()} onCancelled={onCancelled} />);
  fireEvent.click(await screen.findByRole('button', { name: 'statement.pdf 업로드·원본 삭제' }));
  fireEvent.click(screen.getByRole('button', { name: '확인, 원본까지 삭제' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('원본 삭제를 완료하지 못했습니다.');
  expect(onCancelled).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText('statement.pdf 선택')).toBeChecked();
  expect(screen.getByLabelText('취소 내역도 보기')).not.toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: 'statement.pdf 남은 원본 삭제' }));
  fireEvent.click(screen.getByRole('button', { name: '확인, 원본까지 삭제' }));
  expect(await screen.findByText(/업로드와 원본 파일을 삭제했습니다/)).toBeVisible();
  expect(screen.queryByLabelText('statement.pdf 선택')).not.toBeInTheDocument();
});

test('stale list data cannot bring back a successfully deleted upload', async () => {
  service.listUploadHistory.mockResolvedValue([
    { ...file, storagePath: 'statements/one.pdf' },
    { ...file, id: 'file-2', originalFileName: 'second.pdf', storagePath: 'statements/two.pdf' },
  ]);
  render(<CardStatementImportHistoryModal isOpen yearMonth="2026-09" onClose={jest.fn()} onCancelled={jest.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: 'statement.pdf 업로드·원본 삭제' }));
  fireEvent.click(screen.getByRole('button', { name: '확인, 원본까지 삭제' }));
  await screen.findByText(/업로드와 원본 파일을 삭제했습니다/);
  await waitFor(() => expect(service.listUploadHistory).toHaveBeenCalledTimes(2));
  fireEvent.click(screen.getByLabelText('취소 내역도 보기'));
  expect(await screen.findByText('원본 삭제됨')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'statement.pdf 업로드·원본 삭제' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'statement.pdf 원본 열기' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'second.pdf 업로드·원본 삭제' }));
  fireEvent.click(screen.getByRole('button', { name: '확인, 원본까지 삭제' }));
  await waitFor(() => expect(screen.getAllByText('원본 삭제됨')).toHaveLength(2));
  expect(screen.queryByLabelText('statement.pdf 선택')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('second.pdf 선택')).not.toBeInTheDocument();
});
