import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
    applyConstructionPlanErpRefreshProjection,
    assertConstructionPlanErpRefreshApplyAccess,
    assertConstructionPlanErpRefreshReadAccess,
    buildConstructionPlanErpRefreshAuditEvent,
    diffConstructionPlanErpRefreshSnapshots,
    parseConstructionPlanErpRefreshApplyRequest,
    parseConstructionPlanErpRefreshGetRequest,
    projectConstructionPlanErpRefreshSnapshot,
    requireConstructionPlanErpRefreshAuthenticatedUid,
    hydrateConstructionPlanErpRefreshClaimResponse,
    resolveConstructionPlanErpRefreshClaim,
} from './erpRefresh';
import { classifyConstructionPlanRoleAccess, isUnknownRecord, type UnknownRecord } from './domain';

const capturedAt = '2026-08-22T00:00:00.000Z';
const refreshedAt = '2026-08-23T00:00:00.000Z';
const refreshEvidence = {
    reason: 'ERP 원천 변경 검증 반영',
    auditEventId: 'audit-erp-refresh-1',
};

const source = (
    kind: 'site' | 'company' | 'team',
    id: string,
    value: UnknownRecord,
    updatedAt = '2026-08-21T00:00:00.000Z',
): UnknownRecord => ({
    source: kind,
    sourceId: id,
    capturedAt,
    sourceUpdatedAt: updatedAt,
    overridden: false,
    value: { id, ...value },
});

const currentSnapshot = (): UnknownRecord => ({
    schemaVersion: 1,
    capturedAt,
    legacyPrivateMetadata: { payrollAccount: 'must-never-survive-refresh' },
    site: source('site', 'site-1', {
        name: '기존 현장',
        address: '서울',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        clientCompanyId: 'client-1',
        clientCompanyName: '기존 발주처',
        contractorCompanyId: 'contractor-1',
        contractorCompanyName: '기존 원도급사',
        imageUrl: 'https://private.example/old.jpg?token=private-download-token',
        photos: ['https://private.example/old-2.jpg?token=private-download-token'],
    }),
    clientCompany: source('company', 'client-1', {
        name: '기존 발주처',
        address: '서울 종로구',
        email: 'secret@example.com',
        fax: '02-0000-0000',
        bankAccount: 'private-account',
    }),
    contractorCompany: source('company', 'contractor-1', {
        name: '기존 원도급사',
        address: '서울 강남구',
    }),
    responsibleTeam: source('team', 'team-1', {
        name: '시공팀',
        leaderName: '김책임',
        memberIds: ['private-worker'],
    }),
});

const latestSnapshot = (): UnknownRecord => ({
    ...currentSnapshot(),
    capturedAt: refreshedAt,
    site: {
        ...currentSnapshot().site as UnknownRecord,
        capturedAt: refreshedAt,
        sourceUpdatedAt: '2026-08-22T12:00:00.000Z',
        value: {
            ...(currentSnapshot().site as UnknownRecord).value as UnknownRecord,
            name: '변경 현장',
            address: '서울 강남구',
            imageUrl: 'https://private.example/new.jpg?token=private-download-token',
        },
    },
    clientCompany: {
        ...currentSnapshot().clientCompany as UnknownRecord,
        capturedAt: refreshedAt,
        sourceUpdatedAt: '2026-08-22T11:00:00.000Z',
        value: {
            ...(currentSnapshot().clientCompany as UnknownRecord).value as UnknownRecord,
            name: '변경 발주처',
            email: 'new-secret@example.com',
        },
    },
    contractorCompany: {
        ...currentSnapshot().contractorCompany as UnknownRecord,
        capturedAt: refreshedAt,
        value: {
            ...(currentSnapshot().contractorCompany as UnknownRecord).value as UnknownRecord,
            name: '변경 원도급사',
        },
    },
});

