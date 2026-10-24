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

// 신규 입력 후보에만 적용합니다. 저장된 일보와 정산의 작업자는 제외하지 않습니다.
export const isActiveWorker = (worker?: WorkerStatusRecord | null): boolean =>
    Boolean(worker && getWorkerStatusGroup(worker) === 'active');

export const getWorkerStatusLabel = (worker: WorkerStatusRecord) =>
    ({ active: '재직중', retired: '퇴사', inactive: '비활성' })[getWorkerStatusGroup(worker)];
