import type { Accommodation } from '../types/accommodation';
import type { AccommodationBillingDocument } from '../types/accommodationBilling';
import { isAccommodationExpenseAfterEnd } from './accommodationLifecycle';

/** Hide all linked expenses after the last billable month, including empty detail rows. */
export const applyAccommodationExpensePeriod = (
    documents: AccommodationBillingDocument[], rooms: Accommodation[],
): AccommodationBillingDocument[] => {
    const roomsById = new Map(rooms.map(room => [room.id, room]));
    return documents.map(document => ({
        ...document,
        lineItems: document.lineItems.filter(item => {
            const room = roomsById.get(item.sourceAccommodationId || '');
            return !room || !isAccommodationExpenseAfterEnd(room, document.yearMonth);
        }),
    })).filter(document => document.lineItems.length > 0);
};
