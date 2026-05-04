import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  Timestamp,
  where
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { TeamExpenseClaim, TeamExpenseClaimInput } from '../types/teamExpenseLedger';

const COLLECTION_NAME = 'team_expense_claims';

const buildId = () => {
  const c: Crypto | undefined = typeof crypto !== 'undefined' ? crypto : undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `team-expense-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const toTimestamp = (value: unknown) => {
  if (!value) return undefined;
  if (value instanceof Timestamp) return value;
  if (typeof value === 'object' && value && typeof (value as any).toDate === 'function') return value as Timestamp;
  if (typeof value === 'string') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return Timestamp.fromDate(date);
  }
  return undefined;
};

const normalizeAmount = (value: unknown) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/,/g, '').trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const stripUndefined = <T extends Record<string, unknown>>(value: T): Record<string, unknown> =>
  Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));

const normalizeCategory = (value: unknown): TeamExpenseClaim['category'] => {
  const raw = String(value ?? '').trim();
  if (['meal', 'parking', 'fuel', 'toll', 'material', 'tool', 'etc'].includes(raw)) {
    return raw as TeamExpenseClaim['category'];
  }
  return 'etc';
};

const mapClaim = (id: string, data: Record<string, unknown>): TeamExpenseClaim => ({
  id,
  yearMonth: String(data.yearMonth ?? ''),
  date: String(data.date ?? ''),
  claimType: (data.claimType ? String(data.claimType) : (data.chargeToTeamId ? 'teamCharge' : 'otherExpense')) as TeamExpenseClaim['claimType'],
  payerTeamId: String(data.payerTeamId ?? ''),
  payerTeamName: String(data.payerTeamName ?? ''),
  chargeToTeamId: String(data.chargeToTeamId ?? ''),
  chargeToTeamName: String(data.chargeToTeamName ?? ''),
  siteId: data.siteId ? String(data.siteId) : undefined,
  siteName: String(data.siteName ?? ''),
  cardLabel: data.cardLabel ? String(data.cardLabel) : undefined,
  category: normalizeCategory(data.category),
  description: String(data.description ?? ''),
  amount: normalizeAmount(data.amount),
  status: (data.status ? String(data.status) : 'draft') as TeamExpenseClaim['status'],
  memo: data.memo ? String(data.memo) : undefined,
  createdAt: toTimestamp(data.createdAt),
  updatedAt: toTimestamp(data.updatedAt)
});

export const teamExpenseLedgerService = {
  async getClaimsByMonth(yearMonth: string): Promise<TeamExpenseClaim[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('yearMonth', '==', yearMonth)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((row) => mapClaim(row.id, row.data() as Record<string, unknown>))
      .sort((a, b) => String(a.date).localeCompare(String(b.date), 'ko-KR'));
  },

  async saveClaim(input: TeamExpenseClaimInput & { id?: string }): Promise<string> {
    const id = input.id || buildId();
    const now = Timestamp.now();
    const ref = doc(db, COLLECTION_NAME, id);
    const existing = await getDoc(ref);
    await setDoc(
      ref,
      stripUndefined({
        ...input,
        status: input.status ?? 'draft',
        amount: normalizeAmount(input.amount),
        updatedAt: now,
        createdAt: existing.exists() ? existing.data().createdAt ?? now : now
      }),
      { merge: true }
    );
    return id;
  },

  async deleteClaim(id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTION_NAME, id));
  }
};
