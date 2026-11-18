type CardHistoryPeriod = { id: string; cardId: string; startDate: string; endDate?: string | null };

const validDate = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

/** Apply handoffs to the complete history before selecting a month.
 * An older overlapping record must not reappear after its successor ends.
 */
export const normalizeCardHistoryTimeline = <T extends CardHistoryPeriod>(records: T[]): T[] => {
    const sorted = records.filter(record => validDate(record.startDate)
        && (!record.endDate || (validDate(record.endDate) && record.endDate >= record.startDate)))
        .sort((left, right) => left.cardId.localeCompare(right.cardId)
            || left.startDate.localeCompare(right.startDate) || left.id.localeCompare(right.id));

    return sorted.flatMap((record, index) => {
        const next = sorted[index + 1];
        if (!next || next.cardId !== record.cardId) return [record];
        const handoff = new Date(`${next.startDate}T00:00:00Z`);
        handoff.setUTCDate(handoff.getUTCDate() - 1);
        const handoffEnd = handoff.toISOString().slice(0, 10);
        const endDate = record.endDate && record.endDate < handoffEnd ? record.endDate : handoffEnd;
        return endDate < record.startDate ? [] : [{ ...record, endDate }];
    });
};
