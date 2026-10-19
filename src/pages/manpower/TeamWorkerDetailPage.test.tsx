import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import TeamWorkerDetailPage from './TeamWorkerDetailPage';
import { useRestrictedTeamWorkflow } from '../../routes/TeamWorkflowGate';
import { teamResourceStatusService } from '../../services/teamResourceStatusService';
import { showConfirmAlert } from '../../utils/swal';
import { manpowerService } from '../../services/manpowerService';
import { teamService } from '../../services/teamService';
import { dailyReportService } from '../../services/dailyReportService';
import { useWorkerAccessScope } from '../../hooks/useWorkerAccessScope';

jest.mock('../../config/firebase', () => ({ storage: {} }));
jest.mock('../../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../services/userService', () => ({ userService: {} }));
jest.mock('../../services/manpowerService', () => ({ manpowerService: { getWorkers: jest.fn() } }));
jest.mock('../../services/teamService', () => ({ teamService: { getTeams: jest.fn() } }));
jest.mock('../../services/dailyReportService', () => ({ dailyReportService: { getWorkerRows: jest.fn() } }));
jest.mock('../../hooks/useWorkerAccessScope', () => ({
    ...jest.requireActual('../../hooks/useWorkerAccessScope'), useWorkerAccessScope: jest.fn(),
}));
jest.mock('../../components/SecureSignature', () => () => null);
jest.mock('../../components/signatures/SignatureGeneratorModal', () => () => null);
jest.mock('../../routes/TeamWorkflowGate', () => ({ useRestrictedTeamWorkflow: jest.fn() }));
jest.mock('../../services/teamResourceStatusService', () => ({ teamResourceStatusService: { update: jest.fn() } }));
jest.mock('../../utils/swal', () => ({ showConfirmAlert: jest.fn(), toast: { error: jest.fn(), success: jest.fn(), warning: jest.fn() } }));

const workers = [
    { id: 'one', name: '가상하나', teamId: 'a', teamName: '검증팀', companyName: '청연이엔지', status: '재직', unitPrice: 100000 },
    { id: 'two', name: '가상둘', teamId: 'a', teamName: '검증팀', companyName: '청연이엔지', status: '재직', unitPrice: 200000 },
    { id: 'duplicate', name: '가상둘', teamId: 'a', teamName: '검증팀', companyName: '청연이엔지', status: '재직', unitPrice: 300000 },
    { id: 'outside', name: '다른팀사람', teamId: 'b', teamName: '다른팀', companyName: '청연이엔지', status: '재직', unitPrice: 400000 },
];

beforeEach(() => {
    jest.clearAllMocks();
    (useRestrictedTeamWorkflow as jest.Mock).mockReturnValue(false);
    (showConfirmAlert as jest.Mock).mockResolvedValue({ isConfirmed: true });
    (teamResourceStatusService.update as jest.Mock).mockImplementation(async input => ({ id: input.id, status: input.status, isActive: input.status === '재직' }));
    window.matchMedia = jest.fn().mockReturnValue({ matches: false });
    (teamService.getTeams as jest.Mock).mockResolvedValue([
        { id: 'a', name: '검증팀', companyName: '청연이엔지' }, { id: 'b', name: '다른팀', companyName: '청연이엔지' },
    ]);
    (manpowerService.getWorkers as jest.Mock).mockResolvedValue(workers);
    (useWorkerAccessScope as jest.Mock).mockReturnValue({
        mode: 'team', loading: false, label: '소속팀', teamIds: ['a'], teamNameKeys: ['검증팀'],
        teamWorkerIds: [], teamWorkerNameKeys: [], workerIds: [], workerUids: [], workerNameKeys: [],
    });
    (dailyReportService.getWorkerRows as jest.Mock).mockImplementation(async ({ startDate }) => workers.map(worker => ({
        reportId: worker.id, date: startDate, workerId: worker.id, workerName: worker.name,
        teamId: worker.teamId, teamName: worker.teamName, siteId: worker.id, siteName: `${worker.id} 검증현장`,
        manDay: 1, unitPrice: worker.unitPrice, amount: worker.unitPrice, workContent: '검증 작업',
    })));
});

