import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, act } from '@testing-library/react';
import SupportSaveFeedback from './SupportSaveFeedback';
import { noteSupportWriteRecordFailure } from '../../utils/supportWriteErrorReporting';

it.each(['completed', 'unknown', 'refresh-failed', 'record-failed'] as const)('explicitly hides internal ID for %s while retaining feedback and no financial retry', outcome => {
  const retry = jest.fn();
  render(<SupportSaveFeedback observeRecordFailure hideOperationId feedback={{ status: 'warning', title: '처리 결과', message: '원래 작업을 확인해 주세요.', operationId: 'hidden-original', outcome }} onRetry={retry} onDismiss={jest.fn()} />);
  expect(screen.getByText('처리 결과')).toBeInTheDocument();
  // old/new: record failure replaces any legacy resave advice, not the result title.
  const expectedMessage = outcome === 'record-failed' ? '금융 작업은 다시 실행하지 말고 원래 요청의 기록 상태를 별도로 확인해 주세요.' : '원래 작업을 확인해 주세요.';
  expect(screen.getByText(expectedMessage)).toBeInTheDocument();
  expect(screen.queryByText(/hidden-original|작업 ID:/)).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '다시 저장' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '닫기' }));
  expect(retry).not.toHaveBeenCalled();
});

it.each(['completed', 'unknown', 'refresh-failed', 'record-failed'] as const)('legacy retry cannot bypass %s', outcome => {
  const retry = jest.fn();
  render(<SupportSaveFeedback feedback={{ status: 'warning', title: '결과', message: '확인 대기', outcome, preserveExistingRetry: true }} onRetry={retry} onDismiss={jest.fn()} />);
  expect(screen.queryByRole('button', { name: '다시 저장' })).not.toBeInTheDocument();
  expect(retry).not.toHaveBeenCalled();
});

it.each(['partial', 'blocked'] as const)('keeps the existing recovery handler for %s', outcome => {
  const retry = jest.fn();
  render(<SupportSaveFeedback feedback={{ status: 'warning', title: '결과', message: '안내', outcome, preserveExistingRetry: true }} onRetry={retry} onDismiss={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: '다시 저장' }));
  expect(retry).toHaveBeenCalledTimes(1);
});

it.each([true, false])('record-failed feedback cannot retain legacy financial resave advice, observed=%s', observed => {
  render(<SupportSaveFeedback feedback={{ status: 'warning', title: '기록 확인', message: '확인 뒤 다시 저장해주세요.', outcome: observed ? 'partial' : 'record-failed', recordFailure: observed, preserveExistingRetry: true }} onRetry={jest.fn()} onDismiss={jest.fn()} />);
  expect(screen.queryByText('확인 뒤 다시 저장해주세요.')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '다시 저장' })).not.toBeInTheDocument();
});

it.each(['partial', 'blocked'] as const)('never presents the general retry handler as a read for %s', outcome => {
  const retry = jest.fn();
  render(<SupportSaveFeedback feedback={{ status: 'warning', title: '처리 결과', message: '안내', outcome }} onRetry={retry} onDismiss={jest.fn()} />);
  expect(screen.queryByRole('button', { name: '다시 조회' })).not.toBeInTheDocument();
  expect(retry).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '다시 저장' }));
  expect(retry).toHaveBeenCalledTimes(1);
});

