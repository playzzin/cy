import { LedgerCharge, LedgerReviewBill, LedgerReviewSource, reviewSupportLedger, reviewLedgerPosting } from './supportLedgerReview';
const charge: LedgerCharge = { sourceId: 'room', recipient: 'team-a', category: 'accommodation', amount: 30000, lineId: 'rent' };
const source: LedgerReviewSource = { id: 'room', label: '시험 숙소', amount: 30000, expected: [charge] };
const bill: LedgerReviewBill = { id: 'bill', label: '시험팀', status: 'CONFIRMED', teamId: 'team-a', recipientType: 'team', charges: [charge], total: 30000 };
const saved = { teamId: 'team-a', confirmed: true, deductions: [{ id: 'accommodation_billing:2026-09:bill', origin: 'accommodation_billing', amount: 30000 }] };
describe('full support ledger comparison', () => {
    it('matches source, billing and saved settlement without changing snapshots', () => {
        const before = JSON.stringify([source, bill, saved]);
        expect(reviewSupportLedger([source], [bill])).toEqual([]);
        expect(reviewLedgerPosting('accommodation', '2026-09', [bill], [saved], [])).toEqual([]);
        expect(JSON.stringify([source, bill, saved])).toBe(before);
    });
    it('detects swapped recipients even when overall totals match', () => {
        const issues = reviewSupportLedger([source], [{ ...bill, charges: [{ ...charge, recipient: 'team-b' }] }]);
        expect(issues.filter(i => i.title === '원장과 청구 금액 차이')).toHaveLength(2);
    });
    it('detects swapped cost categories even when totals match', () => {
        expect(reviewSupportLedger([source], [{ ...bill, charges: [{ ...charge, category: 'electricity' }] }])).toHaveLength(2);
    });
    it('detects duplicate automatic items across separate documents', () => {
        expect(reviewSupportLedger([source], [bill, { ...bill, id: 'duplicate' }]).some(i => i.title === '중복 청구 항목')).toBe(true);
    });
    it('excludes cancelled bills', () => {
        expect(reviewSupportLedger([source], [bill, { ...bill, id: 'cancelled', status: 'cancelled' }])).toEqual([]);
    });
    it('keeps manual/unlinked costs unverified', () => {
        expect(reviewSupportLedger([], [{ ...bill, charges: [{ ...charge, sourceId: undefined }] }])[0].level).toBe('unverified');
    });
    it('detects incomplete allocation and unknown recipients', () => {
        const issues = reviewSupportLedger([{ ...source, expected: [], missingTarget: true }], []);
        expect(issues.map(i => i.title)).toEqual(['부담 대상 확인 필요', '원장과 배분 금액 차이']);
    });
    it('rejects invalid amounts instead of treating them as zero', () => {
        expect(reviewSupportLedger([{ ...source, amount: NaN }], [bill]).some(i => i.level === 'difference')).toBe(true);
    });
    it('reports differences against a confirmed snapshot without replacing it', () => {
        expect(reviewLedgerPosting('accommodation', '2026-09', [{ ...bill, total: 20000 }], [saved], [])[0]).toMatchObject({ title: '청구와 저장 정산 차이', expected: 20000, actual: 30000 });
    });
    it('does not accept a settlement with the same bill ID in another team', () => {
        expect(reviewLedgerPosting('accommodation', '2026-09', [bill], [{ ...saved, teamId: 'another' }], [])[0].level).toBe('unverified');
    });
    it('reports a saved settlement referencing a removed billing document', () => {
        expect(reviewLedgerPosting('accommodation', '2026-09', [], [saved], [])[0].title).toBe('정산의 원본 청구 확인 필요');
    });
    it('requires reciprocal linkage and the same month for personal deductions', () => {
        const personal = { ...bill, recipientType: 'worker', postedAdvancePaymentId: 'advance' };
        const advance = { id: 'advance', yearMonth: '2026-09', accommodationBillingDocId: 'bill', amounts: { accommodation: 30000 } };
        expect(reviewLedgerPosting('accommodation', '2026-09', [personal], [], [advance])).toEqual([]);
        expect(reviewLedgerPosting('accommodation', '2026-09', [personal], [], [{ ...advance, yearMonth: '2026-08' }])[0].level).toBe('unverified');
        expect(reviewLedgerPosting('accommodation', '2026-09', [personal], [], [{ ...advance, amounts: { accommodation: 5000 } }])[0].actual).toBe(5000);
    });
    it('does not assume office costs or personal vehicle costs are payroll deductions', () => {
        expect(reviewLedgerPosting('vehicle', '2026-09', [{ ...bill, recipientType: 'worker' }], [], [])[0].level).toBe('unverified');
        expect(reviewLedgerPosting('vehicle', '2026-09', [{ ...bill, teamId: '__office__' }], [], [])[0].title).toBe('사무실 부담');
    });
});


describe('draft posting progress', () => {
    const draft = { ...bill, status: 'draft' };
    it('separates valid drafts awaiting confirmation from unresolved connections', () => {
        expect(reviewLedgerPosting('vehicle', '2026-09', [draft], [], [])[0]).toMatchObject({ level: 'pending', title: '청구 확정 대기' });
        expect(reviewLedgerPosting('accommodation', '2026-09', [{ ...draft, recipientType: 'worker' }], [], [])[0].level).toBe('pending');
        expect(reviewLedgerPosting('accommodation', '2026-09', [{ ...draft, teamId: '' }], [], [])[0].level).toBe('unverified');
        expect(reviewLedgerPosting('accommodation', '2026-09', [bill], [], [])[0].level).toBe('unverified');
    });
    it('still detects mismatched and duplicate saved deductions for drafts', () => {
        expect(reviewLedgerPosting('accommodation', '2026-09', [{ ...draft, total: 20000 }], [saved], [])[0].level).toBe('difference');
        expect(reviewLedgerPosting('accommodation', '2026-09', [draft], [saved, saved], [])[0].title).toBe('정산 중복 반영');
    });
    it('does not hide broken personal deduction links behind a draft status', () => {
        const personal = { ...draft, recipientType: 'worker' };
        expect(reviewLedgerPosting('accommodation', '2026-09', [{ ...personal, postedAdvancePaymentId: 'missing' }], [], [])[0].level).toBe('unverified');
        const partial = { id: 'advance', yearMonth: '2026-09', accommodationBillingDocId: bill.id, amounts: {} };
        expect(reviewLedgerPosting('accommodation', '2026-09', [personal], [], [partial])[0].level).toBe('unverified');
    });
    it('keeps a draft linked to the wrong team unresolved', () => {
        expect(reviewLedgerPosting('accommodation', '2026-09', [draft], [{ ...saved, teamId: 'wrong-team' }], [])[0].level).toBe('unverified');
    });
    it('does not treat unknown statuses as drafts', () => {
        expect(reviewLedgerPosting('vehicle', '2026-09', [{ ...bill, status: 'unknown' }], [], [])[0].level).toBe('unverified');
    });
});
