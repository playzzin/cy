import { useMemo } from 'react';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faChartPie } from '@fortawesome/free-solid-svg-icons';
import { useSiteMode } from '../../contexts/SiteModeContext';
import { MENU_PATHS } from '../../constants/menuPaths';
import { resolveIcon } from '../../constants/iconMap';
import type { MenuItem } from '../../types/menu';
import type { DashboardAction, DashboardModeConfig } from './roleDashboardConfig';

export interface QuickMenuAction extends DashboardAction {
    openInNewTab?: boolean;
}

const getMenuDisplayText = (text: string): string => {
    return text;
};

const inferIconName = (text: string, path?: string, explicitIcon?: string): string => {
    const icon = typeof explicitIcon === 'string' ? explicitIcon.trim() : '';
    if (icon) return icon;

    const normalizedPath = typeof path === 'string' ? path.split('?')[0] : '';
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

export const useQuickMenuActions = (modeConfig: DashboardModeConfig): QuickMenuAction[] => {
    const { currentSiteData } = useSiteMode();

    return useMemo(() => {
        const menuActions = currentSiteData?.menu?.length
            ? flattenMenuActions(currentSiteData.menu, modeConfig.icon)
            : [];

        const deduped = menuActions.filter((action, index, list) => {
            return list.findIndex((candidate) => candidate.path === action.path && candidate.label === action.label) === index;
        });

        return deduped.length > 0 ? deduped : modeConfig.quickActions;
    }, [currentSiteData?.menu, modeConfig]);
};
