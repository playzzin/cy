import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Archive,
  Clock3,
  Loader2,
  LockKeyhole,
  RotateCcw,
  ShieldAlert,
  Unlock,
} from 'lucide-react';
import type { ConstructionPlan } from '../types';
import {
  createConstructionPlanControlIdempotencyKey,
  forceReleaseConstructionPlanLock,
  getConstructionPlanControlCapabilities,
  requestConstructionPlanUnlock,
  transitionConstructionPlanLifecycle,
  type ConstructionPlanControlCapabilities,
  type ConstructionPlanLifecycleAction,
} from '../services/constructionPlanLifecycleControlApi';

type Props = {
  plan: ConstructionPlan;
  disabled?: boolean;
  onChanged: () => void | Promise<void>;
  onError: (message: string) => void;
};

const ACTION_COPY: Record<ConstructionPlanLifecycleAction, { title: string; help: string; confirm: string }> = {
  withdraw_review: {
    title: '검토 요청 회수',
    help: '검토 결정이나 의견이 기록되기 전인 현재 Round만 회수합니다. 제출 스냅샷과 패키지는 감사이력으로 보존됩니다.',
    confirm: '검토 요청 회수',
  },
  void: {
    title: '문서 폐기',
    help: '문서를 폐기 상태로 전환합니다. 승인 스냅샷, PDF, 검토이력은 삭제되지 않습니다.',
    confirm: '폐기 확정',
  },
  archive: {
    title: '문서 보관',
    help: '문서를 보관 상태로 전환합니다. 문서와 발행본은 그대로 유지됩니다.',
    confirm: '보관 확정',
  },
};

const messageForError = (error: unknown): string => {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code || '')
    : '';
  if (code.includes('permission-denied')) return '이 작업에 필요한 서버 권한이 없습니다.';
  if (code.includes('failed-precondition')) return '문서 상태, 검토 의견 또는 편집 잠금이 변경되었습니다. 새로고침 후 다시 확인해주세요.';
  if (code.includes('aborted')) return '다른 사용자가 문서나 잠금을 변경했습니다. 최신 상태를 다시 확인해주세요.';
  if (code.includes('already-exists')) return '같은 요청 키가 다른 작업에 사용되었습니다. 화면을 새로고침해주세요.';
  return '문서 제어 요청을 완료하지 못했습니다. 네트워크 상태를 확인해주세요.';
};

const remainingLabel = (expiresAtEpochMs: number, now: number): string => {
  const remainingSeconds = Math.max(0, Math.ceil((expiresAtEpochMs - now) / 1000));
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  return `${minutes}분 ${String(seconds).padStart(2, '0')}초`;
};

