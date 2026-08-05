export enum UserRole {
    ADMIN = '관리자',
    MANAGER = '매니저',
    GENERAL = '일반',
    PAYROLL_MANAGER = 'PAYROLL_MANAGER',
    OFFICE_STAFF = 'OFFICE_STAFF',
    SITE_MANAGER = 'SITE_MANAGER'
}

export interface PermissionConfig {
    [role: string]: {
        [menuId: string]: boolean;
    };
}

export const DEFAULT_PERMISSIONS: PermissionConfig = {
    [UserRole.ADMIN]: {
        'dashboard': true,
        'status-board': true,
        'manpower-input': true,
        'manpower-list': true,
        'assignment': true,
        'daily-report-input': true,
        'daily-report-list': true,
        'payroll-payment': true,
        'payroll-payslip': true,
        'smart-memo': true,
        'test-settings': true,
        'welfare-assets': true,
        'system-config': true,
        'jeonkuk-dashboard': true,
        'jeonkuk-status': true
    },
    [UserRole.MANAGER]: {
        'dashboard': true,
        'status-board': false,
        'manpower-input': true,
        'manpower-list': true,
        'assignment': true,
        'daily-report-input': true,
        'daily-report-list': true,
        'payroll-payment': false,
        'payroll-payslip': true,
        'smart-memo': false,
        'test-settings': false,
        'welfare-assets': false,
        'system-config': false,
        'jeonkuk-dashboard': false,
        'jeonkuk-status': false
    },
    [UserRole.GENERAL]: {
        'dashboard': true,
        'status-board': false,
        'manpower-input': false,
        'manpower-list': false,
        'assignment': false,
        'daily-report-input': false,
        'daily-report-list': false,
        'payroll-payment': false,
        'payroll-payslip': true, // 본인 명세서만 조회
        'smart-memo': false,
        'test-settings': false,
        'welfare-assets': false,
        'system-config': false,
        'jeonkuk-dashboard': false,
        'jeonkuk-status': false
    },
    [UserRole.PAYROLL_MANAGER]: {},
    [UserRole.OFFICE_STAFF]: {},
    [UserRole.SITE_MANAGER]: {}
};
