import type { DashboardKPI } from '../types/dashboard';

export interface DashboardTrendRange {
    startDate: string;
    endDate: string;
}

export const PREVIOUS_PERIOD_TREND_LABEL = '\uc774\uc804 \uae30\uac04 \ub300\ube44';

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const parseIsoDate = (value: string): Date | null => {
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

const addDays = (date: Date, days: number): Date => {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
};

const inclusiveDays = (start: Date, end: Date): number => {
    if (end.getTime() < start.getTime()) return 0;
    return Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;
};

export const getPreviousDateRange = (startDate: string, endDate: string): DashboardTrendRange | null => {
    const start = parseIsoDate(startDate);
    const end = parseIsoDate(endDate);
    if (!start || !end || end.getTime() < start.getTime()) return null;

    const dayCount = inclusiveDays(start, end);
    const previousEnd = addDays(start, -1);
    const previousStart = addDays(previousEnd, -(dayCount - 1));

    return {
        startDate: formatIsoDate(previousStart),
        endDate: formatIsoDate(previousEnd)
    };
};

const toFiniteNumber = (value: unknown): number => {
    const numberValue = Number(value ?? 0);
    return Number.isFinite(numberValue) ? numberValue : 0;
};

const roundToOneDecimal = (value: number): number => Math.round(value * 10) / 10;

export const calculateTrendPercent = (currentValue: unknown, previousValue: unknown): number => {
    const current = toFiniteNumber(currentValue);
    const previous = toFiniteNumber(previousValue);

    if (previous === 0) {
        if (current === 0) return 0;
        return current > 0 ? 100 : -100;
    }

    return roundToOneDecimal(((current - previous) / Math.abs(previous)) * 100);
};

export const getTrendStatus = (trend: number): DashboardKPI['status'] => {
    if (trend > 0) return 'up';
    if (trend < 0) return 'down';
    return 'neutral';
};
