export const formatNumberForDisplay = (
    value: number,
    formatter: (amount: number) => string = (amount) => amount.toLocaleString('ko-KR')
): string => {
    if (!Number.isFinite(value)) return '-';
    return formatter(value);
};

export const formatTextForDisplay = (value: unknown): string => {
    const text = String(value ?? '').trim();
    if (!text) return '-';
    return text;
};
