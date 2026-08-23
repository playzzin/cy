import { getBlob, getMetadata, ref } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { buildConstructionPlanDraft } from '../domain';
import {
  cloneConstructionPlanServer,
  createConstructionPlanDraftServer,
  createConstructionPlanRevisionServer,
  getConstructionPlanLineageServer,
  isConstructionPlanIssuedPdfProvenanceCompatible,
  issueConstructionPlanServer,
  listConstructionPlansServer,
  migrateConstructionPlanTemplateBindingServer,
  prepareConstructionPlanIssuedPdfServer,
  readVerifiedConstructionPlanServerPdf,
  type ConstructionPlanPdfProvenance,
} from './constructionPlanWorkflowApi';

jest.mock('../../../config/firebase', () => ({
  functions: { name: 'test-functions' },
  storage: { name: 'test-storage' },
}));

jest.mock('firebase/functions', () => ({
  httpsCallable: jest.fn(),
}));

jest.mock('firebase/storage', () => ({
  getBlob: jest.fn(),
  getMetadata: jest.fn(),
  ref: jest.fn((_storage, fullPath: string) => ({ fullPath })),
}));

describe('constructionPlanWorkflowApi server-authoritative issued PDF', () => {
  const mockedHttpsCallable = httpsCallable as jest.MockedFunction<typeof httpsCallable>;
  const mockedGetBlob = getBlob as jest.MockedFunction<typeof getBlob>;
  const mockedGetMetadata = getMetadata as jest.MockedFunction<typeof getMetadata>;
  const approvedSnapshotHash = 'b'.repeat(64);
  const candidateSha256 = 'aa'.repeat(32);
  const issuedSha256 = 'bb'.repeat(32);
  const rendererVersion = 'field-use-a4-v2';
  const candidatePath = `construction-plans/site-1/plan-1/server-exports/candidate/rev-02/${rendererVersion}/${approvedSnapshotHash}/${candidateSha256}.pdf`;
  const issuedPath = `construction-plans/site-1/plan-1/server-exports/issued/rev-02/${rendererVersion}/${approvedSnapshotHash}/${issuedSha256}.pdf`;
  const provenance: ConstructionPlanPdfProvenance = {
    rendererVersion,
    rendererTemplateBundleHash: 'c'.repeat(64),
    rendererBuildHash: 'd'.repeat(64),
    renderInputHash: 'e'.repeat(64),
    contentManifestHash: 'f'.repeat(64),
    zeroOmissionCoverageHash: '1'.repeat(64),
    drawingBindingHash: '2'.repeat(64),
    drawingRenderMode: 'server-authoritative-preview-raster',
    templateHash: '4'.repeat(64),
    manifestHash: '5'.repeat(64),
    templateBundleHash: '6'.repeat(64),
    templateBindingHash: '7'.repeat(64),
  };
  const candidate = {
    storagePath: candidatePath,
    storageGeneration: '1724300000000001',
    sha256: candidateSha256,
    sizeBytes: 4,
    pageCount: 42 as const,
    fileName: 'candidate.pdf',
  };
  const issuedProvenance: ConstructionPlanPdfProvenance = {
    ...provenance,
    renderInputHash: '3'.repeat(64),
  };
  const originalCryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: {
        subtle: {
          digest: jest.fn(async () => new Uint8Array(32).fill(0xaa).buffer),
        },
      },
    });
  });

  afterAll(() => {
    if (originalCryptoDescriptor) {
      Object.defineProperty(globalThis, 'crypto', originalCryptoDescriptor);
    } else {
      delete (globalThis as { crypto?: Crypto }).crypto;
    }
  });

  it('prepares with only the approved server pointer and validates every candidate binding', async () => {
    const invoke = jest.fn().mockResolvedValue({
      data: {
        planId: 'plan-1',
        jobId: 'job-1',
        status: 'ready_for_visual_check',
        approvedSnapshotHash,
        candidate,
        provenance,
      },
    });
    mockedHttpsCallable.mockReturnValueOnce(invoke as never);

    await expect(prepareConstructionPlanIssuedPdfServer({
      planId: 'plan-1',
      approvedSnapshotHash,
    })).resolves.toEqual(expect.objectContaining({
      jobId: 'job-1',
      candidate,
      provenance,
    }));
    expect(mockedHttpsCallable).toHaveBeenCalledWith(
      expect.anything(),
      'prepareConstructionPlanIssuedPdfServer',
    );
    expect(invoke).toHaveBeenCalledWith({ planId: 'plan-1', approvedSnapshotHash });
  });

  it('sends an explicit legacy binding migration request and accepts only the canonical mutation response', async () => {
    const invoke = jest.fn().mockResolvedValue({
      data: {
        planId: 'plan-1',
        seriesId: 'series-1',
        revisionNo: 0,
        documentNo: 'CP-001',
        idempotent: false,
      },
    });
    mockedHttpsCallable.mockReturnValueOnce(invoke as never);

    await expect(migrateConstructionPlanTemplateBindingServer({
      planId: 'plan-1',
      idempotencyKey: 'bind-legacy-1',
      reason: '게시 템플릿 해시를 복원하고 처음부터 재검토합니다.',
      expectedLockVersion: 7,
    })).resolves.toEqual(expect.objectContaining({ planId: 'plan-1', revisionNo: 0 }));
    expect(invoke).toHaveBeenCalledWith({
      planId: 'plan-1',
      idempotencyKey: 'bind-legacy-1',
      reason: '게시 템플릿 해시를 복원하고 처음부터 재검토합니다.',
      expectedLockVersion: 7,
    });
  });

  it('accepts bounded dynamic physical page counts and rejects values above 200', async () => {
    mockedHttpsCallable.mockReturnValueOnce(jest.fn().mockResolvedValue({
      data: {
        planId: 'plan-1',
        jobId: 'job-dynamic',
        status: 'ready_for_visual_check',
        approvedSnapshotHash,
        candidate: { ...candidate, pageCount: 57 },
        provenance,
      },
    }) as never);
    await expect(prepareConstructionPlanIssuedPdfServer({
      planId: 'plan-1',
      approvedSnapshotHash,
    })).resolves.toEqual(expect.objectContaining({
      candidate: expect.objectContaining({ pageCount: 57 }),
    }));

    mockedHttpsCallable.mockReturnValueOnce(jest.fn().mockResolvedValue({
      data: {
        planId: 'plan-1',
        jobId: 'job-overflow',
        status: 'ready_for_visual_check',
        approvedSnapshotHash,
        candidate: { ...candidate, pageCount: 201 },
        provenance,
      },
    }) as never);
    await expect(prepareConstructionPlanIssuedPdfServer({
      planId: 'plan-1',
      approvedSnapshotHash,
    })).rejects.toThrow('candidate.pageCount');
  });

  it('rejects a legacy browser export path even when its remaining fields look valid', async () => {
    mockedHttpsCallable.mockReturnValueOnce(jest.fn().mockResolvedValue({
      data: {
        planId: 'plan-1',
        jobId: 'job-1',
        status: 'ready_for_visual_check',
        approvedSnapshotHash,
        candidate: {
          ...candidate,
          storagePath: `construction-plans/site-1/plan-1/exports/rev-02/${candidateSha256}.pdf`,
        },
        provenance,
      },
    }) as never);

    await expect(prepareConstructionPlanIssuedPdfServer({
      planId: 'plan-1',
      approvedSnapshotHash,
    })).rejects.toThrow('server-export-path-binding');
  });

  it('finalizes with job evidence only and never sends a client storage path or PDF payload', async () => {
    const invoke = jest.fn().mockResolvedValue({
      data: {
        planId: 'plan-1',
        jobId: 'job-1',
        status: 'issued',
        issuedExportId: 'export-1',
        storagePath: issuedPath,
        storageGeneration: '1724300000000002',
        sha256: issuedSha256,
        pageCount: 42,
        sizeBytes: 4,
        fileName: 'issued.pdf',
        provenance: issuedProvenance,
      },
    });
    mockedHttpsCallable.mockReturnValueOnce(invoke as never);

    await expect(issueConstructionPlanServer({
      planId: 'plan-1',
      jobId: 'job-1',
      expectedCandidateSha256: candidateSha256,
      approvedSnapshotHash,
      visualCheckConfirmed: true,
    })).resolves.toEqual(expect.objectContaining({
      issuedExportId: 'export-1',
      storagePath: issuedPath,
      provenance: issuedProvenance,
    }));
    expect(invoke).toHaveBeenCalledWith({
      planId: 'plan-1',
      jobId: 'job-1',
      expectedCandidateSha256: candidateSha256,
      approvedSnapshotHash,
      visualCheckConfirmed: true,
    });
    expect(invoke.mock.calls[0][0]).not.toHaveProperty('storagePath');
    expect(invoke.mock.calls[0][0]).not.toHaveProperty('blob');
    expect(invoke.mock.calls[0][0]).not.toHaveProperty('pdf');
  });

  it('accepts shared lineage provenance only when the profile-specific render input differs', () => {
    expect(isConstructionPlanIssuedPdfProvenanceCompatible(
      provenance,
      issuedProvenance,
    )).toBe(true);
    expect(isConstructionPlanIssuedPdfProvenanceCompatible(
      provenance,
      provenance,
    )).toBe(false);
    expect(isConstructionPlanIssuedPdfProvenanceCompatible(
      provenance,
      { ...issuedProvenance, drawingBindingHash: '4'.repeat(64) },
    )).toBe(false);
  });

  it('downloads the exact generation and independently verifies metadata and byte SHA', async () => {
    const metadata = {
      contentType: 'application/pdf',
      generation: candidate.storageGeneration,
      size: candidate.sizeBytes,
      customMetadata: { sha256: candidate.sha256 },
    };
    mockedGetMetadata.mockResolvedValue(metadata as never);
    mockedGetBlob.mockResolvedValue({
      size: 4,
      type: 'application/pdf',
      arrayBuffer: async () => new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer,
    } as Blob);

    await expect(readVerifiedConstructionPlanServerPdf(candidate)).resolves.toEqual(
      expect.objectContaining({ size: 4, type: 'application/pdf' }),
    );
    expect(mockedGetMetadata).toHaveBeenCalledTimes(2);
    expect(mockedGetBlob).toHaveBeenCalledTimes(1);
  });

  it('fails closed when the downloaded object generation differs from PREPARE', async () => {
    mockedGetMetadata.mockResolvedValue({
      contentType: 'application/pdf',
      generation: '1724300000000999',
      size: candidate.sizeBytes,
      customMetadata: { sha256: candidate.sha256 },
    } as never);

    await expect(readVerifiedConstructionPlanServerPdf(candidate))
      .rejects.toThrow('construction-plan-server-pdf-metadata-mismatch');
    expect(mockedGetBlob).not.toHaveBeenCalled();
  });
});

