import {
    calculateTrendPercent,
    getPreviousDateRange,
    getTrendStatus
} from './dashboardKpiTrend';

describe('dashboardKpiTrend', () => {
    it('builds the adjacent previous range with the same inclusive day count', () => {
        expect(getPreviousDateRange('2026-06-01', '2026-06-30')).toEqual({
            startDate: '2026-05-02',
            endDate: '2026-05-31'
        });

        expect(getPreviousDateRange('2026-03-01', '2026-03-01')).toEqual({
            startDate: '2026-02-28',
            endDate: '2026-02-28'
        });
    });

    it('rejects invalid or reversed ranges', () => {
        expect(getPreviousDateRange('2026-02-30', '2026-03-01')).toBeNull();
        expect(getPreviousDateRange('2026-06-30', '2026-06-01')).toBeNull();
    });

    it('calculates rounded percent changes', () => {
        expect(calculateTrendPercent(125, 100)).toBe(25);
        expect(calculateTrendPercent(75, 100)).toBe(-25);
        expect(calculateTrendPercent(1, 3)).toBe(-66.7);
    });

    it('handles zero previous values predictably', () => {
        expect(calculateTrendPercent(0, 0)).toBe(0);
        expect(calculateTrendPercent(10, 0)).toBe(100);
        expect(calculateTrendPercent(-10, 0)).toBe(-100);
    });

    it('maps trend direction to KPI status', () => {
        expect(getTrendStatus(1)).toBe('up');
        expect(getTrendStatus(-1)).toBe('down');
        expect(getTrendStatus(0)).toBe('neutral');
    });
});
