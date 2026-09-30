import { doc, runTransaction } from 'firebase/firestore';
import { taxInvoiceListService as service } from './taxInvoiceListService';
import type { TaxInvoiceIssue } from '../types/taxInvoiceList';
import { IssueBatchWriteError, IssueDeleteConflictError, IssueSaveConflictError } from '../utils/taxInvoiceIssueDraft';

jest.mock('../config/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
    doc: jest.fn(), runTransaction: jest.fn(), serverTimestamp: jest.fn(() => 'saved'),
}));

const row = (id = 'A'): TaxInvoiceIssue => ({
    id, yearMonth: '2026-09', no: 1, isNew: '', issueDate: '2026-09-30',
    recipient: '합성 업체', item: '', supplyAmount: 100, manDays: 1, note: '',
    issueStatus: 'ready', scanCompleted: false,
});

// Model optimistic retries and atomic transaction commits without touching business records.
const useStore = (initial: TaxInvoiceIssue[], synchronize = false, failTransaction = 0) => {
    const stored = new Map(initial.map(issue => [issue.id!, issue]));
    const state = { reads: 0, writes: 0, deletes: 0, retries: 0, transactions: 0, release: () => {} };
    const barrier = new Promise<void>(resolve => { state.release = resolve; });
    (doc as jest.Mock).mockImplementation((_db, _collection, id) => ({ id }));
    (runTransaction as jest.Mock).mockImplementation(async (_db, run) => {
        state.transactions++;
        if (state.transactions === failTransaction) throw new Error('synthetic connection failure');
        for (let attempt = 0; attempt < 5; attempt++) {
            const reads = new Map<string, TaxInvoiceIssue | undefined>();
            const updates = new Map<string, Partial<TaxInvoiceIssue>>();
            const deletes = new Set<string>();
            const result = await run({
                get: async (ref: { id: string }) => {
                    const data = stored.get(ref.id);
                    reads.set(ref.id, data);
                    state.reads++;
                    if (synchronize && state.reads <= 2) {
                        if (state.reads === 2) state.release();
                        await barrier;
                    }
                    return { id: ref.id, exists: () => Boolean(data), data: () => data };
                },
                update: (ref: { id: string }, data: Partial<TaxInvoiceIssue>) => updates.set(ref.id, data),
                delete: (ref: { id: string }) => deletes.add(ref.id),
            });
            if ([...reads].some(([id, data]) => stored.get(id) !== data)) { state.retries++; continue; }
            updates.forEach((data, id) => { stored.set(id, { ...stored.get(id)!, ...data }); state.writes++; });
            deletes.forEach(id => { stored.delete(id); state.deletes++; });
            return result;
        }
        throw new Error('retry limit');
    });
    return { stored, state };
};

beforeEach(() => jest.clearAllMocks());

