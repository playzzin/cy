import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const source = readFileSync(join(__dirname, '../../src/constructionPlans/callables.ts'), 'utf8');

const sourceBlock = (start: string, end: string): string => {
    const startIndex = source.indexOf(start);
    const endIndex = source.indexOf(end, startIndex + start.length);
    assert.ok(startIndex >= 0, `missing block start: ${start}`);
    assert.ok(endIndex > startIndex, `missing block end: ${end}`);
    return source.slice(startIndex, endIndex);
};

describe('construction plan ERP draft callable wiring', () => {
    it('loads every linked master from server-owned site IDs', () => {
        const block = sourceBlock(
            'const createConstructionPlanDraft = async',
            'const createConstructionPlanRevision = async',
        );

        assert.match(block, /readTrimmedString\(site, \['clientCompanyId'\]\)/);
        assert.match(block, /readTrimmedString\(site, \['constructorCompanyId', 'companyId'\]\)/);
        assert.match(block, /readTrimmedString\(site, \['partnerId'\]\)/);
        assert.match(block, /readTrimmedString\(site, \['responsibleTeamId'\]\)/);
        assert.match(block, /loadConstructionPlanLinkedMaster\(COMPANIES_COLLECTION, companyId\)/);
        assert.match(block, /loadConstructionPlanLinkedMaster\(TEAMS_COLLECTION, responsibleTeamId\)/);
    });

    it('passes normalized masters into the canonical builder and persists its ERP envelope', () => {
        const block = sourceBlock(
            'const createConstructionPlanDraft = async',
            'const createConstructionPlanRevision = async',
        );

        assert.match(block, /callableFirestoreValue\(\{ \.\.\.site, id: request\.siteId \}\)/);
        assert.match(block, /clientCompany: clientCompanyId \? companiesById\.get\(clientCompanyId\) : undefined/);
        assert.match(block, /responsibleTeam,/);
        assert.match(block, /capturedAt: timestamp/);
        assert.match(block, /erpSnapshot: canonicalDraft\.erpSnapshot/);
        assert.doesNotMatch(block, /clientCompany:\s*request\./);
        assert.doesNotMatch(block, /responsibleTeam:\s*request\./);
    });
});
