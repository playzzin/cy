import { z } from 'zod';
import type {
  ConstructionPlan,
  DrawingAnnotation,
  OrganizationRole,
  PlanDrawing,
  PlanSection,
} from '../types';
import {
  ConstructionPlanSchema,
  isStructuredSectionKey,
  validateStructuredSectionContent,
} from '../types';
import { resolveDrawingPreviewPage } from './drawingPreview';
import { riskIsAcceptable, riskLevelFromScore, riskScore } from './riskMatrix';
import { createDefaultPlanSections } from './templateManifest';
import {
  getConstructionPlanTemplateByIdentity,
  getLatestConstructionPlanTemplate,
} from './templateRegistry';
import { planConstructionPlanPhysicalPages } from './physicalPagePlan';
import { constructionPlanTemplateBindingHash } from './templateBinding';
import {
  DRAWING_LAYER_CONTRACT,
  isCanonicalDrawingObjectStyle,
} from '../components/drawings/layers';

export const ValidationSeveritySchema = z.enum(['error', 'warning', 'info']);
export const ValidationStageSchema = z.enum(['authoring', 'review', 'issue']);

export const ValidationIssueCodeSchema = z.enum([
  'INVALID_CONTRACT',
  'SITE_REQUIRED',
  'DOCUMENT_NUMBER_REQUIRED',
  'DOCUMENT_DATE_REQUIRED',
  'REVISION_LINEAGE_INCOMPLETE',
  'TEMPLATE_VERSION_MISMATCH',
  'TEMPLATE_BINDING_REQUIRED',
  'TEMPLATE_BINDING_MISMATCH',
  'RENDERER_VERSION_MISMATCH',
  'TEMPLATE_SECTION_STRUCTURE_INVALID',
  'TEMPLATE_PAGE_COVERAGE_INVALID',
  'PLAN_STATUS_NOT_READY_FOR_ISSUE',
  'SELF_APPROVAL_NOT_ALLOWED',
  'PROJECT_BUILDING_REQUIRED',
  'PROJECT_FLOOR_REQUIRED',
  'PROJECT_ZONE_REQUIRED',
  'REQUIRED_ROLE_UNASSIGNED',
  'REQUIRED_SECTION_INCOMPLETE',
  'STRUCTURED_SECTION_INCOMPLETE',
  'PLACEHOLDER_REMAINS',
  'EXAMPLE_VALUE_REMAINS',
  'DRAWING_REQUIRED',
  'EXAMPLE_DRAWING_INCLUDED',
  'DRAWING_APPROVAL_REQUIRED',
  'DRAWING_METADATA_REQUIRED',
  'DRAWING_PREVIEW_NOT_READY',
  'DRAWING_APPLICABILITY_MISSING',
  'DRAWING_APPLICABILITY_INCOMPLETE',
  'INSTALL_ANNOTATION_REQUIRED',
  'DISMANTLE_OR_RETAIN_ANNOTATION_REQUIRED',
  'ENGINEERING_REFERENCE_REQUIRED',
  'ENGINEERING_REFERENCE_INCOMPLETE',
  'LIFTING_EQUIPMENT_REQUIRED',
  'EQUIPMENT_PLAN_INCOMPLETE',
  'LIFTING_EQUIPMENT_INCOMPLETE',
  'LIFTING_INSPECTION_EXPIRED',
  'RISK_ASSESSMENT_REQUIRED',
  'RISK_ASSESSMENT_INCOMPLETE',
  'RISK_MATRIX_INPUT_INCOMPLETE',
  'RISK_MATRIX_LEVEL_MISMATCH',
  'RISK_TEMPLATE_POLICY_MISMATCH',
  'RISK_REVIEW_TRIGGER_REQUIRED',
  'RESIDUAL_RISK_NOT_REDUCED',
  'RESIDUAL_RISK_NOT_ACCEPTABLE',
  'A4_TABLE_CAPACITY_EXCEEDED',
  'HIGH_RISK_CONTROL_INCOMPLETE',
  'REQUIRED_REVIEWS_INCOMPLETE',
  'REQUIRED_COMMENT_UNRESOLVED',
  'SNAPSHOT_HASH_MISMATCH',
  'PDF_VISUAL_CHECK_FAILED',
  'PDF_TEXT_CHECK_FAILED',
  'SITE_PHOTO_MISSING',
  'EMERGENCY_CONTACT_INCOMPLETE',
  'DUPLICATE_ROLE_ASSIGNMENT',
  'DUPLICATE_ROLE_REASON_REQUIRED',
  'EXTERNAL_ASSIGNMENT_FLAG_REQUIRED',
  'EXTERNAL_ASSIGNMENT_REASON_REQUIRED',
  'MASTER_SNAPSHOT_DIFFERS',
  'STANDARD_TEXT_MODIFIED',
  'STANDARD_TEXT_MODIFICATION_REASON_REQUIRED',
  'DRAWING_SCALE_MISSING',
  'ANNOTATION_LABEL_MISSING',
  'ANNOTATION_LAYER_ATTRIBUTES_INCOMPLETE',
  'ANNOTATION_LAYER_GEOMETRY_INVALID',
  'ANNOTATION_LAYER_STYLE_INVALID',
  'LIFTING_INSPECTION_EXPIRING',
  'MONOCHROME_LEGEND_UNCLEAR',
  'NOT_APPLICABLE_REASON_VAGUE',
  'LATEST_TEMPLATE_AVAILABLE',
  'LATEST_DRAWING_REVISION_AVAILABLE',
  'WORKER_REFRESH_AVAILABLE',
  'RECORD_APPENDIX_AVAILABLE',
]);

