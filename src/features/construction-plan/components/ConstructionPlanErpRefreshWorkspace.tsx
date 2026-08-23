import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { ConstructionPlan, ConstructionPlanErpSnapshot } from '../types';
import {
  applyConstructionPlanErpSnapshotFieldsServer,
  getConstructionPlanErpRefreshErrorMessage,
  getConstructionPlanLatestErpSnapshotServer,
  resolveConstructionPlanErpRefreshApplyAttempt,
  type ConstructionPlanErpRefreshApplyAttempt,
  type ConstructionPlanOrganizationRefreshComparison,
  type ConstructionPlanOrganizationRefreshSelection,
} from '../services/constructionPlanErpRefreshService';
import ConstructionPlanErpRefreshPanel from './ConstructionPlanErpRefreshPanel';
import ConstructionPlanOrganizationRefreshPanel from './ConstructionPlanOrganizationRefreshPanel';

type ConstructionPlanErpRefreshWorkspaceProps = {
  plan: ConstructionPlan;
  readOnly?: boolean;
  /** Flushes queued edits and returns the canonical plan/version to mutate. */
  onPrepareApply: () => Promise<ConstructionPlan | undefined>;
  /** Replaces both React state and the editor's authoritative plan ref. */
  onPlanApplied: (plan: ConstructionPlan) => void;
};

type ComparisonState = {
  current?: ConstructionPlanErpSnapshot;
  latest?: ConstructionPlanErpSnapshot;
  organizationComparison?: ConstructionPlanOrganizationRefreshComparison;
  loading: boolean;
  applying: boolean;
  error?: string;
  success?: string;
};

const initialState = (plan: ConstructionPlan): ComparisonState => ({
  current: plan.erpSnapshot,
  loading: false,
  applying: false,
});

export function ConstructionPlanErpRefreshWorkspace({
  plan,
  readOnly = false,
  onPrepareApply,
  onPlanApplied,
}: ConstructionPlanErpRefreshWorkspaceProps) {
  const [state, setState] = useState<ComparisonState>(() => initialState(plan));
  const activeRequestRef = useRef(0);
  const applyAttemptRef = useRef<ConstructionPlanErpRefreshApplyAttempt>();
  const applyRunningRef = useRef(false);

  useEffect(() => {
    activeRequestRef.current += 1;
    applyAttemptRef.current = undefined;
    setState(initialState(plan));
  }, [plan.id]);

  useEffect(() => () => { activeRequestRef.current += 1; }, []);

  const refresh = useCallback(async (preserveSuccess = false): Promise<boolean> => {
    const requestId = activeRequestRef.current + 1;
    activeRequestRef.current = requestId;
    applyAttemptRef.current = undefined;
    setState((current) => ({
      ...current,
      loading: true,
      error: undefined,
      ...(preserveSuccess ? {} : { success: undefined }),
    }));
    try {
      const comparison = await getConstructionPlanLatestErpSnapshotServer(plan.id);
      if (activeRequestRef.current !== requestId) return false;
      if (!comparison.current) {
        setState((current) => ({
          ...current,
          current: plan.erpSnapshot,
          latest: undefined,
          loading: false,
          error: '현재 계획서에 검증 가능한 ERP 출처 스냅샷이 없어 자동 반영하지 않습니다. 문서를 다시 생성하거나 관리자에게 데이터 복구를 요청하세요.',
        }));
        return false;
      }
      setState((current) => ({
        ...current,
        current: comparison.current,
        latest: comparison.latest,
        organizationComparison: comparison.organizationComparison,
        loading: false,
        error: undefined,
      }));
      return true;
    } catch (error) {
      if (activeRequestRef.current !== requestId) return false;
      setState((current) => ({
        ...current,
        loading: false,
        error: getConstructionPlanErpRefreshErrorMessage(error),
      }));
      return false;
    }
  }, [plan.erpSnapshot, plan.id]);

  const apply = useCallback(async (
    fieldIds: string[],
    reason: string,
    organizationSelection?: ConstructionPlanOrganizationRefreshSelection,
  ): Promise<void> => {
    if (readOnly || state.applying || applyRunningRef.current) return;
    const applyContextId = activeRequestRef.current;
    applyRunningRef.current = true;
    setState((current) => ({ ...current, applying: true, error: undefined, success: undefined }));
    try {
      const preparedPlan = await onPrepareApply();
      if (activeRequestRef.current !== applyContextId) return;
      if (!preparedPlan || preparedPlan.id !== plan.id) {
        throw new Error('construction-plan-erp-refresh-save-required');
      }
      const attempt = resolveConstructionPlanErpRefreshApplyAttempt({
        planId: preparedPlan.id,
        currentLockVersion: preparedPlan.lockVersion,
        fieldIds,
        reason,
        organizationSelection,
      }, applyAttemptRef.current);
      applyAttemptRef.current = attempt;
      const response = await applyConstructionPlanErpSnapshotFieldsServer(attempt);
      if (activeRequestRef.current !== applyContextId) return;
      applyAttemptRef.current = undefined;
      onPlanApplied(response.plan);
      setState((current) => ({
        ...current,
        current: response.plan.erpSnapshot ?? current.current,
        applying: false,
        error: undefined,
        success: `${response.appliedFieldIds.length + response.appliedOrganizationChangeIds.length}개 ERP·조직 변경을 서버 권위 문서에 반영했습니다.`,
      }));
      await refresh(true);
    } catch (error) {
      if (activeRequestRef.current !== applyContextId) return;
      const saveRequired = error instanceof Error
        && error.message === 'construction-plan-erp-refresh-save-required';
      setState((current) => ({
        ...current,
        applying: false,
        error: saveRequired
          ? '저장되지 않은 변경이 있어 ERP 원천을 반영하지 않았습니다. 저장 상태와 편집 잠금을 확인하세요.'
          : getConstructionPlanErpRefreshErrorMessage(error),
      }));
    } finally {
      applyRunningRef.current = false;
    }
  }, [onPlanApplied, onPrepareApply, plan.id, readOnly, refresh, state.applying]);

  const current = state.current ?? plan.erpSnapshot;
  if (!current) {
    return (
      <section className="cp-erp-refresh" aria-label="ERP 원천 변경 비교">
        <div className="cp-erp-refresh__error" role="alert">
          현재 계획서에 ERP 출처 스냅샷이 없어 원천 변경을 자동 비교·반영할 수 없습니다.
        </div>
      </section>
    );
  }

  return (
    <>
      <ConstructionPlanErpRefreshPanel
        current={current}
        latest={state.latest}
        loading={state.loading}
        applying={state.applying}
        readOnly={readOnly}
        error={state.error}
        success={state.success}
        hasOrganizationChanges={state.organizationComparison?.changed === true}
        onRefresh={async () => { await refresh(false); }}
        onApply={(fieldIds, reason) => apply(fieldIds, reason)}
      />
      {state.organizationComparison && (
        <ConstructionPlanOrganizationRefreshPanel
          comparison={state.organizationComparison}
          applying={state.applying}
          readOnly={readOnly}
          onApply={(selection, reason) => apply([], reason, selection)}
        />
      )}
    </>
  );
}

export default ConstructionPlanErpRefreshWorkspace;
