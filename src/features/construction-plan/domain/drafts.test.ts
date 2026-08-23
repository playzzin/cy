import { ConstructionPlanSchema, UpdateConstructionPlanInputSchema } from '../types';
import {
  buildConstructionPlanDraft,
  cloneConstructionPlanAsDraft,
  createConstructionPlanRevision,
  formatSeoulCalendarDate,
} from './drafts';
import { canTransitionPlanStatus, isPlanContentEditable } from './status';

describe('construction plan draft and revision helpers', () => {
  const makeDraft = () => buildConstructionPlanDraft('plan-1', {
    siteId: 'site-1',
    siteName: '테스트 현장',
    createdBy: 'author-1',
    createdByName: '작성자',
  }, '2026-08-21T01:00:00.000Z');

  it('creates a deterministic schema-valid draft with the reference sections', () => {
    const draft = makeDraft();

    expect(ConstructionPlanSchema.safeParse(draft).success).toBe(true);
    expect(draft.documentNo).toBe('CP-site-1-20260821');
    expect(draft.sectionOrder).toHaveLength(draft.sections.length);
    expect(draft.organizationSnapshot.assignments.filter((assignment) => assignment.required))
      .toHaveLength(3);
  });

  it('uses the Seoul calendar date at the UTC day boundary and preserves an explicit date', () => {
    const boundary = new Date('2026-08-21T15:30:00.000Z');
    expect(formatSeoulCalendarDate(boundary)).toBe('2026-08-22');
    const draft = buildConstructionPlanDraft('kst-draft', {
      siteId: 'kst-site',
      siteName: '서울 현장',
      createdBy: 'author-1',
    }, boundary);
    const explicit = buildConstructionPlanDraft('kst-explicit', {
      siteId: 'kst-site',
      siteName: '서울 현장',
      createdBy: 'author-1',
      documentDate: '2026-08-20',
    }, boundary);
    const issued = ConstructionPlanSchema.parse({ ...draft, status: 'issued' });
    const revision = createConstructionPlanRevision(issued, {
      id: 'kst-revision',
      createdBy: 'author-2',
      revisionReason: '한국 달력일 경계 반영',
      revisionType: 'other',
      now: boundary,
    });
    const clone = cloneConstructionPlanAsDraft(issued, {
      id: 'kst-clone',
      createdBy: 'author-2',
      now: boundary,
    });

    expect(draft.documentDate).toBe('2026-08-22');
    expect(explicit.documentDate).toBe('2026-08-20');
    expect(revision.documentDate).toBe('2026-08-22');
    expect(clone.documentDate).toBe('2026-08-22');
  });

  it('creates a new revision only from an issued lineage and resets release state', () => {
    const issued = ConstructionPlanSchema.parse({
      ...makeDraft(),
      status: 'issued',
      revision: 5,
      approvedSnapshotId: 'snapshot-approved',
      approvedSnapshotHash: 'a'.repeat(64),
      approvedSnapshotStoragePath: 'construction-plans/site-1/plan-1/snapshots/approved.json',
      issuedExportId: 'export-issued',
      issuedExportStoragePath: 'construction-plans/site-1/plan-1/exports/issued.pdf',
      issuedExportSha256: 'b'.repeat(64),
      issuedExportFileName: 'issued.pdf',
      issuedAt: '2026-08-21T02:00:00.000Z',
      issuedBy: 'issuer-1',
      releaseReadiness: {
        ...makeDraft().releaseReadiness,
        requiredReviewsComplete: true,
        snapshotHashMatches: true,
        pdfVisualCheckPassed: true,
        pdfTextCheckPassed: true,
      },
    });

    const revision = createConstructionPlanRevision(issued, {
      id: 'plan-2',
      createdBy: 'author-2',
      revisionReason: '현장 시공조건 변경 반영',
      revisionType: 'site_condition',
      now: '2026-08-22T01:00:00.000Z',
    });

    expect(revision).toEqual(expect.objectContaining({
      id: 'plan-2',
      revision: 6,
      status: 'draft',
      supersedesPlanId: 'plan-1',
      lineageRootPlanId: 'plan-1',
      revisionReason: '현장 시공조건 변경 반영',
      revisionType: 'site_condition',
      sourceRevisionNo: 5,
      sourceSnapshotHash: 'a'.repeat(64),
      lockVersion: 0,
    }));
    expect(revision.approvedSnapshotId).toBeUndefined();
    expect(revision.approvedSnapshotHash).toBeUndefined();
    expect(revision.approvedSnapshotStoragePath).toBeUndefined();
    expect(revision.issuedExportId).toBeUndefined();
    expect(revision.issuedExportStoragePath).toBeUndefined();
    expect(revision.issuedExportSha256).toBeUndefined();
    expect(revision.issuedExportFileName).toBeUndefined();
    expect(revision.issuedAt).toBeUndefined();
    expect(revision.issuedBy).toBeUndefined();
    expect(revision.releaseReadiness.pdfVisualCheckPassed).toBe(false);
  });

  it('clones a plan as an independent new-series draft without drawings by default', () => {
    const source = makeDraft();
    source.organizationSnapshot.assignments[0].worker = {
      id: 'old-worker',
      name: '기존 현장 작업자',
      status: 'active',
    };
    const drawingSection = source.sections.find((section) => section.kind === 'drawing-page');
    if (!drawingSection) throw new Error('drawing-section-fixture-missing');
    drawingSection.status = 'complete';
    drawingSection.content = {
      summary: '보존할 현장 시공 설명',
      drawingId: 'old-site-drawing',
      drawingStudio: {
        background: { storagePath: 'construction-plans/old-site/private-source.pdf' },
        objects: [{ id: 'old-zone', kind: 'polygon' }],
      },
    };
    source.drawingApplicability = [{
      drawingSlot: 'D-01',
      decision: 'applicable',
      drawingId: 'old-site-drawing',
      reason: '기존 현장 적용',
    }];
    const cloned = cloneConstructionPlanAsDraft(source, {
      id: 'clone-1',
      createdBy: 'author-2',
      documentNo: 'NEW-001',
      now: '2026-08-22T00:00:00.000Z',
    });

    cloned.sections[0].content.changed = true;
    expect(source.sections[0].content.changed).toBeUndefined();
    const clonedDrawingSection = cloned.sections.find((section) => section.id === drawingSection.id);
    expect(clonedDrawingSection?.content).toEqual({ summary: '보존할 현장 시공 설명' });
    expect(clonedDrawingSection?.status).toBe('empty');
    expect(JSON.stringify(cloned.sections)).not.toContain('old-site-drawing');
    expect(JSON.stringify(cloned.sections)).not.toContain('private-source.pdf');
    expect(cloned.drawingApplicability).toEqual([]);
    expect(cloned.organizationSnapshot.assignments.every((assignment) => !assignment.worker)).toBe(true);
    expect(cloned).toEqual(expect.objectContaining({
      documentNo: 'NEW-001',
      revision: 0,
      status: 'draft',
      drawings: [],
      lineageRootPlanId: 'clone-1',
      clonedFromPlanId: 'plan-1',
    }));
  });

  it('copies drawings into a revision but resets every drawing review decision', () => {
    const source = makeDraft();
    source.participants.reviewerIds = ['reviewer-old'];
    source.participants.approverIds = ['approver-old'];
    source.drawings = [{
      id: 'drawing-1',
      planId: source.id,
      storagePath: 'construction-plans/site-1/plan-1/drawings/source.pdf',
      sourceSha256: 'source-hash',
      originalFileName: 'source.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 100,
      pageCount: 1,
      drawingNo: 'D-01',
      title: '승인 시공도',
      revision: '7',
      approvalStatus: 'approved',
      approvalReference: 'APPROVAL-7',
      applicableZones: ['A'],
      previewStatus: 'ready',
      previewPaths: ['preview.png'],
      pages: [],
      annotations: [{
        id: 'annotation-1',
        pageIndex: 0,
        layer: 'install',
        geometry: { kind: 'rect', x: 0.1, y: 0.1, w: 0.2, h: 0.2, rotationDeg: 0 },
        style: { strokeToken: 'install', strokeWidthPt: 1, opacity: 1, dash: 'solid' },
        label: 'A 설치',
        styleVersion: 1,
        locked: true,
        createdBy: 'author-1',
        createdAt: '2026-08-21T01:00:00.000Z',
        updatedBy: 'author-1',
        updatedAt: '2026-08-21T01:00:00.000Z',
      }],
      uploadedBy: 'author-1',
      uploadedAt: '2026-08-21T01:00:00.000Z',
    }];
    source.drawingApplicability = [{
      drawingSlot: 'D-01',
      decision: 'replacement',
      drawingId: 'drawing-1',
      reason: '대체도면 검토 완료',
      reviewedBy: 'reviewer-old',
      technicalReviewReference: 'TECH-OLD',
    }];
    source.engineeringValues = [{
      key: 'post-spacing',
      value: 900,
      sourceDocumentId: 'structural-review',
      sourceRevision: '7',
      applicableZones: ['A'],
      verificationStatus: 'approved',
      verifiedBy: 'reviewer-old',
      verifiedAt: '2026-08-21T01:00:00.000Z',
    }];
    source.riskAssessments = [{
      id: 'risk-1',
      workStage: '설치',
      hazard: '추락',
      initialRiskLevel: 'high',
      mitigationMeasures: ['안전대 사용'],
      verifiedBy: 'reviewer-old',
    }];
    source.releaseReadiness = {
      ...source.releaseReadiness,
      requiredReviewsComplete: true,
      snapshotHashMatches: true,
      pdfVisualCheckPassed: true,
      pdfTextCheckPassed: true,
      latestTemplateAvailable: true,
      latestDrawingRevisionAvailable: true,
      workerRefreshAvailable: true,
      recordAppendixAvailable: true,
    };
    const issued = ConstructionPlanSchema.parse({ ...source, status: 'issued' });

    const revision = createConstructionPlanRevision(issued, {
      id: 'plan-2',
      createdBy: 'author-2',
      revisionReason: '승인도면 최신 개정 반영',
      revisionType: 'design_change',
    });

    expect(revision.drawings[0]).toEqual(expect.objectContaining({
      planId: 'plan-2',
      approvalStatus: 'reviewed',
    }));
    expect(revision.drawings[0].approvalReference).toBeUndefined();
    expect(revision.drawings[0].annotations[0].locked).toBe(false);
    expect(revision.drawingApplicability[0].reviewedBy).toBeUndefined();
    expect(revision.drawingApplicability[0].technicalReviewReference).toBeUndefined();
    expect(revision.engineeringValues[0]).toEqual(expect.objectContaining({
      verificationStatus: 'unverified',
    }));
    expect(revision.engineeringValues[0].verifiedBy).toBeUndefined();
    expect(revision.engineeringValues[0].verifiedAt).toBeUndefined();
    expect(revision.riskAssessments[0].verifiedBy).toBeUndefined();
    expect(revision.releaseReadiness).toEqual({
      requiredReviewsComplete: false,
      unresolvedRequiredComments: 0,
      snapshotHashMatches: false,
      pdfVisualCheckPassed: false,
      pdfTextCheckPassed: false,
      drawingLegendMonochromeDistinct: true,
      latestTemplateAvailable: false,
      latestDrawingRevisionAvailable: false,
      workerRefreshAvailable: false,
      recordAppendixAvailable: false,
    });
    expect(revision.participants).toEqual({
      authorIds: ['author-1', 'author-2'],
      reviewerIds: [],
      approverIds: [],
    });
  });

  it('scrubs embedded drawing references when an issued revision opts out of drawing copy', () => {
    const source = makeDraft();
    const drawingSection = source.sections.find((section) => section.kind === 'drawing-page');
    if (!drawingSection) throw new Error('drawing-section-fixture-missing');
    drawingSection.content = {
      drawingId: 'old-drawing',
      drawingStudio: { background: { sourceUrl: 'old-preview' }, objects: [{ id: 'mark-1' }] },
    };
    const issued = ConstructionPlanSchema.parse({ ...source, status: 'issued' });

    const revision = createConstructionPlanRevision(issued, {
      id: 'revision-without-drawings',
      createdBy: 'author-2',
      revisionReason: '도면 적용성 전면 재검토',
      revisionType: 'design_change',
      copyDrawings: false,
    });

    expect(revision.drawings).toEqual([]);
    expect(revision.drawingApplicability).toEqual([]);
    expect(JSON.stringify(revision.sections)).not.toMatch(/old-drawing|old-preview|mark-1/);
  });

  it('retains createdBy when a migrated legacy plan has an empty author participant list', () => {
    const issued = ConstructionPlanSchema.parse({
      ...makeDraft(),
      status: 'issued',
      createdBy: 'legacy-creator',
      participants: { authorIds: [], reviewerIds: [], approverIds: [] },
    });

    const revision = createConstructionPlanRevision(issued, {
      id: 'legacy-client-revision',
      createdBy: 'office-reviser',
      revisionReason: '기존 발행본 계보 참여자 보강',
      revisionType: 'other',
    });

    expect(revision.participants.authorIds).toEqual(['legacy-creator', 'office-reviser']);
  });

  it('requires an auditable revision reason and type', () => {
    const issued = ConstructionPlanSchema.parse({ ...makeDraft(), status: 'issued' });

    expect(() => createConstructionPlanRevision(issued, {
      id: 'revision-invalid-reason',
      createdBy: 'author-2',
      revisionReason: '짧음',
      revisionType: 'other',
    })).toThrow('construction-plan-revision-reason-too-short');
  });

  it('supports a server-allocated higher revision without pretending the void number was reused', () => {
    const issued = ConstructionPlanSchema.parse({
      ...makeDraft(),
      status: 'issued',
      approvedSnapshotHash: 'c'.repeat(64),
    });

    const revision = createConstructionPlanRevision(issued, {
      id: 'plan-revision-2',
      createdBy: 'author-2',
      revisionNo: 2,
      revisionReason: '폐기된 REV.01 이후 재작성',
      revisionType: 'other',
    });

    expect(revision).toEqual(expect.objectContaining({
      revision: 2,
      sourceRevisionNo: 0,
      supersedesPlanId: issued.id,
      sourceSnapshotHash: 'c'.repeat(64),
    }));
  });

  it('codifies editable states and legal workflow transitions', () => {
    expect(isPlanContentEditable('draft')).toBe(true);
    expect(isPlanContentEditable('changes_requested')).toBe(true);
    expect(isPlanContentEditable('in_review')).toBe(false);
    expect(canTransitionPlanStatus('draft', 'in_review')).toBe(true);
    expect(canTransitionPlanStatus('issued', 'draft')).toBe(false);
  });

  it('strips document identity and lineage fields from generic client updates', () => {
    const parsed = UpdateConstructionPlanInputSchema.parse({
      updatedBy: 'author-1',
      title: '허용된 제목 변경',
      siteId: 'forged-site',
      tradeType: 'system-shoring',
      documentNo: 'FORGED-DOC-NO',
      revision: 999,
      status: 'issued',
      templateId: 'forged-template',
      templateVersion: '999.0.0',
      rendererVersion: 'forged-renderer',
      schemaVersion: 999,
      seriesId: 'forged-series',
      lineageRootPlanId: 'forged-root',
      revisionReason: '위조된 개정 사유',
      revisionType: 'other',
      sourceRevisionNo: 998,
      sourceSnapshotHash: 'a'.repeat(64),
      clonedFromPlanId: 'forged-source',
      supersedesPlanId: 'forged-previous',
      supersededByPlanId: 'forged-next',
      releaseReadiness: {
        requiredReviewsComplete: true,
        unresolvedRequiredComments: 0,
        snapshotHashMatches: true,
        pdfTextCheckPassed: true,
        pdfVisualCheckPassed: true,
        latestTemplateAvailable: true,
        latestDrawingRevisionAvailable: true,
        workerRefreshAvailable: true,
        recordAppendixAvailable: true,
      },
      validationSummary: { errors: 0, warnings: 0, checkedAt: '2026-08-21T00:00:00.000Z' },
      activeReviewSnapshotId: 'forged-review',
      activeReviewSnapshotHash: 'd'.repeat(64),
      activeReviewSnapshotStoragePath: 'forged/review-snapshot.json',
      activeReviewSnapshotLockVersion: 998,
      activeReviewPackageId: 'forged-package',
      activeReviewCycleId: 'forged-cycle',
      reviewRound: 999,
      commentSummary: {
        totalOpen: 1,
        totalAddressed: 0,
        totalResolved: 0,
        requiredOpen: 1,
        requiredAddressed: 0,
        requiredResolved: 0,
        unresolvedRequired: 1,
        updatedAt: '2026-08-21T00:00:00.000Z',
      },
      approvedSnapshotId: 'forged-approved',
      approvedSnapshotHash: 'b'.repeat(64),
      approvedSnapshotStoragePath: 'forged/snapshot.json',
      approvedEvidenceId: 'forged-evidence',
      approvedEvidenceHash: 'e'.repeat(64),
      issuedExportId: 'forged-export',
      issuedAt: '2026-08-21T00:00:00.000Z',
      issuedBy: 'forged-issuer',
      issuedExportStoragePath: 'forged/export.pdf',
      issuedExportSha256: 'c'.repeat(64),
      issuedExportFileName: 'forged.pdf',
      participants: {
        authorIds: ['attacker'],
        reviewerIds: ['attacker'],
        approverIds: ['attacker'],
      },
      createdBy: 'attacker',
      createdByName: '위조 작성자',
    });

    expect(parsed).toEqual({ updatedBy: 'author-1', title: '허용된 제목 변경' });
  });
});
