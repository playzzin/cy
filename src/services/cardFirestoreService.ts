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
import { db } from '../config/firebase';
import {
    Card,
    CardAssignmentRecord,
    CardTransaction,
    CardAssigneeType,
    CardBillingTargetRecord
} from '../types/card';
import { CardBillingDocument } from '../types/cardBilling';
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

const CARDS_COLLECTION = 'cards';
const ASSIGNMENTS_COLLECTION = 'cardAssignments';
const BILLING_TARGETS_COLLECTION = 'cardBillingTargets';
const TRANSACTIONS_COLLECTION = 'cardTransactions';
const BILLINGS_COLLECTION = 'cardBillings';

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
        await setDoc(doc(db, ASSIGNMENTS_COLLECTION, id), {
            ...validated,
            ...(createdAt ? { createdAt } : {}),
            updatedAt: serverTimestamp(),
        }, { merge: true });
    },

    async assignCard(params: {
        cardId: string;
        assigneeId: string;
        assigneeType: CardAssigneeType;
        assigneeName: string;
        startDate: string;
        cardLabel: string;
    }): Promise<void> {
        const activeSnapshot = await getDocs(query(
            collection(db, ASSIGNMENTS_COLLECTION),
            where('cardId', '==', params.cardId)
        ));
        const activeAssignments = activeSnapshot.docs.filter(d => !d.data().endDate);
        const previousEndDate = getDayBefore(params.startDate);

        await runTransaction(db, async (transaction) => {
            const cardRef = doc(db, CARDS_COLLECTION, params.cardId);
            const assignmentRef = doc(collection(db, ASSIGNMENTS_COLLECTION));

            activeAssignments.forEach((assignmentDoc) => {
                if (shouldDeleteZeroLengthAssignment(assignmentDoc.data(), previousEndDate)) {
                    transaction.delete(assignmentDoc.ref);
                    return;
                }
                transaction.update(assignmentDoc.ref, {
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

            transaction.set(assignmentRef, {
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
    },

    async unassignCard(cardId: string, endDate: string): Promise<void> {
        const activeSnapshot = await getDocs(query(
            collection(db, ASSIGNMENTS_COLLECTION),
            where('cardId', '==', cardId)
        ));
        const activeAssignments = activeSnapshot.docs.filter(d => !d.data().endDate);

        await runTransaction(db, async (transaction) => {
            const cardRef = doc(db, CARDS_COLLECTION, cardId);

            activeAssignments.forEach((assignmentDoc) => {
                if (shouldDeleteZeroLengthAssignment(assignmentDoc.data(), endDate)) {
                    transaction.delete(assignmentDoc.ref);
                    return;
                }
                transaction.update(assignmentDoc.ref, {
                    endDate,
                    updatedAt: serverTimestamp(),
                });
            });

            // 2. 移대뱶 ?곹깭 ?낅뜲?댄듃
            transaction.update(cardRef, {
                status: 'AVAILABLE',
                currentAssigneeId: null,
                currentAssigneeType: null,
                currentAssigneeName: null,
                updatedAt: serverTimestamp(),
            });
        });
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
        await setDoc(doc(db, BILLING_TARGETS_COLLECTION, id), {
            ...cleanedPayload,
            createdAt: createdAt ?? serverTimestamp(),
            updatedAt: serverTimestamp(),
        }, { merge: true });
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
    }): Promise<void> {
        const batch = writeBatch(db);

        (params.closeRecords ?? []).forEach((record) => {
            if (!record.id) return;
            batch.update(doc(db, BILLING_TARGETS_COLLECTION, record.id), {
                endDate: record.endDate,
                updatedAt: serverTimestamp()
            });
        });

        (params.upserts ?? []).forEach((record) => {
            const { id, createdAt, updatedAt, ...payload } = record;
            const validated = CardBillingTargetRecordSchema.parse(payload);
            const cleanedPayload = cleanForFirestore(validated) as Record<string, unknown>;
            batch.set(doc(db, BILLING_TARGETS_COLLECTION, id), {
                ...cleanedPayload,
                ...(createdAt ? { createdAt } : { createdAt: serverTimestamp() }),
                updatedAt: serverTimestamp()
            }, { merge: true });
        });

        (params.deleteIds ?? []).forEach((id) => {
            if (!id) return;
            batch.delete(doc(db, BILLING_TARGETS_COLLECTION, id));
        });

        if (params.clearSnapshot) {
            batch.update(doc(db, CARDS_COLLECTION, params.cardId), {
                billingTargetId: deleteField(),
                billingTargetType: deleteField(),
                billingTargetName: deleteField(),
                billingTargetStartDate: deleteField(),
                billingTargetEndDate: deleteField(),
                updatedAt: serverTimestamp()
            });
        }

        await batch.commit();
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


