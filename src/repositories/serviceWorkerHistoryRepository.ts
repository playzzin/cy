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
import { ServiceWorkerHistorySchema } from '../types/zod/recruitingSchema';
import type { ServiceWorkerHistory } from '../types/recruiting';

const COLLECTION_NAME = 'service_worker_history';
const converter = createConverter(ServiceWorkerHistorySchema);
const WRITE_BATCH_LIMIT = 450;

export interface ServiceWorkerHistoryFilters {
  workerId?: string;
  eventType?: string;
  startDate?: string;
  endDate?: string;
}

export const serviceWorkerHistoryRepository = {
  getCollection() {
    return collection(db, COLLECTION_NAME).withConverter(converter);
  },

  async list(filters: ServiceWorkerHistoryFilters = {}): Promise<ServiceWorkerHistory[]> {
    const constraints: QueryConstraint[] = [];
    if (filters.workerId) constraints.push(where('workerId', '==', filters.workerId));
    if (filters.eventType) constraints.push(where('eventType', '==', filters.eventType));
    if (filters.startDate) constraints.push(where('eventDate', '>=', filters.startDate));
    if (filters.endDate) constraints.push(where('eventDate', '<=', filters.endDate));
    constraints.push(orderBy('eventDate', 'desc'));

    const snapshot = await getDocs(query(this.getCollection(), ...constraints));
    return snapshot.docs.map((entry) => entry.data() as ServiceWorkerHistory);
  },

  async listByWorker(workerId: string): Promise<ServiceWorkerHistory[]> {
    const q = query(this.getCollection(), where('workerId', '==', workerId), orderBy('eventDate', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((entry) => entry.data() as ServiceWorkerHistory);
  },

  async get(id: string): Promise<ServiceWorkerHistory | null> {
    const snapshot = await getDoc(doc(db, COLLECTION_NAME, id).withConverter(converter));
    return snapshot.exists() ? snapshot.data() as ServiceWorkerHistory : null;
  },

  async create(input: Omit<ServiceWorkerHistory, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const docRef = doc(collection(db, COLLECTION_NAME)).withConverter(converter);
    await setDoc(docRef, {
      ...input,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    } as any);
    return docRef.id;
  },

  async saveMany(rows: ServiceWorkerHistory[]): Promise<void> {
    if (rows.length === 0) return;
    for (let offset = 0; offset < rows.length; offset += WRITE_BATCH_LIMIT) {
      const batch = writeBatch(db);
      rows.slice(offset, offset + WRITE_BATCH_LIMIT).forEach((row) => {
        const docRef = row.id
          ? doc(db, COLLECTION_NAME, row.id).withConverter(converter)
          : doc(collection(db, COLLECTION_NAME)).withConverter(converter);
        batch.set(
          docRef,
          {
            ...row,
            createdAt: row.createdAt || serverTimestamp(),
            updatedAt: serverTimestamp(),
          } as any,
          { merge: true }
        );
      });
      await batch.commit();
    }
  },

  async update(id: string, updates: Partial<ServiceWorkerHistory>): Promise<void> {
    await updateDoc(doc(db, COLLECTION_NAME, id).withConverter(converter), {
      ...stripUndefinedFields(updates as Record<string, unknown>),
      updatedAt: serverTimestamp(),
    });
  },
};
