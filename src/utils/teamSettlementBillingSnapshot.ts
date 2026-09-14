import type {
  TeamSettlementDeductionItem,
  TeamSettlementDocument
} from '../types/teamSettlement';
import { getSettlementBillingRowScopeKey } from './supportSettlementBilling';

export type TeamSettlementBillingSnapshotRepairResult = {
  document: TeamSettlementDocument;
  repaired: boolean;
  removedCount: number;
  removedAmount: number;
};

const normalizeCategoryKey = (value: unknown): string => (
  String(value ?? '').trim().toLowerCase().replace(/\s+/g, '')
);

const sumAmounts = (rows: TeamSettlementDeductionItem[]): number => (
  rows.reduce((sum, row) => sum + Number(row.amount || 0), 0)
);

/**
 * Removes the legacy whole-card draft from an unconfirmed saved snapshot when
 * modern row-scoped card drafts contain the exact same total. The equality
 * guard keeps unrelated or genuinely additional card charges intact.
 */
export const repairLegacyScopedCardBillingDuplicates = (
  document: TeamSettlementDocument
): TeamSettlementBillingSnapshotRepairResult => {
  if (document.confirmedAt || !document.sourceSnapshot) {
    return { document, repaired: false, removedCount: 0, removedAmount: 0 };
  }

  const cardGroups = new Map<string, { scoped: TeamSettlementDeductionItem[]; unscoped: TeamSettlementDeductionItem[] }>();

  document.deductions.forEach((item) => {
    if (item.source !== 'auto' || item.origin !== 'card_billing') return;
    const categoryKey = normalizeCategoryKey(item.category);
    if (!categoryKey) return;

    const group = cardGroups.get(categoryKey) ?? { scoped: [], unscoped: [] };
    if (getSettlementBillingRowScopeKey({ id: item.id })) group.scoped.push(item);
    else group.unscoped.push(item);
    cardGroups.set(categoryKey, group);
  });

  const removableIds = new Set<string>();
  cardGroups.forEach((group) => {
    if (group.scoped.length === 0 || group.unscoped.length === 0) return;

    const scopedTotal = sumAmounts(group.scoped);
    const unscopedTotal = sumAmounts(group.unscoped);
    if (scopedTotal <= 0 || Math.abs(scopedTotal - unscopedTotal) > 1) return;

    group.unscoped.forEach((item) => removableIds.add(item.id));
  });

  if (removableIds.size === 0) {
    return { document, repaired: false, removedCount: 0, removedAmount: 0 };
  }

  const removedRows = document.deductions.filter((item) => removableIds.has(item.id));
  const deductions = document.deductions.filter((item) => !removableIds.has(item.id));
  const autoDeductionTotal = Math.round(
    deductions
      .filter((item) => item.source === 'auto')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0)
  );
  const snapshotTotals = document.sourceSnapshot.totals;
  const totals = {
    ...snapshotTotals,
    deductions: autoDeductionTotal,
    net: snapshotTotals.sales
      - snapshotTotals.purchases
      - autoDeductionTotal
      + snapshotTotals.additions
  };

  return {
    document: {
      ...document,
      deductions,
      sourceSnapshot: {
        ...document.sourceSnapshot,
        totals
      }
    },
    repaired: true,
    removedCount: removedRows.length,
    removedAmount: Math.round(sumAmounts(removedRows))
  };
};
