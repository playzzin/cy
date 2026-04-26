import {
    collection,
    doc,
    setDoc,
    getDocs,
    getDoc,
    query,
    where,
    orderBy,
    Timestamp,
    runTransaction,
    deleteDoc,
    serverTimestamp,
    increment,
    updateDoc
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { TaxAffairsRecord } from '../pages/tax/components/TransactionTable';

export const RECEIVABLE_COLLECTION = 'receivable_ledgers';
export const PAYMENT_COLLECTION = 'receivable_payments';

export interface ReceivableLedger {
    id: string; // derived from invoice ID
    invoiceData: {
        date: string;
        partnerName: string;
        totalAmount: number;
        itemName: string;
        invoiceNum?: string;
    };
    status: '미수' | '부분수납' | '완납' | '과입금';
    totalPaidAmount: number;
    outstandingAmount: number;
    lastPaymentDate?: string;
    registeredAt: any;
    updatedAt: any;
}

export interface ReceivablePayment {
    id: string;
    receivableId: string;
    type: 'BANK_MATCH' | 'MANUAL';
    method: 'BankMatch' | 'Cash' | 'Corporate' | 'Personal' | 'Manual';
    amount: number;
    paymentDate: string;
    createdAt: any;

    // Bank Match specific
    bankTxId?: string;
    bankSender?: string;

    // Manual specific
    memo?: string;
}

const toMillis = (value: unknown): number => {
    if (value instanceof Timestamp) return value.toMillis();
    if (typeof value === 'object' && value !== null && 'seconds' in value) {
        const seconds = (value as { seconds: number }).seconds;
        if (typeof seconds === 'number') return seconds * 1000;
    }
    return 0;
};

export const receivableService = {
    /**
     * Register invoices as receivables.
     * Skips already registered ones (idempotent).
     */
    async registerReceivables(invoices: TaxAffairsRecord[]) {
        const batch = [];

        // We use runTransaction for batch reliability or simple Loop+SetDoc (since it's upsert mostly)
        // Using Promise.all for parallel writes
        await Promise.all(invoices.map(async (inv) => {
            const id = inv.id;
            const docRef = doc(db, RECEIVABLE_COLLECTION, id);
            const snap = await getDoc(docRef);

            if (!snap.exists()) {
                const newDoc: ReceivableLedger = {
                    id,
                    invoiceData: {
                        date: inv.date,
                        partnerName: inv.partnerName,
                        totalAmount: inv.totalAmount,
                        itemName: inv.description,
                        invoiceNum: inv.invoiceNum || ''
                    },
                    status: '미수',
                    totalPaidAmount: 0,
                    outstandingAmount: inv.totalAmount,
                    registeredAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                };
                await setDoc(docRef, newDoc);
            }
        }));
    },

    /**
     * Get all active receivables
     */
    async getReceivables() {
        // You might want filters here later
        const q = query(collection(db, RECEIVABLE_COLLECTION), orderBy('invoiceData.date', 'desc'));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as ReceivableLedger));
    },

    async getPayments(receivableId: string) {
        const q = query(
            collection(db, PAYMENT_COLLECTION),
            where('receivableId', '==', receivableId)
        );
        const snap = await getDocs(q);
        const payments = snap.docs.map(d => ({ id: d.id, ...d.data() } as ReceivablePayment));
        return payments.sort((left, right) => {
            const dateCompare = right.paymentDate.localeCompare(left.paymentDate);
            if (dateCompare !== 0) return dateCompare;
            return toMillis(right.createdAt) - toMillis(left.createdAt);
        });
    },

    /**
     * Add a payment and update the ledger
     */
    async addPayment(receivableId: string, payment: Omit<ReceivablePayment, 'id' | 'createdAt'>) {
        await runTransaction(db, async (transaction) => {
            const ledgerRef = doc(db, RECEIVABLE_COLLECTION, receivableId);
            const ledgerSnap = await transaction.get(ledgerRef);

            if (!ledgerSnap.exists()) {
                throw new Error("Receivable not found");
            }

            const ledger = ledgerSnap.data() as ReceivableLedger;
            const newTotalPaid = ledger.totalPaidAmount + payment.amount;
            const newOutstanding = ledger.invoiceData.totalAmount - newTotalPaid;

            let newStatus: ReceivableLedger['status'] = '미수';
            if (newOutstanding === 0) newStatus = '완납';
            else if (newOutstanding < 0) newStatus = '과입금';
            else if (newTotalPaid > 0) newStatus = '부분수납';

            // Create Payment Doc
            const paymentRef = doc(collection(db, PAYMENT_COLLECTION));
            transaction.set(paymentRef, {
                ...payment,
                id: paymentRef.id,
                receivableId,
                createdAt: serverTimestamp()
            });

            // Update Ledger
            transaction.update(ledgerRef, {
                totalPaidAmount: newTotalPaid,
                outstandingAmount: newOutstanding,
                status: newStatus,
                lastPaymentDate: payment.paymentDate,
                updatedAt: serverTimestamp()
            });
        });
    },

    /**
     * Delete a payment and revert the ledger
     */
    async deletePayment(paymentId: string, receivableId: string, amount: number) {
        await runTransaction(db, async (transaction) => {
            const ledgerRef = doc(db, RECEIVABLE_COLLECTION, receivableId);
            const paymentRef = doc(db, PAYMENT_COLLECTION, paymentId);

            const ledgerSnap = await transaction.get(ledgerRef);
            if (!ledgerSnap.exists()) throw new Error("Receivable not found");

            const ledger = ledgerSnap.data() as ReceivableLedger;
            const newTotalPaid = ledger.totalPaidAmount - amount;
            const newOutstanding = ledger.invoiceData.totalAmount - newTotalPaid;

            let newStatus: ReceivableLedger['status'] = '미수';
            if (newOutstanding === 0) newStatus = '완납';
            else if (newOutstanding < 0) newStatus = '과입금'; // Should be rare on rollback
            else if (newTotalPaid > 0) newStatus = '부분수납';

            transaction.delete(paymentRef);
            transaction.update(ledgerRef, {
                totalPaidAmount: newTotalPaid,
                outstandingAmount: newOutstanding,
                status: newStatus,
                updatedAt: serverTimestamp()
            });
        });
    },

    /**
     * Update Receivable Ledger basic info
     */
    async updateReceivable(id: string, updates: Partial<ReceivableLedger['invoiceData']>) {
        await runTransaction(db, async (transaction) => {
            const ref = doc(db, RECEIVABLE_COLLECTION, id);
            const snap = await transaction.get(ref);
            if (!snap.exists()) throw new Error("Document not found");

            const data = snap.data() as ReceivableLedger;
            const newData = { ...data.invoiceData, ...updates };

            // Recalculate if totalAmount changed
            const newOutstanding = newData.totalAmount - data.totalPaidAmount;

            let newStatus: ReceivableLedger['status'] = '미수';
            if (newOutstanding === 0) newStatus = '완납';
            else if (newOutstanding < 0) newStatus = '과입금';
            else if (data.totalPaidAmount > 0) newStatus = '부분수납';

            transaction.update(ref, {
                invoiceData: newData,
                outstandingAmount: newOutstanding,
                status: newStatus,
                updatedAt: serverTimestamp()
            });
        });
    },

    /**
     * Delete Receivable Ledger
     */
    async deleteReceivable(id: string) {
        await deleteDoc(doc(db, RECEIVABLE_COLLECTION, id));
        // Optionally delete payments, but usually keeping themorphaned is safer or we use cloud functions
        // For now, simple delete of the ledger
    }
};
