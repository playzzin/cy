import { getMaterialGroupKey, MaterialDisplayRow, MaterialGroupKey } from '../../utils/materialOrdering';

export type MaterialMasterGroupKey = MaterialGroupKey | 'system';
export type MaterialMasterDisplayGroupKey = MaterialGroupKey;

export const MATERIAL_MASTER_CATEGORIES: Record<MaterialMasterDisplayGroupKey, string> = {
    dongbari: '동바리',
    scaffolding: '비계',
    other: '기타',
};

export const getMaterialMasterGroupKey = (material: MaterialDisplayRow): MaterialMasterGroupKey => {
    const category = String(material.category ?? '').trim();
    // Preserve the established aliases for 시스템 비계/동바리. A standalone
    // 시스템 category is mapped to 기타 by the shared display helper below.
    if (category.includes('시스템') && !/비계|동바리|서포트/.test(category)) return 'system';
    return getMaterialGroupKey(material);
};

export const getMaterialMasterDisplayGroupKey = (material: MaterialDisplayRow): MaterialMasterDisplayGroupKey => {
    const category = String(material.category ?? '').trim();
    if (category === '동바리') return 'dongbari';
    if (category === '비계') return 'scaffolding';
    if (category === '기타') return 'other';
    const group = getMaterialMasterGroupKey(material);
    return group === 'system' ? 'other' : group;
};

export const getMaterialMasterCategory = (material: MaterialDisplayRow): string =>
    MATERIAL_MASTER_CATEGORIES[getMaterialMasterDisplayGroupKey(material)];
