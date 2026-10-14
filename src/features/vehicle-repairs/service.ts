import { collection, doc, getDocs, query, runTransaction, serverTimestamp, where } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import { RepairRecord, repairIssues } from './model';

// Uses the existing support write permission. Repairs are history, not billing mutations.
const COLLECTION = 'support_shared_data';
const KIND = 'vehicle_repair_record';
const refFor = (id: string) => doc(db, COLLECTION, id);
const audit = () => ({ updatedAt: serverTimestamp(), updatedByUid: auth.currentUser?.uid ?? null });

export const vehicleRepairService = {
  async list(): Promise<RepairRecord[]> {
    const snapshot = await getDocs(query(collection(db, COLLECTION), where('kind', '==', KIND)));
    return snapshot.docs.map(snapshot => ({ ...snapshot.data().data, id: snapshot.id } as RepairRecord));
  },

  async save(record: RepairRecord): Promise<void> {
    const issues = repairIssues(record);
    if (issues.length) throw new Error(issues.join(' · '));
    await runTransaction(db, async transaction => {
      const ref = refFor(record.id);
      const current = await transaction.get(ref);
      if (current.exists() && current.data().data.revision !== record.revision) throw new Error('다른 사용자가 수정했습니다. 새로고침한 뒤 다시 수정해 주세요.');
      if (!current.exists() && record.revision !== 0) throw new Error('기록을 찾을 수 없습니다. 새로고침해 주세요.');
      const data = { ...record, issues: [], revision: record.revision + 1 };
      transaction.set(ref, { kind: KIND, schemaVersion: 1, data, ...audit() });
    });
  },

  async archive(record: RepairRecord): Promise<void> {
    await runTransaction(db, async transaction => {
      const ref = refFor(record.id);
      const current = await transaction.get(ref);
      if (!current.exists() || current.data().data.revision !== record.revision) throw new Error('기록이 변경됐습니다. 새로고침한 뒤 다시 시도해 주세요.');
      transaction.update(ref, { data: { ...current.data().data, archived: !record.archived, revision: record.revision + 1 }, ...audit() });
    });
  },

  async importRecords(records: RepairRecord[], onProgress?: (count: number) => void) {
    let added = 0, skipped = 0, conflicts = 0;
    for (let offset = 0; offset < records.length; offset += 100) {
      const chunk = records.slice(offset, offset + 100);
      const result = await runTransaction(db, async transaction => {
        const snapshots = await Promise.all(chunk.map(row => transaction.get(refFor(row.id))));
        const counts = { added: 0, skipped: 0, conflicts: 0 };
        snapshots.forEach((snapshot, index) => {
          const row = chunk[index];
          if (snapshot.exists()) {
            if (snapshot.data().data.source?.signature === row.source?.signature) counts.skipped++;
            else counts.conflicts++;
            return;
          }
          transaction.set(refFor(row.id), { kind: KIND, schemaVersion: 1, data: row, ...audit() });
          counts.added++;
        });
        return counts;
      });
      added += result.added; skipped += result.skipped; conflicts += result.conflicts;
      onProgress?.(Math.min(offset + 100, records.length));
    }
    return { added, skipped, conflicts };
  },
};
