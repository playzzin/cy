import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    deleteField,
    query,
    where,
    orderBy,
    writeBatch,
    serverTimestamp,
    runTransaction,
    Timestamp as FirestoreTimestamp
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import {
    Card,
    CardAssignmentRecord,
    CardTransaction,
    CardAssigneeType,
    CardBillingTargetRecord,
    CardStatus
} from '../types/card';
import { CardBillingDocument } from '../types/cardBilling';
import type { CreateSupportCancellationLogInput } from '../types/supportCancellationLog';
import {
    CardSchema,
    CardAssignmentRecordSchema,
    CardTransactionSchema,
    CardBillingDocumentSchema,
    CardBillingTargetRecordSchema
} from '../types/zod/cardSchema';
import {
    listCards,
    listCardAssignments,
    listCardTransactions,
    listCardBillingDocuments
} from './firestoreCrudCompat';
import {
    assertCardCanBeAssignedOrBilled,
    assertCardCanBeRestored,
} from './cardLifecyclePolicy';
import {
    getConfirmedTeamSettlementConfigIdForCardBilling,
    isConfirmedTeamSettlementConfigData
} from './cardBillingSettlementGuard';

const CARDS_COLLECTION = 'cards';
const ASSIGNMENTS_COLLECTION = 'cardAssignments';
const BILLING_TARGETS_COLLECTION = 'cardBillingTargets';
const TRANSACTIONS_COLLECTION = 'cardTransactions';
const BILLINGS_COLLECTION = 'cardBillings';
const SYSTEM_CONFIGS_COLLECTION = 'system_configs';
const SUPPORT_CANCELLATION_LOGS_COLLECTION = 'support_cancellation_logs';

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
    if (!value || typeof value !== 'object') return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
};

const cleanForFirestore = (value: unknown): unknown => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (value instanceof Date || value instanceof FirestoreTimestamp) return value;
    if (typeof (value as { toDate?: unknown })?.toDate === 'function') {
        return FirestoreTimestamp.fromDate((value as { toDate: () => Date }).toDate());
    }
    if (Array.isArray(value)) {
        return value.map((child) => {
            const cleaned = cleanForFirestore(child);
            return cleaned === undefined ? null : cleaned;
        });
    }
    if (isPlainObject(value)) {
        return Object.fromEntries(
            Object.entries(value)
                .map(([key, child]) => [key, cleanForFirestore(child)] as const)
                .filter(([, child]) => child !== undefined)
        );
    }
    return value;
};

const getDayBefore = (dateText: string): string => {
    const [year, month, day] = dateText.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    if (Number.isNaN(date.getTime())) return dateText;
    date.setDate(date.getDate() - 1);
    const outputYear = date.getFullYear();
    const outputMonth = String(date.getMonth() + 1).padStart(2, '0');
    const outputDay = String(date.getDate()).padStart(2, '0');
    return `${outputYear}-${outputMonth}-${outputDay}`;
};

const parseYmdDate = (value?: unknown): Date | null => {
    const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? '').trim());
    if (!matched) return null;
    const year = Number(matched[1]);
    const month = Number(matched[2]);
    const day = Number(matched[3]);
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
    return date;
};

const shouldDeleteZeroLengthAssignment = (assignment: Record<string, unknown>, endDateText: string): boolean => {
    const start = parseYmdDate(assignment.startDate);
    const end = parseYmdDate(endDateText);
    return Boolean(start && end && end.getTime() < start.getTime());
};

const CARD_LIFECYCLE_PREFLIGHT_CHANGED = 'card-lifecycle-preflight-changed';
const CARD_ASSIGNMENT_PREFLIGHT_CHANGED = 'card-assignment-preflight-changed';
const MAX_CARD_LIFECYCLE_LINKS = 450;

const timestampFingerprint = (value: unknown): string => {
    const timestamp = value as { seconds?: unknown; nanoseconds?: unknown; toMillis?: () => number } | null | undefined;
    if (typeof timestamp?.toMillis === 'function') return String(timestamp.toMillis());
    if (timestamp?.seconds !== undefined) return `${String(timestamp.seconds)}:${String(timestamp.nanoseconds ?? 0)}`;
    return String(value ?? '');
};

const hasOpenLink = (value: Record<string, unknown>): boolean => !String(value.endDate ?? '').trim();

const hasCardAssignmentOrBillingSnapshot = (card: Record<string, unknown>): boolean => Boolean(
    card.currentAssigneeId ||
    card.currentAssigneeName ||
    card.currentAssigneeType ||
    card.billingTargetId ||
    card.billingTargetName ||
    card.billingTargetType ||
    card.billingTargetStartDate ||
    card.billingTargetEndDate
);

export interface CardLifecycleTransitionParams {
    cardId: string;
    effectiveDate: string;
    targetStatus: Extract<CardStatus, 'SUSPENDED' | 'CLOSED' | 'AVAILABLE'>;
    operationId: string;
    auditLog: CreateSupportCancellationLogInput;
}

