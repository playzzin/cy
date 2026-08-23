import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  GitCompareArrows,
  Loader2,
  MapPin,
  MessageSquareText,
  RefreshCw,
} from 'lucide-react';
import { createConstructionPlanReviewMutationRequestId } from '../services/constructionPlanReviewMutationId';
import type {
  ConstructionPlanReviewAnchor,
  ConstructionPlanReviewCommentStatus,
  ConstructionPlanReviewCommentVisibility,
  ConstructionPlanReviewCommentView,
  ConstructionPlanReviewMessageView,
  ConstructionPlanSnapshotChangeView,
  ConstructionPlanSnapshotComparisonView,
} from '../services/constructionPlanReviewUiAdapter';

type CommentFilter = ConstructionPlanReviewCommentStatus | 'unresolved' | 'all';
type AnchorFilter = ConstructionPlanReviewCommentView['anchor']['kind'] | 'all';
type ChangeFilter = ConstructionPlanSnapshotChangeView['kind'] | 'all';

type ConstructionPlanReviewWorkspacePanelProps = {
  comments: readonly ConstructionPlanReviewCommentView[];
  comparison?: ConstructionPlanSnapshotComparisonView;
  loading?: boolean;
  error?: string;
  available?: boolean;
  unavailableReason?: string;
  resolvingCommentId?: string;
  canCreateComment?: boolean;
  currentAnchor?: ConstructionPlanReviewAnchor;
  onRetry?: () => void;
  onNavigateAnchor?: (comment: ConstructionPlanReviewCommentView) => void;
  onNavigateChange?: (sectionId: string) => void;
  onReplyComment?: (comment: ConstructionPlanReviewCommentView, body: string, requestId: string) => void | Promise<void>;
  onMarkCommentAddressed?: (comment: ConstructionPlanReviewCommentView) => void;
  onSetCommentResolved?: (comment: ConstructionPlanReviewCommentView, resolved: boolean, reason?: string) => void | Promise<void>;
  onCreateComment?: (input: { body: string; required: boolean; visibility: ConstructionPlanReviewCommentVisibility; anchor: ConstructionPlanReviewAnchor; requestId: string }) => void | Promise<void>;
  onLoadMessages?: (comment: ConstructionPlanReviewCommentView) => Promise<ConstructionPlanReviewMessageView[]>;
};

type MessageState = { loading: boolean; error?: string; items: ConstructionPlanReviewMessageView[] };
type MutationAttempt = { fingerprint: string; requestId: string };

const formatDateTime = (value?: string): string => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(date);
};

const anchorKindLabel: Record<ConstructionPlanReviewCommentView['anchor']['kind'], string> = {
  plan: '계획서',
  section: '섹션',
  field: '필드',
  drawing: '도면',
};

const statusLabel: Record<ConstructionPlanReviewCommentStatus, string> = {
  open: '미해결',
  addressed: '처리표시',
  resolved: '해결됨',
};

const CHANGE_PAGE_SIZE = 20;

const changeKindLabel: Record<ConstructionPlanSnapshotChangeView['kind'], string> = {
  section: '섹션',
  field: '구조화 필드',
  text: '본문',
  drawing: '도면',
  annotation: '도면 주석',
};

const changeTypeLabel: Record<NonNullable<ConstructionPlanSnapshotChangeView['changeType']>, string> = {
  added: '추가',
  deleted: '삭제',
  changed: '변경',
};

const annotationPartLabel: Readonly<Record<string, string>> = {
  binding: '페이지 바인딩',
  layer: '구간 유형',
  geometry: '좌표·형상',
  style: '표시 스타일',
  label: '라벨',
  zone: '구간 코드',
  schedule: '적용 일정',
  equipment: '장비 정보',
  route: '진입·도착 경로',
  responsibility: '담당 정보',
  material: '자재 정보',
  release: '해제 조건',
  metadata: '기타 속성',
};

const shortHash = (value?: string): string => {
  if (!value) return '-';
  return value.length > 18 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
};

