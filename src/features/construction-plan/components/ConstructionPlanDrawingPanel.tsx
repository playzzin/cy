import React from 'react';
import { AlertCircle, CheckCircle2, FileImage, Library, ShieldCheck } from 'lucide-react';
import type { PlanDrawing, PlanSection } from '../types';

type ConstructionPlanDrawingPanelProps = {
  section: PlanSection;
  drawing?: PlanDrawing;
  projectZones: string[];
  readOnly?: boolean;
  uploading?: boolean;
  uploadError?: string;
  onOpenLibrary?: () => void;
  onChange: (drawing: PlanDrawing) => void;
};

const splitValues = (value: string): string[] =>
  Array.from(new Set(value.split(',').map((item) => item.trim()).filter(Boolean)));

export function ConstructionPlanDrawingPanel({
  section,
  drawing,
  projectZones,
  readOnly = false,
  uploading = false,
  uploadError,
  onOpenLibrary,
  onChange,
}: ConstructionPlanDrawingPanelProps) {
  const update = <K extends keyof PlanDrawing>(key: K, value: PlanDrawing[K]) => {
    if (drawing) onChange({ ...drawing, [key]: value });
  };

  return (
    <section className="cp-section-data cp-drawing-data" data-validation-record-id={drawing?.id ?? section.id}>
      <div className="cp-panel-heading cp-panel-heading--bordered">
        <div>
          <span className="cp-eyebrow">Approved drawing</span>
          <h3>{section.title}</h3>
        </div>
        <span className={`cp-completion-chip cp-completion-chip--${drawing?.approvalStatus === 'approved' ? 'complete' : 'in_progress'}`}>
          {drawing?.approvalStatus === 'approved' ? '승인도면' : drawing ? '승인정보 필요' : '도면 미등록'}
        </span>
      </div>

      {onOpenLibrary && (
        <button
          type="button"
          className="cp-button cp-button--ghost cp-drawing-data__library"
          disabled={readOnly || uploading}
          onClick={onOpenLibrary}
        >
          <Library size={15} />
          현장 도면 라이브러리
        </button>
      )}

      {!drawing ? (
        <div className="cp-drawing-data__empty">
          <FileImage size={24} />
          <strong>{uploading ? '도면을 안전하게 업로드하고 있습니다' : '도면 작업공간에서 원본을 등록하세요'}</strong>
          <p>PDF·PNG·JPG 원본을 등록하면 도면번호, Rev., 승인근거와 적용구간을 이어서 입력할 수 있습니다.</p>
        </div>
      ) : (
        <>
          <div className="cp-source-callout">
            <span className="cp-source-callout__icon"><ShieldCheck size={14} /></span>
            <div>
              <strong>{drawing.originalFileName}</strong>
              <p>SHA-256 {drawing.sourceSha256.slice(0, 12)}… · 원본 경로 보존</p>
            </div>
          </div>
          <div className="cp-data-form">
            <label>
              <span>도면번호 *</span>
              <input data-validation-field="drawingNo" value={drawing.drawingNo} disabled={readOnly} onChange={(event) => update('drawingNo', event.target.value)} placeholder="예: D-01" />
            </label>
            <label>
              <span>도면명 *</span>
              <input data-validation-field="title" value={drawing.title} disabled={readOnly} onChange={(event) => update('title', event.target.value)} />
            </label>
            <label>
              <span>도면 Rev. *</span>
              <input data-validation-field="revision" value={drawing.revision} disabled={readOnly} onChange={(event) => update('revision', event.target.value)} placeholder="승인도면의 Rev.를 입력" />
            </label>
            <label>
              <span>승인 상태 *</span>
              <select data-validation-field="approvalStatus" value={drawing.approvalStatus} disabled={readOnly} onChange={(event) => update('approvalStatus', event.target.value as PlanDrawing['approvalStatus'])}>
                <option value="draft">초안</option>
                <option value="reviewed">검토완료</option>
                <option value="approved">승인본</option>
              </select>
            </label>
            <label>
              <span>승인근거 *</span>
              <input data-validation-field="approvalReference" value={drawing.approvalReference ?? ''} disabled={readOnly} onChange={(event) => update('approvalReference', event.target.value)} placeholder="승인번호, 승인일 또는 공문번호" />
            </label>
            <label>
              <span>적용구간 *</span>
              <input
                data-validation-field="applicableZones"
                value={drawing.applicableZones.join(', ')}
                disabled={readOnly}
                onChange={(event) => update('applicableZones', splitValues(event.target.value))}
                placeholder={projectZones.join(', ') || '예: A구간, 램프구간'}
              />
            </label>
            <label>
              <span>도면 축척</span>
              <input data-validation-field="scaleText" value={drawing.scaleText ?? ''} disabled={readOnly} onChange={(event) => update('scaleText', event.target.value)} placeholder="예: 1/100 또는 NTS" />
            </label>
          </div>
          {drawing.approvalStatus === 'approved' && drawing.revision.trim() && drawing.approvalReference?.trim() ? (
            <div className="cp-drawing-data__approved"><CheckCircle2 size={15} /> 승인본 식별정보가 입력되었습니다.</div>
          ) : (
            <div className="cp-standard-warning"><AlertCircle size={15} /><div><strong>아직 발행 가능한 승인도면이 아닙니다</strong><p>도면 Rev., 적용구간과 승인근거를 모두 확인하세요.</p></div></div>
          )}
        </>
      )}

      {uploadError && <div className="cp-form-error" role="alert"><AlertCircle size={15} />{uploadError}</div>}
    </section>
  );
}

export default ConstructionPlanDrawingPanel;
