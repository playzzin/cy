import type { ConstructionPlan } from '../types';

export const CONSTRUCTION_PLAN_EDITOR_MODES = ['edit', 'preview', 'review'] as const;
export type ConstructionPlanEditorMode = typeof CONSTRUCTION_PLAN_EDITOR_MODES[number];

export const parseConstructionPlanEditorMode = (
  value: unknown,
): ConstructionPlanEditorMode | undefined => (
  typeof value === 'string'
    && CONSTRUCTION_PLAN_EDITOR_MODES.includes(value as ConstructionPlanEditorMode)
    ? value as ConstructionPlanEditorMode
    : undefined
);

export const constructionPlanStatusAllowsEditing = (
  status: ConstructionPlan['status'],
): boolean => status === 'draft' || status === 'changes_requested';

export type PersistedConstructionPlanEditorPosition = {
  schemaVersion: 1;
  planId: string;
  userId: string;
  sectionId: string;
  drawingWorkspace: boolean;
  rightTab: 'data' | 'review' | 'history' | 'validation';
  mode: ConstructionPlanEditorMode;
  centerScrollTopBySection: Record<string, number>;
  updatedAt: string;
};

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const storageKey = (planId: string, userId: string): string =>
  `cy:construction-plan-editor-position:v1:${encodeURIComponent(userId)}:${encodeURIComponent(planId)}`;

const MAX_PERSISTED_SCROLL_SECTIONS = 200;
const MAX_CENTER_SCROLL_TOP = 10_000_000;

const normalizedCenterScrollPositions = (input: unknown): Record<string, number> => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  return Object.fromEntries(Object.entries(input as Record<string, unknown>)
    .flatMap(([rawSectionId, rawScrollTop]) => {
      const sectionId = rawSectionId.trim();
      if (!sectionId || sectionId.length > 200
        || typeof rawScrollTop !== 'number'
        || !Number.isFinite(rawScrollTop)
        || rawScrollTop < 0) return [];
      return [[sectionId, Math.min(MAX_CENTER_SCROLL_TOP, Math.round(rawScrollTop))] as const];
    })
    .slice(0, MAX_PERSISTED_SCROLL_SECTIONS));
};

const parsePosition = (
  input: unknown,
  planId: string,
  userId: string,
): PersistedConstructionPlanEditorPosition | undefined => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return undefined;
  const value = input as Record<string, unknown>;
  if (value.schemaVersion !== 1 || value.planId !== planId || value.userId !== userId) return undefined;
  if (typeof value.sectionId !== 'string' || !value.sectionId.trim()) return undefined;
  if (typeof value.drawingWorkspace !== 'boolean') return undefined;
  if (!['data', 'review', 'history', 'validation'].includes(String(value.rightTab))) return undefined;
  if (typeof value.updatedAt !== 'string' || Number.isNaN(Date.parse(value.updatedAt))) return undefined;
  const mode = parseConstructionPlanEditorMode(value.mode) ?? 'edit';
  return {
    schemaVersion: 1,
    planId,
    userId,
    sectionId: value.sectionId.trim(),
    drawingWorkspace: value.drawingWorkspace,
    rightTab: value.rightTab as PersistedConstructionPlanEditorPosition['rightTab'],
    mode,
    centerScrollTopBySection: normalizedCenterScrollPositions(value.centerScrollTopBySection),
    updatedAt: value.updatedAt,
  };
};

export const readConstructionPlanEditorPosition = (
  planId: string,
  userId: string,
  storage: StorageLike | undefined = typeof window === 'undefined' ? undefined : window.localStorage,
): PersistedConstructionPlanEditorPosition | undefined => {
  if (!storage || !planId || !userId) return undefined;
  const key = storageKey(planId, userId);
  try {
    const raw = storage.getItem(key);
    if (!raw) return undefined;
    const parsed = parsePosition(JSON.parse(raw) as unknown, planId, userId);
    if (!parsed) storage.removeItem(key);
    return parsed;
  } catch {
    storage.removeItem(key);
    return undefined;
  }
};

