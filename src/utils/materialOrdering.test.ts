import { getMaterialGroupKey, sortMaterialDisplayRows } from './materialOrdering';

describe('materialOrdering', () => {
    it('orders dongbari default item names before 기타 and sorts non-default item names before 기타', () => {
        const rows = [
            { category: '동바리', itemName: '기타', spec: '파이프 6M' },
            { category: '동바리', itemName: '대각재', spec: 'B1718' },
            { category: '동바리', itemName: '수평재', spec: 'H18' },
            { category: '동바리', itemName: '발판', spec: '5006' },
            { category: '동바리', itemName: '받침 철물', spec: '상부자키' },
            { category: '동바리', itemName: '부속철물', spec: '대각재 핀' },
            { category: '동바리', itemName: '멍에재', spec: '6M' },
            { category: '동바리', itemName: '수직재', spec: 'P17' },
        ];

        expect(sortMaterialDisplayRows(rows).map((row) => row.itemName)).toEqual([
            '수직재',
            '수평재',
            '받침 철물',
            '대각재',
            '멍에재',
            '부속철물',
            '발판',
            '기타',
        ]);
    });

    it('orders scaffolding default item names and leaves non-default names before 기타', () => {
        const rows = [
            { category: '비계', itemName: '기타', spec: '트러스' },
            { category: '비계', itemName: '해치', spec: '해치5018' },
            { category: '비계', itemName: '수직재', spec: 'P38' },
            { category: '비계', itemName: '대각재', spec: '비계용' },
            { category: '비계', itemName: '발판', spec: '5018' },
            { category: '비계', itemName: '부속 철물', spec: '브라켓' },
            { category: '비계', itemName: '수평재', spec: 'H18' },
            { category: '비계', itemName: '받침 철물', spec: '하부자키' },
        ];

        expect(sortMaterialDisplayRows(rows).map((row) => row.itemName)).toEqual([
            '수직재',
            '수평재',
            '받침 철물',
            '발판',
            '해치',
            '부속 철물',
            '대각재',
            '기타',
        ]);
    });

    it('classifies 시스템 text as dongbari only after 비계 is excluded', () => {
        expect(getMaterialGroupKey({ category: '시스템 비계', itemName: '수직재' })).toBe('scaffolding');
        expect(getMaterialGroupKey({ category: '시스템 동바리', itemName: '수직재' })).toBe('dongbari');
    });
});
