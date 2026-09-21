import { getAccommodationContractAmounts, getAccommodationMonthSummary, getAccommodationMonthSummaryByOwnership } from './accommodationMonthSummary';
import type { Accommodation, UtilityRecord } from '../types/accommodation';

const room = (id: string, startDate: string, endDate = '', status = 'active') => ({
    id, status, contract: {startDate, endDate, monthlyRent: 500000, deposit: 1000000},
} as Accommodation);

it('선택한 월에 존재한 숙소만 월세와 보증금에 합산한다', () => {
    const rooms = [room('old','2026-01-01'), room('new','2026-08-01'), room('ended','2026-01-01','2026-07-31','inactive')];
    expect(getAccommodationMonthSummary(rooms,'2026-07',[])).toEqual({rent:1000000,deposit:2000000});
    expect(getAccommodationMonthSummary(rooms,'2026-08',[])).toEqual({rent:1000000,deposit:2000000});
    expect(getAccommodationMonthSummary(rooms.slice(0,2),'2026-07',[])).toEqual({rent:500000,deposit:1000000});
    expect(getAccommodationMonthSummary(rooms.slice(0,2),'2026-08',[])).toEqual({rent:1000000,deposit:2000000});
});

it('월별 장부의 0원이나 다른 금액이 계약 월세 합계를 바꾸지 않는다', () => {
    const records = [
        {accommodationId:'one',yearMonth:'2026-07',costs:{rent:0}},
        {accommodationId:'one',yearMonth:'2026-08',costs:{rent:600000}},
    ] as UtilityRecord[];
    expect(getAccommodationMonthSummary([room('one','2026-01-01')],'2026-07',records).rent).toBe(500000);
    expect(getAccommodationMonthSummary([room('one','2026-01-01')],'2026-08',records).rent).toBe(500000);
});

it('월 중간 시작·종료 계약도 해당 월에 포함한다', () => {
    expect(getAccommodationMonthSummary([room('one','2026-08-15','2026-08-20')],'2026-08',[]).rent).toBe(500000);
    expect(getAccommodationMonthSummary([room('one','2026-08-15','2026-08-20')],'2026-09',[]).rent).toBe(0);
});

it('명의별 합계에도 선택 월과 계약 월세를 적용하며 미지정 명의는 청연에 포함한다', () => {
    const rooms: Accommodation[] = [
        room('default', '2026-01-01'),
        { ...room('company', '2026-01-01'), ownership: 'Cheongyeon' },
        { ...room('personal', '2026-08-01'), ownership: 'Individual' },
        { ...room('ended', '2026-01-01', '2026-07-31', 'inactive'), ownership: 'Individual' },
        { ...room('dawon', '2026-01-01'), ownership: 'Dawon' },
    ];
    const records = [{ accommodationId: 'company', yearMonth: '2026-08', costs: { rent: 0 } }] as UtilityRecord[];
    const summary = getAccommodationMonthSummaryByOwnership(rooms, '2026-08', records);
    expect(summary).toEqual({
        Cheongyeon: { rent: 1000000, deposit: 2000000 },
        Individual: { rent: 500000, deposit: 1000000 },
        Dawon: { rent: 500000, deposit: 1000000 },
    });
    expect(Object.values(summary).reduce((sum, value) => ({ rent: sum.rent + value.rent, deposit: sum.deposit + value.deposit }), { rent: 0, deposit: 0 }))
        .toEqual(getAccommodationMonthSummary(rooms, '2026-08', records));
    expect(getAccommodationMonthSummaryByOwnership([], '2026-08', []).Individual).toEqual({ rent: 0, deposit: 0 });
});

it('계약 월세가 없는 경우에만 선택 월 장부를 사용하며 계약 0원은 유지한다', () => {
    const missingRent = { ...room('one', '2026-01-01'), contract: { startDate: '2026-01-01' } } as Accommodation;
    const records = [
        { accommodationId: 'one', yearMonth: '2026-07', costs: { rent: 0 } },
        { accommodationId: 'one', yearMonth: '2026-08', costs: { rent: 600000 } },
    ] as UtilityRecord[];
    expect(getAccommodationMonthSummary([missingRent], '2026-07', records).rent).toBe(0);
    expect(getAccommodationMonthSummary([missingRent], '2026-08', records).rent).toBe(600000);
    expect(getAccommodationMonthSummary([missingRent], '2026-09', records).rent).toBe(0);
    const free = room('one', '2026-01-01');
    free.contract.monthlyRent = 0;
    expect(getAccommodationMonthSummary([free], '2026-08', records).rent).toBe(0);
});

it('상단 합계와 명의별 요약이 쉼표 금액 및 구형 필드에서도 같은 계약 금액을 사용한다', () => {
    const rooms = [
        { ...room('one', '2026-01-01'), contract: { startDate: '2026-01-01', monthlyRent: '500,000', deposit: '1,000,000' } },
        { id: 'two', status: 'active', monthlyRent: 700000, deposit: 2000000 },
    ] as unknown as Accommodation[];
    const records = [{ accommodationId: 'one', yearMonth: '2026-08', costs: { rent: 100000 } }] as UtilityRecord[];
    const bottomTotal = rooms.reduce((total, accommodation) => {
        const values = getAccommodationContractAmounts(accommodation, records.find(record => record.accommodationId === accommodation.id));
        return { rent: total.rent + values.rent, deposit: total.deposit + values.deposit };
    }, { rent: 0, deposit: 0 });
    expect(bottomTotal).toEqual({ rent: 1200000, deposit: 3000000 });
    expect(getAccommodationMonthSummary(rooms, '2026-08', records)).toEqual(bottomTotal);
    expect(getAccommodationMonthSummaryByOwnership(rooms, '2026-08', records).Cheongyeon).toEqual(bottomTotal);
});
