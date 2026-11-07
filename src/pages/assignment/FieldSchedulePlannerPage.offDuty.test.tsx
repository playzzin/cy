import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import FieldSchedulePlannerPage from './FieldSchedulePlannerPage';
import { dispatchService } from '../../services/dispatchService';
import { fieldScheduleRequestService } from '../../services/fieldScheduleRequestService';

jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { uid: 'fixture-office', role: 'admin' } }) }));
jest.mock('../../hooks/useWorkerAccessScope', () => {
    const scope = { loading: false, mode: 'all', teamIds: [], teamNames: [], teamNameKeys: [] };
    return { useWorkerAccessScope: () => scope, workerAccessMatchesSchedule: () => true,
        workerAccessMatchesSite: () => true, workerAccessMatchesTeam: () => true, workerAccessMatchesWorker: () => true };
});
jest.mock('../../services/dispatchService', () => ({ dispatchService: { getDispatchByDate: jest.fn(), saveDispatch: jest.fn() } }));
jest.mock('../../services/fieldScheduleRequestService', () => ({
    fieldScheduleRequestService: { listByDate: jest.fn() }, isOffDutyOnlyFieldScheduleRequest: () => true,
}));
jest.mock('../../services/scheduleConfirmationBoardService', () => ({ scheduleConfirmationBoardService: {} }));
jest.mock('../../services/geminiService', () => ({ geminiService: {} }));
jest.mock('../../services/dailyReportService', () => ({ dailyReportService: {} }));
jest.mock('../../services/manpowerService', () => ({ manpowerService: { getWorkers: async () => [
    { id: 'worker-a', name: '검증 작업자 A', status: '재직', teamId: 'team', teamName: '검증팀' },
    { id: 'worker-b', name: '검증 작업자 B', status: '재직', teamId: 'team', teamName: '검증팀' },
] } }));
jest.mock('../../services/siteService', () => ({ siteService: { getSites: async () => [] } }));
jest.mock('../../services/teamService', () => ({ teamService: { getTeams: async () => [{ id: 'team', name: '검증팀', type: '시공팀' }] } }));
jest.mock('../../services/companyService', () => ({ companyService: { getCompanies: async () => [] } }));
jest.mock('../../services/vehicleService', () => ({ vehicleService: { getVehicles: async () => [] } }));

let stored: Record<string, any>;
beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    stored = {};
    (fieldScheduleRequestService.listByDate as jest.Mock).mockResolvedValue([]);
    (dispatchService.getDispatchByDate as jest.Mock).mockImplementation(async date => stored[date] || null);
    (dispatchService.saveDispatch as jest.Mock).mockImplementation(async (date, assignments, offDuty) => {
        stored[date] = JSON.parse(JSON.stringify({ date, assignments, ...offDuty }));
    });
});

async function mountBoard() {
    const view = render(<MemoryRouter initialEntries={['/?date=2026-11-08']}><FieldSchedulePlannerPage /></MemoryRouter>);
    await screen.findByText('아직 만든 일정이 없습니다.');
    fireEvent.click(screen.getByRole('button', { name: '팀/작업자', exact: true }));
    return view;
}

async function save() {
    fireEvent.click(screen.getByRole('button', { name: '저장', exact: true }));
    await screen.findByText('일정이 저장되었습니다.');
    expect(screen.getByRole('button', { name: '저장됨' })).toBeDisabled();
}

test('휴무자만 선택해도 저장할 수 있고 메뉴 재진입·새로고침 후 복원된다', async () => {
    const view = await mountBoard();
    fireEvent.click(screen.getByRole('button', { name: '휴무자 선택' }));
    fireEvent.click(screen.getByRole('button', { name: '검증 작업자 A', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: '휴무자로 분리' }));
    expect(screen.getByText('휴무자 1명')).toBeInTheDocument();
    await save();
    expect(stored['2026-11-08']).toMatchObject({ assignments: [], offDutyWorkerIds: ['worker-a'] });
    view.unmount();
    window.localStorage.clear();
    await mountBoard();
    expect(screen.getByText('휴무자 1명')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '검증 작업자 A', exact: true })).not.toBeInTheDocument();
    expect(screen.getByText('검증 작업자 A')).toBeInTheDocument();
});

test('요청에서 가져온 휴무자 전체 해제를 저장하면 재등장하지 않고 새 요청은 반영된다', async () => {
    const requests = [{ status: 'requested', offDutyWorkerIds: ['worker-a'] }];
    (fieldScheduleRequestService.listByDate as jest.Mock).mockImplementation(async () => requests);
    const view = await mountBoard();
    fireEvent.click(screen.getByRole('button', { name: '전체 해제', exact: true }));
    await save();
    view.unmount();
    requests.push({ status: 'requested', offDutyWorkerIds: ['worker-b'] });
    const next = await mountBoard();
    expect(screen.getByText('휴무자 1명')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '검증 작업자 A', exact: true })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '검증 작업자 B', exact: true })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /휴무자 선택/ }));
    fireEvent.click(screen.getByRole('button', { name: '검증 작업자 A', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: '휴무자로 분리' }));
    await save();
    next.unmount();
    await mountBoard();
    expect(screen.getByText('휴무자 2명')).toBeInTheDocument();
});

test('개별 제외를 저장하고 날짜를 왕복해도 날짜별 휴무자가 섞이지 않는다', async () => {
    stored['2026-11-08'] = { assignments: [], offDutyWorkerIds: ['worker-a', 'worker-b'] };
    await mountBoard();
    fireEvent.click(screen.getAllByTitle('휴무자에서 제외')[0]);
    await save();
    fireEvent.click(screen.getByRole('button', { name: '다음일' }));
    await waitFor(() => expect(dispatchService.getDispatchByDate).toHaveBeenLastCalledWith('2026-11-09', { throwOnError: true }));
    await waitFor(() => expect(screen.queryByText('휴무자 1명')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: '이전일' }));
    await screen.findByText('휴무자 1명');
    expect(stored['2026-11-08'].offDutyWorkerIds).toHaveLength(1);
});

test('저장 실패 시 저장 완료로 바뀌지 않고 선택을 유지해 재시도한다', async () => {
    stored['2026-11-08'] = { assignments: [], offDutyWorkerIds: ['worker-a'] };
    await mountBoard();
    fireEvent.click(screen.getByRole('button', { name: '전체 해제', exact: true }));
    (dispatchService.saveDispatch as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
        fireEvent.click(screen.getByRole('button', { name: '저장', exact: true }));
        await screen.findByText('저장에 실패했습니다. 잠시 후 다시 시도해주세요.');
        expect(screen.getByRole('button', { name: '저장', exact: true })).toBeEnabled();
        expect(screen.queryByText('휴무자 1명')).not.toBeInTheDocument();
        await save();
    } finally { error.mockRestore(); }
});
