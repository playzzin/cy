import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    assertConstructionPlanAutosaveAuditEventIdempotent,
    buildConstructionPlanAutosaveAuditEvents,
    diffConstructionPlanAutosaveAudit,
    MAX_CONSTRUCTION_PLAN_AUTOSAVE_AUDIT_EVENTS,
    partitionConstructionPlanAutosaveAuditEvents,
    sanitizeConstructionPlanAutosaveAuditReason,
} from './autosaveAudit';

const annotation = (id: string, label = '설치구간') => ({
    id,
    pageIndex: 0,
    pageFingerprint: 'f'.repeat(64),
    layer: 'install',
    geometry: { kind: 'rect', x: 0.1, y: 0.2, w: 0.3, h: 0.4, rotationDeg: 0 },
    style: {
        strokeToken: 'construction-plan.install.stroke',
        fillToken: 'construction-plan.install.fill',
        strokeWidthPt: 2,
        opacity: 0.6,
        dash: 'solid',
    },
    label,
    styleVersion: 1,
    locked: false,
    createdBy: 'author-1',
    createdAt: '2026-08-22T00:00:00.000Z',
    updatedBy: 'author-1',
    updatedAt: '2026-08-22T00:00:00.000Z',
});

const plan = () => ({
    siteId: 'site-1',
    updatedBy: 'author-1',
    updatedAt: '2026-08-22T00:00:00.000Z',
    lockVersion: 1,
    editLock: { userId: 'author-1', heartbeatAt: '2026-08-22T00:00:00.000Z' },
    sections: [{
        id: 'section-method',
        key: 'method',
        standardTextModified: false,
        content: { standardTextVersion: 'v1', standardTextCurrent: '표준 설치 순서를 준수한다.' },
        updatedBy: 'author-1',
        updatedAt: '2026-08-22T00:00:00.000Z',
    }],
    organizationSnapshot: {
        assignments: [{
            id: 'site-manager', role: 'site_manager', label: '현장소장', required: true,
            responsibilities: ['작업 총괄'], order: 0,
            worker: { id: 'worker-1', name: '김현장', position: '소장', status: 'active' },
        }],
        additionalWorkers: [],
    },
    drawings: [{
        id: 'drawing-1',
        storagePath: 'construction-plans/site-1/plan-1/drawings/drawing-1/source.pdf',
        approvalStatus: 'draft',
        previewStatus: 'pending',
        annotations: [annotation('annotation-1')],
    }],
});

test('autosave audit classifies standard text, organization role, drawing status, and annotation CRUD', () => {
    const before = plan();
    const after = structuredClone(before);
    after.sections[0].standardTextModified = true;
    after.sections[0].content.standardTextCurrent = '현장 보강 순서를 추가한다.';
    (after.sections[0] as typeof after.sections[0] & { standardTextModificationReason?: string })
        .standardTextModificationReason = '승인도면 현장조건 반영';
    after.organizationSnapshot.assignments[0].worker = {
        id: 'worker-2', name: '박현장', position: '소장', status: 'active',
    };
    after.drawings[0].approvalStatus = 'reviewed';
    after.drawings[0].previewStatus = 'ready';
    after.drawings[0].annotations[0].label = '수정 설치구간';
    after.drawings[0].annotations.push(annotation('annotation-2', '추가 설치구간'));

    const diffs = diffConstructionPlanAutosaveAudit(before, after);
    assert.deepEqual(diffs.map((diff) => diff.action), [
        'standard_text_changed',
        'organization_role_changed',
        'drawing_metadata_status_changed',
        'drawing_annotation_changed',
        'drawing_annotation_created',
    ]);
    assert.equal(diffs[0].reason, '승인도면 현장조건 반영');
    diffs.forEach((diff) => {
        assert.match(diff.beforeHash, /^[a-f0-9]{64}$/);
        assert.match(diff.afterHash, /^[a-f0-9]{64}$/);
        assert.notEqual(diff.beforeHash, diff.afterHash);
        assert.ok(diff.summary.length <= 100);
        assert.ok(diff.reason.length <= 100);
    });

    const deleted = structuredClone(after);
    deleted.organizationSnapshot.assignments = [];
    deleted.drawings[0].annotations = [];
    assert.deepEqual(
        diffConstructionPlanAutosaveAudit(after, deleted).map((diff) => diff.action),
        ['organization_role_deleted', 'drawing_annotation_deleted', 'drawing_annotation_deleted'],
    );
});

