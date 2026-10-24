import { act, renderHook } from '@testing-library/react';
import { useMessageInbox, useMessageNotifications } from './useMessageInbox';
import { messageService } from '../services/messageService';
import type { ErpMessage } from '../types/erpMessage';


jest.mock('../services/messageService', () => ({ messageService: {
    subscribeInbox: jest.fn(), buildSummary: (uid: string, messages: ErpMessage[]) => ({ total: messages.length, unread: messages.filter(message => !message.readBy.includes(uid)).length }),
    isReadBy: (message: ErpMessage, uid: string) => message.readBy.includes(uid)
} }));
const mockSubscriptions: Array<{ uid: string; next: (messages: ErpMessage[]) => void; error: (error: Error) => void; unsubscribe: jest.Mock }> = [];
const msg = (id: string, readBy: string[] = []) => ({ id, readBy } as ErpMessage);
beforeEach(() => {
    jest.clearAllMocks(); mockSubscriptions.length = 0;
    (messageService.subscribeInbox as jest.Mock).mockImplementation((uid, next, error) => {
        const unsubscribe = jest.fn(); mockSubscriptions.push({ uid, next, error, unsubscribe }); return unsubscribe;
    });
});

it('does not expose the previous account inbox or accept a late callback after switching accounts', () => {
    const { result, rerender } = renderHook(({ uid }) => useMessageInbox(uid), { initialProps: { uid: 'first' } });
    act(() => mockSubscriptions[0].next([msg('private')]));
    expect(result.current.messages).toHaveLength(1);
    rerender({ uid: 'second' });
    expect(result.current.messages).toEqual([]);
    expect(mockSubscriptions[0].unsubscribe).toHaveBeenCalled();
    act(() => mockSubscriptions[0].next([msg('late')]));
    expect(result.current.messages).toEqual([]);
    act(() => mockSubscriptions[1].next([msg('second-message')]));
    expect(result.current.messages[0].id).toBe('second-message');
});

it('retries subscriptions and clears stale errors after success', () => {
    const { result } = renderHook(() => useMessageInbox('viewer'));
    act(() => mockSubscriptions[0].error(new Error('offline')));
    expect(result.current.error).not.toBeNull();
    act(() => result.current.retry());
    expect(result.current.loading).toBe(true);
    act(() => mockSubscriptions[1].next([]));
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
});

it('counts more than twenty unread messages and only vibrates for newly arrived messages', () => {
    const vibrate = jest.fn();
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
    const { result } = renderHook(() => useMessageNotifications('viewer'));
    const messages = Array.from({ length: 25 }, (_, index) => msg(String(index)));
    act(() => mockSubscriptions[0].next(messages));
    expect(result.current.summary.unread).toBe(25);
    expect(vibrate).not.toHaveBeenCalled();
    act(() => mockSubscriptions[0].next(messages.map((message, index) => index === 0 ? msg(message.id, ['viewer']) : message)));
    expect(vibrate).not.toHaveBeenCalled();
    act(() => mockSubscriptions[0].next([...messages, msg('new')]));
    expect(vibrate).toHaveBeenCalledTimes(1);
});

it('does not replay an existing notification after it temporarily disappears from a snapshot', () => {
    const vibrate = jest.fn();
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
    renderHook(() => useMessageNotifications('viewer'));
    act(() => mockSubscriptions[0].next([msg('old')]));
    act(() => mockSubscriptions[0].next([]));
    act(() => mockSubscriptions[0].next([msg('old')]));
    expect(vibrate).not.toHaveBeenCalled();
    act(() => mockSubscriptions[0].next([msg('old'), msg('new')]));
    act(() => mockSubscriptions[0].next([msg('old')]));
    act(() => mockSubscriptions[0].next([msg('old'), msg('new')]));
    expect(vibrate).toHaveBeenCalledTimes(1);
});

jest.mock('./useNotificationCenter', () => ({ useNotificationCenter: () => ({
    preferences: { sound: true, sources: { notice: true, memo: true, task: true, message: true }, quietEnabled: false, quietStart: '22:00', quietEnd: '08:00', digestMinutes: 0 },
    states: {}, now: Date.now(), loading: false, error: null,
}) }));
