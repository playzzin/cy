import { useCallback, useEffect, useRef, useState } from 'react';
import { messageService } from '../services/messageService';
import type { ErpMessage } from '../types/erpMessage';

const READ_ERROR = '메시지는 열었지만 읽음 상태를 저장하지 못했습니다. 다시 시도해 주세요.';

export function useMessageReadActions(uid?: string | null) {
  const identity = useRef(uid);
  identity.current = uid;
  const mounted = useRef(true);
  const pending = useRef(new Set<string>());
  const [state, setState] = useState<{ owner?: string | null; busy: boolean; failed: (() => Promise<void>) | null }>({
    owner: uid, busy: false, failed: null
  });

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const run = useCallback(async (key: string, operation: () => Promise<void>): Promise<void> => {
    if (!uid || pending.current.has(key)) return;
    pending.current.add(key);
    const isCurrent = () => mounted.current && identity.current === uid;
    if (isCurrent()) setState({ owner: uid, busy: true, failed: null });
    let failed: (() => Promise<void>) | null = null;
    try { await operation(); }
    catch { failed = () => run(key, operation); }
    finally {
      pending.current.delete(key);
      if (isCurrent()) setState(previous => ({
        owner: uid,
        busy: Array.from(pending.current).some(item => item.startsWith(JSON.stringify(uid) + ':')),
        failed: failed || (previous.owner === uid ? previous.failed : null)
      }));
    }
  }, [uid]);

  const markRead = useCallback((message: ErpMessage) => {
    if (!uid || messageService.isReadBy(message, uid)) return Promise.resolve();
    return run(JSON.stringify(uid) + ':read:' + message.id, () => messageService.markAsRead(message.id, uid));
  }, [uid, run]);

  const markAllRead = useCallback((messages: ErpMessage[]) => {
    if (!uid) return Promise.resolve();
    return run(JSON.stringify(uid) + ':all', () => messageService.markAllAsRead(messages, uid));
  }, [uid, run]);

  const current = state.owner === uid ? state : { busy: false, failed: null };
  return { markRead, markAllRead, busy: current.busy, error: current.failed ? READ_ERROR : '', retry: current.failed };
}
