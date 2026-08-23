import { httpsCallable } from 'firebase/functions';
import { z } from 'zod';
import { functions } from '../../../config/firebase';
import {
  ConstructionPlanSchema,
  ConstructionPlanErpFieldProvenanceSchema,
  ConstructionPlanWorkerDirectoryProvenanceSchema,
  OrganizationRoleAssignmentSchema,
  PlanStatusSchema,
  SafeWorkerDtoSchema,
  type ConstructionPlan,
  type ConstructionPlanErpSnapshot,
  type PlanStatus,
} from '../types';
import {
  diffConstructionPlanErpSnapshots,
  isConstructionPlanErpRefreshFieldId,
} from '../domain/erpSnapshotDiff';

export type ConstructionPlanOrganizationRefreshSelection = {
  refreshAssignedWorkers: boolean;
  refreshAdditionalWorkers: boolean;
  reassignments: Array<{ assignmentId: string; workerId: string }>;
};

export type ConstructionPlanOrganizationWorkerChange = {
  id: string;
  kind: 'new' | 'inactive' | 'missing' | 'team_changed' | 'profile_changed';
  workerId: string;
  before?: ConstructionPlanOrganizationSafeWorker;
  after?: ConstructionPlanOrganizationSafeWorker;
  assignmentIds: string[];
};

export type ConstructionPlanOrganizationSafeWorker = Omit<
  import('../types').SafeWorkerDto,
  'photoUrl' | 'contact'
>;

export type ConstructionPlanOrganizationRefreshComparison = {
  current: import('../types').OrganizationSnapshot;
  latestWorkers: ConstructionPlanOrganizationSafeWorker[];
  changes: ConstructionPlanOrganizationWorkerChange[];
  assignmentIssues: Array<{
    assignmentId: string;
    role: string;
    required: boolean;
    kind: 'inactive' | 'missing' | 'unassigned_required';
    worker?: ConstructionPlanOrganizationSafeWorker;
  }>;
  suggestedAdditionalWorkers: ConstructionPlanOrganizationSafeWorker[];
  additionalWorkersChanged: boolean;
  changed: boolean;
};

export const GET_CONSTRUCTION_PLAN_LATEST_ERP_SNAPSHOT_CALLABLE =
  'getConstructionPlanLatestErpSnapshotServer';
export const APPLY_CONSTRUCTION_PLAN_ERP_SNAPSHOT_FIELDS_CALLABLE =
  'applyConstructionPlanErpSnapshotFieldsServer';

const IsoDateTimeSchema = z.string().datetime({ offset: true });

const SafeSiteValueSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  code: z.string().optional(),
  address: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.string().optional(),
  responsibleTeamId: z.string().optional(),
  responsibleTeamName: z.string().optional(),
  clientCompanyId: z.string().optional(),
  clientCompanyName: z.string().optional(),
  contractorCompanyId: z.string().optional(),
  contractorCompanyName: z.string().optional(),
  partnerCompanyId: z.string().optional(),
  partnerCompanyName: z.string().optional(),
  siteType: z.string().optional(),
}).strict();

const SafeCompanyValueSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  code: z.string().optional(),
  businessNumber: z.string().optional(),
  representativeName: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  type: z.string().optional(),
  status: z.string().optional(),
}).strict();

const SafeTeamValueSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.string().optional(),
  leaderWorkerId: z.string().optional(),
  leaderName: z.string().optional(),
  companyId: z.string().optional(),
  companyName: z.string().optional(),
  parentTeamId: z.string().optional(),
  parentTeamName: z.string().optional(),
  status: z.string().optional(),
}).strict();

const sourced = <T extends z.ZodTypeAny>(
  value: T,
  source: 'site' | 'company' | 'team',
) => z.object({
  value,
  source: z.literal(source),
  sourceId: z.string().min(1),
  sourceUpdatedAt: IsoDateTimeSchema.optional(),
  capturedAt: IsoDateTimeSchema,
  overridden: z.boolean().optional(),
}).strict().superRefine((record, context) => {
  const projected = record.value as { id?: unknown };
  if (projected.id !== record.sourceId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['value', 'id'],
      message: 'ERP source value is not bound to its source id.',
    });
  }
});

const SafeErpSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  capturedAt: IsoDateTimeSchema,
  site: sourced(SafeSiteValueSchema, 'site'),
  clientCompany: sourced(SafeCompanyValueSchema, 'company').optional(),
  contractorCompany: sourced(SafeCompanyValueSchema, 'company').optional(),
  partnerCompany: sourced(SafeCompanyValueSchema, 'company').optional(),
  responsibleTeam: sourced(SafeTeamValueSchema, 'team').optional(),
  fieldProvenance: ConstructionPlanErpFieldProvenanceSchema.optional(),
}).strict();

const OrganizationSafeWorkerSchema = SafeWorkerDtoSchema.omit({
  photoUrl: true,
  contact: true,
}).strict();

const OrganizationSafeAssignmentSchema = OrganizationRoleAssignmentSchema.omit({
  worker: true,
}).extend({
  worker: OrganizationSafeWorkerSchema.optional(),
}).strict();

const OrganizationSafeSnapshotSchema = z.object({
  capturedAt: IsoDateTimeSchema,
  sourceSiteId: z.string().min(1).max(200).optional(),
  assignments: z.array(OrganizationSafeAssignmentSchema).max(50),
  additionalWorkers: z.array(OrganizationSafeWorkerSchema).max(500),
  workerDirectoryProvenance: ConstructionPlanWorkerDirectoryProvenanceSchema.optional(),
}).strict();

const OrganizationWorkerChangeIdSchema = z.string().min(1).max(500)
  .regex(/^[A-Za-z0-9._:-]+$/);

const OrganizationComparisonSchema = z.object({
  current: OrganizationSafeSnapshotSchema,
  latestWorkers: z.array(OrganizationSafeWorkerSchema).max(500),
  changes: z.array(z.object({
    id: OrganizationWorkerChangeIdSchema,
    kind: z.enum(['new', 'inactive', 'missing', 'team_changed', 'profile_changed']),
    workerId: z.string().min(1).max(200),
    before: OrganizationSafeWorkerSchema.optional(),
    after: OrganizationSafeWorkerSchema.optional(),
    assignmentIds: z.array(z.string().min(1).max(200)).max(50),
  }).strict()).max(1_000),
  assignmentIssues: z.array(z.object({
    assignmentId: z.string().min(1).max(200),
    role: z.string().min(1).max(80),
    required: z.boolean(),
    kind: z.enum(['inactive', 'missing', 'unassigned_required']),
    worker: OrganizationSafeWorkerSchema.optional(),
  }).strict()).max(50),
  suggestedAdditionalWorkers: z.array(OrganizationSafeWorkerSchema).max(500),
  additionalWorkersChanged: z.boolean(),
  changed: z.boolean(),
}).strict().superRefine((comparison, context) => {
  const latestIds = comparison.latestWorkers.map((worker) => worker.id);
  if (new Set(latestIds).size !== latestIds.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['latestWorkers'], message: 'Duplicate worker source id.' });
  }
  const changeIds = comparison.changes.map((change) => change.id);
  if (new Set(changeIds).size !== changeIds.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['changes'], message: 'Duplicate worker change id.' });
  }
  comparison.changes.forEach((change, index) => {
    if ((change.before && change.before.id !== change.workerId)
      || (change.after && change.after.id !== change.workerId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['changes', index],
        message: 'Worker change is not bound to its worker id.',
      });
    }
  });
  if (comparison.suggestedAdditionalWorkers.some((worker) => worker.status !== 'active')) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['suggestedAdditionalWorkers'],
      message: 'Suggested additional workers must be active.',
    });
  }
  const computedChanged = comparison.changes.length > 0
    || comparison.assignmentIssues.length > 0
    || comparison.additionalWorkersChanged;
  if (comparison.changed !== computedChanged) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['changed'], message: 'Worker diff flag mismatch.' });
  }
});

const safeFieldIds = (minimum = 0) => z.array(z.string()).min(minimum).max(100).superRefine((fieldIds, context) => {
  if (new Set(fieldIds).size !== fieldIds.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Duplicate ERP refresh field.' });
  }
  fieldIds.forEach((fieldId, index) => {
    if (!isConstructionPlanErpRefreshFieldId(fieldId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [index],
        message: 'Unsupported ERP refresh field.',
      });
    }
  });
});

const LatestResponseSchema = z.object({
  planId: z.string().min(1),
  status: PlanStatusSchema,
  lockVersion: z.number().int().nonnegative(),
  current: SafeErpSnapshotSchema.optional(),
  latest: SafeErpSnapshotSchema,
  changedFieldIds: safeFieldIds(),
  organizationComparison: OrganizationComparisonSchema,
  capturedAt: IsoDateTimeSchema,
}).strict();

