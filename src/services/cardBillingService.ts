import { cardFirestoreService } from './cardFirestoreService';
import { CardBillingDocument, CardBillingIssuedToType } from '../types/cardBilling';
import { Card, CardAssignmentRecord, CardTransaction, cardService } from './cardService';
import { Timestamp } from '../types/timestamp';
import { manpowerService } from './manpowerService';

const parseYmdDate = (value?: string): Date | null => {
    const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? '').trim());
    if (!matched) return null;
    const year = Number(matched[1]);
    const month = Number(matched[2]);
    const day = Number(matched[3]);
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
    return date;
};

const isAssignmentActiveOnDate = (assignment: CardAssignmentRecord, date: Date): boolean => {
    const start = parseYmdDate(assignment.startDate);
    if (!start || start.getTime() > date.getTime()) return false;

    const end = assignment.endDate ? parseYmdDate(assignment.endDate) : null;
    if (end && end.getTime() < date.getTime()) return false;
    return true;
};

const findAssignmentForDate = (assignments: CardAssignmentRecord[], date: Date): CardAssignmentRecord | null => {
    return assignments
        .filter((assignment) => isAssignmentActiveOnDate(assignment, date))
        .sort((a, b) => String(b.startDate ?? '').localeCompare(String(a.startDate ?? '')))
        [0] ?? null;
};