const plan = (overrides: UnknownRecord = {}): UnknownRecord => ({
    id: 'plan-1',
    siteId: 'site-1',
    status: 'draft',
    lockVersion: 7,
    editLock: {
        userId: 'author-1',
        expiresAtEpochMs: Date.parse('2026-08-24T00:00:00.000Z'),
    },
    createdBy: 'author-1',
    participants: { authorIds: ['author-1'], reviewerIds: ['reviewer-1'], approverIds: [] },
    erpSnapshot: currentSnapshot(),
    projectSnapshot: {
        capturedAt,
        siteName: '기존 현장',
        address: '서울',
        clientName: '기존 발주처',
        contractorName: '기존 원도급사',
        constructionPeriod: { startDate: '2026-01-01', endDate: '2026-12-31' },
        buildings: ['101동'],
        floors: ['1층'],
        zones: ['A구역'],
        sitePhotos: [],
        emergencyContactsComplete: false,
        differsFromMaster: false,
    },
    releaseReadiness: {
        requiredReviewsComplete: true,
        snapshotHashMatches: true,
        pdfVisualCheckPassed: true,
        pdfTextCheckPassed: true,
    },
    activeReviewSnapshotId: 'stale-snapshot',
    activeReviewSnapshotHash: 'a'.repeat(64),
    activeReviewPackageId: 'stale-package',
    validationSummary: { errors: 0, warnings: 0, checkedAt: capturedAt },
    updatedBy: 'author-1',
    updatedAt: capturedAt,
    ...overrides,
});

const siteAccess = classifyConstructionPlanRoleAccess(['site_manager']);
const officeAccess = classifyConstructionPlanRoleAccess(['office_staff']);

test('callable authentication fails closed without a non-empty Firebase uid', () => {
    assert.throws(() => requireConstructionPlanErpRefreshAuthenticatedUid(undefined));
    assert.throws(() => requireConstructionPlanErpRefreshAuthenticatedUid({ uid: '   ' }));
    assert.equal(requireConstructionPlanErpRefreshAuthenticatedUid({ uid: 'author-1' }), 'author-1');
});

test('safe refresh projection excludes photos, email, fax and arbitrary private fields', () => {
    const projected = projectConstructionPlanErpRefreshSnapshot(currentSnapshot()) as UnknownRecord;
    const serialized = JSON.stringify(projected);
    assert.equal(serialized.includes('private.example'), false);
    assert.equal(serialized.includes('secret@example.com'), false);
    assert.equal(serialized.includes('fax'), false);
    assert.equal(serialized.includes('private-account'), false);
    assert.equal(serialized.includes('private-worker'), false);
    assert.equal(((projected.site as UnknownRecord).value as UnknownRecord).address, '서울');
});

test('diff ignores excluded PII changes and emits only exact safe slot.field ids', () => {
    const changes = diffConstructionPlanErpRefreshSnapshots(currentSnapshot(), latestSnapshot());
    assert.deepEqual(changes.map((change) => change.id), [
        'site.name',
        'site.address',
        'clientCompany.name',
        'contractorCompany.name',
    ]);
});

test('partial selection preserves every unselected ERP value and updates PDF-visible project mapping', () => {
    const result = applyConstructionPlanErpRefreshProjection({
        plan: plan({
            projectSnapshot: {
                ...(plan().projectSnapshot as UnknownRecord),
                sitePhotos: ['https://private.example/legacy.jpg?token=private-download-token'],
            },
        }),
        latestSnapshot: latestSnapshot(),
        fieldIds: ['site.address'],
        actorId: 'author-1',
        capturedAt: refreshedAt,
        ...refreshEvidence,
    });
    const nextSnapshot = result.plan.erpSnapshot as UnknownRecord;
    const nextSite = ((nextSnapshot.site as UnknownRecord).value as UnknownRecord);
    assert.equal(nextSite.address, '서울 강남구');
    assert.equal(nextSite.name, '기존 현장', 'unselected master name must not be overwritten');
    assert.equal((result.plan.projectSnapshot as UnknownRecord).address, '서울 강남구');
    assert.equal((result.plan.projectSnapshot as UnknownRecord).siteName, '기존 현장');
    assert.deepEqual((result.plan.projectSnapshot as UnknownRecord).sitePhotos, []);
    assert.equal((result.plan.projectSnapshot as UnknownRecord).differsFromMaster, true);
    assert.equal((nextSnapshot.site as UnknownRecord).overridden, true);
    assert.equal('sourceUpdatedAt' in (nextSnapshot.site as UnknownRecord), false);
    assert.ok(isUnknownRecord(nextSnapshot.fieldProvenance)
        && isUnknownRecord(nextSnapshot.fieldProvenance['site.address']));
    const addressProvenance = (nextSnapshot.fieldProvenance as UnknownRecord)['site.address'] as UnknownRecord;
    const nameProvenance = (nextSnapshot.fieldProvenance as UnknownRecord)['site.name'] as UnknownRecord;
    assert.equal(addressProvenance.captureKind, 'refresh');
    assert.equal(addressProvenance.appliedBy, 'author-1');
    assert.equal(addressProvenance.appliedAt, refreshedAt);
    assert.equal(addressProvenance.changeReason, refreshEvidence.reason);
    assert.equal(addressProvenance.auditEventId, refreshEvidence.auditEventId);
    assert.match(String(addressProvenance.sourceMasterHash), /^[a-f0-9]{64}$/);
    assert.equal(nameProvenance.captureKind, 'initial');
    assert.equal(nameProvenance.changeReason, undefined);
    const serializedNextSnapshot = JSON.stringify(nextSnapshot);
    assert.equal(serializedNextSnapshot.includes('private.example'), false);
    assert.equal(serializedNextSnapshot.includes('secret@example.com'), false);
    assert.equal(serializedNextSnapshot.includes('fax'), false);
    assert.equal(serializedNextSnapshot.includes('private-account'), false);
    assert.equal(serializedNextSnapshot.includes('must-never-survive-refresh'), false);
    assert.equal(serializedNextSnapshot.includes('private-worker'), false);
    assert.equal(JSON.stringify(result.plan).includes('private-download-token'), false);
    assert.deepEqual(result.appliedFieldIds, ['site.address']);
    assert.ok(result.remainingFieldIds.includes('site.name'));
    assert.equal(result.plan.lockVersion, 8);
    assert.equal(result.plan.updatedBy, 'author-1');
    assert.equal(result.plan.activeReviewSnapshotId, 'stale-snapshot');
    assert.equal((result.plan.releaseReadiness as UnknownRecord).snapshotHashMatches, false);
});

