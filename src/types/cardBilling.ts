// src/types/cardBilling.ts
import { Timestamp } from './timestamp';

export type CardBillingStatus = 'DRAFT' | 'CONFIRMED' | 'PAID' | 'OVERDUE' | 'CANCELLED';
export type CardBillingIssuedToType = 'team' | 'worker';

export interface CardBillingCostItem {
    id?: string;
    label: string;
    amount: number;
    type?: 'FIXED' | 'VARIABLE';
    category?: string;
    sourceType?: 'card_ledger' | 'manual';
    sourceLedgerRowId?: string;
    sourceSegmentId?: string;
    sourceStartDate?: string;
    sourceEndDate?: string;
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
    confirmationCancelReason?: string;
    confirmationCancelledAt?: Timestamp;
    confirmationCancelledById?: string;
    confirmationCancelledByName?: string;
    legacyId?: string;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
    confirmedAt?: Timestamp;
}
