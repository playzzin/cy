import { getDashboardModeForPosition } from './roleDashboardConfig';

describe('getDashboardModeForPosition', () => {
    it('keeps a DEV CEO position on the executive dashboard', () => {
        expect(getDashboardModeForPosition('dev_ceo', 'DEV CEO')).toBe('executive');
    });
});
