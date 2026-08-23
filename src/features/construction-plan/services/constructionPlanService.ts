import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  runTransaction,
  type DocumentData,
  type DocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { auth, db } from '../../../config/firebase';
import {
  ConstructionPlanSchema,
  ConstructionPlanLineageSchema,
  ConstructionPlanSeriesSchema,
  ConstructionPlanSummarySchema,
  ConstructionPlanWorkflowEventSchema,
  CreateConstructionPlanInputSchema,
  parseConstructionPlanWithLegacyDefaults,
  type ConstructionPlan,
  type ConstructionPlanLineage,
  type ConstructionPlanListOptions,
  type ConstructionPlanSeries,
  type ConstructionPlanWorkflowEvent,
  type CreateConstructionPlanInput,
  type EditLock,
  type EditLockResult,
  type OrganizationSnapshot,
  type PlanSection,
  type UpdateConstructionPlanInput,
  UpdateConstructionPlanInputSchema,
} from '../types';
import {
  applyConstructionPlanTechnicalReviewInvalidation,
  buildConstructionPlanDraft,
  formatSeoulCalendarDate,
  isPlanContentEditable,
} from '../domain';
import { getLatestConstructionPlanTemplate } from '../domain/templateRegistry';
import {
  createConstructionPlanDraftServer,
  getConstructionPlanLineageServer,
  listConstructionPlansServer,
} from './constructionPlanWorkflowApi';

export const CONSTRUCTION_PLANS_COLLECTION = 'constructionPlans';
export const CONSTRUCTION_PLAN_SERIES_COLLECTION = 'constructionPlanSeries';
export const CONSTRUCTION_PLAN_LOCAL_STORAGE_KEY_PREFIX = 'cy:construction-plans:v1';
export const DEFAULT_CONSTRUCTION_PLAN_LOCK_TTL_MS = 120_000;
export const DEFAULT_CONSTRUCTION_PLAN_LIST_POLL_INTERVAL_MS = 30_000;

type UnknownRecord = Record<string, unknown>;
type PlanListener = (plan: ConstructionPlan | null) => void;
type PlanListListener = (plans: ConstructionPlan[]) => void;
type ErrorListener = (error: Error) => void;
type EditLockUser = { id: string; name: string };

const localListListeners = new Set<() => void>();
const localPlanListeners = new Map<string, Set<() => void>>();
const memoryPlansByScope = new Map<string, ConstructionPlan[]>();

export const getConstructionPlanLocalStorageKey = (): string =>
  `${CONSTRUCTION_PLAN_LOCAL_STORAGE_KEY_PREFIX}:${auth.currentUser?.uid ?? 'anonymous'}`;

export class ConstructionPlanNotFoundError extends Error {
  constructor(planId: string) {
    super(`construction-plan-not-found:${planId}`);
    this.name = 'ConstructionPlanNotFoundError';
  }
}

export class ConstructionPlanConflictError extends Error {
  constructor(reason: string) {
    super(`construction-plan-conflict:${reason}`);
    this.name = 'ConstructionPlanConflictError';
  }
}

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asError = (value: unknown): Error =>
  value instanceof Error ? value : new Error(String(value));

const isTimestampLike = (value: unknown): value is { toDate: () => Date } =>
  isRecord(value) && typeof value.toDate === 'function';

const normalizeFirestoreValue = (value: unknown): unknown => {
  if (value instanceof Date) return value.toISOString();
  if (isTimestampLike(value)) {
    try {
      return value.toDate().toISOString();
    } catch (_error) {
      return value;
    }
  }
  if (Array.isArray(value)) return value.map(normalizeFirestoreValue);
  if (isRecord(value)) {
    return Object.entries(value).reduce<UnknownRecord>((result, [key, item]) => {
      result[key] = normalizeFirestoreValue(item);
      return result;
    }, {});
  }
  return value;
};

const parsePlanData = (id: string, value: unknown): ConstructionPlan => {
  const normalized = normalizeFirestoreValue(value);
  if (!isRecord(normalized)) throw new Error(`construction-plan-invalid-document:${id}`);
  return parseConstructionPlanWithLegacyDefaults({ ...normalized, id });
};

