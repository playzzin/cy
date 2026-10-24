/** Match the report/participation precision without hiding quarter-day entries. */
export const positiveManDay = (value: unknown): number => {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? Math.round(number * 10000) / 10000 : 0;
};

export const formatManDay = (value: number): string => positiveManDay(value).toLocaleString('ko-KR', {
    minimumFractionDigits: 1, maximumFractionDigits: 4,
});
