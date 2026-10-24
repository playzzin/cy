import { AiMissingBillingRow, AiMissingStatus, AiPlan, AiResult } from './contract';
import { Catalog, SourceRow, text, WorkspaceError } from './domain';
import { AuditEntry, BILLING_COLLECTIONS, BillingOrigin, billingAmount, billingBelongsToEntry, billingIsPosted, reconciliationEntries } from './reconciliation';
import { settlementDocumentId } from './settlements';

export const MISSING_BILL_LIMIT = 500;
export const MISSING_TEAM_LIMIT = 50;
export type ScopedBill = { origin: BillingOrigin; source: SourceRow; teamId: string };
export const missingTeams = (plan: AiPlan, catalog: Catalog): SourceRow[] => {
  const selected = plan.filters.find(filter => filter.entity === 'team');
  const teams = catalog.team.filter(team => !selected || team.id === selected.id);
  if (selected && !teams.length) throw new WorkspaceError('failed-precondition', '정산팀을 다시 선택해 주세요.');
  if (teams.length > MISSING_TEAM_LIMIT) throw new WorkspaceError('resource-exhausted', '미연결 청구서 점검은 최대 50개 팀입니다. 조회할 팀을 지정해 주세요.');
  return teams;
};
export function billOwner(source: SourceRow, teams: SourceRow[], yearMonth: string): string | null {
  const catalog: Catalog = { team: teams, worker: [], site: [], company: [] };
  const matches = teams.filter(team => billingBelongsToEntry(source, { teamId: team.id, yearMonth } as AuditEntry, catalog));
  // Conflicting canonical/legacy IDs must never duplicate or misattribute a bill.
  return matches.length === 1 ? matches[0].id : null;
}
const assetId = (bill: ScopedBill): string => bill.origin === 'accommodation_billing' ? 'accommodation'
  : text(bill.source[bill.origin === 'card_billing' ? 'card' : 'vehicle']?.id
    ?? bill.source[bill.origin === 'card_billing' ? 'cardId' : 'vehicleId']);

