import {
  Timestamp,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { createDevAdminUser, isDevAdminSessionEnabled } from '../utils/devAdminSession';
import { loginMethodLabel, loginProviderLabel } from '../utils/loginLogLabels';
import type {
  CreateLoginLogInput,
  LoginLog,
  LoginLogAction,
  LoginLogActor,
  LoginLogClient,
  LoginLogStatus,
} from '../types/loginLog';

const COLLECTION_NAME = 'login_logs';
const DEV_STORAGE_KEY = 'cy_dev_login_logs_v1';
const DEV_LOG_CHANGED_EVENT = 'cy:login-log-changed';
const MAX_LOGS = 500;

const ACTION_LABELS: Record<LoginLogAction, string> = {
  login_success: '로그인 성공',
  login_failed: '로그인 실패',
  logout: '로그아웃',
  signup_success: '회원가입',
  session_access: '앱 재접속',
};

const STATUS_LABELS: Record<LoginLogStatus, string> = {
  success: '성공',
  failed: '실패',
  info: '정보',
};

const sanitizeText = (value: unknown, fallback = ''): string => {
  const text = String(value ?? '').trim();
  return text || fallback;
};

const parseBrowser = (userAgent: string): string => {
  if (/OPR\//i.test(userAgent) || /Opera/i.test(userAgent)) return 'Opera';
  if (/Edg\//i.test(userAgent)) return 'Microsoft Edge';
  if (/Chrome\//i.test(userAgent) && !/Chromium/i.test(userAgent)) return 'Chrome';
  if (/Firefox\//i.test(userAgent)) return 'Firefox';
  if (/Safari\//i.test(userAgent) && !/Chrome\//i.test(userAgent)) return 'Safari';
  return userAgent ? 'Unknown Browser' : 'Unknown';
};

const parseOs = (userAgent: string, platform: string): string => {
  const source = `${userAgent} ${platform}`;
  if (/Windows/i.test(source)) return 'Windows';
  if (/iPhone|iPad|iPod/i.test(source)) return 'iOS';
  if (/Mac OS|MacIntel|Macintosh/i.test(source)) return 'macOS';
  if (/Android/i.test(source)) return 'Android';
  if (/Linux/i.test(source)) return 'Linux';
  return source.trim() ? 'Unknown OS' : 'Unknown';
};

const resolveClient = (): LoginLogClient => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      userAgent: 'server',
      browser: 'Server',
      os: 'Server',
      platform: 'server',
      language: 'ko-KR',
      timezone: 'Asia/Seoul',
      path: '',
      referrer: '',
      screen: '',
      viewport: '',
    };
  }

  const userAgent = navigator.userAgent || '';
  const platform = navigator.platform || '';
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Seoul';

  return {
    userAgent,
    browser: parseBrowser(userAgent),
    os: parseOs(userAgent, platform),
    platform,
    language: navigator.language || '',
    timezone,
    // Query strings and fragments can contain login codes or private searches.
    path: window.location.pathname,
    referrer: safeReferrer(document.referrer),
    screen: `${window.screen?.width || 0}x${window.screen?.height || 0}`,
    viewport: `${window.innerWidth || 0}x${window.innerHeight || 0}`,
  };
};

const resolveActor = (input: CreateLoginLogInput): LoginLogActor => {
  const user = input.action === 'login_failed' ? input.user ?? null
    : input.user ?? (isDevAdminSessionEnabled() ? createDevAdminUser() : auth.currentUser);
  return {
    uid: user?.uid || null,
    email: input.email || user?.email || null,
    displayName: user?.displayName || user?.email || input.email || null,
    photoURL: user?.photoURL || null,
  };
};

const resolveStatus = (action: LoginLogAction, status?: LoginLogStatus): LoginLogStatus => {
  if (status) return status;
  if (action === 'login_failed') return 'failed';
  if (action === 'logout') return 'info';
  return 'success';
};

const buildSummaryLines = (log: Omit<LoginLog, 'summaryLines' | 'summaryText'>): string[] => {
  const actorName = log.actor.displayName || log.actor.email || '알 수 없는 사용자';
  const lines = [
    `${ACTION_LABELS[log.action]} 기록이 저장되었습니다.`,
    `대상 계정: ${actorName}${log.actor.email && log.actor.email !== actorName ? ` (${log.actor.email})` : ''}`,
    `접속 방식: ${loginProviderLabel(log.provider)} / ${loginMethodLabel(log.method)}`,
    `접속 환경: ${log.client.browser}, ${log.client.os}, ${log.client.viewport}`,
    `접속 경로: ${log.client.path || '-'}`,
  ];

  if (log.errorMessage) {
    lines.push(`실패 사유: ${log.errorCode ? `${log.errorCode} - ` : ''}${log.errorMessage}`);
  }

  return lines;
};

const stripUndefined = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map((entry) => stripUndefined(entry));
  if (value && typeof value === 'object') {
    if (value instanceof Timestamp) return value;
    if (typeof (value as { toDate?: unknown }).toDate === 'function') return value;
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .map(([key, entry]) => [key, stripUndefined(entry)])
    );
  }
  return value === undefined ? null : value;
};

const normalizeLog = (id: string, data: DocumentData): LoginLog => ({
  id,
  action: data.action || 'login_success',
  actionLabel: data.actionLabel || ACTION_LABELS[data.action as LoginLogAction] || '로그인',
  status: data.status || 'success',
  provider: String(data.provider || 'unknown'),
  method: String(data.method || 'unknown'),
  actor: {
    uid: data.actor?.uid || null,
    email: data.actor?.email || data.email || null,
    displayName: data.actor?.displayName || data.actor?.email || data.email || null,
    photoURL: data.actor?.photoURL || null,
  },
  email: data.email || data.actor?.email || null,
  summaryLines: Array.isArray(data.summaryLines) ? data.summaryLines.map(String) : [],
  summaryText: String(data.summaryText || ''),
  errorCode: data.errorCode || null,
  errorMessage: data.errorMessage || null,
  client: {
    userAgent: String(data.client?.userAgent || ''),
    browser: String(data.client?.browser || 'Unknown'),
    os: String(data.client?.os || 'Unknown'),
    platform: String(data.client?.platform || ''),
    language: String(data.client?.language || ''),
    timezone: String(data.client?.timezone || ''),
    path: String(data.client?.path || ''),
    referrer: String(data.client?.referrer || ''),
    screen: String(data.client?.screen || ''),
    viewport: String(data.client?.viewport || ''),
  },
  createdAt: normalizeTimestamp(data.createdAt, data.createdAtIso),
  createdAtIso: String(data.createdAtIso || ''),
});

function safeReferrer(value: string): string {
  if (!value) return '';
  try { const url = new URL(value); return `${url.origin}${url.pathname}`; }
  catch { return ''; }
}

function normalizeTimestamp(value: unknown, iso: unknown): Timestamp {
  if (value instanceof Timestamp) return value;
  const date = new Date(String(iso || ''));
  return Number.isNaN(date.getTime()) ? Timestamp.fromMillis(0) : Timestamp.fromDate(date);
}

const readDevLogs = (limitCount: number): LoginLog[] => {
  const rows = JSON.parse(window.localStorage.getItem(DEV_STORAGE_KEY) || '[]');
  if (!Array.isArray(rows)) throw new Error('개발용 접속 기록을 읽을 수 없습니다.');
  return rows.map((row) => normalizeLog(row.id, row))
    .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis()).slice(0, limitCount);
};

