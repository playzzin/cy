import { getDocs, getDocsFromServer, runTransaction, doc, writeBatch, addDoc, updateDoc } from 'firebase/firestore';
import { webcrypto } from 'crypto';
import { TextEncoder } from 'util';
import type { TaxInvoiceIssue } from '../types/taxInvoiceList';
import { taxInvoiceListService as service } from './taxInvoiceListService';
import { siteService } from './siteService';
import { companyService } from './companyService';
import { dailyReportService } from './dailyReportService';
import { IssueBatchWriteError } from '../utils/taxInvoiceIssueDraft';

jest.mock('../config/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
    collection: jest.fn(), doc: jest.fn(), query: jest.fn(), where: jest.fn(),
    getDocs: jest.fn(), addDoc: jest.fn(), updateDoc: jest.fn(), deleteDoc: jest.fn(),
    writeBatch: jest.fn(), serverTimestamp: jest.fn(() => 'MOCK_TIME'),
    getDocsFromServer: jest.fn(), runTransaction: jest.fn(),
}));
jest.mock('./siteService', () => ({ siteService: { getSites: jest.fn() } }));
jest.mock('./companyService', () => ({ companyService: { getCompanies: jest.fn().mockResolvedValue([]) } }));
jest.mock('./dailyReportService', () => ({ dailyReportService: { getWorkerRows: jest.fn() } }));
beforeEach(() => {
    jest.clearAllMocks();
    (companyService.getCompanies as jest.Mock).mockResolvedValue([]);
});
beforeAll(() => {
    Object.defineProperty(global, 'TextEncoder', { configurable: true, value: TextEncoder });
    Object.defineProperty(global, 'crypto', { configurable: true, value: webcrypto });
});

test('월 조회는 완료된 기록의 공급받는자와 순번을 보존하며 쓰기를 하지 않는다', async () => {
    const stored = { yearMonth: '2026-09', no: 9, issueStatus: 'issued', recipient: '기존 발주사', siteId: 'site' };
    (getDocs as jest.Mock).mockResolvedValue({ docs: [{ id: 'issue', data: () => stored }] });
    (siteService.getSites as jest.Mock).mockResolvedValue([{ id: 'site', clientCompanyName: '새 발주사' }]);
    expect(await service.getIssuesByMonth('2026-09')).toEqual([{ id: 'issue', ...stored }]);
    expect(siteService.getSites).not.toHaveBeenCalled();
    expect(writeBatch).not.toHaveBeenCalled();
    expect(updateDoc).not.toHaveBeenCalled();
});

test('조회 정렬과 전월 이월 필터는 쓰기 없이 유지한다', async () => {
    (getDocs as jest.Mock).mockResolvedValue({ docs: [
        { id: 'B', data: () => ({ no: 2, issueStatus: 'issued' }) },
        { id: 'A', data: () => ({ no: 1, issueStatus: 'deferred' }) },
    ] });
    expect((await service.getIssuesByMonth('2026-09')).map(x => x.id)).toEqual(['A', 'B']);
    expect((await service.getDeferredIssuesByMonth('2026-09')).map(x => x.id)).toEqual(['A']);
    expect(writeBatch).not.toHaveBeenCalled();
});

test('조회 결과의 ID는 저장된 본문보다 실제 문서 경로를 우선한다', async () => {
    (getDocs as jest.Mock).mockResolvedValue({ docs: [{ id: 'actual-document', data: () => ({ id: 'obsolete-copy-id', no: 1, issueStatus: 'deferred' }) }] });
    expect((await service.getIssuesByMonth('2026-09'))[0].id).toBe('actual-document');
    expect((await service.getDeferredIssuesByMonth('2026-09'))[0].id).toBe('actual-document');
});

