import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { TomorrowScheduleWidget } from './TomorrowScheduleWidget';
import { dispatchService, type DailyDispatch } from '../../../services/dispatchService';

jest.mock('date-fns/locale', () => jest.requireActual('date-fns/locale/ko.cjs'));

jest.mock('../../../services/dispatchService', () => ({ dispatchService: { getDispatchByDate: jest.fn(), getAllDispatches: jest.fn() } }));
jest.mock('../../../services/manpowerService', () => ({ manpowerService: {
    getWorkers: async () => [
        { id: 'w1', name: '가상 작업자', teamId: 't1', teamName: '가상팀' },
        { id: 'w2', name: '다른 작업자', teamId: 't2', teamName: '다른팀' },
    ],
    getWorkerByUid: async () => ({ id: 'w1', teamId: 't1', teamName: '가상팀' }),
} }));
jest.mock('../../../services/siteService', () => ({ siteService: { getSites: async () => [] } }));
jest.mock('../../../services/teamService', () => ({ teamService: { getTeams: async () => [] } }));
jest.mock('../../../services/vehicleService', () => ({ vehicleService: { listAllVehicles: async () => [] } }));
jest.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { uid: 'test-user' } }) }));

const plan = (date: string, siteName = '참고 현장', updated = 1): DailyDispatch => ({
    date,
    assignments: [{ id: 'a1', siteId: 's1', siteName, workerIds: ['w1'], vehicleIds: [] }],
    updatedAt: { toMillis: () => updated } as DailyDispatch['updatedAt'],
});

beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    // UTC로는 20일이지만 한국은 21일: 내일은 22일입니다.
    jest.setSystemTime(new Date('2026-11-20T18:30:00Z'));
    (dispatchService.getDispatchByDate as jest.Mock).mockResolvedValue(null);
    (dispatchService.getAllDispatches as jest.Mock).mockResolvedValue([]);
});

afterEach(() => jest.useRealTimers());

it('내일 일정이 있으면 실제 내일 날짜와 배치만 표시한다', async () => {
    (dispatchService.getDispatchByDate as jest.Mock).mockResolvedValue(plan('2026-11-22', '내일 현장'));
    render(<TomorrowScheduleWidget />);
    const detail = await screen.findByRole('region', { name: '내일 일정 상세' });
    expect(within(detail).getByText('내일 현장')).toBeInTheDocument();
    expect(screen.getByText('2026년 11월 22일 일요일')).toBeInTheDocument();
    expect(dispatchService.getDispatchByDate).toHaveBeenCalledWith('2026-11-22', { throwOnError: true });
    expect(dispatchService.getAllDispatches).not.toHaveBeenCalled();
    expect(screen.queryByText('내일 일정 미등록')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '최근 일정 참고' })).not.toBeInTheDocument();
});

it('내일 미등록을 먼저 보여주고 오늘 일정의 날짜·요약·카드를 참고 영역에 분리한다', async () => {
    (dispatchService.getAllDispatches as jest.Mock).mockResolvedValue([plan('2026-11-21')]);
    render(<TomorrowScheduleWidget />);
    const reference = await screen.findByRole('region', { name: '최근 일정 참고' });
    const missing = screen.getByRole('status');
    expect(missing).toHaveTextContent('내일 일정 미등록');
    expect(missing).toHaveTextContent('2026년 11월 22일 일요일');
    expect(missing.compareDocumentPosition(reference) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(reference).getByRole('heading', { name: '최근 일정 참고' })).toBeInTheDocument();
    expect(within(reference).getByText('2026년 11월 21일 토요일 · 내일 확정 일정이 아닙니다.')).toBeInTheDocument();
    expect(within(reference).getByText('참고 현장')).toBeInTheDocument();
    expect(within(reference).getByText('작업자', { exact: true })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '내일 일정 상세' })).not.toBeInTheDocument();
    expect(screen.getByText('2026년 11월 22일 일요일', { exact: true })).toHaveAttribute('datetime', '2026-11-22');
});

