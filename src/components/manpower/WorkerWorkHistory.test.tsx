import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import WorkerWorkHistory from './WorkerWorkHistory';
import type { DailyReportWorkerRow } from '../../services/dailyReportService';

const rows = [
    { reportId: 'a', date: '2026-10-01', workerId: 'worker', workerName: '가상작업자', siteName: '아주 긴 첫 번째 검증 현장 이름', manDay: 1, unitPrice: 100000 },
    { reportId: 'b', date: '2026-10-01', workerId: 'worker', workerName: '가상작업자', siteName: '두 번째 검증현장', manDay: 0.5, unitPrice: 100000 },
] as DailyReportWorkerRow[];
const props = { rows, month: '2026-10', workerName: '가상작업자', loading: false, error: '' };

test('같은 날짜의 모든 현장과 금액을 상세에서 확인하고 닫으면 날짜로 포커스가 돌아온다', async () => {
    render(<WorkerWorkHistory {...props} />);
    const day = screen.getByRole('button', { name: '2026-10-01 근무내역 1.5공수' });
    day.focus(); fireEvent.click(day);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(rows[0].siteName!)).toBeInTheDocument();
    expect(within(dialog).getByText(rows[1].siteName!)).toBeInTheDocument();
    expect(within(dialog).getByText('50,000원')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: '상세 닫기' }));
    await waitFor(() => expect(day).toHaveFocus());
});

test('목록은 날짜별 합계와 현장을 요약하고 세부 단가는 상세에서만 보여준다', () => {
    render(<WorkerWorkHistory {...props} />);
    fireEvent.click(screen.getByRole('tab', { name: '목록보기' }));
    const row = screen.getByRole('button', { name: '2026-10-01 근무 상세' });
    expect(within(row).getByText('150,000원')).toBeInTheDocument();
    expect(screen.queryByText('단가')).not.toBeInTheDocument();
    fireEvent.click(row);
    expect(within(screen.getByRole('dialog')).getAllByText('단가')).toHaveLength(2);
});

test('빈 날짜와 월 변경은 이전 상세를 보여주지 않는다', () => {
    const { rerender } = render(<WorkerWorkHistory {...props} />);
    fireEvent.click(screen.getByRole('button', { name: '2026-10-02 근무내역 없음' }));
    expect(screen.getByText('해당 날짜의 근무내역이 없습니다.')).toBeInTheDocument();
    rerender(<WorkerWorkHistory {...props} month="2026-11" />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('1.5공수')).not.toBeInTheDocument();
});

test('조회 실패 시 이전 내역과 합계를 노출하지 않는다', () => {
    render(<WorkerWorkHistory {...props} error="조회 실패" />);
    expect(screen.getByRole('alert')).toHaveTextContent('조회 실패');
    expect(screen.queryByText('1.5공수')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /2026-10-01/ })).not.toBeInTheDocument();
});
