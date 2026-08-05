export interface VehicleBillingProrationInput {
    yearMonth: string;
    monthlyFee: unknown;
    startDate?: string | null;
    endDate?: string | null;
}

export interface VehicleBillingProrationResult {
    amount: number;
    activeDays: number;
    monthDays: number;
    startDate?: string;
    endDate?: string;
}

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const YEAR_MONTH_PATTERN = /^(\d{4})-(\d{2})$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const parseIsoDate = (value?: string | null): Date | null => {
    const match = ISO_DATE_PATTERN.exec(String(value ?? '').trim());
    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day);

    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
    ) {
        return null;
    }

    return date;
};

const formatIsoDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getMonthRange = (yearMonth: string): { start: Date; end: Date; days: number } | null => {
    const match = YEAR_MONTH_PATTERN.exec(String(yearMonth ?? '').trim());
    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
        return null;
    }

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    return {
        start,
        end,
        days: inclusiveDays(start, end)
    };
};

const inclusiveDays = (start: Date, end: Date): number => {
    if (end.getTime() < start.getTime()) return 0;
    return Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;
};

const maxDate = (left: Date, right: Date): Date => (
    left.getTime() >= right.getTime() ? left : right
);

const minDate = (left: Date, right: Date): Date => (
    left.getTime() <= right.getTime() ? left : right
);

export const calculateVehicleBillingProration = ({
    yearMonth,
    monthlyFee,
    startDate,
    endDate
}: VehicleBillingProrationInput): VehicleBillingProrationResult => {
    const month = getMonthRange(yearMonth);
    const fee = Number(monthlyFee ?? 0);

    if (!month || !Number.isFinite(fee) || fee <= 0) {
        return { amount: 0, activeDays: 0, monthDays: month?.days ?? 0 };
    }

    const contractStart = parseIsoDate(startDate) ?? month.start;
    const contractEnd = parseIsoDate(endDate) ?? month.end;
    const activeStart = maxDate(month.start, contractStart);
    const activeEnd = minDate(month.end, contractEnd);
    const activeDays = inclusiveDays(activeStart, activeEnd);

    if (activeDays <= 0) {
        return { amount: 0, activeDays: 0, monthDays: month.days };
    }

    const amount = activeDays === month.days
        ? Math.round(fee)
        : Math.round((fee * activeDays) / month.days);

    return {
        amount,
        activeDays,
        monthDays: month.days,
        startDate: formatIsoDate(activeStart),
        endDate: formatIsoDate(activeEnd)
    };
};
