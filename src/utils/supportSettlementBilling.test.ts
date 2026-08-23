import {
    getSettlementBillingRowScopeKey,
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

    it('keeps a different asset ledger draft when another asset is posted', () => {
        const docs = [
            { id: 'vehicle-a-confirmed', assetId: 'vehicle-a', status: 'CONFIRMED', sourceType: 'ledger' },
            { id: 'vehicle-a-draft', assetId: 'vehicle-a', status: 'DRAFT', sourceType: 'ledger' },
            { id: 'vehicle-b-draft', assetId: 'vehicle-b', status: 'DRAFT', sourceType: 'ledger' }
        ];

        expect(selectPreferredSettlementBillings(
            docs,
            (doc) => doc.sourceType === 'ledger',
            (doc) => doc.assetId
        )).toEqual([
            docs[0],
            docs[2]
        ]);
    });

    it('does not merge documents whose grouping identity is missing', () => {
        const docs = [
            { id: 'unknown-confirmed', status: 'CONFIRMED', sourceType: 'ledger' },
            { id: 'unknown-draft', status: 'DRAFT', sourceType: 'ledger' }
        ];

        expect(selectPreferredSettlementBillings(
            docs,
            (doc) => doc.sourceType === 'ledger',
            () => ''
        )).toEqual(docs);
    });

    it('prefers posted status only within the same modern row scope', () => {
        const docs = [
            { id: 'vehicle-a__row_segment-a', assetId: 'vehicle-a', status: 'CONFIRMED', sourceType: 'ledger' },
            { id: 'vehicle-a__row_segment-a', assetId: 'vehicle-a', status: 'DRAFT', sourceType: 'ledger' },
            { id: 'vehicle-a__row_segment-b', assetId: 'vehicle-a', status: 'DRAFT', sourceType: 'ledger' }
        ];

        expect(selectPreferredSettlementBillings(
            docs,
            (doc) => doc.sourceType === 'ledger',
            (doc) => doc.assetId,
            getSettlementBillingRowScopeKey
        )).toEqual([docs[0], docs[2]]);
    });

    it('lets an unscoped posted legacy document supersede scoped drafts for that asset', () => {
        const docs = [
            { id: 'vehicle-a-legacy', assetId: 'vehicle-a', status: 'CONFIRMED', sourceType: 'ledger' },
            { id: 'vehicle-a__row_segment-a', assetId: 'vehicle-a', status: 'DRAFT', sourceType: 'ledger' },
            { id: 'vehicle-a__row_segment-b', assetId: 'vehicle-a', status: 'DRAFT', sourceType: 'ledger' }
        ];

        expect(selectPreferredSettlementBillings(
            docs,
            (doc) => doc.sourceType === 'ledger',
            (doc) => doc.assetId,
            getSettlementBillingRowScopeKey
        )).toEqual([docs[0]]);
    });

    it('drops an unscoped legacy ledger draft after modern row drafts exist', () => {
        const docs = [
            { id: 'vehicle-a-legacy', assetId: 'vehicle-a', status: 'DRAFT', sourceType: 'ledger' },
            { id: 'vehicle-a__row_segment-a', assetId: 'vehicle-a', status: 'DRAFT', sourceType: 'ledger' },
            { id: 'vehicle-a__row_segment-b', assetId: 'vehicle-a', status: 'DRAFT', sourceType: 'ledger' }
        ];

        expect(selectPreferredSettlementBillings(
            docs,
            (doc) => doc.sourceType === 'ledger',
            (doc) => doc.assetId,
            getSettlementBillingRowScopeKey
        )).toEqual([docs[1], docs[2]]);
    });
});