export const loginLogService = {
  collectionName: COLLECTION_NAME,
  actionLabels: ACTION_LABELS,
  statusLabels: STATUS_LABELS,

  createLog: async (input: CreateLoginLogInput): Promise<LoginLog> => {
    const isDev = isDevAdminSessionEnabled();
    const now = Timestamp.now();
    const actor = resolveActor(input);
    const logRef = doc(collection(db, COLLECTION_NAME));
    const baseLog: Omit<LoginLog, 'summaryLines' | 'summaryText'> = {
      id: logRef.id,
      action: input.action,
      actionLabel: ACTION_LABELS[input.action],
      status: resolveStatus(input.action, input.status),
      provider: sanitizeText(input.provider, 'unknown'),
      method: sanitizeText(input.method, 'unknown'),
      actor,
      email: input.email || actor.email,
      errorCode: input.errorCode || null,
      errorMessage: input.errorMessage || null,
      client: resolveClient(),
      createdAt: now,
      createdAtIso: now.toDate().toISOString(),
    };
    const summaryLines = buildSummaryLines(baseLog);
    const log: LoginLog = {
      ...baseLog,
      summaryLines,
      summaryText: summaryLines.join('\n'),
    };

    if (isDev) {
      window.localStorage.setItem(DEV_STORAGE_KEY, JSON.stringify([log, ...readDevLogs(MAX_LOGS)].slice(0, MAX_LOGS)));
      window.dispatchEvent(new Event(DEV_LOG_CHANGED_EVENT));
    } else {
      await setDoc(logRef, { ...(stripUndefined(log) as Record<string, unknown>), createdAt: serverTimestamp() });
    }

    if (!isDev && auth.currentUser && input.action !== 'session_access') {
      try {
        const { systemMessageService } = await import('./systemMessageService');
        await systemMessageService.notifyLoginLogEvent(log);
      } catch (error) {
        console.warn('[loginLogService] login log notification failed:', error);
      }
    }

    return log;
  },

  safeCreateLog: async (input: CreateLoginLogInput): Promise<boolean> => {
    try {
      await loginLogService.createLog(input);
      return true;
    } catch {
      console.warn('[loginLogService] 접속 기록을 저장하지 못했습니다.');
      return false;
    }
  },

  subscribeRecentLogs: (
    callback: (logs: LoginLog[]) => void,
    limitCount = 300,
    onError?: (error: Error) => void
  ): Unsubscribe => {
    if (isDevAdminSessionEnabled()) {
      const refresh = () => {
        try { callback(readDevLogs(limitCount)); }
        catch { onError?.(new Error('개발용 접속 기록을 읽을 수 없습니다.')); }
      };
      const onStorage = (event: StorageEvent) => {
        if (event.storageArea === window.localStorage && (event.key === DEV_STORAGE_KEY || event.key === null)) refresh();
      };
      window.addEventListener(DEV_LOG_CHANGED_EVENT, refresh);
      window.addEventListener('storage', onStorage);
      refresh();
      return () => {
        window.removeEventListener(DEV_LOG_CHANGED_EVENT, refresh);
        window.removeEventListener('storage', onStorage);
      };
    }
    const logsQuery = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'), limit(limitCount));
    return onSnapshot(
      logsQuery,
      (snapshot) => callback(snapshot.docs.map((docSnap) => normalizeLog(docSnap.id, docSnap.data()))),
      (error) => {
        console.error('[loginLogService] subscribe failed:', error);
        onError?.(error);
      }
    );
  },

  getRecentLogs: async (limitCount = 300): Promise<LoginLog[]> => {
    if (isDevAdminSessionEnabled()) return readDevLogs(limitCount);
    const logsQuery = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'), limit(limitCount));
    const snapshot = await getDocs(logsQuery);
    return snapshot.docs.map((docSnap) => normalizeLog(docSnap.id, docSnap.data()));
  },
};