test('급여명세서는 이름 검색 후 명시적으로 선택하며 동명이인과 타 팀의 기록이 섞이지 않는다', async () => {
    render(<TeamWorkerDetailPage view="payslip" />);
    await screen.findByRole('button', { name: /가상하나.*검증팀/ });
    expect(screen.queryByRole('button', { name: /다른팀사람/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('월별 노임명세서')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '인쇄' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('작업자 검색'), { target: { value: '가상둘' } });
    expect(screen.queryByRole('button', { name: /가상하나.*검증팀/ })).not.toBeInTheDocument();
    const results = screen.getAllByRole('button', { name: /가상둘.*검증팀/ });
    expect(results).toHaveLength(2);
    fireEvent.click(results[0]);
    const document = await screen.findByLabelText('월별 노임명세서');
    expect(within(document).getAllByText('two 검증현장').length).toBeGreaterThan(0);
    expect(within(document).queryByText('duplicate 검증현장')).not.toBeInTheDocument();
    expect(screen.queryByRole('tablist', { name: '월별 작업자 문서' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '인쇄' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '사진 저장' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '카톡·공유' })).toBeEnabled();
    fireEvent.change(screen.getByLabelText('작업자 검색'), { target: { value: '없는이름' } });
    expect(screen.queryByLabelText('월별 노임명세서')).not.toBeInTheDocument();
    expect(screen.getByText('조건에 맞는 작업자가 없습니다.')).toBeInTheDocument();
});

test('출력일보에서 작업자 선택, 목록 전환, 조회월 변경을 바로 수행한다', async () => {
    render(<TeamWorkerDetailPage view="dailyReport" />);
    fireEvent.change(screen.getByLabelText('작업자 빠른 검색', { selector: 'input' }), { target: { value: '가상하나' } });
    fireEvent.click(await screen.findByRole('button', { name: /가상하나.*검증팀/ }));
    expect(await screen.findByLabelText(/가상하나의 .* 출력일보 달력/)).toBeInTheDocument();
    expect(screen.queryByLabelText('월별 노임명세서')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /목록보기/ }));
    expect(screen.getAllByText('one 검증현장').length).toBeGreaterThan(0);
    const firstMonth = (dailyReportService.getWorkerRows as jest.Mock).mock.calls[0][0].startDate;
    fireEvent.click(screen.getByRole('button', { name: '이전 달' }));
    await waitFor(() => expect(dailyReportService.getWorkerRows).toHaveBeenCalledTimes(2));
    expect((dailyReportService.getWorkerRows as jest.Mock).mock.calls[1][0].startDate).not.toBe(firstMonth);
    expect(screen.getByRole('heading', { name: '가상하나' })).toBeInTheDocument();
});

