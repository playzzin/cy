import { MenuItem } from '../../../types/menu';
import { addMenuItemsSafely } from './menuBulkApply';

describe('addMenuItemsSafely', () => {
    it('adds new menu items without changing the original target', () => {
        const target: MenuItem[] = [{ id: 'home', text: '홈', path: '/home' }];
        const source: MenuItem[] = [{ id: 'people', text: '인력관리', path: '/people' }];

        const result = addMenuItemsSafely(target, source, 'test');

        expect(result.addedCount).toBe(1);
        expect(result.skippedCount).toBe(0);
        expect(result.menu.map((item) => item.path)).toEqual(['/home', '/people']);
        expect(result.menu[1].id).not.toBe('people');
        expect(target).toHaveLength(1);
    });

    it('skips an existing route even when it is nested elsewhere', () => {
        const target: MenuItem[] = [{
            id: 'existing-group',
            text: '기존 그룹',
            sub: [{ id: 'people', text: '인력관리', path: '/people/' }]
        }];
        const source: MenuItem[] = [{ id: 'source-people', text: '다른 이름', path: '/people' }];

        const result = addMenuItemsSafely(target, source, 'test');

        expect(result.addedCount).toBe(0);
        expect(result.skippedCount).toBe(1);
        expect(result.menu).toEqual(target);
    });

    it('merges matching folders and adds only missing children', () => {
        const target: MenuItem[] = [{
            id: 'target-payroll',
            text: '급여관리',
            icon: 'target-icon',
            sub: [{ id: 'monthly', text: '월급여', path: '/payroll/monthly' }]
        }];
        const source: MenuItem[] = [{
            id: 'source-payroll',
            text: '급여관리',
            icon: 'source-icon',
            sub: [
                { id: 'source-monthly', text: '월급여', path: '/payroll/monthly' },
                { id: 'source-daily', text: '일급여', path: '/payroll/daily' }
            ]
        }];

        const result = addMenuItemsSafely(target, source, 'test');
        const folder = result.menu[0];

        expect(result.addedCount).toBe(1);
        expect(result.skippedCount).toBe(2);
        expect(folder.id).toBe('target-payroll');
        expect(folder.icon).toBe('target-icon');
        expect(folder.sub).toHaveLength(2);
        expect((folder.sub?.[1] as MenuItem).path).toBe('/payroll/daily');
    });

    it('does not copy visual separators', () => {
        const result = addMenuItemsSafely([], [
            { id: 'separator', text: '-' },
            { id: 'home', text: '홈', path: '/home' }
        ], 'test');

        expect(result.addedCount).toBe(1);
        expect(result.menu).toHaveLength(1);
        expect(result.menu[0].path).toBe('/home');
    });
});
