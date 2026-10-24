import { normalizeTypedDateInput } from '../../utils/typedDateInput';

export const formatYmd = (date: Date): string =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const getMonthDateRange = (offset: number, today = new Date()) => {
    const start = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    return { start: formatYmd(start), end: formatYmd(new Date(start.getFullYear(), start.getMonth() + 1, 0)) };
};

export const getMonthDateRangeFromValue = (value: string): { start: string; end: string } | null => {
    if (!/^\d{4}-\d{2}$/.test(value) || !normalizeTypedDateInput(`${value}-01`)) return null;
    const [year, month] = value.split('-').map(Number);
    return { start: `${value}-01`, end: formatYmd(new Date(year, month, 0)) };
};

type DateRangeResult = { start: string; end: string; error: null } | { start?: undefined; end?: undefined; error: string };

export const validateDailyReportDateRange = (startInput: string, endInput: string, mode: 'range' | 'month'): DateRangeResult => {
    if (mode === 'month') {
        const month = getMonthDateRangeFromValue(startInput.slice(0, 7));
        return month ? { ...month, error: null } : { error: '올바른 조회 월을 입력해 주세요.' };
    }
    const start = normalizeTypedDateInput(startInput);
    const end = normalizeTypedDateInput(endInput);
    if (!start || !end) return { error: '시작일과 종료일에 실제 존재하는 날짜를 입력해 주세요. (예: 2026-09-29)' };
    if (start > end) return { error: '조회 시작일은 종료일보다 늦을 수 없습니다.' };
    return { start, end, error: null };
};
