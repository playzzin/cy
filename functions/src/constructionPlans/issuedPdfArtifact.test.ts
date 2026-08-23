import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    buildConstructionPlanServerPdfCustomMetadata,
    buildConstructionPlanServerPdfExportId,
    buildConstructionPlanServerPdfStoragePath,
    storeImmutableConstructionPlanServerPdf,
    type ConstructionPlanServerPdfArtifact,
    type ConstructionPlanServerPdfBinding,
} from './issuedPdfArtifact';
import { sha256Hex } from './domain';

const bytes = Buffer.from('%PDF-1.7\nserver-authority');
const pageManifest = Array.from({ length: 42 }, (_, index) => ({
    pageNumber: index + 1,
    physicalPageNumber: index + 1,
    logicalPageNumber: index + 1,
    continuationIndex: 0,
    sectionKey: `section-${index + 1}`,
    title: `page-${index + 1}`,
    required: true,
    templateContractHash: '1'.repeat(64),
    payloadHash: '2'.repeat(64),
    coveragePaths: [],
    coverageLedger: [],
    drawingBindings: [],
    drawingBindingHash: '3'.repeat(64),
}));
const artifact = (profile: 'candidate' | 'issued'): ConstructionPlanServerPdfArtifact => ({
    profile,
    releaseEligible: profile === 'issued',
    rendererVersion: 'server-field-use-v1',
    drawingRenderMode: 'verified-source-raster-2400',
    bytes,
    sha256: sha256Hex(bytes),
    sizeBytes: bytes.length,
    pageCount: 42,
    pageManifest,
    snapshotHash: 'a'.repeat(64),
    approvedContentHash: '9'.repeat(64),
    templateHash: '4'.repeat(64),
    manifestHash: '5'.repeat(64),
    templateBundleHash: 'b'.repeat(64),
    templateBindingHash: '6'.repeat(64),
    rendererTemplateBundleHash: 'b'.repeat(64),
    rendererBuildHash: '1'.repeat(64),
    renderInputHash: '2'.repeat(64),
    contentManifestHash: 'c'.repeat(64),
    zeroOmissionCoverageHash: 'd'.repeat(64),
    drawingBindingHash: 'e'.repeat(64),
    fileName: 'CP-001_REV-01_ISSUED.pdf',
});

const binding: ConstructionPlanServerPdfBinding = {
    siteId: 'site/one',
    planId: 'plan-one',
    exportJobId: 'issue-job-render-input-001',
    documentNo: 'CP-001',
    revision: 1,
    approvedSnapshotId: 'snapshot-1',
    approvedSnapshotStoragePath: 'construction-plans/site/plan/snapshots/a.json',
    approvedSnapshotStorageGeneration: '1700000000000001',
    authoritativeDrawingPreviewBindingHash: '8'.repeat(64),
    approvedEvidenceId: 'approval-1',
    approvedEvidenceHash: 'f'.repeat(64),
    templateHash: '4'.repeat(64),
    manifestHash: '5'.repeat(64),
    templateBundleHash: 'b'.repeat(64),
    templateBindingHash: '6'.repeat(64),
};

test('server PDF artifact path and metadata bind every immutable release input', () => {
    const issued = artifact('issued');
    assert.equal(
        buildConstructionPlanServerPdfStoragePath(binding, issued),
        `construction-plans/site-one/plan-one/server-exports/issued/rev-01/server-field-use-v1/${'a'.repeat(64)}/${issued.sha256}.pdf`,
    );
    assert.equal(buildConstructionPlanServerPdfExportId(issued), `issued-${issued.sha256.slice(0, 24)}`);
    const metadata = buildConstructionPlanServerPdfCustomMetadata(binding, issued);
    assert.equal(metadata.artifactClass, 'construction-plan-server-pdf');
    assert.equal(metadata.exportJobId, 'issue-job-render-input-001');
    assert.equal(metadata.releaseEligible, 'true');
    assert.equal(metadata.approvedSnapshotStorageGeneration, '1700000000000001');
    assert.equal(metadata.approvedSnapshotHash, 'a'.repeat(64));
    assert.equal(metadata.approvedContentHash, '9'.repeat(64));
    assert.equal(metadata.templateHash, '4'.repeat(64));
    assert.equal(metadata.manifestHash, '5'.repeat(64));
    assert.equal(metadata.templateBundleHash, 'b'.repeat(64));
    assert.equal(metadata.templateBindingHash, '6'.repeat(64));
    assert.equal(metadata.authoritativeDrawingPreviewBindingHash, '8'.repeat(64));
    assert.equal(metadata.rendererTemplateBundleHash, 'b'.repeat(64));
    assert.equal(metadata.rendererBuildHash, '1'.repeat(64));
    assert.equal(metadata.renderInputHash, '2'.repeat(64));
    assert.equal(metadata.zeroOmissionCoverageHash, 'd'.repeat(64));
    assert.equal(metadata.drawingBindingHash, 'e'.repeat(64));
});

