import { doc, getDoc, setDoc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db } from '../config/firebase';
import { MenuItem, SiteDataType } from '../types/menu';
import { DEFAULT_MENU_CONFIG } from '../constants/defaultMenu';
import { MENU_PATHS } from '../constants/menuPaths';
import { SiteDataTypeSchema } from '../types/menuSchema';

const COLLECTION_NAME = 'settings';
const DOC_ID_CONFIG = 'menus_v12';

interface MenuSubscribeOptions {
    mergeWithDefaults?: boolean;
}

interface MenuFetchOptions {
    mergeWithDefaults?: boolean;
}

interface MenuListener {
    callback: (data: SiteDataType) => void;
    mergeWithDefaults: boolean;
}

interface AllowedMenuMap {
    [key: string]: true | AllowedMenuMap;
}

let currentConfig: SiteDataType | null = null;
let currentRawConfig: SiteDataType | null = null;
let unsubscribeSnapshot: Unsubscribe | null = null;
const listeners: Set<MenuListener> = new Set();

const deepClone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const MENU_TEXT_ALIASES: Record<string, string> = {
    '월급제v2': '월급제',
    '세금/가불 계산': '세금/가불'
};

const ALLOWED_MENU_TREE: AllowedMenuMap = {
    '현황관리': {
        '통합 현황판': true,
        '인원전체내역조회': true
    },
    '통합DB': true,
    '출력 관리': {
        '일보작성': true,
        '일보목록': true
    },
    '급여관리': {
        '일급제': true,
        '월급제': true,
        '지원팀': true,
        '가불관리': {
            '가불등록': true,
            '세금/가불': true
        }
    },
    '서명관리': {
        '서명생성기': true,
        '서명위임장': true,
        '위임장v2': true
    },
    '세금관리': {
        '세금계산서 발행': true,
        '세금계산서 거래장': true,
        '미수금 대시보드': true,
        '미수금 관리': true
    },
    '숙소관리': {
        '숙소 관리': true,
        '가불 및 공제': true
    },
    '자재관리': {
        '자재 마스터': true,
        '입고 등록': true,
        '출고 등록': true,
        '입출고 내역': true,
        '재고 현황': true,
        '현장별 재고': true
    },
    '개발자 도구': {
        '에이전트 플레이그라운드': true
    }
};

const normalizePayrollMenuItem = (item: MenuItem): MenuItem => {
    if (item.text !== '급여관리') {
        return item;
    }

    const rawSub = Array.isArray(item.sub) ? item.sub : [];
    const children = rawSub
        .map((child) => (typeof child === 'string' ? ({ text: child } as MenuItem) : (child as MenuItem)))
        .map((child) => normalizeMenuItem(child, `payroll/${item.text}`));

    const takeLeaf = (text: string): MenuItem | null => {
        const found = children.find((c) => c.text === text && (!c.sub || c.sub.length === 0));
        return found ? { ...found, sub: [] } : null;
    };

    const takeGroup = (text: string): MenuItem | null => {
        const found = children.find((c) => c.text === text && Array.isArray(c.sub) && c.sub.length > 0);
        return found ? { ...found } : null;
    };

    const dailyWage = normalizeMenuItem(takeLeaf('일급제') ?? ({ text: '일급제' } as MenuItem), `payroll/${item.text}`);
    const monthlyWage = normalizeMenuItem(takeLeaf('월급제') ?? ({ text: '월급제' } as MenuItem), `payroll/${item.text}`);
    const supportTeam = normalizeMenuItem(takeLeaf('지원팀') ?? ({ text: '지원팀' } as MenuItem), `payroll/${item.text}`);

    const looseTaxAdvance = takeLeaf('세금/가불');

    const advanceGroupExisting = takeGroup('가불관리');
    const advanceChildrenRaw = Array.isArray(advanceGroupExisting?.sub) ? (advanceGroupExisting?.sub ?? []) : [];
    const advanceChildren = advanceChildrenRaw
        .map((child) => (typeof child === 'string' ? ({ text: child } as MenuItem) : (child as MenuItem)))
        .map((child) => normalizeMenuItem(child, `payroll/${item.text}/가불관리`));

    const ensureAdvanceChild = (text: string): MenuItem => {
        const found = advanceChildren.find((c) => c.text === text && (!c.sub || c.sub.length === 0));
        const resolved = found ? { ...found, sub: [] } : ({ text } as MenuItem);
        return normalizeMenuItem(resolved, `payroll/${item.text}/가불관리`);
    };

    const advanceRegister = ensureAdvanceChild('가불등록');
    const taxAdvance = looseTaxAdvance ?? ensureAdvanceChild('세금/가불');

    const advanceGroup: MenuItem = normalizeMenuItem(
        {
            ...(advanceGroupExisting ?? ({ text: '가불관리' } as MenuItem)),
            sub: [advanceRegister, taxAdvance]
        },
        `payroll/${item.text}`
    );

    return {
        ...item,
        sub: [dailyWage, monthlyWage, supportTeam, advanceGroup]
    };
};

