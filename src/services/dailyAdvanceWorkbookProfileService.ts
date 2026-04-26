import { collection, doc, getDocs, Timestamp, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';
import { stripUndefinedFields } from '../utils/stripUndefinedFields';

export interface DailyAdvanceWorkbookProfile {
  workerId: string;
  claimUnitPrice?: number;
  recruiterFee?: number;
  memo?: string;
  updatedAt?: any;
}

const COLLECTION_NAME = 'daily_advance_workbook_profiles';

export const dailyAdvanceWorkbookProfileService = {
  getProfiles: async (): Promise<DailyAdvanceWorkbookProfile[]> => {
    const snapshot = await getDocs(collection(db, COLLECTION_NAME));
    return snapshot.docs.map((entry) => {
      const data = entry.data() as DailyAdvanceWorkbookProfile;
      return {
        workerId: String(data.workerId || entry.id),
        claimUnitPrice: typeof data.claimUnitPrice === 'number' ? data.claimUnitPrice : undefined,
        recruiterFee: typeof data.recruiterFee === 'number' ? data.recruiterFee : undefined,
        memo: typeof data.memo === 'string' ? data.memo : undefined,
        updatedAt: data.updatedAt
      };
    });
  },

  saveProfiles: async (profiles: DailyAdvanceWorkbookProfile[]): Promise<void> => {
    const batch = writeBatch(db);

    profiles.forEach((profile) => {
      const workerId = String(profile.workerId || '').trim();
      if (!workerId) return;

      batch.set(
        doc(db, COLLECTION_NAME, workerId),
        stripUndefinedFields({
          workerId,
          claimUnitPrice: typeof profile.claimUnitPrice === 'number' ? profile.claimUnitPrice : undefined,
          recruiterFee: typeof profile.recruiterFee === 'number' ? profile.recruiterFee : undefined,
          memo: typeof profile.memo === 'string' ? profile.memo : undefined,
          updatedAt: Timestamp.now()
        }),
        { merge: true }
      );
    });

    await batch.commit();
  }
};
