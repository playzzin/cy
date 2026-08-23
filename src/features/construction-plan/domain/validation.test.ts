import type { ConstructionPlan, ConstructionPlanTemplateBinding, DrawingAnnotation, PlanDrawing, SafeWorkerDto, StructuredSectionKey } from '../types';
import { ConstructionPlanSchema, isStructuredSectionKey } from '../types';
import { buildConstructionPlanDraft } from './drafts';
import { validateConstructionPlan } from './validation';
import { constructionPlanTemplateBindingHash } from './templateBinding';
import { canonicalDrawingObjectStyle } from '../components/drawings/layers';

const worker = (id: string, name: string): SafeWorkerDto => ({
  id,
  name,
  status: 'active',
});

const annotation = (
  id: string,
  layer: DrawingAnnotation['layer'],
): DrawingAnnotation => ({
  id,
  pageIndex: 0,
  pageFingerprint: 'page-fingerprint',
  layer,
  geometry: layer === 'install'
    ? { kind: 'rect', x: 0.1, y: 0.1, w: 0.3, h: 0.2, rotationDeg: 0 }
    : { kind: 'polygon', vertices: [{ x: 0.5, y: 0.5 }, { x: 0.8, y: 0.5 }, { x: 0.7, y: 0.8 }] },
  style: canonicalDrawingObjectStyle(layer),
  label: layer === 'install' ? 'A구간 설치' : 'A구간 해체',
  zoneCode: 'A',
  sequence: 1,
  ...(layer === 'dismantle' ? { startDate: '2026-09-10' } : {}),
  styleVersion: 1,
  locked: false,
  createdBy: 'author-1',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedBy: 'author-1',
  updatedAt: '2026-08-01T00:00:00.000Z',
});

const drawing = (): PlanDrawing => ({
  id: 'drawing-1',
  planId: 'plan-ready',
  storagePath: 'construction-plans/site-1/plan-ready/drawings/drawing-1/source.pdf',
  sourceSha256: 'sha256-source',
  originalFileName: 'approved.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 1024,
  pageCount: 1,
  drawingNo: 'D-ALL',
  title: '시스템동바리 시공도',
  revision: '5',
  approvalStatus: 'approved',
  approvalReference: '승인공문-2026-001',
  building: '101동',
  floor: '3층',
  zone: 'A구간',
  applicableZones: ['A구간'],
  scaleText: '1:100',
  previewStatus: 'ready',
  previewPaths: ['preview.webp'],
  pages: [{
    pageIndex: 0,
    mediaBoxPt: { left: 0, bottom: 0, right: 595.28, top: 841.89 },
    cropBoxPt: { left: 10, bottom: 10, right: 585.28, top: 831.89 },
    rotation: 0,
    pageFingerprint: 'page-fingerprint',
    previewPath: 'preview.webp',
  }],
  annotations: [annotation('install-1', 'install'), annotation('dismantle-1', 'dismantle')],
  uploadedBy: 'author-1',
  uploadedAt: '2026-08-01T00:00:00.000Z',
});

