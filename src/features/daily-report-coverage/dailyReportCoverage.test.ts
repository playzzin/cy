import { buildDailyReportCoverage } from './dailyReportCoverage';

describe('buildDailyReportCoverage', () => {
  it('finds active sites without reports for the target date', () => {
    const result = buildDailyReportCoverage({
      date: '2026-06-30',
      sites: [
        { id: 's1', name: 'A현장', status: 'active' },
        { id: 's2', name: 'B현장', status: 'active' },
        { id: 's3', name: '종료현장', status: 'closed' },
      ],
      reports: [
        { id: 'r1', date: '2026-06-30', siteId: 's1', siteName: 'A현장' },
        { id: 'r2', date: '2026-06-29', siteId: 's2', siteName: 'B현장' },
      ],
    });

    expect(result.activeSiteCount).toBe(2);
    expect(result.reportedSiteCount).toBe(1);
    expect(result.missingSiteCount).toBe(1);
    expect(result.coverageRate).toBe(50);
    expect(result.missingSites[0].siteName).toBe('B현장');
  });

  it('matches reports by site name when id is missing', () => {
    const result = buildDailyReportCoverage({
      date: '2026-06-30',
      sites: [{ id: 's1', name: 'A 현장', status: 'active' }],
      reports: [{ id: 'r1', date: '2026-06-30', siteName: 'A현장' }],
    });

    expect(result.missingSiteCount).toBe(0);
    expect(result.coverageRate).toBe(100);
  });
});