it('hidden ID still binds late record failure only to the owning operation', () => {
  noteSupportWriteRecordFailure('unrelated-hidden-operation');
  const { rerender } = render(<SupportSaveFeedback observeRecordFailure hideOperationId feedback={{ status: 'success', title: '현재 완료', message: '안내', operationId: 'owned-hidden-operation', outcome: 'completed' }} onDismiss={jest.fn()} />);
  expect(screen.getByText('현재 완료')).toBeInTheDocument();
  expect(screen.queryByText(/작업 기록 실패 ·/)).not.toBeInTheDocument();
  act(() => noteSupportWriteRecordFailure('owned-hidden-operation'));
  rerender(<SupportSaveFeedback observeRecordFailure hideOperationId feedback={{ status: 'success', title: '현재 완료', message: '안내', operationId: 'owned-hidden-operation', outcome: 'completed' }} onDismiss={jest.fn()} />);
  expect(screen.getByText(/작업 기록 실패 ·/)).toBeInTheDocument();
  expect(screen.queryByText(/owned-hidden-operation|작업 ID:/)).not.toBeInTheDocument();
});

it('explicit pure recording snapshot never inherits a different operation failure', () => {
  noteSupportWriteRecordFailure('old-snapshot');
  const { rerender } = render(<SupportSaveFeedback observeRecordFailure hideOperationId feedback={{ status: 'success', title: '현재 작업', message: '안내', outcome: 'completed', recordFailure: false }} onRetry={jest.fn()} onDismiss={jest.fn()} />);
  expect(screen.queryByText(/작업 기록 실패 ·/)).not.toBeInTheDocument();
  rerender(<SupportSaveFeedback observeRecordFailure hideOperationId feedback={{ status: 'warning', title: '현재 작업', message: '안내', outcome: 'completed', recordFailure: true }} onRetry={jest.fn()} onDismiss={jest.fn()} />);
  expect(screen.getByText(/작업 기록 실패 ·/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '다시 저장' })).not.toBeInTheDocument();
  expect(screen.queryByText(/old-snapshot|작업 ID:/)).not.toBeInTheDocument();
});

it('shows a prior recording failure separately from completed finance, without offering to save again', () => {
  noteSupportWriteRecordFailure('original-record-failed');
  render(<SupportSaveFeedback observeRecordFailure feedback={{ status: 'success', title: '금융 완료', message: '안내', operationId: 'original-record-failed', outcome: 'completed' }} onRetry={jest.fn()} onDismiss={jest.fn()} />);
  expect(screen.getByText('금융 완료')).toBeInTheDocument();
  expect(screen.getByText(/작업 기록 실패 · 금융 작업을 다시 실행하지 마세요/)).toBeInTheDocument();
  expect(screen.queryByText('다시 저장')).not.toBeInTheDocument();
});

it.each(['completed', 'partial', 'blocked', 'unknown', 'refresh-failed', 'record-failed'] as const)('renders explicit %s without financial replay for uncertain/read/log outcomes', outcome => {
  const retry = jest.fn(), dismiss = jest.fn();
  render(<SupportSaveFeedback feedback={{ status: 'warning', title: '결과', message: '안내', operationId: 'original', outcome }} onRetry={retry} onDismiss={dismiss} />);
  const labels = { completed: '완료', partial: '부분 완료', blocked: '실행 전 중단', unknown: '결과 미확정', 'refresh-failed': '저장 후 조회 실패', 'record-failed': '작업 기록 실패' };
  expect(screen.getByText(labels[outcome])).toBeInTheDocument();
  expect(screen.getByText(/original/)).toBeInTheDocument();
  expect(Boolean(screen.queryByText('다시 저장'))).toBe(['partial', 'blocked'].includes(outcome));
  fireEvent.click(screen.getByText('닫기')); expect(dismiss).toHaveBeenCalledTimes(1); expect(retry).not.toHaveBeenCalled();
});