const getBrowserStorage = (): Storage | null => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch (_error) {
    return null;
  }
};

const readLocalPlans = (): ConstructionPlan[] => {
  const storageKey = getConstructionPlanLocalStorageKey();
  const memoryPlans = memoryPlansByScope.get(storageKey) ?? [];
  const storage = getBrowserStorage();
  if (!storage) return [...memoryPlans];
  try {
    const raw = storage.getItem(storageKey);
    if (raw === null) return [...memoryPlans];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...memoryPlans];
    const plans = parsed.map(parseConstructionPlanWithLegacyDefaults);
    memoryPlansByScope.set(storageKey, plans);
    return [...plans];
  } catch (_error) {
    return [...memoryPlans];
  }
};

const notifyLocalListeners = (changedPlanId?: string): void => {
  localListListeners.forEach((listener) => listener());
  if (changedPlanId) {
    localPlanListeners.get(changedPlanId)?.forEach((listener) => listener());
  } else {
    localPlanListeners.forEach((listeners) => listeners.forEach((listener) => listener()));
  }
};

const writeLocalPlans = (plans: readonly ConstructionPlan[], changedPlanId?: string): void => {
  const storageKey = getConstructionPlanLocalStorageKey();
  const memoryPlans = ConstructionPlanSchema.array().parse(plans);
  memoryPlansByScope.set(storageKey, memoryPlans);
  const storage = getBrowserStorage();
  if (storage) {
    try {
      storage.setItem(storageKey, JSON.stringify(memoryPlans));
    } catch (_error) {
      // The in-memory fallback remains available when quota/privacy mode blocks storage.
    }
  }
  notifyLocalListeners(changedPlanId);
};

const upsertLocalPlan = (plan: ConstructionPlan): ConstructionPlan => {
  const plans = readLocalPlans();
  const existingIndex = plans.findIndex((candidate) => candidate.id === plan.id);
  if (existingIndex >= 0) plans[existingIndex] = plan;
  else plans.push(plan);
  writeLocalPlans(plans, plan.id);
  return plan;
};

const cacheRemotePlans = (remotePlans: readonly ConstructionPlan[]): ConstructionPlan[] => {
  const parsed = ConstructionPlanSchema.array().parse(remotePlans);
  writeLocalPlans(parsed);
  return parsed;
};

const getLocalPlan = (planId: string): ConstructionPlan | null =>
  readLocalPlans().find((plan) => plan.id === planId) ?? null;

const isLocalFirstMode = (): boolean => {
  // Deliberately do not infer local-write authority from navigator.onLine.
  // Without an outbox/sync protocol, an automatic offline draft could appear
  // saved and then disappear when the remote data source becomes available.
  if (process.env.REACT_APP_CONSTRUCTION_PLAN_DATA_SOURCE === 'local') return true;
  return process.env.NODE_ENV === 'development'
    && process.env.REACT_APP_CONSTRUCTION_PLAN_LOCAL_FALLBACK === 'true';
};

const randomPlanId = (): string => {
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `cp-${Date.now().toString(36)}-${randomPart}`;
};

