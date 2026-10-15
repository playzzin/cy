import { reviewOtherDrafts, reviewCurrentOrigins } from './transferDuplicateReview';
import { createTransferRow } from './transferModel';
import type { TransferCandidate, TransferDraft } from './types';
const row = createTransferRow({ id: 'payroll:w1:totalAmount', sourceId: 'w1', source: 'payroll', category: 'worker', period: '2026-09', bankCode: '004', accountNumber: '001-234567', amount: 1000 } as TransferCandidate, '', '');
const draft = (id: string, rows = [row]): TransferDraft => ({ version: 1, id, title: id, period: '2026-10', receiverDisplay: '', memoRule: '', updatedAt: '2026-10-15T00:00:00Z', rows });
it('현재 목록은 제외하고 다른 월·다른 원본 동명 대상을 동일 항목으로 취급하지 않는다', () => {
    const notes = reviewOtherDrafts([row], 'current', [draft('current'), draft('other-month', [{ ...row, period: '2026-10' }]), draft('other-source', [{ ...row, sourceId: 'w2', accountNumber: '99999999' }])]);
    expect(notes.get(row.rowId)).toEqual([]);
});
it('계좌를 바꾸어도 같은 지급 원본과 다른 금액 기준의 중복 가능성을 찾는다', () => {
    const split = { ...row, id: 'payroll:w1:laborNet', rowId: 'split', accountNumber: '99999999', amount: 500 };
    expect(reviewOtherDrafts([split], 'current', [draft('previous')]).get('split')?.[0]).toContain('같은 원본의 다른 금액 기준');
    expect(reviewCurrentOrigins([row, split])).toEqual(new Set([row.rowId, 'split']));
});
it('등록 계좌는 목적이 불명확하므로 동일 계좌·금액이라는 확인 안내만 표시한다', () => {
    const manual = { ...row, source: 'account' as const, period: '', accountNumber: '001234567' };
    const notes = reviewOtherDrafts([manual], 'current', [{ ...draft('previous'), exportHistory: [{ id: 'export', fileName: '검증.xlsx', createdAt: '2026-10-15T00:00:00Z', rowCount: 1, totalAmount: 1000 }] }]).get(row.rowId);
    expect(notes?.[0]).toContain('동일 계좌·금액'); expect(notes?.[0]).toContain('파일 생성 이력'); expect(notes?.[0]).not.toContain('지급완료');
});
