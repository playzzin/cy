import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { OfficeFixedExpense, OfficeFixedExpenseInput } from '../types/officeFixedExpense';

const COLLECTION_NAME = 'office_fixed_expenses';

const buildId = () => {
  const c: Crypto | undefined = typeof crypto !== 'undefined' ? crypto : undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `office-fixed-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const normalizeAmount = (value: unknown) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/,/g, '').trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const normalizeDayOfMonth = (value: unknown) => {
  const parsed = Math.trunc(Number(value));
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(31, Math.max(1, parsed));
};

const normalizeYearMonth = (value: unknown) => {
  const raw = String(value ?? '').trim().slice(0, 7);
  return /^\d{4}-\d{2}$/.test(raw) ? raw : '';
};

const stripUndefined = <T extends Record<string, unknown>>(value: T): Record<string, unknown> =>
  Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));

const mapExpense = (id: string, data: Record<string, unknown>): OfficeFixedExpense => ({
  id,
  name: String(data.name ?? '').trim(),
  category: String(data.category ?? 'officeExpense'),
  amount: normalizeAmount(data.amount),
  dayOfMonth: normalizeDayOfMonth(data.dayOfMonth),
  startYearMonth: normalizeYearMonth(data.startYearMonth),
  endYearMonth: normalizeYearMonth(data.endYearMonth) || undefined,
  isActive: data.isActive !== false,
  memo: data.memo ? String(data.memo) : undefined,
  createdAt: data.createdAt,
  updatedAt: data.updatedAt
});

const sortExpenses = (rows: OfficeFixedExpense[]) =>
  rows.slice().sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    if (a.dayOfMonth !== b.dayOfMonth) return a.dayOfMonth - b.dayOfMonth;
    return a.name.localeCompare(b.name, 'ko-KR');
  });

export const officeFixedExpenseService = {
  async getExpenses(params: { includeInactive?: boolean } = {}): Promise<OfficeFixedExpense[]> {
    const snap = await getDocs(query(collection(db, COLLECTION_NAME)));
    const rows = snap.docs
      .map((row) => mapExpense(row.id, row.data() as Record<string, unknown>))
      .filter((row) => params.includeInactive || row.isActive);

    return sortExpenses(rows);
  },

  async saveExpense(input: OfficeFixedExpenseInput & { id?: string }): Promise<string> {
    const id = String(input.id ?? '').trim() || buildId();
    const now = Timestamp.now();
    const ref = doc(db, COLLECTION_NAME, id);
    const existing = await getDoc(ref);

    await setDoc(
      ref,
      stripUndefined({
        name: String(input.name ?? '').trim(),
        category: String(input.category ?? 'officeExpense').trim() || 'officeExpense',
        amount: normalizeAmount(input.amount),
        dayOfMonth: normalizeDayOfMonth(input.dayOfMonth),
        startYearMonth: normalizeYearMonth(input.startYearMonth),
        endYearMonth: normalizeYearMonth(input.endYearMonth) || undefined,
        isActive: input.isActive !== false,
        memo: String(input.memo ?? '').trim() || undefined,
        updatedAt: now,
        createdAt: existing.exists() ? existing.data().createdAt ?? now : now
      }),
      { merge: true }
    );

    return id;
  },

  async setExpenseActive(id: string, isActive: boolean): Promise<void> {
    const safeId = String(id ?? '').trim();
    if (!safeId) return;
    await setDoc(
      doc(db, COLLECTION_NAME, safeId),
      {
        isActive,
        updatedAt: Timestamp.now()
      },
      { merge: true }
    );
  },

  async deleteExpense(id: string): Promise<void> {
    await officeFixedExpenseService.setExpenseActive(id, false);
  }
};
