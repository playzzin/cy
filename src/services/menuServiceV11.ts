import { doc, getDoc, setDoc, onSnapshot, Unsubscribe, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { MenuItem, SiteDataType } from '../types/menu';
import { DEFAULT_MENU_CONFIG } from '../constants/defaultMenu';
import { BUSINESS_PARTNER_POSITIONS, getBusinessPartnerPositionSiteKey } from '../constants/businessPartnerPositions';
import { DEFAULT_HEADER_ACTIONS } from '../constants/headerActions';
import { MENU_PATHS } from '../constants/menuPaths';
import { SiteDataTypeSchema } from '../types/menuSchema';
import { isDevAdminSessionEnabled } from '../utils/devAdminSession';
import {
    DEV_MENU_STORAGE_KEY,
    getDevMenuConfig,
    reloadDevMenuConfigFromStorage,
    setDevMenuConfig
} from '../utils/devAdminFixtures';
import { isOperationManagementMenuPath, isOperationManagementMenuText } from '../utils/operationMenuAccess';
import { permissionAuditService } from './permissionAuditService';

export type { MenuItem, SiteDataType };

const COLLECTION_NAME = 'settings';
export const MENU_DOCUMENT_ID = 'menus_v12';

const getMenuDocRef = () => doc(db, COLLECTION_NAME, MENU_DOCUMENT_ID);

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
let snapshotSetupPromise: Promise<void> | null = null;
// Menu edits replace the whole Firestore document. Keep writes strictly ordered:
// if two different saves run in parallel, a slower older write can otherwise
// finish last and silently remove the user's newest menu edit.
let saveWriteQueue: Promise<void> = Promise.resolve();
let latestQueuedSaveFingerprint: string | null = null;
let latestQueuedSavePromise: Promise<SiteDataType> | null = null;
const listeners: Set<MenuListener> = new Set();

const deepClone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const configsEqual = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

const MENU_ROLE_SURFACES = ['menu', 'headerActions', 'trash'] as const;

export interface PositionReferenceRenameResult {
    changed: boolean;
    roleReferences: number;
    positionConfigs: number;
    siteLabels: number;
}

const normalizePositionName = (value: unknown): string => String(value || '').trim();

const renameRoleListReferences = (
    roles: string[] | undefined,
    oldName: string,
    newName: string
): { roles?: string[]; changed: boolean; replacements: number } => {
    if (!Array.isArray(roles)) return { changed: false, replacements: 0 };

    let replacements = 0;
    const nextRoles = roles
        .map((role) => {
            const normalizedRole = normalizePositionName(role);
            if (normalizedRole === oldName) {
                replacements += 1;
                return newName;
            }
            return normalizedRole;
        })
        .filter(Boolean);
    const dedupedRoles = Array.from(new Set(nextRoles));
    const changed = !configsEqual(roles, dedupedRoles);

    return {
        roles: changed ? dedupedRoles : roles,
        changed,
        replacements
    };
};

const renamePositionReferencesInItems = (
    items: Array<MenuItem | string> | undefined,
    oldName: string,
    newName: string
): { changed: boolean; replacements: number } => {
    if (!Array.isArray(items)) return { changed: false, replacements: 0 };

    let changed = false;
    let replacements = 0;

    items.forEach((item) => {
        if (typeof item === 'string') return;

        const roleListResult = renameRoleListReferences(item.roles, oldName, newName);
        if (roleListResult.changed) {
            item.roles = roleListResult.roles;
            changed = true;
        }
        replacements += roleListResult.replacements;

        const subResult = renamePositionReferencesInItems(item.sub, oldName, newName);
        if (subResult.changed) changed = true;
        replacements += subResult.replacements;
    });

    return { changed, replacements };
};

export const renamePositionReferencesInMenuConfig = (
    config: SiteDataType,
    oldNameInput: string,
    newNameInput: string
): PositionReferenceRenameResult => {
    const oldName = normalizePositionName(oldNameInput);
    const newName = normalizePositionName(newNameInput);
    const result: PositionReferenceRenameResult = {
        changed: false,
        roleReferences: 0,
        positionConfigs: 0,
        siteLabels: 0
    };

    if (!oldName || !newName || oldName === newName || !config) return result;

    Object.entries(config).forEach(([siteKey, site]: [string, any]) => {
        if (!site || typeof site !== 'object') return;

        if (siteKey.startsWith('pos_') && normalizePositionName(site.name) === oldName) {
            site.name = newName;
            result.siteLabels += 1;
            result.changed = true;
        }

        if (Array.isArray(site.positionConfig)) {
            site.positionConfig.forEach((position: any) => {
                if (normalizePositionName(position?.name) !== oldName) return;
                position.name = newName;
                result.positionConfigs += 1;
                result.changed = true;
            });
        }

        MENU_ROLE_SURFACES.forEach((surface) => {
            const itemsResult = renamePositionReferencesInItems(site[surface], oldName, newName);
            if (itemsResult.changed) result.changed = true;
            result.roleReferences += itemsResult.replacements;
        });
    });

    return result;
};
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
    "\ubc14\uc774\ubc31",
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

const RETIRED_HARDCODED_MENU_SEED_IDS = new Set([
    createDeterministicId(['admin/\uc0ac\uc9c4 \uac70\ub798\ucc98 \ub4f1\ub85d']),
    createDeterministicId(['admin/\uba85\ud568/\ub2f4\ub2f9\uc790 \uad00\ub9ac']),
    'office_partner_photo_registration',
    'office_business_card_contacts'
]);

const normalizePositionIdForCleanup = (value: unknown): string =>
    String(value || '').trim().toLowerCase().replace(/[\s_-]/g, '');

const DUPLICATE_POSITION_MENU_IDS = new Set(['teamlead', 'foreman', 'general']);
const DUPLICATE_POSITION_SITE_KEYS = new Set(['pos_teamLead', 'pos_foreman', 'pos_general']);

const OFFICE_POSITION_CONFIG = {
    id: 'office',
    name: '\uc0ac\ubb34\uc2e4',
    icon: 'fa-building-user',
    color: 'from-sky-600 to-cyan-400',
    order: 4.5
};

const OFFICE_MENU_ITEMS: MenuItem[] = [
    {
        id: 'office_dashboard',
        text: '\uc0ac\ubb34\uc2e4 \uc6b4\uc601 \ub300\uc2dc\ubcf4\ub4dc',
        icon: 'fa-chart-line',
        path: '/office/dashboard'
    },
    {
        id: 'office_request_center',
        text: '\uc2e0\uccad \uc2b9\uc778\uc13c\ud130',
        icon: 'fa-inbox',
        path: '/office/request-center'
    },
    {
        id: 'office_daily_review',
        text: '\uc77c\ubcf4 \uac80\uc218',
        icon: 'fa-clipboard-check',
        path: '/office/daily-review'
    },
    {
        id: 'office_worker_documents',
        text: '\uacc4\uc88c / \uc11c\ub958 \uad00\ub9ac',
        icon: 'fa-id-card',
        path: '/office/worker-documents'
    },
    {
        id: 'office_communications',
        text: '\uacf5\uc9c0 / \uba54\uc2dc\uc9c0 \ubc1c\uc1a1',
        icon: 'fa-bullhorn',
        path: '/office/communications'
    },
    {
        id: 'office_payroll_check',
        text: '\uae09\uc5ec \uc9c0\uae09 \uc804 \ud655\uc778',
        icon: 'fa-money-check-dollar',
        path: '/office/payroll-check'
    },
    {
        id: 'office_audit_log',
        text: '\ucc98\ub9ac \uc774\ub825 / \ub85c\uadf8',
        icon: 'fa-clock-rotate-left',
        path: '/office/audit-log'
    }
];

const OFFICE_MENU_PATHS = new Set(OFFICE_MENU_ITEMS.map((item) => item.path).filter(Boolean) as string[]);
const LEGACY_OFFICE_MENU_TEXTS = new Set([
    '\uc77c\uc815 / \ubc30\uc815 \uad00\ub9ac',
    '\ucd9c\uc5ed / \uc77c\ubcf4 \uac80\uc218',
    '\uc791\uc5c5\uc790 / \uc11c\ub958 \uad00\ub9ac',
    '\uae09\uc5ec / \uac00\ubd88 \ucc98\ub9ac',
    '\uacbd\ube44 / \ubb3c\ud488 \uc694\uccad \uad00\ub9ac',
    '\uacf5\uc9c0 / \uba54\uc2dc\uc9c0',
    '\uc18c\uac1c\uc18c'
]);

const RECRUITING_MENU_PATH_PREFIX = '/recruiting';
const RECRUITING_FOLDER_TEXTS = new Set(['\uc18c\uac1c\uc18c', '\uc18c\uac1c\uc18c \uba54\ub274']);
const RECRUITING_MENU_TEXTS = new Set([
    '\uc18c\uac1c\uc18c \ud604\ud669\ud310',
    '\uc6a9\uc5ed \ub4f1\ub85d',
    '\uc6a9\uc5ed \ub4f1\ub85d/\uc218\uc815',
    '\uc791\uc5c5\uc790 \uc774\ub825\uad00\ub9ac',
    '\uc18c\uac1c\uc18c \uc6d4\ubcc4 \uc815\uc0b0',
    '\uc18c\uac1c\uc18c \uc9c0\uae09\uad00\ub9ac',
    '\uc18c\uac1c\uc18c \uc785\uae08\uad00\ub9ac',
    '\uc18c\uac1c\uc18c \ubbf8\uc218\uae08\uad00\ub9ac',
    '\uc18c\uac1c\uc18c \uc6d4\ubcc4 \ud1b5\uacc4',
    '\uc18c\uac1c\uc790 \uad00\ub9ac',
    '\uc218\uc775\ubaa8\ub378 \uad00\ub9ac',
    '\uc18c\uac1c\uc18c \uc815\uc0b0 \ub85c\uadf8'
]);

const officeMenuContainsLegacyArtifacts = (items: (MenuItem | string)[] = []): boolean =>
    items.some((item) => {
        if (typeof item === 'string') {
            return LEGACY_OFFICE_MENU_TEXTS.has(item);
        }

        if (LEGACY_OFFICE_MENU_TEXTS.has(item.text)) {
            return true;
        }

        return Array.isArray(item.sub) ? officeMenuContainsLegacyArtifacts(item.sub) : false;
    });

const officeMenuHasDuplicateSeedRoutes = (items: (MenuItem | string)[] = [], seen = new Set<string>()): boolean => {
    for (const item of items) {
        if (typeof item === 'string') continue;

        if (item.path && OFFICE_MENU_PATHS.has(item.path)) {
            if (seen.has(item.path)) return true;
            seen.add(item.path);
        }

        if (Array.isArray(item.sub) && officeMenuHasDuplicateSeedRoutes(item.sub, seen)) {
            return true;
        }
    }

    return false;
};

const removeDuplicatePositionMenuArtifacts = (config: SiteDataType): boolean => {
    let changed = false;

    DUPLICATE_POSITION_SITE_KEYS.forEach((siteKey) => {
        if (Object.prototype.hasOwnProperty.call(config, siteKey)) {
            delete config[siteKey];
            changed = true;
        }
    });

    const adminSite: any = config.admin;
    if (Array.isArray(adminSite?.positionConfig)) {
        const nextPositionConfig = adminSite.positionConfig.filter((position: any) => {
            const id = normalizePositionIdForCleanup(position?.id);
            const siteKey = normalizePositionIdForCleanup(position?.siteKey || position?.menuKey || position?.siteId);
            return !DUPLICATE_POSITION_MENU_IDS.has(id) && !DUPLICATE_POSITION_MENU_IDS.has(siteKey);
        });

        if (nextPositionConfig.length !== adminSite.positionConfig.length) {
            adminSite.positionConfig = nextPositionConfig;
            changed = true;
        }
    }

    return changed;
};

const removeRetiredHardcodedMenuSeeds = (config: SiteDataType): boolean => {
    let changed = false;

    const filterItems = (items: (MenuItem | string)[]): (MenuItem | string)[] => {
        return items.reduce<(MenuItem | string)[]>((acc, item) => {
            if (typeof item === 'string') {
                acc.push(item);
                return acc;
            }

            if (item.id && RETIRED_HARDCODED_MENU_SEED_IDS.has(item.id)) {
                changed = true;
                return acc;
            }

            if (Array.isArray(item.sub)) {
                const nextSub = filterItems(item.sub);
                if (nextSub.length !== item.sub.length) {
                    item.sub = nextSub;
                }
            }

            acc.push(item);
            return acc;
        }, []);
    };

    Object.values(config).forEach((site) => {
        if (!site || !Array.isArray(site.menu)) return;
        const nextMenu = filterItems(site.menu);
        if (nextMenu.length !== site.menu.length) {
            site.menu = nextMenu as MenuItem[];
        }
    });

    return changed;
};

const ensureOfficeMenuPages = (config: SiteDataType): boolean => {
    let changed = false;
    const adminSite: any = config.admin;

    if (adminSite && Array.isArray(adminSite.positionConfig)) {
        const existingIndex = adminSite.positionConfig.findIndex(
            (position: any) => normalizePositionIdForCleanup(position?.id) === 'office'
        );

        if (existingIndex >= 0) {
            const nextOfficePosition = {
                ...OFFICE_POSITION_CONFIG,
                ...adminSite.positionConfig[existingIndex],
                id: OFFICE_POSITION_CONFIG.id,
                name: adminSite.positionConfig[existingIndex].name || OFFICE_POSITION_CONFIG.name,
                icon: adminSite.positionConfig[existingIndex].icon || OFFICE_POSITION_CONFIG.icon,
                color: adminSite.positionConfig[existingIndex].color || OFFICE_POSITION_CONFIG.color,
                order: typeof adminSite.positionConfig[existingIndex].order === 'number'
                    ? adminSite.positionConfig[existingIndex].order
                    : OFFICE_POSITION_CONFIG.order
            };
            if (!configsEqual(adminSite.positionConfig[existingIndex], nextOfficePosition)) {
                adminSite.positionConfig[existingIndex] = nextOfficePosition;
                changed = true;
            }
        } else {
            adminSite.positionConfig = [...adminSite.positionConfig, OFFICE_POSITION_CONFIG]
                .sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
            changed = true;
        }
    }

    const existingOfficeSite = config.pos_office;
    const existingOfficeMenu = Array.isArray(existingOfficeSite?.menu) ? existingOfficeSite.menu : [];
    const shouldSeedOfficeMenu =
        !existingOfficeSite ||
        existingOfficeMenu.length === 0 ||
        officeMenuContainsLegacyArtifacts(existingOfficeMenu) ||
        officeMenuHasDuplicateSeedRoutes(existingOfficeMenu);

    const nextOfficeSite = {
        ...(existingOfficeSite || {}),
        name: existingOfficeSite?.name || '\uc0ac\ubb34\uc2e4 \uba54\ub274',
        icon: existingOfficeSite?.icon || 'fa-building-user',
        menu: shouldSeedOfficeMenu ? deepClone(OFFICE_MENU_ITEMS) : existingOfficeMenu,
        headerActions: Array.isArray(existingOfficeSite?.headerActions) ? existingOfficeSite.headerActions : [],
        deletedItems: Array.isArray(existingOfficeSite?.deletedItems) ? existingOfficeSite.deletedItems : []
    };

    if (!configsEqual(config.pos_office, nextOfficeSite)) {
        config.pos_office = nextOfficeSite;
        changed = true;
    }

    return changed;
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

    if (isOperationManagementMenuPath(next.path) || isOperationManagementMenuText(next.text)) {
        delete next.roles;
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

const getMenuItemText = (item: MenuItem | string): string =>
    typeof item === 'string' ? item : item.text;

const getMenuItemPath = (item: MenuItem | string): string | undefined => {
    const text = getMenuItemText(item);
    return typeof item === 'string' ? MENU_PATHS[text] : item.path || MENU_PATHS[text];
};

const LOG_MANAGEMENT_FOLDER_TEXT = '로그관리';
const REQUIRED_LOG_MANAGEMENT_ITEMS: MenuItem[] = [
    { text: '권한 변경 로그', icon: 'fa-shield-halved', path: '/admin/permission-change-logs' },
    { text: '엑셀 업로드·다운로드 로그', icon: 'fa-file-excel', path: '/admin/excel-transfer-logs' },
    { text: 'PDF 업로드·다운로드 로그', icon: 'fa-file-pdf', path: '/admin/pdf-transfer-logs' },
    { text: '자동 메시지 발송 로그', icon: 'fa-paper-plane', path: '/messages/automation-logs' }
];

const isLogManagementFolder = (item: MenuItem): boolean =>
    item.text.replace(/\s+/g, '') === LOG_MANAGEMENT_FOLDER_TEXT;

const findLogManagementFolders = (items: Array<MenuItem | string>, result: MenuItem[] = []): MenuItem[] => {
    items.forEach((item) => {
        if (typeof item === 'string') return;
        if (isLogManagementFolder(item)) result.push(item);
        if (Array.isArray(item.sub)) findLogManagementFolders(item.sub, result);
    });

    return result;
};

const ensureRequiredLogManagementItems = (config: SiteDataType): boolean => {
    let changed = false;

    Object.values(config).forEach((site) => {
        if (!site || !Array.isArray(site.menu)) return;

        findLogManagementFolders(site.menu).forEach((folder) => {
            const children = Array.isArray(folder.sub) ? folder.sub : [];
            const missingItems = REQUIRED_LOG_MANAGEMENT_ITEMS.filter((requiredItem) => !children.some((child) => {
                const childText = getMenuItemText(child);
                const childPath = getMenuItemPath(child);
                return childText === requiredItem.text || childPath === requiredItem.path;
            }));

            if (missingItems.length === 0) return;
            folder.sub = [...children, ...missingItems.map((item) => ({ ...item }))];
            changed = true;
        });
    });

    return changed;
};

const isRecruitingMenuItem = (item: MenuItem | string): boolean => {
    if (RECRUITING_MENU_TEXTS.has(getMenuItemText(item))) return true;
    const path = getMenuItemPath(item);
    if (typeof path === 'string' && path.startsWith(RECRUITING_MENU_PATH_PREFIX)) return true;
    if (typeof item !== 'string' && Array.isArray(item.sub)) {
        return item.sub.some(isRecruitingMenuItem);
    }
    return false;
};

const removeRecruitingMenuItems = (items: (MenuItem | string)[]): { items: (MenuItem | string)[]; removed: boolean } => {
    let removed = false;
    const nextItems: (MenuItem | string)[] = [];

    items.forEach((item) => {
        if (typeof item === 'string') {
            if (isRecruitingMenuItem(item)) {
                removed = true;
                return;
            }
            nextItems.push(item);
            return;
        }

        if (RECRUITING_FOLDER_TEXTS.has(item.text)) {
            removed = true;
            return;
        }

        if ((!Array.isArray(item.sub) || item.sub.length === 0) && isRecruitingMenuItem(item)) {
            removed = true;
            return;
        }

        if (Array.isArray(item.sub) && item.sub.length > 0) {
            const childResult = removeRecruitingMenuItems(item.sub);
            if (childResult.removed) {
                removed = true;
                if (childResult.items.length === 0 && isRecruitingMenuItem(item)) {
                    return;
                }
                nextItems.push({ ...item, sub: childResult.items });
                return;
            }
        }

        nextItems.push(item);
    });

    return { items: nextItems, removed };
};

const removeRecruitingMenuItemsFromAllSites = (config: SiteDataType): boolean => {
    let changed = false;

    Object.values(config).forEach((site) => {
        if (!site || !Array.isArray(site.menu)) return;

        const result = removeRecruitingMenuItems(site.menu);
        if (!result.removed) return;
        site.menu = result.items as MenuItem[];
        changed = true;
    });

    return changed;
};

const ensureBusinessPartnerPositionMenus = (config: SiteDataType): boolean => {
    let changed = false;
    const adminSite: any = config.admin;

    if (adminSite) {
        const currentPositionConfig = Array.isArray(adminSite.positionConfig)
            ? adminSite.positionConfig
            : [];

        let nextPositionConfig = [...currentPositionConfig];
        BUSINESS_PARTNER_POSITIONS.forEach((position) => {
            const existingIndex = nextPositionConfig.findIndex(
                (item: any) => normalizePositionIdForCleanup(item?.id) === normalizePositionIdForCleanup(position.id)
            );
            const positionConfig = {
                id: position.id,
                name: position.name,
                icon: position.iconKey,
                color: position.menuColor,
                order: position.order,
            };

            if (existingIndex >= 0) {
                const existing = nextPositionConfig[existingIndex] || {};
                const next = {
                    ...positionConfig,
                    ...existing,
                    id: position.id,
                    name: existing.name || positionConfig.name,
                    icon: existing.icon || positionConfig.icon,
                    color: existing.color || positionConfig.color,
                    order: typeof existing.order === 'number' ? existing.order : positionConfig.order,
                };
                if (!configsEqual(existing, next)) {
                    nextPositionConfig[existingIndex] = next;
                    changed = true;
                }
            } else {
                nextPositionConfig.push(positionConfig);
                changed = true;
            }
        });

        nextPositionConfig = nextPositionConfig.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
        if (!configsEqual(currentPositionConfig, nextPositionConfig)) {
            adminSite.positionConfig = nextPositionConfig;
            changed = true;
        }
    }

    BUSINESS_PARTNER_POSITIONS.forEach((position) => {
        const siteKey = getBusinessPartnerPositionSiteKey(position.id);
        const existingSite = config[siteKey];
        const existingMenu = Array.isArray(existingSite?.menu) ? existingSite.menu : [];
        const nextSite = {
            ...(existingSite || {}),
            name: existingSite?.name || position.name,
            icon: existingSite?.icon || position.iconKey,
            menu: existingMenu.length > 0 ? existingMenu : deepClone(position.menu),
            headerActions: Array.isArray(existingSite?.headerActions) ? existingSite.headerActions : [],
            deletedItems: Array.isArray(existingSite?.deletedItems) ? existingSite.deletedItems : [],
        };

        if (!configsEqual(config[siteKey], nextSite)) {
            config[siteKey] = nextSite;
            changed = true;
        }
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

    removeDuplicatePositionMenuArtifacts(final);
    ensureBusinessPartnerPositionMenus(final);
    removeRecruitingMenuItemsFromAllSites(final);
    ensureOfficeMenuPages(final);
    removeRetiredHardcodedMenuSeeds(final);
    ensureRequiredLogManagementItems(final);

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
    if (unsubscribeSnapshot || snapshotSetupPromise) return;

    snapshotSetupPromise = Promise.resolve().then(() => {
        if (listeners.size === 0) return;
        if (unsubscribeSnapshot) return;

        unsubscribeSnapshot = onSnapshot(
            getMenuDocRef(),
            (snapshot) => {
                if (!snapshot.exists()) {
                    console.warn('[MenuService] Configuration missing. Initializing with defaults...');
                    const processedInitial = processIncomingConfig(deepClone(DEFAULT_MENU_CONFIG));

                    currentRawConfig = processedInitial;
                    currentConfig = processedInitial;

                    menuServiceV11.saveMenuConfig(processedInitial).catch(err => {
                        console.error('[MenuService] Failed to auto-initialize menu config:', err);
                    });

                    notifyListeners();
                    return;
                }

                const normalizedIncoming = normalizeSiteDataType(snapshot.data() as SiteDataType);
                currentRawConfig = deepClone(normalizedIncoming);
                currentConfig = processIncomingConfig(normalizedIncoming);
                notifyListeners();
            },
            (error) => {
                console.error('[MenuService] Snapshot listener error:', error);
            }
        );
    })
        .catch((error) => {
            console.error('[MenuService] Failed to subscribe to menus_v12:', error);
        })
        .finally(() => {
            snapshotSetupPromise = null;
        });
};

export const menuServiceV11 = {
    subscribe: (callback: (data: SiteDataType) => void, options: MenuSubscribeOptions = {}) => {
        const listener: MenuListener = { callback };
        listeners.add(listener);

        if (isDevAdminSessionEnabled()) {
            currentConfig = processIncomingConfig(getDevMenuConfig());
            currentRawConfig = deepClone(currentConfig);
            callback(deepClone(currentConfig));

            const handleDevMenuStorageChange = (event: StorageEvent) => {
                if (event.key !== DEV_MENU_STORAGE_KEY) return;

                const refreshedConfig = processIncomingConfig(reloadDevMenuConfigFromStorage());
                currentConfig = refreshedConfig;
                currentRawConfig = deepClone(refreshedConfig);
                callback(deepClone(refreshedConfig));
            };

            window.addEventListener('storage', handleDevMenuStorageChange);
            return () => {
                window.removeEventListener('storage', handleDevMenuStorageChange);
                listeners.delete(listener);
            };
        }

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
        if (isDevAdminSessionEnabled()) {
            return processIncomingConfig(getDevMenuConfig());
        }

        try {
            const snapshot = await getDoc(getMenuDocRef());
            if (snapshot.exists()) {
                const rawConfig = normalizeSiteDataType(snapshot.data() as SiteDataType);
                currentRawConfig = deepClone(rawConfig);
                currentConfig = processIncomingConfig(rawConfig);
                return deepClone(currentConfig);
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
        if (isDevAdminSessionEnabled()) {
            setDevMenuConfig(processIncomingConfig(newConfig));
            currentConfig = getDevMenuConfig();
            currentRawConfig = getDevMenuConfig();
            notifyListeners();
            return deepClone(currentConfig);
        }

        const normalizedConfig = processIncomingConfig(normalizeSiteDataType(newConfig));
        const prunedConfig = pruneLargeConfig(normalizedConfig);
        const result = SiteDataTypeSchema.safeParse(prunedConfig);

        if (!result.success) {
            const issues = result.error.issues;
            const error: Error & { issues?: typeof issues } = new Error('Invalid Menu Configuration');
            error.issues = issues;
            throw error;
        }

        let ownedSaveFingerprint: string | null = null;
        let ownedSavePromise: Promise<SiteDataType> | null = null;

        try {
            const sanitizedData = JSON.parse(JSON.stringify(result.data));
            const saveFingerprint = JSON.stringify(sanitizedData);

            if (latestQueuedSavePromise && latestQueuedSaveFingerprint === saveFingerprint) {
                return await latestQueuedSavePromise;
            }

            const nextSavePromise = saveWriteQueue
                .catch(() => undefined)
                .then(async () => {
                    const previousConfig = currentRawConfig ? deepClone(currentRawConfig) : null;

                    // Full replacement keeps Firestore in sync with the menu editor after deletions.
                    await setDoc(getMenuDocRef(), sanitizedData);
                    currentRawConfig = deepClone(sanitizedData as SiteDataType);
                    currentConfig = processIncomingConfig(normalizeSiteDataType(sanitizedData as SiteDataType));

                    // Do not wait for the Firestore snapshot to make the sidebar consistent.
                    // The snapshot remains the cross-tab/server source of truth.
                    notifyListeners();

                    try {
                        await permissionAuditService.logMenuAccessChanges(previousConfig, sanitizedData as SiteDataType);
                    } catch (auditError) {
                        // The menu write already succeeded. An audit failure must not make the
                        // editor report that the menu itself was lost.
                        console.error('Failed to audit menu configuration change:', auditError);
                    }

                    return deepClone(currentConfig);
                });

            saveWriteQueue = nextSavePromise.then(() => undefined, () => undefined);
            latestQueuedSaveFingerprint = saveFingerprint;
            latestQueuedSavePromise = nextSavePromise;
            ownedSaveFingerprint = saveFingerprint;
            ownedSavePromise = nextSavePromise;

            return await nextSavePromise;
        } catch (error) {
            console.error('Failed to save menu configuration:', error);
            throw error;
        } finally {
            if (
                ownedSavePromise &&
                latestQueuedSavePromise === ownedSavePromise &&
                latestQueuedSaveFingerprint === ownedSaveFingerprint
            ) {
                latestQueuedSaveFingerprint = null;
                latestQueuedSavePromise = null;
            }
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

    renamePositionReferences: async (oldName: string, newName: string): Promise<PositionReferenceRenameResult> => {
        const emptyResult: PositionReferenceRenameResult = {
            changed: false,
            roleReferences: 0,
            positionConfigs: 0,
            siteLabels: 0
        };

        try {
            const config = await menuServiceV11.getMenuConfig();
            if (!config) return emptyResult;

            const result = renamePositionReferencesInMenuConfig(config, oldName, newName);
            if (result.changed) {
                await menuServiceV11.saveMenuConfig(config);
                console.log('[MenuService] Renamed position references in menu config.', {
                    oldName,
                    newName,
                    ...result
                });
            }

            return result;
        } catch (error) {
            console.error('[MenuService] Position reference rename failed:', error);
            throw error;
        }
    },

    syncWithPositions: async (positions: { id: string; legacyId?: string; name: string; rank: number; color: string; icon?: string; iconKey?: string; }[]) => {
        try {
            const config = await menuServiceV11.getMenuConfig();
            if (!config || !config.admin) return;

            let modified = false;

            const positionsById = new Map<string, typeof positions[number]>();
            positions.forEach((position) => {
                if (position.id) positionsById.set(position.id, position);
                if (position.legacyId) positionsById.set(position.legacyId, position);
            });
            const currentPositionConfig = Array.isArray(config.admin.positionConfig)
                ? config.admin.positionConfig
                : [];

            const nextPositionConfig = currentPositionConfig.map((position: any) => {
                const source = typeof position?.id === 'string' ? positionsById.get(position.id) : undefined;
                if (!source || position.id === 'full') return position;

                return {
                    ...position,
                    name: source.name || position.name,
                    icon: source.iconKey || source.icon || position.icon || 'fa-user',
                    color: source.color || position.color,
                    order: typeof position.order === 'number' ? position.order : (source.rank || 0) + 1
                };
            });

            if (JSON.stringify(currentPositionConfig) !== JSON.stringify(nextPositionConfig)) {
                config.admin.positionConfig = nextPositionConfig;
                modified = true;
            }

            nextPositionConfig.forEach((position: any) => {
                if (!position?.id || position.id === 'full') return;
                const source = positionsById.get(position.id);
                if (!source) return;

                const siteKey = position.id.startsWith('pos_') ? position.id : `pos_${position.id}`;
                const site = config[siteKey];
                if (!site) return;

                const nextIcon = source.iconKey || source.icon || site.icon || 'fa-user';
                if (site.name !== source.name || site.icon !== nextIcon) {
                    site.name = source.name;
                    site.icon = nextIcon;
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
        await menuServiceV11.getMenuConfig();
        return { changed: false, activeDocId: MENU_DOCUMENT_ID };
    },
    announceMenuChange: (_source?: string): void => { /* no-op */ },
    checkMenusV12Exists: async (): Promise<boolean> => {
        try { return (await getDoc(getMenuDocRef())).exists(); } catch { return false; }
    },
    getActiveDocId: (): string => MENU_DOCUMENT_ID,
    initializeMenusV12: async (): Promise<void> => {
        await menuServiceV11.saveMenuConfig(DEFAULT_MENU_CONFIG);
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
            const removedRecruitingMenus = removeRecruitingMenuItemsFromAllSites(config);
            const ensuredNationSite = ensureCanonicalNationSiteConfig(config);
            const normalizedSupportAssetMenu = normalizeSupportAssetMenu(config);
            const changed = addedNationwidePage || addedNoticeBoard || removedRecruitingMenus || ensuredNationSite || normalizedSupportAssetMenu;
            if (changed) {
                await menuServiceV11.saveMenuConfig(config);
            }
        } catch (error: any) {
            console.error('[MenuService] runOneTimeMigrations failed:', error);
        }
    },
};
