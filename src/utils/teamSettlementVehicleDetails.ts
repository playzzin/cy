import type { TeamSettlementDeductionItem } from '../types/teamSettlement';
import type { VehicleBillingDocument } from '../types/vehicleBilling';
import { formatTeamSettlementMemo } from './teamSettlementMemo';

type VehicleDetailRow = {
  subject: string;
  label: string;
  amount: number;
  note?: string;
};

export type TeamSettlementVehicleDetail = {
  subject: string;
  amount: number;
  memo: string;
  rows: VehicleDetailRow[];
};

const numberOrZero = (value: unknown): number => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

/** Resolve a saved deduction to its own bill, never every bill for its vehicle. */
export const buildTeamSettlementVehicleDetail = (
  deduction: TeamSettlementDeductionItem,
  billings: VehicleBillingDocument[],
  yearMonth: string
): TeamSettlementVehicleDetail => {
  const subject = /\((.+)\)/.exec(deduction.category)?.[1]?.trim() || '-';
  const amount = numberOrZero(deduction.amount);
  const memo = formatTeamSettlementMemo(deduction);
  const saved = (reason: string): TeamSettlementVehicleDetail => ({
    subject,
    amount,
    memo: [memo, reason].filter(Boolean).join(' / '),
    rows: [{ subject, label: '정산 반영액', amount, note: reason }]
  });

  const prefix = `vehicle_billing:${yearMonth}:`;
  const sourceId = deduction.id.startsWith(prefix) ? deduction.id.slice(prefix.length) : '';
  // Ledger deductions may end in :ledger or :ledger:<assignment id>. Their
  // allocation cannot be recovered from today's assignee or whole-month costs.
  if (/(?:^|:)ledger(?::|$)/.test(sourceId)) {
    return saved('당시 세부 내역을 확인할 수 없어 배정 기간이 반영된 정산 금액을 표시합니다.');
  }

  const monthBillings = billings.filter(billing => billing.yearMonth === yearMonth);
  const exact = monthBillings.filter(billing => sourceId && billing.id === sourceId);
  // Old bills without an id used the vehicle id/plate as their source key.
  // Only an unambiguous match with that exact key is safe to expand.
  const candidates = exact.length > 0 ? exact : monthBillings.filter(billing =>
    sourceId && (billing.vehicleId === sourceId || billing.vehiclePlate === sourceId)
  );
  if (candidates.length !== 1) {
    return saved('연결된 청구 내역을 확인할 수 없어 정산 반영액을 표시합니다.');
  }
  const billing = candidates[0];
  if (billing.status === 'CANCELLED') {
    return saved('연결된 청구서가 취소되어 정산 반영액을 표시합니다.');
  }

  const lineRows: VehicleDetailRow[] = (billing.lineItems ?? []).map(line => ({
    subject,
    label: String(line.label ?? '').trim() || '차량비',
    amount: numberOrZero(line.amount),
    note: String(line.category ?? line.type ?? '').trim() || undefined
  }));
  const lineTotal = lineRows.reduce((sum, row) => sum + row.amount, 0);
  const costs = numberOrZero(billing.fixedCost) + numberOrZero(billing.variableCost);
  // Use the same precedence and rounding as the settlement service, including
  // negative credit lines and bills that only have a total.
  const rows: VehicleDetailRow[] = lineTotal > 0 ? lineRows : costs > 0 ? [
    { subject, label: '고정비', amount: numberOrZero(billing.fixedCost), note: 'FIXED' },
    { subject, label: '변동비', amount: numberOrZero(billing.variableCost), note: 'VARIABLE' }
  ] : [{ subject, label: '차량 청구액', amount: numberOrZero(billing.totalAmount) }];
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  if (Math.round(total) !== amount) {
    return saved(`현재 청구 내역 합계 ${Math.round(total).toLocaleString('ko-KR')}원과 정산 반영액이 다릅니다. 정산 반영액을 표시합니다.`);
  }
  if (total !== amount) {
    rows.push({ subject, label: '원 단위 반올림', amount: amount - total });
  }
  return { subject, amount, memo, rows: rows.filter(row => row.amount !== 0) };
};
