import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import FieldSchedulePlannerPage from './FieldSchedulePlannerPage';
import { dailyReportService } from '../../services/dailyReportService';
import { notifyResourceStatusChange } from '../../utils/resourceStatusChange';

jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { uid: 'fixture-office', role: 'admin' } }) }));
jest.mock('../../hooks/useWorkerAccessScope', () => {
    const scope = { loading: false, mode: 'all', teamIds: [], teamNames: [], teamNameKeys: [] };
    return {
    useWorkerAccessScope: () => scope,
    workerAccessMatchesSchedule: () => true,
    workerAccessMatchesSite: () => true,
    workerAccessMatchesTeam: () => true,
    workerAccessMatchesWorker: () => true,
    };
});
jest.mock('../../services/dispatchService', () => ({ dispatchService: {} }));
jest.mock('../../services/fieldScheduleRequestService', () => ({ fieldScheduleRequestService: {} }));
jest.mock('../../services/scheduleConfirmationBoardService', () => ({ scheduleConfirmationBoardService: {} }));
jest.mock('../../services/geminiService', () => ({ geminiService: {} }));
jest.mock('../../services/dailyReportService', () => ({ dailyReportService: { getReports: jest.fn(), overwriteReports: jest.fn() } }));
jest.mock('../../services/manpowerService', () => ({ manpowerService: { getWorkers: async () => [
    { id: 'retired', name: '기존퇴사작업자', status: '퇴사', isActive: false, teamId: 'team', teamName: '검증팀', unitPrice: 999999, payType: '일급제' },
    { id: 'restorable', name: '복원대상작업자', status: ' RETIRED ', teamId: 'team', teamName: '검증팀', payType: '일급제' },
    { id: 'active', name: '신규재직작업자', status: '재직', teamId: 'team', teamName: '검증팀', payType: '일급제' },
] } }));
jest.mock('../../services/siteService', () => ({ siteService: { getSites: async () => [
    { id: 'closed', name: '과거종료현장', status: 'completed', responsibleTeamId: 'team', responsibleTeamName: '검증팀' },
    { id: 'restorable-site', name: '복원대상현장', status: 'completed', responsibleTeamId: 'team' },
    { id: 'open', name: '신규진행현장', status: 'active', responsibleTeamId: 'team' },
] } }));
jest.mock('../../services/teamService', () => ({ teamService: { getTeams: async () => [{ id: 'team', name: '검증팀', type: '시공팀' }] } }));
jest.mock('../../services/companyService', () => ({ companyService: { getCompanies: async () => [] } }));
jest.mock('../../services/vehicleService', () => ({ vehicleService: { getVehicles: async () => [] } }));

beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    (dailyReportService.getReports as jest.Mock).mockResolvedValue([{
        id: 'historical-report', date: '2026-09-01', siteId: 'closed', siteName: '과거종료현장',
        teamId: 'team', teamName: '검증팀', workContent: '과거 작업',
        workers: [{ workerId: 'retired', name: '기존퇴사작업자', manDay: 1.5, unitPrice: 200000, payType: '일급제', teamId: 'team' }],
    }]);
    (dailyReportService.overwriteReports as jest.Mock).mockResolvedValue(undefined);
});

function mountBoard() {
    return render(<MemoryRouter initialEntries={['/?date=2026-09-01']}><FieldSchedulePlannerPage mode="daily-report" /></MemoryRouter>);
}

test('종료 현장의 퇴사자 일보를 수정 저장해도 신원·공수·과거 단가가 유지된다', async () => {
    mountBoard();
    expect(await screen.findByText('기존퇴사작업자')).toBeInTheDocument();
    expect(screen.getByText('과거종료현장')).toBeInTheDocument();
    expect(screen.getByText('신규진행현장')).toBeInTheDocument();
    expect(screen.queryByText('복원대상현장')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('작업내용'), { target: { value: '과거 작업 수정' } });
    fireEvent.click(screen.getByRole('button', { name: '일보 저장' }));
    await waitFor(() => expect(dailyReportService.overwriteReports).toHaveBeenCalledTimes(1));
    const [date, reports, teams] = (dailyReportService.overwriteReports as jest.Mock).mock.calls[0];
    expect(date).toBe('2026-09-01');
    expect(teams).toContain('team');
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ siteId: 'closed', totalManDay: 1.5, totalAmount: 300000 });
    expect(reports[0].workers).toEqual([expect.objectContaining({ workerId: 'retired', name: '기존퇴사작업자', manDay: 1.5, unitPrice: 200000, payType: '일급제' })]);
});

test('재개·복직을 즉시 신규 후보에 반영하면서 작성 중인 일보는 보존한다', async () => {
    mountBoard();
    await screen.findByText('기존퇴사작업자');
    fireEvent.change(screen.getByLabelText('작업내용'), { target: { value: '작성 중 메모' } });
    expect(screen.queryByText('복원대상현장')).not.toBeInTheDocument();
    act(() => notifyResourceStatusChange({ kind: 'site', id: 'restorable-site', status: 'active' }));
    expect(screen.getByText('복원대상현장')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '팀/작업자' }));
    expect(screen.getByText('신규재직작업자')).toBeInTheDocument();
    expect(screen.queryByText('복원대상작업자')).not.toBeInTheDocument();
    act(() => notifyResourceStatusChange({ kind: 'worker', id: 'restorable', status: '재직', isActive: true }));
    expect(screen.getByText('복원대상작업자')).toBeInTheDocument();
    expect(screen.getByLabelText('작업내용')).toHaveValue('작성 중 메모');
    expect(dailyReportService.getReports).toHaveBeenCalledTimes(1);
    act(() => notifyResourceStatusChange({ kind: 'worker', id: 'restorable', status: '퇴사', isActive: false }));
    expect(screen.queryByText('복원대상작업자')).not.toBeInTheDocument();
    expect(screen.getByText('기존퇴사작업자')).toBeInTheDocument();
});
