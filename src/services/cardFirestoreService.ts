import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
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
    CardAssigneeType
} from '../types/card';
import { CardBillingDocument } from '../types/cardBilling';
import {
    CardSchema,
    CardAssignmentRecordSchema,
    CardTransactionSchema,
    CardBillingDocumentSchema
} from '../types/zod/cardSchema';
import {
    listCards,
    listCardAssignments,
    listCardTransactions,
    listCardBillingDocuments
} from './firestoreCrudCompat';

const CARDS_COLLECTION = 'cards';
const ASSIGNMENTS_COLLECTION = 'cardAssignments';
const TRANSACTIONS_COLLECTION = 'cardTransactions';
const BILLINGS_COLLECTION = 'cardBillings';

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
            where('cardId', '==', cardId),
            orderBy('startDate', 'desc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CardAssignmentRecord));
    },

    async listAllCardAssignments(): Promise<CardAssignmentRecord[]> {
        const q = query(collection(db, ASSIGNMENTS_COLLECTION), orderBy('startDate', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CardAssignmentRecord));
    },

    async assignCard(params: {
        cardId: string;
        assigneeId: string;
        assigneeType: CardAssigneeType;
        assigneeName: string;
        startDate: string;
        cardLabel: string;
    }): Promise<void> {
        await runTransaction(db, async (transaction) => {
            const cardRef = doc(db, CARDS_COLLECTION, params.cardId);
            const assignmentRef = doc(collection(db, ASSIGNMENTS_COLLECTION));

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
        await runTransaction(db, async (transaction) => {
            const cardRef = doc(db, CARDS_COLLECTION, cardId);

            // 1. ?꾩옱 吏꾪뻾 以묒씤 諛곗젙 ?덉퐫??李얘린
            const q = query(
                collection(db, ASSIGNMENTS_COLLECTION),
                where('cardId', '==', cardId)
            );
            const snapshot = await getDocs(q);
            const activeAssignment = snapshot.docs.find(d => !d.data().endDate);

            if (activeAssignment) {
                transaction.update(activeAssignment.ref, {
                    endDate,
                    updatedAt: serverTimestamp(),
                });
            }

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

    // --- Transactions ---
    async getTransactionsByMonth(yearMonth: string): Promise<CardTransaction[]> {
        const q = query(
            collection(db, TRANSACTIONS_COLLECTION),
            where('yearMonth', '==', yearMonth),
            orderBy('date', 'desc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CardTransaction));
    },

    async addTransaction(data: Omit<CardTransaction, 'id' | 'createdAt'>): Promise<string> {
        const validated = CardTransactionSchema.parse(data);
        const docRef = doc(collection(db, TRANSACTIONS_COLLECTION));
        await setDoc(docRef, {
            ...validated,
            createdAt: serverTimestamp(),
        });
        return docRef.id;
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

    async saveBilling(billing: CardBillingDocument): Promise<void> {
        const docRef = doc(db, BILLINGS_COLLECTION, billing.id);
        const { id, ...data } = billing;
        await setDoc(docRef, {
            ...data,
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


