import { useCallback, useEffect, useMemo, useState } from 'react';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faChartPie } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useSiteMode } from '../../contexts/SiteModeContext';
import { MENU_PATHS } from '../../constants/menuPaths';
import { resolveIcon } from '../../constants/iconMap';
import type { MenuItem } from '../../types/menu';
import type { DashboardAction, DashboardModeConfig } from './roleDashboardConfig';
import { filterDashboardActionsByAccess } from '../../utils/dashboardAccess';
import {
    dashboardQuickMenuService,
    type DashboardQuickMenuPreferenceMap,
} from '../../services/dashboardQuickMenuService';

export interface QuickMenuAction extends DashboardAction {
    key: string;
    openInNewTab?: boolean;
}

export const DEFAULT_QUICK_ACTION_LIMIT = 8;
export const MAX_QUICK_ACTIONS = 12;

export interface QuickMenuActionSettings {
    actions: QuickMenuAction[];
    availableActions: QuickMenuAction[];
    selectedKeys: string[];
    defaultSelectedKeys: string[];
    hasPersonalSelection: boolean;
    loading: boolean;
    saving: boolean;
    maxActions: number;
    saveSelection: (keys: string[]) => Promise<void>;
    resetSelection: () => Promise<void>;
}

const getMenuDisplayText = (text: string): string => {
    return text;
};

const createActionKey = (params: {
    id?: string;
    label: string;
    path: string;
    parents?: string[];
}): string => {
    const id = typeof params.id === 'string' ? params.id.trim() : '';
    if (id) return `menu:${id}`;

    const parentKey = params.parents?.join('/') || '';
    return `path:${params.path}|label:${params.label}|parent:${parentKey}`;
};

const inferIconName = (text: string, path?: string, explicitIcon?: string): string => {
    const icon = typeof explicitIcon === 'string' ? explicitIcon.trim() : '';
    if (icon) return icon;

    const normalizedPath = typeof path === 'string' ? path.split('?')[0] : '';
    if (normalizedPath.startsWith('/settlement')) return 'fa-triangle-exclamation';
    if (normalizedPath.startsWith('/payroll/taxinvoice')) return 'fa-file-invoice-dollar';
    if (normalizedPath.startsWith('/payroll')) return 'fa-money-bill-wave';
    if (normalizedPath.startsWith('/reports') || normalizedPath.startsWith('/report')) return 'fa-clipboard-list';
    if (normalizedPath.startsWith('/database')) return 'fa-database';
    if (normalizedPath.startsWith('/materials')) return 'fa-cart-shopping';
    if (normalizedPath.startsWith('/support/vehicles')) return 'fa-truck-front';
    if (normalizedPath.startsWith('/support')) return 'fa-hand-holding-dollar';
    if (normalizedPath.startsWith('/assignment')) return 'fa-list-check';
    if (normalizedPath.startsWith('/manpower')) return 'fa-users';
    if (normalizedPath.startsWith('/hr')) return 'fa-user-tag';
    if (normalizedPath.startsWith('/settings') || normalizedPath.startsWith('/admin')) return 'fa-gears';
    if (normalizedPath.startsWith('/storage')) return 'fa-hard-drive';
    if (normalizedPath.startsWith('/gallery')) return 'fa-photo-film';
    if (normalizedPath.startsWith('/company')) return 'fa-building';
    if (normalizedPath === '/todo') return 'fa-list-check';

    const compactText = text.replace(/\s+/g, '');
    if (/DB/.test(compactText)) return 'fa-database';
    return 'fa-chart-pie';
};

const inferColor = (path: string, index: number): string => {
    const normalizedPath = path.split('?')[0];
    if (normalizedPath.startsWith('/settlement')) return 'rose';
    if (normalizedPath.startsWith('/reports') || normalizedPath.startsWith('/report')) return 'orange';
    if (normalizedPath.startsWith('/database')) return 'blue';
    if (normalizedPath.startsWith('/payroll')) return 'emerald';
    if (normalizedPath.startsWith('/support')) return 'teal';
    if (normalizedPath.startsWith('/materials')) return 'amber';
    if (normalizedPath.startsWith('/admin') || normalizedPath.startsWith('/settings')) return 'gray';
    if (normalizedPath.startsWith('/assignment')) return 'violet';
    if (normalizedPath.startsWith('/storage')) return 'slate';

    const fallbackColors = ['brand', 'green', 'cyan', 'purple', 'sky', 'rose'];
    return fallbackColors[index % fallbackColors.length];
};

const shouldOpenInNewTab = (path: string): boolean => {
    const [, search] = path.split('?');
    if (!search) return false;
    const params = new URLSearchParams(search);
    return params.get('newTab') === '1' || params.get('newTab') === 'true';
};

