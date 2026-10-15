import { deleteTransferDraft, loadTransferDrafts, MAX_TRANSFER_DRAFT_ROWS, MAX_TRANSFER_DRAFTS, saveTransferDraft } from './transferDraftStorage';
import { createTransferRow } from './transferModel';
import type { TransferDraft } from './types';
import { buildPayrollTransferDetail } from './payrollTransferDetail';

const key = (uid: string) => `cy:bank-transfer:drafts:${encodeURIComponent(uid)}`;
const draft = (overrides: Partial<TransferDraft> = {}): TransferDraft => ({
    version: 1, id: 'fixture-draft', title: '10월 송금', period: '2026-10', receiverDisplay: '샘플회사',
    memoRule: '{이름} 급여', updatedAt: '2026-10-15T03:00:00.000Z',
    rows: [createTransferRow({
        id: 'account:fixture-worker', source: 'account', sourceId: 'fixture-worker', name: '샘플작업자',
        groupName: '샘플팀', category: 'worker', bankName: '국민은행', bankCode: '004', accountNumber: '001234567890',
        accountHolder: '샘플예금주', amount: 1000, period: '2026-10', detail: '테스트 전용',
    }, '샘플회사', '{이름} 급여')], ...overrides,
});

beforeEach(() => { window.localStorage.clear(); });
afterEach(() => { jest.restoreAllMocks(); });

