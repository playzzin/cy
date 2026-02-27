import { Timestamp } from './timestamp';

export type AccommodationBillingTargetType = 'team' | 'worker';

export interface AccommodationBillingTarget {
    id: string;
    accommodationId: string;
    accommodationName?: string;
    targetType: AccommodationBillingTargetType;
    teamId?: string;
    teamName?: string;
    workerId?: string;
    workerName?: string;
    memo?: string;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
}

export interface UpsertAccommodationBillingTargetInput {
    accommodationId: string;
    accommodationName?: string;
    targetType: AccommodationBillingTargetType;
    teamId?: string;
    teamName?: string;
    workerId?: string;
    workerName?: string;
    memo?: string;
}
