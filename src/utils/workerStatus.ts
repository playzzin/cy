type WorkerStatusRecord = { status?: unknown; isActive?: boolean };
export type WorkerStatusGroup = 'active' | 'retired' | 'inactive';

export function getWorkerStatusGroup(worker: WorkerStatusRecord): WorkerStatusGroup {
    const status = String(worker.status ?? '').replace(/\s+/g, '').toLowerCase();
    if (status.includes('출입금지') || ['blocked', 'archived'].includes(status)) return 'inactive';
    if (status.includes('퇴사') || ['inactive', 'resigned', 'retired'].includes(status) || worker.isActive === false) return 'retired';
    return 'active';
}

export const workerStatusMatches = (worker: WorkerStatusRecord, filter: WorkerStatusGroup | 'all') =>
    filter === 'all' || getWorkerStatusGroup(worker) === filter;

export const getWorkerStatusLabel = (worker: WorkerStatusRecord) =>
    ({ active: '재직중', retired: '퇴사', inactive: '비활성' })[getWorkerStatusGroup(worker)];
