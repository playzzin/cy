import type { CSSProperties } from 'react';
import type { MenuItem, SiteData, SiteDataType } from '../types/menu';
import { getLinkedMenuRef } from './linkedPositionMenus';
import { getContrastingTextColor } from './color';

export const DEFAULT_SIDEBAR_ACCENT = '#1abc9c';
export const DEFAULT_SIDEBAR_ICON = '#bdc3c7';
export const DEFAULT_SIDEBAR_BACKGROUND = '#2c3e50';

export type SidebarColorSource = (id?: string) => SiteData | undefined;

export const sidebarColorSource = (sites: SiteDataType | null | undefined, current?: SiteData): SidebarColorSource =>
    id => {
        const linked = getLinkedMenuRef(id);
        const site = linked ? sites?.[linked.siteKey] : current;
        if (site && !site.sidebarBackgroundColor && current?.sidebarBackgroundColor) {
            return { ...site, sidebarBackgroundColor: current.sidebarBackgroundColor };
        }
        return site;
    };

export const sidebarColors = (item: Pick<MenuItem, 'iconColor' | 'activeColor' | 'backgroundColor' | 'selectedBackgroundColor'>, site?: Pick<SiteData, 'sidebarAccentColor' | 'sidebarBackgroundColor' | 'sidebarSelectedBackgroundColor'>) => {
    const background = item.backgroundColor || site?.sidebarBackgroundColor;
    const selectedBackground = item.selectedBackgroundColor || site?.sidebarSelectedBackgroundColor || background;
    const ink = background ? getContrastingTextColor(background, '#ffffff', '#000000') : undefined;
    const selectedInk = selectedBackground && selectedBackground !== background
        ? getContrastingTextColor(selectedBackground, '#ffffff', '#000000') : ink;
    return {
        icon: item.iconColor || site?.sidebarAccentColor || ink || DEFAULT_SIDEBAR_ICON,
        active: item.activeColor || site?.sidebarAccentColor || DEFAULT_SIDEBAR_ACCENT,
        background, ink, selectedBackground, selectedInk
    };
};

type RowStyle = CSSProperties & {
    '--sidebar-highlight-bg': string;
    '--sidebar-highlight-ink': string;
    '--sidebar-highlight-accent': string;
};

export const sidebarRowStyle = (colors: ReturnType<typeof sidebarColors>, current = false): RowStyle => {
    const highlight = colors.selectedBackground || `color-mix(in srgb, ${colors.active} 15%, transparent)`;
    const background = current ? colors.selectedBackground : colors.background;
    const ink = current ? colors.selectedInk : colors.ink;
    return {
        '--sidebar-highlight-bg': highlight,
        '--sidebar-highlight-ink': colors.selectedInk || 'var(--text-light, #ecf0f1)',
        '--sidebar-highlight-accent': colors.active,
        ...(current ? {
            boxShadow: `inset 3px 0 0 ${colors.active}`,
            backgroundColor: highlight,
            fontWeight: 700
        } : {}),
        ...(background ? {
            backgroundColor: background, color: ink,
            '--sidebar-custom-bg': background, '--sidebar-custom-ink': ink
        } : {})
    };
};
