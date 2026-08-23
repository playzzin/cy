import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ConstructionPlanReviewCommentView } from '../services/constructionPlanReviewUiAdapter';
import ConstructionPlanReviewWorkspacePanel, {
  filterConstructionPlanReviewComments,
  filterConstructionPlanSnapshotChanges,
} from './ConstructionPlanReviewWorkspacePanel';

const comments: ConstructionPlanReviewCommentView[] = [
  { id: 'open-field', planId: 'plan-1', reviewPackageId: 'review-0', reviewSnapshotId: 'snapshot-0', version: 1, body: '설치간격 근거를 확인해주세요.', status: 'open', authorId: 'reviewer-1', authorName: '안전 검토자', createdAt: '2026-08-21T01:00:00.000Z', visibility: 'participants', required: true, anchorStatus: 'carried', replyCount: 1, permissions: { canReply: true, canMarkAddressed: true, canResolve: true }, originReviewPackageId: 'review-0', originReviewRound: 1, currentAnchorMapping: { status: 'moved' }, anchor: { kind: 'field', label: '구조기준 · 설치간격', sectionId: 'engineering', fieldPath: '/engineeringValues/0/value' } },
  { id: 'open-drawing', planId: 'plan-1', reviewPackageId: 'review-1', reviewSnapshotId: 'snapshot-1', version: 2, body: '해체구간 범례가 누락되었습니다.', status: 'addressed', authorId: 'reviewer-2', authorName: '공사 검토자', createdAt: '2026-08-21T02:00:00.000Z', visibility: 'reviewers_and_approvers', required: true, anchorStatus: 'active', replyCount: 1, permissions: { canResolve: true }, originReviewPackageId: 'review-1', originReviewRound: 2, currentAnchorMapping: { status: 'unchanged' }, anchor: { kind: 'drawing', label: 'D-02 해체구간', sectionId: 'drawing-2', drawingId: 'd-02', pageIndex: 15, pageFingerprint: 'page-hash' } },
  { id: 'resolved', planId: 'plan-1', reviewPackageId: 'review-1', reviewSnapshotId: 'snapshot-1', version: 3, body: '담당자 확인 완료', status: 'resolved', authorId: 'reviewer-1', authorName: '안전 검토자', createdAt: '2026-08-20T01:00:00.000Z', visibility: 'participants', required: false, anchorStatus: 'active', permissions: { canReopen: true }, resolvedByName: '작성자', anchor: { kind: 'section', label: '조직도', sectionId: 'organization' } },
];