export interface CardLifecycleTransitionResult {
    changed: boolean;
    statusBefore: CardStatus;
    statusAfter: Extract<CardStatus, 'SUSPENDED' | 'CLOSED' | 'AVAILABLE'>;
    operationId: string;
    closedAssignmentCount: number;
    closedBillingTargetCount: number;
}

export const cardFirestoreService = {
    // --- Cards ---
    async getCards(): Promise<Card[]> {
        const q = query(collection(db, CARDS_COLLECTION), orderBy('name', 'asc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Card));
    },

    async getCard(id: string): Promise<Card | null> {
        const docRef = doc(db, CARDS_COLLECTION, id);
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? ({ id: docSnap.id, ...docSnap.data() } as Card) : null;
    },

    async createCard(data: Omit<Card, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
        const validated = CardSchema.parse(data);
        const docRef = doc(collection(db, CARDS_COLLECTION));
        await setDoc(docRef, {
            ...validated,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        return docRef.id;
    },

    async updateCard(id: string, data: Partial<Card>): Promise<void> {
        const docRef = doc(db, CARDS_COLLECTION, id);
        await updateDoc(docRef, {
            ...data,
            updatedAt: serverTimestamp(),
        });
    },

    async transitionCardLifecycle(params: CardLifecycleTransitionParams): Promise<CardLifecycleTransitionResult> {
        if (!params.cardId || !params.operationId || !parseYmdDate(params.effectiveDate)) {
            throw new Error('invalid-card-lifecycle-transition');
        }

        const cardRef = doc(db, CARDS_COLLECTION, params.cardId);
        const lifecycleCreatedAtIso = new Date().toISOString();
        for (let attempt = 0; attempt < 3; attempt += 1) {
            // Read the card first. Any concurrent assignment/billing command also updates
            // this document, so a later fingerprint mismatch forces a fresh link query.
            const preflightCard = await getDoc(cardRef);
            if (!preflightCard.exists()) throw new Error('card-not-found');
            const preflightUpdatedAt = timestampFingerprint(preflightCard.data().updatedAt);

            const [assignmentQuerySnapshot, billingQuerySnapshot] = await Promise.all([
                getDocs(query(collection(db, ASSIGNMENTS_COLLECTION), where('cardId', '==', params.cardId))),
                getDocs(query(collection(db, BILLING_TARGETS_COLLECTION), where('cardId', '==', params.cardId))),
            ]);
            const assignmentRefs = assignmentQuerySnapshot.docs
                .filter((item) => hasOpenLink(item.data() as Record<string, unknown>))
                .map((item) => item.ref);
            const billingRefs = billingQuerySnapshot.docs
                .filter((item) => hasOpenLink(item.data() as Record<string, unknown>))
                .map((item) => item.ref);
            if (assignmentRefs.length + billingRefs.length > MAX_CARD_LIFECYCLE_LINKS) {
                throw new Error('card-lifecycle-link-limit-exceeded');
            }

            try {
                return await runTransaction(db, async (transaction) => {
                    const cardPromise = transaction.get(cardRef);
                    const assignmentPromises = assignmentRefs.map((reference) => transaction.get(reference));
                    const billingPromises = billingRefs.map((reference) => transaction.get(reference));
                    const [cardSnapshot, assignmentSnapshots, billingSnapshots] = await Promise.all([
                        cardPromise,
                        Promise.all(assignmentPromises),
                        Promise.all(billingPromises),
                    ]);
                    if (!cardSnapshot.exists()) throw new Error('card-not-found');

                    const card = cardSnapshot.data() as Record<string, unknown>;
                    const statusBefore = card.status as CardStatus;
                    if (card.lastLifecycleOperationId === params.operationId) {
                        return {
                            changed: false,
                            statusBefore,
                            statusAfter: params.targetStatus,
                            operationId: params.operationId,
                            closedAssignmentCount: 0,
                            closedBillingTargetCount: 0,
                        };
                    }
                    if (timestampFingerprint(card.updatedAt) !== preflightUpdatedAt) {
                        throw new Error(CARD_LIFECYCLE_PREFLIGHT_CHANGED);
                    }

                    const openAssignments = assignmentSnapshots.filter((snapshot) => (
                        snapshot.exists() && hasOpenLink(snapshot.data() as Record<string, unknown>)
                    ));
                    const openBillingTargets = billingSnapshots.filter((snapshot) => (
                        snapshot.exists() && hasOpenLink(snapshot.data() as Record<string, unknown>)
                    ));
                    const latestOpenAssignment = openAssignments
                        .map((snapshot) => snapshot.data() as Record<string, unknown>)
                        .sort((left, right) => String(right.startDate ?? '').localeCompare(String(left.startDate ?? '')))[0];
                    const latestOpenBillingTarget = openBillingTargets
                        .map((snapshot) => snapshot.data() as Record<string, unknown>)
                        .sort((left, right) => String(right.startDate ?? '').localeCompare(String(left.startDate ?? '')))[0];
                    const hasStaleSnapshot = hasCardAssignmentOrBillingSnapshot(card);

                    if (params.targetStatus === 'AVAILABLE') {
                        if (statusBefore === 'AVAILABLE') {
                            return {
                                changed: false,
                                statusBefore,
                                statusAfter: params.targetStatus,
                                operationId: params.operationId,
                                closedAssignmentCount: 0,
                                closedBillingTargetCount: 0,
                            };
                        }
                        assertCardCanBeRestored(statusBefore);
                    } else {
                        if ((statusBefore === 'SUSPENDED' || statusBefore === 'CLOSED') && statusBefore !== params.targetStatus) {
                            throw new Error('inactive-card-status-transition-blocked');
                        }
                        if (statusBefore === params.targetStatus && openAssignments.length === 0 && openBillingTargets.length === 0 && !hasStaleSnapshot) {
                            return {
                                changed: false,
                                statusBefore,
                                statusAfter: params.targetStatus,
                                operationId: params.operationId,
                                closedAssignmentCount: 0,
                                closedBillingTargetCount: 0,
                            };
                        }
                    }

                    openAssignments.forEach((snapshot) => {
                        const assignment = snapshot.data() as Record<string, unknown>;
                        if (shouldDeleteZeroLengthAssignment(assignment, params.effectiveDate)) {
                            transaction.delete(snapshot.ref);
                        } else {
                            transaction.update(snapshot.ref, {
                                endDate: params.effectiveDate,
                                updatedAt: serverTimestamp(),
                            });
                        }
                    });
                    openBillingTargets.forEach((snapshot) => {
                        const target = snapshot.data() as Record<string, unknown>;
                        if (shouldDeleteZeroLengthAssignment(target, params.effectiveDate)) {
                            transaction.delete(snapshot.ref);
                        } else {
                            transaction.update(snapshot.ref, {
                                endDate: params.effectiveDate,
                                updatedAt: serverTimestamp(),
                            });
                        }
                    });

                    transaction.update(cardRef, {
                        status: params.targetStatus,
                        currentAssigneeId: null,
                        currentAssigneeType: null,
                        currentAssigneeName: null,
                        billingTargetId: null,
                        billingTargetType: null,
                        billingTargetName: null,
                        billingTargetStartDate: null,
                        billingTargetEndDate: null,
                        lastLifecycleOperationId: params.operationId,
                        lastLifecycleOperationType: params.targetStatus === 'AVAILABLE' ? 'RESTORE' : 'CANCEL',
                        lastLifecycleOperationAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                    });
                    const user = auth.currentUser;
                    const logId = params.operationId.split('/').join('_');
                    const canonicalCardName = String(card.name ?? '').trim();
                    const canonicalMaskedNumber = String(card.maskedNumber ?? '').trim();
                    const canonicalLast4 = String(card.last4 ?? '').trim();
                    const canonicalAssigneeName = String(
                        latestOpenAssignment?.assigneeName ?? card.currentAssigneeName ?? ''
                    ).trim();
                    const canonicalBillingTargetName = String(
                        latestOpenBillingTarget?.targetName ?? card.billingTargetName ?? ''
                    ).trim();
                    const canonicalSnapshot = {
                        ...(params.auditLog.snapshot ?? {}),
                        name: canonicalCardName,
                        issuer: card.issuer,
                        cardType: card.cardType,
                        maskedNumber: canonicalMaskedNumber,
                        last4: canonicalLast4,
                        expiry: card.expiry,
                        status: statusBefore,
                        assigneeName: canonicalAssigneeName || undefined,
                        billingTargetName: canonicalBillingTargetName || undefined,
                    };
                    transaction.set(
                        doc(db, SUPPORT_CANCELLATION_LOGS_COLLECTION, logId),
                        cleanForFirestore({
                            ...params.auditLog,
                            id: logId,
                            resourceType: 'card',
                            resourceId: params.cardId,
                            resourceLabel: canonicalCardName || canonicalMaskedNumber || canonicalLast4 || '카드',
                            processedDate: params.effectiveDate,
                            statusBefore,
                            statusAfter: params.targetStatus,
                            assigneeName: canonicalAssigneeName || undefined,
                            billingTargetName: canonicalBillingTargetName || undefined,
                            snapshot: canonicalSnapshot,
                            actor: user ? {
                                uid: user.uid,
                                name: user.displayName || user.email || '사용자',
                                email: user.email || null,
                            } : {
                                uid: 'system',
                                name: 'ERP 시스템',
                                email: null,
                            },
                            createdAt: serverTimestamp(),
                            createdAtIso: lifecycleCreatedAtIso,
                        }) as Record<string, unknown>
                    );

                    return {
                        changed: true,
                        statusBefore,
                        statusAfter: params.targetStatus,
                        operationId: params.operationId,
                        closedAssignmentCount: openAssignments.length,
                        closedBillingTargetCount: openBillingTargets.length,
                    };
                });
            } catch (error) {
                if (error instanceof Error && error.message === CARD_LIFECYCLE_PREFLIGHT_CHANGED && attempt < 2) {
                    continue;
                }
                throw error;
            }
        }
        throw new Error(CARD_LIFECYCLE_PREFLIGHT_CHANGED);
    },

    // --- Card Assignments ---
    async getAssignmentHistory(cardId: string): Promise<CardAssignmentRecord[]> {
        const q = query(
            collection(db, ASSIGNMENTS_COLLECTION),
            where('cardId', '==', cardId)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as CardAssignmentRecord))
            .sort((a, b) => String(b.startDate ?? '').localeCompare(String(a.startDate ?? '')));
    },

    async listAllCardAssignments(): Promise<CardAssignmentRecord[]> {
        const q = query(collection(db, ASSIGNMENTS_COLLECTION), orderBy('startDate', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CardAssignmentRecord));
    },

    async saveCardAssignment(data: Partial<CardAssignmentRecord> & { id: string }): Promise<void> {
        const { id, createdAt, updatedAt, ...payload } = data;
        const validated = CardAssignmentRecordSchema.parse(payload);
        const cardRef = doc(db, CARDS_COLLECTION, validated.cardId);
        const assignmentRef = doc(db, ASSIGNMENTS_COLLECTION, id);
        await runTransaction(db, async (transaction) => {
            const [cardSnapshot, assignmentSnapshot] = await Promise.all([
                transaction.get(cardRef),
                transaction.get(assignmentRef),
            ]);
            if (!cardSnapshot.exists()) throw new Error('card-not-found');
            if (!assignmentSnapshot.exists()) throw new Error('card-assignment-not-found');
            const persistedAssignment = assignmentSnapshot.data() as Record<string, unknown>;
            if (persistedAssignment.cardId !== validated.cardId) throw new Error('card-assignment-card-mismatch');
            if (!validated.endDate && !hasOpenLink(persistedAssignment)) {
                throw new Error('card-assignment-no-longer-active');
            }
            assertCardCanBeAssignedOrBilled(cardSnapshot.data().status as CardStatus);
            transaction.set(assignmentRef, {
                ...validated,
                ...(createdAt ? { createdAt } : {}),
                updatedAt: serverTimestamp(),
            }, { merge: true });
            transaction.update(cardRef, validated.endDate ? {
                updatedAt: serverTimestamp(),
            } : {
                status: 'ASSIGNED',
                currentAssigneeId: validated.assigneeId,
                currentAssigneeType: validated.assigneeType,
                currentAssigneeName: validated.assigneeName,
                updatedAt: serverTimestamp(),
            });
        });
    },

    async assignCard(params: {
        cardId: string;
        assigneeId: string;
        assigneeType: CardAssigneeType;
        assigneeName: string;
        startDate: string;
        cardLabel: string;
    }): Promise<void> {
        const previousEndDate = getDayBefore(params.startDate);
        const cardRef = doc(db, CARDS_COLLECTION, params.cardId);
        for (let attempt = 0; attempt < 3; attempt += 1) {
            const preflightCard = await getDoc(cardRef);
            if (!preflightCard.exists()) throw new Error('card-not-found');
            const preflightUpdatedAt = timestampFingerprint(preflightCard.data().updatedAt);
            const assignmentQuerySnapshot = await getDocs(query(
                collection(db, ASSIGNMENTS_COLLECTION),
                where('cardId', '==', params.cardId)
            ));
            const activeAssignmentRefs = assignmentQuerySnapshot.docs
                .filter((item) => hasOpenLink(item.data() as Record<string, unknown>))
                .map((item) => item.ref);
            if (activeAssignmentRefs.length > MAX_CARD_LIFECYCLE_LINKS) {
                throw new Error('card-assignment-link-limit-exceeded');
            }

            try {
                await runTransaction(db, async (transaction) => {
                    const [cardSnapshot, assignmentSnapshots] = await Promise.all([
                        transaction.get(cardRef),
                        Promise.all(activeAssignmentRefs.map((reference) => transaction.get(reference))),
                    ]);
                    if (!cardSnapshot.exists()) throw new Error('card-not-found');
                    if (timestampFingerprint(cardSnapshot.data().updatedAt) !== preflightUpdatedAt) {
                        throw new Error(CARD_ASSIGNMENT_PREFLIGHT_CHANGED);
                    }
                    assertCardCanBeAssignedOrBilled(cardSnapshot.data().status as CardStatus);

                    assignmentSnapshots
                        .filter((snapshot) => snapshot.exists() && hasOpenLink(snapshot.data() as Record<string, unknown>))
                        .forEach((assignmentSnapshot) => {
                            if (shouldDeleteZeroLengthAssignment(
                                assignmentSnapshot.data() as Record<string, unknown>,
                                previousEndDate
                            )) {
                                transaction.delete(assignmentSnapshot.ref);
                                return;
                            }
                            transaction.update(assignmentSnapshot.ref, {
                                endDate: previousEndDate,
                                updatedAt: serverTimestamp(),
                            });
                        });

                    transaction.update(cardRef, {
                        status: 'ASSIGNED',
                        currentAssigneeId: params.assigneeId,
                        currentAssigneeType: params.assigneeType,
                        currentAssigneeName: params.assigneeName,
                        updatedAt: serverTimestamp(),
                    });
                    transaction.set(doc(collection(db, ASSIGNMENTS_COLLECTION)), {
                        cardId: params.cardId,
                        cardLabel: params.cardLabel,
                        assigneeId: params.assigneeId,
                        assigneeType: params.assigneeType,
                        assigneeName: params.assigneeName,
                        startDate: params.startDate,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                    });
                });
                return;
            } catch (error) {
                if (error instanceof Error && error.message === CARD_ASSIGNMENT_PREFLIGHT_CHANGED && attempt < 2) {
                    continue;
                }
                throw error;
            }
        }
        throw new Error(CARD_ASSIGNMENT_PREFLIGHT_CHANGED);
    },

    async unassignCard(cardId: string, endDate: string): Promise<void> {
        const cardRef = doc(db, CARDS_COLLECTION, cardId);
        for (let attempt = 0; attempt < 3; attempt += 1) {
            const preflightCard = await getDoc(cardRef);
            if (!preflightCard.exists()) throw new Error('card-not-found');
            const preflightUpdatedAt = timestampFingerprint(preflightCard.data().updatedAt);
            const assignmentQuerySnapshot = await getDocs(query(
                collection(db, ASSIGNMENTS_COLLECTION),
                where('cardId', '==', cardId)
            ));
            const activeAssignmentRefs = assignmentQuerySnapshot.docs
                .filter((item) => hasOpenLink(item.data() as Record<string, unknown>))
                .map((item) => item.ref);
            if (activeAssignmentRefs.length > MAX_CARD_LIFECYCLE_LINKS) {
                throw new Error('card-assignment-link-limit-exceeded');
            }

            try {
                await runTransaction(db, async (transaction) => {
                    const [cardSnapshot, assignmentSnapshots] = await Promise.all([
                        transaction.get(cardRef),
                        Promise.all(activeAssignmentRefs.map((reference) => transaction.get(reference))),
                    ]);
                    if (!cardSnapshot.exists()) throw new Error('card-not-found');
                    if (timestampFingerprint(cardSnapshot.data().updatedAt) !== preflightUpdatedAt) {
                        throw new Error(CARD_ASSIGNMENT_PREFLIGHT_CHANGED);
                    }
                    assertCardCanBeAssignedOrBilled(cardSnapshot.data().status as CardStatus);

                    assignmentSnapshots
                        .filter((snapshot) => snapshot.exists() && hasOpenLink(snapshot.data() as Record<string, unknown>))
                        .forEach((assignmentSnapshot) => {
                            if (shouldDeleteZeroLengthAssignment(
                                assignmentSnapshot.data() as Record<string, unknown>,
                                endDate
                            )) {
                                transaction.delete(assignmentSnapshot.ref);
                                return;
                            }
                            transaction.update(assignmentSnapshot.ref, {
                                endDate,
                                updatedAt: serverTimestamp(),
                            });
                        });

                    transaction.update(cardRef, {
                        status: 'AVAILABLE',
                        currentAssigneeId: null,
                        currentAssigneeType: null,
                        currentAssigneeName: null,
                        updatedAt: serverTimestamp(),
                    });
                });
                return;
            } catch (error) {
                if (error instanceof Error && error.message === CARD_ASSIGNMENT_PREFLIGHT_CHANGED && attempt < 2) {
                    continue;
                }
                throw error;
            }
        }
        throw new Error(CARD_ASSIGNMENT_PREFLIGHT_CHANGED);
    },

    // --- Card Billing Targets ---
    async listCardBillingTargets(cardId?: string): Promise<CardBillingTargetRecord[]> {
        const baseRef = collection(db, BILLING_TARGETS_COLLECTION);
        const q = cardId
            ? query(baseRef, where('cardId', '==', cardId))
            : query(baseRef, orderBy('startDate', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as CardBillingTargetRecord))
            .sort((a, b) => String(b.startDate ?? '').localeCompare(String(a.startDate ?? '')));
    },

    async saveCardBillingTarget(data: Partial<CardBillingTargetRecord> & { id: string }): Promise<void> {
        const { id, createdAt, updatedAt, ...payload } = data;
        const validated = CardBillingTargetRecordSchema.parse(payload);
        const cleanedPayload = cleanForFirestore(validated) as Record<string, unknown>;
        const cardRef = doc(db, CARDS_COLLECTION, validated.cardId);
        await runTransaction(db, async (transaction) => {
            const cardSnapshot = await transaction.get(cardRef);
            if (!cardSnapshot.exists()) throw new Error('card-not-found');
            assertCardCanBeAssignedOrBilled(cardSnapshot.data().status as CardStatus);
            transaction.set(doc(db, BILLING_TARGETS_COLLECTION, id), {
                ...cleanedPayload,
                createdAt: createdAt ?? serverTimestamp(),
                updatedAt: serverTimestamp(),
            }, { merge: true });
            transaction.update(cardRef, { updatedAt: serverTimestamp() });
        });
    },

    async deleteCardBillingTarget(id: string): Promise<void> {
        await deleteDoc(doc(db, BILLING_TARGETS_COLLECTION, id));
    },

    async applyCardBillingTargetChanges(params: {
        cardId: string;
        upserts?: Array<Partial<CardBillingTargetRecord> & { id: string }>;
        closeRecords?: Array<{ id: string; endDate: string }>;
        deleteIds?: string[];
        clearSnapshot?: boolean;
        snapshot?: Pick<CardBillingTargetRecord, 'targetId' | 'targetType' | 'targetName' | 'startDate' | 'endDate'> | null;
    }): Promise<void> {
        const validatedUpserts = (params.upserts ?? []).map((record) => {
            const { id, createdAt, updatedAt, ...payload } = record;
            const validated = CardBillingTargetRecordSchema.parse(payload);
            if (validated.cardId !== params.cardId) throw new Error('billing-target-card-mismatch');
            const cleanedPayload = cleanForFirestore(validated) as Record<string, unknown>;
            return { id, createdAt, cleanedPayload };
        });
        const cardRef = doc(db, CARDS_COLLECTION, params.cardId);
        await runTransaction(db, async (transaction) => {
            const cardSnapshot = await transaction.get(cardRef);
            if (!cardSnapshot.exists()) throw new Error('card-not-found');
            if (validatedUpserts.length > 0 || Boolean(params.snapshot)) {
                assertCardCanBeAssignedOrBilled(cardSnapshot.data().status as CardStatus);
            }

            (params.closeRecords ?? []).forEach((record) => {
                if (!record.id) return;
                transaction.update(doc(db, BILLING_TARGETS_COLLECTION, record.id), {
                    endDate: record.endDate,
                    updatedAt: serverTimestamp()
                });
            });
            validatedUpserts.forEach(({ id, createdAt, cleanedPayload }) => {
                transaction.set(doc(db, BILLING_TARGETS_COLLECTION, id), {
                    ...cleanedPayload,
                    ...(createdAt ? { createdAt } : { createdAt: serverTimestamp() }),
                    updatedAt: serverTimestamp()
                }, { merge: true });
            });
            (params.deleteIds ?? []).forEach((id) => {
                if (!id) return;
                transaction.delete(doc(db, BILLING_TARGETS_COLLECTION, id));
            });

            const cardUpdates: Record<string, unknown> = { updatedAt: serverTimestamp() };
            if (params.snapshot) {
                cardUpdates.billingTargetId = params.snapshot.targetId;
                cardUpdates.billingTargetType = params.snapshot.targetType;
                cardUpdates.billingTargetName = params.snapshot.targetName;
                cardUpdates.billingTargetStartDate = params.snapshot.startDate;
                cardUpdates.billingTargetEndDate = params.snapshot.endDate || null;
            } else if (params.clearSnapshot || params.snapshot === null) {
                cardUpdates.billingTargetId = deleteField();
                cardUpdates.billingTargetType = deleteField();
                cardUpdates.billingTargetName = deleteField();
                cardUpdates.billingTargetStartDate = deleteField();
                cardUpdates.billingTargetEndDate = deleteField();
            }
            transaction.update(cardRef, cardUpdates);
        });
    },

    // --- Transactions ---
    async getTransactionsByMonth(yearMonth: string): Promise<CardTransaction[]> {
        const q = query(
            collection(db, TRANSACTIONS_COLLECTION),
            where('yearMonth', '==', yearMonth)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as CardTransaction))
            .filter((transaction) => transaction.status !== 'CANCELLED' && !transaction.cancelledAt)
            .sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')));
    },

    async addTransaction(data: Omit<CardTransaction, 'id' | 'createdAt'>): Promise<string> {
        const validated = CardTransactionSchema.parse(data);
        const cleanedData = cleanForFirestore(validated) as Record<string, unknown>;
        const docRef = doc(collection(db, TRANSACTIONS_COLLECTION));
        await setDoc(docRef, {
            ...cleanedData,
            status: cleanedData.status ?? 'ACTIVE',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        return docRef.id;
    },

    async applyCardTransactionChanges(params: {
        upserts?: Array<Partial<CardTransaction> & { id: string }>;
        cancelIds?: string[];
        operationId?: string;
    }): Promise<void> {
        const batch = writeBatch(db);
        const now = serverTimestamp();

        (params.upserts ?? []).forEach((transaction) => {
            if (!transaction.id) return;
            const { id, createdAt, updatedAt, cancelledAt, ...payload } = transaction;
            const validated = CardTransactionSchema.parse(payload);
            batch.set(doc(db, TRANSACTIONS_COLLECTION, id), cleanForFirestore({
                ...validated,
                status: validated.status ?? 'ACTIVE',
                cancelledAt: null,
                lastOperationId: params.operationId,
                ...(createdAt ? { createdAt } : { createdAt: now }),
                updatedAt: now
            }) as Record<string, unknown>, { merge: true });
        });

        (params.cancelIds ?? []).forEach((id) => {
            if (!id) return;
            batch.set(doc(db, TRANSACTIONS_COLLECTION, id), cleanForFirestore({
                status: 'CANCELLED',
                cancelledAt: now,
                lastOperationId: params.operationId,
                updatedAt: now
            }) as Record<string, unknown>, { merge: true });
        });

        await batch.commit();
    },

    async deleteTransaction(id: string): Promise<void> {
        await deleteDoc(doc(db, TRANSACTIONS_COLLECTION, id));
    },

    // --- Billings ---
    async getBillingsByMonth(yearMonth: string): Promise<CardBillingDocument[]> {
        const q = query(
            collection(db, BILLINGS_COLLECTION),
            where('yearMonth', '==', yearMonth)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CardBillingDocument));
    },

    async getBillingById(id: string): Promise<CardBillingDocument | null> {
        if (!id) return null;
        const snapshot = await getDoc(doc(db, BILLINGS_COLLECTION, id));
        return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as CardBillingDocument) : null;
    },

    async saveBilling(billing: CardBillingDocument): Promise<void> {
        const docRef = doc(db, BILLINGS_COLLECTION, billing.id);
        const { id, ...data } = billing;
        const cleanedData = cleanForFirestore(data) as Record<string, unknown>;
        await setDoc(docRef, {
            ...cleanedData,
            updatedAt: serverTimestamp(),
        }, { merge: true });
    },

    async replaceDraftBilling(billing: CardBillingDocument, staleBillingIds: string[]): Promise<void> {
        const billingIds = Array.from(new Set([
            billing.id,
            ...staleBillingIds
        ].map((id) => String(id ?? '').trim()).filter(Boolean)));
        const refs = billingIds.map((id) => doc(db, BILLINGS_COLLECTION, id));
        const nextRef = doc(db, BILLINGS_COLLECTION, billing.id);
        const { id, ...data } = billing;
        const cleanedData = cleanForFirestore(data) as Record<string, unknown>;

        await runTransaction(db, async (transaction) => {
            const snapshots = await Promise.all(refs.map((billingRef) => transaction.get(billingRef)));
            const postedSnapshot = snapshots.find((snapshot) => {
                if (!snapshot.exists()) return false;
                const status = String(snapshot.data()?.status ?? '').trim().toUpperCase();
                return ['CONFIRMED', 'PAID', 'OVERDUE'].includes(status);
            });
            if (postedSnapshot) throw new Error('card-billing-posted-replace-blocked');

            const settlementConfigIds = Array.from(new Set([
                getConfirmedTeamSettlementConfigIdForCardBilling(billing),
                ...snapshots
                    .filter((snapshot) => snapshot.exists())
                    .map((snapshot) => getConfirmedTeamSettlementConfigIdForCardBilling(
                        snapshot.data() as Partial<CardBillingDocument>
                    ))
            ].filter(Boolean)));
            const settlementSnapshots = await Promise.all(settlementConfigIds.map((id) => (
                transaction.get(doc(db, SYSTEM_CONFIGS_COLLECTION, id))
            )));
            if (settlementSnapshots.some((snapshot) => (
                snapshot.exists() && isConfirmedTeamSettlementConfigData(snapshot.data())
            ))) {
                throw new Error('team-settlement-confirmed-card-billing-blocked');
            }

            transaction.set(nextRef, {
                ...cleanedData,
                updatedAt: serverTimestamp(),
            });
            refs.forEach((billingRef) => {
                if (billingRef.id !== billing.id) transaction.delete(billingRef);
            });
        });
    },

    async deleteDraftBillings(billingIds: string[]): Promise<void> {
        const uniqueBillingIds = Array.from(new Set(
            billingIds.map((id) => String(id ?? '').trim()).filter(Boolean)
        ));
        if (uniqueBillingIds.length === 0) return;

        const refs = uniqueBillingIds.map((id) => doc(db, BILLINGS_COLLECTION, id));
        await runTransaction(db, async (transaction) => {
            const snapshots = await Promise.all(refs.map((billingRef) => transaction.get(billingRef)));
            const postedSnapshot = snapshots.find((snapshot) => {
                if (!snapshot.exists()) return false;
                const status = String(snapshot.data()?.status ?? '').trim().toUpperCase();
                return ['CONFIRMED', 'PAID', 'OVERDUE'].includes(status);
            });
            if (postedSnapshot) throw new Error('card-billing-posted-delete-blocked');

            const settlementConfigIds = Array.from(new Set(
                snapshots
                    .filter((snapshot) => snapshot.exists())
                    .map((snapshot) => getConfirmedTeamSettlementConfigIdForCardBilling(
                        snapshot.data() as Partial<CardBillingDocument>
                    ))
                    .filter(Boolean)
            ));
            const settlementSnapshots = await Promise.all(settlementConfigIds.map((id) => (
                transaction.get(doc(db, SYSTEM_CONFIGS_COLLECTION, id))
            )));
            if (settlementSnapshots.some((snapshot) => (
                snapshot.exists() && isConfirmedTeamSettlementConfigData(snapshot.data())
            ))) {
                throw new Error('team-settlement-confirmed-card-billing-blocked');
            }

            snapshots.forEach((snapshot) => {
                if (!snapshot.exists()) return;
                const status = String(snapshot.data()?.status ?? '').trim().toUpperCase();
                // Automatic zero-amount reconciliation owns DRAFT documents only.
                // CANCELLED and any future workflow states are deliberately retained.
                if (status === 'DRAFT') transaction.delete(snapshot.ref);
            });
        });
    },

    async deleteBilling(id: string): Promise<void> {
        await deleteDoc(doc(db, BILLINGS_COLLECTION, id));
    },

    // --- Migration ---
    async migrateLegacyData() {
        console.log('Starting Card & Transaction migration...');

        // 1. Fetch all from DC
        const [cardsRes, assignmentsRes, transactionsRes, billingsRes] = await Promise.all([
            listCards(),
            listCardAssignments(),
            listCardTransactions(),
            listCardBillingDocuments()
        ]);

        const dcCards = (cardsRes as any).data?.cards ?? [];
        const dcAssignments = (assignmentsRes as any).data?.cardAssignments ?? [];
        const dcTransactions = (transactionsRes as any).data?.cardTransactions ?? [];
        const dcBillings = (billingsRes as any).data?.cardBillingDocuments ?? [];

        const batch = writeBatch(db);
        const cardIdMap = new Map<string, string>(); // UUID -> Firestore ID

        // 2. Migrate Cards
        for (const dcCard of dcCards) {
            const ref = doc(collection(db, CARDS_COLLECTION));
            batch.set(ref, {
                name: dcCard.name,
                issuer: dcCard.issuer,
                cardType: dcCard.cardType,
                last4: dcCard.last4,
                maskedNumber: dcCard.maskedNumber,
                expiry: dcCard.expiry,
                status: dcCard.status,
                currentAssigneeId: dcCard.currentAssigneeId,
                currentAssigneeType: dcCard.currentAssigneeType,
                currentAssigneeName: dcCard.currentAssigneeName,
                billingTargetId: dcCard.billingTargetId,
                billingTargetType: dcCard.billingTargetType,
                billingTargetName: dcCard.billingTargetName,
                memo: dcCard.memo,
                legacyId: dcCard.id,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            cardIdMap.set(dcCard.id, ref.id);
        }

        // 3. Migrate Assignments
        for (const dcAs of dcAssignments) {
            const fsCardId = cardIdMap.get(dcAs.card?.id);
            if (!fsCardId) continue;

            const ref = doc(collection(db, ASSIGNMENTS_COLLECTION));
            batch.set(ref, {
                cardId: fsCardId,
                cardLabel: dcAs.cardLabel,
                assigneeId: dcAs.assigneeId,
                assigneeType: dcAs.assigneeType,
                assigneeName: dcAs.assigneeName,
                startDate: dcAs.startDate,
                endDate: dcAs.endDate,
                note: dcAs.note,
                legacyId: dcAs.id,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
        }

        // 4. Migrate Transactions
        for (const dcTx of dcTransactions) {
            const fsCardId = cardIdMap.get(dcTx.card?.id);
            if (!fsCardId) continue;

            const ref = doc(collection(db, TRANSACTIONS_COLLECTION));
            batch.set(ref, {
                cardId: fsCardId,
                cardLabel: dcTx.cardLabel,
                date: dcTx.date,
                yearMonth: dcTx.yearMonth,
                merchant: dcTx.merchant,
                category: dcTx.category,
                amount: dcTx.amount,
                memo: dcTx.memo,
                evidenceUrl: dcTx.evidenceUrl,
                legacyId: dcTx.id,
                createdAt: serverTimestamp()
            });
        }

        // 5. Migrate Billings
        for (const dcBi of dcBillings) {
            const fsCardId = cardIdMap.get(dcBi.card?.id);
            if (!fsCardId) continue;

            const ref = doc(db, BILLINGS_COLLECTION, dcBi.id); // 泥?뎄?쒕뒗 ID ?좎??섍굅???덈줈 ?앹꽦
            batch.set(ref, {
                yearMonth: dcBi.yearMonth,
                cardId: fsCardId,
                cardLabel: dcBi.cardLabel,
                assignedTeamId: dcBi.assignedTeamId,
                assignedTeamName: dcBi.assignedTeamName,
                teamId: dcBi.team?.id || dcBi.teamId,
                teamName: dcBi.teamName,
                issuedToType: dcBi.issuedToType,
                issuedToWorkerId: dcBi.issuedToWorkerId,
                issuedToWorkerName: dcBi.issuedToWorkerName,
                variableCost: dcBi.variableCost,
                totalAmount: dcBi.totalAmount,
                status: dcBi.status,
                lineItems: typeof dcBi.lineItems === 'string' ? JSON.parse(dcBi.lineItems) : dcBi.lineItems,
                statementAttachmentPaths: typeof dcBi.statementAttachmentPaths === 'string' ? JSON.parse(dcBi.statementAttachmentPaths) : dcBi.statementAttachmentPaths,
                memo: dcBi.memo,
                legacyId: dcBi.id,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
        }

        await batch.commit();
        return {
            cards: dcCards.length,
            assignments: dcAssignments.length,
            transactions: dcTransactions.length,
            billings: dcBillings.length
        };
    }
};


