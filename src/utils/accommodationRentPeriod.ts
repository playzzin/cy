import type { Accommodation } from '../types/accommodation';
import type { AccommodationBillingDocument, AccommodationBillingLineItem } from '../types/accommodationBilling';
import { getAccommodationExpenseBucket } from './accommodationExpenseClassification';
import { getAccommodationRentEndMonth, isAccommodationBillingEndMonth } from './accommodationLifecycle';

export const isAutomaticAccommodationRent = (item: AccommodationBillingLineItem): boolean => (
    item.sourceType === 'utility_ledger' && Boolean(item.sourceAccommodationId)
    && item.amount > 0 && ['accommodation', 'privateRoom'].includes(getAccommodationExpenseBucket(item))
);

/** Read-only expense projection. Retain utility settlements and all posted/manual charges. */
export const applyAccommodationRentPeriod = (
    documents: AccommodationBillingDocument[], rooms: Accommodation[],
): AccommodationBillingDocument[] => {
    const roomsById = new Map(rooms.map(room => [room.id, room]));
    return documents.map(document => {
        if (String(document.status).trim().toUpperCase() !== 'DRAFT'
            || !isAccommodationBillingEndMonth(document.yearMonth)) return document;
        return {
            ...document,
            lineItems: document.lineItems.map(item => {
                if (!isAutomaticAccommodationRent(item)) return item;
                const room = roomsById.get(item.sourceAccommodationId!);
                const endMonth = room ? getAccommodationRentEndMonth(room) : '';
                if (!endMonth || document.yearMonth <= endMonth) return item;
                return { ...item, amount: 0, excludedContractRent: { amount: item.amount, endMonth } };
            }),
        };
    });
};
