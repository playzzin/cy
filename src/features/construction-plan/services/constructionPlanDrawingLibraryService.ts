import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../config/firebase';
import {
  ConstructionPlanMutationResultSchema,
  parseConstructionPlanWithLegacyDefaults,
  type ConstructionPlan,
  type ConstructionPlanMutationResult,
  type PlanDrawing,
  type PlanSection,
} from '../types';

export const LIST_CONSTRUCTION_PLAN_DRAWING_LIBRARY_CALLABLE =
  'listConstructionPlanDrawingLibraryServer';
export const IMPORT_CONSTRUCTION_PLAN_DRAWING_LIBRARY_CALLABLE =
  'importConstructionPlanDrawingFromLibraryServer';
export const GET_CONSTRUCTION_PLAN_DRAWING_REUSE_DERIVATION_STATUS_CALLABLE =
  'getConstructionPlanDrawingReuseDerivationStatusServer';

export type ConstructionPlanDrawingLibraryItem = {
  sourcePlanId: string;
  sourcePlanTitle: string;
  sourceDocumentNo: string;
  sourcePlanRevision: number;
  sourcePlanStatus: string;
  drawingId: string;
  drawingNo: string;
  title: string;
  originalFileName: string;
  mimeType: 'application/pdf' | 'image/png' | 'image/jpeg' | '';
  sizeBytes: number;
  sourceSha256: string;
  approvalStatus: string;
  reusable: boolean;
  reuseBlockReason?: string;
};

export type ListConstructionPlanDrawingLibraryRequest = {
  targetPlanId: string;
  pageSize?: number;
  cursor?: string;
};

export type ListConstructionPlanDrawingLibraryResponse = {
  items: ConstructionPlanDrawingLibraryItem[];
  nextCursor?: string;
};

export type ImportConstructionPlanDrawingRequest = {
  targetPlanId: string;
  targetSectionId: string;
  sourcePlanId: string;
  sourceDrawingId: string;
  expectedLockVersion: number;
  idempotencyKey: string;
};

export type ImportConstructionPlanDrawingResponse = {
  planId: string;
  sourcePlanId: string;
  sourceDrawingId: string;
  targetDrawingId: string;
  lockVersion: number;
  plan: ConstructionPlan;
  drawing: PlanDrawing & { sourceRevision: number };
  section: PlanSection;
  idempotent: boolean;
};

export type ConstructionPlanDerivationDrawingReuseStatus =
  | { status: 'not_started' }
  | { status: 'queued' | 'copying' | 'ready'; targetPlanId: string }
  | { status: 'failed'; targetPlanId: string; errorCode?: string }
  | { status: 'completed'; targetPlanId: string; result: ConstructionPlanMutationResult };

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const requiredString = (value: unknown, field: string, maximum = 500): string => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maximum) {
    throw new Error(`construction-plan-drawing-library-invalid-response:${field}`);
  }
  return value.trim();
};

const optionalString = (value: unknown, field: string, maximum = 500): string | undefined => {
  if (value === undefined) return undefined;
  return requiredString(value, field, maximum);
};

const nonNegativeInteger = (value: unknown, field: string): number => {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`construction-plan-drawing-library-invalid-response:${field}`);
  }
  return value;
};

const parseLibraryItem = (value: unknown): ConstructionPlanDrawingLibraryItem => {
  if (!isRecord(value)) {
    throw new Error('construction-plan-drawing-library-invalid-response:item');
  }
  const allowed = new Set([
    'sourcePlanId', 'sourcePlanTitle', 'sourceDocumentNo', 'sourcePlanRevision',
    'sourcePlanStatus', 'drawingId', 'drawingNo', 'title', 'originalFileName',
    'mimeType', 'sizeBytes', 'sourceSha256', 'approvalStatus', 'reusable',
    'reuseBlockReason',
  ]);
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    // In particular, Storage paths/generations are never exposed to the browser
    // library. The import callable resolves and validates those server-side.
    throw new Error('construction-plan-drawing-library-invalid-response:unsafe-field');
  }
  const mimeType = value.mimeType;
  if (mimeType !== '' && mimeType !== 'application/pdf'
    && mimeType !== 'image/png' && mimeType !== 'image/jpeg') {
    throw new Error('construction-plan-drawing-library-invalid-response:mimeType');
  }
  if (typeof value.reusable !== 'boolean') {
    throw new Error('construction-plan-drawing-library-invalid-response:reusable');
  }
  const sourceSha256 = value.sourceSha256 === ''
    ? ''
    : requiredString(value.sourceSha256, 'sourceSha256', 64).toLowerCase();
  if (sourceSha256 && !/^[a-f0-9]{64}$/.test(sourceSha256)) {
    throw new Error('construction-plan-drawing-library-invalid-response:sourceSha256');
  }
  if (value.reusable && !sourceSha256) {
    throw new Error('construction-plan-drawing-library-invalid-response:reusable-sha256');
  }
  return {
    sourcePlanId: requiredString(value.sourcePlanId, 'sourcePlanId', 200),
    sourcePlanTitle: requiredString(value.sourcePlanTitle, 'sourcePlanTitle', 240),
    sourceDocumentNo: requiredString(value.sourceDocumentNo, 'sourceDocumentNo', 160),
    sourcePlanRevision: nonNegativeInteger(value.sourcePlanRevision, 'sourcePlanRevision'),
    sourcePlanStatus: requiredString(value.sourcePlanStatus, 'sourcePlanStatus', 80),
    drawingId: requiredString(value.drawingId, 'drawingId', 200),
    drawingNo: requiredString(value.drawingNo, 'drawingNo', 200),
    title: requiredString(value.title, 'title', 240),
    originalFileName: requiredString(value.originalFileName, 'originalFileName', 255),
    mimeType,
    sizeBytes: nonNegativeInteger(value.sizeBytes, 'sizeBytes'),
    sourceSha256,
    approvalStatus: requiredString(value.approvalStatus, 'approvalStatus', 80),
    reusable: value.reusable,
    ...(optionalString(value.reuseBlockReason, 'reuseBlockReason', 500)
      ? { reuseBlockReason: optionalString(value.reuseBlockReason, 'reuseBlockReason', 500) }
      : {}),
  };
};

