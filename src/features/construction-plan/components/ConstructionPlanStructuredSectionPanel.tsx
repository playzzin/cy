import React from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ListChecks,
  Lock,
  Plus,
  Trash2,
} from 'lucide-react';
import type { PlanSection, SafeWorkerDto, StructuredSectionKey } from '../types';
import {
  isStructuredSectionKey,
  normalizeStructuredSectionContent,
  validateStructuredSectionContent,
} from '../types';

const createId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

type Option = { value: string; label: string };
type FieldDefinition = {
  key: string;
  label: string;
  required?: boolean;
  kind: 'text' | 'textarea' | 'date' | 'datetime' | 'select' | 'worker' | 'worker-list' | 'zone-list' | 'string-list' | 'decision' | 'number';
  options?: Option[];
  help?: string;
};
type RepeaterDefinition = {
  key: string;
  label: string;
  itemLabel: string;
  addLabel: string;
  fields: FieldDefinition[];
  create: (index: number) => Record<string, unknown>;
};
type SectionConfig = {
  eyebrow: string;
  description: string;
  fields: FieldDefinition[];
  repeaters: RepeaterDefinition[];
};

const requiredText = (key: string, label: string, help?: string): FieldDefinition => ({
  key, label, help, required: true, kind: 'text',
});
const requiredList = (key: string, label: string, help?: string): FieldDefinition => ({
  key, label, help, required: true, kind: 'string-list',
});
const sequenceFields: FieldDefinition[] = [
  { key: 'sequence', label: '순서', required: true, kind: 'number' },
  requiredText('activity', '작업내용'),
  requiredText('responsibleRole', '담당 역할'),
  { key: 'workZones', label: '작업구간', required: true, kind: 'zone-list' },
  { key: 'prerequisites', label: '선행조건', kind: 'string-list' },
  requiredList('acceptanceCriteria', '완료·검측 기준'),
];