export function filterConstructionPlanSnapshotChanges(
  changes: readonly ConstructionPlanSnapshotChangeView[],
  filter: ChangeFilter,
): ConstructionPlanSnapshotChangeView[] {
  return filter === 'all' ? [...changes] : changes.filter((change) => change.kind === filter);
}

export function filterConstructionPlanReviewComments(
  comments: readonly ConstructionPlanReviewCommentView[],
  status: CommentFilter,
  anchorKind: AnchorFilter,
): ConstructionPlanReviewCommentView[] {
  return comments.filter((comment) => (
    (status === 'all' || (status === 'unresolved' ? comment.status !== 'resolved' : comment.status === status))
    && (anchorKind === 'all' || comment.anchor.kind === anchorKind)
  ));
}

export function ConstructionPlanReviewWorkspacePanel({
  comments,
  comparison,
  loading = false,
  error,
  available = true,
  unavailableReason,
  resolvingCommentId,
  canCreateComment = false,
  currentAnchor,
  onRetry,
  onNavigateAnchor,
  onNavigateChange,
  onReplyComment,
  onMarkCommentAddressed,
  onSetCommentResolved,
  onCreateComment,
  onLoadMessages,
}: ConstructionPlanReviewWorkspacePanelProps) {
  const [statusFilter, setStatusFilter] = useState<CommentFilter>('unresolved');
  const [anchorFilter, setAnchorFilter] = useState<AnchorFilter>('all');
  const [replyingCommentId, setReplyingCommentId] = useState<string>();
  const [replyBody, setReplyBody] = useState('');
  const [creatingComment, setCreatingComment] = useState(false);
  const [createBody, setCreateBody] = useState('');
  const [createRequired, setCreateRequired] = useState(true);
  const [createVisibility, setCreateVisibility] = useState<ConstructionPlanReviewCommentVisibility>('participants');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [createAttempt, setCreateAttempt] = useState<MutationAttempt>();
  const [createError, setCreateError] = useState('');
  const [replyError, setReplyError] = useState('');
  const [submittingReplyId, setSubmittingReplyId] = useState<string>();
  const [replyAttempt, setReplyAttempt] = useState<MutationAttempt>();
  const [reopeningCommentId, setReopeningCommentId] = useState<string>();
  const [reopenReason, setReopenReason] = useState('');
  const [expandedCommentId, setExpandedCommentId] = useState<string>();
  const [messageStates, setMessageStates] = useState<Record<string, MessageState>>({});
  const [changeFilter, setChangeFilter] = useState<ChangeFilter>('all');
  const [changePage, setChangePage] = useState(0);
  const visibleComments = useMemo(
    () => filterConstructionPlanReviewComments(comments, statusFilter, anchorFilter),
    [anchorFilter, comments, statusFilter],
  );
  const unresolvedCount = comments.filter((comment) => comment.status !== 'resolved').length;
  const addressedCount = comments.filter((comment) => comment.status === 'addressed').length;
  const resolvedCount = comments.filter((comment) => comment.status === 'resolved').length;
  const filteredChanges = useMemo(
    () => filterConstructionPlanSnapshotChanges(comparison?.changes ?? [], changeFilter),
    [changeFilter, comparison?.changes],
  );
  const changePageCount = Math.max(1, Math.ceil(filteredChanges.length / CHANGE_PAGE_SIZE));
  const visibleChangePage = Math.min(changePage, changePageCount - 1);
  const visibleChanges = filteredChanges.slice(
    visibleChangePage * CHANGE_PAGE_SIZE,
    (visibleChangePage + 1) * CHANGE_PAGE_SIZE,
  );

  const loadMessages = async (comment: ConstructionPlanReviewCommentView, force = false) => {
    if (!onLoadMessages) return;
    if (!force && messageStates[comment.id]?.items.length) return;
    setMessageStates((current) => ({ ...current, [comment.id]: { loading: true, items: current[comment.id]?.items ?? [] } }));
    try {
      const items = await onLoadMessages(comment);
      setMessageStates((current) => ({ ...current, [comment.id]: { loading: false, items } }));
    } catch {
      setMessageStates((current) => ({ ...current, [comment.id]: { loading: false, error: '답변을 불러오지 못했습니다.', items: current[comment.id]?.items ?? [] } }));
    }
  };

  const submitNewComment = async (event: React.FormEvent) => {
    event.preventDefault();
    const body = createBody.trim();
    if (!body || !currentAnchor || !onCreateComment) return;
    const fingerprint = JSON.stringify({ body, required: createRequired, visibility: createVisibility, anchor: currentAnchor });
    const attempt = createAttempt?.fingerprint === fingerprint
      ? createAttempt
      : { fingerprint, requestId: createConstructionPlanReviewMutationRequestId('create') };
    if (attempt !== createAttempt) setCreateAttempt(attempt);
    setSubmittingComment(true);
    setCreateError('');
    try {
      await onCreateComment({ body, required: createRequired, visibility: createVisibility, anchor: currentAnchor, requestId: attempt.requestId });
      setCreateBody('');
      setCreateAttempt(undefined);
      setCreatingComment(false);
    } catch {
      setCreateError('의견을 등록하지 못했습니다. 검토 패키지가 최신인지 확인한 뒤 다시 시도해주세요.');
    } finally {
      setSubmittingComment(false);
    }
  };

  const submitReply = async (event: React.FormEvent, comment: ConstructionPlanReviewCommentView) => {
    event.preventDefault();
    const body = replyBody.trim();
    if (!body || !onReplyComment) return;
    const fingerprint = JSON.stringify({ commentId: comment.id, body });
    const attempt = replyAttempt?.fingerprint === fingerprint
      ? replyAttempt
      : { fingerprint, requestId: createConstructionPlanReviewMutationRequestId('reply') };
    if (attempt !== replyAttempt) setReplyAttempt(attempt);
    setSubmittingReplyId(comment.id);
    setReplyError('');
    try {
      await onReplyComment(comment, body, attempt.requestId);
      setReplyBody('');
      setReplyAttempt(undefined);
      setReplyingCommentId(undefined);
      setExpandedCommentId(comment.id);
      await loadMessages(comment, true);
    } catch {
      setReplyError('답변을 등록하지 못했습니다. 네트워크 상태와 댓글 버전을 확인해주세요.');
    } finally {
      setSubmittingReplyId(undefined);
    }
  };

  const submitReopen = async (event: React.FormEvent, comment: ConstructionPlanReviewCommentView) => {
    event.preventDefault();
    const reason = reopenReason.trim();
    if (reason.length < 5 || !onSetCommentResolved) return;
    await onSetCommentResolved(comment, false, reason);
    setReopeningCommentId(undefined);
    setReopenReason('');
  };

  if (loading) {
    return <section className="cp-review-workspace cp-review-workspace--loading" aria-label="검토댓글 불러오는 중" aria-busy="true"><Loader2 size={22} className="cp-spin" /><strong>검토댓글과 제출본 변경사항을 불러오는 중입니다</strong><span className="cp-review-skeleton" /><span className="cp-review-skeleton" /></section>;
  }

  if (error) {
    return <section className="cp-review-workspace cp-review-workspace--error" role="alert"><AlertCircle size={24} /><strong>검토 작업공간을 표시할 수 없습니다</strong><p>{error}</p>{onRetry && <button type="button" className="cp-button cp-button--secondary cp-button--small" onClick={onRetry}><RefreshCw size={14} /> 다시 시도</button>}</section>;
  }

  return (
    <section className="cp-review-workspace" aria-label="검토댓글 및 제출본 비교">
      <div className="cp-panel-heading cp-panel-heading--bordered">
        <div><span className="cp-eyebrow">Review workspace</span><h3>검토댓글 · 변경사항</h3></div>
        <MessageSquareText size={18} />
      </div>

      {!available && <div className="cp-review-unavailable" role="status"><AlertCircle size={16} /><div><strong>검토 데이터 연결 대기</strong><p>{unavailableReason || '검토 API 계약 연결 후 댓글과 제출본 비교가 표시됩니다.'}</p></div></div>}

      <div className="cp-review-create-bar"><div><MapPin size={14} /><span><small>현재 의견 위치</small><strong>{currentAnchor?.label || '계획서 전체'}</strong></span></div><button type="button" disabled={!available || !canCreateComment || !currentAnchor || !onCreateComment} onClick={() => { setCreateAttempt(undefined); setCreatingComment((value) => !value); }}>현재 위치 의견 추가</button></div>
      {creatingComment && currentAnchor && <form className="cp-review-create" onSubmit={submitNewComment}><label><span>검토 의견</span><textarea autoFocus maxLength={2000} value={createBody} onChange={(event) => setCreateBody(event.target.value)} placeholder="수정할 내용, 판단 근거와 기대 결과를 구체적으로 입력하세요." /></label><div className="cp-review-create__options"><label><input type="checkbox" checked={createRequired} onChange={(event) => { setCreateRequired(event.target.checked); if (event.target.checked) setCreateVisibility('participants'); }} /> 필수 의견 · 해결 전 검토완료/승인 차단</label><label><span>공개범위</span><select value={createVisibility} disabled={createRequired} onChange={(event) => setCreateVisibility(event.target.value as ConstructionPlanReviewCommentVisibility)}><option value="participants">계획서 참여자</option><option value="reviewers_and_approvers">검토자·승인자</option><option value="central_only">본사·관리자</option></select></label></div>{createError && <p className="cp-review-form-error" role="alert">{createError}</p>}<div className="cp-review-create__actions"><small>{createBody.trim().length}/2000</small><button type="button" disabled={submittingComment} onClick={() => { setCreatingComment(false); setCreateAttempt(undefined); setCreateError(''); }}>취소</button><button type="submit" disabled={!createBody.trim() || submittingComment}>{submittingComment && <Loader2 size={12} className="cp-spin" />} 의견 등록</button></div></form>}

      <div className="cp-review-section-heading"><MessageSquareText size={14} /><strong>댓글</strong><span>미해결 {unresolvedCount} · 처리 {addressedCount} · 해결 {resolvedCount}</span></div>
      <div className="cp-review-filter-row" aria-label="검토댓글 필터">
        <div role="group" aria-label="해결 상태">
          {(['unresolved', 'addressed', 'resolved', 'all'] as const).map((filter) => (
            <button key={filter} type="button" className={statusFilter === filter ? 'is-active' : ''} aria-pressed={statusFilter === filter} onClick={() => setStatusFilter(filter)}>{filter === 'unresolved' ? '미해결 전체' : filter === 'addressed' ? '처리표시' : filter === 'resolved' ? '해결됨' : '전체'}</button>
          ))}
        </div>
        <label><span className="sr-only">댓글 위치 유형</span><select value={anchorFilter} onChange={(event) => setAnchorFilter(event.target.value as AnchorFilter)}><option value="all">모든 위치</option><option value="plan">계획서</option><option value="section">섹션</option><option value="field">필드</option><option value="drawing">도면</option></select></label>
      </div>

      <div className="cp-review-comment-list">
        {visibleComments.map((comment) => {
          const resolving = resolvingCommentId === comment.id;
          const messageState = messageStates[comment.id];
          const pageNumber = comment.anchor.pageIndex === undefined ? undefined : comment.anchor.pageIndex + 1;
          const isPreviousCycle = Boolean(comparison && comment.originReviewPackageId && comment.originReviewPackageId !== comparison.reviewPackageId);
          const mappingStatus = comment.currentAnchorMapping?.status;
          const anchorUnavailable = comment.anchorStatus === 'stale' || comment.anchorStatus === 'orphaned'
            || (isPreviousCycle && !mappingStatus);
          return <article className={`cp-review-comment is-${comment.status}`} key={comment.id}>
            <div className="cp-review-comment__meta"><span>{comment.status === 'resolved' ? <CheckCircle2 size={13} /> : <CircleDot size={13} />}{statusLabel[comment.status]}</span><time dateTime={comment.createdAt}>{formatDateTime(comment.createdAt)}</time></div>
            <div className="cp-review-comment__flags">{comment.required && comment.status !== 'resolved' && <em>필수 의견 · 승인 차단</em>}{isPreviousCycle && <em className="is-previous">이전 제출본 · Round {comment.originReviewRound ?? '?'}</em>}{comment.anchorStatus === 'carried' && <em className="is-moved">이전 의견 승계 · 위치 확인됨</em>}{mappingStatus === 'moved' && <em className="is-moved">현재 위치로 연결됨</em>}{anchorUnavailable && <em className="is-stale">{comment.anchorStatus === 'orphaned' ? '현재 대상 삭제됨' : '현재 위치 확인 불가'}</em>}</div>
            <p>{comment.body}</p>
            <div className="cp-review-comment__author"><strong>{comment.authorName}</strong>{comment.resolvedByName && <span>{comment.resolvedByName} 해결</span>}</div>
            {comment.carriedFromCommentId && <small className="cp-review-comment__provenance">이전 댓글 {comment.carriedFromCommentId}에서 이어진 의견 · 원본 anchor 보존</small>}
            <button type="button" className="cp-review-anchor" disabled={!onNavigateAnchor || anchorUnavailable} onClick={() => onNavigateAnchor?.(comment)}><MapPin size={13} /><span><small>{anchorKindLabel[comment.anchor.kind]}{pageNumber ? ` · ${pageNumber}쪽` : ''}</small><strong>{comment.anchor.label}</strong></span><ChevronRight size={13} /></button>
            {onLoadMessages && <button type="button" className="cp-review-thread-toggle" aria-expanded={expandedCommentId === comment.id} onClick={() => { const nextOpen = expandedCommentId !== comment.id; setExpandedCommentId(nextOpen ? comment.id : undefined); if (nextOpen) void loadMessages(comment); }}><MessageSquareText size={13} /> 답변 {comment.replyCount ?? 0}개 <ChevronRight size={12} /></button>}
            {expandedCommentId === comment.id && <div className="cp-review-thread" aria-label={`${comment.anchor.label} 답변 목록`}>{messageState?.loading ? <span><Loader2 size={13} className="cp-spin" /> 답변을 불러오는 중</span> : messageState?.error ? <div role="alert"><AlertCircle size={13} />{messageState.error}<button type="button" onClick={() => void loadMessages(comment, true)}>다시 시도</button></div> : messageState?.items.length ? <ol>{messageState.items.map((message) => <li key={message.id}><p>{message.body}</p><span><strong>{message.authorName}</strong><time dateTime={message.createdAt}>{formatDateTime(message.createdAt)}</time></span></li>)}</ol> : <p>등록된 답변이 없습니다.</p>}</div>}
            <div className="cp-review-comment__actions">
              {comment.permissions?.canReply && onReplyComment && <button type="button" disabled={resolving || submittingReplyId === comment.id || !available} onClick={() => { setReplyingCommentId((current) => current === comment.id ? undefined : comment.id); setReplyBody(''); setReplyAttempt(undefined); setReplyError(''); }}>답변</button>}
              {comment.status === 'open' && comment.permissions?.canMarkAddressed && onMarkCommentAddressed && <button type="button" disabled={resolving || !available || !comment.replyCount} title={!comment.replyCount ? '답변을 등록한 뒤 처리표시할 수 있습니다.' : undefined} onClick={() => onMarkCommentAddressed(comment)}>처리표시</button>}
              {comment.status !== 'resolved' && comment.permissions?.canResolve && onSetCommentResolved && <button type="button" className="cp-review-resolve" disabled={resolving || !available} onClick={() => onSetCommentResolved(comment, true)}>{resolving && <Loader2 size={12} className="cp-spin" />}해결</button>}
              {comment.status === 'resolved' && comment.permissions?.canReopen && onSetCommentResolved && <button type="button" className="cp-review-resolve" disabled={resolving || !available} onClick={() => { setReopeningCommentId((current) => current === comment.id ? undefined : comment.id); setReopenReason(''); }}>{resolving && <Loader2 size={12} className="cp-spin" />}재열기</button>}
            </div>
            {reopeningCommentId === comment.id && <form className="cp-review-reply cp-review-reopen" onSubmit={(event) => { void submitReopen(event, comment); }}><label><span>재열기 사유</span><textarea autoFocus maxLength={2000} value={reopenReason} onChange={(event) => setReopenReason(event.target.value)} placeholder="해결 상태를 되돌리는 감사 사유를 5자 이상 입력하세요." /></label><div><small>{reopenReason.trim().length}/2000 · 최소 5자</small><button type="button" onClick={() => { setReopeningCommentId(undefined); setReopenReason(''); }}>취소</button><button type="submit" disabled={reopenReason.trim().length < 5 || resolving}>재열기 확인</button></div></form>}
            {replyingCommentId === comment.id && <form className="cp-review-reply" onSubmit={(event) => { void submitReply(event, comment); }}><label><span>댓글 답변</span><textarea autoFocus maxLength={2000} value={replyBody} onChange={(event) => setReplyBody(event.target.value)} placeholder="조치 내용과 확인 근거를 남겨주세요." /></label>{replyError && <p className="cp-review-form-error" role="alert">{replyError}</p>}<div><small>{replyBody.trim().length}/2000</small><button type="button" disabled={submittingReplyId === comment.id} onClick={() => { setReplyingCommentId(undefined); setReplyAttempt(undefined); }}>취소</button><button type="submit" disabled={!replyBody.trim() || resolving || submittingReplyId === comment.id}>{submittingReplyId === comment.id && <Loader2 size={12} className="cp-spin" />} 답변 등록</button></div></form>}
          </article>;
        })}
        {visibleComments.length === 0 && <div className="cp-review-empty"><MessageSquareText size={22} /><strong>{comments.length ? '필터에 맞는 댓글이 없습니다' : '등록된 검토댓글이 없습니다'}</strong><p>{available ? '검토 의견은 섹션·필드·도면 위치에 연결됩니다.' : 'API 연결 후 검토댓글이 이 위치에 표시됩니다.'}</p></div>}
      </div>

      <div className="cp-review-section-heading"><GitCompareArrows size={14} /><strong>검토 패키지 변경요약</strong>{comparison && <span>전체 변경 {comparison.changes.length}건</span>}</div>
      {comparison ? <div className="cp-snapshot-compare">
        <div className="cp-snapshot-compare__meta"><span><small>비교 기준</small><strong>{comparison.baseline.label}</strong><code title={comparison.baseline.hash || comparison.baseline.id || comparison.baseline.kind}>{shortHash(comparison.baseline.hash || comparison.baseline.id || comparison.baseline.kind)}</code></span><ChevronRight size={15} /><span><small>Round {comparison.reviewRound} 검토 패키지</small><strong>{comparison.reviewPackageLabel}{comparison.readOnly ? ' · 읽기 전용' : ''}</strong><code title={comparison.reviewPackageHash}>{shortHash(comparison.reviewPackageHash)}</code><em>{formatDateTime(comparison.reviewPackageCreatedAt)}</em></span></div>
        {comparison.readOnly && <div className="cp-snapshot-compare__readonly" role="status">과거 Round의 고정 스냅샷입니다. 당시 변경요약과 의견만 읽기 전용으로 표시합니다.</div>}
        <div className="cp-snapshot-compare__counts"><span><b>{comparison.changedSectionCount}</b>섹션</span><span><b>{comparison.changedFieldCount}</b>본문·필드</span><span><b>{comparison.changedDrawingCount}</b>도면</span><span><b>{comparison.changedAnnotationCount ?? 0}</b>주석</span></div>
        {comparison.summaryHash && <div className="cp-snapshot-compare__integrity"><span>변경요약 무결성</span><code title={comparison.summaryHash}>{shortHash(comparison.summaryHash)}</code><span>기준</span><code title={comparison.baselineContentHash}>{shortHash(comparison.baselineContentHash)}</code><span>제출본</span><code title={comparison.currentContentHash}>{shortHash(comparison.currentContentHash)}</code></div>}
        {comparison.changes.length ? <>
          <div className="cp-snapshot-compare__filters" role="group" aria-label="변경사항 유형 필터">
            {(['all', 'text', 'field', 'section', 'drawing', 'annotation'] as const).map((filter) => {
              const count = filterConstructionPlanSnapshotChanges(comparison.changes, filter).length;
              return <button key={filter} type="button" className={changeFilter === filter ? 'is-active' : ''} aria-pressed={changeFilter === filter} onClick={() => { setChangeFilter(filter); setChangePage(0); }}>{filter === 'all' ? '전체' : changeKindLabel[filter]} {count}</button>;
            })}
          </div>
          {visibleChanges.length ? <ol className="cp-snapshot-compare__changes" aria-label="제출본 전체 변경사항">
            {visibleChanges.map((change) => <li key={change.id} className={`is-${change.kind} is-${change.changeType || 'changed'}`}>
              <div className="cp-snapshot-change__heading"><span>{changeKindLabel[change.kind]}</span>{change.changeType && <em>{changeTypeLabel[change.changeType]}</em>}<strong>{change.label}</strong>{change.sectionId && onNavigateChange && <button type="button" onClick={() => onNavigateChange(change.sectionId!)}>위치 열기</button>}</div>
              <div className="cp-snapshot-change__location">
                {change.sectionLabel && <span>섹션: {change.sectionLabel}</span>}
                {change.path && <code>{change.path}</code>}
                {change.pageNumbers?.length ? <span>쪽: {change.pageNumbers.join(', ')}</span> : null}
                {change.drawingId && <span>도면 ID: <code>{change.drawingId}</code></span>}
                {change.drawingLabel && <span>도면명: {change.drawingLabel}</span>}
                {change.annotationId && <span>주석 ID: <code>{change.annotationId}</code></span>}
                {change.pageId && <span>페이지 ID: <code>{change.pageId}</code></span>}
              </div>
              {(change.before !== undefined || change.after !== undefined) && <table className="cp-snapshot-change__values"><thead><tr><th scope="col">변경 전</th><th scope="col">변경 후</th></tr></thead><tbody><tr><td><del>{change.before || '없음'}</del></td><td><ins>{change.after || '없음'}</ins></td></tr></tbody></table>}
              {change.textSegments?.length ? <div className="cp-snapshot-change__inline" aria-label={`${change.label} 인라인 변경 비교`}><small>인라인 비교</small><p>{change.textSegments.map((segment, index) => segment.kind === 'added' ? <ins key={`${change.id}-segment-${index}`}>{segment.text}</ins> : segment.kind === 'removed' ? <del key={`${change.id}-segment-${index}`}>{segment.text}</del> : <span key={`${change.id}-segment-${index}`}>{segment.text}</span>)}</p></div> : null}
              {change.changedParts?.length ? <div className="cp-snapshot-change__parts" aria-label="변경된 세부 항목">{change.changedParts.map((part) => <span key={part}>{annotationPartLabel[part] || part}</span>)}</div> : null}
              {change.details?.length ? <ul className="cp-snapshot-change__details">{change.details.map((detail) => <li key={detail}>{detail}</li>)}</ul> : null}
              {change.valueTruncated && <small className="cp-snapshot-change__truncated">긴 값은 안전한 표시 한도까지만 보이며 전체 변경은 불변 스냅샷 해시로 검증됩니다.</small>}
            </li>)}
          </ol> : <p className="cp-snapshot-compare__empty">선택한 유형의 변경사항이 없습니다.</p>}
          {changePageCount > 1 && <nav className="cp-snapshot-compare__pagination" aria-label="변경사항 페이지 이동"><button type="button" disabled={visibleChangePage === 0} onClick={() => setChangePage((page) => Math.max(0, page - 1))}>이전 변경</button><span>{visibleChangePage + 1} / {changePageCount} 페이지 · {filteredChanges.length}건</span><button type="button" disabled={visibleChangePage >= changePageCount - 1} onClick={() => setChangePage((page) => Math.min(changePageCount - 1, page + 1))}>다음 변경</button></nav>}
        </> : <p className="cp-snapshot-compare__empty">기준 패키지 이후 확인된 구조·도면 변경사항이 없습니다.</p>}
      </div> : <div className="cp-review-empty cp-review-empty--compact"><GitCompareArrows size={21} /><strong>비교할 검토 패키지가 없습니다</strong><p>검토 요청 시 고정된 패키지와 이전 제출본 또는 직전 발행본을 비교합니다.</p></div>}
    </section>
  );
}

export default ConstructionPlanReviewWorkspacePanel;
