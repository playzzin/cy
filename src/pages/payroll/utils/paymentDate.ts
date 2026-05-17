const YEAR_MONTH_PATTERN = /^(\d{4})-(\d{1,2})$/;

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

const pad2 = (value: number): string => String(value).padStart(2, '0');

const parseYearMonth = (yearMonth: string): { year: number; month: number } | null => {
    const match = String(yearMonth ?? '').trim().match(YEAR_MONTH_PATTERN);
    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);

    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
        return null;
    }

    return { year, month };
};

const isPayrollRestDay = (date: Date): boolean => {
    return date.getDay() === 0;
};

export const getPayrollPaymentDate = (yearMonth: string): Date | null => {
    const parsed = parseYearMonth(yearMonth);
    if (!parsed) return null;

    const nextMonthLastDay = new Date(parsed.year, parsed.month + 1, 0);
    if (isPayrollRestDay(nextMonthLastDay)) {
        nextMonthLastDay.setDate(nextMonthLastDay.getDate() - 1);
    }

    return nextMonthLastDay;
};

export const formatPayrollPaymentDate = (yearMonth: string): string => {
    const paymentDate = getPayrollPaymentDate(yearMonth);
    if (!paymentDate) return '-';

    const year = paymentDate.getFullYear();
    const month = pad2(paymentDate.getMonth() + 1);
    const day = pad2(paymentDate.getDate());
    const weekday = WEEKDAY_LABELS[paymentDate.getDay()];

    return `${year}-${month}-${day} (${weekday})`;
};
