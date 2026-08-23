import React, { useEffect, useMemo, useState } from 'react';
import type { ConstructionPlanErpSnapshot } from '../types';
import { diffConstructionPlanErpSnapshots } from '../domain/erpSnapshotDiff';
import './ConstructionPlanErpRefreshPanel.css';

type ConstructionPlanErpRefreshPanelProps = {
  current: ConstructionPlanErpSnapshot;
  latest?: ConstructionPlanErpSnapshot;
  loading?: boolean;
  applying?: boolean;
  readOnly?: boolean;
  error?: string;
  success?: string;
  hasOrganizationChanges?: boolean;
  onRefresh: () => void | Promise<void>;
  onApply: (fieldIds: string[], reason: string) => void | Promise<void>;
};

const displayValue = (value?: string | string[]): string => {
  if (Array.isArray(value)) return value.length ? value.join(', ') : '미등록';
  return value || '미등록';
};

const displaySourceUpdatedAt = (value?: string): string => {
  if (!value) return '';
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return '';
  return parsed.toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
};

export function ConstructionPlanErpRefreshPanel({
  current,
  latest,
  loading = false,
  applying = false,
  readOnly = false,
  error,
  success,
  hasOrganizationChanges = false,
  onRefresh,
  onApply,
}: ConstructionPlanErpRefreshPanelProps) {
  const changes = useMemo(
    () => latest ? diffConstructionPlanErpSnapshots(current, latest) : [],
    [current, latest],
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState('');

  useEffect(() => {
    setSelected(new Set(changes.map((change) => change.id)));
  }, [changes]);

  const groups = useMemo(() => {
    const result = new Map<string, typeof changes>();
    changes.forEach((change) => {
      const existing = result.get(change.slot) ?? [];
      existing.push(change);
      result.set(change.slot, existing);
    });
    return [...result.values()];
  }, [changes]);

  const toggle = (id: string) => setSelected((previous) => {
    const next = new Set(previous);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const selectIds = (ids: readonly string[], checked: boolean) => setSelected((previous) => {
    const next = new Set(previous);
    ids.forEach((id) => { if (checked) next.add(id); else next.delete(id); });
    return next;
  });

  const submit = async () => {
    if (!selected.size || reason.trim().length < 5) return;
    await onApply([...selected], reason.trim());
  };

  return (
    <section className="cp-erp-refresh" aria-label="ERP 원천 변경 비교">
      <div className="cp-erp-refresh__toolbar">
        <div>
          <strong>ERP 원천 데이터 변경 확인</strong>
          <p>현재 계획서 스냅샷을 자동 덮어쓰지 않습니다. 최신 원천과 비교한 뒤 필요한 필드만 선택 반영합니다.</p>
        </div>
        <button type="button" disabled={loading || applying} onClick={() => void onRefresh()}>
          {loading ? '비교 중…' : error ? '비교 다시 시도' : latest ? '최신 원천 다시 비교' : '최신 원천 비교'}
        </button>
      </div>

      {!latest && !loading && !error && (
        <div className="cp-erp-refresh__initial" role="status">
          아직 비교한 최신 원천이 없습니다. 비교 버튼을 눌러 현장·회사·팀 마스터를 다시 조회하세요.
        </div>
      )}
      {loading && <div className="cp-erp-refresh__loading" role="status">서버가 ERP 원천 마스터를 안전하게 비교하고 있습니다…</div>}

      {success && <div className="cp-erp-refresh__success" role="status">{success}</div>}

      {error && (
        <div className="cp-erp-refresh__error" role="alert">
          <span>{error}</span>
          <button type="button" disabled={loading || applying} onClick={() => void onRefresh()}>다시 비교</button>
        </div>
      )}

      {latest && changes.length === 0 && (
        <div className="cp-erp-refresh__empty" role="status">
          {hasOrganizationChanges
            ? '현장·회사·팀 필드는 일치합니다. 아래 조직·작업자 변경을 확인하세요.'
            : '현재 계획서와 ERP 원천 데이터가 일치합니다.'}
        </div>
      )}

      {changes.length > 0 && (
        <div className="cp-erp-refresh__selection-toolbar">
          <span>선택 {selected.size}/{changes.length}개</span>
          <button type="button" disabled={readOnly || applying} onClick={() => selectIds(changes.map((change) => change.id), true)}>전체 반영 선택</button>
          <button type="button" disabled={readOnly || applying || selected.size === 0} onClick={() => setSelected(new Set())}>모두 기존값 유지</button>
        </div>
      )}

      {groups.map((items) => (
        <section className="cp-erp-refresh__group" key={items[0].slot}>
          <header>
            <strong>{items[0].slotLabel}</strong>
            <span>{items.length}개 변경</span>
            <div>
              <button type="button" disabled={readOnly || applying} onClick={() => selectIds(items.map((item) => item.id), true)}>이 구분 반영</button>
              <button type="button" disabled={readOnly || applying} onClick={() => selectIds(items.map((item) => item.id), false)}>기존값 유지</button>
            </div>
          </header>
          {items.map((change) => (
            <div className={`cp-erp-refresh__row${selected.has(change.id) ? ' is-selected' : ' is-kept'}`} key={change.id}>
              <label>
                <input
                  type="checkbox"
                  checked={selected.has(change.id)}
                  disabled={readOnly || applying}
                  onChange={() => toggle(change.id)}
                  aria-label={`${change.slotLabel} ${change.fieldLabel} 반영`}
                />
                <strong>{change.fieldLabel}</strong>
                <del>{displayValue(change.before)}</del>
                <span className="cp-erp-refresh__arrow" aria-hidden="true">→</span>
                <ins>{displayValue(change.after)}</ins>
                <small>
                  {selected.has(change.id) ? '최신 원천 반영' : '현재 계획서 값 유지'}
                  {change.sourceUpdatedAt && ` · 원천 ${displaySourceUpdatedAt(change.sourceUpdatedAt)}`}
                </small>
              </label>
            </div>
          ))}
        </section>
      ))}

      {changes.length > 0 && (
        <div className="cp-erp-refresh__actions">
          <label>
            반영 사유 *
            <textarea
              value={reason}
              disabled={readOnly || applying}
              maxLength={500}
              onChange={(event) => setReason(event.target.value)}
              placeholder="원천 변경을 계획서에 반영하는 이유를 5자 이상 기록하세요."
            />
          </label>
          <button
            type="button"
            disabled={readOnly || applying || selected.size === 0 || reason.trim().length < 5}
            onClick={() => void submit()}
          >
            {applying ? '반영 중…' : `선택 ${selected.size}개 반영`}
          </button>
        </div>
      )}
    </section>
  );
}

export default ConstructionPlanErpRefreshPanel;
