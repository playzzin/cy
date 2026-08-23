import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import {
    buildExecutionRecordPhotoCanonicalPath,
    detectExecutionRecordPhotoMimeType,
    validateExecutionRecordPhotoBytes,
} from './executionRecordPhotoUpload';

const hash = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');

test('execution record photo paths bind site/plan/record/photo/SHA and MIME', () => {
    assert.equal(buildExecutionRecordPhotoCanonicalPath({
        siteId: 'site-a', planId: 'plan-a', recordId: 'record-a', photoId: 'photo-a',
        sha256: 'a'.repeat(64), mimeType: 'image/jpeg',
    }), `construction-plan-records/site-a/plan-a/record-a/photos/photo-a/${'a'.repeat(64)}.jpg`);
    assert.throws(() => buildExecutionRecordPhotoCanonicalPath({
        siteId: '../site-a', planId: 'plan-a', recordId: 'record-a', photoId: 'photo-a',
        sha256: 'a'.repeat(64), mimeType: 'image/jpeg',
    }), /path-segment-invalid/);
});

test('execution record photo MIME is detected from PNG/JPEG magic bytes', () => {
    assert.equal(detectExecutionRecordPhotoMimeType(Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ])), 'image/png');
    assert.equal(detectExecutionRecordPhotoMimeType(Buffer.from([0xff, 0xd8, 0x01, 0x02, 0xff, 0xd9])), 'image/jpeg');
    assert.equal(detectExecutionRecordPhotoMimeType(Buffer.from('<svg/>')), null);
});

test('execution record photo validation fails closed on size, magic and SHA', () => {
    const bytes = Buffer.from([0xff, 0xd8, 0x01, 0x02, 0xff, 0xd9]);
    validateExecutionRecordPhotoBytes({ bytes, expectedMimeType: 'image/jpeg', expectedSizeBytes: bytes.length, expectedSha256: hash(bytes) });
    assert.throws(() => validateExecutionRecordPhotoBytes({ bytes, expectedMimeType: 'image/png', expectedSizeBytes: bytes.length, expectedSha256: hash(bytes) }), /magic-mismatch/);
    assert.throws(() => validateExecutionRecordPhotoBytes({ bytes, expectedMimeType: 'image/jpeg', expectedSizeBytes: bytes.length + 1, expectedSha256: hash(bytes) }), /size-mismatch/);
    assert.throws(() => validateExecutionRecordPhotoBytes({ bytes, expectedMimeType: 'image/jpeg', expectedSizeBytes: bytes.length, expectedSha256: '0'.repeat(64) }), /sha256-mismatch/);
});
