import { useCallback, useEffect, useRef, useState } from 'react';
import type { MessagePayload, Messaging } from 'firebase/messaging';
import { app } from '../../config/firebase';
import {
  disableRememberedNotificationDevice,
  disableNotificationDeviceForToken,
  forgetCurrentNotificationDevice,
  rememberCurrentNotificationDevice,
  registerNotificationDevice,
} from './bankNotificationService';
import type { BankNotificationPermission } from './types';

const SERVICE_WORKER_WAIT_MS = 8000;

const describeBrowser = (userAgent: string): string => {
  if (/Edg\//i.test(userAgent)) return 'Microsoft Edge';
  if (/OPR\//i.test(userAgent)) return 'Opera';
  if (/SamsungBrowser\//i.test(userAgent)) return 'Samsung Internet';
  if (/Chrome\//i.test(userAgent)) return 'Chrome';
  if (/Firefox\//i.test(userAgent)) return 'Firefox';
  if (/Safari\//i.test(userAgent)) return 'Safari';
  return '웹 브라우저';
};

const describePlatform = (userAgent: string): string => {
  if (/Android/i.test(userAgent)) return 'Android';
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'iOS';
  if (/Windows/i.test(userAgent)) return 'Windows';
  if (/Mac OS/i.test(userAgent)) return 'macOS';
  return '기기';
};

const getExistingServiceWorkerRegistration = async (): Promise<ServiceWorkerRegistration> => {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    throw new Error('service-worker-unsupported');
  }

  const registrations = await navigator.serviceWorker.getRegistrations();
  const publicUrl = process.env.PUBLIC_URL || '';
  const expectedSuffix = `${publicUrl}/service-worker.js`.replace(/\/+/g, '/');
  const existing = registrations.find((registration) => (
    registration.active?.scriptURL.endsWith(expectedSuffix)
    || registration.waiting?.scriptURL.endsWith(expectedSuffix)
    || registration.installing?.scriptURL.endsWith(expectedSuffix)
  )) || await navigator.serviceWorker.getRegistration();

  if (existing?.active) return existing;

  let timeoutId: number | undefined;
  try {
    const ready = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(() => reject(new Error('service-worker-not-ready')), SERVICE_WORKER_WAIT_MS);
      }),
    ]);
    return ready;
  } finally {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  }
};

const getPushErrorMessage = (error: unknown): string => {
  const code = error && typeof error === 'object' ? String((error as { code?: unknown }).code || '') : '';
  const message = error instanceof Error ? error.message : String(error || '');
  if (message === 'vapid-key-missing') return '푸시 공개키가 설정되지 않았습니다. 관리자에게 문의해 주세요.';
  if (message === 'service-worker-unsupported') return '이 브라우저는 백그라운드 알림을 지원하지 않습니다.';
  if (message === 'service-worker-not-ready') return '앱의 알림 서비스가 아직 준비되지 않았습니다. 새로고침 후 다시 시도해 주세요.';
  if (message === 'notification-denied') return '브라우저 설정에서 이 사이트의 알림 권한을 허용해 주세요.';
  if (code.includes('permission-blocked') || code.includes('permission-denied')) return '브라우저에서 알림 권한이 차단되어 있습니다.';
  if (code.includes('token-subscribe-failed')) return '푸시 알림 등록에 실패했습니다. 네트워크 연결을 확인해 주세요.';
  return message || '푸시 알림을 설정하지 못했습니다.';
};

const getActionUrl = (payload: MessagePayload): string => {
  const data = payload.data || {};
  return data.actionUrl || data.click_action || '/finance/bank-notifications';
};

export interface BankPushNotificationState {
  supported: boolean | null;
  permission: BankNotificationPermission;
  busy: boolean;
  error: string;
  currentDeviceId: string;
  lastMessage: MessagePayload | null;
  enablePush: () => Promise<boolean>;
  disablePush: () => Promise<boolean>;
  clearError: () => void;
}

export const useBankPushNotifications = (
  uid: string | undefined,
  enabled = true,
): BankPushNotificationState => {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<BankNotificationPermission>(() => (
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  ));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [currentDeviceId, setCurrentDeviceId] = useState('');
  const [lastMessage, setLastMessage] = useState<MessagePayload | null>(null);
  const currentToken = useRef('');
  const messaging = useRef<Messaging | null>(null);

  const prepareMessaging = useCallback(async (): Promise<Messaging> => {
    const messagingModule = await import('firebase/messaging');
    const messagingSupported = await messagingModule.isSupported();
    setSupported(messagingSupported);
    if (!messagingSupported) throw new Error('service-worker-unsupported');
    const instance = messaging.current || messagingModule.getMessaging(app);
    messaging.current = instance;
    return instance;
  }, []);

  const registerCurrentBrowser = useCallback(async (requestPermission: boolean): Promise<boolean> => {
    if (!uid || !enabled) return false;
    setBusy(true);
    setError('');

    try {
      if (typeof Notification === 'undefined') throw new Error('service-worker-unsupported');
      let nextPermission = Notification.permission;
      if (requestPermission && nextPermission === 'default') {
        nextPermission = await Notification.requestPermission();
      }
      setPermission(nextPermission);
      if (nextPermission !== 'granted') throw new Error('notification-denied');

      const vapidKey = String(process.env.REACT_APP_FIREBASE_VAPID_KEY || '').trim();
      if (!vapidKey) throw new Error('vapid-key-missing');

      const instance = await prepareMessaging();
      const serviceWorkerRegistration = await getExistingServiceWorkerRegistration();
      const { getToken } = await import('firebase/messaging');
      const token = await getToken(instance, { vapidKey, serviceWorkerRegistration });
      if (!token) throw new Error('token-subscribe-failed');

      const userAgent = navigator.userAgent || '';
      const browser = describeBrowser(userAgent);
      const deviceId = await registerNotificationDevice({
        uid,
        token,
        label: `${browser} · ${describePlatform(userAgent)}`,
        browser,
        userAgent,
        permission: 'granted',
      });
      currentToken.current = token;
      setCurrentDeviceId(deviceId);
      rememberCurrentNotificationDevice(uid, deviceId);
      return true;
    } catch (registrationError) {
      setError(getPushErrorMessage(registrationError));
      return false;
    } finally {
      setBusy(false);
    }
  }, [enabled, prepareMessaging, uid]);

  const enablePush = useCallback(() => registerCurrentBrowser(true), [registerCurrentBrowser]);

  const disablePush = useCallback(async (): Promise<boolean> => {
    if (!uid) return false;
    setBusy(true);
    setError('');

    try {
      const instance = await prepareMessaging();
      const { deleteToken, getToken } = await import('firebase/messaging');
      let token = currentToken.current;
      if (!token && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        const vapidKey = String(process.env.REACT_APP_FIREBASE_VAPID_KEY || '').trim();
        if (vapidKey) {
          const serviceWorkerRegistration = await getExistingServiceWorkerRegistration();
          token = await getToken(instance, { vapidKey, serviceWorkerRegistration });
        }
      }

      if (token) await disableNotificationDeviceForToken(uid, token);
      else await disableRememberedNotificationDevice(uid);
      await deleteToken(instance);
      currentToken.current = '';
      setCurrentDeviceId('');
      forgetCurrentNotificationDevice(uid);
      return true;
    } catch (disableError) {
      setError(getPushErrorMessage(disableError));
      return false;
    } finally {
      setBusy(false);
    }
  }, [prepareMessaging, uid]);

  useEffect(() => {
    if (!enabled || !uid) {
      setSupported(null);
      return undefined;
    }

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      const message = event.data as { type?: unknown; payload?: unknown } | null;
      if (message?.type === 'BANK_PUSH_MESSAGE' && message.payload && typeof message.payload === 'object') {
        setLastMessage(message.payload as MessagePayload);
      }
      if (message?.type === 'BANK_PUSH_SUBSCRIPTION_CHANGED'
        && typeof Notification !== 'undefined'
        && Notification.permission === 'granted') {
        void registerCurrentBrowser(false);
      }
    };
    navigator.serviceWorker?.addEventListener('message', handleServiceWorkerMessage);
    void (async () => {
      try {
        const messagingModule = await import('firebase/messaging');
        const messagingSupported = await messagingModule.isSupported();
        if (cancelled) return;
        setSupported(messagingSupported);
        setPermission(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
        if (!messagingSupported) return;

        const instance = messaging.current || messagingModule.getMessaging(app);
        messaging.current = instance;
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          // Refresh lastSeenAt and the logout-revocation pointer for trusted devices.
          void registerCurrentBrowser(false);
        }
        unsubscribe = messagingModule.onMessage(instance, (payload) => {
          setLastMessage(payload);
          if (typeof Notification === 'undefined' || Notification.permission !== 'granted' || !document.hidden) return;
          const notification = new Notification(payload.notification?.title || '은행 입출금 알림', {
            body: payload.notification?.body || '새 은행 거래가 감지되었습니다.',
            tag: payload.data?.candidateId ? `bank-${payload.data.candidateId}` : 'bank-notification',
          });
          notification.onclick = () => {
            window.focus();
            window.location.assign(getActionUrl(payload));
            notification.close();
          };
        });
      } catch {
        if (!cancelled) setSupported(false);
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
      navigator.serviceWorker?.removeEventListener('message', handleServiceWorkerMessage);
    };
  }, [enabled, uid]);

  return {
    supported,
    permission,
    busy,
    error,
    currentDeviceId,
    lastMessage,
    enablePush,
    disablePush,
    clearError: () => setError(''),
  };
};