it('preserves legacy message, ID, disabled state, retry and dismiss despite observed failure', () => {
  noteSupportWriteRecordFailure('stage1-legacy');
  const retry = jest.fn(), dismiss = jest.fn();
  const feedback = { status: 'error' as const, title: '기존 오류', message: '기존 안내', operationId: 'stage1-legacy' };
  const { rerender } = render(<SupportSaveFeedback feedback={feedback} retryDisabled onRetry={retry} onDismiss={dismiss} />);
  expect(screen.getByText('기존 안내')).toBeInTheDocument();
  expect(screen.getByText('작업 ID: stage1-legacy')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '다시 저장' })).toBeDisabled();
  expect(screen.queryByText(/작업 기록 실패 ·/)).not.toBeInTheDocument();
  rerender(<SupportSaveFeedback feedback={feedback} onRetry={retry} onDismiss={dismiss} />);
  fireEvent.click(screen.getByRole('button', { name: '다시 저장' }));
  fireEvent.click(screen.getByRole('button', { name: '닫기' }));
  expect(retry).toHaveBeenCalledTimes(1);
  expect(dismiss).toHaveBeenCalledTimes(1);
});

it.each(['partial', 'blocked'] as const)('false snapshot cannot erase an existing same-ID failure for %s', outcome => {
  const operationId = `revision2-existing-${outcome}`;
  const retry = jest.fn();
  noteSupportWriteRecordFailure(operationId);
  render(<SupportSaveFeedback observeRecordFailure feedback={{ status: 'warning', title: '기록 확인', message: '기존 재시도 안내', operationId, outcome, recordFailure: false }} onRetry={retry} onDismiss={jest.fn()} />);
  expect(screen.getByText(/작업 기록 실패 ·/)).toBeInTheDocument();
  expect(screen.queryByText('기존 재시도 안내')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '다시 저장' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '다시 조회' })).not.toBeInTheDocument();
  expect(retry).not.toHaveBeenCalled();
});

it.each(['partial', 'blocked'] as const)('false snapshot stays subscribed and isolates other IDs for %s', outcome => {
  const operationId = `revision2-live-${outcome}`;
  const retry = jest.fn();
  const feedback = { status: 'warning' as const, title: '기록 확인', message: '기존 안내', operationId, outcome, recordFailure: false };
  const { rerender } = render(<SupportSaveFeedback observeRecordFailure feedback={feedback} onRetry={retry} onDismiss={jest.fn()} />);
  act(() => noteSupportWriteRecordFailure(`revision2-unrelated-${outcome}`));
  expect(screen.queryByText(/작업 기록 실패 ·/)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '다시 저장' })).toBeInTheDocument();
  act(() => noteSupportWriteRecordFailure(operationId));
  expect(screen.getByText(/작업 기록 실패 ·/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '다시 저장' })).not.toBeInTheDocument();
  rerender(<SupportSaveFeedback observeRecordFailure feedback={{ ...feedback }} onRetry={retry} onDismiss={jest.fn()} />);
  expect(screen.queryByRole('button', { name: '다시 저장' })).not.toBeInTheDocument();
  rerender(<SupportSaveFeedback observeRecordFailure feedback={{ ...feedback, operationId: `revision2-next-${outcome}` }} onRetry={retry} onDismiss={jest.fn()} />);
  expect(screen.queryByText(/작업 기록 실패 ·/)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '다시 저장' })).toBeInTheDocument();
  expect(retry).not.toHaveBeenCalled();
});

it('updates the opted-in owner from subscription alone and resets across IDs', () => {
  const { rerender } = render(<SupportSaveFeedback observeRecordFailure feedback={{ status: 'warning', title: '관찰', message: '원문', operationId: 'stage1-live', outcome: 'partial' }} onRetry={jest.fn()} onDismiss={jest.fn()} />);
  act(() => noteSupportWriteRecordFailure('stage1-live'));
  expect(screen.getByText(/작업 기록 실패 ·/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '다시 저장' })).not.toBeInTheDocument();
  rerender(<SupportSaveFeedback observeRecordFailure feedback={{ status: 'warning', title: '다른 작업', message: '다른 원문', operationId: 'stage1-next', outcome: 'partial' }} onRetry={jest.fn()} onDismiss={jest.fn()} />);
  expect(screen.queryByText(/작업 기록 실패 ·/)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '다시 저장' })).toBeInTheDocument();
});
