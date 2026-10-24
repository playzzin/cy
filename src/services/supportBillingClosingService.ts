import {
  collection, doc, getDocsFromServer, query, runTransaction, Timestamp, where,
  type DocumentData, type Transaction,
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { makeMonthlyPayrollSettlementId } from './monthlyPayrollSettlementService';

export type SupportBillingDomain = 'card' | 'vehicle' | 'accommodation';
export type SupportBillingClosingAction = 'confirm' | 'reopen';

const collections: Record<SupportBillingDomain, string> = {
  card: 'cardBillings', vehicle: 'vehicle_billing_documents', accommodation: 'accommodation_billing_documents',
};
const labels: Record<SupportBillingDomain, string> = { card: '카드', vehicle: '차량', accommodation: '숙소' };
const text = (value: unknown): string => String(value ?? '').trim();
const unique = (values: unknown[]): string[] => Array.from(new Set(values.map(text).filter(Boolean)));
const object = (value: unknown): DocumentData | null => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as DocumentData;
  if (typeof value === 'string') {
    try { return object(JSON.parse(value)); } catch { return null; }
  }
  return null;
};
const relatedIds = (data: DocumentData, relation: string, flat: string) => unique([
  data[flat], data[relation]?.id, data[relation]?.legacyId,
]);
const validId = (id: string) => Boolean(id) && !id.includes('/');
const validMonth = (value: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
const finiteAmount = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export interface SupportBillingClosingRow {
  id: string;
  domain: SupportBillingDomain;
  yearMonth: string;
  title: string;
  teamName: string;
  targetName: string;
  status: string;
  totalAmount: number | null;
}

export interface SupportBillingClosingPreview extends SupportBillingClosingRow {
  version: string;
  actorUid: string;
  action: SupportBillingClosingAction | null;
  blockedReason: string | null;
  impact: string;
  lineItems: Array<{ label: string; amount: number }>;
}

const toRow = (domain: SupportBillingDomain, id: string, data: DocumentData): SupportBillingClosingRow => ({
  id, domain,
  yearMonth: text(data.yearMonth),
  title: text(domain === 'card' ? data.cardLabel : domain === 'vehicle' ? data.vehiclePlate : data.teamName) || `${labels[domain]} 청구서`,
  teamName: text(data.teamName || data.team?.name) || '팀 미지정',
  targetName: text(data.issuedToWorkerName || data.issuedToWorker?.name || data.teamName || data.team?.name) || '대상 미지정',
  status: text(data.status).toUpperCase(),
  totalAmount: domain !== 'accommodation' && finiteAmount(data.totalAmount) ? data.totalAmount : null,
});

// Compare the actual stored values, including timestamps, without changing any
// of the existing billing amount or ledger calculation conventions.
const stableValue = (value: any): any => {
  if (value === undefined) return null;
  if (value && typeof value.toMillis === 'function') return value.toMillis();
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.keys(value).sort().map(key => [key, stableValue(value[key])])
  );
  return value;
};