const randomIdempotencyKey = (): string => {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch (_error) {
    // Fall through to the local entropy source for older test/browser runtimes.
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
};

const filterPlans = (
  plans: readonly ConstructionPlan[],
  options?: ConstructionPlanListOptions,
): ConstructionPlan[] => {
  const search = options?.search?.trim().toLowerCase();
  const statuses = options?.statuses ? new Set(options.statuses) : null;
  const filtered = plans.filter((plan) => {
    if (options?.siteId && plan.siteId !== options.siteId) return false;
    if (statuses && !statuses.has(plan.status)) return false;
    if (search) {
      const searchable = [
        plan.title,
        plan.documentNo,
        plan.projectSnapshot.siteName,
      ].join(' ').toLowerCase();
      if (!searchable.includes(search)) return false;
    }
    return true;
  }).sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
  return options?.limit ? filtered.slice(0, options.limit) : filtered;
};

const parseDocumentPlan = (snapshot: DocumentSnapshot<DocumentData>): ConstructionPlan | null =>
  snapshot.exists() ? parsePlanData(snapshot.id, snapshot.data()) : null;

const normalizeDocumentNoKey = (documentNo: string): string => documentNo
  .normalize('NFKC')
  .trim()
  .toUpperCase()
  .replace(/\s+/g, '');

const summarizePlan = (plan: ConstructionPlan) => ConstructionPlanSummarySchema.parse(plan);

const WORKFLOW_EVENT_CORE_FIELDS = new Set([
  'id',
  'planId',
  'seriesId',
  'type',
  'action',
  'actorId',
  'actorName',
  'at',
  'createdAt',
  'fromStatus',
  'toStatus',
  'sourcePlanId',
  'targetPlanId',
  'revisionNo',
  'revision',
  'reason',
  'revisionType',
  'metadata',
]);

const parseWorkflowEventData = (
  id: string,
  planId: string,
  value: unknown,
): ConstructionPlanWorkflowEvent => {
  const normalized = normalizeFirestoreValue(value);
  if (!isRecord(normalized)) throw new Error(`construction-plan-invalid-workflow-event:${id}`);
  const type = typeof normalized.type === 'string'
    ? normalized.type
    : normalized.action;
  const at = typeof normalized.at === 'string'
    ? normalized.at
    : normalized.createdAt;
  const extraMetadata = Object.entries(normalized).reduce<UnknownRecord>((result, [key, item]) => {
    if (!WORKFLOW_EVENT_CORE_FIELDS.has(key)) result[key] = item;
    return result;
  }, {});
  const declaredMetadata = isRecord(normalized.metadata) ? normalized.metadata : {};
  const metadata = { ...extraMetadata, ...declaredMetadata };
  return ConstructionPlanWorkflowEventSchema.parse({
    id,
    planId: typeof normalized.planId === 'string' ? normalized.planId : planId,
    ...(typeof normalized.seriesId === 'string' ? { seriesId: normalized.seriesId } : {}),
    type,
    actorId: normalized.actorId,
    ...(typeof normalized.actorName === 'string' ? { actorName: normalized.actorName } : {}),
    at,
    ...(typeof normalized.fromStatus === 'string' ? { fromStatus: normalized.fromStatus } : {}),
    ...(typeof normalized.toStatus === 'string' ? { toStatus: normalized.toStatus } : {}),
    ...(typeof normalized.sourcePlanId === 'string' ? { sourcePlanId: normalized.sourcePlanId } : {}),
    ...(typeof normalized.targetPlanId === 'string' ? { targetPlanId: normalized.targetPlanId } : {}),
    ...(typeof normalized.revisionNo === 'number'
      ? { revisionNo: normalized.revisionNo }
      : typeof normalized.revision === 'number' ? { revisionNo: normalized.revision } : {}),
    ...(typeof normalized.reason === 'string' ? { reason: normalized.reason } : {}),
    ...(typeof normalized.revisionType === 'string' ? { revisionType: normalized.revisionType } : {}),
    ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
  });
};

const buildFallbackSeries = (
  current: ConstructionPlan,
  plans: readonly ConstructionPlan[],
): ConstructionPlanSeries => {
  const sorted = [...plans].sort((left, right) => left.revision - right.revision);
  const latest = sorted[sorted.length - 1] ?? current;
  const issued = [...sorted].reverse().find((plan) => Boolean(plan.issuedExportId));
  return ConstructionPlanSeriesSchema.parse({
    id: current.seriesId ?? `legacy-${current.id}`,
    siteId: current.siteId,
    documentNo: current.documentNo,
    documentNoKey: normalizeDocumentNoKey(current.documentNo),
    tradeType: current.tradeType,
    latestRevisionNo: latest.revision,
    latestPlanId: latest.id,
    ...(issued ? { latestIssuedPlanId: issued.id } : {}),
  });
};

const buildLineage = (
  current: ConstructionPlan,
  plansValue: readonly ConstructionPlan[],
  seriesValue?: ConstructionPlanSeries,
): ConstructionPlanLineage => {
  const plansById = new Map(plansValue.map((plan) => [plan.id, plan]));
  plansById.set(current.id, current);
  const plans = [...plansById.values()].sort((left, right) => (
    left.revision - right.revision || Date.parse(left.createdAt) - Date.parse(right.createdAt)
  ));
  const summaries = plans.map(summarizePlan);
  const currentIndex = summaries.findIndex((plan) => plan.id === current.id);
  return ConstructionPlanLineageSchema.parse({
    series: seriesValue ?? buildFallbackSeries(current, plans),
    plans: summaries,
    currentIndex,
    ...(currentIndex > 0 ? { previous: summaries[currentIndex - 1] } : {}),
    ...(currentIndex >= 0 && currentIndex < summaries.length - 1
      ? { next: summaries[currentIndex + 1] }
      : {}),
  });
};

const isActiveLock = (lock: EditLock | undefined, nowMillis: number): boolean =>
  Boolean(lock && lock.expiresAtEpochMs > nowMillis);

const isContentMutation = (input: UpdateConstructionPlanInput): boolean => {
  const contentFields: readonly (keyof UpdateConstructionPlanInput)[] = [
    'title',
    'documentDate',
    'projectSnapshot',
    'organizationSnapshot',
    'sections',
    'sectionOrder',
    'selectedSectionKeys',
    'drawings',
    'drawingApplicability',
    'engineeringValues',
    'equipmentPlan',
    'riskAssessments',
  ];
  return contentFields.some((field) => input[field] !== undefined);
};

const applyPlanUpdate = (
  current: ConstructionPlan,
  rawInput: UpdateConstructionPlanInput,
  timestamp: string,
): ConstructionPlan => {
  const input = UpdateConstructionPlanInputSchema.parse(rawInput);
  if (input.expectedLockVersion !== undefined && input.expectedLockVersion !== current.lockVersion) {
    throw new ConstructionPlanConflictError('stale-lock-version');
  }
  const nowMillis = Date.parse(timestamp);
  if (isActiveLock(current.editLock, nowMillis)
    && current.editLock?.userId !== input.updatedBy) {
    throw new ConstructionPlanConflictError('edit-lock-held-by-other');
  }
  if (!isPlanContentEditable(current.status) && isContentMutation(input)) {
    throw new ConstructionPlanConflictError(`content-locked-in-${current.status}`);
  }
  const {
    expectedLockVersion: _expectedLockVersion,
    projectSnapshot: projectScope,
    ...changes
  } = input;
  const projectSnapshot = projectScope
    ? {
      ...current.projectSnapshot,
      ...projectScope,
      // Read-time cleanup for legacy plans. Site-master media belongs in the
      // controlled drawing/photo pipelines, never in the project snapshot.
      sitePhotos: [],
    }
    : current.projectSnapshot;
  const next = ConstructionPlanSchema.parse({
    ...current,
    ...changes,
    projectSnapshot,
    id: current.id,
    createdAt: current.createdAt,
    lockVersion: current.lockVersion + 1,
    editLock: current.editLock,
    updatedBy: input.updatedBy,
    updatedAt: timestamp,
  });
  return applyConstructionPlanTechnicalReviewInvalidation(current, next);
};

const updateLocalPlan = (
  planId: string,
  input: UpdateConstructionPlanInput,
  timestamp: string,
): ConstructionPlan => {
  const current = getLocalPlan(planId);
  if (!current) throw new ConstructionPlanNotFoundError(planId);
  return upsertLocalPlan(applyPlanUpdate(current, input, timestamp));
};

export const listConstructionPlans = async (
  options?: ConstructionPlanListOptions,
): Promise<ConstructionPlan[]> => {
  if (isLocalFirstMode()) return filterPlans(readLocalPlans(), options);
  try {
    const plans = await listConstructionPlansServer(options ?? {});
    return filterPlans(cacheRemotePlans(plans), options);
  } catch (error) {
    throw asError(error);
  }
};

export const getConstructionPlan = async (planId: string): Promise<ConstructionPlan | null> => {
  if (!planId.trim()) return null;
  if (isLocalFirstMode()) return getLocalPlan(planId);
  try {
    const snapshot = await getDoc(doc(db, CONSTRUCTION_PLANS_COLLECTION, planId));
    const remote = parseDocumentPlan(snapshot);
    return remote ? upsertLocalPlan(remote) : null;
  } catch (error) {
    throw asError(error);
  }
};

export const listConstructionPlanWorkflowEvents = async (
  planId: string,
): Promise<ConstructionPlanWorkflowEvent[]> => {
  if (!planId.trim()) return [];
  if (isLocalFirstMode()) return [];
  try {
    const snapshot = await getDocs(collection(
      db,
      CONSTRUCTION_PLANS_COLLECTION,
      planId,
      'workflowEvents',
    ));
    return snapshot.docs
      .map((eventDocument) => parseWorkflowEventData(
        eventDocument.id,
        planId,
        eventDocument.data(),
      ))
      .sort((left, right) => Date.parse(left.at) - Date.parse(right.at));
  } catch (error) {
    throw asError(error);
  }
};

export const getConstructionPlanLineage = async (
  planId: string,
): Promise<ConstructionPlanLineage> => {
  if (isLocalFirstMode()) {
    const current = await getConstructionPlan(planId);
    if (!current) throw new ConstructionPlanNotFoundError(planId);
    if (!current.seriesId) return buildLineage(current, [current]);
    const localPlans = readLocalPlans().filter((plan) => plan.seriesId === current.seriesId);
    return buildLineage(current, localPlans);
  }
  try {
    return await getConstructionPlanLineageServer({ planId });
  } catch (error) {
    throw asError(error);
  }
};

export const createConstructionPlan = async (
  rawInput: CreateConstructionPlanInput,
): Promise<ConstructionPlan> => {
  const input = CreateConstructionPlanInputSchema.parse(rawInput);
  if (isLocalFirstMode()) {
    return upsertLocalPlan(buildConstructionPlanDraft(randomPlanId(), input));
  }
  try {
    const selectedTemplate = getLatestConstructionPlanTemplate(input.tradeType);
    if ((input.templateId && input.templateId !== selectedTemplate.manifest.id)
      || (input.templateVersion && input.templateVersion !== selectedTemplate.manifest.version)
      || (input.rendererVersion && input.rendererVersion !== selectedTemplate.manifest.rendererVersion)) {
      throw new Error('construction-plan-template-identity-invalid');
    }
    const documentDate = input.documentDate ?? formatSeoulCalendarDate();
    const title = input.title
      ?? `${input.siteName ?? '현장'} ${input.tradeType === 'system-scaffold' ? '시스템비계' : '시스템동바리'} 시공계획서`;
    const documentNo = input.documentNo
      ?? `CP-${input.siteId}-${documentDate.replace(/-/g, '')}`;
    const result = await createConstructionPlanDraftServer({
      siteId: input.siteId,
      title,
      documentNo,
      documentDate,
      tradeType: input.tradeType,
      templateId: selectedTemplate.manifest.id,
      templateVersion: selectedTemplate.manifest.version,
      ...(input.projectSnapshot ? { projectSnapshot: input.projectSnapshot } : {}),
      idempotencyKey: input.idempotencyKey ?? randomIdempotencyKey(),
    });
    const plan = await getConstructionPlan(result.planId);
    if (!plan) throw new ConstructionPlanNotFoundError(result.planId);
    return plan;
  } catch (error) {
    throw asError(error);
  }
};

export const updateConstructionPlan = async (
  planId: string,
  rawInput: UpdateConstructionPlanInput,
): Promise<ConstructionPlan> => {
  const input = UpdateConstructionPlanInputSchema.parse(rawInput);
  const timestamp = new Date().toISOString();
  if (isLocalFirstMode()) return updateLocalPlan(planId, input, timestamp);

  try {
    const reference = doc(db, CONSTRUCTION_PLANS_COLLECTION, planId);
    const updated = await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(reference);
      const current = parseDocumentPlan(snapshot);
      if (!current) throw new ConstructionPlanNotFoundError(planId);
      const next = applyPlanUpdate(current, input, timestamp);
      transaction.set(reference, next);
      return next;
    });
    return upsertLocalPlan(updated);
  } catch (error) {
    throw asError(error);
  }
};

