import { buildPermissionMatrix, flattenMenuPermissions } from './permissionMatrix';
import type { SiteDataType } from '../../types/menu';

const menuData: SiteDataType = {
  office: {
    name: 'Office',
    icon: 'building',
    order: 2,
    menu: [
      { id: 'home', text: 'Home', path: '/home' },
      {
        id: 'finance',
        text: 'Finance',
        path: '/finance',
        roles: ['CFO'],
        sub: [
          { id: 'invoice', text: 'Invoice', path: '/finance/invoice', roles: ['CFO', 'Manager'] },
          { id: 'audit', text: 'Audit', path: '/finance/audit', hide: true },
        ],
      },
    ],
  },
  admin: {
    name: 'Admin',
    icon: 'shield',
    order: 1,
    menu: [
      { id: 'users', text: 'Users', path: '/admin/users', roles: ['Admin'] },
    ],
  },
};

const roles = [
  { id: 'Admin', label: 'Administrator' },
  { id: 'CFO', label: 'Finance Lead' },
  { id: 'Manager', label: 'Manager' },
];

describe('permissionMatrix', () => {
  it('flattens menu rows by selected site and keeps nested depth', () => {
    const rows = flattenMenuPermissions(menuData, { selectedSite: 'office' });

    expect(rows.map((row) => row.id)).toEqual([
      'office:home',
      'office:finance',
      'office:invoice',
    ]);
    expect(rows[2]).toMatchObject({
      depth: 1,
      menuPath: 'Finance > Invoice',
      route: '/finance/invoice',
    });
  });

  it('treats menus without roles as globally accessible', () => {
    const matrix = buildPermissionMatrix(menuData, roles, { selectedSite: 'office' });
    const home = matrix.rows.find((row) => row.id === 'office:home');

    expect(home?.mode).toBe('global');
    expect(home?.accessByRole).toEqual({
      Admin: true,
      CFO: true,
      Manager: true,
    });
  });

  it('limits restricted menus to configured roles', () => {
    const matrix = buildPermissionMatrix(menuData, roles, { selectedSite: 'office' });
    const finance = matrix.rows.find((row) => row.id === 'office:finance');
    const invoice = matrix.rows.find((row) => row.id === 'office:invoice');

    expect(finance?.accessByRole).toEqual({
      Admin: false,
      CFO: true,
      Manager: false,
    });
    expect(invoice?.allowedRoleLabels).toBe('Finance Lead, Manager');
    expect(invoice?.restrictedRoleCount).toBe(1);
  });

  it('can include hidden menus for audits when requested', () => {
    const matrix = buildPermissionMatrix(menuData, roles, {
      selectedSite: 'office',
      includeHidden: true,
    });

    expect(matrix.rows.some((row) => row.id === 'office:audit')).toBe(true);
    expect(matrix.hiddenCount).toBe(1);
  });
});
