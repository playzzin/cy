import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type {
  IncidentCase,
  IncidentCaseCategory,
  IncidentCaseType,
  UpsertIncidentCaseCategoryInput,
  UpsertIncidentCaseInput,
} from '../types/incidentCase';

const CASES_COLLECTION = 'incident_cases';
const CATEGORIES_COLLECTION = 'incident_case_categories';

const asTrimmedString = (value: unknown): string => String(value ?? '').trim();

const asDateString = (value: unknown): string | null => {
  const normalized = asTrimmedString(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
};

const asBirthDate = (value: unknown): string => asTrimmedString(value).slice(0, 20);

const asCaseType = (value: unknown): IncidentCaseType => (
  value === 'accident' ? 'accident' : 'incident'
);

const mapCase = (id: string, data: DocumentData): IncidentCase => ({
  id,
  caseNumber: asTrimmedString(data.caseNumber),
  personName: asTrimmedString(data.personName),
  birthDate: asBirthDate(data.birthDate),
  title: asTrimmedString(data.title),
  caseType: asCaseType(data.caseType),
  categoryId: asTrimmedString(data.categoryId),
  incidentDate: asDateString(data.incidentDate),
  record: asTrimmedString(data.record),
  createdByUid: asTrimmedString(data.createdByUid),
  updatedByUid: asTrimmedString(data.updatedByUid),
  createdAt: data.createdAt || null,
  updatedAt: data.updatedAt || null,
});

const mapCategory = (id: string, data: DocumentData): IncidentCaseCategory => ({
  id,
  name: asTrimmedString(data.name),
  color: /^#[0-9a-fA-F]{6}$/.test(asTrimmedString(data.color)) ? data.color : '#475569',
  active: data.active !== false,
  createdAt: data.createdAt || null,
  updatedAt: data.updatedAt || null,
});

const recordNumber = (): string => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `CASE-${date}-${suffix}`;
};

const buildRecordPayload = (input: UpsertIncidentCaseInput, actorUid: string) => ({
  personName: asTrimmedString(input.personName).slice(0, 40),
  birthDate: asBirthDate(input.birthDate),
  title: asTrimmedString(input.title).slice(0, 120),
  caseType: asCaseType(input.caseType),
  categoryId: asTrimmedString(input.categoryId),
  incidentDate: asDateString(input.incidentDate),
  record: asTrimmedString(input.record).slice(0, 3000),
  updatedByUid: asTrimmedString(actorUid),
  updatedAt: serverTimestamp(),
});

const ensureRecordPayload = (payload: ReturnType<typeof buildRecordPayload>): void => {
  if (!payload.personName || !payload.birthDate || !payload.title || !payload.categoryId || !payload.record) {
    throw new Error('이름, 생년월일, 제목, 카테고리, 기록은 모두 입력해야 합니다.');
  }
};

export const incidentCaseService = {
  subscribeCases(
    onData: (cases: IncidentCase[]) => void,
    onError?: (error: Error) => void,
  ): Unsubscribe {
    return onSnapshot(
      query(collection(db, CASES_COLLECTION), orderBy('updatedAt', 'desc')),
      (snapshot) => onData(snapshot.docs.map((item) => mapCase(item.id, item.data()))),
      (error) => onError?.(error),
    );
  },

  subscribeCategories(
    onData: (categories: IncidentCaseCategory[]) => void,
    onError?: (error: Error) => void,
  ): Unsubscribe {
    return onSnapshot(
      query(collection(db, CATEGORIES_COLLECTION), orderBy('name', 'asc')),
      (snapshot) => onData(snapshot.docs.map((item) => mapCategory(item.id, item.data()))),
      (error) => onError?.(error),
    );
  },

  async createCase(input: UpsertIncidentCaseInput, actorUid: string): Promise<string> {
    const payload = buildRecordPayload(input, actorUid);
    ensureRecordPayload(payload);
    const document = await addDoc(collection(db, CASES_COLLECTION), {
      ...payload,
      caseNumber: recordNumber(),
      createdByUid: asTrimmedString(actorUid),
      createdAt: serverTimestamp(),
    });
    return document.id;
  },

  async createCases(inputs: UpsertIncidentCaseInput[], actorUid: string): Promise<number> {
    if (inputs.length === 0) return 0;
    if (inputs.length > 200) throw new Error('한 번에 최대 200건까지 등록할 수 있습니다.');

    const normalizedActorUid = asTrimmedString(actorUid);
    const batch = writeBatch(db);
    inputs.forEach((input) => {
      const payload = buildRecordPayload(input, normalizedActorUid);
      ensureRecordPayload(payload);
      batch.set(doc(collection(db, CASES_COLLECTION)), {
        ...payload,
        caseNumber: recordNumber(),
        createdByUid: normalizedActorUid,
        createdAt: serverTimestamp(),
      });
    });
    await batch.commit();
    return inputs.length;
  },

  async updateCase(id: string, input: UpsertIncidentCaseInput, actorUid: string): Promise<void> {
    const payload = buildRecordPayload(input, actorUid);
    ensureRecordPayload(payload);
    await updateDoc(doc(db, CASES_COLLECTION, id), payload);
  },

  async deleteCase(id: string): Promise<void> {
    await deleteDoc(doc(db, CASES_COLLECTION, id));
  },

  async createCategory(input: UpsertIncidentCaseCategoryInput): Promise<string> {
    const name = asTrimmedString(input.name).slice(0, 40);
    if (!name) throw new Error('카테고리 이름을 입력하세요.');
    const categoryRef = doc(collection(db, CATEGORIES_COLLECTION));
    await setDoc(categoryRef, {
      name,
      color: /^#[0-9a-fA-F]{6}$/.test(input.color) ? input.color : '#475569',
      active: input.active !== false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return categoryRef.id;
  },

  async updateCategory(id: string, input: UpsertIncidentCaseCategoryInput): Promise<void> {
    const name = asTrimmedString(input.name).slice(0, 40);
    if (!name) throw new Error('카테고리 이름을 입력하세요.');
    await updateDoc(doc(db, CATEGORIES_COLLECTION, id), {
      name,
      color: /^#[0-9a-fA-F]{6}$/.test(input.color) ? input.color : '#475569',
      active: input.active !== false,
      updatedAt: serverTimestamp(),
    });
  },

  async deleteCategory(id: string): Promise<void> {
    await deleteDoc(doc(db, CATEGORIES_COLLECTION, id));
  },
};
