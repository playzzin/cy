import { formatTypedDateInput, normalizeTypedDateInput, toShortYearDateInputValue } from './typedDateInput';

describe('formatTypedDateInput', () => {
    it('preserves separated full dates while typing', () => {
        expect(formatTypedDateInput('2026-5-1')).toBe('2026-5-1');
        expect(formatTypedDateInput('2026/05/01')).toBe('2026-05-01');
    });

    it('formats compact full dates as YYYY-MM-DD', () => {
        expect(formatTypedDateInput('20260501')).toBe('2026-05-01');
    });

    it('formats compact dates with two-digit years when requested', () => {
        expect(formatTypedDateInput('260501', { yearDigits: 2 })).toBe('26-05-01');
        expect(formatTypedDateInput('20260501', { yearDigits: 2 })).toBe('26-05-01');
        expect(formatTypedDateInput('2026/05/01', { yearDigits: 2 })).toBe('26-05-01');
    });
});

describe('normalizeTypedDateInput', () => {
    const currentYear = new Date().getFullYear();

    it('accepts short month/day inputs using the current year', () => {
        expect(normalizeTypedDateInput('0501')).toBe(`${currentYear}-05-01`);
        expect(normalizeTypedDateInput('501')).toBe(`${currentYear}-05-01`);
        expect(normalizeTypedDateInput('51')).toBe(`${currentYear}-05-01`);
        expect(normalizeTypedDateInput('5/1')).toBe(`${currentYear}-05-01`);
        expect(normalizeTypedDateInput('5-1')).toBe(`${currentYear}-05-01`);
        expect(normalizeTypedDateInput('5월 1일')).toBe(`${currentYear}-05-01`);
    });

    it('pads single-digit month or day in full date inputs', () => {
        expect(normalizeTypedDateInput('2026-05-1')).toBe('2026-05-01');
        expect(normalizeTypedDateInput('2026-5-1')).toBe('2026-05-01');
        expect(normalizeTypedDateInput('2026년 5월 1일')).toBe('2026-05-01');
    });

    it('accepts two-digit year date inputs as 2000s dates', () => {
        expect(normalizeTypedDateInput('26-05-01')).toBe('2026-05-01');
        expect(normalizeTypedDateInput('260501')).toBe('2026-05-01');
        expect(normalizeTypedDateInput('26년 5월 1일')).toBe('2026-05-01');
    });

    it('rejects invalid calendar dates', () => {
        expect(normalizeTypedDateInput('2026-02-29')).toBeNull();
        expect(normalizeTypedDateInput('2026-13-01')).toBeNull();
        expect(normalizeTypedDateInput('2026-05-32')).toBeNull();
    });
});

describe('toShortYearDateInputValue', () => {
    it('converts normalized dates to YY-MM-DD', () => {
        expect(toShortYearDateInputValue('2026-05-01')).toBe('26-05-01');
    });
});
