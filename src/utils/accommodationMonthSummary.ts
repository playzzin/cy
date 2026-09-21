import type { Accommodation, UtilityRecord } from '../types/accommodation';

const amount = (value: unknown): number => {
    const parsed = typeof value === 'string' ? Number(value.replace(/,/g, '').trim()) : Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

// Status cards describe recurring contract costs. Ledger rent can be prorated or
// temporarily zero, so it is only a fallback when no contract amount is stored.
export const getAccommodationContractAmounts = (accommodation: Accommodation, record?: UtilityRecord) => {
    const legacy = accommodation as Accommodation & { monthlyRent?: number; deposit?: number };
    const legacyRecord = record as (UtilityRecord & { deposit?: number; costs: UtilityRecord['costs'] & { deposit?: number } }) | undefined;
    return {
        rent: amount(accommodation.contract?.monthlyRent ?? legacy.monthlyRent ?? record?.costs?.rent),
        deposit: amount(accommodation.contract?.deposit ?? legacy.deposit ?? legacyRecord?.deposit ?? legacyRecord?.costs?.deposit),
    };
};

export const overlapsAccommodationMonth = (range: { startDate?: string; endDate?: string }, yearMonth: string): boolean => {
    const [year, month] = yearMonth.split('-').map(Number);
    const first = `${yearMonth}-01`;
    const last = `${yearMonth}-${new Date(year, month, 0).getDate()}`;
    return (!range.startDate || range.startDate.slice(0, 10) <= last)
        && (!range.endDate || range.endDate.slice(0, 10) >= first);
};

export const getAccommodationMonthSummaryByOwnership = (
    accommodations: Accommodation[], yearMonth: string, records: UtilityRecord[],
) => ({
    Cheongyeon: getAccommodationMonthSummary(accommodations.filter(room => !room.ownership || room.ownership === 'Cheongyeon'), yearMonth, records),
    Individual: getAccommodationMonthSummary(accommodations.filter(room => room.ownership === 'Individual'), yearMonth, records),
    Dawon: getAccommodationMonthSummary(accommodations.filter(room => room.ownership === 'Dawon'), yearMonth, records),
});

export const getAccommodationMonthSummary = (
    accommodations: Accommodation[], yearMonth: string, records: UtilityRecord[],
): { rent: number; deposit: number } => {
    const byId = new Map(records.filter(record => record.yearMonth === yearMonth).map(record => [record.accommodationId, record]));
    return accommodations.reduce((total, accommodation) => {
        const contract = accommodation.contract;
        // A closed contract still belongs in the months when it was in use.
        if (!overlapsAccommodationMonth(contract || {}, yearMonth)
            || (accommodation.status === 'inactive' && !contract?.endDate)) return total;
        const record = byId.get(accommodation.id);
        const values = getAccommodationContractAmounts(accommodation, record);
        total.rent += values.rent;
        total.deposit += values.deposit;
        return total;
    }, {rent: 0, deposit: 0});
};
