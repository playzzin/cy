import { MENU_PATHS } from './menuPaths';

describe('CEO menu page routes', () => {
    it('exposes the standalone buyback page to the menu editor', () => {
        expect(MENU_PATHS['바이백']).toBe('/payroll/field-buyback');
        expect(MENU_PATHS['바이백 페이지']).toBe('/payroll/field-buyback');
    });

    it('keeps the legacy progress-claim allocation tab under a distinct name', () => {
        expect(MENU_PATHS['관계자 배분']).toBe('/payroll/progress-claims?tab=buyback');
    });

    it('maps the named card-management page to the partner photo registration page', () => {
        expect(MENU_PATHS['명함관리 페이지']).toBe('/database/partner-photo-registration');
    });
});
