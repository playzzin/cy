import { cardFirestoreService } from './cardFirestoreService';
import { runTransaction } from 'firebase/firestore';

type Stored = Record<string, unknown>;
const mockDocuments = new Map<string, Stored>();
const mockWrites: string[] = [];
const mockSnapshot = (path: string) => ({
    id: path.split('/').at(-1), ref: { path }, exists: () => mockDocuments.has(path),
    data: () => mockDocuments.get(path)
});

jest.mock('../config/firebase', () => ({ db: {}, auth: { currentUser: null } }));
jest.mock('./teamScopedReadService', () => ({ getTeamScopedRows: jest.fn() }));
jest.mock('./firestoreCrudCompat', () => ({}));
jest.mock('firebase/firestore', () => ({
    Timestamp: class {},
    doc: (_db: unknown, collection: string, id: string) => ({ path: `${collection}/${id}` }),
    collection: (_db: unknown, path: string) => ({ path }),
    where: (field: string, _op: string, value: unknown) => ({ field, value }),
    query: (collection: { path: string }, condition: { field: string; value: unknown }) => ({ ...collection, condition }),
    getDoc: async ({ path }: { path: string }) => mockSnapshot(path),
    getDocs: async ({ path, condition }: { path: string; condition: { field: string; value: unknown } }) => ({
        docs: [...mockDocuments.entries()].filter(([key, data]) => key.startsWith(`${path}/`)
            && data[condition.field] === condition.value).map(([key]) => mockSnapshot(key))
    }),
    serverTimestamp: () => 'server-time',
    runTransaction: jest.fn()
}));

const transition = (targetStatus: 'CLOSED' | 'AVAILABLE' = 'CLOSED', operationId = 'new-operation') =>
    cardFirestoreService.transitionCardLifecycle({
        cardId: 'card', effectiveDate: '2026-10-31', targetStatus, operationId,
        auditLog: { resourceType: 'card', resourceId: 'card', resourceLabel: '시험카드',
            reason: 'OTHER', reasonLabel: '시험', processedDate: '2026-10-31', note: '시험' }
    });

beforeEach(() => {
    mockDocuments.clear();
    mockWrites.length = 0;
    jest.clearAllMocks();
    mockDocuments.set('cards/card', { status: 'ASSIGNED', updatedAt: 'before', name: '시험카드' });
    for (const collection of ['cardAssignments', 'cardBillingTargets']) {
        mockDocuments.set(`${collection}/old`, { cardId: 'card', startDate: '2026-05-01', endDate: '2026-11-01' });
        mockDocuments.set(`${collection}/earlier`, { cardId: 'card', startDate: '2026-01-01', endDate: '2026-04-30' });
        mockDocuments.set(`${collection}/open`, { cardId: 'card', startDate: '2026-05-15' });
        mockDocuments.set(`${collection}/future`, { cardId: 'card', startDate: '2026-11-18' });
    }
    jest.mocked(runTransaction).mockImplementation(async (_db, action) => {
        const changes: Array<() => void> = [];
        const transaction = {
            get: async ({ path }: { path: string }) => mockSnapshot(path),
            update: ({ path }: { path: string }, data: Stored) => changes.push(() => {
                mockWrites.push(path); mockDocuments.set(path, { ...mockDocuments.get(path), ...data });
            }),
            delete: ({ path }: { path: string }) => changes.push(() => { mockWrites.push(path); mockDocuments.delete(path); }),
            set: ({ path }: { path: string }, data: Stored) => changes.push(() => { mockWrites.push(path); mockDocuments.set(path, data); })
        };
        const result = await action(transaction as never);
        changes.forEach(apply => apply());
        return result;
    });
});

it('backdates both closed and open links atomically without changing earlier history', async () => {
    const result = await transition();
    expect(result).toMatchObject({ changed: true, closedAssignmentCount: 3, closedBillingTargetCount: 3 });
    for (const collection of ['cardAssignments', 'cardBillingTargets']) {
        expect(mockDocuments.get(`${collection}/old`)?.endDate).toBe('2026-10-31');
        expect(mockDocuments.get(`${collection}/open`)?.endDate).toBe('2026-10-31');
        expect(mockDocuments.get(`${collection}/earlier`)?.endDate).toBe('2026-04-30');
        expect(mockDocuments.has(`${collection}/future`)).toBe(false);
    }
    expect(mockDocuments.get('cards/card')).toMatchObject({ status: 'CLOSED', currentAssigneeId: null, billingTargetId: null });
    expect(mockDocuments.get('support_cancellation_logs/new-operation')).toMatchObject({ processedDate: '2026-10-31', statusAfter: 'CLOSED' });
    const writeCount = mockWrites.length;
    expect(await transition()).toMatchObject({ changed: false });
    expect(mockWrites).toHaveLength(writeCount);
});

it('repairs an already inactive card with lingering links instead of treating it as a no-op', async () => {
    mockDocuments.set('cards/card', { status: 'CLOSED', updatedAt: 'before' });
    expect(await transition()).toMatchObject({ changed: true, statusBefore: 'CLOSED' });
    expect(mockDocuments.get('cardAssignments/old')?.endDate).toBe('2026-10-31');
});

it('restoration leaves closed historical periods unchanged', async () => {
    mockDocuments.set('cards/card', { status: 'CLOSED', updatedAt: 'before' });
    await transition('AVAILABLE');
    expect(mockDocuments.get('cardAssignments/old')?.endDate).toBe('2026-11-01');
    expect(mockDocuments.get('cardBillingTargets/old')?.endDate).toBe('2026-11-01');
    expect(mockDocuments.get('cards/card')?.status).toBe('AVAILABLE');
});

it('rejects a conflicting inactive status without writes', async () => {
    mockDocuments.set('cards/card', { status: 'SUSPENDED', updatedAt: 'before' });
    await expect(transition()).rejects.toThrow('inactive-card-status-transition-blocked');
    expect(mockWrites).toEqual([]);
});
