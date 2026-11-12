import { httpsCallable } from 'firebase/functions';
import { cardStatementImportService } from './cardStatementImportService';

jest.mock('../config/firebase', () => ({ db: {}, functions: {}, storage: {} }));
jest.mock('firebase/functions', () => ({ httpsCallable: jest.fn() }));
jest.mock('firebase/firestore', () => ({}));
jest.mock('firebase/storage', () => ({}));
const callable = Object.assign(jest.fn(), { stream: jest.fn() });

beforeEach(() => {
  jest.clearAllMocks();
  callable.mockReset();
  jest.mocked(httpsCallable).mockReturnValue(callable);
});

test('requests explicit source deletion and verifies that the server actually completed it', async () => {
  callable.mockResolvedValue({ data: { ok: true, originalDeleted: true } });
  await cardStatementImportService.cancelStoredFile('file-1', { deleteOriginal: true });
  expect(httpsCallable).toHaveBeenCalledWith({}, 'cancelCardStatementImportFile');
  expect(callable).toHaveBeenCalledWith({ fileId: 'file-1', deleteOriginal: true });
});

test('an old server response is a retryable failure, never a source deletion success', async () => {
  callable.mockResolvedValue({ data: { ok: true } });
  await expect(cardStatementImportService.cancelStoredFile('file-1', { deleteOriginal: true })).rejects.toMatchObject({
    details: { sourceDeletionStatus: 'pending' },
  });
});

test('preserves server errors and supports legacy cancellation without deleting the source', async () => {
  const error = Object.assign(new Error('원본 삭제 재시도'), { details: { sourceDeletionStatus: 'pending' } });
  callable.mockRejectedValueOnce(error).mockResolvedValueOnce({ data: { ok: true } });
  await expect(cardStatementImportService.cancelStoredFile('file-1', { deleteOriginal: true })).rejects.toBe(error);
  await cardStatementImportService.cancelStoredFile('file-1');
  expect(callable).toHaveBeenLastCalledWith({ fileId: 'file-1' });
});
