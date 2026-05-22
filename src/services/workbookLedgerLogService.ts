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
  WorkbookLedgerEntry,
  WorkbookLedgerTenant,
} from './workbookLedgerService';
import type {
  CreateWorkbookLedgerLogInput,
  WorkbookLedgerFieldChange,
  WorkbookLedgerLog,
  WorkbookLedgerLogAction,
  WorkbookLedgerLogActor,
} from '../types/workbookLedgerLog';

const COLLECTION_NAME = 'workbook_ledger_logs';

const ACTION_LABELS: Record<WorkbookLedgerLogAction, string> = {
  created: '등록',
  updated: '수정',
  deleted: '삭제',
};

const TENANT_LABELS: Record<WorkbookLedgerTenant, string> = {
  cheongyeon: '청연',
  dawon: '다원',
};

const FIELD_LABELS: Record<string, string> = {
  transactionType: '구분',
  date: '거래일',
  partnerName: '거래처',
  siteName: '현장',
  description: '내용',
  manDays: '공수',
  supplyAmount: '공급가액',
  taxAmount: '세액',
  totalAmount: '합계',
  paymentAmount: '입금/지급액',
  appliedYear: '귀속연도',
  appliedMonth: '귀속월',
  matchedEntryId: '매칭 원본',
  sourceType: '출처',
  sourceId: '출처 ID',
  sourceMonth: '출처 월',
  note: '비고',
  teamName: '팀명',
  updatedBy: '수정자',
  deletedAt: '삭제일시',
  deletedBy: '삭제자',
};

const COMPARE_FIELDS = Object.keys(FIELD_LABELS);

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

