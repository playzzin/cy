import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { stripUndefinedFields } from '../utils/stripUndefinedFields';

const COLLECTION_NAME = 'client_site_labor_adjustments';

export type ClientSiteLaborProcessStatus = 'draft' | 'review' | 'confirmed' | 'paid';

export interface ClientSiteLaborAdjustment {
  id: string;
  yearMonth: string;
  reportId: string;
  workerIndex?: number;
  workerId: string;
  workerName: string;
  siteId: string;
  siteName: string;
  constructionCompanyName?: string;
  clientCompanyName?: string;
  allowance: number;
  deduction: number;
  status: ClientSiteLaborProcessStatus;
  memo: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type ClientSiteLaborAdjustmentInput = Omit<ClientSiteLaborAdjustment, 'id' | 'createdAt' | 'updatedAt'> & {
  id?: string;
};

const encodeIdPart = (value: unknown): string =>
  encodeURIComponent(String(value ?? '').trim() || 'none').replace(/\./g, '%2E');

export const buildClientSiteLaborAdjustmentId = (params: {
  yearMonth: string;
  reportId: string;
  workerIndex?: number;
  workerId: string;
}): string => [
  'client-site-labor',
  params.yearMonth,
  params.reportId,
  typeof params.workerIndex === 'number' ? params.workerIndex : 'no-index',
  params.workerId,
].map(encodeIdPart).join('__');

const toNumber = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
};

const normalizeStatus = (value: unknown): ClientSiteLaborProcessStatus => {
  if (value === 'review' || value === 'confirmed' || value === 'paid') return value;
  return 'draft';
};

const normalizeAdjustment = (id: string, data: Record<string, unknown>): ClientSiteLaborAdjustment => ({
  id,
  yearMonth: String(data.yearMonth ?? ''),
  reportId: String(data.reportId ?? ''),
  workerIndex: typeof data.workerIndex === 'number' ? data.workerIndex : undefined,
  workerId: String(data.workerId ?? ''),
  workerName: String(data.workerName ?? ''),
  siteId: String(data.siteId ?? ''),
  siteName: String(data.siteName ?? ''),
  constructionCompanyName: data.constructionCompanyName ? String(data.constructionCompanyName) : undefined,
  clientCompanyName: data.clientCompanyName ? String(data.clientCompanyName) : undefined,
  allowance: toNumber(data.allowance),
  deduction: toNumber(data.deduction),
  status: normalizeStatus(data.status),
  memo: String(data.memo ?? ''),
  createdAt: data.createdAt,
  updatedAt: data.updatedAt,
});

export const clientSiteLaborAdjustmentService = {
  async getAdjustmentsByYearMonth(yearMonth: string): Promise<ClientSiteLaborAdjustment[]> {
    const snapshot = await getDocs(query(
      collection(db, COLLECTION_NAME),
      where('yearMonth', '==', yearMonth)
    ));
    return snapshot.docs.map((row) => normalizeAdjustment(row.id, row.data()));
  },

  async saveAdjustment(input: ClientSiteLaborAdjustmentInput): Promise<ClientSiteLaborAdjustment> {
    const id = input.id || buildClientSiteLaborAdjustmentId(input);
    const payload = stripUndefinedFields({
      yearMonth: input.yearMonth,
      reportId: input.reportId,
      workerIndex: input.workerIndex,
      workerId: input.workerId,
      workerName: input.workerName,
      siteId: input.siteId,
      siteName: input.siteName,
      constructionCompanyName: input.constructionCompanyName,
      clientCompanyName: input.clientCompanyName,
      allowance: toNumber(input.allowance),
      deduction: toNumber(input.deduction),
      status: normalizeStatus(input.status),
      memo: String(input.memo ?? '').trim(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await setDoc(doc(db, COLLECTION_NAME, id), payload, { merge: true });
    return normalizeAdjustment(id, payload);
  },

  async deleteAdjustment(id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTION_NAME, id));
  },
};