test('changes-requested R1 baseline survives ERP apply for the same-cycle R2 lineage and unresolved counters', () => {
    const commentSummary = {
        totalOpen: 2,
        totalAddressed: 1,
        totalResolved: 3,
        requiredOpen: 1,
        requiredAddressed: 1,
        requiredResolved: 1,
        unresolvedRequired: 2,
    };
    const result = applyConstructionPlanErpRefreshProjection({
        plan: plan({
            status: 'changes_requested',
            reviewRound: 1,
            activeReviewCycleId: 'cycle-r1',
            activeReviewPackageId: 'package-r1',
            activeReviewSnapshotId: 'snapshot-r1',
            activeReviewSnapshotHash: 'b'.repeat(64),
            activeReviewSnapshotStoragePath: 'construction-plans/site-1/plan-1/reviews/snapshot-r1.json',
            activeReviewSnapshotLockVersion: 7,
            commentSummary,
        }),
        latestSnapshot: latestSnapshot(),
        fieldIds: ['site.address'],
        actorId: 'author-1',
        capturedAt: refreshedAt,
        ...refreshEvidence,
    });

    assert.equal(result.plan.status, 'changes_requested');
    assert.equal(result.plan.activeReviewCycleId, 'cycle-r1', 'R2 must reuse the R1 cycle');
    assert.equal(result.plan.activeReviewPackageId, 'package-r1', 'R2 previousPackageId must bind to R1');
    assert.equal(result.plan.activeReviewSnapshotId, 'snapshot-r1');
    assert.equal(result.plan.activeReviewSnapshotHash, 'b'.repeat(64));
    assert.equal(
        result.plan.activeReviewSnapshotStoragePath,
        'construction-plans/site-1/plan-1/reviews/snapshot-r1.json',
        'R2 diff baseline must remain addressable',
    );
    assert.equal(result.plan.activeReviewSnapshotLockVersion, 7);
    assert.equal(result.plan.reviewRound, 1);
    assert.deepEqual(result.plan.commentSummary, commentSummary, 'unresolved review counters must carry');
    assert.equal(result.plan.lockVersion, 8);
});

test('selected company names update the project values consumed by PDF without touching the other company', () => {
    const result = applyConstructionPlanErpRefreshProjection({
        plan: plan(),
        latestSnapshot: latestSnapshot(),
        fieldIds: ['clientCompany.name'],
        actorId: 'author-1',
        capturedAt: refreshedAt,
        ...refreshEvidence,
    });
    const project = result.plan.projectSnapshot as UnknownRecord;
    assert.equal(project.clientName, '변경 발주처');
    assert.equal(project.contractorName, '기존 원도급사');
});

test('selection fails closed when a requested field is no longer an actual difference', () => {
    assert.throws(() => applyConstructionPlanErpRefreshProjection({
        plan: plan(),
        latestSnapshot: latestSnapshot(),
        fieldIds: ['site.code'],
        actorId: 'author-1',
        capturedAt: refreshedAt,
        ...refreshEvidence,
    }), /construction-plan|ERP|field|difference|different|selected|latest/i);
});

