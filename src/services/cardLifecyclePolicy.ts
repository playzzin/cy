import type { CardStatus } from '../types/card';

export const INACTIVE_CARD_STATUSES: ReadonlySet<CardStatus> = new Set<CardStatus>([
    'SUSPENDED',
    'CLOSED',
]);

export const isInactiveCardStatus = (status?: CardStatus | null): boolean => (
    Boolean(status && INACTIVE_CARD_STATUSES.has(status))
);

export const canRestoreCardStatus = (status?: CardStatus | null): boolean => status === 'SUSPENDED';

export const assertCardCanBeAssignedOrBilled = (status?: CardStatus | null): void => {
    if (isInactiveCardStatus(status)) {
        throw new Error('inactive-card-operation-blocked');
    }
};

export const assertCardCanBeRestored = (status?: CardStatus | null): void => {
    if (!canRestoreCardStatus(status)) {
        throw new Error('card-restore-requires-suspended-status');
    }
};

export const formatKoreanBusinessDate = (date: Date = new Date()): string => {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
};

export const createCardLifecycleOperationId = (
    action: 'cancel' | 'restore',
    cardId: string
): string => {
    const randomPart = typeof globalThis.crypto?.randomUUID === 'function'
        ? globalThis.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return `card-${action}-${cardId}-${randomPart}`;
};
