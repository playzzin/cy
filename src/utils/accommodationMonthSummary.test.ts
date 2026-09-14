import { getAccommodationMonthSummary } from './accommodationMonthSummary';
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
