import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import TeamAccommodationPage from './TeamAccommodationPage';
import { teamAccommodationBoardService } from '../../services/teamAccommodationBoardService';
import type { TeamAccommodationBoard } from '../../types/teamAccommodationBoard';
import { isDevAdminSessionEnabled } from '../../utils/devAdminSession';
import { openRealAccommodationSession } from '../../utils/teamAccommodationAppearance';

jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { uid: 'leader' } }) }));
jest.mock('../../services/teamAccommodationBoardService', () => ({ teamAccommodationBoardService: { load: jest.fn(), save: jest.fn() } }));
jest.mock('../../utils/devAdminSession', () => ({ isDevAdminSessionEnabled: jest.fn(() => false) }));
jest.mock('../../utils/teamAccommodationAppearance', () => ({ ...jest.requireActual('../../utils/teamAccommodationAppearance'), openRealAccommodationSession: jest.fn() }));
jest.mock('../../utils/devPreviewRuntime', () => ({ isDevPreviewFrame: false }));
const fixture: TeamAccommodationBoard = {
    teamId: 'a', teams: [{ id: 'a', name: '테스트 팀', color: '#2563eb' }], date: '2026-10-30', revision: 'revision',
    rooms: [{ id: 'one', name: '원룸 1호', address: '테스트 주소', type: 'OneRoom' }, { id: 'two', name: '투룸 2호', address: '', type: 'TwoRoom' }],
    workers: [
        { id: 'w1', name: '작업자 가', role: '기공', teamId: 'a', teamName: '테스트 팀', accommodationId: null },
        { id: 'w2', name: '작업자 나', role: '조공', teamId: 'a', teamName: '테스트 팀', accommodationId: 'one' },
        { id: 'locked', name: '확인 작업자', role: '', accommodationId: null, lockedReason: '예정된 입실 기록이 있습니다.' },
    ],
};
beforeEach(() => {
    jest.clearAllMocks();
    (isDevAdminSessionEnabled as jest.Mock).mockReturnValue(false);
    (teamAccommodationBoardService.load as jest.Mock).mockResolvedValue(fixture);
    (teamAccommodationBoardService.save as jest.Mock).mockResolvedValue(undefined);
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
    HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
const open = async () => { render(<TeamAccommodationPage />); await screen.findByText('원룸 1호', { selector: 'h3' }); };
const select = (name: string) => fireEvent.click(screen.getByRole('checkbox', { name: `${name} 선택` }));
const assignTo = (name: string) => fireEvent.click(within(screen.getByRole('region', { name })).getByRole('button', { name: /선택 작업자 배정/ }));

test('여러 작업자를 선택하여 이동하고 확인 후 변경분만 저장한다', async () => {
    await open(); select('작업자 가'); select('작업자 나'); assignTo('투룸 2호');
    expect(within(screen.getByRole('region', { name: '투룸 2호' })).getByText('작업자 가')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: '투룸 2호' })).getByText('작업자 나')).toBeInTheDocument();
    expect(teamAccommodationBoardService.save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '변경사항 저장 (2)' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '배정 확정 저장' }));
    await waitFor(() => expect(teamAccommodationBoardService.save).toHaveBeenCalledWith(fixture, [
        { workerId: 'w1', accommodationId: 'two' }, { workerId: 'w2', accommodationId: 'two' },
    ]));
    expect(await screen.findByText('2명의 배정을 저장했습니다.')).toBeInTheDocument();
});

test('배정 해제, 검색, 유형 필터와 잠긴 작업자 선택 차단', async () => {
    await open();
    expect(screen.getByRole('checkbox', { name: '확인 작업자 선택' })).toBeDisabled();
    select('작업자 나'); assignTo('미배정 작업자');
    expect(within(screen.getByRole('region', { name: '미배정 작업자' })).getByText('작업자 나')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: '작업자 검색' }), { target: { value: '작업자 가' } });
    expect(screen.queryByRole('checkbox', { name: '작업자 나 선택' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '투룸' }));
    expect(screen.queryByRole('region', { name: '원룸 1호' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: '투룸 2호' })).toBeInTheDocument();
});

