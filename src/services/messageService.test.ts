import { onSnapshot, writeBatch, Timestamp } from 'firebase/firestore';
import { messageService } from './messageService';
import type { ErpMessage } from '../types/erpMessage';

jest.mock('../config/firebase', () => ({ db: {}, auth: {} }));
jest.mock('../utils/devAdminSession', () => ({ isDevAdminSessionEnabled: () => false }));
jest.mock('firebase/firestore', () => ({ ...jest.requireActual('firebase/firestore'),
    doc: jest.fn((_db, _collection, id) => id), collection: jest.fn(), query: jest.fn(), where: jest.fn(), onSnapshot: jest.fn(), writeBatch: jest.fn()
}));
beforeEach(() => jest.clearAllMocks());

it('processes every unread message across batch limits and deduplicates ids', async () => {
    const batches: Array<{ update: jest.Mock; commit: jest.Mock }> = [];
    (writeBatch as jest.Mock).mockImplementation(() => { const batch = { update: jest.fn(), commit: jest.fn(async () => undefined) }; batches.push(batch); return batch; });
    const messages = Array.from({ length: 901 }, (_, index) => ({ id: String(index), readBy: [] } as unknown as ErpMessage));
    await messageService.markAllAsRead([...messages, messages[0], { id: 'already-read', readBy: ['viewer'] } as unknown as ErpMessage], 'viewer');
    expect(batches.map(batch => batch.update.mock.calls.length)).toEqual([450, 450, 1]);
    expect(batches.every(batch => batch.commit.mock.calls.length === 1)).toBe(true);
});

it('waits for both inbox sources and deduplicates messages', () => {
    const callbacks: Array<(snapshot: unknown) => void> = [];
    const unsubscribe = jest.fn();
    (onSnapshot as jest.Mock).mockImplementation((_query, next) => { callbacks.push(next); return unsubscribe; });
    const next = jest.fn();
    const stop = messageService.subscribeInbox('viewer', next);
    const snapshot = { docs: [{ id: 'one', data: () => ({ title: '공지', recipientIds: ['viewer'], createdAt: Timestamp.now() }) }] };
    callbacks[0](snapshot);
    expect(next).not.toHaveBeenCalled();
    callbacks[1](snapshot);
    expect(next.mock.calls[0][0]).toHaveLength(1);
    stop();
    expect(unsubscribe).toHaveBeenCalledTimes(2);
});

it('does not hide a failed source when the other source updates', () => {
    const subscribers: Array<{ next: (snapshot: unknown) => void; fail: (error: Error) => void }> = [];
    (onSnapshot as jest.Mock).mockImplementation((_query, next, fail) => { subscribers.push({ next, fail }); return jest.fn(); });
    const next = jest.fn(); const fail = jest.fn();
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    messageService.subscribeInbox('viewer', next, fail);
    subscribers[0].fail(new Error('permission-denied'));
    subscribers[1].next({ docs: [] });
    expect(fail).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
    log.mockRestore();
});
