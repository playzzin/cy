import { activityMillis, activityRange, normalizeActivity } from './activityModel';
import { ACTIVITY_SOURCES, activitySourceForPath, availableActivitySources } from './activitySources';
import { consolidateActivityMenus } from './activityMenu';
import type { MenuItem } from '../../types/menu';
import { previewMenuAllowsPath } from '../../components/developer/DevPreviewRouteGuard';

it('queries inclusive Korean calendar days with an exclusive next-day bound', () => {
  expect(activityRange('2026-10-22', '2026-10-22')).toEqual({ start: Date.parse('2026-10-21T15:00:00Z'), end: Date.parse('2026-10-22T15:00:00Z') });
  for (const days of [['2026-02-30', '2026-03-01'], ['', '2026-10-22'], ['2026-10-23', '2026-10-22'], ['2024-01-01', '2026-01-01'], ['2026-99-99', '2026-99-99']]) {
    expect(() => activityRange(days[0], days[1])).toThrow();
  }
});

it('does not invent a current timestamp and retains worker and permission changes', () => {
  expect(activityMillis('invalid')).toBe(0);
  expect(activityMillis({ seconds: 10, nanoseconds: 500000000 })).toBe(10500);
  const source = ACTIVITY_SOURCES.find(item => item.id === 'permissions')!;
  const record = normalizeActivity('log-1', {
    actorId: 'actor-a', timestamp: '2026-10-22T00:00:00Z', action: 'MENU_ACCESS_UPDATED',
    details: JSON.stringify({ changes: [{ menuText: '일보', beforeRoles: ['사무'], afterRoles: ['사무', '감사'] }] }),
    fieldChanges: [{ field: 'idNumber', label: '식별번호', before: 'not-for-display', after: 'not-for-display' }],
    workerChanges: { updated: [{ name: '테스트 작업자', changes: [{ label: '공수', before: 1, after: 0.5 }] }] },
  }, source);
  expect(record.action).toBe('메뉴 권한 변경');
  expect(record.changes).toEqual(expect.arrayContaining([{ label: '테스트 작업자 · 공수', before: '1', after: '0.5' }]));
  expect(record.changes[1].after).toContain('감사');
  expect(JSON.stringify(record)).not.toContain('not-for-display');
});

it('preserves access boundaries and legacy routes without granting login access to auditors', () => {
  expect(availableActivitySources({ role: 'audit', status: 'active' }).map(item => item.id)).toContain('system');
  expect(availableActivitySources({ role: 'audit' }).map(item => item.id)).not.toContain('login');
  expect(availableActivitySources({ role: 'user' })).toEqual([]);
  expect(availableActivitySources({ role: 'admin', status: 'suspended' })).toEqual([]);
  expect(availableActivitySources({ role: 'office' }).map(item => item.id)).toContain('daily');
  expect(activitySourceForPath('/admin/pdf-transfer-logs')?.id).toBe('files');
  expect(activitySourceForPath('/activity?source=materials')?.id).toBe('materials');
});

it('consolidates only visible log links, preserves other menus and never mutates stored menus', () => {
  const menu: MenuItem[] = [
    { text: '일보', sub: ['일보 작성', { text: '일보 기록', path: '/reports/daily-logs' }] },
    { text: '로그관리', sub: [{ text: '접속', path: '/admin/login-logs' }, { text: '파일', path: '/admin/pdf-transfer-logs' }] },
    { text: '로그 설정', path: '/messages/settings' },
  ];
  const before = JSON.stringify(menu);
  const result = consolidateActivityMenus(menu, {});
  expect(result.map(item => item.text)).toEqual(['일보', '로그 설정', '활동 내역']);
  expect(result[0].sub).toEqual(['일보 작성']);
  expect(JSON.stringify(menu)).toBe(before);
  expect(consolidateActivityMenus(result, {})).toEqual(result);
  expect(consolidateActivityMenus([{ text: '홈', path: '/dashboard' }], {})).toEqual([{ text: '홈', path: '/dashboard' }]);
});

it('retains preview access to a consolidated source without unlocking other log sources', () => {
  const menu = [{ text: '일보 기록', path: '/reports/daily-logs' }];
  expect(previewMenuAllowsPath(menu, '/activity?source=daily')).toBe(true);
  expect(previewMenuAllowsPath(menu, '/activity?source=login')).toBe(false);
});
