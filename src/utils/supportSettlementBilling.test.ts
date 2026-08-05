import {
    isPostedSettlementBillingStatus,
    normalizeSettlementBillingStatus,
    selectPreferredSettlementBillings
} from './supportSettlementBilling';

describe('supportSettlementBilling', () => {
    it('normalizes posted billing statuses used by settlement', () => {
        expect(normalizeSettlementBillingStatus('CONFIRMED')).toBe('confirmed');
        expect(normalizeSettlementBillingStatus('\ud655\uc815')).toBe('confirmed');
        expect(isPostedSettlementBillingStatus('PAID')).toBe(true);
        expect(isPostedSettlementBillingStatus('OVERDUE')).toBe(true);
        expect(isPostedSettlementBillingStatus('DRAFT')).toBe(false);
    });

    it('prefers posted documents over draft ledger documents to prevent duplicate settlement', () => {
        const docs = [
            { id: 'draft-ledger', status: 'DRAFT', sourceType: 'ledger' },
            { id: 'confirmed-doc', status: 'CONFIRMED', sourceType: 'manual' }
        ];

        expect(selectPreferredSettlementBillings(docs, (doc) => doc.sourceType === 'ledger')).toEqual([
            docs[1]
        ]);
    });

    it('uses additional posted documents only when no posted document exists', () => {
        const docs = [
            { id: 'draft-ledger', status: 'DRAFT', sourceType: 'ledger' },
            { id: 'plain-draft', status: 'DRAFT', sourceType: 'manual' }
        ];

        expect(selectPreferredSettlementBillings(docs, (doc) => doc.sourceType === 'ledger')).toEqual([
            docs[0]
        ]);
    });
});
