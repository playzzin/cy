import { httpsCallable } from 'firebase/functions';
import { ref, uploadBytesResumable, type UploadTask } from 'firebase/storage';
import { z } from 'zod';
import { functions, storage } from '../../../config/firebase';
import {
  DrawingApplicabilityDecisionSchema,
  PlanDrawingSchema,
  PlanSectionSchema,
  type DrawingApplicabilityDecision,
  type PlanDrawing,
  type PlanSection,
} from '../types';

export const START_CONSTRUCTION_PLAN_DRAWING_UPLOAD_CALLABLE =
  'startConstructionPlanDrawingUploadServer';
export const FINALIZE_CONSTRUCTION_PLAN_DRAWING_UPLOAD_CALLABLE =
  'finalizeConstructionPlanDrawingUploadServer';

const MAX_DRAWING_SIZE_BYTES = 50 * 1024 * 1024;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export type ConstructionPlanDrawingUploadStage =
  | 'hashing'
  | 'creating_session'
  | 'uploading'
  | 'verifying'
  | 'completed';

export type ConstructionPlanDrawingUploadProgress = {
  stage: ConstructionPlanDrawingUploadStage;
  percent: number;
};

export type ConstructionPlanDrawingUploadInput = {
  planId: string;
  sectionId: string;
  drawingId: string;
  file: File;
  expectedLockVersion?: number;
  /** Keep this value for a user-initiated retry of the same file. */
  idempotencyKey?: string;
  onProgress?: (progress: ConstructionPlanDrawingUploadProgress) => void;
};

export type ConstructionPlanDrawingUploadCancelHandle = {
  /** Returns false once server finalization has begun or the operation settled. */
  cancel: () => boolean;
  readonly canceled: boolean;
  readonly canCancel: boolean;
};

export type ConstructionPlanDrawingUploadOperation = {
  result: Promise<ConstructionPlanDrawingUploadResult>;
  cancelHandle: ConstructionPlanDrawingUploadCancelHandle;
};

export type ConstructionPlanDrawingUploadResult = {
  sessionId: string;
  planId: string;
  sectionId: string;
  drawingId: string;
  storagePath: string;
  sourceSha256: string;
  sourceGeneration: string;
  mimeType: 'application/pdf' | 'image/png' | 'image/jpeg';
  sizeBytes: number;
  sourceRevision: number;
  lockVersion: number;
  updatedAt: string;
  drawing: PlanDrawing;
  section: PlanSection;
  drawingApplicability: DrawingApplicabilityDecision[];
  idempotent: boolean;
};

const CANCELED_ERROR_CODE = 'construction-plan-drawing-upload-canceled';

export const isConstructionPlanDrawingUploadCanceledError = (error: unknown): boolean =>
  error instanceof Error && error.message === CANCELED_ERROR_CODE;

const FinalizeResultSchema = z.object({
  sessionId: z.string().min(1),
  planId: z.string().min(1),
  sectionId: z.string().min(1),
  drawingId: z.string().min(1),
  storagePath: z.string().regex(
    /^construction-plans\/[^/]+\/[^/]+\/drawings\/[^/]+\/rev-\d+\/source\.(?:pdf|png|jpg)$/,
  ),
  sourceSha256: z.string().regex(SHA256_PATTERN),
  sourceGeneration: z.string().regex(/^\d+$/),
  mimeType: z.enum(['application/pdf', 'image/png', 'image/jpeg']),
  sizeBytes: z.number().int().positive().max(MAX_DRAWING_SIZE_BYTES),
  sourceRevision: z.number().int().positive().max(9999),
  lockVersion: z.number().int().nonnegative(),
  updatedAt: z.string().datetime({ offset: true }),
  drawing: PlanDrawingSchema,
  section: PlanSectionSchema,
  drawingApplicability: z.array(DrawingApplicabilityDecisionSchema),
  idempotent: z.boolean(),
});

const StartSessionSchema = z.object({
  sessionId: z.string().min(1),
  status: z.enum(['awaiting_upload', 'completed']),
  planId: z.string().min(1),
  sectionId: z.string().min(1),
  drawingId: z.string().min(1),
  stagingPath: z.string().regex(/^construction-plan-staging\/[^/]+\/[^/]+\/source$/),
  canonicalPath: z.string().regex(
    /^construction-plans\/[^/]+\/[^/]+\/drawings\/[^/]+\/rev-\d+\/source\.(?:pdf|png|jpg)$/,
  ),
  sourceRevision: z.number().int().positive().max(9999),
  expiresAt: z.string().datetime({ offset: true }),
  expiresAtEpochMs: z.number().int().positive(),
  result: FinalizeResultSchema.optional(),
  idempotent: z.boolean(),
});

