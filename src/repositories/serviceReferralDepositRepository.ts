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
import { ServiceReferralDepositSchema } from '../types/zod/recruitingSchema';
import type { ServiceReferralDeposit } from '../types/recruiting';

const COLLECTION_NAME = 'service_referral_deposits';
const converter = createConverter(ServiceReferralDepositSchema);

export const serviceReferralDepositRepository = {
  getCollection() {
    return collection(db, COLLECTION_NAME).withConverter(converter);
  },

  async listByMonth(yearMonth: string, verified?: boolean | 'all'): Promise<ServiceReferralDeposit[]> {
    const constraints: QueryConstraint[] = [where('yearMonth', '==', yearMonth)];
    if (verified !== undefined && verified !== 'all') constraints.push(where('verified', '==', verified));
    constraints.push(orderBy('depositDate', 'desc'));
    const snapshot = await getDocs(query(this.getCollection(), ...constraints));
    return snapshot.docs.map((entry) => entry.data() as ServiceReferralDeposit);
  },

  async listAll(): Promise<ServiceReferralDeposit[]> {
    const q = query(this.getCollection(), orderBy('yearMonth', 'desc'), orderBy('depositDate', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((entry) => entry.data() as ServiceReferralDeposit);
  },

  async get(id: string): Promise<ServiceReferralDeposit | null> {
    const snapshot = await getDoc(doc(db, COLLECTION_NAME, id).withConverter(converter));
    return snapshot.exists() ? snapshot.data() as ServiceReferralDeposit : null;
  },

  async save(deposit: ServiceReferralDeposit): Promise<string> {
    const docId = String(deposit.id || deposit.depositId || '').trim();
    const docRef = docId
      ? doc(db, COLLECTION_NAME, docId).withConverter(converter)
      : doc(collection(db, COLLECTION_NAME)).withConverter(converter);
    await setDoc(
      docRef,
      {
        ...deposit,
        depositId: deposit.depositId || docRef.id,
        createdAt: deposit.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      } as any,
      { merge: true }
    );
    return docRef.id;
  },

  async update(id: string, updates: Partial<ServiceReferralDeposit>): Promise<void> {
    await updateDoc(doc(db, COLLECTION_NAME, id).withConverter(converter), {
      ...stripUndefinedFields(updates as Record<string, unknown>),
      updatedAt: serverTimestamp(),
    });
  },
};
