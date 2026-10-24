import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import DevPreviewAccountPicker from './DevPreviewAccountPicker';
import type { PreviewAccount } from './DevUserPreview';

const accounts: PreviewAccount[] = [
    { uid: 'a', displayName: '검증 팀장 A', scopeLabel: '서울 A팀', positionIds: ['lead'], linked: true, additionalPositions: [] },
    { uid: 'b', displayName: '검증 팀장 B', scopeLabel: '부산 B팀', positionIds: ['lead'], linked: true, additionalPositions: [] },
    { uid: 'c', displayName: '검증 작업자', scopeLabel: '서울 A팀', positionIds: ['worker'], linked: true, additionalPositions: [] },
];
const positions = [{ id: 'lead', name: '팀장', color: '', icon: '' }, { id: 'worker', name: '작업자', color: '', icon: '' }, { id: 'empty', name: '미연결 직책', color: '', icon: '' }];
const setup = (overrides = {}) => {
    const props = { accounts, positions, positionId: 'lead', uid: 'a', recent: [], loading: false, busy: false, error: '', onConfirm: jest.fn(), onClose: jest.fn(), onRestoreFocus: jest.fn(), onReload: jest.fn(), ...overrides };
    render(<DevPreviewAccountPicker {...props} />);
    return props;
};

it('searches by name or team and stages a choice until confirmation', () => {
    const props = setup();
    const search = screen.getByRole('searchbox', { name: '이름 또는 담당 팀 검색' });
    expect(search).toHaveFocus();
    fireEvent.change(search, { target: { value: '부 산b팀' } });
    expect(screen.queryByRole('button', { name: '검증 팀장 A · 서울 A팀' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '검증 팀장 B · 부산 B팀' }));
    expect(props.onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '이 사용자로 보기' }));
    expect(props.onConfirm).toHaveBeenCalledWith({ positionId: 'lead', uid: 'b' });
});

it('keeps the current user unchanged while browsing another position', () => {
    const props = setup();
    fireEvent.click(within(screen.getByRole('group', { name: '직책 선택' })).getByRole('button', { name: /작업자/ }));
    expect(screen.getByRole('button', { name: '검증 작업자 · 서울 A팀' })).toHaveAttribute('aria-pressed', 'true');
    expect(props.onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '이 사용자로 보기' }));
    expect(props.onConfirm).toHaveBeenCalledWith({ positionId: 'worker', uid: 'c' });
});

it('shows useful empty states and recovers from a search with no matches', () => {
    setup();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '없는 사용자' } });
    expect(screen.getByText('검색 결과가 없습니다')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '검색 초기화' }));
    expect(screen.getByRole('button', { name: '검증 팀장 B · 부산 B팀' })).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('group', { name: '직책 선택' })).getByRole('button', { name: /미연결 직책/ }));
    expect(screen.getByText('연결된 사용자가 없습니다')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '이 사용자로 보기' })).toBeDisabled();
});

it('filters invalid recent choices and requires confirmation for a recent user', () => {
    const props = setup({ recent: [{ positionId: 'worker', uid: 'c' }, { positionId: 'lead', uid: 'deleted' }] });
    fireEvent.click(screen.getByRole('button', { name: '최근 확인: 검증 작업자 · 작업자' }));
    expect(props.onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '이 사용자로 보기' }));
    expect(props.onConfirm).toHaveBeenCalledWith({ positionId: 'worker', uid: 'c' });
    expect(screen.queryByText('deleted')).not.toBeInTheDocument();
});

it('disables confirmation while loading and offers directory retry on error', () => {
    const props = setup({ loading: true, error: '목록을 다시 불러와 주세요.' });
    expect(screen.getByRole('status', { name: '사용자 목록 불러오는 중' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '이 사용자로 보기' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('목록을 다시 불러와 주세요.');
    expect(props.onConfirm).not.toHaveBeenCalled();
});

it('allows retry and closes on Escape without committing a draft', () => {
    const props = setup({ error: '일시적인 연결 오류' });
    fireEvent.click(screen.getByRole('button', { name: '사용자 목록 새로고침' }));
    expect(props.onReload).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: '검증 팀장 B · 부산 B팀' }));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(props.onConfirm).not.toHaveBeenCalled();
});
