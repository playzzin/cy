import { doc, getDoc, setDoc, onSnapshot, Unsubscribe, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { MenuItem, SiteDataType } from '../types/menu';
import { DEFAULT_MENU_CONFIG } from '../constants/defaultMenu';
import { DEFAULT_HEADER_ACTIONS } from '../constants/headerActions';
import { MENU_PATHS } from '../constants/menuPaths';
import { SiteDataTypeSchema } from '../types/menuSchema';

export type { MenuItem, SiteDataType };

const COLLECTION_NAME = 'settings';
const DOC_ID_CANDIDATES = ['menus_v12', 'menus_v11', 'menus_v10'];
let activeDocId = DOC_ID_CANDIDATES[0];

const isPermissionDenied = (err: any): boolean => {
    const code = err?.code;
    return code === 'permission-denied' || code === 'PERMISSION_DENIED';
};

const getMenuDocRef = (docId: string) => doc(db, COLLECTION_NAME, docId);

// Options no longer need mergeWithDefaults
interface MenuSubscribeOptions { }
interface MenuFetchOptions { }

interface MenuListener {
    callback: (data: SiteDataType) => void;
}

interface AllowedMenuMap {
    [key: string]: true | AllowedMenuMap;
}

let currentConfig: SiteDataType | null = null;
let currentRawConfig: SiteDataType | null = null;
let unsubscribeSnapshot: Unsubscribe | null = null;
const listeners: Set<MenuListener> = new Set();

const deepClone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const configsEqual = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const NATION_SITE_NAME = '전국시스템인력';

const MENU_TEXT_ALIASES: Record<string, string> = {
    "\uC6D4\uAE09\uC81Cv2": "\uC6D4\uAE09\uC81C",
    "\uBA54\uB274/\uAD8C\uD55C\uAD00\uB9AC": "\uBA54\uB274\uAD00\uB9AC",
    "\uC2DC\uC2A4\uD15C\uBA54\uC2DC\uC9C0\uAD00\uB9AC": "\uC2DC\uC2A4\uD15C \uBA54\uC2DC\uC9C0 \uC124\uC815",
    "\uBA54\uC2DC\uC9C0\uAD00\uB9AC": "\uC2DC\uC2A4\uD15C \uBA54\uC2DC\uC9C0 \uC124\uC815",
    "\uC2DC\uC2A4\uD15C\uBA54\uC2DC\uC9C0\uC124\uC815": "\uC2DC\uC2A4\uD15C \uBA54\uC2DC\uC9C0 \uC124\uC815",
    "\uD604\uC7A5\uAD00\uB9AC": "\uD604\uC7A5 \uAD00\uB9AC",
    "\uCD9C\uB825\uAD00\uB9AC": "\uCD9C\uB825 \uAD00\uB9AC",
    "\ubc95\uc778\ucc28\ub7c9 \uad00\ub9ac": "\ucc28\ub7c9/\uce74\ub4dc \ud1b5\ud569 \uad00\ub9ac",
    "\ubc95\uc778\uce74\ub4dc \uad00\ub9ac": "\ucc28\ub7c9/\uce74\ub4dc \ud1b5\ud569 \uad00\ub9ac",
    "\ucc28\ub7c9/\uce74\ub4dc \uad00\ub9ac": "\ucc28\ub7c9/\uce74\ub4dc \ud1b5\ud569 \uad00\ub9ac",
    "\ucc28\ub7c9\uce74\ub4dc \ud1b5\ud569 \uad00\ub9ac": "\ucc28\ub7c9/\uce74\ub4dc \ud1b5\ud569 \uad00\ub9ac"
};

const FORCE_MENU_PATH_TEXTS = new Set([
    "\uacc4\uc88c\uc870\ud68c",
    "\uacc4\uc88c\ubc88\ud638\uad00\ub9ac",
    "\uc791\uc5c5\uc790 \uacc4\uc88c",
    "\ud300 \uacc4\uc88c",
    "\ud68c\uc0ac \uacc4\uc88c",
    "\ub9e4\uc785 \uacc4\uc88c",
    "\uae30\ud0c0 \uacc4\uc88c",
    "\ub9e4\uc785/\uae30\ud0c0 \uacc4\uc88c",
]);

const PATH_TO_MENU_TEXT: Record<string, string> = Object.entries(MENU_PATHS).reduce((acc, [name, path]) => {
    if (!acc[path]) acc[path] = name;
    return acc;
}, {} as Record<string, string>);

const DEFAULT_POSITION_CONFIG_BY_ID: Record<string, any> = (
    DEFAULT_MENU_CONFIG.admin?.positionConfig || []
).reduce((acc: Record<string, any>, item: any) => {
    if (item && item.id) acc[String(item.id)] = item;
    return acc;
}, {} as Record<string, any>);

const sanitizePositionConfig = (input: any): any[] | undefined => {
    if (!Array.isArray(input)) return undefined;
    const next = input
        .map((raw: any) => {
            const id = typeof raw?.id === 'string' ? raw.id : '';
            const fallback = id ? DEFAULT_POSITION_CONFIG_BY_ID[id] : undefined;
            const name = typeof raw?.name === 'string' ? raw.name : (fallback?.name ?? '');
            const icon = typeof raw?.icon === 'string' ? raw.icon : (fallback?.icon ?? '');
            const color = typeof raw?.color === 'string' ? raw.color : (fallback?.color ?? 'from-slate-600 to-slate-400');
            const order = typeof raw?.order === 'number' ? raw.order : (typeof fallback?.order === 'number' ? fallback.order : undefined);

            if (!id || !name || !icon || !color) return null;
            return { id, name, icon, color, ...(order !== undefined ? { order } : {}) };
        })
        .filter(Boolean);

    return next.length > 0 ? (next as any[]) : undefined;
};

const normalizeHeaderActions = (input: any, siteKey: string): MenuItem[] => {
    const source = Array.isArray(input) ? input : deepClone(DEFAULT_HEADER_ACTIONS);

    return source
        .map((item: any) => normalizeMenuItem(item, `${siteKey}/headerActions`))
        .filter((item: MenuItem) => typeof item.text === 'string' && item.text.trim().length > 0);
};

// ALLOWED_MENU_TREE removed to support dynamic menu management


// Removed normalizePayrollMenuItem and normalizePayrollStructure to allow dynamic configuration

// prune functions removed


const createDeterministicId = (parts: string[]): string => {
    const input = parts.join('|');
    let hash = 2166136261;
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return `m_${(hash >>> 0).toString(36)}`;
};

const normalizeMenuItem = (item: any, parentIdPath: string): MenuItem => {
    const base: MenuItem =
        typeof item === 'string'
            ? { text: item }
            : (item && typeof item === 'object')
                ? { ...(item as MenuItem) }
                : ({ text: '' } as MenuItem);

    const rawText = typeof base.text === 'string' ? base.text.trim() : '';
    const rawPath = typeof base.path === 'string' ? base.path.trim() : '';
    const rawId = typeof base.id === 'string' ? base.id.trim() : '';
    const fromPath = rawPath ? (PATH_TO_MENU_TEXT[rawPath] || '') : '';
    const inferredText = rawText || fromPath || rawId;
    const normalizedText = inferredText ? (MENU_TEXT_ALIASES[inferredText] ?? inferredText) : '';

    const idSeed = `${parentIdPath}/${normalizedText || rawId || 'unknown'}`;
    const normalizedId = rawId.length > 0 ? rawId : createDeterministicId([idSeed]);

    const rawSub = Array.isArray(base.sub)
        ? base.sub.filter((c: any) => typeof c === 'string' || (c && typeof c === 'object'))
        : [];
    const normalizedSub = rawSub
        .map((child: any) => normalizeMenuItem(child, `${idSeed}`))
        .filter((child: MenuItem) => typeof child.text === 'string' && child.text.trim().length > 0);

    const inferredPath = normalizedText ? (MENU_PATHS[normalizedText] || undefined) : undefined;
    const normalizedPath =
        normalizedText && FORCE_MENU_PATH_TEXTS.has(normalizedText)
            ? inferredPath
            : rawPath.length > 0
                ? rawPath
                : inferredPath;

    const next: MenuItem = {
        ...base,
        text: normalizedText,
        id: normalizedId,
        path: normalizedPath,
        sub: normalizedSub
    };

    if (!next.sub || next.sub.length === 0) {
        delete (next as any).sub;
    }

    return next;
};

const normalizeSiteDataType = (config: SiteDataType): SiteDataType => {
    const normalized: SiteDataType = {};
    const safeConfig: any = config && typeof config === 'object' ? config : {};
    Object.keys(safeConfig).forEach((siteKey) => {
        const siteAny: any = safeConfig[siteKey];
        const site: any = siteAny && typeof siteAny === 'object' ? siteAny : {};

        const safeName = typeof site.name === 'string' && site.name.trim().length > 0 ? site.name : siteKey;
        const safeIcon = typeof site.icon === 'string' && site.icon.trim().length > 0 ? site.icon : 'fa-globe';

        const rawMenu = Array.isArray(site.menu) ? site.menu : [];
        const rawTrash = Array.isArray(site.trash) ? site.trash : undefined;

        normalized[siteKey] = {
            ...site,
            name: safeName,
            icon: safeIcon,
            order: typeof site.order === 'number' ? site.order : undefined, // Ensure order is preserved
            headerActions: normalizeHeaderActions(site.headerActions, siteKey),
            menu: rawMenu
                .map((item: any) => normalizeMenuItem(item, siteKey))
                .filter((item: MenuItem) => typeof item.text === 'string' && item.text.trim().length > 0),
            trash: rawTrash
                ? rawTrash
                    .map((item: any) => normalizeMenuItem(item, `${siteKey}/trash`))
                    .filter((item: MenuItem) => typeof item.text === 'string' && item.text.trim().length > 0)
                : undefined,
            deletedItems: Array.isArray(site.deletedItems) ? site.deletedItems.filter((v: any) => typeof v === 'string') : [],
            positionConfig: sanitizePositionConfig(site.positionConfig)
        };
    });
    return normalized;
};

const pruneLargeConfig = (config: SiteDataType): SiteDataType => {
    try {
        const json = JSON.stringify(config);
        const bytes = typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(json).length : json.length;
        // Firestore doc limit is 1MiB; keep a buffer.
        if (bytes < 900_000) return config;

        const next: SiteDataType = deepClone(config);
        Object.keys(next).forEach((siteKey) => {
            const site: any = (next as any)[siteKey];
            if (!site || typeof site !== 'object') return;
            if (Array.isArray(site.trash) && site.trash.length > 50) {
                site.trash = site.trash.slice(-50);
            }
            if (Array.isArray(site.deletedItems) && site.deletedItems.length > 200) {
                site.deletedItems = site.deletedItems.slice(-200);
            }
        });
        return next;
    } catch {
        return config;
    }
};

const ensureMenuChild = (config: SiteDataType, parentText: string, childText: string): boolean => {
    let changed = false;

    Object.values(config).forEach((site) => {
        if (!site || !Array.isArray(site.menu)) return;

        site.menu.forEach((item) => {
            if (typeof item === 'string' || item.text !== parentText) return;

            const subItems = Array.isArray(item.sub) ? item.sub : [];
            const hasChild = subItems.some((subItem) => {
                if (typeof subItem === 'string') return subItem === childText;
                return subItem?.text === childText;
            });

            if (!hasChild) {
                item.sub = [...subItems, childText];
                changed = true;
            }
        });
    });

    return changed;
};

const NOTICE_BOARD_MENU_ITEM: MenuItem = {
    text: '공지사항',
    icon: 'fa-bullhorn',
    path: '/notices'
};

const menuTreeContainsNoticeBoard = (items: (MenuItem | string)[] = []): boolean =>
    items.some((item) => {
        if (typeof item === 'string') {
            return item === NOTICE_BOARD_MENU_ITEM.text || MENU_PATHS[item] === NOTICE_BOARD_MENU_ITEM.path;
        }

        if (item.text === NOTICE_BOARD_MENU_ITEM.text || item.path === NOTICE_BOARD_MENU_ITEM.path) {
            return true;
        }

        return Array.isArray(item.sub) ? menuTreeContainsNoticeBoard(item.sub) : false;
    });

const ensureNoticeBoardMenu = (config: SiteDataType): boolean => {
    let changed = false;

    Object.entries(config).forEach(([siteKey, site]) => {
        if (siteKey === 'test' || siteKey === 'nation') return;
        if (!site || !Array.isArray(site.menu)) return;
        if (menuTreeContainsNoticeBoard(site.menu)) return;
        if (Array.isArray(site.deletedItems) && site.deletedItems.includes(NOTICE_BOARD_MENU_ITEM.text)) return;

        const dashboardIndex = site.menu.findIndex((item) =>
            typeof item !== 'string' && (item.path === '/dashboard' || item.text === '대시보드')
        );
        const insertIndex = dashboardIndex >= 0 ? dashboardIndex + 1 : 0;
        site.menu.splice(insertIndex, 0, { ...NOTICE_BOARD_MENU_ITEM });
        changed = true;
    });

    return changed;
};

const createNationSiteConfig = (sourceSite?: any) => {
    const fallbackMenu: MenuItem[] = [
        { text: '전국시스템인력 홈', icon: 'fa-globe', path: '/dashboard3' },
        { text: '전국 운영망', icon: 'fa-map-location-dot', path: '/jeonkuk/nationwide-partners' },
        { text: '통합 현황판', icon: 'fa-chart-line', path: '/jeonkuk/integrated-status' },
        { text: '상태 관리', icon: 'fa-wave-square', path: '/jeonkuk/status-management' },
        { text: '인원 전체내역조회', icon: 'fa-users', path: '/jeonkuk/total-history' },
    ];

    const clonedSource = sourceSite ? deepClone(sourceSite) : {};
    const nextMenu = Array.isArray(clonedSource.menu) && clonedSource.menu.length > 0
        ? clonedSource.menu
        : fallbackMenu;

    return {
        ...clonedSource,
        name: '전국시스템인력',
        icon: clonedSource.icon || 'fa-globe',
        order: typeof clonedSource.order === 'number' ? clonedSource.order : 3,
        menu: nextMenu,
    };
};

const ensureNationSiteConfig = (config: SiteDataType): boolean => {
    if (config.nation) {
        return false;
    }

    config.nation = createNationSiteConfig(config.test);
    return true;
};

const ensureCanonicalNationSiteConfig = (config: SiteDataType): boolean => {
    const fallbackMenu: MenuItem[] = [
        { text: '전국시스템인력 홈', icon: 'fa-globe', path: '/dashboard3' },
        { text: '전국 운영망', icon: 'fa-map-location-dot', path: '/jeonkuk/nationwide-partners' },
        { text: '통합 현황판', icon: 'fa-chart-line', path: '/jeonkuk/integrated-status' },
        { text: '상태 관리', icon: 'fa-wave-square', path: '/jeonkuk/status-management' },
        { text: '인원 전체내역조회', icon: 'fa-users', path: '/jeonkuk/total-history' },
    ];

    const matchingKeys = Object.keys(config).filter((key) => {
        if (key.startsWith('pos_')) return false;
        const siteName = String(config[key]?.name ?? '').trim();
        return key === 'nation' || siteName === NATION_SITE_NAME;
    });

    if (matchingKeys.length === 0) {
        const testSite: Record<string, any> = config.test ? deepClone(config.test) : {};
        config.nation = {
            ...testSite,
            name: NATION_SITE_NAME,
            icon: testSite.icon || 'fa-globe',
            order: typeof testSite.order === 'number' ? testSite.order : 3,
            menu: Array.isArray(testSite.menu) && testSite.menu.length > 0 ? testSite.menu : fallbackMenu,
        };
        return true;
    }

    const preferredKey = [...matchingKeys].sort((a, b) => {
        const menuLengthDiff = (Array.isArray(config[b]?.menu) ? config[b].menu.length : 0)
            - (Array.isArray(config[a]?.menu) ? config[a].menu.length : 0);

        if (menuLengthDiff !== 0) return menuLengthDiff;
        if (a === 'nation') return -1;
        if (b === 'nation') return 1;
        return 0;
    })[0];

    const preferredSite: Record<string, any> = deepClone(config[preferredKey] || {});
    const nextNation = {
        ...preferredSite,
        name: NATION_SITE_NAME,
        icon: preferredSite.icon || 'fa-globe',
        order: typeof preferredSite.order === 'number' ? preferredSite.order : 3,
        menu: Array.isArray(preferredSite.menu) && preferredSite.menu.length > 0 ? preferredSite.menu : fallbackMenu,
    };

    let changed = !configsEqual(config.nation, nextNation);
    config.nation = nextNation;

    matchingKeys.forEach((key) => {
        if (key !== 'nation') {
            delete config[key];
            changed = true;
        }
    });

    return changed;
};

const getMenuText = (item: MenuItem | string | undefined): string => {
    if (!item) return '';
    return typeof item === 'string' ? item : String(item.text ?? '');
};

const normalizeSupportAssetMenu = (config: SiteDataType): boolean => {
    const supportGroupSignals = new Set([
        '지원비 설정',
        '지원 현황판',
        '숙소 관리',
        '법인차량 관리',
        '법인카드 관리',
        '차량/카드 관리',
        '차량/카드 통합 관리',
        '경비내역'
    ]);
    const legacyAssetLabels = new Set([
        '법인차량 관리',
        '법인카드 관리',
        '차량/카드 관리',
        '차량카드 통합 관리',
        '차량/카드 통합 관리'
    ]);
    const unifiedAssetLabel = '차량/카드 통합 관리';
    const expenseLedgerLabel = '경비내역';
    let changed = false;

    Object.entries(config).forEach(([siteKey, site]) => {
        if (siteKey !== 'admin') return;
        if (!site || !Array.isArray(site.menu)) return;

        site.menu.forEach((menuItem) => {
            if (typeof menuItem === 'string' || !Array.isArray(menuItem.sub)) return;

            const childTexts = menuItem.sub.map((child) => getMenuText(child));
            const isSupportAssetGroup = childTexts.some((text) => supportGroupSignals.has(text));
            if (!isSupportAssetGroup) return;

            // Only unify if legacy labels exist, but don't force create the whole group if missing
            const nextSub = menuItem.sub.filter((child) => !legacyAssetLabels.has(getMenuText(child)));
            if (nextSub.length !== menuItem.sub.length) {
                const insertAfterIndex = nextSub.findIndex((child) => getMenuText(child) === '숙소 관리');
                const insertIndex = insertAfterIndex >= 0 ? insertAfterIndex + 1 : nextSub.length;

                nextSub.splice(insertIndex, 0, unifiedAssetLabel);
                menuItem.sub = nextSub;
                changed = true;
            }

            if (!menuItem.sub.some((child) => getMenuText(child) === expenseLedgerLabel)) {
                const insertAfterIndex = menuItem.sub.findIndex((child) => getMenuText(child) === unifiedAssetLabel);
                const insertIndex = insertAfterIndex >= 0 ? insertAfterIndex + 1 : menuItem.sub.length;
                menuItem.sub.splice(insertIndex, 0, expenseLedgerLabel);
                changed = true;
            }
        });
        
        // AUTO-INJECTION LOGIC REMOVED: 
        // We no longer force '지원 관리' to exist if it was deleted by the user.
    });

    return changed;
};

// Removed: mergeSubItems, fillMissingPaths, mergeMenuItemsWithDefaults, ensureMenuWithDefaults

// This is the new "Init" logic: normalize inputs, prune illegal items, fix structure.
// But it DOES NOT merge with defaults.
const processIncomingConfig = (incomingConfig: SiteDataType): SiteDataType => {
    // 1. Normalize IDs and structure
    const normalized = normalizeSiteDataType(incomingConfig);

    // Removed normalizePayrollStructure to allow dynamic configuration
    const final = normalized;

    ensureCanonicalNationSiteConfig(final);

    // 3. Ensure Position Config exists (Migration)
    if (final['admin'] && !final['admin'].positionConfig) {
        console.log('[MenuService] Auto-injecting default position config');
        // Use a safe fallback or import from DEFAULT_MENU_CONFIG
        // Since we are inside the module, we can use the imported constant if we avoid circular issues or just hardcode/copy.
        // Copying from DEFAULT_MENU_CONFIG if available, or using hardcoded fallback for safety.
        if (DEFAULT_MENU_CONFIG.admin?.positionConfig) {
            final['admin'].positionConfig = JSON.parse(JSON.stringify(DEFAULT_MENU_CONFIG.admin.positionConfig));
        }
    }

    return final;
};

const notifyListeners = () => {
    listeners.forEach((listener) => {
        // Always return currentConfig (which is processed)
        if (currentConfig) {
            listener.callback(deepClone(currentConfig));
        }
    });
};

const setupSnapshotListener = () => {
    if (unsubscribeSnapshot) {
        return;
    }

    unsubscribeSnapshot = onSnapshot(
        getMenuDocRef(activeDocId),
        (snapshot) => {
            if (!snapshot.exists()) {
                console.warn('[MenuService] Configuration missing. Initializing with defaults...');
                // Cold Init: Save DEFAULT_MENU_CONFIG to DB so it persists.
                const initialConfig = deepClone(DEFAULT_MENU_CONFIG);

                // We use the same processing logic to ensure it's valid before saving/using
                const processedInitial = processIncomingConfig(initialConfig);

                currentRawConfig = processedInitial;
                currentConfig = processedInitial;

                // Save async (don't block UI)
                menuServiceV11.saveMenuConfig(processedInitial).catch(err => {
                    console.error('[MenuService] Failed to auto-initialize menu config:', err);
                });

                notifyListeners();
                return;
            }

            const rawData = snapshot.data();
            const normalizedIncoming = normalizeSiteDataType(rawData as SiteDataType);

            const processedConfig = processIncomingConfig(normalizedIncoming);
            currentRawConfig = deepClone(normalizedIncoming);
            currentConfig = processedConfig;

            if (!configsEqual(processedConfig, normalizedIncoming)) {
                menuServiceV11.saveMenuConfig(processedConfig).catch(err => {
                    console.error('[MenuService] Failed to persist normalized snapshot config:', err);
                });
            }

            notifyListeners();
        },
        (error) => {
            console.error('[MenuService] Snapshot listener error:', error);
            if (isPermissionDenied(error)) {
                const currentIndex = DOC_ID_CANDIDATES.indexOf(activeDocId);
                const nextDocId = DOC_ID_CANDIDATES[currentIndex + 1];
                if (nextDocId) {
                    activeDocId = nextDocId;
                    if (unsubscribeSnapshot) {
                        unsubscribeSnapshot();
                        unsubscribeSnapshot = null;
                    }
                    setupSnapshotListener();
                }
            }
        }
    );
};

export const menuServiceV11 = {
    subscribe: (callback: (data: SiteDataType) => void, options: MenuSubscribeOptions = {}) => {
        const listener: MenuListener = { callback };
        listeners.add(listener);

        setupSnapshotListener();

        // Immediate return if we have data
        if (currentConfig) {
            callback(deepClone(currentConfig));
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
            let firstReadableMissing: string | null = null;

            for (const candidate of DOC_ID_CANDIDATES) {
                try {
                    const menuRef = getMenuDocRef(candidate);
                    const docSnapshot = await getDoc(menuRef);

                    if (docSnapshot.exists()) {
                        activeDocId = candidate;
                        const rawData = docSnapshot.data();
                        const normalizedIncoming = normalizeSiteDataType(rawData as SiteDataType);
                        const processedConfig = processIncomingConfig(normalizedIncoming);
                        if (!configsEqual(processedConfig, normalizedIncoming)) {
                            menuServiceV11.saveMenuConfig(processedConfig).catch(err => {
                                console.error('[MenuService] Failed to persist normalized menu config:', err);
                            });
                        }
                        return processedConfig;
                    }

                    if (!firstReadableMissing) {
                        firstReadableMissing = candidate;
                    }
                } catch (err: any) {
                    if (isPermissionDenied(err)) {
                        continue;
                    }
                    throw err;
                }
            }

            if (firstReadableMissing) {
                activeDocId = firstReadableMissing;
            }

            console.warn('[MenuService] Config missing on fetch. Returning defaults.');
            const initial = processIncomingConfig(deepClone(DEFAULT_MENU_CONFIG));
            await menuServiceV11.saveMenuConfig(initial);
            return initial;

        } catch (error) {
            console.error('Failed to fetch menu configuration:', error);
            return null;
        }
    },

    saveMenuConfig: async (newConfig: SiteDataType) => {
        const normalizedConfig = processIncomingConfig(normalizeSiteDataType(newConfig));
        const prunedConfig = pruneLargeConfig(normalizedConfig);
        const result = SiteDataTypeSchema.safeParse(prunedConfig);

        if (!result.success) {
            const issues = result.error.issues;
            const error: Error & { issues?: typeof issues } = new Error('Invalid Menu Configuration');
            error.issues = issues;
            throw error;
        }

        try {
            const sanitizedData = JSON.parse(JSON.stringify(result.data));
            let lastError: any = null;

            const candidatesToTry = [activeDocId, ...DOC_ID_CANDIDATES.filter((d) => d !== activeDocId)];
            for (const candidate of candidatesToTry) {
                const menuRef = getMenuDocRef(candidate);
                try {
                    // Removing { merge: true } ensures that deleted keys are actually removed from Firestore
                    await setDoc(menuRef, sanitizedData);
                    activeDocId = candidate;
                    return true;
                } catch (err: any) {
                    lastError = err;
                    if (isPermissionDenied(err)) {
                        continue;
                    }
                    throw err;
                }
            }

            throw lastError || new Error('All save attempts failed');
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
                    return normalizeSiteDataType(result.data as SiteDataType);
                }
            }
            return null;
        } catch (error) {
            console.error('Failed to get custom defaults:', error);
            return null;
        }
    },

    resetToDefault: async () => {
        // Logic: Use Custom Default if exists, otherwise Manual Default
        const customDefault = await menuServiceV11.getCustomDefault();
        if (customDefault) {
            await menuServiceV11.saveMenuConfig(customDefault);
        } else {
            // Use the local defaultMenu.ts as the "Factory Reset" source
            await menuServiceV11.saveMenuConfig(DEFAULT_MENU_CONFIG);
        }
    },

    ensureSystemMenuExists: async () => {
        // Remove auto-injection of menu items completely
        // The user wants manual configuration of system management menus.
        return Promise.resolve();
    },

    ensureSmartMemoMenuExists: async () => {
        // Remove auto-injection of smart memo menus completely
        return Promise.resolve();
    },

    clearCache: () => {
        currentConfig = null;
        currentRawConfig = null;
    },

    syncWithPositions: async (positions: { id: string; name: string; rank: number; color: string; icon?: string; iconKey?: string; }[]) => {
        try {
            const config = await menuServiceV11.getMenuConfig();
            if (!config || !config.admin) return;

            let modified = false;

            // 1. Update positionConfig in admin site
            const newPositionConfig = [
                { id: 'full', name: '\uC804\uCCB4 \uBA54\uB274', icon: 'fa-shield-halved', color: 'from-red-600 to-red-400', order: 0 },
                ...positions.map((p, index) => ({
                    id: p.id,
                    name: p.name,
                    icon: p.iconKey || p.icon || 'fa-user',
                    color: p.color || 'gray',
                    order: (p.rank || 0) + 1
                }))
            ];

            if (JSON.stringify(config.admin.positionConfig) !== JSON.stringify(newPositionConfig)) {
                config.admin.positionConfig = newPositionConfig;
                modified = true;
            }

            // 2. Ensure each position has a site entry
            positions.forEach(pos => {
                const siteKey = pos.id.startsWith('pos_') ? pos.id : `pos_${pos.id}`;

                // If this site key doesn't exist, create it
                if (!config[siteKey]) {
                    // Fallback to default menu if pos_general exists, otherwise empty
                    const fallbackMenu = config['pos_general']?.menu
                        ? JSON.parse(JSON.stringify(config['pos_general'].menu))
                        : [];

                    config[siteKey] = {
                        name: pos.name,
                        icon: pos.iconKey || pos.icon || 'fa-user',
                        menu: fallbackMenu
                    };
                    modified = true;
                } else {
                    // Update metadata if changed
                    if (config[siteKey].name !== pos.name || config[siteKey].icon !== (pos.iconKey || pos.icon)) {
                        config[siteKey].name = pos.name;
                        config[siteKey].icon = pos.iconKey || pos.icon || 'fa-user';
                        modified = true;
                    }
                }
            });

            // 3. Remove orphaned site keys (pos_*) that no longer exist in positions list
            const validPosKeys = new Set(positions.map(p => p.id.startsWith('pos_') ? p.id : `pos_${p.id}`));

            Object.keys(config).forEach(key => {
                if (key.startsWith('pos_') && !validPosKeys.has(key)) {
                    delete config[key];
                    modified = true;
                }
            });

            if (modified) {
                await menuServiceV11.saveMenuConfig(config);
                console.log('[MenuService] Synced positions to menu config.');
            }
        } catch (error) {
            console.error('[MenuService] Sync failed:', error);
        }
    },

    pruneDuplicates: async () => {
        try {
            const config = await menuServiceV11.getMenuConfig();
            if (!config) return;

            let modified = false;
            const seenIds = new Set<string>();

            const generateDeterministicId = (text: string, parentPath: string = ''): string => {
                const combined = `${parentPath}/${text}`.toLowerCase().replace(/\s+/g, '');
                let hash = 0;
                for (let i = 0; i < combined.length; i++) {
                    const char = combined.charCodeAt(i);
                    hash = ((hash << 5) - hash) + char;
                    hash = hash & hash;
                }
                return `m_${Math.abs(hash).toString(36)}`;
            };

            const pruneRecursive = (items: (MenuItem | string)[], parentPath: string = ''): (MenuItem | string)[] => {
                const seenText = new Set<string>();
                const uniqueItems: (MenuItem | string)[] = [];

                items.forEach(item => {
                    const text = typeof item === 'string' ? item : item.text;
                    const normalizedText = text.trim();

                    // 1. Text Deduplication (per level)
                    if (seenText.has(normalizedText)) {
                        modified = true;
                        return; // Skip duplicate text at same level
                    }
                    seenText.add(normalizedText);

                    // 2. ID Deduplication (Global) & ID Generation
                    if (typeof item !== 'string') {
                        const expectedId = generateDeterministicId(normalizedText, parentPath);

                        if (!item.id || item.id.startsWith('m_rand_') || seenIds.has(item.id)) {
                            // Fix deterministic ID if missing or potentially random
                            item.id = expectedId;
                            modified = true;
                        }

                        // Fix text padding issues while we're at it
                        if (item.text !== normalizedText) {
                            item.text = normalizedText;
                            modified = true;
                        }

                        seenIds.add(item.id);

                        if (item.sub) {
                            item.sub = pruneRecursive(item.sub, `${parentPath}/${normalizedText}`);
                        }
                    }

                    uniqueItems.push(item);
                });

                return uniqueItems;
            };

            Object.keys(config).forEach(siteKey => {
                const site = config[siteKey];
                if (site.menu) {
                    site.menu = pruneRecursive(site.menu) as MenuItem[];
                }
            });

            if (modified) {
                console.log('[MenuService] Duplicates (IDs/Text) pruned and fixed.');
                await menuServiceV11.saveMenuConfig(config);
            } else {
                console.log('[MenuService] No duplicates found.');
            }
        } catch (error: any) {
            console.error('[MenuService] Prune failed:', error);
        }
    },

    // === ?筌뤿굞???shim (??ル맪???袁⑤?獄?????嶺뚣볦굣?? ===
    refreshFromServer: async (): Promise<{ changed: boolean; activeDocId: string }> => {
        await menuServiceV11.getMenuConfig({ allowFallback: true });
        return { changed: false, activeDocId: activeDocId };
    },
    announceMenuChange: (_source?: string): void => { /* no-op */ },
    checkMenusV12Exists: async (): Promise<boolean> => {
        try { return !!(await menuServiceV11.getMenuConfig()); } catch { return false; }
    },
    getActiveDocId: (): string => activeDocId,
    initializeMenusV12: async (): Promise<void> => {
        await menuServiceV11.getMenuConfig({ allowInitializeIfMissing: true });
    },
    parseMenuConfigJson: (raw: string): any => {
        try { return JSON.parse(raw); } catch { return null; }
    },
    getMenuConfigRaw: async (): Promise<any> => menuServiceV11.getMenuConfig(),
    runOneTimeMigrations: async (): Promise<void> => {
        try {
            const config = await menuServiceV11.getMenuConfig();
            if (!config) return;

            const addedNationwidePage = ensureMenuChild(config, '현황관리', '전국페이지');
            const addedNoticeBoard = ensureNoticeBoardMenu(config);
            const ensuredNationSite = ensureCanonicalNationSiteConfig(config);
            const normalizedSupportAssetMenu = normalizeSupportAssetMenu(config);
            const changed = addedNationwidePage || addedNoticeBoard || ensuredNationSite || normalizedSupportAssetMenu;
            if (changed) {
                await menuServiceV11.saveMenuConfig(config);
            }
        } catch (error: any) {
            console.error('[MenuService] runOneTimeMigrations failed:', error);
        }
    },
};
