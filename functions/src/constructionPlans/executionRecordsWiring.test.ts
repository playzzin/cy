import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
    cancelConstructionPlanRecordPhotoUploadServer,
    cleanupConstructionPlanRecordPhotoUploadsScheduled,
    confirmConstructionPlanRecordServer,
    createConstructionPlanRecordCorrectionServer,
    createConstructionPlanRecordServer,
    finalizeConstructionPlanRecordPhotoUploadServer,
    generateConstructionPlanRecordAppendixPdfServer,
    getConstructionPlanRecordServer,
    listConstructionPlanRecordsServer,
    startConstructionPlanRecordPhotoUploadServer,
    updateConstructionPlanRecordServer,
} from './index';
import { resolveDesignatedConfirmerFromCandidates } from './executionRecords';

const source = (name: string): string => readFileSync(join(__dirname, `../../src/constructionPlans/${name}`), 'utf8');

test('execution record callables are exported with bounded region/memory contracts', () => {
    const sixtySecond = [
        listConstructionPlanRecordsServer,
        getConstructionPlanRecordServer,
        createConstructionPlanRecordServer,
        updateConstructionPlanRecordServer,
        confirmConstructionPlanRecordServer,
        createConstructionPlanRecordCorrectionServer,
        startConstructionPlanRecordPhotoUploadServer,
        cancelConstructionPlanRecordPhotoUploadServer,
    ];
    sixtySecond.forEach((callable) => {
        const trigger = (callable as unknown as { __trigger: { timeout: string; regions: string[] } }).__trigger;
        assert.equal(trigger.timeout, '60s');
        assert.deepEqual(trigger.regions, ['asia-northeast3']);
    });
    [generateConstructionPlanRecordAppendixPdfServer, finalizeConstructionPlanRecordPhotoUploadServer]
        .forEach((callable) => {
            const trigger = (callable as unknown as { __trigger: { timeout: string; regions: string[] } }).__trigger;
            assert.equal(trigger.timeout, '300s');
            assert.deepEqual(trigger.regions, ['asia-northeast3']);
        });
    assert.ok(cleanupConstructionPlanRecordPhotoUploadsScheduled);
});

test('execution records remain separate server-owned documents with exact plan revalidation', () => {
    const core = source('executionRecords.ts');
    assert.match(core, /constructionPlanRecords/);
    assert.match(core, /assertPlanBindingUnchanged\(record, planId, plan, exported\)/);
    assert.match(core, /record\.status === 'confirmed'/);
    assert.match(core, /createConstructionPlanRecordCorrectionServer/);
    assert.doesNotMatch(core, /transaction\.(?:set|update)\(planRef/);
});

test('designated confirmer fails closed outside the issued-plan participant candidate set', () => {
    const candidates = [
        { uid: 'author-a', name: '김작성', role: 'author' },
        { uid: 'reviewer-a', name: '박검토', role: 'reviewer' },
    ];
    assert.deepEqual(resolveDesignatedConfirmerFromCandidates('reviewer-a', candidates), {
        uid: 'reviewer-a', name: '박검토',
    });
    assert.deepEqual(resolveDesignatedConfirmerFromCandidates(undefined, candidates), {});
    assert.throws(
        () => resolveDesignatedConfirmerFromCandidates('outsider-a', candidates),
        (error: unknown) => Boolean(error && typeof error === 'object'
            && (error as { code?: string }).code === 'invalid-argument'),
    );
    const core = source('executionRecords.ts');
    assert.equal(
        (core.match(/resolveDesignatedConfirmerFromCandidates\(parsed\.designatedConfirmerId,/g) || []).length,
        2,
        'create and update must both resolve only server-owned candidates',
    );
    assert.match(core, /planParticipants\(plan, 'authorIds'\)/);
    assert.match(core, /planParticipants\(plan, 'reviewerIds'\)/);
    assert.match(core, /planParticipants\(plan, 'approverIds'\)/);
});

test('photo upload enforces staging, magic/SHA/generation, create-only copy and cleanup', () => {
    const upload = source('executionRecordPhotoUpload.ts');
    assert.match(upload, /construction-plan-record-staging/);
    assert.match(upload, /detectExecutionRecordPhotoMimeType/);
    assert.match(upload, /ifGenerationMatch: 0/);
    assert.match(upload, /storageGeneration: copied\.generation/);
    assert.match(upload, /cleanupExpiredExecutionRecordPhotoUploads/);
    assert.match(upload, /status: 'cancelled'/);
});

test('rules explicitly protect all execution-record namespaces', () => {
    const firestoreRules = readFileSync(join(__dirname, '../../../firestore.rules'), 'utf8');
    const storageRules = readFileSync(join(__dirname, '../../../storage.rules'), 'utf8');
    ['constructionPlanRecords', 'constructionPlanRecordExports', 'constructionPlanRecordUploadSessions']
        .forEach((collection) => assert.match(firestoreRules, new RegExp(collection)));
    assert.match(storageRules, /construction-plan-record-staging/);
    assert.match(storageRules, /canCreateConstructionPlanRecordStagingSource/);
    assert.match(storageRules, /canAccessConstructionPlanRecordPath/);
    assert.match(storageRules, /construction-plan-records\/\{siteId\}\/\{planId\}\/\{recordId\}/);
});
