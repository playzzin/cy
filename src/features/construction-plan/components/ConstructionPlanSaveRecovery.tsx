import React, { useEffect, useState } from 'react';
import { AlertCircle, Check, Copy, RefreshCw } from 'lucide-react';
import type { UpdateConstructionPlanInput } from '../types';

export type ConstructionPlanFailedSaveSnapshot = {
  failedAt: string;
  reason: 'request_failed' | 'offline' | 'lock_lost';
  patch: Partial<UpdateConstructionPlanInput>;
};

type ConstructionPlanSaveRecoveryProps = {
  snapshot: ConstructionPlanFailedSaveSnapshot;
  lastSuccessfulSaveAt?: string;
  retrying?: boolean;
  offline?: boolean;
  onRetry: () => void | Promise<void>;
};

type CopyState = 'idle' | 'copied' | 'error';

const formatTimestamp = (value?: string): string => {
  if (!value) return '기록 없음';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '기록 없음';
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
};

/**
 * Export only the failed document patch and recovery timestamps. Runtime errors,
 * authentication identity, lock tokens and route data are deliberately excluded.
 */
export const serializeConstructionPlanFailedSave = (
  snapshot: ConstructionPlanFailedSaveSnapshot,
  lastSuccessfulSaveAt?: string,
): string => JSON.stringify({
  schemaVersion: 'construction-plan-unsaved-changes-v1',
  failedAt: snapshot.failedAt,
  failureState: snapshot.reason,
  lastSuccessfulSaveAt: lastSuccessfulSaveAt || null,
  changes: snapshot.patch,
}, null, 2);

export const mergeConstructionPlanFailedSavePatch = (
  attemptedPatch: Partial<UpdateConstructionPlanInput>,
  queuedWhileSaving: Partial<UpdateConstructionPlanInput>,
): Partial<UpdateConstructionPlanInput> => ({
  ...attemptedPatch,
  ...queuedWhileSaving,
});

export default function ConstructionPlanSaveRecovery({
  snapshot,
  lastSuccessfulSaveAt,
  retrying = false,
  offline = false,
  onRetry,
}: ConstructionPlanSaveRecoveryProps) {
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const lockLost = snapshot.reason === 'lock_lost';

  useEffect(() => {
    setCopyState('idle');
  }, [snapshot.failedAt]);

  const copyChanges = async () => {
    if (!navigator.clipboard?.writeText) {
      setCopyState('error');
      return;
    }
    try {
      await navigator.clipboard.writeText(
        serializeConstructionPlanFailedSave(snapshot, lastSuccessfulSaveAt),
      );
      setCopyState('copied');
    } catch {
      setCopyState('error');
    }
  };

  return (
    <section className="cp-save-recovery" aria-label="저장 실패 복구" role="alert">
      <span className="cp-save-recovery__icon"><AlertCircle size={16} /></span>
      <div className="cp-save-recovery__copy">
        <strong>{lockLost
          ? '편집 잠금이 회수되어 변경사항을 저장하지 못했습니다.'
          : offline || snapshot.reason === 'offline'
            ? '연결이 끊겨 변경사항을 저장하지 못했습니다.'
            : '마지막 변경사항 저장에 실패했습니다.'}</strong>
        <span>
          실패 {formatTimestamp(snapshot.failedAt)} · 마지막 저장 성공 {formatTimestamp(lastSuccessfulSaveAt)}
        </span>
        <small>복사본에는 문서 변경 데이터와 개인정보가 포함될 수 있습니다. 안전한 위치에만 보관하세요.</small>
      </div>
      <div className="cp-save-recovery__actions">
        <button
          type="button"
          className="cp-button cp-button--ghost cp-button--small"
          disabled={retrying || offline || lockLost}
          onClick={() => void onRetry()}
        >
          <RefreshCw size={13} className={retrying ? 'cp-spin' : undefined} />
          {retrying ? '다시 저장 중' : lockLost ? '편집 잠금 필요' : '다시 저장'}
        </button>
        <button
          type="button"
          className="cp-button cp-button--secondary cp-button--small"
          disabled={retrying}
          onClick={() => void copyChanges()}
        >
          {copyState === 'copied' ? <Check size={13} /> : <Copy size={13} />}
          {copyState === 'copied' ? '복사됨' : '변경내용 복사'}
        </button>
        <span className="sr-only" aria-live="polite">
          {copyState === 'copied' ? '저장되지 않은 변경내용을 클립보드에 복사했습니다.' : copyState === 'error' ? '변경내용을 복사하지 못했습니다.' : ''}
        </span>
      </div>
    </section>
  );
}
