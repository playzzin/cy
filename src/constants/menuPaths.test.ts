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

    it('maps the cash receipt confirmation menu to its payroll page', () => {
        expect(MENU_PATHS['현금수령확인서']).toBe('/payroll/cash-receipt-confirmation');
        expect(MENU_PATHS['현금수령 확인서']).toBe('/payroll/cash-receipt-confirmation');
        expect(MENU_PATHS['급여계좌 변경 신청서']).toBe('/payroll/account-change-request');
        expect(MENU_PATHS['계좌변경신청서']).toBe('/payroll/account-change-request');
    });

    it('maps construction-plan authoring pages', () => {
        expect(MENU_PATHS['시공계획서']).toBe('/construction-plans');
        expect(MENU_PATHS['시공계획서 작성']).toBe('/construction-plans/create');
        expect(MENU_PATHS['시공계획서 관리']).toBe('/construction-plans/manage');
        expect(MENU_PATHS['시스템동바리 시공계획서']).toBe('/construction-plans');
        expect(MENU_PATHS['검토·승인함']).toBe('/construction-plan-approvals');
        expect(MENU_PATHS['PDF 발행이력']).toBe('/construction-plan-exports');
    });
});
