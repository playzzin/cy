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
import type { CardBillingCostItem, CardBillingDocument } from '../types/cardBilling';
import type {
  CardBillingChangeSet,
  CardBillingFieldChange,
  CardBillingLineItemChange,
  CardBillingLog,
  CardBillingLogAction,
  CardBillingLogActor,
  CreateCardBillingLogInput,
} from '../types/cardBillingLog';

const COLLECTION_NAME = 'card_billing_logs';

const ACTION_LABELS: Record<CardBillingLogAction, string> = {
  created: '저장',
  updated: '수정',
  deleted: '삭제',
};

const BILLING_FIELD_LABELS: Record<string, string> = {
  yearMonth: '청구 월',
  cardId: '카드 ID',
  cardLabel: '카드',
  assignedTeamId: '배정팀 ID',
  assignedTeamName: '배정팀',
  teamId: '청구대상 팀 ID',
  teamName: '청구대상 팀',
  issuedToType: '청구 방식',
  issuedToWorkerId: '청구대상 개인 ID',
  issuedToWorkerName: '청구대상 개인',
  variableCost: '사용금액',
  totalAmount: '총 청구액',
  status: '상태',
  memo: '메모',
  statementAttachmentPaths: '명세서 첨부',
  confirmedAt: '확정일시',
};

const LINE_ITEM_FIELD_LABELS: Record<string, string> = {
  label: '항목명',
  amount: '금액',
  type: '구분',
  category: '분류',
};

