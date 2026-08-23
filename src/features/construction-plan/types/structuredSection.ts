import { z } from 'zod';

const text = () => z.string().catch('').default('');
const textList = () => z.array(z.string()).catch([]).default([]);
const nullableDecision = () => z.boolean().nullable().catch(null).default(null);

export const STRUCTURED_SECTION_KEYS = [
  'material-plan',
  'equipment-signal',
  'site-installation-plan',
  'concrete-pour-plan',
  'dismantling-plan',
  'retention-plan',
  'emergency-plan',
  'quality-plan',
  'safety-plan',
  'environment-plan',
  'work-platform-access-plan',
  'inspection-maintenance-plan',
] as const;

export const StructuredSectionKeySchema = z.enum(STRUCTURED_SECTION_KEYS);
export type StructuredSectionKey = z.infer<typeof StructuredSectionKeySchema>;

const StructuredContentBaseSchema = z.object({
  structuredDataVersion: z.literal(1).catch(1).default(1),
  applicableZones: textList(),
}).passthrough();

export const MaterialPlanItemSchema = z.object({
  id: text(),
  materialName: text(),
  specification: text(),
  approvalReference: text(),
  plannedQuantity: text(),
  unit: text(),
  deliveryPeriod: text(),
  inspectionCriteria: textList(),
  storageLocation: text(),
  storageControls: textList(),
}).passthrough();

export const MaterialPlanContentSchema = StructuredContentBaseSchema.extend({
  materials: z.array(MaterialPlanItemSchema).catch([]).default([]),
  deliveryRoute: text(),
  unloadingMethod: text(),
  responsibleWorkerId: text(),
}).passthrough();

export const SignalProtocolItemSchema = z.object({
  id: text(),
  situation: text(),
  signal: text(),
  issuerRole: text(),
  receiverRole: text(),
}).passthrough();

export const EquipmentSignalContentSchema = StructuredContentBaseSchema.extend({
  signalerWorkerIds: textList(),
  signalMethod: z.enum(['hand', 'radio', 'combined', 'other']).nullable().catch(null).default(null),
  communicationChannel: text(),
  signalProtocols: z.array(SignalProtocolItemSchema).catch([]).default([]),
  accessControlMeasures: textList(),
  emergencyStopSignal: text(),
}).passthrough();

export const WorkSequenceItemSchema = z.object({
  id: text(),
  sequence: z.number().int().positive().catch(1).default(1),
  activity: text(),
  responsibleRole: text(),
  workZones: textList(),
  prerequisites: textList(),
  acceptanceCriteria: textList(),
}).passthrough();

export const InstallationPlanContentSchema = StructuredContentBaseSchema.extend({
  drawingReferences: textList(),
  prerequisites: textList(),
  workSequence: z.array(WorkSequenceItemSchema).catch([]).default([]),
  inspectionPoints: textList(),
  weatherStopCriteria: textList(),
}).passthrough();

export const ConcretePourSequenceItemSchema = z.object({
  id: text(),
  sequence: z.number().int().positive().catch(1).default(1),
  zone: text(),
  volume: text(),
  pumpPosition: text(),
  monitoringItems: textList(),
}).passthrough();

export const ConcretePourPlanContentSchema = StructuredContentBaseSchema.extend({
  designStrength: text(),
  pourMethod: z.enum(['pump', 'crane-bucket', 'direct', 'other']).nullable().catch(null).default(null),
  plannedPourDate: text(),
  pourRate: text(),
  pourSequence: z.array(ConcretePourSequenceItemSchema).catch([]).default([]),
  concentratedLoadControls: textList(),
  monitoringFrequency: text(),
  stopCriteria: textList(),
}).passthrough();

export const DismantlingPlanContentSchema = StructuredContentBaseSchema.extend({
  strengthEvidenceReference: text(),
  approvalReference: text(),
  prerequisites: textList(),
  workSequence: z.array(WorkSequenceItemSchema).catch([]).default([]),
  temporaryStabilityMeasures: textList(),
  exclusionZones: textList(),
  materialLoweringMethod: text(),
  responsibleWorkerId: text(),
}).passthrough();

