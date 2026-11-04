import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import Swal from 'sweetalert2';
import FreelancerPage from './FreelancerPage';
import { freelancerService } from '../../services/freelancerService';
import { teamSettlementService } from '../../services/teamSettlementService';

const mockMaster = {
    loading: false, companies: [{ id: 'co', name: '청연 검증' }],
    teams: ['a', 'b', 'hidden'].map(id => ({ id, legacyId: 'legacy-' + id, name: id + '팀', companyId: 'co' })),
};
jest.mock('../../contexts/MasterDataContext', () => ({ useMasterData: () => mockMaster }));
jest.mock('../../services/freelancerService', () => ({ freelancerService: { getFreelancerYearlyData: jest.fn(), saveYearlyPayments: jest.fn() } }));
jest.mock('../../services/teamSettlementService', () => ({ teamSettlementService: {
    getTeamDisplayOrder: jest.fn(), saveTeamDisplayOrder: jest.fn(), resetTeamDisplayOrder: jest.fn(),
} }));
jest.mock('@handsontable/react', () => ({ HotTable: jest.requireActual('react').forwardRef(() => null) }));
jest.mock('handsontable/registry', () => ({ registerAllModules: jest.fn() }));
jest.mock('sweetalert2', () => ({ fire: jest.fn() }));
let mockDragEnd: (event: { active: { id: string }; over: { id: string } }) => void;
jest.mock('@dnd-kit/core', () => ({
    ...jest.requireActual('@dnd-kit/core'),
    DndContext: ({ onDragEnd, children }: any) => { mockDragEnd = onDragEnd; return <>{children}</>; },
}));

const dataFor = (ids: string[]) => ({ freelancers: ids.map(id => ({ id: 'worker-' + id, name: '검증 ' + id, teamId: 'legacy-' + id, m01: 100 })) });
beforeEach(() => {
    jest.resetAllMocks();
    localStorage.clear();
    (freelancerService.getFreelancerYearlyData as jest.Mock).mockResolvedValue(dataFor(['a', 'b']));
});
const buttons = () => within(screen.getByRole('group', { name: '팀 선택' })).getAllByRole('button').map(button => button.textContent);

test('회사 공통 순서로 첫 팀을 선택하고 숨은 팀 위치와 선택된 신고 팀을 보존한 채 순서를 저장한다', async () => {
    let saved = ['b', 'hidden', 'a'];
    (teamSettlementService.getTeamDisplayOrder as jest.Mock).mockImplementation(async () => saved);
    (teamSettlementService.saveTeamDisplayOrder as jest.Mock).mockImplementation(async (ids: string[]) => { saved = ids; });
    const view = render(<FreelancerPage />);
    await screen.findByRole('heading', { name: 'b팀' });
    expect(buttons()).toEqual(['b팀', 'a팀']);
    expect(screen.queryByRole('button', { name: '전체 팀' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '순서 변경' }));
    act(() => mockDragEnd({ active: { id: 'b' }, over: { id: 'a' } }));
    fireEvent.click(screen.getByRole('button', { name: 'a팀 순서 변경' }));
    expect(screen.getByRole('heading', { name: 'b팀' })).toBeInTheDocument();
    expect(teamSettlementService.saveTeamDisplayOrder).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '순서 변경 완료' }));
    await waitFor(() => expect(buttons()).toEqual(['a팀', 'b팀']));
    expect(saved).toEqual(['a', 'hidden', 'b']);
    expect(screen.getByRole('button', { name: 'b팀 선택' })).toHaveAttribute('aria-pressed', 'true');
    expect(freelancerService.saveYearlyPayments).not.toHaveBeenCalled();
    expect(Swal.fire).not.toHaveBeenCalled();
    expect(freelancerService.getFreelancerYearlyData).toHaveBeenCalledTimes(1);

    view.unmount();
    localStorage.clear();
    render(<FreelancerPage />);
    await screen.findByRole('heading', { name: 'a팀' });
    expect(buttons()).toEqual(['a팀', 'b팀']);
});

test('연도를 바꾸면 남아 있는 선택을 유지하고 사라진 팀만 새 목록의 첫 팀으로 바꾼다', async () => {
    (teamSettlementService.getTeamDisplayOrder as jest.Mock).mockResolvedValue(['b', 'a']);
    (freelancerService.getFreelancerYearlyData as jest.Mock)
        .mockResolvedValueOnce(dataFor(['a', 'b'])).mockResolvedValueOnce(dataFor(['a', 'b'])).mockResolvedValueOnce(dataFor(['b']));
    render(<FreelancerPage />);
    await screen.findByRole('heading', { name: 'b팀' });
    fireEvent.click(screen.getByRole('button', { name: 'a팀 선택' }));
    await screen.findByRole('heading', { name: 'a팀' });
    fireEvent.click(screen.getByRole('button', { name: '다음 연도' }));
    await waitFor(() => expect(freelancerService.getFreelancerYearlyData).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('button', { name: 'a팀 선택' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: '다음 연도' }));
    await screen.findByRole('heading', { name: 'b팀' });
    expect(buttons()).toEqual(['b팀']);
});

test('공통 순서 조회가 실패해도 캐시 기준으로 신고 팀을 선택하고 조회할 수 있다', async () => {
    localStorage.setItem('team-settlement:team-order:v1', JSON.stringify(['b', 'a']));
    (teamSettlementService.getTeamDisplayOrder as jest.Mock).mockRejectedValue(new Error('offline'));
    render(<FreelancerPage />);
    await screen.findByRole('heading', { name: 'b팀' });
    expect(screen.getByRole('alert')).toHaveTextContent('회사 공통 팀 순서');
    expect(screen.getByRole('button', { name: '순서 변경' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'a팀 선택' }));
    await screen.findByRole('heading', { name: 'a팀' });
});
