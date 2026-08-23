import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    buildConstructionPlanTemplateBinding,
    constructionPlanTemplateBindingProjection,
    constructionPlanTemplateBindingHash,
    parseConstructionPlanTemplateBinding,
    assertConstructionPlanTemplateBindingMatchesRecord,
    assertConstructionPlanTemplateBindingMatchesPlanIdentity,
    assertConstructionPlanTemplateUpgradeTarget,
    assertSameConstructionPlanTemplateBinding,
} from './templateBinding';
import {
    constructionPlanTemplatePublishedFingerprint,
    getKnownConstructionPlanTemplateDefinitions,
    type ConstructionPlanTemplateLifecycleRecord,
} from './templateLifecycle';

const lifecycleRecord = (): ConstructionPlanTemplateLifecycleRecord => {
    const definition = getKnownConstructionPlanTemplateDefinitions()[0];
    const base = {
        schemaVersion: 1 as const,
        ...definition,
        lifecycle: 'published' as const,
        lifecycleVersion: 4,
        isLatest: true,
        createdAt: '2026-08-20T00:00:00.000Z',
        createdBy: 'template-admin',
        updatedAt: '2026-08-21T00:00:00.000Z',
        updatedBy: 'template-admin',
        publishedAt: '2026-08-21T00:00:00.000Z',
        publishedBy: 'template-admin',
        publishedReason: '현장 적용 승인',
        lastTransitionReason: '현장 적용 승인',
    };
    return {
        ...base,
        publishedFingerprint: constructionPlanTemplatePublishedFingerprint(base),
    };
};

describe('construction plan immutable template binding', () => {
    it('captures the exact published manifest, bundle and fingerprint', () => {
        const record = lifecycleRecord();
        const binding = buildConstructionPlanTemplateBinding(record, '2026-08-22T01:02:03.000Z');
        assert.equal(binding.templateHash, record.publishedFingerprint);
        assert.equal(binding.manifestHash, record.manifestHash);
        assert.equal(binding.templateBundleHash, record.templateBundleHash);
        assert.match(constructionPlanTemplateBindingHash(binding), /^[a-f0-9]{64}$/);
        assert.deepEqual(constructionPlanTemplateBindingProjection(binding), {
            templateHash: binding.templateHash,
            manifestHash: binding.manifestHash,
            templateBundleHash: binding.templateBundleHash,
            templateBindingHash: constructionPlanTemplateBindingHash(binding),
        });
        assert.deepEqual(parseConstructionPlanTemplateBinding(binding), binding);
        assert.deepEqual(assertConstructionPlanTemplateBindingMatchesPlanIdentity(binding, {
            tradeType: binding.tradeType,
            templateId: binding.templateId,
            templateVersion: binding.templateVersion,
            rendererVersion: binding.rendererVersion,
        }), binding);
        assert.deepEqual(assertSameConstructionPlanTemplateBinding(binding, { ...binding }), binding);
    });

    it('allows an existing plan to reproduce a retired immutable template', () => {
        const published = lifecycleRecord();
        const binding = buildConstructionPlanTemplateBinding(published, '2026-08-22T01:02:03.000Z');
        const retired: ConstructionPlanTemplateLifecycleRecord = {
            ...published,
            lifecycle: 'retired',
            lifecycleVersion: 5,
            isLatest: false,
            updatedAt: '2026-08-22T02:00:00.000Z',
            retiredAt: '2026-08-22T02:00:00.000Z',
            retiredBy: 'template-admin',
            retiredReason: '신규 버전 게시',
            lastTransitionReason: '신규 버전 게시',
        };
        assert.deepEqual(assertConstructionPlanTemplateBindingMatchesRecord(binding, retired), binding);
    });

    it('fails closed when a bundle or published fingerprint drifts under the same identity', () => {
        const record = lifecycleRecord();
        const binding = buildConstructionPlanTemplateBinding(record, '2026-08-22T01:02:03.000Z');
        assert.throws(() => parseConstructionPlanTemplateBinding({
            ...binding,
            templateBundleHash: 'f'.repeat(64),
            unexpected: true,
        }));
        assert.throws(() => assertConstructionPlanTemplateBindingMatchesRecord(binding, {
            ...record,
            templateBundleHash: 'e'.repeat(64),
        }));
        assert.throws(() => assertConstructionPlanTemplateBindingMatchesPlanIdentity(binding, {
            tradeType: binding.tradeType,
            templateId: binding.templateId,
            templateVersion: binding.templateVersion,
            rendererVersion: 'drifted-renderer',
        }));
        assert.throws(() => assertSameConstructionPlanTemplateBinding(binding, {
            ...binding,
            capturedAt: '2026-08-22T01:02:04.000Z',
        }));
        assert.throws(() => assertConstructionPlanTemplateUpgradeTarget(binding, record));
    });
});