describe('constructionPlanWorkflowApi lifecycle callables', () => {
  const mockedHttpsCallable = httpsCallable as jest.MockedFunction<typeof httpsCallable>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    ['createConstructionPlanDraftServer', createConstructionPlanDraftServer, {
      siteId: 'site-1',
      tradeType: 'system-shoring' as const,
      templateId: 'system-shoring-standard',
      templateVersion: '1.0.0',
      title: '시공계획서',
      documentNo: 'CP-001',
      idempotencyKey: 'draft-request-1',
    }],
    ['createConstructionPlanRevisionServer', createConstructionPlanRevisionServer, {
      sourcePlanId: 'plan-1',
      revisionReason: '현장 조건 변경 반영',
      revisionType: 'site_condition' as const,
      idempotencyKey: 'revision-request-1',
    }],
    ['cloneConstructionPlanServer', cloneConstructionPlanServer, {
      sourcePlanId: 'plan-1',
      documentNo: 'CP-CLONE-001',
      idempotencyKey: 'clone-request-1',
    }],
  ])('validates %s mutation response', async (callableName, invoke, request) => {
    mockedHttpsCallable.mockReturnValueOnce(jest.fn().mockResolvedValue({
      data: {
        planId: 'plan-result',
        seriesId: 'series-result',
        revisionNo: callableName === 'createConstructionPlanRevisionServer' ? 1 : 0,
        documentNo: 'CP-001',
        idempotent: false,
      },
    }) as never);

    await expect(invoke(request as never)).resolves.toEqual(expect.objectContaining({
      planId: 'plan-result',
      seriesId: 'series-result',
      idempotent: false,
    }));
    expect(mockedHttpsCallable).toHaveBeenCalledWith(expect.anything(), callableName);
  });

  it('forwards the exact system-scaffold template identity to draft creation', async () => {
    const callable = jest.fn().mockResolvedValue({
      data: {
        planId: 'plan-scaffold-result',
        seriesId: 'series-scaffold-result',
        revisionNo: 0,
        documentNo: 'CP-SCAFFOLD-001',
        idempotent: false,
      },
    });
    mockedHttpsCallable.mockReturnValueOnce(callable as never);
    const request = {
      siteId: 'site-scaffold',
      tradeType: 'system-scaffold' as const,
      templateId: 'system-scaffold-standard',
      templateVersion: '1.0.0',
      title: '시스템비계 시공계획서',
      documentNo: 'CP-SCAFFOLD-001',
      idempotencyKey: 'draft-scaffold-1',
    };

    await expect(createConstructionPlanDraftServer(request)).resolves.toEqual(expect.objectContaining({
      planId: 'plan-scaffold-result',
    }));
    expect(callable).toHaveBeenCalledWith(request);
  });

  it('rejects a malformed lifecycle response', async () => {
    mockedHttpsCallable.mockReturnValueOnce(jest.fn().mockResolvedValue({
      data: { planId: 'missing-series' },
    }) as never);

    await expect(createConstructionPlanRevisionServer({
      sourcePlanId: 'plan-1',
      revisionReason: '정상적인 개정 사유',
      revisionType: 'other',
      idempotencyKey: 'revision-request-2',
    })).rejects.toThrow('construction-plan-lifecycle-invalid-response');
  });

  it('validates server-scoped list and lineage responses', async () => {
    const plan = buildConstructionPlanDraft('plan-list-1', {
      siteId: 'site-list-1',
      siteName: '목록 현장',
      createdBy: 'author-1',
    }, '2026-08-21T04:00:00.000Z');
    const { participants: _participants, ...legacyPlan } = plan;
    mockedHttpsCallable
      .mockReturnValueOnce(jest.fn().mockResolvedValue({ data: { plans: [legacyPlan] } }) as never)
      .mockReturnValueOnce(jest.fn().mockResolvedValue({
        data: {
          series: {
            id: 'legacy-plan-list-1',
            siteId: plan.siteId,
            documentNo: plan.documentNo,
            documentNoKey: plan.documentNo.replace(/\s+/g, '').toUpperCase(),
            tradeType: 'system-shoring',
            latestRevisionNo: 0,
            latestPlanId: plan.id,
          },
          plans: [plan],
          currentIndex: 0,
        },
      }) as never);

    await expect(listConstructionPlansServer({ siteId: plan.siteId })).resolves.toEqual([
      expect.objectContaining({
        id: plan.id,
        participants: {
          authorIds: ['author-1'],
          reviewerIds: [],
          approverIds: [],
        },
      }),
    ]);
    await expect(getConstructionPlanLineageServer({ planId: plan.id })).resolves.toEqual(
      expect.objectContaining({ currentIndex: 0 }),
    );
    expect(mockedHttpsCallable).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      'listConstructionPlansServer',
    );
    expect(mockedHttpsCallable).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      'getConstructionPlanLineageServer',
    );
  });
});
