import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { TeamMobileProvider } from '../team-mobile/TeamMobileUI';
import { TeamSettlementWorkspaceHeader } from './TeamSettlementWorkspaceHeader';

test('확정 후 수정이 잠겨도 취소할 수 있고 처리 중에는 중복 취소를 막는다', () => {
  const onUnconfirm = jest.fn();
  const props = { teamName: '테스트팀', year: 2026, month: 9, confirmedAt: '2026-09-30T00:00:00.000Z', updatedAt: null,
    isDirty: false, issueCount: 0, saveState: 'idle' as const, loading: false, canWrite: true, canEdit: false, canRecalculate: true,
    onRefresh: jest.fn(), onRecalculate: jest.fn(), onSave: jest.fn(), onConfirm: jest.fn(), onUnconfirm };
  const { rerender } = render(<TeamSettlementWorkspaceHeader {...props} />);
  fireEvent.click(screen.getByRole('button', { name: '확정 취소' }));
  expect(onUnconfirm).toHaveBeenCalledTimes(1);
  rerender(<TeamSettlementWorkspaceHeader {...props} saveState="saving" />);
  expect(screen.getByRole('button', { name: '확정 취소' })).toBeDisabled();
  rerender(<TeamSettlementWorkspaceHeader {...props} confirmedAt={null} canEdit />);
  expect(screen.getByRole('button', { name: '저장 후 확정' })).toBeEnabled();
  expect(screen.queryByRole('button', { name: '확정 취소' })).not.toBeInTheDocument();
});

test('고정 작업줄에서 연도를 넘어 월을 이동하며 저장 중에는 이동을 막는다', () => {
  const onMonthChange = jest.fn();
  const props = { teamName: '검증팀', year: 2026, month: 1, confirmedAt: null, updatedAt: null,
    isDirty: false, issueCount: 0, saveState: 'idle' as const, loading: false, canWrite: false, canEdit: false, canRecalculate: false,
    onRefresh: jest.fn(), onRecalculate: jest.fn(), onSave: jest.fn(), onConfirm: jest.fn(), onUnconfirm: jest.fn(), onMonthChange };
  const { rerender } = render(<TeamSettlementWorkspaceHeader {...props} />);
  fireEvent.click(screen.getByRole('button', { name: '이전 달' }));
  expect(onMonthChange).toHaveBeenCalledWith('2025-12');
  rerender(<TeamSettlementWorkspaceHeader {...props} saveState="saving" />);
  expect(screen.getByRole('button', { name: '다음 달' })).toBeDisabled();
});


test('조회 권한은 월 이동과 새로고침만 제공하고 사무실 수정 버튼은 숨긴다', () => {
  render(<TeamSettlementWorkspaceHeader teamName="검증팀" year={2026} month={11} confirmedAt={null} updatedAt={null}
    isDirty={false} issueCount={0} saveState="idle" loading={false} canWrite={false} canEdit={false} canRecalculate={false}
    onRefresh={jest.fn()} onRecalculate={jest.fn()} onSave={jest.fn()} onConfirm={jest.fn()} onUnconfirm={jest.fn()} onMonthChange={jest.fn()} />);
  expect(screen.getByRole('button', { name: '새로고침' })).toBeEnabled();
  expect(screen.getByRole('button', { name: '다음 달' })).toBeEnabled();
  expect(screen.queryByRole('button', { name: /재집계|변경사항|확정/ })).not.toBeInTheDocument();
  expect(screen.getByText(/팀 정산 조회 화면입니다/)).toHaveAttribute('role', 'status');
});

test('모바일 정산은 같은 조회월 바에 팀과 월별 확정 상태를 표시한다', () => {
  const original = window.matchMedia;
  window.matchMedia = jest.fn().mockReturnValue({ matches: true, addEventListener: jest.fn(), removeEventListener: jest.fn() });
  const props = { teamName: '검증팀', year: 2026, month: 11, confirmedAt: null,
    updatedAt: null, isDirty: false, issueCount: 0, saveState: 'idle' as const,
    loading: false, canWrite: false, canEdit: false, canRecalculate: false,
    onRefresh: jest.fn(), onRecalculate: jest.fn(), onSave: jest.fn(), onConfirm: jest.fn(), onUnconfirm: jest.fn(), onMonthChange: jest.fn() };
  try {
    const { rerender } = render(<TeamMobileProvider enabled><TeamSettlementWorkspaceHeader {...props} /></TeamMobileProvider>);
    const bar = within(screen.getByRole('group', { name: '정산 조회월' }));
    expect(bar.getByText('검증팀')).toBeInTheDocument();
    expect(bar.getByText('미확정')).toBeInTheDocument();
    fireEvent.click(bar.getByRole('button', { name: '이전 달' }));
    expect(props.onMonthChange).toHaveBeenCalledWith('2026-10');
    rerender(<TeamMobileProvider enabled><TeamSettlementWorkspaceHeader {...props} month={10} confirmationState="loading" /></TeamMobileProvider>);
    expect(bar.getByText('조회 중')).toBeInTheDocument();
    expect(bar.queryByText('미확정')).not.toBeInTheDocument();
    rerender(<TeamMobileProvider enabled><TeamSettlementWorkspaceHeader {...props} month={10} confirmedAt="2026-10-31" /></TeamMobileProvider>);
    expect(bar.getByText('2026년 10월')).toBeInTheDocument();
    expect(bar.getByText('확정')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '정산 상태와 실행 작업' })).not.toHaveTextContent('검증팀');
  } finally { window.matchMedia = original; }
});
