import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
    applyConstructionPlanOrganizationRefreshProjection,
    compareConstructionPlanOrganizationRefresh,
    parseConstructionPlanOrganizationRefreshSelection,
    projectConstructionPlanOrganizationWorkerDirectory,
} from './organizationRefresh';
import {
    buildConstructionPlanWorkerDirectoryBinding,
    canonicalStringify,
    type SafeWorkerDirectoryEntry,
    type UnknownRecord,
} from './domain';

const capturedAt = '2026-08-22T00:00:00.000Z';
const refreshedAt = '2026-08-23T00:00:00.000Z';

const worker = (
    id: string,
    name: string,
    status: 'active' | 'inactive' | 'on_leave' | 'unknown' = 'active',
    teamId = 'team-1',
    siteId?: string,
): SafeWorkerDirectoryEntry => ({
    id, name, status, teamId, teamName: teamId === 'team-1' ? '동바리팀' : '타팀',
    role: '시스템동바리공', position: '작업자',
    ...(siteId ? { siteId } : {}),
});

const currentOrganization = (): UnknownRecord => ({
    capturedAt,
    sourceSiteId: 'site-1',
    assignments: [
        {
            id: 'assignment-site-manager', role: 'site_manager', label: '현장책임자',
            required: true, responsibilities: ['현장 총괄'], order: 0,
            worker: worker('worker-manager', '김책임'),
        },
        {
            id: 'assignment-safety', role: 'safety_manager', label: '안전담당자',
            required: true, responsibilities: ['안전 관리'], order: 1,
            worker: worker('worker-inactive', '이안전'),
        },
    ],
    additionalWorkers: [
        worker('worker-old', '박작업'),
        worker('worker-moved', '최이동'),
    ],
});

const latestDirectory = () => [
    worker('worker-manager', '김책임'),
    worker('worker-inactive', '이안전', 'inactive'),
    worker('worker-old', '박작업'),
    worker('worker-moved', '최이동', 'active', 'team-2'),
    worker('worker-new', '정신규'),
];

test('worker directory projection removes contact, photo, payroll and arbitrary HR fields', () => {
    const projected = projectConstructionPlanOrganizationWorkerDirectory([{
        ...worker('worker-1', '김작업'),
        contact: '010-0000-0000', photoUrl: 'https://private.example/photo.jpg',
        bankAccount: 'secret-account', residentNumber: '000000-0000000', salary: 99999999,
    }]);
    assert.deepEqual(projected, [worker('worker-1', '김작업')]);
    const serialized = JSON.stringify(projected);
    assert.equal(serialized.includes('010-0000'), false);
    assert.equal(serialized.includes('private.example'), false);
    assert.equal(serialized.includes('secret-account'), false);
    assert.equal(serialized.includes('residentNumber'), false);
    assert.equal(serialized.includes('salary'), false);
});

test('comparison reports new, inactive and team-changed workers without mutating the plan', () => {
    const current = currentOrganization();
    const before = JSON.stringify(current);
    const comparison = compareConstructionPlanOrganizationRefresh({
        current,
        siteId: 'site-1',
        latestWorkers: latestDirectory(),
    });
    assert.equal(JSON.stringify(current), before, 'comparison must never auto-overwrite the plan');
    assert.ok(comparison.changes.some((change) => change.kind === 'new' && change.workerId === 'worker-new'));
    assert.ok(comparison.changes.some((change) => change.kind === 'inactive' && change.workerId === 'worker-inactive'));
    assert.ok(comparison.changes.some((change) => change.kind === 'team_changed' && change.workerId === 'worker-moved'));
    assert.ok(comparison.assignmentIssues.some((issue) => (
        issue.assignmentId === 'assignment-safety' && issue.kind === 'inactive'
    )));
    assert.equal(comparison.additionalWorkersChanged, true);
});

