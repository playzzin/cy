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
  CreateDatabaseLogInput,
  DatabaseFieldChange,
  DatabaseLog,
  DatabaseLogAction,
  DatabaseLogActor,
  DatabaseLogEntityType,
} from '../types/databaseLog';

const COLLECTION_NAME = 'database_logs';

const ACTION_LABELS: Record<DatabaseLogAction, string> = {
  created: '저장',
  updated: '수정',
  deleted: '삭제',
};

const ENTITY_LABELS: Record<DatabaseLogEntityType, string> = {
  worker: '작업자',
  team: '팀',
  site: '현장',
  company: '회사',
  account: '계좌',
};

const FIELD_LABELS: Record<string, string> = {
  id: 'ID',
  legacyId: '기존 ID',
  uid: '로그인 UID',
  name: '이름',
  code: '코드',
  idNumber: '주민/사업자 식별번호',
  corpNum: '법인번호',
  businessNumber: '사업자번호',
  ceoName: '대표자',
  ceoResidentNumber: '대표자 주민번호',
  address: '주소',
  contact: '연락처',
  phone: '전화번호',
  fax: '팩스',
  email: '이메일',
  role: '직책',
  rank: '직급',
  employmentType: '고용형태',
  status: '상태',
  isActive: '사용 여부',
  type: '구분',
  category: '분류',
  teamId: '팀 ID',
  teamName: '팀명',
  teamType: '팀 구분',
  leaderId: '팀장 ID',
  leaderName: '팀장',
  companyId: '회사 ID',
  companyName: '회사명',
  parentTeamId: '상위팀 ID',
  parentTeamName: '상위팀',
  assignedSiteId: '배정 현장 ID',
  assignedSiteName: '배정 현장',
  memberCount: '인원수',
  memberIds: '구성원 ID',
  memberNames: '구성원',
  siteId: '현장 ID',
  siteName: '현장명',
  siteIds: '현장 ID 목록',
  siteNames: '현장 목록',
  startDate: '시작일',
  endDate: '종료일',
  responsibleTeamId: '담당팀 ID',
  responsibleTeamName: '담당팀',
  constructorCompanyId: '시공사 ID',
  constructorCompanyName: '시공사',
  clientCompanyId: '발주사 ID',
  clientCompanyName: '발주사',
  partnerId: '협력사 ID',
  partnerName: '협력사',
  siteType: '현장 구분',
  paymentMethod: '결제 방식',
  totalManDay: '누적 공수',
  clientTotalManDay: '발주 공수',
  constructorTotalManDay: '시공 공수',
  partnerTotalManDay: '협력 공수',
  unitPrice: '단가',
  payType: '급여 방식',
  salaryModel: '급여 모델',
  defaultSalaryModel: '기본 급여 모델',
  supportRate: '지원 단가',
  supportModel: '지원 정산 방식',
  supportDescription: '지원 설명',
  serviceRate: '용역 단가',
  serviceModel: '용역 정산 방식',
  serviceDescription: '용역 설명',
  bankName: '은행',
  accountNumber: '계좌번호',
  accountHolder: '예금주',
  color: '색상',
  icon: '아이콘',
  iconKey: '아이콘 키',
  fileNameSaved: '첨부파일',
  needsApproval: '승인 필요',
  isMyCompany: '자사 여부',
  assignedClientCompanyIds: '배정 발주사',
  note: '메모',
  sortOrder: '정렬 순서',
};