export const RetentionZoneItemSchema = z.object({
  id: text(),
  zone: text(),
  retainUntilCondition: text(),
  releaseEvidence: text(),
  reshoringRequired: nullableDecision(),
  reshoringSpecification: text(),
}).passthrough();

export const RetentionPlanContentSchema = StructuredContentBaseSchema.extend({
  retentionZones: z.array(RetentionZoneItemSchema).catch([]).default([]),
  inspectionFrequency: text(),
  markingMethod: text(),
  changeTriggers: textList(),
  changeApprovalRoles: textList(),
  drawingRevisionRequired: nullableDecision(),
  engineeringReviewRequired: nullableDecision(),
}).passthrough();

export const EmergencyContactItemSchema = z.object({
  id: text(),
  organization: text(),
  name: text(),
  phone: text(),
  role: text(),
}).passthrough();

export const EmergencyScenarioItemSchema = z.object({
  id: text(),
  scenario: text(),
  initialActions: textList(),
  evacuationRoute: text(),
  assemblyPoint: text(),
  responsibleRole: text(),
}).passthrough();

export const EmergencyPlanContentSchema = StructuredContentBaseSchema.extend({
  contacts: z.array(EmergencyContactItemSchema).catch([]).default([]),
  scenarios: z.array(EmergencyScenarioItemSchema).catch([]).default([]),
  alarmMethod: text(),
  nearestHospital: text(),
  emergencyEquipment: textList(),
  reportingChain: textList(),
}).passthrough();

export const QualityInspectionItemSchema = z.object({
  id: text(),
  stage: text(),
  item: text(),
  criterion: text(),
  method: text(),
  frequency: text(),
  responsibleRole: text(),
  recordForm: text(),
}).passthrough();

export const QualityHoldPointItemSchema = z.object({
  id: text(),
  stage: text(),
  evidence: text(),
  responsibleRole: text(),
  completionCondition: text(),
  decisionStatus: z.enum(['pending', 'approved', 'conditional', 'rejected']).catch('pending').default('pending'),
  decisionAt: text(),
  decisionComment: text(),
  // Legacy read boundary only. New editor writes use `responsibleRole`.
  approverRole: text().optional(),
}).passthrough();

export const HOLD_POINT_CONDITIONAL_COMMENT_MIN_LENGTH = 10;

export const QualityPlanContentSchema = StructuredContentBaseSchema.extend({
  inspectionItems: z.array(QualityInspectionItemSchema).catch([]).default([]),
  holdPoints: z.array(QualityHoldPointItemSchema).catch([]).default([]),
  nonconformanceProcess: textList(),
  recordsRetentionMethod: text(),
}).passthrough();

export const PpeRequirementItemSchema = z.object({
  id: text(),
  workStage: text(),
  item: text(),
  standard: text(),
}).passthrough();

export const SafetyPlanContentSchema = StructuredContentBaseSchema.extend({
  supervisorWorkerIds: textList(),
  toolboxTopics: textList(),
  ppeRequirements: z.array(PpeRequirementItemSchema).catch([]).default([]),
  accessControlMeasures: textList(),
  fallPreventionMeasures: textList(),
  fallingObjectPreventionMeasures: textList(),
  stopWorkCriteria: textList(),
  permitTypes: textList(),
}).passthrough();

export const EnvironmentAspectItemSchema = z.object({
  id: text(),
  activity: text(),
  impact: text(),
  controlMeasure: text(),
  monitoringMethod: text(),
  responsibleRole: text(),
}).passthrough();

export const EnvironmentPlanContentSchema = StructuredContentBaseSchema.extend({
  aspects: z.array(EnvironmentAspectItemSchema).catch([]).default([]),
  wasteSegregation: textList(),
  dustControls: textList(),
  noiseControls: textList(),
  spillResponse: textList(),
  complaintContact: text(),
  monitoringFrequency: text(),
}).passthrough();

