import { dc, functions as firebaseFunctions } from '../config/firebase';
import { httpsCallable } from 'firebase/functions';
import { listSettings, listAllSettings } from './dataconnectCompat';
import { createSetting, updateSetting } from '../dataconnect-generated';
import { MenuItem, SiteDataType } from '../types/menu';
import { DEFAULT_MENU_CONFIG } from '../constants/defaultMenu';
import { MENU_PATHS } from '../constants/menuPaths';
import { SiteDataTypeSchema } from '../types/menuSchema';

export type { MenuItem, SiteDataType };

const DOC_ID_CANDIDATES = ['menus_v12'];
const ACTIVE_DOC_ID_STORAGE_KEY = 'cy_menu_active_doc_id_v2_force';
const POLL_IGNORE_AFTER_SAVE_MS = 7000;
const LAST_GOOD_CONFIG_STORAGE_KEY = 'cy_menu_last_good_config_v2_force';
const REPAIR_V12_STORAGE_KEY = 'cy_menu_repair_v12_20260122_fixed_v4_manual_redeploy'; // Unique key to force update
const SYNC_INTERVAL_MS = 300000; // 5분 주기 (비용 절감 및 효율성 고려)
let syncIntervalId: any = null;
let lastServerConfigHash: string = '';


const MENU_SERVICE_DEBUG_STORAGE_KEY = 'cy_menu_service_debug_v1';

const isMenuServiceDebugEnabled = (): boolean => {
    try {
        if (typeof window === 'undefined') return false;
        return window.localStorage.getItem(MENU_SERVICE_DEBUG_STORAGE_KEY) === '1';
    } catch {
        return false;
    }
};

let didWarnConfigMissing = false;
let lastConfigMissingWarnAt = 0;
const CONFIG_MISSING_WARN_THROTTLE_MS = 60_000;

const readPersistedActiveDocId = (): string | null => {
    try {
        if (typeof window === 'undefined') return null;
        const raw = window.localStorage.getItem(ACTIVE_DOC_ID_STORAGE_KEY);
        if (!raw) return null;
        const id = raw.trim();
        return DOC_ID_CANDIDATES.includes(id) ? id : null;
    } catch {
        return null;
    }
};

const injectMissingLeafPathsFromMenuPaths = (config: SiteDataType): SiteDataType => {
    const next = deepClone(config);

    const visitItems = (items: MenuItem[]): MenuItem[] => {
        return items.map((item) => {
            const hasChildren = Array.isArray(item.sub) && item.sub.length > 0;
            if (hasChildren) {
                return { ...item, sub: visitItems(item.sub as MenuItem[]) };
            }

            if (!item.path && item.text && MENU_PATHS[item.text]) {
                return { ...item, path: MENU_PATHS[item.text] };
            }

            return item;
        });
    };

    Object.keys(next).forEach((siteKey) => {
        const site = (next as any)[siteKey];
        if (!site || typeof site !== 'object') return;
        if (Array.isArray(site.menu)) {
            site.menu = visitItems(site.menu as MenuItem[]);
        }
        if (Array.isArray(site.trash)) {
            site.trash = visitItems(site.trash as MenuItem[]);
        }
    });

    return next;
};

const persistActiveDocId = (id: string) => {
    try {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem(ACTIVE_DOC_ID_STORAGE_KEY, id);
    } catch {
    }
};

