import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ConstructionPlanSaveRecovery, {
  mergeConstructionPlanFailedSavePatch,
  serializeConstructionPlanFailedSave,
  type ConstructionPlanFailedSaveSnapshot,
} from './ConstructionPlanSaveRecovery';

const snapshot: ConstructionPlanFailedSaveSnapshot = {
  failedAt: '2026-08-22T01:02:03.000Z',
  reason: 'request_failed',
  patch: {
    sections: [{
      id: 'method',
      key: 'method',
      title: '시공 방법',
      kind: 'static-content',
      order: 1,
      pageNumbers: [2],
      required: true,
      status: 'in_progress',
      content: { body: '현장 변경 데이터' },
      placeholders: [],
      containsExampleValues: false,
      standardTextModified: false,
    }],
  },
};

describe('ConstructionPlanSaveRecovery', () => {
  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
  });

  it('retries only after the user explicitly activates the retry button', () => {
    const onRetry = jest.fn();
    render(
      <ConstructionPlanSaveRecovery
        snapshot={snapshot}
        lastSuccessfulSaveAt="2026-08-22T00:59:00.000Z"
        onRetry={onRetry}
      />,
    );

    expect(onRetry).not.toHaveBeenCalled();
    expect(screen.getByText(/마지막 저장 성공/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '다시 저장' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('copies the exact failed document patch without runtime error or authentication data', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    render(
      <ConstructionPlanSaveRecovery
        snapshot={snapshot}
        lastSuccessfulSaveAt="2026-08-22T00:59:00.000Z"
        onRetry={jest.fn()}
      />,
    );

    expect(writeText).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '변경내용 복사' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const copied = JSON.parse(writeText.mock.calls[0][0]);
    expect(copied).toEqual({
      schemaVersion: 'construction-plan-unsaved-changes-v1',
      failedAt: snapshot.failedAt,
      failureState: 'request_failed',
      lastSuccessfulSaveAt: '2026-08-22T00:59:00.000Z',
      changes: snapshot.patch,
    });
    expect(writeText.mock.calls[0][0]).not.toContain('auth');
    expect(writeText.mock.calls[0][0]).not.toContain('error');
    await waitFor(() => expect(screen.getByRole('button', { name: '복사됨' })).toBeInTheDocument());
  });

  it('keeps the serializer deterministic for a last-failure recovery payload', () => {
    expect(serializeConstructionPlanFailedSave(snapshot, '2026-08-22T00:59:00.000Z')).toBe(
      serializeConstructionPlanFailedSave(snapshot, '2026-08-22T00:59:00.000Z'),
    );
  });

  it('merges edits queued during a failed request into the recoverable copy', () => {
    const attempted = { title: '저장 시도 제목', documentNo: 'CP-001' };
    const queued = { title: '저장 중 다시 변경한 제목' };

    expect(mergeConstructionPlanFailedSavePatch(attempted, queued)).toEqual({
      title: '저장 중 다시 변경한 제목',
      documentNo: 'CP-001',
    });
  });

  it('keeps copy available but disables retry after the edit lock is lost', () => {
    render(
      <ConstructionPlanSaveRecovery
        snapshot={{ ...snapshot, reason: 'lock_lost' }}
        lastSuccessfulSaveAt="2026-08-22T00:59:00.000Z"
        onRetry={jest.fn()}
      />,
    );

    expect(screen.getByText('편집 잠금이 회수되어 변경사항을 저장하지 못했습니다.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '편집 잠금 필요' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '변경내용 복사' })).toBeEnabled();
  });
});