/**
 * Deep-linked immutable review intent wins over URL and local preferences.
 * Non-authoring lifecycle states can never resolve to edit mode.
 */
export const resolveConstructionPlanEditorMode = (input: {
  planStatus: ConstructionPlan['status'];
  requestedMode?: unknown;
  persistedMode?: unknown;
  requestedTab?: string | null;
  snapshotDeepLink?: boolean;
}): ConstructionPlanEditorMode => {
  if (input.snapshotDeepLink || input.requestedTab === 'review') return 'review';
  const canEdit = constructionPlanStatusAllowsEditing(input.planStatus);
  const requested = parseConstructionPlanEditorMode(input.requestedMode);
  if (requested && (requested !== 'edit' || canEdit)) return requested;
  const persisted = parseConstructionPlanEditorMode(input.persistedMode);
  if (persisted && (persisted !== 'edit' || canEdit)) return persisted;
  return canEdit ? 'edit' : 'preview';
};

/** Preserves unrelated route state while keeping the mode query canonical. */
export const withConstructionPlanEditorModeSearchParams = (
  current: URLSearchParams,
  mode: ConstructionPlanEditorMode,
): URLSearchParams => {
  const next = new URLSearchParams(current);
  next.set('mode', mode);
  if (mode === 'review') next.set('tab', 'review');
  else if (next.get('tab') === 'review') next.delete('tab');
  return next;
};

export const writeConstructionPlanEditorPosition = (
  input: Omit<PersistedConstructionPlanEditorPosition, 'schemaVersion' | 'updatedAt' | 'centerScrollTopBySection'> & {
    centerScrollTopBySection?: Record<string, number>;
  },
  storage: StorageLike | undefined = typeof window === 'undefined' ? undefined : window.localStorage,
  now = new Date().toISOString(),
): PersistedConstructionPlanEditorPosition | undefined => {
  if (!storage || !input.planId || !input.userId || !input.sectionId) return undefined;
  const value: PersistedConstructionPlanEditorPosition = {
    schemaVersion: 1,
    ...input,
    centerScrollTopBySection: normalizedCenterScrollPositions(input.centerScrollTopBySection),
    updatedAt: now,
  };
  storage.setItem(storageKey(input.planId, input.userId), JSON.stringify(value));
  return value;
};

export const resolveConstructionPlanEditorCenterScrollTop = (
  position: Pick<PersistedConstructionPlanEditorPosition, 'centerScrollTopBySection'> | undefined,
  sectionId: string,
): number => normalizedCenterScrollPositions(position?.centerScrollTopBySection)[sectionId] ?? 0;

/**
 * Route intent always wins. A persisted position is used only when it still
 * points to a section in the current immutable plan revision.
 */
export const resolveConstructionPlanEditorSectionId = (
  plan: Pick<ConstructionPlan, 'sections' | 'drawings'>,
  options: { drawingId?: string; persistedSectionId?: string } = {},
): string => {
  if (options.drawingId) {
    const routeSection = plan.sections.find((section) => (
      section.kind === 'drawing-page'
      && section.content.drawingId === options.drawingId
    ));
    if (routeSection) return routeSection.id;

    const drawing = plan.drawings.find((candidate) => candidate.id === options.drawingId);
    if (drawing) {
      const metadataMatch = plan.sections.find((section) => (
        section.kind === 'drawing-page'
        && (
          section.content.drawingNo === drawing.drawingNo
          || section.content.drawingSlot === drawing.drawingNo
        )
      ));
      if (metadataMatch) return metadataMatch.id;
    }
  }

  if (options.persistedSectionId
    && plan.sections.some((section) => section.id === options.persistedSectionId)) {
    return options.persistedSectionId;
  }
  return plan.sections[0]?.id ?? '';
};
