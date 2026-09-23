import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import WorkerAdvanceRequestPage from './WorkerAdvanceRequestPage';
import { manpowerService } from '../../services/manpowerService';
import { dailyReportService } from '../../services/dailyReportService';
import { advancePaymentService } from '../../services/advancePaymentService';
import { advanceRequestService } from '../../services/advanceRequestService';
import { getTeamScopedRows } from '../../services/teamScopedReadService';
jest.mock('../../services/teamScopedReadService', () => ({ getTeamScopedRows: jest.fn() }));

jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { uid: 'leader' } }) }));
jest.mock('../../services/manpowerService', () => ({ manpowerService: { getWorkers: jest.fn() } }));
jest.mock('../../services/userService', () => ({ userService: { getUser: async () => ({ linkedWorkerIds: ['worker-a'] }) } }));
jest.mock('../../services/dailyReportService', () => ({ dailyReportService: { getWorkerRows: jest.fn() } }));
jest.mock('../../services/advancePaymentService', () => ({ advancePaymentService: { getAdvancePaymentsByYearMonth: jest.fn() } }));
jest.mock('../../services/advanceRequestService', () => ({ advanceRequestService: { listForWorkerIds: jest.fn(), createRequest: jest.fn() } }));
jest.mock('../../services/payrollConfigService', () => ({ ADVANCE_ITEM_LABEL_KEYS: ['advance1'] }));

const worker = { id: 'worker-a', legacyId: 'legacy-a', uid: 'leader', name: '테스트 팀장', teamId: 'team-a', status: '재직' };
const month = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};
beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { randomUUID: () => 'delegation-request-id' } });
    (getTeamScopedRows as jest.Mock).mockResolvedValue(null);
    (manpowerService.getWorkers as jest.Mock).mockResolvedValue([worker]);
    (dailyReportService.getWorkerRows as jest.Mock).mockResolvedValue([
        { workerId: 'legacy-a', workerName: worker.name, date: `${month()}-01`, amount: 300000 },
        { workerId: 'different-worker', workerName: worker.name, date: `${month()}-01`, amount: 900000 },
    ]);
    (advancePaymentService.getAdvancePaymentsByYearMonth as jest.Mock).mockImplementation(async (year, m) =>
        `${year}-${String(m).padStart(2, '0')}` === month() ? [{ workerId: 'worker-a', items: { advance1: 50000 } }] : []);
    (advanceRequestService.listForWorkerIds as jest.Mock).mockResolvedValue([
        { id: 'request-a', workerId: 'worker-a', yearMonth: month(), requestedAmount: 20000, status: 'requested' },
    ]);
});

it('팀장이 서버에서 허용한 소속 팀원을 선택해 가불을 대신 신청한다', async () => {
    const member = { ...worker, id: 'member-a', legacyId: '', uid: '', name: '팀원 테스트' };
    (getTeamScopedRows as jest.Mock).mockResolvedValue([worker, member]);
    (dailyReportService.getWorkerRows as jest.Mock).mockResolvedValue([{ workerId: 'member-a', date: `${month()}-01`, amount: 300000 }]);
    (advanceRequestService.createRequest as jest.Mock).mockResolvedValue('saved');
    render(<WorkerAdvanceRequestPage />);
    fireEvent.click(await screen.findByRole('button', { name: /팀원 테스트/ }));
    await screen.findAllByText('300,000원');
    fireEvent.change(screen.getByRole('textbox', { name: '신청 금액 원' }), { target: { value: '10000' } });
    fireEvent.click(screen.getByRole('button', { name: '가불 신청' }));
    await waitFor(() => expect(advanceRequestService.createRequest).toHaveBeenCalledWith(
        expect.objectContaining({ workerId: 'member-a', requesterUid: 'leader', requestedAmount: 10000 }), expect.any(String)));
});

it('본인 근무금액에서 기존 가불과 유효 신청을 빼고 동명이인은 합산하지 않는다', async () => {
    render(<WorkerAdvanceRequestPage />);
    await screen.findAllByText('230,000원');
    fireEvent.change(screen.getByRole('textbox', { name: '신청 금액 원' }), { target: { value: '230000' } });
    expect(screen.getByRole('button', { name: '가불 신청' })).toBeEnabled();
    fireEvent.change(screen.getByRole('textbox', { name: '신청 금액 원' }), { target: { value: '230001' } });
    expect(screen.getByRole('button', { name: '가불 신청' })).toBeDisabled();
    expect(screen.queryByText('900,000원')).not.toBeInTheDocument();
});

it('신청 조회 실패를 내역 없음이나 신청 가능액으로 표시하지 않고 재조회 후 회복한다', async () => {
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
    (advanceRequestService.listForWorkerIds as jest.Mock).mockRejectedValueOnce({ code: 'permission-denied' });
    render(<WorkerAdvanceRequestPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('신청 내역을 불러오지 못해');
    expect(screen.queryByText('신청 내역 없음')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '가불 신청' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '새로고침' }));
    await screen.findAllByText('230,000원');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    errorLog.mockRestore();
});

it('월 변경 후 늦게 도착한 이전 응답이 새 금액을 덮어쓰지 않는다', async () => {
    let resolveOld!: (rows: any[]) => void;
    (dailyReportService.getWorkerRows as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
    render(<WorkerAdvanceRequestPage />);
    await waitFor(() => expect(resolveOld).toBeDefined());
    fireEvent.change(screen.getByLabelText('기준월'), { target: { value: '2025-01' } });
    await waitFor(() => expect(screen.getByRole('button', { name: '새로고침' })).toBeEnabled());
    await act(async () => resolveOld([{ workerId: 'worker-a', date: `${month()}-01`, amount: 999999 }]));
    expect(screen.queryByText('929,999원')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '최대' })).toBeDisabled();
});


it('저장 중 월을 바꿔도 완료 후 현재 월을 다시 계산하며 요청 ID를 재사용한다', async () => {
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { randomUUID: () => 'fixture-request-id' } });
    let resolveSave!: (id: string) => void;
    (advanceRequestService.createRequest as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { resolveSave = resolve; }));
    render(<WorkerAdvanceRequestPage />);
    await screen.findAllByText('230,000원');
    fireEvent.change(screen.getByRole('textbox', { name: '신청 금액 원' }), { target: { value: '10000' } });
    fireEvent.click(screen.getByRole('button', { name: '가불 신청' }));
    await waitFor(() => expect(resolveSave).toBeDefined());
    fireEvent.change(screen.getByLabelText('기준월'), { target: { value: '2025-01' } });
    await act(async () => resolveSave('saved'));
    await waitFor(() => expect(screen.getByRole('button', { name: '새로고침' })).toBeEnabled());
    expect(screen.queryByText('계산 중')).not.toBeInTheDocument();
    expect(dailyReportService.getWorkerRows).toHaveBeenLastCalledWith({ startDate: '2024-12-01', endDate: '2025-01-31' });
    expect(advanceRequestService.createRequest).toHaveBeenCalledWith(expect.objectContaining({ yearMonth: month() }), 'fixture-request-id');
});
