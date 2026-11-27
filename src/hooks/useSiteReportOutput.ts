import { useEffect, useMemo, useState } from 'react';
import { dailyReportService, type DailyReportWorkerRow } from '../services/dailyReportService';

type DateRange = { startDate: string; endDate: string };
type ReadRows = (period: string) => Promise<DailyReportWorkerRow[]>;
type ReportResult = { read: ReadRows; period: string; rows: DailyReportWorkerRow[]; error: string };

const EMPTY_ROWS: DailyReportWorkerRow[] = [];

function useReportPeriod(read: ReadRows, period: string, enabled: boolean) {
    const [result, setResult] = useState<ReportResult>();
    const current = result?.read === read && result.period === period ? result : undefined;
    useEffect(() => {
        if (!enabled || current) return;
        let active = true;
        void read(period).then(rows => {
            if (active) setResult({ read, period, rows, error: '' });
        }).catch(error => {
            if (!active) return;
            console.error('출력일보 조회 실패:', error);
            setResult({ read, period, rows: EMPTY_ROWS, error: '출력일보를 불러오지 못했습니다. 새로고침해 주세요.' });
        });
        return () => { active = false; };
    }, [current, enabled, period, read]);
    return { rows: current?.rows ?? EMPTY_ROWS, loading: enabled && !current, error: current?.error ?? '', ready: !!current && !current.error };
}

export function useSiteReportOutput({ uid, month, annual, prioritizeMonth, showAnnual, includeSiteSupport, revision, getMonthRange }: {
    uid?: string;
    month: string;
    annual: boolean;
    prioritizeMonth: boolean;
    showAnnual: boolean;
    includeSiteSupport: boolean;
    revision: number;
    getMonthRange: (month: string) => DateRange;
}) {
    const year = month.slice(0, 4);
    const scopeKey = JSON.stringify([uid, year, revision]);
    const read = useMemo<ReadRows>(() => {
        const monthReads = new Map<string, Promise<DailyReportWorkerRow[]>>();
        return async period => {
            const months = period.length === 4 ? Array.from({ length: 12 }, (_, index) => `${period}-${String(index + 1).padStart(2, '0')}`) : [period];
            const rows = await Promise.all(months.map(rangeMonth => {
                const load = () => dailyReportService.getWorkerRows({
                    ...getMonthRange(rangeMonth),
                    includeSiteSupport,
                    withSiteDirectory: includeSiteSupport && prioritizeMonth && period === rangeMonth,
                });
                if (!prioritizeMonth) return load();
                const key = `${scopeKey}:${rangeMonth}`;
                const existing = monthReads.get(key);
                if (existing) return existing;
                const request = load().catch(error => { monthReads.delete(key); throw error; });
                monthReads.set(key, request);
                return request;
            }));
            return rows.flat();
        };
    }, [getMonthRange, includeSiteSupport, prioritizeMonth, scopeKey]);

    const current = useReportPeriod(read, annual && !prioritizeMonth ? year : month, !!uid);
    const cumulative = useReportPeriod(read, year, !!uid && prioritizeMonth && showAnnual && current.ready);
    return { current, cumulative: prioritizeMonth ? cumulative : current };
}
