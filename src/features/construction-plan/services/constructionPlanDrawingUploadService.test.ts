import { httpsCallable } from 'firebase/functions';
import { ref, uploadBytesResumable } from 'firebase/storage';
import {
  createConstructionPlanDrawingUploadOperation,
  createConstructionPlanDrawingUploadIdempotencyKey,
  detectConstructionPlanDrawingFileMime,
  getConstructionPlanDrawingUploadErrorMessage,
  isConstructionPlanDrawingUploadCanceledError,
  sha256ConstructionPlanDrawingFile,
  uploadConstructionPlanDrawing,
} from './constructionPlanDrawingUploadService';

jest.mock('../../../config/firebase', () => ({
  functions: {},
  storage: {},
}));
jest.mock('firebase/functions', () => ({ httpsCallable: jest.fn() }));
jest.mock('firebase/storage', () => ({
  ref: jest.fn((_storage: unknown, path: string) => ({ fullPath: path })),
  uploadBytesResumable: jest.fn(),
}));

const mockHttpsCallable = httpsCallable as unknown as jest.Mock;
const mockStorageRef = ref as unknown as jest.Mock;
const mockUploadBytesResumable = uploadBytesResumable as unknown as jest.Mock;
const originalCryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
let randomSequence = 0;
const FILE_SHA256 = '86edbaa24831badfa0a8b04bb410141e2ee4182b6d0014493fe262a7a331c20b';

const drawingFixture = {
  id: 'drawing-drawing-section',
  planId: 'plan-a',
  storagePath: 'construction-plans/site-a/plan-a/drawings/drawing-drawing-section/rev-1/source.pdf',
  sourceSha256: FILE_SHA256,
  sourceGeneration: '9',
  originalFileName: 'drawing.pdf',
  mimeType: 'application/pdf' as const,
  sizeBytes: 8,
  pageCount: 1,
  drawingNo: 'D-01',
  title: '장비 배치도',
  revision: '',
  approvalStatus: 'draft' as const,
  applicableZones: ['A구간'],
  previewStatus: 'pending' as const,
  previewPaths: [],
  pages: [],
  annotations: [],
  uploadedBy: 'user-a',
  uploadedAt: '2026-08-22T00:00:00.000Z',
};

const sectionFixture = {
  id: 'drawing-section',
  key: 'equipment-layout',
  title: 'D-01 장비 배치도',
  kind: 'drawing-page' as const,
  order: 8,
  pageNumbers: [9],
  required: true,
  status: 'in_progress' as const,
  content: { drawingId: 'drawing-drawing-section' },
  placeholders: [],
  containsExampleValues: false,
  standardTextModified: false,
};

const finalResult = {
  sessionId: 'session-a',
  planId: 'plan-a',
  sectionId: 'drawing-section',
  drawingId: 'drawing-drawing-section',
  storagePath: drawingFixture.storagePath,
  sourceSha256: FILE_SHA256,
  sourceGeneration: '9',
  mimeType: 'application/pdf' as const,
  sizeBytes: 8,
  sourceRevision: 1,
  lockVersion: 3,
  updatedAt: '2026-08-22T00:00:00.000Z',
  drawing: drawingFixture,
  section: sectionFixture,
  drawingApplicability: [],
  idempotent: false,
};

const startSession = {
  sessionId: 'session-a',
  status: 'awaiting_upload' as const,
  planId: 'plan-a',
  sectionId: 'drawing-section',
  drawingId: 'drawing-drawing-section',
  stagingPath: 'construction-plan-staging/user-a/session-a/source',
  canonicalPath: drawingFixture.storagePath,
  sourceRevision: 1,
  expiresAt: '2026-08-22T00:30:00.000Z',
  expiresAtEpochMs: 1787358600000,
  idempotent: false,
};

