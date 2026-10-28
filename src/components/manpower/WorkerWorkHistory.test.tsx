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

test('작업자 근무내역은 달력으로 통합하고 날짜에서 모든 현장의 상세를 확인한다', () => {
    render(<WorkerWorkHistory {...props} />);
    expect(screen.queryByRole('tab', { name: '목록보기' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: '근무내역 달력' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '2026-10-01 근무내역 1.5공수' }));
    expect(within(screen.getByRole('dialog')).getAllByText('단가')).toHaveLength(2);
    expect(within(screen.getByRole('dialog')).getByText('0.5공수')).toBeInTheDocument();
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
    expect(within(day).getByTitle('지원검증팀 0.75공수')).toBeInTheDocument();
    expect(screen.queryByText('· 지원 0.75공수 포함')).not.toBeInTheDocument();
    expect(screen.queryByText('이전월팀')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: '목록보기' }));
    expect(screen.getByText('· 지원 0.75공수 포함')).toBeInTheDocument();
    const date = screen.getByRole('article', { name: '2026-10-01 출력 내역' });
    expect(within(date).getByRole('button')).toHaveTextContent('1.75공수조회 가능 노무비 100,000원');
    fireEvent.click(within(date).getByRole('button', { expanded: false }));
    const support = within(date).getByRole('list', { name: '지원검증팀 작업자 공수' });
    expect(within(support).getAllByRole('listitem')).toHaveLength(1);
    expect(within(support).getByText('동명')).toBeInTheDocument();
    expect(within(support).getByText('0.75공수')).toBeInTheDocument();
    expect(within(date).getAllByText('동명')).toHaveLength(2);
    expect(screen.queryByText(/900,000|775,000/)).not.toBeInTheDocument();
});

test('현재 명단에서 제외된 작업자도 일보 소속이 같은 팀이면 합쳐 표시하며 급여 비공개는 유지한다', () => {
    const sameTeamRows = [
        { reportId: 'one', date: '2026-10-01', workerId: 'one', workerName: '가상작업자', teamId: 'a', workerTeamId: 'a', workerTeamName: '가람팀', manDay: 1, unitPrice: 100000 },
        { reportId: 'two', date: '2026-10-01', workerId: 'two', workerName: '가상이동인원', teamId: 'a', workerTeamId: 'legacy-a', workerTeamName: '가람팀', manDay: 0.5, isSiteSupport: true, unitPrice: 0 },
    ] as DailyReportWorkerRow[];
    render(<WorkerWorkHistory rows={sameTeamRows} teams={[{ id: 'a', legacyId: 'legacy-a', name: '가람팀', color: '#686868' }]}
        month="2026-10" siteName="가상현장" loading={false} error="" />);
    const day = screen.getByRole('button', { name: '2026-10-01 근무내역 1.5공수' });
    expect(within(day).getAllByText('가람팀')).toHaveLength(1);
    const team = within(day).getByTitle('가람팀 1.5공수');
    expect(team.style.getPropertyValue('--work-team-color')).toBe('#686868');
    expect(screen.queryByText(/지원/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: '목록보기' }));
    fireEvent.click(screen.getByRole('button', { name: '2026-10-01 근무내역', expanded: false }));
    const members = screen.getByRole('list', { name: '가람팀 작업자 공수' });
    expect(within(members).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.queryByText('지원팀')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '2026-10-01 근무 상세' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByText('지원팀')).not.toBeInTheDocument();
    expect(within(dialog).queryByText('0원')).not.toBeInTheDocument();
    expect(within(dialog).getAllByText('단가')).toHaveLength(1);
});

test('날짜 목록은 기본 접힘이며 한 날짜만 펼치고 같은 날짜를 다시 누르면 접힌다', () => {
    const attendance = [...rows, { ...rows[0], reportId: 'next', date: '2026-10-02', workerName: '다음날작업자' }];
    render(<WorkerWorkHistory rows={attendance} month="2026-10" siteName="검증현장" loading={false} error="" />);
    fireEvent.click(screen.getByRole('tab', { name: '목록보기' }));
    const first = screen.getByRole('button', { name: '2026-10-01 근무내역', expanded: false });
    const second = screen.getByRole('button', { name: '2026-10-02 근무내역', expanded: false });
    expect(screen.queryByRole('list', { name: /팀별 공수/ })).not.toBeInTheDocument();
    expect(within(first).getByText('1.5')).toBeInTheDocument();
    fireEvent.click(first);
    const panel = screen.getByRole('region', { name: '2026-10-01 근무내역' });
    expect(first).toHaveAttribute('aria-controls', panel.id);
    expect(panel).toHaveAttribute('aria-labelledby', first.id);
    expect(within(panel).getByText('가상작업자')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(second);
    expect(first).toHaveAttribute('aria-expanded', 'false');
    expect(panel).not.toBeVisible();
    expect(screen.queryByText('가상작업자')).not.toBeInTheDocument();
    expect(screen.getByText('다음날작업자')).toBeInTheDocument();
    fireEvent.click(second);
    expect(second).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('다음날작업자')).not.toBeInTheDocument();
    expect(within(first).getByText('1.5')).toBeInTheDocument();
});

test('조회 대상·월 변경과 로딩·오류 이후에는 펼쳤던 날짜가 초기화된다', () => {
    const initial = { rows, month: '2026-10', siteName: '검증현장', loading: false, error: '' };
    const { rerender } = render(<WorkerWorkHistory {...initial} />);
    fireEvent.click(screen.getByRole('tab', { name: '목록보기' }));
    for (const changed of [{ siteName: '다른현장' }, { month: '2026-11' }, { loading: true }, { error: '조회 실패' }]) {
        fireEvent.click(screen.getByRole('button', { name: '2026-10-01 근무내역', expanded: false }));
        expect(screen.getByRole('list', { name: '2026-10-01 팀별 공수' })).toBeInTheDocument();
        rerender(<WorkerWorkHistory {...initial} {...changed} />);
        rerender(<WorkerWorkHistory {...initial} />);
        expect(screen.getByRole('button', { name: '2026-10-01 근무내역', expanded: false })).toBeInTheDocument();
        expect(screen.queryByRole('list', { name: '2026-10-01 팀별 공수' })).not.toBeInTheDocument();
    }
});

