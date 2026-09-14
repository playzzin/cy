import React, { useEffect, useState } from 'react';
import type { SupportWriteFeedbackOutcome } from '../../types/supportWriteOperation';
import { hasSupportWriteRecordFailure, subscribeSupportWriteRecordFailure } from '../../utils/supportWriteErrorReporting';

export type SupportSaveFeedbackStatus = 'success' | 'warning' | 'error';

export interface SupportSaveFeedbackState {
  outcome?: SupportWriteFeedbackOutcome;
  /** Legacy compatibility only; never overrides an explicit unsafe outcome. */
  preserveExistingRetry?: boolean;
  status: SupportSaveFeedbackStatus;
  title: string;
  message: string;
  operationId?: string;
  /** Optional owner-bound snapshot; callers must bind it to their own original operation. */
  recordFailure?: boolean;
}

interface SupportSaveFeedbackProps {
  feedback: SupportSaveFeedbackState;
  /** Presentation only; the original ID remains bound to record-failure observation. */
  hideOperationId?: boolean;
  /** Opt in only with an owner-bound ID. Original callers keep their existing behavior. */
  observeRecordFailure?: boolean;
  retryDisabled?: boolean;
  onRetry?: () => void;
  onDismiss: () => void;
}

const toneClass: Record<SupportSaveFeedbackStatus, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  error: 'border-rose-200 bg-rose-50 text-rose-900'
};

const buttonClass: Record<SupportSaveFeedbackStatus, string> = {
  success: 'border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-100',
  warning: 'border-amber-200 bg-white text-amber-800 hover:bg-amber-100',
  error: 'border-rose-200 bg-white text-rose-800 hover:bg-rose-100'
};

const SupportSaveFeedback = ({
  feedback,
  hideOperationId = false,
  observeRecordFailure = false,
  retryDisabled = false,
  onRetry,
  onDismiss
}: SupportSaveFeedbackProps) => {
  // Re-render on observation; always read the current owner, never the preceding ID's state.
  const [, setObservationVersion] = useState(0);
  useEffect(() => {
    if (!observeRecordFailure) return undefined;
    const update = () => setObservationVersion(version => version + 1);
    const unsubscribe = subscribeSupportWriteRecordFailure(update);
    update();
    return unsubscribe;
  }, [observeRecordFailure, feedback.operationId]);
  // An explicit false is not proof of success and cannot erase an observed owner failure.
  const currentRecordFailed = feedback.recordFailure === true ||
    (observeRecordFailure && hasSupportWriteRecordFailure(feedback.operationId));
  const labels = { completed: '완료', partial: '부분 완료', blocked: '실행 전 중단', unknown: '결과 미확정', 'refresh-failed': '저장 후 조회 실패', 'record-failed': '작업 기록 실패' };
  // Legacy compatibility never overrides an explicit unsafe/completed outcome.
  const canRetry = !currentRecordFailed && (!feedback.outcome || ['partial', 'blocked'].includes(feedback.outcome));
  return (
  <div
    role={feedback.status === 'error' ? 'alert' : 'status'}
    aria-live="polite"
    className={`flex flex-col gap-3 rounded-lg border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between ${toneClass[feedback.status]}`}
  >
    <div className="min-w-0">
      <div className="font-black">{feedback.title}</div>
      {feedback.outcome && <div>{labels[feedback.outcome]}</div>}
      <div className="mt-0.5 font-medium">{currentRecordFailed || feedback.outcome === 'record-failed' ? '금융 작업은 다시 실행하지 말고 원래 요청의 기록 상태를 별도로 확인해 주세요.' : feedback.message}</div>
      {currentRecordFailed && <div role="alert">작업 기록 실패 · 금융 작업을 다시 실행하지 마세요. 기록 상태만 별도로 확인해 주세요.</div>}
      {!hideOperationId && feedback.operationId && (
        <div className="mt-1 font-mono text-[11px] opacity-70">
          작업 ID: {feedback.operationId}
        </div>
      )}
    </div>
    <div className="flex shrink-0 items-center gap-2">
      {onRetry && canRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={retryDisabled}
          className={`rounded-md border px-3 py-1.5 text-xs font-black disabled:cursor-not-allowed disabled:opacity-50 ${buttonClass[feedback.status]}`}
        >
          다시 저장
        </button>
      )}
      <button
        type="button"
        onClick={onDismiss}
        className={`rounded-md border px-3 py-1.5 text-xs font-black ${buttonClass[feedback.status]}`}
      >
        닫기
      </button>
    </div>
  </div>
  );
};

export default SupportSaveFeedback;
