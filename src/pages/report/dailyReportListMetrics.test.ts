import { buildDailyReportListSummary } from './dailyReportListMetrics';

describe('buildDailyReportListSummary', () => {
    it('필터된 행을 기준으로 중복 없는 요약을 계산한다', () => {
        const summary = buildDailyReportListSummary([
            { date: '2026-08-01', siteId: 'site-a', workerId: 'worker-a', manDay: 1, amount: 200000 },
            { date: '2026-08-01', siteId: 'site-a', workerId: 'worker-a', manDay: 0.5, amount: 100000 },
            { date: '2026-08-02', siteId: 'site-b', workerId: 'worker-b', manDay: 1, amount: 220000 },
        ]);

        expect(summary).toEqual({
            rowCount: 3,
            workerCount: 2,
            siteCount: 2,
            dateCount: 2,
            totalManDay: 2.5,
            totalAmount: 520000,
        });
    });

    it('작업자가 없는 일보와 잘못된 숫자를 요약에서 안전하게 처리한다', () => {
        const summary = buildDailyReportListSummary([
            { date: '2026-08-03', siteName: '현장 A', isEmptyReport: true, manDay: Number.NaN, amount: Number.POSITIVE_INFINITY },
            { date: '2026-08-03', siteName: ' 현장 A ', workerName: '홍 길동', workerTeamName: 'A팀', manDay: 1, amount: 180000 },
            { date: '2026-08-03', siteName: '현장 A', workerName: '홍길동', workerTeamName: 'A팀', manDay: 1, amount: 180000 },
        ]);

        expect(summary.workerCount).toBe(1);
        expect(summary.siteCount).toBe(1);
        expect(summary.totalManDay).toBe(2);
        expect(summary.totalAmount).toBe(360000);
    });
});
