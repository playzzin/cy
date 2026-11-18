import { useCallback, useEffect, useState } from 'react';

const contains = (active: readonly string[], path: readonly string[]) => path.length > 0 && path.length <= active.length && path.every((key, index) => active[index] === key);

/** One open branch: ancestors stay open, siblings and unrelated branches close. */
export function useTeamSettlementAccordion(scope: string) {
  const [state, setState] = useState<{ scope: string; path: string[] }>({ scope, path: [] });
  const path = state.scope === scope ? state.path : [];
  useEffect(() => { setState(previous => previous.scope === scope ? previous : { scope, path: [] }); }, [scope]);
  const toggle = useCallback((next: string[]) => setState(previous => ({ scope,
    path: previous.scope === scope && contains(previous.path, next) ? next.slice(0, -1) : next
  })), [scope]);
  const open = useCallback((next: string[]) => setState({ scope, path: next }), [scope]);
  return { isOpen: (candidate: string[]) => contains(path, candidate), child: (parent: string[]) => contains(path, parent) ? path[parent.length] ?? null : null, toggle, open };
}
