import { FieldValue, Timestamp } from 'firebase/firestore';

export type AccommodationAssignmentStatus = 'active' | 'ended';

export type AccommodationAssignmentSource = 'team' | 'worker';

export interface AccommodationAssignment {
    id?: string;

    workerId: string;
    workerName?: string;

    teamId?: string;
    teamName?: string;

    accommodationId: string;
    accommodationName?: string;

    status: AccommodationAssignmentStatus;

    startDate: string;
    endDate?: string;

    source?: AccommodationAssignmentSource;
    memo?: string;

    createdAt?: Timestamp | FieldValue | null;
    updatedAt?: Timestamp | FieldValue | null;
}