export const ValidationIssueSchema = z.object({
  code: ValidationIssueCodeSchema,
  severity: ValidationSeveritySchema,
  stage: ValidationStageSchema,
  message: z.string().min(1),
  path: z.string().min(1),
  relatedId: z.string().optional(),
  pageNumber: z.number().int().positive().optional(),
});

export const ConstructionPlanValidationResultSchema = z.object({
  validContract: z.boolean(),
  checkedAt: z.string().datetime({ offset: true }),
  issues: z.array(ValidationIssueSchema),
  errors: z.array(ValidationIssueSchema),
  warnings: z.array(ValidationIssueSchema),
  information: z.array(ValidationIssueSchema),
  summary: z.object({
    errors: z.number().int().nonnegative(),
    warnings: z.number().int().nonnegative(),
    information: z.number().int().nonnegative(),
  }),
  canSubmitForReview: z.boolean(),
  canIssue: z.boolean(),
});

export type ValidationSeverity = z.infer<typeof ValidationSeveritySchema>;
export type ValidationStage = z.infer<typeof ValidationStageSchema>;
export type ValidationIssueCode = z.infer<typeof ValidationIssueCodeSchema>;
export type ValidationIssue = z.infer<typeof ValidationIssueSchema>;
export type ConstructionPlanValidationResult = z.infer<typeof ConstructionPlanValidationResultSchema>;

export type ValidateConstructionPlanOptions = {
  now?: Date | string;
  inspectionExpiryWarningDays?: number;
};

const REQUIRED_ROLES: readonly OrganizationRole[] = [
  'site_manager',
  'construction_manager',
  'safety_manager',
];

const PLACEHOLDER_PATTERN = /(\[기입\]|\[입력\]|<입력>|\{\{[^}]+\}\}|SAMPLE_VALUE)/i;

const asIso = (value?: Date | string): string => {
  const date = typeof value === 'string' ? new Date(value) : value ?? new Date();
  if (Number.isNaN(date.getTime())) throw new Error('construction-plan-invalid-validation-date');
  return date.toISOString();
};

const hasText = (value: string | undefined): boolean => Boolean(value?.trim());

