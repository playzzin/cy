import { getMonthDateRange, validateDailyReportDateRange } from './dailyReportListDates';

test.each([
    ['2026-03-29', '2026-02-01', '2026-02-28'],
    ['2026-03-31', '2026-02-01', '2026-02-28'],
    ['2024-03-31', '2024-02-01', '2024-02-29'],
    ['2026-05-31', '2026-04-01', '2026-04-30'],
    ['2026-01-31', '2025-12-01', '2025-12-31'],
])('전달 계산은 월말에도 정확하다: %s', (today, start, end) => {
    expect(getMonthDateRange(-1, new Date(`${today}T12:00:00`))).toEqual({ start, end });
});

test('잘못된 날짜와 역전된 기간을 거절하고 월간 조회는 한 달 전체를 사용한다', () => {
    expect(validateDailyReportDateRange('2026-02-30', '2026-03-01', 'range').error).toBeTruthy();
    expect(validateDailyReportDateRange('', '2026-03-01', 'range').error).toBeTruthy();
    expect(validateDailyReportDateRange('2026-03-02', '2026-03-01', 'range').error).toBeTruthy();
    expect(validateDailyReportDateRange('2026-09-29', '2026-09-29', 'month')).toEqual({ start: '2026-09-01', end: '2026-09-30', error: null });
});
