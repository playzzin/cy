import { resolveDailyReportTargets } from './dailyReportTargets';

const date = '2026-09-27';
describe('daily report submission targets', () => {
  it('uses the confirmed board even when it explicitly contains no work', () => {
    expect(resolveDailyReportTargets({ date, confirmed: { date, assignments: [] }, dispatch: { date, assignments: [{ siteId: 'a', workerIds: ['w'] }] }, requests: [] })).toEqual({ source: 'confirmed', assignments: [] });
  });
  it('excludes empty, cancelled, and off-duty-only assignments but includes support crews', () => {
    const result = resolveDailyReportTargets({ date, confirmed: null, dispatch: { date, assignments: [
      { siteId: 'empty', workerIds: [] }, { siteId: 'off', workerIds: ['w1'] },
      { siteId: 'cancel', workerIds: ['w2'], status: 'cancelled' },
      { siteId: 'work', workerIds: ['w2'] }, { siteId: 'support', supportTeamIds: ['team'] },
    ] }, requests: [{ date, siteId: '__date_off_duty__', offDutyWorkerIds: ['w1'] }] });
    expect(result.source).toBe('dispatch');
    expect(result.assignments.map((row) => row.siteId)).toEqual(['work', 'support']);
  });
  it('does not infer a work-free day from missing plans, wrong dates, or read errors', () => {
    expect(resolveDailyReportTargets({ date, confirmed: null, dispatch: null, requests: [] }).source).toBe('unknown');
    expect(resolveDailyReportTargets({ date, confirmed: { date: '2026-09-26', assignments: [] }, dispatch: null, requests: [] }).source).toBe('unknown');
    expect(resolveDailyReportTargets({ date, confirmed: null, dispatch: null, requests: [], failed: true }).source).toBe('unavailable');
  });
  it('keeps requests provisional until a plan is saved', () => {
    const result = resolveDailyReportTargets({ date, confirmed: null, dispatch: null, requests: [
      { date, siteId: 'a', requestedHeadcount: 2 }, { date, siteId: 'b', requestedHeadcount: 5, status: 'cancelled' },
    ] });
    expect(result.source).toBe('requests');
    expect(result.assignments.map((row) => row.siteId)).toEqual(['a']);
  });
  it('does not exclude workers whose off-duty request was cancelled', () => {
    const result = resolveDailyReportTargets({ date, confirmed: null,
      dispatch: { date, assignments: [{ siteId: 'a', workerIds: ['w1'] }] },
      requests: [{ date, siteId: '__date_off_duty__', offDutyWorkerIds: ['w1'], status: 'cancelled' }],
    });
    expect(result.assignments.map((row) => row.siteId)).toEqual(['a']);
  });
});
