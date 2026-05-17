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
  CreateMaterialLogInput,
  MaterialFieldChange,
  MaterialLog,
  MaterialLogAction,
  MaterialLogActor,
  MaterialLogEntityType,
} from '../types/materialLog';

const COLLECTION_NAME = 'material_logs';

const ACTION_LABELS: Record<MaterialLogAction, string> = {
  created: '저장',
  updated: '수정',
  deleted: '삭제',
};

const ENTITY_LABELS: Record<MaterialLogEntityType, string> = {
  material: '자재 마스터',
  inbound: '입고 내역',
  outbound: '출고 내역',
};

const FIELD_LABELS: Record<string, string> = {
  id: 'ID',
  materialId: '자재 ID',
  materialKey: '자재 키',
  category: '분류',
  itemName: '품명',
  spec: '규격',
  unit: '단위',
  unitPrice: '단가',
  safetyStock: '안전재고',
  description: '설명',
  isActive: '사용 여부',
  isCatalogDefault: '기본 카탈로그 여부',
  hiddenCatalogDefault: '기본 카탈로그 숨김',
  transactionDate: '거래일자',
  siteId: '현장 ID',
  siteName: '현장명',
  vehicleNumber: '차량번호',
  quantity: '수량',
  amount: '금액',
  supplier: '입고처',
  invoiceNumber: '송장번호',
  recipient: '출고자/수령자',
  recipientPhone: '연락처',
  deliveryStatus: '배송 상태',
  notes: '비고',
  remarks: '비고',
  registeredBy: '등록자 ID',
  registeredByName: '등록자',
};

