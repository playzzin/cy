import { act, renderHook } from '@testing-library/react';
import { useMessageReadActions } from './useMessageReadActions';
import { messageService } from '../services/messageService';
import type { ErpMessage } from '../types/erpMessage';

jest.mock('../services/messageService', () => ({ messageService: {
  isReadBy: (message: ErpMessage, uid: string) => message.readBy.includes(uid),
  markAsRead: jest.fn(), markAllAsRead: jest.fn()
} }));
const message = { id: 'one', readBy: [] } as unknown as ErpMessage;
let mockPreview = false;
jest.mock('../utils/devPreviewRuntime', () => ({ get isDevPreviewFrame() { return mockPreview; } }));
beforeEach(() => {
  mockPreview = false;
  jest.clearAllMocks();
  (messageService.markAsRead as jest.Mock).mockResolvedValue(undefined);
  (messageService.markAllAsRead as jest.Mock).mockResolvedValue(undefined);
});
afterEach(() => jest.useRealTimers());

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

it('retries a temporary failure once without showing an error', async () => {
  jest.useFakeTimers();
  (messageService.markAsRead as jest.Mock).mockRejectedValueOnce({ code: 'firestore/unavailable' });
  const { result } = renderHook(() => useMessageReadActions('viewer'));
  let receipt!: Promise<void>;
  await act(async () => { receipt = result.current.markRead(message); });
  expect(result.current.busy).toBe(true);
  expect(result.current.error).toBe('');
  await act(async () => { jest.advanceTimersByTime(600); await receipt; });
  expect(messageService.markAsRead).toHaveBeenCalledTimes(2);
  expect(result.current.busy).toBe(false);
  expect(result.current.error).toBe('');
});

it('stops automatic retries after the second temporary failure', async () => {
  jest.useFakeTimers();
  (messageService.markAsRead as jest.Mock).mockRejectedValue({ code: 'unavailable' });
  const { result } = renderHook(() => useMessageReadActions('viewer'));
  let receipt!: Promise<void>;
  await act(async () => { receipt = result.current.markRead(message); });
  await act(async () => { jest.advanceTimersByTime(600); await receipt; });
  expect(messageService.markAsRead).toHaveBeenCalledTimes(2);
  expect(result.current.error).toContain('연결 상태');
  expect(result.current.retry).not.toBeNull();
});

it.each([
  ['permission-denied', '권한'], ['unauthenticated', '로그인'], ['not-found', '삭제']
])('explains %s without retrying automatically', async (code, explanation) => {
  (messageService.markAsRead as jest.Mock).mockRejectedValueOnce({ code });
  const { result } = renderHook(() => useMessageReadActions('viewer'));
  await act(async () => { await result.current.markRead(message); });
  expect(messageService.markAsRead).toHaveBeenCalledTimes(1);
  expect(result.current.error).toContain(explanation);
});

it('opens preview content without attempting to save single or bulk receipts', async () => {
  mockPreview = true;
  const { result } = renderHook(() => useMessageReadActions('viewer'));
  await act(async () => { await result.current.markRead(message); await result.current.markAllRead([message]); });
  expect(messageService.markAsRead).not.toHaveBeenCalled();
  expect(messageService.markAllAsRead).not.toHaveBeenCalled();
  expect(result.current.readOnly).toBe(true);
  expect(result.current.error).toBe('');
});

it('preserves all failed receipts when another message succeeds', async () => {
  (messageService.markAsRead as jest.Mock).mockRejectedValueOnce(new Error('offline')).mockRejectedValueOnce(new Error('offline'));
  const { result } = renderHook(() => useMessageReadActions('viewer'));
  await act(async () => {
    await result.current.markRead(message);
    await result.current.markRead({ ...message, id: 'two' });
    await result.current.markRead({ ...message, id: 'three' });
  });
  expect(result.current.error).not.toBe('');
  await act(async () => { await result.current.retry?.(); });
  expect((messageService.markAsRead as jest.Mock).mock.calls.map(call => call[0])).toEqual(['one', 'two', 'three', 'one', 'two']);
  expect(result.current.error).toBe('');
});

it('clears stale errors after another screen successfully saves the receipt', async () => {
  (messageService.markAsRead as jest.Mock).mockRejectedValueOnce(new Error('offline'));
  const { result, rerender } = renderHook(({ messages }) => useMessageReadActions('viewer', messages), { initialProps: { messages: [message] } });
  await act(async () => { await result.current.markRead(message); });
  expect(result.current.error).not.toBe('');
  rerender({ messages: [{ ...message, readBy: ['viewer'], readReceiptPending: true }] });
  expect(result.current.error).not.toBe('');
  rerender({ messages: [{ ...message, readBy: ['viewer'] }] });
  expect(result.current.error).toBe('');
  expect(result.current.retry).toBeNull();
});

it('cancels a delayed retry when the account changes, even if it changes back', async () => {
  jest.useFakeTimers();
  (messageService.markAsRead as jest.Mock).mockRejectedValueOnce({ code: 'unavailable' });
  const { result, rerender } = renderHook(({ uid }) => useMessageReadActions(uid), { initialProps: { uid: 'first' } });
  let receipt!: Promise<void>;
  await act(async () => { receipt = result.current.markRead(message); });
  rerender({ uid: 'second' });
  rerender({ uid: 'first' });
  await act(async () => { jest.advanceTimersByTime(600); await receipt; });
  expect(messageService.markAsRead).toHaveBeenCalledTimes(1);
  expect(result.current.busy).toBe(false);
  expect(result.current.error).toBe('');
});

it('does not retry after the component unmounts', async () => {
  jest.useFakeTimers();
  (messageService.markAsRead as jest.Mock).mockRejectedValueOnce({ code: 'unavailable' });
  const { result, unmount } = renderHook(() => useMessageReadActions('viewer'));
  let receipt!: Promise<void>;
  await act(async () => { receipt = result.current.markRead(message); });
  unmount();
  await act(async () => { jest.advanceTimersByTime(600); await receipt; });
  expect(messageService.markAsRead).toHaveBeenCalledTimes(1);
});
