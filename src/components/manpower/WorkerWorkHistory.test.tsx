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

test('현장 달력과 목록은 같은 날의 지원팀·작업자 공수를 합산하며 지원 급여는 합산하지 않는다', () => {
    const supportRows = [
        { reportId: 'own', date: '2026-10-01', workerId: 'own', workerName: '동명', workerTeamId: 'a', workerTeamName: '검증팀', manDay: 1, unitPrice: 100000 },
        { reportId: 'support-1', date: '2026-10-01', workerId: 'support', workerName: '동명', workerTeamId: 'b', workerTeamName: '지원검증팀', isSiteSupport: true, manDay: 0.25, unitPrice: 900000 },
        { reportId: 'support-2', date: '2026-10-01', workerId: 'support', workerName: '동명', workerTeamId: 'b', workerTeamName: '지원검증팀', isSiteSupport: true, manDay: 0.5, unitPrice: 900000 },
        { reportId: 'outside', date: '2026-09-01', workerId: 'outside', workerTeamName: '이전월팀', manDay: 50 },
        { reportId: 'empty', date: '2026-10-01', isEmptyReport: true, workerId: '__empty__', manDay: 0 },
    ] as DailyReportWorkerRow[];
    render(<WorkerWorkHistory rows={supportRows} month="2026-10" siteName="검증현장" loading={false} error="" />);
    const day = screen.getByRole('button', { name: '2026-10-01 근무내역 1.75공수' });
    expect(within(day).getByText('2명')).toBeInTheDocument();
    expect(within(day).getByTitle('지원팀 지원검증팀 0.75공수')).toBeInTheDocument();
    expect(screen.getByText('· 지원 0.75공수 포함')).toBeInTheDocument();
    expect(screen.queryByText('이전월팀')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: '목록보기' }));
    const date = screen.getByRole('article', { name: '2026-10-01 출력 내역' });
    expect(within(date).getByRole('button')).toHaveTextContent('1.75공수내 팀 100,000원');
    const support = within(date).getByRole('list', { name: '지원검증팀 작업자 공수' });
    expect(within(support).getAllByRole('listitem')).toHaveLength(1);
    expect(within(support).getByText('동명')).toBeInTheDocument();
    expect(within(support).getByText('0.75공수')).toBeInTheDocument();
    expect(within(date).getAllByText('동명')).toHaveLength(2);
    expect(screen.queryByText(/900,000|775,000/)).not.toBeInTheDocument();
});
