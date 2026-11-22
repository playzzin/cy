import { useContext, useEffect, useRef } from 'react';
import { parsePath, UNSAFE_LocationContext, UNSAFE_NavigationContext } from 'react-router-dom';

/** BrowserRouter navigation (including programmatic menu navigation). */
export function useUnsavedRequestGuard(dirty: boolean, message = '저장하지 않은 입력이 있습니다. 이 화면을 나갈까요?') {
  const context = useContext(UNSAFE_NavigationContext);
  const route = useContext(UNSAFE_LocationContext);
  const latest = useRef({ dirty, message, route });
  latest.current = { dirty, message, route };
  useEffect(() => {
    if (!context?.navigator) return;
    const navigator = context.navigator;
    const push = navigator.push, replace = navigator.replace;
    let index = window.history.state?.idx as number | undefined;
    let restoring: { index: number; delta: number } | null = null;
    let permittedIndex: number | null = null;
    const currentPath = () => latest.current.route?.location.pathname ?? window.location.pathname;
    const confirm = () => !latest.current.dirty || window.confirm(latest.current.message);
    const leavesPage = (to: Parameters<typeof push>[0]) =>
      ((typeof to === 'string' ? parsePath(to).pathname : to.pathname) || currentPath()) !== currentPath();
    const guardedPush: typeof push = (...args) => {
      if (restoring || (leavesPage(args[0]) && !confirm())) return;
      push.apply(navigator, args); index = window.history.state?.idx;
    };
    const guardedReplace: typeof replace = (...args) => {
      if (restoring || (leavesPage(args[0]) && !confirm())) return;
      replace.apply(navigator, args); index = window.history.state?.idx;
    };
    // Native Back bypasses navigator.go. A capture listener keeps the form
    // mounted while history is restored, before asking whether to proceed.
    const onPop = (event: PopStateEvent) => {
      const nextIndex = event.state?.idx as number | undefined;
      if (restoring) {
        event.stopImmediatePropagation();
        if (nextIndex !== restoring.index) {
          if (typeof nextIndex === 'number') window.history.go(restoring.index - nextIndex);
          return;
        }
        const { delta } = restoring;
        restoring = null;
        if (confirm()) { permittedIndex = nextIndex + delta; window.history.go(delta); }
        return;
      }
      if (nextIndex === permittedIndex) { permittedIndex = null; index = nextIndex; return; }
      // Menu open/close and hash changes keep this form mounted.
      if (!latest.current.dirty || window.location.pathname === currentPath() ||
          typeof index !== 'number' || typeof nextIndex !== 'number' || index === nextIndex) {
        index = nextIndex; return;
      }
      event.stopImmediatePropagation();
      restoring = { index, delta: nextIndex - index };
      window.history.go(index - nextIndex);
    };
    navigator.push = guardedPush; navigator.replace = guardedReplace;
    window.addEventListener('popstate', onPop, true);
    return () => {
      if (navigator.push === guardedPush) navigator.push = push;
      if (navigator.replace === guardedReplace) navigator.replace = replace;
      window.removeEventListener('popstate', onPop, true);
    };
  }, [context?.navigator]);
}
