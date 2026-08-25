import React from 'react';
import {
  Check,
  Copy,
  Download,
  FileCheck2,
  FileClock,
  FilePlus2,
  FileSpreadsheet,
  Loader2,
  MessageSquareWarning,
  Send,
  ShieldCheck,
} from 'lucide-react';
import type { PlanStatus } from '../types';

export type ConstructionPlanWorkflowProgress = {
  label: string;
  percent?: number;
};

type ConstructionPlanWorkflowActionsProps = {
  status: PlanStatus;
  blockingErrorCount: number;
  busy?: ConstructionPlanWorkflowProgress;
  actionDisabled?: boolean;
  issuedDownloadAvailable?: boolean;
  onDraftPdf: () => void;
  onRequestReview: () => void;
  onCompleteReview: () => void;
  onOpenRequestChanges: () => void;
  onApprove: () => void;
  onIssue: () => void;
  onDownloadIssued: () => void;
  onExcelDownload?: () => void;
  activeRevision?: { id: string; revision: number; status: PlanStatus };
  onOpenActiveRevision?: () => void;
  onCreateRevision?: () => void;
  onClone?: () => void;
};

const workflowSteps = [
  { key: 'author', label: '작성' },
  { key: 'review', label: '검토' },
  { key: 'approval', label: '승인' },
  { key: 'issue', label: '발행' },
] as const;

const statusStep: Partial<Record<PlanStatus, number>> = {
  draft: 0,
  changes_requested: 0,
  in_review: 1,
  review_completed: 2,
  approved_pending_issue: 3,
  issued: 4,
  superseded: 4,
  archived: 4,
};

const statusMessage: Partial<Record<PlanStatus, string>> = {
  draft: '필수 데이터와 승인도면을 확인한 뒤 검토를 요청하세요.',
  changes_requested: '변경 요청사항을 반영한 뒤 다시 검토를 요청하세요.',
  in_review: '본사 또는 관리자가 검토 완료 처리를 할 수 있습니다.',
  review_completed: '검토 스냅샷을 기준으로 최종 승인합니다.',
  approved_pending_issue: '논리 42쪽을 실제 42~200쪽 A4로 구성·검증한 뒤 불변 경로에 발행합니다.',
  issued: '서버가 해시를 확인한 현장사용 발행본입니다.',
  superseded: '새 개정본으로 대체된 발행본입니다.',
  archived: '보관 처리된 문서입니다.',
  void: '무효 처리된 문서입니다.',
};

export const isConstructionPlanChangeRequestAvailable = (status: PlanStatus): boolean => (
  status === 'in_review' || status === 'review_completed'
);

