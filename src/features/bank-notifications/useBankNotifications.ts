import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { userService, type UserData } from '../../services/userService';
import {
  subscribeBankNotificationSettings,
  subscribeBankNotificationHealth,
  subscribeBankTransactionCandidates,
  subscribeNotificationDevices,
} from './bankNotificationService';
import { collectBankAccessRoles, resolveBankNotificationPermissions } from './bankNotificationPermissions';
import { BANK_HEALTH_STALE_AFTER_MS, toBankDate } from './bankNotificationUtils';
import {
  DEFAULT_BANK_NOTIFICATION_SETTINGS,
  type BankNotificationDevice,
  type BankNotificationHealth,
  type BankNotificationPermissions,
  type BankNotificationRecipient,
  type BankNotificationSettings,
  type BankTransactionCandidate,
} from './types';

interface BankNotificationAccessState {
  loading: boolean;
  error: string;
  profile: UserData | null;
  roles: string[];
  permissions: BankNotificationPermissions;
}

const DENIED_PERMISSIONS = resolveBankNotificationPermissions([], false);

const formatSubscriptionError = (error: Error): string => {
  const errorWithCode = error as Error & { code?: string };
  if (errorWithCode.code === 'permission-denied') return '이 금융정보를 조회할 권한이 없습니다.';
  if (errorWithCode.code === 'unavailable') return '네트워크 연결을 확인해 주세요.';
  return error.message || '은행 알림 데이터를 불러오지 못했습니다.';
};

export const useBankNotificationAccess = (): BankNotificationAccessState => {
  const { currentUser, loading: authLoading } = useAuth();
  const [state, setState] = useState<BankNotificationAccessState>({
    loading: true,
    error: '',
    profile: null,
    roles: [],
    permissions: DENIED_PERMISSIONS,
  });

  useEffect(() => {
    let cancelled = false;

    if (authLoading) {
      setState((current) => ({ ...current, loading: true }));
      return () => { cancelled = true; };
    }

    if (!currentUser) {
      setState({
        loading: false,
        error: '',
        profile: null,
        roles: [],
        permissions: DENIED_PERMISSIONS,
      });
      return () => { cancelled = true; };
    }

    setState((current) => ({ ...current, loading: true, error: '' }));
    void userService.getUser(currentUser.uid)
      .then((profile) => {
        if (cancelled) return;
        const extendedProfile = profile as (UserData & {
          systemRole?: unknown;
          roles?: unknown;
        }) | null;
        const roles = collectBankAccessRoles(extendedProfile);
        setState({
          loading: false,
          error: '',
          profile,
          roles,
          permissions: resolveBankNotificationPermissions(roles, true),
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setState({
          loading: false,
          error: formatSubscriptionError(error instanceof Error ? error : new Error(String(error))),
          profile: null,
          roles: [],
          permissions: DENIED_PERMISSIONS,
        });
      });

    return () => { cancelled = true; };
  }, [authLoading, currentUser]);

  return state;
};

export const useBankTransactionCandidates = (enabled: boolean) => {
  const [candidates, setCandidates] = useState<BankTransactionCandidate[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!enabled) {
      setCandidates([]);
      setLoading(false);
      setError('');
      return undefined;
    }

    setLoading(true);
    setError('');
    return subscribeBankTransactionCandidates(
      (rows) => {
        setCandidates(rows);
        setLoading(false);
      },
      (subscriptionError) => {
        setError(formatSubscriptionError(subscriptionError));
        setLoading(false);
      },
    );
  }, [enabled]);

  return { candidates, loading, error };
};

export const useBankNotificationSettings = (enabled: boolean) => {
  const [settings, setSettings] = useState<BankNotificationSettings>(DEFAULT_BANK_NOTIFICATION_SETTINGS);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!enabled) {
      setSettings(DEFAULT_BANK_NOTIFICATION_SETTINGS);
      setLoading(false);
      setError('');
      return undefined;
    }

    setLoading(true);
    setError('');
    return subscribeBankNotificationSettings(
      (nextSettings) => {
        setSettings(nextSettings);
        setLoading(false);
      },
      (subscriptionError) => {
        setError(formatSubscriptionError(subscriptionError));
        setLoading(false);
      },
    );
  }, [enabled]);

  return { settings, setSettings, loading, error };
};

const DEFAULT_HEALTH: BankNotificationHealth = {
  state: 'unconfigured',
  lastEventAt: null,
  lastDeviceIdMasked: '-',
  lastErrorCode: '',
  updatedAt: null,
};

export const useBankNotificationHealth = (enabled: boolean) => {
  const [health, setHealth] = useState<BankNotificationHealth>(DEFAULT_HEALTH);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!enabled) {
      setHealth(DEFAULT_HEALTH);
      setLoading(false);
      setError('');
      return undefined;
    }

    setLoading(true);
    setError('');
    return subscribeBankNotificationHealth(
      (nextHealth) => {
        setHealth(nextHealth);
        setLoading(false);
      },
      (subscriptionError) => {
        setError(formatSubscriptionError(subscriptionError));
        setLoading(false);
      },
    );
  }, [enabled]);

  useEffect(() => {
    if (health.state !== 'healthy') return undefined;
    const healthySignalAt = toBankDate(health.lastEventAt)?.getTime();
    if (!healthySignalAt) return undefined;
    const delay = healthySignalAt + BANK_HEALTH_STALE_AFTER_MS - Date.now();
    if (delay <= 0) {
      setHealth((current) => ({ ...current, state: 'stale' }));
      return undefined;
    }
    const timeoutId = window.setTimeout(() => {
      setHealth((current) => current.state === 'healthy' ? { ...current, state: 'stale' } : current);
    }, delay + 100);
    return () => window.clearTimeout(timeoutId);
  }, [health.lastEventAt, health.state]);

  return { health, loading, error };
};

export const useNotificationDevices = (uid: string | undefined, enabled: boolean) => {
  const [devices, setDevices] = useState<BankNotificationDevice[]>([]);
  const [loading, setLoading] = useState(Boolean(uid && enabled));
  const [error, setError] = useState('');

  useEffect(() => {
    if (!uid || !enabled) {
      setDevices([]);
      setLoading(false);
      setError('');
      return undefined;
    }

    setLoading(true);
    setError('');
    return subscribeNotificationDevices(
      uid,
      (rows) => {
        setDevices(rows);
        setLoading(false);
      },
      (subscriptionError) => {
        setError(formatSubscriptionError(subscriptionError));
        setLoading(false);
      },
    );
  }, [enabled, uid]);

  return { devices, loading, error };
};

export const useBankNotificationRecipients = (enabled: boolean) => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (!enabled) {
      setUsers([]);
      setLoading(false);
      setError('');
      return () => { cancelled = true; };
    }

    setLoading(true);
    setError('');
    void userService.getAllUsers()
      .then((rows) => {
        if (cancelled) return;
        setUsers(rows.filter((user) => user.status !== 'rejected' && user.status !== 'suspended'));
        setLoading(false);
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(formatSubscriptionError(loadError instanceof Error ? loadError : new Error(String(loadError))));
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [enabled]);

  const recipients = useMemo<BankNotificationRecipient[]>(() => users
    .map((user) => ({
      uid: user.uid,
      displayName: user.displayName || user.email || user.uid,
      email: user.email || '',
      role: String(user.role || user.position || ''),
    }))
    .sort((left, right) => left.displayName.localeCompare(right.displayName, 'ko-KR')),
  [users]);

  return { recipients, loading, error };
};
