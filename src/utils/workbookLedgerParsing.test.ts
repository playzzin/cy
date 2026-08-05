import { normalizeWorkbookNumber, parseWorkbookNumber } from './workbookLedgerParsing';

describe('workbookLedgerParsing', () => {
    it('parses common workbook currency text', () => {
        expect(parseWorkbookNumber('1,234,567')).toBe(1_234_567);
        expect(parseWorkbookNumber('₩ 1,234,567원')).toBe(1_234_567);
        expect(parseWorkbookNumber('1 234 567')).toBe(1_234_567);
    });

    it('parses accounting negative amounts', () => {
        expect(parseWorkbookNumber('(1,234,567)')).toBe(-1_234_567);
        expect(parseWorkbookNumber('1,234,567-')).toBe(-1_234_567);
        expect(parseWorkbookNumber('−1,234,567')).toBe(-1_234_567);
    });

    it('keeps decimals when present', () => {
        expect(parseWorkbookNumber('1,234.5')).toBe(1_234.5);
        expect(parseWorkbookNumber('-.5')).toBe(-0.5);
    });

    it('returns null for empty or non-numeric text', () => {
        expect(parseWorkbookNumber('')).toBeNull();
        expect(parseWorkbookNumber('1,000만원')).toBeNull();
        expect(parseWorkbookNumber(Number.POSITIVE_INFINITY)).toBeNull();
    });

    it('normalizes invalid values to the supplied fallback', () => {
        expect(normalizeWorkbookNumber('bad', 7)).toBe(7);
        expect(normalizeWorkbookNumber('1,000', 7)).toBe(1_000);
    });
});
