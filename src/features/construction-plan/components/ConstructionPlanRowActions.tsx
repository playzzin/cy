import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Archive,
  Ban,
  Copy,
  Download,
  ExternalLink,
  FileClock,
  FilePlus2,
  History,
  Loader2,
  MoreHorizontal,
} from 'lucide-react';
import type { ConstructionPlan } from '../types';

export type ConstructionPlanRevisionIdentity = Pick<
  ConstructionPlan,
  'id' | 'seriesId' | 'revision' | 'status'
>;

export function findActiveRevisionSuccessor<T extends ConstructionPlanRevisionIdentity>(
  plans: readonly T[],
  source: ConstructionPlanRevisionIdentity,
): T | undefined {
  if (!source.seriesId) return undefined;
  return plans
    .filter((candidate) => (
      candidate.id !== source.id
      && candidate.seriesId === source.seriesId
      && candidate.revision > source.revision
      && candidate.status !== 'void'
      && candidate.status !== 'archived'
    ))
    .sort((left, right) => right.revision - left.revision)[0];
}

type ConstructionPlanRowActionsProps = {
  plan: ConstructionPlan;
  activeRevision?: ConstructionPlanRevisionIdentity;
  busyAction?: 'revision' | 'clone' | 'download' | 'void' | 'archive';
  onOpen: () => void;
  onOpenActiveRevision?: () => void;
  onCreateRevision: () => void;
  onClone: () => void;
  onDownloadIssued: () => void;
  onOpenHistory: () => void;
  onVoid?: () => void;
  onArchive?: () => void;
};

export function ConstructionPlanRowActions({
  plan,
  activeRevision,
  busyAction,
  onOpen,
  onOpenActiveRevision,
  onCreateRevision,
  onClone,
  onDownloadIssued,
  onOpenHistory,
  onVoid,
  onArchive,
}: ConstructionPlanRowActionsProps) {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstItemRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const busy = Boolean(busyAction);
  const canDownloadIssued = Boolean(
    plan.issuedExportStoragePath
      && ['issued', 'superseded', 'archived'].includes(plan.status),
  );

  useEffect(() => {
    if (!open) return undefined;
    const triggerBox = triggerRef.current?.getBoundingClientRect();
    if (triggerBox) {
      const menuWidth = 238;
      const estimatedMenuHeight = 260;
      const openUp = triggerBox.bottom + estimatedMenuHeight > window.innerHeight;
      setMenuPosition({
        top: Math.max(8, openUp ? triggerBox.top - estimatedMenuHeight - 6 : triggerBox.bottom + 6),
        left: Math.max(8, Math.min(window.innerWidth - menuWidth - 8, triggerBox.right - menuWidth)),
      });
    }
    const focusTimer = window.setTimeout(() => firstItemRef.current?.focus(), 0);
    const closeOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    };
    const closeOnViewportChange = () => setOpen(false);
    document.addEventListener('mousedown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    window.addEventListener('resize', closeOnViewportChange);
    window.addEventListener('scroll', closeOnViewportChange, true);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('mousedown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('resize', closeOnViewportChange);
      window.removeEventListener('scroll', closeOnViewportChange, true);
    };
  }, [open]);

  const run = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <div
      ref={rootRef}
      className="cp-row-actions"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <button
        ref={triggerRef}
        type="button"
        className="cp-table-menu-trigger"
        aria-label={`${plan.title} 작업 메뉴`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        disabled={busy}
        onClick={() => setOpen((value) => !value)}
      >
        {busy ? <Loader2 size={16} className="cp-spin" /> : <MoreHorizontal size={17} />}
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div ref={menuRef} id={menuId} className="cp-row-actions__menu" role="menu" aria-label={`${plan.title} 문서 작업`} style={menuPosition}>
          <button ref={firstItemRef} type="button" role="menuitem" onClick={() => run(onOpen)}><ExternalLink size={15} /><span><strong>열기</strong><small>계획서 내용 확인</small></span></button>
          {plan.status === 'issued' && (activeRevision ? (
            <button type="button" role="menuitem" disabled={!onOpenActiveRevision} onClick={() => onOpenActiveRevision && run(onOpenActiveRevision)}>
              <FileClock size={15} /><span><strong>진행 중 개정본 열기</strong><small>REV.{String(activeRevision.revision).padStart(2, '0')} 작성 계속</small></span>
            </button>
          ) : (
            <button type="button" role="menuitem" onClick={() => run(onCreateRevision)}><FilePlus2 size={15} /><span><strong>개정본 만들기</strong><small>다음 Rev. 초안 생성</small></span></button>
          ))}
          <button type="button" role="menuitem" onClick={() => run(onClone)}><Copy size={15} /><span><strong>복제</strong><small>독립 REV.00 초안</small></span></button>
          {canDownloadIssued && <button type="button" role="menuitem" onClick={() => run(onDownloadIssued)}><Download size={15} /><span><strong>발행 PDF 다운로드</strong><small>이 Rev.의 불변 발행본</small></span></button>}
          <button type="button" role="menuitem" onClick={() => run(onOpenHistory)}><History size={15} /><span><strong>이력</strong><small>개정 계보와 감사 이벤트</small></span></button>
          {onArchive && ['draft', 'changes_requested', 'issued', 'superseded', 'void'].includes(plan.status) && <button type="button" role="menuitem" onClick={() => run(onArchive)}><Archive size={15} /><span><strong>보관</strong><small>이력과 발행본을 유지한 상태 전환</small></span></button>}
          {onVoid && ['draft', 'in_review', 'changes_requested', 'review_completed', 'approved_pending_issue'].includes(plan.status) && <button type="button" role="menuitem" onClick={() => run(onVoid)}><Ban size={15} /><span><strong>폐기</strong><small>삭제 없이 폐기 상태로 전환</small></span></button>}
          {plan.status === 'superseded' && <div className="cp-row-actions__note"><FileClock size={13} /> 최신 Rev.로 대체된 과거 발행본입니다.</div>}
        </div>,
        document.body,
      )}
    </div>
  );
}

export default ConstructionPlanRowActions;