test('server PDF artifact metadata accepts 42-through-200 physical pages and preserves the actual count', () => {
    const dynamicPageManifest = [
        ...pageManifest,
        ...Array.from({ length: 15 }, (_, index) => ({
            ...pageManifest[41],
            pageNumber: 43 + index,
            physicalPageNumber: 43 + index,
            logicalPageNumber: 42,
            continuationIndex: index + 1,
        })),
    ];
    const dynamic = {
        ...artifact('issued'),
        pageCount: 57,
        pageManifest: dynamicPageManifest,
    };
    assert.equal(buildConstructionPlanServerPdfCustomMetadata(binding, dynamic).pageCount, '57');
    assert.throws(() => buildConstructionPlanServerPdfCustomMetadata(binding, {
        ...dynamic,
        pageCount: 201,
    }), /envelope-invalid/);
    assert.throws(() => buildConstructionPlanServerPdfCustomMetadata(binding, {
        ...dynamic,
        pageCount: 41,
    }), /envelope-invalid/);
});

test('issued profile fails closed when release eligibility or byte identity is forged', () => {
    assert.throws(
        () => buildConstructionPlanServerPdfCustomMetadata(binding, {
            ...artifact('issued'), releaseEligible: false,
        }),
        /profile-release-eligibility-invalid/,
    );
    assert.throws(
        () => buildConstructionPlanServerPdfCustomMetadata(binding, {
            ...artifact('candidate'), releaseEligible: true,
        }),
        /profile-release-eligibility-invalid/,
    );
    assert.throws(
        () => buildConstructionPlanServerPdfCustomMetadata(binding, {
            ...artifact('issued'), sha256: '0'.repeat(64),
        }),
        /envelope-invalid/,
    );
    assert.doesNotThrow(() => buildConstructionPlanServerPdfCustomMetadata(binding, artifact('candidate')));
});

const createBucketFixture = (
    storedBytes: Buffer,
    storedCustomMetadata: Record<string, string>,
    saveError?: unknown,
) => {
    let saveCalls = 0;
    const file = {
        save: async () => {
            saveCalls += 1;
            if (saveError) throw saveError;
        },
        download: async () => [storedBytes] as const,
        getMetadata: async () => [{
            contentType: 'application/pdf',
            size: String(storedBytes.length),
            generation: '1700000000000099',
            metadata: storedCustomMetadata,
        }] as const,
    };
    return {
        bucket: {
            file: () => file,
        } as unknown as Parameters<typeof storeImmutableConstructionPlanServerPdf>[0],
        getSaveCalls: () => saveCalls,
    };
};

test('create-only server PDF storage safely recovers an identical concurrent retry', async () => {
    const issued = artifact('issued');
    const metadata = buildConstructionPlanServerPdfCustomMetadata(binding, issued);
    const fixture = createBucketFixture(issued.bytes, metadata, { code: 412 });

    const stored = await storeImmutableConstructionPlanServerPdf(fixture.bucket, binding, issued);

    assert.equal(fixture.getSaveCalls(), 1);
    assert.equal(stored.storageGeneration, '1700000000000099');
    assert.equal(stored.customMetadata.renderInputHash, issued.renderInputHash);
    assert.equal(
        stored.storagePath,
        buildConstructionPlanServerPdfStoragePath(binding, issued),
    );
});

test('create-only server PDF storage rejects a preclaimed object with different bytes', async () => {
    const issued = artifact('issued');
    const metadata = buildConstructionPlanServerPdfCustomMetadata(binding, issued);
    const fixture = createBucketFixture(Buffer.from('%PDF-1.7\nforged'), metadata, { code: 412 });

    await assert.rejects(
        storeImmutableConstructionPlanServerPdf(fixture.bucket, binding, issued),
        /SHA-256/,
    );
});

test('create-only server PDF storage rejects unexpected custom metadata', async () => {
    const issued = artifact('issued');
    const metadata = {
        ...buildConstructionPlanServerPdfCustomMetadata(binding, issued),
        unboundLegacyInput: 'true',
    };
    const fixture = createBucketFixture(issued.bytes, metadata, { code: 412 });

    await assert.rejects(
        storeImmutableConstructionPlanServerPdf(fixture.bucket, binding, issued),
        /custom metadata schema/,
    );
});
