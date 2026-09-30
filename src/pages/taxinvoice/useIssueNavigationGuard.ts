import { useContext, useLayoutEffect, useRef } from 'react';
import { UNSAFE_NavigationContext, useLocation } from 'react-router-dom';

/** BrowserRouter does not support useBlocker. Guard both router calls and native history traversal. */
export const useIssueNavigationGuard = (shouldWarn: boolean, canLeave: () => boolean) => {
    const { navigator } = useContext(UNSAFE_NavigationContext);
    const location = useLocation();
    const guardRef = useRef({ shouldWarn, canLeave });
    guardRef.current = { shouldWarn, canLeave };
    const indexRef = useRef<number | undefined>(window.history.state?.idx);
    const allowedPopRef = useRef<number | null>(null);
    const restoringRef = useRef<{ index: number; retry: number | null } | null>(null);

    useLayoutEffect(() => {
        indexRef.current = window.history.state?.idx;
    }, [location]);

    useLayoutEffect(() => {
        const allow = () => !guardRef.current.shouldWarn || guardRef.current.canLeave();
        const push = navigator.push;
        const replace = navigator.replace;
        const go = navigator.go;
        const guardedPush: typeof push = (...args) => { if (allow()) push.apply(navigator, args); };
        const guardedReplace: typeof replace = (...args) => { if (allow()) replace.apply(navigator, args); };
        const guardedGo: typeof go = (...args) => {
            if (!allow()) return;
            // A native traversal will also emit popstate. Do not prompt twice.
            const index = window.history.state?.idx;
            allowedPopRef.current = typeof index === 'number' ? index + args[0] : null;
            go.apply(navigator, args);
        };
        navigator.push = guardedPush;
        navigator.replace = guardedReplace;
        navigator.go = guardedGo;

        const onPop = (event: PopStateEvent) => {
            const index = event.state?.idx;
            const restoring = restoringRef.current;
            if (restoring && index === restoring.index) {
                event.stopImmediatePropagation();
                restoringRef.current = null;
                if (restoring.retry !== null) {
                    allowedPopRef.current = restoring.index + restoring.retry;
                    window.history.go(restoring.retry);
                }
                return;
            }
            if (typeof index === 'number' && allowedPopRef.current === index) {
                allowedPopRef.current = null;
                indexRef.current = index;
                return;
            }
            allowedPopRef.current = null;
            const previousIndex = indexRef.current;
            if (!guardRef.current.shouldWarn || typeof previousIndex !== 'number' || typeof index !== 'number' || index === previousIndex) {
                indexRef.current = index;
                return;
            }
            // Restore the URL before letting React Router unmount the dirty screen.
            event.stopImmediatePropagation();
            const delta = index - previousIndex;
            restoringRef.current = { index: previousIndex, retry: allow() ? delta : null };
            window.history.go(-delta);
        };
        const onUnload = (event: BeforeUnloadEvent) => {
            if (!guardRef.current.shouldWarn) return;
            event.preventDefault();
            event.returnValue = '';
        };
        window.addEventListener('popstate', onPop, true);
        window.addEventListener('beforeunload', onUnload);
        return () => {
            if (navigator.push === guardedPush) navigator.push = push;
            if (navigator.replace === guardedReplace) navigator.replace = replace;
            if (navigator.go === guardedGo) navigator.go = go;
            window.removeEventListener('popstate', onPop, true);
            window.removeEventListener('beforeunload', onUnload);
        };
    }, [navigator]);
};
