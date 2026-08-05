import { MENU_PATHS } from '../constants/menuPaths';
import type { MenuItem, SiteDataType } from '../types/menu';
import {
    canAccessAllowedRoles,
    isAdminAccessRole,
    normalizeAccessRole,
    uniqueAccessRoles,
} from './accessRoles';
import { isOperationManagementMenuPath, isOperationManagementMenuText } from './operationMenuAccess';

interface FindMenuRouteOptions {
    siteKey?: string;
    includeHidden?: boolean;
}

interface CanAccessMenuRouteOptions extends FindMenuRouteOptions {}

const normalizeRoutePath = (path: unknown): string => {
    const raw = String(path ?? '').trim();
    if (!raw) return '';

    const [withoutHash] = raw.split('#');
    const [pathname] = withoutHash.split('?');
    if (pathname.length > 1 && pathname.endsWith('/')) {
        return pathname.slice(0, -1);
    }

    return pathname;
};

const getRouteParts = (path: unknown): { pathname: string; search: string } => {
    const raw = String(path ?? '').trim();
    if (!raw) return { pathname: '', search: '' };

    const [withoutHash] = raw.split('#');
    const [rawPathname, rawSearch = ''] = withoutHash.split('?');
    return {
        pathname: normalizeRoutePath(rawPathname),
        search: rawSearch,
    };
};

const menuItemRouteMatchesRequest = (itemRoute: unknown, requestedRoute: unknown): boolean => {
    const item = getRouteParts(itemRoute);
    const requested = getRouteParts(requestedRoute);
    if (!item.pathname || item.pathname !== requested.pathname) return false;
    if (!item.search || !requested.search) return true;

    const itemParams = new URLSearchParams(item.search);
    const requestedParams = new URLSearchParams(requested.search);
    let matches = true;
    itemParams.forEach((value, key) => {
        if (requestedParams.get(key) !== value) matches = false;
    });
    return matches;
};

const isMenuItem = (entry: string | MenuItem): entry is MenuItem => (
    typeof entry === 'object' && entry !== null && typeof entry.text === 'string'
);

const resolveMenuEntryPath = (entry: string | MenuItem): string => {
    if (typeof entry === 'string') {
        return MENU_PATHS[entry] || '';
    }

    return entry.path || MENU_PATHS[entry.text] || '';
};

const toMenuItem = (entry: string | MenuItem): MenuItem => (
    typeof entry === 'string'
        ? { text: entry, path: MENU_PATHS[entry] }
        : entry
);

const collectMenuItemsByRoute = (
    entries: Array<string | MenuItem>,
    targetRoute: string,
    options: Required<FindMenuRouteOptions>,
    matches: MenuItem[] = []
): MenuItem[] => {
    entries.forEach((entry) => {
        const item = toMenuItem(entry);
        const route = normalizeRoutePath(resolveMenuEntryPath(entry));

        if (route === targetRoute && (options.includeHidden || !item.hide)) {
            matches.push(item);
        }

        if (isMenuItem(entry) && Array.isArray(entry.sub)) {
            collectMenuItemsByRoute(entry.sub, targetRoute, options, matches);
        }
    });

    return matches;
};

const compactRoleKey = (role: unknown): string =>
    normalizeAccessRole(role).toLowerCase().replace(/[\s_-]/g, '');

const isManagerRoleKey = (key: string, raw: string): boolean => (
    key === 'manager'
    || /^manager[123]$/.test(key)
    || /^posmanager[123]$/.test(key)
    || raw === '대표'
    || raw.startsWith('매니저')
    || raw.startsWith('메니저')
);

const isPrimaryManagerRoleKey = (key: string, raw: string): boolean => (
    key === 'manager1'
    || key === 'posmanager1'
    || key === '매니저1'
    || key === '메니저1'
    || raw === '매니저1'
    || raw === '메니저1'
);

