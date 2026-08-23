import { MenuItem } from '../../../types/menu';

export interface SafeMenuMergeResult {
    menu: MenuItem[];
    addedCount: number;
    skippedCount: number;
    addedIds: string[];
}

const normalizeText = (value: unknown): string =>
    String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();

const normalizePath = (value: unknown): string => {
    const normalized = normalizeText(value).replace(/\/+$/, '');
    return normalized || '/';
};

const getGlobalIdentity = (item: MenuItem): string => {
    if (item.path) return `path:${normalizePath(item.path)}`;
    if (item.action) return `action:${normalizeText(item.action)}`;
    return '';
};

const getSiblingIdentity = (item: MenuItem): string => {
    const globalIdentity = getGlobalIdentity(item);
    if (globalIdentity) return globalIdentity;
    const type = Array.isArray(item.sub) ? 'folder' : 'item';
    return `${type}:${normalizeText(item.text)}`;
};

const collectIds = (items: (MenuItem | string)[], result = new Set<string>()): Set<string> => {
    items.forEach((item) => {
        if (typeof item === 'string') return;
        if (item.id) result.add(item.id);
        if (Array.isArray(item.sub)) collectIds(item.sub, result);
    });
    return result;
};

const findByGlobalIdentity = (items: (MenuItem | string)[], identity: string): MenuItem | null => {
    if (!identity) return null;
    for (const item of items) {
        if (typeof item === 'string') continue;
        if (getGlobalIdentity(item) === identity) return item;
        const nested = Array.isArray(item.sub) ? findByGlobalIdentity(item.sub, identity) : null;
        if (nested) return nested;
    }
    return null;
};

const createIdFactory = (items: (MenuItem | string)[], token: string) => {
    const existingIds = collectIds(items);
    let sequence = 0;

    return (item: MenuItem): string => {
        const base = String(item.id || item.path || item.text || 'menu')
            .trim()
            .replace(/[^a-zA-Z0-9_-]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 42) || 'menu';

        let candidate = `${base}_bulk_${token}_${sequence++}`;
        while (existingIds.has(candidate)) {
            candidate = `${base}_bulk_${token}_${sequence++}`;
        }
        existingIds.add(candidate);
        return candidate;
    };
};

/**
 * Adds menu items without replacing existing target content.
 * Route/action duplicates are detected across the whole target tree, while
 * label-only folders are merged only with siblings at the same depth.
 */
export const addMenuItemsSafely = (
    targetItems: (MenuItem | string)[],
    sourceItems: MenuItem[],
    token = Date.now().toString(36)
): SafeMenuMergeResult => {
    const target = JSON.parse(JSON.stringify(targetItems || [])) as (MenuItem | string)[];
    const addedIds: string[] = [];
    let addedCount = 0;
    let skippedCount = 0;
    const createId = createIdFactory(target, token);

    const mergeItem = (source: MenuItem, targetList: (MenuItem | string)[]): boolean => {
        if (!source || source.text === '-') return false;

        const globalIdentity = getGlobalIdentity(source);
        const siblingIdentity = getSiblingIdentity(source);
        const sourceChildren = Array.isArray(source.sub)
            ? source.sub.filter((child): child is MenuItem => typeof child !== 'string')
            : [];

        const globalMatch = globalIdentity ? findByGlobalIdentity(target, globalIdentity) : null;
        const siblingMatch = targetList.find((item): item is MenuItem => (
            typeof item !== 'string' && getSiblingIdentity(item) === siblingIdentity
        ));
        const existing = globalMatch || siblingMatch || null;

        if (existing) {
            skippedCount += 1;
            if (sourceChildren.length > 0) {
                if (!Array.isArray(existing.sub)) existing.sub = [];
                sourceChildren.forEach((child) => mergeItem(child, existing.sub!));
            }
            return false;
        }

        const cloned: MenuItem = {
            ...JSON.parse(JSON.stringify(source)),
            id: createId(source)
        };
        if (sourceChildren.length > 0) cloned.sub = [];

        // Add the container first so global duplicate checks also see items
        // inserted while its children are merged.
        targetList.push(cloned);
        addedCount += 1;
        addedIds.push(cloned.id!);

        if (sourceChildren.length > 0) {
            sourceChildren.forEach((child) => mergeItem(child, cloned.sub!));
        }
        return true;
    };

    sourceItems.forEach((item) => mergeItem(item, target));

    return {
        menu: target.filter((item): item is MenuItem => typeof item !== 'string'),
        addedCount,
        skippedCount,
        addedIds
    };
};

export const countMenuItems = (items: (MenuItem | string)[]): number =>
    items.reduce((count, item) => {
        if (typeof item === 'string' || item.text === '-') return count;
        return count + 1 + (Array.isArray(item.sub) ? countMenuItems(item.sub) : 0);
    }, 0);
