import { useCallback, useLayoutEffect, useRef, useState } from 'react';

const isPhoneLayout = () => window.matchMedia('(max-width: 768px)').matches;

export function useMobileShellScroll(pathname: string, hash: string, navigationType: string, menuOpen: boolean, mobile: boolean) {
    const previousPath = useRef(pathname);
    useLayoutEffect(() => {
        if (!mobile || !menuOpen) return;
        const body = document.body;
        const top = window.scrollY;
        const saved = { position: body.style.position, top: body.style.top, left: body.style.left, right: body.style.right, width: body.style.width, overflow: body.style.overflow };
        Object.assign(body.style, { position: 'fixed', top: `-${top}px`, left: '0', right: '0', width: '100%', overflow: 'hidden' });
        return () => {
            Object.assign(body.style, saved);
            window.scrollTo({ top, left: 0, behavior: 'auto' });
        };
    }, [mobile, menuOpen]);

    useLayoutEffect(() => {
        const changed = previousPath.current !== pathname;
        previousPath.current = pathname;
        // Preserve browser back/forward restoration and explicit anchor links.
        if (changed && mobile && navigationType !== 'POP' && !hash) {
            window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        }
    }, [pathname, hash, navigationType, mobile]);
}

export function useMobileDetailNavigation<View extends string>(listView: View) {
    const [view, setView] = useState<View>(listView);
    const workspaceRef = useRef<HTMLElement>(null);
    const previousView = useRef(view);
    const listPosition = useRef(0);
    const changeView = useCallback((next: View) => {
        // Capture before the list unmounts: a shorter detail can clamp scrollY.
        if (view === listView && next !== listView && isPhoneLayout()) listPosition.current = window.scrollY;
        setView(next);
    }, [view, listView]);
    useLayoutEffect(() => {
        const previous = previousView.current;
        previousView.current = view;
        if (previous === view || !isPhoneLayout()) return;
        if (view === listView) window.scrollTo({ top: listPosition.current, left: 0, behavior: 'auto' });
        else workspaceRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
    }, [view, listView]);
    return [view, changeView, workspaceRef] as const;
}
