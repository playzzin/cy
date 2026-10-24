import { AiAuditRow, AiAuditStatus, AiResult } from './contract';
import { Catalog, SourceRow, text, WorkspaceError } from './domain';

export const BILLING_COLLECTIONS = { card_billing: 'cardBillings', accommodation_billing: 'accommodation_billing_documents', vehicle_billing: 'vehicle_billing_documents' } as const;
export type BillingOrigin = keyof typeof BILLING_COLLECTIONS;
const categories = { card_billing: '카드', accommodation_billing: '숙소', vehicle_billing: '차량' };
export const billingIsPosted = (source: SourceRow) => ['CONFIRMED', 'PAID', 'OVERDUE', '확정'].includes(text(source.status).toUpperCase());
export type AuditEntry = AiAuditRow & { origin: BillingOrigin; referenceId: string };
export const billingKey = (origin: BillingOrigin, id: string) => `${BILLING_COLLECTIONS[origin]}/${id}`;

// Only documents already accepted by the confirmed-settlement builder may supply references.
export function reconciliationEntries(result: AiResult, documents: SourceRow[]): AuditEntry[] {
  const accepted = new Map(result.settlement!.details.map(row => [row.documentId, row]));
  const entries: AuditEntry[] = [], seen = new Set<string>();
  for (const source of documents) {
    const owner = accepted.get(source.id);
    if (!owner || seen.has(source.id)) continue;
    seen.add(source.id);
    const doc = typeof source.data === 'string' ? JSON.parse(source.data) : source.data;
    for (const item of doc.deductions) {
      if (!Object.prototype.hasOwnProperty.call(BILLING_COLLECTIONS, item.origin)) continue;
      const origin = item.origin as BillingOrigin, prefix = `${origin}:${owner.yearMonth}:`, lineId = text(item.id);
      const raw = lineId.startsWith(prefix) ? lineId.slice(prefix.length) : '';
      const referenceId = item.source === 'auto' && raw && raw.length <= 160 && !raw.includes('/') && raw !== '.' && raw !== '..' && !raw.split(':').includes('ledger') ? raw : '';
      entries.push({ settlementId: source.id, teamId: owner.teamId, teamName: owner.teamName, yearMonth: owner.yearMonth,
        lineId, category: categories[origin], origin, referenceId, sourceId: '', status: 'unsupported',
        reason: '개별 청구서 ID가 없는 수동·원장 합산 내역입니다.', settledAmount: item.amount, sourceAmount: null, difference: null });
    }
  }
  if (entries.length > 500) throw new WorkspaceError('resource-exhausted', '청구서 대사는 차감 내역 500건까지 가능합니다. 팀을 좁혀 주세요.');
  return entries.sort((a, b) => a.teamName.localeCompare(b.teamName, 'ko') * (result.plan.direction === 'desc' ? -1 : 1) || a.teamId.localeCompare(b.teamId));
}

export const billingBelongsToEntry = (source: SourceRow, entry: AuditEntry, catalog: Catalog): boolean => {
  const team = catalog.team.find(row => row.id === entry.teamId);
  if (!team || text(source.yearMonth) !== entry.yearMonth) return false;
  const teamId = text(source.team?.id ?? source.teamId ?? source.assignedTeamId);
  if (!new Set([team.id, text(team.legacyId)].filter(Boolean)).has(teamId)) return false;
  const recipient = text(source.issuedToType).toLowerCase();
  if (recipient === 'team' || recipient === 'team_leader') return true;
  // Unclear legacy recipients are not silently treated as team charges.
  return !recipient && !text(source.issuedToWorker?.id ?? source.issuedToWorkerId) && !text(source.issuedToWorkerName);
};
export const accommodationParent = (row: SourceRow) => text(row.billingDocument?.id ?? row.billingDocumentId);
const amount = (value: unknown, defaultZero = false): number => {
  if (defaultZero && (value === undefined || value === null)) return 0;
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER / 10000) throw new Error('invalid billing amount');
  return value;
};
// Match current settlement-service precedence; never trust the billing's cached total over valid line items.
export function billingAmount(source: SourceRow, origin: BillingOrigin): number {
  const items = typeof source.lineItems === 'string' ? JSON.parse(source.lineItems) : source.lineItems;
  if (!Array.isArray(items)) throw new Error('missing billing lines');
  const seen = new Set<string>();
  const active = items.filter(item => origin !== 'accommodation_billing' || (text(item?.status).toLowerCase() !== 'cancelled' && !item?.cancelledAt));
  const lines = active.reduce((sum, item) => {
    const id = text(item?.id);
    if (id && seen.has(id)) throw new Error('duplicate billing line');
    if (id) seen.add(id);
    return sum + amount(item?.amount);
  }, 0);
  const fixed = origin === 'vehicle_billing' && lines <= 0 ? amount(source.fixedCost, true) + amount(source.variableCost, true) : 0;
  const total = origin === 'accommodation_billing' ? lines : lines > 0 ? lines : fixed > 0 ? fixed : amount(source.totalAmount);
  if (!Number.isFinite(total) || total < 0 || total > Number.MAX_SAFE_INTEGER / 1000) throw new Error('invalid billing total');
  return Math.round(total);
}

