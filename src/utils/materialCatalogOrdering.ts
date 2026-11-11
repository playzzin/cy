import { EXCEL_MATERIAL_CATALOG } from '../constants/materialCatalog';
import { compareMaterialDisplayRows, MaterialDisplayRow } from './materialOrdering';

const compact = (value: unknown) => String(value ?? '').replace(/\s+/g, '').toLowerCase();
const catalogKey = (row: MaterialDisplayRow): string => {
    const rawCategory = compact(row.category);
    const category = rawCategory.includes('비계') ? '비계'
        : /동바리|서포트/.test(rawCategory) ? '동바리' : rawCategory;
    return [category, compact(row.itemName), compact(row.spec)].join('::');
};

const catalogOrder = new Map(EXCEL_MATERIAL_CATALOG.flatMap(group =>
    group.specs.map(spec => catalogKey({ ...group, spec }))
).map((key, index) => [key, index]));

export const isCurrentCatalogMaterial = (row: MaterialDisplayRow): boolean => catalogOrder.has(catalogKey(row));

// The spreadsheet has intentional exceptions to alphabetical and numeric order.
// In particular W상부쟈키 follows 하부자키, and scaffolding 멍에재 comes last.
export const sortMaterialCatalogRows = <T extends MaterialDisplayRow>(rows: T[]): T[] =>
    [...rows].sort((a, b) => {
        const aRank = catalogOrder.get(catalogKey(a));
        const bRank = catalogOrder.get(catalogKey(b));
        if (aRank !== undefined || bRank !== undefined) {
            return (aRank ?? Number.MAX_SAFE_INTEGER) - (bRank ?? Number.MAX_SAFE_INTEGER);
        }
        return compareMaterialDisplayRows(a, b);
    });