const ENTITY_COMPARE_FIELDS: Record<MaterialLogEntityType, string[]> = {
  material: [
    'category',
    'itemName',
    'spec',
    'unit',
    'unitPrice',
    'safetyStock',
    'description',
    'isActive',
    'isCatalogDefault',
    'hiddenCatalogDefault',
  ],
  inbound: [
    'transactionDate',
    'siteId',
    'siteName',
    'vehicleNumber',
    'materialId',
    'materialKey',
    'category',
    'itemName',
    'spec',
    'quantity',
    'unit',
    'supplier',
    'invoiceNumber',
    'notes',
    'remarks',
    'registeredByName',
  ],
  outbound: [
    'transactionDate',
    'siteId',
    'siteName',
    'vehicleNumber',
    'materialId',
    'materialKey',
    'category',
    'itemName',
    'spec',
    'quantity',
    'unit',
    'recipient',
    'recipientPhone',
    'deliveryStatus',
    'notes',
    'remarks',
    'registeredByName',
  ],
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

const normalizeValue = (value: unknown): unknown => {
  if (value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  return value;
};

const sameValue = (left: unknown, right: unknown): boolean =>
  JSON.stringify(normalizeValue(left)) === JSON.stringify(normalizeValue(right));

const asRecord = (value?: Record<string, unknown> | null): Record<string, unknown> | null =>
  value ? stripUndefined(value) as Record<string, unknown> : null;

const asText = (value: unknown, fallback = '-'): string => {
  const text = String(value ?? '').trim();
  return text || fallback;
};

const asNumber = (value: unknown): number | undefined => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
};

const formatQuantity = (value: unknown): string =>
  Number(value || 0).toLocaleString('ko-KR', {
    maximumFractionDigits: 2,
  });

const buildFieldChanges = (
  entityType: MaterialLogEntityType,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null
): MaterialFieldChange[] =>
  ENTITY_COMPARE_FIELDS[entityType].reduce<MaterialFieldChange[]>((changes, field) => {
    const beforeValue = before?.[field] ?? null;
    const afterValue = after?.[field] ?? null;
    if (!sameValue(beforeValue, afterValue)) {
      changes.push({
        field,
        label: FIELD_LABELS[field] || field,
        before: normalizeValue(beforeValue),
        after: normalizeValue(afterValue),
      });
    }
    return changes;
  }, []);

const resolveActor = (): MaterialLogActor => {
  const user = auth.currentUser;
  if (!user) return { uid: 'system', name: 'ERP 시스템', email: null };
  return {
    uid: user.uid,
    name: user.displayName || user.email || '사용자',
    email: user.email || null,
  };
};

const resolveAnchor = (
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null
): Record<string, unknown> => after || before || {};

const resolveEntityId = (anchor: Record<string, unknown>): string =>
  asText(anchor.id || anchor.materialId || anchor.materialKey, '');

const resolveMaterialName = (anchor: Record<string, unknown>): string => {
  const itemName = asText(anchor.itemName, '');
  const spec = asText(anchor.spec, '');
  if (itemName && spec) return `${itemName} / ${spec}`;
  return itemName || spec || asText(anchor.materialName || anchor.materialId || anchor.materialKey, '자재 미지정');
};

const buildSummaryLines = (
  action: MaterialLogAction,
  entityType: MaterialLogEntityType,
  anchor: Record<string, unknown>,
  fieldChanges: MaterialFieldChange[],
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null
): string[] => {
  const entityLabel = ENTITY_LABELS[entityType];
  const materialName = resolveMaterialName(anchor);
  const siteName = asText(anchor.siteName, '');
  const transactionDate = asText(anchor.transactionDate, '');
  const lines: string[] = [];

  if (action === 'created') lines.push(`${entityLabel}이 신규 저장되었습니다.`);
  if (action === 'updated') {
    lines.push(
      fieldChanges.length > 0
        ? `${entityLabel} ${fieldChanges.length}개 항목이 수정되었습니다.`
        : `${entityLabel} 저장 값이 갱신되었습니다.`
    );
  }
  if (action === 'deleted') lines.push(`${entityLabel}이 삭제되었습니다.`);

  lines.push(`대상 자재: ${materialName}`);

  if (siteName || transactionDate) {
    lines.push(`거래 정보: ${transactionDate || '-'} / ${siteName || '현장 미지정'}`);
  }

  if (anchor.quantity !== undefined && anchor.quantity !== null) {
    lines.push(`수량: ${formatQuantity(anchor.quantity)}${asText(anchor.unit, '') ? ` ${asText(anchor.unit, '')}` : ''}`);
  }

  const quantityChange = fieldChanges.find((change) => change.field === 'quantity');
  if (quantityChange) {
    lines.push(`수량 변경: ${formatQuantity(quantityChange.before)} → ${formatQuantity(quantityChange.after)}`);
  }

  if (action === 'deleted' && before?.isActive !== false && after?.isActive === false) {
    lines.push('실제 문서 삭제가 아닌 비활성 처리로 기록되었습니다.');
  }

  return lines;
};

const normalizeLog = (id: string, data: DocumentData): MaterialLog => ({
  id,
  action: data.action || 'updated',
  actionLabel: data.actionLabel || ACTION_LABELS[data.action as MaterialLogAction] || '변경',
  entityType: data.entityType || 'material',
  entityLabel: data.entityLabel || ENTITY_LABELS[data.entityType as MaterialLogEntityType] || '자재',
  entityId: String(data.entityId || ''),
  materialId: data.materialId ? String(data.materialId) : undefined,
  materialKey: data.materialKey ? String(data.materialKey) : undefined,
  materialName: String(data.materialName || '자재 미지정'),
  category: data.category ? String(data.category) : undefined,
  spec: data.spec ? String(data.spec) : undefined,
  unit: data.unit ? String(data.unit) : undefined,
  siteId: data.siteId ? String(data.siteId) : undefined,
  siteName: data.siteName ? String(data.siteName) : undefined,
  transactionDate: data.transactionDate ? String(data.transactionDate) : undefined,
  quantity: asNumber(data.quantity),
  actor: {
    uid: String(data.actor?.uid || 'system'),
    name: String(data.actor?.name || 'ERP 시스템'),
    email: data.actor?.email || null,
  },
  source: String(data.source || 'materialService'),
  before: data.before || null,
  after: data.after || null,
  fieldChanges: Array.isArray(data.fieldChanges) ? data.fieldChanges : [],
  summaryLines: Array.isArray(data.summaryLines) ? data.summaryLines.map(String) : [],
  summaryText: String(data.summaryText || ''),
  changeCount: Number(data.changeCount || 0),
  createdAt: data.createdAt instanceof Timestamp ? data.createdAt : Timestamp.now(),
  createdAtIso: String(data.createdAtIso || ''),
});

export const materialLogService = {
  collectionName: COLLECTION_NAME,
  actionLabels: ACTION_LABELS,
  entityLabels: ENTITY_LABELS,

  createLog: async (input: CreateMaterialLogInput): Promise<MaterialLog> => {
    const before = asRecord(input.before);
    const after = asRecord(input.after);
    const anchor = resolveAnchor(before, after);
    const fieldChanges = input.action === 'updated'
      ? buildFieldChanges(input.entityType, before, after)
      : [];
    const now = Timestamp.now();
    const logRef = doc(collection(db, COLLECTION_NAME));
    const summaryLines = buildSummaryLines(input.action, input.entityType, anchor, fieldChanges, before, after);
    const materialName = resolveMaterialName(anchor);

    const log: MaterialLog = {
      id: logRef.id,
      action: input.action,
      actionLabel: ACTION_LABELS[input.action],
      entityType: input.entityType,
      entityLabel: ENTITY_LABELS[input.entityType],
      entityId: resolveEntityId(anchor) || logRef.id,
      materialId: anchor.materialId ? String(anchor.materialId) : undefined,
      materialKey: anchor.materialKey ? String(anchor.materialKey) : undefined,
      materialName,
      category: anchor.category ? String(anchor.category) : undefined,
      spec: anchor.spec ? String(anchor.spec) : undefined,
      unit: anchor.unit ? String(anchor.unit) : undefined,
      siteId: anchor.siteId ? String(anchor.siteId) : undefined,
      siteName: anchor.siteName ? String(anchor.siteName) : undefined,
      transactionDate: anchor.transactionDate ? String(anchor.transactionDate) : undefined,
      quantity: asNumber(anchor.quantity),
      actor: resolveActor(),
      source: input.source || 'materialService',
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

    try {
      const { systemMessageService } = await import('./systemMessageService');
      await systemMessageService.notifyMaterialLogEvent(log);
    } catch (error) {
      console.warn('[materialLogService] material log notification failed:', error);
    }

    return log;
  },

  safeCreateLog: async (input: CreateMaterialLogInput): Promise<void> => {
    try {
      await materialLogService.createLog(input);
    } catch (error) {
      console.warn('[materialLogService] material log failed:', error);
    }
  },

  subscribeRecentLogs: (
    callback: (logs: MaterialLog[]) => void,
    limitCount = 300,
    onError?: (error: Error) => void
  ): Unsubscribe => {
    const logsQuery = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'), limit(limitCount));
    return onSnapshot(
      logsQuery,
      (snapshot) => callback(snapshot.docs.map((docSnap) => normalizeLog(docSnap.id, docSnap.data()))),
      (error) => {
        console.error('[materialLogService] subscribe failed:', error);
        onError?.(error);
      }
    );
  },

  getRecentLogs: async (limitCount = 300): Promise<MaterialLog[]> => {
    const logsQuery = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'), limit(limitCount));
    const snapshot = await getDocs(logsQuery);
    return snapshot.docs.map((docSnap) => normalizeLog(docSnap.id, docSnap.data()));
  },
};
