import { Timestamp } from './timestamp';

export type AccommodationBillingTargetType = 'team' | 'worker' | 'office' | 'office_staff';

export interface AccommodationBillingTarget {
    id: string;
    accommodationId: string;
    accommodationName?: string;
    targetType: AccommodationBillingTargetType;
    teamId?: string;
    teamName?: string;
    workerId?: string;
    workerName?: string;
    startDate?: string;
    endDate?: string;
    memo?: string;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
}

export interface UpsertAccommodationBillingTargetInput {
    id?: string;
    accommodationId: string;
    accommodationName?: string;
    targetType: AccommodationBillingTargetType;
    teamId?: string;
    teamName?: string;
    workerId?: string;
    workerName?: string;
    startDate?: string;
    endDate?: string;
    memo?: string;
}
