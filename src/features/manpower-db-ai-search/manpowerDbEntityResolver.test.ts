import { createManpowerDbSearchFixture } from './manpowerDbTestFixtures';
import { resolveManpowerDbEntities } from './manpowerDbEntityResolver';

describe('manpowerDbEntityResolver', () => {
    it('extracts ambiguous site candidates', () => {
        const resolution = resolveManpowerDbEntities(createManpowerDbSearchFixture(), '과천', 'site');

        expect(resolution.candidates.map((candidate) => candidate.name)).toEqual(expect.arrayContaining(['과천 A현장', '과천 B현장']));
        expect(resolution.selected).toBeUndefined();
    });

    it('extracts company candidates with match reasons', () => {
        const resolution = resolveManpowerDbEntities(createManpowerDbSearchFixture(), '청연', 'company');

        expect(resolution.candidates[0].entity).toBe('company');
        expect(resolution.candidates[0].matchReason).toContain('회사');
    });
});