export const saveConstructionPlanSections = (
  planId: string,
  sections: readonly PlanSection[],
  updatedBy: string,
  expectedLockVersion?: number,
): Promise<ConstructionPlan> => updateConstructionPlan(planId, {
  sections: [...sections],
  sectionOrder: sections.map((section) => section.id),
  updatedBy,
  ...(expectedLockVersion === undefined ? {} : { expectedLockVersion }),
});

export const saveConstructionPlanOrganization = (
  planId: string,
  organizationSnapshot: OrganizationSnapshot,
  updatedBy: string,
  expectedLockVersion?: number,
): Promise<ConstructionPlan> => updateConstructionPlan(planId, {
  organizationSnapshot,
  updatedBy,
  ...(expectedLockVersion === undefined ? {} : { expectedLockVersion }),
});

const subscribeLocalPlans = (
  options: ConstructionPlanListOptions | undefined,
  onNext: PlanListListener,
): Unsubscribe => {
  const publish = () => onNext(filterPlans(readLocalPlans(), options));
  localListListeners.add(publish);
  publish();
  const onStorage = (event: StorageEvent) => {
    if (event.key === getConstructionPlanLocalStorageKey()) publish();
  };
  if (typeof window !== 'undefined') window.addEventListener('storage', onStorage);
  return () => {
    localListListeners.delete(publish);
    if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage);
  };
};

