import type { Accommodation } from '../types/accommodation';
import type { TeamSettlementDeductionItem } from '../types/teamSettlement';
import { getTeamSettlementExpenseDetail, type SettlementExpenseDetailRow, type SettlementExpenseEntry } from './teamSettlementExpenses';

export type AccommodationCostCategory = '전기' | '가스' | '월세' | '공과금' | '기타';
export const ACCOMMODATION_COST_CATEGORIES: AccommodationCostCategory[] = ['전기', '가스', '월세', '공과금'];
export type AccommodationAddressReference = Pick<Accommodation, 'id' | 'name' | 'address'>;
export type AccommodationAddressDetail = {
  key: string;
  address: string;
  names: string[];
  amount: number;
  notes: string[];
  costs: Array<{ category: AccommodationCostCategory; amount: number; lines: SettlementExpenseDetailRow[] }>;
};

const clean = (value: unknown): string => String(value ?? '').trim().replace(/\s+/g, ' ');
const utilityLabel = /^(.*?)\s+(월세|전기세|전기료|가스비|가스요금|수도세|수도요금|인터넷|관리비|기타)(?:\s+\d{4}-\d{2}-\d{2}\s*~\s*\d{4}-\d{2}-\d{2})?$/;

function costCategory(row: SettlementExpenseDetailRow): AccommodationCostCategory {
  const line = row.accommodationLine;
  if (!line) return '기타';
  if (line.sourceType === 'utility_ledger' || line.id.startsWith('utility-')) {
    const field = /-(rent|electricity|gas|water|internet|maintenance|other)(?:-split-\d+)?$/.exec(line.id)?.[1];
    if (field === 'rent') return '월세';
    if (field === 'electricity') return '전기';
    if (field === 'gas') return '가스';
    if (field) return '공과금';
    const label = utilityLabel.exec(clean(line.label))?.[2];
    if (label && ['수도세', '수도요금', '인터넷', '관리비', '기타'].includes(label)) return '공과금';
  }
  if (line.targetField === 'electricity') return '전기';
  if (line.targetField === 'gas') return '가스';
  if (line.targetField === 'accommodation' || line.targetField === 'privateRoom') return '월세';
  if (line.targetField === 'water' || line.targetField === 'internet') return '공과금';
  return '기타';
}

/** Group only reconciled settlement detail; never replace a saved charge with a newer ledger total. */
export function buildTeamSettlementAccommodationDetail(
  items: TeamSettlementDeductionItem[], entries: SettlementExpenseEntry[], rooms: AccommodationAddressReference[]
) {
  const groups = new Map<string, AccommodationAddressDetail>();
  items.forEach(item => {
    const detail = getTeamSettlementExpenseDetail(item, entries);
    detail.rows.forEach(row => {
      const line = row.accommodationLine;
      const sourceId = clean(line?.sourceAccommodationId);
      const legacyName = line && (line.sourceType === 'utility_ledger' || line.id.startsWith('utility-'))
        ? utilityLabel.exec(clean(line.label))?.[1] || '' : '';
      const matches = sourceId ? rooms.filter(room => clean(room.id) === sourceId)
        : legacyName ? rooms.filter(room => clean(room.name) === legacyName) : [];
      const room = matches.length === 1 ? matches[0] : undefined;
      const address = clean(room?.address);
      const name = clean(room?.name) || legacyName;
      const key = address ? `address:${address}` : `unknown:${sourceId || legacyName || item.id}`;
      const group: AccommodationAddressDetail = groups.get(key) || {
        key, address: address || '주소 미확인', names: [], amount: 0, notes: [],
        costs: ACCOMMODATION_COST_CATEGORIES.map(category => ({ category, amount: 0, lines: [] }))
      };
      if (name && !group.names.includes(name)) group.names.push(name);
      if (row.note && !group.notes.includes(row.note)) group.notes.push(row.note);
      group.amount += row.amount;
      const category = costCategory(row);
      let cost = group.costs.find(cost => cost.category === category);
      if (!cost) { cost = { category, amount: 0, lines: [] }; group.costs.push(cost); }
      cost.amount += row.amount;
      cost.lines.push(row);
      groups.set(key, group);
    });
  });
  return {
    addresses: [...groups.values()].sort((a, b) => a.address.localeCompare(b.address, 'ko') || a.names.join().localeCompare(b.names.join(), 'ko')),
    totalAmount: items.reduce((sum, item) => sum + item.amount, 0)
  };
}
