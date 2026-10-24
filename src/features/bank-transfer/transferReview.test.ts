import { buildTransferReview } from './transferReview';
import { createTransferRow } from './transferModel';
import type { TransferCandidate } from './types';
const candidate = { id: 'one', source: 'account', sourceId: 'one', name: '검증대상', category: 'worker', bankCode: '004', accountNumber: '001-234-567', amount: 100, period: '2026-09' } as TransferCandidate;
it('은행·계좌를 정규화해 같은 계좌의 각 행에 주의를 표시하고 여러 대상 월을 보존한다', () => {
    const rows = [createTransferRow(candidate, '', ''), createTransferRow({ ...candidate, id: 'two', bankCode: ' 004 ', accountNumber: '001234567', period: '2026-10', warning: '자동이체 대상' }, '', ''),
        createTransferRow({ ...candidate, id: 'three', bankCode: '088' }, '', '')];
    const review = buildTransferReview(rows);
    expect(review.duplicateAccounts).toBe(1);
    expect(review.warningCount).toBe(2);
    expect(review.periods).toEqual(['2026-09', '2026-10']);
    expect(review.notes.get(rows[1].rowId)).toEqual(['자동이체 대상', '동일 계좌 2건 · 중복 지급 여부 확인']);
    expect(review.notes.get(rows[2].rowId)).toEqual([]);
});