const subscribeLocalPlan = (planId: string, onNext: PlanListener): Unsubscribe => {
  const publish = () => onNext(getLocalPlan(planId));
  const listeners = localPlanListeners.get(planId) ?? new Set<() => void>();
  listeners.add(publish);
  localPlanListeners.set(planId, listeners);
  publish();
  const onStorage = (event: StorageEvent) => {
    if (event.key === getConstructionPlanLocalStorageKey()) publish();
  };
  if (typeof window !== 'undefined') window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(publish);
    if (listeners.size === 0) localPlanListeners.delete(planId);
    if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage);
  };
};

export const subscribeConstructionPlans = (
  onNext: PlanListListener,
  options?: ConstructionPlanListOptions,
  onError?: ErrorListener,
): Unsubscribe => {
  if (isLocalFirstMode()) return subscribeLocalPlans(options, onNext);
  let stopped = false;
  let pollTimer: ReturnType<typeof setTimeout> | undefined;
  const poll = async (): Promise<void> => {
    try {
      const plans = await listConstructionPlans(options);
      if (!stopped) onNext(plans);
    } catch (error) {
      if (!stopped) onError?.(asError(error));
    } finally {
      if (!stopped) pollTimer = setTimeout(() => {
        void poll();
      }, DEFAULT_CONSTRUCTION_PLAN_LIST_POLL_INTERVAL_MS);
    }
  };
  void poll();
  return () => {
    stopped = true;
    if (pollTimer !== undefined) clearTimeout(pollTimer);
  };
};

