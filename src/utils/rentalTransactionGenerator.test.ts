import {
    calculateRentalLineAmount,
    generateRentalTransactionItems,
    RentalMaterialRate,
} from './rentalTransactionGenerator';

const rates: RentalMaterialRate[] = [
    {
        materialId: 'rental-a',
        category: '동바리',
        itemName: '서포트',
        spec: '3.5M',
        unit: 'EA',
        baseFee: 1000,
        dailyFee: 150,
        maxQuantity: 1000,
        active: true,
    },
    {
        materialId: 'rental-b',
        category: '동바리',
        itemName: '각파이프',
        spec: '48.6',
        unit: 'EA',
        baseFee: 2400,
        dailyFee: 300,
        maxQuantity: 1000,
        active: true,
    },
];

describe('generateRentalTransactionItems', () => {
    it('matches the requested supply amount exactly, including won-level remainders', () => {
        const result = generateRentalTransactionItems(rates, {
            targetAmount: 123457,
            amountBasis: 'supply',
            usageDays: 2,
            rowCount: 2,
            vatRate: 10,
            includeVat: true,
            issueDate: '2026-08-04',
        });

        expect(result.subtotal).toBe(123457);
        expect(result.difference).toBe(0);
        expect(result.items.reduce((sum, item) => sum + calculateRentalLineAmount(item), 0)).toBe(123457);
        expect(result.items).toEqual(expect.arrayContaining([
            expect.objectContaining({
                category: '금액 조정',
                label: '임대 금액 조정',
                note: '목표 공급가 맞춤',
            }),
        ]));
    });

    it('also makes a target below every material unit amount exact', () => {
        const result = generateRentalTransactionItems(rates, {
            targetAmount: 77,
            amountBasis: 'supply',
            usageDays: 2,
            rowCount: 2,
            vatRate: 10,
            includeVat: true,
            issueDate: '2026-08-04',
        });

        expect(result.subtotal).toBe(77);
        expect(result.difference).toBe(0);
        expect(result.items).toHaveLength(1);
        expect(result.items[0]).toMatchObject({ category: '금액 조정', finalUnitPrice: 77 });
    });
});