const normalizePayrollStructure = (config: SiteDataType): SiteDataType => {
    const next: SiteDataType = {};
    Object.keys(config).forEach((siteKey) => {
        const site = config[siteKey];
        const menu = Array.isArray(site.menu) ? site.menu : [];
        next[siteKey] = {
            ...site,
            menu: menu.map((item) => normalizePayrollMenuItem(item))
        };
    });
    return next;
};

const pruneMenuItemsByAllowTree = (items: MenuItem[], allowTree: AllowedMenuMap): MenuItem[] => {
    const pruned: MenuItem[] = [];

    items.forEach((item) => {
        const allowed = allowTree[item.text];
        if (!allowed) {
            return;
        }

        if (allowed === true) {
            pruned.push(item);
            return;
        }

        const next: MenuItem = { ...item };
        const sub = Array.isArray(item.sub) ? item.sub : [];
        const children = sub
            .map((child) => (typeof child === 'string' ? ({ text: child } as MenuItem) : (child as MenuItem)))
            .filter((child) => Boolean((allowed as AllowedMenuMap)[child.text]));

        next.sub = pruneMenuItemsByAllowTree(children, allowed as AllowedMenuMap);

        if (next.sub.length === 0 && (!next.path || next.path.length === 0)) {
            return;
        }

        pruned.push(next);
    });

    return pruned;
};

const pruneSiteDataTypeByAllowTree = (config: SiteDataType): SiteDataType => {
    const result: SiteDataType = {};
    Object.keys(config).forEach((siteKey) => {
        const site = config[siteKey];
        result[siteKey] = {
            ...site,
            menu: pruneMenuItemsByAllowTree(site.menu || [], ALLOWED_MENU_TREE)
        };
    });
    return result;
};

const createDeterministicId = (parts: string[]): string => {
    const input = parts.join('|');
    let hash = 2166136261;
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return `m_${(hash >>> 0).toString(36)}`;
};

const normalizeMenuItem = (item: MenuItem | string, parentIdPath: string): MenuItem => {
    const base: MenuItem = typeof item === 'string' ? { text: item } : { ...item };

    const rawText = String(base.text ?? '').trim();
    const normalizedText = MENU_TEXT_ALIASES[rawText] ?? rawText;
    const idSeed = `${parentIdPath}/${normalizedText}`;
    const normalizedId = base.id && String(base.id).trim().length > 0 ? String(base.id) : createDeterministicId([idSeed]);

    const rawSub = Array.isArray(base.sub) ? base.sub : [];
    const normalizedSub = rawSub.map((child) => normalizeMenuItem(child, `${idSeed}`));

    const normalizedPath =
        base.path && String(base.path).trim().length > 0
            ? String(base.path)
            : MENU_PATHS[normalizedText] || undefined;

    return {
        ...base,
        text: normalizedText,
        id: normalizedId,
        path: normalizedPath,
        sub: normalizedSub
    };
};

const normalizeSiteDataType = (config: SiteDataType): SiteDataType => {
    const normalized: SiteDataType = {};
    Object.keys(config).forEach((siteKey) => {
        const site = config[siteKey];
        normalized[siteKey] = {
            ...site,
            menu: (site.menu || []).map((item) => normalizeMenuItem(item, siteKey)),
            trash: site.trash ? site.trash.map((item) => normalizeMenuItem(item, `${siteKey}/trash`)) : site.trash,
            deletedItems: Array.isArray(site.deletedItems) ? site.deletedItems : []
        };
    });
    return normalized;
};

