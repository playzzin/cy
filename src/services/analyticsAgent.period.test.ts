import { AnalyticsAgent, calculatePeriod } from './analyticsAgent';
import { manpowerAnalyticsService } from './manpowerAnalyticsService';

// Mock service boundaries before loading the real module: no Firebase or AI initialization.
jest.mock('./manpowerAnalyticsService', () => ({
    manpowerAnalyticsService: { getTeamManpower: jest.fn().mockResolvedValue([]) },
}));
jest.mock('./aiSettingsService', () => ({ aiSettingsService: {} }));
jest.mock('./geminiModelPolicy', () => ({ DEFAULT_GEMINI_TEXT_MODEL: 'test-only' }));

// Literal calendar expectations; no production date helpers are used as the oracle.
// Columns: instant, today, yesterday, Sunday, last Sunday, last Saturday,
//          month start, last month start, last month end, year start, today minus seven.
const cases = [
    ['2026-09-28T00:00:00Z', '2026-09-28', '2026-09-27', '2026-09-27', '2026-09-20', '2026-09-26', '2026-09-01', '2026-08-01', '2026-08-31', '2026-01-01', '2026-09-21'],
    ['2024-02-29T14:59:59.999Z', '2024-02-29', '2024-02-28', '2024-02-25', '2024-02-18', '2024-02-24', '2024-02-01', '2024-01-01', '2024-01-31', '2024-01-01', '2024-02-22'],
    ['2024-02-29T15:00:00Z', '2024-03-01', '2024-02-29', '2024-02-25', '2024-02-18', '2024-02-24', '2024-03-01', '2024-02-01', '2024-02-29', '2024-01-01', '2024-02-23'],
    ['2024-02-29T23:59:59.999Z', '2024-03-01', '2024-02-29', '2024-02-25', '2024-02-18', '2024-02-24', '2024-03-01', '2024-02-01', '2024-02-29', '2024-01-01', '2024-02-23'],
    ['2024-03-01T00:00:00Z', '2024-03-01', '2024-02-29', '2024-02-25', '2024-02-18', '2024-02-24', '2024-03-01', '2024-02-01', '2024-02-29', '2024-01-01', '2024-02-23'],
    ['2022-12-31T15:00:00Z', '2023-01-01', '2022-12-31', '2023-01-01', '2022-12-25', '2022-12-31', '2023-01-01', '2022-12-01', '2022-12-31', '2023-01-01', '2022-12-25'],
    ['2023-12-31T14:59:59.999Z', '2023-12-31', '2023-12-30', '2023-12-31', '2023-12-24', '2023-12-30', '2023-12-01', '2023-11-01', '2023-11-30', '2023-01-01', '2023-12-24'],
    ['2023-02-28T15:00:00Z', '2023-03-01', '2023-02-28', '2023-02-26', '2023-02-19', '2023-02-25', '2023-03-01', '2023-02-01', '2023-02-28', '2023-01-01', '2023-02-22'],
    ['2024-03-10T07:00:00Z', '2024-03-10', '2024-03-09', '2024-03-10', '2024-03-03', '2024-03-09', '2024-03-01', '2024-02-01', '2024-02-29', '2024-01-01', '2024-03-03'],
];

describe('AnalyticsAgent Korean business periods', () => {
    describe.each(cases)('at %s', (instant, today, yesterday, sunday, lastSunday, lastSaturday, monthStart, lastMonthStart, lastMonthEnd, yearStart, sevenDaysAgo) => {
        const periods = [
            ['today', today, today],
            ['yesterday', yesterday, yesterday],
            ['this_week', sunday, today],
            ['last_week', lastSunday, lastSaturday],
            ['this_month', monthStart, today],
            ['last_month', lastMonthStart, lastMonthEnd],
            ['this_year', yearStart, today],
            ['unknown-period', sevenDaysAgo, today],
        ];
        it.each(periods)('%s keeps inclusive Korean calendar endpoints', (period, startDate, endDate) => {
            const now = new Date(instant);
            expect(calculatePeriod(period, now)).toEqual({ startDate, endDate });
            expect(now.toISOString()).toBe(new Date(instant).toISOString());
        });
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.clearAllMocks();
    });

    it('queries the first of the Korean month, not the previous UTC day', async () => {
        jest.useFakeTimers().setSystemTime(new Date('2026-09-28T00:00:00Z'));
        await new AnalyticsAgent().analyze({ userQuery: '이번 달 팀별 공수' });
        expect(manpowerAnalyticsService.getTeamManpower).toHaveBeenCalledWith('2026-09-01', '2026-09-28');
    });
});
