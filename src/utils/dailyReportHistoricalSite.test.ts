import type { DailyReport } from '../services/dailyReportService';
import type { Site } from '../services/siteService';
import {
  getHistoricalAttendedSiteOptions,
  resolveHistoricalResponsibleTeam,
} from './dailyReportHistoricalSite';

const site = (overrides: Partial<Site> = {}): Site => ({
  id: 'site-1',
  name: '서울 고이건설 현장',
  code: 'SEOUL-1',
  status: 'active',
  responsibleTeamId: 'lee-team',
  responsibleTeamName: '이재욱팀',
  ...overrides,
});

const report = (overrides: Partial<DailyReport> = {}): DailyReport => ({
  id: 'report-1',
  date: '2026-07-15',
  teamId: 'kim-team',
  teamName: '김진민팀',
  siteId: 'site-1',
  siteName: '서울 고이건설 현장',
  responsibleTeamId: 'kim-team',
  responsibleTeamName: '김진민팀',
  workers: [{
    workerId: 'worker-1',
    name: '작업자',
    status: 'attendance',
    manDay: 1,
  }],
  totalManDay: 1,
  ...overrides,
});

describe('daily report historical site snapshots', () => {
  it('keeps the July responsible team even when the current site moved to another team', () => {
    const options = getHistoricalAttendedSiteOptions(
      [site()],
      [report(), report({ id: 'august', date: '2026-08-01', responsibleTeamId: 'lee-team', responsibleTeamName: '이재욱팀' })],
      '2026-07-31'
    );

    expect(options).toHaveLength(1);
    expect(options[0]).toMatchObject({
      id: 'site-1',
      name: '서울 고이건설 현장',
      responsibleTeamId: 'kim-team',
      responsibleTeamName: '김진민팀',
    });
  });

  it('includes a historical report site that no longer exists in the current site master', () => {
    const options = getHistoricalAttendedSiteOptions([], [report()], '2026-07-31');

    expect(options).toHaveLength(1);
    expect(options[0]).toMatchObject({
      id: 'site-1',
      name: '서울 고이건설 현장',
      responsibleTeamName: '김진민팀',
    });
  });

  it('uses the report team as the historical fallback for legacy reports without a responsible-team snapshot', () => {
    expect(resolveHistoricalResponsibleTeam(
      report({ responsibleTeamId: undefined, responsibleTeamName: undefined }),
      site()
    )).toEqual({ teamId: 'kim-team', teamName: '김진민팀' });
  });
});
