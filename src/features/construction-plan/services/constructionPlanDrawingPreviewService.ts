import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../config/firebase';
import {
  ConstructionPlanDrawingPreviewResultSchema,
  EnsureConstructionPlanDrawingPreviewRequestSchema,
  type ConstructionPlanDrawingPreviewResult,
  type EnsureConstructionPlanDrawingPreviewRequest,
} from '../domain/drawingPreview';

export const ENSURE_CONSTRUCTION_PLAN_DRAWING_PREVIEW_CALLABLE =
  'ensureConstructionPlanDrawingPreviewServer';

/**
 * Ask the server to render or idempotently return the immutable per-page
 * manifest. The response parser fails closed before data reaches the editor.
 */
export const ensureConstructionPlanDrawingPreviewServer = async (
  rawRequest: EnsureConstructionPlanDrawingPreviewRequest,
): Promise<ConstructionPlanDrawingPreviewResult> => {
  const request = EnsureConstructionPlanDrawingPreviewRequestSchema.parse(rawRequest);
  const callable = httpsCallable<typeof request, unknown>(
    functions,
    ENSURE_CONSTRUCTION_PLAN_DRAWING_PREVIEW_CALLABLE,
  );
  const response = await callable(request);
  const parsed = ConstructionPlanDrawingPreviewResultSchema.safeParse(response.data);
  if (!parsed.success) {
    throw new Error('construction-plan-drawing-preview-invalid-response');
  }
  return parsed.data;
};

