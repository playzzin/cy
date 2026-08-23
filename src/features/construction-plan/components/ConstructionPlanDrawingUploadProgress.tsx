import React from 'react';
import { AlertCircle, CheckCircle2, FileUp, Loader2, ShieldCheck, X } from 'lucide-react';
import type {
  ConstructionPlanDrawingUploadProgress as DrawingUploadProgress,
} from '../services/constructionPlanDrawingUploadService';

export type ConstructionPlanDrawingUploadViewState =
  | { status: 'idle' }
  | { status: 'working'; progress: DrawingUploadProgress }
  | { status: 'completed'; storagePath: string; sourceRevision: number }
  | { status: 'canceled'; message: string }
  | { status: 'error'; message: string };

type Props = {
  state: ConstructionPlanDrawingUploadViewState;
  onCancel?: () => void;
  canceling?: boolean;
};

const stageLabel: Record<DrawingUploadProgress['stage'], string> = {
  hashing: '원본 해시 계산',
  creating_session: '보안 업로드 세션 생성',
  uploading: '격리 저장소 업로드',
  verifying: '서버 파일 검사 및 불변 원본 확정',
  completed: '도면 원본 등록 완료',
};

export function ConstructionPlanDrawingUploadProgress({ state, onCancel, canceling = false }: Props) {
  if (state.status === 'idle') return null;
  if (state.status === 'canceled') {
    return (
      <div className="cp-source-callout cp-drawing-upload-canceled" role="status">
        <span className="cp-source-callout__icon"><X size={14} /></span>
        <div><strong>도면 업로드 취소됨</strong><p>{state.message}</p></div>
      </div>
    );
  }
  if (state.status === 'error') {
    return <div className="cp-form-error" role="alert"><AlertCircle size={15} />{state.message}</div>;
  }
  if (state.status === 'completed') {
    return (
      <div className="cp-drawing-data__approved" role="status">
        <CheckCircle2 size={15} />
        서버 검증 완료 · 불변 원본 Rev.{state.sourceRevision}
      </div>
    );
  }
  const progress = Math.round(Math.min(100, Math.max(0, state.progress.percent)));
  return (
    <div className="cp-source-callout cp-drawing-upload-progress" role="status" aria-live="polite">
      <span className="cp-source-callout__icon">
        {state.progress.stage === 'verifying' ? <ShieldCheck size={14} /> : <FileUp size={14} />}
      </span>
      <div>
        <strong><Loader2 size={14} className="cp-spin" /> {stageLabel[state.progress.stage]}</strong>
        <p>{state.progress.stage === 'uploading' ? `${progress}%` : '서버 권위 검증 절차를 진행하고 있습니다.'}</p>
        <progress value={progress} max={100} aria-label="도면 원본 등록 진행률" />
      </div>
      {onCancel && state.progress.stage !== 'verifying' && state.progress.stage !== 'completed' && (
        <button
          type="button"
          className="cp-drawing-upload-progress__cancel"
          disabled={canceling}
          onClick={onCancel}
        >
          <X size={13} />{canceling ? '취소 중' : '취소'}
        </button>
      )}
    </div>
  );
}

export default ConstructionPlanDrawingUploadProgress;