const flattenMenuActions = (
    items: MenuItem[],
    fallbackIcon: IconDefinition,
    parents: string[] = []
): QuickMenuAction[] => {
    const actions: QuickMenuAction[] = [];

    items.forEach((item) => {
        if (item.hide) return;

        const path = item.path || MENU_PATHS[item.text];
        const label = getMenuDisplayText(item.text);
        const nextParents = [...parents, label];

        if (path) {
            actions.push({
                key: createActionKey({
                    id: item.id,
                    label,
                    path,
                    parents,
                }),
                label,
                desc: parents.length > 0 ? parents.join(' > ') : label,
                path,
                icon: resolveIcon(inferIconName(item.text, path, item.icon), fallbackIcon || faChartPie),
                color: inferColor(path, actions.length),
                openInNewTab: shouldOpenInNewTab(path),
            });
        }

        if (item.sub?.length) {
            const childItems = item.sub.flatMap((subItem): MenuItem[] => {
                if (typeof subItem === 'string') {
                    const childPath = MENU_PATHS[subItem];
                    return childPath ? [{ text: subItem, path: childPath }] : [];
                }
                return [subItem];
            });
            actions.push(...flattenMenuActions(childItems, fallbackIcon, nextParents));
        }
    });

    return actions;
};

const createFallbackActions = (actions: DashboardAction[]): QuickMenuAction[] => {
    return actions.map((action) => ({
        ...action,
        key: createActionKey({
            label: action.label,
            path: action.path,
        }),
        openInNewTab: shouldOpenInNewTab(action.path),
    }));
};

const dedupeActions = (actions: QuickMenuAction[]): QuickMenuAction[] => {
    const seen = new Set<string>();
    const seenRoute = new Set<string>();

    return actions.filter((action) => {
        const routeKey = `${action.path}::${action.label}`;
        const key = action.key || routeKey;
        if (seen.has(key) || seenRoute.has(routeKey)) return false;
        seen.add(key);
        seenRoute.add(routeKey);
        return true;
    });
};

export const buildQuickMenuActions = (
    modeConfig: DashboardModeConfig,
    menuItems?: MenuItem[]
): QuickMenuAction[] => {
    const menuActions = menuItems?.length
        ? flattenMenuActions(menuItems, modeConfig.icon)
        : [];

    const deduped = dedupeActions(menuActions);
    return deduped.length > 0 ? deduped : createFallbackActions(modeConfig.quickActions);
};

export const useQuickMenuActionSettings = (modeConfig: DashboardModeConfig): QuickMenuActionSettings => {
    const { currentUser } = useAuth();
    const { currentSiteData, currentPosition, currentPositionData } = useSiteMode();
    const [preferences, setPreferences] = useState<DashboardQuickMenuPreferenceMap>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const uid = currentUser?.uid;
        if (!uid) {
            setPreferences({});
            setLoading(false);
            return;
        }

        setLoading(true);
        return dashboardQuickMenuService.subscribe(uid, (nextPreferences) => {
            setPreferences(nextPreferences);
            setLoading(false);
        });
    }, [currentUser?.uid]);

    const availableActions = useMemo(() => {
        return filterDashboardActionsByAccess(
            buildQuickMenuActions(modeConfig, currentSiteData?.menu),
            [currentPosition, currentPositionData?.name, modeConfig.id, modeConfig.shortLabel]
        );
    }, [currentPosition, currentPositionData?.name, currentSiteData?.menu, modeConfig]);

    const actionByKey = useMemo(() => {
        return new Map(availableActions.map((action) => [action.key, action]));
    }, [availableActions]);

    const positionId = currentPosition || modeConfig.id;
    const positionKey = dashboardQuickMenuService.getPositionKey(positionId);
    const savedKeys = preferences[positionKey]?.selectedKeys || [];
    const validSavedKeys = savedKeys.filter((key) => actionByKey.has(key));
    const hasPersonalSelection = validSavedKeys.length > 0;
    const defaultActions = availableActions.slice(0, DEFAULT_QUICK_ACTION_LIMIT);
    const defaultSelectedKeys = defaultActions.map((action) => action.key);
    const selectedKeys = hasPersonalSelection ? validSavedKeys : defaultSelectedKeys;
    const actions = selectedKeys
        .map((key) => actionByKey.get(key))
        .filter((action): action is QuickMenuAction => Boolean(action));

    const saveSelection = useCallback(async (keys: string[]) => {
        const uid = currentUser?.uid;
        if (!uid) throw new Error('missing-user');

        const cleanedKeys = Array.from(new Set(keys))
            .filter((key) => actionByKey.has(key))
            .slice(0, MAX_QUICK_ACTIONS);

        if (cleanedKeys.length === 0) throw new Error('empty-selection');

        setSaving(true);
        try {
            await dashboardQuickMenuService.savePositionSelection(uid, positionId, cleanedKeys);
        } finally {
            setSaving(false);
        }
    }, [actionByKey, currentUser?.uid, positionId]);

    const resetSelection = useCallback(async () => {
        const uid = currentUser?.uid;
        if (!uid) throw new Error('missing-user');

        setSaving(true);
        try {
            await dashboardQuickMenuService.resetPositionSelection(uid, positionId);
        } finally {
            setSaving(false);
        }
    }, [currentUser?.uid, positionId]);

    return {
        actions,
        availableActions,
        selectedKeys,
        defaultSelectedKeys,
        hasPersonalSelection,
        loading,
        saving,
        maxActions: MAX_QUICK_ACTIONS,
        saveSelection,
        resetSelection,
    };
};

export const useQuickMenuActions = (modeConfig: DashboardModeConfig): QuickMenuAction[] => {
    return useQuickMenuActionSettings(modeConfig).actions;
};