const completeStructuredContent = (key: StructuredSectionKey): Record<string, unknown> => {
  const step = { id: 'step-1', sequence: 1, activity: '작업 수행', responsibleRole: '작업반장', workZones: ['A구간'], prerequisites: ['작업 전 확인'], acceptanceCriteria: ['검측기준 충족'] };
  const common = { structuredDataVersion: 1, applicableZones: ['A구간'] };
  switch (key) {
    case 'material-plan': return { ...common, deliveryRoute: '동문 반입동선', unloadingMethod: '지게차', responsibleWorkerId: 'worker-construction', materials: [{ id: 'm1', materialName: '수직재', specification: 'Ø60.5', approvalReference: '승인-01', inspectionCriteria: ['외관·치수'], storageLocation: 'A 적치장', storageControls: ['받침목 설치'] }] };
    case 'equipment-signal': return { ...common, signalerWorkerIds: ['worker-safety'], signalMethod: 'combined', signalProtocols: [{ id: 's1', situation: '인양', signal: '수신호', issuerRole: '신호수', receiverRole: '운전원' }], accessControlMeasures: ['통제원 배치'], emergencyStopSignal: '양팔 교차' };
    case 'site-installation-plan': return { ...common, drawingReferences: ['D-01 Rev.5'], prerequisites: ['바닥 확인'], workSequence: [step], inspectionPoints: ['수직도'], weatherStopCriteria: ['강풍 시 중지'] };
    case 'concrete-pour-plan': return { ...common, designStrength: '24MPa', pourMethod: 'pump', pourRate: '20m³/h', pourSequence: [{ id: 'p1', sequence: 1, zone: 'A구간', volume: '80m³', pumpPosition: '동측', monitoringItems: ['침하'] }], concentratedLoadControls: ['분산 타설'], monitoringFrequency: '30분', stopCriteria: ['변형 초과'] };
    case 'dismantling-plan': return { ...common, strengthEvidenceReference: '강도-01', approvalReference: '해체승인-01', prerequisites: ['해체승인'], workSequence: [step], temporaryStabilityMeasures: ['구간분할'], exclusionZones: ['A 하부'], materialLoweringMethod: '리프트', responsibleWorkerId: 'worker-construction' };
    case 'retention-plan': return { ...common, retentionZones: [{ id: 'r1', zone: 'A구간', retainUntilCondition: '설계강도 충족', releaseEvidence: '시험성적서', reshoringRequired: false, reshoringSpecification: '' }], inspectionFrequency: '매일', markingMethod: '표찰', changeTriggers: ['타설순서 변경'], changeApprovalRoles: ['현장책임자'], drawingRevisionRequired: true, engineeringReviewRequired: true };
    case 'emergency-plan': return { ...common, contacts: [{ id: 'c1', organization: '현장', name: '안전담당', phone: '010-0000-0000', role: '지휘' }], scenarios: [{ id: 'e1', scenario: '붕괴징후', initialActions: ['작업중지'], evacuationRoute: '동측', assemblyPoint: '정문', responsibleRole: '현장책임자' }], alarmMethod: '무전', nearestHospital: '인근병원', emergencyEquipment: ['구급함'], reportingChain: ['안전담당→현장책임자'] };
    case 'quality-plan': return { ...common, inspectionItems: [{ id: 'q1', stage: '설치', item: '수직도', criterion: 'H/1000', method: '레벨', frequency: '구간별', responsibleRole: '품질담당', recordForm: '검측표' }], holdPoints: [{ id: 'h1', stage: '타설 전', evidence: '검측표', approverRole: '품질담당', responsibleRole: '공사담당', completionCondition: '설치 검측 전 항목 적합', decisionStatus: 'approved', decisionAt: '2026-08-10T00:00:00.000Z', decisionComment: '승인도면 및 검측 결과 적합' }], nonconformanceProcess: ['표시→조치→재검'], recordsRetentionMethod: '품질문서함' };
    case 'safety-plan': return { ...common, supervisorWorkerIds: ['worker-safety'], toolboxTopics: ['추락예방'], ppeRequirements: [{ id: 'ppe1', workStage: '설치', item: '안전대', standard: '2중고리' }], accessControlMeasures: ['통제선'], fallPreventionMeasures: ['안전대'], fallingObjectPreventionMeasures: ['낙하방지끈'], stopWorkCriteria: ['강풍'] };
    case 'environment-plan': return { ...common, aspects: [{ id: 'a1', activity: '절단', impact: '소음', controlMeasure: '방음막', monitoringMethod: '소음계', responsibleRole: '환경담당' }], wasteSegregation: ['분리배출'], dustControls: ['살수'], noiseControls: ['주간작업'], spillResponse: ['흡착포'], complaintContact: '현장사무실', monitoringFrequency: '일 2회' };
    case 'work-platform-access-plan': return { ...common, platformWidth: '400mm 이상', platformMaterial: '승인 강재발판', platformLoadLimit: '400kg 이하', guardrailMeasures: ['상·중간난간'], toeBoardMeasures: ['발끝막이판'], accessType: 'stair', accessLocations: ['동측'], openingControls: ['자동폐쇄'], inspectionPoints: ['고정·틈새'], responsibleWorkerId: 'worker-construction' };
    case 'inspection-maintenance-plan': return { ...common, inspectionFrequency: '작업 전 및 강풍 후', inspectionItems: ['기초·수직도'], defectResponse: ['사용중지·보수'], weatherStopCriteria: ['강풍 후 재점검'], alterationApprovalRoles: ['현장책임자'], wallTieChecks: ['앵커·클램프'], platformChecks: ['고정·파손'], recordsRetentionMethod: '일일점검표', responsibleWorkerId: 'worker-safety' };
  }
};

