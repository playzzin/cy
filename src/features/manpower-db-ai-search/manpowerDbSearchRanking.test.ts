import { rankTextMatch } from './manpowerDbSearchRanking';

describe('manpowerDbSearchRanking', () => {
    it('prioritizes exact and normalized matches', () => {
        expect(rankTextMatch('청연건설', '청연건설').score).toBe(1);
        expect(rankTextMatch('㈜ 청연 건설', '청연건설').score).toBeGreaterThan(0.9);
    });

    it('scores contains and fuzzy matches with reasons', () => {
        const contains = rankTextMatch('과천 A현장', '과천', '현장명');
        expect(contains.score).toBeGreaterThan(0.8);
        expect(contains.matchReason).toContain('현장명');

        const fuzzy = rankTextMatch('과천 A현장', '과A');
        expect(fuzzy.score).toBeGreaterThan(0);
    });
});