const readLastGoodConfig = (): SiteDataType | null => {
    try {
        if (typeof window === 'undefined') return null;
        const raw = window.localStorage.getItem(LAST_GOOD_CONFIG_STORAGE_KEY);
        if (!raw) return null;
        const parsed = safeJsonParse<any>(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        return processIncomingConfig(normalizeSiteDataType(parsed as SiteDataType));
    } catch {
        return null;
    }
};

const persistLastGoodConfig = (config: SiteDataType) => {
    try {
        if (typeof window === 'undefined') return;
        const pruned = pruneLargeConfig(processIncomingConfig(normalizeSiteDataType(config)));
        window.localStorage.setItem(LAST_GOOD_CONFIG_STORAGE_KEY, JSON.stringify(pruned));
    } catch {
    }
};

let activeDocId = readPersistedActiveDocId() ?? DOC_ID_CANDIDATES[0];

// Options no longer need mergeWithDefaults
interface MenuSubscribeOptions { }
interface MenuFetchOptions {
    allowFallback?: boolean;
    allowInitializeIfMissing?: boolean;
}

interface MenuListener {
    callback: (data: SiteDataType) => void;
}

let currentConfig: SiteDataType | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
const listeners: Set<MenuListener> = new Set();
let pollInFlight = false;
let lastSuccessfulSaveAt = 0;
let visibilityChangeHandler: (() => void) | null = null;
let menuSyncChannel: BroadcastChannel | null = null;
let menuSyncChannelHandler: ((event: MessageEvent) => void) | null = null;
let menuSyncStorageHandler: ((event: StorageEvent) => void) | null = null;
const MENU_SYNC_STORAGE_KEY = 'cy_menu_sync_ping_v1';
let requiredSettingDataCache = new Map<string, string>();
let requiredSettingDataCacheAt = 0;
const REQUIRED_SETTING_CACHE_TTL_MS = 12_000;

const deepClone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const MENU_TEXT_ALIASES: Record<string, string> = {
    '월급제v2': '월급제',
    '세금/가불 계산': '세금/가불',
    '일용노무비지급명세서': '일용노무비 지급명세서',
    '노무비지급명세서': '일용노무비 지급명세서',
    '노무비지급명세서생성기': '노무비 지급명세서 생성기',
    '카카오 관리': '카카오톡 관리',
    '카카오톡관리': '카카오톡 관리',
    '카카오톡 관리(구)': '카카오톡 관리',
    '카카오톡 연동설정': '카카오톡 연동 설정',
    '카카오톡 연동 설정(바로빌)': '카카오톡 연동 설정',
    '카카오톡 연동 설정 (바로빌)': '카카오톡 연동 설정',
    '카카오톡발송센터': '카카오톡 발송센터',
    '카카오톡 발송 센터': '카카오톡 발송센터',
    '카카오 발송센터': '카카오톡 발송센터',
    'Smart Memo': '스마트 메모'
};

const MENU_MIGRATION_FLAGS_ID = 'menu_migration_flags_v1';

type MenuMigrationFlags = {
    dataManagementConsoleMenuV1?: boolean;
    smartMemoMenuV1?: boolean;
};

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

const normalizePayrollMenuItem = (item: MenuItem): MenuItem => {
    if (item.text !== '급여관리') {
        return item;
    }

    const rawSub = Array.isArray(item.sub) ? item.sub : [];
    const normalized = rawSub
        .map((child) => (typeof child === 'string' ? ({ text: child } as MenuItem) : (child as MenuItem)))
        .map((child) => normalizeMenuItem(child, `payroll/${item.text}`));

    const normalizedWithAdvanceGroup = normalized.map((child) => {
        if (child.text !== '가불관리') return child;
        const advanceChildrenRaw = Array.isArray(child.sub) ? child.sub : [];
        const advanceChildren = advanceChildrenRaw
            .map((c) => (typeof c === 'string' ? ({ text: c } as MenuItem) : (c as MenuItem)))
            .map((c) => normalizeMenuItem(c, `payroll/${item.text}/가불관리`));

        return {
            ...child,
            sub: advanceChildren
        };
    });

    return {
        ...item,
        sub: normalizedWithAdvanceGroup
    };
};

const normalizeManpowerMenuItem = (item: MenuItem): MenuItem => {
    if (item.text !== '인력 관리') {
        return item;
    }

    const rawSub = Array.isArray(item.sub) ? item.sub : [];
    const normalized = rawSub
        .map((child) => (typeof child === 'string' ? ({ text: child } as MenuItem) : (child as MenuItem)))
        .map((child) => normalizeMenuItem(child, `manpower/${item.text}`));

    // Ensure "프리랜서 관리" exists
    if (!normalized.some(child => child.text === '프리랜서 관리')) {
        normalized.push({
            id: 'm_freelancer_admin',
            text: '프리랜서 관리',
            path: '/manpower/freelancer'
        });
    }

    return {
        ...item,
        sub: normalized
    };
};

const normalizePayrollStructure = (config: SiteDataType): SiteDataType => {
    const next: SiteDataType = {};
    Object.keys(config).forEach((siteKey) => {
        const site = config[siteKey];
        const menu = Array.isArray(site.menu) ? site.menu : [];
        next[siteKey] = {
            ...site,
            menu: menu
                .map((item) => normalizePayrollMenuItem(item))
                .map((item) => normalizeManpowerMenuItem(item))
        };
    });
    return next;
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

const ensureUniqueMenuIds = (items: MenuItem[], scope: string): MenuItem[] => {
    const used = new Map<string, number>();

    const visit = (item: MenuItem, path: string): MenuItem => {
        const rawId = typeof item.id === 'string' ? item.id.trim() : '';
        const baseId = rawId || createDeterministicId([path, item.text || 'item', item.path || '']);

        const seen = used.get(baseId) ?? 0;
        used.set(baseId, seen + 1);

        const uniqueId = seen === 0 ? baseId : `${baseId}_${seen}`;

        const next: MenuItem = { ...item, id: uniqueId };
        if (Array.isArray(next.sub) && next.sub.length > 0) {
            next.sub = next.sub
                .map((child, idx) => visit(child as MenuItem, `${path}/${uniqueId}/${idx}`));
        }
        return next;
    };

    return items.map((item, idx) => visit(item, `${scope}/${idx}`));
};

const normalizeMenuItem = (item: any, parentIdPath: string): MenuItem => {
    const isFromString = typeof item === 'string';
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
    // Use a simpler approach: if rawId is present, use it. Otherwise generate deterministic but ensure uniqueness if same content appears multiple times?
    // Actually, createDeterministicId is just hashing the input. If input is same, output is same.
    // If we have duplicate menu items (same text) under same parent, they will collide.
    // Let's rely on parent path structure.
    const normalizedId = rawId.length > 0 ? rawId : createDeterministicId([idSeed, rawPath || rawText || 'item']);

    const rawSub = Array.isArray(base.sub)
        ? base.sub.filter((c: any) => typeof c === 'string' || (c && typeof c === 'object'))
        : [];
    const normalizedSub = rawSub
        .map((child: any) => normalizeMenuItem(child, `${idSeed}`))
        .filter((child: MenuItem) => typeof child.text === 'string' && child.text.trim().length > 0);

    const normalizedPath =
        rawPath.length > 0
            ? rawPath
            : (isFromString
                ? (normalizedText ? (MENU_PATHS[normalizedText] || undefined) : undefined)
                : undefined);

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

        const normalizedMenu = rawMenu
            .map((item: any) => normalizeMenuItem(item, siteKey))
            .filter((item: MenuItem) => typeof item.text === 'string' && item.text.trim().length > 0);

        const normalizedTrash = rawTrash
            ? rawTrash
                .map((item: any) => normalizeMenuItem(item, `${siteKey}/trash`))
                .filter((item: MenuItem) => typeof item.text === 'string' && item.text.trim().length > 0)
            : undefined;

        normalized[siteKey] = {
            ...site,
            name: safeName,
            icon: safeIcon,
            menu: ensureUniqueMenuIds(normalizedMenu, `${siteKey}/menu`),
            trash: normalizedTrash ? ensureUniqueMenuIds(normalizedTrash, `${siteKey}/trash`) : undefined,
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

const processIncomingConfig = (incomingConfig: SiteDataType): SiteDataType => {
    // 1. Normalize IDs and structure
    const normalized = normalizeSiteDataType(incomingConfig);

    // 2. Fix Payroll structure specific logic
    const structured = normalizePayrollStructure(normalized);

    const final = normalizeSiteDataType(structured);

    const withLeafPaths = injectMissingLeafPathsFromMenuPaths(final);

    // 3. Ensure Position Config exists (Migration)
    if (withLeafPaths['admin']) {
        if (!withLeafPaths['admin'].positionConfig) {
            console.log('[MenuService] Auto-injecting default position config');
            if (DEFAULT_MENU_CONFIG.admin?.positionConfig) {
                withLeafPaths['admin'].positionConfig = JSON.parse(JSON.stringify(DEFAULT_MENU_CONFIG.admin.positionConfig));
            }
        }

        // 4. Ensure Position Site Data exists (Dynamic Mapping)
        // If we have a position in config (e.g. 'ceo'), we MUST have 'pos_ceo' in siteData.
        // If missing, try to restore from DEFAULT or create stub.
        const currentPositions = withLeafPaths['admin'].positionConfig || [];
        currentPositions.forEach((pos: any) => {
            if (pos.id === 'full') return;
            const siteKey = `pos_${pos.id}`; // keys are always pos_ prefix for dynamic sites

            // Check if siteData has this key
            if (!withLeafPaths[siteKey]) {
                // Check if DEFAULT has it
                // @ts-ignore
                if (DEFAULT_MENU_CONFIG[siteKey]) {
                    // @ts-ignore
                    withLeafPaths[siteKey] = JSON.parse(JSON.stringify(DEFAULT_MENU_CONFIG[siteKey]));
                } else {
                    // Create Stub
                    withLeafPaths[siteKey] = {
                        name: pos.name || siteKey,
                        icon: pos.icon || 'fa-user',
                        menu: []
                    };
                }
            }
        });
    }

    return withLeafPaths;
};

const notifyListeners = () => {
    listeners.forEach((listener) => {
        // Always return currentConfig (which is processed)
        if (currentConfig) {
            listener.callback(deepClone(currentConfig));
        }
    });
};

const announceMenuSync = (source: string) => {
    const payload = JSON.stringify({ at: Date.now(), source });
    try {
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(MENU_SYNC_STORAGE_KEY, payload);
        }
    } catch {
    }

    try {
        if (menuSyncChannel) {
            menuSyncChannel.postMessage(payload);
        }
    } catch {
    }
};

const ensureMenuSyncListener = () => {
    if (typeof window === 'undefined') return;
    if (menuSyncChannelHandler || menuSyncStorageHandler) return;

    try {
        if (typeof BroadcastChannel !== 'undefined') {
            menuSyncChannel = new BroadcastChannel('cy_menu_sync_v1');
            menuSyncChannelHandler = () => {
                void menuServiceV11.refreshFromServer();
            };
            menuSyncChannel.addEventListener('message', menuSyncChannelHandler);
        }
    } catch {
        menuSyncChannel = null;
        menuSyncChannelHandler = null;
    }

    menuSyncStorageHandler = (event: StorageEvent) => {
        if (event.key !== MENU_SYNC_STORAGE_KEY) return;
        void menuServiceV11.refreshFromServer();
    };
    window.addEventListener('storage', menuSyncStorageHandler);
};

const teardownMenuSyncListener = () => {
    if (typeof window === 'undefined') return;

    if (menuSyncStorageHandler) {
        window.removeEventListener('storage', menuSyncStorageHandler);
        menuSyncStorageHandler = null;
    }

    if (menuSyncChannel && menuSyncChannelHandler) {
        try {
            menuSyncChannel.removeEventListener('message', menuSyncChannelHandler);
        } catch {
        }
        menuSyncChannelHandler = null;
    }

    if (menuSyncChannel) {
        try {
            menuSyncChannel.close();
        } catch {
        }
        menuSyncChannel = null;
    }
};

const safeJsonParse = <T>(raw: unknown): T | null => {
    if (typeof raw !== 'string') return null;
    try {
        return JSON.parse(raw) as T;
    } catch {
        return null;
    }
};

const getMigrationFlags = async (): Promise<MenuMigrationFlags> => {
    try {
        const settings = await listSettingsMap();
        const raw = settings.get(MENU_MIGRATION_FLAGS_ID);
        const parsed = safeJsonParse<any>(raw);
        if (parsed && typeof parsed === 'object') return parsed as MenuMigrationFlags;
        return {};
    } catch {
        return {};
    }
};

const saveMigrationFlags = async (flags: MenuMigrationFlags) => {
    await upsertSettingData(MENU_MIGRATION_FLAGS_ID, flags);
};

const ensureDataManagementConsoleMenuExists = (config: SiteDataType): { config: SiteDataType; modified: boolean } => {
    let modified = false;
    const next = deepClone(config);

    const adminSite = next.admin;
    if (!adminSite) return { config: next, modified };

    if (!Array.isArray(adminSite.menu)) adminSite.menu = [];

    const dataGroupText = '데이터 관리';
    const consoleGroupText = '콘솔';

    let dataGroup = adminSite.menu.find((item) => item.text === dataGroupText) as MenuItem | undefined;
    if (!dataGroup) {
        dataGroup = { text: dataGroupText, icon: 'fa-database', sub: [] };
        adminSite.menu.push(dataGroup);
        modified = true;
    }

    if (!Array.isArray(dataGroup.sub)) {
        dataGroup.sub = [];
        modified = true;
    }

    let consoleGroup = (dataGroup.sub as (string | MenuItem)[]).find(
        (child) => typeof child !== 'string' && (child as MenuItem).text === consoleGroupText
    ) as MenuItem | undefined;

    if (!consoleGroup) {
        consoleGroup = { text: consoleGroupText, icon: 'fa-database', sub: [] };
        (dataGroup.sub as any[]).push(consoleGroup);
        modified = true;
    }

    if (!Array.isArray(consoleGroup.sub)) {
        consoleGroup.sub = [];
        modified = true;
    }

    const requiredLeafTexts = [
        '작업자 콘솔',
        '팀 콘솔',
        '현장 콘솔',
        '회사 콘솔',
        '데이터 콘솔',
        '관계 관리 콘솔',
        '데이터 관계 시각화'
    ];

    const consoleAdminRoles = ['admin', '관리자', '사장', '실장'];

    const subItems = consoleGroup.sub as (string | MenuItem)[];
    const upgradedSubItems = subItems.map((child) => {
        if (typeof child === 'string') {
            if (!requiredLeafTexts.includes(child)) return child;
            modified = true;
            return { text: child, roles: consoleAdminRoles } as MenuItem;
        }

        if (child && typeof child === 'object' && requiredLeafTexts.includes(child.text)) {
            if (!child.roles || child.roles.length === 0) {
                modified = true;
                return { ...child, roles: consoleAdminRoles } as MenuItem;
            }
        }

        return child;
    });

    consoleGroup.sub = upgradedSubItems as any;

    const existingLeafTexts = new Set<string>();
    (consoleGroup.sub as (string | MenuItem)[]).forEach((child) => {
        if (typeof child === 'string') existingLeafTexts.add(child);
        else if (child && typeof child === 'object' && typeof child.text === 'string') existingLeafTexts.add(child.text);
    });

    requiredLeafTexts.forEach((text) => {
        if (!existingLeafTexts.has(text)) {
            (consoleGroup!.sub as any[]).push({ text, roles: consoleAdminRoles } as MenuItem);
            modified = true;
        }
    });

    return { config: next, modified };
};

const ensureSmartMemoMenuExistsInConfig = (config: SiteDataType): { config: SiteDataType; modified: boolean } => {
    let modified = false;
    const next = deepClone(config);

    const adminSite = next.admin;
    if (!adminSite) return { config: next, modified };

    if (!Array.isArray(adminSite.menu)) {
        adminSite.menu = [];
        modified = true;
    }

    const adminMenu = adminSite.menu;
    const exists = adminMenu.some((item) => item.text === '스마트 메모' || item.text === 'Smart Memo');
    if (!exists) {
        adminMenu.push({
            text: '스마트 메모',
            icon: 'fa-sticky-note',
            path: '/memos'
        });
        modified = true;
    }

    const systemGroup = adminMenu.find((item) => item.text === '시스템 관리');
    if (systemGroup) {
        if (!Array.isArray(systemGroup.sub)) {
            systemGroup.sub = [];
            modified = true;
        }
        const barobillItemText = '카카오톡 연동 설정';
        const subItems = systemGroup.sub.map((s) => (typeof s === 'string' ? s : s.text));
        if (!subItems.includes(barobillItemText)) {
            (systemGroup.sub as any[]).push(barobillItemText);
            modified = true;
        }
    }

    return { config: next, modified };
};

async function listSettingsMap(): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    const requiredIds = [
        ...DOC_ID_CANDIDATES,
        MENU_MIGRATION_FLAGS_ID,
        'menu_custom_defaults_v11'
    ];

    const appendRows = (rows: any[]) => {
        rows.forEach((r: any) => {
            const id = r?.id ? String(r.id) : '';
            const raw = r?.data;
            let data = '';
            if (typeof raw === 'string') {
                data = raw;
            } else if (raw != null) {
                try {
                    data = JSON.stringify(raw);
                } catch {
                    data = String(raw);
                }
            }
            if (id && data) map.set(id, data);
        });
    };

    // 1. Primary query
    try {
        const res = await listSettings(dc);
        const rows = (res as any)?.data?.settings ?? [];
        appendRows(Array.isArray(rows) ? rows : []);
    } catch (e) {
        console.warn('[MenuService] Settings fetch failed:', e);
    }

    const hasAllRequired = requiredIds.every((id) => map.has(id));
    if (hasAllRequired) return map;

    // Use Cache if still missing
    const canUseCache =
        requiredSettingDataCache.size > 0 &&
        Date.now() - requiredSettingDataCacheAt < REQUIRED_SETTING_CACHE_TTL_MS &&
        requiredIds.every((id) => requiredSettingDataCache.has(id));

    if (canUseCache) {
        requiredIds.forEach((id) => {
            if (!map.has(id)) {
                const cached = requiredSettingDataCache.get(id);
                if (cached) map.set(id, cached);
            }
        });

        const hasAllRequiredFromCache = requiredIds.every((id) => map.has(id));
        if (hasAllRequiredFromCache) return map;
    }

    // Heavy Fallback: listAllSettings (Only if really needed)
    // Removed complex pagination loop as public query should handle it efficiently.
    // Keeping simple fallback just in case.
    if (!hasAllRequired) {
        try {
            const res = await listAllSettings(dc, { limit: 100 } as any);
            const rows = (res as any)?.data?.settings ?? [];
            appendRows(Array.isArray(rows) ? rows : []);
        } catch {
            // ignore
        }
    }

    if (requiredIds.every((id) => map.has(id))) {
        requiredSettingDataCache = new Map<string, string>();
        requiredIds.forEach((id) => {
            const v = map.get(id);
            if (v) requiredSettingDataCache.set(id, v);
        });
        requiredSettingDataCacheAt = Date.now();
    }

    return map;
}

async function upsertSettingData(id: string, dataObj: any) {
    console.log(`[MenuService] upsertSettingData: ${id}`);
    const data = JSON.stringify(dataObj);

    let masterKey = '';
    if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        masterKey = params.get('masterKey') || window.localStorage.getItem('cy_master_key') || '';
        if (params.get('masterKey')) {
            window.localStorage.setItem('cy_master_key', params.get('masterKey')!);
        }
    }

    try {
        const fn = httpsCallable<{ id: string; data: string; masterKey?: string }, { success: boolean; id: string }>(
            firebaseFunctions,
            'upsertSettingAdmin'
        );
        const res = await fn({ id, data, masterKey });
        if (res.data?.success !== true) {
            throw new Error(`[MenuService] upsertSettingAdmin failed for ${id}`);
        }
        console.log(`[MenuService] upsertSettingAdmin success for ${id}`);
        return true;
    } catch (err: any) {
        console.error(`[MenuService] upsertSettingAdmin failed for ${id}:`, err);
        throw err;
    }
}

async function fetchSettingByMasterKey(id: string, masterKey: string): Promise<string | null> {
    try {
        const fn = httpsCallable<{ id: string; masterKey: string }, { success: boolean; data: any }>(
            firebaseFunctions,
            'getSettingAdmin'
        );
        const res = await fn({ id, masterKey });
        if (res.data?.success && res.data.data?.data) {
            return res.data.data.data as string;
        }
    } catch (e) {
        // console.warn(`[MenuService] MasterKey fetch failed for ${id}`, e);
    }
    return null;
}

const setupSnapshotListener = () => {
    if (pollTimer) return;

    const tick = async () => {
        // 비용 절감을 위해 탭이 백그라운드(hidden) 상태면 스킵
        if (typeof document !== 'undefined' && document.hidden) return;
        if (pollInFlight) return;
        pollInFlight = true;
        const fetchStartedAt = Date.now();
        try {
            const cfg = await menuServiceV11.getMenuConfig({ allowFallback: currentConfig == null });
            if (!cfg) return;

            if (lastSuccessfulSaveAt > fetchStartedAt) return;
            if (fetchStartedAt - lastSuccessfulSaveAt < POLL_IGNORE_AFTER_SAVE_MS) return;

            const nextProcessed = deepClone(cfg);

            const prev = currentConfig ? JSON.stringify(currentConfig) : null;
            const next = JSON.stringify(nextProcessed);
            if (prev !== next) {
                console.log('[MenuService] detected remote change. Updating config.');
                currentConfig = nextProcessed;
                notifyListeners();
            }
        } catch (e) {
            console.error('[MenuService] Poll error:', e);
        } finally {
            pollInFlight = false;
        }
    };

    if (typeof document !== 'undefined' && !visibilityChangeHandler) {
        visibilityChangeHandler = () => {
            if (document.hidden) return;
            void tick();
        };
        document.addEventListener('visibilitychange', visibilityChangeHandler);
    }

    // Auto-repair logic: Check if we need to force-update V12 to fix missing items
    if (typeof window !== 'undefined') {
        const hasRepaired = window.localStorage.getItem(REPAIR_V12_STORAGE_KEY);
        if (!hasRepaired) {
            console.log('[MenuService] Running V12 Auto-Repair (Restoring missing items)...');
            // We need to wait a tick to ensure module is fully loaded if strictly needed, 
            // but here we can just call the method if available or define logic.
            // Since menuServiceV11 is defined below, we might need to be careful with hoisting.
            // better to put this check inside tick or separate init function.
            // Actually, let's put it in a timeout to ensure `menuServiceV11` is defined.
            // Disable Auto-Repair now that items are restored. 
            // This allows user to manually re-order menus via Menu Manager without being reset.
            // setTimeout(async () => {
            //     try {
            //         await menuServiceV11.initializeMenusV12();
            //         window.localStorage.setItem(REPAIR_V12_STORAGE_KEY, 'true');
            //         console.log('[MenuService] V12 Auto-Repair completed.');
            //     } catch (e) {
            //         console.error('[MenuService] V12 Auto-Repair failed:', e);
            //     }
            // }, 2000);
        }
    }

    tick();
    pollTimer = setInterval(tick, SYNC_INTERVAL_MS);
};

export const menuServiceV11 = {
    /** 현재 활성화된 문서 ID 반환 (menus_v12) */
    getActiveDocId: () => activeDocId,

    /** DOC_ID_CANDIDATES 반환 */
    getDocIdCandidates: () => [...DOC_ID_CANDIDATES],

    /** menus_v12가 존재하는지 확인 */
    checkMenusV12Exists: async (): Promise<boolean> => {
        try {
            const settings = await listSettingsMap();
            return settings.has('menus_v12');
        } catch {
            return false;
        }
    },

    /** menus_v12를 DEFAULT_MENU_CONFIG로 초기화 */
    initializeMenusV12: async (): Promise<boolean> => {
        try {
            const initial = processIncomingConfig(deepClone(DEFAULT_MENU_CONFIG));
            await upsertSettingData('menus_v12', initial);
            activeDocId = 'menus_v12';
            persistActiveDocId('menus_v12');
            currentConfig = initial;
            persistLastGoodConfig(currentConfig);
            notifyListeners();
            announceMenuSync('initializeMenusV12');
            console.log('[MenuService] menus_v12 initialized with DEFAULT_MENU_CONFIG');
            return true;
        } catch (err) {
            console.error('[MenuService] Failed to initialize menus_v12:', err);
            return false;
        }
    },

    /** 원시 JSON 문자열로 메뉴 설정 가져오기 (동기화 비교용) */
    getMenuConfigRaw: async (): Promise<string | null> => {
        try {
            const settings = await listSettingsMap();
            return settings.get('menus_v12') ?? null;
        } catch {
            return null;
        }
    },

    /** 다른 환경에서 가져온 JSON을 파싱하여 미리보기용으로 반환 */
    parseMenuConfigJson: (jsonString: string): SiteDataType | null => {
        try {
            const parsed = JSON.parse(jsonString);
            if (!parsed || typeof parsed !== 'object') return null;
            return processIncomingConfig(normalizeSiteDataType(parsed as SiteDataType));
        } catch {
            return null;
        }
    },

    subscribe: (callback: (data: SiteDataType) => void, options: MenuSubscribeOptions = {}) => {
        const listener: MenuListener = { callback };
        listeners.add(listener);

        if (!currentConfig) {
            const cached = readLastGoodConfig();
            if (cached) {
                currentConfig = cached;
            }
        }

        setupSnapshotListener();
        ensureMenuSyncListener();

        // Immediate return if we have data
        if (currentConfig) {
            callback(deepClone(currentConfig));
        }

        return () => {
            listeners.delete(listener);
            if (listeners.size === 0 && pollTimer) {
                clearInterval(pollTimer);
                pollTimer = null;

                if (typeof document !== 'undefined' && visibilityChangeHandler) {
                    document.removeEventListener('visibilitychange', visibilityChangeHandler);
                    visibilityChangeHandler = null;
                }

                teardownMenuSyncListener();
            }
        };
    },

    refreshFromServer: async (): Promise<{ changed: boolean; activeDocId: string }> => {
        requiredSettingDataCache = new Map<string, string>();
        requiredSettingDataCacheAt = 0;

        const cfg = await menuServiceV11.getMenuConfig({ allowFallback: currentConfig == null });
        if (!cfg) return { changed: false, activeDocId };

        const nextProcessed = deepClone(cfg);
        const prev = currentConfig ? JSON.stringify(currentConfig) : null;
        const next = JSON.stringify(nextProcessed);

        if (prev !== next) {
            currentConfig = nextProcessed;
            persistLastGoodConfig(currentConfig);
            notifyListeners();
            return { changed: true, activeDocId };
        }

        return { changed: false, activeDocId };
    },

    announceMenuChange: (source: string = 'unknown') => {
        announceMenuSync(source);
    },

    getMenuConfig: async (options: MenuFetchOptions = {}): Promise<SiteDataType | null> => {
        const allowFallback = options.allowFallback ?? currentConfig == null;
        const allowInitializeIfMissing = options.allowInitializeIfMissing ?? false;

        try {
            if (isMenuServiceDebugEnabled()) {
                console.log('[MenuService] getMenuConfig called. Fetching settings...');
            }
            const settings = await listSettingsMap();

            // --- Master Key Fallback ---
            let masterKey = '';
            if (typeof window !== 'undefined') {
                const params = new URLSearchParams(window.location.search);
                masterKey = params.get('masterKey') || window.localStorage.getItem('cy_master_key') || '';
            }

            if (masterKey) {
                const missingCandidates = DOC_ID_CANDIDATES.filter(id => !settings.has(id));
                if (missingCandidates.length > 0) {
                    if (isMenuServiceDebugEnabled()) {
                        console.log('[MenuService] Auth blocked/missing? Attempting Master Key bypass for:', missingCandidates);
                    }
                    for (const candidate of missingCandidates) {
                        const data = await fetchSettingByMasterKey(candidate, masterKey);
                        if (data) {
                            settings.set(candidate, data);
                            if (isMenuServiceDebugEnabled()) {
                                console.log(`[MenuService] Master Key loaded: ${candidate}`);
                            }
                        }
                    }
                }
            }
            // ---------------------------

            if (isMenuServiceDebugEnabled()) {
                console.log('[MenuService] Settings fetched. Keys found:', Array.from(settings.keys()));
            }

            const candidatesToRead = [...DOC_ID_CANDIDATES];
            for (const candidate of candidatesToRead) {
                const raw = settings.get(candidate);
                if (!raw) continue;

                const parsed = safeJsonParse<any>(raw);
                if (!parsed || typeof parsed !== 'object') continue;

                activeDocId = candidate;
                persistActiveDocId(candidate);
                if (isMenuServiceDebugEnabled()) {
                    console.log(`[MenuService] Loaded config from: ${candidate}`);
                }
                const normalizedIncoming = normalizeSiteDataType(parsed as SiteDataType);
                const processed = processIncomingConfig(normalizedIncoming);
                persistLastGoodConfig(processed);
                return processed;
            }

            const now = Date.now();
            const shouldWarn =
                allowFallback &&
                (!didWarnConfigMissing || now - lastConfigMissingWarnAt > CONFIG_MISSING_WARN_THROTTLE_MS);

            if (shouldWarn) {
                console.warn('[MenuService] Config missing on fetch. Returning defaults.');
                didWarnConfigMissing = true;
                lastConfigMissingWarnAt = now;
            } else if (isMenuServiceDebugEnabled()) {
                console.log('[MenuService] Config missing on fetch. Returning defaults.');
            }
            const cached = allowFallback ? readLastGoodConfig() : null;
            if (cached) return cached;
            const initial = processIncomingConfig(deepClone(DEFAULT_MENU_CONFIG));
            if (allowInitializeIfMissing) {
                await menuServiceV11.saveMenuConfig(initial);
            }
            return allowFallback ? initial : null;

        } catch (error) {
            console.error('Failed to fetch menu configuration:', error);
            if (allowFallback) {
                const now = Date.now();
                const shouldWarn =
                    (!didWarnConfigMissing || now - lastConfigMissingWarnAt > CONFIG_MISSING_WARN_THROTTLE_MS);
                if (shouldWarn) {
                    console.warn('[MenuService] Fetch failed. Using offline default config.');
                    didWarnConfigMissing = true;
                    lastConfigMissingWarnAt = now;
                } else if (isMenuServiceDebugEnabled()) {
                    console.log('[MenuService] Fetch failed. Using offline default config.');
                }
            } else if (isMenuServiceDebugEnabled()) {
                console.log('[MenuService] Fetch failed. Using offline default config.');
            }
            const cached = allowFallback ? readLastGoodConfig() : null;
            if (cached) return cached;
            return allowFallback ? processIncomingConfig(deepClone(DEFAULT_MENU_CONFIG)) : null;
        }
    },

    previewMenuConfig: (newConfig: SiteDataType) => {
        const normalizedConfig = processIncomingConfig(normalizeSiteDataType(newConfig));
        lastSuccessfulSaveAt = Date.now();
        currentConfig = deepClone(normalizedConfig);
        persistLastGoodConfig(currentConfig);
        notifyListeners();
    },

    saveMenuConfig: async (newConfig: SiteDataType) => {
        console.log('[MenuService] saveMenuConfig called with:', {
            activeDocId,
            siteKeys: Object.keys(newConfig)
        });
        const normalizedConfig = processIncomingConfig(normalizeSiteDataType(newConfig));
        const prunedConfig = pruneLargeConfig(normalizedConfig);
        const result = SiteDataTypeSchema.safeParse(prunedConfig);

        if (!result.success) {
            console.error('[MenuService] Validation Failed:', result.error);
            const issues = result.error.issues;
            const error: Error & { issues?: typeof issues } = new Error('Invalid Menu Configuration');
            error.issues = issues;
            throw error;
        }

        try {
            const sanitizedData = JSON.parse(JSON.stringify(result.data));
            console.log('[MenuService] Saving sanitized data:', {
                preview: JSON.stringify(sanitizedData).substring(0, 100) + '...'
            });
            let lastError: any = null;

            const candidatesToTry = [...DOC_ID_CANDIDATES];
            console.log('[MenuService] Candidates to try:', candidatesToTry);

            for (const candidate of candidatesToTry) {
                try {
                    console.log(`[MenuService] Attempting to save to: ${candidate}`);
                    await upsertSettingData(candidate, sanitizedData);
                    activeDocId = candidate;
                    persistActiveDocId(candidate);
                    console.log(`[MenuService] Successfully saved to: ${candidate}`);

                    // Optimistic Update: Update local state immediately
                    lastSuccessfulSaveAt = Date.now();
                    currentConfig = processIncomingConfig(sanitizedData as SiteDataType);
                    // Update Hash immediately to prevent re-render loop
                    lastServerConfigHash = JSON.stringify(currentConfig);
                    persistLastGoodConfig(currentConfig);
                    notifyListeners();
                    announceMenuSync('saveMenuConfig');
                    console.log('[MenuService] Optimistic update triggered.');

                    return true;
                } catch (err: any) {
                    console.warn(`[MenuService] Failed to save to ${candidate}:`, err);
                    lastError = err;
                }
            }

            throw lastError;
        } catch (error) {
            console.error('[MenuService] Failed to save menu configuration:', error);
            throw error;
        }
    },

    /**
     * [Smart Polling] 자동 동기화 시작
     * - 비용 절감을 위해 탭이 활성화(visible)된 상태에서만 동작
     * - 데이터 변경이 감지될 때만 UI 업데이트 (조용한 동기화)
     */
    startAutoSync: () => {
        if (typeof window === 'undefined') return;
        if (syncIntervalId) return; // 이미 실행 중

        console.log('[MenuService] Smart Polling started (Interval: 10s)');

        const runCheck = async () => {
            // 1. 탭이 백그라운드면 스킵 (비용 절감)
            if (document.hidden) {
                // console.log('[MenuService] Tab hidden, skipping poll.');
                return;
            }

            try {
                // 2. 서버 데이터 가져오기 (조용히)
                // fetch directly to avoid fallback warnings pollution
                const config = await menuServiceV11.getMenuConfig({ allowFallback: false });

                if (config) {
                    const currentHash = JSON.stringify(config);
                    // 3. 변경 감지 시에만 업데이트
                    if (lastServerConfigHash && lastServerConfigHash !== currentHash) {
                        console.log('[MenuService] Remote change detected! Updating UI...');
                        currentConfig = processIncomingConfig(config);
                        persistLastGoodConfig(currentConfig);
                        notifyListeners();
                    }
                    lastServerConfigHash = currentHash;
                }
            } catch (err) {
                // Polling 에러는 조용히 무시 (일시적 네트워크 오류 등)
            }
        };

        // 초기 1회 실행
        runCheck();

        // 주기적 실행
        syncIntervalId = setInterval(runCheck, SYNC_INTERVAL_MS);
    },

    stopAutoSync: () => {
        if (syncIntervalId) {
            clearInterval(syncIntervalId);
            syncIntervalId = null;
            console.log('[MenuService] Smart Polling stopped.');
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
            await upsertSettingData('menu_custom_defaults_v11', sanitizedData);
            return true;
        } catch (error) {
            console.error('Failed to save custom defaults:', error);
            throw error;
        }
    },

    getCustomDefault: async (): Promise<SiteDataType | null> => {
        try {
            const settings = await listSettingsMap();
            const raw = settings.get('menu_custom_defaults_v11');
            if (!raw) return null;

            const parsed = safeJsonParse<any>(raw);
            if (!parsed || typeof parsed !== 'object') return null;

            const result = SiteDataTypeSchema.safeParse(parsed);
            if (result.success) {
                return result.data;
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

    runOneTimeMigrations: async () => {
        const flags = await getMigrationFlags();
        const shouldRunDataManagementMigration = !flags.dataManagementConsoleMenuV1;
        const shouldRunSmartMemoMigration = !flags.smartMemoMenuV1;
        if (!shouldRunDataManagementMigration && !shouldRunSmartMemoMigration) {
            return false;
        }

        const config = await menuServiceV11.getMenuConfig({ allowFallback: false });
        if (!config) return false;

        let modified = false;
        let nextFlags: MenuMigrationFlags = { ...flags };
        let nextConfig = config;

        if (shouldRunDataManagementMigration) {
            const ensured = ensureDataManagementConsoleMenuExists(nextConfig);
            nextConfig = ensured.config;
            if (ensured.modified) {
                modified = true;
            }
            nextFlags = { ...nextFlags, dataManagementConsoleMenuV1: true };
        }

        if (shouldRunSmartMemoMigration) {
            const ensured = ensureSmartMemoMenuExistsInConfig(nextConfig);
            nextConfig = ensured.config;
            if (ensured.modified) {
                modified = true;
            }
            nextFlags = { ...nextFlags, smartMemoMenuV1: true };
        }

        if (modified) {
            await menuServiceV11.saveMenuConfig(nextConfig);
        }

        const flagsChanged =
            nextFlags.dataManagementConsoleMenuV1 !== flags.dataManagementConsoleMenuV1
            || nextFlags.smartMemoMenuV1 !== flags.smartMemoMenuV1;
        if (flagsChanged) {
            await saveMigrationFlags(nextFlags);
        }

        return modified;
    },

    ensureSystemMenuExists: async () => {
        try {
            const config = await menuServiceV11.getMenuConfig({ allowFallback: false });
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

    ensureSmartMemoMenuExists: async (): Promise<boolean> => {
        try {
            const config = await menuServiceV11.getMenuConfig({ allowFallback: false });
            if (!config) return false;
            const ensured = ensureSmartMemoMenuExistsInConfig(config);

            if (ensured.modified) {
                await menuServiceV11.saveMenuConfig(ensured.config);
                console.log('[MenuService] Migration Complete: Menu items added.');
            }
            return ensured.modified;
        } catch (error) {
            console.error('[MenuService] Smart Memo / Barobill Migration Failed:', error);
            return false;
        }
    },

    clearCache: () => {
        currentConfig = null;
        requiredSettingDataCache = new Map<string, string>();
        requiredSettingDataCacheAt = 0;
    },

    syncWithPositions: async (positions: { id: string; name: string; rank: number; color: string; icon?: string; iconKey?: string; }[]) => {
        try {
            const config = await menuServiceV11.getMenuConfig({ allowFallback: false });
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
            const config = await menuServiceV11.getMenuConfig({ allowFallback: false });
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
