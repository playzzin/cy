import { getAccommodationMonthSummary, getAccommodationMonthSummaryByOwnership } from './accommodationMonthSummary';
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

it('선택 월에 저장한 월세와 0원을 존중하고 다른 월의 금액을 섞지 않는다', () => {
    const records = [
        {accommodationId:'one',yearMonth:'2026-07',costs:{rent:0}},
        {accommodationId:'one',yearMonth:'2026-08',costs:{rent:600000}},
    ] as UtilityRecord[];
    expect(getAccommodationMonthSummary([room('one','2026-01-01')],'2026-07',records).rent).toBe(0);
    expect(getAccommodationMonthSummary([room('one','2026-01-01')],'2026-08',records).rent).toBe(600000);
});

it('월 중간 시작·종료 계약도 해당 월에 포함한다', () => {
    expect(getAccommodationMonthSummary([room('one','2026-08-15','2026-08-20')],'2026-08',[]).rent).toBe(500000);
    expect(getAccommodationMonthSummary([room('one','2026-08-15','2026-08-20')],'2026-09',[]).rent).toBe(0);
});

it('명의별 합계에도 선택 월과 저장 월세를 적용하며 미지정 명의는 청연에 포함한다', () => {
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
        Cheongyeon: { rent: 500000, deposit: 2000000 },
        Individual: { rent: 500000, deposit: 1000000 },
        Dawon: { rent: 500000, deposit: 1000000 },
    });
    expect(Object.values(summary).reduce((sum, value) => ({ rent: sum.rent + value.rent, deposit: sum.deposit + value.deposit }), { rent: 0, deposit: 0 }))
        .toEqual(getAccommodationMonthSummary(rooms, '2026-08', records));
    expect(getAccommodationMonthSummaryByOwnership([], '2026-08', []).Individual).toEqual({ rent: 0, deposit: 0 });
});
