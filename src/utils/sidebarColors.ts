import type { CSSProperties } from 'react';
import type { MenuItem, SiteData, SiteDataType } from '../types/menu';
import { getLinkedMenuRef } from './linkedPositionMenus';
import { getContrastingTextColor } from './color';
import { isSidebarFont, sidebarFontFamily } from '../constants/sidebarFonts';

export const DEFAULT_SIDEBAR_ACCENT = '#1abc9c';
export const DEFAULT_SIDEBAR_ICON = '#bdc3c7';
export const DEFAULT_SIDEBAR_BACKGROUND = '#2c3e50';

export type SidebarColorSource = (id?: string) => SiteData | undefined;

export const sidebarColorSource = (sites: SiteDataType | null | undefined, current?: SiteData): SidebarColorSource =>
    id => {
        const linked = getLinkedMenuRef(id);
        const site = linked ? sites?.[linked.siteKey] : current;
        if (site && current && ((!site.sidebarBackgroundColor && current.sidebarBackgroundColor) || (!site.sidebarFontPreset && current.sidebarFontPreset))) {
            return { ...site, sidebarBackgroundColor: site.sidebarBackgroundColor || current.sidebarBackgroundColor,
                sidebarFontPreset: site.sidebarFontPreset || current.sidebarFontPreset };
        }
        return site;
    };

export const sidebarFontPreset = (item: Pick<MenuItem, 'fontPreset'>, site?: Pick<SiteData, 'sidebarFontPreset'>) =>
    isSidebarFont(item.fontPreset) ? item.fontPreset : isSidebarFont(site?.sidebarFontPreset) ? site.sidebarFontPreset : undefined;

export const sidebarColors = (item: Pick<MenuItem, 'iconColor' | 'activeColor' | 'backgroundColor' | 'selectedBackgroundColor' | 'fontPreset'>, site?: Pick<SiteData, 'sidebarAccentColor' | 'sidebarBackgroundColor' | 'sidebarSelectedBackgroundColor' | 'sidebarFontPreset'>) => {
    const background = item.backgroundColor || site?.sidebarBackgroundColor;
    const selectedBackground = item.selectedBackgroundColor || site?.sidebarSelectedBackgroundColor || background;
    const ink = background ? getContrastingTextColor(background, '#ffffff', '#000000') : undefined;
    const selectedInk = selectedBackground && selectedBackground !== background
        ? getContrastingTextColor(selectedBackground, '#ffffff', '#000000') : ink;
    return {
        icon: item.iconColor || site?.sidebarAccentColor || ink || DEFAULT_SIDEBAR_ICON,
        active: item.activeColor || site?.sidebarAccentColor || DEFAULT_SIDEBAR_ACCENT,
        background, ink, selectedBackground, selectedInk, fontPreset: sidebarFontPreset(item, site)
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
        fontFamily: sidebarFontFamily(colors.fontPreset),
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