const readPreview = async (
  transaction: Transaction, domain: SupportBillingDomain, id: string, yearMonth: string,
) => {
  if (!collections[domain] || !validId(id) || !validMonth(yearMonth)) throw new Error('청구서와 조회월을 다시 선택해 주세요.');
  const ref = doc(db, collections[domain], id);
  const snapshot = await transaction.get(ref);
  if (!snapshot.exists()) throw new Error('청구서가 변경되거나 삭제되었습니다. 목록을 새로고침해 주세요.');
  const data = snapshot.data();
  if (text(data.yearMonth) !== yearMonth) throw new Error('청구월이 변경되었습니다. 목록을 새로고침해 주세요.');
  const row = toRow(domain, id, data);
  let blockedReason: string | null = null;
  const block = (reason: string) => { blockedReason ??= reason; };
  const action = row.status === 'DRAFT' ? 'confirm' : row.status === 'CONFIRMED' ? 'reopen' : null;
  if (!action) block('지급 완료·연체·취소 상태이거나 확인할 수 없는 상태입니다. 정정 절차를 먼저 확인해 주세요.');

  let items: DocumentData[] = Array.isArray(data.lineItems) ? data.lineItems : [];
  if (domain === 'accommodation') {
    // Older accommodation bills do not always carry the complete item manifest.
    // Do not infer a financial snapshot from a partial query result.
    const ids = Array.isArray(data.lineItemIds) ? unique(data.lineItemIds) : [];
    if (!ids.length || ids.some(id => !validId(id))) {
      block('숙소 청구 항목의 연결정보가 부족합니다. 관리대장에서 자료를 확인해 주세요.');
      items = [];
    } else {
      const snapshots = await Promise.all(ids.map(lineId => transaction.get(doc(db, 'accommodation_billing_line_items', lineId))));
      items = [];
      snapshots.forEach(line => {
        const item = line.data();
        if (!item || text(item.billingDocument?.id || item.billingDocumentId) !== id
          || text(item.status || 'active').toLowerCase() === 'cancelled' || item.cancelledAt) {
          block('청구 항목이 변경되었습니다. 관리대장에서 청구 내용을 확인해 주세요.');
        } else items.push({ ...item, id: line.id });
      });
    }
    if (!['team', 'team_leader'].includes(text(data.issuedToType)) || data.postedAdvancePaymentId) {
      block('개인 공제와 연결된 숙소 청구는 기존 반영액 대사가 필요합니다. 이 화면에서는 자동 확정·취소하지 않습니다.');
    }
  }
  const lineItems = items.map(item => ({ label: text(item.label), amount: item.amount as number }));
  if (!items.length || items.some(item => !finiteAmount(item.amount))) block('청구 항목 또는 금액을 확인할 수 없습니다. 관리대장에서 확인해 주세요.');
  const totalAmount = domain === 'accommodation'
    ? (items.length && items.every(item => finiteAmount(item.amount)) ? items.reduce((sum, item) => sum + item.amount, 0) : null)
    : row.totalAmount;
  if (totalAmount === null || !Number.isFinite(totalAmount) || totalAmount < 0) block('청구 합계가 올바르지 않습니다. 관리대장에서 금액을 확인해 주세요.');

  const teamIds = relatedIds(data, 'team', 'teamId');
  if (!teamIds.length || teamIds.some(id => !validId(id))) block('청구 대상 팀을 확인할 수 없습니다. 팀 연결정보를 먼저 확인해 주세요.');
  const teams = await Promise.all(teamIds.filter(validId).map(teamId => transaction.get(doc(db, 'teams', teamId))));
  if (!teamIds.includes('__office__') && !teams.some(team => team.exists())) {
    block('청구 대상 팀의 원본 자료를 확인할 수 없습니다. 현재 팀과 이전 팀의 연결정보를 먼저 확인해 주세요.');
  }
  // Check both current and legacy IDs; existing snapshots may use either one.
  const lockTeamIds = unique([...teamIds, ...teams.flatMap(team => [team.id, team.data()?.legacyId])]).filter(validId);
  const locks = await Promise.all(lockTeamIds.flatMap(teamId => [
    transaction.get(doc(db, 'system_configs', `team_settlement_${yearMonth}__${teamId}`)),
    transaction.get(doc(db, 'monthly_payroll_settlements', makeMonthlyPayrollSettlementId(yearMonth, teamId))),
  ]));
  locks.forEach((lock, index) => {
    if (!lock.exists()) return;
    const stored = lock.data();
    if (index % 2 === 0) {
      const config = object(stored.data);
      if (!config || text(config.yearMonth) !== yearMonth) block('팀정산 상태를 확인할 수 없습니다. 정산 자료를 먼저 확인해 주세요.');
      else if (config.confirmedAt) block('팀정산이 확정되어 있습니다. 팀정산 확정 취소 여부를 먼저 검토해 주세요.');
    } else if (text(stored.yearMonth) !== yearMonth || (text(stored.runStatus || 'draft').toLowerCase() !== 'draft')) {
      block('급여가 검토 완료·확정·지급 상태이거나 상태 확인이 필요합니다. 급여 정정 절차를 먼저 확인해 주세요.');
    }
  });
  const preview: SupportBillingClosingPreview = {
    ...row, totalAmount, lineItems, action, blockedReason,
    actorUid: auth.currentUser?.uid ?? '',
    version: JSON.stringify(stableValue({ data, items, locks: locks.map(lock => [lock.id, lock.data()]) })),
    impact: action === 'reopen'
      ? '청구 금액은 유지하고 수정 가능한 작성 중 상태로 되돌립니다. 이미 지급된 급여나 이전 금액을 복원하지 않습니다.'
      : '저장된 청구 금액을 유지하고 확정 상태로 변경합니다. 이후 관리대장에서 해당 청구 금액 변경이 제한됩니다.',
  };
  return { ref, data, preview, items };
};

