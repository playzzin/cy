import { act, renderHook } from '@testing-library/react';
import { useMessageReadActions } from './useMessageReadActions';
import { messageService } from '../services/messageService';
import type { ErpMessage } from '../types/erpMessage';

jest.mock('../services/messageService', () => ({ messageService: {
  isReadBy: (message: ErpMessage, uid: string) => message.readBy.includes(uid),
  markAsRead: jest.fn(), markAllAsRead: jest.fn()
} }));
const message = { id: 'one', readBy: [] } as unknown as ErpMessage;
beforeEach(() => {
  jest.clearAllMocks();
  (messageService.markAsRead as jest.Mock).mockResolvedValue(undefined);
  (messageService.markAllAsRead as jest.Mock).mockResolvedValue(undefined);
});

it('deduplicates concurrent reads and exposes an explicit retry after rejection', async () => {
  let fail!: (error: Error) => void;
  (messageService.markAsRead as jest.Mock).mockImplementationOnce(() => new Promise((_resolve, reject) => { fail = reject; }));
  const { result } = renderHook(() => useMessageReadActions('viewer'));
  let first!: Promise<void>;
  act(() => { first = result.current.markRead(message); void result.current.markRead(message); });
  expect(result.current.busy).toBe(true);
  expect(messageService.markAsRead).toHaveBeenCalledTimes(1);
  await act(async () => { fail(new Error('offline')); await first; });
  expect(result.current.busy).toBe(false);
  expect(result.current.error).toContain('저장하지 못했습니다');
  await act(async () => { await result.current.retry?.(); });
  expect(result.current.error).toBe('');
  expect(messageService.markAsRead).toHaveBeenCalledTimes(2);
});

it('ignores receipt errors from an account that is no longer active', async () => {
  let fail!: (error: Error) => void;
  (messageService.markAsRead as jest.Mock).mockImplementationOnce(() => new Promise((_resolve, reject) => { fail = reject; }));
  const { result, rerender } = renderHook(({ uid }) => useMessageReadActions(uid), { initialProps: { uid: 'first' } });
  let receipt!: Promise<void>;
  act(() => { receipt = result.current.markRead(message); });
  rerender({ uid: 'second' });
  await act(async () => { fail(new Error('offline')); await receipt; });
  expect(result.current.error).toBe('');
  expect(result.current.busy).toBe(false);
  expect(result.current.retry).toBeNull();
});

it('does not acknowledge a read message and retains bulk failures for retry', async () => {
  const { result } = renderHook(() => useMessageReadActions('viewer'));
  await act(async () => { await result.current.markRead({ ...message, readBy: ['viewer'] }); });
  expect(messageService.markAsRead).not.toHaveBeenCalled();
  (messageService.markAllAsRead as jest.Mock).mockRejectedValueOnce(new Error('offline'));
  await act(async () => { await result.current.markAllRead([message]); });
  expect(result.current.error).toContain('저장하지 못했습니다');
  await act(async () => { await result.current.retry?.(); });
  expect(messageService.markAllAsRead).toHaveBeenLastCalledWith([message], 'viewer');
  expect(result.current.error).toBe('');
});