test('문서 조회에 실패하면 잘못된 0원 명세서를 보여주거나 인쇄하지 않는다', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    (dailyReportService.getWorkerRows as jest.Mock).mockRejectedValue(new Error('test failure'));
    render(<TeamWorkerDetailPage view="payslip" />);
    fireEvent.click(await screen.findByRole('button', { name: /가상하나.*검증팀/ }));
    expect(await screen.findByText('급여명세서를 표시할 수 없습니다. 새로고침해 주세요.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '인쇄' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'CSV 내보내기' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: '사진 저장' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '카톡·공유' })).not.toBeInTheDocument();
    log.mockRestore();
});

test('작업자정보 메뉴는 기존 기본정보 조회를 유지한다', async () => {
    render(<TeamWorkerDetailPage view="profile" />);
    expect(screen.getByRole('heading', { name: '작업자정보' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '가상둘' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '작업자 정보' })).toBeInTheDocument();
    expect(screen.queryByLabelText('월별 노임명세서')).not.toBeInTheDocument();
});

test('재직중이 기본이며 퇴사와 기타 비활성을 구분하고 소속 범위를 유지한다', async () => {
    (manpowerService.getWorkers as jest.Mock).mockResolvedValue([...workers,
        { ...workers[0], id: 'retired', name: '퇴사검증', status: '퇴사', isActive: false },
        { ...workers[0], id: 'inactive', name: '비활성검증', status: '출입금지', isActive: false },
    ]);
    render(<TeamWorkerDetailPage />);
    await screen.findByRole('button', { name: /가상하나.*검증팀/ });
    expect(screen.queryByRole('button', { name: /퇴사검증.*검증팀/ })).not.toBeInTheDocument();
    const status = screen.getByRole('group', { name: '작업자 상태' });
    expect(within(status).getByRole('button', { name: '재직중 (3)' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('group', { name: '조회월' })).toBeInTheDocument();
    fireEvent.click(within(status).getByRole('button', { name: '퇴사자 (1)' }));
    expect(screen.queryByRole('button', { name: /비활성검증.*검증팀/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /다른팀사람/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /퇴사검증.*검증팀/ })).toBeInTheDocument();
});

test('팀장은 작업자정보에서 퇴사 처리 후 재직중으로 복귀하며 선택과 인원수가 갱신된다', async () => {
    (useRestrictedTeamWorkflow as jest.Mock).mockReturnValue(true);
    render(<TeamWorkerDetailPage view="profile" />);
    fireEvent.click(await screen.findByRole('button', { name: /가상하나.*검증팀/ }));
    fireEvent.click(screen.getByRole('button', { name: '퇴사 처리' }));
    await waitFor(() => expect(teamResourceStatusService.update).toHaveBeenCalledWith({ kind: 'worker', id: 'one', status: '퇴사', expectedStatus: '재직', expectedIsActive: null }));
    expect(await screen.findByRole('button', { name: '재직중으로 변경' })).toBeEnabled();
    expect(screen.getByRole('heading', { name: '가상하나' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '퇴사자 (1)' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: /가상둘.*검증팀/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '재직중으로 변경' }));
    await waitFor(() => expect(teamResourceStatusService.update).toHaveBeenLastCalledWith({ kind: 'worker', id: 'one', status: '재직', expectedStatus: '퇴사', expectedIsActive: false }));
    expect(await screen.findByRole('button', { name: '퇴사 처리' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '재직중 (3)' })).toHaveAttribute('aria-pressed', 'true');
});

test('퇴사 취소와 저장 실패 시 기존 상태를 유지하고 중복 저장을 막는다', async () => {
    (useRestrictedTeamWorkflow as jest.Mock).mockReturnValue(true);
    (showConfirmAlert as jest.Mock).mockResolvedValueOnce({ isConfirmed: false });
    render(<TeamWorkerDetailPage />);
    fireEvent.click(await screen.findByRole('button', { name: '퇴사 처리' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '퇴사 처리' })).toBeEnabled());
    expect(teamResourceStatusService.update).not.toHaveBeenCalled();
    let reject!: (reason: Error) => void;
    (teamResourceStatusService.update as jest.Mock).mockReturnValueOnce(new Promise((_resolve, fail) => { reject = fail; }));
    fireEvent.click(screen.getByRole('button', { name: '퇴사 처리' }));
    await waitFor(() => expect(teamResourceStatusService.update).toHaveBeenCalledTimes(1));
    const pendingButton = screen.getByRole('button', { name: '처리 중…' });
    expect(pendingButton).toBeDisabled();
    fireEvent.click(pendingButton);
    await act(async () => reject(new Error('현재 소속 팀원만 변경할 수 있습니다.')));
    expect(screen.getByRole('alert')).toHaveTextContent('현재 소속 팀원만');
    expect(screen.getByRole('button', { name: '재직중 (3)' })).toHaveAttribute('aria-pressed', 'true');
    expect(teamResourceStatusService.update).toHaveBeenCalledTimes(1);
});

test('출력일보에서도 영문 퇴사 상태를 분리 조회하며 상태 설정은 작업자정보에만 표시한다', async () => {
    (useRestrictedTeamWorkflow as jest.Mock).mockReturnValue(true);
    (manpowerService.getWorkers as jest.Mock).mockResolvedValue([...workers, { ...workers[0], id: 'retired', name: '퇴사검증', status: 'retired' }]);
    render(<TeamWorkerDetailPage view="dailyReport" />);
    fireEvent.click(await screen.findByRole('button', { name: '퇴사자 (1)' }));
    fireEvent.click(screen.getByRole('button', { name: /퇴사검증.*검증팀/ }));
    expect(screen.getByRole('heading', { name: '퇴사검증' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '재직 상태 설정' })).not.toBeInTheDocument();
});

test('출입금지 작업자는 기타 목록에서 조회하며 퇴사 복귀 버튼으로 제한을 해제하지 않는다', async () => {
    (useRestrictedTeamWorkflow as jest.Mock).mockReturnValue(true);
    (manpowerService.getWorkers as jest.Mock).mockResolvedValue([{ ...workers[0], status: '출입금지', isActive: false }]);
    render(<TeamWorkerDetailPage view="profile" />);
    fireEvent.click(await screen.findByRole('button', { name: '기타 (1)' }));
    expect(await screen.findByRole('heading', { name: '가상하나' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '재직 상태 설정' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '재직중으로 변경' })).not.toBeInTheDocument();
});
