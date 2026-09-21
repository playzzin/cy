import { useContext, useEffect } from 'react';
import { UNSAFE_NavigationContext } from 'react-router-dom';

/** BrowserRouter navigation (including programmatic menu navigation). */
export function useUnsavedRequestGuard(dirty: boolean) {
  const context = useContext(UNSAFE_NavigationContext);
  useEffect(() => {
    if (!dirty || !context?.navigator) return;
    const navigator = context.navigator;
    const push = navigator.push, replace = navigator.replace, go = navigator.go;
    const confirm = () => window.confirm('저장하지 않은 입력이 있습니다. 이 화면을 나갈까요?');
    const guardedPush: typeof push = (...args) => { if (confirm()) push.apply(navigator, args); };
    const guardedReplace: typeof replace = (...args) => { if (confirm()) replace.apply(navigator, args); };
    const guardedGo: typeof go = (...args) => { if (confirm()) go.apply(navigator, args); };
    navigator.push = guardedPush; navigator.replace = guardedReplace; navigator.go = guardedGo;
    return () => {
      if (navigator.push === guardedPush) navigator.push = push;
      if (navigator.replace === guardedReplace) navigator.replace = replace;
      if (navigator.go === guardedGo) navigator.go = go;
    };
  }, [context, dirty]);
}
