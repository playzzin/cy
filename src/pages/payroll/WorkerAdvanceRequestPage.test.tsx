import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
jest.mock('../../services/advanceRequestService', () => ({ advanceRequestService: { listForWorkerIds: jest.fn(), createRequest: jest.fn(), cancelRequest: jest.fn(), setCategory: jest.fn() } }));
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
    (advanceRequestService.cancelRequest as jest.Mock).mockResolvedValue(undefined);
});

it('모바일은 팀 색상과 이름 옆 금액으로 회차별 신청하며 직책·당시 가능액을 숨긴다', async () => {
    const original = window.matchMedia;
    Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: () => ({ matches: true, addEventListener: jest.fn(), removeEventListener: jest.fn() }) });
    (getTeamScopedRows as jest.Mock).mockResolvedValue([{ ...worker, role: '표시하지 않을 직책', teamName: '색상 팀', color: '#ff3300' }]);
    (advanceRequestService.createRequest as jest.Mock).mockResolvedValue('saved');
    const view = render(<WorkerAdvanceRequestPage />);
    try {
        const first = await screen.findByRole('textbox', { name: '테스트 팀장 1회차 신청 금액' });
        await screen.findAllByText('230,000원');
        expect(screen.getByRole('img', { name: '색상 팀' })).toHaveStyle({ backgroundColor: '#ff3300' });
        expect(screen.queryByText('표시하지 않을 직책')).not.toBeInTheDocument();
        expect(screen.queryByText('당시 가능액')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: '선입금' })).not.toBeInTheDocument();
        fireEvent.change(first, { target: { value: '10000' } });
        fireEvent.click(screen.getByRole('button', { name: '2회차' }));
        const second = screen.getByRole('textbox', { name: '테스트 팀장 2회차 신청 금액' });
        expect(second).toHaveValue('');
        fireEvent.change(second, { target: { value: '20000' } });
        fireEvent.click(screen.getByRole('button', { name: '1회차' }));
        expect(screen.getByRole('textbox', { name: '테스트 팀장 1회차 신청 금액' })).toHaveValue('10,000');
        fireEvent.click(screen.getByRole('button', { name: '테스트 팀장 가불 신청' }));
        await screen.findByText('가불 신청을 등록했습니다.');
        expect(advanceRequestService.createRequest).toHaveBeenCalledWith(expect.objectContaining({ category: 'first', requestedAmount: 10000, workerId: 'worker-a' }), expect.any(String));
    } finally { view.unmount(); window.matchMedia = original; }
});

it('팀장이 서버에서 허용한 소속 팀원을 선택해 가불을 대신 신청한다', async () => {
    const member = { ...worker, id: 'member-a', legacyId: '', uid: '', name: '팀원 테스트' };
    (getTeamScopedRows as jest.Mock).mockResolvedValue([worker, member]);
    (dailyReportService.getWorkerRows as jest.Mock).mockResolvedValue([{ workerId: 'member-a', date: `${month()}-01`, amount: 300000 }]);
    (advanceRequestService.createRequest as jest.Mock).mockResolvedValue('saved');
    render(<WorkerAdvanceRequestPage />);
    fireEvent.click(await screen.findByRole('button', { name: /팀원 테스트/ }));
    await screen.findAllByText('300,000원');
    fireEvent.click(screen.getByRole('button', { name: '2회차' }));
    fireEvent.change(screen.getByRole('textbox', { name: '신청 금액 원' }), { target: { value: '10000' } });
    fireEvent.click(screen.getByRole('button', { name: '가불 신청' }));
    await waitFor(() => expect(advanceRequestService.createRequest).toHaveBeenCalledWith(
        expect.objectContaining({ workerId: 'member-a', requesterUid: 'leader', requestedAmount: 10000, category: 'second' }), expect.any(String)));
    await waitFor(() => expect(screen.getByRole('button', { name: '새로고침' })).toBeEnabled());
    expect(screen.getByText('가불 신청을 등록했습니다.')).toBeInTheDocument();
});

it('신청 취소 후 내역 재조회가 완료되어도 취소 안내를 유지한다', async () => {
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
    (advanceRequestService.cancelRequest as jest.Mock).mockImplementation(async () => {
        (advanceRequestService.listForWorkerIds as jest.Mock).mockResolvedValue([
            { id: 'request-a', workerId: 'worker-a', yearMonth: month(), requestedAmount: 20000, status: 'cancelled' },
        ]);
    });
    try {
        render(<WorkerAdvanceRequestPage />);
        fireEvent.click(await screen.findByRole('button', { name: '신청 취소' }));
        await waitFor(() => expect(advanceRequestService.cancelRequest).toHaveBeenCalled());
        await waitFor(() => expect(screen.getByRole('button', { name: '새로고침' })).toBeEnabled());
        expect(screen.getByText('신청을 취소했습니다.')).toBeInTheDocument();
        expect(screen.queryByRole('article')).not.toBeInTheDocument();
        expect(screen.getByText('신청 내역 없음')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: '새로고침' }));
        await waitFor(() => expect(screen.getByRole('button', { name: '새로고침' })).toBeEnabled());
        expect(screen.queryByRole('article')).not.toBeInTheDocument();
    } finally { confirm.mockRestore(); }
});

