import React from 'react';
import type { PlanSection, StructuredSectionKey } from '../types';
import { normalizeStructuredSectionContent } from '../types';

type PreviewRow = { label: string; value: string };

const valueText = (value: unknown, fallback = '미등록'): string => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? '예' : '아니오';
  return fallback;
};

const listText = (value: unknown, fallback = '미등록'): string => Array.isArray(value)
  ? value.map((item) => valueText(item, '')).filter(Boolean).join(' · ') || fallback
  : fallback;

const numbered = (index: number, label: string): string => `${index + 1}. ${label}`;

const rowsForSection = (key: StructuredSectionKey, raw: unknown): PreviewRow[] => {
  switch (key) {
    case 'material-plan': {
      const content = normalizeStructuredSectionContent(key, raw);
      return [
        { label: '반입동선·하역', value: `${valueText(content.deliveryRoute)} / ${valueText(content.unloadingMethod)}` },
        { label: '담당자', value: valueText(content.responsibleWorkerId) },
        ...content.materials.map((item, index) => ({
          label: numbered(index, valueText(item.materialName, '자재')),
          value: `${valueText(item.specification)} · ${valueText(item.plannedQuantity, '-')} ${valueText(item.unit, '')} · 승인 ${valueText(item.approvalReference)} · 반입 ${valueText(item.deliveryPeriod)} · 검수 ${listText(item.inspectionCriteria)} · 보관 ${valueText(item.storageLocation)} / ${listText(item.storageControls)}`,
        })),
      ];
    }
    case 'equipment-signal': {
      const content = normalizeStructuredSectionContent(key, raw);
      return [
        { label: '신호수·유도자', value: listText(content.signalerWorkerIds) },
        { label: '신호방법·통신', value: `${valueText(content.signalMethod)} / ${valueText(content.communicationChannel)}` },
        { label: '비상정지 신호', value: valueText(content.emergencyStopSignal) },
        { label: '출입통제', value: listText(content.accessControlMeasures) },
        ...content.signalProtocols.map((item, index) => ({
          label: numbered(index, valueText(item.situation, '신호 상황')),
          value: `${valueText(item.signal)} · 발신 ${valueText(item.issuerRole)} → 수신 ${valueText(item.receiverRole)}`,
        })),
      ];
    }
    case 'site-installation-plan': {
      const content = normalizeStructuredSectionContent(key, raw);
      return [
        { label: '승인도면', value: listText(content.drawingReferences) },
        { label: '선행조건', value: listText(content.prerequisites) },
        ...content.workSequence.map((item, index) => ({
          label: `${item.sequence || index + 1}단계 · ${valueText(item.activity, '설치작업')}`,
          value: `담당 ${valueText(item.responsibleRole)} · 구간 ${listText(item.workZones)} · 선행 ${listText(item.prerequisites)} · 완료 ${listText(item.acceptanceCriteria)}`,
        })),
        { label: '검측항목', value: listText(content.inspectionPoints) },
        { label: '기상 중지기준', value: listText(content.weatherStopCriteria) },
      ];
    }
    case 'concrete-pour-plan': {
      const content = normalizeStructuredSectionContent(key, raw);
      return [
        { label: '설계강도·타설방법', value: `${valueText(content.designStrength)} / ${valueText(content.pourMethod)}` },
        { label: '계획일·타설속도', value: `${valueText(content.plannedPourDate)} / ${valueText(content.pourRate)}` },
        ...content.pourSequence.map((item, index) => ({
          label: `${item.sequence || index + 1}단계 · ${valueText(item.zone, '타설구간')}`,
          value: `물량 ${valueText(item.volume)} · 펌프 ${valueText(item.pumpPosition)} · 계측 ${listText(item.monitoringItems)}`,
        })),
        { label: '집중하중 통제', value: listText(content.concentratedLoadControls) },
        { label: '점검주기·중지조건', value: `${valueText(content.monitoringFrequency)} / ${listText(content.stopCriteria)}` },
      ];
    }
    case 'dismantling-plan': {
      const content = normalizeStructuredSectionContent(key, raw);
      return [
        { label: '강도·해체 승인근거', value: `${valueText(content.strengthEvidenceReference)} / ${valueText(content.approvalReference)}` },
        { label: '선행조건', value: listText(content.prerequisites) },
        ...content.workSequence.map((item, index) => ({
          label: `${item.sequence || index + 1}단계 · ${valueText(item.activity, '해체작업')}`,
          value: `담당 ${valueText(item.responsibleRole)} · 구간 ${listText(item.workZones)} · 완료 ${listText(item.acceptanceCriteria)}`,
        })),
        { label: '임시 안정·통제구역', value: `${listText(content.temporaryStabilityMeasures)} / ${listText(content.exclusionZones)}` },
        { label: '자재하강·책임자', value: `${valueText(content.materialLoweringMethod)} / ${valueText(content.responsibleWorkerId)}` },
      ];
    }
    case 'retention-plan': {
      const content = normalizeStructuredSectionContent(key, raw);
      return [
        ...content.retentionZones.map((item, index) => ({
          label: numbered(index, valueText(item.zone, '존치구간')),
          value: `해제 ${valueText(item.retainUntilCondition)} · 근거 ${valueText(item.releaseEvidence)} · 재동바리 ${valueText(item.reshoringRequired)} ${valueText(item.reshoringSpecification, '')}`,
        })),
        { label: '점검주기·표시방법', value: `${valueText(content.inspectionFrequency)} / ${valueText(content.markingMethod)}` },
        { label: '변경 재검토 조건', value: listText(content.changeTriggers) },
        { label: '승인역할', value: listText(content.changeApprovalRoles) },
        { label: '도면·기술 재검토', value: `도면 Rev. ${valueText(content.drawingRevisionRequired)} · 기술검토 ${valueText(content.engineeringReviewRequired)}` },
      ];
    }
    case 'emergency-plan': {
      const content = normalizeStructuredSectionContent(key, raw);
      return [
        { label: '경보·후송병원', value: `${valueText(content.alarmMethod)} / ${valueText(content.nearestHospital)}` },
        ...content.contacts.map((item, index) => ({ label: numbered(index, valueText(item.organization, '비상연락망')), value: `${valueText(item.name)} · ${valueText(item.role)} · ${valueText(item.phone)}` })),
        ...content.scenarios.map((item, index) => ({ label: numbered(index, valueText(item.scenario, '비상상황')), value: `초동 ${listText(item.initialActions)} · 대피 ${valueText(item.evacuationRoute)} → ${valueText(item.assemblyPoint)} · 지휘 ${valueText(item.responsibleRole)}` })),
        { label: '비상장비', value: listText(content.emergencyEquipment) },
        { label: '보고체계', value: listText(content.reportingChain) },
      ];
    }
    case 'quality-plan': {
      const content = normalizeStructuredSectionContent(key, raw);
      const decisionLabel = (value: string): string => ({
        pending: '결정 필요', approved: '승인', conditional: '조건부 승인', rejected: '반려·작업중지',
      }[value] ?? valueText(value));
      return [
        ...content.inspectionItems.map((item, index) => ({ label: numbered(index, `${valueText(item.stage)} · ${valueText(item.item)}`), value: `기준 ${valueText(item.criterion)} · 방법/빈도 ${valueText(item.method)} / ${valueText(item.frequency)} · 담당 ${valueText(item.responsibleRole)} · 기록 ${valueText(item.recordForm)}` })),
        ...content.holdPoints.map((item, index) => ({
          label: `Hold Point ${index + 1}`,
          value: `${valueText(item.stage)} · 요구 증빙 ${valueText(item.evidence)} · 담당 ${valueText(item.responsibleRole || item.approverRole)} · 완료조건 ${valueText(item.completionCondition)} · 계획상 결정 ${decisionLabel(item.decisionStatus)} · 결정시각 ${valueText(item.decisionAt)} · 의견 ${valueText(item.decisionComment)}`,
        })),
        { label: '부적합 처리', value: listText(content.nonconformanceProcess) },
        { label: '기록 보존', value: valueText(content.recordsRetentionMethod) },
      ];
    }
    case 'safety-plan': {
      const content = normalizeStructuredSectionContent(key, raw);
      return [
        { label: '안전관리 책임자', value: listText(content.supervisorWorkerIds) },
        { label: 'TBM 주제', value: listText(content.toolboxTopics) },
        ...content.ppeRequirements.map((item, index) => ({ label: numbered(index, valueText(item.workStage, '보호구')), value: `${valueText(item.item)} · ${valueText(item.standard)}` })),
        { label: '출입·추락 통제', value: `${listText(content.accessControlMeasures)} / ${listText(content.fallPreventionMeasures)}` },
        { label: '낙하물 방지', value: listText(content.fallingObjectPreventionMeasures) },
        { label: '작업중지 기준', value: listText(content.stopWorkCriteria) },
        { label: '작업허가', value: listText(content.permitTypes) },
      ];
    }
    case 'work-platform-access-plan': {
      const content = normalizeStructuredSectionContent(key, raw);
      const accessType = ({
        stair: '계단', ladder: '사다리', tower: '승강타워', combined: '복합', other: '기타',
      } as Record<string, string>)[String(content.accessType)] || '미등록';
      return [
        { label: '작업발판 규격', value: `유효폭 ${valueText(content.platformWidth)} · 재질·규격 ${valueText(content.platformMaterial)} · 적재하중 ${valueText(content.platformLoadLimit)}` },
        { label: '안전난간·발끝막이판', value: `${listText(content.guardrailMeasures)} / ${listText(content.toeBoardMeasures)}` },
        { label: '승강통로 형식·위치', value: `${accessType} · ${listText(content.accessLocations)}` },
        { label: '개구부 통제', value: listText(content.openingControls) },
        { label: '검측항목', value: listText(content.inspectionPoints) },
        { label: '담당자', value: valueText(content.responsibleWorkerId) },
      ];
    }
    case 'inspection-maintenance-plan': {
      const content = normalizeStructuredSectionContent(key, raw);
      return [
        { label: '사용 중 점검주기', value: valueText(content.inspectionFrequency) },
        { label: '사용 중 점검항목', value: listText(content.inspectionItems) },
        { label: '벽이음 점검항목', value: listText(content.wallTieChecks) },
        { label: '작업발판 점검항목', value: listText(content.platformChecks) },
        { label: '결함 발견 시 조치', value: listText(content.defectResponse) },
        { label: '기상 중지·재점검', value: listText(content.weatherStopCriteria) },
        { label: '변경 승인 역할', value: listText(content.alterationApprovalRoles) },
        { label: '기록 보존·책임자', value: `${valueText(content.recordsRetentionMethod)} · ${valueText(content.responsibleWorkerId)}` },
      ];
    }
    case 'environment-plan': {
      const content = normalizeStructuredSectionContent(key, raw);
      return [
        ...content.aspects.map((item, index) => ({ label: numbered(index, valueText(item.activity, '환경관리')), value: `영향 ${valueText(item.impact)} · 대책 ${valueText(item.controlMeasure)} · 확인 ${valueText(item.monitoringMethod)} · 담당 ${valueText(item.responsibleRole)}` })),
        { label: '폐기물·비산먼지', value: `${listText(content.wasteSegregation)} / ${listText(content.dustControls)}` },
        { label: '소음·유출 대응', value: `${listText(content.noiseControls)} / ${listText(content.spillResponse)}` },
        { label: '민원연락·점검주기', value: `${valueText(content.complaintContact)} / ${valueText(content.monitoringFrequency)}` },
      ];
    }
  }
};

