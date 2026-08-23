import React from 'react';
import { Plus, ShieldCheck, Trash2, Wrench } from 'lucide-react';
import type { EquipmentPlanItem, SafeWorkerDto, VerifiedEngineeringValue } from '../types';
import { updateEngineeringValueWithReviewInvalidation } from '../domain/technicalReviewInvalidation';

const createId = (prefix: string): string => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const splitValues = (value: string): string[] => Array.from(new Set(
  value.split(/[,\n]/).map((item) => item.trim()).filter(Boolean),
));

type EngineeringProps = {
  values: VerifiedEngineeringValue[];
  zones: string[];
  reviewerName: string;
  readOnly?: boolean;
  onChange: (values: VerifiedEngineeringValue[]) => void;
};

export function ConstructionPlanEngineeringPanel({
  values,
  zones,
  reviewerName,
  readOnly = false,
  onChange,
}: EngineeringProps) {
  const add = () => onChange([...values, {
    key: '',
    value: '',
    unit: 'mm',
    sourceDocumentId: '',
    sourceRevision: '',
    applicableZones: zones,
    verificationStatus: 'unverified',
  }]);
  const update = (index: number, patch: Partial<VerifiedEngineeringValue>) => onChange(
    values.map((value, itemIndex) => itemIndex === index
      ? updateEngineeringValueWithReviewInvalidation(value, patch)
      : value),
  );

  return (
    <section className="cp-section-data cp-technical-panel" data-validation-record-id="engineeringValues">
      <div className="cp-panel-heading cp-panel-heading--bordered">
        <div><span className="cp-eyebrow">Engineering source</span><h3>구조검토 기준값</h3></div>
        <button type="button" className="cp-mini-add" data-validation-field="engineeringValues" disabled={readOnly} onClick={add}>
          <Plus size={13} /> 추가
        </button>
      </div>
      <div className="cp-source-callout">
        <span className="cp-source-callout__icon"><ShieldCheck size={14} /></span>
        <div><strong>수치만 입력하지 마세요</strong><p>값·단위와 함께 출처 문서, Rev., 적용구간을 스냅샷으로 기록합니다.</p></div>
      </div>
      <div className="cp-repeater-list">
        {values.map((value, index) => (
          <fieldset
            key={`${value.key}-${index}`}
            disabled={readOnly}
            data-validation-record-id={value.key || String(index)}
          >
            <legend>
              <strong>기준값 {index + 1}</strong>
              <button type="button" onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))} aria-label={`기준값 ${index + 1} 삭제`}><Trash2 size={12} /></button>
            </legend>
            <label><span>항목명 *</span><input data-validation-field="key" value={value.key} onChange={(event) => update(index, { key: event.target.value })} placeholder="예: 지주 설치간격" /></label>
            <div className="cp-inline-fields">
              <label><span>값 *</span><input data-validation-field="value" value={String(value.value)} onChange={(event) => update(index, { value: event.target.value })} /></label>
              <label><span>단위</span><input data-validation-field="unit" value={value.unit ?? ''} onChange={(event) => update(index, { unit: event.target.value })} /></label>
            </div>
            <label><span>출처 문서 *</span><input data-validation-field="sourceDocumentId" value={value.sourceDocumentId} onChange={(event) => update(index, { sourceDocumentId: event.target.value })} placeholder="구조검토서 문서번호" /></label>
            <div className="cp-inline-fields">
              <label><span>출처 Rev. *</span><input data-validation-field="sourceRevision" value={value.sourceRevision} onChange={(event) => update(index, { sourceRevision: event.target.value })} /></label>
              <label><span>페이지/절</span><input data-validation-field="sourcePageOrSection" value={value.sourcePageOrSection ?? ''} onChange={(event) => update(index, { sourcePageOrSection: event.target.value })} /></label>
            </div>
            <label><span>적용구간 *</span><input data-validation-field="applicableZones" value={value.applicableZones.join(', ')} onChange={(event) => update(index, { applicableZones: splitValues(event.target.value) })} /></label>
            <label>
              <span>검토 상태 *</span>
              <select
                data-validation-field="verificationStatus"
                value={value.verificationStatus}
                onChange={(event) => {
                  const verificationStatus = event.target.value as VerifiedEngineeringValue['verificationStatus'];
                  update(index, {
                    verificationStatus,
                    ...(verificationStatus === 'unverified' ? {} : {
                      verifiedBy: reviewerName,
                      verifiedAt: new Date().toISOString(),
                    }),
                  });
                }}
              >
                <option value="unverified">미검토</option>
                <option value="reviewed">검토완료</option>
                <option value="approved">승인</option>
              </select>
            </label>
          </fieldset>
        ))}
        {values.length === 0 && (
          <div className="cp-repeater-empty">
            <Wrench size={21} /><strong>구조 기준값이 없습니다</strong><p>구조검토서에서 확인한 현장 적용값을 추가하세요.</p>
            <button type="button" data-validation-field="engineeringValues" disabled={readOnly} onClick={add}><Plus size={13} /> 첫 기준값 추가</button>
          </div>
        )}
      </div>
    </section>
  );
}

type EquipmentProps = {
  items: EquipmentPlanItem[];
  zones: string[];
  workers: SafeWorkerDto[];
  readOnly?: boolean;
  onChange: (items: EquipmentPlanItem[]) => void;
};

