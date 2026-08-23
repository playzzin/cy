import {
  detectConstructionPlanRecordPhotoMime,
  isConstructionPlanRecordPhotoUploadCanceled,
  sha256ConstructionPlanRecordPhoto,
} from './constructionPlanRecordPhotoUploadService';

jest.mock('../../../config/firebase', () => ({ functions: {}, storage: {} }));

beforeAll(() => {
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: require('node:crypto').webcrypto,
  });
});

test('record photo browser detection accepts only actual PNG/JPEG magic', () => {
  expect(detectConstructionPlanRecordPhotoMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png');
  expect(detectConstructionPlanRecordPhotoMime(new Uint8Array([0xff, 0xd8, 1, 2, 0xff, 0xd9]))).toBe('image/jpeg');
  expect(detectConstructionPlanRecordPhotoMime(new Uint8Array([0x3c, 0x73, 0x76, 0x67, 0x2f, 0x3e]))).toBeNull();
});

test('record photo SHA-256 uses the original browser bytes', async () => {
  const bytes = new Uint8Array([101, 120, 101, 99, 117, 116, 105, 111, 110, 45, 114, 101, 99, 111, 114, 100]);
  await expect(sha256ConstructionPlanRecordPhoto(bytes.buffer)).resolves.toMatch(/^[a-f0-9]{64}$/);
});

test('record photo cancellation has a stable classified error', () => {
  expect(isConstructionPlanRecordPhotoUploadCanceled(new Error('construction-plan-record-photo-upload-canceled'))).toBe(true);
  expect(isConstructionPlanRecordPhotoUploadCanceled(new Error('network'))).toBe(false);
});
