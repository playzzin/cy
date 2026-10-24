import { act, renderHook } from '@testing-library/react';
import { useNotificationCenter } from './useNotificationCenter';
import { notificationCenterService } from '../services/notificationCenterService';
import { defaultNotificationPreferences } from '../utils/notificationCenter';
const subscriptions: Array<{ uid: string; next: (value: any) => void; error: (error: Error) => void; stop: jest.Mock }> = [];
jest.mock('../services/notificationCenterService', () => ({ notificationCenterService: { subscribePreferences: jest.fn(), subscribeStates: jest.fn() } }));
beforeEach(() => {
    subscriptions.length = 0;
    const subscribe = (uid: string, next: (value: any) => void, error: (error: Error) => void) => { const stop = jest.fn(); subscriptions.push({ uid, next, error, stop }); return stop; };
    (notificationCenterService.subscribePreferences as jest.Mock).mockImplementation(subscribe);
    (notificationCenterService.subscribeStates as jest.Mock).mockImplementation(subscribe);
});
it('isolates preferences and private state on account changes, ignoring late callbacks', () => {
    const { result, rerender } = renderHook(({ uid }) => useNotificationCenter(uid), { initialProps: { uid: 'one' } });
    act(() => { subscriptions[0].next(defaultNotificationPreferences); subscriptions[1].next({ private: { userId: 'one', messageId: 'private' } }); });
    expect(result.current.loading).toBe(false);
    rerender({ uid: 'two' });
    expect(result.current.states).toEqual({}); expect(result.current.loading).toBe(true);
    act(() => subscriptions[1].next({ leaked: {} }));
    expect(result.current.states).toEqual({});
    expect(subscriptions[0].stop).toHaveBeenCalled(); expect(subscriptions[1].stop).toHaveBeenCalled();
});
it('recovers both subscriptions explicitly after a failure', () => {
    const { result } = renderHook(() => useNotificationCenter('one'));
    act(() => subscriptions[0].error(new Error('offline')));
    expect(result.current.error).not.toBeNull();
    act(() => result.current.retry());
    act(() => { subscriptions[2].next(defaultNotificationPreferences); subscriptions[3].next({}); });
    expect(result.current.error).toBeNull(); expect(result.current.loading).toBe(false);
});
