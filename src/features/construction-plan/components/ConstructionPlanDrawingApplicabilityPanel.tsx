import React from 'react';
import { AlertCircle, CheckCircle2, FileCheck2 } from 'lucide-react';
import type { DrawingApplicabilityDecision, DrawingSlot, PlanDrawing } from '../types';

type Props = {
  decisions: DrawingApplicabilityDecision[];
  drawings: PlanDrawing[];
  reviewedBy: string;
  readOnly?: boolean;
  onChange: (decisions: DrawingApplicabilityDecision[]) => void;
};

const SLOTS: DrawingSlot[] = ['D-01', 'D-02', 'D-03', 'D-04', 'D-05', 'D-06'];

export function ConstructionPlanDrawingApplicabilityPanel({ decisions, drawings, reviewedBy, readOnly = false, onChange }: Props) {
  const update = (slot: DrawingSlot, patch: Partial<DrawingApplicabilityDecision>) => {
    const current = decisions.find((decision) => decision.drawingSlot === slot);
    const next: DrawingApplicabilityDecision = {
      drawingSlot: slot,
      decision: current?.decision ?? 'applicable',
      reason: current?.reason ?? '',
      reviewedBy: current?.reviewedBy ?? reviewedBy,
      ...(current ?? {}),
      ...patch,
    };
    onChange([...decisions.filter((decision) => decision.drawingSlot !== slot), next]
      .sort((left, right) => left.drawingSlot.localeCompare(right.drawingSlot)));
  };

  const complete = SLOTS.filter((slot) => {
    const decision = decisions.find((candidate) => candidate.drawingSlot === slot);
    if (!decision) return false;
    if (decision.decision === 'not_applicable') return decision.reason.trim().length >= 10 && Boolean(decision.reviewedBy?.trim());
    if (decision.decision === 'replacement') return Boolean(decision.drawingId && decision.technicalReviewReference?.trim());
    return Boolean(decision.drawingId);
  }).length;

  return (
    <section className="cp-section-data cp-applicability-panel">
      <div className="cp-panel-heading cp-panel-heading--bordered">
        <div><span className="cp-eyebrow">Drawing register</span><h3>D-01~D-06 적용성 결정</h3></div>
        <span className={`cp-completion-chip cp-completion-chip--${complete === SLOTS.length ? 'complete' : 'in_progress'}`}>{complete}/6 완료</span>
      </div>
      <div className="cp-source-callout"><span className="cp-source-callout__icon"><FileCheck2 size={14} /></span><div><strong>예시도면은 자동 승인되지 않습니다</strong><p>각 슬롯마다 승인도면 연결 또는 해당없음 근거를 남겨야 합니다.</p></div></div>
      <div className="cp-applicability-list">
        {SLOTS.map((slot) => {
          const decision = decisions.find((candidate) => candidate.drawingSlot === slot);
          const isComplete = decision?.decision === 'not_applicable'
            ? (decision.reason.trim().length >= 10 && Boolean(decision.reviewedBy?.trim()))
            : Boolean(decision?.drawingId && (decision.decision !== 'replacement' || decision.technicalReviewReference?.trim()));
          return (
            <fieldset key={slot} disabled={readOnly} data-validation-record-id={slot}>
              <legend><strong>{slot}</strong>{isComplete ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}</legend>
              <label><span>적용 결정 *</span><select data-validation-field="decision" value={decision?.decision ?? ''} onChange={(event) => {
                const value = event.target.value as DrawingApplicabilityDecision['decision'];
                update(slot, {
                  decision: value,
                  reviewedBy,
                  ...(value === 'not_applicable' ? { drawingId: undefined } : { drawingId: decision?.drawingId ?? drawings[0]?.id }),
                });
              }}><option value="" disabled>결정 필요</option><option value="applicable">현장 적용</option><option value="replacement">대체도면 적용</option><option value="not_applicable">해당없음</option></select></label>
              {decision && decision.decision !== 'not_applicable' && <label><span>연결 승인도면 *</span><select data-validation-field="drawingId" value={decision.drawingId ?? ''} onChange={(event) => update(slot, { drawingId: event.target.value })}><option value="">도면 선택</option>{drawings.map((drawing) => <option key={drawing.id} value={drawing.id}>{drawing.drawingNo || drawing.originalFileName} · {drawing.title}</option>)}</select></label>}
              {decision?.decision === 'not_applicable' && <label><span>해당없음 근거 *</span><textarea data-validation-field="reason" value={decision.reason} onChange={(event) => update(slot, { reason: event.target.value, reviewedBy })} placeholder="10자 이상 구체적 사유와 적용 조건을 기록" /></label>}
              {decision?.decision === 'replacement' && <label><span>기술검토 근거 *</span><input data-validation-field="technicalReviewReference" value={decision.technicalReviewReference ?? ''} onChange={(event) => update(slot, { technicalReviewReference: event.target.value })} placeholder="구조검토서 또는 승인문서 번호" /></label>}
            </fieldset>
          );
        })}
      </div>
    </section>
  );
}

export default ConstructionPlanDrawingApplicabilityPanel;
