import { useEffect, useMemo, useRef, useState } from 'react';
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
  const [messages, setMessages] = useState<ErpMessage[]>([]);
  const [loading, setLoading] = useState(Boolean(uid));
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!uid) {
      setMessages([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    const unsubscribe = messageService.subscribeInbox(
      uid,
      (nextMessages) => {
        setMessages(nextMessages);
        setLoading(false);
      },
      (nextError) => {
        setError(nextError);
        setLoading(false);
      },
      limitCount
    );

    return unsubscribe;
  }, [uid, limitCount]);

  const summary = useMemo(() => {
    return uid ? messageService.buildSummary(uid, messages) : emptySummary;
  }, [uid, messages]);

  return { messages, summary, loading, error };
};

export const useMessageNotifications = (uid?: string | null) => {
  const [messages, setMessages] = useState<ErpMessage[]>([]);
  const [loading, setLoading] = useState(Boolean(uid));
  const initializedRef = useRef(false);
  const latestUnreadIdRef = useRef<string | null>(null);

  useEffect(() => {
    initializedRef.current = false;
    latestUnreadIdRef.current = null;

    if (!uid) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = messageService.subscribeInbox(
      uid,
      (nextMessages) => {
        const latestUnread = nextMessages.find((message) => !messageService.isReadBy(message, uid));
        const latestUnreadId = latestUnread?.id || null;

        if (initializedRef.current && latestUnreadId && latestUnreadId !== latestUnreadIdRef.current) {
          playMessageNotificationSound();
          if ('vibrate' in navigator) navigator.vibrate?.(80);
        }

        initializedRef.current = true;
        latestUnreadIdRef.current = latestUnreadId;
        setMessages(nextMessages);
        setLoading(false);
      },
      () => {
        setLoading(false);
      },
      20
    );

    return unsubscribe;
  }, [uid]);

  const summary = useMemo(() => {
    return uid ? messageService.buildSummary(uid, messages) : emptySummary;
  }, [uid, messages]);

  return { messages, summary, loading };
};
