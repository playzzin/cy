import type { TransferCandidate, WorkerEmployment } from './types';

type WorkerStatus = { id?: string; legacyId?: string | null; status?: string | null; isActive?: boolean };

export function buildWorkerEmployment(workers: WorkerStatus[]): Record<string, WorkerEmployment> {
    const result: Record<string, WorkerEmployment> = Object.create(null);
    workers.forEach(worker => {
        const status = String(worker.status ?? '').trim().toLowerCase();
        const employment: WorkerEmployment = worker.isActive === false || status.includes('퇴사') || ['inactive', 'resigned', 'retired'].includes(status)
            ? 'retired' : status.includes('재직') || status === 'active' || (!status && worker.isActive === true) ? 'active' : 'unknown';
        new Set([worker.id, worker.legacyId]).forEach(value => {
            const id = String(value ?? '').trim();
            if (id) result[id] = Object.prototype.hasOwnProperty.call(result, id) ? 'unknown' : employment;
        });
    });
    return result;
}

export function getWorkerEmployment(row: TransferCandidate, directory: Record<string, WorkerEmployment>): WorkerEmployment | undefined {
    if (row.category !== 'worker') return undefined;
    // Payroll payment IDs are month__workerId__teamId__salaryModel. Never match by name or bank account.
    const parts = row.sourceId.split('__');
    const id = row.source === 'account' ? row.sourceId : row.source === 'payroll' && parts.length === 4 && parts[0] === row.period ? parts[1] : '';
    return id && Object.prototype.hasOwnProperty.call(directory, id) ? directory[id] : 'unknown';
}
