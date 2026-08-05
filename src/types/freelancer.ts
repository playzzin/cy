import { Timestamp } from './timestamp';

export type FreelancerStatus = 'active' | 'inactive';

export interface Freelancer {
    id: string;
    name: string;
    teamId?: string;
    teamName?: string;
    residentNumber?: string;
    phone?: string;
    bankName?: string;
    accountNumber?: string;
    status: FreelancerStatus;
    memo?: string;
    createdAt?: Timestamp | null;
    updatedAt?: Timestamp | null;
    unitPrice?: number;
    legacyId?: string;
}

export interface FreelancerPayment {
    id: string;
    freelancerId: string;
    year: number;
    month: number;
    dailyRate?: number;
    manDays?: number;
    amount?: number;
    isManualTaxOverride?: boolean;
    performanceBonus?: number;
    reportingBalance?: number;
    reportableAmount?: number;
    depositDate?: string;
    memo?: string;
    createdAt?: Timestamp | null;
    updatedAt?: Timestamp | null;
    legacyId?: string;
}
