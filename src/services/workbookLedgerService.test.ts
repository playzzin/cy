const mockGetDocs = jest.fn();
const mockGetDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockBatchCommit = jest.fn();
const mockBatchSet = jest.fn();
const mockBatchUpdate = jest.fn();
const mockSafeCreateLog = jest.fn();
let mockNextId = 0;
const mockQuery = jest.fn((base, ...constraints) => ({ base, constraints }));
const mockWhere = jest.fn((fieldPath, opStr, value) => ({ kind: 'where', fieldPath, opStr, value }));
const mockOrderBy = jest.fn((fieldPath, directionStr) => ({ kind: 'orderBy', fieldPath, directionStr }));
const mockLimit = jest.fn((value) => ({ kind: 'limit', value }));

jest.mock('firebase/firestore', () => ({
    collection: (_db: unknown, name: string) => ({ kind: 'collection', name }),
    doc: (_base: unknown, id?: string) => ({ kind: 'doc', id: id ?? `generated-${++mockNextId}` }),
    getDoc: (...args: unknown[]) => mockGetDoc(...args),
    getDocs: (...args: unknown[]) => mockGetDocs(...args),
    limit: (value: unknown) => mockLimit(value),
    orderBy: (fieldPath: unknown, directionStr: unknown) => mockOrderBy(fieldPath, directionStr),
    query: (base: unknown, ...constraints: unknown[]) => (mockQuery as any)(base, ...constraints),
    updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
    where: (fieldPath: unknown, opStr: unknown, value: unknown) => mockWhere(fieldPath, opStr, value),
    writeBatch: () => ({
        commit: (...args: unknown[]) => mockBatchCommit(...args),
        set: (...args: unknown[]) => mockBatchSet(...args),
        update: (...args: unknown[]) => mockBatchUpdate(...args),
    }),
}));

jest.mock('../config/firebase', () => ({ db: { kind: 'db' } }));
jest.mock('./workbookLedgerLogService', () => ({
    workbookLedgerLogService: {
        safeCreateLog: (...args: unknown[]) => mockSafeCreateLog(...args),
    },
}));

const { createWorkbookLedgerService } = require('./workbookLedgerService') as typeof import('./workbookLedgerService');
const { WorkbookLedgerBatchError } = require('./workbookLedgerService') as typeof import('./workbookLedgerService');