const readyPlan = (): ConstructionPlan => {
  const draft = buildConstructionPlanDraft('plan-ready', {
    siteId: 'site-1',
    siteName: '검증 현장',
    createdBy: 'author-1',
    participants: { approverIds: ['approver-1'], reviewerIds: ['reviewer-1'] },
  }, '2026-08-01T00:00:00.000Z');
  const assignments = draft.organizationSnapshot.assignments.map((assignment) => {
    if (assignment.role === 'site_manager') return { ...assignment, worker: worker('worker-site', '현장책임자') };
    if (assignment.role === 'construction_manager') return { ...assignment, worker: worker('worker-construction', '공사담당') };
    if (assignment.role === 'safety_manager') return { ...assignment, worker: worker('worker-safety', '안전담당') };
    return assignment;
  });
  const planDrawing = drawing();
  const templateBinding: ConstructionPlanTemplateBinding = {
    schemaVersion: 1,
    templateRecordId: `tpl_${'a'.repeat(40)}`,
    templateKey: `${draft.tradeType}:${draft.templateId}@${draft.templateVersion}`,
    tradeType: draft.tradeType,
    templateId: draft.templateId,
    templateVersion: draft.templateVersion,
    rendererVersion: draft.rendererVersion,
    logicalPageCount: 42,
    manifestHash: 'b'.repeat(64),
    templateBundleHash: 'c'.repeat(64),
    templateHash: 'd'.repeat(64),
    lifecycleVersionAtCapture: 3,
    publishedAt: '2026-07-31T00:00:00.000Z',
    capturedAt: '2026-08-01T00:00:00.000Z',
  };

  return ConstructionPlanSchema.parse({
    ...draft,
    templateBinding,
    templateHash: templateBinding.templateHash,
    manifestHash: templateBinding.manifestHash,
    templateBundleHash: templateBinding.templateBundleHash,
    templateBindingHash: constructionPlanTemplateBindingHash(templateBinding),
    status: 'approved_pending_issue',
    projectSnapshot: {
      ...draft.projectSnapshot,
      buildings: ['101동'],
      floors: ['3층'],
      zones: ['A구간'],
      sitePhotos: ['site-photo.jpg'],
      emergencyContactsComplete: true,
    },
    organizationSnapshot: { ...draft.organizationSnapshot, assignments },
    sections: draft.sections.map((section) => ({
      ...section,
      status: 'complete',
      content: isStructuredSectionKey(section.key)
        ? { ...section.content, ...completeStructuredContent(section.key) }
        : section.content,
    })),
    drawings: [planDrawing],
    drawingApplicability: ['D-01', 'D-02', 'D-03', 'D-04', 'D-05', 'D-06'].map((drawingSlot) => ({
      drawingSlot,
      decision: 'applicable',
      drawingId: planDrawing.id,
      reason: '승인 시공도에 통합 반영됨',
      reviewedBy: 'reviewer-1',
    })),
    engineeringValues: [{
      key: 'post-spacing-x',
      value: 900,
      unit: 'mm',
      sourceDocumentId: 'structural-review-1',
      sourceRevision: '5',
      sourcePageOrSection: '3.2',
      applicableZones: ['A구간'],
      verificationStatus: 'approved',
      verifiedBy: 'reviewer-1',
      verifiedAt: '2026-08-10T00:00:00.000Z',
    }],
    equipmentPlan: [{
      id: 'crane-1',
      category: 'lifting',
      equipmentName: '이동식 크레인',
      model: 'CR-100',
      ratedCapacity: '10t',
      workRadius: '12m',
      inspectionValidUntil: '2027-12-31',
      workZones: ['A구간'],
      plannedStages: ['자재반입'],
      controlMeasures: ['신호수 배치'],
    }],
    riskAssessments: [{
      id: 'risk-1',
      assessmentMethodVersion: 2,
      workStage: '설치',
      hazard: '추락',
      initialProbability: 4,
      initialSeverity: 4,
      initialRiskLevel: 'high',
      mitigationMeasures: ['안전대 부착'],
      responsibleWorkerId: 'worker-safety',
      residualProbability: 2,
      residualSeverity: 2,
      residualRiskLevel: 'low',
      methodReference: '청연이엔지 시스템동바리 5×5 위험성평가 기준 v2',
      reviewTrigger: '공법 또는 설치·해체 순서 변경',
      verifiedBy: 'reviewer-1',
    }],
    releaseReadiness: {
      ...draft.releaseReadiness,
      requiredReviewsComplete: true,
      snapshotHashMatches: true,
      pdfVisualCheckPassed: true,
      pdfTextCheckPassed: true,
      drawingLegendMonochromeDistinct: true,
    },
  });
};