test('저장 실패 시 성공 표시 없이 변경사항을 유지한다', async () => {
    (teamAccommodationBoardService.save as jest.Mock).mockRejectedValue(new Error('배정 정보가 변경되었습니다. 새로고침해 주세요.'));
    await open(); select('작업자 가'); assignTo('투룸 2호');
    fireEvent.click(screen.getByRole('button', { name: '변경사항 저장 (1)' }));
    fireEvent.click(screen.getByRole('button', { name: '배정 확정 저장' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('배정 정보가 변경되었습니다.');
    expect(screen.getByRole('button', { name: '변경사항 저장 (1)' })).toBeEnabled();
    expect(teamAccommodationBoardService.load).toHaveBeenCalledTimes(1);
});

test('숙소가 없는 팀에 다른 팀 숙소나 임의 기본 숙소를 보여주지 않는다', async () => {
    (teamAccommodationBoardService.load as jest.Mock).mockResolvedValue({ ...fixture, rooms: [], workers: [] });
    render(<TeamAccommodationPage />);
    expect(await screen.findByText('아직 팀에 배정된 숙소가 없습니다')).toBeInTheDocument();
    expect(screen.queryByText('원룸 1호')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '변경사항 저장' })).toBeDisabled();
});

test('조회 실패는 빈 배정 성공 화면으로 취급하지 않는다', async () => {
    (teamAccommodationBoardService.load as jest.Mock).mockRejectedValue(new Error('팀장 계정의 연결을 확인해 주세요.'));
    render(<TeamAccommodationPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('팀장 계정의 연결을 확인해 주세요.');
    expect(screen.queryByRole('button', { name: '변경사항 저장' })).not.toBeInTheDocument();
});

test('관리자는 전체 작업자 모드와 팀 필터를 이용하고 다른 팀 숙소에도 배정한다', async () => {
    const global = { ...fixture, canManageAll: true, teamId: '__all__', teams: [...fixture.teams, { id: 'b', name: '다른 팀' }],
        workers: [...fixture.workers, { id: 'other', name: '다른 팀원', role: '기공', teamId: 'b', teamName: '다른 팀', accommodationId: null }] };
    (teamAccommodationBoardService.load as jest.Mock).mockResolvedValue(global);
    await open();
    expect(screen.getByRole('heading', { name: '전체 숙소 배정' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '작업자 팀' })).toHaveValue('__all__');
    select('다른 팀원'); assignTo('원룸 1호');
    fireEvent.click(screen.getByRole('button', { name: '변경사항 저장 (1)' }));
    fireEvent.click(screen.getByRole('button', { name: '배정 확정 저장' }));
    await waitFor(() => expect(teamAccommodationBoardService.save).toHaveBeenCalledWith(global, [{ workerId: 'other', accommodationId: 'one' }]));
    await screen.findByText('1명의 배정을 저장했습니다.');
    fireEvent.change(screen.getByRole('combobox', { name: '작업자 팀' }), { target: { value: 'b' } });
    await waitFor(() => expect(teamAccommodationBoardService.load).toHaveBeenLastCalledWith('b'));
});

test('팀장 화면에는 전체 팀 선택지를 노출하지 않는다', async () => {
    await open();
    expect(screen.getByRole('heading', { name: '우리 팀 숙소 배정' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: '전체 팀 · 전체 작업자' })).not.toBeInTheDocument();
});

test('서버 오류 코드를 그대로 표시하지 않고 복구 가능한 안내를 표시한다', async () => {
    (teamAccommodationBoardService.load as jest.Mock).mockRejectedValue(Object.assign(new Error('internal'), { code: 'functions/internal' }));
    render(<TeamAccommodationPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('숙소 배정 서비스에 연결하지 못했습니다.');
    expect(screen.queryByText('internal')).not.toBeInTheDocument();
});

test('샘플 계정은 조회와 저장 없이 실제 계정으로 전환한다', () => {
    (isDevAdminSessionEnabled as jest.Mock).mockReturnValue(true);
    render(<TeamAccommodationPage />);
    expect(openRealAccommodationSession).toHaveBeenCalledTimes(1);
    expect(teamAccommodationBoardService.load).not.toHaveBeenCalled();
    expect(teamAccommodationBoardService.save).not.toHaveBeenCalled();
});

test('팀 버튼은 서버에서 해당 팀만 새로 조회하고 이전 선택과 검색을 초기화한다', async () => {
    const teams = [...fixture.teams, { id: 'b', name: '지원 팀', color: '#d97706' }];
    (teamAccommodationBoardService.load as jest.Mock).mockResolvedValueOnce({ ...fixture, canManageAll: true, teams }).mockResolvedValue({
        ...fixture, canManageAll: true, teamId: 'b', teams,
        workers: [{ id: 'b1', name: '지원 작업자', teamId: 'b', teamName: '지원 팀', role: '기공', accommodationId: null }],
    });
    await open();
    select('작업자 가');
    fireEvent.change(screen.getByRole('textbox', { name: '작업자 검색' }), { target: { value: '작업자 가' } });
    fireEvent.change(screen.getByRole('textbox', { name: '숙소 검색' }), { target: { value: '원룸' } });
    fireEvent.click(within(screen.getByRole('navigation', { name: '팀별 작업자 불러오기' })).getByRole('button', { name: '지원 팀' }));
    expect(await screen.findByRole('checkbox', { name: '지원 작업자 선택' })).not.toBeChecked();
    expect(teamAccommodationBoardService.load).toHaveBeenLastCalledWith('b');
    expect(screen.queryByRole('checkbox', { name: '작업자 가 선택' })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '작업자 검색' })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: '숙소 검색' })).toHaveValue('');
    expect(screen.getByRole('region', { name: '투룸 2호' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '지원 팀', pressed: true })).toHaveStyle('--ta-team-color: #d97706');
});

test('검색 중에도 숙소 배정 인원과 팀 색상을 유지한다', async () => {
    await open();
    const room = screen.getByRole('region', { name: '원룸 1호' });
    expect(within(room).getByText('테스트 팀', { selector: '.ta-room-teams span' })).toHaveStyle('--ta-team-color: #2563eb');
    fireEvent.change(screen.getByRole('textbox', { name: '작업자 검색' }), { target: { value: '검색되지 않는 이름' } });
    expect(within(room).getByText('선택 팀 1명')).toBeInTheDocument();
    expect(within(room).getByText('검색 조건에 맞는 작업자가 없습니다')).toBeInTheDocument();
});

test('다른 팀 조회 실패 후 재시도도 같은 팀으로 요청한다', async () => {
    const teams = [...fixture.teams, { id: 'b', name: '지원 팀' }];
    (teamAccommodationBoardService.load as jest.Mock).mockResolvedValueOnce({ ...fixture, canManageAll: true, teams }).mockRejectedValue(new Error('조회 실패'));
    await open();
    fireEvent.change(screen.getByRole('combobox', { name: '작업자 팀' }), { target: { value: 'b' } });
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: '다시 불러오기' }));
    await waitFor(() => expect(teamAccommodationBoardService.load).toHaveBeenCalledTimes(3));
    expect(teamAccommodationBoardService.load).toHaveBeenLastCalledWith('b');
});
