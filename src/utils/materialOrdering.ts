export type MaterialGroupKey = 'dongbari' | 'scaffolding' | 'other';

export type MaterialDisplayRow = {
    category?: string | null;
    itemName?: string | null;
    spec?: string | null;
};

const GROUP_ORDER: Record<MaterialGroupKey, number> = {
    dongbari: 0,
    scaffolding: 1,
    other: 2,
};

const DEFAULT_ITEM_ORDER: Record<Exclude<MaterialGroupKey, 'other'>, string[]> = {
    dongbari: ['수직재', '수평재', '받침철물', '대각재', '멍에재', '부속철물', '기타'],
    scaffolding: ['수직재', '수평재', '받침철물', '발판', '해치', '부속철물', '기타'],
};

const COLLATOR = new Intl.Collator('ko', { numeric: true, sensitivity: 'base' });

const asText = (value: unknown): string => String(value ?? '').trim();

const normalizeItemToken = (value: unknown): string =>
    asText(value).replace(/\s+/g, '').toLowerCase();

export const getMaterialGroupKey = (material: MaterialDisplayRow): MaterialGroupKey => {
    const category = asText(material.category);
    const itemName = asText(material.itemName);

    if (category.includes('비계') || itemName.includes('비계')) return 'scaffolding';
    if (
        category.includes('동바리') ||
        category.includes('서포트') ||
        itemName.includes('동바리') ||
        itemName.includes('서포트') ||
        category.includes('시스템')
    ) {
        return 'dongbari';
    }

    return 'other';
};

const getDefaultItemRank = (material: MaterialDisplayRow): number => {
    const groupKey = getMaterialGroupKey(material);
    if (groupKey === 'other') return 0;

    const itemToken = normalizeItemToken(material.itemName);
    const order = DEFAULT_ITEM_ORDER[groupKey].map(normalizeItemToken);
    const orderIndex = order.indexOf(itemToken);

    if (orderIndex >= 0) {
        const etcIndex = order.indexOf(normalizeItemToken('기타'));
        return orderIndex === etcIndex ? order.length + 1 : orderIndex;
    }

    return order.length;
};

export const compareMaterialDisplayRows = <T extends MaterialDisplayRow>(a: T, b: T): number => {
    const groupCompare = GROUP_ORDER[getMaterialGroupKey(a)] - GROUP_ORDER[getMaterialGroupKey(b)];
    if (groupCompare !== 0) return groupCompare;

    const itemRankCompare = getDefaultItemRank(a) - getDefaultItemRank(b);
    if (itemRankCompare !== 0) return itemRankCompare;

    const itemTokenCompare = COLLATOR.compare(normalizeItemToken(a.itemName), normalizeItemToken(b.itemName));
    if (itemTokenCompare !== 0) return itemTokenCompare;

    const itemNameCompare = COLLATOR.compare(asText(a.itemName), asText(b.itemName));
    if (itemNameCompare !== 0) return itemNameCompare;

    const categoryCompare = COLLATOR.compare(asText(a.category), asText(b.category));
    if (categoryCompare !== 0) return categoryCompare;

    return COLLATOR.compare(asText(a.spec), asText(b.spec));
};

export const sortMaterialDisplayRows = <T extends MaterialDisplayRow>(rows: T[]): T[] =>
    [...rows].sort(compareMaterialDisplayRows);
