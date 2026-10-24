import type { MenuItem, SiteDataType } from '../types/menu';
import { MENU_PATHS } from '../constants/menuPaths';

export const ADVANCE_SUMMARY_PATH = '/payroll/advance-summary';
export const ADVANCE_SUMMARY_TEXT = '팀별 가불내역';
const compact = (text: string) => text.replace(/\s+/g, '');
const pathOf = (item: MenuItem | string) => (typeof item === 'string' ? MENU_PATHS[item] : item.path || MENU_PATHS[item.text])?.split(/[?#]/)[0];
const contains = (items: (MenuItem | string)[]): boolean => items.some(item => pathOf(item) === ADVANCE_SUMMARY_PATH
    || (typeof item !== 'string' && Boolean(item.sub && contains(item.sub))));

/** Add a sibling/child to existing advance menus in memory, preserving their visibility and role scope. */
export function ensureAdvanceSummaryMenu(config: SiteDataType): void {
    Object.entries(config).forEach(([siteId, site]) => {
        if (contains(site.menu) || contains(site.trash || [])
            || site.deletedItems?.some(item => item === ADVANCE_SUMMARY_PATH || item === ADVANCE_SUMMARY_TEXT)) return;
        const makeItem = (scope: MenuItem): MenuItem => ({
            id: `${siteId}-advance-summary`, text: ADVANCE_SUMMARY_TEXT, path: ADVANCE_SUMMARY_PATH, icon: 'fa-table',
            ...(scope.roles ? { roles: [...scope.roles] } : {}),
            ...(scope.hide !== undefined ? { hide: scope.hide } : {}),
        });
        const insert = (items: (MenuItem | string)[], parent?: MenuItem): boolean => {
            // Prefer the named advance group when an older configuration has several entry links.
            for (const item of items) {
                if (typeof item === 'string' || !item.sub) continue;
                if (['가불관리', '가불및공제', '가불및공제내역', '가불및공제관리'].includes(compact(item.text))) {
                    const entry = item.sub.find(child => pathOf(child) === '/payroll/advance-payment');
                    if (entry) {
                        item.sub.push(makeItem(typeof entry === 'object' ? entry : item));
                        return true;
                    }
                }
                if (insert(item.sub, item)) return true;
            }
            const index = items.findIndex(item => pathOf(item) === '/payroll/advance-payment');
            if (index < 0) return false;
            const entry = items[index];
            items.splice(index + 1, 0, makeItem(typeof entry === 'object' ? entry : parent || { text: '' }));
            return true;
        };
        insert(site.menu);
    });
}
