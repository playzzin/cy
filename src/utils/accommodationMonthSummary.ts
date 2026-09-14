import type { Accommodation, UtilityRecord } from '../types/accommodation';

export const overlapsAccommodationMonth = (range: { startDate?: string; endDate?: string }, yearMonth: string): boolean => {
    const [year, month] = yearMonth.split('-').map(Number);
    const first = `${yearMonth}-01`;
    const last = `${yearMonth}-${new Date(year, month, 0).getDate()}`;
    return (!range.startDate || range.startDate.slice(0, 10) <= last)
        && (!range.endDate || range.endDate.slice(0, 10) >= first);
};

export const getAccommodationMonthSummary = (
    accommodations: Accommodation[], yearMonth: string, records: UtilityRecord[],
): { rent: number; deposit: number } => {
    const byId = new Map(records.filter(record => record.yearMonth === yearMonth).map(record => [record.accommodationId, record]));
    const amount = (value: unknown): number => Number.isFinite(Number(value)) ? Number(value) : 0;
    return accommodations.reduce((total, accommodation) => {
        const contract = accommodation.contract;
        // A closed contract still belongs in the months when it was in use.
        if (!overlapsAccommodationMonth(contract || {}, yearMonth)
            || (accommodation.status === 'inactive' && !contract?.endDate)) return total;
        const record = byId.get(accommodation.id);
        total.rent += amount(record?.costs?.rent ?? contract?.monthlyRent);
        total.deposit += amount(contract?.deposit);
        return total;
    }, {rent: 0, deposit: 0});
};
