import {
  collection,
  doc,
  getDocs,
  query,
  setDoc,
  Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { TeamExpenseCategory, TeamExpenseCategoryScope } from '../types/teamExpenseLedger';

const COLLECTION_NAME = 'team_expense_categories';

export const DEFAULT_TEAM_EXPENSE_CATEGORIES: TeamExpenseCategory[] = [
  { id: 'meal', label: '식대', scope: 'teamCharge', order: 10, isActive: true, isDefault: true },
  { id: 'parking', label: '주차비', scope: 'teamCharge', order: 20, isActive: true, isDefault: true },
  { id: 'toll', label: '통행료', scope: 'teamCharge', order: 30, isActive: true, isDefault: true },
  { id: 'fieldGoods', label: '현장물품', scope: 'both', order: 40, isActive: true, isDefault: true },
  { id: 'deposit', label: '보증금', scope: 'otherExpense', order: 110, isActive: true, isDefault: true },
  { id: 'marking', label: '마이킹', scope: 'otherExpense', order: 120, isActive: true, isDefault: true },
  { id: 'equipment', label: '장비비', scope: 'otherExpense', order: 130, isActive: true, isDefault: true },
  { id: 'officeExpense', label: '사무실경비', scope: 'officeExpense', order: 140, isActive: true, isDefault: true },
  { id: 'etc', label: '기타', scope: 'both', order: 900, isActive: true, isDefault: true },
  { id: 'fuel', label: '유류비', scope: 'teamCharge', order: 1000, isActive: false, isDefault: true },
  { id: 'material', label: '자재비', scope: 'teamCharge', order: 1010, isActive: false, isDefault: true },
  { id: 'tool', label: '공구비', scope: 'teamCharge', order: 1020, isActive: false, isDefault: true }
];

const normalizeScope = (value: unknown): TeamExpenseCategoryScope => {
  const raw = String(value ?? '').trim();
  if (raw === 'teamCharge' || raw === 'otherExpense' || raw === 'officeExpense' || raw === 'both') return raw;
  return 'teamCharge';
};

const normalizeBoolean = (value: unknown, fallback: boolean) => {
  if (typeof value === 'boolean') return value;
  return fallback;
};

const buildCustomCategoryId = () => `custom_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;

const mapCategory = (id: string, data: Record<string, unknown>, fallback?: TeamExpenseCategory): TeamExpenseCategory => ({
  id,
  label: String(data.label ?? fallback?.label ?? id).trim() || fallback?.label || id,
  scope: normalizeScope(data.scope ?? fallback?.scope),
  order: Number.isFinite(Number(data.order ?? fallback?.order)) ? Number(data.order ?? fallback?.order) : 999,
  isActive: normalizeBoolean(data.isActive, fallback?.isActive ?? true),
  isDefault: normalizeBoolean(data.isDefault, fallback?.isDefault ?? false),
  createdAt: data.createdAt ?? fallback?.createdAt,
  updatedAt: data.updatedAt ?? fallback?.updatedAt
});

const sortCategories = (rows: TeamExpenseCategory[]) =>
  rows.slice().sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a.label.localeCompare(b.label, 'ko-KR');
  });

export const teamExpenseCategoryService = {
  async getCategories(params: { includeInactive?: boolean } = {}): Promise<TeamExpenseCategory[]> {
    const snap = await getDocs(query(collection(db, COLLECTION_NAME)));
    const saved = new Map<string, TeamExpenseCategory>();

    snap.docs.forEach((row) => {
      saved.set(row.id, mapCategory(row.id, row.data() as Record<string, unknown>));
    });

    const merged = new Map<string, TeamExpenseCategory>();
    DEFAULT_TEAM_EXPENSE_CATEGORIES.forEach((fallback) => {
      const override = saved.get(fallback.id);
      merged.set(fallback.id, override ? mapCategory(fallback.id, override as unknown as Record<string, unknown>, fallback) : fallback);
      saved.delete(fallback.id);
    });
    saved.forEach((category, id) => merged.set(id, category));

    const rows = Array.from(merged.values());
    return sortCategories(params.includeInactive ? rows : rows.filter((category) => category.isActive));
  },

  async saveCategory(input: {
    id?: string;
    label: string;
    scope: TeamExpenseCategoryScope;
    order?: number;
  }): Promise<string> {
    const label = String(input.label ?? '').trim();
    if (!label) throw new Error('category-label-required');

    const id = String(input.id ?? '').trim() || buildCustomCategoryId();
    const ref = doc(db, COLLECTION_NAME, id);
    const now = Timestamp.now();

    await setDoc(
      ref,
      {
        label,
        scope: normalizeScope(input.scope),
        order: Number.isFinite(Number(input.order)) ? Number(input.order) : Date.now(),
        isActive: true,
        isDefault: DEFAULT_TEAM_EXPENSE_CATEGORIES.some((category) => category.id === id),
        updatedAt: now,
        createdAt: now
      },
      { merge: true }
    );

    return id;
  },

  async deleteCategory(id: string): Promise<void> {
    const safeId = String(id ?? '').trim();
    if (!safeId) return;
    await setDoc(
      doc(db, COLLECTION_NAME, safeId),
      {
        isActive: false,
        updatedAt: Timestamp.now()
      },
      { merge: true }
    );
  }
};
