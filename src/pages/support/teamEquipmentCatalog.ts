export interface EquipmentItem {
    id: string;
    name: string;
}

export const EQUIPMENT_CATALOG_VERSION = 2;
export const DEFAULT_EQUIPMENT_ITEMS: EquipmentItem[] = [
    { id: 'impact', name: '임팩' },
    { id: 'hammer', name: '함마' },
    { id: 'skill', name: '스킬' },
    { id: 'battery', name: '배터리' },
    { id: 'other', name: '기타' },
];

// Keep IDs stable: quantities are keyed by ID in both team and foreman rows.
// Only unversioned catalogs receive the client's initial five-item layout.
// Once saved, custom names, removed items and ordering remain authoritative.
export const upgradeEquipmentCatalog = (items: EquipmentItem[], version?: number): EquipmentItem[] => {
    if ((version ?? 0) >= EQUIPMENT_CATALOG_VERSION || items.length === 0) return items;
    const used = new Set<string>();
    const ids = new Set(items.map(item => item.id));
    const result = DEFAULT_EQUIPMENT_ITEMS.map(defaultItem => {
        let existing = items.find(item => !used.has(item.id) && (item.id === defaultItem.id || item.name === defaultItem.name));
        if (defaultItem.id === 'hammer' && !existing) {
            const legacyOther = items.find(item => item.name === '기타' && !used.has(item.id));
            if (legacyOther) existing = { ...legacyOther, name: '함마' };
        }
        if (existing) {
            used.add(existing.id);
            return existing;
        }
        let id = defaultItem.id;
        let suffix = 2;
        while (ids.has(id)) id = `${defaultItem.id}_${suffix++}`;
        ids.add(id);
        return { ...defaultItem, id };
    });
    return [...result, ...items.filter(item => !used.has(item.id))];
};
