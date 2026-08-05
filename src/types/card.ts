import { Timestamp } from './timestamp';

export type CardType = 'CHECK' | 'CREDIT';
export type CardStatus = 'ASSIGNED' | 'SUSPENDED' | 'CLOSED' | 'AVAILABLE';
export type CardAssigneeType = 'WORKER' | 'TEAM';
export type CardBillingTargetType = CardAssigneeType | 'OFFICE' | 'OFFICE_STAFF';
export type CardTransactionCategory = 'FUEL' | 'TOLL' | 'MEAL' | 'MATERIAL' | 'OTHER';
export type CardTransactionStatus = 'ACTIVE' | 'CANCELLED';

export interface Card {
    id: string;
    name: string;
    issuer: string;
    cardType: CardType;
    last4: string;
    maskedNumber: string;
    expiry?: string;
    status: CardStatus;
    currentAssigneeId?: string | null;
    currentAssigneeType?: CardAssigneeType | null;
    currentAssigneeName?: string | null;
    billingTargetId?: string | null;
    billingTargetType?: CardBillingTargetType | null;
    billingTargetName?: string | null;
    billingTargetStartDate?: string | null;
    billingTargetEndDate?: string | null;
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

export interface CardBillingTargetRecord {
    id: string;
    cardId: string;
    cardLabel: string;
    targetId: string;
    targetType: CardBillingTargetType;
    targetName: string;
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
    status?: CardTransactionStatus;
    operationId?: string;
    lastOperationId?: string;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
    cancelledAt?: Timestamp;
}
