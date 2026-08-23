import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { buildConstructionPlanFieldUseLeafLedger } from './fieldUsePdfRenderer';

test('ERP and worker source provenance remains hash-covered audit evidence, never visible PDF body data', () => {
    const coverage = new Map([
        [6, [{
            path: 'erpSnapshot',
            value: {
                fieldProvenance: {
                    'site.address': {
                        source: 'site',
                        sourceId: 'site-1',
                        capturedAt: '2026-08-22T00:00:00.000Z',
                        captureKind: 'refresh',
                        sourceMasterHash: 'a'.repeat(64),
                        appliedBy: 'author-1',
                        appliedAt: '2026-08-22T00:00:00.000Z',
                        changeReason: '현장 주소 원천 변경 반영',
                        auditEventId: 'audit-erp-1',
                    },
                },
            },
            valueHash: 'unused-parent-hash',
        }]],
        [7, [{
            path: 'organizationSnapshot',
            value: {
                workerDirectoryProvenance: {
                    captureKind: 'refresh',
                    sourceSiteId: 'site-1',
                    capturedAt: '2026-08-22T00:00:00.000Z',
                    sourceMasterHash: 'b'.repeat(64),
                    sourceWorkerIds: ['worker-1'],
                    appliedBy: 'author-1',
                    appliedAt: '2026-08-22T00:00:00.000Z',
                    changeReason: '작업자 명부 원천 변경 반영',
                    auditEventId: 'audit-worker-1',
                },
            },
            valueHash: 'unused-parent-hash',
        }]],
    ]);

    const ledger = buildConstructionPlanFieldUseLeafLedger(coverage);
    assert.ok(ledger.length > 0);
    assert.ok(ledger.some((entry) => entry.path.endsWith('.changeReason')));
    assert.ok(ledger.some((entry) => entry.path.endsWith('.auditEventId')));
    assert.equal(ledger.every((entry) => entry.disposition === 'audit'), true);
    assert.equal(ledger.some((entry) => entry.disposition === 'visible'), false);
    assert.equal(ledger.every((entry) => /^[a-f0-9]{64}$/.test(entry.valueHash)), true);
});