export const WorkPlatformAccessPlanContentSchema = StructuredContentBaseSchema.extend({
  platformWidth: text(),
  platformMaterial: text(),
  platformLoadLimit: text(),
  guardrailMeasures: textList(),
  toeBoardMeasures: textList(),
  accessType: z.enum(['stair', 'ladder', 'tower', 'combined', 'other']).nullable().catch(null).default(null),
  accessLocations: textList(),
  openingControls: textList(),
  inspectionPoints: textList(),
  responsibleWorkerId: text(),
}).passthrough();

export const InspectionMaintenancePlanContentSchema = StructuredContentBaseSchema.extend({
  inspectionFrequency: text(),
  inspectionItems: textList(),
  defectResponse: textList(),
  weatherStopCriteria: textList(),
  alterationApprovalRoles: textList(),
  wallTieChecks: textList(),
  platformChecks: textList(),
  recordsRetentionMethod: text(),
  responsibleWorkerId: text(),
}).passthrough();

export const STRUCTURED_SECTION_SCHEMAS = {
  'material-plan': MaterialPlanContentSchema,
  'equipment-signal': EquipmentSignalContentSchema,
  'site-installation-plan': InstallationPlanContentSchema,
  'concrete-pour-plan': ConcretePourPlanContentSchema,
  'dismantling-plan': DismantlingPlanContentSchema,
  'retention-plan': RetentionPlanContentSchema,
  'emergency-plan': EmergencyPlanContentSchema,
  'quality-plan': QualityPlanContentSchema,
  'safety-plan': SafetyPlanContentSchema,
  'environment-plan': EnvironmentPlanContentSchema,
  'work-platform-access-plan': WorkPlatformAccessPlanContentSchema,
  'inspection-maintenance-plan': InspectionMaintenancePlanContentSchema,
} as const;

export type StructuredSectionContentMap = {
  [K in StructuredSectionKey]: z.infer<(typeof STRUCTURED_SECTION_SCHEMAS)[K]>;
};

export type StructuredSectionContent = StructuredSectionContentMap[StructuredSectionKey];

export type StructuredSectionValidationIssue = {
  path: string;
  label: string;
};

const hasText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const nonEmptyList = (value: unknown): value is unknown[] => Array.isArray(value)
  && value.some((item) => typeof item === 'string' ? hasText(item) : item !== null && item !== undefined);

export const isStructuredSectionKey = (value: string): value is StructuredSectionKey =>
  StructuredSectionKeySchema.safeParse(value).success;

/**
 * Parses the fields owned by a structured section while retaining legacy and
 * future keys. This keeps previously saved `scope`, `summary`, and `body`
 * values round-trippable instead of destructively migrating them on edit.
 */
export const normalizeStructuredSectionContent = <K extends StructuredSectionKey>(
  key: K,
  value: unknown,
): StructuredSectionContentMap[K] => {
  const sourceRecord = typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const record = key === 'quality-plan' && Array.isArray(sourceRecord.holdPoints)
    ? {
      ...sourceRecord,
      holdPoints: sourceRecord.holdPoints.map((entry) => {
        if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return entry;
        const row = entry as Record<string, unknown>;
        return typeof row.responsibleRole === 'string' && row.responsibleRole.trim()
          ? row
          : { ...row, responsibleRole: typeof row.approverRole === 'string' ? row.approverRole : '' };
      }),
    }
    : sourceRecord;
  return STRUCTURED_SECTION_SCHEMAS[key].parse(record) as StructuredSectionContentMap[K];
};

const requireText = (
  issues: StructuredSectionValidationIssue[],
  value: unknown,
  path: string,
  label: string,
) => {
  if (!hasText(value)) issues.push({ path, label });
};

const requireList = (
  issues: StructuredSectionValidationIssue[],
  value: unknown,
  path: string,
  label: string,
) => {
  if (!nonEmptyList(value)) issues.push({ path, label });
};

