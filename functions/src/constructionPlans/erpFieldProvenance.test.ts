import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
    buildInitialConstructionPlanErpFieldProvenance,
    buildConstructionPlanErpSourceMasterHash,
    sanitizeConstructionPlanErpFieldProvenance,
} from './erpFieldProvenance';

const capturedAt = '2026-08-22T00:00:00.000Z';
const sourceMasterHash = 'a'.repeat(64);
const initial = { captureKind: 'initial' as const, sourceMasterHash };
const mixedSnapshot = () => ({
    site: {
        source: 'site',
        sourceId: 'site-1',
        capturedAt,
        overridden: true,
        value: { id: 'site-1', name: '현장', address: '서울 강남구' },
    },
});

test('mixed ERP sources require exact provenance for every refreshable value', () => {
    assert.deepEqual(sanitizeConstructionPlanErpFieldProvenance({
        'site.name': { source: 'site', sourceId: 'site-1', capturedAt, ...initial },
        'site.address': { source: 'site', sourceId: 'site-1', capturedAt, ...initial },
    }, mixedSnapshot()), {
        'site.name': { source: 'site', sourceId: 'site-1', capturedAt, ...initial },
        'site.address': { source: 'site', sourceId: 'site-1', capturedAt, ...initial },
    });
    assert.throws(() => sanitizeConstructionPlanErpFieldProvenance({
        'site.address': { source: 'site', sourceId: 'site-1', capturedAt, ...initial },
    }, mixedSnapshot()));
    assert.throws(() => sanitizeConstructionPlanErpFieldProvenance(undefined, mixedSnapshot()));
});

test('provenance rejects wrong sources, unrelated source IDs, unknown fields, and extra keys', () => {
    const valid = { 'site.name': { source: 'site', sourceId: 'site-1', capturedAt, ...initial } };
    assert.throws(() => sanitizeConstructionPlanErpFieldProvenance({
        ...valid,
        'site.address': { source: 'company', sourceId: 'site-1', capturedAt, ...initial },
    }, mixedSnapshot()));
    assert.throws(() => sanitizeConstructionPlanErpFieldProvenance({
        ...valid,
        'site.address': { source: 'site', sourceId: 'site-2', capturedAt, ...initial },
    }, mixedSnapshot()));
    assert.throws(() => sanitizeConstructionPlanErpFieldProvenance({
        ...valid,
        'site.email': { source: 'site', sourceId: 'site-1', capturedAt, ...initial },
    }, mixedSnapshot()));
    assert.throws(() => sanitizeConstructionPlanErpFieldProvenance({
        ...valid,
        'site.address': { source: 'site', sourceId: 'site-1', capturedAt, ...initial, forged: true },
    }, mixedSnapshot()));
});

test('refresh provenance requires reason, actor, apply time, and immutable audit id', () => {
    const refresh = {
        source: 'site', sourceId: 'site-1', capturedAt,
        captureKind: 'refresh', sourceMasterHash,
        appliedBy: 'author-1', appliedAt: capturedAt,
        changeReason: '현장 주소 원천 변경 반영', auditEventId: 'audit-1',
    };
    assert.doesNotThrow(() => sanitizeConstructionPlanErpFieldProvenance({
        'site.name': refresh,
        'site.address': refresh,
    }, mixedSnapshot()));
    assert.throws(() => sanitizeConstructionPlanErpFieldProvenance({
        'site.name': { ...refresh, changeReason: undefined },
        'site.address': refresh,
    }, mixedSnapshot()));
    assert.throws(() => sanitizeConstructionPlanErpFieldProvenance({
        'site.name': { ...refresh, captureKind: 'initial' },
        'site.address': refresh,
    }, mixedSnapshot()));
});

test('safe master hashes are stable across object key order and exclude capture metadata', () => {
    const left = { source: 'site', sourceId: 'site-1', capturedAt, value: { id: 'site-1', name: '현장' } };
    const right = { capturedAt: '2027-01-01T00:00:00.000Z', sourceId: 'site-1', source: 'site', value: { name: '현장', id: 'site-1' } };
    assert.equal(buildConstructionPlanErpSourceMasterHash(left), buildConstructionPlanErpSourceMasterHash(right));
    assert.notEqual(
        buildConstructionPlanErpSourceMasterHash(left),
        buildConstructionPlanErpSourceMasterHash({ ...left, value: { id: 'site-1', name: '변경 현장' } }),
    );
});

test('initial capture records immutable source evidence without pretending a user-applied change', () => {
    const sourceUpdatedAt = '2026-08-21T06:00:00.000Z';
    const snapshot = {
        site: {
            source: 'site',
            sourceId: 'site-1',
            sourceUpdatedAt,
            capturedAt,
            overridden: false,
            value: { id: 'site-1', name: '현장', address: '서울 강남구' },
        },
    };

    const provenance = buildInitialConstructionPlanErpFieldProvenance(snapshot);
    assert.deepEqual(Object.keys(provenance).sort(), ['site.address', 'site.name']);
    Object.values(provenance).forEach((entry) => {
        assert.equal(entry.captureKind, 'initial');
        assert.equal(entry.source, 'site');
        assert.equal(entry.sourceId, 'site-1');
        assert.equal(entry.sourceUpdatedAt, sourceUpdatedAt);
        assert.equal(entry.capturedAt, capturedAt);
        assert.match(entry.sourceMasterHash, /^[a-f0-9]{64}$/);
        assert.equal(entry.appliedBy, undefined);
        assert.equal(entry.appliedAt, undefined);
        assert.equal(entry.changeReason, undefined);
        assert.equal(entry.auditEventId, undefined);
    });
});
