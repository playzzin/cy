import { buildMobileFieldActions } from './mobileFieldActions';

describe('mobileFieldActions', () => {
  it('keeps the field execution order while using configured paths', () => {
    const actions = buildMobileFieldActions([
      { label: '업무 요청', path: '/todo?filter=mine' },
      { label: '일보 작성', path: '/reports/daily?tab=input&siteId=abc' },
      { label: '현장 현황', path: '/dashboard/site-status' },
      { label: '오늘 현황', path: '/reports/daily?tab=list-v2&date=2026-06-30' },
    ]);

    expect(actions.map((action) => action.id)).toEqual([
      'daily-input',
      'today-status',
      'site-status',
      'task-sla',
    ]);
    expect(actions.map((action) => action.path)).toEqual([
      '/reports/daily?tab=input&siteId=abc',
      '/reports/daily?tab=list-v2&date=2026-06-30',
      '/dashboard/site-status',
      '/todo?filter=mine',
    ]);
  });

  it('fills missing mobile actions with safe defaults', () => {
    const actions = buildMobileFieldActions([{ label: '급여 조회', path: '/payroll/payslip' }]);

    expect(actions.map((action) => action.path)).toEqual([
      '/reports/daily?tab=input',
      '/reports/daily?tab=list-v2',
      '/dashboard/site-status',
      '/todo',
    ]);
  });
});
