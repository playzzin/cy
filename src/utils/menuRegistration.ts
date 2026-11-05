import type { MenuItem, SiteData, SiteDataType } from '../types/menu';
import { MENU_PATHS } from '../constants/menuPaths';
import { ALLIANCE_SITE_KEY, ALLIANCE_SITE_NAME, INVESTMENT_MENU, LEGACY_INVESTMENT_LABEL } from '../constants/siteModes';

export const MENU_REGISTRATION_VERSION = 1;

export const hasRegisteredMenus = (config: SiteDataType | null): boolean =>
    Object.values(config ?? {}).some(site => (site?.menuRegistrationVersion ?? 0) >= MENU_REGISTRATION_VERSION);

// Upgrade only these sites; never reseed the other editable v1 menus.
const FEATURED_MENU_VERSION = 2;
const ALLIANCE_PLAN_VERSION = 3;
export const needsNationRecruitmentMenu = (config: SiteDataType): boolean =>
    Boolean(config.nation && (config.nation.menuRegistrationVersion ?? 0) < FEATURED_MENU_VERSION);
export const needsAllianceInvestmentMenu = (config: SiteDataType): boolean =>
    Boolean(config[ALLIANCE_SITE_KEY] && (config[ALLIANCE_SITE_KEY].menuRegistrationVersion ?? 0) < ALLIANCE_PLAN_VERSION);

function registerSitePage(site: SiteData, page: { id: string; text: string; path: string; icon: string }, homePaths: string[] = []): void {
    const { id, text, path } = page;
    const contains = (items: (MenuItem | string)[], trash = false): boolean => items.some(item => {
        if (typeof item === 'string') return item === text;
        if (item.id === id || item.path?.split(/[?#]/)[0].replace(/\/+$/, '') === path) return true;
        if (item.text === text) {
            if (trash) return true;
            if (!item.path && !item.action && !item.sub?.length) {
                item.path = path;
                return true;
            }
        }
        return contains(item.sub ?? [], trash);
    });
    if (!contains(site.menu) && !contains(site.trash ?? [], true) && !site.deletedItems?.some(key => [id, path, text].includes(key))) {
        const home = site.menu.findIndex(item => item.path && homePaths.includes(item.path));
        site.menu.splice(home + 1, 0, { ...page });
    }
    site.menuRegistrationVersion = FEATURED_MENU_VERSION;
}

export function registerNationRecruitmentMenu(config: SiteDataType): void {
    if (needsNationRecruitmentMenu(config)) registerSitePage(config.nation, {
        id: 'nation-recruitment', text: '모집공고', icon: 'fa-bullhorn', path: MENU_PATHS['모집공고'],
    }, ['/dashboard3', '/dashboard2']);
}

export function registerAllianceInvestmentMenu(config: SiteDataType): void {
    if (!needsAllianceInvestmentMenu(config)) return;
    const site = config[ALLIANCE_SITE_KEY];
    const previouslyRegistered = (site.menuRegistrationVersion ?? 0) >= FEATURED_MENU_VERSION;
    const rename = (items: (MenuItem | string)[]) => {
        items.forEach((item, i) => {
            if (typeof item === 'string') {
                if (item === LEGACY_INVESTMENT_LABEL) items[i] = { ...INVESTMENT_MENU };
                return;
            }
            if (item.text === LEGACY_INVESTMENT_LABEL &&
                (item.id === INVESTMENT_MENU.id || item.path?.split(/[?#]/)[0].replace(/\/+$/, '') === INVESTMENT_MENU.path ||
                    (!item.path && !item.action && !item.sub?.length))) {
                item.text = INVESTMENT_MENU.text;
                if (!item.path) item.path = INVESTMENT_MENU.path;
            }
            if (item.sub) rename(item.sub);
        });
    };
    rename(site.menu);
    if (site.trash) rename(site.trash);
    if (site.deletedItems) site.deletedItems = site.deletedItems.map(key => key === LEGACY_INVESTMENT_LABEL ? INVESTMENT_MENU.text : key);
    if (site.systemPageLabels?.[INVESTMENT_MENU.path] === LEGACY_INVESTMENT_LABEL) site.systemPageLabels[INVESTMENT_MENU.path] = INVESTMENT_MENU.text;
    if (!previouslyRegistered || site.name === '청연ENG CRM' || site.name === ALLIANCE_SITE_KEY) site.name = ALLIANCE_SITE_NAME;
    if (!previouslyRegistered) registerSitePage(site, INVESTMENT_MENU);
    site.menuRegistrationVersion = ALLIANCE_PLAN_VERSION;
}

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
