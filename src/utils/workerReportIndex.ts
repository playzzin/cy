import type { DailyReportWorkerRow } from '../services/dailyReportService';
import type { Worker } from '../services/manpowerService';

type IndexedRow = { row: DailyReportWorkerRow; position: number };

export interface WorkerReportIndex {
    readonly byWorkerId: ReadonlyMap<string, readonly IndexedRow[]>;
    readonly withoutIdByName: ReadonlyMap<string, readonly IndexedRow[]>;
}

const workerIdKey = (value: string | null | undefined) => String(value ?? '').trim();
const workerNameKey = (value: string | null | undefined) => String(value ?? '').replace(/\s+/g, '').toLowerCase();

/** Index each row once; only records without a worker ID may fall back to a name. */
export function indexWorkerReportRows(rows: readonly DailyReportWorkerRow[]): WorkerReportIndex {
    const byWorkerId = new Map<string, IndexedRow[]>();
    const withoutIdByName = new Map<string, IndexedRow[]>();
    rows.forEach((row, position) => {
        const id = workerIdKey(row.workerId);
        const key = id || workerNameKey(row.workerName);
        if (!key) return;
        const map = id ? byWorkerId : withoutIdByName;
        const bucket = map.get(key);
        const entry = { row, position };
        if (bucket) bucket.push(entry);
        else map.set(key, [entry]);
    });
    return { byWorkerId, withoutIdByName };
}

export function getIndexedWorkerRows(
    index: WorkerReportIndex,
    worker: Pick<Worker, 'id' | 'legacyId' | 'name'>,
): DailyReportWorkerRow[] {
    const buckets: (readonly IndexedRow[])[] = [];
    new Set([worker.id, worker.legacyId].map(workerIdKey).filter(Boolean)).forEach(id => {
        const rows = index.byWorkerId.get(id);
        if (rows) buckets.push(rows);
    });
    const name = workerNameKey(worker.name);
    const legacyRows = name ? index.withoutIdByName.get(name) : undefined;
    if (legacyRows) buckets.push(legacyRows);

    // Merge at most three already ordered buckets without rescanning or sorting all rows.
    const offsets = buckets.map(() => 0);
    const result: DailyReportWorkerRow[] = [];
    while (true) {
        let nextBucket = -1;
        let nextPosition = Infinity;
        buckets.forEach((bucket, bucketIndex) => {
            const entry = bucket[offsets[bucketIndex]];
            if (entry && entry.position < nextPosition) {
                nextBucket = bucketIndex;
                nextPosition = entry.position;
            }
        });
        if (nextBucket === -1) return result;
        result.push(buckets[nextBucket][offsets[nextBucket]].row);
        offsets[nextBucket] += 1;
    }
}
