import { useLayoutEffect } from 'react';
import { DEFAULT_TEAM_FONT, isSidebarFont, SIDEBAR_FONTS, type SidebarFontId } from '../constants/sidebarFonts';
import { useSidebarFont } from './useSidebarFonts';
import '../components/layout/TeamLeaderTypography.css';

/** Scope the typefaces to the active role, including dialogs portaled to body. */
export function useTeamLeaderTypography(enabled: boolean, preset?: SidebarFontId) {
    const font = enabled ? (isSidebarFont(preset) ? preset : DEFAULT_TEAM_FONT) : undefined;
    useSidebarFont(font);
    useLayoutEffect(() => {
        if (!font) return;
        const root = document.documentElement;
        const previous = root.getAttribute('data-team-typography');
        const previousFamily = root.style.getPropertyValue('--team-screen-font');
        root.setAttribute('data-team-typography', font);
        root.style.setProperty('--team-screen-font', SIDEBAR_FONTS[font].family);
        return () => {
            if (previous === null) root.removeAttribute('data-team-typography');
            else root.setAttribute('data-team-typography', previous);
            if (previousFamily) root.style.setProperty('--team-screen-font', previousFamily);
            else root.style.removeProperty('--team-screen-font');
        };
    }, [font]);
}
