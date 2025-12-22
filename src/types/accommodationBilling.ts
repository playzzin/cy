import { Timestamp } from 'firebase/firestore';

export type AccommodationBillingStatus = 'draft' | 'confirmed';

export type AccommodationBillingIssuedToType = 'team_leader' | 'worker';

export type AccommodationBillingTargetField =
    | 'accommodation'
    | 'privateRoom'
    | 'electricity'
    | 'gas'
    | 'internet'
    | 'water'
    | 'fines'
    | 'deposit'
    | 'gloves';

export interface AccommodationBillingLineItem {
    id: string;
    label: string;
    amount: number;
    targetField: AccommodationBillingTargetField;
}

export interface AccommodationBillingDocument {
    id: string;
    yearMonth: string;
    teamId: string;
    teamName: string;

    issuedToType: AccommodationBillingIssuedToType;
    issuedToWorkerId: string;
    issuedToWorkerName: string;

    status: AccommodationBillingStatus;
    memo?: string;

    lineItems: AccommodationBillingLineItem[];

    createdAt?: Timestamp;
    updatedAt?: Timestamp;
    confirmedAt?: Timestamp;

    postedAdvancePaymentId?: string;
}

export { };