it('1회차·2회차만 신청할 수 있고 기존 회차 누락은 미지정으로 표시한다', async () => {
    render(<WorkerAdvanceRequestPage />);
    const first = await screen.findByRole('button', { name: '1회차' });
    expect(first).toHaveAttribute('aria-pressed', 'true');
    for (const name of ['1회차', '2회차']) expect(screen.getByRole('button', { name })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '선입금' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '2회차' }));
    expect(first).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: '2회차' })).toHaveAttribute('aria-pressed', 'true');
    await screen.findByRole('button', { name: '신청 취소' });
    expect(within(screen.getByRole('article')).getByText('회차 미지정')).toBeInTheDocument();
});

it('신청 내역은 회차별로 조회하되 신청 입력 분류와 한도 계산에는 영향을 주지 않는다', async () => {
    (advanceRequestService.listForWorkerIds as jest.Mock).mockResolvedValue([
        { id: 'one', workerId: 'worker-a', yearMonth: month(), requestedAmount: 10000, category: 'first', status: 'requested' },
        { id: 'two', workerId: 'worker-a', yearMonth: month(), requestedAmount: 15000, category: 'second', status: 'approved' },
        { id: 'legacy', workerId: 'worker-a', yearMonth: month(), requestedAmount: 20000, status: 'requested' },
    ]);
    render(<WorkerAdvanceRequestPage />);
    await screen.findAllByText('205,000원');
    expect(screen.getAllByRole('article')).toHaveLength(3);
    const select = screen.getByRole('combobox', { name: '신청 내역 분류' });
    fireEvent.change(select, { target: { value: 'second' } });
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(within(screen.getByRole('article')).getByText('15,000원')).toBeInTheDocument();
    expect(screen.getAllByText('205,000원').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: '1회차' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.change(select, { target: { value: 'unclassified' } });
    expect(within(screen.getByRole('article')).getByText('20,000원')).toBeInTheDocument();
    fireEvent.change(select, { target: { value: 'all' } });
    expect(screen.getAllByRole('article')).toHaveLength(3);
});

it('본인의 처리 전 미분류 신청을 1회차로 수정하고 내역을 다시 불러온다', async () => {
    const row = { id: 'legacy', workerId: 'worker-a', requesterUid: 'leader', yearMonth: month(), requestedAmount: 20000, status: 'requested' };
    (advanceRequestService.listForWorkerIds as jest.Mock).mockResolvedValue([row]);
    (advanceRequestService.setCategory as jest.Mock).mockImplementation(async () => {
        (advanceRequestService.listForWorkerIds as jest.Mock).mockResolvedValue([{ ...row, category: 'first' }]);
    });
    render(<WorkerAdvanceRequestPage />);
    const select = await screen.findByRole('combobox', { name: '20,000원 신청 분류 수정' });
    expect(select).toHaveValue('unclassified');
    fireEvent.change(select, { target: { value: 'first' } });
    await screen.findByText('신청 분류를 수정했습니다.');
    expect(advanceRequestService.setCategory).toHaveBeenCalledWith('legacy', 'first', 'unclassified');
    expect(screen.getByRole('combobox', { name: '20,000원 신청 분류 수정' })).toHaveValue('first');
    expect(advanceRequestService.createRequest).not.toHaveBeenCalled();
});

it('다른 신청자 또는 이미 처리된 신청에는 분류 수정 입력을 제공하지 않는다', async () => {
    (advanceRequestService.listForWorkerIds as jest.Mock).mockResolvedValue([
        { id: 'other', workerId: 'worker-a', requesterUid: 'someone-else', yearMonth: month(), requestedAmount: 10000, status: 'requested' },
        { id: 'approved', workerId: 'worker-a', requesterUid: 'leader', yearMonth: month(), requestedAmount: 10000, status: 'approved' },
    ]);
    render(<WorkerAdvanceRequestPage />);
    await screen.findAllByText('230,000원');
    expect(screen.queryByRole('combobox', { name: /신청 분류 수정/ })).not.toBeInTheDocument();
});

it('저장 실패 후 동일 신청은 재시도 ID를 유지하고 분류가 바뀌면 새 ID를 사용한다', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    let sequence = 0;
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { randomUUID: () => `request-${++sequence}` } });
    (advanceRequestService.createRequest as jest.Mock).mockRejectedValueOnce(new Error('offline')).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce('saved');
    try {
        render(<WorkerAdvanceRequestPage />);
        await screen.findAllByText('230,000원');
        fireEvent.change(screen.getByRole('textbox', { name: '신청 금액 원' }), { target: { value: '10000' } });
        const submit = screen.getByRole('button', { name: '가불 신청' });
        fireEvent.click(submit);
        await waitFor(() => expect(submit).toBeEnabled());
        fireEvent.click(submit);
        await waitFor(() => expect(submit).toBeEnabled());
        fireEvent.click(screen.getByRole('button', { name: '2회차' }));
        fireEvent.change(screen.getByRole('textbox', { name: '신청 금액 원' }), { target: { value: '10000' } });
        fireEvent.click(submit);
        await waitFor(() => expect(advanceRequestService.createRequest).toHaveBeenCalledTimes(3));
        expect((advanceRequestService.createRequest as jest.Mock).mock.calls.map(call => call[1])).toEqual(['request-1', 'request-1', 'request-2']);
        expect(advanceRequestService.createRequest).toHaveBeenLastCalledWith(expect.objectContaining({ category: 'second' }), 'request-2');
        await screen.findByText('가불 신청을 등록했습니다.');
    } finally { log.mockRestore(); }
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