type UploadMimeType = ConstructionPlanDrawingUploadResult['mimeType'];

export const detectConstructionPlanDrawingFileMime = (bytes: Uint8Array): UploadMimeType | null => {
  if (bytes.length >= 8
    && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) {
    return 'image/png';
  }
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (bytes.length >= 5
    && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44
    && bytes[3] === 0x46 && bytes[4] === 0x2d) {
    return 'application/pdf';
  }
  return null;
};

const bytesToHex = (bytes: Uint8Array): string => Array.from(bytes)
  .map((value) => value.toString(16).padStart(2, '0'))
  .join('');

export const sha256ConstructionPlanDrawingFile = async (bytes: ArrayBuffer): Promise<string> => {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  const digestBytes = new Uint8Array(digest);
  if (digestBytes.byteLength !== 32) {
    throw new Error('construction-plan-drawing-upload-sha256-digest-invalid');
  }
  return bytesToHex(digestBytes);
};

export const createConstructionPlanDrawingUploadIdempotencyKey = (): string => {
  const randomId = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `cp-drawing-upload-${randomId}`.slice(0, 128);
};

export const getConstructionPlanDrawingUploadErrorMessage = (error: unknown): string => {
  const record = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  const code = String(record.code || '').toLowerCase();
  const message = error instanceof Error ? error.message : String(record.message || '');
  if (message === CANCELED_ERROR_CODE) return '도면 업로드를 취소했습니다. 도면 작업공간에서 파일을 다시 선택할 수 있습니다.';
  if (message.includes('source-not-saved')) return '저장 대기 중인 문서 내용을 먼저 저장한 뒤 도면을 다시 등록하세요.';
  if (message.includes('size-invalid')) return '도면 원본은 50MB 이하의 파일이어야 합니다.';
  if (message.includes('magic-invalid')) return 'PDF, PNG, JPG 형식의 실제 도면 원본만 등록할 수 있습니다.';
  if (message.includes('digest-invalid')) return '브라우저에서 원본 무결성 해시를 계산하지 못했습니다. 최신 브라우저에서 다시 시도하세요.';
  if (code.includes('unauthenticated')) return '로그인 세션을 확인한 뒤 다시 시도하세요.';
  if (code.includes('permission-denied')) return '이 계획서의 도면을 등록할 권한이 없습니다.';
  if (code.includes('deadline-exceeded')) return '보안 업로드 세션이 만료되었습니다. 도면을 다시 선택하세요.';
  if (code.includes('already-exists')) return '동일한 불변 도면 경로가 이미 사용 중입니다. 문서를 새로고침한 뒤 다시 등록하세요.';
  if (code.includes('aborted')) return '도면 또는 문서가 다른 작업에서 변경되었습니다. 새로고침 후 다시 시도하세요.';
  if (code.includes('failed-precondition')) return '작성 상태와 편집 잠금을 확인한 뒤 다시 시도하세요.';
  if (code.includes('data-loss') || message.includes('binding-mismatch') || message.includes('invalid-')) {
    return '도면 원본 검증에 실패했습니다. 파일을 다시 선택하고 문제가 계속되면 관리자에게 문의하세요.';
  }
  return '도면 원본을 안전하게 등록하지 못했습니다. 네트워크 상태를 확인하고 다시 시도하세요.';
};

const uploadStagingObject = (
  file: File,
  session: z.infer<typeof StartSessionSchema>,
  mimeType: UploadMimeType,
  sourceSha256: string,
  onProgress?: ConstructionPlanDrawingUploadInput['onProgress'],
  onTask?: (task: UploadTask) => void,
): Promise<void> => new Promise((resolve, reject) => {
  const upload = uploadBytesResumable(ref(storage, session.stagingPath), file, {
    contentType: mimeType,
    cacheControl: 'private, no-store',
    customMetadata: {
      uploadSessionId: session.sessionId,
      sourceSha256,
    },
  });
  onTask?.(upload);
  upload.on(
    'state_changed',
    (snapshot) => {
      const percent = snapshot.totalBytes > 0
        ? Math.min(99, Math.max(0, (snapshot.bytesTransferred / snapshot.totalBytes) * 100))
        : 0;
      onProgress?.({ stage: 'uploading', percent });
    },
    reject,
    resolve,
  );
});