export const buildMenuAccessRoles = (...roleSources: unknown[]): string[] => (
    uniqueAccessRoles([
        ...uniqueAccessRoles([...roleSources, 'user']).flatMap((role) => {
            const raw = normalizeAccessRole(role);
            const key = raw.toLowerCase();
            const compactKey = compactRoleKey(raw);
            const aliases = [raw];

            if (isAdminAccessRole(raw)) {
                aliases.push('admin', '관리자', '사장', '실장');
            }

            if (isManagerRoleKey(compactKey, raw)) {
                aliases.push(
                    'manager',
                    'manager1',
                    'manager2',
                    'manager3',
                    'pos_manager1',
                    'pos_manager2',
                    'pos_manager3',
                    '매니저',
                    '메니저',
                    '매니저1',
                    '매니저2',
                    '매니저3',
                    '메니저1',
                    '메니저2',
                    '메니저3'
                );
            }

            if (isPrimaryManagerRoleKey(compactKey, raw)) {
                aliases.push(
                    'support',
                    'support_manager',
                    '지원담당',
                    '지원 담당',
                    '자산관리',
                    '자산 관리',
                    '숙소관리',
                    '숙소 관리'
                );
            }

            if (key === 'user' || key === 'general' || raw === '일반') {
                aliases.push('user', 'general', '일반');
            }

            if (key === 'newbie' || raw === '신규' || raw === '신규자') {
                aliases.push('newbie', '신규', '신규자');
            }

            if (raw === '발주사' || raw === '건설사' || raw === '원청' || key === 'client' || key === 'client_company' || key === 'construction_company') {
                aliases.push('발주사', '건설사', '원청', 'client', 'client_company', 'construction_company');
            }

            if (raw === '임대사' || key === 'rental' || key === 'rental_company') {
                aliases.push('임대사', 'rental', 'rental_company');
            }

            if (raw === '소개소' || raw === '소개자' || key === 'referral' || key === 'recruiting' || key === 'agency') {
                aliases.push('소개소', '소개자', 'referral', 'recruiting', 'agency');
            }

            return aliases;
        }),
    ])
);

export const canAccessMenuRoles = (actualRoles: unknown[], allowedRoles?: string[]): boolean => {
    return canAccessAllowedRoles(buildMenuAccessRoles(actualRoles), allowedRoles);
};

export const findMenuItemsByRoute = (
    menuData: SiteDataType | null | undefined,
    route: string,
    options: FindMenuRouteOptions = {}
): MenuItem[] => {
    if (!menuData) return [];

    const normalizedRoute = normalizeRoutePath(route);
    if (!normalizedRoute) return [];

    const normalizedOptions: Required<FindMenuRouteOptions> = {
        siteKey: options.siteKey || '',
        includeHidden: options.includeHidden ?? false,
    };

    return Object.entries(menuData)
        .filter(([siteKey]) => !normalizedOptions.siteKey || siteKey === normalizedOptions.siteKey)
        .flatMap(([, site]) => collectMenuItemsByRoute(site.menu || [], normalizedRoute, normalizedOptions));
};

export const canAccessMenuRoute = (
    menuData: SiteDataType | null | undefined,
    route: string,
    userRoles: unknown[],
    options: CanAccessMenuRouteOptions = {}
): boolean => {
    const accessRoles = buildMenuAccessRoles(userRoles);
    if (accessRoles.some(isAdminAccessRole)) return true;

    const items = findMenuItemsByRoute(menuData, route, options);
    if (items.length === 0) return false;

    return items.some((item) => {
        const itemRoute = item.path || item.action || '';
        if (!menuItemRouteMatchesRequest(itemRoute, route)) return false;

        if (isOperationManagementMenuPath(itemRoute) || isOperationManagementMenuText(item.text)) {
            return true;
        }

        const allowedRoles = Array.isArray(item.roles)
            ? item.roles.map(normalizeAccessRole).filter(Boolean)
            : [];

        return canAccessMenuRoles(accessRoles, allowedRoles);
    });
};
