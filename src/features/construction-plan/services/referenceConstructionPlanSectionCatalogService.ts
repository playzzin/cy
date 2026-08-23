import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { auth, db } from '../../../config/firebase';
import {
  normalizeReferenceSectionCatalog,
  REFERENCE_CONSTRUCTION_PLAN_SECTIONS,
  type ReferenceConstructionPlanSection,
} from '../domain/referenceConstructionPlanSections';
import {
  readReferenceSectionCatalogFromLocalDatabase,
  writeReferenceSectionCatalogToLocalDatabase,
} from './referenceConstructionPlanSectionLocalDatabase';

// Reuse the ERP's existing settings collection so the catalog works with the
// already-deployed settings ACL and does not require a Functions deployment.
export const REFERENCE_CONSTRUCTION_PLAN_CATALOG_COLLECTION = 'settings';
export const REFERENCE_CONSTRUCTION_PLAN_CATALOG_ID =
  'construction_plan_reference_catalog_system_shoring_rev5';

type CatalogDocument = {
  templateKey: 'system-shoring-rev5';
  version: 1;
  items: ReferenceConstructionPlanSection[];
};

export type ReferenceSectionCatalogLoadResult = {
  sections: ReferenceConstructionPlanSection[];
  source: 'database' | 'seeded' | 'local';
};

const reference = () => doc(
  db,
  REFERENCE_CONSTRUCTION_PLAN_CATALOG_COLLECTION,
  REFERENCE_CONSTRUCTION_PLAN_CATALOG_ID,
);

const payload = (sections: readonly ReferenceConstructionPlanSection[]): CatalogDocument => ({
  templateKey: 'system-shoring-rev5',
  version: 1,
  items: normalizeReferenceSectionCatalog(sections),
});

const requireValidCatalog = (
  sections: readonly ReferenceConstructionPlanSection[],
): ReferenceConstructionPlanSection[] => {
  const normalized = normalizeReferenceSectionCatalog(sections);
  if (normalized.length === 0) {
    throw new Error('construction-plan-section-catalog-empty');
  }
  if (normalized.length > 100) {
    throw new Error('construction-plan-section-catalog-too-large');
  }
  return normalized;
};

export const loadReferenceConstructionPlanSectionCatalog = async (
): Promise<ReferenceSectionCatalogLoadResult> => {
  try {
    const snapshot = await getDoc(reference());
    if (snapshot.exists()) {
      const data = snapshot.data() as Partial<CatalogDocument>;
      const sections = requireValidCatalog(Array.isArray(data.items) ? data.items : []);
      await writeReferenceSectionCatalogToLocalDatabase(sections);
      return { sections, source: 'database' };
    }

    const sections = requireValidCatalog(REFERENCE_CONSTRUCTION_PLAN_SECTIONS);
    await setDoc(reference(), {
      ...payload(sections),
      createdAt: serverTimestamp(),
      createdBy: auth.currentUser?.uid ?? '',
      updatedAt: serverTimestamp(),
      updatedBy: auth.currentUser?.uid ?? '',
    });
    await writeReferenceSectionCatalogToLocalDatabase(sections);
    return { sections, source: 'seeded' };
  } catch (cloudError) {
    try {
      const cached = await readReferenceSectionCatalogFromLocalDatabase();
      const sections = requireValidCatalog(cached ?? REFERENCE_CONSTRUCTION_PLAN_SECTIONS);
      if (!cached) await writeReferenceSectionCatalogToLocalDatabase(sections);
      return { sections, source: 'local' };
    } catch (localError) {
      throw new AggregateError([cloudError, localError], 'construction-plan-section-catalog-storage-unavailable');
    }
  }
};

export type ReferenceSectionCatalogSaveResult = {
  sections: ReferenceConstructionPlanSection[];
  source: 'database' | 'local';
};

export const saveReferenceConstructionPlanSectionCatalog = async (
  sections: readonly ReferenceConstructionPlanSection[],
): Promise<ReferenceSectionCatalogSaveResult> => {
  const normalized = requireValidCatalog(sections);
  await writeReferenceSectionCatalogToLocalDatabase(normalized);
  try {
    await setDoc(reference(), {
      ...payload(normalized),
      updatedAt: serverTimestamp(),
      updatedBy: auth.currentUser?.uid ?? '',
    }, { merge: true });
    return { sections: normalized, source: 'database' };
  } catch (_cloudError) {
    return { sections: normalized, source: 'local' };
  }
};

export const getReferenceSectionCatalogErrorMessage = (error: unknown): string => {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code ?? '')
    : '';
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (code.includes('permission-denied') || message.includes('permission-denied')) {
    return '목차 데이터베이스 권한이 없습니다. 관리자 또는 사무실 계정으로 다시 시도해주세요.';
  }
  if (message.includes('empty')) return '목차는 최소 1개 이상 유지해야 합니다.';
  if (message.includes('too-large')) return '목차는 최대 100개까지 등록할 수 있습니다.';
  return '목차 데이터베이스에 연결하지 못했습니다. 네트워크 상태를 확인하고 다시 시도해주세요.';
};
