import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { messageService } from '../services/messageService';
import type { ErpMessage, ErpMessageSummary } from '../types/erpMessage';

const emptySummary: ErpMessageSummary = {
  total: 0,
  unread: 0,
  urgentUnread: 0
};

export const playMessageNotificationSound = () => {
  try {
    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextCtor) return;

    const audioContext = new AudioContextCtor();
    const now = audioContext.currentTime;
    const gain = audioContext.createGain();
    gain.connect(audioContext.destination);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.44);

    [880, 1175].forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, now + index * 0.12);
      oscillator.connect(gain);
      oscillator.start(now + index * 0.12);
      oscillator.stop(now + index * 0.12 + 0.16);
    });

    window.setTimeout(() => {
      void audioContext.close().catch(() => undefined);
    }, 700);
  } catch (error) {
    console.warn('[message] notification sound skipped:', error);
  }
};

export const useMessageInbox = (uid?: string | null, limitCount?: number) => {
  const [state, setState] = useState<{ owner?: string | null; messages: ErpMessage[]; loading: boolean; error: Error | null }>({
    owner: uid, messages: [], loading: Boolean(uid), error: null
  });
  const [revision, setRevision] = useState(0);
  const retry = useCallback(() => setRevision(value => value + 1), []);

  useEffect(() => {
    let active = true;
    setState({ owner: uid, messages: [], loading: Boolean(uid), error: null });
    if (!uid) return;
    const unsubscribe = messageService.subscribeInbox(
      uid,
      (nextMessages) => {
        if (active) setState({ owner: uid, messages: nextMessages, loading: false, error: null });
      },
      (nextError) => {
        if (active) setState({ owner: uid, messages: [], loading: false, error: nextError });
      },
      limitCount
    );

    return () => { active = false; unsubscribe(); };
  }, [uid, limitCount, revision]);

  const { messages, loading, error } = state.owner === uid ? state : { messages: [], loading: Boolean(uid), error: null };

  const summary = useMemo(() => {
    return uid ? messageService.buildSummary(uid, messages) : emptySummary;
  }, [uid, messages]);

  return { messages, summary, loading, error, retry };
};

export const useMessageNotifications = (uid?: string | null) => {
  const inbox = useMessageInbox(uid);
  const previous = useRef<{ uid?: string | null; ids: Set<string>; initialized: boolean }>({ uid, ids: new Set(), initialized: false });
  useEffect(() => {
    if (previous.current.uid !== uid || inbox.loading || inbox.error) {
      previous.current = { uid, ids: new Set(), initialized: false };
    }
    if (!uid || inbox.loading || inbox.error) return;
    const incoming = inbox.messages.some(message => !messageService.isReadBy(message, uid) && !previous.current.ids.has(message.id));
    if (previous.current.initialized && incoming) {
      playMessageNotificationSound();
      try { navigator.vibrate?.(80); } catch { /* Optional device feedback. */ }
    }
    // Keep observed ids across read receipts, reordered lists and temporary omissions.
    inbox.messages.forEach(message => previous.current.ids.add(message.id));
    previous.current.initialized = true;
  }, [uid, inbox.messages, inbox.loading, inbox.error]);
  return inbox;
};