export const supportBillingClosingService = {
  async list(domain: SupportBillingDomain, yearMonth: string): Promise<SupportBillingClosingRow[]> {
    if (!collections[domain] || !validMonth(yearMonth)) throw new Error('조회월을 확인해 주세요.');
    const result = await getDocsFromServer(query(collection(db, collections[domain]), where('yearMonth', '==', yearMonth)));
    return result.docs.map(row => toRow(domain, row.id, row.data()))
      .sort((a, b) => a.teamName.localeCompare(b.teamName, 'ko') || a.title.localeCompare(b.title, 'ko'));
  },
  async preview(domain: SupportBillingDomain, id: string, yearMonth: string): Promise<SupportBillingClosingPreview> {
    return runTransaction(db, async transaction => (await readPreview(transaction, domain, id, yearMonth)).preview);
  },
  async apply(expected: SupportBillingClosingPreview, reason: string): Promise<void> {
    const user = auth.currentUser;
    if (!user || user.uid !== expected.actorUid) throw new Error('로그인 상태가 변경되었습니다. 다시 확인해 주세요.');
    if (!expected.action) throw new Error('변경할 수 없는 청구 상태입니다.');
    const trimmedReason = reason.trim();
    if (expected.action === 'reopen' && !trimmedReason) throw new Error('확정 취소 사유를 입력해 주세요.');
    if (trimmedReason.length > 500) throw new Error('취소 사유는 500자 이내로 입력해 주세요.');
    const logRef = doc(collection(db, `${expected.domain}_billing_logs`));
    await runTransaction(db, async transaction => {
      const { ref, data, preview, items } = await readPreview(transaction, expected.domain, expected.id, expected.yearMonth);
      if (auth.currentUser?.uid !== user.uid) throw new Error('로그인 상태가 변경되었습니다. 다시 확인해 주세요.');
      if (preview.blockedReason) throw new Error(preview.blockedReason);
      if (preview.version !== expected.version || preview.action !== expected.action) {
        throw new Error('확인 후 자료가 변경되었습니다. 최신 내용을 다시 확인해 주세요.');
      }
      const now = Timestamp.now();
      const isConfirm = expected.action === 'confirm';
      const status = expected.domain === 'accommodation'
        ? (isConfirm ? 'confirmed' : 'draft') : (isConfirm ? 'CONFIRMED' : 'DRAFT');
      // Compat readers expect ISO dates for vehicle/accommodation, whereas card
      // readers use Firestore timestamps. Preserve those storage conventions.
      const storedNow = expected.domain === 'card' ? now : now.toDate().toISOString();
      const patch: DocumentData = {
        status, confirmedAt: isConfirm ? storedNow : null, updatedAt: storedNow,
        closingLastAction: { action: expected.action, reason: trimmedReason, actorId: user.uid, actorName: user.displayName || '사용자', at: storedNow },
        ...(!isConfirm ? {
          confirmationCancelReason: trimmedReason, confirmationCancelledAt: storedNow,
          confirmationCancelledById: user.uid, confirmationCancelledByName: user.displayName || '사용자',
        } : {}),
      };
      const before = { ...data, id: expected.id, lineItems: items };
      const after = { ...before, ...patch };
      const actionLabel = isConfirm ? '확정' : '확정 취소';
      const summaryLines = [`${actionLabel}: ${preview.title}`, `청구액 ${Number(preview.totalAmount).toLocaleString('ko-KR')}원 유지`, ...(!isConfirm ? [`사유: ${trimmedReason}`] : [])];
      // Status and audit history commit together: a denied/failed history write
      // must not leave an unrecorded financial transition behind.
      transaction.update(ref, patch);
      transaction.set(logRef, {
        action: 'updated', actionLabel, billingId: expected.id, yearMonth: expected.yearMonth,
        cardId: text(data.cardId), cardLabel: text(data.cardLabel),
        vehicleId: text(data.vehicleId), vehiclePlate: text(data.vehiclePlate),
        teamId: text(data.teamId), teamName: preview.teamName,
        issuedToType: text(data.issuedToType), issuedToWorkerId: text(data.issuedToWorkerId), issuedToWorkerName: text(data.issuedToWorkerName),
        status, actor: { uid: user.uid, name: user.displayName || '사용자' },
        source: 'supportBillingClosingService', before, after,
        fieldChanges: [{ field: 'status', label: '상태', before: data.status, after: status }, ...(!isConfirm ? [{ field: 'confirmationCancelReason', label: '확정 취소 사유', before: data.confirmationCancelReason ?? null, after: trimmedReason }] : [])],
        lineItemChanges: { added: [], removed: [], updated: [] },
        summaryLines, summaryText: summaryLines.join('\n'), changeCount: isConfirm ? 1 : 2,
        createdAt: now, createdAtIso: now.toDate().toISOString(),
      });
    });
  },
};
