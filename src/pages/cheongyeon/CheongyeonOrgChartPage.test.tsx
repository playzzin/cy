import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import CheongyeonOrgChartPage from './CheongyeonOrgChartPage';
import { useOrganizationTree } from './hooks/useOrganizationTree';
import type { OrganizationData } from './organizationModel';

jest.mock('./hooks/useOrganizationTree', () => ({ useOrganizationTree: jest.fn() }));
const mockHook = useOrganizationTree as jest.MockedFunction<typeof useOrganizationTree>;
const refresh = jest.fn();
const fixture = (): OrganizationData => ({
    companies: [{ id: 'c1', name: '청연', code: 'CY', type: '시공사' }, { id: 'c2', name: '새회사', code: 'NEW' }],
    teams: [
        { id: 't1', name: '시공본부', type: '본부', companyId: 'c1', leaderId: 'w1', status: 'active' },
        { id: 't2', name: '전기팀', type: '시공팀', companyId: 'c1', parentTeamId: 't1', status: 'active' },
        { id: 't3', name: '종료팀', type: '시공팀', companyId: 'c1', status: 'closed' },
    ],
    workers: [
        { id: 'w1', name: '김민수', role: '본부장', teamId: 't1', status: '재직' },
        { id: 'w2', name: '이하나', role: '전기기사', teamId: 't2', status: '재직' },
        { id: 'w3', name: '미배정동료', role: '기사', companyId: 'c1', status: '재직' },
        { id: 'w4', name: '퇴사동료', role: '기사', teamId: 't2', status: '퇴사' },
    ],
    sites: [{ id: 's1', name: '검증 현장', code: 'TEST', address: '가상 주소', status: 'completed', responsibleTeamId: 't2' }],
});
const ready = () => ({ data: fixture(), loading: false, error: '', siteError: '', updatedAt: new Date('2026-09-16T01:00:00Z'), refresh });
beforeEach(() => { jest.clearAllMocks(); mockHook.mockReturnValue(ready()); });

it('switches companies without leaking teams and can inspect unassigned colleagues', () => {
    render(<CheongyeonOrgChartPage />);
    expect(screen.getByRole('combobox', { name: '조회할 회사' })).toHaveValue('c1');
    fireEvent.click(screen.getByText(/팀 미배정 구성원 1명/));
    expect(screen.getByText('미배정동료')).toBeVisible();
    fireEvent.change(screen.getByRole('combobox', { name: '조회할 회사' }), { target: { value: 'c2' } });
    expect(screen.getByText('아직 연결된 팀이 없습니다')).toBeVisible();
    expect(screen.queryByRole('button', { name: '전기팀 팀 상세 보기' })).not.toBeInTheDocument();
});

it('finds a member by Korean initials, keeps parent context, and opens the right team', () => {
    render(<CheongyeonOrgChartPage />);
    fireEvent.change(screen.getByRole('searchbox', { name: '팀, 구성원, 직무 또는 현장 검색' }), { target: { value: 'ㅇㅎㄴ' } });
    expect(screen.getByText('1개 팀')).toBeVisible();
    expect(screen.getByText('상위 팀')).toBeVisible();
    expect(screen.queryByRole('button', { name: '종료팀 팀 상세 보기' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '전기팀 팀 상세 보기' }));
    const detail = screen.getByRole('complementary', { name: '전기팀' });
    expect(within(detail).getByRole('heading', { name: '전기팀' })).toHaveFocus();
    expect(within(detail).getByRole('searchbox')).toHaveValue('ㅇㅎㄴ');
    fireEvent.click(within(detail).getByRole('button', { name: /이하나/ }));
    expect(within(detail).getByText('현장 미배정')).toBeVisible();
    expect(within(detail).queryByText('퇴사동료')).not.toBeInTheDocument();
    fireEvent.keyDown(detail, { key: 'Escape' });
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '전기팀 팀 상세 보기' })).toHaveFocus();
});

it('shows real site status and zero confirmed assignments without inventing a leader', () => {
    render(<CheongyeonOrgChartPage />);
    fireEvent.click(screen.getByRole('button', { name: '전기팀 팀 상세 보기' }));
    const detail = screen.getByRole('complementary', { name: '전기팀' });
    expect(within(detail).getAllByText('팀장 미지정').length).toBeGreaterThan(0);
    fireEvent.click(within(detail).getByRole('button', { name: /담당 현장/ }));
    expect(within(detail).getByText('완료')).toBeVisible();
    expect(within(detail).getByText('0명')).toBeVisible();
    expect(within(detail).getByText('가상 주소')).toBeVisible();
});