describe('constructionPlanDrawingUploadService', () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: {
        subtle: { digest: async () => new Uint8Array(32).buffer },
        randomUUID: () => `00000000-0000-4000-8000-${String(++randomSequence).padStart(12, '0')}`,
      },
    });
  });

  afterAll(() => {
    if (originalCryptoDescriptor) Object.defineProperty(globalThis, 'crypto', originalCryptoDescriptor);
    else Reflect.deleteProperty(globalThis, 'crypto');
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('detects only supported magic headers', () => {
    expect(detectConstructionPlanDrawingFileMime(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])))
      .toBe('application/pdf');
    expect(detectConstructionPlanDrawingFileMime(new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]))).toBe('image/png');
    expect(detectConstructionPlanDrawingFileMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])))
      .toBe('image/jpeg');
    expect(detectConstructionPlanDrawingFileMime(new Uint8Array([0x3c, 0x73, 0x76, 0x67]))).toBeNull();
  });

  it('creates bounded retry keys', () => {
    const first = createConstructionPlanDrawingUploadIdempotencyKey();
    const second = createConstructionPlanDrawingUploadIdempotencyKey();
    expect(first).toMatch(/^cp-drawing-upload-/);
    expect(first.length).toBeLessThanOrEqual(128);
    expect(second).not.toBe(first);
  });

  it('encodes the complete Web Crypto digest', async () => {
    const rawDigest = await globalThis.crypto.subtle.digest('SHA-256', new Uint8Array([1, 2, 3]));
    expect(rawDigest.byteLength).toBe(32);
    const hash = await sha256ConstructionPlanDrawingFile(new Uint8Array([1, 2, 3]).buffer);
    expect(hash).toBe('0'.repeat(64));
  });

  it('maps fail-closed server errors to actionable Korean guidance', () => {
    expect(getConstructionPlanDrawingUploadErrorMessage(new Error('construction-plan-drawing-upload-source-not-saved')))
      .toContain('먼저 저장');
    expect(getConstructionPlanDrawingUploadErrorMessage({ code: 'functions/deadline-exceeded' }))
      .toContain('만료');
    expect(getConstructionPlanDrawingUploadErrorMessage({ code: 'functions/already-exists' }))
      .toContain('불변 도면 경로');
    expect(getConstructionPlanDrawingUploadErrorMessage(new Error('construction-plan-drawing-upload-magic-invalid')))
      .toContain('PDF, PNG, JPG');
  });

  it('uploads only to the server-issued staging path and finalizes authoritative metadata', async () => {
    mockHttpsCallable.mockImplementation((_functions: unknown, name: string) => {
      if (name === 'startConstructionPlanDrawingUploadServer') {
        return jest.fn(async () => ({ data: startSession }));
      }
      if (name === 'finalizeConstructionPlanDrawingUploadServer') {
        return jest.fn(async () => {
          const sourceSha256 = mockUploadBytesResumable.mock.calls[0][2].customMetadata.sourceSha256;
          return { data: {
            ...finalResult,
            sourceSha256,
            drawing: { ...drawingFixture, sourceSha256 },
          } };
        });
      }
      throw new Error(`unexpected callable ${name}`);
    });
    mockUploadBytesResumable.mockImplementation(() => ({
      on: (_event: string, next: (snapshot: { bytesTransferred: number; totalBytes: number }) => void,
        _error: (error: unknown) => void, complete: () => void) => {
        next({ bytesTransferred: 8, totalBytes: 8 });
        complete();
      },
    }));
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
    const file = new File([bytes], 'drawing.pdf', { type: 'application/pdf' });
    Object.defineProperty(file, 'arrayBuffer', { value: async () => bytes.buffer });
    const progress: string[] = [];

    const result = await uploadConstructionPlanDrawing({
      planId: 'plan-a',
      sectionId: 'drawing-section',
      drawingId: 'drawing-drawing-section',
      file,
      expectedLockVersion: 2,
      idempotencyKey: 'retry-key-a',
      onProgress: (value) => progress.push(value.stage),
    });

    expect(result.storagePath).toBe(drawingFixture.storagePath);
    expect(mockStorageRef).toHaveBeenCalledTimes(1);
    expect(mockStorageRef.mock.calls[0][1]).toBe(startSession.stagingPath);
    expect(mockStorageRef.mock.calls[0][1]).not.toContain('/construction-plans/');
    expect(mockUploadBytesResumable.mock.calls[0][2]).toMatchObject({
      contentType: 'application/pdf',
      customMetadata: { uploadSessionId: 'session-a', sourceSha256: expect.stringMatching(/^[a-f0-9]{64}$/) },
    });
    expect(mockHttpsCallable.mock.calls.map((call) => call[1])).toEqual([
      'startConstructionPlanDrawingUploadServer',
      'finalizeConstructionPlanDrawingUploadServer',
    ]);
    expect(progress).toEqual(expect.arrayContaining(['hashing', 'creating_session', 'uploading', 'verifying', 'completed']));
  });

  it('still probes idempotent finalization when the staging completion response is lost', async () => {
    mockHttpsCallable.mockImplementation((_functions: unknown, name: string) => {
      if (name === 'startConstructionPlanDrawingUploadServer') {
        return jest.fn(async () => ({ data: startSession }));
      }
      return jest.fn(async () => {
        const sourceSha256 = mockUploadBytesResumable.mock.calls[0][2].customMetadata.sourceSha256;
        return { data: {
          ...finalResult,
          sourceSha256,
          drawing: { ...drawingFixture, sourceSha256 },
          idempotent: true,
        } };
      });
    });
    mockUploadBytesResumable.mockImplementation(() => ({
      on: (_event: string, _next: unknown, error: (value: unknown) => void) => error(new Error('lost-response')),
    }));
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
    const file = new File([bytes], 'drawing.pdf', { type: 'application/pdf' });
    Object.defineProperty(file, 'arrayBuffer', { value: async () => bytes.buffer });

    await expect(uploadConstructionPlanDrawing({
      planId: 'plan-a',
      sectionId: 'drawing-section',
      drawingId: 'drawing-drawing-section',
      file,
      idempotencyKey: 'retry-key-b',
    })).resolves.toMatchObject({ idempotent: true, storagePath: drawingFixture.storagePath });
    expect(mockHttpsCallable.mock.calls.map((call) => call[1]))
      .toContain('finalizeConstructionPlanDrawingUploadServer');
  });

  it('cancels the resumable staging task and never invokes canonical finalization', async () => {
    let rejectUpload: ((error: unknown) => void) | undefined;
    let signalTaskReady: (() => void) | undefined;
    const taskReady = new Promise<void>((resolve) => { signalTaskReady = resolve; });
    const cancel = jest.fn(() => {
      rejectUpload?.({ code: 'storage/canceled' });
      return true;
    });
    mockHttpsCallable.mockImplementation((_functions: unknown, name: string) => {
      if (name === 'startConstructionPlanDrawingUploadServer') {
        return jest.fn(async () => ({ data: startSession }));
      }
      throw new Error(`finalize must not be called after cancellation: ${name}`);
    });
    mockUploadBytesResumable.mockImplementation(() => ({
      cancel,
      on: (_event: string, _next: unknown, error: (value: unknown) => void) => {
        rejectUpload = error;
        signalTaskReady?.();
      },
    }));
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
    const file = new File([bytes], 'drawing.pdf', { type: 'application/pdf' });
    Object.defineProperty(file, 'arrayBuffer', { value: async () => bytes.buffer });
    const operation = createConstructionPlanDrawingUploadOperation({
      planId: 'plan-a',
      sectionId: 'drawing-section',
      drawingId: 'drawing-drawing-section',
      file,
      idempotencyKey: 'retry-key-canceled',
    });

    await taskReady;
    expect(operation.cancelHandle.canCancel).toBe(true);
    expect(operation.cancelHandle.cancel()).toBe(true);
    const rejection = await operation.result.catch((error: unknown) => error);
    expect(isConstructionPlanDrawingUploadCanceledError(rejection)).toBe(true);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(operation.cancelHandle.canceled).toBe(true);
    expect(operation.cancelHandle.canCancel).toBe(false);
    expect(mockHttpsCallable.mock.calls.map((call) => call[1])).toEqual([
      'startConstructionPlanDrawingUploadServer',
    ]);
  });

  it('reuses a completed session without writing staging again', async () => {
    const sourceSha256 = '0'.repeat(64);
    const completedResult = {
      ...finalResult,
      sourceSha256,
      drawing: { ...drawingFixture, sourceSha256 },
      idempotent: true,
    };
    mockHttpsCallable.mockImplementation((_functions: unknown, name: string) => {
      expect(name).toBe('startConstructionPlanDrawingUploadServer');
      return jest.fn(async () => ({
        data: { ...startSession, status: 'completed', result: completedResult, idempotent: true },
      }));
    });
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
    const file = new File([bytes], 'drawing.pdf', { type: 'application/pdf' });
    Object.defineProperty(file, 'arrayBuffer', { value: async () => bytes.buffer });

    await expect(uploadConstructionPlanDrawing({
      planId: 'plan-a',
      sectionId: 'drawing-section',
      drawingId: 'drawing-drawing-section',
      file,
      idempotencyKey: 'retry-key-completed',
    })).resolves.toMatchObject({ idempotent: true, sourceSha256 });
    expect(mockUploadBytesResumable).not.toHaveBeenCalled();
    expect(mockHttpsCallable).toHaveBeenCalledTimes(1);
  });

  it('fails closed when completed server projections do not match the upload binding', async () => {
    const sourceSha256 = '0'.repeat(64);
    mockHttpsCallable.mockImplementation(() => jest.fn(async () => ({
      data: {
        ...startSession,
        status: 'completed',
        result: {
          ...finalResult,
          sourceSha256,
          drawing: { ...drawingFixture, sourceSha256 },
          section: { ...sectionFixture, content: { drawingId: 'drawing-other' } },
          idempotent: true,
        },
        idempotent: true,
      },
    })));
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
    const file = new File([bytes], 'drawing.pdf', { type: 'application/pdf' });
    Object.defineProperty(file, 'arrayBuffer', { value: async () => bytes.buffer });

    await expect(uploadConstructionPlanDrawing({
      planId: 'plan-a',
      sectionId: 'drawing-section',
      drawingId: 'drawing-drawing-section',
      file,
      idempotencyKey: 'retry-key-mismatch',
    })).rejects.toThrow('final-binding-mismatch');
    expect(mockUploadBytesResumable).not.toHaveBeenCalled();
  });
});
