import { doc, getDoc, setDoc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db } from '../config/firebase';
import { MenuItem, SiteDataType } from '../types/menu';
import { DEFAULT_MENU_CONFIG } from '../constants/defaultMenu';
import { MENU_PATHS } from '../constants/menuPaths';
import { SiteDataTypeSchema } from '../types/menuSchema';

export type { MenuItem, SiteDataType };

const COLLECTION_NAME = 'settings';
const DOC_ID_CONFIG = 'menus_v12';

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

const MENU_TEXT_ALIASES: Record<string, string> = {
    '월급제v2': '월급제',
    '세금/가불 계산': '세금/가불'
};

// ALLOWED_MENU_TREE removed to support dynamic menu management


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

// Removed: mergeSubItems, fillMissingPaths, mergeMenuItemsWithDefaults, ensureMenuWithDefaults

// This is the new "Init" logic: normalize inputs, prune illegal items, fix structure.
// But it DOES NOT merge with defaults.
const processIncomingConfig = (incomingConfig: SiteDataType): SiteDataType => {
    // 1. Normalize IDs and structure
    const normalized = normalizeSiteDataType(incomingConfig);

    // 2. Fix Payroll structure specific logic
    const structured = normalizePayrollStructure(normalized);

    const final = normalizeSiteDataType(structured);

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

    unsubscribeSnapshot = onSnapshot(doc(db, COLLECTION_NAME, DOC_ID_CONFIG), (snapshot) => {
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

        currentRawConfig = deepClone(normalizedIncoming);
        // Important: Just process, DO NOT MERGE with local defaults
        currentConfig = processIncomingConfig(normalizedIncoming);

        notifyListeners();
    });
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
            const menuRef = doc(db, COLLECTION_NAME, DOC_ID_CONFIG);
            const docSnapshot = await getDoc(menuRef);

            if (!docSnapshot.exists()) {
                // Same init logic as snapshot listener
                console.warn('[MenuService] Config missing on fetch. Returning defaults.');
                const initial = processIncomingConfig(deepClone(DEFAULT_MENU_CONFIG));
                // Optional: We could save here, but let's let the caller or background listener handle persistence if needed.
                // For consistency with subscribe, let's save.
                await menuServiceV11.saveMenuConfig(initial);
                return initial;
            }

            const rawData = docSnapshot.data();
            const normalizedIncoming = normalizeSiteDataType(rawData as SiteDataType);
            return processIncomingConfig(normalizedIncoming);

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
        try {
            const config = await menuServiceV11.getMenuConfig();
            if (!config || !config.admin) return;

            let modified = false;
            const adminMenu = config.admin.menu || [];

            // 1. Check if "시스템 관리" exists
            let systemGroupIndex = adminMenu.findIndex((item) => item.text === '시스템 관리');
            let systemGroup = systemGroupIndex >= 0 ? adminMenu[systemGroupIndex] : null;

            if (!systemGroup) {
                // Create new group
                systemGroup = {
                    text: '시스템 관리',
                    icon: 'fa-gears',
                    sub: []
                };
                adminMenu.push(systemGroup);
                modified = true;
            }

            // 2. Check sub items
            // Ensure sub is an array
            if (!systemGroup.sub) systemGroup.sub = [];

            const requiredSubs = ['메뉴관리', '시스템 메시지 설정', '데이터 연결 점검'];
            // Normalize existing subs to strings for comparison
            const existingSubTexts = systemGroup.sub.map((s) => (typeof s === 'string' ? s : s.text));

            requiredSubs.forEach((req) => {
                if (!existingSubTexts.includes(req)) {
                    // We can push strings directly, normalize will handle them
                    (systemGroup!.sub as any[]).push(req);
                    modified = true;
                }
            });

            if (modified) {
                console.log('[MenuService] Migrating: Adding System Menu to Admin...');
                // We need to update the admin menu in the config
                // If we created a new group, it's already pushed. 
                // If we modified an existing group reference, it should be reflected in adminMenu array.
                // However, we need to ensure the structure is correct.

                // Note: systemGroup is a reference to an object inside adminMenu array (or pushed to it).
                // So config.admin.menu is already updated.

                await menuServiceV11.saveMenuConfig(config);
                console.log('[MenuService] Migration Complete: System Menu added.');
            }
        } catch (error) {
            console.error('[MenuService] Migration Failed:', error);
        }
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
                { id: 'full', name: '전체 메뉴', icon: 'fa-shield-halved', color: 'from-red-600 to-red-400', order: 0 },
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

            const pruneRecursive = (items: (MenuItem | string)[]): (MenuItem | string)[] => {
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
                        if (!item.id || seenIds.has(item.id)) {
                            // Generate new ID if missing or duplicate
                            item.id = `m_${Math.random().toString(36).substr(2, 9)}`;
                            modified = true;
                        }
                        seenIds.add(item.id);

                        if (item.sub) {
                            item.sub = pruneRecursive(item.sub);
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
    }
};