test('순번 정리는 최신 서버 목록만 사용하며 서버 조회 실패 시 쓰기를 하지 않는다', async () => {
    const batch = { update: jest.fn(), commit: jest.fn().mockResolvedValue(undefined) };
    (writeBatch as jest.Mock).mockReturnValue(batch);
    (doc as jest.Mock).mockImplementation((_db, _collection, id) => ({ id }));
    (getDocsFromServer as jest.Mock).mockResolvedValueOnce({ docs: [{ id: 'actual', data: () => ({ id: 'stale', no: 7 }) }] });
    expect(await service.renumberIssuesByMonth('2026-09')).toEqual([{ id: 'actual', no: 1 }]);
    expect(batch.update).toHaveBeenCalledWith({ id: 'actual' }, expect.objectContaining({ no: 1 }));
    expect(getDocs).not.toHaveBeenCalled();
    (getDocsFromServer as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    await expect(service.renumberIssuesByMonth('2026-09')).rejects.toThrow('offline');
    expect(writeBatch).toHaveBeenCalledTimes(1); expect(batch.commit).toHaveBeenCalledTimes(1);
});

test('잘못된 날짜는 단건 및 전체 일괄 요청의 쓰기 시작 전에 거절한다', async () => {
    await expect(service.updateIssue('A', { issueDate: '2026-02-30' })).rejects.toThrow('발행일');
    await expect(service.addIssue({ issueDate: '' } as any)).rejects.toThrow('발행일');
    const updates = Array.from({ length: 451 }, (_, index) => ({ id: String(index), data: { issueDate: index === 450 ? '2026-02-30' : '2026-09-30' } }));
    await expect(service.updateIssuesBatch(updates)).rejects.toThrow('발행일');
    expect(updateDoc).not.toHaveBeenCalled(); expect(addDoc).not.toHaveBeenCalled();
    expect(writeBatch).not.toHaveBeenCalled();
});

test('정상 날짜와 부분 수정은 기존 일괄 저장 방식으로 처리한다', async () => {
    const batch = { update: jest.fn(), commit: jest.fn().mockResolvedValue(undefined) };
    (writeBatch as jest.Mock).mockReturnValue(batch);
    await service.updateIssuesBatch([{ id: 'A', data: { issueDate: '2028-02-29' } }, { id: 'B', data: { supplyAmount: -100 } }]);
    expect(batch.update).toHaveBeenCalledTimes(2); expect(batch.commit).toHaveBeenCalledTimes(1);
});

test('신규 현장 가져오기는 현재 현장 발주사와 일보 공수를 유지한다', async () => {
    (siteService.getSites as jest.Mock).mockResolvedValue([{ id: 'site', clientCompanyName: '현재 발주사' }]);
    (dailyReportService.getWorkerRows as jest.Mock).mockResolvedValue([
        { siteId: 'site', siteName: '합성 현장', siteType: '도급', paymentType: '계산서', teamName: '합성 팀', manDay: 1 },
        { siteId: 'site', siteName: '합성 현장', siteType: '도급', paymentType: '계산서', teamName: '합성 팀', manDay: 0.5 },
    ]);
    expect(await service.fetchMonthlySiteData('2026-09')).toEqual([expect.objectContaining({
        siteId: 'site', companyName: '현재 발주사', manDays: 1.5, teamName: '합성 팀',
    })]);
});

test.each(['save', 'delete'])('%s의 두 번째 묶음 실패 시 첫 묶음의 완료 ID를 반환한다', async operation => {
    const first = { update: jest.fn(), delete: jest.fn(), commit: jest.fn().mockResolvedValue(undefined) };
    const failure = new Error('second batch failed');
    const second = { update: jest.fn(), delete: jest.fn(), commit: jest.fn().mockRejectedValue(failure) };
    (writeBatch as jest.Mock).mockReturnValueOnce(first).mockReturnValueOnce(second);
    const ids = Array.from({ length: 451 }, (_, n) => String(n));
    const request = operation === 'save' ? service.updateIssuesBatch(ids.map(id => ({ id, data: { item: '새 값' } }))) : service.deleteIssuesBatch(ids);
    await expect(request).rejects.toMatchObject({ completedIds: ids.slice(0, 450), originalError: failure });
    expect(first.commit).toHaveBeenCalledTimes(1); expect(second.commit).toHaveBeenCalledTimes(1);
});

test('첫 묶음 실패 시 완료 ID가 없으며 다음 묶음을 시작하지 않는다', async () => {
    (writeBatch as jest.Mock).mockReturnValue({ update: jest.fn(), commit: jest.fn().mockRejectedValue(new Error('first batch failed')) });
    const request = service.updateIssuesBatch(Array.from({ length: 451 }, (_, n) => ({ id: String(n), data: { item: '새 값' } })));
    await expect(request).rejects.toBeInstanceOf(IssueBatchWriteError);
    await expect(request).rejects.toMatchObject({ completedIds: [] });
    expect(writeBatch).toHaveBeenCalledTimes(1);
});

test.each([Infinity, Number.MAX_SAFE_INTEGER + 1])('숫자 오류 %s는 전체 저장 요청의 쓰기 전에 검증한다', async invalidNumber => {
    await expect(service.addIssue({ issueDate: '2026-09-30', supplyAmount: Infinity } as any)).rejects.toThrow('숫자');
    await expect(service.updateIssue('A', { manDays: NaN })).rejects.toThrow('숫자');
    const updates = Array.from({ length: 451 }, (_, n) => ({ id: String(n), data: { supplyAmount: n === 450 ? invalidNumber : 1 } }));
    await expect(service.updateIssuesBatch(updates)).rejects.toThrow('숫자');
    expect(writeBatch).not.toHaveBeenCalled(); expect(addDoc).not.toHaveBeenCalled(); expect(updateDoc).not.toHaveBeenCalled();
});

const carryover: Omit<TaxInvoiceIssue, 'id'> = {
    yearMonth: '2026-09', no: 1, isNew: '', issueDate: '2026-08-31', recipient: '원본', item: '',
    supplyAmount: 100, manDays: 1, note: '', issueStatus: 'ready', scanCompleted: false,
    carriedFromIssueId: 'SOURCE', carriedFromYearMonth: '2026-08',
};

test('동시 이월 요청은 같은 문서에서 경쟁하며 한 건만 생성하고 기존 값을 덮어쓰지 않는다', async () => {
    const stored = new Map<string, any>();
    const state = { retries: 0, writes: 0, firstReads: 0, releaseReads: () => {} };
    const simultaneousReads = new Promise<void>(resolve => { state.releaseReads = resolve; });
    (getDocsFromServer as jest.Mock).mockResolvedValue({ docs: [] });
    (doc as jest.Mock).mockImplementation((_db, _collection, id) => ({ id }));
    // An optimistic transaction runner: retry if a document changed after it was read.
    (runTransaction as jest.Mock).mockImplementation(async (_db, run) => {
        for (let attempt = 0; attempt < 5; attempt++) {
            const reads = new Map<string, any>();
            const pending = new Map<string, any>();
            const result = await run({
                get: async (ref: { id: string }) => {
                    const data = stored.get(ref.id); reads.set(ref.id, data);
                    if (attempt === 0 && !data) {
                        state.firstReads++;
                        if (state.firstReads === 2) state.releaseReads();
                        await simultaneousReads;
                    }
                    return { id: ref.id, exists: () => !!data, data: () => data };
                },
                set: (ref: { id: string }, data: any) => pending.set(ref.id, data),
            });
            if ([...reads].some(([id, data]) => stored.get(id) !== data)) { state.retries++; continue; }
            pending.forEach((data, id) => { stored.set(id, data); state.writes++; });
            return result;
        }
        throw new Error('transaction retry exhausted');
    });
    const results = await Promise.all([service.importDeferredIssue(carryover), service.importDeferredIssue(carryover)]);
    expect(stored.size).toBe(1); expect(state.writes).toBe(1);
    expect(results.filter(result => result.created)).toHaveLength(1);
    expect(results[0].issue.id).toBe(results[1].issue.id);
    expect(state.retries).toBe(1);
    const id = results[0].issue.id!;
    stored.set(id, { ...stored.get(id), recipient: '다른 탭에서 수정', issueStatus: 'issued' });
    const again = await service.importDeferredIssue(carryover);
    expect(again).toMatchObject({ created: false, issue: { id, recipient: '다른 탭에서 수정', issueStatus: 'issued' } });
    expect(state.writes).toBe(1); expect(addDoc).not.toHaveBeenCalled();
});

test('기존 임의 ID의 이월을 재사용하며 조회 실패 시 새 문서를 만들지 않는다', async () => {
    const existing = { ...carryover, recipient: '기존 편집값', no: 7 };
    (getDocsFromServer as jest.Mock).mockResolvedValueOnce({ docs: [{ id: 'legacy', data: () => existing }] });
    expect(await service.importDeferredIssue(carryover)).toEqual({ issue: { id: 'legacy', ...existing }, created: false });
    expect(runTransaction).not.toHaveBeenCalled();
    (getDocsFromServer as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    await expect(service.importDeferredIssue(carryover)).rejects.toThrow('offline');
    expect(runTransaction).not.toHaveBeenCalled(); expect(addDoc).not.toHaveBeenCalled();
});

test('다른 대상 월은 별도 이월이며 삭제한 이월은 같은 ID로 다시 생성할 수 있다', async () => {
    const stored = new Map<string, any>();
    (getDocsFromServer as jest.Mock).mockResolvedValue({ docs: [] });
    (doc as jest.Mock).mockImplementation((_db, _collection, id) => ({ id }));
    (runTransaction as jest.Mock).mockImplementation(async (_db, run) => run({
        get: async (ref: { id: string }) => ({ id: ref.id, exists: () => stored.has(ref.id), data: () => stored.get(ref.id) }),
        set: (ref: { id: string }, data: any) => stored.set(ref.id, data),
    }));
    const first = await service.importDeferredIssue(carryover);
    const second = await service.importDeferredIssue({ ...carryover, yearMonth: '2026-10' });
    expect(first.issue.id).not.toBe(second.issue.id);
    stored.delete(first.issue.id!);
    const restored = await service.importDeferredIssue(carryover);
    expect(restored.created).toBe(true); expect(restored.issue.id).toBe(first.issue.id);
});

test('같은 이름의 팀도 원본 ID로 구분한 집계 식별자를 전달한다', async () => {
    (siteService.getSites as jest.Mock).mockResolvedValue([]);
    (dailyReportService.getWorkerRows as jest.Mock).mockResolvedValue(['TEAM_A', 'TEAM_B'].map(teamId => ({
        siteId: 'site', siteName: '같은 현장', teamId, teamName: '같은 팀', manDay: 1, siteType: '지원', paymentType: '계산서',
    })));
    const rows = await service.fetchMonthlySiteData('2026-09');
    expect(rows).toHaveLength(2);
    expect(rows[0].sourceKey).toBeTruthy(); expect(rows[0].sourceKey).not.toBe(rows[1].sourceKey);
    expect(rows.map(row => row.manDays)).toEqual([1, 1]);
});
