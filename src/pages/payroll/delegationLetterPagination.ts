export const MAX_DELEGATORS_PER_PAGE = 20;
export const DEFAULT_DELEGATORS_PER_PAGE = 20;

export const clampDelegatorsPerPage = (value: number): number => {
    if (!Number.isFinite(value) || value <= 0) return 1;
    return Math.min(Math.floor(value), MAX_DELEGATORS_PER_PAGE);
};

export const paginateDelegators = <T,>(items: T[], requestedPerPage: number): T[][] => {
    const pageSize = clampDelegatorsPerPage(requestedPerPage);
    const pages: T[][] = [];

    for (let index = 0; index < items.length; index += pageSize) {
        pages.push(items.slice(index, index + pageSize));
    }

    return pages;
};
