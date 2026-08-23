import {
  Timestamp,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import type {
  CreateSupportCancellationLogInput,
  SupportCancellationActor,
  SupportCancellationLog,
  SupportCancellationReason,
  SupportCancellationResourceType,
} from '../types/supportCancellationLog';
import { SUPPORT_CANCELLATION_REASON_LABELS } from '../types/supportCancellationLog';

const COLLECTION_NAME = 'support_cancellation_logs';

const stripUndefinedDeep = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stripUndefinedDeep);
  if (value && typeof value === 'object') {
    if (value instanceof Timestamp) return value;
    if (typeof (value as { toDate?: unknown }).toDate === 'function') return value;
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .map(([key, entry]) => [key, stripUndefinedDeep(entry)])
    );
  }
  return value;
};

const asText = (value: unknown, fallback = ''): string => {
  const text = String(value ?? '').trim();
  return text || fallback;
};

const asOptionalText = (value: unknown): string | undefined => {
  const text = asText(value);
  return text || undefined;
};

const asNumberOrUndefined = (value: unknown): number | undefined => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
};

const resolveActor = (): SupportCancellationActor => {
  const user = auth.currentUser;
  if (!user) return { uid: 'system', name: 'ERP 시스템', email: null };
  return {
    uid: user.uid,
    name: user.displayName || user.email || '사용자',
    email: user.email || null,
  };
};

const normalizeLog = (id: string, data: DocumentData): SupportCancellationLog => {
  const rawReason = asText(data.reason, 'OTHER') as SupportCancellationReason;
  const reason = SUPPORT_CANCELLATION_REASON_LABELS[rawReason] ? rawReason : 'OTHER';
  return {
    id,
    resourceType: data.resourceType || 'vehicle',
    resourceId: asText(data.resourceId),
    resourceLabel: asText(data.resourceLabel, '대상 미지정'),
    reason,
    reasonLabel: asText(data.reasonLabel, SUPPORT_CANCELLATION_REASON_LABELS[reason] || '기타 처리'),
    processedDate: asText(data.processedDate),
    statusBefore: asOptionalText(data.statusBefore),
    statusAfter: asOptionalText(data.statusAfter),
    assigneeName: asOptionalText(data.assigneeName),
    teamName: asOptionalText(data.teamName),
    billingTargetName: asOptionalText(data.billingTargetName),
    settlementAmount: asNumberOrUndefined(data.settlementAmount),
    note: asText(data.note),
    snapshot: data.snapshot || undefined,
    actor: {
      uid: asText(data.actor?.uid, 'system'),
      name: asText(data.actor?.name, 'ERP 시스템'),
      email: data.actor?.email || null,
    },
    createdAt: data.createdAt,
    createdAtIso: asOptionalText(data.createdAtIso),
  };
};

const filterResourceType = (
  logs: SupportCancellationLog[],
  resourceType?: SupportCancellationResourceType
): SupportCancellationLog[] => {
  if (!resourceType) return logs;
  return logs.filter((log) => log.resourceType === resourceType);
};

export const supportCancellationLogService = {
  collectionName: COLLECTION_NAME,

  createLog: async (
    input: CreateSupportCancellationLogInput,
    options: { operationId?: string } = {}
  ): Promise<SupportCancellationLog> => {
    const now = Timestamp.now();
    const deterministicId = asText(options.operationId).split('/').join('_');
    const logRef = deterministicId
      ? doc(db, COLLECTION_NAME, deterministicId)
      : doc(collection(db, COLLECTION_NAME));
    const reasonLabel = input.reasonLabel || SUPPORT_CANCELLATION_REASON_LABELS[input.reason] || '기타 처리';
    const log: SupportCancellationLog = {
      ...input,
      id: logRef.id,
      reasonLabel,
      actor: resolveActor(),
      createdAt: now,
      createdAtIso: now.toDate().toISOString(),
    };

    await setDoc(logRef, stripUndefinedDeep(log) as Record<string, unknown>);
    return log;
  },

  subscribeRecentLogs: (
    callback: (logs: SupportCancellationLog[]) => void,
    resourceType?: SupportCancellationResourceType,
    limitCount = 500,
    onError?: (error: Error) => void
  ): Unsubscribe => {
    const logsQuery = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'), limit(limitCount));
    return onSnapshot(
      logsQuery,
      (snapshot) => callback(filterResourceType(
        snapshot.docs.map((docSnap) => normalizeLog(docSnap.id, docSnap.data())),
        resourceType
      )),
      (error) => {
        console.error('[supportCancellationLogService] subscribe failed:', error);
        onError?.(error);
      }
    );
  },

  getRecentLogs: async (
    resourceType?: SupportCancellationResourceType,
    limitCount = 500
  ): Promise<SupportCancellationLog[]> => {
    const logsQuery = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'), limit(limitCount));
    const snapshot = await getDocs(logsQuery);
    return filterResourceType(
      snapshot.docs.map((docSnap) => normalizeLog(docSnap.id, docSnap.data())),
      resourceType
    );
  },
};
