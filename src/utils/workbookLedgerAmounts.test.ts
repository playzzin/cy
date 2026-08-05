import { calculateWorkbookTotalAmount, calculateWorkbookVatAmount } from './workbookLedgerAmounts';

describe('workbookLedgerAmounts', () => {
    it('truncates VAT instead of rounding it', () => {
        expect(calculateWorkbookVatAmount(5_545_455)).toBe(554_545);
        expect(calculateWorkbookTotalAmount(5_545_455)).toBe(6_100_000);
    });

    it('keeps exact 10% amounts unchanged', () => {
        expect(calculateWorkbookVatAmount(1_000_000)).toBe(100_000);
        expect(calculateWorkbookTotalAmount(1_000_000)).toBe(1_100_000);
    });

    it('truncates negative VAT toward zero for reversal entries', () => {
        expect(calculateWorkbookVatAmount(-5_545_455)).toBe(-554_545);
        expect(calculateWorkbookTotalAmount(-5_545_455)).toBe(-6_100_000);
    });

    it('returns zero for invalid or empty amounts', () => {
        expect(calculateWorkbookVatAmount(Number.NaN)).toBe(0);
        expect(calculateWorkbookVatAmount(Number.POSITIVE_INFINITY)).toBe(0);
        expect(calculateWorkbookTotalAmount(Number.NaN)).toBe(0);
    });
});
