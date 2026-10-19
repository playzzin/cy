import { useCallback, useEffect, useRef, useState } from 'react';
import { messageService } from '../services/messageService';
import type { ErpMessage } from '../types/erpMessage';
import { isDevPreviewFrame } from '../utils/devPreviewRuntime';

const errorCode = (error: unknown): string =>
  String((error as { code?: string } | null)?.code || '').replace(/^(firestore|auth)\//, '');

const readError = (error: unknown): string => {
  switch (errorCode(error)) {
    case 'permission-denied': return '읽음 상태를 저장할 권한을 확인하지 못했습니다. 문제가 계속되면 관리자에게 문의해 주세요.';
    case 'unauthenticated': return '로그인 상태를 확인하지 못했습니다. 다시 로그인한 뒤 시도해 주세요.';
    case 'not-found': return '이 알림이 삭제되었거나 더 이상 제공되지 않습니다. 알림 목록을 새로 불러와 주세요.';
    default: return '읽음 상태를 저장하지 못했습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.';
  }
};

interface ReadOperation { ids: string[]; execute: () => Promise<void> }
interface FailedRead { key: string; operation: ReadOperation; error: string }
interface ReadSession {
  uid?: string | null;
  pending: Set<string>;
  failures: Map<string, FailedRead>;
}

export function useMessageReadActions(uid?: string | null, messages?: ErpMessage[]) {
  const session = useRef<ReadSession>({ uid, pending: new Set(), failures: new Map() });
  if (session.current.uid !== uid) session.current = { uid, pending: new Set(), failures: new Map() };
  const mounted = useRef(true);
  const [state, setState] = useState<{ session: ReadSession; busy: boolean; failures: FailedRead[] }>({
    session: session.current, busy: false, failures: []
  });

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const publish = useCallback((current: ReadSession) => {
    if (mounted.current && session.current === current) {
      setState({ session: current, busy: current.pending.size > 0, failures: [...current.failures.values()] });
    }
  }, []);

  const run = useCallback(async (key: string, operation: ReadOperation): Promise<void> => {
    const current = session.current;
    if (!uid || isDevPreviewFrame || current.uid !== uid || current.pending.has(key)) return;
    const isCurrent = () => mounted.current && session.current === current;
    current.pending.add(key);
    publish(current);
    try {
      try { await operation.execute(); }
      catch (error) {
        if (!isCurrent()) return;
        if (!['unavailable', 'deadline-exceeded', 'aborted', 'internal', 'network-request-failed'].includes(errorCode(error))) throw error;
        await new Promise(resolve => window.setTimeout(resolve, 600));
        if (!isCurrent()) return;
        await operation.execute();
      }
      current.failures.delete(key);
    } catch (error) {
      current.failures.set(key, { key, operation, error: readError(error) });
    } finally {
      current.pending.delete(key);
      publish(current);
    }
  }, [uid, publish]);

  // Another screen may save the receipt while this header remains mounted.
  // Clear only failures confirmed by the inbox snapshot.
  useEffect(() => {
    if (!messages) return;
    const current = session.current;
    let changed = false;
    current.failures.forEach((failure, key) => {
      if (failure.operation.ids.every(id => messages.some(message => message.id === id && !message.readReceiptPending && messageService.isReadBy(message, uid || '')))) {
        current.failures.delete(key);
        changed = true;
      }
    });
    if (changed) publish(current);
  }, [messages, uid, state.failures, publish]);

  const markRead = useCallback((message: ErpMessage) => {
    if (!uid || messageService.isReadBy(message, uid)) return Promise.resolve();
    return run('read:' + message.id, { ids: [message.id], execute: () => messageService.markAsRead(message.id, uid) });
  }, [uid, run]);

  const markAllRead = useCallback((items: ErpMessage[]) => {
    if (!uid) return Promise.resolve();
    const unread = items.filter(message => !messageService.isReadBy(message, uid));
    if (!unread.length) return Promise.resolve();
    return run('all', { ids: unread.map(message => message.id), execute: () => messageService.markAllAsRead(unread, uid) });
  }, [uid, run]);

  const retry = useCallback(async () => {
    await Promise.all([...session.current.failures.values()].map(failure => run(failure.key, failure.operation)));
  }, [run]);

  const current = state.session === session.current ? state : { busy: false, failures: [] };
  return {
    markRead, markAllRead, busy: current.busy, readOnly: isDevPreviewFrame,
    error: current.failures[0]?.error || '', retry: current.failures.length ? retry : null
  };
}
