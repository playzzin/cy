import { useEffect, useMemo } from 'react';
import { isSidebarFont, SIDEBAR_FONTS, type SidebarFontId } from '../constants/sidebarFonts';
import type { MenuItem } from '../types/menu';
import { sidebarFontPreset, type SidebarColorSource } from '../utils/sidebarColors';
import '../components/layout/SidebarFonts.css';

function loadSidebarFont(font: SidebarFontId) {
    const href = SIDEBAR_FONTS[font].stylesheet;
    const id = `cy-sidebar-font-${font}`;
    if (!href || document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = href;
    link.referrerPolicy = 'no-referrer';
    link.addEventListener('error', () => link.remove(), { once: true });
    document.head.appendChild(link);
}

function useFontStylesheets(ids: string) {
    useEffect(() => {
        if (!ids) return;
        const fonts = ids.split(' ').filter(isSidebarFont);
        const load = () => fonts.forEach(loadSidebarFont);
        load();
        window.addEventListener('online', load);
        return () => window.removeEventListener('online', load);
    }, [ids]);
}

export function useSidebarFont(font?: SidebarFontId) {
    useFontStylesheets(font && SIDEBAR_FONTS[font].stylesheet ? font : '');
}

export function useSidebarFonts(items: (MenuItem | string)[], source?: SidebarColorSource) {
    const ids = useMemo(() => {
        if (!source) return '';
        const fonts = new Set<SidebarFontId>();
        const base = sidebarFontPreset({}, source());
        if (base) fonts.add(base);
        function visit(entries: (MenuItem | string)[]) {
            for (const entry of entries) {
                if (typeof entry === 'string') continue;
                const font = sidebarFontPreset(entry, source?.(entry.id));
                if (font) fonts.add(font);
                if (entry.sub) visit(entry.sub);
            }
        }
        visit(items);
        return [...fonts].filter(font => SIDEBAR_FONTS[font].stylesheet).sort().join(' ');
    }, [items, source]);
    useFontStylesheets(ids);
}
