export type LaborCheckWorkerLike = {
    workerKey: string;
    retired: boolean;
    employedInMonth?: boolean;
};

export type LaborCheckOutputLike = {
    workerKey: string;
    date: string;
};

export const getVisibleLaborCheckWorkers = <T extends LaborCheckWorkerLike>(
    workers: T[],
    workerKeysWithOutput: Set<string>,
    showRetired: boolean,
    showOnlyWorkersWithOutput: boolean,
): T[] => workers.filter((worker) => {
    const hasOutput = workerKeysWithOutput.has(worker.workerKey);
    // 날짜 기반 대상 여부가 없는 이전 호출은 기존 필터를 유지한다.
    const eligible = worker.employedInMonth === undefined ? !worker.retired : worker.employedInMonth;
    return (hasOutput || eligible) && (!showOnlyWorkersWithOutput || hasOutput) && (!worker.retired || showRetired);
});

export const getFirstOutputDateByWorker = (
    outputRows: LaborCheckOutputLike[],
): Map<string, string> => {
    const firstDateByWorker = new Map<string, string>();

    outputRows.forEach(({ workerKey, date }) => {
        if (!workerKey || !date) return;
        const currentFirstDate = firstDateByWorker.get(workerKey);
        if (!currentFirstDate || date < currentFirstDate) {
            firstDateByWorker.set(workerKey, date);
        }
    });

    return firstDateByWorker;
};

export const isBeforeFirstOutputDate = (
    date: string,
    firstOutputDate?: string,
): boolean => Boolean(firstOutputDate && date < firstOutputDate);

export const canOverrideInactiveLaborCheckCell = (
    inactiveCellEditingEnabled: boolean,
    selectedWorkerKeys: Set<string>,
    worker: LaborCheckWorkerLike,
): boolean => (
    inactiveCellEditingEnabled
    && selectedWorkerKeys.has(worker.workerKey)
    && !worker.retired
);

export const getManualReportedSiteName = (value: unknown): string => (
    String(value ?? '').trim().slice(0, 120)
);