it('참고 일정 응답이 늦어도 내일 미등록 안내를 먼저 표시한다', async () => {
    let resolveReference!: (plans: DailyDispatch[]) => void;
    (dispatchService.getAllDispatches as jest.Mock).mockReturnValue(new Promise(resolve => { resolveReference = resolve; }));
    render(<TomorrowScheduleWidget />);
    expect(await screen.findByText('내일 일정 미등록')).toBeInTheDocument();
    expect(screen.getByText('최근 참고 일정을 확인하고 있습니다.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '최근 일정 참고' })).not.toBeInTheDocument();
    await act(async () => resolveReference([plan('2026-11-20')]));
    expect(screen.getByRole('region', { name: '최근 일정 참고' })).toBeInTheDocument();
    expect(screen.getByText('내일 일정 미등록')).toBeInTheDocument();
});

it.each([null, { ...plan('2026-11-22'), assignments: [] }])('내일 배치와 참고 일정이 없으면 미등록만 표시한다: %j', async tomorrow => {
    (dispatchService.getDispatchByDate as jest.Mock).mockResolvedValue(tomorrow);
    render(<TomorrowScheduleWidget />);
    expect(await screen.findByText('내일 일정 미등록')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('최근 참고 일정을 확인하고 있습니다.')).not.toBeInTheDocument());
    expect(screen.queryByRole('region', { name: '최근 일정 참고' })).not.toBeInTheDocument();
    expect(screen.queryByText('현장', { exact: true })).not.toBeInTheDocument();
});

it('미래·빈 일정을 제외하고 이전 일정 중 가장 최근 저장된 배치를 참고로 표시한다', async () => {
    (dispatchService.getAllDispatches as jest.Mock).mockResolvedValue([
        plan('2026-11-23', '미래 현장', 100),
        { ...plan('2026-11-21', '빈 현장', 90), assignments: [] },
        plan('2026-11-20', '최근 저장 현장', 80),
        plan('2026-11-21', '오늘 다른 현장', 70),
    ]);
    render(<TomorrowScheduleWidget />);
    const reference = await screen.findByRole('region', { name: '최근 일정 참고' });
    expect(within(reference).getByText('최근 저장 현장')).toBeInTheDocument();
    expect(screen.queryByText('미래 현장')).not.toBeInTheDocument();
    expect(screen.queryByText('오늘 다른 현장')).not.toBeInTheDocument();
});

it('내일 조회 실패를 미등록으로 오인하지 않게 오류로 표시한다', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
        (dispatchService.getDispatchByDate as jest.Mock).mockRejectedValue(new Error('test failure'));
        render(<TomorrowScheduleWidget />);
        expect(await screen.findByRole('alert')).toHaveTextContent('현장 일정을 불러오지 못했습니다.');
        expect(screen.queryByText('내일 일정 미등록')).not.toBeInTheDocument();
        expect(screen.queryByText('미등록', { exact: true })).not.toBeInTheDocument();
        expect(dispatchService.getAllDispatches).not.toHaveBeenCalled();
    } finally { log.mockRestore(); }
});

it('참고 조회 실패는 이미 확인한 내일 미등록 상태를 바꾸지 않는다', async () => {
    (dispatchService.getAllDispatches as jest.Mock).mockRejectedValue(new Error('test reference failure'));
    render(<TomorrowScheduleWidget />);
    expect(await screen.findByText('최근 참고 일정을 불러오지 못했습니다.')).toBeInTheDocument();
    expect(screen.getByText('내일 일정 미등록')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('접기와 팀 필터는 참고 영역에만 적용하고 내일 미등록 안내를 유지한다', async () => {
    const referencePlan = plan('2026-11-21');
    referencePlan.assignments.push({ id: 'a2', siteId: 's2', siteName: '다른팀 현장', workerIds: ['w2'], vehicleIds: [] });
    (dispatchService.getAllDispatches as jest.Mock).mockResolvedValue([referencePlan]);
    render(<TomorrowScheduleWidget />);
    const reference = await screen.findByRole('region', { name: '최근 일정 참고' });
    fireEvent.click(within(reference).getByRole('button', { name: '내 팀 포함 현장' }));
    expect(screen.queryByText('다른팀 현장')).not.toBeInTheDocument();
    expect(within(reference).getByText('참고 현장')).toBeInTheDocument();
    fireEvent.click(within(reference).getByRole('button', { name: '접기' }));
    expect(screen.queryByText('참고 현장')).not.toBeInTheDocument();
    expect(screen.getByText('내일 일정 미등록')).toBeInTheDocument();
    fireEvent.click(within(reference).getByRole('button', { name: '펼치기' }));
    expect(within(reference).getByText('참고 현장')).toBeInTheDocument();
});
