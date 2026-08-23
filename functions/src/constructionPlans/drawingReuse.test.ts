import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    assertConstructionPlanDrawingReuseJobReady,
    buildConstructionPlanDrawingReuseIdentity,
    completedConstructionPlanDrawingReuseJobPatch,
} from './drawingReuse';

const SHA = 'a'.repeat(64);

describe('construction plan drawing reuse idempotency contract', () => {
    it('derives one private job and target plan id from the actor, operation and retry key', () => {
        const input = { actorId: 'actor-1', operation: 'revision' as const, idempotencyKey: 'raw-secret-retry-key' };
        const first = buildConstructionPlanDrawingReuseIdentity(input);
        const retry = buildConstructionPlanDrawingReuseIdentity(input);
        const changedOperation = buildConstructionPlanDrawingReuseIdentity({ ...input, operation: 'clone' });
        const changedActor = buildConstructionPlanDrawingReuseIdentity({ ...input, actorId: 'actor-2' });

        assert.deepEqual(retry, first);
        assert.notEqual(changedOperation.jobId, first.jobId);
        assert.notEqual(changedActor.targetPlanId, first.targetPlanId);
        assert.match(first.jobId, /^cpdrj-[a-f0-9]{48}$/);
        assert.match(first.targetPlanId, /^cpdr-[a-f0-9]{48}$/);
        assert.equal(JSON.stringify(first).includes(input.idempotencyKey), false);
    });

    it('accepts only the same request/source fingerprints and ready immutable bindings', () => {
        const identity = buildConstructionPlanDrawingReuseIdentity({
            actorId: 'actor-1',
            operation: 'revision',
            idempotencyKey: 'retry-1',
        });
        const job = {
            schemaVersion: 1,
            id: identity.jobId,
            ownerId: 'actor-1',
            operation: 'revision',
            requestFingerprint: SHA,
            sourcePlanFingerprint: 'b'.repeat(64),
            targetPlanId: identity.targetPlanId,
            status: 'ready',
            bindings: [{ targetGeneration: '9001' }],
        };
        const expected = {
            value: job,
            jobId: identity.jobId,
            actorId: 'actor-1',
            operation: 'revision' as const,
            requestFingerprint: SHA,
            sourcePlanFingerprint: 'b'.repeat(64),
            targetPlanId: identity.targetPlanId,
        };

        assert.doesNotThrow(() => assertConstructionPlanDrawingReuseJobReady(expected));
        assert.throws(
            () => assertConstructionPlanDrawingReuseJobReady({
                ...expected,
                requestFingerprint: 'c'.repeat(64),
            }),
            /도면 재사용 작업이 완료되지 않았거나 요청 바인딩이 일치하지 않습니다/,
        );
        assert.throws(
            () => assertConstructionPlanDrawingReuseJobReady({
                ...expected,
                value: { ...job, status: 'failed' },
            }),
            /도면 재사용 작업이 완료되지 않았거나 요청 바인딩이 일치하지 않습니다/,
        );
    });

    it('stores a durable response and a bounded cleanup horizon on completion', () => {
        const timestamp = '2026-08-22T00:00:00.000Z';
        const patch = completedConstructionPlanDrawingReuseJobPatch({ planId: 'plan-1' }, timestamp);
        assert.equal(patch.status, 'completed');
        assert.deepEqual(patch.result, { planId: 'plan-1' });
        assert.equal(patch.completedAt, timestamp);
        assert.equal(
            patch.cleanupAfterEpochMs,
            Date.parse(timestamp) + 30 * 24 * 60 * 60 * 1_000,
        );
    });
});
