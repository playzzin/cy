import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import ConstructionPlanEditorModeSwitch from './ConstructionPlanEditorModeSwitch';

const baseProps = {
  mode: 'edit' as const,
  canEditMode: true,
  saveLabel: '저장됨 10:30',
  blockingErrorCount: 0,
  pdfReady: true,
  openReviewCount: 0,
  reviewPackageAvailable: false,
  onChange: jest.fn(),
};

describe('ConstructionPlanEditorModeSwitch', () => {
  beforeEach(() => baseProps.onChange.mockReset());

  it('exposes three explicit modes with the active description and state', () => {
    render(<ConstructionPlanEditorModeSwitch {...baseProps} mode="preview" blockingErrorCount={2} pdfReady={false} />);

    expect(screen.getAllByRole('tab')).toHaveLength(3);
    expect(screen.getByRole('tab', { name: '작성 모드' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tab', { name: 'A4 미리보기 모드' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('저장된 문서의 A4 편집 결과와 PDF 준비 상태를 점검합니다.')).toBeInTheDocument();
    expect(screen.getByText('필수 보완 2건')).toBeInTheDocument();
  });

  it('keeps preview and review available when the lifecycle blocks editing', () => {
    render(<ConstructionPlanEditorModeSwitch {...baseProps} mode="preview" canEditMode={false} />);

    expect(screen.getByRole('tab', { name: '작성 모드' })).toBeDisabled();
    expect(screen.getByRole('tab', { name: 'A4 미리보기 모드' })).toBeEnabled();
    expect(screen.getByRole('tab', { name: '검토 모드' })).toBeEnabled();
  });

  it('prioritizes a snapshot review route and blocks other mode buttons', () => {
    render(<ConstructionPlanEditorModeSwitch {...baseProps} mode="review" reviewRouteLocked />);

    expect(screen.getByRole('tab', { name: '작성 모드' })).toBeDisabled();
    expect(screen.getByRole('tab', { name: 'A4 미리보기 모드' })).toBeDisabled();
    expect(screen.getByRole('tab', { name: '검토 모드' })).toBeEnabled();
  });

  it('temporarily blocks every mode without showing a mode-switch spinner', () => {
    const { container } = render(<ConstructionPlanEditorModeSwitch {...baseProps} disabled />);

    screen.getAllByRole('tab').forEach((tab) => expect(tab).toBeDisabled());
    expect(container.querySelector('.cp-spin')).toBeNull();
  });

  it('supports arrow-key navigation across enabled segments', () => {
    render(<ConstructionPlanEditorModeSwitch {...baseProps} />);

    fireEvent.keyDown(screen.getByRole('tab', { name: '작성 모드' }), { key: 'ArrowRight' });
    expect(baseProps.onChange).toHaveBeenCalledWith('preview');
  });

  it('shows immutable package and unresolved review state', () => {
    render(<ConstructionPlanEditorModeSwitch
      {...baseProps}
      mode="review"
      reviewPackageAvailable
      openReviewCount={3}
    />);

    expect(screen.getByText('고정 패키지 연결 · 미해결 3건')).toBeInTheDocument();
  });
});