const validateSequence = (
  issues: StructuredSectionValidationIssue[],
  rows: Array<z.infer<typeof WorkSequenceItemSchema>>,
  path: string,
  label: string,
) => {
  requireList(issues, rows, path, label);
  rows.forEach((row, index) => {
    requireText(issues, row.activity, `${path}.${index}.activity`, `${label} ${index + 1} 작업내용`);
    requireText(issues, row.responsibleRole, `${path}.${index}.responsibleRole`, `${label} ${index + 1} 담당역할`);
    requireList(issues, row.workZones, `${path}.${index}.workZones`, `${label} ${index + 1} 작업구간`);
    requireList(issues, row.acceptanceCriteria, `${path}.${index}.acceptanceCriteria`, `${label} ${index + 1} 완료기준`);
  });
};

export const validateStructuredSectionContent = (
  key: StructuredSectionKey,
  value: unknown,
): StructuredSectionValidationIssue[] => {
  const content = normalizeStructuredSectionContent(key, value) as Record<string, unknown>;
  const issues: StructuredSectionValidationIssue[] = [];
  requireList(issues, content.applicableZones, 'applicableZones', '적용구간');

  switch (key) {
    case 'material-plan': {
      const parsed = normalizeStructuredSectionContent(key, value);
      requireList(issues, parsed.materials, 'materials', '자재계획');
      parsed.materials.forEach((item, index) => {
        requireText(issues, item.materialName, `materials.${index}.materialName`, `자재 ${index + 1} 자재명`);
        requireText(issues, item.specification, `materials.${index}.specification`, `자재 ${index + 1} 규격`);
        requireText(issues, item.approvalReference, `materials.${index}.approvalReference`, `자재 ${index + 1} 승인근거`);
        requireList(issues, item.inspectionCriteria, `materials.${index}.inspectionCriteria`, `자재 ${index + 1} 반입검수 기준`);
        requireText(issues, item.storageLocation, `materials.${index}.storageLocation`, `자재 ${index + 1} 보관위치`);
        requireList(issues, item.storageControls, `materials.${index}.storageControls`, `자재 ${index + 1} 보관 통제대책`);
      });
      requireText(issues, parsed.deliveryRoute, 'deliveryRoute', '반입동선');
      requireText(issues, parsed.unloadingMethod, 'unloadingMethod', '하역방법');
      requireText(issues, parsed.responsibleWorkerId, 'responsibleWorkerId', '자재계획 담당자');
      break;
    }
    case 'equipment-signal': {
      const parsed = normalizeStructuredSectionContent(key, value);
      requireList(issues, parsed.signalerWorkerIds, 'signalerWorkerIds', '신호수/유도자');
      if (!parsed.signalMethod) issues.push({ path: 'signalMethod', label: '신호방법' });
      requireList(issues, parsed.signalProtocols, 'signalProtocols', '상황별 신호체계');
      parsed.signalProtocols.forEach((item, index) => {
        requireText(issues, item.situation, `signalProtocols.${index}.situation`, `신호체계 ${index + 1} 상황`);
        requireText(issues, item.signal, `signalProtocols.${index}.signal`, `신호체계 ${index + 1} 신호`);
        requireText(issues, item.issuerRole, `signalProtocols.${index}.issuerRole`, `신호체계 ${index + 1} 발신 역할`);
        requireText(issues, item.receiverRole, `signalProtocols.${index}.receiverRole`, `신호체계 ${index + 1} 수신 역할`);
      });
      requireList(issues, parsed.accessControlMeasures, 'accessControlMeasures', '출입통제 대책');
      requireText(issues, parsed.emergencyStopSignal, 'emergencyStopSignal', '비상정지 신호');
      break;
    }
    case 'site-installation-plan': {
      const parsed = normalizeStructuredSectionContent(key, value);
      requireList(issues, parsed.drawingReferences, 'drawingReferences', '적용 승인도면');
      requireList(issues, parsed.prerequisites, 'prerequisites', '설치 선행조건');
      validateSequence(issues, parsed.workSequence, 'workSequence', '설치 순서');
      requireList(issues, parsed.inspectionPoints, 'inspectionPoints', '설치 검측항목');
      requireList(issues, parsed.weatherStopCriteria, 'weatherStopCriteria', '기상 작업중지 기준');
      break;
    }
    case 'concrete-pour-plan': {
      const parsed = normalizeStructuredSectionContent(key, value);
      requireText(issues, parsed.designStrength, 'designStrength', '설계기준강도');
      if (!parsed.pourMethod) issues.push({ path: 'pourMethod', label: '타설방법' });
      requireText(issues, parsed.pourRate, 'pourRate', '계획 타설속도');
      requireList(issues, parsed.pourSequence, 'pourSequence', '타설 순서');
      parsed.pourSequence.forEach((item, index) => {
        requireText(issues, item.zone, `pourSequence.${index}.zone`, `타설 순서 ${index + 1} 구간`);
        requireText(issues, item.volume, `pourSequence.${index}.volume`, `타설 순서 ${index + 1} 물량`);
        requireText(issues, item.pumpPosition, `pourSequence.${index}.pumpPosition`, `타설 순서 ${index + 1} 펌프 위치`);
        requireList(issues, item.monitoringItems, `pourSequence.${index}.monitoringItems`, `타설 순서 ${index + 1} 계측·관찰항목`);
      });
      requireList(issues, parsed.concentratedLoadControls, 'concentratedLoadControls', '집중하중 통제대책');
      requireText(issues, parsed.monitoringFrequency, 'monitoringFrequency', '타설 중 점검주기');
      requireList(issues, parsed.stopCriteria, 'stopCriteria', '타설 중지 기준');
      break;
    }
    case 'dismantling-plan': {
      const parsed = normalizeStructuredSectionContent(key, value);
      requireText(issues, parsed.strengthEvidenceReference, 'strengthEvidenceReference', '강도확인 근거');
      requireText(issues, parsed.approvalReference, 'approvalReference', '해체 승인근거');
      requireList(issues, parsed.prerequisites, 'prerequisites', '해체 선행조건');
      validateSequence(issues, parsed.workSequence, 'workSequence', '해체 순서');
      requireList(issues, parsed.temporaryStabilityMeasures, 'temporaryStabilityMeasures', '해체 중 안정대책');
      requireList(issues, parsed.exclusionZones, 'exclusionZones', '해체 통제구역');
      requireText(issues, parsed.materialLoweringMethod, 'materialLoweringMethod', '자재 하강방법');
      requireText(issues, parsed.responsibleWorkerId, 'responsibleWorkerId', '해체 책임자');
      break;
    }
    case 'retention-plan': {
      const parsed = normalizeStructuredSectionContent(key, value);
      requireList(issues, parsed.retentionZones, 'retentionZones', '존치/재동바리 구간');
      parsed.retentionZones.forEach((item, index) => {
        requireText(issues, item.zone, `retentionZones.${index}.zone`, `존치구간 ${index + 1} 구간`);
        requireText(issues, item.retainUntilCondition, `retentionZones.${index}.retainUntilCondition`, `존치구간 ${index + 1} 해제조건`);
        requireText(issues, item.releaseEvidence, `retentionZones.${index}.releaseEvidence`, `존치구간 ${index + 1} 해제근거`);
        if (item.reshoringRequired === null) issues.push({ path: `retentionZones.${index}.reshoringRequired`, label: `존치구간 ${index + 1} 재동바리 여부` });
        if (item.reshoringRequired) requireText(issues, item.reshoringSpecification, `retentionZones.${index}.reshoringSpecification`, `존치구간 ${index + 1} 재동바리 사양`);
      });
      requireText(issues, parsed.inspectionFrequency, 'inspectionFrequency', '존치상태 점검주기');
      requireText(issues, parsed.markingMethod, 'markingMethod', '존치구간 표시방법');
      requireList(issues, parsed.changeTriggers, 'changeTriggers', '변경관리 재검토 조건');
      requireList(issues, parsed.changeApprovalRoles, 'changeApprovalRoles', '변경 승인 역할');
      if (parsed.drawingRevisionRequired === null) issues.push({ path: 'drawingRevisionRequired', label: '도면 Rev. 갱신 여부' });
      if (parsed.engineeringReviewRequired === null) issues.push({ path: 'engineeringReviewRequired', label: '기술 재검토 여부' });
      break;
    }
    case 'emergency-plan': {
      const parsed = normalizeStructuredSectionContent(key, value);
      requireList(issues, parsed.contacts, 'contacts', '비상연락망');
      parsed.contacts.forEach((item, index) => {
        requireText(issues, item.organization, `contacts.${index}.organization`, `연락망 ${index + 1} 기관/조직`);
        requireText(issues, item.name, `contacts.${index}.name`, `연락망 ${index + 1} 담당자`);
        requireText(issues, item.phone, `contacts.${index}.phone`, `연락망 ${index + 1} 전화번호`);
        requireText(issues, item.role, `contacts.${index}.role`, `연락망 ${index + 1} 역할`);
      });
      requireList(issues, parsed.scenarios, 'scenarios', '비상상황별 조치계획');
      parsed.scenarios.forEach((item, index) => {
        requireText(issues, item.scenario, `scenarios.${index}.scenario`, `비상상황 ${index + 1} 유형`);
        requireList(issues, item.initialActions, `scenarios.${index}.initialActions`, `비상상황 ${index + 1} 초동조치`);
        requireText(issues, item.evacuationRoute, `scenarios.${index}.evacuationRoute`, `비상상황 ${index + 1} 대피동선`);
        requireText(issues, item.assemblyPoint, `scenarios.${index}.assemblyPoint`, `비상상황 ${index + 1} 집결지`);
        requireText(issues, item.responsibleRole, `scenarios.${index}.responsibleRole`, `비상상황 ${index + 1} 지휘역할`);
      });
      requireText(issues, parsed.alarmMethod, 'alarmMethod', '경보/전파방법');
      requireText(issues, parsed.nearestHospital, 'nearestHospital', '후송병원');
      requireList(issues, parsed.emergencyEquipment, 'emergencyEquipment', '비상장비');
      requireList(issues, parsed.reportingChain, 'reportingChain', '보고체계');
      break;
    }
    case 'quality-plan': {
      const parsed = normalizeStructuredSectionContent(key, value);
      requireList(issues, parsed.inspectionItems, 'inspectionItems', '품질 검측계획');
      parsed.inspectionItems.forEach((item, index) => {
        requireText(issues, item.stage, `inspectionItems.${index}.stage`, `검측 ${index + 1} 단계`);
        requireText(issues, item.item, `inspectionItems.${index}.item`, `검측 ${index + 1} 항목`);
        requireText(issues, item.criterion, `inspectionItems.${index}.criterion`, `검측 ${index + 1} 판정기준`);
        requireText(issues, item.method, `inspectionItems.${index}.method`, `검측 ${index + 1} 방법`);
        requireText(issues, item.frequency, `inspectionItems.${index}.frequency`, `검측 ${index + 1} 빈도`);
        requireText(issues, item.responsibleRole, `inspectionItems.${index}.responsibleRole`, `검측 ${index + 1} 담당역할`);
        requireText(issues, item.recordForm, `inspectionItems.${index}.recordForm`, `검측 ${index + 1} 기록양식`);
      });
      requireList(issues, parsed.holdPoints, 'holdPoints', 'Hold Point');
      parsed.holdPoints.forEach((item, index) => {
        requireText(issues, item.stage, `holdPoints.${index}.stage`, `Hold Point ${index + 1} 단계`);
        requireText(issues, item.evidence, `holdPoints.${index}.evidence`, `Hold Point ${index + 1} 증빙`);
        requireText(issues, item.responsibleRole, `holdPoints.${index}.responsibleRole`, `Hold Point ${index + 1} 담당역할`);
        requireText(issues, item.completionCondition, `holdPoints.${index}.completionCondition`, `Hold Point ${index + 1} 완료조건`);
        if (item.decisionStatus === 'pending') {
          issues.push({ path: `holdPoints.${index}.decisionStatus`, label: `Hold Point ${index + 1} 결정상태` });
        } else if (item.decisionStatus === 'rejected') {
          issues.push({ path: `holdPoints.${index}.decisionStatus`, label: `Hold Point ${index + 1} 반려 해소 및 승인` });
        }
        requireText(issues, item.decisionAt, `holdPoints.${index}.decisionAt`, `Hold Point ${index + 1} 결정시각`);
        const parsedDecisionAt = item.decisionAt ? new Date(item.decisionAt) : undefined;
        if (item.decisionAt && (!parsedDecisionAt
          || Number.isNaN(parsedDecisionAt.getTime())
          || parsedDecisionAt.toISOString() !== item.decisionAt)) {
          issues.push({ path: `holdPoints.${index}.decisionAt`, label: `Hold Point ${index + 1} 올바른 결정시각` });
        }
        requireText(issues, item.decisionComment, `holdPoints.${index}.decisionComment`, `Hold Point ${index + 1} 결정의견`);
        const decisionComment = item.decisionComment.trim();
        if (item.decisionStatus === 'conditional'
          && decisionComment.length > 0
          && decisionComment.length < HOLD_POINT_CONDITIONAL_COMMENT_MIN_LENGTH) {
          issues.push({
            path: `holdPoints.${index}.decisionComment`,
            label: `Hold Point ${index + 1} 조건부 승인 조건(${HOLD_POINT_CONDITIONAL_COMMENT_MIN_LENGTH}자 이상)`,
          });
        }
      });
      requireList(issues, parsed.nonconformanceProcess, 'nonconformanceProcess', '부적합 처리절차');
      requireText(issues, parsed.recordsRetentionMethod, 'recordsRetentionMethod', '품질기록 보존방법');
      break;
    }
    case 'safety-plan': {
      const parsed = normalizeStructuredSectionContent(key, value);
      requireList(issues, parsed.supervisorWorkerIds, 'supervisorWorkerIds', '안전관리 책임자');
      requireList(issues, parsed.toolboxTopics, 'toolboxTopics', 'TBM 교육주제');
      requireList(issues, parsed.ppeRequirements, 'ppeRequirements', '개인보호구 계획');
      parsed.ppeRequirements.forEach((item, index) => {
        requireText(issues, item.workStage, `ppeRequirements.${index}.workStage`, `보호구 ${index + 1} 작업단계`);
        requireText(issues, item.item, `ppeRequirements.${index}.item`, `보호구 ${index + 1} 품목`);
        requireText(issues, item.standard, `ppeRequirements.${index}.standard`, `보호구 ${index + 1} 적용기준`);
      });
      requireList(issues, parsed.accessControlMeasures, 'accessControlMeasures', '출입통제 대책');
      requireList(issues, parsed.fallPreventionMeasures, 'fallPreventionMeasures', '추락방지 대책');
      requireList(issues, parsed.fallingObjectPreventionMeasures, 'fallingObjectPreventionMeasures', '낙하물방지 대책');
      requireList(issues, parsed.stopWorkCriteria, 'stopWorkCriteria', '작업중지 기준');
      break;
    }
    case 'environment-plan': {
      const parsed = normalizeStructuredSectionContent(key, value);
      requireList(issues, parsed.aspects, 'aspects', '환경영향 관리항목');
      parsed.aspects.forEach((item, index) => {
        requireText(issues, item.activity, `aspects.${index}.activity`, `환경항목 ${index + 1} 작업`);
        requireText(issues, item.impact, `aspects.${index}.impact`, `환경항목 ${index + 1} 영향`);
        requireText(issues, item.controlMeasure, `aspects.${index}.controlMeasure`, `환경항목 ${index + 1} 통제대책`);
        requireText(issues, item.monitoringMethod, `aspects.${index}.monitoringMethod`, `환경항목 ${index + 1} 확인방법`);
        requireText(issues, item.responsibleRole, `aspects.${index}.responsibleRole`, `환경항목 ${index + 1} 담당역할`);
      });
      requireList(issues, parsed.wasteSegregation, 'wasteSegregation', '폐기물 분리·반출대책');
      requireList(issues, parsed.dustControls, 'dustControls', '비산먼지 대책');
      requireList(issues, parsed.noiseControls, 'noiseControls', '소음·진동 대책');
      requireList(issues, parsed.spillResponse, 'spillResponse', '유출사고 대응');
      requireText(issues, parsed.complaintContact, 'complaintContact', '환경민원 연락처');
      requireText(issues, parsed.monitoringFrequency, 'monitoringFrequency', '환경점검 주기');
      break;
    }
    case 'work-platform-access-plan': {
      const parsed = normalizeStructuredSectionContent(key, value);
      requireText(issues, parsed.platformWidth, 'platformWidth', '작업발판 유효폭');
      requireText(issues, parsed.platformMaterial, 'platformMaterial', '작업발판 재질·규격');
      requireText(issues, parsed.platformLoadLimit, 'platformLoadLimit', '작업발판 적재하중');
      requireList(issues, parsed.guardrailMeasures, 'guardrailMeasures', '안전난간 설치대책');
      requireList(issues, parsed.toeBoardMeasures, 'toeBoardMeasures', '발끝막이판 설치대책');
      if (!parsed.accessType) issues.push({ path: 'accessType', label: '승강통로 형식' });
      requireList(issues, parsed.accessLocations, 'accessLocations', '승강통로 위치');
      requireList(issues, parsed.openingControls, 'openingControls', '개구부 통제대책');
      requireList(issues, parsed.inspectionPoints, 'inspectionPoints', '발판·승강통로 검측항목');
      requireText(issues, parsed.responsibleWorkerId, 'responsibleWorkerId', '발판·승강통로 담당자');
      break;
    }
    case 'inspection-maintenance-plan': {
      const parsed = normalizeStructuredSectionContent(key, value);
      requireText(issues, parsed.inspectionFrequency, 'inspectionFrequency', '사용 중 점검주기');
      requireList(issues, parsed.inspectionItems, 'inspectionItems', '사용 중 점검항목');
      requireList(issues, parsed.defectResponse, 'defectResponse', '결함 발견 시 조치');
      requireList(issues, parsed.weatherStopCriteria, 'weatherStopCriteria', '기상 작업중지·재점검 기준');
      requireList(issues, parsed.alterationApprovalRoles, 'alterationApprovalRoles', '변경 승인 역할');
      requireList(issues, parsed.wallTieChecks, 'wallTieChecks', '벽이음 점검항목');
      requireList(issues, parsed.platformChecks, 'platformChecks', '작업발판 점검항목');
      requireText(issues, parsed.recordsRetentionMethod, 'recordsRetentionMethod', '점검기록 보존방법');
      requireText(issues, parsed.responsibleWorkerId, 'responsibleWorkerId', '점검·보수 책임자');
      break;
    }
  }

  return issues;
};

export type MaterialPlanContent = z.infer<typeof MaterialPlanContentSchema>;
export type EquipmentSignalContent = z.infer<typeof EquipmentSignalContentSchema>;
export type InstallationPlanContent = z.infer<typeof InstallationPlanContentSchema>;
export type ConcretePourPlanContent = z.infer<typeof ConcretePourPlanContentSchema>;
export type DismantlingPlanContent = z.infer<typeof DismantlingPlanContentSchema>;
export type RetentionPlanContent = z.infer<typeof RetentionPlanContentSchema>;
export type EmergencyPlanContent = z.infer<typeof EmergencyPlanContentSchema>;
export type QualityPlanContent = z.infer<typeof QualityPlanContentSchema>;
export type SafetyPlanContent = z.infer<typeof SafetyPlanContentSchema>;
export type EnvironmentPlanContent = z.infer<typeof EnvironmentPlanContentSchema>;
export type WorkPlatformAccessPlanContent = z.infer<typeof WorkPlatformAccessPlanContentSchema>;
export type InspectionMaintenancePlanContent = z.infer<typeof InspectionMaintenancePlanContentSchema>;
