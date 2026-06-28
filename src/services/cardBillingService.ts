import { cardFirestoreService } from './cardFirestoreService';
import { CardBillingDocument, CardBillingIssuedToType } from '../types/cardBilling';
import { Card, CardAssignmentRecord, CardBillingTargetRecord, CardBillingTargetType, CardTransaction, cardService } from './cardService';
import { Timestamp } from '../types/timestamp';
import { manpowerService } from './manpowerService';
import { DEFAULT_SUPPORT_BILLING_START_DATE, isSupportBillingMonthEnabled, maxIsoDate, minIsoDate } from '../utils/supportBillingPeriod';

const normalizeKey = (value: unknown): string => String(value ?? '').trim();

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

const isBillingTargetActiveOnDate = (target: CardBillingTargetRecord, date: Date): boolean => {
    const start = parseYmdDate(target.startDate);
    if (!start || start.getTime() > date.getTime()) return false;

    const end = target.endDate ? parseYmdDate(target.endDate) : null;
    if (end && end.getTime() < date.getTime()) return false;
    return true;
};

const findBillingTargetForDate = (targets: CardBillingTargetRecord[], date: Date): CardBillingTargetRecord | null => {
    return targets
        .filter((target) => isBillingTargetActiveOnDate(target, date))
        .sort((a, b) => {
            const startDiff = String(b.startDate ?? '').localeCompare(String(a.startDate ?? ''));
            if (startDiff !== 0) return startDiff;
            return String(b.id ?? '').localeCompare(String(a.id ?? ''));
        })[0] ?? null;
};

const resolveBillingTargetForDate = (
    card: Card,
    date: Date,
    targets: CardBillingTargetRecord[],
    assignment?: CardAssignmentRecord | null
): { targetType?: CardBillingTargetType | CardAssignmentRecord['assigneeType']; targetId?: string; targetName?: string } => {
    const target = findBillingTargetForDate(targets, date);
    if (target) {
        return {
            targetType: target.targetType,
            targetId: normalizeKey(target.targetId),
            targetName: normalizeKey(target.targetName)
        };
    }

    if (card.billingTargetType && (card.billingTargetId || card.billingTargetName)) {
        return {
            targetType: card.billingTargetType,
            targetId: normalizeKey(card.billingTargetId) || normalizeKey(card.billingTargetName),
            targetName: normalizeKey(card.billingTargetName)
        };
    }

    if (assignment) {
        return {
            targetType: assignment.assigneeType,
            targetId: normalizeKey(assignment.assigneeId),
            targetName: normalizeKey(assignment.assigneeName)
        };
    }

    return {
        targetType: card.currentAssigneeType,
        targetId: normalizeKey(card.currentAssigneeId),
        targetName: normalizeKey(card.currentAssigneeName)
    };
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
        const [transactions, billingTargets] = await Promise.all([
            cardService.getTransactionsByCard(card.id, yearMonth),
            cardService.listAllCardBillingTargets(card.id).catch(() => [] as CardBillingTargetRecord[])
        ]);

        const lineItems = transactions.map((tx) => ({
            id: tx.id,
            label: `${tx.merchant || 'Unknown'} - ${tx.date}`,
            amount: tx.amount,
            type: 'VARIABLE' as const,
            category: tx.category,
            sourceType: 'card_ledger' as const,
            sourceLedgerRowId: tx.id,
            sourceStartDate: tx.date,
            sourceEndDate: tx.date
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

        const monthStart = parseYmdDate(`${yearMonth}-01`) ?? new Date();
        const resolvedTarget = resolveBillingTargetForDate(card, monthStart, billingTargets);
        const targetType = resolvedTarget.targetType;
        const targetId = resolvedTarget.targetId;
        const targetName = resolvedTarget.targetName;
        const targetWorker = targetType === 'WORKER' ? findWorker(targetId) : undefined;

        const billingTeamId = targetType === 'TEAM' || targetType === 'OFFICE'
            ? (targetId ?? undefined)
            : (targetWorker?.teamId || assignedTeamId);
        const billingTeamName = targetType === 'TEAM' || targetType === 'OFFICE'
            ? (targetName ?? undefined)
            : (targetWorker?.teamName || assignedTeamName);
        const issuedToType: CardBillingIssuedToType | undefined =
            targetType === 'WORKER' || targetType === 'OFFICE_STAFF'
                ? 'worker'
                : billingTeamId
                    ? 'team'
                    : undefined;

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
            issuedToWorkerId: issuedToType === 'worker' ? targetId : undefined,
            issuedToWorkerName: issuedToType === 'worker'
                ? (targetName ?? targetWorker?.name ?? undefined)
                : billingTeamName,
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
        const [transactions, assignments, billingTargets, workers] = await Promise.all([
            cardService.getTransactionsByCard(card.id, yearMonth),
            cardService.getAssignmentHistory(card.id).catch(() => [] as CardAssignmentRecord[]),
            cardService.listAllCardBillingTargets(card.id).catch(() => [] as CardBillingTargetRecord[]),
            manpowerService.getWorkers().catch(() => [])
        ]);

        const findWorker = (workerId?: string) => {
            if (!workerId) return undefined;
            return workers.find((w) => (
                String(w.id ?? '') === String(workerId) ||
                String(w.legacyId ?? '') === String(workerId)
            ));
        };

        const firstBillingTargetStart = minIsoDate(...billingTargets.map((target) => target.startDate));
        const billingStartDate = maxIsoDate(DEFAULT_SUPPORT_BILLING_START_DATE, firstBillingTargetStart);
        if (!isSupportBillingMonthEnabled(yearMonth, billingStartDate)) return [];

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

            const txDate = parseYmdDate(tx.date) ?? new Date();
            const resolvedTarget = resolveBillingTargetForDate(card, txDate, billingTargets, assignment);
            const targetType = resolvedTarget.targetType;
            const targetId = resolvedTarget.targetId;
            const targetName = resolvedTarget.targetName;
            const targetWorker = targetType === 'WORKER' ? findWorker(targetId) : undefined;

            const billingTeamId = targetType === 'TEAM' || targetType === 'OFFICE'
                ? targetId
                : (targetWorker?.teamId || assignedTeamId);
            const billingTeamName = targetType === 'TEAM' || targetType === 'OFFICE'
                ? targetName
                : (targetWorker?.teamName || assignedTeamName);
            const issuedToType: CardBillingIssuedToType | undefined =
                targetType === 'WORKER' || targetType === 'OFFICE_STAFF'
                    ? 'worker'
                    : billingTeamId
                        ? 'team'
                        : undefined;

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
                category: tx.category,
                sourceType: 'card_ledger' as const,
                sourceLedgerRowId: tx.id,
                sourceSegmentId: assignment.id,
                sourceStartDate: tx.date,
                sourceEndDate: tx.date
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
                issuedToWorkerName: issuedToType === 'worker'
                    ? (targetName ?? targetWorker?.name ?? undefined)
                    : billingTeamName,
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
            const assignment = findAssignmentForDate(assignments, txDate) ?? (
                card.currentAssigneeId && card.currentAssigneeType && card.currentAssigneeName
                    ? {
                        id: `snapshot-${card.id}`,
                        cardId: card.id,
                        cardLabel: `${card.name} (${card.last4})`,
                        assigneeId: card.currentAssigneeId,
                        assigneeType: card.currentAssigneeType,
                        assigneeName: card.currentAssigneeName,
                        startDate: `${yearMonth}-01`
                    }
                    : null
            );
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
