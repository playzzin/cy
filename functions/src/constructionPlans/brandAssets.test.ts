import { strict as assert } from 'assert';
import { createHash } from 'crypto';
import { describe, it } from 'node:test';
import {
    CONSTRUCTION_PLAN_BRAND_LOGO_SHA256,
    getConstructionPlanBrandLogoPng,
} from './brandAssets';

describe('construction-plan brand assets', () => {
    it('packages the immutable Cheongyeon ENG logo into the Functions artifact', () => {
        const first = getConstructionPlanBrandLogoPng();
        const second = getConstructionPlanBrandLogoPng();
        assert.equal(first, second);
        assert.ok(first.length > 100_000);
        assert.equal(createHash('sha256').update(first).digest('hex'), CONSTRUCTION_PLAN_BRAND_LOGO_SHA256);
        assert.deepEqual([...first.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    });
});
