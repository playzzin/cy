import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
    PDF_RENDER_STALE_AFTER_MS,
    PDF_VISUAL_CHECK_OVERDUE_AFTER_MS,
    buildConstructionPlanPdfRenderStartRecord,
    classifyConstructionPlanPdfRenderFailure,
    isConstructionPlanPdfRenderStale,
    isConstructionPlanPdfVisualCheckOverdue,
    monitorConstructionPlanPdfRenderOperationsScheduled,
} from './pdfRenderMonitoring';

const HASH = 'a'.repeat(64);
const NOW = Date.parse('2026-08-22T04:00:00.000Z');
process.env.GCLOUD_PROJECT ||= 'construction-plan-monitor-test';

test('classifies OOM, timeout and integrity failures for operational alerts', () => {
    assert.equal(classifyConstructionPlanPdfRenderFailure(new Error('JavaScript heap out of memory')), 'OOM');
    assert.equal(classifyConstructionPlanPdfRenderFailure({ code: 'deadline-exceeded', message: 'timeout' }), 'TIMEOUT');
    assert.equal(classifyConstructionPlanPdfRenderFailure({ code: 'data-loss', message: 'SHA-256 mismatch' }), 'DATA_LOSS');
    assert.equal(classifyConstructionPlanPdfRenderFailure(new Error('invalid source drawing')), 'RENDER_ERROR');
});

test('uses strict stale-render and visual-check overdue boundaries', () => {
    assert.equal(isConstructionPlanPdfRenderStale(NOW - PDF_RENDER_STALE_AFTER_MS, NOW), true);
    assert.equal(isConstructionPlanPdfRenderStale(NOW - PDF_RENDER_STALE_AFTER_MS + 1, NOW), false);
    assert.equal(isConstructionPlanPdfRenderStale('not-a-number', NOW), false);

    const overdueAt = new Date(NOW - PDF_VISUAL_CHECK_OVERDUE_AFTER_MS).toISOString();
    const freshAt = new Date(NOW - PDF_VISUAL_CHECK_OVERDUE_AFTER_MS + 1).toISOString();
    assert.equal(isConstructionPlanPdfVisualCheckOverdue(overdueAt, NOW), true);
    assert.equal(isConstructionPlanPdfVisualCheckOverdue(freshAt, NOW), false);
    assert.equal(isConstructionPlanPdfVisualCheckOverdue('invalid', NOW), false);
});

test('builds a bounded server-owned render heartbeat record without document content', () => {
    const record = buildConstructionPlanPdfRenderStartRecord({
        planId: 'plan-1',
        approvedSnapshotHash: HASH,
        templateBindingHash: 'b'.repeat(64),
        drawingBindingHash: 'c'.repeat(64),
        rendererVersion: 'server-field-use-v2',
        profile: 'candidate',
        actorId: 'approver-1',
    }, 'operation-1', NOW);

    assert.deepEqual(record, {
        id: 'operation-1',
        schemaVersion: 1,
        authority: 'server',
        status: 'RUNNING',
        phase: 'RENDERING',
        planId: 'plan-1',
        approvedSnapshotHash: HASH,
        templateBindingHash: 'b'.repeat(64),
        drawingBindingHash: 'c'.repeat(64),
        rendererVersion: 'server-field-use-v2',
        profile: 'candidate',
        actorId: 'approver-1',
        startedAt: '2026-08-22T04:00:00.000Z',
        heartbeatAt: '2026-08-22T04:00:00.000Z',
        heartbeatAtEpochMs: NOW,
        expectedDeadlineAt: new Date(NOW + PDF_RENDER_STALE_AFTER_MS).toISOString(),
        createdAt: '2026-08-22T04:00:00.000Z',
        updatedAt: '2026-08-22T04:00:00.000Z',
    });
    assert.equal('snapshotContent' in record, false);
    assert.equal('drawingBytes' in record, false);
});

test('exports a five-minute scheduled render watchdog', () => {
    const trigger = (monitorConstructionPlanPdfRenderOperationsScheduled as unknown as {
        __trigger: { schedule: { schedule: string; timeZone: string }; regions: string[]; timeout: string };
    }).__trigger;
    assert.deepEqual(trigger.schedule, { schedule: 'every 5 minutes', timeZone: 'Asia/Seoul' });
    assert.deepEqual(trigger.regions, ['asia-northeast3']);
    assert.equal(trigger.timeout, '300s');
});

test('wraps both candidate and issued renders and exports the watchdog entrypoint', () => {
    const callables = readFileSync(join(__dirname, '../../src/constructionPlans/callables.ts'), 'utf8');
    const constructionPlanIndex = readFileSync(join(__dirname, '../../src/constructionPlans/index.ts'), 'utf8');
    const rootIndex = readFileSync(join(__dirname, '../../src/index.ts'), 'utf8');
    assert.equal((callables.match(/runMonitoredConstructionPlanPdfRender\(\{/g) || []).length, 2);
    assert.match(callables, /profile: 'candidate'/);
    assert.match(callables, /profile: 'issued'/);
    assert.match(constructionPlanIndex, /monitorConstructionPlanPdfRenderOperationsScheduled/);
    assert.match(rootIndex, /monitorConstructionPlanPdfRenderOperationsScheduled/);
});
