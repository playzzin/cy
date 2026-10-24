import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { messageService } from '../services/messageService';
import type { ErpMessage, ErpMessageSummary } from '../types/erpMessage';
import { useNotificationCenter } from './useNotificationCenter';
import { isDeferred, isQuietTime, notificationSource, notificationEnabled } from '../utils/notificationCenter';

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
  const profile = useNotificationCenter(uid);
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
    return uid ? messageService.buildSummary(uid, messages.filter(m => notificationEnabled(m, profile.preferences) && (!m.expiresAt || m.expiresAt.toMillis() > profile.now) && !isDeferred(profile.states[m.id], profile.now))) : emptySummary;
  }, [uid, messages, profile.states, profile.now, profile.preferences]);

  return { messages, summary, loading, error, retry, profile };
};

export const useMessageNotifications = (uid?: string | null) => {
  const inbox = useMessageInbox(uid);
  const { profile } = inbox;
  const previous = useRef<{ uid?: string | null; ids: Set<string>; initialized: boolean }>({ uid, ids: new Set(), initialized: false });
  const pending = useRef(new Set<string>());
  const nextDigest = useRef(0);
  useEffect(() => {
    if (previous.current.uid !== uid || inbox.loading || inbox.error || profile.loading || profile.error) {
      previous.current = { uid, ids: new Set(), initialized: false };
      pending.current.clear(); nextDigest.current = 0;
    }
    if (!uid || inbox.loading || inbox.error || profile.loading || profile.error) return;
    const prefs = profile.preferences;
    const messageKey = (m: ErpMessage) => m.id + ':' + (profile.states[m.id]?.remindedAt?.toMillis() || 0);
    const eligible = inbox.messages.filter(m => !messageService.isReadBy(m, uid) && prefs.sources[notificationSource(m)]
      && (!m.expiresAt || m.expiresAt.toMillis() > profile.now) && !isDeferred(profile.states[m.id], profile.now));
    const incoming = eligible.filter(m => !previous.current.ids.has(messageKey(m)));
    if (previous.current.initialized && prefs.sound && !isQuietTime(prefs, profile.now)) {
      let play = false;
      for (const m of incoming) {
        if (['high', 'urgent'].includes(m.priority) || !prefs.digestMinutes) play = true;
        else { pending.current.add(m.id); if (!nextDigest.current) nextDigest.current = profile.now + prefs.digestMinutes * 60000; }
      }
      pending.current.forEach(id => { if (!eligible.some(m => m.id === id)) pending.current.delete(id); });
      if (!pending.current.size) nextDigest.current = 0;
      if (pending.current.size && (!prefs.digestMinutes || profile.now >= nextDigest.current)) {
        play = true; pending.current.clear(); nextDigest.current = 0;
      }
      if (play) { playMessageNotificationSound(); try { navigator.vibrate?.(80); } catch { /* Optional device feedback. */ } }
    } else { pending.current.clear(); nextDigest.current = 0; }
    // A cached/partial snapshot may temporarily omit an existing message. Keep
    // observed versions so its return (or a receipt rollback) cannot ring again.
    // An explicit personal reminder has a new remindedAt key and can still ring.
    inbox.messages.forEach(message => previous.current.ids.add(messageKey(message)));
    previous.current.initialized = true;
  }, [uid, inbox.messages, inbox.loading, inbox.error, profile.loading, profile.error, profile.preferences, profile.states, profile.now]);
  return { ...inbox, messages: inbox.messages.filter(m => notificationEnabled(m, profile.preferences) && (!m.expiresAt || m.expiresAt.toMillis() > profile.now) && !isDeferred(profile.states[m.id], profile.now)) };
};
