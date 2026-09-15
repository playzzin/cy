import { AccommodationBillingDocument } from '../types/accommodationBilling';
import { accommodationReviewBill } from './supportLedgerReviewAdapters';
import { reviewLedgerPosting, reviewSupportLedger } from './supportLedgerReview';

const stored: AccommodationBillingDocument = {
    id: 'office-bill', yearMonth: '2026-09', teamId: '', teamName: '사무실',
    issuedToType: 'team', issuedToWorkerId: '', issuedToWorkerName: '', status: 'draft',
    lineItems: [{ id: 'rent', label: '시험 월세', targetField: 'accommodation', amount: 30000, sourceType: 'utility_ledger' }],
};

test('recognizes the existing office name when the stored team ID is empty', () => {
    const actual = accommodationReviewBill(stored, () => 'room');
    const expected = accommodationReviewBill({ ...stored, teamId: '__office__' }, () => 'room');
    expect(reviewSupportLedger([{ id: 'room', label: '시험 숙소', amount: 30000, expected: expected.charges }], [actual])).toEqual([]);
    expect(reviewLedgerPosting('accommodation', '2026-09', [actual], [], [])).toEqual([
        expect.objectContaining({ level: 'info', title: '사무실 부담' }),
    ]);
    expect(stored.teamId).toBe('');
});

test('keeps missing recipients unresolved when their names only contain the office word', () => {
    const actual = accommodationReviewBill({ ...stored, teamName: '사무실 공사팀' }, () => 'room');
    expect(reviewLedgerPosting('accommodation', '2026-09', [actual], [], [])[0]).toMatchObject({ level: 'unverified', title: '정산 대상 확인 필요' });
});
