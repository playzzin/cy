import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import SiteMonthlyManDays from './SiteMonthlyManDays';
import type { DailyReportWorkerRow } from '../../services/dailyReportService';

test('월 공수는 지원·소수 공수를 포함하고 누적은 해당 연도 1월부터 계산한다', () => {
    const rows = [
        { date: '2025-12-31', manDay: 99 },
        { date: '2026-01-01', manDay: 0.1 },
        { date: '2026-01-02', manDay: 0.2 },
        { date: '2026-02-01', manDay: 0.25, isSiteSupport: true },
        { date: '2026-02-02', manDay: 100, isEmptyReport: true },
        { date: '2026-03-01', manDay: 0.5 },
        { date: '2027-01-01', manDay: 99 },
    ] as DailyReportWorkerRow[];
    render(<SiteMonthlyManDays rows={rows} month="2026-02" loading={false} error="" />);
    const january = screen.getByRole('row', { name: /^1월/ });
    expect(within(january).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['0.3', '0.3']);
    const february = screen.getByRole('row', { name: /^2월/ });
    expect(within(february).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['0.25', '0.55']);
    const march = screen.getByRole('row', { name: /^3월/ });
    expect(within(march).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['0.5', '1.05']);
    expect(screen.getAllByRole('row')).toHaveLength(13);
});
