import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import ConstructionPlanWorkflowActions from './ConstructionPlanWorkflowActions';

const handlers = {
  onDraftPdf: jest.fn(),
  onRequestReview: jest.fn(),
  onCompleteReview: jest.fn(),
  onOpenRequestChanges: jest.fn(),
  onApprove: jest.fn(),
  onIssue: jest.fn(),
  onDownloadIssued: jest.fn(),
  onOpenActiveRevision: jest.fn(),
  onCreateRevision: jest.fn(),
  onClone: jest.fn(),
};

describe('ConstructionPlanWorkflowActions', () => {
  beforeEach(() => jest.clearAllMocks());

  it('offers both review completion and a reason-first change request path', () => {
    render(
      <ConstructionPlanWorkflowActions
        status="in_review"
        blockingErrorCount={0}
        {...handlers}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '수정 요청' }));
    fireEvent.click(screen.getByRole('button', { name: '검토 완료' }));
    expect(handlers.onOpenRequestChanges).toHaveBeenCalledTimes(1);
    expect(handlers.onCompleteReview).toHaveBeenCalledTimes(1);
  });

  it('keeps the reason-first change request path available after review completion', () => {
    render(
      <ConstructionPlanWorkflowActions
        status="review_completed"
        blockingErrorCount={0}
        {...handlers}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '수정 요청' }));
    expect(handlers.onOpenRequestChanges).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: '최종 승인' })).toBeInTheDocument();
  });

  it('blocks review submission while authoring validation errors remain', () => {
    render(
      <ConstructionPlanWorkflowActions
        status="draft"
        blockingErrorCount={3}
        {...handlers}
      />,
    );

    expect(screen.getByRole('button', { name: /검토 요청/ })).toBeDisabled();
    expect(screen.getByText('검토 전 해결할 오류 3건')).toBeInTheDocument();
  });

  it('enables issued download only when an explicit server storage path is available', () => {
    const { rerender } = render(
      <ConstructionPlanWorkflowActions
        status="issued"
        blockingErrorCount={0}
        issuedDownloadAvailable={false}
        {...handlers}
      />,
    );
    expect(screen.getByRole('button', { name: '발행 PDF 다운로드' })).toBeDisabled();

    rerender(
      <ConstructionPlanWorkflowActions
        status="issued"
        blockingErrorCount={0}
        issuedDownloadAvailable
        {...handlers}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '발행 PDF 다운로드' }));
    expect(handlers.onDownloadIssued).toHaveBeenCalledTimes(1);
  });

  it.each(['superseded', 'archived'] as const)('keeps the issued PDF available for %s documents', (status) => {
    render(
      <ConstructionPlanWorkflowActions
        status={status}
        blockingErrorCount={0}
        issuedDownloadAvailable
        {...handlers}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '발행 PDF 다운로드' }));
    expect(handlers.onDownloadIssued).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /복제/ })).toBeInTheDocument();
  });

  it('offers a new revision only for the current issued document', () => {
    render(
      <ConstructionPlanWorkflowActions
        status="issued"
        blockingErrorCount={0}
        issuedDownloadAvailable
        {...handlers}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /개정본 만들기/ }));
    expect(handlers.onCreateRevision).toHaveBeenCalledTimes(1);
  });

  it('replaces revision creation with the active successor link', () => {
    render(
      <ConstructionPlanWorkflowActions
        status="issued"
        blockingErrorCount={0}
        issuedDownloadAvailable
        activeRevision={{ id: 'plan-r1', revision: 1, status: 'draft' }}
        {...handlers}
      />,
    );

    expect(screen.queryByRole('button', { name: /개정본 만들기/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /진행 중 REV\.01 열기/ }));
    expect(handlers.onOpenActiveRevision).toHaveBeenCalledTimes(1);
    expect(handlers.onCreateRevision).not.toHaveBeenCalled();
  });
});
