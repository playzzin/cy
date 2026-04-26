
import { useState, useCallback, useMemo } from 'react';
import {
    startOfDay, endOfDay,
    startOfWeek, endOfWeek,
    startOfMonth, endOfMonth,
    subDays, subMonths, format
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { DashboardPeriod } from '../types/dashboard';

export const usePeriodSelector = () => {
    const [period, setPeriod] = useState<DashboardPeriod>('today');
    const [customRange, setCustomRange] = useState<{ start: Date; end: Date }>({
        start: startOfMonth(new Date()),
        end: endOfDay(new Date())
    });

    // 기간 변경 핸들러
    const handlePeriodChange = useCallback((newPeriod: DashboardPeriod) => {
        setPeriod(newPeriod);
    }, []);

    // 커스텀 기간 변경 핸들러
    const handleCustomRangeChange = useCallback((start: Date, end: Date) => {
        setCustomRange({ start, end });
        setPeriod('custom');
    }, []);

    // 현재 선택된 기간의 시작/종료일 계산
    const dateRange = useMemo(() => {
        const now = new Date();

        switch (period) {
            case 'today':
                return {
                    start: format(startOfDay(now), 'yyyy-MM-dd'),
                    end: format(endOfDay(now), 'yyyy-MM-dd')
                };
            case 'week':
                return {
                    start: format(startOfWeek(now, { locale: ko }), 'yyyy-MM-dd'),
                    end: format(endOfWeek(now, { locale: ko }), 'yyyy-MM-dd')
                };
            case 'month':
                return {
                    start: format(startOfMonth(now), 'yyyy-MM-dd'),
                    end: format(endOfMonth(now), 'yyyy-MM-dd')
                };
            case 'custom':
                return {
                    start: format(customRange.start, 'yyyy-MM-dd'),
                    end: format(customRange.end, 'yyyy-MM-dd')
                };
            default:
                return {
                    start: format(startOfDay(now), 'yyyy-MM-dd'),
                    end: format(endOfDay(now), 'yyyy-MM-dd')
                };
        }
    }, [period, customRange]);

    // 이전 기간 (추세 비교용) 계산
    const prevDateRange = useMemo(() => {
        const now = new Date();

        switch (period) {
            case 'today':
                const yesterday = subDays(now, 1);
                return {
                    start: format(startOfDay(yesterday), 'yyyy-MM-dd'),
                    end: format(endOfDay(yesterday), 'yyyy-MM-dd')
                };
            case 'week':
                const lastWeek = subDays(now, 7);
                return {
                    start: format(startOfWeek(lastWeek, { locale: ko }), 'yyyy-MM-dd'),
                    end: format(endOfWeek(lastWeek, { locale: ko }), 'yyyy-MM-dd')
                };
            case 'month':
                const lastMonth = subMonths(now, 1);
                return {
                    start: format(startOfMonth(lastMonth), 'yyyy-MM-dd'),
                    end: format(endOfMonth(lastMonth), 'yyyy-MM-dd')
                };
            case 'custom':
                // 커스텀 기간의 경우, 동일한 기간만큼 이전으로 이동
                const diffTime = Math.abs(customRange.end.getTime() - customRange.start.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                const prevEnd = subDays(customRange.start, 1);
                const prevStart = subDays(prevEnd, diffDays);
                return {
                    start: format(prevStart, 'yyyy-MM-dd'),
                    end: format(prevEnd, 'yyyy-MM-dd')
                };
            default:
                return {
                    start: format(startOfDay(now), 'yyyy-MM-dd'),
                    end: format(endOfDay(now), 'yyyy-MM-dd')
                };
        }
    }, [period, customRange]);

    return {
        period,
        dateRange,
        prevDateRange,
        handlePeriodChange,
        handleCustomRangeChange
    };
};
