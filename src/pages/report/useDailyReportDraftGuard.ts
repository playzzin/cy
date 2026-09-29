import { useContext, useEffect, useRef } from 'react';
import { UNSAFE_NavigationContext, useLocation } from 'react-router-dom';

/** Protect menu/tab navigation without prompting for the list's own filter URL updates. */
export const useDailyReportDraftGuard = (dirty: boolean, saving: boolean) => {
    const { navigator } = useContext(UNSAFE_NavigationContext);
    const location = useLocation();
    const latest = useRef({ dirty, saving, location });
    latest.current = { dirty, saving, location };

    useEffect(() => {
        const warn = (event: BeforeUnloadEvent) => {
            if (!latest.current.dirty && !latest.current.saving) return;
            event.preventDefault();
            event.returnValue = '';
        };
        window.addEventListener('beforeunload', warn);
        const push = navigator.push;
        const replace = navigator.replace;
        const go = navigator.go;
        const allow = (to?: Parameters<typeof push>[0]) => {
            const current = latest.current;
            if (!current.dirty && !current.saving) return true;
            if (to !== undefined) {
                const url = typeof to === 'string'
                    ? new URL(to, `${window.location.origin}${current.location.pathname}`)
                    : { pathname: to.pathname ?? current.location.pathname, search: to.search ?? '' };
                const params = new URLSearchParams(url.search);
                const previous = new URLSearchParams(current.location.search);
                if (url.pathname === current.location.pathname && params.get('tab') === 'list-v2'
                    && ['date', 'startDate', 'endDate'].every(key => params.get(key) === previous.get(key))) return true;
            }
            if (current.saving) return false;
            return window.confirm('저장하지 않은 변경이 있습니다. 변경을 버리고 이동할까요?');
        };
        const guardedPush: typeof push = (...args) => { if (allow(args[0])) push.apply(navigator, args); };
        const guardedReplace: typeof replace = (...args) => { if (allow(args[0])) replace.apply(navigator, args); };
        const guardedGo: typeof go = (...args) => { if (allow()) go.apply(navigator, args); };
        navigator.push = guardedPush;
        navigator.replace = guardedReplace;
        navigator.go = guardedGo;
        return () => {
            window.removeEventListener('beforeunload', warn);
            if (navigator.push === guardedPush) navigator.push = push;
            if (navigator.replace === guardedReplace) navigator.replace = replace;
            if (navigator.go === guardedGo) navigator.go = go;
        };
    }, [navigator]);
};
