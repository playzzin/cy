import type { StructuredSectionKey } from './structuredSection';
import {
  STRUCTURED_SECTION_KEYS,
  normalizeStructuredSectionContent,
  validateStructuredSectionContent,
} from './structuredSection';

const COMPLETE_STRUCTURED_SECTION_CONTENT: Record<StructuredSectionKey, unknown> = {
  'material-plan': {
    applicableZones: ['A구간'], deliveryRoute: '동문→지하 하역장', unloadingMethod: '지게차 하역', responsibleWorkerId: 'worker-1',
    materials: [{ id: 'm1', materialName: '수직재', specification: 'Ø60.5', approvalReference: '자재승인-01', plannedQuantity: '100', unit: '본', deliveryPeriod: '2026-09-01', inspectionCriteria: ['외관 및 치수'], storageLocation: 'A 적치장', storageControls: ['받침목 설치'] }],
  },
  'equipment-signal': {
    applicableZones: ['A구간'], signalerWorkerIds: ['worker-1'], signalMethod: 'combined', communicationChannel: 'CH 3', accessControlMeasures: ['통제원 배치'], emergencyStopSignal: '양팔 교차',
    signalProtocols: [{ id: 's1', situation: '인양 시작', signal: '오른팔 원회전', issuerRole: '신호수', receiverRole: '운전원' }],
  },
  'site-installation-plan': {
    applicableZones: ['A구간'], drawingReferences: ['D-01 Rev.5'], prerequisites: ['바닥 지지력 확인'], inspectionPoints: ['수직도'], weatherStopCriteria: ['풍속 10m/s 이상'],
    workSequence: [{ id: 'i1', sequence: 1, activity: '베이스 설치', responsibleRole: '작업반장', workZones: ['A구간'], prerequisites: ['먹매김'], acceptanceCriteria: ['레벨 확인'] }],
  },
  'concrete-pour-plan': {
    applicableZones: ['A구간'], designStrength: '24MPa', pourMethod: 'pump', plannedPourDate: '2026-09-10', pourRate: '20m³/h', concentratedLoadControls: ['호스 이동 분산'], monitoringFrequency: '30분', stopCriteria: ['변형 10mm 초과'],
    pourSequence: [{ id: 'p1', sequence: 1, zone: 'A-1', volume: '80m³', pumpPosition: '동측', monitoringItems: ['침하', '수직도'] }],
  },
  'dismantling-plan': {
    applicableZones: ['A구간'], strengthEvidenceReference: '압축강도-2026-01', approvalReference: '해체승인-01', prerequisites: ['상부 작업 종료'], temporaryStabilityMeasures: ['구간 분할 해체'], exclusionZones: ['A구간 하부'], materialLoweringMethod: '로프 하강 금지, 리프트 사용', responsibleWorkerId: 'worker-1',
    workSequence: [{ id: 'd1', sequence: 1, activity: '상부재 해체', responsibleRole: '작업반장', workZones: ['A구간'], prerequisites: ['해체 승인'], acceptanceCriteria: ['잔류 불안정부재 없음'] }],
  },
  'retention-plan': {
    applicableZones: ['A구간'], inspectionFrequency: '매일 작업 전', markingMethod: '적색 존치표찰', changeTriggers: ['타설순서 변경'], changeApprovalRoles: ['구조기술자', '현장책임자'], drawingRevisionRequired: true, engineeringReviewRequired: true,
    retentionZones: [{ id: 'r1', zone: 'A-1', retainUntilCondition: '설계강도 100%', releaseEvidence: '강도시험 성적서', reshoringRequired: true, reshoringSpecification: '900×900mm' }],
  },
  'emergency-plan': {
    applicableZones: ['A구간'], alarmMethod: '무전+사이렌', nearestHospital: '○○병원 응급실', emergencyEquipment: ['구급함', '들것'], reportingChain: ['발견자', '안전담당', '현장책임자'],
    contacts: [{ id: 'c1', organization: '현장', name: '홍길동', phone: '010-1234-5678', role: '안전담당' }],
    scenarios: [{ id: 'e1', scenario: '붕괴 징후', initialActions: ['즉시 작업중지', '통제구역 확대'], evacuationRoute: '동측 계단', assemblyPoint: '정문 집결지', responsibleRole: '현장책임자' }],
  },
  'quality-plan': {
    applicableZones: ['A구간'], nonconformanceProcess: ['부적합 표시', '원인조사', '재검'], recordsRetentionMethod: '현장 품질문서함 5년',
    inspectionItems: [{ id: 'q1', stage: '설치', item: '수직도', criterion: 'H/1000 이내', method: '레이저 레벨', frequency: '구간별', responsibleRole: '품질담당', recordForm: '설치검측표' }],
    holdPoints: [{ id: 'h1', stage: '타설 전', evidence: '설치검측표', responsibleRole: '품질담당', completionCondition: '검측 전 항목 적합', decisionStatus: 'approved', decisionAt: '2026-09-09T01:00:00.000Z', decisionComment: '타설 전 조건 충족 확인' }],
  },
  'safety-plan': {
    applicableZones: ['A구간'], supervisorWorkerIds: ['worker-1'], toolboxTopics: ['추락·낙하 예방'], accessControlMeasures: ['출입표지 설치'], fallPreventionMeasures: ['2중 안전대'], fallingObjectPreventionMeasures: ['공구 낙하방지끈'], stopWorkCriteria: ['풍속 10m/s 이상'], permitTypes: ['고소작업허가'],
    ppeRequirements: [{ id: 'ppe1', workStage: '설치', item: '안전대', standard: '2중 고리형' }],
  },
  'environment-plan': {
    applicableZones: ['A구간'], wasteSegregation: ['철재와 일반폐기물 분리'], dustControls: ['살수'], noiseControls: ['주간 작업'], spillResponse: ['흡착포 설치 후 회수'], complaintContact: '현장사무실 02-000-0000', monitoringFrequency: '일 2회',
    aspects: [{ id: 'a1', activity: '자재 절단', impact: '소음', controlMeasure: '방음막', monitoringMethod: '소음계', responsibleRole: '환경담당' }],
  },
  'work-platform-access-plan': {
    applicableZones: ['외부 A면'], platformWidth: '400mm 이상', platformMaterial: '승인 강재발판', platformLoadLimit: '400kg 이하',
    guardrailMeasures: ['상·중간난간 연속 설치'], toeBoardMeasures: ['발끝막이판 연속 설치'], accessType: 'stair',
    accessLocations: ['동측 1개소'], openingControls: ['출입구 자동폐쇄'], inspectionPoints: ['고정·틈새·단차 확인'], responsibleWorkerId: 'worker-1',
  },
  'inspection-maintenance-plan': {
    applicableZones: ['외부 A면'], inspectionFrequency: '작업 전 및 강풍 후', inspectionItems: ['기초·수직도·체결'],
    defectResponse: ['사용중지·보수·재검측'], weatherStopCriteria: ['강풍·호우 후 재점검'], alterationApprovalRoles: ['현장책임자·안전담당'],
    wallTieChecks: ['앵커·클램프 이완'], platformChecks: ['고정·파손·틈새'], recordsRetentionMethod: '일일점검표 보존', responsibleWorkerId: 'worker-1',
  },
};

