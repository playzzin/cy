import { buildDailyReportCoverage } from './dailyReportCoverage';

const input = () => ({
  date: '2026-06-30', now: new Date('2026-06-30T09:00:00Z'),
  sites: [
    { id: 's1', legacyId: 'old-1', name: 'A 현장', status: 'active' },
    { id: 's2', name: 'B현장', status: '진행중' },
    { id: 's3', name: '종료현장', status: 'closed' },
    { id: 's4', name: '미배치현장', status: 'active' },
  ],
  reports: [{ date: '2026-06-30', siteId: 's1' }],
  plan: { source: 'confirmed' as const, assignments: [{ siteId: 's1' }, { siteId: 's2' }, { siteId: 's3' }] },
});

describe('buildDailyReportCoverage', () => {
  it('only counts active scheduled sites and keeps unrelated active sites out of missing reports', () => {
    const result = buildDailyReportCoverage(input());
    expect(result).toMatchObject({ activeSiteCount: 3, expectedSiteCount: 2, reportedSiteCount: 1, missingSiteCount: 1, coverageRate: 50, status: 'overdue' });
    expect(result.missingSites.map((site) => site.siteId)).toEqual(['s2']);
  });

  it('counts a site once across legacy IDs, names and duplicate reports', () => {
    const result = buildDailyReportCoverage({ ...input(), reports: [
      { date: '2026-06-30', siteId: 'old-1' }, { date: '2026-06-30', siteName: 'A현장' },
      { date: '2026-06-29', siteId: 's2' },
    ] });
    expect(result.reportedSiteCount).toBe(1);
    expect(result.coverageRate).toBe(50);
  });

  it('includes actual reports outside the saved plan', () => {
    const result = buildDailyReportCoverage({ ...input(), reports: [...input().reports, { date: '2026-06-30', siteId: 's4' }] });
    expect(result).toMatchObject({ expectedSiteCount: 3, reportedSiteCount: 2, missingSiteCount: 1, coverageRate: 67 });
  });

  it('switches from collecting to overdue at 18:00 Korea time', () => {
    expect(buildDailyReportCoverage({ ...input(), now: new Date('2026-06-30T08:59:59Z') }).status).toBe('collecting');
    expect(buildDailyReportCoverage(input()).status).toBe('overdue');
  });

  it('distinguishes no scheduled work from an unknown schedule', () => {
    const noWork = buildDailyReportCoverage({ ...input(), reports: [], plan: { source: 'confirmed', assignments: [] } });
    expect(noWork).toMatchObject({ status: 'no-work', expectedSiteCount: 0, coverageRate: null });
    const unknown = buildDailyReportCoverage({ ...input(), reports: [], plan: { source: 'unknown', assignments: [] } });
    expect(unknown).toMatchObject({ status: 'unknown', coverageRate: null, missingSiteCount: 0 });
  });

  it.each(['requests', 'unavailable'] as const)('does not invent a rate from %s data', (source) => {
    const result = buildDailyReportCoverage({ ...input(), plan: { ...input().plan, source } });
    expect(result.coverageRate).toBeNull();
    expect(result.status).toBe(source === 'unavailable' ? 'unavailable' : 'unknown');
  });

  it('holds evaluation when a scheduled site cannot be identified unambiguously', () => {
    const result = buildDailyReportCoverage({ ...input(),
      sites: [...input().sites, { id: 'duplicate', name: 'A 현장', status: 'active' }],
      plan: { source: 'confirmed', assignments: [{ siteName: 'A현장' }] },
    });
    expect(result).toMatchObject({ status: 'unknown', unmatchedSiteCount: 1, coverageRate: null });
  });

  it('marks all submitted work complete and supports disabling the deadline', () => {
    const data = { ...input(), reports: [{ date: '2026-06-30', siteId: 's1' }, { date: '2026-06-30', siteId: 's2' }] };
    expect(buildDailyReportCoverage(data)).toMatchObject({ status: 'complete', coverageRate: 100 });
    expect(buildDailyReportCoverage({ ...data, deadlineMinutes: null })).toMatchObject({ status: 'monitoring', deadlineLabel: null });
  });
});