const equalValues = <T>(left: readonly T[], right: readonly T[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const containsPlaceholder = (value: unknown, seen: Set<object> = new Set()): boolean => {
  if (typeof value === 'string') return PLACEHOLDER_PATTERN.test(value);
  if (typeof value !== 'object' || value === null) return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.some((item) => containsPlaceholder(item, seen));
  return Object.values(value as Record<string, unknown>)
    .some((item) => containsPlaceholder(item, seen));
};

const drawingAnnotations = (drawings: readonly PlanDrawing[]): DrawingAnnotation[] =>
  drawings.flatMap((drawing) => drawing.annotations);

const activeDrawings = (plan: ConstructionPlan): PlanDrawing[] =>
  plan.drawings.filter((drawing) => drawing.approvalStatus !== 'superseded');

const positiveSequence = (value: number | undefined): boolean => (
  Number.isInteger(value) && Number(value) > 0
);

const hasDirectionGeometry = (annotation: DrawingAnnotation): boolean => {
  if (annotation.geometry.kind !== 'polyline' || annotation.geometry.arrowEnd !== true) return false;
  const first = annotation.geometry.vertices[0];
  const last = annotation.geometry.vertices[annotation.geometry.vertices.length - 1];
  return Boolean(first && last && (first.x !== last.x || first.y !== last.y));
};

const hasAreaGeometry = (annotation: DrawingAnnotation): boolean => (
  annotation.geometry.kind === 'rect' || annotation.geometry.kind === 'polygon'
);

const layerGeometryIsValid = (annotation: DrawingAnnotation): boolean => {
  const geometry = DRAWING_LAYER_CONTRACT[annotation.layer].geometry;
  if (geometry === 'direction') return hasDirectionGeometry(annotation);
  if (geometry === 'radius') return annotation.geometry.kind === 'ellipse';
  return hasAreaGeometry(annotation);
};

export const drawingAnnotationLayerAttributeGaps = (
  annotation: DrawingAnnotation,
): string[] => {
  switch (annotation.layer) {
    case 'install':
      return [
        ...(!hasText(annotation.zoneCode) ? ['구간코드'] : []),
        ...(!positiveSequence(annotation.sequence) ? ['순서'] : []),
      ];
    case 'dismantle':
      return [
        ...(!hasText(annotation.zoneCode) ? ['구간코드'] : []),
        ...(!positiveSequence(annotation.sequence) ? ['순서'] : []),
        ...(!/^\d{4}-\d{2}-\d{2}$/.test(annotation.startDate?.trim() ?? '') ? ['해체 예정일'] : []),
      ];
    case 'retain':
      return [
        ...(!hasText(annotation.reason) ? ['존치 사유'] : []),
        ...(!hasText(annotation.releaseCondition) ? ['해제조건'] : []),
      ];
    case 'equipment':
      return [
        ...(!hasText(annotation.equipmentType) ? ['장비종류'] : []),
        ...(!hasText(annotation.equipmentId) ? ['장비 식별자'] : []),
      ];
    case 'pedestrian':
      return [
        ...(!hasText(annotation.entrance) ? ['출입구'] : []),
        ...(!hasText(annotation.destination) ? ['도착지'] : []),
      ];
    case 'lifting':
      return [
        ...(!hasText(annotation.equipmentId) ? ['장비 식별자'] : []),
        ...(!(typeof annotation.radius === 'number' && Number.isFinite(annotation.radius) && annotation.radius > 0) ? ['양중반경'] : []),
      ];
    case 'restricted':
      return [
        ...(!hasText(annotation.startDate) ? ['통제 시작'] : []),
        ...(!hasText(annotation.endDate) ? ['통제 종료'] : []),
        ...(!hasText(annotation.responsibleWorkerId) ? ['담당 작업자'] : []),
        ...(!hasText(annotation.responsibleRole) ? ['담당 역할'] : []),
      ];
    case 'storage':
      return !hasText(annotation.materialType) ? ['자재종류'] : [];
  }
};

const firstPage = (section: PlanSection): number | undefined => section.pageNumbers[0];

const contractFailureResult = (
  checkedAt: string,
  messages: readonly string[],
): ConstructionPlanValidationResult => {
  const issues: ValidationIssue[] = messages.slice(0, 20).map((message, index) => ({
    code: 'INVALID_CONTRACT',
    severity: 'error',
    stage: 'authoring',
    message,
    path: `contract.${index}`,
  }));
  return {
    validContract: false,
    checkedAt,
    issues,
    errors: issues,
    warnings: [],
    information: [],
    summary: { errors: issues.length, warnings: 0, information: 0 },
    canSubmitForReview: false,
    canIssue: false,
  };
};

export const validateConstructionPlan = (
  value: unknown,
  options: ValidateConstructionPlanOptions = {},
): ConstructionPlanValidationResult => {
  const checkedAt = asIso(options.now);
  const parsed = ConstructionPlanSchema.safeParse(value);
  if (!parsed.success) {
    return contractFailureResult(
      checkedAt,
      parsed.error.issues.map((issue) => `${issue.path.join('.') || 'plan'}: ${issue.message}`),
    );
  }

  const plan = parsed.data;
  const selectedTemplate = getConstructionPlanTemplateByIdentity({
    tradeType: plan.tradeType,
    templateId: plan.templateId,
    templateVersion: plan.templateVersion,
  });
  const latestTemplate = getLatestConstructionPlanTemplate(plan.tradeType);
  const templateManifest = selectedTemplate?.manifest;
  const issues: ValidationIssue[] = [];
  const add = (
    code: ValidationIssueCode,
    severity: ValidationSeverity,
    stage: ValidationStage,
    message: string,
    path: string,
    extra: Pick<ValidationIssue, 'relatedId' | 'pageNumber'> = {},
  ): void => {
    issues.push({ code, severity, stage, message, path, ...extra });
  };

  if (!hasText(plan.siteId) || !hasText(plan.projectSnapshot.siteName)) {
    add('SITE_REQUIRED', 'error', 'authoring', '현장 정보가 필요합니다.', 'projectSnapshot.siteName');
  }
  if (!hasText(plan.documentNo)) {
    add('DOCUMENT_NUMBER_REQUIRED', 'error', 'authoring', '문서번호가 필요합니다.', 'documentNo');
  }
  if (!hasText(plan.documentDate)) {
    add('DOCUMENT_DATE_REQUIRED', 'error', 'authoring', '작성일이 필요합니다.', 'documentDate');
  }
  const managedRevisionLineageIncomplete = Boolean(plan.seriesId) && (
    !hasText(plan.lineageRootPlanId)
    || (plan.revision > 0 && (
      !hasText(plan.supersedesPlanId)
      || !hasText(plan.revisionReason)
      || !plan.revisionType
      || (plan.sourceRevisionNo !== undefined && plan.sourceRevisionNo >= plan.revision)
      || !hasText(plan.sourceSnapshotHash)
    ))
  );
  const cloneLineageIncomplete = Boolean(plan.clonedFromPlanId) && (
    !plan.seriesId
    || plan.revision !== 0
    || plan.lineageRootPlanId !== plan.id
  );
  if (managedRevisionLineageIncomplete || cloneLineageIncomplete) {
    add(
      'REVISION_LINEAGE_INCOMPLETE',
      'error',
      'review',
      '개정본의 원본, 변경사유·유형 및 승인 스냅샷 연결정보가 완전해야 합니다.',
      'seriesId',
    );
  }
  if (!templateManifest) {
    add(
      'TEMPLATE_VERSION_MISMATCH',
      'error',
      'issue',
      `등록되지 않은 템플릿 식별자입니다: ${plan.tradeType}:${plan.templateId}@${plan.templateVersion}`,
      'templateVersion',
    );
  }
  if (!templateManifest) {
    add(
      'RENDERER_VERSION_MISMATCH',
      'error',
      'issue',
      '등록되지 않은 템플릿의 렌더러 버전은 검증할 수 없습니다.',
      'rendererVersion',
    );
  } else if (plan.rendererVersion !== templateManifest.rendererVersion) {
    add(
      'RENDERER_VERSION_MISMATCH',
      'error',
      'issue',
      `발행 렌더러는 ${templateManifest.rendererVersion}이어야 합니다. 새 개정 초안을 생성하세요.`,
      'rendererVersion',
    );
  }

  if (!plan.templateBinding) {
    add(
      'TEMPLATE_BINDING_REQUIRED',
      'error',
      'review',
      '서버가 게시 템플릿의 불변 해시를 바인딩하지 않은 legacy 초안입니다. 명시적 마이그레이션 후 다시 검토하세요.',
      'templateBinding',
    );
  } else {
    const binding = plan.templateBinding;
    const bindingHash = constructionPlanTemplateBindingHash(binding);
    if (binding.tradeType !== plan.tradeType
      || binding.templateId !== plan.templateId
      || binding.templateVersion !== plan.templateVersion
      || binding.rendererVersion !== plan.rendererVersion
      || binding.manifestHash !== plan.manifestHash
      || binding.templateBundleHash !== plan.templateBundleHash
      || binding.templateHash !== plan.templateHash
      || bindingHash !== plan.templateBindingHash) {
      add(
        'TEMPLATE_BINDING_MISMATCH',
        'error',
        'issue',
        '계획서 식별자·게시 manifest·renderer bundle과 서버 템플릿 바인딩 해시가 일치해야 합니다.',
        'templateBindingHash',
      );
    }
  }

  const expectedSections = templateManifest ? createDefaultPlanSections(templateManifest) : [];
  const expectedSectionIds = expectedSections.map((section) => section.id);
  const actualSectionIds = plan.sections.map((section) => section.id);
  const sectionStructureMatches = Boolean(templateManifest)
    && equalValues(plan.sectionOrder, expectedSectionIds)
    && equalValues(actualSectionIds, expectedSectionIds)
    && plan.sections.every((section, index) => {
      const expected = expectedSections[index];
      return Boolean(expected)
        && section.key === expected.key
        && section.order === expected.order
        && section.required === expected.required
        && equalValues(section.pageNumbers, expected.pageNumbers);
    });
  if (!sectionStructureMatches) {
    add(
      'TEMPLATE_SECTION_STRUCTURE_INVALID',
      'error',
      'issue',
      '템플릿의 필수 섹션 키, 순서 또는 페이지 배정이 누락·중복·변조되었습니다.',
      'sections',
    );
  }

  const actualPages = plan.sections.flatMap((section) => section.pageNumbers);
  const expectedPages = templateManifest
    ? Array.from({ length: templateManifest.sourceReference.pageCount }, (_, index) => index + 1)
    : [];
  const pageCoverageMatches = actualPages.length === expectedPages.length
    && equalValues([...actualPages].sort((left, right) => left - right), expectedPages);
  if (!pageCoverageMatches) {
    add(
      'TEMPLATE_PAGE_COVERAGE_INVALID',
      'error',
      'issue',
      '발행 페이지는 1쪽부터 42쪽까지 누락과 중복 없이 정확히 한 번씩 포함되어야 합니다.',
      'sections.pageNumbers',
    );
  }
  if (templateManifest && sectionStructureMatches && pageCoverageMatches) {
    try {
      planConstructionPlanPhysicalPages(plan);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'construction-plan-physical-page-plan-failed';
      const rowPath = detail.startsWith('construction-plan-physical-row-too-tall:')
        ? detail.slice('construction-plan-physical-row-too-tall:'.length)
        : undefined;
      add(
        'A4_TABLE_CAPACITY_EXCEEDED',
        'error',
        'authoring',
        rowPath
          ? `한 행의 내용이 A4 본문 높이를 초과합니다. ${rowPath} 항목의 긴 문장·줄바꿈을 여러 행으로 나누세요.`
          : `A4 물리 페이지 구성을 만들 수 없습니다. 반복행을 정리하거나 문서를 분할하세요. (${detail})`,
        rowPath || 'sections',
      );
    }
  }
  if (plan.status !== 'approved_pending_issue' && plan.status !== 'issued') {
    add('PLAN_STATUS_NOT_READY_FOR_ISSUE', 'error', 'issue', '최종승인 후에만 현장사용 발행이 가능합니다.', 'status');
  }
  if (plan.participants.authorIds.some((authorId) => plan.participants.approverIds.includes(authorId))) {
    add('SELF_APPROVAL_NOT_ALLOWED', 'error', 'review', '작성자와 최종승인자는 서로 달라야 합니다.', 'participants');
  }
  if (plan.projectSnapshot.buildings.length === 0) {
    add('PROJECT_BUILDING_REQUIRED', 'error', 'authoring', '적용 동을 하나 이상 입력하세요.', 'projectSnapshot.buildings');
  }
  if (plan.projectSnapshot.floors.length === 0) {
    add('PROJECT_FLOOR_REQUIRED', 'error', 'authoring', '적용 층을 하나 이상 입력하세요.', 'projectSnapshot.floors');
  }
  if (plan.projectSnapshot.zones.length === 0) {
    add('PROJECT_ZONE_REQUIRED', 'error', 'authoring', '적용 구간을 하나 이상 입력하세요.', 'projectSnapshot.zones');
  }

  REQUIRED_ROLES.forEach((role) => {
    const assignment = plan.organizationSnapshot.assignments
      .find((candidate) => candidate.role === role);
    if (!assignment?.worker) {
      const label = role === 'site_manager' ? '현장책임자'
        : role === 'construction_manager' ? '공사담당' : '안전담당';
      add(
        'REQUIRED_ROLE_UNASSIGNED',
        'error',
        'authoring',
        `${label} 역할에 작업자를 배정하세요.`,
        `organizationSnapshot.assignments.${assignment?.id ?? role}.worker`,
        assignment ? { relatedId: assignment.id } : undefined,
      );
    }
  });

  const rolesByWorker = new Map<string, typeof plan.organizationSnapshot.assignments>();
  plan.organizationSnapshot.assignments.forEach((assignment) => {
    if (!assignment.worker) return;
    const workerAssignments = rolesByWorker.get(assignment.worker.id) ?? [];
    workerAssignments.push(assignment);
    rolesByWorker.set(assignment.worker.id, workerAssignments);
  });
  rolesByWorker.forEach((workerAssignments, workerId) => {
    if (workerAssignments.length > 1) {
      workerAssignments.forEach((assignment) => {
        const reason = assignment.exceptionReason?.trim() ?? '';
        if (reason.length < 5 || reason.length > 500) {
          add(
            'DUPLICATE_ROLE_REASON_REQUIRED',
            'error',
            'review',
            `${assignment.label} 겸임 사유를 5자 이상 500자 이하로 입력하세요.`,
            `organizationSnapshot.assignments.${assignment.id}.exceptionReason`,
            { relatedId: workerId },
          );
        }
      });
      add(
        'DUPLICATE_ROLE_ASSIGNMENT',
        'warning',
        'review',
        `동일 작업자가 ${workerAssignments.map((assignment) => assignment.label).join(', ')} 역할을 겸임합니다.`,
        'organizationSnapshot.assignments',
        { relatedId: workerId },
      );
    }
  });

  plan.organizationSnapshot.assignments.forEach((assignment) => {
    if (!assignment.worker) return;
    const workerSiteId = assignment.worker.siteId?.trim();
    const organizationSiteId = plan.organizationSnapshot.sourceSiteId?.trim();
    const isExplicitlyCrossSite = Boolean(
      workerSiteId && organizationSiteId && workerSiteId !== organizationSiteId,
    );
    if (isExplicitlyCrossSite && !assignment.externalAssignment) {
      add(
        'EXTERNAL_ASSIGNMENT_FLAG_REQUIRED',
        'error',
        'review',
        `${assignment.worker.name} 작업자는 다른 현장 소속이므로 현장 외 인원으로 표시해야 합니다.`,
        `organizationSnapshot.assignments.${assignment.id}.externalAssignment`,
        { relatedId: assignment.worker.id },
      );
    }
    if (assignment.externalAssignment || isExplicitlyCrossSite) {
      const reason = assignment.exceptionReason?.trim() ?? '';
      if (reason.length < 5 || reason.length > 500) {
        add(
          'EXTERNAL_ASSIGNMENT_REASON_REQUIRED',
          'error',
          'review',
          `${assignment.label} 현장 외 배정 사유를 5자 이상 500자 이하로 입력하세요.`,
          `organizationSnapshot.assignments.${assignment.id}.exceptionReason`,
          { relatedId: assignment.worker.id },
        );
      }
    }
  });

  plan.sections.forEach((section, index) => {
    const path = `sections.${index}`;
    if (section.required && section.status !== 'complete') {
      add(
        'REQUIRED_SECTION_INCOMPLETE',
        'error',
        'authoring',
        `${section.title} 필수 섹션을 완료하세요.`,
        `${path}.status`,
        { relatedId: section.id, pageNumber: firstPage(section) },
      );
    }
    if (section.status === 'complete' && isStructuredSectionKey(section.key)) {
      validateStructuredSectionContent(section.key, section.content).forEach((issue) => add(
        'STRUCTURED_SECTION_INCOMPLETE',
        'error',
        'authoring',
        `${section.title}: ${issue.label}을(를) 입력하세요.`,
        `${path}.content.${issue.path}`,
        { relatedId: section.id, pageNumber: firstPage(section) },
      ));
    }
    if (section.placeholders.some(hasText) || containsPlaceholder(section.content)) {
      add(
        'PLACEHOLDER_REMAINS',
        'error',
        'authoring',
        `${section.title}에 미입력 placeholder가 남아 있습니다.`,
        `${path}.content`,
        { relatedId: section.id, pageNumber: firstPage(section) },
      );
    }
    if (section.containsExampleValues) {
      add(
        'EXAMPLE_VALUE_REMAINS',
        'error',
        'authoring',
        `${section.title}에 예시 수치가 남아 있습니다.`,
        `${path}.containsExampleValues`,
        { relatedId: section.id, pageNumber: firstPage(section) },
      );
    }
    if (section.standardTextModified) {
      add(
        'STANDARD_TEXT_MODIFIED',
        'warning',
        'review',
        `${section.title}의 표준 문구가 수정되었습니다.`,
        `${path}.standardTextModified`,
        { relatedId: section.id, pageNumber: firstPage(section) },
      );
      if (!hasText(section.standardTextModificationReason)) {
        add(
          'STANDARD_TEXT_MODIFICATION_REASON_REQUIRED',
          'error',
          'review',
          '표준 문구 수정사유를 입력하세요.',
          `${path}.standardTextModificationReason`,
          { relatedId: section.id, pageNumber: firstPage(section) },
        );
      }
    }
    if (section.status === 'not_applicable'
      && (section.notApplicableReason?.trim().length ?? 0) < 10) {
      add(
        'NOT_APPLICABLE_REASON_VAGUE',
        'warning',
        'review',
        `${section.title}의 해당 없음 사유를 구체적으로 작성하세요.`,
        `${path}.notApplicableReason`,
        { relatedId: section.id, pageNumber: firstPage(section) },
      );
    }
  });

  const drawings = activeDrawings(plan);
  if (drawings.length === 0) {
    add('DRAWING_REQUIRED', 'error', 'authoring', '현장 적용 도면을 등록하세요.', 'drawings');
  }
  drawings.forEach((drawing, index) => {
    const path = `drawings.${index}`;
    if (drawing.approvalStatus === 'example') {
      add('EXAMPLE_DRAWING_INCLUDED', 'error', 'authoring', '예시도면은 발행 대상에 포함할 수 없습니다.', path, { relatedId: drawing.id });
    }
    if (drawing.approvalStatus !== 'approved' || !hasText(drawing.approvalReference)) {
      add('DRAWING_APPROVAL_REQUIRED', 'error', 'review', '승인도면 상태와 승인근거를 확인하세요.', `${path}.approvalReference`, { relatedId: drawing.id });
    }
    if (!hasText(drawing.drawingNo) || !hasText(drawing.revision) || drawing.applicableZones.length === 0) {
      add('DRAWING_METADATA_REQUIRED', 'error', 'authoring', '도면번호, Rev. 및 적용구간이 필요합니다.', path, { relatedId: drawing.id });
    }
    const everyPreviewPageReady = drawing.previewStatus === 'ready'
      && Array.from({ length: drawing.pageCount }, (_, pageIndex) => pageIndex)
        .every((pageIndex) => resolveDrawingPreviewPage(drawing, pageIndex).ready);
    if (!everyPreviewPageReady) {
      add('DRAWING_PREVIEW_NOT_READY', 'error', 'review', '도면의 모든 페이지 미리보기 처리가 완료되지 않았습니다.', `${path}.previewStatus`, { relatedId: drawing.id });
    }
    if (!hasText(drawing.scaleText)) {
      add('DRAWING_SCALE_MISSING', 'warning', 'review', '도면 축척이 입력되지 않았습니다.', `${path}.scaleText`, { relatedId: drawing.id });
    }
    drawing.annotations.forEach((annotation, annotationIndex) => {
      const annotationPath = `${path}.annotations.${annotationIndex}`;
      if (!hasText(annotation.label)) {
        add(
          'ANNOTATION_LABEL_MISSING',
          'warning',
          'review',
          '도면 레이어에 구간 라벨을 입력하세요.',
          `${path}.annotations.${annotationIndex}.label`,
          { relatedId: annotation.id },
        );
      }
      const attributeGaps = drawingAnnotationLayerAttributeGaps(annotation);
      if (attributeGaps.length > 0) {
        add(
          'ANNOTATION_LAYER_ATTRIBUTES_INCOMPLETE',
          'error',
          'authoring',
          `${DRAWING_LAYER_CONTRACT[annotation.layer].label} 필수 속성을 입력하세요: ${attributeGaps.join(', ')}.`,
          annotationPath,
          { relatedId: annotation.id },
        );
      }
      if (!layerGeometryIsValid(annotation)) {
        add(
          'ANNOTATION_LAYER_GEOMETRY_INVALID',
          'error',
          'authoring',
          `${DRAWING_LAYER_CONTRACT[annotation.layer].label}의 표준 표현 방식으로 다시 표시하세요.`,
          `${annotationPath}.geometry`,
          { relatedId: annotation.id },
        );
      }
      if (!isCanonicalDrawingObjectStyle(annotation.layer, annotation.style)) {
        add(
          'ANNOTATION_LAYER_STYLE_INVALID',
          'error',
          'authoring',
          `${DRAWING_LAYER_CONTRACT[annotation.layer].label}의 표준 색상·선형을 적용하세요.`,
          `${annotationPath}.style`,
          { relatedId: annotation.id },
        );
      }
    });
  });

  const annotations = drawingAnnotations(drawings);
  if (!annotations.some((annotation) => annotation.layer === 'install')) {
    add('INSTALL_ANNOTATION_REQUIRED', 'error', 'authoring', '설치구간 주석을 하나 이상 표시하세요.', 'drawings.annotations');
  }
  if (!annotations.some((annotation) => annotation.layer === 'dismantle' || annotation.layer === 'retain')) {
    add('DISMANTLE_OR_RETAIN_ANNOTATION_REQUIRED', 'error', 'authoring', '해체구간 또는 존치계획 주석을 표시하세요.', 'drawings.annotations');
  }

  const requiredDrawingSlots = ['D-01', 'D-02', 'D-03', 'D-04', 'D-05', 'D-06'] as const;
  requiredDrawingSlots.forEach((drawingSlot) => {
    const decision = plan.drawingApplicability.find((candidate) => candidate.drawingSlot === drawingSlot);
    if (!decision) {
      add('DRAWING_APPLICABILITY_MISSING', 'error', 'review', `${drawingSlot} 적용성 결정을 완료하세요.`, 'drawingApplicability', { relatedId: drawingSlot });
      return;
    }
    const requiresDrawing = decision.decision === 'applicable' || decision.decision === 'replacement';
    const linkedDrawingExists = decision.drawingId
      ? drawings.some((drawing) => drawing.id === decision.drawingId)
      : false;
    const notApplicableComplete = decision.decision !== 'not_applicable'
      || (decision.reason.trim().length >= 10 && hasText(decision.reviewedBy));
    if ((requiresDrawing && !linkedDrawingExists)
      || !notApplicableComplete
      || (decision.decision === 'replacement' && !hasText(decision.technicalReviewReference))) {
      add('DRAWING_APPLICABILITY_INCOMPLETE', 'error', 'review', `${drawingSlot} 적용성 근거 또는 연결 도면을 확인하세요.`, 'drawingApplicability', { relatedId: drawingSlot });
    }
  });

  if (plan.engineeringValues.length === 0) {
    add('ENGINEERING_REFERENCE_REQUIRED', 'error', 'authoring', '구조검토 근거를 등록하세요.', 'engineeringValues');
  }
  plan.engineeringValues.forEach((engineeringValue, index) => {
    if (!hasText(engineeringValue.key)
      || !hasText(engineeringValue.sourceDocumentId)
      || !hasText(engineeringValue.sourceRevision)
      || engineeringValue.applicableZones.length === 0
      || engineeringValue.verificationStatus === 'unverified') {
      add(
        'ENGINEERING_REFERENCE_INCOMPLETE',
        'error',
        'review',
        '구조 주요값의 출처, Rev., 적용구간 및 검토상태를 확인하세요.',
        `engineeringValues.${index}`,
        { relatedId: engineeringValue.key || String(index) },
      );
    }
  });

  const liftingEquipment = plan.equipmentPlan.filter((item) => item.category === 'lifting');
  if (liftingEquipment.length === 0) {
    add('LIFTING_EQUIPMENT_REQUIRED', 'error', 'authoring', '양중장비 계획을 등록하세요.', 'equipmentPlan');
  }
  const expiryWarningDays = options.inspectionExpiryWarningDays ?? 30;
  const nowMillis = new Date(checkedAt).getTime();
  plan.equipmentPlan.forEach((equipment, index) => {
    const path = `equipmentPlan.${index}`;
    if (!hasText(equipment.equipmentName)
      || !equipment.workZones.some(hasText)
      || !equipment.plannedStages.some(hasText)
      || !equipment.controlMeasures.some(hasText)) {
      add(
        'EQUIPMENT_PLAN_INCOMPLETE',
        'error',
        'authoring',
        '장비명, 작업구간, 예정 작업단계 및 통제대책을 입력하세요.',
        path,
        { relatedId: equipment.id },
      );
    }
    if (equipment.category !== 'lifting') return;
    if (!hasText(equipment.model)
      || !hasText(equipment.ratedCapacity)
      || !hasText(equipment.workRadius)
      || !hasText(equipment.inspectionValidUntil)) {
      add('LIFTING_EQUIPMENT_INCOMPLETE', 'error', 'authoring', '양중장비 모델, 정격능력, 작업반경 및 검사기간을 입력하세요.', path, { relatedId: equipment.id });
      return;
    }
    const expiryMillis = new Date(equipment.inspectionValidUntil as string).getTime();
    if (Number.isNaN(expiryMillis) || expiryMillis < nowMillis) {
      add('LIFTING_INSPECTION_EXPIRED', 'error', 'review', '양중장비 검사기간이 만료되었거나 올바르지 않습니다.', `${path}.inspectionValidUntil`, { relatedId: equipment.id });
    } else if ((expiryMillis - nowMillis) / 86_400_000 <= expiryWarningDays) {
      add('LIFTING_INSPECTION_EXPIRING', 'warning', 'review', `양중장비 검사기간이 ${expiryWarningDays}일 이내 만료됩니다.`, `${path}.inspectionValidUntil`, { relatedId: equipment.id });
    }
  });

  if (plan.riskAssessments.length === 0) {
    add('RISK_ASSESSMENT_REQUIRED', 'error', 'authoring', '설치·타설·해체 단계의 위험성평가를 등록하세요.', 'riskAssessments');
  }
  plan.riskAssessments.forEach((risk, index) => {
    const riskPolicy = templateManifest?.riskAssessmentPolicy;
    if (!hasText(risk.workStage)
      || !hasText(risk.hazard)
      || risk.mitigationMeasures.length === 0
      || !hasText(risk.responsibleWorkerId)
      || !risk.residualRiskLevel
      || !hasText(risk.verifiedBy)) {
      add('RISK_ASSESSMENT_INCOMPLETE', 'error', 'review', '위험성평가의 작업단계, 위험요인, 저감대책, 담당자, 저감 후 위험도 및 확인자를 입력하세요.', `riskAssessments.${index}`, { relatedId: risk.id });
    }
    if ((risk.initialRiskLevel === 'high' || risk.initialRiskLevel === 'critical')
      && (risk.mitigationMeasures.length === 0 || !hasText(risk.responsibleWorkerId))) {
      add('HIGH_RISK_CONTROL_INCOMPLETE', 'error', 'review', '고위험 항목의 저감대책과 담당자를 지정하세요.', `riskAssessments.${index}`, { relatedId: risk.id });
    }
    if (riskPolicy) {
      if (risk.assessmentMethodVersion !== riskPolicy.methodVersion
        || risk.methodReference !== riskPolicy.methodReference) {
        add('RISK_TEMPLATE_POLICY_MISMATCH', 'error', 'review', '위험성평가 방법과 기준문서는 선택된 템플릿 버전의 불변 계약과 정확히 일치해야 합니다.', `riskAssessments.${index}.methodReference`, { relatedId: risk.id });
      }
      const initialScore = riskScore(risk.initialProbability, risk.initialSeverity, riskPolicy);
      const residualScore = riskScore(risk.residualProbability, risk.residualSeverity, riskPolicy);
      if (!initialScore || !residualScore) {
        add('RISK_MATRIX_INPUT_INCOMPLETE', 'error', 'review', `템플릿 위험성평가 범위(${riskPolicy.probabilityMin}~${riskPolicy.probabilityMax} × ${riskPolicy.severityMin}~${riskPolicy.severityMax})의 최초·저감 후 값을 모두 입력하세요.`, `riskAssessments.${index}`, { relatedId: risk.id });
      } else {
        if (risk.initialRiskLevel !== riskLevelFromScore(initialScore, riskPolicy)
          || risk.residualRiskLevel !== riskLevelFromScore(residualScore, riskPolicy)) {
          add('RISK_MATRIX_LEVEL_MISMATCH', 'error', 'review', '저장된 위험등급이 가능성×중대성 계산결과와 일치하지 않습니다.', `riskAssessments.${index}`, { relatedId: risk.id });
        }
        if (riskPolicy.acceptance.requireResidualReduction && residualScore >= initialScore) {
          add('RESIDUAL_RISK_NOT_REDUCED', 'error', 'review', '저감대책 적용 후 위험점수는 최초 위험점수보다 낮아야 합니다.', `riskAssessments.${index}.residualRiskLevel`, { relatedId: risk.id });
        }
        if (!riskIsAcceptable(residualScore, risk.residualRiskLevel, riskPolicy)) {
          add('RESIDUAL_RISK_NOT_ACCEPTABLE', 'error', 'review', `잔여 위험은 ${riskPolicy.acceptance.maxResidualScore}점 이하이고 금지등급이 아니어야 합니다.`, `riskAssessments.${index}.residualRiskLevel`, { relatedId: risk.id });
        }
      }
      if (typeof risk.reviewTrigger !== 'string'
        || !risk.reviewTrigger.trim()
        || !riskPolicy.reviewTriggers.includes(risk.reviewTrigger)) {
        add('RISK_REVIEW_TRIGGER_REQUIRED', 'error', 'review', '선택된 템플릿이 정의한 재평가 조건을 지정하세요.', `riskAssessments.${index}.reviewTrigger`, { relatedId: risk.id });
      }
    }
  });

  if (!plan.releaseReadiness.requiredReviewsComplete) {
    add('REQUIRED_REVIEWS_INCOMPLETE', 'error', 'issue', '필수 검토단계를 완료하세요.', 'releaseReadiness.requiredReviewsComplete');
  }
  if (plan.releaseReadiness.unresolvedRequiredComments > 0) {
    add('REQUIRED_COMMENT_UNRESOLVED', 'error', 'issue', '미해결 필수 의견이 남아 있습니다.', 'releaseReadiness.unresolvedRequiredComments');
  }
  if (!plan.releaseReadiness.snapshotHashMatches) {
    add('SNAPSHOT_HASH_MISMATCH', 'error', 'issue', '승인 스냅샷, 템플릿 또는 도면 hash가 일치하지 않습니다.', 'releaseReadiness.snapshotHashMatches');
  }
  if (!plan.releaseReadiness.pdfVisualCheckPassed) {
    add('PDF_VISUAL_CHECK_FAILED', 'error', 'issue', 'PDF 시각 검사를 통과해야 합니다.', 'releaseReadiness.pdfVisualCheckPassed');
  }
  if (!plan.releaseReadiness.pdfTextCheckPassed) {
    add('PDF_TEXT_CHECK_FAILED', 'error', 'issue', 'PDF 텍스트 검사를 통과해야 합니다.', 'releaseReadiness.pdfTextCheckPassed');
  }

  if (plan.projectSnapshot.sitePhotos.length === 0) {
    add('SITE_PHOTO_MISSING', 'warning', 'review', '현장사진이 첨부되지 않았습니다.', 'projectSnapshot.sitePhotos');
  }
  if (!plan.projectSnapshot.emergencyContactsComplete) {
    add('EMERGENCY_CONTACT_INCOMPLETE', 'warning', 'review', '비상연락망을 확인하세요.', 'projectSnapshot.emergencyContactsComplete');
  }
  if (plan.projectSnapshot.differsFromMaster) {
    add('MASTER_SNAPSHOT_DIFFERS', 'warning', 'review', '현장 마스터와 계획서 스냅샷이 다릅니다.', 'projectSnapshot.differsFromMaster');
  }
  if (!plan.releaseReadiness.drawingLegendMonochromeDistinct) {
    add('MONOCHROME_LEGEND_UNCLEAR', 'warning', 'review', '흑백 출력에서도 도면 레이어를 구분할 수 있어야 합니다.', 'releaseReadiness.drawingLegendMonochromeDistinct');
  }
  const newerRegisteredTemplateAvailable = Boolean(
    selectedTemplate && selectedTemplate.key !== latestTemplate.key,
  );
  if (plan.releaseReadiness.latestTemplateAvailable || newerRegisteredTemplateAvailable) {
    add('LATEST_TEMPLATE_AVAILABLE', 'info', 'review', '더 최신 템플릿이 있습니다.', 'releaseReadiness.latestTemplateAvailable');
  }
  if (plan.releaseReadiness.latestDrawingRevisionAvailable) {
    add('LATEST_DRAWING_REVISION_AVAILABLE', 'info', 'review', '더 최신 승인도면 Rev.가 있습니다.', 'releaseReadiness.latestDrawingRevisionAvailable');
  }
  if (plan.releaseReadiness.workerRefreshAvailable) {
    add('WORKER_REFRESH_AVAILABLE', 'info', 'authoring', '담당팀 또는 작업자 정보를 갱신할 수 있습니다.', 'releaseReadiness.workerRefreshAvailable');
  }
  if (plan.releaseReadiness.recordAppendixAvailable) {
    add('RECORD_APPENDIX_AVAILABLE', 'info', 'issue', '완료기록 부록을 추가할 수 있습니다.', 'releaseReadiness.recordAppendixAvailable');
  }

  const errors = issues.filter((issue) => issue.severity === 'error');
  const warnings = issues.filter((issue) => issue.severity === 'warning');
  const information = issues.filter((issue) => issue.severity === 'info');
  const reviewBlockingErrors = errors.filter((issue) => issue.stage !== 'issue');

  return ConstructionPlanValidationResultSchema.parse({
    validContract: true,
    checkedAt,
    issues,
    errors,
    warnings,
    information,
    summary: {
      errors: errors.length,
      warnings: warnings.length,
      information: information.length,
    },
    canSubmitForReview: reviewBlockingErrors.length === 0,
    canIssue: errors.length === 0,
  });
};

export const toValidationSummary = (result: ConstructionPlanValidationResult) => ({
  errors: result.summary.errors,
  warnings: result.summary.warnings,
  checkedAt: result.checkedAt,
});
