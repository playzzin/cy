const mockGetDocs = jest.fn();
const mockGetDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockBatchCommit = jest.fn();
const mockBatchSet = jest.fn();
const mockBatchUpdate = jest.fn();
const mockQuery = jest.fn((base, ...constraints) => ({ base, constraints }));
const mockWhere = jest.fn((fieldPath, opStr, value) => ({ kind: 'where', fieldPath, opStr, value }));
const mockOrderBy = jest.fn((fieldPath, directionStr) => ({ kind: 'orderBy', fieldPath, directionStr }));
const mockLimit = jest.fn((value) => ({ kind: 'limit', value }));

jest.mock('firebase/firestore', () => ({
    collection: jest.fn((_db, name) => ({ kind: 'collection', name })),
    doc: jest.fn((_base, id) => ({ kind: 'doc', id })),
    getDoc: (...args: unknown[]) => mockGetDoc(...args),
    getDocs: (...args: unknown[]) => mockGetDocs(...args),
    limit: (value: unknown) => mockLimit(value),
    orderBy: (fieldPath: unknown, directionStr: unknown) => mockOrderBy(fieldPath, directionStr),
    query: (base: unknown, ...constraints: unknown[]) => (mockQuery as any)(base, ...constraints),
    updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
    where: (fieldPath: unknown, opStr: unknown, value: unknown) => mockWhere(fieldPath, opStr, value),
    writeBatch: jest.fn(() => ({
        commit: (...args: unknown[]) => mockBatchCommit(...args),
        set: (...args: unknown[]) => mockBatchSet(...args),
        update: (...args: unknown[]) => mockBatchUpdate(...args),
    })),
}));

jest.mock('../config/firebase', () => ({ db: { kind: 'db' } }));
jest.mock('./workbookLedgerLogService', () => ({
    workbookLedgerLogService: {
        safeCreateLog: jest.fn().mockResolvedValue(undefined),
    },
}));

const { createWorkbookLedgerService } = require('./workbookLedgerService') as typeof import('./workbookLedgerService');

const makeStoredEntry = (id: string, overrides: Record<string, unknown> = {}) => ({
    id,
    transactionType: '매출',
    date: '2026-08-01',
    partnerName: '테스트 거래처',
    siteName: '테스트 현장',
    description: '세금계산서',
    supplyAmount: 100_000,
    taxAmount: 10_000,
    totalAmount: 110_000,
    paymentAmount: 0,
    ...overrides,
});

const makeSnapshot = (entries: Array<ReturnType<typeof makeStoredEntry>>) => ({
    empty: entries.length === 0,
    size: entries.length,
    docs: entries.map(({ id, ...data }) => ({
        id,
        data: () => data,
    })),
});

const deferred = <T,>() => {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return { promise, resolve, reject };
};

describe('workbookLedgerService query cache', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockBatchCommit.mockResolvedValue(undefined);
        mockUpdateDoc.mockResolvedValue(undefined);
    });

    it('returns the same ascending order on the first read and a cache hit without exposing cached objects', async () => {
        mockGetDocs.mockResolvedValueOnce(makeSnapshot([
            makeStoredEntry('newer', { date: '2026-08-02' }),
            makeStoredEntry('older', { date: '2026-08-01' }),
        ]));
        const service = createWorkbookLedgerService('cheongyeon');

        const first = await service.getEntries({ orderDirection: 'asc' });
        expect(first.map((entry) => entry.id)).toEqual(['older', 'newer']);

        first[0].partnerName = '호출자 변경';
        first.reverse();

        const cached = await service.getEntries({ orderDirection: 'asc' });
        expect(cached.map((entry) => entry.id)).toEqual(['older', 'newer']);
        expect(cached[0].partnerName).toBe('테스트 거래처');
        expect(mockGetDocs).toHaveBeenCalledTimes(1);
    });

    it('keeps descending query order consistent across the first read and a cache hit', async () => {
        mockGetDocs.mockResolvedValueOnce(makeSnapshot([
            makeStoredEntry('older', { date: '2026-08-01' }),
            makeStoredEntry('newer', { date: '2026-08-02' }),
        ]));
        const service = createWorkbookLedgerService('cheongyeon');

        const first = await service.getEntries({ orderDirection: 'desc' });
        const cached = await service.getEntries({ orderDirection: 'desc' });

        expect(first.map((entry) => entry.id)).toEqual(['newer', 'older']);
        expect(cached.map((entry) => entry.id)).toEqual(['newer', 'older']);
        expect(mockGetDocs).toHaveBeenCalledTimes(1);
    });

    it('coalesces concurrent identical reads', async () => {
        const request = deferred<ReturnType<typeof makeSnapshot>>();
        mockGetDocs.mockReturnValueOnce(request.promise);
        const service = createWorkbookLedgerService('cheongyeon');

        const firstPromise = service.getEntries({ transactionType: '매출' });
        const secondPromise = service.getEntries({ transactionType: '매출' });
        expect(mockGetDocs).toHaveBeenCalledTimes(1);

        request.resolve(makeSnapshot([makeStoredEntry('invoice-1')]));
        const [first, second] = await Promise.all([firstPromise, secondPromise]);

        expect(first).toEqual(second);
        expect(first).not.toBe(second);
        expect(first[0]).not.toBe(second[0]);
    });

    it('does not let an older in-flight read overwrite a forced refresh', async () => {
        const oldRequest = deferred<ReturnType<typeof makeSnapshot>>();
        const freshRequest = deferred<ReturnType<typeof makeSnapshot>>();
        mockGetDocs
            .mockReturnValueOnce(oldRequest.promise)
            .mockReturnValueOnce(freshRequest.promise);
        const service = createWorkbookLedgerService('cheongyeon');

        const oldPromise = service.getEntries({ transactionType: '매출' });
        const freshPromise = service.getEntries({ transactionType: '매출', force: true });

        freshRequest.resolve(makeSnapshot([makeStoredEntry('fresh')]));
        await expect(freshPromise).resolves.toEqual([expect.objectContaining({ id: 'fresh' })]);

        oldRequest.resolve(makeSnapshot([makeStoredEntry('stale')]));
        await expect(oldPromise).resolves.toEqual([expect.objectContaining({ id: 'stale' })]);

        const cached = await service.getEntries({ transactionType: '매출' });
        expect(cached).toEqual([expect.objectContaining({ id: 'fresh' })]);
        expect(mockGetDocs).toHaveBeenCalledTimes(2);
    });

    it('keeps the requested limit correct when a missing index triggers client-side type filtering', async () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        const missingIndexError = Object.assign(new Error('The query requires an index.'), {
            code: 'failed-precondition',
        });
        mockGetDocs
            .mockRejectedValueOnce(missingIndexError)
            .mockResolvedValueOnce(makeSnapshot([
                makeStoredEntry('sale-old', { date: '2026-08-01' }),
                makeStoredEntry('purchase-newest', { transactionType: '매입', date: '2026-08-03' }),
                makeStoredEntry('sale-new', { date: '2026-08-02' }),
            ]));
        const service = createWorkbookLedgerService('cheongyeon');

        const result = await service.getEntries({
            transactionType: '매출',
            limitCount: 1,
            orderDirection: 'desc',
        });

        expect(result.map((entry) => entry.id)).toEqual(['sale-new']);
        expect(mockLimit).toHaveBeenCalledTimes(1);
        expect(warnSpy).toHaveBeenCalledTimes(1);
        warnSpy.mockRestore();
    });

});
