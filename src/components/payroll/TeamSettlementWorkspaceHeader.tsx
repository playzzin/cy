import React from 'react';
import MonthNavigator from '../common/MonthNavigator';
import { useTeamMobile } from '../team-mobile/TeamMobileUI';

export type TeamSettlementSaveState = 'idle' | 'saving' | 'error';

type TeamSettlementWorkspaceHeaderProps = {
  teamName: string;
  year: number;
  month: number;
  confirmedAt: string | null;
  confirmationState?: 'loading' | 'unavailable';
  updatedAt: string | null;
  isDirty: boolean;
  issueCount: number;
  saveState: TeamSettlementSaveState;
  loading: boolean;
  canWrite: boolean;
  canEdit: boolean;
  canRecalculate: boolean;
  onRefresh: () => void;
  onRecalculate: () => void;
  onSave: () => void;
  onConfirm: () => void;
  onUnconfirm: () => void;
  onMonthChange?: (month: string) => void;
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
  confirmationState,
  updatedAt,
  isDirty,
  issueCount,
  saveState,
  loading,
  canWrite,
  canEdit,
  canRecalculate,
  onRefresh,
  onRecalculate,
  onSave,
  onConfirm,
  onUnconfirm,
  onMonthChange
}) => {
  const isSaving = saveState === 'saving';
  const mobile = useTeamMobile();
  const compactMonthBar = mobile && Boolean(onMonthChange);
  const currentTeam = teamName || '팀 선택';
  const confirmationLabel = confirmationState === 'loading' ? '조회 중'
    : confirmationState === 'unavailable' ? '미조회' : confirmedAt ? '확정' : '미확정';
  const confirmationColors = confirmationState ? 'bg-slate-100 text-slate-600'
    : confirmedAt ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800';
  const confirmationBadge = (
    <span className={`team-settlement-page__confirmation rounded-full px-2 py-0.5 text-xs font-bold ${confirmationColors}`} aria-live="polite">
      {confirmationLabel}
    </span>
  );
  const monthNavigator = onMonthChange && <MonthNavigator value={`${year}-${String(month).padStart(2, '0')}`}
    onChange={onMonthChange} disabled={isSaving} ariaLabel="정산 조회월"
    caption={compactMonthBar && (
      <div className="team-settlement-page__mobile-context">
        <strong title={currentTeam}>{currentTeam}</strong>
        {confirmationBadge}
      </div>
    )} />;

  return (
    <>
      <header className="team-settlement-page__heading">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="team-settlement-page__heading-title">
              <span className="team-settlement-page__heading-label">팀정산 관리</span>
              <h1>{year}년 {month}월{teamName && teamName !== '팀 선택' ? ` ${teamName}` : ''}</h1>
            </div>
            {!canWrite && <p className="team-settlement-page__read-only mt-2 text-sm text-amber-800" role="status">팀 정산 조회 화면입니다. 수정·확정이 필요하면 사무실에 요청해 주세요.</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            {canWrite && (isDirty ? (
              <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-amber-800">변경사항 있음</span>
            ) : (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-700">변경 없음</span>
            ))}
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

      {compactMonthBar && <div className="team-settlement-page__mobile-month">{monthNavigator}</div>}
      <section
        className={`team-settlement-page__workspace-bar ${compactMonthBar ? 'team-settlement-page__workspace-bar--compact' : 'sticky top-[60px]'} z-30 mt-3 flex flex-col gap-3 rounded-2xl border p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between`}
        aria-label="정산 상태와 실행 작업"
      >
        {!compactMonthBar && <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="font-semibold text-slate-500">현재 정산</span>
          <strong className="team-settlement-page__current-team inline-flex max-w-full items-center truncate rounded-lg border px-3 py-1 text-base font-black shadow-sm">
            {currentTeam}
          </strong>
          <span className="text-slate-300">·</span>
          {monthNavigator ? <div className="team-settlement-page__sticky-month">{monthNavigator}</div>
            : <span className="font-semibold text-slate-700">{year}년 {month}월</span>}
          {confirmationBadge}
        </div>}

        <div className="team-settlement-page__workspace-actions grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
          <button
            type="button"
            className={`${baseButtonClassName} team-settlement-page__refresh border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}
            onClick={onRefresh}
            disabled={loading || isSaving}
          >
            새로고침
          </button>
          {canWrite && <>
          <button
            type="button"
            className={`${baseButtonClassName} border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100`}
            onClick={onRecalculate}
            disabled={!canWrite || !canRecalculate || loading || isSaving}
          >
            재집계
          </button>
          <button
            type="button"
            className={`${baseButtonClassName} bg-blue-600 text-white hover:bg-blue-700`}
            onClick={onSave}
            disabled={!canWrite || !canEdit || !isDirty || loading || isSaving}
          >
            {isSaving ? '저장 중…' : isDirty ? '변경사항 저장' : '변경사항 없음'}
          </button>
          {confirmedAt ? (
            <button
              type="button"
              className={`${baseButtonClassName} bg-rose-600 text-white hover:bg-rose-700`}
              onClick={onUnconfirm}
              disabled={!canWrite || loading || isSaving}
            >
              확정 취소
            </button>
          ) : (
            <button
              type="button"
              className={`${baseButtonClassName} bg-emerald-600 text-white hover:bg-emerald-700`}
              onClick={onConfirm}
              disabled={!canWrite || !canEdit || loading || isSaving}
            >
              저장 후 확정
            </button>
          )}
          </>}
        </div>
      </section>
    </>
  );
};