test('partial organization refresh fails closed while an unselected assignee is inactive or stale', () => {
    assert.throws(() => applyConstructionPlanOrganizationRefreshProjection({
        current: currentOrganization(),
        siteId: 'site-1',
        responsibleTeamId: 'team-1',
        latestWorkers: latestDirectory(),
        selection: {
            refreshAssignedWorkers: false,
            refreshAdditionalWorkers: true,
            reassignments: [],
        },
        actorId: 'author-1',
        capturedAt: refreshedAt,
        reason: '신규 작업자 명부 선택 반영',
        auditEventId: 'audit-organization-1',
    }), /선택하지 않은 조직 작업자/);
});

test('partial organization refresh preserves exact active workers and emits a canonical union fingerprint', () => {
    const compatibleLatest = [
        worker('worker-manager', '김책임'),
        worker('worker-inactive', '이안전'),
        worker('worker-old', '박작업'),
        worker('worker-moved', '최이동'),
        worker('worker-new', '정신규'),
    ];
    const result = applyConstructionPlanOrganizationRefreshProjection({
        current: currentOrganization(),
        siteId: 'site-1',
        responsibleTeamId: 'team-1',
        latestWorkers: compatibleLatest,
        selection: {
            refreshAssignedWorkers: false,
            refreshAdditionalWorkers: true,
            reassignments: [],
        },
        actorId: 'author-1',
        capturedAt: refreshedAt,
        reason: '신규 작업자 명부 선택 반영',
        auditEventId: 'audit-organization-compatible',
    });
    const assignments = result.organizationSnapshot.assignments as UnknownRecord[];
    assert.equal(((assignments[0].worker as UnknownRecord).id), 'worker-manager');
    assert.equal(((assignments[1].worker as UnknownRecord).id), 'worker-inactive');
    assert.equal(((assignments[1].worker as UnknownRecord).status), 'active');
    const additional = result.organizationSnapshot.additionalWorkers as UnknownRecord[];
    assert.ok(additional.some((entry) => entry.id === 'worker-new'));
    assert.ok(!additional.some((entry) => entry.id === 'worker-inactive'));
    const provenance = result.organizationSnapshot.workerDirectoryProvenance as UnknownRecord;
    assert.equal(provenance.captureKind, 'refresh');
    assert.equal(provenance.appliedBy, 'author-1');
    assert.equal(provenance.changeReason, '신규 작업자 명부 선택 반영');
    assert.equal(provenance.auditEventId, 'audit-organization-compatible');
    const finalWorkers = [
        ...assignments.map((assignment) => assignment.worker),
        ...additional,
    ];
    const binding = buildConstructionPlanWorkerDirectoryBinding(finalWorkers);
    assert.deepEqual(provenance.sourceWorkerIds, binding.sourceWorkerIds);
    assert.equal(provenance.sourceMasterHash, binding.sourceMasterHash);
    assert.equal(
        canonicalStringify(binding.workers),
        canonicalStringify(buildConstructionPlanWorkerDirectoryBinding(compatibleLatest).workers),
    );
});

test('inactive or deleted role worker changes only through an explicit active-worker reassignment', () => {
    const result = applyConstructionPlanOrganizationRefreshProjection({
        current: currentOrganization(),
        siteId: 'site-1',
        latestWorkers: latestDirectory(),
        selection: {
            refreshAssignedWorkers: true,
            refreshAdditionalWorkers: true,
            reassignments: [{ assignmentId: 'assignment-safety', workerId: 'worker-new' }],
        },
        actorId: 'author-1',
        capturedAt: refreshedAt,
        reason: '비활성 안전담당자 명시 재배정',
        auditEventId: 'audit-organization-2',
    });
    const assignments = result.organizationSnapshot.assignments as UnknownRecord[];
    assert.equal(((assignments[1].worker as UnknownRecord).id), 'worker-new');
    assert.ok(result.appliedChangeIds.includes('organization.assignment.assignment-safety'));

    assert.throws(() => applyConstructionPlanOrganizationRefreshProjection({
        current: currentOrganization(),
        siteId: 'site-1',
        latestWorkers: latestDirectory(),
        selection: {
            refreshAssignedWorkers: false,
            refreshAdditionalWorkers: false,
            reassignments: [{ assignmentId: 'assignment-safety', workerId: 'worker-inactive' }],
        },
        actorId: 'author-1',
        capturedAt: refreshedAt,
        reason: '비활성 작업자로 잘못 재배정 시도',
        auditEventId: 'audit-organization-3',
    }));
});

