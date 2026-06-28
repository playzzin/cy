import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
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
import {
  ServiceReferralDailyLineSchema,
  ServiceReferralSettingsSchema,
  ServiceWorkerReferralSchema,
} from '../types/zod/recruitingSchema';
import type {
  ServiceReferralDailyLine,
  ServiceReferralSettings,
  ServiceWorkerReferral,
} from '../types/recruiting';

const REFERRALS_COLLECTION = 'service_worker_referrals';
const DAILY_LINES_COLLECTION = 'service_referral_daily_lines';
const SETTINGS_COLLECTION = 'service_referral_settings';
const DEFAULT_SETTINGS_DOC_ID = 'default';
const WRITE_BATCH_LIMIT = 450;

const referralConverter = createConverter(ServiceWorkerReferralSchema);
const dailyLineConverter = createConverter(ServiceReferralDailyLineSchema);
const settingsConverter = createConverter(ServiceReferralSettingsSchema);

export const serviceWorkerReferralRepository = {
  getReferralCollection() {
    return collection(db, REFERRALS_COLLECTION).withConverter(referralConverter);
  },

  getDailyLineCollection() {
    return collection(db, DAILY_LINES_COLLECTION).withConverter(dailyLineConverter);
  },

  getSettingsCollection() {
    return collection(db, SETTINGS_COLLECTION).withConverter(settingsConverter);
  },

  async listReferrals(): Promise<ServiceWorkerReferral[]> {
    const q = query(this.getReferralCollection(), orderBy('startDate', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((entry) => entry.data() as ServiceWorkerReferral);
  },

  async listReferralsByReferrer(referrerId: string): Promise<ServiceWorkerReferral[]> {
    const q = query(
      this.getReferralCollection(),
      where('referrerId', '==', referrerId),
      orderBy('startDate', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((entry) => entry.data() as ServiceWorkerReferral);
  },

  async getReferral(id: string): Promise<ServiceWorkerReferral | null> {
    const snapshot = await getDoc(doc(db, REFERRALS_COLLECTION, id).withConverter(referralConverter));
    return snapshot.exists() ? snapshot.data() as ServiceWorkerReferral : null;
  },

  async getLatestReferralByWorker(workerId: string): Promise<ServiceWorkerReferral | null> {
    const q = query(
      this.getReferralCollection(),
      where('workerId', '==', workerId),
      orderBy('startDate', 'desc'),
      limit(1)
    );
    const snapshot = await getDocs(q);
    return snapshot.empty ? null : snapshot.docs[0].data() as ServiceWorkerReferral;
  },

  async createReferral(input: Omit<ServiceWorkerReferral, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const docRef = doc(collection(db, REFERRALS_COLLECTION)).withConverter(referralConverter);
    await setDoc(docRef, {
      ...input,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    } as any);
    return docRef.id;
  },

  async updateReferral(id: string, updates: Partial<ServiceWorkerReferral>): Promise<void> {
    await updateDoc(doc(db, REFERRALS_COLLECTION, id).withConverter(referralConverter), {
      ...stripUndefinedFields(updates as Record<string, unknown>),
      updatedAt: serverTimestamp(),
    });
  },

  async listDailyLinesByMonth(yearMonth: string): Promise<ServiceReferralDailyLine[]> {
    const q = query(this.getDailyLineCollection(), where('yearMonth', '==', yearMonth), orderBy('date', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((entry) => entry.data() as ServiceReferralDailyLine);
  },

  async listDailyLinesByMonthAndReferrer(yearMonth: string, referrerId: string): Promise<ServiceReferralDailyLine[]> {
    const q = query(
      this.getDailyLineCollection(),
      where('yearMonth', '==', yearMonth),
      where('referrerId', '==', referrerId),
      orderBy('date', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((entry) => entry.data() as ServiceReferralDailyLine);
  },

  async listDailyLinesByWorker(workerId: string): Promise<ServiceReferralDailyLine[]> {
    const q = query(this.getDailyLineCollection(), where('workerId', '==', workerId), orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((entry) => entry.data() as ServiceReferralDailyLine);
  },

  async saveDailyLines(lines: ServiceReferralDailyLine[]): Promise<void> {
    if (lines.length === 0) return;
    for (let offset = 0; offset < lines.length; offset += WRITE_BATCH_LIMIT) {
      const batch = writeBatch(db);
      lines.slice(offset, offset + WRITE_BATCH_LIMIT).forEach((line) => {
        const id = String(line.id || '').trim();
        if (!id) return;
        batch.set(
          doc(db, DAILY_LINES_COLLECTION, id).withConverter(dailyLineConverter),
          {
            ...line,
            updatedAt: serverTimestamp(),
            createdAt: line.createdAt || serverTimestamp(),
          } as any,
          { merge: true }
        );
      });
      await batch.commit();
    }
  },

  async updateDailyLine(id: string, updates: Partial<ServiceReferralDailyLine>): Promise<void> {
    await updateDoc(doc(db, DAILY_LINES_COLLECTION, id).withConverter(dailyLineConverter), {
      ...stripUndefinedFields(updates as Record<string, unknown>),
      updatedAt: serverTimestamp(),
    });
  },

  async getSettings(): Promise<ServiceReferralSettings | null> {
    const snapshot = await getDoc(doc(db, SETTINGS_COLLECTION, DEFAULT_SETTINGS_DOC_ID).withConverter(settingsConverter));
    return snapshot.exists() ? snapshot.data() as ServiceReferralSettings : null;
  },

  async saveSettings(settings: ServiceReferralSettings): Promise<void> {
    await setDoc(
      doc(db, SETTINGS_COLLECTION, DEFAULT_SETTINGS_DOC_ID).withConverter(settingsConverter),
      {
        ...settings,
        id: DEFAULT_SETTINGS_DOC_ID,
        updatedAt: serverTimestamp(),
      } as any,
      { merge: true }
    );
  },
};
