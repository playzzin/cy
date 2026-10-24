import { getDashboardModeForPosition, getPreferredPositionIdForDashboardMode } from './roleDashboardConfig';

describe('getDashboardModeForPosition', () => {
    it.each(['CEO', 'ceo'])('uses the %s position for the executive dashboard', name => {
        expect(getDashboardModeForPosition('configured-ceo-position', name)).toBe('executive');
        expect(getPreferredPositionIdForDashboardMode('executive', [
            { id: 'full', name: '전체', icon: '', color: '' },
            { id: 'configured-ceo-position', name, icon: '', color: '' },
        ])).toBe('configured-ceo-position');
    });

    it('keeps a DEV CEO position on the executive dashboard', () => {
        expect(getDashboardModeForPosition('dev_ceo', 'DEV CEO')).toBe('executive');
    });
});