test('assigned-worker refresh preserves each duplicate/external reason and never infers external for legacy workers', () => {
    const current = currentOrganization();
    const assignments = current.assignments as UnknownRecord[];
    const shared = worker('worker-shared', '김겸임', 'active', 'team-1', 'site-2');
    assignments[0].worker = shared;
    assignments[0].externalAssignment = true;
    assignments[0].exceptionReason = '현장책임자 역할 승인 겸임 사유';
    assignments[1].worker = shared;
    assignments[1].externalAssignment = true;
    assignments[1].exceptionReason = '안전담당 역할 승인 겸임 사유';

    const refreshedShared = { ...shared, position: '책임 작업자' };
    const result = applyConstructionPlanOrganizationRefreshProjection({
        current,
        siteId: 'site-1',
        responsibleTeamId: 'team-1',
        latestWorkers: [
            refreshedShared,
            worker('worker-old', '박작업'),
            worker('worker-moved', '최이동'),
        ],
        selection: {
            refreshAssignedWorkers: true,
            refreshAdditionalWorkers: false,
            reassignments: [],
        },
        actorId: 'author-1',
        capturedAt: refreshedAt,
        reason: '겸임 작업자 최신 프로필 선택 반영',
        auditEventId: 'audit-organization-reasons',
    });
    const refreshedAssignments = result.organizationSnapshot.assignments as UnknownRecord[];
    assert.deepEqual(refreshedAssignments.map((assignment) => assignment.exceptionReason), [
        '현장책임자 역할 승인 겸임 사유',
        '안전담당 역할 승인 겸임 사유',
    ]);
    assert.equal(refreshedAssignments.every((assignment) => assignment.externalAssignment === true), true);
    assert.equal(((refreshedAssignments[0].worker as UnknownRecord).position), '책임 작업자');

    const legacyComparison = compareConstructionPlanOrganizationRefresh({
        current: currentOrganization(),
        siteId: 'site-1',
        latestWorkers: latestDirectory(),
    });
    const legacyAssignments = legacyComparison.current.assignments as UnknownRecord[];
    assert.equal(legacyAssignments.every((assignment) => assignment.externalAssignment === false), true);
});

test('organization selection is exact, bounded, unique and cannot contain server-latest payloads', () => {
    assert.deepEqual(parseConstructionPlanOrganizationRefreshSelection({
        refreshAssignedWorkers: true,
        refreshAdditionalWorkers: false,
        reassignments: [{ assignmentId: 'assignment-safety', workerId: 'worker-new' }],
    }), {
        refreshAssignedWorkers: true,
        refreshAdditionalWorkers: false,
        reassignments: [{ assignmentId: 'assignment-safety', workerId: 'worker-new' }],
    });
    assert.throws(() => parseConstructionPlanOrganizationRefreshSelection({
        refreshAssignedWorkers: false,
        refreshAdditionalWorkers: false,
        reassignments: [],
    }));
    assert.throws(() => parseConstructionPlanOrganizationRefreshSelection({
        refreshAssignedWorkers: true,
        refreshAdditionalWorkers: false,
        reassignments: [],
        latestWorkers: latestDirectory(),
    }));
    assert.throws(() => parseConstructionPlanOrganizationRefreshSelection({
        refreshAssignedWorkers: false,
        refreshAdditionalWorkers: false,
        reassignments: [
            { assignmentId: 'assignment-safety', workerId: 'worker-new' },
            { assignmentId: 'assignment-safety', workerId: 'worker-manager' },
        ],
    }));
});