test('같은 금액의 동시 저장은 먼저 완료된 값을 유지하고 나중 요청에 충돌을 반환한다', async () => {
    const base = row();
    const { stored, state } = useStore([base], true);
    const results = await Promise.allSettled([
        service.saveIssuesWithConflictCheck([{ id: 'A', data: { supplyAmount: 200 } }], [base]),
        service.saveIssuesWithConflictCheck([{ id: 'A', data: { supplyAmount: 300 } }], [base]),
    ]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const failure = results.find(result => result.status === 'rejected') as PromiseRejectedResult;
    expect(failure.reason).toBeInstanceOf(IssueBatchWriteError);
    expect(failure.reason.originalError).toBeInstanceOf(IssueSaveConflictError);
    expect(failure.reason.originalError.conflicts).toEqual([{ id: 'A', current: stored.get('A'), fields: ['supplyAmount'] }]);
    expect(state.writes).toBe(1); expect(state.retries).toBe(1);
});

test('같은 행의 서로 다른 항목을 동시에 수정하면 두 변경을 모두 보존한다', async () => {
    const base = row();
    const { stored, state } = useStore([base], true);
    await Promise.all([
        service.saveIssuesWithConflictCheck([{ id: 'A', data: { supplyAmount: 200 } }], [base]),
        service.saveIssuesWithConflictCheck([{ id: 'A', data: { item: '동시 품목' } }], [base]),
    ]);
    expect(stored.get('A')).toMatchObject({ supplyAmount: 200, item: '동시 품목' });
    expect(state.writes).toBe(2); expect(state.retries).toBe(1);
});

test('이미 같은 값으로 저장된 재시도와 무관한 순번 변경은 충돌하지 않는다', async () => {
    const base = row();
    const { stored } = useStore([{ ...base, supplyAmount: 200, no: 10, note: '다른 창의 비고' }]);
    await service.saveIssuesWithConflictCheck([{ id: 'A', data: { supplyAmount: 200, item: '추가 품목' } }], [base]);
    expect(stored.get('A')).toMatchObject({ supplyAmount: 200, item: '추가 품목', no: 10, note: '다른 창의 비고' });
});

test.each([false, true])('삭제 또는 다른 달로 이동한 항목은 재생성하거나 덮어쓰지 않는다 (이동 %s)', moved => {
    const base = row();
    const current = moved ? { ...base, yearMonth: '2026-10' } : null;
    const { state } = useStore(current ? [current] : []);
    return expect(service.saveIssuesWithConflictCheck([{ id: 'A', data: { item: '내 입력' } }], [base]))
        .rejects.toMatchObject({ completedIds: [], originalError: { conflicts: [{ id: 'A', current, fields: ['item'] }] } })
        .then(() => expect(state.writes).toBe(0));
});

test.each([false, true])('두 번째 묶음 충돌 또는 연결 실패 시 첫 묶음의 완료 ID만 반환한다 (연결 실패 %s)', async networkFailure => {
    const base = Array.from({ length: 451 }, (_, index) => row(String(index)));
    const initial = base.map(issue => issue.id === '450' ? { ...issue, item: '다른 창의 값' } : issue);
    const { stored, state } = useStore(initial, false, networkFailure ? 2 : 0);
    const updates = base.map(issue => ({ id: issue.id!, data: { item: '내 입력' } }));
    await expect(service.saveIssuesWithConflictCheck(updates, base)).rejects.toMatchObject({ completedIds: base.slice(0, 450).map(issue => issue.id) });
    expect(state.writes).toBe(450);
    expect(stored.get('0')?.item).toBe('내 입력');
    expect(stored.get('450')?.item).toBe('다른 창의 값');
});

test('잘못된 마지막 행과 누락된 비교 기준은 첫 쓰기 전에 거절한다', async () => {
    const base = Array.from({ length: 451 }, (_, index) => row(String(index)));
    const { state } = useStore(base);
    await expect(service.saveIssuesWithConflictCheck(base.map(issue => ({ id: issue.id!, data: { supplyAmount: issue.id === '450' ? Infinity : 200 } })), base)).rejects.toThrow('숫자');
    await expect(service.saveIssuesWithConflictCheck([{ id: 'UNKNOWN', data: { item: '내 입력' } }], base)).rejects.toThrow('저장 기준');
    expect(state.transactions).toBe(0); expect(state.writes).toBe(0);
});

test('삭제 확인 전에 다른 창이 저장하면 재시도에서 변경을 발견하고 삭제를 중단한다', async () => {
    const base = row();
    const { stored, state } = useStore([base], true);
    const results = await Promise.allSettled([
        service.saveIssuesWithConflictCheck([{ id: 'A', data: { supplyAmount: 200 } }], [base]),
        service.deleteIssuesWithConflictCheck(['A'], [base]),
    ]);
    expect(results[0].status).toBe('fulfilled');
    const failure = results[1] as PromiseRejectedResult;
    expect(failure.reason.originalError).toBeInstanceOf(IssueDeleteConflictError);
    expect(failure.reason.originalError.conflicts).toEqual([{ id: 'A', current: stored.get('A'), fields: ['supplyAmount'], operation: 'delete' }]);
    expect(stored.get('A')?.supplyAmount).toBe(200);
    expect(state.deletes).toBe(0); expect(state.retries).toBe(1);
});

test.each([
    ['issueStatus', 'issued'], ['scanCompleted', true], ['yearMonth', '2026-10'], ['siteId', '다른 현장'],
])('삭제는 금액 외의 %s 변경도 확인하며 같은 묶음을 함께 보존한다', async (field, value) => {
    const base = [row('A'), row('B')];
    const latest = { ...base[1], [String(field)]: value };
    const { stored, state } = useStore([base[0], latest]);
    await expect(service.deleteIssuesWithConflictCheck(['A', 'B'], base)).rejects.toMatchObject({
        completedIds: [], originalError: { conflicts: [{ id: 'B', current: latest, fields: [field], operation: 'delete' }] },
    });
    expect(stored.size).toBe(2); expect(state.deletes).toBe(0);
});

test('같은 행의 중복 삭제는 한 번만 삭제하며 이미 없어진 행은 성공으로 정리한다', async () => {
    const base = row();
    const { stored, state } = useStore([base], true);
    await Promise.all([service.deleteIssuesWithConflictCheck(['A'], [base]), service.deleteIssuesWithConflictCheck(['A'], [base])]);
    expect(stored.size).toBe(0); expect(state.deletes).toBe(1);
    await service.deleteIssuesWithConflictCheck(['A'], [base]);
    expect(state.deletes).toBe(1);
});

test('순번 정리와 갱신 시각만 바뀐 행은 삭제를 불필요하게 막지 않는다', async () => {
    const base = row();
    const { stored } = useStore([{ ...base, no: 20, updatedAt: 'later', recipientManuallyEdited: false }]);
    await service.deleteIssuesWithConflictCheck(['A'], [base]);
    expect(stored.has('A')).toBe(false);
});

test.each([false, true])('두 번째 삭제 묶음 실패 시 완료한 첫 묶음만 보고하고 나머지를 보존한다 (연결 실패 %s)', async networkFailure => {
    const base = Array.from({ length: 451 }, (_, index) => row(String(index)));
    const initial = base.map(issue => issue.id === '450' ? { ...issue, supplyAmount: 999 } : issue);
    const { stored, state } = useStore(initial, false, networkFailure ? 2 : 0);
    await expect(service.deleteIssuesWithConflictCheck(base.map(issue => issue.id!), base)).rejects.toMatchObject({ completedIds: base.slice(0, 450).map(issue => issue.id) });
    expect(state.deletes).toBe(450); expect(stored.size).toBe(1); expect(stored.get('450')?.supplyAmount).toBe(999);
});

test('삭제 기준이 없거나 ID가 중복이면 어느 행도 삭제하지 않는다', async () => {
    const { state } = useStore([row()]);
    await expect(service.deleteIssuesWithConflictCheck(['A', 'UNKNOWN'], [row()])).rejects.toThrow('삭제 기준');
    await expect(service.deleteIssuesWithConflictCheck(['A', 'A'], [row()])).rejects.toThrow('삭제 기준');
    expect(state.transactions).toBe(0); expect(state.deletes).toBe(0);
});
