import {
    expandSearchTerms,
    normalizeQuestionText,
    normalizeSearchText,
} from './manpowerDbSynonyms';

describe('manpowerDbSynonyms', () => {
    it('normalizes company markers and spacing', () => {
        expect(normalizeSearchText('㈜ 청연 건설')).toBe('청연건설');
        expect(normalizeSearchText('(주)현대-건설')).toBe('현대건설');
    });

    it('normalizes field vocabulary synonyms', () => {
        expect(normalizeQuestionText('계좌 미등록 근무자')).toContain('계좌없음');
        expect(normalizeQuestionText('최근 투입 없는 재직자')).toContain('출역');
    });

    it('expands canonical synonyms', () => {
        expect(expandSearchTerms('투입')).toContain('출역');
    });
});
