import { strict as assert } from 'assert';
import { describe, it } from 'node:test';
import {
    SYSTEM_SCAFFOLD_SERVER_TEMPLATE,
    SYSTEM_SHORING_SERVER_TEMPLATE,
    assertConstructionPlanServerTemplateIntegrity,
    getLatestConstructionPlanServerTemplate,
    resolveConstructionPlanServerTemplate,
} from './templateContracts';

describe('construction-plan server template contracts', () => {
    it('locks both trades to complete, ordered 42-page contracts', () => {
        [SYSTEM_SHORING_SERVER_TEMPLATE, SYSTEM_SCAFFOLD_SERVER_TEMPLATE].forEach((contract) => {
            assert.equal(contract.pages.length, 42);
            assert.deepEqual(contract.pages.map((page) => page.pageNumber), Array.from({ length: 42 }, (_, index) => index + 1));
            assert.doesNotThrow(() => assertConstructionPlanServerTemplateIntegrity(contract));
            assert.equal(Object.isFrozen(contract), true);
            assert.equal(Object.isFrozen(contract.riskAssessmentPolicy), true);
            assert.equal(Object.isFrozen(contract.riskAssessmentPolicy.thresholds), true);
        });
    });

    it('resolves only a matching trade, template ID and immutable version', () => {
        assert.equal(resolveConstructionPlanServerTemplate({
            tradeType: 'system-scaffold',
            templateId: 'system-scaffold-standard',
            templateVersion: '1.0.0',
        }), SYSTEM_SCAFFOLD_SERVER_TEMPLATE);
        assert.throws(() => resolveConstructionPlanServerTemplate({
            tradeType: 'system-scaffold',
            templateId: 'system-shoring-standard',
            templateVersion: '1.0.0',
        }), /unsupported/);
        assert.throws(() => resolveConstructionPlanServerTemplate({
            tradeType: 'system-shoring',
            templateId: 'system-shoring-standard',
            templateVersion: '2.0.0',
        }), /unsupported/);
    });

    it('fails closed when an immutable risk policy has gaps or loses acceptance rules', () => {
        const corrupted = JSON.parse(JSON.stringify(SYSTEM_SHORING_SERVER_TEMPLATE));
        corrupted.riskAssessmentPolicy.thresholds[1].minScore = 6;
        assert.throws(
            () => assertConstructionPlanServerTemplateIntegrity(corrupted),
            /risk-threshold-invalid/,
        );
        const missingAcceptance = JSON.parse(JSON.stringify(SYSTEM_SHORING_SERVER_TEMPLATE));
        missingAcceptance.riskAssessmentPolicy.acceptance.blockedResidualLevels = [];
        assert.throws(
            () => assertConstructionPlanServerTemplateIntegrity(missingAcceptance),
            /risk-policy-invalid/,
        );
    });

    it('keeps scaffold-specific construction identities and drawing slots independent', () => {
        assert.equal(getLatestConstructionPlanServerTemplate('system-shoring'), SYSTEM_SHORING_SERVER_TEMPLATE);
        assert.equal(getLatestConstructionPlanServerTemplate('system-scaffold'), SYSTEM_SCAFFOLD_SERVER_TEMPLATE);
        assert.equal(SYSTEM_SCAFFOLD_SERVER_TEMPLATE.pages[18].sectionKey, 'base-standard-assembly');
        assert.equal(SYSTEM_SCAFFOLD_SERVER_TEMPLATE.pages[20].sectionKey, 'wall-tie-anchorage');
        assert.deepEqual(SYSTEM_SCAFFOLD_SERVER_TEMPLATE.pages[20].drawingSlots, ['D-04']);
        assert.equal(SYSTEM_SCAFFOLD_SERVER_TEMPLATE.pages[30].sectionKey, 'work-platform-access-plan');
        assert.equal(SYSTEM_SCAFFOLD_SERVER_TEMPLATE.pages[39].sectionKey, 'scaffold-daily-log');
    });
});
