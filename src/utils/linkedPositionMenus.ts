import type { MenuItem, SiteDataType } from '../types/menu';
import { createMenuDivider } from './menuDivider';

const PREFIX = '__linked_position__/';
export const LINKED_POSITION_DIVIDER_ID = `${PREFIX}divider`;
const normalize = (value: string) => value.trim().toLowerCase().replace(/^pos_/, '');
const isDevName = (value: string) => ['dev', 'developer', '개발', '개발자'].includes(normalize(value));
export const positionSiteKey = (id: string) => id.startsWith('pos_') ? id : `pos_${id}`;

export const isDevPositionSite = (data: SiteDataType | null, siteKey: string): boolean => {
    if (!siteKey.startsWith('pos_') || !data?.[siteKey]) return false;
    const position = data.admin?.positionConfig?.find(p => positionSiteKey(p.id) === siteKey);
    return [siteKey, data[siteKey].name, position?.name || ''].some(isDevName);
};

export const getLinkedPositions = (data: SiteDataType | null, siteKey: string) => {
    if (!isDevPositionSite(data, siteKey) || data?.[siteKey].linkedPositionMenusEnabled === false) return [];
    const seen = new Set<string>([siteKey]);
    return [...(data?.admin?.positionConfig || [])]
        .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
        .filter(position => {
            const key = positionSiteKey(position.id);
            if (position.id === 'full' || seen.has(key) || !data?.[key] || isDevPositionSite(data, key)) return false;
            seen.add(key);
            return true;
        });
};

export const linkedMenuId = (siteKey: string, id?: string) =>
    `${PREFIX}${encodeURIComponent(siteKey)}/${id === undefined ? 'root' : `item/${encodeURIComponent(id)}`}`;

export const getLinkedMenuRef = (id: string | undefined): { siteKey: string; itemId?: string } | null => {
    if (!id?.startsWith(PREFIX) || id === LINKED_POSITION_DIVIDER_ID) return null;
    const parts = id.slice(PREFIX.length).split('/');
    const [site, kind, item] = parts;
    if (!site || (kind === 'root' ? parts.length !== 2 : kind !== 'item' || parts.length !== 3 || !item)) return null;
    try {
        return { siteKey: decodeURIComponent(site), ...(kind === 'item' ? { itemId: decodeURIComponent(item) } : {}) };
    } catch { return null; }
};

export const isLinkedMenuContainer = (id: string | undefined) =>
    id === LINKED_POSITION_DIVIDER_ID || Boolean(getLinkedMenuRef(id) && getLinkedMenuRef(id)?.itemId === undefined);

// These nodes exist only in the view. Source menus are never copied into DEV storage.
export const projectLinkedItems = (items: (MenuItem | string)[], siteKey: string, parent = ''): MenuItem[] =>
    items.map((entry, index) => {
        const item = typeof entry === 'string' ? { text: entry } : entry;
        const id = item.id || `${parent}/${index}/${item.text}`;
        return { ...item, id: linkedMenuId(siteKey, id), ...(item.sub ? { sub: projectLinkedItems(item.sub, siteKey, id) } : {}) };
    });

export const getPositionMenuView = (data: SiteDataType | null, siteKey: string): MenuItem[] => {
    const own = data?.[siteKey]?.menu || [];
    const positions = getLinkedPositions(data, siteKey);
    if (!positions.length || !data) return own;
    return [...own, { ...createMenuDivider(LINKED_POSITION_DIVIDER_ID), ...data[siteKey].linkedPositionDivider }, ...positions.map(position => {
        const source = positionSiteKey(position.id);
        return { id: linkedMenuId(source), text: position.name, icon: position.icon, sub: projectLinkedItems(data[source].menu, source) };
    })];
};

const restoreItems = (items: (MenuItem | string)[], siteKey: string): MenuItem[] => items.map(entry => {
    const item = typeof entry === 'string' ? { text: entry } : entry;
    const ref = getLinkedMenuRef(item.id);
    if (item.id?.startsWith(PREFIX) && !ref) throw new Error('잘못된 직책 메뉴 연결입니다. 최신 메뉴를 불러와주세요.');
    if (ref && (ref.siteKey !== siteKey || ref.itemId === undefined)) throw new Error('다른 직책으로 메뉴를 이동할 수 없습니다.');
    return { ...item, ...(ref ? { id: ref.itemId } : {}), ...(item.sub ? { sub: restoreItems(item.sub, siteKey) } : {}) };
});

const assertOwnItems = (items: (MenuItem | string)[]): void => {
    items.forEach(item => {
        if (typeof item === 'string') return;
        if (item.id?.startsWith(PREFIX)) throw new Error('연결된 메뉴는 해당 직책 안에서만 이동할 수 있습니다.');
        if (item.sub) assertOwnItems(item.sub);
    });
};

export const setPositionMenuView = (data: SiteDataType, siteKey: string, items: MenuItem[]): void => {
    const sources = getLinkedPositions(data, siteKey);
    if (!sources.length) {
        assertOwnItems(items);
        data[siteKey] = { ...data[siteKey], menu: items };
        return;
    }
    const expected = new Set(sources.map(position => linkedMenuId(positionSiteKey(position.id))));
    const own = items.filter(item => !expected.has(item.id || '') && item.id !== LINKED_POSITION_DIVIDER_ID);
    assertOwnItems(own);
    const replacements: SiteDataType = { [siteKey]: { ...data[siteKey], menu: own } };
    const dividers = items.filter(item => item.id === LINKED_POSITION_DIVIDER_ID);
    if (dividers.length !== 1) throw new Error('연결 구분선은 설정에서 표시 여부를 변경해주세요.');
    const previous = { ...createMenuDivider(LINKED_POSITION_DIVIDER_ID), ...data[siteKey].linkedPositionDivider };
    const settings = { ...data[siteKey].linkedPositionDivider };
    // Store only appearance overrides, never the generated ID or linked menus.
    for (const key of ['dividerTitle', 'dividerStyle', 'dividerSpacing', 'hide'] as const) {
        if (dividers[0][key] === previous[key]) continue;
        if (dividers[0][key] === undefined) delete settings[key];
        else Object.assign(settings, { [key]: dividers[0][key] });
    }
    if (Object.keys(settings).length) replacements[siteKey].linkedPositionDivider = settings;
    else delete replacements[siteKey].linkedPositionDivider;
    sources.forEach(position => {
        const source = positionSiteKey(position.id);
        const groups = items.filter(item => item.id === linkedMenuId(source));
        if (groups.length !== 1) throw new Error('직책 연결은 직책 관리에서 변경해주세요.');
        replacements[source] = { ...data[source], menu: restoreItems(groups[0].sub || [], source) };
    });
    // Validate every source before changing any site; failed edits stay atomic.
    Object.assign(data, replacements);
};