test('linked master identity changes require the site link, denormalized name, and full source group together', () => {
    const current = currentSnapshot();
    const siteSource = current.site as UnknownRecord;
    const companySource = current.clientCompany as UnknownRecord;
    const relationshipLatest: UnknownRecord = {
        ...current,
        capturedAt: refreshedAt,
        site: {
            ...siteSource,
            capturedAt: refreshedAt,
            value: {
                ...(siteSource.value as UnknownRecord),
                clientCompanyId: 'client-2',
                clientCompanyName: '신규 발주처',
            },
        },
        clientCompany: {
            ...companySource,
            sourceId: 'client-2',
            capturedAt: refreshedAt,
            value: {
                ...(companySource.value as UnknownRecord),
                id: 'client-2',
                name: '신규 발주처',
            },
        },
    };
    assert.throws(() => applyConstructionPlanErpRefreshProjection({
        plan: plan(),
        latestSnapshot: relationshipLatest,
        fieldIds: ['site.clientCompanyId', 'clientCompany.name'],
        actorId: 'author-1',
        capturedAt: refreshedAt,
        ...refreshEvidence,
    }));

    const result = applyConstructionPlanErpRefreshProjection({
        plan: plan(),
        latestSnapshot: relationshipLatest,
        fieldIds: ['site.clientCompanyId', 'site.clientCompanyName', 'clientCompany.name'],
        actorId: 'author-1',
        capturedAt: refreshedAt,
        ...refreshEvidence,
    });
    const next = result.plan.erpSnapshot as UnknownRecord;
    assert.equal((next.clientCompany as UnknownRecord).sourceId, 'client-2');
    assert.equal(((next.site as UnknownRecord).value as UnknownRecord).clientCompanyId, 'client-2');
    assert.equal((result.plan.projectSnapshot as UnknownRecord).clientName, '신규 발주처');
});

test('strict requests reject client-provided latest payloads, unknown fields and short reasons', () => {
    assert.throws(() => parseConstructionPlanErpRefreshGetRequest({
        planId: 'plan-1', latest: latestSnapshot(),
    }));
    assert.throws(() => parseConstructionPlanErpRefreshApplyRequest({
        planId: 'plan-1', expectedLockVersion: 7, fieldIds: ['site.email'],
        reason: '정상적인 사유', idempotencyKey: 'key-1',
    }));
    assert.throws(() => parseConstructionPlanErpRefreshApplyRequest({
        planId: 'plan-1', expectedLockVersion: 7, fieldIds: ['site.address'],
        reason: '짧음', idempotencyKey: 'key-1',
    }));
    assert.deepEqual(parseConstructionPlanErpRefreshApplyRequest({
        planId: 'plan-1', expectedLockVersion: 7, fieldIds: [],
        organizationSelection: {
            refreshAssignedWorkers: false,
            refreshAdditionalWorkers: true,
            reassignments: [{ assignmentId: 'assignment-safety', workerId: 'worker-new' }],
        },
        reason: '작업자 명부와 안전담당자 변경 반영', idempotencyKey: 'key-organization-1',
    }).organizationSelection, {
        refreshAssignedWorkers: false,
        refreshAdditionalWorkers: true,
        reassignments: [{ assignmentId: 'assignment-safety', workerId: 'worker-new' }],
    });
    assert.throws(() => parseConstructionPlanErpRefreshApplyRequest({
        planId: 'plan-1', expectedLockVersion: 7, fieldIds: [],
        organizationSelection: {
            refreshAssignedWorkers: true,
            refreshAdditionalWorkers: false,
            reassignments: [],
            latestWorkers: [{ id: 'forged' }],
        },
        reason: '클라이언트 최신 작업자 위조 차단', idempotencyKey: 'key-organization-2',
    }));
});

test('read permits participants or central roles but not unrelated site users', () => {
    assert.doesNotThrow(() => assertConstructionPlanErpRefreshReadAccess(plan(), {
        uid: 'reviewer-1', access: siteAccess,
    }));
    assert.doesNotThrow(() => assertConstructionPlanErpRefreshReadAccess(plan(), {
        uid: 'office-1', access: officeAccess,
    }));
    assert.throws(() => assertConstructionPlanErpRefreshReadAccess(plan(), {
        uid: 'outsider-1', access: siteAccess,
    }));
});

