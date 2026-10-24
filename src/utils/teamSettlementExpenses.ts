import type { TeamSettlementAdditionItem, TeamSettlementDeductionItem, TeamSettlementDocument } from '../types/teamSettlement';
import type { AccommodationBillingDocument } from '../types/accommodationBilling';
import type { VehicleBillingDocument } from '../types/vehicleBilling';
import type { CardBillingDocument } from '../types/cardBilling';
import type { TeamExpenseClaim } from '../types/teamExpenseLedger';
import { buildTeamExpenseSettlementMemo, formatTeamSettlementMemo } from './teamSettlementMemo';
import { getSettlementBillingRowScopeKey, selectPreferredSettlementBillings } from './supportSettlementBilling';
import { isSupportBillingMonthEnabled } from './supportBillingPeriod';

export const SETTLEMENT_EXPENSE_ORIGINS = ['accommodation_billing', 'vehicle_billing', 'card_billing', 'team_expense_claim'] as const;
export type SettlementExpenseDetailRow = { subject: string; label: string; amount: number; note?: string; date?: string };
export type SettlementExpenseEntry = {
  direction: 'deduction' | 'addition';
  item: TeamSettlementDeductionItem | TeamSettlementAdditionItem;
  details: SettlementExpenseDetailRow[];
};
export type SettlementExpenseSources = {
  yearMonth: string;
  matchesTeam: (id: unknown, name: unknown) => boolean;
  accommodationDocs: AccommodationBillingDocument[];
  vehicleDocs: VehicleBillingDocument[];
  cardDocs: CardBillingDocument[];
  teamExpenseClaims: TeamExpenseClaim[];
};
const number = (value: unknown): number => {
  const result = Number(typeof value === 'string' ? value.replace(/,/g, '').trim() : value ?? 0);
  if (!Number.isFinite(result)) throw new Error('경비 원본에 유효하지 않은 금액이 있습니다.');
  return result;
};
const identity = (...values: unknown[]): string => values.map(value => String(value ?? '').trim().toLowerCase().replace(/\s+/g, '')).find(Boolean) || '';
type Billing = AccommodationBillingDocument | VehicleBillingDocument | CardBillingDocument;
const recipient = (billing: Billing) => {
  const assigned = billing as VehicleBillingDocument;
  return { id: billing.teamId || assigned.assignedTeamId, name: billing.teamName || assigned.assignedTeamName };
};
export const isTeamExpenseBillingTarget = (billing: Billing): boolean => {
  const type = String(billing.issuedToType ?? '').trim().toLowerCase();
  if (type === 'team' || type === 'team_leader') return true;
  if (type === 'worker' || billing.issuedToWorkerId) return false;
  const target = recipient(billing);
  if (billing.issuedToWorkerName && target.name && billing.issuedToWorkerName !== target.name) return false;
  return Boolean(target.id || target.name);
};
const categoryLabels: Record<string, string> = { meal: '식대', parking: '주차', fuel: '유류', toll: '통행료', material: '자재', tool: '공구', deposit: '보증금', marking: '마킹', fieldGoods: '현장물품', equipment: '장비비', etc: '기타' };

