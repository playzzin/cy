import { buildMenuAccessRoles, canAccessMenuRoute, findMenuItemsByRoute } from './menuAccess';
import type { SiteDataType } from '../types/menu';

describe('menuAccess', () => {
    const menuData: SiteDataType = {
        admin: {
            name: 'Admin',
            icon: 'fa-shield-halved',
            menu: [
                {
                    text: '지원 관리',
                    sub: [
                        { text: '숙소 관리', path: '/support/accommodation', roles: ['지원담당'] },
                        '경비내역',
                    ],
                },
            ],
        },
    };

    it('finds route-backed menu items', () => {
        expect(findMenuItemsByRoute(menuData, '/support/accommodation?tab=status', { siteKey: 'admin' })).toHaveLength(1);
    });

    it('allows configured roles and admin roles', () => {
        expect(canAccessMenuRoute(menuData, '/support/accommodation', ['지원담당'], { siteKey: 'admin' })).toBe(true);
        expect(canAccessMenuRoute(menuData, '/support/accommodation', ['admin'], { siteKey: 'admin' })).toBe(true);
    });

    it('allows manager1 aliases to use support accommodation menus', () => {
        expect(buildMenuAccessRoles('manager1')).toEqual(
            expect.arrayContaining(['manager1', 'manager', 'support_manager', '지원담당', '숙소 관리'])
        );
        expect(canAccessMenuRoute(menuData, '/support/accommodation', ['manager1'], { siteKey: 'admin' })).toBe(true);
        expect(canAccessMenuRoute(menuData, '/support/accommodation', ['pos_manager1'], { siteKey: 'admin' })).toBe(true);
        expect(canAccessMenuRoute(menuData, '/support/accommodation', ['메니저1'], { siteKey: 'admin' })).toBe(true);
    });

    it('denies users without a configured role', () => {
        expect(canAccessMenuRoute(menuData, '/support/accommodation', ['일반'], { siteKey: 'admin' })).toBe(false);
    });

    it('uses MENU_PATHS for string menu entries', () => {
        const stringMenuData: SiteDataType = {
            admin: {
                name: 'Admin',
                icon: 'fa-shield-halved',
                menu: [{ text: '지원 관리', sub: ['숙소 관리'] }],
            },
        };

        expect(findMenuItemsByRoute(stringMenuData, '/support/accommodation', { siteKey: 'admin' })).toHaveLength(1);
        expect(canAccessMenuRoute(stringMenuData, '/support/accommodation', ['일반'], { siteKey: 'admin' })).toBe(true);
    });

    it('expands legacy menu role aliases for position based access', () => {
        expect(buildMenuAccessRoles('매니저1')).toEqual(
            expect.arrayContaining(['매니저1', 'manager', '매니저', '메니저'])
        );

        const managerMenuData: SiteDataType = {
            admin: {
                name: 'Admin',
                icon: 'fa-shield-halved',
                menu: [
                    { text: '관리 메뉴', path: '/admin/managed', roles: ['manager'] },
                    { text: '신규 메뉴', path: '/admin/newbie', roles: ['newbie'] },
                ],
            },
        };

        expect(canAccessMenuRoute(managerMenuData, '/admin/managed', ['매니저1'], { siteKey: 'admin' })).toBe(true);
        expect(canAccessMenuRoute(managerMenuData, '/admin/newbie', ['신규자'], { siteKey: 'admin' })).toBe(true);
    });

    it('combines base and additional positions when checking route access', () => {
        const mixedMenuData: SiteDataType = {
            admin: {
                name: 'Admin',
                icon: 'fa-shield-halved',
                menu: [
                    { text: '지원 메뉴', path: '/support/cards', roles: ['지원담당'] },
                ],
            },
        };

        expect(canAccessMenuRoute(mixedMenuData, '/support/cards', ['일반', ['지원담당']], { siteKey: 'admin' })).toBe(true);
        expect(canAccessMenuRoute(mixedMenuData, '/support/cards', ['일반'], { siteKey: 'admin' })).toBe(false);
    });

    it('keeps operation management menus open even when legacy role restrictions remain', () => {
        const operationMenuData: SiteDataType = {
            admin: {
                name: 'Admin',
                icon: 'fa-shield-halved',
                menu: [
                    {
                        text: '\uc6b4\uc601\uad00\ub9ac',
                        roles: ['admin'],
                        sub: [
                            { text: '\uc6b4\uc601 \ub300\uc2dc\ubcf4\ub4dc', path: '/office/dashboard', roles: ['admin'] },
                            { text: '\uc0ac\ubb34\uc2e4 \uc9c1\uc6d0 \uae09\uc5ec', path: '/payroll/office-staff-payroll', roles: ['admin'] },
                            { text: '\uc0ac\ubb34\uc2e4 \uc9c1\uc6d0', path: '/database/manpower-db?tab=offices', roles: ['admin'] },
                        ],
                    },
                ],
            },
        };

        expect(canAccessMenuRoute(operationMenuData, '/office/dashboard', ['일반'], { siteKey: 'admin' })).toBe(true);
        expect(canAccessMenuRoute(operationMenuData, '/payroll/office-staff-payroll', ['일반'], { siteKey: 'admin' })).toBe(true);
        expect(canAccessMenuRoute(operationMenuData, '/database/manpower-db?tab=offices', ['일반'], { siteKey: 'admin' })).toBe(true);
        expect(canAccessMenuRoute(operationMenuData, '/database/manpower-db?tab=workers', ['일반'], { siteKey: 'admin' })).toBe(false);
    });
});
