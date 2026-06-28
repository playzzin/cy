import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { createConverter } from '../utils/firestoreConverter';
import { stripUndefinedFields } from '../utils/stripUndefinedFields';
import { RecruitingReferrerSchema } from '../types/zod/recruitingSchema';
import type { RecruitingReferrer } from '../types/recruiting';

const COLLECTION_NAME = 'recruiting_referrers';
const converter = createConverter(RecruitingReferrerSchema);

export const recruitingReferrerRepository = {
  getCollection() {
    return collection(db, COLLECTION_NAME).withConverter(converter);
  },

  async list(): Promise<RecruitingReferrer[]> {
    const q = query(this.getCollection(), orderBy('name', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((entry) => entry.data() as RecruitingReferrer);
  },

  async listActive(): Promise<RecruitingReferrer[]> {
    const q = query(this.getCollection(), where('status', '==', 'active'), orderBy('name', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((entry) => entry.data() as RecruitingReferrer);
  },

  async get(id: string): Promise<RecruitingReferrer | null> {
    const snapshot = await getDoc(doc(db, COLLECTION_NAME, id).withConverter(converter));
    return snapshot.exists() ? snapshot.data() as RecruitingReferrer : null;
  },

  async create(input: Omit<RecruitingReferrer, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const docRef = doc(collection(db, COLLECTION_NAME)).withConverter(converter);
    await setDoc(docRef, {
      ...input,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    } as any);
    return docRef.id;
  },

  async update(id: string, updates: Partial<RecruitingReferrer>): Promise<void> {
    await updateDoc(doc(db, COLLECTION_NAME, id).withConverter(converter), {
      ...stripUndefinedFields(updates as Record<string, unknown>),
      updatedAt: serverTimestamp(),
    });
  },

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTION_NAME, id));
  },
};