describe('structured construction-plan section contracts', () => {
  it.each(STRUCTURED_SECTION_KEYS)('%s complete content satisfies its required contract', (key) => {
    expect(validateStructuredSectionContent(key, COMPLETE_STRUCTURED_SECTION_CONTENT[key])).toEqual([]);
  });

  it.each(STRUCTURED_SECTION_KEYS)('%s empty content reports missing structured data', (key) => {
    expect(validateStructuredSectionContent(key, {})).not.toEqual([]);
  });

  it('retains legacy fields and sanitizes malformed owned fields during normalization', () => {
    const normalized = normalizeStructuredSectionContent('material-plan', {
      scope: '과거 저장 범위',
      body: '과거 자유서술 원문',
      applicableZones: '잘못된 과거 타입',
      materials: '잘못된 과거 타입',
    });

    expect(normalized).toMatchObject({
      structuredDataVersion: 1,
      scope: '과거 저장 범위',
      body: '과거 자유서술 원문',
      applicableZones: [],
      materials: [],
    });
  });

  it('requires a reshoring specification only when reshoring is selected', () => {
    const base = COMPLETE_STRUCTURED_SECTION_CONTENT['retention-plan'] as Record<string, unknown>;
    const retentionZones = [{
      id: 'r1', zone: 'A-1', retainUntilCondition: '설계강도 100%', releaseEvidence: '시험성적서',
      reshoringRequired: false, reshoringSpecification: '',
    }];
    expect(validateStructuredSectionContent('retention-plan', { ...base, retentionZones })).toEqual([]);
    const required = validateStructuredSectionContent('retention-plan', {
      ...base,
      retentionZones: [{ ...retentionZones[0], reshoringRequired: true }],
    });
    expect(required.map((issue) => issue.path)).toContain('retentionZones.0.reshoringSpecification');
  });

  it('reads a legacy approverRole without treating it as a complete new Hold Point decision', () => {
    const base = COMPLETE_STRUCTURED_SECTION_CONTENT['quality-plan'] as Record<string, unknown>;
    const legacy = normalizeStructuredSectionContent('quality-plan', {
      ...base,
      holdPoints: [{ id: 'legacy', stage: '타설 전', evidence: '검측표', approverRole: '품질담당' }],
    });
    expect(legacy.holdPoints[0].responsibleRole).toBe('품질담당');
    expect(validateStructuredSectionContent('quality-plan', legacy).map((issue) => issue.path)).toEqual(expect.arrayContaining([
      'holdPoints.0.completionCondition',
      'holdPoints.0.decisionStatus',
      'holdPoints.0.decisionAt',
      'holdPoints.0.decisionComment',
    ]));
  });

  it('fails Hold Point completion closed for rejection and vague conditional approval', () => {
    const base = COMPLETE_STRUCTURED_SECTION_CONTENT['quality-plan'] as Record<string, unknown>;
    const approved = (base.holdPoints as Array<Record<string, unknown>>)[0];

    const rejectedIssues = validateStructuredSectionContent('quality-plan', {
      ...base,
      holdPoints: [{ ...approved, decisionStatus: 'rejected', decisionComment: '검측 부적합으로 작업중지' }],
    });
    expect(rejectedIssues.map((issue) => issue.path)).toContain('holdPoints.0.decisionStatus');

    const vagueConditionalIssues = validateStructuredSectionContent('quality-plan', {
      ...base,
      holdPoints: [{ ...approved, decisionStatus: 'conditional', decisionComment: '보강 후' }],
    });
    expect(vagueConditionalIssues.map((issue) => issue.path)).toContain('holdPoints.0.decisionComment');

    expect(validateStructuredSectionContent('quality-plan', {
      ...base,
      holdPoints: [{
        ...approved,
        decisionStatus: 'conditional',
        decisionComment: 'A구간 가새 보강 및 재검측 완료 후 작업 재개',
      }],
    })).toEqual([]);
  });
});