export function ConstructionPlanEquipmentPanel({
  items,
  zones,
  workers,
  readOnly = false,
  onChange,
}: EquipmentProps) {
  const add = () => onChange([...items, {
    id: createId('equipment'),
    category: 'lifting',
    equipmentName: '',
    workZones: zones,
    plannedStages: [],
    controlMeasures: [],
  }]);
  const update = (id: string, patch: Partial<EquipmentPlanItem>) => onChange(
    items.map((item) => item.id === id ? { ...item, ...patch } : item),
  );
  const categoryLabels: Record<EquipmentPlanItem['category'], string> = {
    lifting: '양중장비',
    transport: '운반장비',
    'work-at-height': '고소작업장비',
    assembly: '조립·체결장비',
    measurement: '측정·검측장비',
  };
  const activeWorkers = workers.filter((worker) => worker.status === 'active');

  return (
    <section className="cp-section-data cp-technical-panel" data-validation-record-id="equipmentPlan">
      <div className="cp-panel-heading cp-panel-heading--bordered">
        <div><span className="cp-eyebrow">Equipment plan</span><h3>장비 사용계획</h3></div>
        <button type="button" className="cp-mini-add" data-validation-field="equipmentPlan" disabled={readOnly} onClick={add}><Plus size={13} /> 장비 추가</button>
      </div>
      <div className="cp-source-callout">
        <span className="cp-source-callout__icon"><Wrench size={14} /></span>
        <div><strong>예정 장비·단계·통제를 함께 관리합니다</strong><p>양중·운반·고소작업·조립·측정 장비별 제원, 작업구간, 예정단계와 통제대책을 기록합니다.</p></div>
      </div>
      <div className="cp-repeater-list">
        {items.map((item, index) => (
          <fieldset key={item.id} disabled={readOnly} data-validation-record-id={item.id}>
            <legend>
              <strong>{categoryLabels[item.category]} {index + 1}</strong>
              <button type="button" onClick={() => onChange(items.filter((candidate) => candidate.id !== item.id))} aria-label={`${item.equipmentName || '장비'} 삭제`}><Trash2 size={12} /></button>
            </legend>
            <label>
              <span>장비 분류 *</span>
              <select data-validation-field="category" value={item.category} onChange={(event) => update(item.id, { category: event.target.value as EquipmentPlanItem['category'] })}>
                {Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label><span>장비명 *</span><input data-validation-field="equipmentName" value={item.equipmentName} onChange={(event) => update(item.id, { equipmentName: event.target.value })} placeholder="현장에 투입할 장비명" /></label>
            <div className="cp-inline-fields">
              <label><span>모델{item.category === 'lifting' ? ' *' : ''}</span><input data-validation-field="model" value={item.model ?? ''} onChange={(event) => update(item.id, { model: event.target.value })} /></label>
              <label><span>등록번호</span><input data-validation-field="registrationNo" value={item.registrationNo ?? ''} onChange={(event) => update(item.id, { registrationNo: event.target.value })} /></label>
            </div>
            <div className="cp-inline-fields">
              <label><span>정격능력{item.category === 'lifting' ? ' *' : ''}</span><input data-validation-field="ratedCapacity" value={item.ratedCapacity ?? ''} onChange={(event) => update(item.id, { ratedCapacity: event.target.value })} placeholder="허용하중·작업높이 등" /></label>
              <label><span>작업반경{item.category === 'lifting' ? ' *' : ''}</span><input data-validation-field="workRadius" value={item.workRadius ?? ''} onChange={(event) => update(item.id, { workRadius: event.target.value })} placeholder="예: 12m" /></label>
            </div>
            <label><span>검사·인증 유효기간{item.category === 'lifting' ? ' *' : ''}</span><input data-validation-field="inspectionValidUntil" type="date" value={item.inspectionValidUntil ?? ''} onChange={(event) => update(item.id, { inspectionValidUntil: event.target.value })} /></label>
            <label><span>작업구간 *</span><input data-validation-field="workZones" value={item.workZones.join(', ')} onChange={(event) => update(item.id, { workZones: splitValues(event.target.value) })} placeholder={zones.join(', ')} /></label>
            <label><span>예정 작업단계 *</span><input data-validation-field="plannedStages" value={item.plannedStages.join(', ')} onChange={(event) => update(item.id, { plannedStages: splitValues(event.target.value) })} placeholder="자재반입, 설치, 타설, 해체" /></label>
            <label><span>장비 통제대책 *</span><textarea data-validation-field="controlMeasures" value={item.controlMeasures.join('\n')} onChange={(event) => update(item.id, { controlMeasures: splitValues(event.target.value) })} placeholder="대책을 줄바꿈하여 입력" /></label>
            <div className="cp-inline-fields">
              <label>
                <span>운전원</span>
                <select data-validation-field="operatorWorkerId" value={item.operatorWorkerId ?? ''} onChange={(event) => update(item.id, { operatorWorkerId: event.target.value || undefined })}>
                  <option value="">선택</option>
                  {activeWorkers.map((worker) => <option key={worker.id} value={worker.id}>{worker.name}</option>)}
                </select>
              </label>
              <label>
                <span>신호수·유도자</span>
                <select data-validation-field="signalerWorkerId" value={item.signalerWorkerId ?? ''} onChange={(event) => update(item.id, { signalerWorkerId: event.target.value || undefined })}>
                  <option value="">선택</option>
                  {activeWorkers.map((worker) => <option key={worker.id} value={worker.id}>{worker.name}</option>)}
                </select>
              </label>
            </div>
          </fieldset>
        ))}
        {items.length === 0 && (
          <div className="cp-repeater-empty">
            <Wrench size={21} /><strong>장비 사용계획이 없습니다</strong><p>현장 투입 장비와 작업단계·통제대책을 등록하세요.</p>
            <button type="button" data-validation-field="equipmentPlan" disabled={readOnly} onClick={add}><Plus size={13} /> 첫 장비 추가</button>
          </div>
        )}
      </div>
    </section>
  );
}