const SECTION_CONFIGS: Record<StructuredSectionKey, SectionConfig> = {
  'material-plan': {
    eyebrow: 'Material logistics',
    description: '승인 자재의 규격·반입검수·보관 통제와 실제 반입 동선을 자재별로 관리합니다.',
    fields: [
      { key: 'applicableZones', label: '적용구간', required: true, kind: 'zone-list' },
      requiredText('deliveryRoute', '반입동선'),
      requiredText('unloadingMethod', '하역방법'),
      { key: 'responsibleWorkerId', label: '자재계획 담당자', required: true, kind: 'worker' },
    ],
    repeaters: [{
      key: 'materials', label: '승인 자재·반입계획', itemLabel: '자재', addLabel: '자재 추가',
      create: () => ({
        id: createId('material'), materialName: '', specification: '', approvalReference: '',
        plannedQuantity: '', unit: '', deliveryPeriod: '', inspectionCriteria: [],
        storageLocation: '', storageControls: [],
      }),
      fields: [
        requiredText('materialName', '자재명'),
        requiredText('specification', '규격·등급'),
        requiredText('approvalReference', '승인근거'),
        { key: 'plannedQuantity', label: '계획수량', kind: 'text' },
        { key: 'unit', label: '단위', kind: 'text' },
        { key: 'deliveryPeriod', label: '반입 예정기간', kind: 'text' },
        requiredList('inspectionCriteria', '반입검수 기준'),
        requiredText('storageLocation', '보관위치'),
        requiredList('storageControls', '보관 통제대책'),
      ],
    }],
  },
  'equipment-signal': {
    eyebrow: 'Signal & access control',
    description: '장비작업 상황별 신호와 발·수신 역할, 신호수, 출입통제 및 비상정지 신호를 확정합니다.',
    fields: [
      { key: 'applicableZones', label: '통제 적용구간', required: true, kind: 'zone-list' },
      { key: 'signalerWorkerIds', label: '신호수·유도자', required: true, kind: 'worker-list' },
      { key: 'signalMethod', label: '주 신호방법', required: true, kind: 'select', options: [
        { value: 'hand', label: '수신호' }, { value: 'radio', label: '무전' },
        { value: 'combined', label: '수신호+무전' }, { value: 'other', label: '기타 표준신호' },
      ] },
      { key: 'communicationChannel', label: '무전 채널·호출명', kind: 'text' },
      requiredList('accessControlMeasures', '출입통제 대책'),
      requiredText('emergencyStopSignal', '비상정지 신호'),
    ],
    repeaters: [{
      key: 'signalProtocols', label: '상황별 신호체계', itemLabel: '신호', addLabel: '신호 추가',
      create: () => ({ id: createId('signal'), situation: '', signal: '', issuerRole: '', receiverRole: '' }),
      fields: [
        requiredText('situation', '작업상황'), requiredText('signal', '표준 신호'),
        requiredText('issuerRole', '발신 역할'), requiredText('receiverRole', '수신 역할'),
      ],
    }],
  },
  'site-installation-plan': {
    eyebrow: 'Installation method',
    description: '승인도면을 기준으로 구간별 설치 순서, 선행조건, 검측점과 기상 중지기준을 연결합니다.',
    fields: [
      { key: 'applicableZones', label: '설치 적용구간', required: true, kind: 'zone-list' },
      requiredList('drawingReferences', '적용 승인도면'),
      requiredList('prerequisites', '설치 선행조건'),
      requiredList('inspectionPoints', '설치 검측항목'),
      requiredList('weatherStopCriteria', '기상 작업중지 기준'),
    ],
    repeaters: [{
      key: 'workSequence', label: '구간별 설치 순서', itemLabel: '설치 단계', addLabel: '설치 단계 추가',
      create: (index) => ({ id: createId('install-step'), sequence: index + 1, activity: '', responsibleRole: '', workZones: [], prerequisites: [], acceptanceCriteria: [] }),
      fields: sequenceFields,
    }],
  },
  'concrete-pour-plan': {
    eyebrow: 'Concrete placement',
    description: '구간별 타설 순서·속도·펌프 위치와 집중하중 통제, 관찰주기 및 즉시 중지기준을 관리합니다.',
    fields: [
      { key: 'applicableZones', label: '타설 적용구간', required: true, kind: 'zone-list' },
      requiredText('designStrength', '설계기준강도'),
      { key: 'pourMethod', label: '타설방법', required: true, kind: 'select', options: [
        { value: 'pump', label: '콘크리트 펌프' }, { value: 'crane-bucket', label: '크레인 버킷' },
        { value: 'direct', label: '직접 타설' }, { value: 'other', label: '기타 승인 공법' },
      ] },
      { key: 'plannedPourDate', label: '계획 타설일', kind: 'date' },
      requiredText('pourRate', '계획 타설속도'),
      requiredList('concentratedLoadControls', '집중하중 통제대책'),
      requiredText('monitoringFrequency', '타설 중 점검주기'),
      requiredList('stopCriteria', '타설 중지 기준'),
    ],
    repeaters: [{
      key: 'pourSequence', label: '구간별 타설 순서', itemLabel: '타설 구간', addLabel: '타설 구간 추가',
      create: (index) => ({ id: createId('pour-step'), sequence: index + 1, zone: '', volume: '', pumpPosition: '', monitoringItems: [] }),
      fields: [
        { key: 'sequence', label: '순서', required: true, kind: 'number' },
        requiredText('zone', '타설구간'), requiredText('volume', '계획물량'),
        requiredText('pumpPosition', '펌프·호스 위치'), requiredList('monitoringItems', '계측·관찰항목'),
      ],
    }],
  },
  'dismantling-plan': {
    eyebrow: 'Dismantling control',
    description: '강도확인과 해체승인을 선행조건으로 묶고 구간별 역순해체·안정대책·통제구역을 관리합니다.',
    fields: [
      { key: 'applicableZones', label: '해체 적용구간', required: true, kind: 'zone-list' },
      requiredText('strengthEvidenceReference', '강도확인 근거'),
      requiredText('approvalReference', '해체 승인근거'),
      requiredList('prerequisites', '해체 선행조건'),
      requiredList('temporaryStabilityMeasures', '해체 중 안정대책'),
      requiredList('exclusionZones', '해체 통제구역'),
      requiredText('materialLoweringMethod', '자재 하강방법'),
      { key: 'responsibleWorkerId', label: '해체 책임자', required: true, kind: 'worker' },
    ],
    repeaters: [{
      key: 'workSequence', label: '구간별 해체 순서', itemLabel: '해체 단계', addLabel: '해체 단계 추가',
      create: (index) => ({ id: createId('dismantle-step'), sequence: index + 1, activity: '', responsibleRole: '', workZones: [], prerequisites: [], acceptanceCriteria: [] }),
      fields: sequenceFields,
    }],
  },
  'retention-plan': {
    eyebrow: 'Retention & change control',
    description: '존치·재동바리의 해제조건과 증빙을 구간별로 기록하고 기술 재검토·도면 Rev. 변경 기준을 명시합니다.',
    fields: [
      { key: 'applicableZones', label: '존치 적용구간', required: true, kind: 'zone-list' },
      requiredText('inspectionFrequency', '존치상태 점검주기'),
      requiredText('markingMethod', '존치구간 현장 표시방법'),
      requiredList('changeTriggers', '변경관리 재검토 조건'),
      requiredList('changeApprovalRoles', '변경 승인 역할'),
      { key: 'drawingRevisionRequired', label: '변경 시 도면 Rev. 갱신', required: true, kind: 'decision' },
      { key: 'engineeringReviewRequired', label: '변경 시 기술 재검토', required: true, kind: 'decision' },
    ],
    repeaters: [{
      key: 'retentionZones', label: '존치·재동바리 구간', itemLabel: '존치구간', addLabel: '존치구간 추가',
      create: () => ({ id: createId('retention'), zone: '', retainUntilCondition: '', releaseEvidence: '', reshoringRequired: null, reshoringSpecification: '' }),
      fields: [
        requiredText('zone', '구간'), requiredText('retainUntilCondition', '존치 해제조건'),
        requiredText('releaseEvidence', '해제 판단 증빙'),
        { key: 'reshoringRequired', label: '재동바리 필요', required: true, kind: 'decision' },
        { key: 'reshoringSpecification', label: '재동바리 사양·배치', kind: 'text' },
      ],
    }],
  },
  'emergency-plan': {
    eyebrow: 'Emergency response',
    description: '실제 연락 가능한 비상연락망과 사고유형별 초동조치·대피동선·집결지·지휘역할을 연결합니다.',
    fields: [
      { key: 'applicableZones', label: '적용구간', required: true, kind: 'zone-list' },
      requiredText('alarmMethod', '경보·전파방법'),
      requiredText('nearestHospital', '후송병원·경로'),
      requiredList('emergencyEquipment', '비상장비·구조장비'),
      requiredList('reportingChain', '사고 보고체계'),
    ],
    repeaters: [
      {
        key: 'contacts', label: '비상연락망', itemLabel: '연락처', addLabel: '연락처 추가',
        create: () => ({ id: createId('contact'), organization: '', name: '', phone: '', role: '' }),
        fields: [requiredText('organization', '기관·조직'), requiredText('name', '담당자'), requiredText('phone', '전화번호'), requiredText('role', '비상 역할')],
      },
      {
        key: 'scenarios', label: '사고유형별 대응', itemLabel: '비상상황', addLabel: '비상상황 추가',
        create: () => ({ id: createId('emergency'), scenario: '', initialActions: [], evacuationRoute: '', assemblyPoint: '', responsibleRole: '' }),
        fields: [requiredText('scenario', '사고유형'), requiredList('initialActions', '초동조치'), requiredText('evacuationRoute', '대피동선'), requiredText('assemblyPoint', '집결지'), requiredText('responsibleRole', '지휘역할')],
      },
    ],
  },
  'quality-plan': {
    eyebrow: 'Quality assurance',
    description: '작업단계별 검측과 Hold Point의 요구 증빙·담당 역할·완료조건·명시적 결정을 관리합니다. 반려는 검토·발행을 차단하며, 조건부 승인은 10자 이상의 구체적인 조건·조치 의견이 있어야 합니다. 이 결정은 계획상 통제기록이며 문서 승인이나 실제 시공결과에서 자동 합격 처리되지 않습니다.',
    fields: [
      { key: 'applicableZones', label: '품질관리 적용구간', required: true, kind: 'zone-list' },
      requiredList('nonconformanceProcess', '부적합 발견·조치·재검 절차'),
      requiredText('recordsRetentionMethod', '품질기록 보존방법'),
    ],
    repeaters: [
      {
        key: 'inspectionItems', label: '공정별 검측계획', itemLabel: '검측항목', addLabel: '검측항목 추가',
        create: () => ({ id: createId('inspection'), stage: '', item: '', criterion: '', method: '', frequency: '', responsibleRole: '', recordForm: '' }),
        fields: [requiredText('stage', '작업단계'), requiredText('item', '검측항목'), requiredText('criterion', '판정기준'), requiredText('method', '검측방법'), requiredText('frequency', '빈도'), requiredText('responsibleRole', '담당역할'), requiredText('recordForm', '기록양식')],
      },
      {
        key: 'holdPoints', label: 'Hold Point', itemLabel: 'Hold Point', addLabel: 'Hold Point 추가',
        create: () => ({ id: createId('hold-point'), stage: '', evidence: '', responsibleRole: '', completionCondition: '', decisionStatus: 'pending', decisionAt: '', decisionComment: '' }),
        fields: [
          requiredText('stage', '중지·승인 단계'),
          requiredText('evidence', '요구 증빙'),
          requiredText('responsibleRole', '담당 역할'),
          requiredText('completionCondition', '완료조건'),
          {
            key: 'decisionStatus', label: '계획상 결정', required: true, kind: 'select',
            help: '반려·작업중지는 검토·발행할 수 없습니다. 조치 후 승인 또는 구체 조건을 기록한 조건부 승인으로 변경하세요.',
            options: [
              { value: 'pending', label: '결정 필요' },
              { value: 'approved', label: '승인' },
              { value: 'conditional', label: '조건부 승인' },
              { value: 'rejected', label: '반려·작업중지' },
            ],
          },
          { key: 'decisionAt', label: '결정시각', required: true, kind: 'datetime' },
          { key: 'decisionComment', label: '결정 의견·조건', required: true, kind: 'textarea', help: '조건부 승인은 이행할 조건·조치·재확인 기준을 10자 이상 구체적으로 기록해야 합니다.' },
        ],
      },
    ],
  },
  'safety-plan': {
    eyebrow: 'Site safety control',
    description: '안전 책임자, 작업단계별 보호구, TBM, 추락·낙하·출입통제와 즉시 작업중지 기준을 관리합니다.',
    fields: [
      { key: 'applicableZones', label: '안전관리 적용구간', required: true, kind: 'zone-list' },
      { key: 'supervisorWorkerIds', label: '안전관리 책임자', required: true, kind: 'worker-list' },
      requiredList('toolboxTopics', 'TBM 교육주제'),
      requiredList('accessControlMeasures', '출입통제 대책'),
      requiredList('fallPreventionMeasures', '추락방지 대책'),
      requiredList('fallingObjectPreventionMeasures', '낙하물방지 대책'),
      requiredList('stopWorkCriteria', '즉시 작업중지 기준'),
      { key: 'permitTypes', label: '필요 작업허가', kind: 'string-list' },
    ],
    repeaters: [{
      key: 'ppeRequirements', label: '작업단계별 개인보호구', itemLabel: '보호구', addLabel: '보호구 기준 추가',
      create: () => ({ id: createId('ppe'), workStage: '', item: '', standard: '' }),
      fields: [requiredText('workStage', '작업단계'), requiredText('item', '보호구 품목'), requiredText('standard', '착용·성능 기준')],
    }],
  },
  'work-platform-access-plan': {
    eyebrow: 'Platform & access',
    description: '비계 작업발판의 유효폭·재질·적재하중과 안전난간, 발끝막이판, 승강통로 및 개구부 통제를 구조화합니다.',
    fields: [
      { key: 'applicableZones', label: '적용구간', required: true, kind: 'zone-list' },
      requiredText('platformWidth', '작업발판 유효폭'),
      requiredText('platformMaterial', '작업발판 재질·규격'),
      requiredText('platformLoadLimit', '작업발판 적재하중'),
      requiredList('guardrailMeasures', '안전난간 설치대책'),
      requiredList('toeBoardMeasures', '발끝막이판 설치대책'),
      { key: 'accessType', label: '승강통로 형식', required: true, kind: 'select', options: [
        { value: 'stair', label: '계단' }, { value: 'ladder', label: '사다리' },
        { value: 'tower', label: '승강타워' }, { value: 'combined', label: '복합' },
        { value: 'other', label: '기타 승인 형식' },
      ] },
      requiredList('accessLocations', '승강통로 위치'),
      requiredList('openingControls', '개구부 통제대책'),
      requiredList('inspectionPoints', '발판·승강통로 검측항목'),
      { key: 'responsibleWorkerId', label: '발판·승강통로 담당자', required: true, kind: 'worker' },
    ],
    repeaters: [],
  },
  'inspection-maintenance-plan': {
    eyebrow: 'Inspection & maintenance',
    description: '시스템비계 사용 중 점검주기, 벽이음·작업발판 점검, 결함조치, 기상 재점검과 변경 승인을 관리합니다.',
    fields: [
      { key: 'applicableZones', label: '적용구간', required: true, kind: 'zone-list' },
      requiredText('inspectionFrequency', '사용 중 점검주기'),
      requiredList('inspectionItems', '사용 중 점검항목'),
      requiredList('wallTieChecks', '벽이음 점검항목'),
      requiredList('platformChecks', '작업발판 점검항목'),
      requiredList('defectResponse', '결함 발견 시 조치'),
      requiredList('weatherStopCriteria', '기상 작업중지·재점검 기준'),
      requiredList('alterationApprovalRoles', '변경 승인 역할'),
      requiredText('recordsRetentionMethod', '점검기록 보존방법'),
      { key: 'responsibleWorkerId', label: '점검·보수 책임자', required: true, kind: 'worker' },
    ],
    repeaters: [],
  },
  'environment-plan': {
    eyebrow: 'Environmental control',
    description: '작업별 환경영향과 통제·모니터링 책임을 연결하고 폐기물·먼지·소음·유출·민원 대응을 관리합니다.',
    fields: [
      { key: 'applicableZones', label: '환경관리 적용구간', required: true, kind: 'zone-list' },
      requiredList('wasteSegregation', '폐기물 분리·반출대책'),
      requiredList('dustControls', '비산먼지 대책'),
      requiredList('noiseControls', '소음·진동 대책'),
      requiredList('spillResponse', '유류·오염물 유출 대응'),
      requiredText('complaintContact', '환경민원 연락처'),
      requiredText('monitoringFrequency', '환경점검 주기'),
    ],
    repeaters: [{
      key: 'aspects', label: '작업별 환경영향 관리', itemLabel: '환경항목', addLabel: '환경항목 추가',
      create: () => ({ id: createId('environment'), activity: '', impact: '', controlMeasure: '', monitoringMethod: '', responsibleRole: '' }),
      fields: [requiredText('activity', '작업'), requiredText('impact', '예상 영향'), requiredText('controlMeasure', '통제대책'), requiredText('monitoringMethod', '확인방법'), requiredText('responsibleRole', '담당역할')],
    }],
  },
};