describe('사용자별 송금 초안', () => {
    it('급여 상세를 그대로 저장하고 손상된 상세 구조는 읽지 않는다', () => {
        const value = draft();
        value.rows[0].payrollDetail = buildPayrollTransferDetail({ totalAmount: 1000 }, {
            salaryLabel: '월급제', amountBasis: '실지급액', originalAmount: 1000, isFinalized: true,
        });
        saveTransferDraft('fixture-user', value);
        expect(loadTransferDrafts('fixture-user')[0].rows[0].payrollDetail).toEqual(value.rows[0].payrollDetail);
        const raw = JSON.parse(localStorage.getItem(key('fixture-user'))!);
        raw.drafts[0].rows[0].payrollDetail.workEntries = null;
        localStorage.setItem(key('fixture-user'), JSON.stringify(raw));
        expect(() => loadTransferDrafts('fixture-user')).toThrow();
    });
    it('로그인 계정별로 저장, 복원, 삭제가 분리된다', () => {
        saveTransferDraft('fixture-user-a', draft());
        expect(loadTransferDrafts('fixture-user-a')).toEqual([draft()]);
        expect(loadTransferDrafts('fixture-user-b')).toEqual([]);
        saveTransferDraft('fixture-user-b', draft({ title: '다른 사용자 초안' }));
        deleteTransferDraft('fixture-user-a', 'fixture-draft');
        expect(loadTransferDrafts('fixture-user-a')).toEqual([]);
        expect(loadTransferDrafts('fixture-user-b')[0].title).toBe('다른 사용자 초안');
    });

    it('동일 초안의 제목, 기간 및 편집한 금액을 갱신한다', () => {
        saveTransferDraft('fixture-user', draft());
        const edited = draft({ title: '11월 송금', period: '2026-11', updatedAt: '2026-11-01T00:00:00.000Z' });
        edited.rows[0].amount = 2000;
        saveTransferDraft('fixture-user', edited);
        expect(loadTransferDrafts('fixture-user')).toEqual([edited]);
    });

    it('다른 창이 같은 시각에 저장한 변경도 감지하여 덮어쓰기와 삭제를 막는다', () => {
        const original = draft();
        saveTransferDraft('fixture-user', original);
        const newer = draft({ title: '다른 창에서 변경' });
        saveTransferDraft('fixture-user', newer);
        expect(() => saveTransferDraft('fixture-user', draft({ title: '오래된 창' }), { expectedDraft: original })).toThrow('다른 창');
        expect(() => deleteTransferDraft('fixture-user', original.id, { expectedDraft: original })).toThrow('다른 창');
        expect(loadTransferDrafts('fixture-user')).toEqual([newer]);
        saveTransferDraft('fixture-user', draft({ id: 'copy', title: '편집 내용 사본' }), { expectedDraft: null });
        expect(loadTransferDrafts('fixture-user')).toHaveLength(2);
    });

    it('다른 목록의 변경은 기존 목록 저장을 막지 않고 삭제된 목록은 조용히 재생성하지 않는다', () => {
        const original = draft();
        saveTransferDraft('fixture-user', original);
        saveTransferDraft('fixture-user', draft({ id: 'other' }));
        const next = draft({ title: '정상 갱신' });
        expect(() => saveTransferDraft('fixture-user', next, { expectedDraft: original })).not.toThrow();
        deleteTransferDraft('fixture-user', next.id);
        expect(() => saveTransferDraft('fixture-user', next, { expectedDraft: next })).toThrow('다른 창');
        expect(loadTransferDrafts('fixture-user').map(item => item.id)).toEqual(['other']);
    });

    it('송금 검증이 끝나지 않은 초안도 저장하고 최신순으로 복원한다', () => {
        const unfinished = draft({ id: 'unfinished' });
        unfinished.rows[0].amount = 0;
        unfinished.rows[0].accountNumber = '';
        saveTransferDraft('fixture-user', unfinished);
        saveTransferDraft('fixture-user', draft({ id: 'newest', updatedAt: '2026-11-01T00:00:00.000Z' }));
        expect(loadTransferDrafts('fixture-user').map((item) => item.id)).toEqual(['newest', 'unfinished']);
    });

    it.each(['', ' '])('빈 사용자 id를 모든 작업에서 거부한다', (uid) => {
        expect(() => loadTransferDrafts(uid)).toThrow('로그인');
        expect(() => saveTransferDraft(uid, draft())).toThrow('로그인');
        expect(() => deleteTransferDraft(uid, 'fixture-draft')).toThrow('로그인');
        expect(window.localStorage.length).toBe(0);
    });

    it('손상된 JSON을 조용히 덮어쓰지 않는다', () => {
        window.localStorage.setItem(key('fixture-user'), '{broken');
        expect(() => loadTransferDrafts('fixture-user')).toThrow('손상');
        expect(() => saveTransferDraft('fixture-user', draft())).toThrow('손상');
        expect(window.localStorage.getItem(key('fixture-user'))).toBe('{broken');
    });

    it.each([{ version: 2, drafts: [] }, { version: 1, drafts: [{ ...draft(), version: 2 }] }])('지원하지 않는 저장 버전은 명시적으로 거부한다', (value) => {
        window.localStorage.setItem(key('fixture-user'), JSON.stringify(value));
        expect(() => loadTransferDrafts('fixture-user')).toThrow('버전');
    });

    it.each([
        { version: 1, drafts: [{ ...draft(), title: null }] },
        { version: 1, drafts: [{ ...draft(), rows: [{ ...draft().rows[0], amount: '1000' }] }] },
        { version: 1, drafts: [{ ...draft(), rows: [{ ...draft().rows[0], source: ['account'] }] }] },
        { version: 1, drafts: [{ ...draft(), rows: [{ ...draft().rows[0], category: 'unknown' }] }] },
        { version: 1, drafts: [{ ...draft(), updatedAt: 'invalid-date' }] },
        { version: 1, drafts: [draft(), draft()] },
        { version: 1, drafts: [{ ...draft(), rows: [draft().rows[0], draft().rows[0]] }] },
    ])('형식이 잘못된 저장 자료는 복원하지 않는다', (value) => {
        window.localStorage.setItem(key('fixture-user'), JSON.stringify(value));
        expect(() => loadTransferDrafts('fixture-user')).toThrow('형식');
    });

    it('NaN은 JSON null로 변환하여 저장하지 않는다', () => {
        const invalid = draft();
        invalid.rows[0].amount = NaN;
        expect(() => saveTransferDraft('fixture-user', invalid)).toThrow('형식');
        expect(loadTransferDrafts('fixture-user')).toEqual([]);
    });

    it('저장 공간이 부족할 때 원래 자료를 보존하고 실패를 알린다', () => {
        saveTransferDraft('fixture-user', draft());
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('', 'QuotaExceededError'); });
        expect(() => saveTransferDraft('fixture-user', draft({ title: '갱신 실패' }))).toThrow('저장 공간이 부족');
        expect(loadTransferDrafts('fixture-user')[0].title).toBe('10월 송금');
    });

    it('저장소 읽기 제한을 빈 초안으로 위장하지 않는다', () => {
        jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('', 'SecurityError'); });
        expect(() => loadTransferDrafts('fixture-user')).toThrow('읽을 수 없습니다');
    });

    it('초안 수 제한에서도 기존 초안 갱신은 허용한다', () => {
        const drafts = Array.from({ length: MAX_TRANSFER_DRAFTS }, (_, i) => draft({ id: `draft-${i}` }));
        window.localStorage.setItem(key('fixture-user'), JSON.stringify({ version: 1, drafts }));
        expect(() => saveTransferDraft('fixture-user', draft())).toThrow('최대 20개');
        expect(() => saveTransferDraft('fixture-user', draft({ id: 'draft-0', title: '업데이트' }))).not.toThrow();
        expect(loadTransferDrafts('fixture-user')).toHaveLength(MAX_TRANSFER_DRAFTS);
    });

    it('초안 행 제한을 초과하면 저장하지 않는다', () => {
        const oversized = draft({ rows: Array.from({ length: MAX_TRANSFER_DRAFT_ROWS + 1 }, (_, i) => ({
            ...draft().rows[0], id: `candidate-${i}`, rowId: `row-${i}`,
        })) });
        expect(() => saveTransferDraft('fixture-user', oversized)).toThrow('최대 2,000행');
        expect(loadTransferDrafts('fixture-user')).toEqual([]);
    });
});

it('파일 생성 이력을 보존하고 잘못된 이력은 기존 저장본을 훼손하지 않는다', () => {
    const record = { id: 'export1', fileName: '검증.xlsx', createdAt: '2026-10-15T01:00:00Z', rowCount: 1, totalAmount: 1000 };
    const value = draft({ exportHistory: [record] }); saveTransferDraft('history-user', value);
    expect(loadTransferDrafts('history-user')[0].exportHistory).toEqual([record]);
    for (const invalid of [{ ...record, totalAmount: NaN }, { ...record, rowCount: -1 }, { ...record, createdAt: 'broken' }]) {
        expect(() => saveTransferDraft('history-user', { ...value, exportHistory: [invalid] })).toThrow();
    }
    expect(loadTransferDrafts('history-user')[0]).toEqual(value);
    expect(() => saveTransferDraft('history-user', { ...value, exportHistory: Array.from({ length: 21 }, (_, i) => ({ ...record, id: String(i) })) })).toThrow();
});
