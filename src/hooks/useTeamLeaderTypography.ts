import { useEffect } from 'react';
import '../components/layout/TeamLeaderTypography.css';

/** Scope the typefaces to the active role, including dialogs portaled to body. */
export function useTeamLeaderTypography(enabled: boolean) {
    useEffect(() => {
        if (!enabled) return;
        const root = document.documentElement;
        const previous = root.getAttribute('data-team-typography');
        root.setAttribute('data-team-typography', 'baemin');
        return () => {
            if (previous === null) root.removeAttribute('data-team-typography');
            else root.setAttribute('data-team-typography', previous);
        };
    }, [enabled]);
}