export function buildMissingBillingResult(base: AiResult, documents: SourceRow[], bills: ScopedBill[], catalog: Catalog, excludedUnconfirmed = 0): AiResult {
  const selected = missingTeams(base.plan, catalog), month = base.plan.range.startDate.slice(0, 7);
  const accepted = new Map(base.settlement!.details.map(row => [row.teamId, row]));
  const entries = reconciliationEntries(base, documents);
  const seen = new Set<string>();
  const scoped = bills.filter(bill => {
    const key = `${bill.origin}/${bill.source.id}`;
    if (seen.has(key) || billOwner(bill.source, selected, month) !== bill.teamId || !billingIsPosted(bill.source)) return false;
    seen.add(key); return true;
  });
  if (scoped.length > MISSING_BILL_LIMIT) throw new WorkspaceError('resource-exhausted', '미연결 청구서 점검은 최대 500건입니다. 조회할 팀을 좁혀 주세요.');
  const manualTeams = new Set<string>();
  for (const doc of documents) {
    const owner = [...accepted.values()].find(row => row.documentId === doc.id);
    if (!owner) continue;
    const value = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;
    // Uncategorized manual/unknown deductions could cover any billing category.
    if (value.deductions.some((row: any) => !Object.prototype.hasOwnProperty.call(BILLING_COLLECTIONS, row.origin)
      && (row.source !== 'auto' || !['office_expense', 'daily_wage_payroll', 'monthly_wage_payroll', 'service_team_payroll', 'team_expense_claim'].includes(row.origin)))) manualTeams.add(owner.teamId);
  }
  const counts: Record<AiMissingStatus, number> = { linked: 0, candidate: 0, review: 0, noSettlement: 0, invalid: 0, zero: 0 };
  let candidateAmount = 0;
  const rows: AiMissingBillingRow[] = scoped.map(bill => {
    const { origin, source, teamId } = bill, owner = accepted.get(teamId);
    const refs = entries.filter(row => row.teamId === teamId && row.origin === origin && row.referenceId === source.id);
    const row: AiMissingBillingRow = { teamId, teamName: text(selected.find(team => team.id === teamId)?.name) || '이름 미등록', yearMonth: month,
      category: ({ card_billing: '카드', accommodation_billing: '숙소', vehicle_billing: '차량' })[origin], sourceId: source.id, sourceCollection: BILLING_COLLECTIONS[origin],
      settlementId: owner?.documentId || '', lineIds: refs.map(ref => ref.lineId), status: 'candidate', reason: '', sourceAmount: null };
    try { row.sourceAmount = billingAmount(source, origin); }
    catch { row.status = 'invalid'; row.reason = '현재 청구 금액·내역을 확인할 수 없어 후보 합계에서 제외했습니다.'; }
    if (row.status !== 'invalid') {
      if (!owner) { row.status = 'noSettlement'; row.reason = '유효한 저장 확정 정산을 확인할 수 없습니다. 누락 여부를 판단하지 않았습니다.'; }
      else if (refs.length === 1) { row.status = 'linked'; row.reason = '정산 차감 항목에 청구서 ID가 연결되어 있습니다. 금액 일치는 연결 청구서 대사에서 확인해 주세요.'; }
      else if (row.sourceAmount === 0) { row.status = 'zero'; row.reason = '현재 청구액이 양수 조건에 해당하지 않아 후보에서 제외했습니다.'; }
      else if (refs.length > 1 || manualTeams.has(teamId) || entries.some(entry => entry.teamId === teamId && entry.origin === origin && !entry.referenceId)) {
        row.status = 'review'; row.reason = '중복 연결 또는 수동·원장 합산 차감이 있어 ID만으로 미반영 여부를 판단할 수 없습니다.';
      } else if (!assetId(bill) || scoped.some(other => other !== bill && other.teamId === teamId && other.origin === origin && (!assetId(other) || assetId(other) === assetId(bill)))) {
        row.status = 'review'; row.reason = '같은 자산의 청구서가 여러 건이거나 자산 ID가 없어 대체·중복·분할 청구 확인이 필요합니다.';
      } else { row.reason = '확정 정산에 직접 연결된 ID가 없습니다. 정산 이후 청구·수동 조정·의도한 제외 여부를 확인해 주세요.'; candidateAmount += row.sourceAmount!; }
    }
    counts[row.status]++; return row;
  }).sort((a, b) => a.teamName.localeCompare(b.teamName, 'ko') * (base.plan.direction === 'desc' ? -1 : 1) || a.teamId.localeCompare(b.teamId) || a.sourceCollection.localeCompare(b.sourceCollection) || a.sourceId.localeCompare(b.sourceId));
  if (!Number.isSafeInteger(candidateAmount)) throw new WorkspaceError('failed-precondition', '후보 합계의 수치 범위를 초과했습니다.');
  const teams = selected.map(team => ({ id: team.id, name: text(team.name) || '이름 미등록', confirmed: accepted.has(team.id),
    settlementId: accepted.has(team.id) ? settlementDocumentId(month, team.id) : '', bills: rows.filter(row => row.teamId === team.id).length }));
  return { ...base, missingBilling: { rows, counts, candidateAmount, teams, excludedUnconfirmed },
    completeness: base.completeness === 'partial' || teams.some(team => !team.confirmed) || counts.review + counts.invalid > 0 ? 'partial' : 'complete',
    summary: `현재 확정 청구서 ${rows.length}건 중 연결 확인 ${counts.linked}건, 미연결 후보 ${counts.candidate}건입니다. 후보는 실제 누락 확정이 아닙니다.`,
    warnings: [...base.warnings, '팀 ID와 월이 확인된 현재 확정·납부·연체 청구서만 점검합니다. 이름만 있는 청구서, 개인 청구, 미확정 청구와 전체 원장 대사는 포함하지 않습니다.',
      ...(excludedUnconfirmed ? [`접근 가능한 미확정·취소 등 청구서 ${excludedUnconfirmed}건을 점검 대상에서 제외했습니다.`] : [])] };
}
