import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ConstructionPlanDrawingUploadProgress } from './ConstructionPlanDrawingUploadProgress';

describe('ConstructionPlanDrawingUploadProgress', () => {
  it('shows the staging upload percentage', () => {
    const onCancel = jest.fn();
    render(<ConstructionPlanDrawingUploadProgress onCancel={onCancel} state={{
      status: 'working',
      progress: { stage: 'uploading', percent: 47.6 },
    }} />);
    expect(screen.getByRole('status').textContent).toContain('격리 저장소 업로드');
    expect(screen.getByRole('status').textContent).toContain('48%');
    expect(screen.getByRole('progressbar').getAttribute('value')).toBe('48');
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('reports the immutable source revision after server finalization', () => {
    render(<ConstructionPlanDrawingUploadProgress state={{
      status: 'completed',
      storagePath: 'construction-plans/site-a/plan-a/drawings/d-01/rev-2/source.pdf',
      sourceRevision: 2,
    }} />);
    expect(screen.getByRole('status').textContent).toContain('불변 원본 Rev.2');
  });

  it('announces a fail-closed error', () => {
    render(<ConstructionPlanDrawingUploadProgress state={{ status: 'error', message: '파일 검증 실패' }} />);
    expect(screen.getByRole('alert').textContent).toContain('파일 검증 실패');
  });

  it('explains that a canceled upload can be retried from the drawing workspace', () => {
    render(<ConstructionPlanDrawingUploadProgress state={{
      status: 'canceled',
      message: '도면 작업공간에서 파일을 다시 선택하세요.',
    }} />);
    expect(screen.getByRole('status').textContent).toContain('도면 업로드 취소됨');
    expect(screen.getByRole('status').textContent).toContain('다시 선택');
  });

  it('does not offer cancellation after server verification begins', () => {
    render(<ConstructionPlanDrawingUploadProgress onCancel={jest.fn()} state={{
      status: 'working',
      progress: { stage: 'verifying', percent: 99 },
    }} />);
    expect(screen.queryByRole('button', { name: '취소' })).toBeNull();
  });
});