describe('ConstructionPlanReviewWorkspacePanel', () => {
  it('filters comments, navigates anchors, and requests resolution', async () => {
    const onNavigateAnchor = jest.fn();
    const onSetCommentResolved = jest.fn();
    render(<ConstructionPlanReviewWorkspacePanel comments={comments} onNavigateAnchor={onNavigateAnchor} onSetCommentResolved={onSetCommentResolved} comparison={{ reviewPackageId: 'review-1', reviewPackageLabel: '검토 제출본', reviewPackageHash: 'a'.repeat(64), reviewRound: 2, reviewPackageCreatedAt: '2026-08-21T00:00:00.000Z', baseline: { kind: 'previous_submission', id: 'review-0', label: '직전 제출본', hash: 'b'.repeat(64) }, changedSectionCount: 1, changedFieldCount: 1, changedDrawingCount: 0, changes: [{ id: 'change-1', kind: 'field', label: '설치간격', sectionId: 'engineering', before: '900', after: '600' }] }} />);

    expect(screen.getByText('설치간격 근거를 확인해주세요.')).toBeInTheDocument();
    expect(screen.queryByText('담당자 확인 완료')).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: '댓글 위치 유형' }), { target: { value: 'drawing' } });
    fireEvent.click(screen.getByRole('button', { name: /D-02 해체구간/ }));
    expect(onNavigateAnchor).toHaveBeenCalledWith(expect.objectContaining({ id: 'open-drawing' }));

    fireEvent.change(screen.getByRole('combobox', { name: '댓글 위치 유형' }), { target: { value: 'all' } });
    fireEvent.click(screen.getAllByRole('button', { name: '해결' })[0]);
    expect(onSetCommentResolved).toHaveBeenCalledWith(expect.objectContaining({ id: 'open-field' }), true);
    fireEvent.click(screen.getByRole('button', { name: '해결됨' }));
    expect(screen.getByText('담당자 확인 완료')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '재열기' }));
    fireEvent.change(screen.getByRole('textbox', { name: '재열기 사유' }), { target: { value: '근거 도면이 다시 변경되었습니다.' } });
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(screen.queryByRole('textbox', { name: '재열기 사유' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '재열기' }));
    fireEvent.change(screen.getByRole('textbox', { name: '재열기 사유' }), { target: { value: '승인 근거를 다시 확인해야 합니다.' } });
    fireEvent.click(screen.getByRole('button', { name: '재열기 확인' }));
    await waitFor(() => expect(onSetCommentResolved).toHaveBeenCalledWith(expect.objectContaining({ id: 'resolved' }), false, '승인 근거를 다시 확인해야 합니다.'));
  });

  it('keeps the pure comment filter deterministic', () => {
    expect(filterConstructionPlanReviewComments(comments, 'open', 'field').map((comment) => comment.id)).toEqual(['open-field']);
  });

  it('creates an anchored comment and lazy-loads the reply thread', async () => {
    const onCreateComment = jest.fn().mockResolvedValue(undefined);
    const onLoadMessages = jest.fn().mockResolvedValue([{
      id: 'message-1', commentId: 'open-field', body: '간격을 600mm로 수정했습니다.',
      authorId: 'author-1', authorName: '현장 작성자', createdAt: '2026-08-21T03:00:00.000Z',
    }]);
    const onReplyComment = jest.fn().mockResolvedValue(undefined);
    render(<ConstructionPlanReviewWorkspacePanel
      comments={comments}
      available
      canCreateComment
      currentAnchor={{ kind: 'section', sectionId: 'engineering', label: '구조 검토' }}
      onCreateComment={onCreateComment}
      onLoadMessages={onLoadMessages}
      onReplyComment={onReplyComment}
    />);

    fireEvent.click(screen.getByRole('button', { name: '현재 위치 의견 추가' }));
    fireEvent.change(screen.getByRole('textbox', { name: '검토 의견' }), { target: { value: '구조계산 근거를 첨부해주세요.' } });
    fireEvent.click(screen.getByRole('button', { name: '의견 등록' }));
    await waitFor(() => expect(onCreateComment).toHaveBeenCalledWith(expect.objectContaining({
      body: '구조계산 근거를 첨부해주세요.',
      anchor: expect.objectContaining({ sectionId: 'engineering' }),
    })));

    const comment = screen.getByText('설치간격 근거를 확인해주세요.').closest('article')!;
    fireEvent.click(within(comment).getByRole('button', { name: /답변 1개/ }));
    expect(await within(comment).findByText('간격을 600mm로 수정했습니다.')).toBeInTheDocument();
    expect(onLoadMessages).toHaveBeenCalledTimes(1);

    fireEvent.click(within(comment).getByRole('button', { name: '답변' }));
    fireEvent.change(within(comment).getByRole('textbox', { name: '댓글 답변' }), { target: { value: '조치 사진도 등록했습니다.' } });
    fireEvent.click(within(comment).getByRole('button', { name: '답변 등록' }));
    await waitFor(() => expect(onReplyComment).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'open-field' }),
      '조치 사진도 등록했습니다.',
      expect.stringMatching(/^cp-review-reply-/),
    ));
    await waitFor(() => expect(onLoadMessages).toHaveBeenCalledTimes(2));
  });

  it('reuses an attempt id after a failed response but separates a later identical comment', async () => {
    const onCreateComment = jest.fn()
      .mockRejectedValueOnce(new Error('response-lost'))
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);
    render(<ConstructionPlanReviewWorkspacePanel
      comments={comments}
      available
      canCreateComment
      currentAnchor={{ kind: 'section', sectionId: 'engineering', label: '구조 검토' }}
      onCreateComment={onCreateComment}
    />);

    fireEvent.click(screen.getByRole('button', { name: '현재 위치 의견 추가' }));
    fireEvent.change(screen.getByRole('textbox', { name: '검토 의견' }), { target: { value: '동일한 검토 문구' } });
    fireEvent.click(screen.getByRole('button', { name: '의견 등록' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('의견을 등록하지 못했습니다');
    const firstRequestId = onCreateComment.mock.calls[0][0].requestId;

    fireEvent.click(screen.getByRole('button', { name: '의견 등록' }));
    await waitFor(() => expect(onCreateComment).toHaveBeenCalledTimes(2));
    expect(onCreateComment.mock.calls[1][0].requestId).toBe(firstRequestId);

    fireEvent.click(screen.getByRole('button', { name: '현재 위치 의견 추가' }));
    fireEvent.change(screen.getByRole('textbox', { name: '검토 의견' }), { target: { value: '동일한 검토 문구' } });
    fireEvent.click(screen.getByRole('button', { name: '의견 등록' }));
    await waitFor(() => expect(onCreateComment).toHaveBeenCalledTimes(3));
    expect(onCreateComment.mock.calls[2][0].requestId).not.toBe(firstRequestId);
  });

  it('keeps reply retries idempotent without merging a later identical reply', async () => {
    const onReplyComment = jest.fn()
      .mockRejectedValueOnce(new Error('response-lost'))
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);
    render(<ConstructionPlanReviewWorkspacePanel
      comments={comments}
      available
      onReplyComment={onReplyComment}
    />);

    const comment = screen.getByText('설치간격 근거를 확인해주세요.').closest('article')!;
    fireEvent.click(within(comment).getByRole('button', { name: '답변' }));
    fireEvent.change(within(comment).getByRole('textbox', { name: '댓글 답변' }), { target: { value: '동일한 조치 답변' } });
    fireEvent.click(within(comment).getByRole('button', { name: '답변 등록' }));
    expect(await within(comment).findByRole('alert')).toHaveTextContent('답변을 등록하지 못했습니다');
    const firstRequestId = onReplyComment.mock.calls[0][2];

    fireEvent.click(within(comment).getByRole('button', { name: '답변 등록' }));
    await waitFor(() => expect(onReplyComment).toHaveBeenCalledTimes(2));
    expect(onReplyComment.mock.calls[1][2]).toBe(firstRequestId);
    await waitFor(() => expect(within(comment).queryByRole('textbox', { name: '댓글 답변' })).not.toBeInTheDocument());

    fireEvent.click(within(comment).getByRole('button', { name: '답변' }));
    fireEvent.change(within(comment).getByRole('textbox', { name: '댓글 답변' }), { target: { value: '동일한 조치 답변' } });
    fireEvent.click(within(comment).getByRole('button', { name: '답변 등록' }));
    await waitFor(() => expect(onReplyComment).toHaveBeenCalledTimes(3));
    expect(onReplyComment.mock.calls[2][2]).not.toBe(firstRequestId);
  });

  it('paginates all changes and filters rich inline, field and annotation details without an eight-item cutoff', () => {
    const fieldChanges = Array.from({ length: 25 }, (_entry, index) => ({
      id: `field-${index}`,
      kind: 'field' as const,
      changeType: 'changed' as const,
      label: `필드 ${index}`,
      path: `/sections/method/content/field${index}`,
      sectionId: 'method',
      sectionLabel: '시공 방법',
      pageNumbers: [12],
      before: `이전 ${index}`,
      after: `변경 ${index}`,
    }));
    const changes = [{
      id: 'text-change', kind: 'text' as const, changeType: 'changed' as const, label: '표준 시공문구',
      path: '/sections/method/content/standardTextCurrent', sectionId: 'method', sectionLabel: '시공 방법', pageNumbers: [12],
      before: '기존 시공 문구', after: '변경 시공 문구',
      textSegments: [{ kind: 'removed' as const, text: '기존' }, { kind: 'added' as const, text: '변경' }, { kind: 'equal' as const, text: ' 시공 문구' }],
    }, ...fieldChanges, {
      id: 'annotation-change', kind: 'annotation' as const, changeType: 'changed' as const, label: '통제구간',
      drawingId: 'drawing-1', drawingLabel: '설치 평면도', annotationId: 'annotation-1', pageIndex: 0,
      pageId: 'page-1-abcdef123456', pageNumbers: [1], changedParts: ['geometry', 'style'],
      before: '사각형 x 0.1 · 두께 1pt', after: '사각형 x 0.2 · 두께 2pt',
    }];
    render(<ConstructionPlanReviewWorkspacePanel comments={[]} comparison={{
      reviewPackageId: 'review-2', reviewPackageLabel: 'Round 2 제출본', reviewPackageHash: 'a'.repeat(64), reviewRound: 2,
      reviewPackageCreatedAt: '2026-08-21T00:00:00.000Z', readOnly: true, summaryHash: 'c'.repeat(64),
      baselineContentHash: 'b'.repeat(64), currentContentHash: 'a'.repeat(64),
      baseline: { kind: 'previous_submission', id: 'review-1', label: '직전 제출본 · Round 1', hash: 'b'.repeat(64) },
      changedSectionCount: 1, changedFieldCount: 26, changedDrawingCount: 1, changedAnnotationCount: 1, changes,
    }} />);

    expect(screen.getByText('전체 변경 27건')).toBeInTheDocument();
    expect(screen.getByText(/과거 Round의 고정 스냅샷/)).toBeInTheDocument();
    expect(screen.getByText('필드 0')).toBeInTheDocument();
    expect(screen.queryByText('필드 24')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '다음 변경' }));
    expect(screen.getByText('필드 24')).toBeInTheDocument();
    expect(screen.getByText('2 / 2 페이지 · 27건')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '본문 1' }));
    expect(screen.getByText('표준 시공문구')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '변경 전' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '변경 후' })).toBeInTheDocument();
    const inline = screen.getByLabelText('표준 시공문구 인라인 변경 비교');
    expect(within(inline).getByText('기존').tagName).toBe('DEL');
    expect(within(inline).getByText('변경').tagName).toBe('INS');

    fireEvent.click(screen.getByRole('button', { name: '도면 주석 1' }));
    expect(screen.getByText(/도면 ID:/).parentElement).toHaveTextContent('drawing-1');
    expect(screen.getByText(/주석 ID:/).parentElement).toHaveTextContent('annotation-1');
    expect(screen.getByText(/페이지 ID:/).parentElement).toHaveTextContent('page-1-abcdef123456');
  });

  it('keeps change filtering deterministic', () => {
    const changes = [
      { id: 'text', kind: 'text' as const, label: '본문' },
      { id: 'field', kind: 'field' as const, label: '필드' },
      { id: 'annotation', kind: 'annotation' as const, label: '주석' },
    ];
    expect(filterConstructionPlanSnapshotChanges(changes, 'field').map((change) => change.id)).toEqual(['field']);
    expect(filterConstructionPlanSnapshotChanges(changes, 'all')).toEqual(changes);
  });
});
