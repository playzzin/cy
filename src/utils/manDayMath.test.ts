import { formatManDayWithDecimal, roundManDay, sumManDays } from './manDayMath';

describe('manDayMath', () => {
  it('keeps row, daily and grand totals aligned for the rejected statement sample', () => {
    const dailyTotals = [8.5, 17.2, 9, 2, 2, 17, 3, 9, 10, 17, 26.4, 28];
    expect(sumManDays(dailyTotals)).toBe(149.1);
    expect(roundManDay(dailyTotals.reduce((total, value) => total + value, 0))).toBe(149.1);
  });

  it('always shows at least one decimal place', () => {
    expect(formatManDayWithDecimal(1)).toBe('1.0');
    expect(formatManDayWithDecimal(149.1)).toBe('149.1');
    expect(formatManDayWithDecimal(0)).toBe('');
  });
});