describe('construction plan validation engine', () => {
  it('validates scaffold identity and page structure against the scaffold registry contract', () => {
    const scaffold = buildConstructionPlanDraft('plan-scaffold', {
      siteId: 'site-1', siteName: '비계 현장', createdBy: 'author-1', tradeType: 'system-scaffold',
      templateId: 'system-scaffold-standard', templateVersion: '1.0.0',
    }, '2026-08-01T00:00:00.000Z');
    const issueCodes = validateConstructionPlan(scaffold).errors.map((issue) => issue.code);
    [
      'TEMPLATE_VERSION_MISMATCH',
      'RENDERER_VERSION_MISMATCH',
      'TEMPLATE_SECTION_STRUCTURE_INVALID',
      'TEMPLATE_PAGE_COVERAGE_INVALID',
    ].forEach((code) => expect(issueCodes).not.toContain(code));
    expect(scaffold.sectionOrder).toEqual(expect.arrayContaining([
      'work-platform-access-plan',
      'inspection-maintenance-plan',
    ]));
  });

  it('allows review and issue only when all authoring, review and release facts pass', () => {
    const result = validateConstructionPlan(readyPlan(), { now: '2026-08-21T00:00:00.000Z' });

    expect(result.validContract).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.canSubmitForReview).toBe(true);
    expect(result.canIssue).toBe(true);
  });

  it('blocks review until every multi-role assignment has its own exception reason', () => {
    const plan = readyPlan();
    const first = plan.organizationSnapshot.assignments.find((assignment) => assignment.worker) as typeof plan.organizationSnapshot.assignments[number];
    plan.organizationSnapshot.assignments.push({
      ...first,
      id: 'assignment-multi-role',
      role: 'equipment_manager',
      label: '장비담당 겸임',
      order: plan.organizationSnapshot.assignments.length,
      exceptionReason: undefined,
    });

    let result = validateConstructionPlan(plan, { now: '2026-08-21T00:00:00.000Z' });
    expect(result.errors.filter((issue) => issue.code === 'DUPLICATE_ROLE_REASON_REQUIRED')).toHaveLength(2);
    expect(result.canSubmitForReview).toBe(false);

    plan.organizationSnapshot.assignments
      .filter((assignment) => assignment.worker?.id === first.worker?.id)
      .forEach((assignment) => { assignment.exceptionReason = '현장 규모상 승인된 한시 겸임 배정'; });
    result = validateConstructionPlan(plan, { now: '2026-08-21T00:00:00.000Z' });
    expect(result.errors.map((issue) => issue.code)).not.toContain('DUPLICATE_ROLE_REASON_REQUIRED');
  });

  it('requires a flag and reason for explicit cross-site workers without treating legacy workers as external', () => {
    const plan = readyPlan();
    const assignment = plan.organizationSnapshot.assignments.find((candidate) => candidate.worker) as typeof plan.organizationSnapshot.assignments[number];
    assignment.worker = { ...assignment.worker!, siteId: 'site-2' };
    assignment.externalAssignment = false;

    let result = validateConstructionPlan(plan, { now: '2026-08-21T00:00:00.000Z' });
    expect(result.errors.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'EXTERNAL_ASSIGNMENT_FLAG_REQUIRED',
      'EXTERNAL_ASSIGNMENT_REASON_REQUIRED',
    ]));

    assignment.externalAssignment = true;
    assignment.exceptionReason = '타 현장 안전관리자 승인 지원 배정';
    result = validateConstructionPlan(plan, { now: '2026-08-21T00:00:00.000Z' });
    expect(result.errors.map((issue) => issue.code)).not.toEqual(expect.arrayContaining([
      'EXTERNAL_ASSIGNMENT_FLAG_REQUIRED',
      'EXTERNAL_ASSIGNMENT_REASON_REQUIRED',
    ]));

    delete assignment.worker.siteId;
    assignment.externalAssignment = false;
    delete assignment.exceptionReason;
    result = validateConstructionPlan(plan, { now: '2026-08-21T00:00:00.000Z' });
    expect(result.errors.map((issue) => issue.code)).not.toEqual(expect.arrayContaining([
      'EXTERNAL_ASSIGNMENT_FLAG_REQUIRED',
      'EXTERNAL_ASSIGNMENT_REASON_REQUIRED',
    ]));
  });

  it('fails review and issue closed when the published template binding is missing or projected hashes drift', () => {
    const legacy = readyPlan();
    delete legacy.templateBinding;
    delete legacy.templateBindingHash;
    expect(validateConstructionPlan(legacy).errors.map((issue) => issue.code))
      .toContain('TEMPLATE_BINDING_REQUIRED');

    const drifted = readyPlan();
    drifted.templateBundleHash = 'e'.repeat(64);
    expect(validateConstructionPlan(drifted).errors.map((issue) => issue.code))
      .toContain('TEMPLATE_BINDING_MISMATCH');

    expect(ConstructionPlanSchema.safeParse({
      ...readyPlan(),
      templateBinding: { ...readyPlan().templateBinding, forgedClientField: true },
    }).success).toBe(false);
  });

  it('returns stable blocking codes for placeholders, examples and uncontrolled high risks', () => {
    const plan = readyPlan();
    plan.sections[0] = {
      ...plan.sections[0],
      content: { note: '[기입]' },
      containsExampleValues: true,
    };
    plan.drawings[0] = { ...plan.drawings[0], approvalStatus: 'example' };
    plan.riskAssessments[0] = {
      ...plan.riskAssessments[0],
      mitigationMeasures: [],
      responsibleWorkerId: undefined,
    };

    const codes = validateConstructionPlan(plan, { now: '2026-08-21T00:00:00.000Z' })
      .errors.map((issue) => issue.code);

    expect(codes).toEqual(expect.arrayContaining([
      'PLACEHOLDER_REMAINS',
      'EXAMPLE_VALUE_REMAINS',
      'EXAMPLE_DRAWING_INCLUDED',
      'DRAWING_APPROVAL_REQUIRED',
      'HIGH_RISK_CONTROL_INCOMPLETE',
    ]));
  });

  it('requires at least one complete risk-assessment row before review', () => {
    const missing = readyPlan();
    missing.riskAssessments = [];
    expect(validateConstructionPlan(missing).errors.map((issue) => issue.code))
      .toContain('RISK_ASSESSMENT_REQUIRED');

    const incomplete = readyPlan();
    incomplete.riskAssessments[0] = {
      ...incomplete.riskAssessments[0],
      verifiedBy: undefined,
    };
    expect(validateConstructionPlan(incomplete).errors.map((issue) => issue.code))
      .toContain('RISK_ASSESSMENT_INCOMPLETE');
  });

  it('fails closed when a v2 risk matrix is incomplete, mismatched or not reduced', () => {
    const plan = readyPlan();
    plan.riskAssessments[0] = {
      ...plan.riskAssessments[0],
      initialProbability: 3,
      initialSeverity: 3,
      initialRiskLevel: 'critical',
      residualProbability: 3,
      residualSeverity: 3,
      residualRiskLevel: 'low',
      reviewTrigger: '',
    };

    const codes = validateConstructionPlan(plan).errors.map((issue) => issue.code);
    expect(codes).toEqual(expect.arrayContaining([
      'RISK_MATRIX_LEVEL_MISMATCH',
      'RESIDUAL_RISK_NOT_REDUCED',
      'RISK_REVIEW_TRIGGER_REQUIRED',
    ]));
  });

  it('binds risk method, residual acceptance and reassessment trigger to the exact template version', () => {
    const plan = readyPlan();
    plan.riskAssessments[0] = {
      ...plan.riskAssessments[0],
      methodReference: '다른 템플릿 평가기준',
      reviewTrigger: '임의 조건',
      residualProbability: 4,
      residualSeverity: 3,
      residualRiskLevel: 'high',
    };
    const codes = validateConstructionPlan(plan).errors.map((issue) => issue.code);
    expect(codes).toEqual(expect.arrayContaining([
      'RISK_TEMPLATE_POLICY_MISMATCH',
      'RISK_REVIEW_TRIGGER_REQUIRED',
      'RESIDUAL_RISK_NOT_ACCEPTABLE',
    ]));
    expect(codes).not.toContain('RESIDUAL_RISK_NOT_REDUCED');
  });

  it('does not allow a structured section to pass by changing only its status to complete', () => {
    const plan = readyPlan();
    const materialIndex = plan.sections.findIndex((section) => section.key === 'material-plan');
    plan.sections[materialIndex] = { ...plan.sections[materialIndex], status: 'complete', content: {} };

    const result = validateConstructionPlan(plan, { now: '2026-08-21T00:00:00.000Z' });
    const issues = result.errors.filter((issue) => issue.code === 'STRUCTURED_SECTION_INCOMPLETE');

    expect(issues.length).toBeGreaterThan(0);
    expect(issues.every((issue) => issue.relatedId === 'material-plan')).toBe(true);
    expect(issues.map((issue) => issue.path)).toContain(`sections.${materialIndex}.content.materials`);
    expect(result.canSubmitForReview).toBe(false);
  });

  it('blocks review and issue for a rejected or non-specific conditional Hold Point', () => {
    const plan = readyPlan();
    const qualityIndex = plan.sections.findIndex((section) => section.key === 'quality-plan');
    const qualityContent = plan.sections[qualityIndex].content as Record<string, unknown>;
    const holdPoint = (qualityContent.holdPoints as Array<Record<string, unknown>>)[0];

    holdPoint.decisionStatus = 'rejected';
    let result = validateConstructionPlan(plan, { now: '2026-08-21T00:00:00.000Z' });
    expect(result.errors.some((issue) => issue.path.endsWith('.holdPoints.0.decisionStatus'))).toBe(true);
    expect(result.canSubmitForReview).toBe(false);
    expect(result.canIssue).toBe(false);

    holdPoint.decisionStatus = 'conditional';
    holdPoint.decisionComment = '보강 후';
    result = validateConstructionPlan(plan, { now: '2026-08-21T00:00:00.000Z' });
    expect(result.errors.some((issue) => issue.path.endsWith('.holdPoints.0.decisionComment'))).toBe(true);
    expect(result.canSubmitForReview).toBe(false);
    expect(result.canIssue).toBe(false);

    holdPoint.decisionComment = 'A구간 가새 보강 및 재검측 완료 후 작업 재개';
    result = validateConstructionPlan(plan, { now: '2026-08-21T00:00:00.000Z' });
    expect(result.errors).toEqual([]);
    expect(result.canSubmitForReview).toBe(true);
    expect(result.canIssue).toBe(true);
  });

  it('requires stages and control measures for every equipment category', () => {
    const plan = readyPlan();
    plan.equipmentPlan.push({
      id: 'measurement-1',
      category: 'measurement',
      equipmentName: '레이저 레벨',
      workZones: ['A구간'],
      plannedStages: [],
      controlMeasures: [],
    });

    const result = validateConstructionPlan(plan, { now: '2026-08-21T00:00:00.000Z' });

    expect(result.errors.map((issue) => issue.code)).toContain('EQUIPMENT_PLAN_INCOMPLETE');
    expect(result.errors.find((issue) => issue.code === 'EQUIPMENT_PLAN_INCOMPLETE')?.relatedId)
      .toBe('measurement-1');
  });

  it('fails review closed for missing layer attributes, wrong geometry and non-standard styles', () => {
    const plan = readyPlan();
    const [install, dismantle] = plan.drawings[0].annotations;
    plan.drawings[0].annotations = [{
      ...install,
      layer: 'equipment',
      equipmentType: '이동식 크레인',
      equipmentId: 'equipment-1',
      style: canonicalDrawingObjectStyle('equipment'),
      // A rectangle cannot express the required direction.
      geometry: { kind: 'rect', x: 0.1, y: 0.1, w: 0.3, h: 0.2, rotationDeg: 0 },
    }, {
      ...dismantle,
      startDate: undefined,
      style: { ...canonicalDrawingObjectStyle('dismantle'), strokeToken: 'orange' },
    }];

    const codes = validateConstructionPlan(plan).errors.map((issue) => issue.code);
    expect(codes).toEqual(expect.arrayContaining([
      'ANNOTATION_LAYER_ATTRIBUTES_INCOMPLETE',
      'ANNOTATION_LAYER_GEOMETRY_INVALID',
      'ANNOTATION_LAYER_STYLE_INVALID',
    ]));
  });

  it('continues oversized tables and blocks only an indivisible row that cannot fit A4', () => {
    const plan = readyPlan();
    plan.riskAssessments = Array.from({ length: 11 }, (_, index) => ({
      ...plan.riskAssessments[0],
      id: `risk-${index}`,
    }));
    expect(validateConstructionPlan(plan).errors.map((issue) => issue.code))
      .not.toContain('A4_TABLE_CAPACITY_EXCEEDED');
    plan.riskAssessments[0].mitigationMeasures = ['통제대책'.repeat(1_200)];
    expect(validateConstructionPlan(plan).errors.map((issue) => issue.code))
      .toContain('A4_TABLE_CAPACITY_EXCEEDED');
  });

  it('keeps release-only failures from changing review eligibility', () => {
    const plan = readyPlan();
    plan.status = 'draft';
    plan.releaseReadiness = {
      ...plan.releaseReadiness,
      requiredReviewsComplete: false,
      snapshotHashMatches: false,
      pdfVisualCheckPassed: false,
      pdfTextCheckPassed: false,
    };

    const result = validateConstructionPlan(plan, { now: '2026-08-21T00:00:00.000Z' });

    expect(result.canSubmitForReview).toBe(true);
    expect(result.canIssue).toBe(false);
    expect(result.errors.filter((issue) => issue.stage === 'issue').map((issue) => issue.code))
      .toEqual(expect.arrayContaining([
        'PLAN_STATUS_NOT_READY_FOR_ISSUE',
        'REQUIRED_REVIEWS_INCOMPLETE',
        'SNAPSHOT_HASH_MISMATCH',
        'PDF_VISUAL_CHECK_FAILED',
        'PDF_TEXT_CHECK_FAILED',
      ]));
  });

  it('blocks issue when the versioned 42-page template structure is missing or mutated', () => {
    const plan = readyPlan();
    plan.templateVersion = '0.9.0';
    plan.rendererVersion = 'mvp-1';
    plan.sections = plan.sections.slice(0, -1);
    plan.sectionOrder = [...plan.sectionOrder].reverse();

    const result = validateConstructionPlan(plan, { now: '2026-08-21T00:00:00.000Z' });
    const issueCodes = result.errors
      .filter((issue) => issue.stage === 'issue')
      .map((issue) => issue.code);

    expect(issueCodes).toEqual(expect.arrayContaining([
      'TEMPLATE_VERSION_MISMATCH',
      'RENDERER_VERSION_MISMATCH',
      'TEMPLATE_SECTION_STRUCTURE_INVALID',
      'TEMPLATE_PAGE_COVERAGE_INVALID',
    ]));
    expect(result.canSubmitForReview).toBe(true);
    expect(result.canIssue).toBe(false);
  });

  it('blocks a server-managed revision whose audit lineage is incomplete', () => {
    const plan = readyPlan();
    plan.seriesId = 'series-1';
    plan.lineageRootPlanId = 'plan-root';
    plan.revision = 1;

    const result = validateConstructionPlan(plan, { now: '2026-08-21T00:00:00.000Z' });

    expect(result.errors.map((issue) => issue.code)).toContain('REVISION_LINEAGE_INCOMPLETE');
    expect(result.canSubmitForReview).toBe(false);
  });

  it('requires a lineage root for every server-managed series document', () => {
    const plan = readyPlan();
    plan.seriesId = 'series-without-root';

    expect(validateConstructionPlan(plan).errors.map((issue) => issue.code))
      .toContain('REVISION_LINEAGE_INCOMPLETE');
  });

  it('reports malformed external data without throwing', () => {
    const result = validateConstructionPlan({ id: 'bad' }, { now: '2026-08-21T00:00:00.000Z' });

    expect(result.validContract).toBe(false);
    expect(result.errors.every((issue) => issue.code === 'INVALID_CONTRACT')).toBe(true);
  });
});