test('달력의 오늘과 주말을 구분하고 빈 월에서도 보기 전환을 유지한다', () => {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    render(<WorkerWorkHistory rows={[]} month={month} siteName="빈현장" loading={false} error="" />);
    const today = screen.getByRole('button', { name: `${month}-${String(now.getDate()).padStart(2, '0')} 근무내역 없음` });
    expect(today).toHaveAttribute('aria-current', 'date');
    expect(screen.getByText('토')).toHaveClass('worker-history__saturday');
    expect(screen.getByText('일')).toHaveClass('worker-history__sunday');
    fireEvent.click(screen.getByRole('tab', { name: '목록보기' }));
    expect(screen.getByText('선택한 기간의 근무내역이 없습니다.')).toBeInTheDocument();
});

test.each(['calendar', 'list'])('%s 날짜 상세는 등록된 팀 색상으로 묶고 지원 급여를 숨긴 채 개별 기록을 보존한다', mode => {
    const attendance = [
        { reportId: 'own', date: '2026-10-01', workerId: 'own', workerName: '동명', workerTeamId: 'a', workerTeamName: '가람팀', responsibleTeamId: 'a', manDay: 1, unitPrice: 100000, workContent: '외벽 작업' },
        { reportId: 'support-1', date: '2026-10-01', workerId: 'support', workerName: '동명', workerTeamId: 'b', workerTeamName: '나래팀', responsibleTeamId: 'a', manDay: 0.25, isSiteSupport: true, unitPrice: 900000, amount: 225000 },
        { reportId: 'support-2', date: '2026-10-01', workerId: 'support', workerName: '동명', workerTeamId: 'b', workerTeamName: '나래팀', responsibleTeamId: 'a', manDay: 0.5, isSiteSupport: true, unitPrice: 900000, amount: 450000 },
    ] as DailyReportWorkerRow[];
    render(<WorkerWorkHistory rows={attendance} teams={[{ id: 'a', name: '가람팀', color: '#2563eb' }, { id: 'b', name: '나래팀', color: '#0d9488' }]}
        month="2026-10" siteName="검증현장" loading={false} error="" />);
    if (mode === 'list') {
        fireEvent.click(screen.getByRole('tab', { name: '목록보기' }));
        fireEvent.click(screen.getByRole('button', { name: '2026-10-01 근무내역', expanded: false }));
        fireEvent.click(screen.getByRole('button', { name: '2026-10-01 근무 상세' }));
    } else fireEvent.click(screen.getByRole('button', { name: '2026-10-01 근무내역 1.75공수' }));
    const dialog = screen.getByRole('dialog');
    const summary = within(dialog).getByRole('region', { name: '일일 출력 요약' });
    expect(summary).toHaveTextContent('총 공수1.75공수투입 인원2명참여 팀2개');
    expect(summary).toHaveTextContent('조회 가능 노무비100,000원');
    const own = within(dialog).getByRole('region', { name: '가람팀 출력 내역' });
    const support = within(dialog).getByRole('region', { name: '나래팀 출력 내역' });
    expect(own.style.getPropertyValue('--work-team-color')).toBe('#2563eb');
    expect(support.style.getPropertyValue('--work-team-color')).toBe('#0d9488');
    expect(within(own).getByText('외벽 작업')).toBeInTheDocument();
    expect(within(support).getAllByRole('article')).toHaveLength(2);
    expect(support).toHaveTextContent('작업자 1명');
    expect(support).toHaveTextContent('팀 합계0.75공수');
    expect(within(support).queryByText('단가')).not.toBeInTheDocument();
    expect(within(support).queryByText('금액')).not.toBeInTheDocument();
    expect(dialog).not.toHaveTextContent(/900,000|225,000|450,000|775,000/);
});

test('지원 기록만 있는 날짜에는 노무비 합계와 급여 정보를 표시하지 않는다', () => {
    render(<WorkerWorkHistory rows={[{ ...rows[0], isSiteSupport: true, workerTeamName: '지원팀', unitPrice: 100000, amount: 100000 }]}
        month="2026-10" siteName="검증현장" loading={false} error="" />);
    fireEvent.click(screen.getByRole('button', { name: '2026-10-01 근무내역 1공수' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).not.toHaveTextContent(/노무비|단가|급여방식|100,000원/);
});

test('지원팀 목록이 없어도 서버에서 전달된 DB 색상이 달력과 날짜 상세에 동일하게 적용된다', () => {
    const attendance = [{ ...rows[0], workerTeamId: 'support', workerTeamName: '지원검증팀', workerTeamColorHex: '#d96cbd', isSiteSupport: true }];
    render(<WorkerWorkHistory rows={attendance} teams={[]} month="2026-10" siteName="검증현장" loading={false} error="" />);
    const day = screen.getByRole('button', { name: '2026-10-01 근무내역 1공수' });
    expect(within(day).getByTitle('지원검증팀 1공수').style.getPropertyValue('--work-team-color')).toBe('#d96cbd');
    fireEvent.click(day);
    const team = within(screen.getByRole('dialog')).getByRole('region', { name: '지원검증팀 출력 내역' });
    expect(team.style.getPropertyValue('--work-team-color')).toBe('#d96cbd');
    expect(within(team).queryByText('단가')).not.toBeInTheDocument();
});
