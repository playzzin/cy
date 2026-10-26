import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
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
