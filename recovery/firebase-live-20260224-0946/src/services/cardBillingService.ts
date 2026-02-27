import app from '../config/firebase';
import { getDataConnect } from 'firebase/data-connect';
import {
    connectorConfig,
    createCardBillingDocument,
    deleteCardBillingDocument,
    listCardBillingDocuments,
    listCards,
    listTeams,
    listWorkers,
    updateCardBillingDocument,
    type CreateCardBillingDocumentVariables,
    type DeleteCardBillingDocumentVariables,
    type ListCardBillingDocumentsData,
    type ListCardsData,
    type ListTeamsData,
    type ListWorkersData,
    type UpdateCardBillingDocumentVariables
} from './dataconnectCompat';
import { CardBillingCostItem, CardBillingDocument, CardBillingIssuedToType, CardBillingStatus } from '../types/cardBilling';
import { Card } from './cardService'; // Use from cardService for consistency
import { Timestamp } from '../types/timestamp';
import { cardService } from './cardService';

const dc = getDataConnect(app, connectorConfig);

const isUuidString = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const unwrapQuery = <T>(value: unknown): T | null => {
    if (!value || typeof value !== 'object') return null;
    const v = value as { data?: T };
    return v.data ?? null;
};

const safeString = (value: unknown): string => (typeof value === 'string' ? value : '');

const safeJsonParse = <T>(value: unknown, fallback: T): T => {
    if (typeof value !== 'string') return fallback;
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    try {
        return JSON.parse(trimmed) as T;
    } catch {
        return fallback;
    }
};

const toTimestamp = (value?: string | null): Timestamp | undefined => {
    if (!value) return undefined;
    const d = new Date(String(value));
    if (Number.isNaN(d.getTime())) return undefined;
    return Timestamp.fromDate(d);
};

const parseBillingStatus = (value: unknown): CardBillingStatus => {
    const v = safeString(value);
    if (v === 'CONFIRMED' || v === 'PAID' || v === 'OVERDUE') return v;
    return 'DRAFT';
};

const parseIssuedToType = (value: unknown): CardBillingIssuedToType | undefined => {
    const v = safeString(value);
    if (v === 'team') return 'team';
    if (v === 'team_leader') return 'team';
    if (v === 'worker') return 'worker';
    return undefined;
};

let dcTeamsLoaded = false;
let dcWorkersLoaded = false;

const dcTeamLegacyIdToUuid = new Map<string, string>();
const dcWorkerLegacyIdToUuid = new Map<string, string>();

const loadDcTeams = async (): Promise<void> => {
    if (dcTeamsLoaded) return;
    const res = await listTeams(dc);
    const data = unwrapQuery<ListTeamsData>(res);
    const rows = data?.teams ?? [];

    dcTeamLegacyIdToUuid.clear();
    for (const row of rows) {
        const uuid = row?.id ? String(row.id) : '';
        const legacyId = row?.legacyId ? String(row.legacyId) : '';
        if (uuid) dcTeamLegacyIdToUuid.set(uuid, uuid);
        if (legacyId && uuid) dcTeamLegacyIdToUuid.set(legacyId, uuid);
    }

    dcTeamsLoaded = true;
};

const loadDcWorkers = async (): Promise<void> => {
    if (dcWorkersLoaded) return;
    const res = await listWorkers(dc);
    const data = unwrapQuery<ListWorkersData>(res);
    const rows = data?.workers ?? [];

    dcWorkerLegacyIdToUuid.clear();
    for (const row of rows) {
        const uuid = row?.id ? String(row.id) : '';
        const legacyId = row?.legacyId ? String(row.legacyId) : '';
        if (uuid) dcWorkerLegacyIdToUuid.set(uuid, uuid);
        if (legacyId && uuid) dcWorkerLegacyIdToUuid.set(legacyId, uuid);
    }

    dcWorkersLoaded = true;
};

const resolveTeamUuid = async (id: string | undefined): Promise<string | null> => {
    const raw = id ? String(id) : '';
    if (!raw) return null;
    if (isUuidString(raw)) return raw;

    await loadDcTeams();
    const found = dcTeamLegacyIdToUuid.get(raw);
    if (found) return found;

    dcTeamsLoaded = false;
    await loadDcTeams();
    return dcTeamLegacyIdToUuid.get(raw) ?? null;
};

const resolveWorkerUuid = async (id: string | undefined): Promise<string | null> => {
    const raw = id ? String(id) : '';
    if (!raw) return null;
    if (isUuidString(raw)) return raw;

    await loadDcWorkers();
    const found = dcWorkerLegacyIdToUuid.get(raw);
    if (found) return found;

    dcWorkersLoaded = false;
    await loadDcWorkers();
    return dcWorkerLegacyIdToUuid.get(raw) ?? null;
};

