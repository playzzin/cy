export const DEFAULT_SUPPORT_BILLING_START_DATE = '2026-01-01';

export const normalizeDateText = (value?: unknown): string => {
    const text = String(value ?? '').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
};

export const minIsoDate = (...values: unknown[]): string => {
    const dates = values.map(normalizeDateText).filter(Boolean);
    return dates.length > 0 ? dates.reduce((min, date) => (date < min ? date : min)) : '';
};

export const maxIsoDate = (...values: unknown[]): string => {
    const dates = values.map(normalizeDateText).filter(Boolean);
    return dates.length > 0 ? dates.reduce((max, date) => (date > max ? date : max)) : '';
};

const getYearMonthEndDateText = (yearMonth: string): string => {
    const match = /^(\d{4})-(\d{2})$/.exec(String(yearMonth ?? '').trim());
    if (!match) return '';

    const year = Number(match[1]);
    const month = Number(match[2]);
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return '';

    const end = new Date(year, month, 0);
    const day = String(end.getDate()).padStart(2, '0');
    return `${match[1]}-${match[2]}-${day}`;
};

export const isSupportBillingMonthEnabled = (
    yearMonth: string,
    startDate: string = DEFAULT_SUPPORT_BILLING_START_DATE
): boolean => {
    const monthEnd = getYearMonthEndDateText(yearMonth);
    const normalizedStart = normalizeDateText(startDate) || DEFAULT_SUPPORT_BILLING_START_DATE;
    if (!monthEnd) return true;
    return monthEnd >= normalizedStart;
};
