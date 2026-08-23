import React, { useRef } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  FilePenLine,
  Loader2,
  MessageSquareText,
  type LucideIcon,
} from 'lucide-react';
import {
  CONSTRUCTION_PLAN_EDITOR_MODES,
  type ConstructionPlanEditorMode,
} from '../domain/editorPosition';

type ConstructionPlanEditorModeSwitchProps = {
  mode: ConstructionPlanEditorMode;
  canEditMode: boolean;
  reviewRouteLocked?: boolean;
  switching?: boolean;
  disabled?: boolean;
  saveLabel: string;
  blockingErrorCount: number;
  pdfReady: boolean;
  openReviewCount: number;
  reviewPackageAvailable: boolean;
  onChange: (mode: ConstructionPlanEditorMode) => void | Promise<void>;
};

const MODE_PRESENTATION: Readonly<Record<ConstructionPlanEditorMode, {
  label: string;
  shortLabel: string;
  description: string;
  icon: LucideIcon;
}>> = {
  edit: {
    label: '작성 모드',
    shortLabel: '작성',
    description: '현장 데이터·구조화 항목·도면 주석을 작성합니다.',
    icon: FilePenLine,
  },
  preview: {
    label: 'A4 미리보기 모드',
    shortLabel: 'A4 미리보기',
    description: '저장된 문서의 A4 편집 결과와 PDF 준비 상태를 점검합니다.',
    icon: Eye,
  },
  review: {
    label: '검토 모드',
    shortLabel: '검토',
    description: '고정 검토 패키지, 변경 비교와 검토 의견에 집중합니다.',
    icon: MessageSquareText,
  },
};

const ConstructionPlanEditorModeSwitch: React.FC<ConstructionPlanEditorModeSwitchProps> = ({
  mode,
  canEditMode,
  reviewRouteLocked = false,
  switching = false,
  disabled: allModesDisabled = false,
  saveLabel,
  blockingErrorCount,
  pdfReady,
  openReviewCount,
  reviewPackageAvailable,
  onChange,
}) => {
  const buttonRefs = useRef<Partial<Record<ConstructionPlanEditorMode, HTMLButtonElement | null>>>({});
  const disabled = (candidate: ConstructionPlanEditorMode): boolean => (
    allModesDisabled
    || switching
    || (candidate === 'edit' && !canEditMode)
    || (reviewRouteLocked && candidate !== 'review')
  );

  const select = (candidate: ConstructionPlanEditorMode) => {
    if (candidate === mode || disabled(candidate)) return;
    void onChange(candidate);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const available = CONSTRUCTION_PLAN_EDITOR_MODES.filter((candidate) => !disabled(candidate));
    if (!available.length) return;
    const index = Math.max(0, available.indexOf(mode));
    const candidate = event.key === 'Home'
      ? available[0]
      : event.key === 'End'
        ? available[available.length - 1]
        : event.key === 'ArrowRight'
          ? available[(index + 1) % available.length]
          : available[(index - 1 + available.length) % available.length];
    buttonRefs.current[candidate]?.focus();
    select(candidate);
  };

  const active = MODE_PRESENTATION[mode];
  const modeStatus = mode === 'edit'
    ? saveLabel
    : mode === 'preview'
      ? (pdfReady ? 'PDF 생성 검증 통과' : `필수 보완 ${blockingErrorCount}건`)
      : (reviewPackageAvailable ? `고정 패키지 연결 · 미해결 ${openReviewCount}건` : '검토 패키지 준비 전');

  return (
    <div className={`cp-editor-mode-switch cp-editor-mode-switch--${mode}`}>
      <div className="cp-editor-mode-switch__segments" role="tablist" aria-label="시공계획서 작업 모드">
        {CONSTRUCTION_PLAN_EDITOR_MODES.map((candidate) => {
          const presentation = MODE_PRESENTATION[candidate];
          const Icon = presentation.icon;
          const isDisabled = disabled(candidate);
          return (
            <button
              key={candidate}
              ref={(element) => { buttonRefs.current[candidate] = element; }}
              type="button"
              role="tab"
              aria-selected={mode === candidate}
              aria-controls="construction-plan-editor-workspace"
              aria-label={presentation.label}
              aria-disabled={isDisabled}
              disabled={isDisabled}
              tabIndex={mode === candidate ? 0 : -1}
              className={mode === candidate ? 'is-active' : undefined}
              title={candidate === 'edit' && !canEditMode
                ? '현재 문서 상태에서는 작성 모드를 사용할 수 없습니다.'
                : reviewRouteLocked && candidate !== 'review'
                  ? '고정 검토 패키지 링크에서는 검토 모드가 우선됩니다.'
                  : allModesDisabled
                    ? '현재 작업을 마친 뒤 모드를 전환할 수 있습니다.'
                  : presentation.description}
              onClick={() => select(candidate)}
              onKeyDown={onKeyDown}
            >
              {switching && mode === candidate ? <Loader2 size={14} className="cp-spin" /> : <Icon size={14} />}
              <span>{presentation.shortLabel}</span>
            </button>
          );
        })}
      </div>
      <div className="cp-editor-mode-switch__context" aria-live="polite">
        <div><strong>{active.label}</strong><span>{active.description}</span></div>
        <span className={pdfReady || mode === 'edit' ? 'is-ready' : 'is-blocked'}>
          {pdfReady || mode === 'edit' ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
          {modeStatus}
        </span>
      </div>
    </div>
  );
};

export default ConstructionPlanEditorModeSwitch;
