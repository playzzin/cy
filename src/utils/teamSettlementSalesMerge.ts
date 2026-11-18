import type { TeamSettlementSalesItem } from '../types/teamSettlement';
import { isContractDirectAutoSale } from './teamSettlementManualSales';

// Classification is editable in daily reports, so it is not a stable identity
// for a site's manually entered revenue. Never match different IDs by name.
const managedSiteKey = (item: TeamSettlementSalesItem): string | null => {
  if (!isContractDirectAutoSale(item)) return null;
  const id = item.siteId?.trim();
  return JSON.stringify([item.origin, id ? 'id' : 'name', id || item.siteName.trim()]);
};

export const mergeTeamSettlementSales = (
  automatic: TeamSettlementSalesItem[],
  saved: TeamSettlementSalesItem[]
): TeamSettlementSalesItem[] => {
  const savedById = new Map(saved.filter(item => item.source === 'auto').map(item => [item.id, item]));
  const savedBySite = new Map<string, TeamSettlementSalesItem[]>();
  const currentBySite = new Map<string, TeamSettlementSalesItem[]>();
  const group = (items: TeamSettlementSalesItem[], groups: Map<string, TeamSettlementSalesItem[]>) => {
    items.forEach(item => {
      const key = managedSiteKey(item);
      if (key !== null) groups.set(key, [...(groups.get(key) ?? []), item]);
    });
  };
  group(saved, savedBySite);
  group(automatic, currentBySite);

  const merged = automatic.map(item => {
    const key = managedSiteKey(item);
    const exact = savedById.get(item.id);
    let previous = exact ? [exact] : [];
    if (key !== null) {
      const siteRows = savedBySite.get(key) ?? [];
      // When both kinds become one, combine the entered values exactly once.
      // When one kind splits into two, keep the values on the original kind;
      // the new row starts empty and must pass the existing amount validation.
      previous = currentBySite.get(key)?.length === 1
        ? siteRows
        : siteRows.filter(row => row.kind === item.kind);
    }
    if (!previous.length) return item;

    const overridden = previous.filter(row => row.amountOverridden === true);
    const quantities = previous.flatMap(row =>
      typeof row.quantity === 'number' && Number.isFinite(row.quantity) ? [row.quantity] : []);
    const memos = [...new Set(previous.map(row => row.memo).filter((memo): memo is string => Boolean(memo?.trim())))];
    return {
      ...item,
      quantity: quantities.length ? quantities.reduce((sum, value) => sum + value, 0) : item.quantity,
      amount: overridden.length ? overridden.reduce((sum, row) => sum + row.amount, 0) : item.amount,
      amountOverridden: overridden.length ? true : undefined,
      memo: memos.length ? memos.join('\n') : item.memo
    };
  });

  return [...merged, ...saved.filter(item => item.source === 'manual')];
};