export function applyBillingReconciliation(result: AiResult, entries: AuditEntry[], sources: Map<string, SourceRow>, catalog: Catalog): AiResult {
  const occurrences = new Map<string, number>();
  for (const entry of entries) if (entry.referenceId) {
    const key = `${entry.teamId}/${billingKey(entry.origin, entry.referenceId)}`;
    occurrences.set(key, (occurrences.get(key) || 0) + 1);
  }
  const counts: Record<AiAuditStatus, number> = { matched: 0, difference: 0, unconfirmed: 0, unavailable: 0, duplicate: 0, unsupported: 0, invalid: 0 };
  let comparedSettledAmount = 0, comparedSourceAmount = 0, absoluteDifference = 0;
  const rows: AiAuditRow[] = entries.map(entry => {
    const { origin, referenceId, ...row } = entry;
    if (referenceId) {
      const source = sources.get(billingKey(origin, referenceId));
      if (!source || !billingBelongsToEntry(source, entry, catalog)) {
        row.status = 'unavailable'; row.reason = '접근 가능한 같은 팀·같은 월의 청구서를 확인할 수 없습니다.';
      } else {
        row.sourceId = referenceId;
        if ((occurrences.get(`${entry.teamId}/${billingKey(origin, referenceId)}`) || 0) > 1) {
          row.status = 'duplicate'; row.reason = '같은 청구서에 여러 차감 내역이 연결되어 있어 금액 비교에서 제외했습니다.';
        } else if (!['CONFIRMED', 'PAID', 'OVERDUE'].includes(text(source.status).toUpperCase())) {
          row.status = 'unconfirmed'; row.reason = '현재 청구서가 확정·납부·연체 상태가 아닙니다. 확정 상태를 확인해 주세요.';
        } else {
          try {
            row.sourceAmount = billingAmount(source, origin);
            row.difference = row.sourceAmount - row.settledAmount;
            row.status = row.difference === 0 ? 'matched' : 'difference';
            row.reason = row.status === 'matched' ? '현재 청구액과 정산 반영액이 같습니다.' : '조회 시점의 청구액이 정산 반영액과 다릅니다. 조정·변경 내역을 확인해 주세요.';
            comparedSettledAmount += row.settledAmount; comparedSourceAmount += row.sourceAmount; absoluteDifference += Math.abs(row.difference);
          } catch { row.status = 'invalid'; row.reason = '청구 금액이나 내역 형식을 확인할 수 없어 비교하지 않았습니다.'; }
        }
      }
    }
    counts[row.status]++;
    return row;
  });
  const unchecked = counts.unavailable + counts.unconfirmed + counts.duplicate + counts.unsupported + counts.invalid;
  if ([comparedSettledAmount, comparedSourceAmount, absoluteDifference].some(value => !Number.isFinite(value) || value > Number.MAX_SAFE_INTEGER)) throw new WorkspaceError('failed-precondition', '대사 가능한 수치 범위를 초과했습니다.');
  return { ...result, reconciliation: { rows, counts, comparedSettledAmount, comparedSourceAmount, absoluteDifference },
    completeness: result.completeness === 'partial' || unchecked > 0 ? 'partial' : 'complete',
    summary: rows.length ? `연결된 청구서 차감 ${rows.length}건 중 일치 ${counts.matched}건, 금액 차이 ${counts.difference}건, 비교 불가 ${unchecked}건입니다.` : '대사할 카드·숙소·차량 차감 내역이 없습니다.',
    warnings: [...result.warnings, '이 결과는 정산에 연결된 카드·숙소·차량 청구서만 비교합니다. 미반영 청구서 누락 및 일보·지원비·급여 전체 대사를 포함하지 않습니다.'] };
}
