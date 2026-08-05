import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  type DocumentData,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { createRepositoryCache } from '../utils/repositoryCache';

export interface FirestoreRepositoryOptions<T> {
  collectionName: string;
  cacheTtlMs?: number;
  mapDoc?: (snapshot: QueryDocumentSnapshot<DocumentData>) => T;
}

export interface FirestoreListOptions {
  cacheKey?: string;
  useCache?: boolean;
}

const DEFAULT_CACHE_TTL_MS = 30 * 1000;

const mapDocumentWithId = <T>(snapshot: QueryDocumentSnapshot<DocumentData>): T => ({
  id: snapshot.id,
  ...snapshot.data(),
} as T);

export const createCollectionRepository = <T extends Record<string, any>>({
  collectionName,
  cacheTtlMs = DEFAULT_CACHE_TTL_MS,
  mapDoc = mapDocumentWithId<T>,
}: FirestoreRepositoryOptions<T>) => {
  const cache = createRepositoryCache<T[] | T | null>({ ttlMs: cacheTtlMs });

  const getCollectionRef = () => collection(db, collectionName);
  const buildCollectionQuery = (constraints: QueryConstraint[] = []) => {
    const collectionRef = getCollectionRef();
    return constraints.length > 0 ? query(collectionRef, ...constraints) : collectionRef;
  };

  const list = async (
    constraints: QueryConstraint[] = [],
    options: FirestoreListOptions = {}
  ): Promise<T[]> => {
    const load = async () => {
      const snapshot = await getDocs(buildCollectionQuery(constraints));
      return snapshot.docs.map((document) => mapDoc(document));
    };

    if (options.useCache === false || !options.cacheKey) return load();
    return cache.getOrSet(`list:${options.cacheKey}`, load) as Promise<T[]>;
  };

  const getById = async (id: string, useCache = true): Promise<T | null> => {
    const load = async () => {
      const snapshot = await getDoc(doc(db, collectionName, id));
      return snapshot.exists() ? mapDoc(snapshot as QueryDocumentSnapshot<DocumentData>) : null;
    };

    if (!useCache) return load();
    return cache.getOrSet(`doc:${id}`, load) as Promise<T | null>;
  };

  const subscribe = (
    callback: (rows: T[]) => void,
    constraints: QueryConstraint[] = []
  ): Unsubscribe => onSnapshot(buildCollectionQuery(constraints), (snapshot) => {
    cache.clear();
    callback(snapshot.docs.map((document) => mapDoc(document)));
  });

  return {
    collectionName,
    clearCache: (key?: string) => cache.clear(key),
    getCollectionRef,
    list,
    getById,
    subscribe,
  };
};
