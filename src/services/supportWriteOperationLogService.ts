import {
  Timestamp,
  doc,
  setDoc
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import type {
  CreateSupportWriteOperationLogInput,
  SupportWriteOperationActor,
  SupportWriteOperationLog
} from '../types/supportWriteOperation';

export const SUPPORT_WRITE_OPERATIONS_COLLECTION = 'support_write_operations';

const normalizeText = (value: unknown, fallback = ''): string => {
  const text = String(value ?? '').trim();
  return text || fallback;
};

const sanitizeIdPart = (value: unknown): string => (
  normalizeText(value, 'none')
    .replace(/[\\/#?%*:|"<>[\]]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 160) || 'none'
);

const stripUndefinedDeep = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stripUndefinedDeep);
  if (value && typeof value === 'object') {
    if (typeof Timestamp === 'function' && value instanceof Timestamp) return value;
    if (typeof (value as { toDate?: unknown }).toDate === 'function') return value;
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .map(([key, entry]) => [key, stripUndefinedDeep(entry)])
    );
  }
  return value;
};

const resolveActor = (actor?: Partial<SupportWriteOperationActor>): SupportWriteOperationActor => {
  const user = auth.currentUser;
  const uid = normalizeText(actor?.uid, user?.uid || 'system');
  const email = actor?.email ?? user?.email ?? null;
  const name = normalizeText(
    actor?.name,
    user?.displayName || user?.email || 'ERP system'
  );

  return { uid, name, email };
};

const buildOperationLogId = (domain: string, operationId: string): string => (
  `${sanitizeIdPart(domain)}__${sanitizeIdPart(operationId)}`
);

const uniqueIds = (ids: unknown[] = []): string[] => (
  Array.from(new Set(ids.map((id) => normalizeText(id)).filter(Boolean)))
);

export const buildSupportWriteOperationLog = (
  input: CreateSupportWriteOperationLogInput,
  now: Timestamp = Timestamp.now()
): SupportWriteOperationLog => {
  const domain = input.domain;
  const operationId = normalizeText(input.operationId);
  const createdAtIso = now.toDate().toISOString();

  return {
    id: buildOperationLogId(domain, operationId),
    domain,
    yearMonth: normalizeText(input.yearMonth),
    operationId,
    status: input.status,
    affectedDocumentIds: uniqueIds(input.affectedDocumentIds),
    errorMessage: input.errorMessage ? String(input.errorMessage).slice(0, 4000) : undefined,
    userMessage: input.userMessage,
    actor: resolveActor(input.actor),
    metadata: input.metadata,
    createdAt: now,
    createdAtIso,
    updatedAt: now,
    updatedAtIso: createdAtIso
  };
};

export const supportWriteOperationLogService = {
  collectionName: SUPPORT_WRITE_OPERATIONS_COLLECTION,

  recordOperation: async (input: CreateSupportWriteOperationLogInput): Promise<SupportWriteOperationLog> => {
    const log = buildSupportWriteOperationLog(input);
    await setDoc(
      doc(db, SUPPORT_WRITE_OPERATIONS_COLLECTION, log.id),
      stripUndefinedDeep(log) as Record<string, unknown>,
      { merge: true }
    );
    return log;
  }
};

export const recordSupportWriteOperationSafely = async (
  input: CreateSupportWriteOperationLogInput
): Promise<void> => {
  try {
    await supportWriteOperationLogService.recordOperation(input);
  } catch (error) {
    console.error('[supportWriteOperationLogService] record failed', {
      domain: input.domain,
      yearMonth: input.yearMonth,
      operationId: input.operationId,
      status: input.status
    }, error);
  }
};