/** The service, read-only audit and detail view must use the same source rows. */
export function buildTeamSettlementExpenseEntries(sources: SettlementExpenseSources): SettlementExpenseEntry[] {
  const entries: SettlementExpenseEntry[] = [];
  const addBilling = (origin: typeof SETTLEMENT_EXPENSE_ORIGINS[number], billings: Billing[], sourceType: string) => {
    const selected = selectPreferredSettlementBillings(billings.filter(billing => {
      const target = recipient(billing);
      return billing.yearMonth === sources.yearMonth && isTeamExpenseBillingTarget(billing) && sources.matchesTeam(target.id, target.name);
    }), billing => (billing.lineItems ?? []).some(line => line.sourceType === sourceType), billing => {
      const target = recipient(billing);
      const asset = origin === 'vehicle_billing' ? identity((billing as VehicleBillingDocument).vehiclePlate, (billing as VehicleBillingDocument).vehicleId)
        : origin === 'card_billing' ? identity((billing as CardBillingDocument).cardLabel, (billing as CardBillingDocument).cardId) : 'accommodation';
      // Unknown assets cannot suppress unrelated bills.
      return asset ? [asset, identity(target.name, target.id), identity(billing.issuedToType), identity(billing.issuedToWorkerName, billing.issuedToWorkerId)].join('|') : '';
    }, origin === 'accommodation_billing' ? undefined : getSettlementBillingRowScopeKey);
    selected.forEach(billing => {
      const subject = origin === 'vehicle_billing' ? (billing as VehicleBillingDocument).vehiclePlate
        : origin === 'card_billing' ? (billing as CardBillingDocument).cardLabel : recipient(billing).name || '팀';
      const lines = (billing.lineItems ?? []).filter(line => {
        const accommodationLine = line as AccommodationBillingDocument['lineItems'][number];
        return String(accommodationLine.status ?? '').trim().toLowerCase() !== 'cancelled' && !accommodationLine.cancelledAt;
      });
      let details: SettlementExpenseDetailRow[] = lines.map(line => ({ subject: subject || '-', label: line.label || '경비', amount: number(line.amount) }));
      // A present breakdown with a zero sum is a full refund, not a missing total.
      if (!(billing.lineItems ?? []).length && origin !== 'accommodation_billing') {
        if (origin === 'vehicle_billing' && number((billing as VehicleBillingDocument).fixedCost) + number((billing as VehicleBillingDocument).variableCost) > 0) {
          details = [{ subject, label: '고정비', amount: number((billing as VehicleBillingDocument).fixedCost) },
            { subject, label: '변동비', amount: number((billing as VehicleBillingDocument).variableCost) }];
        } else details = [{ subject, label: '청구액', amount: number((billing as CardBillingDocument).totalAmount) }];
      }
      const total = details.reduce((sum, row) => sum + row.amount, 0);
      const amount = Math.round(total);
      if (amount < 0) throw new Error('환급이 청구액보다 큰 경비 원본을 확인해 주세요.');
      if (!amount) return;
      if (!billing.id) throw new Error('경비 청구서 식별자가 없습니다.');
      if (total !== amount) details.push({ subject, label: '원 단위 반올림', amount: amount - total });
      const label = origin === 'vehicle_billing' ? '차량비' : origin === 'card_billing' ? '카드비' : '숙소비';
      entries.push({ direction: 'deduction', item: { id: `${origin}:${sources.yearMonth}:${billing.id}`, source: 'auto', origin,
        category: `${label} (${subject || '-'})`, amount }, details: details.filter(row => row.amount !== 0) });
    });
  };
  if (isSupportBillingMonthEnabled(sources.yearMonth)) {
    addBilling('accommodation_billing', sources.accommodationDocs, 'utility_ledger');
    addBilling('vehicle_billing', sources.vehicleDocs, 'vehicle_ledger');
    addBilling('card_billing', sources.cardDocs, 'card_ledger');
  }
  sources.teamExpenseClaims.filter(claim => claim.yearMonth === sources.yearMonth && ['charged', 'settled'].includes(claim.status)).forEach(claim => {
    const other = claim.claimType !== 'teamCharge' || !String(claim.chargeToTeamId ?? '').trim();
    const payer = sources.matchesTeam(claim.payerTeamId, claim.payerTeamName);
    const charged = sources.matchesTeam(claim.chargeToTeamId, claim.chargeToTeamName);
    if (other ? !payer : !payer && !charged) return;
    const amount = Math.round(number(claim.amount));
    if (amount < 0) throw new Error('경비 청구 금액을 확인해 주세요.');
    if (!amount) return;
    if (!claim.id) throw new Error('경비 청구 식별자가 없습니다.');
    const label = categoryLabels[claim.category] ?? claim.category ?? '기타';
    const suffix = label + (claim.description?.trim() ? ` - ${claim.description.trim()}` : '');
    const addClaim = (direction: 'deduction' | 'addition') => {
      const memo = buildTeamExpenseSettlementMemo(claim, direction);
      entries.push({ direction, item: { id: `team_expense_claim:${sources.yearMonth}:${claim.id}:${direction}`, source: 'auto',
        origin: 'team_expense_claim', category: direction === 'addition' ? `경비 환급(${suffix})` : `경비(${suffix})`, amount, memo },
      details: [{ subject: direction === 'addition' ? claim.chargeToTeamName || '-' : claim.payerTeamName || '-', label: suffix, amount, date: claim.date, note: memo }] });
    };
    if (other ? payer : charged) addClaim('deduction');
    if (!other && payer) addClaim('addition');
  });
  const unique = new Map<string, SettlementExpenseEntry>();
  entries.forEach(entry => {
    const key = `${entry.direction}:${entry.item.id}`;
    const prior = unique.get(key);
    if (prior && JSON.stringify(prior) !== JSON.stringify(entry)) throw new Error('동일한 경비 원본의 금액 또는 내역이 충돌합니다.');
    unique.set(key, entry);
  });
  return [...unique.values()];
}

export function compareTeamSettlementExpenses(doc: TeamSettlementDocument, entries: SettlementExpenseEntry[]) {
  const result = { missing: [] as SettlementExpenseEntry[], changed: [] as SettlementExpenseEntry[], unexpected: [] as string[], duplicate: [] as string[] };
  const seen = new Map<string, number>();
  for (const direction of ['deduction', 'addition'] as const) {
    const rows = direction === 'deduction' ? doc.deductions : doc.additions;
    rows.filter(row => row.source === 'auto' && (SETTLEMENT_EXPENSE_ORIGINS as readonly string[]).includes(row.origin)).forEach(row => {
      const key = `${direction}:${row.id}`;
      if (seen.has(key)) result.duplicate.push(key);
      seen.set(key, row.amount);
      if (!entries.some(entry => `${entry.direction}:${entry.item.id}` === key)) result.unexpected.push(key);
    });
  }
  entries.forEach(entry => {
    const key = `${entry.direction}:${entry.item.id}`;
    if (!seen.has(key)) result.missing.push(entry);
    else if (seen.get(key) !== entry.item.amount) result.changed.push(entry);
  });
  return result;
}

export function getTeamSettlementExpenseDetail(item: TeamSettlementDeductionItem | TeamSettlementAdditionItem, entries: SettlementExpenseEntry[]) {
  const match = entries.find(entry => entry.item.id === item.id);
  const subject = /\((.+)\)/.exec(item.category)?.[1]?.trim() || '-';
  if (match && match.item.amount === item.amount) return { amount: item.amount, memo: formatTeamSettlementMemo(item), rows: match.details };
  const reason = match
    ? `현재 원본 ${match.item.amount.toLocaleString('ko-KR')}원 / 정산 반영 ${item.amount.toLocaleString('ko-KR')}원. 금액 차이를 확인해 주세요.`
    : '당시 세부 내역을 확인할 수 없어 정산 반영액을 표시합니다.';
  return { amount: item.amount, memo: [formatTeamSettlementMemo(item), reason].filter(Boolean).join(' / '),
    rows: [{ subject, label: '정산 반영액', amount: item.amount, note: reason }] };
}