test('apply requires editable status, exact version, and the active lock owner', () => {
    const base = {
        actor: { uid: 'author-1', access: siteAccess },
        expectedLockVersion: 7,
        nowEpochMs: Date.parse('2026-08-23T00:00:00.000Z'),
    };
    assert.doesNotThrow(() => assertConstructionPlanErpRefreshApplyAccess({ plan: plan(), ...base }));
    assert.throws(() => assertConstructionPlanErpRefreshApplyAccess({
        plan: plan({ status: 'in_review' }), ...base,
    }));
    assert.throws(() => assertConstructionPlanErpRefreshApplyAccess({
        plan: plan(), ...base, expectedLockVersion: 6,
    }));
    assert.throws(() => assertConstructionPlanErpRefreshApplyAccess({
        plan: plan({ editLock: { userId: 'other', expiresAtEpochMs: Date.parse('2026-08-24T00:00:00.000Z') } }),
        ...base,
    }));
    assert.throws(() => assertConstructionPlanErpRefreshApplyAccess({
        plan: plan({ editLock: { userId: 'author-1', expiresAtEpochMs: Date.parse('2026-08-22T00:00:00.000Z') } }),
        ...base,
    }));
});

test('idempotency returns the stored response and conflicts on the same key with another payload', () => {
    const stored = {
        operation: 'apply_erp_snapshot_fields',
        actorId: 'author-1',
        requestFingerprint: 'fingerprint-a',
        response: {
            planId: 'plan-1',
            appliedFieldIds: ['site.address'],
            remainingFieldIds: ['site.name'],
            appliedOrganizationChangeIds: [],
            remainingOrganizationChangeIds: [],
            auditEventId: 'audit-1',
            afterLockVersion: 8,
        },
    };
    const restored = resolveConstructionPlanErpRefreshClaim(
        stored,
        'author-1',
        'fingerprint-a',
    );
    assert.equal(restored?.idempotent, true);
    assert.equal(restored?.plan, undefined, 'claims must not duplicate the potentially large plan document');
    const hydrated = hydrateConstructionPlanErpRefreshClaimResponse(restored!, plan({ lockVersion: 9 }));
    assert.equal((hydrated.plan as UnknownRecord).lockVersion, 9);
    assert.throws(() => hydrateConstructionPlanErpRefreshClaimResponse(
        restored!,
        plan({ lockVersion: 7 }),
    ));
    assert.throws(() => resolveConstructionPlanErpRefreshClaim(stored, 'author-1', 'fingerprint-b'));
    assert.equal(resolveConstructionPlanErpRefreshClaim(undefined, 'author-1', 'fingerprint-a'), null);
});

test('immutable audit projection records actor, reason, hashes, selected fields, and safe source timestamps', () => {
    const projection = applyConstructionPlanErpRefreshProjection({
        plan: plan(),
        latestSnapshot: latestSnapshot(),
        fieldIds: ['site.address'],
        actorId: 'author-1',
        capturedAt: refreshedAt,
        ...refreshEvidence,
    });
    const event = buildConstructionPlanErpRefreshAuditEvent({
        requestId: 'audit-request-1',
        planId: 'plan-1',
        siteId: 'site-1',
        actorId: 'author-1',
        actorName: '김작성',
        capturedAt: refreshedAt,
        reason: '현장 주소 마스터 변경 확인',
        fieldIds: projection.appliedFieldIds,
        beforeHash: projection.beforeHash,
        afterHash: projection.afterHash,
        latestSnapshot: latestSnapshot(),
        requestFingerprint: 'fingerprint-a',
        beforeLockVersion: 7,
        afterLockVersion: 8,
    });
    assert.equal(event.type, 'erp_snapshot_fields_applied');
    assert.equal(event.actorId, 'author-1');
    assert.equal(event.actorName, '김작성');
    assert.equal(event.reason, '현장 주소 마스터 변경 확인');
    assert.deepEqual(event.fieldIds, ['site.address']);
    assert.match(String(event.beforeHash), /^[a-f0-9]{64}$/);
    assert.match(String(event.afterHash), /^[a-f0-9]{64}$/);
    assert.equal(((event.sourceSummary as UnknownRecord).site as UnknownRecord).sourceId, 'site-1');
    assert.equal(((event.sourceSummary as UnknownRecord).site as UnknownRecord).sourceUpdatedAt, '2026-08-22T12:00:00.000Z');
    assert.equal(JSON.stringify(event).includes('secret@example.com'), false);
    assert.equal(JSON.stringify(event).includes('private.example'), false);
});