it('filters status and attention, resets an empty search, and switches to a usable list', () => {
    render(<CheongyeonOrgChartPage />);
    fireEvent.change(screen.getByRole('combobox', { name: '팀 상태' }), { target: { value: 'closed' } });
    expect(screen.queryByRole('button', { name: '전기팀 팀 상세 보기' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '목록' }));
    expect(within(screen.getByRole('table')).getByRole('button', { name: '종료팀 팀 상세 보기' })).toBeVisible();
    fireEvent.change(screen.getByRole('searchbox', { name: '팀, 구성원, 직무 또는 현장 검색' }), { target: { value: '없는검색어' } });
    expect(screen.getByText('조건에 맞는 팀이 없습니다')).toBeVisible();
    fireEvent.click(screen.getAllByRole('button', { name: '필터 초기화' })[0]);
    fireEvent.click(screen.getByRole('button', { name: /정보 확인이 필요한 팀/ }));
    expect(within(screen.getByRole('table')).queryByRole('button', { name: '시공본부 팀 상세 보기' })).not.toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByRole('button', { name: '전기팀 팀 상세 보기' })).toBeVisible();
});

it('collapses and expands descendants and exposes matching children while searching', () => {
    render(<CheongyeonOrgChartPage />);
    fireEvent.click(screen.getByRole('button', { name: '모두 접기' }));
    expect(screen.queryByRole('button', { name: '전기팀 팀 상세 보기' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox', { name: '팀, 구성원, 직무 또는 현장 검색' }), { target: { value: '전기팀' } });
    expect(screen.getByRole('button', { name: '전기팀 팀 상세 보기' })).toBeVisible();
    expect(screen.getByRole('button', { name: '모두 접기' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '필터 초기화' }));
    fireEvent.click(screen.getByRole('button', { name: '모두 펼치기' }));
    expect(screen.getByRole('button', { name: '전기팀 팀 상세 보기' })).toBeVisible();
});

it('offers retry on failure and keeps unavailable site data clearly marked', () => {
    mockHook.mockReturnValue({ ...ready(), data: null, error: '연결 상태를 확인해 주세요.' });
    const { rerender } = render(<CheongyeonOrgChartPage />);
    fireEvent.click(screen.getByRole('button', { name: '다시 불러오기' }));
    expect(refresh).toHaveBeenCalledTimes(1);
    mockHook.mockReturnValue({ ...ready(), siteError: '현장 조회 실패' });
    rerender(<CheongyeonOrgChartPage />);
    expect(screen.getByRole('alert')).toHaveTextContent('현장 조회 실패');
    fireEvent.click(screen.getByRole('button', { name: '전기팀 팀 상세 보기' }));
    const detail = screen.getByRole('complementary');
    fireEvent.click(within(detail).getByRole('button', { name: /담당 현장/ }));
    expect(within(detail).getByText('현장 정보를 다시 조회한 뒤 확인해 주세요.')).toBeVisible();
});

it('paginates a large roster and searches across all members', () => {
    const state = ready();
    state.data.workers = Array.from({ length: 45 }, (_, index) => ({ id: 'm' + index, name: '동료' + String(index).padStart(2, '0'), teamId: 't2', role: '기사' }));
    mockHook.mockReturnValue(state);
    render(<CheongyeonOrgChartPage />);
    fireEvent.click(screen.getByRole('button', { name: '전기팀 팀 상세 보기' }));
    const detail = screen.getByRole('complementary');
    expect(within(detail).queryByRole('button', { name: /동료44/ })).not.toBeInTheDocument();
    fireEvent.click(within(detail).getByRole('button', { name: '구성원 더 보기 (15명)' }));
    expect(within(detail).getByRole('button', { name: /동료44/ })).toBeVisible();
    fireEvent.change(within(detail).getByRole('searchbox'), { target: { value: '동료44' } });
    expect(within(detail).getByText(/1명 표시/)).toBeVisible();
});

it('summarizes numerous sites and searches by code beyond the initially rendered sites', () => {
    const state = ready();
    state.data.sites = Array.from({ length: 130 }, (_, index) => ({
        id: 's' + index, name: '검증현장' + String(index).padStart(3, '0'), code: 'CODE-' + index,
        responsibleTeamId: 't2', status: 'active' as const,
    }));
    mockHook.mockReturnValue(state);
    render(<CheongyeonOrgChartPage />);
    const card = screen.getByRole('button', { name: '전기팀 팀 상세 보기' });
    expect(card).toHaveTextContent('외 128곳');
    expect(within(card).queryByText('검증현장129')).not.toBeInTheDocument();
    fireEvent.click(card);
    const detail = screen.getByRole('complementary');
    fireEvent.click(within(detail).getByRole('button', { name: /담당 현장/ }));
    expect(within(detail).getByRole('button', { name: '현장 더 보기 (100곳)' })).toBeVisible();
    expect(within(detail).queryByRole('heading', { name: '검증현장129' })).not.toBeInTheDocument();
    fireEvent.change(within(detail).getByRole('searchbox'), { target: { value: 'code-129' } });
    expect(within(detail).getByRole('heading', { name: '검증현장129' })).toBeVisible();
    expect(within(detail).getByText(/1곳 검색됨/)).toBeVisible();
    expect(within(detail).queryByRole('button', { name: /현장 더 보기/ })).not.toBeInTheDocument();
});