const resolveCardUuid = async (id: string): Promise<string | null> => {
    if (!id) return null;
    if (isUuidString(id)) return id;

    const res = await listCards(dc);
    const data = unwrapQuery<ListCardsData>(res);
    const rows = data?.cards ?? [];
    const hit = rows.find((r: any) => safeString(r.legacyId) === String(id));
    return hit?.id ? String(hit.id) : null;
};

const normalizeLineItems = (items: CardBillingCostItem[]): CardBillingCostItem[] => {
    return (items ?? []).filter((x) => x && typeof x.label === 'string' && typeof x.amount === 'number');
};

const computeTotals = (items: CardBillingCostItem[]): { variableCost: number; totalAmount: number } => {
    const normalized = normalizeLineItems(items);
    const variableCost = normalized.reduce((acc, it) => acc + (Number.isFinite(it.amount) ? it.amount : 0), 0);
    return { variableCost, totalAmount: variableCost };
};

const mapBillingDocument = (row: any): CardBillingDocument => {
    const card = row.card;
    const team = row.team;
    const issuedToWorker = row.issuedToWorker;

    const fallbackTeamId = row.assignedTeamId ? String(row.assignedTeamId) : undefined;
    const fallbackTeamName = row.assignedTeamName ? String(row.assignedTeamName) : undefined;

    const lineItems = safeJsonParse<CardBillingCostItem[]>(row.lineItems, []);
    const statementAttachmentPaths = safeJsonParse<string[]>(row.statementAttachmentPaths, []).filter((p) => typeof p === 'string' && p.trim().length > 0);
    const totals = computeTotals(lineItems);

    const issuedToType = parseIssuedToType(row.issuedToType);
    const issuedToWorkerNameRaw = row.issuedToWorkerName ? String(row.issuedToWorkerName) : issuedToWorker?.name ? String(issuedToWorker.name) : undefined;

    return {
        id: String(row.id),
        yearMonth: String(row.yearMonth),
        cardId: card?.id ? String(card.id) : '',
        cardLabel: row.cardLabel ? String(row.cardLabel) : `${safeString(card?.name)} (${safeString(card?.last4)})`.trim(),

        assignedTeamId: row.assignedTeamId ? String(row.assignedTeamId) : undefined,
        assignedTeamName: row.assignedTeamName ? String(row.assignedTeamName) : undefined,

        teamId: team?.id ? String(team.id) : fallbackTeamId,
        teamName: row.teamName ? String(row.teamName) : team?.name ? String(team.name) : fallbackTeamName,

        issuedToType,
        issuedToWorkerId: issuedToWorker?.id ? String(issuedToWorker.id) : undefined,
        issuedToWorkerName: issuedToType === 'team'
            ? (issuedToWorkerNameRaw && issuedToWorkerNameRaw.trim() ? issuedToWorkerNameRaw : (row.teamName ? String(row.teamName) : team?.name ? String(team.name) : fallbackTeamName))
            : issuedToWorkerNameRaw,

        variableCost: row.variableCost == null ? totals.variableCost : Number(row.variableCost),
        totalAmount: row.totalAmount == null ? totals.totalAmount : Number(row.totalAmount),

        status: parseBillingStatus(row.status),
        lineItems,
        statementAttachmentPaths,
        memo: row.memo ? String(row.memo) : undefined,

        createdAt: toTimestamp(row.createdAt),
        updatedAt: toTimestamp(row.updatedAt),
        confirmedAt: toTimestamp(row.confirmedAt)
    };
};