const normalizeComparableValue = (value: unknown): unknown => {
  if (value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return value;
};

const sameValue = (left: unknown, right: unknown): boolean =>
  JSON.stringify(normalizeComparableValue(left)) === JSON.stringify(normalizeComparableValue(right));

const asText = (value: unknown, fallback = '-'): string => {
  const text = String(value ?? '').trim();
  return text || fallback;
};

const asNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatAmount = (value: unknown): string =>
  asNumber(value).toLocaleString('ko-KR');

const resolveTenantLabel = (tenantKey: string): string =>
  TENANT_LABELS[tenantKey as WorkbookLedgerTenant] || tenantKey || '장부';

const resolveActor = (): WorkbookLedgerLogActor => {
  const user = auth.currentUser;
  if (!user) return { uid: 'system', name: 'ERP 시스템', email: null };
  return {
    uid: user.uid,
    name: user.displayName || user.email || '사용자',
    email: user.email || null,
  };
};

const snapshotEntry = (entry?: Partial<WorkbookLedgerEntry> | null): Partial<WorkbookLedgerEntry> | null => {
  if (!entry) return null;
  return stripUndefined({
    id: entry.id,
    transactionType: entry.transactionType,
    date: entry.date,
    partnerName: entry.partnerName,
    siteName: entry.siteName,
    description: entry.description,
    manDays: entry.manDays ?? null,
    supplyAmount: asNumber(entry.supplyAmount),
    taxAmount: asNumber(entry.taxAmount),
    totalAmount: asNumber(entry.totalAmount),
    paymentAmount: asNumber(entry.paymentAmount),
    appliedYear: entry.appliedYear ?? null,
    appliedMonth: entry.appliedMonth ?? null,
    matchedEntryId: entry.matchedEntryId || null,
    sourceType: entry.sourceType || null,
    sourceId: entry.sourceId || null,
    sourceMonth: entry.sourceMonth || null,
    note: entry.note || '',
    teamName: entry.teamName || '',
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    createdBy: entry.createdBy || null,
    updatedBy: entry.updatedBy || null,
    deletedAt: entry.deletedAt || null,
    deletedBy: entry.deletedBy || null,
  }) as Partial<WorkbookLedgerEntry>;
};

const resolveAnchor = (
  before: Partial<WorkbookLedgerEntry> | null,
  after: Partial<WorkbookLedgerEntry> | null
): Partial<WorkbookLedgerEntry> => after || before || {};

const buildFieldChanges = (
  before: Partial<WorkbookLedgerEntry> | null,
  after: Partial<WorkbookLedgerEntry> | null
): WorkbookLedgerFieldChange[] =>
  COMPARE_FIELDS.reduce<WorkbookLedgerFieldChange[]>((changes, field) => {
    const beforeValue = (before as Record<string, unknown> | null)?.[field] ?? null;
    const afterValue = (after as Record<string, unknown> | null)?.[field] ?? null;
    if (!sameValue(beforeValue, afterValue)) {
      changes.push({
        field,
        label: FIELD_LABELS[field] || field,
        before: normalizeComparableValue(beforeValue),
        after: normalizeComparableValue(afterValue),
      });
    }
    return changes;
  }, []);

const buildSummaryLines = (
  action: WorkbookLedgerLogAction,
  tenantLabel: string,
  anchor: Partial<WorkbookLedgerEntry>,
  fieldChanges: WorkbookLedgerFieldChange[]
): string[] => {
  const lines: string[] = [];
  const transactionType = asText(anchor.transactionType, '구분 없음');
  const partnerName = asText(anchor.partnerName, '거래처 없음');
  const siteName = asText(anchor.siteName, '현장 없음');
  const date = asText(anchor.date, '일자 없음');
  const totalAmount = formatAmount(anchor.totalAmount);
  const paymentAmount = formatAmount(anchor.paymentAmount);

  if (action === 'created') lines.push(`${tenantLabel} 매입매출 장부 행이 등록되었습니다.`);
  if (action === 'updated') {
    lines.push(
      fieldChanges.length > 0
        ? `${tenantLabel} 매입매출 장부 행 ${fieldChanges.length}개 항목이 수정되었습니다.`
        : `${tenantLabel} 매입매출 장부 행이 갱신되었습니다.`
    );
  }
  if (action === 'deleted') lines.push(`${tenantLabel} 매입매출 장부 행이 삭제되었습니다.`);

  lines.push(`${transactionType} / ${date} / ${partnerName}`);
  lines.push(`현장: ${siteName}`);
  if (anchor.description) lines.push(`내용: ${anchor.description}`);
  lines.push(`합계: ${totalAmount}원`);
  if (asNumber(anchor.paymentAmount) !== 0) lines.push(`입금/지급액: ${paymentAmount}원`);
  if (anchor.teamName) lines.push(`팀명: ${anchor.teamName}`);

  if (action === 'updated') {
    fieldChanges.slice(0, 5).forEach((change) => {
      lines.push(`${change.label}: ${asText(change.before)} -> ${asText(change.after)}`);
    });
  }

  return lines;
};

const normalizeLog = (id: string, data: DocumentData): WorkbookLedgerLog => ({
  id,
  action: data.action || 'updated',
  actionLabel: data.actionLabel || ACTION_LABELS[data.action as WorkbookLedgerLogAction] || '변경',
  tenantKey: String(data.tenantKey || ''),
  tenantLabel: String(data.tenantLabel || resolveTenantLabel(String(data.tenantKey || ''))),
  entryId: String(data.entryId || ''),
  transactionType: String(data.transactionType || ''),
  date: String(data.date || ''),
  partnerName: String(data.partnerName || ''),
  siteName: data.siteName ? String(data.siteName) : undefined,
  description: data.description ? String(data.description) : undefined,
  teamName: data.teamName ? String(data.teamName) : undefined,
  sourceType: data.sourceType ? String(data.sourceType) : undefined,
  totalAmount: asNumber(data.totalAmount),
  paymentAmount: asNumber(data.paymentAmount),
  supplyAmount: asNumber(data.supplyAmount),
  taxAmount: asNumber(data.taxAmount),
  note: data.note ? String(data.note) : undefined,
  actor: {
    uid: String(data.actor?.uid || 'system'),
    name: String(data.actor?.name || 'ERP 시스템'),
    email: data.actor?.email || null,
  },
  source: String(data.source || 'workbookLedgerService'),
  before: data.before || null,
  after: data.after || null,
  fieldChanges: Array.isArray(data.fieldChanges) ? data.fieldChanges : [],
  summaryLines: Array.isArray(data.summaryLines) ? data.summaryLines.map(String) : [],
  summaryText: String(data.summaryText || ''),
  changeCount: Number(data.changeCount || 0),
  createdAt: data.createdAt instanceof Timestamp ? data.createdAt : Timestamp.now(),
  createdAtIso: String(data.createdAtIso || ''),
});

export const workbookLedgerLogService = {
  collectionName: COLLECTION_NAME,
  actionLabels: ACTION_LABELS,
  tenantLabels: TENANT_LABELS,

  createLog: async (input: CreateWorkbookLedgerLogInput): Promise<WorkbookLedgerLog> => {
    const before = snapshotEntry(input.before);
    const after = snapshotEntry(input.after);
    const anchor = resolveAnchor(before, after);
    const fieldChanges = input.action === 'updated' ? buildFieldChanges(before, after) : [];
    const tenantLabel = resolveTenantLabel(input.tenantKey);
    const summaryLines = buildSummaryLines(input.action, tenantLabel, anchor, fieldChanges);
    const now = Timestamp.now();
    const logRef = doc(collection(db, COLLECTION_NAME));

    const log: WorkbookLedgerLog = {
      id: logRef.id,
      action: input.action,
      actionLabel: ACTION_LABELS[input.action],
      tenantKey: input.tenantKey,
      tenantLabel,
      entryId: asText(anchor.id, logRef.id),
      transactionType: asText(anchor.transactionType, ''),
      date: asText(anchor.date, ''),
      partnerName: asText(anchor.partnerName, ''),
      siteName: asText(anchor.siteName, ''),
      description: asText(anchor.description, ''),
      teamName: asText(anchor.teamName, ''),
      sourceType: asText(anchor.sourceType, ''),
      totalAmount: asNumber(anchor.totalAmount),
      paymentAmount: asNumber(anchor.paymentAmount),
      supplyAmount: asNumber(anchor.supplyAmount),
      taxAmount: asNumber(anchor.taxAmount),
      note: asText(anchor.note, ''),
      actor: resolveActor(),
      source: input.source || 'workbookLedgerService',
      before,
      after,
      fieldChanges,
      summaryLines,
      summaryText: summaryLines.join('\n'),
      changeCount: input.action === 'updated' ? fieldChanges.length : 1,
      createdAt: now,
      createdAtIso: now.toDate().toISOString(),
    };

    await setDoc(logRef, stripUndefined(log) as Record<string, unknown>);
    return log;
  },

  safeCreateLog: async (input: CreateWorkbookLedgerLogInput): Promise<void> => {
    try {
      await workbookLedgerLogService.createLog(input);
    } catch (error) {
      console.warn('[workbookLedgerLogService] workbook ledger log failed:', error);
    }
  },

  subscribeRecentLogs: (
    callback: (logs: WorkbookLedgerLog[]) => void,
    limitCount = 500,
    onError?: (error: Error) => void
  ): Unsubscribe => {
    const logsQuery = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'), limit(limitCount));
    return onSnapshot(
      logsQuery,
      (snapshot) => callback(snapshot.docs.map((docSnap) => normalizeLog(docSnap.id, docSnap.data()))),
      (error) => {
        console.error('[workbookLedgerLogService] subscribe failed:', error);
        onError?.(error);
      }
    );
  },

  getRecentLogs: async (limitCount = 500): Promise<WorkbookLedgerLog[]> => {
    const logsQuery = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'), limit(limitCount));
    const snapshot = await getDocs(logsQuery);
    return snapshot.docs.map((docSnap) => normalizeLog(docSnap.id, docSnap.data()));
  },
};
