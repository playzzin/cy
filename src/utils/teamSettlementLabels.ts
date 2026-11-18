type CategoryItem = { source: string; origin: string; category: string };

/** Custom expense IDs are storage keys, not user-facing category names. */
export function formatTeamSettlementCategory(item: CategoryItem, labels?: ReadonlyMap<string, string>): string {
  if (item.source !== 'auto' || item.origin !== 'team_expense_claim') return item.category;
  return item.category.replace(/\bcustom_\d{13}_[0-9a-f]{6}\b/gi, key => {
    const label = labels?.get(key)?.trim();
    return label && !/\bcustom_\d{13}_[0-9a-f]{6}\b/i.test(label) ? label : '기타';
  });
}
