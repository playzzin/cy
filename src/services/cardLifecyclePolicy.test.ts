import {
    assertCardCanBeAssignedOrBilled,
    assertCardCanBeRestored,
    canRestoreCardStatus,
    createCardLifecycleOperationId,
    formatKoreanBusinessDate,
    isInactiveCardStatus,
} from './cardLifecyclePolicy';

describe('cardLifecyclePolicy', () => {
    it('treats suspended and closed cards as inactive', () => {
        expect(isInactiveCardStatus('SUSPENDED')).toBe(true);
        expect(isInactiveCardStatus('CLOSED')).toBe(true);
        expect(isInactiveCardStatus('AVAILABLE')).toBe(false);
        expect(isInactiveCardStatus('ASSIGNED')).toBe(false);
    });

    it('allows restore only from suspended status', () => {
        expect(canRestoreCardStatus('SUSPENDED')).toBe(true);
        expect(canRestoreCardStatus('CLOSED')).toBe(false);
        expect(canRestoreCardStatus('AVAILABLE')).toBe(false);
        expect(() => assertCardCanBeRestored('SUSPENDED')).not.toThrow();
        expect(() => assertCardCanBeRestored('CLOSED'))
            .toThrow('card-restore-requires-suspended-status');
        expect(() => assertCardCanBeRestored('AVAILABLE'))
            .toThrow('card-restore-requires-suspended-status');
    });

    it('blocks assignment and billing for inactive cards', () => {
        expect(() => assertCardCanBeAssignedOrBilled('AVAILABLE')).not.toThrow();
        expect(() => assertCardCanBeAssignedOrBilled('ASSIGNED')).not.toThrow();
        expect(() => assertCardCanBeAssignedOrBilled('SUSPENDED'))
            .toThrow('inactive-card-operation-blocked');
        expect(() => assertCardCanBeAssignedOrBilled('CLOSED'))
            .toThrow('inactive-card-operation-blocked');
    });

    it('formats the business date in Asia/Seoul across the UTC date boundary', () => {
        expect(formatKoreanBusinessDate(new Date('2026-08-18T14:59:59.000Z'))).toBe('2026-08-18');
        expect(formatKoreanBusinessDate(new Date('2026-08-18T15:00:00.000Z'))).toBe('2026-08-19');
    });

    it('creates action- and card-scoped operation ids', () => {
        expect(createCardLifecycleOperationId('restore', 'card-3909'))
            .toMatch(/^card-restore-card-3909-/);
        expect(createCardLifecycleOperationId('cancel', 'card-3909'))
            .toMatch(/^card-cancel-card-3909-/);
    });
});