const mergeSubItems = (
    currentSub: (string | MenuItem)[] = [],
    defaultSub: (string | MenuItem)[] = []
): (string | MenuItem)[] => {
    const merged = [...currentSub];

    defaultSub.forEach((defaultEntry) => {
        if (typeof defaultEntry === 'string') {
            const hasString = merged.some((item) => (typeof item === 'string' ? item === defaultEntry : item.text === defaultEntry));
            if (!hasString) {
                merged.push(defaultEntry);
            }
            return;
        }

        const existingIndex = merged.findIndex((item) => typeof item !== 'string' && item.text === defaultEntry.text);
        if (existingIndex === -1) {
            merged.push(deepClone(defaultEntry));
            return;
        }

        const existingItem = merged[existingIndex] as MenuItem;
        if ((!existingItem.path || existingItem.path.length === 0) && defaultEntry.path) {
            existingItem.path = defaultEntry.path;
        }

        if (defaultEntry.sub && defaultEntry.sub.length > 0) {
            const existingSub = Array.isArray(existingItem.sub) ? existingItem.sub : [];
            existingItem.sub = mergeSubItems(existingSub, defaultEntry.sub);
        }
    });

    return merged;
};

const fillMissingPaths = (items: MenuItem[]): MenuItem[] => {
    const apply = (arr: MenuItem[]): MenuItem[] =>
        arr.map((item) => {
            const next: MenuItem = { ...item };
            if ((!next.path || next.path.length === 0) && MENU_PATHS[next.text]) {
                next.path = MENU_PATHS[next.text];
            }
            if (next.sub && next.sub.length > 0) {
                next.sub = apply(next.sub as MenuItem[]);
            }
            return next;
        });
    return apply(items);
};

const mergeMenuItemsWithDefaults = (currentMenu: MenuItem[], defaultMenu: MenuItem[], deletedItems: string[] = []): MenuItem[] => {
    const mergedMenu = currentMenu.map((item) => deepClone(item));

    defaultMenu.forEach((defaultItem) => {
        if (deletedItems.includes(defaultItem.text)) {
            return;
        }

        const existingIndex = mergedMenu.findIndex((item) => item.text === defaultItem.text);
        if (existingIndex === -1) {
            mergedMenu.push(deepClone(defaultItem));
            return;
        }

        const existingItem = mergedMenu[existingIndex];

        if ((!existingItem.path || existingItem.path.length === 0) && defaultItem.path) {
            existingItem.path = defaultItem.path;
        }

        if (defaultItem.sub && defaultItem.sub.length > 0) {
            const existingSub = Array.isArray(existingItem.sub) ? existingItem.sub : [];
            existingItem.sub = mergeSubItems(existingSub, defaultItem.sub);
        }
    });

    return fillMissingPaths(mergedMenu);
};

const ensureMenuWithDefaults = (incomingConfig: SiteDataType): SiteDataType => {
    const resultConfig: SiteDataType = {};

    const siteKeys = new Set([...Object.keys(DEFAULT_MENU_CONFIG), ...Object.keys(incomingConfig)]);

    siteKeys.forEach((siteKey) => {
        const defaultSite = DEFAULT_MENU_CONFIG[siteKey];
        const incomingSite = incomingConfig[siteKey];

        if (!incomingSite && defaultSite) {
            resultConfig[siteKey] = deepClone(defaultSite);
            return;
        }

        if (incomingSite && !defaultSite) {
            resultConfig[siteKey] = deepClone(incomingSite);
            return;
        }

        if (incomingSite && defaultSite) {
            resultConfig[siteKey] = {
                ...deepClone(defaultSite),
                ...deepClone(incomingSite),
                menu: mergeMenuItemsWithDefaults(incomingSite.menu, defaultSite.menu, incomingSite.deletedItems || [])
            };
            return;
        }

        if (defaultSite) {
            resultConfig[siteKey] = deepClone(defaultSite);
        }
    });

    const normalized = normalizeSiteDataType(resultConfig);
    const pruned = pruneSiteDataTypeByAllowTree(normalized);
    const restructured = normalizePayrollStructure(pruned);
    return normalizeSiteDataType(restructured);
};

const notifyListeners = () => {
    listeners.forEach((listener) => {
        if (listener.mergeWithDefaults) {
            if (currentConfig) {
                listener.callback(currentConfig);
            }
        } else if (currentRawConfig) {
            listener.callback(deepClone(currentRawConfig));
        } else if (currentConfig) {
            listener.callback(deepClone(currentConfig));
        }
    });
};

const prepareReturnConfig = (mergeWithDefaults: boolean) => {
    if (mergeWithDefaults) {
        return currentConfig ?? null;
    }
    if (currentRawConfig) {
        return deepClone(currentRawConfig);
    }
    if (currentConfig) {
        return deepClone(currentConfig);
    }
    return null;
};

