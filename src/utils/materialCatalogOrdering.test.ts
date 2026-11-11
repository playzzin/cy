import { EXCEL_MATERIAL_CATALOG } from '../constants/materialCatalog';
import { isCurrentCatalogMaterial, sortMaterialCatalogRows } from './materialCatalogOrdering';

const catalog = EXCEL_MATERIAL_CATALOG.flatMap(group => group.specs.map(spec => ({
    category: group.category, itemName: group.itemName, spec, unit: group.unit || 'EA',
})));

it('첨부 엑셀의 40/41/10개 품목과 중복 없는 91개 행을 유지한다', () => {
    expect(['동바리', '비계', '기타'].map(category => catalog.filter(row => row.category === category).length)).toEqual([40, 41, 10]);
    expect(new Set(catalog.map(row => JSON.stringify(row))).size).toBe(91);
    expect(catalog.every(row => row.unit === 'EA')).toBe(true);
});

it('이름순 정렬이 원본의 상부/하부 교차 순서와 마지막 멍에재 순서를 바꾸지 않는다', () => {
    const sorted = sortMaterialCatalogRows([...catalog].reverse());
    expect(sorted).toEqual(catalog);
    expect(sorted.slice(11, 14).map(row => [row.itemName, row.spec])).toEqual([
        ['동바리상부', '상부자키'], ['동바리하부', '하부자키'], ['동바리상부', 'W상부쟈키'],
    ]);
    expect(sorted.slice(77, 81).map(row => row.spec)).toEqual(['3.0M', '2.5M', '2.0M', '1.5M']);
    expect(sorted.slice(81).map(row => row.itemName)).toEqual(['파이프', '파이프', '파이프', '파이프', '파이프', '안전망', '안전망', '방염틀', '방염틀', '파손재']);
});

it('분류 별칭은 허용하되 구형 규격을 새 자재와 합치거나 사용자 자재를 삭제하지 않는다', () => {
    expect(isCurrentCatalogMaterial({ category: '시스템 비계', itemName: '수직재', spec: 'P-38' })).toBe(true);
    const old = { category: '동바리', itemName: '수직재', spec: 'P17' };
    expect(isCurrentCatalogMaterial(old)).toBe(false);
    const input = [old, ...catalog];
    expect(sortMaterialCatalogRows(input)).toEqual([...catalog, old]);
    expect(input[0]).toBe(old);
});
