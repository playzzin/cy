import { getWorkerStatusGroup } from './workerStatus';

export type WorkerEmploymentPeriod = { joinDate?: string | null; retirementDate?: string | null; status?: unknown; isActive?: boolean };

export const isEmploymentDate = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(`${value}T00:00:00Z`))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

export const employmentToday = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());

export function validateEmploymentPeriod(worker: WorkerEmploymentPeriod): string {
    if (worker.joinDate && !isEmploymentDate(worker.joinDate)) return '입사일을 올바른 날짜로 입력해 주세요.';
    if (worker.retirementDate && !isEmploymentDate(worker.retirementDate)) return '퇴사일을 올바른 날짜로 입력해 주세요.';
    if (worker.joinDate && worker.retirementDate && worker.joinDate > worker.retirementDate) return '퇴사일은 입사일보다 빠를 수 없습니다.';
    return '';
}

// 이전 자료에 입사일이 없으면 최초 출역일을 확인 가능한 시작점으로 사용한다.
// 마지막 출역일이나 데이터 수정일을 퇴사일로 추정하지 않는다.
export function isEmployedInMonth(worker: WorkerEmploymentPeriod, month: string, firstOutputDate?: string): boolean {
    const start = worker.joinDate || firstOutputDate;
    if (!start || !isEmploymentDate(start) || validateEmploymentPeriod(worker)) return false;
    if (getWorkerStatusGroup(worker) === 'inactive') return false;
    if (getWorkerStatusGroup(worker) === 'retired' && !worker.retirementDate) return false;
    return start.slice(0, 7) <= month && (!worker.retirementDate || worker.retirementDate.slice(0, 7) >= month);
}

export function withEmploymentDates<T extends WorkerEmploymentPeriod>(before: WorkerEmploymentPeriod | null, updates: T): T {
    const next = { ...updates };
    const statusChanged = Object.prototype.hasOwnProperty.call(updates, 'status') || Object.prototype.hasOwnProperty.call(updates, 'isActive');
    if (Object.prototype.hasOwnProperty.call(updates, 'status') && updates.status !== before?.status) {
        next.isActive = getWorkerStatusGroup({ status: updates.status }) === 'active';
    }
    const after = { ...before, ...next };
    if (statusChanged) {
        const oldStatus = before ? getWorkerStatusGroup(before) : 'active';
        const status = getWorkerStatusGroup(after);
        if (status === 'retired' && oldStatus !== 'retired' && !next.retirementDate) next.retirementDate = employmentToday();
        // '재직중으로 변경'은 기존 퇴사 처리를 취소한다. 별도 재입사 이력을 추정하지 않는다.
        if (status === 'active' && oldStatus === 'retired') next.retirementDate = '';
    }
    const error = validateEmploymentPeriod({ ...before, ...next });
    if (error) throw new Error(error);
    return next;
}
