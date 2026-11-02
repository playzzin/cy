import type { MenuItem, SiteData } from '../../types/menu';
import { activitySourceForPath } from './activitySources';

/** Convert the former sidebar shortcut to a regular, editable menu once. */
export function registerActivityMenu(site: SiteData): void {
  const activityId = 'activity-center';
  const label = '활동 내역';
  if (site.deletedItems?.some(value => [label, activityId, '/activity'].includes(value))) return;
  let alreadyRegistered = false;
  const sources = new Set<string>();
  let unrestricted = false;
  const roles = new Set<string>();
  const visit = (entries: (MenuItem | string)[], visible: boolean) => {
    for (const item of entries) {
      if (typeof item === 'string') continue;
      const path = item.path || '';
      const shown = visible && !item.hide;
      if (item.id === activityId || path.split(/[?#]/)[0] === '/activity') alreadyRegistered = true;
      else if (shown && path.startsWith('/') && !path.startsWith('//')) {
        const source = activitySourceForPath(path)?.id || (path === '/office/audit-log' ? 'daily' : undefined);
        if (source) {
          sources.add(source);
          if (item.roles?.length) item.roles.forEach(role => roles.add(role));
          else unrestricted = true;
        }
      }
      if (item.sub) visit(item.sub, shown);
    }
  };
  visit(site.menu, true);
  visit(site.trash ?? [], false);
  if (sources.size && !alreadyRegistered) site.menu.push({
    id: activityId, text: label, icon: 'fa-clock-rotate-left',
    path: sources.size === 1 ? `/activity?source=${[...sources][0]}` : '/activity',
    ...(!unrestricted && roles.size ? { roles: [...roles] } : {})
  });
}