type Props = {
  section: PlanSection;
  zones: string[];
  workers: SafeWorkerDto[];
  readOnly?: boolean;
  onChange: (section: PlanSection, immediate?: boolean) => void;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
const asRows = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.map(asRecord) : [];
const asStrings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

type FieldEditorProps = {
  field: FieldDefinition;
  value: unknown;
  zones: string[];
  workers: SafeWorkerDto[];
  disabled: boolean;
  onChange: (value: unknown) => void;
};

function StringListEditor({ label, value, disabled, onChange }: {
  label: string;
  value: unknown;
  disabled: boolean;
  onChange: (value: string[]) => void;
}) {
  const items = asStrings(value);
  return (
    <div className="cp-structured-list" aria-label={label}>
      {items.map((item, index) => (
        <div className="cp-structured-list__row" key={index}>
          <input
            aria-label={`${label} ${index + 1}`}
            value={item}
            disabled={disabled}
            onChange={(event) => onChange(items.map((candidate, itemIndex) => itemIndex === index ? event.target.value : candidate))}
          />
          <button type="button" disabled={disabled} onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))} aria-label={`${label} ${index + 1} 삭제`}><Trash2 size={12} /></button>
        </div>
      ))}
      <button type="button" className="cp-structured-list__add" disabled={disabled} onClick={() => onChange([...items, ''])}><Plus size={12} /> 항목 추가</button>
    </div>
  );
}