export const subscribeConstructionPlan = (
  planId: string,
  onNext: PlanListener,
  onError?: ErrorListener,
): Unsubscribe => {
  if (isLocalFirstMode()) return subscribeLocalPlan(planId, onNext);
  try {
    return onSnapshot(
      doc(db, CONSTRUCTION_PLANS_COLLECTION, planId),
      (snapshot) => {
        const remote = parseDocumentPlan(snapshot);
        onNext(remote ? upsertLocalPlan(remote) : null);
      },
      (error) => {
        onError?.(asError(error));
      },
    );
  } catch (error) {
    throw asError(error);
  }
};

const buildEditLock = (
  user: EditLockUser,
  timestamp: string,
  ttlMs: number,
  acquiredAt = timestamp,
): EditLock => ({
  userId: user.id,
  userName: user.name,
  acquiredAt,
  heartbeatAt: timestamp,
  expiresAt: new Date(Date.parse(timestamp) + ttlMs).toISOString(),
  expiresAtEpochMs: Date.parse(timestamp) + ttlMs,
});

const acquireLocalLock = (
  planId: string,
  user: EditLockUser,
  ttlMs: number,
): EditLockResult => {
  const current = getLocalPlan(planId);
  if (!current) throw new ConstructionPlanNotFoundError(planId);
  const timestamp = new Date().toISOString();
  if (isActiveLock(current.editLock, Date.parse(timestamp))
    && current.editLock?.userId !== user.id) {
    return { acquired: false, plan: current, lock: current.editLock, reason: 'held_by_other' };
  }
  const lock = buildEditLock(user, timestamp, ttlMs,
    current.editLock?.userId === user.id ? current.editLock.acquiredAt : timestamp);
  const plan = ConstructionPlanSchema.parse({
    ...current,
    editLock: lock,
    lockVersion: current.lockVersion + 1,
    updatedBy: user.id,
    updatedAt: timestamp,
  });
  upsertLocalPlan(plan);
  return { acquired: true, plan, lock };
};