const makeStoredEntry = (id: string, overrides: Record<string, unknown> = {}) => ({
    id,
    transactionType: '매출' as const,
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

describe('workbookLedgerService write integrity', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockNextId = 0;
        mockGetDocs.mockReset().mockResolvedValue(makeSnapshot([]));
        mockGetDoc.mockReset().mockResolvedValue({ exists: () => false });
        mockBatchCommit.mockReset().mockResolvedValue(undefined);
        mockSafeCreateLog.mockResolvedValue(undefined);
        mockUpdateDoc.mockResolvedValue(undefined);
    });

    it('reports committed and pending records, logs committed chunks and invalidates stale caches', async () => {
        const service = createWorkbookLedgerService();
        await service.getEntries();
        const entries = Array.from({ length: 401 }, (_, index) => makeStoredEntry(`invoice-${index}`));
        mockBatchCommit.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('synthetic failure'));
        let failure: InstanceType<typeof WorkbookLedgerBatchError> | undefined;
        try { await service.addEntries(entries); } catch (error) { failure = error as InstanceType<typeof WorkbookLedgerBatchError>; }
        expect(failure).toBeInstanceOf(WorkbookLedgerBatchError);
        expect(failure!.committedEntries).toHaveLength(400);
        expect(failure!.pendingEntries).toHaveLength(1);
        expect(mockSafeCreateLog).toHaveBeenCalledTimes(400);
        mockGetDocs.mockResolvedValueOnce(makeSnapshot(entries.slice(0, 400)));
        expect(await service.getEntries()).toHaveLength(400);
        expect(mockGetDocs).toHaveBeenCalledTimes(2);
        expect(await service.addEntries(failure!.pendingEntries)).toHaveLength(1);
        expect(mockBatchSet.mock.calls[401][0].id).toBe('invoice-400');
        expect(mockSafeCreateLog).toHaveBeenCalledTimes(401);
    });

    it('retains generated IDs for a failed batch retry', async () => {
        const service = createWorkbookLedgerService();
        mockBatchCommit.mockRejectedValueOnce(new Error('synthetic failure'));
        const { id, ...entry } = makeStoredEntry('unused');
        let failure: InstanceType<typeof WorkbookLedgerBatchError> | undefined;
        try { await service.addEntries([entry]); } catch (error) { failure = error as InstanceType<typeof WorkbookLedgerBatchError>; }
        expect(failure!.pendingEntries[0].id).toBe('generated-1');
        await service.addEntries(failure!.pendingEntries);
        expect(mockBatchSet.mock.calls.map(([reference]) => reference.id)).toEqual(['generated-1', 'generated-1']);
    });

    it('commits invoices before linked payments when a later upload chunk fails', async () => {
        const service = createWorkbookLedgerService();
        const entries = [
            makeStoredEntry('payment', { totalAmount: 0, paymentAmount: 110000, matchedEntryId: 'invoice-399' }),
            ...Array.from({ length: 400 }, (_, index) => makeStoredEntry(`invoice-${index}`)),
        ];
        mockBatchCommit.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('synthetic failure'));
        let failure: InstanceType<typeof WorkbookLedgerBatchError> | undefined;
        try { await service.addEntries(entries); } catch (error) { failure = error as InstanceType<typeof WorkbookLedgerBatchError>; }
        expect(failure!.committedEntries).toHaveLength(400);
        expect(failure!.committedEntries.some((entry) => entry.id === 'invoice-399')).toBe(true);
        expect(failure!.pendingEntries.map((entry) => entry.id)).toEqual(['payment']);
    });

    it.each([{ appliedMonth: 13 }, { appliedMonth: 1.5 }, { paymentAmount: -1 }])('rejects invalid values before any writes: %o', async (overrides) => {
        const service = createWorkbookLedgerService();
        await expect(service.addEntries([makeStoredEntry('bad', overrides)])).rejects.toThrow();
        await expect(service.updateEntry('bad', overrides)).rejects.toThrow();
        expect(mockBatchSet).not.toHaveBeenCalled();
        expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('blocks deleting an invoice when a linked payment exists outside the loaded recent page', async () => {
        const service = createWorkbookLedgerService();
        const linked = makeStoredEntry('older-payment', { totalAmount: 0, paymentAmount: 110000, matchedEntryId: 'invoice' });
        mockGetDocs.mockResolvedValueOnce(makeSnapshot([linked]));
        await expect(service.softDeleteEntry('invoice')).rejects.toThrow('연결된');
        expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('checks advance source dependencies as well as direct payment links', async () => {
        const service = createWorkbookLedgerService();
        mockGetDocs.mockResolvedValueOnce(makeSnapshot([])).mockResolvedValueOnce(makeSnapshot([
            makeStoredEntry('usage', { sourceType: 'advanceUsage', sourceId: 'invoice', matchedEntryId: 'other' }),
        ]));
        await expect(service.softDeleteEntry('invoice')).rejects.toThrow('연결된');
        expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('blocks changing a linked invoice to another transaction type', async () => {
        const service = createWorkbookLedgerService();
        const original = makeStoredEntry('invoice');
        mockGetDoc.mockResolvedValue({ id: original.id, exists: () => true, data: () => original });
        mockGetDocs.mockResolvedValueOnce(makeSnapshot([makeStoredEntry('payment', { matchedEntryId: 'invoice' })]));
        await expect(service.updateEntry('invoice', { transactionType: '매입' })).rejects.toThrow('연결된');
        expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('deletes selected dependents before their invoice and logs only successful chunks', async () => {
        const service = createWorkbookLedgerService();
        const entries = [makeStoredEntry('invoice'), ...Array.from({ length: 400 }, (_, index) => makeStoredEntry(`payment-${index}`, {
            totalAmount: 0, paymentAmount: 1, matchedEntryId: 'invoice',
        }))];
        mockGetDocs.mockResolvedValue(makeSnapshot(entries));
        mockGetDoc.mockImplementation(async ({ id }) => ({ id, exists: () => true, data: () => entries.find((entry) => entry.id === id) }));
        mockBatchCommit.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('synthetic failure'));
        await expect(service.softDeleteEntries(entries.map((entry) => entry.id))).rejects.toThrow('400건 삭제 완료');
        expect(mockBatchUpdate.mock.calls[0][0].id).toBe('payment-0');
        expect(mockBatchUpdate.mock.calls[400][0].id).toBe('invoice');
        expect(mockSafeCreateLog).toHaveBeenCalledTimes(400);
    });
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
