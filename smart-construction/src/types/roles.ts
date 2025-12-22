export enum UserRole {
    ADMIN = '관리자',
    MANAGER = '매니저',
    GENERAL = '일반'
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
        'test-settings': true,
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
        'test-settings': false,
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
        'test-settings': false,
        'system-config': false,
        'jeonkuk-dashboard': false,
        'jeonkuk-status': false
    }
};
