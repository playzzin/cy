import React, { useEffect, useMemo, useState } from 'react';
import type {
  ConstructionPlanOrganizationRefreshComparison,
  ConstructionPlanOrganizationRefreshSelection,
} from '../services/constructionPlanErpRefreshService';
import './ConstructionPlanOrganizationRefreshPanel.css';

type ConstructionPlanOrganizationRefreshPanelProps = {
  comparison: ConstructionPlanOrganizationRefreshComparison;
  applying?: boolean;
  readOnly?: boolean;
  onApply: (
    selection: ConstructionPlanOrganizationRefreshSelection,
    reason: string,
  ) => void | Promise<void>;
};

const kindLabel = {
  new: '신규 작업자',
  inactive: '비활성 작업자',
  missing: '원천에서 삭제·범위 이탈',
  team_changed: '소속팀 변경',
  profile_changed: '직책·역할 정보 변경',
} as const;

const issueLabel = {
  inactive: '현재 배정 작업자가 비활성 상태입니다.',
  missing: '현재 배정 작업자를 최신 현장·담당팀 명부에서 찾을 수 없습니다.',
  unassigned_required: '필수 역할에 작업자가 배정되지 않았습니다.',
} as const;

const workerDetail = (worker?: ConstructionPlanOrganizationRefreshComparison['latestWorkers'][number]): string => {
  if (!worker) return '작업자 정보 없음';
  return [worker.name, worker.position, worker.role, worker.teamName, worker.status]
    .filter(Boolean).join(' · ');
};

