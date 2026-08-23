import { strict as assert } from 'assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
    CONSTRUCTION_PLAN_TEMPLATE_LIFECYCLES,
    assertPublishedConstructionPlanTemplateSnapshotForNewDraft,
    constructionPlanTemplateDocumentId,
    constructionPlanTemplateManifestHash,
    constructionPlanTemplatePublishedFingerprint,
    getKnownConstructionPlanTemplateDefinitions,
    initializeConstructionPlanTemplateServer,
    isConstructionPlanTemplateTransitionAllowed,
    listConstructionPlanTemplatesServer,
    selectLatestPublishedConstructionPlanTemplateKey,
    transitionConstructionPlanTemplateLifecycleServer,
} from './templateLifecycle';
import {
    initializeConstructionPlanTemplateServer as indexedInitialize,
    listConstructionPlanTemplatesServer as indexedList,
    transitionConstructionPlanTemplateLifecycleServer as indexedTransition,
} from './index';
import {
    SYSTEM_SCAFFOLD_SERVER_TEMPLATE,
    SYSTEM_SHORING_SERVER_TEMPLATE,
} from './templateContracts';

const callablesSource = readFileSync(
    join(__dirname, '../../src/constructionPlans/callables.ts'),
    'utf8',
);
const constructionPlanIndexSource = readFileSync(
    join(__dirname, '../../src/constructionPlans/index.ts'),
    'utf8',
);
const rootIndexSource = readFileSync(join(__dirname, '../../src/index.ts'), 'utf8');

