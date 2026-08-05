import {
    calculateBuybackSettlement,
    normalizeBuybackAfterTaxRate,
} from './buybackSettlement';

describe('buybackSettlement', () => {
    it('returns a balanced zero result for zero gross', () => {
        expect(calculateBuybackSettlement(0)).toEqual({
            grossAmount: 0,
            afterTaxAmount: 0,
            taxAmount: 0,
            settlementMode: 'rate',
            afterTaxRate: 0.75,
        });
    });

    it('clamps negative gross amounts to zero', () => {
        expect(calculateBuybackSettlement(-10_000)).toMatchObject({
            grossAmount: 0,
            afterTaxAmount: 0,
            taxAmount: 0,
        });
    });

    it('uses the default 75/25 split and rounds to whole won', () => {
        expect(calculateBuybackSettlement(1_001)).toEqual({
            grossAmount: 1001,
            afterTaxAmount: 751,
            taxAmount: 250,
            settlementMode: 'rate',
            afterTaxRate: 0.75,
        });
    });

    it('normalizes decimal and percentage rates', () => {
        expect(normalizeBuybackAfterTaxRate(0.75)).toBe(0.75);
        expect(normalizeBuybackAfterTaxRate(75)).toBe(0.75);
        expect(normalizeBuybackAfterTaxRate('75%')).toBe(0.75);
    });

    it('supports 100/0 and 0/100 rate splits', () => {
        expect(calculateBuybackSettlement(10_000, { afterTaxRate: 100 })).toMatchObject({
            afterTaxAmount: 10_000,
            taxAmount: 0,
            afterTaxRate: 1,
        });
        expect(calculateBuybackSettlement(10_000, { afterTaxRate: 0 })).toMatchObject({
            afterTaxAmount: 0,
            taxAmount: 10_000,
            afterTaxRate: 0,
        });
    });

    it('treats tax-invoice settlement as full tax amount', () => {
        expect(calculateBuybackSettlement(10_000, { settlementMode: 'taxInvoice' })).toEqual({
            grossAmount: 10_000,
            afterTaxAmount: 0,
            taxAmount: 10_000,
            settlementMode: 'taxInvoice',
            afterTaxRate: 0,
        });
    });

    it('clamps manual after-tax amounts to the gross range', () => {
        expect(calculateBuybackSettlement(10_000, {
            settlementMode: 'manual',
            manualAfterTaxAmount: 12_500,
        })).toMatchObject({
            afterTaxAmount: 10_000,
            taxAmount: 0,
            afterTaxRate: 1,
        });

        expect(calculateBuybackSettlement(10_000, {
            settlementMode: 'manual',
            manualAfterTaxAmount: -500,
        })).toMatchObject({
            afterTaxAmount: 0,
            taxAmount: 10_000,
            afterTaxRate: 0,
        });
    });
});
