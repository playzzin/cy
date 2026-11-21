import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FieldRoleDashboardView } from './FieldRoleDashboardView';
import { dailyReportService } from '../../services/dailyReportService';
import type { Worker } from '../../services/manpowerService';

jest.mock('../../services/dailyReportService', () => ({ dailyReportService: { getReports: jest.fn() } }));
const mockNavigate = jest.fn();
jest.mock('../../hooks/useRouteAction', () => ({ useRouteAction: () => mockNavigate }));
const worker = { id: 'worker-a', name: '검증 작업자', teamId: 'team-a' } as Worker;

beforeEach(() => { jest.clearAllMocks(); jest.spyOn(console, 'error').mockImplementation(() => undefined); });
afterEach(() => jest.restoreAllMocks());

test('조회 실패를 0공수나 기록 없음으로 표시하지 않고 원인과 재시도를 제공한다', async () => {
    (dailyReportService.getReports as jest.Mock)
        .mockRejectedValueOnce(Object.assign(new Error('연결된 작업자에게 소속 팀이 지정되지 않았습니다.'), { code: 'functions/failed-precondition' }))
        .mockResolvedValueOnce([]);
    render(<FieldRoleDashboardView role="teamLead" linkedWorker={worker} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('기존 작업자와 계정 연결, 소속 팀 지정');
    expect(screen.queryByText('오늘 팀 공수')).not.toBeInTheDocument();
    expect(screen.queryByText('최근 30일 동안 소속 팀의 출역 기록이 없습니다.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '다시 불러오기' }));
    await screen.findByText('오늘 팀 공수');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(dailyReportService.getReports).toHaveBeenCalledTimes(2);
});


test('팀장 바로가기는 조회·신청 메뉴로 연결하고 일보 입력을 요구하지 않는다', async () => {
    (dailyReportService.getReports as jest.Mock).mockResolvedValue([]);
    render(<FieldRoleDashboardView role="teamLead" linkedWorker={worker} />);
    await screen.findByText('오늘 팀 공수');
    for (const [label, path] of [
        ['근무내역 확인', '/manpower/team-worker-history'],
        ['현장 현황', '/manpower/site-responsible-detail'],
        ['팀 요청함', '/team/requests'],
        ['팀 정산', '/payroll/team-settlement'],
        ['등록 팀원 보기', '/manpower/team-worker-detail'],
    ]) {
        fireEvent.click(screen.getByRole('button', { name: new RegExp(label) }));
        expect(mockNavigate).toHaveBeenLastCalledWith(path);
    }
    for (const button of screen.getAllByRole('button', { name: '근무내역 보기' })) {
        fireEvent.click(button);
        expect(mockNavigate).toHaveBeenLastCalledWith('/manpower/team-worker-history');
    }
    expect(screen.queryByRole('button', { name: /일보 작성|일보 목록/ })).not.toBeInTheDocument();
    expect(screen.queryByText('오늘 일보 작성 필요')).not.toBeInTheDocument();
    expect(screen.getAllByText('오늘 일보 미등록 · 출역 여부 확인')).not.toHaveLength(0);
});

test('출역 인원은 등록 인원과 구분하고 다른 팀·0공수·중복 작업자를 제외한다', async () => {
    (dailyReportService.getReports as jest.Mock).mockResolvedValue([
        { id: 'r1', date: '2026-11-21', teamId: 'team-a', totalManDay: 3, workers: [
            { workerId: 'a', teamId: 'team-a', manDay: 1 },
            { workerId: 'b', teamId: 'team-b', manDay: 1 },
            { workerId: 'c', teamId: 'team-a', manDay: 0 },
            { workerId: 'a', teamId: 'team-a', manDay: 1 },
        ] },
    ]);
    render(<FieldRoleDashboardView role="teamLead" linkedWorker={worker} />);
    await screen.findByText('최근 30일 출역 인원');
    const metric = screen.getAllByRole('article').find(article => within(article).queryByText('최근 30일 출역 인원'));
    expect(metric).toHaveTextContent('1명');
    expect(metric).toHaveTextContent('등록 팀원 수와 다릅니다');
});