export function ConstructionPlanLifecycleControlPanel({ plan, disabled = false, onChanged, onError }: Props) {
  const [capabilities, setCapabilities] = useState<ConstructionPlanControlCapabilities>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [forceReason, setForceReason] = useState('');
  const [showForce, setShowForce] = useState(false);
  const [lifecycleAction, setLifecycleAction] = useState<ConstructionPlanLifecycleAction>();
  const [lifecycleReason, setLifecycleReason] = useState('');
  const [lifecycleKey, setLifecycleKey] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCapabilities(await getConstructionPlanControlCapabilities(plan.id));
    } catch (error) {
      console.error('[ConstructionPlanLifecycleControlPanel] capability load failed', error);
      setCapabilities(undefined);
    } finally {
      setLoading(false);
    }
  }, [plan.id]);

  useEffect(() => { void load(); }, [load, plan.lockVersion, plan.status]);
  useEffect(() => {
    if (!capabilities?.lock) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [capabilities?.lock]);

  const lock = capabilities?.lock;
  const hasLifecycleAction = Boolean(
    capabilities?.canWithdrawReview || capabilities?.canVoid || capabilities?.canArchive,
  );
  const visible = loading || Boolean(lock) || hasLifecycleAction;
  const remaining = useMemo(() => lock ? remainingLabel(lock.expiresAtEpochMs, now) : '', [lock, now]);

  if (!visible) return null;

  const runUnlockRequest = async () => {
    if (!capabilities?.lock || !capabilities.canRequestUnlock || busy) return;
    setBusy(true);
    try {
      await requestConstructionPlanUnlock({
        planId: plan.id,
        expectedLockVersion: capabilities.lockVersion,
        lock: capabilities.lock,
      });
      await load();
    } catch (error) {
      console.error('[ConstructionPlanLifecycleControlPanel] unlock request failed', error);
      onError(messageForError(error));
    } finally {
      setBusy(false);
    }
  };

  const runForceUnlock = async () => {
    if (!capabilities?.lock || !capabilities.canForceUnlock || forceReason.trim().length < 5 || busy) return;
    setBusy(true);
    try {
      await forceReleaseConstructionPlanLock({
        planId: plan.id,
        expectedLockVersion: capabilities.lockVersion,
        lock: capabilities.lock,
        reason: forceReason,
      });
      setShowForce(false);
      setForceReason('');
      await onChanged();
    } catch (error) {
      console.error('[ConstructionPlanLifecycleControlPanel] force unlock failed', error);
      onError(messageForError(error));
    } finally {
      setBusy(false);
    }
  };

  const openLifecycle = (action: ConstructionPlanLifecycleAction) => {
    setLifecycleAction(action);
    setLifecycleReason('');
    setLifecycleKey(createConstructionPlanControlIdempotencyKey());
  };

  const runLifecycle = async () => {
    if (!capabilities || !lifecycleAction || lifecycleReason.trim().length < 5 || busy) return;
    const effectiveIdempotencyKey = lifecycleKey || createConstructionPlanControlIdempotencyKey();
    if (!lifecycleKey) setLifecycleKey(effectiveIdempotencyKey);
    setBusy(true);
    try {
      await transitionConstructionPlanLifecycle({
        planId: plan.id,
        action: lifecycleAction,
        expectedLockVersion: capabilities.lockVersion,
        reason: lifecycleReason.trim(),
        idempotencyKey: effectiveIdempotencyKey,
      });
      setLifecycleAction(undefined);
      setLifecycleReason('');
      setLifecycleKey('');
      await onChanged();
    } catch (error) {
      console.error('[ConstructionPlanLifecycleControlPanel] lifecycle transition failed', error);
      onError(messageForError(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="cp-lifecycle-control" aria-label="편집 잠금 및 문서 상태 제어">
      <div className="cp-lifecycle-control__summary">
        {loading ? <><Loader2 size={15} className="cp-spin" /><span>서버 권한과 잠금 상태 확인 중</span></> : lock ? <>
          <LockKeyhole size={16} />
          <span><strong>{lock.userName}</strong> 편집 잠금 · 남은 시간 <b>{remaining}</b></span>
          {capabilities?.unlockRequest?.status === 'pending' && <em><Clock3 size={13} /> 해제 요청 전달됨</em>}
        </> : <><Unlock size={16} /><span>활성 편집 잠금 없음</span></>}
      </div>

      {!loading && <div className="cp-lifecycle-control__actions">
        {capabilities?.canRequestUnlock && capabilities.unlockRequest?.status !== 'pending' && (
          <button type="button" className="cp-button cp-button--ghost cp-button--small" disabled={disabled || busy} onClick={() => void runUnlockRequest()}>
            <Unlock size={14} /> 잠금 해제 요청
          </button>
        )}
        {capabilities?.canForceUnlock && (
          <button type="button" className="cp-button cp-button--secondary cp-button--small" disabled={disabled || busy} onClick={() => setShowForce((value) => !value)}>
            <ShieldAlert size={14} /> 관리자 강제 해제
          </button>
        )}
        {capabilities?.canWithdrawReview && (
          <button type="button" className="cp-button cp-button--secondary cp-button--small" disabled={disabled || busy} onClick={() => openLifecycle('withdraw_review')}>
            <RotateCcw size={14} /> 검토 요청 회수
          </button>
        )}
        {capabilities?.canVoid && (
          <button type="button" className="cp-button cp-button--ghost cp-button--small is-danger" disabled={disabled || busy} onClick={() => openLifecycle('void')}>
            <ShieldAlert size={14} /> 폐기
          </button>
        )}
        {capabilities?.canArchive && (
          <button type="button" className="cp-button cp-button--ghost cp-button--small" disabled={disabled || busy} onClick={() => openLifecycle('archive')}>
            <Archive size={14} /> 보관
          </button>
        )}
      </div>}

      {showForce && lock && (
        <div className="cp-lifecycle-control__form">
          <div><strong>활성 잠금 강제 해제</strong><span>서버가 잠금 소유자·취득시각·문서 버전을 다시 확인하고 감사이력을 남깁니다.</span></div>
          <textarea autoFocus maxLength={500} value={forceReason} onChange={(event) => setForceReason(event.target.value)} placeholder="강제 해제 사유를 5자 이상 입력하세요." />
          <small>{forceReason.trim().length}/500</small>
          <button type="button" className="cp-button cp-button--ghost cp-button--small" disabled={busy} onClick={() => { setShowForce(false); setForceReason(''); }}>취소</button>
          <button type="button" className="cp-button cp-button--secondary cp-button--small" disabled={busy || forceReason.trim().length < 5} onClick={() => void runForceUnlock()}>{busy && <Loader2 size={14} className="cp-spin" />} 강제 해제 확정</button>
        </div>
      )}

      {lifecycleAction && (
        <div className="cp-lifecycle-control__form">
          <div><strong>{ACTION_COPY[lifecycleAction].title}</strong><span>{ACTION_COPY[lifecycleAction].help}</span></div>
          <textarea autoFocus maxLength={1000} value={lifecycleReason} onChange={(event) => setLifecycleReason(event.target.value)} placeholder="감사이력에 남길 구체적인 사유를 5자 이상 입력하세요." />
          <small>{lifecycleReason.trim().length}/1000</small>
          <button type="button" className="cp-button cp-button--ghost cp-button--small" disabled={busy} onClick={() => { setLifecycleAction(undefined); setLifecycleReason(''); setLifecycleKey(''); }}>취소</button>
          <button type="button" className="cp-button cp-button--secondary cp-button--small" disabled={busy || lifecycleReason.trim().length < 5} onClick={() => void runLifecycle()}>{busy && <Loader2 size={14} className="cp-spin" />} {ACTION_COPY[lifecycleAction].confirm}</button>
        </div>
      )}
    </section>
  );
}

export default ConstructionPlanLifecycleControlPanel;
