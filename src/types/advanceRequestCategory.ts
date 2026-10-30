export const ADVANCE_REQUEST_ROUNDS = ['first', 'second'] as const;
export const ADVANCE_REQUEST_CATEGORIES = [...ADVANCE_REQUEST_ROUNDS, 'other'] as const;
export type AdvanceRequestCategory = typeof ADVANCE_REQUEST_CATEGORIES[number] | 'unclassified';
export const ADVANCE_REQUEST_CATEGORY_LABELS: Record<AdvanceRequestCategory, string> = {
    first: '1회차', second: '2회차', other: '선입금', unclassified: '회차 미지정',
};
export const normalizeAdvanceRequestCategory = (value: unknown): AdvanceRequestCategory =>
    value === 'first' || value === 'second' || value === 'other' ? value : 'unclassified';

export const getAdvanceRequestCategory = (request: { category?: unknown; source?: unknown }): AdvanceRequestCategory =>
    request.category === 'first' || request.category === 'second' ? request.category
        : request.source === 'manual-prepayment' && request.category === 'other' ? 'other' : 'unclassified';
