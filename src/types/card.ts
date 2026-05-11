import { Timestamp } from './timestamp';

export type CardType = 'CHECK' | 'CREDIT';
export type CardStatus = 'ASSIGNED' | 'SUSPENDED' | 'CLOSED' | 'AVAILABLE';
export type CardAssigneeType = 'WORKER' | 'TEAM';
export type CardTransactionCategory = 'FUEL' | 'TOLL' | 'MEAL' | 'MATERIAL' | 'OTHER';

export interface Card {
    id: string;
    name: string;
    issuer: string;
    cardType: CardType;
    last4: string;
    maskedNumber: string;
    expiry?: string;
    status: CardStatus;
    currentAssigneeId?: string;
    currentAssigneeType?: CardAssigneeType;
    currentAssigneeName?: string;
    billingTargetId?: string | null;
    billingTargetType?: CardAssigneeType | null;
    billingTargetName?: string | null;
    memo?: string;
    legacyId?: string;
    createdAt?: Timestamp | null;
    updatedAt?: Timestamp | null;
}

export interface CardAssignmentRecord {
    id: string;
    cardId: string;
    cardLabel: string;
    assigneeId: string;
    assigneeType: CardAssigneeType;
    assigneeName: string;
    startDate: string;
    endDate?: string;
    note?: string;
    legacyId?: string;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
}

export interface CardTransaction {
    id: string;
    cardId: string;
    cardLabel: string;
    date: string;
    yearMonth: string;
    merchant: string;
    category: CardTransactionCategory;
    amount: number;
    memo?: string;
    evidenceUrl?: string;
    legacyId?: string;
    createdAt?: Timestamp;
}