export type ConstructionPlanLatestErpSnapshotResponse = {
  planId: string;
  status: PlanStatus;
  lockVersion: number;
  current?: ConstructionPlanErpSnapshot;
  latest: ConstructionPlanErpSnapshot;
  changedFieldIds: string[];
  organizationComparison: ConstructionPlanOrganizationRefreshComparison;
  capturedAt: string;
};

export type ApplyConstructionPlanErpSnapshotFieldsInput = {
  planId: string;
  expectedLockVersion: number;
  fieldIds: string[];
  reason: string;
  idempotencyKey: string;
  organizationSelection?: ConstructionPlanOrganizationRefreshSelection;
};

export type ApplyConstructionPlanErpSnapshotFieldsResponse = {
  planId: string;
  plan: ConstructionPlan;
  appliedFieldIds: string[];
  remainingFieldIds: string[];
  appliedOrganizationChangeIds: string[];
  remainingOrganizationChangeIds: string[];
  auditEventId: string;
  idempotent: boolean;
};

export type ConstructionPlanErpRefreshApplyAttempt = ApplyConstructionPlanErpSnapshotFieldsInput;

const ApplyResponseEnvelopeSchema = z.object({
  planId: z.string().min(1),
  plan: z.unknown(),
  appliedFieldIds: safeFieldIds(),
  remainingFieldIds: safeFieldIds(),
  appliedOrganizationChangeIds: z.array(OrganizationWorkerChangeIdSchema).max(100),
  remainingOrganizationChangeIds: z.array(OrganizationWorkerChangeIdSchema).max(1_100),
  auditEventId: z.string().min(1),
  idempotent: z.boolean(),
}).strict();

const normalizeOrganizationSelection = (
  value?: ConstructionPlanOrganizationRefreshSelection,
): ConstructionPlanOrganizationRefreshSelection | undefined => {
  if (!value) return undefined;
  const assignmentIds = value.reassignments.map((entry) => entry.assignmentId.trim());
  const reassignments = value.reassignments.map((entry) => ({
    assignmentId: entry.assignmentId.trim(),
    workerId: entry.workerId.trim(),
  })).sort((left, right) => left.assignmentId.localeCompare(right.assignmentId));
  if (typeof value.refreshAssignedWorkers !== 'boolean'
    || typeof value.refreshAdditionalWorkers !== 'boolean'
    || reassignments.length > 50
    || new Set(assignmentIds).size !== assignmentIds.length
    || reassignments.some((entry) => !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(entry.assignmentId)
      || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(entry.workerId))
    || (!value.refreshAssignedWorkers && !value.refreshAdditionalWorkers && reassignments.length === 0)) {
    throw new Error('construction-plan-erp-refresh-organization-selection-invalid');
  }
  return {
    refreshAssignedWorkers: value.refreshAssignedWorkers,
    refreshAdditionalWorkers: value.refreshAdditionalWorkers,
    reassignments,
  };
};

const expectedAppliedOrganizationChangeIds = (
  selection?: ConstructionPlanOrganizationRefreshSelection,
): string[] => selection ? [
  ...(selection.refreshAssignedWorkers ? ['organization.assignments'] : []),
  ...(selection.refreshAdditionalWorkers ? ['organization.additionalWorkers'] : []),
  ...selection.reassignments.map(({ assignmentId }) => `organization.assignment.${assignmentId}`),
].sort() : [];

export const createConstructionPlanErpRefreshIdempotencyKey = (): string => {
  const randomId = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `cp-erp-refresh-${randomId}`.slice(0, 128);
};

/** Keeps the exact version/key for a response-loss retry of the same user intent. */
export const resolveConstructionPlanErpRefreshApplyAttempt = (input: {
  planId: string;
  currentLockVersion: number;
  fieldIds: string[];
  reason: string;
  organizationSelection?: ConstructionPlanOrganizationRefreshSelection;
}, previous?: ConstructionPlanErpRefreshApplyAttempt): ConstructionPlanErpRefreshApplyAttempt => {
  const fieldIds = [...input.fieldIds].sort();
  const reason = input.reason.trim();
  const organizationSelection = normalizeOrganizationSelection(input.organizationSelection);
  const organizationFingerprint = JSON.stringify(organizationSelection ?? null);
  if (previous
    && previous.planId === input.planId
    && previous.reason === reason
    && previous.fieldIds.length === fieldIds.length
    && previous.fieldIds.every((fieldId, index) => fieldId === fieldIds[index])
    && JSON.stringify(previous.organizationSelection ?? null) === organizationFingerprint) {
    return previous;
  }
  return {
    planId: input.planId,
    expectedLockVersion: input.currentLockVersion,
    fieldIds,
    reason,
    idempotencyKey: createConstructionPlanErpRefreshIdempotencyKey(),
    ...(organizationSelection ? { organizationSelection } : {}),
  };
};

