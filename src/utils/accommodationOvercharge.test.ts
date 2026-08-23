import type { Accommodation, UtilityRecord } from '../types/accommodation';
import {
    getAccommodationOvercharge,
    getUtilityOnlyTotal,
    syncAccommodationOverchargeMemo
} from './accommodationOvercharge';

const makeRecord = (overrides: Partial<UtilityRecord['costs']> = {}): UtilityRecord => ({
    id: 'utility-1',
    accommodationId: 'accommodation-1',
    accommodationName: '테스트 숙소',
    yearMonth: '2026-07',
    costs: {
        rent: 800_000,
        electricity: 70_000,
        gas: 40_000,
        water: 30_000,
        internet: 20_000,
        maintenance: 30_000,
        other: 10_000,
        total: 1_000_000,
        ...overrides
    },
    paymentStatus: 'unpaid'
});

const makeAccommodation = (type: Accommodation['type']): Accommodation => ({
    id: 'accommodation-1',
    name: '테스트 숙소',
    address: '테스트 주소',
    type,
    status: 'active',
    ownership: 'Cheongyeon',
    contract: {
        startDate: '2026-01-01',
        endDate: '',
        deposit: 0,
        monthlyRent: 800_000,
        paymentDay: 1,
        landlordName: '',
        landlordContact: '',
        isReported: false
    },
    costProfile: {
        electricity: 'variable',
        gas: 'variable',
        water: 'variable',
        internet: 'variable',
        maintenance: 'variable'
    }
});

describe('accommodation overcharge helpers', () => {
    it('sums only electricity, gas, and water while excluding every other cost field', () => {
        expect(getUtilityOnlyTotal(makeRecord({
            internet: 900_000,
            maintenance: 800_000,
            other: 700_000
        }))).toBe(140_000);
    });

    it('flags a two-room record only when electricity, gas, and water exceed 200,000 won', () => {
        expect(getAccommodationOvercharge(
            makeRecord({ electricity: 130_000 }),
            makeAccommodation('TwoRoom')
        )).toBeNull();

        expect(getAccommodationOvercharge(
            makeRecord({ electricity: 130_001 }),
            makeAccommodation('TwoRoom')
        )).toEqual({
            type: 'TwoRoom',
            typeLabel: '투룸',
            utilityTotal: 200_001,
            threshold: 200_000,
            exceededAmount: 1
        });
    });

    it('uses the 300,000 won threshold for three-room records', () => {
        expect(getAccommodationOvercharge(
            makeRecord({ electricity: 230_000 }),
            makeAccommodation('ThreeRoom')
        )).toBeNull();

        const summary = getAccommodationOvercharge(
            makeRecord({ electricity: 230_001 }),
            makeAccommodation('ThreeRoom')
        );

        expect(summary?.utilityTotal).toBe(300_001);
        expect(summary?.threshold).toBe(300_000);
    });

    it('uses a per-accommodation threshold when one is configured', () => {
        const accommodation = {
            ...makeAccommodation('TwoRoom'),
            utilityOverchargeThreshold: 250_000
        };

        expect(getAccommodationOvercharge(
            makeRecord({ electricity: 180_000 }),
            accommodation
        )).toBeNull();
        expect(getAccommodationOvercharge(
            makeRecord({ electricity: 190_000 }),
            accommodation
        )?.exceededAmount).toBe(10_000);
    });

    it('keeps manual memo text while updating or removing the generated line', () => {
        const summary = getAccommodationOvercharge(
            makeRecord({ electricity: 150_000 }),
            makeAccommodation('TwoRoom')
        );
        const memo = syncAccommodationOverchargeMemo('직접 입력한 메모', summary);

        expect(memo).toContain('[과청구 자동] 투룸 전기+가스+수도');
        expect(memo).toContain('초과액 20,000원');
        expect(memo).toContain('직접 입력한 메모');
        expect(syncAccommodationOverchargeMemo(memo, null)).toBe('직접 입력한 메모');
    });
});
