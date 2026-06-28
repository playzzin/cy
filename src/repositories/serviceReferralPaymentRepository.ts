import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  QueryConstraint,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { createConverter } from '../utils/firestoreConverter';
import { stripUndefinedFields } from '../utils/stripUndefinedFields';
import { ServiceReferralPaymentSchema } from '../types/zod/recruitingSchema';
import type { ServiceReferralPayment, ServiceReferralPaymentStatus } from '../types/recruiting';

const COLLECTION_NAME = 'service_referral_payments';
const converter = createConverter(ServiceReferralPaymentSchema);

export const serviceReferralPaymentRepository = {
  getCollection() {
    return collection(db, COLLECTION_NAME).withConverter(converter);
  },

  async listByMonth(yearMonth: string, status?: ServiceReferralPaymentStatus | 'all'): Promise<ServiceReferralPayment[]> {
    const constraints: QueryConstraint[] = [where('yearMonth', '==', yearMonth)];
    if (status && status !== 'all') constraints.push(where('paymentStatus', '==', status));
    constraints.push(orderBy('referrerName', 'asc'));
    const snapshot = await getDocs(query(this.getCollection(), ...constraints));
    return snapshot.docs.map((entry) => entry.data() as ServiceReferralPayment);
  },

  async listAll(): Promise<ServiceReferralPayment[]> {
    const q = query(this.getCollection(), orderBy('yearMonth', 'desc'), orderBy('referrerName', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((entry) => entry.data() as ServiceReferralPayment);
  },

  async listBySettlement(settlementId: string): Promise<ServiceReferralPayment[]> {
    const q = query(this.getCollection(), where('settlementId', '==', settlementId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((entry) => entry.data() as ServiceReferralPayment);
  },

  async get(id: string): Promise<ServiceReferralPayment | null> {
    const snapshot = await getDoc(doc(db, COLLECTION_NAME, id).withConverter(converter));
    return snapshot.exists() ? snapshot.data() as ServiceReferralPayment : null;
  },

  async save(payment: ServiceReferralPayment): Promise<string> {
    const docId = String(payment.id || payment.paymentId || '').trim();
    const docRef = docId
      ? doc(db, COLLECTION_NAME, docId).withConverter(converter)
      : doc(collection(db, COLLECTION_NAME)).withConverter(converter);
    await setDoc(
      docRef,
      {
        ...payment,
        paymentId: payment.paymentId || docRef.id,
        createdAt: payment.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      } as any,
      { merge: true }
    );
    return docRef.id;
  },

  async saveMany(payments: ServiceReferralPayment[]): Promise<void> {
    if (payments.length === 0) return;
    const batch = writeBatch(db);
    payments.forEach((payment) => {
      const docId = String(payment.id || payment.paymentId || '').trim();
      if (!docId) return;
      batch.set(
        doc(db, COLLECTION_NAME, docId).withConverter(converter),
        {
          ...payment,
          paymentId: payment.paymentId || docId,
          createdAt: payment.createdAt || serverTimestamp(),
          updatedAt: serverTimestamp(),
        } as any,
        { merge: true }
      );
    });
    await batch.commit();
  },

  async update(id: string, updates: Partial<ServiceReferralPayment>): Promise<void> {
    await updateDoc(doc(db, COLLECTION_NAME, id).withConverter(converter), {
      ...stripUndefinedFields(updates as Record<string, unknown>),
      updatedAt: serverTimestamp(),
    });
  },
};
