import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../config/firebase';
import {
  DEFAULT_BANK_NOTIFICATION_SETTINGS,
  type BankNotificationActor,
  type BankNotificationDevice,
  type BankNotificationHealth,
  type BankNotificationPermission,
  type BankNotificationSettings,
  type BankTransactionCandidate,
  type BankTransactionStatus,
} from './types';
import {
  maskAccountIdentifier,
  maskSensitiveMessage,
  maskSourceIdentifier,
  normalizeBankNotificationSettings,
  normalizeCandidateDirection,
  normalizeCandidateStatus,
  resolveBankNotificationHealthState,
  toBankDate,
  toFiniteNumber,
} from './bankNotificationUtils';

export const BANK_NOTIFICATION_COLLECTIONS = {
  candidates: 'bank_transaction_candidates',
  settings: 'bank_notification_settings',
  devices: 'notification_devices',
  health: 'bank_notification_health',
} as const;

export const BANK_NOTIFICATION_SETTINGS_DOCUMENT_ID = 'global';
export const BANK_NOTIFICATION_HEALTH_DOCUMENT_ID = 'current';
const CURRENT_DEVICE_STORAGE_PREFIX = 'cy-bank-push-device:';

const readText = (value: unknown): string => String(value ?? '').trim();

const readOptionalNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = toFiniteNumber(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : null;
};

const readReviewer = (value: unknown): { id: string; name: string } => {
  if (typeof value === 'string') return { id: value, name: '' };
  if (!value || typeof value !== 'object') return { id: '', name: '' };
  const reviewer = value as Record<string, unknown>;
  return {
    id: readText(reviewer.uid ?? reviewer.id),
    name: readText(reviewer.displayName ?? reviewer.name ?? reviewer.email),
  };
};

export const mapBankCandidateDocument = (
  snapshot: Pick<QueryDocumentSnapshot<DocumentData>, 'id' | 'data'>,
): BankTransactionCandidate => {
  const data = snapshot.data();
  const reviewer = readReviewer(data.reviewedBy);
  const accountSource = data.accountMasked
    ?? data.accountNumberMasked
    ?? data.accountNumber
    ?? data.account
    ?? (data.accountSuffix ? `••••${readText(data.accountSuffix)}` : '');
  const source = data.sourceMasked ?? data.senderText ?? data.senderMasked ?? data.sender ?? data.source;
  const messagePreview = data.messagePreview ?? data.smsPreview ?? data.rawMessage ?? data.message;

  return {
    id: snapshot.id,
    status: normalizeCandidateStatus(data.status),
    direction: normalizeCandidateDirection(data.direction ?? data.transactionType ?? data.type),
    amount: Math.max(0, toFiniteNumber(data.amount, 0)),
    balance: readOptionalNumber(data.balance),
    bankName: readText(data.bankName ?? data.providerName) || (readText(data.provider).toLowerCase() === 'kb' ? 'KB국민은행' : '은행'),
    accountMasked: maskAccountIdentifier(accountSource),
    sourceMasked: maskSourceIdentifier(source),
    counterpartyMasked: maskSourceIdentifier(data.counterpartyMasked ?? data.counterparty ?? data.ownerName),
    memo: maskSensitiveMessage(data.memo ?? data.description),
    messagePreview: maskSensitiveMessage(messagePreview),
    transactionAt: data.transactionAt ?? data.occurredAt ?? data.transactionDate ?? null,
    receivedAt: data.receivedAt ?? data.ingestedAt ?? null,
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
    parseError: readText(data.parseError ?? data.errorMessage),
    parserVersion: readText(data.parseVersion ?? data.parserVersion),
    confidence: readOptionalNumber(data.confidence),
    reviewedById: reviewer.id,
    reviewedByName: reviewer.name,
    reviewedAt: data.reviewedAt ?? null,
  };
};

const sortCandidatesNewestFirst = (candidates: BankTransactionCandidate[]): BankTransactionCandidate[] => (
  [...candidates].sort((left, right) => {
    const leftTime = toBankDate(left.transactionAt)?.getTime()
      ?? toBankDate(left.receivedAt)?.getTime()
      ?? toBankDate(left.createdAt)?.getTime()
      ?? 0;
    const rightTime = toBankDate(right.transactionAt)?.getTime()
      ?? toBankDate(right.receivedAt)?.getTime()
      ?? toBankDate(right.createdAt)?.getTime()
      ?? 0;
    return rightTime - leftTime;
  })
);

export const subscribeBankTransactionCandidates = (
  onChange: (candidates: BankTransactionCandidate[]) => void,
  onError?: (error: Error) => void,
  maximumRows = 300,
): Unsubscribe => {
  const candidatesQuery = query(
    collection(db, BANK_NOTIFICATION_COLLECTIONS.candidates),
    orderBy('createdAt', 'desc'),
    limit(Math.max(1, maximumRows)),
  );

  return onSnapshot(
    candidatesQuery,
    (snapshot) => onChange(sortCandidatesNewestFirst(snapshot.docs.map(mapBankCandidateDocument))),
    (error) => onError?.(error),
  );
};

