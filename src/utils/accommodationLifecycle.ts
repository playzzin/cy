import type { Accommodation, UtilityRecord } from '../types/accommodation';
import type { SupportCancellationLog } from '../types/supportCancellationLog';
import { overlapsAccommodationMonth } from './accommodationMonthSummary';

const dateText = (value?: string) => /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value! : '';

export const isAccommodationBillingEndMonth = (value?: string): boolean => /^\d{4}-(0[1-9]|1[0-2])$/.test(value || '');

export const getAccommodationBillingEndMonth = (room: Accommodation): string => {
    if (room.status !== 'inactive') return '';
    return isAccommodationBillingEndMonth(room.billingEndYearMonth)
        ? room.billingEndYearMonth! : dateText(room.endedDate).slice(0, 7);
};

/** Contract expiry also stops recurring rent when the room is still marked active. */
export const getAccommodationRentEndMonth = (room: Accommodation): string => (
    getAccommodationBillingEndMonth(room) || dateText(room.contract?.endDate).slice(0, 7)
);

/** The selected billing end month is inclusive and independent of contract expiry. */
export const getAccommodationStatusForMonth = (
    room: Accommodation,
    yearMonth: string,
    savedRecord?: Pick<UtilityRecord, 'accommodationId' | 'yearMonth'>,
): Accommodation['status'] => {
    if (room.status !== 'inactive') return 'active';
    const endMonth = getAccommodationBillingEndMonth(room);
    if (endMonth) return yearMonth <= endMonth ? 'active' : 'inactive';
    // Legacy status-only terminations have no reliable cutoff. A saved ledger
    // proves this month's use without inventing an end date or future charges.
    return savedRecord?.accommodationId === room.id && savedRecord.yearMonth === yearMonth
        && overlapsAccommodationMonth(room.contract || {}, yearMonth) ? 'active' : 'inactive';
};

export const isAccommodationContractInMonth = (room: Accommodation, yearMonth: string): boolean => {
    const endMonth = getAccommodationBillingEndMonth(room);
    if (endMonth) return overlapsAccommodationMonth({ startDate: room.contract?.startDate }, yearMonth) && yearMonth <= endMonth;
    return overlapsAccommodationMonth(room.contract || {}, yearMonth);
};

/** Recover old termination dates from the audit trail without changing stored data. */
export const applyAccommodationTerminationHistory = (
    rooms: Accommodation[], logs: SupportCancellationLog[],
): Accommodation[] => {
    const latest = new Map<string, SupportCancellationLog>();
    const time = (log: SupportCancellationLog) => {
        const timestamp = log.createdAt as { toMillis?: () => number } | undefined;
        return timestamp?.toMillis?.() || Date.parse(log.createdAtIso || log.processedDate) || 0;
    };
    logs.filter(log => log.resourceType === 'accommodation' && ['active', 'inactive'].includes(log.statusAfter || ''))
        .forEach(log => {
            const prior = latest.get(log.resourceId);
            if (!prior || time(log) > time(prior)) latest.set(log.resourceId, log);
        });
    return rooms.map(room => {
        if (room.status !== 'inactive' || dateText(room.endedDate) || isAccommodationBillingEndMonth(room.billingEndYearMonth)) return room;
        const log = latest.get(room.id);
        const endedDate = log?.statusAfter === 'inactive' ? dateText(log.processedDate) : '';
        const billingEndYearMonth = log?.statusAfter === 'inactive' && isAccommodationBillingEndMonth(log.billingEndYearMonth)
            ? log.billingEndYearMonth : endedDate.slice(0, 7);
        return billingEndYearMonth ? { ...room, endedDate, billingEndYearMonth } : room;
    });
};
