import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  Timestamp,
  where,
  writeBatch,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { stripUndefinedFields } from '../utils/stripUndefinedFields';

export interface DailyAdvanceStatementRecruiterFee {
  key?: string;
  month: string;
  teamKey: string;
  workerId: string;
  amount: number;
  updatedAt?: any;
}

const COLLECTION_NAME = 'daily_advance_statement_recruiter_fees';

const buildDocId = (month: string, teamKey: string, workerId: string): string =>
  [month, teamKey, workerId].map((part) => encodeURIComponent(String(part || '').trim())).join('__');

const buildKey = (month: string, teamKey: string, workerId: string): string =>
  `${month}__${teamKey}__${workerId}`;

const mapFeeDoc = (
  entry: QueryDocumentSnapshot,
  safeMonth: string
): DailyAdvanceStatementRecruiterFee => {
  const data = entry.data() as DailyAdvanceStatementRecruiterFee;
  const teamKey = String(data.teamKey || '').trim();
  const workerId = String(data.workerId || '').trim();
  return {
    key: String(data.key || buildKey(safeMonth, teamKey, workerId)),
    month: String(data.month || safeMonth),
    teamKey,
    workerId,
    amount: typeof data.amount === 'number' ? data.amount : 0,
    updatedAt: data.updatedAt,
  };
};

export const dailyAdvanceStatementRecruiterFeeService = {
  getFeesByMonth: async (month: string): Promise<DailyAdvanceStatementRecruiterFee[]> => {
    const safeMonth = String(month || '').trim();
    if (!safeMonth) return [];

    const snapshot = await getDocs(
      query(collection(db, COLLECTION_NAME), where('month', '==', safeMonth))
    );

    return snapshot.docs.map((entry) => mapFeeDoc(entry, safeMonth));
  },

  subscribeFeesByMonth: (
    month: string,
    onRows: (fees: DailyAdvanceStatementRecruiterFee[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe => {
    const safeMonth = String(month || '').trim();
    if (!safeMonth) {
      onRows([]);
      return () => undefined;
    }

    return onSnapshot(
      query(collection(db, COLLECTION_NAME), where('month', '==', safeMonth)),
      (snapshot) => {
        onRows(snapshot.docs.map((entry) => mapFeeDoc(entry, safeMonth)));
      },
      onError
    );
  },

  saveFees: async (fees: DailyAdvanceStatementRecruiterFee[]): Promise<void> => {
    const batch = writeBatch(db);

    fees.forEach((fee) => {
      const month = String(fee.month || '').trim();
      const teamKey = String(fee.teamKey || '').trim();
      const workerId = String(fee.workerId || '').trim();
      if (!month || !teamKey || !workerId) return;

      const ref = doc(db, COLLECTION_NAME, buildDocId(month, teamKey, workerId));
      const amount = Number.isFinite(fee.amount) ? Math.max(0, fee.amount) : 0;

      batch.set(
        ref,
        stripUndefinedFields({
          key: fee.key || buildKey(month, teamKey, workerId),
          month,
          teamKey,
          workerId,
          amount,
          updatedAt: Timestamp.now(),
        }),
        { merge: true }
      );
    });

    await batch.commit();
  },
};
