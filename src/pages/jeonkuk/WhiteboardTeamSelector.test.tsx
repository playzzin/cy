import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import WhiteboardTeamSelector from './WhiteboardTeamSelector';
import { teamSettlementService } from '../../services/teamSettlementService';

let mockDragEnd: (event: any) => void;
jest.mock('@dnd-kit/core', () => ({
    ...jest.requireActual('@dnd-kit/core'),
    DndContext: ({ onDragEnd, children }: any) => {
        mockDragEnd = onDragEnd;
        return <>{children}</>;
    }
}));
jest.mock('@dnd-kit/sortable', () => ({
    ...jest.requireActual('@dnd-kit/sortable'),
    SortableContext: ({ children }: any) => <>{children}</>,
    useSortable: () => ({ attributes: {}, listeners: {}, setNodeRef: jest.fn() })
}));
jest.mock('../../services/teamSettlementService', () => ({
    teamSettlementService: {
        getTeamDisplayOrder: jest.fn(),
        saveTeamDisplayOrder: jest.fn(),
        resetTeamDisplayOrder: jest.fn()
    }
}));

const internalTeams = [
    { id: 'a', name: '가팀', color: '#ffcc00' },
    { id: 'b', name: '나팀', color: '#000080' }
];
const supportTeams = [{ id: 's', name: '지원팀', isSupport: true }];

beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    (teamSettlementService.getTeamDisplayOrder as jest.Mock).mockResolvedValue(['a', 'hidden', 'b', 's']);
    (teamSettlementService.saveTeamDisplayOrder as jest.Mock).mockResolvedValue(undefined);
    (teamSettlementService.resetTeamDisplayOrder as jest.Mock).mockResolvedValue(undefined);
});

const setup = async () => {
    const onChange = jest.fn();
    render(<WhiteboardTeamSelector internalTeams={internalTeams} supportTeams={supportTeams} internalLabel="소속팀" selectedTeamId="a" onChange={onChange} />);
    await waitFor(() => expect(screen.getByRole('button', { name: '순서 변경' })).toBeEnabled());
    return onChange;
};

test('팀·지원팀·전체 선택은 조회 필터만 바꾸고 회사 공통 순서를 저장하지 않는다', async () => {
    const onChange = await setup();
    expect(screen.getByRole('button', { name: '가팀 선택' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '가팀 선택' })).toHaveStyle({ backgroundColor: '#ffcc00', color: '#0f172a' });
    fireEvent.click(screen.getByRole('button', { name: '나팀 선택' }));
    fireEvent.click(within(screen.getByRole('group', { name: '지원팀 선택' })).getByRole('button', { name: '지원팀 선택' }));
    fireEvent.click(screen.getByRole('button', { name: '전체 팀' }));
    expect(onChange.mock.calls).toEqual([['b'], ['s'], ['']]);
    expect(teamSettlementService.saveTeamDisplayOrder).not.toHaveBeenCalled();
});

test('필터 밖의 팀과 지원팀 순서를 보존하며 완료할 때만 공통 순서를 저장한다', async () => {
    const onChange = await setup();
    fireEvent.click(screen.getByRole('button', { name: '순서 변경' }));
    fireEvent.click(screen.getByRole('button', { name: '가팀 순서 변경' }));
    expect(onChange).not.toHaveBeenCalled();
    act(() => mockDragEnd({ active: { id: 'a' }, over: { id: 'b' } }));
    expect(teamSettlementService.saveTeamDisplayOrder).not.toHaveBeenCalled();
    const buttons = within(screen.getByRole('group', { name: '팀 선택' })).getAllByRole('button');
    expect(buttons.map((button) => button.textContent)).toEqual(['전체 팀', '⠿나팀', '⠿가팀']);
    fireEvent.click(screen.getByRole('button', { name: '순서 변경 완료' }));
    await waitFor(() => expect(teamSettlementService.saveTeamDisplayOrder).toHaveBeenCalledWith(['b', 'hidden', 'a', 's']));
    await waitFor(() => expect(screen.getByRole('button', { name: '나팀 선택' })).toBeEnabled());
    expect(JSON.parse(localStorage.getItem('team-settlement:team-order:v1')!)).toEqual(['b', 'hidden', 'a', 's']);
});

test('지원팀 그룹 밖으로 옮기거나 순서를 바꾸지 않고 완료하면 저장하지 않는다', async () => {
    await setup();
    fireEvent.click(screen.getByRole('button', { name: '순서 변경' }));
    act(() => mockDragEnd({ active: { id: 'a' }, over: { id: 's' } }));
    fireEvent.click(screen.getByRole('button', { name: '순서 변경 완료' }));
    expect(teamSettlementService.saveTeamDisplayOrder).not.toHaveBeenCalled();
});

test('저장 실패 시 편집 상태와 순서를 유지하여 재시도할 수 있다', async () => {
    (teamSettlementService.saveTeamDisplayOrder as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    await setup();
    fireEvent.click(screen.getByRole('button', { name: '순서 변경' }));
    act(() => mockDragEnd({ active: { id: 'a' }, over: { id: 'b' } }));
    fireEvent.click(screen.getByRole('button', { name: '순서 변경 완료' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('팀 순서를 저장하지 못했습니다');
    expect(localStorage.getItem('team-settlement:team-order:v1')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '순서 변경 완료' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('button', { name: '나팀 선택' })).toBeEnabled());
});

test('기본 순서는 공통 설정과 로컬 캐시를 함께 초기화한다', async () => {
    await setup();
    fireEvent.click(screen.getByRole('button', { name: '순서 변경' }));
    fireEvent.click(screen.getByRole('button', { name: '기본 순서' }));
    await waitFor(() => expect(teamSettlementService.resetTeamDisplayOrder).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole('button', { name: '가팀 선택' })).toBeEnabled());
    expect(localStorage.getItem('team-settlement:team-order:v1')).toBe('[]');
});