export const acquireConstructionPlanLock = async (
  planId: string,
  user: EditLockUser,
  ttlMs = DEFAULT_CONSTRUCTION_PLAN_LOCK_TTL_MS,
): Promise<EditLockResult> => {
  if (!user.id.trim() || !user.name.trim()) throw new Error('construction-plan-lock-user-required');
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) throw new Error('construction-plan-lock-ttl-invalid');
  if (isLocalFirstMode()) return acquireLocalLock(planId, user, ttlMs);
  try {
    const reference = doc(db, CONSTRUCTION_PLANS_COLLECTION, planId);
    const result = await runTransaction(db, async (transaction): Promise<EditLockResult> => {
      const snapshot = await transaction.get(reference);
      const current = parseDocumentPlan(snapshot);
      if (!current) throw new ConstructionPlanNotFoundError(planId);
      const timestamp = new Date().toISOString();
      if (isActiveLock(current.editLock, Date.parse(timestamp))
        && current.editLock?.userId !== user.id) {
        return { acquired: false, plan: current, lock: current.editLock, reason: 'held_by_other' };
      }
      const lock = buildEditLock(user, timestamp, ttlMs,
        current.editLock?.userId === user.id ? current.editLock.acquiredAt : timestamp);
      const plan = ConstructionPlanSchema.parse({
        ...current,
        editLock: lock,
        lockVersion: current.lockVersion + 1,
        updatedBy: user.id,
        updatedAt: timestamp,
      });
      transaction.update(reference, {
        editLock: lock,
        lockVersion: plan.lockVersion,
        updatedBy: plan.updatedBy,
        updatedAt: plan.updatedAt,
      });
      return { acquired: true, plan, lock };
    });
    upsertLocalPlan(result.plan);
    return result;
  } catch (error) {
    throw asError(error);
  }
};

const heartbeatLocalLock = (planId: string, userId: string, ttlMs: number): EditLockResult => {
  const current = getLocalPlan(planId);
  if (!current) throw new ConstructionPlanNotFoundError(planId);
  const timestamp = new Date().toISOString();
  if (!isActiveLock(current.editLock, Date.parse(timestamp))
    || current.editLock?.userId !== userId) {
    return { acquired: false, plan: current, lock: current.editLock, reason: 'held_by_other' };
  }
  const lock = buildEditLock(
    { id: userId, name: current.editLock.userName },
    timestamp,
    ttlMs,
    current.editLock.acquiredAt,
  );
  const plan = ConstructionPlanSchema.parse({
    ...current,
    editLock: lock,
    lockVersion: current.lockVersion + 1,
    updatedBy: userId,
    updatedAt: timestamp,
  });
  upsertLocalPlan(plan);
  return { acquired: true, plan, lock };
};

