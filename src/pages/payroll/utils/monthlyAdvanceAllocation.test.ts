import {
    allocateMonthlyAdvanceTotals,
    resolveDefaultMonthlyAdvanceAssignment,
} from './monthlyAdvanceAllocation';

const source = {
    invoiceManDay: 4.5,
    laborManDay: 3,
    invoiceGrossAmount: 900000,
    laborGrossAmount: 600000,
};

describe('monthly advance allocation', () => {
    it('keeps the original corporate and labor split', () => {
        expect(allocateMonthlyAdvanceTotals(source, 'split')).toEqual(source);
    });

    it('moves all man-days and gross amount to corporate', () => {
        expect(allocateMonthlyAdvanceTotals(source, 'corporate')).toEqual({
            invoiceManDay: 7.5,
            laborManDay: 0,
            invoiceGrossAmount: 1500000,
            laborGrossAmount: 0,
        });
    });

    it('moves all man-days and gross amount to labor', () => {
        expect(allocateMonthlyAdvanceTotals(source, 'labor')).toEqual({
            invoiceManDay: 0,
            laborManDay: 7.5,
            invoiceGrossAmount: 0,
            laborGrossAmount: 1500000,
        });
    });

    it('uses the side with more man-days as the initial classification', () => {
        expect(resolveDefaultMonthlyAdvanceAssignment(source)).toBe('corporate');
        expect(resolveDefaultMonthlyAdvanceAssignment({
            ...source,
            invoiceManDay: 1,
            laborManDay: 2,
        })).toBe('labor');
    });
});
