import app from '../config/firebase';
import { getDataConnect } from 'firebase/data-connect';
import {
    connectorConfig,
    createCard,
    createCardAssignment,
    createCardTransaction,
    deleteCard,
    deleteCardTransaction,
    listCardAssignments,
    listCardTransactions,
    listCards,
    updateCard,
    updateCardAssignment,
    type CreateCardData,
    type CreateCardVariables,
    type CreateCardAssignmentVariables,
    type CreateCardTransactionData,
    type CreateCardTransactionVariables,
    type DeleteCardTransactionVariables,
    type ListCardsData,
    type ListCardAssignmentsData,
    type ListCardTransactionsData,
    type UpdateCardAssignmentVariables,
    type UpdateCardVariables
} from './dataconnectCompat';
import { Timestamp } from '../types/timestamp';
import {
    type Card,
    type CardType,
    type CardStatus,
    type CardAssigneeType,
    type CardTransaction,
    type CardTransactionCategory,
    type CardAssignmentRecord
} from '../types/card';

export {
    type Card,
    type CardType,
    type CardStatus,
    type CardAssigneeType,
    type CardTransaction,
    type CardTransactionCategory,
    type CardAssignmentRecord
};

const dc = getDataConnect(app, connectorConfig);

const isUuidString = (value: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ||
    /^[0-9a-f]{32}$/i.test(value);

const toTimestamp = (value?: string | null): Timestamp | undefined => {
    if (!value) return undefined;
    const d = new Date(String(value));
    if (Number.isNaN(d.getTime())) return undefined;
    return Timestamp.fromDate(d);
};

const safeString = (value: unknown): string => (typeof value === 'string' ? value : '');

const safeOptionalString = (value: unknown): string | undefined => {
    const v = safeString(value).trim();
    return v ? v : undefined;
};

const safeNumber = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

const parseCardType = (value: unknown): CardType => {
    const v = safeString(value);
    if (v === 'CHECK') return 'CHECK';
    return 'CREDIT';
};

const parseCardStatus = (value: unknown): CardStatus => {
    const v = safeString(value);
    if (v === 'ASSIGNED' || v === 'SUSPENDED' || v === 'CLOSED') return v;
    return 'AVAILABLE';
};

const parseAssigneeType = (value: unknown): CardAssigneeType => {
    const v = safeString(value);
    if (v === 'WORKER') return 'WORKER';
    return 'TEAM';
};

const parseCategory = (value: unknown): CardTransactionCategory => {
    const v = safeString(value);
    if (v === 'FUEL' || v === 'TOLL' || v === 'MEAL' || v === 'MATERIAL') return v;
    return 'OTHER';
};

const formatYearMonth = (date: string): string => {
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
};

const unwrapQuery = <T>(value: unknown): T | null => {
    if (!value || typeof value !== 'object') return null;
    const v = value as { data?: T };
    return v.data ?? null;
};

const resolveCardUuid = async (id: string): Promise<string | null> => {
    if (!id) return null;
    const trimmed = String(id).trim();
    if (!trimmed) return null;
    if (isUuidString(trimmed)) return trimmed;

    const res = await listCards(dc);
    const data = unwrapQuery<ListCardsData>(res);
    const rows = data?.cards ?? [];

    const exactHit = rows.find((r: any) => String(r.id) === trimmed || String(r.id) === id);
    if (exactHit?.id) return String(exactHit.id);

    const legacyHit = rows.find((r: any) => safeString(r.legacyId) === trimmed);
    return legacyHit?.id ? String(legacyHit.id) : null;
};

const resolveCardTransactionUuid = async (id: string): Promise<string | null> => {
    if (!id) return null;
    if (isUuidString(id)) return id;

    const res = await listCardTransactions(dc);
    const data = unwrapQuery<ListCardTransactionsData>(res);
    const rows = data?.cardTransactions ?? [];
    const hit = rows.find((r: any) => safeString(r.legacyId) === String(id));
    return hit?.id ? String(hit.id) : null;
};

const buildCardLabel = (card: Pick<Card, 'name' | 'last4'>): string => {
    const name = card.name.trim();
    const last4 = card.last4.trim();
    return last4 ? `${name} (${last4})` : name;
};

const mapCard = (row: any): Card => {
    return {
        id: String(row.id),
        name: safeString(row.name),
        issuer: safeString(row.issuer),
        cardType: parseCardType(row.cardType),
        last4: safeString(row.last4),
        maskedNumber: safeString(row.maskedNumber),
        expiry: safeString(row.expiry),
        status: parseCardStatus(row.status),
        currentAssigneeId: safeOptionalString(row.currentAssigneeId),
        currentAssigneeType: row.currentAssigneeType ? parseAssigneeType(row.currentAssigneeType) : undefined,
        currentAssigneeName: safeOptionalString(row.currentAssigneeName),
        memo: safeOptionalString(row.memo),
        createdAt: toTimestamp(row.createdAt) ?? null,
        updatedAt: toTimestamp(row.updatedAt) ?? null
    };
};

const mapAssignment = (row: any): CardAssignmentRecord => {
    return {
        id: String(row.id),
        cardId: row.card?.id ? String(row.card.id) : '',
        cardLabel: safeString(row.cardLabel) || buildCardLabel({ name: safeString(row.card?.name), last4: safeString(row.card?.last4) }),
        assigneeId: safeString(row.assigneeId),
        assigneeType: parseAssigneeType(row.assigneeType),
        assigneeName: safeString(row.assigneeName),
        startDate: safeString(row.startDate),
        endDate: row.endDate ? String(row.endDate) : undefined,
        note: safeOptionalString(row.note),
        createdAt: toTimestamp(row.createdAt),
        updatedAt: toTimestamp(row.updatedAt)
    };
};

const mapTransaction = (row: any): CardTransaction => {
    return {
        id: String(row.id),
        cardId: row.card?.id ? String(row.card.id) : '',
        cardLabel: safeString(row.cardLabel) || buildCardLabel({ name: safeString(row.card?.name), last4: safeString(row.card?.last4) }),
        date: safeString(row.date),
        yearMonth: safeString(row.yearMonth),
        merchant: safeString(row.merchant),
        category: parseCategory(row.category),
        amount: row.amount == null ? 0 : safeNumber(row.amount),
        memo: safeOptionalString(row.memo),
        evidenceUrl: safeOptionalString(row.evidenceUrl),
        createdAt: toTimestamp(row.createdAt)
    };
};

export const cardService = {
    getCards: async (): Promise<Card[]> => {
        const res = await listCards(dc);
        const data = unwrapQuery<ListCardsData>(res);
        const rows = data?.cards ?? [];
        const cards = rows.map(mapCard);
        cards.sort((a, b) => String(a.name).localeCompare(String(b.name), 'ko-KR'));
        return cards;
    },

    createCard: async (card: Omit<Card, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
        const vars: CreateCardVariables = {
            name: card.name,
            issuer: card.issuer,
            cardType: card.cardType,
            last4: card.last4,
            maskedNumber: card.maskedNumber,
            expiry: card.expiry ? card.expiry : null,
            status: card.status ?? 'AVAILABLE',
            currentAssigneeId: card.currentAssigneeId ?? null,
            currentAssigneeType: card.currentAssigneeType ?? null,
            currentAssigneeName: card.currentAssigneeName ?? null,
            memo: card.memo ?? null
        };

        const res = await createCard(dc, vars);
        const data = unwrapQuery<CreateCardData>(res);
        const created = data?.card_insert;
        return created?.id ? String(created.id) : '';
    },

    updateCard: async (id: string, updates: Partial<Card>): Promise<void> => {
        const uuid = await resolveCardUuid(id);
        if (!uuid) throw new Error('Card not found');

        const vars: UpdateCardVariables = {
            id: uuid,
            name: updates.name ?? undefined,
            issuer: updates.issuer ?? undefined,
            cardType: updates.cardType ?? undefined,
            last4: updates.last4 ?? undefined,
            maskedNumber: updates.maskedNumber ?? undefined,
            expiry: updates.expiry !== undefined ? (updates.expiry || null) : undefined,
            status: updates.status ?? undefined,
            currentAssigneeId: updates.currentAssigneeId !== undefined ? (updates.currentAssigneeId || null) : undefined,
            currentAssigneeType: updates.currentAssigneeType !== undefined ? (updates.currentAssigneeType || null) : undefined,
            currentAssigneeName: updates.currentAssigneeName !== undefined ? (updates.currentAssigneeName || null) : undefined,
            memo: updates.memo !== undefined ? (updates.memo || null) : undefined
        };

        await updateCard(dc, vars);
    },

    deleteCard: async (id: string): Promise<void> => {
        const uuid = await resolveCardUuid(id);
        if (!uuid) return;
        await deleteCard(dc, { id: uuid });
    },

    getAssignmentHistory: async (cardId: string): Promise<CardAssignmentRecord[]> => {
        const uuid = await resolveCardUuid(cardId);
        if (!uuid) return [];

        const res = await listCardAssignments(dc);
        const data = unwrapQuery<ListCardAssignmentsData>(res);
        const rows = data?.cardAssignments ?? [];

        const assignments = rows
            .filter((r: any) => String(r.card?.id ?? '') === uuid)
            .map(mapAssignment);

        assignments.sort((a, b) => String(b.startDate).localeCompare(String(a.startDate)));
        return assignments;
    },

    assignCard: async (
        cardId: string,
        assigneeId: string,
        assigneeType: CardAssigneeType,
        assigneeName: string,
        startDate: string
    ): Promise<void> => {
        const uuid = await resolveCardUuid(cardId);
        if (!uuid) throw new Error(`Card not found (id: ${cardId})`);

        const vars: CreateCardAssignmentVariables = {
            cardId: uuid,
            cardLabel: '',
            assigneeId,
            assigneeType,
            assigneeName,
            startDate,
            endDate: null,
            note: null
        };

        const cards = await cardService.getCards();
        const card = cards.find((c) => String(c.id) === String(uuid)) ?? null;
        if (card) {
            vars.cardLabel = buildCardLabel(card);
        }

        await createCardAssignment(dc, vars);

        const updateVars: UpdateCardVariables = {
            id: uuid,
            status: 'ASSIGNED',
            currentAssigneeId: assigneeId,
            currentAssigneeType: assigneeType,
            currentAssigneeName: assigneeName
        };
        await updateCard(dc, updateVars);
    },

    unassignCard: async (cardId: string, endDate: string): Promise<void> => {
        const uuid = await resolveCardUuid(cardId);
        if (!uuid) throw new Error(`Card not found (id: ${cardId})`);

        const res = await listCardAssignments(dc);
        const data = unwrapQuery<ListCardAssignmentsData>(res);
        const rows = data?.cardAssignments ?? [];

        const active = rows.find((r: any) => String(r.card?.id ?? '') === uuid && !r.endDate);
        if (active?.id) {
            const vars: UpdateCardAssignmentVariables = {
                id: String(active.id),
                endDate
            };
            await updateCardAssignment(dc, vars);
        }

        const updateVars: UpdateCardVariables = {
            id: uuid,
            status: 'AVAILABLE',
            currentAssigneeId: null,
            currentAssigneeType: null,
            currentAssigneeName: null
        };
        await updateCard(dc, updateVars);
    },

    getTransactionsByMonth: async (yearMonth: string): Promise<CardTransaction[]> => {
        const res = await listCardTransactions(dc);
        const data = unwrapQuery<ListCardTransactionsData>(res);
        const rows = data?.cardTransactions ?? [];

        const txs = rows
            .filter((r: any) => String(r.yearMonth ?? '') === yearMonth)
            .map(mapTransaction);

        txs.sort((a, b) => String(b.date).localeCompare(String(a.date)));
        return txs;
    },

    getTransactionsByCard: async (cardId: string, yearMonth?: string): Promise<CardTransaction[]> => {
        const uuid = await resolveCardUuid(cardId);
        if (!uuid) return [];

        const res = await listCardTransactions(dc);
        const data = unwrapQuery<ListCardTransactionsData>(res);
        const rows = data?.cardTransactions ?? [];

        const filtered = rows.filter((r: any) => {
            const cardUuid = String(r.card?.id ?? '');
            if (cardUuid !== uuid) return false;
            if (!yearMonth) return true;
            return String(r.yearMonth ?? '') === yearMonth;
        });

        const txs = filtered.map(mapTransaction);
        txs.sort((a, b) => String(b.date).localeCompare(String(a.date)));
        return txs;
    },

    addTransaction: async (payload: {
        cardId: string;
        cardLabel: string;
        date: string;
        merchant: string;
        category: CardTransactionCategory;
        amount: number;
        memo?: string;
        evidenceUrl?: string;
    }): Promise<string> => {
        const uuid = await resolveCardUuid(payload.cardId);
        if (!uuid) throw new Error('Card not found');

        const yearMonth = formatYearMonth(payload.date);
        if (!yearMonth) throw new Error('Invalid date');

        const vars: CreateCardTransactionVariables = {
            cardId: uuid,
            cardLabel: payload.cardLabel,
            date: payload.date,
            yearMonth,
            merchant: payload.merchant || null,
            category: payload.category,
            amount: payload.amount,
            memo: payload.memo ?? null,
            evidenceUrl: payload.evidenceUrl ?? null
        };

        const res = await createCardTransaction(dc, vars);
        const data = unwrapQuery<CreateCardTransactionData>(res);
        const created = data?.cardTransaction_insert;
        return created?.id ? String(created.id) : '';
    },

    deleteTransaction: async (id: string): Promise<void> => {
        const uuid = await resolveCardTransactionUuid(id);
        if (!uuid) return;
        const vars: DeleteCardTransactionVariables = { id: uuid };
        await deleteCardTransaction(dc, vars);
    }
};