const finalizeSession = async (sessionId: string): Promise<ConstructionPlanDrawingUploadResult> => {
  const callable = httpsCallable<{ sessionId: string }, unknown>(
    functions,
    FINALIZE_CONSTRUCTION_PLAN_DRAWING_UPLOAD_CALLABLE,
  );
  const response = await callable({ sessionId });
  const parsed = FinalizeResultSchema.safeParse(response.data);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join('.')).filter(Boolean).join(',');
    throw new Error(`construction-plan-drawing-upload-invalid-finalize-response:${fields || 'root'}`);
  }
  return parsed.data;
};

const assertFinalizedUploadBinding = (
  finalized: ConstructionPlanDrawingUploadResult,
  session: z.infer<typeof StartSessionSchema>,
  input: ConstructionPlanDrawingUploadInput,
  mimeType: UploadMimeType,
  sourceSha256: string,
): void => {
  const canonicalParts = session.canonicalPath.split('/');
  const bindingChecks: Record<string, boolean> = {
    sessionId: finalized.sessionId === session.sessionId,
    planId: finalized.planId === input.planId,
    sectionId: finalized.sectionId === input.sectionId,
    drawingId: finalized.drawingId === input.drawingId,
    canonicalPlan: canonicalParts[0] === 'construction-plans' && canonicalParts[2] === input.planId,
    canonicalDrawing: canonicalParts[3] === 'drawings' && canonicalParts[4] === input.drawingId,
    canonicalRevision: canonicalParts[5] === `rev-${session.sourceRevision}`,
    storagePath: finalized.storagePath === session.canonicalPath,
    sourceRevision: finalized.sourceRevision === session.sourceRevision,
    sourceSha256: finalized.sourceSha256 === sourceSha256,
    mimeType: finalized.mimeType === mimeType,
    sizeBytes: finalized.sizeBytes === input.file.size,
    drawingIdProjection: finalized.drawing.id === finalized.drawingId,
    drawingPlanProjection: finalized.drawing.planId === finalized.planId,
    drawingPathProjection: finalized.drawing.storagePath === finalized.storagePath,
    drawingShaProjection: finalized.drawing.sourceSha256 === finalized.sourceSha256,
    drawingGenerationProjection: finalized.drawing.sourceGeneration === finalized.sourceGeneration,
    drawingMimeProjection: finalized.drawing.mimeType === finalized.mimeType,
    drawingSizeProjection: finalized.drawing.sizeBytes === finalized.sizeBytes,
    sectionProjection: finalized.section.id === finalized.sectionId,
    sectionDrawingProjection: finalized.section.content.drawingId === finalized.drawingId,
  };
  if (Object.values(bindingChecks).some((matches) => !matches)) {
    const error = new Error('construction-plan-drawing-upload-final-binding-mismatch');
    (error as Error & { cause?: unknown }).cause = Object.entries(bindingChecks)
      .filter(([, matches]) => !matches)
      .map(([field]) => field);
    throw error;
  }
};

type DrawingUploadCancellationController = {
  handle: ConstructionPlanDrawingUploadCancelHandle;
  bindTask: (task: UploadTask) => void;
  throwIfCanceled: () => void;
  beginFinalization: () => void;
  settle: () => void;
};

const createDrawingUploadCancellationController = (): DrawingUploadCancellationController => {
  let task: UploadTask | undefined;
  let canceled = false;
  let finalizationStarted = false;
  let settled = false;
  const canceledError = () => new Error(CANCELED_ERROR_CODE);
  const handle: ConstructionPlanDrawingUploadCancelHandle = {
    cancel: () => {
      if (canceled || finalizationStarted || settled) return false;
      canceled = true;
      task?.cancel();
      return true;
    },
    get canceled() { return canceled; },
    get canCancel() { return !canceled && !finalizationStarted && !settled; },
  };
  return {
    handle,
    bindTask: (nextTask) => {
      task = nextTask;
      if (canceled) nextTask.cancel();
    },
    throwIfCanceled: () => {
      if (canceled) throw canceledError();
    },
    beginFinalization: () => {
      if (canceled) throw canceledError();
      finalizationStarted = true;
    },
    settle: () => { settled = true; },
  };
};

/**
 * Uploads only to the server-created staging object. The browser never writes
 * a construction-plans/.../drawings canonical path or source metadata.
 */
