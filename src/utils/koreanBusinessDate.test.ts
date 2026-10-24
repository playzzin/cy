import { getKoreanDateKey, getKoreanMinuteOfDay, shiftDateKey, toKoreanDateKey } from './koreanBusinessDate';

describe('Korean business date', () => {
    it('changes day at Korea midnight, including month and year boundaries', () => {
        expect(getKoreanDateKey(new Date('2026-09-26T14:59:59Z'))).toBe('2026-09-26');
        expect(getKoreanDateKey(new Date('2026-09-26T15:00:00Z'))).toBe('2026-09-27');
        expect(getKoreanDateKey(new Date('2026-12-31T15:00:00Z'))).toBe('2027-01-01');
        expect(getKoreanDateKey(new Date('2026-09-30T20:00:00Z'))).toBe('2026-10-01');
    });
    it('resolves Korea time without changing an explicit business date', () => {
        expect(getKoreanMinuteOfDay(new Date('2026-09-26T15:00:00Z'))).toBe(0);
        expect(getKoreanMinuteOfDay(new Date('2026-09-27T09:00:00Z'))).toBe(18 * 60);
        expect(toKoreanDateKey('2026-09-26')).toBe('2026-09-26');
        expect(toKoreanDateKey('2026-09-26T20:00:00Z')).toBe('2026-09-27');
        expect(shiftDateKey('2026-03-01', -1)).toBe('2026-02-28');
    });
});