const setupSnapshotListener = () => {
    if (unsubscribeSnapshot) {
        return;
    }

    unsubscribeSnapshot = onSnapshot(doc(db, COLLECTION_NAME, DOC_ID_CONFIG), (snapshot) => {
        if (!snapshot.exists()) {
            const fallback = normalizeSiteDataType(deepClone(DEFAULT_MENU_CONFIG));
            currentRawConfig = fallback;
            currentConfig = ensureMenuWithDefaults(fallback);
            notifyListeners();
            return;
        }

        const rawData = snapshot.data();
        const normalizedIncoming = normalizeSiteDataType(rawData as SiteDataType);

        currentRawConfig = deepClone(normalizedIncoming);
        currentConfig = ensureMenuWithDefaults(normalizedIncoming);

        notifyListeners();
    });
};

export const menuServiceV11 = {
    subscribe: (callback: (data: SiteDataType) => void, options: MenuSubscribeOptions = {}) => {
        const mergeWithDefaults = options.mergeWithDefaults ?? true;

        const listener: MenuListener = { callback, mergeWithDefaults };
        listeners.add(listener);

        setupSnapshotListener();

        const prepared = prepareReturnConfig(mergeWithDefaults);
        if (prepared) {
            callback(prepared);
        }

        return () => {
            listeners.delete(listener);
            if (listeners.size === 0 && unsubscribeSnapshot) {
                unsubscribeSnapshot();
                unsubscribeSnapshot = null;
            }
        };
    },

    getMenuConfig: async (options: MenuFetchOptions = {}): Promise<SiteDataType | null> => {
        try {
            const mergeWithDefaults = options.mergeWithDefaults ?? true;
            const menuRef = doc(db, COLLECTION_NAME, DOC_ID_CONFIG);
            const docSnapshot = await getDoc(menuRef);

            if (!docSnapshot.exists()) {
                return null;
            }

            const rawData = docSnapshot.data();
            const normalizedIncoming = normalizeSiteDataType(rawData as SiteDataType);

            if (mergeWithDefaults) {
                return ensureMenuWithDefaults(normalizedIncoming);
            }

            return deepClone(normalizedIncoming);
        } catch (error) {
            console.error('Failed to fetch menu configuration:', error);
            return null;
        }
    },

    saveMenuConfig: async (newConfig: SiteDataType) => {
        const normalizedConfig = normalizeSiteDataType(newConfig);
        const result = SiteDataTypeSchema.safeParse(normalizedConfig);

        if (!result.success) {
            const issues = result.error.issues;
            const error: Error & { issues?: typeof issues } = new Error('Invalid Menu Configuration');
            error.issues = issues;
            throw error;
        }

        try {
            const sanitizedData = JSON.parse(JSON.stringify(result.data));
            await setDoc(doc(db, COLLECTION_NAME, DOC_ID_CONFIG), sanitizedData);
            return true;
        } catch (error) {
            console.error('Failed to save menu configuration:', error);
            throw error;
        }
    },

    saveAsDefault: async (newDefault: SiteDataType) => {
        const normalizedConfig = normalizeSiteDataType(newDefault);
        const result = SiteDataTypeSchema.safeParse(normalizedConfig);

        if (!result.success) {
            throw new Error('Invalid Menu Configuration');
        }

        try {
            const sanitizedData = JSON.parse(JSON.stringify(result.data));
            await setDoc(doc(db, COLLECTION_NAME, 'menu_custom_defaults_v11'), sanitizedData);
            return true;
        } catch (error) {
            console.error('Failed to save custom defaults:', error);
            throw error;
        }
    },

    getCustomDefault: async (): Promise<SiteDataType | null> => {
        try {
            const customDefaultRef = doc(db, COLLECTION_NAME, 'menu_custom_defaults_v11');
            const docSnapshot = await getDoc(customDefaultRef);

            if (docSnapshot.exists()) {
                const rawData = docSnapshot.data();
                const result = SiteDataTypeSchema.safeParse(rawData);
                if (result.success) {
                    return result.data;
                }
            }
            return null;
        } catch (error) {
            console.error('Failed to get custom defaults:', error);
            return null;
        }
    },

    resetToDefault: async () => {
        const customDefault = await menuServiceV11.getCustomDefault();
        if (customDefault) {
            await menuServiceV11.saveMenuConfig(customDefault);
        } else {
            await menuServiceV11.saveMenuConfig(DEFAULT_MENU_CONFIG);
        }
    },

    clearCache: () => {
        currentConfig = null;
        currentRawConfig = null;
    }
};
