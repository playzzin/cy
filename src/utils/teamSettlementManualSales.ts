import type { TeamSettlementDocument, TeamSettlementSalesItem } from '../types/teamSettlement';

export const isContractDirectAutoSale = (item: TeamSettlementSalesItem): boolean =>
  item.source === 'auto'
  && (item.kind === '도급' || item.kind === '직영')
  && (item.origin === 'daily_report' || item.origin === 'support_client_site');

/** Project older drafts into manual-entry mode without writing or changing the stored document. */
export const prepareTeamSettlementManualSales = (doc: TeamSettlementDocument): TeamSettlementDocument => {
  if (doc.confirmedAt || !doc.sales.some(isContractDirectAutoSale)) return doc;
  const sales = doc.sales.map(item => {
    if (!isContractDirectAutoSale(item) || item.amountOverridden === true) return item;
    return { ...item, amount: 0 };
  });
  let sourceSnapshot = doc.sourceSnapshot;
  if (sourceSnapshot && !sourceSnapshot.manualContractDirectAmounts) {
    // Old snapshots included wages as revenue. Only automatic support revenue
    // remains in the sales baseline; manually entered revenue is checked separately.
    const automaticSales = Math.round(sales
      .filter(item => item.source === 'auto' && !isContractDirectAutoSale(item))
      .reduce((sum, item) => sum + item.amount, 0));
    const totals = { ...sourceSnapshot.totals, sales: automaticSales };
    totals.net = totals.sales - totals.purchases - totals.deductions + totals.additions;
    sourceSnapshot = { ...sourceSnapshot, manualContractDirectAmounts: true, totals };
  }
  return { ...doc, sales, sourceSnapshot };
};

/** An amount already confirmed by the user stays intentional when the document is unlocked. */
export const unlockTeamSettlementManualSales = (doc: TeamSettlementDocument): TeamSettlementDocument =>
  prepareTeamSettlementManualSales({
    ...doc,
    confirmedAt: null,
    sales: doc.confirmedAt
      ? doc.sales.map(item => isContractDirectAutoSale(item) ? { ...item, amountOverridden: true } : item)
      : doc.sales
  });