const transitionCandidate = async (
  candidateId: string,
  nextStatus: Extract<BankTransactionStatus, 'confirmed' | 'ignored'>,
  actor: BankNotificationActor,
): Promise<void> => {
  const reference = doc(db, BANK_NOTIFICATION_COLLECTIONS.candidates, candidateId);

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists()) throw new Error('candidate-not-found');

    const currentStatus = normalizeCandidateStatus(snapshot.data().status);
    const canTransition = nextStatus === 'confirmed'
      ? currentStatus === 'pending'
      : currentStatus === 'pending' || currentStatus === 'parse_failed';

    if (!canTransition) throw new Error('candidate-already-reviewed');

    transaction.update(reference, {
      status: nextStatus,
      reviewedBy: {
        uid: actor.uid,
        displayName: actor.displayName,
        email: actor.email ?? null,
      },
      reviewedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
};

export const confirmBankTransactionCandidate = (
  candidateId: string,
  actor: BankNotificationActor,
): Promise<void> => transitionCandidate(candidateId, 'confirmed', actor);

export const ignoreBankTransactionCandidate = (
  candidateId: string,
  actor: BankNotificationActor,
): Promise<void> => transitionCandidate(candidateId, 'ignored', actor);

export interface ReprocessBankSmsResult {
  success: boolean;
  parseStatus: 'parsed' | 'unknown' | 'failed';
  errorCode: string | null;
  parserVersion: string;
}

export const reprocessBankSmsCandidate = async (
  candidateId: string,
): Promise<ReprocessBankSmsResult> => {
  const callable = httpsCallable<{ candidateId: string }, ReprocessBankSmsResult>(
    functions,
    'reprocessBankSmsCandidate',
  );
  const result = await callable({ candidateId });
  return result.data;
};

const settingsReference = () => doc(
  db,
  BANK_NOTIFICATION_COLLECTIONS.settings,
  BANK_NOTIFICATION_SETTINGS_DOCUMENT_ID,
);

export const subscribeBankNotificationSettings = (
  onChange: (settings: BankNotificationSettings) => void,
  onError?: (error: Error) => void,
): Unsubscribe => onSnapshot(
  settingsReference(),
  (snapshot) => onChange(
    snapshot.exists()
      ? normalizeBankNotificationSettings(snapshot.data())
      : normalizeBankNotificationSettings(DEFAULT_BANK_NOTIFICATION_SETTINGS),
  ),
  (error) => onError?.(error),
);

export const getBankNotificationSettings = async (): Promise<BankNotificationSettings> => {
  const snapshot = await getDoc(settingsReference());
  return snapshot.exists()
    ? normalizeBankNotificationSettings(snapshot.data())
    : normalizeBankNotificationSettings(DEFAULT_BANK_NOTIFICATION_SETTINGS);
};

export const saveBankNotificationSettings = async (
  settings: BankNotificationSettings,
  actor: BankNotificationActor,
): Promise<void> => {
  const normalized = normalizeBankNotificationSettings(settings);
  if (normalized.directions.length === 0) throw new Error('direction-required');

  await setDoc(settingsReference(), {
    enabled: normalized.enabled,
    recipientIds: normalized.recipientIds,
    minimumAmount: normalized.minimumAmount,
    directions: normalized.directions,
    notifyOnParseFailure: normalized.notifyOnParseFailure,
    quietHours: normalized.quietHours,
    updatedById: actor.uid,
    updatedByName: actor.displayName,
    updatedAt: serverTimestamp(),
  }, { merge: true });
};

const createFallbackHash = (input: string): string => {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

const createDeviceId = async (uid: string, token: string): Promise<string> => {
  const source = `${uid}:${token}`;
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof TextEncoder !== 'undefined') {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source));
    return `web_${Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')}`;
  }
  return `web_${createFallbackHash(source)}`;
};

const mapNotificationDeviceDocument = (
  snapshot: Pick<QueryDocumentSnapshot<DocumentData>, 'id' | 'data'>,
): BankNotificationDevice => {
  const data = snapshot.data();
  const rawPermission = readText(data.permission);
  const permission: BankNotificationPermission = ['default', 'denied', 'granted', 'unsupported'].includes(rawPermission)
    ? rawPermission as BankNotificationPermission
    : 'default';

  return {
    id: snapshot.id,
    uid: readText(data.uid),
    token: readText(data.token ?? data.fcmToken),
    platform: 'web',
    label: readText(data.label) || '웹 브라우저',
    browser: readText(data.browser),
    userAgent: readText(data.userAgent),
    permission,
    enabled: data.enabled !== false,
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
    lastSeenAt: data.lastSeenAt ?? null,
  };
};

const sortDevicesNewestFirst = (devices: BankNotificationDevice[]): BankNotificationDevice[] => (
  [...devices].sort((left, right) => (
    (toBankDate(right.lastSeenAt)?.getTime() ?? toBankDate(right.createdAt)?.getTime() ?? 0)
    - (toBankDate(left.lastSeenAt)?.getTime() ?? toBankDate(left.createdAt)?.getTime() ?? 0)
  ))
);

