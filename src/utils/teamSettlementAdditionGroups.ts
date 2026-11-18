import type { TeamSettlementAdditionItem } from '../types/teamSettlement';
import { formatTeamSettlementCategory } from './teamSettlementLabels';

/** Display groups only: saved rows, amounts and their settlement direction stay intact. */
export function groupTeamSettlementAdditions(items: TeamSettlementAdditionItem[], labels?: ReadonlyMap<string, string>) {
  const groups = new Map<string, { key: string; category: string; items: TeamSettlementAdditionItem[]; amount: number }>();
  items.forEach(item => {
    const raw = item.source === 'auto' && item.origin === 'team_expense_claim'
      ? (/^경비(?: 환급| 차감)?\((.*)\)$/.exec(item.category)?.[1]?.split(' - ')[0] || item.category).trim()
      : item.category.trim();
    const category = formatTeamSettlementCategory({ ...item, category: raw }, labels) || '항목 미입력';
    // Unknown custom categories share a fallback label, but must not be silently combined.
    const identity = category === '기타' && raw.startsWith('custom_') ? raw : category.replace(/\s+/g, '');
    const group = groups.get(identity) ?? { key: item.id, category, items: [], amount: 0 };
    group.items.push(item);
    group.amount += Number.isFinite(item.amount) ? item.amount : 0;
    groups.set(identity, group);
  });
  return [...groups.values()];
}
