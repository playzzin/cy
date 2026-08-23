import React from 'react';
import { AlertTriangle, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import type {
  ConstructionPlanRiskAssessmentPolicy,
  RiskAssessmentItem,
  SafeWorkerDto,
} from '../types';
import {
  quantitativeRiskPatch,
  riskIsAcceptable,
  riskLevelLabel,
  riskPairForLevel,
  riskScore,
} from '../domain/riskMatrix';

const createRiskId = (): string =>
  `risk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const splitMeasures = (value: string): string[] => Array.from(new Set(
  value.split('\n').map((item) => item.trim()).filter(Boolean),
));

const upgradeRiskMethod = (
  item: RiskAssessmentItem,
  policy: ConstructionPlanRiskAssessmentPolicy,
): RiskAssessmentItem => {
  if (item.assessmentMethodVersion === policy.methodVersion
    && item.methodReference === policy.methodReference) return item;
  const [initialProbability, initialSeverity] = riskPairForLevel(item.initialRiskLevel, policy);
  const residualPair = item.residualRiskLevel
    ? riskPairForLevel(item.residualRiskLevel, policy)
    : undefined;
  return {
    ...item,
    assessmentMethodVersion: policy.methodVersion,
    initialProbability,
    initialSeverity,
    ...(residualPair ? {
      residualProbability: residualPair[0],
      residualSeverity: residualPair[1],
    } : {}),
    methodReference: policy.methodReference,
  };
};

type ConstructionPlanRiskAssessmentPanelProps = {
  items: RiskAssessmentItem[];
  workers: SafeWorkerDto[];
  reviewerName: string;
  policy: ConstructionPlanRiskAssessmentPolicy;
  readOnly?: boolean;
  onChange: (items: RiskAssessmentItem[]) => void;
};

export function ConstructionPlanRiskAssessmentPanel({
  items,
  workers,
  reviewerName,
  policy,
  readOnly = false,
  onChange,
}: ConstructionPlanRiskAssessmentPanelProps) {
  const matrixChoices = Array.from(
    { length: policy.probabilityMax - policy.probabilityMin + 1 },
    (_, index) => policy.probabilityMin + index,
  );
  const defaultInitialPair = riskPairForLevel('high', policy);
  const add = () => onChange([...items, {
    id: createRiskId(),
    assessmentMethodVersion: policy.methodVersion,
    workStage: '',
    hazard: '',
    initialProbability: defaultInitialPair[0],
    initialSeverity: defaultInitialPair[1],
    initialRiskLevel: 'high',
    mitigationMeasures: [],
    methodReference: policy.methodReference,
    reviewTrigger: '',
  }]);
  const update = (id: string, patch: Partial<RiskAssessmentItem>) =>
    onChange(items.map((item) => {
      if (item.id !== id) return item;
      const next = {
        ...upgradeRiskMethod(item, policy),
        ...patch,
        assessmentMethodVersion: policy.methodVersion,
        methodReference: policy.methodReference,
      };
      return Object.prototype.hasOwnProperty.call(patch, 'verifiedBy')
        ? next
        : { ...next, verifiedBy: undefined };
    }));
  const canVerify = (item: RiskAssessmentItem): boolean => {
    const initialScore = riskScore(item.initialProbability, item.initialSeverity, policy);
    const residualScore = riskScore(item.residualProbability, item.residualSeverity, policy);
    return riskIsAcceptable(residualScore, item.residualRiskLevel, policy)
      && Boolean(initialScore)
      && (!policy.acceptance.requireResidualReduction || Number(residualScore) < Number(initialScore));
  };

  return (
    <section className="cp-section-data cp-technical-panel" data-validation-record-id="riskAssessments">
      <div className="cp-panel-heading cp-panel-heading--bordered">
        <div><span className="cp-eyebrow">Risk register</span><h3>현장 위험성평가</h3></div>
        <button type="button" className="cp-mini-add" data-validation-field="riskAssessments" disabled={readOnly} onClick={add}>
          <Plus size={13} /> 위험요인 추가
        </button>
      </div>
      <div className="cp-source-callout">
        <span className="cp-source-callout__icon"><ShieldCheck size={14} /></span>
        <div>
          <strong>{policy.methodReference} · 가능성 × 중대성</strong>
          <p>{policy.thresholds.map((item) => `${item.minScore}~${item.maxScore} ${item.label}`).join(' · ')}. 허용기준은 잔여 {policy.acceptance.maxResidualScore}점 이하이며 저감 후 점수가 바뀌면 기존 확인은 자동으로 무효화됩니다.</p>
          <p>재검토: {policy.reviewTriggers.join(' · ')}</p>
        </div>
      </div>
      <div className="cp-repeater-list">
        {items.map((item, index) => (
          <fieldset key={item.id} disabled={readOnly} data-validation-record-id={item.id}>
            <legend>
              <strong>위험요인 {index + 1}</strong>
              <button type="button" onClick={() => onChange(items.filter((candidate) => candidate.id !== item.id))} aria-label={`위험요인 ${index + 1} 삭제`}><Trash2 size={12} /></button>
            </legend>
            <label><span>작업단계 *</span><input data-validation-field="workStage" value={item.workStage} onChange={(event) => update(item.id, { workStage: event.target.value })} placeholder="예: 시스템동바리 설치" /></label>
            <label><span>위험요인 *</span><textarea data-validation-field="hazard" value={item.hazard} onChange={(event) => update(item.id, { hazard: event.target.value })} placeholder="추락, 전도, 낙하 등 구체적 위험상황" /></label>
            <div className="cp-inline-fields cp-risk-matrix-fields">
              <label><span>최초 가능성 ({policy.probabilityMin}~{policy.probabilityMax}) *</span><select data-validation-field="initialProbability" value={item.initialProbability ?? riskPairForLevel(item.initialRiskLevel, policy)[0]} onChange={(event) => { const probability = Number(event.target.value); update(item.id, quantitativeRiskPatch(probability, item.initialSeverity ?? riskPairForLevel(item.initialRiskLevel, policy)[1], 'initial', policy)); }}>{matrixChoices.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
              <label><span>최초 중대성 ({policy.severityMin}~{policy.severityMax}) *</span><select data-validation-field="initialSeverity" value={item.initialSeverity ?? riskPairForLevel(item.initialRiskLevel, policy)[1]} onChange={(event) => { const severity = Number(event.target.value); update(item.id, quantitativeRiskPatch(item.initialProbability ?? riskPairForLevel(item.initialRiskLevel, policy)[0], severity, 'initial', policy)); }}>{matrixChoices.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
              <output className={`cp-risk-score is-${item.initialRiskLevel}`}>
                최초 {riskScore(
                  item.initialProbability ?? riskPairForLevel(item.initialRiskLevel, policy)[0],
                  item.initialSeverity ?? riskPairForLevel(item.initialRiskLevel, policy)[1],
                  policy,
                ) ?? '—'}점 · {riskLevelLabel(item.initialRiskLevel, policy)}
              </output>
            </div>
            <div className="cp-inline-fields cp-risk-matrix-fields">
              <label><span>저감 후 가능성 ({policy.probabilityMin}~{policy.probabilityMax}) *</span><select data-validation-field="residualProbability" value={item.residualProbability ?? ''} onChange={(event) => { const probability = event.target.value ? Number(event.target.value) : undefined; update(item.id, quantitativeRiskPatch(probability, item.residualSeverity, 'residual', policy)); }}><option value="">선택</option>{matrixChoices.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
              <label><span>저감 후 중대성 ({policy.severityMin}~{policy.severityMax}) *</span><select data-validation-field="residualSeverity" value={item.residualSeverity ?? ''} onChange={(event) => { const severity = event.target.value ? Number(event.target.value) : undefined; update(item.id, quantitativeRiskPatch(item.residualProbability, severity, 'residual', policy)); }}><option value="">선택</option>{matrixChoices.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
              <output className={`cp-risk-score is-${item.residualRiskLevel ?? 'pending'}`}>
                저감 후 {riskScore(item.residualProbability, item.residualSeverity, policy) ?? '—'}점 · {item.residualRiskLevel ? riskLevelLabel(item.residualRiskLevel, policy) : '미평가'}
              </output>
            </div>
            <label><span>저감대책 * (한 줄에 하나)</span><textarea data-validation-field="mitigationMeasures" className="is-tall" value={item.mitigationMeasures.join('\n')} onChange={(event) => update(item.id, { mitigationMeasures: splitMeasures(event.target.value) })} placeholder={'안전난간 선행 설치\n출입통제구역 설정'} /></label>
            <div className="cp-inline-fields">
               <label><span>평가기준·방법 *</span><input data-validation-field="methodReference" value={policy.methodReference} readOnly aria-readonly="true" /></label>
               <label><span>재평가 트리거 *</span><select data-validation-field="reviewTrigger" value={item.reviewTrigger ?? ''} onChange={(event) => update(item.id, { reviewTrigger: event.target.value })}><option value="">선택</option>{policy.reviewTriggers.map((trigger) => <option key={trigger} value={trigger}>{trigger}</option>)}</select></label>
            </div>
            <div className="cp-inline-fields">
              <label><span>담당자</span><select data-validation-field="responsibleWorkerId" value={item.responsibleWorkerId ?? ''} onChange={(event) => update(item.id, { responsibleWorkerId: event.target.value || undefined })}><option value="">선택</option>{workers.filter((worker) => worker.status === 'active').map((worker) => <option key={worker.id} value={worker.id}>{worker.name}</option>)}</select></label>
              <label><span>확인</span><button type="button" className="cp-button cp-button--secondary cp-button--small" disabled={readOnly || !canVerify(item)} onClick={() => update(item.id, { verifiedBy: reviewerName })}>{item.verifiedBy ? `${item.verifiedBy} 확인` : '허용기준 충족 후 확인'}</button></label>
            </div>
          </fieldset>
        ))}
        {items.length === 0 && (
          <div className="cp-repeater-empty">
            <AlertTriangle size={21} /><strong>등록된 위험요인이 없습니다</strong>
            <p>설치·타설·해체 단계별 핵심 위험요인과 저감대책을 추가하세요.</p>
            <button type="button" disabled={readOnly} onClick={add}><Plus size={13} /> 첫 위험요인 추가</button>
          </div>
        )}
      </div>
    </section>
  );
}

export default ConstructionPlanRiskAssessmentPanel;