export const subscribeNotificationDevices = (
  uid: string,
  onChange: (devices: BankNotificationDevice[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe => {
  const devicesQuery = query(
    collection(db, BANK_NOTIFICATION_COLLECTIONS.devices),
    where('uid', '==', uid),
  );

  return onSnapshot(
    devicesQuery,
    (snapshot) => onChange(sortDevicesNewestFirst(snapshot.docs.map(mapNotificationDeviceDocument))),
    (error) => onError?.(error),
  );
};

export interface RegisterNotificationDeviceInput {
  uid: string;
  token: string;
  label: string;
  browser: string;
  userAgent: string;
  permission: BankNotificationPermission;
}

export const registerNotificationDevice = async (
  input: RegisterNotificationDeviceInput,
): Promise<string> => {
  const deviceId = await createDeviceId(input.uid, input.token);
  const reference = doc(db, BANK_NOTIFICATION_COLLECTIONS.devices, deviceId);
  const existing = await getDoc(reference);

  await setDoc(reference, {
    uid: input.uid,
    token: input.token,
    platform: 'web',
    label: input.label,
    browser: input.browser,
    userAgent: input.userAgent,
    permission: input.permission,
    enabled: true,
    ...(existing.exists() ? {} : { createdAt: serverTimestamp() }),
    updatedAt: serverTimestamp(),
    lastSeenAt: serverTimestamp(),
  }, { merge: true });

  return deviceId;
};

export const rememberCurrentNotificationDevice = (uid: string, deviceId: string): void => {
  if (typeof window === 'undefined' || !uid || !/^web_[a-f0-9]{8,64}$/.test(deviceId)) return;
  window.localStorage.setItem(`${CURRENT_DEVICE_STORAGE_PREFIX}${uid}`, deviceId);
};

export const forgetCurrentNotificationDevice = (uid: string): void => {
  if (typeof window === 'undefined' || !uid) return;
  window.localStorage.removeItem(`${CURRENT_DEVICE_STORAGE_PREFIX}${uid}`);
};

/** Revokes this browser's remembered registration while Firebase auth is still active. */
export const disableRememberedNotificationDevice = async (uid: string): Promise<boolean> => {
  if (typeof window === 'undefined' || !uid) return false;
  const key = `${CURRENT_DEVICE_STORAGE_PREFIX}${uid}`;
  const deviceId = window.localStorage.getItem(key) || '';
  if (!/^web_[a-f0-9]{8,64}$/.test(deviceId)) return false;

  await setNotificationDeviceEnabled(deviceId, false);
  window.localStorage.removeItem(key);
  return true;
};

export const setNotificationDeviceEnabled = async (
  deviceId: string,
  enabled: boolean,
): Promise<void> => {
  await updateDoc(doc(db, BANK_NOTIFICATION_COLLECTIONS.devices, deviceId), {
    enabled,
    updatedAt: serverTimestamp(),
  });
};

export const disableNotificationDeviceForToken = async (
  uid: string,
  token: string,
): Promise<void> => {
  const deviceId = await createDeviceId(uid, token);
  await setDoc(doc(db, BANK_NOTIFICATION_COLLECTIONS.devices, deviceId), {
    uid,
    token,
    platform: 'web',
    enabled: false,
    permission: typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
    updatedAt: serverTimestamp(),
  }, { merge: true });
};

const maskDeviceId = (value: unknown): string => {
  const text = readText(value);
  if (!text) return '-';
  return text.length <= 6 ? '••••••' : `••••${text.slice(-6)}`;
};

export const subscribeBankNotificationHealth = (
  onChange: (health: BankNotificationHealth) => void,
  onError?: (error: Error) => void,
): Unsubscribe => onSnapshot(
  doc(db, BANK_NOTIFICATION_COLLECTIONS.health, BANK_NOTIFICATION_HEALTH_DOCUMENT_ID),
  (snapshot) => {
    const data = snapshot.exists() ? snapshot.data() : {};
    const parserStatus = readText(data.lastParserStatus).toLowerCase();
    const healthySignals = [data.lastSuccessfulIngestionAt, data.lastConnectionTestAt]
      .map((value) => ({ value, time: toBankDate(value)?.getTime() ?? 0 }))
      .sort((left, right) => right.time - left.time);
    const state = resolveBankNotificationHealthState({
      documentExists: snapshot.exists(),
      lastSuccessfulIngestionAt: data.lastSuccessfulIngestionAt,
      lastConnectionTestAt: data.lastConnectionTestAt,
      lastParserStatus: parserStatus,
    });
    onChange({
      state,
      lastEventAt: healthySignals[0]?.time
        ? healthySignals[0].value
        : data.lastReceivedAt ?? null,
      lastDeviceIdMasked: maskDeviceId(data.lastBridgeDeviceHash),
      // Parser failures are represented by parse_failed candidates and do not
      // imply that the Android bridge itself is disconnected.
      lastErrorCode: '',
      updatedAt: data.updatedAt ?? null,
    });
  },
  (error) => onError?.(error),
);
