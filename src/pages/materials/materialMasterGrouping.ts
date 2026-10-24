import { getMaterialGroupKey, MaterialDisplayRow, MaterialGroupKey } from '../../utils/materialOrdering';

export type MaterialMasterGroupKey = MaterialGroupKey | 'system';

export const getMaterialMasterGroupKey = (material: MaterialDisplayRow): MaterialMasterGroupKey => {
    const category = String(material.category ?? '').trim();
    // Preserve the established aliases for 시스템 비계/동바리. A standalone
    // 시스템 category is a separate master group, even if the item name has 비계.
    if (category.includes('시스템') && !/비계|동바리|서포트/.test(category)) return 'system';
    return getMaterialGroupKey(material);
};