export function ConstructionPlanOrganizationRefreshPanel({
  comparison,
  applying = false,
  readOnly = false,
  onApply,
}: ConstructionPlanOrganizationRefreshPanelProps) {
  const [refreshAssignedWorkers, setRefreshAssignedWorkers] = useState(false);
  const [refreshAdditionalWorkers, setRefreshAdditionalWorkers] = useState(false);
  const [reassignments, setReassignments] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');
  const comparisonKey = useMemo(() => JSON.stringify({
    capturedAt: comparison.current.capturedAt,
    workers: comparison.latestWorkers.map((worker) => [worker.id, worker.status, worker.teamId]),
    issues: comparison.assignmentIssues.map((issue) => [issue.assignmentId, issue.kind]),
  }), [comparison]);

  useEffect(() => {
    // A new server comparison is a new user decision. Never carry selections
    // forward or silently opt the user into overwriting organization data.
    setRefreshAssignedWorkers(false);
    setRefreshAdditionalWorkers(false);
    setReassignments({});
    setReason('');
  }, [comparisonKey]);

  const activeCandidates = comparison.latestWorkers.filter((worker) => worker.status === 'active');
  const assignedRefreshAvailable = comparison.changes.some((change) => (
    change.assignmentIds.length > 0
    && change.after?.status === 'active'
    && (change.kind === 'team_changed' || change.kind === 'profile_changed')
  ));
  const selectedReassignments = Object.entries(reassignments)
    .filter(([, workerId]) => Boolean(workerId))
    .map(([assignmentId, workerId]) => ({ assignmentId, workerId }));
  const selectedCount = Number(refreshAssignedWorkers)
    + Number(refreshAdditionalWorkers)
    + selectedReassignments.length;

  const submit = async () => {
    if (selectedCount === 0 || reason.trim().length < 5) return;
    await onApply({
      refreshAssignedWorkers,
      refreshAdditionalWorkers,
      reassignments: selectedReassignments,
    }, reason.trim());
  };

  return (
    <section className="cp-organization-refresh" aria-label="조직·작업자 원천 변경 비교">
      <header className="cp-organization-refresh__heading">
        <div>
          <strong>담당팀·작업자 변경 확인</strong>
          <p>작업자 원천은 연락처·사진·급여정보를 제외한 현장·담당팀 명부만 사용합니다.</p>
        </div>
        <span>{comparison.changes.length}건 변경 · 배정 경고 {comparison.assignmentIssues.length}건</span>
      </header>

      {!comparison.changed && (
        <div className="cp-organization-refresh__empty" role="status">
          현재 조직도와 안전 작업자 명부가 일치합니다.
        </div>
      )}

      {comparison.changes.length > 0 && (
        <div className="cp-organization-refresh__changes">
          {comparison.changes.map((change) => (
            <article key={change.id} className={`is-${change.kind}`}>
              <strong>{kindLabel[change.kind]}</strong>
              <span>{workerDetail(change.after ?? change.before)}</span>
              {change.kind === 'team_changed' && (
                <small>{change.before?.teamName || '미등록'} → {change.after?.teamName || '미등록'}</small>
              )}
              {change.assignmentIds.length > 0 && <small>배정 역할 {change.assignmentIds.length}건 영향</small>}
            </article>
          ))}
        </div>
      )}

      {comparison.assignmentIssues.length > 0 && (
        <div className="cp-organization-refresh__issues" role="group" aria-label="작업자 재배정 필요 항목">
          <strong>명시적 재배정 필요</strong>
          <p>비활성·삭제된 배정은 자동으로 지우지 않습니다. 대체 작업자를 직접 선택해야 변경됩니다.</p>
          {comparison.assignmentIssues.map((issue) => (
            <label key={`${issue.assignmentId}-${issue.kind}`}>
              <span>
                <b>{issue.role}</b>
                <small>{issueLabel[issue.kind]} {issue.worker && `현재: ${workerDetail(issue.worker)}`}</small>
              </span>
              <select
                aria-label={`${issue.role} 대체 작업자`}
                value={reassignments[issue.assignmentId] ?? ''}
                disabled={readOnly || applying}
                onChange={(event) => setReassignments((current) => ({
                  ...current,
                  [issue.assignmentId]: event.target.value,
                }))}
              >
                <option value="">현재 배정 유지</option>
                {activeCandidates.map((worker) => (
                  <option key={worker.id} value={worker.id}>{workerDetail(worker)}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}

      {comparison.changed && (
        <div className="cp-organization-refresh__choices">
          <label>
            <input
              type="checkbox"
              checked={refreshAssignedWorkers}
              disabled={readOnly || applying || !assignedRefreshAvailable}
              onChange={(event) => setRefreshAssignedWorkers(event.target.checked)}
            />
            <span>
              <b>유효한 역할 배정 정보 갱신</b>
              <small>작업자 ID와 역할 배정은 유지하고 이름·직책·소속팀의 안전 투영만 최신화합니다.</small>
            </span>
          </label>
          <label>
            <input
              type="checkbox"
              checked={refreshAdditionalWorkers}
              disabled={readOnly || applying || !comparison.additionalWorkersChanged}
              onChange={(event) => setRefreshAdditionalWorkers(event.target.checked)}
            />
            <span>
              <b>추가 작업자 명부 갱신</b>
              <small>활성 작업자 {comparison.suggestedAdditionalWorkers.length}명을 exact safe projection으로 반영합니다.</small>
            </span>
          </label>
        </div>
      )}

      {comparison.changed && (
        <div className="cp-organization-refresh__actions">
          <label>
            조직·작업자 반영 사유 *
            <textarea
              value={reason}
              disabled={readOnly || applying}
              maxLength={500}
              onChange={(event) => setReason(event.target.value)}
              placeholder="선택한 조직·작업자 변경을 반영하는 이유를 5자 이상 기록하세요."
            />
          </label>
          <button
            type="button"
            disabled={readOnly || applying || selectedCount === 0 || reason.trim().length < 5}
            onClick={() => void submit()}
          >
            {applying ? '반영 중…' : `선택 ${selectedCount}건 반영`}
          </button>
        </div>
      )}
    </section>
  );
}

export default ConstructionPlanOrganizationRefreshPanel;
