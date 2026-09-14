import {
    DEFAULT_DELEGATORS_PER_PAGE,
    MAX_DELEGATORS_PER_PAGE,
    clampDelegatorsPerPage,
    paginateDelegators,
} from './delegationLetterPagination';

describe('delegationLetterPagination', () => {
    it('keeps up to 20 delegators on the first page', () => {
        const delegators = Array.from({ length: 20 }, (_, index) => index + 1);

        expect(DEFAULT_DELEGATORS_PER_PAGE).toBe(20);
        expect(paginateDelegators(delegators, DEFAULT_DELEGATORS_PER_PAGE)).toEqual([delegators]);
    });

    it('starts a new page after the twentieth delegator', () => {
        const delegators = Array.from({ length: 21 }, (_, index) => index + 1);

        expect(paginateDelegators(delegators, MAX_DELEGATORS_PER_PAGE)).toEqual([
            delegators.slice(0, 20),
            delegators.slice(20),
        ]);
    });

    it('caps user input at 20 and handles invalid values safely', () => {
        expect(clampDelegatorsPerPage(24)).toBe(20);
        expect(clampDelegatorsPerPage(7.9)).toBe(7);
        expect(clampDelegatorsPerPage(0)).toBe(1);
        expect(clampDelegatorsPerPage(Number.NaN)).toBe(1);
    });
});
