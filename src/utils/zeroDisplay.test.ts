import { formatTextForDisplay, formatNumberForDisplay } from './zeroDisplay';

describe('zero display helpers', () => {
    it('keeps zero visible and uses a dash only for invalid values', () => {
        expect(formatNumberForDisplay(0)).toBe('0');
        expect(formatNumberForDisplay(Number.NaN)).toBe('-');
        expect(formatNumberForDisplay(120000)).toBe('120,000');
    });

    it('keeps numeric text and uses a dash only for empty values', () => {
        expect(formatTextForDisplay('')).toBe('-');
        expect(formatTextForDisplay('0')).toBe('0');
        expect(formatTextForDisplay('0.00')).toBe('0.00');
        expect(formatTextForDisplay('001010-3******')).toBe('001010-3******');
        expect(formatTextForDisplay('2026-08-01')).toBe('2026-08-01');
    });
});