export const getConstructionPlanErpRefreshErrorMessage = (error: unknown): string => {
  const record = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  const code = String(record.code || '').toLowerCase();
  const message = error instanceof Error ? error.message : String(record.message || '');
  if (code.includes('unauthenticated')) return '로그인 세션을 확인한 뒤 다시 시도하세요.';
  if (code.includes('permission-denied')) return '이 계획서의 ERP 원천을 비교하거나 반영할 권한이 없습니다.';
  if (code.includes('data-loss')) return '계획서 또는 ERP 마스터의 출처 데이터가 손상되어 자동 처리하지 않았습니다. 관리자에게 데이터 복구를 요청하세요.';
  if (code.includes('invalid-argument')) return 'ERP 비교·반영 요청 형식이 올바르지 않습니다. 화면을 새로고침한 뒤 다시 시도하세요.';
  if (code.includes('aborted')) return '계획서가 다른 작업으로 변경되었습니다. 문서와 ERP 원천을 다시 불러오세요.';
  if (code.includes('already-exists')) return '같은 요청 식별자가 다른 반영 요청에 사용되었습니다. ERP 비교를 다시 시작하세요.';
  if (code.includes('failed-precondition')) {
    if (message.includes('원천 연결') || message.includes('그룹을 전체 선택')) {
      return '연결된 회사·팀 마스터가 바뀌었습니다. 해당 연결 ID와 명칭, 연결된 원천 구분 전체를 함께 선택하세요.';
    }
    if (message.includes('ERP 출처 스냅샷')) {
      return '현재 계획서의 ERP 출처를 검증할 수 없어 자동 반영하지 않았습니다. 관리자에게 데이터 복구를 요청하세요.';
    }
    if (message.includes('편집 잠금')) {
      return '유효한 편집 잠금이 없습니다. 문서를 다시 불러와 잠금을 획득한 뒤 비교하세요.';
    }
    return '문서 상태·편집 잠금·선택 필드가 변경되었습니다. 최신 원천을 다시 비교하세요.';
  }
  if (code.includes('not-found')) return '계획서 또는 연결된 ERP 마스터를 찾을 수 없습니다.';
  if (message.includes('invalid-response')) return '서버의 ERP 비교 응답을 검증하지 못했습니다. 다시 시도하세요.';
  return 'ERP 원천 데이터를 비교·반영하지 못했습니다. 네트워크 상태를 확인하세요.';
};

export const getConstructionPlanLatestErpSnapshotServer = async (
  planId: string,
): Promise<ConstructionPlanLatestErpSnapshotResponse> => {
  const callable = httpsCallable<{ planId: string }, unknown>(
    functions,
    GET_CONSTRUCTION_PLAN_LATEST_ERP_SNAPSHOT_CALLABLE,
  );
  const response = await callable({ planId });
  const parsed = LatestResponseSchema.safeParse(response.data);
  if (!parsed.success || parsed.data.planId !== planId) {
    throw new Error('construction-plan-erp-refresh-invalid-response:latest');
  }
  if (parsed.data.current) {
    const computedFieldIds = diffConstructionPlanErpSnapshots(
      parsed.data.current as ConstructionPlanErpSnapshot,
      parsed.data.latest as ConstructionPlanErpSnapshot,
    ).map((change) => change.id).sort();
    const declaredFieldIds = [...parsed.data.changedFieldIds].sort();
    if (computedFieldIds.length !== declaredFieldIds.length
      || computedFieldIds.some((fieldId, index) => fieldId !== declaredFieldIds[index])) {
      throw new Error('construction-plan-erp-refresh-invalid-response:diff-binding');
    }
  } else if (parsed.data.changedFieldIds.length > 0) {
    throw new Error('construction-plan-erp-refresh-invalid-response:diff-without-current');
  }
  return parsed.data as ConstructionPlanLatestErpSnapshotResponse;
};

