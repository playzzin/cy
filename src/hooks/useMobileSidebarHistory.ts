import { useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate, type NavigateOptions } from 'react-router-dom';

const MENU_STATE_KEY = 'mobileSidebarOpen';

// A menu opening owns one same-URL entry. Back consumes that entry before
// leaving the page; choosing a destination replaces it instead of retaining it.
export function useMobileSidebarHistory(mobile: boolean) {
    const location = useLocation();
    const navigate = useNavigate();
    const latest = useRef({ location, mobile });
    const pending = useRef(false);
    if (latest.current.location.key !== location.key) pending.current = false;
    latest.current = { location, mobile };

    const setOpen = useCallback((open: boolean) => {
        const current = latest.current;
        const hasMenuEntry = current.location.state?.[MENU_STATE_KEY] === true;
        if (pending.current || open === hasMenuEntry || (open && !current.mobile)) return;
        pending.current = true;
        if (open) {
            navigate(current.location.pathname + current.location.search + current.location.hash, {
                state: { ...current.location.state, [MENU_STATE_KEY]: true },
            });
        } else {
            navigate(-1);
        }
    }, [navigate]);

    const navigateFromMenu = useCallback((to: string, options?: NavigateOptions) => {
        const hasMenuEntry = latest.current.location.state?.[MENU_STATE_KEY] === true;
        if (hasMenuEntry) pending.current = true;
        navigate(to, { ...options, replace: options?.replace ?? hasMenuEntry, flushSync: true });
        // A form guard may cancel navigation without changing the location.
        // The menu must remain usable after the user chooses to keep editing.
        queueMicrotask(() => { pending.current = false; });
    }, [navigate]);

    useEffect(() => {
        if (!mobile) setOpen(false);
    }, [mobile, setOpen]);

    return { isOpen: mobile && location.state?.[MENU_STATE_KEY] === true, setOpen, navigateFromMenu };
}
