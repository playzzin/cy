import { rentalQuoteCatalog } from './rentalQuoteCatalog';

describe('대치 임대거래 견적 단가표', () => {
    it.each([
        ['shoring', 23, 5500, 136],
        ['scaffold', 25, 17430, 390],
    ] as const)('%s 원본의 행 수, 수량, 단가 합계를 보존한다', (workType, count, baseFees, dailyFees) => {
        const rows = rentalQuoteCatalog.filter(row => row.workType === workType);
        expect(rows).toHaveLength(count);
        expect(rows.every(row => row.quantity === 1)).toBe(true);
        expect(rows.reduce((sum, row) => sum + row.baseFee, 0)).toBe(baseFees);
        expect(rows.reduce((sum, row) => sum + row.dailyFee, 0)).toBe(dailyFees);
    });

    it('공종별로 같은 수평재를 개별 품목으로 보존한다', () => {
        expect(new Set(rentalQuoteCatalog.map(row => row.materialId)).size).toBe(rentalQuoteCatalog.length);
        const commonRows = rentalQuoteCatalog.filter(row => row.itemName === '수평재' && row.spec === 'H-18');
        expect(commonRows.map(row => row.materialId)).toEqual(['daechi-shoring-7', 'daechi-scaffold-5']);
    });

    it('일단가가 비어 있는 동바리 대각재 핀을 미기재 상태로 구분한다', () => {
        const unavailable = rentalQuoteCatalog.filter(row => !row.active || row.dailyFeeMissing);
        expect(unavailable).toEqual([expect.objectContaining({
            materialId: 'daechi-shoring-16',
            itemName: '대각재',
            spec: '대각재 핀',
            baseFee: 120,
            dailyFeeMissing: true,
            active: false,
        })]);
    });
});