export const applyConstructionPlanErpSnapshotFieldsServer = async (
  input: ApplyConstructionPlanErpSnapshotFieldsInput,
): Promise<ApplyConstructionPlanErpSnapshotFieldsResponse> => {
  const organizationSelection = normalizeOrganizationSelection(input.organizationSelection);
  if (!input.planId.trim()
    || !Number.isInteger(input.expectedLockVersion)
    || input.expectedLockVersion < 0
    || input.reason.trim().length < 5
    || input.reason.trim().length > 500
    || !input.idempotencyKey.trim()
    || input.idempotencyKey.trim().length > 128
    || new Set(input.fieldIds).size !== input.fieldIds.length
    || input.fieldIds.some((fieldId) => !isConstructionPlanErpRefreshFieldId(fieldId))
    || (input.fieldIds.length === 0 && !organizationSelection)) {
    throw new Error('construction-plan-erp-refresh-request-invalid');
  }
  const request = {
    planId: input.planId.trim(),
    expectedLockVersion: input.expectedLockVersion,
    fieldIds: [...input.fieldIds].sort(),
    reason: input.reason.trim(),
    idempotencyKey: input.idempotencyKey.trim(),
    ...(organizationSelection ? { organizationSelection } : {}),
  };
  const callable = httpsCallable<typeof request, unknown>(
    functions,
    APPLY_CONSTRUCTION_PLAN_ERP_SNAPSHOT_FIELDS_CALLABLE,
  );
  const response = await callable(request);
  const envelope = ApplyResponseEnvelopeSchema.safeParse(response.data);
  if (!envelope.success || envelope.data.planId !== request.planId) {
    throw new Error('construction-plan-erp-refresh-invalid-response:apply');
  }
  const planResult = ConstructionPlanSchema.safeParse(envelope.data.plan);
  if (!planResult.success || planResult.data.id !== request.planId) {
    throw new Error('construction-plan-erp-refresh-invalid-response:plan');
  }
  const minimumAppliedVersion = request.expectedLockVersion + 1;
  if ((!envelope.data.idempotent && planResult.data.lockVersion !== minimumAppliedVersion)
    || (envelope.data.idempotent && planResult.data.lockVersion < minimumAppliedVersion)) {
    throw new Error('construction-plan-erp-refresh-invalid-response:lock-version');
  }
  if (!envelope.data.idempotent
    && planResult.data.status !== 'draft'
    && planResult.data.status !== 'changes_requested') {
    throw new Error('construction-plan-erp-refresh-invalid-response:status');
  }
  if (envelope.data.appliedFieldIds.length !== request.fieldIds.length
    || envelope.data.appliedFieldIds.some((fieldId, index) => fieldId !== request.fieldIds[index])) {
    throw new Error('construction-plan-erp-refresh-invalid-response:applied-fields');
  }
  if (envelope.data.remainingFieldIds.some((fieldId) => request.fieldIds.includes(fieldId))) {
    throw new Error('construction-plan-erp-refresh-invalid-response:remaining-fields');
  }
  const expectedOrganizationIds = expectedAppliedOrganizationChangeIds(organizationSelection);
  const returnedOrganizationIds = [...envelope.data.appliedOrganizationChangeIds].sort();
  if (expectedOrganizationIds.length !== returnedOrganizationIds.length
    || expectedOrganizationIds.some((fieldId, index) => fieldId !== returnedOrganizationIds[index])) {
    throw new Error('construction-plan-erp-refresh-invalid-response:applied-organization-changes');
  }
  if (envelope.data.remainingOrganizationChangeIds.some(
    (changeId) => returnedOrganizationIds.includes(changeId),
  )) {
    throw new Error('construction-plan-erp-refresh-invalid-response:remaining-organization-changes');
  }
  if (request.fieldIds.some((fieldId) => {
    const entry = planResult.data.erpSnapshot?.fieldProvenance?.[fieldId];
    return !entry
      || entry.captureKind !== 'refresh'
      || entry.auditEventId !== envelope.data.auditEventId
      || entry.changeReason !== request.reason;
  })) {
    throw new Error('construction-plan-erp-refresh-invalid-response:field-provenance');
  }
  if (organizationSelection) {
    const provenance = planResult.data.organizationSnapshot.workerDirectoryProvenance;
    if (!provenance
      || provenance.captureKind !== 'refresh'
      || provenance.auditEventId !== envelope.data.auditEventId
      || provenance.changeReason !== request.reason) {
      throw new Error('construction-plan-erp-refresh-invalid-response:organization-provenance');
    }
  }
  return { ...envelope.data, plan: planResult.data };
};
