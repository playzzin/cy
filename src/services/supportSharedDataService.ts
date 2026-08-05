import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';

export type SupportSharedDataKey = 'engine_oil_cycle' | 'team_equipment_inventory';

const COLLECTION_NAME = 'support_shared_data';

interface SupportSharedDataDocument<T> {
  data?: T;
}

const load = async <T>(key: SupportSharedDataKey): Promise<T | null> => {
  const snapshot = await getDoc(doc(db, COLLECTION_NAME, key));
  if (!snapshot.exists()) return null;

  const data = (snapshot.data() as SupportSharedDataDocument<T>).data;
  return data == null ? null : data;
};

const save = async <T>(key: SupportSharedDataKey, data: T): Promise<void> => {
  const currentUser = auth.currentUser;
  await setDoc(
    doc(db, COLLECTION_NAME, key),
    {
      data,
      schemaVersion: 1,
      updatedAt: serverTimestamp(),
      updatedByUid: currentUser?.uid ?? null,
      updatedByName: currentUser?.displayName || currentUser?.email || null,
    },
    { merge: true }
  );
};

export const supportSharedDataService = {
  load,
  save,
};