function ChoiceListEditor({ label, value, options, disabled, onChange }: {
  label: string;
  value: unknown;
  options: Option[];
  disabled: boolean;
  onChange: (value: string[]) => void;
}) {
  const selected = asStrings(value);
  const mergedOptions = [
    ...options,
    ...selected.filter((id) => !options.some((option) => option.value === id)).map((id) => ({ value: id, label: `기존 연결 (${id})` })),
  ];
  return (
    <div className="cp-structured-choices" aria-label={label}>
      {mergedOptions.length === 0 && <p>선택 가능한 현장 데이터가 없습니다.</p>}
      {mergedOptions.map((option) => (
        <label key={option.value}>
          <input
            type="checkbox"
            checked={selected.includes(option.value)}
            disabled={disabled}
            onChange={(event) => onChange(event.target.checked
              ? Array.from(new Set([...selected, option.value]))
              : selected.filter((candidate) => candidate !== option.value))}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  );
}

function FieldEditor({ field, value, zones, workers, disabled, onChange }: FieldEditorProps) {
  if (field.kind === 'string-list') {
    return <StringListEditor label={field.label} value={value} disabled={disabled} onChange={onChange} />;
  }
  if (field.kind === 'zone-list') {
    return <ChoiceListEditor label={field.label} value={value} disabled={disabled} onChange={onChange} options={zones.map((zone) => ({ value: zone, label: zone }))} />;
  }
  if (field.kind === 'worker-list') {
    return <ChoiceListEditor label={field.label} value={value} disabled={disabled} onChange={onChange} options={workers.filter((worker) => worker.status === 'active').map((worker) => ({ value: worker.id, label: `${worker.name}${worker.role ? ` · ${worker.role}` : ''}` }))} />;
  }
  if (field.kind === 'worker') {
    const current = typeof value === 'string' ? value : '';
    const activeWorkers = workers.filter((worker) => worker.status === 'active');
    return (
      <select value={current} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        <option value="">선택 필요</option>
        {current && !activeWorkers.some((worker) => worker.id === current) && <option value={current}>기존 연결 ({current})</option>}
        {activeWorkers.map((worker) => <option key={worker.id} value={worker.id}>{worker.name}{worker.role ? ` · ${worker.role}` : ''}</option>)}
      </select>
    );
  }
  if (field.kind === 'select') {
    return <select value={typeof value === 'string' ? value : ''} disabled={disabled} onChange={(event) => onChange(event.target.value || null)}><option value="">선택 필요</option>{field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>;
  }
  if (field.kind === 'decision') {
    const current = typeof value === 'boolean' ? String(value) : '';
    return <select value={current} disabled={disabled} onChange={(event) => onChange(event.target.value === '' ? null : event.target.value === 'true')}><option value="">결정 필요</option><option value="true">필요</option><option value="false">불필요</option></select>;
  }
  if (field.kind === 'number') {
    return <input type="number" min={1} value={typeof value === 'number' ? value : ''} disabled={disabled} onChange={(event) => onChange(Math.max(1, Number(event.target.value) || 1))} />;
  }
  if (field.kind === 'datetime') {
    const date = typeof value === 'string' && value ? new Date(value) : undefined;
    const localValue = date && !Number.isNaN(date.getTime())
      ? new Date(date.getTime() - (date.getTimezoneOffset() * 60_000)).toISOString().slice(0, 16)
      : '';
    return <input type="datetime-local" value={localValue} disabled={disabled} onChange={(event) => {
      const next = event.target.value ? new Date(event.target.value) : undefined;
      onChange(next && !Number.isNaN(next.getTime()) ? next.toISOString() : '');
    }} />;
  }
  if (field.kind === 'textarea') {
    return <textarea value={typeof value === 'string' ? value : ''} disabled={disabled} onChange={(event) => onChange(event.target.value)} />;
  }
  return <input type={field.kind === 'date' ? 'date' : 'text'} value={typeof value === 'string' ? value : ''} disabled={disabled} onChange={(event) => onChange(event.target.value)} />;
}

function StructuredField({ field, value, zones, workers, disabled, onChange }: FieldEditorProps) {
  const editor = <FieldEditor field={field} value={value} zones={zones} workers={workers} disabled={disabled} onChange={onChange} />;
  const label = <span>{field.label}{field.required ? ' *' : ''}</span>;
  const composite = field.kind === 'string-list'
    || field.kind === 'zone-list'
    || field.kind === 'worker-list';
  return composite ? (
    <div className="cp-structured-field" data-validation-field={field.key}>{label}{editor}{field.help && <small>{field.help}</small>}</div>
  ) : (
    <label className="cp-structured-field" data-validation-field={field.key}>{label}{editor}{field.help && <small>{field.help}</small>}</label>
  );
}

export function ConstructionPlanStructuredSectionPanel({ section, zones, workers, readOnly = false, onChange }: Props) {
  if (!isStructuredSectionKey(section.key)) return null;
  const config = SECTION_CONFIGS[section.key];
  const content = asRecord(normalizeStructuredSectionContent(section.key, section.content));
  const missing = validateStructuredSectionContent(section.key, content);
  const legacyContent = [
    { label: '기존 적용범위', value: content.scope },
    { label: '기존 섹션 요약', value: content.summary },
    { label: '기존 현장별 시공 내용', value: content.body },
  ].filter((item): item is { label: string; value: string } =>
    typeof item.value === 'string' && item.value.trim().length > 0);

  const updateContent = (patch: Record<string, unknown>, immediate = false) => {
    const nextSection: PlanSection = {
      ...section,
      content: { ...section.content, ...patch, structuredDataVersion: 1 },
      status: section.status === 'empty' ? 'in_progress' : section.status,
    };
    onChange(nextSection, immediate);
  };
  const updateRows = (definition: RepeaterDefinition, rows: Record<string, unknown>[]) => {
    const persistedRows = definition.key === 'holdPoints'
      ? rows.map((row) => Object.fromEntries(
        Object.entries(row).filter(([key]) => key !== 'approverRole'),
      ))
      : rows;
    updateContent({ [definition.key]: persistedRows });
  };

  return (
    <section className="cp-section-data cp-technical-panel cp-structured-panel" data-validation-record-id={section.id}>
      <div className="cp-panel-heading cp-panel-heading--bordered">
        <div><span className="cp-eyebrow">{config.eyebrow}</span><h3>{section.title}</h3></div>
        <span className={`cp-completion-chip cp-completion-chip--${missing.length === 0 ? 'complete' : 'in_progress'}`}>
          {missing.length === 0 ? '필수값 충족' : `${missing.length}개 누락`}
        </span>
      </div>
      <div className="cp-source-callout"><span className="cp-source-callout__icon"><ListChecks size={14} /></span><div><strong>현장별 구조화 데이터</strong><p>{config.description}</p></div></div>
      {legacyContent.length > 0 && <details className="cp-structured-legacy"><summary>기존 자유서술 기록 {legacyContent.length}건</summary>{legacyContent.map((item) => <div key={item.label}><strong>{item.label}</strong><p>{item.value}</p></div>)}</details>}
      <div className="cp-data-form cp-structured-form">
        <label><span>섹션 상태</span><div className="cp-select-wrap"><select data-validation-field="status" value={section.status} disabled={readOnly} onChange={(event) => onChange({ ...section, status: event.target.value as PlanSection['status'] }, true)}><option value="empty">미작성</option><option value="in_progress">작성 중</option><option value="complete">완료</option>{!section.required && <option value="not_applicable">해당없음</option>}</select><ChevronDown size={15} /></div></label>
        {section.status === 'not_applicable' && <label><span>해당없음 사유 *</span><textarea data-validation-field="notApplicableReason" value={section.notApplicableReason ?? ''} disabled={readOnly} onChange={(event) => onChange({ ...section, notApplicableReason: event.target.value })} placeholder="적용되지 않는 현장 조건과 확인 근거를 기록하세요." /></label>}
        {config.fields.map((field) => <StructuredField key={field.key} field={field} value={content[field.key]} zones={zones} workers={workers} disabled={readOnly} onChange={(value) => updateContent({ [field.key]: value })} />)}
      </div>
      {config.repeaters.map((definition) => {
        const rows = asRows(content[definition.key]);
        return (
          <div className="cp-structured-repeater" key={definition.key} data-validation-collection={definition.key} data-validation-field={definition.key}>
            <div className="cp-structured-repeater__heading"><strong>{definition.label} *</strong>{rows.length > 0 && <button type="button" className="cp-mini-add" disabled={readOnly} onClick={() => updateRows(definition, [...rows, definition.create(rows.length)])}><Plus size={13} /> {definition.addLabel}</button>}</div>
            <div className="cp-repeater-list">
              {rows.map((row, index) => (
                <fieldset key={typeof row.id === 'string' && row.id ? row.id : `${definition.key}-${index}`} disabled={readOnly} data-validation-record-id={typeof row.id === 'string' && row.id ? row.id : `${definition.key}-${index}`} data-validation-row-index={index}>
                  <legend><strong>{definition.itemLabel} {index + 1}</strong><button type="button" onClick={() => updateRows(definition, rows.filter((_, rowIndex) => rowIndex !== index))} aria-label={`${definition.itemLabel} ${index + 1} 삭제`}><Trash2 size={12} /></button></legend>
                  {definition.fields.map((field) => <StructuredField
                    key={field.key}
                    field={field}
                    value={row[field.key]}
                    zones={zones}
                    workers={workers}
                    disabled={readOnly}
                    onChange={(value) => updateRows(definition, rows.map((candidate, rowIndex) => rowIndex === index ? { ...candidate, [field.key]: value } : candidate))}
                  />)}
                </fieldset>
              ))}
              {rows.length === 0 && <div className="cp-repeater-empty"><ListChecks size={21} /><strong>{definition.label}이 없습니다</strong><p>현장 적용 데이터를 항목별로 등록하세요.</p><button type="button" disabled={readOnly} onClick={() => updateRows(definition, [definition.create(0)])}><Plus size={13} /> {definition.addLabel}</button></div>}
            </div>
          </div>
        );
      })}
      {missing.length > 0 && section.status === 'complete' && (
        <div className="cp-structured-missing" role="alert"><AlertCircle size={15} /><div><strong>완료 상태이지만 필수 데이터가 누락되었습니다.</strong><p>{missing.slice(0, 6).map((issue) => issue.label).join(', ')}{missing.length > 6 ? ` 외 ${missing.length - 6}개` : ''}</p></div></div>
      )}
      {missing.length === 0 && <div className="cp-structured-ready"><CheckCircle2 size={14} /> 구조화 필수값이 모두 입력되었습니다.</div>}
      {section.standardTextModified && <div className="cp-standard-warning"><AlertCircle size={15} /><div><strong>표준 문구가 수정되었습니다</strong><p>{section.standardTextModificationReason || '변경 사유를 입력하고 검토자 확인을 받아야 합니다.'}</p></div></div>}
      {readOnly && <div className="cp-readonly-notice"><Lock size={14} /> 현재 문서는 조회전용입니다. 발행본은 수정할 수 없습니다.</div>}
    </section>
  );
}

export default ConstructionPlanStructuredSectionPanel;
