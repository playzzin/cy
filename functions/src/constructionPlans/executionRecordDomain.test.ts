import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
    CONSTRUCTION_PLAN_RECORD_TYPES,
    constructionPlanRecordConfirmationHash,
    deriveConstructionPlanRecordDraftStatus,
    getConstructionPlanRecordCatalog,
    normalizeConstructionPlanRecordResponses,
    validateConstructionPlanRecordForConfirmation,
} from './executionRecordDomain';

const completeRecord = (recordType: typeof CONSTRUCTION_PLAN_RECORD_TYPES[number] = 'installation_inspection') => {
    const catalog = getConstructionPlanRecordCatalog('system-shoring', recordType);
    return {
        schemaVersion: 1,
        id: 'record-a',
        rootRecordId: 'record-a',
        recordRevision: 0,
        planBinding: {
            planId: 'plan-a', siteId: 'site-a', seriesId: 'series-a', revision: 2,
            issuedExportId: 'export-a', issuedExportSha256: 'a'.repeat(64),
            tradeType: 'system-shoring', templateId: 'system-shoring-standard', templateVersion: '1.0.0',
        },
        recordType,
        catalogVersion: catalog.version,
        catalogHash: catalog.hash,
        workDate: '2026-08-22',
        building: '101동',
        floor: '3층',
        zone: 'A구간',
        actualWorkers: [{ workerId: 'worker-a', name: '김작업', role: '팀장' }],
        actualEquipment: recordType === 'equipment_daily_inspection' ? [{ name: '지게차' }] : [],
        responses: catalog.questions.map((question) => ({ questionId: question.id, result: 'pass' })),
        photos: recordType === 'photo_sheet' ? [{ id: 'photo-a' }] : [],
        designatedConfirmerId: 'reviewer-a',
        createdBy: 'author-a',
        createdAt: '2026-08-22T00:00:00.000Z',
    };
};

