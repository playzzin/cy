import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    serverTimestamp,
    setDoc,
    updateDoc,
    writeBatch,
    Timestamp,
    deleteField
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
    AccommodationBillingDocument,
    AccommodationBillingLineItem,
    AccommodationBillingTargetField
} from '../types/accommodationBilling';

const BILLING_COLLECTION = 'accommodation_billing_documents';
const ADVANCE_PAYMENT_COLLECTION = 'advance_payments';

type AdvancePaymentField =
    | 'prevMonthCarryover'
    | 'accommodation'
    | 'privateRoom'
    | 'gloves'
    | 'deposit'
    | 'fines'
    | 'electricity'
    | 'gas'
    | 'internet'
    | 'water'
    | 'totalDeduction';

interface AdvancePaymentDoc {
    id?: string;
    workerId: string;
    workerName: string;
    teamId: string;
    teamName: string;
    yearMonth: string;
    prevMonthCarryover: number;
    accommodation: number;
    privateRoom: number;
    gloves: number;
    deposit: number;
    fines: number;
    electricity: number;
    gas: number;
    internet: number;
    water: number;
    totalDeduction: number;
    updatedAt?: Timestamp;
}

const createEmptyAdvancePayment = (params: {
    workerId: string;
    workerName: string;
    teamId: string;
    teamName: string;
    yearMonth: string;
}): AdvancePaymentDoc => {
    return {
        workerId: params.workerId,
        workerName: params.workerName,
        teamId: params.teamId,
        teamName: params.teamName,
        yearMonth: params.yearMonth,
        prevMonthCarryover: 0,
        accommodation: 0,
        privateRoom: 0,
        gloves: 0,
        deposit: 0,
        fines: 0,
        electricity: 0,
        gas: 0,
        internet: 0,
        water: 0,
        totalDeduction: 0
    };
};

const calculateTotalDeduction = (docData: AdvancePaymentDoc): number => {
    return (
        docData.prevMonthCarryover +
        docData.accommodation +
        docData.privateRoom +
        docData.gloves +
        docData.deposit +
        docData.fines +
        docData.electricity +
        docData.gas +
        docData.internet +
        docData.water
    );
};

const getFieldSumsFromLineItems = (
    lineItems: AccommodationBillingLineItem[]
): Partial<Record<AdvancePaymentField, number>> => {
    const sums: Partial<Record<AdvancePaymentField, number>> = {};

    lineItems.forEach((li) => {
        const amount = Number.isFinite(li.amount) ? li.amount : 0;
        const key = li.targetField as AdvancePaymentField;
        sums[key] = (sums[key] ?? 0) + amount;
    });

    return sums;
};

const mapTargetFieldToAdvanceField = (
    targetField: AccommodationBillingTargetField
): AdvancePaymentField => {
    if (targetField === 'accommodation') return 'accommodation';
    if (targetField === 'privateRoom') return 'privateRoom';
    if (targetField === 'electricity') return 'electricity';
    if (targetField === 'gas') return 'gas';
    if (targetField === 'internet') return 'internet';
    if (targetField === 'water') return 'water';
    if (targetField === 'fines') return 'fines';
    if (targetField === 'deposit') return 'deposit';
    return 'gloves';
};

const POSTING_FIELDS: AdvancePaymentField[] = [
    'accommodation',
    'privateRoom',
    'electricity',
    'gas',
    'internet',
    'water',
    'fines',
    'deposit',
    'gloves'
];

export const accommodationBillingService = {
    buildBillingDocumentId: (params: {
        teamId: string;
        issuedToType: 'team_leader' | 'worker';
        workerId: string;
        yearMonth: string;
    }): string => {
        return `${params.teamId}_${params.issuedToType}_${params.workerId}_${params.yearMonth}`;
    },

    buildAdvancePaymentId: (params: {
        teamId: string;
        workerId: string;
        yearMonth: string;
    }): string => {
        return `${params.teamId}_${params.workerId}_${params.yearMonth}`;
    },

    async getBillingDocuments(params: {
        teamId: string;
        yearMonth: string;
    }): Promise<AccommodationBillingDocument[]> {
        const q = query(
            collection(db, BILLING_COLLECTION),
            where('teamId', '==', params.teamId),
            where('yearMonth', '==', params.yearMonth)
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map((d) => {
            return {
                ...(d.data() as Omit<AccommodationBillingDocument, 'id'>),
                id: d.id
            };
        });
    },

    async upsertBillingDocument(docData: Omit<AccommodationBillingDocument, 'createdAt' | 'updatedAt'>): Promise<string> {
        const docRef = doc(db, BILLING_COLLECTION, docData.id);
        const existing = await getDoc(docRef);

        if (existing.exists()) {
            await updateDoc(docRef, {
                ...docData,
                updatedAt: serverTimestamp()
            });
            return docData.id;
        }

        await setDoc(docRef, {
            ...docData,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        return docData.id;
    },

    async confirmAndPostToAdvancePayment(billingId: string): Promise<void> {
        const billingRef = doc(db, BILLING_COLLECTION, billingId);
        const billingSnap = await getDoc(billingRef);

        if (!billingSnap.exists()) {
            throw new Error('청구서를 찾을 수 없습니다.');
        }

        const billing = {
            ...(billingSnap.data() as Omit<AccommodationBillingDocument, 'id'>),
            id: billingSnap.id
        } as AccommodationBillingDocument;

        if (billing.status === 'confirmed') {
            return;
        }

        if (!billing.teamId || !billing.yearMonth || !billing.issuedToWorkerId) {
            throw new Error('청구서 필수 정보가 누락되었습니다.');
        }

        const fieldSums = getFieldSumsFromLineItems(billing.lineItems);

        const advanceId = this.buildAdvancePaymentId({
            teamId: billing.teamId,
            workerId: billing.issuedToWorkerId,
            yearMonth: billing.yearMonth
        });

        const advanceRef = doc(db, ADVANCE_PAYMENT_COLLECTION, advanceId);
        const advanceSnap = await getDoc(advanceRef);

        let advance: AdvancePaymentDoc;
        if (advanceSnap.exists()) {
            advance = {
                ...(advanceSnap.data() as AdvancePaymentDoc),
                id: advanceId
            };
        } else {
            advance = createEmptyAdvancePayment({
                workerId: billing.issuedToWorkerId,
                workerName: billing.issuedToWorkerName,
                teamId: billing.teamId,
                teamName: billing.teamName,
                yearMonth: billing.yearMonth
            });
        }

        POSTING_FIELDS.forEach((f) => {
            advance[f] = 0;
        });

        (Object.keys(fieldSums) as AdvancePaymentField[]).forEach((k) => {
            if (k === 'totalDeduction') return;
            const val = fieldSums[k] ?? 0;
            advance[k] = val;
        });

        advance.totalDeduction = calculateTotalDeduction(advance);

        const batch = writeBatch(db);

        batch.set(
            advanceRef,
            {
                ...advance,
                id: advanceId,
                absenceFine: deleteField(),
                updatedAt: Timestamp.now(),
                accommodationBillingDocId: billingId
            },
            { merge: true }
        );

        batch.update(billingRef, {
            status: 'confirmed',
            confirmedAt: serverTimestamp(),
            postedAdvancePaymentId: advanceId,
            updatedAt: serverTimestamp()
        });

        await batch.commit();
    },

    getAdvanceFieldForTargetField: mapTargetFieldToAdvanceField,

    calculateLineItemsTotal(lineItems: AccommodationBillingLineItem[]): number {
        return lineItems.reduce((sum, li) => sum + (Number.isFinite(li.amount) ? li.amount : 0), 0);
    }
};
