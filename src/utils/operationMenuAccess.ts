const normalizePathParts = (path: unknown): { pathname: string; search: string } => {
    const raw = String(path ?? '').trim();
    if (!raw) return { pathname: '', search: '' };

    try {
        const url = new URL(raw, 'http://local.invalid');
        const pathname = url.pathname.length > 1 && url.pathname.endsWith('/')
            ? url.pathname.slice(0, -1)
            : url.pathname;
        return { pathname, search: url.search };
    } catch {
        const [withoutHash] = raw.split('#');
        const [rawPathname, rawSearch = ''] = withoutHash.split('?');
        const pathname = rawPathname.length > 1 && rawPathname.endsWith('/')
            ? rawPathname.slice(0, -1)
            : rawPathname;
        return { pathname, search: rawSearch ? `?${rawSearch}` : '' };
    }
};

const normalizeMenuTextKey = (value: unknown): string =>
    String(value ?? '').replace(/\s+/g, '').trim();

const OPERATION_MENU_TEXT_KEYS = new Set([
    '\uc6b4\uc601\uad00\ub9ac',
    '\uc0ac\ubb34\uc2e4\uad00\ub9ac',
    '\uc0ac\ubb34\uc2e4\uba54\ub274',
]);

export const isOperationManagementMenuText = (text: unknown): boolean => {
    return OPERATION_MENU_TEXT_KEYS.has(normalizeMenuTextKey(text));
};

export const isOperationManagementMenuPath = (path: unknown): boolean => {
    const { pathname, search } = normalizePathParts(path);
    if (!pathname) return false;

    if (pathname === '/office' || pathname.startsWith('/office/')) return true;
    if (pathname === '/payroll/office-staff-payroll') return true;

    if (pathname === '/database/manpower-db') {
        const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
        return params.get('tab') === 'offices';
    }

    return false;
};