const ENTITY_COMPARE_FIELDS: Record<DatabaseLogEntityType, string[]> = {
  worker: [
    'name',
    'idNumber',
    'contact',
    'email',
    'role',
    'rank',
    'employmentType',
    'status',
    'isActive',
    'teamId',
    'teamName',
    'teamType',
    'siteId',
    'siteName',
    'companyId',
    'companyName',
    'unitPrice',
    'payType',
    'salaryModel',
    'bankName',
    'accountNumber',
    'accountHolder',
    'address',
    'leaderName',
    'uid',
    'color',
    'iconKey',
    'needsApproval',
    'fileNameSaved',
    'totalManDay',
  ],
  team: [
    'name',
    'type',
    'leaderId',
    'leaderName',
    'companyId',
    'companyName',
    'parentTeamId',
    'parentTeamName',
    'assignedSiteId',
    'assignedSiteName',
    'memberCount',
    'memberIds',
    'memberNames',
    'siteIds',
    'siteNames',
    'status',
    'supportRate',
    'supportModel',
    'supportDescription',
    'serviceRate',
    'serviceModel',
    'serviceDescription',
    'defaultSalaryModel',
    'bankName',
    'accountNumber',
    'accountHolder',
    'color',
    'iconKey',
    'role',
    'totalManDay',
  ],
  site: [
    'name',
    'code',
    'address',
    'startDate',
    'endDate',
    'status',
    'responsibleTeamId',
    'responsibleTeamName',
    'companyId',
    'companyName',
    'constructorCompanyId',
    'constructorCompanyName',
    'clientCompanyId',
    'clientCompanyName',
    'partnerId',
    'partnerName',
    'siteType',
    'paymentMethod',
    'totalManDay',
    'color',
    'imageUrl',
    'photos',
  ],
  company: [
    'name',
    'code',
    'corpNum',
    'businessNumber',
    'ceoName',
    'ceoResidentNumber',
    'idNumber',
    'address',
    'phone',
    'fax',
    'email',
    'type',
    'status',
    'bankName',
    'accountNumber',
    'accountHolder',
    'siteIds',
    'siteNames',
    'color',
    'iconKey',
    'totalManDay',
    'clientTotalManDay',
    'constructorTotalManDay',
    'partnerTotalManDay',
    'isMyCompany',
    'assignedClientCompanyIds',
  ],
  account: [
    'name',
    'category',
    'bankName',
    'accountNumber',
    'accountHolder',
    'note',
    'status',
    'sortOrder',
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

const normalizeComparableValue = (value: unknown): unknown => {
  if (value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  return value;
};

const sameValue = (left: unknown, right: unknown): boolean =>
  JSON.stringify(normalizeComparableValue(left)) === JSON.stringify(normalizeComparableValue(right));

const asRecord = (value?: Record<string, unknown> | null): Record<string, unknown> | null =>
  value ? stripUndefined(value) as Record<string, unknown> : null;

const asText = (value: unknown, fallback = '-'): string => {
  const text = String(value ?? '').trim();
  return text || fallback;
};

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'number') return value.toLocaleString('ko-KR');
  if (typeof value === 'boolean') return value ? '예' : '아니오';
  if (Array.isArray(value)) return value.length > 0 ? value.map((entry) => asText(entry, '')).filter(Boolean).join(', ') : '-';
  if (typeof (value as { toDate?: unknown })?.toDate === 'function') return (value as { toDate: () => Date }).toDate().toLocaleString('ko-KR');
  if (typeof value === 'object') return JSON.stringify(stripUndefined(value));
  return String(value);
};

const resolveActor = (): DatabaseLogActor => {
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
  asText(anchor.id || anchor.uid || anchor.legacyId, '');

const resolveEntityName = (entityType: DatabaseLogEntityType, anchor: Record<string, unknown>): string => {
  if (entityType === 'worker') return asText(anchor.name || anchor.workerName || anchor.email || anchor.id, '작업자 미지정');
  if (entityType === 'team') return asText(anchor.name || anchor.teamName || anchor.id, '팀 미지정');
  if (entityType === 'site') return asText(anchor.name || anchor.siteName || anchor.code || anchor.id, '현장 미지정');
  if (entityType === 'company') return asText(anchor.name || anchor.companyName || anchor.code || anchor.id, '회사 미지정');
  return asText(anchor.name || anchor.accountHolder || anchor.accountNumber || anchor.id, '계좌 미지정');
};

const resolveSubtitle = (entityType: DatabaseLogEntityType, anchor: Record<string, unknown>): string | undefined => {
  const parts = new Set<string>();
  if (entityType === 'worker') {
    [anchor.teamName, anchor.siteName, anchor.companyName, anchor.role, anchor.status].forEach((value) => {
      const text = asText(value, '');
      if (text) parts.add(text);
    });
  } else if (entityType === 'team') {
    [anchor.type, anchor.companyName, anchor.leaderName, anchor.status].forEach((value) => {
      const text = asText(value, '');
      if (text) parts.add(text);
    });
  } else if (entityType === 'site') {
    [anchor.code, anchor.responsibleTeamName, anchor.clientCompanyName, anchor.status].forEach((value) => {
      const text = asText(value, '');
      if (text) parts.add(text);
    });
  } else if (entityType === 'company') {
    [anchor.type, anchor.ceoName, anchor.businessNumber, anchor.status].forEach((value) => {
      const text = asText(value, '');
      if (text) parts.add(text);
    });
  } else {
    [anchor.category, anchor.bankName, anchor.accountHolder, anchor.status].forEach((value) => {
      const text = asText(value, '');
      if (text) parts.add(text);
    });
  }

  const subtitle = Array.from(parts).join(' · ');
  return subtitle || undefined;
};

const buildFieldChanges = (
  entityType: DatabaseLogEntityType,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null
): DatabaseFieldChange[] =>
  ENTITY_COMPARE_FIELDS[entityType].reduce<DatabaseFieldChange[]>((changes, field) => {
    const beforeValue = before?.[field] ?? null;
    const afterValue = after?.[field] ?? null;
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
  action: DatabaseLogAction,
  entityType: DatabaseLogEntityType,
  anchor: Record<string, unknown>,
  fieldChanges: DatabaseFieldChange[]
): string[] => {
  const entityLabel = ENTITY_LABELS[entityType];
  const entityName = resolveEntityName(entityType, anchor);
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

  lines.push(`대상: ${entityName}`);

  const subtitle = resolveSubtitle(entityType, anchor);
  if (subtitle) lines.push(`식별 정보: ${subtitle}`);

  if (action === 'updated' && fieldChanges.length > 0) {
    fieldChanges.slice(0, 5).forEach((change) => {
      lines.push(`${change.label}: ${formatValue(change.before)} → ${formatValue(change.after)}`);
    });
    if (fieldChanges.length > 5) {
      lines.push(`외 ${fieldChanges.length - 5}개 항목 추가 변경`);
    }
  }

  return lines;
};

const normalizeLog = (id: string, data: DocumentData): DatabaseLog => ({
  id,
  action: data.action || 'updated',
  actionLabel: data.actionLabel || ACTION_LABELS[data.action as DatabaseLogAction] || '변경',
  entityType: data.entityType || 'worker',
  entityLabel: data.entityLabel || ENTITY_LABELS[data.entityType as DatabaseLogEntityType] || '데이터',
  entityId: String(data.entityId || ''),
  entityName: String(data.entityName || '대상 미지정'),
  entitySubtitle: data.entitySubtitle ? String(data.entitySubtitle) : undefined,
  teamId: data.teamId ? String(data.teamId) : undefined,
  teamName: data.teamName ? String(data.teamName) : undefined,
  siteId: data.siteId ? String(data.siteId) : undefined,
  siteName: data.siteName ? String(data.siteName) : undefined,
  companyId: data.companyId ? String(data.companyId) : undefined,
  companyName: data.companyName ? String(data.companyName) : undefined,
  status: data.status ? String(data.status) : undefined,
  actor: {
    uid: String(data.actor?.uid || 'system'),
    name: String(data.actor?.name || 'ERP 시스템'),
    email: data.actor?.email || null,
  },
  source: String(data.source || 'databaseService'),
  before: data.before || null,
  after: data.after || null,
  fieldChanges: Array.isArray(data.fieldChanges) ? data.fieldChanges : [],
  summaryLines: Array.isArray(data.summaryLines) ? data.summaryLines.map(String) : [],
  summaryText: String(data.summaryText || ''),
  changeCount: Number(data.changeCount || 0),
  createdAt: data.createdAt instanceof Timestamp ? data.createdAt : Timestamp.now(),
  createdAtIso: String(data.createdAtIso || ''),
});

export const databaseLogService = {
  collectionName: COLLECTION_NAME,
  actionLabels: ACTION_LABELS,
  entityLabels: ENTITY_LABELS,

  createLog: async (input: CreateDatabaseLogInput): Promise<DatabaseLog> => {
    const before = asRecord(input.before);
    const after = asRecord(input.after);
    const anchor = resolveAnchor(before, after);
    const fieldChanges = input.action === 'updated'
      ? buildFieldChanges(input.entityType, before, after)
      : [];
    const now = Timestamp.now();
    const logRef = doc(collection(db, COLLECTION_NAME));
    const summaryLines = buildSummaryLines(input.action, input.entityType, anchor, fieldChanges);

    const log: DatabaseLog = {
      id: logRef.id,
      action: input.action,
      actionLabel: ACTION_LABELS[input.action],
      entityType: input.entityType,
      entityLabel: ENTITY_LABELS[input.entityType],
      entityId: resolveEntityId(anchor) || logRef.id,
      entityName: resolveEntityName(input.entityType, anchor),
      entitySubtitle: resolveSubtitle(input.entityType, anchor),
      teamId: anchor.teamId ? String(anchor.teamId) : undefined,
      teamName: anchor.teamName ? String(anchor.teamName) : undefined,
      siteId: anchor.siteId ? String(anchor.siteId) : undefined,
      siteName: anchor.siteName ? String(anchor.siteName) : undefined,
      companyId: anchor.companyId ? String(anchor.companyId) : undefined,
      companyName: anchor.companyName ? String(anchor.companyName) : undefined,
      status: anchor.status ? String(anchor.status) : undefined,
      actor: resolveActor(),
      source: input.source || 'databaseService',
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
      await systemMessageService.notifyDatabaseLogEvent(log);
    } catch (error) {
      console.warn('[databaseLogService] database log notification failed:', error);
    }

    return log;
  },

  safeCreateLog: async (input: CreateDatabaseLogInput): Promise<void> => {
    try {
      await databaseLogService.createLog(input);
    } catch (error) {
      console.warn('[databaseLogService] database log failed:', error);
    }
  },

  subscribeRecentLogs: (
    callback: (logs: DatabaseLog[]) => void,
    limitCount = 300,
    onError?: (error: Error) => void
  ): Unsubscribe => {
    const logsQuery = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'), limit(limitCount));
    return onSnapshot(
      logsQuery,
      (snapshot) => callback(snapshot.docs.map((docSnap) => normalizeLog(docSnap.id, docSnap.data()))),
      (error) => {
        console.error('[databaseLogService] subscribe failed:', error);
        onError?.(error);
      }
    );
  },

  getRecentLogs: async (limitCount = 300): Promise<DatabaseLog[]> => {
    const logsQuery = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'), limit(limitCount));
    const snapshot = await getDocs(logsQuery);
    return snapshot.docs.map((docSnap) => normalizeLog(docSnap.id, docSnap.data()));
  },
};