const executeConstructionPlanDrawingUpload = async (
  input: ConstructionPlanDrawingUploadInput,
  cancellation: DrawingUploadCancellationController,
): Promise<ConstructionPlanDrawingUploadResult> => {
  try {
    if (!input.planId.trim() || !input.sectionId.trim() || !input.drawingId.trim()) {
      throw new Error('construction-plan-drawing-upload-binding-required');
    }
    if (input.file.size <= 0 || input.file.size > MAX_DRAWING_SIZE_BYTES) {
      throw new Error('construction-plan-drawing-upload-size-invalid');
    }
    cancellation.throwIfCanceled();
    input.onProgress?.({ stage: 'hashing', percent: 0 });
    const bytes = await input.file.arrayBuffer();
    cancellation.throwIfCanceled();
    const mimeType = detectConstructionPlanDrawingFileMime(new Uint8Array(bytes));
    if (!mimeType) throw new Error('construction-plan-drawing-upload-magic-invalid');
    const sourceSha256 = await sha256ConstructionPlanDrawingFile(bytes);
    cancellation.throwIfCanceled();
    input.onProgress?.({ stage: 'creating_session', percent: 0 });
    const startCallable = httpsCallable<Record<string, unknown>, unknown>(
      functions,
      START_CONSTRUCTION_PLAN_DRAWING_UPLOAD_CALLABLE,
    );
    const startResponse = await startCallable({
      planId: input.planId,
      sectionId: input.sectionId,
      drawingId: input.drawingId,
      originalFileName: input.file.name,
      mimeType,
      sizeBytes: input.file.size,
      sha256: sourceSha256,
      ...(input.expectedLockVersion === undefined ? {} : { expectedLockVersion: input.expectedLockVersion }),
      idempotencyKey: input.idempotencyKey ?? createConstructionPlanDrawingUploadIdempotencyKey(),
    });
    cancellation.throwIfCanceled();
    const parsedSession = StartSessionSchema.safeParse(startResponse.data);
    if (!parsedSession.success) throw new Error('construction-plan-drawing-upload-invalid-start-response');
    const session = parsedSession.data;
    if (session.planId !== input.planId
      || session.sectionId !== input.sectionId
      || session.drawingId !== input.drawingId) {
      throw new Error('construction-plan-drawing-upload-session-binding-mismatch');
    }
    if (session.status === 'completed') {
      cancellation.beginFinalization();
      if (!session.result) throw new Error('construction-plan-drawing-upload-completed-result-missing');
      const result = { ...session.result, idempotent: true };
      assertFinalizedUploadBinding(result, session, input, mimeType, sourceSha256);
      input.onProgress?.({ stage: 'completed', percent: 100 });
      return result;
    }

    input.onProgress?.({ stage: 'uploading', percent: 0 });
    let uploadError: unknown;
    try {
      await uploadStagingObject(
        input.file,
        session,
        mimeType,
        sourceSha256,
        input.onProgress,
        cancellation.bindTask,
      );
    } catch (error) {
      cancellation.throwIfCanceled();
      // A create-only upload may have reached Storage even when the browser lost
      // the completion response. Finalization is the authoritative retry probe.
      uploadError = error;
    }
    cancellation.beginFinalization();
    input.onProgress?.({ stage: 'verifying', percent: 99 });
    try {
      const finalized = await finalizeSession(session.sessionId);
      assertFinalizedUploadBinding(finalized, session, input, mimeType, sourceSha256);
      input.onProgress?.({ stage: 'completed', percent: 100 });
      return finalized;
    } catch (finalizeError) {
      if (uploadError) {
        const error = new Error('construction-plan-drawing-upload-and-finalize-failed');
        (error as Error & { cause?: unknown }).cause = { uploadError, finalizeError };
        throw error;
      }
      throw finalizeError;
    }
  } finally {
    cancellation.settle();
  }
};

export const createConstructionPlanDrawingUploadOperation = (
  input: ConstructionPlanDrawingUploadInput,
): ConstructionPlanDrawingUploadOperation => {
  const cancellation = createDrawingUploadCancellationController();
  return {
    cancelHandle: cancellation.handle,
    result: executeConstructionPlanDrawingUpload(input, cancellation),
  };
};

export const uploadConstructionPlanDrawing = (
  input: ConstructionPlanDrawingUploadInput,
): Promise<ConstructionPlanDrawingUploadResult> =>
  createConstructionPlanDrawingUploadOperation(input).result;