test('autosave audit skips irrelevant control-only updates and annotation audit timestamps', () => {
    const before = plan();
    const after = structuredClone(before);
    after.updatedAt = '2026-08-22T00:05:00.000Z';
    after.updatedBy = 'author-2';
    after.lockVersion = 2;
    after.editLock.heartbeatAt = '2026-08-22T00:05:00.000Z';
    after.drawings[0].annotations[0].updatedAt = '2026-08-22T00:05:00.000Z';
    after.drawings[0].annotations[0].updatedBy = 'author-2';
    assert.deepEqual(diffConstructionPlanAutosaveAudit(before, after), []);
});

test('autosave events are deterministic, append-only addressable, and contain no changed raw content or Storage URL', () => {
    const before = plan();
    const after = structuredClone(before);
    after.sections[0].content.standardTextCurrent = 'https://storage.googleapis.com/private/source.pdf';
    (after.sections[0] as typeof after.sections[0] & { standardTextModificationReason?: string })
        .standardTextModificationReason = '승인 반영 private.person@example.com https://storage.googleapis.com/private/source.pdf';
    after.drawings[0].annotations[0].label = 'private.person@example.com';
    (after.drawings[0].annotations[0] as typeof after.drawings[0]['annotations'][number] & { reason?: string })
        .reason = '현장 반영 010-1234-5678 gs://secret/source.pdf';
    const diffs = diffConstructionPlanAutosaveAudit(before, after);
    const context = {
        requestId: 'event-123',
        planId: 'plan-1',
        siteId: 'site-1',
        actorId: 'author-1',
        actorName: '김작성',
        timestamp: '2026-08-22T01:02:03.000Z',
    };
    const first = buildConstructionPlanAutosaveAuditEvents(context, diffs);
    const retry = buildConstructionPlanAutosaveAuditEvents(context, diffs);
    assert.deepEqual(retry, first);
    assert.equal(new Set(first.map((event) => event.id)).size, first.length);
    first.forEach((event) => {
        assert.match(event.id, /^cpa-[a-f0-9]{48}$/);
        assert.equal(event.requestId, 'event-123');
        assert.equal(event.actorId, 'author-1');
        assert.equal(event.actorName, '김작성');
        assert.equal(event.timestamp, '2026-08-22T01:02:03.000Z');
        assert.match(event.eventFingerprint, /^[a-f0-9]{64}$/);
    });
    const serialized = JSON.stringify(first);
    assert.equal(serialized.includes('storage.googleapis.com'), false);
    assert.equal(serialized.includes('private.person@example.com'), false);
    assert.equal(serialized.includes('source.pdf'), false);
    assert.equal(serialized.includes('construction-plan.install.stroke'), false);
    assert.match(first[0].reason, /\[이메일 제거\]/);
    assert.match(first[0].reason, /\[링크 제거\]/);
    assert.match(first[1].reason, /\[연락처 제거\]/);
    assert.match(first[1].reason, /\[링크 제거\]/);

    first.forEach((event) => assert.doesNotThrow(() => (
        assertConstructionPlanAutosaveAuditEventIdempotent(event, event)
    )));
    assert.throws(() => assertConstructionPlanAutosaveAuditEventIdempotent(
        { ...first[0], eventFingerprint: '0'.repeat(64) },
        first[0],
    ), /data-loss|일치하지 않습니다/);
});

test('autosave audit reason redaction, event upper bound, and 400-event transaction chunks fail closed', () => {
    assert.equal(
        sanitizeConstructionPlanAutosaveAuditReason(
            '담당 02-1234-5678 user@example.com https://example.com/a\u0000',
            '기본 사유',
        ),
        '담당 [연락처 제거] [이메일 제거] [링크 제거]',
    );
    assert.deepEqual(
        partitionConstructionPlanAutosaveAuditEvents(Array.from({ length: 801 }, (_, index) => index))
            .map((chunk) => chunk.length),
        [400, 400, 1],
    );

    const before = plan();
    const after = structuredClone(before);
    after.drawings[0].annotations = Array.from(
        { length: MAX_CONSTRUCTION_PLAN_AUTOSAVE_AUDIT_EVENTS + 1 },
        (_, index) => annotation(`bulk-${index + 1}`),
    );
    assert.throws(
        () => diffConstructionPlanAutosaveAudit(before, after),
        /event-limit-exceeded/,
    );
});
