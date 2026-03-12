// src/types/cardBilling.ts
import { Timestamp } from './timestamp';

export type CardBillingStatus = 'DRAFT' | 'CONFIRMED' | 'PAID' | 'OVERDUE';
export type CardBillingIssuedToType = 'team' | 'worker';

export interface CardBillingCostItem {
    id?: string;
    label: string;
    amount: number;
    type?: 'FIXED' | 'VARIABLE';
    category?: string;
}

export interface CardBillingDocument {
    id: string;
    yearMonth: string;

    cardId: string;
    cardLabel: string;

    assignedTeamId?: string;
    assignedTeamName?: string;

    teamId?: string;
    teamName?: string;

    issuedToType?: CardBillingIssuedToType;
    issuedToWorkerId?: string;
    issuedToWorkerName?: string;

    variableCost: number;
    totalAmount: number;

    status: CardBillingStatus;
    lineItems: CardBillingCostItem[];
    statementAttachmentPaths: string[];
    memo?: string;
    legacyId?: string;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
    confirmedAt?: Timestamp;
}
