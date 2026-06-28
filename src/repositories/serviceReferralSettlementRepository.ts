import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { createConverter } from '../utils/firestoreConverter';
import { stripUndefinedFields } from '../utils/stripUndefinedFields';
import { ServiceReferralMonthlySettlementSchema } from '../types/zod/recruitingSchema';
import type { ServiceReferralMonthlySettlement } from '../types/recruiting';

const COLLECTION_NAME = 'service_referral_monthly_settlements';
const converter = createConverter(ServiceReferralMonthlySettlementSchema);

export const serviceReferralSettlementRepository = {
  getCollection() {
    return collection(db, COLLECTION_NAME).withConverter(converter);
  },

  async listByMonth(yearMonth: string): Promise<ServiceReferralMonthlySettlement[]> {
    const q = query(this.getCollection(), where('yearMonth', '==', yearMonth), orderBy('referrerName', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((entry) => entry.data() as ServiceReferralMonthlySettlement);
  },

  async listAll(): Promise<ServiceReferralMonthlySettlement[]> {
    const q = query(this.getCollection(), orderBy('yearMonth', 'desc'), orderBy('referrerName', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((entry) => entry.data() as ServiceReferralMonthlySettlement);
  },

  async get(id: string): Promise<ServiceReferralMonthlySettlement | null> {
    const snapshot = await getDoc(doc(db, COLLECTION_NAME, id).withConverter(converter));
    return snapshot.exists() ? snapshot.data() as ServiceReferralMonthlySettlement : null;
  },

  async saveMany(settlements: ServiceReferralMonthlySettlement[]): Promise<void> {
    if (settlements.length === 0) return;
    const batch = writeBatch(db);
    settlements.forEach((settlement) => {
      const id = String(settlement.id || '').trim();
      if (!id) return;
      batch.set(
        doc(db, COLLECTION_NAME, id).withConverter(converter),
        {
          ...settlement,
          createdAt: settlement.createdAt || serverTimestamp(),
          updatedAt: serverTimestamp(),
        } as any,
        { merge: true }
      );
    });
    await batch.commit();
  },

  async save(settlement: ServiceReferralMonthlySettlement): Promise<void> {
    const id = String(settlement.id || '').trim();
    if (!id) throw new Error('정산 문서 ID가 없습니다.');
    await setDoc(
      doc(db, COLLECTION_NAME, id).withConverter(converter),
      {
        ...settlement,
        createdAt: settlement.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      } as any,
      { merge: true }
    );
  },

  async update(id: string, updates: Partial<ServiceReferralMonthlySettlement>): Promise<void> {
    await updateDoc(doc(db, COLLECTION_NAME, id).withConverter(converter), {
      ...stripUndefinedFields(updates as Record<string, unknown>),
      updatedAt: serverTimestamp(),
    });
  },
};
