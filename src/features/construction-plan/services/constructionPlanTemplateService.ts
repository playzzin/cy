import { httpsCallable } from 'firebase/functions';
import { z } from 'zod';
import { functions } from '../../../config/firebase';
import {
  getConstructionPlanTemplateByIdentity,
  type ConstructionPlanTemplateRegistryEntry,
} from '../domain/templateRegistry';
import { ConstructionPlanTradeTypeSchema, type ConstructionPlanTradeType } from '../types';

export const LIST_CONSTRUCTION_PLAN_TEMPLATES_CALLABLE =
  'listConstructionPlanTemplatesServer';
export const INITIALIZE_CONSTRUCTION_PLAN_TEMPLATE_CALLABLE =
  'initializeConstructionPlanTemplateServer';
export const TRANSITION_CONSTRUCTION_PLAN_TEMPLATE_CALLABLE =
  'transitionConstructionPlanTemplateLifecycleServer';

export const ConstructionPlanTemplateLifecycleSchema = z.enum([
  'draft',
  'in_review',
  'published',
  'retired',
]);
export const ConstructionPlanTemplateListLifecycleSchema = z.enum([
  'uninitialized',
  ...ConstructionPlanTemplateLifecycleSchema.options,
]);

const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const isoDateTime = z.string().refine(
  (value) => !Number.isNaN(Date.parse(value)),
  'Expected an ISO date-time string.',
);

export const ConstructionPlanTemplateListItemSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().regex(/^tpl_[a-f0-9]{40}$/),
  key: z.string().min(1).max(400),
  name: z.string().min(1).max(200),
  tradeType: ConstructionPlanTradeTypeSchema,
  templateId: z.string().min(1).max(160),
  templateVersion: z.string().min(1).max(80),
  rendererVersion: z.string().min(1).max(100),
  pageCount: z.number().int().positive(),
  manifestHash: sha256,
  templateBundleHash: sha256,
  initialized: z.boolean(),
  lifecycle: ConstructionPlanTemplateListLifecycleSchema,
  lifecycleVersion: z.number().int().min(0),
  isLatest: z.boolean(),
  selectableForNewPlan: z.boolean(),
  createdAt: isoDateTime.optional(),
  createdBy: z.string().min(1).max(200).optional(),
  createdByName: z.string().min(1).max(200).optional(),
  updatedAt: isoDateTime.optional(),
  updatedBy: z.string().min(1).max(200).optional(),
  updatedByName: z.string().min(1).max(200).optional(),
  reviewRequestedAt: isoDateTime.optional(),
  reviewRequestedBy: z.string().min(1).max(200).optional(),
  publishedAt: isoDateTime.optional(),
  publishedBy: z.string().min(1).max(200).optional(),
  retiredAt: isoDateTime.optional(),
  retiredBy: z.string().min(1).max(200).optional(),
  lastTransitionReason: z.string().min(1).max(500).optional(),
}).strict().superRefine((template, context) => {
  const expectedKey = `${template.tradeType}:${template.templateId}@${template.templateVersion}`;
  if (template.key !== expectedKey) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['key'],
      message: 'Template key and exact identity do not match.',
    });
  }
  if (template.initialized !== (template.lifecycle !== 'uninitialized')) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['initialized'],
      message: 'Initialized flag and lifecycle do not match.',
    });
  }
  if ((!template.initialized && template.lifecycleVersion !== 0)
    || (template.initialized && template.lifecycleVersion < 1)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['lifecycleVersion'],
      message: 'Uninitialized templates must have lifecycle version 0.',
    });
  }
  if (template.isLatest && template.lifecycle !== 'published') {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['isLatest'],
      message: 'Only a published template can be latest.',
    });
  }
  if (template.selectableForNewPlan !== (template.lifecycle === 'published')) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['selectableForNewPlan'],
      message: 'Only published templates may be selected for a new plan.',
    });
  }
  if (template.initialized && (!template.createdAt || !template.createdBy
    || !template.updatedAt || !template.updatedBy || !template.lastTransitionReason)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['createdAt'],
      message: 'Initialized templates require complete audit metadata.',
    });
  }
  if ((template.lifecycle === 'published' || template.lifecycle === 'retired')
    && (!template.publishedAt || !template.publishedBy)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['publishedAt'],
      message: 'Published history is required for published or retired templates.',
    });
  }
  if (template.lifecycle === 'retired' && (!template.retiredAt || !template.retiredBy)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['retiredAt'],
      message: 'Retired templates require retirement audit metadata.',
    });
  }
});

export const ConstructionPlanTemplateListResponseSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: isoDateTime,
  canManage: z.boolean(),
  templates: z.array(ConstructionPlanTemplateListItemSchema).max(100),
}).strict().superRefine((response, context) => {
  const keys = new Set<string>();
  response.templates.forEach((template, index) => {
    if (keys.has(template.key)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['templates', index, 'key'],
        message: 'Duplicate template identity.',
      });
    }
    keys.add(template.key);
  });
  (['system-shoring', 'system-scaffold'] as const).forEach((tradeType) => {
    const tradeTemplates = response.templates.filter((template) => template.tradeType === tradeType);
    const published = tradeTemplates.filter((template) => template.lifecycle === 'published');
    const latest = tradeTemplates.filter((template) => template.isLatest);
    if (latest.length > 1 || (published.length > 0 && latest.length !== 1)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['templates'],
        message: `Expected exactly one latest published template for ${tradeType}.`,
      });
    }
  });
});

export const ConstructionPlanTemplateMutationResponseSchema = z.object({
  schemaVersion: z.literal(1),
  template: ConstructionPlanTemplateListItemSchema,
  affectedTemplateKeys: z.array(z.string().min(1).max(400)).min(1).max(100),
  idempotent: z.boolean(),
}).strict();

const TemplateIdentityInputSchema = z.object({
  tradeType: ConstructionPlanTradeTypeSchema,
  templateId: z.string().trim().min(1).max(160),
  templateVersion: z.string().trim().min(1).max(80),
});

export const InitializeConstructionPlanTemplateInputSchema = TemplateIdentityInputSchema.extend({
  reason: z.string().trim().min(5).max(500),
  idempotencyKey: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/),
}).strict();

export const TransitionConstructionPlanTemplateInputSchema = TemplateIdentityInputSchema.extend({
  toLifecycle: ConstructionPlanTemplateLifecycleSchema,
  expectedLifecycleVersion: z.number().int().positive(),
  reason: z.string().trim().min(5).max(500),
  idempotencyKey: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/),
}).strict();

export type ConstructionPlanTemplateLifecycle = z.infer<
  typeof ConstructionPlanTemplateLifecycleSchema
>;
export type ConstructionPlanTemplateListLifecycle = z.infer<
  typeof ConstructionPlanTemplateListLifecycleSchema
>;
export type ConstructionPlanTemplateListItem = z.infer<
  typeof ConstructionPlanTemplateListItemSchema
>;
export type ConstructionPlanTemplateListResponse = z.infer<
  typeof ConstructionPlanTemplateListResponseSchema
>;
export type InitializeConstructionPlanTemplateInput = z.infer<
  typeof InitializeConstructionPlanTemplateInputSchema
>;
export type TransitionConstructionPlanTemplateInput = z.infer<
  typeof TransitionConstructionPlanTemplateInputSchema
>;

export type ConstructionPlanCreationTemplateCatalog = {
  source: 'server';
  templates: readonly ConstructionPlanTemplateRegistryEntry[];
  serverTemplates: readonly ConstructionPlanTemplateListItem[];
};

export type ConstructionPlanTemplateUpgradeProposal = {
  available: boolean;
  mode: 'new-revision-only';
  currentKey: string;
  latest?: ConstructionPlanTemplateListItem;
};

export const createConstructionPlanTemplateMutationIdempotencyKey = (
  operation: 'initialize' | 'transition',
): string => {
  const randomId = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `cp-template-${operation}-${randomId}`.slice(0, 128);
};

const callTemplateMutation = async <TInput>(
  callableName: string,
  input: TInput,
): Promise<z.infer<typeof ConstructionPlanTemplateMutationResponseSchema>> => {
  const callable = httpsCallable<TInput, unknown>(functions, callableName);
  const response = await callable(input);
  const parsed = ConstructionPlanTemplateMutationResponseSchema.safeParse(response.data);
  if (!parsed.success) {
    throw new Error(`construction-plan-template-invalid-response:${callableName}`);
  }
  return parsed.data;
};

export const listConstructionPlanTemplatesServer = async (
): Promise<ConstructionPlanTemplateListResponse> => {
  const callable = httpsCallable<Record<string, never>, unknown>(
    functions,
    LIST_CONSTRUCTION_PLAN_TEMPLATES_CALLABLE,
  );
  const response = await callable({});
  const parsed = ConstructionPlanTemplateListResponseSchema.safeParse(response.data);
  if (!parsed.success) {
    throw new Error('construction-plan-template-invalid-response:list');
  }
  return parsed.data;
};

export const initializeConstructionPlanTemplateServer = (
  rawInput: InitializeConstructionPlanTemplateInput,
) => callTemplateMutation(
  INITIALIZE_CONSTRUCTION_PLAN_TEMPLATE_CALLABLE,
  InitializeConstructionPlanTemplateInputSchema.parse(rawInput),
);

export const transitionConstructionPlanTemplateLifecycleServer = (
  rawInput: TransitionConstructionPlanTemplateInput,
) => callTemplateMutation(
  TRANSITION_CONSTRUCTION_PLAN_TEMPLATE_CALLABLE,
  TransitionConstructionPlanTemplateInputSchema.parse(rawInput),
);

