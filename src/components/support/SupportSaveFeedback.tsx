import React from 'react';

export type SupportSaveFeedbackStatus = 'success' | 'warning' | 'error';

export interface SupportSaveFeedbackState {
  status: SupportSaveFeedbackStatus;
  title: string;
  message: string;
  operationId?: string;
}

interface SupportSaveFeedbackProps {
  feedback: SupportSaveFeedbackState;
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
  retryDisabled = false,
  onRetry,
  onDismiss
}: SupportSaveFeedbackProps) => (
  <div
    role={feedback.status === 'error' ? 'alert' : 'status'}
    aria-live="polite"
    className={`flex flex-col gap-3 rounded-lg border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between ${toneClass[feedback.status]}`}
  >
    <div className="min-w-0">
      <div className="font-black">{feedback.title}</div>
      <div className="mt-0.5 font-medium">{feedback.message}</div>
      {feedback.operationId && (
        <div className="mt-1 font-mono text-[11px] opacity-70">
          작업 ID: {feedback.operationId}
        </div>
      )}
    </div>
    <div className="flex shrink-0 items-center gap-2">
      {onRetry && (
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

export default SupportSaveFeedback;
