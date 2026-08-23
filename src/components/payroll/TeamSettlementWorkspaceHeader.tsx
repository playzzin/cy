import React from 'react';

export type TeamSettlementSaveState = 'idle' | 'saving' | 'error';

type TeamSettlementWorkspaceHeaderProps = {
  teamName: string;
  year: number;
  month: number;
  confirmedAt: string | null;
  updatedAt: string | null;
  isDirty: boolean;
  issueCount: number;
  saveState: TeamSettlementSaveState;
  loading: boolean;
  canEdit: boolean;
  canRecalculate: boolean;
  onRefresh: () => void;
  onRecalculate: () => void;
  onSave: () => void;
  onConfirm: () => void;
  onUnconfirm: () => void;
};

const formatTimestamp = (value: string | null): string => {
  if (!value) return '기록 없음';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const baseButtonClassName =
  'inline-flex min-h-10 items-center justify-center rounded-lg px-4 py-2 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45';

export const TeamSettlementWorkspaceHeader: React.FC<TeamSettlementWorkspaceHeaderProps> = ({
  teamName,
  year,
  month,
  confirmedAt,
  updatedAt,
  isDirty,
  issueCount,
  saveState,
  loading,
  canEdit,
  canRecalculate,
  onRefresh,
  onRecalculate,
  onSave,
  onConfirm,
  onUnconfirm
}) => {
  const isSaving = saveState === 'saving';

  return (
    <>
      <header className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-black tracking-tight text-slate-950 sm:text-2xl">팀정산 관리</h1>
            <p className="mt-1 text-sm text-slate-600">원천 검증부터 수기 조정, 최종 확정까지 한 흐름으로 처리합니다.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            {isDirty ? (
              <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-amber-800">변경사항 있음</span>
            ) : (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-700">변경 없음</span>
            )}
            {issueCount > 0 && (
              <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-rose-700">검토 필요 {issueCount}건</span>
            )}
            {saveState === 'error' && (
              <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-rose-700">저장 실패</span>
            )}
            <span className="text-slate-500">최근 반영 {formatTimestamp(updatedAt)}</span>
          </div>
        </div>
      </header>

      <section
        className="team-settlement-page__workspace-bar sticky top-[60px] z-30 mt-3 flex flex-col gap-3 rounded-2xl border p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between"
        aria-label="정산 상태와 실행 작업"
      >
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="font-semibold text-slate-500">현재 정산</span>
          <strong className="team-settlement-page__current-team inline-flex max-w-full items-center truncate rounded-lg border px-3 py-1 text-base font-black shadow-sm">
            {teamName || '팀 선택'}
          </strong>
          <span className="text-slate-300">·</span>
          <span className="font-semibold text-slate-700">{year}년 {month}월</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${confirmedAt ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>
            {confirmedAt ? '확정' : '미확정'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
          <button
            type="button"
            className={`${baseButtonClassName} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}
            onClick={onRefresh}
            disabled={loading || isSaving}
          >
            새로고침
          </button>
          <button
            type="button"
            className={`${baseButtonClassName} border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100`}
            onClick={onRecalculate}
            disabled={!canRecalculate || loading || isSaving}
          >
            재집계
          </button>
          <button
            type="button"
            className={`${baseButtonClassName} bg-blue-600 text-white hover:bg-blue-700`}
            onClick={onSave}
            disabled={!canEdit || !isDirty || loading || isSaving}
          >
            {isSaving ? '저장 중…' : isDirty ? '변경사항 저장' : '변경사항 없음'}
          </button>
          {confirmedAt ? (
            <button
              type="button"
              className={`${baseButtonClassName} bg-rose-600 text-white hover:bg-rose-700`}
              onClick={onUnconfirm}
              disabled={loading || isSaving}
            >
              확정 취소
            </button>
          ) : (
            <button
              type="button"
              className={`${baseButtonClassName} bg-emerald-600 text-white hover:bg-emerald-700`}
              onClick={onConfirm}
              disabled={!canEdit || loading || isSaving}
            >
              저장 후 확정
            </button>
          )}
        </div>
      </section>
    </>
  );
};
