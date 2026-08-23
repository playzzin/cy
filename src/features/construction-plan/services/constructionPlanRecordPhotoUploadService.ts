import { httpsCallable } from 'firebase/functions';
import { ref, uploadBytesResumable, type UploadTask } from 'firebase/storage';
import { z } from 'zod';
import { functions, storage } from '../../../config/firebase';
import {
  ConstructionPlanRecordPhotoSchema,
  ConstructionPlanRecordSchema,
  createConstructionPlanRecordIdempotencyKey,
  type ConstructionPlanRecord,
  type ConstructionPlanRecordPhoto,
} from './constructionPlanRecordService';

export const START_CONSTRUCTION_PLAN_RECORD_PHOTO_UPLOAD_CALLABLE = 'startConstructionPlanRecordPhotoUploadServer';
export const FINALIZE_CONSTRUCTION_PLAN_RECORD_PHOTO_UPLOAD_CALLABLE = 'finalizeConstructionPlanRecordPhotoUploadServer';
export const CANCEL_CONSTRUCTION_PLAN_RECORD_PHOTO_UPLOAD_CALLABLE = 'cancelConstructionPlanRecordPhotoUploadServer';

const MAX_PHOTO_BYTES = 12 * 1024 * 1024;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const CANCELED_ERROR = 'construction-plan-record-photo-upload-canceled';

type UploadMimeType = 'image/jpeg' | 'image/png';

const FinalResultSchema = z.object({
  record: ConstructionPlanRecordSchema,
  photo: ConstructionPlanRecordPhotoSchema,
}).strict();

const SessionSchema = z.object({
  schemaVersion: z.literal(1),
  sessionId: z.string().min(1).max(200),
  status: z.enum(['awaiting_upload', 'completed', 'cancelled', 'expired', 'failed']),
  recordId: z.string().min(1).max(200),
  planId: z.string().min(1).max(200),
  photoId: z.string().min(1).max(200),
  stagingPath: z.string().regex(/^construction-plan-record-staging\/[^/]+\/[^/]+\/source$/),
  canonicalPath: z.string().regex(/^construction-plan-records\/[^/]+\/[^/]+\/[^/]+\/photos\/[^/]+\/[a-f0-9]{64}\.(?:jpg|png)$/),
  expiresAt: z.string().refine((value) => !Number.isNaN(Date.parse(value))),
  expiresAtEpochMs: z.number().int().positive(),
  result: FinalResultSchema.optional(),
  idempotent: z.boolean(),
}).strict();

export type ConstructionPlanRecordPhotoUploadProgress = {
  stage: 'hashing' | 'creating_session' | 'uploading' | 'verifying' | 'completed';
  percent: number;
};

export type ConstructionPlanRecordPhotoUploadInput = {
  record: ConstructionPlanRecord;
  file: File;
  caption: string;
  takenAt: string;
  zone: string;
  idempotencyKey?: string;
  onProgress?: (progress: ConstructionPlanRecordPhotoUploadProgress) => void;
};

export type ConstructionPlanRecordPhotoUploadResult = {
  record: ConstructionPlanRecord;
  photo: ConstructionPlanRecordPhoto;
};

export type ConstructionPlanRecordPhotoUploadCancelHandle = {
  cancel: () => boolean;
  readonly canceled: boolean;
  readonly canCancel: boolean;
};

export type ConstructionPlanRecordPhotoUploadOperation = {
  result: Promise<ConstructionPlanRecordPhotoUploadResult>;
  cancelHandle: ConstructionPlanRecordPhotoUploadCancelHandle;
};

export const isConstructionPlanRecordPhotoUploadCanceled = (error: unknown): boolean =>
  error instanceof Error && error.message === CANCELED_ERROR;

export const detectConstructionPlanRecordPhotoMime = (bytes: Uint8Array): UploadMimeType | null => {
  if (bytes.length >= 8
    && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return 'image/png';
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8
    && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9) return 'image/jpeg';
  return null;
};

export const sha256ConstructionPlanRecordPhoto = async (bytes: ArrayBuffer): Promise<string> => {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, '0')).join('');
};

const uploadStaging = (
  file: File,
  session: z.infer<typeof SessionSchema>,
  mimeType: UploadMimeType,
  sha256: string,
  onProgress?: ConstructionPlanRecordPhotoUploadInput['onProgress'],
  bindTask?: (task: UploadTask) => void,
): Promise<void> => new Promise((resolve, reject) => {
  const task = uploadBytesResumable(ref(storage, session.stagingPath), file, {
    contentType: mimeType,
    cacheControl: 'private, no-store',
    customMetadata: { uploadSessionId: session.sessionId, sourceSha256: sha256 },
  });
  bindTask?.(task);
  task.on('state_changed', (snapshot) => {
    const percent = snapshot.totalBytes > 0 ? Math.min(99, (snapshot.bytesTransferred / snapshot.totalBytes) * 100) : 0;
    onProgress?.({ stage: 'uploading', percent });
  }, reject, resolve);
});

const cancelSession = async (sessionId: string): Promise<void> => {
  const callable = httpsCallable<{ sessionId: string }, unknown>(functions, CANCEL_CONSTRUCTION_PLAN_RECORD_PHOTO_UPLOAD_CALLABLE);
  await callable({ sessionId });
};

