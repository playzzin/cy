import { collection, doc, getDocs, query, runTransaction, serverTimestamp, where } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import { RepairRecord, repairIssues } from './model';

// Uses the existing support write permission. Repairs are history, not billing mutations.
const COLLECTION = 'support_shared_data';
const KIND = 'vehicle_repair_record';
const refFor = (id: string) => doc(db, COLLECTION, id);
const audit = () => ({ updatedAt: serverTimestamp(), updatedByUid: auth.currentUser?.uid ?? null });

// One transaction keeps a ledger save atomic when any edited record has a conflict.
async function saveRows(records: RepairRecord[]): Promise<void> {
  if (!records.length) return;
  if (records.length > 100) throw new Error('한 번에 100건까지 저장할 수 있습니다. 먼저 변경사항을 저장해 주세요.');
  if (new Set(records.map(row => row.id)).size !== records.length) throw new Error('중복된 정비 행이 있습니다. 다시 확인해 주세요.');
  for (const row of records) {
    const issues = repairIssues(row);
    if (issues.length) throw new Error(issues.join(' · '));
  }
  await runTransaction(db, async transaction => {
    const snapshots = await Promise.all(records.map(row => transaction.get(refFor(row.id))));
    snapshots.forEach((current, index) => {
      const row = records[index];
      if (current.exists() && current.data().data.revision !== row.revision) throw new Error('다른 사용자가 수정했습니다. 입력 내용은 유지됩니다. 변경 취소 후 새로고침해 다시 확인해 주세요.');
      if (!current.exists() && row.revision !== 0) throw new Error('기록을 찾을 수 없습니다. 새로고침해 주세요.');
    });
    records.forEach(row => {
      const data = { ...row, yearMonth: row.date.slice(0, 7), issues: [], revision: row.revision + 1 };
      transaction.set(refFor(row.id), { kind: KIND, schemaVersion: 1, data, ...audit() });
    });
  });
}

export const vehicleRepairService = {
  async list(): Promise<RepairRecord[]> {
    const snapshot = await getDocs(query(collection(db, COLLECTION), where('kind', '==', KIND)));
    return snapshot.docs.map(snapshot => ({ ...snapshot.data().data, id: snapshot.id } as RepairRecord));
  },

  save: (record: RepairRecord) => saveRows([record]),
  saveRows,

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