/**
 * CardBillingService - Firestore 통합 버전
 * 모든 요청을 cardFirestoreService로 위임하거나 Firestore 데이터를 기반으로 처리합니다.
 */
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

        const lineItems = transactions.map((tx) => ({
            id: tx.id,
            label: `${tx.merchant || 'Unknown'} - ${tx.date}`,
            amount: tx.amount,
            type: 'VARIABLE' as const,
            category: tx.category
        }));

        const variableCost = lineItems.reduce((acc, it) => acc + (it.amount || 0), 0);

        let assignedTeamId = card.currentAssigneeType === 'TEAM' ? card.currentAssigneeId : undefined;
        let assignedTeamName = card.currentAssigneeType === 'TEAM' ? card.currentAssigneeName : undefined;
        let workers: Awaited<ReturnType<typeof manpowerService.getWorkers>> = [];

        try {
            workers = await manpowerService.getWorkers();
        } catch (error) {
            console.warn('Failed to resolve card worker data for billing:', error);
        }

        const findWorker = (workerId?: string) => {
            if (!workerId) return undefined;
            return workers.find((w) => (
                String(w.id ?? '') === String(workerId) ||
                String(w.legacyId ?? '') === String(workerId)
            ));
        };

        if (card.currentAssigneeType === 'WORKER' && card.currentAssigneeId) {
            try {
                const worker = findWorker(card.currentAssigneeId);
                assignedTeamId = worker?.teamId || assignedTeamId;
                assignedTeamName = worker?.teamName || assignedTeamName;
            } catch (error) {
                console.warn('Failed to resolve card assignee team for billing:', error);
            }
        }

        const hasExplicitBillingTarget = Boolean(card.billingTargetType && card.billingTargetId);
        const targetType = hasExplicitBillingTarget ? card.billingTargetType : card.currentAssigneeType;
        const targetId = (hasExplicitBillingTarget ? card.billingTargetId : card.currentAssigneeId) ?? undefined;
        const targetName = (hasExplicitBillingTarget ? card.billingTargetName : card.currentAssigneeName) ?? undefined;
        const targetWorker = targetType === 'WORKER' ? findWorker(targetId) : undefined;

        const issuedToType: CardBillingIssuedToType | undefined =
            targetType === 'TEAM'
                ? 'team'
                : targetType === 'WORKER'
                    ? 'worker'
                    : undefined;
        const billingTeamId = targetType === 'TEAM'
            ? (targetId ?? undefined)
            : (targetWorker?.teamId || assignedTeamId);
        const billingTeamName = targetType === 'TEAM'
            ? (targetName ?? undefined)
            : (targetWorker?.teamName || assignedTeamName);

        const billingId = cardBillingService.buildBillingDocumentId({
            cardId: card.id,
            teamId: billingTeamId || 'unassigned',
            issuedToType: issuedToType || 'team',
            workerId: issuedToType === 'worker' ? targetId : undefined,
            yearMonth
        });

        return {
            id: billingId,
            yearMonth,
            cardId: card.id,
            cardLabel: `${card.name} (${card.last4})`,
            assignedTeamId,
            assignedTeamName,
            teamId: billingTeamId,
            teamName: billingTeamName,
            issuedToType,
            issuedToWorkerId: issuedToType === 'worker' ? (targetId ?? undefined) : undefined,
            issuedToWorkerName: issuedToType === 'team'
                ? (billingTeamName ?? undefined)
                : issuedToType === 'worker'
                    ? (targetName ?? targetWorker?.name ?? undefined)
                    : undefined,
            variableCost,
            totalAmount: variableCost,
            status: 'DRAFT',
            lineItems,
            statementAttachmentPaths: [],
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        };
    },

    generateAssignmentBillings: async (card: Card, yearMonth: string): Promise<CardBillingDocument[]> => {
        const [transactions, assignments, workers] = await Promise.all([
            cardService.getTransactionsByCard(card.id, yearMonth),
            cardService.getAssignmentHistory(card.id).catch(() => [] as CardAssignmentRecord[]),
            manpowerService.getWorkers().catch(() => [])
        ]);

        const findWorker = (workerId?: string) => {
            if (!workerId) return undefined;
            return workers.find((w) => (
                String(w.id ?? '') === String(workerId) ||
                String(w.legacyId ?? '') === String(workerId)
            ));
        };

        const grouped = new Map<string, CardBillingDocument>();

        const addTransactionToGroup = (tx: CardTransaction, assignment: CardAssignmentRecord) => {
            let assignedTeamId: string | undefined;
            let assignedTeamName: string | undefined;

            if (assignment.assigneeType === 'TEAM') {
                assignedTeamId = assignment.assigneeId;
                assignedTeamName = assignment.assigneeName;
            } else {
                const assignedWorker = findWorker(assignment.assigneeId);
                assignedTeamId = assignedWorker?.teamId;
                assignedTeamName = assignedWorker?.teamName;
            }

            const hasExplicitBillingTarget = Boolean(card.billingTargetType && card.billingTargetId);
            const targetType = hasExplicitBillingTarget ? card.billingTargetType : assignment.assigneeType;
            const targetId = (hasExplicitBillingTarget ? card.billingTargetId : assignment.assigneeId) ?? undefined;
            const targetName = (hasExplicitBillingTarget ? card.billingTargetName : assignment.assigneeName) ?? undefined;
            const targetWorker = targetType === 'WORKER' ? findWorker(targetId) : undefined;

            const issuedToType: CardBillingIssuedToType | undefined =
                targetType === 'TEAM'
                    ? 'team'
                    : targetType === 'WORKER'
                        ? 'worker'
                        : undefined;
            const billingTeamId = targetType === 'TEAM'
                ? targetId
                : (targetWorker?.teamId || assignedTeamId);
            const billingTeamName = targetType === 'TEAM'
                ? targetName
                : (targetWorker?.teamName || assignedTeamName);

            if (!issuedToType || !billingTeamId) return;

            const billingId = cardBillingService.buildBillingDocumentId({
                cardId: card.id,
                teamId: billingTeamId,
                issuedToType,
                workerId: issuedToType === 'worker' ? targetId : undefined,
                yearMonth
            });

            const existing = grouped.get(billingId);
            const lineItem = {
                id: tx.id,
                label: `${tx.merchant || 'Unknown'} - ${tx.date}`,
                amount: tx.amount,
                type: 'VARIABLE' as const,
                category: tx.category
            };

            if (existing) {
                existing.lineItems.push(lineItem);
                existing.variableCost += tx.amount;
                existing.totalAmount += tx.amount;
                return;
            }

            grouped.set(billingId, {
                id: billingId,
                yearMonth,
                cardId: card.id,
                cardLabel: `${card.name} (${card.last4})`,
                assignedTeamId,
                assignedTeamName,
                teamId: billingTeamId,
                teamName: billingTeamName,
                issuedToType,
                issuedToWorkerId: issuedToType === 'worker' ? targetId : undefined,
                issuedToWorkerName: issuedToType === 'team'
                    ? billingTeamName
                    : (targetName ?? targetWorker?.name ?? undefined),
                variableCost: tx.amount,
                totalAmount: tx.amount,
                status: 'DRAFT',
                lineItems: [lineItem],
                statementAttachmentPaths: [],
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            });
        };

        transactions.forEach((tx) => {
            const txDate = parseYmdDate(tx.date);
            if (!txDate) return;
            const assignment = findAssignmentForDate(assignments, txDate);
            if (!assignment) return;
            addTransactionToGroup(tx, assignment);
        });

        return Array.from(grouped.values());
    },

    saveBilling: async (billing: CardBillingDocument): Promise<void> => {
        const beforeBilling = await cardFirestoreService.getBillingById(billing.id).catch(() => null);
        await cardFirestoreService.saveBilling(billing);
        try {
            const { cardBillingLogService } = await import('./cardBillingLogService');
            await cardBillingLogService.createLog({
                action: beforeBilling ? 'updated' : 'created',
                before: beforeBilling,
                after: {
                    ...billing,
                    lineItems: billing.lineItems ?? [],
                    statementAttachmentPaths: billing.statementAttachmentPaths ?? [],
                    updatedAt: Timestamp.now()
                },
                source: 'cardBillingService.saveBilling'
            });
        } catch (logError) {
            console.warn('[cardBillingService] card billing log failed:', logError);
        }
    },

    deleteBilling: async (id: string): Promise<void> => {
        const beforeBilling = await cardFirestoreService.getBillingById(id).catch(() => null);
        await cardFirestoreService.deleteBilling(id);
        if (beforeBilling) {
            try {
                const { cardBillingLogService } = await import('./cardBillingLogService');
                await cardBillingLogService.createLog({
                    action: 'deleted',
                    before: beforeBilling,
                    after: null,
                    source: 'cardBillingService.deleteBilling'
                });
            } catch (logError) {
                console.warn('[cardBillingService] card billing delete log failed:', logError);
            }
        }
    },

    getBillingById: async (id: string): Promise<CardBillingDocument | null> => {
        return cardFirestoreService.getBillingById(id);
    },

    getBillingsByMonth: async (yearMonth: string): Promise<CardBillingDocument[]> => {
        return cardFirestoreService.getBillingsByMonth(yearMonth);
    },

    generateMonthlyBillings: async (yearMonth: string): Promise<CardBillingDocument[]> => {
        const cards = await cardService.getCards();
        const groups = await Promise.all(cards.map((c) => cardBillingService.generateAssignmentBillings(c, yearMonth)));
        return groups.reduce<CardBillingDocument[]>((acc, list) => acc.concat(list), []);
    }
};
