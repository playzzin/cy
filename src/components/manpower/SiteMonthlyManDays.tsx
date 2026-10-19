import React, { useMemo } from 'react';
import type { DailyReportWorkerRow } from '../../services/dailyReportService';

const format = (value: number) => value.toLocaleString('ko-KR', { maximumFractionDigits: 4 });

export default function SiteMonthlyManDays({ rows, month, loading, error }: {
    rows: DailyReportWorkerRow[]; month: string; loading: boolean; error: string;
}) {
    const year = month.slice(0, 4);
    const months = useMemo(() => {
        const totals = Array.from({ length: 12 }, () => 0);
        rows.forEach(row => {
            if (row.isEmptyReport || !row.date?.startsWith(`${year}-`)) return;
            const index = Number(row.date.slice(5, 7)) - 1;
            const value = Number(row.manDay);
            if (Number.isInteger(index) && index >= 0 && index < 12 && Number.isFinite(value)) totals[index] += value;
        });
        let cumulative = 0;
        return totals.map((total, index) => {
            cumulative += total;
            return { month: `${year}-${String(index + 1).padStart(2, '0')}`, total, cumulative };
        });
    }, [rows, year]);
    return <section className="tw-detail-section sr-monthly-mandays" aria-label="월별 누적공수" aria-busy={loading}>
        <h3>월별 누적공수</h3>
        <p>{year}년 · 지원 공수 포함 · 누적은 1월부터 해당 월까지 합산합니다.</p>
        {loading ? <p role="status">월별 공수를 불러오는 중입니다.</p> : error ? <p role="alert">{error}</p> :
            <table>
                <thead><tr><th scope="col">월</th><th scope="col">월 공수</th><th scope="col">누적공수</th></tr></thead>
                <tbody>{months.map(item => <tr key={item.month} className={item.month === month ? 'sr-monthly-mandays__selected' : undefined}>
                    <th scope="row">{Number(item.month.slice(5))}월{item.month === month && <small>선택</small>}</th>
                    <td>{format(item.total)}</td><td>{format(item.cumulative)}</td>
                </tr>)}</tbody>
            </table>}
    </section>;
}
