import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FieldRoleDashboardView } from './FieldRoleDashboardView';
import { dailyReportService } from '../../services/dailyReportService';
import type { Worker } from '../../services/manpowerService';

jest.mock('../../services/dailyReportService', () => ({ dailyReportService: { getReports: jest.fn() } }));
jest.mock('../../hooks/useRouteAction', () => ({ useRouteAction: () => jest.fn() }));
const worker = { id: 'worker-a', name: '검증 작업자', teamId: 'team-a' } as Worker;

beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => undefined));
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