export const cardBillingService = {
    buildBillingDocumentId: (params: {
        cardId: string;
        teamId: string;
        issuedToType: CardBillingIssuedToType;
        workerId?: string;
        yearMonth: string;
    }): string => {
        const workerPart = params.workerId ? params.workerId : 'none';
        return `${params.cardId}_${params.teamId}_${params.issuedToType}_${workerPart}_${params.yearMonth}`;
    },

    generateBilling: async (card: Card, yearMonth: string): Promise<CardBillingDocument> => {
        const transactions = await cardService.getTransactionsByCard(card.id, yearMonth);

        const lineItems: CardBillingCostItem[] = transactions.map((tx) => ({
            id: tx.id,
            label: `${tx.merchant || 'Unknown'} - ${tx.date}`,
            amount: tx.amount,
            type: 'VARIABLE',
            category: tx.category
        }));

        const totals = computeTotals(lineItems);

        const assignedTeamId = card.currentAssigneeType === 'TEAM' ? card.currentAssigneeId : undefined;
        const assignedTeamName = card.currentAssigneeType === 'TEAM' ? card.currentAssigneeName : undefined;

        const issuedToType: CardBillingIssuedToType | undefined =
            card.currentAssigneeType === 'TEAM'
                ? 'team'
                : card.currentAssigneeType === 'WORKER'
                    ? 'worker'
                    : undefined;

        const billingId = `${yearMonth}_${card.id}`;

        return {
            id: billingId,
            yearMonth,
            cardId: card.id,
            cardLabel: `${card.name} (${card.last4})`,

            assignedTeamId,
            assignedTeamName,

            teamId: assignedTeamId,
            teamName: assignedTeamName,
            issuedToType,
            issuedToWorkerId: issuedToType === 'worker' ? (card.currentAssigneeId ?? undefined) : undefined,
            issuedToWorkerName: issuedToType === 'team'
                ? (assignedTeamName ?? undefined)
                : issuedToType === 'worker'
                    ? (card.currentAssigneeName ?? undefined)
                    : undefined,

            variableCost: totals.variableCost,
            totalAmount: totals.totalAmount,
            status: 'DRAFT',
            lineItems,
            statementAttachmentPaths: [],

            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        };
    },

    saveBilling: async (billing: CardBillingDocument): Promise<void> => {
        const cardUuid = await resolveCardUuid(billing.cardId);
        if (!cardUuid) throw new Error('Card not found');

        const teamUuid = await resolveTeamUuid(billing.teamId);
        const issuedToWorkerUuid = await resolveWorkerUuid(billing.issuedToWorkerId);

        const canonicalId =
            teamUuid && billing.issuedToType
                ? cardBillingService.buildBillingDocumentId({
                    cardId: cardUuid,
                    teamId: teamUuid,
                    issuedToType: billing.issuedToType,
                    workerId: issuedToWorkerUuid ?? undefined,
                    yearMonth: billing.yearMonth
                })
                : billing.id;

        const totals = computeTotals(billing.lineItems ?? []);

        const normalizedAttachmentPaths = (billing.statementAttachmentPaths ?? []).filter((p) => typeof p === 'string' && p.trim().length > 0);
        const statementAttachmentPathsJson = normalizedAttachmentPaths.length > 0 ? JSON.stringify(normalizedAttachmentPaths) : null;

        const vars: CreateCardBillingDocumentVariables = {
            id: canonicalId,
            yearMonth: billing.yearMonth,
            cardId: cardUuid,
            cardLabel: billing.cardLabel ?? null,
            assignedTeamId: billing.assignedTeamId ?? null,
            assignedTeamName: billing.assignedTeamName ?? null,
            teamId: teamUuid,
            teamName: billing.teamName ?? null,
            issuedToType: billing.issuedToType ?? null,
            issuedToWorkerId: issuedToWorkerUuid,
            issuedToWorkerName: billing.issuedToWorkerName ?? null,
            variableCost: totals.variableCost,
            totalAmount: totals.totalAmount,
            status: billing.status,
            lineItems: JSON.stringify(normalizeLineItems(billing.lineItems ?? [])),
            statementAttachmentPaths: statementAttachmentPathsJson,
            memo: billing.memo ?? null,
            confirmedAt: billing.confirmedAt ? billing.confirmedAt.toDate().toISOString() : null
        };

        try {
            await createCardBillingDocument(dc, vars);
        } catch {
            const updateVars: UpdateCardBillingDocumentVariables = {
                id: canonicalId,
                yearMonth: vars.yearMonth,
                cardLabel: vars.cardLabel ?? null,
                assignedTeamId: vars.assignedTeamId ?? null,
                assignedTeamName: vars.assignedTeamName ?? null,
                teamId: vars.teamId ?? null,
                teamName: vars.teamName ?? null,
                issuedToType: vars.issuedToType ?? null,
                issuedToWorkerId: vars.issuedToWorkerId ?? null,
                issuedToWorkerName: vars.issuedToWorkerName ?? null,
                variableCost: vars.variableCost ?? null,
                totalAmount: vars.totalAmount ?? null,
                status: vars.status ?? null,
                lineItems: vars.lineItems ?? null,
                statementAttachmentPaths: vars.statementAttachmentPaths ?? null,
                memo: vars.memo ?? null,
                confirmedAt: vars.confirmedAt ?? null
            };
            await updateCardBillingDocument(dc, updateVars);
        }
    },

    deleteBilling: async (id: string): Promise<void> => {
        const vars: DeleteCardBillingDocumentVariables = { id };
        await deleteCardBillingDocument(dc, vars);
    },

    getBillingsByMonth: async (yearMonth: string): Promise<CardBillingDocument[]> => {
        const res = await listCardBillingDocuments(dc);
        const data = unwrapQuery<ListCardBillingDocumentsData>(res);
        const rows = data?.cardBillingDocuments ?? [];

        return rows
            .filter((r: any) => String(r.yearMonth ?? '') === String(yearMonth))
            .map(mapBillingDocument);
    },

    generateMonthlyBillings: async (yearMonth: string): Promise<CardBillingDocument[]> => {
        const cards = await cardService.getCards();
        const promises = cards.map((c) => cardBillingService.generateBilling(c, yearMonth));
        return Promise.all(promises);
    }
};
