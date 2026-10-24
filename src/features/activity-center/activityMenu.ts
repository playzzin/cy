import type { MenuItem } from '../../types/menu';
import { activitySourceForPath } from './activitySources';

/** Presentation only, after role/hidden filtering. Never rewrites saved menus. */
export function consolidateActivityMenus(items: MenuItem[], paths: Record<string, string>): MenuItem[] {
  let firstSource: string | undefined;
  let alreadyPresent = false;
  const visit = (entries: (MenuItem | string)[]): (MenuItem | string)[] => entries.flatMap(entry => {
    const item = typeof entry === 'string' ? { text: entry } : entry;
    if (item.hide) return [entry];
    const path = item.path || paths[item.text] || '';
    const source = path.startsWith('/') ? activitySourceForPath(path) : undefined;
    if (source || ['/activity', '/office/audit-log'].includes(path.split('?')[0])) {
      firstSource ||= source?.id || 'daily';
      // A configured single menu keeps its custom label, placement and roles.
      if (path.split('?')[0] === '/activity' && !alreadyPresent) { alreadyPresent = true; return [entry]; }
      return item.sub?.length ? visit(item.sub) : [];
    }
    if (!item.sub?.length) return [entry];
    const sub = visit(item.sub);
    if (!sub.length && !path && !item.action) return [];
    return [{ ...item, sub }];
  });
  const result = visit(items).map(entry => typeof entry === 'string' ? { text: entry } : entry);
  if (firstSource && !alreadyPresent) result.push({ id: 'activity-center', text: '활동 내역', icon: 'fa-clock-rotate-left', path: `/activity?source=${firstSource}` });
  return result;
}
