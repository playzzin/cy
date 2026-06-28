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
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { createConverter } from '../utils/firestoreConverter';
import { stripUndefinedFields } from '../utils/stripUndefinedFields';
import { ServiceReferralReceivableSchema } from '../types/zod/recruitingSchema';
import type { ServiceReferralReceivable, ServiceReferralReceivableStatus } from '../types/recruiting';

const COLLECTION_NAME = 'service_referral_receivables';
const converter = createConverter(ServiceReferralReceivableSchema);

export const serviceReferralReceivableRepository = {
  getCollection() {
    return collection(db, COLLECTION_NAME).withConverter(converter);
  },

  async listByMonth(month: string, status?: ServiceReferralReceivableStatus | 'all'): Promise<ServiceReferralReceivable[]> {
    const constraints: QueryConstraint[] = [where('month', '==', month)];
    if (status && status !== 'all') constraints.push(where('status', '==', status));
    constraints.push(orderBy('referrerName', 'asc'));
    const snapshot = await getDocs(query(this.getCollection(), ...constraints));
    return snapshot.docs.map((entry) => entry.data() as ServiceReferralReceivable);
  },

  async listAll(): Promise<ServiceReferralReceivable[]> {
    const q = query(this.getCollection(), orderBy('month', 'desc'), orderBy('referrerName', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((entry) => entry.data() as ServiceReferralReceivable);
  },

  async get(id: string): Promise<ServiceReferralReceivable | null> {
    const snapshot = await getDoc(doc(db, COLLECTION_NAME, id).withConverter(converter));
    return snapshot.exists() ? snapshot.data() as ServiceReferralReceivable : null;
  },

  async save(receivable: ServiceReferralReceivable): Promise<string> {
    const docId = String(receivable.id || receivable.receivableId || '').trim();
    const docRef = docId
      ? doc(db, COLLECTION_NAME, docId).withConverter(converter)
      : doc(collection(db, COLLECTION_NAME)).withConverter(converter);
    await setDoc(
      docRef,
      {
        ...receivable,
        receivableId: receivable.receivableId || docRef.id,
        createdAt: receivable.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      } as any,
      { merge: true }
    );
    return docRef.id;
  },

  async update(id: string, updates: Partial<ServiceReferralReceivable>): Promise<void> {
    await updateDoc(doc(db, COLLECTION_NAME, id).withConverter(converter), {
      ...stripUndefinedFields(updates as Record<string, unknown>),
      updatedAt: serverTimestamp(),
    });
  },
};