const BILLING_COMPARE_FIELDS = Object.keys(BILLING_FIELD_LABELS);
const LINE_ITEM_COMPARE_FIELDS = Object.keys(LINE_ITEM_FIELD_LABELS);

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
  if (typeof (value as { toDate?: unknown })?.toDate === 'function') {
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

const formatAmount = (value: unknown): string =>
  Number(value || 0).toLocaleString('ko-KR');

const normalizeTimestamp = (value: unknown): Timestamp | undefined => {
  if (!value) return undefined;
  if (value instanceof Timestamp) return value;
  if (typeof (value as { toDate?: unknown }).toDate === 'function') {
    return Timestamp.fromDate((value as { toDate: () => Date }).toDate());
  }
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : Timestamp.fromDate(date);
};

const resolveActor = (): CardBillingLogActor => {
  const user = auth.currentUser;
  if (!user) return { uid: 'system', name: 'ERP 시스템', email: null };
  return {
    uid: user.uid,
    name: user.displayName || user.email || '사용자',
    email: user.email || null,
  };
};

const snapshotLineItem = (item: CardBillingCostItem): CardBillingCostItem => stripUndefined({
  id: item.id,
  label: item.label,
  amount: Number(item.amount || 0),
  type: item.type,
  category: item.category,
}) as CardBillingCostItem;

const snapshotBilling = (billing?: Partial<CardBillingDocument> | null): Partial<CardBillingDocument> | null => {
  if (!billing) return null;
  return stripUndefined({
    id: billing.id,
    yearMonth: billing.yearMonth,
    cardId: billing.cardId,
    cardLabel: billing.cardLabel,
    assignedTeamId: billing.assignedTeamId,
    assignedTeamName: billing.assignedTeamName,
    teamId: billing.teamId,
    teamName: billing.teamName,
    issuedToType: billing.issuedToType,
    issuedToWorkerId: billing.issuedToWorkerId,
    issuedToWorkerName: billing.issuedToWorkerName,
    variableCost: Number(billing.variableCost || 0),
    totalAmount: Number(billing.totalAmount || 0),
    status: billing.status,
    lineItems: Array.isArray(billing.lineItems) ? billing.lineItems.map(snapshotLineItem) : [],
    statementAttachmentPaths: Array.isArray(billing.statementAttachmentPaths) ? billing.statementAttachmentPaths.map(String) : [],
    memo: billing.memo,
    createdAt: normalizeTimestamp(billing.createdAt),
    updatedAt: normalizeTimestamp(billing.updatedAt),
    confirmedAt: normalizeTimestamp(billing.confirmedAt),
  }) as Partial<CardBillingDocument>;
};

const getBillingId = (billing?: Partial<CardBillingDocument> | null): string =>
  asText(billing?.id, '');

const resolveAnchor = (
  before: Partial<CardBillingDocument> | null,
  after: Partial<CardBillingDocument> | null
): Partial<CardBillingDocument> => after || before || {};

const buildFieldChanges = (
  before: Partial<CardBillingDocument> | null,
  after: Partial<CardBillingDocument> | null
): CardBillingFieldChange[] =>
  BILLING_COMPARE_FIELDS.reduce<CardBillingFieldChange[]>((changes, field) => {
    const beforeValue = (before as Record<string, unknown> | null)?.[field] ?? null;
    const afterValue = (after as Record<string, unknown> | null)?.[field] ?? null;
    if (!sameValue(beforeValue, afterValue)) {
      changes.push({
        field,
        label: BILLING_FIELD_LABELS[field] || field,
        before: normalizeComparableValue(beforeValue),
        after: normalizeComparableValue(afterValue),
      });
    }
    return changes;
  }, []);

const getLineItemKey = (item: Partial<CardBillingCostItem>): string =>
  asText(item.id || `${item.label}-${item.category}`, '');

const buildLineItemChange = (
  item: Partial<CardBillingCostItem>,
  before?: Partial<CardBillingCostItem>,
  after?: Partial<CardBillingCostItem>
): CardBillingLineItemChange => ({
  key: getLineItemKey(item) || asText(item.label, '항목'),
  label: asText(item.label, '항목'),
  before,
  after,
});

const buildLineItemChanges = (
  beforeItems: CardBillingCostItem[] = [],
  afterItems: CardBillingCostItem[] = []
): CardBillingChangeSet['lineItemChanges'] => {
  const beforeByKey = new Map(beforeItems.map((item) => [getLineItemKey(item), item]));
  const afterByKey = new Map(afterItems.map((item) => [getLineItemKey(item), item]));
  const added: CardBillingLineItemChange[] = [];
  const removed: CardBillingLineItemChange[] = [];
  const updated: CardBillingLineItemChange[] = [];

  afterByKey.forEach((after, key) => {
    const before = beforeByKey.get(key);
    if (!before) {
      added.push(buildLineItemChange(after, undefined, after));
      return;
    }

    const changes = LINE_ITEM_COMPARE_FIELDS.reduce<CardBillingFieldChange[]>((acc, field) => {
      const beforeValue = (before as unknown as Record<string, unknown>)[field] ?? null;
      const afterValue = (after as unknown as Record<string, unknown>)[field] ?? null;
      if (!sameValue(beforeValue, afterValue)) {
        acc.push({
          field,
          label: LINE_ITEM_FIELD_LABELS[field] || field,
          before: normalizeComparableValue(beforeValue),
          after: normalizeComparableValue(afterValue),
        });
      }
      return acc;
    }, []);

    if (changes.length > 0) {
      updated.push({
        ...buildLineItemChange(after, before, after),
        changes,
      });
    }
  });

  beforeByKey.forEach((before, key) => {
    if (!afterByKey.has(key)) {
      removed.push(buildLineItemChange(before, before, undefined));
    }
  });

  return { added, removed, updated };
};

const buildSummaryLines = (
  action: CardBillingLogAction,
  anchor: Partial<CardBillingDocument>,
  fieldChanges: CardBillingFieldChange[],
  lineItemChanges: CardBillingChangeSet['lineItemChanges']
): string[] => {
  const lines: string[] = [];
  const cardLabel = asText(anchor.cardLabel, '카드 미지정');
  const targetName = asText(anchor.teamName || anchor.assignedTeamName || anchor.issuedToWorkerName, '청구대상 미지정');
  const totalAmount = formatAmount(anchor.totalAmount);

  if (action === 'created') lines.push('카드 청구서가 생성되었습니다.');
  if (action === 'updated') {
    lines.push(
      fieldChanges.length > 0 || lineItemChanges.added.length > 0 || lineItemChanges.removed.length > 0 || lineItemChanges.updated.length > 0
        ? '카드 청구서 내용이 수정되었습니다.'
        : '카드 청구서 저장 값이 갱신되었습니다.'
    );
  }
  if (action === 'deleted') lines.push('카드 청구서가 취소 또는 삭제되었습니다.');

  lines.push(`카드: ${cardLabel}`);
  lines.push(`청구대상: ${targetName}`);
  lines.push(`청구월: ${asText(anchor.yearMonth, '-')}`);
  lines.push(`총 청구액: ${totalAmount}원`);
  if (anchor.status) lines.push(`상태: ${anchor.status}`);

  if (action === 'updated') {
    fieldChanges.slice(0, 5).forEach((change) => {
      lines.push(`${change.label}: ${asText(change.before)} → ${asText(change.after)}`);
    });
    const lineItemCount = lineItemChanges.added.length + lineItemChanges.removed.length + lineItemChanges.updated.length;
    if (lineItemCount > 0) lines.push(`청구 항목 변경: ${lineItemCount}건`);
  }

  return lines;
};

const buildCardBillingChangeSet = (
  action: CardBillingLogAction,
  before: Partial<CardBillingDocument> | null,
  after: Partial<CardBillingDocument> | null
): CardBillingChangeSet => {
  const fieldChanges = action === 'updated' ? buildFieldChanges(before, after) : [];
  const lineItemChanges = action === 'updated'
    ? buildLineItemChanges(before?.lineItems || [], after?.lineItems || [])
    : {
      added: action === 'created' ? (after?.lineItems || []).map((item) => buildLineItemChange(item, undefined, item)) : [],
      removed: action === 'deleted' ? (before?.lineItems || []).map((item) => buildLineItemChange(item, item, undefined)) : [],
      updated: [],
    };
  const anchor = resolveAnchor(before, after);
  const changeCount = fieldChanges.length + lineItemChanges.added.length + lineItemChanges.removed.length + lineItemChanges.updated.length;
  return {
    fieldChanges,
    lineItemChanges,
    summaryLines: buildSummaryLines(action, anchor, fieldChanges, lineItemChanges),
    changeCount: Math.max(changeCount, action === 'updated' ? 0 : 1),
  };
};

const normalizeLog = (id: string, data: DocumentData): CardBillingLog => ({
  id,
  action: data.action || 'updated',
  actionLabel: data.actionLabel || ACTION_LABELS[data.action as CardBillingLogAction] || '변경',
  billingId: String(data.billingId || ''),
  yearMonth: String(data.yearMonth || ''),
  cardId: String(data.cardId || ''),
  cardLabel: String(data.cardLabel || '카드 미지정'),
  teamId: data.teamId ? String(data.teamId) : undefined,
  teamName: data.teamName ? String(data.teamName) : undefined,
  issuedToType: data.issuedToType ? String(data.issuedToType) as CardBillingDocument['issuedToType'] : undefined,
  issuedToWorkerId: data.issuedToWorkerId ? String(data.issuedToWorkerId) : undefined,
  issuedToWorkerName: data.issuedToWorkerName ? String(data.issuedToWorkerName) : undefined,
  status: data.status ? String(data.status) as CardBillingDocument['status'] : undefined,
  actor: {
    uid: String(data.actor?.uid || 'system'),
    name: String(data.actor?.name || 'ERP 시스템'),
    email: data.actor?.email || null,
  },
  source: String(data.source || 'cardBillingService'),
  before: data.before || null,
  after: data.after || null,
  fieldChanges: Array.isArray(data.fieldChanges) ? data.fieldChanges : [],
  lineItemChanges: {
    added: Array.isArray(data.lineItemChanges?.added) ? data.lineItemChanges.added : [],
    removed: Array.isArray(data.lineItemChanges?.removed) ? data.lineItemChanges.removed : [],
    updated: Array.isArray(data.lineItemChanges?.updated) ? data.lineItemChanges.updated : [],
  },
  summaryLines: Array.isArray(data.summaryLines) ? data.summaryLines.map(String) : [],
  summaryText: String(data.summaryText || ''),
  changeCount: Number(data.changeCount || 0),
  createdAt: data.createdAt instanceof Timestamp ? data.createdAt : Timestamp.now(),
  createdAtIso: String(data.createdAtIso || ''),
});

export const cardBillingLogService = {
  collectionName: COLLECTION_NAME,
  actionLabels: ACTION_LABELS,
  buildChangeSet: buildCardBillingChangeSet,

  createLog: async (input: CreateCardBillingLogInput): Promise<CardBillingLog> => {
    const before = snapshotBilling(input.before);
    const after = snapshotBilling(input.after);
    const anchor = resolveAnchor(before, after);
    const changeSet = buildCardBillingChangeSet(input.action, before, after);
    const now = Timestamp.now();
    const logRef = doc(collection(db, COLLECTION_NAME));

    const log: CardBillingLog = {
      id: logRef.id,
      action: input.action,
      actionLabel: ACTION_LABELS[input.action],
      billingId: getBillingId(anchor) || logRef.id,
      yearMonth: asText(anchor.yearMonth, ''),
      cardId: asText(anchor.cardId, ''),
      cardLabel: asText(anchor.cardLabel, '카드 미지정'),
      teamId: anchor.teamId || undefined,
      teamName: anchor.teamName || anchor.assignedTeamName || undefined,
      issuedToType: anchor.issuedToType,
      issuedToWorkerId: anchor.issuedToWorkerId,
      issuedToWorkerName: anchor.issuedToWorkerName,
      status: anchor.status,
      actor: resolveActor(),
      source: input.source || 'cardBillingService',
      before,
      after,
      fieldChanges: changeSet.fieldChanges,
      lineItemChanges: changeSet.lineItemChanges,
      summaryLines: changeSet.summaryLines,
      summaryText: changeSet.summaryLines.join('\n'),
      changeCount: changeSet.changeCount,
      createdAt: now,
      createdAtIso: now.toDate().toISOString(),
    };

    await setDoc(logRef, stripUndefined(log) as Record<string, unknown>);

    try {
      const { systemMessageService } = await import('./systemMessageService');
      await systemMessageService.notifyCardBillingLogEvent(log);
    } catch (error) {
      console.warn('[cardBillingLogService] card billing log notification failed:', error);
    }

    return log;
  },

  subscribeRecentLogs: (
    callback: (logs: CardBillingLog[]) => void,
    limitCount = 300,
    onError?: (error: Error) => void
  ): Unsubscribe => {
    const logsQuery = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'), limit(limitCount));
    return onSnapshot(
      logsQuery,
      (snapshot) => callback(snapshot.docs.map((docSnap) => normalizeLog(docSnap.id, docSnap.data()))),
      (error) => {
        console.error('[cardBillingLogService] subscribe failed:', error);
        onError?.(error);
      }
    );
  },

  getRecentLogs: async (limitCount = 300): Promise<CardBillingLog[]> => {
    const logsQuery = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'), limit(limitCount));
    const snapshot = await getDocs(logsQuery);
    return snapshot.docs.map((docSnap) => normalizeLog(docSnap.id, docSnap.data()));
  },
};
