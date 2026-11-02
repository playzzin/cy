import type { MenuItem, SiteData, SiteDataType } from '../types/menu';

export const MENU_REGISTRATION_VERSION = 1;

export const hasRegisteredMenus = (config: SiteDataType | null): boolean =>
    Object.values(config ?? {}).some(site => (site?.menuRegistrationVersion ?? 0) >= MENU_REGISTRATION_VERSION);

/** Legacy defaults must not re-register trash entries. An explicitly restored live row wins. */
export function legacyDeletedMenuFilter(site: SiteData) {
    if (!site.trash?.length && !site.deletedItems?.length) return undefined;
    const deleted = new Set(site.deletedItems);
    const liveIds = new Set<string>();
    const visit = (items: (MenuItem | string)[], read: (item: MenuItem) => void) => {
        for (const entry of items) {
            const item = typeof entry === 'string' ? { text: entry } : entry;
            read(item);
            if (item.sub) visit(item.sub, read);
        }
    };
    visit(site.trash ?? [], item => {
        for (const key of [item.id, item.path, item.text]) if (key) deleted.add(key);
    });
    visit(site.menu, item => { if (item.id) liveIds.add(item.id); });
    const keep = (item: MenuItem): boolean => {
        if ((!item.id || !liveIds.has(item.id)) && [item.id, item.path, item.text].some(key => key && deleted.has(key))) return false;
        if (item.sub) item.sub = item.sub.filter(child => typeof child === 'string' ? !deleted.has(child) : keep(child));
        return true;
    };
    return keep;
}