describe('construction plan template lifecycle contract', () => {
    it('exposes only exact code-registered shoring and scaffold identities', () => {
        const bundleHash = 'b'.repeat(64);
        const templates = getKnownConstructionPlanTemplateDefinitions(bundleHash);

        assert.deepEqual(templates.map((template) => template.key), [
            'system-shoring:system-shoring-standard@1.0.0',
            'system-scaffold:system-scaffold-standard@1.0.0',
        ]);
        assert.deepEqual(templates.map((template) => template.pageCount), [42, 42]);
        assert.ok(templates.every((template) => template.templateBundleHash === bundleHash));
        assert.ok(templates.every((template) => /^[a-f0-9]{64}$/.test(template.manifestHash)));
        assert.notEqual(templates[0].manifestHash, templates[1].manifestHash);
        assert.ok(templates.every((template) => /^tpl_[a-f0-9]{40}$/.test(template.id)));
    });

    it('hashes the immutable server manifest deterministically', () => {
        assert.equal(
            constructionPlanTemplateManifestHash(SYSTEM_SHORING_SERVER_TEMPLATE),
            constructionPlanTemplateManifestHash(SYSTEM_SHORING_SERVER_TEMPLATE),
        );
        assert.notEqual(
            constructionPlanTemplateManifestHash(SYSTEM_SHORING_SERVER_TEMPLATE),
            constructionPlanTemplateManifestHash(SYSTEM_SCAFFOLD_SERVER_TEMPLATE),
        );
        const changedRiskPolicy = JSON.parse(JSON.stringify(SYSTEM_SHORING_SERVER_TEMPLATE));
        changedRiskPolicy.riskAssessmentPolicy.acceptance.maxResidualScore = 8;
        assert.notEqual(
            constructionPlanTemplateManifestHash(SYSTEM_SHORING_SERVER_TEMPLATE),
            constructionPlanTemplateManifestHash(changedRiskPolicy),
        );
        assert.equal(
            constructionPlanTemplateDocumentId({
                tradeType: 'system-shoring',
                templateId: 'system-shoring-standard',
                templateVersion: '1.0.0',
            }),
            constructionPlanTemplateDocumentId({
                tradeType: 'system-shoring',
                templateId: 'system-shoring-standard',
                templateVersion: '1.0.0',
            }),
        );
    });

    it('allows the controlled author-review-publish-retire workflow only', () => {
        assert.deepEqual(CONSTRUCTION_PLAN_TEMPLATE_LIFECYCLES, [
            'draft', 'in_review', 'published', 'retired',
        ]);
        assert.equal(isConstructionPlanTemplateTransitionAllowed('draft', 'in_review'), true);
        assert.equal(isConstructionPlanTemplateTransitionAllowed('in_review', 'draft'), true);
        assert.equal(isConstructionPlanTemplateTransitionAllowed('in_review', 'published'), true);
        assert.equal(isConstructionPlanTemplateTransitionAllowed('published', 'retired'), true);
        assert.equal(isConstructionPlanTemplateTransitionAllowed('draft', 'published'), false);
        assert.equal(isConstructionPlanTemplateTransitionAllowed('published', 'draft'), false);
        assert.equal(isConstructionPlanTemplateTransitionAllowed('retired', 'published'), false);
    });

    it('promotes the highest remaining published version after latest retirement', () => {
        assert.equal(selectLatestPublishedConstructionPlanTemplateKey([
            { key: 'v1', templateVersion: '1.0.0', lifecycle: 'published' },
            { key: 'v10', templateVersion: '1.10.0', lifecycle: 'published' },
            { key: 'v2', templateVersion: '1.2.0', lifecycle: 'published' },
            { key: 'retired', templateVersion: '2.0.0', lifecycle: 'retired' },
        ]), 'v10');
        assert.equal(selectLatestPublishedConstructionPlanTemplateKey([
            { key: 'retired', templateVersion: '2.0.0', lifecycle: 'retired' },
        ]), undefined);
    });

    it('makes the transaction snapshot decision fail closed on retirement or hash drift', () => {
        const definition = getKnownConstructionPlanTemplateDefinitions()
            .find((template) => template.tradeType === 'system-shoring');
        assert.ok(definition);
        const identity = {
            tradeType: definition.tradeType,
            templateId: definition.templateId,
            templateVersion: definition.templateVersion,
        };
        const timestamp = '2026-08-22T00:00:00.000Z';
        const published = {
            schemaVersion: 1,
            id: definition.id,
            key: definition.key,
            name: definition.name,
            tradeType: definition.tradeType,
            templateId: definition.templateId,
            templateVersion: definition.templateVersion,
            rendererVersion: definition.rendererVersion,
            pageCount: definition.pageCount,
            manifest: definition.manifest,
            manifestHash: definition.manifestHash,
            templateBundleHash: definition.templateBundleHash,
            lifecycle: 'published',
            lifecycleVersion: 3,
            isLatest: true,
            publishedFingerprint: constructionPlanTemplatePublishedFingerprint(definition),
            createdAt: timestamp,
            createdBy: 'template-author',
            updatedAt: timestamp,
            updatedBy: 'template-publisher',
            publishedAt: timestamp,
            publishedBy: 'template-publisher',
            publishedReason: '표준 검토 완료 후 게시',
            lastTransitionReason: '표준 검토 완료 후 게시',
        };

        assert.equal(
            assertPublishedConstructionPlanTemplateSnapshotForNewDraft(identity, published).key,
            definition.key,
        );
        assert.throws(
            () => assertPublishedConstructionPlanTemplateSnapshotForNewDraft(identity, {
                ...published,
                lifecycle: 'retired',
                lifecycleVersion: 4,
                isLatest: false,
                retiredAt: timestamp,
                retiredBy: 'template-admin',
                retiredReason: '신규 버전 게시',
            }),
            /폐기된 표준 템플릿/,
        );
        assert.throws(
            () => assertPublishedConstructionPlanTemplateSnapshotForNewDraft(identity, {
                ...published,
                manifestHash: 'f'.repeat(64),
            }),
            /서버 계약과 일치하지 않습니다/,
        );
    });

    it('exports all lifecycle callables and guards only the new-draft path', () => {
        assert.equal(indexedList, listConstructionPlanTemplatesServer);
        assert.equal(indexedInitialize, initializeConstructionPlanTemplateServer);
        assert.equal(indexedTransition, transitionConstructionPlanTemplateLifecycleServer);
        [
            listConstructionPlanTemplatesServer,
            initializeConstructionPlanTemplateServer,
            transitionConstructionPlanTemplateLifecycleServer,
        ].forEach((callable) => {
            const trigger = (callable as unknown as {
                __trigger: { timeout: string; availableMemoryMb: number; regions: string[] };
            }).__trigger;
            assert.equal(trigger.timeout, '60s');
            assert.equal(trigger.availableMemoryMb, 512);
            assert.deepEqual(trigger.regions, ['asia-northeast3']);
        });
        assert.match(constructionPlanIndexSource, /listConstructionPlanTemplatesServer/);
        assert.match(rootIndexSource, /listConstructionPlanTemplatesServer/);

        const internalDraftStart = callablesSource.indexOf('const createConstructionPlanDraft =');
        const internalRevisionStart = callablesSource.indexOf('const createConstructionPlanRevision =');
        assert.ok(internalDraftStart >= 0 && internalRevisionStart > internalDraftStart);
        const internalDraftBlock = callablesSource.slice(internalDraftStart, internalRevisionStart);
        assert.match(internalDraftBlock, /transaction\.get\(templateRef\)/);
        assert.match(internalDraftBlock, /assertPublishedConstructionPlanTemplateSnapshotForNewDraft\(/);
        assert.ok(
            internalDraftBlock.indexOf('if (idempotent) return idempotent')
                < internalDraftBlock.indexOf('assertPublishedConstructionPlanTemplateSnapshotForNewDraft('),
        );

        const draftStart = callablesSource.indexOf('export const createConstructionPlanDraftServer');
        const revisionStart = callablesSource.indexOf('export const createConstructionPlanRevisionServer');
        assert.ok(draftStart >= 0 && revisionStart > draftStart);
        const draftBlock = callablesSource.slice(draftStart, revisionStart);
        assert.match(draftBlock, /parseCreateDraftRequest\(data\)/);
        assert.match(draftBlock, /resolveCallableActor\(context\)/);
        assert.ok(
            draftBlock.indexOf('parseCreateDraftRequest(data)')
                < draftBlock.indexOf('resolveCallableActor(context)'),
        );

        const revisionBlock = callablesSource.slice(
            revisionStart,
            callablesSource.indexOf('export const cloneConstructionPlanServer', revisionStart),
        );
        assert.doesNotMatch(revisionBlock, /assertPublishedConstructionPlanTemplateSnapshotForNewDraft/);
    });
});