export const listConstructionPlanDrawingLibrary = async (
  request: ListConstructionPlanDrawingLibraryRequest,
): Promise<ListConstructionPlanDrawingLibraryResponse> => {
  const callable = httpsCallable<ListConstructionPlanDrawingLibraryRequest, unknown>(
    functions,
    LIST_CONSTRUCTION_PLAN_DRAWING_LIBRARY_CALLABLE,
  );
  const response = await callable(request);
  if (!isRecord(response.data) || !Array.isArray(response.data.items)) {
    throw new Error('construction-plan-drawing-library-invalid-response:list');
  }
  return {
    items: response.data.items.map(parseLibraryItem),
    ...(optionalString(response.data.nextCursor, 'nextCursor', 1_000)
      ? { nextCursor: optionalString(response.data.nextCursor, 'nextCursor', 1_000) }
      : {}),
  };
};

export const importConstructionPlanDrawingFromLibrary = async (
  request: ImportConstructionPlanDrawingRequest,
): Promise<ImportConstructionPlanDrawingResponse> => {
  const callable = httpsCallable<ImportConstructionPlanDrawingRequest, unknown>(
    functions,
    IMPORT_CONSTRUCTION_PLAN_DRAWING_LIBRARY_CALLABLE,
  );
  const response = await callable(request);
  if (!isRecord(response.data) || !isRecord(response.data.plan)) {
    throw new Error('construction-plan-drawing-library-invalid-response:import');
  }
  const data = response.data;
  const plan = parseConstructionPlanWithLegacyDefaults(data.plan);
  const planId = requiredString(data.planId, 'planId', 200);
  const sourcePlanId = requiredString(data.sourcePlanId, 'sourcePlanId', 200);
  const sourceDrawingId = requiredString(data.sourceDrawingId, 'sourceDrawingId', 200);
  const targetDrawingId = requiredString(data.targetDrawingId, 'targetDrawingId', 200);
  const lockVersion = nonNegativeInteger(data.lockVersion, 'lockVersion');
  if (typeof data.idempotent !== 'boolean'
    || plan.id !== planId
    || plan.lockVersion !== lockVersion) {
    throw new Error('construction-plan-drawing-library-invalid-response:plan-binding');
  }
  const drawing = plan.drawings.find((candidate) => candidate.id === targetDrawingId);
  const rawResponseSection = data.section;
  const responseSectionId = isRecord(rawResponseSection) && typeof rawResponseSection.id === 'string'
    ? rawResponseSection.id
    : undefined;
  const responseSection = responseSectionId
    ? plan.sections.find((candidate) => candidate.id === responseSectionId)
    : undefined;
  if (!drawing || !responseSection
    || drawing.planId !== planId
    || !drawing.storagePath.startsWith(`construction-plans/${plan.siteId}/${planId}/drawings/${targetDrawingId}/rev-1/source.`)
    || !drawing.sourceGeneration
    || drawing.sourceRevision !== 1
    || drawing.approvalStatus !== 'draft') {
    throw new Error('construction-plan-drawing-library-invalid-response:drawing-binding');
  }
  return {
    planId,
    sourcePlanId,
    sourceDrawingId,
    targetDrawingId,
    lockVersion,
    plan,
    drawing: drawing as PlanDrawing & { sourceRevision: number },
    section: responseSection,
    idempotent: data.idempotent,
  };
};

export const getConstructionPlanDerivationDrawingReuseStatus = async (request: {
  operation: 'revision' | 'clone';
  idempotencyKey: string;
}): Promise<ConstructionPlanDerivationDrawingReuseStatus> => {
  const callable = httpsCallable<typeof request, unknown>(
    functions,
    GET_CONSTRUCTION_PLAN_DRAWING_REUSE_DERIVATION_STATUS_CALLABLE,
  );
  const response = await callable(request);
  if (!isRecord(response.data)) {
    throw new Error('construction-plan-drawing-reuse-status-invalid-response');
  }
  const status = response.data.status;
  if (status === 'not_started') return { status };
  if (status !== 'queued' && status !== 'copying' && status !== 'ready'
    && status !== 'failed' && status !== 'completed') {
    throw new Error('construction-plan-drawing-reuse-status-invalid-response');
  }
  const targetPlanId = requiredString(response.data.targetPlanId, 'targetPlanId', 200);
  if (status === 'completed') {
    const result = ConstructionPlanMutationResultSchema.safeParse(response.data.result);
    if (!result.success || result.data.planId !== targetPlanId) {
      throw new Error('construction-plan-drawing-reuse-status-invalid-response:result');
    }
    return { status, targetPlanId, result: result.data };
  }
  if (status === 'failed') {
    return {
      status,
      targetPlanId,
      ...(optionalString(response.data.errorCode, 'errorCode', 160)
        ? { errorCode: optionalString(response.data.errorCode, 'errorCode', 160) }
        : {}),
    };
  }
  return { status, targetPlanId };
};

export const createConstructionPlanDrawingLibraryImportIdempotencyKey = (): string => {
  const random = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `cp-drawing-reuse-${random}`.slice(0, 128);
};