export const createConstructionPlanRecordPhotoUploadOperation = (
  input: ConstructionPlanRecordPhotoUploadInput,
): ConstructionPlanRecordPhotoUploadOperation => {
  let task: UploadTask | undefined;
  let sessionId = '';
  let canceled = false;
  let finalizing = false;
  let settled = false;
  const cancelHandle: ConstructionPlanRecordPhotoUploadCancelHandle = {
    cancel: () => {
      if (canceled || finalizing || settled) return false;
      canceled = true;
      task?.cancel();
      if (sessionId) void cancelSession(sessionId).catch(() => undefined);
      return true;
    },
    get canceled() { return canceled; },
    get canCancel() { return !canceled && !finalizing && !settled; },
  };
  const throwIfCanceled = () => {
    if (canceled) throw new Error(CANCELED_ERROR);
  };

  const result = (async (): Promise<ConstructionPlanRecordPhotoUploadResult> => {
    try {
      if (input.record.status === 'confirmed') throw new Error('construction-plan-record-photo-confirmed-immutable');
      if (!input.caption.trim() || !input.zone.trim() || Number.isNaN(Date.parse(input.takenAt))) {
        throw new Error('construction-plan-record-photo-metadata-required');
      }
      if (input.file.size <= 0 || input.file.size > MAX_PHOTO_BYTES) {
        throw new Error('construction-plan-record-photo-size-invalid');
      }
      input.onProgress?.({ stage: 'hashing', percent: 0 });
      const bytes = await input.file.arrayBuffer();
      throwIfCanceled();
      const mimeType = detectConstructionPlanRecordPhotoMime(new Uint8Array(bytes));
      if (!mimeType) throw new Error('construction-plan-record-photo-magic-invalid');
      const sha256 = await sha256ConstructionPlanRecordPhoto(bytes);
      if (!SHA256_PATTERN.test(sha256)) throw new Error('construction-plan-record-photo-sha-invalid');
      throwIfCanceled();
      input.onProgress?.({ stage: 'creating_session', percent: 0 });
      const start = httpsCallable<Record<string, unknown>, unknown>(functions, START_CONSTRUCTION_PLAN_RECORD_PHOTO_UPLOAD_CALLABLE);
      const startResponse = await start({
        recordId: input.record.id,
        expectedVersion: input.record.version,
        originalFileName: input.file.name,
        mimeType,
        sizeBytes: input.file.size,
        sha256,
        caption: input.caption.trim(),
        takenAt: input.takenAt,
        zone: input.zone.trim(),
        idempotencyKey: input.idempotencyKey ?? createConstructionPlanRecordIdempotencyKey('photo'),
      });
      const session = SessionSchema.parse(startResponse.data);
      sessionId = session.sessionId;
      if (session.recordId !== input.record.id || session.canonicalPath.split('/')[3] !== input.record.id) {
        throw new Error('construction-plan-record-photo-session-binding-mismatch');
      }
      if (session.status === 'completed' && session.result) return session.result;
      if (session.status !== 'awaiting_upload') throw new Error(`construction-plan-record-photo-session-${session.status}`);
      throwIfCanceled();
      await uploadStaging(input.file, session, mimeType, sha256, input.onProgress, (nextTask) => {
        task = nextTask;
        if (canceled) nextTask.cancel();
      });
      throwIfCanceled();
      finalizing = true;
      input.onProgress?.({ stage: 'verifying', percent: 100 });
      const finalize = httpsCallable<{ sessionId: string }, unknown>(functions, FINALIZE_CONSTRUCTION_PLAN_RECORD_PHOTO_UPLOAD_CALLABLE);
      const finalized = SessionSchema.parse((await finalize({ sessionId })).data);
      if (finalized.status !== 'completed' || !finalized.result
        || finalized.result.record.id !== input.record.id
        || finalized.result.photo.id !== finalized.photoId
        || finalized.result.photo.sha256 !== sha256
        || finalized.result.photo.storagePath !== finalized.canonicalPath) {
        throw new Error('construction-plan-record-photo-final-binding-mismatch');
      }
      input.onProgress?.({ stage: 'completed', percent: 100 });
      return finalized.result;
    } catch (error) {
      if (sessionId && !finalizing) await cancelSession(sessionId).catch(() => undefined);
      if (canceled) throw new Error(CANCELED_ERROR);
      throw error;
    } finally {
      settled = true;
    }
  })();
  return { result, cancelHandle };
};

export const uploadConstructionPlanRecordPhoto = (
  input: ConstructionPlanRecordPhotoUploadInput,
): Promise<ConstructionPlanRecordPhotoUploadResult> => createConstructionPlanRecordPhotoUploadOperation(input).result;

export const getConstructionPlanRecordPhotoUploadErrorMessage = (error: unknown): string => {
  if (isConstructionPlanRecordPhotoUploadCanceled(error)) return '사진 업로드를 취소했습니다.';
  const record = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  const code = String(record.code || '').toLowerCase();
  const message = error instanceof Error ? error.message : String(record.message || '');
  if (message.includes('metadata-required')) return '사진 설명·촬영시각·구간을 모두 입력하세요.';
  if (message.includes('size-invalid')) return '현장사진은 12MB 이하이어야 합니다.';
  if (message.includes('magic-invalid')) return '실제 JPEG 또는 PNG 사진만 등록할 수 있습니다.';
  if (message.includes('confirmed-immutable')) return '확인 완료 기록에는 사진을 추가할 수 없습니다. 정정본을 만드세요.';
  if (code.includes('deadline-exceeded') || message.includes('expired')) return '사진 업로드 세션이 만료되었습니다. 다시 선택하세요.';
  if (code.includes('aborted')) return '사진 업로드 중 기록이 변경되었습니다. 새로고침한 뒤 다시 등록하세요.';
  if (code.includes('permission-denied')) return '이 기록에 사진을 등록할 권한이 없습니다.';
  if (code.includes('data-loss') || message.includes('mismatch')) return '사진 원본 무결성 검증에 실패했습니다.';
  return '현장사진을 등록하지 못했습니다. 네트워크 상태를 확인하고 다시 시도하세요.';
};
