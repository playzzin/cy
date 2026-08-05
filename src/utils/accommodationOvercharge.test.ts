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
    it('excludes rent and sums only utility fields', () => {
        expect(getUtilityOnlyTotal(makeRecord())).toBe(200_000);
    });

    it('flags a two-room record at the inclusive 200,000 won threshold', () => {
        expect(getAccommodationOvercharge(makeRecord(), makeAccommodation('TwoRoom'))).toEqual({
            type: 'TwoRoom',
            typeLabel: '투룸',
            utilityTotal: 200_000,
            threshold: 200_000,
            exceededAmount: 0
        });
    });

    it('uses the 300,000 won threshold for three-room records', () => {
        const summary = getAccommodationOvercharge(
            makeRecord({ electricity: 170_000 }),
            makeAccommodation('ThreeRoom')
        );

        expect(summary?.utilityTotal).toBe(300_000);
        expect(summary?.threshold).toBe(300_000);
    });

    it('uses a per-accommodation threshold when one is configured', () => {
        const accommodation = {
            ...makeAccommodation('TwoRoom'),
            utilityOverchargeThreshold: 250_000
        };

        expect(getAccommodationOvercharge(makeRecord(), accommodation)).toBeNull();
        expect(getAccommodationOvercharge(
            makeRecord({ electricity: 130_000 }),
            accommodation
        )?.exceededAmount).toBe(10_000);
    });

    it('keeps manual memo text while updating or removing the generated line', () => {
        const summary = getAccommodationOvercharge(
            makeRecord({ electricity: 90_000 }),
            makeAccommodation('TwoRoom')
        );
        const memo = syncAccommodationOverchargeMemo('직접 입력한 메모', summary);

        expect(memo).toContain('[과청구 자동] 투룸');
        expect(memo).toContain('초과액 20,000원');
        expect(memo).toContain('직접 입력한 메모');
        expect(syncAccommodationOverchargeMemo(memo, null)).toBe('직접 입력한 메모');
    });
});