describe('construction plan execution record domain', () => {
    it('serves all eight real server-owned record catalogs for both trades', () => {
        assert.equal(CONSTRUCTION_PLAN_RECORD_TYPES.length, 8);
        for (const trade of ['system-shoring', 'system-scaffold'] as const) {
            for (const recordType of CONSTRUCTION_PLAN_RECORD_TYPES) {
                const catalog = getConstructionPlanRecordCatalog(trade, recordType);
                assert.ok(catalog.questions.length >= 3, `${trade}/${recordType}`);
                assert.match(catalog.hash, /^[a-f0-9]{64}$/);
                assert.ok(catalog.questions.every((question) => question.required));
            }
        }
        assert.notEqual(
            getConstructionPlanRecordCatalog('system-shoring', 'installation_inspection').hash,
            getConstructionPlanRecordCatalog('system-scaffold', 'installation_inspection').hash,
        );
    });

    it('rejects client-authored, duplicate, or malformed checklist fields', () => {
        const catalog = getConstructionPlanRecordCatalog('system-shoring', 'daily_safety_log');
        assert.throws(() => normalizeConstructionPlanRecordResponses([{
            questionId: catalog.questions[0].id,
            result: 'pass',
            clientQuestion: '임의 문항',
        }], catalog), /response-invalid/);
        assert.throws(() => normalizeConstructionPlanRecordResponses([
            { questionId: catalog.questions[0].id, result: 'pass' },
            { questionId: catalog.questions[0].id, result: 'fail' },
        ], catalog), /question-invalid/);
    });

    it('fails confirmation closed until every server question has a verdict', () => {
        const record = completeRecord();
        record.responses.pop();
        const catalog = getConstructionPlanRecordCatalog('system-shoring', 'installation_inspection');
        assert.ok(validateConstructionPlanRecordForConfirmation(record, catalog)
            .some((issue) => issue.code === 'response.required'));
    });

    it('requires an NA reason and a complete fail action owner/due contract', () => {
        const record = completeRecord();
        const catalog = getConstructionPlanRecordCatalog('system-shoring', 'installation_inspection');
        const naQuestion = catalog.questions.find((question) => question.allowNotApplicable);
        assert.ok(naQuestion);
        record.responses = record.responses.map((response) => response.questionId === naQuestion?.id
            ? { questionId: response.questionId, result: 'not_applicable' }
            : response);
        assert.ok(validateConstructionPlanRecordForConfirmation(record, catalog)
            .some((issue) => issue.code === 'response.na-reason'));

        record.responses = record.responses.map((response, index) => index === 0
            ? { questionId: response.questionId, result: 'fail', note: '체결 불량 확인' }
            : response);
        assert.ok(validateConstructionPlanRecordForConfirmation(record, catalog)
            .some((issue) => issue.code === 'response.fail-action'));
    });

    it('requires real workers, equipment for equipment inspection, and photo evidence for photo sheets', () => {
        const equipment = completeRecord('equipment_daily_inspection');
        equipment.actualWorkers = [];
        equipment.actualEquipment = [];
        const equipmentIssues = validateConstructionPlanRecordForConfirmation(
            equipment,
            getConstructionPlanRecordCatalog('system-shoring', 'equipment_daily_inspection'),
        );
        assert.deepEqual(equipmentIssues.map((issue) => issue.code).filter((code) => code.endsWith('required')),
            ['workers.required', 'equipment.required']);

        const photoSheet = completeRecord('photo_sheet');
        photoSheet.photos = [];
        assert.ok(validateConstructionPlanRecordForConfirmation(
            photoSheet,
            getConstructionPlanRecordCatalog('system-shoring', 'photo_sheet'),
        ).some((issue) => issue.code === 'photos.required'));
    });

    it('separates draft/incomplete state and hashes only immutable confirmation source content', () => {
        const record = completeRecord();
        assert.equal(deriveConstructionPlanRecordDraftStatus({ responses: [{ questionId: 'q' }], photos: [], actualWorkers: [] }), 'draft');
        assert.equal(deriveConstructionPlanRecordDraftStatus(record), 'incomplete');
        const first = constructionPlanRecordConfirmationHash(record);
        const confirmedEnvelope = { ...record, status: 'confirmed', version: 9, confirmedAt: '2026-08-22T01:00:00.000Z' };
        assert.equal(constructionPlanRecordConfirmationHash(confirmedEnvelope), first);
        assert.notEqual(constructionPlanRecordConfirmationHash({ ...record, zone: 'B구간' }), first);
    });

    it('binds correction reason, actor, time and superseded confirmation hash into the new immutable hash', () => {
        const source = completeRecord();
        const sourceHash = constructionPlanRecordConfirmationHash(source);
        const corrected = {
            ...source,
            id: 'record-b',
            recordRevision: 1,
            supersedesRecordId: source.id,
            correctionReason: '설치 구간 표기 오류 정정',
            supersededConfirmationHash: sourceHash,
            correctionLineage: {
                supersedesRecordId: source.id,
                sourceConfirmationHash: sourceHash,
                reason: '설치 구간 표기 오류 정정',
                actorId: 'author-a',
                actorName: '작성자',
                createdAt: '2026-08-22T02:00:00.000Z',
            },
            createdAt: '2026-08-22T02:00:00.000Z',
        };
        const correctedHash = constructionPlanRecordConfirmationHash(corrected);
        assert.notEqual(correctedHash, constructionPlanRecordConfirmationHash({
            ...corrected,
            correctionReason: '다른 정정 사유',
            correctionLineage: { ...corrected.correctionLineage, reason: '다른 정정 사유' },
        }));
        assert.notEqual(correctedHash, constructionPlanRecordConfirmationHash({
            ...corrected,
            supersededConfirmationHash: 'f'.repeat(64),
            correctionLineage: { ...corrected.correctionLineage, sourceConfirmationHash: 'f'.repeat(64) },
        }));
    });
});
