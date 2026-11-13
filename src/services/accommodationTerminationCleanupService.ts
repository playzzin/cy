import { collection, doc, getDocs, query, runTransaction, Timestamp, where } from 'firebase/firestore';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Accommodation } from '../types/accommodation';
import { isAccommodationExpenseAfterEnd } from '../utils/accommodationLifecycle';
import { createConverter } from '../utils/firestoreConverter';
import { accommodationSchema } from '../types/zod/accommodationSchema';

const ROOMS = 'accommodations';
const RECORDS = 'accommodationUtilityRecords';
const BILLS = 'accommodation_billing_documents';
const ITEMS = 'accommodation_billing_line_items';
const text = (value: unknown) => String(value ?? '').trim();
const billId = (row: Record<string, any>) => text(row.billingDocument?.id || row.billingDocumentId);

/** Save the cutoff and remove its later ledgers/billing lines together. Other rooms and past months survive. */
export const saveAccommodationAndCleanupExpenses = async (id: string, patch: Partial<Accommodation>): Promise<void> => {
    const [records, items] = await Promise.all([
        getDocs(query(collection(db, RECORDS), where('accommodationId', '==', id))),
        getDocs(query(collection(db, ITEMS), where('sourceAccommodationId', '==', id))),
    ]);
    const parentIds = [...new Set(items.docs.map(item => billId(item.data())).filter(Boolean))];
    const siblings = await Promise.all(parentIds.map(parent => getDocs(query(
        collection(db, ITEMS), where('billingDocumentId', '==', parent),
    ))));

    await runTransaction(db, async transaction => {
        const roomRef = doc(db, ROOMS, id).withConverter(createConverter(accommodationSchema));
        const roomSnapshot = await transaction.get(roomRef);
        if (!roomSnapshot.exists()) throw new Error('종료할 숙소를 찾을 수 없습니다.');
        const current = roomSnapshot.data() as Accommodation;
        const next = { ...current, ...patch, id, contract: { ...current.contract, ...patch.contract } };
        const [storedRecords, storedBills] = await Promise.all([
            Promise.all(records.docs.map(record => transaction.get(record.ref))),
            Promise.all(parentIds.map(parent => transaction.get(doc(db, BILLS, parent)))),
        ]);
        const allItemIds = new Set([
            ...items.docs.map(item => item.id),
            ...siblings.flatMap(result => result.docs.map(item => item.id)),
            ...storedBills.flatMap(bill => bill.exists() && Array.isArray(bill.data().lineItemIds) ? bill.data().lineItemIds as string[] : []),
        ]);
        const storedItems = await Promise.all([...allItemIds].map(item => transaction.get(doc(db, ITEMS, item))));
        const expiredBills = storedBills.filter((bill): bill is QueryDocumentSnapshot => bill.exists())
            .filter(bill => isAccommodationExpenseAfterEnd(next, text(bill.data().yearMonth)));
        const expiredBillIds = new Set(expiredBills.map(bill => bill.id));
        const removedItems = storedItems.filter((item): item is QueryDocumentSnapshot => item.exists())
            .filter(item => text(item.data().sourceAccommodationId) === id && expiredBillIds.has(billId(item.data())));
        const removedIds = new Set(removedItems.map(item => item.id));
        const removedRecords = storedRecords.filter((record): record is QueryDocumentSnapshot => record.exists())
            .filter(record => text(record.data().accommodationId) === id && isAccommodationExpenseAfterEnd(next, text(record.data().yearMonth)));
        const affectedBills = expiredBills.filter(bill => removedItems.some(item => billId(item.data()) === bill.id));
        const settlementKeys = [...new Set(affectedBills.filter(bill => text(bill.data().teamId) !== '__office__')
            .map(bill => `team_settlement_${text(bill.data().yearMonth)}__${text(bill.data().teamId)}`))];
        const settlements = await Promise.all(settlementKeys.map(key => transaction.get(doc(db, 'system_configs', key))));
        for (const bill of affectedBills) {
            if (text(bill.data().status || 'draft').toUpperCase() !== 'DRAFT' || bill.data().postedAdvancePaymentId || bill.data().confirmedAt) {
                throw new Error('종료 이후 확정된 숙소 청구가 있습니다. 확정을 취소한 뒤 종료해 주세요. 저장하지 않았습니다.');
            }
        }
        for (const settlement of settlements) {
            if (!settlement.exists()) continue;
            const value = settlement.data().data;
            const data = typeof value === 'string' ? JSON.parse(value) : value;
            if (!data || data.confirmedAt) throw new Error('종료 이후 확정된 팀 정산을 확인해 주세요. 저장하지 않았습니다.');
        }
        if (removedRecords.some(record => record.data().paymentStatus === 'paid')) {
            throw new Error('종료 이후 지급 완료된 숙소 경비를 확인해 주세요. 저장하지 않았습니다.');
        }
        if (removedRecords.length * 2 + removedItems.length + affectedBills.length + 1 > 450) {
            throw new Error('종료 이후 내역이 많아 한 번에 정리할 수 없습니다. 저장하지 않았습니다.');
        }
        // All reads/validation precede every write; a concurrent confirmation retries the transaction.
        removedRecords.forEach(record => {
            transaction.delete(record.ref);
            const guard = `accommodation_billing_sync_v1_${encodeURIComponent(text(record.data().yearMonth))}_${encodeURIComponent(record.id)}`;
            transaction.delete(doc(db, 'support_shared_data', guard));
        });
        removedItems.forEach(item => transaction.delete(item.ref));
        affectedBills.forEach(bill => {
            const remaining = storedItems.filter(item => item.exists() && billId(item.data()) === bill.id && !removedIds.has(item.id));
            if (remaining.length === 0) transaction.delete(bill.ref);
            else transaction.update(bill.ref, { lineItemIds: remaining.map(item => item.id), updatedAt: Timestamp.now() });
        });
        transaction.set(roomRef, { ...patch, id, updatedAt: Timestamp.now() }, { merge: true });
    });
};
