import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import AdvancePrepaymentDialog from './AdvancePrepaymentDialog';

const teams = [
    { id: 'team-a', legacyId: 'old-team-a', name: '청팀', color: '#2563eb' },
    { id: 'team-b', name: '홍팀', color: '#ef4444' },
];
const workers = [
    { id: 'a', name: '김하나', teamId: 'old-team-a', teamName: '이전 팀명' },
    { id: 'b', name: '김하나', teamId: 'team-b' },
    { id: 'c', name: '이두리', teamId: 'team-a' },
    { id: 'unassigned', name: '팀 미등록' },
];
const amounts = new Map([['a', 30000], ['b', 50000]]);
const setup = (overrides = {}) => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const onClose = jest.fn();
    render(<AdvancePrepaymentDialog workers={workers} teams={teams} initialWorkerId="" amounts={amounts}
        month="2026년 10월" onSave={onSave} onClose={onClose} {...overrides} />);
    return { onSave, onClose };
};
const workerList = () => screen.getByRole('group', { name: '선입금 작업자 목록' });

test('팀과 검색어를 함께 적용하며 이전 팀 ID와 동명이인도 구분한다', () => {
    setup();
    expect(within(workerList()).getAllByRole('button')).toHaveLength(3);
    expect(screen.queryByText('팀 미등록')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '청팀 선택' }));
    fireEvent.change(screen.getByRole('searchbox', { name: '선입금 작업자 검색' }), { target: { value: '김 하나' } });
    expect(within(workerList()).getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: '청팀 김하나 선택' })).toBeVisible();
    expect(screen.queryByRole('button', { name: '홍팀 김하나 선택' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '없는 이름' } });
    expect(screen.getByRole('status')).toHaveTextContent('작업자가 없습니다');
});

test('필터에서 사라진 작업자는 저장 대상에서 해제하고 작업자별 작성 금액을 보존한다', async () => {
    const { onSave } = setup();
    fireEvent.click(screen.getByRole('button', { name: '청팀 김하나 선택' }));
    expect(screen.getByLabelText('선입금 금액')).toHaveValue('30,000');
    fireEvent.change(screen.getByLabelText('선입금 금액'), { target: { value: '80000' } });
    fireEvent.click(screen.getByRole('button', { name: '홍팀 선택' }));
    expect(screen.getByRole('button', { name: '선입금 저장' })).toBeDisabled();
    expect(screen.getByLabelText('선입금 금액')).toHaveValue('');
    fireEvent.click(screen.getByRole('button', { name: '홍팀 김하나 선택' }));
    expect(screen.getByLabelText('선입금 금액')).toHaveValue('50,000');
    fireEvent.click(screen.getByRole('button', { name: '청팀 선택' }));
    fireEvent.click(screen.getByRole('button', { name: '청팀 김하나 선택' }));
    expect(screen.getByLabelText('선입금 금액')).toHaveValue('80,000');
    fireEvent.click(screen.getByRole('button', { name: '선입금 저장' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('a', 80000, 30000));
});

test('조회한 팀으로 시작하고 행에서 열면 해당 작업자의 팀과 기존 금액으로 시작한다', () => {
    const onSave = jest.fn();
    const { unmount } = render(<AdvancePrepaymentDialog workers={workers} teams={teams} initialWorkerId="" initialTeamId="team-b" amounts={amounts} month="2026년 10월" onSave={onSave} onClose={jest.fn()} />);
    expect(screen.getByRole('button', { name: '홍팀 선택' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(workerList()).getAllByRole('button')).toHaveLength(1);
    unmount();
    setup({ initialWorkerId: 'a', initialTeamId: 'team-b' });
    expect(screen.getByRole('button', { name: '청팀 선택' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '청팀 김하나 선택' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('선입금 금액')).toHaveValue('30,000');
});

test('빠른 금액 입력과 0원 삭제를 지원하고 안전 범위를 넘는 금액은 저장하지 않는다', async () => {
    const { onSave } = setup({ initialWorkerId: 'a' });
    fireEvent.click(screen.getByRole('button', { name: '+5만' }));
    expect(screen.getByLabelText('선입금 금액')).toHaveValue('80,000');
    fireEvent.change(screen.getByLabelText('선입금 금액'), { target: { value: '9007199254740992' } });
    expect(screen.getByRole('button', { name: '선입금 저장' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '0원' }));
    fireEvent.click(screen.getByRole('button', { name: '선입금 저장' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('a', 0, 30000));
});

test('저장 중에는 대상 변경과 중복 저장을 막고 실패 후 입력을 유지한다', async () => {
    let rejectSave: (error: Error) => void = () => {};
    const onSave = jest.fn().mockImplementation(() => new Promise((_, reject) => { rejectSave = reject; }));
    setup({ initialWorkerId: 'a', onSave });
    fireEvent.change(screen.getByLabelText('선입금 금액'), { target: { value: '90000' } });
    const saveButton = screen.getByRole('button', { name: '선입금 저장' });
    fireEvent.click(saveButton);
    fireEvent.click(saveButton);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('searchbox')).toBeDisabled();
    expect(screen.getByRole('button', { name: '홍팀 선택' })).toBeDisabled();
    await act(async () => rejectSave(new Error('conflict')));
    expect(screen.getByRole('alert')).toHaveTextContent('저장하지 못했습니다');
    expect(screen.getByLabelText('선입금 금액')).toHaveValue('90,000');
    expect(screen.getByRole('button', { name: '선입금 저장' })).toBeEnabled();
});