const assertServerTemplateMatchesCodeContract = (
  serverTemplate: ConstructionPlanTemplateListItem,
): ConstructionPlanTemplateRegistryEntry => {
  const entry = getConstructionPlanTemplateByIdentity(serverTemplate);
  if (!entry
    || entry.manifest.rendererVersion !== serverTemplate.rendererVersion
    || entry.manifest.pages.length !== serverTemplate.pageCount) {
    throw new Error(
      `construction-plan-template-server-code-contract-mismatch:${serverTemplate.key}`,
    );
  }
  return entry;
};

/**
 * New plans fail closed unless the authoritative lifecycle catalog is
 * reachable and every selectable publication matches the local renderer
 * contract exactly. The code registry is never a substitute for publication.
 */
export const loadConstructionPlanCreationTemplateCatalog = async (
): Promise<ConstructionPlanCreationTemplateCatalog> => {
  const response = await listConstructionPlanTemplatesServer();
  const serverTemplates = response.templates.filter((template) => (
    template.lifecycle === 'published' && template.selectableForNewPlan
  ));
  return {
    source: 'server',
    serverTemplates,
    templates: serverTemplates.map(assertServerTemplateMatchesCodeContract),
  };
};

export const getConstructionPlanTemplateUpgradeProposal = (input: {
  tradeType: ConstructionPlanTradeType;
  templateId: string;
  templateVersion: string;
  templates: readonly ConstructionPlanTemplateListItem[];
}): ConstructionPlanTemplateUpgradeProposal => {
  const currentKey = `${input.tradeType}:${input.templateId}@${input.templateVersion}`;
  const latest = input.templates.find((template) => (
    template.tradeType === input.tradeType
    && template.lifecycle === 'published'
    && template.isLatest
  ));
  const semanticParts = (value: string): [number, number, number] | undefined => {
    const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value);
    if (!match) return undefined;
    const parts = match.slice(1).map(Number) as [number, number, number];
    return parts.every((part) => Number.isSafeInteger(part) && part >= 0) ? parts : undefined;
  };
  const currentParts = semanticParts(input.templateVersion);
  const latestParts = latest ? semanticParts(latest.templateVersion) : undefined;
  const latestIsNewer = Boolean(currentParts && latestParts && latestParts.some(
    (part, index) => part !== currentParts[index]
      && latestParts.slice(0, index).every((prefix, prefixIndex) => prefix === currentParts[prefixIndex])
      && part > currentParts[index],
  ));
  return {
    available: Boolean(latest && latest.key !== currentKey && latestIsNewer),
    mode: 'new-revision-only',
    currentKey,
    ...(latest && latest.key !== currentKey && latestIsNewer ? { latest } : {}),
  };
};

export const getConstructionPlanTemplateErrorMessage = (error: unknown): string => {
  const value = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  const code = String(value.code || '').toLowerCase();
  const message = error instanceof Error ? error.message : String(value.message || '');
  if (code.includes('permission-denied')) return '본사 또는 표준 템플릿 관리자 권한이 필요합니다.';
  if (code.includes('unauthenticated')) return '로그인 세션을 확인한 뒤 다시 시도하세요.';
  if (code.includes('unavailable') || code.includes('deadline-exceeded')) {
    return '표준 템플릿 서버에 연결할 수 없습니다. 네트워크 상태를 확인한 뒤 다시 시도하세요.';
  }
  if (code.includes('internal') || code.includes('not-found')) {
    return '시공계획서 템플릿 서버가 준비되지 않았거나 처리 중 오류가 발생했습니다. 관리자에게 최신 시공계획서 함수 배포와 서버 로그 확인을 요청해주세요.';
  }
  if (code.includes('aborted')) return '다른 관리자가 상태를 변경했습니다. 목록을 새로고침하세요.';
  if (code.includes('already-exists')) return '이미 처리된 요청이거나 동일 키가 다른 요청에 사용되었습니다.';
  if (code.includes('failed-precondition')) return message || '현재 상태에서 요청한 전이를 수행할 수 없습니다.';
  if (message.includes('invalid-response') || message.includes('contract-mismatch')) {
    return '서버 템플릿 계약 응답을 검증하지 못했습니다. 관리자에게 문의하세요.';
  }
  return '표준 템플릿 작업을 완료하지 못했습니다. 잠시 후 다시 시도하세요.';
};

export const constructionPlanTemplateService = {
  list: listConstructionPlanTemplatesServer,
  initialize: initializeConstructionPlanTemplateServer,
  transition: transitionConstructionPlanTemplateLifecycleServer,
  loadCreationCatalog: loadConstructionPlanCreationTemplateCatalog,
};

export default constructionPlanTemplateService;
