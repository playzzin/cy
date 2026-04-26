const trimText = (value: unknown): string => {
    return typeof value === 'string' ? value.trim() : '';
};

export const normalizePayType = (value: unknown): string => {
    const raw = trimText(value);
    if (!raw) return '';

    if (raw === '일급' || raw === '일당') return '일급제';
    if (raw === '월급') return '월급제';
    if (raw === '주급') return '주급제';
    if (raw === '지원') return '지원팀';
    if (raw === '용역') return '용역팀';

    return raw;
};

export const resolvePayType = (...values: unknown[]): string => {
    for (const value of values) {
        const normalized = normalizePayType(value);
        if (normalized) return normalized;
    }
    return '';
};

export const resolveTeamPayType = (value: unknown): string => {
    const normalized = normalizePayType(value);
    if (normalized === '지원팀' || normalized === '용역팀') return normalized;
    return '';
};

export const resolveWorkerPayType = (worker?: {
    teamType?: unknown;
    payType?: unknown;
    salaryModel?: unknown;
} | null): string => {
    const teamPayType = resolveTeamPayType(worker?.teamType);
    if (teamPayType) return teamPayType;
    return resolvePayType(worker?.payType, worker?.salaryModel);
};

export const resolveReportPayType = (
    reportWorker?: {
        salaryModel?: unknown;
        payType?: unknown;
    } | null,
    worker?: {
        teamType?: unknown;
        payType?: unknown;
        salaryModel?: unknown;
    } | null
): string => {
    return resolvePayType(
        reportWorker?.salaryModel,
        reportWorker?.payType,
        resolveWorkerPayType(worker)
    );
};

export const syncPayTypeFields = <T extends {
    payType?: unknown;
    salaryModel?: unknown;
    teamType?: unknown;
}>(value: T, options?: {
    returnUndefinedOnEmpty?: boolean;
    priority?: 'payType' | 'salaryModel';
    preferTeamType?: boolean;
}): T => {
    const hasPayType = Object.prototype.hasOwnProperty.call(value, 'payType');
    const hasSalaryModel = Object.prototype.hasOwnProperty.call(value, 'salaryModel');

    if (!hasPayType && !hasSalaryModel) return value;

    const teamPayType = options?.preferTeamType ? resolveTeamPayType(value.teamType) : '';
    const resolved = teamPayType || (
        options?.priority === 'salaryModel'
            ? resolvePayType(value.salaryModel, value.payType)
            : resolvePayType(value.payType, value.salaryModel)
    );
    const emptyValue = options?.returnUndefinedOnEmpty ? undefined : '';

    return {
        ...value,
        payType: resolved || emptyValue,
        salaryModel: resolved || emptyValue,
    } as T;
};
