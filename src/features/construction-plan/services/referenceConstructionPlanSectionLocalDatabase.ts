import type { ReferenceConstructionPlanSection } from '../domain/referenceConstructionPlanSections';

const DATABASE_NAME = 'cheongyeon-construction-plan';
const DATABASE_VERSION = 1;
const STORE_NAME = 'reference-section-catalogs';
const CATALOG_KEY = 'system-shoring-rev5';

type LocalCatalogRecord = {
  id: string;
  items: ReferenceConstructionPlanSection[];
  updatedAt: string;
};

const openDatabase = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  if (typeof indexedDB === 'undefined') {
    reject(new Error('construction-plan-local-database-unavailable'));
    return;
  }
  const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
  request.onupgradeneeded = () => {
    const database = request.result;
    if (!database.objectStoreNames.contains(STORE_NAME)) {
      database.createObjectStore(STORE_NAME, { keyPath: 'id' });
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error ?? new Error('construction-plan-local-database-open-failed'));
});

export const readReferenceSectionCatalogFromLocalDatabase = async (
): Promise<ReferenceConstructionPlanSection[] | undefined> => {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const request = transaction.objectStore(STORE_NAME).get(CATALOG_KEY);
      request.onsuccess = () => {
        const record = request.result as LocalCatalogRecord | undefined;
        resolve(Array.isArray(record?.items) ? record.items : undefined);
      };
      request.onerror = () => reject(request.error ?? new Error('construction-plan-local-database-read-failed'));
    });
  } finally {
    database.close();
  }
};

export const writeReferenceSectionCatalogToLocalDatabase = async (
  items: readonly ReferenceConstructionPlanSection[],
): Promise<void> => {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put({
        id: CATALOG_KEY,
        items: [...items],
        updatedAt: new Date().toISOString(),
      } satisfies LocalCatalogRecord);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('construction-plan-local-database-write-failed'));
      transaction.onabort = () => reject(transaction.error ?? new Error('construction-plan-local-database-write-aborted'));
    });
  } finally {
    database.close();
  }
};
