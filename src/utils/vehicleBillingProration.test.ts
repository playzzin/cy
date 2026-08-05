import { calculateVehicleBillingProration } from './vehicleBillingProration';

describe('vehicleBillingProration', () => {
    it('keeps the full monthly fee when the contract covers the full month', () => {
        expect(calculateVehicleBillingProration({
            yearMonth: '2026-06',
            monthlyFee: 310_000,
            startDate: '2026-01-01',
            endDate: '2026-12-31'
        })).toEqual({
            amount: 310_000,
            activeDays: 30,
            monthDays: 30,
            startDate: '2026-06-01',
            endDate: '2026-06-30'
        });
    });

    it('prorates a contract that starts during the billing month', () => {
        expect(calculateVehicleBillingProration({
            yearMonth: '2026-06',
            monthlyFee: 300_000,
            startDate: '2026-06-16'
        })).toMatchObject({
            amount: 150_000,
            activeDays: 15,
            monthDays: 30,
            startDate: '2026-06-16',
            endDate: '2026-06-30'
        });
    });

    it('prorates a contract that ends during the billing month', () => {
        expect(calculateVehicleBillingProration({
            yearMonth: '2026-06',
            monthlyFee: 300_000,
            startDate: '2026-01-01',
            endDate: '2026-06-10'
        })).toMatchObject({
            amount: 100_000,
            activeDays: 10,
            monthDays: 30,
            startDate: '2026-06-01',
            endDate: '2026-06-10'
        });
    });

    it('returns zero when the contract does not overlap the billing month', () => {
        expect(calculateVehicleBillingProration({
            yearMonth: '2026-06',
            monthlyFee: 300_000,
            startDate: '2026-07-01'
        })).toEqual({
            amount: 0,
            activeDays: 0,
            monthDays: 30
        });
    });

    it('returns zero for invalid months or fees', () => {
        expect(calculateVehicleBillingProration({ yearMonth: '2026-13', monthlyFee: 300_000 })).toEqual({
            amount: 0,
            activeDays: 0,
            monthDays: 0
        });
        expect(calculateVehicleBillingProration({ yearMonth: '2026-06', monthlyFee: Number.NaN })).toEqual({
            amount: 0,
            activeDays: 0,
            monthDays: 30
        });
    });
});