export const heartbeatConstructionPlanLock = async (
  planId: string,
  userId: string,
  ttlMs = DEFAULT_CONSTRUCTION_PLAN_LOCK_TTL_MS,
): Promise<EditLockResult> => {
  if (!userId.trim()) throw new Error('construction-plan-lock-user-required');
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) throw new Error('construction-plan-lock-ttl-invalid');
  if (isLocalFirstMode()) return heartbeatLocalLock(planId, userId, ttlMs);
  try {
    const reference = doc(db, CONSTRUCTION_PLANS_COLLECTION, planId);
    const result = await runTransaction(db, async (transaction): Promise<EditLockResult> => {
      const snapshot = await transaction.get(reference);
      const current = parseDocumentPlan(snapshot);
      if (!current) throw new ConstructionPlanNotFoundError(planId);
      const timestamp = new Date().toISOString();
      if (!isActiveLock(current.editLock, Date.parse(timestamp))
        || current.editLock?.userId !== userId) {
        return { acquired: false, plan: current, lock: current.editLock, reason: 'held_by_other' };
      }
      const lock = buildEditLock(
        { id: userId, name: current.editLock.userName },
        timestamp,
        ttlMs,
        current.editLock.acquiredAt,
      );
      const plan = ConstructionPlanSchema.parse({
        ...current,
        editLock: lock,
        lockVersion: current.lockVersion + 1,
        updatedBy: userId,
        updatedAt: timestamp,
      });
      transaction.update(reference, {
        editLock: lock,
        lockVersion: plan.lockVersion,
        updatedBy: plan.updatedBy,
        updatedAt: plan.updatedAt,
      });
      return { acquired: true, plan, lock };
    });
    upsertLocalPlan(result.plan);
    return result;
  } catch (error) {
    throw asError(error);
  }
};

const releaseLocalLock = (planId: string, userId: string): void => {
  const current = getLocalPlan(planId);
  if (!current) throw new ConstructionPlanNotFoundError(planId);
  if (!current.editLock || current.editLock.userId !== userId) return;
  const timestamp = new Date().toISOString();
  const { editLock: _editLock, ...withoutLock } = current;
  upsertLocalPlan(ConstructionPlanSchema.parse({
    ...withoutLock,
    lockVersion: current.lockVersion + 1,
    updatedBy: userId,
    updatedAt: timestamp,
  }));
};

export const releaseConstructionPlanLock = async (
  planId: string,
  userId: string,
): Promise<void> => {
  if (!userId.trim()) throw new Error('construction-plan-lock-user-required');
  if (isLocalFirstMode()) {
    releaseLocalLock(planId, userId);
    return;
  }
  try {
    const reference = doc(db, CONSTRUCTION_PLANS_COLLECTION, planId);
    const releasedPlan = await runTransaction(db, async (transaction): Promise<ConstructionPlan | null> => {
      const snapshot = await transaction.get(reference);
      const current = parseDocumentPlan(snapshot);
      if (!current) throw new ConstructionPlanNotFoundError(planId);
      if (!current.editLock || current.editLock.userId !== userId) return null;
      const timestamp = new Date().toISOString();
      const { editLock: _editLock, ...withoutLock } = current;
      const plan = ConstructionPlanSchema.parse({
        ...withoutLock,
        lockVersion: current.lockVersion + 1,
        updatedBy: userId,
        updatedAt: timestamp,
      });
      transaction.update(reference, {
        editLock: deleteField(),
        lockVersion: plan.lockVersion,
        updatedBy: plan.updatedBy,
        updatedAt: plan.updatedAt,
      });
      return plan;
    });
    if (releasedPlan) upsertLocalPlan(releasedPlan);
  } catch (error) {
    throw asError(error);
  }
};

export const constructionPlanService = {
  listPlans: listConstructionPlans,
  listConstructionPlans,
  createPlan: createConstructionPlan,
  createConstructionPlan,
  getPlan: getConstructionPlan,
  getConstructionPlan,
  listWorkflowEvents: listConstructionPlanWorkflowEvents,
  listConstructionPlanWorkflowEvents,
  getLineage: getConstructionPlanLineage,
  getConstructionPlanLineage,
  updatePlan: updateConstructionPlan,
  updateConstructionPlan,
  saveSections: saveConstructionPlanSections,
  saveOrganization: saveConstructionPlanOrganization,
  subscribePlans: subscribeConstructionPlans,
  subscribeConstructionPlans,
  subscribePlan: subscribeConstructionPlan,
  subscribeConstructionPlan,
  acquireLock: acquireConstructionPlanLock,
  acquireConstructionPlanLock,
  heartbeatLock: heartbeatConstructionPlanLock,
  heartbeatConstructionPlanLock,
  releaseLock: releaseConstructionPlanLock,
  releaseConstructionPlanLock,
};

export default constructionPlanService;