const SECTION_SUBTITLES: Record<StructuredSectionKey, string> = {
  'material-plan': '자재별 승인·검수·반입·적치·보관 조건',
  'equipment-signal': '신호수·유도자·통제구역 및 비상정지 체계',
  'site-installation-plan': '승인도면 기준 설치 순서와 단계별 검측',
  'concrete-pour-plan': '구간별 타설 순서·속도·계측 및 중지조건',
  'dismantling-plan': '강도확인·승인·역순해체·반출·통제 계획',
  'retention-plan': '존치구간·해제근거 및 변경 재검토 계획',
  'emergency-plan': '비상연락·대피·구조·보고체계',
  'quality-plan': '검측·Hold Point·부적합·기록관리',
  'safety-plan': '작업단계별 안전·보호구·작업중지 기준',
  'work-platform-access-plan': '작업발판·안전난간·승강통로·개구부 통제 계획',
  'inspection-maintenance-plan': '사용 중 점검·결함조치·기상 재점검·변경관리',
  'environment-plan': '폐기물·비산먼지·소음·유출·민원 관리',
};

export function ConstructionPlanStructuredSectionPreview({
  section,
  sectionKey,
}: {
  section: PlanSection;
  sectionKey: StructuredSectionKey;
}) {
  const content = normalizeStructuredSectionContent(sectionKey, section.content);
  const rows = rowsForSection(sectionKey, section.content);
  return (
    <div className="cp-a4__structured-section">
      <p className="cp-a4__lead">{SECTION_SUBTITLES[sectionKey]}</p>
      <div className="cp-a4__data-summary cp-a4__structured-summary">
        <dl><dt>적용구간</dt><dd>{listText(content.applicableZones)}</dd></dl>
        <dl><dt>구조화 항목</dt><dd>{rows.length}건</dd></dl>
        <dl><dt>데이터 버전</dt><dd>v{content.structuredDataVersion}</dd></dl>
      </div>
      <table className="cp-a4__table cp-a4__structured-table">
        <thead><tr><th>구분</th><th>현장 적용 내용</th></tr></thead>
        <tbody>
          {rows.map((row, index) => <tr key={`${row.label}-${index}`}><td>{row.label}</td><td className="is-left">{row.value}</td></tr>)}
          {rows.length === 0 && <tr className="is-incomplete"><td colSpan={2}>등록된 구조화 계획이 없습니다.</td></tr>}
        </tbody>
      </table>
      <div className="cp-a4__data-note">※ 본 표의 각 값은 재사용 가능한 현장 데이터로 저장되며 검토·승인 후 발행 PDF와 동일한 원천을 사용한다.</div>
    </div>
  );
}

export default ConstructionPlanStructuredSectionPreview;