export function ConstructionPlanWorkflowActions({
  status,
  blockingErrorCount,
  busy,
  actionDisabled = false,
  issuedDownloadAvailable = false,
  onDraftPdf,
  onRequestReview,
  onCompleteReview,
  onOpenRequestChanges,
  onApprove,
  onIssue,
  onDownloadIssued,
  onExcelDownload,
  activeRevision,
  onOpenActiveRevision,
  onCreateRevision,
  onClone,
}: ConstructionPlanWorkflowActionsProps) {
  const currentStep = statusStep[status] ?? 0;
  const isBusy = Boolean(busy);
  const disabled = actionDisabled || isBusy;

  const primary = status === 'draft' || status === 'changes_requested'
    ? { label: '검토 요청', icon: Send, onClick: onRequestReview, disabled: disabled || blockingErrorCount > 0 }
    : status === 'in_review'
      ? { label: '검토 완료', icon: FileCheck2, onClick: onCompleteReview, disabled }
      : status === 'review_completed'
        ? { label: '최종 승인', icon: ShieldCheck, onClick: onApprove, disabled }
        : status === 'approved_pending_issue'
          ? { label: '현장사용 PDF 발행', icon: FileCheck2, onClick: onIssue, disabled }
          : status === 'issued' || status === 'superseded' || status === 'archived'
            ? { label: '발행 PDF 다운로드', icon: Download, onClick: onDownloadIssued, disabled: disabled || !issuedDownloadAvailable }
            : undefined;
  const PrimaryIcon = primary?.icon;
  const percent = busy?.percent === undefined
    ? undefined
    : Math.max(0, Math.min(100, Math.round(busy.percent)));

  return (
    <section className="cp-workflow" aria-label="검토 승인 및 발행">
      <div className="cp-workflow__timeline" aria-label="문서 진행 단계">
        {workflowSteps.map((step, index) => {
          const completed = currentStep > index;
          const active = currentStep === index;
          return (
            <React.Fragment key={step.key}>
              {index > 0 && <span className={`cp-workflow__connector${completed || active ? ' is-active' : ''}`} />}
              <span className={`cp-workflow__step${completed ? ' is-complete' : ''}${active ? ' is-active' : ''}`}>
                <i>{completed ? <Check size={11} /> : index + 1}</i>
                <b>{step.label}</b>
              </span>
            </React.Fragment>
          );
        })}
      </div>

      <div className="cp-workflow__message">
        <strong>{statusMessage[status] ?? '문서 상태를 확인해주세요.'}</strong>
        <span>
          {blockingErrorCount > 0
            ? `검토 전 해결할 오류 ${blockingErrorCount}건`
            : '작성·검토·승인 권한은 서버에서 다시 확인합니다.'}
        </span>
      </div>

      {busy && (
        <div className="cp-workflow__progress" role="status" aria-live="polite">
          <span><Loader2 size={14} className="cp-spin" />{busy.label}</span>
          {percent !== undefined && <><progress max="100" value={percent} /><b>{percent}%</b></>}
        </div>
      )}

      <div className="cp-workflow__actions">
        {onExcelDownload && (
          <button type="button" className="cp-button cp-button--ghost cp-button--small" disabled={isBusy} onClick={onExcelDownload}>
            <FileSpreadsheet size={14} /> Excel 다운로드
          </button>
        )}
        {!['issued', 'superseded', 'archived', 'void'].includes(status) && (
          <button type="button" className="cp-button cp-button--ghost cp-button--small" disabled={isBusy} onClick={onDraftPdf}>
            <Download size={14} /> DRAFT PDF
          </button>
        )}
        {onClone && (
          <button type="button" className="cp-button cp-button--ghost cp-button--small" disabled={isBusy} onClick={onClone}>
            <Copy size={14} /> 복제
          </button>
        )}
        {status === 'issued' && activeRevision && (
          <button type="button" className="cp-button cp-button--secondary cp-button--small" disabled={disabled || !onOpenActiveRevision} onClick={onOpenActiveRevision}>
            <FileClock size={14} /> 진행 중 REV.{String(activeRevision.revision).padStart(2, '0')} 열기
          </button>
        )}
        {status === 'issued' && !activeRevision && onCreateRevision && (
          <button type="button" className="cp-button cp-button--secondary cp-button--small" disabled={disabled} onClick={onCreateRevision}>
            <FilePlus2 size={14} /> 개정본 만들기
          </button>
        )}
        {isConstructionPlanChangeRequestAvailable(status) && (
          <button type="button" className="cp-button cp-button--secondary cp-button--small" disabled={disabled} onClick={onOpenRequestChanges}>
            <MessageSquareWarning size={14} /> 수정 요청
          </button>
        )}
        {primary && PrimaryIcon && (
          <button type="button" className="cp-button cp-button--primary cp-button--small" disabled={primary.disabled} onClick={primary.onClick}>
            <PrimaryIcon size={14} /> {primary.label}
            {(status === 'draft' || status === 'changes_requested') && blockingErrorCount > 0 && <em>{blockingErrorCount}</em>}
          </button>
        )}
      </div>
    </section>
  );
}

export default ConstructionPlanWorkflowActions;
